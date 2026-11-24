/* ========== UI TOOLS FUNCTIONS ========== */

// These functions expect the following globals from the main file:
// - habits (array of habit objects)
// - draggedHabitId (ID of habit being dragged)
// - saveHabits() (function)
// - renderHabits() (function)

// ========== TOOLTIP FUNCTIONS ==========

function createTooltip() {
  let tooltip = document.querySelector('.custom-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showTooltip(text, x, y) {
  const tooltip = createTooltip();
  tooltip.textContent = text;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  tooltip.classList.add('visible');
}

function hideTooltip() {
  const tooltip = document.querySelector('.custom-tooltip');
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

// ========== SOUND FUNCTIONS ==========

function playSuccessSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const frequencies = [523.25, 659.25, 783.99];
  frequencies.forEach((freq, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    const startTime = audioContext.currentTime + (index * 0.1);
    gainNode.gain.setValueAtTime(0.2, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  });
}

function playUncheckSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const frequencies = [783.99, 659.25, 523.25];
  frequencies.forEach((freq, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    const startTime = audioContext.currentTime + (index * 0.1);
    gainNode.gain.setValueAtTime(0.2, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  });
}

function playSkipSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  const frequencies = [392.00, 349.23, 329.63];
  frequencies.forEach((freq, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = freq;
    oscillator.type = 'sine';
    
    const startTime = audioContext.currentTime + (index * 0.1);
    gainNode.gain.setValueAtTime(0.15, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  });
}

// ========== VISUAL EFFECTS ==========

function createConfetti(x, y) {
  const colors = ['#5b9cf5', '#4ac06a', '#ffd700', '#ff6b6b', '#a855f7'];
  const confettiCount = 30;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      z-index: 1000;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
    `;
    
    document.body.appendChild(confetti);
    
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = 5 + Math.random() * 5;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    let offsetX = 0;
    let offsetY = 0;
    let opacity = 1;
    
    const animate = () => {
      offsetX += vx;
      offsetY += vy + 2;
      opacity -= 0.02;
      
      confetti.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${offsetX * 10}deg)`;
      confetti.style.opacity = opacity;
      
      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        confetti.remove();
      }
    };
    
    requestAnimationFrame(animate);
  }
}

function createSkipParticles(x, y) {
  const colors = ['#f85149', '#ff6b6b', '#cc3b33', '#e5534b'];
  const particleCount = 20;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      z-index: 1000;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
    `;
    
    document.body.appendChild(particle);
    
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = 3 + Math.random() * 4;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    let offsetX = 0;
    let offsetY = 0;
    let opacity = 1;
    let rotation = 0;
    
    const animate = () => {
      offsetX += vx;
      offsetY += vy + 3;
      rotation += 10;
      opacity -= 0.025;
      
      particle.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;
      particle.style.opacity = opacity;
      
      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    
    requestAnimationFrame(animate);
  }
}

// ========== DRAG AND DROP HANDLERS ==========

function handleHabitDragStart(event) {
  const handle = event.target.closest('.habit-drag-handle');
  const card = handle ? handle.closest('.habit') : event.target.closest('.habit');
  if (!card) return;
  draggedHabitId = parseInt(card.dataset.habitId);
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
}

function handleHabitDragEnd(event) {
  const card = event.target.closest('.habit');
  if (card) {
    card.classList.remove('dragging');
  }
  document.querySelectorAll('.habit').forEach(c => {
    c.classList.remove('drag-over');
  });
}

function handleHabitDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const card = event.target.closest('.habit');
  if (card && parseInt(card.dataset.habitId) !== draggedHabitId) {
    card.classList.add('drag-over');
  }
}

function handleHabitDragLeave(event) {
  const card = event.target.closest('.habit');
  if (card) {
    card.classList.remove('drag-over');
  }
}

function handleHabitDrop(event) {
  event.preventDefault();
  const card = event.target.closest('.habit');
  if (!card) return;

  const targetHabitId = parseInt(card.dataset.habitId);
  if (targetHabitId === draggedHabitId) return;

  const draggedIndex = habits.findIndex(h => h.id === draggedHabitId);
  const targetIndex = habits.findIndex(h => h.id === targetHabitId);

  if (draggedIndex !== -1 && targetIndex !== -1) {
    const [draggedHabit] = habits.splice(draggedIndex, 1);
    habits.splice(targetIndex, 0, draggedHabit);
    saveHabits();
    scheduleRenderHabits();
  }

  draggedHabitId = null;
}

// ========== HOVER FUNCTIONS ==========

const LONG_PRESS_DELAY = 500; // ms

function setupHoverListeners() {
  const heatmaps = document.querySelectorAll('.heatmap');
  heatmaps.forEach(heatmap => {
    if (heatmap._hoverBound) return;
    heatmap._hoverBound = true;
    let hoveredCell = null;
    let longPressTimer = null;
    let longPressStartX = 0;
    let longPressStartY = 0;

    // Long press handlers (both mouse and touch)
    function startLongPress(cell) {
      if (cell.classList.contains('padding')) return;
      
      longPressTimer = setTimeout(() => {
        const habitId = parseInt(cell.getAttribute('data-habit-id'));
        const dateStr = cell.getAttribute('data-date-raw');
        if (habitId && dateStr && typeof toggleNote === 'function') {
          // Visual feedback
          cell.classList.add('long-press');
          setTimeout(() => cell.classList.remove('long-press'), 200);
          
          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(10);
          
          // Open note editor
          toggleNote(habitId, dateStr, { clientX: longPressStartX, clientY: longPressStartY });
        }
      }, LONG_PRESS_DELAY);
    }

    function cancelLongPress() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    // Mouse events
    heatmap.addEventListener('mousedown', (e) => {
      // Only start long press on left click (button 0)
      if (e.button !== 0) return;
      // Shift+тягнення — це масове відмічання, а не нотатка.
      if (e.shiftKey) return;
      const cell = e.target.closest('.cell');
      if (cell) {
        longPressStartX = e.clientX;
        longPressStartY = e.clientY;
        startLongPress(cell);
      }
    });

    heatmap.addEventListener('mousemove', (e) => {
      if (longPressTimer && (Math.abs(e.clientX - longPressStartX) > 8 || Math.abs(e.clientY - longPressStartY) > 8)) {
        cancelLongPress();
      }
    });

    heatmap.addEventListener('mouseup', cancelLongPress);
    // Don't cancel on mouseleave - allow hold on cell

    // Touch events
    heatmap.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.cell');
      if (cell && heatmap.contains(cell)) {
        longPressStartX = touch.clientX;
        longPressStartY = touch.clientY;
        startLongPress(cell);
      }
    }, { passive: true });

    heatmap.addEventListener('touchmove', (e) => {
      if (longPressTimer) {
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - longPressStartX) > 8 || Math.abs(touch.clientY - longPressStartY) > 8) {
          cancelLongPress();
        }
      }
    }, { passive: true });
    heatmap.addEventListener('touchend', cancelLongPress);
    heatmap.addEventListener('touchcancel', cancelLongPress);

    heatmap.addEventListener('mousemove', (e) => {
      // Знаходимо клітинку під курсором одним викликом elementFromPoint
      // замість getBoundingClientRect на кожній клітинці (layout thrash).
      const target = e.target;
      const closestCell = target && target.closest ? target.closest('.cell') : null;
      if (!closestCell || !heatmap.contains(closestCell)) return;

      // Прибираємо hover з попередньої клітинки
      if (hoveredCell && hoveredCell !== closestCell) {
        const isHoveredActive = hoveredCell.classList.contains('active');
        if (!isHoveredActive) {
          hoveredCell.style.removeProperty('border-color');
        }
        hoveredCell.style.removeProperty('transform');
        hoveredCell.style.removeProperty('z-index');
        hoveredCell.style.removeProperty('position');
      }

      // Додаємо hover до нової клітинки
      if (closestCell && closestCell !== hoveredCell) {
        const isClosestActive = closestCell.classList.contains('active');
        // Червоний бордер лише для справжніх «пропущено» (хороші звички).
        // Для шкідливих звичок клас skipped = «чисто» — фарбуємо кольором категорії.
        const isClosestSkipped = closestCell.dataset.skipped === 'true';
        const isClosestClean = closestCell.dataset.clean === 'true';
        if (!isClosestActive) {
          if (isClosestSkipped) {
            closestCell.style.borderColor = '#f85149';
          } else if (isClosestClean) {
            const catColor = closestCell.style.getPropertyValue('--category-color');
            closestCell.style.borderColor = catColor || '#8b949e';
          } else {
            closestCell.style.borderColor = '#8b949e';
          }
        }
        closestCell.style.transform = 'scale(1.2)';
        closestCell.style.zIndex = '10';
        closestCell.style.position = 'relative';
        hoveredCell = closestCell;

        // Показуємо кастомний tooltip (дата + нотатка)
        const cellRect = closestCell.getBoundingClientRect();
        const dateStr = closestCell.getAttribute('data-date');
        const note = closestCell.getAttribute('data-note');
        let tooltipText = dateStr || '';
        if (note) {
          tooltipText += '\n' + note;
        }
        if (tooltipText) {
          showTooltip(tooltipText, cellRect.left + cellRect.width / 2, cellRect.top);
        }
      }
    });

    heatmap.addEventListener('mouseleave', () => {
      if (hoveredCell) {
        const isHoveredActive = hoveredCell.classList.contains('active');
        if (!isHoveredActive) {
          hoveredCell.style.removeProperty('border-color');
        }
        hoveredCell.style.removeProperty('transform');
        hoveredCell.style.removeProperty('z-index');
        hoveredCell.style.removeProperty('position');
        hoveredCell = null;
      }
      // Ховаємо кастомний tooltip
      hideTooltip();
    });
  });
}

// Відновлює hover-стиль на клітинці після перерендерингу.
// habitId + dateStr дозволяють працювати лише з однією цільовою клітинкою
// (без обходу всіх клітинок з getBoundingClientRect — layout thrash).
function restoreHover(mouseX, mouseY, habitId, dateStr) {
  let targetCell = null;

  if (habitId != null && dateStr != null) {
    const card = document.querySelector(`.habit[data-habit-id="${habitId}"]`);
    if (card) {
      targetCell = card.querySelector(`.cell[data-date-raw="${dateStr}"]`);
    }
  } else {
    // Fallback: стара поведінка (обхід), якщо не передано цільову клітинку.
    let heatmaps;
    if (habitId != null) {
      const card = document.querySelector(`.habit[data-habit-id="${habitId}"]`);
      heatmaps = card ? card.querySelectorAll('.heatmap') : [];
    } else {
      heatmaps = document.querySelectorAll('.heatmap');
    }

    heatmaps.forEach(heatmap => {
      const rect = heatmap.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        const cells = heatmap.querySelectorAll('.cell');
        if (cells.length === 0) return;

        let closestCell = null;
        let closestDistance = Infinity;
        const localMouseX = mouseX - rect.left;
        const localMouseY = mouseY - rect.top;

        cells.forEach(cell => {
          const cellRect = cell.getBoundingClientRect();
          const cellX = cellRect.left - rect.left + cellRect.width / 2;
          const cellY = cellRect.top - rect.top + cellRect.height / 2;
          const distance = Math.sqrt(Math.pow(localMouseX - cellX, 2) + Math.pow(localMouseY - cellY, 2));
          if (distance < closestDistance) {
            closestDistance = distance;
            closestCell = cell;
          }
        });

        if (closestCell && closestDistance < 20) {
          targetCell = closestCell;
        }
      }
    });
  }

  if (!targetCell) return;

  const isClosestActive = targetCell.classList.contains('active');
  const isClosestSkipped = targetCell.dataset.skipped === 'true';
  const isClosestClean = targetCell.dataset.clean === 'true';
  if (!isClosestActive) {
    if (isClosestSkipped) {
      targetCell.style.borderColor = '#f85149';
    } else if (isClosestClean) {
      const catColor = targetCell.style.getPropertyValue('--category-color');
      targetCell.style.borderColor = catColor || '#8b949e';
    } else {
      targetCell.style.borderColor = '#8b949e';
    }
  }
  targetCell.style.transform = 'scale(1.2)';
  targetCell.style.zIndex = '10';
  targetCell.style.position = 'relative';

  const cellRect = targetCell.getBoundingClientRect();
  const dateLabel = targetCell.getAttribute('data-date');
  const note = targetCell.getAttribute('data-note');
  let tooltipText = dateLabel || '';
  if (note) {
    tooltipText += '\n' + note;
  }
  if (tooltipText) {
    showTooltip(tooltipText, cellRect.left + cellRect.width / 2, cellRect.top);
  }
}

// Додає анімацію (pulse/shake) конкретній клітинці однієї картки.
// Замість обходу всіх heatmap сторінки з getBoundingClientRect для пошуку
// найближчої клітинки — беремо цільову клітинку напряму за data-date-raw.
function animateCell(habitId, dateStr, animationClass, duration = 300) {
  const card = document.querySelector(`.habit[data-habit-id="${habitId}"]`);
  if (!card) return;
  const cell = card.querySelector(`.cell[data-date-raw="${dateStr}"]`);
  if (!cell || cell.classList.contains("padding")) return;
  cell.classList.add(animationClass);
  setTimeout(() => {
    cell.classList.remove(animationClass);
  }, duration);
}
