// =====================================================================
//  ArtaSat Team — برنامه اصلی (فارسی / English)
// =====================================================================
import { CONFIG } from './config.js';
import { api, IS_DEMO } from './api.js';
import { L, n, pct, sep, isFa, lang, setPrefs, primaryCal, secondaryCal, theme } from './i18n.js';
import {
  todayIso, addDaysIso, fmt, fmt2, parts, addMonths, monthGrid, monthTitle, weekdayName, firstDow,
  weekStart, monthStart, daysBetween, isWeekend, parseDate,
} from './cal.js';
import { nowTime } from './jalali.js';
import {
  esc, $, $$, icon, arrowNext, arrowPrev, STATUS, STATUS_KEYS, STATUS_COLOR, PRIORITY, PRIORITY_KEYS, PROJ_STATUS, PROJ_KEYS, KIND,
  statusPill, prioPill, projPill, kindTag, checkBox, avatar, nm, money, parseMoney, moneyInput, timeAgo, fmtMinutes, fmtTime,
  isLate, dateInput, readDate, wireDateInputs, toast, modal, confirmDialog, run, genPassword, downloadCsv,
} from './ui.js';

const S = { me: null, people: [], peopleById: {}, projects: [], tasks: [] };
const root = $('#app');
const isAdmin = () => S.me?.role === 'admin';
const person = id => S.peopleById[id];
const projectName = id => S.projects.find(p => p.id === id)?.title || '';
const company = () => L(CONFIG.COMPANY_NAME, 'ArtaSat');
const firstName = p => nm(p).split(/\s+/)[0];

// ---------------------------------------------------------------- attendance math
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const nowMin = () => toMin(nowTime());
function workedMinutes(r) {
  if (!r || !r.check_in) return null;
  const live = r.work_date === todayIso();
  const end = r.check_out ? toMin(r.check_out) : (live ? nowMin() : null);
  if (end == null) return null;
  return Math.max(0, end - toMin(r.check_in) - breakMinutes(r, end));
}
function breakMinutes(r, endFallback) {
  const live = r.work_date === todayIso() && !r.check_out;
  return (r.breaks || []).reduce((s, b) => {
    const st = toMin(b.start); if (st == null) return s;
    const en = b.end ? toMin(b.end) : (live ? nowMin() : endFallback ?? st);
    return s + Math.max(0, en - st);
  }, 0);
}
function presence(r) {
  if (!r || !r.check_in) return 'absent';
  if (r.check_out) return 'out';
  const last = (r.breaks || [])[r.breaks.length - 1];
  return last && !last.end ? 'break' : 'in';
}
const PRESENCE = p => ({ in: L('حاضر', 'In'), break: L('در استراحت', 'On break'), out: L('خارج شده', 'Left'), absent: L('ثبت نشده', 'Not in') }[p]);
const presencePill = p => `<span class="presence pz-${p}">${PRESENCE(p)}</span>`;
const brText = b => (b.end ? n(L(`${b.start} تا ${b.end}`, `${b.start}–${b.end}`)) : n(L(`از ${b.start} (باز)`, `${b.start}– (open)`)));

// ---------------------------------------------------------------- task dates
const taskStart = t => t.start_date || t.created_at?.slice(0, 10) || todayIso();
function taskSpan(t) {
  const a = taskStart(t), b = t.due_date || a;
  return a <= b ? [a, b] : [b, a];
}

// ---------------------------------------------------------------- boot
async function boot() {
  try { await api.init(); }
  catch (e) {
    root.innerHTML = `<div class="loading"><div style="text-align:center"><b>${L('اتصال به سرور برقرار نشد.', 'Could not connect to the server.')}</b><br><span class="muted small">${esc(e.message)}</span></div></div>`;
    return;
  }
  try { S.me = await api.me(); } catch { S.me = null; }
  if (!S.me || !S.me.active) return renderLogin();
  applyUserPrefs();
  startShell();
}
function applyUserPrefs() {
  const p = {};
  if (S.me?.locale) p.lang = S.me.locale;
  if (S.me?.calendar) p.cal = S.me.calendar;
  setPrefs(p);
}

// ---------------------------------------------------------------- login
function renderLogin() {
  document.title = `${L('ورود', 'Sign in')} | ${company()}`;
  root.innerHTML = `
  <div class="login-wrap">
    <section class="login-art">
      <div class="brand"><img src="assets/img/logo-mark.png" alt=""><div><b>${esc(company())}</b><span>${L(CONFIG.COMPANY_SUBTITLE, 'Arta Boom Parseh')}</span></div></div>
      <div>
        <h1>${L('کارهای تیم، یک‌جا<br>و شفاف.', 'Your team’s work,<br>in one clear place.')}</h1>
        <p>${L('تسک‌ها و تقویم کاری، درخواست تایید، ساعت ورود و خروج، پروژه‌ها و قراردادهای شرکت — همه در یک پنل.', 'Tasks and a shared work calendar, approval requests, check-in and check-out, company projects and contracts — all in one panel.')}</p>
      </div>
      <div class="feat"><span>${L('تقویم تسک‌ها', 'Task calendar')}</span><span>${L('تایید مدیر', 'Manager approval')}</span><span>${L('حضور و غیاب', 'Attendance')}</span><span>${L('پروژه‌ها و قراردادها', 'Projects & contracts')}</span></div>
    </section>
    <section class="login-panel">
      <button class="btn btn-sm login-lang" id="langBtn">${icon('globe')} ${L('English', 'فارسی')}</button>
      <form class="login-card" id="loginForm" autocomplete="on">
        <img class="logo-m" src="assets/img/logo-mark.png" alt="">
        <h2>${L('ورود به پنل', 'Sign in')}</h2>
        <div class="sub">${L('نام کاربری و رمز عبوری را که از مدیر گرفته‌اید وارد کنید.', 'Use the username and password your manager gave you.')}</div>
        <div class="field"><label for="lu">${L('نام کاربری', 'Username')}</label><input class="input ltr" id="lu" name="username" autocomplete="username" required dir="ltr"></div>
        <div class="field"><label for="lp">${L('رمز عبور', 'Password')}</label><input class="input ltr" id="lp" name="password" type="password" autocomplete="current-password" required dir="ltr"></div>
        <div class="err" id="lerr"></div>
        <button class="btn btn-primary btn-block" type="submit">${icon('login', 'class="flip"')} ${L('ورود', 'Sign in')}</button>
        ${IS_DEMO ? `<div class="demo-box"><b>${L('نسخه آزمایشی', 'Demo mode')}</b> — ${L('داده‌ها فقط در همین مرورگر ذخیره می‌شوند. برای ورود سریع:', 'data stays in this browser only. Quick sign-in:')}
          <div class="chips">
            <button type="button" class="btn btn-sm" data-demo="ahaddadi:admin1234">${L('مدیر', 'Manager')}</button>
            <button type="button" class="btn btn-sm" data-demo="brahimi:demo1234">${L('بهنام رحیمی', 'Behnam Rahimi')}</button>
            <button type="button" class="btn btn-sm" data-demo="bshamsaei:demo1234">${L('بهار شمسایی', 'Bahar Shamsaei')}</button>
            <button type="button" class="btn btn-sm" data-demo="skamranjabbari:demo1234">${L('ساره کامران جباری', 'Sareh Kamran Jabbari')}</button>
            <button type="button" class="btn btn-sm" data-demo="user1:demo1234">${L('کاربر ۱', 'User 1')}</button>
          </div></div>` : ''}
      </form>
    </section>
  </div>`;
  $('#langBtn').addEventListener('click', () => {
    const lg = isFa() ? 'en' : 'fa';
    setPrefs({ lang: lg, cal: lg === 'en' ? 'gregorian' : 'jalali' });
    renderLogin();
  });
  const f = $('#loginForm');
  $$('[data-demo]', f).forEach(b => b.addEventListener('click', () => {
    const [u, p] = b.dataset.demo.split(':'); f.username.value = u; f.password.value = p; f.requestSubmit();
  }));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    $('#lerr').textContent = '';
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    const chosen = lang(), chosenCal = primaryCal();
    try {
      S.me = await api.login(f.username.value, f.password.value);
      // اولین ورود: زبانی که در صفحه ورود انتخاب شده ذخیره می‌شود
      if (S.me.locale !== chosen && !localStorage.getItem('artasat-pref-set-' + S.me.id)) {
        try { S.me = await api.updateMyProfile({ locale: chosen, calendar: chosenCal }); } catch { /* ignore */ }
      }
      try { localStorage.setItem('artasat-pref-set-' + S.me.id, '1'); } catch { /* ignore */ }
      applyUserPrefs();
      location.hash = isAdmin() ? '#/dashboard' : '#/tasks';
      startShell();
    } catch (err) { $('#lerr').textContent = err.message; }
    finally { btn.disabled = false; }
  });
}

// ---------------------------------------------------------------- shell
const NAV = () => isAdmin() ? [
  ['dashboard', L('داشبورد', 'Dashboard'), 'dashboard'],
  ['tasks', L('تسک‌ها و تقویم', 'Tasks & calendar'), 'calendar'],
  ['attendance', L('حضور و غیاب', 'Attendance'), 'clock'],
  ['projects', L('پروژه‌ها و قراردادها', 'Projects & contracts'), 'folder'],
  ['team', L('همکاران', 'Team'), 'users'],
  ['profile', L('حساب من', 'My account'), 'user'],
] : [
  ['tasks', L('تسک‌ها و تقویم من', 'My tasks & calendar'), 'calendar'],
  ['attendance', L('ساعت کاری من', 'My work hours'), 'clock'],
  ['projects', L('پروژه‌ها و قراردادها', 'Projects & contracts'), 'folder'],
  ['profile', L('حساب من', 'My account'), 'user'],
];

let clockTimer = null;
function startShell() {
  const today = todayIso();
  root.innerHTML = `
  <div class="shell" id="shell">
    <aside class="sidebar">
      <div class="sb-brand"><img src="assets/img/logo-mark.png" alt=""><div><b>${esc(company())}</b><span>${L('سامانه مدیریت کار تیم', 'Team work management')}</span></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="sb-user">
        <span id="sbAvatar"></span>
        <div class="who"><b id="sbName"></b><span>${isAdmin() ? L('مدیر', 'Manager') : L('همکار', 'Team member')}</span></div>
        <button class="icon-btn" id="logoutBtn" title="${L('خروج از حساب', 'Sign out')}">${icon('logout', 'class="flip"')}</button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menuBtn" aria-label="menu">${icon('menu')}</button>
        <h1 id="pageTitle"></h1>
        <div class="date">${IS_DEMO ? `<span class="demo-pill">${L('نسخه آزمایشی', 'Demo')}</span>` : ''}
          <span class="full">${fmt(today, { style: 'long', weekday: true })} <span class="cal2">${fmt(today, { cal: secondaryCal(), style: 'long' })}</span></span></div>
      </header>
      <div class="content" id="view"></div>
    </main>
  </div>`;
  $('#logoutBtn').addEventListener('click', async () => { await api.logout(); S.me = null; location.hash = ''; renderLogin(); });
  $('#menuBtn').addEventListener('click', () => $('#shell').classList.toggle('nav-open'));
  $('#shell').addEventListener('click', e => { if (e.target.id === 'shell') $('#shell').classList.remove('nav-open'); });
  refreshUserCard();
  route();
}
function refreshUserCard() {
  $('#sbAvatar').innerHTML = avatar(S.me);
  $('#sbName').textContent = nm(S.me);
}
function renderNav(current, pendingCount = 0) {
  $('#nav').innerHTML = NAV().map(([k, label, ic], i) => `
    ${isAdmin() && i === 4 ? `<div class="sec">${L('مدیریت', 'Admin')}</div>` : ''}
    <a href="#/${k}" class="${k === current ? 'active' : ''}">${icon(ic)}<span>${label}</span>
    ${k === 'tasks' && pendingCount ? `<span class="badge">${n(pendingCount)}</span>` : ''}</a>`).join('');
  $$('#nav a').forEach(a => a.addEventListener('click', () => $('#shell').classList.remove('nav-open')));
}

window.addEventListener('hashchange', () => { if (S.me) route(); });

async function loadCore() {
  const [people, projects, tasks] = await Promise.all([api.listProfiles(), api.listProjects(isAdmin()), api.listTasks()]);
  S.people = people; S.peopleById = Object.fromEntries(people.map(p => [p.id, p]));
  S.projects = projects; S.tasks = tasks;
  const me = S.peopleById[S.me.id]; if (me) S.me = me;
}

let lastRoute = '';
async function route() {
  clearInterval(clockTimer);
  const [, page = '', qs = ''] = location.hash.match(/^#\/([^?]*)\??(.*)$/) || [];
  const params = Object.fromEntries(new URLSearchParams(qs));
  const nav = NAV();
  const cur = nav.some(x => x[0] === page) ? page : nav[0][0];
  const title = nav.find(x => x[0] === cur)[1];
  $('#pageTitle').textContent = title;
  document.title = `${title} | ${company()}`;
  const view = $('#view');
  // اگر همان صفحه دوباره رسم می‌شود، اسپینر نشان نده تا صفحه نپرد
  if (lastRoute !== location.hash) view.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  lastRoute = location.hash;
  try { await loadCore(); }
  catch (e) {
    if (/دوباره وارد|sign in again|JWT/i.test(e.message)) { S.me = null; return renderLogin(); }
    view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return;
  }
  renderNav(cur, isAdmin() ? S.tasks.filter(t => t.status === 'pending_approval').length : 0);
  refreshUserCard();
  const views = { dashboard: viewDashboard, tasks: viewTasks, attendance: isAdmin() ? viewAttendanceAdmin : viewAttendanceMe, projects: viewProjects, team: viewTeam, profile: viewProfile };
  const scroll = window.scrollY;
  try { await views[cur](view, params); if (lastRoute === location.hash) window.scrollTo(0, scroll); }
  catch (e) { console.error(e); view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
const rerender = () => route();

// =====================================================================
//  داشبورد مدیر
// =====================================================================
async function viewDashboard(v) {
  const today = todayIso();
  const [todayAtt, weekAtt, recent] = await Promise.all([
    api.listAttendance({ from: today, to: today }),
    api.listAttendance({ from: weekStart(today), to: today }),
    api.recentComments(10),
  ]);
  const members = S.people.filter(p => p.active && p.role !== 'admin');
  const T = S.tasks;
  const pending = T.filter(t => t.status === 'pending_approval').sort((a, b) => ((a.requested_at || '') < (b.requested_at || '') ? -1 : 1));
  const late = T.filter(isLate);
  const mStart = monthStart(today);
  const doneMonth = T.filter(t => t.status === 'done' && t.approved_at && t.approved_at.slice(0, 10) >= mStart);
  const activeProj = S.projects.filter(p => p.status === 'active');
  const attByUser = Object.fromEntries(todayAtt.map(a => [a.user_id, a]));
  const presentCount = members.filter(m => ['in', 'break'].includes(presence(attByUser[m.id]))).length;
  const upcoming = T.filter(t => t.status !== 'done' && t.due_date && t.due_date >= today && t.due_date <= addDaysIso(today, 7))
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  const kpi = (lbl, val, c, ft = '', href = '') =>
    `<${href ? `button class="kpi" data-href="${href}"` : 'div class="kpi"'} style="--c:${c}"><div class="lbl">${lbl}</div><div class="val num">${val}</div><div class="ft">${ft}</div></${href ? 'button' : 'div'}>`;
  const weekMinutes = uid => weekAtt.filter(a => a.user_id === uid).reduce((s, a) => s + (workedMinutes(a) || 0), 0);

  v.innerHTML = `
  <div class="kpis">
    ${kpi(L('در انتظار تایید شما', 'Awaiting your approval'), n(pending.length), 'var(--gold)', L('درخواست باز', 'open requests'), '#/tasks?status=pending_approval&view=board')}
    ${kpi(L('در حال انجام', 'In progress'), n(T.filter(t => t.status === 'in_progress').length), 'var(--blue)', L(`از ${n(T.filter(t => t.status !== 'done').length)} تسک باز`, `of ${T.filter(t => t.status !== 'done').length} open tasks`), '#/tasks?status=in_progress&view=board')}
    ${kpi(L('دارای تاخیر', 'Overdue'), n(late.length), 'var(--red)', L('گذشته از موعد تحویل', 'past due date'), '#/tasks?late=1&view=board')}
    ${kpi(L('تایید شده این ماه', 'Approved this month'), n(doneMonth.length), 'var(--green)', L('از ابتدای ماه', 'since start of month'), '#/tasks?status=done&view=board')}
    ${kpi(L('پروژه/قرارداد فعال', 'Active projects'), n(activeProj.length), 'var(--violet)', L(`${n(S.projects.filter(p => p.status === 'negotiation').length)} در حال مذاکره`, `${S.projects.filter(p => p.status === 'negotiation').length} in negotiation`), '#/projects')}
    ${kpi(L('حاضر امروز', 'Present today'), `${n(presentCount)}<small> / ${n(members.length)}</small>`, 'var(--green)', L('همکار در محل کار', 'team members in'), '#/attendance')}
  </div>

  <div class="grid g-main">
    <div class="grid">
      <section class="card">
        <div class="card-h"><h3>${L('در انتظار تایید شما', 'Awaiting your approval')}</h3><span class="sp"></span><a class="btn btn-sm btn-ghost" href="#/tasks?status=pending_approval&view=board">${L('همه', 'All')}</a></div>
        <div class="card-b" style="padding-block:4px">
          ${pending.length ? `<div class="list">${pending.slice(0, 6).map(t => `
            <div class="li">
              ${avatar(person(t.assignee_id), 'sm')}
              <div class="grow" data-task="${t.id}" style="cursor:pointer"><div class="t">${esc(t.title)}</div>
                <div class="s">${esc(nm(person(t.assignee_id)))} · ${L('درخواست', 'requested')} ${t.requested_at ? timeAgo(t.requested_at) : ''}</div></div>
              <button class="btn btn-sm btn-green" data-approve="${t.id}">${icon('check')} ${L('تایید', 'Approve')}</button>
              <button class="btn btn-sm" data-task="${t.id}">${L('بررسی', 'Review')}</button>
            </div>`).join('')}</div>` : `<div class="empty">${L('درخواست تاییدی باقی نمانده است ✓', 'Nothing waiting for approval ✓')}</div>`}
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>${L('بار کاری همکاران', 'Team workload')}</h3><span class="sp"></span>
          <span class="legend">${STATUS_KEYS.map(s => `<span><i style="background:${STATUS_COLOR[s]}"></i>${STATUS(s)}</span>`).join('')}</span>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>${L('همکار', 'Member')}</th><th style="width:36%">${L('وضعیت تسک‌ها', 'Task status')}</th><th>${L('باز', 'Open')}</th><th>${L('تاخیر', 'Late')}</th><th>${L('ساعت کار این هفته', 'Hours this week')}</th></tr></thead>
          <tbody>${members.map(m => {
            const mt = T.filter(t => t.assignee_id === m.id);
            const c = s => mt.filter(t => t.status === s).length;
            const total = mt.length || 1;
            return `<tr class="click" data-href="#/tasks?person=${m.id}">
              <td><span class="who-inline">${avatar(m, 'sm')}<span>${esc(nm(m))}</span></span></td>
              <td><div class="stack">${STATUS_KEYS.map(s => `<i style="width:${c(s) / total * 100}%;background:${STATUS_COLOR[s]}" title="${STATUS(s)}: ${n(c(s))}"></i>`).join('')}</div></td>
              <td class="num">${n(mt.filter(t => t.status !== 'done').length)}</td>
              <td class="num" style="color:${mt.filter(isLate).length ? 'var(--red)' : 'inherit'}">${n(mt.filter(isLate).length)}</td>
              <td class="num">${fmtMinutes(weekMinutes(m.id))}</td></tr>`;
          }).join('') || `<tr><td colspan="5" class="empty">${L('هنوز همکاری اضافه نشده', 'No team members yet')}</td></tr>`}</tbody>
        </table></div>
      </section>

      <section class="card">
        <div class="card-h"><h3>${L('تحویل‌های ۷ روز آینده', 'Due in the next 7 days')}</h3><span class="sp"></span><a class="btn btn-sm btn-ghost" href="#/tasks?view=calendar">${icon('calendar')} ${L('تقویم', 'Calendar')}</a></div>
        <div class="card-b" style="padding-block:4px">
          ${upcoming.length ? `<div class="list">${upcoming.slice(0, 8).map(t => `
            <div class="li click" data-task="${t.id}">${checkBox(t.status)}
              <div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(nm(person(t.assignee_id)))}${t.project_id ? ' · ' + esc(projectName(t.project_id)) : ''}</div></div>
              <span class="small num">${fmt2(t.due_date)}</span>${statusPill(t.status)}</div>`).join('')}</div>` : `<div class="empty">${L('تحویلی در هفته پیش رو نیست', 'Nothing due this week')}</div>`}
        </div>
      </section>
    </div>

    <div class="grid" style="align-content:start">
      <section class="card">
        <div class="card-h"><h3>${L('وضعیت امروز همکاران', 'Who’s in today')}</h3><span class="sp"></span><a class="btn btn-sm btn-ghost" href="#/attendance">${L('گزارش', 'Report')}</a></div>
        <div class="card-b" style="padding-block:4px"><div class="list">
          ${members.map(m => { const a = attByUser[m.id]; return `
            <div class="li">${avatar(m, 'sm')}<div class="grow"><div class="t">${esc(nm(m))}</div>
              <div class="s num">${a?.check_in ? `${L('ورود', 'in')} ${fmtTime(a.check_in)}` : ''}${a?.check_out ? ` · ${L('خروج', 'out')} ${fmtTime(a.check_out)}` : ''}${a?.check_in ? ` · ${fmtMinutes(workedMinutes(a))} ${L('کار', 'worked')}` : ''}</div></div>
              ${presencePill(presence(a))}</div>`; }).join('') || '<div class="empty">—</div>'}
        </div></div>
      </section>

      <section class="card">
        <div class="card-h"><h3>${L('فعالیت‌های اخیر', 'Recent activity')}</h3></div>
        <div class="card-b" style="padding-block:4px">
          ${recent.length ? `<div class="list">${recent.map(c => {
            const t = T.find(x => x.id === c.task_id);
            return `<div class="li click" data-task="${c.task_id}">${avatar(person(c.author_id), 'sm')}
              <div class="grow"><div class="t" style="font-weight:500">${c.kind === 'system' ? `<span class="muted">${esc(sysText(c.body))}</span>` : esc(c.body)}</div>
              <div class="s">${esc(nm(person(c.author_id)))} · ${esc(t?.title || '')} · ${timeAgo(c.created_at)}</div></div></div>`;
          }).join('')}</div>` : `<div class="empty">${L('فعالیتی ثبت نشده', 'No activity yet')}</div>`}
        </div>
      </section>
    </div>
  </div>`;

  $$('[data-href]', v).forEach(el => el.addEventListener('click', () => { location.hash = el.dataset.href; }));
  $$('[data-task]', v).forEach(el => el.addEventListener('click', () => openTask(+el.dataset.task)));
  $$('[data-approve]', v).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    run(b, async () => { await api.updateTask(+b.dataset.approve, { status: 'done' }); toast(L('تسک تایید شد', 'Task approved'), 'ok'); rerender(); });
  }));
}

// پیام‌های سیستمی در پایگاه داده فارسی ذخیره می‌شوند
const SYS_EN = {
  'درخواست تایید ارسال شد': 'Approval requested',
  'تسک توسط مدیر تایید شد ✓': 'Approved by manager ✓',
  'درخواست تایید رد شد و تسک به «در حال انجام» برگشت': 'Approval declined — back to in progress',
  'تایید تسک توسط مدیر لغو شد': 'Approval revoked by manager',
  'کار روی تسک شروع شد': 'Work started',
  'وضعیت به «انجام نشده» برگشت': 'Moved back to to-do',
  'وضعیت تغییر کرد': 'Status changed',
};
const sysText = b => (isFa() ? b : SYS_EN[b] || b);

// =====================================================================
//  تسک‌ها: تقویم ماهانه + برد
// =====================================================================
const calState = { ym: null, sel: null };

async function viewTasks(v, params) {
  const f = { person: params.person || '', status: params.status || '', project: params.project || '', q: '', late: params.late === '1' };
  let mode = params.view || (() => { try { return localStorage.getItem('artasat-tasks-view'); } catch { return null; } })() || 'calendar';
  const admin = isAdmin();
  const members = S.people.filter(p => p.active);
  v.innerHTML = `
  <div class="toolbar">
    <div class="seg" id="mode"><button data-v="calendar">${icon('calendar')} ${L('تقویم', 'Calendar')}</button><button data-v="board">${icon('board')} ${L('برد', 'Board')}</button></div>
    <input class="input" id="fq" placeholder="${L('جستجو…', 'Search…')}">
    ${admin ? `<select class="input" id="fperson"><option value="">${L('همه همکاران', 'Everyone')}</option>${members.map(p => `<option value="${p.id}">${esc(nm(p))}</option>`).join('')}</select>` : ''}
    <select class="input" id="fproject"><option value="">${L('همه پروژه‌ها', 'All projects')}</option><option value="none">${L('بدون پروژه', 'No project')}</option>${S.projects.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select>
    <select class="input" id="fstatus"><option value="">${L('همه وضعیت‌ها', 'All statuses')}</option>${STATUS_KEYS.map(k => `<option value="${k}">${STATUS(k)}</option>`).join('')}</select>
    <label class="small" style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="flate"> ${L('فقط دارای تاخیر', 'Overdue only')}</label>
    <span class="grow"></span>
    ${admin ? `<button class="btn btn-primary" id="newTask">${icon('plus')} ${L('تسک جدید', 'New task')}</button>` : ''}
  </div>
  <div id="tbody"></div>`;

  $('#fq').addEventListener('input', e => { f.q = e.target.value.trim(); draw(); });
  if (admin) { $('#fperson').value = f.person; $('#fperson').addEventListener('change', e => { f.person = e.target.value; draw(); }); }
  $('#fproject').value = f.project; $('#fproject').addEventListener('change', e => { f.project = e.target.value; draw(); });
  $('#fstatus').value = f.status; $('#fstatus').addEventListener('change', e => { f.status = e.target.value; draw(); });
  $('#flate').checked = f.late; $('#flate').addEventListener('change', e => { f.late = e.target.checked; draw(); });
  if (admin) $('#newTask').addEventListener('click', () => editTask(null, { assignee_id: f.person || undefined, start_date: calState.sel || todayIso() }));
  $$('#mode button').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.v; try { localStorage.setItem('artasat-tasks-view', mode); } catch { /* ignore */ }
    draw();
  }));

  const filtered = () => S.tasks.filter(t =>
    (!f.person || t.assignee_id === f.person) &&
    (!f.status || t.status === f.status) &&
    (!f.project || (f.project === 'none' ? !t.project_id : String(t.project_id) === f.project)) &&
    (!f.late || isLate(t)) &&
    (!f.q || t.title.toLowerCase().includes(f.q.toLowerCase()) || (t.description || '').toLowerCase().includes(f.q.toLowerCase())));

  function draw() {
    $$('#mode button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
    const list = filtered();
    if (mode === 'board') drawBoard($('#tbody'), list);
    else drawCalendar($('#tbody'), list, { showPerson: admin && !f.person });
  }
  draw();
}

// ---------------------------------------------------------------- calendar
function drawCalendar(el, tasks, { showPerson }) {
  const cal = primaryCal(), c2 = secondaryCal(), today = todayIso();
  if (!calState.ym || calState.cal !== cal) { calState.ym = parts(today, cal); calState.cal = cal; calState.sel = today; }
  const { y, m } = calState.ym;
  const weeks = monthGrid(y, m, cal);
  const title = monthTitle(y, m, cal);
  const wds = Array.from({ length: 7 }, (_, i) => weekdayName((firstDow() + i) % 7, innerWidth < 640));
  const MAXL = 3;

  // آمار ماه
  const mFirst = weeks[0][0], mLast = weeks[weeks.length - 1][6];
  const inMonth = tasks.filter(t => { const [a, b] = taskSpan(t); return b >= mFirst && a <= mLast; });
  const dueInMonth = tasks.filter(t => t.due_date && parts(t.due_date, cal).y === y && parts(t.due_date, cal).m === m);

  const weekHtml = days => {
    const ws = days[0], we = days[6];
    const items = tasks.map(t => {
      const [a, b] = taskSpan(t);
      if (b < ws || a > we) return null;
      const cs = a < ws ? ws : a, ce = b > we ? we : b;
      return { t, c1: daysBetween(ws, cs) + 1, c2: daysBetween(ws, ce) + 1, s: a >= ws, e: b <= we };
    }).filter(Boolean).sort((p, q) => p.c1 - q.c1 || (q.c2 - q.c1) - (p.c2 - p.c1));
    const laneEnd = [];
    const hidden = Array(8).fill(0);
    items.forEach(it => {
      let lane = laneEnd.findIndex(end => end < it.c1);
      if (lane === -1) { lane = laneEnd.length; laneEnd.push(0); }
      laneEnd[lane] = it.c2; it.lane = lane;
      if (lane >= MAXL) for (let c = it.c1; c <= it.c2; c++) hidden[c]++;
    });
    const bars = items.filter(it => it.lane < MAXL).map(it => {
      const t = it.t, late = isLate(t);
      const color = late ? 'var(--red)' : STATUS_COLOR[t.status];
      const who = showPerson ? `${esc(firstName(person(t.assignee_id)))} · ` : '';
      const tip = `${t.title} — ${nm(person(t.assignee_id))} — ${STATUS(t.status)}${t.due_date ? ' — ' + L('تحویل ', 'due ') + fmt(t.due_date) : ''}`;
      return `<button class="cbar ${it.s ? 's' : ''} ${it.e ? 'e' : ''} ${t.status === 'done' ? 'done' : ''}" data-task="${t.id}" title="${esc(tip)}"
        style="grid-column:${it.c1} / span ${it.c2 - it.c1 + 1};grid-row:${it.lane + 1};--c:${color}">
        ${t.status === 'done' ? '✓' : ''}<span>${who}${esc(t.title)}</span>${it.e && t.due_date && t.status !== 'done' ? `<span class="flag">⚑</span>` : ''}</button>`;
    }).join('');
    const more = hidden.map((h, c) => (h ? `<span class="cmore" data-day="${days[c - 1]}" style="grid-column:${c};grid-row:${MAXL + 1}">+${n(h)} ${L('مورد دیگر', 'more')}</span>` : '')).join('');
    return `<div class="cal-week">
      <div class="cal-bg">${days.map(d => {
        const p = parts(d, cal), q = parts(d, c2);
        return `<div class="cal-day ${p.m !== m ? 'out' : ''} ${d === today ? 'today' : ''} ${d === calState.sel ? 'sel' : ''} ${isWeekend(d) ? 'we' : ''}" data-day="${d}">
          <div class="dn"><b>${n(p.d)}</b><i>${n(q.d === 1 || d === days[0] ? `${q.d} ${monthNameShort(q.m, c2)}` : q.d)}</i></div></div>`;
      }).join('')}</div>
      <div class="cal-fg">${bars}${more}</div></div>`;
  };

  el.innerHTML = `
  <div class="cal-layout">
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-nav="-1" title="${L('ماه قبل', 'Previous month')}">${arrowPrev()}</button>
        <div class="ttl">${title.main}<small>${title.sec}</small></div>
        <button class="icon-btn" data-nav="1" title="${L('ماه بعد', 'Next month')}">${arrowNext()}</button>
        <button class="btn btn-sm" data-nav="0">${L('امروز', 'Today')}</button>
        <span class="sp"></span>
        <span class="legend">${STATUS_KEYS.map(s => `<span><i style="background:${STATUS_COLOR[s]}"></i>${STATUS(s)}</span>`).join('')}
          <span><i style="background:var(--red)"></i>${L('تاخیر', 'Overdue')}</span><span>⚑ ${L('موعد تحویل', 'Due date')}</span></span>
      </div>
      <div class="cal-wd">${wds.map(w => `<div>${w}</div>`).join('')}</div>
      ${weeks.map(weekHtml).join('')}
      <div class="card-b small muted" style="border-top:1px solid var(--line);display:flex;gap:18px;flex-wrap:wrap">
        <span>${L('تسک‌های این ماه', 'Tasks this month')}: <b class="num" style="color:var(--ink)">${n(inMonth.length)}</b></span>
        <span>${L('تحویل در این ماه', 'Due this month')}: <b class="num" style="color:var(--ink)">${n(dueInMonth.length)}</b></span>
        <span>${L('تایید شده', 'Approved')}: <b class="num" style="color:var(--green)">${n(dueInMonth.filter(t => t.status === 'done').length)}</b></span>
        <span>${L('دارای تاخیر', 'Overdue')}: <b class="num" style="color:var(--red)">${n(inMonth.filter(isLate).length)}</b></span>
        <span style="margin-inline-start:auto">${L('هر نوار: از روز شروع تا روز تحویل', 'Each bar runs from start date to due date')}</span>
      </div>
    </section>
    <aside class="card cal-side" id="daySide"></aside>
  </div>`;

  $$('[data-nav]', el).forEach(b => b.addEventListener('click', () => {
    const k = +b.dataset.nav;
    if (k === 0) { calState.ym = parts(today, cal); calState.sel = today; }
    else { calState.ym = addMonths(calState.ym, k); calState.sel = fromYm(calState.ym); }
    drawCalendar(el, tasks, { showPerson });
  }));
  $$('[data-day]', el).forEach(d => d.addEventListener('click', () => {
    calState.sel = d.dataset.day;
    $$('.cal-day.sel', el).forEach(x => x.classList.remove('sel'));
    $(`.cal-day[data-day="${d.dataset.day}"]`, el)?.classList.add('sel');
    drawDay($('#daySide'), tasks, showPerson);
    if (innerWidth < 1240) $('#daySide').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $$('.cbar', el).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openTask(+b.dataset.task); }));
  drawDay($('#daySide'), tasks, showPerson);
}
const monthNameShort = (m, cal) => {
  const names = cal === 'jalali'
    ? L(['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'], ['Far', 'Ord', 'Kho', 'Tir', 'Mor', 'Sha', 'Meh', 'Aba', 'Aza', 'Dey', 'Bah', 'Esf'])
    : L(['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  return names[m - 1];
};
function fromYm({ y, m }) {
  const today = todayIso(), p = parts(today);
  return p.y === y && p.m === m ? today : monthGrid(y, m).flat().find(d => parts(d).m === m);
}

function drawDay(el, tasks, showPerson) {
  const d = calState.sel;
  const ev = [];
  tasks.forEach(t => {
    const [a, b] = taskSpan(t);
    if (t.due_date === d) ev.push({ t, k: 'due', o: 0 });
    else if (taskStart(t) === d) ev.push({ t, k: 'start', o: 1 });
    else if (t.approved_at && t.approved_at.slice(0, 10) === d) ev.push({ t, k: 'ok', o: 2 });
    else if (a < d && d < b) ev.push({ t, k: 'run', o: 3 });
  });
  ev.sort((p, q) => p.o - q.o);
  const KL = { due: L('تحویل', 'Due'), start: L('شروع', 'Starts'), ok: L('تایید شد', 'Approved'), run: L('در جریان', 'Ongoing') };
  el.innerHTML = `<div class="card-h"><div class="day-ttl">${fmt(d, { style: 'long', weekday: true })}<small>${fmt(d, { cal: secondaryCal(), style: 'long' })}</small></div>
      <span class="sp"></span>${isAdmin() ? `<button class="btn btn-sm btn-primary" id="addOnDay" title="${L('تسک جدید از این روز', 'New task starting this day')}">${icon('plus')}</button>` : ''}</div>
    <div class="card-b" style="padding-block:4px">${ev.length ? ev.map(({ t, k }) => `
      <div class="ev" data-task="${t.id}">${checkBox(t.status)}
        <div style="flex:1;min-width:0"><div class="t">${esc(t.title)}</div>
          <div class="s"><span class="kind ${k}">${KL[k]}</span>${statusPill(t.status)}${isLate(t) ? `<span class="pill pr-urgent">${L('تاخیر', 'Overdue')}</span>` : ''}
          ${showPerson ? `<span class="who-inline">${avatar(person(t.assignee_id), 'sm')}${esc(nm(person(t.assignee_id)))}</span>` : ''}</div>
          ${t.project_id ? `<div class="s" dir="auto">${esc(projectName(t.project_id))}</div>` : ''}
          <div class="s num">${fmt(taskStart(t), { style: 'dm' })} ${L('←', '→')} ${t.due_date ? fmt(t.due_date, { style: 'dm' }) : '…'}</div>
        </div></div>`).join('') : `<div class="empty">${L('برای این روز تسکی نیست', 'Nothing on this day')}</div>`}</div>`;
  $$('[data-task]', el).forEach(x => x.addEventListener('click', () => openTask(+x.dataset.task)));
  $('#addOnDay', el)?.addEventListener('click', () => editTask(null, { start_date: d }));
}

// ---------------------------------------------------------------- board
function drawBoard(el, list) {
  const prioRank = { urgent: 0, high: 1, normal: 2, low: 3 };
  el.innerHTML = `${!isAdmin() ? `<p class="small muted" style="margin:-6px 0 14px">${L('روی هر تسک کلیک کنید تا جزئیات را ببینید، کامنت بگذارید یا درخواست تایید بدهید. تیک سبز فقط بعد از تایید مدیر زده می‌شود.', 'Open a task to see details, comment, or request approval. The green tick appears only after the manager approves.')}</p>` : ''}
  <div class="board">${STATUS_KEYS.map(s => {
    const col = list.filter(t => t.status === s).sort((a, b) =>
      s === 'done' ? (b.approved_at || '').localeCompare(a.approved_at || '')
        : (prioRank[a.priority] - prioRank[b.priority]) || (a.due_date || '9').localeCompare(b.due_date || '9'));
    return `<div class="col"><div class="col-h"><span class="dot" style="background:${STATUS_COLOR[s]}"></span>${STATUS(s)}<span class="cnt">${n(col.length)}</span></div>
      ${col.map(taskCard).join('') || '<div class="empty small" style="padding:14px 4px">—</div>'}</div>`;
  }).join('')}</div>`;
  $$('[data-task]', el).forEach(x => x.addEventListener('click', () => openTask(+x.dataset.task)));
}
function taskCard(t) {
  const p = person(t.assignee_id);
  return `<button class="tcard" data-task="${t.id}">
    <div class="t-top">${checkBox(t.status)}<div style="flex:1;min-width:0">
      <div class="t-title">${esc(t.title)}</div>
      ${t.project_id ? `<div class="t-proj">${esc(projectName(t.project_id))}</div>` : ''}</div></div>
    <div class="t-meta">
      ${isAdmin() ? `<span class="who-inline">${avatar(p, 'sm')}<span>${esc(nm(p))}</span></span>` : ''}
      ${t.priority !== 'normal' ? prioPill(t.priority) : ''}
      ${t.due_date ? `<span class="due ${isLate(t) ? 'late' : ''}">⚑ ${fmt(t.due_date, { style: 'dm' })}</span>` : ''}
    </div>
    ${t.status === 'in_progress' ? `<div class="bar"><i style="width:${t.progress}%"></i></div>` : ''}
  </button>`;
}

// ---------------------------------------------------------------- task detail modal
async function openTask(id) {
  let t = S.tasks.find(x => x.id === id);
  if (!t) { const all = await api.listTasks(); t = all.find(x => x.id === id); }
  if (!t) return toast(L('تسک پیدا نشد', 'Task not found'), 'bad');
  const admin = isAdmin();
  const p = person(t.assignee_id);
  const mine = t.assignee_id === S.me.id;
  const comments = await api.listComments(t.id);

  let approval = '';
  if (t.status === 'done') {
    approval = `<div class="approve-box ok"><b>✓ ${L('تایید شده', 'Approved')}</b> <span class="small muted">${L('توسط', 'by')} ${esc(nm(person(t.approved_by)))} · ${t.approved_at ? timeAgo(t.approved_at) : ''}</span>
      ${admin ? `<div class="acts"><button class="btn btn-sm" data-act="unapprove">${icon('undo')} ${L('لغو تایید', 'Revoke approval')}</button></div>` : ''}</div>`;
  } else if (t.status === 'pending_approval') {
    approval = admin
      ? `<div class="approve-box"><b>${L('این تسک منتظر تایید شماست.', 'This task is waiting for your approval.')}</b><div class="small muted">${L('برای رد، دلیل را در کادر کامنت پایین بنویسید و «رد و برگشت» را بزنید.', 'To decline, write the reason in the comment box below and press “Decline”.')}</div>
          <div class="acts"><button class="btn btn-green" data-act="approve">${icon('check')} ${L('تایید نهایی', 'Approve')}</button><button class="btn btn-danger" data-act="reject">${icon('undo')} ${L('رد و برگشت', 'Decline')}</button></div></div>`
      : `<div class="approve-box"><b>${L('درخواست تایید ارسال شده است.', 'Approval requested.')}</b><div class="small muted">${L('تا وقتی مدیر تایید نکند، تیک تسک زده نمی‌شود.', 'The task is ticked only after the manager approves.')}</div>
          ${mine ? `<div class="acts"><button class="btn btn-sm" data-act="cancelreq">${icon('undo')} ${L('پس گرفتن درخواست', 'Withdraw request')}</button></div>` : ''}</div>`;
  } else if (mine || admin) {
    approval = `<div class="approve-box plain">
      <div class="field" style="margin:0"><label>${L('درصد پیشرفت', 'Progress')}: <b class="num" data-pv>${pct(t.progress)}</b></label>
        <input type="range" min="0" max="100" step="5" value="${t.progress}" data-progress></div>
      <div class="acts">
        ${t.status === 'todo' ? `<button class="btn btn-sm" data-act="start">${icon('play', 'class="flip"')} ${L('شروع کار', 'Start')}</button>` : ''}
        ${mine ? `<button class="btn btn-gold" data-act="request">${icon('send')} ${L('درخواست تایید از مدیر', 'Request approval')}</button>` : ''}
        ${admin ? `<button class="btn btn-green btn-sm" data-act="approve">${icon('check')} ${L('تایید مستقیم', 'Approve now')}</button>` : ''}
      </div></div>`;
  }

  const thread = comments.map(c => c.kind === 'system'
    ? `<div class="sys"><span>${esc(sysText(c.body))} · ${esc(nm(person(c.author_id)))} · ${timeAgo(c.created_at)}</span></div>`
    : `<div class="cmt ${c.author_id === S.me.id ? 'mine' : ''}">${avatar(person(c.author_id), 'sm')}<div class="bub">
        <div class="h"><b>${esc(nm(person(c.author_id)))}</b><span>${timeAgo(c.created_at)}</span>
        ${admin ? `<button class="icon-btn" style="margin-inline-start:auto;padding:0" data-delc="${c.id}" title="${L('حذف', 'Delete')}">${icon('trash', 'style="width:14px;height:14px"')}</button>` : ''}</div>
        <div class="body" dir="auto">${esc(c.body)}</div></div></div>`).join('');

  modal({
    title: esc(t.title), wide: true,
    body: `
      <div class="task-head">${checkBox(t.status)} ${statusPill(t.status)} ${prioPill(t.priority)} ${isLate(t) ? `<span class="pill pr-urgent">${L('تاخیر', 'Overdue')}</span>` : ''}</div>
      <div class="kv">
        <div><div class="k">${L('مسئول', 'Assignee')}</div><div class="v"><span class="who-inline">${avatar(p, 'sm')}<span>${esc(nm(p))}</span></span></div></div>
        <div><div class="k">${L('پروژه / قرارداد', 'Project')}</div><div class="v">${esc(projectName(t.project_id) || '—')}</div></div>
        <div><div class="k">${L('شروع', 'Start')}</div><div class="v num">${fmt2(taskStart(t))}</div></div>
        <div><div class="k">${L('موعد تحویل', 'Due')}</div><div class="v num" style="${isLate(t) ? 'color:var(--red)' : ''}">${fmt2(t.due_date)}</div></div>
      </div>
      ${t.description ? `<div class="desc" dir="auto">${esc(t.description)}</div>` : ''}
      ${approval}
      <h4 style="margin:18px 0 0;font-size:.95rem">${L('گفتگو و تاریخچه', 'Discussion & history')}</h4>
      <div class="thread" id="thread">${thread || `<div class="empty small">${L('هنوز کامنتی ثبت نشده', 'No comments yet')}</div>`}</div>
      ${t.status !== 'done' || admin ? `<div class="compose"><textarea class="input" id="cbody" dir="auto" placeholder="${L('کامنت، گزارش کار یا سوال…', 'Comment, progress note or question…')}" rows="2"></textarea>
        <button class="btn btn-primary" data-act="comment">${icon('send')} ${L('ارسال', 'Send')}</button></div>` : ''}`,
    footer: admin
      ? `<button class="btn" data-act="edit">${icon('edit')} ${L('ویرایش', 'Edit')}</button><button class="btn btn-danger" data-act="delete">${icon('trash')} ${L('حذف', 'Delete')}</button><span class="sp"></span><button class="btn" data-close>${L('بستن', 'Close')}</button>`
      : `<span class="sp"></span><button class="btn" data-close>${L('بستن', 'Close')}</button>`,
    onMount: ctx => {
      const th = ctx.$('#thread'); th.scrollTop = th.scrollHeight;
      const reopen = async () => { ctx.close(); await route(); openTask(t.id); };
      const upd = (btn, patch, msg) => run(btn, async () => { await api.updateTask(t.id, patch); toast(msg, 'ok'); await reopen(); });
      const rng = ctx.$('[data-progress]');
      if (rng) {
        rng.addEventListener('input', () => { ctx.$('[data-pv]').textContent = pct(rng.value); });
        rng.addEventListener('change', () => run(null, async () => {
          const patch = { progress: +rng.value };
          if (t.status === 'todo' && +rng.value > 0) patch.status = 'in_progress';
          await api.updateTask(t.id, patch);
          const x = S.tasks.find(y => y.id === t.id); if (x) Object.assign(x, patch);
          toast(L('پیشرفت ذخیره شد', 'Progress saved'), 'ok');
          if (patch.status) await reopen();
        }));
      }
      ctx.$$('[data-act]').forEach(b => b.addEventListener('click', async () => {
        const a = b.dataset.act;
        if (a === 'start') upd(b, { status: 'in_progress' }, L('کار روی تسک شروع شد', 'Work started'));
        if (a === 'request') {
          const body = ctx.$('#cbody')?.value.trim();
          run(b, async () => {
            if (body) await api.addComment(t.id, body);
            await api.updateTask(t.id, { status: 'pending_approval', progress: 100 });
            toast(L('درخواست تایید برای مدیر ارسال شد', 'Approval request sent'), 'ok'); await reopen();
          });
        }
        if (a === 'cancelreq') upd(b, { status: 'in_progress' }, L('درخواست پس گرفته شد', 'Request withdrawn'));
        if (a === 'approve') upd(b, { status: 'done' }, L('تسک تایید شد', 'Task approved'));
        if (a === 'unapprove') upd(b, { status: 'in_progress' }, L('تایید لغو شد', 'Approval revoked'));
        if (a === 'reject') {
          const body = ctx.$('#cbody').value.trim();
          if (!body) { ctx.$('#cbody').focus(); return toast(L('دلیل رد را در کادر کامنت بنویسید', 'Write the reason in the comment box'), 'bad'); }
          run(b, async () => { await api.addComment(t.id, body); await api.updateTask(t.id, { status: 'in_progress' }); toast(L('تسک برگشت داده شد', 'Task sent back'), 'ok'); await reopen(); });
        }
        if (a === 'comment') {
          const body = ctx.$('#cbody').value.trim();
          if (!body) return;
          run(b, async () => { await api.addComment(t.id, body); await reopen(); });
        }
        if (a === 'edit') { ctx.close(); editTask(t); }
        if (a === 'delete') {
          if (await confirmDialog(L(`تسک «${esc(t.title)}» و همه کامنت‌هایش حذف شود؟`, `Delete “${esc(t.title)}” and all its comments?`), { okText: L('حذف', 'Delete'), danger: true })) {
            run(b, async () => { await api.deleteTask(t.id); ctx.close(); toast(L('حذف شد', 'Deleted')); rerender(); });
          }
        }
      }));
      ctx.$$('[data-delc]').forEach(b => b.addEventListener('click', () => run(b, async () => { await api.deleteComment(+b.dataset.delc); await reopen(); })));
      ctx.$('#cbody')?.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ctx.$('[data-act=comment]').click(); });
    },
  });
}

function editTask(t, defaults = {}) {
  const isNew = !t;
  t = t || { title: '', description: '', priority: 'normal', status: 'todo', progress: 0, start_date: todayIso(), ...defaults };
  const members = S.people.filter(p => p.active);
  modal({
    title: isNew ? L('تسک جدید', 'New task') : L('ویرایش تسک', 'Edit task'),
    body: `<form id="tf">
      <div class="field"><label>${L('عنوان تسک', 'Title')} *</label><input class="input" name="title" dir="auto" value="${esc(t.title)}" required maxlength="200"></div>
      <div class="field"><label>${L('توضیحات', 'Description')}</label><textarea class="input" name="description" dir="auto" rows="3">${esc(t.description)}</textarea></div>
      <div class="row">
        <div class="field"><label>${L('مسئول انجام', 'Assignee')} *</label><select class="input" name="assignee_id" required><option value="">${L('انتخاب…', 'Choose…')}</option>
          ${members.map(p => `<option value="${p.id}" ${p.id === t.assignee_id ? 'selected' : ''}>${esc(nm(p))}${p.role === 'admin' ? L(' (مدیر)', ' (manager)') : ''}</option>`).join('')}</select></div>
        <div class="field"><label>${L('پروژه / قرارداد', 'Project / contract')}</label><select class="input" name="project_id"><option value="">${L('— بدون پروژه —', '— none —')}</option>
          ${S.projects.map(p => `<option value="${p.id}" ${p.id === t.project_id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>${L('تاریخ شروع (واگذاری)', 'Start (assigned) date')}</label>${dateInput('start_date', taskStart(t))}</div>
        <div class="field"><label>${L('موعد تحویل', 'Due date')}</label>${dateInput('due_date', t.due_date)}</div>
      </div>
      <div class="row">
        <div class="field"><label>${L('اولویت', 'Priority')}</label><select class="input" name="priority">${PRIORITY_KEYS.map(k => `<option value="${k}" ${k === t.priority ? 'selected' : ''}>${PRIORITY(k)}</option>`).join('')}</select></div>
        <div class="field"><label>${L('وضعیت', 'Status')}</label><select class="input" name="status">${STATUS_KEYS.map(k => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${STATUS(k)}</option>`).join('')}</select></div>
      </div>
      <div class="hint">${L('تاریخ را شمسی یا میلادی بنویسید (مثلاً ۱۴۰۵/۰۸/۲۰ یا 2026-11-11) یا از تقویم انتخاب کنید.', 'Type a Gregorian or Persian date (e.g. 2026-11-11 or 1405/08/20) or pick it from the calendar.')}</div>
      <div class="err" id="terr"></div>
    </form>`,
    footer: `<button class="btn btn-primary" data-save>${icon('check')} ${isNew ? L('ایجاد تسک', 'Create task') : L('ذخیره', 'Save')}</button><button class="btn" data-close>${L('انصراف', 'Cancel')}</button>`,
    onMount: ctx => {
      const form = ctx.$('#tf');
      const save = () => {
        if (!form.reportValidity()) return;
        const sd = readDate(form, 'start_date'), due = readDate(form, 'due_date');
        if (!sd.ok || !due.ok) return (ctx.$('#terr').textContent = L('تاریخ نامعتبر است', 'Invalid date'));
        if (sd.iso && due.iso && due.iso < sd.iso) return (ctx.$('#terr').textContent = L('موعد تحویل قبل از تاریخ شروع است', 'Due date is before the start date'));
        const data = {
          ...(isNew ? {} : { id: t.id }),
          title: form.title.value.trim(), description: form.description.value.trim(),
          assignee_id: form.assignee_id.value, project_id: form.project_id.value ? +form.project_id.value : null,
          priority: form.priority.value, start_date: sd.iso || todayIso(), due_date: due.iso, status: form.status.value,
        };
        run(ctx.$('[data-save]'), async () => {
          const saved = await api.saveTask(data);
          ctx.close(); toast(isNew ? L('تسک ایجاد شد', 'Task created') : L('ذخیره شد', 'Saved'), 'ok');
          await rerender(); if (!isNew) openTask(saved.id);
        });
      };
      ctx.$('[data-save]').addEventListener('click', save);
      form.addEventListener('submit', e => { e.preventDefault(); save(); });
    },
  });
}

// =====================================================================
//  حضور و غیاب — همکار
// =====================================================================
async function viewAttendanceMe(v) {
  const today = todayIso();
  const from = monthStart(today);
  const rows = await api.listAttendance({ userId: S.me.id, from: addDaysIso(from, -31), to: today });
  const rec = rows.find(r => r.work_date === today) || { user_id: S.me.id, work_date: today, check_in: null, check_out: null, breaks: [], note: '' };
  const monthTotal = rows.filter(r => r.work_date >= from).reduce((s, r) => s + (workedMinutes(r) || 0), 0);
  const weekTotal = rows.filter(r => r.work_date >= weekStart(today)).reduce((s, r) => s + (workedMinutes(r) || 0), 0);

  const st = presence(rec);
  const open = (rec.breaks || []).find(b => !b.end);
  const stateText = {
    absent: L('هنوز ورود امروز را ثبت نکرده‌اید.', 'You haven’t checked in today.'),
    in: L(`از ساعت ${fmtTime(rec.check_in)} مشغول کار هستید.`, `Working since ${rec.check_in}.`),
    break: L(`در حال استراحت از ساعت ${fmtTime(open?.start)}`, `On break since ${open?.start}`),
    out: L(`امروز ساعت ${fmtTime(rec.check_out)} خروج زده‌اید.`, `You checked out at ${rec.check_out}.`),
  }[st];

  v.innerHTML = `
  <div class="clock-card">
    <div><div class="big num" id="bigClock">${n(nowTime())}</div><div class="d">${fmt(today, { style: 'long', weekday: true })}<span class="cal2">${fmt(today, { cal: secondaryCal(), style: 'long' })}</span></div></div>
    <div>
      <div class="state">${stateText}</div>
      <div class="acts">
        ${st === 'absent' ? `<button class="btn go" data-a="in">${icon('login', 'class="flip"')} ${L('ثبت ورود', 'Check in')}</button>` : ''}
        ${st === 'in' ? `<button class="btn brk" data-a="bstart">${icon('coffee')} ${L('شروع استراحت', 'Start break')}</button><button class="btn" data-a="out">${icon('logout', 'class="flip"')} ${L('ثبت خروج', 'Check out')}</button>` : ''}
        ${st === 'break' ? `<button class="btn go" data-a="bend">${icon('play', 'class="flip"')} ${L('پایان استراحت', 'End break')}</button>` : ''}
        ${st === 'out' ? `<button class="btn" data-a="reopen">${icon('undo')} ${L('لغو خروج', 'Undo check-out')}</button>` : ''}
        <button class="btn" data-a="edit">${icon('edit')} ${L('ویرایش دستی امروز', 'Edit today')}</button>
      </div>
    </div>
    <div class="stats">
      <div><span>${L('کار امروز', 'Today')}</span><b class="num" id="todayWork">${fmtMinutes(workedMinutes(rec) ?? 0)}</b></div>
      <div><span>${L('استراحت امروز', 'Breaks today')}</span><b class="num">${fmtMinutes(rec.check_in ? breakMinutes(rec) : 0)}</b></div>
      <div><span>${L('این هفته', 'This week')}</span><b class="num">${fmtMinutes(weekTotal)}</b></div>
      <div><span>${L('این ماه', 'This month')}</span><b class="num">${fmtMinutes(monthTotal)}</b></div>
    </div>
  </div>

  <section class="card" style="margin-top:20px">
    <div class="card-h"><h3>${L('سوابق اخیر', 'Recent days')}</h3><span class="sp"></span><button class="btn btn-sm" id="addDay">${icon('plus')} ${L('ثبت روز دیگر', 'Add another day')}</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${L('تاریخ', 'Date')}</th><th>${L('ورود', 'In')}</th><th>${L('استراحت', 'Breaks')}</th><th>${L('خروج', 'Out')}</th><th>${L('کارکرد', 'Worked')}</th><th>${L('توضیح', 'Note')}</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr class="click" data-day="${r.work_date}">
        <td>${fmt(r.work_date, { style: 'long', weekday: true })}<span class="cal2">${fmt(r.work_date, { cal: secondaryCal(), style: 'dm' })}</span></td><td class="num">${fmtTime(r.check_in)}</td>
        <td class="num small">${(r.breaks || []).map(brText).join(sep()) || '—'}</td>
        <td class="num">${fmtTime(r.check_out)}</td><td class="num"><b>${fmtMinutes(workedMinutes(r))}</b></td>
        <td class="small muted">${esc(r.note)}</td><td class="acts"><button class="icon-btn">${icon('edit')}</button></td></tr>`).join('')
        || `<tr><td colspan="7" class="empty">${L('هنوز ساعتی ثبت نشده', 'Nothing recorded yet')}</td></tr>`}</tbody>
    </table></div>
  </section>`;

  clockTimer = setInterval(() => {
    const c = $('#bigClock'); if (!c) return clearInterval(clockTimer);
    c.textContent = n(nowTime());
    if (st === 'in' || st === 'break') $('#todayWork').textContent = fmtMinutes(workedMinutes(rec) ?? 0);
  }, 15000);

  const save = (btn, r, msg) => run(btn, async () => { await api.saveAttendance(r); toast(msg, 'ok'); rerender(); });
  $$('[data-a]', v).forEach(b => b.addEventListener('click', () => {
    const t = nowTime();
    const r = { ...rec, breaks: (rec.breaks || []).map(x => ({ ...x })) };
    switch (b.dataset.a) {
      case 'in': r.check_in = t; return save(b, r, L(`ورود ساعت ${n(t)} ثبت شد`, `Checked in at ${t}`));
      case 'bstart': r.breaks.push({ start: t, end: null }); return save(b, r, L('استراحت شروع شد', 'Break started'));
      case 'bend': r.breaks[r.breaks.length - 1].end = t; return save(b, r, L('استراحت تمام شد', 'Break ended'));
      case 'out': r.check_out = t; return save(b, r, L(`خروج ساعت ${n(t)} ثبت شد`, `Checked out at ${t}`));
      case 'reopen': r.check_out = null; return save(b, r, L('خروج لغو شد', 'Check-out undone'));
      case 'edit': return editAttendance(rec);
    }
  }));
  $('#addDay').addEventListener('click', () => editAttendance({ user_id: S.me.id, work_date: null, breaks: [] }, { pickDate: true }));
  $$('[data-day]', v).forEach(tr => tr.addEventListener('click', () => editAttendance(rows.find(r => r.work_date === tr.dataset.day))));
}

function editAttendance(rec, { pickDate = false, pickUser = false } = {}) {
  const r = { check_in: '', check_out: '', note: '', ...rec, breaks: (rec.breaks || []).map(b => ({ ...b })) };
  const brRow = (b = {}) => `<div class="br"><input class="input" type="time" data-bs value="${b.start || ''}"><span class="muted">${L('تا', 'to')}</span><input class="input" type="time" data-be value="${b.end || ''}"><button type="button" class="icon-btn" data-rm>${icon('x')}</button></div>`;
  const members = S.people.filter(p => p.active);
  modal({
    title: pickDate ? L('ثبت ساعت کاری', 'Record work hours') : `${L('ساعت کاری', 'Hours for')} ${fmt(r.work_date, { style: 'long', weekday: true })}`,
    body: `<form id="af">
      ${pickUser ? `<div class="field"><label>${L('همکار', 'Member')}</label><select class="input" name="user_id" required>${members.map(p => `<option value="${p.id}" ${p.id === r.user_id ? 'selected' : ''}>${esc(nm(p))}</option>`).join('')}</select></div>` : ''}
      ${pickDate ? `<div class="field"><label>${L('تاریخ', 'Date')} *</label>${dateInput('work_date', r.work_date || todayIso(), { required: true })}</div>` : ''}
      <div class="row"><div class="field"><label>${L('ساعت ورود', 'Check-in')}</label><input class="input" type="time" name="check_in" value="${r.check_in || ''}"></div>
      <div class="field"><label>${L('ساعت خروج', 'Check-out')}</label><input class="input" type="time" name="check_out" value="${r.check_out || ''}"></div></div>
      <div class="field"><label>${L('استراحت‌ها', 'Breaks')}</label><div class="breaks-ed" id="brs">${r.breaks.map(brRow).join('')}</div>
        <button type="button" class="btn btn-sm" id="addBr" style="align-self:flex-start;margin-top:6px">${icon('plus')} ${L('افزودن استراحت', 'Add break')}</button></div>
      <div class="field"><label>${L('توضیح (اختیاری)', 'Note (optional)')}</label><input class="input" name="note" dir="auto" value="${esc(r.note)}" placeholder="${L('مثلاً دورکاری، ماموریت…', 'e.g. remote, field trip…')}"></div>
      <div class="err" id="aerr"></div></form>`,
    footer: `<button class="btn btn-primary" data-save>${icon('check')} ${L('ذخیره', 'Save')}</button><button class="btn" data-close>${L('انصراف', 'Cancel')}</button>
      ${r.id ? `<span class="sp"></span><button class="btn btn-danger" data-del>${icon('trash')} ${L('حذف این روز', 'Delete day')}</button>` : ''}`,
    onMount: ctx => {
      const wireRm = () => ctx.$$('[data-rm]').forEach(b => { b.onclick = () => b.parentElement.remove(); });
      wireRm();
      ctx.$('#addBr').addEventListener('click', () => { ctx.$('#brs').insertAdjacentHTML('beforeend', brRow()); wireRm(); });
      const err = m => (ctx.$('#aerr').textContent = m);
      ctx.$('[data-save]').addEventListener('click', e => {
        const f = ctx.$('#af');
        let work_date = r.work_date;
        if (pickDate) { const d = readDate(f, 'work_date'); if (!d.ok || !d.iso) return err(L('تاریخ نامعتبر است', 'Invalid date')); work_date = d.iso; }
        if (work_date > todayIso()) return err(L('ثبت ساعت برای روزهای آینده ممکن نیست', 'Cannot record hours for future days'));
        const ci = f.check_in.value, co = f.check_out.value;
        if (co && !ci) return err(L('بدون ساعت ورود نمی‌توان خروج ثبت کرد', 'Add a check-in time first'));
        if (ci && co && co <= ci) return err(L('ساعت خروج باید بعد از ورود باشد', 'Check-out must be after check-in'));
        const breaks = ctx.$$('.br').map(x => ({ start: x.querySelector('[data-bs]').value, end: x.querySelector('[data-be]').value || null })).filter(b => b.start);
        for (const b of breaks) {
          if (b.end && b.end <= b.start) return err(L('پایان استراحت باید بعد از شروع آن باشد', 'A break must end after it starts'));
          if (ci && b.start < ci) return err(L('استراحت نمی‌تواند قبل از ورود باشد', 'A break cannot start before check-in'));
          if (co && (b.end || b.start) > co) return err(L('استراحت نمی‌تواند بعد از خروج باشد', 'A break cannot end after check-out'));
        }
        const user_id = pickUser ? f.user_id.value : r.user_id;
        run(e.currentTarget, async () => {
          await api.saveAttendance({ user_id, work_date, check_in: ci || null, check_out: co || null, breaks, note: f.note.value.trim() });
          ctx.close(); toast(L('ذخیره شد', 'Saved'), 'ok'); rerender();
        });
      });
      ctx.$('[data-del]')?.addEventListener('click', async () => {
        if (await confirmDialog(L('سابقه این روز حذف شود؟', 'Delete this day’s record?'), { okText: L('حذف', 'Delete'), danger: true }))
          run(null, async () => { await api.deleteAttendance(r.id); ctx.close(); toast(L('حذف شد', 'Deleted')); rerender(); });
      });
    },
  });
}

// =====================================================================
//  حضور و غیاب — گزارش مدیر
// =====================================================================
async function viewAttendanceAdmin(v, params) {
  const today = todayIso();
  const st = { range: params.range || 'week', person: params.person || '', from: '', to: today };
  const members = S.people.filter(p => p.active);
  v.innerHTML = `
  <div class="toolbar">
    <div class="seg" id="rng">
      <button data-r="today">${L('امروز', 'Today')}</button><button data-r="week">${L('این هفته', 'This week')}</button><button data-r="month">${L('این ماه', 'This month')}</button><button data-r="30">${L('۳۰ روز اخیر', 'Last 30 days')}</button><button data-r="custom">${L('بازه دلخواه', 'Custom')}</button>
    </div>
    <span id="custom" class="hidden" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span style="width:170px">${dateInput('cf', addDaysIso(today, -30))}</span><span class="muted">${L('تا', 'to')}</span>
      <span style="width:170px">${dateInput('ct', today)}</span><button class="btn btn-sm" id="capply">${L('اعمال', 'Apply')}</button>
    </span>
    <select class="input" id="fp"><option value="">${L('همه همکاران', 'Everyone')}</option>${members.map(p => `<option value="${p.id}">${esc(nm(p))}</option>`).join('')}</select>
    <span class="grow"></span>
    <button class="btn" id="csv">${icon('download')} ${L('خروجی Excel (CSV)', 'Export CSV')}</button>
    <button class="btn btn-primary" id="addAtt">${icon('plus')} ${L('ثبت دستی', 'Add record')}</button>
  </div>
  <div id="attBody"><div class="loading"><div class="spinner"></div></div></div>`;
  wireDateInputs($('#custom'));
  $('#fp').value = st.person;
  let lastRows = [];

  const compute = () => {
    if (st.range === 'today') st.from = today;
    if (st.range === 'week') st.from = weekStart(today);
    if (st.range === 'month') st.from = monthStart(today);
    if (st.range === '30') st.from = addDaysIso(today, -29);
    if (st.range !== 'custom') st.to = today;
    $$('#rng button').forEach(b => b.classList.toggle('on', b.dataset.r === st.range));
    $('#custom').classList.toggle('hidden', st.range !== 'custom');
  };
  const load = async () => {
    compute();
    const body = $('#attBody');
    const rows = await api.listAttendance({ from: st.from, to: st.to, userId: st.person || undefined });
    lastRows = rows;
    const people = st.person ? members.filter(m => m.id === st.person) : members.filter(m => m.role !== 'admin' || rows.some(r => r.user_id === m.id));
    const sum = people.map(m => {
      const rs = rows.filter(r => r.user_id === m.id);
      return { m, days: rs.filter(r => r.check_in).length, mins: rs.reduce((s, r) => s + (workedMinutes(r) || 0), 0), avgIn: avgTime(rs.map(r => r.check_in).filter(Boolean)) };
    });
    body.innerHTML = `
    <div class="grid g-3" style="margin-bottom:18px">
      ${sum.map(s => `<div class="card card-b" style="display:flex;gap:12px;align-items:center">${avatar(s.m)}
        <div style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(nm(s.m))}</b>
        <span class="small muted num">${L(`${n(s.days)} روز · میانگین ورود ${s.avgIn ? n(s.avgIn) : '—'}`, `${s.days} days · avg. in ${s.avgIn || '—'}`)}</span></div>
        <div style="text-align:end"><div class="num" style="font-size:1.35rem;font-weight:800">${fmtMinutes(s.mins)}</div><div class="small muted">${L('ساعت کار', 'hours')}</div></div></div>`).join('') || '<div class="empty">—</div>'}
    </div>
    <section class="card"><div class="card-h"><h3>${L('جزئیات', 'Details')}</h3><span class="sp"></span><span class="small muted num">${fmt(st.from)} ${L('تا', '→')} ${fmt(st.to)}</span></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${L('همکار', 'Member')}</th><th>${L('تاریخ', 'Date')}</th><th>${L('ورود', 'In')}</th><th>${L('استراحت', 'Breaks')}</th><th>${L('خروج', 'Out')}</th><th>${L('کارکرد', 'Worked')}</th><th>${L('وضعیت', 'Status')}</th><th>${L('توضیح', 'Note')}</th><th></th></tr></thead>
      <tbody>${rows.map(r => { const m = person(r.user_id); return `<tr class="click" data-id="${r.id}">
        <td><span class="who-inline">${avatar(m, 'sm')}<span>${esc(nm(m))}</span></span></td>
        <td>${fmt(r.work_date, { style: 'long', weekday: true })}<span class="cal2">${fmt(r.work_date, { cal: secondaryCal(), style: 'dm' })}</span></td><td class="num">${fmtTime(r.check_in)}</td>
        <td class="num small">${(r.breaks || []).map(brText).join(sep()) || '—'}</td>
        <td class="num">${fmtTime(r.check_out)}</td><td class="num"><b>${fmtMinutes(workedMinutes(r))}</b></td>
        <td>${r.work_date === today ? presencePill(presence(r)) : (r.check_in && !r.check_out ? `<span class="pill pr-high">${L('خروج ثبت نشده', 'No check-out')}</span>` : '')}</td>
        <td class="small muted">${esc(r.note)}</td><td class="acts"><button class="icon-btn">${icon('edit')}</button></td></tr>`; }).join('')
        || `<tr><td colspan="9" class="empty">${L('در این بازه ساعتی ثبت نشده', 'Nothing recorded in this range')}</td></tr>`}</tbody>
      ${rows.length ? `<tfoot><tr><td colspan="5">${L('جمع کل', 'Total')}</td><td class="num">${fmtMinutes(rows.reduce((s, r) => s + (workedMinutes(r) || 0), 0))}</td><td colspan="3"></td></tr></tfoot>` : ''}
    </table></div></section>`;
    $$('[data-id]', body).forEach(tr => tr.addEventListener('click', () => editAttendance(rows.find(r => r.id === +tr.dataset.id), {})));
  };
  $$('#rng button').forEach(b => b.addEventListener('click', () => { st.range = b.dataset.r; if (st.range !== 'custom') load(); else compute(); }));
  $('#capply').addEventListener('click', () => {
    const a = readDate($('#custom'), 'cf'), b = readDate($('#custom'), 'ct');
    if (!a.iso || !b.iso || a.iso > b.iso) return toast(L('بازه تاریخ نامعتبر است', 'Invalid date range'), 'bad');
    st.from = a.iso; st.to = b.iso; load();
  });
  $('#fp').addEventListener('change', e => { st.person = e.target.value; load(); });
  $('#addAtt').addEventListener('click', () => editAttendance({ user_id: st.person || members[0]?.id, work_date: null, breaks: [] }, { pickDate: true, pickUser: true }));
  $('#csv').addEventListener('click', () => {
    const head = isFa()
      ? ['همکار', 'نام کاربری', 'تاریخ شمسی', 'تاریخ میلادی', 'ورود', 'خروج', 'استراحت‌ها', 'دقیقه استراحت', 'کارکرد (ساعت:دقیقه)', 'کارکرد (ساعت اعشاری)', 'توضیح']
      : ['Member', 'Username', 'Persian date', 'Gregorian date', 'In', 'Out', 'Breaks', 'Break minutes', 'Worked (h:mm)', 'Worked (hours)', 'Note'];
    const jal = iso => { const p = parts(iso, 'jalali'); return `${p.y}/${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}`; };
    const out = lastRows.slice().reverse().map(r => {
      const m = person(r.user_id); const w = workedMinutes(r);
      return [nm(m), m?.username, jal(r.work_date), r.work_date, r.check_in || '', r.check_out || '',
        (r.breaks || []).map(b => `${b.start}-${b.end || ''}`).join(' | '), r.check_in ? breakMinutes(r) : '',
        w == null ? '' : `${Math.floor(w / 60)}:${String(w % 60).padStart(2, '0')}`, w == null ? '' : (w / 60).toFixed(2), r.note];
    });
    downloadCsv(`attendance_${st.from}_${st.to}.csv`, [head, ...out]);
  });
  await load();
}
function avgTime(list) {
  if (!list.length) return '';
  const m = Math.round(list.reduce((s, t) => s + toMin(t), 0) / list.length);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// =====================================================================
//  پروژه‌ها و قراردادها
// =====================================================================
async function viewProjects(v) {
  const admin = isAdmin();
  const st = { kind: '', status: '', q: '' };
  v.innerHTML = `
  <div class="toolbar">
    <div class="seg" id="kinds"><button data-k="" class="on">${L('همه', 'All')}</button><button data-k="project">${L('پروژه‌ها', 'Projects')}</button><button data-k="contract">${L('قراردادها', 'Contracts')}</button></div>
    <select class="input" id="pst"><option value="">${L('همه وضعیت‌ها', 'All statuses')}</option>${PROJ_KEYS.map(k => `<option value="${k}">${PROJ_STATUS(k)}</option>`).join('')}</select>
    <input class="input" id="pq" placeholder="${L('جستجو…', 'Search…')}">
    <span class="grow"></span>
    ${admin ? `<button class="btn btn-primary" id="newProj">${icon('plus')} ${L('پروژه / قرارداد جدید', 'New project / contract')}</button>` : ''}
  </div>
  ${admin ? '' : `<p class="small muted" style="margin:-6px 0 14px">${L('فهرست کارهای جاری شرکت. ویرایش این بخش فقط با مدیر است.', 'Company work list. Only the manager can edit it.')}</p>`}
  <div class="proj-grid" id="pgrid"></div>`;

  const draw = () => {
    const q = st.q.toLowerCase();
    const list = S.projects.filter(p => (!st.kind || p.kind === st.kind) && (!st.status || p.status === st.status)
      && (!q || p.title.toLowerCase().includes(q) || (p.employer || '').toLowerCase().includes(q) || (p.contract_no || '').includes(st.q)));
    const order = { active: 0, negotiation: 1, paused: 2, done: 3, cancelled: 4 };
    list.sort((a, b) => order[a.status] - order[b.status]);
    $('#pgrid').innerHTML = list.map(p => {
      const pt = S.tasks.filter(t => t.project_id === p.id);
      const done = pt.filter(t => t.status === 'done').length;
      return `<article class="card pcard">
        <div class="top">${kindTag(p.kind)} ${projPill(p.status)}</div>
        <h4 dir="auto">${esc(p.title)}</h4>
        ${p.description ? `<div class="small muted" dir="auto" style="white-space:pre-wrap">${esc(p.description)}</div>` : ''}
        <div class="meta">
          <div><span class="k">${L('کارفرما', 'Client')}: </span>${esc(p.employer || '—')}</div>
          <div><span class="k">${L('شماره قرارداد', 'Contract no.')}: </span><span class="num">${esc(n(p.contract_no) || '—')}</span></div>
          <div><span class="k">${L('شروع', 'Start')}: </span><span class="num">${fmt2(p.start_date)}</span></div>
          <div><span class="k">${L('پایان', 'End')}: </span><span class="num">${fmt2(p.end_date)}</span></div>
        </div>
        <div><div class="small" style="display:flex;justify-content:space-between"><span class="muted">${L('پیشرفت', 'Progress')}</span><b class="num">${pct(p.progress)}</b></div><div class="bar"><i style="width:${p.progress}%"></i></div></div>
        ${admin ? `<div class="small muted num">${L(`تسک‌ها: ${n(pt.length)} (${n(done)} تایید شده)`, `Tasks: ${pt.length} (${done} approved)`)}</div>` : ''}
        ${admin && (p.amount || p.paid) ? `<div class="money"><div>${L('مبلغ قرارداد', 'Contract value')}: <b class="num">${money(p.amount)}</b></div><div>${L('دریافت شده', 'Received')}: <b class="num">${money(p.paid)}</b>${p.amount ? ` <span class="muted num">(${pct(Math.round((p.paid || 0) / p.amount * 100))})</span>` : ''}</div>${p.finance_notes ? `<div class="muted">${esc(p.finance_notes)}</div>` : ''}</div>` : ''}
        ${admin ? `<div class="foot"><button class="btn btn-sm" data-edit="${p.id}">${icon('edit')} ${L('ویرایش', 'Edit')}</button><a class="btn btn-sm btn-ghost" href="#/tasks?project=${p.id}">${L('تسک‌ها', 'Tasks')}</a><span style="flex:1"></span><button class="icon-btn" data-del="${p.id}" title="${L('حذف', 'Delete')}">${icon('trash')}</button></div>` : ''}
      </article>`;
    }).join('') || `<div class="empty card" style="grid-column:1/-1">${L('موردی ثبت نشده است', 'Nothing here yet')}</div>`;
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => editProject(S.projects.find(p => p.id === +b.dataset.edit))));
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const p = S.projects.find(x => x.id === +b.dataset.del);
      if (await confirmDialog(L(`«${esc(p.title)}» حذف شود؟ تسک‌های مرتبط باقی می‌مانند ولی از این پروژه جدا می‌شوند.`, `Delete “${esc(p.title)}”? Its tasks stay but are unlinked.`), { okText: L('حذف', 'Delete'), danger: true }))
        run(b, async () => { await api.deleteProject(p.id); toast(L('حذف شد', 'Deleted')); rerender(); });
    }));
  };
  $$('#kinds button').forEach(b => b.addEventListener('click', () => { st.kind = b.dataset.k; $$('#kinds button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  $('#pst').addEventListener('change', e => { st.status = e.target.value; draw(); });
  $('#pq').addEventListener('input', e => { st.q = e.target.value.trim(); draw(); });
  if (admin) $('#newProj').addEventListener('click', () => editProject(null));
  draw();
}

function editProject(p) {
  const isNew = !p;
  p = p || { kind: 'project', title: '', employer: '', contract_no: '', status: 'active', progress: 0, description: '' };
  modal({
    title: isNew ? L('پروژه / قرارداد جدید', 'New project / contract') : L('ویرایش', 'Edit'),
    body: `<form id="pf">
      <div class="row"><div class="field"><label>${L('نوع', 'Type')}</label><select class="input" name="kind">${['project', 'contract'].map(k => `<option value="${k}" ${k === p.kind ? 'selected' : ''}>${KIND(k)}</option>`).join('')}</select></div>
      <div class="field"><label>${L('وضعیت', 'Status')}</label><select class="input" name="status">${PROJ_KEYS.map(k => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${PROJ_STATUS(k)}</option>`).join('')}</select></div></div>
      <div class="field"><label>${L('عنوان', 'Title')} *</label><input class="input" name="title" dir="auto" required value="${esc(p.title)}"></div>
      <div class="row"><div class="field"><label>${L('کارفرما / طرف قرارداد', 'Client / counterparty')}</label><input class="input" name="employer" dir="auto" value="${esc(p.employer)}"></div>
      <div class="field"><label>${L('شماره قرارداد', 'Contract number')}</label><input class="input" name="contract_no" dir="auto" value="${esc(p.contract_no)}"></div></div>
      <div class="row"><div class="field"><label>${L('تاریخ شروع', 'Start date')}</label>${dateInput('start_date', p.start_date)}</div>
      <div class="field"><label>${L('تاریخ پایان', 'End date')}</label>${dateInput('end_date', p.end_date)}</div></div>
      <div class="field"><label>${L('پیشرفت', 'Progress')}: <b class="num" id="ppv">${pct(p.progress)}</b></label><input type="range" name="progress" min="0" max="100" step="5" value="${p.progress}"></div>
      <div class="field"><label>${L('شرح کار', 'Description')}</label><textarea class="input" name="description" dir="auto" rows="3">${esc(p.description)}</textarea></div>
      <fieldset class="fin"><legend>${L('اطلاعات مالی — فقط برای مدیر قابل مشاهده', 'Financials — visible to the manager only')}</legend>
        <div class="row"><div class="field"><label>${L('مبلغ قرارداد (ریال)', 'Contract value (IRR)')}</label><input class="input" name="amount" inputmode="numeric" value="${moneyInput(p.amount)}"></div>
        <div class="field"><label>${L('دریافت شده (ریال)', 'Received (IRR)')}</label><input class="input" name="paid" inputmode="numeric" value="${moneyInput(p.paid)}"></div></div>
        <div class="field"><label>${L('یادداشت مالی', 'Finance note')}</label><input class="input" name="finance_notes" dir="auto" value="${esc(p.finance_notes || '')}"></div>
      </fieldset>
      <div class="err" id="perr"></div></form>`,
    footer: `<button class="btn btn-primary" data-save>${icon('check')} ${L('ذخیره', 'Save')}</button><button class="btn" data-close>${L('انصراف', 'Cancel')}</button>`,
    onMount: ctx => {
      const f = ctx.$('#pf');
      f.progress.addEventListener('input', () => { ctx.$('#ppv').textContent = pct(f.progress.value); });
      ['amount', 'paid'].forEach(k => f[k].addEventListener('input', () => { f[k].value = moneyInput(parseMoney(f[k].value)); }));
      ctx.$('[data-save]').addEventListener('click', e => {
        if (!f.reportValidity()) return;
        const sd = readDate(f, 'start_date'), ed = readDate(f, 'end_date');
        if (!sd.ok || !ed.ok) return (ctx.$('#perr').textContent = L('تاریخ نامعتبر است', 'Invalid date'));
        if (sd.iso && ed.iso && ed.iso < sd.iso) return (ctx.$('#perr').textContent = L('تاریخ پایان قبل از شروع است', 'End date is before start date'));
        const data = {
          ...(isNew ? {} : { id: p.id }),
          kind: f.kind.value, status: f.status.value, title: f.title.value.trim(), employer: f.employer.value.trim(),
          contract_no: f.contract_no.value.trim(), start_date: sd.iso, end_date: ed.iso, progress: +f.progress.value,
          description: f.description.value.trim(), amount: parseMoney(f.amount.value), paid: parseMoney(f.paid.value),
          finance_notes: f.finance_notes.value.trim(),
        };
        run(e.currentTarget, async () => { await api.saveProject(data); ctx.close(); toast(L('ذخیره شد', 'Saved'), 'ok'); rerender(); });
      });
    },
  });
}

// =====================================================================
//  همکاران (فقط مدیر)
// =====================================================================
async function viewTeam(v) {
  v.innerHTML = `
  <div class="toolbar"><span class="muted small">${L('هر همکار با نام کاربری و رمز خودش وارد می‌شود و زبان و تقویم را خودش انتخاب می‌کند.', 'Each member signs in with their own username and password, and picks their own language and calendar.')}</span>
    <span class="grow"></span><button class="btn btn-primary" id="addUser">${icon('plus')} ${L('افزودن همکار', 'Add member')}</button></div>
  <section class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>${L('نام', 'Name')}</th><th>${L('نام کاربری', 'Username')}</th><th>${L('سمت', 'Role title')}</th><th>${L('نقش', 'Access')}</th><th>${L('زبان', 'Language')}</th><th>${L('تسک باز', 'Open')}</th><th>${L('تایید شده', 'Approved')}</th><th>${L('وضعیت', 'Status')}</th><th></th></tr></thead>
    <tbody>${S.people.map(p => {
      const pt = S.tasks.filter(t => t.assignee_id === p.id);
      return `<tr style="${p.active ? '' : 'opacity:.55'}">
        <td><span class="who-inline">${avatar(p, 'sm')}<span><b>${esc(nm(p))}</b>${isFa() && p.full_name_en ? `<br><span class="small muted">${esc(p.full_name_en)}</span>` : (!isFa() && p.full_name_en ? `<br><span class="small muted">${esc(p.full_name)}</span>` : '')}</span></span></td>
        <td class="ltr small">${esc(p.username)}</td><td class="small" dir="auto">${esc(p.job_title || '—')}</td>
        <td>${p.role === 'admin' ? `<span class="pill ps-done">${L('مدیر', 'Manager')}</span>` : `<span class="pill st-todo">${L('همکار', 'Member')}</span>`}</td>
        <td class="small">${p.locale === 'en' ? 'English' : 'فارسی'}</td>
        <td class="num">${n(pt.filter(t => t.status !== 'done').length)}</td><td class="num">${n(pt.filter(t => t.status === 'done').length)}</td>
        <td>${p.active ? `<span class="presence pz-in">${L('فعال', 'Active')}</span>` : `<span class="presence pz-absent">${L('غیرفعال', 'Inactive')}</span>`}</td>
        <td><div class="acts">
          <button class="btn btn-sm" data-ed="${p.id}">${icon('edit')} ${L('ویرایش', 'Edit')}</button>
          <button class="btn btn-sm" data-pw="${p.id}">${icon('key')} ${L('رمز', 'Password')}</button>
          ${p.id !== S.me.id ? `<button class="btn btn-sm ${p.active ? 'btn-danger' : ''}" data-act="${p.id}">${p.active ? icon('ban') + ' ' + L('غیرفعال', 'Deactivate') : icon('undo') + ' ' + L('فعال‌سازی', 'Activate')}</button>` : ''}
        </div></td></tr>`;
    }).join('')}</tbody></table></div></section>`;

  $('#addUser').addEventListener('click', () => userForm(null));
  $$('[data-ed]').forEach(b => b.addEventListener('click', () => userForm(person(b.dataset.ed))));
  $$('[data-pw]').forEach(b => b.addEventListener('click', () => resetPw(person(b.dataset.pw))));
  $$('[data-act]').forEach(b => b.addEventListener('click', async () => {
    const p = person(b.dataset.act);
    if (p.active && !(await confirmDialog(L(`حساب «${esc(p.full_name)}» غیرفعال شود؟ دیگر نمی‌تواند وارد شود، ولی سوابقش حفظ می‌شود.`, `Deactivate ${esc(nm(p))}? They won’t be able to sign in, but their history is kept.`), { okText: L('غیرفعال کن', 'Deactivate'), danger: true }))) return;
    run(b, async () => { await api.adminSetActive(p.id, !p.active); toast(p.active ? L('حساب غیرفعال شد', 'Account deactivated') : L('حساب فعال شد', 'Account activated'), 'ok'); rerender(); });
  }));
}

function credBox(username, pw) {
  const url = location.origin + location.pathname;
  const txt = L(`آدرس: ${url}\nنام کاربری: ${username}\nرمز عبور: ${pw}`, `Address: ${url}\nUsername: ${username}\nPassword: ${pw}`);
  modal({
    title: L('اطلاعات ورود', 'Sign-in details'),
    body: `<p style="margin-top:0">${L('این اطلاعات را برای همکار بفرستید. بعد از بستن این پنجره، رمز دوباره نمایش داده نمی‌شود.', 'Send these to the team member. The password won’t be shown again after you close this.')}</p>
      <div class="cred">${esc(txt)}</div>`,
    footer: `<button class="btn btn-primary" data-copy>${L('کپی', 'Copy')}</button><button class="btn" data-close>${L('بستن', 'Close')}</button>`,
    onMount: ctx => ctx.$('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(txt); toast(L('کپی شد', 'Copied'), 'ok'); }
      catch { toast(L('کپی خودکار ممکن نشد؛ متن را دستی کپی کنید', 'Couldn’t copy automatically — copy it by hand')); }
    }),
  });
}

function userForm(u) {
  const isNew = !u;
  u = u || { full_name: '', full_name_en: '', username: '', job_title: '', role: 'member' };
  modal({
    title: isNew ? L('افزودن همکار', 'Add team member') : `${L('ویرایش', 'Edit')} ${esc(nm(u))}`,
    body: `<form id="uf">
      <div class="row">
        <div class="field"><label>${L('نام فارسی', 'Persian name')} *</label><input class="input" name="full_name" dir="rtl" required value="${esc(u.full_name)}"></div>
        <div class="field"><label>${L('نام انگلیسی', 'English name')}</label><input class="input" name="full_name_en" dir="ltr" value="${esc(u.full_name_en || '')}"></div>
      </div>
      <div class="row">
        <div class="field"><label>${L('نام کاربری', 'Username')} ${isNew ? '*' : ''}</label><input class="input ltr" dir="ltr" name="username" value="${esc(u.username)}" ${isNew ? 'required pattern="[A-Za-z0-9._\\-]{3,32}"' : 'disabled'} placeholder="e.g. m.ahmadi">
          <span class="hint">${isNew ? L('فقط حروف انگلیسی، عدد و . _ -', 'English letters, digits and . _ - only') : L('نام کاربری قابل تغییر نیست', 'Username can’t be changed')}</span></div>
        <div class="field"><label>${L('سمت', 'Job title')}</label><input class="input" name="job_title" dir="auto" value="${esc(u.job_title)}"></div>
      </div>
      <div class="field"><label>${L('نقش', 'Access')}</label><select class="input" name="role" ${u.id === S.me.id ? 'disabled' : ''}>
        <option value="member" ${u.role === 'member' ? 'selected' : ''}>${L('همکار — فقط تسک‌ها و ساعت کاری خودش', 'Member — own tasks and hours only')}</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>${L('مدیر — دسترسی کامل', 'Manager — full access')}</option></select></div>
      ${isNew ? `<div class="field"><label>${L('رمز عبور اولیه', 'Initial password')} *</label><div class="pw-row"><input class="input" name="password" required minlength="8" value="${genPassword()}">
        <button type="button" class="btn btn-sm" id="regen">${icon('refresh')}</button></div><span class="hint">${L('حداقل ۸ کاراکتر. همکار بعداً می‌تواند عوضش کند.', 'At least 8 characters. They can change it later.')}</span></div>` : ''}
      <div class="err" id="uerr"></div></form>`,
    footer: `<button class="btn btn-primary" data-save>${icon('check')} ${isNew ? L('ساخت حساب', 'Create account') : L('ذخیره', 'Save')}</button><button class="btn" data-close>${L('انصراف', 'Cancel')}</button>`,
    onMount: ctx => {
      const f = ctx.$('#uf');
      ctx.$('#regen')?.addEventListener('click', () => { f.password.value = genPassword(); });
      ctx.$('[data-save]').addEventListener('click', e => {
        if (!f.reportValidity()) return;
        run(e.currentTarget, async () => {
          const base = { full_name: f.full_name.value.trim(), full_name_en: f.full_name_en.value.trim(), job_title: f.job_title.value.trim() };
          if (isNew) {
            const data = { ...base, username: f.username.value.trim().toLowerCase(), role: f.role.value, password: f.password.value };
            await api.adminCreateUser(data);
            ctx.close(); await rerender(); credBox(data.username, data.password);
          } else {
            await api.adminUpdateUser(u.id, { ...base, role: u.id === S.me.id ? u.role : f.role.value });
            ctx.close(); toast(L('ذخیره شد', 'Saved'), 'ok'); rerender();
          }
        });
      });
    },
  });
}

function resetPw(u) {
  modal({
    title: `${L('رمز جدید برای', 'New password for')} ${esc(nm(u))}`,
    body: `<div class="field"><label>${L('رمز عبور جدید', 'New password')}</label><div class="pw-row"><input class="input" id="npw" minlength="8" value="${genPassword()}"><button type="button" class="btn btn-sm" id="regen">${icon('refresh')}</button></div>
      <span class="hint">${L('رمز قبلی بلافاصله از کار می‌افتد.', 'The old password stops working immediately.')}</span></div>`,
    footer: `<button class="btn btn-primary" data-save>${icon('key')} ${L('تنظیم رمز', 'Set password')}</button><button class="btn" data-close>${L('انصراف', 'Cancel')}</button>`,
    onMount: ctx => {
      ctx.$('#regen').addEventListener('click', () => { ctx.$('#npw').value = genPassword(); });
      ctx.$('[data-save]').addEventListener('click', e => run(e.currentTarget, async () => {
        const pw = ctx.$('#npw').value;
        await api.adminSetPassword(u.id, pw); ctx.close(); credBox(u.username, pw);
      }));
    },
  });
}

// =====================================================================
//  حساب من: نام، زبان، تقویم، تم، رمز
// =====================================================================
async function viewProfile(v) {
  const me = S.me;
  const radio = (name, val, label, cur) => `<label><input type="radio" name="${name}" value="${val}" ${val === cur ? 'checked' : ''}> ${label}</label>`;
  v.innerHTML = `
  <div class="grid g-2" style="max-width:980px">
    <section class="card"><div class="card-h"><h3>${L('زبان و تقویم', 'Language & calendar')}</h3></div><form class="card-b" id="prefF">
      <div class="field"><label>${L('زبان سایت', 'Site language')}</label><div class="radio-cards">${radio('lang', 'fa', 'فارسی', lang())}${radio('lang', 'en', 'English', lang())}</div></div>
      <div class="field"><label>${L('تقویم اصلی', 'Main calendar')}</label><div class="radio-cards">${radio('cal', 'jalali', L('شمسی', 'Persian (Jalali)'), primaryCal())}${radio('cal', 'gregorian', L('میلادی', 'Gregorian'), primaryCal())}</div>
        <span class="hint">${L('تقویم دیگر همیشه کوچک‌تر کنار تاریخ‌ها نمایش داده می‌شود.', 'The other calendar is always shown alongside in smaller text.')}</span></div>
      <div class="field"><label>${L('رنگ‌بندی', 'Theme')}</label><div class="radio-cards">${radio('theme', 'navy', L('سرمه‌ای', 'Navy'), theme())}${radio('theme', 'light', L('روشن', 'Light'), theme())}</div></div>
      <button class="btn btn-primary">${icon('check')} ${L('اعمال', 'Apply')}</button></form></section>

    <section class="card"><div class="card-h"><h3>${L('مشخصات', 'Profile')}</h3></div><form class="card-b" id="nf">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">${avatar(me)}<div><b>${esc(nm(me))}</b><div class="small muted ltr" style="text-align:start">${esc(me.username)}</div></div></div>
      <div class="row">
        <div class="field"><label>${L('نام فارسی', 'Persian name')}</label><input class="input" name="full_name" dir="rtl" required minlength="2" value="${esc(me.full_name)}"></div>
        <div class="field"><label>${L('نام انگلیسی', 'English name')}</label><input class="input" name="full_name_en" dir="ltr" value="${esc(me.full_name_en || '')}"></div>
      </div>
      <div class="small muted" style="margin-bottom:12px">${L('سمت', 'Job title')}: ${esc(me.job_title || '—')} · ${L('نقش', 'Access')}: ${me.role === 'admin' ? L('مدیر', 'Manager') : L('همکار', 'Member')}</div>
      <button class="btn btn-primary">${icon('check')} ${L('ذخیره نام', 'Save name')}</button></form></section>

    <section class="card"><div class="card-h"><h3>${L('تغییر رمز عبور', 'Change password')}</h3></div><form class="card-b" id="pwf">
      <div class="field"><label>${L('رمز فعلی', 'Current password')}</label><input class="input ltr" dir="ltr" type="password" name="old" required autocomplete="current-password"></div>
      <div class="field"><label>${L('رمز جدید', 'New password')}</label><input class="input ltr" dir="ltr" type="password" name="n1" required minlength="8" autocomplete="new-password"></div>
      <div class="field"><label>${L('تکرار رمز جدید', 'Repeat new password')}</label><input class="input ltr" dir="ltr" type="password" name="n2" required minlength="8" autocomplete="new-password"></div>
      <div class="err" id="pwerr"></div>
      <button class="btn btn-primary">${icon('key')} ${L('تغییر رمز', 'Change password')}</button></form></section>
  </div>
  ${IS_DEMO ? `<p class="small muted" style="margin-top:24px">${L('نسخه آزمایشی است.', 'This is demo mode.')} <button class="btn btn-sm" id="resetDemo">${L('بازنشانی داده‌های آزمایشی', 'Reset demo data')}</button></p>` : ''}`;

  $('#prefF').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const lg = f.lang.value, cal = f.cal.value, th = f.theme.value;
    run(e.submitter, async () => {
      if (lg !== me.locale || cal !== me.calendar) S.me = await api.updateMyProfile({ locale: lg, calendar: cal });
      setPrefs({ lang: lg, cal, theme: th });
      calState.ym = null;
      startShell();
      toast(L('تنظیمات اعمال شد', 'Preferences saved'), 'ok');
    });
  });
  // با عوض کردن زبان، تقویم پیش‌فرض همان زبان پیشنهاد شود
  $$('#prefF [name=lang]').forEach(r => r.addEventListener('change', () => {
    $(`#prefF [name=cal][value=${r.value === 'en' ? 'gregorian' : 'jalali'}]`).checked = true;
  }));
  $('#nf').addEventListener('submit', e => {
    e.preventDefault();
    run(e.submitter, async () => {
      S.me = await api.updateMyProfile({ full_name: e.target.full_name.value.trim(), full_name_en: e.target.full_name_en.value.trim() });
      toast(L('نام ذخیره شد', 'Name saved'), 'ok'); rerender();
    });
  });
  $('#pwf').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target; $('#pwerr').textContent = '';
    if (f.n1.value !== f.n2.value) return ($('#pwerr').textContent = L('رمز جدید و تکرار آن یکسان نیستند', 'The new passwords don’t match'));
    run(e.submitter, async () => { await api.changeMyPassword(f.old.value, f.n1.value); f.reset(); toast(L('رمز عبور تغییر کرد', 'Password changed'), 'ok'); });
  });
  $('#resetDemo')?.addEventListener('click', async () => {
    if (await confirmDialog(L('همه داده‌های آزمایشی پاک و از نو ساخته شوند؟', 'Wipe and rebuild all demo data?'), { danger: true, okText: L('بازنشانی', 'Reset') })) { api.resetDemo(); location.hash = ''; location.reload(); }
  });
}

boot();
