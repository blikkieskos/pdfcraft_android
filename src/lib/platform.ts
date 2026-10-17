/**
 * True when building the Android app (NEXT_PUBLIC_PLATFORM=android, set by
 * scripts/build-android-web.mjs). Inlined at build time, so web builds drop app-only code.
 */
export const IS_ANDROID_APP = process.env.NEXT_PUBLIC_PLATFORM === 'android';
