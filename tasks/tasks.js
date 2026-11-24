/* ---------- TASKS (EISENHOWER) — Factory Pattern ---------- */

/* ========== SHARED UTILITIES ========== */

function generateTaskId() {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function ensureTaskIds(tasks) {
  if (!Array.isArray(tasks)) return false;
  let changed = false;
  tasks.forEach(t => {
    if (t && t.id === undefined) { t.id = generateTaskId(); changed = true; }
  });
  return changed;
}

function taskContentKey(t) {
  return (t && t.text ? t.text : '') + '|' + (t && t.urgent ? 'u' : '') + (t && t.important ? 'i' : '');
}

// Ідентичність завдання для дедупу/злиття: за id, якщо він є (надійно —
// різні завдання з однаковим текстом/квадрантом лишаються різними), інакше
// (легасі-дані без id) — за змістом.
function taskIdentityKey(t) {
  return (t && t.id !== undefined) ? ('id:' + t.id) : ('c:' + taskContentKey(t));
}

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

// Злиття локальних і remote завдань за id (fallback — за змістом для
// легасі-даних без id). Якщо обидві сторони мають одне й те саме завдання,
// перемагає копія з новішим updatedAt — так локальний рух/редагування
// ніколи не «злітає» через застарілий remote-знімок, і навпаки.
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

function createTasksModule(config) {
  const P = config.prefix || '';
  const OUTPUT_ID = config.outputId || 'output-tasks';
  const CONTENT_ID = config.contentId || 'content-tasks';
  const ACTIONS_ID = config.actionsId || 'tasksActions';
  const IMPORT_FILE_ID = config.importFileId || 'tasksImportFile';
  const WIDTH_KEY = config.widthKey || 'tasks_container_width';
  const DATASET = config.dataset || 'tasks';

  const TASKS_STORAGE_KEY = P + 'tasks_data';
  const TASKS_DATE_KEY = P + 'tasks_last_date';
  const TASKS_LABELS_KEY = P + 'tasks_labels';
  const TASKS_DONE_COLLAPSED_KEY = P + 'tasks_done_collapsed';
  const TASKS_SETTINGS_KEY = P + 'tasks_settings';
  const TASKS_PROJECTS_KEY = P + 'tasks_projects';
  const TASKS_ACTIVE_PROJECT_KEY = P + 'tasks_active_project';
  const TASKS_QUICKADD_QUAD_KEY = P + 'tasks_quickadd_quad';
  const TASKS_RECENT_PROJECTS_KEY = P + 'tasks_recent_projects';

  const PROJECT_COLORS = ['#5b9cf5', '#4ac06a', '#f0a040', '#e05555', '#a855f7', '#2dd4bf', '#ec4899', '#9ca3af'];
  const NO_PROJECT_ID = '__none__';

  function markProjectsPending() {
    if (typeof codeGistStorage !== 'undefined' && DATASET === 'code' && codeGistStorage.isEnabled()) {
      codeGistStorage.markPendingChanges();
    }
    if (typeof tasksGistStorage !== 'undefined' && DATASET === 'tasks' && tasksGistStorage.isEnabled()) {
      tasksGistStorage.markPendingChanges();
    }
  }

  function generateProjectId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function getProjects() {
    try { return JSON.parse(localStorage.getItem(TASKS_PROJECTS_KEY)) || []; } catch { return []; }
  }

  function saveProjects(list) {
    localStorage.setItem(TASKS_PROJECTS_KEY, JSON.stringify(list));
    markProjectsPending();
  }

  function addProject(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const projects = getProjects();
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const project = { id: generateProjectId(), name: trimmed, color };
    projects.push(project);
    saveProjects(projects);
    return project;
  }

  function renameProject(id, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const projects = getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) return;
    project.name = trimmed;
    saveProjects(projects);
  }

  function deleteProject(id) {
    const projects = getProjects().filter(p => p.id !== id);
    saveProjects(projects);
    const tasks = getTasksData();
    let changed = false;
    tasks.forEach(t => { if (t.projectId === id) { delete t.projectId; changed = true; } });
    if (changed) saveTasksData(tasks);
    if (getActiveProjectFilter() === id) setActiveProjectFilter(null);
  }

  function getActiveProjectFilter() {
    return localStorage.getItem(TASKS_ACTIVE_PROJECT_KEY) || null;
  }

  function setActiveProjectFilter(id) {
    if (id) localStorage.setItem(TASKS_ACTIVE_PROJECT_KEY, id);
    else localStorage.removeItem(TASKS_ACTIVE_PROJECT_KEY);
  }

  function getRecentProjectIds() {
    try { return JSON.parse(localStorage.getItem(TASKS_RECENT_PROJECTS_KEY)) || []; } catch { return []; }
  }

  function pushRecentProjectId(id) {
    if (!id) return;
    const list = getRecentProjectIds().filter(pid => pid !== id);
    list.unshift(id);
    localStorage.setItem(TASKS_RECENT_PROJECTS_KEY, JSON.stringify(list.slice(0, 3)));
  }

  function getQuickAddQuad() {
    return localStorage.getItem(TASKS_QUICKADD_QUAD_KEY) || QUADRANTS_DEFAULTS[0].key;
  }

  function setQuickAddQuad(key) {
    localStorage.setItem(TASKS_QUICKADD_QUAD_KEY, key);
  }

  const tasksDoneCollapsed = loadTasksDoneCollapsed();

  function getTasksSettings() {
    const defaults = { showRepeatIcons: true, showQuadrantCount: true, showProjects: true, showTaskMenu: true, showProjectCounts: true, showCopyButton: true, showStatsBlock: true, statsBlockPosition: 'right', showCornerCounter: false, cornerCounterPosition: 'right', projectCountQuads: { do: true, schedule: true, delegate: true, delete: false } };
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
    if (typeof codeGistStorage !== 'undefined' && DATASET === 'code' && codeGistStorage.isEnabled()) {
      codeGistStorage.markPendingChanges();
    }
    if (typeof tasksGistStorage !== 'undefined' && DATASET === 'tasks' && tasksGistStorage.isEnabled()) {
      tasksGistStorage.markPendingChanges();
    }
  }

  const tasksOpenQuads = new Set();
  let tasksOutsideCloseBound = false;
  let tasksResizeState = null;

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
    if (typeof codeGistStorage !== 'undefined' && DATASET === 'code' && codeGistStorage.isEnabled()) {
      codeGistStorage.markPendingChanges();
    }
    if (typeof tasksGistStorage !== 'undefined' && DATASET === 'tasks' && tasksGistStorage.isEnabled()) {
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
    if (typeof codeGistStorage !== 'undefined' && DATASET === 'code' && codeGistStorage.isEnabled()) {
      codeGistStorage.markPendingChanges();
    }
    if (typeof tasksGistStorage !== 'undefined' && DATASET === 'tasks' && tasksGistStorage.isEnabled()) {
      tasksGistStorage.markPendingChanges();
    }
  }

  /* ========== REPEAT HELPERS ========== */

  const WEEKDAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const REPEAT_ICON_SVG = ICON('refreshCw', 14);

  const SUBTASK_ICON_SVG = ICON('checkSquare', 13);

  const TASK_COLORS = ['#e05555', '#f0a040', '#5b9cf5', '#4ac06a', '#a855f7', '#2dd4bf', '#ec4899', '#9ca3af'];

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

  function playTasksSuccessSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const frequencies = [523.25, 659.25, 783.99];
    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      const startTime = audioContext.currentTime + (index * 0.1);
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    });
  }

  function playTasksUncheckSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const frequencies = [783.99, 659.25, 523.25];
    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      const startTime = audioContext.currentTime + (index * 0.1);
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    });
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
    try {
      const tasks = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY)) || [];
      let migrated = false;
      tasks.forEach(t => {
        if (t.title && !t.text) { t.text = t.title; delete t.title; migrated = true; }
        // Завдання з іншого датасету (напр. «code»/Код) не належать цьому
        // модулю — відкидаємо, щоб не змішувалися між вкладками/синхронізацією.
        if (t.dataset && t.dataset !== DATASET) migrated = true;
      });
      if (ensureTaskIds(tasks)) migrated = true;
      const cleaned = dedupeTasks(tasks).filter(t => !t.dataset || t.dataset === DATASET);
      if (cleaned.length !== tasks.length) migrated = true;
      if (migrated) saveTasksData(cleaned);
      return cleaned;
    } catch { return []; }
  }

  function saveTasksData(data) {
    let prevById = new Map();
    try {
      const prev = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY)) || [];
      prev.forEach(t => { if (t && t.id !== undefined) prevById.set(t.id, t); });
    } catch {}
    const now = Date.now();
    const stripTs = (obj) => { const c = { ...obj }; delete c.updatedAt; delete c.dataset; return c; };
    const tagged = (Array.isArray(data) ? data : []).map(t => {
      if (t && typeof t === 'object') {
        const prevT = t.id !== undefined ? prevById.get(t.id) : undefined;
        const contentChanged = !prevT || JSON.stringify(stripTs(prevT)) !== JSON.stringify(stripTs(t));
        return { ...t, dataset: DATASET, updatedAt: contentChanged ? now : (t.updatedAt || (prevT && prevT.updatedAt) || now) };
      }
      return t;
    });
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tagged));
    gistTouchLocalModified(DATASET);
    const gst = DATASET === 'code' ? (typeof codeGistStorage !== 'undefined' ? codeGistStorage : null) : (typeof tasksGistStorage !== 'undefined' ? tasksGistStorage : null);
    if (gst && gst.isEnabled()) {
      gst.markPendingChanges();
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
    a.download = `${DATASET}-backup-${new Date().toISOString().split('T')[0]}.json`;
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
        ensureTaskIds(validTasks);

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
          const output = document.getElementById(OUTPUT_ID);
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

  let _midnightTimer = null;

  function scheduleTasksMidnightReset() {
    if (_midnightTimer) clearTimeout(_midnightTimer);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - now;
    _midnightTimer = setTimeout(() => {
      checkTasksDailyReset();
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUI(output);
      scheduleTasksMidnightReset();
    }, msUntilMidnight);
  }

  /* ========== INIT ========== */

  function init() {
    const output = document.getElementById(OUTPUT_ID);
    if (!output) return;
    checkTasksDailyReset();
    renderTasksUI(output);
    scheduleTasksMidnightReset();
    renderActions();
    const gst = DATASET === 'code' ? (typeof codeGistStorage !== 'undefined' ? codeGistStorage : null) : (typeof tasksGistStorage !== 'undefined' ? tasksGistStorage : null);
    if (gst && gst.isEnabled()) {
      gst.startAutoSync();
    }
  }

  function renderActions() {
    const existing = document.getElementById(ACTIONS_ID);
    if (existing) existing.remove();

    const actions = document.createElement('div');
    actions.id = ACTIONS_ID;
    actions.className = 'tasks-actions';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'tasks-export-btn';
    exportBtn.title = 'Експортувати дані';
    exportBtn.innerHTML = ICON('download', 20);
    exportBtn.addEventListener('click', () => exportTasksData());

    const importBtn = document.createElement('button');
    importBtn.className = 'tasks-import-btn';
    importBtn.title = 'Імпортувати дані';
    importBtn.innerHTML = ICON('upload', 20);
    importBtn.addEventListener('click', () => document.getElementById(IMPORT_FILE_ID).click());

    const importFile = document.createElement('input');
    importFile.type = 'file';
    importFile.id = IMPORT_FILE_ID;
    importFile.accept = '.json';
    importFile.style.display = 'none';
    importFile.addEventListener('change', (e) => importTasksData(e));

    const syncBtn = document.createElement('button');
    syncBtn.className = 'tasks-sync-btn';
    syncBtn.title = 'Синхронізувати з Gist';
    syncBtn.innerHTML = ICON('refreshCw', 20);
    syncBtn.addEventListener('click', () => manualSync());

    const statsBtn = document.createElement('button');
    statsBtn.className = 'tasks-stats-btn';
    statsBtn.id = `${P}tasks-stats-action-btn`;
    statsBtn.title = 'Статистика';
    statsBtn.innerHTML = ICON('barChart', 20);
    statsBtn.addEventListener('click', () => {
      const modal = document.querySelector(`#${P}tasks-stats-modal`);
      if (modal) modal.classList.add('open');
    });

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'tasks-settings-btn';
    settingsBtn.title = 'Налаштування';
    settingsBtn.innerHTML = ICON('bolt', 24);
    settingsBtn.addEventListener('click', () => openSettingsModal());

    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    actions.appendChild(importFile);
    actions.appendChild(syncBtn);
    actions.appendChild(statsBtn);
    actions.appendChild(settingsBtn);

    const host = document.getElementById(CONTENT_ID) || document.body;
    host.appendChild(actions);

    settingsBtn.addEventListener('mouseenter', () => actions.classList.add('show-actions'));
    statsBtn.addEventListener('mouseenter', () => actions.classList.add('show-actions'));
    actions.addEventListener('mouseleave', () => actions.classList.remove('show-actions'));
  }

  function manualSync() {
    const gst = DATASET === 'code' ? (typeof codeGistStorage !== 'undefined' ? codeGistStorage : null) : (typeof tasksGistStorage !== 'undefined' ? tasksGistStorage : null);
    if (!gst || !gst.isEnabled()) {
      alert('Синхронізація з Gist не налаштована. Налаштуйте її в нотатках.');
      return;
    }

    const syncBtn = document.querySelector(`#${ACTIONS_ID} .tasks-sync-btn`);
    if (syncBtn) syncBtn.classList.add('syncing');

    gst.loadTasksFromGist()
      .then(data => {
        if (data && Array.isArray(data.tasks)) {
          const localModified = gistGetLocalModified(DATASET);
          const remoteModified = data.lastModified || data.lastSync || 0;

          if (gistRemoteIsNewer(remoteModified, localModified)) {
            const localTasks = (() => {
              try { return JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY)) || []; } catch { return []; }
            })();
            if (JSON.stringify(data.tasks) !== JSON.stringify(localTasks)) {
              gst.applyTasksData(data);
              gistSetLocalModified(DATASET, gistNormalizeModified(remoteModified));
              const output = document.getElementById(OUTPUT_ID);
              if (output) renderTasksUI(output);
              alert('Отримано новіші дані з Gist!');
              return;
            }
          }

          gst.updateTasksInGist();
          alert('Локальні дані актуальні — синхронізовано з Gist!');
        } else {
          gst.updateTasksInGist();
          alert('Дані вже синхронізовано.');
        }
      })
      .catch(err => {
        console.error('Manual sync error:', err);
        alert('Помилка синхронізації: ' + err.message);
      })
      .finally(() => {
        if (syncBtn) syncBtn.classList.remove('syncing');
      });
  }

  function getIncompleteCountPerProject() {
    const tasks = getTasksData();
    const counts = new Map();
    const settings = getTasksSettings();
    const enabledQuads = settings.projectCountQuads || { do: true, schedule: true, delegate: true, delete: false };

    tasks.forEach(t => {
      if (t.done) return;
      const quadKey = (t.urgent && t.important) ? 'do' :
                      (t.important) ? 'schedule' :
                      (t.urgent) ? 'delegate' : 'delete';
      if (!enabledQuads[quadKey]) return;

      const projId = t.projectId || NO_PROJECT_ID;
      counts.set(projId, (counts.get(projId) || 0) + 1);
    });

    return counts;
  }

  function openSettingsModal() {
    const settings = getTasksSettings();

    const settingsBtn = document.querySelector('.tasks-settings-btn');
    const actionsWrap = document.querySelector('.tasks-actions');
    if (settingsBtn) settingsBtn.classList.add('is-active');
    if (actionsWrap) actionsWrap.classList.add('is-active');

    const overlay = document.createElement('div');
    overlay.className = 'notes-modal tasks-repeat-modal';
    overlay.innerHTML = `
      <div class="notes-modal-content">
        <div class="notes-modal-header">
          <h3>Налаштування</h3>
          <button class="notes-modal-close" data-action="close">&times;</button>
        </div>
        <div class="modal-tabs" role="tablist">
          <button type="button" class="modal-tab active" data-tab-target="view">Вигляд</button>
          <button type="button" class="modal-tab" data-tab-target="projects">Проєкти</button>
          <button type="button" class="modal-tab" data-tab-target="stats">Статистика</button>
        </div>
        <div class="notes-modal-body">
          <div class="modal-tab-panel active" data-tab-panel="view">
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Показувати іконки повторень
                <span class="tasks-settings-sub">Значок ↻ біля завдань, що повторюються</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-repeat-icons"${settings.showRepeatIcons ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Лічильник завдань у заголовку
                <span class="tasks-settings-sub">Кількість активних завдань у квадранті</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-quadrant-count"${settings.showQuadrantCount ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Меню завдання
                <span class="tasks-settings-sub">Кнопка трьох крапок на краю кожного завдання</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-show-task-menu"${settings.showTaskMenu ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            ${DATASET === 'code' ? `
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Кнопка копіювання
                <span class="tasks-settings-sub">Іконка копіювання тексту завдання праворуч</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-show-copy-btn"${settings.showCopyButton ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            ` : ''}
          </div>
          <div class="modal-tab-panel" data-tab-panel="projects">
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Показувати проєкти
                <span class="tasks-settings-sub">Фільтр проєктів, бейджі та призначення завдань</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-show-projects"${settings.showProjects ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Лічильник невиконаних у проєктах
                <span class="tasks-settings-sub">Показувати кількість невиконаних завдань при кожному проєкті</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-project-counts"${settings.showProjectCounts && settings.showProjects ? ' checked' : ''}${settings.showProjects ? '' : ' disabled'}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            <div class="tasks-settings-quadrants" style="display: ${settings.showProjectCounts && settings.showProjects ? 'block' : 'none'};">
              <div class="tasks-settings-sub">Квадранти для лічильника:</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                ${getQuadrants().map(q => `
                  <button type="button" class="tasks-setting-quad-chip${settings.projectCountQuads[q.key] ? ' active' : ''}" data-quad="${q.key}" style="--quad-color: ${q.color}">
                    ${q.label}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="modal-tab-panel" data-tab-panel="stats">
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Блок статистики
                <span class="tasks-settings-sub">Показати статистику завдань на сторінці</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-show-stats"${settings.showStatsBlock ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            <div class="tasks-settings-stats-position" style="display: ${settings.showStatsBlock ? 'block' : 'none'};">
              <label class="tasks-settings-text" style="margin-bottom: 8px;">
                Положення статистики
                <span class="tasks-settings-sub">Де розташувати блок статистики</span>
              </label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="tasks-setting-position-btn${settings.statsBlockPosition === 'left' ? ' active' : ''}" data-position="left" style="flex: 1; min-width: 80px;">Зліва</button>
                <button type="button" class="tasks-setting-position-btn${settings.statsBlockPosition === 'right' ? ' active' : ''}" data-position="right" style="flex: 1; min-width: 80px;">Справа</button>
                <button type="button" class="tasks-setting-position-btn${settings.statsBlockPosition === 'bottom' ? ' active' : ''}" data-position="bottom" style="flex: 1; min-width: 80px;">Знизу</button>
              </div>
            </div>
            <label class="tasks-settings-row">
              <span class="tasks-settings-text">
                Лічильник у кутку екрана
                <span class="tasks-settings-sub">Напис в кутку «№ завдань» / «№ виконано»</span>
              </span>
              <span class="tasks-switch">
                <input type="checkbox" id="${P}tasks-setting-corner-counter"${settings.showCornerCounter ? ' checked' : ''}>
                <span class="tasks-switch-slider"></span>
              </span>
            </label>
            <div class="tasks-settings-stats-position" id="${P}tasks-corner-counter-position" style="display: ${settings.showCornerCounter ? 'block' : 'none'};">
              <label class="tasks-settings-text" style="margin-bottom: 8px;">
                Кут розташування
                <span class="tasks-settings-sub">Де показувати лічильник</span>
              </label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="tasks-setting-position-btn tasks-setting-corner-btn${settings.cornerCounterPosition === 'top-left' ? ' active' : ''}" data-corner="top-left" style="flex: 1; min-width: 80px;">Верхній лівий</button>
                <button type="button" class="tasks-setting-position-btn tasks-setting-corner-btn${settings.cornerCounterPosition === 'top-right' ? ' active' : ''}" data-corner="top-right" style="flex: 1; min-width: 80px;">Верхній правий</button>
                <button type="button" class="tasks-setting-position-btn tasks-setting-corner-btn${settings.cornerCounterPosition === 'left' ? ' active' : ''}" data-corner="left" style="flex: 1; min-width: 80px;">Нижній лівий</button>
                <button type="button" class="tasks-setting-position-btn tasks-setting-corner-btn${settings.cornerCounterPosition === 'right' ? ' active' : ''}" data-corner="right" style="flex: 1; min-width: 80px;">Нижній правий</button>
              </div>
            </div>
          </div>
        </div>
        <div class="notes-modal-footer">
          <button class="gist-btn gist-btn-primary" data-action="done">Готово</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      if (settingsBtn) settingsBtn.classList.remove('is-active');
      if (actionsWrap) actionsWrap.classList.remove('is-active');
    }

    overlay.querySelector(`#${P}tasks-setting-repeat-icons`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showRepeatIcons = e.target.checked;
      saveTasksSettings(s);
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    overlay.querySelector(`#${P}tasks-setting-quadrant-count`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showQuadrantCount = e.target.checked;
      saveTasksSettings(s);
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    overlay.querySelector(`#${P}tasks-setting-show-projects`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showProjects = e.target.checked;
      if (!e.target.checked) s.showProjectCounts = false;
      saveTasksSettings(s);
      const pcCheckbox = overlay.querySelector(`#${P}tasks-setting-project-counts`);
      const quadsSection = overlay.querySelector('.tasks-settings-quadrants');
      if (pcCheckbox) {
        pcCheckbox.disabled = !e.target.checked;
        pcCheckbox.checked = s.showProjectCounts;
      }
      if (quadsSection) quadsSection.style.display = s.showProjectCounts ? 'block' : 'none';
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    overlay.querySelector(`#${P}tasks-setting-project-counts`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showProjectCounts = e.target.checked;
      saveTasksSettings(s);
      const quadsSection = overlay.querySelector('.tasks-settings-quadrants');
      if (quadsSection) quadsSection.style.display = e.target.checked ? 'block' : 'none';
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    overlay.querySelectorAll('.tasks-setting-quad-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        e.preventDefault();
        const quadKey = chip.dataset.quad;
        const s = getTasksSettings();
        if (!s.projectCountQuads) s.projectCountQuads = {};
        s.projectCountQuads[quadKey] = !s.projectCountQuads[quadKey];
        chip.classList.toggle('active');
        saveTasksSettings(s);
        const output = document.getElementById(OUTPUT_ID);
        if (output) renderTasksUIPreserveScroll(output);
      });
    });

    overlay.querySelector(`#${P}tasks-setting-show-task-menu`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showTaskMenu = e.target.checked;
      saveTasksSettings(s);
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    if (DATASET === 'code') {
      const copyBtnSetting = overlay.querySelector(`#${P}tasks-setting-show-copy-btn`);
      if (copyBtnSetting) {
        copyBtnSetting.addEventListener('change', e => {
          const s = getTasksSettings();
          s.showCopyButton = e.target.checked;
          saveTasksSettings(s);
          const output = document.getElementById(OUTPUT_ID);
          if (output) renderTasksUIPreserveScroll(output);
        });
      }
    }

    overlay.querySelector(`#${P}tasks-setting-show-stats`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showStatsBlock = e.target.checked;
      saveTasksSettings(s);
      const positionContainer = overlay.querySelector('.tasks-settings-stats-position');
      if (positionContainer) positionContainer.style.display = e.target.checked ? 'block' : 'none';
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    overlay.querySelectorAll('.tasks-setting-position-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const s = getTasksSettings();
        s.statsBlockPosition = btn.dataset.position;
        saveTasksSettings(s);
        overlay.querySelectorAll('.tasks-setting-position-btn').forEach(b => b.classList.toggle('active', b === btn));
        const output = document.getElementById(OUTPUT_ID);
        if (output) renderTasksUIPreserveScroll(output);
      });
    });

    overlay.querySelector(`#${P}tasks-setting-corner-counter`).addEventListener('change', e => {
      const s = getTasksSettings();
      s.showCornerCounter = e.target.checked;
      saveTasksSettings(s);
      const positionContainer = overlay.querySelector(`#${P}tasks-corner-counter-position`);
      if (positionContainer) positionContainer.style.display = e.target.checked ? 'block' : 'none';
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    });

    overlay.querySelectorAll('.tasks-setting-corner-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const s = getTasksSettings();
        s.cornerCounterPosition = btn.dataset.corner;
        saveTasksSettings(s);
        overlay.querySelectorAll('.tasks-setting-corner-btn').forEach(b => b.classList.toggle('active', b === btn));
        const output = document.getElementById(OUTPUT_ID);
        if (output) renderTasksUIPreserveScroll(output);
      });
    });

    overlay.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t === tab));
        overlay.querySelectorAll('.modal-tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.dataset.tabPanel === tab.dataset.tabTarget);
        });
      });
    });

    overlay.querySelector('[data-action="close"]').addEventListener('click', close);
    overlay.querySelector('[data-action="done"]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  /* ========== BULK ADD MODAL ========== */

  function openBulkAddModal(presetKey) {
    const quads = getQuadrants();
    const quad = quads.find(q => q.key === presetKey) || quads[0];
    if (!quad) return;

    const overlay = document.createElement('div');
    overlay.className = 'notes-modal tasks-bulk-modal';

    overlay.innerHTML = `
      <div class="notes-modal-content">
        <div class="notes-modal-header">
          <h3 class="tasks-modal-title">Додати в «${quad.label}»</h3>
          <button class="notes-modal-close" data-action="close">&times;</button>
        </div>
        <div class="notes-modal-body">
          <label class="tasks-repeat-field-label tasks-bulk-label" id="${P}tasks-bulk-label" for="${P}tasks-bulk-text">Додано завдань: <span class="tasks-bulk-num">0</span></label>
          <textarea class="tasks-repeat-text-input" id="${P}tasks-bulk-text" placeholder="Введіть ваші завдання..." autocomplete="off" rows="6"></textarea>
          <p class="tasks-bulk-hint">${ICON('info', 16)} Кожен рядок буде додано як окреме завдання.</p>
        </div>
        <div class="notes-modal-footer">
          <button class="gist-btn" data-action="cancel">Скасувати</button>
          <button class="gist-btn gist-btn-primary" data-action="add">Додати</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const textInput = overlay.querySelector(`#${P}tasks-bulk-text`);
    const addBtn = overlay.querySelector('[data-action="add"]');
    const labelEl = overlay.querySelector(`#${P}tasks-bulk-label`);

    function parseLines() {
      return textInput.value.split(/\n/).map(l => l.trim()).filter(l => l);
    }

    function refresh() {
      const lines = parseLines();
      labelEl.innerHTML = 'Додано завдань: <span class="tasks-bulk-num">' + lines.length + '</span>';
    }

    textInput.addEventListener('input', () => { refresh(); });
    refresh();
    requestAnimationFrame(() => textInput.focus());

    function close() { overlay.remove(); }

    function add() {
      const lines = parseLines();
      if (lines.length === 0) return;
      const tasks = getTasksData();
      lines.forEach(text => tasks.push({
        id: generateTaskId(),
        text,
        done: false,
        urgent: quad.urgent,
        important: quad.important,
        repeat: { type: 'none' }
      }));
      saveTasksData(tasks);
      close();
      const output = document.getElementById(OUTPUT_ID);
      if (output) renderTasksUIPreserveScroll(output);
    }

    overlay.querySelector('[data-action="close"]').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-action="add"]').addEventListener('click', add);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        add();
      }
    });
  }

  /* ========== RENDER ========== */

  function renderTasksUI(container) {
    const tasks = getTasksData();
    const projects = getProjects();
    const activeProject = getActiveProjectFilter();
    const quickAddQuad = getQuickAddQuad();
    const projectById = id => projects.find(p => p.id === id);
    const showProjects = getTasksSettings().showProjects;

    const quadsHtml = getQuadrants().map(q => {
      const quadTasks = tasks
        .map((t, i) => ({ ...t, _index: i }))
        .filter(t => t.important === q.important && t.urgent === q.urgent)
        .filter(t => {
          if (!activeProject) return true;
          if (activeProject === NO_PROJECT_ID) return !t.projectId;
          return t.projectId === activeProject;
        });

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
        const project = task.projectId ? projectById(task.projectId) : null;
        const hideProjectBadge = activeProject && task.projectId === activeProject;
        const projectBadge = (showProjects && project && !hideProjectBadge)
          ? `<button type="button" class="tasks-task-project" data-project="${project.id}" style="--project-color:${project.color}" title="Фільтрувати за «${escapeAttr(project.name)}»">${escapeHtml(project.name)}</button>`
          : '';
        const quickAssignBtn = (showProjects && activeProject === NO_PROJECT_ID && projects.length > 0)
          ? `<button type="button" class="tasks-task-quickproject" data-index="${task._index}" title="Призначити проєкт">${ICON('folderPlus', 14)}</button>`
          : '';
        const menuBtn = getTasksSettings().showTaskMenu
          ? `<button type="button" class="tasks-task-menu" data-index="${task._index}" title="Меню завдання">${ICON('ellipsis', 14)}</button>`
          : '';
        const copyBtn = (DATASET === 'code' && getTasksSettings().showCopyButton)
          ? `<button type="button" class="tasks-task-copy" data-index="${task._index}" title="Копіювати текст">${ICON('copy', 9)}</button>`
          : '';
        return `
          <div class="tasks-task" data-index="${task._index}" draggable="true">
            <label class="task-checkbox-label">
              <input type="checkbox" class="tasks-checkbox"${checked}>
              <span class="task-checkmark"></span>
            </label>
            ${colorDot}
            <span class="tasks-task-text${textClass}">${escapeHtml(task.text)}</span>
            ${showRepeatIcon ? `<button class="tasks-task-repeat active" title="Повторюваність">${REPEAT_ICON_SVG}</button>` : ''}
            ${subtaskBadge}
            ${projectBadge}
            ${quickAssignBtn}
            ${copyBtn}
            ${menuBtn}
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
        <div class="tasks-quadrant${tasksOpenQuads.has(q.key) ? ' adding' : ''}" data-key="${q.key}" style="--quadrant-color: ${q.color}">
          <div class="tasks-quadrant-header" style="border-left-color: ${q.color}">
            <span class="tasks-quadrant-dot" style="background: ${q.color}"></span>
            <span class="tasks-quadrant-label">${q.label}</span>
            ${getTasksSettings().showQuadrantCount && undoneTasks.length > 0 ? `<span class="tasks-quadrant-count">${undoneTasks.length}</span>` : ''}
            <div class="tasks-add-row">
              <textarea class="tasks-add-input" data-quad="${q.key}" placeholder="Нове завдання..." autocomplete="off" rows="1"></textarea>
              <button class="tasks-add-send" data-quad="${q.key}" title="Додати">
                ${ICON('send', 18)}
              </button>
            </div>
            <button class="tasks-add-toggle${tasksOpenQuads.has(q.key) ? ' active' : ''}" data-quad="${q.key}" title="Нове завдання">
              ${ICON('plusVert', 16)}
            </button>
            <button class="tasks-bulk-toggle" data-quad="${q.key}" title="Додати списком">
              ${ICON('listFilter', 16)}
            </button>
          </div>
          <div class="tasks-quadrant-tasks">
            ${undoneHtml}
            ${doneHtml}
          </div>
        </div>
      `;
    }).join('');

    const quickAddQuadsHtml = getQuadrants().map(q => `
      <button type="button" class="tasks-quickadd-quad${q.key === quickAddQuad ? ' active' : ''}" data-quad="${q.key}" style="--quadrant-color:${q.color}" title="${escapeAttr(q.label)}"></button>
    `).join('');

    const allChipActive = !activeProject ? ' active' : '';
    const hasNoProjectTasks = tasks.some(t => !t.projectId);
    const showProjCounts = getTasksSettings().showProjectCounts;
    const projCounts = showProjCounts ? getIncompleteCountPerProject() : new Map();

    const noProjectCount = projCounts.get(NO_PROJECT_ID) || 0;
    const noProjectChipHtml = (showProjects && projects.length > 0 && hasNoProjectTasks)
      ? `<button type="button" class="tasks-project-chip tasks-project-chip-none${activeProject === NO_PROJECT_ID ? ' active' : ''}" data-project="${NO_PROJECT_ID}">Немає${showProjCounts && noProjectCount > 0 ? ` <span class="tasks-project-count">${noProjectCount}</span>` : ''}</button>`
      : '';
    const projectChipsHtml = showProjects
      ? `
        <button type="button" class="tasks-project-chip tasks-project-chip-all${allChipActive}" data-project="">Всі</button>
        ${noProjectChipHtml}
        ${projects.map(p => {
          const count = projCounts.get(p.id) || 0;
          const countHtml = showProjCounts && count > 0 ? ` <span class="tasks-project-count">${count}</span>` : '';
          return `<button type="button" class="tasks-project-chip${p.id === activeProject ? ' active' : ''}" data-project="${p.id}" style="--project-color:${p.color}">${escapeHtml(p.name)}${countHtml}</button>`;
        }).join('')}
        <button type="button" class="tasks-project-chip-add" id="${P}tasks-project-add" title="Новий проєкт">${ICON('plus', 14)}</button>
      `
      : '';

    const doneCount = tasks.filter(t => t.done).length;
    const pluralizeUk = (n, one, few, many) => {
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return one;
      if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
      return many;
    };
    const tasksWord = pluralizeUk(tasks.length, 'завдання', 'завдання', 'завдань');
    const statsCaption = `${tasks.length} ${tasksWord} · ${doneCount} виконано`;

    const statsSettings = getTasksSettings();
    const showStatsBlock = statsSettings.showStatsBlock;
    const statsPosition = statsSettings.statsBlockPosition || 'right';

    const showCornerCounter = statsSettings.showCornerCounter;
    const cornerCounterPosition = statsSettings.cornerCounterPosition || 'right';
    const cornerCounterHtml = showCornerCounter ? `
      <div class="tasks-corner-counter" data-position="${cornerCounterPosition}">
        <span class="tasks-corner-counter-line">${tasks.length} завдань</span>
        <span class="tasks-corner-counter-line">${doneCount} виконано</span>
      </div>
    ` : '';

    const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
    const circumference = 2 * Math.PI * 15.5;
    const dashoffset = circumference * (1 - progress / 100);
    const leftCount = tasks.length - doneCount;
    const leftWord = pluralizeUk(leftCount, 'залишилось', 'залишилось', 'залишилось');

    const statsBlockHtml = showStatsBlock ? `
      <div class="tasks-stats-block" data-position="${statsPosition}">
        <svg class="tasks-stats-ring" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-hover)" stroke-width="3"></circle>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashoffset.toFixed(1)}" transform="rotate(-90 18 18)"></circle>
          <text x="18" y="20.5" text-anchor="middle">${progress}%</text>
        </svg>
        <div class="tasks-stats-text">
          <div class="main"><b>${doneCount}</b> з <b>${tasks.length}</b> виконано</div>
          <div class="sub">${leftCount} ${leftWord}</div>
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="tasks-container" data-stats-position="${statsPosition}">
        <div class="tasks-toolbar">
          <div class="tasks-quickadd">
            <textarea class="tasks-quickadd-input" id="${P}tasks-quickadd-input" placeholder="Нова задача..." autocomplete="off" rows="1"></textarea>
            <div class="tasks-quickadd-quads">${quickAddQuadsHtml}</div>
            <button type="button" class="tasks-quickadd-send" id="${P}tasks-quickadd-send" title="Додати">${ICON('send', 16)}</button>
          </div>
          ${showProjects ? `<div class="tasks-project-filter" id="${P}tasks-project-filter">${projectChipsHtml}</div>` : ''}
        </div>
        <div class="tasks-main-content">
          <div class="tasks-grid">
            ${quadsHtml}
          </div>
          ${statsBlockHtml}
        </div>
        <div class="tasks-resizer" id="${P}tasks-resizer"></div>
        <div class="tasks-stats-modal" id="${P}tasks-stats-modal">
          <div class="tasks-stats-modal-overlay"></div>
          <div class="tasks-stats-modal-content">
            <div class="tasks-stats-modal-close" id="${P}tasks-stats-modal-close">×</div>
            <div class="tasks-stats-modal-header">Статистика</div>
            <div class="tasks-stats-modal-body">
              <div class="tasks-stats-item">
                <span class="tasks-stats-label">Всього завдань:</span>
                <span class="tasks-stats-value">${tasks.length}</span>
              </div>
              <div class="tasks-stats-item">
                <span class="tasks-stats-label">Виконано:</span>
                <span class="tasks-stats-value">${doneCount}</span>
              </div>
              <div class="tasks-stats-item">
                <span class="tasks-stats-label">Прогрес:</span>
                <span class="tasks-stats-value">${tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${cornerCounterHtml}
    `;

    bindTasksEvents(container);
  }

  /* ========== EVENTS ========== */

  function copyToClipboard(text, e) {
    const done = () => showCopyToast(e);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => { copyToClipboardFallback(text); done(); });
    } else {
      copyToClipboardFallback(text);
      done();
    }
  }

  function copyToClipboardFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  function showCopyToast(e) {
    const toast = document.createElement('div');
    toast.className = 'tasks-copy-toast';
    toast.textContent = 'Скопійовано';
    document.body.appendChild(toast);
    const x = e && e.clientX ? e.clientX : window.innerWidth / 2;
    const y = e && e.clientY ? e.clientY : window.innerHeight / 2;
    toast.style.left = x + 'px';
    toast.style.top = (y - 8) + 'px';
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 200); }, 800);
  }

  function renderTasksUIPreserveScroll(container) {
    const scrollStates = [];
    container.querySelectorAll('.tasks-quadrant-tasks').forEach(el => {
      scrollStates.push({ key: el.closest('.tasks-quadrant')?.dataset.key, top: el.scrollTop });
    });
    renderTasksUI(container);
    scrollStates.forEach(s => {
      const el = container.querySelector(`.tasks-quadrant[data-key="${s.key}"] > .tasks-quadrant-tasks`);
      if (el) el.scrollTop = s.top;
    });
  }

  function bindTasksEvents(container) {
    const quads = getQuadrants();

    /* ---------- QUICK ADD ---------- */

    const quickAddInput = container.querySelector(`#${P}tasks-quickadd-input`);
    const quickAddSend = container.querySelector(`#${P}tasks-quickadd-send`);

    function autoGrowQuickAdd() {
      if (!quickAddInput) return;
      quickAddInput.style.height = 'auto';
      quickAddInput.style.height = quickAddInput.scrollHeight + 'px';
    }

    function submitQuickAdd() {
      if (!quickAddInput) return;
      const raw = quickAddInput.value.trim();
      if (!raw) return;
      const lines = raw.split(/\n/).map(l => l.trim()).filter(l => l);
      if (lines.length === 0) return;
      const quadKey = getQuickAddQuad();
      const quad = quads.find(q => q.key === quadKey) || quads[0];
      const activeProject = getActiveProjectFilter();
      const tasks = getTasksData();
      lines.forEach(text => tasks.push({
        id: generateTaskId(),
        text,
        done: false,
        urgent: quad.urgent,
        important: quad.important,
        projectId: activeProject || undefined,
        repeat: { type: 'none' }
      }));
      saveTasksData(tasks);
      renderTasksUIPreserveScroll(container);
      const newInput = container.querySelector(`#${P}tasks-quickadd-input`);
      if (newInput) newInput.focus();
    }

    if (quickAddInput) {
      quickAddInput.addEventListener('input', autoGrowQuickAdd);
      quickAddInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitQuickAdd();
        }
      });
    }
    if (quickAddSend) quickAddSend.addEventListener('click', submitQuickAdd);

    container.querySelectorAll('.tasks-quickadd-quad').forEach(btn => {
      btn.addEventListener('click', () => {
        setQuickAddQuad(btn.dataset.quad);
        container.querySelectorAll('.tasks-quickadd-quad').forEach(b => b.classList.toggle('active', b === btn));
        if (quickAddInput) quickAddInput.focus();
      });
    });

    container.querySelectorAll('.tasks-task-quickproject').forEach(btn => {
      btn.addEventListener('click', e => {
        showQuickProjectMenu(e, parseInt(btn.dataset.index, 10), container, btn);
      });
    });

    /* ---------- PROJECT FILTER / MANAGEMENT ---------- */

    container.querySelectorAll('.tasks-project-chip').forEach(chip => {
      let clickTimeout = null;
      let isEditing = false;

      chip.addEventListener('click', e => {
        if (e.detail === 2 || isEditing) return;
        clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
          setActiveProjectFilter(chip.dataset.project || null);
          renderTasksUIPreserveScroll(container);
        }, 300);
      });

      chip.addEventListener('dblclick', e => {
        if (chip.classList.contains('tasks-project-chip-all') || chip.classList.contains('tasks-project-chip-none')) return;
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(clickTimeout);

        const projectId = chip.dataset.project;
        openProjectAddTasksModal(projectId, container);
      });

      chip.addEventListener('contextmenu', e => {
        if (chip.classList.contains('tasks-project-chip-all') || chip.classList.contains('tasks-project-chip-none')) return;
        e.preventDefault();
        showProjectContextMenu(e, chip.dataset.project, container);
      });
    });

    bindProjectChipsDragDrop(container);

    container.querySelectorAll('.tasks-task-project').forEach(badge => {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        setActiveProjectFilter(badge.dataset.project);
        renderTasksUIPreserveScroll(container);
      });
    });

    const projectAddBtn = container.querySelector(`#${P}tasks-project-add`);
    if (projectAddBtn) {
      projectAddBtn.addEventListener('click', () => {
        const filterRow = container.querySelector(`#${P}tasks-project-filter`);
        if (!filterRow || filterRow.querySelector('.tasks-project-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tasks-project-input';
        input.placeholder = 'Назва проєкту';
        projectAddBtn.insertAdjacentElement('beforebegin', input);
        input.focus();

        let committed = false;
        function commit() {
          if (committed) return;
          committed = true;
          const name = input.value.trim();
          input.remove();
          if (name) {
            const project = addProject(name);
            if (project) setActiveProjectFilter(project.id);
            renderTasksUIPreserveScroll(container);
          }
        }
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { committed = true; input.remove(); }
        });
        input.addEventListener('blur', commit);
      });
    }

    const tasksContainer = container.querySelector('.tasks-container');
    const resizer = container.querySelector('.tasks-resizer');

    const savedWidth = parseInt(localStorage.getItem(WIDTH_KEY), 10);
    if (tasksContainer) {
      tasksContainer.style.width = (savedWidth && savedWidth >= 600 ? savedWidth : 900) + 'px';
    }

    if (tasksResizeState) {
      tasksResizeState.container = tasksContainer;
      tasksResizeState.resizer = resizer;
    } else {
      tasksResizeState = { container: tasksContainer, resizer, isResizing: false, startX: 0, startWidth: 0 };
    }

    if (resizer) {
      resizer.addEventListener('mousedown', (e) => {
        if (!tasksResizeState) return;
        tasksResizeState.isResizing = true;
        tasksResizeState.startX = e.clientX;
        tasksResizeState.startWidth = tasksContainer.offsetWidth;
        tasksResizeState.resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
    }

    const resizeKey = P + '__tasksResizeBound';
    if (!window[resizeKey]) {
      window[resizeKey] = true;
      document.addEventListener('mousemove', (e) => {
        if (!tasksResizeState || !tasksResizeState.isResizing) return;
        const deltaX = e.clientX - tasksResizeState.startX;
        const newWidth = Math.max(
          600,
          Math.min(window.innerWidth - 100, tasksResizeState.startWidth + deltaX * 2)
        );
        tasksResizeState.container.style.width = newWidth + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (!tasksResizeState || !tasksResizeState.isResizing) return;
        tasksResizeState.isResizing = false;
        if (tasksResizeState.resizer) tasksResizeState.resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem(WIDTH_KEY, tasksResizeState.container.offsetWidth);
      });
    }

    const DONE_TOGGLE_SVG = `${ICON('chevronRight', 24)}`;

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
      const toggle = quad.querySelector('.tasks-add-toggle');
      const input = quad.querySelector('.tasks-add-input');
      if (open) {
        tasksOpenQuads.add(quad.dataset.key);
        quad.classList.add('adding');
        if (input) { input.value = ''; autoGrowTasksInput(input); input.focus(); }
      } else {
        tasksOpenQuads.delete(quad.dataset.key);
        quad.classList.remove('adding');
        if (input) input.value = '';
      }
      if (toggle) toggle.classList.toggle('active', open);
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
      const activeProject = getActiveProjectFilter();
      const tasks = getTasksData();
      lines.forEach(text => tasks.push({ id: generateTaskId(), text, done: false, urgent: quad.urgent, important: quad.important, projectId: activeProject || undefined, repeat: { type: 'none' } }));
      saveTasksData(tasks);
      tasksOpenQuads.add(quadKey);
      renderTasksUIPreserveScroll(container);
      const newInput = container.querySelector(`.tasks-add-input[data-quad="${quadKey}"]`);
      if (newInput) { autoGrowTasksInput(newInput); newInput.focus(); }
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

    container.querySelectorAll('.tasks-add-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const quad = btn.closest('.tasks-quadrant');
        if (!quad) return;
        setTasksAddOpen(quad, !tasksOpenQuads.has(quad.dataset.key));
      });
    });

    container.querySelectorAll('.tasks-bulk-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openBulkAddModal(btn.dataset.quad);
      });
    });

    container.querySelectorAll('.tasks-quadrant').forEach(quad => {
      quad.addEventListener('dblclick', e => {
        if (e.target.closest('.tasks-task')) return;
        if (e.target.closest('.tasks-quadrant-header')) return;
        if (e.target.closest('.tasks-add-row') || e.target.closest('.tasks-add-toggle')) return;
        setTasksAddOpen(quad, true);
      });
    });

    if (!tasksOutsideCloseBound) {
      tasksOutsideCloseBound = true;
      document.addEventListener('click', e => {
        if (e.target.closest('.tasks-quadrant') || tasksOpenQuads.size === 0) return;
        const c = document.getElementById(OUTPUT_ID);
        [...tasksOpenQuads].forEach(key => {
          const q = c && c.querySelector(`.tasks-quadrant[data-key="${key}"]`);
          if (!q) return;
          const input = q.querySelector('.tasks-add-input');
          if (input && input.value.trim()) return;
          q.classList.remove('adding');
          const t = q.querySelector('.tasks-add-toggle');
          if (t) t.classList.remove('active');
          tasksOpenQuads.delete(key);
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

    container.querySelectorAll('.tasks-task').forEach(item => {
      if (DATASET === 'code') {
        let _codeClickTimer = null;
        item.addEventListener('click', e => {
          if (e.target.closest('.task-checkbox-label')) return;
          if (e.target.closest('.tasks-task-repeat')) return;
          if (e.target.closest('.tasks-task-subtasks')) return;
          if (e.target.closest('.tasks-task-copy')) return;
          if (e.target.closest('.tasks-task-menu')) return;
          if (_codeClickTimer) { clearTimeout(_codeClickTimer); _codeClickTimer = null; return; }
          const index = parseInt(item.dataset.index);
          _codeClickTimer = setTimeout(() => { _codeClickTimer = null; openRepeatModal(container, index); }, 250);
        });
      } else {
        item.addEventListener('click', e => {
          if (e.target.closest('.task-checkbox-label')) return;
          if (e.target.closest('.tasks-task-repeat')) return;
          if (e.target.closest('.tasks-task-subtasks')) return;
          const index = parseInt(item.dataset.index);
          openRepeatModal(container, index);
        });
      }

      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        const index = parseInt(item.dataset.index);
        showTaskContextMenu(e, index, container);
      });
    });

    function updateProjectCountBadge(projectId) {
      const showProjCounts = getTasksSettings().showProjectCounts;
      if (!showProjCounts) return;

      const counts = getIncompleteCountPerProject();
      const chipSelector = projectId === NO_PROJECT_ID
        ? `.tasks-project-chip-none`
        : `.tasks-project-chip[data-project="${projectId}"]`;
      const chip = container.querySelector(chipSelector);

      if (!chip) return;

      const count = counts.get(projectId) || 0;
      let countSpan = chip.querySelector('.tasks-project-count');

      if (count > 0) {
        if (!countSpan) {
          countSpan = document.createElement('span');
          countSpan.className = 'tasks-project-count';
          chip.appendChild(countSpan);
        }
        countSpan.textContent = count;
      } else if (countSpan) {
        countSpan.remove();
      }
    }

    container.querySelectorAll('.tasks-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const taskEl = cb.closest('.tasks-task');
        const index = parseInt(taskEl.dataset.index);
        const tasks = getTasksData();
        if (tasks[index]) {
          const projectId = tasks[index].projectId || NO_PROJECT_ID;
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
          updateProjectCountBadge(projectId);
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

    container.querySelectorAll('.tasks-task-repeat').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const index = parseInt(btn.closest('.tasks-task').dataset.index);
        openRepeatModal(container, index);
      });
    });

    container.querySelectorAll('.tasks-task-subtasks').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const index = parseInt(btn.closest('.tasks-task').dataset.index);
        openRepeatModal(container, index);
      });
    });

    container.querySelectorAll('.tasks-task-menu').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const index = parseInt(btn.closest('.tasks-task').dataset.index);
        showTaskContextMenu(e, index, container);
      });
    });

    if (DATASET === 'code') {
      container.querySelectorAll('.tasks-task').forEach(item => {
        item.addEventListener('dblclick', e => {
          if (e.target.closest('.task-checkbox-label')) return;
          if (e.target.closest('.tasks-task-repeat')) return;
          if (e.target.closest('.tasks-task-subtasks')) return;
          if (e.target.closest('.tasks-task-menu')) return;
          if (e.target.closest('.tasks-task-copy')) return;
          const textEl = item.querySelector('.tasks-task-text');
          if (textEl) copyToClipboard(textEl.textContent.trim(), e);
        });
      });

      container.querySelectorAll('.tasks-task-copy').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const taskEl = btn.closest('.tasks-task');
          const textEl = taskEl?.querySelector('.tasks-task-text');
          if (textEl) copyToClipboard(textEl.textContent.trim(), e);
        });
      });
    }

    container.querySelectorAll('.tasks-quadrant-header').forEach(header => {
      header.addEventListener('click', e => {
        if (e.target.closest('.tasks-add-toggle') || e.target.closest('.tasks-add-row')) return;
        const quad = header.closest('.tasks-quadrant');
        setTasksAddOpen(quad, !tasksOpenQuads.has(quad.dataset.key));
      });

      header.addEventListener('contextmenu', e => {
        e.preventDefault();
        const quad = header.closest('.tasks-quadrant');
        if (tasksOpenQuads.has(quad.dataset.key)) return;
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

    /* ---------- STATS MODAL ---------- */
    const statsModal = container.querySelector(`#${P}tasks-stats-modal`);
    const statsModalOverlay = statsModal?.querySelector('.tasks-stats-modal-overlay');
    const statsModalClose = container.querySelector(`#${P}tasks-stats-modal-close`);

    function closeStatsModal() {
      if (statsModal) statsModal.classList.remove('open');
    }

    if (statsModalOverlay) statsModalOverlay.addEventListener('click', closeStatsModal);
    if (statsModalClose) statsModalClose.addEventListener('click', closeStatsModal);
  }

  /* ========== CONTEXT MENU ========== */

  let activeTaskContextMenu = null;

  function showTaskContextMenu(event, index, container) {
    event.preventDefault();
    event.stopPropagation();

    hideTaskContextMenu();

    const menu = document.createElement('div');
    menu.className = 'tasks-context-menu';

    const editItem = document.createElement('div');
    editItem.className = 'ctx-item';
    editItem.innerHTML = ICON('pen', 14) + '<span>Редагувати</span>';
    editItem.addEventListener('click', () => { hideTaskContextMenu(); openRepeatModal(container, index); });

    const dupItem = document.createElement('div');
    dupItem.className = 'ctx-item';
    dupItem.innerHTML = ICON('copy', 14) + '<span>Дублювати</span>';
    dupItem.addEventListener('click', () => {
      hideTaskContextMenu();
      const tasks = getTasksData();
      const task = tasks[index];
      if (!task) return;
      const clone = JSON.parse(JSON.stringify(task));
      clone.id = generateTaskId();
      clone.text = task.text + ' (копія)';
      tasks.splice(index + 1, 0, clone);
      saveTasksData(tasks);
      if (container) renderTasksUIPreserveScroll(container);
    });

    const projects = getProjects();
    const currentTask = getTasksData()[index];
    const projectItem = document.createElement('div');
    projectItem.className = 'ctx-item ctx-item-has-sub';
    projectItem.innerHTML = ICON('folderPlus', 14) + '<span>Проєкт</span>' + ICON('chevronRight', 12, { cls: 'ctx-sub-arrow' });

    const submenu = document.createElement('div');
    submenu.className = 'ctx-submenu ctx-submenu-projects';

    const noneOpt = document.createElement('div');
    noneOpt.className = 'ctx-item' + (!currentTask || !currentTask.projectId ? ' ctx-item--checked' : '');
    noneOpt.innerHTML = '<span>Немає</span>';
    noneOpt.addEventListener('click', e => { e.stopPropagation(); hideTaskContextMenu(); assignTaskProject(index, container, null); });
    submenu.appendChild(noneOpt);

    function makeProjectOpt(p) {
      const opt = document.createElement('div');
      opt.className = 'ctx-item' + (currentTask && currentTask.projectId === p.id ? ' ctx-item--checked' : '');
      opt.innerHTML = `<span class="tasks-project-dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span>`;
      opt.addEventListener('click', e => { e.stopPropagation(); hideTaskContextMenu(); assignTaskProject(index, container, p.id); });
      return opt;
    }

    projects.forEach(p => submenu.appendChild(makeProjectOpt(p)));

    projectItem.appendChild(submenu);
    projectItem.addEventListener('mouseenter', () => positionCtxSubmenu(projectItem, submenu));

    const sep = document.createElement('div');
    sep.className = 'ctx-separator';

    const delItem = document.createElement('div');
    delItem.className = 'ctx-item ctx-item--danger';
    delItem.innerHTML = ICON('trash', 14) + '<span>Видалити</span>';
    delItem.addEventListener('click', () => { hideTaskContextMenu(); openTaskDeleteModal(index, container); });

    menu.appendChild(editItem);
    menu.appendChild(dupItem);
    menu.appendChild(projectItem);
    menu.appendChild(sep);
    menu.appendChild(delItem);

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

  function positionCtxSubmenu(parentItem, submenu) {
    submenu.style.top = '-5px';
    submenu.style.bottom = 'auto';
    submenu.style.left = '100%';
    submenu.style.right = 'auto';
    submenu.style.visibility = 'hidden';
    submenu.style.display = 'block';

    const itemRect = parentItem.getBoundingClientRect();
    const subRect = submenu.getBoundingClientRect();

    if (itemRect.right + subRect.width > window.innerWidth - 8) {
      submenu.style.left = 'auto';
      submenu.style.right = '100%';
    }
    if (itemRect.top + subRect.height > window.innerHeight - 8) {
      submenu.style.top = 'auto';
      submenu.style.bottom = '-5px';
    }

    submenu.style.display = '';
    submenu.style.visibility = '';
  }

  function showQuickProjectMenu(event, index, container, anchorEl) {
    event.stopPropagation();
    hideTaskContextMenu();

    const projects = getProjects();
    if (!projects.length) return;

    const menu = document.createElement('div');
    menu.className = 'tasks-context-menu ctx-submenu-projects';

    function makeOpt(p) {
      const opt = document.createElement('div');
      opt.className = 'ctx-item';
      opt.innerHTML = `<span class="tasks-project-dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span>`;
      opt.addEventListener('click', e => {
        e.stopPropagation();
        hideTaskContextMenu();
        assignTaskProject(index, container, p.id);
      });
      return opt;
    }

    projects.forEach(p => menu.appendChild(makeOpt(p)));

    document.body.appendChild(menu);
    activeTaskContextMenu = menu;

    const rect = anchorEl.getBoundingClientRect();
    menu.style.visibility = 'hidden';
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    const menuRect = menu.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 4;
    if (x + menuRect.width > window.innerWidth - 8) x = window.innerWidth - menuRect.width - 8;
    if (y + menuRect.height > window.innerHeight - 8) y = rect.top - menuRect.height - 4;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.visibility = '';

    requestAnimationFrame(() => menu.classList.add('visible'));

    setTimeout(() => {
      document.addEventListener('click', hideTaskContextMenu, { once: true });
      document.addEventListener('contextmenu', hideTaskContextMenu, { once: true });
    }, 0);
  }

  function bindProjectChipsDragDrop(container) {
    const filterEl = container.querySelector(`#${P}tasks-project-filter`);
    if (!filterEl) return;

    function isReorderable(chip) {
      return chip.classList.contains('tasks-project-chip')
        && !chip.classList.contains('tasks-project-chip-all')
        && !chip.classList.contains('tasks-project-chip-none');
    }

    let draggedChip = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    const DRAG_THRESHOLD = 3;

    function onMouseMove(e) {
      if (!dragging) {
        if (Math.max(Math.abs(e.clientX - startX), Math.abs(e.clientY - startY)) < DRAG_THRESHOLD) return;
        dragging = true;
        draggedChip.classList.add('dragging');
        draggedChip.style.pointerEvents = 'none';
      }
      e.preventDefault();

      const others = [...filterEl.querySelectorAll('.tasks-project-chip')].filter(c => isReorderable(c) && c !== draggedChip);
      let target = null;
      for (const c of others) {
        const r = c.getBoundingClientRect();
        if (e.clientX < r.left + r.width / 2 && e.clientY < r.bottom) { target = c; break; }
      }
      if (target) {
        filterEl.insertBefore(draggedChip, target);
      } else {
        const addBtn = filterEl.querySelector('.tasks-project-chip-add');
        filterEl.insertBefore(draggedChip, addBtn || null);
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!dragging || !draggedChip) {
        draggedChip = null;
        return;
      }

      draggedChip.style.pointerEvents = '';
      draggedChip.classList.remove('dragging');

      const orderedIds = [...filterEl.querySelectorAll('.tasks-project-chip')]
        .filter(isReorderable)
        .map(c => c.dataset.project);

      const projects = getProjects();
      const byId = new Map(projects.map(p => [p.id, p]));
      const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
      projects.forEach(p => { if (!orderedIds.includes(p.id)) reordered.push(p); });
      saveProjects(reordered);

      draggedChip = null;
      renderTasksUIPreserveScroll(container);
    }

    filterEl.querySelectorAll('.tasks-project-chip').forEach(chip => {
      if (!isReorderable(chip)) return;
      chip.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        draggedChip = chip;
        startX = e.clientX;
        startY = e.clientY;
        dragging = false;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  function assignTaskProject(index, container, projectId) {
    const tasks = getTasksData();
    if (!tasks[index]) return;
    tasks[index].projectId = projectId || undefined;
    saveTasksData(tasks);
    if (projectId) pushRecentProjectId(projectId);
    if (container) renderTasksUIPreserveScroll(container);
  }

  /* ---------- PROJECT RENAME (inline) ---------- */

  function startProjectChipRename(projectId, container) {
    const chip = container.querySelector(`.tasks-project-chip[data-project="${projectId}"]`);
    const project = getProjects().find(p => p.id === projectId);
    if (!chip || !project) return;

    const oldName = project.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = oldName;
    input.style.width = Math.max(60, chip.offsetWidth - 16) + 'px';

    let committed = false;
    const commit = (save) => {
      if (committed) return;
      committed = true;
      if (save) {
        const trimmed = input.value.trim();
        if (trimmed && trimmed !== oldName) renameProject(projectId, trimmed);
      }
      renderTasksUIPreserveScroll(container);
    };

    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); committed = true; renderTasksUIPreserveScroll(container); }
    });
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('click', e => e.stopPropagation());

    chip.textContent = '';
    chip.appendChild(input);
    input.focus();
    input.select();
  }

  /* ---------- PROJECT CONTEXT MENU ---------- */

  function showProjectContextMenu(event, projectId, container) {
    event.preventDefault();
    event.stopPropagation();

    hideTaskContextMenu();

    const menu = document.createElement('div');
    menu.className = 'tasks-context-menu';

    const addTaskItem = document.createElement('div');
    addTaskItem.className = 'ctx-item';
    addTaskItem.innerHTML = ICON('plus', 14) + '<span>Додати задачу</span>';
    addTaskItem.addEventListener('click', () => {
      hideTaskContextMenu();
      openProjectAddTasksModal(projectId, container);
    });

    const renameItem = document.createElement('div');
    renameItem.className = 'ctx-item';
    renameItem.innerHTML = ICON('pen', 14) + '<span>Перейменувати</span>';
    renameItem.addEventListener('click', () => {
      hideTaskContextMenu();
      startProjectChipRename(projectId, container);
    });

    const sep = document.createElement('div');
    sep.className = 'ctx-separator';

    const delItem = document.createElement('div');
    delItem.className = 'ctx-item ctx-item--danger';
    delItem.innerHTML = ICON('trash', 14) + '<span>Видалити</span>';
    delItem.addEventListener('click', () => {
      hideTaskContextMenu();
      deleteProject(projectId);
      renderTasksUIPreserveScroll(container);
    });

    menu.appendChild(addTaskItem);
    menu.appendChild(renameItem);
    menu.appendChild(sep);
    menu.appendChild(delItem);

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

  /* ========== PROJECT ADD TASKS MODAL ========== */

  function openProjectAddTasksModal(projectId, container) {
    const project = getProjects().find(p => p.id === projectId);
    if (!project) return;

    const quads = getQuadrants();
    const defaultQuad = getQuickAddQuad();
    const selectedQuadrantRef = { key: defaultQuad };

    const quadsHtml = quads.map(q => `
      <button type="button" class="tasks-project-add-quad${q.key === defaultQuad ? ' active' : ''}" data-quad="${q.key}" style="--quad-color: ${q.color}" title="${escapeAttr(q.label)}">
        <span class="tasks-project-add-quad-label">${q.label}</span>
      </button>
    `).join('');

    const overlay = document.createElement('div');
    overlay.className = 'notes-modal tasks-project-add-modal';

    overlay.innerHTML = `
      <div class="notes-modal-content">
        <div class="notes-modal-header">
          <span class="tasks-modal-title">Додати задачу в проєкт "${escapeHtml(project.name)}"</span>
          <button class="notes-modal-close" data-action="close">&times;</button>
        </div>
        <div class="notes-modal-body">
          <label class="tasks-settings-text" style="margin-bottom: 8px;">Квадрант:</label>
          <div class="tasks-project-add-quads" style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            ${quadsHtml}
          </div>
          <textarea class="tasks-project-add-input" placeholder="Введіть задачу (одна за рядок)..." autocomplete="off" rows="6"></textarea>
          <div class="tasks-project-add-hint">Введіть одну або кілька задач, розділивши їх переводами рядків</div>
        </div>
        <div class="notes-modal-footer">
          <button type="button" class="gist-btn" data-action="cancel">Скасувати</button>
          <button type="button" class="gist-btn gist-btn-primary" data-action="confirm">Додати</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('.tasks-project-add-input');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const closeBtn = overlay.querySelector('[data-action="close"]');

    function autoGrowTextarea() {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
    }

    textarea.addEventListener('input', autoGrowTextarea);
    autoGrowTextarea();
    textarea.focus();

    function close() {
      overlay.remove();
    }

    overlay.querySelectorAll('.tasks-project-add-quad').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const quadKey = btn.dataset.quad;
        selectedQuadrantRef.key = quadKey;
        overlay.querySelectorAll('.tasks-project-add-quad').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    function confirmAdd() {
      const text = textarea.value.trim();
      if (!text) {
        close();
        return;
      }

      const lines = text.split(/\n/).map(l => l.trim()).filter(l => l);
      if (lines.length === 0) {
        close();
        return;
      }

      const tasks = getTasksData();
      const selectedQuad = quads.find(q => q.key === selectedQuadrantRef.key) || quads[0];
      lines.forEach(taskText => {
        tasks.push({
          id: generateTaskId(),
          text: taskText,
          done: false,
          urgent: selectedQuad.urgent,
          important: selectedQuad.important,
          projectId: projectId,
          repeat: { type: 'none' }
        });
      });

      saveTasksData(tasks);
      close();
      if (container) renderTasksUIPreserveScroll(container);
    }

    confirmBtn.addEventListener('click', confirmAdd);
    cancelBtn.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  /* ========== DELETE MODAL ========== */

  let taskToDeleteIndex = null;
  let taskToDeleteContainer = null;

  function openTaskDeleteModal(index, container) {
    taskToDeleteIndex = index;
    taskToDeleteContainer = container;
    const tasks = getTasksData();
    const name = (tasks[index] && tasks[index].text) || '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay tasks-delete-overlay';
    overlay.innerHTML = `
      <div class="modal delete-confirm">
        <div class="delete-confirm-icon">
          ${ICON('trash2', 26)}
        </div>
        <h3 class="delete-confirm-title">Видалити завдання «<span class="delete-confirm-name"></span>»?</h3>
        <p class="delete-confirm-text">Цю дію неможливо скасувати.</p>
        <div class="modal-buttons">
          <button class="gist-btn" data-action="cancel">Скасувати</button>
          <button class="gist-btn gist-btn-danger" data-action="confirm">Видалити</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.delete-confirm-name').textContent = name;
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = () => { overlay.remove(); taskToDeleteIndex = null; taskToDeleteContainer = null; };

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', confirmTaskDelete);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  function confirmTaskDelete() {
    const index = taskToDeleteIndex;
    const container = taskToDeleteContainer;
    if (index === null) return;
    const tasks = getTasksData();
    if (!tasks[index]) {
      const overlay = document.querySelector('.tasks-delete-overlay');
      if (overlay) overlay.remove();
      taskToDeleteIndex = null;
      taskToDeleteContainer = null;
      return;
    }
    const deletedTask = tasks[index];
    if (deletedTask && deletedTask.id) {
      gistAddDeletedId(DATASET, deletedTask.id);
    }
    tasks.splice(index, 1);
    saveTasksData(tasks);
    const overlay = document.querySelector('.tasks-delete-overlay');
    if (overlay) overlay.remove();
    taskToDeleteIndex = null;
    taskToDeleteContainer = null;
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
      return `<button type="button" class="tasks-color-swatch${active}" data-color="${c}" style="--swatch:${c}" aria-label="${c}">${ICON('check', 14, { stroke: '#fff', strokeWidth: 3.4, cls: 'tasks-swatch-check' })}</button>`;
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
    const showProjects = getTasksSettings().showProjects;

    const editorProjects = getProjects();
    const editorProjectChipsHtml = showProjects
      ? `
        <button type="button" class="tasks-project-chip tasks-project-chip-none${!task.projectId ? ' active' : ''}" data-project="">Немає</button>
        ${editorProjects.map(p => `<button type="button" class="tasks-project-chip${p.id === task.projectId ? ' active' : ''}" data-project="${p.id}" style="--project-color:${p.color}">${escapeHtml(p.name)}</button>`).join('')}
      `
      : '';

    overlay.innerHTML = `
      <div class="notes-modal-content">
        <div class="notes-modal-header">
          <span class="tasks-modal-title">Редагування <div class="tasks-gear-wrap"><button type="button" class="tasks-icon-btn" id="${P}tasks-gear-btn">${GEAR_SVG}</button><div class="tasks-gear-dropdown" id="${P}tasks-gear-dropdown"><label class="tasks-gear-option"><input type="checkbox" id="${P}tasks-ed-desc"${showDesc ? ' checked' : ''}> Опис</label><label class="tasks-gear-option"><input type="checkbox" id="${P}tasks-ed-sub"${showSub ? ' checked' : ''}> Підзавдання</label></div></div><div class="tasks-gear-wrap"><button type="button" class="tasks-icon-btn" id="${P}tasks-color-btn"${task.color ? ` style="--swatch:${task.color};color:${task.color}"` : ''}>${PALETTE_SVG}</button><div class="tasks-color-dropdown" id="${P}tasks-color-dropdown"><div class="tasks-gear-colors" id="${P}tasks-color-row"><button type="button" class="tasks-color-swatch${!task.color ? ' active' : ''}" data-color="" aria-label="Без кольору">${ICON('banOutline', 12, { strokeWidth: 2.4 })}</button>${colorSwatches}</div></div></div></span>
          <button class="notes-modal-close" data-action="close">&times;</button>
        </div>
        <div class="notes-modal-body">
          <label class="tasks-repeat-field-label" for="${P}tasks-repeat-task-text">Назва завдання</label>
          <textarea class="tasks-repeat-text-input" id="${P}tasks-repeat-task-text" placeholder="Наприклад: Почистити ноутбук" autocomplete="off" rows="1">${escapeHtml(task.text)}</textarea>

          <div class="tasks-editor-section${showDesc ? '' : ' hidden'}" data-section="description">
            <label class="tasks-repeat-field-label" for="${P}tasks-repeat-desc">Опис</label>
            <textarea class="tasks-repeat-desc-input" id="${P}tasks-repeat-desc" placeholder="Введіть опис...">${escapeHtml(task.description || '')}</textarea>
          </div>
          <div class="tasks-editor-section${showSub ? '' : ' hidden'}" data-section="subtasks">
            <div class="tasks-subtasks-section">
              <label class="tasks-repeat-field-label">Підзавдання ${hasSubtasks ? `<span class="tasks-collapsible-hint">${initialSubtasks.filter(s => s.done).length}/${initialSubtasks.length}</span>` : ''}</label>
              <div class="tasks-subtasks" id="${P}tasks-subtasks">${subtaskItemsHtml(initialSubtasks)}</div>
              <div class="tasks-subtask-add">
                <input type="text" class="tasks-subtask-input" id="${P}tasks-subtask-input" placeholder="Додати підзавдання..." autocomplete="off">
                <button type="button" class="tasks-subtask-add-btn" id="${P}tasks-subtask-add-btn" title="Додати">+</button>
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

          <div class="tasks-repeat-config" id="${P}tasks-repeat-daily" style="${initType === 'daily' ? '' : 'display:none'}">
            <p class="tasks-repeat-hint">Завдання повторюватиметься щодня</p>
          </div>

          <div class="tasks-repeat-config" id="${P}tasks-repeat-weekly" style="${initType === 'weekly' ? '' : 'display:none'}">
            <label class="tasks-repeat-field-label">Дні тижня</label>
            <div class="tasks-weekdays">${weekdayButtons}</div>
            <label class="tasks-repeat-field-label tasks-repeat-field-label-spaced">Частота</label>
            <div class="tasks-repeat-options">
              <button type="button" class="tasks-repeat-option${initInterval === 1 ? ' active' : ''}" data-interval="1">Щотижня</button>
              <button type="button" class="tasks-repeat-option${initInterval === 2 ? ' active' : ''}" data-interval="2">Через тиждень</button>
            </div>
          </div>

          <div class="tasks-repeat-config" id="${P}tasks-repeat-monthly" style="${initType === 'monthly' ? '' : 'display:none'}">
            <label class="tasks-month-label">Кожного
              <span class="tasks-month-wrap">
                <input type="number" class="tasks-month-input" id="${P}tasks-month-day" min="1" max="31" value="${current.type === 'monthly' && current.day ? current.day : new Date().getDate()}">
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

          ${showProjects ? `
          <label class="tasks-repeat-field-label tasks-repeat-field-label-spaced">Проєкт</label>
          <div class="tasks-editor-projects" id="${P}tasks-editor-projects">${editorProjectChipsHtml}</div>
          ` : ''}
        </div>
        <div class="notes-modal-footer">
          <button class="gist-btn tasks-repeat-delete" data-action="delete">${TRASH_SVG}</button>
          <button class="gist-btn" data-action="cancel">Скасувати</button>
          <button class="gist-btn gist-btn-primary" data-action="save">Зберегти</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const taskTextInput = overlay.querySelector(`#${P}tasks-repeat-task-text`);
    if (taskTextInput) {
      const autoResize = () => {
        taskTextInput.style.height = 'auto';
        taskTextInput.style.height = taskTextInput.scrollHeight + 'px';
      };
      autoResize();
      taskTextInput.addEventListener('input', autoResize);
      taskTextInput.focus();
      const len = taskTextInput.value.length;
      taskTextInput.setSelectionRange(len, len);
    }

    const gearBtn = overlay.querySelector(`#${P}tasks-gear-btn`);
    const gearDropdown = overlay.querySelector(`#${P}tasks-gear-dropdown`);
    const gearWrap = gearBtn.closest('.tasks-gear-wrap');
    const colorBtn = overlay.querySelector(`#${P}tasks-color-btn`);
    const colorDropdown = overlay.querySelector(`#${P}tasks-color-dropdown`);
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

    gearBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (gearDropdown.classList.contains('open')) closeDropdowns();
      else openGear();
    });
    colorBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (colorDropdown.classList.contains('open')) closeDropdowns();
      else openColor();
    });

    function toggleSection(name, visible) {
      const sec = overlay.querySelector(`.tasks-editor-section[data-section="${name}"]`);
      if (sec) sec.classList.toggle('hidden', !visible);
    }

    overlay.querySelector(`#${P}tasks-ed-desc`).addEventListener('change', e => {
      tasks[index].showDescription = e.target.checked;
      saveTasksData(tasks);
      toggleSection('description', e.target.checked);
    });
    overlay.querySelector(`#${P}tasks-ed-sub`).addEventListener('change', e => {
      tasks[index].showSubtasks = e.target.checked;
      saveTasksData(tasks);
      toggleSection('subtasks', e.target.checked);
    });

    let selectedType = initType;
    let selectedInterval = initInterval;
    let selectedColor = task.color || '';
    let selectedProjectId = task.projectId || '';
    const selectedDays = new Set(current.type === 'weekly' ? (current.days || []) : []);

    overlay.querySelectorAll('.tasks-editor-projects .tasks-project-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedProjectId = chip.dataset.project || '';
        overlay.querySelectorAll('.tasks-editor-projects .tasks-project-chip').forEach(c => c.classList.toggle('active', c === chip));
      });
    });
    const subtasks = initialSubtasks.slice();

    const typeButtons = overlay.querySelectorAll('.tasks-repeat-option[data-type]');
    const intervalButtons = overlay.querySelectorAll('.tasks-repeat-option[data-interval]');
    const dailyConfig = overlay.querySelector(`#${P}tasks-repeat-daily`);
    const weeklyConfig = overlay.querySelector(`#${P}tasks-repeat-weekly`);
    const monthlyConfig = overlay.querySelector(`#${P}tasks-repeat-monthly`);

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
      const list = overlay.querySelector(`#${P}tasks-subtasks`);
      if (!list) return;
      list.innerHTML = subtaskItemsHtml(subtasks);
      updateSubtaskHint();
    }

    function addSubtask() {
      const input = overlay.querySelector(`#${P}tasks-subtask-input`);
      const val = input.value.trim();
      if (!val) return;
      subtasks.push({ text: val, done: false });
      input.value = '';
      renderSubtaskList();
      input.focus();
    }

    overlay.querySelector(`#${P}tasks-subtask-add-btn`).addEventListener('click', addSubtask);
    overlay.querySelector(`#${P}tasks-subtask-input`).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
    });

    const subtaskList = overlay.querySelector(`#${P}tasks-subtasks`);
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

    const monthInput = overlay.querySelector(`#${P}tasks-month-day`);
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

    overlay.querySelector('[data-action="close"]').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const el = e.target;
        if (el.id === `${P}tasks-subtask-input` || el.closest('[data-act="edit"]')) return;
        e.preventDefault();
        overlay.querySelector('[data-action="save"]').click();
      }
    });

    overlay.querySelector('[data-action="delete"]').addEventListener('click', () => {
      close();
      openTaskDeleteModal(index, container);
    });

    overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
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
        const day = parseInt(overlay.querySelector(`#${P}tasks-month-day`).value) || new Date().getDate();
        repeat = { type: 'monthly', day: Math.min(31, Math.max(1, day)) };
      } else {
        repeat = { type: 'none' };
      }
      const newText = overlay.querySelector(`#${P}tasks-repeat-task-text`).value.trim();
      if (newText) tasks[index].text = newText;
      tasks[index].repeat = repeat;
      tasks[index].color = selectedColor || undefined;
      tasks[index].projectId = selectedProjectId || undefined;
      tasks[index].description = overlay.querySelector(`#${P}tasks-repeat-desc`).value.trim() || undefined;
      tasks[index].subtasks = subtasks.filter(s => s.text.trim()).map(s => ({ text: s.text.trim(), done: !!s.done }));
      saveTasksData(tasks);
      close();
      renderTasksUIPreserveScroll(container);
    });
  }

  /* ========== PUBLIC API ========== */

  return {
    init,
    renderActions,
    checkDailyReset: checkTasksDailyReset,
    renderUI: renderTasksUI,
    renderUIPreserveScroll: renderTasksUIPreserveScroll,
    getTasksData,
    saveTasksData,
    getQuadrants,
    QUADRANTS_DEFAULTS,
    DATASET,
    OUTPUT_ID,
  };
}

/* ========== INSTANCES ========== */

var tasksModule = createTasksModule({
  prefix: '',
  outputId: 'output-tasks',
  contentId: 'content-tasks',
  actionsId: 'tasksActions',
  importFileId: 'tasksImportFile',
  widthKey: 'tasks_container_width',
  dataset: 'tasks',
});

var codeTasksModule = createTasksModule({
  prefix: 'code_',
  outputId: 'output-code',
  contentId: 'content-code',
  actionsId: 'codeTasksActions',
  importFileId: 'codeTasksImportFile',
  widthKey: 'code_tasks_container_width',
  dataset: 'code',
});

/* ========== BACKWARD COMPATIBILITY ========== */

function initTasks() { tasksModule.init(); }
function renderTasksActions() { tasksModule.renderActions(); }
function checkTasksDailyReset() { tasksModule.checkDailyReset(); }
function getTasksData() { return tasksModule.getTasksData(); }
function saveTasksData(data) { tasksModule.saveTasksData(data); }
function getQuadrants() { return tasksModule.getQuadrants(); }

function initCodeTasks() { codeTasksModule.init(); }
function renderCodeTasksActions() { codeTasksModule.renderActions(); }
