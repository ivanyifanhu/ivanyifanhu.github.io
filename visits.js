(() => {
  'use strict';
  const footer=document.querySelector('.page-views');
  if(!footer||!window.SiteVisitModel)return;
  const manifest=JSON.parse(document.querySelector('#page-manifest')?.textContent||'{"pages":{}}');
  const routes=new Set(Object.keys(manifest.pages));
  // Independent display model; archived genuine analytics remain untouched.
  // No counter, location, or visitor request leaves the browser.
  const model=window.SiteVisitModel.create({manifest});
  // A browser reload of a map counts once for its source page. Simply opening
  // details, changing language, or polling remains a read-only operation.
  const navigation=window.performance?.getEntriesByType?.('navigation')?.[0];
  if(navigation?.type==='reload'||(!navigation&&window.performance?.navigation?.type===1)){
    const [section,query='']=location.hash.slice(1).split('?');
    const source=section==='site-visits'?'entry':section==='visits'?new URLSearchParams(query).get('page'):null;
    if(routes.has(source))model.visit(source);
  }
  const values=footer.querySelectorAll('[data-view-value]');
  const siteValues=document.querySelectorAll('[data-site-view-value]');
  const siteFooter=document.querySelector('.site-views');
  const link=footer.querySelector('.visit-details-link');
  let language=document.documentElement.lang||'en',current=null,footerVisible=false,snapshots=null;
  const labels={en:'Details',ja:'詳細',zh:'详情'};
  function read(route){
    if(route!=='__site__'&&!routes.has(route))return null;
    if(!snapshots)snapshots=model.readAll();
    return snapshots[route]||null;
  }
  function paint(){
    // One clock/storage sample supplies counters, both map views, and ranking.
    // latest() below reads this same immutable frame without advancing time.
    snapshots=model.readAll();
    const data=current?read(current.route):null,site=read('__site__');
    for(const detail of document.querySelectorAll('.visit-details-link'))detail.setAttribute('aria-label',labels[language]);
    footer.dataset.visitState='ready';footer.removeAttribute('title');
    const shown=data||read('entry');
    for(const element of values)element.textContent=shown.pageViews.toLocaleString('en-US');
    for(const element of siteValues)element.textContent=site.pageViews.toLocaleString('en-US');
    if(siteFooter){siteFooter.dataset.visitState='ready';siteFooter.removeAttribute('title');}
    if(link&&current){link.href='#visits?page='+encodeURIComponent(current.route);link.toggleAttribute('data-current-detail',current.readOnly);}
    dispatchEvent(new CustomEvent('site-visits-update',{detail:{route:current?.route,data,state:'ready',geographyEnabled:true}}));
  }
  function refresh(){
    if(document.hidden||(!footerVisible&&!current?.readOnly))return;
    paint();
  }
  function show(route){
    if(!routes.has(route)||(current?.route===route&&!current.readOnly))return;
    model.visit(route);
    current={route,readOnly:false};paint();
  }
  function inspect(route){
    if(route!=='__site__'&&!routes.has(route))route='about';
    current={route,readOnly:true};paint();
  }
  function sync(value){language=labels[value]?value:'en';paint();}
  if('IntersectionObserver'in window){
    const shown=new Set(),observer=new IntersectionObserver(entries=>{
      for(const entry of entries)entry.isIntersecting?shown.add(entry.target):shown.delete(entry.target);
      footerVisible=shown.size>0;if(footerVisible)refresh();
    });
    observer.observe(footer);if(siteFooter)observer.observe(siteFooter);
  }else footerVisible=true;
  setInterval(refresh,15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  addEventListener('storage',event=>{if(event.key?.startsWith('ivan-visit-model'))refresh();});
  window.SiteVisits={show,inspect,inspectSite:()=>inspect('__site__'),sync,latest:read};
  paint();
})();
