/* =========================================================
   Tier Maker — Unified JavaScript (Fixed)
========================================================= */

(function(){
  'use strict';

  /* ---------- Tiny diagnostics ---------- */
  (function(){
    var box = document.createElement('div');
    box.id = 'diag';
    box.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;background:#111;color:#fff;font:12px/1.4 monospace;padding:8px 10px;border-radius:8px;opacity:0;pointer-events:none;transition:opacity .2s';
    document.addEventListener('DOMContentLoaded',function(){ document.body.appendChild(box); });
    function say(msg){ 
      try{ 
        console.log('[TierMaker]', msg); 
        box.textContent = String(msg); 
        box.style.opacity = '0.92'; 
        setTimeout(function(){ box.style.opacity = '0'; }, 4200);
      }catch(e){} 
    }
    window.__say = say;
    window.addEventListener('error', function(e){ say('JS error: ' + (e.message||e.error||'unknown')); });
    window.addEventListener('unhandledrejection', function(e){ say('Promise rejection: ' + (e.reason && e.reason.message || e.reason || 'unknown')); });
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
  
  function on(el, t, h, o){ 
    if(!el) return;
    if (!o) { el.addEventListener(t, h, false); return; }
    if (typeof o === 'object' && !_supportsPassive) el.addEventListener(t, h, !!o.capture);
    else el.addEventListener(t, h, o);
  }
  function once(el, t, h, o){ 
    function w(e){ el.removeEventListener(t,w,o||false); h(e);} 
    el.addEventListener(t,w,o||false); 
  }

  /* ---------- DOM utils ---------- */
  var $ = function (s, ctx){ return (ctx||document).querySelector(s); };
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
  function mixHex(aHex,bHex,t){ 
    var a=hexToRgb(aHex), b=hexToRgb(bHex);
    return rgbToHex(
      Math.round(a.r+(b.r-a.r)*t),
      Math.round(a.g+(b.g-a.g)*t),
      Math.round(a.b+(b.b-a.b)*t)
    );
  }

  /* ---------- Globals ---------- */
  var board=null, tray=null;

  /* ---------- ICONS ---------- */
  var ICONS = {
    add:      { vb:'0 0 24 24', d:'M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1z' },
    undo:     { vb:'0 0 24 24', d:'M12 5v3l-4-4 4-4v3c5.523 0 10 4.477 10 10a10 10 0 0 1-10 10H6v-2h6a8 8 0 0 0 0-16z' },
    trash:    { vb:'0 0 24 24', d:'M9 3h6l1 2h4a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h4l1-2zm2 6a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1z' },
    download: { vb:'0 0 24 24', d:'M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V4a1 1 0 0 1 1-1zM4 19a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z' },
    close:    { vb:'0 0 24 24', d:'M6.7 5.3 5.3 6.7 10.6 12l-5.3 5.3 1.4 1.4L12 13.4l5.3 5.3 1.4-1.4L13.4 12l5.3-5.3-1.4-1.4L12 10.6 6.7 5.3z' }
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
    var addBtn = $('#addTierBtn .ico'); if(addBtn) setIcon(addBtn,'add','Add');
    var undoBtn = $('#undoBtn .ico'); if(undoBtn) setIcon(undoBtn,'undo','Undo');
    var trashBtn = $('#trashClear .ico'); if(trashBtn) setIcon(trashBtn,'trash','Clear board');
    var saveBtn = $('#saveBtn .ico'); if(saveBtn) setIcon(saveBtn,'download','Save PNG');
  }

  /* ---------- FLIP helper ---------- */
  function flipZones(zones, mutate){
    var prev=new Map();
    try{
      zones.forEach(function(z){ 
        if(!z) return;
        $$('.token',z).forEach(function(t){ prev.set(t,t.getBoundingClientRect()); }); 
      });
      mutate();
      requestAnimationFrame(function(){
        zones.forEach(function(z){
          if(!z) return;
          $$('.token',z).forEach(function(t){
            var r2=t.getBoundingClientRect(), r1=prev.get(t); if(!r1) return;
            var dx=r1.left-r2.left, dy=r1.top-r2.top;
            if(Math.abs(dx) > 1 || Math.abs(dy) > 1){
              t.classList.add('flip-anim');
              t.style.transform='translate('+dx+'px,'+dy+'px)';
              requestAnimationFrame(function(){
                t.style.transform='translate(0,0)';
                setTimeout(function(){ t.classList.remove('flip-anim'); t.style.transform=''; },200);
              });
            }
          });
        });
        prev.clear();
      });
    }catch(e){ try{ prev.clear(); }catch(ex){ } }
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
    drop.className='tier-drop dropzone'; 
    drop.id = uid();
    drop.setAttribute('tabindex','0');

    row.appendChild(labelWrap); row.appendChild(drop);
    return { row: row, chip: chip, del: del, drop: drop, handle: handle, labelWrap: labelWrap };
  }
  
  function tintFrom(color){
    var surface = '#050508';
    var a=hexToRgb(surface), b=hexToRgb(color);
    var amt = 0.12;
    return rgbToHex(
      Math.round(a.r+(b.r-a.r)*amt),
      Math.round(a.g+(b.g-a.g)*amt),
      Math.round(a.b+(b.b-a.b)*amt)
    );
  }

  /* ---------- Chip text fitter ---------- */
  var CHIP_STEPS=[34,32,28,26,24,22,20,18,16,14];
  function fitChipText(chip){
    if(!chip) return;
    if (document.documentElement.classList.contains('exporting')) return;

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
    drop.style.background = tint;

    fitChipText(chip);

    on(chip,'keydown', function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        chip.blur();
      }
    });
    on(chip,'input', function(){ fitChipText(chip); queueAutosave(); });

    on(del,'click', function(){
      if(!confirm('Delete this row? Items will return to tray.')) return;
      try { closeRadial(); } catch(ex){}
      var tokens = $$('.token', drop);
      flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
      node.classList.add('removing');
      setTimeout(function(){ 
        node.remove(); 
        queueAutosave();
        historyStack.push({type:'row-delete', rowHTML: node.outerHTML}); 
        updateUndo();
      }, 190);
    });

    enableRowReorder(handle, node);
    enableDropZone(drop);
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

  var TIER_CYCLE = ['#ff6b6b','#f6c02f','#22c55e','#3b82f6','#a78bfa','#06b6d4','#e11d48','#16a34a','#f97316','#0ea5e9'];
  var tierIdx = 0; 
  function nextTierColor(){ var c=TIER_CYCLE[tierIdx%TIER_CYCLE.length]; tierIdx++; return c; }

  /* ---------- Names (removed Lewis, Kyle, Temz, V, TomTom) ---------- */
  var communityCast = [
    "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
    "Gavin","Harry","Jay","Jeremy","Katie","Kiev","Kikki","Meegan",
    "Munch","Paper","Ray","Safoof","Versse","Xavier"
  ];

  /* ---------- Palette ---------- */
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
    return safe;
  }
  var presetPalette = BASE_PALETTE.map(ensureForBlack);

  function shuffleArray(arr){
    for(var i = arr.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  var pIndex = 0; 
  function nextPreset(){ var c=presetPalette[pIndex%presetPalette.length]; pIndex++; return c; }

  /* ---------- Token label fitter ---------- */
  function fitLiveLabel(lbl){
    if (!lbl) return;
    if (document.documentElement.classList.contains('exporting')) return;
    var token = lbl.parentElement; if (!token) return;
    var D = token.clientWidth || 110;
    var pad = 10;
    var s = lbl.style;
    s.whiteSpace='nowrap'; s.lineHeight='1'; s.display='flex';
    s.alignItems='center'; s.justifyContent='center';
    s.height='100%'; s.padding='0 '+pad+'px';
    s.overflow='hidden';
    var lo=12, hi=Math.floor(D*0.44), best=lo;
    function fits(px){ s.fontSize=px+'px'; return lbl.scrollWidth<=D-pad*2; }
    while(lo<=hi){ var mid=(lo+hi)>>1; if(fits(mid)){ best=mid; lo=mid+1; } else hi=mid-1; }
    s.fontSize=best+'px';
  }
  function refitAllLabels(){ $$('.token .label').forEach(fitLiveLabel); }
  function refitAllChips(){ $$('.label-chip').forEach(fitChipText); }
  on(window,'resize', debounce(function(){ refitAllLabels(); refitAllChips(); }, 120));

  /* ---------- Tokens ---------- */
  function buildTokenBase(){
    var el = document.createElement('div');
    el.className='token'; el.id = uid(); el.setAttribute('tabindex','0');
    el.style.touchAction='none';

    enableDrag(el);

    on(el,'click', function(ev){
      ev.stopPropagation();
      var wasSelected = el.classList.contains('selected');
      $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
      if (!wasSelected){
        el.classList.add('selected');
        if (isSmall() && el.closest('#tray')) { openRadial(el); }
      } else {
        if (isSmall()) { try{ closeRadial(); }catch(ex){ } }
      }
    });
    return el;
  }
  
  function buildNameToken(name, color){
    var el = buildTokenBase();
    el.style.background = color;
    el.setAttribute('aria-label','Item: '+name);
    var label = document.createElement('div'); 
    label.className='label'; 
    label.textContent=name;
    label.style.color = '#111';
    el.appendChild(label);
    setTimeout(function(){ fitLiveLabel(label); }, 10);
    return el;
  }
  
  function buildImageToken(src, alt){
    var el = buildTokenBase();
    el.setAttribute('aria-label','Image item');
    var img = document.createElement('img'); 
    img.src=src; 
    img.alt=alt||''; 
    img.draggable=false; 
    el.appendChild(img);
    return el;
  }

  /* ---------- History ---------- */
  var historyStack = [];
  function updateUndo(){ var u=$('#undoBtn'); if(u) u.disabled = historyStack.length===0; }
  
  function snapshotBefore(node){
    var parent = node.parentElement;
    if(!parent.id) parent.id = uid();
    if(!node.id) node.id = uid();
    var fromBefore = node.nextElementSibling;
    return { 
      itemId: node.id, 
      fromId: parent.id, 
      fromBeforeId: fromBefore ? (fromBefore.id || (fromBefore.id=uid())) : '' 
    };
  }
  
  function moveToken(node, toZone, beforeTok){
    if(!toZone) return;
    var snap = snapshotBefore(node);
    if(!toZone.id) toZone.id = uid();
    var beforeId = beforeTok ? (beforeTok.id || (beforeTok.id=uid())) : '';
    var originParent = node.parentElement;
    
    flipZones([originParent, toZone], function(){ 
      if(beforeTok && beforeTok.parentElement === toZone) 
        toZone.insertBefore(node, beforeTok); 
      else 
        toZone.appendChild(node); 
    });
    
    historyStack.push({ 
      type:'move', 
      itemId:snap.itemId, 
      fromId:snap.fromId, 
      fromBeforeId:snap.fromBeforeId, 
      toId:toZone.id, 
      toBeforeId:beforeId 
    });
    updateUndo(); 
    vib(6); 
    queueAutosave();
  }
  
  function performMoveTo(itemId, parentId, beforeId){
    var item=document.getElementById(itemId); 
    var parent=document.getElementById(parentId);
    if(!item||!parent) return;
    flipZones([item.parentElement, parent], function(){
      if(beforeId){
        var before=document.getElementById(beforeId);
        if(before && before.parentElement===parent){ 
          parent.insertBefore(item,before); 
          return; 
        }
      }
      parent.appendChild(item);
    });
  }

  /* ---------- Insert helper ---------- */
  function insertBeforeForPoint(zone, x, y, except){
    var tokens = [].slice.call(zone.querySelectorAll('.token')).filter(function(t){ return t !== except; });
    if(tokens.length === 0) return null;
    
    var best = null;
    var bestDist = Infinity;
    
    for(var i = 0; i < tokens.length; i++){
      var t = tokens[i];
      var rect = t.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if(dist < bestDist){ bestDist = dist; best = t; }
    }
    
    if(!best) return null;
    var bestRect = best.getBoundingClientRect();
    if(x > bestRect.left + bestRect.width / 2) return best.nextElementSibling;
    return best;
  }

  /* ---------- Drop zone ---------- */
  function enableDropZone(zone){
    on(zone,'click', function(e){
      if(e.target.closest('.token')) return;
      var picker = $('#radialPicker'); 
      if(picker && !picker.classList.contains('hidden')) return;
      var selected = $('.token.selected'); 
      if (!selected) return;
      moveToken(selected, zone, null);
      selected.classList.remove('selected');
    });
  }

  /* ---------- Zone detection ---------- */
  function getDropZoneFromElement(el){
    if (!el) return null;
    var dz = el.closest('.dropzone, #tray'); 
    if(dz) return dz;
    var chip = el.closest('.tier-label'); 
    if(chip){ 
      var row = chip.closest('.tier-row'); 
      return row ? row.querySelector('.tier-drop') : null; 
    }
    return null;
  }

  /* ---------- Drag ---------- */
  function enableDrag(node){
    var ghost = null;
    var currentZone = null;
    var offsetX = 0, offsetY = 0;
    var x = 0, y = 0;
    var raf = null;
    var isDragging = false;
    var startX = 0, startY = 0;
    var dragThreshold = 8;

    function startDrag(e){
      var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startX = clientX;
      startY = clientY;
      var rect = node.getBoundingClientRect();
      offsetX = clientX - rect.left;
      offsetY = clientY - rect.top;
      x = clientX;
      y = clientY;
    }

    function initGhost(){
      if(ghost) return;
      document.body.classList.add('dragging-item');
      ghost = node.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.width = node.offsetWidth + 'px';
      ghost.style.height = node.offsetHeight + 'px';
      document.body.appendChild(ghost);
      node.classList.add('drag-hidden');
      isDragging = true;
      
      (function loop(){
        if(!isDragging) return;
        raf = requestAnimationFrame(loop);
        if(ghost) ghost.style.transform = 'translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';
        var el = document.elementFromPoint(x, y);
        var zone = getDropZoneFromElement(el);
        if(currentZone && currentZone !== zone) currentZone.classList.remove('drag-over');
        if(zone && zone !== currentZone) zone.classList.add('drag-over');
        currentZone = zone || null;
      })();
    }

    function onMove(e){
      var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      x = clientX;
      y = clientY;
      if(!isDragging){
        if(Math.abs(x - startX) > dragThreshold || Math.abs(y - startY) > dragThreshold){
          initGhost();
        }
      }
      if(isDragging) e.preventDefault();
    }

    function cleanup(){
      isDragging = false;
      if(raf) cancelAnimationFrame(raf);
      if(ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
      node.classList.remove('drag-hidden');
      document.body.classList.remove('dragging-item');
      if(currentZone) currentZone.classList.remove('drag-over');
      currentZone = null;
    }

    function onEnd(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove, {passive: false});
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      
      if(!isDragging){ cleanup(); return; }
      
      var target = document.elementFromPoint(x, y);
      var zone = getDropZoneFromElement(target);
      cleanup();
      
      if(zone){
        var beforeTok = insertBeforeForPoint(zone, x, y, node);
        moveToken(node, zone, beforeTok);
        node.classList.add('animate-drop');
        setTimeout(function(){ node.classList.remove('animate-drop'); }, 220);
      }
    }

    on(node, 'mousedown', function(e){
      if(e.button !== 0) return;
      e.preventDefault();
      startDrag(e);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
    });

    on(node, 'touchstart', function(e){
      if(e.touches.length !== 1) return;
      startDrag(e);
      document.addEventListener('touchmove', onMove, {passive: false});
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    }, {passive: true});
  }

  /* ---------- Row reorder ---------- */
  function enableRowReorder(handle, row){
    var placeholder = null;

    on(handle,'mousedown', function(){ row.setAttribute('draggable','true'); });
    on(handle,'touchstart', function(){ row.setAttribute('draggable','true'); }, {passive: true});

    on(row,'dragstart', function(){
      document.body.classList.add('dragging-item');
      placeholder = document.createElement('div');
      placeholder.className = 'tier-row';
      placeholder.style.height = row.getBoundingClientRect().height + 'px';
      placeholder.style.border = '2px dashed rgba(139,125,255,.25)';
      placeholder.style.borderRadius = '12px';
      var boardEl = $('#tierBoard');
      if(boardEl) boardEl.insertBefore(placeholder, row.nextSibling);
      setTimeout(function(){ row.style.display = 'none'; }, 0);
    });
    
    on(row,'dragend', function(){
      row.style.display = '';
      var boardEl = $('#tierBoard');
      if(placeholder && placeholder.parentNode){ 
        boardEl.insertBefore(row, placeholder); 
        placeholder.parentNode.removeChild(placeholder); 
      }
      row.removeAttribute('draggable'); 
      placeholder = null;
      document.body.classList.remove('dragging-item');
      queueAutosave();
    });
    
    on($('#tierBoard'),'dragover', function(e){
      if(!placeholder) return; 
      e.preventDefault();
      var rows = Array.prototype.filter.call($('#tierBoard').querySelectorAll('.tier-row'), function(r){ 
        return r !== placeholder && r.style.display !== 'none'; 
      });
      var after = null;
      for(var i = 0; i < rows.length; i++){ 
        var rect = rows[i].getBoundingClientRect(); 
        if(e.clientY < rect.top + rect.height/2){ after = rows[i]; break; }
      }
      if(after) $('#tierBoard').insertBefore(placeholder, after); 
      else $('#tierBoard').appendChild(placeholder);
    });
  }

  /* ---------- Radial picker - FIXED ---------- */
  var radial = null;
  var radialOpts = null;
  var radialCloseBtn = null;
  var radialForToken = null;
  var _backdropHandler = null;

  function initRadial(){
    radial = $('#radialPicker');
    if(!radial) return;
    radialOpts = $('.radial-options', radial);
    radialCloseBtn = $('.radial-close', radial);
  }

  function openRadial(token){
    if(!radial || !isSmall()) return;
    if(_backdropHandler){ radial.removeEventListener('pointerdown', _backdropHandler); _backdropHandler = null; }

    radialForToken = token;
    var rect = token.getBoundingClientRect();
    var cx = rect.left + rect.width/2;
    var cy = rect.top + rect.height/2;

    var rows = $$('.tier-row');
    var N = rows.length; 
    if(!N) return;

    var R = 95;
    var degStart = 210, degEnd = 330;
    var stepDeg = (degEnd - degStart) / Math.max(1, (N - 1));

    // Keep picker on screen
    var centerX = Math.max(R + 20, Math.min(window.innerWidth - R - 20, cx));
    var centerY = Math.max(R + 20, cy);

    radialCloseBtn.style.left = centerX + 'px';
    radialCloseBtn.style.top = centerY + 'px';

    radialOpts.innerHTML = '';
    
    for(var j = 0; j < N; j++){
      (function(index){
        var row = rows[index];
        var chip = row.querySelector('.label-chip');
        var labelText = chip ? chip.textContent.trim() : ('R' + (index + 1));
        var color = chip ? chip.dataset.color : '#fff';
        var dropZone = row.querySelector('.tier-drop');

        var ang = (degStart + stepDeg * index) * Math.PI / 180;
        var posX = centerX + R * Math.cos(ang);
        var posY = centerY + R * Math.sin(ang);

        var btn = document.createElement('button');
        btn.type = 'button'; 
        btn.className = 'radial-option';
        btn.style.left = posX + 'px';
        btn.style.top = posY + 'px';

        var dot = document.createElement('span'); 
        dot.className = 'dot'; 
        dot.textContent = labelText;
        dot.style.background = color;
        dot.style.color = contrastColor(color);
        btn.appendChild(dot);

        on(btn,'click', function(e){ 
          e.preventDefault();
          e.stopPropagation();
          if(dropZone && radialForToken){
            moveToken(radialForToken, dropZone, null);
          }
          closeRadial(); 
        });

        radialOpts.appendChild(btn);
      })(j);
    }

    _backdropHandler = function(ev){
      if(ev.target.closest('.radial-option') || ev.target.closest('.radial-close')) return;
      closeRadial();
    };
    radial.addEventListener('pointerdown', _backdropHandler, {passive: false});

    radial.classList.remove('hidden');
  }
  
  function closeRadial(){
    if(!radial) return;
    if(_backdropHandler){ radial.removeEventListener('pointerdown', _backdropHandler); _backdropHandler = null; }
    radial.classList.add('hidden');
    radialForToken = null;
  }

  /* ---------- EXPORT ---------- */
  (function(){
    var overlay = document.createElement('div');
    overlay.id = 'exportOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;';
    overlay.innerHTML = '<div style="padding:14px 18px;border-radius:10px;background:#111;color:#fff;font-weight:600;">Rendering PNG…</div>';
    document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(overlay); });

    function doRender(){
      return new Promise(function(resolve, reject){
        var panel = $('#boardPanel');
        if(!panel){ reject(new Error('Board not found')); return; }

        $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });

        var settings = {
          backgroundColor: '#111318',
          scale: 2,
          useCORS: true,
          width: 1000,
          windowWidth: 1200,
          ignoreElements: function(el){
            if(el.id === 'radialPicker') return true;
            if(el.classList && el.classList.contains('row-del')) return true;
            if(el.classList && el.classList.contains('row-handle')) return true;
            return false;
          },
          onclone: function(doc){
            doc.documentElement.classList.add('exporting','desktop-capture');
            
            var clone = doc.querySelector('#boardPanel');
            if(!clone) return;

            clone.querySelectorAll('.row-del,.row-handle').forEach(function(n){ n.remove(); });

            var title = clone.querySelector('.board-title');
            if(title){
              var text = title.textContent.trim();
              if(!text){
                var wrap = title.closest('.board-title-wrap');
                if(wrap) wrap.remove();
              }
            }

            clone.querySelectorAll('.tier-row').forEach(function(r){
              r.style.gridTemplateColumns = '180px 1fr';
            });
            clone.querySelectorAll('.token').forEach(function(t){
              t.style.width = '110px';
              t.style.height = '110px';
            });
          }
        };

        html2canvas(panel, settings).then(resolve).catch(reject);
      });
    }

    function savePngFlow(){
      overlay.style.display = 'flex';
      doRender().then(function(canvas){
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'tier-list.png';
        a.click();
      }).catch(function(err){
        console.error('Export failed', err);
        alert('Export failed');
      }).finally(function(){
        overlay.style.display = 'none';
      });
    }

    document.addEventListener('DOMContentLoaded', function(){
      var btn = $('#saveBtn');
      if(btn) on(btn,'click', savePngFlow);
    });
  })();

  /* ---------- Autosave ---------- */
  var AUTOSAVE_KEY = 'tm_autosave_v3';
  
  function serializeState(){
    var state = { rows:[], tray:[] };
    $$('.tier-row').forEach(function(r){
      var chip = $('.label-chip', r);
      var color = chip ? chip.dataset.color : '#888';
      var entry = { label: chip ? chip.textContent : '', color: color, items: [] };
      $$('.token', r.querySelector('.tier-drop')).forEach(function(tok){
        if(tok.querySelector('img')) entry.items.push({t:'i', src: tok.querySelector('img').src});
        else entry.items.push({t:'n', text: $('.label', tok).textContent, color: tok.style.background});
      });
      state.rows.push(entry);
    });
    $$('#tray .token').forEach(function(tok){
      if(tok.querySelector('img')) state.tray.push({t:'i', src: tok.querySelector('img').src});
      else state.tray.push({t:'n', text: $('.label', tok).textContent, color: tok.style.background});
    });
    return state;
  }
  
  function restoreState(state){
    if(!state || !state.rows) return false;
    board.innerHTML = '';
    state.rows.forEach(function(r){
      var row = createRow({label: r.label, color: r.color});
      board.appendChild(row);
      var drop = row.querySelector('.tier-drop');
      (r.items || []).forEach(function(it){
        if(it.t === 'i') drop.appendChild(buildImageToken(it.src, ''));
        else drop.appendChild(buildNameToken(it.text, it.color));
      });
    });
    tray.innerHTML = '';
    (state.tray || []).forEach(function(it){
      if(it.t === 'i') tray.appendChild(buildImageToken(it.src, ''));
      else tray.appendChild(buildNameToken(it.text, it.color));
    });
    return true;
  }
  
  function queueAutosave(){
    try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeState())); }catch(e){}
  }

  function resetToDefault(){
    try { closeRadial(); } catch(ex){}
    historyStack = []; 
    updateUndo();
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch(ex){}
    
    var title = $('.board-title'); 
    if(title) title.textContent = '';

    board.innerHTML = '';
    tierIdx = 0;
    defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });

    tray.innerHTML = '';
    shuffleArray(presetPalette);
    pIndex = 0;
    communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset())); });

    refitAllLabels();
    refitAllChips();
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', function(){
    board = document.getElementById('tierBoard');
    tray = document.getElementById('tray');
    
    if(!board || !tray){
      console.error('Missing #tierBoard or #tray');
      return;
    }

    initRadial();
    if(radialCloseBtn) on(radialCloseBtn,'click', function(e){ e.stopPropagation(); closeRadial(); });

    swapAllIcons();

    // Try restore
    var saved = null;
    try{ saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)); }catch(e){}
    var restored = saved ? restoreState(saved) : false;

    // If no restore, build defaults
    if(!restored){
      shuffleArray(presetPalette);
      pIndex = 0;
      defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });
      communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset())); });
    }

    // Wire buttons
    var addTierBtn = $('#addTierBtn');
    if(addTierBtn){
      on(addTierBtn,'click', function(){
        var row = createRow({label:'NEW', color: nextTierColor()});
        board.appendChild(row);
        row.querySelector('.label-chip').focus();
        queueAutosave();
      });
    }

    var addNameBtn = $('#addNameBtn');
    if(addNameBtn){
      on(addNameBtn,'click', function(){
        var nameInput = $('#nameInput'); 
        var colorInput = $('#nameColor');
        var name = (nameInput.value || '').trim(); 
        if(!name) return;
        tray.appendChild(buildNameToken(name, colorInput.value || '#FFD600'));
        nameInput.value = '';
        queueAutosave();
      });
    }

    var imageInput = $('#imageInput');
    if(imageInput){
      on(imageInput,'change', function(e){
        Array.prototype.forEach.call(e.target.files || [], function(file){
          if(!file.type.startsWith('image/')) return;
          var r = new FileReader();
          r.onload = function(ev){ tray.appendChild(buildImageToken(ev.target.result, file.name)); queueAutosave(); };
          r.readAsDataURL(file);
        });
      });
    }

    var helpText = $('#helpText');
    if(helpText){
      helpText.textContent = isSmall()
        ? 'Tap a circle, then select a tier. Drag to reorder.'
        : 'Drag circles into tiers. Alt+Arrows to move. Click labels to edit.';
    }

    enableDropZone(tray);

    var trash = $('#trashClear');
    if(trash) on(trash,'click', function(){
      if(confirm('Reset everything?')) resetToDefault();
    });

    var undoBtn = $('#undoBtn');
    if(undoBtn){
      on(undoBtn,'click', function(){
        var last = historyStack.pop(); 
        if(!last) return;
        if(last.type === 'move'){
          performMoveTo(last.itemId, last.fromId, last.fromBeforeId);
        }
        updateUndo(); 
        queueAutosave();
      });
    }

    updateUndo();
    refitAllLabels();
    refitAllChips();
    
    console.log('[TierMaker] Ready');
  });

})();
