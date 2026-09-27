import assert from 'node:assert/strict';
import { PDFDocument } from '../vendor/pdf-lib.min.mjs';
import { createItineraryPdf } from '../src/itinerary-pdf.mjs';

const bytes = await createItineraryPdf({
  trip: { name: 'São Paulo → Paris ✈️', startDate: '2026-11-18', endDate: '2026-11-19', dayCount: 2, accent: '#49bdd3' },
  days: [
    { number: 1, title: 'Embarque para a Europa', date: '2026-11-18', activities: [{ time: '16:25', title: 'Voo BA0246 — Guarulhos → Londres', place: 'Aeroporto Internacional de São Paulo', address: 'Guarulhos, SP', description: 'Passagem confirmada. '.repeat(650) }] },
    { number: 2, title: 'Chegada a Lisboa', date: '2026-11-19', activities: [] }
  ]
});
const document = await PDFDocument.load(bytes);
assert.ok(document.getPageCount() > 3, 'A agenda longa deve continuar em novas páginas');
assert.equal(document.getPage(0).getWidth().toFixed(0), '595', 'As páginas devem ser A4');
assert.ok(bytes.length > 3000, 'O arquivo deve conter o roteiro');
console.log('PDF do roteiro: geração, caracteres portugueses e paginação verificados.');
