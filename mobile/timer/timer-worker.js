/* ========== TABATA TIMER WORKER ==========
 * Точний метроном у фоновому потоці. Браузери (особливо iOS Safari)
 * сильно душать setInterval у видимому документі, коли вкладка
 * згорнута/екран погашено, тому тримаємо відлік тут. Worker не
 * прив'язаний до visibility вкладки й тримає таймінг значно рівніше.
 *
 * Протокол повідомлень:
 *   -> {type:'start', duration, endAt}  почати фазу (duration сек, endAt = Date.now()+duration*1000)
 *   -> {type:'pause'}                   поставити на паузу (зберігає залишок)
 *   -> {type:'resume', duration, endAt} продовжити фазу
 *   -> {type:'stop'}                    зупинити
 *   <- {type:'tick', remaining}         раз на секунду (реальний залишок)
 *   <- {type:'beep', sec}               залишок дорівнює sec (3/2/1) — грати біп
 *   <- {type:'phaseEnd'}                фаза завершилась (час вийшов)
 */

let endAt = 0;
let duration = 0;
let total = 0;
let paused = false;
let lastBeepSec = null;
let intervalId = null;

function clearTick() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function remainingNow() {
  return Math.max(0, Math.round((endAt - Date.now()) / 1000));
}

function loop() {
  if (paused) return;
  const remaining = remainingNow();

  // Сигналимо біп для останніх 3 секунд лише один раз на кожну секунду.
  // Якщо фаза коротша за 3с — граємо лише 2 останні відліки (2-1).
  if (remaining > 0 && remaining <= 3 && !(remaining === 3 && total <= 3)) {
    if (remaining !== lastBeepSec) {
      lastBeepSec = remaining;
      postMessage({ type: "beep", sec: remaining });
    }
  }

  postMessage({ type: "tick", remaining });

  if (remaining <= 0) {
    clearTick();
    postMessage({ type: "phaseEnd" });
  }
}

onmessage = function (e) {
  const msg = e.data || {};
  switch (msg.type) {
    case "start":
    case "resume":
      duration = msg.duration;
      total = msg.total;
      endAt = msg.endAt;
      paused = false;
      lastBeepSec = null;
      clearTick();
      // Одразу один тік, щоб UI не чекав секунду.
      loop();
      intervalId = setInterval(loop, 250);
      break;
    case "pause":
      paused = true;
      clearTick();
      break;
    case "stop":
      paused = true;
      endAt = 0;
      duration = 0;
      total = 0;
      lastBeepSec = null;
      clearTick();
      break;
  }
};

