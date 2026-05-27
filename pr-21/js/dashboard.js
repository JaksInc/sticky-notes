(function () {
  'use strict';

  const PINNED_KEY = 'sticky-pinned';
  const SWATCHES = [
    '#FFF9C4', '#F8BBD0', '#BBDEFB', '#C8E6C9', '#FFE0B2', '#E1BEE7', '#FFFFFF'
  ];

  const openWindows = new Map();
  let memoPickerOpen = false;

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

  function mkBtn(html, title, cls, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + cls;
    btn.innerHTML = html;
    if (title) btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderMemo() {
    const pinnedId = localStorage.getItem(PINNED_KEY);
    const widget   = document.querySelector('.widget-memo');
    const header   = document.getElementById('memo-header-actions');
    const body     = document.getElementById('memo-body');

    header.innerHTML = '';
    body.innerHTML   = '';

    if (memoPickerOpen) {
      widget.style.background = '';
      delete widget.dataset.noteColor;

      if (pinnedId) {
        header.appendChild(
          mkBtn(icon('cancel', 14) + ' Cancel', 'Go back', 'btn-secondary btn-sm', () => {
            memoPickerOpen = false;
            renderMemo();
          })
        );
      }

      body.appendChild(buildNotePicker(pinnedId));
      return;
    }

    if (!pinnedId) {
      widget.style.background = '';
      delete widget.dataset.noteColor;

      header.appendChild(
        mkBtn(icon('pin', 14) + ' Pin a note', '', 'btn-primary btn-sm', () => {
          memoPickerOpen = true;
          renderMemo();
        })
      );

      const placeholder = document.createElement('div');
      placeholder.className = 'memo-placeholder';
      const p = document.createElement('p');
      p.textContent = 'No note pinned.';
      const pinBtn = document.createElement('button');
      pinBtn.className = 'btn btn-primary';
      pinBtn.innerHTML = icon('pin', 14) + ' Pin a note';
      pinBtn.addEventListener('click', () => {
        memoPickerOpen = true;
        renderMemo();
      });
      placeholder.appendChild(p);
      placeholder.appendChild(pinBtn);
      body.appendChild(placeholder);
      return;
    }

    // ── Note pinned, textarea ─────────────────────────────────────────
    const note = getNote(pinnedId);
    if (!note) {
      localStorage.removeItem(PINNED_KEY);
      renderMemo();
      return;
    }

    widget.style.background = note.color || '#FFF9C4';
    widget.dataset.noteColor = '1';

    // Color swatches
    const swatchWrap = document.createElement('div');
    swatchWrap.className = 'memo-swatches';
    SWATCHES.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'memo-swatch' + (color === note.color ? ' active' : '');
      btn.dataset.color = color;
      btn.style.background = color;
      btn.title = color;
      btn.addEventListener('click', () => {
        const n = getNote(pinnedId);
        if (!n) return;
        n.color = color;
        saveNote(n);
        renderMemo();
      });
      swatchWrap.appendChild(btn);
    });
    header.appendChild(swatchWrap);

    header.appendChild(mkBtn(icon('swap', 14) + ' Swap', 'Pin a different note', 'btn-secondary btn-sm', () => {
      memoPickerOpen = true;
      renderMemo();
    }));

    header.appendChild(mkBtn(icon('pencil', 14) + ' Open', 'Open in editor', 'btn-secondary btn-sm', () => {
      openNote(pinnedId);
    }));

    header.appendChild(mkBtn('Unpin', 'Remove from memo widget', 'btn-secondary btn-sm memo-unpin-btn', () => {
      localStorage.removeItem(PINNED_KEY);
      memoPickerOpen = false;
      renderMemo();
      renderNotes();
    }));

    // Textarea
    const ta = document.createElement('textarea');
    ta.id = 'memo-text';
    ta.className = 'memo-textarea';
    ta.placeholder = 'Jot something down…';
    ta.value = note.content;

    let saveTimer;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const n = getNote(pinnedId);
        if (n) { n.content = ta.value; saveNote(n); }
      }, 300);
    });
    body.appendChild(ta);
  }

  function buildNotePicker(currentPinnedId) {
    const container = document.createElement('div');
    container.className = 'note-picker';

    const allNotes = getAllNotes();

    if (allNotes.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'note-picker-empty';
      msg.textContent = 'No notes yet.';
      container.appendChild(msg);
    } else {
      allNotes.forEach(note => {
        const item = document.createElement('button');
        item.className = 'note-picker-item' + (note.id === currentPinnedId ? ' current' : '');

        const swatch = document.createElement('span');
        swatch.className = 'note-picker-swatch';
        swatch.style.background = note.color || '#FFF9C4';

        const title = document.createElement('span');
        title.className = 'note-picker-title';
        title.textContent = note.content.split('\n')[0].trim() || 'Empty note';

        item.appendChild(swatch);
        item.appendChild(title);
        if (note.id === currentPinnedId) {
          const check = document.createElement('span');
          check.className = 'note-picker-check';
          check.innerHTML = icon('check', 14);
          item.appendChild(check);
        }
        item.addEventListener('click', () => {
          localStorage.setItem(PINNED_KEY, note.id);
          memoPickerOpen = false;
          renderMemo();
          renderNotes();
        });
        container.appendChild(item);
      });
    }

    // Create new note option
    const newItem = document.createElement('button');
    newItem.className = 'note-picker-item note-picker-new';
    newItem.innerHTML = icon('plus', 14) + ' New note';
    newItem.addEventListener('click', () => {
      const note = createNote();
      localStorage.setItem(PINNED_KEY, note.id);
      memoPickerOpen = false;
      renderMemo();
      renderNotes();
      setTimeout(() => document.getElementById('memo-text')?.focus(), 50);
    });
    container.appendChild(newItem);

    return container;
  }

  function syncMemoFromStorage() {
    if (memoPickerOpen) return;
    const pinnedId = localStorage.getItem(PINNED_KEY);
    if (!pinnedId) return;
    const note = getNote(pinnedId);
    if (!note) { localStorage.removeItem(PINNED_KEY); renderMemo(); return; }

    const ta = document.getElementById('memo-text');
    if (!ta || ta === document.activeElement) return;
    ta.value = note.content;

    const widget = document.querySelector('.widget-memo');
    widget.style.background = note.color || '#FFF9C4';
    widget.dataset.noteColor = '1';
    document.querySelectorAll('.memo-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === note.color);
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
      del.innerHTML = icon('trash', 14);
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
      card.dataset.noteColor = '1';

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
      openBtn.innerHTML = icon('pencil', 14);
      openBtn.addEventListener('click', e => { e.stopPropagation(); openNote(note.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'card-btn delete';
      delBtn.title = 'Delete note';
      delBtn.innerHTML = icon('trash', 14);
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
  renderMemo();
  initTodos();
  initNotes();

  // Pop-out button
  const popoutBtn = document.getElementById('btn-popout');
  if (popoutBtn) {
    if (window.opener !== null || isMobile()) {
      popoutBtn.style.display = 'none';
    } else {
      popoutBtn.addEventListener('click', () => {
        window.open('index.html', 'sticky-dashboard', 'popup=1,width=1100,height=700,resizable=yes');
      });
    }
  }

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
    if (e.key === 'sticky-pinned') {
      memoPickerOpen = false;
      renderMemo();
      renderNotes();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  }
})();
