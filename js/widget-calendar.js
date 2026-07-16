// Calendar widget — static month grid for the current month.
(function () {
  'use strict';

  let calSelectedCell = null;

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


  initCalendar();
})();
