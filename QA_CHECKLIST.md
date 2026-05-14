# Azan v1.2.0 Device QA Checklist

v1.2.0 is release-blocked until every P0 item below has pass/fail evidence. Any Fajr notification failure is a release blocker.

## Test Matrix

| Device | OS | Tester | Build | Dates | Result | Evidence |
|---|---|---|---|---|---|---|
| iPhone 12 | iOS 17/18 |  |  |  |  |  |
| iPhone 14 or 15 | iOS 17/18 |  |  |  |  |  |
| Android reference device | Android 13/14/15 |  |  |  |  |  |
| Samsung A-series or mid-range | Android 13/14/15 |  |  |  |  |  |

## P0 Checks

### Fajr Notification Reliability

Run for 7 consecutive nights on each iPhone test device.

| Night | Device | Expected Fajr | Reminder Offset | Fired? | Sound/Vibration? | Notes / Screenshot / Logs |
|---|---|---:|---:|---|---|---|
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |

Release rule: any missed Fajr reminder or prayer-time notification must be fixed or explicitly explained before release.

### GPS / Location

| Scenario | Device | Expected | Result | Evidence |
|---|---|---|---|---|
| First-run permission accepted |  | Prayer times load and location label resolves |  |  |
| First-run permission denied |  | Manual city search fallback is clear |  |  |
| Location unavailable/timeout |  | Error explains manual city search fallback |  |  |
| Travel/background refresh spot check |  | Times refresh after new location search |  |  |

### Qibla Compass

| Scenario | Device | Expected | Result | Evidence |
|---|---|---|---|---|
| Outdoor compass reading |  | Bearing is plausible against reference app/compass |  |  |
| Indoor compass reading |  | App remains usable and notes alignment guidance |  |  |
| Orientation permission denied |  | Manual north-alignment guidance remains visible |  |  |
| iPhone vs Android comparison |  | Bearing variance is documented |  |  |

### Adhan Audio Playback

| Scenario | Device | Expected | Result | Evidence |
|---|---|---|---|---|
| Preview bundled beep |  | Plays immediately |  |  |
| Preview streaming Adhan |  | Plays or reports failure to monitoring |  |  |
| iOS silent mode |  | Behavior documented; no crash |  |  |
| App foreground at prayer time |  | Configured audio plays |  |  |
| App background/closed at prayer time |  | Local notification sound only; full Adhan limitation documented |  |  |
| Call/audio interruption mid-Adhan |  | App recovers without crash |  |  |

### Notification Test Button

| Platform | OS | Expected | Result | Evidence |
|---|---|---|---|---|
| iOS | 17/18 | Test notification fires within a few seconds |  |  |
| Android | 13/14/15 | Test notification fires within a few seconds |  |  |
| Browser | Current Safari/Chrome | Browser notification fires when permission granted |  |  |

## Release Exit Criteria

- All P0 rows have pass/fail evidence.
- Crash-free session rate is at least 99.5% for the 7-day soak.
- Arabic UI coverage passes `npm run check:i18n`.
- `npm run ci` passes.
- `PRIVACY_POLICY.md`, `public/privacy.html`, and `APP_STORE_RELEASE.md` describe the same data use.
