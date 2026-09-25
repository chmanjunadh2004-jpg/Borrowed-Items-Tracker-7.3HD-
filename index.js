const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const app = express();
const port = process.env.PORT || 3000;
const dataFile = process.env.DATA_FILE || path.join(__dirname, 'items.json');

app.use(express.urlencoded({ extended: false }));

function readItems() {
  if (!fs.existsSync(dataFile)) return [];
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function saveItems(items) {
  fs.writeFileSync(dataFile, JSON.stringify(items, null, 2));
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function todayAsText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

app.get('/', (req, res) => {
  const items = readItems();
  const today = todayAsText();

  const list = items.map(item => {
    const name = safeText(item.name);
    const deleteButton = `
      <form method="post" action="/items/${item.id}/delete">
        <button type="submit">Delete item</button>
      </form>
    `;

    if (item.borrower) {
      const overdue = item.dueDate < today ? ' — OVERDUE' : '';

      return `
        <li>
          <strong>${name}</strong> — lent to ${safeText(item.borrower)}
          (due ${safeText(item.dueDate)})${overdue}
          <form method="post" action="/items/${item.id}/return">
            <button type="submit">Mark returned</button>
          </form>
          ${deleteButton}
        </li>
      `;
    }

    return `
      <li>
        <strong>${name}</strong> — available
        <form method="post" action="/items/${item.id}/lend">
          <input name="borrower" placeholder="Borrower's name"
                 maxlength="80" required>
          <input name="dueDate" type="date" required>
          <button type="submit">Lend item</button>
        </form>
        ${deleteButton}
      </li>
    `;
  }).join('');

  res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Borrowed Items Tracker</title>
      </head>
      <body>
        <h1>Borrowed Items Tracker</h1>
        <p>Keep track of items you lend to other people.</p>

        <form method="post" action="/items">
          <label for="item-name">Item name</label>
          <input id="item-name" name="name" maxlength="80" required>
          <button type="submit">Add item</button>
        </form>

        <h2>My items</h2>
        <ul>${list || '<li>No items yet</li>'}</ul>
      </body>
    </html>
  `);
});

app.post('/items', (req, res) => {
  const name = typeof req.body.name === 'string'
    ? req.body.name.trim()
    : '';

  if (!name || name.length > 80) {
    return res.status(400).send('Enter a valid item name.');
  }

  const items = readItems();
  items.push({
    id: randomUUID(),
    name,
    borrower: null,
    dueDate: null
  });

  saveItems(items);
  res.redirect('/');
});

app.post('/items/:id/lend', (req, res) => {
  const items = readItems();
  const item = items.find(entry => entry.id === req.params.id);

  if (!item) return res.status(404).send('Item not found.');
  if (item.borrower) return res.status(409).send('Item is already lent.');

  const borrower = typeof req.body.borrower === 'string'
    ? req.body.borrower.trim()
    : '';
  const dueDate = req.body.dueDate;

  if (!borrower || borrower.length > 80 || !validDate(dueDate)) {
    return res.status(400).send('Enter a borrower and a valid due date.');
  }

  item.borrower = borrower;
  item.dueDate = dueDate;
  saveItems(items);
  res.redirect('/');
});

app.post('/items/:id/return', (req, res) => {
  const items = readItems();
  const item = items.find(entry => entry.id === req.params.id);

  if (!item) return res.status(404).send('Item not found.');
  if (!item.borrower) return res.status(409).send('Item is not lent.');

  item.borrower = null;
  item.dueDate = null;
  saveItems(items);
  res.redirect('/');
});

app.post('/items/:id/delete', (req, res) => {
  const items = readItems();
  const remaining = items.filter(item => item.id !== req.params.id);

  if (remaining.length === items.length) {
    return res.status(404).send('Item not found.');
  }

  saveItems(remaining);
  res.redirect('/');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`App running at http://localhost:${port}`);
  });
}

module.exports = app;