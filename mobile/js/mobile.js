/* ============================================================
   MOBILE.JS — логіка dropdown для додаткових табів на мобільних
   ============================================================ */

const MobileTabs = (() => {
  let moreWrapper, moreBtn, moreDropdown;
  let extraTabNames = [];
  let isOpen = false;

  // Скільки табів залишаємо видимими у рядку на мобільному.
  // Решта (незалежно від назви/порядку) йдуть у меню «···».
  const MOBILE_VISIBLE_TABS = 4;

  function init(tabsOrder) {
    // Видаляємо дублікати з tabsOrder, щоб уникнути дублікатів у dropdown
    const uniqueTabsOrder = [...new Set(tabsOrder)];
    extraTabNames = uniqueTabsOrder.slice(MOBILE_VISIBLE_TABS);

    moreWrapper = document.createElement("div");
    moreWrapper.className = "tab-more-wrapper";

    moreBtn = document.createElement("button");
    moreBtn.className = "tab-more-btn";
    moreBtn.innerHTML = ICON('bolt', 22) + '<span class="tab-more-label">Параметри</span>';
    moreBtn.title = "Інші вкладки";

    moreDropdown = document.createElement("div");
    moreDropdown.className = "tab-more-dropdown";

    moreWrapper.appendChild(moreBtn);
    moreWrapper.appendChild(moreDropdown);

    moreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    // Знімаємо тимчасовий «скасувальник» ховеру, коли користувач знову
    // наводить/торкає кнопку — тоді звичайний ховер знову працює.
    moreBtn.addEventListener("pointerover", () => {
      moreBtn.classList.remove("no-hover");
    });

    document.addEventListener("click", (e) => {
      if (!moreWrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    document.addEventListener("touchstart", (e) => {
      if (!moreWrapper.contains(e.target)) {
        closeDropdown();
      }
    }, { passive: true });

    return { moreWrapper, moreDropdown, extraTabNames };
  }

  function populateDropdown() {
    moreDropdown.innerHTML = '';
    extraTabNames.forEach(tabName => {
      const original = document.querySelector(`.tab[data-tab-name="${tabName}"]`);
      if (!original) return;

      const clone = document.createElement("button");
      clone.className = "tab" + (original.classList.contains("active") ? " active" : "");
      clone.innerHTML = original.innerHTML;
      clone.dataset.tabId = original.dataset.tabId;
      clone.dataset.tabName = tabName;
      clone.addEventListener("click", () => {
        original.click();
        closeDropdown();
      });
      moreDropdown.appendChild(clone);
    });

    // Theme toggle в dropdown
    const themeBtn = document.createElement("button");
    themeBtn.className = "tab-theme-dropdown";
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    themeBtn.innerHTML = isLight
      ? ICON('moon', 14) + ' Темна тема'
      : ICON('sun', 14) + ' Світла тема';
    themeBtn.addEventListener("click", () => {
      if (typeof toggleTheme === "function") toggleTheme();
      populateDropdown();
    });
    moreDropdown.appendChild(themeBtn);

    // Gist sync в dropdown
    const gistBtn = document.createElement("button");
    gistBtn.className = "tab-gist-dropdown";
    gistBtn.innerHTML = ICON('gistLocal', 14) + ' Синхронізація';
    gistBtn.addEventListener("click", async () => {
      closeDropdown();
      if (typeof createGistSettingsModal !== "function") {
        if (typeof loadScriptsInOrder === "function") {
          await loadScriptsInOrder([
            "../gist/notes-storage.js",
            "notes/file-storage.js",
            "notes/storage.js",
            "../gist/notes-settings.js",
          ]);
        } else {
          return;
        }
      }
      if (typeof createGistSettingsModal === "function") createGistSettingsModal();
    });
    moreDropdown.appendChild(gistBtn);

    // Упорядкування вкладок
    const tabsOrderBtn = document.createElement("button");
    tabsOrderBtn.className = "tab-order-dropdown";
    tabsOrderBtn.innerHTML = ICON('tabOrder', 14) + ' Позиція вкладок';
    tabsOrderBtn.addEventListener("click", () => {
      closeDropdown();
      if (typeof openTabsOrderModal === "function") {
        openTabsOrderModal();
      }
    });
    moreDropdown.appendChild(tabsOrderBtn);
  }

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      populateDropdown();
      // Знімаємо тимчасовий «скасувальник» ховеру — кнопка має підсвітитись акцентом
      moreBtn.classList.remove("no-hover");
    } else {
      // Закриваємо повторним тапом: прибираємо акцент (липкий :hover на тачі)
      moreBtn.classList.add("no-hover");
    }
    moreDropdown.classList.toggle("open", isOpen);
    moreWrapper.classList.toggle("is-open", isOpen);
    moreBtn.classList.toggle("is-open", isOpen);
  }

  function closeDropdown() {
    isOpen = false;
    if (moreDropdown) moreDropdown.classList.remove("open");
    if (moreWrapper) moreWrapper.classList.remove("is-open");
    // На тач-пристроях :hover «липне» після тапу, тому примусово скидаємо
    // підсвітку кнопки, щоб вона не лишалася блакитною після закриття.
    if (moreBtn) {
      moreBtn.classList.remove("is-open");
      moreBtn.blur();
      moreBtn.classList.add("no-hover");
    }
  }

  function isExtraTab(tabName) {
    return extraTabNames.includes(tabName);
  }

  // Перераховує, які таби ховати в dropdown «···», за поточним
  // порядком кнопок у .tabs. Викликається після перетягування табів,
  // щоб видимість одразу відповідала новому порядку (без перезавантаження).
  function refreshExtra() {
    const tabsContainer = document.getElementById("tabs-container");
    if (!tabsContainer) return;
    const order = [...tabsContainer.querySelectorAll(".tab")].map(
      (t) => t.dataset.tabName
    );
    extraTabNames = order.slice(MOBILE_VISIBLE_TABS);
    order.forEach((name) => {
      const btn = tabsContainer.querySelector(`.tab[data-tab-name="${name}"]`);
      if (!btn) return;
      if (extraTabNames.includes(name)) btn.classList.add("tab-extra");
      else btn.classList.remove("tab-extra");
    });
    populateDropdown();
  }

  // Адаптивность: переініціалізуємо табі при зміні розміру вікна
  function setupResizeListener() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
          refreshExtra();
        }
      }, 150);
    });
  }

  return { init, closeDropdown, isExtraTab, refreshExtra, setupResizeListener };
})();

// Ініціалізуємо слухач resize при завантаженні
if (typeof MobileTabs !== 'undefined' && MobileTabs.setupResizeListener) {
  MobileTabs.setupResizeListener();
}

/* ============================================================
   MOBILE CHROME — точний розмір нижньої панелі табів
   (коригує запас знизу body під реальну висоту бару)
   ============================================================ */
const MobileChrome = (() => {
  let rafId = 0;
  let lastH = -1;
  function measure() {
    const tabs = document.querySelector(".tabs");
    if (!tabs) return;
    // До того, як кнопки табів додано, контейнер порожній і його висота
    // ~0 — не виставляємо це значення, бо пізніше реальний вимір дасть
    // стрибок усього вмісту (контент «дьоргнеться» вгору/вниз).
    if (tabs.children.length === 0) return;
    const h = Math.ceil(tabs.getBoundingClientRect().height);
    if (h === lastH) return;
    lastH = h;
    document.documentElement.style.setProperty("--tabbar-h", h + "px");
  }
  function schedule() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measure);
  }
  function init() {
    measure();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule);
    }
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", () => setTimeout(schedule, 50));
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", schedule);
    }
  }
  return { init, measure };
})();

/* ============================================================
   MOBILE HEADER — спільний заголовок для екранів
   (Звички / Завдання / Таймер), у тому ж стилі, що й у Нотатках.
   Центрований заголовок + опціональна кнопка «назад» зліва.
   ============================================================ */
const MobileHeader = (() => {
  // container — елемент, у який треба вставити заголовок зверху
  // title — текст заголовка
   // onBack — необов'язковий колбек для кнопки «назад»
   // actions — необов'язковий масив DOM-елементів (кнопок), що додаються
   //           у верхній правий кут заголовка
   // leftActions — необов'язковий масив DOM-елементів, що додаються
   //           у верхній лівий кут заголовка (дзеркально до actions)
    function inject(container, title, onBack, actions, leftActions) {
     // Сумісність: третій аргумент може бути функцією onBack (застарілий варіант)
     // або масивом actions. Якщо передано масив — onBack не задано.
     if (Array.isArray(onBack)) {
       leftActions = actions;
       actions = onBack;
       onBack = undefined;
     }
    if (!container || container.querySelector(':scope > .mobile-page-header')) return;
    if (!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches)) return;

    const header = document.createElement('div');
    header.className = 'mobile-page-header';

    // Ліві дії (напр. додаткові іконки зліва, як header-button-right справа)
    if (Array.isArray(leftActions) && leftActions.length) {
      const leftWrap = document.createElement('div');
      leftWrap.className = 'header-button-right-left';
      leftActions.forEach((el) => { if (el) leftWrap.appendChild(el); });
      header.appendChild(leftWrap);
    }

    if (typeof onBack === 'function') {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'header-button-left';
      backBtn.innerHTML = ICON('chevronLeft', 24, { cls: 'icon-chevron-left' });
      backBtn.setAttribute('aria-label', 'Назад');

      // Захист від подвійного спрацьовування (touchend + click на одному тапі).
      let lastBack = 0;
      let startX = 0, startY = 0;
      const triggerBack = (e) => {
        if (e) e.stopPropagation();
        const now = Date.now();
        if (now - lastBack < 600) return;
        lastBack = now;
        onBack();
      };

      // Запам'ятовуємо точку початку дотику, щоб відрізнити тап від скролу.
      backBtn.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        startX = t.clientX;
        startY = t.clientY;
      }, { passive: true });

      // Надійний основний обробник: миша та тап, коли клавіатура закрита.
      backBtn.addEventListener('click', triggerBack);

      // На мобільних, коли відкрита клавіатура редактора (фокус у полі),
      // перший тап по кнопці поза редактором лише закриває клавіатуру й
      // НЕ генерує подію click — доводиться тапати двічі. Обробляємо
      // тап через touchend, щоб «Назад» спрацьовувало з першого разу.
      // preventDefault припиняє синтетичний click, тож подвійного
      // спрацьовування не буде.
      backBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        triggerBack(e);
      }, { passive: false });

      // Коли клавіатура відкрита, перший тап часто приходить як touchcancel
      // (система скасовує дотик через зсув верстки при закритті клавіатури),
      // і тоді «Назад» не спрацьовує з першого разу. Якщо дотик майже не
      // зрушив (це був тап, а не скрол), — усе одно викликаємо «Назад».
      backBtn.addEventListener('touchcancel', (e) => {
        const t = e.changedTouches[0];
        const moved = t ? Math.hypot(t.clientX - startX, t.clientY - startY) : 0;
        if (moved < 10) {
          e.preventDefault();
          triggerBack(e);
        }
      }, { passive: false });

      header.appendChild(backBtn);
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'header-page-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (Array.isArray(actions) && actions.length) {
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'header-button-right';
      actions.forEach((el) => { if (el) actionsWrap.appendChild(el); });
      header.appendChild(actionsWrap);
    }

    container.insertBefore(header, container.firstChild);
  }

  return { inject };
})();

/* ============================================================
   SHARED SETTINGS MODAL — спільне вікно налаштувань для всіх
   вкладок (Завдання / Нотатки / Звички / Таймер). Один стиль,
   один HTML-каркас. Див. .settings-modal* у css/components/modal.css.
   ============================================================ */

/* Рядок налаштування з перемикачем (toggle). Повертає HTML. */
function settingsRowHTML(id, title, sub, checked) {
  return `
    <label class="settings-row">
      <span class="settings-row-text">
        <span class="title">${title}</span>
        <span class="sub">${sub}</span>
      </span>
      <span class="settings-switch">
        <input type="checkbox" id="${id}"${checked ? ' checked' : ''}>
        <span class="settings-switch-slider"></span>
      </span>
    </label>
  `;
}

/* Відкриває модалку налаштувань із спільним каркасом.
   opts: { title, bodyHTML, footerHTML, triggerBtn, onMount(overlay, close), onClose } */
function openSettingsModal(opts) {
  opts = opts || {};
  const title = opts.title || 'Параметри';
  const bodyHTML = opts.bodyHTML || '';
  const footerHTML = (opts.footerHTML === null)
    ? ''
    : (opts.footerHTML || '<button class="modal-btn modal-btn--primary modal-btn--block" data-close>Готово</button>');
  const triggerBtn = opts.triggerBtn || null;
  const onMount = opts.onMount || null;
  const onClose = opts.onClose || null;
  const key = opts.key || null;

  // Запобігаємо відкриттю кількох однакових вікон при повторних кліках.
  if (key) {
    const sameKey = document.querySelector('.settings-modal[data-modal-key="' + CSS.escape(key) + '"]');
    if (sameKey) return null;
  }
  // Якщо вже відкрите ВІКНО ІНШОЇ вкладки (напр. залишилось від Звичок),
  // — не «мовчимо» (інакше кнопка Параметрів цієї вкладки не натискається,
  // бо повноекранний оверлей перехоплює кліки), а закриваємо його і
  // відкриваємо своє. Це також прибирає «залиплі» оверлеї, що блокують
  // інші вкладки.
  const stray = document.querySelector('.settings-modal');
  if (stray) {
    const closeBtn = stray.querySelector('[data-close]');
    if (closeBtn) closeBtn.click();
    else stray.remove();
  }

  const overlay = document.createElement('div');
  if (key) overlay.dataset.modalKey = key;
  overlay.className = 'settings-modal';
  overlay.innerHTML = `
    <div class="settings-modal-content" role="dialog" aria-modal="true">
      <div class="settings-modal-header">
        <h3>${title}</h3>
        <button class="settings-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
      </div>
      <div class="settings-modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="settings-modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('settings-modal-open');

  if (triggerBtn) triggerBtn.classList.add('is-active');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.body.classList.remove('settings-modal-open');
    if (triggerBtn) triggerBtn.classList.remove('is-active');
    if (onClose) onClose();
  }

  overlay.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  if (onMount) onMount(overlay, close);

  return { overlay, close };
}

/* ============================================================
   MOBILE NOTES — перемикач між списком тем і редагуванням
   ============================================================ */

  const MobileNotes = (() => {
  const VIEW_KEY = 'notes_mobile_view';

  // Чи є запушений у історію браузера стан редактора, який ми самі додали.
  // Потрібно, щоб кнопка «Назад» і свайп повертали саме в наш список,
  // а не виходили з додатку, і щоб не робити зайвий history.back().
  let pendingEditorPop = false;

  function saveView(view) {
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
  }

  function getSavedView() {
    try { return localStorage.getItem(VIEW_KEY); } catch (e) { return null; }
  }

  function setView(layoutEl, view, push) {
    const wasEditor = layoutEl.classList.contains('mobile-view-editor');
    if (view === 'editor') {
      layoutEl.classList.remove('mobile-view-list');
      layoutEl.classList.add('mobile-view-editor');
    } else {
      layoutEl.classList.remove('mobile-view-editor');
      layoutEl.classList.add('mobile-view-list');
    }
    updateHeader(layoutEl);
    saveView(view);
    // Вихід з редактора у список «нашою» дією (кнопка/свайп уже опрацьовані)
    // — прибираємо з історії запушений стан редактора, щоб стек лишався
    // узгодженим. Робимо лише якщо цей стан дійсно ми й додавали.
    if (view !== 'editor' && wasEditor && pendingEditorPop) {
      pendingEditorPop = false;
      try { history.back(); } catch (e) {}
    }
    // Вхід у редагування = окрема «сторінка» в історії браузера.
    // Завдяки цьому свайп «назад» зліва на айфоні повертає до списку
    // тем, а не викидає з додатку. push робимо лише при реальному
    // переході зі списку в редактор, щоб не дублювати записи історії.
    if (push && view === 'editor' && !wasEditor) {
      try {
        history.pushState({ notesMobileView: 'editor' }, '');
        pendingEditorPop = true;
      } catch (e) {}
    }
  }

  // Перехід у список тем напряму, без очікування на popstate. Це робить
  // кнопку «Назад» надійною з першого тапу (на iOS перший history.back()
  // після pushState іноді не викликає popstate, і доводилось клацати двічі).
  function goToList(layoutEl) {
    setView(layoutEl, 'list', false);
  }

  // Обробляє «назад» браузера (свайп ліворуч/праворуч на айфоні,
  // системна кнопка «Назад»). Повертає до списку тем, якщо ми в
  // режимі редагування й відкрита саме вкладка Нотатки.
  function onPopState(e, layoutEl) {
    const contentNotes = document.getElementById('content-notes');
    if (!contentNotes || !contentNotes.classList.contains('active')) return;
    // Стан редактора вже витягнуто самим pop (свайп/системна кнопка),
    // тому не робимо повторний history.back() у setView.
    pendingEditorPop = false;
    const state = e.state;
    const view = (state && state.notesMobileView) ? state.notesMobileView : 'list';
    setView(layoutEl, view, false);
  }

  function updateHeader(layoutEl) {
    const title = layoutEl.querySelector('.header-page-title');
    if (!title) return;
    if (title.contentEditable === 'true') return; // не переривати активне редагування назви
    const isEditor = layoutEl.classList.contains('mobile-view-editor');
    if (isEditor && typeof getTopicName === 'function' && notesActiveTopic) {
      title.textContent = getTopicName(notesActiveTopic) || 'Нотатки';
      title.classList.add('header-page-title--editable');
      title.contentEditable = 'false';
      title.tabIndex = 0;
      if (!title.dataset.editableBound) {
        title.dataset.editableBound = '1';
        title.addEventListener('click', () => startEditHeaderTitle(title));
      }
    } else {
      title.textContent = 'Нотатки';
      title.classList.remove('header-page-title--editable');
      title.contentEditable = 'false';
      title.removeAttribute('tabindex');
    }

    // Кнопку «Налаштування» показуємо у заголовку лише у режимі списку тем.
    // У режимі редагування вона прибирається, і в заголовку лишається
    // тільки перемикач панелі форматування (restyled як .page-action-btn).
    const actionsWrap = layoutEl.querySelector('.mobile-page-header .header-button-right');
    if (actionsWrap) {
      const settingsBtn =
        (typeof getNotesSettingsBtn === 'function') ? getNotesSettingsBtn() : null;
      if (settingsBtn) {
        const inHeader = settingsBtn.parentNode === actionsWrap;
        if (isEditor && inHeader) {
          actionsWrap.removeChild(settingsBtn);
        } else if (!isEditor && !inHeader) {
          actionsWrap.appendChild(settingsBtn);
        }
      }
    }

    // Кнопку «Нова група» (зліва) так само ховаємо в режимі редагування —
    // там немає списку груп, до якого вона мала б додавати елемент.
    const leftWrap = layoutEl.querySelector('.mobile-page-header .header-button-right-left');
    if (leftWrap) {
      const groupAddBtn =
        (typeof getNotesGroupAddBtn === 'function') ? getNotesGroupAddBtn() : null;
      if (groupAddBtn) {
        const inHeader = groupAddBtn.parentNode === leftWrap;
        if (isEditor && inHeader) {
          leftWrap.removeChild(groupAddBtn);
        } else if (!isEditor && !inHeader) {
          leftWrap.appendChild(groupAddBtn);
        }
      }
    }
  }

  // Дозволяє редагувати назву нотатки прямо в шапці режиму редагування.
  function startEditHeaderTitle(title) {
    const layoutEl = title.closest('.notes-layout');
    if (!layoutEl || !layoutEl.classList.contains('mobile-view-editor')) return;
    if (!notesActiveTopic || title.contentEditable === 'true') return;
    const topicId = notesActiveTopic;
    const oldName = (typeof getTopicName === 'function') ? getTopicName(topicId) : title.textContent;

    title.contentEditable = 'true';
    title.classList.add('header-page-title--editing');
    title.focus();

    const commit = () => {
      title.contentEditable = 'false';
      title.classList.remove('header-page-title--editing');
      title.removeEventListener('blur', commit);
      title.removeEventListener('keydown', onKeydown);
      const trimmed = title.textContent.replace(/\s+/g, ' ').trim();
      if (!trimmed || trimmed === oldName) {
        title.textContent = oldName;
        return;
      }
      const nameMap = getNotesNameMap();
      nameMap[topicId] = trimmed;
      saveNotesNameMap(nameMap);
      title.textContent = trimmed;
      const output = document.getElementById('output-notes');
      if (output && typeof renderNotesUI === 'function') renderNotesUI(output);
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      else if (e.key === 'Escape') {
        e.preventDefault();
        title.textContent = oldName;
        title.removeEventListener('blur', commit);
        title.removeEventListener('keydown', onKeydown);
        title.contentEditable = 'false';
        title.classList.remove('header-page-title--editing');
      }
    };

    title.addEventListener('blur', commit);
    title.addEventListener('keydown', onKeydown);
  }

  function initToggle(layoutEl) {
    if (layoutEl.dataset.mobileNotes === "1") return;
    if (!(window.matchMedia && window.matchMedia("(max-width: 600px)").matches)) return;
    layoutEl.dataset.mobileNotes = "1";

    // Відновлюємо останній вигляд (список чи редагування) після перезавантаження.
    // Для режиму редагування push=true — щоб свайп «назад» мав куди повертатись
    // (інакше на айфоні свайп одразу вийшов би з додатку).
    setView(layoutEl, getSavedView() === 'editor' ? 'editor' : 'list', true);

    // Універсальний мобільний заголовок: зліва — стрілка «назад»
    // (як на інших сторінках), справа — кнопка перемикача панелі
    // форматування (notes-toolbar-toggle). Якщо заголовок уже існує —
    // inject просто вийде (захист від повторного створення).
    const toolbarToggleBtn =
      (typeof getNotesToolbarToggleBtn === 'function') ? getNotesToolbarToggleBtn() : null;
    const settingsBtn =
      (typeof getNotesSettingsBtn === 'function') ? getNotesSettingsBtn() : null;
    const groupAddBtn =
      (typeof getNotesGroupAddBtn === 'function') ? getNotesGroupAddBtn() : null;

    // Дії у правому куті заголовка: перемикач панелі форматування
    // (notes-toolbar-toggle) і кнопка «Налаштування» — так само, як у
    // таймері завдань (getTasksSettingsBtn() кладеться у заголовок).
    const headerActions = [];
    if (toolbarToggleBtn) headerActions.push(toolbarToggleBtn);
    if (settingsBtn) headerActions.push(settingsBtn);

    // Зліва в заголовку — кнопка «Нова група» (видна лише у списку тем,
    // ховається в updateHeader разом із settingsBtn у режимі редагування).
    const leftActions = [];
    if (groupAddBtn) leftActions.push(groupAddBtn);

    if (typeof MobileHeader !== 'undefined') {
      MobileHeader.inject(
        layoutEl,
        'Нотатки',
        () => goToList(layoutEl),
        headerActions,
        leftActions
      );
      updateHeader(layoutEl);
    }

    // Вибір теми одразу перемикає до редагування (і пушить історію)
    layoutEl.addEventListener("click", (e) => {
      if (e.target.closest(".notes-topic-item")) {
        setView(layoutEl, 'editor', true);
      }
    });

    // Слухач «назад» браузера — робимо один раз на layout.
    if (!layoutEl.dataset.mobileNotesPopstate) {
      layoutEl.dataset.mobileNotesPopstate = "1";
      window.addEventListener("popstate", (e) => onPopState(e, layoutEl));
    }

    // Оновлюємо заголовок при перейменуванні активної теми
    const notesObserver = new MutationObserver(() => updateHeader(layoutEl));
    const sidebarList = layoutEl.querySelector('#notes-sidebar-list');
    if (sidebarList) notesObserver.observe(sidebarList, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    const existing = document.querySelector(".notes-layout");
    if (existing) initToggle(existing);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const layout = node.classList && node.classList.contains("notes-layout")
            ? node
            : (node.querySelector ? node.querySelector(".notes-layout") : null);
          if (layout) initToggle(layout);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", () => {
      const el = document.querySelector(".notes-layout");
      if (el) initToggle(el);
    });
  }

  return { init };
})();

/* ============================================================
   MOBILE HABITS ACTIONS — панель дій звичок на мобільному
   тепер звичайний блок у потоці на початку сторінки (див. css/app.css
   і tplMainHTML). Hover-логіка з habits.js на тачі не заважає, бо
   видимість кнопок керується CSS, а не класом .show-actions.
   ============================================================ */

/* ============================================================
   PULL TO REFRESH — тягнеш сторінку вниз = оновлення.
   Активна панель контенту (.tab-content.active) рухається за
   пальцем, тому жест відчувається натурально. Рухаємо ЛИШЕ
   активну панель, а не весь #contents-container: той тримає
   під собою DOM ВСІХ вкладок одночасно (зокрема важкі heatmap
   Звичок), і промоція такого гігантського піддерева в GPU-шар
   давала ривок саме на Звичках. Активна панель — єдина видима,
   тож візуально це ідентично, але шар утричі легший.
   Нативний скрол блокуємо одразу, коли захопили жест.
   ============================================================ */
const PullToRefresh = (() => {
  const THRESHOLD = 70;
  const MAX_PULL = 110;
  const REFRESH_OFFSET = 56;
  const TRANSITION = "transform 0.28s cubic-bezier(0.4,0,0.2,1)";
  let indicator, spinner;
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;
  let contentsEl = null;
  let contentTop0 = 0;
  let ready = false;
  // Жест-кандидат: дотик пройшов усі «ворота» (не таби/модалка/редактор),
  // але рішення «це рефреш чи скрол» відкладаємо до ПЕРШОГО руху пальця.
  let candidate = false;
  let startTarget = null;

  function getEls() {
    if (contentsEl) return;
    // Беремо саме активну панель вкладки, а не #contents-container,
    // щоб композитний шар не тягнув за собою DOM прихованих вкладок.
    contentsEl =
      document.querySelector(".tab-content.active") ||
      document.getElementById("contents-container");
  }

  function createIndicator() {
    indicator = document.createElement("div");
    indicator.className = "ptr-indicator";
    spinner = document.createElement("div");
    spinner.className = "ptr-spinner";
    indicator.appendChild(spinner);
    document.body.appendChild(indicator);
  }

  // Чи прокручена сторінка доверху САМЕ в точці дотику. Не покладаємось
  // на один селектор — залежно від вкладки реальний скролер може бути
  // різним (внутрішній .tab-content, вікно, body чи вкладений список).
  // Йдемо від точки дотику вгору по DOM: якщо будь-який прокручуваний
  // предок не догорнутий доверху — жест належить скролу, не рефрешу.
  // Наприкінці перевіряємо документ/вікно (включно з body.scrollTop для
  // iOS, де скролиться саме body).
  function isAtTop(target) {
    let el = target;
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      const canScroll =
        (oy === "auto" || oy === "scroll" || oy === "overlay") &&
        el.scrollHeight > el.clientHeight + 1;
      if (canScroll && el.scrollTop > 0) return false;
      el = el.parentElement;
    }
    const doc = document.scrollingElement || document.documentElement;
    return (
      (window.scrollY || (doc && doc.scrollTop) || document.body.scrollTop || 0) <= 0
    );
  }

  function isNotesEditorActive() {
    const layout = document.querySelector(".notes-layout");
    return !!(layout && layout.classList.contains("mobile-view-editor"));
  }

  function isAnyModalOpen() {
    // Відкриті оверлеї (редагування звички, смітник, налаштування тощо)
    // перехоплюють жест: тягання всередині них не має запускати рефреш.
    if (document.querySelector(".modal-overlay.open")) return true;
    if (document.body.classList.contains("settings-modal-open")) return true;
    return false;
  }

  // Блокуємо скрол фону, коли відкрита будь-яка модалка. На iOS навіть із
  // body { overflow: hidden } фон продовжує скролитись, якщо тягнути пальцем
  // по вільному місцю оверлею. Дозволяємо скролити лише ті елементи всередині
  // модалки, що мають власний вертикальний скрол (напр. довге тіло модалки).
  function isInsideModalScrollable(target) {
    let el = target;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const scrollableY =
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight;
      if (scrollableY) {
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        return { scrollable: true, atTop, atBottom };
      }
      el = el.parentElement;
    }
    return { scrollable: false, atTop: false, atBottom: false };
  }

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!isAnyModalOpen()) return;
      const t = e.target;
      if (t.closest && t.closest(".tab-order-list")) return;
      const info = isInsideModalScrollable(t);
      if (!info.scrollable) {
        e.preventDefault();
        return;
      }
      // Якщо скролюваний елемент дійшов до краю — глушимо подальший скрол,
      // щоб фон не «підхоплював» жест.
      const dy = e.touches[0].clientY - (t._ptrTouchY || e.touches[0].clientY);
      if ((info.atTop && dy > 0) || (info.atBottom && dy < 0)) {
        e.preventDefault();
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!isAnyModalOpen()) return;
      e.target._ptrTouchY = e.touches[0].clientY;
    },
    { passive: true },
  );

  function isOnTabs(e) {
    // Жест, що почався на панелі табів (кнопки табів, theme-toggle, gist,
    // «···»), не запускає pull-to-refresh: випадкове вертикальне проведення
    // пальцем по табах інакше викликало оновлення сторінки.
    const tabs = document.getElementById("tabs-container");
    return !!(tabs && tabs.contains(e.target));
  }

  function setTransition(on) {
    const t = on ? TRANSITION : "";
    if (contentsEl) contentsEl.style.transition = t;
    indicator.style.transition = t;
  }

  function moveContent(y) {
    if (!contentsEl) return;
    contentsEl.style.transform = `translate3d(0, ${y}px, 0)`;
  }

  function moveIndicator(y) {
    // Індикатор «виїжджає» слідом за контентом: його нижній край
    // тримається біля верху контенту, тож спінер видно в проміжку,
    // що відкривається під час тягнення. Зміна transform батьківського
    // елемента НЕ перериває CSS-анімацію обертання спінера (вона живе
    // на дочірньому .ptr-spinner і має власний таймлайн).
    indicator.style.transform = `translateY(${contentTop0 + y - 48}px)`;
  }

  function applyPull(pull) {
    const y = Math.min(pull, MAX_PULL);
    moveContent(y);
    moveIndicator(y);
    const isReady = pull >= THRESHOLD;
    // Перемикаємо клас лише коли стан реально змінився, щоб не
    // смикати style-recalc щокадру під час тягнення.
    if (isReady !== ready) {
      ready = isReady;
      indicator.classList.toggle("ptr-ready", isReady);
    }
  }

  function resetIndicator(animated) {
    ready = false;
    const clearWill = () => {
      if (contentsEl) {
        contentsEl.style.willChange = "";
        contentsEl.style.transform = "";
      }
      indicator.classList.remove("ptr-visible", "ptr-ready", "ptr-refreshing");
    };
    if (animated) {
      setTransition(true);
      if (contentsEl) contentsEl.style.transform = "translate3d(0, 0, 0)";
      indicator.style.transform = `translateY(${contentTop0 - 48}px)`;
      setTimeout(() => {
        setTransition(false);
        clearWill();
      }, 300);
    } else {
      if (contentsEl) contentsEl.style.transform = "translate3d(0, 0, 0)";
      indicator.style.transform = `translateY(${contentTop0 - 48}px)`;
      clearWill();
    }
  }

  function onTouchStart(e) {
    if (refreshing || e.touches.length !== 1) return;
    // У режимі редагування нотаток (відкритий редактор) вимикаємо
    // pull-to-refresh, бо жест заважає скролити/виділяти текст.
    // У списку нотаток оновлення тяганням лишається працюючим.
    if (isNotesEditorActive()) return;
    // Не запускаємо pull-to-refresh, коли відкрито будь-який оверлей
    // (редагування звички, смітник, налаштування) — інакше тягання
    // всередині модалки переривається рефрешем сторінки.
    if (isAnyModalOpen()) return;
    // Не запускаємо рефреш, якщо жест почався на панелі табів: випадкове
    // вертикальне проведення пальцем по табах не повинно оновлювати сторінку.
    if (isOnTabs(e)) return;
    // РІШЕННЯ «рефреш чи скрол» відкладаємо до першого руху (onTouchMove):
    // лише тоді видно напрямок пальця і реальну позицію скролу. Так ми НЕ
    // блокуємо нативний скрол, коли сторінка не вгорі.
    startTarget = e.target;
    startY = e.touches[0].clientY;
    currentY = startY;
    candidate = true;
    pulling = false;
  }

  // Реально запускаємо жест тягнення (після підтвердження напрямку/позиції).
  function beginPull() {
    // Щоразу беремо активну панель (користувач міг перемкнути вкладку
    // після попереднього жесту) — інакше тягнули б уже невидиму панель.
    contentsEl = null;
    getEls();
    if (!contentsEl) {
      candidate = false;
      return;
    }
    ready = false;
    // Натуральна відстань від верху вʼюпорту до контенту (нижче меню табів).
    contentTop0 = contentsEl.getBoundingClientRect().top;
    // Готуємо композитний GPU-шар, щоб браузер не створював текстуру для
    // великого піддерева посеред жесту (саме це давало ривок на старті).
    contentsEl.style.willChange = "transform";
    contentsEl.style.transform = "translate3d(0, 0, 0)";
    // Стартова позиція індикатора: захований одразу над верхом контенту.
    indicator.style.transform = `translateY(${contentTop0 - 48}px)`;
    indicator.classList.add("ptr-visible");
    pulling = true;
  }

  function onTouchMove(e) {
    if (refreshing || e.touches.length !== 1) return;

    // Фаза вибору: жест ще не захоплений — вирішуємо, це рефреш чи скрол.
    if (!pulling) {
      if (!candidate) return;
      const diff = e.touches[0].clientY - startY;
      // Палець пішов угору — це звичайний скрол, віддаємо жест браузеру.
      if (diff < 0) {
        candidate = false;
        return;
      }
      // Малий рух — ще не визначились; чекаємо явного наміру (поріг 6px),
      // щоб тап чи горизонтальний свайп не запускали рефреш.
      if (diff < 6) return;
      // Явно тягнуть униз. Запускаємо рефреш ЛИШЕ якщо сторінка справді
      // вгорі саме в цій точці дотику — інакше це скрол угору, не заважаємо.
      if (!isAtTop(startTarget)) {
        candidate = false;
        return;
      }
      // Зсуваємо точку відліку сюди, щоб контент не «стрибнув» на 6px.
      startY = e.touches[0].clientY;
      currentY = startY;
      beginPull();
      // Перший кадр тягнення обробимо вже в наступному touchmove.
      e.preventDefault();
      return;
    }

    // Фаза тягнення: жест захоплений.
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    // Палець пішов вгору нижче старту — відпускаємо жест, скрол повертається.
    if (diff <= 0) {
      pulling = false;
      candidate = false;
      resetIndicator(false);
      return;
    }
    // Захопили жест: блокуємо нативний скрол, щоб не було боротьби/ривків.
    e.preventDefault();
    // Rubber-band: зменшуємо опір при перетягуванні.
    const pull = diff / (1 + diff * 0.004);
    // Оновлюємо трансформ НАПРЯМУ (без rAF): це лише композитний запис,
    // а зайвий кадр rAF робив би так, що контент відстає від пальця.
    applyPull(pull);
  }

  function onTouchEnd() {
    candidate = false;
    if (!pulling || refreshing) return;
    pulling = false;
    const diff = currentY - startY;
    const pull = diff / (1 + diff * 0.004);

    if (pull >= THRESHOLD) {
      refreshing = true;
      indicator.classList.add("ptr-refreshing");
      indicator.classList.remove("ptr-ready");
      setTransition(true);
      if (contentsEl) contentsEl.style.transform = `translate3d(0, ${REFRESH_OFFSET}px, 0)`;
      // Тримаємо спінер видимим у смузі оновлення, поки триває рефреш.
      indicator.style.transform = `translateY(${contentTop0 + REFRESH_OFFSET - 48}px)`;
      setTimeout(() => setTransition(false), 300);

      doRefresh().finally(() => {
        refreshing = false;
        resetIndicator(true);
      });
    } else {
      resetIndicator(true);
    }
  }

  const nextFrame = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  async function doRefresh() {
    // Даємо спінеру відмалюватися хоча б один кадр, перш ніж блокувати
    // main thread важким ререндером — інакше анімація «тупцюється».
    await nextFrame();

    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;
    const tabName = activeTab.dataset.tabName;
    const isSpecial = CONFIG.specialTabs && CONFIG.specialTabs[tabName];

    if (isSpecial) {
      const specialId = CONFIG.specialTabs[tabName];
      if (specialId === "habits" && typeof renderHabits === "function") {
        renderHabits();
      } else if (specialId === "tasks" && typeof renderTasks === "function") {
        renderTasks();
      } else if (specialId === "timer" && typeof initTimer === "function") {
        initTimer();
      } else if (specialId === "notes" && typeof renderNotesUI === "function") {
        const output = document.getElementById("output-notes");
        if (output) renderNotesUI(output);
      }
    } else {
      const fileName = bookmarkFileName(tabName);
      const id = fileId(fileName);
      try {
        const bookmarks = await loadFileData(`${CONFIG.dir}/${fileName}`);
        bookmarksData[id].bookmarks = bookmarks;
        displayBookmarks(id, bookmarks);
      } catch (err) {
        const output = document.getElementById(`output-${id}`);
        if (output) output.innerHTML = `<div class="error">Помилка: ${err.message}</div>`;
      }
    }
  }

  function init() {
    if (!(window.matchMedia && window.matchMedia("(max-width: 600px)").matches)) return;
    createIndicator();
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
  }

  return { init };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    MobileChrome.init();
    MobileNotes.init();
    PullToRefresh.init();
  });
} else {
  MobileChrome.init();
  MobileNotes.init();
  PullToRefresh.init();
}
