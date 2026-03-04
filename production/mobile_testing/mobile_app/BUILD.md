# Distribution builds – Android & iOS

## Option A: EAS Build (recommended for both platforms)

Build in the cloud. No need for Android SDK or Xcode on your machine. iOS builds work without a Mac.

### 1. Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```

### 2. Link the project (first time only)

```bash
eas build:configure
```

This sets your Expo project ID. If you already have a project at [expo.dev](https://expo.dev), use that; otherwise a new project is created.

### 3. Run production builds

- **Both platforms (AAB + IPA):**
  ```bash
  eas build --platform all --profile production
  ```

- **Android only (Play Store .aab):**
  ```bash
  eas build --platform android --profile production
  ```

- **iOS only (TestFlight / App Store):**
  ```bash
  eas build --platform ios --profile production
  ```

### 4. Preview / testing builds

- **APK (Android, for testing):**
  ```bash
  eas build --platform android --profile preview
  ```

- **iOS Simulator build:**
  ```bash
  eas build --platform ios --profile preview
  ```

Builds appear in [expo.dev](https://expo.dev) under your project → Builds. Download the artifact from there.

---

## Option B: Local Android build

You can build the Android app locally if you have the Android SDK and a JDK installed.

### Release APK (installable on devices)

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

**Note:** The current config uses the **debug keystore** for release. That’s fine for testing. For Play Store you must use a **release keystore**. Then in `android/app/build.gradle` set `signingConfigs.release` and use it in `buildTypes.release` (see [Android signing docs](https://reactnative.dev/docs/signed-apk-android)).

### Release AAB (for Google Play)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Option C: Local iOS build (Mac only)

There is no `ios` folder yet. Generate it, then build in Xcode:

```bash
npx expo prebuild --platform ios
open ios/mobile_app.xcworkspace
```

In Xcode: choose a real device or “Any iOS Device”, then **Product → Archive**. Then use **Distribute App** for TestFlight or App Store.

For distribution you need an Apple Developer account and proper signing (development team + provisioning profile).

---

## Build profiles (`eas.json`)

| Profile      | Use case                    | Android      | iOS              |
|-------------|-----------------------------|-------------|------------------|
| `production`| Store distribution          | AAB         | IPA (device)     |
| `preview`   | Internal/testing            | APK         | Simulator build  |
| `development` | Dev client with Expo Go   | Dev client  | Dev client       |

---

## Optional: npm scripts

Add these to `package.json` under `"scripts"` if you want one-command builds:

```json
"build:android:release": "cd android && ./gradlew assembleRelease",
"build:android:bundle": "cd android && ./gradlew bundleRelease",
"build:eas:all": "eas build --platform all --profile production",
"build:eas:android": "eas build --platform android --profile production",
"build:eas:ios": "eas build --platform ios --profile production",
"build:eas:preview": "eas build --platform all --profile preview"
```

Then run for example: `npm run build:eas:all` or `npm run build:android:release`.
