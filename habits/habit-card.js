/* ========== HABIT CARD HELPER FUNCTIONS ========== */

const heatmapCache = new Map();

function computeCleanDatesSet(habit, today) {
  const cleanDatesSet = new Set();
  if (habit.cleanDates) {
    habit.cleanDates.forEach((d) => cleanDatesSet.add(d));
  }
  const sortedDates = [...habit.dates].sort();
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const from = sortedDates[i];
    const to = sortedDates[i + 1];
    let d = new Date(from);
    d.setDate(d.getDate() + 1);
    const end = new Date(to);
    while (d < end) {
      cleanDatesSet.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }
  if (sortedDates.length > 0) {
    const last = sortedDates[sortedDates.length - 1];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (last < yesterdayStr) {
      let d = new Date(last);
      d.setDate(d.getDate() + 1);
      const end = new Date(yesterdayStr);
      end.setDate(end.getDate() + 1);
      while (d < end) {
        cleanDatesSet.add(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }
  }
  return cleanDatesSet;
}

function buildHeatmapHTML(habit, weeks, today, habitType) {
  const cacheKey = `${habit.id}-${today}-${JSON.stringify(habit.dates)}-${JSON.stringify(habit.skippedDates || [])}-${JSON.stringify(habit.halfDates || [])}-${habitType}-${habit.category?.color || ""}`;
  
  const cached = heatmapCache.get(cacheKey);
  if (cached) return cached;

  const habitDatesSet = new Set(habit.dates);
  const habitSkippedSet = new Set(habit.skippedDates || []);
  const habitHalfSet = new Set(habit.halfDates || []);
  const cleanDatesSet = habitType === "bad" ? computeCleanDatesSet(habit, today) : new Set();
  const categoryColor = habit.category?.color || "";
  const habitNotes = habit.notes || {};

  let html = '<div class="heatmap-wrapper"><div class="heatmap">';
  weeks.forEach((week) => {
    html += '<div class="week-column">';
    week.forEach((cellData) => {
      const { dateStr, isPadding } = cellData;
      const isActive = habitDatesSet.has(dateStr);
      const isSkipped = habitSkippedSet.has(dateStr);
      const isHalf = habitHalfSet.has(dateStr);
      const isToday = dateStr === today;
      const isFuture = dateStr > today;
      const isClean = habitType === "bad" && cleanDatesSet.has(dateStr) && !isActive && !isSkipped;
      const note = habitNotes[dateStr];

      const [year, month, day] = dateStr.split("-");
      const displayDate = `${day}.${month}`;

      const classes = [
        "cell",
        isPadding ? "padding" : "",
        isActive ? "active" : "",
        isSkipped ? "skipped" : "",
        isHalf ? `half ${getHalfStyleClass()}` : "",
        !isPadding && isToday ? "today" : "",
        !isPadding && isFuture ? "future" : "",
        isClean ? "skipped" : "",
        note ? "has-note" : "",
      ].filter(Boolean).join(" ");

      const styleProps = [];
      if (categoryColor) {
        styleProps.push(`--category-color: ${categoryColor}`);
        // Для варіантів «напів» використовуємо колір категорії замість синього
        styleProps.push(`--half-color: ${categoryColor}`);
      }
      const styleAttr = styleProps.length ? ` style="${styleProps.join('; ')}"` : "";

      const noteAttr = note ? ` data-note="${escapeHtml(note)}"` : "";
      const rightClickAttr = habitType === "bad" 
        ? ` data-right-click="clean"` 
        : ` data-right-click="skip"`;

      html += `<div class="${classes}"${styleAttr}${noteAttr}${rightClickAttr}
        data-habit-id="${habit.id}"
        data-date="${displayDate}"
        data-date-raw="${dateStr}"
        data-active="${isActive}"
        data-skipped="${isSkipped}"
        data-half="${isHalf}"
        data-clean="${isClean}"></div>`;
    });
    html += "</div>";
  });
  html += "</div></div>";

  if (heatmapCache.size > 500) {
    const firstKey = heatmapCache.keys().next().value;
    heatmapCache.delete(firstKey);
  }
  heatmapCache.set(cacheKey, html);
  return html;
}

function invalidateHeatmapCache(habitId) {
  for (const key of heatmapCache.keys()) {
    if (key.startsWith(`${habitId}-`)) {
      heatmapCache.delete(key);
    }
  }
}

function clearHeatmapCache() {
  heatmapCache.clear();
}

// Make cache accessible for invalidation
window.invalidateHeatmapCache = function(habitId) {
  for (const key of heatmapCache.keys()) {
    if (key.startsWith(`${habitId}-`)) heatmapCache.delete(key);
  }
};
window.clearHeatmapCache = clearHeatmapCache;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderMonthChart(monthData, maxMonth) {
  return monthData.map((m) => `
    <div class="bar" style="height: ${Math.max((m.count / maxMonth) * 50, 4)}px;">
      <div class="bar-value">${m.count}</div>
      <div class="bar-label">${m.month}</div>
    </div>
  `).join("");
}

function buildBadges(habit, allHabits, today, habitType, isDoneToday) {
  const cacheKey = `badges-${habit.id}-${today}`;
  if (window._badgesCache && window._badgesCache.has(cacheKey)) {
    return window._badgesCache.get(cacheKey);
  }

  let badges = [];
  return badges;

  // Повернення: 3+ пропущених днів перед сьогодні
  if (isDoneToday && habitType === "good") {
    const sortedDates = [...habit.dates].sort();
    const todayTime = new Date(today).getTime();
    let gapDays = 0;
    for (let d = todayTime - 86400000; ; d -= 86400000) {
      const ds = new Date(d).toISOString().slice(0, 10);
      if (habit.dates.includes(ds) || ds < sortedDates[0]) break;
      gapDays++;
    }
    if (gapDays >= 3) {
      badges.push({ type: "comeback", text: "Повернення" });
    }
  }

  // Мульти-майстер
  const goodHabits = allHabits.filter((h) => (h.type || "good") === "good");
  if (isDoneToday && habitType === "good" && goodHabits.length >= 2) {
    const allDoneToday = goodHabits.every((h) => h.dates.includes(today));
    if (allDoneToday) {
      badges.push({ type: "multi", text: "Мульти" });
    }
  }

  // Ідеальний тиждень
  if (goodHabits.length >= 2) {
    let perfectWeek = true;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (!goodHabits.every((h) => h.dates.includes(ds))) {
        perfectWeek = false;
        break;
      }
    }
    if (perfectWeek) {
      badges.push({ type: "perfect", text: "Ідеальний тиждень" });
    }
  }

  // 90% за місяць
  if (habitType === "good" && habit.dates.length > 0) {
    let completed30 = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (habit.dates.includes(ds)) completed30++;
    }
    if (completed30 >= 27) {
      badges.push({ type: "percent", text: "90% місяць" });
    }
  }

  // 100% за тиждень
  if (habitType === "good") {
    let perfectWeekSingle = true;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (!habit.dates.includes(ds)) {
        perfectWeekSingle = false;
        break;
      }
    }
    if (perfectWeekSingle) {
      badges.push({ type: "target", text: "100% тиждень" });
    }
  }

  const badgeOrder = { multi: 1, perfect: 2, target: 3, comeback: 4, percent: 5 };
  badges.sort((a, b) => (badgeOrder[a.type] || 99) - (badgeOrder[b.type] || 99));
  const result = badges.slice(0, 2);

  if (!window._badgesCache) window._badgesCache = new Map();
  window._badgesCache.set(cacheKey, result);
  return result;
}

const BADGE_ICONS = {
  comeback: ICON('refreshCcw', 12, { strokeWidth: 2.5 }),
  perfect: ICON('checkCircle', 12, { strokeWidth: 2.5 }),
  multi: ICON('starBadge', 12, { strokeWidth: 2.5 }),
  percent: ICON('percent', 12, { strokeWidth: 2.5 }),
  target: ICON('target', 12, { strokeWidth: 2.5 }),
};

function renderBadgesHTML(badges) {
  return badges.map((b) =>
    `<div class="habit-badge habit-badge--${b.type}" title="${b.text}">${BADGE_ICONS[b.type]}<span>${b.text}</span></div>`
  ).join("");
}

function renderStreakBadge(streak, brokenStreak, showBrokenStreak, habitType) {
  if (streak > 0) {
    return `
      <div class="streak-badge done-streak${habitType === "bad" ? "bad-streak" : ""}" title="Серія: ${streak} днів поспіль">
        ${ICON('flame', 16)}
        <span class="streak-count">${streak}</span>
      </div>`;
  }
  if (showBrokenStreak) {
    return `
      <div class="streak-badge broken-streak" title="Не виконувалося: ${brokenStreak} днів">
        ${ICON('award', 24)}
        <span class="streak-count">${brokenStreak}</span>
      </div>`;
  }
  return "";
}

function renderCheckboxIcon(isDoneToday, isSkippedToday, isHalfToday, isCleanToday, habitType) {
  if (isSkippedToday) {
    return ICON('minus', 18);
  }
  if (isHalfToday) {
    // Для «напів» показуємо галочку у великому чекбоксі (маленька клітинка
    // heatmap лише градієнт, SVG там приховано через CSS .cell.half svg).
    return ICON('check', 20, { strokeWidth: 3 });
  }
  if (isCleanToday) {
    return ICON('check', 20, { strokeWidth: 3 });
  }
  if (habitType === "bad") {
    return ICON('minus', 18);
  }
  return ICON('check', 20, { strokeWidth: 3 });
}
