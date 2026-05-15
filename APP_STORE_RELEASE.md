# Azan Times App Store Release

## App Store Connect

- App name: Azan Times
- Bundle ID: `com.raychowdhury.azantimes`
- SKU: `azan-times-ios`
- Primary language: English
- Category: Lifestyle
- Age rating: 4+
- Version: `1.3.1`
- Build: `3`

## Description

Azan Times provides daily Islamic prayer times, weekly schedules, Qibla direction, a Hijri calendar, a tasbih counter, and a nearby-mosques finder — in a private, ad-free experience.

Search by city or use your current location to calculate local prayer times for Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha. Optional pre-prayer reminders. Full Adhan audio is bundled and plays locally — no third-party CDN. Find nearby mosques using OpenStreetMap, save your home mosque, and view community-verified iqamah times when available.

No accounts. No ads. No tracking. No analytics. Your data stays on your device.

## Subtitle

Private. Adhan. Nearby Mosques.

## Keywords

mosque,masjid,iqamah,jumuah,salah,namaz,adhan,athan,qibla,prayer,quran,muslim,islam,ramadan,hijri

## Promotional Text

Find nearby mosques, get accurate prayer times worldwide, hear the Adhan — all without ads, tracking, or accounts.

## What's New (1.3.1)

v1.3.1 — Sky of day + smarter defaults
- Background now tracks the sun through your location's prayer periods — dawn, sunrise, noon, afternoon, sunset, night
- Prayer times now auto-pick the right calculation method for your country on first locate (ISNA for North America, Umm al-Qura for Saudi, Karachi for South Asia, Egyptian for MENA, Diyanet for Turkey, Singapore method for SE Asia, etc.)
- First-run welcome screen now has Search and Use my location buttons so you can get started right away
- Stars on Fajr and Isha skies for a calmer night view

## What's New (1.3.0)

v1.3 — Nearby Mosques
- Find mosques near you, see distance, get directions
- Save your home mosque, view iqamah and Jumu'ah times
- Full Adhan now bundled (public-domain recordings, plays offline)
- Hijri calendar moved to a quick tap on the date
- Faster search, smarter caching, refined iOS layout
- Still zero tracking, zero ads — your data stays on your device

## Review Notes

No account is required. To test location-based prayer times, grant location permission and tap the location icon in the top right. Search also works with city names such as "New York", "London", or "Makkah".

## App Privacy Answers

- Data collection: The app uses location for prayer times, approximate place name, distance to Makkah, Qibla direction, and to discover nearby mosques.
- Tracking: No.
- Third-party advertising: No.
- Account creation: No.
- Contact info collection: No, except optional contact field on a public mosque submission form (only sent if user types it).
- Diagnostics collection: Privacy-limited crash and reliability diagnostics may be used to troubleshoot app failures, notification scheduling, location permission, Qibla orientation, and audio playback failures.
- Precise location: Used only when the user taps the location button or opens the Nearby Mosques tab, and grants permission.
- Third-party services:
  - Aladhan API for prayer times (city or coordinates).
  - Nominatim (OpenStreetMap) for city autocomplete suggestions.
  - OpenStreetMap Overpass API for nearby mosque discovery (coordinates + radius only).
  - All Adhan audio is bundled with the app and plays locally — no third-party audio CDN.

## Screenshot Checklist (1.3 update)

iPhone 6.7" / 6.9" set (required). Take in light + dark if you want both:

1. **Today** tab with countdown hero, Hijri chip, full prayer list.
2. **Nearby Mosques** with at least 3 result cards (Directions / Open in Maps visible).
3. **Qibla compass** with needle pointing.
4. **Weekly** schedule view.
5. **Settings** showing Azan Audio toggle + Doha reciter chosen.

Tip: highlight the new Mosques feature in screenshot #2 — that's the differentiator for 1.3.

iPad screenshots optional but earn featuring eligibility.

## Local Release Commands

```bash
npm run ios:sync
npx cap open ios
```

In Xcode:

1. Select the `App` target.
2. Set your Apple Developer Team under Signing & Capabilities.
3. Select `Any iOS Device`.
4. Product > Archive.
5. Distribute App > App Store Connect > Upload.
