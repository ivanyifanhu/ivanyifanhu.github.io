/* Preserve the reading passage while a temporary, inert text ribbon changes language. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let serial = 0;
  let sheetSerial = 0;
  let running = null;

  const visible = element => {
    if (!element || element.closest('[hidden]')) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open && !element.closest('summary')) return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const readingTop = () => {
    const configured = parseFloat(getComputedStyle(root).getPropertyValue('--reading-top'));
    const bar = document.querySelector('.topbar, .site-header');
    return Math.max(Number.isFinite(configured) ? configured : 110,
      (bar?.getBoundingClientRect().bottom || 0) + 16);
  };
  const clamp = (number, lower, upper) => Math.max(lower, Math.min(upper, number));
  const keyed = element => element.dataset.readingKey || element.dataset.source;

  function candidates(page) {
    const selector = '[data-reading-key], [data-source], h1, h2, h3, h4, .detail-meta, .work-row, .blog-row, .profile-head, .detail-illustration, .article-nav, .article-bottom, .download-row';
    return [...page.querySelectorAll(selector)].filter(visible).map((element, index) => ({
      element,
      key: keyed(element) || `layout:${element.tagName}:${index}`
    }));
  }

  // Range rects follow actual wrapped lines, including rich text and links.
  // Child source blocks have their own anchors and must not be counted twice.
  function linesOf(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.textContent.trim() || !visible(parent)) return NodeFilter.FILTER_REJECT;
        const block = parent.closest('[data-reading-key], [data-source]');
        if (block && block !== element && element.contains(block)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const rects = [];
    let node;
    while ((node = walker.nextNode())) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) rects.push({top: rect.top, bottom: rect.bottom});
      }
    }
    rects.sort((a, b) => a.top - b.top);
    const lines = [];
    rects.forEach(rect => {
      const previous = lines.at(-1);
      if (previous && Math.abs(previous.top - rect.top) < 3) previous.bottom = Math.max(previous.bottom, rect.bottom);
      else lines.push({...rect});
    });
    return lines;
  }

  function capture(page) {
    const scroll = window.scrollY;
    if(page.dataset.section==='search')return {scroll};
    const maximum = Math.max(0, root.scrollHeight - window.innerHeight);
    if (scroll <= 1) return {edge: 'top'};
    if (maximum > 0 && maximum - scroll <= 3) return {edge: 'bottom'};
    const top = readingTop();
    const list = candidates(page).map(item => ({...item, rect: item.element.getBoundingClientRect()}));
    // Pick the smallest semantic block crossing the first readable line. In a
    // gap between paragraphs, use the next paragraph and retain its spacing.
    const crossing = list.filter(item => item.rect.top <= top && item.rect.bottom > top);
    crossing.sort((a, b) => a.rect.height - b.rect.height);
    const following = list.filter(item => item.rect.top > top).sort((a, b) => a.rect.top - b.rect.top || a.rect.height - b.rect.height);
    const selected = crossing[0] || following[0] || list.at(-1);
    if (!selected) return {scroll};
    const lines = linesOf(selected.element);
    const lineIndex = lines.findIndex(line => line.bottom > top + 1);
    if (lineIndex >= 0) {
      return {
        key: selected.key,
        element: selected.element,
        lineProgress: lines.length > 1 ? lineIndex / (lines.length - 1) : 0,
        viewportY: lines[lineIndex].top,
        scroll
      };
    }
    const progress = selected.rect.top < top ? clamp((top - selected.rect.top) / selected.rect.height, 0, 1) : 0;
    return {
      key: selected.key,
      element: selected.element,
      blockProgress: progress,
      viewportY: selected.rect.top + progress * selected.rect.height,
      scroll
    };
  }

  function restore(page, anchor) {
    if (!page?.isConnected || !visible(page)) return;
    if (anchor.edge) {
      window.scrollTo({top: anchor.edge === 'top' ? 0 : root.scrollHeight - innerHeight, behavior: 'instant'});
      return;
    }
    const list = candidates(page);
    const match = list.find(item => item.key === anchor.key);
    const element = match?.element || (visible(anchor.element) ? anchor.element : null);
    if (!element) {
      window.scrollTo({top: anchor.scroll || 0, behavior: 'instant'});
      return;
    }
    const rect = element.getBoundingClientRect();
    let destinationY = rect.top;
    if (anchor.lineProgress !== undefined) {
      const lines = linesOf(element);
      if (lines.length) destinationY = lines[Math.round(anchor.lineProgress * (lines.length - 1))].top;
    } else destinationY += (anchor.blockProgress || 0) * rect.height;
    const position = window.scrollY + destinationY - anchor.viewportY;
    window.scrollTo({top: clamp(position, 0, Math.max(0, root.scrollHeight - innerHeight)), behavior: 'instant'});
  }

  function captureDisclosures(page) {
    return new Map([...page.querySelectorAll('details')]
      .filter(element => !element.closest('[data-lang][hidden]'))
      .map((element, index) => [keyed(element) || `details:${index}`, element.open]));
  }
  function restoreDisclosures(page, states) {
    [...page.querySelectorAll('details')].filter(element => !element.closest('[data-lang][hidden]')).forEach((element, index) => {
      const key = keyed(element) || `details:${index}`;
      if (states.has(key)) element.open = states.get(key);
    });
  }

  // A single viewport coordinate system makes images, rich text, navigation and
  // page furniture move as one sheet. No element is excluded for containing an
  // image: the earlier text-only selection was the source of stationary rows.
  const snapshotProperties = [
    'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear', 'overflow', 'overflow-x', 'overflow-y',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-feature-settings',
    'font-variation-settings', 'font-optical-sizing', 'line-height', 'letter-spacing', 'word-spacing',
    'color', 'text-align', 'text-indent', 'text-transform', 'text-decoration', 'text-decoration-color',
    'text-decoration-thickness', 'text-underline-offset', 'text-wrap', 'white-space', 'word-break',
    'overflow-wrap', 'direction', 'writing-mode', 'vertical-align', 'visibility', 'opacity',
    'margin', 'padding', 'border', 'border-radius', 'outline', 'outline-offset', 'box-shadow',
    'background', 'background-size', 'background-position', 'background-repeat', 'background-clip',
    'mask-image', 'mask-size', 'mask-position', 'mask-repeat', '-webkit-mask-image',
    'grid-template-columns', 'grid-template-rows', 'grid-area', 'grid-auto-flow',
    'align-items', 'align-self', 'justify-content', 'justify-items', 'justify-self', 'place-items',
    'gap', 'flex-direction', 'flex-wrap', 'flex', 'order', 'list-style', 'object-fit', 'object-position',
    'aspect-ratio', 'transform', 'transform-origin', 'filter', 'clip-path', 'fill', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset'
  ];
  const atomic = 'h1,h2,h3,h4,h5,h6,p,blockquote,summary,button,input,textarea,select,figure,svg,canvas,img,video,picture,.search-picture,.search-passage-slot,.search-match-language,.cv-date,.detail-meta,.work-links,.profile-links,.table-scroll';
  const intersects = rect => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;

  function origin(page) {
    if(page.id==='entry'){
      const art=page.querySelector('.cover-art').getBoundingClientRect();
      return {x:art.left+art.width/2,y:art.bottom-16,cover:true};
    }
    const rect = document.querySelector('.topbar > .languages')?.getBoundingClientRect();
    return rect ? {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2} : {x: 82, y: 32};
  }

  function snapshot(element, rect, {shallow = false, header = false} = {}, paint) {
    let clone = element.cloneNode(!shallow);
    // A shallow DETAILS node creates the browser's localized default summary.
    // It is only a painted border in the snapshot, so use a neutral box.
    if(shallow&&element.tagName==='DETAILS'){
      clone=document.createElement('div');
      [...element.attributes].forEach(attribute=>clone.setAttribute(attribute.name,attribute.value));
    }
    // Do not recapture outgoing chrome ribbons when staging the next locale.
    clone.querySelectorAll('.language-sheet-layer').forEach(node=>node.remove());
    const sources = shallow ? [element] : [element, ...element.querySelectorAll('*')].filter(node=>!node.closest('.language-sheet-layer'));
    const copies = shallow ? [clone] : [clone, ...clone.querySelectorAll('*')];
    const omitted = new Set();
    sources.forEach((source, index) => {
      const copy = copies[index];
      if (omitted.has(source.parentElement)) { omitted.add(source); return; }
      const computed = getComputedStyle(source);
      // Hidden translations still reserve their grid cell, but their text and
      // descendants never need to be copied into every animation ribbon.
      if (source !== element && (computed.display === 'none' || computed.visibility === 'hidden')) {
        omitted.add(source);
        copy.replaceChildren();
      }
      if (paint) {
        // All ribbons share the same frozen paint rules. Repeating hundreds of
        // inline declarations in every ribbon made incoming pages expensive to
        // parse and rasterize, letting their animation clock run ahead of paint.
        const declarations = snapshotProperties.map(property => `${property}:${computed.getPropertyValue(property)}!important`).join(';');
        let key = paint.keys.get(declarations);
        if (!key) {
          key = `${paint.id}-${paint.rules.length}`;
          paint.keys.set(declarations,key);
          paint.rules.push(`[data-language-paint="${key}"]{${declarations}}`);
        }
        copy.dataset.languagePaint = key;
      } else snapshotProperties.forEach(property => copy.style.setProperty(property, computed.getPropertyValue(property), 'important'));
      // The source classes retain pseudo-elements (search icon, active rules,
      // cover print texture); geometry and language-dependent styles are frozen.
      ['id', 'for', 'name', 'data-lang', 'data-set-lang', 'data-reading-key', 'data-source'].forEach(attribute => copy.removeAttribute(attribute));
      [...copy.attributes].filter(attribute => attribute.name.startsWith('on')).forEach(attribute => copy.removeAttribute(attribute.name));
      copy.removeAttribute('hidden');
      copy.setAttribute('tabindex', '-1');
      copy.style.setProperty('animation', 'none', 'important');
      copy.style.setProperty('transition', 'none', 'important');
      copy.style.setProperty('pointer-events', 'none', 'important');
      if(source.scrollTop||source.scrollLeft){
        copy.dataset.languageScrollTop=String(source.scrollTop);
        copy.dataset.languageScrollLeft=String(source.scrollLeft);
      }
      if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement) copy.value = source.value;
      if (source instanceof HTMLImageElement) {
        // Freeze the already-decoded pixels before hiding the original. Cloned
        // IMG nodes can defer decoding until after the fold's first frame.
        if(source.complete&&source.naturalWidth){
          const bitmap=document.createElement('canvas');
          [...copy.attributes].forEach(attribute=>bitmap.setAttribute(attribute.name,attribute.value));
          const size=source.getBoundingClientRect();
          const scale=Math.min(1,Math.max(32,Math.min(1024,size.width*1.25))/source.naturalWidth);
          bitmap.width=Math.max(1,Math.round(source.naturalWidth*scale));
          bitmap.height=Math.max(1,Math.round(source.naturalHeight*scale));
          try{
            bitmap.getContext('2d').drawImage(source,0,0,bitmap.width,bitmap.height);
            if(copy===clone)clone=bitmap;else copy.replaceWith(bitmap);
          }catch{copy.loading='eager';copy.src=source.currentSrc||source.src;}
        }
      }
      if (source instanceof HTMLCanvasElement) {
        // Canvas.cloneNode() has an empty bitmap. Preserve the current painted
        // frame directly, with no asynchronous image decode at the handover.
        try { copy.getContext('2d')?.drawImage(source, 0, 0); } catch { /* The original fallback image remains underneath. */ }
      }
    });
    Object.assign(clone.style, {position: 'absolute', left: `${rect.left}px`, top: `${rect.top}px`});
    const fixed = {'position':'absolute','left':`${rect.left}px`,'top':`${rect.top}px`,'right':'auto','bottom':'auto',
      'width':`${rect.width}px`,'height':`${rect.height}px`,'min-width':'0','min-height':'0','max-width':'none','max-height':'none',
      'margin':'0','transform':'none','z-index':'auto','box-sizing':'border-box'};
    Object.entries(fixed).forEach(([property,value]) => clone.style.setProperty(property,value,'important'));
    clone.style.setProperty('isolation','isolate','important');
    if (header) {
      clone.style.setProperty('background','transparent','important');
      clone.querySelectorAll('.languages').forEach(control => control.style.setProperty('opacity','0','important'));
    }
    return clone;
  }

  function collectPieces(page, paint) {
    const pieces = [];
    const add = (element, options) => {
      if (!element || !visible(element)) return;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      const rect = element.getBoundingClientRect();
      if (!intersects(rect)) return;
      let paintTop=rect.top-2,paintBottom=rect.bottom+2;
      if(options?.header){
        // Mobile search fields may extend below the header's own box.
        [...element.querySelectorAll('*')].filter(child=>!child.closest('.language-sheet-layer')&&visible(child)).forEach(child=>{
          const childRect=child.getBoundingClientRect();
          paintTop=Math.min(paintTop,childRect.top);paintBottom=Math.max(paintBottom,childRect.bottom);
        });
      }
      const master=snapshot(element,rect,options,paint);
      pieces.push({rect,paintTop,paintBottom,master,source:element,plane:options?.plane,header:options?.header});
    };
    const visit = element => {
      if (!visible(element)) return;
      const rect = element.getBoundingClientRect();
      if (!intersects(rect)) return;
      const computed = getComputedStyle(element);
      if (computed.visibility === 'hidden' || computed.display === 'none') return;
      const directText = [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (element.matches(atomic) || !element.children.length || directText) { add(element); return; }
      // Preserve a container's own paint without cloning its entire long page.
      if (computed.backgroundImage !== 'none' || (computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && computed.backgroundColor !== 'transparent')
          || parseFloat(computed.borderTopWidth) || parseFloat(computed.borderBottomWidth) || computed.boxShadow !== 'none') add(element,{shallow:true});
      [...element.children].forEach(visit);
    };
    if (page.id === 'entry') {
      add(page.querySelector('.cover-prompt'));
      add(page.querySelector('.cover-quote'));
      add(page.querySelector('.cover-signature'));
    } else {
      add(document.querySelector('body > .game-texture'),{plane:true});
      visit(page);
      add(document.querySelector('#site-shell > footer'));
      add(document.querySelector('#flight-progress'));
      // Capture the bounded live veil, including an interrupted fade. This
      // preserves its exact opacity without duplicating spread shadows.
      add(document.querySelector('body > .toc-veil'),{plane:true});
      add(document.querySelector('#mobile-menu'));
      add(document.querySelector('.reading-toc'));
      // Chrome folds above the live header gradient; body ribbons stay below.
      // Occluded content can never burst through the stationary gradient veil.
      add(document.querySelector('.topbar'), {header:true});
    }
    return pieces;
  }

  // cloneNode does not copy canvas pixels, even when cloning an already painted
  // master. Copy them before the strip is ever attached to the visible layer.
  function duplicate(master) {
    const copy = master.cloneNode(true);
    const sources = master.matches('canvas') ? [master] : [...master.querySelectorAll('canvas')];
    const canvases = copy.matches('canvas') ? [copy] : [...copy.querySelectorAll('canvas')];
    sources.forEach((source,index) => { try {canvases[index].getContext('2d')?.drawImage(source,0,0);} catch {} });
    const inputs = master.matches('input,textarea') ? [master] : [...master.querySelectorAll('input,textarea')];
    const fields = copy.matches('input,textarea') ? [copy] : [...copy.querySelectorAll('input,textarea')];
    inputs.forEach((source,index)=>{fields[index].value=source.value;});
    return copy;
  }

  const smooth = value => value * value * (3 - 2 * value);
  function rowAt(y, width, height, point, phase) {
    const position = point.cover ? clamp((y-point.textTop)/Math.max(1,point.textBottom-point.textTop),0,1) : clamp(y / height,0,1);
    const lag = .23 * position;
    const progress = clamp((phase - lag) / (1 - lag),0,1);
    const gather = smooth(clamp(progress / .92,0,1));
    const travel = smooth(clamp((progress - .09) / .91,0,1));
    const curve = point.cover ? 0 : Math.sin(progress * Math.PI) * (1-position) * Math.min(76,height*.085);
    return {x:width/2+(point.x-width/2)*gather+curve,y:y+(point.y-y)*travel,width:width*(1-.997*gather)};
  }
  function ribbonFrame(top, height, width, viewportHeight, point, phase) {
    const upper = rowAt(top,width,viewportHeight,point,phase);
    const lower = rowAt(top+height,width,viewportHeight,point,phase);
    const opacity=phase>.94 ? 1-smooth((phase-.94)/.06) : 1;
    if (!point.cover) {
      // A trapezoid has different widths at its upper and lower edge. The old
      // affine approximation used their average and left visible seams across
      // images. Perspective maps both shared boundaries to their exact points.
      const ratio=upper.width/lower.width;
      const left=upper.x-upper.width/2;
      const lowerLeft=lower.x-lower.width/2;
      const lowerY=Math.max(upper.y+height*.002,lower.y);
      // Keep viewport translation outside the projective matrix. Combining
      // them makes m22 cross zero near the tip, so WAAPI's matrix decomposition
      // interpolates through a flipped sheet between otherwise valid frames.
      // This equivalent local matrix has positive scales for the entire fold;
      // both directions interpolate the same continuous transform functions.
      const transform=`translate(${left}px,${upper.y}px) matrix3d(${upper.width/width},0,0,0,${ratio*(lowerLeft-left)/height},${ratio*(lowerY-upper.y)/height},0,${(ratio-1)/height},0,0,1,0,0,0,0,1)`;
      return {transform,opacity};
    }
    const scaleX = (upper.width+lower.width)/(width*2);
    const scaleY = Math.max(.002,(lower.y-upper.y)/height);
    const skew = (lower.x-upper.x)/height;
    // Vertical boundaries share the exact same trajectory, so adjacent strips
    // remain joined rather than opening white gaps while the sheet bends.
    const transform = `matrix(${scaleX},0,${skew},${scaleY},${upper.x-width*scaleX/2},${upper.y})`;
    return {transform,opacity};
  }

  function makeSheet(page) {
    const layer = document.createElement('div');
    const cover=page.id==='entry';
    layer.className = 'language-sheet-layer'+(cover?' language-sheet-layer--cover':'');
    layer.setAttribute('aria-hidden','true');
    layer.inert = true;
    layer.style.backgroundColor = cover ? 'transparent' : getComputedStyle(document.body).backgroundColor;
    const headerLayer=cover?null:document.createElement('div');
    if(headerLayer){
      headerLayer.className='language-sheet-layer language-header-sheet';
      headerLayer.setAttribute('aria-hidden','true');headerLayer.inert=true;
    }
    const width = innerWidth, height = innerHeight;
    const paint = cover ? null : {id:`s${++sheetSerial}`,rules:[],keys:new Map()};
    const pieces = collectPieces(page,paint);
    const bands = [];
    const topEdge=cover?Math.max(0,Math.floor(Math.min(...pieces.map(piece=>piece.paintTop)))):0;
    const bottomEdge=cover?Math.min(height,Math.ceil(Math.max(...pieces.map(piece=>piece.paintBottom)))):height;
    const bandSize = cover?6:Math.max(16,Math.ceil(height/(width<=800?34:44)));
    const overlap = cover?.45:1.2;
    const fragment = document.createDocumentFragment(),headerFragment=document.createDocumentFragment();
    for (let top=topEdge; top<bottomEdge; top+=bandSize) {
      const bandHeight = Math.min(bandSize,bottomEdge-top);
      const strip = document.createElement('div');
      strip.className = 'language-sheet-strip';
      strip.style.width = `${width}px`;
      strip.style.height = `${bandHeight+overlap}px`;
      strip.style.transform = `translateY(${top}px)`;
      let headerStrip;
      pieces.forEach(({rect,paintTop,paintBottom,master,plane,header}) => {
        if (paintBottom<=top || paintTop>=top+bandHeight+overlap) return;
        const copy=duplicate(master);
        if(plane){
          // Fixed repeating paper texture/veil: rasterize only this ribbon's
          // height, rather than 34 full-screen masked layers at device DPR.
          copy.style.setProperty('top','0','important');
          copy.style.setProperty('height',`${bandHeight+overlap}px`,'important');
          copy.style.setProperty('background-position',`center ${-top}px`,'important');
        }else copy.style.setProperty('top',`${rect.top-top}px`,'important');
        if(header){
          if(!headerStrip)headerStrip=strip.cloneNode(false);
          headerStrip.append(copy);
        }else strip.append(copy);
      });
      fragment.append(strip);
      bands.push({strip,top,height:bandHeight+overlap});
      if(headerStrip){headerFragment.append(headerStrip);bands.push({strip:headerStrip,top,height:bandHeight+overlap});}
    }
    if (paint) {
      const stylesheet = document.createElement('style');
      stylesheet.textContent = paint.rules.join('\n');
      layer.append(stylesheet);
    }
    layer.append(fragment);
    headerLayer?.append(headerFragment);
    layer.dataset.pieces=String(pieces.length);
    layer.dataset.bands=String(bands.length);
    return {layer,headerLayer,bands,width,height,host:cover?page:document.body,point:{...origin(page),textTop:topEdge,textBottom:bottomEdge}};
  }

  function mountSheet(sheet) {
    sheet.host.append(sheet.layer);
    if(sheet.headerLayer)document.querySelector('.topbar').append(sheet.headerLayer);
    // Scroll offsets can be set only after the clone has a real layout box.
    // Doing so in this same task keeps a scrolled TOC/table from flashing its
    // first item at the instant the animation layer replaces the source.
    sheet.layer.querySelectorAll('[data-language-scroll-top]').forEach(element=>{
      element.scrollTop=Number(element.dataset.languageScrollTop)||0;
      element.scrollLeft=Number(element.dataset.languageScrollLeft)||0;
    });
  }

  async function animateSheet(state, sheet, entering) {
    const cover = sheet.point.cover;
    const duration = cover ? (entering?810:670) : (entering?540:440);
    const animations = sheet.bands.map(({strip,top,height}) => {
      const frames = Array.from({length:33},(_,index)=>{
        const phase=entering?1-index/32:index/32;
        return {...ribbonFrame(top,height,sheet.width,sheet.height,sheet.point,phase),offset:index/32};
      });
      const animation=strip.animate(frames,{duration,easing:cover?(entering?'cubic-bezier(.20,.58,.26,1)':'cubic-bezier(.42,0,.44,1)'):'linear',fill:'both'});
      if (!cover) { animation.pause(); animation.currentTime = 0; }
      state.animations.add(animation);
      return animation;
    });
    if (!cover) {
      // Commit the starting geometry before starting the clocks, especially
      // when a translated sheet is emerging from its almost invisible tip.
      // The trajectory already eases in rowAt; easing it twice caused a snap.
      await nextFrame();
      await nextFrame();
      if (running !== state || state.layer !== sheet.layer) return;
      animations.forEach(animation => animation.play());
    }
    return Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
  }
  function clearSheet(state) {
    // Detach before cancelling fill styles, so the compositor can never show
    // an outgoing strip at its full-size underlying geometry for a frame.
    state.layer?.remove();
    state.layer=null;
    state.headerLayer?.remove();state.headerLayer=null;
    state.staging?.layer.remove();state.staging?.headerLayer?.remove();
    state.staging=null;
    state.animations.forEach(animation=>animation.cancel());
    state.animations.clear();
  }
  function reveal(state) {
    // Layer removal and source reveal occur synchronously in one task, before
    // the next browser paint. There is no frame with both copies on screen.
    clearSheet(state);
    delete root.dataset.languageCurtain;
  }
  function cancel() {
    serial+=1;
    if(running){reveal(running);running.detach();running=null;}
    delete root.dataset.languageCurtain;
    delete root.dataset.languageTransition;
  }
  function watchUserIntent(state) {
    const intent=event=>{
      if(event.type==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))return;
      if(event.type==='pointerdown'&&event.target.closest('[data-set-lang]'))return;
      state.userMoved=true;
    };
    const events=['wheel','touchmove','pointerdown','keydown'];
    events.forEach(type=>window.addEventListener(type,intent,{passive:true}));
    state.detach=()=>events.forEach(type=>window.removeEventListener(type,intent));
  }
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

  async function change({value,page,apply,animate=true,onSettled}={}) {
    cancel();
    if(!page||typeof apply!=='function')return;
    const state={id:serial,animations:new Set(),layer:null,headerLayer:null,staging:null,detach:()=>{},userMoved:false};
    running=state;
    const current=()=>running===state&&serial===state.id;
    const anchor=capture(page),disclosures=captureDisclosures(page);
    watchUserIntent(state);
    try {
      const moving=animate&&!reducedMotion.matches&&typeof Element.prototype.animate==='function';
      const cover=page.id==='entry';
      let outgoingMotion;
      if(moving){
        const outgoing=makeSheet(page);
        state.layer=outgoing.layer;state.headerLayer=outgoing.headerLayer;
        // Assemble everything first, then atomically replace the live surface.
        // Warm the outgoing ribbons while the live document remains visible.
        // Only switch surfaces after two paints; this also avoids Safari's
        // first-frame canvas upload flash on large project illustrations.
        outgoing.layer.style.opacity='.002';
        if(!cover)outgoing.layer.style.zIndex='80';
        if(outgoing.headerLayer)outgoing.headerLayer.style.opacity='.002';
        mountSheet(outgoing);
        await nextFrame();await nextFrame();
        if(!current())return;
        outgoing.layer.style.removeProperty('opacity');outgoing.headerLayer?.style.removeProperty('opacity');
        root.dataset.languageCurtain=cover?'cover':'page';
        outgoing.layer.style.removeProperty('z-index');
        root.dataset.languageTransition='out';
        outgoingMotion=animateSheet(state,outgoing,false);
        if(cover)await outgoingMotion;
        else {
          // Give the old sheet its first moving frame, then prepare the new
          // language behind it while the compositor continues the fold. This
          // keeps snapshot/layout work out of the empty midpoint.
          await nextFrame();
          await nextFrame();
          await nextFrame();
        }
        if(!current())return;
      }
      const result=apply(value);
      if(result&&typeof result.then==='function')await result;
      if(!current())return;
      restoreDisclosures(page,disclosures);
      if(!state.userMoved)restore(page,anchor);
      if(moving){
        // applyLanguage queues the refreshed TOC. The old sheet and its opaque
        // backdrop stay present while that queued layout and snapshot settle.
        await nextFrame();
        if(!current())return;
        // Reading metrics and snapshots use the unhidden source styles, but no
        // paint occurs between this removal and re-applying the curtain below.
        delete root.dataset.languageCurtain;
        if(!state.userMoved)restore(page,anchor);
        const incoming=makeSheet(page);
        root.dataset.languageCurtain=cover?'cover':'page';
        if(!cover){
          // Preparing a detached DOM tree does not paint it. Rasterize the real
          // incoming bands at full size while the old sheet is still folding;
          // nonzero opacity prevents the compositor from culling this surface.
          state.staging=incoming;
          incoming.layer.style.opacity='.002';incoming.headerLayer.style.opacity='.002';
          incoming.layer.style.zIndex='301';
          incoming.layer.dataset.languagePrepared='warming';
          mountSheet(incoming);
          await nextFrame();
          await nextFrame();
          if(!current())return;
          incoming.layer.dataset.languagePrepared='ready';
        }
        await outgoingMotion;
        if(!current())return;
        root.dataset.languageTransition='in';
        state.staging=null;
        clearSheet(state);
        state.layer=incoming.layer;state.headerLayer=incoming.headerLayer;
        if(!incoming.layer.isConnected)mountSheet(incoming);
        // Install the collapsed first frame before making the prepared sheet
        // visible. No full-size incoming surface is exposed at the handoff.
        const incomingMotion=animateSheet(state,incoming,true);
        incoming.layer.style.removeProperty('opacity');incoming.headerLayer?.style.removeProperty('opacity');
        await incomingMotion;
        if(!current())return;
      }
      if(!state.userMoved)restore(page,anchor);
      onSettled?.();
      // This is the only reveal point; callbacks and the final anchor correction
      // are finished while the source is still concealed.
      reveal(state);
      delete root.dataset.languageTransition;
      const fontReady=document.fonts?.ready||Promise.resolve();
      fontReady.then(()=>{
        if(!current())return;
        if(!state.userMoved)restore(page,anchor);
        state.detach();running=null;
      });
    }catch(error){
      if(current()){reveal(state);state.detach();delete root.dataset.languageTransition;running=null;}
      throw error;
    }
  }
  window.LanguageFlow=Object.freeze({change,cancel});
})();
