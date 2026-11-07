import { api, getToken, setToken } from './lib/api.js';
import { localDay, ringData, macroSplit } from './lib/format.js';
import { addDays, dayLabel, isFuture, monthGrid, monthTitle } from './lib/days.js';

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (n) => Math.round(n).toLocaleString();
const today = () => localDay(new Date());

let goals = { kcal: 2200, protein: 150, carbs: 220, fat: 70 };
let selectedDay = today();   // the day the charts and chat are showing
let followToday = true;      // true when the user is on "Today", so midnight rolls forward
let sending = false;
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
  await selectDay(today());
  $('chat-input').focus();
}

window.addEventListener('bitelog:logout', () => {
  for (const id of ['goals-dialog', 'day-dialog']) if ($(id).open) $(id).close();
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
    data: { datasets: [{ data: [0, 1], backgroundColor: [css('--lime'), css('--card-raised')], borderWidth: 0, borderRadius: 20 }] },
    options: { ...common, cutout: '84%' },
  });
  macroChart = new Chart($('macro-chart'), {
    type: 'pie',
    data: { datasets: [{ data: [1], backgroundColor: [css('--card-raised')], borderWidth: 2, borderColor: css('--card') }] },
    options: common,
  });
}

function renderTotals(totals, newGoals) {
  if (newGoals) goals = newGoals;

  const ring = ringData(totals, goals);
  const ds = kcalChart.data.datasets[0];
  ds.data = ring.over ? [1] : [ring.eaten, Math.max(0, goals.kcal - ring.eaten) || (ring.eaten ? 0 : 1)];
  ds.backgroundColor = [ring.over ? css('--white') : css('--lime'), css('--card-raised')];
  kcalChart.update();
  $('kcal-eaten').textContent = fmt(ring.eaten);
  $('kcal-goal').textContent = `of ${fmt(goals.kcal)} kcal`;
  $('kcal-left').textContent = ring.over ? `${fmt(ring.eaten - goals.kcal)} kcal over` : `${fmt(ring.left)} kcal left`;
  $('kcal-chart').closest('.chart').classList.toggle('over', ring.over);

  const split = macroSplit(totals);
  const mds = macroChart.data.datasets[0];
  if (split.empty) {
    mds.data = [1];
    mds.backgroundColor = [css('--card-raised')];
  } else {
    mds.data = [split.grams.protein, split.grams.carbs, split.grams.fat];
    mds.backgroundColor = [css('--lime'), css('--lime-dark'), css('--lime-pale')];
  }
  macroChart.update();
  for (const [k, p] of [['protein', 'p'], ['carbs', 'c'], ['fat', 'f']]) {
    $(`${p}-pct`).textContent = `${split.pct[k]}%`;
    $(`${p}-g`).textContent = `${Math.round(split.grams[k])}g`;
  }
}

// ---------- Day selection ----------

function renderDayHeader() {
  const t = today();
  const label = dayLabel(selectedDay, t);
  $('day-label').textContent = label;
  $('back-today').hidden = selectedDay === t;
  $('chat-input').placeholder = selectedDay === t ? 'What did you eat?' : `What did you eat ${label === 'Yesterday' ? 'yesterday' : `on ${label}`}?`;
}

async function selectDay(day) {
  selectedDay = day;
  followToday = day === today();
  renderDayHeader();
  await loadDay(day);
}

async function loadDay(day) {
  try {
    const data = await api(`/api/today?day=${day}`);
    if (day !== selectedDay) return; // user switched days while this was loading
    $('chat-log').replaceChildren();
    if (data.messages.length) data.messages.forEach((m) => addMessage(m.role, m.text));
    else showEmptyChat();
    renderTotals(data.totals, data.goals);
  } catch (ex) {
    if (ex.status !== 401) addMessage('bot', "Couldn't load this day's log. Check your connection and try again.", 'failed');
  }
}

$('back-today').addEventListener('click', () => selectDay(today()));

document.addEventListener('visibilitychange', () => {
  // On "Today" and the date rolled over while away: move to the new day (not mid-send).
  if (document.visibilityState === 'visible' && !$('app-view').hidden && followToday && !sending && selectedDay !== today()) {
    selectDay(today());
  }
});

// ---------- Day picker ----------

const dayDialog = $('day-dialog');
let viewYear;
let viewMonth;

function renderPicker() {
  const t = today();
  $('month-title').textContent = monthTitle(viewYear, viewMonth);
  const [ty, tm] = t.split('-').map(Number);
  $('next-month').disabled = viewYear > ty || (viewYear === ty && viewMonth >= tm - 1);
  for (const b of dayDialog.querySelectorAll('[data-quick]')) {
    b.classList.toggle('active', addDays(t, Number(b.dataset.quick)) === selectedDay);
  }
  const grid = $('month-grid');
  grid.replaceChildren();
  for (const day of monthGrid(viewYear, viewMonth).flat()) {
    if (!day) { grid.append(document.createElement('span')); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(Number(day.slice(8)));
    b.dataset.day = day;
    b.setAttribute('aria-label', dayLabel(day, t));
    b.disabled = isFuture(day, t);
    if (day === t) b.classList.add('today');
    if (day === selectedDay) { b.classList.add('selected'); b.setAttribute('aria-current', 'date'); }
    grid.append(b);
  }
}

function pick(day) {
  dayDialog.close();
  if (day !== selectedDay) selectDay(day);
}

$('day-button').addEventListener('click', () => {
  [viewYear, viewMonth] = selectedDay.split('-').map(Number);
  viewMonth -= 1;
  renderPicker();
  dayDialog.showModal();
});
$('prev-month').addEventListener('click', () => {
  viewMonth -= 1;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  renderPicker();
});
$('next-month').addEventListener('click', () => {
  viewMonth += 1;
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  renderPicker();
});
$('month-grid').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-day]');
  if (b && !b.disabled) pick(b.dataset.day);
});
for (const b of dayDialog.querySelectorAll('[data-quick]')) {
  b.addEventListener('click', () => pick(addDays(today(), Number(b.dataset.quick))));
}
$('day-cancel').addEventListener('click', () => dayDialog.close());

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
  const t = today();
  p.textContent = selectedDay === t
    ? 'Nothing logged yet today. Tell me what you ate, like "2 eggs and a slice of toast".'
    : `Nothing logged for ${dayLabel(selectedDay, t).toLowerCase() === 'yesterday' ? 'yesterday' : dayLabel(selectedDay, t)}. Tell me what you ate that day.`;
  $('chat-log').append(p);
}

$('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('chat-input');
  const send = $('send-button');
  const text = input.value.trim();
  if (!text || sending) return;
  sending = true;
  send.disabled = true;

  try {
    // On "Today" and midnight passed while the app was open: move to the new day first.
    if (followToday && selectedDay !== today()) await selectDay(today());
    const day = selectedDay;

    const mine = addMessage('user', text);
    const pending = addMessage('bot', 'Logging…', 'pending');
    try {
      const data = await api('/api/chat', { method: 'POST', body: { text, day } });
      pending.remove();
      if (day !== selectedDay) { input.value = ''; return; } // saved; user is now looking at another day
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
    }
  } finally {
    sending = false;
    send.disabled = false;
    input.focus();
  }
});

// ---------- Goals ----------

const goalsDialog = $('goals-dialog');
const goalsForm = $('goals-form');

$('goals-button').addEventListener('click', () => {
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) goalsForm.elements[k].value = Math.round(goals[k]);
  $('goals-error').hidden = true;
  goalsDialog.showModal();
});
$('goals-cancel').addEventListener('click', () => goalsDialog.close());

goalsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const next = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map((k) => [k, Number(goalsForm.elements[k].value)]));
  const save = $('goals-save');
  save.disabled = true;
  try {
    const data = await api('/api/goals', { method: 'PUT', body: next });
    goals = data.goals;
    goalsDialog.close();
    await loadDay(selectedDay);
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
