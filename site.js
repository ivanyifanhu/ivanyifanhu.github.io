(() => {
  'use strict';
  const doc = document.documentElement;
  const entry = document.querySelector('#entry');
  const shell = document.querySelector('#site-shell');
  const main = document.querySelector('main');
  const sidebar = document.querySelector('#mobile-menu');
  const menu = document.querySelector('.menu-toggle');
  const sections = [...document.querySelectorAll('[data-section]')];
  const catalogRecent=[];
  const langs = ['en', 'ja', 'zh'];
  const mobile = matchMedia('(max-width:800px)');
  const outlineButton=document.querySelector('.outline-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
  // Fade a viewport-sized sheet instead of compositing the entire article.
  // Long multilingual articles can otherwise require enormous mobile layers.
  const routePaper=document.createElement('div');
  routePaper.className='route-paper';routePaper.hidden=true;
  routePaper.setAttribute('aria-hidden','true');document.body.append(routePaper);
  const tocVeil=document.createElement('div');
  tocVeil.className='toc-veil';tocVeil.inert=true;
  tocVeil.setAttribute('aria-hidden','true');document.body.append(tocVeil);
  // Keep the label and icon in independent, fixed-size cells. Font glyph
  // baselines differ between the three languages and must not position icons.
  [...menu.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
  const menuIcon=document.createElement('span');
  menuIcon.className='menu-toggle-icon';menuIcon.setAttribute('aria-hidden','true');menu.append(menuIcon);
  const safeGet = (key) => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const safeSet = (key,value) => { try { sessionStorage.setItem(key,value); } catch {} };
  const urlLang = new URL(location.href).searchParams.get('lang');
  let language = langs.includes(urlLang) ? urlLang : (safeGet('homepage-language') || 'en');
  if (!langs.includes(language)) language = 'en';
  let active = 'about';
  let routeSerial = 0;
  let finishPendingRoute = null;
  let detachRouteIntent = () => {};
  const routeAnimations = new Set();
  let menuOpen = false;
  let outlineOpen = false;
  let initial = true;
  let routeAddress = location.href;
  let renderedHistoryEntry=null;
  let rememberFrame=0;
  function replaceRouteState(url){
    const state=history.state&&typeof history.state==='object'?history.state:{};
    const current=state.ivanRoute;
    history.replaceState({...state,...(current?{ivanRoute:{...current,hash:new URL(url,location.href).hash}}:{})},'',url);
  }
  function historyEntry(){
    const state=history.state&&typeof history.state==='object'?history.state:{};
    let record=state.ivanRoute;
    if(!record||typeof record.id!=='string'||record.hash!==location.hash){
      record={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),hash:location.hash};
      history.replaceState({...state,ivanRoute:record},'',location.href);
    }
    return record.id;
  }
  // Save each history entry separately: repeated visits to one article may
  // have different reading positions and disclosure states.
  const positionKey='ivan-reading-history-v20';
  let readingPositions={};
  try{readingPositions=JSON.parse(safeGet(positionKey)||'{}');}catch{}
  let returningToParent=null;
  const routePage=()=>entry.hidden?sections.find(s=>s.dataset.section===active):entry;
  function rememberPosition(){
    if(!renderedHistoryEntry||finishPendingRoute||doc.dataset.languageTransition)return;
    const page=routePage();
    if(!page)return;
    readingPositions[renderedHistoryEntry]={
      route:entry.hidden?active:'entry',y:scrollY,time:Date.now(),
      catalogState:window.SiteCatalog?.snapshot(),
      tocSelection:tocSelection?.route===active?{...tocSelection}:null,
      details:[...page.querySelectorAll('details')].filter(el=>!el.closest('[data-lang][hidden]'))
        .map((el,i)=>[el.dataset.readingKey||el.dataset.source||String(i),el.open])
    };
    const keys=Object.keys(readingPositions).sort((a,b)=>readingPositions[b].time-readingPositions[a].time);
    keys.slice(80).forEach(key=>delete readingPositions[key]);
    safeSet(positionKey,JSON.stringify(readingPositions));
    if(active==='search'&&entry.hidden)window.SiteSearch?.remember(renderedHistoryEntry);
  }
  function restoreReadingPosition(record){
    if(!record)return;
    if(record.catalogState)window.SiteCatalog?.restore(record.catalogState);
    const states=new Map(record.details||[]),page=sections.find(s=>s.dataset.section===active);
    [...(page?.querySelectorAll('details')||[])].filter(el=>!el.closest('[data-lang][hidden]')).forEach((el,i)=>{
      const key=el.dataset.readingKey||el.dataset.source||String(i);
      if(states.has(key))el.open=states.get(key);
    });
    scrollTo({top:record.y||0,behavior:'instant'});
    tocSelection=record.tocSelection?.route===active?{...record.tocSelection,y:scrollY}:null;
  }
  const labels = {
    en: {about:'About', together:'Play/Game Together', creation:'Creation',research:'Studies',blog:'Notes',menu:'Menu',close:'Close'},
    ja: {about:'私について', together:'一緒にプレイ/ゲーム', creation:'創作',research:'研究',blog:'ノート',menu:'メニュー',close:'閉じる'},
    zh: {about:'关于', together:'一起玩/游戏', creation:'创作',research:'研究',blog:'札记',menu:'栏目',close:'关闭'}
  };
  function syncMetadata(route){
    const page=JSON.parse(document.getElementById('page-manifest').textContent).pages[route];
    const noindex=!page||route==='search';
    let robots=document.querySelector('meta[name="robots"]');
    if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots);}
    robots.content=noindex?'noindex,follow':'index,follow';
    if(noindex)return;
    const target=(r,l)=>location.origin+'/pages/'+l+'--'+r.replaceAll('/','--')+'.html';
    const canonical=target(route,language);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href',canonical);
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el=>el.href=target(route,el.hreflang==='x-default'?'en':el.hreflang));
    document.querySelector('meta[name="description"]')?.setAttribute('content',page.titles[language]+' — Ivan Yi-fan Hu / 胡一帆');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',page.titles[language]+' — Ivan Yi-fan Hu');
    document.querySelector('meta[property="og:url"]')?.setAttribute('content',canonical);
    document.querySelector('meta[property="og:image"]')?.setAttribute('content',location.origin+'/'+page.image);
    document.querySelectorAll('a[data-route-href]').forEach(el=>el.href=target(el.dataset.routeHref.slice(1),language));
    const data=document.getElementById('structured-page');
    if(data){const item=JSON.parse(data.textContent);item['@type']=route==='about'?'ProfilePage':'WebPage';item.name=page.titles[language];item.url=canonical;item.inLanguage=language;item.dateModified=page.updatedAt;item.datePublished=page.publishedAt;if(route==='about')item.mainEntity={'@type':'Person',name:'Ivan Yi-fan Hu',alternateName:'胡一帆',url:canonical};else delete item.mainEntity;data.textContent=JSON.stringify(item);}
  }
  function updateTitle() {
    if(location.hash.split('?')[0]==='#entry'){
      document.title='Ivan Yi-fan Hu · 胡一帆';syncMetadata('entry');
      return;
    }
    const section = sections.find(s => s.dataset.section === active);
    const heading = section?.querySelector('h1 [data-lang="'+language+'"]');
    const name = heading?.textContent || labels[language][active.split('/')[0]];
    document.title = `${name} — Ivan Yi-fan Hu`;syncMetadata(active);
  }
  function applyLanguage(value) {
    language = value;
    doc.lang = value;
    window.SiteVisits?.sync(value);
    window.VisitDetails?.sync(value);
    window.SiteNightMap?.sync(value);
    document.querySelectorAll('[lang=en]').forEach(el=>el.style.fontOpticalSizing='auto');
    document.querySelectorAll('[data-lang]').forEach(el => { el.hidden = el.dataset.lang !== value; });
    document.querySelectorAll('[data-set-lang]').forEach(btn => btn.setAttribute('aria-pressed',String(btn.dataset.setLang===value)));
    document.querySelectorAll('.work-row').forEach(row=>row.querySelector('.work-visual')?.setAttribute('aria-label',row.querySelector(`h2 [data-lang="${value}"]`).textContent));
    entry.setAttribute('aria-label',({en:'Cover',ja:'表紙',zh:'封面'})[value]);
    document.querySelector('.top-nav').setAttribute('aria-label',({en:'Main navigation',ja:'メインナビゲーション',zh:'主要栏目'})[value]);
    sidebar.querySelector('nav').setAttribute('aria-label',({en:'Mobile navigation',ja:'モバイルナビゲーション',zh:'手机栏目'})[value]);
    document.querySelectorAll('.article-bottom').forEach(el=>el.setAttribute('aria-label',({en:'Page navigation',ja:'ページナビゲーション',zh:'页面导航'})[value]));
    safeSet('homepage-language',value);
    const url = new URL(location.href); url.searchParams.set('lang',value); replaceRouteState(url);routeAddress=location.href;
    window.SiteSearch?.sync(value);
    if(active==='search')window.SiteSearch?.render(new URLSearchParams(location.hash.split('?')[1]||'').get('q'),value);
    updateTitle();
    requestAnimationFrame(buildToc);
    menu.setAttribute('aria-label',menuOpen ? labels[value].close : labels[value].menu);
    window.FlightProgress?.update();
  }
  function setLanguage(value) {
    const selectedHeading=tocSelection?.route===active?{...tocSelection}:null;
    cancelTocNavigation();
    settleRoute();
    rememberPosition();
    window.SiteSearch?.cancel();
    const url=new URL(location.href);
    const [page,query='']=url.hash.slice(1).split('?');
    if(new URLSearchParams(query).has('hit')){
      url.hash=page;
      replaceRouteState(url);routeAddress=location.href;
    }
    const expectedHref=location.href;
    const applyCurrentLanguage=next=>{if(location.href!==expectedHref){route();return;}applyLanguage(next);};
    return window.LanguageFlow.change({value,page:entry.hidden?sections.find(s=>s.dataset.section===active):entry,apply:applyCurrentLanguage,onSettled:()=>{if(selectedHeading?.route===active)tocSelection={...selectedHeading,y:scrollY};buildToc();window.FlightProgress?.update();requestAnimationFrame(rememberPosition);}});
  }
  function syncOverlays(){
    const open=menuOpen||outlineOpen;
    tocVeil.classList.toggle('is-open',open);
    main.inert=open;
    document.querySelector('footer').inert=open;
    document.querySelector('#flight-progress').inert=open;
    toc.inert=mobile.matches&&!outlineOpen;
    document.body.style.overflow=open?'hidden':'';
  }
  function setMenu(open,restore=false){
    if(open)cancelTocNavigation();
    const hadFocus=sidebar.contains(document.activeElement)||(menuOpen&&!mobile.matches);
    menuOpen=open&&mobile.matches;
    if(menuOpen)setOutline(false);
    sidebar.classList.toggle('is-open',menuOpen);
    menu.setAttribute('aria-expanded',String(menuOpen));
    menu.querySelectorAll('[data-lang]').forEach(el=>el.textContent=labels[el.dataset.lang][menuOpen?'close':'menu']);
    menu.setAttribute('aria-label',labels[language][menuOpen?'close':'menu']);
    syncOverlays();
    if(!menuOpen&&(restore||hadFocus)){
      (mobile.matches?menu:main).focus({preventScroll:true});
    }
    sidebar.inert=!menuOpen;
    if(menuOpen)sidebar.querySelector('a').focus({preventScroll:true});
  }
  function setOutline(open,restore=false){
    if(open)cancelTocNavigation();
    const hadFocus=toc.contains(document.activeElement)||(outlineOpen&&!mobile.matches);
    outlineOpen=open&&mobile.matches&&!toc.hidden;
    if(outlineOpen)setMenu(false);
    toc.classList.toggle('is-open',outlineOpen);
    outlineButton.setAttribute('aria-expanded',String(outlineOpen));
    syncOverlays();
    if(!outlineOpen&&(restore||hadFocus)){
      (mobile.matches&&!outlineButton.hidden?outlineButton:main).focus({preventScroll:true});
    }
    if(outlineOpen)toc.querySelector('.toc-item')?.focus({preventScroll:true});
  }
  function showSection(route, focus=false, restore=null) {
    const dynamic=window.SiteCatalog?.ensure(route,language);
    if(dynamic&&!sections.includes(dynamic))sections.push(dynamic);
    if(dynamic?.hasAttribute('data-catalog-dynamic')){
      const at=catalogRecent.indexOf(route);if(at>=0)catalogRecent.splice(at,1);
      catalogRecent.push(route);
      while(catalogRecent.length>8){
        const expired=catalogRecent.shift(),node=sections.find(s=>s.dataset.section===expired);
        if(node?.hasAttribute('data-catalog-dynamic')){sections.splice(sections.indexOf(node),1);window.SiteCatalog?.forget(expired);node.remove();}
      }
    }
    active = sections.some(s=>s.dataset.section===route) ? route : 'about';
    tocSelection=null;
    sections.forEach(s=> { s.hidden = s.dataset.section !== active; });
    document.querySelectorAll('[data-nav]').forEach(a=>{
      if(a.dataset.nav===active.split('/')[0]) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    setMenu(false);setOutline(false);
    updateTitle();
    requestAnimationFrame(buildToc);
    if(restore)window.SiteSearch?.restorePosition(restore);
    else window.scrollTo({top:0,behavior:'instant'});
    if (focus) main.focus({preventScroll:true});
    window.FlightProgress?.setVisible(entry.hidden);
  }
  document.addEventListener('catalogchange',()=>{requestAnimationFrame(buildToc);window.FlightProgress?.update();});
  function showCover() {
    setMenu(false);setOutline(false);
    window.FlightProgress?.setVisible(false);
    entry.classList.remove('leaving');entry.hidden=false;shell.inert=true;
    updateTitle();
  }
  function stopRouteAnimations(){
    detachRouteIntent();detachRouteIntent=()=>{};
    for(const animation of routeAnimations){
      const element=animation.effect.target;
      element.style.opacity=getComputedStyle(element).opacity;
      animation.cancel();
    }
    routeAnimations.clear();
  }
  function clearRouteStyles(){
    [entry,routePaper].forEach(el=>el.style.removeProperty('opacity'));
    routePaper.hidden=true;routePaper.style.removeProperty('background-color');
    delete doc.dataset.pageTransition;
  }
  async function fade(elements,to,duration,easing='cubic-bezier(.22,.61,.36,1)'){
    if(reducedMotion.matches || !Element.prototype.animate){elements.forEach(el=>el.style.opacity=to);return;}
    await Promise.all(elements.map(async element=>{
      const animation=element.animate([{opacity:getComputedStyle(element).opacity},{opacity:to}],{duration,easing,fill:'forwards'});
      routeAnimations.add(animation);
      try{await animation.finished;element.style.opacity=to;}catch{}finally{routeAnimations.delete(animation);animation.cancel();}
    }));
  }
  function settleRoute(){
    if(!finishPendingRoute)return;
    routeSerial++;stopRouteAnimations();
    const finish=finishPendingRoute;finishPendingRoute=null;
    finish();clearRouteStyles();
  }
  async function route() {
    cancelTocNavigation();
    // The address already points at the destination on popstate/hashchange;
    // save the still-visible result page under the entry it actually belongs to.
    rememberPosition();
    routeAddress=location.href;
    const targetHistoryEntry=historyEntry();
    const ticket=++routeSerial;
    stopRouteAnimations();finishPendingRoute=null;
    window.LanguageFlow?.cancel();
    window.SiteSearch?.cancel();
    const routeLang=new URL(location.href).searchParams.get('lang');
    let name;
    const [routeName,routeQuery='']=location.hash.slice(1).split('?');
    const routeParams=new URLSearchParams(routeQuery);
    try{name=decodeURIComponent(routeName);}catch{name='about';}
    const matchLanguage=routeParams.get('matchLang');
    name=({notes:'blog',cv:'about/cv',work:'creation'}[name] || name);
    const isFirst=initial;
    const toCover=name==='entry'||(isFirst&&!name&&!safeGet('homepage-v2-entered'));
    const fromCover=!entry.hidden;
    const searchReturn=name==='search'?window.SiteSearch?.recalled(targetHistoryEntry,routeParams.get('q')):null;
    const readingReturn=readingPositions[targetHistoryEntry]||
      (returningToParent===name?Object.values(readingPositions).filter(p=>p.route===name).sort((a,b)=>b.time-a.time)[0]:null);
    returningToParent=null;
    let userScrolled=false;
    if(routeParams.has('hit')){
      const intent=event=>{
        if(event.type==='keydown'&&(!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)||event.target.matches('input,textarea,[contenteditable]')))return;
        userScrolled=true;
      };
      ['wheel','touchmove','keydown'].forEach(type=>addEventListener(type,intent,{passive:true}));
      detachRouteIntent=()=>['wheel','touchmove','keydown'].forEach(type=>removeEventListener(type,intent));
    }
    initial=false;
    let committed=false;
    const commit=()=>{
      if(committed)return;committed=true;
      doc.classList.toggle('world-night',name==='site-visits'&&!toCover);
      doc.classList.toggle('viewing-visit-details',['visits','site-visits'].includes(name)&&!toCover);
      if(name==='site-visits'&&!toCover)window.SiteNightMap?.show(language);else window.SiteNightMap?.hide();
      if(langs.includes(routeLang)&&routeLang!==language)applyLanguage(routeLang);
      if(routeParams.has('hit')&&langs.includes(matchLanguage)&&matchLanguage!==language)applyLanguage(matchLanguage);
      if(toCover){window.VisitDetails?.hide();showCover();}
      else{
        if(name==='visits')window.VisitDetails?.show(routeParams.get('page'),language);
        else window.VisitDetails?.hide();
        if(name==='search'){
          window.SiteSearch?.prepareReturn(searchReturn);
          window.SiteSearch?.render(routeParams.get('q'),language);
        }
        showSection(name||'about',false,searchReturn);
        if(readingReturn&&!searchReturn)restoreReadingPosition(readingReturn);
        safeSet('homepage-v2-entered','1');shell.inert=false;
      }
      window.SiteVisits?.show(toCover?'entry':active);
      renderedHistoryEntry=targetHistoryEntry;
    };
    const finalize=()=>{
      commit();entry.hidden=!toCover;shell.inert=toCover;
      window.FlightProgress?.setVisible(!toCover);
      if(isFirst)delete doc.dataset.siteBooting;
    };
    finishPendingRoute=finalize;
    setMenu(false);setOutline(false);
    if(isFirst||reducedMotion.matches){finalize();}
    else if(toCover){
      if(!fromCover)entry.style.opacity='0';
      commit();doc.dataset.pageTransition='cover-in';
      await fade([entry],1,700);
    }else if(fromCover){
      routePaper.hidden=true;
      commit();doc.dataset.pageTransition='cover-out';
      await fade([entry],0,700);
    }else{
      doc.dataset.pageTransition='out';
      // Keep the outgoing paper color until it dissolves over the next theme.
      routePaper.style.backgroundColor=getComputedStyle(document.body).backgroundColor;
      routePaper.hidden=false;
      await fade([routePaper],1,220,'cubic-bezier(.37,0,.63,1)');
      if(ticket!==routeSerial)return;
      commit();doc.dataset.pageTransition='in';
      await fade([routePaper],0,380,'cubic-bezier(.25,.1,.25,1)');
    }
    if(ticket!==routeSerial)return;
    finalize();finishPendingRoute=null;clearRouteStyles();
    detachRouteIntent();detachRouteIntent=()=>{};
    if(!isFirst)(toCover?entry.querySelector('.cover-enter'):main).focus({preventScroll:true});
    if(searchReturn)window.SiteSearch?.announceReturn(searchReturn);
    rememberPosition();
    if(!toCover&&!readingReturn&&!userScrolled&&routeParams.has('hit'))window.SiteSearch?.jump(sections.find(s=>s.dataset.section===active),routeParams);
  }
  const toc=document.querySelector('.reading-toc');
  const tocList=toc.querySelector('.toc-items');
  let tocTargets=[];
  let tocNodes=[];
  let tocSelection=null;
  const tocHeadingKey=heading=>heading.dataset.readingKey||heading.dataset.source||heading.id||heading.dataset.tocKey;
  let scheduled=false;
  const collapsedToc=new Set();
  const tocWords={en:{expand:'Expand',collapse:'Collapse'},ja:{expand:'展開',collapse:'折りたたむ'},zh:{expand:'展开',collapse:'收起'}};
  let tocJumpFrame=0, tocCueTimer=0, tocCue=null;
  let detachTocIntent=()=>{};
  function cancelTocNavigation(){
    cancelAnimationFrame(tocJumpFrame);tocJumpFrame=0;
    clearTimeout(tocCueTimer);tocCueTimer=0;
    detachTocIntent();detachTocIntent=()=>{};
    tocCue?.classList.remove('toc-arrived');tocCue=null;
    delete doc.dataset.tocJump;
  }
  function jumpToHeading(heading){
    cancelTocNavigation();
    window.SiteSearch?.cancel();
    setOutline(false);
    heading.tabIndex=-1;heading.focus({preventScroll:true});
    const top=parseFloat(getComputedStyle(doc).getPropertyValue('--reading-top'))||126;
    const from=scrollY;
    const to=Math.max(0,Math.min(doc.scrollHeight-innerHeight,from+heading.getBoundingClientRect().top-top));
    const duration=reducedMotion.matches?0:Math.min(900,420+Math.abs(to-from)*.06);
    const start=performance.now();
    tocSelection={route:active,key:tocHeadingKey(heading),y:to};
    const intent=event=>{
      if(event.type==='keydown'&&!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape'].includes(event.key))return;
      cancelTocNavigation();tocSelection=null;updateToc();
    };
    ['wheel','touchstart','pointerdown','keydown'].forEach(type=>addEventListener(type,intent,{passive:true}));
    detachTocIntent=()=>['wheel','touchstart','pointerdown','keydown'].forEach(type=>removeEventListener(type,intent));
    doc.dataset.tocJump='scrolling';updateToc();
    const frame=now=>{
      if(!heading.isConnected||heading.closest('[hidden]')){cancelTocNavigation();return;}
      const progress=duration?Math.min(1,(now-start)/duration):1;
      const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
      scrollTo({top:from+(to-from)*eased,behavior:'instant'});
      if(progress<1){tocJumpFrame=requestAnimationFrame(frame);return;}
      tocJumpFrame=0;delete doc.dataset.tocJump;
      detachTocIntent();detachTocIntent=()=>{};
      if(tocSelection)tocSelection.y=scrollY;
      updateToc();rememberPosition();
      tocCue=heading;heading.classList.add('toc-arrived');
      // A small, bounded heading surface gives a clear arrival cue without
      // animating or repainting the complete article. Repeated clicks restart it.
      tocCueTimer=setTimeout(cancelTocNavigation,reducedMotion.matches?900:1300);
    };
    tocJumpFrame=requestAnimationFrame(frame);
  }
  function buildToc(){
    const page=sections.find(s=>s.dataset.section===active);
    if(!page)return;
    tocTargets=[...page.querySelectorAll('h2,h3,h4')].filter(el=>!el.closest('[hidden]') && !el.closest('details'));
    tocNodes=[];
    tocList.replaceChildren();
    toc.hidden=tocTargets.length<2;
    outlineButton.hidden=toc.hidden;
    outlineButton.setAttribute('aria-label',({en:'On this page',ja:'このページの目次',zh:'本页目录'})[language]);
    if(toc.hidden)setOutline(false);
    toc.setAttribute('aria-label',({en:'On this page',ja:'このページの目次',zh:'本页目录'})[language]);
    const roots=[];const stack=[];
    tocTargets.forEach((heading,index)=>{
      // Gallery and group headings need the same unique identity as prose.
      heading.dataset.tocKey=active+':heading:'+index;
      const rank=Number(heading.tagName.slice(1));
      while(stack.length && stack.at(-1).rank>=rank)stack.pop();
      const parent=stack.at(-1)||null;
      const node={heading,index,rank,parent,depth:parent?parent.depth+1:0,children:[],key:active+':'+index};
      if(parent)parent.children.push(node);else roots.push(node);
      stack.push(node);tocNodes.push(node);
    });
    function renderNode(node){
      const localized=node.heading.querySelector('[data-lang="'+language+'"]')||node.heading;
      const label=localized.textContent.trim().replace(/\s+/g,' ');
      const item=document.createElement('li');item.className='toc-node';item.dataset.depth=Math.min(node.depth,3);
      const row=document.createElement('div');row.className='toc-row';
      const button=document.createElement('button');button.className='toc-item';button.type='button';
      button.setAttribute('aria-label',label);button.title=label;
      const span=document.createElement('span');span.className='toc-label';window.SiteTypography.set(span,label,language);
      const track=document.createElement('span');track.className='toc-track';track.setAttribute('aria-hidden','true');
      const tick=document.createElement('span');tick.className='toc-tick';track.append(tick);
      button.append(span,track);row.append(button);item.append(row);node.element=item;node.button=button;
      button.addEventListener('click',()=>jumpToHeading(node.heading));
      button.addEventListener('pointerenter',event=>{
        if(event.pointerType==='touch'||!matchMedia('(hover:hover)').matches)return;
        const rect=tick.getBoundingClientRect();
        const origin=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
        button.style.setProperty('--ink-origin',`${origin*100}%`);
        button.classList.add('is-hovered');
      });
      const clearHover=()=>button.classList.remove('is-hovered');
      button.addEventListener('pointerleave',clearHover);
      button.addEventListener('pointercancel',clearHover);
      if(node.children.length){
        const children=document.createElement('ol');children.className='toc-children';children.id='toc-children-'+node.index;
        children.append(...node.children.map(renderNode));
        const toggle=document.createElement('button');toggle.className='toc-toggle';toggle.type='button';
        toggle.innerHTML='<span aria-hidden="true">›</span>';toggle.setAttribute('aria-controls',children.id);
        function applyCollapse(){
          const collapsed=collapsedToc.has(node.key);children.hidden=collapsed;
          toggle.setAttribute('aria-expanded',String(!collapsed));
          toggle.setAttribute('aria-label',tocWords[language][collapsed?'expand':'collapse']+' '+label);
        }
        toggle.addEventListener('click',()=>{
          if(collapsedToc.has(node.key))collapsedToc.delete(node.key);else collapsedToc.add(node.key);
          applyCollapse();updateToc();
        });
        applyCollapse();row.prepend(toggle);item.append(children);
      }else row.classList.add('toc-leaf');
      return item;
    }
    const tree=document.createElement('ol');tree.className='toc-tree';tree.append(...roots.map(renderNode));tocList.append(tree);
    updateToc();
  }
  function updateToc(){
    scheduled=false;
    if(!tocNodes.length)return;
    const readingTop=parseFloat(getComputedStyle(doc).getPropertyValue('--reading-top'))||126;
    // Several short/empty sections can share the same clamped scroll offset.
    // An explicit choice owns that position until the reader actually moves.
    let selected=tocSelection?.route===active?tocNodes.find(node=>tocHeadingKey(node.heading)===tocSelection.key):null;
    const moving=doc.dataset.tocJump==='scrolling'||!!doc.dataset.languageTransition;
    if(selected&&!moving&&Math.abs(scrollY-tocSelection.y)>3){tocSelection=null;selected=null;}
    let current=selected||tocNodes[0];
    if(!selected){
      tocNodes.forEach(node=>{if(node.heading.getBoundingClientRect().top<readingTop+20)current=node;});
      if(scrollY>0&&scrollY+innerHeight>=doc.scrollHeight-3)current=tocNodes.at(-1);
    }
    // When a branch is closed, its visible ancestor marks the reading position.
    while(current.element.closest('[hidden]') && current.parent)current=current.parent;
    tocNodes.forEach(node=>{
      node.button.classList.toggle('is-active',node===current);
      if(node===current)node.button.setAttribute('aria-current','location');else node.button.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateToc);}},{passive:true});
  addEventListener('scroll',()=>{if(!rememberFrame)rememberFrame=requestAnimationFrame(()=>{rememberFrame=0;rememberPosition();});},{passive:true});
  addEventListener('pagehide',rememberPosition);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)rememberPosition();});
  document.addEventListener('click',event=>{
    const footnote=event.target.closest('[data-footnote-target]');
    if(footnote){
      const target=document.getElementById(footnote.dataset.footnoteTarget);
      if(target){event.preventDefault();target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:reducedMotion.matches?'instant':'smooth'});target.classList.remove('toc-arrived');requestAnimationFrame(()=>target.classList.add('toc-arrived'));setTimeout(()=>target.classList.remove('toc-arrived'),1300);}
      return;
    }
    if(event.target.closest('.skip')){
      event.preventDefault(); setMenu(false); setOutline(false);
      if(!entry.hidden){if(location.hash==='#about')route();else location.hash='about';}
      main.focus({preventScroll:false});return;
    }
    const lang=event.target.closest('[data-set-lang]');
    if(lang) {setLanguage(lang.dataset.setLang);return;}
    const top=event.target.closest('[data-scroll-top]');
    if(top){event.preventDefault();cancelTocNavigation();window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});return;}
    const link=event.target.closest('a[data-route-href],a[href^="#"]');
    if(link&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
      const href=link.dataset.routeHref||link.getAttribute('href');
      rememberPosition();
      if(link.closest('.article-bottom'))returningToParent=href.slice(1).split('?')[0];
      event.preventDefault();if(href!==location.hash)location.hash=href;else route();
    }
  });
  entry.querySelector('.cover-enter').addEventListener('click',()=>{
    if(location.hash==='#about')route();else location.hash='about';
  });
  menu.addEventListener('click',()=>{settleRoute();setMenu(!menuOpen);});
  outlineButton.addEventListener('click',()=>{settleRoute();setOutline(!outlineOpen);});
  document.querySelector('.toc-close').addEventListener('click',()=>setOutline(false,true));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && menuOpen){setMenu(false,true);event.preventDefault();}
    else if(event.key==='Escape' && outlineOpen){setOutline(false,true);event.preventDefault();}
  });
  mobile.addEventListener('change',()=>{setMenu(false);setOutline(false);});
  const routeFromHistory=()=>{if(location.href===routeAddress)return;route();};
  addEventListener('hashchange',routeFromHistory);
  addEventListener('popstate',routeFromHistory);
  if ('scrollRestoration' in history) history.scrollRestoration='manual';
  applyLanguage(language);route();
  Promise.allSettled([
    document.fonts.load('400 20px "Source Serif 4"'),
    document.fonts.load('600 20px "Source Han Serif SC"','数智时代'),
    document.fonts.load('400 20px "Source Han Serif JP"','哲学者たちは世界')
  ]).then(results=>{doc.dataset.fonts=results.map(r=>r.status==='fulfilled'&&r.value.length?'loaded':'fallback').join(',');});
})();
