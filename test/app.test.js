const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('add, lend, return and delete an item', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'borrowed-items-test-'));
  const dataFile = path.join(folder, 'items.json');
  process.env.DATA_FILE = dataFile;

  const app = require('../index');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(folder, { recursive: true, force: true });
    delete process.env.DATA_FILE;
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function post(url, fields) {
    return fetch(base + url, {
      method: 'POST',
      body: new URLSearchParams(fields),
      redirect: 'manual'
    });
  }

  const health = await fetch(base + '/health');
  assert.deepEqual(await health.json(), { status: 'ok' });

  let response = await post('/items', { name: 'Umbrella' });
  assert.equal(response.status, 302);

  const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.equal(saved[0].name, 'Umbrella');
  const id = saved[0].id;

  response = await post(`/items/${id}/lend`, {
    borrower: 'Alex',
    dueDate: 'not-a-date'
  });
  assert.equal(response.status, 400);

  response = await post(`/items/${id}/lend`, {
    borrower: 'Alex',
    dueDate: '2000-01-01'
  });
  assert.equal(response.status, 302);

  let page = await (await fetch(base)).text();
  assert.match(page, /lent to Alex/);
  assert.match(page, /OVERDUE/);

  response = await post(`/items/${id}/lend`, {
    borrower: 'Sam',
    dueDate: '2030-01-01'
  });
  assert.equal(response.status, 409);

  response = await post(`/items/${id}/return`, {});
  assert.equal(response.status, 302);
  page = await (await fetch(base)).text();
  assert.match(page, /Umbrella<\/strong> — available/);

  response = await post(`/items/${id}/delete`, {});
  assert.equal(response.status, 302);
  assert.deepEqual(JSON.parse(fs.readFileSync(dataFile, 'utf8')), []);
});