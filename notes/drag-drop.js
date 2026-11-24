/* ---------- NOTES DRAG & DROP (SortableJS) ---------- */

// Перетягування груп і тем реалізовано через готову бібліотеку SortableJS.
// Групи сортуються у #notes-sidebar-list, теми — у кожному .notes-group-topics.
// Обидва списки належать до одного group, тому тему можна перенести з однієї
// групи в іншу. SortableJS сам оновлює DOM під час перетягування; після
// завершення (onEnd) ми лише зчитуємо фінальний порядок і зберігаємо його.
//
// forceFallback: true — вимикає нативний drag браузера (і його знімок біля
// курсора), SortableJS малює свій власний "привид" через ghostClass.

function setupNotesDragDrop(container) {
  const sidebarList = container.querySelector('#notes-sidebar-list');
  if (!sidebarList) return;
  if (typeof Sortable === 'undefined') {
    console.warn('SortableJS не завантажено — drag-and-drop нотаток вимкнено.');
    return;
  }

  // Знищуємо попередні інстанси, щоб повторні виклики (після кожного рендеру)
  // не дублювали обробники.
  if (container._notesSortables) {
    container._notesSortables.forEach(s => s.destroy());
  }
  container._notesSortables = [];

  // Селектор елементів, які не можна перетягувати (поля редагування назв).
  const EDIT_FILTER = '.notes-topic-input, .notes-group-add-input, .notes-group-name-input';

  function persistOrder() {
    // Порядок груп (верхнього рівня).
    const groupOrder = [...sidebarList.querySelectorAll(':scope > .notes-group')]
      .map(el => el.dataset.group);
    saveNotesGroups(groupOrder);

    // Порядок тем + мапа тема -> група.
    const topicGroups = getTopicGroups();
    const allTopics = [];
    sidebarList.querySelectorAll(':scope > .notes-group').forEach(groupEl => {
      const groupName = groupEl.dataset.group;
      groupEl.querySelectorAll(':scope > .notes-group-topics > .notes-topic-item')
        .forEach(topicEl => {
          const topic = topicEl.dataset.topic;
          allTopics.push(topic);
          topicGroups[topic] = groupName;
        });
    });
    saveTopicGroups(topicGroups);
    saveNotesTopics(allTopics);

    // Оновлюємо лише лічильники тем у заголовках груп (без перебудови DOM,
    // щоб не знищувати активні Sortable-інстанси).
    const showCount = getNotesSettings().showGroupCount;
    sidebarList.querySelectorAll(':scope > .notes-group').forEach(groupEl => {
      const count = groupEl.querySelectorAll(':scope > .notes-group-topics > .notes-topic-item').length;
      const countEl = groupEl.querySelector(':scope > .notes-group-header > .notes-group-count');
      if (showCount) {
        if (countEl) countEl.textContent = count;
        else {
          const header = groupEl.querySelector(':scope > .notes-group-header');
          if (header) {
            const span = document.createElement('span');
            span.className = 'notes-group-count';
            span.textContent = count;
            header.appendChild(span);
          }
        }
      } else if (countEl) {
        countEl.remove();
      }
    });
  }

  // Під час перетягування додаємо клас на <body>, щоб примусово тримати
  // курсор pointer і вимикати hover-ефекти на інших елементах.
  function onDragStart() { document.body.classList.add('notes-dragging'); }
  function onDragEnd() {
    document.body.classList.remove('notes-dragging');
    persistOrder();
  }

  const baseOptions = {
    filter: EDIT_FILTER,
    preventOnFilter: false,
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    swapThreshold: 0.5,
    invertSwap: false,
    onStart: onDragStart,
    onEnd: onDragEnd,
  };

  // Sortable для груп (верхній рівень). Власний group-назва 'notes-group-only'
  // забороняє вкладати папку в папку (групу можна кидати лише серед груп).
  const groupSortable = Sortable.create(sidebarList, Object.assign({}, baseOptions, {
    group: 'notes-group-only',
    draggable: '.notes-group',
    handle: '.notes-group-header',
    ghostClass: 'notes-group-ghost',
    chosenClass: 'notes-group-chosen',
    dragClass: 'notes-group-drag',
  }));
  container._notesSortables.push(groupSortable);

  // Вкладені Sortable для тем кожної групи. Спільний group-назва
  // 'notes-topic-only' дозволяє переносити теми між різними групами, але
  // забороняє кидати їх у список груп і (разом із 'notes-group-only') не
  // дозволяє перетворювати папку на "підпапку".
  sidebarList.querySelectorAll(':scope > .notes-group > .notes-group-topics').forEach(topicsEl => {
    const topicSortable = Sortable.create(topicsEl, Object.assign({}, baseOptions, {
      group: 'notes-topic-only',
      draggable: '.notes-topic-item',
      ghostClass: 'notes-topic-ghost',
      chosenClass: 'notes-topic-chosen',
      dragClass: 'notes-topic-drag',
    }));
    container._notesSortables.push(topicSortable);
  });
}
