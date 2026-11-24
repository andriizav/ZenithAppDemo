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
  // Живий попередній перегляд: одразу міняємо колір на картці, не чекаючи збереження.
  // Клітинки heatmap мають власний inline --category-color, тому оновлюємо
  // і картку, і кожну клітинку окремо.
  const card = document.querySelector(`.habit[data-habit-id="${editingHabitId}"]`);
  if (!card) return;
  const cells = card.querySelectorAll(".cell");
  if (color) {
    card.style.setProperty("--category-color", color);
    card.classList.add("has-category");
    cells.forEach((c) => c.style.setProperty("--category-color", color));
  } else {
    card.style.removeProperty("--category-color");
    card.classList.remove("has-category");
    cells.forEach((c) => c.style.removeProperty("--category-color"));
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

function openModal() {
  document.getElementById("modal").classList.add("open");
  document.getElementById("habitName").value = "";
  document.getElementById("reminderEnabled").checked = false;
  document.getElementById("reminderTime").style.display = "none";
  document.getElementById("reminderTime").value = "09:00";
  // Reset type to 'good'
  const typeGood = document.querySelector(
    'input[name="habitType"][value="good"]',
  );
  if (typeGood) typeGood.checked = true;
  selectedCategoryColor = "";
  renderColorPicker();
  document.getElementById("habitName").focus();
}

function closeModal() {
  document.getElementById("modal").classList.remove("open");
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

  if (habit.reminderEnabled) {
    document.getElementById("editReminderTime").style.display = "block";
  } else {
    document.getElementById("editReminderTime").style.display = "none";
  }

  document.getElementById("editModal").classList.add("open");
  document.getElementById("editHabitName").focus();
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("open");
  editingHabitId = null;
  // Повертаємо картку до збереженого кольору (скасовуємо live-прев'ю).
  if (typeof scheduleRenderHabits === "function") scheduleRenderHabits();
}

function openHabitDeleteModal(habitId) {
  habitToDelete = habitId;
  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  const habit = archived.find((h) => h.id === habitId);
  const nameEl = document.getElementById("deleteHabitName");
  if (nameEl) nameEl.textContent = habit ? habit.name : "";
  document.getElementById("deleteModal").classList.add("open");
}

function closeDeleteModal() {
  document.getElementById("deleteModal").classList.remove("open");
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
  const nameEl = document.getElementById("softDeleteHabitName");
  if (nameEl) nameEl.textContent = habit ? habit.name : "";
  document.getElementById("softDeleteModal").classList.add("open");
}

function closeSoftDeleteModal() {
  document.getElementById("softDeleteModal").classList.remove("open");
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

function openTrashModal() {
  const archived = JSON.parse(localStorage.getItem("habitsArchived") || "[]");
  const list = document.getElementById("trashList");
  const count = document.getElementById("trashCount");
  if (count) count.textContent = archived.length;

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

  document.getElementById("trashModal").classList.add("open");
}

function closeTrashModal() {
  document.getElementById("trashModal").classList.remove("open");
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
  openHabitDeleteModal(habitId);
}

// ========== CLICK OUTSIDE TO CLOSE ==========

["deleteModal", "softDeleteModal"].forEach((id) => {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) {
      if (id === "deleteModal") closeDeleteModal();
      else closeSoftDeleteModal();
    }
  });
});
