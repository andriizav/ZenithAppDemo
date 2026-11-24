/* ---------- APP (TABS + LOADING) ---------- */

const THEME_KEY = 'app_theme_mobile';

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

function injectMotivationQuote() {
  const firstTab = document.querySelector(".tab");
  if (!firstTab) return;
  // Для спеціальних вкладок (Звички, Таймер, Нотатки, Завдання) цитату
  // рендерить сам модуль — не дублюємо й не перезаписуємо її.
  if (firstTab.dataset.tabName && CONFIG.specialTabs && CONFIG.specialTabs[firstTab.dataset.tabName]) {
    return;
  }
  const output = document.getElementById(`output-${firstTab.dataset.tabId}`);
  if (!output) return;
  const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  const el = document.createElement("div");
  el.className = "motivation-quote";
  el.textContent = quote;
  output.prepend(el);
}

function getTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
  } catch {}
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateFavicon() {
  const faviconMain = document.getElementById('favicon-main');
  if (faviconMain) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const url = isDark ? '../data/favicon_dark.png' : '../data/favicon_light.png';
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

// Слухаємо на зміну теми браузера (для десктопу; мобільні девайси мають свою логіку)
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const saved = localStorage.getItem(THEME_KEY);
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!saved && !isMobile) {
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

const TAB_ICONS = {
    "Звички": ICON('tabHabits', 14),
    "Таймер": ICON('tabTimer', 14),
    "Нотатки": ICON('tabNotes', 14),
    "Завдання": ICON('tabTasks', 14),
    "Код": ICON('tabCode', 14),
    "Закладки": ICON('tabBookmarks', 14),
    "Спорт": ICON('tabSport', 14),
    "Проектор": ICON('tabProjector', 14),
    "Робота": ICON('tabWork', 14),
};

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

function createTabs() {
  const tabsContainer = document.getElementById("tabs-container");
  const contentsContainer = document.getElementById("contents-container");

  // Завантажуємо збережений порядок табів, додаємо нові таби з конфігу.
  // Видаляємо зі збереженого порядку таби, яких більше немає в конфігу.
  const savedOrder = JSON.parse(localStorage.getItem("tabsOrder")) || [];
  // Видаляємо дублікати зі збереженого порядку
  const uniqueSavedOrder = [...new Set(savedOrder)];
  let tabsOrder = uniqueSavedOrder.filter((t) => CONFIG.tabs.includes(t));
  CONFIG.tabs.forEach((t) => {
    if (!tabsOrder.includes(t)) tabsOrder.push(t);
  });

  // Ініціалізуємо mobile dropdown
  const { moreWrapper, moreDropdown, extraTabNames } = MobileTabs.init(tabsOrder);

  tabsOrder.forEach((tabName, index) => {
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
    tabBtn.className = "tab" + (index === 0 ? " active" : "");
    // Нативний draggable НЕ вмикаємо — перетягування табів реалізовано
    // через SortableJS (див. initTabsSortable), щоб на сенсорних екранах
    // випадковий скрол/дотик не починав перетягування (довге затискання).
    tabBtn.onclick = () => switchTab(id);

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

    // Всі таби йдуть в один контейнер; зайві ховаються через CSS
    tabsContainer.appendChild(tabBtn);

    // Таби, що не влізли в перші MOBILE_VISIBLE_TABS — позначаємо для CSS-приховування
    if (extraTabNames.includes(tabName)) {
      tabBtn.classList.add("tab-extra");
    }

    // Перетягування табів ініціалізується через SortableJS у initTabsSortable()
    // (викликається після додавання всіх кнопок/елементів у контейнер), щоб
    // уникнути випадкового старту drag на сенсорних екранах.

    // Створюємо контент таба
    const content = document.createElement("div");
    content.id = `content-${id}`;
    content.className = "tab-content" + (index === 0 ? " active" : "");

    if (isSpecial) {
      content.innerHTML = `<div id="output-${id}"></div>`;
    } else {
      const quote = index === 0
        ? `<div class="motivation-quote">${motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]}</div>`
        : '';
      content.innerHTML = `
        <div id="output-${id}">${quote}</div>
      `;
    }
    contentsContainer.appendChild(content);

    // Для звичайних (bookmark) вкладок додаємо спільний мобільний
    // заголовок сторінки з назвою вкладки (як у Звичок/Завдань/Нотаток).
    if (!isSpecial && typeof MobileHeader !== "undefined") {
      MobileHeader.inject(content, tabName, undefined, undefined);
    }

    // Зберігаємо дані таба
    bookmarksData[id] = {
      path: fileName ? `${CONFIG.dir}/${fileName}` : null,
      name: tabName,
      special: isSpecial ? CONFIG.specialTabs[tabName] : null,
    };
  });

  // Додаємо кнопку "···" перед theme-toggle
  tabsContainer.appendChild(moreWrapper);

  // Theme toggle — в кінці рядка табів
  const themeBtn = document.createElement("button");
  themeBtn.className = "theme-toggle";
  themeBtn.addEventListener("click", toggleTheme);
  tabsContainer.appendChild(themeBtn);
  updateThemeButton(getTheme());

  // Gist sync button — після theme toggle (праворуч)
  const gistBtn = document.createElement("button");
  gistBtn.className = "gist-top-btn";
  gistBtn.id = "gist-top-btn";
  gistBtn.title = "Налаштування синхронізації";
  gistBtn.innerHTML = ICON('gistLocal', 16);
  gistBtn.addEventListener("click", async () => {
    if (typeof createGistSettingsModal !== "function") {
      await loadScriptsInOrder([
        "notes/storage.js",
        "../gist/notes-storage.js",
        "notes/file-storage.js",
        "../gist/notes-settings.js",
      ]);
    }
    if (typeof createGistSettingsModal === "function") createGistSettingsModal();
  });
  tabsContainer.appendChild(gistBtn);
  updateGistTopButton(gistBtn);

  // Перетягування табів через SortableJS (довге затискання на тачі, щоб
  // випадковий дотик/скрол не починав перетягування).
  if (!tabsContainer._tabSortable) {
    initTabsSortable(tabsContainer);
  }

  openTabFromHash();
}

// Миттєвий фідбек при перемиканні вкладок: показуємо спінер поверх
// контенту, доки триває асинхронне завантаження модуля (напр. Quill).
// Якщо дані вже в кеші — спінер майже не помітний, але ефект
// «зависання» на першому перемиканні зникає.
function showTabLoader(tabId) {
  const content = document.getElementById(`content-${tabId}`);
  if (!content) return;
  let loader = content.querySelector(":scope > .tab-content-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.className = "tab-content-loader";
    loader.innerHTML = '<div class="tab-content-spinner"></div>';
    content.appendChild(loader);
  }
  loader.classList.add("is-visible");
}

function hideTabLoader(tabId) {
  const content = document.getElementById(`content-${tabId}`);
  if (!content) return;
  const loader = content.querySelector(":scope > .tab-content-loader");
  if (loader) loader.classList.remove("is-visible");
}

function replayTabIcon(tab) {
  const svg = tab.querySelector("svg");
  if (!svg) return;
  svg.getAnimations().forEach((a) => a.cancel());
  svg.animate(
    [
      { transform: "rotate(0)" },
      { transform: "rotate(-12deg)" },
      { transform: "rotate(12deg)" },
      { transform: "rotate(0)" },
    ],
    { duration: 350, easing: "ease" }
  );
}

async function switchTab(tabId) {
  // Якщо таб уже активний — не перемикаємо повторно (інакше при
  // багаторазовому кліку по тому ж табу перезапускається CSS-перехід
  // кольору іконки й повторно ререндеряться модулі → видиме мерехтіння).
  const targetTab = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (targetTab && targetTab.classList.contains("active")) {
    replayTabIcon(targetTab);
    return;
  }

  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  targetTab.classList.add("active");
  replayTabIcon(targetTab);
  document.getElementById(`content-${tabId}`).classList.add("active");

  // Скидаємо прокрутку сторінки при перемиканні вкладки: інакше з довгої
  // прокрученої вкладки (напр. закладки) на коротку без скролу (завдання)
  // браузер різко «стрибає», затискаючи scrollY до 0.
  window.scrollTo(0, 0);

  // Закриваємо dropdown якщо відкритий
  MobileTabs.closeDropdown();

  // Зберігаємо останній відкритий таб
  localStorage.setItem("lastTab", tabId);

  window.location.hash = tabId;

  // «Нотатки»/«Швидкі нотатки» тягнуть Quill з CDN — найдовша
  // операція. Свій окремий спінер НЕ показуємо: на старті це
  // дублювало б app-preloader (два спінери підряд), а після запуску
  // Quill уже в кеші й завантажується миттєво. Поки нотатки
  // ініціалізуються на старті, користувач бачить лише preloader.
  const needsAsync = tabId === "notes" || tabId === "quick-notes";

  if (needsAsync && typeof ensureNotesLoaded === "function") {
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
    if (typeof currentDataset !== 'undefined') currentDataset = 'tasks';
    renderTasksActions();
  } else if (tabId === "code" && typeof renderTasksActions === "function") {
    if (typeof currentDataset !== 'undefined') currentDataset = 'code';
    renderTasksActions();
  } else {
    const tasksActions = document.getElementById("tasksActions");
    if (tasksActions) tasksActions.remove();
  }

  if (tabId === "tasks") {
    const output = document.getElementById("output-tasks");
    if (output && typeof renderTasksUI === "function") {
      renderTasksUI(output);
    }
  } else if (tabId === "code") {
    const output = document.getElementById("output-code");
    if (output && typeof renderCodeTasksUI === "function") {
      renderCodeTasksUI(output);
    }
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

  // Окремий спінер нотаток більше не показуємо (див. вище):
  // на старті його роль виконує app-preloader, а після запуску
  // Quill уже в кеші й нотатки з'являються миттєво.
}

function openTabFromHash() {
  const hash = window.location.hash.replace("#", "");
  let targetId = null;
  if (hash && document.querySelector(`[data-tab-id="${hash}"]`)) {
    targetId = hash;
  } else if (document.querySelector('[data-tab-id="habits"]')) {
    // За замовчуванням відкриваємо вкладку «Звички» (першу в CONFIG.tabs),
    // а не останній збережений таб — інакше застосунок стартував би
    // на Таймері/іншому табі після перезавантаження.
    targetId = "habits";
  }
  if (!targetId) return;

  // Скидаємо стан "active", який createTabs проставляє першому табу за
  // замовчуванням. Інакше switchTab завершиться раніше часу (бо таб уже
  // активний) і не виконає lazy-init модуля (напр. initHabits) — тоді при
  // перезавантаженні на #habits звички не рендеряться, доки не перемкнути
  // таб туди-назад.
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

async function loadDirectory() {
  createTabs();
  // Вимірюємо висоту таб-бара одразу після його створення, поки контент
  // вкладок (Звички тощо) ще не відрендерено — щоб резерв знизу (body
  // padding-bottom) був правильним з першого кадру і не «дьоргав» вміст
  // угору/вниз після появи карток.
  if (typeof MobileChrome !== "undefined" && MobileChrome.measure) MobileChrome.measure();

  const loadPromises = CONFIG.tabs.map(async (tabName, index) => {
    const isSpecial = CONFIG.specialTabs && CONFIG.specialTabs[tabName];
    if (isSpecial) {
      const id = CONFIG.specialTabs[tabName];
      if (id === "tasks" && typeof initTasks === "function") {
        initTasks();
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
  });

  await Promise.allSettled(loadPromises);

  // Якщо на старті активна вкладка «Нотатки»/«Швидкі нотатки»,
  // тримаємо app-preloader, доки вони не ініціалізуються, — тоді
  // користувач бачить один спінер (додатку), а потім одразу нотатки,
  // без окремого спінера нотаток.
  const activeTabEl = document.querySelector(".tab.active");
  const activeId = activeTabEl ? activeTabEl.dataset.tabId : null;
  if (
    (activeId === "notes" || activeId === "quick-notes") &&
    typeof ensureNotesLoaded === "function"
  ) {
    await ensureNotesLoaded();
  }

  const preloader = document.getElementById("preloader");
  preloader.classList.add("hidden");
  injectMotivationQuote();
}

function injectMotivationQuote() {
  document.querySelectorAll(".tab-content:not(.special)").forEach((content) => {
    if (content.querySelector(".motivation-quote")) return;
    if (content.querySelector(".bookmark-item")) return;
    const output = content.querySelector(`#output-${content.id.replace("content-", "")}`);
    if (!output || output.children.length) return;
    const quote = `<div class="motivation-quote">${motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]}</div>`;
    output.innerHTML = quote;
  });
}

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const isInput =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    document.activeElement?.isContentEditable;

  if (e.key === "Escape" && isInput) {
    document.activeElement.blur();
  }
});

/* ---------- DRAG-AND-DROP ДЛЯ ТАБІВ (ПАПОК) ----------
   Перетягування табів реалізовано через SortableJS — так само, як у нотатках
   і завданнях. forceFallback: true вимикає нативний drag браузера (і його
   напівпрозорий «знімок» біля курсора), а на сенсорних екранах delay +
   delayOnTouchOnly вимагають коротке затискання (long-press), тому випадковий
   скрол/дотик пальцем не починає перетягування й не спричиняє небажаного
   перезавантаження/перестановки вкладки. Для миші на десктопі drag стартує
   миттєво, як і раніше. */

function initTabsSortable(tabsContainer) {
  if (typeof Sortable === "undefined") {
    console.warn("SortableJS не завантажено — drag-and-drop табів вимкнено.");
    return;
  }

  // Знищуємо попередній інстанс, щоб повторні виклики не дублювали обробники.
  if (tabsContainer._tabSortable) {
    tabsContainer._tabSortable.destroy();
  }

  function persistOrder() {
    // Новий порядок табів (лише .tab, без theme-toggle/gist/···).
    const newOrder = [...tabsContainer.querySelectorAll(".tab")].map(
      (tab) => tab.dataset.tabName,
    );
    const uniqueOrder = [...new Set(newOrder)];
    localStorage.setItem("tabsOrder", JSON.stringify(uniqueOrder));

    // Переставляємо відповідний контент у тому ж порядку.
    const contentsContainer = document.getElementById("contents-container");
    if (!contentsContainer) return;
    uniqueOrder.forEach((tabName) => {
      const tabEl = [...tabsContainer.querySelectorAll(".tab")].find(
        (t) => t.dataset.tabName === tabName,
      );
      const content = document.getElementById(`content-${tabEl.dataset.tabId}`);
      if (content) contentsContainer.appendChild(content);
    });
  }

  tabsContainer._tabSortable = Sortable.create(tabsContainer, {
    draggable: ".tab",
    // Таби, сховані в dropdown «···», не можна схопити за край.
    filter: ".tab-extra",
    preventOnFilter: false,
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    swapThreshold: 0.5,
    invertSwap: false,
    // На сенсорних екранах — коротке затискання, щоб випадковий рух
    // пальцем не починав перетягування таба. Миша на десктопі стартує
    // миттєво (delayOnTouchOnly).
    delay: 200,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    onStart() {
      document.body.classList.add("tabs-dragging");
    },
    onEnd() {
      document.body.classList.remove("tabs-dragging");
      persistOrder();
      if (typeof MobileTabs !== "undefined" && MobileTabs.refreshExtra) {
        MobileTabs.refreshExtra();
      }
    },
  });
}

function sortTabsByOrder() {
  const allTabs = CONFIG.tabs || [];
  const savedOrder = JSON.parse(localStorage.getItem("tabsOrder")) || [];
  const uniqueSavedOrder = [...new Set(savedOrder)];
  let tabsOrder = uniqueSavedOrder.filter((t) => allTabs.includes(t));
  allTabs.forEach((t) => {
    if (!tabsOrder.includes(t)) tabsOrder.push(t);
  });

  const tabsContainer = document.getElementById("tabs-container");
  if (!tabsContainer) return;

  const moreWrapper = tabsContainer.querySelector(".tab-more-wrapper");
  const themeBtn = tabsContainer.querySelector(".theme-toggle");
  const gistBtn = tabsContainer.querySelector(".gist-top-btn");

  const tabs = [...tabsContainer.querySelectorAll(".tab")];
  tabs.forEach(tab => tab.remove());

  tabsOrder.forEach((tabName) => {
    const tab = tabs.find(t => t.dataset.tabName === tabName);
    if (tab) {
      if (moreWrapper) {
        tabsContainer.insertBefore(tab, moreWrapper);
      } else if (themeBtn) {
        tabsContainer.insertBefore(tab, themeBtn);
      } else {
        tabsContainer.appendChild(tab);
      }
    }
  });

  if (typeof MobileTabs !== 'undefined' && MobileTabs.refreshExtra) {
    MobileTabs.refreshExtra();
  }
}

function openTabsOrderModal() {
  const allTabs = CONFIG.tabs || [];
  const savedOrder = JSON.parse(localStorage.getItem("tabsOrder")) || [];
  const uniqueSavedOrder = [...new Set(savedOrder)];
  let tabsOrder = uniqueSavedOrder.filter((t) => allTabs.includes(t));
  allTabs.forEach((t) => {
    if (!tabsOrder.includes(t)) tabsOrder.push(t);
  });

  const MOBILE_VISIBLE_TABS = 4;
  const visibleCount = Math.min(MOBILE_VISIBLE_TABS, tabsOrder.length);

  let tabsListHTML = tabsOrder.map((tabName, index) => {
    const isVisible = index < visibleCount;
    const badge = isVisible ? '<span class="tab-order-badge visible">показано</span>' : '<span class="tab-order-badge hidden">приховано</span>';
    const icon = TAB_ICONS[tabName] ? TAB_ICONS[tabName] : '';
    return `
      <div class="tab-order-item" data-tab-name="${tabName}" draggable="true">
        <span class="tab-order-handle">☰</span>
        <span class="tab-order-icon">${icon}</span>
        <span class="tab-order-label">${tabName}</span>
        ${badge}
      </div>
    `;
  }).join('');

  const bodyHTML = `
    <div class="tab-order-container">
      <p class="tab-order-hint">Перетягуйте для зміни порядку. Перші ${visibleCount} вкладок видимі на головній, решта в меню.</p>
      <div class="tab-order-list" id="tabsOrderList">
        ${tabsListHTML}
      </div>
    </div>
  `;

  openSettingsModal({
    title: 'Упорядкування вкладок',
    bodyHTML: bodyHTML,
    footerHTML: '<button class="modal-btn modal-btn--primary modal-btn--block" data-close>Готово</button>',
    key: 'tabs-order-modal',
    onMount: (overlay) => {
      const listEl = overlay.querySelector('#tabsOrderList');
      if (listEl && typeof Sortable !== 'undefined') {
        Sortable.create(listEl, {
          animation: 150,
          handle: '.tab-order-handle',
          ghostClass: 'tab-order-ghost',
          onEnd: () => {
            const newOrder = [];
            listEl.querySelectorAll('.tab-order-item').forEach((item, index) => {
              newOrder.push(item.dataset.tabName);
              const badge = item.querySelector('.tab-order-badge');
              if (badge) {
                if (index < visibleCount) {
                  badge.className = 'tab-order-badge visible';
                  badge.textContent = 'видимо';
                } else {
                  badge.className = 'tab-order-badge hidden';
                  badge.textContent = 'параметри';
                }
              }
            });
            localStorage.setItem("tabsOrder", JSON.stringify(newOrder));
            sortTabsByOrder();
          }
        });
      }
    },
    onClose: () => {
      sortTabsByOrder();
    }
  });
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
