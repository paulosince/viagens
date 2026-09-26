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
assert.equal(context.dayAttachmentPath({trip_id: 'trip', id: 'day'}, 'pdf'), 'trip/day/file-id.pdf');

console.log('PASS: day attachment types and private trip/day path');
