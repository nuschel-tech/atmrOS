import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Where the static build is written. Defaults to the VPS web root; override
// with BUILD_OUT_DIR (e.g. for local testing).
const outDir = process.env.BUILD_OUT_DIR || '/var/www/atomar';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: outDir,
      assets: outDir,
      fallback: undefined,
      precompress: false,
      strict: true
    })
  }
};

export default config;
