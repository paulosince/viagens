import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.min.mjs';

const PAGE = [595.28, 841.89];
const MARGIN = 52;
const INK = rgb(.07, .12, .20);
const MUTED = rgb(.39, .44, .51);
const RULE = rgb(.86, .89, .91);

function dateLabel(value, options = { day: '2-digit', month: 'long', year: 'numeric' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
}

function safeText(value, font) {
  return String(value || '').replace(/[→←]/g, ' - ').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').replace(/\s+/g, ' ').trim().split('').map(char => {
    try { font.encodeText(char); return char; }
    catch {
      const fallback = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      try { font.encodeText(fallback); return fallback; }
      catch { return char === '→' || char === '←' ? '-' : '?'; }
    }
  }).join('');
}

function wrap(value, font, size, width) {
  const words = safeText(value, font).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (font.widthOfTextAtSize(line ? line + ' ' + word : word, size) <= width) {
      line = line ? line + ' ' + word : word;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    // Break a single long URL or word so it cannot run past the page edge.
    for (const char of word) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function accentColor(hex) {
  const match = /^#([\da-f]{6})$/i.exec(String(hex || ''));
  if (!match) return rgb(.05, .48, .91);
  const bytes = match[1].match(/../g).map(byte => parseInt(byte, 16) / 255);
  return rgb(...bytes);
}

export async function createItineraryPdf({ trip, days }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = accentColor(trip.accent);
  const usable = PAGE[0] - MARGIN * 2;
  let page;
  let y;

  function newPage() {
    page = pdf.addPage(PAGE);
    page.drawRectangle({ x: 0, y: PAGE[1] - 13, width: PAGE[0], height: 13, color: accent });
    y = PAGE[1] - 74;
  }

  function lines(value, { font = regular, size = 11, color = INK, lineHeight = size * 1.4, indent = 0, after = 0 } = {}) {
    for (const line of wrap(value, font, size, usable - indent)) {
      if (y - lineHeight < 65) newPage();
      page.drawText(line, { x: MARGIN + indent, y, font, size, color });
      y -= lineHeight;
    }
    y -= after;
  }

  newPage();
  y -= 77;
  lines('VIAGGIO  /  ROTEIRO DE VIAGEM', { font: bold, size: 11, color: accent, after: 22 });
  lines(trip.name || 'Minha viagem', { font: bold, size: 35, lineHeight: 43, after: 16 });
  const range = [dateLabel(trip.startDate), dateLabel(trip.endDate)].filter(Boolean).join('  —  ');
  if (range) lines(range, { size: 15, color: MUTED, after: 22 });
  lines(`${trip.dayCount || days.length} ${Number(trip.dayCount || days.length) === 1 ? 'dia' : 'dias'} de viagem`, { font: bold, size: 15, color: accent });
  page.drawLine({ start: { x: MARGIN, y: y - 31 }, end: { x: PAGE[0] - MARGIN, y: y - 31 }, thickness: 1, color: RULE });
  y -= 58;
  lines('Seus dias, lugares e horários em um só lugar.', { size: 12, color: MUTED });

  for (const day of days) {
    newPage();
    lines(`DIA ${day.number}`, { font: bold, size: 12, color: accent, after: 13 });
    lines(day.title || `Dia ${day.number}`, { font: bold, size: 25, lineHeight: 32, after: 9 });
    const date = dateLabel(day.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (date) lines(date, { size: 12, color: MUTED, after: 22 });
    if (day.summary?.trim()) lines(day.summary, { size: 11, color: MUTED, after: 18 });
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE[0] - MARGIN, y }, thickness: 1, color: RULE });
    y -= 28;
    if (!day.activities.length) lines('Dia livre · nenhuma atividade planejada.', { size: 11, color: MUTED });

    for (const activity of day.activities) {
      if (y < 148) newPage();
      const time = safeText(activity.time, bold) || '—';
      page.drawText(time, { x: MARGIN, y, font: bold, size: 12, color: accent });
      const position = y;
      lines(activity.title || 'Atividade', { font: bold, size: 13, lineHeight: 18, indent: 76, after: 4 });
      if (activity.place) lines(activity.place, { size: 10.5, color: MUTED, indent: 76, after: 3 });
      if (activity.address && activity.address !== activity.place) lines(activity.address, { size: 10, color: MUTED, indent: 76, after: 3 });
      if (activity.description && activity.description !== 'Adicione uma descrição') lines(activity.description, { size: 10.5, indent: 76, after: 4 });
      y = Math.min(y, position - 31) - 13;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({ start: { x: MARGIN, y: 48 }, end: { x: PAGE[0] - MARGIN, y: 48 }, thickness: .6, color: RULE });
    sheet.drawText('VIAGGIO  ·  ROTEIRO', { x: MARGIN, y: 32, font: bold, size: 8, color: MUTED });
    const number = `${index + 1} / ${pages.length}`;
    sheet.drawText(number, { x: PAGE[0] - MARGIN - regular.widthOfTextAtSize(number, 9), y: 32, font: regular, size: 9, color: MUTED });
  });
  pdf.setTitle(safeText(trip.name || 'Roteiro de viagem', regular));
  pdf.setCreator('Viaggio');
  return pdf.save();
}
