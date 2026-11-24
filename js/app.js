/* ---------- APP (TABS + LOADING) ---------- */

const THEME_KEY = 'app_theme';
const HIDDEN_TABS_KEY = 'hiddenTabs';

/* ---------- MOTIVATIONAL MESSAGES ---------- */

const motivationalQuotes = [
  "Кожен день — нова можливість стати кращим!",
  "Маленькі кроки ведуть до великих перемог.",
  "Вір у себе — ти сильніший, ніж здається.",
  "Почни там, де ти є. Використай те, що маєш. Зроби те, що можеш.",
  "Успіх — це сума малих зусиль, повторюваних щодня.",
  "Не чекай ідеального моменту. Створи його.",
  "Твоя єдина межа — це ти сам.",
  "Кожен профі колись був початківцем.",
  "Дії створюють надихання, а не навпаки.",
  "Помилятися — це доказ того, що ти пробуєш.",
  "Сьогоднішні зусилля — це завтрашній результат.",
  "Не зупиняйся. Перемога ближче, ніж здається.",
  "Твоя майбутня тебе подякує за сьогоднішні зусилля.",
  "Складно не означає неможливо.",
  "Розпочни. Просто почни.",
];

function motivationQuoteHTML() {
  const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  return `<div class="motivation-quote" id="motivationQuote" role="button" tabindex="0" title="Натисніть, щоб змінити цитату">
  <span class="motivation-quote-mark" aria-hidden="true">“</span>
  <span class="motivation-quote-text">${quote}</span>
</div>`;
}

function injectMotivationQuote() {
  const firstTab = document.querySelector(".tab:not(.tab-hidden)");
  if (!firstTab) return;
  // Для спеціальних вкладок (Звички, Таймер, Нотатки, Завдання) цитату
  // рендерить сам модуль — не дублюємо й не перезаписуємо її.
  if (firstTab.dataset.tabName && CONFIG.specialTabs && CONFIG.specialTabs[firstTab.dataset.tabName]) {
    return;
  }
  const output = document.getElementById(`output-${firstTab.dataset.tabId}`);
  if (!output) return;
  output.prepend(htmlToElement(motivationQuoteHTML()));
  bindMotivationQuote(output);
}

function bindMotivationQuote(scope) {
  const el = (scope || document).querySelector("#motivationQuote");
  if (!el) return;
  const cycle = () => {
    const textEl = el.querySelector(".motivation-quote-text");
    if (textEl) {
      const next = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
      textEl.textContent = next;
    }
  };
  el.addEventListener("click", cycle);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(); }
  });
}

function htmlToElement(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
  } catch {}
  // Детектуємо від браузера/системи
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateFavicon() {
  const faviconMain = document.getElementById('favicon-main');
  if (faviconMain) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const url = isDark ? 'data/favicon_dark.png' : 'data/favicon_light.png';
    faviconMain.href = url + '?v=' + Date.now();
  }
}

function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton(theme);
  updateFavicon();
}

function updateThemeButton(theme) {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  if (theme === 'light') {
    btn.innerHTML = ICON('moon', 16);
    btn.title = 'Темна тема';
  } else {
    btn.innerHTML = ICON('sun', 16);
    btn.title = 'Світла тема';
  }
}

function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Слухаємо на зміну теми браузера (коли користувач не встановив власну тему на сайті)
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const saved = localStorage.getItem(THEME_KEY);
    if (!saved) {
      const newTheme = e.matches ? 'dark' : 'light';
      setTheme(newTheme);
    }
  });
}

/* ---------- SAMPLE DATA INITIALIZATION ---------- */

function initializeSampleData() {
  // Генерує ID завдання
  const generateTaskId = () => 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  // Генерує ID нотатки
  const generateNoteId = () => 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  // Ініціалізуємо завдання, якщо їх ще немає
  const tasksKey = 'tasks_data';
  if (!localStorage.getItem(tasksKey)) {
    const sampleTasks = [
      {
        id: generateTaskId(),
        text: 'Розроблю новий функціонал',
        done: false,
        urgent: true,
        important: true,
        repeat: { type: 'none' },
        dataset: 'tasks'
      },
      {
        id: generateTaskId(),
        text: 'Підготую звіт про прогрес',
        done: false,
        urgent: true,
        important: true,
        repeat: { type: 'weekly', days: [1, 3, 5], interval: 1 },
        dataset: 'tasks'
      },
      {
        id: generateTaskId(),
        text: 'Переглядну код колег',
        done: false,
        urgent: false,
        important: true,
        repeat: { type: 'none' },
        dataset: 'tasks'
      },
      {
        id: generateTaskId(),
        text: 'Розслідую баг у модулі',
        done: false,
        urgent: true,
        important: false,
        repeat: { type: 'none' },
        dataset: 'tasks'
      },
      {
        id: generateTaskId(),
        text: 'Організую зустріч з командою',
        done: false,
        urgent: false,
        important: false,
        repeat: { type: 'none' },
        dataset: 'tasks'
      }
    ];
    localStorage.setItem(tasksKey, JSON.stringify(sampleTasks));
  }

  // Ініціалізуємо завдання для вкладки «Код», якщо їх ще немає
  const codeTasksKey = 'code_tasks_data';
  if (!localStorage.getItem(codeTasksKey)) {
    const codeTasksSample = [
      {
        id: generateTaskId(),
        text: 'Рефакторити модуль UI',
        done: false,
        urgent: true,
        important: true,
        repeat: { type: 'none' },
        dataset: 'code'
      },
      {
        id: generateTaskId(),
        text: 'Написати unit-тести',
        done: false,
        urgent: false,
        important: true,
        repeat: { type: 'weekly', days: [2, 4], interval: 1 },
        dataset: 'code'
      },
      {
        id: generateTaskId(),
        text: 'Оновити документацію API',
        done: false,
        urgent: false,
        important: true,
        repeat: { type: 'none' },
        dataset: 'code'
      },
      {
        id: generateTaskId(),
        text: 'Виправити memory leak',
        done: false,
        urgent: true,
        important: false,
        repeat: { type: 'none' },
        dataset: 'code'
      }
    ];
    localStorage.setItem(codeTasksKey, JSON.stringify(codeTasksSample));
  }

  // Ініціалізуємо нотатки, якщо їх ще немає
  const notesKey = 'notes_data';
  const topicsKey = 'notes_topics';
  const nameMapKey = 'notes_name_map';

  if (!localStorage.getItem(notesKey)) {
    const topic1Id = generateNoteId();

    const nameMap = {
      [topic1Id]: 'Як користуватися'
    };

    const notesData = {
      [topic1Id]: '<h3>Що це за застосунок?</h3><p><strong>ZenithApp</strong> — це персональний менеджер задач, звичок і нотаток.</p><p>Основні можливості:</p><ul><li><strong>📋 Завдання</strong> — матриця Айзенхауера (термінове/важливе)</li><li><strong>⏱️ Таймер</strong> — табата-тренування з налаштованими шаблонами</li><li><strong>📝 Нотатки</strong> — організовані за темами з підтримкою багатого форматування</li><li><strong>✓ Звички</strong> — трекер звичок з прогресом і нагадуваннями</li></ul><p>Дані зберігаються локально в браузері та можуть синхронізуватися через GitHub Gist.</p><h3>Поради для новачків</h3><ol><li>Почніть з <strong>Завдань</strong> — розподіліть їх за матрицею на 4 квадранти</li><li>Додайте <strong>Звички</strong> — малі дії щодня ведуть до великих змін</li><li>Використовуйте <strong>Таймер</strong> для pomodoro-сеансів (25 хв робота + 5 хв перерва)</li><li>Пишіть <strong>Нотатки</strong> — фіксуйте ідеї та ключові моменти</li></ol>'
    };

    localStorage.setItem(nameMapKey, JSON.stringify(nameMap));
    localStorage.setItem(notesKey, JSON.stringify(notesData));
    localStorage.setItem(topicsKey, JSON.stringify([topic1Id]));
  }

  // Ініціалізуємо шаблони таймера, якщо їх ще немає
  const presetsKey = 'tabataPresets';
  if (!localStorage.getItem(presetsKey)) {
    const samplePresets = [
      {
        id: generateTaskId(),
        name: 'Швидка розминка',
        work: 15,
        rest: 10,
        rounds: 4,
        warmup: 0,
        cooldown: 0
      },
      {
        id: generateTaskId(),
        name: 'Стандартна Tabata',
        work: 20,
        rest: 10,
        rounds: 8,
        warmup: 0,
        cooldown: 0
      },
      {
        id: generateTaskId(),
        name: 'Інтенсивне тренування',
        work: 30,
        rest: 15,
        rounds: 6,
        warmup: 5,
        cooldown: 2
      },
      {
        id: generateTaskId(),
        name: 'Легке кардіо',
        work: 40,
        rest: 20,
        rounds: 5,
        warmup: 3,
        cooldown: 2
      }
    ];
    localStorage.setItem(presetsKey, JSON.stringify(samplePresets));
  }
}

// Ініціалізуємо зразкові дані при першому завантаженні
if (typeof window !== 'undefined') {
  setTimeout(() => initializeSampleData(), 100);
}

const TAB_ICONS = {
   "Звички": ICON('tabHabits', 14),
   "Таймер": ICON('tabTimer', 14),
   "Нотатки": ICON('tabNotes', 14),
   "Завдання": ICON('tabTasks', 14),
   "Код": ICON('tabCode', 14),
   "Спорт": ICON('tabSport', 14),
   "Робота": ICON('tabWork', 14),
};

function updateGistTopButton(btn) {
  if (!btn) btn = document.getElementById('gist-top-btn');
  if (!btn) return;

  const GIST_ICONS = {
    local: ICON('gistLocal', 16),
    syncing: ICON('gistSyncing', 16),
    success: ICON('gistSuccess', 16),
    error: ICON('gistError', 16),
  };

  function getAnyGistStorage() {
    if (typeof gistStorage !== "undefined" && gistStorage.config && gistStorage.config.token) return gistStorage;
    if (typeof habitsGistStorage !== "undefined" && habitsGistStorage.config && habitsGistStorage.config.token) return habitsGistStorage;
    if (typeof timerGistStorage !== "undefined" && timerGistStorage.config && timerGistStorage.config.token) return timerGistStorage;
    return null;
  }

  const any = getAnyGistStorage();
  if (any && any.config && any.config.enabled && any.config.token) {
    btn.innerHTML = GIST_ICONS.success;
    btn.classList.add('active');
    btn.title = 'Синхронізація з Gist увімкнена';
  } else {
    btn.innerHTML = GIST_ICONS.local;
    btn.classList.remove('active');
    btn.title = 'Налаштування синхронізації';
  }

  window.removeEventListener('gist-sync-status', btn._gistHandler);
  btn._gistHandler = (e) => {
    const { status } = e.detail;
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
        setTimeout(() => { btn.classList.remove('syncing'); }, 3000);
        break;
      case 'error':
        btn.innerHTML = GIST_ICONS.error;
        btn.classList.remove('syncing');
        break;
      default:
        btn.innerHTML = GIST_ICONS.local;
        btn.classList.remove('syncing');
    }
  };
  window.addEventListener('gist-sync-status', btn._gistHandler);
}

function fileId(filename) {
  return filename.replace(/\.xbel$/i, "").replace(/[^a-zA-Z0-9]/g, "_");
}

// Номер файлу для не-спеціальних табів: рахуємо послідовно лише серед
// звичайних табів (без specialTabs), щоб файли йшли tab1, tab2, tab3…
// незалежно від того, скільки спеціальних табів є в CONFIG.tabs.
function bookmarkFileName(tabName) {
  const normalTabs = CONFIG.tabs.filter(
    (t) => !(CONFIG.specialTabs && CONFIG.specialTabs[t])
  );
  const n = normalTabs.indexOf(tabName) + 1;
  
// Custom mapping for bookmark tabs
   if (tabName === "Закладки") return "test1.xbel";
  
  return `tab${n}.xbel`;
}

/* ---------- ПОРЯДОК І ВИДИМІСТЬ ТАБІВ (DESKTOP) ---------- */

function getHiddenTabs() {
  let hidden = [];
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_TABS_KEY) || "[]");
    if (Array.isArray(raw)) hidden = raw;
  } catch (e) {}
  const all = CONFIG.tabs || [];
  hidden = hidden.filter((t) => all.includes(t));
  // Завжди лишаємо принаймні одну видиму вкладку (на випадок пошкоджених даних).
  if (all.length && hidden.length >= all.length) {
    const keep = all[all.length - 1];
    hidden = hidden.filter((t) => t !== keep);
  }
  return hidden;
}

/** Застосовує порядок і видимість до вже створених табів у DOM. */
function applyTabSettings(order, hidden) {
  const tabsContainer = document.getElementById("tabs-container");
  const contentsContainer = document.getElementById("contents-container");
  if (!tabsContainer || !contentsContainer) return;

  const hiddenSet = new Set(hidden || []);
  const topActions = tabsContainer.querySelector(".top-actions");
  const tabs = [...tabsContainer.querySelectorAll(".tab")];

  // Переставляємо таби та відповідні панелі контенту в новому порядку.
  (order || []).forEach((name) => {
    const tab = tabs.find((t) => t.dataset.tabName === name);
    if (!tab) return;
    tabsContainer.insertBefore(tab, topActions);
    const content = document.getElementById(`content-${tab.dataset.tabId}`);
    if (content) contentsContainer.appendChild(content);
  });

  tabs.forEach((tab) => {
    const isHidden = hiddenSet.has(tab.dataset.tabName);
    tab.classList.toggle("tab-hidden", isHidden);
    tab.draggable = !isHidden;
  });

  // Якщо приховали активну вкладку — переносимо активність на першу видиму.
  const active = tabsContainer.querySelector(".tab.active");
  if (active && active.classList.contains("tab-hidden")) {
    const firstVisible = tabsContainer.querySelector(".tab:not(.tab-hidden)");
    if (firstVisible && typeof switchTab === "function") {
      switchTab(firstVisible.dataset.tabId);
    }
  }
}

function openTabsSettingsModal() {
  const allTabs = (CONFIG.tabs || []).slice();
  if (!allTabs.length) return;

  const existing = document.querySelector(".settings-modal.tabs-settings-modal");
  if (existing) existing.remove();

  // Порядок завжди зберігаємо повний (разом із прихованими табами).
  let savedOrder = [];
  try {
    const raw = JSON.parse(localStorage.getItem("tabsOrder") || "[]");
    if (Array.isArray(raw)) savedOrder = raw;
  } catch (e) {}
  const order = savedOrder.filter((t) => allTabs.includes(t));
  allTabs.forEach((t) => {
    if (!order.includes(t)) order.push(t);
  });
  const hiddenSet = new Set(getHiddenTabs());

  const rowsHTML = order
    .map((name) => {
      const isHidden = hiddenSet.has(name);
      return `
        <div class="tab-order-item${isHidden ? " is-hidden" : ""}" data-tab-name="${name}">
          <span class="tab-order-handle" title="Перетягнути" aria-hidden="true">${ICON("ellipsisVertical", 16)}</span>
          <span class="tab-order-icon" aria-hidden="true">${TAB_ICONS[name] || ""}</span>
          <span class="tab-order-label">${name}</span>
          <label class="settings-switch tab-order-switch">
            <input type="checkbox" class="tab-order-toggle" ${isHidden ? "" : "checked"} aria-label="Показати вкладку ${name}" />
            <span class="settings-switch-slider"></span>
          </label>
        </div>`;
    })
    .join("");

  const overlay = document.createElement("div");
  overlay.className = "settings-modal tabs-settings-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="settings-modal-content" role="document">
      <div class="settings-modal-header">
        <h3>Налаштування вкладок</h3>
        <button class="settings-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
      </div>
      <div class="settings-modal-body">
        <div class="tab-order-container">
          <p class="tab-order-hint">Перетягуйте вкладки за маркер, щоб змінити порядок. Вимкніть перемикач, щоб приховати вкладку. Принаймні одна вкладка має залишатися видимою.</p>
          <div class="tab-order-list" id="tabsSettingsList">${rowsHTML}</div>
        </div>
      </div>
      <div class="settings-modal-footer">
        <button class="modal-btn modal-btn--secondary" type="button" id="tabs-settings-show-all">Показати всі</button>
        <button class="modal-btn modal-btn--primary" type="button" data-close>Готово</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add("settings-modal-open");

  const listEl = overlay.querySelector("#tabsSettingsList");
  const persist = () => {
    const items = [...listEl.querySelectorAll(".tab-order-item")];
    const newOrder = items.map((item) => item.dataset.tabName);
    const newHidden = items
      .filter((item) => !item.querySelector(".tab-order-toggle").checked)
      .map((item) => item.dataset.tabName);
    try {
      localStorage.setItem("tabsOrder", JSON.stringify(newOrder));
      localStorage.setItem(HIDDEN_TABS_KEY, JSON.stringify(newHidden));
    } catch (e) {}
    applyTabSettings(newOrder, newHidden);
  };

  let sortable = null;
  if (typeof Sortable !== "undefined" && listEl) {
    sortable = Sortable.create(listEl, {
      animation: 150,
      handle: ".tab-order-handle",
      ghostClass: "tab-order-ghost",
      onEnd: persist,
    });
  }

  listEl.addEventListener("change", (e) => {
    const toggle = e.target.closest(".tab-order-toggle");
    if (!toggle) return;
    if (!toggle.checked) {
      const visibleLeft = [...listEl.querySelectorAll(".tab-order-toggle")].filter(
        (cb) => cb.checked,
      ).length;
      if (visibleLeft === 0) {
        toggle.checked = true;
        return;
      }
    }
    toggle.closest(".tab-order-item").classList.toggle("is-hidden", !toggle.checked);
    persist();
  });

  overlay.querySelector("#tabs-settings-show-all").addEventListener("click", () => {
    listEl.querySelectorAll(".tab-order-item").forEach((item) => {
      item.querySelector(".tab-order-toggle").checked = true;
      item.classList.remove("is-hidden");
    });
    persist();
  });

  const close = () => {
    if (sortable) sortable.destroy();
    overlay.remove();
    document.body.classList.remove("settings-modal-open");
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
  };
  overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKeyDown);
}

function createTabs() {
  const tabsContainer = document.getElementById("tabs-container");
  const contentsContainer = document.getElementById("contents-container");

  // Завантажуємо збережений порядок табів, додаємо нові таби з конфігу.
  // Видаляємо зі збереженого порядку таби, яких більше немає в конфігу.
  let savedOrder = [];
  try {
    const raw = JSON.parse(localStorage.getItem("tabsOrder") || "[]");
    if (Array.isArray(raw)) savedOrder = raw;
  } catch (e) {}
  let tabsOrder = savedOrder.filter((t) => CONFIG.tabs.includes(t));
  CONFIG.tabs.forEach((t) => {
    if (!tabsOrder.includes(t)) tabsOrder.push(t);
  });
  const hiddenSet = new Set(getHiddenTabs());
  const firstVisibleTab = tabsOrder.find((t) => !hiddenSet.has(t));

  tabsOrder.forEach((tabName) => {
    const isSpecial = CONFIG.specialTabs && CONFIG.specialTabs[tabName];
    let id, fileName;

    if (isSpecial) {
      id = CONFIG.specialTabs[tabName];
      fileName = null;
    } else {
      fileName = bookmarkFileName(tabName);
      id = fileId(fileName);
    }

    // Створюємо кнопку таба
    const tabBtn = document.createElement("button");
    tabBtn.className =
      "tab" +
      (tabName === firstVisibleTab ? " active" : "") +
      (hiddenSet.has(tabName) ? " tab-hidden" : "");
    // Нативний drag дозволений одразу: перетягування запускається браузером
    // лише при русі миші (mousedown+рух), тому простий клік не плутається з drag.
    tabBtn.draggable = true;
    tabBtn._dragArmed = true;

    // Клік перемикає таб (подія click не спрацьовує після реального drag).
    tabBtn.addEventListener("click", (e) => {
      if (tabBtn.classList.contains("dragging")) return;
      switchTab(id);
    });

    // Формуємо контент кнопки
    let tabContent = tabName;
    if (TAB_ICONS[tabName]) {
      tabContent = TAB_ICONS[tabName] + ' ' + tabContent;
    }
    if (CONFIG.ui.showCounts && !isSpecial) {
      tabContent += ` <span class="tab-count" id="count-${id}">0</span>`;
    }

    tabBtn.innerHTML = tabContent;
    tabBtn.dataset.tabId = id;
    tabBtn.dataset.tabName = tabName;
    tabsContainer.appendChild(tabBtn);

    // Drag-and-drop: dragstart/dragend на самому табі, dragover/drop — на контейнері
    tabBtn.addEventListener("dragstart", handleTabDragStart);
    tabBtn.addEventListener("dragend", handleTabDragEnd);

    // Створюємо контент таба
    const content = document.createElement("div");
    content.id = `content-${id}`;
    content.className = "tab-content" + (tabName === firstVisibleTab ? " active" : "");

    if (isSpecial) {
      content.innerHTML = `<div id="output-${id}"></div>`;
    } else {
      const isFirst = tabName === firstVisibleTab;
      const quote = isFirst ? motivationQuoteHTML() : '';
      content.innerHTML = `
        <div id="output-${id}">${quote}</div>
      `;
      if (isFirst) bindMotivationQuote(content);
    }
    contentsContainer.appendChild(content);

    // Зберігаємо дані таба
    bookmarksData[id] = {
      path: fileName ? `${CONFIG.dir}/${fileName}` : null,
      name: tabName,
      special: isSpecial ? CONFIG.specialTabs[tabName] : null,
    };
  });

  // Drag-and-drop для табів: dragover/drop вішаємо на контейнер (як у нотатках),
  // щоб переставляти таб живцем під час перетягування.
  if (!tabsContainer._tabDdBound) {
    tabsContainer._tabDdBound = true;
    tabsContainer.addEventListener("dragover", handleTabDragOver);
    tabsContainer.addEventListener("drop", handleTabDrop);
  }

  // Група кнопок праворуч: sync, тема, порядок вкладок, телефон
  const topActions = document.createElement("div");
  topActions.className = "top-actions";

  // Gist sync button
  const gistBtn = document.createElement("button");
  gistBtn.className = "gist-top-btn";
  gistBtn.id = "gist-top-btn";
  gistBtn.title = "Налаштування синхронізації";
  gistBtn.innerHTML = ICON('gistLocal', 16);
  gistBtn.addEventListener("click", () => {
    if (typeof openGistSettingsModal === "function") {
      openGistSettingsModal();
    } else if (typeof createGistSettingsModal === "function") {
      createGistSettingsModal();
    }
  });
  topActions.appendChild(gistBtn);
  updateGistTopButton(gistBtn);

  // Theme toggle
  const themeBtn = document.createElement("button");
  themeBtn.className = "theme-toggle";
  themeBtn.title = "Темна тема";
  themeBtn.innerHTML = ICON(getTheme() === 'light' ? 'moon' : 'sun', 18);
  themeBtn.addEventListener("click", toggleTheme);
  topActions.appendChild(themeBtn);
  updateThemeButton(getTheme());

  // Кнопка налаштування порядку та видимості вкладок (передостання в групі)
  const tabsSettingsBtn = document.createElement("button");
  tabsSettingsBtn.className = "gist-top-btn tabs-settings-btn";
  tabsSettingsBtn.id = "tabs-settings-btn";
  tabsSettingsBtn.title = "Налаштування вкладок";
  tabsSettingsBtn.setAttribute("aria-label", "Налаштування вкладок");
  tabsSettingsBtn.innerHTML = ICON("grid2x2Plus", 18);
  tabsSettingsBtn.addEventListener("click", openTabsSettingsModal);
  topActions.appendChild(tabsSettingsBtn);

  // Кнопка-посилання на мобільну версію
  const mobileBtn = document.createElement("a");
  mobileBtn.className = "gist-top-btn mobile-link-btn";
  mobileBtn.id = "mobile-link-btn";
  mobileBtn.href = "mobile/index.html";
  mobileBtn.target = "_blank";
  mobileBtn.rel = "noopener";
  mobileBtn.title = "Мобільна версія";
  mobileBtn.innerHTML = ICON('mobile', 18);
  topActions.appendChild(mobileBtn);

  tabsContainer.appendChild(topActions);

  openTabFromHash();
}

async function switchTab(tabId) {
  const targetTabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
  // Приховані (або неіснуючі) вкладки не активуємо — інакше UI лишиться без активного таба.
  if (!targetTabEl || targetTabEl.classList.contains("tab-hidden")) return;

  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  targetTabEl.classList.add("active");
  document.getElementById(`content-${tabId}`).classList.add("active");

  // Зберігаємо останній відкритий таб
  try { localStorage.setItem("lastTab", tabId); } catch (e) {}

  window.location.hash = tabId;

  // Lazy-load модулів при першому відкритті відповідної вкладки.
  if (
    (tabId === "notes" || tabId === "quick-notes") &&
    typeof ensureNotesLoaded === "function"
  ) {
    await ensureNotesLoaded();
  }

  // Модулі звичок/таймера не входять у стартовий бандл (крім активної при
  // старті вкладки) — довантажуємо їх перед ініціалізацією. Ідемпотентно.
  if (typeof loadTabModule === "function") {
    await loadTabModule(tabId);
  }

  if (tabId === "habits" && typeof initHabits === "function") {
    initHabits();
  }

  if (tabId === "timer" && typeof initTimer === "function") {
    initTimer();
  }

  if (tabId === "tasks" && typeof renderTasksActions === "function") {
    renderTasksActions();
  } else if (tabId === "code" && typeof renderCodeTasksActions === "function") {
    renderCodeTasksActions();
  } else {
    const tasksActions = document.getElementById("tasksActions");
    const codeTasksActions = document.getElementById("codeTasksActions");
    if (tasksActions) tasksActions.remove();
    if (codeTasksActions) codeTasksActions.remove();
  }

  if (tabId === "notes") {
    const topics = getNotesTopics();
    const storedTopic = localStorage.getItem(NOTES_ACTIVE_KEY);
    const lastTopic = storedTopic && topics.includes(storedTopic) ? storedTopic : null;
    if (lastTopic !== notesActiveTopic) {
      notesActiveTopic = lastTopic;
      const output = document.getElementById("output-notes");
      if (output && typeof renderNotesUI === "function") {
        renderNotesUI(output);
      }
    }
  }

  if (tabId === "quick-notes") {
    const output = document.getElementById("output-quick-notes");
    if (output && typeof renderQuickNotesUI === "function") {
      const topics = getQuickNotesTopics();
      let lastTopic = localStorage.getItem("quick_notes_active_topic");
      if (!lastTopic || !topics.includes(lastTopic)) {
        lastTopic = topics[0];
      }
      if (
        typeof quickNotesActiveTopic !== "undefined" &&
        lastTopic !== quickNotesActiveTopic
      ) {
        quickNotesActiveTopic = lastTopic;
        localStorage.setItem("quick_notes_active_topic", quickNotesActiveTopic);
      }
      renderQuickNotesUI(output);
    }
  }
}

function openTabFromHash() {
  const isVisible = (id) => {
    const tab = document.querySelector(`[data-tab-id="${id}"]`);
    return !!(tab && !tab.classList.contains("tab-hidden"));
  };

  const hash = window.location.hash.replace("#", "");
  let targetId = null;
  if (hash && isVisible(hash)) {
    targetId = hash;
  } else {
    // Якщо немає hash (або він вказує на приховану вкладку) — беремо останню видиму.
    let lastTab = null;
    try { lastTab = localStorage.getItem("lastTab"); } catch (e) {}
    if (lastTab && isVisible(lastTab)) {
      targetId = lastTab;
    } else if (isVisible("habits")) {
      // При першому запуску відкриваємо вкладку «Звички»
      targetId = "habits";
    } else {
      // Якщо «Звички» приховані — будь-яка перша видима вкладка.
      const firstVisible = document.querySelector(".tab:not(.tab-hidden)");
      if (firstVisible) targetId = firstVisible.dataset.tabId;
    }
  }
  if (!targetId) return;

  // Скидаємо стан "active", який createTabs проставляє першому табу за
  // замовчуванням. Інакше switchTab завершиться раніше часу (бо таб уже
  // активний) і не виконає lazy-init модуля (напр. initHabits).
  const targetTab = document.querySelector(`[data-tab-id="${targetId}"]`);
  const targetContent = document.getElementById(`content-${targetId}`);
  if (targetTab) targetTab.classList.remove("active");
  if (targetContent) targetContent.classList.remove("active");
  switchTab(targetId);
}

async function loadFileData(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return parseBookmarks(await response.text());
  } catch (err) {
    throw new Error(`Не вдалося завантажити ${path}: ${err.message}`);
  }
}

function hidePreloader() {
  const preloader = document.getElementById("preloader");
  if (preloader && !preloader.classList.contains("hidden")) {
    preloader.classList.add("hidden");
  }
}

async function loadDirectory() {
  createTabs();
  initSearch();

  // Заповнюємо прелоадер мотиваційною цитатою, щоб час завантаження
  // виглядав приємно, а не як порожній екран.
  const pl = document.getElementById("preloader");
  if (pl) {
    const quote = motivationalQuotes[
      Math.floor(Math.random() * motivationalQuotes.length)
    ];
    let quoteEl = pl.querySelector(".preloader-quote");
    if (!quoteEl) {
      quoteEl = document.createElement("div");
      quoteEl.className = "preloader-quote";
      pl.appendChild(quoteEl);
    }
    quoteEl.textContent = quote;
  }

  // Таб, який реально видно користувачу одразу після запуску (createTabs()
  // синхронно активує його через openTabFromHash → switchTab).
  const activeTabEl = document.querySelector(".tab.active");
  const activeTabId = activeTabEl ? activeTabEl.dataset.tabId : null;

  let activeTabPromise = null;
  const loadPromises = CONFIG.tabs.map((tabName) => {
    const isSpecial = CONFIG.specialTabs && CONFIG.specialTabs[tabName];
    const p = (async () => {
      if (isSpecial) {
        const id = CONFIG.specialTabs[tabName];
        if (id === "tasks" && typeof initTasks === "function") {
          initTasks();
        }
        if (id === "code" && typeof initCodeTasks === "function") {
          initCodeTasks();
        }
        return;
      }
      const fileName = bookmarkFileName(tabName);
      const id = fileId(fileName);
      try {
        const bookmarks = await loadFileData(`${CONFIG.dir}/${fileName}`);
        bookmarksData[id].bookmarks = bookmarks;
        displayBookmarks(id, bookmarks);
      } catch (err) {
        const output = document.getElementById(`output-${id}`);
        if (output)
          output.innerHTML = `<div class="error">Помилка: ${err.message}</div>`;
      }
    })();

    const id = isSpecial ? CONFIG.specialTabs[tabName] : fileId(bookmarkFileName(tabName));
    if (id === activeTabId) activeTabPromise = p;
    return p;
  });

  // Ховаємо прелоадер, щойно готовий видимий таб — не чекаючи дані фонових
  // (невидимих) табів. Їхнє завантаження триває у фоні після появи UI.
  (activeTabPromise || Promise.resolve()).finally(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hidePreloader();
      injectMotivationQuote();
    }));
  });

  await Promise.allSettled(loadPromises);
}

function filterBookmarks(tabId, query) {
  const output = document.getElementById(`output-${tabId}`);
  if (!output) return;
  const q = query.trim().toLowerCase();
  const items = output.querySelectorAll(".bookmark-item");
  const separators = output.querySelectorAll(".separator");
  const total = items.length;
  let visible = 0;

  items.forEach((item) => {
    const title =
      item.querySelector(".bookmark-title")?.textContent.toLowerCase() || "";
    const domain =
      item.querySelector(".bookmark-domain")?.textContent.toLowerCase() || "";
    const match = !q || title.includes(q) || domain.includes(q);
    item.style.display = match ? "" : "none";
    if (match) visible++;
  });

  separators.forEach((sep) => {
    sep.style.display = q ? "none" : "";
  });

  const countEl = document.getElementById(`search-count-${tabId}`);
  if (countEl) countEl.textContent = q ? `${visible} з ${total}` : "";

  const noResults = output.querySelector(".no-results-search");
  if (!q && noResults) {
    noResults.remove();
    return;
  }
  if (q && visible === 0) {
    if (!noResults) {
      const el = document.createElement("div");
      el.className = "no-results no-results-search";
      el.textContent = "Нічого не знайдено";
      output.appendChild(el);
    }
  } else if (noResults) {
    noResults.remove();
  }
}

function initSearch() {
  document.querySelectorAll(".search-input").forEach((input) => {
    const tabId = input.id.replace("search-", "");
    input.addEventListener("input", () => filterBookmarks(tabId, input.value));
  });
}

window.addEventListener("hashchange", openTabFromHash);

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const isInput =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    document.activeElement?.isContentEditable;

  if (
    (e.key === "/" || e.key === "f") &&
    !isInput &&
    !e.ctrlKey &&
    !e.metaKey
  ) {
    const activTab = document.querySelector(".tab.active");
    if (!activTab) return;
    const tabId = activTab.dataset.tabId;
    const searchEl = document.getElementById(`search-${tabId}`);
    if (searchEl) {
      e.preventDefault();
      searchEl.focus();
      searchEl.select();
    }
    return;
  }

  if (e.key === "Escape" && isInput) {
    document.activeElement.blur();
  }
});

/* ---------- DRAG-AND-DROP ДЛЯ ТАБІВ (ПАПОК) ----------
   Реалізовано за аналогією до перетягування нотаток: таб переставляється
   живцем під час dragover, використовується невидимий ghost, щоб не було
   стандартної напівпрозорої копії. */

let draggedTab = null;
let tabDragStartParent = null;
let tabDragStartNextSib = null;
let tabDropped = false;

function setInvisibleGhost(e) {
  const ghost = document.createElement("div");
  ghost.style.cssText =
    "position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;";
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 0, 0);
  setTimeout(() => ghost.remove(), 0);
}

function handleTabDragStart(e) {
  if (!this._dragArmed) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.tabId);
  setInvisibleGhost(e);

  draggedTab = this;
  tabDragStartParent = this.parentElement;
  tabDragStartNextSib = this.nextElementSibling;
  tabDropped = false;

  requestAnimationFrame(() => this.classList.add("dragging"));
}

function handleTabDragEnd() {
  this.classList.remove("dragging");
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.classList.remove("drag-over"));

  // Якщо drop не відбувся — повертаємо на початкове місце.
  if (!tabDropped && tabDragStartParent) {
    if (tabDragStartNextSib && tabDragStartNextSib.parentElement === tabDragStartParent) {
      tabDragStartParent.insertBefore(this, tabDragStartNextSib);
    } else {
      tabDragStartParent.appendChild(this);
    }
  }

  draggedTab = null;
  tabDragStartParent = null;
  tabDragStartNextSib = null;
}

function handleTabDragOver(e) {
  if (!draggedTab) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const tabsContainer = document.getElementById("tabs-container");
  const allTabs = [...tabsContainer.querySelectorAll(".tab")].filter(
    (t) => t !== draggedTab && !t.classList.contains("tab-hidden"),
  );

  const target = findTabInsertTarget(allTabs, e.clientX, e.clientY);

  if (target) {
    if (draggedTab.nextElementSibling !== target) {
      tabsContainer.insertBefore(draggedTab, target);
    }
  } else {
    if (draggedTab.parentElement !== tabsContainer || draggedTab.nextElementSibling !== null) {
      tabsContainer.insertBefore(draggedTab, tabsContainer.querySelector(".top-actions"));
    }
  }
}

function handleTabDrop(e) {
  if (!draggedTab) return;
  e.preventDefault();
  e.stopPropagation();

  tabDropped = true;

  // Зберігаємо новий порядок табів (перед theme-toggle).
  const tabsContainer = document.getElementById("tabs-container");
  const newOrder = [...tabsContainer.querySelectorAll(".tab")].map(
    (tab) => tab.dataset.tabName,
  );
  localStorage.setItem("tabsOrder", JSON.stringify(newOrder));

  // Переставляємо відповідний контент у тому ж порядку.
  const contentsContainer = document.getElementById("contents-container");
  newOrder.forEach((tabName) => {
    const tabEl = [...tabsContainer.querySelectorAll(".tab")].find(
      (t) => t.dataset.tabName === tabName,
    );
    const content = document.getElementById(`content-${tabEl.dataset.tabId}`);
    if (content) contentsContainer.appendChild(content);
  });
}

/** Знаходить таб, перед яким треба вставити перетягуваний (як у нотатках). */
function findTabInsertTarget(tabs, cx, cy) {
  if (tabs.length === 0) return null;

  const rects = tabs.map((el) => {
    const r = el.getBoundingClientRect();
    return { el, r, midX: r.left + r.width / 2, midY: r.top + r.height / 2 };
  });

  // Таби — це гнучкий рядок (flex-wrap). Використовуємо ту ж логіку, що й для
  // горизонтальних контейнерів у нотатках.
  const ROW_TOL = 6;
  const rows = [];
  for (const item of rects) {
    const row = rows.find((row) => Math.abs(row.top - item.r.top) < ROW_TOL);
    if (row) {
      row.items.push(item);
      row.bottom = Math.max(row.bottom, item.r.bottom);
    } else {
      rows.push({ top: item.r.top, bottom: item.r.bottom, items: [item] });
    }
  }
  rows.sort((a, b) => a.top - b.top);
  rows.forEach((row) => row.items.sort((a, b) => a.r.left - b.r.left));

  let activeRowIdx = rows.findIndex(
    (row) => cy >= row.top - ROW_TOL && cy <= row.bottom + ROW_TOL,
  );
  if (activeRowIdx === -1) {
    let minDist = Infinity;
    rows.forEach((row, i) => {
      const dist = cy < row.top ? row.top - cy : cy - row.bottom;
      if (dist < minDist) {
        minDist = dist;
        activeRowIdx = i;
      }
    });
  }

  const activeRow = rows[activeRowIdx];
  const DEAD_PX = 8;
  for (const { el, midX } of activeRow.items) {
    if (cx < midX - DEAD_PX) return el;
  }
  if (activeRowIdx < rows.length - 1) {
    return rows[activeRowIdx + 1].items[0].el;
  }
  return null;
}

/* ---------- PAGE VISIBILITY API ДЛЯ СИНХРОНІЗАЦІЇ ПРИ ЗАКРИТТІ ВКЛАДКИ ----------
   Координатор вкладок гарантує, що пуш/пул у Gist робить ЛИШЕ одна вкладка
   (лідер). Якщо їх відкрито кілька — вони не «борються» за Gist і не
   перезаписують спільні локальні дані. */
if (typeof gistTabInit === 'function') gistTabInit();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Лише лідер пушить у Gist при приховуванні.
    if (typeof gistTabRequestPush === 'function') {
      gistTabRequestPush().catch(err => {
        console.error("Gist auto-push on page hide failed:", err);
      });
    }
  }
});

/* ---------- АВТО-PULL З GIST ПРИ ПОВЕРНЕННІ НА ВКЛАДКУ / ФОКУСІ ----------
   Тихо підтягує і об'єднує свіжі дані з Gist (напр. введені на іншому пристрої),
   не питаючи підтвердження. Якщо ця вкладка — follower, вона просить лідера
   зробити pull, щоб усі вкладки отримали свіжі дані одночасно. */
let _gistAutoPullTimer = null;
function scheduleGistAutoPull() {
  if (_gistAutoPullTimer) clearTimeout(_gistAutoPullTimer);
  _gistAutoPullTimer = setTimeout(() => {
    if (typeof gistTabRequestPull === 'function') {
      gistTabRequestPull();
    } else if (typeof gistAutoPull === 'function') {
      gistAutoPull();
    }
  }, 1500); // невелика затримка, щоб не гатити API при швидкому перемиканні
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    scheduleGistAutoPull();
  }
});

window.addEventListener("focus", () => {
  scheduleGistAutoPull();
});

/* ---------- МІЖВКЛАДКОВЕ ОНОВЛЕННЯ UI ----------
   Коли дані змінюються в іншій вкладці того ж браузера, localStorage оновлюється
   спільно. Ця вкладка отримує повідомлення і перерендерює свій UI, не чіпаючи
   Gist (тим займається лідер). */
if (typeof gistTabOn === 'function') {
  gistTabOn('data_changed', (msg) => {
    if (msg.payload && msg.payload.dataset) {
      gistCrossTabRefreshUI(msg.payload.dataset);
    }
  });
}
