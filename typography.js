/* Semantic Western work titles shared by prose, live search, outline and visit UI. */
(() => {
  'use strict';
  const titles=JSON.parse(document.querySelector('#work-typography').textContent);
  const quotes=text=>String(text).replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'").replaceAll('"Common Places and "General Intellect""', '"Common Places and \'General Intellect\'"');
  const latin=/[A-Za-zÀ-ÖØ-öø-ÿ]/,cjk=/[\u3040-\u30ff\u3400-\u9fff]/;
  function foreignQuotes(value){
    let text=String(value);
    if(latin.test(text)&&!cjk.test(text))return quotes(text);
    text=text.replace(/([A-Za-zÀ-ÖØ-öø-ÿ])[’‘](?=[A-Za-zÀ-ÖØ-öø-ÿ])/g,"$1'");
    for(let pass=0;pass<2;pass++)for(const [pattern,mark] of [[/“([^“”\n]+)”/g,'"'],[/‘([^‘’\n]+)’/g,"'"]]){
      text=text.replace(pattern,(all,body)=>!cjk.test(body)&&((body.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g)||[]).length>=4)&&/\s/.test(body)?mark+quotes(body)+mark:all);
    }
    return text.replaceAll('"Common Places and "General Intellect""', '"Common Places and \'General Intellect\'"');
  }
  const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const suffixes={'The Field of Cultural Production':'(?!, or:)','October':'(?=\\s+\\d{1,3}\\s*\\()','Mind':'(?=\\s+\\d+\\s*,)','Transfer':'(?=\\s+\\d+\\s*,)','Signs':'(?=\\s+\\d+\\s*,)'};
  const pattern=new RegExp('(?:'+[...titles].sort((a,b)=>b.length-a.length).map(t=>escape(quotes(t))+(suffixes[t]||'')).join('|')+')','g');
  const contributions=new Set(['What Is Literature?','Rivers of the North','Cruel Optimism','Necropolitics']);
  function fragment(value,lang,highlights=[]){
    const text=lang==='en'?quotes(value):foreignQuotes(value),result=document.createDocumentFragment();
    const boundary=/[A-Za-z0-9_À-ÖØ-öø-ÿ]/;
    const works=[...text.matchAll(pattern)].filter(m=>!boundary.test(text[m.index-1]||'')&&!boundary.test(text[m.index+m[0].length]||'')&&!(contributions.has(m[0])&&/["'“‘]/.test(text[m.index-1]||'')&&/^[,.]?["'”’]/.test(text.slice(m.index+m[0].length)))).map(m=>({start:m.index,end:m.index+m[0].length}));
    const edges=[...new Set([0,text.length,...works.flatMap(x=>[x.start,x.end]),...highlights.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
    for(let i=0;i<edges.length-1;i++){
      const start=edges[i],end=edges[i+1];let node=document.createTextNode(text.slice(start,end));
      if(works.some(x=>x.start<=start&&x.end>=end)){const em=document.createElement('em');em.className='work-title';em.append(node);node=em;}
      if(highlights.some(x=>x.start<=start&&x.end>=end)){const mark=document.createElement('mark');mark.className='search-keyword';mark.append(node);node=mark;}
      result.append(node);
    }
    return result;
  }
  const set=(element,text,lang)=>element.replaceChildren(fragment(text,lang));
  window.SiteTypography=Object.freeze({fragment,set,quotes});
})();
