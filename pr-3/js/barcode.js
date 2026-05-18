function extractDigits(line) {
  return line.replace(/\D/g, '');
}

function validateUPC(d) {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(d[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === parseInt(d[11]);
}

function validateEAN13(d) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(d[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10 === parseInt(d[12]);
}

function formatHD6(d) {
  return d.slice(0, 3) + '-' + d.slice(3, 6);
}

function formatHD10(d) {
  return d.slice(0, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7, 10);
}

function detectBarcode(digits) {
  if (!digits || !/^\d+$/.test(digits)) return null;

  if (digits.length === 6) {
    return { type: 'HD6', formatted: formatHD6(digits), value: digits, valid: true };
  }
  if (digits.length === 10) {
    return { type: 'HD10', formatted: formatHD10(digits), value: digits, valid: true };
  }
  if (digits.length === 12) {
    const valid = validateUPC(digits);
    return { type: 'UPC', formatted: digits, value: digits, valid };
  }
  if (digits.length === 13) {
    const valid = validateEAN13(digits);
    return { type: 'EAN13', formatted: digits, value: digits, valid };
  }
  return null;
}

function buildBarcodeElement(barcode, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'barcode-block';

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'barcode-label';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
  }

  if (!barcode.valid) {
    const err = document.createElement('span');
    err.className = 'barcode-error';
    err.textContent = '⚠ Invalid check digit: ' + barcode.formatted;
    wrapper.appendChild(err);
    return wrapper;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  let format;
  if (barcode.type === 'UPC') {
    format = 'UPC';
  } else if (barcode.type === 'EAN13') {
    format = 'EAN13';
  } else {
    format = 'CODE128';
  }

  try {
    JsBarcode(svg, barcode.value, {
      format: format,
      displayValue: true,
      text: barcode.formatted,
      width: 1.5,
      height: 55,
      margin: 6,
      fontSize: 12,
      fontOptions: '',
      textMargin: 4
    });
  } catch (e) {
    const err = document.createElement('span');
    err.className = 'barcode-error';
    err.textContent = '⚠ Could not render barcode: ' + barcode.formatted;
    wrapper.appendChild(err);
    return wrapper;
  }

  wrapper.appendChild(svg);
  return wrapper;
}
