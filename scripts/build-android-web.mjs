/**
 * scripts/build-android-web.mjs
 *
 * Builds the static frontend for the Android app (used as Tauri's beforeBuildCommand
 * via src-tauri/tauri.android.conf.json).
 */
import { execSync } from 'child_process';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const env = {
  ...process.env,
  TAURI_ENV: 'true',
  // Upstream only publishes desktop releases, so the update checker has nothing to offer here
  DISABLE_UPDATE_CHECK: 'true',
  // Each language adds ~60MB of prerendered pages to the APK. Override with ANDROID_LOCALES=en,de
  NEXT_PUBLIC_LOCALES: process.env.ANDROID_LOCALES || 'en',
  // Switches the UI to the app shell (see src/lib/platform.ts)
  NEXT_PUBLIC_PLATFORM: 'android',
};

// Don't let pages from a previous (e.g. all-languages) build leak into the APK.
// Empty the folder rather than deleting it: Windows refuses if anything has it open.
const outDir = join(process.cwd(), 'out');
if (existsSync(outDir)) {
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }
}

execSync('npm run build', { stdio: 'inherit', env });

// Every asset is embedded in the APK. The app loads the decompressed LibreOffice files,
// so the .gz copies (only useful to web servers) are dead weight.
const wasmDir = join(process.cwd(), 'out', 'libreoffice-wasm');
if (existsSync(wasmDir)) {
  for (const file of readdirSync(wasmDir)) {
    if (file.endsWith('.gz')) {
      rmSync(join(wasmDir, file));
      console.log(`[android] Removed out/libreoffice-wasm/${file}`);
    }
  }
}
