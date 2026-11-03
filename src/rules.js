// Regras do Chama. Tudo é calculado a partir dos check-ins (com data),
// para que o registro retroativo recalcule chama, folga e placar sozinho.

export const D = (() => {
  const DAY = 864e5;
  const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const f = (t) => new Date(t).toISOString().slice(0, 10);
  const add = (s, n) => f(p(s) + n * DAY);
  const diff = (a, b) => Math.round((p(b) - p(a)) / DAY);
  const dow = (s) => (new Date(p(s)).getUTCDay() + 6) % 7; // 0 = segunda
  const week = (s) => add(s, -dow(s));
  const fom = (s) => s.slice(0, 8) + '01';
  const lom = (s) => { const t = new Date(p(s)); return f(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)); };
  const M = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MF = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const W = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const short = (s) => { const t = new Date(p(s)); return t.getUTCDate() + ' ' + M[t.getUTCMonth()]; };
  const wd = (s) => W[dow(s)];
  const month = (s) => MF[new Date(p(s)).getUTCMonth()];
  const day = (s) => new Date(p(s)).getUTCDate();
  // "hoje" no fuso de quem está usando: o dia vira à meia-noite local
  const today = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
  return { add, diff, dow, week, fom, lom, short, wd, month, day, W, today };
})();

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const isActive = (c) => c.min >= 30;

export function streakInfo(db, u) {
  const mine = db.checkins.filter((c) => c.user === u);
  const status = {};
  if (!mine.length) return { current: 0, record: 0, total: 0, folgaFree: true, status, trainedToday: false };
  const act = new Set(mine.filter(isActive).map((c) => c.date));
  const start = mine.reduce((m, c) => (c.date < m ? c.date : m), db.today);
  let s = 0, rec = 0;
  const used = {};
  for (let d = start; d <= db.today; d = D.add(d, 1)) {
    if (act.has(d)) { s++; rec = Math.max(rec, s); status[d] = 'a'; }
    else if (d === db.today) status[d] = 'p';
    else if (s > 0 && !used[D.week(d)]) { used[D.week(d)] = true; status[d] = 'f'; }
    else { s = 0; status[d] = 'n'; }
  }
  return { current: s, record: rec, total: act.size, folgaFree: !used[D.week(db.today)], status, trainedToday: act.has(db.today) };
}

export function seasonAt(g, date) {
  const start0 = g.start || date;
  if (g.mode === 'mes') {
    const s0 = D.fom(date);
    return { key: date.slice(0, 7), start: s0 < start0 ? start0 : s0, end: D.lom(date), name: cap(D.month(date)) };
  }
  const idx = Math.max(0, Math.floor(D.diff(start0, date) / g.days));
  const start = D.add(start0, idx * g.days);
  return { key: 'S' + idx, start, end: D.add(start, g.days - 1), name: 'Temporada ' + (idx + 1), idx };
}
export const seasonNext = (g, s) => seasonAt(g, D.add(s.end, 1));
export const seasonPrev = (g, s) => (g.start && s.start > g.start ? seasonAt(g, D.add(s.start, -1)) : null);

export function metaFor(g, s) {
  let cur = s;
  for (let i = 0; i < 120 && cur; i++) {
    if (g.metas[cur.key] != null) return g.metas[cur.key];
    cur = seasonPrev(g, cur);
  }
  return g.metas.inicial || 0;
}

// Quem entrou no meio de uma temporada só conta a partir de effective_from.
export function ranking(db, g, s, uptoDate) {
  const until = uptoDate || (s.end < db.today ? s.end : db.today);
  const rows = g.members
    .filter((u) => !g.effective[u] || g.effective[u] <= s.end)
    .map((u) => {
      const from = g.effective[u] && g.effective[u] > s.start ? g.effective[u] : s.start;
      const days = new Set(db.checkins.filter((c) => c.user === u && c.groups.includes(g.id) && isActive(c) && c.date >= from && c.date <= until).map((c) => c.date));
      return { u, n: days.size };
    });
  rows.sort((a, b) => b.n - a.n || (db.users[a.u]?.name || '').localeCompare(db.users[b.u]?.name || ''));
  rows.forEach((r) => { r.pos = 1 + rows.filter((o) => o.n > r.n).length; r.tied = rows.some((o) => o !== r && o.n === r.n); });
  return rows;
}

export function groupToday(db, g) {
  const s = seasonAt(g, db.today);
  const rows = ranking(db, g, s);
  const meta = metaFor(g, s);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const left = Math.max(0, meta - total);
  const daysLeft = D.diff(db.today, s.end) + 1;
  const players = rows.map((r) => r.u);
  const trainedToday = g.members.filter((u) => db.checkins.some((c) => c.user === u && c.date === db.today && c.groups.includes(g.id) && isActive(c)));
  return { s, rows, meta, total, left, daysLeft, perDay: left / daysLeft, trainedToday, max: players.length * (D.diff(s.start, s.end) + 1) };
}

export function seasonHistory(db, g) {
  const out = [];
  const s = seasonAt(g, db.today);
  for (let p = seasonPrev(g, s); p; p = seasonPrev(g, p)) {
    const rows = ranking(db, g, p, p.end);
    const meta = metaFor(g, p);
    const total = rows.reduce((a, r) => a + r.n, 0);
    out.push({ s: p, champs: rows.filter((r) => r.pos === 1 && r.n > 0).map((r) => db.users[r.u]?.name || '?'), top: rows[0] ? rows[0].n : 0, meta, total });
    if (out.length > 12) break;
  }
  return out;
}

export function hours(v) { const h = Math.floor(v); const m = Math.round((v - h) * 60); return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; }
const num = (n) => String(n).replace('.', ',');

export function goalProgress(db, goal, date) {
  const log = db.goalLog[goal.id] || {};
  if (goal.type === 'agua') { const v = Number(log[date] || 0); return { v, done: v >= goal.target, text: `${num(v / 1000)} de ${num(goal.target / 1000)} L`, pct: Math.min(100, v / goal.target * 100) }; }
  if (goal.type === 'sono') { const v = log[date]; return { v, done: v >= goal.target, text: v == null ? 'Sem registro' : `${hours(v)} de ${hours(goal.target)}`, pct: v == null ? 0 : Math.min(100, v / goal.target * 100) }; }
  const wk = D.week(date); let ok = 0, tot = 0;
  for (let d = wk; d <= date; d = D.add(d, 1)) { if (goal.when === 'uteis' && D.dow(d) > 4) continue; tot++; if (log[d]) ok++; }
  return { v: !!log[date], done: !!log[date], text: `${ok} de ${tot} dias nesta semana`, pct: tot ? ok / tot * 100 : 0 };
}

// Se a temporada já começou, quem entra hoje só conta a partir da próxima.
export function effectiveFromFor(g, date) {
  if (!g.started_at) return null;
  const gg = { mode: g.mode, days: g.days, start: g.started_at };
  return seasonNext(gg, seasonAt(gg, date)).start;
}
