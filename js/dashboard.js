(function () {
  'use strict';

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

  // ── Quick Memo ──────────────────────────────────────────────────────────

  function initMemo() {
    const ta = document.getElementById('memo-text');
    ta.value = localStorage.getItem('sticky-memo') || '';

    let saveTimer;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem('sticky-memo', ta.value);
      }, 300);
    });
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
    const notes = getAllNotes();
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

  window.addEventListener('focus', renderNotes);

  window.addEventListener('storage', e => {
    if (e.key === 'sticky-notes') renderNotes();
    if (e.key === 'sticky-todos') renderTodos();
    if (e.key === 'sticky-memo') {
      document.getElementById('memo-text').value =
        localStorage.getItem('sticky-memo') || '';
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  }
})();
