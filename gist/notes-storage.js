/* ---------- GITHUB GIST STORAGE ---------- */

const GIST_CONFIG_KEY = 'gist_config';
const GIST_SYNC_INTERVAL = 60000; // 1 minute (60 seconds)
const GIST_DEBOUNCE_MS = 10000; // 10 seconds debounce for immediate sync

class GistStorage {
  constructor() {
    this.config = this.loadConfig();
    this.syncTimer = null;
    this.debounceTimer = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.pendingChanges = false;
    this._suppressAutoSync = false;
    this.lastSyncData = null;
    if (typeof gistRegisterStorage === 'function') gistRegisterStorage(this);
    if (this.isEnabled()) this.startAutoSync();
  }

  loadConfig() {
    try {
      const config = JSON.parse(localStorage.getItem(GIST_CONFIG_KEY));
      return config || { token: '', gistId: '', enabled: false };
    } catch {
      return { token: '', gistId: '', enabled: false };
    }
  }

  refreshConfig() {
    const wasEnabled = this.isEnabled();
    this.config = this.loadConfig();
    const isEnabledNow = this.isEnabled();
    if (!wasEnabled && isEnabledNow) {
      this.startAutoSync();
    } else if (wasEnabled && !isEnabledNow) {
      this.stopAutoSync();
    } else if (isEnabledNow) {
      this.lastSyncData = null;
    }
  }

  saveConfig(config) {
    this.config = config;
    localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify(config));
  }

  isEnabled() {
    return this.config.enabled && this.config.token;
  }

  async createGist(data) {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Tab Links - Notes Data',
        public: false,
        files: {
          'notes-data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create gist');
    }

    const gist = await response.json();
    return gist.id;
  }

  async updateGist(data) {
    if (!this.config.gistId) {
      throw new Error('No gist ID configured');
    }

    const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          'notes-data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update gist');
    }

    return await response.json();
  }

  async loadFromGist() {
    if (!this.config.gistId) {
      throw new Error('No gist ID configured');
    }

    const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
      headers: {
        'Authorization': `token ${this.config.token}`,
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to load gist');
    }

    const gist = await response.json();
    const file = gist.files['notes-data.json'];
    
    if (!file) {
      throw new Error('Notes data file not found in gist');
    }

    let content = file.content;

    if (file.truncated) {
      const rawResponse = await fetch(file.raw_url);
      if (!rawResponse.ok) throw new Error('Failed to load full gist content');
      content = await rawResponse.text();
    }

    return JSON.parse(content);
  }

  async syncToGist() {
    if (!this.isEnabled() || this.isSyncing) {
      return;
    }

    // Знімок даних нижче має містити й те, що зараз у редакторі (незбережений
    // дебаунс), інакше push зафіксує в Gist застарілу копію нотатки.
    if (typeof flushPendingNoteSave === 'function') flushPendingNoteSave();

    this.isSyncing = true;
    this.updateSyncStatus('syncing');

    try {
      const data = {
        notes: getNotesData(),
        topics: getNotesTopics(),
        timestamps: getNotesTimestamps(),
        groups: getNotesGroups(),
        topicGroups: getTopicGroups(),
        mainGroup: getMainGroupName(),
        collapsedGroups: getCollapsedGroups(),
        nameMap: getNotesNameMap(),
        deletedIds: gistGetDeletedIds('notes'),
        sidebarWidth: parseInt(localStorage.getItem('notes_sidebar_width')) || 240,
        layoutWidth: parseInt(localStorage.getItem('notes_layout_width')) || 900,
        lastModified: gistModifiedToISO(gistGetLocalModified('notes')),
        lastSync: new Date().toISOString()
      };

      // Перевіряємо чи змінилися дані порівняно з останньою синхронізацією
      const currentDataHash = JSON.stringify(data);
      if (this.lastSyncData === currentDataHash) {
        console.log('Data unchanged, skipping sync');
        this.pendingChanges = false;
        this.isSyncing = false;
        this.updateSyncStatus('idle');
        return;
      }

      // Захист від перезапису: не перезаписуємо в gist дані, які там новіші.
      const localModified = gistGetLocalModified('notes');
      const remote = await this.fetchRemoteModified('notes-data.json');
      if (remote.exists && gistRemoteIsNewer(remote.modified, localModified)) {
        console.log('Gist notes are newer, skipping push to avoid overwriting');
        this.lastSyncData = currentDataHash;
        this.pendingChanges = false;
        this.isSyncing = false;
        this.updateSyncStatus('idle');
        return;
      }

      // Захист від втрати даних: не перезаписуємо Gist порожніми локальними даними,
      // якщо в Gist є непорожні. Це рятує від сліпого pull, що зіпсував локальне.
      const localNotesEmpty = !data.notes || Object.keys(data.notes).length === 0;
      if (localNotesEmpty) {
        const remoteState = await gistRemoteHasData('notes-data.json', d => d && d.notes && Object.keys(d.notes).length > 0);
        if (remoteState.hasData) {
          console.warn('Local notes empty but Gist has data — skipping push to avoid overwrite');
          this.isSyncing = false;
          this.updateSyncStatus('idle');
          return;
        }
      }

      if (!this.config.gistId) {
        // Create new gist
        const gistId = await this.createGist(data);
        this.saveConfig({ ...this.config, gistId });
      } else {
        // Update existing gist
        await this.updateGist(data);
      }

      this.lastSyncTime = new Date();
      this.lastSyncData = currentDataHash;
      this.pendingChanges = false;
      this.updateSyncStatus('success');

      setTimeout(() => this.updateSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Gist sync error:', error);
      this.updateSyncStatus('error', error.message);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Допоміжна функція: отримує час останньої зміни з gist для файлу.
  // Повертає { exists, modified }.
  async fetchRemoteModified(fileName) {
    if (!this.config.gistId) return { exists: false, modified: 0 };
    try {
      const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        headers: { 'Authorization': `token ${this.config.token}` }
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
  }

  async loadFromGistAndApply() {
    if (!this.isEnabled()) {
      throw new Error('Gist storage is not enabled');
    }

    this.updateSyncStatus('loading');
    gistStorage._suppressAutoSync = true;
    fileStorage._suppressAutoSync = true;

    try {
      const data = await this.loadFromGist();

      // Захист від перезапису: якщо локальні дані новіші за gist,
      // не перезаписуємо їх старими даними з gist.
      const remoteModified = data.lastModified || data.lastSync || 0;
      if (gistLocalIsNewer(gistGetLocalModified('notes'), remoteModified)) {
        console.log('Local notes are newer, skipping pull to avoid overwriting');
        this.lastSyncTime = new Date();
        this.updateSyncStatus('success');
        setTimeout(() => this.updateSyncStatus('idle'), 2000);
        return data;
      }

      // Apply loaded data directly to localStorage (bypass markPendingChanges)
      if (data.notes) localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data.notes));
      if (data.topics) localStorage.setItem(NOTES_TOPICS_KEY, JSON.stringify(data.topics));
      if (data.timestamps) localStorage.setItem(NOTES_TIMESTAMPS_KEY, JSON.stringify(data.timestamps));
      if (data.groups) localStorage.setItem(NOTES_GROUPS_KEY, JSON.stringify(data.groups));
      if (data.topicGroups) localStorage.setItem(NOTES_TOPIC_GROUPS_KEY, JSON.stringify(data.topicGroups));
      if (data.mainGroup) localStorage.setItem(NOTES_MAIN_GROUP_KEY, data.mainGroup);
      if (data.collapsedGroups) localStorage.setItem(NOTES_COLLAPSED_KEY, JSON.stringify(data.collapsedGroups));
      if (data.nameMap) localStorage.setItem(NOTES_NAME_MAP_KEY, JSON.stringify(data.nameMap));

      if (data.sidebarWidth !== undefined && data.sidebarWidth !== null) {
        const clampedSidebar = Math.max(180, Math.min(400, data.sidebarWidth));
        localStorage.setItem('notes_sidebar_width', String(clampedSidebar));
      }
      if (data.layoutWidth !== undefined && data.layoutWidth !== null) {
        const clampedLayout = Math.max(600, Math.min(window.innerWidth * 0.95, data.layoutWidth));
        localStorage.setItem('notes_layout_width', String(clampedLayout));
      }

      // Синхронізуємо локальний час зміни з gist, щоб уникнути помилкового push
      gistSetLocalModified('notes', gistNormalizeModified(remoteModified));

      this.lastSyncTime = new Date();
      this.updateSyncStatus('success');
      
      setTimeout(() => this.updateSyncStatus('idle'), 2000);
      
      return data;
    } catch (error) {
      console.error('Gist load error:', error);
      this.updateSyncStatus('error', error.message);
      throw error;
    } finally {
      gistStorage._suppressAutoSync = false;
      fileStorage._suppressAutoSync = false;
    }
  }

  markPendingChanges() {
    if (this._suppressAutoSync) return;
    this.pendingChanges = true;
    // Сповіщаємо інші вкладки (followers) оновити UI — дані спільні в localStorage.
    if (typeof gistTabNotifyDataChanged === 'function') gistTabNotifyDataChanged('notes');
    this.scheduleImmediateSync();
  }

  scheduleImmediateSync() {
    if (!this.isEnabled() || this._suppressAutoSync) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.pendingChanges && !this.isSyncing) {
        this.syncToGist().catch(err => {
          console.error('Immediate sync failed:', err);
        });
      }
    }, GIST_DEBOUNCE_MS);
  }

  // Тихий авто-pull: підтягує нотатки з Gist і ОБ'ЄДНУЄ з локальними.
  // Об'єкти (notes, topics, timestamps, groups, ...) зливаються за ключами,
  // нові ключі додаються, конфлікти вирішуються на користь Gist.
  // Видалення тем синхронізуються через deletedIds.
  async pullFromGist() {
    if (!this.isEnabled() || this.isSyncing) return;
    // Persist any unsaved editor content FIRST (before the suppress flags are
    // set, so pendingChanges is still recorded). This gives the merge below
    // fresh local data with a fresh timestamp — without it, the note being
    // typed right now would be merged from its stale localStorage copy and
    // the editor then re-rendered from it, wiping the unsaved text.
    if (typeof flushPendingNoteSave === 'function') flushPendingNoteSave();
    this.isSyncing = true;
    this._suppressAutoSync = true;
    if (typeof fileStorage !== 'undefined') fileStorage._suppressAutoSync = true;
    try {
      const data = await this.loadFromGist();
      if (!data) return;

      // 1. Об'єднуємо списки видалених id (topic names)
      const remoteDeletedIds = data.deletedIds || [];
      const localDeletedIds = gistGetDeletedIds('notes');
      const mergedDeletedIds = gistMergeDeletedIds(localDeletedIds, remoteDeletedIds);

      const OBJECT_KEYS = {
        groups: NOTES_GROUPS_KEY,
        topicGroups: NOTES_TOPIC_GROUPS_KEY,
        nameMap: NOTES_NAME_MAP_KEY,
      };
      // collapsedGroups НЕ входить сюди: це UI-стан, де розгортання групи —
      // це ВИДАЛЕННЯ елемента з масиву. Union-злиття (gistMergeDateArrays)
      // повертало щойно прибрану групу назад із ще не оновленої копії в Gist,
      // і група самовільно згорталась після кожного auto-pull. Він
      // вирішується last-write-wins нижче.
      const ARRAY_KEYS = {
        topics: NOTES_TOPICS_KEY,
      };

      let changed = false;

      // notes + timestamps: об'єднуємо ПО-НОТАТКОВО з урахуванням часу зміни.
      // Загальний gistMergeObjects віддає перевагу remote при будь-якому
      // конфлікті — це затирало локальні нотатки, які новіші за копію в Gist
      // (усе, що надруковано після останнього push). Тут remote перемагає
      // лише коли його timestamp для конкретної нотатки строго новіший.
      if (data.notes !== undefined && data.notes && typeof data.notes === 'object') {
        let localNotes, localTs;
        try { localNotes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY)) || {}; } catch { localNotes = {}; }
        try { localTs = JSON.parse(localStorage.getItem(NOTES_TIMESTAMPS_KEY)) || {}; } catch { localTs = {}; }
        if (typeof localNotes !== 'object' || Array.isArray(localNotes)) localNotes = {};
        if (typeof localTs !== 'object' || Array.isArray(localTs)) localTs = {};
        const remoteNotes = data.notes;
        const remoteTs = (data.timestamps && typeof data.timestamps === 'object') ? data.timestamps : {};

        const mergedNotes = { ...localNotes };
        const mergedTs = { ...localTs };
        for (const noteKey of Object.keys(remoteNotes)) {
          if (!mergedNotes.hasOwnProperty(noteKey)) {
            mergedNotes[noteKey] = remoteNotes[noteKey];
            continue;
          }
          const rTs = gistNormalizeModified(remoteTs[noteKey]);
          const lTs = gistNormalizeModified(localTs[noteKey]);
          // За рівних/відсутніх міток часу лишаємо локальний вміст —
          // консервативний вибір, що ніколи не втрачає локальні зміни.
          if (rTs > lTs) mergedNotes[noteKey] = remoteNotes[noteKey];
        }
        for (const tsKey of Object.keys(remoteTs)) {
          const rTs = gistNormalizeModified(remoteTs[tsKey]);
          if (rTs > gistNormalizeModified(mergedTs[tsKey])) mergedTs[tsKey] = rTs;
        }

        if (gistContentDiffers(localNotes, mergedNotes)) {
          localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(mergedNotes));
          changed = true;
        }
        if (gistContentDiffers(localTs, mergedTs)) {
          localStorage.setItem(NOTES_TIMESTAMPS_KEY, JSON.stringify(mergedTs));
          changed = true;
        }
      }

      // Об'єднуємо об'єкти
      for (const [field, key] of Object.entries(OBJECT_KEYS)) {
        if (data[field] === undefined) continue;
        const localRaw = localStorage.getItem(key);
        let localVal;
        try { localVal = localRaw ? JSON.parse(localRaw) : undefined; } catch { localVal = undefined; }
        const localValid = localVal !== undefined && localVal !== null && typeof localVal === 'object' && !Array.isArray(localVal);
        const merged = localValid ? gistMergeObjects(localVal, data[field]) : data[field];
        if (gistContentDiffers(localVal, merged)) {
          localStorage.setItem(key, JSON.stringify(merged));
          changed = true;
        }
      }

      // Об'єднуємо масиви (topics, collapsedGroups)
      for (const [field, key] of Object.entries(ARRAY_KEYS)) {
        if (data[field] === undefined) continue;
        const localRaw = localStorage.getItem(key);
        let localVal;
        try { localVal = localRaw ? JSON.parse(localRaw) : undefined; } catch { localVal = undefined; }
        const localValid = Array.isArray(localVal);
        const merged = localValid ? gistMergeDateArrays(localVal, data[field]) : data[field];
        if (gistContentDiffers(localVal, merged)) {
          localStorage.setItem(key, JSON.stringify(merged));
          changed = true;
        }
      }

      // 2. Видаляємо теми з mergedDeletedIds
      if (mergedDeletedIds.length > 0) {
        const delSet = new Set(mergedDeletedIds);
        // Видаляємо з topics
        const topicsRaw = localStorage.getItem(NOTES_TOPICS_KEY);
        let topics;
        try { topics = topicsRaw ? JSON.parse(topicsRaw) : []; } catch { topics = []; }
        const filteredTopics = topics.filter(t => !delSet.has(t));
        if (filteredTopics.length !== topics.length) {
          localStorage.setItem(NOTES_TOPICS_KEY, JSON.stringify(filteredTopics));
          changed = true;
        }
        // Видаляємо з notes
        const notesRaw = localStorage.getItem(NOTES_STORAGE_KEY);
        let notesObj;
        try { notesObj = notesRaw ? JSON.parse(notesRaw) : {}; } catch { notesObj = {}; }
        let notesChanged = false;
        for (const key of Object.keys(notesObj)) {
          if (delSet.has(key)) { delete notesObj[key]; notesChanged = true; }
        }
        if (notesChanged) {
          localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesObj));
          changed = true;
        }
        // Видаляємо з timestamps, groups, topicGroups, nameMap
        for (const storageKey of [NOTES_TIMESTAMPS_KEY, NOTES_GROUPS_KEY, NOTES_TOPIC_GROUPS_KEY, NOTES_NAME_MAP_KEY]) {
          const raw = localStorage.getItem(storageKey);
          let obj;
          try { obj = raw ? JSON.parse(raw) : {}; } catch { obj = {}; }
          let objChanged = false;
          for (const key of Object.keys(obj)) {
            if (delSet.has(key)) { delete obj[key]; objChanged = true; }
          }
          if (objChanged) localStorage.setItem(storageKey, JSON.stringify(obj));
        }
      }

      // 3. Об'єднуємо deletedIds і зберігаємо
      if (gistContentDiffers(localDeletedIds, mergedDeletedIds)) {
        localStorage.setItem(GIST_DELETED_KEY_PREFIX + 'notes', JSON.stringify(mergedDeletedIds));
      }

      if (data.mainGroup !== undefined) {
        localStorage.setItem(NOTES_MAIN_GROUP_KEY, data.mainGroup);
        changed = true;
      }
      // collapsedGroups: last-write-wins. Приймаємо remote-значення лише коли
      // копія в Gist строго новіша за локальну — інакше локальне розгортання,
      // ще не запушене, було б затерте старим станом із Gist.
      try {
        const cgRaw = localStorage.getItem(NOTES_COLLAPSED_KEY);
        let cg;
        try { cg = cgRaw ? JSON.parse(cgRaw) : []; } catch { cg = null; }
        // Захист від сміття в Gist / зіпсованого локального значення.
        const cgValid = Array.isArray(cg);
        if (!cgValid) cg = [];

        const remoteCg = Array.isArray(data.collapsedGroups) ? data.collapsedGroups : null;
        const remoteWins = remoteCg !== null && gistRemoteIsNewer(
          data.lastModified || data.lastSync || 0,
          gistGetLocalModified('notes')
        );
        const nextCg = remoteWins ? remoteCg : cg;

        // Некоректне локальне значення переписуємо завжди (нормалізація).
        if (!cgValid || gistContentDiffers(cg, nextCg)) {
          localStorage.setItem(NOTES_COLLAPSED_KEY, JSON.stringify(nextCg));
          changed = true;
        }
      } catch {}
      // ШИРИНА: не перезаписуємо локальну ширину під час auto-pull —
      // користувач може мати різну ширину на різних пристроях.
      // Ширина зберігається локально і пушиться в gist, але pull не перезаписує.

      const remoteModified = data.lastModified || data.lastSync || 0;
      gistSetLocalModified('notes', gistNormalizeModified(remoteModified));

      if (changed && typeof renderNotesUI === 'function') {
        const output = document.getElementById('output-notes');
        if (output) renderNotesUI(output);
      }
    } catch (err) {
      console.error('Notes auto-pull failed:', err);
    } finally {
      this._suppressAutoSync = false;
      if (typeof fileStorage !== 'undefined') fileStorage._suppressAutoSync = false;
      this.isSyncing = false;
    }
  }

  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (!this.isEnabled()) {
      return;
    }

    // Одразу підтягуємо свіжі дані з Gist при запуску
    this.pullFromGist().catch(err => {
      console.error('Initial pull failed:', err);
    });

    this.syncTimer = setInterval(() => {
      // Лише лідер-вкладка ходить у Gist; follower отримує дані локально.
      if (typeof gistTabIsLeader === 'function' && !gistTabIsLeader()) return;
      // Тихий pull: об'єднуємо зміни з Gist
      this.pullFromGist().catch(err => {
        console.error('Auto-pull failed:', err);
      });
      // Push: якщо є локальні зміни
      if (this.pendingChanges && !this.isSyncing) {
        this.syncToGist().catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }
    }, GIST_SYNC_INTERVAL);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  updateSyncStatus(status, message = '') {
    const event = new CustomEvent('gist-sync-status', {
      detail: { status, message, lastSync: this.lastSyncTime }
    });
    window.dispatchEvent(event);
  }

  async testConnection() {
    if (!this.config.token) {
      throw new Error('No token configured');
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${this.config.token}`,
      }
    });

    if (!response.ok) {
      throw new Error('Invalid token or connection failed');
    }

    const user = await response.json();
    return user;
  }
}

// Global instance
const gistStorage = new GistStorage();
