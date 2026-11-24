# ZenithApp

Особистий застосунок для продуктивності: вкладки зі звичками, завданнями за
матрицею Айзенхауера, нотатками, таймером табуатою, «кодовими» завданнями та
закладками. Це статичний PWA на чистому JavaScript — без фреймворку, без
збірки, без `package.json`: усі файли віддаються з сервера як є. Має дві
незалежні версії з однаковим дизайном — десктопну (`index.html`) і мобільну
(`mobile/`), кожна зі своїм Service Worker. Увесь стан лежить у `localStorage`,
а за бажанням синхронізується з GitHub Gist. Інтерфейс повністю українською.

Потрібний сучасний браузер (Service Worker, `requestIdleCallback`, Web Worker) і
Python 3 — лише для локального статичного сервера. Прод розміщено на Vercel
(є `vercel.json` з редиректом `/mobile` → `/mobile/`), підійде будь-який
статичний хостинг.

## Встановлення / Запуск

Збірки немає — клонуйте репозиторій і підніміть статичний сервер у корені:

```bash
python -m http.server 8000
```

- Десктоп: `http://localhost:8000/`
- Мобільна версія: `http://localhost:8000/mobile/`

Під час розробки варто вимкнути Service Worker у DevTools → Application →
Service Workers, інакше зміни з'їдає кеш. Перевірити синтаксис JS (тестів
немає):

```bash
node --check tasks/tasks.js
node --check habits/habits.js
node --check notes/events.js
node --check gist/tab-coordinator.js
```

## Можливості

| Вкладка | Модуль | Що вміє |
|---|---|---|
| Звички | `habits/` | картки з heatmap за рік, серії, «напіввиконано», пропуски, типи good/bad, категорії з кольорами, нагадування через Notification, статистика, архів, експорт/імпорт даних |
| Завдання | `tasks/` | матриця Айзенхауера (4 квадранти), drag-and-drop між квадрантами, повтори (щодня / тижня / місяць), підзавдання, проєкти з кольорами, мітки, експорт/імпорт JSON |
| Код | `tasks/` + `code` | той самий модуль завдань, окремий датасет `code_tasks_data` |
| Нотатки | `notes/` | редактор Quill, теми з групами й перетягуванням, контекстні меню, дублювання/перейменування/видалення, збереження у файл через File System Access API |
| Таймер | `timer/` | фази warmup → робота → відпочинок → cooldown, раунди, власні пресети, звуки з WAV + Web Audio, «звукова лабораторія» |
| Закладки | `js/bookmarks.js` | XBEL-файли, favicon з Google s2 (кеш у SW), очищення назв, сепаратори floccus, пошук |

Плюс до вкладок: переставляння табів мишкою, пошук клавішею `/` або `f`,
перемикання світлої/темної теми, мотиваційні цитати (клік — наступна),
мобільна версія за кнопкою-телефоном.

## Налаштування / Опції

- `js/main.js` → об'єкт `CONFIG`: список вкладок `tabs`, мапа `specialTabs`,
  папка закладок `dir`, список `customIcons` та `cleanTitleSites`.
- Синхронізація: кнопка вгорі праворуч відкриває модалку
  (`gist/notes-settings.js`). Налаштування зберігаються в `gist_config`.
- Сховище: усе в `localStorage`. Ключі — `app_theme` / `app_theme_mobile`
  (тема), `tabsOrder` (порядок вкладок), `hiddenTabs` (приховані вкладки
  desktop-версії), `lastTab`, `habits`,
  `habitsSchemaVersion`, `tasks_data`, `code_tasks_data`, `notes_data`,
  `notes_topics`, `notes_name_map`, `tabataPresets`, `gist_config`,
  `gist_last_modified_<dataset>`, `gist_deleted_<dataset>`.
- Теми та розміри: CSS-змінні в `:root`, світла — у `:root[data-theme="light"]`.
  Ширини панелей запам'ятовуються (`notes_sidebar_width`,
  `notes_layout_width`, `tasks_container_width`).

## Структура

```
index.html                    оболонка десктопу: світла тема в <style>, preloader
js/
  main.js                     CONFIG, порядок завантаження скриптів, реєстрація SW
  app.js                      вкладки, перемикання, тема, цитати, пошук, drag-and-drop табів
  bookmarks.js                розбір XBEL, рендер закладок, favicon, підказки
  icons.js                    ICON(name, size) — усі SVG-іконки (Lucide)
login/                        екран входу: стилі та звук
habits/                       картки, heatmap, серії, статистика, архів, нагадування, модалки
tasks/                        матриця Айзенхауера, повтори, підзавдання, проєкти, drag-drop
notes/                        Quill-нотатки: сховище, UI, події, контекстні меню, файл
timer/                        таймер табуати, звуки, пресети
gist/                         синхронізація notes/habits/tasks/timer + координатор вкладок
shared/                       delete-modal.js, habits-quotes.js — спільне для обох версій
css/                          main.css, modals.css, gradient-button.css
bookmarks/                    дані закладок у форматі .xbel (test1.xbel ... test3.xbel)
data/                         favicon-*.png, іконки Google Документів і Таблиць (.ico)
demo/                         чернетки UI: цитати, швидке додавання у квадранти
scripts/                      check-habits-syntax.js, check-mobile-habits-syntax.js
sw.js                         Service Worker: SWR для коду, network-first для .xbel
vercel.json                   редирект /mobile -> /mobile/
mobile/                       окрема копія під телефон: app-view.html + власні css/js/sw
  index.html                  вузький екран -> app-view.html, широкий -> iframe-прев'ю
  timer/timer-worker.js       відлік у Worker: не душиться, коли вкладка у фоні
  scripts/                    extract.py (винесення світлої теми), gen_sounds.py
AGENTS.md                     правила роботи з репозиторієм
```

## Деталі реалізації / Особливості

**Порядок скриптів.** `loadOneScript()` резервує позицію кожного `<script>`
коментарем-якорем у DOM і вставляє тег із `async = false`. Завдяки цьому всі
запити йдуть паралельно, а виконання лишається в порядку `js/main.js`. Порядок
ламати не можна — модулі залежать один від одного глобальними змінними.

**Ліниве завантаження.** Модулі звичок і таймера описані в `TAB_MODULES` і
підвантажуються при першому відкритті вкладки; модуль активної при старті
тягнеться в критичному шляху, решта — фоном через `requestIdleCallback`.
Нотатки (Quill + SortableJS з CDN) вантажаться окремо, `initNotes()` викликається
в момент відкриття вкладки, щоб редактор ініаліалізувався вже видимим.

**Service Worker.** `sw.js`: stale-while-revalidate для власного коду (миттєвий
показ з кешу, оновлення у фоні), network-first з fallback у кеш для
`bookmarks/*.xbel`, cache-first для favicon з `www.google.com/s2/favicons`, а
`/sounds/` не перехоплюється взагалі. `CACHE_VERSION` / `CACHE_NAME` бампаються
лише при змінах самої стратегії кешування.

**Синхронізація з Gist.** Кожен набір даних (notes, habits, tasks, timer)
пише `lastModified` і в localStorage, і у файл gist. `gist/sync-base.js` порівнює
часи: під час push не перезаписує новіші віддалені дані, під час pull — новіші
локальні. Видалення синхронізуються окремо через множину `gist_deleted_<dataset>`.
`gist/tab-coordinator.js` обирає лідера вкладки (короткочасний lock у
`localStorage`, TTL 15 с, обмін через `BroadcastChannel` з fallback на
storage-події): тільки лідер ходить у Gist, решта перерендерює UI з
спільного `localStorage`. Пуш відбувається при приховуванні вкладки, тихий
auto-pull — при фокусі чи поверненні (з затримкою 1,5 с).

**Мобільна версія дублює код.** `mobile/` — самостійна копія, а не обгортки:
власні `js/`, `css/`, `sw.js` і навіть `timer/timer-worker.js`. Спільними
лишаються лише `gist/` і `shared/`, до яких ідуть відносними шляхами `../gist/`.
Тому правку спільної логіки зазвичай треба продублювати в обидва місця.

**Міграції схем.** `habitsSchemaVersion` зараз 3: v1 — емодзі → ID іконки,
`halfDates`, тип звички, категорія; v2 — `skippedDates` і нагадування;
v3 — нотатки до дат. Значення нижче поточної версії мігруються автоматично при
завантаженні.

**Ідентифікатори.** Завдання `t_<base36>_<random>`, нотатки
`n_<base36>_<random>`, проєкти `p_<base36>_<random>` — згенеровані в браузері,
тому синхронізація не потребує серверних id.

**Дрібниці.** Іконки закладок підвантажуються заздалегідь, щоб потрапити в кеш
SW. Скрипти модулів підключені через `media="print"` + `onload`, аби не
блокувати перший рендер. Світла тема дублюється: і в окремих файлах, і
інлайном у `index.html`.
