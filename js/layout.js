(function () {
  'use strict';

  const LAYOUT_KEY  = 'qb-layout';
  const GRID_COLS   = 3;
  const GRID_ROW_PX = 80;
  const GRID_GAP_PX = 16;

  const WIDGET_META = {
    calendar: { name: 'Calendar',    iconName: 'calendar'  },
    memo:     { name: 'Pinned Note', iconName: 'bookmark'  },
    todos:    { name: 'To-Do',       iconName: 'checklist' },
    notes:    { name: 'Notes',       iconName: 'document'  },
    links:    { name: 'Quick Links', iconName: 'link'      },
  };

  const DEFAULT_LAYOUT = [
    { id: 'calendar', x: 0, y: 0, w: 1, h: 4, hidden: false },
    { id: 'memo',     x: 1, y: 0, w: 1, h: 4, hidden: false },
    { id: 'todos',    x: 2, y: 0, w: 1, h: 4, hidden: false },
    { id: 'notes',    x: 0, y: 4, w: 3, h: 4, hidden: false },
    { id: 'links',    x: 0, y: 8, w: 2, h: 3, hidden: false },
  ];

  let editMode   = false;
  let dragEntry  = null;
  let _listeners = [];

  let resizeState = null;

  // ── Storage ────────────────────────────────────────────────────────────

  function defaultLayout() {
    return DEFAULT_LAYOUT.map(e => Object.assign({}, e));
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return defaultLayout();
      const parsed = JSON.parse(raw);
      const ids = new Set(DEFAULT_LAYOUT.map(e => e.id));
      if (!Array.isArray(parsed) || parsed.length !== DEFAULT_LAYOUT.length) return defaultLayout();
      if (!parsed.every(e =>
        ids.has(e.id) &&
        Number.isInteger(e.x) && e.x >= 0 &&
        Number.isInteger(e.y) && e.y >= 0 &&
        Number.isInteger(e.w) && e.w >= 1 && e.w <= GRID_COLS &&
        Number.isInteger(e.h) && e.h >= 1 && e.h <= 20
      )) return defaultLayout();
      parsed.forEach(e => { if (typeof e.hidden !== 'boolean') e.hidden = false; });
      return parsed;
    } catch { return defaultLayout(); }
  }

  function saveLayout(layout) {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }

  // ── Apply layout to DOM ────────────────────────────────────────────────

  function isMobile() { return window.innerWidth <= 600; }

  function applyLayout(layout) {
    const mobile = isMobile();
    const maxCols = mobile ? 1 : window.innerWidth <= 900 ? 2 : GRID_COLS;
    layout.forEach(entry => {
      const widget = document.querySelector('[data-widget-id="' + entry.id + '"]');
      if (!widget) return;

      if (entry.hidden && !editMode) {
        widget.style.display = 'none';
        widget.classList.remove('layout-hidden');
        return;
      }
      widget.style.display = '';
      widget.classList.toggle('layout-hidden', !!(entry.hidden && editMode));

      if (mobile) {
        widget.style.gridColumn = '';
        widget.style.gridRow    = '';
      } else {
        const w = Math.min(entry.w, maxCols);
        const x = Math.min(entry.x, maxCols - w);
        widget.style.gridColumn = (x + 1) + ' / span ' + w;
        widget.style.gridRow    = (entry.y + 1) + ' / span ' + entry.h;
      }
    });
  }

  // ── Ghost element ──────────────────────────────────────────────────────

  let ghost = null;

  function showGhost(tx, ty, w, h) {
    const grid = document.querySelector('.widget-grid');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'layout-ghost';
      grid.appendChild(ghost);
    }
    ghost.style.gridColumn = (tx + 1) + ' / span ' + w;
    ghost.style.gridRow    = (ty + 1) + ' / span ' + h;
    ghost.style.display    = '';
  }

  function hideGhost() {
    if (ghost) ghost.style.display = 'none';
  }

  // ── Grid coordinate math ───────────────────────────────────────────────

  function gridCoords(e) {
    const grid = document.querySelector('.widget-grid');
    const rect = grid.getBoundingClientRect();
    const maxCols = window.innerWidth <= 900 ? 2 : GRID_COLS;
    const colW = rect.width / maxCols;
    const rowH = GRID_ROW_PX + GRID_GAP_PX;
    const tx = Math.max(0, Math.min(Math.floor((e.clientX - rect.left) / colW), maxCols - 1));
    const ty = Math.max(0, Math.floor((e.clientY - rect.top + grid.scrollTop) / rowH));
    return { tx, ty };
  }

  // ── Resize buttons (+w, −w, +h, −h) ───────────────────────────────────

  function buildResizeControls(entry) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-resize-controls';

    const maxCols = window.innerWidth <= 900 ? 2 : GRID_COLS;

    function makeBtn(label, title, getDisabled, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layout-resize-btn';
      btn.textContent = label;
      btn.title = title;
      btn.disabled = getDisabled();
      btn.addEventListener('click', e => {
        e.stopPropagation();
        onClick();
        updateAllResizeBtns();
      });
      return btn;
    }

    const wMinus = makeBtn('−W', 'Narrower', () => entry.w <= 1,      () => { entry.w = Math.max(1, entry.w - 1); saveLayout(loadLayoutCurrent()); applyLayout(loadLayoutCurrent()); });
    const wPlus  = makeBtn('+W', 'Wider',    () => entry.w >= maxCols, () => { entry.w = Math.min(maxCols, entry.w + 1); entry.x = Math.min(entry.x, maxCols - entry.w); saveLayout(loadLayoutCurrent()); applyLayout(loadLayoutCurrent()); });
    const hMinus = makeBtn('−H', 'Shorter',  () => entry.h <= 1,      () => { entry.h = Math.max(1, entry.h - 1); saveLayout(loadLayoutCurrent()); applyLayout(loadLayoutCurrent()); });
    const hPlus  = makeBtn('+H', 'Taller',   () => false,             () => { entry.h += 1; saveLayout(loadLayoutCurrent()); applyLayout(loadLayoutCurrent()); });

    wrap.appendChild(wMinus);
    wrap.appendChild(wPlus);
    wrap.appendChild(hMinus);
    wrap.appendChild(hPlus);
    wrap.dataset.resizeControls = entry.id;
    return wrap;
  }

  let _currentLayout = null;
  function loadLayoutCurrent() { return _currentLayout || (_currentLayout = loadLayout()); }

  function updateAllResizeBtns() {
    const layout = loadLayoutCurrent();
    const maxCols = window.innerWidth <= 900 ? 2 : GRID_COLS;
    document.querySelectorAll('[data-resize-controls]').forEach(wrap => {
      const id = wrap.dataset.resizeControls;
      const entry = layout.find(e => e.id === id);
      if (!entry) return;
      const [wm, wp, hm] = wrap.querySelectorAll('.layout-resize-btn');
      wm.disabled = entry.w <= 1;
      wp.disabled = entry.w >= maxCols;
      hm.disabled = entry.h <= 1;
    });
  }

  // ── Eye (visibility) button ────────────────────────────────────────────

  function buildEyeBtn(entry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-eye-btn';
    btn.title = entry.hidden ? 'Show widget' : 'Hide widget';
    btn.innerHTML = icon(entry.hidden ? 'eye-off' : 'eye', 14);
    btn.dataset.eyeBtn = entry.id;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      entry.hidden = !entry.hidden;
      btn.title = entry.hidden ? 'Show widget' : 'Hide widget';
      btn.innerHTML = icon(entry.hidden ? 'eye-off' : 'eye', 14);
      saveLayout(loadLayoutCurrent());
      applyLayout(loadLayoutCurrent());
    });
    return btn;
  }

  // ── Resize corner (drag-to-resize) ────────────────────────────────────

  function buildResizeCorner(entry, widget) {
    const corner = document.createElement('div');
    corner.className = 'layout-resize-corner';
    corner.title = 'Drag to resize';

    corner.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const maxCols = window.innerWidth <= 900 ? 2 : GRID_COLS;
      resizeState = {
        entry, widget, maxCols,
        startX: e.clientX, startY: e.clientY,
        startW: entry.w,   startH: entry.h,
      };
      document.body.style.cursor = 'se-resize';
      document.body.style.userSelect = 'none';
    });

    return corner;
  }

  function onResizeMouseMove(e) {
    if (!resizeState) return;
    const { entry, widget, maxCols, startX, startY, startW, startH } = resizeState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const colW = document.querySelector('.widget-grid').getBoundingClientRect().width / maxCols + GRID_GAP_PX;
    const rowH = GRID_ROW_PX + GRID_GAP_PX;
    const newW = Math.max(1, Math.min(maxCols - entry.x, startW + Math.round(dx / colW)));
    const newH = Math.max(1, startH + Math.round(dy / rowH));

    widget.style.gridColumn = (entry.x + 1) + ' / span ' + newW;
    widget.style.gridRow    = (entry.y + 1) + ' / span ' + newH;
    resizeState._pendingW = newW;
    resizeState._pendingH = newH;
  }

  function onResizeMouseUp() {
    if (!resizeState) return;
    const { entry } = resizeState;
    if (resizeState._pendingW !== undefined) entry.w = resizeState._pendingW;
    if (resizeState._pendingH !== undefined) entry.h = resizeState._pendingH;
    saveLayout(loadLayoutCurrent());
    applyLayout(loadLayoutCurrent());
    updateAllResizeBtns();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    resizeState = null;
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────

  function makeDragHandlers(widget) {
    return {
      dragstart(e) {
        if (!widget.querySelector('.widget-header').contains(e.target)) {
          e.preventDefault();
          return;
        }
        dragEntry = loadLayoutCurrent().find(en => en.id === widget.dataset.widgetId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', widget.dataset.widgetId);
        setTimeout(() => widget.classList.add('layout-dragging'), 0);
      },
      dragend() {
        widget.classList.remove('layout-dragging');
        hideGhost();
        dragEntry = null;
      },
    };
  }

  function onGridDragover(e) {
    if (!dragEntry) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const { tx, ty } = gridCoords(e);
    const maxCols = window.innerWidth <= 900 ? 2 : GRID_COLS;
    const clampedX = Math.min(tx, maxCols - dragEntry.w);
    showGhost(clampedX, ty, dragEntry.w, dragEntry.h);
  }

  function onGridDrop(e) {
    e.preventDefault();
    if (!dragEntry) return;
    const { tx, ty } = gridCoords(e);
    const maxCols = window.innerWidth <= 900 ? 2 : GRID_COLS;
    dragEntry.x = Math.max(0, Math.min(tx, maxCols - dragEntry.w));
    dragEntry.y = Math.max(0, ty);
    saveLayout(loadLayoutCurrent());
    applyLayout(loadLayoutCurrent());
    hideGhost();
    dragEntry = null;
  }

  function onGridDragleave(e) {
    const grid = document.querySelector('.widget-grid');
    if (!grid.contains(e.relatedTarget)) hideGhost();
  }

  // ── Desktop Edit mode ──────────────────────────────────────────────────

  function enterEditMode() {
    editMode = true;
    _currentLayout = loadLayout();

    const grid = document.querySelector('.widget-grid');
    grid.classList.add('layout-edit-mode');

    const editBtn = document.getElementById('btn-edit-layout');
    if (editBtn) editBtn.classList.add('active');

    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'layout-ghost';
      ghost.style.display = 'none';
      grid.appendChild(ghost);
    }

    document.querySelectorAll('[data-widget-id]').forEach(widget => {
      const id = widget.dataset.widgetId;
      const entry = _currentLayout.find(e => e.id === id);
      if (!entry) return;

      const header = widget.querySelector('.widget-header');

      const handle = document.createElement('span');
      handle.className = 'layout-drag-handle';
      handle.innerHTML = icon('grip', 14);
      handle.title = 'Drag to move';
      header.prepend(handle);

      const actions = header.querySelector('.widget-header-actions');
      const eyeBtn = buildEyeBtn(entry);
      if (actions) {
        actions.prepend(eyeBtn);
      } else {
        header.appendChild(eyeBtn);
      }

      header.appendChild(buildResizeControls(entry));
      widget.appendChild(buildResizeCorner(entry, widget));

      widget.setAttribute('draggable', 'true');
      const h = makeDragHandlers(widget);
      Object.entries(h).forEach(([evt, fn]) => {
        widget.addEventListener(evt, fn);
        _listeners.push({ el: widget, evt, fn });
      });
    });

    const grid2 = document.querySelector('.widget-grid');
    const gridHandlers = {
      dragover:  onGridDragover,
      drop:      onGridDrop,
      dragleave: onGridDragleave,
    };
    Object.entries(gridHandlers).forEach(([evt, fn]) => {
      grid2.addEventListener(evt, fn);
      _listeners.push({ el: grid2, evt, fn });
    });

    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup',   onResizeMouseUp);
    _listeners.push({ el: document, evt: 'mousemove', fn: onResizeMouseMove });
    _listeners.push({ el: document, evt: 'mouseup',   fn: onResizeMouseUp });

    updateAllResizeBtns();
    applyLayout(_currentLayout);

    const resetBtn = document.createElement('button');
    resetBtn.id = 'btn-reset-layout';
    resetBtn.className = 'btn btn-secondary';
    resetBtn.title = 'Reset to default layout';
    resetBtn.innerHTML = icon('swap', 13) + ' <span class="btn-label">Reset</span>';
    resetBtn.addEventListener('click', () => {
      if (!confirm('Reset layout to default?')) return;
      localStorage.removeItem(LAYOUT_KEY);
      _currentLayout = defaultLayout();
      applyLayout(_currentLayout);
      updateAllResizeBtns();
      document.querySelectorAll('[data-eye-btn]').forEach(btn => {
        const id = btn.dataset.eyeBtn;
        const entry = _currentLayout.find(e => e.id === id);
        if (!entry) return;
        btn.title = 'Hide widget';
        btn.innerHTML = icon('eye', 14);
      });
    });
    const popoutBtn = document.getElementById('btn-popout');
    popoutBtn.parentNode.insertBefore(resetBtn, popoutBtn);
  }

  function exitEditMode() {
    editMode = false;
    _currentLayout = null;

    const grid = document.querySelector('.widget-grid');
    grid.classList.remove('layout-edit-mode');

    const editBtn = document.getElementById('btn-edit-layout');
    if (editBtn) editBtn.classList.remove('active');

    document.querySelectorAll('.layout-drag-handle, .layout-resize-controls, .layout-resize-corner, .layout-eye-btn').forEach(el => el.remove());

    document.querySelectorAll('[data-widget-id]').forEach(w => {
      w.removeAttribute('draggable');
      w.classList.remove('layout-hidden');
    });

    _listeners.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
    _listeners = [];

    if (ghost) { ghost.remove(); ghost = null; }
    document.getElementById('btn-reset-layout')?.remove();

    resizeState = null;
    applyLayout(loadLayout());
  }

  // ── Mobile Panel ───────────────────────────────────────────────────────

  let _mobileLayout = null;
  let _mobilePanel  = null;

  function showMobilePanel() {
    _mobileLayout = loadLayout().map(e => Object.assign({}, e));

    const panel = document.createElement('div');
    panel.id = 'layout-mobile-panel';
    panel.className = 'layout-mobile-panel';
    _mobilePanel = panel;

    const header = document.createElement('div');
    header.className = 'layout-mobile-panel-header';

    const title = document.createElement('span');
    title.className = 'layout-mobile-panel-title';
    title.textContent = 'Edit Layout';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', hideMobilePanel);

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn btn-primary btn-sm';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => {
      saveLayout(_mobileLayout);
      applyLayout(_mobileLayout);
      hideMobilePanel();
    });

    header.appendChild(cancelBtn);
    header.appendChild(title);
    header.appendChild(doneBtn);
    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'layout-mobile-list';
    list.id = 'layout-mobile-list';
    panel.appendChild(list);

    document.body.appendChild(panel);
    renderMobileList();

    const editBtn = document.getElementById('btn-edit-layout');
    if (editBtn) editBtn.classList.add('active');
  }

  function hideMobilePanel() {
    if (_mobilePanel) { _mobilePanel.remove(); _mobilePanel = null; }
    _mobileLayout = null;
    const editBtn = document.getElementById('btn-edit-layout');
    if (editBtn) editBtn.classList.remove('active');
  }

  function renderMobileList() {
    const list = document.getElementById('layout-mobile-list');
    if (!list) return;
    list.innerHTML = '';

    _mobileLayout.forEach((entry, idx) => {
      const meta = WIDGET_META[entry.id] || { name: entry.id, iconName: 'document' };

      const item = document.createElement('div');
      item.className = 'layout-mobile-item' + (entry.hidden ? ' layout-mobile-item-hidden' : '');

      const iconWrap = document.createElement('span');
      iconWrap.className = 'layout-mobile-item-icon';
      iconWrap.innerHTML = icon(meta.iconName, 18);

      const name = document.createElement('span');
      name.className = 'layout-mobile-item-name';
      name.textContent = meta.name;

      const controls = document.createElement('div');
      controls.className = 'layout-mobile-item-controls';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'layout-mobile-btn';
      upBtn.title = 'Move up';
      upBtn.innerHTML = icon('arrow-up', 16);
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', () => {
        if (idx === 0) return;
        [_mobileLayout[idx - 1], _mobileLayout[idx]] = [_mobileLayout[idx], _mobileLayout[idx - 1]];
        renderMobileList();
      });

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'layout-mobile-btn';
      downBtn.title = 'Move down';
      downBtn.innerHTML = icon('arrow-down', 16);
      downBtn.disabled = idx === _mobileLayout.length - 1;
      downBtn.addEventListener('click', () => {
        if (idx >= _mobileLayout.length - 1) return;
        [_mobileLayout[idx], _mobileLayout[idx + 1]] = [_mobileLayout[idx + 1], _mobileLayout[idx]];
        renderMobileList();
      });

      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'layout-mobile-btn';
      eyeBtn.title = entry.hidden ? 'Show widget' : 'Hide widget';
      eyeBtn.innerHTML = icon(entry.hidden ? 'eye-off' : 'eye', 16);
      eyeBtn.addEventListener('click', () => {
        entry.hidden = !entry.hidden;
        renderMobileList();
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(eyeBtn);

      item.appendChild(iconWrap);
      item.appendChild(name);
      item.appendChild(controls);
      list.appendChild(item);
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────

  const editBtn = document.getElementById('btn-edit-layout');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (isMobile()) {
        _mobilePanel ? hideMobilePanel() : showMobilePanel();
      } else {
        editMode ? exitEditMode() : enterEditMode();
      }
    });
  }

  applyLayout(loadLayout());

  let _resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (editMode && isMobile()) exitEditMode();
      applyLayout(editMode ? loadLayoutCurrent() : loadLayout());
    }, 150);
  });

  window.addEventListener('storage', e => {
    if (e.key === LAYOUT_KEY) {
      if (editMode) exitEditMode();
      if (_mobilePanel) hideMobilePanel();
      applyLayout(loadLayout());
    }
  });

})();
