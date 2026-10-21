/* Semantic Western work titles shared by prose, live search, outline and visit UI. */
(() => {
  'use strict';
  const titles=JSON.parse(document.querySelector('#work-typography').textContent);
  const quotes=text=>String(text).replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'").replaceAll('"Common Places and "General Intellect""', '"Common Places and \'General Intellect\'"');
  const labelRules={"compoundPrefix":"Geo-Bio-","compoundTerm":"Necropolitics","articleKeyPrefix":"substance:paragraph:","route":"blog/the-substance","labels":["Pump It Up","Substance","substance"],"italicLanguages":["en","ja"],"localizedQuotes":{"zh":{"\"Pump It Up\"":"“Pump It Up”"}},"lowercaseNamePrefix":"called"};
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
      if(lang==='zh'&&body==='Pump It Up')[output[start],output[end]]=['“','”'];
      else if(latin.test(body)&&!cjk.test(body))output[start]=output[end]=family==='single'?"'":'"';
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
  let filmPassages={};
  function filmContext(value,lang){
    const excerpt=String(value).replace(/^…/,'').replace(/…$/,'').replace(/\s+/g,' ').trim();
    return excerpt.length>=12&&(filmPassages[lang]||[]).some(text=>text.includes(excerpt));
  }
  function fragment(value,lang,highlights=[],context=''){
    const text=foreignQuotes(value,lang),result=document.createDocumentFragment();
    const boundary=/[A-Za-z0-9_À-ÖØ-öø-ÿ-]/;
    const works=[...text.matchAll(pattern)].filter(m=>!boundary.test(text[m.index-1]||'')&&!boundary.test(text[m.index+m[0].length]||'')&&!(contributions.has(m[0])&&/["'“‘]/.test(text[m.index-1]||'')&&/^[,.]?["'”’]/.test(text.slice(m.index+m[0].length)))).map(m=>({start:m.index,end:m.index+m[0].length}));
    if(labelRules.italicLanguages.includes(lang)&&(context===labelRules.route||(labelRules.labels.some(label=>text.includes(label))&&filmContext(text,lang)))){
      const labelPattern=new RegExp(labelRules.labels.map(escape).join('|'),'g');
      for(const m of text.matchAll(labelPattern))if((m[0]!=='substance'||/called\s+["“]?$/.test(text.slice(0,m.index)))&&!boundary.test(text[m.index-1]||'')&&!boundary.test(text[m.index+m[0].length]||'')&&!works.some(w=>w.start<=m.index&&w.end>=m.index+m[0].length))works.push({start:m.index,end:m.index+m[0].length,label:true});
    }
    const sourceTerms=/Thing-Power|construct(?:ing)? the ballast|cogito|conatus/g;
    for(const m of text.matchAll(sourceTerms))if(!boundary.test(text[m.index-1]||'')&&!boundary.test(text[m.index+m[0].length]||''))works.push({start:m.index,end:m.index+m[0].length,source:true});
    for(const m of text.matchAll(/we are our bodies/g))works.push({start:m.index+3,end:m.index+6,source:true});
    const edges=[...new Set([0,text.length,...works.flatMap(x=>[x.start,x.end]),...highlights.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
    for(let i=0;i<edges.length-1;i++){
      const start=edges[i],end=edges[i+1];let node=document.createTextNode(text.slice(start,end));
      if(works.some(x=>x.start<=start&&x.end>=end)){const em=document.createElement('em');em.className=works.some(x=>x.source&&x.start<=start&&x.end>=end)?'source-emphasis':works.some(x=>x.label&&x.start<=start&&x.end>=end)?'film-label':'work-title';em.append(node);node=em;}
      if(highlights.some(x=>x.start<=start&&x.end>=end)){const mark=document.createElement('mark');mark.className='search-keyword';mark.append(node);node=mark;}
      result.append(node);
    }
    return result;
  }
  const set=(element,text,lang)=>element.replaceChildren(fragment(text,lang));
  const sourceMarkRules=[{"id":"abstract-label","key":"substance:paragraph:3","kind":"strong","targets":{"zh":[{"text":"摘  要"}],"en":[{"text":"Abstract"}],"ja":[{"text":"要旨"}]}},{"id":"keywords-label","key":"substance:paragraph:4","kind":"strong","targets":{"zh":[{"text":"关键词"}],"en":[{"text":"Keywords"}],"ja":[{"text":"キーワード"}]}},{"id":"thing-power","key":"substance:paragraph:5","kind":"strong","targets":{"zh":[{"text":"物—力量"}],"en":[{"text":"Thing-Power"}],"ja":[{"text":"物の力"}]}},{"id":"performed-by","key":"substance:paragraph:19","kind":"strong","targets":{"zh":[{"text":"由","context":"这种重复不是由一个主体来展演的"}],"en":[{"text":"by","context":"not performed by a subject"}],"ja":[{"text":"によって","context":"主体によって上演される"}]}},{"id":"materialization-process","key":"substance:paragraph:20","kind":"strong","targets":{"zh":[{"text":"一个物质化过程，其最终的稳定产生了我们称为物质的边界、固定性与表层"}],"en":[{"text":"a process of materialization that stabilizes over time to produce the boundary, fixity, and surface we call matter"}],"ja":[{"text":"物質化の過程として捉える。その安定化が、物質と呼ぶ境界、固定性、表面を作り出す"}]}},{"id":"deconstituting-prefix","key":"substance:paragraph:21","kind":"strong","targets":{"zh":[{"text":"解","context":"解构（deconstituting）"},{"text":"de","context":"deconstituting"}],"en":[{"text":"de","context":"deconstituting possibility"}],"ja":[{"text":"脱","context":"脱構成の可能性"}]}},{"id":"practice","key":"substance:paragraph:23","kind":"strong","targets":{"zh":[{"text":"实践","context":"作为一种特有的活动，实践要求"}],"en":[{"text":"practice","context":"As a specific activity, however, practice presupposes"}],"ja":[{"text":"実践","context":"固有の活動としての実践は"}]}},{"id":"temporal-transformation","key":"substance:paragraph:23","kind":"strong","targets":{"zh":[{"text":"时序转变"}],"en":[{"text":"temporal transformation"}],"ja":[{"text":"時間的変化"}]}},{"id":"materiality","key":"substance:paragraph:23","kind":"strong","targets":{"zh":[{"text":"物质性","context":"由此它具有物质性"}],"en":[{"text":"material","context":"is therefore material"}],"ja":[{"text":"物質性","context":"それゆえ物質性をもつ"}]}},{"id":"are-our-bodies","key":"substance:paragraph:27","kind":"strong","targets":{"zh":[{"text":"是","context":"我们就是（are）我们的身体"}],"en":[{"text":"are","context":"we are our bodies"}],"ja":[{"text":"であり","context":"私たちは身体であり"}]}},{"id":"only-humans","key":"substance:paragraph:27","kind":"strong","targets":{"zh":[{"text":"只能","context":"物只能与人发生关系"}],"en":[{"text":"only","context":"things can relate only to humans"}],"ja":[{"text":"しか","context":"物は人間としか関係せず"}]}},{"id":"all-relations","key":"substance:paragraph:27","kind":"strong","targets":{"zh":[{"text":"全部","context":"物所有关系的全部"}],"en":[{"text":"exhaust","context":"such relations exhaust their existence"}],"ja":[{"text":"全","context":"その関係が全関係なのか"}]}},{"id":"instrument","key":"substance:paragraph:28","kind":"strong","targets":{"zh":[{"text":"工具","context":"身体都只是被当作一个工具或媒介"}],"en":[{"text":"instrument","context":"merely as an instrument or medium"}],"ja":[{"text":"道具","context":"外的につながる道具・媒体"}]}},{"id":"medium","key":"substance:paragraph:28","kind":"strong","targets":{"zh":[{"text":"媒介","context":"身体都只是被当作一个工具或媒介"}],"en":[{"text":"medium","context":"merely as an instrument or medium"}],"ja":[{"text":"媒体","context":"外的につながる道具・媒体"}]}},{"id":"extent-author-added","key":"substance:paragraph:28","kind":"strong","targets":{"zh":[{"text":"何种程度","context":"在何种程度上，身体是"}],"en":[{"text":"To what extent","context":"To what extent are bodies formed"}],"ja":[{"text":"いかなる程度まで","context":"身体はいかなる程度まで、ジェンダー"}]}},{"id":"reconceive-body-author-added","key":"substance:paragraph:28","kind":"strong","targets":{"zh":[{"text":"我们如何重新设想身体，使它不再是一个被动的媒介或工具，等待着某种全然非物质性的意志的激活力量？"}],"en":[{"text":"How can we reconceive the body so that it is no longer a passive medium or instrument awaiting the animating force of an entirely immaterial will?"}],"ja":[{"text":"まったく非物質的な意志の活性化の力を待つ、受動的な媒体や道具ではない身体を、いかに考え直せるのか"}]}},{"id":"material-reconfiguring","key":"substance:paragraph:30","kind":"strong","targets":{"zh":[{"text":"话语实践是对世界的具体物质（再）配置（"},{"text":"），通过这种配置，边界、属性和意义的确定性得以被差异化地实现。"}],"en":[{"text":"Discursive practices are specific material (re)configurings of the world through which boundaries, properties, and meanings become differentially determinate."}],"ja":[{"text":"言説実践は、世界の具体的で物質的な再配置であり、それによって境界、属性、意味の確定性が差異的に実現する。"}]}},{"id":"agential-intra-actions","key":"substance:paragraph:30","kind":"strong","targets":{"zh":[{"text":"话语实践是持续进行中的世界之中诸行动者（"},{"text":"）之间的内在活动（"},{"text":"）","context":"intra-actions），通过这种话语实践"}],"en":[{"text":"They are ongoing agential intra-actions of the world"}],"ja":[{"text":"それは世界の不断のエージェント的内部作用であり"}]}},{"id":"causal-intra-actions","key":"substance:paragraph:30","kind":"strong","targets":{"zh":[{"text":"话语实践是因果性（"},{"text":"）的内在活动"}],"en":[{"text":"they are causal intra-actions"}],"ja":[{"text":"言説実践が因果的な内部作用"}]}},{"id":"medium-and-world","key":"substance:paragraph:32","kind":"strong","targets":{"zh":[{"text":"和","context":"感官媒介和一个敏感的世界"}],"en":[{"text":"and","context":"a sensory medium and a sensitive world"}],"ja":[{"text":"と","context":"感覚媒体と感受的世界"}]}},{"id":"literature-itself","key":"sartre:paragraph:9","kind":"em","targets":{"zh":[{"text":"自己就是","context":"它还不明白它自己就是意识形态"}],"en":[{"text":"is itself","context":"that it is itself ideology"}],"ja":[{"text":"自分自身が","context":"文学は自分自身がイデオロギー"}]}},{"id":"comparative-literature-issue","key":"sartre:note:6","kind":"em","targets":{"en":[{"text":"Comparative Literature"}],"ja":[{"text":"Comparative Literature"}],"zh":[{"text":"Comparative Literature"}]}}];
  const additionalInterests={"en":"I also have a longstanding interest in Huaxia Magic (Fangshu) and am exploring Web4 Trading and Investment.","ja":"また、華夏の方術に長年関心を寄せており、Web4での取引と投資も探究しています。","zh":"此外，我亦对华夏方术有着长期兴趣，也正在探索Web4交易投资。"};
  const additionalInterestEmphasis={"en":["Huaxia Magic (Fangshu)","Web4 Trading and Investment"],"ja":[],"zh":[]};
  // The manuscripts use a change to Heiti/Kaiti as semantic emphasis even when
  // Word's bold/italic flags are absent. Keep the recovered marks in old URLs.
  function sourceMarkText(text){return quotes(String(text)).replace(/[–—]/g,'-');}
  function restoreSourceMarks(root){
    for(const rule of sourceMarkRules)for(const paragraph of root.querySelectorAll('[data-reading-key="'+rule.key+'"]')){
      const locale=paragraph.closest('[data-lang],[lang]'),lang=locale?.dataset.lang||locale?.lang;
      if(!rule.targets[lang]||paragraph.querySelector('[data-author-mark="'+rule.id+'"]'))continue;
      const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),nodes=[];let node,text='';
      while(node=walker.nextNode())if(!node.parentElement.closest('sup,script,style,svg')){nodes.push({node,start:text.length,end:text.length+node.textContent.length});text+=node.textContent;}
      const value=sourceMarkText(text),ranges=[];let valid=true;
      for(const target of rule.targets[lang]){
        const context=sourceMarkText(target.context||target.text),needle=sourceMarkText(target.text),at=value.indexOf(context);
        if(at<0||value.indexOf(context,at+1)>=0){valid=false;break;}
        const offset=context.indexOf(needle);if(offset<0||context.indexOf(needle,offset+1)>=0){valid=false;break;}
        ranges.push({start:at+offset,end:at+offset+needle.length});
      }
      if(!valid)continue;
      for(const part of nodes){
        const rangesHere=ranges.filter(r=>r.start<part.end&&r.end>part.start);if(!rangesHere.length)continue;
        const value=part.node.textContent,edges=[...new Set([0,value.length,...rangesHere.flatMap(r=>[Math.max(0,r.start-part.start),Math.min(value.length,r.end-part.start)])])].sort((a,b)=>a-b),fragment=document.createDocumentFragment();
        for(let i=0;i<edges.length-1;i++){
          const start=edges[i],end=edges[i+1];let child=document.createTextNode(value.slice(start,end));
          if(rangesHere.some(r=>r.start<=part.start+start&&r.end>=part.start+end)){
            const mark=document.createElement(rule.kind);mark.className='source-emphasis';mark.dataset.authorMark=rule.id;mark.append(child);child=mark;
          }
          fragment.append(child);
        }
        part.node.replaceWith(fragment);
      }
    }
    const about=root.querySelector('[data-section="about"]');
    if(about)for(const [lang,text]of Object.entries(additionalInterests)){
      const blocks=[...about.querySelectorAll('.prose[data-lang="'+lang+'"]')],block=blocks.at(-1);
      if(!block||block.querySelector('[data-reading-key="about:additional-interests"]'))continue;
      const paragraph=block.querySelector('[data-reading-key="about-vocation:2"]')||block.querySelector('p:last-child');
      if(!paragraph)continue;
      const span=document.createElement('span');span.className='additional-interests';span.dataset.readingKey='about:additional-interests';
      const phrases=additionalInterestEmphasis[lang]||[],parts=[];let cursor=0;
      for(const phrase of phrases){const at=text.indexOf(phrase,cursor);if(at<0)continue;parts.push(text.slice(cursor,at));const em=document.createElement('em');em.className='interest-topic';em.textContent=phrase;parts.push(em);cursor=at+phrase.length;}
      parts.push(text.slice(cursor));span.append(...parts);if(lang==='en')paragraph.append(' ');paragraph.append(span);
    }
  }
  function apply(root=document){
    restoreSourceMarks(root);
    for(const em of root.querySelectorAll('em.work-title'))if(em.textContent===labelRules.compoundTerm&&em.previousSibling?.nodeType===3&&em.previousSibling.textContent.endsWith(labelRules.compoundPrefix))em.replaceWith(...em.childNodes);
    for(const paragraph of root.querySelectorAll('[data-reading-key^="'+labelRules.articleKeyPrefix+'"]')){
      const locale=paragraph.closest('[data-lang],[lang]');const lang=locale?.dataset.lang||locale?.lang;
      const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),nodes=[];let node;
      while(node=walker.nextNode())if(!node.parentElement.closest('em,i,script,style,code,pre,svg'))nodes.push(node);
      for(const node of nodes){
        let value=node.textContent;
        for(const [from,to]of Object.entries(labelRules.localizedQuotes[lang]||{}))value=value.replaceAll(from,to);
        if(labelRules.italicLanguages.includes(lang)&&labelRules.labels.some(label=>value.includes(label))){
          const result=document.createDocumentFragment(),pattern=new RegExp(labelRules.labels.map(escape).join('|'),'g');let cursor=0;
          for(const match of value.matchAll(pattern)){
            if((match[0]==='substance'&&!/called\s+["“]?$/.test(value.slice(0,match.index)))||/[A-Za-z0-9_]/.test(value[match.index-1]||'')||/[A-Za-z0-9_]/.test(value[match.index+match[0].length]||''))continue;
            result.append(document.createTextNode(value.slice(cursor,match.index)));const em=document.createElement('em');em.className='film-label';em.textContent=match[0];result.append(em);cursor=match.index+match[0].length;
          }
          if(cursor){result.append(document.createTextNode(value.slice(cursor)));node.replaceWith(result);}
        }else if(value!==node.textContent)node.textContent=value;
      }
    }
    filmPassages={};
    for(const paragraph of document.querySelectorAll('[data-reading-key^="'+labelRules.articleKeyPrefix+'"]')){const locale=paragraph.closest('[data-lang],[lang]');const lang=locale?.dataset.lang||locale?.lang;(filmPassages[lang]??=[]).push(paragraph.textContent.replace(/\s+/g,' ').trim());}
  }
  window.SiteTypography=Object.freeze({fragment,set,quotes,apply});
  apply();
})();
