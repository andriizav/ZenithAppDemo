/* ---------- NOTES MAIN ---------- */

function initNotes() {
  const output = document.getElementById('output-notes');
  if (!output) return;

  migrateNotesToIds();

  const topics = getNotesTopics();
  const storedTopic = localStorage.getItem(NOTES_ACTIVE_KEY);
  // Відсутній або застарілий ключ = жодна нотатка не відкрита.
  notesActiveTopic = storedTopic && topics.includes(storedTopic) ? storedTopic : null;
  if (notesActiveTopic) {
    localStorage.setItem(NOTES_ACTIVE_KEY, notesActiveTopic);
  } else {
    localStorage.removeItem(NOTES_ACTIVE_KEY);
  }

  renderNotesUI(output);
  
  if (typeof addGistSettingsButton === 'function') {
    setTimeout(() => {
      addGistSettingsButton();
      if (gistStorage.isEnabled()) {
        gistStorage.startAutoSync();
      }
      if (fileStorage.isEnabled()) {
        fileStorage.startAutoSync();
      }
    }, 100);
  }

  const handleSyncStatus = (e) => {
    const { status, message } = e.detail;
    if (status === 'error') {
      notesSyncError = message;
      setTimeout(() => {
        const editorHadFocus = document.activeElement === output.querySelector('.ql-editor');
        saveCurrentNoteSilent();
        const errorHtml = getNotesWarningHtml();
        const warningEl = output.querySelector('.notes-local-warning');
        if (warningEl) {
          warningEl.outerHTML = errorHtml;
        } else {
          const editor = output.querySelector('.notes-editor');
          if (editor) editor.insertAdjacentHTML('afterbegin', errorHtml);
        }
        if (editorHadFocus) {
          const q = getQuillEditor();
          if (q) q.focus();
        }
      }, 0);
    } else if (status === 'success') {
      notesSyncError = null;
      setTimeout(() => {
        const editorHadFocus = document.activeElement === output.querySelector('.ql-editor');
        saveCurrentNoteSilent();
        const warningHtml = getNotesWarningHtml();
        const warningEl = output.querySelector('.notes-local-warning');
        if (warningEl) {
          if (warningHtml) {
            warningEl.outerHTML = warningHtml;
          } else {
            warningEl.remove();
          }
        } else if (warningHtml) {
          const editor = output.querySelector('.notes-editor');
          if (editor) editor.insertAdjacentHTML('afterbegin', warningHtml);
        }
        if (editorHadFocus) {
          const q = getQuillEditor();
          if (q) q.focus();
        }
      }, 0);
    }
  };
  window.addEventListener('gist-sync-status', handleSyncStatus);
  window.addEventListener('file-sync-status', handleSyncStatus);

  // The 500ms save debounce means a refresh/close mid-typing would lose the
  // last edits. Flush them synchronously before the page goes away.
  window.addEventListener('beforeunload', flushPendingNoteSave);
  window.addEventListener('pagehide', flushPendingNoteSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingNoteSave();
  });
}
