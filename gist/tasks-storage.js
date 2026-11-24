/* ========== GIST STORAGE FOR TASKS — Factory Pattern ========== */

function createTasksGistStorage(config) {
  const P = config.prefix || '';
  const DATASET = config.dataset || 'tasks';
  const GIST_FILE = config.gistFile || 'tasks-data.json';
  const OUTPUT_ID = config.outputId || 'output-tasks';
  const STORAGE_KEY = P + 'tasks_data';
  const LABELS_KEY = P + 'tasks_labels';
  const DONE_COLLAPSED_KEY = P + 'tasks_done_collapsed';
  const SETTINGS_KEY = P + 'tasks_settings';
  const PROJECTS_KEY = P + 'tasks_projects';

  const storage = {
    config: loadConfig(),
    isSyncing: false,
    syncTimer: null,
    debounceTimer: null,
    pendingChanges: false,
    lastSyncTime: null,
    lastSyncData: null,
    _suppressAutoSync: false,
  };

  function loadConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem('gist_config'));
      return cfg || { token: '', gistId: '', enabled: false };
    } catch {
      return { token: '', gistId: '', enabled: false };
    }
  }

  storage.refreshConfig = function() {
    const wasEnabled = storage.isEnabled();
    storage.config = loadConfig();
    const isEnabledNow = storage.isEnabled();
    if (!wasEnabled && isEnabledNow) {
      storage.startAutoSync();
    } else if (wasEnabled && !isEnabledNow) {
      storage.stopAutoSync();
    } else if (isEnabledNow) {
      storage.lastSyncData = null;
    }
  };

  storage.isEnabled = function() {
    return storage.config.enabled && storage.config.token && storage.config.gistId;
  };

  storage.collectTasksData = function() {
    const readJson = (key, fallback) => {
      try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
    };
    return {
      version: '1.0',
      tasks: readJson(STORAGE_KEY, []),
      labels: readJson(LABELS_KEY, {}),
      doneCollapsed: readJson(DONE_COLLAPSED_KEY, {}),
      settings: readJson(SETTINGS_KEY, {}),
      projects: readJson(PROJECTS_KEY, []),
      deletedIds: gistGetDeletedIds(DATASET),
      lastModified: gistModifiedToISO(gistGetLocalModified(DATASET)),
      lastSync: new Date().toISOString()
    };
  };

  storage.updateTasksInGist = async function() {
    if (!storage.isEnabled() || storage.isSyncing) {
      return false;
    }

    storage.isSyncing = true;

    try {
      const tasksData = storage.collectTasksData();

      const currentDataHash = JSON.stringify(tasksData);
      if (storage.lastSyncData === currentDataHash) {
        storage.pendingChanges = false;
        storage.isSyncing = false;
        return false;
      }

      const localModified = gistGetLocalModified(DATASET);
      const remote = await storage.fetchRemoteModified(GIST_FILE);
      if (remote.exists && gistRemoteIsNewer(remote.modified, localModified)) {
        // Remote має новіші дані за наш dataset-рівневий штамп, але це не
        // означає, що там немає й невідісланих локальних змін (напр. рух
        // завдання між проєктами) — dataset-рівень надто грубий. Замість
        // того щоб просто скинути pendingChanges (втративши зміну),
        // підтягуємо і зливаємо remote за id/updatedAt для кожного
        // завдання, а потім пушимо результат.
        console.log(`Gist ${DATASET} appear newer at dataset level — merging before push instead of skipping`);
        storage.isSyncing = false;
        await storage.pullFromGist();
        return storage.updateTasksInGist();
      }

      const localTasksEmpty = !tasksData.tasks || tasksData.tasks.length === 0;
      if (localTasksEmpty) {
        const remoteState = await gistRemoteHasData(GIST_FILE, d => d && Array.isArray(d.tasks) && d.tasks.length > 0);
        if (remoteState.hasData) {
          console.warn(`Local ${DATASET} empty but Gist has data — skipping push to avoid overwrite`);
          storage.isSyncing = false;
          storage.pendingChanges = false;
          return false;
        }
      }

      if (localTasksEmpty && !remote.exists) {
        storage.pendingChanges = false;
        storage.isSyncing = false;
        return false;
      }

      const gistResponse = await fetch(`https://api.github.com/gists/${storage.config.gistId}`, {
        headers: {
          'Authorization': `token ${storage.config.token}`
        }
      });

      if (!gistResponse.ok) {
        throw new Error('Не вдалося завантажити gist');
      }

      const gist = await gistResponse.json();

      const files = { ...gist.files };
      files[GIST_FILE] = {
        content: JSON.stringify(tasksData, null, 2)
      };

      const updateResponse = await fetch(`https://api.github.com/gists/${storage.config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${storage.config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files })
      });

      if (!updateResponse.ok) {
        throw new Error('Не вдалося оновити gist');
      }

      storage.lastSyncTime = new Date();
      storage.lastSyncData = currentDataHash;
      storage.pendingChanges = false;
      return true;
    } catch (error) {
      console.error(`${DATASET} Gist sync error:`, error);
      throw error;
    } finally {
      storage.isSyncing = false;
    }
  };

  storage.loadTasksFromGist = async function() {
    if (!storage.isEnabled()) {
      throw new Error('Gist синхронізація не налаштована');
    }

    const response = await fetch(`https://api.github.com/gists/${storage.config.gistId}`, {
      headers: {
        'Authorization': `token ${storage.config.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Не вдалося завантажити gist');
    }

    const gist = await response.json();
    const file = gist.files[GIST_FILE];

    if (!file) {
      await storage.updateTasksInGist();
      return null;
    }

    let content = file.content;

    if (file.truncated) {
      const rawResponse = await fetch(file.raw_url);
      if (!rawResponse.ok) throw new Error('Не вдалося завантажити повний вміст gist');
      content = await rawResponse.text();
    }

    const data = JSON.parse(content);

    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('Невірний формат даних завдань');
    }

    return data;
  };

  storage.fetchRemoteModified = async function(fileName) {
    if (!storage.config.gistId) return { exists: false, modified: 0 };
    try {
      const response = await fetch(`https://api.github.com/gists/${storage.config.gistId}`, {
        headers: { 'Authorization': `token ${storage.config.token}` }
      });
      if (!response.ok) return { exists: false, modified: 0 };
      const gist = await response.json();
      const file = gist.files && gist.files[fileName];
      if (!file || !file.content) return { exists: false, modified: 0 };
      const data = JSON.parse(file.content);
      return { exists: true, modified: data.lastModified || data.lastSync || 0 };
    } catch {
      return { exists: false, modified: 0 };
    }
  };

  storage.applyTasksData = function(data) {
    if (!data) return;
    if (Array.isArray(data.tasks)) {
      const tasks = dedupeTasks(data.tasks).filter(t => !t.dataset || t.dataset === DATASET);
      ensureTaskIds(tasks);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
    if (data.labels && typeof data.labels === 'object') {
      localStorage.setItem(LABELS_KEY, JSON.stringify(data.labels));
    }
    if (data.doneCollapsed && typeof data.doneCollapsed === 'object') {
      localStorage.setItem(DONE_COLLAPSED_KEY, JSON.stringify(data.doneCollapsed));
    }
    if (data.settings && typeof data.settings === 'object') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    }
    if (Array.isArray(data.projects)) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(data.projects));
    }
  };

  storage.pullFromGist = async function() {
    if (!storage.isEnabled() || storage.isSyncing) return;
    storage.isSyncing = true;
    storage._suppressAutoSync = true;
    try {
      const data = await storage.loadTasksFromGist();
      if (!data || !Array.isArray(data.tasks)) return;

      const remoteDeletedIds = data.deletedIds || [];
      const localDeletedIds = gistGetDeletedIds(DATASET);
      const mergedDeletedIds = gistMergeDeletedIds(localDeletedIds, remoteDeletedIds);

      const localTasksRaw = localStorage.getItem(STORAGE_KEY);
      let localTasks;
      try { localTasks = localTasksRaw ? JSON.parse(localTasksRaw) : []; } catch { localTasks = undefined; }
      const localTasksValid = Array.isArray(localTasks);
      if (localTasksValid) ensureTaskIds(localTasks);

      const mergedTasks = localTasksValid ? mergeTasksByContent(localTasks, data.tasks) : dedupeTasks(data.tasks);

      const filteredTasks = gistFilterDeleted(mergedTasks, mergedDeletedIds)
        .filter(t => !t.dataset || t.dataset === DATASET);

      let changed = gistContentDiffers(localTasks, filteredTasks);
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTasks));
      }

      if (gistContentDiffers(localDeletedIds, mergedDeletedIds)) {
        localStorage.setItem(GIST_DELETED_KEY_PREFIX + DATASET, JSON.stringify(mergedDeletedIds));
      }

      const REMOTE_KEY_MAP = {
        [LABELS_KEY]: 'labels',
        [DONE_COLLAPSED_KEY]: 'doneCollapsed',
        [SETTINGS_KEY]: 'settings',
      };

      const mergeObj = (key) => {
        const localRaw = localStorage.getItem(key);
        let localVal;
        try { localVal = localRaw ? JSON.parse(localRaw) : undefined; } catch { localVal = undefined; }
        const remoteKey = REMOTE_KEY_MAP[key] || key.replace(P, '');
        const remoteVal = data[remoteKey];
        if (!remoteVal || typeof remoteVal !== 'object') return false;
        const localValid = localVal !== undefined && localVal !== null && typeof localVal === 'object' && !Array.isArray(localVal);
        const merged = localValid ? gistMergeObjects(localVal, remoteVal) : remoteVal;
        if (gistContentDiffers(localVal, merged)) {
          localStorage.setItem(key, JSON.stringify(merged));
          return true;
        }
        return false;
      };

      changed = mergeObj(LABELS_KEY) || changed;
      changed = mergeObj(DONE_COLLAPSED_KEY) || changed;
      changed = mergeObj(SETTINGS_KEY) || changed;

      if (Array.isArray(data.projects)) {
        const localProjectsRaw = localStorage.getItem(PROJECTS_KEY);
        let localProjects;
        try { localProjects = localProjectsRaw ? JSON.parse(localProjectsRaw) : []; } catch { localProjects = []; }
        if (!Array.isArray(localProjects)) localProjects = [];
        const mergedProjects = gistMergeArraysById(localProjects, data.projects);
        if (gistContentDiffers(localProjects, mergedProjects)) {
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(mergedProjects));
          changed = true;
        }
      }

      // Ніколи не відкочуємо dataset-рівневий штамп "останньої зміни" назад:
      // якщо тут є невідіслані локальні зміни (pendingChanges), locally
      // stored тепер MOЖЕ містити per-task edits новіші за remote (їх
      // зберіг id/updatedAt-merge вище) — тому беремо максимум, а не сліпо
      // remote-значення. Це гарантує, що подальший push-staleness check
      // (updateTasksInGist) не вирішить, що "remote новіший", коли насправді
      // локальна зміна ще не потрапила в gist.
      const remoteModified = gistNormalizeModified(data.lastModified || data.lastSync || 0);
      const priorLocalModified = gistGetLocalModified(DATASET);
      const nextModified = storage.pendingChanges
        ? Math.max(remoteModified, priorLocalModified)
        : remoteModified;
      gistSetLocalModified(DATASET, nextModified);

      if (changed) {
        const output = document.getElementById(OUTPUT_ID);
        const mod = DATASET === 'code' ? (typeof codeTasksModule !== 'undefined' ? codeTasksModule : null) : (typeof tasksModule !== 'undefined' ? tasksModule : null);
        const active = document.activeElement;
        const userIsEditing = output && active && output.contains(active) &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (output && mod && !userIsEditing) {
          if (typeof mod.renderUIPreserveScroll === 'function') mod.renderUIPreserveScroll(output);
          else if (typeof mod.renderUI === 'function') mod.renderUI(output);
        }
      }
    } catch (err) {
      console.error(`${DATASET} auto-pull failed:`, err);
    } finally {
      storage._suppressAutoSync = false;
      storage.isSyncing = false;
    }
  };

  storage.markPendingChanges = function() {
    if (storage._suppressAutoSync) return;
    storage.pendingChanges = true;
    // Сповіщаємо інші вкладки (followers) оновити UI — дані спільні в localStorage.
    if (typeof gistTabNotifyDataChanged === 'function') gistTabNotifyDataChanged(DATASET);
    storage.scheduleImmediateSync();
  };

  storage.scheduleImmediateSync = function() {
    if (!storage.isEnabled() || storage._suppressAutoSync) return;
    if (storage.debounceTimer) clearTimeout(storage.debounceTimer);
    storage.debounceTimer = setTimeout(() => {
      if (storage.pendingChanges && !storage.isSyncing) {
        storage.updateTasksInGist().catch(err => {
          console.error('Immediate sync failed:', err);
        });
      }
    }, 10000);
  };

  storage.startAutoSync = function() {
    if (storage.syncTimer) {
      clearInterval(storage.syncTimer);
    }

    if (!storage.isEnabled()) {
      return;
    }

    storage.pullFromGist().catch(err => {
      console.error('Initial pull failed:', err);
    });

    storage.syncTimer = setInterval(() => {
      // Лише лідер-вкладка ходить у Gist; follower отримує дані локально.
      if (typeof gistTabIsLeader === 'function' && !gistTabIsLeader()) return;
      storage.pullFromGist().catch(err => {
        console.error('Auto-pull failed:', err);
      });
      if (storage.pendingChanges && !storage.isSyncing) {
        storage.updateTasksInGist().catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }
    }, 60000);
  };

  storage.stopAutoSync = function() {
    if (storage.syncTimer) {
      clearInterval(storage.syncTimer);
      storage.syncTimer = null;
    }
    if (storage.debounceTimer) {
      clearTimeout(storage.debounceTimer);
      storage.debounceTimer = null;
    }
  };

  if (typeof gistRegisterStorage === 'function') gistRegisterStorage(storage);
  if (storage.isEnabled()) storage.startAutoSync();

  return storage;
}

const tasksGistStorage = createTasksGistStorage({
  prefix: '',
  dataset: 'tasks',
  gistFile: 'tasks-data.json',
  outputId: 'output-tasks',
});

const codeGistStorage = createTasksGistStorage({
  prefix: 'code_',
  dataset: 'code',
  gistFile: 'code-data.json',
  outputId: 'output-code',
});

function manualSyncTasks() {
  if (!tasksGistStorage.isEnabled()) {
    alert('Синхронізація з Gist не налаштована. Налаштуйте її в нотатках.');
    return;
  }

  const syncBtn = document.querySelector('.tasks-sync-btn');
  if (syncBtn) syncBtn.classList.add('syncing');

  tasksGistStorage.loadTasksFromGist()
    .then(data => {
      if (data && Array.isArray(data.tasks)) {
        const localModified = gistGetLocalModified('tasks');
        const remoteModified = data.lastModified || data.lastSync || 0;

        if (gistRemoteIsNewer(remoteModified, localModified)) {
          const localTasks = (() => {
            try { return JSON.parse(localStorage.getItem('tasks_data')) || []; } catch { return []; }
          })();
          if (JSON.stringify(data.tasks) !== JSON.stringify(localTasks)) {
            tasksGistStorage.applyTasksData(data);
            gistSetLocalModified('tasks', gistNormalizeModified(remoteModified));
            const output = document.getElementById('output-tasks');
            if (output && typeof tasksModule !== 'undefined' && typeof tasksModule.renderUI === 'function') tasksModule.renderUI(output);
            alert('Отримано новіші дані з Gist!');
            return;
          }
        }

        tasksGistStorage.updateTasksInGist();
        alert('Локальні дані актуальні — синхронізовано з Gist!');
      } else {
        tasksGistStorage.updateTasksInGist();
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
