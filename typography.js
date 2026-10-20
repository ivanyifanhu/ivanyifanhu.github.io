/* Semantic Western work titles shared by prose, live search, outline and visit UI. */
(() => {
  'use strict';
  const titles=JSON.parse(document.querySelector('#work-typography').textContent);
  const quotes=text=>String(text).replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'").replaceAll('"Common Places and "General Intellect""', '"Common Places and \'General Intellect\'"');
  const latin=/[A-Za-zÀ-ÖØ-öø-ÿ]/,cjk=/[\u3040-\u30ff\u3400-\u9fff]/;
  function foreignQuotes(value,lang){
    const text=String(value).replace(/([\u3400-\u9fff])[–—](?=[\u3400-\u9fff])/g,'$1-').replace(/([A-Za-zÀ-ÖØ-öø-ÿ])–(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g,'$1-');
    if(lang==='en')return quotes(text);
    const stack=[],pairs=[];
    // String offsets and search highlights use UTF-16 code units.
    const output=text.split('');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(/[‘’]/.test(c)&&latin.test(text[i-1]||'')&&latin.test(text[i+1]||'')){output[i]="'";continue;}
      if(c==='“'||c==='‘')stack.push([i,c==='“'?'double':'single']);
      else if(c==='"'){
        if(stack.at(-1)?.[1]==='ascii'){const [start,family]=stack.pop();pairs.push([start,i,family]);}
        else stack.push([i,'ascii']);
      }else if(c==='”'||c==='’'){
        const family=c==='”'?'double':'single';
        if(stack.at(-1)?.[1]===family){const [start]=stack.pop();pairs.push([start,i,family]);}
      }
    }
    for(const [start,end,family]of pairs){
      const body=text.slice(start+1,end);
      if(latin.test(body)&&!cjk.test(body))output[start]=output[end]=family==='single'?"'":'"';
      else if(lang==='zh'){
        const depth=pairs.filter(([a,b])=>a<start&&end<b&&cjk.test(text.slice(a+1,b))).length;
        [output[start],output[end]]=depth%2?['‘','’']:['“','”'];
      }else if(lang==='ja'&&family!=='ascii'&&cjk.test(body))[output[start],output[end]]=['「','」'];
    }
    return output.join('');
  }
  const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const suffixes={'The Field of Cultural Production':'(?!, or:)','October':'(?=\\s+\\d{1,3}\\s*\\()','Mind':'(?=\\s+\\d+\\s*,)','Transfer':'(?=\\s+\\d+\\s*,)','Signs':'(?=\\s+\\d+\\s*,)'};
  const pattern=new RegExp('(?:'+[...titles].sort((a,b)=>b.length-a.length).map(t=>escape(quotes(t))+(suffixes[t]||'')).join('|')+')','g');
  const contributions=new Set(['What Is Literature?','Rivers of the North','Cruel Optimism','Necropolitics']);
  function fragment(value,lang,highlights=[]){
    const text=foreignQuotes(value,lang),result=document.createDocumentFragment();
    const boundary=/[A-Za-z0-9_À-ÖØ-öø-ÿ]/;
    const works=[...text.matchAll(pattern)].filter(m=>!boundary.test(text[m.index-1]||'')&&!boundary.test(text[m.index+m[0].length]||'')&&!(contributions.has(m[0])&&/["'“‘]/.test(text[m.index-1]||'')&&/^[,.]?["'”’]/.test(text.slice(m.index+m[0].length)))).map(m=>({start:m.index,end:m.index+m[0].length}));
    const sourceTerms=/Thing-Power|construct(?:ing)? the ballast|cogito|conatus/g;
    for(const m of text.matchAll(sourceTerms))if(!boundary.test(text[m.index-1]||'')&&!boundary.test(text[m.index+m[0].length]||''))works.push({start:m.index,end:m.index+m[0].length,source:true});
    for(const m of text.matchAll(/we are our bodies/g))works.push({start:m.index+3,end:m.index+6,source:true});
    const edges=[...new Set([0,text.length,...works.flatMap(x=>[x.start,x.end]),...highlights.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
    for(let i=0;i<edges.length-1;i++){
      const start=edges[i],end=edges[i+1];let node=document.createTextNode(text.slice(start,end));
      if(works.some(x=>x.start<=start&&x.end>=end)){const em=document.createElement('em');em.className=works.some(x=>x.source&&x.start<=start&&x.end>=end)?'source-emphasis':'work-title';em.append(node);node=em;}
      if(highlights.some(x=>x.start<=start&&x.end>=end)){const mark=document.createElement('mark');mark.className='search-keyword';mark.append(node);node=mark;}
      result.append(node);
    }
    return result;
  }
  const set=(element,text,lang)=>element.replaceChildren(fragment(text,lang));
  window.SiteTypography=Object.freeze({fragment,set,quotes});
})();
