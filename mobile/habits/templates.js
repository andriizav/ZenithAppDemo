/* ========== HTML TEMPLATES ========== */

const REMINDER_BELL_SVG = `${ICON('bellAlt', 20)}`;
const REMINDER_CLOCK_SVG = `${ICON('clock', 18)}`;

function tplReminderBlock({ enabledId, timeId, wrapId, which }) {
  return `
    <div class="reminder-block">
      <div class="reminder-card">
        <div class="reminder-card-icon" aria-hidden="true">${REMINDER_BELL_SVG}</div>
        <div class="reminder-card-info">
          <div class="reminder-card-title">Нагадування</div>
          <div class="reminder-card-sub">Щоденне сповіщення про звичку</div>
        </div>
        <label class="reminder-switch" title="Увімкнути нагадування">
          <input type="checkbox" id="${enabledId}" onchange="toggleReminderTime('${which}')">
          <span class="reminder-switch-track"><span class="reminder-switch-thumb"></span></span>
        </label>
      </div>
      <div class="reminder-time-wrap" id="${wrapId}">
        <div class="reminder-time-label">Час сповіщення</div>
        <div class="reminder-time-field">
          <span class="reminder-time-icon" aria-hidden="true">${REMINDER_CLOCK_SVG}</span>
          <input type="time" id="${timeId}" class="reminder-time-input" value="09:00">
        </div>
      </div>
    </div>`;
}

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
    ${ICON('barChart', 24)}
  </button>
  <button class="notification-btn" onclick="testNotification()" title="Тест сповіщень">
    ${ICON('bell', 20)}
  </button>
  <button class="archive-btn" onclick="openTrashModal()" title="Смітник">
    ${ICON('trashOutline', 20)}
  </button>
  <button class="settings-btn" onclick="openHabitsSettingsModal()" title="Параметри">
    ${ICON('bolt', 24)}
  </button>
  <button class="add-btn" onclick="openModal()" title="Додати звичку">
    ${ICON('plus', 24)}
  </button>
</div>`;
}

function tplNewHabitModal() {
  return `
<div class="settings-modal habit-edit-modal" id="modal" style="display: none;">
  <div class="settings-modal-content edit-modal-content" role="dialog" aria-modal="true">
    <div class="notes-modal-header">
      <h3>Нова звичка</h3>
      <button class="notes-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
    </div>
    <div class="notes-modal-body">
    <div class="modal-section-label">Назва</div>
    <div class="edit-habit-name-wrapper">
      <input type="text" id="habitName" class="edit-habit-name-input" placeholder="наприклад, Спорт" maxlength="30">
    </div>
    <div class="modal-section-label">Іконка</div>
    <div class="icon-picker" id="iconPicker"></div>
    <div class="modal-section-label">Колір</div>
    <div class="color-picker" id="colorPicker"></div>
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
    ${tplReminderBlock({ enabledId: "reminderEnabled", timeId: "reminderTime", wrapId: "reminderTimeWrap", which: "new" })}
    </div>
    <div class="notes-modal-footer">
      <button class="modal-btn modal-btn--secondary modal-btn--block" data-close>Скасувати</button>
      <button class="modal-btn modal-btn--primary modal-btn--block" onclick="saveHabit()">Зберегти</button>
    </div>
  </div>
</div>`;
}

function tplEditHabitModal() {
  return `
<div class="settings-modal habit-edit-modal" id="editModal" style="display: none;">
  <div class="notes-modal-content edit-modal" role="dialog" aria-modal="true">
    <div class="notes-modal-header">
      <h3>Редагування звички</h3>
      <button class="notes-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
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
    ${tplReminderBlock({ enabledId: "editReminderEnabled", timeId: "editReminderTime", wrapId: "editReminderTimeWrap", which: "edit" })}
    </div>
    <div class="notes-modal-footer">
      <button class="modal-btn modal-btn--icon" onclick="openArchiveFromEditModal()" title="Видалити звичку">${ICON('trash2', 16)}</button>
      <button class="modal-btn modal-btn--secondary" data-close>Скасувати</button>
      <button class="modal-btn modal-btn--primary" onclick="saveEditHabit()">Зберегти</button>
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
      <button class="modal-btn modal-btn--secondary" onclick="closeStatsModal()">Закрити</button>
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
${tplStatsModal()}`;
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
  <p style="font-size: 13px;">Натисніть на <b class="plus-highlight" onclick="openModal()" style="cursor: pointer;">+</b>, щоб додати першу звичку.</p>
</div>`;
}

function tplBeginnerGuide() {
  return `
<div class="habits-guide" id="habitsGuide">
  <div class="habits-guide-header" onclick="toggleBeginnerGuide()">
    <span class="habits-guide-icon">${ICON('info', 18)}</span>
    <span class="habits-guide-title">Інструкція користувача</span>
    <span class="habits-guide-chevron">${ICON('chevronDown', 16)}</span>
  </div>
  <div class="habits-guide-body">
    <div class="habits-guide-section">
      <div class="habits-guide-subtitle">Створення звички</div>
      <div class="habits-guide-text">Натисніть <b>+</b> внизу. Оберіть назву, іконку та тип:</div>
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
          <span class="habits-guide-label"><b>Тап</b> — виконано (корисна) / зірвався (шкідлива)</span>
        </div>
        <div class="habits-guide-cell-row">
          <span class="habits-guide-cell good-skipped"></span>
          <span class="habits-guide-label"><b>Подвійний тап</b> — пропущено (корисна) / втримався (шкідлива)</span>
        </div>
        <div class="habits-guide-cell-row">
          <span class="habits-guide-cell good-half"></span>
          <span class="habits-guide-label"><b>Довгий тап</b> — виконано наполовину</span>
        </div>
      </div>
    </div>
    <div class="habits-guide-section">
      <div class="habits-guide-subtitle">Додатково</div>
      <div class="habits-guide-text">
        <p>Натисніть на назву звички — її можна редагувати.</p>
        <p>Довгий тап по картці відкриває контекстне меню.</p>
        <p>Тап по цитаті оновлює її. Відображення цитат можна вимкнути в налаштуваннях.</p>
      </div>
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
