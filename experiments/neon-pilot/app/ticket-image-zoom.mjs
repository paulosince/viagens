// Ticket originals stay untouched; zoom changes only their rendered dimensions.
export function fittedImageWidth(naturalWidth, viewportWidth) {
  return Math.max(1, Math.min(naturalWidth || 1, Math.max(1, viewportWidth - 32)));
}
export function mountTicketImageZoom({image, viewport, footer}) {
  let scale = 1;
  const controls = document.createElement('div');
  controls.className = 'ticket-image-zoom';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Zoom do comprovante');
  const button = (label, text) => {
    const el = document.createElement('button');
    el.type = 'button'; el.setAttribute('aria-label', label); el.textContent = text;
    controls.append(el); return el;
  };
  const minus = button('Diminuir imagem', '−');
  const reset = button('Ajustar imagem à tela', '100%');
  const plus = button('Ampliar imagem', '+');
  footer.prepend(controls);
  viewport.dataset.imageZoom = 'true';
  function render(next = scale) {
    scale = Math.max(1, Math.min(8, next));
    image.style.width = fittedImageWidth(image.naturalWidth, viewport.clientWidth) * scale + 'px';
    reset.textContent = Math.round(scale * 100) + '%';
    minus.disabled = scale === 1; plus.disabled = scale === 8;
  }
  minus.onclick = () => render(scale / 2);
  plus.onclick = () => render(scale * 2);
  reset.onclick = () => { render(1); viewport.scrollTo(0, 0); };
  const toggle = () => render(scale === 1 ? 2 : 1);
  image.addEventListener('dblclick', toggle);
  image.addEventListener('load', renderLoaded);
  function renderLoaded() { render(); }
  const resize = new ResizeObserver(() => render());
  resize.observe(viewport);
  if (image.complete && image.naturalWidth) render();
  return () => {
    resize.disconnect(); controls.remove();
    image.removeEventListener('dblclick', toggle);
    image.removeEventListener('load', renderLoaded);
    delete viewport.dataset.imageZoom;
  };
}
