/* =========================================================
   Tier Maker — Unified JavaScript
   - Hardened init (always render rows/tokens)
   - Robust export (CORS image conversion, retries, blank-canvas guard)
   - Compact mobile picker with colored options (match tier label colors)
   - Memory leak fixes, defensive guards, a11y touch-ups
   - Full reset on Clear
========================================================= */

(function(){
  'use strict';

  /* ---------- Tiny diagnostics (safe in prod; shows last error in a small toast) ---------- */
  (function(){
    var box = document.createElement('div');
    box.id = 'diag';
    box.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;background:#111;color:#fff;font:12px/1.4 monospace;padding:8px 10px;border-radius:8px;opacity:.0;pointer-events:none;transition:opacity .2s';
    document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(box));
    function say(msg){ try{ console.log('[TierMaker]', msg); box.textContent = String(msg); box.style.opacity = .92; setTimeout(()=>box.style.opacity = 0, 4200);}catch(_){/*noop*/} }
    window.__say = say;
    window.addEventListener('error', e => say('JS error: ' + (e.message||e.error||'unknown')));
    window.addEventListener('unhandledrejection', e => say('Promise rejection: ' + (e.reason && e.reason.message || e.reason || 'unknown')));
  })();

  /* ---------- Polyfills ---------- */
  (function () {
    if (!String.prototype.padStart) {
      String.prototype.padStart = function (t, p) {
        t = t >> 0; p = String(p || ' ');
        if (this.length >= t) return String(this);
        t = t - this.length;
        if (t > p.length) p += p.repeat(Math.ceil(t / p.length));
        return p.slice(0, t) + String(this);
      };
    }
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function (s) {
          var m = (this.document || this.ownerDocument).querySelectorAll(s), i = m.length;
          while (--i >= 0 && m.item(i) !== this) {}
          return i > -1;
        };
    }
    if (!Element.prototype.closest) {
      Element.prototype.closest = function (s) {
        var el = this;
        if (!document.documentElement.contains(el)) return null;
        do { if (el.matches(s)) return el; el = el.parentElement || el.parentNode; }
        while (el && el.nodeType === 1);
        return null;
      };
    }
  })();

  /* ---------- Event helpers ---------- */
  var _supportsPassive = false;
  try {
    var _opts = Object.defineProperty({}, 'passive', { get: function(){ _supportsPassive = true; } });
    window.addEventListener('x', null, _opts); window.removeEventListener('x', null, _opts);
  } catch(e){}
  function on(el, t, h, o){ if(!el) return;
    if (!o) { el.addEventListener(t, h, false); return; }
    if (typeof o === 'object' && !_supportsPassive) el.addEventListener(t, h, !!o.capture);
    else el.addEventListener(t, h, o);
  }
  function once(el, t, h, o){ function w(e){ el.removeEventListener(t,w,o||false); h(e);} el.addEventListener(t,w,o||false); }

  /* ---------- Dom utils ---------- */
  var $  = function (s, ctx){ return (ctx||document).querySelector(s); };
  var $$ = function (s, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); };
  function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
  function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function isSmall(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }
  function isDesktopWide(){ return window.matchMedia && window.matchMedia('(min-width: 1025px)').matches; }
  function debounce(fn, ms){ var t; return function(){ clearTimeout(t); t=setTimeout(fn, ms); }; }

  /* ---------- Live region ---------- */
  function ensureLive(){
    var n = $('#live');
    if (!n) {
      n = document.createElement('div');
      n.id='live'; n.setAttribute('aria-live','polite'); n.className='sr';
      document.body.appendChild(n);
    }
    return n;
  }
  function announce(msg){ var n=ensureLive(); n.textContent=''; setTimeout(function(){ n.textContent=msg; },0); }

  /* ---------- Vibration ---------- */
  function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }

  /* ---------- Colors ---------- */
  function clamp8(v){ v = Math.floor(v); if (v<0) return 0; if (v>255) return 255; return v; }
  function hexToRgb(hex){
    var h=(hex||'').replace('#',''); if(!h) return {r:0,g:0,b:0};
    if(h.length===3){ h=h.split('').map(function(x){return x+x;}).join(''); }
    var n=parseInt(h,16); if (isNaN(n)) return {r:0,g:0,b:0};
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }
  function rgbToHex(r,g,b){ return '#'+[clamp8(r),clamp8(g),clamp8(b)].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
  function relativeLuminance(rgb){ function srgb(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); } return 0.2126*srgb(rgb.r)+0.7152*srgb(rgb.g)+0.0722*srgb(rgb.b); }
  function contrastColor(bgHex){ var L=relativeLuminance(hexToRgb(bgHex)); return L>0.58 ? '#000000' : '#ffffff'; }
  function darken(hex,p){ var c=hexToRgb(hex); var f=(1-(p||0)); return rgbToHex(Math.round(c.r*f),Math.round(c.g*f),Math.round(c.b*f)); }
  function lighten(hex,p){ var c=hexToRgb(hex), f=p||0; return rgbToHex(Math.round(c.r+(255-c.r)*f), Math.round(c.g+(255-c.g)*f), Math.round(c.b+(255-c.b)*f)); }
  function mixHex(aHex,bHex,t){ var a=hexToRgb(aHex), b=hexToRgb(bHex);
    return rgbToHex(
      Math.round(a.r+(b.r-a.r)*t),
      Math.round(a.g+(b.g-a.g)*t),
      Math.round(a.b+(b.b-a.b)*t)
    );
  }

  /* ---------- Globals in closure ---------- */
  var board=null, tray=null;

  /* =========================================================
     ICONS (Kalai-ish, unified) + swapper (will be swapped to your set)
  ========================================================= */
  var ICONS = {
    add:      { vb:'0 0 24 24', d:'M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1z' },
    menu:     { vb:'0 0 24 24', d:'M4 7h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2zm0 5h16a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2zm0 5h16a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2z' },
    undo:     { vb:'0 0 24 24', d:'M12 5v3l-4-4 4-4v3c5.523 0 10 4.477 10 10a10 10 0 0 1-10 10H6v-2h6a8 8 0 0 0 0-16z' },
    trash:    { vb:'0 0 24 24', d:'M9 3h6l1 2h4a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h4l1-2zm2 6a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1z' },
    download: { vb:'0 0 24 24', d:'M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V4a1 1 0 0 1 1-1zM4 19a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z' },
    close:    { vb:'0 0 24 24', d:'M6.7 5.3 5.3 6.7 10.6 12l-5.3 5.3 1.4 1.4L12 13.4l5.3 5.3 1.4-1.4L13.4 12l5.3-5.3-1.4-1.4L12 10.6 6.7 5.3z' },
    // Pencil-fill from requested source (normalized path for size)
    pencil:   { vb:'0 0 16 16', d:'M12.854 1.146a.5.5 0 0 1 .0 .708l-1.5 1.5 1.292 1.292 1.5-1.5a.5.5 0 0 1 .708.708l-8.5 8.5a.5.5 0 0 1-.168.11l-4 1.5a.5.5 0 0 1-.65-.65l1.5-4a.5.5 0 0 1 .11-.168l8.5-8.5a.5.5 0 0 1 .708 0ZM11.5 3.207 12.793 4.5 5.854 11.439l-1.293-1.293L11.5 3.207ZM4.146 10.146l1.293 1.293-2.025.759.732-2.052z' }
  };
  function setIcon(container, name, title){
    if(!container) return;
    var spec = ICONS[name]; if(!spec) return;
    container.innerHTML =
      '<svg viewBox="'+spec.vb+'" aria-hidden="true" role="img" focusable="false">' +
        '<title>'+(title || name)+'</title>' +
        '<path d="'+spec.d+'"/>' +
      '</svg>';
  }
  function swapAllIcons(){
    setIcon($('#addTierBtn .ico'),'add','Add');
    setIcon($('#undoBtn .ico'),'undo','Undo');
    setIcon($('#trashClear .ico'),'trash','Clear board');
    setIcon($('#saveBtn .ico'),'download','Save PNG');
    setIcon($('.title-pen'),'pencil','Edit title');
    setIcon($('#radialPicker .radial-close'),'close','Close');
  }

  /* ---------- FLIP helper ---------- */
  function flipZones(zones, mutate){
    var prev=new Map();
    try{
      zones.forEach(function(z){ $$('.token',z).forEach(function(t){ prev.set(t,t.getBoundingClientRect()); }); });
      mutate();
      requestAnimationFrame(function(){
        zones.forEach(function(z){
          $$('.token',z).forEach(function(t){
            var r2=t.getBoundingClientRect(), r1=prev.get(t); if(!r1) return;
            var dx=r1.left-r2.left, dy=r1.top-r2.top;
            if(dx||dy){
              t.classList.add('flip-anim');
              t.style.transform='translate('+dx+'px,'+dy+'px)';
              requestAnimationFrame(function(){
                t.style.transform='translate(0,0)';
                setTimeout(function(){ t.classList.remove('flip-anim'); t.style.transform=''; },190); // match CSS 180ms + small buffer
              });
            }
          });
        });
        prev.clear(); // prevent memory leak
      });
    }catch(e){ try{ prev.clear(); }catch(_){ } }
  }

  /* ---------- Row DOM ---------- */
  function buildRowDom(){
    var row=document.createElement('div'); row.className='tier-row'; row.id=uid();

    var labelWrap=document.createElement('div'); labelWrap.className='tier-label';

    var handle=document.createElement('button');
    handle.className='row-handle';
    handle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><title>Reorder row</title><path d="M7 10h10v2H7zm0 4h10v2H7z"/></svg>';
    handle.type='button'; handle.title='Drag to reorder row'; handle.setAttribute('aria-label','Drag to reorder row');

    var chip=document.createElement('div');
    chip.className='label-chip';
    chip.setAttribute('contenteditable','true');
    chip.setAttribute('spellcheck','false');
    chip.setAttribute('role','textbox');
    chip.setAttribute('aria-label','Tier label (editable). Press Enter to finish.');
    chip.title='Click to edit label';

    var del=document.createElement('button'); del.className='row-del'; del.type='button';
    del.setAttribute('aria-label','Delete row');
    setIcon(del, 'close', 'Delete row');

    labelWrap.appendChild(handle);
    labelWrap.appendChild(chip);
    labelWrap.appendChild(del);

    var drop=document.createElement('div');
    drop.className='tier-drop dropzone'; drop.setAttribute('tabindex','0');

    row.appendChild(labelWrap); row.appendChild(drop);
    return { row: row, chip: chip, del: del, drop: drop, handle: handle, labelWrap: labelWrap };
  }
  function tintFrom(color){
    var surface = cssVar('--surface') || '#111219';
    var a=hexToRgb(surface), b=hexToRgb(color);
    var amt = 0.14;
    return rgbToHex(
      Math.round(a.r+(b.r-a.r)*amt),
      Math.round(a.g+(b.g-a.g)*amt),
      Math.round(a.b+(b.b-a.b)*amt)
    );
  }
  function rowLabel(row){ var chip=row?row.querySelector('.label-chip'):null; return chip?chip.textContent.replace(/\s+/g,' ').trim():'row'; }

  /* ---------- Chip text fitter (no-op during export) ---------- */
  var CHIP_STEPS=[34,32,28,26,24,22,20,18,16,14];
  function fitChipText(chip){
    if(!chip) return;
    if ((chip.closest && chip.closest('.exporting')) || document.documentElement.classList.contains('exporting')) return;

    var wrap = chip.parentElement; if (!wrap) return;
    chip.style.whiteSpace='normal';
    chip.style.lineHeight='1.15';
    chip.style.display='flex';
    chip.style.alignItems='center';
    chip.style.justifyContent='center';
    chip.style.textAlign='center';
    chip.style.overflow='hidden';

    var padding = 16;
    var maxW = wrap.clientWidth - padding; if (maxW < 40) maxW = wrap.clientWidth;
    var maxH = Math.max(wrap.clientHeight - padding, 110);

    for(var i=0;i<CHIP_STEPS.length;i++){
      var px = CHIP_STEPS[i];
      chip.style.fontSize = px+'px';
      if (chip.scrollWidth <= maxW && chip.scrollHeight <= maxH){
        break;
      }
    }
  }

  /* ---------- Create / wire a row ---------- */
  function createRow(cfg){
    var dom = buildRowDom();
    var node = dom.row, chip = dom.chip, del = dom.del, drop = dom.drop, handle = dom.handle, labelWrap=dom.labelWrap;

    chip.textContent = cfg.label;
    chip.dataset.color = cfg.color;

    labelWrap.style.background = cfg.color;
    labelWrap.dataset.color = cfg.color;
    chip.style.background = 'transparent';
    chip.style.color = contrastColor(cfg.color);

    del.style.background = darken(cfg.color, 0.35);

    var tint = tintFrom(cfg.color);
    drop.style.background = tint; drop.dataset.manual = 'false';

    fitChipText(chip);

    on(chip,'keydown', function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        chip.blur();
        // focus management: move to drop zone for keyboard flow
        try { drop && drop.focus && drop.focus(); } catch(_){}
      }
    });
    on(chip,'input', function(){ fitChipText(chip); queueAutosave(); });

    on(del,'click', function(){
      var ok = confirm('Delete this row? Items in it will return to the tray.');
      if(!ok) return;
      // Close radial if open to avoid stale buttons
      try { closeRadial(); } catch(_){}
      var tokens = $$('.token', drop);
      flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
      node.classList.add('removing');
      setTimeout(function(){ node.remove(); refreshRadialOptions(); queueAutosave();
        historyStack.push({type:'row-delete', rowHTML: node.outerHTML}); updateUndo();
      }, 190);
    });

    enableRowReorder(handle, node);
    enableClickToPlace(drop);
    return node;
  }

  /* ---------- Defaults ---------- */
  var defaultTiers = [
    { label:'S', color:'#ff6b6b' },
    { label:'A', color:'#f6c02f' },
    { label:'B', color:'#22c55e' },
    { label:'C', color:'#3b82f6' },
    { label:'D', color:'#a78bfa' }
  ];

  /* ---------- Tier cycle ---------- */
  var TIER_CYCLE = ['#ff6b6b','#f6c02f','#22c55e','#3b82f6','#a78bfa','#06b6d4','#e11d48','#16a34a','#f97316','#0ea5e9'];
  var tierIdx = 0; function nextTierColor(){ var c=TIER_CYCLE[tierIdx%TIER_CYCLE.length]; tierIdx++; return c; }

  /* ---------- Preset names (remove Keyon & Wobbles per request) ---------- */
  var communityCast = [
    "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
    "Gavin","Harry","Jay","Jeremy","Katie","Kiev","Kikki","Kyle","Lewis","Meegan",
    "Munch","Paper","Ray","Safoof","Temz","TomTom","V","Versse","Xavier"
  ];

  /* ---------- Palette (bold MD3-inspired; black-text friendly) ---------- */
  var BASE_PALETTE = [
    '#FFD600','#FFEA00','#FFE176','#FFC400',
    '#FF9100','#FF6D00','#FFAB40','#FFB300',
    '#FF5252','#FF4081','#FF80AB','#F06292',
    '#B388FF','#7C4DFF','#9575CD','#BA68C8',
    '#40C4FF','#00B0FF','#0091EA','#26C6DA','#4DD0E1',
    '#00E676','#1DE9B6','#69F0AE','#00C853','#A5D6A7',
    '#C6FF00','#AEEA00','#D4E157','#CDDC39'
  ];
  function contrastForBlack(hex){ var L=relativeLuminance(hexToRgb(hex)); return (L + 0.05) / 0.05; }
  function ensureForBlack(hex){
    var target = 4.2, safe = hex, steps=0;
    while (contrastForBlack(safe) < target && steps < 8){ safe = lighten(safe, 0.03); steps++; }
    var toned = mixHex(safe, hex, 0.20);
    var guard = 0;
    while (contrastForBlack(toned) < target && guard < 4){ toned = lighten(toned, 0.01); guard++; }
    return toned;
  }
  var presetPalette = BASE_PALETTE.map(ensureForBlack);
  var pIndex = 0; function nextPreset(){ var c=presetPalette[pIndex%presetPalette.length]; pIndex++; return c; }

  /* ---------- Token label fitter (no-op during export) ---------- */
  function fitLiveLabel(lbl){
    if (!lbl) return;
    if ((lbl.closest && lbl.closest('.exporting')) || document.documentElement.classList.contains('exporting')) return;
    var token = lbl.parentElement; if (!token) return;
    var D = token.clientWidth;
    var pad = 10;
    var s = lbl.style;
    s.whiteSpace='nowrap'; s.lineHeight='1'; s.display='flex';
    s.alignItems='center'; s.justifyContent='center';
    s.height='100%'; s.padding='0 '+pad+'px';
    s.wordBreak='normal'; s.hyphens='none'; s.overflow='hidden';
    var lo=Math.max(12,Math.floor(D*0.2)), hi=Math.floor(D*0.44), best=lo;
    function fits(px){ s.fontSize=px+'px'; return (lbl.scrollWidth<=D-pad*2) && (lbl.scrollHeight<=D-pad*2); }
    while(lo<=hi){ var mid=(lo+hi)>>1; if(fits(mid)){ best=mid; lo=mid+1; } else hi=mid-1; }
    s.fontSize=best+'px';
  }
  function refitAllLabels(){ $$('.token .label').forEach(fitLiveLabel); }
  function refitAllChips(){ $$('.label-chip').forEach(fitChipText); }
  on(window,'resize', debounce(function(){ refitAllLabels(); refitAllChips(); }, 120));

  /* ---------- Tokens ---------- */
  function buildTokenBase(){
    var el = document.createElement('div');
    el.className='token'; el.id = uid(); el.setAttribute('tabindex','0'); el.setAttribute('role','listitem');
    el.style.touchAction='none'; el.setAttribute('draggable','false');

    on(el,'keydown', function(e){
      if(!(e.altKey || e.metaKey)) return;
      var zone = el.parentElement;
      if(!zone || (!zone.classList.contains('dropzone') && zone.id!=='tray')) return;

      if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
        e.preventDefault();
        var sib = (e.key==='ArrowLeft') ? el.previousElementSibling : el.nextElementSibling;
        if(!sib) return;
        var beforeTok = (e.key==='ArrowLeft') ? sib : sib.nextElementSibling;
        moveToken(el, zone, beforeTok);
        el.focus();
      } else if(e.key==='ArrowUp' || e.key==='ArrowDown'){
        e.preventDefault();
        var rows = $$('.tier-row');
        var row = el.closest('.tier-row');
        var idx = rows.indexOf(row); // array from $$ has indexOf
        var destRow = null;
        if(e.key==='ArrowUp'){ destRow = row ? rows[idx-1] : rows[rows.length-1]; }
        else{ destRow = row ? rows[idx+1] : rows[0]; }
        if(destRow){ moveToken(el, destRow.querySelector('.tier-drop'), null); el.focus(); }
      }
    });

    if (!isSmall()){
      if (window.PointerEvent) enablePointerDrag(el);
      else enableMouseTouchDragFallback(el);
    }else{
      enableMobileTouchDrag(el);
    }

    on(el,'click', function(ev){
      ev.stopPropagation();
      var wasSelected = el.classList.contains('selected');
      if (wasSelected){
        el.classList.remove('selected');
        if (isSmall() && el.closest('#tray')) { try{ closeRadial(); }catch(_){ } }
        return;
      }
      $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
      el.classList.add('selected');
      if (isSmall() && el.closest('#tray')) { openRadial(el); }
    });
    return el;
  }
  function buildNameToken(name, color, forceBlack){
    var el = buildTokenBase();
    el.style.background = color;
    el.setAttribute('aria-label','Item: '+name);
    var label = document.createElement('div'); label.className='label'; label.textContent=name;
    label.style.color = forceBlack ? '#111' : contrastColor(color);
    el.appendChild(label);
    fitLiveLabel(label);
    return el;
  }
  function buildImageToken(src, alt){
    var el = buildTokenBase();
    el.setAttribute('aria-label','Image item'+(alt?(': '+alt):''));
    var img = document.createElement('img'); img.src=src; img.alt=alt||''; img.draggable=false; el.appendChild(img);
    return el;
  }

  /* ---------- History (Undo) ---------- */
  var historyStack = [];
  function updateUndo(){ var u=$('#undoBtn'); if(u) u.disabled = historyStack.length===0; }
  function snapshotBefore(node){
    var parent = node.parentElement;
    var fromBefore = node.nextElementSibling ? node.nextElementSibling.id || (node.nextElementSibling.id=uid()) : '';
    return { itemId: node.id || (node.id=uid()), fromId: parent.id || (parent.id=uid()), fromBeforeId: fromBefore };
  }
  function moveToken(node, toZone, beforeTok){
    var snap = snapshotBefore(node);
    var toId = toZone.id || (toZone.id=uid());
    var beforeId = beforeTok ? (beforeTok.id || (beforeTok.id=uid())) : '';
    var originParent = node.parentElement;
    flipZones([originParent, toZone], function(){ if(beforeTok) toZone.insertBefore(node,beforeTok); else toZone.appendChild(node); });
    historyStack.push({ type:'move', itemId:snap.itemId, fromId:snap.fromId, fromBeforeId:snap.fromBeforeId, toId:toId, toBeforeId:beforeId });
    updateUndo(); announce('Moved '+(node.innerText||'item')); vib(6); queueAutosave();
  }
  function performMoveTo(itemId, parentId, beforeId){
    var item=document.getElementById(itemId); var parent=document.getElementById(parentId);
    if(!item||!parent) return;
    flipZones([item.parentElement, parent], function(){
      if(beforeId){
        var before=document.getElementById(beforeId);
        if(before && before.parentElement===parent){ parent.insertBefore(item,before); return; }
      }
      parent.appendChild(item);
    });
  }
  on($('#undoBtn'),'click', function(){
    var last = historyStack.pop(); if (!last) return;
    if (last.type==='move'){
      performMoveTo(last.itemId, last.fromId, last.fromBeforeId);
    } else if (last.type==='row'){
      var container = $('#tierBoard'); if(!container) return;
      try{
        var parser = new DOMParser();
        var doc = parser.parseFromString(last.rowHTML, 'text/html');
        var row = doc.body.firstElementChild;
        container.appendChild(row);
        var chip=$('.label-chip',row), del=$('.row-del',row), drop=$('.tier-drop',row), handle=$('.row-handle',row);
        setIcon(del,'close','Delete row');
        enableRowReorder(handle,row); enableClickToPlace(drop);
        on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); drop && drop.focus && drop.focus(); } });
        on(chip,'input', function(){ fitChipText(chip); queueAutosave(); });
        on(del,'click', function(){
          if(!confirm('Delete this row? Items in it will return to the tray.')) return;
          closeRadial();
          var tokens = $$('.token', drop);
          flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
          row.classList.add('removing');
          setTimeout(function(){ row.remove(); refreshRadialOptions(); queueAutosave();
            historyStack.push({type:'row-delete', rowHTML: row.outerHTML}); updateUndo();
          }, 190);
        });
      }catch(e){ console.warn('row restore failed', e); }
    } else if (last.type==='row-delete'){
      var container2 = $('#tierBoard');
      if(container2){
        var tmp=document.createElement('div'); tmp.innerHTML=last.rowHTML.trim();
        var row2=tmp.firstElementChild;
        container2.appendChild(row2);
        var chip2=$('.label-chip',row2), del2=$('.row-del',row2), drop2=$('.tier-drop',row2), handle2=$('.row-handle',row2);
        setIcon(del2,'close','Delete row');
        enableRowReorder(handle2,row2); enableClickToPlace(drop2);
        on(chip2,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip2.blur(); drop2 && drop2.focus && drop2.focus(); } });
        on(chip2,'input', function(){ fitChipText(chip2); queueAutosave(); });
        on(del2,'click', function(){
          if(!confirm('Delete this row? Items in it will return to the tray.')) return;
          closeRadial();
          var tokens2 = $$('.token', drop2);
          flipZones([drop2,tray], function(){ tokens2.forEach(function(t){ tray.appendChild(t); }); });
          row2.classList.add('removing');
          setTimeout(function(){ row2.remove(); refreshRadialOptions(); queueAutosave();
            historyStack.push({type:'row-delete', rowHTML: row2.outerHTML}); updateUndo();
          }, 190);
        });
      }
    }
    updateUndo(); queueAutosave();
  });

  /* ---------- Insert helper ---------- */
  function insertBeforeForPoint(zone,x,y,except){
    var tokens=[].slice.call(zone.querySelectorAll('.token')).filter(function(t){return t!==except;});
    if(tokens.length===0) return null;
    var centers=tokens.map(function(t){var r=t.getBoundingClientRect();return {t:t,cx:r.left+r.width/2,cy:r.top+r.height/2};});
    var rightMost=centers.reduce(function(a,b){return (b.cx>a.cx)?b:a;});
    var zr=zone.getBoundingClientRect();
    if(x > rightMost.cx + 24) return null;
    if(y > zr.bottom - 12) return null;
    var best=null,bestD=Infinity;
    centers.forEach(function(c){var dx=c.cx-x,dy=c.cy-y;var d=dx*dx+dy*dy;if(d<bestD){bestD=d;best=c.t;}});
    return best;
  }

  /* ---------- Click-to-place ---------- */
  function enableClickToPlace(zone){
    on(zone,'click', function(){
      var picker=$('#radialPicker'); if(picker && !picker.classList.contains('hidden')) return;
      var selected = $('.token.selected'); if (!selected) return;
      if(isSmall() && !selected.closest('#tray')) return;
      moveToken(selected, zone, null);
      selected.classList.remove('selected');
    });
  }

  /* ---------- Zone detection ---------- */
  function getDropZoneFromElement(el){
    if (!el) return null;
    var dz=el.closest('.dropzone, #tray'); if(dz) return dz;
    var chip=el.closest('.tier-label'); if(chip){ var row=chip.closest('.tier-row'); return row?row.querySelector('.tier-drop'):null; }
    return null;
  }

  /* ---------- Drag (desktop/mobile) ---------- */
  function enablePointerDrag(node){
    var ghost=null, originNext=null, currentZone=null;
    var offsetX=0, offsetY=0, x=0, y=0, raf=null;

    on(node,'pointerdown', function(e){
      if (isSmall()) return;
      if (e.button!==0) return;
      e.preventDefault();
      try{ node.setPointerCapture(e.pointerId); }catch(_){}
      document.body.classList.add('dragging-item');

      originNext = node.nextElementSibling;

      var r=node.getBoundingClientRect(); offsetX=e.clientX-r.left; offsetY=e.clientY-r.top; x=e.clientX; y=e.clientY;
      ghost = node.cloneNode(true); ghost.classList.add('drag-ghost','dragging-cue'); document.body.appendChild(ghost);
      node.classList.add('drag-hidden','dragging-cue');

      function move(ev){ x=ev.clientX; y=ev.clientY; }
      function cleanup(){
        try{ cancelAnimationFrame(raf);}catch(_){}
        try{ if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);}catch(_){}
        try{ node.classList.remove('drag-hidden','dragging-cue'); }catch(_){}
        try{ document.body.classList.remove('dragging-item'); }catch(_){}
        try{ if (currentZone) currentZone.classList.remove('drag-over'); currentZone=null; }catch(_){}
      }
      function up(){
        try{ node.releasePointerCapture(e.pointerId); }catch(_){}
        document.removeEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
        document.removeEventListener('pointerup', up, false);
        var target = document.elementFromPoint(x,y);
        cleanup();
        var zone = getDropZoneFromElement(target);
        if (zone){
          var beforeTok = insertBeforeForPoint(zone,x,y,node);
          moveToken(node, zone, beforeTok);
          node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
        } else if (originNext && originNext.parentElement===node.parentElement) {
          moveToken(node, node.parentElement, originNext);
        }
      }

      document.addEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
      document.addEventListener('pointerup', up, false);
      (function loop(){
        raf = requestAnimationFrame(loop);
        if (ghost) ghost.style.transform = 'translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';
        var el = document.elementFromPoint(x,y);
        var zone = getDropZoneFromElement(el);
        if (currentZone && currentZone!==zone) currentZone.classList.remove('drag-over');
        if (zone && zone!==currentZone) zone.classList.add('drag-over');
        currentZone = zone || null;
      })();
    });
  }
  function enableMouseTouchDragFallback(node){ on(node,'mousedown', function(e){ e.preventDefault(); }); }
  function enableMobileTouchDrag(node){
    if(!('PointerEvent' in window)) return;
    on(node,'pointerdown',function(e){
      if(!isSmall())return;
      if(e.pointerType!=='touch' && e.pointerType!=='pen')return;
      if(!node.closest('.tier-drop'))return;
      e.preventDefault(); try{ node.setPointerCapture(e.pointerId); }catch(_){}
      document.body.classList.add('dragging-item');

      var ghost=node.cloneNode(true); ghost.classList.add('drag-ghost','dragging-cue'); document.body.appendChild(ghost);
      var originNext=node.nextElementSibling;
      node.classList.add('drag-hidden','dragging-cue');

      var r=node.getBoundingClientRect(), offsetX=e.clientX-r.left, offsetY=e.clientY-r.top, x=e.clientX, y=e.clientY;

      function move(ev){x=ev.clientX;y=ev.clientY; ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';}
      function up(){
        try{node.releasePointerCapture(e.pointerId);}catch(_){}
        document.removeEventListener('pointermove',move,_supportsPassive?{passive:true}:false);
        document.removeEventListener('pointerup',up,false);
        try{ if(ghost&&ghost.parentNode)ghost.parentNode.removeChild(ghost);}catch(_){}
        node.classList.remove('drag-hidden','dragging-cue'); document.body.classList.remove('dragging-item');

        var target=document.elementFromPoint(x,y); var zone=getDropZoneFromElement(target);
        if(zone){
          var beforeTok=insertBeforeForPoint(zone,x,y,node);
          moveToken(node, zone, beforeTok);
          node.classList.add('animate-drop'); setTimeout(function(){node.classList.remove('animate-drop');},180);
        } else if (originNext){
          moveToken(node, node.parentElement, originNext);
        }
      }
      document.addEventListener('pointermove',move,_supportsPassive?{passive:true}:false);
      document.addEventListener('pointerup',up,false);
    },_supportsPassive?{passive:false}:false);
  }

  /* ---------- Row reorder ---------- */
  function enableRowReorder(handle, row){
    var placeholder=null, originNext=null;

    function arm(){ row.setAttribute('draggable','true'); originNext = row.nextElementSibling; }
    on(handle,'mousedown', arm);
    on(handle,'touchstart', arm, _supportsPassive?{passive:true}:false);

    on(row,'dragstart', function(){
      document.body.classList.add('dragging-item');
      placeholder = document.createElement('div');
      placeholder.className='tier-row';
      placeholder.style.height = row.getBoundingClientRect().height+'px';
      placeholder.style.borderRadius='12px';
      placeholder.style.border='2px dashed rgba(139,125,255,.25)';
      $('#tierBoard').insertBefore(placeholder, row.nextSibling);
      setTimeout(function(){ row.style.display='none'; },0);
    });
    on(row,'dragend', function(){
      row.style.display='';
      var boardEl=$('#tierBoard');
      if (placeholder && placeholder.parentNode){ boardEl.insertBefore(row, placeholder); placeholder.parentNode.removeChild(placeholder); }
      var afterNext = row.nextElementSibling;
      row.removeAttribute('draggable'); placeholder=null;
      document.body.classList.remove('dragging-item');

      historyStack.push({
        type:'row',
        rowId: row.id,
        fromBeforeId: originNext ? (originNext.id || (originNext.id=uid())) : '',
        toBeforeId:   afterNext ? (afterNext.id || (afterNext.id=uid())) : ''
      });
      updateUndo(); queueAutosave();
    });
    on($('#tierBoard'),'dragover', function(e){
      if(!placeholder) return; e.preventDefault();
      var after = rowAfterY($('#tierBoard'), e.clientY);
      if (after) $('#tierBoard').insertBefore(placeholder, after); else $('#tierBoard').appendChild(placeholder);
    });
    function rowAfterY(container, y){
      var rows = Array.prototype.filter.call(container.querySelectorAll('.tier-row'), function(r){ return r!==placeholder && r.style.display!=='none'; });
      for (var i=0;i<rows.length;i++){ var r=rows[i], rect=r.getBoundingClientRect(); if (y < rect.top + rect.height/2) return r; }
      return null;
    }
  }

  /* ---------- Radial picker (mobile): compact + edge guard + colored dots ---------- */
  var radial = $('#radialPicker');
  var radialOpts = radial?$('.radial-options', radial):null;
  var radialCloseBtn = radial?$('.radial-close', radial):null;
  var radialForToken = null;
  var _backdropHandler = null;

  function uniformCenter(cx, cy, R){
    var M=16; return { x: Math.max(M+R, Math.min(window.innerWidth-M-R, cx)), y: Math.max(M+R, cy) };
  }
  function refreshRadialOptions(){ if (!isSmall() || !radial || !radialForToken) return; openRadial(radialForToken); }

  function springIn(el, delay){
    try{
      el.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0.72)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: .58 },
          { transform: 'translate(-50%,-50%) scale(0.96)', opacity: 1, offset: .82 },
          { transform: 'translate(-50%,-50%) scale(1.00)', opacity: 1 }
        ],
        { duration: 420, delay: delay||0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
      );
    }catch(_){}
  }

  function openRadial(token){
    if(!radial||!isSmall()) return;
    // Clean up any prior listener to avoid leaks
    if (_backdropHandler){ radial.removeEventListener('pointerdown', _backdropHandler); _backdropHandler = null; }

    radialForToken = token;
    if (radialCloseBtn) radialCloseBtn.setAttribute('type','button');

    var rect = token.getBoundingClientRect();
    var cx = rect.left + rect.width/2;
    var cy = rect.top + rect.height/2;

    var rows = $$('.tier-row');
    var N = rows.length; if (!N) return;

    // Compact fan geometry (210°..330°), DOT and GAP tuned
    var DOT=42, GAP=6, degStart=210, degEnd=330;
    var stepDeg=(degEnd-degStart)/Math.max(1,(N-1));
    var stepRad=stepDeg*Math.PI/180;
    var BASE_R=92, need=(DOT+GAP)/(2*Math.sin(Math.max(stepRad/2,0.06)));
    var R=Math.max(BASE_R, Math.min(110, need));
    var EDGE=32;

    var center=uniformCenter(cx, cy, R);
    if (center.x - R < EDGE) center.x = EDGE + R;

    radialCloseBtn.style.left = center.x+'px';
    radialCloseBtn.style.top  = center.y+'px';

    radialOpts.innerHTML = '';
    for (let j=0;j<N;j++){
      var row = rows[j];
      var chip = row.querySelector('.label-chip');
      var labelText = chip ? chip.textContent.trim() : ('R'+(j+1));
      var color = (chip && chip.dataset.color) || (row.querySelector('.tier-label') && row.querySelector('.tier-label').dataset.color) || '#fff';

      var ang=(degStart+stepDeg*j)*Math.PI/180;
      var posX=center.x+R*Math.cos(ang), posY=center.y+R*Math.sin(ang);

      var btn = document.createElement('button');
      btn.type='button'; btn.className='radial-option';
      btn.style.left = posX+'px';
      btn.style.top  = posY+'px';
      btn.style.transform = 'translate(-50%,-50%)';

      var dot=document.createElement('span'); dot.className='dot'; dot.textContent=labelText;
      // dot style to mirror tier label color and readable text
      dot.style.background = color;
      dot.style.color = contrastColor(color);
      btn.appendChild(dot);

      on(btn,'pointerenter', function(){ btn.classList.add('is-hot'); });
      on(btn,'pointerleave', function(){ btn.classList.remove('is-hot'); });
      on(btn,'pointerdown', function(e){ e.preventDefault(); });
      on(btn,'click', function(){ moveToken(token, row.querySelector('.tier-drop'), null); closeRadial(); });

      radialOpts.appendChild(btn);
      springIn(btn, j*24);
    }
    springIn(radialCloseBtn, 40);

    _backdropHandler = function backdrop(ev){
      if(ev.target.closest('.radial-option') || ev.target.closest('.radial-close')) return;
      var x=(ev.touches&&ev.touches[0]?ev.touches[0].clientX:ev.clientX);
      var y=(ev.touches&&ev.touches[0]?ev.touches[0].clientY:ev.clientY);
      var prevPE=radial.style.pointerEvents; radial.style.pointerEvents='none';
      var under=document.elementFromPoint(x,y); radial.style.pointerEvents=prevPE||'auto';
      var other=under && under.closest && under.closest('#tray .token');
      if(other){ closeRadial(); $$('.token.selected').forEach(function(t){t.classList.remove('selected');}); other.classList.add('selected'); openRadial(other); ev.preventDefault(); return; }
      closeRadial();
    };
    radial.addEventListener('pointerdown',_backdropHandler,{passive:false});

    radial.classList.remove('hidden');
    radial.setAttribute('aria-hidden','false');
  }
  if(radialCloseBtn){ on(radialCloseBtn,'click', function(e){ e.stopPropagation(); closeRadial(); }, false); }
  function closeRadial(){
    if(!radial) return;
    if (_backdropHandler){ radial.removeEventListener('pointerdown', _backdropHandler); _backdropHandler = null; }
    radial.classList.add('hidden');
    radial.setAttribute('aria-hidden','true');
    radialForToken = null;
  }
  on(window,'resize', refreshRadialOptions);

  /* ---------- EXPORT: aggressive compatibility + retries ---------- */
  (function(){
    function isCrossOriginUrl(url){
      try{
        if (!url) return false;
        if (url.startsWith('data:')) return false;
        const u = new URL(url, location.href);
        return u.origin !== location.origin;
      }catch(_){ return false; }
    }

    // Convert <img> to data URLs in the cloned doc to avoid CORS.
    function ensureImagesDataUrl(doc){
      var imgs = doc.querySelectorAll('img');
      var replacements = new Map(); // element -> original src
      var promises = [];
      imgs.forEach(function(img){
        var src = img.getAttribute('src')||'';
        if (!src || src.startsWith('data:')) return;
        replacements.set(img, src);
        promises.push(new Promise(function(resolve){
          try{
            var x = new Image();
            x.crossOrigin = 'anonymous';
            x.onload = function(){
              try{
                var c = doc.createElement('canvas');
                c.width = x.naturalWidth; c.height = x.naturalHeight;
                var g = c.getContext('2d');
                g.drawImage(x,0,0);
                var data = c.toDataURL('image/png');
                img.setAttribute('src', data);
                resolve(true);
              }catch(e){ resolve(false); }
            };
            x.onerror = function(){ resolve(false); };
            x.src = src;
          }catch(e){ resolve(false); }
        }));
      });
      return Promise.all(promises).then(function(){ return replacements; });
    }

    // Blank-canvas detection: sample 16 random points
    function isCanvasLikelyBlank(canvas){
      try{
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        if (!w || !h) return true;
        var checks = 16;
        for (var i=0;i<checks;i++){
          var x = Math.floor(Math.random()*w);
          var y = Math.floor(Math.random()*h);
          var data = ctx.getImageData(x,y,1,1).data;
          if (data[3] !== 0) return false; // has alpha content
        }
        // also sample center
        var data2 = ctx.getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data;
        if (data2[3] !== 0) return false;
        return true;
      }catch(e){ return false; }
    }

    var overlay=document.createElement('div');
    overlay.id='exportOverlay'; overlay.setAttribute('aria-live','polite');
    overlay.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;';
    overlay.innerHTML='<div style="padding:14px 18px;border-radius:10px;background:#111;color:#fff;font-weight:600;display:flex;gap:10px;align-items:center;"><span class="spinner" style="width:18px;height:18px;border-radius:50%;border:3px solid #fff;border-right-color:transparent;display:inline-block;animation:spin .9s linear infinite;"></span><span>Rendering PNG…</span></div>';
    document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(overlay); });
    var style=document.createElement('style'); style.textContent='@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(style);

    function doRender(attempt){
      return new Promise(function(resolve, reject){
        var panel = $('#boardPanel');
        if(!panel){ reject(new Error('Board not found')); return; }

        // Clear interactive states
        $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
        $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

        var settings = {
          backgroundColor: cssVar('--surface') || '#0f1115',
          scale: Math.min(2, window.devicePixelRatio || 1.5),
          useCORS: true,
          allowTaint: false,
          imageTimeout: 15000,
          foreignObjectRendering: false,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1300,
          ignoreElements: function(el){
            if (el.tagName === 'IMG' && isCrossOriginUrl(el.getAttribute('src')||'')) return true;
            if (el.id === 'radialPicker') return true;
            return false;
          },
          onclone: function(doc){
            // Mark exporting and size wrapper to 1200px
            doc.documentElement.classList.add('exporting','desktop-capture');
            var wrap = doc.querySelector('.wrap'); if (wrap){ wrap.style.maxWidth='1200px'; wrap.style.width='1200px'; }

            var clone = doc.querySelector('#'+panel.id);
            if (!clone) return;

            // Remove non-export bits inside the board
            clone.querySelectorAll('.row-del,.title-pen,.radial,[data-nonexport]').forEach(function(n){ n.remove(); });

            // Only include title if user wrote something (ignore placeholder)
            var title = clone.querySelector('.board-title');
            if (title){
              var text = title.textContent.replace(/[\s\u00A0]+/g,'');
              if (text === ''){
                var wrapTitle = title.closest('.board-title-wrap');
                if (wrapTitle && wrapTitle.parentNode) wrapTitle.parentNode.removeChild(wrapTitle);
                clone.classList.add('no-title');
              }
            }

            // Aggressive CSS reset for compatibility
            var reset = doc.createElement('style');
            reset.textContent = `
              .exporting *{ animation:none !important; transition:none !important; }
              .exporting .panel, .exporting .tier-drop{ backdrop-filter:none !important; -webkit-backdrop-filter:none !important; filter:none !important; }
              .exporting .token, .exporting .token:hover, .exporting .animate-drop, .exporting .flip-anim{ transform:none !important; }
              .exporting .token::after{ content:none !important; display:none !important; }
              .exporting .board-title[contenteditable]:empty::before{ content:'' !important; }
              .exporting .tier-row{ grid-template-columns:180px 1fr !important; }
              /* Solid fallback backgrounds (flatten gradients) */
              .exporting .panel{ background: ${cssVar('--surface-raised')||'#151820'} !important; border-color:${cssVar('--border')||'rgba(255,255,255,.08)'} !important; }
              .exporting .tier-drop{ background: ${cssVar('--card')||'#1E1E1E'} !important; border-color:${cssVar('--border')||'rgba(255,255,255,.08)'} !important; }
            `;
            doc.head.appendChild(reset);

            // Ensure chip fitters don’t run in export clone (guarded in functions)

            // Convert images to data URLs to dodge CORS
            doc.__tmReplPromise = ensureImagesDataUrl(doc);
          }
        };

        html2canvas(panel, settings).then(function(canvas){
          try{
            // If the onclone made a promise, wait it and retry one more time to be safe
            var cloneDoc = document; // not accessible directly here; rely on 2-attempt loop below
          }catch(_){}
          resolve(canvas);
        }).catch(reject);
      }).then(function(canvas){
        if (!canvas || isCanvasLikelyBlank(canvas)){
          if (attempt === 0){
            // Retry with more conservative settings (scale 1, force background)
            return doRender(1);
          }
        }
        return canvas;
      });
    }

    function savePngFlow(){
      overlay.style.display='flex';
      document.body.style.pointerEvents = 'none';
      doRender(0).then(function(canvas){
        if (!canvas) throw new Error('Canvas not produced');
        var a=document.createElement('a');
        a.href=canvas.toDataURL('image/png');
        a.download='tier-list.png';
        document.body.appendChild(a); a.click(); a.remove();
      }).catch(function(err){
        console.error('Export failed', err);
        alert('Sorry, something went wrong while exporting');
      }).finally(function(){
        overlay.style.display='none';
        document.body.style.pointerEvents = '';
      });
    }

    document.addEventListener('DOMContentLoaded', function(){
      var btn = $('#saveBtn');
      if (!btn) return;
      on(btn,'click', function(){
        try{
          this.classList.add('bounce-anim');
          once(this,'animationend',()=>this.classList.remove('bounce-anim'));
        }catch(_){}
        savePngFlow();
      });
    });
  })();

  /* ---------- Autosave ---------- */
  var AUTOSAVE_KEY='tm_autosave_v1';
  function serializeState(){
    var state={ rows:[], tray:[], version:2, tierIdx: tierIdx, pIndex: pIndex };
    $$('.tier-row').forEach(function(r){
      var chip=$('.label-chip',r), wrap=$('.tier-label',r);
      var color = (chip && chip.dataset.color) || (wrap && wrap.dataset.color) || '#8b7dff';
      var entry={ label: chip.textContent, color: color, items: [] };
      $$('.token', r.querySelector('.tier-drop')).forEach(function(tok){
        if (tok.querySelector('img')) entry.items.push({t:'i', src: tok.querySelector('img').getAttribute('src')});
        else entry.items.push({t:'n', text: $('.label',tok).textContent, color: tok.style.background});
      });
      state.rows.push(entry);
    });
    $$('#tray .token').forEach(function(tok){
      if (tok.querySelector('img')) state.tray.push({t:'i', src: tok.querySelector('img').getAttribute('src')});
      else state.tray.push({t:'n', text: $('.label',tok).textContent, color: tok.style.background});
    });
    return state;
  }
  function restoreState(state){
    if(!state || !state.rows) return false;
    $('#tierBoard').innerHTML='';
    if (typeof state.tierIdx === 'number') tierIdx = state.tierIdx;
    if (typeof state.pIndex === 'number')  pIndex  = state.pIndex;
    state.rows.forEach(function(r){
      var row=createRow({label:r.label, color:r.color});
      $('#tierBoard').appendChild(row);
      var drop=row.querySelector('.tier-drop');
      (r.items||[]).forEach(function(it){
        if(it.t==='i') drop.appendChild(buildImageToken(it.src,''));
        else drop.appendChild(buildNameToken(it.text, it.color, true));
      });
    });
    $('#tray').innerHTML='';
    (state.tray||[]).forEach(function(it){
      if(it.t==='i') tray.appendChild(buildImageToken(it.src,''));
      else tray.appendChild(buildNameToken(it.text, it.color, true));
    });
    refitAllLabels(); refitAllChips();
    return true;
  }
  function queueAutosave(){
    try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeState())); }
    catch(e){
      console.warn('Autosave failed (storage full?)', e);
      try{ __say && __say('Autosave failed – storage full'); }catch(_){}
    }
  }
  function maybeClearAutosaveOnReload(){
    try{
      if (!window.performance) return;
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload'){ localStorage.removeItem(AUTOSAVE_KEY); }
    }catch(_){}
  }

  /* ---------- Full reset to original defaults ---------- */
  function resetToDefault(){
    try { closeRadial(); } catch(_){}
    historyStack = []; updateUndo();
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch(_){}
    var title = $('.board-title'); if (title) title.textContent = '';

    var boardEl = $('#tierBoard');
    if (boardEl){
      boardEl.innerHTML = '';
      tierIdx = 0;
      defaultTiers.forEach(function(t){ boardEl.appendChild(createRow(t)); });
    }

    var trayEl = $('#tray');
    if (trayEl){
      trayEl.innerHTML = '';
      // Rotate color order each load so nobody gets stuck with same color
      try { pIndex = (Math.floor(Math.random()*presetPalette.length)) % presetPalette.length; }catch(_){}
      communityCast.forEach(function(n){
        trayEl.appendChild(buildNameToken(n, nextPreset(), true));
      });
    }

    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

    refitAllLabels();
    refitAllChips();
    announce('Everything reset to defaults.');
  }

  /* ---------- Desktop inline-controls merge ---------- */
  function setupDesktopControlsMerge(){
    var controls = $('.controls'); if(!controls) return;
    var controlsPanel = controls.closest('.controls-panel'); // this class exists in HTML
    var trayPanel = $('#tray') ? $('#tray').closest('.tray-panel') : null; if(!trayPanel) return;

    var homeMarker = document.createElement('div'); homeMarker.id='controlsHome';
    if (controlsPanel && !$('#controlsHome')) controlsPanel.insertBefore(homeMarker, controls);

    var sectionBar = trayPanel.querySelector('.section-bar');
    var inlineWrap = document.createElement('div'); inlineWrap.className='controls-inline';

    function apply(){
      if (isDesktopWide()){
        if (!sectionBar.parentNode){ trayPanel.insertBefore(sectionBar, $('#tray')); }
        if (!inlineWrap.parentNode){ sectionBar.appendChild(inlineWrap); }
        if (controls.parentNode !== inlineWrap){ inlineWrap.appendChild(controls); }
        document.body.classList.add('controls-merged');
      } else {
        if (homeMarker && homeMarker.parentNode && controls.parentNode !== homeMarker.parentNode){
          homeMarker.parentNode.insertBefore(controls, homeMarker.nextSibling);
        }
        document.body.classList.remove('controls-merged');
        if (inlineWrap.parentNode) inlineWrap.parentNode.removeChild(inlineWrap);
      }
    }

    apply();
    on(window,'resize', debounce(apply, 120));
  }

  /* ---------- Hardened init (always renders) ---------- */
  document.addEventListener('DOMContentLoaded', function startSafe(){
    try { __say && __say('init…'); } catch(_){}

    // Ensure required roots
    board = document.getElementById('tierBoard');
    tray  = document.getElementById('tray');
    if (!board || !tray){
      console.error('TierMaker: #tierBoard or #tray missing.');
      return;
    }

    // Remove any lingering export classes
    try {
      document.documentElement.classList.remove('exporting','desktop-capture');
      document.body.classList.remove('exporting','desktop-capture');
    } catch(_){}

    // Icons
    try { swapAllIcons(); } catch(e){ console.warn('icon swap failed', e); }

    // Clear autosave if reload
    maybeClearAutosaveOnReload();

    // Restore autosave
    var saved=null;
    try{ saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)||'null'); }catch(e){ console.warn('autosave parse failed', e); }
    var restoredOk=false;
    try{
      if (saved) restoredOk = !!restoreState(saved);
    }catch(e){ console.warn('restoreState failed', e); }

    // Seed defaults if needed
    try{
      if (!board.children.length) {
        defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });
      }
      if (!tray.children.length) {
        // rotate color start each load
        try { pIndex = (Math.floor(Math.random()*presetPalette.length)) % presetPalette.length; }catch(_){}
        communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset(), true)); });
      }
    }catch(e){ console.error('building defaults failed', e); }

    // Wire buttons
    try {
      var addTierBtn = $('#addTierBtn');
      addTierBtn && on(addTierBtn,'click', function(){
        try{ this.classList.add('bounce-anim'); once(this,'animationend',()=>this.classList.remove('bounce-anim')); }catch(_){}
        var row = createRow({label:'NEW', color: nextTierColor()});
        board.appendChild(row);
        var chip = $('.label-chip', row); if (chip) chip.focus();
        refreshRadialOptions(); queueAutosave();
      });
    } catch(e){ console.warn('add tier wiring failed', e); }

    try {
      var addNameBtn = $('#addNameBtn');
      addNameBtn && on(addNameBtn,'click', function(){
        var nameInput = $('#nameInput'); var colorInput = $('#nameColor');
        if (!nameInput || !colorInput) return;
        var name = (nameInput.value||'').trim(); if (!name) return;
        var chosen = colorInput.value || nextPreset();
        tray.appendChild(buildNameToken(name, chosen, false));
        nameInput.value='';
        colorInput.value = nextPreset();
        try { refitAllLabels(); queueAutosave(); } catch(_){}
      });
    } catch(e){ console.warn('add name wiring failed', e); }

    try {
      var imageInput = $('#imageInput');
      imageInput && on(imageInput,'change', function(e){
        Array.prototype.forEach.call(e.target.files || [], function(file){
          if(!file.type || file.type.indexOf('image/')!==0) return;
          var r = new FileReader();
          r.onload = function(ev){ try{
            tray.appendChild(buildImageToken(ev.target.result, file.name)); queueAutosave();
          }catch(_){} };
          r.readAsDataURL(file);
        });
      });
    } catch(e){ console.warn('image input wiring failed', e); }

    // Help content (device-aware; no bullets)
    try {
      var help=$('#helpText') || $('.help');
      if(help){
        var mobile = isSmall();
        help.setAttribute('role','note');
        help.setAttribute('aria-live','polite');
        help.innerHTML = mobile
          ? '<strong>Help</strong> Phone: tap a circle in the tray to send it to a row. Drag to reorder or drag back. Tap tier labels to edit; tap the corner X on a label to delete the row.'
          : '<strong>Help</strong> Desktop/iPad: drag circles into rows. Alt+←/→ to move within a row; Alt+↑/↓ to move between rows. Click tier labels to edit; click the corner X on a label to delete the row.';
      }
    } catch(e){ console.warn('help wiring failed', e); }

    // Click-to-place also on tray (and open radial on mobile tap)
    try {
      enableClickToPlace(tray);
      tray && on(tray,'click', function(ev){
        var tok = ev.target.closest && ev.target.closest('.token');
        if (!tok) return;
        if (isSmall()) {
          $$('.token.selected').forEach(t=>t.classList.remove('selected'));
          tok.classList.add('selected');
          try { openRadial(tok); } catch(_){}
        }
      });
    } catch(e){ console.warn('tray tap override failed', e); }

    // Clear Board = full reset
    try {
      var trash = $('#trashClear');
      trash && on(trash,'click', function(){
        if (!confirm('Reset everything to the original state? This clears all circles, custom labels, uploaded items, and the title.')) return;
        resetToDefault();
      });
    } catch(e){ console.warn('trash wiring failed', e); }

    // Desktop inline controls into tray bar
    setupDesktopControlsMerge();

    // Final polish
    try {
      updateUndo();
      refitAllLabels();
      refitAllChips();
      __say && __say('ready');
    } catch(_){}
  });

})(); // end IIFE