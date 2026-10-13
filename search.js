/* Local keyword search. Only authored work pages enter the index. */
(() => {
  'use strict';
  const languages=['en','ja','zh'];
  const words={
    en:{search:'Search',placeholder:'Search…',empty:'Enter a keyword to search',none:'No results for this keyword.',results:q=>`Search results for “${q}”`,count:n=>`${n} ${n===1?'work':'works'}`,more:n=>`Show all ${n} passages`,less:'Show less',matched:'Match in',categories:{together:'Play/Game Together',creation:'Creation',research:'Studies',blog:'Blog'}},
    ja:{search:'検索',placeholder:'検索…',empty:'キーワードを入力して検索',none:'該当する結果はありません。',results:q=>`「${q}」の検索結果`,count:n=>`${n}件`,more:n=>`全${n}箇所を表示`,less:'折りたたむ',matched:'一致した言語：',categories:{together:'一緒にプレイ/ゲーム',creation:'創作',research:'研究',blog:'ブログ'}},
    zh:{search:'搜索',placeholder:'搜索…',empty:'输入关键词以搜索',none:'没有找到匹配结果。',results:q=>`“${q}”的搜索结果`,count:n=>`${n} 个条目`,more:n=>`展开全部 ${n} 处`,less:'收起',matched:'匹配语言：',categories:{together:'一起玩/游戏',creation:'创作',research:'研究',blog:'博客'}}
  };
  const languageNames={en:'English',ja:'日本語',zh:'中文'};
  const page=document.querySelector('[data-section="search"]');
  const header=document.querySelector('.header-search');
  const input=header.querySelector('input');
  let index=null, query='', language='en', jumpId=0, jumpTimer=0, jumpFrame=0;
  let renderedQuery=null, destinationLinks=[];
  let intentOff=()=>{};
  const expanded=new Set();
  const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  function slot(values){const outer=create('span','i18n-slot');languages.forEach(l=>{const span=create('span','',values[l]);span.lang=l;span.dataset.lang=l;span.hidden=l!==language;outer.append(span);});return outer;}
  function plain(element,l){
    const copy=element.cloneNode(true);
    copy.querySelectorAll('[data-lang]').forEach(el=>{if(el.dataset.lang!==l)el.remove();});
    copy.querySelectorAll('img,canvas,svg,[aria-hidden="true"]').forEach(el=>el.remove());
    // A nested source block has its own search anchor.
    copy.querySelectorAll('[data-reading-key],[data-source]').forEach(el=>el.remove());
    return copy.textContent.replace(/\s+/g,' ').trim();
  }
  function buildIndex(){
    return [...document.querySelectorAll('[data-searchable]')].map(section=>{
      const route=section.dataset.section, titles={},blocks={};
      languages.forEach(l=>{
        titles[l]=section.querySelector(`h1 [data-lang="${l}"]`)?.textContent.trim()||'';
        const candidates=[section.querySelector('h1'),section.querySelector('.detail-meta'),...section.querySelectorAll(`.detail-body[data-lang="${l}"] [data-reading-key]`)];
        blocks[l]=candidates.filter(Boolean).map(el=>({key:el.dataset.readingKey||el.dataset.source,text:plain(el,l)})).filter(item=>item.text);
      });
      return {route,category:route.split('/')[0],image:section.dataset.searchImage,titles,blocks};
    });
  }
  function normalized(text){
    let value='';const starts=[],ends=[];let position=0;
    for(const char of text){const transformed=char.normalize('NFKC').toLocaleLowerCase();for(let i=0;i<transformed.length;i++){starts.push(position);ends.push(position+char.length);}value+=transformed;position+=char.length;}
    return {value,starts,ends};
  }
  function matches(text,term){
    const hay=normalized(text),needle=term.normalize('NFKC').toLocaleLowerCase();const found=[];
    if(!needle)return found;
    let from=0,at;
    while((at=hay.value.indexOf(needle,from))!==-1){found.push({start:hay.starts[at],end:hay.ends[at+needle.length-1]});from=at+needle.length;}
    return found;
  }
  function results(term){
    if(!index)index=buildIndex();
    const found=[];
    for(const doc of index){
      const hits=Object.fromEntries(languages.map(l=>[l,doc.blocks[l].flatMap(block=>{
        const occurrences=matches(block.text,term);
        return occurrences.length?[{...block,at:occurrences[0],lang:l}]:[];
      })]));
      const allHits=languages.flatMap(l=>hits[l]);
      if(!allHits.length)continue;
      const hasBody=allHits.some(hit=>!['detail-title','detail-meta'].includes(hit.key));
      const eligible=hit=>!hasBody||!['detail-title','detail-meta'].includes(hit.key);
      // One semantic passage has one position, even when this literal keyword
      // occurs in a different set of translated paragraphs in each language.
      const keys=[...new Set(languages.flatMap(l=>doc.blocks[l].map(block=>block.key)))];
      const passages=keys.flatMap(key=>{
        const byLanguage=Object.fromEntries(languages.map(l=>[l,hits[l].find(hit=>hit.key===key&&eligible(hit))]));
        const fallback=languages.map(l=>byLanguage[l]).find(Boolean);
        if(!fallback)return [];
        return [{key,variants:Object.fromEntries(languages.map(l=>[l,byLanguage[l]||fallback]))}];
      });
      found.push({...doc,passages});
    }
    // Stable across language changes: title matches first, then source order.
    return found.sort((a,b)=>Number(languages.some(l=>matches(b.titles[l],term).length))-Number(languages.some(l=>matches(a.titles[l],term).length)));
  }
  function markedText(text,term){
    const fragment=document.createDocumentFragment();let last=0;
    matches(text,term).forEach(hit=>{fragment.append(document.createTextNode(text.slice(last,hit.start)));fragment.append(create('mark','search-keyword',text.slice(hit.start,hit.end)));last=hit.end;});
    fragment.append(document.createTextNode(text.slice(last)));return fragment;
  }
  function targetURL(doc,hit){
    const params=new URLSearchParams({q:query,hit:hit.key,matchLang:hit.lang});
    return '#'+doc.route+'?'+params.toString();
  }
  function snippet(doc,hit){
    const link=create('a','search-passage');link.href=targetURL(doc,hit);link.lang=hit.lang;
    const radius=hit.lang==='en'?115:64;
    const start=Math.max(0,hit.at.start-radius),end=Math.min(hit.text.length,hit.at.end+radius);
    const excerpt=(start?'…':'')+hit.text.slice(start,end)+(end<hit.text.length?'…':'');
    link.append(markedText(excerpt,query));
    return link;
  }
  function passageSlot(doc,passage){
    const group=create('div','search-passage-slot i18n-slot');
    group.dataset.readingKey='result-passage:'+doc.route+':'+passage.key;
    languages.forEach(l=>{
      const link=snippet(doc,passage.variants[l]);
      link.dataset.lang=l;link.hidden=l!==language;
      group.append(link);
    });
    return group;
  }
  function destination(link,doc,passage,withLabel=false){
    destinationLinks.push({link,doc,passage,withLabel});
    return link;
  }
  function setResultLanguage(){
    page.querySelectorAll('[data-lang]').forEach(el=>{el.hidden=el.dataset.lang!==language;});
    destinationLinks.forEach(({link,doc,passage,withLabel})=>{
      link.href=targetURL(doc,passage.variants[language]);
      if(withLabel)link.setAttribute('aria-label',doc.titles[language]);
    });
  }
  function render(term,lang){
    query=String(term||'').trim().slice(0,120);language=languages.includes(lang)?lang:'en';
    input.value=query;sync(language);
    // Reuse the same cards and passages on a language change. All translations
    // share a grid cell, so their joint natural height is reserved from the start.
    if(renderedQuery===query){setResultLanguage();return;}
    renderedQuery=query;destinationLinks=[];
    const content=page.querySelector('.search-content');content.replaceChildren();
    const title=page.querySelector('h1');title.replaceChildren(slot(Object.fromEntries(languages.map(l=>[l,query?words[l].results(query):words[l].search]))));
    const found=query?results(query):[];
    const count=create('p','search-count');count.setAttribute('role','status');count.append(slot(Object.fromEntries(languages.map(l=>[l,query?words[l].count(found.length):'']))));content.append(count);
    if(!found.length){const message=create('p','search-empty');message.append(slot(Object.fromEntries(languages.map(l=>[l,words[l][query?'none':'empty']]))));content.append(message);return;}
    const list=create('div','search-results');content.append(list);
    for(const doc of found){
      const {passages}=doc;
      const card=create('article','search-result');card.dataset.readingKey='result:'+doc.route;
      const visual=create('div','search-visual');
      const picture=destination(create('a','search-picture'),doc,passages[0],true);
      picture.style.setProperty('--search-image',`url("${doc.image}")`);
      const img=create('img');img.src=doc.image;img.alt='';img.width=192;img.height=144;img.loading='lazy';picture.append(img);
      const category=create('a','search-category');category.href='#'+doc.category;category.append(slot(Object.fromEntries(languages.map(l=>[l,words[l].categories[doc.category]]))));visual.append(picture,category);
      const copy=create('div','search-copy');
      const heading=create('h2');heading.dataset.readingKey='result-title:'+doc.route;
      const titleLink=destination(create('a'),doc,passages[0]);titleLink.append(slot(doc.titles));heading.append(titleLink);copy.append(heading);
      const matchLabels=Object.fromEntries(languages.map(l=>{
        const alternatives=[...new Set(passages.map(p=>p.variants[l].lang).filter(source=>source!==l))];
        return [l,alternatives.length?words[l].matched+' '+alternatives.map(source=>languageNames[source]).join(' · '):''];
      }));
      if(languages.some(l=>matchLabels[l])){
        const hint=create('p','search-match-language');hint.append(slot(matchLabels));copy.append(hint);
      }
      copy.append(passageSlot(doc,passages[0]));
      if(passages.length>1){
        const more=create('div','search-more');more.id='matches-'+doc.route.replaceAll('/','-');
        const button=create('button','search-expand');button.type='button';button.setAttribute('aria-controls',more.id);
        const apply=()=>{
          const open=expanded.has(query+'|'+doc.route);more.hidden=!open;
          button.setAttribute('aria-expanded',String(open));
          button.replaceChildren(slot(Object.fromEntries(languages.map(l=>[l,open?words[l].less:words[l].more(passages.length)]))));
          if(open&&!more.childElementCount)passages.slice(1).forEach(passage=>more.append(passageSlot(doc,passage)));
        };
        button.addEventListener('click',()=>{const key=query+'|'+doc.route;if(expanded.has(key))expanded.delete(key);else expanded.add(key);apply();window.FlightProgress?.update();});
        apply();copy.append(more,button);
      }
      card.append(visual,copy);list.append(card);
    }
    setResultLanguage();
  }
  function sync(lang){
    language=languages.includes(lang)?lang:'en';input.placeholder=words[language].placeholder;input.setAttribute('aria-label',words[language].search);
    header.querySelector('button[type="submit"]').setAttribute('aria-label',words[language].search);
    header.querySelector('.search-open').setAttribute('aria-label',words[language].search);
  }
  function clearMarks(){
    document.querySelectorAll('mark.search-hit').forEach(mark=>{const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent));parent.normalize();});
  }
  function cancel(){jumpId++;clearTimeout(jumpTimer);cancelAnimationFrame(jumpFrame);intentOff();intentOff=()=>{};clearMarks();delete document.documentElement.dataset.searchJump;}
  function highlight(target,term){
    const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement.closest('[hidden],button,script,style,[aria-hidden="true"]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];let text='',node;
    while((node=walker.nextNode())){nodes.push({node,start:text.length,end:text.length+node.length});text+=node.textContent;}
    const found=matches(text,term);if(!found.length)return null;
    let first=null;
    for(let n=nodes.length-1;n>=0;n--){const item=nodes[n];const portions=found.map((hit,i)=>({start:Math.max(item.start,hit.start)-item.start,end:Math.min(item.end,hit.end)-item.start,index:i})).filter(hit=>hit.end>hit.start);if(!portions.length)continue;const fragment=document.createDocumentFragment();let offset=0;for(const portion of portions){fragment.append(document.createTextNode(item.node.textContent.slice(offset,portion.start)));const mark=create('mark','search-hit',item.node.textContent.slice(portion.start,portion.end));if(portion.index===0){mark.classList.add('search-hit-selected');first=mark;}fragment.append(mark);offset=portion.end;}fragment.append(document.createTextNode(item.node.textContent.slice(offset)));item.node.replaceWith(fragment);}
    return first;
  }
  function jump(section,params){
    const term=params.get('q'),key=params.get('hit');if(!term||!key)return;
    const target=[...section.querySelectorAll('[data-reading-key]')].find(el=>el.dataset.readingKey===key&&!el.closest('[data-lang][hidden]'));
    if(!target)return;
    for(let parent=target.parentElement;parent&&parent!==section;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    const id=++jumpId, reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const stop=()=>{if(id!==jumpId)return;jumpId++;clearTimeout(jumpTimer);cancelAnimationFrame(jumpFrame);intentOff();delete document.documentElement.dataset.searchJump;};
    const intent=event=>{if(event.type==='keydown'&&!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))return;stop();};
    ['wheel','touchstart','pointerdown','keydown'].forEach(type=>addEventListener(type,intent,{passive:true}));
    intentOff=()=>['wheel','touchstart','pointerdown','keydown'].forEach(type=>removeEventListener(type,intent));
    document.documentElement.dataset.searchJump='waiting';
    jumpTimer=setTimeout(()=>{
      if(id!==jumpId)return;
      const mark=highlight(target,term);if(!mark){stop();return;}
      document.documentElement.dataset.searchJump='scrolling';
      const from=scrollY,top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-top'))||126;
      const to=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,scrollY+mark.getBoundingClientRect().top-top-8));
      const duration=reduced?0:Math.min(1150,650+Math.abs(to-from)*.04),start=performance.now();
      const frame=now=>{
        if(id!==jumpId)return;
        const progress=duration?Math.min(1,(now-start)/duration):1;
        const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
        scrollTo({top:from+(to-from)*eased,behavior:'instant'});
        if(progress<1)jumpFrame=requestAnimationFrame(frame);
        else {if(mark.textContent.length<=24&&!/\s/.test(mark.textContent))mark.classList.add('search-hit-pop');mark.classList.add('search-hit-arrived');mark.tabIndex=-1;mark.focus({preventScroll:true});intentOff();delete document.documentElement.dataset.searchJump;}
      };jumpFrame=requestAnimationFrame(frame);
    },reduced?0:420);
  }
  header.addEventListener('submit',event=>{event.preventDefault();const term=input.value.trim().slice(0,120);const hash='#search'+(term?'?q='+encodeURIComponent(term):'');input.blur();if(location.hash===hash){render(term,language);scrollTo({top:0,behavior:'smooth'});}else location.hash=hash;});
  header.querySelector('.search-open').addEventListener('click',()=>{header.classList.add('is-open');header.querySelector('.search-open').setAttribute('aria-expanded','true');input.focus();});
  const outsideSearch=target=>!header.contains(target)&&!target?.closest?.('[data-set-lang]');
  const closeSearch=()=>{header.classList.remove('is-open');header.querySelector('.search-open').setAttribute('aria-expanded','false');};
  // A language change retains the open field and its input as part of the page.
  header.addEventListener('focusout',()=>{requestAnimationFrame(()=>{if(outsideSearch(document.activeElement))closeSearch();});});
  document.addEventListener('pointerdown',event=>{if(header.classList.contains('is-open')&&outsideSearch(event.target))closeSearch();});
  document.addEventListener('focusin',event=>{if(header.classList.contains('is-open')&&outsideSearch(event.target))closeSearch();});
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){header.classList.remove('is-open');header.querySelector('.search-open').setAttribute('aria-expanded','false');header.querySelector('.search-open').focus();}});
  window.SiteSearch=Object.freeze({render,sync,cancel,jump});
})();
