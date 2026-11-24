/* ========== HABIT INTERACTION FUNCTIONS ========== */

// These functions expect the following globals from the main file:
// - habits (array of habit objects)
// - saveHabits() (function)
// - renderHabits() (function)
// - playSuccessSound() (function from ui-tools.js)
// - playUncheckSound() (function from ui-tools.js)
// - playSkipSound() (function from ui-tools.js)
// - createConfetti() (function from ui-tools.js)
// - createSkipParticles() (function from ui-tools.js)
// - restoreHover() (function from ui-tools.js)
// - getLocalDateStr() (function from date-utils.js)

// ========== MOTIVATIONAL MESSAGES SYSTEM ==========

const motivationalMessages = {
  completion: [
    "Супер!",
    "Ти на шляху до успіху!",
    "Так тримати!",
    "Чудово!",
    "Продовжуй у тому ж дусі!",
    "Гарна робота!",
    "Ти молодець!",
    "Вражаюче!",
    "Неймовірно!",
    "Це перемога!",
    "Ти сильний!",
    "Не зупиняйся!",
    "Круто!",
    "Браво!",
    "Ідеально!",
  ],
  milestone: {
    firstWeek: "Перша неділя!",
    weekNoMisses: "Тиждень без пропусків!",
    monthStability: "Місяць стабільності!",
    twoWeeks: "Два тижні поспіль!",
    threeWeeks: "Три тижні сили!",
    quarter: "Чверть року!",
    halfYear: "Півроку дисципліни!",
    year: "Рік досягнень!",
    streak3: "3 дні поспіль!",
    streak7: "7 днів!",
    streak14: "14 днів!",
    streak30: "30 днів!",
    streak50: "50 днів!",
    streak100: "100 днів!",
  },
  encouragement: [
    "Не здавайся!",
    "Ти зможеш!",
    "Наступного разу буде краще!",
    "Вір у себе!",
    "Маленькі кроки до великої мети!",
    "Кожен день — нова можливість!",
  ],
};

function showToast(message, type = "success", duration = 2000, event = null) {
  // Сповіщення вимкнено на прохання користувача.
  return;
}

function createSparkles(x, y) {
  const colors = ["#ffd700", "#ffec80", "#fff4b3", "#ffe066", "#ffb700", "#fff", "#f5576c", "#f093fb"];
  const count = 24;

  for (let i = 0; i < count; i++) {
    const spark = document.createElement("div");
    const size = 3 + Math.random() * 6;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const isCircle = Math.random() > 0.4;
    spark.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      z-index: 9998;
      border-radius: ${isCircle ? '50%' : '2px'};
      box-shadow: 0 0 ${size * 3}px ${color};
    `;
    document.body.appendChild(spark);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const velocity = 100 + Math.random() * 180;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    let opacity = 1;
    let offsetX = 0;
    let offsetY = 0;
    let rotation = Math.random() * 360;
    let scale = 1;

    const animate = () => {
      offsetX += vx * 0.035;
      offsetY += vy * 0.035 + 1;
      opacity -= 0.018;
      rotation += 8;
      scale = Math.max(0, scale - 0.008);
      spark.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg) scale(${scale})`;
      spark.style.opacity = opacity;
      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        spark.remove();
      }
    };
    requestAnimationFrame(animate);
  }
}

function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function getMilestoneMessage(habit) {
  const streak =
    typeof getStreak === "function"
      ? getStreak(habit.dates, habit.skippedDates, habit.type, habit.halfDates)
      : 0;

  if (streak >= 365) return motivationalMessages.milestone.year;
  if (streak >= 180) return motivationalMessages.milestone.halfYear;
  if (streak >= 90) return motivationalMessages.milestone.quarter;
  if (streak >= 30) return motivationalMessages.milestone.streak30;
  if (streak >= 14) return motivationalMessages.milestone.twoWeeks;
  if (streak >= 7) return motivationalMessages.milestone.weekNoMisses;
  if (streak >= 3) return motivationalMessages.milestone.streak3;

  return null;
}

function showMessageAfterCheck(habit, event, prevLongest) {
  const streak =
    typeof getStreak === "function"
      ? getStreak(habit.dates, habit.skippedDates, habit.type, habit.halfDates)
      : 0;

  const isNewRecord = streak > 1 && streak > prevLongest;

  if (isNewRecord) {
    showToast("Новий рекорд! 🔥", "milestone", 3500, event);
    return;
  }

  const milestone = getMilestoneMessage(habit);
  const msg = milestone || getRandomMessage(motivationalMessages.completion);
  showToast(msg, milestone ? "milestone" : "success", milestone ? 3000 : 1800, event);
  if (milestone && event) {
    createConfetti(event.clientX, event.clientY);
  }
}

function toggleDate(habitId, dateStr, event = null) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  // Зберігаємо поточну позицію миші для відновлення hover
  const mouseX = event ? event.clientX : 0;
  const mouseY = event ? event.clientY : 0;

  const habitType = habit.type || "good";
  const idx = habit.dates.indexOf(dateStr);

  if (idx > -1) {
    habit.dates.splice(idx, 1);
    playUncheckSound();
    // Прибираємо half, щоб не лишалося одночасно
    if (habit.halfDates) {
      const halfIdx = habit.halfDates.indexOf(dateStr);
      if (halfIdx > -1) habit.halfDates.splice(halfIdx, 1);
    }
    if (habitType === "bad") {
      showToast("Все гаразд, спробуй знову!", "encouragement", 1800);
    }
  } else {
    // Зберігаємо найдовшу серію ДО додавання нової дати
    const prevLongest =
      typeof getLongestStreak === "function"
        ? getLongestStreak(habit.dates, habit.halfDates)
        : 0;

    habit.dates.push(dateStr);
    if (habit.skippedDates) {
      const skippedIdx = habit.skippedDates.indexOf(dateStr);
      if (skippedIdx > -1) {
        habit.skippedDates.splice(skippedIdx, 1);
      }
    }
    // При позначенні як "впав у звичку" — прибираємо з cleanDates
    if (habit.cleanDates) {
      const cleanIdx = habit.cleanDates.indexOf(dateStr);
      if (cleanIdx > -1) {
        habit.cleanDates.splice(cleanIdx, 1);
      }
    }
    // Повна дата не може бути одночасно з напів — прибираємо half
    if (habit.halfDates) {
      const halfIdx = habit.halfDates.indexOf(dateStr);
      if (halfIdx > -1) habit.halfDates.splice(halfIdx, 1);
    }

    // Для шкідливих звичок використовуємо інші звуки та ефекти
    if (habitType === "bad") {
      playSkipSound(); // Використовуємо звук пропуску для шкідливих звичок
      if (event) {
        createSkipParticles(event.clientX, event.clientY); // Використовуємо червоні частинки
      }
      showToast("Тримайся! Ти сильніший за звичку!", "encouragement", 2500);
    } else {
      playSuccessSound();
      if (event) {
        createConfetti(event.clientX, event.clientY);
      }
showMessageAfterCheck(habit, event, prevLongest);
}
  }
  // Позначаємо мітку часу зміни ЦІЄЇ дати — потрібно для last-write-wins
  // злиття при синхронізації (cross-tab і gist), щоб застаріла копія не
  // "воскресила" щойно змінений стан клітинки.
  if (typeof gistTouchDateMeta === "function") gistTouchDateMeta(habit, dateStr);
  // Зберігаємо негайно і переконуємося, що запис завершився
  saveHabits();
  if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache(habitId);
  // Легке оновлення чекбоксу замість повного ререндеру
  const today = getLocalDateStr();
  const isDone = habit.dates.includes(dateStr);
  const isSkipped = habit.skippedDates?.includes(dateStr) || false;
  const isHalf = habit.halfDates?.includes(dateStr) || false;
  const isClean = habitType === "bad" && habit.cleanDates?.includes(dateStr) && !isDone && !isSkipped;
  if (typeof updateHabitCheckbox === "function") {
    updateHabitCheckbox(habitId, dateStr, isDone, isSkipped, isHalf, isClean, habitType, habit.category?.color || "");
  } else {
    scheduleRenderHabits();
  }
  // Відновлюємо hover на клітинці після перерендерингу
  restoreHover(mouseX, mouseY, habitId, dateStr);

  // Додаємо анімацію pulse/shake до новозмальованої клітинки
  if (event && (typeof idx === "undefined" ? (halfIdx === -1 && fullIdx === -1) : idx === -1)) {
    const animationClass = habitType === "bad" ? "shake" : "pulse";
    animateCell(habitId, dateStr, animationClass, 300);
  }
}

function toggleSkippedDate(habitId, dateStr, event) {
  event.preventDefault();
  event.stopPropagation();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  // Зберігаємо поточну позицію миші для відновлення hover
  const mouseX = event ? event.clientX : 0;
  const mouseY = event ? event.clientY : 0;

  if (!habit.skippedDates) {
    habit.skippedDates = [];
  }

  const idx = habit.skippedDates.indexOf(dateStr);
  if (idx > -1) {
    habit.skippedDates.splice(idx, 1);
    playUncheckSound();
  } else {
    habit.skippedDates.push(dateStr);
    const doneIdx = habit.dates.indexOf(dateStr);
    if (doneIdx > -1) {
      habit.dates.splice(doneIdx, 1);
    }
    // Скіппед не може бути одночасно з напів — прибираємо half
    if (habit.halfDates) {
      const halfIdx = habit.halfDates.indexOf(dateStr);
      if (halfIdx > -1) habit.halfDates.splice(halfIdx, 1);
    }
playSkipSound();
  if (event) {
    createSkipParticles(event.clientX, event.clientY);
  }
  }
  if (typeof gistTouchDateMeta === "function") gistTouchDateMeta(habit, dateStr);
  // Зберігаємо негайно і переконуємося, що запис завершився
  saveHabits();
  if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache(habitId);
  // Легке оновлення чекбоксу замість повного ререндеру
  const habitType = habit.type || "good";
  const isDone = habit.dates.includes(dateStr);
  const isSkipped = habit.skippedDates?.includes(dateStr) || false;
  const isHalf = habit.halfDates?.includes(dateStr) || false;
  const isClean = habitType === "bad" && habit.cleanDates?.includes(dateStr) && !isDone && !isSkipped;
  if (typeof updateHabitCheckbox === "function") {
    updateHabitCheckbox(habitId, dateStr, isDone, isSkipped, isHalf, isClean, habitType, habit.category?.color || "");
  } else {
    scheduleRenderHabits();
  }
  // Відновлюємо hover на клітинці після перерендерингу
  restoreHover(mouseX, mouseY, habitId, dateStr);

  // Додаємо анімацію shake до новозмальованої клітинки
  if (event && (typeof idx === "undefined" ? (halfIdx === -1 && fullIdx === -1) : idx === -1)) {
    animateCell(habitId, dateStr, "shake", 400);
  }
}

function toggleCleanDate(habitId, dateStr, event) {
  event.preventDefault();
  event.stopPropagation();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  // Зберігаємо поточну позицію миші для відновлення hover
  const mouseX = event ? event.clientX : 0;
  const mouseY = event ? event.clientY : 0;

  // Переконуємося, що cleanDates існує
  if (!habit.cleanDates) {
    habit.cleanDates = [];
  }

const idx = habit.cleanDates.indexOf(dateStr);
  if (idx > -1) {
    habit.cleanDates.splice(idx, 1);
    playUncheckSound();
  } else {
    habit.cleanDates.push(dateStr);
    // Видаляємо з активних дат (впав у звичку), якщо є
    const activeIdx = habit.dates.indexOf(dateStr);
    if (activeIdx > -1) {
      habit.dates.splice(activeIdx, 1);
    }
    // Видаляємо з пропущених дат, якщо є
    if (habit.skippedDates) {
      const skippedIdx = habit.skippedDates.indexOf(dateStr);
      if (skippedIdx > -1) {
        habit.skippedDates.splice(skippedIdx, 1);
      }
    }
    // Clean не може бути одночасно з напів — прибираємо half
    if (habit.halfDates) {
      const halfIdx = habit.halfDates.indexOf(dateStr);
      if (halfIdx > -1) habit.halfDates.splice(halfIdx, 1);
    }
    playSuccessSound();
    if (event) {
      createConfetti(event.clientX, event.clientY);
    }
  }
  if (typeof gistTouchDateMeta === "function") gistTouchDateMeta(habit, dateStr);
  saveHabits();
  if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache(habitId);
  // Легке оновлення чекбоксу замість повного ререндеру
  const habitType = habit.type || "good";
  const isDone = habit.dates.includes(dateStr);
  const isSkipped = habit.skippedDates?.includes(dateStr) || false;
  const isHalf = habit.halfDates?.includes(dateStr) || false;
  const isClean = habitType === "bad" && habit.cleanDates?.includes(dateStr) && !isDone && !isSkipped;
  if (typeof updateHabitCheckbox === "function") {
    updateHabitCheckbox(habitId, dateStr, isDone, isSkipped, isHalf, isClean, habitType, habit.category?.color || "");
  } else {
    scheduleRenderHabits();
  }
  // Відновлюємо hover на клітинці після перерендерингу
  restoreHover(mouseX, mouseY, habitId, dateStr);

  // Додаємо анімацію pulse до новозмальованої клітинки
  if (event && (typeof idx === "undefined" ? (halfIdx === -1 && fullIdx === -1) : idx === -1)) {
    animateCell(habitId, dateStr, "pulse", 300);
  }
}

function toggleHalfDate(habitId, dateStr, event) {
  event.preventDefault();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  // Зберігаємо поточну позицію миші для відновлення hover
  const mouseX = event ? event.clientX : 0;
  const mouseY = event ? event.clientY : 0;

  // Цикл середньої клавіші: порожня → напів → повна → напів → ...
  // (із повної середня клавіша робить напів, а не знімає повністю)
  const halfIdx = habit.halfDates.indexOf(dateStr);
  const fullIdx = habit.dates.indexOf(dateStr);

  if (halfIdx > -1) {
    // Була напів → робимо повною
    habit.halfDates.splice(halfIdx, 1);
    habit.dates.push(dateStr);
    // Видаляємо з пропущених, якщо є
    if (habit.skippedDates) {
      const skippedIdx = habit.skippedDates.indexOf(dateStr);
      if (skippedIdx > -1) habit.skippedDates.splice(skippedIdx, 1);
    }
    playSuccessSound();
    if (event) createConfetti(event.clientX, event.clientY);
  } else if (fullIdx > -1) {
    // Була повна → робимо напів (замість зняття)
    habit.dates.splice(fullIdx, 1);
    habit.halfDates.push(dateStr);
    if (habit.skippedDates) {
      const skippedIdx = habit.skippedDates.indexOf(dateStr);
      if (skippedIdx > -1) habit.skippedDates.splice(skippedIdx, 1);
    }
    playSuccessSound();
    if (event) createConfetti(event.clientX, event.clientY);
  } else {
    // Була порожня → робимо напів
    habit.halfDates.push(dateStr);
    if (habit.skippedDates) {
      const skippedIdx = habit.skippedDates.indexOf(dateStr);
      if (skippedIdx > -1) habit.skippedDates.splice(skippedIdx, 1);
    }
    playSuccessSound();
    if (event) createConfetti(event.clientX, event.clientY);
  }
  if (typeof gistTouchDateMeta === "function") gistTouchDateMeta(habit, dateStr);
  saveHabits();
  if (typeof window.invalidateHeatmapCache === "function") window.invalidateHeatmapCache(habitId);
  // Легке оновлення чекбоксу замість повного ререндеру
  const habitType = habit.type || "good";
  const isDone = habit.dates.includes(dateStr);
  const isSkipped = habit.skippedDates?.includes(dateStr) || false;
  const isHalf = habit.halfDates?.includes(dateStr) || false;
  const isClean = habitType === "bad" && habit.cleanDates?.includes(dateStr) && !isDone && !isSkipped;
  if (typeof updateHabitCheckbox === "function") {
    updateHabitCheckbox(habitId, dateStr, isDone, isSkipped, isHalf, isClean, habitType, habit.category?.color || "");
  } else {
    scheduleRenderHabits();
  }
  // Відновлюємо hover на клітинці після перерендерингу
  restoreHover(mouseX, mouseY, habitId, dateStr);

  // Додаємо анімацію pulse до новозмальованої клітинки
  if (event && (typeof idx === "undefined" ? (halfIdx === -1 && fullIdx === -1) : idx === -1)) {
    animateCell(habitId, dateStr, "pulse", 300);
  }
}


// ========== CONTEXT MENU ==========

let activeContextMenu = null;

function showHabitContextMenu(event, habitId) {
  event.preventDefault();
  event.stopPropagation();

  // Не показуємо меню якщо клік на клітинці heatmap або на великому чекбоксі дня
  if (event.target.classList.contains("cell")) return;
  if (event.target.closest(".habit-checkbox")) return;

  hideHabitContextMenu();

  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  const menu = document.createElement("div");
  menu.className = "habit-context-menu";
  menu.innerHTML = `
    <div class="ctx-item" onclick="ctxEdit(${habitId})">
      ${ICON('pen', 14)}
      <span>Редагувати</span>
    </div>
    <div class="ctx-item" onclick="ctxDuplicate(${habitId})">
      ${ICON('copy', 14)}
      <span>Дублювати</span>
    </div>
    <div class="ctx-item" onclick="ctxStats(${habitId})">
      ${ICON('barChart', 14)}
      <span>Статистика</span>
    </div>
    <div class="ctx-separator"></div>
    <div class="ctx-item ctx-item--danger" onclick="openSoftDeleteModal(${habitId})">
      ${ICON('trash', 14)}
      <span>Видалити</span>
    </div>
  `;

  document.body.appendChild(menu);
  activeContextMenu = menu;

  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = x + "px";
  menu.style.top = y + "px";

  requestAnimationFrame(() => menu.classList.add("visible"));

  setTimeout(() => {
    document.addEventListener("click", hideHabitContextMenu, { once: true });
    document.addEventListener("contextmenu", hideHabitContextMenu, { once: true });
  }, 0);
}

function hideHabitContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

function ctxEdit(habitId) {
  hideHabitContextMenu();
  openEditModal(habitId);
}

function ctxDuplicate(habitId) {
  hideHabitContextMenu();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  const newHabit = {
    ...JSON.parse(JSON.stringify(habit)),
    id: Date.now(),
    name: habit.name + " (копія)",
    dates: [],
    halfDates: [],
    skippedDates: [],
    cleanDates: [],
  };
  habits.push(newHabit);
  saveHabits();
  scheduleRenderHabits();
}

function ctxStats(habitId) {
  hideHabitContextMenu();
  openStatsModal();
}

// ========== NOTES ==========

function toggleNote(habitId, dateStr, event) {
  openNoteModal(habitId, dateStr);
}

function openNoteModal(habitId, dateStr) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  if (!habit.notes) habit.notes = {};

  const currentNote = habit.notes[dateStr] || "";
  const displayDate = formatNoteDate(dateStr);

  const overlay = document.createElement("div");
  overlay.className = "habits-note-modal";
  overlay.innerHTML = `
    <div class="notes-modal-content">
      <div class="notes-modal-header">
        <h3>Нотатка · ${displayDate}</h3>
        <button class="notes-modal-close" id="note-modal-close">&times;</button>
      </div>
      <div class="notes-modal-body">
        <textarea id="note-modal-text" class="note-modal-text" placeholder="Ваша нотатка для цього дня..." rows="4">${escapeHtml(currentNote)}</textarea>
      </div>
      <div class="notes-modal-footer">
        <button class="gist-btn tasks-repeat-delete" id="note-modal-delete" title="Видалити нотатку">ICON('trash2', 16)</button>
        <button class="gist-btn" id="note-modal-cancel">Скасувати</button>
        <button class="gist-btn gist-btn-primary" id="note-modal-save">Зберегти</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const textarea = overlay.querySelector("#note-modal-text");
  const deleteBtn = overlay.querySelector("#note-modal-delete");
  textarea.focus();
  if (currentNote) textarea.select();

  function close() { overlay.remove(); }

  function save() {
    const value = textarea.value.trim();
    if (value === "") {
      delete habit.notes[dateStr];
    } else {
      habit.notes[dateStr] = value;
    }
    if (typeof gistTouchDateMeta === "function") gistTouchDateMeta(habit, dateStr);
    saveHabits();
    scheduleRenderHabits();
    close();
  }

  overlay.querySelector("#note-modal-save").addEventListener("click", save);
  deleteBtn.addEventListener("click", () => {
    delete habit.notes[dateStr];
    if (typeof gistTouchDateMeta === "function") gistTouchDateMeta(habit, dateStr);
    saveHabits();
    scheduleRenderHabits();
    close();
  });
  overlay.querySelector("#note-modal-cancel").addEventListener("click", close);
  overlay.querySelector("#note-modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); close(); }
  });
}

function formatNoteDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-");
    const months = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}
