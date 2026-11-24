/* ========== HABITS TRACKER ========== */

var habits = [];
let habitToDelete = null;
let habitToArchive = null;

function toggleBeginnerGuide() {
  const guide = document.getElementById("habitsGuide");
  if (!guide) return;
  guide.classList.toggle("open");
  try {
    localStorage.setItem("habitsGuideOpen", guide.classList.contains("open") ? "1" : "0");
  } catch (e) {}
}

function hideBeginnerGuideForever() {
  try {
    localStorage.setItem("habitsGuideHidden", "1");
  } catch (e) {}
  playSuccessSound();
  if (typeof timerCelebrate === "function") timerCelebrate();
  const guide = document.getElementById("habitsGuide");
  if (guide) guide.remove();
}

function onGuideAckChange() {
  const ack = document.getElementById("habitsGuideAck");
  const btn = document.getElementById("habitsGuideHideBtn");
  if (ack && btn) btn.disabled = !ack.checked;
}

function showBeginnerGuide() {
  try {
    localStorage.removeItem("habitsGuideHidden");
  } catch (e) {}
  if (typeof closeModal === "function") closeModal();
  let guide = document.getElementById("habitsGuide");
  if (!guide) {
    const quote = document.getElementById("habitsQuote");
    if (quote && typeof tplBeginnerGuide === "function") {
      quote.insertAdjacentHTML("afterend", tplBeginnerGuide());
    }
    guide = document.getElementById("habitsGuide");
  }
  if (guide) {
    guide.classList.add("open");
    try {
      localStorage.setItem("habitsGuideOpen", "1");
    } catch (e) {}
    guide.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Перевіряємо цілісність даних при завантаженні
try {
  const stored = localStorage.getItem("habits");
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      habits = parsed;
    }
  }
} catch (e) {
  console.error("Error loading habits from localStorage:", e);
  habits = [];
}

// Перевіряємо чи потрібно мігрувати (schema versioning)
const HABITS_SCHEMA_VERSION = 3;
const storedSchemaVersion = parseInt(localStorage.getItem("habitsSchemaVersion") || "0", 10);

if (storedSchemaVersion < HABITS_SCHEMA_VERSION) {
  let migrated = false;

  // Міграція v1: emoji -> icon ID, halfDates, type, cleanDates, category
  if (storedSchemaVersion < 1) {
    habits = habits.map((habit) => {
      let changed = false;
      if (typeof habit.icon === "string" && emojiToIconMap[habit.icon]) {
        habit = { ...habit, icon: emojiToIconMap[habit.icon] };
        changed = true;
      }
      if (!habit.halfDates) { habit = { ...habit, halfDates: [] }; changed = true; }
      if (!habit.type) { habit = { ...habit, type: "good" }; changed = true; }
      if (!habit.cleanDates) { habit = { ...habit, cleanDates: [] }; changed = true; }
      if (!habit.category) { habit = { ...habit, category: null }; changed = true; }
      if (changed) migrated = true;
      return habit;
    });
  }

  // Міграція v2: skippedDates, reminderEnabled, reminderTime
  if (storedSchemaVersion < 2) {
    habits = habits.map((habit) => {
      let changed = false;
      if (!Array.isArray(habit.skippedDates)) {
        habit = { ...habit, skippedDates: [] };
        changed = true;
      }
      if (typeof habit.reminderEnabled !== "boolean") {
        habit = { ...habit, reminderEnabled: false };
        changed = true;
      }
      if (habit.reminderTime === undefined) {
        habit = { ...habit, reminderTime: null };
        changed = true;
      }
      if (changed) migrated = true;
      return habit;
    });
  }

  // Міграція v3: notes для дат
  if (storedSchemaVersion < 3) {
    habits = habits.map((habit) => {
      if (!habit.notes) {
        habit = { ...habit, notes: {} };
        migrated = true;
      }
      return habit;
    });
  }

  if (migrated) {
    localStorage.setItem("habits", JSON.stringify(habits));
  }
  localStorage.setItem("habitsSchemaVersion", HABITS_SCHEMA_VERSION);
}
let selectedIcon = ICONS[0];
let editingHabitId = null;
let editSelectedIcon = ICONS[0];
let draggedHabitId = null;

const CATEGORY_COLORS = [
  "#e74c3c", "#ff6b6b",
  "#e67e22", "#f5a623",
  "#f9ca24", "#fdcb6e",
  "#2ecc71", "#00b894",
  "#1abc9c", "#00cec9",
  "#3498db", "#5b9cf5",
  "#6c5ce7", "#9b59b6",
  "#e84393", "#fd79a8",
  "#636e72", "#b2bec3"
];
let selectedCategoryColor = "";
let editSelectedCategoryColor = "";

let _habitsInitialized = false;
let _renderScheduled = false;

function scheduleRenderHabits() {
  if (!_renderScheduled) {
    _renderScheduled = true;
    requestAnimationFrame(() => {
      _renderScheduled = false;
      renderHabits();
    });
  }
}

// Легке оновлення лише чекбоксу і клітинки heatmap без повного перерендерингу
function updateHabitCheckbox(habitId, dateStr, isDone, isSkipped, isHalf, isClean, habitType, categoryColor) {
  const card = document.querySelector(`.habit[data-habit-id="${habitId}"]`);
  if (!card) return;

  // Оновлюємо чекбокс
  // Велика клітинка пов'язана з клітинкою, що ПОЗНАЧЕНА як сьогоднішня
  // у heatmap (.cell.today), а не з календарним «сьогодні» — щоб врахувати
  // затримку в часі (вночі показує вчора). Беремо дату прямо з DOM.
  const habit = habits.find((h) => h.id === habitId);
  const todayCell = card.querySelector(".cell.today");
  const todayStr = (todayCell && todayCell.dataset.dateRaw) || getLocalDateStr();
  const isDoneToday = habit ? habit.dates.includes(todayStr) : false;
  const isSkippedToday = habit ? (habit.skippedDates && habit.skippedDates.includes(todayStr)) : false;
  const isHalfToday = habit ? (habit.halfDates && habit.halfDates.includes(todayStr)) : false;
  const isCleanToday = habit ? (habitType === "bad" && habit.cleanDates && habit.cleanDates.includes(todayStr) && !isDoneToday && !isSkippedToday) : false;

  const checkbox = card.querySelector(".habit-checkbox");
  if (checkbox) {
    checkbox.classList.remove("done", "skipped", "clean", "half", "half-v1", "half-v2", "half-v3", "half-v4", "half-v5", "half-v6", "half-v7", "half-v8", "half-v9", "half-v10", "half-v11", "half-v12", "good-checkbox", "bad-checkbox");
    checkbox.classList.add(habitType === "bad" ? "bad-checkbox" : "good-checkbox");
    if (isDoneToday) checkbox.classList.add("done");
    if (isSkippedToday) checkbox.classList.add("skipped");
    if (isHalfToday) {
      checkbox.classList.add("half");
      checkbox.classList.add(getHalfStyleClass());
    }
    if (isCleanToday) checkbox.classList.add(habitType === "bad" ? "skipped" : "clean");

    const style = ((isDoneToday && habitType !== "bad") || (isCleanToday && habitType === "bad")) && categoryColor
      ? `background-color: ${categoryColor}; border-color: ${categoryColor};`
      : (isHalfToday ? `--half-color: ${categoryColor || "#388bfd"};` : "");
    checkbox.setAttribute("style", style);

    checkbox.innerHTML = renderCheckboxIcon(isDoneToday, isSkippedToday, isHalfToday, isCleanToday, habitType);
  }

  // Оновлюємо клітинку в heatmap
  const cell = card.querySelector(`.cell[data-date-raw="${dateStr}"]`);
  if (cell && !cell.classList.contains("padding")) {
    const today = new Date().toISOString().split("T")[0];
    const isFuture = dateStr > today;
    cell.classList.remove("active", "skipped", "half", "half-v1", "half-v2", "half-v3", "half-v4", "half-v5", "half-v6", "half-v7", "half-v8", "half-v9", "half-v10", "half-v11", "half-v12", "clean", "future");
    if (isDone) cell.classList.add("active");
    if (isSkipped) cell.classList.add("skipped");
    if (isHalf) {
      cell.classList.add("half");
      cell.classList.add(getHalfStyleClass());
    }
    if (isClean) cell.classList.add(habitType === "bad" ? "skipped" : "clean");
    if (isFuture) cell.classList.add("future");

    if (categoryColor) {
      if (habitType === "bad" && isClean) {
        cell.style.cssText = `background: ${categoryColor}47; border-color: ${categoryColor}; box-shadow: 0 0 4px ${categoryColor}80; --half-color: ${categoryColor};`;
      } else if (isDone) {
        cell.style.cssText = `background: ${categoryColor}; border-color: transparent !important; --half-color: ${categoryColor};`;
      } else if (cell.classList.contains("half")) {
        // Колір категорії для half береться з CSS-змінної --half-color,
        // тому достатньо лише встановити її (варіант стилю керує фоном).
        // Рамку залишаємо видимою (без border-color: transparent).
        cell.style.cssText = `--half-color: ${categoryColor};`;
      } else {
        cell.style.cssText = "";
      }
    } else {
      cell.style.cssText = "";
    }

    cell.setAttribute("data-active", isDone);
    cell.setAttribute("data-skipped", isSkipped);
    cell.setAttribute("data-half", isHalf);
    cell.setAttribute("data-clean", isClean);
  }

  // Оновлюємо стрік badge
  if (habit) {
    const streak = typeof getStreakCached === "function"
      ? getStreakCached(habit.id, habit.dates, habit.skippedDates, habit.type, habit.halfDates)
      : (typeof getStreak === "function" ? getStreak(habit.dates, habit.skippedDates, habit.type, habit.halfDates) : 0);
    const brokenStreak = streak === 0 && typeof getBrokenStreakCached === "function"
      ? getBrokenStreakCached(habit.id, habit.dates, habit.skippedDates, habit.type, habit.halfDates)
      : (typeof getBrokenStreak === "function" ? getBrokenStreak(habit.dates, habit.skippedDates, habit.type, habit.halfDates) : 0);
    const showBrokenStreak = brokenStreak > 1;

    const streakBadge = card.querySelector(".streak-badge");
    if (streakBadge) {
      streakBadge.outerHTML = renderStreakBadge(streak, brokenStreak, showBrokenStreak, habitType);
    }

    // Для шкідливих звичок «clean» дні (коли тримався) обчислюються
    // динамічно з усіх active-дат і показуються як skipped. Коли змінюється
    // одна клітинка, решта clean-клітинок теж має оновитись одразу,
    // інакше вони перемалюються лише після повного ререндеру (оновлення сторінки).
    if (habitType === "bad") {
      refreshBadHabitCleanCells(habitId);
    }
  }
}

// Перераховує класи/стиль усіх клітинок heatmap шкідливої звички,
// щоб «clean» дні (дні без зриву між active-датами) показувались одразу.
function refreshBadHabitCleanCells(habitId) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit || (habit.type || "good") !== "bad") return;

    const card = document.querySelector(`.habit[data-habit-id="${habitId}"]`);
    if (!card) return;

    const today = new Date().toISOString().split("T")[0];
    const cleanDatesSet = typeof computeCleanDatesSet === "function"
      ? computeCleanDatesSet(habit, today)
      : new Set();
    const datesSet = new Set(habit.dates);
    const skippedSet = new Set(habit.skippedDates || []);
    const halfSet = new Set(habit.halfDates || []);
    const categoryColor = habit.category?.color || "";

    card.querySelectorAll(".cell").forEach((cell) => {
      if (cell.classList.contains("padding")) return;
      const dateStr = cell.dataset.dateRaw;
      if (!dateStr) return;

      const isFuture = dateStr > today;
      const isActive = datesSet.has(dateStr);
      const isSkipped = skippedSet.has(dateStr);
      const isHalf = halfSet.has(dateStr);
      const isClean = cleanDatesSet.has(dateStr) && !isActive && !isSkipped;

      cell.classList.remove(
        "active", "skipped", "half",
        "half-v1", "half-v2", "half-v3", "half-v4", "half-v5",
        "half-v6", "half-v7", "half-v8", "half-v9", "half-v10", "half-v11", "half-v12",
        "clean", "future"
      );
      if (isActive) cell.classList.add("active");
      if (isSkipped) cell.classList.add("skipped");
      if (isHalf) {
        cell.classList.add("half");
        cell.classList.add(getHalfStyleClass());
      }
      // Для шкідливих звичок clean візуально = skipped
      if (isClean) cell.classList.add("skipped");
      if (isFuture) cell.classList.add("future");

      if (categoryColor) {
        if (isClean) {
          cell.style.cssText = `background: ${categoryColor}47; border-color: ${categoryColor}; box-shadow: 0 0 4px ${categoryColor}80; --half-color: ${categoryColor};`;
        } else if (isActive) {
          cell.style.cssText = `background: ${categoryColor}; border-color: transparent !important; --half-color: ${categoryColor};`;
        } else if (cell.classList.contains("half")) {
          cell.style.cssText = `--half-color: ${categoryColor};`;
        } else {
          cell.style.cssText = "";
        }
      } else {
        cell.style.cssText = "";
      }

      cell.setAttribute("data-active", isActive);
      cell.setAttribute("data-skipped", isSkipped);
      cell.setAttribute("data-half", isHalf);
      cell.setAttribute("data-clean", isClean);
    });
  }

function initHabits() {
  const output = document.getElementById("output-habits");
  if (!output) return Promise.resolve();

  if (_habitsInitialized) {
    scheduleRenderHabits();
    return Promise.resolve();
  }

  function loadCSS() {
    // CSS уже підключений у index.html (в <head>), тому додатково
    // чекати на нього не треба — це лише додавало затримку на рендер.
    return Promise.resolve();
  }

  const loadModule = (src) => {
    return new Promise((resolve, reject) => {
      // Дедуп за базовим шляхом: core-список додає скрипти з суфіксом
      // ?v=..., тому порівнюємо src без query-рядка, інакше модуль
      // завантажується вдруге і падає з "redeclaration of let".
      const baseSrc = src.split("?")[0];
      const alreadyLoaded = Array.from(document.querySelectorAll("script[src]"))
        .some((s) => (s.getAttribute("src") || "").split("?")[0] === baseSrc);
      if (alreadyLoaded) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const initPromise = loadCSS().then(() => {
    return Promise.all([
      loadModule("habits/templates.js"),
      loadModule("habits/habit-card.js"),
      loadModule("habits/ui-tools.js"),
      loadModule("habits/modals.js"),
      loadModule("habits/data-manager.js"),
      loadModule("habits/statistics.js"),
      loadModule("habits/habit-interactions.js"),
      loadModule("habits/date-utils.js"),
      loadModule("habits/reminders.js"),
    ]);
  }).then(() => {
    renderHabitsHTML();
    renderIconPicker();
    renderEditIconPicker();
    renderColorPicker();
    renderEditColorPicker();
    _habitsInitialized = true;

    // Запускаємо reminder checker після завантаження reminders.js
    if (typeof startReminderChecker === "function") {
      startReminderChecker(habits, ICONS, getLocalDateStr);
    }
    if (typeof cleanupOldReminders === "function") {
      cleanupOldReminders();
    }

    // Два кадри замість одного: браузер спочатку відмалює порожній
    // контейнер (спіннер зникає), і лише потім запускається важкий
    // renderHabits(). Це прибирає візуальний «фриз» у момент появи карток.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleRenderHabits();
      });
    });
  }).catch((err) => {
    console.error("Failed to load habits modules:", err);
    output.style.opacity = "";
  });

  if (habitsGistStorage.isEnabled()) {
    habitsGistStorage.startAutoSync();
  }

  const hasReminderEnabled = habits.some((h) => h.reminderEnabled);
  if (hasReminderEnabled) {
    requestNotificationPermission();
  }

  return initPromise;
}

const _HABITS_QUOTES = (typeof HABITS_QUOTES !== "undefined" && Array.isArray(HABITS_QUOTES)) ? HABITS_QUOTES : [];

let habitsQuoteIndex = Math.floor(Math.random() * _HABITS_QUOTES.length);

function setHabitsQuote(index) {
  const el = document.getElementById("habitsQuote");
  if (!el) return;
  const textEl = el.querySelector(".habits-quote-text");
  if (!textEl) return;
  if (typeof index === "number") {
    habitsQuoteIndex = (index + _HABITS_QUOTES.length) % _HABITS_QUOTES.length;
  } else {
    habitsQuoteIndex = Math.floor(Math.random() * _HABITS_QUOTES.length);
  }
  textEl.textContent = _HABITS_QUOTES[habitsQuoteIndex];
}

function cycleHabitsQuote() {
  const el = document.getElementById("habitsQuote");
  if (!el) return;
  const textEl = el.querySelector(".habits-quote-text");
  if (!textEl || textEl.classList.contains("swapping")) return;
  textEl.classList.add("swapping");
  setTimeout(() => {
    setHabitsQuote(habitsQuoteIndex + 1);
    textEl.classList.remove("swapping");
  }, 150);
}

/* ========== SETTINGS ========== */

const HABITS_SETTINGS_KEY = "habits_settings";

// Варіанти візуалу клітинки «напів» (порядок має збігатися з CSS .cell.half-vN)
const HALF_STYLE_OPTIONS = [
  { id: "v1", name: "Ліворуч" },
  { id: "v2", name: "Праворуч" },
  { id: "v3", name: "Зверху" },
  { id: "v4", name: "Знизу" },
  { id: "v5", name: "Діагональ ↘" },
  { id: "v6", name: "Діагональ ↗" },
  { id: "v7", name: "Діагональ ↙" },
  { id: "v8", name: "Діагональ ↖" },
  { id: "v9", name: "Шахматний" },
  { id: "v11", name: "Шахматний навпаки" },
  { id: "v10", name: "Пунктир" },
  { id: "v12", name: "Пунктир навпаки" },
];

function getHabitsSettings() {
  const defaults = { showQuote: true, halfStyle: "v1" };
  try {
    return Object.assign(defaults, JSON.parse(localStorage.getItem(HABITS_SETTINGS_KEY)) || {});
  } catch {
    return defaults;
  }
}

function getHalfStyleClass() {
  const style = getHabitsSettings().halfStyle || "v1";
  return HALF_STYLE_OPTIONS.some(o => o.id === style) ? `half-${style}` : "half-v1";
}

function saveHabitsSettings(settings) {
  try {
    localStorage.setItem(HABITS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function applyHabitsQuoteVisibility() {
  const el = document.getElementById("habitsQuote");
  if (!el) return;
  el.style.display = getHabitsSettings().showQuote && habits.length > 0 ? "" : "none";
}

function openHabitsSettingsModal() {
  const settings = getHabitsSettings();

  const overlay = document.createElement("div");
  overlay.className = "habits-settings-modal";
  overlay.innerHTML = `
    <div class="notes-modal-content">
      <div class="notes-modal-header">
        <h3>Налаштування</h3>
        <button class="notes-modal-close" id="habits-settings-close">&times;</button>
      </div>
      <div class="notes-modal-body">
        <label class="tasks-settings-row">
          <span class="tasks-settings-text">
            Показувати цитату
            <span class="tasks-settings-sub">Мотиваційне повідомлення зверху вкладки</span>
          </span>
          <span class="tasks-switch">
            <input type="checkbox" id="habits-setting-quote"${settings.showQuote ? " checked" : ""}>
            <span class="tasks-switch-slider"></span>
          </span>
        </label>

        <div class="tasks-settings-row" style="cursor:pointer" id="habits-setting-show-guide" onclick="showBeginnerGuide()">
          <span class="tasks-settings-text">
            Показати інструкцію
            <span class="tasks-settings-sub">Відкрити посібник користувача знову</span>
          </span>
          <span class="tasks-settings-action">${ICON('info', 18)}</span>
        </div>

        <div class="tasks-settings-row" style="flex-direction:column;align-items:stretch;gap:10px;margin-top:18px;padding-top:18px;border-top:1px solid #2a2a2a">
          <span class="tasks-settings-text">
            Вигляд клітинки «напів»
            <span class="tasks-settings-sub">Середня клавіша миші позначає клітинку наполовину</span>
          </span>
          <div id="half-style-grid" style="display:flex;flex-wrap:wrap;gap:8px"></div>
        </div>
      </div>
      <div class="notes-modal-footer">
        <button class="gist-btn gist-btn-primary" id="habits-settings-done">Готово</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  function close() {
    overlay.remove();
    document.body.style.overflow = prevBodyOverflow;
  }

  // Вибір візуалу «напів»
  const grid = overlay.querySelector("#half-style-grid");
  const currentStyle = getHabitsSettings().halfStyle || "v1";

  function applyHalfSelection(styleId) {
    grid.querySelectorAll(".half-style-swatch").forEach((sw) => {
      sw.classList.toggle("selected", sw.dataset.style === styleId);
    });
  }

  HALF_STYLE_OPTIONS.forEach((opt) => {
    const sw = document.createElement("div");
    sw.className = "half-style-swatch" + (opt.id === currentStyle ? " selected" : "");
    sw.dataset.style = opt.id;
    sw.title = opt.name;
    // Забезпечуємо видимий колір для half-варіантів
    sw.style.setProperty("--half-color", "#388bfd");
    sw.classList.add(`half-${opt.id}`);
    sw.addEventListener("click", () => {
      const s = getHabitsSettings();
      s.halfStyle = opt.id;
      saveHabitsSettings(s);
      applyHalfSelection(opt.id);
      if (typeof window.invalidateHeatmapCache === "function") {
        habits.forEach((h) => window.invalidateHeatmapCache(h.id));
      }
      if (typeof scheduleRenderHabits === "function") scheduleRenderHabits();
    });
    grid.appendChild(sw);
  });
  applyHalfSelection(currentStyle);

  overlay.querySelector("#habits-setting-quote").addEventListener("change", (e) => {
    const s = getHabitsSettings();
    s.showQuote = e.target.checked;
    saveHabitsSettings(s);
    applyHabitsQuoteVisibility();
  });

  overlay.querySelector("#habits-settings-close").addEventListener("click", close);
  overlay.querySelector("#habits-settings-done").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

function renderHabitsHTML() {
  const output = document.getElementById("output-habits");
  if (!output) return;

  output.innerHTML = tplMainHTML();
  setHabitsQuote();
  applyHabitsQuoteVisibility();

  // Restore beginner guide state
  try {
    if (localStorage.getItem("habitsGuideHidden") === "1") {
      const guide = document.getElementById("habitsGuide");
      if (guide) guide.remove();
    } else if (localStorage.getItem("habitsGuideOpen") === "1") {
      const guide = document.getElementById("habitsGuide");
      if (guide) guide.classList.add("open");
    }
  } catch (e) {}

  const quoteEl = document.getElementById("habitsQuote");
  if (quoteEl) {
    quoteEl.addEventListener("click", cycleHabitsQuote);
    quoteEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycleHabitsQuote(); }
    });
  }

  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById("editModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeEditModal();
  });
  document.getElementById("trashModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeTrashModal();
  });

  // Додамо event listeners для кнопки плюс
  const addBtn = document.querySelector(".add-btn");
  const habitsActions = document.querySelector(".habits-actions");
  if (addBtn && habitsActions) {
    addBtn.addEventListener("mouseenter", () => {
      habitsActions.classList.add("show-actions");
    });

    habitsActions.addEventListener("mouseleave", () => {
      habitsActions.classList.remove("show-actions");
    });
  }
  document.getElementById("statsModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeStatsModal();
  });

  // Stats tabs event listeners
  document.querySelectorAll(".stats-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".stats-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderStatsContent(tab.dataset.tab);
    });
  });

  // Reminder toggle event listeners
  const reminderEnabled = document.getElementById("reminderEnabled");
  const reminderTime = document.getElementById("reminderTime");
  if (reminderEnabled && reminderTime) {
    reminderEnabled.addEventListener("change", () => {
      reminderTime.style.display = reminderEnabled.checked ? "block" : "none";
    });
  }

  const editReminderEnabled = document.getElementById("editReminderEnabled");
  const editReminderTime = document.getElementById("editReminderTime");
  if (editReminderEnabled && editReminderTime) {
    editReminderEnabled.addEventListener("change", () => {
      editReminderTime.style.display = editReminderEnabled.checked
        ? "block"
        : "none";
    });
  }
}

function handleMiddleClick(habitId, dateStr, event) {
  // Перевіряємо, чи натиснута середня кнопка миші (button === 1)
  if (event.button === 1) {
    event.preventDefault();
    toggleHalfDate(habitId, dateStr, event);
  }
}

function toggleToday(habitId, event) {
  const today = getTodayCellDate(habitId);
  // Середня клавіша — позначити клітинку наполовину
  if (event && event.button === 1) {
    if (event.preventDefault) event.preventDefault();
    toggleHalfDate(habitId, today, event);
    return;
  }
  // Правий клік обробляється окремо через oncontextmenu (toggleTodayContext),
  // щоб не конфліктувати з перемикачем skipped/clean на великій клітинці
  if (event && event.button === 2) {
    return;
  }
  toggleDate(habitId, today, event);
}

// Дата, позначена як «сьогодні» у heatmap (.cell.today), з урахуванням
// затримки в часі (вночі це може бути вчора). Запасний варіант — локальна дата.
function getTodayCellDate(habitId) {
  const card = document.querySelector(`.habit[data-habit-id="${habitId}"]`);
  const todayCell = card && card.querySelector(".cell.today");
  if (todayCell && todayCell.dataset.dateRaw) return todayCell.dataset.dateRaw;
  return getLocalDateStr();
}

// Правий клік по великій клітинці — перемкнути скіппед / clean (як на маленькій)
function toggleTodayContext(habitId, event) {
  const today = getTodayCellDate(habitId);
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  const habitType = habit.type || "good";
  if (habitType === "bad") {
    toggleCleanDate(habitId, today, event);
  } else {
    toggleSkippedDate(habitId, today, event);
  }
}

function manualSync() {
  if (!habitsGistStorage.isEnabled()) {
    alert("Gist синхронізація не налаштована");
    return;
  }

  habitsGistStorage
    .loadHabitsFromGist()
    .then((gistHabits) => {
      if (gistHabits && gistHabits.length > 0) {
        const localModified = gistGetLocalModified('habits');
        if (gistLocalIsNewer(localModified, habitsGistStorage._lastRemoteModified || 0)) {
          alert("Локальні дані новіші за Gist — залишаємо їх. Натисніть синхронізацію ще раз, щоб записати локальне в Gist.");
          habitsGistStorage.updateHabitsInGist();
          return;
        }
        if (
          confirm(
            `Знайдено ${gistHabits.length} звичок в Gist. Перезаписати локальні дані?`,
          )
        ) {
          habits = gistHabits;
          saveHabits();
          renderHabits();
          alert("Дані успішно синхронізовано з Gist!");
        }
      } else {
        alert("Gist порожній або недоступний");
      }
    })
    .catch((err) => {
      console.error("Failed to sync with Gist:", err);
      alert("Помилка синхронізації: " + err.message);
    });
}

function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Notification permission granted");
      } else {
        console.log("Notification permission denied");
      }
    });
  } else {
    console.log("This browser does not support desktop notification");
  }
}

function testNotification() {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Тест сповіщення", {
        body: "Це тестове сповіщення від Habits Tracker",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>',
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Тест сповіщення", {
            body: "Це тестове сповіщення від Habits Tracker",
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>',
          });
        }
      });
    } else {
      alert(
        "Сповіщення заблоковано. Будь ласка, дозвольте сповіщення в налаштуваннях браузера.",
      );
    }
  } else {
    alert("Цей браузер не підтримує сповіщення");
  }
}

function renderHabits() {
  const container = document.getElementById("habitsContainer");
  if (!container) return;

  const addBtn = document.querySelector(".add-btn");
  const isEmpty =
    !habits.length ||
    (habits.length &&
      !habits.filter((h) => (h.type || "good") === "good").length &&
      !habits.filter((h) => h.type === "bad").length);

  if (!habits.length) {
    container.innerHTML = tplEmptyState();
    if (addBtn) addBtn.classList.add("add-btn-empty");
    return;
  }

  // Розділяємо звички за типом
  const goodHabits = habits.filter((h) => (h.type || "good") === "good");
  const badHabits = habits.filter((h) => h.type === "bad");

  if (!goodHabits.length && !badHabits.length) {
    container.innerHTML = tplEmptyState();
    if (addBtn) addBtn.classList.add("add-btn-empty");
    return;
  }

  if (addBtn) addBtn.classList.remove("add-btn-empty");

  // Очищаємо кеш, щоб гарантувати свіжі дані
  if (typeof clearYearDatesCache === "function") {
    clearYearDatesCache();
  }

  const currentYear = new Date().getFullYear();
  const yearDates = typeof getYearDates === "function" ? getYearDates() : [];
  const today = new Date().toISOString().split("T")[0];

  // Оптимізація: обчислюємо загальні дані один раз для всіх звичок
  const daysGrid = yearDates.map((dateStr) => {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay(); // 0 = неділя, 1 = понеділок, ..., 6 = субота
    // Конвертуємо в систему де 0 = понеділок, 6 = неділя
    const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return {
      dateStr,
      dayOfWeek: adjustedDayOfWeek,
      month: d.getMonth(),
    };
  });

  const firstDayOffset = daysGrid[0].dayOfWeek;
  const lastDayOffset = daysGrid[daysGrid.length - 1].dayOfWeek;
  const endPadding = 6 - lastDayOffset;

  // Генеруємо дати з попереднього року для заповнення початку
  const previousYearDates = [];
  if (firstDayOffset > 0) {
    const prevYear = currentYear - 1;
    const prevYearEnd = new Date(prevYear, 11, 31);
    // Йдемо назад від останнього дня попереднього року в правильному порядку
    for (let i = 0; i < firstDayOffset; i++) {
      const d = new Date(prevYearEnd);
      d.setDate(d.getDate() - (firstDayOffset - 1 - i));
      // Формуємо дату вручну, щоб уникнути проблем з часовими зонами
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      previousYearDates.push(`${year}-${month}-${day}`);
    }
  }

  // Генеруємо дати з наступного року для заповнення кінця
  const nextYearDates = [];
  if (endPadding > 0) {
    const nextYear = currentYear + 1;
    const nextYearStart = new Date(nextYear, 0, 1);
    // Йдемо вперед від першого дня наступного року
    for (let i = 0; i < endPadding; i++) {
      const d = new Date(nextYearStart);
      d.setDate(d.getDate() + i);
      // Формуємо дату вручну, щоб уникнути проблем з часовими зонами
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      nextYearDates.push(`${year}-${month}-${day}`);
    }
  }

  const allCells = [];
  // Додаємо дати з попереднього року
  previousYearDates.forEach((date) =>
    allCells.push({ dateStr: date, isPadding: true }),
  );
  // Додаємо дати поточного року
  daysGrid.forEach((day) =>
    allCells.push({ dateStr: day.dateStr, isPadding: false }),
  );
  // Додаємо дати з наступного року
  nextYearDates.forEach((date) =>
    allCells.push({ dateStr: date, isPadding: true }),
  );

  const weeks = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  const totalDays = yearDates.length;

  const renderHabitCard = (habit) => {
    const habitType = habit.type || "good";
    const isDoneToday = habit.dates.includes(today);
    const isSkippedToday = habit.skippedDates && habit.skippedDates.includes(today);
    const isHalfToday = habit.halfDates && habit.halfDates.includes(today);
    const isCleanToday = habitType === "bad" && habit.cleanDates && habit.cleanDates.includes(today) && !isDoneToday && !isSkippedToday;

    const streak = typeof getStreakCached === "function" ? getStreakCached(habit.id, habit.dates, habit.skippedDates, habit.type, habit.halfDates) : (typeof getStreak === "function" ? getStreak(habit.dates, habit.skippedDates, habit.type, habit.halfDates) : 0);
    const brokenStreak = streak === 0 && typeof getBrokenStreakCached === "function" ? getBrokenStreakCached(habit.id, habit.dates, habit.skippedDates, habit.type, habit.halfDates) : (typeof getBrokenStreak === "function" ? getBrokenStreak(habit.dates, habit.skippedDates, habit.type, habit.halfDates) : 0);
    const showBrokenStreak = brokenStreak > 1;
    const monthData = typeof getMonthDataCached === "function" ? getMonthDataCached(habit.id, habit.dates, habit.halfDates) : (typeof getMonthData === "function" ? getMonthData(habit.dates, habit.halfDates) : []);
    const maxMonth = monthData.length > 0 ? Math.max(...monthData.map((m) => m.count), 1) : 1;

    const heatmapHTML = buildHeatmapHTML(habit, weeks, today, habitType);
    const chartHTML = renderMonthChart(monthData, maxMonth);
    const badges = buildBadges(habit, goodHabits, today, habitType, isDoneToday);
    const badgesHTML = renderBadgesHTML(badges);
    const streakHTML = renderStreakBadge(streak, brokenStreak, showBrokenStreak, habitType);
    const checkboxIconHTML = renderCheckboxIcon(isDoneToday, isSkippedToday, isHalfToday, isCleanToday, habitType);
    const iconSvg = ICONS.find((icon) => icon.id === habit.icon)?.svg || ICONS[0].svg;
    const categoryColor = habit.category?.color || "";

    return tplHabitCard(habit, {
      iconSvg, categoryColor, heatmapHTML, chartHTML,
      badgesHTML, streakHTML, checkboxIconHTML,
      habitType, isDoneToday, isSkippedToday, isHalfToday, isCleanToday, today
    });
  };

  // Оновлюємо картки через keyed-реконсиляцію (не перебудовуємо весь DOM)
  const ordered = [...goodHabits, ...badHabits];
  const orderedIds = ordered.map((h) => String(h.id));

  // Прибираємо порожній стан, якщо він залишився
  const emptyStateEl = container.querySelector(".empty-state");
  if (emptyStateEl) emptyStateEl.remove();

  let section = container.querySelector(".habits-section");
  if (!section) {
    section = document.createElement("div");
    section.className = "habits-section";
  }

  // Поточні картки у DOM
  const existing = new Map();
  section.querySelectorAll(".habit").forEach((el) => {
    existing.set(el.getAttribute("data-habit-id"), el);
  });

  let prevEl = null;
  ordered.forEach((habit) => {
    const idStr = String(habit.id);
    const cardHTML = renderHabitCard(habit);
    let el = existing.get(idStr);

    if (el && el._lastHTML === cardHTML) {
      // без змін — залишаємо на місці
    } else if (el) {
      const tmp = document.createElement("div");
      tmp.innerHTML = cardHTML;
      const newEl = tmp.firstElementChild;
      newEl._lastHTML = cardHTML;
      el.replaceWith(newEl);
      el = newEl;
    } else {
      const tmp = document.createElement("div");
      tmp.innerHTML = cardHTML;
      el = tmp.firstElementChild;
      el._lastHTML = cardHTML;
    }

    if (prevEl) {
      if (prevEl.nextSibling !== el) section.insertBefore(el, prevEl.nextSibling);
    } else if (section.firstChild !== el) {
      section.insertBefore(el, section.firstChild);
    }
    prevEl = el;
  });

  // Видаляємо картки, яких більше немає
  existing.forEach((el, idStr) => {
    if (!orderedIds.includes(idStr)) el.remove();
  });

  if (section.parentNode !== container) container.appendChild(section);

  // Знаходить найближчу .cell до точки кліка всередині heatmap.
  // Потрібно, щоб клікабельна зона охоплювала й проміжки між клітинками.
  function findNearestDayCell(heatmap, clientX, clientY) {
    const cells = heatmap.querySelectorAll('.cell');
    let nearest = null;
    let nearestDist = Infinity;
    cells.forEach((cell) => {
      const r = cell.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = cell;
      }
    });
    return nearest;
  }

  // Event delegation for heatmap cells (replaces inline handlers)
  if (!container._heatmapDelegated) {
    container._heatmapDelegated = true;
    container.addEventListener('click', (e) => {
      let cell = e.target.closest('.cell');
      if (!cell) {
        const heatmap = e.target.closest('.heatmap');
        if (heatmap) cell = findNearestDayCell(heatmap, e.clientX, e.clientY);
      }
      if (!cell) return;
      const habitCard = cell.closest('.habit');
      if (!habitCard) return;
      const habitId = parseInt(habitCard.dataset.habitId, 10);
      const dateStr = cell.dataset.dateRaw;
      // При кліку прибираємо «залиплий» hover-стиль (border-color),
      // що міг залишитися від наведення миші.
      cell.style.removeProperty('border-color');
      if (dateStr) toggleDate(habitId, dateStr, e);
    });
    container.addEventListener('contextmenu', (e) => {
      const heatmap = e.target.closest('.heatmap');
      if (heatmap) {
        // Будь-який правий клік у межах heatmap не відкриває меню картки
        e.preventDefault();
        e.stopPropagation();
        let cell = e.target.closest('.cell');
        if (!cell) cell = findNearestDayCell(heatmap, e.clientX, e.clientY);
        if (!cell) return;
        const habitCard = cell.closest('.habit');
        if (!habitCard) return;
        const habitId = parseInt(habitCard.dataset.habitId, 10);
        const dateStr = cell.dataset.dateRaw;
        const rightClickType = cell.dataset.rightClick;
        if (!dateStr || !rightClickType) return;
        if (rightClickType === 'clean') toggleCleanDate(habitId, dateStr, e);
        else if (rightClickType === 'skip') toggleSkippedDate(habitId, dateStr, e);
        return;
      }
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const habitCard = cell.closest('.habit');
      if (!habitCard) return;
      const habitId = parseInt(habitCard.dataset.habitId, 10);
      const dateStr = cell.dataset.dateRaw;
      const rightClickType = cell.dataset.rightClick;
      if (!dateStr || !rightClickType) return;
      e.preventDefault();
      e.stopPropagation();
      if (rightClickType === 'clean') toggleCleanDate(habitId, dateStr, e);
      else if (rightClickType === 'skip') toggleSkippedDate(habitId, dateStr, e);
    });
    container.addEventListener('mousedown', (e) => {
      // У Firefox середня кнопка за замовчуванням робить autoscroll /
      // вставлення — скасовуємо поведінку за замовчуванням.
      if (e.button === 1) e.preventDefault();
    });
    // Обробку середньої кнопки робимо через auxclick: у Firefox подія
    // mousedown для неї може перехоплюватись браузером, а auxclick
    // надійно спрацьовує в усіх сучасних браузерах.
    container.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      let cell = e.target.closest('.cell');
      if (!cell) {
        const heatmap = e.target.closest('.heatmap');
        if (heatmap) cell = findNearestDayCell(heatmap, e.clientX, e.clientY);
      }
      if (!cell) return;
      const habitCard = cell.closest('.habit');
      if (!habitCard) return;
      const habitId = parseInt(habitCard.dataset.habitId, 10);
      const dateStr = cell.dataset.dateRaw;
      if (dateStr) handleMiddleClick(habitId, dateStr, e);
    });
  }

  // Додаємо event listeners для hover лише на нові heatmap
  setupHoverListeners();

  // ── Width resizer for the whole habits area (all cards) ──
  // Логіка винесена у habits-resize.js (initHabitsResizer).
  if (typeof initHabitsResizer === "function") initHabitsResizer(container);
}
