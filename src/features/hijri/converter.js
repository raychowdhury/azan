import moment from 'moment-hijri';

export const HIJRI_MONTHS = [
  ['Muharram', 'محرم'],
  ['Safar', 'صفر'],
  ['Rabi al-Awwal', 'ربيع الأول'],
  ['Rabi al-Thani', 'ربيع الثاني'],
  ['Jumada al-Awwal', 'جمادى الأولى'],
  ['Jumada al-Thani', 'جمادى الثانية'],
  ['Rajab', 'رجب'],
  ['Shaban', 'شعبان'],
  ['Ramadan', 'رمضان'],
  ['Shawwal', 'شوال'],
  ['Dhu al-Qadah', 'ذو القعدة'],
  ['Dhu al-Hijjah', 'ذو الحجة'],
];

export function toHijri(gregorianDate, offsetDays = 0) {
  const m = moment(gregorianDate).add(offsetDays, 'days');
  const month = m.iMonth() + 1;
  const [monthNameEn, monthNameAr] = HIJRI_MONTHS[month - 1];
  return {
    year: m.iYear(),
    month,
    day: m.iDate(),
    monthNameEn,
    monthNameAr,
  };
}

export function fromHijri(year, month, day) {
  return moment(`${year}-${month}-${day}`, 'iYYYY-iM-iD').toDate();
}
