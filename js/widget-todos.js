// To-Do widget — self-contained; owns its storage/cloud re-render.
(function () {
  'use strict';

  const TODO_PAGE_SIZE = 5;
  let todoPage = 0;

  // ── Todos ───────────────────────────────────────────────────────────────

  function loadTodos() {
    try { return JSON.parse(localStorage.getItem('sticky-todos') || '[]'); }
    catch { return []; }
  }

  function saveTodos(todos) {
    localStorage.setItem('sticky-todos', JSON.stringify(todos));
    window.cloudSync?.('sticky-todos');
  }

  // Tombstoned todos stay in storage so their deletion syncs, but are hidden.
  function visibleTodos() { return loadTodos().filter(t => !t.deleted); }

  function toggleTodo(id, done) {
    const all = loadTodos();
    const t = all.find(x => x.id === id);
    if (!t) return;
    t.done = done;
    t.modified = Date.now();
    saveTodos(all);
  }

  function deleteTodo(id) {
    saveTodos(loadTodos().map(t =>
      t.id === id ? { ...t, deleted: true, modified: Date.now() } : t));
  }

  function renderTodos() {
    const todos = visibleTodos();
    const totalPages = Math.max(1, Math.ceil(todos.length / TODO_PAGE_SIZE));
    if (todoPage >= totalPages) todoPage = totalPages - 1;

    const slice = todos.slice(todoPage * TODO_PAGE_SIZE, (todoPage + 1) * TODO_PAGE_SIZE);
    const list = document.getElementById('todo-list');
    list.innerHTML = '';

    slice.forEach((todo) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.done ? ' done' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = todo.done;
      cb.addEventListener('change', () => {
        toggleTodo(todo.id, cb.checked);
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
        deleteTodo(todo.id);
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
      const now = Date.now();
      todos.push({ id: crypto.randomUUID(), text, done: false, created: now, modified: now });
      saveTodos(todos);
      input.value = '';
      // jump to last page so new item is visible
      const visibleCount = todos.filter(t => !t.deleted).length;
      todoPage = Math.max(0, Math.ceil(visibleCount / TODO_PAGE_SIZE) - 1);
      renderTodos();
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
    document.getElementById('todo-add-btn').addEventListener('click', addTodo);

    document.getElementById('todo-clear-btn').addEventListener('click', () => {
      // Tombstone completed items (bump modified) so the clear syncs.
      const now = Date.now();
      saveTodos(loadTodos().map(t =>
        (t.done && !t.deleted) ? { ...t, deleted: true, modified: now } : t));
      todoPage = 0;
      renderTodos();
    });

    document.getElementById('todo-prev').addEventListener('click', () => { todoPage--; renderTodos(); });
    document.getElementById('todo-next').addEventListener('click', () => { todoPage++; renderTodos(); });
  }


  initTodos();

  window.addEventListener('storage', function (e) {
    if (e.key === 'sticky-todos') renderTodos();
  });
  window.addEventListener('cloud-applied', function (e) {
    if (e.detail.key === 'sticky-todos') renderTodos();
  });
})();
