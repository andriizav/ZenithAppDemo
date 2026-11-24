/* ---------- NOTES UI ---------- */

const SAVE_DELAY = 500;

const NOTES_LUCIDE = {
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />',
  italic: '<line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" />',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" x2="20" y1="20" y2="20" />',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" x2="20" y1="12" y2="12" />',
  'heading-1': '<path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="m17 12 3-2v8" />',
  'heading-2': '<path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />',
  quote: '<path d="M14 14a2 2 0 0 0 2-2V8h-2"/><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M8 14a2 2 0 0 0 2-2V8H8"/>',
  'code-block': '<path d="m10 9-3 3 3 3" /><path d="m14 15 3-3-3-3" /><rect x="3" y="3" width="18" height="18" rx="2" />',
  'list-ordered': '<path d="M11 5h10" /><path d="M11 12h10" /><path d="M11 19h10" /><path d="M4 4h1v5" /><path d="M4 9h2" /><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />',
  'list': '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
  'list-checks': '<path d="M13 5h8" /><path d="M13 12h8" /><path d="M13 19h8" /><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" />',
  'align-left': '<path d="M3 6h15"/><path d="M3 12h9"/><path d="M3 18h15"/>',
  'align-center': '<path d="M4.5 6h15"/><path d="M7.5 12h9"/><path d="M4.5 18h15"/>',
  'align-right': '<path d="M6 6h15"/><path d="M12 12h9"/><path d="M6 18h15"/>',
  'align-justify': '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  video: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"/>',
  'paint-bucket': '<path d="M11 7 6 2" /><path d="M18.992 12H2.041" /><path d="M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595" /><path d="m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33" />',
  highlighter: '<path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />',
  'chevron-down': '<path d="m6 9 6 6 6-6" />',
  'divider': '<line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.5" />'
};

function notesLucideSvg(name) {
  const paths = NOTES_LUCIDE[name];
  if (!paths) return '';
  return `<svg class="notes-lucide-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function applyLucideToolbarIcons() {
  if (typeof Quill === 'undefined') return;
  let icons;
  try {
    icons = Quill.import('ui/icons');
  } catch (e) {
    return;
  }
  if (!icons) return;
  icons.bold = notesLucideSvg('bold');
  icons.italic = notesLucideSvg('italic');
  icons.underline = notesLucideSvg('underline');
  icons.strike = notesLucideSvg('strike');
  icons.blockquote = notesLucideSvg('quote');
  icons['code-block'] = notesLucideSvg('code-block');
  icons.link = notesLucideSvg('link');
  icons.image = notesLucideSvg('image');
  icons.video = notesLucideSvg('video');
  icons.header = { '1': notesLucideSvg('heading-1'), '2': notesLucideSvg('heading-2') };
  icons.list = {
    ordered: notesLucideSvg('list-ordered'),
    bullet: notesLucideSvg('list'),
    check: notesLucideSvg('list-checks')
  };
  icons.divider = notesLucideSvg('divider');
  icons.align = {
    '': notesLucideSvg('align-left'),
    'false': notesLucideSvg('align-left'),
    'center': notesLucideSvg('align-center'),
    'right': notesLucideSvg('align-right'),
    'justify': notesLucideSvg('align-justify')
  };
}

let notesSaveTimer = null;
let notesStatusTimers = [];
let notesSyncError = null;
let notesQuill = null;
// The topic whose content is currently loaded in the editor. Saves always
// target THIS topic (not notesActiveTopic), so a save that lands after the
// active topic changed (late debounce timer, flush during a re-render) can
// never write one note's content into another note.
let notesEditorTopic = null;

function getNotesWarningHtml() {
    if (localStorage.getItem('notesWarningDismissed') === 'true') return '';
    const alertIcon = ICON('alertTriangle', 14, { extra: 'class="notes-alert-icon"' });
    if (notesSyncError) {
      return `<div class="notes-local-warning notes-sync-error">${alertIcon} Помилка синхронізації: ${escapeHtml(notesSyncError)}. <a href="#" id="notes-setup-sync" class="notes-setup-sync-link">Налаштувати синхронізацію.</a></div>`;
    }
    if (gistStorage.config.enabled && !gistStorage.config.token) {
      return `<div class="notes-local-warning notes-sync-error">${alertIcon} Помилка синхронізації Gist: не вказано токен. <a href="#" id="notes-setup-sync" class="notes-setup-sync-link">Налаштувати синхронізацію.</a></div>`;
    }
    if (fileStorage.config.enabled && !fileStorage.fileHandle) {
      return `<div class="notes-local-warning notes-sync-error">${alertIcon} Помилка синхронізації файлу: файл не вибрано. <a href="#" id="notes-setup-sync" class="notes-setup-sync-link">Налаштувати синхронізацію.</a></div>`;
    }
    if (!gistStorage.isEnabled() && !fileStorage.isEnabled()) {
      return `<div class="notes-local-warning">${alertIcon} Нотатки зберігаються лише в браузері. <a href="#" id="notes-setup-sync" class="notes-setup-sync-link">Налаштувати синхронізацію.</a></div>`;
    }
    return '';
}

function renderNotesUI(container) {
  // A sync pull may have deleted the active topic — fall back to the first
  // existing one so we never render (or save into) a ghost topic. A null
  // active topic is a valid "no note opened" state (e.g. start via #notes).
  const topics = getNotesTopics();
  if (notesActiveTopic && !topics.includes(notesActiveTopic)) {
    notesActiveTopic = topics[0] || null;
    if (notesActiveTopic) localStorage.setItem(NOTES_ACTIVE_KEY, notesActiveTopic);
    else localStorage.removeItem(NOTES_ACTIVE_KEY);
  }
  renderNotesShell(container);
  renderNotesSidebar(container);
  loadActiveNote();
}

// Builds the static layout (sidebar + editor) and the Quill instance exactly
// once. Subsequent renders only refresh the sidebar list and editor content,
// so the Quill history stack is preserved across topic/group changes.
function renderNotesShell(container) {
  notesStatusTimers.forEach(clearTimeout);
  notesStatusTimers = [];

  if (notesQuill) {
    // Already built — just make sure the shell still exists.
    if (container.querySelector('.notes-layout')) return;
  }

  const savedSidebarWidth = localStorage.getItem('notes_sidebar_width') || 240;
  const clampedSidebarWidth = Math.max(180, Math.min(400, parseInt(savedSidebarWidth)));
  const savedLayoutWidth = localStorage.getItem('notes_layout_width') || 900;
  const clampedLayoutWidth = Math.max(600, Math.min(window.innerWidth * 0.95, parseInt(savedLayoutWidth)));

  container.innerHTML = `
    <div class="notes-layout" style="width: ${clampedLayoutWidth}px">
      <div class="notes-sidebar" style="width: ${clampedSidebarWidth}px">
        <div class="notes-sidebar-list" id="notes-sidebar-list"></div>
        <div class="notes-sidebar-resizer" id="notes-sidebar-resizer"></div>
      </div>
      <div class="notes-editor">
        <div id="notes-quill-editor"></div>
        <div class="notes-status" id="notes-status">${getEditTime()}</div>
      </div>
      <div class="notes-layout-resizer" id="notes-layout-resizer"></div>
    </div>
  `;

  initQuillEditor();
  bindNotesShellEvents(container);
  if (typeof setupNotesDragDrop === 'function') {
    setupNotesDragDrop(container);
  }
  renderNotesActions();
  if (typeof addGistSettingsButton === 'function') {
    setTimeout(() => addGistSettingsButton(), 0);
  }
}

// Refreshes only the sidebar list and the sync warning. The editor and its
// history are left untouched.
function renderNotesSidebar(container) {
  const list = container.querySelector('#notes-sidebar-list');
  if (!list) return;

  const groups = getNotesGroups();
  const topics = getNotesTopics();
  const topicGroups = getTopicGroups();
  const showCount = getNotesSettings().showGroupCount;

  const groupsHtml = groups.map(g => {
    const groupTopics = topics.filter(t => {
      const tg = topicGroups[t] || getMainGroupName();
      return groups.includes(tg) ? tg === g : g === getMainGroupName();
    });
    const topicsHtml = groupTopics.map(t => {
      const activeClass = t === notesActiveTopic ? ' active' : '';
      const displayName = getTopicName(t);
      return `<div class="notes-topic-item${activeClass}" data-topic="${escapeHtml(t)}"><span class="notes-topic-name">${escapeHtml(displayName) || '(empty)'}</span></div>`;
    }).join('');
    const collapsedClass = getCollapsedGroups().includes(g) ? ' collapsed' : '';
    return `
      <div class="notes-group${collapsedClass}" data-group="${escapeHtml(g)}">
        <div class="notes-group-header">
          ${ICON('chevronDown', 16, { cls: 'notes-group-arrow' })}
          <span class="notes-group-name">${escapeHtml(g)}</span>
          ${showCount ? `<span class="notes-group-count">${groupTopics.length}</span>` : ''}
        </div>
        <div class="notes-group-topics">${topicsHtml}</div>
      </div>`;
  }).join('');

  list.innerHTML = groupsHtml;

  const warningEl = container.querySelector('.notes-local-warning');
  const warningHtml = getNotesWarningHtml();
  if (warningHtml) {
    if (warningEl) warningEl.outerHTML = warningHtml;
    else list.insertAdjacentHTML('afterend', warningHtml);
  } else if (warningEl) {
    warningEl.remove();
  }

  bindNotesSidebarEvents(container);
  if (typeof setupNotesDragDrop === 'function') {
    setupNotesDragDrop(container);
  }

  const setupSyncLink = container.querySelector('#notes-setup-sync');
  if (setupSyncLink) {
    setupSyncLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof createGistSettingsModal === 'function') {
        createGistSettingsModal();
      }
    });
  }
}

// Loads the active topic's content into the editor without recreating it, so
// the undo/redo history survives topic switches.
function loadActiveNote() {
  if (!notesQuill) return;
  // Persist whatever is still unsaved in the editor (pending debounce) BEFORE
  // overwriting it, so a re-render can never throw away freshly typed text.
  flushPendingNoteSave();
  const data = getNotesData();
  const content = data[notesActiveTopic] || '';

  // Same topic, same content — nothing to reload. Skipping keeps the cursor,
  // selection and undo history intact when only the sidebar changed (settings
  // toggle, group ops, sync status, cross-tab refresh).
  if (notesEditorTopic === notesActiveTopic && content === notesQuill.root.innerHTML) return;

  let delta;
  if (content && !isNotesContentEmpty(content)) {
    const temp = document.createElement('div');
    temp.innerHTML = content;
    if (temp.querySelector('*')) {
      // Real HTML (Quill output, etc.): parse it so formatting and line
      // breaks (<p>/<br>) are preserved.
      delta = notesQuill.clipboard.convert({ html: content });
    } else {
      // No real tags: literal text (e.g. "<button>") stored HTML-escaped.
      delta = notesQuill.clipboard.convert({ text: temp.textContent });
    }
  } else {
    delta = undefined; // setContents(undefined) clears the editor.
  }

  notesQuill.setContents(delta, Quill.sources.SILENT);
  notesEditorTopic = notesActiveTopic;

  // setContents above is recorded by Quill's mutation observer as a user edit,
  // so the first Ctrl+Z would wipe the whole note. Clear the history stack on
  // the next tick, after that mutation is recorded, so only real edits are
  // undoable.
  setTimeout(() => { if (notesQuill) notesQuill.history.clear(); }, 0);
}

function isNotesContentEmpty(html) {
  if (!html) return true;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  // Embeds mean the note is not empty even without text
  if (temp.querySelector('img, iframe, video, audio')) return false;
  const text = temp.textContent.replace(/\u00a0/g, '').trim();
  return text === '';
}

// Quill 2.0.3 does NOT ship a Divider blot (contrary to what the toolbar
// handler comment below used to claim). Without it the 'divider' toolbar button
// never gets a click listener and insertEmbed('divider', ...) throws. Register a
// minimal embed blot that renders an <hr> so the button works.
function ensureDividerBlot() {
  if (typeof Quill === 'undefined') return;
  if (Quill.imports && Quill.imports['formats/divider']) return;
  const Embed = Quill.import('blots/block/embed');
  class Divider extends Embed {}
  Divider.blotName = 'divider';
  Divider.tagName = 'hr';
  Divider.className = 'ql-divider';
  Quill.register(Divider, true);
}

function initQuillEditor() {
  ensureDividerBlot();
  applyLucideToolbarIcons();

  notesQuill = new Quill('#notes-quill-editor', {
    theme: 'snow',
    placeholder: 'Почніть писати...',
    modules: {
      toolbar: [
        // Форматування тексту
        ['bold', 'italic', 'underline'],

        // Кольори
        [{ color: [] }, { background: [] }],

        // Заголовки
        [{ align: [] }, { header: 1 }, { header: 2 }],

        // Списки
        [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],

        // Посилання та медіа
        ['link', 'image', 'video'],

        // Сепаратор (горизонтальна лінія)
        ['code-block', 'divider'],

        // Розмір тексту
        [{ size: ['small', false, 'large', 'huge'] }],
      ],
      history: {
        delay: 1000,
        maxStack: 500,
        userOnly: true,
      },
    }
  });

  // Guarantee Ctrl+Y (and Ctrl+Shift+Z) redo works on every platform.
  // Quill only registers Ctrl+Y when navigator.platform matches /Win/, which
  // can be empty or incorrect in some browsers, leaving redo completely broken.
  notesQuill.keyboard.addBinding({ key: 'y', shortKey: true }, () => notesQuill.history.redo());
  notesQuill.keyboard.addBinding({ key: 'z', shortKey: true, shiftKey: true }, () => notesQuill.history.redo());

  // Quill 2.0 does not ship a Divider blot, so we register one in
  // ensureDividerBlot(). The toolbar button still needs an explicit handler.
  const toolbar = notesQuill.getModule('toolbar');
  if (toolbar) {
    toolbar.addHandler('divider', () => {
      const range = notesQuill.getSelection(true);
      // Divider is a BlockEmbed, so Quill places it on its own line.
      notesQuill.insertEmbed(range.index, 'divider', true, Quill.sources.USER);
      notesQuill.setSelection(range.index + 1, Quill.sources.SILENT);
      notesQuill.focus();
    });
  }

  bindToolbarToggle();
  setupTooltipPositioning();
  setupInlineLinkInput();

  const editorEl = document.getElementById('notes-quill-editor');
  setupDividerInteractions(editorEl, notesQuill);
}

function bindToolbarToggle() {
  const toolbar = document.querySelector('.ql-toolbar');
  const editor = document.querySelector('.notes-editor');
  if (!toolbar || !editor) return;

  let reveal = editor.querySelector('.notes-toolbar-reveal');
  if (!reveal) {
    reveal = document.createElement('div');
    reveal.className = 'notes-toolbar-reveal';
    editor.appendChild(reveal);
  }

  let toolbarBtn = toolbar.querySelector('#notes-toolbar-toggle');
  if (!toolbarBtn) {
    toolbarBtn = createToolbarToggleButton();
    toolbarBtn.id = 'notes-toolbar-toggle';
    toolbar.appendChild(toolbarBtn);
  }

  let revealBtn = reveal.querySelector('.notes-toolbar-toggle');
  if (!revealBtn) {
    revealBtn = createToolbarToggleButton();
    revealBtn.title = 'Показати панель форматування';
    reveal.appendChild(revealBtn);
  }

  const savedHidden = localStorage.getItem('notes_toolbar_hidden') === '1';
  applyToolbarHidden(savedHidden, toolbar, reveal, revealBtn);

  const onClick = e => {
    e.preventDefault();
    const hidden = toolbar.classList.toggle('notes-toolbar-hidden');
    applyToolbarHidden(hidden, toolbar, reveal, revealBtn);
    localStorage.setItem('notes_toolbar_hidden', hidden ? '1' : '0');
  };
  toolbarBtn.addEventListener('click', onClick);
  reveal.addEventListener('click', onClick);
}

function createToolbarToggleButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notes-toolbar-toggle';
  btn.innerHTML = ICON('chevronUp', 24);
  return btn;
}

function applyToolbarHidden(hidden, toolbar, reveal, revealBtn) {
  toolbar.classList.toggle('notes-toolbar-hidden', hidden);
  reveal.classList.toggle('is-hidden', hidden);
  revealBtn.classList.toggle('is-hidden-toolbar', hidden);
}

function setupTooltipPositioning() {
  const editorEl = document.getElementById('notes-quill-editor');
  if (!editorEl) return;

  let tipObserver = null;

  const reposition = () => {
    const tip = editorEl.querySelector('.ql-tooltip');
    if (!tip || tip.classList.contains('ql-hidden')) return;

    const sel = window.getSelection();
    let rect = null;
    if (sel && sel.rangeCount > 0) {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    }
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      rect = notesQuill.root.getBoundingClientRect();
    }

    const tw = tip.offsetWidth || 240;
    const th = tip.offsetHeight || 40;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    let top = rect.bottom + 8;
    if (top + th > window.innerHeight - 8) {
      top = rect.top - th - 8;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };

  const ensureTipObserver = () => {
    const tip = editorEl.querySelector('.ql-tooltip');
    if (tip && !tipObserver) {
      tipObserver = new MutationObserver(reposition);
      tipObserver.observe(tip, { attributes: true, attributeFilter: ['class'] });
      reposition();
    }
  };

  const mainObserver = new MutationObserver(ensureTipObserver);
  mainObserver.observe(editorEl, { childList: true, subtree: true });
  ensureTipObserver();
}

function setupInlineLinkInput() {
  const toolbar = document.querySelector('.ql-toolbar');
  if (!toolbar || !notesQuill) return;

  const wrap = document.createElement('div');
  wrap.className = 'notes-inline-input hidden';
  wrap.innerHTML = `
    <span class="notes-inline-input-label"></span>
    <span class="notes-inline-input-field-wrap">
      <input type="text" class="notes-inline-input-field" spellcheck="false">
      <button type="button" class="notes-inline-input-cancel">
        ${ICON('close', 16)}
      </button>
      <button type="button" class="notes-inline-input-send">
        ${ICON('check', 16)}
      </button>
    </span>
  `;
  const toggle = toolbar.querySelector('#notes-toolbar-toggle');
  if (toggle) toolbar.insertBefore(wrap, toggle);
  else toolbar.appendChild(wrap);

  const labelEl = wrap.querySelector('.notes-inline-input-label');
  const input = wrap.querySelector('.notes-inline-input-field');
  const sendBtn = wrap.querySelector('.notes-inline-input-send');
  const cancelBtn = wrap.querySelector('.notes-inline-input-cancel');

  let currentType = null;
  let savedRange = null;

  const autoSize = () => {
    const min = 250, max = 480;
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'pre';
    span.style.font = getComputedStyle(input).font;
    span.textContent = input.value || input.placeholder || '';
    document.body.appendChild(span);
    const textW = span.getBoundingClientRect().width;
    span.remove();
    const pad = input.offsetWidth - input.clientWidth;
    let w = textW + pad + 2;
    w = Math.max(min, Math.min(w, max));
    input.style.width = w + 'px';
  };

  input.addEventListener('input', autoSize);

  const close = () => {
    wrap.classList.add('hidden');
    currentType = null;
    savedRange = null;
    notesQuill.focus();
  };

  const submit = () => {
    if (!currentType || !savedRange) return;
    const url = input.value.trim();
    const idx = savedRange.index;
    const len = savedRange.length;

    if (currentType === 'link') {
      if (len === 0) {
        if (url) {
          notesQuill.insertText(idx, url, { link: url });
          notesQuill.setSelection(idx + url.length);
        }
      } else {
        notesQuill.formatText(idx, len, 'link', url ? url : false);
        notesQuill.setSelection(idx + len);
      }
    } else if (currentType === 'video') {
      if (url) {
        notesQuill.insertEmbed(idx, 'video', url, Quill.sources.USER);
        notesQuill.setSelection(idx + 1);
      }
    }
    close();
  };

  sendBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', close);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  document.addEventListener('click', e => {
    if (wrap.classList.contains('hidden')) return;
    if (wrap.contains(e.target)) return;
    if (e.target.closest('button.ql-link') || e.target.closest('button.ql-video')) return;
    if (e.target.closest('#notes-quill-editor')) return;
    close();
  });

  const open = type => {
    currentType = type;
    savedRange = notesQuill.getSelection() || { index: 0, length: 0 };
    wrap.classList.remove('hidden');
    if (type === 'link') {
      labelEl.textContent = '';
      input.placeholder = 'Посилання';
      const fmt = notesQuill.getFormat(savedRange);
      input.value = fmt.link || '';
    } else {
      labelEl.textContent = '';
      input.placeholder = 'Відео';
      input.value = '';
    }
    setTimeout(() => { input.focus(); autoSize(); }, 0);
  };

  const toggleInline = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentType === type) close();
    else open(type);
  };

  const linkBtn = toolbar.querySelector('button.ql-link');
  const videoBtn = toolbar.querySelector('button.ql-video');
  if (linkBtn) linkBtn.addEventListener('click', e => toggleInline('link', e), true);
  if (videoBtn) videoBtn.addEventListener('click', e => toggleInline('video', e), true);
}

function getQuillEditor() {
  return notesQuill;
}

// Removes the divider (hr) that sits at the given Quill index. BlockEmbeds
// occupy a single position in the document, so deleting one char removes it.
function deleteDividerAt(quill, index) {
  if (!quill) return false;
  const [blot] = quill.getLeaf(index);
  const isDivider = blot && blot.domNode && blot.domNode.tagName === 'HR';
  if (!isDivider) return false;
  quill.deleteText(index, 1, Quill.sources.USER);
  quill.focus();
  return true;
}

// Shows a small floating "×" button next to a hovered divider so it can be
// removed with a single click. Returns a cleanup function.
function setupDividerInteractions(editorEl, quill) {
  if (!editorEl || !quill) return () => {};

  const onDblClick = (e) => {
    const hr = e.target.closest && e.target.closest('hr.ql-divider, hr');
    if (!hr) return;
    e.preventDefault();
    const idx = quill.getIndex(quill.scroll.find(hr));
    deleteDividerAt(quill, idx);
  };

  // --- Drag-to-move the divider -----------------------------------------
  // Press on the line and drag it to a new position. A floating "ghost" line
  // follows the cursor; the real divider is only removed once an actual drag
  // starts (past a small threshold) and re-inserted on mouseup at the drop
  // position computed from the cursor's Y coordinate.
  const DRAG_THRESHOLD = 4;
  let drag = null;

  function findDropIndexFromY(clientY) {
    const blocks = [...quill.scroll.domNode.children];
    if (blocks.length === 0) return 0;
    let best = null;
    let bestDist = Infinity;
    for (const block of blocks) {
      const r = block.getBoundingClientRect();
      if (r.height === 0) continue;
      const mid = r.top + r.height / 2;
      const dist = Math.abs(clientY - mid);
      if (dist < bestDist) { bestDist = dist; best = block; }
    }
    if (!best) return quill.getLength() - 1;
    const blot = quill.scroll.find(best);
    let idx = blot ? quill.getIndex(blot) : 0;
    // Drop below the block when the cursor is in its lower half.
    const r = best.getBoundingClientRect();
    if (clientY > r.top + r.height / 2) idx += Math.max(1, blot.length());
    return idx;
  }

  function moveGhost(y) {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.top = y + 'px';
  }

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const hr = e.target.closest && e.target.closest('hr.ql-divider, hr');
    if (!hr) return;
    // Let the delete button handle its own mousedown.
    if (e.target.closest('.ql-divider-delete')) return;
    e.preventDefault();
    e.stopPropagation();

    drag = {
      hr,
      startIndex: quill.getIndex(quill.scroll.find(hr)),
      startX: e.clientX,
      startY: e.clientY,
      ghost: null,
      moved: false,
    };

    const onMove = (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      if (!drag.moved) {
        // Begin the real drag: remove the divider and show a ghost line.
        drag.moved = true;
        editorEl.classList.add('divider-dragging');
        document.body.style.cursor = 'pointer';
        quill.deleteText(drag.startIndex, 1, Quill.sources.USER);
        const g = document.createElement('div');
        g.className = 'ql-divider-ghost';
        document.body.appendChild(g);
        drag.ghost = g;
      }

      ev.preventDefault();
      const er = editorEl.getBoundingClientRect();
      const inset = 20;
      drag.ghost.style.left = (er.left + inset) + 'px';
      drag.ghost.style.width = Math.max(0, er.width - inset * 2) + 'px';
      moveGhost(ev.clientY);
    };

    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!drag) return;
      editorEl.classList.remove('divider-dragging');
      document.body.style.cursor = '';
      if (drag.ghost) drag.ghost.remove();

      if (drag.moved) {
        const dropIdx = findDropIndexFromY(ev.clientY);
        quill.insertEmbed(dropIdx, 'divider', true, Quill.sources.USER);
        quill.setSelection(dropIdx + 1, 0, Quill.sources.SILENT);
      }
      drag = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  editorEl.addEventListener('dblclick', onDblClick);
  editorEl.addEventListener('mousedown', onMouseDown);

  return () => {
    editorEl.removeEventListener('dblclick', onDblClick);
    editorEl.removeEventListener('mousedown', onMouseDown);
  };
}

// The topic that saves should be written to: the one whose content is
// actually in the editor, falling back to the active topic on first load.
// Returns null when the target no longer exists (deleted locally or by a
// sync pull) — writing then would resurrect a deleted note.
function notesSaveTarget() {
  const topic = notesEditorTopic || notesActiveTopic;
  if (!topic) return null;
  if (!getNotesData().hasOwnProperty(topic) && !getNotesTopics().includes(topic)) return null;
  return topic;
}

// Старт без відкритої нотатки не має губити текст, якщо користувач одразу
// почав друкувати в порожньому редакторі — створюємо нотатку на першому вводі.
function ensureNoteForEditor() {
  if (notesSaveTarget()) return;
  const quill = getQuillEditor();
  if (!quill) return;
  const html = quill.root.innerHTML;
  if (isNotesContentEmpty(html)) return;

  const id = generateNoteId();
  // Ціль збереження призначаємо до записів у localStorage: вони можуть
  // викликати повторний рендер, який інакше очистив би введений текст.
  notesActiveTopic = id;
  notesEditorTopic = id;
  localStorage.setItem(NOTES_ACTIVE_KEY, id);

  // Спочатку реєструємо тему: getNotesTopics() сам додає ключі з notes_data,
  // тож якщо зберегти дані раніше, тема потрапить до списку двічі.
  const topics = getNotesTopics();
  if (!topics.includes(id)) {
    topics.push(id);
    saveNotesTopics(topics);
  }

  const data = getNotesData();
  data[id] = html;
  saveNotesData(data);

  const nameMap = getNotesNameMap();
  nameMap[id] = getNewTopicName();
  saveNotesNameMap(nameMap);

  const tg = getTopicGroups();
  tg[id] = getMainGroupName();
  saveTopicGroups(tg);

  const ts = getNotesTimestamps();
  ts[id] = Date.now();
  saveNotesTimestamps(ts);

  const container = document.getElementById('output-notes');
  if (container) renderNotesSidebar(container);
}

function saveCurrentNote(html) {
  const topic = notesSaveTarget();
  if (!topic) return;
  const data = getNotesData();
  data[topic] = html;
  saveNotesData(data);
  const ts = getNotesTimestamps();
  ts[topic] = Date.now();
  saveNotesTimestamps(ts);
}

function saveCurrentNoteSilent() {
  if (!notesQuill) return;
  const topic = notesSaveTarget();
  if (!topic) return;
  const html = notesQuill.root.innerHTML;
  const data = getNotesData();
  const oldContent = data[topic] || '';
  const newContent = html;
  if (oldContent === newContent) return;
  data[topic] = newContent;
  saveNotesData(data);
  const ts = getNotesTimestamps();
  ts[topic] = Date.now();
  saveNotesTimestamps(ts);
}

// Immediately persists the editor content if a debounced save is still
// pending. While the user types continuously the 500ms debounce keeps
// resetting and NOTHING is saved — so any code that is about to replace the
// editor content or read notes from storage (re-render, sync pull/push, page
// unload) must call this first or risk losing everything typed so far.
// When no save is pending the editor matches storage and this is a no-op,
// which also means it never clobbers content a sync pull just merged in.
function flushPendingNoteSave() {
  if (!notesSaveTimer) return;
  clearTimeout(notesSaveTimer);
  notesSaveTimer = null;
  saveCurrentNoteSilent();
}

function deleteTopic(topic, container) {
  const topics = getNotesTopics().filter(t => t !== topic);
  saveNotesTopics(topics);
  const data = getNotesData();
  delete data[topic];
  saveNotesData(data);
  const ts = getNotesTimestamps();
  delete ts[topic];
  saveNotesTimestamps(ts);
  const tg = getTopicGroups();
  delete tg[topic];
  saveTopicGroups(tg);
  if (notesActiveTopic === topic) {
    notesActiveTopic = topics[0];
    localStorage.setItem(NOTES_ACTIVE_KEY, notesActiveTopic);
  }
  gistAddDeletedId('notes', topic);
  renderNotesUI(container);
}

function renderNotesActions() {
  const existing = document.getElementById('notesActions');
  if (existing) existing.remove();

  const actions = document.createElement('div');
  actions.id = 'notesActions';
  actions.className = 'notes-actions';
  actions.innerHTML = `
    <button class="notes-settings-btn" onclick="openNotesSettingsModal()" title="Налаштування">
      ${ICON('bolt', 22)}
    </button>
  `;
  const host = document.getElementById('content-notes') || document.body;
  host.appendChild(actions);
}

function openNotesSettingsModal() {
  const settings = getNotesSettings();

  const overlay = document.createElement('div');
  overlay.className = 'notes-modal';
  overlay.innerHTML = `
    <div class="notes-modal-content" style="max-width: 420px;">
      <div class="notes-modal-header">
        <h3>Налаштування</h3>
        <button class="notes-modal-close" id="notes-settings-close">&times;</button>
      </div>
      <div class="notes-modal-body">
        <label class="notes-settings-row">
          <span class="notes-settings-text">
            Лічильник нотаток
            <span class="notes-settings-sub">Показувати кількість нотаток біля заголовків груп</span>
          </span>
          <span class="notes-switch">
            <input type="checkbox" id="notes-setting-group-count"${settings.showGroupCount ? ' checked' : ''}>
            <span class="notes-switch-slider"></span>
          </span>
        </label>
      </div>
      <div class="notes-modal-footer">
        <button class="gist-btn gist-btn-primary" id="notes-settings-done">Готово</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.querySelector('#notes-setting-group-count').addEventListener('change', e => {
    const s = getNotesSettings();
    s.showGroupCount = e.target.checked;
    saveNotesSettings(s);
    const output = document.getElementById('output-notes');
    if (output) renderNotesUI(output);
  });

  overlay.querySelector('#notes-settings-close').addEventListener('click', close);
  overlay.querySelector('#notes-settings-done').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
