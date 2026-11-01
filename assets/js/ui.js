// ابزارهای رابط کاربری: آیکون، مودال، اعلان، انتخاب‌گر تاریخ، قالب‌بندی
import { L, n, lang, isFa, primaryCal, secondaryCal } from './i18n.js';
import { fmt, fmt2, parts, fromParts, monthLen, addMonths, monthGrid, monthTitle, weekdayName, firstDow, parseDate, todayIso } from './cal.js';
import { enDigits } from './jalali.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17 5 12l5-5M5 12h11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  hour: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  send: '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4.5-4.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  coffee: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>',
  login: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m14 7 5 5-5 5M19 12H9"/>',
  download: '<path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  prev: '<path d="m15 6-6 6 6 6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
};
export const icon = (name, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ''}</svg>`;
/** فلش «بعدی/قبلی» با توجه به جهت صفحه */
export const arrowNext = () => icon(isFa() ? 'prev' : 'next');
export const arrowPrev = () => icon(isFa() ? 'next' : 'prev');

// ---------------------------------------------------------------- labels
export const STATUS_KEYS = ['todo', 'in_progress', 'pending_approval', 'done'];
export const STATUS = s => ({
  todo: L('انجام نشده', 'To do'), in_progress: L('در حال انجام', 'In progress'),
  pending_approval: L('در انتظار تایید', 'Awaiting approval'), done: L('تایید شده', 'Approved'),
}[s] || s);
export const STATUS_COLOR = { todo: 'var(--st-todo)', in_progress: 'var(--st-progress)', pending_approval: 'var(--st-pending)', done: 'var(--st-done)' };
export const PRIORITY_KEYS = ['low', 'normal', 'high', 'urgent'];
export const PRIORITY = p => ({ low: L('کم', 'Low'), normal: L('عادی', 'Normal'), high: L('زیاد', 'High'), urgent: L('فوری', 'Urgent') }[p] || p);
export const PROJ_KEYS = ['negotiation', 'active', 'paused', 'done', 'cancelled'];
export const PROJ_STATUS = s => ({
  negotiation: L('در حال مذاکره', 'Negotiation'), active: L('فعال', 'Active'), paused: L('متوقف', 'Paused'),
  done: L('تکمیل شده', 'Completed'), cancelled: L('لغو شده', 'Cancelled'),
}[s] || s);
export const KIND = k => ({ project: L('پروژه', 'Project'), contract: L('قرارداد', 'Contract') }[k] || k);

export const statusPill = s => `<span class="pill st-${s}">${STATUS(s)}</span>`;
export const prioPill = p => `<span class="pill pr-${p}">${PRIORITY(p)}</span>`;
export const projPill = s => `<span class="pill ps-${s}">${PROJ_STATUS(s)}</span>`;
export const kindTag = k => `<span class="tag ${k}">${KIND(k)}</span>`;

export function checkBox(status) {
  if (status === 'done') return `<span class="check done" title="${STATUS('done')}">${icon('check', 'stroke-width="3"')}</span>`;
  if (status === 'pending_approval') return `<span class="check pending" title="${STATUS('pending_approval')}">${icon('hour')}</span>`;
  return `<span class="check" title="${STATUS(status)}"></span>`;
}

/** نام نمایشی با توجه به زبان */
export const nm = p => (!p ? L('کاربر حذف شده', 'Deleted user') : (!isFa() && p.full_name_en ? p.full_name_en : p.full_name));

const AV_COLORS = ['#2f6fd0', '#3a9a2e', '#c27c00', '#7357c9', '#0f8a8a', '#b04a5a', '#5b7d1d', '#3f5fb8'];
export function avatar(p, cls = '') {
  if (!p) return `<span class="avatar ${cls}" style="--av:#5d6b80">?</span>`;
  const name = nm(p).trim();
  const parts = name.split(/\s+/);
  const ini = /[a-z]/i.test(name[0] || '')
    ? ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
    : (parts[0]?.[0] || '') + (parts.length > 1 ? '‌' + parts[parts.length - 1][0] : '');
  let h = 0; for (const c of p.username || p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${cls}" style="--av:${AV_COLORS[h % AV_COLORS.length]}" title="${esc(nm(p))}">${esc(ini)}</span>`;
}

// ---------------------------------------------------------------- formatting
export { fmt, fmt2 };
export function money(v) {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat(isFa() ? 'fa-IR' : 'en-US').format(Number(v)) + L(' ریال', ' IRR');
}
export function parseMoney(s) {
  const v = enDigits(s).replace(/[^\d]/g, '');
  return v ? Number(v) : null;
}
export const moneyInput = v => (v == null || v === '' ? '' : n(Number(v).toLocaleString('en')));
export function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return L('همین الان', 'just now');
  if (diff < 3600) { const m = Math.floor(diff / 60); return L(`${n(m)} دقیقه پیش`, `${m} min ago`); }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return L(`${n(h)} ساعت پیش`, `${h} h ago`); }
  if (diff < 86400 * 7) { const d = Math.floor(diff / 86400); return L(`${n(d)} روز پیش`, `${d} d ago`); }
  return fmt(new Date(ts).toISOString().slice(0, 10));
}
export function fmtMinutes(m) {
  if (m == null || isNaN(m)) return '—';
  m = Math.max(0, Math.round(m));
  return n(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
}
export const isLate = t => t.due_date && t.status !== 'done' && t.due_date < todayIso();
export const fmtTime = t => (t ? n(t) : '—');

// ---------------------------------------------------------------- date picker (شمسی/میلادی)
export function dateInput(name, iso, { required = false } = {}) {
  const ph = primaryCal() === 'jalali' ? n('1405/08/10') : '2026-11-01';
  return `<div class="dp" data-dp="${name}">
    <input class="input" name="${name}" data-iso="${iso || ''}" value="${iso ? fmt(iso) : ''}" placeholder="${ph}" ${required ? 'required' : ''} autocomplete="off">
    <button type="button" class="btn btn-sm" data-dp-open title="${L('تقویم', 'Calendar')}">${icon('calendar')}</button>
  </div>`;
}
export function wireDateInputs(root) {
  $$('[data-dp]', root).forEach(wrap => {
    const input = $('input', wrap);
    input.addEventListener('change', () => {
      const iso = parseDate(input.value);
      input.dataset.iso = iso || '';
      if (iso) input.value = fmt(iso);
    });
    const open = () => openPicker(wrap, input);
    $('[data-dp-open]', wrap).addEventListener('click', open);
    input.addEventListener('focus', open);
  });
}
function openPicker(wrap, input) {
  if ($('.dp-pop', wrap)) return;
  const cal = primaryCal(), c2 = secondaryCal();
  const sel = input.dataset.iso || parseDate(input.value) || '';
  let cur = parts(sel || todayIso(), cal);
  if (wrap._pop?.isConnected) return;
  const pop = document.createElement('div');
  pop.className = 'dp-pop';
  wrap._pop = pop;
  document.body.appendChild(pop);
  const place = () => {
    const r = wrap.getBoundingClientRect(), w = 290, h = pop.offsetHeight || 330;
    const left = isFa() ? Math.max(8, r.right - w) : Math.min(r.left, innerWidth - w - 8);
    const top = r.bottom + 6 + h > innerHeight && r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6;
    Object.assign(pop.style, { position: 'fixed', left: Math.max(8, left) + 'px', top: top + 'px', insetInlineStart: 'auto' });
  };
  const close = () => { pop.remove(); document.removeEventListener('mousedown', outside, true); removeEventListener('scroll', close, true); removeEventListener('resize', close); };
  const outside = e => { if (!wrap.contains(e.target) && !pop.contains(e.target)) close(); };
  document.addEventListener('mousedown', outside, true);
  setTimeout(() => { addEventListener('scroll', e => { if (!pop.contains(e.target)) close(); }, { capture: true, once: true }); addEventListener('resize', close, { once: true }); }, 50);
  const pick = iso => { input.dataset.iso = iso || ''; input.value = iso ? fmt(iso) : ''; input.dispatchEvent(new Event('input', { bubbles: true })); close(); };
  const draw = () => {
    const t = monthTitle(cur.y, cur.m, cal);
    const today = todayIso();
    const wds = Array.from({ length: 7 }, (_, i) => weekdayName((firstDow() + i) % 7, true));
    pop.innerHTML = `<div class="dp-head">
        <button type="button" class="icon-btn" data-m="-1">${arrowPrev()}</button>
        <div class="t">${t.main}<small>${t.sec}</small></div>
        <button type="button" class="icon-btn" data-m="1">${arrowNext()}</button></div>
      <div class="dp-grid">${wds.map(w => `<div class="wd">${w}</div>`).join('')}
      ${monthGrid(cur.y, cur.m, cal).flat().map(d => {
        const p = parts(d, cal), q = parts(d, c2);
        return `<button type="button" data-d="${d}" class="${p.m !== cur.m ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}"><b>${n(p.d)}</b><i>${n(q.d)}</i></button>`;
      }).join('')}</div>
      <div class="dp-foot"><button type="button" class="btn btn-sm" data-today>${L('امروز', 'Today')}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-clear>${L('پاک کردن', 'Clear')}</button></div>`;
    place();
    $$('[data-m]', pop).forEach(b => b.onclick = () => { cur = addMonths(cur, +b.dataset.m); draw(); });
    $$('[data-d]', pop).forEach(b => b.onclick = () => pick(b.dataset.d));
    $('[data-today]', pop).onclick = () => pick(todayIso());
    $('[data-clear]', pop).onclick = () => pick(null);
  };
  draw();
}
/** خواندن تاریخ از فیلد: {ok, iso} */
export function readDate(root, name) {
  const input = $(`[name="${name}"]`, root);
  const v = input.value.trim();
  if (!v) return { ok: true, iso: null };
  const iso = input.dataset.iso && fmt(input.dataset.iso) === v ? input.dataset.iso : parseDate(v);
  return iso ? { ok: true, iso } : { ok: false };
}

// ---------------------------------------------------------------- toast
export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ---------------------------------------------------------------- modal
export function modal({ title, body, footer = '', wide = false, onMount }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-h"><h3>${title}</h3><button class="icon-btn" data-close aria-label="${L('بستن', 'Close')}">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>
    ${footer ? `<div class="modal-f">${footer}</div>` : ''}
  </div>`;
  document.body.appendChild(ov);
  const close = () => { if (!ov.isConnected) return; $$('.dp-pop').forEach(x => x.remove()); ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key !== 'Escape') return; const pop = $('.dp-pop'); if (pop) pop.remove(); else close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', close));
  const ctx = { el: ov, close, $: s => $(s, ov), $$: s => $$(s, ov) };
  wireDateInputs(ov);
  onMount?.(ctx);
  const first = $('input:not([type=hidden]):not([data-iso]):not([type=radio]),textarea,select', ov);
  if (first) setTimeout(() => first.focus(), 30);
  return ctx;
}

export function confirmDialog(message, { okText, danger = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const m = modal({
      title: L('تایید', 'Confirm'),
      body: `<p style="margin:0">${message}</p>`,
      footer: `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${okText || L('تایید', 'OK')}</button><button class="btn" data-close>${L('انصراف', 'Cancel')}</button>`,
      onMount: ctx => ctx.$('[data-ok]').addEventListener('click', () => { done = true; ctx.close(); resolve(true); }),
    });
    const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

export async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (e) { toast(e.message || L('خطا', 'Error'), 'bad'); console.error(e); return undefined; }
  finally { if (btn) btn.disabled = false; }
}

export function genPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '#@$%&*'];
  const all = sets.join('');
  const rnd = k => crypto.getRandomValues(new Uint32Array(1))[0] % k;
  let pw = sets.map(s => s[rnd(s.length)]).join('');
  while (pw.length < 11) pw += all[rnd(all.length)];
  return pw.split('').sort(() => rnd(3) - 1).join('');
}

export function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export { lang };
