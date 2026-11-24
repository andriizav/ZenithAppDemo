/* ---------- TASKS (EISENHOWER) ---------- */

const TASKS_STORAGE_KEY = 'tasks_data';
const TASKS_DATE_KEY = 'tasks_last_date';
const TASKS_LABELS_KEY = 'tasks_labels';
const TASKS_DONE_COLLAPSED_KEY = 'tasks_done_collapsed';
const TASKS_SETTINGS_KEY = 'tasks_settings';
const tasksDoneCollapsed = loadTasksDoneCollapsed();

let currentDataset = 'tasks';

function getTasksOutputEl() {
  return document.getElementById(currentDataset === 'code' ? 'output-code' : 'output-tasks');
}

function generateTaskId() {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Гарантує, що кожне завдання має унікальний id. Це критично для синхронізації
// з Gist: gistMergeArraysById зливає масиви ЛИШЕ за наявності id, інакше завдання
// без id тихо відкидаються (і зникають після авто-pull).
function ensureTaskIds(tasks) {
  if (!Array.isArray(tasks)) return false;
  let changed = false;
  tasks.forEach(t => {
    if (t && t.id === undefined) { t.id = generateTaskId(); changed = true; }
  });
  return changed;
}

// Ключ для порівняння завдань по змісту (без урахування id/порядку).
function taskContentKey(t) {
  return (t && t.text ? t.text : '') + '|' + (t && t.urgent ? 'u' : '') + (t && t.important ? 'i' : '');
}

// Ідентичність завдання для дедупу/злиття: за id, якщо він є (надійно —
// різні завдання з однаковим текстом/квадрантом лишаються різними), інакше
// (легасі-дані без id) — за змістом.
function taskIdentityKey(t) {
  return (t && t.id !== undefined) ? ('id:' + t.id) : ('c:' + taskContentKey(t));
}

// Видаляє дублікати завдань за id (fallback — за текстом + квадрантом).
function dedupeTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  const seen = new Set();
  const result = [];
  tasks.forEach(t => {
    const k = taskIdentityKey(t);
    if (!seen.has(k)) { seen.add(k); result.push(t); }
  });
  return result;
}

// Злиття локальних і gist-завдань за id (fallback — за змістом для
// легасі-даних без id). Якщо обидві сторони мають те саме завдання, перемагає
// копія з новішим updatedAt, щоб локальний рух/редагування не «злітав».
function mergeTasksByContent(local, remote) {
  const localValid = Array.isArray(local) ? local : [];
  const remoteValid = Array.isArray(remote) ? remote : [];
  const byKey = new Map();
  const order = [];
  localValid.forEach(t => {
    const k = taskIdentityKey(t);
    if (!byKey.has(k)) order.push(k);
    byKey.set(k, t);
  });
  remoteValid.forEach(t => {
    const k = taskIdentityKey(t);
    const existing = byKey.get(k);
    if (!existing) {
      order.push(k);
      byKey.set(k, t);
      return;
    }
    const localTs = existing.updatedAt || 0;
    const remoteTs = t.updatedAt || 0;
    if (remoteTs > localTs) byKey.set(k, t);
  });
  return order.map(k => byKey.get(k));
}

function getTasksSettings() {
  const defaults = { showRepeatIcons: true, showQuadrantCount: true };
  try {
    return Object.assign(defaults, JSON.parse(localStorage.getItem(TASKS_SETTINGS_KEY)) || {});
  } catch {
    return defaults;
  }
}

function saveTasksSettings(settings) {
  try {
    localStorage.setItem(TASKS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
    tasksGistStorage.markPendingChanges();
  }
}


let tasksOutsideCloseBound = false;

let tasksMobileActiveQuad = 'do';

const TASKS_SHORT_LABELS = {
  do: 'Робити',
  schedule: 'Планувати',
  delegate: 'Делегувати',
  delete: 'Скасувати',
};

function isTasksMobile() {
  return window.matchMedia('(max-width: 600px)').matches;
}

function applyTasksMobileView(container) {
  const mobile = isTasksMobile();
  const segmented = container.querySelector('.tasks-segmented');
  if (segmented) segmented.style.display = mobile ? 'grid' : 'none';
  container.querySelectorAll('.tasks-quadrant').forEach(q => {
    q.classList.toggle('active', !mobile || q.dataset.key === tasksMobileActiveQuad);
  });
  container.querySelectorAll('.tasks-seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.quad === tasksMobileActiveQuad);
  });
}

function loadTasksDoneCollapsed() {
  const defaults = { do: true, schedule: true, delegate: true, delete: true };
  try {
    return Object.assign(defaults, JSON.parse(localStorage.getItem(TASKS_DONE_COLLAPSED_KEY)) || {});
  } catch {
    return defaults;
  }
}

function saveTasksDoneCollapsed() {
  try {
    localStorage.setItem(TASKS_DONE_COLLAPSED_KEY, JSON.stringify(tasksDoneCollapsed));
  } catch {}
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
    tasksGistStorage.markPendingChanges();
  }
}

const QUADRANTS_DEFAULTS = [
  { key: 'do',       label: 'Терміново і важливо',      color: '#e05555', urgent: true,  important: true  },
  { key: 'schedule', label: 'Важливо, але не терміново', color: '#f0a040', urgent: false, important: true  },
  { key: 'delegate', label: 'Терміново, але не важливо', color: '#5b9cf5', urgent: true,  important: false },
  { key: 'delete',   label: 'Не терміново і не важливо', color: '#666666', urgent: false, important: false },
];

function getQuadrants() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(TASKS_LABELS_KEY)) || {}; } catch {}
  return QUADRANTS_DEFAULTS.map(q => ({ ...q, label: saved[q.key] || q.label }));
}

function saveQuadrantLabel(key, label) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(TASKS_LABELS_KEY)) || {}; } catch {}
  saved[key] = label;
  localStorage.setItem(TASKS_LABELS_KEY, JSON.stringify(saved));
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
    tasksGistStorage.markPendingChanges();
  }
}

/* ========== REPEAT HELPERS ========== */

const WEEKDAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const REPEAT_ICON_SVG = ICON('refreshCw', 14);

const SUBTASK_ICON_SVG = ICON('checkSquare', 13);

const TASK_COLORS = ['#e05555', '#f0a040', '#5b9cf5', '#4ac06a', '#a855f7', '#2dd4bf', '#ec4899', '#eab308', '#9ca3af'];

function escapeAttr(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isRecurringToday(repeat, date) {
  date = date || new Date();
  if (!repeat || repeat.type === 'none' || repeat.type === 'daily') return true;
  if (repeat.type === 'weekly') {
    if (!repeat.days || !repeat.days.includes(date.getDay())) return false;
    const interval = repeat.interval || 1;
    if (interval <= 1 || !repeat.anchor) return true;
    const startOfWeek = d => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - x.getDay());
      return x;
    };
    const weeks = Math.round((startOfWeek(date) - startOfWeek(new Date(repeat.anchor))) / (7 * 86400000));
    return weeks % interval === 0;
  }
  if (repeat.type === 'biweekly') {
    if (!repeat.anchor) return true;
    const anchor = new Date(repeat.anchor);
    anchor.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - anchor) / 86400000);
    return diffDays >= 0 && diffDays % 14 === 0;
  }
  if (repeat.type === 'monthly') {
    return repeat.day === date.getDate();
  }
  return true;
}

/* ========== SOUNDS ========== */
// Граємо готові WAV через <audio> (надійно на iOS), fallback — Web Audio oscillator.

const _tasksSoundPool = [];
function tasksGetAudioEl() {
  let el = _tasksSoundPool.find((a) => a._free);
  if (!el) {
    el = new Audio();
    _tasksSoundPool.push(el);
  }
  el._free = false;
  el.onended = () => { el._free = true; };
  return el;
}

function tasksPlayWav(file, volume = 1) {
  try {
    const el = tasksGetAudioEl();
    el.src = file;
    el.volume = volume;
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => { el._free = true; });
    return true;
  } catch (e) {
    return false;
  }
}

let _tasksAudioCtx = null;
function tasksGetAudioCtx() {
  if (!_tasksAudioCtx) {
    try {
      _tasksAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return _tasksAudioCtx;
}

function tasksPlayOsc(frequencies, step, dur, vol, type) {
  try {
    const ctx = tasksGetAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      const start = now + index * step;
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  } catch (e) {}
}

function playTasksSuccessSound() {
  if (tasksPlayWav("habits/sounds/success.wav", 1)) return;
  tasksPlayOsc([523.25, 659.25, 783.99], 0.1, 0.2, 0.2, "sine");
}

function playTasksUncheckSound() {
  if (tasksPlayWav("habits/sounds/uncheck.wav", 1)) return;
  tasksPlayOsc([783.99, 659.25, 523.25], 0.1, 0.2, 0.2, "sine");
}

/* ========== CONFETTI ========== */

function createTasksConfetti(x, y) {
  const colors = ['#5b9cf5', '#4ac06a', '#ffd700', '#ff6b6b', '#a855f7'];
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      z-index: 1000;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
    `;
    document.body.appendChild(confetti);
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = 5 + Math.random() * 5;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    let offsetX = 0, offsetY = 0, opacity = 1;
    const animate = () => {
      offsetX += vx;
      offsetY += vy + 2;
      opacity -= 0.02;
      confetti.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${offsetX * 10}deg)`;
      confetti.style.opacity = opacity;
      if (opacity > 0) requestAnimationFrame(animate);
      else confetti.remove();
    };
    requestAnimationFrame(animate);
  }
}

/* ========== STORAGE ========== */

function getTasksData() {
  const key = currentDataset === 'code' ? 'code_tasks_data' : TASKS_STORAGE_KEY;
  try {
    const tasks = JSON.parse(localStorage.getItem(key)) || [];
    let migrated = false;
    tasks.forEach(t => {
      if (t.title && !t.text) { t.text = t.title; delete t.title; migrated = true; }
      if (t.important === undefined) { t.important = false; migrated = true; }
      if (t.urgent === undefined) { t.urgent = false; migrated = true; }
    });
    if (ensureTaskIds(tasks)) migrated = true;

    // Завдання з вкладки «Код» не показуємо у звичайному списку Tasks
    if (currentDataset === 'tasks') {
      let codeTexts = null;
      try {
        codeTexts = new Set(
          (JSON.parse(localStorage.getItem('code_tasks_data')) || [])
            .map(t => (t && t.text ? t.text : '').trim().toLowerCase())
            .filter(Boolean)
        );
      } catch {}
      const cleaned = dedupeTasks(tasks).filter(t => {
        if (!codeTexts || codeTexts.size === 0) return true;
        const key = (t.text || '').trim().toLowerCase();
        return !codeTexts.has(key);
      });
      if (cleaned.length !== tasks.length) migrated = true;
      if (migrated) saveTasksData(cleaned);
      return cleaned;
    }

    const cleaned = dedupeTasks(tasks);
    if (cleaned.length !== tasks.length) migrated = true;
    if (migrated) {
      if (currentDataset === 'code') saveCodeTasksData(cleaned);
      else saveTasksData(cleaned);
    }
    return cleaned;
  } catch { return []; }
}

function saveTasksData(data) {
  const key = currentDataset === 'code' ? 'code_tasks_data' : TASKS_STORAGE_KEY;
  let prevById = new Map();
  try {
    const prev = JSON.parse(localStorage.getItem(key)) || [];
    prev.forEach(t => { if (t && t.id !== undefined) prevById.set(t.id, t); });
  } catch {}
  const now = Date.now();
  const stripTs = (obj) => { const c = { ...obj }; delete c.updatedAt; return c; };
  const tagged = (Array.isArray(data) ? data : []).map(t => {
    if (t && typeof t === 'object') {
      const prevT = t.id !== undefined ? prevById.get(t.id) : undefined;
      const contentChanged = !prevT || JSON.stringify(stripTs(prevT)) !== JSON.stringify(stripTs(t));
      return { ...t, updatedAt: contentChanged ? now : (t.updatedAt || (prevT && prevT.updatedAt) || now) };
    }
    return t;
  });
  localStorage.setItem(key, JSON.stringify(tagged));
  if (typeof gistTouchLocalModified === 'function') gistTouchLocalModified(currentDataset === 'code' ? 'code' : 'tasks');
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
    tasksGistStorage.markPendingChanges();
  }
}

function exportTasksData() {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    tasks: getTasksData(),
    labels: (() => { try { return JSON.parse(localStorage.getItem(TASKS_LABELS_KEY)) || {}; } catch { return {}; } })(),
    doneCollapsed: (() => { try { return JSON.parse(localStorage.getItem(TASKS_DONE_COLLAPSED_KEY)) || {}; } catch { return {}; } })()
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importTasksData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.tasks || !Array.isArray(data.tasks)) {
        throw new Error('Невірний формат даних');
      }

      const validTasks = data.tasks.filter(t =>
        t && typeof t.text === 'string' &&
        typeof t.urgent === 'boolean' && typeof t.important === 'boolean'
      );

      if (validTasks.length === 0) {
        throw new Error('Немає валідних завдань для імпорту');
      }

      if (confirm(`Імпортувати ${validTasks.length} завдань? Ця дія перезапише поточні дані.`)) {
        saveTasksData(validTasks);
        if (data.labels && typeof data.labels === 'object') {
          localStorage.setItem(TASKS_LABELS_KEY, JSON.stringify(data.labels));
        }
        if (data.doneCollapsed && typeof data.doneCollapsed === 'object') {
          localStorage.setItem(TASKS_DONE_COLLAPSED_KEY, JSON.stringify(data.doneCollapsed));
        }
        const output = getTasksOutputEl();
        if (output) renderTasksUI(output);
        alert('Дані успішно імпортовано!');
      }
    } catch (error) {
      alert('Помилка імпорту: ' + error.message);
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

/* ========== DAILY RESET ========== */

function checkTasksDailyReset() {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(TASKS_DATE_KEY);
  if (lastDate !== today) {
    const tasks = getTasksData();
    let changed = false;
    tasks.forEach(t => { if (t.done && t.repeat && t.repeat.type !== 'none' && isRecurringToday(t.repeat)) { t.done = false; changed = true; } });
    if (changed) saveTasksData(tasks);
    localStorage.setItem(TASKS_DATE_KEY, today);
  }
}

function scheduleTasksMidnightReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;
  setTimeout(() => {
    checkTasksDailyReset();
    const output = document.getElementById('output-tasks');
    if (output) renderTasksUI(output);
    scheduleTasksMidnightReset();
  }, msUntilMidnight);
}

/* ========== INIT ========== */

async function initTasks() {
  const output = document.getElementById('output-tasks');
  if (!output) return;
  checkTasksDailyReset();

  // Якщо Gist увімкнено і локальні завдання пошкоджені/порожні — одразу підтягуємо
  // з Gist (відновлення) і чекаємо завершення, щоб рендер показав дані.
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
    const localTasks = (() => { try { return JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY)); } catch { return undefined; } })();
    const localTasksValid = Array.isArray(localTasks) && localTasks.length > 0;
    if (!localTasksValid && typeof tasksGistStorage.pullFromGist === 'function') {
      try {
        await tasksGistStorage.pullFromGist();
      } catch (err) {
        console.error('Initial tasks pull failed:', err);
      }
    }
  }

  renderTasksUI(output);
  if (typeof MobileHeader !== 'undefined') MobileHeader.inject(output, 'Завдання');
  let _tasksLastMobile = isTasksMobile();
  window.addEventListener('resize', () => {
    const nowMobile = isTasksMobile();
    if (nowMobile !== _tasksLastMobile) {
      _tasksLastMobile = nowMobile;
      applyTasksMobileView(output);
    }
  });
  scheduleTasksMidnightReset();
  renderTasksActions();
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
    tasksGistStorage.startAutoSync();
  }
}

/* Єдиний екземпляр кнопки «Налаштування» (використовується і в
   мобільному заголовку, і в actions-барі на десктопі, щоб не дублювати). */
let _tasksSettingsBtn = null;
function getTasksSettingsBtn() {
  if (_tasksSettingsBtn) return _tasksSettingsBtn;
  const btn = document.createElement('button');
  btn.className = 'tasks-settings-btn page-action-btn';
  btn.title = 'Налаштування';
  btn.setAttribute('aria-label', 'Налаштування');
  btn.innerHTML = ICON('bolt', 24);
  btn.addEventListener('click', () => openTasksSettingsModal());
  _tasksSettingsBtn = btn;
  return btn;
}

function renderTasksActions() {
  const existing = document.getElementById('tasksActions');
  if (existing) existing.remove();

  const actions = document.createElement('div');
  actions.id = 'tasksActions';
  actions.className = 'tasks-actions';
  actions.innerHTML = `
    <button class="tasks-export-btn" onclick="exportTasksData()" title="Експортувати дані">
      ${ICON('download', 20)}
    </button>
    <button class="tasks-import-btn" onclick="document.getElementById('tasksImportFile').click()" title="Імпортувати дані">
      ${ICON('upload', 20)}
    </button>
    <input type="file" id="tasksImportFile" accept=".json" style="display: none;" onchange="importTasksData(event)">
    <button class="tasks-sync-btn" onclick="manualSyncTasks()" title="Синхронізувати з Gist">
      ${ICON('refreshCw', 20)}
    </button>
  `;
  const host = document.getElementById(currentDataset === 'code' ? 'content-code' : 'content-tasks') || document.body;
  host.appendChild(actions);

  // Кнопку «Налаштування» показуємо у actions-барі лише на десктопі.
  // На мобільному вона вже розміщена у заголовку сторінки (mobile-page-header).
  const settingsBtn = getTasksSettingsBtn();
  const headerActions = host.querySelector('.mobile-page-header .header-button-right');
  if (!headerActions || !headerActions.contains(settingsBtn)) {
    actions.appendChild(settingsBtn);
  }
}

function openTasksSettingsModal() {
  const settings = getTasksSettings();

  openSettingsModal({
    title: 'Параметри',
    triggerBtn: getTasksSettingsBtn(),
    bodyHTML:
      settingsRowHTML('tasks-setting-quadrant-count', 'Лічильник завдань у заголовку', 'Кількість активних завдань у квадранті', settings.showQuadrantCount) +
      settingsRowHTML('tasks-setting-repeat-icons', 'Показувати іконки повторень', 'Значок ↻ біля завдань, що повторюються', settings.showRepeatIcons),
    onMount: (overlay) => {
      const bind = (id, key) => {
        overlay.querySelector('#' + id).addEventListener('change', (e) => {
          const s = getTasksSettings();
          s[key] = e.target.checked;
          saveTasksSettings(s);
          const output = getTasksOutputEl();
          if (output) renderTasksUIPreserveScroll(output);
        });
      };
      bind('tasks-setting-repeat-icons', 'showRepeatIcons');
      bind('tasks-setting-quadrant-count', 'showQuadrantCount');
    }
  });
}

/* ========== RENDER ========== */

const tasksOpenQuads = new Set();

function renderTasksUI(container) {
  const tasks = getTasksData();

  const quadsHtml = getQuadrants().map(q => {
    const quadTasks = tasks
      .map((t, i) => ({ ...t, _index: i }))
      .filter(t => t.important === q.important && t.urgent === q.urgent);

    const undoneTasks = quadTasks.filter(t => !t.done);
    const doneTasks = quadTasks.filter(t => t.done);

    function renderTask(task) {
      const checked = task.done ? ' checked' : '';
      const textClass = task.done ? ' done' : '';
      const repeatOn = task.repeat && task.repeat.type !== 'none';
      const showRepeatIcon = repeatOn && getTasksSettings().showRepeatIcons;
      const colorDot = task.color ? `<span class="tasks-task-color" style="background:${task.color}"></span>` : '';
      const subtasks = task.subtasks || [];
      const subDone = subtasks.filter(s => s.done).length;
      const subtaskBadge = subtasks.length
        ? `<button class="tasks-task-subtasks" title="Підзавдання: ${subDone} з ${subtasks.length}">${SUBTASK_ICON_SVG}<span>${subDone}/${subtasks.length}</span></button>`
        : '';
      return `
        <div class="tasks-task" data-index="${task._index}" draggable="true">
          <label class="task-checkbox-label">
            <input type="checkbox" class="tasks-checkbox"${checked}>
            <span class="task-checkmark"></span>
          </label>
          ${colorDot}
          <span class="tasks-task-text${textClass}">${escapeHtml(task.text)}</span>
          ${showRepeatIcon ? `<span class="tasks-task-repeat active" title="Повторюваність">${REPEAT_ICON_SVG}</span>` : ''}
          ${subtaskBadge}
        </div>
      `;
    }

    const undoneHtml = undoneTasks.map(renderTask).join('');

    let doneHtml = '';
    if (doneTasks.length > 0) {
      const collapsed = tasksDoneCollapsed[q.key];
      const chevronClass = collapsed ? '' : ' rotated';
      doneHtml = `
        <div class="tasks-done-toggle" data-quad="${q.key}">
          <span class="tasks-done-chevron${chevronClass}">${ICON('chevronRight', 24)}</span>
          <span class="tasks-done-label">Завершені</span>
          <span class="tasks-done-count">${doneTasks.length}</span>
        </div>
        <div class="tasks-done-list${collapsed ? ' collapsed' : ''}">
          ${doneTasks.map(renderTask).join('')}
        </div>
      `;
    }

    return `
      <div class="tasks-quadrant" data-key="${q.key}" style="--quadrant-color: ${q.color}">
        <div class="tasks-quadrant-header" style="border-left-color: ${q.color}">
          <span class="tasks-quadrant-dot" style="background: ${q.color}"></span>
          <span class="tasks-quadrant-label">${q.label}</span>
          ${getTasksSettings().showQuadrantCount && undoneTasks.length > 0 ? `<span class="tasks-quadrant-count">${undoneTasks.length}</span>` : ''}
          <div class="tasks-add-row">
            <textarea class="tasks-add-input" data-quad="${q.key}" placeholder="Нове завдання..." autocomplete="off" rows="1"></textarea>
            <button class="tasks-add-send" data-quad="${q.key}" title="Додати">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"></path><path d="M6 12h16"></path></svg>
            </button>
          </div>
          <button class="tasks-add-toggle${tasksOpenQuads.has(q.key) ? ' active' : ''}" data-quad="${q.key}" title="Нове завдання">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
        </div>
        <div class="tasks-quadrant-tasks">
          ${undoneHtml}
          ${doneHtml}
        </div>
      </div>
    `;
  }).join('');

  // Запамʼятовуємо позицію прокрутки кожного квадранта, бо container.innerHTML
  // її скине. Це дозволяє оновлювати UI (синхронізація, ресет, налаштування)
  // без «стрибка» прокрутки, поки користувач скролить квадрант завдань.
  const scrollStates = [];
  container.querySelectorAll('.tasks-quadrant-tasks').forEach(el => {
    scrollStates.push({ key: el.closest('.tasks-quadrant')?.dataset.key, top: el.scrollTop });
  });

  const quads = getQuadrants();
  const segHtml = quads.map(q => {
    const undone = tasks.filter(t => !t.done && t.important === q.important && t.urgent === q.urgent).length;
    const countBadge = `<span class="tasks-seg-count">${undone}</span>`;
    return `
    <button class="tasks-seg-btn${q.key === tasksMobileActiveQuad ? ' active' : ''}" data-quad="${q.key}" type="button" style="--q-color:${q.color}" aria-label="${q.label}">
      <span class="tasks-seg-dot" style="background:${q.color}"></span>
      <span class="tasks-seg-label">${q.label}</span>
      ${countBadge}
    </button>
  `;
  }).join('');

  container.innerHTML = `
    <div class="tasks-container">
      <div class="tasks-grid">
        ${quadsHtml}
      </div>
      <div class="tasks-segmented">${segHtml}</div>
    </div>
  `;

  tasksOpenQuads.forEach(key => {
    const q = container.querySelector(`.tasks-quadrant[data-key="${key}"]`);
    if (q) q.classList.add('adding');
  });

  // Заголовок «Завдання» зверху (той самий стиль, що й у Нотатках).
  // Вставляємо після кожного ререндеру, бо container.innerHTML його стирає.
  // Кнопку «Налаштування» розміщуємо у правому куті заголовка.
  if (typeof MobileHeader !== 'undefined') MobileHeader.inject(container, currentDataset === 'code' ? 'Код' : 'Завдання', [getTasksSettingsBtn()]);

  bindTasksEvents(container);
  applyTasksMobileView(container);

  scrollStates.forEach(s => {
    const el = container.querySelector(`.tasks-quadrant[data-key="${s.key}"] > .tasks-quadrant-tasks`);
    if (el) el.scrollTop = s.top;
  });
}

/* ========== EVENTS ========== */

function renderTasksUIPreserveScroll(container) {
  renderTasksUI(container);
}

function saveCodeTasksData(tasks) {
  try {
    localStorage.setItem('code_tasks_data', JSON.stringify(tasks));
  } catch {}
}

function renderCodeTasksUI(container) {
  currentDataset = 'code';
  renderTasksUI(container);
}

function bindTasksEvents(container) {
  const quads = getQuadrants();

  const DONE_TOGGLE_SVG = ICON('chevronRight', 24);

  function applyTaskDone(taskEl, done) {
    const index = parseInt(taskEl.dataset.index);
    const quadrant = taskEl.closest('.tasks-quadrant');
    if (!quadrant) return;
    const tasksContainer = quadrant.querySelector(':scope > .tasks-quadrant-tasks');
    const qKey = quadrant.dataset.key;

    const checkbox = taskEl.querySelector('.tasks-checkbox');
    const textEl = taskEl.querySelector('.tasks-task-text');
    if (checkbox) checkbox.checked = done;
    if (textEl) textEl.classList.toggle('done', done);

    taskEl.remove();

    if (done) {
      let doneToggle = tasksContainer.querySelector(':scope > .tasks-done-toggle');
      let doneList = tasksContainer.querySelector(':scope > .tasks-done-list');
      if (!doneList) {
        doneToggle = document.createElement('div');
        doneToggle.className = 'tasks-done-toggle';
        doneToggle.dataset.quad = qKey;
        doneToggle.innerHTML = `<span class="tasks-done-chevron${tasksDoneCollapsed[qKey] ? '' : ' rotated'}">${DONE_TOGGLE_SVG}</span><span class="tasks-done-label">Завершені</span><span class="tasks-done-count">0</span>`;
        doneList = document.createElement('div');
        doneList.className = 'tasks-done-list' + (tasksDoneCollapsed[qKey] ? ' collapsed' : '');
        tasksContainer.appendChild(doneToggle);
        tasksContainer.appendChild(doneList);
        doneToggle.addEventListener('click', () => {
          tasksDoneCollapsed[qKey] = !tasksDoneCollapsed[qKey];
          saveTasksDoneCollapsed();
          doneList.classList.toggle('collapsed', tasksDoneCollapsed[qKey]);
          doneToggle.querySelector('.tasks-done-chevron').classList.toggle('rotated', !tasksDoneCollapsed[qKey]);
        });
      }
      doneList.appendChild(taskEl);
    } else {
      const undoneEls = [...tasksContainer.querySelectorAll(':scope > .tasks-task')];
      const task = getTasksData()[index];
      let inserted = false;
      if (task) {
        for (const el of undoneEls) {
          if (parseInt(el.dataset.index) > index) {
            tasksContainer.insertBefore(taskEl, el);
            inserted = true;
            break;
          }
        }
      }
      if (!inserted) {
        const doneToggle = tasksContainer.querySelector(':scope > .tasks-done-toggle');
        if (doneToggle) tasksContainer.insertBefore(taskEl, doneToggle);
        else tasksContainer.appendChild(taskEl);
      }
    }

    const undoneCount = [...tasksContainer.querySelectorAll(':scope > .tasks-task')].length;
    const countEl = quadrant.querySelector(':scope > .tasks-quadrant-header > .tasks-quadrant-count');
    if (countEl) {
      if (undoneCount > 0 && getTasksSettings().showQuadrantCount) {
        countEl.textContent = undoneCount;
      } else {
        countEl.remove();
      }
    } else if (undoneCount > 0 && getTasksSettings().showQuadrantCount) {
      const header = quadrant.querySelector(':scope > .tasks-quadrant-header');
      if (header) {
        const badge = document.createElement('span');
        badge.className = 'tasks-quadrant-count';
        badge.textContent = undoneCount;
        header.appendChild(badge);
      }
    }

    const doneToggle = tasksContainer.querySelector(':scope > .tasks-done-toggle');
    const doneList = tasksContainer.querySelector(':scope > .tasks-done-list');
    if (doneToggle && doneList) {
      const doneCount = doneList.querySelectorAll(':scope > .tasks-task').length;
      const dc = doneToggle.querySelector('.tasks-done-count');
      if (dc) dc.textContent = doneCount;
      if (doneCount === 0) {
        doneToggle.remove();
        doneList.remove();
      }
    }
  }

  function autoGrowTasksInput(input) {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }

  function setTasksAddOpen(quad, open) {
    const key = quad.dataset.key;
    const input = quad.querySelector('.tasks-add-input');
    if (open) {
      quad.classList.add('adding');
      tasksOpenQuads.add(key);
      if (input) { input.value = ''; autoGrowTasksInput(input); input.focus(); }
    } else {
      quad.classList.remove('adding');
      tasksOpenQuads.delete(key);
      if (input) input.value = '';
    }
  }

  function addTasksTask(quadKey) {
    const input = container.querySelector(`.tasks-add-input[data-quad="${quadKey}"]`);
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;
    const lines = raw.split(/\n/).map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;
    const quad = quads.find(q => q.key === quadKey);
    if (!quad) return;
    const tasks = getTasksData();
    lines.forEach(text => tasks.push({ text, done: false, urgent: quad.urgent, important: quad.important, repeat: { type: 'none' } }));
    saveTasksData(tasks);
    renderTasksUIPreserveScroll(container);
    const newQuad = container.querySelector(`.tasks-quadrant[data-key="${quadKey}"]`);
    if (newQuad) {
      newQuad.classList.add('adding');
      const newInput = newQuad.querySelector('.tasks-add-input');
      if (newInput) { autoGrowTasksInput(newInput); newInput.focus(); }
    }
  }

  container.querySelectorAll('.tasks-add-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTasksTask(input.dataset.quad);
      }
      if (e.key === 'Escape') {
        const quad = input.closest('.tasks-quadrant');
        if (quad) setTasksAddOpen(quad, false);
      }
    });

    input.addEventListener('paste', () => {
      setTimeout(() => {
        if (input.value.includes('\n')) {
          addTasksTask(input.dataset.quad);
        }
      }, 0);
    });

    input.addEventListener('input', () => autoGrowTasksInput(input));
  });

  container.querySelectorAll('.tasks-add-send').forEach(btn => {
    btn.addEventListener('click', () => addTasksTask(btn.dataset.quad));
  });

  container.querySelectorAll('.tasks-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tasksMobileActiveQuad = btn.dataset.quad;
      applyTasksMobileView(container);
      const active = container.querySelector(`.tasks-quadrant[data-key="${tasksMobileActiveQuad}"]`);
      if (active) active.scrollIntoView({ block: 'nearest' });
    });
  });

  container.querySelectorAll('.tasks-quadrant').forEach(quad => {
    quad.addEventListener('dblclick', e => {
      if (e.target.closest('.tasks-task')) return;
      const input = quad.querySelector('.tasks-add-input');
      if (input) input.focus();
    });
  });

  if (!tasksOutsideCloseBound) {
    tasksOutsideCloseBound = true;
    document.addEventListener('click', e => {
      if (e.target.closest('.tasks-quadrant')) return;
      container.querySelectorAll('.tasks-quadrant.adding').forEach(q => {
        q.classList.remove('adding');
        const inp = q.querySelector('.tasks-add-input');
        if (inp) inp.value = '';
      });
    });
  }

  container.querySelectorAll('.tasks-done-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const key = toggle.dataset.quad;
      tasksDoneCollapsed[key] = !tasksDoneCollapsed[key];
      saveTasksDoneCollapsed();
      const doneList = toggle.nextElementSibling;
      if (doneList) {
        doneList.classList.toggle('collapsed', tasksDoneCollapsed[key]);
        if (!tasksDoneCollapsed[key]) {
          requestAnimationFrame(() => doneList.scrollIntoView({ block: 'nearest' }));
        }
      }
      const chevron = toggle.querySelector('.tasks-done-chevron');
      if (chevron) chevron.classList.toggle('rotated', !tasksDoneCollapsed[key]);
    });
  });

  setupDragDrop(container, { QUADRANTS_DEFAULTS, getTasksData, saveTasksData, renderTasksUI });

  // Тап по завданню більше не відкриває редагування —
  // на мобільних пристроях тап відкриває контекстне меню.
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  
  container.querySelectorAll('.tasks-task').forEach(item => {
    item.addEventListener('contextmenu', e => {
      const index = parseInt(item.dataset.index);
      e.preventDefault();
      showTaskContextMenu(e, index);
    });

    // На мобільних - тап відкриває контекстне меню
    if (isMobile) {
      item.addEventListener('click', e => {
        // Якщо клік по чекбоксу або кнопках - не відкриваємо меню
        if (e.target.closest('.task-checkbox-label') ||
            e.target.closest('.tasks-checkbox') || 
            e.target.closest('.tasks-task-subtasks')) {
          return;
        }
        const index = parseInt(item.dataset.index);
        showTaskContextMenu(e, index);
      });
    }
  });

  container.querySelectorAll('.tasks-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const taskEl = cb.closest('.tasks-task');
      const index = parseInt(taskEl.dataset.index);
      const tasks = getTasksData();
      if (tasks[index]) {
        tasks[index].done = cb.checked;
        saveTasksData(tasks);
        if (cb.checked) {
          playTasksSuccessSound();
          const checkmark = cb.closest('.tasks-task').querySelector('.task-checkmark');
          if (checkmark) {
            const rect = checkmark.getBoundingClientRect();
            createTasksConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }
        } else {
          playTasksUncheckSound();
        }
        applyTaskDone(taskEl, cb.checked);
        if (cb.checked) {
          const checkmark = container.querySelector(`.tasks-task[data-index="${index}"] .task-checkmark`);
          if (checkmark) {
            checkmark.classList.add('pulse');
            setTimeout(() => checkmark.classList.remove('pulse'), 300);
          }
        }
      }
    });
  });

  container.querySelectorAll('.tasks-task-subtasks').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const index = parseInt(btn.closest('.tasks-task').dataset.index);
      openRepeatModal(container, index);
    });
  });

  container.querySelectorAll('.tasks-quadrant-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('.tasks-add-row')) return;
      const quad = header.closest('.tasks-quadrant');
      setTasksAddOpen(quad, !quad.classList.contains('adding'));
    });

    header.addEventListener('contextmenu', e => {
      e.preventDefault();
      const quad = header.closest('.tasks-quadrant');
      const labelEl = header.querySelector('.tasks-quadrant-label');
      if (!labelEl) return;

      const oldLabel = labelEl.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-edit-input';
      input.value = oldLabel;

      let committed = false;
      let capturedValue = '';
      const commit = (save) => {
        if (committed) return;
        committed = true;
        if (save) {
          const trimmed = capturedValue;
          const key = quad.dataset.key;
          if (trimmed && trimmed !== oldLabel) {
            saveQuadrantLabel(key, trimmed);
            renderTasksUIPreserveScroll(container);
            return;
          }
        }
        labelEl.style.display = '';
        input.remove();
      };

      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          capturedValue = input.value.trim();
          commit(true);
        }
        if (ev.key === 'Escape') { committed = true; labelEl.style.display = ''; input.remove(); }
      });
      input.addEventListener('blur', () => { capturedValue = input.value.trim(); commit(true); });

      labelEl.style.display = 'none';
      labelEl.parentNode.insertBefore(input, labelEl.nextSibling);
      input.focus();
      input.select();
    });
  });
}

/* ========== CONTEXT MENU ========== */

let activeTaskContextMenu = null;

function showTaskContextMenu(event, index) {
  event.preventDefault();
  event.stopPropagation();

  hideTaskContextMenu();

  const menu = document.createElement('div');
  menu.className = 'tasks-context-menu';
  menu.innerHTML = `
    <div class="ctx-item" onclick="taskCtxEdit(${index})">
      ${ICON('pen', 14)}
      <span>Редагувати</span>
    </div>
    <div class="ctx-item" onclick="taskCtxDuplicate(${index})">
      ${ICON('copy', 14)}
      <span>Дублювати</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item ctx-item--danger" onclick="taskCtxDelete(${index})">
      ${ICON('trash', 14)}
      <span>Видалити</span>
    </div>
  `;

  document.body.appendChild(menu);
  activeTaskContextMenu = menu;

  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  requestAnimationFrame(() => menu.classList.add('visible'));

  setTimeout(() => {
    document.addEventListener('click', hideTaskContextMenu, { once: true });
    document.addEventListener('contextmenu', hideTaskContextMenu, { once: true });
  }, 0);
}

function hideTaskContextMenu() {
  if (activeTaskContextMenu) {
    activeTaskContextMenu.remove();
    activeTaskContextMenu = null;
  }
}

function taskCtxEdit(index) {
  hideTaskContextMenu();
  const container = getTasksOutputEl();
  openRepeatModal(container, index);
}

function taskCtxDuplicate(index) {
  hideTaskContextMenu();
  const tasks = getTasksData();
  const task = tasks[index];
  if (!task) return;
  const clone = JSON.parse(JSON.stringify(task));
  clone.text = task.text + ' (копія)';
  tasks.splice(index + 1, 0, clone);
  saveTasksData(tasks);
  const container = getTasksOutputEl();
  if (container) renderTasksUIPreserveScroll(container);
}

function taskCtxDelete(index) {
  hideTaskContextMenu();
  openTaskDeleteModal(index);
}

/* ========== DELETE MODAL ========== */

let taskToDeleteIndex = null;

function openTaskDeleteModal(index) {
  taskToDeleteIndex = index;
  const tasks = getTasksData();
  const name = (tasks[index] && tasks[index].text) || '';
  if (typeof window.openDeleteModal === 'function') {
    window.openDeleteModal({
      title: 'Видалити завдання',
      name: name,
      text: 'Цю дію неможливо скасувати.',
      confirmLabel: 'Видалити',
      onConfirm: confirmTaskDelete
    });
  }
}

function confirmTaskDelete() {
  const index = taskToDeleteIndex;
  if (index === null) return;
  const tasks = getTasksData();
  if (!tasks[index]) {
    taskToDeleteIndex = null;
    return;
  }
  const deletedTask = tasks[index];
  if (deletedTask && deletedTask.id) {
    gistAddDeletedId(currentDataset === 'code' ? 'code' : 'tasks', deletedTask.id);
  }
  tasks.splice(index, 1);
  saveTasksData(tasks);
  taskToDeleteIndex = null;
  const container = getTasksOutputEl();
  if (container) renderTasksUIPreserveScroll(container);
}

/* ========== REPEAT MODAL ========== */

function openRepeatModal(container, index) {
  const tasks = getTasksData();
  if (!tasks[index]) return;
  const task = tasks[index];
  const current = task.repeat || { type: 'none' };

  const initType = current.type === 'biweekly' ? 'weekly' : (current.type || 'none');
  const initInterval = current.type === 'biweekly' ? 2 : (current.interval || 1);

  const overlay = document.createElement('div');
  overlay.className = 'notes-modal tasks-repeat-modal';

  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayButtons = weekdayOrder.map(d => {
    const active = current.type === 'weekly' && (current.days || []).includes(d) ? ' active' : '';
    return `<button type="button" class="tasks-weekday${active}" data-day="${d}">${WEEKDAYS_SHORT[d]}</button>`;
  }).join('');

  const colorSwatches = TASK_COLORS.map(c => {
    const active = task.color === c ? ' active' : '';
    return `<button type="button" class="tasks-color-swatch${active}" data-color="${c}" style="--swatch:${c}" aria-label="${c}"></button>`;
  }).join('');

  const initialSubtasks = Array.isArray(task.subtasks) ? task.subtasks.map(s => ({ text: s.text || '', done: !!s.done })) : [];
  const hasSubtasks = initialSubtasks.length > 0;
  const hasColor = !!task.color;
  const REPEAT_LABELS = { daily: 'Щодня', weekly: 'Щотижня', monthly: 'Щомісяця' };
  const hasRepeat = initType !== 'none';
  const repeatHint = hasRepeat ? (REPEAT_LABELS[initType] || '') : '';

  const CHEVRON_SVG = ICON('chevronDown', 16, { strokeWidth: 2.4 });

  function subtaskItemsHtml(list) {
    return list.map((s, i) => `
      <div class="tasks-subtask-item${s.done ? ' done' : ''}" data-i="${i}">
        <button type="button" class="tasks-subtask-check${s.done ? ' done' : ''}" data-act="toggle" title="Виконано">
          ${ICON('check', 12, { strokeWidth: 3.2 })}
        </button>
        <span class="tasks-subtask-text" data-act="edit" contenteditable="true">${escapeHtml(s.text)}</span>
        <button type="button" class="tasks-subtask-del" data-act="del" title="Видалити">&times;</button>
      </div>
    `).join('');
  }

  const GEAR_SVG = ICON('settings2', 16);
  const PALETTE_SVG = ICON('palette', 16);
  const TRASH_SVG = ICON('trash2', 16);

  const showDesc = !!task.showDescription;
  const showSub = !!task.showSubtasks;

  overlay.innerHTML = `
    <div class="notes-modal-content">
      <div class="notes-modal-header">
        <span class="tasks-modal-title">Редагування <div class="tasks-gear-wrap"><button type="button" class="tasks-icon-btn" id="tasks-gear-btn">${GEAR_SVG}</button><div class="tasks-gear-dropdown" id="tasks-gear-dropdown"><label class="tasks-gear-option"><input type="checkbox" id="tasks-ed-desc"${showDesc ? ' checked' : ''}> Опис</label><label class="tasks-gear-option"><input type="checkbox" id="tasks-ed-sub"${showSub ? ' checked' : ''}> Підзавдання</label></div></div><div class="tasks-gear-wrap"><button type="button" class="tasks-icon-btn" id="tasks-color-btn"${task.color ? ` style="--swatch:${task.color};color:${task.color}"` : ''}>${PALETTE_SVG}</button><div class="tasks-color-dropdown" id="tasks-color-dropdown"><div class="tasks-gear-colors" id="tasks-color-row"><button type="button" class="tasks-color-swatch${!task.color ? ' active' : ''}" data-color="" aria-label="Без кольору"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>${colorSwatches}</div></div></div></span>
        <button class="notes-modal-close" id="tasks-repeat-close">&times;</button>
      </div>
      <div class="notes-modal-body">
        <label class="tasks-repeat-field-label" for="tasks-repeat-task-text">Назва завдання</label>
        <textarea class="tasks-repeat-text-input" id="tasks-repeat-task-text" placeholder="Наприклад: Почистити ноутбук" autocomplete="off" rows="1">${escapeHtml(task.text)}</textarea>

        <div class="tasks-editor-section${showDesc ? '' : ' hidden'}" data-section="description">
          <label class="tasks-repeat-field-label" for="tasks-repeat-desc">Опис</label>
          <textarea class="tasks-repeat-desc-input" id="tasks-repeat-desc" placeholder="Введіть опис...">${escapeHtml(task.description || '')}</textarea>
        </div>
        <div class="tasks-editor-section${showSub ? '' : ' hidden'}" data-section="subtasks">
          <div class="tasks-subtasks-section">
            <label class="tasks-repeat-field-label">Підзавдання ${hasSubtasks ? `<span class="tasks-collapsible-hint">${initialSubtasks.filter(s => s.done).length}/${initialSubtasks.length}</span>` : ''}</label>
            <div class="tasks-subtasks" id="tasks-subtasks">${subtaskItemsHtml(initialSubtasks)}</div>
            <div class="tasks-subtask-add">
              <input type="text" class="tasks-subtask-input" id="tasks-subtask-input" placeholder="Додати підзавдання..." autocomplete="off">
              <button type="button" class="tasks-subtask-add-btn" id="tasks-subtask-add-btn" title="Додати">+</button>
            </div>
          </div>
        </div>
        <label class="tasks-repeat-field-label">Повторення</label>
        <div class="tasks-repeat-options">
          <button type="button" class="tasks-repeat-option${initType === 'none' ? ' active' : ''}" data-type="none">Ніколи</button>
          <button type="button" class="tasks-repeat-option${initType === 'daily' ? ' active' : ''}" data-type="daily">Щодня</button>
          <button type="button" class="tasks-repeat-option${initType === 'weekly' ? ' active' : ''}" data-type="weekly">Щотижня</button>
          <button type="button" class="tasks-repeat-option${initType === 'monthly' ? ' active' : ''}" data-type="monthly">Щомісяця</button>
        </div>

        <div class="tasks-repeat-config" id="tasks-repeat-daily" style="${initType === 'daily' ? '' : 'display:none'}">
          <p class="tasks-repeat-hint">Завдання повторюватиметься щодня</p>
        </div>

        <div class="tasks-repeat-config" id="tasks-repeat-weekly" style="${initType === 'weekly' ? '' : 'display:none'}">
          <label class="tasks-repeat-field-label">Дні тижня</label>
          <div class="tasks-weekdays">${weekdayButtons}</div>
          <label class="tasks-repeat-field-label tasks-repeat-field-label-spaced">Частота</label>
          <div class="tasks-repeat-options">
            <button type="button" class="tasks-repeat-option${initInterval === 1 ? ' active' : ''}" data-interval="1">Щотижня</button>
            <button type="button" class="tasks-repeat-option${initInterval === 2 ? ' active' : ''}" data-interval="2">Через тиждень</button>
          </div>
        </div>

        <div class="tasks-repeat-config" id="tasks-repeat-monthly" style="${initType === 'monthly' ? '' : 'display:none'}">
          <label class="tasks-month-label">Кожного
            <span class="tasks-month-wrap">
              <input type="number" class="tasks-month-input" id="tasks-month-day" min="1" max="31" value="${current.type === 'monthly' && current.day ? current.day : new Date().getDate()}">
              <span class="tasks-month-steps">
                <button type="button" class="tasks-month-btn" data-step="1" aria-label="Більше">
                  ${ICON('chevronUp', 16, { strokeWidth: 2.6 })}
                </button>
                <button type="button" class="tasks-month-btn" data-step="-1" aria-label="Менше">
                  ${ICON('chevronDown', 16, { strokeWidth: 2.6 })}
                </button>
              </span>
            </span>
            числа
          </label>
        </div>
      </div>
      <div class="notes-modal-footer">
        <button class="modal-btn modal-btn--icon" id="tasks-repeat-delete">${TRASH_SVG}</button>
        <button class="modal-btn modal-btn--secondary" id="tasks-repeat-cancel">Скасувати</button>
        <button class="modal-btn modal-btn--primary" id="tasks-repeat-save">Зберегти</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const taskTextInput = overlay.querySelector('#tasks-repeat-task-text');
  if (taskTextInput) {
    const autoResize = () => {
      taskTextInput.style.height = 'auto';
      taskTextInput.style.height = taskTextInput.scrollHeight + 'px';
    };
    autoResize();
    taskTextInput.addEventListener('input', autoResize);
  }

  const gearBtn = overlay.querySelector('#tasks-gear-btn');
  const gearDropdown = overlay.querySelector('#tasks-gear-dropdown');
  const gearWrap = gearBtn.closest('.tasks-gear-wrap');
  const colorBtn = overlay.querySelector('#tasks-color-btn');
  const colorDropdown = overlay.querySelector('#tasks-color-dropdown');
  function openGear() {
    colorDropdown.classList.remove('open');
    gearDropdown.classList.add('open');
  }
  function openColor() {
    gearDropdown.classList.remove('open');
    colorDropdown.classList.add('open');
  }
  function closeDropdowns() {
    gearDropdown.classList.remove('open');
    colorDropdown.classList.remove('open');
  }

  function toggleGear(e) {
    e.stopPropagation();
    if (gearDropdown.classList.contains('open')) closeDropdowns();
    else openGear();
  }
  function toggleColor(e) {
    e.stopPropagation();
    if (colorDropdown.classList.contains('open')) closeDropdowns();
    else openColor();
  }

  gearBtn.addEventListener('click', toggleGear);
  colorBtn.addEventListener('click', toggleColor);

  overlay.addEventListener('click', e => {
    if (!e.target.closest('.tasks-gear-wrap')) closeDropdowns();
  });

  function toggleSection(name, visible) {
    const sec = overlay.querySelector(`.tasks-editor-section[data-section="${name}"]`);
    if (sec) sec.classList.toggle('hidden', !visible);
  }

  overlay.querySelector('#tasks-ed-desc').addEventListener('change', e => {
    tasks[index].showDescription = e.target.checked;
    saveTasksData(tasks);
    toggleSection('description', e.target.checked);
  });
  overlay.querySelector('#tasks-ed-sub').addEventListener('change', e => {
    tasks[index].showSubtasks = e.target.checked;
    saveTasksData(tasks);
    toggleSection('subtasks', e.target.checked);
  });

  let selectedType = initType;
  let selectedInterval = initInterval;
  let selectedColor = task.color || '';
  const selectedDays = new Set(current.type === 'weekly' ? (current.days || []) : []);
  const subtasks = initialSubtasks.slice();

  const typeButtons = overlay.querySelectorAll('.tasks-repeat-option[data-type]');
  const intervalButtons = overlay.querySelectorAll('.tasks-repeat-option[data-interval]');
  const dailyConfig = overlay.querySelector('#tasks-repeat-daily');
  const weeklyConfig = overlay.querySelector('#tasks-repeat-weekly');
  const monthlyConfig = overlay.querySelector('#tasks-repeat-monthly');

  function selectType(type) {
    selectedType = type;
    typeButtons.forEach(b => b.classList.toggle('active', b.dataset.type === type));
    dailyConfig.style.display = type === 'daily' ? '' : 'none';
    weeklyConfig.style.display = type === 'weekly' ? '' : 'none';
    monthlyConfig.style.display = type === 'monthly' ? '' : 'none';
  }

  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });

  intervalButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedInterval = parseInt(btn.dataset.interval);
      intervalButtons.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  overlay.querySelectorAll('.tasks-weekday').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day);
      if (selectedDays.has(d)) { selectedDays.delete(d); btn.classList.remove('active'); }
      else { selectedDays.add(d); btn.classList.add('active'); }
    });
  });

  const swatchButtons = overlay.querySelectorAll('.tasks-color-swatch');
  swatchButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color || '';
      swatchButtons.forEach(b => b.classList.toggle('active', b === btn));
      if (selectedColor) {
        colorBtn.style.setProperty('--swatch', selectedColor);
        colorBtn.style.color = selectedColor;
      } else {
        colorBtn.style.removeProperty('--swatch');
        colorBtn.style.color = '';
      }
    });
  });

  function updateSubtaskHint() {
    const section = overlay.querySelector('.tasks-subtasks-section');
    if (!section) return;
    const label = section.querySelector('.tasks-repeat-field-label');
    const existingHint = label.querySelector('.tasks-collapsible-hint');
    if (subtasks.length) {
      const html = `<span class="tasks-collapsible-hint">${subtasks.filter(s => s.done).length}/${subtasks.length}</span>`;
      if (existingHint) existingHint.outerHTML = html;
      else label.insertAdjacentHTML('beforeend', html);
    } else if (existingHint) {
      existingHint.remove();
    }
  }

  function renderSubtaskList() {
    const list = overlay.querySelector('#tasks-subtasks');
    if (!list) return;
    list.innerHTML = subtaskItemsHtml(subtasks);
    updateSubtaskHint();
  }

  function addSubtask() {
    const input = overlay.querySelector('#tasks-subtask-input');
    const val = input.value.trim();
    if (!val) return;
    subtasks.push({ text: val, done: false });
    input.value = '';
    renderSubtaskList();
    input.focus();
  }

  overlay.querySelector('#tasks-subtask-add-btn').addEventListener('click', addSubtask);
  overlay.querySelector('#tasks-subtask-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
  });

  const subtaskList = overlay.querySelector('#tasks-subtasks');
  subtaskList.addEventListener('click', e => {
    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const item = actEl.closest('.tasks-subtask-item');
    if (!item) return;
    const i = parseInt(item.dataset.i, 10);
    const act = actEl.dataset.act;
    if (act === 'toggle') {
      subtasks[i].done = !subtasks[i].done;
      renderSubtaskList();
    } else if (act === 'del') {
      subtasks.splice(i, 1);
      renderSubtaskList();
    }
  });
  subtaskList.addEventListener('input', e => {
    const item = e.target.closest('.tasks-subtask-item');
    if (!item || !e.target.closest('[data-act="edit"]')) return;
    const i = parseInt(item.dataset.i, 10);
    subtasks[i].text = e.target.textContent;
  });
  subtaskList.addEventListener('keydown', e => {
    const editEl = e.target.closest('[data-act="edit"]');
    if (!editEl || e.key !== 'Enter') return;
    e.preventDefault();
    const item = e.target.closest('.tasks-subtask-item');
    const i = parseInt(item.dataset.i, 10);
    subtasks.splice(i + 1, 0, { text: '', done: false });
    renderSubtaskList();
    const next = subtaskList.querySelector(`.tasks-subtask-item[data-i="${i + 1}"] .tasks-subtask-text`);
    if (next) next.focus();
  });

  overlay.querySelectorAll('.tasks-collapsible-head').forEach(head => {
    head.addEventListener('click', () => {
      const block = overlay.querySelector('#' + head.dataset.block);
      if (block) block.classList.toggle('open');
    });
  });

  const monthInput = overlay.querySelector('#tasks-month-day');
  monthInput.addEventListener('focus', () => monthInput.select());

  const monthMin = parseInt(monthInput.min, 10) || 1;
  const monthMax = parseInt(monthInput.max, 10) || 31;
  const monthBtns = overlay.querySelectorAll('.tasks-month-btn');
  const updateMonthBtns = () => {
    const v = parseInt(monthInput.value, 10) || monthMin;
    monthBtns.forEach(btn => {
      const step = parseInt(btn.dataset.step, 10);
      btn.disabled = (step < 0 && v <= monthMin) || (step > 0 && v >= monthMax);
    });
  };

  overlay.querySelectorAll('.tasks-month-btn').forEach(btn => {
    let holdTimer = null;
    let holdInterval = null;
    let holdCount = 0;

    function doStep() {
      const step = parseInt(btn.dataset.step, 10);
      let v = (parseInt(monthInput.value, 10) || 0) + step;
      v = Math.min(monthMax, Math.max(monthMin, v));
      monthInput.value = v;
      updateMonthBtns();
    }

    btn.addEventListener('mousedown', () => {
      holdCount = 0;
      doStep();
      holdTimer = setTimeout(() => {
        holdInterval = setInterval(doStep, 80);
      }, 500);
    });

    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);

    function stopHold() {
      clearTimeout(holdTimer);
      clearInterval(holdInterval);
      holdCount = 0;
    }
  });
  monthInput.addEventListener('input', updateMonthBtns);
  updateMonthBtns();

  function close() { overlay.remove(); }

  overlay.querySelector('#tasks-repeat-close').addEventListener('click', close);
  overlay.querySelector('#tasks-repeat-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = e.target;
      if (el.id === 'tasks-subtask-input' || el.closest('[data-act="edit"]')) return;
      e.preventDefault();
      overlay.querySelector('#tasks-repeat-save').click();
    }
  });

  overlay.querySelector('#tasks-repeat-delete').addEventListener('click', () => {
    close();
    openTaskDeleteModal(index);
  });

  overlay.querySelector('#tasks-repeat-save').addEventListener('click', () => {
    let repeat;
    if (selectedType === 'daily') {
      repeat = { type: 'daily' };
    } else if (selectedType === 'weekly') {
      const days = [...selectedDays].sort((a, b) => a - b);
      if (days.length === 0) {
        repeat = { type: 'none' };
      } else if (selectedInterval > 1) {
        const anchor = current.type === 'weekly' && current.interval > 1 && current.anchor ? current.anchor : new Date().toDateString();
        repeat = { type: 'weekly', days, interval: selectedInterval, anchor };
      } else {
        repeat = { type: 'weekly', days };
      }
    } else if (selectedType === 'monthly') {
      const day = parseInt(overlay.querySelector('#tasks-month-day').value) || new Date().getDate();
      repeat = { type: 'monthly', day: Math.min(31, Math.max(1, day)) };
    } else {
      repeat = { type: 'none' };
    }
    const newText = overlay.querySelector('#tasks-repeat-task-text').value.trim();
    if (newText) tasks[index].text = newText;
    tasks[index].repeat = repeat;
    tasks[index].color = selectedColor || undefined;
    tasks[index].description = overlay.querySelector('#tasks-repeat-desc').value.trim() || undefined;
    tasks[index].subtasks = subtasks.filter(s => s.text.trim()).map(s => ({ text: s.text.trim(), done: !!s.done }));
    saveTasksData(tasks);
    close();
    renderTasksUIPreserveScroll(container);
  });
}
