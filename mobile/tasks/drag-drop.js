function setupDragDrop(container, cfg) {
  const { QUADRANTS_DEFAULTS, getTasksData, saveTasksData, renderTasksUI } = cfg;

  container.querySelectorAll('.tasks-task').forEach(el => { el.draggable = false; });

  const FILTER = '.task-checkbox-label, .tasks-task-repeat, .tasks-task-subtasks';

  let draggedItem = null;
  let draggedIndex = -1;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  const DRAG_THRESHOLD = 3;

  let lastTasksEl = null;
  let cachedTaskEls = [];
  let cachedTaskRects = [];
  let cacheDirty = true;

  function refreshCache(tasksEl) {
    if (tasksEl !== lastTasksEl) { lastTasksEl = tasksEl; cacheDirty = true; }
    if (!cacheDirty) return;
    cachedTaskEls = [...tasksEl.querySelectorAll(':scope > .tasks-task')].filter(el => el !== draggedItem);
    cachedTaskRects = cachedTaskEls.map(el => el.getBoundingClientRect());
    cacheDirty = false;
  }

  function findTarget(y, tasksEl) {
    refreshCache(tasksEl);
    for (let i = 0; i < cachedTaskEls.length; i++) {
      if (y < cachedTaskRects[i].top + cachedTaskRects[i].height * 0.4) return cachedTaskEls[i];
    }
    return null;
  }

  function onMouseMove(e) {
    if (!dragging) {
      if (Math.max(Math.abs(e.clientX - startX), Math.abs(e.clientY - startY)) < DRAG_THRESHOLD) return;
      dragging = true;
      document.body.classList.add('tasks-dragging');
      draggedItem.classList.add('dragging');
      draggedItem.style.pointerEvents = 'none';
    }

    e.preventDefault();

    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    const tasksEl = elUnder && elUnder.closest('.tasks-quadrant-tasks');
    if (!tasksEl) return;

    if (draggedItem.parentElement !== tasksEl) {
      tasksEl.appendChild(draggedItem);
      cacheDirty = true;
    }

    const target = findTarget(e.clientY, tasksEl);
    if (target) {
      if (draggedItem.nextElementSibling !== target) {
        tasksEl.insertBefore(draggedItem, target);
        cacheDirty = true;
      }
    } else {
      const doneToggle = tasksEl.querySelector(':scope > .tasks-done-toggle');
      if (doneToggle) {
        if (draggedItem.nextElementSibling !== doneToggle) {
          tasksEl.insertBefore(draggedItem, doneToggle);
          cacheDirty = true;
        }
      } else if (draggedItem.nextElementSibling !== null) {
        tasksEl.appendChild(draggedItem);
        cacheDirty = true;
      }
    }
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (!dragging || !draggedItem) {
      draggedItem = null;
      return;
    }

    draggedItem.style.pointerEvents = '';
    draggedItem.classList.remove('dragging');
    document.body.classList.remove('tasks-dragging');

    const tasks = getTasksData();
    const movedTask = tasks[draggedIndex];

    if (movedTask) {
      const targetQuad = draggedItem.closest('.tasks-quadrant');
      if (targetQuad) {
        const key = targetQuad.dataset.key;
        const q = QUADRANTS_DEFAULTS.find(x => x.key === key);
        if (q) {
          movedTask.urgent = q.urgent;
          movedTask.important = q.important;
        }
      }

      const newOrderIds = [];
      container.querySelectorAll('.tasks-quadrant').forEach(quad => {
        quad
          .querySelectorAll(':scope > .tasks-quadrant-tasks > .tasks-task, :scope > .tasks-quadrant-tasks > .tasks-done-list > .tasks-task')
          .forEach(taskEl => {
            newOrderIds.push(parseInt(taskEl.dataset.index));
          });
      });

      const seen = new Set();
      const reordered = [];
      newOrderIds.forEach(idx => {
        if (tasks[idx] && !seen.has(idx)) {
          reordered.push(tasks[idx]);
          seen.add(idx);
        }
      });
      tasks.forEach((t, i) => {
        if (!seen.has(i)) reordered.push(t);
      });

      saveTasksData(reordered);
    }

    const scrollStates = [];
    container.querySelectorAll('.tasks-quadrant-tasks').forEach(el => {
      scrollStates.push({ key: el.closest('.tasks-quadrant')?.dataset.key, top: el.scrollTop });
    });

    renderTasksUI(container);

    scrollStates.forEach(s => {
      const el = container.querySelector(`.tasks-quadrant[data-key="${s.key}"] > .tasks-quadrant-tasks`);
      if (el) el.scrollTop = s.top;
    });
    draggedItem = null;
    draggedIndex = -1;
  }

  container.querySelectorAll('.tasks-task').forEach(item => {
    item.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest(FILTER)) return;

      draggedItem = item;
      draggedIndex = parseInt(item.dataset.index);
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;
      cacheDirty = true;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}
