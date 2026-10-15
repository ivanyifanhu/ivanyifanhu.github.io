(() => {
  'use strict';
  const page=document.querySelector('[data-section="site-visits"]'),canvas=document.querySelector('#site-night-map');if(!page||!canvas)return;
  const ctx=canvas.getContext('2d'),manifest=JSON.parse(document.querySelector('#page-manifest').textContent),reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const base=document.createElement('canvas'),lights=document.createElement('canvas'),previous=document.createElement('canvas');
  for(const c of [base,lights,previous]){c.width=2048;c.height=1024;}
  const ground=base.getContext('2d'),light=lights.getContext('2d'),old=previous.getContext('2d');
  const metrics=Object.fromEntries([...page.querySelectorAll('[data-site-metric]')].map(el=>[el.dataset.siteMetric,el]));
  const labels={en:'World map of site visits at night.',ja:'サイト全体の訪問地域を示す世界の夜光地図。',zh:'全站访问地点的世界夜光地图。'};
  let active=false,ready=false,data=null,language='en',lastKey='',frame=0,start=0,blend=1,bins=[];
  function dateNode(element,value){
    element.replaceChildren();if(!value||!Number.isFinite(Date.parse(value))){element.textContent='—';return;}
    const d=new Date(Date.parse(value)+8*3600000),two=n=>String(n).padStart(2,'0'),time=document.createElement('time');time.dateTime=value;
    const date=document.createElement('span');date.textContent=two(d.getUTCDate())+', '+two(d.getUTCMonth()+1)+', '+d.getUTCFullYear();
    const clock=document.createElement('span');clock.className='visit-clock';clock.textContent=two(d.getUTCHours())+':'+two(d.getUTCMinutes())+':'+two(d.getUTCSeconds());time.append(date,clock);element.append(time);
  }
  function paintMetrics(){
    metrics.pageViews.textContent=Number.isSafeInteger(data?.pageViews)?String(data.pageViews):'—';
    dateNode(metrics.publishedAt,manifest.site?.publishedAt);dateNode(metrics.updatedAt,manifest.site?.updatedAt);dateNode(metrics.lastVisitedAt,data?.lastVisitedAt);
    canvas.setAttribute('aria-label',labels[language]);
  }
  function render(now){
    frame=0;if(!active||!ready)return;
    blend=reduced.matches?1:Math.min(1,(now-start)/520);const eased=1-(1-blend)**3;
    ctx.clearRect(0,0,2048,1024);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(base,0,0);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-eased;ctx.drawImage(previous,0,0);ctx.globalAlpha=eased;ctx.drawImage(lights,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    if(blend<1)frame=requestAnimationFrame(render);
  }
  function drawLights(animate=true){
    if(!ready)return;old.clearRect(0,0,2048,1024);old.drawImage(lights,0,0);light.clearRect(0,0,2048,1024);
    const scale=2048/Math.max(280,canvas.getBoundingClientRect().width||1000);
    for(const bin of bins){
      const x=(bin.lon+180)/360*2048,y=(90-bin.lat)/180*1024,power=Math.log2(bin.count+1),r=(1.3+Math.min(2.5,power*.38))*scale;
      for(const offset of [-2048,0,2048]){const glow=light.createRadialGradient(x+offset,y,0,x+offset,y,r);glow.addColorStop(0,'rgba(255,227,155,'+Math.min(.98,.62+power*.07)+')');glow.addColorStop(.23,'rgba(246,185,82,'+Math.min(.85,.36+power*.04)+')');glow.addColorStop(1,'rgba(228,149,48,0)');light.fillStyle=glow;light.fillRect(x+offset-r,y-r,r*2,r*2);}
    }
    cancelAnimationFrame(frame);start=performance.now()-(animate?0:600);frame=requestAnimationFrame(render);canvas.dataset.locatedVisits=String(bins.reduce((n,b)=>n+b.count,0));
  }
  function setData(value){
    const next=(Array.isArray(value)?value:[]).filter(b=>Number.isFinite(b.lat)&&Math.abs(b.lat)<=90&&Number.isFinite(b.lon)&&Math.abs(b.lon)<=180&&Number.isSafeInteger(b.count)&&b.count>0).slice(0,16200);
    const key=JSON.stringify(next);if(key===lastKey)return;lastKey=key;bins=next;drawLights();
  }
  function show(lang){language=labels[lang]?lang:'en';active=true;data=window.SiteVisits?.latest('__site__');paintMetrics();setData(data?.source==='own'?data.bins:[]);drawLights(false);window.SiteVisits?.inspectSite();}
  function hide(){active=false;cancelAnimationFrame(frame);frame=0;}
  function sync(lang){language=labels[lang]?lang:'en';if(active)paintMetrics();}
  addEventListener('site-visits-update',event=>{if(event.detail.route!=='__site__'||!active)return;data=event.detail.data;paintMetrics();setData(data?.source==='own'?data.bins:[]);});
  new ResizeObserver(()=>{if(active)drawLights(false);}).observe(canvas);
  fetch('assets/world-land.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}).then(land=>{
    ground.fillStyle='#0a0d0e';ground.fillRect(0,0,2048,1024);ground.fillStyle='#1d2c35';ground.strokeStyle='#34444a';ground.lineWidth=.55;
    for(const polygon of land.polygons){ground.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*2048,y=(90-lat)/180*1024;i?ground.lineTo(x,y):ground.moveTo(x,y);});ground.closePath();}ground.fill('evenodd');ground.stroke();}
    ready=true;canvas.dataset.mapReady='true';drawLights(false);
  }).catch(()=>{canvas.dataset.mapState='unavailable';});
  window.SiteNightMap={show,hide,sync};
})();
