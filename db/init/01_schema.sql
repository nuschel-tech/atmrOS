-- atmrOS — Kernschema (Schritt 1)
-- Design-Prinzip: Es wird NIE ein "Zustand" gespeichert, sondern immer
-- Beobachtungen mit Zeitstempel. Live / Archiv / Änderungen fallen aus
-- derselben Tabelle. Nur geänderte Objekte erzeugen neue Zeilen.
--
-- Dieses Skript läuft automatisch beim ersten Init des postgis-Containers
-- (/docker-entrypoint-initdb.d). Idempotent gehalten (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- object: stabile Identität pro OSM-Element.
-- osm_type: 'n' node, 'w' way, 'r' relation. Zusammen mit osm_id eindeutig.
-- geom: Repräsentativpunkt in WGS84 (4326). Ways/Areas werden beim Ingest auf
--       einen Punkt reduziert (marker-tauglich, MVT-freundlich).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS object (
    osm_type   char(1)               NOT NULL,
    osm_id     bigint                NOT NULL,
    category   text                  NOT NULL,
    -- Feinere Klassifikation aus den OSM-Tags (nullable). Ehrlichkeit: ein
    -- Kirchturm (tower:type=bell_tower) darf nicht als Sendemast durchgehen,
    -- eine Ortsnetzstation (substation=minor_distribution) nicht als Umspannwerk.
    subtype    text,
    -- present: war das Objekt im letzten Scan sichtbar? Verschwundene Objekte
    -- werden NICHT gelöscht (Historie bleibt), sondern present=false gesetzt
    -- (DELETED). Kommt es zurück -> RESTORED. Live-Ansicht filtert present.
    present    boolean               NOT NULL DEFAULT true,
    first_seen timestamptz           NOT NULL,
    last_seen  timestamptz           NOT NULL,
    geom       geometry(Point, 4326) NOT NULL,
    PRIMARY KEY (osm_type, osm_id)
);

-- Räumlicher Index in 4326. Der Tile-Endpoint transformiert die Kachel-Bounds
-- nach 4326 für den bbox-Filter (&&) und nutzt so diesen Index; ST_Transform
-- ist STABLE (nicht IMMUTABLE) und darf daher NICHT in einer generierten
-- Spalte stehen — deshalb bewusst keine gespeicherte 3857-Spalte.
CREATE INDEX IF NOT EXISTS object_geom_idx     ON object USING gist (geom);
CREATE INDEX IF NOT EXISTS object_category_idx ON object (category);
CREATE INDEX IF NOT EXISTS object_cat_sub_idx  ON object (category, subtype);

-- ---------------------------------------------------------------------------
-- observation: eine Zeile pro Scan NUR wenn sich der attr_hash gegenüber der
-- letzten Beobachtung desselben Objekts ändert. attrs = alle OSM-Tags.
-- source / source_url: die offengelegte Herkunft (Kern-Signatur von atmrOS).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS observation (
    id          bigserial   PRIMARY KEY,
    osm_type    char(1)     NOT NULL,
    osm_id      bigint      NOT NULL,
    observed_at timestamptz NOT NULL,
    attrs       jsonb       NOT NULL,
    attr_hash   char(64)    NOT NULL,
    source      text        NOT NULL,
    source_url  text        NOT NULL,
    FOREIGN KEY (osm_type, osm_id)
        REFERENCES object (osm_type, osm_id) ON DELETE CASCADE
);

-- "neueste Beobachtung pro Objekt" (Live-Ansicht) und Historie: beide schnell
-- über diesen Index. Dedup-gegen-letzten-Hash passiert app-seitig im Ingest,
-- damit ein RESTORED (Rücksprung auf alten Hash) korrekt eine neue Zeile
-- erzeugt — eine reine UNIQUE(obj,hash)-Regel würde das fälschlich blocken.
CREATE INDEX IF NOT EXISTS observation_obj_time_idx
    ON observation (osm_type, osm_id, observed_at DESC, id DESC);

-- ---------------------------------------------------------------------------
-- change_event: fällt beim Diff zweier Scans an. In Schritt 1 angelegt aber
-- leer — die Diff-Logik ist Schritt 2 (Nightly + Änderungsansicht).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_event (
    id          bigserial   PRIMARY KEY,
    osm_type    char(1)     NOT NULL,
    osm_id      bigint      NOT NULL,
    event_type  text        NOT NULL
                CHECK (event_type IN ('NEW', 'CHANGED', 'DELETED', 'RESTORED')),
    observed_at timestamptz NOT NULL,
    diff        jsonb
);
CREATE INDEX IF NOT EXISTS change_event_obj_idx
    ON change_event (osm_type, osm_id, observed_at DESC);
