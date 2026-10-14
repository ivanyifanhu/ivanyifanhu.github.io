(() => {
  'use strict';
  const footer = document.querySelector('.page-views');
  if (!footer) return;
  const endpoint = 'https://busuanzi.9420.ltd/api';
  const production = location.protocol === 'https:' && location.hostname === 'ivanyifanhu.github.io' && !location.port;
  const routes = new Set(['entry', ...Array.from(document.querySelectorAll('[data-section]'), element => element.dataset.section)]);
  const values = footer.querySelectorAll('[data-view-value]');
  const counts = new Map();
  let language = document.documentElement.lang || 'en';
  let current = null;
  let polling = false;
  let footerVisible = false;
  const hints = {
    en: {local:'Local preview; counting starts on the published site.', loading:'Loading page views…', ready:'Page views since the counter was enabled. Refreshes count as visits.', unavailable:'The visit counter is temporarily unavailable.', stale:'Last available page-view count.'},
    ja: {local:'ローカルプレビュー。本番サイトで計測します。', loading:'閲覧数を読み込み中…', ready:'計測開始後の閲覧数。再読み込みも1回として数えます。', unavailable:'閲覧数を一時的に取得できません。', stale:'最後に取得した閲覧数。'},
    zh: {local:'本地预览；发布后开始统计。', loading:'正在读取访问数量…', ready:'自计数启用以来的页面访问次数；每次刷新计为一次。', unavailable:'访问数量暂时无法读取。', stale:'最近一次成功读取的访问数量。'}
  };
  function paint(state) {
    const value = current ? counts.get(current.route) : undefined;
    footer.dataset.visitState = state;
    footer.title = (hints[language] || hints.en)[state];
    for (const element of values) element.textContent = Number.isSafeInteger(value) ? value.toLocaleString('en-US') : '—';
  }
  async function request(method, route) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      // Only a public canonical page path is sent: no search terms, language,
      // cookies, local identifiers, or original referrer are included.
      const response = await fetch(endpoint, {
        method, mode:'cors', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
        headers:{'x-bsz-referer':'https://ivanyifanhu.github.io/' + (route === 'entry' ? '' : route)},
        signal:controller.signal
      });
      if (!response.ok) throw new Error('Counter unavailable');
      const payload = await response.json();
      const value = payload?.data?.page_pv;
      if (payload.success !== true || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid counter response');
      return value;
    } finally { clearTimeout(timer); }
  }
  async function refresh() {
    if (!production || !current || current.pending || polling || document.hidden || !footerVisible) return;
    const target = current;
    polling = true;
    try {
      const value = await request('GET', target.route);
      if (current !== target) return;
      counts.set(target.route, value); paint('ready');
    } catch {
      if (current === target) paint(counts.has(target.route) ? 'stale' : 'unavailable');
    } finally { polling = false; }
  }
  function show(route) {
    if (!routes.has(route) || current?.route === route) return;
    const target = {route, pending:true};
    current = target;
    if (!production) { target.pending=false; paint('local'); return; }
    paint('loading');
    // A document refresh starts a new instance. A committed route change
    // counts once; language switches and read-only polling never increment.
    // Do not retry POST: a timed-out response may already have been counted.
    request('POST', route).then(value => {
      if (current !== target) return;
      counts.set(route, value); paint('ready');
    }).catch(() => {
      if (current === target) paint(counts.has(route) ? 'stale' : 'unavailable');
    }).finally(() => { target.pending=false; });
  }
  function sync(value) { language = hints[value] ? value : 'en'; paint(footer.dataset.visitState || (production ? 'loading' : 'local')); }
  if (production) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { footerVisible=entries.some(entry=>entry.isIntersecting); if(footerVisible)refresh(); }).observe(footer);
    } else footerVisible=true;
    setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }
  window.SiteVisits = {show, sync};
  paint(production ? 'loading' : 'local');
})();
