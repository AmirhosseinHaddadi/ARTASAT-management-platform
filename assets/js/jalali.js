// تبدیل تاریخ شمسی ↔ میلادی (الگوریتم jalaali-js)
function div(a, b) { return ~~(a / b); }
function mod(a, b) { return a - ~~(a / b) * b; }

const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy) {
  const bl = breaks.length, gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621, k;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function toJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
export function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
export function monthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29;
}

const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function faDigits(s) { return String(s ?? '').replace(/\d/g, d => FA[d]); }
export function enDigits(s) {
  return String(s ?? '').replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));
}
const pad = n => String(n).padStart(2, '0');

/** ISO 'YYYY-MM-DD' → '۱۴۰۵/۰۸/۱۰' */
export function isoToJalali(iso, { digits = 'fa' } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const j = toJalali(y, m, d);
  const s = `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
  return digits === 'fa' ? faDigits(s) : s;
}
/** ISO → '۱۰ آبان ۱۴۰۵' */
export function isoToJalaliLong(iso, withWeekday = false) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const j = toJalali(y, m, d);
  let s = `${j.jd} ${MONTHS[j.jm - 1]} ${j.jy}`;
  if (withWeekday) s = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' + s;
  return faDigits(s);
}
/** '1405/8/10' یا '۱۴۰۵-۰۸-۱۰' → ISO یا null */
export function jalaliToIso(str) {
  if (!str) return null;
  const m = enDigits(str).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return null;
  const jy = +m[1], jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > monthLength(jy, jm)) return null;
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
/** امروز به وقت محلی، ISO */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
/** شروع هفته شمسی (شنبه) برای یک تاریخ */
export function weekStartIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const back = (wd + 1) % 7;
  return addDaysIso(iso, -back);
}
export function monthStartIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const j = toJalali(y, m, d);
  const g = toGregorian(j.jy, j.jm, 1);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
