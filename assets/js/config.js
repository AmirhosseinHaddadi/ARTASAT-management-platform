// =====================================================================
//  تنظیمات اتصال
//  MODE = 'demo'      → بدون سرور، داده‌ها فقط در همین مرورگر ذخیره می‌شوند (برای تست)
//  MODE = 'supabase'  → نسخه واقعی و مشترک بین همه همکاران
// =====================================================================
export const CONFIG = {
  MODE: 'supabase',

  // از Supabase → Project Settings → API کپی کنید
  SUPABASE_URL: 'https://hxkenhmrohuvouclvuvu.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_rNEukmFDhuFqv3R62yeLHA_C9wYn9Bl',

  // باید با دامنه داخل setup.sql یکی باشد
  EMAIL_DOMAIN: 'artasat.team',

  COMPANY_NAME: 'آرتاسَت',
  COMPANY_SUBTITLE: 'آرتا بوم پارسه',
};
