# 🕌 Azan Times

> Accurate Islamic prayer schedules for any city worldwide — built with React + Vite.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## ✨ Features

### 🕐 Prayer Times
- Today's prayer times for **any city worldwide**
- **Countdown hero** at the top — shows time remaining to next prayer in HH · MM · SS digit blocks
- Highlights the **current** (teal) and **next** (gold) prayer
- **Prayer progress bar** showing how far through the current salah interval you are
- Sunrise & Sunset display

### 📅 Weekly Schedule
- 7-day prayer schedule starting from today
- Tap any day to expand its full timetable
- Gregorian + Hijri dates shown for each day

### 🧭 Qibla Compass
- Calculates the **exact bearing to Makkah** from your coordinates
- Interactive compass rose with animated needle pointing to the Kaaba 🕋
- **Device orientation** support — compass rotates live on mobile
- Shows distance to Makkah in km

### 📿 Tasbih Counter
- Digital dhikr counter for **SubhanAllah · Alhamdulillah · Allahu Akbar**
- Circular SVG progress ring per phrase (33 / 33 / 34 = 100 cycle)
- Auto-advances to the next dhikr on completion
- Haptic feedback on mobile · cycle + grand total counters

### 🔊 Azan Audio
- Plays the **Azan at prayer time** via the Islamic Network CDN
- Reciter: Mishary Rashid Al-Afasy

### 🔔 Notifications
- **Browser push notifications** before prayer time
- Configurable lead time: 5 / 10 / 15 / 20 / 30 minutes before

### ⚙️ Settings
| Setting | Options |
|---|---|
| Theme | 🌙 Dark · ☀️ Light |
| Time format | 12-hour · 24-hour |
| Azan audio | On / Off |
| Notifications | On / Off + lead time |
| Calculation method | 15 Islamic methods |

### 🌐 Calculation Methods Supported
Muslim World League · ISNA · Karachi · Umm Al-Qura (Makkah) · Egyptian General Authority · Tehran · Gulf Region · Kuwait · Qatar · Singapore · UOIF France · DIANET Turkey · Russia · Moonsighting Committee Worldwide

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/raychowdhury/azan.git
cd azan
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

### Build the iOS App

This project uses Capacitor to package the Vite app as a native iOS app.

```bash
npm run ios:sync
npm run ios:open
```

In Xcode, choose a simulator or connected iPhone, set your signing team, then run the `App` target.

If the `ios/` folder is missing in a fresh clone, run:

```bash
npm run ios:add
```

---

## 🗂️ Project Structure

```
azan/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                  # React entry point
    ├── App.jsx                   # Main component + all state
    ├── App.css                   # Islamic-themed CSS (dark + light)
    ├── components/
    │   ├── QiblaCompass.jsx      # Qibla direction compass
    │   ├── WeeklyView.jsx        # 7-day schedule
    │   └── TasbihCounter.jsx     # Dhikr counter
    └── utils/
        ├── prayers.js            # Prayer utilities & calculations
        └── api.js                # Aladhan API calls
```

---

## 🔌 APIs Used

| API | Purpose |
|---|---|
| [Aladhan API](https://aladhan.com/prayer-times-api) | Prayer times by city or coordinates, weekly calendar |
| [Islamic Network CDN](https://islamic.network) | Azan audio (MP3) |
| Browser Geolocation API | Auto-detect user location |
| Web Notifications API | Prayer time alerts |
| Device Orientation API | Live Qibla compass on mobile |

---

## 🎨 Design

- **Islamic geometric background** — subtle repeating 8-pointed star lattice
- **Color palette** — deep navy `#06101e` · gold `#c9973a` · teal `#1a9090` · warm cream text
- **Typography** — Amiri (Arabic serif) + DM Sans
- **Glass morphism** cards with `backdrop-filter` blur
- Fully **responsive** — works on mobile and desktop
- Smooth **dark ↔ light** theme transition

---

## 📱 Mobile

- Touch-optimised prayer cards and buttons
- Qibla compass uses **DeviceOrientationEvent** for live heading on iOS/Android
- Tasbih counter supports **haptic feedback** via Vibration API
- Responsive layout adapts to all screen sizes

---

## 🤝 Credits

- Prayer times data — [Aladhan.com](https://aladhan.com)
- Azan audio — [Islamic Network](https://islamic.network)
- Reciter — Mishary Rashid Al-Afasy

---

## 📄 License

MIT © [raychowdhury](https://github.com/raychowdhury)
