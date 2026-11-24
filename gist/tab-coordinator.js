/* ========== CROSS-TAB COORDINATOR ==========
 * Запобігає конфліктам синхронізації, коли відкрито кілька вкладок
 * (або вікон) одного додатку в одному браузері.
 *
 * Проблема: localStorage СПІЛЬНИЙ між усіма вкладками. Якщо кожна вкладка
 * сама робить pull/push у Gist при focus/visibilitychange, вони починають
 * «боротися»: одна тягне старі дані з Gist, перезаписує локальні (спільні!)
 * зміни іншої вкладки і збиває lastModified. Через це зміни можуть «злітати».
 *
 * Рішення:
 *   - Лише ОДНА вкладка (leader) має право пушити/пулити Gist.
 *     Лідер обирається через короткочасний lock у localStorage. Якщо лідер
 *     закривається — lock звільняється, інша вкладка стає лідером.
 *   - Інші вкладки (followers) не ходять у Gist. Вони отримують зміни
 *     локально: при зміні даних у localStorage спрацьовує нативна storage-подія
 *     і follower перерендерює свій UI (дані вже спільні).
 *   - Якщо follower отримує фокус/visible, він просить leader зробити pull
 *     (через BroadcastChannel / storage-подію), щоб підтягнути свіжі дані
 *     з Gist на ВСІ вкладки одночасно.
 *
 * Використовує BroadcastChannel (якщо доступно) з fallback на localStorage-
 * події, щоб працювати навіть у старих браузерах / file:// режимі.
 */

const GIST_TAB_COORD_NS = 'zenith_tab_coord_';
const GIST_TAB_LOCK_KEY = GIST_TAB_COORD_NS + 'leader_lock';
const GIST_TAB_MSG_KEY = GIST_TAB_COORD_NS + 'msg';
const GIST_TAB_LOCK_TTL = 15000; // мс — через стільки lock вважається протухлим

const _gistTabId = (function() {
  try {
    let id = sessionStorage.getItem(GIST_TAB_COORD_NS + 'id');
    if (!id) {
      id = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(GIST_TAB_COORD_NS + 'id', id);
    }
    return id;
  } catch {
    return 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
})();

let _gistIsLeader = false;
let _gistTabChannel = null;
let _gistTabRenewTimer = null;
let _gistTabMsgSeq = 0;

// Спробуємо стати лідером одразу при завантаженні скрипта, щоб storage-інтервали
// (які стартують у конструкторах до виклику gistTabInit) бачили актуальний статус.
// gistTabInit пізніше лише запускає таймери оновлення lock і слухачів повідомлень.
(function () {
  try {
    if (!_gistTabReadLock()) {
      _gistTabWriteLock();
      _gistIsLeader = true;
    } else {
      _gistIsLeader = false;
    }
  } catch {
    _gistIsLeader = false;
  }
})();

try {
  if (typeof BroadcastChannel !== 'undefined') {
    _gistTabChannel = new BroadcastChannel('zenith_tab_coord');
  }
} catch {
  _gistTabChannel = null;
}

function _gistTabNow() {
  return Date.now();
}

// Прочитати поточний lock із localStorage. Повертає {id, ts} або null.
function _gistTabReadLock() {
  try {
    const raw = localStorage.getItem(GIST_TAB_LOCK_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.id) return null;
    // Протухлий lock ігноруємо — його можна перезаписати.
    if (_gistTabNow() - obj.ts > GIST_TAB_LOCK_TTL) return null;
    return obj;
  } catch {
    return null;
  }
}

function _gistTabWriteLock() {
  try {
    localStorage.setItem(GIST_TAB_LOCK_KEY, JSON.stringify({ id: _gistTabId, ts: _gistTabNow() }));
  } catch {}
}

// Спробувати стати лідером. Повертає true, якщо ця вкладка тепер лідер.
function _gistTabTryBecomeLeader() {
  const lock = _gistTabReadLock();
  if (!lock) {
    _gistTabWriteLock();
    return true;
  }
  if (lock.id === _gistTabId) {
    // Оновлюємо timestamp, щоб lock не протух.
    _gistTabWriteLock();
    return true;
  }
  return false;
}

function _gistTabReleaseLock() {
  try {
    const lock = _gistTabReadLock();
    if (lock && lock.id === _gistTabId) {
      localStorage.removeItem(GIST_TAB_LOCK_KEY);
    }
  } catch {}
}

// Відправити повідомлення іншим вкладкам.
// type: 'request_pull' | 'data_changed' | 'leader_changed'
function gistTabBroadcast(type, payload) {
  const msg = {
    sender: _gistTabId,
    type: type,
    payload: payload || null,
    seq: ++_gistTabMsgSeq,
    ts: _gistTabNow(),
  };
  if (_gistTabChannel) {
    try {
      _gistTabChannel.postMessage(msg);
    } catch {}
  }
  // Fallback для браузерів без BroadcastChannel: пишемо в localStorage,
  // що спрацьовує storage-подію в інших вкладках.
  try {
    localStorage.setItem(GIST_TAB_MSG_KEY, JSON.stringify(msg));
    // Одразу прибираємо, щоб наступне повідомлення з тим самим змістом
    // теж викликало storage-подію (воно спрацьовує лише на зміну значення).
    localStorage.removeItem(GIST_TAB_MSG_KEY);
  } catch {}
}

const _gistTabListeners = {};
function gistTabOn(type, cb) {
  if (!_gistTabListeners[type]) _gistTabListeners[type] = [];
  _gistTabListeners[type].push(cb);
}

function _gistTabDispatch(msg) {
  if (!msg || msg.sender === _gistTabId) return;
  const list = _gistTabListeners[msg.type];
  if (list) {
    for (const cb of list) {
      try { cb(msg); } catch (e) { console.error('gistTab listener error:', e); }
    }
  }
}

// Ініціалізація координатора. Викликається один раз при завантаженні.
// (Спроба стати лідером уже зроблена при завантаженні скрипта, тут лише
// запускаємо таймери оновлення lock і слухачів повідомлень.)
function gistTabInit() {
  // Слухаємо BroadcastChannel.
  if (_gistTabChannel) {
    _gistTabChannel.onmessage = (ev) => {
      const msg = ev && ev.data;
      if (msg && msg.type === 'request_pull' && _gistIsLeader) {
        // Тільки лідер реагує на запит pull.
        if (typeof gistAutoPull === 'function') gistAutoPull();
      }
      _gistTabDispatch(msg);
    };
  }

  // Мапінг відомих ключів localStorage -> набір даних (dataset).
  // Використовується, щоб при зміні в іншій вкладці перерендерити правильний UI.
  const _gistTabKeyToDataset = (key) => {
    if (!key) return null;
    if (key === 'habits') return 'habits';
    if (key === 'tabataPresets') return 'timer';
    if (key === 'tasks_data' || key === 'tasks_labels' ||
        key === 'tasks_done_collapsed' || key === 'tasks_settings') return 'tasks';
    if (key === 'code_tasks_data' || key === 'code_tasks_labels' ||
        key === 'code_tasks_done_collapsed' || key === 'code_tasks_settings') return 'code';
    if (key.indexOf('notes_') === 0 || key === 'notes_data' ||
        key === 'notes_topics' || key === 'notes_timestamps' ||
        key === 'notes_groups' || key === 'notes_topic_groups' ||
        key === 'notes_name_map' || key === 'notes_main_group' ||
        key === 'notes_collapsed' || key === 'notes_sidebar_width' ||
        key === 'notes_layout_width') return 'notes';
    // deletedIds префікси
    if (key.indexOf('gist_deleted_') === 0) {
      const ds = key.replace('gist_deleted_', '');
      return ds || null;
    }
    return null;
  };

  // Нативна storage-подія: коли ІНША вкладка змінює localStorage (спільний),
  // ця вкладка отримує подію і оновлює свій UI без ходіння в Gist.
  // (storage-подія НЕ спрацьовує у вкладці, що сама змінила значення — це ок.)
  window.addEventListener('storage', (e) => {
    if (e.key === GIST_TAB_MSG_KEY && e.newValue) {
      try { _gistTabDispatch(JSON.parse(e.newValue)); } catch {}
    }
    if (e.key && e.key.indexOf(GIST_TAB_COORD_NS) !== 0) {
      const ds = _gistTabKeyToDataset(e.key);
      if (ds && typeof gistCrossTabRefreshUI === 'function') {
        gistCrossTabRefreshUI(ds);
      }
    }
    // Якщо lock було видалено/перезаписано іншою вкладкою — переобираємо лідера.
    if (e.key === GIST_TAB_LOCK_KEY) {
      const wasLeader = _gistIsLeader;
      _gistIsLeader = _gistTabTryBecomeLeader();
      if (wasLeader !== _gistIsLeader) {
        gistTabBroadcast('leader_changed', { leader: _gistIsLeader });
        _gistTabDispatch({ sender: _gistTabId, type: 'leader_changed', payload: { leader: _gistIsLeader } });
      }
    }
  });

  // Періодично оновлюємо lock (поки ми лідер) і перевіряємо, чи не протух він.
  _gistTabRenewTimer = setInterval(() => {
    const wasLeader = _gistIsLeader;
    if (_gistIsLeader) {
      const lock = _gistTabReadLock();
      if (!lock || lock.id === _gistTabId) {
        _gistTabWriteLock();
      } else {
        // Хтось інший перехопив lock — ми більше не лідер.
        _gistIsLeader = false;
      }
    } else {
      // Намагаємось стати лідером, якщо lock вільний.
      _gistIsLeader = _gistTabTryBecomeLeader();
    }
    if (wasLeader !== _gistIsLeader) {
      gistTabBroadcast('leader_changed', { leader: _gistIsLeader });
      _gistTabDispatch({ sender: _gistTabId, type: 'leader_changed', payload: { leader: _gistIsLeader } });
    }
  }, GIST_TAB_LOCK_TTL / 2);

  // Звільняємо lock при закритті/приховуванні вкладки.
  window.addEventListener('beforeunload', () => {
    _gistTabReleaseLock();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // НЕ звільняємо lock тут одразу: інший 'visibilitychange'-слухач
      // (app.js) робить push саме на 'hidden' і перевіряє _gistIsLeader —
      // якби ми скинули лідерство першими (слухачі DOM виконуються у
      // порядку реєстрації, а цей реєструється раніше за app.js), push
      // на закриття/приховування вкладки завжди б тихо пропускався і
      // щойно зроблена зміна (напр. рух завдання) губилась би. Замість
      // цього звільняємо lock ЛИШЕ після завершення push — див.
      // gistTabRequestPush нижче.
    } else {
      // Повернулись — спробуємо знову стати лідером (або залишаємось follower).
      _gistIsLeader = _gistTabTryBecomeLeader();
    }
  });
}

// Повертає true, якщо ця вкладка — поточний лідер (має право ходити в Gist).
function gistTabIsLeader() {
  return _gistIsLeader;
}

// Викликається, коли локальні дані змінились у цій вкладці.
// Сповіщає інші вкладки оновити UI (дані вже спільні у localStorage).
function gistTabNotifyDataChanged(dataset) {
  gistTabBroadcast('data_changed', { dataset: dataset || null });
}

// Викликається при фокусі/visible follower-вкладки, щоб підтягнути свіжі
// дані з Gist. Якщо ми лідер — робимо pull самі; інакше просимо лідера.
// Завжди повертає Promise (для безпечного .catch у викликачів).
function gistTabRequestPull() {
  if (_gistIsLeader) {
    if (typeof gistAutoPull === 'function') return gistAutoPull();
  } else {
    gistTabBroadcast('request_pull', null);
  }
  return Promise.resolve();
}

// Викликається при приховуванні вкладки, щоб запушити локальні зміни в Gist.
// Лише лідер пушить; follower покладається на те, що лідер вже запушив
// (дані спільні). Якщо ми були лідером і ховаємось — робимо push перед
// звільненням lock. Завжди повертає Promise.
function gistTabRequestPush() {
  if (_gistIsLeader) {
    const releaseAfter = () => {
      // Звільняємо lock лише ТЕПЕР, коли push (спроба) завершився —
      // щоб інша видима вкладка могла стати лідером, не перериваючи
      // ще незавершений push цієї вкладки.
      _gistTabReleaseLock();
      _gistIsLeader = false;
    };
    if (typeof gistAutoPush === 'function') {
      return gistAutoPush().then(releaseAfter, releaseAfter);
    }
    releaseAfter();
  }
  // follower не пушить сам — лідер це зробить при своєму hidden/focus.
  return Promise.resolve();
}
