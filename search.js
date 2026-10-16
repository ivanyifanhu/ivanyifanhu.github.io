/* Local keyword search. Only authored work pages enter the index. */
(() => {
  'use strict';
  const languages=['en','ja','zh'];
  const words={
    en:{search:'Search',placeholder:'Search…',empty:'Enter a keyword to search',none:'No results for this keyword.',results:q=>`Search results for “${q}”`,count:n=>`${n} ${n===1?'work':'works'}`,more:n=>`Show all ${n} passages`,less:'Show less',matched:'Matching versions:',categories:{together:'Play/Game Together',creation:'Creation',research:'Studies',blog:'Notes'}},
    ja:{search:'検索',placeholder:'検索…',empty:'キーワードを入力して検索',none:'該当する結果はありません。',results:q=>`「${q}」の検索結果`,count:n=>`${n}件`,more:n=>`全${n}箇所を表示`,less:'折りたたむ',matched:'一致する版：',categories:{together:'一緒にプレイ/ゲーム',creation:'創作',research:'研究',blog:'ノート'}},
    zh:{search:'搜索',placeholder:'搜索…',empty:'输入关键词以搜索',none:'没有找到匹配结果。',results:q=>`“${q}”的搜索结果`,count:n=>`${n} 个条目`,more:n=>`展开全部 ${n} 处`,less:'收起',matched:'匹配版本：',categories:{together:'一起玩/游戏',creation:'创作',research:'研究',blog:'札记'}}
  };
  const languageNames={en:'English',ja:'日本語',zh:'中文'};
  const page=document.querySelector('[data-section="search"]');
  const header=document.querySelector('.header-search');
  const input=header.querySelector('input');
  const fields=header.querySelector('.search-fields');
  const compactSearch=matchMedia('(max-width:1100px)');
  const syncSearchAccess=()=>{fields.inert=compactSearch.matches&&!header.classList.contains('is-open');};
  let index=null, query='', language='en', jumpId=0, jumpTimer=0, jumpFrame=0;
  let renderedQuery=null, resultCards=[];
  const versions=new Map();
  let intentOff=()=>{};
  const expanded=new Set();
  const visits=new Map();
  const visitPrefix='homepage-search-visit:';
  let lastOpened=null, returnTimer=0, disclosureMotion=null;
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
      const category=route.split('/')[0];
      const group=category==='blog'?[...document.querySelectorAll('[data-section="blog"] .blog-group')].find(group=>[...group.querySelectorAll('a[href]')].some(link=>(link.dataset.routeHref||link.getAttribute('href'))==='#'+route)):null;
      const categoryLabels=Object.fromEntries(languages.map(l=>{
        const label=section.getAttribute('data-category-label-'+l);
        const subgroup=group?.querySelector('h2 [data-lang="'+l+'"]')?.textContent.trim();
        return [l,label||words[l].categories[category]+(subgroup?'—'+subgroup:'')];
      }));
      return {route,category,categoryLabels,image:section.dataset.searchImage,titles,blocks};
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
      // Keep literal hits in their actual version. A matching title still counts
      // when that version has no body hit; never borrow a translated passage.
      const matched=languages.filter(l=>hits[l].length);
      matched.forEach(l=>{
        const body=hits[l].filter(hit=>!['detail-title','detail-meta'].includes(hit.key));
        if(body.length)hits[l]=body;
      });
      found.push({...doc,hits,matched});
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
  function passageSlot(doc,hit){
    const group=create('div','search-passage-slot');
    group.dataset.readingKey='result-passage:'+doc.route+':'+hit.lang+':'+hit.key;
    group.append(snippet(doc,hit));return group;
  }
  function setResultLanguage(){
    page.querySelectorAll('[data-lang]').forEach(el=>{el.hidden=el.dataset.lang!==language;});
    resultCards.forEach(state=>{
      const hit=state.doc.hits[state.selected][0];
      state.links.forEach(link=>{link.href=targetURL(state.doc,hit);});
      state.links[0].setAttribute('aria-label',state.doc.titles[language]);
      state.tabs.setAttribute('aria-label',words[language].matched);
      state.applyLabel?.();
    });
  }
  function settleVersions(){resultCards.forEach(state=>state.finish?.());}
  function selectVersion(state,next,animate=true){
    if(!state.doc.matched.includes(next))return;
    // Retarget from the currently painted position, including rapid clicks.
    const oldTransform=getComputedStyle(state.tracks[0]).transform;
    const previous=state.selected;
    state.finish?.();state.selected=next;
    versions.set(query+'|'+state.doc.route,next);
    const position=state.doc.matched.indexOf(next);
    const transform='translateX('+(-100*position)+'%)';
    state.buttons.forEach(button=>{
      const active=button.dataset.resultVersion===next;
      button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    });
    state.panels.forEach(panel=>{panel.inert=panel.dataset.resultVersion!==next;panel.setAttribute('aria-hidden',String(panel.inert));});
    setResultLanguage();
    const animations=[];let done=false;
    const finish=()=>{
      if(done)return;done=true;
      state.tracks.forEach(track=>{track.style.transform=transform;});
      animations.forEach(animation=>animation.cancel());
      state.panels.forEach(panel=>{panel.hidden=panel.dataset.resultVersion!==next;});
      state.finish=null;state.card.classList.remove('is-switching-version');
    };
    state.finish=finish;
    if(!animate||previous===next||matchMedia('(prefers-reduced-motion:reduce)').matches){finish();return;}
    state.panels.forEach(panel=>{panel.hidden=false;});
    state.card.classList.add('is-switching-version');
    state.tracks.forEach(track=>{
      track.style.transform=transform;
      animations.push(track.animate([{transform:oldTransform},{transform}],{
        duration:Math.abs(state.doc.matched.indexOf(previous)-position)>1?700:520,
        easing:'cubic-bezier(.4,0,.2,1)',fill:'both'
      }));
    });
    Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
      if(state.finish===finish){finish();remember(history.state?.ivanRoute?.id);}
    });
  }
  function versionTrack(state,more){
    const viewport=create('div','search-version-window');
    const track=create('div','search-version-track');viewport.append(track);state.tracks.push(track);
    state.doc.matched.forEach(l=>{
      const panel=create('div','search-version-panel');panel.dataset.resultVersion=l;panel.lang=l;
      if(!more){panel.id='version-'+state.doc.route.replaceAll('/','-')+'-'+l;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',panel.id+'-tab');}
      const hits=more?state.doc.hits[l].slice(1):state.doc.hits[l].slice(0,1);
      hits.forEach(hit=>panel.append(passageSlot(state.doc,hit)));
      state.panels.push(panel);track.append(panel);
    });
    return viewport;
  }
  function settleDisclosure(){
    disclosureMotion?.finish();
  }
  function disclose(card,more,content,button,open,applyLabel){
    settleDisclosure();
    const root=document.documentElement;
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const from=scrollY,readingTop=parseFloat(getComputedStyle(root).getPropertyValue('--reading-top'))||126;
    const cardTop=from+card.getBoundingClientRect().top;
    const startHeight=more.hidden?0:more.getBoundingClientRect().height;
    root.dataset.searchDisclosure=open?'opening':'closing';
    // Browser scroll anchoring must not fight the single shared scroll/height
    // timeline, particularly while a tall final result is being folded away.
    more.style.height=startHeight+'px';more.hidden=false;more.inert=!open;
    more.classList.add('is-unrolling');
    const endHeight=open?content.getBoundingClientRect().height:0;
    // Measure the real final page, not just a height difference: the main
    // column has a viewport minimum height, so short final cards stop shrinking
    // before their disclosure does. Restore the current frame before painting.
    more.style.height=endHeight+'px';const finalDocumentHeight=root.scrollHeight;
    more.style.height=startHeight+'px';void root.scrollHeight;
    scrollTo({top:from,behavior:'instant'});
    const to=Math.max(0,Math.min(Math.max(0,finalDocumentHeight-innerHeight),cardTop-readingTop));
    const duration=reduced?0:Math.min(960,660+Math.abs(to-from)*.045);
    const started=performance.now();let frame=0,followScroll=true,done=false;
    const entryId=history.state?.ivanRoute?.id;
    const types=['wheel','touchstart','pointerdown','keydown'];
    const intent=event=>{
      if(event.type==='keydown'&&!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))return;
      followScroll=false;
    };
    const finish=()=>{
      if(done)return;done=true;cancelAnimationFrame(frame);
      types.forEach(type=>removeEventListener(type,intent));
      more.hidden=!open;more.inert=!open;
      more.style.removeProperty('height');content.style.removeProperty('opacity');content.style.removeProperty('transform');
      more.classList.remove('is-unrolling');button.disabled=false;applyLabel();
      delete root.dataset.searchDisclosure;disclosureMotion=null;
      window.FlightProgress?.update();remember(entryId);
    };
    disclosureMotion={finish};button.disabled=true;applyLabel();
    types.forEach(type=>addEventListener(type,intent,{passive:true}));
    const tick=now=>{
      const progress=duration?Math.min(1,(now-started)/duration):1;
      const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
      more.style.height=(startHeight+(endHeight-startHeight)*eased)+'px';
      const reveal=open?eased:1-eased;
      content.style.opacity=String(.15+.85*reveal);
      content.style.transform='translateY('+(-8*(1-reveal))+'px)';
      if(followScroll){
        const limit=Math.max(0,root.scrollHeight-innerHeight);
        scrollTo({top:Math.min(limit,from+(to-from)*eased),behavior:'instant'});
      }
      window.FlightProgress?.update();
      if(progress<1)frame=requestAnimationFrame(tick);
      else {finish();if(followScroll)scrollTo({top:to,behavior:'instant'});}
    };
    frame=requestAnimationFrame(tick);
  }
  function render(term,lang){
    query=String(term||'').trim().slice(0,120);language=languages.includes(lang)?lang:'en';
    input.value=query;sync(language);
    // Global language changes update the chrome, while each result retains its
    // independently selected version and reserved passage dimensions.
    if(renderedQuery===query){setResultLanguage();return;}
    settleDisclosure();settleVersions();renderedQuery=query;resultCards=[];
    const content=page.querySelector('.search-content');content.replaceChildren();
    const title=page.querySelector('h1');title.replaceChildren(slot(Object.fromEntries(languages.map(l=>[l,query?words[l].results(query):words[l].search]))));
    const found=query?results(query):[];
    const count=create('p','search-count');count.setAttribute('role','status');count.append(slot(Object.fromEntries(languages.map(l=>[l,query?words[l].count(found.length):'']))));content.append(count);
    if(!found.length){const message=create('p','search-empty');message.append(slot(Object.fromEntries(languages.map(l=>[l,words[l][query?'none':'empty']]))));content.append(message);return;}
    const list=create('div','search-results');content.append(list);
    for(const doc of found){
      const card=create('article','search-result');card.dataset.readingKey='result:'+doc.route;
      const preferred=versions.get(query+'|'+doc.route);
      const selected=doc.matched.includes(preferred)?preferred:doc.matched.includes(language)?language:doc.matched[0];
      const state={doc,card,selected,tracks:[],panels:[],buttons:[],links:[],finish:null};resultCards.push(state);
      const visual=create('div','search-visual');
      const picture=create('a','search-picture');state.links.push(picture);
      picture.style.setProperty('--search-image',`url("${doc.image}")`);
      const img=create('img');img.src=doc.image;img.alt='';img.width=192;img.height=144;img.loading='lazy';picture.append(img);
      const category=create('a','search-category');category.href='#'+doc.category;category.append(slot(doc.categoryLabels));visual.append(picture,category);
      const copy=create('div','search-copy');
      const heading=create('h2');heading.dataset.readingKey='result-title:'+doc.route;
      const titleLink=create('a');state.links.push(titleLink);titleLink.append(slot(doc.titles));heading.append(titleLink);copy.append(heading);
      const hint=create('div','search-match-language');
      hint.append(slot(Object.fromEntries(languages.map(l=>[l,words[l].matched]))));
      const tabs=create('span','search-version-tabs');tabs.setAttribute('role','tablist');state.tabs=tabs;
      doc.matched.forEach((l,i)=>{
        if(i){const separator=create('span','search-version-separator',' · ');separator.setAttribute('aria-hidden','true');tabs.append(separator);}
        const tab=create('button','search-version-tab',languageNames[l]);tab.type='button';tab.lang=l;tab.dataset.resultVersion=l;
        tab.id='version-'+doc.route.replaceAll('/','-')+'-'+l+'-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-controls',tab.id.slice(0,-4));
        tab.addEventListener('click',()=>{settleDisclosure();selectVersion(state,l);remember(history.state?.ivanRoute?.id);});
        tab.addEventListener('keydown',event=>{
          const direction=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
          const target=direction?(i+direction+doc.matched.length)%doc.matched.length:event.key==='Home'?0:event.key==='End'?doc.matched.length-1:null;
          if(target===null)return;event.preventDefault();state.buttons[target].focus({preventScroll:true});state.buttons[target].click();
        });
        state.buttons.push(tab);tabs.append(tab);
      });
      hint.append(tabs);copy.append(hint,versionTrack(state,false));
      if(doc.matched.some(l=>doc.hits[l].length>1)){
        const more=create('div','search-more');more.id='matches-'+doc.route.replaceAll('/','-');
        const moreContent=create('div','search-more-content');moreContent.append(versionTrack(state,true));more.append(moreContent);
        const button=create('button','search-expand');button.type='button';button.setAttribute('aria-controls',more.id);
        // Reserve all disclosure labels just as we reserve passage heights.
        const labels=[];
        doc.matched.forEach(version=>languages.forEach(l=>{
          const label=create('span');label.lang=l;label.dataset.labelLang=l;label.dataset.labelVersion=version;button.append(label);labels.push(label);
        }));
        state.applyLabel=()=>{
          const open=expanded.has(query+'|'+doc.route);
          button.setAttribute('aria-expanded',String(open));
          labels.forEach(label=>{
            const l=label.dataset.labelLang,version=label.dataset.labelVersion;
            label.textContent=open?words[l].less:words[l].more(doc.hits[version].length);
            label.hidden=l!==language||version!==state.selected;
          });
          // A version with one passage needs no disclosure, but its space remains.
          button.style.visibility=open||doc.hits[state.selected].length>1?'':'hidden';
          button.inert=!open&&doc.hits[state.selected].length<=1;
        };
        const initialOpen=expanded.has(query+'|'+doc.route);
        more.hidden=!initialOpen;more.inert=!initialOpen;state.applyLabel();
        button.addEventListener('click',()=>{
          settleVersions();const key=query+'|'+doc.route,open=!expanded.has(key);
          if(open)expanded.add(key);else expanded.delete(key);
          disclose(card,more,moreContent,button,open,state.applyLabel);
        });
        copy.append(more,button);
      }
      selectVersion(state,selected,false);
      card.append(visual,copy);list.append(card);
    }
    setResultLanguage();
  }
  function sync(lang){
    language=languages.includes(lang)?lang:'en';input.placeholder=words[language].placeholder;input.setAttribute('aria-label',words[language].search);
    header.querySelector('button[type="submit"]').setAttribute('aria-label',words[language].search);
    header.querySelector('.search-open').setAttribute('aria-label',words[language].search);
  }
  function remember(entryId){
    if(!entryId||page.hidden||renderedQuery!==query||disclosureMotion)return;
    const top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-top'))||126;
    const anchors=[...page.querySelectorAll('[data-reading-key]')].filter(el=>!el.classList.contains('search-result')&&!el.closest('[hidden],[inert]'));
    const anchor=anchors.find(el=>el.getBoundingClientRect().bottom>top);
    const snapshot={query,top:scrollY,width:innerWidth,expanded:[...expanded].filter(key=>key.startsWith(query+'|')),versions:[...versions].filter(([key])=>key.startsWith(query+'|')),lastOpened:lastOpened?.query===query?lastOpened:null,
      anchor:anchor?{key:anchor.dataset.readingKey,offset:anchor.getBoundingClientRect().top}:null};
    visits.set(entryId,snapshot);
    try{sessionStorage.setItem(visitPrefix+entryId,JSON.stringify(snapshot));}catch{}
  }
  function recalled(entryId,term){
    let snapshot=visits.get(entryId);
    if(!snapshot){try{snapshot=JSON.parse(sessionStorage.getItem(visitPrefix+entryId));}catch{}}
    const clean=String(term||'').trim().slice(0,120);
    if(!snapshot||snapshot.query!==clean||!Number.isFinite(snapshot.top)||!Array.isArray(snapshot.expanded))return null;
    return snapshot;
  }
  function prepareReturn(snapshot){
    if(!snapshot)return;
    // Restore the expansion state of this history entry, even if a later visit
    // to the same query changed it. Render before revealing the new page.
    const prefix=snapshot.query+'|';
    const previous=[...expanded].filter(key=>key.startsWith(prefix)).sort();
    const next=snapshot.expanded.filter(key=>typeof key==='string'&&key.startsWith(prefix)).sort();
    if(JSON.stringify(previous)!==JSON.stringify(next)){
      previous.forEach(key=>expanded.delete(key));next.forEach(key=>expanded.add(key));
      renderedQuery=null;
    }
    const previousVersions=[...versions].filter(([key])=>key.startsWith(prefix)).sort();
    const nextVersions=(snapshot.versions||[]).filter(item=>Array.isArray(item)&&typeof item[0]==='string'&&item[0].startsWith(prefix)&&languages.includes(item[1])).sort();
    if(JSON.stringify(previousVersions)!==JSON.stringify(nextVersions)){
      previousVersions.forEach(([key])=>versions.delete(key));nextVersions.forEach(([key,l])=>versions.set(key,l));renderedQuery=null;
    }
    lastOpened=snapshot.lastOpened||null;
  }
  function restorePosition(snapshot){
    if(!snapshot)return;
    let top=snapshot.top;
    // Identical viewports return to the exact pixel; after a rotation or resize,
    // preserve the visible passage instead of an unrelated absolute position.
    if(snapshot.width!==innerWidth&&snapshot.anchor){
      const anchor=[...page.querySelectorAll('[data-reading-key]')].find(el=>el.dataset.readingKey===snapshot.anchor.key&&!el.closest('[hidden],[inert]'));
      if(anchor)top=scrollY+anchor.getBoundingClientRect().top-snapshot.anchor.offset;
    }
    scrollTo({top:Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,top)),behavior:'instant'});
  }
  function clearReturn(){
    clearTimeout(returnTimer);
    page.querySelectorAll('.search-returned').forEach(el=>el.classList.remove('search-returned'));
  }
  function announceReturn(snapshot){
    clearReturn();
    const key=snapshot?.lastOpened?.key;if(!key)return;
    const target=[...page.querySelectorAll('[data-reading-key]')].find(el=>el.dataset.readingKey===key&&!el.closest('[hidden],[inert]'));
    if(!target)return;
    const visible=target.classList.contains('search-passage-slot')?target.querySelector('.search-passage:not([hidden])'):target;
    visible.classList.add('search-returned');
    const focus=visible.matches('a')?visible:visible.querySelector('a');focus?.focus({preventScroll:true});
    returnTimer=setTimeout(clearReturn,1250);
  }
  function clearMarks(){
    document.querySelectorAll('mark.search-hit').forEach(mark=>{const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent));parent.normalize();});
  }
  function cancel(){settleDisclosure();settleVersions();jumpId++;clearTimeout(jumpTimer);cancelAnimationFrame(jumpFrame);intentOff();intentOff=()=>{};clearMarks();clearReturn();delete document.documentElement.dataset.searchJump;}
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
  header.querySelector('.search-open').addEventListener('click',()=>{header.classList.add('is-open');header.querySelector('.search-open').setAttribute('aria-expanded','true');syncSearchAccess();input.focus({preventScroll:true});});
  const outsideSearch=target=>!header.contains(target)&&!target?.closest?.('[data-set-lang]');
  const closeSearch=()=>{header.classList.remove('is-open');header.querySelector('.search-open').setAttribute('aria-expanded','false');syncSearchAccess();};
  compactSearch.addEventListener('change',syncSearchAccess);
  syncSearchAccess();
  // A language change retains the open field and its input as part of the page.
  header.addEventListener('focusout',()=>{requestAnimationFrame(()=>{if(outsideSearch(document.activeElement))closeSearch();});});
  document.addEventListener('pointerdown',event=>{if(header.classList.contains('is-open')&&outsideSearch(event.target))closeSearch();});
  document.addEventListener('focusin',event=>{if(header.classList.contains('is-open')&&outsideSearch(event.target))closeSearch();});
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){closeSearch();header.querySelector('.search-open').focus({preventScroll:true});}});
  page.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(!link||!link.closest('.search-result')||!new URLSearchParams(link.hash.split('?')[1]||'').has('hit'))return;
    lastOpened={query,key:link.closest('[data-reading-key]').dataset.readingKey};
  });
  window.SiteSearch=Object.freeze({render,sync,cancel,jump,remember,recalled,prepareReturn,restorePosition,announceReturn});
})();
