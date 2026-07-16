// Quick Links widget — self-contained; owns its cloud re-render.
(function () {
  'use strict';

  let linkFormColor = null;
  let editingLinkId = null;
  let editFormColor = null;

  function getFaviconUrl(url) {
    try {
      var domain = new URL(url).hostname;
      return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64';
    } catch(_) { return ''; }
  }

  function getInitials(name) {
    return (name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase() || '?';
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

  function loadLinks() {
    try { return JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); }
    catch { return []; }
  }

  function saveLinks(links) {
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
    window.cloudSync?.('sticky-links');
  }

  // Tombstoned links stay in storage so their deletion syncs, but are hidden.
  function visibleLinks() { return loadLinks().filter(l => !l.deleted); }

  function deleteLink(id) {
    saveLinks(loadLinks().map(l =>
      l.id === id ? { ...l, deleted: true, modified: Date.now() } : l));
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

        let editUseInitials = !!link.useInitials;

        const initialsBtn = document.createElement('button');
        initialsBtn.type = 'button';
        initialsBtn.className = 'link-initials-btn';
        initialsBtn.title = 'Toggle initials / favicon';

        let syncInitialsBtn = () => {};

        const colorRow = buildLinkColorRow(editFormColor, color => {
          editFormColor = editFormColor === color ? null : color;
          syncInitialsBtn();
          return editFormColor;
        });

        syncInitialsBtn = function () {
          initialsBtn.textContent = getInitials(nameInput.value);
          initialsBtn.style.background = editFormColor || '';
          initialsBtn.classList.toggle('active', editUseInitials);
        };
        syncInitialsBtn();

        nameInput.addEventListener('input', syncInitialsBtn);
        initialsBtn.addEventListener('click', () => {
          editUseInitials = !editUseInitials;
          syncInitialsBtn();
        });

        function saveEdit() {
          const name = nameInput.value.trim();
          const url = urlInput.value.trim();
          if (!name || !url) return;
          const finalUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
          const all = loadLinks();
          const i = all.findIndex(l => l.id === link.id);
          if (i !== -1) {
            all[i] = { ...all[i], name, url: finalUrl, color: editFormColor || null, useInitials: editUseInitials, modified: Date.now() };
          }
          saveLinks(all);
          editingLinkId = null;
          editFormColor = null;
          renderLinks();
        }

        function cancelEdit() {
          editingLinkId = null;
          editFormColor = null;
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
        form.appendChild(colorRow);
        form.appendChild(initialsBtn);
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
      if (link.useInitials) {
        iconEl.textContent = getInitials(link.name);
        iconEl.classList.add('link-tile-letter');
      } else {
        const faviconUrl = getFaviconUrl(link.url);
        if (faviconUrl) {
          const img = document.createElement('img');
          img.className = 'link-tile-favicon';
          img.src = faviconUrl;
          img.alt = '';
          img.width = 24;
          img.height = 24;
          img.addEventListener('error', function () {
            iconEl.removeChild(img);
            iconEl.textContent = getInitials(link.name);
            iconEl.classList.add('link-tile-letter');
          });
          iconEl.appendChild(img);
        } else {
          iconEl.textContent = getInitials(link.name);
          iconEl.classList.add('link-tile-letter');
        }
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
        deleteLink(link.id);
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
    const links = visibleLinks();
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

      let addUseInitials = false;

      const initialsBtn = document.createElement('button');
      initialsBtn.type = 'button';
      initialsBtn.className = 'link-initials-btn';
      initialsBtn.title = 'Toggle initials / favicon';

      let syncInitialsBtn = () => {};

      const colorRow = buildLinkColorRow(linkFormColor, color => {
        linkFormColor = linkFormColor === color ? null : color;
        syncInitialsBtn();
        return linkFormColor;
      });

      syncInitialsBtn = function () {
        initialsBtn.textContent = getInitials(nameInput.value);
        initialsBtn.style.background = linkFormColor || '';
        initialsBtn.classList.toggle('active', addUseInitials);
      };
      syncInitialsBtn();

      nameInput.addEventListener('input', syncInitialsBtn);
      initialsBtn.addEventListener('click', () => {
        addUseInitials = !addUseInitials;
        syncInitialsBtn();
      });

      const actions = document.createElement('div');
      actions.className = 'link-form-actions';

      function saveLink() {
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        if (!name || !url) return;
        const finalUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
        const all = loadLinks();
        all.push({ id: crypto.randomUUID(), name, url: finalUrl, color: linkFormColor || null, useInitials: addUseInitials, modified: Date.now() });
        saveLinks(all);
        linksFormOpen = false;
        linkFormColor = null;
        renderLinks();
      }

      function cancelAdd() {
        linksFormOpen = false;
        linkFormColor = null;
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
      form.appendChild(colorRow);
      form.appendChild(initialsBtn);
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
      editingLinkId = null;
      renderLinks();
    });
  }


  initLinks();

  window.addEventListener('cloud-applied', function (e) {
    if (e.detail.key === 'sticky-links') renderLinks();
  });
})();
