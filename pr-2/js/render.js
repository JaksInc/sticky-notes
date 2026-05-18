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

  for (const line of lines) {
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

    const digits = extractDigits(line);
    const barcode = digits.length >= 6 ? detectBarcode(digits) : null;

    if (barcode && digits === extractDigits(line) && line.trim() !== '') {
      frag.appendChild(buildBarcodeElement(barcode));
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
