/* ========== ГОЛОВНИЙ ФАЙЛ ========== */

/* ============ НАЛАШТУВАННЯ ============ */

const CONFIG = {
  secretKeyHash: "",

  disablePinOnLocalNetwork: true,

  dir: "bookmarks",

  ui: {
    titleSuffix: "Посилання",
    showCounts: true,
  },

  cleanTitleSites: ["YouTube", "Google Диск", "Google Drive"],

  customIcons: {
    "docs.google.com/document": "../data/favicons/document.ico",
    "docs.google.com/spreadsheets": "../data/favicons/spreadsheets.ico",
    "onlinevkino.com": "../data/favicons/default.png",
  },

  tabs: ["Звички", "Завдання", "Нотатки", "Таймер", "Код"/*, "Закладки"*/],

  specialTabs: {
    Звички: "habits",
    Таймер: "timer",
    Нотатки: "notes",
    Завдання: "tasks",
    Код: "code",
  },
};

/* ============ КІНЕЦЬ НАЛАШТУВАНЬ ============ */

// Глобальні змінні
const bookmarksData = {};

// Оголошуємо глобально, щоб модулі нотаток (gist-storage, ui) могли звертатися
// до неї навіть до повного завантаження модуля нотаток.
var notesActiveTopic = null;

function injectBody() {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div class="tabs" id="tabs-container"></div>' +
      '<div id="contents-container"></div>',
  );
}

// УВАГА: не додаємо ?v=… cache-bust — він робив би URL унікальним
// щоразу й SW-кеш ніколи б не спрацьовував. Свіжість коду забезпечує
// CACHE_VERSION у sw.js (збільшуйте його при деплої).
function loadOneScript(src, retries = 3) {
  return new Promise((resolve, reject) => {
    // Якір резервує позицію скрипта в DOM одразу (синхронно), незалежно від
    // того, коли інші паралельно завантажувані скрипти вставлять свої теги.
    // Так мережеві запити йдуть одночасно, а порядок виконання гарантується
    // async=false разом зі стабільною DOM-позицією.
    const anchor = document.createComment("script-slot: " + src);
    document.body.appendChild(anchor);
    let attempt = 0;
    const tryLoad = () => {
      attempt++;
      const s = document.createElement("script");
      s.src = src;
      s.async = false; // зберігає порядок виконання попри паралельне завантаження
      s.onload = () => resolve();
      s.onerror = () => {
        s.remove();
        if (attempt < retries) setTimeout(tryLoad, 300);
        else reject(new Error("Не вдалося завантажити скрипт: " + src));
      };
      document.body.insertBefore(s, anchor.nextSibling);
    };
    tryLoad();
  });
}

// Завантажує всі скрипти паралельно (download), але гарантує порядок
// виконання через async=false. Це прибирає послідовні round-trip'и при старті
// (раніше кожен скрипт чекав попереднього), тож старт помітно швидший.
async function loadScriptsInOrder(srcs) {
  await Promise.all(srcs.map((src) => loadOneScript(src)));
}

// Ідемпотентне завантаження окремого скрипту: один і той самий src
// виконується лише один раз, незалежно від кількості (навіть паралельних)
// викликів. Запобігає redeclaration при повторних викликах.
const _scriptOnceCache = new Set();
function loadScriptOnce(src) {
  if (_scriptOnceCache.has(src)) return Promise.resolve();
  const p = loadOneScript(src).then(
    () => {},
    (err) => {
      // Не кешуємо невдалі спроби — дамо повторити.
      _scriptOnceCache.delete(src);
      throw err;
    },
  );
  // Позначаємо одразу, щоб паралельні виклики не створили другий тег.
  _scriptOnceCache.add(src);
  return p;
}

// Lazy-модулі вкладок: завантажуються при першому відкритті вкладки
// (зі switchTab у js/app.js), а не в критичному шляху старту. Модуль
// активної при старті вкладки входить у стартовий бандл (див. нижче),
// решта — фоновим прелоадом через requestIdleCallback.
const TAB_MODULES = {
  habits: [
    "habits/icons.js",
    "habits/date-utils.js",
    "habits/reminders.js",
    "habits/statistics.js",
    "habits/templates.js",
    "habits/habit-card.js",
    "habits/ui-tools.js",
    "habits/modals.js",
    "habits/data-manager.js",
    "habits/habit-interactions.js",
    "habits/habits.js",
    "../gist/habits-storage.js",
  ],
  timer: ["timer/sounds-data.js", "../gist/timer-storage.js", "timer/timer.js"],
};

const _tabModulePromises = {};
function loadTabModule(tabId) {
  const srcs = TAB_MODULES[tabId];
  if (!srcs) return Promise.resolve();
  if (!_tabModulePromises[tabId]) {
    // loadScriptOnce зберігає порядок (async=false + DOM-якір) і не дублює
    // скрипти, якщо модуль уже підтягнули фоновим прелоадом.
    _tabModulePromises[tabId] = Promise.all(srcs.map((s) => loadScriptOnce(s)));
  }
  return _tabModulePromises[tabId];
}

// Lazy-завантаження модуля нотаток (CSS + JS). Викликається з switchTab при першому
// відкритті вкладки "Нотатки".
let _notesScriptsPromise = null;
let _notesInitPromise = null;

// Підвантажує лише скрипти модуля (без initNotes), щоб повторні виклики не
// завантажували CDN/скрипти вдруге. Використовується і для фонового прелоаду.
function loadNotesScripts() {
  if (_notesScriptsPromise) return _notesScriptsPromise;
  _notesScriptsPromise = loadScriptsInOrder([
    "vendor/quill.js",
    "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js",
    "../gist/notes-storage.js",
    "notes/file-storage.js",
    "notes/storage.js",
    "notes/utils.js",
    "notes/mobile.js",
    "notes/ui.js",
    "notes/drag-drop.js",
    "notes/events.js",
    "notes/notes.js",
    "../gist/notes-settings.js",
  ]);
  return _notesScriptsPromise;
}

// Завантажує скрипти (з кешем) і запускає initNotes рівно один раз.
function ensureNotesLoaded() {
  if (_notesInitPromise) return _notesInitPromise;
  _notesInitPromise = (async () => {
    await loadNotesScripts();
    if (typeof initNotes === "function") initNotes();
  })();
  return _notesInitPromise;
}

// Реєстрація Service Worker (миттєвий повторний візит + офлайн).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  });
}

// Підключає основні стилі додатку ДИНАМІЧНО, лише після того, як локскрін
// пройдено. Під час показу локскріну сторінка використовує виключно
// login/login.css (див. index.html). quill.snow.css ОБОВ'ЯЗКОВИЙ для
// відображення/роботи тулбару Quill — без нього кнопки є в DOM, але невидимі.
function loadAppStyles() {
  if (window.__appStylesLoaded) return;
  window.__appStylesLoaded = true;
  // Порядок важливий: змінні → вендор → база → модулі → спільні
  // компоненти → app shell → тема. Розділені стилі (замість одного
  // mobile.css через @import, який блокується CSP/PWA).
  //
  // CRITICAL — потрібні для першого рендеру шелла (вкладки, фон, тема).
  // Вставляються звичайними блокуючими <link>, щоб не було спалаху
  // нестилізованого контенту.
  const CRITICAL = [
    "css/variables.css",
    "css/base.css",
    "css/components/modal.css",
    "css/app.css",
    "css/themes/light.css",
  ];
  // DEFERRED — стилі окремих сторінок/модулів. Їх вміст не видно, доки не
  // відкрито відповідну вкладку, тож вантажимо неблокуюче: media="print"
  // не блокує рендер, onload повертає media="all". Порядок у каскаді
  // зберігається позицією <link> у head, а не моментом завантаження.
  const DEFERRED = [
    "css/vendor/quill.snow.css",
    "css/pages/habits/base.css",
    "css/pages/habits/cards.css",
    "css/pages/habits/archive.css",
    "css/pages/habits/statistics.css",
    "css/pages/habits/modals.css",
    "css/pages/habits/settings.css",
    "css/pages/habits/context-menu.css",
    "css/pages/notes.css",
    "css/pages/tasks.css",
    "css/pages/timer.css",
  ];

  const addLink = (href, deferred) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    if (deferred) {
      link.media = "print";
      link.onload = () => {
        link.media = "all";
      };
    }
    document.head.appendChild(link);
  };

  // Спершу variables.css (від нього залежать усі інші), далі відкладені
  // модульні стилі, і вже потім решта критичних — так у каскаді модульні
  // стилі стоять перед app.css/light.css, як і в початковому порядку.
  addLink(CRITICAL[0], false);
  DEFERRED.forEach((href) => addLink(href, true));
  CRITICAL.slice(1).forEach((href) => addLink(href, false));
}

(async () => {
  const allowed = true;
  if (!allowed) {
    window.location.replace("about:blank");
    return;
  }

  loadAppStyles();
  injectBody();

  // Вкладка, яка відкриється при старті — її модуль вантажимо відразу
  // паралельно з core, а не другою хвилею запитів після нього (інакше
  // саме при відкритті вкладки була б пауза на мережу).
  // Логіка дзеркалить openTabFromHash() у js/app.js.
  let _startupTab = "habits";
  try {
    _startupTab =
      window.location.hash.replace("#", "") ||
      localStorage.getItem("lastTab") ||
      "habits";
  } catch (e) {}

  // Пряме відкриття за посиланням #notes починається без вибраної нотатки.
  // Відсутній ключ = порожній редактор; клік по нотатці знову його збереже.
  if (window.location.hash.replace("#", "") === "notes") {
    notesActiveTopic = null;
    try { localStorage.removeItem("notes_active_topic"); } catch (e) {}
  }

  // Core: bookmarks + tasks + app. initTasks()/initCodeTasks() викликаються
  // з loadDirectory() для всіх спец-вкладок, тож tasks лишається в
  // критичному шляху. Звички/Таймер/Нотатки — lazy, при відкритті вкладки.
  await loadScriptsInOrder([
    "../js/icons.js",
    "../gist/sync-base.js",
    "../gist/tab-coordinator.js",
    "js/bookmarks.js",
    "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js",
    "tasks/drag-drop.js",
    "tasks/tasks.js",
    "../gist/tasks-storage.js",
    ...(TAB_MODULES[_startupTab] || []),
    "js/app.js",
  ]);
  // Позначаємо модуль стартової вкладки як завантажений, щоб switchTab
  // не тягнув ті самі скрипти вдруге.
  if (TAB_MODULES[_startupTab]) {
    TAB_MODULES[_startupTab].forEach((s) => _scriptOnceCache.add(s));
    _tabModulePromises[_startupTab] = Promise.resolve();
  }

  loadDirectory();

  // Фоновий прелоад решти модулів вкладок + нотаток (Quill + JS): скрипти
  // встигають потрапити в кеш до першого перемикання, тож перехід не чекає
  // мережі. Не блокує старт — запускається, коли браузер вільний.
  const preloadRest = () => {
    Object.keys(TAB_MODULES).forEach((id) => {
      if (id !== _startupTab) loadTabModule(id).catch(() => {});
    });
    if (typeof loadNotesScripts === "function") loadNotesScripts();
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(preloadRest, { timeout: 3000 });
  } else {
    setTimeout(preloadRest, 500);
  }
})();
