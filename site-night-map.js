(() => {
  'use strict';
  const page=document.querySelector('[data-section="site-visits"]'),canvas=document.querySelector('#site-night-map');if(!page||!canvas)return;
  const ctx=canvas.getContext('2d'),manifest=JSON.parse(document.querySelector('#page-manifest').textContent),reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const base=document.createElement('canvas'),previous=document.createElement('canvas'),fields=Array.from({length:3},()=>document.createElement('canvas'));
  const ground=base.getContext('2d'),old=previous.getContext('2d'),inks=fields.map(c=>c.getContext('2d'));
  let mapWidth=1280,mapHeight=640,displayScale=1,land=null;
  const metrics=Object.fromEntries([...page.querySelectorAll('[data-site-metric]')].map(el=>[el.dataset.siteMetric,el]));
  const labels={en:'World map of site visits at night.',ja:'サイト全体の訪問地域を示す世界の夜光地図。',zh:'全站访问地点的世界夜光地图。'};
  let active=false,data=null,language='en',lastKey='',frame=0,start=0,bins=[],priorBins=[],lastWidth=0,hasData=false,lastPaint=0;
  const DURATION=680,TAU=Math.PI*2;
  // A wall-clock envelope keeps every light in both views on the same phase.
  // The short dark rest is fully zero; the cosine easing has no hard edges.
  const breathing=window.VisitLightBreathing||(window.VisitLightBreathing=Object.freeze({
    period:5600,
    sample(time=Date.now()){
      const phase=((time%5600)+5600)%5600/5600;
      if(phase<=.08||phase>=.92)return 0;
      return Math.sin(Math.PI*(phase-.08)/.84)**2;
    }
  }));
  // Both views share the local outline read. Lights render before it completes.
  const landPromise=window.SiteWorldLandPromise||(window.SiteWorldLandPromise=fetch('assets/world-land.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}));
  const identity=point=>String(point.id??(point.lat+','+point.lon));
  const grain=point=>{let n=2166136261;for(const c of identity(point)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return .82+(n>>>0)%100/250;};
  function drawLand(){
    ground.fillStyle='#0a0d0e';ground.fillRect(0,0,mapWidth,mapHeight);
    ground.fillStyle='#293a43';ground.strokeStyle='#60717a';ground.lineWidth=Math.max(.65,displayScale*.55);
    for(const polygon of land?.polygons||[]){
      ground.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*mapWidth,y=(90-lat)/180*mapHeight;i?ground.lineTo(x,y):ground.moveTo(x,y);});ground.closePath();}ground.fill('evenodd');ground.stroke();
    }
  }
  function paintFields(points){
    for(const target of inks){target.clearRect(0,0,mapWidth,mapHeight);target.globalCompositeOperation='source-over';}
    // Subpixel aggregation retains visit mass and prevents a dense city from
    // requiring hundreds of gradient draws at the same on-screen location.
    const cells=new Map();
    for(const bin of points){
      const x=(bin.lon+180)/360*mapWidth,y=(90-bin.lat)/180*mapHeight,key=Math.round(x*4)+','+Math.round(y*4);
      const cell=cells.get(key);if(cell){cell.count+=bin.count;cell.points++;}else cells.set(key,{x,y,count:bin.count,points:1,layer:Math.floor(grain(bin)*100)%3});
    }
    for(const cell of cells.values()){
      const {x,y,count,layer}=cell,target=inks[layer],mass=1-Math.exp(-count/260),r=mapWidth*.39/360,core=Math.min(r,Math.max(.48,(.18+.21*mass)*mapWidth/360));
      const glow=target.createRadialGradient(x,y,0,x,y,r);
      glow.addColorStop(0,`rgba(255,213,68,${.28+.62*mass})`);glow.addColorStop(.4,`rgba(248,190,75,${.1+.25*mass})`);glow.addColorStop(1,'rgba(228,149,48,0)');
      target.fillStyle=glow;target.fillRect(x-r,y-r,r*2,r*2);
      target.beginPath();target.arc(x,y,core,0,TAU);target.fillStyle=`rgba(255,213,55,${.45+.55*mass})`;target.fill();
    }
    canvas.dataset.renderCells=String(cells.size);
  }
  function composite(target,brightness=1,alpha=1){
    target.globalCompositeOperation='lighter';for(let i=0;i<fields.length;i++){target.globalAlpha=alpha*brightness;target.drawImage(fields[i],0,0);}target.globalAlpha=1;target.globalCompositeOperation='source-over';
  }
  function rememberField(){old.clearRect(0,0,mapWidth,mapHeight);composite(old);}
  function rebuild(){
    const width=Math.max(280,canvas.getBoundingClientRect().width||1000);lastWidth=width;
    const nextWidth=Math.min(2560,Math.max(640,Math.round(width*Math.min(devicePixelRatio||1,2)/2)*2));
    mapWidth=nextWidth;mapHeight=mapWidth/2;displayScale=mapWidth/width;
    for(const c of [canvas,base,previous,...fields]){c.width=mapWidth;c.height=mapHeight;}
    drawLand();paintFields(priorBins);rememberField();paintFields(bins);
    canvas.dataset.locatedVisits=String(bins.reduce((n,b)=>n+b.count,0));canvas.dataset.lightCount=String(bins.length);canvas.dataset.newLights='0';canvas.dataset.pixelRatio=displayScale.toFixed(2);
  }
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
    frame=0;if(!active||document.hidden){canvas.dataset.motionState='paused';return;}canvas.dataset.motionState=reduced.matches?'reduced':'active';
    const elapsed=now-start,blend=reduced.matches?1:Math.max(0,Math.min(1,elapsed/DURATION)),eased=blend*blend*(3-2*blend);
    const animating=!reduced.matches;
    if(lastPaint&&now-lastPaint<1000/30&&animating){frame=requestAnimationFrame(render);return;}
    lastPaint=now;ctx.clearRect(0,0,mapWidth,mapHeight);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(base,0,0);
    const brightness=reduced.matches?1:breathing.sample();
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-eased)*brightness;ctx.drawImage(previous,0,0);composite(ctx,brightness,eased);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    canvas.dataset.lightBlend=eased.toFixed(3);canvas.dataset.lightPulse='0.000';canvas.dataset.lightBreath=brightness.toFixed(3);
    if(animating)frame=requestAnimationFrame(render);
  }
  function kick(){if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(render);}
  function setData(value){
    const next=(Array.isArray(value)?value:[]).filter(b=>Number.isFinite(b.lat)&&Math.abs(b.lat)<=90&&Number.isFinite(b.lon)&&Math.abs(b.lon)<=180&&Number.isSafeInteger(b.count)&&b.count>0);
    const key=JSON.stringify(next);if(key===lastKey)return;
    priorBins=hasData?bins:next;
    const animate=hasData;lastKey=key;bins=next;hasData=next.length>0;
    rebuild();start=performance.now()-(animate&&!reduced.matches?0:DURATION);lastPaint=0;kick();
  }
  function show(lang){language=labels[lang]?lang:'en';active=true;data=window.SiteVisits?.latest('__site__');paintMetrics();setData(['own','time-model'].includes(data?.source)?data.bins:[]);kick();window.SiteVisits?.inspectSite();}
  function hide(){active=false;canvas.dataset.motionState='paused';cancelAnimationFrame(frame);frame=0;}
  function sync(lang){language=labels[lang]?lang:'en';if(active)paintMetrics();}
  addEventListener('site-visits-update',event=>{if(event.detail.route!=='__site__'||!active)return;data=event.detail.data;paintMetrics();setData(['own','time-model'].includes(data?.source)?data.bins:[]);});
  new ResizeObserver(()=>{const width=canvas.getBoundingClientRect().width;if(active&&width>0&&Math.abs(width-lastWidth)>.5){rebuild();lastPaint=0;kick();}}).observe(canvas);
  document.addEventListener('visibilitychange',kick);reduced.addEventListener('change',()=>{lastPaint=0;kick();});
  landPromise.then(value=>{
    land=value;drawLand();canvas.dataset.mapReady='true';canvas.dataset.mapState='ready';lastPaint=0;kick();
  }).catch(()=>{canvas.dataset.mapState='outline-unavailable';lastPaint=0;kick();});
  window.SiteNightMap={show,hide,sync};
})();
