/* ========== HTML TEMPLATES ========== */

function tplActions() {
  return `
<div class="habits-actions">
  <button class="export-btn" onclick="exportData()" title="Експортувати дані">
    ${ICON('download', 20)}
  </button>
  <button class="import-btn" onclick="document.getElementById('importFile').click()" title="Імпортувати дані">
    ${ICON('upload', 20)}
  </button>
  <input type="file" id="importFile" accept=".json" style="display: none;" onchange="importData(event)">
  <button class="sync-btn" onclick="manualSync()" title="Синхронізувати з Gist">
    ${ICON('refreshDouble', 20)}
  </button>
  <button class="stats-btn" onclick="openStatsModal()" title="Статистика">
    ${ICON('barChart3', 24)}
  </button>
  <button class="notification-btn" onclick="testNotification()" title="Тест сповіщень">
    ${ICON('bell', 20)}
  </button>
  <button class="archive-btn" onclick="openTrashModal()" title="Смітник">
    ${ICON('trash2', 20)}
  </button>
  <button class="settings-btn" onclick="openHabitsSettingsModal()" title="Налаштування">
    ${ICON('bolt', 24)}
  </button>
  <button class="add-btn" onclick="openModal()">
    ${ICON('plus', 24)}
  </button>
</div>`;
}

function tplNewHabitModal() {
  return `
<div class="modal-overlay" id="modal">
  <div class="modal">
    <h3>Нова звичка</h3>
    <input type="text" id="habitName" placeholder="наприклад, Спорт" maxlength="30">
    <div class="modal-section-label">Іконка</div>
    <div class="icon-picker" id="iconPicker"></div>
    <div class="modal-section-label">Тип звички</div>
    <div class="type-selector">
      <label class="type-option">
        <input type="radio" name="habitType" value="good" checked>
        <span class="type-label good">Корисна</span>
      </label>
      <label class="type-option">
        <input type="radio" name="habitType" value="bad">
        <span class="type-label bad">Шкідлива</span>
      </label>
    </div>
    <div class="modal-section-label">Колір</div>
    <div class="color-picker" id="colorPicker"></div>
    <div class="reminder-settings">
      <label class="reminder-toggle">
        <input type="checkbox" id="reminderEnabled">
        <span>Нагадування</span>
      </label>
      <input type="time" id="reminderTime" class="reminder-time-input" style="display: none;" value="09:00">
    </div>
    <div class="notes-modal-footer">
      <button class="gist-btn" onclick="closeModal()">Скасувати</button>
      <button class="gist-btn gist-btn-primary" onclick="saveHabit()">Зберегти</button>
    </div>
  </div>
</div>`;
}

function tplEditHabitModal() {
  return `
<div class="modal-overlay" id="editModal">
  <div class="notes-modal-content edit-modal">
    <div class="notes-modal-header">
      <h3>Редагування звички</h3>
      <button class="notes-modal-close" onclick="closeEditModal()" title="Закрити">&times;</button>
    </div>
    <div class="notes-modal-body">
    <div class="modal-section-label">Назва</div>
    <div class="edit-habit-name-wrapper">
      <input type="text" id="editHabitName" class="edit-habit-name-input" placeholder="наприклад, Спорт" maxlength="30">
    </div>
    <div class="modal-section-label">Іконка</div>
    <div class="icon-picker" id="editIconPicker"></div>
    <div class="modal-section-label">Колір</div>
    <div class="color-picker" id="editColorPicker"></div>
    <div class="modal-section-label">Тип звички</div>
    <div class="type-selector">
      <label class="type-option">
        <input type="radio" name="editHabitType" value="good">
        <span class="type-label good">Корисна</span>
      </label>
      <label class="type-option">
        <input type="radio" name="editHabitType" value="bad">
        <span class="type-label bad">Шкідлива</span>
      </label>
    </div>
    <div class="reminder-settings">
      <label class="reminder-toggle">
        <input type="checkbox" id="editReminderEnabled">
        <span>Нагадування</span>
      </label>
      <input type="time" id="editReminderTime" class="reminder-time-input" style="display: none;" value="09:00">
    </div>
    </div>
    <div class="notes-modal-footer">
      <button class="gist-btn tasks-repeat-delete" onclick="openArchiveFromEditModal()" title="Видалити звичку">${ICON('trash2', 16)}</button>
      <button class="gist-btn" onclick="closeEditModal()">Скасувати</button>
      <button class="gist-btn gist-btn-primary" onclick="saveEditHabit()">Зберегти</button>
    </div>
  </div>
</div>`;
}

function tplStatsModal() {
  return `
<div class="modal-overlay" id="statsModal">
  <div class="modal stats-modal">
    <h3>📊 Статистика</h3>
    <div class="stats-tabs">
      <button class="stats-tab active" data-tab="trends">Тенденції</button>
      <button class="stats-tab" data-tab="comparison">Порівняння</button>
      <button class="stats-tab" data-tab="analysis">Аналіз</button>
    </div>
    <div class="stats-content" id="statsContent"></div>
    <div class="notes-modal-footer">
      <button class="gist-btn" onclick="closeStatsModal()">Закрити</button>
    </div>
  </div>
</div>`;
}

function tplDeleteModal() {
  return `
<div class="modal-overlay" id="deleteModal">
  <div class="modal delete-confirm">
    <div class="delete-confirm-icon">
      ${ICON('alertTriangle', 28)}
    </div>
    <h3 class="delete-confirm-title">Видалити звичку «<span class="delete-confirm-name" id="deleteHabitName"></span>»?</h3>
    <p class="delete-confirm-text">Цю дію неможливо скасувати. Всю історію виконання буде втрачено.</p>
    <div class="delete-confirm-footer">
      <button class="gist-btn" onclick="closeDeleteModal()">Скасувати</button>
      <button class="gist-btn gist-btn-danger" onclick="confirmDelete()">Видалити</button>
    </div>
  </div>
</div>`;
}

function tplSoftDeleteModal() {
  return `
<div class="modal-overlay" id="softDeleteModal">
  <div class="modal delete-confirm">
    <div class="delete-confirm-icon">
      ${ICON('trash', 28)}
    </div>
    <h3 class="delete-confirm-title">Видалити звичку «<span class="delete-confirm-name" id="softDeleteHabitName"></span>»?</h3>
    <p class="delete-confirm-text">Звичку буде переміщено до кошика. Її можна відновити у будь-який момент.</p>
    <div class="delete-confirm-footer">
      <button class="gist-btn" onclick="closeSoftDeleteModal()">Скасувати</button>
      <button class="gist-btn gist-btn-danger" onclick="confirmSoftDelete()">Видалити</button>
    </div>
  </div>
</div>`;
}

function tplTrashModal() {
  return `
<div class="modal-overlay" id="trashModal">
  <div class="modal archive-modal">
    <div class="archive-modal-header">
      <div class="archive-modal-icon">
        ${ICON('trash2', 22)}
      </div>
      <h3>Смітник</h3>
      <span class="archive-count" id="trashCount">0</span>
    </div>
    <div class="archive-list" id="trashList"></div>
    <div class="notes-modal-footer">
      <button class="gist-btn" onclick="closeTrashModal()">Закрити</button>
    </div>
  </div>
</div>`;
}

function tplMainHTML() {
  return `
<div class="habits-quote" id="habitsQuote" aria-live="polite" role="button" tabindex="0" title="Натисніть, щоб змінити цитату">
  <span class="habits-quote-mark" aria-hidden="true">&#8220;</span>
  <span class="habits-quote-text"></span>
</div>
${tplBeginnerGuide()}
<div class="habits-container" id="habitsContainer"></div>
${tplActions()}
${tplNewHabitModal()}
${tplEditHabitModal()}
${tplStatsModal()}
${tplDeleteModal()}
${tplSoftDeleteModal()}
${tplTrashModal()}`;
}

function tplHabitCard(habit, opts) {
  const { iconSvg, categoryColor, heatmapHTML, chartHTML,
          badgesHTML, streakHTML, checkboxIconHTML, reminderIndicator,
          habitType, isDoneToday, isSkippedToday, isHalfToday, isCleanToday, today } = opts;

  const checkboxClasses = [
    "habit-checkbox",
    habitType === "bad" ? "bad-checkbox" : "good-checkbox",
    isDoneToday ? "done" : "",
    isSkippedToday ? "skipped" : "",
    isHalfToday ? "half " + getHalfStyleClass() : "",
    isCleanToday ? (habitType === "bad" ? "skipped" : "clean") : "",
  ].filter(Boolean).join(" ");

  const checkboxStyle = ((isDoneToday && habitType !== "bad") || (isCleanToday && habitType === "bad")) && categoryColor
    ? ` style="background-color: ${categoryColor}; border-color: ${categoryColor};"`
    : (isHalfToday ? ` style="--half-color: ${categoryColor || "#388bfd"};"` : "");

  const rightClickCtx = habitType === "bad"
    ? `toggleCleanDate(${habit.id}, '${today}', event)`
    : `toggleSkippedDate(${habit.id}, '${today}', event)`;

  const cardStyle = categoryColor ? ` style="--category-color: ${categoryColor}"` : "";

  return `
    <div class="habit ${habitType === "bad" ? "bad" : "good"} ${categoryColor ? "has-category" : ""}" data-habit-id="${habit.id}"${cardStyle}
         ondragover="handleHabitDragOver(event)" ondrop="handleHabitDrop(event)"
         ondragleave="handleHabitDragLeave(event)"
         oncontextmenu="if(event.target.closest('.heatmap-wrapper')) return; showHabitContextMenu(event, ${habit.id})">
      <div class="habit-drag-handle" draggable="true"
           ondragstart="handleHabitDragStart(event)" ondragend="handleHabitDragEnd(event)">⋮⋮</div>
      <div class="habit-main">
        <div class="habit-header">
          <div class="habit-icon" onclick="openEditModal(${habit.id})">${iconSvg}</div>
          <div class="habit-name" onclick="openEditModal(${habit.id})">${habit.name}</div>
          ${badgesHTML}
          <div class="habit-top-right" style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
            ${streakHTML}
            <div class="${checkboxClasses}"${checkboxStyle} onclick="toggleToday(${habit.id}, event)" onauxclick="toggleToday(${habit.id}, event)" onmousedown="if(event.button===1)event.preventDefault()" oncontextmenu="toggleTodayContext(${habit.id}, event); return false;">
              ${checkboxIconHTML}
            </div>
          </div>
        </div>
        ${heatmapHTML}
      </div>
    </div>`;
}

function tplEmptyState() {
  return `
<div class="empty-state">
  <h3>Ще немає жодної звички</h3>
  <p>Натисніть на <b class="plus-highlight" onclick="openModal()" style="cursor: pointer;">+</b>, щоб додати першу звичку.</p>
</div>`;
}

function tplBeginnerGuide() {
  return `
<div class="habits-guide open" id="habitsGuide">
  <div class="habits-guide-header" onclick="toggleBeginnerGuide()">
    <span class="habits-guide-icon">${ICON('info', 18)}</span>
    <span class="habits-guide-title">Як користуватися</span>
    <span class="habits-guide-chevron">${ICON('chevronDown', 16)}</span>
  </div>
  <div class="habits-guide-body">
    <div class="habits-guide-section">
      <div class="habits-guide-subtitle">Створення звички</div>
      <div class="habits-guide-text">Натисніть <b>+</b> у правому нижньому куті. Оберіть назву, іконку та тип:</div>
      <div class="habits-guide-types">
        <div class="habits-guide-type">
          <span class="habits-guide-badge good">Корисна</span>
          <span>— звичка, яку потрібно виконувати (спорт, читання)</span>
        </div>
        <div class="habits-guide-type">
          <span class="habits-guide-badge bad">Шкідлива</span>
          <span>— звичка, від якої потрібно відмовитися (солодощі, паління)</span>
        </div>
      </div>
    </div>
    <div class="habits-guide-section">
      <div class="habits-guide-subtitle">Позначення клітинок</div>
      <div class="habits-guide-cells">
        <div class="habits-guide-cell-row">
          <span class="habits-guide-cell good-done"></span>
          <span class="habits-guide-label"><b>Лівий клік</b> — виконано (корисна) / зірвався (шкідлива)</span>
        </div>
        <div class="habits-guide-cell-row">
          <span class="habits-guide-cell good-skipped"></span>
          <span class="habits-guide-label"><b>Правий клік</b> — пропущено (корисна) / втримався (шкідлива)</span>
        </div>
        <div class="habits-guide-cell-row">
          <span class="habits-guide-cell good-half"></span>
          <span class="habits-guide-label"><b>Середній клік</b> — виконано наполовину</span>
        </div>
      </div>
    </div>
    <div class="habits-guide-section">
      <div class="habits-guide-subtitle">Додатково</div>
      <div class="habits-guide-text">Натисніть на іконку або назву звички — можна редагувати. Перетягуйте звички за <b>⋮⋮</b> для зміни порядку. Правий клік по картці — контекстне меню.</div>
    </div>
    <div class="habits-guide-footer">
      <label class="habits-guide-ack">
        <input type="checkbox" id="habitsGuideAck" onchange="onGuideAckChange()">
        <span>Я ознайомився. Обіцяю виконувати</span>
      </label>
      <button class="habits-guide-hide" type="button" id="habitsGuideHideBtn" disabled onclick="hideBeginnerGuideForever()"><span class="btn-inner">Почати</span></button>
    </div>
  </div>
</div>`;
}
