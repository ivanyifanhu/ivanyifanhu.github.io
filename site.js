(() => {
  'use strict';
  const doc = document.documentElement;
  const entry = document.querySelector('#entry');
  const shell = document.querySelector('#site-shell');
  const main = document.querySelector('main');
  const sidebar = document.querySelector('#mobile-menu');
  const menu = document.querySelector('.menu-toggle');
  const sections = [...document.querySelectorAll('[data-section]')];
  const langs = ['en', 'ja', 'zh'];
  const mobile = matchMedia('(max-width:800px)');
  const outlineButton=document.querySelector('.outline-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
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
  const labels = {
    en: {about:'About', together:'Play/Game Together', creation:'Creation',research:'Studies',blog:'Blog',menu:'Menu',close:'Close'},
    ja: {about:'私について', together:'一緒にプレイ/ゲーム', creation:'創作',research:'研究',blog:'ブログ',menu:'メニュー',close:'閉じる'},
    zh: {about:'关于', together:'一起玩/游戏', creation:'创作',research:'研究',blog:'博客',menu:'栏目',close:'关闭'}
  };
  function updateTitle() {
    if(location.hash.split('?')[0]==='#entry'){
      document.title='Ivan Yi-fan Hu · 胡一帆';
      return;
    }
    const section = sections.find(s => s.dataset.section === active);
    const heading = section?.querySelector('h1 [data-lang="'+language+'"]');
    const name = heading?.textContent || labels[language][active.split('/')[0]];
    document.title = `${name} — Ivan Yi-fan Hu`;
  }
  function applyLanguage(value) {
    language = value;
    doc.lang = value;
    document.querySelectorAll('[lang=en]').forEach(el=>el.style.fontOpticalSizing='auto');
    document.querySelectorAll('[data-lang]').forEach(el => { el.hidden = el.dataset.lang !== value; });
    document.querySelectorAll('[data-set-lang]').forEach(btn => btn.setAttribute('aria-pressed',String(btn.dataset.setLang===value)));
    document.querySelectorAll('.work-row').forEach(row=>row.querySelector('.work-visual')?.setAttribute('aria-label',row.querySelector(`h2 [data-lang="${value}"]`).textContent));
    entry.setAttribute('aria-label',({en:'Cover',ja:'表紙',zh:'封面'})[value]);
    document.querySelector('.top-nav').setAttribute('aria-label',({en:'Main navigation',ja:'メインナビゲーション',zh:'主要栏目'})[value]);
    sidebar.querySelector('nav').setAttribute('aria-label',({en:'Mobile navigation',ja:'モバイルナビゲーション',zh:'手机栏目'})[value]);
    document.querySelectorAll('.article-bottom').forEach(el=>el.setAttribute('aria-label',({en:'Page navigation',ja:'ページナビゲーション',zh:'页面导航'})[value]));
    safeSet('homepage-language',value);
    const url = new URL(location.href); url.searchParams.set('lang',value); history.replaceState(null,'',url);routeAddress=location.href;
    window.SiteSearch?.sync(value);
    if(active==='search')window.SiteSearch?.render(new URLSearchParams(location.hash.split('?')[1]||'').get('q'),value);
    updateTitle();
    requestAnimationFrame(buildToc);
    menu.setAttribute('aria-label',menuOpen ? labels[value].close : labels[value].menu);
    window.FlightProgress?.update();
  }
  function setLanguage(value) {
    settleRoute();
    window.SiteSearch?.cancel();
    const url=new URL(location.href);
    const [page,query='']=url.hash.slice(1).split('?');
    if(new URLSearchParams(query).has('hit')){
      url.hash=page;
      history.replaceState(null,'',url);routeAddress=location.href;
    }
    const expectedHref=location.href;
    const applyCurrentLanguage=next=>{if(location.href!==expectedHref){route();return;}applyLanguage(next);};
    return window.LanguageFlow.change({value,page:entry.hidden?sections.find(s=>s.dataset.section===active):entry,apply:applyCurrentLanguage,onSettled:()=>{buildToc();window.FlightProgress?.update();}});
  }
  function syncOverlays(){
    const open=menuOpen||outlineOpen;
    main.inert=open;
    document.querySelector('footer').inert=open;
    document.querySelector('#flight-progress').inert=open;
    document.body.style.overflow=open?'hidden':'';
  }
  function setMenu(open,restore=false){
    menuOpen=open&&mobile.matches;
    if(menuOpen)setOutline(false);
    sidebar.classList.toggle('is-open',menuOpen);
    sidebar.inert=!menuOpen;
    menu.setAttribute('aria-expanded',String(menuOpen));
    menu.querySelectorAll('[data-lang]').forEach(el=>el.textContent=labels[el.dataset.lang][menuOpen?'close':'menu']);
    menu.lastChild.nodeValue=menuOpen?' −':' ＋';
    menu.setAttribute('aria-label',labels[language][menuOpen?'close':'menu']);
    syncOverlays();
    if(menuOpen)sidebar.querySelector('a').focus();else if(restore)menu.focus();
  }
  function setOutline(open,restore=false){
    outlineOpen=open&&mobile.matches&&!toc.hidden;
    if(outlineOpen)setMenu(false);
    toc.classList.toggle('is-open',outlineOpen);
    outlineButton.setAttribute('aria-expanded',String(outlineOpen));
    syncOverlays();
    if(outlineOpen)toc.querySelector('.toc-item')?.focus();else if(restore)outlineButton.focus();
  }
  function showSection(route, focus=false) {
    active = sections.some(s=>s.dataset.section===route) ? route : 'about';
    sections.forEach(s=> { s.hidden = s.dataset.section !== active; });
    document.querySelectorAll('[data-nav]').forEach(a=>{
      if(a.dataset.nav===active.split('/')[0]) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    setMenu(false);setOutline(false);
    updateTitle();
    requestAnimationFrame(buildToc);
    window.scrollTo({top:0,behavior:'instant'});
    if (focus) main.focus({preventScroll:true});
    window.FlightProgress?.setVisible(entry.hidden);
  }
  function showCover() {
    setMenu(false);setOutline(false);
    window.FlightProgress?.setVisible(false);
    entry.classList.remove('leaving');entry.hidden=false;shell.inert=true;
    updateTitle();
  }
  function motionSurfaces(){return [main,toc,document.querySelector('footer'),document.querySelector('#flight-progress')];}
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
    [entry,...motionSurfaces()].forEach(el=>el.style.removeProperty('opacity'));
    delete doc.dataset.pageTransition;
  }
  async function fade(elements,to,duration){
    if(reducedMotion.matches || !Element.prototype.animate){elements.forEach(el=>el.style.opacity=to);return;}
    await Promise.all(elements.map(async element=>{
      const animation=element.animate([{opacity:getComputedStyle(element).opacity},{opacity:to}],{duration,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'});
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
    routeAddress=location.href;
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
      if(langs.includes(routeLang)&&routeLang!==language)applyLanguage(routeLang);
      if(routeParams.has('hit')&&langs.includes(matchLanguage)&&matchLanguage!==language)applyLanguage(matchLanguage);
      if(toCover)showCover();
      else{
        if(name==='search')window.SiteSearch?.render(routeParams.get('q'),language);
        showSection(name||'about');
        safeSet('homepage-v2-entered','1');shell.inert=false;
      }
    };
    const finalize=()=>{
      commit();entry.hidden=!toCover;shell.inert=toCover;
      window.FlightProgress?.setVisible(!toCover);
    };
    finishPendingRoute=finalize;
    setMenu(false);setOutline(false);
    if(isFirst||reducedMotion.matches){finalize();}
    else if(toCover){
      if(!fromCover)entry.style.opacity='0';
      commit();doc.dataset.pageTransition='cover-in';
      await fade([entry],1,700);
    }else if(fromCover){
      commit();doc.dataset.pageTransition='cover-out';
      await fade([entry],0,700);
    }else{
      doc.dataset.pageTransition='out';
      await fade(motionSurfaces(),0,190);
      if(ticket!==routeSerial)return;
      commit();doc.dataset.pageTransition='in';
      await fade(motionSurfaces(),1,360);
    }
    if(ticket!==routeSerial)return;
    finalize();finishPendingRoute=null;clearRouteStyles();
    detachRouteIntent();detachRouteIntent=()=>{};
    if(!isFirst)(toCover?entry.querySelector('.cover-enter'):main).focus({preventScroll:true});
    if(!toCover&&!userScrolled&&routeParams.has('hit'))window.SiteSearch?.jump(sections.find(s=>s.dataset.section===active),routeParams);
  }
  const toc=document.querySelector('.reading-toc');
  const tocList=toc.querySelector('.toc-items');
  let tocTargets=[];
  let tocNodes=[];
  let scheduled=false;
  const collapsedToc=new Set();
  const tocWords={en:{expand:'Expand',collapse:'Collapse'},ja:{expand:'展開',collapse:'折りたたむ'},zh:{expand:'展开',collapse:'收起'}};
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
      const rank=Number(heading.tagName.slice(1));
      while(stack.length && stack.at(-1).rank>=rank)stack.pop();
      const parent=stack.at(-1)||null;
      const node={heading,index,rank,parent,depth:parent?parent.depth+1:0,children:[],key:active+':'+index};
      if(parent)parent.children.push(node);else roots.push(node);
      stack.push(node);tocNodes.push(node);
    });
    function renderNode(node){
      const label=node.heading.innerText.trim().replace(/\s+/g,' ');
      const item=document.createElement('li');item.className='toc-node';item.dataset.depth=Math.min(node.depth,3);
      const row=document.createElement('div');row.className='toc-row';
      const button=document.createElement('button');button.className='toc-item';button.type='button';
      button.setAttribute('aria-label',label);button.title=label;
      const span=document.createElement('span');span.className='toc-label';span.textContent=label;
      const track=document.createElement('span');track.className='toc-track';track.setAttribute('aria-hidden','true');
      const tick=document.createElement('span');tick.className='toc-tick';track.append(tick);
      button.append(span,track);row.append(button);item.append(row);node.element=item;node.button=button;
      button.addEventListener('click',()=>{setOutline(false);node.heading.tabIndex=-1;node.heading.focus({preventScroll:true});node.heading.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});});
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
    let current=tocNodes[0];
    tocNodes.forEach(node=>{if(node.heading.getBoundingClientRect().top<parseFloat(getComputedStyle(doc).getPropertyValue('--reading-top'))+20)current=node;});
    if(window.scrollY>0 && window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-3)current=tocNodes.at(-1);
    // When a branch is closed, its visible ancestor marks the reading position.
    while(current.element.closest('[hidden]') && current.parent)current=current.parent;
    tocNodes.forEach(node=>{
      node.button.classList.toggle('is-active',node===current);
      if(node===current)node.button.setAttribute('aria-current','location');else node.button.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateToc);}},{passive:true});
  document.addEventListener('click',event=>{
    if(event.target.closest('.skip')){
      event.preventDefault(); setMenu(false); setOutline(false);
      if(!entry.hidden){if(location.hash==='#about')route();else location.hash='about';}
      main.focus({preventScroll:false});return;
    }
    const lang=event.target.closest('[data-set-lang]');
    if(lang) {setLanguage(lang.dataset.setLang);return;}
    const top=event.target.closest('[data-scroll-top]');
    if(top){event.preventDefault();window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});return;}
    const link=event.target.closest('a[href^="#"]');
    if(link && link.getAttribute('href')===location.hash){event.preventDefault();route();}
  });
  entry.querySelector('.cover-enter').addEventListener('click',()=>{
    if(location.hash==='#about')route();else location.hash='about';
  });
  menu.addEventListener('click',()=>setMenu(!menuOpen));
  outlineButton.addEventListener('click',()=>setOutline(!outlineOpen));
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
