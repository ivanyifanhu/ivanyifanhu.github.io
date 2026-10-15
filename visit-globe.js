(() => {
  'use strict';
  const canvas=document.querySelector('#visit-globe');if(!canvas)return;
  const out=canvas.getContext('2d',{alpha:true});if(!out)return;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)'),TAU=Math.PI*2,RAD=Math.PI/180;
  const texture=document.createElement('canvas');texture.width=2048;texture.height=1024;
  const ink=texture.getContext('2d',{willReadFrequently:true});
  const lightMap=document.createElement('canvas');lightMap.width=texture.width;lightMap.height=texture.height;
  const lightInk=lightMap.getContext('2d',{willReadFrequently:true});
  let land=null,bins=[],visible=false,ready=false,frame=0,last=0,longitude=105*RAD,latitude=22*RAD,velocity=0,pointer=null,touchedAt=0,size=640;
  const software=document.createElement('canvas');
  let renderer=null,gl=null,program=null,landTexture=null,lightsTexture=null,cpuLand=null,cpuLights=null,dirty=true,lastData='';
  const makeShader=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
  function initGPU(){
    try{
      renderer=document.createElement('canvas');gl=renderer.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl)return;
      program=gl.createProgram();
      gl.attachShader(program,makeShader(gl.VERTEX_SHADER,'attribute vec2 point;varying vec2 uv;void main(){uv=point;gl_Position=vec4(point,0.,1.);}'));
      gl.attachShader(program,makeShader(gl.FRAGMENT_SHADER,`precision highp float;
        varying vec2 uv;uniform sampler2D landMap;uniform sampler2D lightsMap;uniform vec2 rotation;uniform float pixels;
        void main(){vec2 p=uv/0.89;float d=dot(p,p);if(d>1.){gl_FragColor=vec4(0.);return;}
          float z=sqrt(max(0.,1.-d));float c=cos(rotation.y),s=sin(rotation.y);
          float lat=asin(clamp(p.y*c+z*s,-1.,1.));float lon=atan(p.x,z*c-p.y*s)+rotation.x;
          vec2 st=vec2(fract(lon/6.28318530718+0.5),0.5-lat/3.14159265359);
          vec3 ground=texture2D(landMap,st).rgb;vec4 luminous=texture2D(lightsMap,st);vec3 light=luminous.rgb*luminous.a;
          float diffuse=.56+.44*max(0.,dot(vec3(p,z),normalize(vec3(-.4,.5,1.))));
          float rim=pow(1.-z,3.5);vec3 color=ground*diffuse+vec3(.055,.075,.085)*rim+light*(.82+.18*z);
          float alpha=1.-smoothstep(1.-3./pixels,1.,d);gl_FragColor=vec4(color,alpha);
        }`));
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Globe shader link failed');gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const point=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
      landTexture=gl.createTexture();lightsTexture=gl.createTexture();
      gl.uniform1i(gl.getUniformLocation(program,'landMap'),0);gl.uniform1i(gl.getUniformLocation(program,'lightsMap'),1);
      renderer.addEventListener('webglcontextlost',event=>{event.preventDefault();gl=null;dirty=true;cpuLand=null;cpuLights=null;kick();});
      canvas.dataset.renderer='webgl';
    }catch{gl=null;canvas.dataset.renderer='canvas';}
  }
  function upload(source,unit,target){if(!gl)return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
  function drawLand(){
    ink.fillStyle='#0c141c';ink.fillRect(0,0,texture.width,texture.height);ink.fillStyle='#30404c';ink.strokeStyle='#465863';ink.lineWidth=.65;
    for(const polygon of land.polygons){
      ink.beginPath();for(const ring of polygon){for(let i=0;i<ring.length;i++){const [lon,lat]=ring[i],x=(lon+180)/360*texture.width,y=(90-lat)/180*texture.height;i?ink.lineTo(x,y):ink.moveTo(x,y);}ink.closePath();}ink.fill('evenodd');ink.stroke();
    }
    upload(texture,0,landTexture);cpuLand=null;
  }
  function drawLights(){
    lightInk.clearRect(0,0,lightMap.width,lightMap.height);
    // The fixed geographic cell is the unit of light. Additional visits add
    // energy, not fictitious locations or scattered copies of the same IP.
    for(const bin of bins){
      const x=(bin.lon+180)/360*lightMap.width,y=(90-bin.lat)/180*lightMap.height;
      const strength=Math.log2(bin.count+1),r=2.6+Math.min(8,strength*1.05),stretch=Math.min(3,1/Math.max(.34,Math.cos(bin.lat*RAD)));
      for(const wrap of [-lightMap.width,0,lightMap.width]){
        lightInk.save();lightInk.translate(x+wrap,y);lightInk.scale(stretch,1);
        const glow=lightInk.createRadialGradient(0,0,0,0,0,r);glow.addColorStop(0,'rgba(255,222,146,'+Math.min(1,.65+strength*.08)+')');glow.addColorStop(.2,'rgba(241,183,88,'+Math.min(.9,.4+strength*.055)+')');glow.addColorStop(1,'rgba(230,155,55,0)');
        lightInk.fillStyle=glow;lightInk.fillRect(-r,-r,r*2,r*2);lightInk.restore();
      }
    }
    upload(lightMap,1,lightsTexture);cpuLights=null;dirty=true;kick();
  }
  function cpuRender(){
    // Software fallback keeps the same real map and bins, at a bounded size.
    const n=Math.min(size,280),r=n*.445,c=n/2;
    if(!cpuLand)cpuLand=ink.getImageData(0,0,2048,1024).data;
    if(!cpuLights)cpuLights=lightInk.getImageData(0,0,2048,1024).data;
    const image=out.createImageData(n,n),data=image.data,cs=Math.cos(latitude),sn=Math.sin(latitude);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const a=(x-c)/r,b=(c-y)/r,d=a*a+b*b;if(d>1)continue;const z=Math.sqrt(1-d);
      const lat=Math.asin(b*cs+z*sn),lon=Math.atan2(a,z*cs-b*sn)+longitude;
      const tx=Math.floor(((lon/TAU+.5)%1+1)%1*2048),ty=Math.min(1023,Math.max(0,Math.floor((.5-lat/Math.PI)*1024))),j=(ty*2048+tx)*4,i=(y*n+x)*4;
      const diffuse=.56+.44*Math.max(0,(-.4*a+.5*b+z)/1.187),rim=(1-z)**3.5,alpha=cpuLights[j+3]/255;
      for(let k=0;k<3;k++)data[i+k]=Math.min(255,cpuLand[j+k]*diffuse+[14,19,22][k]*rim+cpuLights[j+k]*alpha*(.82+.18*z));
      data[i+3]=Math.min(255,(1-d)*n/3*255);
    }
    software.width=n;software.height=n;software.getContext('2d').putImageData(image,0,0);out.clearRect(0,0,size,size);out.drawImage(software,0,0,size,size);
  }
  function paint(){
    if(!ready)return;
    if(gl){
      if(renderer.width!==size){renderer.width=size;renderer.height=size;gl.viewport(0,0,size,size);}
      gl.uniform2f(gl.getUniformLocation(program,'rotation'),longitude,latitude);gl.uniform1f(gl.getUniformLocation(program,'pixels'),size);gl.drawArrays(gl.TRIANGLES,0,6);
      out.clearRect(0,0,size,size);out.drawImage(renderer,0,0);
    }else cpuRender();
    dirty=false;canvas.dataset.longitude=String(Math.round(longitude/RAD*10)/10);canvas.dataset.latitude=String(Math.round(latitude/RAD*10)/10);
  }
  function tick(now){
    frame=0;if(!visible||document.hidden||!ready)return;
    const dt=Math.min(50,last?now-last:16);last=now;
    if(!pointer&&!reduced.matches&&!document.documentElement.dataset.languageTransition){
      if(Math.abs(velocity)>.000005){longitude+=velocity*dt;velocity*=Math.pow(.94,dt/16);dirty=true;}
      else if(now-touchedAt>6000){longitude+=dt*.000025;dirty=true;}
    }
    if(dirty)paint();
    // The rendering surface is only the globe, never the surrounding page.
    if(!reduced.matches||dirty)frame=requestAnimationFrame(tick);
  }
  function kick(){if(visible&&!frame&&ready){last=0;frame=requestAnimationFrame(tick);}}
  function resize(){const width=canvas.getBoundingClientRect().width;if(width<1)return;size=Math.min(800,Math.max(240,Math.round(width*Math.min(devicePixelRatio||1,1.6))));canvas.width=size;canvas.height=size;dirty=true;kick();}
  function setData(value){
    const next=(Array.isArray(value)?value:[]).filter(b=>Number.isFinite(b.lat)&&Math.abs(b.lat)<=90&&Number.isFinite(b.lon)&&Math.abs(b.lon)<=180&&Number.isSafeInteger(b.count)&&b.count>0).slice(0,16200);
    const key=JSON.stringify(next);if(key===lastData)return;lastData=key;bins=next;canvas.dataset.locatedVisits=String(bins.reduce((n,b)=>n+b.count,0));if(ready)drawLights();
  }
  function setVisible(value){visible=value;if(visible){resize();kick();}else{cancelAnimationFrame(frame);frame=0;pointer=null;canvas.classList.remove('is-dragging');}}
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
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();velocity=0;touchedAt=performance.now();if(event.key==='Home'){longitude=105*RAD;latitude=22*RAD;}else if(event.key==='ArrowLeft')longitude+=10*RAD;else if(event.key==='ArrowRight')longitude-=10*RAD;else latitude=Math.max(-1.32,Math.min(1.32,latitude+(event.key==='ArrowUp'?-10:10)*RAD));dirty=true;kick();});
  new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',kick);reduced.addEventListener('change',()=>{velocity=0;dirty=true;kick();});
  window.VisitGlobe={setData,setVisible};
  fetch('assets/world-land.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw new Error('Land map unavailable');return r.json();}).then(value=>{land=value;initGPU();drawLand();ready=true;drawLights();resize();kick();}).catch(()=>{canvas.dataset.mapState='unavailable';});
})();
