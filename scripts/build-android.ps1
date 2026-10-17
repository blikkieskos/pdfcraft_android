<#
  Builds the PDFCraft Android APK on Windows.

  Usage (from the repo root):
    powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1            # debug APK
    powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 -Release   # signed release APK

  Needs: Node, Rust (x86_64-pc-windows-gnu host + aarch64-linux-android target), JDK 17,
  Android SDK + NDK (JAVA_HOME / ANDROID_HOME / NDK_HOME set), and Windows Developer Mode
  (the Tauri CLI symlinks the compiled library into the Android project).
#>
param(
  [switch]$Release,
  # Skip rebuilding the web frontend when out/ is already up to date
  [switch]$SkipWeb
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

foreach ($name in 'JAVA_HOME', 'ANDROID_HOME', 'NDK_HOME') {
  if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
    $value = [Environment]::GetEnvironmentVariable($name, 'User')
    if (-not $value) { throw "$name is not set" }
    Set-Item "env:$name" $value
  }
}

# Host-side crates that use raw-dylib (windows-link) need GNU dlltool, which in turn needs `as`.
# Rust's bundled dlltool ships without `as`, so MSYS2's binutils (ucrt64) must come first on PATH.
$binutils = "$env:LOCALAPPDATA\Programs\mingw-binutils\ucrt64\bin"
if (-not (Test-Path "$binutils\dlltool.exe")) { throw "GNU binutils not found at $binutils" }
$systemPath = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$binutils;$env:USERPROFILE\.cargo\bin;$env:JAVA_HOME\bin;$systemPath;$env:Path"

# Google Play requires 16 KB page alignment for native code (NDK r27 defaults to 4 KB).
# RUSTFLAGS outranks the per-target flags the Tauri CLI sets, so repeat its three link flags.
# With --target, cargo applies RUSTFLAGS only to the Android library, not to host build tools.
$env:RUSTFLAGS = '-Clink-arg=-landroid -Clink-arg=-llog -Clink-arg=-lOpenSLES -Clink-arg=-Wl,-z,max-page-size=16384'

$tauriArgs = @('node_modules/@tauri-apps/cli/tauri.js', 'android', 'build', '--apk', '--target', 'aarch64', '--ci')
if (-not $Release) { $tauriArgs += '--debug' }
if ($SkipWeb) {
  # A file avoids Windows PowerShell mangling quotes in inline JSON arguments
  $skipWebConfig = Join-Path $env:TEMP 'pdfcraft-skip-web-build.json'
  '{"build":{"beforeBuildCommand":""}}' | Set-Content -Encoding ascii $skipWebConfig
  $tauriArgs += @('--config', $skipWebConfig)
}

$variant = if ($Release) { 'Release' } else { 'Debug' }
$soPath = Join-Path $repo "src-tauri\target\aarch64-linux-android\$($variant.ToLower())\libpdfcraft_lib.so"
$tauriLog = Join-Path $env:TEMP 'pdfcraft-android-build.log'

# Native tools write progress to stderr, which must not abort the script
$ErrorActionPreference = 'Continue'
& node @tauriArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $tauriLog
$tauriExit = $LASTEXITCODE

if ($tauriExit -ne 0) {
  # Without Windows Developer Mode the CLI compiles the library, then fails to symlink it into
  # the Android project. Copy it there instead and run Gradle without the Rust build task.
  if (-not (Select-String -Path $tauriLog -Pattern 'symbolic link' -Quiet) -or -not (Test-Path $soPath)) {
    throw "tauri android build failed ($tauriExit)"
  }
  Write-Host "`nSymlink step failed (Developer Mode is off) - copying the library and packaging with Gradle."
  $jniDir = Join-Path $repo 'src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a'
  New-Item -ItemType Directory -Force $jniDir | Out-Null
  Copy-Item $soPath (Join-Path $jniDir 'libpdfcraft_lib.so') -Force

  Push-Location (Join-Path $repo 'src-tauri\gen\android')
  try {
    & .\gradlew.bat "assembleArm64$variant" -x "rustBuildArm64$variant" --console=plain
    if ($LASTEXITCODE -ne 0) { throw "gradle build failed ($LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}
$ErrorActionPreference = 'Stop'

$apkRoot = Join-Path $repo 'src-tauri\gen\android\app\build\outputs\apk'
Get-ChildItem $apkRoot -Recurse -Filter *.apk | Sort-Object LastWriteTime -Descending |
  Select-Object FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
