/* ========== SHIFT + DRAG: МАСОВЕ ВІДМІЧАННЯ КЛІТИНОК ==========

   Затиснув Shift + ліву кнопку і ведеш курсором по heatmap — усі клітинки
   під курсором отримують той самий стан, що й перша (як протягування
   в Google Таблицях).

   Напрямок задає ПЕРША клітинка: була порожня → весь прохід ставить
   «виконано»; була позначена → прохід стирає.

   Обробники вішаються один раз на document у фазі захоплення (capture),
   тому не залежать від перерендеру карток і спрацьовують раніше за
   звичайний клік/long-press.                                              */

(function () {
  "use strict";

  if (window._habitsPaintInit) return;
  window._habitsPaintInit = true;

  const state = {
    active: false,
    habitId: null,
    mode: "done",   // "done" | "skip" | "clean"
    fill: true,
    painted: null,
  };

  function getHabits() {
    return typeof habits !== "undefined" ? habits : window.habits;
  }

  function todayStr() {
    return typeof getLocalDateStr === "function"
      ? getLocalDateStr()
      : window.getLocalDateStr();
  }

  // Клітинка під точкою. Якщо курсор потрапив у проміжок між клітинками —
  // беремо найближчу в межах того самого heatmap.
  function cellAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.closest) return null;

    const direct = el.closest(".cell");
    if (direct) return direct;

    const heatmap = el.closest(".heatmap");
    if (!heatmap) return null;

    let nearest = null;
    let best = Infinity;
    heatmap.querySelectorAll(".cell").forEach((c) => {
      if (c.classList.contains("padding")) return;
      const r = c.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        nearest = c;
      }
    });
    return nearest;
  }

  // Дані клітинки, придатної для малювання.
  function cellInfo(cell) {
    if (!cell || cell.classList.contains("padding")) return null;
    const dateStr = cell.dataset.dateRaw;
    if (!dateStr) return null;
    const card = cell.closest(".habit");
    if (!card) return null;
    const habitId = parseInt(card.dataset.habitId, 10);
    if (isNaN(habitId)) return null;
    // "skip" для звичайних звичок, "clean" для шкідливих.
    const rightClick = cell.dataset.rightClick || "";
    return { cell, dateStr, habitId, rightClick };
  }

  // Наносить стан на одну дату. Повертає true, якщо щось змінилось.
  // mode: "done" — виконано, "skip" — пропущено, "clean" — чисто (шкідливі).
  function applyToDate(habit, dateStr, mode, fill) {
    if (dateStr > todayStr()) return false; // майбутнє не відмічаємо

    if (!Array.isArray(habit.dates)) habit.dates = [];
    if (!Array.isArray(habit.skippedDates)) habit.skippedDates = [];
    if (!Array.isArray(habit.halfDates)) habit.halfDates = [];
    if (!Array.isArray(habit.cleanDates)) habit.cleanDates = [];

    let changed = false;
    const drop = (arr, d) => {
      const i = arr.indexOf(d);
      if (i > -1) {
        arr.splice(i, 1);
        return true;
      }
      return false;
    };
    const add = (arr, d) => {
      if (arr.indexOf(d) === -1) {
        arr.push(d);
        return true;
      }
      return false;
    };

    if (!fill) {
      // Стирання: прибираємо лише той стан, який малювали.
      if (mode === "done") {
        if (drop(habit.dates, dateStr)) changed = true;
        if (drop(habit.halfDates, dateStr)) changed = true;
      } else if (mode === "skip") {
        if (drop(habit.skippedDates, dateStr)) changed = true;
      } else if (mode === "clean") {
        if (drop(habit.cleanDates, dateStr)) changed = true;
      }
    } else if (mode === "done") {
      if (add(habit.dates, dateStr)) changed = true;
      if (drop(habit.skippedDates, dateStr)) changed = true;
      if (drop(habit.halfDates, dateStr)) changed = true;
      if (drop(habit.cleanDates, dateStr)) changed = true;
    } else if (mode === "skip") {
      // Скіп виключає виконано/напів/чисто.
      if (add(habit.skippedDates, dateStr)) changed = true;
      if (drop(habit.dates, dateStr)) changed = true;
      if (drop(habit.halfDates, dateStr)) changed = true;
      if (drop(habit.cleanDates, dateStr)) changed = true;
    } else if (mode === "clean") {
      if (add(habit.cleanDates, dateStr)) changed = true;
      if (drop(habit.dates, dateStr)) changed = true;
      if (drop(habit.skippedDates, dateStr)) changed = true;
      if (drop(habit.halfDates, dateStr)) changed = true;
    }

    if (changed && typeof gistTouchDateMeta === "function") {
      gistTouchDateMeta(habit, dateStr);
    }
    return changed;
  }

  // Малює клітинку одразу в DOM, щоб протягування було плавним.
  function paint(info, ev) {
    if (!state.active || !info) return;
    if (info.habitId !== state.habitId) return; // не виходимо за межі картки
    if (state.painted.has(info.dateStr)) return;
    state.painted.add(info.dateStr);

    const list = getHabits();
    const habit = list && list.find((h) => h.id === state.habitId);
    if (!habit) return;

    if (!applyToDate(habit, info.dateStr, state.mode, state.fill)) return;

    const type = habit.type || "good";
    const isDone = habit.dates.includes(info.dateStr);
    const isSkipped = habit.skippedDates.includes(info.dateStr);
    const isHalf = habit.halfDates.includes(info.dateStr);
    const isClean =
      type === "bad" &&
      Array.isArray(habit.cleanDates) &&
      habit.cleanDates.includes(info.dateStr) &&
      !isDone &&
      !isSkipped;

    if (typeof updateHabitCheckbox === "function") {
      updateHabitCheckbox(
        state.habitId,
        info.dateStr,
        isDone,
        isSkipped,
        isHalf,
        isClean,
        type,
        (habit.category && habit.category.color) || ""
      );
    }
  }

  function start(e) {
    // Shift+ліва — «виконано». Додатковий Ctrl — «пропущено»/«чисто».
    if (e.button !== 0 || !e.shiftKey) return;

    const info = cellInfo(cellAt(e.clientX, e.clientY));
    if (!info) return;

    const list = getHabits();
    const habit = list && list.find((h) => h.id === info.habitId);
    if (!habit) return;

    // З Ctrl режим задає сама клітинка (skip для звичайних, clean для шкідливих).
    const mode = e.ctrlKey ? info.rightClick : "done";
    if (mode !== "done" && mode !== "skip" && mode !== "clean") return;

    // Shift+тягнення не має виділяти текст.
    e.preventDefault();
    e.stopPropagation();
    const sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();

    state.active = true;
    state.habitId = info.habitId;
    state.mode = mode;
    // Напрямок задає перша клітинка: вже має цей стан → прохід стирає.
    const src =
      mode === "done" ? habit.dates
      : mode === "skip" ? habit.skippedDates
      : habit.cleanDates;
    state.fill = !(Array.isArray(src) && src.includes(info.dateStr));
    state.painted = new Set();

    document.body.classList.add("habits-painting");
    paint(info, e);
  }

  function move(e) {
    if (!state.active) return;
    // Кнопку відпустили поза вікном.
    if (!(e.buttons & 1)) {
      finish();
      return;
    }
    e.preventDefault();
    paint(cellInfo(cellAt(e.clientX, e.clientY)), e);
  }

  function finish() {
    if (!state.active) return;

    const habitId = state.habitId;
    const count = state.painted ? state.painted.size : 0;

    state.active = false;
    state.painted = null;
    state.habitId = null;
    document.body.classList.remove("habits-painting");

    if (!count) return;

    // Один запис і один перерахунок на весь прохід.
    if (typeof saveHabits === "function") saveHabits();
    if (typeof window.invalidateHeatmapCache === "function") {
      window.invalidateHeatmapCache(habitId);
    }
    if (typeof invalidateHabitCache === "function") invalidateHabitCache(habitId);
    if (typeof scheduleRenderHabits === "function") scheduleRenderHabits();
    else if (typeof renderHabits === "function") renderHabits();
  }

  // Capture-фаза: спрацьовуємо раніше за делегований клік і long-press.
  document.addEventListener("pointerdown", start, true);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);
  window.addEventListener("blur", finish);

  // Клік, що завершив протягування, не має додатково перемикати клітинку.
  document.addEventListener(
    "click",
    (e) => {
      if (e.shiftKey && e.target.closest && e.target.closest(".heatmap")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  window.habitsPaintState = state; // для діагностики
})();
