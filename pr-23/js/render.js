function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Detect "Label: digits" pattern — label before colon, valid barcode digits after
function parseLabeledBarcode(line) {
  const colonIdx = line.lastIndexOf(':');
  if (colonIdx < 1) return null;

  const label = line.slice(0, colonIdx).trim();
  const after = line.slice(colonIdx + 1).trim();
  if (!label || !after) return null;

  // After the colon must contain only digits, spaces, dashes
  if (!/^[\d\s-]+$/.test(after)) return null;

  const digits = extractDigits(after);
  const barcode = detectBarcode(digits);
  if (!barcode) return null;

  return { ...barcode, label };
}

function renderContent(content) {
  const frag = document.createDocumentFragment();
  const lines = (content || '').split('\n');
  let currentList = null;

  function flushList() {
    if (currentList) {
      frag.appendChild(currentList);
      currentList = null;
    }
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    const checkMatch = line.match(/^\[([ x])\] (.*)$/i);
    if (checkMatch) {
      flushList();
      const checked = checkMatch[1].toLowerCase() === 'x';
      const div = document.createElement('div');
      div.className = 'check-item' + (checked ? ' checked' : '');
      div.dataset.line = lineIdx;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      const span = document.createElement('span');
      span.textContent = checkMatch[2];
      div.appendChild(cb);
      div.appendChild(span);
      frag.appendChild(div);
      continue;
    }

    const bulletMatch = line.match(/^[-*] (.*)$/);
    if (bulletMatch) {
      if (!currentList) {
        currentList = document.createElement('ul');
        currentList.className = 'bullet-list';
      }
      const li = document.createElement('li');
      li.textContent = bulletMatch[1];
      currentList.appendChild(li);
      continue;
    }
    flushList();

    // Labeled barcode: "Label: 123456"
    const labeled = parseLabeledBarcode(line);
    if (labeled) {
      frag.appendChild(buildBarcodeElement(labeled, labeled.label));
      continue;
    }

    // Unlabeled barcode: digits-only line
    const digits = extractDigits(line);
    const barcode = digits.length >= 6 ? detectBarcode(digits) : null;
    if (barcode && digits === extractDigits(line) && line.trim() !== '') {
      frag.appendChild(buildBarcodeElement(barcode, null));
      continue;
    }

    const p = document.createElement('p');
    p.className = 'text-line';
    if (line.trim() === '') {
      p.innerHTML = '&nbsp;';
    } else {
      p.textContent = line;
    }
    frag.appendChild(p);
  }

  flushList();
  return frag;
}

// Lightweight renderer for card previews — no SVG barcodes, just formatted text
function renderPreview(content) {
  const lines = (content || '').split('\n');
  const parts = [];
  let inList = false;

  for (const line of lines) {
    const checkMatch = line.match(/^\[([ x])\] (.*)$/i);
    if (checkMatch) {
      if (inList) { parts.push('</ul>'); inList = false; }
      const checked = checkMatch[1].toLowerCase() === 'x';
      const icon = checked ? '☑' : '☐';
      const text = escapeHtml(checkMatch[2]);
      const style = checked ? ' style="text-decoration:line-through;color:#999"' : '';
      parts.push(`<div class="preview-line"${style}>${icon} ${text}</div>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*] (.*)$/);
    if (bulletMatch) {
      if (!inList) { parts.push('<ul class="preview-list">'); inList = true; }
      parts.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
      continue;
    }
    if (inList) { parts.push('</ul>'); inList = false; }

    const labeled = parseLabeledBarcode(line);
    if (labeled) {
      const labelText = escapeHtml(labeled.label) + ': ';
      parts.push(`<div class="preview-barcode">${labelText}<span class="preview-barcode-num">${escapeHtml(labeled.formatted)}</span></div>`);
      continue;
    }

    const digits = extractDigits(line);
    const barcode = digits.length >= 6 && line.trim() !== '' && digits === extractDigits(line) ? detectBarcode(digits) : null;
    if (barcode) {
      parts.push(`<div class="preview-barcode"><span class="preview-barcode-num">${escapeHtml(barcode.formatted)}</span></div>`);
      continue;
    }

    if (line.trim() === '') {
      parts.push('<div class="preview-line">&nbsp;</div>');
    } else {
      parts.push(`<div class="preview-line">${escapeHtml(line)}</div>`);
    }
  }

  if (inList) parts.push('</ul>');
  return parts.join('');
}
