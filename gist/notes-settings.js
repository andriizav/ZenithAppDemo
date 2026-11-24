/* ========== SYNC SETTINGS MODAL ==========
   Модульне, типізоване вікно налаштувань синхронізації.
   Використовує той самий каркас .settings-modal, що й вікно смітника
   (habits/modals.js openTrashModal) та типізовані кнопки
   (shared/delete-modal.js: modalButton / modalFooter / modalButtonClass).
   Внутрішні поля зберігають класи .gist-settings-* (під них є CSS).
*/

/**
 * @typedef {'browser'|'gist'|'file'} SyncMethod
 */

/**
 * @typedef {Object} SyncSettingsState
 * @property {SyncMethod} method
 * @property {string} gistToken
 * @property {string} gistId
 * @property {string} fileName
 */

/** @type {SyncSettingsState} */
function readSyncSettingsState() {
  const browserActive = !gistStorage.config.enabled && !fileStorage.config.enabled;
  const method = browserActive ? 'browser' : (gistStorage.config.enabled ? 'gist' : 'file');
  return {
    method,
    gistToken: gistStorage.config.token || '',
    gistId: gistStorage.config.gistId || '',
    fileName: fileStorage.config.fileName || 'tab-links-notes.json',
  };
}

const GIST_ICONS = {
  local: ICON('gistError', 17),
  syncing: ICON('gistSyncing', 17),
  success: ICON('gistSuccess', 17),
  error: ICON('gistError', 17),
};

// Локальна копія escapeHtml (не залежимо від delete-modal.js,
// який підключається лише в мобільній версії).
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function showGistToast(message) {
  // Власний тост, щоб не залежати від notes/utils.js (showToast потребує .notes-layout),
  // якого може не бути, коли модалка відкрита з меню «···».
  try {
    if (typeof showToast === 'function') {
      showToast(message);
      return;
    }
  } catch (e) { /* ігноруємо — використовуємо запасний варіант */ }

  const existing = document.querySelector('.gist-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'gist-toast';
  toast.textContent = message;
  toast.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
    'background:rgba(0,0,0,0.85);color:#fff;padding:10px 18px;border-radius:8px;' +
    'font-size:14px;z-index:2000;box-shadow:0 6px 20px rgba(0,0,0,0.35);' +
    'animation:gist-toast-in 0.15s ease;max-width:90vw;text-align:center;';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Ключі, які НЕ стосуються синхронізації/даних додатку і мають пережити
// «Скидання локальних даних» (інакше користувача виштовхне на екран PIN).
const SYNC_RESET_PRESERVE_KEYS = new Set([
  'tab_links_access',
  'tab_links_attempts',
  'tab_links_last_attempt',
]);

// Скидає ВСІ локальні дані/налаштування додатку (нотатки, звички, таймер,
// завдання, конфіг синхронізації) і повертає режим синхронізації до
// «Тільки в браузері». НІКОЛИ не звертається до мережі/Gist — лише вимикає
// auto-sync локально, тому дані в Gist лишаються недоторканими і не
// підтягуються назад після скидання.
function performLocalDataReset() {
  try {
    [
      (typeof gistStorage !== 'undefined') ? gistStorage : null,
      (typeof fileStorage !== 'undefined') ? fileStorage : null,
      (typeof habitsGistStorage !== 'undefined') ? habitsGistStorage : null,
      (typeof timerGistStorage !== 'undefined') ? timerGistStorage : null,
      (typeof tasksGistStorage !== 'undefined') ? tasksGistStorage : null,
    ].forEach((storage) => {
      if (!storage) return;
      if (storage.config) storage.config.enabled = false;
      if (typeof storage.stopAutoSync === 'function') storage.stopAutoSync();
    });
  } catch (e) {
    console.error('performLocalDataReset: failed to stop auto-sync', e);
  }

  Object.keys(localStorage)
    .filter((key) => !SYNC_RESET_PRESERVE_KEYS.has(key))
    .forEach((key) => localStorage.removeItem(key));

  window.location.reload();
}

function lazyLoadGistSettingsCss() {
  if (document.getElementById('gist-settings-css')) return;
  const link = document.createElement('link');
  link.id = 'gist-settings-css';
  link.rel = 'stylesheet';
  link.href = 'gist/gist-settings.css';
  document.head.appendChild(link);
}

function createGistSettingsModal() {
  lazyLoadGistSettingsCss();

  const state = readSyncSettingsState();

  const modal = document.createElement('div');
  modal.className = 'settings-modal sync-settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const methodCard = (value, title, desc) => `
    <label class="sync-method-card${state.method === value ? ' is-active' : ''}" data-method="${value}">
      <input type="radio" name="sync-method" value="${value}" ${state.method === value ? 'checked' : ''}>
      <span class="sync-method-card-text">
        <span class="sync-method-card-title">${escapeHtml(title)}</span>
        <span class="sync-method-card-desc">${escapeHtml(desc)}</span>
      </span>
    </label>`;

  const gistSectionDisplay = state.method === 'gist' ? 'block' : 'none';
  const fileSectionDisplay = state.method === 'file' ? 'block' : 'none';

  modal.innerHTML = `
    <div class="settings-modal-content" role="document">
      <div class="settings-modal-header">
        <h3>Синхронізація</h3>
        <button class="settings-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
      </div>
      <div class="settings-modal-body">
        <div class="sync-settings-blocks">
          <div class="sync-block">
            <label class="sync-block-label">Спосіб зберігання даних</label>
            <div class="sync-method-options">
              ${methodCard('browser', 'Тільки в браузері', 'Дані зберігаються лише локально')}
              ${methodCard('gist', 'GitHub Gist', 'Синхронізація між пристроями через Gist')}
              ${methodCard('file', 'Локальний файл', 'Синхронізація через файл на диску')}
            </div>
          </div>

          <div id="gist-section" class="sync-panel sync-block" style="display: ${gistSectionDisplay};">
            <div class="gist-settings-section">
              <label>GitHub Personal Access Token</label>
              <input type="password" id="gist-token" class="gist-settings-input"
                     placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                     value="${escapeHtml(state.gistToken)}">
              <small class="gist-settings-hint">
                Створіть токен на <a href="https://github.com/settings/tokens/new" target="_blank">github.com/settings/tokens</a>
                <br>Потрібні права: <code>gist</code>
              </small>
            </div>

            <div class="gist-settings-section">
              <label>Gist ID (необов'язково)</label>
              <input type="text" id="gist-id" class="gist-settings-input"
                      placeholder="Залиште порожнім для створення нового"
                      value="${escapeHtml(state.gistId)}">
              <small class="gist-settings-hint">
                Якщо у вас вже є Gist з нотатками, вставте його ID
              </small>
              <div id="gist-link-container" class="sync-gist-link-row">
                <a id="gist-link" href="#" target="_blank" class="sync-gist-link">↗ Відкрити Gist</a>
              </div>
            </div>

            <div class="gist-settings-actions">
              <button id="gist-test-btn" class="${modalButtonClass('secondary', { block: true })}">Перевірити з'єднання</button>
              <button id="gist-load-btn" class="${modalButtonClass('secondary', { block: true })}">Завантажити з Gist</button>
              <button id="gist-sync-btn" class="${modalButtonClass('secondary', { block: true })}">Синхронізувати зараз</button>
            </div>

            <div id="gist-status" class="gist-status"></div>
          </div>

          <div id="file-section" class="sync-panel sync-block" style="display: ${fileSectionDisplay};">
            <div class="gist-settings-section">
              <label>Назва файлу</label>
              <input type="text" id="file-name" class="gist-settings-input"
                      placeholder="tab-links-notes.json"
                      value="${escapeHtml(state.fileName)}">
              <small class="gist-settings-hint">
                Файл буде збережено в папці, яку ви виберете
              </small>
            </div>

            <div class="gist-settings-actions">
              <button id="file-select-btn" class="${modalButtonClass('secondary', { block: true })}">Вибрати файл</button>
              <button id="file-load-btn" class="${modalButtonClass('secondary', { block: true })}">Завантажити з файлу</button>
              <button id="file-sync-btn" class="${modalButtonClass('secondary', { block: true })}">Синхронізувати зараз</button>
            </div>

            <div id="file-status" class="gist-status"></div>
          </div>

          <div class="sync-danger-zone sync-block">
            <div class="sync-danger-zone-header">
              ${ICON('alertTriangle', 16)}
              <span>Скидання локальних даних</span>
            </div>
            <p class="sync-danger-zone-desc">
              Видаляє всі локальні дані та налаштування, повертаючи застосунок до початкового стану та вмикаючи режим «Тільки в браузері». Дані у базі залишаються без змін.
            </p>
            <button type="button" id="reset-local-data-btn" class="${modalButtonClass('danger', { block: true })}">Скинути локальні дані</button>
          </div>
        </div>
      </div>
      <div class="settings-modal-footer">
        <button class="modal-btn modal-btn--secondary modal-btn--block" type="button" data-close>Скасувати</button>
        <button class="modal-btn modal-btn--primary modal-btn--block" type="button" id="gist-save-btn">Зберегти</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('settings-modal-open');

  const close = () => {
    modal.remove();
    document.body.classList.remove('settings-modal-open');
  };

  const saveBtn = modal.querySelector('#gist-save-btn');

  const syncMethodRadios = modal.querySelectorAll('input[name="sync-method"]');
  const gistSection = modal.querySelector('#gist-section');
  const fileSection = modal.querySelector('#file-section');

  const testBtn = modal.querySelector('#gist-test-btn');
  const loadBtn = modal.querySelector('#gist-load-btn');
  const syncBtn = modal.querySelector('#gist-sync-btn');
  const statusEl = modal.querySelector('#gist-status');

  const fileSelectBtn = modal.querySelector('#file-select-btn');
  const fileLoadBtn = modal.querySelector('#file-load-btn');
  const fileSyncBtn = modal.querySelector('#file-sync-btn');
  const fileStatusEl = modal.querySelector('#file-status');

  const tokenInput = modal.querySelector('#gist-token');
  const gistIdInput = modal.querySelector('#gist-id');
  const gistLink = modal.querySelector('#gist-link');
  const gistLinkContainer = modal.querySelector('#gist-link-container');

  const fileNameInput = modal.querySelector('#file-name');
  const resetBtn = modal.querySelector('#reset-local-data-btn');

  resetBtn.onclick = () => {
    const doReset = () => {
      close();
      performLocalDataReset();
    };
    if (typeof window.openDeleteModal === 'function') {
      window.openDeleteModal({
        title: 'Скинути локальні дані',
        text: 'Усі локальні дані та налаштування (нотатки, звички, таймер, завдання) буде видалено, а режим синхронізації повернеться до «Тільки в браузері». Дані у Gist не змінюються і не завантажуються.',
        confirmLabel: 'Скинути',
        onConfirm: doReset
      });
    } else if (confirm('Скинути всі локальні дані? Режим синхронізації повернеться до «Тільки в браузері». Дані у Gist не постраждають.')) {
      doReset();
    }
  };

  function showStatus(message, type = 'info') {
    statusEl.innerHTML = message;
    statusEl.className = `gist-status gist-status-${type}`;
    statusEl.style.display = 'block';
  }

  function showSuccess(message) {
    const check = ICON('check', 15, { strokeWidth: 2.5, extra: 'style="vertical-align:-2px;margin-right:6px"' });
    showStatus(check + message, 'success');
  }

  function hideStatus() {
    statusEl.style.display = 'none';
  }

  function showFileStatus(message, type = 'info') {
    fileStatusEl.textContent = message;
    fileStatusEl.className = `gist-status gist-status-${type}`;
    fileStatusEl.style.display = 'block';
  }

  function hideFileStatus() {
    fileStatusEl.style.display = 'none';
  }

  function updateGistLink() {
    const gistId = gistIdInput.value.trim();
    if (gistId) {
      gistLink.href = `https://gist.github.com/${gistId}`;
      gistLinkContainer.style.display = 'block';
    } else {
      gistLinkContainer.style.display = 'none';
    }
  }

  // Initialize gist link
  updateGistLink();
  gistIdInput.addEventListener('input', updateGistLink);

  const methodCards = modal.querySelectorAll('.sync-method-card');

  syncMethodRadios.forEach(radio => {
    radio.onchange = (e) => {
      methodCards.forEach(card => card.classList.toggle('is-active', card.dataset.method === e.target.value));

      if (e.target.value === 'gist') {
        gistSection.style.display = 'block';
        fileSection.style.display = 'none';
      } else if (e.target.value === 'file') {
        gistSection.style.display = 'none';
        fileSection.style.display = 'block';
      } else {
        gistSection.style.display = 'none';
        fileSection.style.display = 'none';
      }
    };
  });

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  testBtn.onclick = async () => {
    hideStatus();
    const token = tokenInput.value.trim();
    if (!token) {
      showStatus('Введіть токен', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Перевірка...';

    try {
      const tempStorage = new GistStorage();
      tempStorage.config.token = token;
      const user = await tempStorage.testConnection();
      showStatus(`✓ З'єднання успішне! Користувач: ${user.login}`, 'success');
    } catch (error) {
      showStatus(`✗ Помилка: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Перевірити з\'єднання';
    }
  };

  loadBtn.onclick = async () => {
    hideStatus();
    const token = tokenInput.value.trim();
    // Якщо поле Gist ID порожнє, використовуємо збережений ID (нотатки можуть створити gist автоматично)
    const gistId = gistIdInput.value.trim() || (typeof gistStorage !== 'undefined' && gistStorage.config.gistId) || '';

    if (!token || !gistId) {
      showStatus('Введіть токен та Gist ID (або збережіть налаштування, щоб створити Gist автоматично)', 'error');
      return;
    }

    if (!confirm('Це замінить всі поточні дані (нотатки, звички, таймер, завдання) даними з Gist. Продовжити?')) {
      return;
    }

    loadBtn.disabled = true;
    loadBtn.textContent = 'Завантаження...';

    const loaded = [];
    const errors = [];
    const skipped = [];

    try {
      // 1. Завантажуємо весь gist одним запитом
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { 'Authorization': `token ${token}` }
      });
      if (!response.ok) throw new Error('Не вдалося завантажити gist');
      const gist = await response.json();

      // Безпека: не замінюємо порожніми даними
      const hasLocalNotes = !!localStorage.getItem(NOTES_STORAGE_KEY);
      const hasLocalHabits = !!localStorage.getItem('habits');
      const hasLocalPresets = !!localStorage.getItem('tabataPresets');
      const hasLocalTasks = !!localStorage.getItem('tasks_data');

      // 2. Нотатки
      const notesFile = gist.files['notes-data.json'];
      if (notesFile) {
        try {
          let content = notesFile.content;
          if (notesFile.truncated) {
            const raw = await fetch(notesFile.raw_url);
            content = await raw.text();
          }
          const data = JSON.parse(content);
          // Безпека: не замінюємо якщо gist пустий або невалідний
          if (data && data.notes && Object.keys(data.notes).length > 0) {
            // Захист: не перезаписуємо локальні нотатки, якщо вони новіші за gist
            const remoteModified = data.lastModified || data.lastSync || 0;
            if (gistLocalIsNewer(gistGetLocalModified('notes'), remoteModified)) {
              skipped.push('нотатки (локальні новіші)');
            } else {
              gistStorage._suppressAutoSync = true;
              if (data.notes) localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data.notes));
              if (data.topics) localStorage.setItem(NOTES_TOPICS_KEY, JSON.stringify(data.topics));
              if (data.timestamps) localStorage.setItem(NOTES_TIMESTAMPS_KEY, JSON.stringify(data.timestamps));
              if (data.groups) localStorage.setItem(NOTES_GROUPS_KEY, JSON.stringify(data.groups));
              if (data.topicGroups) localStorage.setItem(NOTES_TOPIC_GROUPS_KEY, JSON.stringify(data.topicGroups));
              if (data.mainGroup) localStorage.setItem(NOTES_MAIN_GROUP_KEY, data.mainGroup);
              if (data.collapsedGroups) localStorage.setItem(NOTES_COLLAPSED_KEY, JSON.stringify(data.collapsedGroups));
              if (data.nameMap) localStorage.setItem(NOTES_NAME_MAP_KEY, JSON.stringify(data.nameMap));
              if (data.sidebarWidth) localStorage.setItem('notes_sidebar_width', String(data.sidebarWidth));
              if (data.layoutWidth) localStorage.setItem('notes_layout_width', String(data.layoutWidth));
              gistStorage._suppressAutoSync = false;
              gistSetLocalModified('notes', gistNormalizeModified(remoteModified));
              loaded.push('нотатки');
            }
          } else if (hasLocalNotes) {
            skipped.push('нотатки (Gist порожній)');
          }
        } catch (e) {
          errors.push('нотатки: ' + e.message);
        }
      }

      // 3. Звички
      const habitsFile = gist.files['habits-data.json'];
      if (habitsFile) {
        try {
          let content = habitsFile.content;
          if (habitsFile.truncated) {
            const raw = await fetch(habitsFile.raw_url);
            content = await raw.text();
          }
          const data = JSON.parse(content);
          if (data && data.habits && Array.isArray(data.habits) && data.habits.length > 0) {
            // Захист: не перезаписуємо локальні звички, якщо вони новіші за gist
            const remoteModified = data.lastModified || data.lastSync || 0;
            if (gistLocalIsNewer(gistGetLocalModified('habits'), remoteModified)) {
              skipped.push('звички (локальні новіші)');
            } else {
              // Оновлюємо глобальний масив habits і перерендерюємо UI,
              // інакше нові звички не відобразяться (див. habits.js: scheduleRenderHabits)
              if (typeof habits !== 'undefined') habits = data.habits;
              localStorage.setItem('habits', JSON.stringify(data.habits));
              if (typeof scheduleRenderHabits === 'function') scheduleRenderHabits();
              gistSetLocalModified('habits', gistNormalizeModified(remoteModified));
              loaded.push('звички');
            }
          } else if (hasLocalHabits) {
            skipped.push('звички (Gist порожній)');
          }
        } catch (e) {
          errors.push('звички: ' + e.message);
        }
      }

      // 4. Таймер (шаблони)
      const timerFile = gist.files['timer-presets.json'];
      if (timerFile) {
        try {
          let content = timerFile.content;
          if (timerFile.truncated) {
            const raw = await fetch(timerFile.raw_url);
            content = await raw.text();
          }
          const data = JSON.parse(content);
          if (data && data.presets && Array.isArray(data.presets) && data.presets.length > 0) {
            // Захист: не перезаписуємо локальні шаблони, якщо вони новіші за gist
            const remoteModified = data.lastModified || data.lastSync || 0;
            if (gistLocalIsNewer(gistGetLocalModified('timer'), remoteModified)) {
              skipped.push('таймер (локальні новіші)');
            } else {
              if (typeof timerGistStorage !== 'undefined') {
                timerGistStorage._suppressAutoSync = true;
              }
              localStorage.setItem('tabataPresets', JSON.stringify(data.presets));
              if (typeof timerGistStorage !== 'undefined') {
                timerGistStorage._suppressAutoSync = false;
              }
              gistSetLocalModified('timer', gistNormalizeModified(remoteModified));
              loaded.push('таймер');
            }
          } else if (hasLocalPresets) {
            skipped.push('таймер (Gist порожній)');
          }
        } catch (e) {
          errors.push('таймер: ' + e.message);
        }
      } else if (typeof timerGistStorage !== 'undefined' && timerGistStorage.isEnabled()) {
        // Файлу timer-presets.json немає в gist — синхронізуємо локальні пресети в gist
        try {
          const localPresets = JSON.parse(localStorage.getItem('tabataPresets') || '[]');
          if (localPresets.length > 0) {
            await timerGistStorage.updatePresetsInGist();
            loaded.push('таймер (створено в Gist)');
          } else {
            skipped.push('таймер (немає даних для синхронізації)');
          }
        } catch (e) {
          errors.push('таймер: ' + e.message);
        }
      } else {
        skipped.push('таймер (синхронізація вимкнена)');
      }

      // 5. Завдання
      const tasksFile = gist.files['tasks-data.json'];
      if (tasksFile) {
        try {
          let content = tasksFile.content;
          if (tasksFile.truncated) {
            const raw = await fetch(tasksFile.raw_url);
            content = await raw.text();
          }
          const data = JSON.parse(content);
          if (data && data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
            // Захист: не перезаписуємо локальні завдання, якщо вони новіші за gist
            const remoteModified = data.lastModified || data.lastSync || 0;
            if (gistLocalIsNewer(gistGetLocalModified('tasks'), remoteModified)) {
              skipped.push('завдання (локальні новіші)');
            } else {
              if (typeof tasksGistStorage !== 'undefined') {
                tasksGistStorage.applyTasksData(data);
              } else {
                if (data.tasks) localStorage.setItem('tasks_data', JSON.stringify(data.tasks));
                if (data.labels) localStorage.setItem('tasks_labels', JSON.stringify(data.labels));
                if (data.doneCollapsed) localStorage.setItem('tasks_done_collapsed', JSON.stringify(data.doneCollapsed));
                if (data.settings) localStorage.setItem('tasks_settings', JSON.stringify(data.settings));
              }
              gistSetLocalModified('tasks', gistNormalizeModified(remoteModified));
              loaded.push('завдання');
            }
          } else if (hasLocalTasks) {
            skipped.push('завдання (Gist порожній)');
          }
        } catch (e) {
          errors.push('завдання: ' + e.message);
        }
      }

      // 6. Результат
      const parts = [];
      if (skipped.length) parts.push('⚠ Пропущено: ' + skipped.join(', '));
      if (errors.length) parts.push('✗ Помилки: ' + errors.join(', '));

      if (errors.length) {
        showStatus(parts.join('\n'), 'error');
      } else if (loaded.length || skipped.length) {
        // Успіх — показуємо просте підтвердження, деталі лише якщо щось пропущено
        if (skipped.length) {
          showStatus('Дані успішно отримано\n' + parts.join('\n'), 'success');
        } else {
          showSuccess('Дані успішно отримано');
        }
      } else {
        showStatus('У Gist немає даних для завантаження', 'error');
      }

      // Перезавантажуємо UI
      setTimeout(() => {
        if (typeof renderNotesUI === 'function') {
          const container = document.getElementById('output-notes');
          if (container) renderNotesUI(container);
        }
        if (typeof timerRenderPresets === 'function') timerRenderPresets();
        if (typeof scheduleRenderHabits === 'function') scheduleRenderHabits();
        if (typeof renderTasksUI === 'function') {
          const tasksContainer = document.getElementById('output-tasks');
          if (tasksContainer) renderTasksUI(tasksContainer);
        }
      }, 300);

    } catch (error) {
      showStatus('✗ Помилка: ' + error.message, 'error');
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Завантажити з Gist';
    }
  };

  syncBtn.onclick = async () => {
    hideStatus();
    const token = tokenInput.value.trim();

    if (!token) {
      showStatus('Введіть токен', 'error');
      return;
    }

    syncBtn.disabled = true;
    syncBtn.textContent = 'Синхронізація...';

    const synced = [];
    const syncErrors = [];

    try {
      // 1. Нотатки
      const tempStorage = new GistStorage();
      tempStorage.config.token = token;
      tempStorage.config.gistId = gistIdInput.value.trim();
      tempStorage.config.enabled = true;

      try {
        await tempStorage.syncToGist();
        synced.push('нотатки');
      } catch (e) {
        syncErrors.push('нотатки: ' + e.message);
      }

      if (tempStorage.config.gistId && !gistIdInput.value.trim()) {
        gistIdInput.value = tempStorage.config.gistId;
        updateGistLink();
      }

      // 2. Звички
      if (typeof habitsGistStorage !== 'undefined' && habitsGistStorage.isEnabled()) {
        try {
          habitsGistStorage._suppressAutoSync = true;
          await habitsGistStorage.updateHabitsInGist();
          habitsGistStorage._suppressAutoSync = false;
          synced.push('звички');
        } catch (e) {
          syncErrors.push('звички: ' + e.message);
        }
      }

      // 3. Таймер (шаблони)
      if (typeof timerGistStorage !== 'undefined' && timerGistStorage.isEnabled()) {
        try {
          timerGistStorage._suppressAutoSync = true;
          timerGistStorage.lastSyncData = null; // примусово записати актуальні шаблони
          await timerGistStorage.updatePresetsInGist();
          timerGistStorage._suppressAutoSync = false;
          synced.push('таймер');
        } catch (e) {
          syncErrors.push('таймер: ' + e.message);
        }
      }

      // 4. Завдання
      if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled()) {
        try {
          tasksGistStorage._suppressAutoSync = true;
          await tasksGistStorage.updateTasksInGist();
          tasksGistStorage._suppressAutoSync = false;
          synced.push('завдання');
        } catch (e) {
          syncErrors.push('завдання: ' + e.message);
        }
      }

      const parts = [];
      if (syncErrors.length) parts.push('✗ Помилки: ' + syncErrors.join(', '));

      if (syncErrors.length) {
        showStatus(parts.join('\n'), 'error');
      } else {
        showSuccess('Дані успішно синхронізовано');
      }
    } catch (error) {
      showStatus(`✗ Помилка: ${error.message}`, 'error');
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Синхронізувати зараз';
    }
  };

  fileSelectBtn.onclick = async () => {
    hideFileStatus();
    fileSelectBtn.disabled = true;
    fileSelectBtn.textContent = 'Вибір...';

    try {
      await fileStorage.requestFileAccess();
      fileNameInput.value = fileStorage.fileHandle.name;
      showFileStatus(`✓ Файл вибрано: ${fileStorage.fileHandle.name}`, 'success');
    } catch (error) {
      showFileStatus(`✗ Помилка: ${error.message}`, 'error');
    } finally {
      fileSelectBtn.disabled = false;
      fileSelectBtn.textContent = 'Вибрати файл';
    }
  };

  fileLoadBtn.onclick = async () => {
    hideFileStatus();

    // Якщо файл не вибрано, відкриваємо діалог відкриття файлу
    if (!fileStorage.fileHandle) {
      fileLoadBtn.disabled = true;
      fileLoadBtn.textContent = 'Вибір файлу...';

      try {
        await fileStorage.openFileForReading();
        fileNameInput.value = fileStorage.fileHandle.name;
      } catch (error) {
        showFileStatus(`✗ Помилка вибору файлу: ${error.message}`, 'error');
        fileLoadBtn.disabled = false;
        fileLoadBtn.textContent = 'Завантажити з файлу';
        return;
      }
    }

    if (!confirm('Це замінить всі поточні нотатки даними з файлу. Продовжити?')) {
      fileLoadBtn.disabled = false;
      fileLoadBtn.textContent = 'Завантажити з файлу';
      return;
    }

    fileLoadBtn.disabled = true;
    fileLoadBtn.textContent = 'Завантаження...';

    try {
      await fileStorage.loadFromFileAndApply();
      showFileStatus('✓ Дані успішно завантажено!', 'success');

      setTimeout(() => {
        if (typeof renderNotesUI === 'function') {
          const container = document.getElementById('output-notes');
          if (container) renderNotesUI(container);
        }
      }, 500);
    } catch (error) {
      showFileStatus(`✗ Помилка: ${error.message}`, 'error');
    } finally {
      fileLoadBtn.disabled = false;
      fileLoadBtn.textContent = 'Завантажити з файлу';
    }
  };

  fileSyncBtn.onclick = async () => {
    hideFileStatus();

    if (!fileStorage.fileHandle) {
      showFileStatus('Спочатку виберіть файл', 'error');
      return;
    }

    fileSyncBtn.disabled = true;
    fileSyncBtn.textContent = 'Синхронізація...';

    try {
      fileStorage.config.enabled = true;
      await fileStorage.syncToFile();
      showFileStatus('✓ Синхронізація успішна!', 'success');
    } catch (error) {
      showFileStatus(`✗ Помилка: ${error.message}`, 'error');
    } finally {
      fileSyncBtn.disabled = false;
      fileSyncBtn.textContent = 'Синхронізувати зараз';
    }
  };

  saveBtn.onclick = () => {
    const syncMethod = modal.querySelector('input[name="sync-method"]:checked').value;

    if (syncMethod === 'browser') {
      gistStorage.saveConfig({ enabled: false, token: gistStorage.config.token, gistId: gistStorage.config.gistId });
      fileStorage.saveConfig({ enabled: false, fileName: fileStorage.config.fileName });
      gistStorage.stopAutoSync();
      fileStorage.stopAutoSync();
      if (typeof gistNotifyConfigChanged === 'function') gistNotifyConfigChanged();
      showGistToast('Дані зберігаються тільки в браузері');
      setTimeout(() => {
        const container = document.getElementById('output-notes');
        if (container && typeof renderNotesUI === 'function') renderNotesUI(container);
      }, 100);
    } else if (syncMethod === 'gist') {
      const config = {
        enabled: true,
        token: tokenInput.value.trim(),
        gistId: gistIdInput.value.trim()
      };

      gistStorage.saveConfig(config);
      fileStorage.saveConfig({ enabled: false, fileName: fileStorage.config.fileName });

      gistStorage.startAutoSync();
      fileStorage.stopAutoSync();
      // Сповіщуємо ВСІ gist-сховища (tasks, habits, timer), щоб вони
      // перечитали конфіг і запустили auto-sync
      if (typeof gistNotifyConfigChanged === 'function') gistNotifyConfigChanged();
      showGistToast('Синхронізація з Gist увімкнена');
      setTimeout(() => {
        const container = document.getElementById('output-notes');
        if (container && typeof renderNotesUI === 'function') renderNotesUI(container);
      }, 100);
    } else {
      const config = {
        enabled: true,
        fileName: fileNameInput.value.trim() || 'tab-links-notes.json'
      };

      fileStorage.saveConfig(config);
      gistStorage.saveConfig({ enabled: false, token: gistStorage.config.token, gistId: gistStorage.config.gistId });

      if (fileStorage.fileHandle) {
        fileStorage.startAutoSync();
        gistStorage.stopAutoSync();
        if (typeof gistNotifyConfigChanged === 'function') gistNotifyConfigChanged();
        showGistToast('Синхронізація з файлом увімкнена');
        setTimeout(() => {
          const container = document.getElementById('output-notes');
          if (container && typeof renderNotesUI === 'function') renderNotesUI(container);
        }, 100);
      } else {
        showGistToast('Спочатку виберіть файл');
        return;
      }
    }

    setTimeout(close, 1000);
  };

  return modal;
}

function addGistSettingsButton() {
  const btn = document.getElementById('gist-top-btn');
  if (!btn) return;

  const GIST_ICONS = {
    local: ICON('gistLocal', 16),
    syncing: ICON('gistSyncing', 16),
    success: ICON('gistSuccess', 16),
    error: ICON('gistError', 16),
  };

  const updateButtonStatus = (e) => {
    const { status, message } = e.detail;

    switch (status) {
      case 'syncing':
      case 'loading':
        btn.innerHTML = GIST_ICONS.syncing;
        btn.classList.add('syncing');
        break;
      case 'success':
        btn.innerHTML = GIST_ICONS.success;
        btn.classList.remove('syncing');
        btn.classList.add('active');
        const lastSync = e.detail.lastSync;
        btn.title = lastSync ? `Синхронізовано: ${new Date(lastSync).toLocaleString('uk-UA')}` : 'Синхронізовано';
        setTimeout(() => { btn.classList.remove('syncing'); }, 3000);
        break;
      case 'error':
        btn.innerHTML = GIST_ICONS.error;
        btn.classList.remove('syncing');
        btn.title = `Помилка: ${message}`;
        break;
      default:
        btn.innerHTML = GIST_ICONS.local;
        btn.classList.remove('syncing');
        btn.title = 'Налаштування синхронізації';
    }
  };

  window.addEventListener('gist-sync-status', updateButtonStatus);
  window.addEventListener('file-sync-status', updateButtonStatus);
}
