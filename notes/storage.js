/* ---------- NOTES STORAGE ---------- */

const NOTES_STORAGE_KEY = 'notes_data';
const NOTES_TOPICS_KEY = 'notes_topics';
const NOTES_ACTIVE_KEY = 'notes_active_topic';
const NOTES_TIMESTAMPS_KEY = 'notes_timestamps';
const NOTES_GROUPS_KEY = 'notes_groups';
const NOTES_TOPIC_GROUPS_KEY = 'notes_topic_groups';
const NOTES_MAIN_GROUP_KEY = 'notes_main_group';
const NOTES_COLLAPSED_KEY = 'notes_collapsed_groups';
const NOTES_NAME_MAP_KEY = 'notes_name_map';

function generateNoteId() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getNotesNameMap() {
  try { return JSON.parse(localStorage.getItem(NOTES_NAME_MAP_KEY)) || {}; }
  catch { return {}; }
}

// Stable, predictable title for notes created straight from the empty editor.
function getNewTopicName() {
  const names = new Set(Object.values(getNotesNameMap()));
  if (!names.has('Нотатка')) return 'Нотатка';
  let i = 2;
  while (names.has(`Нотатка ${i}`)) i++;
  return `Нотатка ${i}`;
}

function saveNotesNameMap(map) {
  localStorage.setItem(NOTES_NAME_MAP_KEY, JSON.stringify(map));
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getTopicName(id) {
  return getNotesNameMap()[id] || id;
}

function migrateNotesToIds() {
  const nameMap = getNotesNameMap();
  if (Object.keys(nameMap).length > 0) return false;

  const oldTopics = JSON.parse(localStorage.getItem(NOTES_TOPICS_KEY)) || [];
  const oldData = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY)) || {};
  const oldTs = JSON.parse(localStorage.getItem(NOTES_TIMESTAMPS_KEY)) || {};
  const oldTg = JSON.parse(localStorage.getItem(NOTES_TOPIC_GROUPS_KEY)) || {};

  if (oldTopics.length === 0) return false;

  const newTopics = [];
  const newData = {};
  const newTs = {};
  const newTg = {};
  const newMap = {};

  for (const name of oldTopics) {
    const id = generateNoteId();
    newMap[id] = name;
    newTopics.push(id);
    if (oldData.hasOwnProperty(name)) newData[id] = oldData[name];
    if (oldTs.hasOwnProperty(name)) newTs[id] = oldTs[name];
    if (oldTg.hasOwnProperty(name)) newTg[id] = oldTg[name];
  }

  localStorage.setItem(NOTES_NAME_MAP_KEY, JSON.stringify(newMap));
  localStorage.setItem(NOTES_TOPICS_KEY, JSON.stringify(newTopics));
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(newData));
  localStorage.setItem(NOTES_TIMESTAMPS_KEY, JSON.stringify(newTs));
  localStorage.setItem(NOTES_TOPIC_GROUPS_KEY, JSON.stringify(newTg));

  const active = localStorage.getItem(NOTES_ACTIVE_KEY);
  if (active && newMap[active]) {
    // active is still old name, convert
    for (const [id, name] of Object.entries(newMap)) {
      if (name === active) { localStorage.setItem(NOTES_ACTIVE_KEY, id); break; }
    }
  }

  return true;
}

function getNotesData() {
  try {
    const data = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY)) || {};
    return migrateLegacyNoteArrays(data);
  } catch { return {}; }
}

// Legacy seed data once stored each topic as an array of {title, content}
// notes instead of a single HTML string, which rendered as "[object Object]".
// Flatten any such array into one HTML string and persist the fix.
function migrateLegacyNoteArrays(data) {
  let changed = false;
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      data[key] = data[key].map(n => {
        if (n && typeof n === 'object') {
          return (n.title ? `<h3>${n.title}</h3>` : '') + (n.content || '');
        }
        return typeof n === 'string' ? n : '';
      }).join('');
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data));
  }
  return data;
}

function saveNotesData(data) { 
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data)); 
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getNotesTopics() {
  try {
    const topics = JSON.parse(localStorage.getItem(NOTES_TOPICS_KEY)) || [];
    const data = getNotesData();
    let changed = false;

    for (const key of Object.keys(data)) {
      if (key && !topics.includes(key)) {
        topics.push(key);
        changed = true;
      }
    }

    const filtered = topics.filter(t => t && data.hasOwnProperty(t));
    if (filtered.length !== topics.length) changed = true;

    if (changed && filtered.length) {
      localStorage.setItem(NOTES_TOPICS_KEY, JSON.stringify(filtered));
    }

    if (filtered.length) return filtered;
  } catch {}
  return [getMainGroupName()];
}

function saveNotesTopics(topics) { 
  localStorage.setItem(NOTES_TOPICS_KEY, JSON.stringify(topics)); 
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getNotesTimestamps() {
  try { return JSON.parse(localStorage.getItem(NOTES_TIMESTAMPS_KEY)) || {}; }
  catch { return {}; }
}

function saveNotesTimestamps(ts) { 
  localStorage.setItem(NOTES_TIMESTAMPS_KEY, JSON.stringify(ts)); 
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getNotesGroups() {
  try {
    const g = JSON.parse(localStorage.getItem(NOTES_GROUPS_KEY));
    if (g && g.length) {
      const mainGroupName = getMainGroupName();
      const hasMainGroup = g.includes(mainGroupName);
      
      if (!hasMainGroup) {
        const oldIndex = g.indexOf('Загальне');
        if (oldIndex !== -1 && mainGroupName !== 'Загальне') {
          g[oldIndex] = mainGroupName;
        } else {
          g.unshift(mainGroupName);
        }
        saveNotesGroups(g);
      } else {
        const filteredGroups = g.filter((name, index) => name !== mainGroupName || index === g.indexOf(mainGroupName));
        if (filteredGroups.length !== g.length) {
          saveNotesGroups(filteredGroups);
          return filteredGroups;
        }
      }
      return g;
    }
  } catch {}
  return [getMainGroupName()];
}

function saveNotesGroups(groups) { 
  localStorage.setItem(NOTES_GROUPS_KEY, JSON.stringify(groups)); 
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getTopicGroups() {
  try { 
    const tg = JSON.parse(localStorage.getItem(NOTES_TOPIC_GROUPS_KEY)) || {};
    
    const mainGroupName = getMainGroupName();
    let needsSave = false;
    
    for (const topic in tg) {
      if (tg[topic] === 'Загальне' && mainGroupName !== 'Загальне') {
        tg[topic] = mainGroupName;
        needsSave = true;
      }
    }
    
    if (needsSave) {
      saveTopicGroups(tg);
    }
    
    return tg;
  } catch { return {}; }
}

function saveTopicGroups(map) { 
  localStorage.setItem(NOTES_TOPIC_GROUPS_KEY, JSON.stringify(map)); 
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getTopicGroup(topic) { 
  return getTopicGroups()[topic] || getMainGroupName(); 
}

function getCollapsedGroups() {
  try {
    const v = JSON.parse(localStorage.getItem(NOTES_COLLAPSED_KEY));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function saveCollapsedGroups(arr) {
  localStorage.setItem(NOTES_COLLAPSED_KEY, JSON.stringify(arr));
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}

function getMainGroupName() {
  try {
    const name = localStorage.getItem(NOTES_MAIN_GROUP_KEY);
    if (name && name.trim()) return name.trim();
  } catch {}
  return 'Загальне';
}

function setMainGroupName(name) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  localStorage.setItem(NOTES_MAIN_GROUP_KEY, trimmed);
  return true;
}

const NOTES_SETTINGS_KEY = 'notes_settings';

function getNotesSettings() {
  const defaults = { showGroupCount: true };
  try {
    return Object.assign(defaults, JSON.parse(localStorage.getItem(NOTES_SETTINGS_KEY)) || {});
  } catch {
    return defaults;
  }
}

function saveNotesSettings(settings) {
  try {
    localStorage.setItem(NOTES_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  gistTouchLocalModified('notes');
  if (typeof gistStorage !== 'undefined' && gistStorage.isEnabled()) {
    gistStorage.markPendingChanges();
  }
  if (typeof fileStorage !== 'undefined' && fileStorage.isEnabled()) {
    fileStorage.markPendingChanges();
  }
}
