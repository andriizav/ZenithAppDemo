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
    "docs.google.com/document": "data/favicons/document.ico",
    "docs.google.com/spreadsheets": "data/favicons/spreadsheets.ico",
    "onlinevkino.com": "data/favicons/default.png",
  },

  tabs: ["Звички", "Завдання", "Код", "Нотатки", "Таймер"/*, "Закладки"*/],

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

// Оголошуємо глобально, щоб модулі нотаток (gist-settings, ui) могли звертатися
// до неї навіть до повного завантаження модуля нотаток.
var notesActiveTopic = null;

function injectBody() {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div class="tabs" id="tabs-container"></div>' +
      '<div id="contents-container"></div>',
  );
}

function loadOneScript(src, retries = 3) {
  return new Promise((resolve, reject) => {
    // Якір резервує позицію скрипта в DOM одразу (синхронно), незалежно від
    // того, коли інші паралельно завантажувані скрипти встигнуть вставити свої
    // теги. Це дозволяє запускати мережеві запити всіх скриптів одночасно
    // (замість послідовної черги «один за одним»), водночас гарантуючи
    // виконання у правильному порядку через async=false + стабільну DOM-позицію.
    const anchor = document.createComment("script-slot: " + src);
    document.body.appendChild(anchor);
    let attempt = 0;
    const tryLoad = () => {
      attempt++;
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
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

// Запускає завантаження всіх скриптів одразу — мережеві запити йдуть паралельно,
// а порядок виконання (важливий через залежності між модулями) гарантується
// async=false разом зі стабільною позицією кожного тега в DOM.
function loadScriptsInOrder(srcs) {
  return Promise.all(srcs.map((src) => loadOneScript(src)));
}

// Ідемпотентне завантаження окремого скрипту: один і той самий src
// завантажується і виконується лише один раз, незалежно від кількості викликів
// (навіть паралельних). Запобігає redeclaration при повторних викликах.
const _scriptOnceCache = new Set();
function loadScriptOnce(src) {
  if (_scriptOnceCache.has(src)) return Promise.resolve();
  const p = loadOneScript(src).then(
    () => {},
    (err) => {
      // Не кешуємо невдалі спроби — дамо повторити.
      _scriptOnceCache.delete(src);
      throw err;
    }
  );
  // Позначаємо одразу, щоб паралельні виклики не створили другий тег.
  _scriptOnceCache.add(src);
  return p;
}

// Відкриває вікно налаштувань синхронізації (Gist). Завантажує лише ті скрипти,
// що потрібні для модалки, ідемпотентно — без дублювання (Quill/notes не тягнуться).
// Модалка працює з першого кліку, навіть якщо модуль нотаток ще не завантажений.
let _gistSettingsPromise = null;
function openGistSettingsModal() {
  if (typeof createGistSettingsModal === "function") {
    createGistSettingsModal();
    return Promise.resolve();
  }
  if (!_gistSettingsPromise) {
    _gistSettingsPromise = (async () => {
      // shared/delete-modal.js уже в core; довантажуємо лише залежності модалки.
      await loadScriptOnce("gist/sync-base.js");
      await loadScriptOnce("gist/notes-storage.js");
      await loadScriptOnce("notes/file-storage.js");
      await loadScriptOnce("gist/notes-settings.js");
    })();
  }
  return _gistSettingsPromise.then(() => {
    if (typeof createGistSettingsModal === "function") createGistSettingsModal();
  });
}

// Lazy-модулі вкладок: завантажуються при першому відкритті відповідної
// вкладки (з switchTab у js/app.js), а не в критичному шляху старту.
// Для активної при старті вкладки прелоад запускається одразу (див. нижче),
// для решти — у фоні через requestIdleCallback.
const TAB_MODULES = {
  habits: [
    "habits/icons.js",
    "habits/templates.js",
    "habits/habit-card.js",
    "habits/ui-tools.js",
    "habits/modals.js",
    "habits/data-manager.js",
    "habits/date-utils.js",
    "habits/reminders.js",
    "habits/statistics.js",
    "habits/habit-interactions.js",
    "habits/habits.js",
    "habits/habits-resize.js",
    "habits/habits-paint.js",
    "gist/habits-storage.js",
  ],
  timer: [
    "timer/sounds-data.js",
    "gist/timer-storage.js",
    "timer/timer.js",
  ],
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

// Ідемпотентне підключення CSS. Використовується для стилів, які не потрібні
// для першого рендеру (напр. Quill для нотаток) — щоб не блокувати старт.
const _styleOnceCache = new Set();
function loadStyleOnce(href) {
  if (_styleOnceCache.has(href)) return;
  _styleOnceCache.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

// Lazy-завантаження модуля нотаток (CSS + JS). Викликається з switchTab при першому
// відкритті вкладки "Нотатки".
let _notesScriptsPromise = null;
let _notesInitPromise = null;

// Підвантажує лише скрипти модуля (без initNotes), щоб повторні виклики не
// завантажували CDN/скрипти вдруге. Використовується і для фонового прелоаду.
function loadNotesScripts() {
  if (_notesScriptsPromise) return _notesScriptsPromise;
  // CSS тулбару Quill потрібен лише нотаткам — підключаємо разом із модулем,
  // а не в <head> (там він блокував перший рендер запитом на чужий домен).
  loadStyleOnce("https://cdn.quilljs.com/2.0.3/quill.snow.css");
  _notesScriptsPromise = loadScriptsInOrder([
    "https://cdn.quilljs.com/2.0.3/quill.js",
    "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js",
    "notes/storage.js",
    "notes/file-storage.js",
    "gist/notes-storage.js",
    "notes/utils.js",
    "notes/ui.js",
    "notes/drag-drop.js",
    "notes/events.js",
    "notes/notes.js",
    "gist/notes-settings.js",
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

(async () => {
  const allowed = true;
  if (!allowed) {
    window.location.replace("about:blank");
    return;
  }

  // Preloader залишається видимим (поверх нього працює локскрін) і
  // ховається лише після повного завантаження табів у loadDirectory().
  injectBody();

  // Таб, який відкриється при старті — його модуль потрібен одразу, тож
  // вантажимо його паралельно з core, а не другою хвилею запитів.
  // Логіка дзеркалить openTabFromHash() у js/app.js.
  let _startupTab = null;
  try {
    _startupTab =
      window.location.hash.replace("#", "") ||
      localStorage.getItem("lastTab") ||
      "habits";
  } catch (e) {
    _startupTab = "habits";
  }

  // Пряме відкриття за посиланням #notes починається без вибраної нотатки.
  // Відсутній ключ = порожній редактор; клік по нотатці знову його збереже.
  // Звичайне завантаження сторінки (навіть якщо lastTab === notes) цього не робить.
  if (window.location.hash.replace("#", "") === "notes") {
    notesActiveTopic = null;
    try { localStorage.removeItem("notes_active_topic"); } catch (e) {}
  }

  // Core: bookmarks + tasks + app. initTasks() викликається з loadDirectory()
  // для всіх спец-табів, тож tasks лишається в критичному шляху.
  // Звички/Таймер/Нотатки — lazy, підвантажуються при відкритті вкладки.
  await loadScriptsInOrder([
    "js/icons.js",
    "shared/delete-modal.js",
    "gist/sync-base.js",
    "gist/tab-coordinator.js",
    "js/bookmarks.js",
    "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js",
    "tasks/drag-drop.js",
    "tasks/tasks.js",
    "gist/tasks-storage.js",
    ...(TAB_MODULES[_startupTab] || []),
    "js/app.js",
  ]);
  // Позначаємо модуль стартової вкладки як уже завантажений, щоб switchTab
  // не намагався підвантажити ті самі скрипти вдруге.
  if (TAB_MODULES[_startupTab]) {
    TAB_MODULES[_startupTab].forEach((s) => _scriptOnceCache.add(s));
    _tabModulePromises[_startupTab] = Promise.resolve();
  }

  loadDirectory();

  // Фоновий прелоад модулів решти вкладок — щоб перше перемикання туди
  // не чекало мережі. Запускається лише коли браузер вільний.
  const preloadOtherTabs = () => {
    Object.keys(TAB_MODULES).forEach((id) => {
      if (id !== _startupTab) loadTabModule(id).catch(() => {});
    });
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(preloadOtherTabs, { timeout: 3000 });
  } else {
    setTimeout(preloadOtherTabs, 500);
  }

  // Фонове підвантаження скриптів модуля нотаток (Quill + JS), щоб перемикання
  // на вкладку «Нотатки» не чекало CDN/скриптів на перший клік. Саму ініціалізацію
  // (initNotes/Quill) залишаємо на момент відкриття вкладки — щоб редактор
  // ініціалізувався вже видимим, без проблем з розмірами прихованого контейнера.
  // requestIdleCallback запускає прелоад одразу, як тільки браузер вільний від
  // критичного рендеру (замість фіксованої затримки 1500мс, яка на швидких
  // пристроях лише затримує готовність нотаток без потреби).
  const preloadNotes = () => {
    if (typeof loadNotesScripts === "function") loadNotesScripts();
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(preloadNotes, { timeout: 2000 });
  } else {
    setTimeout(preloadNotes, 300);
  }
})();
