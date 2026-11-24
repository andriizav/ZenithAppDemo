/* ========== MODAL FUNCTIONS ========== */

// These functions expect the following globals from the main file:
// - habits (array of habit objects)
// - ICONS (array of icon objects)
// - selectedIcon (selected icon object)
// - editingHabitId (ID of habit being edited)
// - editSelectedIcon (selected icon for editing)
// - habitToDelete (ID of habit to delete)
// - saveHabits() (function)
// - renderHabits() (function)

function renderIconPicker() {
  const picker = document.getElementById("iconPicker");
  if (!picker) return;
  picker.innerHTML = ICONS.map(
    (icon) => `
    <div class="icon-option ${icon.id === selectedIcon.id ? "selected" : ""}" onclick="selectIcon('${icon.id}')">
      ${icon.svg}
    </div>
  `,
  ).join("");
}

function renderEditIconPicker() {
  const picker = document.getElementById("editIconPicker");
  if (!picker) return;
  picker.innerHTML = ICONS.map(
    (icon) => `
    <div class="icon-option ${icon.id === editSelectedIcon.id ? "selected" : ""}" onclick="selectEditIcon('${icon.id}')">
      ${icon.svg}
    </div>
  `,
  ).join("");
}

function renderColorPicker() {
  const picker = document.getElementById("colorPicker");
  if (!picker) return;
  picker.innerHTML = `
    <div class="color-option color-option--none ${selectedCategoryColor === "" ? "selected" : ""}"
         onclick="selectCategoryColor('')" title="Без кольору">
      ${ICON('close', 12, { strokeWidth: 2.5 })}
    </div>
  ` + CATEGORY_COLORS.map(
    (color) => `
    <div class="color-option ${color === selectedCategoryColor ? "selected" : ""}"
         style="background: ${color}"
         onclick="selectCategoryColor('${color}')">
    </div>
  `,
  ).join("");
}

function renderEditColorPicker() {
  const picker = document.getElementById("editColorPicker");
  if (!picker) return;
  picker.innerHTML = `
    <div class="color-option color-option--none ${editSelectedCategoryColor === "" ? "selected" : ""}"
         onclick="selectEditCategoryColor('')" title="Без кольору">
      ${ICON('close', 12, { strokeWidth: 2.5 })}
    </div>
  ` + CATEGORY_COLORS.map(
    (color) => `
    <div class="color-option ${color === editSelectedCategoryColor ? "selected" : ""}"
         style="background: ${color}"
         onclick="selectEditCategoryColor('${color}')">
    </div>
  `,
  ).join("");
}

function selectCategoryColor(color) {
  selectedCategoryColor = color;
  renderColorPicker();
}

function selectEditCategoryColor(color) {
  editSelectedCategoryColor = color;
  renderEditColorPicker();
  const card = document.querySelector(`.habit[data-habit-id="${editingHabitId}"]`);
  if (!card) return;
  if (color) {
    card.classList.add("has-category");
  } else {
    card.classList.remove("has-category");
  }
  if (color) {
    card.style.setProperty("--category-color", color);
    card.style.setProperty("--good-cell", color);
    card.style.setProperty("--bad-cell", color);
    card.style.setProperty("--half-color", color);
  } else {
    card.style.removeProperty("--category-color");
    card.style.removeProperty("--good-cell");
    card.style.removeProperty("--bad-cell");
    card.style.removeProperty("--half-color");
  }
  const checkbox = card.querySelector(".habit-checkbox");
  if (checkbox) {
    if (color) {
      checkbox.style.setProperty("background-color", color);
      checkbox.style.setProperty("border-color", color);
    } else {
      checkbox.style.removeProperty("background-color");
      checkbox.style.removeProperty("border-color");
    }
  }
}

function selectIcon(iconId) {
  selectedIcon = ICONS.find((icon) => icon.id === iconId);
  renderIconPicker();
}

function selectEditIcon(iconId) {
  editSelectedIcon = ICONS.find((icon) => icon.id === iconId);
  renderEditIconPicker();
}

function lockBodyScroll() {
  document.body.classList.add("modal-open");
}

function unlockBodyScroll() {
  document.body.classList.remove("modal-open");
}

function toggleReminderTime(which) {
  const enabledId = which === "edit" ? "editReminderEnabled" : "reminderEnabled";
  const wrapId = which === "edit" ? "editReminderTimeWrap" : "reminderTimeWrap";
  const enabledEl = document.getElementById(enabledId);
  const wrap = document.getElementById(wrapId);
  if (!enabledEl || !wrap) return;
  wrap.classList.toggle("is-open", enabledEl.checked);
}

function openModal() {
  document.body.classList.add("settings-modal-open");
  document.getElementById("modal").style.display = "flex";
  document.getElementById("habitName").value = "";
  document.getElementById("reminderEnabled").checked = false;
  document.getElementById("reminderTimeWrap").classList.remove("is-open");
  document.getElementById("reminderTime").value = "09:00";
  // Reset type to 'good'
  const typeGood = document.querySelector(
    'input[name="habitType"][value="good"]',
  );
  if (typeGood) typeGood.checked = true;
  selectedCategoryColor = "";
  renderColorPicker();
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  document.body.classList.remove("settings-modal-open");
}

function openEditModal(habitId) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  editingHabitId = habitId;
  editSelectedIcon = ICONS.find((icon) => icon.id === habit.icon) || ICONS[0];
  document.getElementById("editHabitName").value = habit.name;
  renderEditIconPicker();

  // Встановлюємо значення типу
  const type = habit.type || "good";
  document.querySelector(
    `input[name="editHabitType"][value="${type}"]`,
  ).checked = true;

  // Встановлюємо колір
  editSelectedCategoryColor = habit.category?.color || "";
  renderEditColorPicker();

  // Встановлюємо значення нагадувань
  document.getElementById("editReminderEnabled").checked =
    habit.reminderEnabled || false;
  document.getElementById("editReminderTime").value =
    habit.reminderTime || "09:00";

  document
    .getElementById("editReminderTimeWrap")
    .classList.toggle("is-open", !!habit.reminderEnabled);

  document.body.classList.add("settings-modal-open");
  document.getElementById("editModal").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
  document.body.classList.remove("settings-modal-open");
  editingHabitId = null;
  // Повертаємо картку до збереженого кольору (скасовуємо live-прев'ю).
  if (typeof scheduleRenderHabits === "function") scheduleRenderHabits();
}

function openDeleteHabitModal(habitId) {
  habitToDelete = habitId;
  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  const habit = archived.find((h) => h.id === habitId);
  if (typeof window.openDeleteModal === 'function') {
    window.openDeleteModal({
      title: 'Видалити звичку',
      name: habit ? habit.name : '',
      text: 'Цю дію неможливо скасувати. Всю історію виконання буде втрачено.',
      confirmLabel: 'Видалити',
      dangerClass: 'modal-btn--danger',
      onConfirm: confirmDelete
    });
  }
}

function closeDeleteModal() {
  habitToDelete = null;
}

function confirmDelete() {
  if (habitToDelete === null) return;
  gistAddDeletedId('habits', habitToDelete);
  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  const updated = archived.filter((h) => h.id !== habitToDelete);
  localStorage.setItem("habitsArchived", JSON.stringify(updated));
  closeDeleteModal();
  openTrashModal();
}

function saveHabit() {
  const name = document.getElementById("habitName").value.trim();
  if (!name) return;

  const reminderEnabled = document.getElementById("reminderEnabled").checked;
  const reminderTime = document.getElementById("reminderTime").value;
  const typeInput = document.querySelector('input[name="habitType"]:checked');
  const type = typeInput ? typeInput.value : "good";

  const habit = {
    id: Date.now(),
    name,
    icon: selectedIcon.id,
    type: type || "good",
    dates: [],
    skippedDates: [],
    category: selectedCategoryColor ? { color: selectedCategoryColor } : null,
    reminderEnabled,
    reminderTime: reminderEnabled ? reminderTime : reminderTime || null,
    notes: {},
  };

  habits.push(habit);
  saveHabits();
  closeModal();
  scheduleRenderHabits();
}

function saveEditHabit() {
  const name = document.getElementById("editHabitName").value.trim();
  if (!name || !editingHabitId) return;

  const habit = habits.find((h) => h.id === editingHabitId);
  if (habit) {
    habit.name = name;
    habit.icon = editSelectedIcon.id;
    habit.type = document.querySelector(
      'input[name="editHabitType"]:checked',
    ).value;

    // Зберігаємо колір
    habit.category = editSelectedCategoryColor ? { color: editSelectedCategoryColor } : null;

    const reminderEnabled = document.getElementById(
      "editReminderEnabled",
    ).checked;
    const reminderTime = document.getElementById("editReminderTime").value;

    habit.reminderEnabled = reminderEnabled;
    // Зберігаємо час нагадування навіть якщо вимкнено, щоб не загубити попереднє значення
    if (reminderEnabled) {
      habit.reminderTime = reminderTime;
    }
    // Якщо вимкнено і час не було встановлено, залишаємо null, інакше зберігаємо поточне значення інпуту
    else if (reminderTime) {
      habit.reminderTime = reminderTime;
    }

    saveHabits();
  }
  closeEditModal();
  scheduleRenderHabits();
}

function openArchiveFromEditModal() {
  if (!editingHabitId) return;
  const idToDelete = editingHabitId;
  closeEditModal();
  openSoftDeleteModal(idToDelete);
}

function openSoftDeleteModal(habitId) {
  habitToArchive = habitId;
  const habit = habits.find((h) => h.id === habitId);
  if (typeof window.openDeleteModal === 'function') {
    window.openDeleteModal({
      title: 'Видалити звичку',
      name: habit ? habit.name : '',
      text: 'Звичку буде переміщено до кошика. Її можна відновити у будь-який момент.',
      confirmLabel: 'Видалити',
      dangerClass: 'modal-btn--danger',
      onConfirm: confirmSoftDelete
    });
  }
}

function closeSoftDeleteModal() {
  habitToArchive = null;
}

function confirmSoftDelete() {
  if (habitToArchive === null) return;
  const habit = habits.find((h) => h.id === habitToArchive);
  if (!habit) {
    closeSoftDeleteModal();
    return;
  }
  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  archived.push({ ...habit, archivedAt: new Date().toISOString() });
  localStorage.setItem("habitsArchived", JSON.stringify(archived));

  habits = habits.filter((h) => h.id !== habitToArchive);
  if (habit && habit.id !== undefined) {
    gistAddDeletedId('habits', habit.id);
  }
  saveHabits();
  scheduleRenderHabits();
  closeSoftDeleteModal();
}

function toggleReminderTimeInput(checkboxId, timeInputId) {
  const checkbox = document.getElementById(checkboxId);
  const timeInput = document.getElementById(timeInputId);
  if (checkbox && timeInput) {
    timeInput.style.display = checkbox.checked ? "block" : "none";
  }
}

// ========== TRASH FUNCTIONS ==========
// Вікно смітника використовує той самий каркас, що й налаштування
// (.settings-modal / .settings-modal-* у css/components/modal.css), щоб виглядати
// ідентично до вікна налаштувань.

function openTrashModal() {
  const trashBtn = document.querySelector(".habits-actions .archive-btn");

  if (document.getElementById("trashModal")) {
    closeTrashModal();
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "settings-modal";
  overlay.id = "trashModal";
  overlay.innerHTML = `
    <div class="settings-modal-content" role="dialog" aria-modal="true">
      <div class="settings-modal-header">
        <h3>Смітник</h3>
        <span class="archive-count" id="trashCount">0</span>
        <button class="settings-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
      </div>
      <div class="settings-modal-body">
        <div class="archive-list" id="trashList"></div>
      </div>
      <div class="settings-modal-footer">
        ${window.modalButton ? modalButton({ label: 'Закрити', variant: 'secondary', close: true }) : '<button class="modal-btn modal-btn--secondary" data-close>Закрити</button>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add("settings-modal-open");

  overlay.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", closeTrashModal)
  );
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeTrashModal();
  });

  refreshTrashModal();
}

function refreshTrashModal() {
  const list = document.getElementById("trashList");
  const count = document.getElementById("trashCount");
  if (!list || !count) return;

  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  count.textContent = archived.length;

  if (archived.length === 0) {
    list.innerHTML = `
      <div class="archive-empty">
        <div class="archive-empty-icon">
          ${ICON('trashOutline', 44, { strokeWidth: 1.6 })}
        </div>
        <div class="archive-empty-text">Смітник порожній</div>
        <div class="archive-empty-sub">Видалені звички з'являться тут</div>
      </div>`;
  } else {
    list.innerHTML = archived
      .map(
        (h) => `
      <div class="archive-item" ${h.category?.color ? `style="--cat-color:${h.category.color}"` : ""}>
        <div class="archive-item-icon">${ICONS.find((i) => i.id === h.icon)?.svg || ICONS[0].svg}</div>
        <div class="archive-item-info">
          <div class="archive-item-name">${h.name}</div>
          <div class="archive-item-date">У смітнику: ${new Date(h.archivedAt).toLocaleDateString("uk-UA")}</div>
        </div>
        <button class="archive-restore-btn" onclick="restoreFromTrash(${h.id})" title="Відновити">
          ${ICON('refreshCcw', 16)}
        </button>
        <button class="archive-delete-btn" onclick="deleteFromTrash(${h.id})" title="Видалити назавжди">
          ${ICON('trashSimple', 16)}
        </button>
      </div>
    `,
      )
      .join("");
  }
}

function closeTrashModal() {
  const modal = document.getElementById("trashModal");
  if (modal) modal.remove();
  document.body.classList.remove("settings-modal-open");
  const trashBtn = document.querySelector(".habits-actions .archive-btn");
  if (trashBtn) trashBtn.classList.remove("is-active");
}

function restoreFromTrash(habitId) {
  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  const habit = archived.find((h) => h.id === habitId);
  if (!habit) return;

  // Видаляємо зі смітника
  const updated = archived.filter((h) => h.id !== habitId);
  localStorage.setItem("habitsArchived", JSON.stringify(updated));

  // Додаємо до активних
  const { archivedAt, ...rest } = habit;
  habits.push(rest);
  saveHabits();
  scheduleRenderHabits();
  openTrashModal(); // Оновлюємо список
}

function deleteFromTrash(habitId) {
  openDeleteHabitModal(habitId);
}
