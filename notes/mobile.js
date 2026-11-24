/* ---------- MOBILE NOTES TOOLBAR CONFIG ---------- */

function getMobileToolbarConfig() {
  return [
    ['bold', 'italic', 'underline'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }, { header: 1 }, { header: 2 }],
    [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
    ['link', 'image', 'video'],
    ['code-block', 'divider'],
  ];
}

function isMobile() {
  return window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches;
}