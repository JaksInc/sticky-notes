(function () {
  'use strict';

  const PINNED_KEY = 'sticky-pinned';
  const SWATCHES = [
    '#FFF9C4', '#F8BBD0', '#BBDEFB', '#C8E6C9', '#FFE0B2', '#E1BEE7', '#FFFFFF'
  ];
  const TODO_PAGE_SIZE = 5;

  const openWindows = new Map();
  let memoPickerOpen = false;
  let memoIsEditing = false;
  let todoPage = 0;
  let calSelectedCell = null;
  let linkFormColor = null;
  let linkFormIcon  = null;
  let editingLinkId = null;
  let editFormColor = null;
  let editFormIcon  = null;

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
      cell.classList.add('cal-day');
      cell.addEventListener('click', () => {
        if (calSelectedCell && calSelectedCell !== cell) {
          calSelectedCell.classList.remove('cal-selected');
        }
        if (calSelectedCell === cell) {
          cell.classList.remove('cal-selected');
          calSelectedCell = null;
        } else {
          cell.classList.add('cal-selected');
          calSelectedCell = cell;
        }
      });
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

  function buildMemoColorBtn(note, pinnedId) {
    const colorBtn = document.createElement('button');
    colorBtn.className = 'btn btn-secondary btn-sm memo-color-btn';
    colorBtn.title = 'Change note color';
    const colorDot = document.createElement('span');
    colorDot.className = 'memo-color-dot';
    colorDot.style.background = note.color || '#FFF9C4';
    colorBtn.appendChild(colorDot);
    colorBtn.insertAdjacentHTML('beforeend', icon('palette', 14));

    colorBtn.addEventListener('click', e => {
      e.stopPropagation();
      const existing = colorBtn.querySelector('.memo-color-picker');
      if (existing) { existing.remove(); return; }

      const picker = document.createElement('div');
      picker.className = 'memo-color-picker';

      SWATCHES.forEach(color => {
        const sw = document.createElement('button');
        sw.className = 'memo-swatch' + (color === (note.color || '#FFF9C4') ? ' active' : '');
        sw.dataset.color = color;
        sw.style.background = color;
        sw.title = color;
        sw.addEventListener('click', ev => {
          ev.stopPropagation();
          const n = getNote(pinnedId);
          if (!n) return;
          n.color = color;
          saveNote(n);
          renderMemo();
        });
        picker.appendChild(sw);
      });

      colorBtn.appendChild(picker);

      const closeOnOutside = ev => {
        if (!colorBtn.contains(ev.target)) {
          picker.remove();
          document.removeEventListener('click', closeOnOutside);
        }
      };
      setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
    });

    return colorBtn;
  }

  function attachMemoCheckHandlers(viewEl, note, pinnedId) {
    viewEl.querySelectorAll('.check-item input').forEach(cb => {
      cb.addEventListener('click', e => {
        e.stopPropagation();
        const lineIdx = parseInt(cb.closest('.check-item').dataset.line);
        const lines = note.content.split('\n');
        if (/^\[ \]/i.test(lines[lineIdx])) {
          lines[lineIdx] = lines[lineIdx].replace(/^\[ \]/i, '[x]');
        } else {
          lines[lineIdx] = lines[lineIdx].replace(/^\[x\]/i, '[ ]');
        }
        note.content = lines.join('\n');
        saveNote(note);
        renderMemoView(viewEl, note, pinnedId);
      });
    });
  }

  function renderMemoView(viewEl, note, pinnedId) {
    viewEl.innerHTML = '';
    const frag = renderContent(note.content);
    if (!frag.childNodes.length) {
      const hint = document.createElement('span');
      hint.className = 'memo-view-hint';
      hint.textContent = 'Click to edit…';
      viewEl.appendChild(hint);
    } else {
      viewEl.appendChild(frag);
      attachMemoCheckHandlers(viewEl, note, pinnedId);
    }
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

    const note = getNote(pinnedId);
    if (!note) {
      localStorage.removeItem(PINNED_KEY);
      renderMemo();
      return;
    }

    widget.style.background = note.color || '#FFF9C4';
    widget.dataset.noteColor = '1';

    header.appendChild(buildMemoColorBtn(note, pinnedId));

    if (memoIsEditing) {
      header.appendChild(mkBtn(icon('check', 14) + ' Save', 'Save and view', 'btn-secondary btn-sm', () => {
        memoIsEditing = false;
        renderMemo();
      }));
    } else {
      header.appendChild(mkBtn(icon('pencil', 14) + ' Edit', 'Edit this note', 'btn-secondary btn-sm', () => {
        memoIsEditing = true;
        renderMemo();
      }));
    }

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
      memoIsEditing = false;
      renderMemo();
      renderNotes();
    }));

    if (memoIsEditing) {
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
      ta.addEventListener('blur', () => {
        const n = getNote(pinnedId);
        if (n) { n.content = ta.value; saveNote(n); }
        memoIsEditing = false;
        renderMemo();
      });
      ta.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          const n = getNote(pinnedId);
          if (n) { n.content = ta.value; saveNote(n); }
          memoIsEditing = false;
          renderMemo();
        }
      });
      body.appendChild(ta);
      setTimeout(() => ta.focus(), 0);
    } else {
      const viewEl = document.createElement('div');
      viewEl.className = 'memo-view';
      viewEl.tabIndex = 0;
      renderMemoView(viewEl, note, pinnedId);

      viewEl.addEventListener('click', () => { memoIsEditing = true; renderMemo(); });
      viewEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { memoIsEditing = true; renderMemo(); }
      });
      body.appendChild(viewEl);
    }
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
          memoIsEditing = false;
          renderMemo();
          renderNotes();
        });
        container.appendChild(item);
      });
    }

    const newItem = document.createElement('button');
    newItem.className = 'note-picker-item note-picker-new';
    newItem.innerHTML = icon('plus', 14) + ' New note';
    newItem.addEventListener('click', () => {
      const note = createNote();
      localStorage.setItem(PINNED_KEY, note.id);
      memoPickerOpen = false;
      memoIsEditing = true;
      renderMemo();
      renderNotes();
      setTimeout(() => document.getElementById('memo-text')?.focus(), 50);
    });
    container.appendChild(newItem);

    return container;
  }

  function syncMemoFromStorage() {
    if (memoPickerOpen || memoIsEditing) return;
    const pinnedId = localStorage.getItem(PINNED_KEY);
    if (!pinnedId) return;
    const note = getNote(pinnedId);
    if (!note) { localStorage.removeItem(PINNED_KEY); renderMemo(); return; }

    const widget = document.querySelector('.widget-memo');
    widget.style.background = note.color || '#FFF9C4';
    widget.dataset.noteColor = '1';
    const dot = document.querySelector('.memo-color-dot');
    if (dot) dot.style.background = note.color || '#FFF9C4';

    const viewEl = document.querySelector('.memo-view');
    if (viewEl) renderMemoView(viewEl, note, pinnedId);
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
    const totalPages = Math.max(1, Math.ceil(todos.length / TODO_PAGE_SIZE));
    if (todoPage >= totalPages) todoPage = totalPages - 1;

    const slice = todos.slice(todoPage * TODO_PAGE_SIZE, (todoPage + 1) * TODO_PAGE_SIZE);
    const list = document.getElementById('todo-list');
    list.innerHTML = '';

    slice.forEach((todo, sliceIdx) => {
      const idx = todoPage * TODO_PAGE_SIZE + sliceIdx;
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

    const pag = document.getElementById('todo-pagination');
    const pageInfo = document.getElementById('todo-page-info');
    const prevBtn = document.getElementById('todo-prev');
    const nextBtn = document.getElementById('todo-next');
    pag.style.display = todos.length > TODO_PAGE_SIZE ? '' : 'none';
    pageInfo.textContent = (todoPage + 1) + ' / ' + totalPages;
    prevBtn.disabled = todoPage === 0;
    nextBtn.disabled = todoPage >= totalPages - 1;
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
      // jump to last page so new item is visible
      todoPage = Math.max(0, Math.ceil(todos.length / TODO_PAGE_SIZE) - 1);
      renderTodos();
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
    document.getElementById('todo-add-btn').addEventListener('click', addTodo);

    document.getElementById('todo-clear-btn').addEventListener('click', () => {
      saveTodos(loadTodos().filter(t => !t.done));
      todoPage = 0;
      renderTodos();
    });

    document.getElementById('todo-prev').addEventListener('click', () => { todoPage--; renderTodos(); });
    document.getElementById('todo-next').addEventListener('click', () => { todoPage++; renderTodos(); });
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
    const notes = getAllNotes().filter(n => n.id !== pinnedId).slice(0, 6);
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

  // ── Quick Links ─────────────────────────────────────────────────────────

  const LINKS_KEY = 'sticky-links';
  let linksFormOpen = false;

  const LINK_COLORS = [
    '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC',
    '#F8BBD0', '#F3E5F5', '#E8EAF6', '#BBDEFB',
    '#B2EBF2', '#C8E6C9', '#DCEDC8', '#F0F4C3',
    '#FFAB91', '#CE93D8', '#90CAF9', '#80CBC4',
    '#F5F5F5', '#FFFFFF',
  ];

  const LINK_ICONS = [
    'globe', 'mail', 'chart', 'folder', 'people', 'gear',
    'home', 'star', 'terminal', 'chat', 'video', 'bell',
    'calendar', 'document', 'checklist', 'link', 'bookmark', 'pin',
    'scanner', 'truck', 'tag', 'orders', 'paint', 'browser',
    'table', 'engage', 'register',
  ];

  function loadLinks() {
    try { return JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); }
    catch { return []; }
  }

  function saveLinks(links) {
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  }

  function buildLinkColorRow(currentColor, onChange) {
    const row = document.createElement('div');
    row.className = 'link-color-row';
    LINK_COLORS.forEach(color => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'link-color-swatch' + (color === currentColor ? ' active' : '');
      sw.style.background = color;
      sw.title = color;
      sw.addEventListener('click', () => {
        const next = onChange(color);
        row.querySelectorAll('.link-color-swatch').forEach(s => s.classList.remove('active'));
        if (next) sw.classList.add('active');
      });
      row.appendChild(sw);
    });
    return row;
  }

  function buildLinkIconPicker(currentIcon, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'link-icon-picker';
    LINK_ICONS.forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-icon-btn' + (name === currentIcon ? ' active' : '');
      btn.title = name;
      btn.innerHTML = icon(name, 16);
      btn.addEventListener('click', () => {
        const next = onChange(name);
        wrap.querySelectorAll('.link-icon-btn').forEach(b => b.classList.remove('active'));
        if (next) btn.classList.add('active');
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function buildLinksGrid(links) {
    const grid = document.createElement('div');
    grid.className = 'links-grid';

    links.forEach((link, idx) => {
      if (link.id === editingLinkId) {
        const form = document.createElement('div');
        form.className = 'link-edit-form';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'todo-input';
        nameInput.value = link.name;

        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.className = 'todo-input';
        urlInput.value = link.url;

        const iconPicker = buildLinkIconPicker(editFormIcon, name => {
          editFormIcon = editFormIcon === name ? null : name;
          return editFormIcon;
        });

        const colorRow = buildLinkColorRow(editFormColor, color => {
          editFormColor = editFormColor === color ? null : color;
          return editFormColor;
        });

        function saveEdit() {
          const name = nameInput.value.trim();
          const url = urlInput.value.trim();
          if (!name || !url) return;
          const finalUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
          const all = loadLinks();
          const i = all.findIndex(l => l.id === link.id);
          if (i !== -1) {
            all[i] = { ...all[i], name, url: finalUrl, color: editFormColor || null, icon: editFormIcon || null };
            saveLinks(all);
          }
          editingLinkId = null;
          editFormColor = null;
          editFormIcon  = null;
          renderLinks();
        }

        function cancelEdit() {
          editingLinkId = null;
          editFormColor = null;
          editFormIcon  = null;
          renderLinks();
        }

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-primary btn-sm';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', saveEdit);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', cancelEdit);

        nameInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') urlInput.focus();
          if (e.key === 'Escape') cancelEdit();
        });
        urlInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') cancelEdit();
        });

        const actions = document.createElement('div');
        actions.className = 'link-form-actions';
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);

        form.appendChild(nameInput);
        form.appendChild(urlInput);
        form.appendChild(iconPicker);
        form.appendChild(colorRow);
        form.appendChild(actions);
        grid.appendChild(form);
        setTimeout(() => nameInput.focus(), 0);
        return;
      }

      const tile = document.createElement('a');
      tile.className = 'link-tile';
      tile.href = link.url;
      tile.target = '_blank';
      tile.rel = 'noopener noreferrer';

      if (link.color) {
        tile.style.background = link.color;
        tile.style.color = '#333';
        tile.dataset.colored = '1';
      }

      const iconEl = document.createElement('div');
      iconEl.className = 'link-tile-icon';
      if (link.icon) {
        iconEl.innerHTML = icon(link.icon, 24);
      } else {
        iconEl.textContent = (link.name || '?')[0].toUpperCase();
        iconEl.classList.add('link-tile-letter');
      }

      const label = document.createElement('span');
      label.className = 'link-tile-label';
      label.textContent = link.name;

      const tileActions = document.createElement('div');
      tileActions.className = 'link-tile-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'link-tile-action-btn';
      editBtn.innerHTML = icon('pencil', 11);
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        editingLinkId = link.id;
        editFormColor = link.color || null;
        editFormIcon  = link.icon  || null;
        linksFormOpen = false;
        renderLinks();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'link-tile-action-btn';
      delBtn.innerHTML = icon('trash', 11);
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const all = loadLinks();
        all.splice(idx, 1);
        saveLinks(all);
        renderLinks();
      });

      tileActions.appendChild(editBtn);
      tileActions.appendChild(delBtn);

      tile.appendChild(iconEl);
      tile.appendChild(label);
      tile.appendChild(tileActions);
      grid.appendChild(tile);
    });

    return grid;
  }

  function renderLinks() {
    const links = loadLinks();
    const body = document.getElementById('links-body');
    body.innerHTML = '';

    if (linksFormOpen) {
      const form = document.createElement('div');
      form.className = 'link-add-form';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'todo-input';
      nameInput.placeholder = 'Name (e.g. "Inventory")';
      nameInput.id = 'link-name-input';

      const urlInput = document.createElement('input');
      urlInput.type = 'url';
      urlInput.className = 'todo-input';
      urlInput.placeholder = 'URL (e.g. "https://...")';
      urlInput.id = 'link-url-input';

      const iconPicker = buildLinkIconPicker(linkFormIcon, name => {
        linkFormIcon = linkFormIcon === name ? null : name;
        return linkFormIcon;
      });

      const colorRow = buildLinkColorRow(linkFormColor, color => {
        linkFormColor = linkFormColor === color ? null : color;
        return linkFormColor;
      });

      const actions = document.createElement('div');
      actions.className = 'link-form-actions';

      function saveLink() {
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        if (!name || !url) return;
        const finalUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
        const all = loadLinks();
        all.push({ id: crypto.randomUUID(), name, url: finalUrl, color: linkFormColor || null, icon: linkFormIcon || null });
        saveLinks(all);
        linksFormOpen = false;
        linkFormColor = null;
        linkFormIcon  = null;
        renderLinks();
      }

      function cancelAdd() {
        linksFormOpen = false;
        linkFormColor = null;
        linkFormIcon  = null;
        renderLinks();
      }

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-primary btn-sm';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', saveLink);

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary btn-sm';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', cancelAdd);

      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') urlInput.focus();
        if (e.key === 'Escape') cancelAdd();
      });
      urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveLink();
        if (e.key === 'Escape') cancelAdd();
      });

      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      form.appendChild(nameInput);
      form.appendChild(urlInput);
      form.appendChild(iconPicker);
      form.appendChild(colorRow);
      form.appendChild(actions);
      body.appendChild(form);

      if (links.length > 0) body.appendChild(buildLinksGrid(links));

      setTimeout(() => nameInput.focus(), 0);
      return;
    }

    if (links.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'links-empty';
      empty.textContent = 'No links yet — click Add to get started.';
      body.appendChild(empty);
      return;
    }

    body.appendChild(buildLinksGrid(links));
  }

  function initLinks() {
    renderLinks();
    document.getElementById('links-add-btn').addEventListener('click', () => {
      linksFormOpen = true;
      linkFormColor = null;
      linkFormIcon  = null;
      editingLinkId = null;
      renderLinks();
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────

  initCalendar();
  renderMemo();
  initTodos();
  initNotes();
  initLinks();

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
      memoIsEditing = false;
      renderMemo();
      renderNotes();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
})();
