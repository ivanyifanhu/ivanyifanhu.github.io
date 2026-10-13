(() => {
  'use strict';

  const start = () => {
    const entry = document.getElementById('entry');
    const canvas = document.getElementById('cover-canvas');
    if (!entry || !canvas) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const fallback = entry.querySelector('.cover-fallback');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    const interval = 1000 / 24;
    const { min, max, hypot, pow, round, sin, cos, floor } = Math;
    const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    let base, still, frame, buffer, fields, objects = [];
    let width = 0, height = 0, ready = false, inView = true;
    let timer = 0, elapsed = 0, lastTime = 0;
    canvas.hidden = true;
    canvas.style.imageRendering = 'pixelated';
    const visible = () => ready && !document.hidden && !entry.hidden && inView && entry.getClientRects().length > 0;
    const clamp = (n, lo = 0, hi = 1) => n < lo ? lo : n > hi ? hi : n;
    const smooth = n => { n = clamp(n); return n*n*(3-2*n); };

    // Coordinates are manually traced against the 1774 × 887 source painting.
    // Cloth/boats/plants are transparent sprites, never rectangular image patches.
    // Flagpoles, ropes, architecture and exposed stone stay in the static plate.
    const flags = [
      { name:'summit-black', pin:[1501,191], reach:8.5, points:[[1505,194],[1530,214],[1565,235],[1598,249],[1627,256],[1642,260],[1648,270],[1655,283],[1651,298],[1658,314],[1671,339],[1683,359],[1696,374],[1710,373],[1721,368],[1735,363],[1745,358],[1753,351],[1764,350],[1773,351],[1773,360],[1759,360],[1744,363],[1736,371],[1721,382],[1696,390],[1667,396],[1644,391],[1623,379],[1603,372],[1585,371],[1560,382],[1531,392],[1504,403],[1487,416],[1497,349],[1503,280]], parts:[[[1645,278],[1661,280],[1668,289],[1673,301],[1685,305],[1692,315],[1702,315],[1710,312],[1720,313],[1730,319],[1742,320],[1751,315],[1757,310],[1766,307],[1773,307],[1773,312],[1760,313],[1752,319],[1750,326],[1742,332],[1730,329],[1719,323],[1705,322],[1690,329],[1676,328],[1664,320],[1653,306]],[[1680,353],[1695,355],[1702,352],[1712,355],[1721,362],[1732,363],[1731,369],[1720,370],[1709,365],[1701,363],[1689,370]]], holes:[[[1657,301],[1673,307],[1684,314],[1687,319],[1673,317],[1661,314]],[[1691,371],[1701,365],[1710,367],[1717,371],[1705,376],[1699,376]]] },
      { name:'middle-black', pin:[1279,432], reach:7.5, points:[[1283,435],[1302,447],[1321,458],[1345,467],[1364,475],[1374,485],[1382,503],[1389,529],[1396,556],[1407,582],[1421,586],[1432,594],[1441,603],[1447,615],[1450,625],[1438,619],[1424,615],[1406,613],[1387,613],[1368,605],[1351,599],[1338,600],[1321,607],[1297,615],[1275,622],[1251,629],[1242,635],[1250,609],[1259,575],[1268,535],[1275,487]], parts:[[[1377,489],[1390,494],[1404,500],[1411,510],[1418,515],[1430,521],[1441,520],[1449,525],[1454,534],[1464,540],[1451,537],[1441,531],[1430,529],[1420,529],[1408,520],[1396,514],[1388,512]],[[1389,531],[1403,542],[1418,544],[1430,543],[1439,548],[1445,558],[1453,563],[1463,563],[1463,570],[1452,567],[1443,565],[1444,574],[1451,581],[1454,590],[1464,595],[1464,606],[1454,601],[1447,593],[1441,583],[1435,575],[1429,568],[1418,566],[1406,565],[1395,560]]] },
      { name:'right-white', pin:[1484,444], reach:8.5, points:[[1489,447],[1519,475],[1554,501],[1591,528],[1610,541],[1628,548],[1645,557],[1655,570],[1663,592],[1673,617],[1683,635],[1689,654],[1693,676],[1704,694],[1715,696],[1733,693],[1745,699],[1753,711],[1759,725],[1773,737],[1773,743],[1756,733],[1745,719],[1733,713],[1718,716],[1706,714],[1691,709],[1680,701],[1660,691],[1638,687],[1605,684],[1575,681],[1544,673],[1514,677],[1486,687],[1464,698],[1472,668],[1480,629],[1485,583],[1488,531]], parts:[[[1643,557],[1667,573],[1677,581],[1685,593],[1700,598],[1715,598],[1728,603],[1736,615],[1745,622],[1756,623],[1765,627],[1773,640],[1773,646],[1765,633],[1756,628],[1749,628],[1751,641],[1761,648],[1773,652],[1773,660],[1758,657],[1746,651],[1736,645],[1732,632],[1726,623],[1710,620],[1694,620],[1680,617],[1669,606],[1655,586]]] },
      { name:'centre-white', pin:[958,523], reach:6.8, points:[[961,527],[981,542],[1003,552],[1024,567],[1044,572],[1057,578],[1065,589],[1067,608],[1075,629],[1086,649],[1098,660],[1109,673],[1105,676],[1092,674],[1080,675],[1064,673],[1049,663],[1034,658],[1017,661],[999,671],[980,678],[959,691],[963,653],[965,608],[964,565]], parts:[[[1064,584],[1074,587],[1080,600],[1089,603],[1100,604],[1110,610],[1120,613],[1134,612],[1134,616],[1119,615],[1108,613],[1097,611],[1087,610],[1077,606],[1069,601]],[[1070,619],[1082,625],[1095,632],[1108,635],[1120,635],[1133,633],[1143,637],[1151,650],[1162,662],[1172,666],[1172,671],[1159,666],[1147,657],[1136,650],[1128,649],[1116,652],[1103,653],[1091,648],[1080,638]]] },
      { name:'lower-black', pin:[840,570], reach:6.8, points:[[844,573],[859,591],[880,608],[898,620],[919,632],[934,646],[943,665],[951,676],[967,684],[978,693],[985,702],[979,706],[968,703],[958,696],[949,693],[958,711],[968,720],[975,734],[969,738],[958,729],[946,722],[930,716],[918,709],[902,708],[879,714],[858,719],[832,725],[817,731],[826,699],[832,660],[838,616]] },
      { name:'lower-white', pin:[659,664], reach:7, points:[[663,666],[680,688],[702,708],[718,727],[732,745],[743,763],[746,777],[757,786],[773,792],[786,806],[794,813],[809,817],[820,822],[822,830],[811,831],[799,826],[786,823],[773,817],[759,817],[750,807],[744,807],[728,800],[712,795],[700,795],[682,798],[663,806],[640,817],[630,822],[641,796],[649,761],[655,718]] },
      { name:'distant-black-one', pin:[964,252], reach:3.8, points:[[966,254],[981,262],[997,267],[1008,281],[1014,290],[1027,295],[1040,299],[1052,305],[1047,310],[1038,307],[1026,306],[1036,315],[1030,319],[1015,315],[1004,311],[991,315],[973,320],[968,322],[969,289]] },
      { name:'distant-black-two', pin:[1176,238], reach:3.6, points:[[1178,240],[1195,247],[1210,254],[1224,264],[1234,281],[1250,286],[1262,289],[1271,296],[1263,299],[1250,296],[1237,296],[1225,295],[1213,299],[1195,303],[1181,306],[1181,278]] },
      { name:'harbour-black', pin:[657,386], reach:3.8, points:[[658,388],[675,399],[690,404],[704,416],[711,428],[724,432],[738,438],[744,443],[737,446],[725,441],[715,440],[704,442],[690,444],[675,448],[661,453],[660,425]] },
      { name:'bottom-black', pin:[205,837], reach:5.5, points:[[209,840],[226,851],[244,859],[259,872],[269,884],[281,887],[211,887]] },
      { name:'bottom-white', pin:[308,810], reach:6, points:[[312,814],[330,832],[350,847],[364,866],[374,883],[391,887],[311,887]] }
    ];
    const boats = [
      { name:'left-junk', reach:23, rate:.62, phase:.4, points:[[225,408],[232,405],[234,392],[236,390],[241,391],[241,387],[243,389],[246,391],[247,406],[252,407],[252,397],[255,398],[256,407],[273,407],[270,412],[264,414],[240,414],[231,412]] },
      { name:'right-junk', reach:17, rate:.72, phase:2, points:[[464,430],[471,426],[473,416],[476,413],[479,415],[479,409],[481,411],[482,416],[486,417],[487,429],[495,430],[491,434],[474,436],[467,433]] },
      { name:'small-junk', reach:20, rate:.67, phase:3.4, points:[[398,404],[404,401],[405,390],[408,388],[410,390],[410,386],[412,388],[413,392],[416,392],[416,401],[424,402],[419,406],[406,407]] }
    ];
    const waterShapes = [
      [[165,346],[215,346],[255,341],[311,342],[360,345],[415,344],[457,349],[493,351],[483,356],[448,360],[409,357],[367,361],[315,360],[271,355],[222,356],[187,353]],
      [[0,391],[61,380],[111,372],[161,368],[212,369],[252,362],[309,365],[354,368],[393,365],[440,371],[477,376],[508,385],[545,389],[583,391],[621,395],[653,411],[633,426],[600,430],[562,426],[528,434],[501,439],[469,439],[440,436],[405,433],[375,433],[344,430],[310,431],[278,429],[246,429],[216,432],[190,432],[159,426],[121,426],[91,420],[60,423],[40,416],[10,414],[0,409]],
      [[0,506],[37,513],[68,512],[102,516],[134,520],[163,520],[178,525],[190,534],[216,534],[227,542],[247,538],[259,543],[273,544],[280,552],[293,553],[294,562],[271,571],[246,573],[226,581],[207,587],[182,588],[161,595],[132,597],[110,599],[84,609],[47,611],[31,619],[0,619]],
      [[0,635],[39,641],[64,635],[83,643],[112,645],[144,647],[178,644],[205,640],[230,641],[256,641],[285,643],[313,641],[341,645],[362,648],[378,656],[388,669],[398,681],[417,690],[437,702],[474,712],[482,725],[448,735],[418,735],[396,732],[377,721],[360,712],[343,706],[315,701],[293,689],[270,680],[241,680],[221,690],[213,706],[204,721],[184,727],[166,735],[149,736],[140,743],[125,747],[108,757],[96,764],[84,775],[64,780],[32,779],[0,785]],
      [[0,788],[32,786],[67,788],[99,781],[118,777],[145,775],[167,775],[195,775],[214,780],[239,783],[260,782],[278,777],[302,775],[329,778],[350,781],[373,787],[391,794],[401,806],[393,818],[374,818],[354,815],[334,815],[306,815],[288,821],[268,823],[246,830],[228,832],[207,829],[190,826],[173,829],[158,836],[135,842],[115,844],[89,851],[72,859],[50,865],[31,864],[18,858],[0,855]],
      [[0,859],[26,870],[43,871],[61,876],[75,880],[83,887],[0,887]],
      [[104,855],[124,852],[141,845],[154,844],[166,847],[188,841],[196,847],[195,866],[195,887],[169,887],[158,881],[142,883],[136,873],[118,872],[108,865]]
    ];
    const waterHoles = [
      [[50,642],[65,636],[78,641],[85,650],[74,656],[58,655]],
      [[315,744],[328,738],[345,741],[359,750],[374,753],[364,761],[341,765],[324,761],[310,757]],
      [[112,755],[131,738],[150,728],[169,727],[180,735],[185,748],[181,758],[164,767],[147,769],[133,766]],
      [[386,409],[395,405],[402,407],[413,408],[420,413],[411,416],[396,416]],
      [[327,426],[341,424],[353,425],[361,429],[348,432],[334,431]]
    ];
    const cloudShapes = [
      [[67,166],[76,125],[104,118],[118,94],[150,103],[171,93],[185,78],[214,80],[220,53],[250,36],[278,47],[292,63],[298,83],[313,94],[342,111],[365,117],[391,114],[406,130],[440,136],[459,152],[445,168],[409,170],[382,185],[360,205],[329,218],[297,217],[265,207],[239,190],[219,177],[201,172],[177,179],[162,168],[136,161],[117,164],[100,186],[82,196]],
      [[1288,100],[1310,104],[1331,119],[1341,145],[1361,158],[1396,174],[1421,194],[1431,218],[1415,231],[1388,229],[1369,219],[1345,214],[1320,223],[1297,223],[1267,222],[1248,207],[1240,196],[1258,180],[1276,166],[1281,143]],
      [[790,96],[805,91],[822,99],[834,107],[855,106],[876,110],[889,122],[907,128],[923,141],[907,145],[884,141],[865,138],[846,134],[827,136],[807,130],[788,124]]
    ];
    const plants = [
      {name:'left-tree',anchor:313,amount:3.6,mode:'tree',points:[[8,257],[25,249],[39,246],[48,251],[62,249],[71,258],[81,268],[71,276],[81,284],[65,291],[48,288],[38,302],[20,305],[4,293],[0,284]]},
      {name:'island-tree',anchor:714,amount:4.2,mode:'tree',points:[[217,674],[229,665],[242,658],[249,646],[263,648],[271,657],[285,660],[300,674],[292,687],[272,690],[251,686],[235,693],[218,690]]},
      {name:'centre-shrub',anchor:768,amount:4,mode:'tree',points:[[335,746],[348,735],[361,732],[370,739],[382,747],[392,757],[381,763],[361,765],[344,762]]},
      {name:'left-bank-tree',anchor:633,amount:3.6,mode:'tree',points:[[93,613],[108,600],[125,599],[135,601],[146,613],[144,625],[127,630],[112,627],[101,630]]},
      {name:'grass-centre',anchor:886,amount:6.2,mode:'grass',points:[[982,849],[1009,819],[1030,789],[1056,774],[1085,772],[1110,760],[1132,763],[1155,779],[1179,777],[1202,786],[1225,805],[1246,812],[1267,840],[1283,878],[1286,887],[974,887]]},
      {name:'grass-right',anchor:887,amount:7.2,mode:'grass',points:[[1172,856],[1194,827],[1206,796],[1230,755],[1251,737],[1284,721],[1310,710],[1346,705],[1374,700],[1398,685],[1420,685],[1440,707],[1452,737],[1477,758],[1501,767],[1514,796],[1539,804],[1565,827],[1577,858],[1595,887],[1165,887]]},
      {name:'grass-far-right',anchor:887,amount:7.4,mode:'grass',points:[[1537,880],[1540,841],[1549,796],[1572,751],[1592,728],[1617,711],[1641,700],[1662,710],[1680,736],[1702,741],[1720,729],[1742,723],[1773,746],[1773,887]]},
      {name:'grass-lower-middle',anchor:887,amount:5.5,mode:'grass',points:[[798,884],[810,855],[820,827],[839,804],[853,797],[874,797],[891,811],[911,832],[926,851],[945,873],[950,887]]}
    ];

    const inside = (x,y,poly) => {
      let yes=false;
      for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
        const a=poly[i],b=poly[j];
        if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
      }
      return yes;
    };
    const maskFor = points => {
      const surface=document.createElement('canvas');surface.width=width;surface.height=height;
      const ctx=surface.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();
      points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x*width/1774,y*height/887));ctx.closePath();ctx.fill();
      const rgba=ctx.getImageData(0,0,width,height).data,mask=new Uint8Array(width*height);
      for(let p=0;p<mask.length;p++) mask[p]=rgba[p*4+3];
      return mask;
    };
    const makeFields = original => {
      const water=new Uint8Array(width*height),cloud=new Uint8Array(width*height),active=[];
      for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
        const p=y*width+x,o=p*4,px=(x+.5)*1774/width,py=(y+.5)*887/height;
        const r=original[o],g=original[o+1],b=original[o+2];
        // Both membership and source sampling must stay in the same material.
        // Cool shoreline rocks are excluded by traced holes, not a colour guess.
        if(waterShapes.some(poly=>inside(px,py,poly)) && !waterHoles.some(poly=>inside(px,py,poly)) && g>r*1.005 && b>r*.86) water[p]=255;
        if(cloudShapes.some(poly=>inside(px,py,poly)) && r>g*.99 && g>b*1.03 && r>140) cloud[p]=255;
        if(water[p]||cloud[p])active.push(p);
      }
      return {water,cloud,active:Uint32Array.from(active)};
    };
    const makeObjects = original => {
      const specs=[...flags.map((v,i)=>({...v,type:'flag',phase:i*.73})),...boats.map(v=>({...v,type:'boat'})),...plants.map((v,i)=>({...v,type:'plant',phase:i*.81}))];
      const union=new Uint8Array(width*height);
      objects=specs.map(spec=>{
        const mask=maskFor(spec.points);
        for(const part of spec.parts||[]){const extra=maskFor(part);for(let p=0;p<mask.length;p++)mask[p]=max(mask[p],extra[p]);}
        for(const hole of spec.holes||[]){const cut=maskFor(hole);for(let p=0;p<mask.length;p++)mask[p]=round(mask[p]*(1-cut[p]/255));}
        const outline=mask.slice();
        let x0=width,y0=height,x1=0,y1=0;
        for(let p=0;p<mask.length;p++) {
          if(spec.type==='flag'&&mask[p]) {
            const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
            // Refine the traced silhouette against cloth colour: the cutout
            // must not carry teal mountain pixels through ribbon gaps.
            const black=spec.name.includes('black');
            const cloth=black ? r>=g*.86 && b<=g*1.10 : r>=g*.975 && g>=b*1.035;
            const x=p%width,y=floor(p/width);
            const interior=x>0&&x<width-1&&y>0&&y<height-1 &&
              outline[p-1]>240&&outline[p+1]>240&&outline[p-width]>240&&outline[p+width]>240;
            // The printed portrait/map and cool folds inside the cloth travel
            // with it; colour refinement applies only at the contour edge.
            if(!cloth&&!interior)mask[p]=0;
          }
          if(spec.type==='boat'&&mask[p]) {
            const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
            // Water between mast, sail and hull is transparent, too.
            if(r<g*.97 || g<b*1.035)mask[p]=0;
          }
          if(spec.type==='plant'&&mask[p]) {
            const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
            // Plant colours inside manually delimited crowns/blade clusters.
            // Teal rocks are explicitly rejected by the grass selector.
            const allowed=spec.mode==='grass' ? r>b*1.26 && g>b*1.12 && r>87 : g>r*1.05 && g>b*.94 && r<150;
            if(!allowed)mask[p]=0;
          }
          if(mask[p]){const x=p%width,y=floor(p/width);x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y);union[p]=max(union[p],mask[p]);}
        }
        const w=x1-x0+1,h=y1-y0+1;
        const sprite=document.createElement('canvas');sprite.width=w;sprite.height=h;
        const painter=sprite.getContext('2d'),pixels=painter.createImageData(w,h);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const p=(y0+y)*width+x0+x,o=p*4,d=(y*w+x)*4;
          pixels.data[d]=still[o];pixels.data[d+1]=still[o+1];pixels.data[d+2]=still[o+2];pixels.data[d+3]=mask[p];
        }
        painter.putImageData(pixels,0,0);
        return {...spec,mask,sprite,x0,y0,w,h};
      });
      // Recover only newly exposed sprite footprints. The surrounding painting
      // is immutable. A nearest-background field is prepared once, never warped.
      const nearest=new Int32Array(width*height);nearest.fill(-1);
      const queue=new Int32Array(width*height);let read=0,write=0;
      for(let p=0;p<union.length;p++) if(!union[p]){nearest[p]=p;queue[write++]=p;}
      while(read<write){
        const p=queue[read++],x=p%width,y=floor(p/width);
        for(const n of [x?p-1:-1,x<width-1?p+1:-1,y?p-width:-1,y<height-1?p+width:-1]) if(n>=0&&nearest[n]<0){nearest[n]=nearest[p];queue[write++]=n;}
      }
      for(let p=0;p<union.length;p++)if(union[p]){
        const a=union[p]/255,o=p*4,n=nearest[p]*4;
        for(let c=0;c<3;c++)base[o+c]=still[o+c]*(1-a)+still[n+c]*a;
      }
      // Keep a data-only inspection hook in offline tests; absent in the site.
      if(typeof window.__coverAudit==='function')window.__coverAudit({width,height,fields,objects,union,base:base.slice(),still:still.slice()});
    };
    const materialPixel = (data,p,mask,sx,sy) => {
      if(sx<0||sy<0||sx>=width-1||sy>=height-1)return;
      const ix=floor(sx),iy=floor(sy),q=iy*width+ix;
      if(!mask[q]||!mask[q+1]||!mask[q+width]||!mask[q+width+1])return;
      const fx=sx-ix,fy=sy-iy,o=p*4,a=q*4,b=a+4,c=a+width*4,d=c+4;
      for(let channel=0;channel<3;channel++)data[o+channel]=(base[a+channel]*(1-fx)+base[b+channel]*fx)*(1-fy)+(base[c+channel]*(1-fx)+base[d+channel]*fx)*fy;
    };
    const drawObjects = t => {
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='low';
      const gust=.93+.19*sin(t*1.19)+.11*sin(t*2.31);
      for(const object of objects){
        if(object.type==='flag'){
          const pin=object.pin[0]*width/1774-object.x0;
          // Attached edge remains anchored. The cloth is sliced from an alpha
          // silhouette; no source image/background can enter these wave strips.
          for(let x=0;x<object.w;x++){
            const free=clamp((x-pin)/max(1,object.w-pin)),weight=pow(free,.86);
            const wave=sin(t*6.1-free*5.8+object.phase),ripple=sin(t*10.9-free*9+object.phase);
            const dy=weight*object.reach*gust*(wave+.23*ripple);
            const dx=weight*1.1*sin(t*4.7-free*4+object.phase);
            context.drawImage(object.sprite,x,0,1,object.h,object.x0+x+dx,object.y0+dy,1.12,object.h);
          }
        }else if(object.type==='boat'){
          const phase=t*object.rate+object.phase,x=object.x0+object.reach*sin(phase),y=object.y0+1.4*sin(phase*2)+.48*sin(t*5.1+object.phase);
          context.drawImage(object.sprite,x,y);
        }else{
          const anchor=object.anchor*height/887-object.y0;
          for(let y=0;y<object.h;y++){
            const weight=pow(clamp((anchor-y)/max(1,anchor)),1.18);
            const dx=weight*object.amount*gust*(.72+.62*sin(t*3.4-y*.035+object.phase)+.17*sin(t*7.3+object.phase));
            context.drawImage(object.sprite,0,y,object.w,1,object.x0+dx,object.y0+y,object.w,1.12);
          }
        }
      }
      context.imageSmoothingEnabled=false;
    };
    const drawWalkers = seconds => {
      const walkers=[
        {from:[.611,.525],to:[.59,.579],duration:5.5,offset:0},
        {from:[.207,.795],to:[.249,.812],duration:7,offset:.52},
        {from:[.284,.826],to:[.303,.862],duration:6.5,offset:1.4},
        {from:[.453,.72],to:[.477,.74],duration:7.8,offset:2.2}
      ];
      for(const walker of walkers){
        const phase=seconds/walker.duration*Math.PI+walker.offset,progress=(1-cos(phase))/2,direction=sin(phase)<0?-1:1;
        const x=round((walker.from[0]+(walker.to[0]-walker.from[0])*progress)*width),y=round((walker.from[1]+(walker.to[1]-walker.from[1])*progress)*height),stride=floor(seconds*7.4+walker.offset)%2;
        context.fillStyle='#a5aaa0';context.fillRect(x,y-3,1,1);
        context.fillStyle='#343d3d';context.fillRect(x,y-2,1,2);
        context.fillStyle='#434c4a';context.fillRect(x-direction*stride,y,1,1);context.fillRect(x+direction*stride,y-1,1,1);
      }
    };
    const draw = () => {
      if(!ready)return;
      if(!base){context.filter='grayscale(20%) saturate(75%) brightness(82%)';context.drawImage(buffer,0,0);context.filter='none';return;}
      const data=frame.data;data.set(reducedMotion.matches?still:base);
      if(!reducedMotion.matches){
        const t=elapsed/1000;
        for(const p of fields.active){
          const x=p%width,y=floor(p/width);
          if(fields.water[p]){
            materialPixel(data,p,fields.water,x+3.5*sin(t*4.3+y*.49),y+.82*sin(t*3.1+x*.08));
            // Fast current is confined per pixel to water, including its glints.
            const glint=pow(max(0,sin(x*.24-y*.9-t*5.8)),18)*3.4;
            for(let c=0;c<3;c++)data[p*4+c]+=glint;
          }else if(fields.cloud[p])materialPixel(data,p,fields.cloud,x+18*sin(t*.71+y*.034),y+1.1*sin(t*.43+x*.015));
        }
      }
      context.putImageData(frame,0,0);
      if(!reducedMotion.matches){drawObjects(elapsed/1000);drawWalkers(elapsed/1000);}
    };
    const stop=()=>{if(timer)window.clearTimeout(timer);timer=0;lastTime=0;};
    const tick=()=>{
      timer=0;if(!visible()||reducedMotion.matches||!base){lastTime=0;return;}
      const now=performance.now();if(lastTime)elapsed+=min(200,now-lastTime);lastTime=now;
      draw();timer=window.setTimeout(tick,interval);
    };
    const sync=()=>{stop();if(!visible())return;draw();if(!reducedMotion.matches&&base){lastTime=performance.now();timer=window.setTimeout(tick,interval);}};
    image.addEventListener('load',()=>{
      const scale=min(640/image.naturalWidth,360/image.naturalHeight,1);
      width=canvas.width=max(1,round(image.naturalWidth*scale));height=canvas.height=max(1,round(image.naturalHeight*scale));
      buffer=document.createElement('canvas');buffer.width=width;buffer.height=height;
      const source=buffer.getContext('2d',{willReadFrequently:true});if(!source)return;
      source.imageSmoothingEnabled=true;source.imageSmoothingQuality='high';source.drawImage(image,0,0,width,height);
      try{
        frame=source.getImageData(0,0,width,height);const original=frame.data.slice();
        fields=makeFields(original);base=new Uint8ClampedArray(frame.data.length);const data=frame.data;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const o=(y*width+x)*4,light=.2126*data[o]+.7152*data[o+1]+.0722*data[o+2],grain=(bayer[(y&3)*4+(x&3)]-7.5)*.9;
          const nx=(x/width-.5)*2,ny=(y/height-.5)*2,vignette=1-.12*(nx*nx+ny*ny)/2,tone=round((pow(light/255,1.08)*218+grain)/8)*8;
          base[o]=(tone*.94+(data[o]-light)*.65)*vignette;base[o+1]=(tone*.98+(data[o+1]-light)*.65)*vignette;base[o+2]=(tone*1.025+(data[o+2]-light)*.65)*vignette;base[o+3]=255;
        }
        still=base.slice();makeObjects(original);
      }catch{base=null;}
      ready=true;draw();canvas.hidden=false;if(fallback)fallback.hidden=true;entry.dataset.coverReady='true';sync();
    },{once:true});
    image.addEventListener('error',()=>{stop();canvas.hidden=true;if(fallback)fallback.hidden=false;},{once:true});
    new MutationObserver(sync).observe(entry,{attributes:true,attributeFilter:['hidden','class','style']});
    if('IntersectionObserver'in window)new IntersectionObserver(([o])=>{inView=o.isIntersecting;sync();}).observe(entry);
    document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',sync);
    if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',sync);else reducedMotion.addListener(sync);
    image.src=fallback?.getAttribute('src')||'assets/media/cover.png';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
