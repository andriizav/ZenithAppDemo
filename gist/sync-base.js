/* ========== SHARED GIST SYNC CONFLICT RESOLUTION ========== */
/* Цей модуль гарантує, що старі дані ніколи не перезапишуть новіші.
 *
 * Кожен набір даних (notes, habits, tasks, timer) зберігає локальний час
 * останньої зміни (lastModified, мс) у localStorage. Цей час також пишеться
 * у відповідний файл gist. Під час синхронізації ми порівнюємо часи:
 *   - PUSH (локальне -> gist): якщо у gist лежать НОВІШІ дані, ніж наші локальні
 *     зміни, ми НЕ перезаписуємо їх (інакше старі дані знищили б нові).
 *   - PULL (gist -> локальне): якщо локальні дані НОВІШІ за gist, ми НЕ
 *     перезаписуємо локальні (інакше старі дані з gist знищили б локальні).
 */

const GIST_MODIFIED_KEY_PREFIX = 'gist_last_modified_';

// Отримати локальний час останньої зміни набору даних (0, якщо ще не синхронізувалось)
function gistGetLocalModified(dataset) {
  const v = parseInt(localStorage.getItem(GIST_MODIFIED_KEY_PREFIX + dataset) || '0', 10);
  return isNaN(v) ? 0 : v;
}

// Записати локальний час останньої зміни набору даних
function gistSetLocalModified(dataset, ts) {
  localStorage.setItem(GIST_MODIFIED_KEY_PREFIX + dataset, String(ts || Date.now()));
}

// Позначити набір даних як щойно змінений локально
function gistTouchLocalModified(dataset) {
  gistSetLocalModified(dataset, Date.now());
}

// Час із gist може бути рядком ISO або числом (мс). Нормалізуємо до мс.
function gistNormalizeModified(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const t = Date.parse(value);
  return isNaN(t) ? 0 : t;
}

// true, якщо локальні дані новіші за gist (локальні мають перемогти / бути записані)
function gistLocalIsNewer(localModified, gistModified) {
  return localModified > gistNormalizeModified(gistModified);
}

// true, якщо gist новіший за локальні дані (gist має перемогти / бути підтягнутим)
function gistRemoteIsNewer(gistModified, localModified) {
  return gistNormalizeModified(gistModified) > localModified;
}

// Повертає рядок ISO для запису у файл gist (використовуємо локальний час зміни)
function gistModifiedToISO(modified) {
  return new Date(modified || Date.now()).toISOString();
}

// Поверхневе об'єднання об'єктів: ключі з обох сторін зберігаються.
// Якщо ключ є і там, і там — береться remote (джерело pull), крім випадків,
// коли це масив дат (див. gistMergeDateArrays) або обробляється mergeItem.
function gistMergeObjects(local, remote) {
  if (!local || typeof local !== 'object') return remote !== undefined ? remote : local;
  if (!remote || typeof remote !== 'object') return local;
  const result = { ...local };
  for (const [k, v] of Object.entries(remote)) {
    if (Array.isArray(v) && Array.isArray(result[k])) {
      // Для масивів дат об'єднуємо унікальні значення
      result[k] = gistMergeDateArrays(result[k], v);
    } else if (v && typeof v === 'object' && !Array.isArray(v) && result[k] && typeof result[k] === 'object' && !Array.isArray(result[k])) {
      result[k] = gistMergeObjects(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// Об'єднує два масиви рядкових дат (напр. completedDates), зберігаючи унікальні.
function gistMergeDateArrays(localArr, remoteArr) {
  const set = new Set(Array.isArray(localArr) ? localArr : []);
  for (const d of (Array.isArray(remoteArr) ? remoteArr : [])) {
    set.add(d);
  }
  return Array.from(set);
}

// Об'єднує масив об'єктів за полем id. Нові з remote додаються, існуючі
// зливаються через mergeItem (за замовчуванням — gistMergeObjects).
function gistMergeArraysById(localArr, remoteArr, mergeItem) {
  const merge = mergeItem || gistMergeObjects;
  const local = Array.isArray(localArr) ? localArr : [];
  const remote = Array.isArray(remoteArr) ? remoteArr : [];
  const byId = new Map();
  for (const item of local) {
    if (item && item.id !== undefined) byId.set(item.id, item);
  }
  for (const item of remote) {
    if (!item || item.id === undefined) continue;
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? merge(existing, item) : item);
  }
  return Array.from(byId.values());
}

// Перевіряє, чи файл fileName у Gist існує і містить непорожні дані за предикатом.
// predicate(data) -> true, якщо дані вважаються «непорожніми».
// Повертає { exists, hasData }. Не кидає помилок.
async function gistRemoteHasData(fileName, predicate) {
  try {
    const cfg = (typeof gistStorage !== 'undefined' && gistStorage.config) || JSON.parse(localStorage.getItem('gist_config') || '{}');
    if (!cfg || !cfg.token || !cfg.gistId) return { exists: false, hasData: false };
    const response = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      headers: { 'Authorization': `token ${cfg.token}` }
    });
    if (!response.ok) return { exists: false, hasData: false };
    const gist = await response.json();
    const file = gist.files && gist.files[fileName];
    if (!file || !file.content) return { exists: false, hasData: false };
    let content = file.content;
    if (file.truncated) {
      const raw = await fetch(file.raw_url);
      if (!raw.ok) return { exists: true, hasData: false };
      content = await raw.text();
    }
    const data = JSON.parse(content);
    return { exists: true, hasData: !!(predicate && predicate(data)) };
  } catch {
    return { exists: false, hasData: false };
  }
}

// Просте порівняння вмісту двох наборів даних (без урахування часу зміни).
// Повертає true, якщо дані відрізняються і локальні треба оновити з gist.
function gistContentDiffers(localData, remoteData) {
  if (localData === undefined && remoteData === undefined) return false;
  return JSON.stringify(localData) !== JSON.stringify(remoteData);
}

// ========== CONFIG PROPAGATION ==========
// Колиgist config змінюється через налаштування, ВСІ gist-сховища мають
// перечитати конфіг і перезапустити/зупинити auto-sync.
// Реєструємо всі сховища тут, щоб мати централізований контроль.
const _gistAllStorages = [];
function gistRegisterStorage(storage) {
  if (storage && !_gistAllStorages.includes(storage)) {
    _gistAllStorages.push(storage);
  }
}

function gistNotifyConfigChanged() {
  for (const s of _gistAllStorages) {
    if (typeof s.refreshConfig === 'function') s.refreshConfig();
  }
}

// ========== DELETION TRACKING ==========
// Щоб видалення синхронізувались між пристроями, кожен набір даних
// зберігає множину видалених id у localStorage та у gist.
// Формат: gist_deleted_<dataset> = JSON-масив id
const GIST_DELETED_KEY_PREFIX = 'gist_deleted_';

function gistGetDeletedIds(dataset) {
  try {
    return JSON.parse(localStorage.getItem(GIST_DELETED_KEY_PREFIX + dataset)) || [];
  } catch {
    return [];
  }
}

function gistAddDeletedId(dataset, id) {
  const deleted = gistGetDeletedIds(dataset);
  if (!deleted.includes(id)) {
    deleted.push(id);
    localStorage.setItem(GIST_DELETED_KEY_PREFIX + dataset, JSON.stringify(deleted));
  }
}

// Об'єднує два списки видалених id, зберігаючи унікальні.
function gistMergeDeletedIds(localDeleted, remoteDeleted) {
  const set = new Set([...(localDeleted || []), ...(remoteDeleted || [])]);
  return Array.from(set);
}

// Фільтрує масив об'єктів, видаляючи ті, чий id є у deletedIds.
function gistFilterDeleted(arr, deletedIds) {
  if (!Array.isArray(arr) || !deletedIds || deletedIds.length === 0) return arr;
  const delSet = new Set(deletedIds);
  return arr.filter(item => !item || item.id === undefined || !delSet.has(item.id));
}

// Централізований авто-pull: тихо підтягує свіжі дані з Gist для всіх увімкнених
// наборів даних і ОБ'ЄДНУЄ їх з локальними (не перезаписує). Не питає підтвердження.
// Викликається при поверненні на вкладку / фокусі вікна (див. app.js / mobile/app.js).
// Перед pull кожне сховище перечитує конфіг (refreshConfig), щоб врахувати
// зміни з іншого пристрою / з налаштувань.
// Якщо ввімкнений координатор вкладок — pull робить ЛИШЕ лідер. Follower-вкладки
// отримують свіжі дані локально через storage-подію (див. gistCrossTabRefreshUI).
async function gistAutoPull() {
  if (typeof gistTabIsLeader === 'function' && !gistTabIsLeader()) {
    return;
  }
  const storages = [];
  if (typeof gistStorage !== 'undefined' && typeof gistStorage.pullFromGist === 'function') storages.push(gistStorage);
  if (typeof habitsGistStorage !== 'undefined' && typeof habitsGistStorage.pullFromGist === 'function') storages.push(habitsGistStorage);
  if (typeof timerGistStorage !== 'undefined' && typeof timerGistStorage.pullFromGist === 'function') storages.push(timerGistStorage);
  if (typeof tasksGistStorage !== 'undefined' && typeof tasksGistStorage.pullFromGist === 'function') storages.push(tasksGistStorage);
  if (typeof codeGistStorage !== 'undefined' && typeof codeGistStorage.pullFromGist === 'function') storages.push(codeGistStorage);

  const tasks = [];
  for (const s of storages) {
    if (typeof s.refreshConfig === 'function') s.refreshConfig();
    if (s.isEnabled()) tasks.push(s.pullFromGist());
  }
  if (!tasks.length) return;
  try {
    await Promise.all(tasks);
    // Сповіщаємо інші вкладки (followers) оновити UI — вони не ходили в Gist,
    // але тепер локальні дані свіжі й спільні.
    if (typeof gistTabBroadcast === 'function') {
      ['notes', 'habits', 'timer', 'tasks', 'code'].forEach(d => gistTabBroadcast('data_changed', { dataset: d }));
    }
  } catch (err) {
    console.error('Gist auto-pull failed:', err);
  }
}

// Централізований авто-push: пушить всі увімкнені набори даних у Gist.
// Викликається при закритті вкладки / прихованні вікна.
// Якщо ввімкнений координатор вкладок — пушить ЛИШЕ лідер.
async function gistAutoPush() {
  if (typeof gistTabIsLeader === 'function' && !gistTabIsLeader()) {
    // Ця вкладка — follower. Дані в localStorage спільні, тому лідер
    // уже (або незабаром) запушить їх у Gist. Нічого не робимо.
    return;
  }
  const allTasks = [];
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled() && gistStorage.pendingChanges && typeof gistStorage.syncToGist === 'function') {
    allTasks.push(gistStorage.syncToGist());
  }
  if (typeof habitsGistStorage !== 'undefined' && habitsGistStorage.isEnabled() && habitsGistStorage.pendingChanges && typeof habitsGistStorage.updateHabitsInGist === 'function') {
    allTasks.push(habitsGistStorage.updateHabitsInGist());
  }
  if (typeof timerGistStorage !== 'undefined' && timerGistStorage.isEnabled() && timerGistStorage.pendingChanges && typeof timerGistStorage.updatePresetsInGist === 'function') {
    allTasks.push(timerGistStorage.updatePresetsInGist());
  }
  if (typeof tasksGistStorage !== 'undefined' && tasksGistStorage.isEnabled() && tasksGistStorage.pendingChanges && typeof tasksGistStorage.updateTasksInGist === 'function') {
    allTasks.push(tasksGistStorage.updateTasksInGist());
  }
  if (typeof codeGistStorage !== 'undefined' && codeGistStorage.isEnabled() && codeGistStorage.pendingChanges && typeof codeGistStorage.updateTasksInGist === 'function') {
    allTasks.push(codeGistStorage.updateTasksInGist());
  }
  if (!allTasks.length) return;
  try {
    await Promise.all(allTasks);
  } catch (err) {
    console.error('Gist auto-push failed:', err);
  }
}

// ========== HABITS PER-DATE CONFLICT RESOLUTION ==========
// Дати-стани звички (dates/halfDates/skippedDates/cleanDates) — взаємовиключні:
// кожна дата в кожен момент належить щонайбільше одному з них. Наївне
// об'єднання (union) кожного масиву окремо НЕ може виразити "видалення" —
// якщо застаріла копія (з іншої вкладки чи пристрою) досі містить дату в
// одному зі станів, union просто повертає її назад навіть якщо користувач
// щойно зняв позначку. Це і є причина "клітинки повертаються до попереднього
// стану". Замість цього кожна дата отримує мітку часу останньої зміни
// (habit.dateMeta[dateStr]) і при злитті перемагає той бік, чия мітка новіша
// (last-write-wins по кожній даті окремо, а не по всьому масиву разом).

const HABIT_DATE_FIELDS = ['dates', 'halfDates', 'skippedDates', 'cleanDates'];
const HABIT_FIELD_FOR_STATE = { done: 'dates', half: 'halfDates', skipped: 'skippedDates', clean: 'cleanDates' };

// Позначає момент останньої зміни стану/нотатки конкретної дати звички.
// Викликається з усіх toggle*-функцій ПЕРЕД saveHabits(), щоб мітка часу
// вже існувала на момент будь-якого наступного злиття (cross-tab чи gist).
function gistTouchDateMeta(habit, dateStr, ts) {
  if (!habit) return;
  if (!habit.dateMeta) habit.dateMeta = {};
  habit.dateMeta[dateStr] = ts || Date.now();
}

// Визначає поточний стан дати ('done'|'half'|'skipped'|'clean'|null) за вмістом
// взаємовиключних масивів. При пошкоджених даних (дата в кількох масивах
// одразу) пріоритет: done > half > skipped > clean.
function gistResolveHabitDateState(habit, dateStr) {
  if (!habit) return null;
  if (Array.isArray(habit.dates) && habit.dates.includes(dateStr)) return 'done';
  if (Array.isArray(habit.halfDates) && habit.halfDates.includes(dateStr)) return 'half';
  if (Array.isArray(habit.skippedDates) && habit.skippedDates.includes(dateStr)) return 'skipped';
  if (Array.isArray(habit.cleanDates) && habit.cleanDates.includes(dateStr)) return 'clean';
  return null;
}

// Зливає стани дат (і нотатки) двох копій ОДНІЄЇ звички за принципом
// last-write-wins для кожної дати окремо (за habit.dateMeta). Повертає
// {dates, halfDates, skippedDates, cleanDates, dateMeta, notes}.
function gistMergeHabitDates(local, remote) {
  const candidateDates = new Set();
  for (const f of HABIT_DATE_FIELDS) {
    (Array.isArray(local[f]) ? local[f] : []).forEach((d) => candidateDates.add(d));
    (Array.isArray(remote[f]) ? remote[f] : []).forEach((d) => candidateDates.add(d));
  }
  Object.keys(local.notes || {}).forEach((d) => candidateDates.add(d));
  Object.keys(remote.notes || {}).forEach((d) => candidateDates.add(d));

  const localMeta = local.dateMeta || {};
  const remoteMeta = remote.dateMeta || {};
  const mergedMeta = { ...localMeta };
  const mergedNotes = { ...(local.notes || {}) };
  const buckets = { dates: [], halfDates: [], skippedDates: [], cleanDates: [] };

  for (const dateStr of candidateDates) {
    const localState = gistResolveHabitDateState(local, dateStr);
    const remoteState = gistResolveHabitDateState(remote, dateStr);
    const localTs = localMeta[dateStr] || 0;
    const remoteTs = remoteMeta[dateStr] || 0;

    let winnerState;
    if (localState === remoteState) {
      winnerState = localState;
    } else if (localTs === 0 && remoteTs === 0) {
      // Жодна сторона не має мітки часу (дані до впровадження dateMeta) —
      // не втрачаємо позначку "наосліп": лишаємо непорожній стан.
      winnerState = localState || remoteState;
    } else {
      winnerState = remoteTs > localTs ? remoteState : localState;
    }

    if (winnerState && HABIT_FIELD_FOR_STATE[winnerState]) {
      buckets[HABIT_FIELD_FOR_STATE[winnerState]].push(dateStr);
    }

    if (remoteTs > localTs) {
      mergedMeta[dateStr] = remoteTs;
      if (Object.prototype.hasOwnProperty.call(remote.notes || {}, dateStr)) {
        mergedNotes[dateStr] = remote.notes[dateStr];
      } else {
        delete mergedNotes[dateStr];
      }
    }
  }

  return {
    dates: buckets.dates.sort(),
    halfDates: buckets.halfDates.sort(),
    skippedDates: buckets.skippedDates.sort(),
    cleanDates: buckets.cleanDates.sort(),
    dateMeta: mergedMeta,
    notes: mergedNotes,
  };
}

// Зливає два повні масиви звичок (за id), застосовуючи gistMergeHabitDates
// для дат/нотаток кожної спільної звички і remote-overwrite для решти полів
// (назва, іконка, категорія тощо). Нові звички з remote додаються як є.
function gistMergeHabitsArrays(localHabits, remoteHabits) {
  return gistMergeArraysById(localHabits, remoteHabits, (local, remote) => {
    let result = { ...local };
    for (const [k, v] of Object.entries(remote)) {
      if (HABIT_DATE_FIELDS.includes(k) || k === 'dateMeta' || k === 'notes') continue;
      result[k] = v;
    }
    return { ...result, ...gistMergeHabitDates(local, remote) };
  });
}

// ========== CROSS-TAB UI REFRESH ==========
// Викликається, коли інша вкладка того ж браузера змінила локальні дані
// (через gistTabBroadcast('data_changed') або після pull лідера).
// Дані вже спільні (localStorage), тому просто перерендерюємо UI цієї вкладки,
// не торкаючись Gist. Це і є обмін між вкладками без конфліктів синхронізації.
function gistCrossTabRefreshUI(dataset) {
  try {
    if (dataset === 'notes') {
      if (typeof renderNotesUI === 'function') {
        const el = document.getElementById('output-notes');
        if (el) renderNotesUI(el);
      }
    } else if (dataset === 'habits') {
      // ВАЖЛИВО: `habits` — це in-memory копія цієї вкладки, завантажена ще
      // при старті. Інша вкладка записала СВОЮ версію в localStorage (спільний
      // для всіх вкладок), але наша власна ще не збережена зміна (у дебаунсі
      // saveHabits()) в ній відсутня. Якщо просто перерендерити з in-memory
      // масиву — ми проігноруємо зміну іншої вкладки; якщо просто перезаписати
      // in-memory масив вмістом localStorage — ми загубимо власну ще не
      // збережену зміну. Тому зливаємо обидві копії по кожній даті окремо
      // (last-write-wins за dateMeta) замість того, щоб довіряти лише одній.
      try {
        if (typeof habits !== 'undefined') {
          const remoteHabits = JSON.parse(localStorage.getItem('habits') || '[]');
          if (Array.isArray(remoteHabits)) {
            const merged = gistMergeHabitsArrays(habits, remoteHabits);
            habits = merged;
            localStorage.setItem('habits', JSON.stringify(habits));
          }
        }
      } catch (e) {
        console.error('gistCrossTabRefreshUI habits merge failed:', e);
      }
      if (typeof scheduleRenderHabits === 'function') scheduleRenderHabits();
    } else if (dataset === 'timer') {
      if (typeof timerRenderPresets === 'function') timerRenderPresets();
    } else if (dataset === 'tasks') {
      const mod = (typeof tasksModule !== 'undefined') ? tasksModule : null;
      const el = document.getElementById('output-tasks');
      if (el && mod && typeof mod.renderUI === 'function') mod.renderUI(el);
    } else if (dataset === 'code') {
      const mod = (typeof codeTasksModule !== 'undefined') ? codeTasksModule : null;
      const el = document.getElementById('output-code');
      if (el && mod && typeof mod.renderUI === 'function') mod.renderUI(el);
    }
  } catch (e) {
    console.error('gistCrossTabRefreshUI failed:', e);
  }
}
