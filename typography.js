/* Semantic English work titles shared by live search, outline and visit UI. */
(() => {
  'use strict';
  const titles=JSON.parse(document.querySelector('#work-typography').textContent);
  const quotes=text=>String(text).replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'");
  const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('(?:'+titles.sort((a,b)=>b.length-a.length).map(t=>escape(quotes(t))).join('|')+')','g');
  function fragment(value,lang,highlights=[]){
    const text=lang==='en'?quotes(value):String(value),result=document.createDocumentFragment();
    const works=lang==='en'?[...text.matchAll(pattern)].filter(m=>!/[\w]/.test(text[m.index-1]||'')&&!/[\w]/.test(text[m.index+m[0].length]||'')&&!(m[0]==='The Field of Cultural Production'&&text.slice(m.index+m[0].length).startsWith(', or:'))).map(m=>({start:m.index,end:m.index+m[0].length})):[];
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
