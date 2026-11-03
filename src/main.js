import './style.css';
import { D, cap, isActive, streakInfo, seasonAt, seasonNext, groupToday, seasonHistory, goalProgress, hours, effectiveFromFor } from './rules.js';
import * as api from './api.js';

/* ===================== Constantes ===================== */
const VERSION = 'versão ' + (typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev');
const CATS = ['Musculação', 'Corrida', 'Caminhada', 'Bicicleta', 'Natação', 'Funcional', 'HIIT', 'Crossfit', 'Yoga', 'Pilates', 'Dança', 'Lutas', 'Futebol', 'Tênis e beach tennis', 'Trilha', 'Remo', 'Escalada', 'Alongamento e mobilidade', 'Outro'];
const REACTS = ['🔥', '👏', '💪', '😮', '😂'];
const COLORS = ['#7C93FF', '#FFD2BF', '#C9D7CE', '#F2D6E6', '#FCE9A9', '#E6E9EE', '#121826', '#2443D6'];
const fg = (bg) => (['#121826', '#2443D6', '#1C7A46'].includes(bg) ? '#FFFFFF' : '#121826');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => String(n).replace('.', ',');
const FLAME = (fill, core, w = 20) => `<svg width="${w}" height="${Math.round(w * 4 / 3)}" viewBox="0 0 48 64" aria-hidden="true"><path d="M24 2C30 16 44 24 44 41A20 20 0 0 1 4 41C4 31 10 25 14 18C16 27 20 29 22.5 29C20 19 20 10 24 2Z" fill="${fill}"/>${core ? `<path d="M24 34C27 39 32 42 32 48A8 8 0 0 1 16 48C16 43 20 40 24 34Z" fill="${core}"/>` : ''}</svg>`;
const sv = (d, w = 20, sw = 2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  back: sv('<path d="M15 18l-6-6 6-6"/>'), next: sv('<path d="M9 6l6 6-6 6"/>', 18), down: sv('<path d="M6 9l6 6 6-6"/>', 18, 2.4),
  close: sv('<path d="M6 6l12 12M18 6L6 18"/>', 18), plus: sv('<path d="M12 5v14M5 12h14"/>', 18, 2.4), minus: sv('<path d="M5 12h14"/>', 18, 2.4),
  plusS: sv('<path d="M12 5v14M5 12h14"/>', 10, 3.4), checkS: sv('<path d="M5 12l5 5 9-10"/>', 10, 3.4), check: sv('<path d="M5 12l5 5 9-10"/>', 16, 3),
  cam: sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 28, 1.8),
  home: sv('<path d="M4 11l8-7 8 7v9H4z"/>', 22), chart: sv('<path d="M6 20V10M12 20V4M18 20v-7"/>', 22),
  people: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>', 22),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 22),
  wa: sv('<path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/>', 18), send: sv('<path d="M5 12h14M13 6l6 6-6 6"/>', 18),
  share: sv('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>', 18),
};
const GOAL_ICON = {
  agua: sv('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'), sono: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  comida: sv('<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19l7-7"/>'), outra: sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  alcance: sv('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
};

/* ===================== Estado ===================== */
let db = null;
let ME = null;
let ui = { screen: 'feed', group: null, feedAll: false, viewUser: null, postId: null, histUser: null, histMonth: null, histDay: null, sheet: null, sheetData: null, success: null, form: null, create: null, allCats: false, toast: null, busy: false, email: '', sent: false, newGoal: null, join: null };
const navStack = [];
const userById = (u) => db.users[u] || { name: '?', bg: '#D5D9E0', fg: '#121826' };
const G = () => db.groups.find((g) => g.id === ui.group) || db.groups[0];
const myGroups = () => db.groups.filter((g) => g.members.includes(ME));
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; render(); });

function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

/* ===================== Pedaços ===================== */
const avInner = (x) => (x.photo ? `<img src="${x.photo}" alt="" loading="lazy">` : esc((x.name || '?')[0].toUpperCase()));
function av(u, cls = '', extra = '') { const x = userById(u); return `<span class="av ${cls}" style="background:${x.bg};color:${x.fg};${extra}">${avInner(x)}</span>`; }
function avBtn(u, cls = '', extra = '') { const x = userById(u); return `<button class="av ${cls}" data-a="perfil" data-u="${u}" aria-label="Ver perfil de ${esc(x.name)}" style="background:${x.bg};color:${x.fg};${extra}">${avInner(x)}</button>`; }
const nameOf = (u) => (u === ME ? 'Você' : esc(userById(u).name));
function photoBox(c, h) {
  const inner = c.photo ? `<img src="${c.photo}" alt="Foto do treino de ${esc(userById(c.user).name)}" loading="lazy">` : `<span>sem foto</span>`;
  return `<div class="photo" style="height:${h}px;background:${c.tone}">${inner}${isActive(c) ? '' : '<span class="tag">Não acendeu · menos de 30 min</span>'}</div>`;
}
function whenText(c) {
  if (c.date === db.today) return `hoje, ${c.ts}h`;
  if (c.date === D.add(db.today, -1)) return 'ontem';
  return `${D.wd(c.date)}, ${D.short(c.date)}`;
}
function head(title, back) { return `<div class="pad row" style="padding-top:14px;padding-bottom:10px">${back ? `<button class="round" data-a="${back === 'back' ? 'back' : 'go'}" data-to="${back}" aria-label="Voltar">${I.back}</button>` : ''}<h1 class="title">${title}</h1></div>`; }
const pct = (a, b) => Math.min(100, a / Math.max(1, b) * 100);

/* ===================== Telas sem login ===================== */
function screenSetup() {
  return `<div class="pad stack" style="padding-top:40px"><h1 class="title">Falta configurar</h1><p>Preencha o endereço e a chave pública do Supabase em <code>src/config.js</code> (ou nas variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) e publique de novo.</p></div>`;
}
function screenLogin() {
  const code = stored('chama-convite');
  return `
    <div style="background:var(--asfalto);color:#fff;padding-top:48px;padding-bottom:36px" class="pad stack">
      <div class="row" style="gap:14px">${FLAME('#FF4F12', '#F4F5F7', 54)}<span class="disp" style="font-size:96px;letter-spacing:-.02em">chama</span></div>
      <div style="font-size:17px;color:var(--inv-suave);max-width:28em">Treino em grupo para família e amigos. Acenda o dia, chame a turma.</div>
    </div>
    <div class="pad stack" style="padding-top:24px">
      ${code ? `<div class="card"><strong>Você recebeu um convite</strong><div class="muted">Entre com seu e-mail e a turma ${esc(code)} abre em seguida.</div></div>` : ''}
      ${ui.sent ? `<div class="card stack"><strong style="font-size:17px">Confira seu e-mail</strong><div>Mandamos um código para <strong>${esc(ui.email)}</strong>. Digite aqui:</div>
        <input class="input disp" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="000000" style="height:56px;font-size:30px;text-align:center;letter-spacing:.2em">
        <button class="btn brasa ${ui.busy ? 'spin' : ''}" data-a="verify">Entrar</button>
        <div class="muted">Não chegou? Veja a caixa de spam. ${standaloneNote()}</div>
        <button class="btn ghost small" data-a="relogin">Usar outro e-mail</button></div>` : `
      <label class="stack" style="gap:6px"><span class="label">Seu e-mail</span><input class="input" id="email" type="email" inputmode="email" autocomplete="email" placeholder="voce@email.com" value="${esc(ui.email)}"></label>
      <button class="btn brasa" data-a="login">Receber código</button>
      <div class="muted">Sem senha: você recebe um código no e-mail.</div>`}
      <div class="version">${VERSION}</div>
    </div>`;
}
function standaloneNote() { return isStandalone() ? 'Use o código: o link do e-mail abre no navegador, fora do app.' : ''; }
function screenOnboarding() {
  const me = db.users[ME];
  const color = ui.color || me.bg;
  return `
    ${head('Seu perfil')}
    <div class="pad stack">
      <div class="row" style="gap:14px">
        <label style="position:relative;cursor:pointer;flex:none" aria-label="Escolher foto de perfil">
          <span class="av" style="width:84px;height:84px;font-size:32px;background:${color};color:${fg(color)}">${me.photo ? `<img src="${me.photo}" alt="">` : esc(((ui.pname ?? me.name) || '?')[0].toUpperCase())}</span>
          <span style="position:absolute;right:-2px;bottom:-2px;width:30px;height:30px;border-radius:999px;background:var(--asfalto);color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #fff">${sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 16)}</span>
          <input type="file" accept="image/*" id="avatarfile" class="sr">
        </label>
        <div class="stack" style="gap:6px"><strong>Foto de perfil</strong><span class="muted">${me.photo ? 'Toque na foto para trocar.' : 'Opcional. Sem foto, aparece a inicial na cor que você escolher.'}</span>${me.photo ? `<button data-a="del-avatar" style="border:0;background:transparent;padding:0;text-align:left;color:var(--texto-suave);text-decoration:underline;font-size:13px">Remover foto</button>` : ''}</div>
      </div>
      <label class="stack" style="gap:6px"><span class="label">Como a turma te chama</span><input class="input" id="pname" value="${esc(ui.pname ?? (me.name === 'Sem nome' ? '' : me.name))}" placeholder="Seu nome ou apelido" maxlength="30"></label>
      <div class="stack" style="gap:8px"><span class="label">Cor do seu avatar${me.photo ? ' (aparece se tirar a foto)' : ''}</span><div class="chips">${COLORS.map((c) => `<button data-a="pcolor" data-c="${c}" aria-label="Cor ${c}" aria-pressed="${c === color}" style="width:44px;height:44px;border-radius:999px;border:0;background:${c};box-shadow:${c === color ? '0 0 0 3px #fff,0 0 0 5px var(--asfalto)' : 'inset 0 0 0 1px var(--linha)'}"></button>`).join('')}</div></div>
      <button class="btn dark" data-a="save-profile">Salvar</button>
    </div>`;
}

/* ===================== Telas ===================== */
function noGroups() {
  return `<div class="pad stack" style="padding-top:28px">
    <div class="row" style="gap:12px">${FLAME('#FF4F12', '#121826', 36)}<h1 class="title">Bem-vindo</h1></div>
    <p style="margin:0;font-size:16px">Para começar, crie a turma da sua família ou dos amigos, ou entre numa turma com o código que te mandaram.</p>
    <button class="btn dark" data-a="create-start">Criar turma</button>
    <button class="btn ghost" data-a="sheet" data-s="codigo">Entrar com código</button>
  </div>`;
}
function notStarted(g) {
  const leader = g.leader === ME;
  const msg = `Entra na turma ${g.name} no Chama: ${location.origin}/?entrar=${g.code} (código ${g.code})`;
  return `<div class="pad stack" style="padding-top:20px">
    <button class="switch" data-a="sheet" data-s="grupos"><span>${esc(g.name)}</span>${I.down}</button>
    <div class="card stack"><strong>A temporada ainda não começou.</strong><div class="muted">${leader ? 'Convide a turma e toque em Começar. Quem entrar até lá já disputa a primeira temporada.' : `Aguardando ${esc(userById(g.leader).name)} começar a temporada.`}</div>
    <div class="label">Já na turma · ${g.members.length}</div><div class="row" style="flex-wrap:wrap">${g.members.map((u) => av(u, 'sm')).join('')}</div></div>
    ${leader ? `<div style="border-radius:14px;background:var(--asfalto);color:#fff;padding:16px" class="stack"><div class="label" style="color:var(--inv-suave)">Código da turma</div><div class="disp" style="font-size:44px;letter-spacing:.04em">${g.code}</div>
      <div class="row"><a class="btn brasa small" style="flex:2;font-family:var(--sans);font-style:normal;font-weight:700;font-size:15px;text-transform:none" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${I.wa} WhatsApp</a><button class="btn small" data-a="copy" data-t="${esc(msg)}" style="flex:1;border:1px solid #2C3546;background:var(--asfalto);color:#fff;font-family:var(--sans);font-style:normal;font-weight:600;font-size:15px;text-transform:none">Copiar</button></div></div>
    <button class="btn dark" data-a="start-group" data-g="${g.id}">Começar a temporada</button>` : ''}
  </div>`;
}

const SCREENS = {
  feed() {
    if (!myGroups().length) return noGroups();
    const banner = db.callsToMe.length ? `<div class="banner">${FLAME('#FF4F12', '#F4F5F7', 16)}<span>${esc([...new Set(db.callsToMe)].map((u) => userById(u).name).join(' e '))} te ${db.callsToMe.length > 1 ? 'chamaram' : 'chamou'} hoje.</span>${streakInfo(db, ME).trainedToday ? '' : '<button data-a="go" data-to="registrar">Acender</button>'}</div>` : '';
    if (ui.feedAll) {
      const mine = myGroups().map((x) => x.id);
      const posts = db.checkins.filter((c) => c.groups.some((id) => mine.includes(id))).sort(byNewest).slice(0, 60);
      return `${banner}<div style="background:var(--superficie);border-bottom:1px solid var(--linha)" class="pad"><div class="row" style="justify-content:space-between;padding:12px 0">
        <button class="switch" data-a="sheet" data-s="grupos" aria-label="Trocar de turma"><span>Todas as turmas</span>${I.down}</button><span class="muted">${mine.length} turmas</span></div></div>
        <div class="stack" style="padding-top:12px">${posts.length ? posts.map((c) => postCard(c, true)).join('') : `<div class="empty">Nenhum post nas suas turmas ainda.</div>`}</div>`;
    }
    const g = G();
    if (!g.started) return banner + notStarted(g);
    const t = groupToday(db, g);
    const posts = db.checkins.filter((c) => c.groups.includes(g.id)).sort(byNewest).slice(0, 60);
    const faltam = g.members.filter((u) => !t.trainedToday.includes(u) && u !== ME);
    return `${banner}
      <div style="background:var(--superficie);border-bottom:1px solid var(--linha)" class="pad stack">
        <div class="row" style="justify-content:space-between;padding-top:12px">
          <button class="switch" data-a="sheet" data-s="grupos" aria-label="Trocar de turma"><span>${esc(g.name)}</span>${I.down}</button>
          <span class="muted" style="flex:none">${esc(t.s.name)} · dia ${D.diff(t.s.start, db.today) + 1}</span>
        </div>
        <div class="stack" style="gap:6px">
          <div class="row" style="justify-content:space-between;font-size:13px"><span style="font-weight:600;color:var(--texto-suave)">Meta da turma</span><span style="font-weight:700;color:var(--raia)">${t.total} de ${t.meta} dias ativos</span></div>
          <div class="bar"><i style="width:${pct(t.total, t.meta)}%"></i></div>
        </div>
        <div class="row" style="padding-bottom:12px;flex-wrap:wrap">
          <div class="row" style="gap:8px;flex-wrap:wrap">${g.members.map((u) => {
            if (t.trainedToday.includes(u)) return avBtn(u, '', 'box-shadow:0 0 0 3px var(--brasa)');
            if (u === ME) return `<button class="av" data-a="go" data-to="registrar" aria-label="Você ainda não treinou hoje: registrar treino" style="border:2px dashed var(--texto-suave);background:var(--giz);color:var(--texto-suave)">${esc(userById(u).name[0].toUpperCase())}</button>`;
            const ja = db.chamados[`${db.today}|${ME}|${u}`];
            return `<button class="av" data-a="chamar" data-u="${u}" aria-label="Chamar ${esc(userById(u).name)}" style="position:relative;border:2px dashed var(--texto-suave);background:var(--giz);color:var(--texto-suave)">${esc(userById(u).name[0].toUpperCase())}<span style="position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border-radius:999px;background:${ja ? 'var(--linha)' : 'var(--brasa)'};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:var(--asfalto)">${ja ? I.checkS : I.plusS}</span></button>`;
          }).join('')}</div>
          <div class="muted" style="flex:1;min-width:120px"><strong style="color:var(--texto)">${t.trainedToday.length} de ${g.members.length}</strong> já acenderam hoje.${faltam.length ? ' Toque em quem falta para chamar.' : ''}</div>
        </div>
      </div>
      <div class="stack" style="padding-top:12px">${posts.length ? posts.map((c) => postCard(c)).join('') : `<div class="empty">Ninguém postou ainda.<br>Acenda a primeira chama da turma.</div>`}</div>`;
  },
  temporada() {
    if (!myGroups().length) return noGroups();
    const g = G();
    if (!g.started) return notStarted(g);
    const t = groupToday(db, g);
    const rows = t.rows;
    const maxN = rows[0] ? rows[0].n : 0;
    const showPodium = maxN > 1;
    const counts = [...new Set(rows.map((r) => r.n))].slice(0, 3);
    const onPodium = (r) => showPodium && r.pos <= 3;
    const lastPodium = rows.filter(onPodium).reduce((m, r) => Math.min(m, r.n), Infinity);
    const me = rows.find((r) => r.u === ME);
    let aviso = '';
    if (me) {
      const meTrained = t.trainedToday.includes(ME);
      const above = rows.filter((r) => r.n > me.n).sort((a, b) => a.n - b.n)[0];
      if (!above) {
        const below = rows.filter((r) => r.n < me.n)[0];
        aviso = me.tied ? `Você divide o 1º lugar.${meTrained ? '' : ' Treinar hoje pode te deixar sozinho na frente.'}` : below ? `Você lidera. ${userById(below.u).name} está a ${me.n - below.n} dia${me.n - below.n > 1 ? 's' : ''}.` : 'Você lidera.';
      } else {
        const gap = above.n - me.n;
        aviso = `Você está a ${gap} dia${gap > 1 ? 's' : ''} de ${userById(above.u).name}.` + (meTrained ? '' : gap === 1 ? ' Treinando hoje, você empata.' : ` Treinando hoje, fica a ${gap - 1}.`);
      }
    }
    const steps = [1, 0, 2].map((i) => {
      const n = counts[i];
      const who = n == null ? [] : rows.filter((r) => r.n === n && onPodium(r));
      if (!who.length) return '<div></div>';
      const pos = who[0].pos;
      const isMe = who.some((r) => r.u === ME);
      const h = pos === 1 ? 124 : pos === 2 ? 94 : 70;
      const bg = isMe ? 'var(--brasa)' : pos === 1 ? '#F4F5F7' : pos === 2 ? '#D5D9E0' : '#2C3546';
      const fgc = isMe || pos < 3 ? '#121826' : '#FFFFFF';
      return `<div class="step"><div class="row" style="gap:4px">${who.slice(0, 3).map((r) => avBtn(r.u, 'sm', r.u === ME ? 'box-shadow:0 0 0 3px var(--brasa)' : '')).join('')}</div>
        <span style="font-weight:700;font-size:13px;color:#fff;text-align:center">${who.map((r) => nameOf(r.u)).join(', ')}</span>
        <div class="block" style="height:${h}px;background:${bg};color:${fgc}"><span class="disp" style="font-size:${pos === 1 ? 46 : 38}px">${n}</span><span style="font-size:12px;font-weight:700">${pos}º lugar</span></div></div>`;
    }).join('');
    const rest = rows.filter((r) => !onPodium(r));
    const waiting = g.members.filter((u) => !rows.some((r) => r.u === u));
    const hist = seasonHistory(db, g);
    const leader = g.leader === ME;
    const ns = seasonNext(g, t.s);
    const nsLabel = g.mode === 'mes' ? ns.name.toLowerCase() : 'a próxima temporada';
    return `
      <div style="background:var(--asfalto);color:#fff" class="pad stack">
        <div class="row" style="justify-content:space-between;padding-top:12px">
          <button class="switch" style="color:#fff" data-a="sheet" data-s="grupos"><span>${esc(g.name)}</span>${I.down}</button>
          <div style="text-align:right;flex:none"><div style="font-size:13px;color:var(--inv-suave)">${esc(t.s.name)} · dia ${D.diff(t.s.start, db.today) + 1} de ${D.diff(t.s.start, t.s.end) + 1}</div><div style="font-size:13px;font-weight:700">${t.daysLeft === 1 ? 'Último dia' : `Faltam ${t.daysLeft - 1} dias`}</div></div>
        </div>
        <div class="stack" style="gap:6px">
          <div class="row" style="justify-content:space-between;font-size:13px"><span style="color:var(--inv-suave)">Meta da turma</span><span style="font-weight:700;color:#7C93FF">${t.total} de ${t.meta}</span></div>
          <div class="bar dark"><i style="width:${pct(t.total, t.meta)}%"></i></div>
          <div style="font-size:13px;color:var(--inv-suave)">${t.left ? `Faltam ${t.left} em ${t.daysLeft} dias: ${num(t.perDay.toFixed(1))} pessoas treinando por dia.` : 'Meta batida. Agora é defender a posição.'}</div>
        </div>
        ${showPodium ? `<div class="podium" style="margin-top:6px">${steps}</div>` : `<div style="padding:14px 0 16px;font-size:14px;color:var(--inv-suave)">O pódio aparece quando alguém passar de 1 dia ativo.</div>`}
      </div>
      <div class="pad stack" style="padding-top:14px">
        ${rest.length ? `<div class="card" style="padding:4px 14px">${rest.map((r, i) => `
          <div class="row" style="padding:10px 0;${i < rest.length - 1 ? 'border-bottom:1px solid var(--linha)' : ''}">
            <span class="disp" style="font-size:22px;width:24px">${r.pos}</span>${avBtn(r.u, 'sm')}
            <div style="flex:1"><div style="font-weight:${r.u === ME ? 700 : 600}">${nameOf(r.u)}</div>${showPodium ? `<div class="muted">A ${lastPodium - r.n} dia${lastPodium - r.n > 1 ? 's' : ''} do pódio</div>` : ''}</div>
            <span class="disp" style="font-size:22px">${r.n}</span></div>`).join('')}</div>` : ''}
        ${waiting.length ? `<div class="muted">${esc(waiting.map((u) => userById(u).name).join(', '))} entra${waiting.length > 1 ? 'm' : ''} no placar na próxima temporada.</div>` : ''}
        ${aviso ? `<div class="card" style="font-size:14px;line-height:20px"><strong>${esc(aviso)}</strong></div>` : ''}
        ${leader ? `<div class="row" style="gap:8px"><button class="btn ghost small" data-a="sheet" data-s="meta-atual">Editar meta</button><button class="btn ghost small" data-a="sheet" data-s="meta-prox">Meta de ${esc(g.mode === 'mes' ? ns.name.toLowerCase() : 'depois')}</button></div>` : ''}
        <div class="label" style="padding-top:4px">Histórico</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
          ${hist.map((h) => `<div class="card" style="padding:12px"><div style="font-weight:700">${esc(h.s.name)}</div><div class="muted">${h.champs.length ? esc(h.champs.join(', ')) + ' · ' + h.top + ' dias' : 'Sem campeão'}</div><div style="font-size:13px;font-weight:700;color:${h.total >= h.meta ? 'var(--ok)' : 'var(--apagada)'}">Meta ${h.total}/${h.meta}</div></div>`).join('')}
          <div style="border:1px dashed #B8C0CE;border-radius:14px;padding:12px;color:var(--texto-suave)"><div style="font-weight:700">${esc(cap(nsLabel))}</div><div style="font-size:13px">Começa ${D.short(ns.start)}</div><div style="font-size:13px">Meta ${g.metas[ns.key] != null ? g.metas[ns.key] + ' (agendada)' : t.meta + ' (repete)'}</div></div>
        </div>
        <div class="muted" style="padding-top:6px">Código da turma: <strong>${g.code}</strong> · <button data-a="invite-link" data-g="${g.id}" style="border:0;background:transparent;color:var(--brasa-forte);font-weight:600;padding:0">convidar</button></div>
      </div>`;
  },
  registrar() {
    if (!myGroups().some((g) => g.started)) return `${head('Acender a chama', 'feed')}<div class="pad empty">Entre numa turma com a temporada começada para registrar treinos.</div>`;
    const f = ui.form;
    const yday = D.add(db.today, -1);
    const date = f.when === 'hoje' ? db.today : yday;
    const ok = f.min >= 30;
    const groups = myGroups().filter((g) => g.started);
    const cats = ui.allCats ? CATS.slice() : CATS.slice(0, 6);
    if (!cats.includes(f.cat)) cats.push(f.cat);
    const st = streakInfo(db, ME);
    const blocked = (g) => date < seasonAt(g, db.today).start;
    return `
      ${head('Acender a chama', 'feed')}
      <div class="pad stack">
        <div style="padding:10px 14px;border-radius:10px;background:var(--asfalto);color:#fff" class="row">${st.current ? FLAME('#FF4F12', '#F4F5F7') : FLAME('#D5D9E0')}<div><div class="disp" style="font-size:20px;font-weight:800">${st.current ? `${st.current} dia${st.current > 1 ? 's' : ''} acesa` : 'Chama apagada'}</div><div style="font-size:13px;color:var(--inv-suave)">${st.folgaFree ? 'Folga da semana disponível' : 'Folga da semana já usada'}</div></div></div>
        <div class="seg" role="group" aria-label="Quando foi o treino">
          <button class="${f.when === 'hoje' ? 'on' : ''}" data-a="form" data-k="when" data-v="hoje" aria-pressed="${f.when === 'hoje'}">Hoje · ${D.wd(db.today)} ${D.day(db.today)}</button>
          <button class="${f.when === 'ontem' ? 'on' : ''}" data-a="form" data-k="when" data-v="ontem" aria-pressed="${f.when === 'ontem'}">Ontem · ${D.wd(yday)} ${D.day(yday)}</button>
        </div>
        ${f.when === 'ontem' ? `<div class="muted">Treino de ontem só pode ser registrado até hoje, 23h59.</div>` : ''}
        <label style="height:${f.photo ? 220 : 130}px;border-radius:14px;border:2px dashed #B8C0CE;background:var(--giz);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-weight:600;color:#2B3242;overflow:hidden;cursor:pointer;position:relative">
          ${f.photo ? `<img src="${f.photo}" alt="Foto escolhida" style="width:100%;height:100%;object-fit:cover">` : `${I.cam}Foto do treino`}
          <input type="file" accept="image/*" id="foto" class="sr">
        </label>
        <div class="stack" style="gap:8px"><div class="label">Categoria</div>
          <div class="chips">${cats.map((c) => `<button class="chip ${f.cat === c ? 'on' : ''}" data-a="form" data-k="cat" data-v="${esc(c)}" aria-pressed="${f.cat === c}">${esc(c)}</button>`).join('')}${ui.allCats ? '' : `<button class="chip" data-a="allcats">Mais</button>`}</div>
        </div>
        <div class="row" style="justify-content:space-between;${ok ? '' : 'padding:10px;border-radius:12px;border:2px solid var(--apagada)'}">
          <div><div class="label">Duração</div><div style="font-size:12px;${ok ? 'color:var(--texto-suave)' : 'color:var(--apagada);font-weight:600'}">${ok ? 'Conta a partir de 30 min' : `Faltam ${30 - f.min} min para contar`}</div></div>
          <div class="row"><button class="round" data-a="min" data-d="-5" aria-label="Diminuir 5 minutos">${I.minus}</button><span class="disp" style="font-size:32px;min-width:84px;text-align:center" aria-live="polite">${f.min} min</span><button class="round" data-a="min" data-d="5" aria-label="Aumentar 5 minutos">${I.plus}</button></div>
        </div>
        ${ok ? '' : `<div style="font-size:14px;line-height:20px;color:#2B3242">Abaixo de 30 min o treino aparece no mural, mas não acende a chama nem conta no placar.</div>`}
        <label class="stack" style="gap:6px"><span class="label">Descrição</span><input class="input" id="desc" value="${esc(f.desc)}" placeholder="Como foi o treino?" maxlength="200"></label>
        <div class="stack" style="gap:8px"><div class="label">Publicar em</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${groups.map((g) => {
            const on = f.groups.includes(g.id);
            return `<button data-a="tgroup" data-g="${g.id}" aria-pressed="${on}" style="min-height:44px;border-radius:10px;border:${on ? '0' : '1px solid var(--linha)'};background:${on ? 'var(--asfalto)' : 'var(--superficie)'};color:${on ? '#fff' : 'var(--texto)'};font-weight:600;font-size:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px">${on ? `<span class="row" style="gap:6px;color:#fff"><span style="color:var(--brasa)">${I.check}</span>${esc(g.name)}</span>` : esc(g.name)}${blocked(g) ? `<span style="font-size:11px;font-weight:500;opacity:.8">temporada encerrada: não conta</span>` : ''}</button>`;
          }).join('')}</div>
        </div>
        <button class="btn ${ok ? 'brasa' : 'ghost'} ${ui.busy ? 'spin' : ''}" data-a="submit" style="margin-top:4px">${ui.busy ? 'Enviando…' : ok ? (f.when === 'ontem' && st.status[yday] !== 'a' ? 'Reacender' : 'Acender') : 'Postar sem acender'}</button>
      </div>`;
  },
  sucesso() {
    const s = ui.success;
    const g = db.groups.find((x) => x.id === s.group) || G();
    const t = groupToday(db, g);
    const me = t.rows.find((r) => r.u === ME);
    const around = t.rows.slice(0, 3);
    if (me && !around.includes(me)) around[2] = me;
    const faltam = g.members.filter((u) => u !== ME && !t.trainedToday.includes(u) && !db.chamados[`${db.today}|${ME}|${u}`]);
    const st = streakInfo(db, ME);
    return `
      <div style="background:var(--asfalto);color:#fff" class="pad stack">
        <div class="row" style="justify-content:flex-end;padding-top:12px"><button class="round dark" data-a="go" data-to="feed" aria-label="Fechar">${I.close}</button></div>
        ${s.counted ? `<div class="row" style="align-items:flex-end;gap:16px">${FLAME('#FF4F12', '#F4F5F7', 60)}<div><div class="label" style="color:var(--inv-suave)">Chama acesa</div><div class="disp" style="font-size:72px">${st.current} ${st.current === 1 ? 'DIA' : 'DIAS'}</div></div></div>
        <div style="font-size:14px;color:var(--inv-suave);padding-bottom:22px">${st.current >= st.record ? (st.record > 1 ? `Novo recorde: ${st.record} dias.` : 'A primeira de muitas.') : `Faltam ${st.record - st.current} dias para bater seu recorde de ${st.record}.`}</div>`
        : `<div style="padding-bottom:22px"><div class="label" style="color:var(--inv-suave)">Treino postado</div><div class="disp" style="font-size:44px">SEM ACENDER</div><div style="font-size:14px;color:var(--inv-suave);margin-top:8px">Menos de 30 min: aparece no mural, mas não conta na chama nem no placar.</div></div>`}
      </div>
      <div class="pad stack" style="padding-top:16px">
        ${g.started ? `<div class="card stack" style="gap:8px">
          <div class="row" style="justify-content:space-between"><span class="label">Placar · ${esc(g.name)}</span>${s.rankBefore && me && me.pos < s.rankBefore ? `<span style="font-size:13px;font-weight:700;color:var(--ok)">Você subiu para ${me.pos}º</span>` : ''}</div>
          ${around.map((r) => `<div class="row" style="${r.u === ME ? 'margin:0 -8px;padding:4px 8px;border-radius:8px;background:var(--brasa)' : ''}"><span class="disp" style="font-size:20px;width:24px">${r.pos}</span><span style="flex:1;font-weight:${r.u === ME ? 700 : 500}">${nameOf(r.u)}</span><span class="disp" style="font-size:20px">${r.n}</span></div>`).join('')}
        </div>
        <div class="card stack" style="gap:8px">
          <div class="row" style="justify-content:space-between"><span class="label">Meta da turma</span><span class="disp" style="font-size:20px;color:var(--raia)">${t.total} / ${t.meta}</span></div>
          <div class="bar"><i style="width:${pct(t.total, t.meta)}%"></i></div>
          <div class="muted">${t.left ? `Faltam ${t.left} dias ativos em ${t.daysLeft} dias.` : 'Meta batida!'}</div>
        </div>` : ''}
        ${faltam.length ? `<button class="btn brasa" data-a="chamar" data-u="${faltam.join(',')}">Chamar ${esc(faltam.map((u) => userById(u).name).join(' e '))}</button>` : ''}
        <button class="btn ghost" data-a="go" data-to="feed">Ver o mural da turma</button>
      </div>`;
  },
  post() {
    const c = db.checkins.find((x) => x.id === ui.postId);
    if (!c) return `${head('Post', 'back')}<div class="empty">Post não encontrado.</div>`;
    const st = streakInfo(db, c.user);
    const reactedFire = (c.reactions['🔥'] || []).map((u) => (u === ME ? 'Você' : userById(u).name));
    return `
      <div class="pad row" style="padding-top:14px;padding-bottom:10px"><button class="round" data-a="back" aria-label="Voltar">${I.back}</button>${avBtn(c.user)}<div style="flex:1"><div style="font-weight:700">${nameOf(c.user)}</div><div class="muted">${esc(c.cat)} · ${c.min} min · ${whenText(c)}</div></div></div>
      <div style="position:relative">${photoBox(c, 320)}${isActive(c) && st.current ? `<span class="tag">${FLAME('#FF4F12', null, 12)} Chama de ${st.current} dias</span>` : ''}</div>
      <div class="pad stack" style="padding-top:12px;padding-bottom:12px;background:var(--superficie);border-bottom:1px solid var(--linha)">
        ${c.desc ? `<div style="font-size:16px">${esc(c.desc)}</div>` : ''}
        <div class="chips" role="group" aria-label="Reações">${REACTS.map((e) => { const who = c.reactions[e] || []; const on = who.includes(ME); return `<button class="react ${on ? 'on' : ''}" data-a="react" data-id="${c.id}" data-e="${e}" aria-pressed="${on}">${e}${who.length ? ' ' + who.length : ''}</button>`; }).join('')}</div>
        ${reactedFire.length ? `<div class="muted">${esc(reactedFire.join(', '))} reagiu com 🔥</div>` : ''}
      </div>
      <div class="pad stack" style="padding-top:12px;background:var(--superficie);min-height:200px">
        ${c.comments.length ? c.comments.map((m) => `<div class="row" style="align-items:flex-start">${av(m.user, 'sm')}<div><div style="font-size:14px"><strong>${nameOf(m.user)}</strong></div><div>${esc(m.text)}</div></div></div>`).join('') : '<div class="muted">Sem comentários ainda.</div>'}
        <div class="row" style="padding-bottom:12px"><label style="flex:1"><span class="sr">Comentar</span><input class="input" id="comment" placeholder="Comentar…" maxlength="500" style="border-radius:999px"></label><button class="round dark" data-a="comment" data-id="${c.id}" aria-label="Enviar comentário">${I.send}</button></div>
      </div>`;
  },
  perfil() {
    const u = ui.viewUser || ME;
    const self = u === ME;
    const st = streakInfo(db, u);
    const goals = db.goals.filter((x) => x.user === u);
    const groups = db.groups.filter((g) => g.members.includes(u) && g.started && g.members.includes(ME));
    const best = groups.map((g) => ({ g, r: groupToday(db, g).rows.find((r) => r.u === u) })).filter((x) => x.r).sort((a, b) => a.r.pos - b.r.pos)[0];
    const wk = D.week(db.today);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => D.add(wk, i));
    return `
      <div style="background:var(--asfalto);color:#fff" class="pad stack">
        <div class="row" style="padding-top:12px">${self ? '' : `<button class="round dark" data-a="back" aria-label="Voltar">${I.back}</button>`}${self ? `<button class="av" data-a="edit-profile" aria-label="Editar foto e nome" style="width:52px;height:52px;font-size:20px;background:${userById(u).bg};color:${userById(u).fg}">${avInner(userById(u))}</button>` : av(u, '', 'width:52px;height:52px;font-size:20px')}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:18px">${esc(userById(u).name)}</div><div style="font-size:13px;color:var(--inv-suave)">${esc(groups.map((g) => g.name).join(' · '))}</div></div>${self ? `<button class="round dark" data-a="sheet" data-s="conta" aria-label="Conta e configurações">${sv('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>')}</button>` : ''}</div>
        <div class="row" style="align-items:flex-end;gap:14px">${st.current ? FLAME('#FF4F12', '#F4F5F7', 48) : FLAME('#5A6273', null, 48)}<div><div class="label" style="color:var(--inv-suave)">${st.current ? 'Chama acesa' : 'Chama apagada'}</div><div class="disp" style="font-size:64px">${st.current} ${st.current === 1 ? 'DIA' : 'DIAS'}</div></div></div>
        <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;text-align:center;padding-bottom:16px">${days.map((d) => {
          const s = st.status[d];
          const isT = d === db.today;
          const ball = s === 'a' ? 'background:var(--brasa)' : s === 'f' ? 'border:2px solid var(--folga-claro)' : s === 'n' ? 'background:#2C3546' : 'border:1px solid #2C3546';
          return `<div class="stack" style="gap:4px;align-items:center"><span style="width:30px;height:30px;border-radius:999px;box-sizing:border-box;${ball};${isT ? 'box-shadow:0 0 0 2px #121826,0 0 0 4px #fff' : ''}"></span><span style="font-size:12px;${s === 'f' ? 'color:var(--folga-claro);font-weight:600' : isT ? 'font-weight:700' : 'color:var(--inv-suave)'}">${s === 'f' ? 'folga' : isT ? 'hoje' : D.W[D.dow(d)]}</span></div>`;
        }).join('')}</div>
      </div>
      <div class="pad stack" style="padding-top:14px">
        ${!self && !st.trainedToday && !db.chamados[`${db.today}|${ME}|${u}`] ? `<button class="btn brasa small" data-a="chamar" data-u="${u}">Chamar ${esc(userById(u).name)}</button>` : ''}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          <div class="card" style="padding:10px 12px"><div class="disp" style="font-size:28px">${st.record}</div><div class="muted" style="font-size:12px">Recorde</div></div>
          <div class="card" style="padding:10px 12px"><div class="disp" style="font-size:28px">${st.total}</div><div class="muted" style="font-size:12px">Dias ativos</div></div>
          <div class="card" style="padding:10px 12px"><div class="disp" style="font-size:28px">${best ? best.r.pos + 'º' : '–'}</div><div class="muted" style="font-size:12px">${best ? esc(best.g.name) : 'Sem turma'}</div></div>
        </div>
        <button class="card row" data-a="hist" data-u="${u}" style="border:0;text-align:left;min-height:52px"><span class="row" style="gap:3px" aria-hidden="true"><span style="width:14px;height:14px;border-radius:3px;background:#3A4458"></span><span style="width:14px;height:14px;border-radius:3px;background:#1F2736"></span><span style="width:14px;height:14px;border-radius:3px;box-shadow:inset 0 0 0 2px var(--folga-claro)"></span></span><span style="flex:1;font-weight:600">Histórico de treinos</span><span class="muted">calendário</span>${I.next}</button>
        <div class="row" style="justify-content:space-between"><span class="label">${self ? 'Metas pessoais' : 'Metas de ' + esc(userById(u).name)}</span>${self ? `<button data-a="sheet" data-s="addgoal" style="border:0;background:transparent;font-weight:600;color:var(--brasa-forte);height:44px">+ Adicionar</button>` : ''}</div>
        ${goals.length ? `<div class="card" style="padding:4px 14px">${goals.map((goal, i) => goalRow(goal, self, i === goals.length - 1)).join('')}</div>` : `<div class="muted">${self ? 'Nenhuma meta ainda. Adicione uma de rotina (água, sono, alimentação) ou de alcance (correr 21 km, perder 5 kg).' : 'Nenhuma meta pessoal.'}</div>`}
        ${self && !isStandalone() ? `<button class="btn ghost small" data-a="sheet" data-s="instalar">${I.share} Instalar o Chama na tela de início</button>` : ''}
      </div>`;
  },
  historico() {
    const u = ui.histUser || ME;
    const m = ui.histMonth || db.today.slice(0, 7);
    const first = m + '-01';
    const last = D.lom(first);
    const st = streakInfo(db, u);
    const by = {};
    db.checkins.filter((c) => c.user === u && c.date >= first && c.date <= last).forEach((c) => (by[c.date] = by[c.date] || []).push(c));
    const cells = [];
    for (let i = 0; i < D.dow(first); i++) cells.push('<div></div>');
    let act = 0, folgas = 0;
    for (let d = first; d <= last; d = D.add(d, 1)) {
      const list = (by[d] || []).sort((a, b) => b.min - a.min);
      const s = st.status[d];
      if (s === 'a') act++;
      if (s === 'f') folgas++;
      const future = d > db.today;
      let inner = '', style = 'background:var(--superficie);box-shadow:inset 0 0 0 1px #E6E9EE', fgc = '#B8C0CE';
      const half = (c) => (c.photo ? `<img src="${c.photo}" alt="" loading="lazy">` : '');
      if (list.length) {
        inner = list.length > 1
          ? `<span class="half" style="left:0;background:${list[0].tone}">${half(list[0])}</span><span class="half" style="right:0;background:${list[1].tone};border-left:2px solid #fff">${half(list[1])}</span><span class="two">${list.length}</span>`
          : `<span class="half" style="left:0;width:100%;background:${list[0].tone}">${half(list[0])}</span>`;
        style = ''; fgc = '#FFFFFF';
      } else if (s === 'f') { style = 'background:var(--superficie);box-shadow:inset 0 0 0 2px var(--folga-claro)'; fgc = 'var(--folga)'; }
      else if (s === 'n') { style = 'background:var(--giz)'; fgc = 'var(--texto-suave)'; }
      if (ui.histDay === d) style += ';box-shadow:0 0 0 3px var(--brasa)';
      cells.push(`<button class="cell" ${future ? 'disabled' : ''} data-a="hday" data-d="${d}" aria-label="${D.day(d)} de ${D.month(d)}${list.length ? ', ' + list.length + ' treino' + (list.length > 1 ? 's' : '') : ''}" style="${style}">${inner}<span class="n" style="color:${fgc};text-shadow:${list.length ? '0 1px 2px rgba(0,0,0,.6)' : 'none'}">${D.day(d)}</span></button>`);
    }
    const prevM = D.add(first, -1).slice(0, 7);
    const nextM = D.add(last, 1).slice(0, 7);
    const sel = ui.histDay && by[ui.histDay] ? by[ui.histDay] : [];
    return `
      ${head(u === ME ? 'Histórico' : 'Histórico de ' + esc(userById(u).name), 'back')}
      <div class="pad row" style="justify-content:space-between;padding-bottom:12px">
        <button class="round" data-a="hmonth" data-m="${prevM}" aria-label="Mês anterior">${I.back}</button>
        <div style="text-align:center"><div class="disp" style="font-size:26px;text-transform:uppercase">${cap(D.month(first))} ${first.slice(0, 4)}</div><div class="muted">${act} dia${act === 1 ? '' : 's'} ativo${act === 1 ? '' : 's'} · ${folgas} folga${folgas === 1 ? '' : 's'}</div></div>
        <button class="round" data-a="hmonth" data-m="${nextM}" ${nextM > db.today.slice(0, 7) ? 'disabled style="opacity:.4"' : ''} aria-label="Próximo mês">${I.next}</button>
      </div>
      <div class="pad stack" style="gap:6px">
        <div class="cal" style="text-align:center;font-size:12px;font-weight:600;color:var(--texto-suave)">${D.W.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal">${cells.join('')}</div>
        <div class="row" style="flex-wrap:wrap;gap:14px;font-size:12px;color:var(--texto-suave);padding-top:4px"><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#3A4458"></span>Treino</span><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 2px var(--folga-claro)"></span>Folga</span><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:var(--giz);box-shadow:inset 0 0 0 1px var(--linha)"></span>Sem treino</span></div>
      </div>
      <div class="pad stack" style="padding-top:16px">
        ${ui.histDay ? `<div class="label">${D.wd(ui.histDay)}, ${D.short(ui.histDay)} · ${sel.length ? sel.length + ' treino' + (sel.length > 1 ? 's' : '') : st.status[ui.histDay] === 'f' ? 'folga' : 'sem treino'}</div>` : '<div class="muted">Toque num dia para ver os treinos.</div>'}
        ${sel.map((c) => `<button class="card row" data-a="post" data-id="${c.id}" style="border:0;text-align:left;padding:10px"><span style="width:56px;height:56px;flex:none;border-radius:10px;overflow:hidden;background:${c.tone}">${c.photo ? `<img src="${c.photo}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}</span><span style="flex:1"><span style="display:block;font-weight:700">${esc(c.cat)} · ${c.min} min</span><span class="muted">${esc(c.desc)}</span></span>${I.next}</button>`).join('')}
      </div>`;
  },
  turmas() {
    const gs = myGroups();
    return `
      <div class="pad row" style="justify-content:space-between;padding-top:14px;padding-bottom:10px"><h1 class="title" style="line-height:44px">Turmas</h1><button class="btn ghost small" style="width:auto;padding:0 14px" data-a="sheet" data-s="codigo">Entrar com código</button></div>
      <div class="pad stack">
        ${gs.map((g) => {
          if (!g.started) return `<button class="card stack" data-a="open-group" data-g="${g.id}" style="border:0;text-align:left;gap:6px"><span class="disp" style="font-size:24px;text-transform:uppercase">${esc(g.name)}</span><span class="muted">${g.leader === ME ? 'Aguardando você começar a temporada' : 'Aguardando o líder começar a temporada'} · ${g.members.length} pessoa${g.members.length > 1 ? 's' : ''}</span></button>`;
          const t = groupToday(db, g);
          const me = t.rows.find((r) => r.u === ME);
          const active = g.id === ui.group && !ui.feedAll;
          return `<button class="card stack" data-a="open-group" data-g="${g.id}" style="border:0;text-align:left;gap:10px;${active ? 'box-shadow:inset 0 0 0 2px var(--asfalto)' : ''}">
            <span class="row" style="justify-content:space-between;width:100%"><span class="disp" style="font-size:24px;text-transform:uppercase">${esc(g.name)}</span>${g.leader === ME ? '<span style="height:24px;padding:0 8px;border-radius:999px;background:var(--asfalto);color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;flex:none">Você é o líder</span>' : `<span class="muted">líder: ${esc(userById(g.leader).name)}</span>`}</span>
            <span class="row muted" style="gap:14px"><span>${g.members.length} pessoa${g.members.length > 1 ? 's' : ''}</span><span>${esc(t.s.name)} · dia ${D.diff(t.s.start, db.today) + 1} de ${D.diff(t.s.start, t.s.end) + 1}</span></span>
            <span class="row" style="width:100%"><span class="disp" style="height:32px;padding:0 10px;border-radius:8px;background:${me && me.pos === 1 && me.n > 0 ? 'var(--brasa)' : 'var(--giz)'};font-size:18px;display:inline-flex;align-items:center">${me ? me.pos + 'º · ' + me.n + ' dias' : 'próxima temporada'}</span><span class="stack" style="flex:1;gap:4px"><span class="bar"><i style="width:${pct(t.total, t.meta)}%"></i></span><span style="font-size:12px;font-weight:700;color:var(--raia)">Meta ${t.total}/${t.meta}</span></span></span>
          </button>`;
        }).join('')}
        <button class="btn" data-a="create-start" style="border:2px dashed var(--texto-suave);background:transparent;color:var(--texto)">${I.plus} Criar turma</button>
      </div>`;
  },
  criar() {
    const c = ui.create;
    const bars = [1, 2].map((i) => `<span style="height:4px;border-radius:999px;background:${i <= c.step ? 'var(--asfalto)' : 'var(--linha)'}"></span>`).join('');
    const top = `<div class="pad stack" style="padding-top:14px;gap:12px"><div class="row"><button class="round" data-a="create-back" aria-label="Voltar">${I.back}</button><h1 class="title">${c.step === 1 ? 'Criar turma' : 'Meta da turma'}</h1></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px" aria-label="Passo ${c.step} de 2">${bars}</div></div>`;
    const end = c.mode === 'mes' ? D.lom(db.today) : D.add(db.today, c.days - 1);
    const len = D.diff(db.today, end) + 1;
    const max = c.people * len;
    const weeks = len / 7;
    const sug = [['Leve', 0.5], ['Firme', 0.7], ['Forte', 0.85]].map(([n, p]) => ({ n, v: Math.max(1, Math.round(max * p)) }));
    if (c.step === 1) return `${top}
      <div class="pad stack" style="padding-top:18px;gap:18px">
        <label class="stack" style="gap:6px"><span class="label">Nome da turma</span><input class="input" id="cname" value="${esc(c.name)}" maxlength="40" placeholder="Ex.: Família, Time da firma" style="height:52px;font-family:var(--display);font-weight:800;font-style:italic;font-size:22px;text-transform:uppercase"></label>
        <div class="stack" style="gap:10px"><span class="label">Duração da temporada</span>
          ${[['mes', 'Mês do calendário', ' · sugerido', 'Cada temporada vai do dia 1 ao último dia do mês. A primeira vai até o fim do mês em que você começar.'], ['dias', 'Personalizada', '', 'Você escolhe quantos dias tem cada temporada.']].map(([k, tt, s, d]) => `
          <button data-a="cset" data-k="mode" data-v="${k}" aria-pressed="${c.mode === k}" style="border-radius:14px;border:${c.mode === k ? '2px solid var(--asfalto)' : '1px solid var(--linha)'};background:${c.mode === k ? 'var(--giz)' : 'var(--superficie)'};padding:14px;text-align:left;display:flex;gap:12px;align-items:flex-start"><span style="width:22px;height:22px;flex:none;border-radius:999px;box-sizing:border-box;border:${c.mode === k ? '7px solid var(--asfalto)' : '2px solid var(--texto-suave)'};margin-top:2px"></span><span class="stack" style="gap:4px"><span style="font-weight:700;font-size:16px">${tt}<span class="muted">${s}</span></span><span style="font-size:14px;color:#2B3242">${d}</span></span></button>`).join('')}
          ${c.mode === 'dias' ? `<div class="row" style="justify-content:space-between"><span class="label">Dias por temporada</span><div class="row"><button class="round" data-a="cnum" data-k="days" data-d="-1" aria-label="Menos dias">${I.minus}</button><span class="disp" style="font-size:30px;min-width:48px;text-align:center">${c.days}</span><button class="round" data-a="cnum" data-k="days" data-d="1" aria-label="Mais dias">${I.plus}</button></div></div>` : ''}
        </div>
        <div class="muted">A duração vale para todas as temporadas. Uma emenda na outra, sem intervalo.</div>
        <button class="btn dark" data-a="create-next">Continuar</button>
      </div>`;
    return `${top}
      <div class="pad stack" style="padding-top:18px;gap:18px">
        <p style="margin:0;font-size:16px;line-height:23px">Quantos dias ativos a turma inteira deve somar na primeira temporada? Cada pessoa que treina num dia conta 1.</p>
        <div class="row" style="justify-content:space-between"><div><div class="label">Pessoas esperadas</div><div class="muted" style="font-size:12px">Só para calcular a sugestão</div></div><div class="row"><button class="round" data-a="cnum" data-k="people" data-d="-1" aria-label="Menos pessoas">${I.minus}</button><span class="disp" style="font-size:30px;min-width:36px;text-align:center">${c.people}</span><button class="round" data-a="cnum" data-k="people" data-d="1" aria-label="Mais pessoas">${I.plus}</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${sug.map((x) => `<button data-a="cset" data-k="meta" data-v="${x.v}" aria-pressed="${c.meta === x.v}" style="border-radius:12px;border:${c.meta === x.v ? '2px solid var(--raia)' : '1px solid var(--linha)'};background:${c.meta === x.v ? '#EEF1FD' : 'var(--superficie)'};padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:2px"><span class="disp" style="font-size:26px;${c.meta === x.v ? 'color:var(--raia)' : ''}">${x.v}</span><span style="font-weight:700;font-size:14px">${x.n}</span><span class="muted" style="font-size:12px">${num((x.v / c.people / Math.max(1, weeks)).toFixed(1))} por semana</span></button>`).join('')}</div>
        <label class="row" style="justify-content:space-between;padding:12px 14px;border-radius:12px;border:1px solid var(--linha)"><span><span class="label" style="display:block">Ou um número seu</span><span class="muted" style="font-size:12px">Máximo possível: ${max}</span></span><input id="cmeta" type="number" inputmode="numeric" min="1" value="${c.meta || ''}" class="input disp" style="width:96px;text-align:center;font-size:24px;color:var(--raia)"></label>
        <div class="muted">Você pode mudar a meta a qualquer momento e agendar a da próxima temporada. Se não agendar, ela se repete.</div>
        <button class="btn dark ${ui.busy ? 'spin' : ''}" data-a="create-finish">${ui.busy ? 'Criando…' : 'Criar e convidar'}</button>
      </div>`;
  },
};
const byNewest = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.created < b.created ? 1 : -1));

function postCard(c, showGroups) {
  const st = streakInfo(db, c.user);
  const gnames = showGroups ? c.groups.map((id) => db.groups.find((x) => x.id === id)).filter((x) => x && x.members.includes(ME)) : [];
  return `<article class="post">
    <div class="pad row" style="padding-top:12px;padding-bottom:12px">${avBtn(c.user)}<div style="flex:1;min-width:0"><div style="font-weight:700">${nameOf(c.user)}</div><div class="muted">${esc(c.cat)} · ${c.min} min · ${whenText(c)}</div>${gnames.length ? `<div class="chips" style="gap:4px;margin-top:4px">${gnames.map((x) => `<span style="height:22px;padding:0 8px;border-radius:999px;background:var(--giz);border:1px solid var(--linha);font-size:12px;font-weight:600;display:inline-flex;align-items:center">${esc(x.name)}</span>`).join('')}</div>` : ''}</div>${st.current ? `<span class="flamechip">${FLAME('#FF4F12', null, 12)}${st.current}</span>` : ''}</div>
    <button data-a="post" data-id="${c.id}" style="display:block;width:100%;border:0;padding:0;background:transparent" aria-label="Abrir post">${photoBox(c, c.photo ? 300 : 120)}</button>
    <div class="pad stack" style="padding-top:10px;padding-bottom:12px;gap:10px">
      ${c.desc ? `<div>${esc(c.desc)}</div>` : ''}
      <div class="row"><div class="chips" role="group" aria-label="Reações">${REACTS.map((e) => {
        const who = c.reactions[e] || []; const on = who.includes(ME);
        if (!who.length && !['🔥', '👏', '💪'].includes(e)) return '';
        return `<button class="react ${on ? 'on' : ''}" data-a="react" data-id="${c.id}" data-e="${e}" aria-pressed="${on}">${e}${who.length ? ' ' + who.length : ''}</button>`;
      }).join('')}</div><span style="flex:1"></span><button data-a="post" data-id="${c.id}" style="border:0;background:transparent;font-weight:600;color:var(--texto-suave);height:32px;flex:none">${c.comments.length ? c.comments.length + ' comentário' + (c.comments.length > 1 ? 's' : '') : 'Comentar'}</button></div>
    </div>
  </article>`;
}
function goalRow(goal, self, last) {
  const p = goalProgress(db, goal, db.today);
  if (goal.type === 'alcance') {
    const ctrlA = self ? (p.done ? `<span style="font-size:13px;font-weight:700;color:var(--ok);flex:none">Concluída</span>` : `<button data-a="sheet" data-s="progresso" data-id="${goal.id}" style="height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--linha);background:var(--superficie);font-weight:700;font-size:13px;flex:none">Atualizar</button>`)
      : `<span style="font-size:13px;font-weight:700;color:${p.done ? 'var(--ok)' : 'var(--texto-suave)'};flex:none">${p.done ? 'Concluída' : Math.round(p.pct) + '%'}</span>`;
    const prazo = goal.deadline && !p.done ? (goal.deadline < db.today ? ' · prazo passou' : ` · até ${D.short(goal.deadline)}`) : '';
    return `<div class="row" style="padding:12px 0;${last ? '' : 'border-bottom:1px solid var(--linha)'}">
    <span style="width:40px;height:40px;flex:none;border-radius:12px;background:${p.done ? '#E3F1E8' : 'var(--giz)'};color:${p.done ? 'var(--ok)' : 'inherit'};display:flex;align-items:center;justify-content:center">${GOAL_ICON.alcance}</span>
    <div style="flex:1;min-width:0;gap:6px" class="stack"><span style="font-weight:600">${esc(goal.title)}</span><span class="bar" style="height:6px"><i style="width:${p.pct}%;background:${p.done ? 'var(--ok)' : 'var(--brasa)'}"></i></span><span class="muted">${p.text}${prazo}${self ? ` · <button data-a="del-goal" data-id="${goal.id}" style="border:0;background:transparent;color:var(--texto-suave);text-decoration:underline;padding:0;font-size:13px">remover</button>` : ''}</span></div>${ctrlA}</div>`;
  }
  const isCheck = goal.type === 'comida' || goal.type === 'outra';
  const target = goal.type === 'agua' ? `${num(goal.target / 1000)} L de água por dia` : goal.type === 'sono' ? `Dormir ${hours(goal.target)} por noite` : esc(goal.target) + (goal.when === 'uteis' ? ' em dias úteis' : '');
  let ctrl = '';
  if (self) {
    if (goal.type === 'agua') ctrl = `<button class="round" data-a="goal" data-id="${goal.id}" data-d="250" aria-label="Somar 250 ml">${I.plus}</button>`;
    if (goal.type === 'sono') ctrl = `<div class="row" style="gap:4px"><button class="round" data-a="goal" data-id="${goal.id}" data-d="-0.5" aria-label="Menos meia hora">${I.minus}</button><button class="round" data-a="goal" data-id="${goal.id}" data-d="0.5" aria-label="Mais meia hora">${I.plus}</button></div>`;
    if (isCheck) ctrl = goal.when === 'uteis' && D.dow(db.today) > 4 ? '<span class="muted">folga</span>' : `<button data-a="goal" data-id="${goal.id}" aria-pressed="${p.done}" style="height:36px;padding:0 12px;border-radius:999px;border:${p.done ? '0' : '1px solid var(--linha)'};background:${p.done ? 'var(--ok)' : 'var(--superficie)'};color:${p.done ? '#fff' : 'var(--texto)'};font-weight:700;font-size:13px;flex:none">${p.done ? 'Cumpri hoje' : 'Marcar hoje'}</button>`;
  } else {
    ctrl = `<span style="font-size:13px;font-weight:700;color:${p.done ? 'var(--ok)' : 'var(--folga)'};flex:none">${p.done ? 'em dia' : isCheck ? 'hoje não' : 'ainda não'}</span>`;
  }
  const sub = goal.type === 'sono' ? (p.v == null ? 'Esta noite: sem registro' : `Esta noite: ${hours(p.v)}`) : goal.type === 'agua' ? `Hoje: ${p.text}` : p.text;
  return `<div class="row" style="padding:12px 0;${last ? '' : 'border-bottom:1px solid var(--linha)'}">
    <span style="width:40px;height:40px;flex:none;border-radius:12px;background:var(--giz);display:flex;align-items:center;justify-content:center">${GOAL_ICON[goal.type]}</span>
    <div style="flex:1;min-width:0" class="stack"><span style="font-weight:600">${target}</span>${goal.type === 'agua' ? `<span class="bar" style="height:6px"><i style="width:${p.pct}%;background:var(--asfalto)"></i></span>` : ''}<span class="muted">${sub}${self ? ` · <button data-a="del-goal" data-id="${goal.id}" style="border:0;background:transparent;color:var(--texto-suave);text-decoration:underline;padding:0;font-size:13px">remover</button>` : ''}</span></div>${ctrl}</div>`;
}

/* ===================== Folhas ===================== */
const SHEETS = {
  grupos() {
    return `<h2 class="title" style="font-size:24px">Trocar de turma</h2>
      ${myGroups().length > 1 ? `<button class="card row" data-a="feed-all" style="border:1px solid var(--linha);text-align:left;${ui.feedAll ? 'box-shadow:inset 0 0 0 2px var(--asfalto)' : ''}"><span style="flex:1;font-weight:700">Todas as turmas</span><span class="muted">posts de todas</span></button>` : ''}
      ${myGroups().map((g) => `<button class="card row" data-a="open-group" data-g="${g.id}" style="border:1px solid var(--linha);text-align:left;${g.id === ui.group && !ui.feedAll ? 'box-shadow:inset 0 0 0 2px var(--asfalto)' : ''}"><span style="flex:1;font-weight:700">${esc(g.name)}</span><span class="muted">${g.members.length} pessoa${g.members.length > 1 ? 's' : ''}</span></button>`).join('')}
      <button class="btn ghost small" data-a="go" data-to="turmas">Gerenciar turmas</button>`;
  },
  chamar() {
    const g = ui.feedAll ? myGroups()[0] : G();
    const t = g && g.started ? groupToday(db, g) : null;
    const us = ui.sheetData.users;
    const nomes = us.map((u) => userById(u).name).join(' e ');
    const msg = `Bora, ${nomes}! Ainda dá tempo de acender a chama hoje.${t ? ` A turma ${g.name} está em ${t.total} de ${t.meta} dias ativos.` : ''} ${location.origin}`;
    return `<h2 class="title" style="font-size:24px">Chamar ${esc(nomes)}</h2>
      <div style="border-radius:12px;background:var(--giz);padding:12px 14px;font-size:15px;line-height:21px">"${esc(msg)}"</div>
      <button class="btn brasa ${ui.busy ? 'spin' : ''}" data-a="chamar-app">Chamar no app</button>
      <div class="row"><a class="btn ghost small" style="flex:2" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" data-a="chamar-wa">${I.wa} Abrir WhatsApp</a><button class="btn ghost small" style="flex:1" data-a="copy" data-t="${esc(msg)}">Copiar</button></div>
      <div class="muted">No app, a pessoa vê o seu chamado quando abrir o Chama. Cada pessoa pode ser chamada por você uma vez por dia.</div>`;
  },
  'meta-atual'() {
    const g = G(); const t = groupToday(db, g);
    return `<h2 class="title" style="font-size:24px">Meta de ${esc(t.s.name.toLowerCase())}</h2><div class="muted">Hoje: ${t.total} dias ativos. Máximo possível: ${t.max}.</div><input id="metaval" type="number" inputmode="numeric" class="input disp" value="${t.meta}" style="height:56px;font-size:30px;text-align:center;color:var(--raia)"><button class="btn dark" data-a="save-meta" data-k="${t.s.key}">Salvar meta</button>`;
  },
  'meta-prox'() {
    const g = G(); const t = groupToday(db, g); const ns = seasonNext(g, t.s);
    const max = g.members.length * (D.diff(ns.start, ns.end) + 1);
    return `<h2 class="title" style="font-size:24px">Meta de ${esc(g.mode === 'mes' ? ns.name.toLowerCase() : 'depois')}</h2><div class="muted">${D.short(ns.start)} a ${D.short(ns.end)}. Máximo possível: ${max}. Se você não agendar, repete ${t.meta}.</div><input id="metaval" type="number" inputmode="numeric" class="input disp" value="${g.metas[ns.key] != null ? g.metas[ns.key] : t.meta}" style="height:56px;font-size:30px;text-align:center;color:var(--raia)"><button class="btn dark" data-a="save-meta" data-k="${ns.key}">Agendar meta</button>`;
  },
  addgoal() {
    const n = ui.newGoal;
    const types = [['comida', 'Alimentação'], ['agua', 'Hidratação'], ['sono', 'Sono'], ['outra', 'Personalizada']];
    const kind = `<div class="seg" role="group" aria-label="Tipo de meta"><button class="${n.kind === 'rotina' ? 'on' : ''}" data-a="ngkind" data-v="rotina" aria-pressed="${n.kind === 'rotina'}">Rotina diária</button><button class="${n.kind === 'alcance' ? 'on' : ''}" data-a="ngkind" data-v="alcance" aria-pressed="${n.kind === 'alcance'}">Alcance</button></div>`;
    if (n.kind === 'alcance') {
      const units = ['km', 'kg', 'min', 'vezes', 'livros'];
      return `<h2 class="title" style="font-size:24px">Nova meta pessoal</h2>${kind}
      <div class="muted">Um objetivo com ponto de chegada. Você vai atualizando quanto já alcançou.</div>
      <label class="stack" style="gap:6px"><span class="label">Objetivo</span><input class="input" id="ngtitle" maxlength="60" value="${esc(n.title)}" placeholder="Ex.: Correr 21 km, Perder 5 kg"></label>
      <div class="row" style="align-items:flex-end">
        <label class="stack" style="gap:6px;flex:1"><span class="label">Alvo</span><input class="input" id="ngtarget" type="text" inputmode="decimal" value="${n.target ?? ''}" placeholder="21"></label>
        <label class="stack" style="gap:6px;flex:1"><span class="label">Unidade</span><input class="input" id="ngunit" maxlength="12" value="${esc(n.unit)}" placeholder="km"></label>
      </div>
      <div class="chips">${units.map((u) => `<button class="chip ${n.unit === u ? 'on' : ''}" data-a="ngunit" data-v="${u}">${u}</button>`).join('')}</div>
      <label class="stack" style="gap:6px"><span class="label">Prazo (opcional)</span><input class="input" id="ngdeadline" type="date" min="${db.today}" value="${n.deadline || ''}"></label>
      <div style="padding:12px 14px;border-radius:12px;background:var(--giz);font-size:14px;line-height:20px">Para "perder 5 kg", registre quantos quilos já perdeu. Quem está nas suas turmas vê o progresso. Não conta no placar nem na chama.</div>
      <button class="btn dark" data-a="save-goal">Salvar meta</button>`;
    }
    let field = '';
    if (n.type === 'agua') field = `<div class="row" style="justify-content:space-between"><div><div class="label">Água por dia</div><div class="muted" style="font-size:12px">Passos de 250 ml</div></div><div class="row"><button class="round" data-a="ng" data-d="-250" aria-label="Diminuir">${I.minus}</button><span class="disp" style="font-size:32px;min-width:76px;text-align:center">${num(n.agua / 1000)} L</span><button class="round" data-a="ng" data-d="250" aria-label="Aumentar">${I.plus}</button></div></div>`;
    if (n.type === 'sono') field = `<div class="row" style="justify-content:space-between"><div class="label">Horas por noite</div><div class="row"><button class="round" data-a="ng" data-d="-0.5" aria-label="Diminuir">${I.minus}</button><span class="disp" style="font-size:32px;min-width:76px;text-align:center">${hours(n.sono)}</span><button class="round" data-a="ng" data-d="0.5" aria-label="Aumentar">${I.plus}</button></div></div>`;
    if (n.type === 'comida') field = `<label class="stack" style="gap:6px"><span class="label">Sua meta</span><input class="input" id="ngtext" maxlength="60" value="${esc(n.comida)}" placeholder="Ex.: fruta no café da manhã"></label>`;
    if (n.type === 'outra') field = `<label class="stack" style="gap:6px"><span class="label">Sua meta</span><input class="input" id="ngtext" maxlength="60" value="${esc(n.outra)}" placeholder="Ex.: meditar 10 min, ler 20 páginas"><span class="muted" style="font-size:12px">Todo dia você marca se cumpriu.</span></label>`;
    return `<h2 class="title" style="font-size:24px">Nova meta pessoal</h2>${kind}
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${types.map(([k, l]) => `<button data-a="ngtype" data-v="${k}" aria-pressed="${n.type === k}" style="height:68px;border-radius:14px;border:${n.type === k ? '2px solid var(--asfalto)' : '1px solid var(--linha)'};background:${n.type === k ? 'var(--giz)' : 'var(--superficie)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-weight:${n.type === k ? 700 : 600};font-size:14px">${GOAL_ICON[k]}${l}</button>`).join('')}</div>
      ${field}
      <div class="stack" style="gap:8px"><div class="label">Quando</div><div class="chips"><button class="chip dark ${n.when === 'todos' ? 'on' : ''}" data-a="ngwhen" data-v="todos">Todos os dias</button><button class="chip dark ${n.when === 'uteis' ? 'on' : ''}" data-a="ngwhen" data-v="uteis">Dias úteis</button></div></div>
      <div style="padding:12px 14px;border-radius:12px;background:var(--giz);font-size:14px;line-height:20px">Você marca o progresso todo dia no seu perfil. Quem está nas suas turmas vê a meta e como você está indo. Ela não conta no placar nem na chama.</div>
      <button class="btn dark" data-a="save-goal">Salvar meta</button>`;
  },
  progresso() {
    const goal = db.goals.find((x) => x.id === ui.sheetData.id);
    const p = goalProgress(db, goal, db.today);
    return `<h2 class="title" style="font-size:24px">${esc(goal.title)}</h2>
      <div class="muted">Até agora: ${p.text}. Quanto você já alcançou?</div>
      <div class="row"><input id="progval" type="text" inputmode="decimal" class="input disp" value="${p.v ? num(p.v) : ''}" style="height:56px;font-size:30px;text-align:center;flex:1"><span class="disp" style="font-size:26px">${esc(goal.unit || '')}</span></div>
      <button class="btn brasa" data-a="save-progress" data-id="${goal.id}">Salvar progresso</button>`;
  },
  codigo() {
    return `<h2 class="title" style="font-size:24px">Entrar com código</h2><input class="input" id="code" placeholder="Ex.: CHM-1234" autocapitalize="characters" style="text-transform:uppercase"><button class="btn dark" data-a="check-code">Continuar</button>`;
  },
  entrar() {
    const j = ui.join;
    const late = !!j.started_at;
    const eff = effectiveFromFor(j, db.today);
    return `<h2 class="title" style="font-size:24px">Entrar na ${esc(j.name)}</h2>
      <div class="muted">${j.members} pessoa${j.members > 1 ? 's' : ''} na turma.</div>
      ${late ? `<div class="card" style="background:var(--giz)">A temporada já está rolando. Você entra no placar <strong>a partir de hoje (${D.short(eff)})</strong>; os dias de antes não contam.</div>` : '<div class="card" style="background:var(--giz)">A temporada ainda não começou. Você já entra na disputa da primeira.</div>'}
      <button class="btn dark ${ui.busy ? 'spin' : ''}" data-a="join">Entrar na turma</button>`;
  },
  instalar() {
    const ios = isIOS();
    return `<h2 class="title" style="font-size:24px">Instalar o Chama</h2>
      <div>Com o Chama na tela de início, ele abre como um aplicativo, em tela cheia${ios ? ' e pode receber avisos da turma' : ''}.</div>
      ${ios ? `<ol style="margin:0;padding-left:20px;line-height:1.7"><li>Abra este endereço no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong> ${I.share} na barra de baixo.</li><li>Escolha <strong>Adicionar à Tela de Início</strong> e toque em <strong>Adicionar</strong>.</li><li>Abra o Chama pelo ícone da chama.</li></ol>`
        : installEvent ? `<button class="btn brasa" data-a="install">Instalar agora</button>`
        : `<ol style="margin:0;padding-left:20px;line-height:1.7"><li>Abra este endereço no <strong>Chrome</strong>.</li><li>Toque no menu <strong>⋮</strong> no canto de cima.</li><li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li></ol>`}`;
  },
  conta() {
    return `<h2 class="title" style="font-size:24px">Sua conta</h2>
      <button class="btn ghost small" data-a="edit-profile">Editar foto, nome e cor</button>
      ${myGroups().filter((g) => g.leader !== ME).map((g) => `<button class="btn ghost small" data-a="leave" data-g="${g.id}">Sair da turma ${esc(g.name)}</button>`).join('')}
      <button class="btn ghost small" data-a="logout">Sair do Chama neste aparelho</button>
      <button class="btn ghost small" data-a="sheet" data-s="apagar" style="color:var(--apagada)">Apagar meus dados</button>
      <div class="muted">Fotos, treinos e metas ficam visíveis só para quem está nas mesmas turmas que você.</div>
      <button class="btn ghost small" data-a="update-app">Atualizar o app</button>
      <button class="version" data-a="diag" style="border:0;background:transparent;width:100%">${VERSION} · ${isStandalone() ? 'app instalado' : 'navegador'}${diagOn ? ' · diagnóstico ligado' : ''}</button>`;
  },
  apagar() {
    return `<h2 class="title" style="font-size:24px">Apagar meus dados</h2><div>Isso apaga todos os seus treinos, fotos e metas, e tira você de todas as turmas. Não dá para desfazer.</div><button class="btn dark" data-a="delete-data" style="background:var(--apagada)">Apagar tudo</button><button class="btn ghost small" data-a="close-sheet">Cancelar</button>`;
  },
};

/* ===================== Render ===================== */
// Guarda o que a pessoa digitou (e o foco) antes de redesenhar, e devolve depois.
function keepTyping(fn) {
  const typed = {};
  document.querySelectorAll('#main input[id], #main textarea[id], #layer input[id], #layer textarea[id]').forEach((el) => {
    if (el.type !== 'file' && el.value !== el.defaultValue) typed[el.id] = el.value;
  });
  const act = document.activeElement;
  const focusId = act && act.id && (act.tagName === 'INPUT' || act.tagName === 'TEXTAREA') ? act.id : null;
  fn();
  for (const id in typed) { const el = document.getElementById(id); if (el && el.type !== 'file') el.value = typed[id]; }
  if (focusId) { const el = document.getElementById(focusId); if (el && document.activeElement !== el) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
}
const isTyping = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.type !== 'file'; };
function render() { keepTyping(renderNow); }
function renderNow() {
  const main = document.getElementById('main');
  const navEl = document.getElementById('nav');
  const layer = document.getElementById('layer');
  if (!api.configured) { main.innerHTML = screenSetup(); navEl.hidden = true; return; }
  if (!ME) { main.innerHTML = screenLogin(); navEl.hidden = true; main.classList.add('nonav'); layer.innerHTML = ''; return; }
  if (!db) { main.innerHTML = '<div class="empty">Carregando…</div>'; return; }
  if (!db.users[ME] || db.users[ME].name === 'Sem nome' || ui.screen === 'onboarding') { main.innerHTML = screenOnboarding(); navEl.hidden = true; main.classList.add('nonav'); layer.innerHTML = ''; attachAvatar(); return; }
  main.classList.remove('nonav');
  navEl.hidden = false;
  const scr = SCREENS[ui.screen] ? ui.screen : 'feed';
  main.innerHTML = SCREENS[scr]();
  const tab = { feed: 'feed', post: 'feed', temporada: 'temporada', registrar: 'registrar', sucesso: 'registrar', turmas: 'turmas', criar: 'turmas', perfil: ui.viewUser && ui.viewUser !== ME ? 'feed' : 'perfil', historico: 'perfil' }[scr];
  navEl.innerHTML = `
    <button class="${tab === 'feed' ? 'on' : ''}" data-a="go" data-to="feed">${I.home}Mural</button>
    <button class="${tab === 'temporada' ? 'on' : ''}" data-a="go" data-to="temporada">${I.chart}Temporada</button>
    <button class="fire" data-a="go" data-to="registrar" aria-label="Acender a chama">${FLAME('#121826', null, 24)}</button>
    <button class="${tab === 'turmas' ? 'on' : ''}" data-a="go" data-to="turmas">${I.people}Turmas</button>
    <button class="${tab === 'perfil' ? 'on' : ''}" data-a="me">${I.user}Perfil</button>`;
  layer.innerHTML = (ui.sheet ? `<div class="sheet-wrap" data-a="close-sheet"><div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="row" style="justify-content:flex-end;margin-top:-8px"><button class="round" data-a="close-sheet" aria-label="Fechar">${I.close}</button></div>${SHEETS[ui.sheet]()}</div></div>` : '');
  const foto = document.getElementById('foto');
  if (foto) foto.addEventListener('change', onPhoto);
}
function attachAvatar() { const a = document.getElementById('avatarfile'); if (a) a.addEventListener('change', onAvatar); }
// O aviso fica num elemento próprio: aparecer e sumir não redesenha a tela (não fecha o teclado).
let toastTimer;
function toast(t) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = t; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}
const toTop = () => window.scrollTo(0, 0);
function go(screen, extra) { Object.assign(ui, { screen, sheet: null }, extra || {}); render(); toTop(); }
function goPush(screen, extra) { navStack.push({ screen: ui.screen, viewUser: ui.viewUser, postId: ui.postId, histUser: ui.histUser }); go(screen, extra); }
const newForm = () => ({ when: 'hoje', photo: null, blob: null, cat: 'Musculação', min: 45, desc: '', groups: myGroups().filter((g) => g.started).map((g) => g.id) });
const errMsg = (e) => (e && e.message ? e.message : String(e));

async function reload(quiet) {
  db = await api.loadAll(ME);
  db.today = D.today();
  if (!db.groups.find((g) => g.id === ui.group)) ui.group = (myGroups()[0] || {}).id || null;
  if (quiet && isTyping()) return; // atualização de fundo: não mexe na tela enquanto a pessoa digita
  render();
}
async function run(fn, okMsg) {
  if (ui.busy) return;
  ui.busy = true; render();
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) { console.error(e); toast('Não deu certo: ' + errMsg(e)); }
  finally { ui.busy = false; render(); }
}

/* ===================== Ações ===================== */
const A = {
  async login() {
    const email = (document.getElementById('email').value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Digite um e-mail válido.');
    ui.email = email;
    await run(async () => { await api.sendLink(email); ui.sent = true; store('chama-email', email); });
  },
  diag() { diagTaps++; if (diagTaps >= 5) { diagTaps = 0; setDiag(!diagOn); render(); } },
  async 'update-app'() {
    try { const regs = await navigator.serviceWorker?.getRegistrations?.() || []; for (const r of regs) await r.unregister(); const ks = await caches?.keys?.() || []; for (const k of ks) await caches.delete(k); } catch (e) {}
    location.reload();
  },
  relogin() { ui.sent = false; store('chama-email', null); render(); },
  async verify() {
    const code = ((document.getElementById('otp') || {}).value || '').replace(/\D/g, '');
    if (code.length < 6) return toast('Digite o código que chegou no e-mail.');
    await run(async () => { await api.verifyCode(ui.email, code); });
  },
  pcolor(d) { ui.pname = (document.getElementById('pname') || {}).value; ui.color = d.c; render(); },
  async 'save-profile'() {
    const name = (document.getElementById('pname').value || '').trim();
    if (!name) return toast('Diga como a turma te chama.');
    await run(async () => { await api.saveProfile(ME, name, ui.color || db.users[ME].bg); ui.screen = 'feed'; ui.pname = null; await reload(); await checkPendingInvite(); });
  },
  async 'del-avatar'() { ui.pname = (document.getElementById('pname') || {}).value ?? ui.pname; await run(async () => { await api.saveAvatar(ME, null, db.users[ME].photo_path); await reload(); }, 'Foto removida.'); },
  'edit-profile'() { ui.color = db.users[ME].bg; ui.pname = null; go('onboarding'); },
  go(d) {
    if (d.to === 'registrar') { ui.form = newForm(); ui.allCats = false; }
    go(d.to, { viewUser: null });
  },
  back() { const p = navStack.pop(); if (p) go(p.screen, p); else go('feed'); },
  me() { go('perfil', { viewUser: null }); },
  perfil(d) { goPush('perfil', { viewUser: d.u === ME ? null : d.u }); },
  post(d) { goPush('post', { postId: d.id }); },
  hist(d) { goPush('historico', { histUser: d.u, histMonth: db.today.slice(0, 7), histDay: null }); },
  hmonth(d) { ui.histMonth = d.m; ui.histDay = null; render(); },
  hday(d) { ui.histDay = d.d; render(); },
  sheet(d) {
    if (d.s === 'addgoal') ui.newGoal = { kind: 'rotina', type: 'agua', agua: 2000, sono: 7, comida: '', outra: '', when: 'todos', title: '', target: null, unit: 'km', deadline: '' };
    if (d.s === 'progresso') ui.sheetData = { id: d.id };
    ui.sheet = d.s; render();
  },
  'close-sheet'() { ui.sheet = null; render(); },
  'open-group'(d) { ui.group = d.g; ui.feedAll = false; store('chama-turma', d.g); go('feed'); },
  'feed-all'() { ui.feedAll = true; go('feed'); },
  form(d) { ui.form.desc = (document.getElementById('desc') || {}).value ?? ui.form.desc; ui.form[d.k] = d.v; render(); },
  allcats() { ui.form.desc = (document.getElementById('desc') || {}).value ?? ui.form.desc; ui.allCats = true; render(); },
  min(d) { ui.form.desc = (document.getElementById('desc') || {}).value ?? ui.form.desc; ui.form.min = Math.max(5, Math.min(300, ui.form.min + Number(d.d))); render(); },
  tgroup(d) { const f = ui.form; f.desc = (document.getElementById('desc') || {}).value ?? f.desc; f.groups = f.groups.includes(d.g) ? f.groups.filter((x) => x !== d.g) : [...f.groups, d.g]; render(); },
  async submit() {
    const f = ui.form;
    f.desc = ((document.getElementById('desc') || {}).value || '').trim();
    if (!f.groups.length) return toast('Escolha pelo menos uma turma.');
    const date = f.when === 'hoje' ? db.today : D.add(db.today, -1);
    const groups = f.groups.filter((gid) => { const g = db.groups.find((x) => x.id === gid); return date >= seasonAt(g, db.today).start; });
    const target = f.groups.includes(ui.group) ? ui.group : f.groups[0];
    const gObj = db.groups.find((g) => g.id === target);
    const before = groupToday(db, gObj).rows.find((r) => r.u === ME);
    await run(async () => {
      const photo_path = f.blob ? await api.uploadPhoto(ME, f.blob) : null;
      await api.addCheckin(ME, { date, cat: f.cat, min: f.min, desc: f.desc, photo_path, groups });
      await reload();
      ui.success = { group: target, rankBefore: before ? before.pos : null, counted: f.min >= 30 };
      ui.screen = 'sucesso'; toTop();
    });
  },
  async react(d) {
    const c = db.checkins.find((x) => x.id === d.id);
    const list = c.reactions[d.e] || (c.reactions[d.e] = []);
    const on = !list.includes(ME);
    if (on) list.push(ME); else list.splice(list.indexOf(ME), 1);
    render();
    try { await api.toggleReaction(ME, c.id, d.e, on); } catch (e) { toast('Não deu certo: ' + errMsg(e)); await reload(); }
  },
  async comment(d) {
    const v = (document.getElementById('comment').value || '').trim();
    if (!v) return;
    await run(async () => { await api.addComment(ME, d.id, v); await reload(); });
  },
  chamar(d) { ui.sheetData = { users: d.u.split(',') }; ui.sheet = 'chamar'; render(); },
  async 'chamar-app'() {
    const us = ui.sheetData.users;
    await run(async () => { await api.call(ME, us, ui.feedAll ? null : ui.group); us.forEach((u) => { db.chamados[`${db.today}|${ME}|${u}`] = true; }); ui.sheet = null; }, `${us.map((u) => userById(u).name).join(' e ')} ${us.length > 1 ? 'foram chamados' : 'foi chamado(a)'}.`);
  },
  'chamar-wa'() { const us = ui.sheetData.users; api.call(ME, us, ui.feedAll ? null : ui.group).then(() => us.forEach((u) => { db.chamados[`${db.today}|${ME}|${u}`] = true; })).catch(() => {}); return true; },
  copy(d) {
    try { navigator.clipboard.writeText(d.t).then(() => toast('Copiado.'), () => toast('Não deu para copiar. Selecione o texto e copie.')); } catch (e) { toast('Não deu para copiar. Selecione o texto e copie.'); }
  },
  'invite-link'(d) { const g = db.groups.find((x) => x.id === d.g); A.copy({ t: `Entra na turma ${g.name} no Chama: ${location.origin}/?entrar=${g.code} (código ${g.code})` }); },
  async 'save-meta'(d) {
    const v = parseInt(document.getElementById('metaval').value, 10);
    if (!(v > 0)) return toast('A meta precisa ser maior que zero.');
    await run(async () => { await api.saveMeta(ui.group, d.k, v); ui.sheet = null; await reload(); }, 'Meta salva.');
  },
  async goal(d) {
    const goal = db.goals.find((x) => x.id === d.id);
    const log = db.goalLog[goal.id] || (db.goalLog[goal.id] = {});
    let v;
    if (goal.type === 'agua') v = (Number(log[db.today]) || 0) + Number(d.d);
    if (goal.type === 'sono') v = Math.max(0, Math.min(14, (log[db.today] != null ? Number(log[db.today]) : goal.target) + Number(d.d)));
    if (goal.type === 'comida' || goal.type === 'outra') v = !log[db.today];
    log[db.today] = v; render();
    try { await api.logGoal(goal, db.today, v); } catch (e) { toast('Não deu certo: ' + errMsg(e)); await reload(); }
  },
  async 'del-goal'(d) { await run(async () => { await api.deleteGoal(d.id); await reload(); }, 'Meta removida.'); },
  ngtype(d) { ui.newGoal.type = d.v; render(); },
  ngkind(d) { keepAlcance(); ui.newGoal.kind = d.v; render(); },
  ngunit(d) { keepAlcance(); ui.newGoal.unit = d.v; render(); },
  async 'save-progress'(d) {
    const goal = db.goals.find((x) => x.id === d.id);
    const v = parseFloat(String(document.getElementById('progval').value).replace(',', '.'));
    if (!(v >= 0)) return toast('Digite um número.');
    await run(async () => { await api.logGoal(goal, db.today, v); ui.sheet = null; await reload(); }, v >= goal.target ? 'Meta concluída! 🔥' : 'Progresso salvo.');
  },
  ngwhen(d) { ui.newGoal.when = d.v; render(); },
  ng(d) { const n = ui.newGoal; if (n.type === 'agua') n.agua = Math.max(250, n.agua + Number(d.d)); else n.sono = Math.max(4, Math.min(12, n.sono + Number(d.d))); render(); },
  async 'save-goal'() {
    const n = ui.newGoal;
    if (n.kind === 'alcance') {
      keepAlcance();
      if (!n.title) return toast('Escreva o objetivo.');
      if (!(n.target > 0)) return toast('Diga o alvo, em número.');
      return run(async () => { await api.addGoal(ME, { type: 'alcance', title: n.title, target: n.target, unit: n.unit, deadline: n.deadline || null }); ui.sheet = null; await reload(); }, 'Meta salva no seu perfil.');
    }
    if (n.type === 'comida' || n.type === 'outra') { n[n.type] = (document.getElementById('ngtext').value || '').trim(); if (!n[n.type]) return toast('Escreva sua meta.'); }
    const old = n.type !== 'outra' ? db.goals.find((g) => g.user === ME && g.type === n.type) : null;
    await run(async () => {
      if (old) await api.deleteGoal(old.id);
      await api.addGoal(ME, { type: n.type, target: n.type === 'agua' ? n.agua : n.type === 'sono' ? n.sono : n[n.type], when: n.when });
      ui.sheet = null; await reload();
    }, 'Meta salva no seu perfil.');
  },
  async 'check-code'() {
    const code = (document.getElementById('code').value || '').trim().toUpperCase();
    if (!code) return;
    await run(async () => { const g = await api.groupByCode(code); if (!g) throw new Error('nenhuma turma com esse código'); ui.join = { ...g, code }; ui.sheet = 'entrar'; });
  },
  async join() {
    const j = ui.join;
    await run(async () => { const id = await api.joinGroup(j.code, effectiveFromFor(j, db.today)); store('chama-convite', null); ui.sheet = null; ui.group = id; ui.feedAll = false; await reload(); ui.screen = 'feed'; }, `Você entrou na ${j.name}.`);
  },
  'create-start'() { ui.create = { step: 1, name: '', mode: 'mes', days: 14, people: 5, meta: null }; go('criar'); },
  'create-back'() { if (ui.create.step > 1) { ui.create.step--; render(); } else go(myGroups().length ? 'turmas' : 'feed'); },
  cset(d) { if (ui.create.step === 1) ui.create.name = (document.getElementById('cname') || {}).value ?? ui.create.name; ui.create[d.k] = d.k === 'meta' ? Number(d.v) : d.v; render(); },
  cnum(d) { const c = ui.create; if (c.step === 1) c.name = (document.getElementById('cname') || {}).value ?? c.name; if (d.k === 'days') c.days = Math.max(3, Math.min(90, c.days + Number(d.d))); else { c.people = Math.max(2, Math.min(30, c.people + Number(d.d))); c.meta = null; } render(); },
  'create-next'() {
    const c = ui.create;
    c.name = (document.getElementById('cname').value || '').trim();
    if (!c.name) return toast('Dê um nome para a turma.');
    c.step = 2;
    if (!c.meta) { const end = c.mode === 'mes' ? D.lom(db.today) : D.add(db.today, c.days - 1); c.meta = Math.max(1, Math.round(c.people * (D.diff(db.today, end) + 1) * 0.7)); }
    render();
  },
  async 'create-finish'() {
    const c = ui.create;
    const v = parseInt(document.getElementById('cmeta').value, 10);
    if (v > 0) c.meta = v;
    await run(async () => { const id = await api.createGroup(c); ui.group = id; ui.feedAll = false; store('chama-turma', id); await reload(); ui.screen = 'feed'; }, `Turma ${c.name} criada. Agora convide a turma.`);
  },
  async 'start-group'(d) { await run(async () => { await api.startGroup(d.g); await reload(); }, 'Temporada começou. Bora!'); },
  async install() { if (installEvent) { installEvent.prompt(); await installEvent.userChoice; installEvent = null; ui.sheet = null; render(); } },
  async leave(d) { await run(async () => { await api.leaveGroup(ME, d.g); ui.sheet = null; await reload(); }, 'Você saiu da turma.'); },
  async logout() { await api.signOut(); location.reload(); },
  async 'delete-data'() { await run(async () => { await api.deleteMyData(ME); await api.signOut(); location.reload(); }); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const fn = A[el.dataset.a];
  if (!fn) return;
  if (el.tagName === 'A' && (el.getAttribute('href') || '').startsWith('http')) { fn(el.dataset, el, ev); return; }
  if (el.dataset.a === 'close-sheet' && el.classList.contains('sheet-wrap') && ev.target !== el) return;
  ev.preventDefault();
  fn(el.dataset, el, ev);
});
/* ---------- Diagnóstico (liga com 5 toques na versão, em Perfil > ⚙) ---------- */
let diagOn = stored('chama-diag') === '1';
let diagTaps = 0;
const diagLines = [];
const descEl = (e) => !e ? '-' : (e.tagName || '?').toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '');
function dlog(t) {
  if (!diagOn) return;
  diagLines.push(new Date().toISOString().slice(17, 23) + ' ' + t);
  while (diagLines.length > 18) diagLines.shift();
  let el = document.getElementById('diag');
  if (!el) { el = document.createElement('div'); el.id = 'diag'; document.body.appendChild(el); }
  el.textContent = diagLines.join('\n');
}
function setDiag(on) {
  diagOn = on; store('chama-diag', on ? '1' : null);
  const el = document.getElementById('diag'); if (el && !on) el.remove();
  if (on) dlog('diagnóstico ligado · ' + VERSION + ' · ' + (isStandalone() ? 'instalado' : 'navegador') + ' · ' + innerWidth + 'x' + innerHeight);
}
['touchstart', 'touchend', 'click'].forEach((t) => document.addEventListener(t, (ev) => {
  if (!diagOn) return;
  const p = ev.changedTouches ? ev.changedTouches[0] : ev;
  const x = Math.round(p.clientX), y = Math.round(p.clientY);
  dlog(t + ' alvo=' + descEl(ev.target) + ' ponto=' + descEl(document.elementFromPoint(x, y)) + ' @' + x + ',' + y + (ev.defaultPrevented ? ' PREVENIDO' : ''));
}, { capture: true, passive: true }));
document.addEventListener('focusin', (ev) => dlog('focusin ' + descEl(ev.target)), true);
document.addEventListener('focusout', (ev) => dlog('focusout ' + descEl(ev.target) + ' -> ' + descEl(ev.relatedTarget)), true);
if (diagOn) setTimeout(() => setDiag(true), 0);

// iPhone com o app instalado na tela de início: às vezes o toque num campo não abre o teclado.
// Aqui o próprio app ativa o campo no fim do toque (dentro do gesto, então o teclado abre).
document.addEventListener('touchend', (ev) => {
  const t = ev.target.closest('input, textarea, label');
  if (!t) return;
  const field = t.tagName === 'LABEL' ? t.querySelector('input:not([type=file]), textarea') : t;
  if (!field || field.type === 'file' || field.disabled || document.activeElement === field) return;
  if (t.tagName === 'LABEL' && ev.target.closest('button, [data-a]')) return;
  field.focus();
}, { passive: true });
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && ui.sheet) { ui.sheet = null; render(); }
  if (ev.key === 'Enter') {
    const map = { comment: 'comment', email: 'login', code: 'check-code', otp: 'verify' };
    const a = map[ev.target.id];
    if (a) { const b = document.querySelector(`[data-a="${a}"]`); if (b) b.click(); }
  }
});
function onPhoto(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  ui.form.desc = (document.getElementById('desc') || {}).value ?? ui.form.desc;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, 1280 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => { ui.form.blob = blob; ui.form.photo = URL.createObjectURL(blob); URL.revokeObjectURL(url); render(); }, 'image/jpeg', 0.8);
  };
  img.onerror = () => toast('Não deu para ler essa foto. Tente outra.');
  img.src = url;
}

function keepAlcance() {
  const n = ui.newGoal; if (!n || n.kind !== 'alcance') return;
  const g = (id) => document.getElementById(id);
  if (g('ngtitle')) n.title = g('ngtitle').value.trim();
  if (g('ngtarget')) { const t = parseFloat(String(g('ngtarget').value).replace(',', '.')); n.target = t > 0 ? t : null; }
  if (g('ngunit')) n.unit = g('ngunit').value.trim();
  if (g('ngdeadline')) n.deadline = g('ngdeadline').value;
}
function squareJpeg(file, size) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
      cv.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      cv.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('foto')); }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Não deu para ler essa foto.'));
    img.src = url;
  });
}
async function onAvatar(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  ui.pname = (document.getElementById('pname') || {}).value ?? ui.pname;
  await run(async () => { const blob = await squareJpeg(file, 320); await api.saveAvatar(ME, blob, db.users[ME].photo_path); await reload(); }, 'Foto atualizada.');
}
async function checkPendingInvite() {
  const code = stored('chama-convite');
  if (!code || !db) return;
  try {
    const g = await api.groupByCode(code);
    store('chama-convite', null);
    if (!g) return toast('O código do convite não existe mais.');
    if (db.groups.some((x) => x.id === g.id)) { ui.group = g.id; render(); return; }
    ui.join = { ...g, code }; ui.sheet = 'entrar'; render();
  } catch (e) { console.error(e); }
}

/* ===================== Início ===================== */
async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('entrar')) { store('chama-convite', params.get('entrar').toUpperCase()); history.replaceState(null, '', '/'); }
  if (!api.configured) return render();
  ui.group = stored('chama-turma');
  if (stored('chama-email')) { ui.email = stored('chama-email'); ui.sent = true; }
  const s = await api.session();
  if (s) { ME = s.user.id; store('chama-email', null); render(); await reload(); await checkPendingInvite(); }
  else render();
  api.sb.auth.onAuthStateChange(async (event, sess) => {
    if (event === 'SIGNED_IN' && sess && sess.user.id !== ME) { ME = sess.user.id; store('chama-email', null); await reload(); await checkPendingInvite(); }
    if (event === 'SIGNED_OUT') { ME = null; db = null; render(); }
  });
  // Atualiza quando o app volta para a frente (outra pessoa pode ter treinado)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ME && db && !ui.busy) { const t = D.today(); reload(true).catch(() => {}); } });
}
boot();
