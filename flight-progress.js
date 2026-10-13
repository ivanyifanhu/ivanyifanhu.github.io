(() => {
  'use strict';
  const host = document.getElementById('flight-progress');
  if (!host) return;
  const doc = document.documentElement;
  const entry = document.getElementById('entry');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const words = {
    en: { label: 'Reading position', help: 'Drag to scroll. Use arrow keys, Page Up, Page Down, Home or End.', value: p => `${p}% read`, end: 'End of page' },
    ja: { label: '読書位置', help: 'ドラッグでスクロール。矢印キー、Page Up、Page Down、Home、Endでも移動できます。', value: p => `${p}% 読了`, end: 'ページの終わり' },
    zh: { label: '阅读位置', help: '拖动以滚动页面，也可使用方向键、Page Up、Page Down、Home 或 End。', value: p => `已读 ${p}%`, end: '已到页底' }
  };
  // The courier carries folded paper wings. Both poses are original SVG drawings.
  host.innerHTML = `
    <span class="flight-track" aria-hidden="true"><span class="flight-travelled"></span></span>
    <span class="flight-thumb" aria-hidden="true">
      <svg class="flight-courier" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <g class="flight-ray"><path d="M20 1v6M20 57v6M0 32h6M34 32h6M5 11l4 4M31 49l4 4M5 53l4-4M31 15l4-4"/></g>
        <g class="flight-flying">
          <g class="flight-pages" fill="#d6cda9" stroke="#495d53" stroke-width="1.2" stroke-linejoin="miter">
            <path d="M17 22 5 26 8 45 18 38Z"/><path d="M23 22 35 26 32 45 22 38Z"/>
            <path d="m8 29 3 12M32 29l-3 12" fill="none" stroke="#a69d7d"/>
          </g>
          <path d="M15 38h5v16h-7v-5h2ZM20 38h5v11h2v5h-7Z" fill="#465c52"/>
          <path d="M13 51h7v5h-8v-3ZM20 51h7l1 2v3h-8Z" fill="#293c34"/>
          <path d="M13 25 10 22V8h5v14h10V8h5v14l-3 3v15H13Z" fill="#6d8678" stroke="#334b40" stroke-width="1.1"/>
          <path d="M10 5h5v6h-5ZM25 5h5v6h-5Z" fill="#c7b99c"/>
          <path d="M15 13h10v11H15Z" fill="#cfbfa0" stroke="#334b40" stroke-width="1.1"/>
          <path d="M14 11h12v6H14Z" fill="#3c5347"/>
          <path d="M17 19h6" stroke="#687864" stroke-width="1.2"/>
          <path d="M14 29h12v3H14Z" fill="#ded6b9"/>
          <path d="M19 25h2v14" stroke="#405c4c" stroke-width="1.1"/>
        </g>
        <g class="flight-standing">
          <g fill="#d6cda9" stroke="#495d53" stroke-width="1.2"><path d="M15 22 7 27 9 42 17 37Z"/><path d="M25 22 33 27 31 42 23 37Z"/></g>
          <path d="M14 38h6v18h-7v-4h1ZM20 38h6v14h1v4h-7Z" fill="#465c52"/>
          <path d="M13 54h7v5h-9v-3ZM20 54h7l2 2v3h-9Z" fill="#293c34"/>
          <path d="M13 23h14v17H13Z" fill="#6d8678" stroke="#334b40" stroke-width="1.1"/>
          <path d="m13 24-7 5 6 8 3-3-4-5 4-2m12-3 7 5-6 8-3-3 4-5-4-2" fill="#6d8678" stroke="#334b40" stroke-width="1.1"/>
          <path d="M12 33h4v4h-4ZM24 33h4v4h-4Z" fill="#c7b99c"/>
          <path d="M15 12h10v12H15Z" fill="#cfbfa0" stroke="#334b40" stroke-width="1.1"/>
          <path d="M14 10h12v6H14Z" fill="#3c5347"/>
          <path d="M17 19h6" stroke="#687864" stroke-width="1.2"/>
          <path d="M14 29h12v3H14Z" fill="#ded6b9"/>
          <path d="M19 25h2v14" stroke="#405c4c" stroke-width="1.1"/>
        </g>
      </svg>
    </span>
    <span class="flight-ground" aria-hidden="true"></span>
    <span class="flight-sr-only" id="flight-progress-help"></span>`;
  host.setAttribute('role', 'slider');
  host.setAttribute('tabindex', '0');
  host.setAttribute('aria-orientation', 'vertical');
  host.setAttribute('aria-valuemin', '0');
  host.setAttribute('aria-valuemax', '100');
  host.setAttribute('aria-describedby', 'flight-progress-help');
  host.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown PageUp PageDown Home End');
  const thumb = host.querySelector('.flight-thumb');
  const help = host.querySelector('.flight-sr-only');
  let requestedVisible = true;
  let frame = 0;
  let drag = null;
  let lastY = window.scrollY;
  let landed = false;
  let landTimer = 0;
  let previousLang = '';
  let previousPercent = -1;

  function metrics() {
    const page = document.scrollingElement || doc;
    const maximum = Math.max(0, page.scrollHeight - doc.clientHeight);
    const y = Math.min(maximum, Math.max(0, window.scrollY));
    return { maximum, y, ratio: maximum > 0 ? y / maximum : 1 };
  }
  function labels(percent, atEnd) {
    const language = (doc.lang || 'en').split('-')[0];
    const word = words[language] || words.en;
    if (language !== previousLang) {
      host.setAttribute('aria-label', word.label);
      help.textContent = word.help;
      previousLang = language;
      previousPercent = -1;
    }
    if (percent !== previousPercent || atEnd !== landed) {
      host.setAttribute('aria-valuenow', String(percent));
      host.setAttribute('aria-valuetext', atEnd ? word.end : word.value(percent));
      host.title = `${word.label} · ${atEnd ? word.end : word.value(percent)}`;
      previousPercent = percent;
    }
  }
  function render() {
    frame = 0;
    const visible = requestedVisible && (!entry || entry.hidden);
    host.hidden = !visible;
    if (!visible) return;
    const position = metrics();
    const travel = Math.max(0, host.clientHeight - thumb.offsetHeight);
    const atEnd = position.maximum < 1 || position.maximum - position.y <= 2;
    // Direction follows the reader, including when the thumb is being dragged.
    if (Math.abs(position.y - lastY) > .5) host.classList.toggle('is-rising', position.y < lastY);
    lastY = position.y;
    host.style.setProperty('--flight-y', `${(position.ratio * travel).toFixed(2)}px`);
    host.style.setProperty('--flight-progress', position.ratio.toFixed(5));
    labels(Math.round(position.ratio * 100), atEnd);
    if (atEnd !== landed) {
      clearTimeout(landTimer);
      host.classList.toggle('is-landed', atEnd);
      host.classList.remove('just-landed');
      if (atEnd && !reducedMotion.matches) {
        host.classList.add('just-landed');
        landTimer = setTimeout(() => host.classList.remove('just-landed'), 900);
      }
      landed = atEnd;
    }
  }
  function update() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function setVisible(visible) {
    requestedVisible = Boolean(visible);
    if (!requestedVisible) {
      host.hidden = true;
      finishDrag();
    }
    update();
  }
  function scrollToRatio(ratio, smooth = false) {
    const position = metrics();
    window.scrollTo({ top: Math.max(0, Math.min(1, ratio)) * position.maximum, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant' });
    update();
  }
  function pointerRatio(clientY) {
    const rect = host.getBoundingClientRect();
    const height = thumb.offsetHeight;
    const travel = Math.max(1, rect.height - height);
    return (clientY - rect.top - height / 2 - (drag?.offset || 0)) / travel;
  }
  function finishDrag() {
    if (!drag) return;
    const pointerId = drag.id;
    drag = null;
    host.classList.remove('is-dragging');
    if (host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
  }
  host.addEventListener('pointerdown', event => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || drag || host.hidden) return;
    event.preventDefault();
    const box = thumb.getBoundingClientRect();
    // Grabbing the figure retains the exact grab offset; tapping the rail seeks.
    const grabbedThumb = event.clientY >= box.top && event.clientY <= box.bottom;
    drag = { id: event.pointerId, offset: grabbedThumb ? event.clientY - (box.top + box.height / 2) : 0 };
    host.classList.add('is-dragging');
    host.focus({ preventScroll: true });
    host.setPointerCapture(event.pointerId);
    scrollToRatio(pointerRatio(event.clientY));
  });
  host.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    scrollToRatio(pointerRatio(event.clientY));
  });
  host.addEventListener('pointerup', finishDrag);
  host.addEventListener('pointercancel', finishDrag);
  host.addEventListener('lostpointercapture', finishDrag);
  host.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const position = metrics();
    let target;
    switch (event.key) {
      case 'ArrowDown': case 'ArrowRight': target = position.y + 64; break;
      case 'ArrowUp': case 'ArrowLeft': target = position.y - 64; break;
      case 'PageDown': target = position.y + innerHeight * .8; break;
      case 'PageUp': target = position.y - innerHeight * .8; break;
      case 'Home': target = 0; break;
      case 'End': target = position.maximum; break;
      default: return;
    }
    event.preventDefault();
    scrollToRatio(position.maximum ? target / position.maximum : 1, true);
  });
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  addEventListener('hashchange', update);
  addEventListener('pagehide', finishDrag);
  if ('ResizeObserver' in window) {
    const sizes = new ResizeObserver(update);
    sizes.observe(document.body);
    sizes.observe(host);
  }
  const languageObserver = new MutationObserver(update);
  languageObserver.observe(doc, { attributes: true, attributeFilter: ['lang'] });
  if (entry) languageObserver.observe(entry, { attributes: true, attributeFilter: ['hidden'] });
  document.fonts?.ready.then(update);
  reducedMotion.addEventListener('change', update);
  window.FlightProgress = { update, setVisible };
  update();
})();
