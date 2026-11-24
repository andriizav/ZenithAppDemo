/* ========== GIST STORAGE FOR TIMER PRESETS ========== */

class TimerGistStorage {
  constructor() {
    this.config = this.loadConfig();
    this.isSyncing = false;
    this.syncTimer = null;
    this.debounceTimer = null;
    this.pendingChanges = false;
    this.lastSyncTime = null;
    this.lastSyncData = null;
    this._suppressAutoSync = false;
    if (typeof gistRegisterStorage === 'function') gistRegisterStorage(this);
    if (this.isEnabled()) this.startAutoSync();
  }

  loadConfig() {
    try {
      const config = JSON.parse(localStorage.getItem('gist_config'));
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
    try {
      localStorage.setItem('gist_config', JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save gist config:', e);
    }
  }

  isEnabled() {
    return this.config.enabled && this.config.token;
  }

  async createGist(data) {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'Tab Links — Timer Presets',
        public: false,
        files: { 'timer-presets.json': { content: JSON.stringify(data, null, 2) } }
      })
    });
    if (!response.ok) throw new Error('Не вдалося створити gist');
    const gist = await response.json();
    return gist.id;
  }

  async updateGist(data) {
    const gistResponse = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
      headers: { 'Authorization': `token ${this.config.token}` }
    });
    if (!gistResponse.ok) throw new Error('Не вдалося завантажити gist');
    const gist = await gistResponse.json();
    const files = { ...gist.files };
    files['timer-presets.json'] = { content: JSON.stringify(data, null, 2) };
    const updateResponse = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files })
    });
    if (!updateResponse.ok) throw new Error('Не вдалося оновити gist');
  }

  async updatePresetsInGist() {
    if (!this.isEnabled() || this.isSyncing) return false;

    this.isSyncing = true;

    try {
      const presets = JSON.parse(localStorage.getItem('tabataPresets') || '[]');
      const data = {
        version: '1.0',
        presets: presets,
        deletedIds: gistGetDeletedIds('timer'),
        lastModified: gistModifiedToISO(gistGetLocalModified('timer')),
        lastSync: new Date().toISOString()
      };

      const currentDataHash = JSON.stringify(data);
      if (this.lastSyncData === currentDataHash) {
        this.pendingChanges = false;
        this.isSyncing = false;
        return false;
      }

      // Захист від перезапису: не перезаписуємо в gist дані, які там новіші.
      const localModified = gistGetLocalModified('timer');
      const remote = await this.fetchRemoteModified('timer-presets.json');
      if (remote.exists && gistRemoteIsNewer(remote.modified, localModified)) {
        this.lastSyncData = currentDataHash;
        this.pendingChanges = false;
        this.isSyncing = false;
        return false;
      }

      // Не створюємо файл у gist, якщо локально порожньо і файлу ще немає
      const localEmpty = !presets || presets.length === 0;
      if (localEmpty && !remote.exists) {
        this.pendingChanges = false;
        this.isSyncing = false;
        return false;
      }

      if (!this.config.gistId) {
        const gistId = await this.createGist(data);
        this.saveConfig({ ...this.config, gistId });
      } else {
        await this.updateGist(data);
      }

      this.lastSyncTime = new Date();
      this.lastSyncData = currentDataHash;
      this.pendingChanges = false;
      return true;
    } catch (error) {
      console.error('Timer Gist sync error:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  async loadPresetsFromGist() {
    if (!this.isEnabled()) throw new Error('Gist синхронізація не налаштована');

    try {
      if (!this.config.gistId) {
        // Немає gist ID — створюємо новий gist з локальних пресетів
        const presets = JSON.parse(localStorage.getItem('tabataPresets') || '[]');
        const data = { version: '1.0', presets, lastSync: new Date().toISOString() };
        const gistId = await this.createGist(data);
        this.saveConfig({ ...this.config, gistId });
        this.lastSyncData = JSON.stringify(data);
        return presets;
      }

      const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        headers: { 'Authorization': `token ${this.config.token}` }
      });

      if (!response.ok) throw new Error('Не вдалося завантажити gist');

      const gist = await response.json();
      const file = gist.files['timer-presets.json'];

      if (!file) {
        await this.updatePresetsInGist();
        return JSON.parse(localStorage.getItem('tabataPresets') || '[]');
      }

      let content = file.content;
      if (file.truncated) {
        const rawResponse = await fetch(file.raw_url);
        if (!rawResponse.ok) throw new Error('Не вдалося завантажити повний вміст gist');
        content = await rawResponse.text();
      }

      const data = JSON.parse(content);
      // Якщо у gist порожньо/невалідно, але локальні пресети є — записуємо їх у gist
      const localPresets = JSON.parse(localStorage.getItem('tabataPresets') || '[]');
      if ((!data.presets || !Array.isArray(data.presets) || data.presets.length === 0) && localPresets.length > 0) {
        this.lastSyncData = null; // примусово перезаписати
        await this.updatePresetsInGist();
        return localPresets;
      }
      if (data.presets && Array.isArray(data.presets)) {
        this._lastRemoteModified = gistNormalizeModified(data.lastModified || data.lastSync || 0);
        this._lastDeletedIds = data.deletedIds || [];
        return data.presets;
      }

      throw new Error('Невірний формат даних presets');
    } catch (error) {
      console.error('Timer Gist load error:', error);
      throw error;
    }
  }

  // Допоміжна функція: отримує час останньої зміни з gist для файлу.
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

  // Тихий авто-pull: підтягує шаблони таймера з Gist і ОБ'ЄДНУЄ з локальними.
  // Видалення синхронізуються через deletedIds.
  async pullFromGist() {
    if (!this.isEnabled() || this.isSyncing) return;
    this.isSyncing = true;
    this._suppressAutoSync = true;
    try {
      const gistPresets = await this.loadPresetsFromGist();
      if (!gistPresets || !Array.isArray(gistPresets)) return;

      // 1. Об'єднуємо списки видалених id
      const remoteDeletedIds = this._lastDeletedIds || [];
      const localDeletedIds = gistGetDeletedIds('timer');
      const mergedDeletedIds = gistMergeDeletedIds(localDeletedIds, remoteDeletedIds);

      let localPresets = JSON.parse(localStorage.getItem('tabataPresets') || '[]');
      let localChanged = false;

      // Призначаємо ID локальним пресетам, які їх не мають
      localPresets.forEach(p => {
        if (!p.id) { p.id = 'tp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); localChanged = true; }
      });

      // Зіставляємо gist-пресети без ID з локальними по вмісту (name + settings)
      const presetKey = p => `${p.name}|${p.work}|${p.rest}|${p.rounds}|${p.warmup || 0}|${p.cooldown || 0}`;
      const localKeySet = new Set(localPresets.map(presetKey));
      gistPresets.forEach(gp => {
        if (gp.id) return; // вже має ID — нічого не робимо
        const key = presetKey(gp);
        if (localKeySet.has(key)) {
          // Цей пресет вже є локально — пропускаємо (локальна версія з ID перемагає)
          return;
        }
        // Новий пресет з gist — призначаємо ID
        gp.id = 'tp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        localKeySet.add(key);
      });

      let merged = gistMergeArraysById(localPresets, gistPresets);

      // 2. Видаляємо шаблони, які є у mergedDeletedIds
      merged = gistFilterDeleted(merged, mergedDeletedIds);

      if (localChanged || gistContentDiffers(localPresets, merged)) {
        localStorage.setItem('tabataPresets', JSON.stringify(merged));
        if (typeof timerRenderPresets === 'function') timerRenderPresets();
      }

      // 3. Об'єднуємо deletedIds і зберігаємо
      if (gistContentDiffers(localDeletedIds, mergedDeletedIds)) {
        localStorage.setItem(GIST_DELETED_KEY_PREFIX + 'timer', JSON.stringify(mergedDeletedIds));
      }

      gistSetLocalModified('timer', this._lastRemoteModified || Date.now());
    } catch (err) {
      console.error('Timer auto-pull failed:', err);
    } finally {
      this._suppressAutoSync = false;
      this.isSyncing = false;
    }
  }

  startAutoSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (!this.isEnabled()) return;

    // Одразу підтягуємо свіжі дані з Gist при запуску
    this.pullFromGist().catch(err => {
      console.error('Initial pull failed:', err);
    });

    this.syncTimer = setInterval(() => {
      // Лише лідер-вкладка ходить у Gist; follower отримує дані локально.
      if (typeof gistTabIsLeader === 'function' && !gistTabIsLeader()) return;
      // Тихий pull: об'єднуємо зміни з Gist
      this.pullFromGist().catch(err => {
        console.error('Timer auto-pull failed:', err);
      });
      // Push: якщо є локальні зміни
      if (this.pendingChanges && !this.isSyncing) {
        this.updatePresetsInGist().catch(err => {
          console.error('Timer auto-sync failed:', err);
        });
      }
    }, 60000);
  }

  markPendingChanges() {
    if (this._suppressAutoSync) return;
    this.pendingChanges = true;
    // Сповіщаємо інші вкладки (followers) оновити UI — дані спільні в localStorage.
    if (typeof gistTabNotifyDataChanged === 'function') gistTabNotifyDataChanged('timer');
    this.scheduleImmediateSync();
  }

  scheduleImmediateSync() {
    if (!this.isEnabled() || this._suppressAutoSync) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.pendingChanges && !this.isSyncing) {
        this.updatePresetsInGist().catch(err => {
          console.error('Timer immediate sync failed:', err);
        });
      }
    }, 10000);
  }

  stopAutoSync() {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
  }
}

const timerGistStorage = new TimerGistStorage();
