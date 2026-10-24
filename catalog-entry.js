/* Lean, independently indexable entries share the current site shell. */
(() => {
  'use strict';
  const root = document.documentElement;
  const route = root.dataset.initialRoute;
  const language = root.lang;
  const fallback = document.body.innerHTML;
  const fallbackHead = document.head.innerHTML;
  const fallbackTitle = document.title;
  const fallbackClass = root.className;
  const fallbackStyle = [...document.head.querySelectorAll('style')].map(node => node.textContent).join('\n');
  const release = document.currentScript?.dataset.release || '43';
  const base = new URL(document.baseURI);
  const path = new URL(location.href);
  if (!path.hash) path.hash = route;
  if (!path.searchParams.has('lang')) path.searchParams.set('lang', language);
  history.replaceState(history.state, '', path);
  async function start() {
    const response = await fetch(new URL('index.html?release=' + encodeURIComponent(release), base), {cache: 'no-cache'});
    if (!response.ok) throw new Error('Site shell is unavailable');
    const template = new DOMParser().parseFromString(await response.text(), 'text/html');
    // DOMParser parses noscript children with scripting disabled. Importing
    // that fallback CSS would hide working language and mobile controls.
    template.querySelectorAll('noscript').forEach(node => node.remove());
    const scripts = [...template.querySelectorAll('script')].filter(script =>
      !['application/json', 'application/ld+json'].includes(script.type));
    scripts.forEach(script => script.remove());
    root.dataset.catalogBooting = 'true';
    document.head.replaceChildren(...[...template.head.childNodes].map(node => document.importNode(node, true)));
    document.title = fallbackTitle;
    const bootStyle = document.createElement('style');
    bootStyle.textContent = fallbackStyle + 'html[data-catalog-booting] body>*:not(.catalog-bootstrap-fallback){visibility:hidden!important}html[data-catalog-booting] body>.catalog-bootstrap-fallback{visibility:visible!important}.catalog-bootstrap-fallback{position:fixed;inset:0;z-index:250;background:var(--paper,#f6f6f4);overflow:auto;pointer-events:none}';
    document.head.append(bootStyle);
    document.body.replaceChildren(...[...template.body.childNodes].map(node => document.importNode(node, true)));
    const preview = document.createElement('div');
    preview.className = 'catalog-bootstrap-fallback';
    preview.innerHTML = fallback;
    preview.querySelectorAll('script').forEach(node => node.remove());
    document.body.append(preview);
    root.lang = language;
    root.dataset.initialRoute = route;
    root.dataset.siteBooting = route;
    for (const source of scripts) {
      const script = document.createElement('script');
      for (const attribute of source.attributes) script.setAttribute(attribute.name, attribute.value);
      if (source.src) {
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Site component is unavailable'));
          document.body.append(script);
        });
      } else {
        script.textContent = source.textContent;
        document.body.append(script);
      }
    }
    // Keep the correct static work visible while the shared shell loads. A
    // slow connection must never reveal the shell's default About page.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    delete root.dataset.catalogBooting;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await preview.animate([{opacity: 1}, {opacity: 0}], {duration: 260, easing: 'ease-out'}).finished;
    }
    preview.remove();
    bootStyle.remove();
  }
  start().catch(error => {
    root.className = fallbackClass;
    root.lang = language;
    document.head.innerHTML = fallbackHead;
    document.body.innerHTML = fallback;
    delete root.dataset.siteBooting;
    delete root.dataset.catalogBooting;
    delete root.dataset.languageTransition;
    delete root.dataset.pageTransition;
    console.error(error);
  });
})();
