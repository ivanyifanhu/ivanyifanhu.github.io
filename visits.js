(() => {
  'use strict';
  const footer=document.querySelector('.page-views');
  if(!footer)return;
  const legacy='https://busuanzi.9420.ltd/api';
  const config=window.SiteAnalyticsConfig||{};
  const production=location.protocol==='https:'&&location.hostname==='ivanyifanhu.github.io'&&!location.port;
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  const enabled=production||(local&&config.allowLocal===true);
  let endpoint='';
  try{const url=new URL(config.endpoint);if(url.protocol==='https:'||(local&&config.allowLocal&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))endpoint=url.href.replace(/\/$/,'');}catch{}
  const manifest=JSON.parse(document.querySelector('#page-manifest')?.textContent||'{"pages":{}}');
  const routes=new Set(Object.keys(manifest.pages));
  const values=footer.querySelectorAll('[data-view-value]');
  const siteValues=document.querySelectorAll('[data-site-view-value]');
  const siteFooter=document.querySelector('.site-views');
  const link=footer.querySelector('.visit-details-link');
  const cache=new Map();
  let language=document.documentElement.lang||'en',current=null,polling=false,footerVisible=false,siteNeedsRefresh=false;
  const hints={
    en:{local:'Local preview; counting starts on the published site.',loading:'Loading page views…',ready:'Page views since the counter was enabled. Refreshes count as visits.',unavailable:'The visit counter is temporarily unavailable.',stale:'Last available page-view count.'},
    ja:{local:'ローカルプレビュー。本番サイトで計測します。',loading:'閲覧数を読み込み中…',ready:'計測開始後の閲覧数。再読み込みも1回として数えます。',unavailable:'閲覧数を一時的に取得できません。',stale:'最後に取得した閲覧数。'},
    zh:{local:'本地预览；发布后开始统计。',loading:'正在读取访问数量…',ready:'自计数启用以来的页面访问次数；每次刷新计为一次。',unavailable:'访问数量暂时无法读取。',stale:'最近一次成功读取的访问数量。'}
  };
  function paint(state){
    const data=current?cache.get(current.route):null;
    for(const detail of document.querySelectorAll('.visit-details-link'))detail.setAttribute('aria-label',({en:'Details',ja:'詳細',zh:'详情'})[language]);
    footer.dataset.visitState=state;footer.title=hints[language][state];
    for(const element of values)element.textContent=Number.isSafeInteger(data?.pageViews)?data.pageViews.toLocaleString('en-US'):'—';
    const siteCount=cache.get('__site__')?.pageViews;
    for(const element of siteValues)element.textContent=Number.isSafeInteger(siteCount)?siteCount.toLocaleString('en-US'):'—';
    if(siteFooter){siteFooter.dataset.visitState=state;siteFooter.title=hints[language][state];}
    if(link&&current){link.href='#visits?page='+encodeURIComponent(current.route);link.toggleAttribute('data-current-detail',current.readOnly);}
    dispatchEvent(new CustomEvent('site-visits-update',{detail:{route:current?.route,data:data||null,state,geographyEnabled:Boolean(endpoint)}}));
  }
  async function request(method,route,visitId,legacyOnly=false){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const own=Boolean(endpoint)&&!legacyOnly;
      const site=route==='__site__';
      if(site&&method!=='GET')throw new Error('Site metrics are read-only');
      const headers=own?{}:{'x-bsz-referer':'https://ivanyifanhu.github.io/'+(route==='entry'||site?'':route)};
      if(own&&method==='POST')headers['Content-Type']='application/json';
      const response=await fetch(own?endpoint+(site?'/v1/site':'/v1/visits'+(method==='GET'?'?route='+encodeURIComponent(route):'')):legacy,{
        method,mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers,
        ...(own&&method==='POST'?{body:JSON.stringify({route,visitId})}:{}),signal:controller.signal
      });
      if(!response.ok)throw new Error('Counter unavailable');
      const result=await response.json(),value=own?result?.data?.pageViews:result?.data?.[site?'site_pv':'page_pv'];
      if(result.success!==true||!Number.isSafeInteger(value)||value<0)throw new Error('Invalid counter response');
      if(own&&result.data.route!==route)throw new Error('Mismatched page');
      const total=own?(site?value:result.sitePageViews):result?.data?.site_pv;
      if(Number.isSafeInteger(total)&&total>=0&&!site)remember('__site__',{route:'__site__',pageViews:total,source:own?'own':'legacy',partial:true});
      return own?{...result.data,source:'own'}:{route,pageViews:value,bins:[],lastVisitedAt:null,geoSince:null,source:'legacy'};
    }finally{clearTimeout(timer);}
  }
  function remember(route,data){
    const prior=cache.get(route);
    // Concurrent navigation/read-only requests can finish out of order. A
    // lifetime count never decreases, and a legacy reply cannot erase geo data.
    if(prior&&(data.pageViews<prior.pageViews||(data.pageViews===prior.pageViews&&prior.source==='own'&&data.source!=='own')))return;
    if(prior&&data.partial&&!prior.partial){cache.set(route,{...prior,pageViews:Math.max(prior.pageViews,data.pageViews)});return;}
    if(prior&&data.pageViews===prior.pageViews&&prior.lastVisitedAt&&data.lastVisitedAt&&data.lastVisitedAt<prior.lastVisitedAt)return;
    cache.set(route,data);
  }
  async function load(target,method){
    target.pending=true;
    try{
      const data=await request(method,target.route,target.visitId);
      remember(target.route,data);
      if(method==='POST'&&current?.route==='__site__')siteNeedsRefresh=true;
      paint(current?.route===target.route?'ready':footer.dataset.visitState||'ready');
    }catch{
      // A timed-out POST may have committed: only a read-only fallback is safe.
      if(endpoint&&production&&!cache.has(target.route)){
        try{remember(target.route,await request('GET',target.route,null,true));}catch{}
      }
      if(current===target)paint(cache.has(target.route)?'stale':'unavailable');
    }finally{
      target.pending=false;
      if(siteNeedsRefresh&&current?.route==='__site__'&&!current.pending){siteNeedsRefresh=false;load(current,'GET');}
    }
  }
  async function refresh(){
    if(!enabled||!current||current.pending||polling||document.hidden||(!footerVisible&&!current.readOnly))return;
    polling=true;try{await load(current,'GET');}finally{polling=false;}
  }
  function show(route){
    if(!routes.has(route)||(current?.route===route&&!current.readOnly))return;
    current={route,pending:false,readOnly:false,visitId:crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
    if(!enabled){paint('local');return;}
    paint('loading');load(current,'POST');
  }
  function inspect(route){
    if(route!=='__site__'&&!routes.has(route))route='about';
    current={route,pending:false,readOnly:true};
    if(!enabled){paint('local');return;}
    paint(cache.has(route)?'ready':'loading');load(current,'GET');
  }
  function sync(value){language=hints[value]?value:'en';paint(footer.dataset.visitState||(enabled?'loading':'local'));}
  if(enabled){
    if('IntersectionObserver'in window){const shown=new Set(),observer=new IntersectionObserver(entries=>{for(const entry of entries)entry.isIntersecting?shown.add(entry.target):shown.delete(entry.target);footerVisible=shown.size>0;if(footerVisible)refresh();});observer.observe(footer);if(siteFooter)observer.observe(siteFooter);}else footerVisible=true;
    setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  }
  window.SiteVisits={show,inspect,inspectSite:()=>inspect('__site__'),sync,latest:route=>cache.get(route)||null};
  paint(enabled?'loading':'local');
})();
