import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { D } from './rules.js';

export const configured = SUPABASE_URL.startsWith('http');
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const TONES = ['#1F2736', '#3A4458', '#2C3546', '#46506A', '#4A3A33', '#2F4639'];
const fg = (bg) => (['#121826', '#2443D6', '#1C7A46'].includes(bg) ? '#FFFFFF' : '#121826');
const must = ({ data, error }) => { if (error) throw error; return data; };
export const photoUrl = (path) => (path ? sb.storage.from('fotos').getPublicUrl(path).data.publicUrl : null);

// ---------- Login ----------
export async function sendLink(email) {
  must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/' } }));
}
export async function session() { return (await sb.auth.getSession()).data.session; }
export async function signOut() { await sb.auth.signOut(); }

// ---------- Carregar tudo o que a pessoa pode ver ----------
export async function loadAll(me) {
  const today = D.today();
  const since = D.add(today, -200);
  const profiles = must(await sb.from('profiles').select('id,name,color'));
  const groups = must(await sb.from('groups').select('*'));
  const members = must(await sb.from('group_members').select('*'));
  const metas = must(await sb.from('group_metas').select('*'));
  const checkins = must(await sb.from('checkins').select('*').gte('date', since).order('created_at', { ascending: false }).limit(3000));
  const ids = checkins.map((c) => c.id);
  const cg = ids.length ? must(await sb.from('checkin_groups').select('*').in('checkin_id', ids)) : [];
  const reactions = ids.length ? must(await sb.from('reactions').select('*').in('checkin_id', ids)) : [];
  const comments = ids.length ? must(await sb.from('comments').select('*').in('checkin_id', ids).order('created_at')) : [];
  const goals = must(await sb.from('goals').select('*').order('created_at'));
  const gids = goals.map((g) => g.id);
  const logs = gids.length ? must(await sb.from('goal_logs').select('*').in('goal_id', gids).gte('date', D.add(today, -40))) : [];
  const calls = must(await sb.from('calls').select('*').gte('date', D.add(today, -1)));

  const users = {};
  profiles.forEach((p) => { users[p.id] = { name: p.name || 'Sem nome', bg: p.color, fg: fg(p.color) }; });
  const db = {
    today, me, users,
    groups: groups.map((g) => {
      const ms = members.filter((m) => m.group_id === g.id);
      const metasG = {};
      metas.filter((m) => m.group_id === g.id).forEach((m) => { metasG[m.season_key] = m.value; });
      return { id: g.id, name: g.name, leader: g.leader, mode: g.mode, days: g.days, code: g.code, start: g.started_at, started_at: g.started_at, started: !!g.started_at, members: ms.map((m) => m.user_id), effective: Object.fromEntries(ms.map((m) => [m.user_id, m.effective_from])), metas: metasG };
    }).sort((a, b) => a.name.localeCompare(b.name)),
    checkins: checkins.map((c, i) => {
      const reacts = {};
      reactions.filter((r) => r.checkin_id === c.id).forEach((r) => { (reacts[r.emoji] = reacts[r.emoji] || []).push(r.user_id); });
      return {
        id: c.id, user: c.user_id, date: c.date, cat: c.category, min: c.minutes, desc: c.description,
        photo: photoUrl(c.photo_path), photo_path: c.photo_path, tone: TONES[i % TONES.length],
        ts: new Date(c.created_at).getHours(), created: c.created_at,
        groups: cg.filter((x) => x.checkin_id === c.id).map((x) => x.group_id),
        reactions: reacts,
        comments: comments.filter((m) => m.checkin_id === c.id).map((m) => ({ id: m.id, user: m.user_id, text: m.text })),
      };
    }),
    goals: goals.map((g) => ({ id: g.id, user: g.user_id, type: g.type, target: g.type === 'agua' || g.type === 'sono' ? Number(g.target_num) : g.target_text, when: g.schedule })),
    goalLog: {},
    chamados: {},
    callsToMe: calls.filter((c) => c.to_user === me && c.date === today).map((c) => c.from_user),
  };
  logs.forEach((l) => { const g = db.goals.find((x) => x.id === l.goal_id); (db.goalLog[l.goal_id] = db.goalLog[l.goal_id] || {})[l.date] = g && (g.type === 'comida' || g.type === 'outra') ? l.done : Number(l.value); });
  calls.filter((c) => c.from_user === me).forEach((c) => { db.chamados[`${c.date}|${me}|${c.to_user}`] = true; });
  return db;
}

// ---------- Perfil ----------
export async function saveProfile(me, name, color) { must(await sb.from('profiles').update({ name, color }).eq('id', me)); }

// ---------- Check-in ----------
export async function uploadPhoto(me, blob) {
  const path = `${me}/${crypto.randomUUID()}.jpg`;
  must(await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  return path;
}
export async function addCheckin(me, { date, cat, min, desc, photo_path, groups }) {
  const ck = must(await sb.from('checkins').insert({ user_id: me, date, category: cat, minutes: min, description: desc, photo_path }).select().single());
  if (groups.length) must(await sb.from('checkin_groups').insert(groups.map((g) => ({ checkin_id: ck.id, group_id: g }))));
  return ck;
}
export async function toggleReaction(me, checkinId, emoji, on) {
  if (on) must(await sb.from('reactions').insert({ checkin_id: checkinId, user_id: me, emoji }));
  else must(await sb.from('reactions').delete().match({ checkin_id: checkinId, user_id: me, emoji }));
}
export async function addComment(me, checkinId, text) { must(await sb.from('comments').insert({ checkin_id: checkinId, user_id: me, text })); }

// ---------- Chamar ----------
export async function call(me, users, groupId) {
  const date = D.today();
  for (const u of users) {
    const { error } = await sb.from('calls').insert({ from_user: me, to_user: u, group_id: groupId, date });
    if (error && error.code !== '23505') throw error; // 23505 = já chamou hoje
  }
}

// ---------- Turmas ----------
export async function createGroup({ name, mode, days, meta }) {
  return must(await sb.rpc('create_group', { p_name: name, p_mode: mode, p_days: mode === 'dias' ? days : null, p_meta: meta, p_season_key: 'inicial' }));
}
export async function startGroup(id) { must(await sb.from('groups').update({ started_at: D.today() }).eq('id', id)); }
export async function groupByCode(code) { const r = must(await sb.rpc('group_by_code', { p_code: code })); return r && r[0]; }
export async function joinGroup(code, effectiveFrom) { return must(await sb.rpc('join_group', { p_code: code, p_effective_from: effectiveFrom })); }
export async function saveMeta(groupId, key, value) { must(await sb.from('group_metas').upsert({ group_id: groupId, season_key: key, value })); }
export async function leaveGroup(me, groupId) { must(await sb.from('group_members').delete().match({ group_id: groupId, user_id: me })); }

// ---------- Metas pessoais ----------
export async function addGoal(me, g) {
  must(await sb.from('goals').insert({ user_id: me, type: g.type, target_num: g.type === 'agua' || g.type === 'sono' ? g.target : null, target_text: g.type === 'comida' || g.type === 'outra' ? g.target : null, schedule: g.when }));
}
export async function deleteGoal(id) { must(await sb.from('goals').delete().eq('id', id)); }
export async function logGoal(goal, date, value) {
  const row = { goal_id: goal.id, date };
  if (goal.type === 'comida' || goal.type === 'outra') row.done = !!value; else row.value = value;
  must(await sb.from('goal_logs').upsert(row));
}

// ---------- Conta ----------
export async function deleteMyData(me) {
  const files = must(await sb.storage.from('fotos').list(me, { limit: 1000 }));
  if (files.length) await sb.storage.from('fotos').remove(files.map((f) => `${me}/${f.name}`));
  must(await sb.from('checkins').delete().eq('user_id', me));
  must(await sb.from('goals').delete().eq('user_id', me));
  const ms = must(await sb.from('group_members').select('group_id').eq('user_id', me));
  for (const m of ms) await sb.from('group_members').delete().match({ group_id: m.group_id, user_id: me });
}
