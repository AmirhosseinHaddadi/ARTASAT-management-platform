// =====================================================================
//  زبان، جهت، اعداد و تقویم کاربر
//  L('متن فارسی', 'English text') — متن مناسب زبان فعلی را برمی‌گرداند
// =====================================================================
const LS_LANG = 'artasat-lang', LS_CAL = 'artasat-cal', LS_THEME = 'artasat-theme';
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const state = {
  lang: read(LS_LANG) === 'en' ? 'en' : 'fa',
  cal: null,
  theme: read(LS_THEME) === 'light' ? 'light' : 'navy',
};
state.cal = ['jalali', 'gregorian'].includes(read(LS_CAL)) ? read(LS_CAL) : (state.lang === 'en' ? 'gregorian' : 'jalali');

export const lang = () => state.lang;
export const isFa = () => state.lang === 'fa';
export const primaryCal = () => state.cal;
export const secondaryCal = () => (state.cal === 'jalali' ? 'gregorian' : 'jalali');
export const theme = () => state.theme;

export function setPrefs({ lang: lg, cal, theme: th } = {}) {
  if (lg && lg !== state.lang) { state.lang = lg; write(LS_LANG, lg); }
  if (cal) { state.cal = cal; write(LS_CAL, cal); }
  if (th) { state.theme = th; write(LS_THEME, th); }
  applyDocument();
}
export function applyDocument() {
  const h = document.documentElement;
  h.lang = state.lang;
  h.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
  h.dataset.theme = state.theme;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = state.theme === 'navy' ? '#06152b' : '#0B2E59';
}

export const L = (fa, en) => (state.lang === 'fa' ? fa : en);

const FA = '۰۱۲۳۴۵۶۷۸۹';
/** اعداد را به ارقام زبان فعلی تبدیل می‌کند */
export const n = s => (state.lang === 'fa' ? String(s ?? '').replace(/\d/g, d => FA[d]) : String(s ?? ''));
export const pct = v => (state.lang === 'fa' ? n(v) + '٪' : v + '%');
export const sep = () => L('، ', ', ');

// ترجمه پیام‌های خطای پایگاه داده (که فارسی نوشته شده‌اند)
const ERR_EN = {
  'نام کاربری یا رمز عبور اشتباه است': 'Wrong username or password',
  'این حساب غیرفعال شده است': 'This account has been deactivated',
  'ارتباط با سرور برقرار نشد': 'Could not reach the server',
  'تسک تایید شده قابل تغییر نیست': 'An approved task cannot be changed',
  'فقط مدیر می‌تواند تسک را تایید نهایی کند': 'Only the manager can give final approval',
  'نام باید حداقل ۲ حرف باشد': 'Name must be at least 2 characters',
  'دسترسی غیرمجاز': 'Not allowed',
  'نمی‌توانید حساب خودتان را غیرفعال کنید': 'You cannot deactivate your own account',
  'رمز عبور باید حداقل ۸ کاراکتر باشد': 'Password must be at least 8 characters',
  'رمز جدید باید حداقل ۸ کاراکتر باشد': 'New password must be at least 8 characters',
  'رمز فعلی اشتباه است': 'Current password is wrong',
  'این نام کاربری قبلاً ثبت شده است': 'This username is already taken',
  'نام کاربری فقط حروف انگلیسی، عدد و . _ - (۳ تا ۳۲ کاراکتر)': 'Username: English letters, digits and . _ - only (3–32 chars)',
  'لطفاً دوباره وارد شوید': 'Please sign in again',
  'تسک پیدا نشد': 'Task not found',
  'متن کامنت خالی است': 'Comment is empty',
  'نقش نامعتبر': 'Invalid role',
};
export function trErr(msg) {
  if (state.lang === 'fa' || !msg) return msg;
  for (const [fa, en] of Object.entries(ERR_EN)) if (msg.includes(fa)) return en;
  return msg;
}

applyDocument();
