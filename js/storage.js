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

function getNote(id) {
  return getAllNotes().find(n => n.id === id) || null;
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

function deleteNote(id) {
  const notes = getAllNotes().filter(n => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
