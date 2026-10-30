# CI workflows

Everything in `.github/workflows/`. All run on GitHub Actions; the ones
marked *plus* run on every push to the `plus` branch (a newer push cancels
the run in progress) and can also be started by hand from the Actions tab.

| Workflow | Runs on | What it does | Output |
| --- | --- | --- | --- |
| `ci.yml` — CI | every push | Typecheck and lint | Pass / fail |
| `android-apk.yml` — Android test APK | *plus* · Linux | Release APK (arm64) for phones | Pre-release `android-test-plus`: https://github.com/jguars/payhas-app/releases/download/android-test-plus/payhas-plus-test.apk |
| `android-emulator.yml` — Android emulator screens | *plus* · Linux + KVM | x86_64 build on a Pixel 6 emulator; Maestro walks `.maestro/screens.yaml` as the CI test family | Artifact `emulator-screens`, and the `ci-screens` branch |
| `ios-simulator.yml` — iOS simulator screens | *plus* · macOS 26 | Unsigned simulator build; the same Maestro flow on iPhone SE (3rd gen), iPhone 17 and iPhone 17 Pro Max | Artifact `ios-screens`, and the `ci-screens-ios` branch (one folder per phone, with Maestro logs) |
| `ios-testflight.yml` — iOS TestFlight | *plus* · macOS 26 | Signed build (automatic signing, team M4V4D8KSX3), uploaded to TestFlight; build number = run number | A new build in TestFlight |

## Secrets

| Secret | Used by | Notes |
| --- | --- | --- |
| `PAYHAS_TEST_PASSWORD` | emulator and simulator screens | The CI test family `payhas-audit@example.com` (throwaway). Without it, the Android job skips and the iOS job only screenshots the first screen. |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` | TestFlight | App Store Connect API key (App Manager role). Without all three the job skips. The app record `com.onki.payhas` must exist in App Store Connect. |

Secrets go in GitHub → Settings → Secrets and variables → Actions — never in chat or in the repo.

## Reading screenshots from a cloud session

Artifact storage can be blocked, so screenshots are also pushed to branches:

```bash
git fetch origin ci-screens ci-screens-ios
```

```bash
git archive origin/ci-screens-ios | tar -x -C /tmp/ios-screens
```

## Cost

macOS minutes count 10× against the Actions quota on private repositories;
an iOS simulator run is about 50 minutes and a TestFlight run about 35. If the
quota runs short, switch the two iOS workflows to `workflow_dispatch` only.

## Tests that tap the UI

`.maestro/screens.yaml` taps by `testID` where text differs between
platforms: `sign-in-submit`, `who-dashboard`, `header-back`, `tab-<name>`.
Keep those IDs when changing those screens. iOS has no system back button, so
the flow uses the header's back.
