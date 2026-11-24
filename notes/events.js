/* ---------- NOTES EVENTS ---------- */

function bindNotesEvents(container) {
  bindNotesShellEvents(container);
  bindNotesSidebarEvents(container);
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
    notesEditor.addEventListener('contextmenu', e => {
      if (e.target.closest('#notes-quill-editor') || e.target.closest('.ql-toolbar') || e.target.closest('.notes-local-warning')) return;
      e.preventDefault();
      showNoteAreaContextMenu(e, 'editor', container);
    });
  }

  const quillEditor = container.querySelector('#notes-quill-editor');
  if (quillEditor) {
    quillEditor.addEventListener('contextmenu', e => {
      e.preventDefault();
      showQuillEditorContextMenu(e, container);
    });
  }

  const sidebarList = container.querySelector('#notes-sidebar-list');
  if (sidebarList) {
    sidebarList.addEventListener('contextmenu', e => {
      if (e.target.closest('.notes-topic-item') || e.target.closest('.notes-group-header') || e.target.closest('.notes-topic-input')) return;
      e.preventDefault();
      const groupEl = e.target.closest('.notes-group');
      const targetGroup = groupEl ? groupEl.dataset.group : null;
      showNoteAreaContextMenu(e, 'sidebar', container, targetGroup);
    });
  }
}

/* Нову групу додаємо лише з контекстного меню. Поле для назви з'являється
   внизу списку груп і не змінює висоту якихось інших блоків. */
function startAddGroup(container) {
  const list = container.querySelector('#notes-sidebar-list');
  if (!list || list.querySelector('.notes-group-add-row')) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'notes-group-add-input';
  input.placeholder = 'Нова група...';

  const wrap = document.createElement('div');
  wrap.className = 'notes-input-wrap notes-group-add-row';
  const sendBtn = document.createElement('button');
  sendBtn.className = 'notes-send-btn';
  sendBtn.type = 'button';
  sendBtn.title = 'Додати групу';
  sendBtn.innerHTML = ICON('send', 18);
  sendBtn.addEventListener('mousedown', e => e.preventDefault());

  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    wrap.remove();
  };
  const commit = () => {
    if (done) return;
    const name = input.value.trim();
    close();
    if (!name) return;
    const groups = getNotesGroups();
    if (groups.includes(name)) { showToast('Така група вже існує'); return; }
    groups.push(name);
    saveNotesGroups(groups);
    renderNotesUI(container);
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  input.addEventListener('blur', commit);
  sendBtn.addEventListener('click', e => { e.preventDefault(); commit(); });
  input.addEventListener('dragstart', e => e.preventDefault());

  wrap.appendChild(input);
  wrap.appendChild(sendBtn);
  list.appendChild(wrap);

  input.focus();
  input.select();
  wrap.scrollIntoView({ block: 'nearest' });
}

// Bound every time the sidebar list is re-rendered, because the topic/group
// elements it targets are recreated on each render.
function bindNotesSidebarEvents(container) {
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
          if (groups.includes(trimmed)) { showToast('Така група вже існує'); return; }
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
      input.addEventListener('blur', commit);

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
    input.addEventListener('blur', commit);

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

  container.querySelectorAll('.notes-group-count').forEach(count => {
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
    item.addEventListener('click', () => {
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
      renderNotesUI(container);
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

function showNoteContextMenu(event, topic, topicIndex, container) {
  event.preventDefault();
  event.stopPropagation();
  hideNoteContextMenu();

  const topics = getNotesTopics();
  const isLast = topics.length <= 1;

  const menu = document.createElement('div');
  menu.className = 'notes-context-menu';
  menu.innerHTML = `
    <div class="ctx-item" data-action="edit">
      ${ICON('pen', 14)}
      <span>Редагувати</span>
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

  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
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
  showToast('Тему скопійовано');
}

function noteCtxDelete(topicId, container) {
  const topics = getNotesTopics();
  if (topics.length <= 1) {
    showToast('Не можна видалити останню тему');
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
    startAddGroup(container);
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
      ${ICON('edit3', 14)}
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
    startAddGroup(container);
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
      if (typeof showToast === 'function') showToast('Виділіть текст, щоб очистити форматування');
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
      if (typeof showToast === 'function') showToast('Виділіть текст, щоб застосувати закреслення');
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
      if (typeof showToast === 'function') showToast('Виділіть текст, щоб додати цитату');
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
      if (typeof showToast === 'function') showToast('Виділіть текст, щоб додати блок коду');
    }
  });

  menu.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (!range || range.length === 0) {
      if (typeof showToast === 'function') showToast('Виділіть текст, щоб скопіювати');
      return;
    }
    const text = quill.getText(range.index, range.length);
    const ok = await copyToClipboard(text);
    if (typeof showToast === 'function') showToast(ok ? 'Скопійовано' : 'Не вдалося скопіювати');
  });

  menu.querySelector('[data-action="cut"]').addEventListener('click', async () => {
    hideEditorContextMenu();
    if (!quill) return;
    const range = savedRange || quill.getSelection();
    if (!range || range.length === 0) {
      if (typeof showToast === 'function') showToast('Виділіть текст, щоб вирізати');
      return;
    }
    const text = quill.getText(range.index, range.length);
    const ok = await copyToClipboard(text);
    if (ok) quill.deleteText(range.index, range.length, 'user');
    if (typeof showToast === 'function') showToast(ok ? 'Вирізано' : 'Не вдалося вирізати');
  });

  menu.querySelector('[data-action="paste"]').addEventListener('click', async () => {
    hideEditorContextMenu();
    if (!quill) return;
    quill.focus();
    let range = savedRange || quill.getSelection();
    if (!range) range = { index: Math.max(0, quill.getLength() - 1), length: 0 };
    const text = await pasteFromClipboard();
    if (text === null) {
      if (typeof showToast === 'function') showToast('Не вдалося вставити');
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
