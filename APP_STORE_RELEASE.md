# Azan Times App Store Release

## App Store Connect

- App name: Azan Times
- Bundle ID: `com.raychowdhury.azantimes`
- SKU: `azan-times-ios`
- Primary language: English
- Category: Lifestyle
- Age rating: 4+
- Version: `1.2.0`
- Build: `2`

## Description

Azan Times provides daily Islamic prayer times, weekly schedules, and Qibla direction in a focused mobile experience.

Search by city or use your current location to calculate local prayer times. The app includes Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, weekly prayer schedules, optional prayer reminders, and a Qibla compass.

## Keywords

azan, prayer times, salah, salat, qibla, islamic, muslim, fajr, maghrib, mosque

## Promotional Text

Daily prayer times, weekly schedules, reminders, and Qibla direction for your location.

## What's New

v1.2.0 stabilization release: notification reliability hardening, Arabic coverage improvements, privacy copy alignment, and quality gates.

## Review Notes

No account is required. To test location-based prayer times, grant location permission and tap the location icon in the top right. Search also works with city names such as "New York", "London", or "Makkah".

## App Privacy Answers

- Data collection: The app uses location for prayer times, approximate place name, distance to Makkah, and Qibla direction.
- Tracking: No.
- Third-party advertising: No.
- Account creation: No.
- Contact info collection: No.
- Diagnostics collection: Privacy-limited crash and reliability diagnostics may be used to troubleshoot app failures, notification scheduling, location permission, Qibla orientation, and audio playback failures.
- Precise location: Used only when the user taps the location button and grants permission.
- Third-party services: Prayer time requests may use Aladhan API. Optional streaming Adhan playback may use islamcan.com when a streaming source is selected. Bundled beep/silent options do not stream Adhan audio.

## Screenshot Checklist

For the first release, provide iPhone screenshots:

- Home with New York prayer times loaded.
- Search panel open.
- Weekly schedule.
- Qibla compass.
- Settings panel.

Apple currently accepts a single required iPhone screenshot set for newer device sizes, but create at least 3-5 screenshots for a better listing.

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
