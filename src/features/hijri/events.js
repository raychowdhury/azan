export const HIJRI_EVENTS = [
  { id: 'new-year', month: 1, day: 1, durationDays: 1, nameEn: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', icon: '🌙' },
  { id: 'ashura', month: 1, day: 10, durationDays: 1, nameEn: 'Day of Ashura', nameAr: 'يوم عاشوراء', icon: '🕌' },
  { id: 'mawlid', month: 3, day: 12, durationDays: 1, nameEn: 'Mawlid an-Nabi', nameAr: 'المولد النبوي', icon: '✦' },
  { id: 'isra-miraj', month: 7, day: 27, durationDays: 1, nameEn: "Isra and Mi'raj", nameAr: 'الإسراء والمعراج', icon: '✨' },
  { id: 'mid-shaban', month: 8, day: 15, durationDays: 1, nameEn: "Laylat al-Bara'ah", nameAr: 'ليلة البراءة', icon: '🌕' },
  { id: 'ramadan', month: 9, day: 1, durationDays: 30, nameEn: 'Ramadan', nameAr: 'رمضان', icon: '🌙' },
  { id: 'laylatul-qadr', month: 9, day: 27, durationDays: 1, nameEn: 'Laylat al-Qadr (likely)', nameAr: 'ليلة القدر', icon: '⭐' },
  { id: 'eid-fitr', month: 10, day: 1, durationDays: 3, nameEn: 'Eid al-Fitr', nameAr: 'عيد الفطر', icon: '✺' },
  { id: 'arafah', month: 12, day: 9, durationDays: 1, nameEn: 'Day of Arafah', nameAr: 'يوم عرفة', icon: '🕋' },
  { id: 'eid-adha', month: 12, day: 10, durationDays: 4, nameEn: 'Eid al-Adha', nameAr: 'عيد الأضحى', icon: '✺' },
];

export function eventForHijriDate(month, day) {
  return HIJRI_EVENTS.find(event => (
    event.month === month &&
    day >= event.day &&
    day < event.day + event.durationDays
  )) ?? null;
}
