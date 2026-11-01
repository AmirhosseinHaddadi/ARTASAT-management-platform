// =====================================================================
//  تقویم دوگانه شمسی/میلادی — همه تاریخ‌ها به صورت ISO 'YYYY-MM-DD'
// =====================================================================
import { toJalali, toGregorian, monthLength as jMonthLength, todayIso, addDaysIso, enDigits } from './jalali.js';
import { lang, n, primaryCal, secondaryCal } from './i18n.js';

export { todayIso, addDaysIso };
const pad = x => String(x).padStart(2, '0');

const NAMES = {
  jalali: {
    fa: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    en: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'],
  },
  gregorian: {
    fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};
const WD = {
  fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const WD_SHORT = {
  fa: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export const monthName = (m, cal = primaryCal()) => NAMES[cal][lang()][m - 1];
export const weekdayName = (idx, short = false) => (short ? WD_SHORT : WD)[lang()][idx];

/** روز هفته: 0=یکشنبه ... 6=شنبه */
export function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
/** اولین روز هفته: فارسی شنبه، انگلیسی دوشنبه */
export const firstDow = () => (lang() === 'fa' ? 6 : 1);
export const isWeekend = iso => (lang() === 'fa' ? weekday(iso) === 5 : [0, 6].includes(weekday(iso)));

export function parts(iso, cal = primaryCal()) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (cal === 'gregorian') return { y, m, d };
  const j = toJalali(y, m, d);
  return { y: j.jy, m: j.jm, d: j.jd };
}
export function fromParts(y, m, d, cal = primaryCal()) {
  if (cal === 'gregorian') return `${y}-${pad(m)}-${pad(d)}`;
  const g = toGregorian(y, m, d);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
export function monthLen(y, m, cal = primaryCal()) {
  if (cal === 'jalali') return jMonthLength(y, m);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function addMonths({ y, m }, k) {
  const t = y * 12 + (m - 1) + k;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function weekStart(iso) {
  const back = (weekday(iso) - firstDow() + 7) % 7;
  return addDaysIso(iso, -back);
}
export function monthStart(iso, cal = primaryCal()) {
  const p = parts(iso, cal);
  return fromParts(p.y, p.m, 1, cal);
}

/** قالب‌بندی تاریخ
 *  style: 'short' → ۱۴۰۵/۰۸/۱۰ یا 2026-11-01 ؛ 'long' → ۱۰ آبان ۱۴۰۵ ؛ 'dm' → ۱۰ آبان */
export function fmt(iso, { cal = primaryCal(), style = 'short', weekday: wd = false } = {}) {
  if (!iso) return '—';
  iso = iso.slice(0, 10);
  const p = parts(iso, cal);
  let s;
  if (style === 'short') s = cal === 'jalali' ? `${p.y}/${pad(p.m)}/${pad(p.d)}` : `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  else if (style === 'dm') s = lang() === 'fa' || cal === 'jalali' ? `${p.d} ${monthName(p.m, cal)}` : `${monthName(p.m, cal).slice(0, 3)} ${p.d}`;
  else s = lang() === 'en' && cal === 'gregorian' ? `${monthName(p.m, cal)} ${p.d}, ${p.y}` : `${p.d} ${monthName(p.m, cal)} ${p.y}`;
  if (wd) s = (lang() === 'fa' ? `${weekdayName(weekday(iso))} ` : `${weekdayName(weekday(iso)).slice(0, 3)}, `) + s;
  return n(s);
}
/** تاریخ به تقویم اصلی + تقویم دوم کوچک */
export const fmt2 = (iso, style = 'short') => (iso ? `${fmt(iso, { style })} <span class="cal2">${fmt(iso, { cal: secondaryCal(), style: 'dm' })}</span>` : '—');

/** هر دو قالب را می‌پذیرد: سال کمتر از ۱۷۰۰ → شمسی ، بیشتر → میلادی */
export function parseDate(str) {
  if (!str) return null;
  const m = enDigits(str).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const cal = y < 1700 ? 'jalali' : 'gregorian';
  if (mo < 1 || mo > 12 || d < 1 || d > monthLen(y, mo, cal)) return null;
  return fromParts(y, mo, d, cal);
}

/** خانه‌های یک ماه برای نمایش جدولی (از شروع هفته تا پایان هفته) */
export function monthGrid(y, m, cal = primaryCal()) {
  const first = fromParts(y, m, 1, cal);
  const last = fromParts(y, m, monthLen(y, m, cal), cal);
  let cur = weekStart(first);
  const weeks = [];
  while (cur <= last) {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDaysIso(cur, i));
    weeks.push(days);
    cur = addDaysIso(cur, 7);
  }
  return weeks;
}
/** عنوان ماه به تقویم اصلی و بازه متناظر در تقویم دوم */
export function monthTitle(y, m, cal = primaryCal()) {
  const first = fromParts(y, m, 1, cal), last = fromParts(y, m, monthLen(y, m, cal), cal);
  const c2 = cal === 'jalali' ? 'gregorian' : 'jalali';
  const a = parts(first, c2), b = parts(last, c2);
  const sec = a.m === b.m ? `${monthName(a.m, c2)} ${a.y}`
    : a.y === b.y ? `${monthName(a.m, c2)} – ${monthName(b.m, c2)} ${a.y}`
    : `${monthName(a.m, c2)} ${a.y} – ${monthName(b.m, c2)} ${b.y}`;
  return { main: n(`${monthName(m, cal)} ${y}`), sec: n(sec) };
}
