(() => {
  'use strict';
  const card=document.querySelector('.world-popular-card');
  if(!card)return;
  const pages=JSON.parse(document.querySelector('#page-manifest').textContent).pages;
  const candidates=Object.entries(pages).filter(([,page])=>page.rankable&&page.image);
  const title=card.querySelector('.world-popular-title'),category=card.querySelector('.world-popular-category'),image=card.querySelector('img'),count=card.querySelector('[data-popular-count]');
  let current='',paintedLanguage='';
  function paint(){
    if(!window.SiteVisits)return;
    const lang=['en','ja','zh'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
    // Rank content pages using the same snapshots as their own detail screens.
    // Cover/search are utility screens, not candidates; ties keep stable order.
    const ranked=candidates.map(([route,meta])=>({route,meta,views:window.SiteVisits.latest(route)?.pageViews||0})).sort((a,b)=>b.views-a.views||a.route.localeCompare(b.route));
    const winner=ranked[0];if(!winner)return;
    count.textContent=String(winner.views);
    if(current===winner.route&&paintedLanguage===lang)return;
    current=winner.route;paintedLanguage=lang;
    const name=winner.route==='about'?'Ivan Yi-fan Hu':winner.meta.titles[lang];
    const path=winner.meta.breadcrumbs[lang];
    card.href='#'+winner.route;card.dataset.route=winner.route;
    window.SiteTypography.set(title,name,lang);title.title=name;
    category.textContent=(path.length>1?path.slice(0,-1):path).join('—');
    category.title=category.textContent;
    if(image.getAttribute('src')!==winner.meta.image)image.src=winner.meta.image;
    card.setAttribute('aria-label',name+' · '+category.textContent);
  }
  addEventListener('site-visits-update',event=>{if(event.detail.route==='__site__')paint();});
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  paint();
})();
