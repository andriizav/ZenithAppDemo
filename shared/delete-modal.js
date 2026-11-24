/* ========== SHARED TYPED MODAL HELPERS (DESKTOP) ==========
   Уніфікована типізована система кнопок/футерів для модальних вікон.
   Використовуйте modalButton() / modalButtonClass() замість «сирих» рядків класів,
   щоб гарантувати однаковий стиль скрізь.
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

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

function modalFooter(buttons, opts) {
  opts = opts || {};
  const cls = opts.className || 'settings-modal-footer';
  const html = (buttons || []).map(modalButton).join('');
  return `<div class="${cls}">${html}</div>`;
}

/* ========== GENERIC DELETE CONFIRMATION MODAL ==========
   Уніфіковане модальне вікно підтвердження видалення для всіх вкладок.
   Використовує CSS-класи .delete-confirm* (див. css/main.css).
   API: openDeleteModal({ title, name, text, confirmLabel, onConfirm, dangerClass, iconSvg })
*/
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

  const existing = document.querySelector('.settings-modal.delete-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'settings-modal delete-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const defaultIcon = typeof ICON === 'function' ? ICON('trash2', 26) : '';

  overlay.innerHTML = `
    <div class="settings-modal-content delete-confirm" role="document">
      <div class="delete-confirm-icon">${iconSvg || defaultIcon}</div>
      <h3>${escapeHtml(title)}${name ? ` «<span class="delete-confirm-name">${escapeHtml(name)}</span>»` : ''}?</h3>
      <p class="delete-confirm-text">${escapeHtml(text)}</p>
      <div class="delete-confirm-footer">
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

  overlay.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const onKeyDown = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKeyDown);

  const confirmBtn = overlay.querySelector('[data-confirm]');
  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', () => {
      close();
      onConfirm();
    });
  }

  const cancelBtn = overlay.querySelector('[data-close]');
  if (cancelBtn) cancelBtn.focus();
}

window.modalButtonClass = modalButtonClass;
window.modalButton = modalButton;
window.modalFooter = modalFooter;
window.escapeHtml = escapeHtml;
window.openDeleteModal = openDeleteModal;
