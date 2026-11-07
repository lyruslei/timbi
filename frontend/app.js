import { api, getToken, setToken } from './lib/api.js';
import { localDay, ringData, macroSplit } from './lib/format.js';

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (n) => Math.round(n).toLocaleString();

let goals = { kcal: 2200, protein: 150, carbs: 220, fat: 70 };
let shownDay = null;
let kcalChart;
let macroChart;

// ---------- Views ----------

function showLogin() {
  $('app-view').hidden = true;
  $('login-view').hidden = false;
  $('password').focus();
}

async function showApp() {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  initCharts();
  await loadToday();
  $('chat-input').focus();
}

window.addEventListener('bitelog:logout', () => {
  if ($('goals-dialog').open) $('goals-dialog').close();
  showLogin();
});

// ---------- Login ----------

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('login-error');
  err.hidden = true;
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const { token } = await api('/api/login', { method: 'POST', body: { password: $('password').value } });
    setToken(token);
    $('password').value = '';
    await showApp();
  } catch (ex) {
    err.textContent = ex.status === 401 ? 'That password is wrong. Try again.' : "Couldn't reach Bitelog. Check your connection and try again.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

// ---------- Charts ----------

function initCharts() {
  if (kcalChart) return;
  const common = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    events: [],
  };
  kcalChart = new Chart($('kcal-chart'), {
    type: 'doughnut',
    data: { datasets: [{ data: [0, 1], backgroundColor: [css('--oat'), css('--track')], borderWidth: 0, borderRadius: 20 }] },
    options: { ...common, cutout: '84%' },
  });
  macroChart = new Chart($('macro-chart'), {
    type: 'pie',
    data: { datasets: [{ data: [1], backgroundColor: [css('--track')], borderWidth: 2, borderColor: css('--eggplant') }] },
    options: common,
  });
}

function renderTotals(totals, newGoals) {
  if (newGoals) goals = newGoals;

  const ring = ringData(totals, goals);
  const ds = kcalChart.data.datasets[0];
  ds.data = ring.over ? [1] : [ring.eaten, Math.max(0, goals.kcal - ring.eaten) || (ring.eaten ? 0 : 1)];
  ds.backgroundColor = [ring.over ? css('--beet') : css('--oat'), css('--track')];
  kcalChart.update();
  $('kcal-eaten').textContent = fmt(ring.eaten);
  $('kcal-goal').textContent = `of ${fmt(goals.kcal)} kcal`;
  $('kcal-left').textContent = ring.over
    ? `${fmt(ring.eaten - goals.kcal)} kcal over`
    : `${fmt(ring.left)} kcal left`;
  $('kcal-chart').closest('.chart').classList.toggle('over', ring.over);

  const split = macroSplit(totals);
  const mds = macroChart.data.datasets[0];
  if (split.empty) {
    mds.data = [1];
    mds.backgroundColor = [css('--track')];
  } else {
    mds.data = [split.grams.protein, split.grams.carbs, split.grams.fat];
    mds.backgroundColor = [css('--protein'), css('--carbs'), css('--fat')];
  }
  macroChart.update();
  for (const [k, p] of [['protein', 'p'], ['carbs', 'c'], ['fat', 'f']]) {
    $(`${p}-pct`).textContent = `${split.pct[k]}%`;
    $(`${p}-g`).textContent = `${Math.round(split.grams[k])}g`;
  }
}

// ---------- Chat ----------

function addMessage(role, text, extra = '') {
  const log = $('chat-log');
  log.querySelector('.chat-empty')?.remove();
  const el = document.createElement('p');
  el.className = `msg ${role} ${extra}`.trim();
  el.textContent = text;
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function showEmptyChat() {
  const p = document.createElement('p');
  p.className = 'chat-empty';
  p.textContent = 'Nothing logged yet today. Tell me what you ate, like "2 eggs and a slice of toast".';
  $('chat-log').append(p);
}

async function loadToday() {
  const day = localDay(new Date());
  $('today-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  try {
    const data = await api(`/api/today?day=${day}`);
    shownDay = day;
    $('chat-log').replaceChildren();
    if (data.messages.length) data.messages.forEach((m) => addMessage(m.role, m.text));
    else showEmptyChat();
    renderTotals(data.totals, data.goals);
  } catch (ex) {
    if (ex.status !== 401) addMessage('bot', "Couldn't load today's log. Check your connection, then reopen the app.", 'failed');
  }
}

$('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('chat-input');
  const send = $('send-button');
  const text = input.value.trim();
  if (!text || send.disabled) return;

  // A new day started while the app was open: reload first so this lands on the right day.
  if (shownDay !== localDay(new Date())) await loadToday();

  send.disabled = true;
  const mine = addMessage('user', text);
  const pending = addMessage('bot', 'Logging…', 'pending');
  try {
    const data = await api('/api/chat', { method: 'POST', body: { text, day: localDay(new Date()) } });
    pending.remove();
    if (data.failed) {
      // Nothing was saved: drop the bubble and leave the text in the box to resend.
      mine.remove();
      addMessage('bot', `${data.reply} Your message is still in the box.`, 'failed');
      return;
    }
    addMessage('bot', data.reply);
    renderTotals(data.totals, data.goals);
    input.value = '';
  } catch (ex) {
    pending.remove();
    mine.remove();
    if (ex.status !== 401) addMessage('bot', "Couldn't send that. Your message is still in the box, so you can send it again.", 'failed');
  } finally {
    send.disabled = false;
    input.focus();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$('app-view').hidden && shownDay !== localDay(new Date())) loadToday();
});

// ---------- Goals ----------

const dialog = $('goals-dialog');
const goalsForm = $('goals-form');

$('goals-button').addEventListener('click', () => {
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) goalsForm.elements[k].value = Math.round(goals[k]);
  $('goals-error').hidden = true;
  dialog.showModal();
});
$('goals-cancel').addEventListener('click', () => dialog.close());

goalsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const next = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map((k) => [k, Number(goalsForm.elements[k].value)]));
  const save = $('goals-save');
  save.disabled = true;
  try {
    const data = await api('/api/goals', { method: 'PUT', body: next });
    goals = data.goals;
    dialog.close();
    await loadToday();
  } catch (ex) {
    if (ex.status !== 401) {
      $('goals-error').textContent = ex.status === 400 ? `Check the numbers: ${ex.message}.` : "Couldn't save. Check your connection and try again.";
      $('goals-error').hidden = false;
    }
  } finally {
    save.disabled = false;
  }
});

// ---------- Start ----------

if (getToken()) showApp();
else showLogin();
