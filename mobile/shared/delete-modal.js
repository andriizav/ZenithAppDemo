/* ========== SHARED TYPED DELETE MODAL ==========
   Уніфіковане модальне вікно підтвердження видалення для всіх вкладок.
   Використовує .settings-modal каркас (як смітник/налаштування).
   API: openDeleteModal({ title, name, text, confirmLabel, onConfirm, dangerClass })
*/

/* ========== TYPED MODAL BUTTONS ==========
   Єдина типізована система кнопок для всіх модальних вікон.
   Використовуйте modalButton() / modalButtonClass() замість «сирих» рядків класів,
   щоб гарантувати однаковий стиль скрізь.
*/

/**
 * Тип (варіант) кнопки модального вікна.
 * @typedef {'primary'|'secondary'|'danger'|'icon'} ModalButtonVariant
 */

/**
 * Опис кнопки модального вікна.
 * @typedef {Object} ModalButtonOptions
 * @property {string} [label]              Текст кнопки (HTML-екранований автоматично).
 * @property {string} [html]              Готовий HTML-вміст (напр. SVG-іконка). Має пріоритет над label.
 * @property {ModalButtonVariant} [variant='secondary']  Тип кнопки.
 * @property {boolean} [block=false]      Розтягнути на всю доступну ширину.
 * @property {boolean} [close=false]      Додати data-close (закриває модалку).
 * @property {boolean} [confirm=false]    Додати data-confirm.
 * @property {boolean} [disabled=false]   Неактивна кнопка.
 * @property {string} [extra]             Додатковий CSS-клас (напр. кастомний danger-клас).
 * @property {string} [id]                id атрибут.
 * @property {string} [title]             title (тултип), корисно для кнопок-іконок.
 * @property {string} [type='button']     Тип HTML-кнопки.
 * @property {Object<string,string>} [attrs]  Довільні додаткові атрибути.
 */

/**
 * Повертає рядок CSS-класів для кнопки заданого типу.
 * Джерело правди для класів кнопок у всіх модалках.
 * @param {ModalButtonVariant} [variant='secondary']
 * @param {{block?: boolean, extra?: string}} [opts]
 * @returns {string}
 */
function modalButtonClass(variant, opts) {
  opts = opts || {};
  const classes = ['modal-btn'];
  switch (variant) {
    case 'primary': classes.push('modal-btn--primary'); break;
    case 'danger':  classes.push('modal-btn--danger');  break;
    case 'icon':    classes.push('modal-btn--icon');    break;
    case 'secondary':
    default:        classes.push('modal-btn--secondary'); break;
  }
  if (opts.block) classes.push('modal-btn--block');
  if (opts.extra) classes.push(opts.extra);
  return classes.join(' ');
}

/**
 * Генерує HTML однієї типізованої кнопки модалки.
 * @param {ModalButtonOptions} [options]
 * @returns {string}
 */
function modalButton(options) {
  const o = options || {};
  const variant = o.variant || 'secondary';
  const cls = modalButtonClass(variant, { block: o.block, extra: o.extra });
  const parts = [`class="${cls}"`, `type="${o.type || 'button'}"`];
  if (o.id) parts.push(`id="${o.id}"`);
  if (o.title) parts.push(`title="${escapeHtml(o.title)}"`);
  if (o.disabled) parts.push('disabled');
  if (o.close) parts.push('data-close');
  if (o.confirm) parts.push('data-confirm');
  if (o.attrs) {
    for (const key in o.attrs) {
      if (Object.prototype.hasOwnProperty.call(o.attrs, key)) {
        parts.push(`${key}="${escapeHtml(String(o.attrs[key]))}"`);
      }
    }
  }
  const content = (o.html != null) ? o.html : escapeHtml(o.label || '');
  return `<button ${parts.join(' ')}>${content}</button>`;
}

/**
 * Генерує HTML футера модалки з набору кнопок.
 * @param {ModalButtonOptions[]} buttons
 * @param {{className?: string}} [opts]
 * @returns {string}
 */
function modalFooter(buttons, opts) {
  opts = opts || {};
  const cls = opts.className || 'settings-modal-footer';
  const html = (buttons || []).map(modalButton).join('');
  return `<div class="${cls}">${html}</div>`;
}

function openDeleteModal(opts) {
  opts = opts || {};
  const {
    title = 'Видалити?',
    name = '',
    text = 'Цю дію неможливо скасувати.',
    confirmLabel = 'Видалити',
    onConfirm,
    dangerClass = 'modal-btn--danger',
    iconSvg
  } = opts;

  // Видаляємо попереднє, якщо є
  const existing = document.querySelector('.settings-modal.delete-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'settings-modal delete-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const defaultIcon = ICON('trash2', 26);

overlay.innerHTML = `
    <div class="settings-modal-content" role="document">
      <div class="settings-modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="settings-modal-close" type="button" data-close aria-label="Закрити">&times;</button>
      </div>
      <div class="settings-modal-body">
        <div class="delete-confirm-icon" style="display:flex;align-items:center;justify-content:center;margin:8px auto 4px;">${iconSvg || defaultIcon}</div>
        <h4 class="delete-confirm-title" style="margin:8px 0 6px;text-align:center;font-size:15px;font-weight:600;">${escapeHtml(title)}${name ? ` «<span class="delete-confirm-name">${escapeHtml(name)}</span>»` : ''}?</h4>
        <p class="delete-confirm-text" style="text-align:center;color:var(--text-muted);font-size:13px;">${escapeHtml(text)}</p>
      </div>
      <div class="settings-modal-footer">
        ${modalButton({ label: 'Скасувати', variant: 'secondary', close: true })}
        ${modalButton({ label: confirmLabel, variant: 'danger', confirm: true, extra: dangerClass !== 'modal-btn--danger' ? dangerClass : undefined })}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('settings-modal-open');

  const close = () => {
    overlay.remove();
    document.body.classList.remove('settings-modal-open');
    document.removeEventListener('keydown', onKeyDown);
  };

  // X кнопка, Cancel кнопка, клік по оверлею, Escape
  overlay.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const onKeyDown = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKeyDown);

  // Confirm
  const confirmBtn = overlay.querySelector('[data-confirm]');
  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', () => {
      close();
      onConfirm();
    });
  }

  // Фокус на Cancel для безпеки
  const cancelBtn = overlay.querySelector('[data-close]');
  if (cancelBtn) cancelBtn.focus();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export global
window.openDeleteModal = openDeleteModal;
window.modalButton = modalButton;
window.modalButtonClass = modalButtonClass;
window.modalFooter = modalFooter;