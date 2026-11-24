/* ========== TABATA TIMER (TAB) ========== */

let timerTimer = null;
let timerRunning = false;
let timerPaused = false;
let timerTotalSeconds = 0;
let timerCurrentSeconds = 0;
let timerPhase = "idle"; // idle, warmup, work, rest, cooldown, done
let timerPhaseIndex = -1;
let timerPhaseEndTime = 0; // реальний timestamp (мс) завершення поточної фази
let timerCurrentRound = 0;
let timerTotalRounds = 8;
let timerEditingPresetIndex = null;
let timerDragSrcIndex = null;
let timerPresetCtxMenu = null;

/* ---------- Web Worker: точний метроном у фоні ----------
 * Браузери (особливо iOS Safari) сильно душать setInterval у
 * видимому документі, коли вкладка згорнута/екран погашено, через
 * що звук спотворювався. Worker не прив'язаний до visibility
 * вкладки й тримає таймінг рівніше навіть у фоні. */
let timerWorker = null;

function timerEnsureWorker() {
  if (timerWorker) return timerWorker;
  try {
    timerWorker = new Worker("timer/timer-worker.js");
    timerWorker.onmessage = (e) => timerWorkerOnMessage(e.data);
  } catch (err) {
    timerWorker = null; // фолбек на звичайний setInterval
  }
  return timerWorker;
}

function timerWorkerOnMessage(msg) {
  if (!msg) return;
  if (msg.type === "beep") {
    if (timerRunning && !timerPaused && timerPhase !== "idle" && timerPhase !== "done") {
      timerPlayCountdownBeep(msg.sec);
    }
  } else if (msg.type === "tick") {
    timerCurrentSeconds = msg.remaining;
    if (timerCurrentSeconds <= 0) return; // phaseEnd обробить перехід
    const pct = timerTotalSeconds > 0
      ? ((timerTotalSeconds - timerCurrentSeconds) / timerTotalSeconds) * 100
      : 0;
    const { progressBar } = timerGetUI();
    if (progressBar && timerTotalSeconds > 0) {
      progressBar.style.width = pct + "%";
      if (timerPhase === "work") progressBar.style.background = "#00e676";
      else if (timerPhase === "rest") progressBar.style.background = "#ff9100";
      else if (timerPhase === "warmup") progressBar.style.background = "#ffea00";
      else if (timerPhase === "cooldown") progressBar.style.background = "#448aff";
    }
    timerUpdateDisplay();
  } else if (msg.type === "phaseEnd") {
    timerAdvancePhase();
  }
}

/* ---------- Wake Lock: не даємо екрану гаснути під час роботи таймера ---------- */
let timerWakeLock = null;

async function timerAcquireWakeLock() {
  // Підтримується в Safari iOS 16.4+ (та інших сучасних браузерах).
  if (!("wakeLock" in navigator)) return;
  if (timerWakeLock) return; // вже утримуємо
  try {
    timerWakeLock = await navigator.wakeLock.request("screen");
    timerWakeLock.addEventListener("release", () => {
      timerWakeLock = null;
    });
  } catch (e) {
    // напр. вкладка не активна або відмова системи — тихо ігноруємо
    timerWakeLock = null;
  }
}

async function timerReleaseWakeLock() {
  if (!timerWakeLock) return;
  try {
    await timerWakeLock.release();
  } catch (e) {}
  timerWakeLock = null;
}

// Керуємо Wake Lock: iOS відпускає його при згортанні, тож
// при поверненні перезапитуємо, якщо таймер активно тікає.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (timerRunning && !timerPaused) {
      // Worker тримав точний таймінг у фоні; при поверненні лише
      // синхронізуємо екран за реальним часом і перезапитуємо Wake Lock.
      timerCurrentSeconds = Math.max(0, Math.round((timerPhaseEndTime - Date.now()) / 1000));
      timerUpdateDisplay();
      timerAcquireWakeLock();
    }
  }
});

const TimerAudioCtx = window.AudioContext || window.webkitAudioContext;
let timerAudioCtx;

function timerEnsureAudio() {
  if (!timerAudioCtx) timerAudioCtx = new TimerAudioCtx();
  if (timerAudioCtx.state === "suspended") timerAudioCtx.resume();
}

/* ---------- iOS-сумісне відтворення звуку ---------- */
/* На iPhone Web Audio (AudioContext) часто лишається suspended і мовчить,
   тому тон генеруємо як WAV у пам'яті й граємо через <audio>.play(),
   що надійно прокидає аудіосесію в iOS PWA / Safari. */

const _timerBeepCache = {};
function timerToneWavUrl(freq, duration, volume = 0.3, type = "sine") {
  const key = `${freq}|${duration}|${volume}|${type}`;
  if (_timerBeepCache[key]) return _timerBeepCache[key];
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const edge = Math.min(0.01, duration / 2);
    let env = 1;
    if (t < edge) env = t / edge;
    else if (t > duration - edge) env = Math.max(0, (duration - t) / edge);
    let s;
    if (type === "square") s = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
    else if (type === "triangle") s = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
    else if (type === "sawtooth") s = 2 * ((freq * t) % 1) - 1;
    else s = Math.sin(2 * Math.PI * freq * t);
    const v = Math.max(-1, Math.min(1, s * volume * env));
    view.setInt16(44 + i * 2, v * 32767, true);
  }
  const url = URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
  _timerBeepCache[key] = url;
  return url;
}

// Спільний пул <audio> елементів для паралельного програвання тонів.
const _timerAudioPool = [];
function timerGetAudioEl() {
  let el = _timerAudioPool.find((a) => a._free);
  if (!el) {
    el = new Audio();
    _timerAudioPool.push(el);
  }
  el._free = false;
  el.onended = () => { el._free = true; };
  return el;
}

function timerPlayAudioUrl(url, volume = 1) {
  try {
    const el = timerGetAudioEl();
    el.src = url;
    el.volume = volume;
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => { el._free = true; });
    return true;
  } catch (e) {
    return false;
  }
}

function timerPlayBeep(freq, duration, volume = 0.3, type = "sine", release = 0) {
  timerEnsureAudio();
  // Граємо через <audio> (надійно на iOS). Web Audio — лише fallback.
  if (timerPlayAudioUrl(timerToneWavUrl(freq, duration, volume, type), 1)) return;
  try {
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
  } catch (e) {}
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
    const dur = Math.max((note.duration / 1000) - rel, 0.04);
    const url = timerToneWavUrl(note.freq, dur, note.volume, note.type || s.type || "sine");
    const delay = note.delay || 0;
    setTimeout(() => {
      try {
        timerPlayAudioUrl(url, 1);
      } catch (e) {}
    }, delay);
  });
  return true;
}

function timerPlayCountdownBeep(sec) {
  // Якщо фаза коротша за 3 секунди (робота/перерва/підхід/початок/кінець
  // = 3с), граємо лише 2 останні відліки (2-1), а не 3-2-1.
  if (sec === 3 && timerTotalSeconds <= 3) return;
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
  timerStopWorker();
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
  // Засікаємо реальний час завершення фази, щоб фонові затримки
  // (згорнута вкладка, заблокований екран) не зсували таймер.
  timerPhaseEndTime = Date.now() + timerTotalSeconds * 1000;
  const { roundsVisual } = timerGetUI();
  if (roundsVisual) roundsVisual.classList.remove("lite");
  timerBuildRoundDots();
  timerUpdateDisplay();
}

/* ---------- Керування фоновим метрономом (Worker) ---------- */

function timerStartWorkerPhase() {
  const w = timerEnsureWorker();
  timerPhaseEndTime = Date.now() + timerCurrentSeconds * 1000;
  if (w) {
    w.postMessage({ type: "start", duration: timerCurrentSeconds, total: timerTotalSeconds, endAt: timerPhaseEndTime });
  } else {
    // Фолбек: звичайний setInterval (менш надійний у фоні).
    clearInterval(timerTimer);
    timerTimer = setInterval(timerTick, 1000);
  }
}

function timerPauseWorker() {
  const w = timerEnsureWorker();
  if (w) w.postMessage({ type: "pause" });
  else clearInterval(timerTimer);
}

function timerResumeWorkerPhase() {
  const w = timerEnsureWorker();
  timerPhaseEndTime = Date.now() + timerCurrentSeconds * 1000;
  if (w) {
    w.postMessage({ type: "resume", duration: timerCurrentSeconds, total: timerTotalSeconds, endAt: timerPhaseEndTime });
  } else {
    clearInterval(timerTimer);
    timerTimer = setInterval(timerTick, 1000);
  }
}

function timerStopWorker() {
  const w = timerEnsureWorker();
  if (w) w.postMessage({ type: "stop" });
  else clearInterval(timerTimer);
}

function timerTick() {
  // Рахуємо залишок за РЕАЛЬНИМ часом, а не за кількістю тиків.
  // Це рятує від «повільного/зміненого» таймера у фоні: коли вкладка
  // згорнута, браузер заморожує setInterval і пропускає тики, тож
  // відлік «-1 за тік» починав плисти й звуки зсувалися.
  const remaining = Math.round((timerPhaseEndTime - Date.now()) / 1000);
  timerCurrentSeconds = Math.max(0, remaining);
  const s = timerGetSettings();

  if (timerCurrentSeconds <= 3 && timerCurrentSeconds > 0 && timerPhase !== "idle" && timerPhase !== "done") {
    if (!(timerCurrentSeconds === 3 && timerTotalSeconds <= 3)) {
      timerPlayCountdownBeep(timerCurrentSeconds);
    }
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
    timerStopWorker();
    timerRunning = false;
    timerPaused = false;
    timerReleaseWakeLock();
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
  // Нова фаза стартує від поточного реального часу: якщо попередня
  // фаза завершилась у фоні (тики пропущені), ми не «наздоганяємо»
  // пропущений час, а просто продовжуємо таймер звідси.
  timerPhaseEndTime = Date.now() + timerTotalSeconds * 1000;
  timerUpdateDisplay();
  // Запускаємо/перезапускаємо фоновий метроном для нової фази.
  if (timerRunning && !timerPaused) timerStartWorkerPhase();
}

const timerPlayIconSVG = ICON('play', 24);
const timerPauseIconSVG = ICON('pause', 24);

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

    timerStartWorkerPhase();
    timerAcquireWakeLock();
  } else if (timerPaused) {
    timerPaused = false;
    playBtn.innerHTML = timerPauseIconSVG;
    // Відновлюємо відлік від РЕАЛЬНОГО часу: залишок (timerCurrentSeconds)
    // не змінився за час паузи, тож просто засікаємо новий час завершення.
    timerResumeWorkerPhase();
    timerUpdateDisplay();
    timerAcquireWakeLock();
  } else {
    timerPaused = true;
    playBtn.innerHTML = timerPlayIconSVG;
    timerPauseWorker();
    timerUpdateDisplay();
    timerReleaseWakeLock();
  }
}

function timerResetTimer() {
  clearInterval(timerTimer);
  timerStopWorker();
  timerReleaseWakeLock();
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
  if (typeof timerGistStorage !== "undefined" && timerGistStorage.isEnabled()) {
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

  const { activeIndex, dups } = timerGetPresetHighlightState(presets);

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

    btn.onclick = (e) => {
      // Після довгого натискання синтетичний клік не має застосувати шаблон.
      if (btn.timerLongPressFired?.()) {
        e.preventDefault();
        return;
      }
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
      // Меню вже відкрите довгим натисканням — не відкриваємо другий раз.
      if (btn.timerLongPressFired?.()) {
        e.preventDefault();
        return;
      }
      timerShowPresetContextMenu(e, i);
    };

    timerBindPresetLongPress(btn, i);

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
  event.preventDefault?.();
  event.stopPropagation?.();

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

// Довге натискання на шаблон відкриває те саме меню, що й ПКМ на десктопі.
// Після спрацювання треба «ковтнути» синтетичний click/touchend, інакше
// браузер одразу закриє щойно відкрите меню.
function timerOpenPresetMenuAt(x, y, index) {
  timerShowPresetContextMenu({ clientX: x, clientY: y }, index);
  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 400);
}

function timerBindPresetLongPress(btn, index) {
  let timer = null;
  let origin = null;
  let fired = false;

  btn.timerLongPressFired = () => fired;

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    origin = null;
  };

  btn.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      fired = false;
      origin = { x: t.clientX, y: t.clientY };
      clearTimeout(timer);
      timer = setTimeout(() => {
        const at = origin;
        clear();
        fired = true;
        timerOpenPresetMenuAt(at ? at.x : 0, at ? at.y : 0, index);
      }, 500);
    },
    { passive: true }
  );

  btn.addEventListener(
    "touchmove",
    (e) => {
      if (!origin) return;
      const t = e.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - origin.x) > 10 || Math.abs(t.clientY - origin.y) > 10) clear();
    },
    { passive: true }
  );

  btn.addEventListener("touchend", (e) => {
    clear();
    if (fired) e.preventDefault();
  });

  btn.addEventListener("touchcancel", clear);
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
    timerFocusPresetName();
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

function timerFocusPresetName() {
  const el = document.getElementById("timer-presetName");
  if (!el) return;
  requestAnimationFrame(() => {
    el.focus({ preventScroll: true });
    el.select();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

// Фокус ставимо на перше поле таймінгу — там одразу видно, що саме воно
// редагується, і значення можна перезаписати не торкаючись назви.
function timerFocusFirstTimingField() {
  const el = document.getElementById("timer-workTime");
  if (!el) return;
  el.focus({ preventScroll: true });
  el.select();
  el.scrollIntoView({ block: "center", behavior: "smooth" });
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
  document.getElementById("timer-presetName").value = "";
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
// Прапорець: важкий HTML-рендер таймера (і глобальні слухачі) будуємо
// лише один раз. Повторні відкриття вкладки лише оновлюють дані —
// це прибирає «підлагування» при перемиканні на Таймер.
let _timerDOMBuilt = false;

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

   const esc = (s) => String(s)
     .replace(/&/g, "&amp;").replace(/</g, "&lt;")
     .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

   function fieldHTML(title, sounds, selectedId, storageKey) {
     const opts = sounds.map((s) =>
       `<option value="${esc(s.id)}"${s.id === selectedId ? " selected" : ""}>${esc(s.name)}</option>`
     ).join("");
     return `
       <div class="timer-sound-field">
         <label class="timer-sound-label">${esc(title)}</label>
         <div class="timer-sound-controls">
           <select class="timer-sound-select" data-sel-key="${esc(storageKey)}">
             ${opts}
           </select>
           <button class="timer-sound-play" type="button" title="Прослухати" aria-label="Прослухати">
              ${ICON('play', 16, { fill: 'currentColor' })}
           </button>
         </div>
       </div>
     `;
    }

    list.innerHTML = `
     <div class="timer-sounds-fields">
        ${fieldHTML("Відлік (3-2-1)", cdSounds, selCd, "timerSelCountdown")}
        ${fieldHTML("Кінець роботи / перерви", endSounds, selEnd, "timerSelEnd")}
        ${fieldHTML("Завершення", doneSounds, selDone, "timerSelDone")}
    `;

   list.querySelectorAll(".timer-sound-field").forEach((field) => {
     const select = field.querySelector(".timer-sound-select");
     const playBtn = field.querySelector(".timer-sound-play");
     select.addEventListener("change", () => {
       localStorage.setItem(select.dataset.selKey, select.value);
     });
     playBtn.addEventListener("click", () => {
       playSound(select.value);
     });
   });
 }

 function timerLoadSoundsAndRender() {
   timerEnsureAudio();
   timerLoadCustomSounds();
   setTimeout(timerRenderSounds, 600);
 }

function timerOpenSoundsModal() {
  timerOpenSettingsWindow('sounds');
}

function timerOpenLookModal() {
  timerOpenSettingsWindow('look');
}

// Два окремі вікна налаштувань: «Звуки» та «Вигляд».
// Каркас — спільний .notes-modal (розмиття + футер «Готово»), як у нотатках.
function timerOpenSettingsWindow(which) {
  timerCloseSettingsWindow();
  const isLook = which === 'look';
  const title = isLook ? 'Вигляд' : 'Звуки';
  const body = isLook
    ? document.getElementById('timer-lookBody').innerHTML
    : '<div id="timer-soundsList"></div>';

  const overlay = document.createElement('div');
  overlay.className = 'notes-modal timer-settings-modal';
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
  overlay.querySelector('.notes-modal-close').addEventListener('click', close);
  overlay.querySelector('.gist-btn-primary').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  if (isLook) timerApplyPresetsLayout();
  else timerRenderSounds();
}

function timerCloseSettingsWindow() {
  document.querySelectorAll('.timer-settings-modal').forEach((o) => o.remove());
}

function timerCloseSoundsModal() {
  timerCloseSettingsWindow();
  const btn = document.querySelector('.header-button-right .timer-sounds-inline');
  if (btn) btn.classList.remove('is-active');
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

  if (typeof timerGistStorage !== "undefined" && timerGistStorage.isEnabled()) {
    timerGistStorage.startAutoSync();
  }

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

  <div class="timer-side-col">
  <div class="timer-side">
    <button class="timer-sounds-btn" onclick="timerOpenSoundsModal()" title="Звуки">
      ${ICON('bolt', 24)}
    </button>
    <div class="settings">
      <div class="settings-header">
        ${ICON('timerReset', 14)}
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

    <button class="timer-sounds-inline page-action-btn" onclick="timerOpenSoundsModal()" title="Звуки">
        ${ICON('music', 20)}
      </button>
      <button class="timer-look-inline page-action-btn" onclick="timerOpenLookModal()" title="Вигляд">
        ${ICON('bolt', 20)}
      </button>
    </div>
  </div>

  <div class="presets-section">
    <div class="presets-header">
      ${ICON('columns3Cog', 14)}
      <span>Шаблони</span>
      <button class="presets-add-btn" id="timer-presetsAddBtn" onclick="const r=document.getElementById('timer-saveRow');if(r.classList.contains('editing')){timerCancelEdit();}else{r.classList.toggle('open');this.classList.toggle('active',r.classList.contains('open'));if(r.classList.contains('open'))timerFocusPresetName();}">${ICON('plusVert', 12)}</button>
    </div>
    <div class="presets-list" id="timer-presetsList"></div>
    <div class="save-row" id="timer-saveRow">
      <div class="save-row-fields">
        <div class="save-row-input-wrap">
          <input type="text" id="timer-presetName" placeholder="Назва">
          <button class="save-row-send-btn" id="timer-saveBtn" onclick="timerSavePreset()">${ICON('save', 18)}</button>
          </div>
        </div>
      </div>

  </div>
  </div>


</div>
`;

  ["timer-workTime", "timer-restTime", "timer-rounds", "timer-warmupTime", "timer-cooldownTime"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", timerHighlightActivePreset);
    el.addEventListener("focus", () => {
      el.select();
      const scroll = () => el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", scroll, { once: true });
        setTimeout(scroll, 400);
      } else {
        setTimeout(scroll, 300);
      }
    });
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
    timerFocusPresetName();
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

   // iOS: розблокувати аудіосесію на перший жест (потрібно для standalone/PWA)
   const _unlock = () => timerEnsureAudio();
   ["touchstart", "click", "keydown"].forEach((ev) =>
     document.addEventListener(ev, _unlock, { once: true, passive: true })
   );

  timerApplyPresetsLayout();
  timerRenderPresets();
  timerRenderSounds();
  timerLoadSoundsAndRender();

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
    // Застосовуємо перший пресет лише якщо таймер ще не запущений —
    // інакше перемикання вкладки обнулювало б поточний сеанс.
    if (timerRunning || timerPaused) return;
    const presets = timerLoadPresets();
    if (presets.length > 0) timerApplyPreset(presets[0]);
  })();
  // На мобільному кнопку «Звуки» (налаштування) переносимо у заголовок
  // сторінки (як на вкладках Завдання/Нотатки). На десктопі вона лишається
  // у бічній панелі (.settings), звідки її не чіпаємо.
  const timerSoundsInline = output.querySelector('.timer-sounds-inline');
  const timerLookInline = output.querySelector('.timer-look-inline');
  const timerHeaderBtns = [timerSoundsInline, timerLookInline].filter(Boolean);
  if (typeof MobileHeader !== 'undefined') MobileHeader.inject(output, 'Таймер', timerHeaderBtns.length ? timerHeaderBtns : undefined);
  }

  // Будуємо важкий DOM (innerHTML + глобальні слухачі) лише один раз.
  // Наступні відкриття вкладки не перебудовують UI — це робить
  // перемикання на Таймер миттєвим і не дублює слухачі подій.
  function ensureTimerDOM() {
    if (_timerDOMBuilt) return;
    _timerDOMBuilt = true;
    timerRender();
  }

  const builtBefore = _timerDOMBuilt;

  const existing = document.querySelector('link[href="css/pages/timer.css"]');
  if (existing && existing.sheet) {
    ensureTimerDOM();
  } else if (existing) {
    const prevOnload = existing.onload;
    const activateAndBuild = () => {
      if (existing.media !== "all") existing.media = "all";
      ensureTimerDOM();
    };
    existing.onload = () => { if (prevOnload) prevOnload(); activateAndBuild(); };
    existing.onerror = activateAndBuild;
  } else {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/pages/timer.css";
    link.onload = ensureTimerDOM;
    link.onerror = ensureTimerDOM;
    document.head.appendChild(link);
  }

  // Якщо DOM уже збудовано (повторне відкриття вкладки) — лише
  // дешево оновлюємо дані (шаблони/звуки/стан налаштувань), без
  // повного перерендеру. Повний рендер на першому відкритті сам
  // викликає ці оновлення всередині timerRender().
  if (builtBefore && _timerDOMBuilt) {
    timerRenderPresets();
    timerRenderSounds();
    timerLoadSoundsAndRender();
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
    const presets = timerLoadPresets();
    if (presets.length > 0 && !timerRunning && !timerPaused) timerApplyPreset(presets[0]);
    const timerSoundsInline = output.querySelector('.timer-sounds-inline');
    const timerLookInline = output.querySelector('.timer-look-inline');
    const timerHeaderBtns = [timerSoundsInline, timerLookInline].filter(Boolean);
    if (typeof MobileHeader !== "undefined") MobileHeader.inject(output, "Таймер", timerHeaderBtns.length ? timerHeaderBtns : undefined);
  }
}
