// Passwort-Prüfung gegen den bcrypt-Hash aus ATMROS_UNLOCK_PASSWORD_HASH.
// Klartext-Passwort wird NIE gespeichert, nur der Hash liegt in der Env.

import bcrypt from "bcryptjs";

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
