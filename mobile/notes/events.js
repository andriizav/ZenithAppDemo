/* ---------- NOTES EVENTS ---------- */

function bindNotesEvents(container) {
  bindNotesShellEvents(container);
  bindNotesSidebarEvents(container);
  bindNotesSidebarEventsRest(container);
}

// Довге утримання пальця (450мс, без зсуву понад 10px) відкриває контекстне
// меню на сенсорних екранах, де немає правого кліку. handler отримує
// touch-подію (сумісну з showXContextMenu, які читають clientX/clientY чи
// touches[0]). skipSelector дозволяє ігнорувати дотики по вкладених елементах
// (наприклад, кнопках), що мають власну поведінку.
function bindLongPress(el, handler, { skipSelector } = {}) {
  let pressTimer = null;
  let longPressed = false;
  let pressX = 0, pressY = 0;

  const cancelPress = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };

  el.addEventListener('touchstart', e => {
    if (skipSelector && e.target.closest(skipSelector)) { cancelPress(); return; }
    if (e.touches.length !== 1) { cancelPress(); return; }
    longPressed = false;
    notesSuppressNextClick = false;
    const t = e.touches[0];
    pressX = t.clientX; pressY = t.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      longPressed = true;
      if (navigator.vibrate) navigator.vibrate(15);
      notesSuppressNextClick = true;
      handler(e);
    }, 450);
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - pressX) > 10 || Math.abs(t.clientY - pressY) > 10) {
      cancelPress();
    }
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (longPressed) e.preventDefault();
    cancelPress();
  });
  el.addEventListener('touchcancel', cancelPress);
}

// Bound once, when the shell (editor + sidebar frame) is first built. These
// elements are never replaced, so the listeners stay valid.
function bindNotesShellEvents(container) {
  const statusEl = container.querySelector('#notes-status');
  const sidebar = container.querySelector('.notes-sidebar');
  const resizer = container.querySelector('#notes-sidebar-resizer');
  const layout = container.querySelector('.notes-layout');
  const layoutResizer = container.querySelector('#notes-layout-resizer');

  const setupSyncLink = container.querySelector('#notes-setup-sync');
  if (setupSyncLink) {
    setupSyncLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof createGistSettingsModal === 'function') {
        createGistSettingsModal();
      }
    });
  }

  let isResizingSidebar = false;
  let sidebarStartX = 0;
  let sidebarStartWidth = 0;

  if (resizer) {
    resizer.addEventListener('mousedown', (e) => {
      isResizingSidebar = true;
      sidebarStartX = e.clientX;
      sidebarStartWidth = sidebar.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

  let isResizingLayout = false;
  let layoutStartX = 0;
  let layoutStartWidth = 0;

  if (layoutResizer) {
    layoutResizer.addEventListener('mousedown', (e) => {
      isResizingLayout = true;
      layoutStartX = e.clientX;
      layoutStartWidth = layout.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (isResizingSidebar) {
      const deltaX = e.clientX - sidebarStartX;
      const newWidth = Math.max(180, Math.min(400, sidebarStartWidth + deltaX));
      sidebar.style.width = newWidth + 'px';
    }
    if (isResizingLayout) {
      const deltaX = e.clientX - layoutStartX;
      const newWidth = Math.max(600, Math.min(window.innerWidth * 0.95, layoutStartWidth + deltaX));
      layout.style.width = newWidth + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizingSidebar) {
      isResizingSidebar = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('notes_sidebar_width', sidebar.offsetWidth);
      if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
        fileStorage.markPendingChanges();
      }
    }
    if (isResizingLayout) {
      isResizingLayout = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('notes_layout_width', layout.offsetWidth);
      if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
        fileStorage.markPendingChanges();
      }
    }
  });

  const quill = getQuillEditor();
  if (quill) {
    quill.on('text-change', () => {
      ensureNoteForEditor();
      clearTimeout(notesSaveTimer);
      notesStatusTimers.forEach(clearTimeout);
      notesStatusTimers = [];

      notesSaveTimer = setTimeout(() => {
        notesSaveTimer = null;
        saveCurrentNote(quill.root.innerHTML);
        const newStatus = getEditTime();
        if (statusEl.textContent === newStatus) return;
        statusEl.style.opacity = '0';
        notesStatusTimers.push(setTimeout(() => {
          statusEl.textContent = newStatus;
          statusEl.className = 'notes-status';
          statusEl.style.opacity = '1';
        }, 300));
      }, SAVE_DELAY);
    });
  }

  const notesEditor = container.querySelector('.notes-editor');
  if (notesEditor) {
    const editorAreaSkip = '#notes-quill-editor, .ql-toolbar, .notes-local-warning';
    notesEditor.addEventListener('contextmenu', e => {
      if (e.target.closest(editorAreaSkip)) return;
      e.preventDefault();
      showNoteAreaContextMenu(e, 'editor', container);
    });
    bindLongPress(notesEditor, e => showNoteAreaContextMenu(e, 'editor', container), { skipSelector: editorAreaSkip });
  }

  const quillEditor = container.querySelector('#notes-quill-editor');
  if (quillEditor) {
    quillEditor.addEventListener('contextmenu', e => {
      e.preventDefault();
      showQuillEditorContextMenu(e, container);
    });
  }

  const sidebarActions = container.querySelector('.notes-sidebar-actions');
  if (sidebarActions) {
    const sidebarActionsSkip = '.notes-gist-settings-btn, .notes-group-add';
    sidebarActions.addEventListener('contextmenu', e => {
      if (e.target.closest(sidebarActionsSkip)) return;
      e.preventDefault();
      showNoteAreaContextMenu(e, 'sidebar', container);
    });
    bindLongPress(sidebarActions, e => showNoteAreaContextMenu(e, 'sidebar', container), { skipSelector: sidebarActionsSkip });
  }

  const sidebarList = container.querySelector('#notes-sidebar-list');
  if (sidebarList) {
    const sidebarListSkip = '.notes-topic-item, .notes-group-header, .notes-topic-input';
    sidebarList.addEventListener('contextmenu', e => {
      if (e.target.closest(sidebarListSkip)) return;
      e.preventDefault();
      const groupEl = e.target.closest('.notes-group');
      const targetGroup = groupEl ? groupEl.dataset.group : null;
      showNoteAreaContextMenu(e, 'sidebar', container, targetGroup);
    });
    bindLongPress(sidebarList, e => {
      const groupEl = e.target.closest('.notes-group');
      const targetGroup = groupEl ? groupEl.dataset.group : null;
      showNoteAreaContextMenu(e, 'sidebar', container, targetGroup);
    }, { skipSelector: sidebarListSkip });
  }
}

// Bound every time the sidebar list is re-rendered, because the topic/group
// elements it targets are recreated on each render.
function bindNotesSidebarEvents(container) {
  // Перехоплюємо (лише один раз, глобально) синтетичний клік після довгого
  // натискання, щоб він не влучив у пункт контекстного меню й не запустив
  // редагування нотатки.
  if (!notesClickGuardBound) {
    notesClickGuardBound = true;
    document.addEventListener('click', e => {
      if (notesSuppressNextClick) {
        notesSuppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  container.querySelectorAll('.notes-group-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.detail === 0) return;
      if (header.querySelector('input')) return;
      const group = header.parentElement;
      const collapsed = group.classList.toggle('collapsed');
      const groupName = group.dataset.group;
      const arr = getCollapsedGroups();
      if (collapsed) {
        if (!arr.includes(groupName)) arr.push(groupName);
      } else {
        const idx = arr.indexOf(groupName);
        if (idx !== -1) arr.splice(idx, 1);
      }
      saveCollapsedGroups(arr);
    });
  });

  container.querySelectorAll('.notes-group-header').forEach(header => {
    header.addEventListener('auxclick', e => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      const groupEl = header.parentElement;
      if (header.querySelector('.notes-group-add-input')) return;
      groupEl.draggable = false;
      const oldName = groupEl.dataset.group;
      const nameEl = header.querySelector('.notes-group-name');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'notes-group-add-input';
      input.value = oldName;

      const cleanup = () => {
        let parent = input;
        while (parent = parent.parentElement) {
          if (parent._wasDraggable) {
            parent.draggable = true;
            parent._wasDraggable = false;
          }
        }
      };

      const originalCommit = () => {
        cleanup();
        groupEl.draggable = true;
        const trimmed = input.value.trim();
        input.remove();
        nameEl.style.display = '';
        if (!trimmed || trimmed === oldName) return;

        if (oldName === getMainGroupName()) {
          setMainGroupName(trimmed);
          const tg = getTopicGroups();
          for (const k in tg) { if (tg[k] === oldName) tg[k] = trimmed; }
          saveTopicGroups(tg);
          const groups = getNotesGroups();
          const index = groups.indexOf(oldName);
          if (index !== -1) {
            groups[index] = trimmed;
            saveNotesGroups(groups);
          }
        } else {
          const groups = getNotesGroups();
          if (groups.includes(trimmed)) { showNotesToast('Така група вже існує'); return; }
          const idx = groups.indexOf(oldName);
          groups[idx] = trimmed;
          saveNotesGroups(groups);
          const tg = getTopicGroups();
          for (const k in tg) { if (tg[k] === oldName) tg[k] = trimmed; }
          saveTopicGroups(tg);
        }
        renderNotesUI(container);
      };

      let commit = originalCommit;

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); input.removeEventListener('blur', commit); commit(); }
        if (e.key === 'Escape') { cleanup(); groupEl.draggable = true; input.remove(); nameEl.style.display = ''; }
      });
    input.addEventListener('blur', () => {
      if (input.value.trim()) return;
      commit();
    });

      nameEl.style.display = 'none';
      nameEl.parentElement.appendChild(input);

      input.focus();
      input.select();

      let parent = input;
      while (parent = parent.parentElement) {
        if (parent.draggable) {
          parent._wasDraggable = true;
          parent.draggable = false;
        }
      }
      
      input.addEventListener('dragstart', e => e.preventDefault());
      input.addEventListener('mousedown', e => e.stopPropagation());
      input.addEventListener('click', e => e.stopPropagation());
    });
  });

  function startAddTopic(groupEl) {
    if (groupEl.querySelector('.notes-topic-input')) return;
    const groupName = groupEl.dataset.group;
    const topicsContainer = groupEl.querySelector('.notes-group-topics');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'notes-topic-input';
    input.placeholder = 'Нова нотатка...';

    const cleanup = () => {
      let parent = input;
      while (parent = parent.parentElement) {
        if (parent._wasDraggable) {
          parent.draggable = true;
          parent._wasDraggable = false;
        }
      }
    };

    const originalCommit = () => {
      cleanup();
      let name = input.value.trim();
      wrap.remove();
      if (!name) return;
      const id = generateNoteId();
      const topics = getNotesTopics();
      topics.push(id);
      saveNotesTopics(topics);
      const nameMap = getNotesNameMap();
      nameMap[id] = name;
      saveNotesNameMap(nameMap);
      const tg = getTopicGroups();
      tg[id] = groupName;
      saveTopicGroups(tg);
      const data = getNotesData();
      data[id] = '';
      saveNotesData(data);
      notesActiveTopic = id;
      localStorage.setItem(NOTES_ACTIVE_KEY, notesActiveTopic);
      renderNotesUI(container);
      setTimeout(() => {
        const q = getQuillEditor();
        if (q) q.focus();
      }, 0);
    };

    let commit = originalCommit;

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { cleanup(); wrap.remove(); }
    });
    input.addEventListener('blur', () => { if (!input.value.trim()) commit(); });

    const wrap = document.createElement('div');
    wrap.className = 'notes-input-wrap';
    const sendBtn = document.createElement('button');
    sendBtn.className = 'notes-send-btn';
    sendBtn.type = 'button';
    sendBtn.innerHTML = ICON('send', 18);
    sendBtn.addEventListener('mousedown', e => e.preventDefault());
    sendBtn.addEventListener('click', e => { e.preventDefault(); commit(); });
    wrap.appendChild(input);
    wrap.appendChild(sendBtn);
    topicsContainer.appendChild(wrap);
    
    input.focus();
    
    let parent = input;
    while (parent = parent.parentElement) {
      if (parent.draggable) {
        parent._wasDraggable = true;
        parent.draggable = false;
      }
    }
    
    input.addEventListener('dragstart', e => e.preventDefault());
    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('click', e => e.stopPropagation());
  }

  container.querySelectorAll('.notes-group-add-icon, .notes-group-count').forEach(count => {
    count.addEventListener('click', e => {
      e.stopPropagation();
      const groupEl = count.closest('.notes-group');
      if (groupEl.querySelector('.notes-topic-input')) return;
      if (groupEl.classList.contains('collapsed')) {
        groupEl.classList.remove('collapsed');
        const groupName = groupEl.dataset.group;
        const arr = getCollapsedGroups();
        const idx = arr.indexOf(groupName);
        if (idx !== -1) arr.splice(idx, 1);
        saveCollapsedGroups(arr);
      }
      startAddTopic(groupEl);
    });
  });

  container.querySelectorAll('.notes-group-topics').forEach(topicsContainer => {
    topicsContainer.addEventListener('dblclick', e => {
      if (e.target !== topicsContainer) return;
      startAddTopic(topicsContainer.closest('.notes-group'));
    });
  });

  const groupAdd = container.querySelector('#notes-group-add');
  groupAdd.addEventListener('click', () => {
    startAddGroup(container, groupAdd);
  });
}

// Показує поле вводу назви нової групи біля кнопки «Нова група» внизу
// сайдбару (десктоп, де #notes-group-add видима одразу).
function startAddGroup(container, groupAdd) {
  if (!groupAdd) return;
  if (groupAdd.parentElement.querySelector('.notes-group-add-input')) return;

  const wrap = createGroupAddInput(container, () => {
    wrap.remove();
    groupAdd.style.display = '';
  });

  groupAdd.style.display = 'none';
  groupAdd.parentElement.appendChild(wrap);
  focusGroupAddInput(wrap);
}

// Показує поле вводу назви нової групи в окремому блоці одразу під
// заголовком сторінки (#notes-group-add-top) — використовується кнопкою
// «Нова група» в мобільному заголовку, де до нижньої кнопки не дотягнутись
// жестом без прокрутки списку груп.
function startAddGroupTop(container) {
  const slot = container.querySelector('#notes-group-add-top');
  if (!slot) return;

  const existing = slot.querySelector('.notes-input-wrap');
  if (existing) {
    existing.remove();
    return;
  }

  const wrap = createGroupAddInput(container, () => {
    wrap.remove();
  }, { skipBlur: true });

  slot.appendChild(wrap);
  focusGroupAddInput(wrap);
}

// Спільна розмітка поля вводу назви групи + кнопки «відправити».
// onClose викликається після скасування/збереження, щоб прибрати обгортку
// зі свого місця (нижня кнопка чи верхній слот — розрізняються самим
// викликачем).
function createGroupAddInput(container, onClose, { skipBlur = false } = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'notes-group-add-input';
  input.placeholder = 'Нова група...';

  const cleanup = () => {
    let parent = input;
    while (parent = parent.parentElement) {
      if (parent._wasDraggable) {
        parent.draggable = true;
        parent._wasDraggable = false;
      }
    }
  };

  const commit = () => {
    cleanup();
    const name = input.value.trim();
    onClose();
    if (!name) return;
    const groups = getNotesGroups();
    if (groups.includes(name)) { showNotesToast('Така група вже існує'); return; }
    groups.push(name);
    saveNotesGroups(groups);
    renderNotesUI(container);
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { cleanup(); onClose(); }
  });
  if (!skipBlur) input.addEventListener('blur', () => { if (!input.value.trim()) commit(); });

  const wrap = document.createElement('div');
  wrap.className = 'notes-input-wrap';
  const sendBtn = document.createElement('button');
  sendBtn.className = 'notes-send-btn';
  sendBtn.type = 'button';
  sendBtn.innerHTML = ICON('send', 18);
  sendBtn.addEventListener('mousedown', e => e.preventDefault());
  sendBtn.addEventListener('click', e => { e.preventDefault(); commit(); });
  wrap.appendChild(input);
  wrap.appendChild(sendBtn);

  wrap._input = input;
  return wrap;
}

function focusGroupAddInput(wrap) {
  const input = wrap._input;
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);

  let parent = input;
  while (parent = parent.parentElement) {
    if (parent.draggable) {
      parent._wasDraggable = true;
      parent.draggable = false;
    }
  }

  input.addEventListener('dragstart', e => e.preventDefault());
  input.addEventListener('mousedown', e => e.stopPropagation());
  input.addEventListener('click', e => e.stopPropagation());
}

function bindNotesSidebarEventsRest(container) {
  container.querySelectorAll('.notes-group').forEach(group => {
    group.addEventListener('dblclick', e => {
      if (e.target.closest('.notes-topic-item') || e.target.closest('.notes-topic-input') || e.target.closest('.notes-group-header')) return;
      startAddTopic(group);
    });
  });

  container.querySelectorAll('.notes-group-header').forEach(header => {
    header.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      const groupEl = header.parentElement;
      const groupName = groupEl.dataset.group;
      showGroupContextMenu(e, groupName, container);
    });
    bindLongPress(header, e => {
      const groupEl = header.parentElement;
      const groupName = groupEl.dataset.group;
      showGroupContextMenu(e, groupName, container);
    });
  });

  container.querySelectorAll('.notes-group').forEach(group => {
    group.querySelector('.notes-group-header').addEventListener('contextmenu', e => {
      e.preventDefault();
      const groupEl = group;
      const groupName = groupEl.dataset.group;
      showGroupContextMenu(e, groupName, container);
    });
  });

  let lastClickTopic = null;
  let lastClickTime = 0;

  container.querySelectorAll('.notes-topic-item').forEach(item => {
    // Long-press (утримання пальця) на сенсорних екранах відкриває
    // контекстне меню замість перетягування/відкриття нотатки.
    let pressTimer = null;
    let longPressed = false;
    let pressX = 0, pressY = 0;

    const cancelPress = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };

    item.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { cancelPress(); return; }
      longPressed = false;
      notesSuppressNextClick = false;
      const t = e.touches[0];
      pressX = t.clientX; pressY = t.clientY;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        longPressed = true;
        // Пальця не рухали — це довге натискання, а не перетягування.
        // Вимикаємо Sortable, щоб випадково не почати drag, і прибираємо
        // його службові класи/стани.
        if (container._notesSortables) {
          container._notesSortables.forEach(s => s.option('disabled', true));
        }
        item.classList.remove('notes-topic-chosen');
        document.body.classList.remove('notes-dragging');
        if (navigator.vibrate) navigator.vibrate(15);
        const topic = item.dataset.topic;
        const topicIndex = getNotesTopics().indexOf(topic);
        notesSuppressNextClick = true;
        showNoteContextMenu(e, topic, topicIndex, container);
      }, 450);
    }, { passive: true });

    item.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - pressX) > 10 || Math.abs(t.clientY - pressY) > 10) {
        // Палець зрушив — це перетягування/скрол, меню не відкриваємо.
        cancelPress();
      }
    }, { passive: true });

    item.addEventListener('touchend', e => {
      if (longPressed) e.preventDefault(); // не генеруємо клік після меню
      cancelPress();
    });
    item.addEventListener('touchcancel', cancelPress);

    item.addEventListener('click', () => {
      if (longPressed) { longPressed = false; return; }
      const topic = item.dataset.topic;
      const now = Date.now();
      if (topic === lastClickTopic && now - lastClickTime < 400) {
        lastClickTopic = null;
        lastClickTime = 0;
        if (!item.querySelector('.notes-topic-input')) startRenameTopic(item, container);
        return;
      }
      lastClickTopic = topic;
      lastClickTime = now;

      if (item.classList.contains('active')) return;
      flushPendingNoteSave();
      notesActiveTopic = topic;
      localStorage.setItem(NOTES_ACTIVE_KEY, notesActiveTopic);
      switchActiveNote(container);
    });

    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      const topic = item.dataset.topic;
      const topicIndex = getNotesTopics().indexOf(topic);
      showNoteContextMenu(e, topic, topicIndex, container);
    });

    item.addEventListener('auxclick', e => {
      if (e.button !== 1) return;
      if (item.querySelector('.notes-topic-input')) return;
      e.preventDefault();
      e.stopPropagation();
      startRenameTopic(item, container);
    });
  });
}

/* ========== NOTES CONTEXT MENU ========== */

let activeNoteContextMenu = null;
let notesCtxContainer = null;
// Встановлюється, коли меню відкрилось від довгого натискання. Синтетичний
// «click», що браузер генерує після touchcancel/touchend, може влучити просто
// в пункт меню («Редагувати»), бо меню зʼявляється у точці дотику. Цей прапор
// дозволяє перехопити й «зʼїсти» цей клік, щоб не запускалося редагування.
let notesSuppressNextClick = false;
let notesClickGuardBound = false;

function showNoteContextMenu(event, topic, topicIndex, container) {
  event.preventDefault();
  event.stopPropagation();
  hideNoteContextMenu();
  notesCtxContainer = container;

  const topics = getNotesTopics();
  const isLast = topics.length <= 1;

  const menu = document.createElement('div');
  menu.className = 'notes-context-menu';
  menu.innerHTML = `
    <div class="ctx-item" data-action="edit">
      ${ICON('pen', 14)}
      <span>Перейменувати</span>
    </div>
    <div class="ctx-item" data-action="duplicate">
      ${ICON('copy', 14)}
      <span>Дублювати</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item ctx-item--danger${isLast ? ' disabled' : ''}" data-action="delete"${isLast ? ' title="Не можна видалити останню тему"' : ''}>
      ${ICON('trash', 14)}
      <span>Видалити</span>
    </div>
  `;

  document.body.appendChild(menu);
  activeNoteContextMenu = menu;

  const srcX = event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX;
  const srcY = event.touches && event.touches[0] ? event.touches[0].clientY : event.clientY;
  const x = Math.min(srcX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(srcY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  requestAnimationFrame(() => menu.classList.add('visible'));

  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    hideNoteContextMenu();
    noteCtxEdit(topic, container);
  });

  menu.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
    hideNoteContextMenu();
    noteCtxDuplicate(topic, container);
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (isLast) return;
    hideNoteContextMenu();
    noteCtxDelete(topic, container);
  });

  setTimeout(() => {
    document.addEventListener('click', hideNoteContextMenu, { once: true });
    document.addEventListener('contextmenu', hideNoteContextMenu, { once: true });
  }, 0);
}

function hideNoteContextMenu() {
  hideGroupContextMenu();
  if (activeNoteContextMenu) {
    activeNoteContextMenu.remove();
    activeNoteContextMenu = null;
  }
  // Повертаємо drag-and-drop, що його вимкнули при довгому натисканні.
  if (notesCtxContainer && notesCtxContainer._notesSortables) {
    notesCtxContainer._notesSortables.forEach(s => s.option('disabled', false));
  }
}

function startRenameTopic(item, container) {
  if (item.querySelector('.notes-topic-input')) return;
  item.draggable = false;
  item.classList.add('notes-topic-renaming');
  const topicId = item.dataset.topic;
  const oldName = getTopicName(topicId);
  const nameEl = item.querySelector('.notes-topic-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'notes-topic-input notes-rename-input';
  input.value = oldName;

  const cleanup = () => {
    item.classList.remove('notes-topic-renaming');
    item.draggable = true;
    let parent = input;
    while (parent = parent.parentElement) {
      if (parent._wasDraggable) {
        parent.draggable = true;
        parent._wasDraggable = false;
      }
    }
  };

  const commit = () => {
    cleanup();
    const trimmed = input.value.trim();
    input.remove();
    if (!trimmed || trimmed === oldName) {
      nameEl.textContent = oldName;
      return;
    }
    const nameMap = getNotesNameMap();
    nameMap[topicId] = trimmed;
    saveNotesNameMap(nameMap);
    if (notesActiveTopic === topicId) {
      renderNotesUI(container);
    } else {
      renderNotesUI(container);
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { cleanup(); input.remove(); nameEl.textContent = oldName; }
  });
  input.addEventListener('input', syncRenameWidth);
  input.addEventListener('blur', commit);

  nameEl.parentElement.appendChild(input);

  syncRenameWidth();
  input.focus();
  input.select();

  let parent = input;
  while (parent = parent.parentElement) {
    if (parent.draggable) {
      parent._wasDraggable = true;
      parent.draggable = false;
    }
  }
  input.addEventListener('dragstart', e => e.preventDefault());
  input.addEventListener('mousedown', e => e.stopPropagation());
  input.addEventListener('click', e => e.stopPropagation());
}

function syncRenameWidth() {
  const input = document.querySelector('.notes-rename-input');
  if (!input) return;
  const item = input.closest('.notes-topic-item');
  const name = item && item.querySelector('.notes-topic-name');
  if (!name) return;
  name.innerHTML = (input.value || input.placeholder || '').replace(/ /g, '&nbsp;');
}

function noteCtxEdit(topicId, container) {
  const item = container.querySelector(`.notes-topic-item[data-topic="${CSS.escape(topicId)}"]`);
  if (!item) return;
  startRenameTopic(item, container);
}

function noteCtxDuplicate(topicId, container) {
  // If the note being duplicated is open in the editor, make sure its latest
  // (possibly still debounced) content is what gets copied.
  flushPendingNoteSave();
  const topics = getNotesTopics();
  const data = getNotesData();
  const ts = getNotesTimestamps();
  const tg = getTopicGroups();
  const nameMap = getNotesNameMap();

  const newName = getTopicName(topicId);
  const newId = generateNoteId();
  nameMap[newId] = newName;
  saveNotesNameMap(nameMap);
  topics.push(newId);
  saveNotesTopics(topics);
  if (data[topicId]) { data[newId] = data[topicId]; saveNotesData(data); }
  if (ts[topicId]) { ts[newId] = ts[topicId]; saveNotesTimestamps(ts); }
  if (tg[topicId]) { tg[newId] = tg[topicId]; saveTopicGroups(tg); }

  notesActiveTopic = newId;
  localStorage.setItem(NOTES_ACTIVE_KEY, notesActiveTopic);
  renderNotesUI(container);
  showNotesToast('Тему скопійовано');
}

function noteCtxDelete(topicId, container) {
  const topics = getNotesTopics();
  if (topics.length <= 1) {
    showNotesToast('Не можна видалити останню тему');
    return;
  }
  const name = getTopicName(topicId);
  showDeleteConfirm({
    title: 'Видалити тему',
    name: name,
    text: 'Усі нотатки цієї теми буде безповоротно втрачено.',
    confirmLabel: 'Видалити',
    onConfirm: () => deleteTopic(topicId, container)
  });
}

/* ========== GROUP HEADER CONTEXT MENU ========== */

let activeGroupContextMenu = null;

function showGroupContextMenu(event, groupName, container) {
  event.preventDefault();
  event.stopPropagation();
  hideNoteContextMenu();
  hideNoteAreaContextMenu();
  hideGroupContextMenu();

  const groups = getNotesGroups();
  const isMain = groupName === getMainGroupName();
  const isLast = groups.length <= 1;

  const menu = document.createElement('div');
  menu.className = 'notes-context-menu';
  menu.innerHTML = `
    <div class="ctx-item" data-action="rename">
      ${ICON('pen', 14)}
      <span>Перейменувати</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item" data-action="add-topic">
      ${ICON('plus', 14)}
      <span>Нова нотатка</span>
    </div>
    <div class="ctx-item" data-action="new-group">
      ${ICON('folderPlus', 14)}
      <span>Нова група</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item ctx-item--danger${isMain ? ' disabled' : ''}" data-action="delete"${isMain ? ' title="Не можна видалити основну групу"' : ''}>
      ${ICON('trash', 14)}
      <span>Видалити</span>
    </div>
  `;

  document.body.appendChild(menu);
  activeGroupContextMenu = menu;

  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  requestAnimationFrame(() => menu.classList.add('visible'));

  menu.querySelector('[data-action="add-topic"]').addEventListener('click', () => {
    hideGroupContextMenu();
    const groupEl = container.querySelector(`.notes-group[data-group="${CSS.escape(groupName)}"]`);
    if (groupEl) {
      const collapsed = groupEl.classList.contains('collapsed');
      if (collapsed) {
        groupEl.classList.remove('collapsed');
        const arr = getCollapsedGroups();
        const idx = arr.indexOf(groupName);
        if (idx !== -1) arr.splice(idx, 1);
        saveCollapsedGroups(arr);
      }
      const topicsContainer = groupEl.querySelector('.notes-group-topics');
      if (topicsContainer) {
        topicsContainer.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }
    }
  });

  menu.querySelector('[data-action="new-group"]').addEventListener('click', () => {
    hideGroupContextMenu();
    const groupAdd = container.querySelector('#notes-group-add');
    if (groupAdd) groupAdd.click();
  });

  menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
    hideGroupContextMenu();
    const groupEl = container.querySelector(`.notes-group[data-group="${CSS.escape(groupName)}"]`);
    if (!groupEl) return;
    const header = groupEl.querySelector('.notes-group-header');
    if (!header) return;
    header.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (isMain || isLast) return;
    hideGroupContextMenu();
    showDeleteConfirm({
      title: 'Видалити групу',
      name: groupName,
      text: `Усі теми перейдуть у «${getMainGroupName()}».`,
      confirmLabel: 'Видалити',
      onConfirm: () => {
        const newGroups = getNotesGroups().filter(g => g !== groupName);
        saveNotesGroups(newGroups);
        const tg = getTopicGroups();
        for (const k in tg) { if (tg[k] === groupName) tg[k] = getMainGroupName(); }
        saveTopicGroups(tg);
        renderNotesUI(container);
      }
    });
  });

  setTimeout(() => {
    document.addEventListener('click', hideGroupContextMenu, { once: true });
    document.addEventListener('contextmenu', hideGroupContextMenu, { once: true });
  }, 0);
}

function hideGroupContextMenu() {
  if (activeGroupContextMenu) {
    activeGroupContextMenu.remove();
    activeGroupContextMenu = null;
  }
}

/* ========== AREA CONTEXT MENU (empty space) ========== */

let activeNoteAreaContextMenu = null;

function showNoteAreaContextMenu(event, area, container, targetGroup) {
  event.preventDefault();
  event.stopPropagation();
  hideNoteContextMenu();
  hideNoteAreaContextMenu();

  const menu = document.createElement('div');
  menu.className = 'notes-context-menu';
  menu.innerHTML = `
    <div class="ctx-item" data-action="new-topic">
      ${ICON('plus', 14)}
      <span>Нова нотатка</span>
    </div>
    <div class="ctx-item" data-action="new-group">
      ${ICON('folderPlus', 14)}
      <span>Нова група</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item" data-action="settings">
      ${ICON('bolt', 14)}
      <span>Налаштування</span>
    </div>
  `;

  document.body.appendChild(menu);
  activeNoteAreaContextMenu = menu;

  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  requestAnimationFrame(() => menu.classList.add('visible'));

  menu.querySelector('[data-action="new-topic"]').addEventListener('click', () => {
    hideNoteAreaContextMenu();
    const groupToUse = targetGroup || getMainGroupName();
    const sidebarList = container.querySelector('#notes-sidebar-list');
    if (sidebarList) {
      const groupEl = sidebarList.querySelector(`.notes-group[data-group="${CSS.escape(groupToUse)}"]`) || sidebarList.querySelector('.notes-group');
      if (groupEl) {
        const collapsed = groupEl.classList.contains('collapsed');
        if (collapsed) {
          groupEl.classList.remove('collapsed');
          const arr = getCollapsedGroups();
          const idx = arr.indexOf(groupToUse);
          if (idx !== -1) arr.splice(idx, 1);
          saveCollapsedGroups(arr);
        }
        const topicsContainer = groupEl.querySelector('.notes-group-topics');
        if (topicsContainer) {
          topicsContainer.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      }
    }
  });

  menu.querySelector('[data-action="new-group"]').addEventListener('click', () => {
    hideNoteAreaContextMenu();
    const groupAdd = container.querySelector('#notes-group-add');
    if (groupAdd) groupAdd.click();
  });

  menu.querySelector('[data-action="settings"]').addEventListener('click', () => {
    hideNoteAreaContextMenu();
    if (typeof openNotesSettingsModal === 'function') {
      openNotesSettingsModal();
    }
  });

  setTimeout(() => {
    document.addEventListener('click', hideNoteAreaContextMenu, { once: true });
    document.addEventListener('contextmenu', hideNoteAreaContextMenu, { once: true });
  }, 0);
}

function hideNoteAreaContextMenu() {
  hideGroupContextMenu();
  if (activeNoteAreaContextMenu) {
    activeNoteAreaContextMenu.remove();
    activeNoteAreaContextMenu = null;
  }
}

let activeEditorContextMenu = null;

function showQuillEditorContextMenu(event, container) {
  event.preventDefault();
  event.stopPropagation();
  hideNoteContextMenu();
  hideNoteAreaContextMenu();
  hideGroupContextMenu();
  hideEditorContextMenu();

  const quill = getQuillEditor();
  const savedRange = quill ? quill.getSelection() : null;
  const dividerEl = event.target.closest && event.target.closest('hr.ql-divider, hr');

  const menu = document.createElement('div');
  menu.className = 'notes-context-menu';
  menu.innerHTML = `
    ${dividerEl ? `
    <div class="ctx-item" data-action="delete-divider">
      ${ICON('trash', 14)}
      <span>Видалити лінію</span>
    </div>
    <div class="ctx-separator"></div>
    ` : ''}
    <div class="ctx-item" data-action="copy">
      ${ICON('copy', 14)}
      <span>Копіювати</span>
    </div>
    <div class="ctx-item" data-action="cut">
      ${ICON('link2', 14)}
      <span>Вирізати</span>
    </div>
    <div class="ctx-item" data-action="paste">
      ${ICON('moveToFolder', 14)}
      <span>Вставити</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item" data-action="strike">
      ${ICON('strikethrough', 14)}
      <span>Закреслений</span>
    </div>
    <div class="ctx-item" data-action="blockquote">
      ${ICON('quote', 14)}
      <span>Цитата</span>
    </div>
    <div class="ctx-item" data-action="code-block">
      ${ICON('code', 14)}
      <span>Код</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item" data-action="insert-datetime">
      ${ICON('calendarDays', 14)}
      <span>Вставити дату</span>
    </div>
    <div class="ctx-item" data-action="clean">
      ${ICON('removeFormatting', 14)}
      <span>Очистити форматування</span>
    </div>
  `;

  document.body.appendChild(menu);
  activeEditorContextMenu = menu;

  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  requestAnimationFrame(() => menu.classList.add('visible'));

  menu.querySelector('[data-action="clean"]').addEventListener('click', () => {
    hideEditorContextMenu();
    if (!quill) return;
    if (savedRange && savedRange.length > 0) {
      quill.setSelection(savedRange.index, savedRange.length);
      quill.removeFormat(savedRange.index, savedRange.length);
    } else {
      if (typeof showNotesToast === 'function') showNotesToast('Виділіть текст, щоб очистити форматування');
    }
  });

  const deleteDividerItem = menu.querySelector('[data-action="delete-divider"]');
  if (deleteDividerItem) {
    deleteDividerItem.addEventListener('click', () => {
      hideEditorContextMenu();
      if (!quill || !dividerEl) return;
      const idx = quill.getIndex(quill.scroll.find(dividerEl));
      if (typeof deleteDividerAt === 'function') {
        deleteDividerAt(quill, idx);
      } else {
        quill.deleteText(idx, 1, Quill.sources.USER);
        quill.focus();
      }
    });
  }

  menu.querySelector('[data-action="strike"]').addEventListener('click', () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (range && range.length > 0) {
      quill.setSelection(range.index, range.length);
      const isStrike = quill.getFormat(range.index, range.length).strike;
      quill.format('strike', !isStrike);
    } else {
      if (typeof showNotesToast === 'function') showNotesToast('Виділіть текст, щоб застосувати закреслення');
    }
  });

  menu.querySelector('[data-action="blockquote"]').addEventListener('click', () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (range) {
      quill.setSelection(range.index, range.length);
      const isQuote = quill.getFormat(range.index, range.length).blockquote;
      quill.format('blockquote', !isQuote);
    } else {
      if (typeof showNotesToast === 'function') showNotesToast('Виділіть текст, щоб додати цитату');
    }
  });

  menu.querySelector('[data-action="code-block"]').addEventListener('click', () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (range) {
      quill.setSelection(range.index, range.length);
      const isCode = quill.getFormat(range.index, range.length)['code-block'];
      quill.format('code-block', !isCode);
    } else {
      if (typeof showNotesToast === 'function') showNotesToast('Виділіть текст, щоб додати блок коду');
    }
  });

  menu.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (!range || range.length === 0) {
      if (typeof showNotesToast === 'function') showNotesToast('Виділіть текст, щоб скопіювати');
      return;
    }
    const text = quill.getText(range.index, range.length);
    const ok = await copyToClipboard(text);
    if (typeof showNotesToast === 'function') showNotesToast(ok ? 'Скопійовано' : 'Не вдалося скопіювати');
  });

  menu.querySelector('[data-action="cut"]').addEventListener('click', async () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (!range || range.length === 0) {
      if (typeof showNotesToast === 'function') showNotesToast('Виділіть текст, щоб вирізати');
      return;
    }
    const text = quill.getText(range.index, range.length);
    const ok = await copyToClipboard(text);
    if (ok) quill.deleteText(range.index, range.length, 'user');
    if (typeof showNotesToast === 'function') showNotesToast(ok ? 'Вирізано' : 'Не вдалося вирізати');
  });

  menu.querySelector('[data-action="paste"]').addEventListener('click', async () => {
    hideEditorContextMenu();
    if (!quill) return;
    quill.focus();
    let range = savedRange || quill.getSelection();
    if (!range) range = { index: Math.max(0, quill.getLength() - 1), length: 0 };
    const text = await pasteFromClipboard();
    if (text === null) {
      if (typeof showNotesToast === 'function') showNotesToast('Не вдалося вставити');
      return;
    }
    if (range.length > 0) quill.deleteText(range.index, range.length, 'user');
    quill.insertText(range.index, text, 'user');
    quill.setSelection(range.index + text.length, 0, 'user');
  });

  menu.querySelector('[data-action="insert-datetime"]').addEventListener('click', () => {
    hideEditorContextMenu();
    if (!quill) return;
    quill.focus();
    let range = savedRange || quill.getSelection();
    if (!range) range = { index: Math.max(0, quill.getLength() - 1), length: 0 };
    const dateTime = new Date().toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (range.length > 0) quill.deleteText(range.index, range.length, 'user');
    quill.insertText(range.index, dateTime, 'user');
    quill.setSelection(range.index + dateTime.length, 0, 'user');
  });

  setTimeout(() => {
    document.addEventListener('click', hideEditorContextMenu, { once: true });
    document.addEventListener('contextmenu', hideEditorContextMenu, { once: true });
  }, 0);
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

async function pasteFromClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
  } catch (e) {}
  return null;
}

function hideEditorContextMenu() {
  if (activeEditorContextMenu) {
    activeEditorContextMenu.remove();
    activeEditorContextMenu = null;
  }
}
