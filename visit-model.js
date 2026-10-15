/* v19 generated geographic display: these counts, locations and event times are
 * a deterministic presentation model, not measured visits or IP locations.
 * Nothing here reads or writes the retained real analytics database.
 * City-coordinate attributions: assets/visit-city-sources.json.
 * Counts keep the v14 baseline and local storage; geographic history starts from
 * publication-age-weighted settlements. Fine events are bounded and older events
 * are accumulated into permanent metropolitan cells, keeping total mass exact.
 */
(()=>{
  'use strict';
  const KEY='ivan-visit-model-v14',EPOCH=Date.UTC(2026,9,15),BASE_TOTAL=386720;
  const GEO_EPOCH=Date.UTC(2026,9,15,5),LIMIT=Date.UTC(2100,0,1),DAY=86400000;
  const GENERATED_TAIL=1024,LOCAL_TAIL=256;
  // Named WGS84 city-core allowlist. Sampling stays within roughly 0.2–0.7 km
  // of settled city centers; no random globe coordinates or wilderness anchors.
  const ATLAS=[
    {id:"xuzhou",group:"hometown",weight:0.55,nodes:[[34.26627,117.181,0.005]]},
    {id:"yangtze-delta",group:"china",weight:14,nodes:[[31.234,121.474,0.006],[31.112,121.379,0.005],[31.382,121.265,0.004],[31.384,120.977,0.004],[31.307,120.619,0.005],[31.579,120.301,0.005],[31.779,119.973,0.004],[32.043,118.784,0.006],[32.203,119.445,0.004],[31.651,120.748,0.004],[30.765,120.75,0.004],[30.867,120.103,0.004],[30.273,120.165,0.005],[29.997,120.58,0.004],[29.873,121.55,0.004]]},
    {id:"pearl-delta",group:"china",weight:13,nodes:[[23.131,113.267,0.006],[23.026,113.122,0.005],[23.027,113.752,0.005],[22.547,114.058,0.005],[22.518,113.386,0.004],[22.272,113.57,0.003],[22.319,114.17,0.003],[22.381,114.188,0.003],[23.085,114.415,0.004]]},
    {id:"bay-area",group:"north-america",weight:13,nodes:[[37.76,-122.421,0.004],[37.654,-122.408,0.003],[37.566,-122.324,0.003],[37.486,-122.232,0.003],[37.443,-122.161,0.003],[37.389,-122.082,0.003],[37.376,-122.03,0.003],[37.336,-121.89,0.005],[37.551,-121.984,0.003],[37.673,-122.082,0.003],[37.804,-122.272,0.004],[37.871,-122.268,0.003]]},
    {id:"new-york",group:"north-america",weight:12,nodes:[[40.75,-73.989,0.003],[40.737,-74.17,0.004],[40.72,-74.046,0.003],[40.744,-73.824,0.004],[40.65,-73.951,0.004],[40.58,-74.153,0.003],[41.032,-73.765,0.003],[41.054,-73.54,0.003],[41.308,-72.927,0.003],[40.744,-73.618,0.003],[40.496,-74.445,0.003]]},
    {id:"russia",group:"russia",weight:1.1,nodes:[[55.761,37.613,0.005],[59.929,30.349,0.004],[55.788,49.123,0.004],[56.836,60.61,0.004],[55.03,82.92,0.004],[43.12,131.889,0.003]]},
    {id:"cuba",group:"latin-america",weight:0.55,nodes:[[23.136,-82.368,0.003],[20.022,-75.829,0.003],[22.407,-79.966,0.003],[21.382,-77.918,0.003]]},
    {id:"seattle",group:"north-america",weight:5,nodes:[[47.6097,-122.3331,0.004]]},
    {id:"los-angeles",group:"north-america",weight:5,nodes:[[34.0489,-118.2529,0.006]]},
    {id:"vancouver",group:"north-america",weight:4,nodes:[[49.282,-123.1171,0.004]]},
    {id:"portland",group:"north-america",weight:2,nodes:[[45.52,-122.68,0.004]]},
    {id:"san-diego",group:"north-america",weight:2,nodes:[[32.72,-117.16,0.004]]},
    {id:"boston",group:"north-america",weight:4,nodes:[[42.3551,-71.0601,0.003]]},
    {id:"chicago",group:"north-america",weight:3,nodes:[[41.8816,-87.6316,0.005]]},
    {id:"austin",group:"north-america",weight:3,nodes:[[30.27,-97.74,0.004]]},
    {id:"dallas",group:"north-america",weight:2,nodes:[[32.78,-96.8,0.004]]},
    {id:"denver",group:"north-america",weight:2,nodes:[[39.74,-104.99,0.004]]},
    {id:"montreal",group:"north-america",weight:5,nodes:[[45.5,-73.57,0.004]]},
    {id:"toronto",group:"north-america",weight:4,nodes:[[43.65,-79.38,0.004]]},
    {id:"ottawa",group:"north-america",weight:2,nodes:[[45.42,-75.7,0.004]]},
    {id:"washington",group:"north-america",weight:2,nodes:[[38.91,-77.04,0.004]]},
    {id:"pittsburgh",group:"north-america",weight:2,nodes:[[40.4407,-79.9959,0.003]]},
    {id:"atlanta",group:"north-america",weight:2,nodes:[[33.75,-84.39,0.004]]},
    {id:"london",group:"europe",weight:6,nodes:[[51.5142,-0.1339,0.005]]},
    {id:"paris",group:"europe",weight:5,nodes:[[48.8668,2.3352,0.005]]},
    {id:"berlin",group:"europe",weight:5,nodes:[[52.5212,13.4107,0.005]]},
    {id:"stockholm",group:"europe",weight:4,nodes:[[59.3325,18.0649,0.003]]},
    {id:"helsinki",group:"europe",weight:4,nodes:[[60.169,24.938,0.003]]},
    {id:"copenhagen",group:"europe",weight:3,nodes:[[55.6768,12.567,0.003]]},
    {id:"oslo",group:"europe",weight:2,nodes:[[59.9145,10.7461,0.003]]},
    {id:"amsterdam",group:"europe",weight:4,nodes:[[52.3733,4.8926,0.003]]},
    {id:"brussels",group:"europe",weight:2,nodes:[[50.85,4.35,0.004]]},
    {id:"dublin",group:"europe",weight:2,nodes:[[53.3495,-6.2607,0.003]]},
    {id:"hamburg",group:"europe",weight:3,nodes:[[53.5533,9.9898,0.003]]},
    {id:"munich",group:"europe",weight:3,nodes:[[48.14,11.58,0.004]]},
    {id:"frankfurt",group:"europe",weight:2,nodes:[[50.1157,8.6814,0.003]]},
    {id:"dresden",group:"europe",weight:2,nodes:[[51.0509,13.7375,0.003]]},
    {id:"prague",group:"europe",weight:3,nodes:[[50.08,14.44,0.004]]},
    {id:"warsaw",group:"europe",weight:4,nodes:[[52.23,21.01,0.004]]},
    {id:"krakow",group:"europe",weight:3,nodes:[[50.06,19.94,0.004]]},
    {id:"vienna",group:"europe",weight:2,nodes:[[48.21,16.37,0.004]]},
    {id:"zurich",group:"europe",weight:2,nodes:[[47.378,8.5392,0.003]]},
    {id:"budapest",group:"europe",weight:2,nodes:[[47.5001,19.062,0.004]]},
    {id:"barcelona",group:"europe",weight:3,nodes:[[41.39,2.17,0.004]]},
    {id:"madrid",group:"europe",weight:3,nodes:[[40.42,-3.7,0.004]]},
    {id:"milan",group:"europe",weight:2,nodes:[[45.46,9.19,0.004]]},
    {id:"rome",group:"europe",weight:2,nodes:[[41.9,12.5,0.004]]},
    {id:"edinburgh",group:"europe",weight:2,nodes:[[55.95,-3.19,0.004]]},
    {id:"cambridge",group:"europe",weight:2,nodes:[[52.2,0.12,0.004]]},
    {id:"tallinn",group:"europe",weight:2,nodes:[[59.44,24.75,0.004]]},
    {id:"vilnius",group:"europe",weight:2,nodes:[[54.69,25.28,0.004]]},
    {id:"bucharest",group:"europe",weight:2,nodes:[[44.43,26.1,0.004]]},
    {id:"athens",group:"europe",weight:2,nodes:[[37.98,23.73,0.004]]},
    {id:"tokyo",group:"east-asia",weight:9,nodes:[[35.6915,139.7035,0.005]]},
    {id:"osaka",group:"east-asia",weight:5,nodes:[[34.7025,135.4978,0.004]]},
    {id:"kyoto",group:"east-asia",weight:4,nodes:[[35.0046,135.7598,0.004]]},
    {id:"nagoya",group:"east-asia",weight:3,nodes:[[35.1709,136.8816,0.004]]},
    {id:"fukuoka",group:"east-asia",weight:3,nodes:[[33.59,130.4,0.004]]},
    {id:"sendai",group:"east-asia",weight:2,nodes:[[38.2606,140.8795,0.004]]},
    {id:"sapporo",group:"east-asia",weight:2,nodes:[[43.06,141.35,0.004]]},
    {id:"seoul",group:"east-asia",weight:7,nodes:[[37.5665,126.978,0.003]]},
    {id:"busan",group:"east-asia",weight:3,nodes:[[35.1579,129.0595,0.003]]},
    {id:"daejeon",group:"east-asia",weight:2,nodes:[[36.3493,127.3844,0.004]]},
    {id:"hong-kong",group:"east-asia",weight:7,nodes:[[22.319,114.17,0.003]]},
    {id:"singapore",group:"southeast-asia",weight:8,nodes:[[1.2858,103.8451,0.003]]},
    {id:"shenzhen",group:"china",weight:8,nodes:[[22.547,114.058,0.005]]},
    {id:"hsinchu",group:"east-asia",weight:3,nodes:[[24.80361,120.96861,0.004]]},
    {id:"beijing",group:"china",weight:6,nodes:[[39.9138,116.4148,0.006]]},
    {id:"chengdu",group:"china",weight:4,nodes:[[30.657,104.0674,0.006]]},
    {id:"wuhan",group:"china",weight:3,nodes:[[30.5825,114.2706,0.004]]},
    {id:"xian",group:"china",weight:2,nodes:[[34.2615,108.947,0.005]]},
    {id:"chongqing",group:"china",weight:2,nodes:[[29.5583,106.5771,0.003]]},
    {id:"taipei",group:"east-asia",weight:4,nodes:[[25.0331,121.5526,0.004]]},
    {id:"xiamen",group:"china",weight:2,nodes:[[24.4794,118.084,0.003]]},
    {id:"bengaluru",group:"south-asia",weight:3,nodes:[[12.9718,77.6093,0.005]]},
    {id:"mumbai",group:"south-asia",weight:2,nodes:[[19.0804,72.8496,0.004]]},
    {id:"delhi",group:"south-asia",weight:2,nodes:[[28.6304,77.2177,0.005]]},
    {id:"bangkok",group:"southeast-asia",weight:2,nodes:[[13.7464,100.535,0.004]]},
    {id:"kuala-lumpur",group:"southeast-asia",weight:2,nodes:[[3.1488,101.7133,0.004]]},
    {id:"hanoi",group:"southeast-asia",weight:2,nodes:[[21.0288,105.8488,0.003]]},
    {id:"ho-chi-minh",group:"southeast-asia",weight:2,nodes:[[10.7761,106.7009,0.004]]},
    {id:"manila",group:"southeast-asia",weight:2,nodes:[[14.5579,121.021,0.004]]},
    {id:"jakarta",group:"southeast-asia",weight:2,nodes:[[-6.1944,106.8232,0.005]]},
    {id:"sydney",group:"oceania",weight:3,nodes:[[-33.873,151.2071,0.003]]},
    {id:"melbourne",group:"oceania",weight:3,nodes:[[-37.814,144.9633,0.005]]},
    {id:"brisbane",group:"oceania",weight:2,nodes:[[-27.468,153.0251,0.003]]},
    {id:"wellington",group:"oceania",weight:2,nodes:[[-41.2902,174.7759,0.0025]]},
    {id:"auckland",group:"oceania",weight:2,nodes:[[-36.8518,174.7638,0.003]]},
    {id:"mexico-city",group:"latin-america",weight:2,nodes:[[19.4271,-99.1621,0.006]]},
    {id:"sao-paulo",group:"latin-america",weight:3,nodes:[[-23.5505,-46.6333,0.006]]},
    {id:"buenos-aires",group:"latin-america",weight:2,nodes:[[-34.6037,-58.3816,0.006]]},
    {id:"santiago",group:"latin-america",weight:2,nodes:[[-33.4372,-70.6506,0.005]]},
    {id:"bogota",group:"latin-america",weight:2,nodes:[[4.6513,-74.0594,0.005]]},
    {id:"cape-town",group:"africa",weight:2,nodes:[[-33.92584,18.42322,0.004]]},
    {id:"johannesburg",group:"africa",weight:2,nodes:[[-26.20227,28.04363,0.006]]},
    {id:"nairobi",group:"africa",weight:1,nodes:[[-1.2846,36.8235,0.005]]},
    {id:"cairo",group:"africa",weight:1,nodes:[[30.0506,31.2394,0.004]]},
    {id:"durban",group:"africa",weight:1.5,nodes:[[-29.8579,31.0292,0.003]]},
    {id:"riyadh",group:"middle-east",weight:2.5,nodes:[[24.68773,46.72185,0.006]]},
    {id:"jeddah",group:"middle-east",weight:2,nodes:[[21.49012,39.18624,0.004]]},
    {id:"dammam",group:"middle-east",weight:1.5,nodes:[[26.43442,50.10326,0.004]]},
    {id:"dubai",group:"middle-east",weight:2.5,nodes:[[25.258,55.3031,0.003]]},
    {id:"abu-dhabi",group:"middle-east",weight:1.5,nodes:[[24.4871,54.3618,0.003]]},
    {id:"doha",group:"middle-east",weight:1.5,nodes:[[25.2867,51.5326,0.003]]}
  ];
  // Every page keeps the requested cities; other city profiles remain distinct.
  // This allowlist is an editorial display model, not inferred visitor origins.
  const REQUIRED=['xuzhou','beijing','paris','berlin','munich','london','bay-area','new-york','seattle','los-angeles','boston','chicago','vancouver','toronto','montreal','ottawa','delhi','bengaluru','singapore','seoul','tokyo','osaka','kyoto','taipei','hsinchu','hong-kong','shenzhen'];
  const PRIORITY=new Set([...REQUIRED,'yangtze-delta','pearl-delta','portland','san-diego','austin','dallas','denver','washington','pittsburgh','atlanta','amsterdam','brussels','dublin','hamburg','frankfurt','dresden','vienna','zurich','barcelona','madrid','milan','rome','edinburgh','cambridge','nagoya','fukuoka','sendai','sapporo','busan','daejeon']);
  const eventGroup=region=>region.group==='hometown'?'china':region.group;
  const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  const random=seed=>{let x=seed>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return (x>>>0)/4294967296;};
  const integer=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000?value:0;
  const timestamp=value=>Number.isFinite(value)&&value>=0&&value<=LIMIT?value:0;
  const pageWeight=route=>({entry:23,about:15,together:11,creation:12,research:12,blog:9,search:4,'about/cv':7,'together/critical-theory':26,'research/machine-and-assemblage':8,'creation/panopticon':6,'creation/critique-of-pure-jargon':7}[route]||3+hash(route)%4);
  function nearNode(node,seed){
    const radius=node[2]*Math.sqrt(random(seed^0x42b8e9))*0.92,angle=random(seed^0x926e7b)*Math.PI*2;
    return {lat:+(node[0]+Math.sin(angle)*radius).toFixed(7),lon:+(node[1]+Math.cos(angle)*radius/Math.max(.35,Math.cos(node[0]*Math.PI/180))).toFixed(7)};
  }
  ATLAS.forEach(region=>{
    const perNode=region.nodes.length>1?5:12;
    region.cells=region.nodes.flatMap((node,n)=>Array.from({length:perNode},(_,i)=>Object.freeze({
      id:'a:'+region.id+':'+n+':'+i,...nearNode(node,hash(region.id+':'+n+':'+i)),region:region.id,weight:region.weight*(i===0?1.8:1)/(region.nodes.length*perNode)
    })));
  });
  const byId=new Map(ATLAS.map(region=>[region.id,region]));
  
  function create(options={}){
    const manifest=options.manifest||{},pages=manifest.pages||{},routes=Object.keys(pages).sort();
    const now=typeof options.now==='function'?options.now:Date.now;
    let storage=options.storage;
    if(storage===undefined){try{storage=window.localStorage;}catch(_){storage=null;}}
    const weights=routes.map(pageWeight),weightTotal=weights.reduce((a,b)=>a+b,0)||1;
    const bases={},periods={},phases={},shapes=new Map(),geometry=new Map();
    let allocated=0;
    routes.forEach((route,i)=>{const end=Math.round(BASE_TOTAL*weights.slice(0,i+1).reduce((a,b)=>a+b,0)/weightTotal);bases[route]=end-allocated;allocated=end;periods[route]=Math.round(23000*weightTotal/weights[i]);phases[route]=hash(route+'phase')%periods[route];});
    const state={version:1,cursor:0,increments:{},last:{},lights:{}};
    let saved='',cache=new Map(),loadedCursor=0,globalGeometry=null;
    const valid=route=>Object.prototype.hasOwnProperty.call(pages,route);
    function load(){
      if(!storage)return;
      try{
        const text=storage.getItem(KEY);if(!text||text===saved)return;
        const parsed=JSON.parse(text);if(!parsed||parsed.version!==1)return;
        state.cursor=Math.max(state.cursor,timestamp(parsed.cursor));loadedCursor=Math.max(loadedCursor,timestamp(parsed.cursor));
        routes.forEach(route=>{
          state.increments[route]=Math.max(state.increments[route]||0,integer(parsed.increments?.[route]));
          state.last[route]=Math.max(state.last[route]||0,timestamp(parsed.last?.[route]));
          const merged=new Map((state.lights[route]||[]).map(event=>[event.n,event]));
          if(Array.isArray(parsed.lights?.[route]))for(const event of parsed.lights[route]){
            const n=integer(event?.n),at=timestamp(event?.at);if(n&&at&&n<=state.increments[route])merged.set(n,{n,at});
          }
          state.lights[route]=[...merged.values()].sort((a,b)=>a.n-b.n).slice(-LOCAL_TAIL);
        });saved=text;
      }catch(_){}
    }
    function save(){if(storage)try{const text=JSON.stringify(state);if(text!==saved){storage.setItem(KEY,text);saved=text;loadedCursor=state.cursor;}}catch(_){}}
    function clock(){const value=Number(now());return Number.isFinite(value)?Math.max(0,Math.min(LIMIT,value)):Date.now();}
    function growth(route,time){return Math.max(0,Math.floor((Math.max(0,time-EPOCH)+phases[route])/periods[route]));}
    function sumGrowth(time){return routes.reduce((sum,route)=>sum+growth(route,time),0);}
    function sample(){load();const wall=clock();state.cursor=Math.max(state.cursor,wall);if(sumGrowth(state.cursor)>sumGrowth(loadedCursor))save();return wall;}
    function count(route){return (bases[route]||0)+growth(route,state.cursor)+(state.increments[route]||0);}
    function recent(route,wall){
      const meta=route==='__site__'?(manifest.site||{}):pages[route];
      const lower=Math.max(Date.parse(meta?.publishedAt)||0,Date.parse(meta?.updatedAt)||0);
      const candidate=target=>{const n=growth(target,state.cursor),scheduled=n>0?EPOCH+n*periods[target]-phases[target]:EPOCH-60000-hash(target)%7200000;return Math.max(scheduled,state.last[target]||0);};
      let value=route==='__site__'?routes.reduce((latest,target)=>Math.max(latest,candidate(target)),0):candidate(route);
      const ceiling=Math.max(0,Math.floor(wall/1000)*1000-1000);value=Math.min(ceiling,Math.max(lower+1000,value));
      return new Date(Math.floor(value/1000)*1000).toISOString();
    }
    function shape(route){
      if(shapes.has(route))return shapes.get(route);
      const age=Math.max(0,(GEO_EPOCH-(Date.parse(pages[route]?.publishedAt)||GEO_EPOCH))/DAY);
      const maturity=1-Math.exp(-age/1.15),seed=hash(route);
      const affinity=region=>region.id==='xuzhou'?1:.12+4.2*Math.pow(random(hash(route+':affinity:'+region.id)),2.2);
      const optional=ATLAS.filter(region=>!PRIORITY.has(region.id));
      const optionalGroups=[...new Set(optional.map(eventGroup))].sort();
      const groups=new Set(optionalGroups.filter(group=>route==='entry'||random(hash(route+':optional-group:'+group))<.40));
      // A few optional groups stay eligible per page; they are not guaranteed
      // baseline lights. A rare arrival can therefore introduce a new region.
      for(const group of optionalGroups.slice().sort((a,b)=>random(hash(route+':optional-order:'+a))-random(hash(route+':optional-order:'+b)))){if(groups.size>=3)break;groups.add(group);}
      const pool=ATLAS.filter(region=>PRIORITY.has(region.id)||groups.has(eventGroup(region)));
      const ranked=pool.map(region=>({region,score:region.weight*affinity(region)})).sort((a,b)=>b.score-a.score||a.region.id.localeCompare(b.region.id)).map(item=>item.region);
      const additional=ranked.filter(region=>!REQUIRED.includes(region.id)).slice(0,Math.round(2+35*maturity+(seed%3)));
      const selected=[...REQUIRED.map(id=>byId.get(id)),...additional],width=selected.length;
      const target=Math.min(bases[route],Math.round(78+300*maturity+Math.sqrt(pageWeight(route))*5));
      // Baseline cells belong to a route, including their positions. Summing the
      // site no longer collapses tens of thousands of visits onto a few shared
      // cell IDs. All offsets are still contained in the same allowlisted cores.
      const weightedRegions=new Map();
      const weighted=region=>{if(weightedRegions.has(region.id))return weightedRegions.get(region.id);
        const cells=region.cells.map((cell,i)=>{
        const node=region.nodes[Math.floor(i/(region.nodes.length>1?5:12))];
        const point={...cell,id:cell.id+':'+route,...nearNode(node,hash(route+':field:'+cell.id)),group:region.group,weight:cell.weight*affinity(region)};
        return point;
        });weightedRegions.set(region.id,cells);return cells;
      };
      const candidates=selected.flatMap(weighted),chosen=[];
      for(const region of selected){
        const cells=weighted(region),required=REQUIRED.includes(region.id);
        const minimum=region.id==='xuzhou'?3+seed%3:region.id==='beijing'?4:required?2:1;
        const start=hash(route+':first:'+region.id)%cells.length;
        for(let n=0;n<minimum;n++)chosen.push(cells[(start+n*2)%cells.length]);
      }
      const used=new Set(chosen.map(cell=>cell.id));
      const remainder=candidates.filter(cell=>!used.has(cell.id)).map(cell=>({cell,score:-Math.log(Math.max(1e-9,random(hash(route+':'+cell.id))))/cell.weight})).sort((a,b)=>a.score-b.score||a.cell.id.localeCompare(b.cell.id));
      for(const item of remainder){if(chosen.length>=target)break;chosen.push(item.cell);}
      const makePools=priority=>{
        const regions=ranked.filter(region=>PRIORITY.has(region.id)===priority),eventGroups=[...new Set(regions.map(eventGroup))].sort();
        const groupPools=new Map(eventGroups.map(group=>{
          let sum=0;const candidates=regions.filter(region=>eventGroup(region)===group);
          const weights=candidates.map(region=>(sum+=region.weight*affinity(region)));
          return [group,{regions:candidates,weights,total:sum}];
        }));return {eventGroups,groupPools};
      };
      const priority=makePools(true),occasional=makePools(false);
      // Long histories preserve the same 90/10 priority mix as fine arrivals.
      // Each broad region shares its tier equally; cities retain page affinity.
      const compactCells=[...[[priority,.9],[occasional,.1]]].flatMap(([tier,share])=>tier.eventGroups.flatMap(group=>{
        const groupPool=tier.groupPools.get(group);
        return groupPool.regions.flatMap(region=>weighted(region).filter((_,i)=>i%(region.nodes.length>1?5:12)===0).map(cell=>({...cell,weight:share/tier.eventGroups.length*region.weight*affinity(region)/groupPool.total/region.nodes.length})));
      }));
      const result={seed,width,ranked,priority,occasional,cycles:new Map(),cells:chosen,compactCells,bornAt:Math.min(GEO_EPOCH-120000,Date.parse(pages[route]?.publishedAt)||GEO_EPOCH-120000)};
      shapes.set(route,result);return result;
    }
    function add(target,point,amount,bornAt,eventKind){
      if(!amount)return;const old=target.get(point.id);
      if(old){old.count+=amount;old.bornAt=Math.max(old.bornAt,bornAt||0);}
      else target.set(point.id,{id:point.id,lat:point.lat,lon:point.lon,region:point.region,group:point.group||byId.get(point.region)?.group,count:amount,bornAt:bornAt||0,...(point.cellId?{cellId:point.cellId}:{}),...(eventKind?{eventKind}:{})});
    }
    function allocate(target,cells,total,bornAt){
      if(!total||!cells.length)return;
      const sum=cells.reduce((value,cell)=>value+cell.weight,0);let mass=0,used=0;
      cells.forEach(cell=>{mass+=cell.weight;const end=Math.round(total*mass/sum);add(target,cell,end-used,bornAt);used=end;});
    }
    function groupOrder(route,kind,tierName,ordinal){
      const current=shape(route),tier=current[tierName],groups=tier.eventGroups;
      const cycle=Math.floor(ordinal/groups.length),slot=ordinal%groups.length,key=kind+':'+tierName+':'+cycle;
      let order=current.cycles.get(key);
      if(!order){
        const shuffled=n=>groups.slice().sort((a,b)=>random(hash(route+':'+kind+':'+tierName+':bag:'+n+':'+a))-random(hash(route+':'+kind+':'+tierName+':bag:'+n+':'+b))||a.localeCompare(b));
        order=groups.length===2?shuffled(0):shuffled(cycle);
        if(groups.length>2&&cycle>0&&order[0]===shuffled(cycle-1).at(-1))[order[0],order[1]]=[order[1],order[0]];
        current.cycles.set(key,order);if(current.cycles.size>768)current.cycles.delete(current.cycles.keys().next().value);
      }
      return {order,slot,group:order[slot]};
    }
    function eventPoint(route,index,kind){
      const current=shape(route),seed=hash(route+':'+kind+':'+index),block=Math.floor((index-1)/10),slot=(index-1)%10;
      // Exactly nine priority arrivals and one occasional arrival per ten,
      // with a route-specific phase. Coordinates and choices remain stable.
      const rareSlot=hash(route+':'+kind+':occasional-slot')%10,isRare=slot===rareSlot;
      const ordinal=isRare?block:block*9+slot-(slot>rareSlot?1:0),tierName=isRare?'occasional':'priority',tier=current[tierName];
      const picked=groupOrder(route,kind,tierName,ordinal);let group=picked.group;
      if(isRare){
        const next=block*9+slot,avoid=new Set([groupOrder(route,kind,'priority',next).group]);
        if(next>0)avoid.add(groupOrder(route,kind,'priority',next-1).group);
        for(let offset=0;offset<picked.order.length;offset++){const candidate=picked.order[(picked.slot+offset)%picked.order.length];if(!avoid.has(candidate)){group=candidate;break;}}
      }
      const pool=tier.groupPools.get(group),choice=random(seed^0x5b7ce)*pool.total;
      let low=0,high=pool.regions.length-1;while(low<high){const middle=(low+high)>>1;if(choice>pool.weights[middle])low=middle+1;else high=middle;}
      const region=pool.regions[low],nodeIndex=Math.floor(random(seed^0x36ad)*region.nodes.length),node=region.nodes[nodeIndex];
      const cell=region.cells[nodeIndex*(region.nodes.length>1?5:12)];
      return {id:(kind==='local'?'l:':'g:')+route+':'+index,...nearNode(node,seed),region:region.id,group:region.group,cellId:cell.id+':'+route};
    }
    function baseline(target,current,total){
      // One unit per chosen cell guarantees all required cities remain visible.
      // Beijing also has an explicit count floor; floors conserve the same total.
      let reserved=0;
      for(const cell of current.cells){add(target,cell,1,current.bornAt);reserved++;}
      for(const id of REQUIRED){
        const cells=current.cells.filter(cell=>cell.region===id),floor=Math.floor(total*(id==='beijing'?.018:id==='xuzhou'?.004:.0025));
        const extra=Math.max(0,floor-cells.length);allocate(target,cells,extra,current.bornAt);reserved+=extra;
      }
      allocate(target,current.cells,Math.max(0,total-reserved),current.bornAt);
    }
    function pageBins(route){
      const total=count(route),previous=geometry.get(route);if(previous?.total===total)return previous.bins;
      const current=shape(route),bins=new Map(),generated=growth(route,state.cursor),local=state.increments[route]||0;
      baseline(bins,current,bases[route]);
      // Retain fine positions for recent visits; older visits collect in fixed
      // inhabited cells, making dense urban bands brighter without an unbounded
      // array or a dependency on a remote service.
      const compacted=Math.max(0,generated-GENERATED_TAIL)+Math.max(0,local-LOCAL_TAIL);
      if(compacted){
        allocate(bins,current.compactCells,compacted,GEO_EPOCH-120000);
      }
      for(let n=Math.max(1,generated-GENERATED_TAIL+1);n<=generated;n++){
        const at=EPOCH+n*periods[route]-phases[route];
        add(bins,eventPoint(route,n,'generated'),1,at,'generated');
      }
      const times=new Map((state.lights[route]||[]).map(event=>[event.n,event.at]));
      for(let n=Math.max(1,local-LOCAL_TAIL+1);n<=local;n++){
        const at=times.get(n)||(n===local?state.last[route]:0)||GEO_EPOCH-120000;
        add(bins,eventPoint(route,n,'local'),1,at,'local');
      }
      const result=Object.freeze([...bins.values()].map(Object.freeze));geometry.set(route,{total,bins:result});return result;
    }
    function siteBins(total){
      if(globalGeometry?.total===total)return globalGeometry.bins;
      // The world is the exact union of the same page snapshots used by globes.
      // Only pageBins owns historical compaction. No second world-only tail,
      // position resampling, independent lights, or extra visits are introduced.
      // Reuse frozen page points so global synthesis does not duplicate objects.
      const combined=new Map();
      for(const route of routes)for(const point of pageBins(route)){
        const previous=combined.get(point.id);
        combined.set(point.id,previous?Object.freeze({...previous,
          count:previous.count+point.count,bornAt:Math.max(previous.bornAt,point.bornAt)
        }):point);
      }
      const bins=Object.freeze([...combined.values()]);globalGeometry={total,bins};return bins;
    }
    function snapshot(route,wall){
      if(route!=='__site__'&&!valid(route))return null;
      const total=route==='__site__'?routes.reduce((sum,target)=>sum+count(target),0):count(route);
      const lastVisitedAt=recent(route,wall),previous=cache.get(route);
      if(previous&&previous.pageViews===total&&previous.lastVisitedAt===lastVisitedAt)return previous;
      const result=Object.freeze({route,pageViews:total,lastVisitedAt,bins:previous?.pageViews===total?previous.bins:(route==='__site__'?siteBins(total):pageBins(route)),source:'time-model'});
      cache.set(route,result);return result;
    }
    function read(route){return snapshot(route,sample());}
    function readAll(){
      // Count every manifest route once, including cover and search. Detail
      // screens are read-only views of their source and are never extra routes.
      // A single wall/cursor sample prevents a clock tick between the popular
      // card, individual globes, and world total from producing mismatched UI.
      const wall=sample(),result={};
      for(const route of routes)result[route]=snapshot(route,wall);
      result.__site__=snapshot('__site__',wall);
      return Object.freeze(result);
    }
    function visit(route){
      const wall=sample();if(!valid(route))return snapshot(route,wall);
      const n=(state.increments[route]||0)+1,at=Math.max(0,Math.floor(wall/1000)*1000-1000);
      state.increments[route]=n;state.last[route]=Math.max(state.last[route]||0,at);
      state.lights[route]=[...(state.lights[route]||[]),{n,at}].slice(-LOCAL_TAIL);
      save();return snapshot(route,wall);
    }
    return Object.freeze({read,readAll,visit,aggregateRoutes:Object.freeze([...routes])});
  }
  window.SiteVisitModel=Object.freeze({create,storageKey:KEY,provenance:'generated-time-display',baseline:BASE_TOTAL,epoch:new Date(EPOCH).toISOString(),geographyVersion:19,cityCores:Object.freeze(ATLAS.map(region=>Object.freeze({id:region.id,group:region.group,nodes:Object.freeze(region.nodes.map(node=>Object.freeze([...node])))})))});
})();
