async function sha256(str) {
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str),
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256Fallback(str);
}

function sha256Fallback(message) {
  function rightRotate(v, n) { return (v >>> n) | (v << (32 - n)); }
  const msg = new TextEncoder().encode(message);
  const bitLen = msg.length * 8;
  const padLen = (56 - ((msg.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(msg.length + 1 + padLen + 8);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen, false);
  dv.setUint32(padded.length - 8, 0, false);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  for (let off = 0; off < padded.length; off += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i-15],7) ^ rightRotate(w[i-15],18) ^ (w[i-15]>>>3);
      const s1 = rightRotate(w[i-2],17) ^ rightRotate(w[i-2],19) ^ (w[i-2]>>>10);
      w[i] = (w[i-16]+s0+w[i-7]+s1)|0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25);
      const ch = (e&f)^(~e&g);
      const t1 = (h+S1+ch+K[i]+w[i])|0;
      const S0 = rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0+maj)|0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
    h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}

function isLocalNetwork() {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "")
    return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = host.match(ipv4);
  if (m) {
    const o = [m[1], m[2], m[3], m[4]].map(Number);
    if (o[0] === 10) return true;
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    if (o[0] === 192 && o[1] === 168) return true;
    if (o[0] === 169 && o[1] === 254) return true;
  }
  if (host.endsWith(".local") || host.endsWith(".lan") || host.endsWith(".intra"))
    return true;
  return false;
}

function showWaitScreen(seconds) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "login-wait";
    el.innerHTML =
      '<div>Зачекайте перед наступною спробою</div>' +
      '<div class="login-wait-timer">' + seconds + '</div>';
    document.body.appendChild(el);

    let remaining = seconds;
    const timerEl = el.querySelector(".login-wait-timer");
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        el.remove();
        resolve();
      } else {
        timerEl.textContent = remaining;
      }
    }, 1000);
  });
}

function showLoginScreen(attempts) {
  return new Promise((resolve) => {
    let pin = "";
    const PIN_LENGTH = 4;
    const MAX_ATTEMPTS = 5;

    const screen = document.createElement("div");
    screen.className = "login-screen";

    const lockIcon =
      '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

    const backspaceIcon =
      '<svg viewBox="0 0 24 24"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>';

    screen.innerHTML =
      '<div class="login-logo">' + lockIcon + "</div>" +
      '<div class="login-title">ZenithApp</div>' +
      '<div class="login-subtitle">Введіть PIN-код</div>' +
      '<div class="pin-display" id="pin-display"><div class="pin-dots-inner" id="pin-dots-inner"></div></div>' +
      '<div class="login-error" id="login-error"></div>' +
      '<div class="pin-keypad" id="pin-keypad"></div>' +
      (attempts > 0
        ? '<div class="login-attempts" id="login-attempts">Невдалих спроб: ' + attempts + "</div>"
        : "");

    document.body.appendChild(screen);

    const display = screen.querySelector("#pin-display");
    const dotsInner = screen.querySelector("#pin-dots-inner");
    const keypad = screen.querySelector("#pin-keypad");
    const errorEl = screen.querySelector("#login-error");

    for (let i = 0; i < PIN_LENGTH; i++) {
      const dot = document.createElement("div");
      dot.className = "pin-dot";
      dotsInner.appendChild(dot);
    }
    const dots = dotsInner.querySelectorAll(".pin-dot");

    function updateDots() {
      dots.forEach((d, i) => {
        d.classList.toggle("filled", i < pin.length);
        d.classList.remove("error", "success");
        d.style.animationDelay = "";
      });
    }

    function showError(msg) {
      const total = parseInt(localStorage.getItem("tab_links_attempts") || "0") + 1;
      const remaining = Math.max(0, MAX_ATTEMPTS - total);

      let hint = "";
      if (remaining > 1) {
        hint = " Залишилось спроб: " + remaining;
      } else if (remaining === 1) {
        hint = " Увага: залишилась остання спроба!";
      } else {
        hint = " Перевищено ліміт. Доступ заблоковано.";
      }
      errorEl.textContent = msg + hint;
      errorEl.classList.add("visible");

      dotsInner.classList.remove("shake");
      void dotsInner.offsetWidth;
      dotsInner.classList.add("shake");

      dotsInner.classList.remove("error-flash");
      void dotsInner.offsetWidth;
      dotsInner.classList.add("error-flash");

      dots.forEach((d, i) => {
        d.classList.remove("filled", "success");
        d.style.animationDelay = i * 0.06 + "s";
        d.classList.add("error");
      });

      const attemptsEl = screen.querySelector("#login-attempts");
      if (attemptsEl) {
        attemptsEl.textContent = "Невдалих спроб: " + total;
      } else {
        const el = document.createElement("div");
        el.className = "login-attempts";
        el.id = "login-attempts";
        el.textContent = "Невдалих спроб: " + total;
        screen.appendChild(el);
      }

      if (navigator.vibrate) navigator.vibrate(120);

      setTimeout(() => {
        dotsInner.classList.remove("shake", "error-flash");
        errorEl.classList.remove("visible");
        pin = "";
        updateDots();
      }, 900);
    }

    // Програвання готового WAV-файлу (надійно на iOS PWA/Safari).
    const _loginAudioPool = [];
    function loginGetAudioEl() {
      let el = _loginAudioPool.find((a) => a._free);
      if (!el) {
        el = new Audio();
        _loginAudioPool.push(el);
      }
      el._free = false;
      el.onended = () => { el._free = true; };
      return el;
    }

    function playLoginSound(file, volume = 1) {
      try {
        const el = loginGetAudioEl();
        el.src = file;
        el.volume = volume;
        el.currentTime = 0;
        const p = el.play();
        if (p && p.catch) p.catch(() => { el._free = true; });
        return true;
      } catch (e) {
        return false;
      }
    }

    function playSuccessSound() {
      playLoginSound("login/sounds/success.wav", 1);
    }

    // Розблокування аудіо на iOS: перший тап/клік має відбутись у межах
    // жесту користувача, інакше подальші play() (навіть з setTimeout) не грають.
    let _loginAudioUnlocked = false;
    function unlockLoginAudio() {
      if (_loginAudioUnlocked) return;
      _loginAudioUnlocked = true;
      try {
        const el = loginGetAudioEl();
        el.src = "login/sounds/success.wav";
        el.volume = 0;
        el.play().catch(() => { el._free = true; });
      } catch (e) {}
    }

    async function submitPin() {
      const hash = await sha256(pin);
      if (hash === CONFIG.secretKeyHash) {
        dots.forEach((d) => d.classList.add("success"));
        playSuccessSound();

        const overlay = document.createElement("div");
        overlay.className = "login-success-overlay";
        overlay.innerHTML =
          '<div class="login-success-check">' +
          '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' +
          "</div>";
        document.body.appendChild(overlay);

        setTimeout(() => {
          screen.classList.add("fade-out");
          setTimeout(() => {
            if (screen._cleanupKey) screen._cleanupKey();
            screen.remove();
            overlay.remove();
            resolve(true);
          }, 500);
        }, 1400);
      } else {
        const ATTEMPTS_KEY = "tab_links_attempts";
        const LAST_KEY = "tab_links_last_attempt";
        const cur = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0");
        localStorage.setItem(ATTEMPTS_KEY, cur + 1);
        localStorage.setItem(LAST_KEY, Date.now());
        showError("Невірний PIN-код");
      }
    }

    const keys = [
      { label: "1" }, { label: "2" }, { label: "3" },
      { label: "4" }, { label: "5" }, { label: "6" },
      { label: "7" }, { label: "8" }, { label: "9" },
      { label: "0", className: "key-zero" },
      { label: "", action: true, type: "backspace", className: "key-backspace" },
    ];

    keys.forEach((k) => {
      const btn = document.createElement("button");
      const cls = ["pin-key"];
      if (k.action) cls.push("key-action");
      if (k.className) cls.push(k.className);
      btn.className = cls.join(" ");

      if (k.type === "backspace") {
        btn.innerHTML = backspaceIcon;
      } else {
        btn.textContent = k.label;
      }

      btn.addEventListener("click", () => {
        unlockLoginAudio();
        if (k.type === "backspace") {
          pin = pin.slice(0, -1);
          updateDots();
        } else if (!k.action && pin.length < PIN_LENGTH) {
          pin += k.label;
          updateDots();
          if (pin.length === PIN_LENGTH) {
            setTimeout(() => submitPin(), 150);
          }
        }
      });

      keypad.appendChild(btn);
    });

    const keyHandler = function(e) {
      unlockLoginAudio();
      if (e.key >= "0" && e.key <= "9" && pin.length < PIN_LENGTH) {
        pin += e.key;
        updateDots();
        if (pin.length === PIN_LENGTH) {
          setTimeout(() => submitPin(), 150);
        }
      } else if (e.key === "Backspace") {
        pin = pin.slice(0, -1);
        updateDots();
      }
    };
    document.addEventListener("keydown", keyHandler);

    screen._cleanupKey = () => document.removeEventListener("keydown", keyHandler);
  });
}

async function checkAccess() {
  const LS_KEY = "tab_links_access";
  const ATTEMPTS_KEY = "tab_links_attempts";
  const LAST_KEY = "tab_links_last_attempt";

  // Максимальна кількість спроб до блокування
  const MAX_ATTEMPTS = 5;
  // Базова затримка (с) та множник зростання між блокуваннями
  const BASE_WAIT = 15;
  const WAIT_GROWTH = 2;

  if (CONFIG.disablePinOnLocalNetwork && isLocalNetwork()) return true;

  if (localStorage.getItem(LS_KEY) === CONFIG.secretKeyHash) return true;

  // Якщо попередня спроба вичерпала ліміт — обчислюємо решту затримки
  const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0");
  const lastAttempt = parseInt(localStorage.getItem(LAST_KEY) || "0");

  if (attempts >= MAX_ATTEMPTS && lastAttempt) {
    // Номер блокування (1-й, 2-й, …) визначає тривалість затримки
    const blockIndex = Math.floor(attempts / MAX_ATTEMPTS);
    const totalWait = BASE_WAIT * Math.pow(WAIT_GROWTH, blockIndex - 1);
    const elapsed = (Date.now() - lastAttempt) / 1000;
    const remain = Math.ceil(totalWait - elapsed);
    if (remain > 0) {
      await showWaitScreen(remain);
    }
    // Скидаємо лічильник спроб після відбуття затримки
    localStorage.setItem(ATTEMPTS_KEY, "0");
  }

  while (true) {
    const currentAttempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0");
    const result = await showLoginScreen(currentAttempts);

    if (result === true) {
      localStorage.setItem(LS_KEY, CONFIG.secretKeyHash);
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LAST_KEY);
      return true;
    }
    // Невірний PIN — спроби накопичуються у showLoginScreen/submitPin.
    // Якщо досягнуто ліміт, виходимо з циклу, щоб повернутись до блокування.
    const updated = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0");
    if (updated >= MAX_ATTEMPTS) {
      localStorage.setItem(LAST_KEY, Date.now());
      // Показуємо wait-екран одразу, доки не мине затримка
      const blockIndex = Math.floor(updated / MAX_ATTEMPTS);
      const totalWait = BASE_WAIT * Math.pow(WAIT_GROWTH, blockIndex - 1);
      await showWaitScreen(totalWait);
      localStorage.setItem(ATTEMPTS_KEY, "0");
    }
  }
}