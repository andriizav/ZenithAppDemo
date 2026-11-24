/* ========== TABATA TIMER (TAB) ========== */

let timerTimer = null;
let timerRunning = false;
let timerPaused = false;
let timerTotalSeconds = 0;
let timerCurrentSeconds = 0;
let timerPhase = "idle"; // idle, warmup, work, rest, cooldown, done
let timerPhaseIndex = -1;
let timerCurrentRound = 0;
let timerTotalRounds = 8;
let timerEditingPresetIndex = null;
let timerDragSrcIndex = null;
let timerPresetCtxMenu = null;

const TimerAudioCtx = window.AudioContext || window.webkitAudioContext;
let timerAudioCtx;

function timerEnsureAudio() {
  if (!timerAudioCtx) timerAudioCtx = new TimerAudioCtx();
  if (timerAudioCtx.state === "suspended") timerAudioCtx.resume();
}

function timerPlayBeep(freq, duration, volume = 0.3, type = "sine", release = 0) {
  timerEnsureAudio();
  const osc = timerAudioCtx.createOscillator();
  const gain = timerAudioCtx.createGain();
  const now = timerAudioCtx.currentTime;
  const rel = release || Math.min(duration * 0.6, 0.4);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
  gain.gain.setValueAtTime(volume, now + Math.max(duration - rel, 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(timerAudioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

const timerCustomSounds = {};
const timerWavNames = [
  "countdown1", "countdown2", "countdown3",
  "work-countdown1", "work-countdown2", "work-countdown3",
  "rest-countdown1", "rest-countdown2", "rest-countdown3",
  "work-end", "rest-end", "done"
];

function timerLoadCustomSounds() {
  timerWavNames.forEach((name) => {
    const audio = new Audio();
    audio.src = `timer/sounds/${name}.wav`;
    audio.preload = "auto";
    audio.oncanplaythrough = () => {
      timerCustomSounds[name] = audio;
      console.log(`[sounds] loaded: ${name}`);
      timerRenderSounds();
    };
    audio.onerror = () => { console.log(`[sounds] skip: ${name}`); };
  });
}

function timerPlayWav(name) {
  if (!timerCustomSounds[name]) return false;
  timerEnsureAudio();
  const clone = timerCustomSounds[name].cloneNode();
  clone.currentTime = 0;
  clone.play().catch(() => {});
  return true;
}

function timerNormalizeTags(raw) {
  let tag = raw;
  if (Array.isArray(tag)) tag = tag.flat(Infinity).filter((x) => typeof x === "string");
  else tag = tag ? [tag] : [];
  return tag;
}

function timerGetLabSounds() {
  let deletedIds = [];
  try { deletedIds = JSON.parse(localStorage.getItem("timerSoundLabDeleted") || "[]"); } catch {}
  const all = typeof SOUNDS_DATA !== "undefined" ? SOUNDS_DATA : [];
  let customTags = {};
  try { customTags = JSON.parse(localStorage.getItem("timerSoundLabTags") || "{}"); } catch {}
  return all
    .filter((s) => !deletedIds.includes(s.id))
    .map((s) => {
      const t = customTags[s.id];
      const tag = timerNormalizeTags(t !== undefined && t !== null ? t : s.tag);
      return { ...s, tag };
    });
}

function timerPlayLabSoundById(id) {
  const sounds = timerGetLabSounds();
  const s = sounds.find((x) => x.id === id);
  if (!s) return false;
  timerEnsureAudio();
  const rel = (s.release || 300) / 1000;
  s.notes.forEach((note) => {
    const osc = timerAudioCtx.createOscillator();
    const gain = timerAudioCtx.createGain();
    const start = timerAudioCtx.currentTime + note.delay / 1000;
    const dur = note.duration / 1000;
    const attack = 0.012;
    const holdUntil = Math.max(start + attack, start + dur - rel);
    const end = start + dur;
    osc.type = note.type || s.type || "sine";
    osc.frequency.setValueAtTime(note.freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.volume, start + attack);
    gain.gain.setValueAtTime(note.volume, holdUntil);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(timerAudioCtx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
  return true;
}

function timerPlayCountdownBeep(sec) {
  const phaseKey = (timerPhase === "work" || timerPhase === "warmup") ? "work"
    : (timerPhase === "rest" || timerPhase === "cooldown") ? "rest" : null;
  if (phaseKey && timerPlayWav(`${phaseKey}-countdown${sec}`)) return;
  if (timerPlayWav("countdown" + sec)) return;
  const selCd = localStorage.getItem("timerSelCountdown");
  if (selCd === "__default") { timerPlayBeep(600, 0.1, 0.25); return; }
  if (selCd && timerPlayLabSoundById(selCd)) return;
  const labSounds = timerGetLabSounds();
  const cd = labSounds.find((s) => Array.isArray(s.tag) ? s.tag.includes("відлік") : s.tag === "відлік");
  if (cd && timerPlayLabSoundById(cd.id)) return;
  timerPlayBeep(600, 0.1, 0.25);
}

function timerPlayWorkEnd() {
  if (timerPlayWav("work-end")) return;
  const selEnd = localStorage.getItem("timerSelEnd");
  if (selEnd === "__default-end") {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      setTimeout(() => timerPlayBeep(f, 0.9, 0.18, "sine", 0.7), i * 45);
    });
    return;
  }
  if (selEnd && timerPlayLabSoundById(selEnd)) return;
  const labSounds = timerGetLabSounds();
  const end = labSounds.find((s) => Array.isArray(s.tag) ? s.tag.includes("кінець") : s.tag === "кінець");
  if (end && timerPlayLabSoundById(end.id)) return;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    setTimeout(() => timerPlayBeep(f, 0.9, 0.18, "sine", 0.7), i * 45);
  });
}

function timerPlayRestEnd() {
  if (timerPlayWav("rest-end")) return;
  const selEnd = localStorage.getItem("timerSelEnd");
  if (selEnd === "__default-end") {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      setTimeout(() => timerPlayBeep(f, 0.9, 0.18, "sine", 0.7), i * 45);
    });
    return;
  }
  if (selEnd && timerPlayLabSoundById(selEnd)) return;
  const labSounds = timerGetLabSounds();
  const end = labSounds.find((s) => Array.isArray(s.tag) ? s.tag.includes("кінець") : s.tag === "кінець");
  if (end && timerPlayLabSoundById(end.id)) return;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    setTimeout(() => timerPlayBeep(f, 0.9, 0.18, "sine", 0.7), i * 45);
  });
}

function timerPlayDoneBeep() {
  if (timerPlayWav("done")) return;
  const selDone = localStorage.getItem("timerSelDone");
  if (selDone === "__default") { timerPlayBeep(600, 0.1, 0.25); return; }
  if (selDone && timerPlayLabSoundById(selDone)) return;
  const labSounds = timerGetLabSounds();
  const done = labSounds.find((s) => Array.isArray(s.tag) ? s.tag.includes("завершення") : s.tag === "завершення");
  if (done && timerPlayLabSoundById(done.id)) return;
  [0, 150, 300].forEach((d, i) => {
    setTimeout(() => timerPlayBeep(800 + i * 200, 0.15, 0.3), d);
  });
}

function timerGetSettings() {
  const val = (id, def) => {
    const el = document.getElementById(id);
    const n = parseInt(el?.value);
    return isNaN(n) ? def : n;
  };
  return {
    work: Math.max(1, val("timer-workTime", 20)),
    rest: Math.max(0, val("timer-restTime", 10)),
    rounds: Math.max(1, val("timer-rounds", 8)),
    warmup: Math.max(0, val("timer-warmupTime", 0)),
    cooldown: Math.max(0, val("timer-cooldownTime", 0)),
  };
}

function timerFormatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerGetUI() {
  return {
    timeDisplay: document.getElementById("timer-timeDisplay"),
    phaseLabel: document.getElementById("timer-phaseLabel"),
    roundInfo: document.getElementById("timer-roundInfo"),
    progressBar: document.getElementById("timer-progressBar"),
    roundsVisual: document.getElementById("timer-roundsVisual"),
    playBtn: document.getElementById("timer-playBtn"),
  };
}

function timerUpdateDisplay() {
  const { timeDisplay, phaseLabel, roundInfo, progressBar, roundsVisual } = timerGetUI();
  if (!timeDisplay) return;

  timeDisplay.textContent = timerFormatTime(timerCurrentSeconds);
  timeDisplay.className = "time-display " + timerPhase + (timerPaused ? " paused" : "");
  phaseLabel.className = "phase-label " + timerPhase;

  const labels = {
    idle: "Таймер",
    warmup: "Початок",
    work: "Робота",
    rest: "Перерва",
    cooldown: "Заминка",
    done: "Готово",
  };
  phaseLabel.textContent = timerPaused ? "Пауза" : (labels[timerPhase] || "");

  if ((timerPhase === "work" || timerPhase === "rest") && timerRunning) {
    roundInfo.textContent = `Підхід ${timerCurrentRound} / ${timerTotalRounds}`;
  } else {
    roundInfo.textContent = "";
  }

  if (timerPhase === "done") {
    progressBar.style.width = "100%";
    progressBar.style.background = "#22c55e";
  } else if (timerPhase === "idle") {
    progressBar.style.width = "0%";
  }

  timerUpdateRoundDots();
}

function timerBuildRoundDots() {
  const { roundsVisual } = timerGetUI();
  if (!roundsVisual) return;
  roundsVisual.innerHTML = "";
  roundsVisual.style.transform = "";
  const dotSize = 14;
  const gap = 6;
  for (let i = 1; i <= timerTotalRounds; i++) {
    const dot = document.createElement("div");
    dot.className = "round-dot";
    dot.dataset.round = i;
    dot.onclick = () => timerJumpToRound(i);
    roundsVisual.appendChild(dot);
  }
  const needed = timerTotalRounds * dotSize + (timerTotalRounds - 1) * gap;
  const avail = roundsVisual.clientWidth || roundsVisual.parentElement.clientWidth - 36;
  if (needed > avail && timerTotalRounds > 1) {
    roundsVisual.style.transform = `scale(${avail / needed})`;
  }
}

function timerJumpToRound(round) {
  const wasIdle = !timerRunning && !timerPaused;
  if (wasIdle) {
    timerRunning = true;
    timerTotalRounds = timerGetSettings().rounds;
  }
  clearInterval(timerTimer);
  timerEnsureAudio();
  const phases = timerBuildPhases();
  const workIndices = [];
  phases.forEach((p, i) => { if (p === "work") workIndices.push(i); });
  const targetIndex = workIndices[round - 1];
  if (targetIndex === undefined) return;

  timerPhaseIndex = targetIndex;
  timerPhase = "work";
  timerCurrentRound = round;
  const s = timerGetSettings();
  timerTotalSeconds = s.work;
  timerCurrentSeconds = timerTotalSeconds;
  timerRunning = true;
  timerPaused = true;
  const { playBtn, progressBar, roundsVisual } = timerGetUI();
  playBtn.innerHTML = timerPlayIconSVG;
  progressBar.style.width = "0%";
  if (roundsVisual) roundsVisual.classList.remove("lite");
  timerUpdateDisplay();
}

function timerUpdateRoundDots() {
  const { roundsVisual } = timerGetUI();
  if (!roundsVisual) return;
  const isLite = roundsVisual.classList.contains("lite");
  const dots = roundsVisual.querySelectorAll(".round-dot");
  dots.forEach((dot) => {
    const r = parseInt(dot.dataset.round);
    dot.className = "round-dot" + (isLite ? " lite" : "");
    if (!isLite && r < timerCurrentRound && timerPhase !== "idle" && timerPhase !== "done") {
      dot.classList.add("done");
    } else if (!isLite && r === timerCurrentRound && (timerPhase === "work" || timerPhase === "rest")) {
      dot.classList.add("current");
    } else if (!isLite && timerPhase === "done") {
      dot.classList.add("done");
    }
  });
}

function timerBuildPhases() {
  const s = timerGetSettings();
  const phases = [];
  if (s.warmup > 0) phases.push("warmup");
  for (let i = 0; i < s.rounds; i++) {
    phases.push("work");
    if (s.rest > 0) phases.push("rest");
  }
  if (s.cooldown > 0) phases.push("cooldown");
  phases.push("done");
  return phases;
}

function timerStartPhase(p) {
  timerPhase = p;
  const s = timerGetSettings();
  timerCurrentRound = 1;
  timerTotalRounds = s.rounds;

  const phases = timerBuildPhases();
  timerPhaseIndex = phases.indexOf(p);

  if (p === "warmup" && s.warmup > 0) {
    timerTotalSeconds = s.warmup;
  } else if (p === "work") {
    timerTotalSeconds = s.work;
  } else if (p === "rest") {
    timerTotalSeconds = s.rest;
  } else if (p === "cooldown" && s.cooldown > 0) {
    timerTotalSeconds = s.cooldown;
  }

  timerCurrentSeconds = timerTotalSeconds;
  const { roundsVisual } = timerGetUI();
  if (roundsVisual) roundsVisual.classList.remove("lite");
  timerBuildRoundDots();
  timerUpdateDisplay();
}

function timerTick() {
  timerCurrentSeconds--;
  const s = timerGetSettings();

  if (timerCurrentSeconds <= 3 && timerCurrentSeconds > 0 && timerPhase !== "idle" && timerPhase !== "done") {
    timerPlayCountdownBeep(timerCurrentSeconds);
  }

  if (timerCurrentSeconds <= 0) {
    timerAdvancePhase();
  } else {
    if (timerTotalSeconds > 0) {
      const pct = ((timerTotalSeconds - timerCurrentSeconds) / timerTotalSeconds) * 100;
      const { progressBar } = timerGetUI();
      progressBar.style.width = pct + "%";
      if (timerPhase === "work") progressBar.style.background = "#00e676";
      else if (timerPhase === "rest") progressBar.style.background = "#ff9100";
      else if (timerPhase === "warmup") progressBar.style.background = "#ffea00";
      else if (timerPhase === "cooldown") progressBar.style.background = "#448aff";
    }
    timerUpdateDisplay();
  }
}

function timerAdvancePhase() {
  const s = timerGetSettings();
  const phases = timerBuildPhases();

  let idx = timerPhaseIndex;
  if (idx < 0) idx = phases.indexOf(timerPhase);
  const next = phases[idx + 1];
  const { playBtn } = timerGetUI();

  if (!next || next === "done") {
    timerPhase = "done";
    timerCurrentSeconds = 0;
    clearInterval(timerTimer);
    timerRunning = false;
    timerPaused = false;
    playBtn.innerHTML = timerPlayIcon();
    const { progressBar } = timerGetUI();
    progressBar.style.width = "100%";
    progressBar.style.background = "#22c55e";
    timerPlayDoneBeep();
    timerUpdateDisplay();
    timerCelebrate();
    return;
  }

  timerPhaseIndex = idx + 1;
  timerPhase = next;
  const { progressBar } = timerGetUI();
  progressBar.style.width = "0%";

  if (timerPhase === "work") {
    timerTotalSeconds = s.work;
    const workCount = phases.slice(0, timerPhaseIndex + 1).filter((p) => p === "work").length;
    timerCurrentRound = workCount;
    timerPlayRestEnd();
  } else if (timerPhase === "rest") {
    timerTotalSeconds = s.rest;
    timerPlayWorkEnd();
  } else if (timerPhase === "warmup") {
    timerTotalSeconds = s.warmup;
    timerCurrentRound = 0;
    timerPlayRestEnd();
  } else if (timerPhase === "cooldown") {
    timerTotalSeconds = s.cooldown;
    timerPlayWorkEnd();
  }

  timerCurrentSeconds = timerTotalSeconds;
  timerUpdateDisplay();
}

const timerPlayIconSVG =
  ICON('play', 24);
const timerPauseIconSVG =
  ICON('pause', 24);

function timerPlayIcon() {
  return timerPlayIconSVG;
}

function timerToggleTimer() {
  timerEnsureAudio();
  const { playBtn } = timerGetUI();

  if (!timerRunning) {
    const s = timerGetSettings();
    timerTotalRounds = s.rounds;
    timerRunning = true;
    timerPaused = false;
    playBtn.innerHTML = timerPauseIconSVG;

    if (s.warmup > 0) {
      timerStartPhase("warmup");
    } else {
      timerStartPhase("work");
    }

    timerTimer = setInterval(timerTick, 1000);
  } else if (timerPaused) {
    timerPaused = false;
    playBtn.innerHTML = timerPauseIconSVG;
    timerUpdateDisplay();
    timerTimer = setInterval(timerTick, 1000);
  } else {
    timerPaused = true;
    playBtn.innerHTML = timerPlayIconSVG;
    clearInterval(timerTimer);
    timerUpdateDisplay();
  }
}

function timerResetTimer() {
  clearInterval(timerTimer);
  timerRunning = false;
  timerPaused = false;
  timerPhase = "idle";
  timerPhaseIndex = -1;
  timerCurrentSeconds = 0;
  timerTotalSeconds = 0;
  timerCurrentRound = 0;
  const { playBtn, progressBar, roundsVisual } = timerGetUI();
  playBtn.innerHTML = timerPlayIconSVG;
  progressBar.style.width = "0%";
  roundsVisual.innerHTML = "";
  timerUpdateDisplay();
}

function timerLoadPresets() {
  try {
    return JSON.parse(localStorage.getItem("tabataPresets") || "[]");
  } catch {
    return [];
  }
}

function timerEnsurePresetIds() {
  const presets = timerLoadPresets();
  let changed = false;
  presets.forEach(p => {
    if (!p.id) {
      p.id = 'tp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      changed = true;
    }
  });
  if (changed) localStorage.setItem("tabataPresets", JSON.stringify(presets));
  return presets;
}

function timerSavePresetsData(presets) {
  localStorage.setItem("tabataPresets", JSON.stringify(presets));
  gistTouchLocalModified('timer');
  if (typeof timerGistStorage !== 'undefined' && timerGistStorage.isEnabled()) {
    timerGistStorage.markPendingChanges();
  }
}

// --- Розміщення шаблонів: 'wrap' (заповнення, як раніше) або 'column' (1 = 1 рядок)
const TIMER_PRESETS_LAYOUT_KEY = 'timerPresetsLayout';

function timerGetPresetsLayout() {
  return localStorage.getItem(TIMER_PRESETS_LAYOUT_KEY) === 'column' ? 'column' : 'wrap';
}

function timerApplyPresetsLayout() {
  const layout = timerGetPresetsLayout();
  document.getElementById('timer-presetsList')?.classList.toggle('column', layout === 'column');
  document.querySelectorAll('#timer-presetsLayoutToggle .timer-look-btn-opt').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === layout);
  });
}

function timerSetPresetsLayout(layout) {
  localStorage.setItem(TIMER_PRESETS_LAYOUT_KEY, layout === 'column' ? 'column' : 'wrap');
  timerApplyPresetsLayout();
}

function timerRenderPresets() {
  const presets = timerLoadPresets();
  const list = document.getElementById("timer-presetsList");
  if (!list) return;
  list.innerHTML = "";

  if (presets.length === 0) {
    list.innerHTML = '<span style="color:#444;font-size:0.8rem;">Немає збережених шаблонів</span>';
    return;
  }

  presets.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn" + (timerEditingPresetIndex === i ? " editing" : "");
    btn.draggable = true;
    btn.dataset.index = i;

    btn.ondragstart = (e) => {
      timerDragSrcIndex = i;
      btn.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", i);
    };

    btn.ondragend = () => {
      btn.classList.remove("dragging");
      timerDragSrcIndex = null;
      document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("drag-over"));
    };

    btn.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      btn.classList.add("drag-over");
    };

    btn.ondragleave = () => {
      btn.classList.remove("drag-over");
    };

    btn.ondrop = (e) => {
      e.preventDefault();
      btn.classList.remove("drag-over");
      const from = timerDragSrcIndex;
      const to = i;
      if (from === null || from === to) return;

      const presets = timerLoadPresets();
      const [moved] = presets.splice(from, 1);
      presets.splice(to, 0, moved);
      timerSavePresetsData(presets);

      if (timerEditingPresetIndex === from) timerEditingPresetIndex = to;
      else if (timerEditingPresetIndex !== null) {
        if (from < timerEditingPresetIndex && to >= timerEditingPresetIndex) timerEditingPresetIndex--;
        else if (from > timerEditingPresetIndex && to <= timerEditingPresetIndex) timerEditingPresetIndex++;
      }

      timerRenderPresets();
    };

    const label = document.createElement("span");
    label.textContent = p.name;
    label.style.pointerEvents = "none";

    btn.onclick = () => {
      // Під час редагування клік по іншому шаблону не повинен «залипати»
      // на старому — інакше збереження перезапише не той шаблон.
      if (timerEditingPresetIndex !== null) timerCancelEdit();
      timerApplyPreset(p);
    };

    btn.ondblclick = (e) => {
      e.stopPropagation();
      timerEditPreset(i);
    };

    btn.oncontextmenu = (e) => {
      timerShowPresetContextMenu(e, i);
    };

    btn.appendChild(label);

    if (timerEditingPresetIndex === i) {
      const badge = document.createElement("span");
      badge.className = "preset-edit-icon";
      badge.title = "Редагується";
      badge.innerHTML = ICON("pen", 12);
      btn.appendChild(badge);
    }

    list.appendChild(btn);
  });

  timerHighlightActivePreset();
}

/* ========== PRESETS CONTEXT MENU ========== */

function timerHidePresetContextMenu() {
  if (timerPresetCtxMenu) {
    timerPresetCtxMenu.remove();
    timerPresetCtxMenu = null;
  }
}

function timerShowPresetContextMenu(event, index) {
  event.preventDefault();
  event.stopPropagation();

  timerHidePresetContextMenu();

  const p = timerLoadPresets()[index];
  if (!p) return;

  const menu = document.createElement("div");
  menu.className = "timer-context-menu";

  const editItem = document.createElement("div");
  editItem.className = "ctx-item";
  editItem.innerHTML = ICON("pen", 14) + "<span>Редагувати</span>";
  editItem.addEventListener("click", () => {
    timerHidePresetContextMenu();
    timerEditPreset(index);
  });

  const dupItem = document.createElement("div");
  dupItem.className = "ctx-item";
  dupItem.innerHTML = ICON("copy", 14) + "<span>Дублювати</span>";
  dupItem.addEventListener("click", () => {
    timerHidePresetContextMenu();
    timerDuplicatePreset(index);
  });

  const sep = document.createElement("div");
  sep.className = "ctx-separator";

  const delItem = document.createElement("div");
  delItem.className = "ctx-item ctx-item--danger";
  delItem.innerHTML = ICON("trash", 14) + "<span>Видалити</span>";
  delItem.addEventListener("click", () => {
    timerHidePresetContextMenu();
    timerAskDeletePreset(index, p.name);
  });

  menu.appendChild(editItem);
  menu.appendChild(dupItem);
  menu.appendChild(sep);
  menu.appendChild(delItem);

  document.body.appendChild(menu);
  timerPresetCtxMenu = menu;

  menu.style.left = Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8)) + "px";

  requestAnimationFrame(() => menu.classList.add("visible"));

  setTimeout(() => {
    document.addEventListener("click", timerHidePresetContextMenu, { once: true });
    document.addEventListener("contextmenu", timerHidePresetContextMenu, { once: true });
    document.addEventListener("keydown", timerOnPresetCtxMenuKey, { once: true });
  }, 0);
}

function timerOnPresetCtxMenuKey(e) {
  if (e.key === "Escape") timerHidePresetContextMenu();
}

function timerAskDeletePreset(i, name) {
  if (typeof window.openDeleteModal === "function") {
    window.openDeleteModal({
      title: "Видалити шаблон",
      name,
      text: "Цю дію неможливо скасувати.",
      confirmLabel: "Видалити",
      onConfirm: () => timerDeletePreset(i),
    });
  } else if (confirm(`Видалити шаблон "${name}"?`)) {
    timerDeletePreset(i);
  }
}

// «Tabata» → «Tabata 2» → «Tabata 3». Якщо базову назву вже закінчено
// номером, продовжуємо саме її (копія копії не плодить «Tabata 2 2»).
function timerNextPresetCopyName(name, presets) {
  const m = /^(.*?)\s+\d+$/.exec(name);
  const base = m ? m[1] : name;
  const taken = new Set(presets.map((p) => p.name));
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function timerPresetMatchesSettings(p) {
  const s = timerGetSettings();
  return (
    !!p &&
    p.work === s.work &&
    p.rest === s.rest &&
    p.rounds === s.rounds &&
    p.warmup === s.warmup &&
    p.cooldown === s.cooldown
  );
}

function timerPresetKey(p) {
  return [p.work, p.rest, p.rounds, p.warmup, p.cooldown].join("/");
}

// Активний шаблон + усі шаблони з ідентичними таймінгами.
// Якщо нічого не обрано (користувач вручну задав свої цифри) —
// дублікати не підсвічуємо взагалі.
function timerGetPresetHighlightState(presets) {
  let activeIndex = -1;
  presets.forEach((p, i) => {
    if (timerPresetMatchesSettings(p)) activeIndex = i;
  });

  const dups = new Set();
  if (activeIndex !== -1) {
    const key = timerPresetKey(presets[activeIndex]);
    presets.forEach((p, i) => {
      if (timerPresetKey(p) === key) dups.add(i);
    });
  }

  // Редагований шаблон не забирає синій вибір на себе: якщо в нього
  // з'явилася копія з однаковими таймінгами — активним стає інший,
  // а редагований підсвічується жовтим разом із дублікатами.
  if (activeIndex === timerEditingPresetIndex && dups.size > 1) {
    const other = [...dups].find((i) => i !== activeIndex);
    if (other !== undefined) activeIndex = other;
  }

  return { activeIndex, dups };
}

function timerDuplicatePreset(i) {
  const presets = timerLoadPresets();
  const src = presets[i];
  if (!src) return;

  const clone = { ...src };
  delete clone.id;
  clone.name = timerNextPresetCopyName(src.name, presets);
  presets.splice(i + 1, 0, clone);

  timerSavePresetsData(presets);
  timerEnsurePresetIds();

  if (timerEditingPresetIndex !== null) {
    if (timerEditingPresetIndex === i) timerCancelEdit();
    else if (timerEditingPresetIndex > i) timerEditingPresetIndex++;
  }
  timerRenderPresets();
  // Завжди перемикаємося на копію: вона і підсвічується як активна,
  // і відкривається на редагування.
  timerEditPreset(i + 1);
}

function timerSavePreset() {
  const nameInput = document.getElementById("timer-presetName");
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  const s = timerGetSettings();
  const presets = timerLoadPresets();

  if (timerEditingPresetIndex !== null) {
    // Розширюємо старий об'єкт, щоб не втратити id (синхронізація з gist).
    const i = timerEditingPresetIndex;
    if (presets[i]) presets[i] = { ...presets[i], name, ...s };
    timerEditingPresetIndex = null;
  } else {
    presets.push({ name, ...s });
  }

  timerSavePresetsData(presets);
  timerEnsurePresetIds();
  nameInput.value = "";
  nameInput.placeholder = "Назва";
  nameInput.blur();
  const row = document.getElementById("timer-saveRow");
  row.classList.remove("open", "editing");
  document.getElementById("timer-presetsAddBtn")?.classList.remove("active");
  timerRenderPresets();
}

function timerSetPresetEditingState(isEditing) {
  const row = document.getElementById("timer-saveRow");
  if (!row) return;
  row.classList.toggle("editing", isEditing);
  if (isEditing) row.classList.remove("open");
  document
    .getElementById("timer-presetsAddBtn")
    ?.classList.toggle("active", isEditing || row.classList.contains("open"));
  const nameInput = document.getElementById("timer-presetName");
  if (nameInput) nameInput.placeholder = isEditing ? "Назва шаблону" : "Назва";
}

// Фокус ставимо на перше поле таймінгу — там одразу видно, що саме воно
// редагується, і значення можна перезаписати не торкаючись назви.
function timerFocusFirstTimingField() {
  const el = document.getElementById("timer-workTime");
  if (!el) return;
  el.focus();
  el.select();
}

function timerEditPreset(i, opts) {
  const presets = timerLoadPresets();
  const p = presets[i];
  if (!p) return;
  // Для копії таймінги ідентичні — повторно застосовувати їх не треба,
  // інакше скинувся б активний сеанс таймера.
  if (!opts || !opts.skipApply) timerApplyPreset(p);
  const nameInput = document.getElementById("timer-presetName");
  nameInput.value = p.name;
  timerEditingPresetIndex = i;
  timerSetPresetEditingState(true);
  timerRenderPresets();
  timerFocusFirstTimingField();
}

function timerCancelEdit() {
  timerEditingPresetIndex = null;
  const nameInput = document.getElementById("timer-presetName");
  if (nameInput) {
    nameInput.value = "";
    nameInput.placeholder = "Назва";
  }
  const row = document.getElementById("timer-saveRow");
  row.classList.remove("open", "editing");
  document.getElementById("timer-presetsAddBtn")?.classList.remove("active");
  timerRenderPresets();
}

function timerApplyPreset(p) {
  document.getElementById("timer-workTime").value = p.work;
  document.getElementById("timer-restTime").value = p.rest;
  document.getElementById("timer-rounds").value = p.rounds;
  document.getElementById("timer-warmupTime").value = p.warmup;
  document.getElementById("timer-cooldownTime").value = p.cooldown;
  timerResetTimer();
  timerHighlightActivePreset();

  const firstPhase = p.warmup > 0 ? "warmup" : "work";
  const firstSeconds = firstPhase === "warmup" ? p.warmup : p.work;
  timerPhase = firstPhase;
  timerCurrentSeconds = firstSeconds;
  timerTotalSeconds = firstSeconds;
  timerCurrentRound = firstPhase === "warmup" ? 0 : 1;
  timerTotalRounds = p.rounds;
  const { timeDisplay, phaseLabel, roundsVisual } = timerGetUI();
  if (roundsVisual) {
    roundsVisual.innerHTML = "";
    roundsVisual.classList.add("lite");
  }
  timerBuildRoundDots();
  timerUpdateDisplay();

  if (timeDisplay) timeDisplay.className = "time-display preview";
  if (phaseLabel) {
    phaseLabel.className = "phase-label preview";
    phaseLabel.textContent = p.name || "Таймер";
  }
}

function timerHighlightActivePreset() {
  const presets = timerLoadPresets();
  const { activeIndex, dups } = timerGetPresetHighlightState(presets);
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    const i = parseInt(btn.dataset.index);
    // Стандартне виділення обраного — як завжди (синій).
    // Приглушеним блакитним підсвічуються лише його дублікати.
    btn.classList.toggle("active", i === activeIndex);
    btn.classList.toggle("twin", dups.has(i) && i !== activeIndex);
  });
}

function timerDeletePreset(i) {
  const presets = timerLoadPresets();
  const preset = presets[i];
  if (preset && preset.id) {
    gistAddDeletedId('timer', preset.id);
  }
  presets.splice(i, 1);
  timerSavePresetsData(presets);
  if (timerEditingPresetIndex === i) timerCancelEdit();
  else if (timerEditingPresetIndex !== null && i < timerEditingPresetIndex) timerEditingPresetIndex--;
  timerRenderPresets();
}

// Перехоплюємо глобальні клавіші, щоб не конфліктувати з пошуком інших вкладок
function timerKeyHandler(e) {
  const timerContent = document.getElementById("content-timer");
  if (!timerContent || !timerContent.classList.contains("active")) return;
  if (e.code === "Escape" && timerEditingPresetIndex !== null) {
    if (document.querySelector(".settings-modal")) return;
    e.preventDefault();
    timerCancelEdit();
    return;
  }
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    if (e.code === "Enter" && e.target.id === "timer-presetName") {
      e.preventDefault();
      timerSavePreset();
    }
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    timerToggleTimer();
  }
  if (e.code === "KeyR") {
    timerResetTimer();
  }
}

let timerKeyAttached = false;

function timerRenderSounds() {
  const list = document.getElementById("timer-soundsList");
  if (!list) return;
   const selCd = localStorage.getItem("timerSelCountdown") || "__default";
   const selEnd = localStorage.getItem("timerSelEnd") || "__default-end";
   const selDone = localStorage.getItem("timerSelDone") || "__default";
  const labSounds = timerGetLabSounds();
  const defaultCd = { id: "__default", name: "Стандартний 2 біп" };
  const defaultEnd = { id: "__default-end", name: "Стандартний 2" };
  const hasTag = (s, t) => Array.isArray(s.tag) ? s.tag.includes(t) : s.tag === t;
  const cdSounds = [defaultCd, ...labSounds.filter((s) => hasTag(s, "відлік"))];
  const endSounds = [defaultEnd, ...labSounds.filter((s) => hasTag(s, "кінець"))];
  const doneSounds = [defaultCd, ...labSounds.filter((s) => hasTag(s, "завершення"))];

  function playSound(id) {
    if (id === "__default") { timerPlayBeep(600, 0.1, 0.25); return; }
    if (id === "__default-end") {
      [523.25, 659.25, 783.99].forEach((f, i) => {
        setTimeout(() => timerPlayBeep(f, 0.9, 0.18, "sine", 0.7), i * 45);
      });
      return;
    }
    timerPlayLabSoundById(id);
  }

  function renderSection(title, sounds, selectedId, storageKey) {
    return `
      <div class="timer-sounds-section">
        <div class="timer-sounds-section-title">${title}</div>
        <div class="timer-lab-grid">
          ${sounds.map((s) => {
            const active = s.id === selectedId ? " timer-lab-active" : "";
            return `
              <div class="timer-lab-card${active}" data-sel-key="${storageKey}" data-sel-id="${s.id}">
                <div class="timer-lab-name">${s.name}</div>
                <div class="timer-lab-actions">
                  <button class="timer-lab-play" data-play-id="${s.id}">${ICON('play', 14)}</button>
                  <button class="timer-lab-choose" data-sel-key="${storageKey}" data-sel-id="${s.id}">Обрати</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  list.innerHTML = `
    <div style="display:flex;gap:12px;">
      <div style="flex:1;min-width:0;">
        ${renderSection("Відлік (3-2-1)", cdSounds, selCd, "timerSelCountdown")}
      </div>
      <div style="flex:1;min-width:0;">
        ${renderSection("Кінець роботи / перерви", endSounds, selEnd, "timerSelEnd")}
      </div>
      <div style="flex:1;min-width:0;">
        ${renderSection("Завершення", doneSounds, selDone, "timerSelDone")}
      </div>
    </div>
  `;

  list.querySelectorAll(".timer-lab-play").forEach((btn) => {
    btn.addEventListener("click", () => {
      playSound(btn.dataset.playId);
    });
  });

  list.querySelectorAll(".timer-lab-choose").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.selKey;
      const id = btn.dataset.selId;
      localStorage.setItem(key, id);
      list.querySelectorAll(`[data-sel-key="${key}"]`).forEach((c) => c.classList.remove("timer-lab-active"));
      btn.closest(".timer-lab-card").classList.add("timer-lab-active");
    });
  });
}

function timerLoadSoundsAndRender() {
  timerEnsureAudio();
  timerLoadCustomSounds();
  setTimeout(timerRenderSounds, 600);
}

// Два окремі вікна налаштувань: «Звуки» та «Вигляд».
// Каркас — спільний .notes-modal (розмиття + футер «Готово»), як у нотатках.
function timerOpenSettingsWindow(which) {
  // Не залишаємо «залиплих» вікон — спершу прибираємо попереднє.
  timerCloseSettingsWindow();
  const isLook = which === "look";
  const title = isLook ? "Вигляд" : "Звуки";
  const body = isLook
    ? document.getElementById("timer-lookBody").innerHTML
    : '<div id="timer-soundsList"></div>';

  const overlay = document.createElement("div");
  overlay.className = "notes-modal timer-settings-modal";
  overlay.innerHTML = `
    <div class="notes-modal-content"${isLook ? ' style="max-width: 520px;"' : ' style="max-width: 900px;"'}>
      <div class="notes-modal-header">
        <h3>${title}</h3>
        <button class="notes-modal-close" type="button">&times;</button>
      </div>
      <div class="notes-modal-body">${body}</div>
      <div class="notes-modal-footer">
        <button class="gist-btn gist-btn-primary" type="button">Готово</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }
  overlay.querySelector(".notes-modal-close").addEventListener("click", close);
  overlay.querySelector(".gist-btn-primary").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  if (isLook) timerApplyPresetsLayout();
  else timerRenderSounds();
}

function timerCloseSettingsWindow() {
  document.querySelectorAll(".timer-settings-modal").forEach((o) => o.remove());
}

function timerOpenSoundsModal() {
  timerOpenSettingsWindow("sounds");
}

function timerOpenLookModal() {
  timerOpenSettingsWindow("look");
}

function timerCloseSoundsModal(e) {
  timerCloseSettingsWindow(e);
}

function timerCelebrate() {
  const colors = ['#22c55e', '#4ac06a', '#ffd700', '#5b9cf5', '#a855f7', '#ff6b6b'];
  const bursts = 5;
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const cx = window.innerWidth * (0.2 + Math.random() * 0.6);
      const cy = window.innerHeight * (0.2 + Math.random() * 0.4);
      const count = 30;
      for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: fixed;
          width: 10px;
          height: 10px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${cx}px;
          top: ${cy}px;
          pointer-events: none;
          z-index: 2000;
          border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        `;
        document.body.appendChild(confetti);

        const angle = (Math.random() * 360) * (Math.PI / 180);
        const velocity = 5 + Math.random() * 6;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        let offsetX = 0, offsetY = 0, opacity = 1;
        const animate = () => {
          offsetX += vx;
          offsetY += vy + 2;
          opacity -= 0.015;
          confetti.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${offsetX * 10}deg)`;
          confetti.style.opacity = opacity;
          if (opacity > 0) requestAnimationFrame(animate);
          else confetti.remove();
        };
        requestAnimationFrame(animate);
      }
    }, b * 250);
  }
}

function initTimer() {
  const output = document.getElementById("output-timer");
  if (!output) return;

  function timerRender() {
  output.innerHTML = `
<div class="timer-tab">
<div class="timer-layout">
  <div class="timer-main">
  <div class="container">
  <div class="timer-section">
    <div class="phase-label idle" id="timer-phaseLabel">Таймер</div>
    <div class="time-display idle" id="timer-timeDisplay">00:00</div>
    <div class="round-info" id="timer-roundInfo"></div>
    <div class="progress-bar-container">
      <div class="progress-bar" id="timer-progressBar"></div>
    </div>
    <div class="rounds-visual" id="timer-roundsVisual"></div>
    <div class="controls">
      <button class="ctrl-btn" onclick="timerResetTimer()" title="Скинути">
        ${ICON('refreshCcw', 24)}
      </button>
      <button class="ctrl-btn primary" id="timer-playBtn" onclick="timerToggleTimer()" title="Старт">${timerPlayIconSVG}</button>
    </div>
  </div>
  </div>
  </div>

  <div class="timer-side">
    <div class="timer-actions">
      <button class="timer-sounds-btn" onclick="timerOpenSoundsModal()" title="Звуки">
        ${ICON('music', 22, { cls: 'lucide lucide-music-icon lucide-music' })}
      </button>
      <button class="timer-look-btn" onclick="timerOpenLookModal()" title="Вигляд">
        ${ICON('bolt', 22, { cls: 'lucide lucide-bolt-icon lucide-bolt' })}
      </button>
    </div>
    <div class="settings">
      <div class="settings-header">
        ${ICON('timerReset', 14, { cls: 'lucide lucide-timer-reset-icon lucide-timer-reset' })}
        <span>Налаштування</span>
        <button class="presets-add-btn" id="timer-advToggleBtn" onclick="const a=document.getElementById('timer-advancedSettings');a.classList.toggle('open');this.classList.toggle('active',a.classList.contains('open'));localStorage.setItem('timerAdvancedOpen',a.classList.contains('open'))">${ICON('chevronDown', 12, { cls: 'chevron' })}</button>
      </div>
      <div class="input-group full">
        <div class="field">
          <label>Робота</label>
          <input type="number" id="timer-workTime" value="20" min="1" max="600">
        </div>
        <div class="field">
          <label>Перерва</label>
          <input type="number" id="timer-restTime" value="10" min="0" max="600">
        </div>
        <div class="field">
          <label>Підходи</label>
          <input type="number" id="timer-rounds" value="8" min="1" max="100">
        </div>
      </div>
      <div class="advanced-settings" id="timer-advancedSettings">
        <div class="input-group full">
          <div class="field">
            <label>Початок</label>
            <input type="number" id="timer-warmupTime" value="0" min="0" max="300">
          </div>
          <div class="field">
            <label>Кінець</label>
            <input type="number" id="timer-cooldownTime" value="0" min="0" max="300">
          </div>
        </div>
      </div>
    </div>

    <div class="presets-section">
      <div class="presets-header">
        ${ICON('columns3Cog', 14, { cls: 'lucide lucide-columns3-cog-icon lucide-columns-3-cog' })}
        <span>Шаблони</span>
        <button class="presets-add-btn" id="timer-presetsAddBtn" onclick="const r=document.getElementById('timer-saveRow');if(r.classList.contains('editing')){timerCancelEdit();}else{r.classList.toggle('open');this.classList.toggle('active',r.classList.contains('open'));if(r.classList.contains('open'))document.getElementById('timer-presetName').focus();}">${ICON('plusVert', 12)}</button>
      </div>
      <div class="presets-list" id="timer-presetsList"></div>
      <div class="save-row" id="timer-saveRow">
        <div class="save-row-fields">
          <div class="save-row-input-wrap">
            <input type="text" id="timer-presetName" placeholder="Назва">
            <button class="save-row-send-btn" id="timer-saveBtn" onclick="timerSavePreset()">${ICON('save', 18, { cls: 'lucide lucide-save-icon lucide-save' })}</button>
          </div>
        </div>
      </div>

    </div>
  </div>

<div class="timer-look-body" id="timer-lookBody">
  <div class="timer-look-row">
    <span class="notes-settings-text">
      Розміщення шаблонів
      <span class="notes-settings-sub">Заповнення — шаблони в ряд; Стовпчик — один шаблон на рядок</span>
    </span>
    <div class="timer-look-toggle" id="timer-presetsLayoutToggle">
      <button class="timer-look-btn-opt" data-layout="wrap" onclick="timerSetPresetsLayout('wrap')" title="Шаблони в ряд">${ICON('layoutWrap', 12)}<span>Заповнення</span></button>
      <button class="timer-look-btn-opt" data-layout="column" onclick="timerSetPresetsLayout('column')" title="1 шаблон = 1 рядок">${ICON('layoutColumn', 12)}<span>Стовпчик</span></button>
    </div>
  </div>
</div>

</div>
`;

  ["timer-workTime", "timer-restTime", "timer-rounds", "timer-warmupTime", "timer-cooldownTime"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", timerHighlightActivePreset);
    el.addEventListener("focus", () => el.select());
  });
  document.getElementById("timer-presetName").addEventListener("keydown", timerKeyHandler);

  let _presetsClickCount = 0;
  let _presetsClickTimer = null;

  document.addEventListener("click", (e) => {
    const row = document.getElementById("timer-saveRow");
    const presetsBtn = document.getElementById("timer-presetsAddBtn");
    if (!row) return;
    if (row.contains(e.target) || e.target.closest(".presets-add-btn")) return;
    // Режим редагування «тримається», доки користувач сам не закриє його
    // (кнопка «+», Esc, збереження або клік по іншому шаблону). Інакше
    // перехід мишею до полів таймінгів скидав би редагування намертво.
    if (timerEditingPresetIndex !== null) return;
    if (e.target.closest(".presets-section") && !e.target.closest(".preset-btn")) {
      _presetsClickCount++;
      clearTimeout(_presetsClickTimer);
      if (_presetsClickCount === 1) {
        _presetsClickTimer = setTimeout(() => {
          _presetsClickCount = 0;
          row.classList.remove("open");
          presetsBtn?.classList.remove("active");
        }, 280);
      }
    } else {
      _presetsClickCount = 0;
      clearTimeout(_presetsClickTimer);
      row.classList.remove("open");
      presetsBtn?.classList.remove("active");
    }
  });

  document.querySelector(".presets-section")?.addEventListener("dblclick", (e) => {
    if (e.target.closest(".presets-add-btn") || e.target.closest(".save-row") || e.target.closest(".preset-btn")) return;
    _presetsClickCount = 0;
    clearTimeout(_presetsClickTimer);
    const r = document.getElementById("timer-saveRow");
    const btn = document.getElementById("timer-presetsAddBtn");
    if (r.classList.contains("editing")) { timerCancelEdit(); return; }
    if (r.classList.contains("open")) {
      r.classList.remove("open");
      btn?.classList.remove("active");
      return;
    }
    r.classList.add("open");
    btn?.classList.add("active");
    document.getElementById("timer-presetName").focus();
  });

  document.querySelector(".settings")?.addEventListener("dblclick", (e) => {
    if (e.target.closest("input") || e.target.closest("label") || e.target.closest("button") || e.target.closest(".advanced-settings")) return;
    const a = document.getElementById("timer-advancedSettings");
    const btn = document.getElementById("timer-advToggleBtn");
    if (!a) return;
    a.classList.toggle("open");
    btn?.classList.toggle("active", a.classList.contains("open"));
    localStorage.setItem("timerAdvancedOpen", a.classList.contains("open"));
  });

  if (!timerKeyAttached) {
    document.addEventListener("keydown", timerKeyHandler);
    timerKeyAttached = true;
  }

  timerApplyPresetsLayout();
  timerRenderPresets();
  timerRenderSounds();
  timerLoadSoundsAndRender();

  // Увімкнути авто-синхронізацію таймера з gist, якщо налаштовано
  if (typeof timerGistStorage !== 'undefined' && timerGistStorage.isEnabled()) {
    timerGistStorage.startAutoSync();
  }

  const advOpen = localStorage.getItem("timerAdvancedOpen");
  const advSettings = document.getElementById("timer-advancedSettings");
  const advBtn = document.getElementById("timer-advToggleBtn");
  if (advSettings) {
    if (advOpen === "true") {
      advSettings.classList.add("open");
      advBtn?.classList.add("active");
    } else {
      advSettings.classList.remove("open");
      advBtn?.classList.remove("active");
    }
  }
  (function applyFirstPreset() {
    const presets = timerLoadPresets();
    if (presets.length > 0) timerApplyPreset(presets[0]);
  })();
  }

  const existing = document.querySelector('link[href="timer/styles.css"]');
  if (existing && existing.sheet) {
    timerRender();
  } else if (existing) {
    existing.onload = timerRender;
    existing.onerror = timerRender;
  } else {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "timer/styles.css";
    link.onload = timerRender;
    link.onerror = timerRender;
    document.head.appendChild(link);
  }
}
