import React from 'react';

const Ic = ({ size = 24, stroke = 1.5, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block' }}
  >
    {children}
  </svg>
);

export const IconFajr = (p) => (
  <Ic {...p}>
    <path d="M16.5 8.5a4.5 4.5 0 1 1-5-5 5 5 0 0 0 5 5Z" />
    <path d="M3 19h18" opacity="0.5" />
    <path d="M6 16h2M16 16h2" opacity="0.4" />
  </Ic>
);

export const IconSunrise = (p) => (
  <Ic {...p}>
    <path d="M3 18h18" />
    <path d="M6 14a6 6 0 0 1 12 0" />
    <path d="M12 3v3M4.5 7.5l1.5 1.5M19.5 7.5 18 9" />
    <path d="M2 21h20" opacity="0.5" />
  </Ic>
);

export const IconDhuhr = (p) => (
  <Ic {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </Ic>
);

export const IconAsr = (p) => (
  <Ic {...p}>
    <circle cx="9" cy="11" r="3.5" />
    <path d="M9 4v1.5M9 16.5V18M2.5 11H4M14 11h1.5M4.4 6.4 5.5 7.5M12.5 14.5l1.1 1.1M4.4 15.6 5.5 14.5M12.5 7.5l1.1-1.1" />
    <path d="M14 16h5a2.5 2.5 0 0 0 0-5 3.5 3.5 0 0 0-6.7-1" />
  </Ic>
);

export const IconMaghrib = (p) => (
  <Ic {...p}>
    <path d="M3 18h18" />
    <path d="M6 14a6 6 0 0 1 12 0" />
    <path d="M12 21v-3M9 21l3-3 3 3" opacity="0.6" />
    <path d="M2 21h20" opacity="0.5" />
  </Ic>
);

export const IconIsha = (p) => (
  <Ic {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    <path d="M17 5l.6 1.4L19 7l-1.4.6L17 9l-.6-1.4L15 7l1.4-.6Z" opacity="0.6" />
  </Ic>
);

const MAP = {
  fajr: IconFajr,
  sunrise: IconSunrise,
  dhuhr: IconDhuhr,
  asr: IconAsr,
  maghrib: IconMaghrib,
  isha: IconIsha,
};

export default function PrayerIcon({ name, size = 22, stroke = 1.6 }) {
  const key = String(name || '').toLowerCase();
  const Cmp = MAP[key] || IconDhuhr;
  return <Cmp size={size} stroke={stroke} />;
}
