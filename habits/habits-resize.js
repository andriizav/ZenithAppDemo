/* ========== HABITS WIDTH RESIZER ========== */
// Винесено з habits.js: логіка зміни ширини секції звичок (усі картки разом).
// Контейнер (el #habitsContainer) перевикористовується між рендерами, тому
// елемент-ресайзер зберігається. Глобальні mousemove/mouseup біндяться один раз;
// спільний об'єкт стану оновлюється тут, щоб цілитись у живі елементи.

let habitsResizeState = null;

function initHabitsResizer(container) {
  // ── Width resizer for the whole habits area (all cards) ──
  let resizer = container.querySelector(".habits-resizer");
  if (!resizer) {
    resizer = document.createElement("div");
    resizer.className = "habits-resizer";
    resizer.id = "habits-resizer";
    container.appendChild(resizer);
  }
  const rz = resizer;

  const MIN_WIDTH = 900; // 2 картки по min-width 440 + відступ 20
  const savedWidth = parseInt(localStorage.getItem("habits_container_width"), 10);
  container.style.width = savedWidth >= MIN_WIDTH ? savedWidth + "px" : "";

  const sectionInit = container.querySelector(".habits-section");
  const gridGapInit =
    parseInt(
      getComputedStyle(sectionInit).columnGap ||
        getComputedStyle(sectionInit).gap ||
        "20",
      10
    ) || 20;

  const maxWidth = (() => {
    const hp = container.querySelector(".heatmap");
    const card = container.querySelector(".habit");
    if (!hp || !card) return window.innerWidth - 50;

    const dpr = window.devicePixelRatio || 1;
    const hpScrollWidth = hp.scrollWidth;
    const overheadPerCard = card.offsetWidth - hp.offsetWidth;
    const fullCardWidthCSS = hpScrollWidth + overheadPerCard;
    const fullCardWidthPhys = Math.ceil(fullCardWidthCSS * dpr);
    const fullCardWidth = fullCardWidthPhys / dpr;

    const baseMax = fullCardWidth * 2 + gridGapInit;
    return Math.min(window.innerWidth - 50, baseMax);
  })();

  if (savedWidth >= MIN_WIDTH && maxWidth < savedWidth) {
    container.style.width = maxWidth + "px";
  }

  const anyWeekCol = container.querySelector(".week-column");
  const colWidth = anyWeekCol ? anyWeekCol.offsetWidth : 15;

  const heatmapEl = container.querySelector(".heatmap");
  const overhead = heatmapEl
    ? container.offsetWidth - heatmapEl.offsetWidth * 2
    : 0;

  // Округлює scrollLeft у фізичних пікселях, щоб при dpr=1.5 браузер
  // не застрявав на дробових значеннях (131.333 замість 132).
  // Math.round у фіз. пікселях → ділимо назад → браузер сам знайде
  // найближче представниме значення без субпіксельного залишку.
  function snapScrollLeft(h, value) {
    const dpr = window.devicePixelRatio || 1;
    const snapped = Math.round(value * dpr) / dpr;
    // Не перевищуємо реальний максимум
    h.scrollLeft = Math.min(snapped, h.scrollWidth - h.clientWidth);
  }

  function scrollToToday() {
    container.querySelectorAll(".heatmap").forEach((h) => {
      const todayCell = h.querySelector(".cell.today");
      if (todayCell) {
        const colW = h.querySelector(".week-column")?.offsetWidth || 15;
        const offset = 3 * colW;
        const target =
          todayCell.offsetLeft -
          h.clientWidth / 2 +
          todayCell.offsetWidth / 2 +
          offset;
        // Snap по колонках, потім snap у фіз. пікселях
        const snappedToCol = Math.round(target / colW) * colW;
        snapScrollLeft(h, snappedToCol);
      }
    });
  }
  // Виконуємо синхронно: встановлюємо прокрутку до «сьогодні» одразу після
  // побудови DOM, ще до того як браузер відмалює сторінку. Якщо робити це
  // через requestAnimationFrame, користувач бачить стрибок скролу (з 0 до
  // поточної дати) — visible layout shift.
  scrollToToday();

  // Скролбар показуємо лише коли курсор у нижній зоні heatmap (поверх скролу).
  if (!container._scrollHoverBound) {
    container._scrollHoverBound = true;
    const ZONE = 20; // px від низу: padding-bottom + висота скролбара + запас
    container.addEventListener("mousemove", (e) => {
      const hm = e.target.closest ? e.target.closest(".heatmap") : null;
      if (!hm) return; // курсор поза heatmap (напр. на скролбарі під час перетягування) — не чіпаємо
      container.querySelectorAll(".heatmap").forEach((h) => {
        if (h !== hm) {
          h.classList.remove("show-scroll");
          return;
        }
        const rect = h.getBoundingClientRect();
        const yFromBottom = rect.bottom - e.clientY;
        h.classList.toggle("show-scroll", yFromBottom <= ZONE);
      });
    });
    container.addEventListener("mouseleave", () => {
      container.querySelectorAll(".heatmap").forEach((h) => h.classList.remove("show-scroll"));
    });
  }

  if (habitsResizeState) {
    habitsResizeState.container = container;
    habitsResizeState.resizer = rz;
    habitsResizeState.colWidth = colWidth;
    habitsResizeState.overhead = overhead;
    habitsResizeState.maxWidth = maxWidth;
    habitsResizeState.scrollToToday = scrollToToday;
  } else {
    habitsResizeState = {
      container,
      resizer: rz,
      isResizing: false,
      startX: 0,
      startWidth: 0,
      colWidth,
      overhead,
      maxWidth,
      scrollToToday,
    };
  }

  if (!rz._resizeBound) {
    rz._resizeBound = true;
    rz.addEventListener("mousedown", (e) => {
      if (!habitsResizeState) return;
      habitsResizeState.isResizing = true;
      habitsResizeState.startX = e.clientX;
      habitsResizeState.startWidth = container.offsetWidth;
      habitsResizeState.maxWidth = maxWidth;
      rz.classList.add("active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
  }

  if (!window.__habitsResizeBound) {
    window.__habitsResizeBound = true;
    document.addEventListener("mousemove", (e) => {
      if (!habitsResizeState || !habitsResizeState.isResizing) return;
      const { colWidth, overhead, maxWidth } = habitsResizeState;
      const deltaX = e.clientX - habitsResizeState.startX;
      const raw = habitsResizeState.startWidth + deltaX * 2;
      const visiblePerCard = (raw - overhead) / 2;
      const snappedVisible = Math.floor(visiblePerCard / colWidth) * colWidth;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(maxWidth, snappedVisible * 2 + overhead)
      );
      habitsResizeState.container.style.width = newWidth + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!habitsResizeState || !habitsResizeState.isResizing) return;
      habitsResizeState.isResizing = false;
      if (habitsResizeState.resizer)
        habitsResizeState.resizer.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        "habits_container_width",
        habitsResizeState.container.offsetWidth
      );
      if (habitsResizeState.scrollToToday) habitsResizeState.scrollToToday();
    });
  }
}