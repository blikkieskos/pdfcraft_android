# PDFCraft for Android (unofficial)

An Android app built from [PDFCraft](https://github.com/PDFCraftTool/pdfcraft): a PDF viewer first, with PDFCraft's 130+ tools one tap away. Everything runs on the phone; your files are never uploaded.

> This is a community port maintained at [blikkieskos/pdfcraft_android](https://github.com/blikkieskos/pdfcraft_android). It is not affiliated with or endorsed by the PDFCraft team.
>
> Like it? **[☕ Support the Android port on Ko-fi](https://ko-fi.com/epiblitikos)**

## Download and install

1. On your phone, download the latest `.apk` from **[Releases](https://github.com/blikkieskos/pdfcraft_android/releases/latest)**.
2. Open it. Android asks you to allow installing apps from your browser or file manager: allow it.
3. Google Play Protect may warn that the developer is unknown. That is expected for apps installed from outside the Play Store: choose to install anyway.

Requires Android 7.0 or newer on a 64-bit ARM phone (practically every phone since 2017). The app is about 160 MB because the LibreOffice and PyMuPDF engines are built in, so the tools work offline.

Updates install over the previous version. Your settings are kept.

## What it does

- **Viewer first**: open a PDF from the home screen, read it full screen, zoom with pinch or the big +/− buttons, search, highlight and annotate.
- **Open with PDFCraft**: tap a PDF in Files, WhatsApp, Gmail and so on and choose PDFCraft, or share a PDF to it.
- **Default PDF app**: the home screen walks you through making PDFCraft the app that opens your PDFs (Android leaves that choice to you: pick PDFCraft, then *Always*).
- **Tools on the open document**: from the viewer, tap the wrench and pick a tool (compress, sign, split, convert, …); the document is already loaded.
- **PDF Studio**: several edits in a row on one document, with undo.
- Light and dark mode follow your phone's setting.

## Known limitations

- English only (other languages are left out to keep the app smaller).
- No printing.
- Word/Excel/PowerPoint conversions load a large engine and can be slow, or fail, on phones with little memory.
- OCR downloads its language data the first time it is used, and DjVu → PDF loads a script from the internet. Your documents themselves are never sent anywhere.

## Building from source (Windows)

The Android app is the regular PDFCraft web app wrapped with [Tauri 2](https://v2.tauri.app/). Changes to the shared code only apply to the Android build (`NEXT_PUBLIC_PLATFORM=android`, see `src/lib/platform.ts`), apart from a few small fixes for narrow screens that also help the website.

Prerequisites:

- Node.js 22 and Git
- Rust via rustup, host toolchain `stable-x86_64-pc-windows-gnu`, plus `rustup target add aarch64-linux-android`
- GNU binutils from MSYS2 (`mingw-w64-ucrt-x86_64-binutils` and its dependencies) unpacked into `%LOCALAPPDATA%\Programs\mingw-binutils`. The GNU Rust toolchain needs its `dlltool` and `as`.
- JDK 17, and the Android SDK with `platforms;android-36`, `build-tools;36.0.0` and `ndk;27.3.13750724`
- User environment variables `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME`

Then, from the repository root:

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 -Release
```

The APK lands in `src-tauri\gen\android\app\build\outputs\apk\arm64\release\`. Without Windows Developer Mode the Tauri CLI cannot symlink the compiled library into the Android project; the script then copies it and finishes the build with Gradle itself.

Release signing reads `src-tauri\gen\android\keystore.properties` (git-ignored):

```properties
storeFile=C:/path/to/your-release-key.jks
keyAlias=your-alias
password=your-store-and-key-password
```

Without it, release APKs are built unsigned. Build-time options: `ANDROID_LOCALES=en,de` ships more languages.

### Where the Android parts live

| Area | Files |
|---|---|
| App shell (home, viewer, top bar) | `src/components/app/`, `src/components/layout/AppHeader.tsx`, `src/app/[locale]/view/` |
| File saving, downloads, incoming files | `src/lib/tauri-bridge.ts`, `src/components/common/Android*.tsx`, `src/lib/app/` |
| Native side | `src-tauri/gen/android/app/src/main/` (`MainActivity.kt`, `AndroidManifest.xml`), `src-tauri/src/lib.rs` |
| Build | `scripts/build-android.ps1`, `scripts/build-android-web.mjs`, `src-tauri/tauri.android.conf.json` |

## License

Same as PDFCraft: [GNU AGPL-3.0](LICENSE). This repository is the complete source of the Android app. Android-specific changes © 2026 blikkieskos, based on PDFCraft by PDFCraftTool.
