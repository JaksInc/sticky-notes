const STORAGE_KEY = 'sticky-notes';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getAllNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Notes visible to the user — tombstoned (soft-deleted) notes are kept in
// storage so their deletion can propagate to the cloud, but never rendered.
function getVisibleNotes() {
  return getAllNotes().filter(n => !n.deleted);
}

function getNote(id) {
  const note = getAllNotes().find(n => n.id === id) || null;
  return note && note.deleted ? null : note;
}

function createNote() {
  const note = {
    id: generateId(),
    color: '#FFF9C4',
    content: '',
    created: Date.now(),
    modified: Date.now()
  };
  const notes = getAllNotes();
  notes.unshift(note);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  return note;
}

function saveNote(note) {
  const notes = getAllNotes();
  const idx = notes.findIndex(n => n.id === note.id);
  const updated = { ...note, modified: Date.now() };
  if (idx >= 0) {
    notes[idx] = updated;
  } else {
    notes.unshift(updated);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Soft-delete: mark a tombstone instead of dropping the note, so the removal
// syncs to the cloud (a pure union merge can't represent an absent note) and
// wins over older copies on other devices via the bumped `modified` time.
function deleteNote(id) {
  const notes = getAllNotes().map(n =>
    n.id === id ? { ...n, deleted: true, content: '', modified: Date.now() } : n
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Exposed for unit tests under Node; a no-op in the browser (module undefined).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY, generateId, getAllNotes, getNote, getVisibleNotes,
    createNote, saveNote, deleteNote,
  };
}
