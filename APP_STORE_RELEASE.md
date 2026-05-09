# Azan Times — App Store Submission

## App Store Connect — version 1.2.0

| Field | Value |
|-------|-------|
| App name | Azan Times |
| Subtitle | Prayer Times, Qibla & Dhikr |
| Bundle ID | `com.raychowdhury.azantimes` |
| SKU | `azan-times-ios` |
| Primary language | English (US) |
| Localizations | English, Arabic |
| Primary category | Lifestyle |
| Secondary category | Reference |
| Age rating | 4+ |
| Marketing version | `1.2.0` |
| Build number | `3` |
| Copyright | `© 2026 Rayhan Chowdhury` |
| Routing app coverage file | None |
| Encryption (ITSAppUsesNonExemptEncryption) | `false` (HTTPS only) |

## Description (4000 char max)

Azan Times is a calm, beautifully designed Islamic prayer times app for iPhone. Get accurate prayer times for any city worldwide, follow the Qibla compass to Makkah, count your dhikr on a tactile counter, and stay on rhythm with gentle reminders before each prayer.

KEY FEATURES

- **Daily prayer times** — Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha calculated locally on your device using the trusted Adhan algorithm.
- **Sky that follows the day** — the entire app background shifts gently from Fajr's pre-dawn indigo through Dhuhr's bright blue to Maghrib's sunset and Isha's deep night.
- **Smart city search** — type any city, see live suggestions, or tap "Use my location" for instant local times.
- **Weekly schedule** — see the next 7 days at a glance with a tap-friendly day strip.
- **Qibla compass** — point your phone toward Makkah with a clear gold needle and live bearing.
- **Hijri calendar** — full lunar month with today's date highlighted and holy day callouts.
- **Tasbih counter** — large tap target, multiple dhikr presets (SubhanAllah, Alhamdulillah, Allahu Akbar, La ilaha illa Allah, Astaghfirullah, Salawat) with progress ring.
- **Adhan & reminders** — choose a bundled adhan chime when the app is open; local notifications fire at prayer time even when the app is closed (per-prayer toggles, customizable pre-reminder).
- **Calculation methods** — Muslim World League, ISNA, Egyptian, Umm al-Qura, Karachi, Tehran, Dubai, Kuwait, Qatar, Singapore, Diyanet (Turkey), Moonsighting Committee.
- **Madhab toggle** — Standard or Hanafi for Asr calculation.
- **Light & dark themes** plus 12-hour / 24-hour time formats.
- **English + Arabic interface** — equal-prominence Arabic typography throughout.
- **Privacy first** — no account, no tracking, no ads. Location is used on-device only and never leaves your phone.

Built by a Muslim developer for the community. Ad-free and free forever.

## Promotional Text (170 char max)

Daily prayer times, weekly schedule, Qibla compass, Tasbih counter, and gentle reminders. Beautiful sky-of-day background. Private. No account. No ads.

## Subtitle (30 char)

Prayer Times, Qibla & Dhikr

## Keywords (100 char, comma-separated, no spaces)

azan,prayer,salah,salat,qibla,fajr,maghrib,muslim,islamic,tasbih,dhikr,namaz,athan,hijri,iqama

## What's New in 1.2.0

A full visual redesign — calmer, more focused, more beautiful.

- New cream + deep-green + gold palette with custom monoline icons
- Sky-of-day background that shifts through Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
- Five-panel onboarding for first launch
- City search with live suggestions
- Bundled adhan chime — no third-party servers, plays offline
- New Today layout with countdown + progress to next prayer
- Cleaner Weekly, Hijri, Tasbih, and Qibla screens
- Faster cold start
- App icon and launch screen redesigned

## Review Notes (Apple App Review)

**No account is required.** Open the app, complete the brief 5-step onboarding (Begin → Use my location or Enter manually → Allow notifications or Maybe later → pick a calculation method → Open Azan), and the Today screen loads.

**Permissions used:**
- Location (When In Use): used on-device to calculate accurate prayer times and Qibla bearing. We never transmit or store the user's location off-device.
- Local Notifications: used to remind the user of upcoming prayers. Scheduled locally on iOS — no remote push.

**Test cities (no location required):** "New York", "London", "Makkah", "Istanbul", "Cairo".

**Adhan audio behaviour:** the app ships with a bundled chime (no streaming dependency). Audio plays only while the app is in the foreground. Local notifications fire at prayer time even when the app is closed. Settings copy is explicit about this.

**Background modes:** `audio` is enabled in Info.plist so the bundled chime can finish playing if the user backgrounds the app while it's mid-playback.

**Third-party APIs (read-only, no credentials):**
- Aladhan API (`api.aladhan.com`) — fallback prayer times when on-device calculation isn't possible. Times are also computed locally via the Adhan library.
- OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) — typeahead suggestions for city search.

## App Privacy Answers

| Question | Answer |
|----------|--------|
| Does the app collect data? | **No data collected from the device** |
| Tracking | None |
| Third-party advertising | None |
| Analytics | None |
| Account creation | None |
| Contact info collected | None |
| Diagnostics | None |
| Precise location used | Yes — on-device only, used to compute prayer times + Qibla; never transmitted off-device |
| Data linked to user | None |
| Data shared with third parties | None |

## URLs

- Privacy Policy: `https://azan-times.app/privacy.html` (also bundled in `public/privacy.html`)
- Support URL: `https://azan-times.app/support.html` (also bundled in `public/support.html`)
- Marketing URL: optional

## Screenshots Required

iPhone 6.7" (1290×2796 — iPhone 17 Pro Max): **3–10 screenshots**
iPhone 6.5" (1284×2778 — older Pro Max): can reuse 6.7" set
iPhone 5.5" (1242×2208 — legacy): no longer required for iOS 17+ submissions

Suggested set (5 shots, in this order):

1. **Today** with sky-of-day backdrop, "UP NEXT Asr" countdown, prayer list — light mode
2. **Today** dark mode for contrast
3. **Onboarding** panel 1 (Welcome to Azan) or panel 4 (Calculation method picker)
4. **Weekly schedule** with day strip + table
5. **Qibla compass** with gold needle pointing toward Makkah
6. (optional) **Hijri calendar** with today highlighted
7. (optional) **Tasbih counter** mid-count

Captions (optional, displayed under each shot):
- "Track every prayer through the day"
- "Designed for any time, any city"
- "Begin in seconds with the guided setup"
- "Plan your week at a glance"
- "Find Makkah with a clear Qibla compass"

## Build & Submit

```bash
# Web bundle + Capacitor sync without PWA SW
npm run ios:sync

# Open Xcode
npx cap open ios
```

In Xcode:

1. Select scheme **App** → destination **Any iOS Device (arm64)**.
2. Signing & Capabilities → Team = your Apple Developer Team. Automatic signing.
3. Verify Marketing Version `1.2.0`, Build `3`. Bump build before each upload.
4. **Product → Archive**.
5. Organizer → **Distribute App → App Store Connect → Upload**.
6. Wait for processing (~10–30 min). The build appears in App Store Connect under TestFlight + this version's Build dropdown.
7. App Store Connect → fill in What's New, screenshots, review notes (above), then **Submit for Review**.

## Pre-flight Checklist

- [x] `arm64` only in `UIRequiredDeviceCapabilities`
- [x] `UIBackgroundModes = audio` for bundled adhan chime
- [x] `NSLocationWhenInUseUsageDescription` set
- [x] `NSMotionUsageDescription` set (Qibla compass)
- [x] `ITSAppUsesNonExemptEncryption = false`
- [x] No emoji in user-facing copy
- [x] No third-party streaming audio dependencies
- [x] App icon: single 1024×1024 PNG (Xcode auto-derives sizes)
- [x] Launch screen storyboard renders sky-tinted splash
- [x] Onboarding handles denied location + denied notifications gracefully
- [x] Settings deep-link hint present when permissions previously denied
- [x] Service worker disabled for native build (`CAPACITOR_BUILD=1`)
- [ ] Final QA pass on physical device — onboarding, prayer notifications fire at scheduled time, Qibla compass tracks heading, Tasbih persists count
- [ ] Bump `CURRENT_PROJECT_VERSION` if re-uploading
