(() => {
  'use strict';
  const canvas=document.querySelector('#visit-globe');if(!canvas)return;
  const out=canvas.getContext('2d',{alpha:true});if(!out)return;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)'),TAU=Math.PI*2,RAD=Math.PI/180;
  const texture=document.createElement('canvas');texture.width=2048;texture.height=1024;
  const ink=texture.getContext('2d',{willReadFrequently:true});
  const lightMap=document.createElement('canvas');lightMap.width=texture.width;lightMap.height=texture.height;
  const lightInk=lightMap.getContext('2d',{willReadFrequently:true});
  const oldMap=document.createElement('canvas');
  oldMap.width=texture.width;oldMap.height=texture.height;
  const oldInk=oldMap.getContext('2d',{willReadFrequently:true});
  let land=null,bins=[],visible=false,ready=false,frame=0,last=0,lastPaint=0,longitude=115*RAD,latitude=24*RAD,velocity=0,pointer=null,touchedAt=0,size=640;
  let priorBins=[],collection='',hasData=false,transitionStart=-1600,pendingTransition=false,lightMix=1,lightBreath=1;
  const DURATION=680;
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
  const landPromise=window.SiteWorldLandPromise||(window.SiteWorldLandPromise=fetch('assets/world-land.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw new Error('Land map unavailable');return r.json();}));
  const software=document.createElement('canvas');
  let renderer=null,gl=null,program=null,landTexture=null,lightsTexture=null,oldTexture=null,cpuLand=null,cpuLights=null,cpuOld=null,dirty=true,lastData='';
  const makeShader=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
  function initGPU(){
    try{
      renderer=document.createElement('canvas');gl=renderer.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl){canvas.dataset.renderer='canvas';return;}
      program=gl.createProgram();
      gl.attachShader(program,makeShader(gl.VERTEX_SHADER,'attribute vec2 point;varying vec2 uv;void main(){uv=point;gl_Position=vec4(point,0.,1.);}'));
      gl.attachShader(program,makeShader(gl.FRAGMENT_SHADER,`precision highp float;
        varying vec2 uv;uniform sampler2D landMap;uniform sampler2D lightsMap;uniform sampler2D previousLightsMap;
        uniform vec2 rotation;uniform float pixels;uniform float lightMix;uniform float lightBreath;
        void main(){vec2 p=uv/0.89;float d=dot(p,p);if(d>1.){gl_FragColor=vec4(0.);return;}
          float z=sqrt(max(0.,1.-d));float c=cos(rotation.y),s=sin(rotation.y);
          float lat=asin(clamp(p.y*c+z*s,-1.,1.));float lon=atan(p.x,z*c-p.y*s)+rotation.x;
          vec2 st=vec2(fract(lon/6.28318530718+0.5),0.5-lat/3.14159265359);
          vec3 ground=texture2D(landMap,st).rgb;vec4 luminous=texture2D(lightsMap,st),old=texture2D(previousLightsMap,st);
          vec3 light=mix(old.rgb*old.a,luminous.rgb*luminous.a,lightMix)*lightBreath;
          float diffuse=.56+.44*max(0.,dot(vec3(p,z),normalize(vec3(-.4,.5,1.))));
          float rim=pow(1.-z,3.5);vec3 color=ground*diffuse+vec3(.055,.075,.085)*rim+light*(.82+.18*z);
          float alpha=1.-smoothstep(1.-3./pixels,1.,d);gl_FragColor=vec4(color,alpha);
        }`));
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Globe shader link failed');gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const point=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
      landTexture=gl.createTexture();lightsTexture=gl.createTexture();oldTexture=gl.createTexture();
      gl.uniform1i(gl.getUniformLocation(program,'landMap'),0);gl.uniform1i(gl.getUniformLocation(program,'lightsMap'),1);
      gl.uniform1i(gl.getUniformLocation(program,'previousLightsMap'),2);
      renderer.addEventListener('webglcontextlost',event=>{event.preventDefault();gl=null;dirty=true;cpuLand=null;cpuLights=null;cpuOld=null;kick();});
      canvas.dataset.renderer='webgl';
    }catch{gl=null;canvas.dataset.renderer='canvas';}
  }
  function upload(source,unit,target){if(!gl)return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
  function drawLand(){
    ink.fillStyle='#0c141c';ink.fillRect(0,0,texture.width,texture.height);ink.fillStyle='#30404c';ink.strokeStyle='#657780';ink.lineWidth=.9;
    for(const polygon of land?.polygons||[]){
      ink.beginPath();for(const ring of polygon){for(let i=0;i<ring.length;i++){const [lon,lat]=ring[i],x=(lon+180)/360*texture.width,y=(90-lat)/180*texture.height;i?ink.lineTo(x,y):ink.moveTo(x,y);}ink.closePath();}ink.fill('evenodd');ink.stroke();
    }
    upload(texture,0,landTexture);cpuLand=null;
  }
  const identity=point=>String(point.id??(point.lat+','+point.lon));
  const grain=point=>{let n=2166136261;for(const c of identity(point)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return .82+(n>>>0)%100/250;};
  function haloWeights(points){
    const grid=new Map(),key=(lat,lon)=>lat+','+((lon+540)%360-180);
    for(const point of points){const cell=key(Math.floor(point.lat),Math.floor(point.lon));grid.set(cell,(grid.get(cell)||0)+1);}
    return points.map(point=>{
      const x=Math.floor(point.lon),y=Math.floor(point.lat);let nearby=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)nearby+=(grid.get(key(y+dy,x+dx))||0)*(dx===0&&dy===0?1:.3);
      return 1/Math.max(1,nearby)**.28;
    });
  }
  function paintField(target,points){
    const w=2048,h=w/2;target.clearRect(0,0,w,h);target.globalCompositeOperation='source-over';
    const weights=haloWeights(points);
    for(const [i,bin] of points.entries()){
      const x=(bin.lon+180)/360*w,y=(90-bin.lat)/180*h;
      // Bound the outer glow in map degrees, independent of viewport size.
      // City cores remain visible; one Seoul light must not illuminate a country.
      const strength=Math.log2(bin.count+1),variation=grain(bin),r=Math.min(2.2,(1.55+Math.min(.55,strength*.055))*variation),core=Math.min(2,1.8+Math.min(.15,strength*.015)+(variation-1)*.08),stretch=Math.min(3,1/Math.max(.34,Math.cos(bin.lat*RAD)));
      const wraps=[0];if(x-r*stretch<0)wraps.push(w);if(x+r*stretch>w)wraps.push(-w);
      for(const wrap of wraps){
        target.save();target.translate(x+wrap,y);target.scale(stretch,1);
        const glow=target.createRadialGradient(0,0,0,0,0,r);
        glow.addColorStop(0,'rgba(255,224,160,.76)');glow.addColorStop(.2,'rgba(251,205,121,.42)');glow.addColorStop(.56,'rgba(235,167,68,.16)');
        glow.addColorStop(1,'rgba(230,155,55,0)');
        target.globalAlpha=weights[i];target.fillStyle=glow;target.fillRect(-r,-r,r*2,r*2);
        target.globalAlpha=.82+.16*weights[i];target.beginPath();target.arc(0,0,core,0,TAU);target.fillStyle='rgba(255,218,108,.98)';target.fill();target.restore();
      }
    }
    target.globalAlpha=1;
  }
  function drawLights(){
    paintField(oldInk,priorBins);paintField(lightInk,bins);
    upload(lightMap,1,lightsTexture);upload(oldMap,2,oldTexture);
    cpuLights=null;cpuOld=null;lastPaint=0;dirty=true;kick();
  }
  function beginTransition(){
    transitionStart=performance.now();pendingTransition=false;
    lightMix=reduced.matches?1:0;lastPaint=0;dirty=true;
  }
  function updateTransition(now){
    const brightness=reduced.matches?1:breathing.sample();
    const elapsed=now-transitionStart,blend=reduced.matches?1:Math.max(0,Math.min(1,elapsed/DURATION)),mix=blend*blend*(3-2*blend);
    if(mix!==lightMix||brightness!==lightBreath)dirty=true;lightMix=mix;lightBreath=brightness;
  }
  function cpuRender(){
    // Software fallback keeps the same geographic texture at a bounded size.
    const n=Math.min(size,320),r=n*.445,c=n/2;
    if(!cpuLand)cpuLand=ink.getImageData(0,0,2048,1024).data;
    if(!cpuLights)cpuLights=lightInk.getImageData(0,0,2048,1024).data;
    if(lightMix<1&&!cpuOld)cpuOld=oldInk.getImageData(0,0,2048,1024).data;
    if(lightMix===1)cpuOld=null;
    const image=out.createImageData(n,n),data=image.data,cs=Math.cos(latitude),sn=Math.sin(latitude);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const a=(x-c)/r,b=(c-y)/r,d=a*a+b*b;if(d>1)continue;const z=Math.sqrt(1-d);
      const lat=Math.asin(b*cs+z*sn),lon=Math.atan2(a,z*cs-b*sn)+longitude;
      const tx=Math.floor(((lon/TAU+.5)%1+1)%1*2048),ty=Math.min(1023,Math.max(0,Math.floor((.5-lat/Math.PI)*1024))),j=(ty*2048+tx)*4,i=(y*n+x)*4;
      const diffuse=.56+.44*Math.max(0,(-.4*a+.5*b+z)/1.187),rim=(1-z)**3.5,alpha=cpuLights[j+3]/255,oldAlpha=cpuOld?cpuOld[j+3]/255:0;
      for(let k=0;k<3;k++){
        const emission=((cpuOld?cpuOld[j+k]*oldAlpha*(1-lightMix):0)+cpuLights[j+k]*alpha*lightMix)*lightBreath;
        data[i+k]=Math.min(255,cpuLand[j+k]*diffuse+[14,19,22][k]*rim+emission*(.82+.18*z));
      }
      data[i+3]=Math.min(255,(1-d)*n/3*255);
    }
    software.width=n;software.height=n;software.getContext('2d').putImageData(image,0,0);out.clearRect(0,0,size,size);out.drawImage(software,0,0,size,size);
  }
  function paint(){
    if(!ready)return;
    if(gl){
      if(renderer.width!==size){renderer.width=size;renderer.height=size;gl.viewport(0,0,size,size);}
      gl.uniform2f(gl.getUniformLocation(program,'rotation'),longitude,latitude);gl.uniform1f(gl.getUniformLocation(program,'pixels'),size);
      gl.uniform1f(gl.getUniformLocation(program,'lightBreath'),lightBreath);
      gl.uniform1f(gl.getUniformLocation(program,'lightMix'),lightMix);gl.drawArrays(gl.TRIANGLES,0,6);
      out.clearRect(0,0,size,size);out.drawImage(renderer,0,0);
    }else cpuRender();
    canvas.dataset.newLightVisible='0';dirty=false;canvas.dataset.longitude=String(Math.round(longitude/RAD*10)/10);canvas.dataset.latitude=String(Math.round(latitude/RAD*10)/10);
    canvas.dataset.lightBlend=lightMix.toFixed(3);canvas.dataset.lightPulse='0.000';canvas.dataset.lightBreath=lightBreath.toFixed(3);
  }
  function tick(now){
    frame=0;if(!visible||document.hidden||!ready){canvas.dataset.motionState='paused';return;}canvas.dataset.motionState=reduced.matches?'reduced':'active';
    const dt=Math.min(50,last?now-last:16);last=now;updateTransition(now);
    if(!pointer&&!reduced.matches&&!document.documentElement.dataset.languageTransition){
      if(Math.abs(velocity)>.000005){longitude+=velocity*dt;velocity*=Math.pow(.94,dt/16);dirty=true;}
      else if(now-touchedAt>6000){longitude+=dt*.000025;dirty=true;}
    }
    if(dirty&&(now-lastPaint>=(gl?1000/30:1000/24)||!lastPaint)){paint();lastPaint=now;}
    // The rendering surface is only the globe, never the surrounding page.
    if(!reduced.matches||dirty)frame=requestAnimationFrame(tick);
  }
  function kick(){if(visible&&!frame&&ready){last=0;frame=requestAnimationFrame(tick);}}
  function resize(){const width=canvas.getBoundingClientRect().width;if(width<1)return;size=Math.min(800,Math.max(240,Math.round(width*Math.min(devicePixelRatio||1,1.6))));if(canvas.width!==size||canvas.height!==size){canvas.width=size;canvas.height=size;}dirty=true;kick();}
  function setData(value,pageKey=''){
    const next=(Array.isArray(value)?value:[]).filter(b=>Number.isFinite(b.lat)&&Math.abs(b.lat)<=90&&Number.isFinite(b.lon)&&Math.abs(b.lon)<=180&&Number.isSafeInteger(b.count)&&b.count>0);
    const key=JSON.stringify([pageKey,next]);if(key===lastData)return;
    const samePage=hasData&&collection===pageKey;
    priorBins=samePage?bins:next;
    pendingTransition=Boolean(samePage);lastData=key;collection=pageKey;bins=next;hasData=next.length>0;
    if(!pendingTransition){transitionStart=performance.now()-DURATION;lightMix=1;}
    else if(visible)beginTransition();
    canvas.dataset.locatedVisits=String(bins.reduce((n,b)=>n+b.count,0));canvas.dataset.lightCount=String(bins.length);canvas.dataset.newLights='0';
    if(ready)drawLights();
  }
  function setVisible(value){visible=value;canvas.dataset.motionState=value?(reduced.matches?'reduced':'active'):'paused';if(visible){if(pendingTransition)beginTransition();resize();kick();}else{cancelAnimationFrame(frame);frame=0;pointer=null;canvas.classList.remove('is-dragging');}}
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,last:performance.now(),locked:event.pointerType!=='touch'};velocity=0;touchedAt=performance.now();if(pointer.locked)canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
    if(!pointer||event.pointerId!==pointer.id)return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,now=performance.now();
    if(!pointer.locked){if(Math.abs(dy)>Math.abs(dx)+5){pointer=null;return;}if(Math.abs(dx)<5)return;pointer.locked=true;canvas.setPointerCapture(event.pointerId);}
    canvas.classList.add('is-dragging');const scale=3.6/(canvas.getBoundingClientRect().width||400);longitude-=dx*scale;latitude=Math.max(-1.32,Math.min(1.32,latitude+dy*scale));velocity=-dx*scale/Math.max(12,now-pointer.last);
    pointer.x=event.clientX;pointer.y=event.clientY;pointer.last=now;touchedAt=now;dirty=true;kick();
  });
  const end=event=>{if(pointer?.id!==event.pointerId)return;pointer=null;touchedAt=performance.now();canvas.classList.remove('is-dragging');if(reduced.matches)velocity=0;kick();};
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();velocity=0;touchedAt=performance.now();if(event.key==='Home'){longitude=115*RAD;latitude=24*RAD;}else if(event.key==='ArrowLeft')longitude+=10*RAD;else if(event.key==='ArrowRight')longitude-=10*RAD;else latitude=Math.max(-1.32,Math.min(1.32,latitude+(event.key==='ArrowUp'?-10:10)*RAD));dirty=true;kick();});
  new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',kick);reduced.addEventListener('change',()=>{velocity=0;dirty=true;kick();});
  window.VisitGlobe={setData,setVisible};
  initGPU();drawLand();ready=true;drawLights();resize();
  landPromise.then(value=>{land=value;drawLand();canvas.dataset.mapReady='true';canvas.dataset.mapState='ready';lastPaint=0;dirty=true;kick();}).catch(()=>{canvas.dataset.mapState='outline-unavailable';lastPaint=0;dirty=true;kick();});
})();
