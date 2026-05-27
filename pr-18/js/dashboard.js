(function () {
  'use strict';

  const PINNED_KEY = 'sticky-pinned';
  const SWATCHES = [
    '#FFF9C4', '#F8BBD0', '#BBDEFB', '#C8E6C9', '#FFE0B2', '#E1BEE7', '#FFFFFF'
  ];

  const openWindows = new Map();

  function isMobile() {
    return window.innerWidth < 768 || 'ontouchstart' in window;
  }

  // ── Calendar ────────────────────────────────────────────────────────────

  function initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const container = document.getElementById('cal-body');

    const heading = document.createElement('div');
    heading.className = 'cal-heading';
    heading.textContent = MONTHS[month] + ' ' + year;
    container.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'cal-table';

    const thead = table.createTHead();
    const hrow = thead.insertRow();
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
      const th = document.createElement('th');
      th.textContent = d;
      hrow.appendChild(th);
    });

    const tbody = table.createTBody();
    const firstDOW = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let row = tbody.insertRow();
    let col = 0;

    for (let i = 0; i < firstDOW; i++) {
      row.insertCell();
      col++;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      if (col === 7) { row = tbody.insertRow(); col = 0; }
      const cell = row.insertCell();
      const span = document.createElement('span');
      span.textContent = day;
      cell.appendChild(span);
      if (day === today) cell.className = 'cal-today';
      col++;
    }

    while (col > 0 && col < 7) { row.insertCell(); col++; }

    container.appendChild(table);
  }

  // ── Pinned note (Quick Memo) ────────────────────────────────────────────

  function getOrCreatePinnedNote() {
    const id = localStorage.getItem(PINNED_KEY);
    if (id) {
      const note = getNote(id);
      if (note) return note;
    }
    const note = createNote();
    localStorage.setItem(PINNED_KEY, note.id);
    return note;
  }

  function applyMemoColor(color) {
    const widget = document.querySelector('.widget-memo');
    widget.style.background = color;
    document.querySelectorAll('.memo-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });
  }

  function initMemo() {
    const note = getOrCreatePinnedNote();

    // Build color swatches
    const swatchContainer = document.getElementById('memo-swatches');
    SWATCHES.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'memo-swatch';
      btn.dataset.color = color;
      btn.style.background = color;
      btn.title = color;
      btn.addEventListener('click', () => {
        const n = getOrCreatePinnedNote();
        n.color = color;
        saveNote(n);
        applyMemoColor(color);
      });
      swatchContainer.appendChild(btn);
    });

    applyMemoColor(note.color);

    const ta = document.getElementById('memo-text');
    ta.value = note.content;

    // Open in full editor
    document.getElementById('memo-open-btn').addEventListener('click', () => {
      openNote(getOrCreatePinnedNote().id);
    });

    // Auto-save on input
    let saveTimer;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const n = getOrCreatePinnedNote();
        n.content = ta.value;
        saveNote(n);
      }, 300);
    });
  }

  function syncMemoFromStorage() {
    const pinnedId = localStorage.getItem(PINNED_KEY);
    if (!pinnedId) return;
    const note = getNote(pinnedId);
    if (!note) return;
    const ta = document.getElementById('memo-text');
    if (ta !== document.activeElement) {
      ta.value = note.content;
      applyMemoColor(note.color);
    }
  }

  // ── Todos ───────────────────────────────────────────────────────────────

  function loadTodos() {
    try { return JSON.parse(localStorage.getItem('sticky-todos') || '[]'); }
    catch { return []; }
  }

  function saveTodos(todos) {
    localStorage.setItem('sticky-todos', JSON.stringify(todos));
  }

  function renderTodos() {
    const todos = loadTodos();
    const list = document.getElementById('todo-list');
    list.innerHTML = '';

    todos.forEach((todo, idx) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.done ? ' done' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = todo.done;
      cb.addEventListener('change', () => {
        const all = loadTodos();
        all[idx].done = cb.checked;
        saveTodos(all);
        renderTodos();
      });

      const label = document.createElement('span');
      label.className = 'todo-label';
      label.textContent = todo.text;

      const del = document.createElement('button');
      del.className = 'todo-del';
      del.textContent = '×';
      del.title = 'Delete task';
      del.addEventListener('click', () => {
        const all = loadTodos();
        all.splice(idx, 1);
        saveTodos(all);
        renderTodos();
      });

      li.appendChild(cb);
      li.appendChild(label);
      li.appendChild(del);
      list.appendChild(li);
    });

    const remaining = todos.filter(t => !t.done).length;
    const footer = document.getElementById('todo-footer');
    const countEl = document.getElementById('todo-count');
    countEl.textContent = remaining + ' remaining';
    footer.style.display = todos.length ? '' : 'none';
  }

  function initTodos() {
    renderTodos();

    const input = document.getElementById('todo-input');

    function addTodo() {
      const text = input.value.trim();
      if (!text) return;
      const todos = loadTodos();
      todos.push({ id: crypto.randomUUID(), text, done: false, created: Date.now() });
      saveTodos(todos);
      input.value = '';
      renderTodos();
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
    document.getElementById('todo-add-btn').addEventListener('click', addTodo);

    document.getElementById('todo-clear-btn').addEventListener('click', () => {
      saveTodos(loadTodos().filter(t => !t.done));
      renderTodos();
    });
  }

  // ── Notes mini-grid ─────────────────────────────────────────────────────

  function openNote(id) {
    if (isMobile()) {
      location.href = 'note.html?id=' + encodeURIComponent(id);
      return;
    }
    const existing = openWindows.get(id);
    if (existing && !existing.closed) { existing.focus(); return; }
    const w = window.open(
      'note.html?id=' + encodeURIComponent(id),
      'note-' + id,
      'popup=1,width=380,height=520,resizable=yes,scrollbars=yes'
    );
    if (w) openWindows.set(id, w);
  }

  function renderNotes() {
    const pinnedId = localStorage.getItem(PINNED_KEY);
    const notes = getAllNotes().filter(n => n.id !== pinnedId);
    const grid = document.getElementById('notes-grid');
    const empty = document.getElementById('notes-empty');
    grid.innerHTML = '';

    if (notes.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    for (const note of notes) {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.backgroundColor = note.color || '#FFF9C4';

      const body = document.createElement('div');
      body.className = 'card-body';
      body.addEventListener('click', () => openNote(note.id));

      const preview = document.createElement('div');
      preview.className = 'card-preview';
      preview.innerHTML = note.content.trim()
        ? renderPreview(note.content)
        : '<span class="empty">Empty note</span>';
      body.appendChild(preview);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const openBtn = document.createElement('button');
      openBtn.className = 'card-btn';
      openBtn.title = 'Open note';
      openBtn.textContent = '✎';
      openBtn.addEventListener('click', e => { e.stopPropagation(); openNote(note.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'card-btn delete';
      delBtn.title = 'Delete note';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('Delete this note?')) return;
        const win = openWindows.get(note.id);
        if (win && !win.closed) win.close();
        openWindows.delete(note.id);
        deleteNote(note.id);
        renderNotes();
      });

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      card.appendChild(body);
      card.appendChild(actions);
      grid.appendChild(card);
    }
  }

  function initNotes() {
    renderNotes();

    document.getElementById('notes-new-btn').addEventListener('click', () => {
      const note = createNote();
      renderNotes();
      openNote(note.id);
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────

  initCalendar();
  initMemo();
  initTodos();
  initNotes();

  window.addEventListener('focus', () => {
    syncMemoFromStorage();
    renderNotes();
  });

  window.addEventListener('storage', e => {
    if (e.key === 'sticky-notes') {
      syncMemoFromStorage();
      renderNotes();
    }
    if (e.key === 'sticky-todos') renderTodos();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  }
})();
