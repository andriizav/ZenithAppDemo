/* ========== GIST STORAGE FOR HABITS ========== */

// This class expects the following global from the main file:
// - habits (array of habit objects)

class HabitsGistStorage {
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
    localStorage.setItem('gist_config', JSON.stringify(config));
  }

  isEnabled() {
    return this.config.enabled && this.config.token && this.config.gistId;
  }

  async updateHabitsInGist() {
    if (!this.isEnabled() || this.isSyncing) {
      return false;
    }

    this.isSyncing = true;

    try {
      const habitsData = {
        version: '1.0',
        habits: habits,
        deletedIds: gistGetDeletedIds('habits'),
        lastModified: gistModifiedToISO(gistGetLocalModified('habits')),
        lastSync: new Date().toISOString()
      };

      // Перевіряємо чи змінилися дані порівняно з останньою синхронізацією
      const currentDataHash = JSON.stringify(habitsData);
      if (this.lastSyncData === currentDataHash) {
        console.log('Habits data unchanged, skipping sync');
        this.pendingChanges = false;
        this.isSyncing = false;
        return false;
      }

      // Захист від перезапису: не перезаписуємо в gist дані, які там новіші.
      const localModified = gistGetLocalModified('habits');
      const remote = await this.fetchRemoteModified('habits-data.json');
      if (remote.exists && gistRemoteIsNewer(remote.modified, localModified)) {
        console.log('Gist habits are newer, skipping push to avoid overwriting');
        this.lastSyncData = currentDataHash;
        this.pendingChanges = false;
        this.isSyncing = false;
        return false;
      }

      // Захист від втрати даних: не перезаписуємо Gist порожніми локальними звичками,
      // якщо в Gist є непорожні. Рятує від сліпого pull, що зіпсував локальне.
      const localHabitsEmpty = !habits || habits.length === 0;
      if (localHabitsEmpty) {
        const remoteState = await gistRemoteHasData('habits-data.json', d => d && Array.isArray(d.habits) && d.habits.length > 0);
        if (remoteState.hasData) {
          console.warn('Local habits empty but Gist has data — skipping push to avoid overwrite');
          this.isSyncing = false;
          this.pendingChanges = false;
          return false;
        }
      }

      // Не створюємо файл у gist, якщо локально порожньо і файлу ще немає
      if (localHabitsEmpty && !remote.exists) {
        this.pendingChanges = false;
        this.isSyncing = false;
        return false;
      }

      // Спочатку завантажуємо поточний gist
      const gistResponse = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        headers: {
          'Authorization': `token ${this.config.token}`
        }
      });

      if (!gistResponse.ok) {
        throw new Error('Не вдалося завантажити gist');
      }

      const gist = await gistResponse.json();

      // Оновлюємо тільки habits-data.json, зберігаючи інші файли
      const files = { ...gist.files };
      files['habits-data.json'] = {
        content: JSON.stringify(habitsData, null, 2)
      };

      // Видаляємо файли, які не повинні бути в gist (notes-data.json залишаємо)
      const updateResponse = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files })
      });

      if (!updateResponse.ok) {
        throw new Error('Не вдалося оновити gist');
      }

      this.lastSyncTime = new Date();
      this.lastSyncData = currentDataHash;
      this.pendingChanges = false;
      return true;
    } catch (error) {
      console.error('Habits Gist sync error:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  async loadHabitsFromGist() {
    if (!this.isEnabled()) {
      throw new Error('Gist синхронізація не налаштована');
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        headers: {
          'Authorization': `token ${this.config.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Не вдалося завантажити gist');
      }

      const gist = await response.json();
      const file = gist.files['habits-data.json'];

      if (!file) {
        // Якщо файл habits не існує, створюємо його з поточними даними
        await this.updateHabitsInGist();
        return habits;
      }

      let content = file.content;

      if (file.truncated) {
        const rawResponse = await fetch(file.raw_url);
        if (!rawResponse.ok) throw new Error('Не вдалося завантажити повний вміст gist');
        content = await rawResponse.text();
      }

      const data = JSON.parse(content);

      if (data.habits && Array.isArray(data.habits)) {
        this._lastRemoteModified = gistNormalizeModified(data.lastModified || data.lastSync || 0);
        this._lastDeletedIds = data.deletedIds || [];
        return data.habits;
      }

      throw new Error('Невірний формат даних habits');
    } catch (error) {
      console.error('Habits Gist load error:', error);
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

  // Тихий авто-pull: підтягує звички з Gist і ОБ'ЄДНУЄ з локальними.
  // Видалення синхронізуються через deletedIds.
  async pullFromGist() {
    if (!this.isEnabled() || this.isSyncing) return;
    this.isSyncing = true;
    this._suppressAutoSync = true;
    try {
      const gistHabits = await this.loadHabitsFromGist();
      if (!gistHabits || !Array.isArray(gistHabits) || gistHabits.length === 0) return;

      // 1. Об'єднуємо списки видалених id
      const remoteDeletedIds = this._lastDeletedIds || [];
      const localDeletedIds = gistGetDeletedIds('habits');
      const mergedDeletedIds = gistMergeDeletedIds(localDeletedIds, remoteDeletedIds);

      // Per-date last-write-wins злиття (gistMergeHabitDates) замість наївного
      // union масивів дат: union не може виразити "зняв позначку", тому стара
      // копія з gist могла "воскресити" щойно зняту клітинку. Див. gist/sync-base.js.
      const merged = gistMergeHabitsArrays(habits, gistHabits);

      // 2. Видаляємо звички, які є у mergedDeletedIds
      const filtered = gistFilterDeleted(merged, mergedDeletedIds);

      const changed = gistContentDiffers(habits, filtered);
      habits = filtered;
      if (changed) {
        localStorage.setItem('habits', JSON.stringify(habits));
        if (typeof scheduleRenderHabits === 'function') scheduleRenderHabits();
      }

      // 3. Об'єднуємо deletedIds і зберігаємо
      if (gistContentDiffers(localDeletedIds, mergedDeletedIds)) {
        localStorage.setItem(GIST_DELETED_KEY_PREFIX + 'habits', JSON.stringify(mergedDeletedIds));
      }

      gistSetLocalModified('habits', this._lastRemoteModified || Date.now());
    } catch (err) {
      console.error('Habits auto-pull failed:', err);
    } finally {
      this._suppressAutoSync = false;
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

    // Синхронізація кожні 5 хвилин (300 секунд): тихий pull + push якщо є зміни
    this.syncTimer = setInterval(() => {
      // Лише лідер-вкладка ходить у Gist; follower отримує дані локально.
      if (typeof gistTabIsLeader === 'function' && !gistTabIsLeader()) return;
      this.pullFromGist().catch(err => {
        console.error('Auto-pull failed:', err);
      });
      if (this.pendingChanges && !this.isSyncing) {
        this.updateHabitsInGist().catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }
    }, 60000);
  }

  markPendingChanges() {
    if (this._suppressAutoSync) return;
    this.lastSyncData = null;
    this.pendingChanges = true;
    // Сповіщаємо інші вкладки (followers) оновити UI — дані спільні в localStorage.
    if (typeof gistTabNotifyDataChanged === 'function') gistTabNotifyDataChanged('habits');
    this.scheduleImmediateSync();
  }

  scheduleImmediateSync() {
    if (!this.isEnabled() || this._suppressAutoSync) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.pendingChanges && !this.isSyncing) {
        this.updateHabitsInGist().catch(err => {
          console.error('Immediate sync failed:', err);
        });
      }
    }, 5000); // 5 секунд debounce
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
}

// Створюємо екземпляр gist storage для habits
const habitsGistStorage = new HabitsGistStorage();

function manualSync() {
  if (!habitsGistStorage.isEnabled()) {
    alert('Синхронізація з Gist не налаштована. Налаштуйте її в нотатках.');
    return;
  }

  const syncBtn = document.querySelector('.sync-btn');
  if (syncBtn) {
    syncBtn.classList.add('syncing');
  }

  habitsGistStorage.loadHabitsFromGist()
    .then(gistHabits => {
      if (gistHabits && gistHabits.length > 0) {
        // Захист від перезапису: якщо локальні дані новіші, не перезаписуємо їх.
        if (gistLocalIsNewer(gistGetLocalModified('habits'), habitsGistStorage._lastRemoteModified || 0)) {
          alert('Локальні дані новіші за Gist — залишаємо їх. Натисніть синхронізацію ще раз, щоб записати локальне в Gist.');
          habitsGistStorage.updateHabitsInGist();
          return;
        }
        const localHabits = JSON.parse(localStorage.getItem('habits') || '[]');
        if (gistHabits.length !== localHabits.length || 
            JSON.stringify(gistHabits) !== JSON.stringify(localHabits)) {
          habits = gistHabits;
          localStorage.setItem('habits', JSON.stringify(habits));
          scheduleRenderHabits();
          alert('Дані успішно синхронізовано з Gist!');
        } else {
          alert('Дані вже синхронізовано.');
        }
      }
      habitsGistStorage.updateHabitsInGist();
    })
    .catch(err => {
      console.error('Manual sync error:', err);
      alert('Помилка синхронізації: ' + err.message);
    })
    .finally(() => {
      if (syncBtn) {
        syncBtn.classList.remove('syncing');
      }
    });
}