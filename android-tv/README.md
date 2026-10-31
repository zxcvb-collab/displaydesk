# DisplayDesk TV (Android TV / Fire TV)

A thin kiosk wrapper around the web player. It does not change the web app: it
loads `BASE_URL/tv` (the PIN keypad), remembers the PIN once the page navigates
to `/tv/<pin>`, and opens that screen directly on every later launch.

- Starts on boot, keeps the screen awake, Back never exits.
- **Hold Back for 5 seconds** to forget the PIN and return to the keypad.
- Retries every 10s if the network is down at launch.

## Build

Needs the Android SDK (platform 34) and JDK 17+ (Android Studio's bundled JBR works).
Create `local.properties` with `sdk.dir=<your SDK path>` (forward slashes), then:

    ./gradlew assembleRelease

Output: `app/build/outputs/apk/release/app-release.apk`. It is signed with the
debug key, which is fine for sideloading but not for a store upload.

## Sideload onto a Fire TV

1. Fire TV: Settings > My Fire TV > Developer options > turn on ADB debugging
   and Install unknown apps. Note its IP (Settings > My Fire TV > About > Network).
2. `adb connect <ip>:5555`, then `adb install -r app-release.apk`.
3. Open it from Apps. After a reboot it launches itself.

To point at a staging site, change `BASE_URL` in `app/build.gradle.kts`.
