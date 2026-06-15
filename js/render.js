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

  if (!/^[\d\s-]+$/.test(after)) return null;

  const digits = extractDigits(after);
  const barcode = detectBarcode(digits);
  if (!barcode) return null;

  return { ...barcode, label };
}

function detectBarcodeOnlyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const digits = extractDigits(trimmed);
  if (digits.length >= 6 && digits === extractDigits(trimmed)) return detectBarcode(digits);
  return null;
}

// Wrap a block HTML string with blank lines so marked treats it as a standalone
// HTML block and doesn't consume surrounding lines.
function htmlBlock(html) {
  return '\n' + html + '\n';
}

// Full renderer for note.html view mode: interactive checkboxes, SVG barcodes
function renderContent(content) {
  const lines = (content || '').split('\n');
  const barcodes = [];

  const processedLines = lines.map((line, lineIdx) => {
    // Interactive task checkbox — data-line preserved for toggle handler
    const checkMatch = line.match(/^\[([ x])\] (.*)$/i);
    if (checkMatch) {
      const checked = checkMatch[1].toLowerCase() === 'x';
      const text = escapeHtml(checkMatch[2]);
      return htmlBlock(
        `<div class="check-item${checked ? ' checked' : ''}" data-line="${lineIdx}">` +
        `<input type="checkbox"${checked ? ' checked' : ''}><span>${text}</span></div>`
      );
    }

    // Labeled barcode
    const labeled = parseLabeledBarcode(line);
    if (labeled) {
      const idx = barcodes.length;
      barcodes.push({ barcode: labeled, label: labeled.label });
      return htmlBlock(`<div class="barcode-placeholder" data-idx="${idx}"></div>`);
    }

    // Unlabeled barcode (digits-only line)
    const barcode = detectBarcodeOnlyLine(line);
    if (barcode) {
      const idx = barcodes.length;
      barcodes.push({ barcode, label: null });
      return htmlBlock(`<div class="barcode-placeholder" data-idx="${idx}"></div>`);
    }

    return line;
  });

  const html = marked.parse(processedLines.join('\n'));
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  // Replace barcode placeholders with rendered SVG elements
  wrapper.querySelectorAll('.barcode-placeholder').forEach(el => {
    const { barcode, label } = barcodes[parseInt(el.dataset.idx)];
    el.replaceWith(buildBarcodeElement(barcode, label));
  });

  const frag = document.createDocumentFragment();
  while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
  return frag;
}

// Lightweight renderer for card previews: visual-only checkboxes, barcodes as text
function renderPreview(content) {
  const lines = (content || '').split('\n');
  const barcodes = [];

  const processedLines = lines.map(line => {
    // Visual-only checkbox (no interactivity in card preview)
    const checkMatch = line.match(/^\[([ x])\] (.*)$/i);
    if (checkMatch) {
      const checked = checkMatch[1].toLowerCase() === 'x';
      const icon = checked ? '☑' : '☐';
      const text = escapeHtml(checkMatch[2]);
      const style = checked ? ' style="text-decoration:line-through;color:#999"' : '';
      return htmlBlock(`<div class="preview-check"${style}>${icon} ${text}</div>`);
    }

    // Labeled barcode (text only in preview)
    const labeled = parseLabeledBarcode(line);
    if (labeled) {
      const idx = barcodes.length;
      barcodes.push({ barcode: labeled, label: labeled.label });
      return htmlBlock(`<div class="barcode-placeholder" data-idx="${idx}"></div>`);
    }

    // Unlabeled barcode (text only in preview)
    const barcode = detectBarcodeOnlyLine(line);
    if (barcode) {
      const idx = barcodes.length;
      barcodes.push({ barcode, label: null });
      return htmlBlock(`<div class="barcode-placeholder" data-idx="${idx}"></div>`);
    }

    return line;
  });

  const html = marked.parse(processedLines.join('\n'));
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('.barcode-placeholder').forEach(el => {
    const { barcode, label } = barcodes[parseInt(el.dataset.idx)];
    const div = document.createElement('div');
    div.className = 'preview-barcode';
    const num = document.createElement('span');
    num.className = 'preview-barcode-num';
    num.textContent = label ? label + ': ' + barcode.formatted : barcode.formatted;
    div.appendChild(num);
    el.replaceWith(div);
  });

  return wrapper.innerHTML;
}

marked.use({ breaks: true, gfm: true });
