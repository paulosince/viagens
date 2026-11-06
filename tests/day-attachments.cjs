const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('const DAY_ATTACHMENT_BUCKET');
const end = source.indexOf('\nfunction setDayAttachmentStatus(', start);
assert.ok(start >= 0 && end > start);

const context = { crypto: { randomUUID: () => 'file-id' } };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const type = file => context.dayAttachmentType(file);
assert.equal(type({name: 'Ingresso.PDF', type: 'application/pdf'}).type, 'application/pdf');
assert.equal(type({name: 'Passagem.HEIC', type: ''}).extension, 'heic');
assert.equal(type({name: 'Reserva.docx', type: 'application/octet-stream'}).extension, 'docx');
assert.equal(type({name: 'script.html', type: 'text/html'}), null);
assert.equal(type({name: 'disfarçado.pdf', type: 'text/html'}), null);
assert.equal(context.dayAttachmentPath('trip', 'day', 'pdf'), 'trip/day/file-id.pdf');
assert.equal(context.dayAttachmentPath('trip', null, 'pdf'), 'trip/general/file-id.pdf');

(async () => {
  const inserted = [];
  const paths = [];
  const client = {
    storage: { from(bucket) {
      assert.equal(bucket, 'day-attachments');
      return { async upload(path) { paths.push(path); return { error: null }; }, async remove() { return { error: null }; } };
    } },
    from(table) {
      assert.equal(table, 'day_attachments');
      return { insert(row) { inserted.push(row); return { error: null, select() { return { single: async () => ({ data: row, error: null }) }; } }; } };
    }
  };
  const file = { name: 'Passagem.pdf', size: 1024, type: 'application/pdf' };
  await context.storeTripAttachment(client, 'trip', null, file);
  await context.storeTripAttachment(client, 'trip', 'day', file);
  assert.deepEqual(paths, ['trip/general/file-id.pdf', 'trip/day/file-id.pdf']);
  assert.equal(inserted[0].trip_id, 'trip');
  assert.equal(inserted[0].day_id, null);
  assert.equal(inserted[1].day_id, 'day');
  const neonSource = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
  const neonStart = neonSource.indexOf('const DAY_ATTACHMENT_BUCKET');
  const neonEnd = neonSource.indexOf('\nfunction setDayAttachmentStatus(', neonStart);
  assert.ok(neonStart >= 0 && neonEnd > neonStart, 'Neon attachment functions are available');
  const neonContext = { crypto: { randomUUID: () => 'file-id' } };
  vm.createContext(neonContext);
  vm.runInContext(neonSource.slice(neonStart, neonEnd), neonContext);

  const ticket = { name: 'Bateaux-Mouches.jpeg', size: 8 * 1024 * 1024, type: 'image/jpeg' };
  await neonContext.storeTripAttachment(client, 'trip', 'day', ticket);
  assert.equal(inserted.at(-1).size_bytes, ticket.size, 'JPEG over 6 MB is accepted');
  const uploadCount = paths.length;
  await assert.rejects(
    neonContext.storeTripAttachment(client, 'trip', 'day', { ...ticket, size: 20 * 1024 * 1024 + 1 }),
    /até 20 MB/
  );
  assert.equal(paths.length, uploadCount, 'Oversized attachment is rejected before upload');
  console.log('PASS: trip attachments accept up to 20 MB in Neon and reject larger files');
})().catch(error => { console.error(error); process.exitCode = 1; });
