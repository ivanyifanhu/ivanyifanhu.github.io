(() => {
  'use strict';
  const page=document.querySelector('[data-section="visits"]');
  if(!page)return;
  const manifest=JSON.parse(document.querySelector('#page-manifest').textContent).pages;
  const metrics=Object.fromEntries([...page.querySelectorAll('[data-visit-metric]')].map(el=>[el.dataset.visitMetric,el]));
  const words={
    en:{title:name=>'Visit details for “'+name+'”',local:'Local preview',unavailable:'Visit records are temporarily unavailable.',mapLoading:'Loading visit locations…',noLocations:'No located visits recorded yet.',mapSince:date=>'Location records since '+date,globe:'Visit locations on a globe. Drag or use arrow keys to rotate.',stale:'Showing the last available record.'},
    ja:{title:name=>'「'+name+'」のアクセス詳細',local:'ローカルプレビュー',unavailable:'アクセス記録を一時的に取得できません。',mapLoading:'訪問地域を読み込み中…',noLocations:'位置情報のあるアクセスはまだありません。',mapSince:date=>date+' からの訪問地域',globe:'訪問地域の地球儀。ドラッグまたは矢印キーで回転できます。',stale:'最後に取得した記録を表示しています。'},
    zh:{title:name=>'“'+name+'”的访问详情',local:'本地预览',unavailable:'访问记录暂时无法读取。',mapLoading:'正在读取访问地点…',noLocations:'尚无带位置的访问记录。',mapSince:date=>'访问地点记录始于 '+date,globe:'访问地点地球。拖动或使用方向键旋转。',stale:'显示最近一次取得的记录。'}
  };
  let route='about',language='en',active=false,state='local',data=null,geoEnabled=false;
  const dateParts=value=>{
    if(!value||!Number.isFinite(Date.parse(value)))return null;
    const date=new Date(Date.parse(value)+8*3600000),two=n=>String(n).padStart(2,'0');
    return {date:two(date.getUTCDate())+', '+two(date.getUTCMonth()+1)+', '+date.getUTCFullYear(),time:two(date.getUTCHours())+':'+two(date.getUTCMinutes())+':'+two(date.getUTCSeconds())};
  };
  function dateNode(element,value){
    element.replaceChildren();const p=dateParts(value);if(!p){element.textContent='—';return;}
    const time=document.createElement('time');time.dateTime=value;
    const date=document.createElement('span');date.textContent=p.date;
    const clock=document.createElement('span');clock.className='visit-clock';clock.textContent=p.time;
    time.append(date,clock);element.append(time);
  }
  function paint(){
    const meta=manifest[route],w=words[language];if(!meta)return;
    for(const lang of Object.keys(words))page.querySelector('h1 [data-lang="'+lang+'"]').textContent=words[lang].title(meta.breadcrumbs[lang].join('—'));
    metrics.pageViews.textContent=Number.isSafeInteger(data?.pageViews)?String(data.pageViews):'—';
    dateNode(metrics.publishedAt,meta.publishedAt);dateNode(metrics.updatedAt,meta.updatedAt);dateNode(metrics.lastVisitedAt,data?.lastVisitedAt);
    page.querySelector('.visit-status').textContent=state==='local'?w.local:state==='unavailable'?w.unavailable:state==='stale'?w.stale:'';
    page.querySelector('#visit-globe').setAttribute('aria-label',w.globe);
    const located=Array.isArray(data?.bins)&&data.bins.length;
    page.querySelector('.visit-map-status').textContent=!geoEnabled||data?.source==='legacy'?'':!data?(state==='unavailable'?w.unavailable:w.mapLoading):located&&dateParts(data?.geoSince)?w.mapSince(dateParts(data.geoSince).date):w.noLocations;
    window.VisitGlobe?.setData(data?.source==='own'?data.bins:[]);
    if(active&&location.hash.startsWith('#visits'))document.title=w.title(meta.breadcrumbs[language].join('—'))+' — Ivan Yi-fan Hu';
  }
  function show(value,lang){
    route=manifest[value]?value:'about';language=words[lang]?lang:'en';active=true;data=window.SiteVisits?.latest(route);state='loading';paint();
    window.VisitGlobe?.setVisible(true);window.SiteVisits?.inspect(route);
  }
  function sync(lang){language=words[lang]?lang:'en';if(active)paint();}
  function hide(){active=false;window.VisitGlobe?.setVisible(false);}
  addEventListener('site-visits-update',event=>{const update=event.detail;if(update.route!==route||!active)return;data=update.data;state=update.state;geoEnabled=update.geographyEnabled;paint();});
  window.VisitDetails={show,sync,hide,route:()=>route};
})();
