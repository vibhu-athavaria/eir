# Building the mobile apps (iOS & Android)

Eir is wrapped for native mobile via [Capacitor](https://capacitorjs.com) — the same React/Vite web app in this repo, running inside a native WebView shell, with native platform APIs (like the system browser for OAuth) available where the code uses them. The `ios/` and `android/` native project folders are already generated and committed in this repo — you're building an existing project, not starting Capacitor from scratch.

**Read "Known limitations" at the bottom before you ship anything** — a few features (OAuth's native return trip, background reminder notifications) are not finished, and this section says exactly what's missing.

## Prerequisites

| Need | For | Get it from |
|---|---|---|
| Node.js 18+ and npm | Building the web app that gets wrapped | Already required for the rest of this repo |
| **Xcode** (full app, not just Command Line Tools) | iOS builds, Simulator | Mac App Store |
| Apple ID | Running Xcode, iOS code signing | — |
| **Android Studio** | Android builds, emulator, SDK | https://developer.android.com/studio |

CocoaPods is **not** needed — this project's iOS platform uses Swift Package Manager for Capacitor's plugin dependencies (Capacitor 8 default), not CocoaPods.

You do not need a paid Apple Developer or Google Play account to build and run on a Simulator/emulator or your own physical device via Xcode/Android Studio. You do need one to distribute via TestFlight or the Play Store — see "Signing and store submission" below.

## The workflow

Every time you change the app's web code (anything in `src/`) and want to see it on iOS/Android, rebuild and re-sync before opening the native IDE:

```bash
npm run cap:sync    # runs `vite build`, then copies dist/ into ios/ and android/, and syncs plugin config
```

Then open whichever platform you're working on:

```bash
npm run cap:open:ios      # opens ios/App/App.xcodeproj in Xcode
npm run cap:open:android  # opens android/ in Android Studio
```

## Building for iOS

1. `npm run cap:sync`
2. `npm run cap:open:ios` — this opens Xcode.
3. In Xcode, pick a Simulator (or a connected device) from the scheme/device dropdown at the top, then press ▶ (Run). First build will take a while as Xcode resolves the Swift Package dependencies.
4. To run on a **physical device**: connect it, select it as the target, and you'll need to set up code signing — select the `App` target → Signing & Capabilities → choose your Apple ID team. Xcode will prompt you through free "Personal Team" signing for local testing (no paid account needed for this).
5. To produce a build for **TestFlight/App Store**: Product → Archive, then follow Xcode's distribution flow. This requires a paid Apple Developer Program membership (see below).

## Building for Android

1. `npm run cap:sync`
2. `npm run cap:open:android` — this opens Android Studio. First open will take a while as Gradle syncs.
3. Pick an emulator (Android Studio's Device Manager can create one) or a connected device (enable USB debugging in the device's Developer Options), then press ▶ (Run).
4. To produce a **signed release build** (APK or AAB) for the Play Store: Build → Generate Signed Bundle/APK, which will walk you through creating a signing keystore the first time (`keytool -genkey ...` under the hood — Android Studio's UI does this for you). **Keep that keystore file and its password safe and backed up outside this repo** — losing it means you can never update the app under the same listing again.

## Updating the app id / name

`capacitor.config.ts` has `appId` (`com.eirselfhelp.app`, reverse-DNS, part of both stores' bundle identifier) and `appName` ("Eir"). Change either here, then run `npm run cap:sync` — do this **before** you first submit to either store; changing the app id after publishing effectively means shipping as a new, separate app listing.

## Known limitations — not finished, needs a real device to complete

None of the native code changes below have been built, run, or tested — no full Xcode, no Android Studio/SDK, no simulator or device were available in the environment that scaffolded this. Nothing here has been verified on-device.

### 1. OAuth's native return trip

`src/pages/Login.jsx` opens the system browser (via `@capacitor/browser`) for Google/Apple sign-in on native — this part works and is necessary, since both providers block OAuth inside an embedded WebView. What's **not** implemented: after the user approves in the system browser, it needs to redirect back into the app via a custom URL scheme or universal/app link, and the app needs to catch that and turn it into a Supabase session. To finish this:

- Register a custom URL scheme (e.g. `eir://`) in `ios/App/App/Info.plist` (`CFBundleURLTypes`) and `android/app/src/main/AndroidManifest.xml` (an `<intent-filter>` on the main activity).
- Use `@capacitor/app`'s `App.addListener('appUrlOpen', ...)` (`src/lib/AuthContext.jsx` is the natural place) to catch the callback URL and call the appropriate `supabase.auth` method to exchange it for a session — see Supabase's [Capacitor/React Native OAuth guide](https://supabase.com/docs/guides/auth/quickstarts/react-native) for the exact pattern (deep-linking works the same way across Capacitor and React Native).
- Add that custom scheme's redirect URL to Supabase's **Authentication → URL Configuration** allow-list.
- Update `Login.jsx`'s native `redirectTo` (currently `${window.location.origin}/`, a placeholder) to the real custom-scheme URL once one is registered.

### 2. Password reset on native

The emailed reset link points at a normal web URL (`https://yourdomain.com/reset-password`) — on a phone, tapping it opens the device's browser, which works (it's a normal web page), just doesn't feel like it's "in the app." Making it open the native app directly needs the same deep-link infrastructure as #1 above (or, more robustly, [Universal Links](https://developer.apple.com/ios/universal-links/)/[App Links](https://developer.android.com/training/app-links) instead of a custom scheme, which avoid a scary "open in Eir?" prompt but need a file hosted on your real domain). Not started.

### 3. Daily reminder notifications

`src/hooks/useDailyReminder.js` currently uses the browser's `Notification` API, checked every 30 seconds while the app tab is open. **This does not work as a background reminder on native** — a real notification needs [`@capacitor/local-notifications`](https://capacitorjs.com/docs/apis/local-notifications) (schedule a notification for the chosen time, independent of whether the app is open) instead. Not installed, not rewired — this is a real feature gap on mobile, not just a "needs testing" item.

### 4. App icons and splash screen

Capacitor ships a placeholder icon/splash screen in the generated `ios/`/`android/` projects. Use [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) (`npx @capacitor/assets generate`) against a source icon/splash image to replace them before shipping — not done here (no source artwork exists yet in this repo beyond `public/favicon.svg`).

### 5. Signing and store submission

- **iOS**: needs an Apple Developer Program membership ($99/yr) to create the signing certificate and provisioning profile Xcode needs for anything beyond Simulator/personal-device builds, and eventually to submit to TestFlight/App Store.
- **Android**: needs the signing keystore described above for release builds, and a Google Play Developer account ($25 one-time) to publish.

Neither is set up — this is entirely manual, account-holder-specific work only you can do.

## Also see

- [README.md](README.md) — project overview, web stack, local dev setup.
- [docs/qa-checklist.md](docs/qa-checklist.md) — manual QA pass, includes items specific to a shared/mobile device.
