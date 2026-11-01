// =====================================================================
//  لایه داده — یک رابط واحد با دو پیاده‌سازی:
//  DemoAPI     → localStorage (فقط برای تست روی یک مرورگر)
//  SupabaseAPI → پایگاه داده واقعی و مشترک
// =====================================================================
import { CONFIG } from './config.js';
import { todayIso, addDaysIso } from './jalali.js';
import { trErr } from './i18n.js';

const hhmm = t => (t ? String(t).slice(0, 5) : null);
const normAtt = r => r && ({ ...r, check_in: hhmm(r.check_in), check_out: hhmm(r.check_out), breaks: r.breaks || [] });

export class ApiError extends Error { constructor(m) { super(trErr(m)); } }

/* ------------------------------------------------------------------ */
/*  Supabase                                                           */
/* ------------------------------------------------------------------ */
class SupabaseAPI {
  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    this.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'artasat-team-auth' },
    });
  }
  _chk({ data, error }) {
    if (error) throw new ApiError(this._msg(error));
    return data;
  }
  _msg(e) {
    const m = e.message || String(e);
    if (/Invalid login credentials/i.test(m)) return 'نام کاربری یا رمز عبور اشتباه است';
    if (/banned/i.test(m)) return 'این حساب غیرفعال شده است';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'ارتباط با سرور برقرار نشد';
    return m;
  }

  // ---- احراز هویت
  async login(username, password) {
    const email = `${username.trim().toLowerCase()}@${CONFIG.EMAIL_DOMAIN}`;
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError(this._msg(error));
    const me = await this.me();
    if (!me || !me.active) { await this.logout(); throw new ApiError('این حساب غیرفعال شده است'); }
    return me;
  }
  async logout() { await this.sb.auth.signOut(); }
  async me() {
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) return null;
    const { data } = await this.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return data;
  }
  async changeMyPassword(oldPw, newPw) {
    const me = await this.me();
    const email = `${me.username}@${CONFIG.EMAIL_DOMAIN}`;
    const r = await this.sb.auth.signInWithPassword({ email, password: oldPw });
    if (r.error) throw new ApiError('رمز فعلی اشتباه است');
    if (newPw.length < 8) throw new ApiError('رمز جدید باید حداقل ۸ کاراکتر باشد');
    this._chk(await this.sb.auth.updateUser({ password: newPw }));
  }
  async updateMyProfile(patch) {
    const me = await this.me();
    const row = {};
    for (const k of ['full_name', 'full_name_en', 'locale', 'calendar']) if (k in patch) row[k] = patch[k];
    return this._chk(await this.sb.from('profiles').update(row).eq('id', me.id).select().single());
  }

  // ---- کاربران
  async listProfiles() {
    return this._chk(await this.sb.from('profiles').select('*').order('created_at'));
  }
  async adminCreateUser(u) {
    this._chk(await this.sb.rpc('admin_create_user', {
      p_username: u.username, p_password: u.password, p_full_name: u.full_name,
      p_role: u.role || 'member', p_job_title: u.job_title || '', p_full_name_en: u.full_name_en || '',
    }));
  }
  async adminUpdateUser(id, patch) {
    const { full_name, full_name_en, job_title, role } = patch;
    this._chk(await this.sb.from('profiles').update({ full_name, full_name_en, job_title, role }).eq('id', id));
  }
  async adminSetPassword(id, pw) { this._chk(await this.sb.rpc('admin_set_password', { p_user: id, p_password: pw })); }
  async adminSetActive(id, active) { this._chk(await this.sb.rpc('admin_set_active', { p_user: id, p_active: active })); }

  // ---- پروژه‌ها و قراردادها
  async listProjects(isAdmin) {
    const rows = this._chk(await this.sb.from('projects').select('*').order('created_at', { ascending: false }));
    if (isAdmin) {
      const fin = this._chk(await this.sb.from('project_finance').select('*'));
      const map = Object.fromEntries(fin.map(f => [f.project_id, f]));
      rows.forEach(r => { const f = map[r.id] || {}; r.amount = f.amount ?? null; r.paid = f.paid ?? null; r.finance_notes = f.notes || ''; });
    }
    return rows;
  }
  async saveProject(p) {
    const { id, amount, paid, finance_notes, created_at, updated_at, ...row } = p;
    let saved;
    if (id) saved = this._chk(await this.sb.from('projects').update(row).eq('id', id).select().single());
    else saved = this._chk(await this.sb.from('projects').insert(row).select().single());
    this._chk(await this.sb.from('project_finance').upsert({
      project_id: saved.id, amount: amount ?? null, paid: paid ?? null, notes: finance_notes || '',
    }));
    return saved;
  }
  async deleteProject(id) { this._chk(await this.sb.from('projects').delete().eq('id', id)); }

  // ---- تسک‌ها
  async listTasks() {
    return this._chk(await this.sb.from('tasks').select('*').order('created_at', { ascending: false }));
  }
  async saveTask(t) {
    const { id, created_at, updated_at, requested_at, approved_at, approved_by, created_by, ...row } = t;
    if (id) return this._chk(await this.sb.from('tasks').update(row).eq('id', id).select().single());
    return this._chk(await this.sb.from('tasks').insert(row).select().single());
  }
  async updateTask(id, patch) {
    return this._chk(await this.sb.from('tasks').update(patch).eq('id', id).select().single());
  }
  async deleteTask(id) { this._chk(await this.sb.from('tasks').delete().eq('id', id)); }

  // ---- کامنت‌ها
  async listComments(taskId) {
    return this._chk(await this.sb.from('task_comments').select('*').eq('task_id', taskId).order('created_at'));
  }
  async recentComments(limit = 12) {
    return this._chk(await this.sb.from('task_comments').select('*').order('created_at', { ascending: false }).limit(limit));
  }
  async addComment(taskId, body) {
    const me = await this.me();
    return this._chk(await this.sb.from('task_comments').insert({ task_id: taskId, body, author_id: me.id }).select().single());
  }
  async deleteComment(id) { this._chk(await this.sb.from('task_comments').delete().eq('id', id)); }

  // ---- حضور و غیاب
  async listAttendance({ userId, from, to } = {}) {
    let q = this.sb.from('attendance').select('*').order('work_date', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    if (from) q = q.gte('work_date', from);
    if (to) q = q.lte('work_date', to);
    return this._chk(await q).map(normAtt);
  }
  async saveAttendance(r) {
    const row = { user_id: r.user_id, work_date: r.work_date, check_in: r.check_in || null,
      check_out: r.check_out || null, breaks: r.breaks || [], note: r.note || '' };
    return normAtt(this._chk(await this.sb.from('attendance').upsert(row, { onConflict: 'user_id,work_date' }).select().single()));
  }
  async deleteAttendance(id) { this._chk(await this.sb.from('attendance').delete().eq('id', id)); }
}

/* ------------------------------------------------------------------ */
/*  Demo (localStorage) — همان قوانین دسترسی نسخه واقعی                */
/* ------------------------------------------------------------------ */
const DB_KEY = 'artasat-team-demo-db-v2', SES_KEY = 'artasat-team-demo-session';

function seed() {
  const now = new Date().toISOString(), t = todayIso();
  const users = [
    { id: 'u-admin', username: 'ahaddadi', password: 'admin1234', full_name: 'امیرحسین حدادی', full_name_en: 'Amirhossein Haddadi', job_title: 'مدیرعامل', role: 'admin' },
    { id: 'u-1', username: 'brahimi', password: 'demo1234', full_name: 'بهنام رحیمی', full_name_en: 'Behnam Rahimi', job_title: 'کارشناس سنجش از دور', role: 'member' },
    { id: 'u-2', username: 'bshamsaei', password: 'demo1234', full_name: 'بهار شمسایی', full_name_en: 'Bahar Shamsaei', job_title: 'کارشناس داده', role: 'member' },
    { id: 'u-3', username: 'skamranjabbari', password: 'demo1234', full_name: 'ساره کامران جباری', full_name_en: 'Sareh Kamran Jabbari', job_title: 'کارشناس ارتباطات', role: 'member' },
    { id: 'u-4', username: 'user1', password: 'demo1234', full_name: 'کاربر ۱', full_name_en: 'User 1', job_title: '', role: 'member' },
  ].map(u => ({ ...u, locale: 'fa', calendar: 'jalali', active: true, created_at: now }));
  const projects = [
    { id: 1, kind: 'contract', title: 'پایش خسارت خشکسالی — صندوق بیمه کشاورزی', employer: 'صندوق بیمه محصولات کشاورزی', contract_no: '۱۴۰۵/ق/۱۲', status: 'active', start_date: addDaysIso(t, -60), end_date: addDaysIso(t, 120), progress: 35, description: 'برآورد خسارت قطعه‌به‌قطعه در دو استان پایلوت', amount: 4500000000, paid: 1500000000, finance_notes: 'پیش‌پرداخت دریافت شد' },
    { id: 2, kind: 'project', title: 'ماژول پایش آفات', employer: 'داخلی', contract_no: '', status: 'active', start_date: addDaysIso(t, -30), end_date: addDaysIso(t, 90), progress: 20, description: 'توسعه مدل تشخیص کانون آفت از باندهای لبه قرمز', amount: null, paid: null, finance_notes: '' },
    { id: 3, kind: 'contract', title: 'سامانه هشدار سیل — شرکت آب منطقه‌ای', employer: 'شرکت آب منطقه‌ای', contract_no: '', status: 'negotiation', start_date: null, end_date: null, progress: 0, description: 'در حال مذاکره برای فاز اول', amount: 2800000000, paid: 0, finance_notes: '' },
  ].map(p => ({ ...p, created_at: now, updated_at: now }));
  const mk = (id, title, assignee, project, status, priority, due, desc = '', start = -5) =>
    ({ id, title, description: desc, start_date: addDaysIso(t, start), assignee_id: assignee, project_id: project, priority, status, progress: status === 'in_progress' ? 40 : status === 'pending_approval' ? 100 : 0, due_date: due, requested_at: status === 'pending_approval' ? now : null, approved_at: null, approved_by: null, created_by: 'u-admin', created_at: now, updated_at: now });
  const tasks = [
    mk(1, 'تهیه نقشه NDVI منطقه پایلوت', 'u-1', 1, 'in_progress', 'high', addDaysIso(t, 3), 'تصاویر Sentinel-2 سه ماه اخیر، ماسک ابر و خروجی GeoTIFF', -4),
    mk(2, 'پاکسازی داده‌های ایستگاه‌های هواشناسی', 'u-2', 1, 'pending_approval', 'normal', addDaysIso(t, -1), 'حذف داده‌های پرت و پر کردن خلأها', -8),
    mk(3, 'آماده‌سازی ارائه برای کارفرما', 'u-3', 3, 'todo', 'urgent', addDaysIso(t, 2), '', 0),
    mk(4, 'بررسی منابع علمی پایش آفات', 'u-4', 2, 'todo', 'low', addDaysIso(t, 10), '', 1),
    mk(5, 'آموزش مدل طبقه‌بندی محصول', 'u-1', 2, 'todo', 'normal', addDaysIso(t, -2), '', -9),
    mk(6, 'گزارش ماهانه پیشرفت قرارداد', 'u-2', 1, 'todo', 'high', addDaysIso(t, 6), '', 4),
    mk(7, 'جلسه هماهنگی با شرکت آب منطقه‌ای', 'u-3', 3, 'todo', 'normal', addDaysIso(t, 1), '', 1),
  ];
  tasks.push({ ...mk(8, 'تهیه داده‌های پایه منطقه', 'u-4', 1, 'done', 'normal', addDaysIso(t, -6), '', -12), approved_at: new Date(Date.now() - 5 * 86400000).toISOString(), approved_by: 'u-admin', progress: 100 });
  const comments = [
    { id: 1, task_id: 2, author_id: 'u-2', kind: 'comment', body: 'داده‌های ۱۲ ایستگاه بررسی شد. فایل نهایی در پوشه مشترک است.', created_at: now },
    { id: 2, task_id: 2, author_id: 'u-2', kind: 'system', body: 'درخواست تایید ارسال شد', created_at: now },
  ];
  const attendance = [
    { id: 1, user_id: 'u-1', work_date: t, check_in: '08:45', check_out: null, breaks: [], note: '', updated_at: now },
    { id: 2, user_id: 'u-2', work_date: t, check_in: '09:10', check_out: null, breaks: [{ start: '12:30', end: '13:00' }], note: '', updated_at: now },
    { id: 3, user_id: 'u-1', work_date: addDaysIso(t, -1), check_in: '08:30', check_out: '17:00', breaks: [{ start: '12:30', end: '13:15' }], note: '', updated_at: now },
    { id: 4, user_id: 'u-2', work_date: addDaysIso(t, -1), check_in: '09:00', check_out: '16:30', breaks: [{ start: '13:00', end: '13:30' }], note: '', updated_at: now },
    { id: 5, user_id: 'u-3', work_date: addDaysIso(t, -1), check_in: '10:00', check_out: '15:00', breaks: [], note: 'دورکاری', updated_at: now },
  ];
  return { users, projects, tasks, comments, attendance, seq: 100 };
}

class DemoAPI {
  async init() {
    try { this.db = JSON.parse(localStorage.getItem(DB_KEY)); } catch { this.db = null; }
    if (!this.db) { this.db = seed(); this._save(); }
  }
  _save() { try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); } catch { /* ignore */ } }
  _id() { return ++this.db.seq; }
  _uid() { try { return localStorage.getItem(SES_KEY); } catch { return null; } }
  _meRaw() { return this.db.users.find(u => u.id === this._uid() && u.active); }
  _pub(u) { if (!u) return null; const { password, ...rest } = u; return { ...rest }; }
  _req() { const m = this._meRaw(); if (!m) throw new ApiError('لطفاً دوباره وارد شوید'); return m; }
  _admin() { const m = this._req(); if (m.role !== 'admin') throw new ApiError('دسترسی غیرمجاز'); return m; }
  _canSeeTask(t, me) { return me.role === 'admin' || t.assignee_id === me.id; }
  _log(taskId, authorId, body) {
    this.db.comments.push({ id: this._id(), task_id: taskId, author_id: authorId, kind: 'system', body, created_at: new Date().toISOString() });
  }

  async login(username, password) {
    const u = this.db.users.find(x => x.username === username.trim().toLowerCase());
    if (!u || u.password !== password) throw new ApiError('نام کاربری یا رمز عبور اشتباه است');
    if (!u.active) throw new ApiError('این حساب غیرفعال شده است');
    localStorage.setItem(SES_KEY, u.id);
    return this._pub(u);
  }
  async logout() { localStorage.removeItem(SES_KEY); }
  async me() { return this._pub(this._meRaw()); }
  async changeMyPassword(oldPw, newPw) {
    const m = this._req();
    if (m.password !== oldPw) throw new ApiError('رمز فعلی اشتباه است');
    if (newPw.length < 8) throw new ApiError('رمز جدید باید حداقل ۸ کاراکتر باشد');
    m.password = newPw; this._save();
  }
  async updateMyProfile(patch) {
    const m = this._req();
    if ('full_name' in patch && patch.full_name.trim().length < 2) throw new ApiError('نام باید حداقل ۲ حرف باشد');
    for (const k of ['full_name', 'full_name_en', 'locale', 'calendar']) if (k in patch) m[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
    this._save(); return this._pub(m);
  }

  async listProfiles() { this._req(); return this.db.users.map(u => this._pub(u)); }
  async adminCreateUser(u) {
    this._admin();
    const username = (u.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ApiError('نام کاربری فقط حروف انگلیسی، عدد و . _ - (۳ تا ۳۲ کاراکتر)');
    if ((u.password || '').length < 8) throw new ApiError('رمز عبور باید حداقل ۸ کاراکتر باشد');
    if (this.db.users.some(x => x.username === username)) throw new ApiError('این نام کاربری قبلاً ثبت شده است');
    this.db.users.push({ id: 'u-' + this._id(), username, password: u.password, full_name: u.full_name.trim(), full_name_en: (u.full_name_en || '').trim(), job_title: u.job_title || '', role: u.role || 'member', locale: 'fa', calendar: 'jalali', active: true, created_at: new Date().toISOString() });
    this._save();
  }
  async adminUpdateUser(id, patch) {
    this._admin();
    const u = this.db.users.find(x => x.id === id);
    if (patch.full_name.trim().length < 2) throw new ApiError('نام باید حداقل ۲ حرف باشد');
    Object.assign(u, { full_name: patch.full_name.trim(), full_name_en: (patch.full_name_en || '').trim(), job_title: patch.job_title, role: patch.role });
    this._save();
  }
  async adminSetPassword(id, pw) {
    this._admin();
    if (pw.length < 8) throw new ApiError('رمز عبور باید حداقل ۸ کاراکتر باشد');
    this.db.users.find(x => x.id === id).password = pw; this._save();
  }
  async adminSetActive(id, active) {
    const me = this._admin();
    if (id === me.id) throw new ApiError('نمی‌توانید حساب خودتان را غیرفعال کنید');
    this.db.users.find(x => x.id === id).active = active; this._save();
  }

  async listProjects(isAdmin) {
    this._req();
    return this.db.projects.map(p => {
      const c = { ...p };
      if (!isAdmin) { delete c.amount; delete c.paid; delete c.finance_notes; }
      return c;
    }).sort((a, b) => b.id - a.id);
  }
  async saveProject(p) {
    this._admin();
    const now = new Date().toISOString();
    if (p.id) {
      const ex = this.db.projects.find(x => x.id === p.id);
      Object.assign(ex, p, { updated_at: now });
      this._save(); return ex;
    }
    const row = { ...p, id: this._id(), created_at: now, updated_at: now };
    this.db.projects.push(row); this._save(); return row;
  }
  async deleteProject(id) {
    this._admin();
    this.db.projects = this.db.projects.filter(p => p.id !== id);
    this.db.tasks.forEach(t => { if (t.project_id === id) t.project_id = null; });
    this._save();
  }

  async listTasks() {
    const me = this._req();
    return this.db.tasks.filter(t => this._canSeeTask(t, me)).map(t => ({ ...t })).sort((a, b) => b.id - a.id);
  }
  async saveTask(t) {
    const me = this._admin();
    const now = new Date().toISOString();
    const fields = ['title', 'description', 'assignee_id', 'project_id', 'priority', 'start_date', 'due_date', 'status', 'progress'];
    if (t.id) {
      const ex = this.db.tasks.find(x => x.id === t.id);
      const patch = Object.fromEntries(fields.filter(f => f in t).map(f => [f, t[f]]));
      return this._applyTaskUpdate(ex, patch, me);
    }
    const row = { id: this._id(), title: t.title, description: t.description || '', start_date: t.start_date || todayIso(), assignee_id: t.assignee_id, project_id: t.project_id || null, priority: t.priority || 'normal', status: t.status || 'todo', progress: t.progress || 0, due_date: t.due_date || null, requested_at: null, approved_at: null, approved_by: null, created_by: me.id, created_at: now, updated_at: now };
    this.db.tasks.push(row); this._save(); return { ...row };
  }
  async updateTask(id, patch) {
    const me = this._req();
    const ex = this.db.tasks.find(x => x.id === id);
    if (!ex || !this._canSeeTask(ex, me)) throw new ApiError('تسک پیدا نشد');
    return this._applyTaskUpdate(ex, patch, me);
  }
  _applyTaskUpdate(ex, patch, me) {
    const isAdmin = me.role === 'admin';
    const old = { ...ex };
    if (!isAdmin) {
      if (old.status === 'done') throw new ApiError('تسک تایید شده قابل تغییر نیست');
      patch = Object.fromEntries(Object.entries(patch).filter(([k]) => k === 'status' || k === 'progress'));
      if (patch.status && !['todo', 'in_progress', 'pending_approval'].includes(patch.status))
        throw new ApiError('فقط مدیر می‌تواند تسک را تایید نهایی کند');
    }
    Object.assign(ex, patch);
    const now = new Date().toISOString();
    if (ex.status === 'pending_approval' && old.status !== 'pending_approval') ex.requested_at = now;
    if (ex.status === 'done' && old.status !== 'done') { ex.approved_at = now; ex.approved_by = me.id; ex.progress = 100; }
    else if (ex.status !== 'done') { ex.approved_at = null; ex.approved_by = null; }
    ex.updated_at = now;
    if (ex.status !== old.status) {
      const msg = ex.status === 'pending_approval' ? 'درخواست تایید ارسال شد'
        : ex.status === 'done' ? 'تسک توسط مدیر تایید شد ✓'
        : (old.status === 'pending_approval' && ex.status === 'in_progress' && isAdmin) ? 'درخواست تایید رد شد و تسک به «در حال انجام» برگشت'
        : old.status === 'done' ? 'تایید تسک توسط مدیر لغو شد'
        : ex.status === 'in_progress' ? 'کار روی تسک شروع شد'
        : ex.status === 'todo' ? 'وضعیت به «انجام نشده» برگشت' : 'وضعیت تغییر کرد';
      this._log(ex.id, me.id, msg);
    }
    this._save(); return { ...ex };
  }
  async deleteTask(id) {
    this._admin();
    this.db.tasks = this.db.tasks.filter(t => t.id !== id);
    this.db.comments = this.db.comments.filter(c => c.task_id !== id);
    this._save();
  }

  async listComments(taskId) {
    const me = this._req();
    const t = this.db.tasks.find(x => x.id === taskId);
    if (!t || !this._canSeeTask(t, me)) return [];
    return this.db.comments.filter(c => c.task_id === taskId).sort((a, b) => a.id - b.id);
  }
  async recentComments(limit = 12) {
    const me = this._req();
    const visible = new Set(this.db.tasks.filter(t => this._canSeeTask(t, me)).map(t => t.id));
    return this.db.comments.filter(c => visible.has(c.task_id)).sort((a, b) => b.id - a.id).slice(0, limit);
  }
  async addComment(taskId, body) {
    const me = this._req();
    const t = this.db.tasks.find(x => x.id === taskId);
    if (!t || !this._canSeeTask(t, me)) throw new ApiError('دسترسی غیرمجاز');
    if (!body.trim()) throw new ApiError('متن کامنت خالی است');
    const c = { id: this._id(), task_id: taskId, author_id: me.id, kind: 'comment', body: body.trim(), created_at: new Date().toISOString() };
    this.db.comments.push(c); this._save(); return c;
  }
  async deleteComment(id) { this._admin(); this.db.comments = this.db.comments.filter(c => c.id !== id); this._save(); }

  async listAttendance({ userId, from, to } = {}) {
    const me = this._req();
    return this.db.attendance
      .filter(a => me.role === 'admin' || a.user_id === me.id)
      .filter(a => !userId || a.user_id === userId)
      .filter(a => !from || a.work_date >= from)
      .filter(a => !to || a.work_date <= to)
      .map(a => ({ ...a }))
      .sort((a, b) => (a.work_date < b.work_date ? 1 : -1));
  }
  async saveAttendance(r) {
    const me = this._req();
    if (me.role !== 'admin' && r.user_id !== me.id) throw new ApiError('دسترسی غیرمجاز');
    let ex = this.db.attendance.find(a => a.user_id === r.user_id && a.work_date === r.work_date);
    const row = { user_id: r.user_id, work_date: r.work_date, check_in: r.check_in || null, check_out: r.check_out || null, breaks: r.breaks || [], note: r.note || '', updated_at: new Date().toISOString() };
    if (ex) Object.assign(ex, row); else { ex = { id: this._id(), ...row }; this.db.attendance.push(ex); }
    this._save(); return { ...ex };
  }
  async deleteAttendance(id) {
    const me = this._req();
    const a = this.db.attendance.find(x => x.id === id);
    if (!a || (me.role !== 'admin' && a.user_id !== me.id)) throw new ApiError('دسترسی غیرمجاز');
    this.db.attendance = this.db.attendance.filter(x => x.id !== id); this._save();
  }
  resetDemo() { localStorage.removeItem(DB_KEY); localStorage.removeItem(SES_KEY); }
}

export const api = CONFIG.MODE === 'supabase' ? new SupabaseAPI() : new DemoAPI();
export const IS_DEMO = CONFIG.MODE !== 'supabase';
