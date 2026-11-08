import { api, getToken, setToken } from './lib/api.js';
import { localDay, ringData, macroSplit } from './lib/format.js';
import { addDays, dayLabel, isFuture, monthGrid, monthTitle } from './lib/days.js';
import { nutrientRows, macroRows } from './lib/nutrition.js';
import { shrinkImage } from './lib/image.js';
import * as cache from './lib/cache.js';

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
  refreshStreak();
  await selectDay(today());
  $('chat-input').focus();
}

window.addEventListener('bitelog:logout', () => {
  for (const d of document.querySelectorAll('dialog')) if (d.open) d.close();
  $('details-view').hidden = true;
  $('myfoods-view').hidden = true;
  cache.clearCache();
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
    err.textContent = ex.status === 401 ? 'That password is wrong. Try again.' : "Couldn't reach timbi. Check your connection and try again.";
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
    mds.borderWidth = 0; // a lone slice would show its edge as a seam
  } else {
    mds.data = [split.grams.protein, split.grams.carbs, split.grams.fat];
    mds.borderWidth = 2;
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

function renderDay(data) {
  $('chat-log').replaceChildren();
  if (data.messages.length) data.messages.forEach((m) => addMessage(m.role, m.text));
  else showEmptyChat();
  renderTotals(data.totals, data.goals);
}

async function loadDay(day) {
  // Draw the last copy we saw right away; the fresh one replaces it when it lands.
  const cached = cache.readDay(day);
  if (cached) renderDay(cached);
  try {
    const data = await api(`/api/today?day=${day}`);
    if (day !== selectedDay) return; // user switched days while this was loading
    cache.writeDay(day, data);
    renderDay(data);
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

// The picker either switches the day being viewed, or picks where to move foods.
let pickerMode = 'view';
let moveIds = [];

function openPicker(mode, ids = []) {
  pickerMode = mode;
  moveIds = ids;
  $('day-dialog-title').textContent = mode === 'move'
    ? (ids.length === 1 ? 'Move this food to which day?' : 'Move ' + ids.length + ' foods to which day?')
    : 'Choose a day';
  [viewYear, viewMonth] = selectedDay.split('-').map(Number);
  viewMonth -= 1;
  renderPicker();
  dayDialog.showModal();
}

function pick(day) {
  dayDialog.close();
  if (pickerMode === 'move') moveFoods(moveIds, day);
  else if (day !== selectedDay) selectDay(day);
}

$('day-button').addEventListener('click', () => openPicker('view'));
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
  scrollToLatest();
  return el;
}

// Keep the chat box scrolled to the newest message.
function scrollToLatest() {
  const log = $('chat-log');
  log.scrollTop = log.scrollHeight;
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

// ---------- Photo ----------

let pendingPhoto = null; // { media_type, data } after shrinking

function clearPhoto() {
  pendingPhoto = null;
  $('photo-chip').hidden = true;
  $('photo-thumb').removeAttribute('src');
  $('photo-input').value = '';
}

$('photo-button').addEventListener('click', () => $('photo-input').click());
$('photo-clear').addEventListener('click', clearPhoto);
$('photo-input').addEventListener('change', async () => {
  const file = $('photo-input').files?.[0];
  if (!file) return;
  try {
    pendingPhoto = await shrinkImage(file);
    $('photo-thumb').src = `data:${pendingPhoto.media_type};base64,${pendingPhoto.data}`;
    $('photo-chip').hidden = false;
    $('chat-input').placeholder = 'Add a note (optional), e.g. "this is blitz bar"';
    $('chat-input').focus();
  } catch {
    clearPhoto();
    addMessage('bot', "Couldn't open that photo. Try another one.", 'failed');
  }
});

// ---------- Streak ----------

function renderStreak(streak) {
  $('streak').hidden = !(streak > 0);
  $('streak-n').textContent = String(streak);
  $('streak').setAttribute('aria-label', `${streak} day streak`);
}

async function refreshStreak() {
  const day = today();
  const cached = cache.readStreak(day);
  if (cached !== null) renderStreak(cached);
  try {
    const { streak } = await api(`/api/streak?today=${day}`);
    cache.writeStreak(day, streak);
    renderStreak(streak);
  } catch { /* the streak is a nicety; never block the app on it */ }
}

// ---------- Save to My foods ----------

function showSaveOffer(offer) {
  const box = document.createElement('div');
  box.className = 'msg bot offer';
  const q = document.createElement('p');
  q.style.margin = '0';
  q.textContent = `Save ${offer.name} (${offer.serving}: ${fmt(offer.kcal)} kcal, ${fmt(offer.protein)}g protein) to My foods for next time?`;
  const actions = document.createElement('div');
  actions.className = 'offer-actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'pill primary';
  save.textContent = 'Save';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'pill';
  skip.textContent = "Don't save";
  actions.append(save, skip);
  box.append(q, actions);
  $('chat-log').append(box);
  scrollToLatest();

  const done = (text) => { box.replaceChildren(Object.assign(document.createElement('p'), { textContent: text, style: 'margin:0' })); };
  skip.addEventListener('click', () => box.remove());
  save.addEventListener('click', async () => {
    save.disabled = skip.disabled = true;
    try {
      await api('/api/my-foods', { method: 'POST', body: { food: offer } });
      done(`Saved ${offer.name} to My foods. Next time just type its name.`);
    } catch (ex) {
      if (ex.status === 409) done(`You already have a food called ${offer.name} in My foods.`);
      else if (ex.status !== 401) { save.disabled = skip.disabled = false; q.textContent = "Couldn't save that. Try again?"; }
    }
  });
}

// ---------- Send ----------

$('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('chat-input');
  const send = $('send-button');
  const text = input.value.trim();
  if ((!text && !pendingPhoto) || sending) return;
  sending = true;
  send.disabled = true;

  try {
    // On "Today" and midnight passed while the app was open: move to the new day first.
    if (followToday && selectedDay !== today()) await selectDay(today());
    const day = selectedDay;
    const image = pendingPhoto;

    const mine = addMessage('user', image ? (text ? `${text} 📷` : '📷') : text);
    const pending = addMessage('bot', image ? 'Reading your photo…' : 'Logging…', 'pending');
    try {
      const data = await api('/api/chat', {
        method: 'POST',
        body: { text, day, today: today(), tz: new Date().getTimezoneOffset(), image },
      });
      pending.remove();
      if (data.failed) {
        // Nothing was saved: drop the bubble and leave the text (and photo) to resend.
        mine.remove();
        addMessage('bot', `${data.reply} Your message is still in the box.`, 'failed');
        return;
      }
      if (day !== selectedDay) {
        // Saved, but the user is now looking at another day: keep the save offer, skip that day's charts.
        input.value = '';
        clearPhoto();
        refreshStreak();
        if (data.saveOffer) showSaveOffer(data.saveOffer);
        return;
      }
      addMessage('bot', data.reply);
      renderTotals(data.totals, data.goals);
      cache.patchDay(day, { user: image ? (text ? `${text} 📷` : '📷') : text, reply: data.reply, totals: data.totals, goals: data.goals });
      if (data.saveOffer) showSaveOffer(data.saveOffer);
      input.value = '';
      clearPhoto();
      renderDayHeader(); // restores the placeholder
      refreshStreak();
    } catch (ex) {
      pending.remove();
      mine.remove();
      if (ex.status !== 401) {
        addMessage('bot', ex.status === 400 ? `${ex.message}.` : "Couldn't send that. Your message is still in the box, so you can send it again.", 'failed');
      }
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

function openGoals() {
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) goalsForm.elements[k].value = Math.round(goals[k]);
  $('goals-error').hidden = true;
  goalsDialog.showModal();
}

// ⚙ opens a small menu: Daily goals / My foods.
$('goals-button').addEventListener('click', () => $('menu-dialog').showModal());
$('menu-close').addEventListener('click', () => $('menu-dialog').close());
$('menu-goals').addEventListener('click', () => { $('menu-dialog').close(); openGoals(); });
$('menu-myfoods').addEventListener('click', () => { $('menu-dialog').close(); openMyFoods(); });

// ---------- My foods ----------

const MYFOOD_NUMBERS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sat_fat', 'sodium', 'cholesterol', 'potassium'];
const myFoodForm = $('myfood-form');
let editingFood = null;

function myFoodsStatus(text) {
  $('myfoods-status').textContent = text;
  $('myfoods-status').hidden = !text;
}

async function loadMyFoods() {
  const list = $('myfoods-list');
  try {
    const { foods } = await api('/api/my-foods');
    list.replaceChildren();
    if (!foods.length) {
      const li = document.createElement('li');
      li.className = 'food-empty';
      li.textContent = 'Nothing saved yet. Send a photo of a nutrition label and tap Save to keep it here.';
      list.append(li);
    }
    for (const f of foods) {
      const li = document.createElement('li');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'myfood-row';
      const name = document.createElement('span');
      name.className = 'food-name';
      name.textContent = f.name;
      const serving = document.createElement('span');
      serving.className = 'serving';
      serving.textContent = `${f.serving} · ${fmt(f.protein)}g protein`;
      name.append(serving);
      const kcal = document.createElement('span');
      kcal.className = 'food-kcal';
      kcal.textContent = `${fmt(f.kcal)} kcal`;
      row.append(name, kcal);
      row.setAttribute('aria-label', `Edit ${f.name}`);
      row.addEventListener('click', () => openMyFoodEditor(f));
      li.append(row);
      list.append(li);
    }
  } catch (ex) {
    if (ex.status !== 401) myFoodsStatus("Couldn't load My foods. Check your connection and try again.");
  }
}

function openMyFoods() {
  myFoodsStatus('');
  $('app-view').hidden = true;
  $('myfoods-view').hidden = false;
  $('myfoods-back').focus();
  loadMyFoods();
}
$('myfoods-back').addEventListener('click', () => {
  $('myfoods-view').hidden = true;
  $('app-view').hidden = false;
});

function openMyFoodEditor(f) {
  editingFood = f;
  myFoodForm.elements.name.value = f.name;
  myFoodForm.elements.serving.value = f.serving;
  for (const k of MYFOOD_NUMBERS) myFoodForm.elements[k].value = f[k] ?? '';
  $('myfood-error').hidden = true;
  $('myfood-dialog').showModal();
}
$('myfood-cancel').addEventListener('click', () => $('myfood-dialog').close());
myFoodForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const food = { name: myFoodForm.elements.name.value, serving: myFoodForm.elements.serving.value };
  for (const k of MYFOOD_NUMBERS) {
    const v = myFoodForm.elements[k].value;
    food[k] = v === '' ? null : Number(v);
  }
  try {
    await api('/api/my-foods', { method: 'PUT', body: { id: editingFood.id, food } });
    $('myfood-dialog').close();
    myFoodsStatus(`Saved ${food.name.trim()}.`);
    loadMyFoods();
  } catch (ex) {
    if (ex.status !== 401) {
      $('myfood-error').textContent = ex.status === 400 || ex.status === 409 ? `${ex.message}.` : "Couldn't save. Check your connection and try again.";
      $('myfood-error').hidden = false;
    }
  }
});
$('myfood-delete').addEventListener('click', async () => {
  if (!window.confirm(`Delete ${editingFood.name} from My foods? Foods you already logged stay as they are.`)) return;
  try {
    await api('/api/my-foods', { method: 'DELETE', body: { ids: [editingFood.id] } });
    $('myfood-dialog').close();
    myFoodsStatus(`Deleted ${editingFood.name}.`);
    loadMyFoods();
  } catch (ex) {
    if (ex.status !== 401) { $('myfood-error').textContent = "Couldn't delete. Try again."; $('myfood-error').hidden = false; }
  }
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

// ---------- Nutrition screen ----------

let dayEntries = [];
let selecting = false;
const chosen = new Set();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function barRow({ label, text, refText, pct, over }, unknown = false) {
  const li = document.createElement('li');
  li.className = `bar-row${over ? ' over' : ''}${unknown ? ' unknown' : ''}`;
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'value';
  value.textContent = text;
  if (refText) {
    const ref = document.createElement('span');
    ref.className = 'ref';
    ref.textContent = refText;
    value.append(ref);
  }
  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  fill.style.width = `${pct}%`;
  track.append(fill);
  li.append(name, value, track);
  return li;
}

function renderFoods() {
  const list = $('food-list');
  list.replaceChildren();
  $('select-button').hidden = dayEntries.length === 0;
  $('select-button').textContent = selecting ? 'Done' : 'Select';
  if (!dayEntries.length) {
    const li = document.createElement('li');
    li.className = 'food-empty';
    li.textContent = 'Nothing logged on this day.';
    list.append(li);
  }
  for (const e of dayEntries) {
    const li = document.createElement('li');
    if (selecting) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = chosen.has(e.id);
      box.setAttribute('aria-label', `Select ${e.food}`);
      box.addEventListener('change', () => {
        if (box.checked) chosen.add(e.id); else chosen.delete(e.id);
        renderSelectBar();
      });
      li.append(box);
    }
    const name = document.createElement('span');
    name.className = 'food-name';
    name.textContent = e.qty && e.qty !== 1 ? `${e.food} ×${e.qty}` : e.food;
    const kcal = document.createElement('span');
    kcal.className = 'food-kcal';
    kcal.textContent = `${fmt(e.kcal)} kcal`;
    li.append(name, kcal);
    if (!selecting) {
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.className = 'menu-button';
      menu.textContent = '⋯';
      menu.setAttribute('aria-label', `Options for ${e.food}`);
      menu.addEventListener('click', () => openFoodMenu(e));
      li.append(menu);
    }
    list.append(li);
  }
  renderSelectBar();
}

function renderSelectBar() {
  $('select-bar').hidden = !selecting;
  $('select-count').textContent = `${chosen.size} selected`;
  $('move-selected').disabled = $('remove-selected').disabled = chosen.size === 0;
  $('select-all').textContent = allChosen() ? 'Deselect all' : 'Select all';
}

const allChosen = () => dayEntries.length > 0 && dayEntries.every((e) => chosen.has(e.id));
$('select-all').addEventListener('click', () => {
  if (allChosen()) chosen.clear();
  else dayEntries.forEach((e) => chosen.add(e.id));
  renderFoods();
});

function setStatus(text) {
  $('foods-status').textContent = text;
  $('foods-status').hidden = !text;
}

async function loadDetails() {
  const day = selectedDay;
  $('details-day').textContent = dayLabel(day, today());
  try {
    const data = await api(`/api/today?day=${day}`);
    if (day !== selectedDay) return;
    $('macro-rows').replaceChildren(...macroRows(data.totals, data.goals).map((r) => barRow(r)));
    $('nutrient-rows').replaceChildren(...nutrientRows(data.nutrients).map((r) => barRow(r, r.text === '—')));
    const noneKnown = (data.entries || []).length > 0 && nutrientRows(data.nutrients).every((r) => r.text === '—');
    $('nutrients-note').hidden = !(data.nutrients?.partial || noneKnown);
    dayEntries = data.entries || [];
    renderFoods();
  } catch (ex) {
    if (ex.status !== 401) setStatus("Couldn't load this day. Check your connection and try again.");
  }
}

function openDetails() {
  selecting = false;
  chosen.clear();
  setStatus('');
  $('app-view').hidden = true;
  $('details-view').hidden = false;
  $('details-back').focus();
  loadDetails();
}

function closeDetails() {
  $('details-view').hidden = true;
  $('app-view').hidden = false;
  loadDay(selectedDay); // totals may have changed
}

$('more-button').addEventListener('click', openDetails);
$('details-back').addEventListener('click', closeDetails);
$('select-button').addEventListener('click', () => {
  selecting = !selecting;
  chosen.clear();
  renderFoods();
});

// Food ⋯ menu
let menuFood = null;
function openFoodMenu(entry) {
  menuFood = entry;
  $('food-dialog-title').textContent = entry.food;
  $('food-dialog').showModal();
}
$('food-cancel').addEventListener('click', () => $('food-dialog').close());
$('food-move').addEventListener('click', () => {
  $('food-dialog').close();
  openPicker('move', [menuFood.id]);
});
$('food-remove').addEventListener('click', () => {
  $('food-dialog').close();
  confirmRemove([menuFood.id], menuFood.food);
});
$('move-selected').addEventListener('click', () => openPicker('move', [...chosen]));
$('remove-selected').addEventListener('click', () => confirmRemove([...chosen]));

let removeIds = [];
function confirmRemove(ids, name) {
  removeIds = ids;
  $('confirm-title').textContent = name ? `Remove ${name}?` : `Remove ${plural(ids.length, 'food')}?`;
  $('confirm-dialog').showModal();
}
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
$('confirm-ok').addEventListener('click', async () => {
  $('confirm-dialog').close();
  try {
    const { removed } = await api('/api/entries', { method: 'DELETE', body: { ids: removeIds } });
    selecting = false;
    chosen.clear();
    setStatus(`Removed ${plural(removed, 'food')}.`);
    refreshStreak();
    await loadDetails();
  } catch (ex) {
    if (ex.status !== 401) setStatus("Couldn't remove that. Check your connection and try again.");
  }
});

async function moveFoods(ids, day) {
  if (day === selectedDay) return;
  try {
    const { moved } = await api('/api/entries', { method: 'PATCH', body: { ids, day } });
    selecting = false;
    chosen.clear();
    setStatus(`Moved ${plural(moved, 'food')} to ${dayLabel(day, today())}.`);
    refreshStreak();
    await loadDetails();
  } catch (ex) {
    if (ex.status !== 401) setStatus("Couldn't move that. Check your connection and try again.");
  }
}

// ---------- Start ----------

if (getToken()) showApp();
else showLogin();
