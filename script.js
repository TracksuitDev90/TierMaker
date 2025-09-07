/* =========================================================
   Tier Maker — JS (compact picker, flat export, UI cleanup)
   + Full Reset on "Clear Board" + bug-fix pass
========================================================= */

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
function isDesktopWide(){ return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches; }
function debounce(fn, ms){ var t; return function(){ clearTimeout(t); t=setTimeout(fn, ms); }; }

/* ---------- Live region ---------- */
function ensureLive(){
  var n = $('#live');
  if (!n) {
    n = document.createElement('div');
    n.id='live'; n.setAttribute('aria-live','polite'); n.className='sr-only';
    document.body.appendChild(n);
  }
  return n;
}
function announce(msg){ var n=ensureLive(); n.textContent=''; setTimeout(function(){ n.textContent=msg; },0); }

/* ---------- Vibration ---------- */
function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }

/* ---------- Colors ---------- */
function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3){ h=h.split('').map(function(x){return x+x;}).join(''); } var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
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

/* ---------- Globals ---------- */
var board=null, tray=null;

/* =========================================================
   ICONS
========================================================= */
var ICONS = {
  add:      { vb:'0 0 24 24', d:'M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1z' },
  menu:     { vb:'0 0 24 24', d:'M4 7h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2zm0 5h16a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2zm0 5h16a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2z' },
  undo:     { vb:'0 0 24 24', d:'M12 5v3l-4-4 4-4v3c5.523 0 10 4.477 10 10a10 10 0 0 1-10 10H6v-2h6a8 8 0 0 0 0-16z' },
  trash:    { vb:'0 0 24 24', d:'M9 3h6l1 2h4a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h4l1-2zm2 6a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1z' },
  download: { vb:'0 0 24 24', d:'M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V4a1 1 0 0 1 1-1zM4 19a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z' },
  close:    { vb:'0 0 24 24', d:'M6.7 5.3 5.3 6.7 10.6 12l-5.3 5.3 1.4 1.4L12 13.4l5.3 5.3 1.4-1.4L13.4 12l5.3-5.3-1.4-1.4L12 10.6 6.7 5.3z' },
  /* Pencil-fill icon (sized to our button). */
  edit:     { vb:'0 0 24 24', d:'M14.06 3.5a2.5 2.5 0 0 1 3.54 0l2.9 2.9a2.5 2.5 0 0 1 0 3.54L10.6 20.88a2 2 0 0 1-1.03.55l-5.2 1.02a1 1 0 0 1-1.17-1.17l1.02-5.2a2 2 0 0 1 .55-1.03L14.06 3.5zm3.18 1.41a.5.5 0 0 0-.71 0L15.2 6.25l2.55 2.54 1.33-1.33a.5.5 0 0 0 0-.71l-1.84-1.84zM5.9 16.57a.5.5 0 0 0-.13.26l-.67 3.43 3.43-.67a.5.5 0 0 0 .26-.13l7.57-7.57-2.55-2.55L5.9 16.57z' }
};
function setIcon(container, name){
  if(!container) return;
  var spec = ICONS[name]; if(!spec) return;
  container.innerHTML = '<svg viewBox="'+spec.vb+'" aria-hidden="true"><path d="'+spec.d+'"/></svg>';
}
function swapAllIcons(){
  setIcon($('#addTierBtn .ico'),'add');
  setIcon($('#undoBtn .ico'),'undo');
  setIcon($('#trashClear .ico'),'trash');
  setIcon($('#saveBtn .ico'),'download');
  setIcon($('.title-pen'),'edit');
  setIcon($('#radialPicker .radial-close'),'close');
}

/* ---------- FLIP helper ---------- */
function flipZones(zones, mutate){
  var prev=new Map();
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
            setTimeout(function(){ t.classList.remove('flip-anim'); t.style.transform=''; },220);
          });
        }
      });
    });
  });
}

/* ---------- Row DOM ---------- */
function buildRowDom(){
  var row=document.createElement('div'); row.className='tier-row'; row.id=uid();

  var labelWrap=document.createElement('div'); labelWrap.className='tier-label';

  var handle=document.createElement('button');
  handle.className='row-handle';
  handle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h10v2H7zm0 4h10v2H7z"/></svg>';
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
  setIcon(del, 'close');

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

/* ---------- Chip text fitter ---------- */
var CHIP_STEPS=[34,32,28,26,24,22,20,18,16,14];
function fitChipText(chip){
  if(!chip) return;
  chip.style.whiteSpace='normal';
  chip.style.lineHeight='1.15';
  chip.style.display='flex';
  chip.style.alignItems='center';
  chip.style.justifyContent='center';
  chip.style.textAlign='center';
  chip.style.overflow='hidden';

  var wrap = chip.parentElement;
  var padding = 16;
  var maxW = wrap.clientWidth - padding; if (maxW < 40) maxW = wrap.clientWidth;
  var maxH = wrap.clientHeight - padding;

  for(var i=0;i<CHIP_STEPS.length;i++){
    var px = CHIP_STEPS[i];
    chip.style.fontSize = px+'px';
    if (chip.scrollWidth <= maxW && chip.scrollHeight <= Math.max(maxH, 110)){
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

  on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });
  on(chip,'input', function(){ fitChipText(chip); queueAutosave(); });

  on(del,'click', function(){
    var ok = confirm('Delete this row? Items in it will return to Image Storage.');
    if(!ok) return;
    var tokens = $$('.token', drop);
    flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
    node.classList.add('removing');
    setTimeout(function(){ node.remove(); refreshRadialOptions(); queueAutosave();
      historyStack.push({type:'row-delete', rowHTML: node.outerHTML}); updateUndo();
    }, 260);
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

/* ---------- Preset names ---------- */
var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Harry","Jay","Jeremy","Katie","Kiev","Kikki","Kyle","Lewis","Meegan",
  "Munch","Paper","Ray","Safoof","Temz","TomTom","V","Versse","Xavier"
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
  var toned = mixHex(safe, hex, 0.20);
  var guard = 0;
  while (contrastForBlack(toned) < target && guard < 4){ toned = lighten(toned, 0.01); guard++; }
  return toned;
}
var presetPalette = BASE_PALETTE.map(ensureForBlack);
/* rotate start index each load so names don't keep same colors */
var pIndex = Math.floor(Math.random() * presetPalette.length);
function nextPreset(){ var c=presetPalette[pIndex%presetPalette.length]; pIndex++; return c; }

/* ---------- Token label fitter ---------- */
function fitLiveLabel(lbl){
  if (!lbl) return;
  var token = lbl.parentElement;
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

  /* Keyboard reordering (unchanged) */
  on(el,'keydown', function(e){
    if(!(e.altKey || e.metaKey)) return;
    var zone = el.parentElement;
    if(!zone || !zone.classList.contains('dropzone') && zone.id!=='tray') return;

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
      var idx = rows.indexOf ? rows.indexOf(row) : rows.findIndex(function(r){return r===row;});
      var destRow = null;
      if(e.key==='ArrowUp'){ destRow = row ? rows[idx-1] : rows[rows.length-1]; }
      else{ destRow = row ? rows[idx+1] : rows[0]; }
      if(destRow){ moveToken(el, destRow.querySelector('.tier-drop'), null); el.focus(); }
    }
  });

  /* ✅ Mobile: open radial on single tap while in tray */
  on(el,'pointerdown', function(e){
    if(!isSmall()) return;
    if(e.pointerType!=='touch' && e.pointerType!=='pen') return;
    if(!el.closest('#tray')) return;
    e.preventDefault();
    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    el.classList.add('selected');
    openRadial(el);
  }, _supportsPassive?{passive:false}:false);

  /* Click selection logic */
  on(el,'click', function(ev){
    ev.stopPropagation();
    var already = el.classList.contains('selected');
    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    var inTray = !!el.closest('#tray');
    if (!already){
      el.classList.add('selected');
      if (isSmall() && inTray) openRadial(el);
    } else if (isSmall() && inTray){
      closeRadial();
    }
  });

  if (!isSmall()){
    if (window.PointerEvent) enablePointerDrag(el);
    else enableMouseTouchDragFallback(el);
  }else{
    enableMobileTouchDrag(el);
  }
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
    var r=document.getElementById(last.rowId);
    var before = last.fromBeforeId ? document.getElementById(last.fromBeforeId) : null;
    var container = $('#tierBoard');
    if (r && container){
      if(before && before.parentElement===container) container.insertBefore(r,before); else container.appendChild(r);
    }
  } else if (last.type==='row-delete'){
    var container = $('#tierBoard');
    if(container){
      var tmp=document.createElement('div'); tmp.innerHTML=last.rowHTML.trim();
      var row=tmp.firstElementChild;
      container.appendChild(row);
      var chip=$('.label-chip',row), del=$('.row-del',row), drop=$('.tier-drop',row), handle=$('.row-handle',row);
      setIcon(del,'close');
      enableRowReorder(handle,row); enableClickToPlace(drop);
      on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });
      on(chip,'input', function(){ fitChipText(chip); queueAutosave(); });
      on(del,'click', function(){
        if(!confirm('Delete this row? Items in it will return to Image Storage.')) return;
        var tokens = $$('.token', drop);
        flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
        row.classList.add('removing');
        setTimeout(function(){ row.remove(); refreshRadialOptions(); queueAutosave();
          historyStack.push({type:'row-delete', rowHTML: row.outerHTML}); updateUndo();
        }, 260);
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
    node.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-item');

    originNext = node.nextElementSibling;

    var r=node.getBoundingClientRect(); offsetX=e.clientX-r.left; offsetY=e.clientY-r.top; x=e.clientX; y=e.clientY;
    ghost = node.cloneNode(true); ghost.classList.add('drag-ghost','dragging-cue'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden','dragging-cue');

    function move(ev){ x=ev.clientX; y=ev.clientY; }
    function up(){
      try{ node.releasePointerCapture(e.pointerId); }catch(_){}
      document.removeEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
      document.removeEventListener('pointerup', up, false);
      cancelAnimationFrame(raf);
      var target = document.elementFromPoint(x,y);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden','dragging-cue');
      document.body.classList.remove('dragging-item');

      var zone = getDropZoneFromElement(target);
      if (zone){
        var beforeTok = insertBeforeForPoint(zone,x,y,node);
        moveToken(node, zone, beforeTok);
        node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
      } else {
        if (originNext && originNext.parentElement===node.parentElement) {
          moveToken(node, node.parentElement, originNext);
        }
      }
      if (currentZone) currentZone.classList.remove('drag-over');
      currentZone=null;
    }

    document.addEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
    document.addEventListener('pointerup', up, false);
    loop();

    function loop(){
      raf = requestAnimationFrame(loop);
      ghost.style.transform = 'translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';
      var el = document.elementFromPoint(x,y);
      var zone = getDropZoneFromElement(el);
      if (currentZone && currentZone!==zone) currentZone.classList.remove('drag-over');
      if (zone && zone!==currentZone) zone.classList.add('drag-over');
      currentZone = zone || null;
    }
  });
}
function enableMouseTouchDragFallback(node){ on(node,'mousedown', function(e){ e.preventDefault(); }); }
function enableMobileTouchDrag(node){
  if(!('PointerEvent' in window)) return;
  on(node,'pointerdown',function(e){
    if(!isSmall())return;
    if(e.pointerType!=='touch' && e.pointerType!=='pen')return;
    if(!node.closest('.tier-drop'))return;
    e.preventDefault(); node.setPointerCapture(e.pointerId); document.body.classList.add('dragging-item');

    var ghost=node.cloneNode(true); ghost.classList.add('drag-ghost','dragging-cue'); document.body.appendChild(ghost);
    var originNext=node.nextElementSibling;
    node.classList.add('drag-hidden','dragging-cue');

    var r=node.getBoundingClientRect(), offsetX=e.clientX-r.left, offsetY=e.clientY-r.top, x=e.clientX, y=e.clientY;

    function move(ev){x=ev.clientX;y=ev.clientY; ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';}
    function up(){
      try{node.releasePointerCapture(e.pointerId);}catch(_){}
      document.removeEventListener('pointermove',move,_supportsPassive?{passive:true}:false);
      document.removeEventListener('pointerup',up,false);
      if(ghost&&ghost.parentNode)ghost.parentNode.removeChild(ghost);
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

/* ---------- Radial picker (mobile): compact + edge guard ---------- */
var radial = $('#radialPicker');
var radialOpts = radial?$('.radial-options', radial):null;
var radialCloseBtn = radial?$('.radial-close', radial):null;
var radialForToken = null;

function uniformCenter(cx, cy, R){
  var M=16; return { x: Math.max(M+R, Math.min(window.innerWidth-M-R, cx)), y: Math.max(M+R, cy) };
}
function refreshRadialOptions(){ if (!isSmall() || !radial || !radialForToken) return; openRadial(radialForToken); }

/* little spring */
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
  radialForToken = token;
  if (radialCloseBtn) radialCloseBtn.setAttribute('type','button');

  var rect = token.getBoundingClientRect();
  var cx = rect.left + rect.width/2;
  var cy = rect.top + rect.height/2;

  var rows = $$('.tier-row');
  var labels = rows.map(function(r){ return rowLabel(r); });
  var N = labels.length; if (!N) return;

  var DOT=42, GAP=6;
  var degStart=210, degEnd=330;
  var stepDeg=(degEnd-degStart)/Math.max(1,(N-1));
  var stepRad=stepDeg*Math.PI/180;
  var BASE_R=92, need=(DOT+GAP)/(2*Math.sin(Math.max(stepRad/2,0.06)));
  var R=Math.max(BASE_R, Math.min(110, need));
  var EDGE=32;

  var center=uniformCenter(cx, cy, R);
  if (center.x - R < EDGE) center.x = EDGE + R;

  radialOpts.innerHTML = '';
  for (let j=0;j<N;j++){
    var row = rows[j];
    var ang=(degStart+stepDeg*j)*Math.PI/180;
    var x=center.x+R*Math.cos(ang), y=center.y+R*Math.sin(ang);

    var btn = document.createElement('button');
    btn.type='button'; btn.className='radial-option';
    btn.style.left = x+'px';
    btn.style.top  = y+'px';
    var dot=document.createElement('span'); dot.className='dot'; dot.textContent=labels[j]; btn.appendChild(dot);

    on(btn,'pointerenter', function(){ btn.classList.add('is-hot'); });
    on(btn,'pointerleave', function(){ btn.classList.remove('is-hot'); });
    on(btn,'pointerdown', function(e){ e.preventDefault(); });
    on(btn,'click', function(){ moveToken(token, row.querySelector('.tier-drop'), null); closeRadial(); });

    radialOpts.appendChild(btn);
    springIn(btn, j*24);
  }

  function backdrop(ev){
    if(ev.target.closest('.radial-option') || ev.target.closest('.radial-close')) return;
    var x=(ev.touches&&ev.touches[0]?ev.touches[0].clientX:ev.clientX);
    var y=(ev.touches&&ev.touches[0]?ev.touches[0].clientY:ev.clientY);
    var prevPE=radial.style.pointerEvents; radial.style.pointerEvents='none';
    var under=document.elementFromPoint(x,y); radial.style.pointerEvents=prevPE||'auto';
    var other=under && under.closest && under.closest('#tray .token');
    if(other){ closeRadial(); $$('.token.selected').forEach(function(t){t.classList.remove('selected');}); other.classList.add('selected'); openRadial(other); ev.preventDefault(); return; }
    closeRadial();
  }
  radial.addEventListener('pointerdown',backdrop,{passive:false});
  radial._backdropHandler=backdrop;

  radial.classList.remove('hidden');
  radial.setAttribute('aria-hidden','false');

  /* center close button */
  if (radialCloseBtn){
    radialCloseBtn.style.left = center.x+'px';
    radialCloseBtn.style.top  = center.y+'px';
    springIn(radialCloseBtn, 40);
  }
}
if(radialCloseBtn){ on(radialCloseBtn,'click', function(e){ e.stopPropagation(); closeRadial(); }, false); }
function closeRadial(){
  if(!radial) return;
  if(radial._backdropHandler){ radial.removeEventListener('pointerdown', radial._backdropHandler); delete radial._backdropHandler; }
  radial.classList.add('hidden');
  radial.setAttribute('aria-hidden','true');
  radialOpts && (radialOpts.innerHTML='');
  radialForToken = null;
}
on(window,'resize', refreshRadialOptions);

/* ---------- EXPORT: 1200px, keep style, title only if present ---------- */
(function(){
  function isCrossOriginUrl(url){
    try{
      if (!url) return false;
      if (url.startsWith('data:')) return false;
      const u = new URL(url, location.href);
      return u.origin !== location.origin;
    }catch(_){ return false; }
  }

  var overlay=document.createElement('div');
  overlay.id='exportOverlay'; overlay.setAttribute('aria-live','polite');
  overlay.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;';
  overlay.innerHTML='<div style="padding:14px 18px;border-radius:10px;background:#111;color:#fff;font-weight:600;display:flex;gap:10px;align-items:center;"><span class="spinner" style="width:18px;height:18px;border-radius:50%;border:3px solid #fff;border-right-color:transparent;display:inline-block;animation:spin .9s linear infinite;"></span><span>Rendering PNG…</span></div>';
  document.body.appendChild(overlay);
  var style=document.createElement('style'); style.textContent='@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(style);

  on($('#saveBtn'),'click', function(){
    this.classList.add('bounce-anim');
    once(this,'animationend',()=>this.classList.remove('bounce-anim'));

    if (typeof html2canvas !== 'function'){
      alert('Sorry, PNG export is unavailable (html2canvas not loaded).'); return;
    }

    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

    var panel = $('#boardPanel');
    if(!panel){ alert('Could not find the board to export.'); return; }

    overlay.style.display='flex';
    document.body.style.pointerEvents = 'none';

    html2canvas(panel, {
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
        doc.documentElement.classList.add('exporting','desktop-capture');

        var wrap = doc.querySelector('.wrap');
        if (wrap){ wrap.style.maxWidth='1200px'; wrap.style.width='1200px'; }

        var clone = doc.querySelector('#'+panel.id);
        if (!clone) return;

        /* remove only non-visual controls */
        clone.querySelectorAll('.row-del,.title-pen,.radial,[data-nonexport]').forEach(function(n){ n.remove(); });

        /* hide default/blank title (capture only custom one) */
        var DEFAULT_TITLE_PLACEHOLDER = 'Tier Board (optional title)';
        var liveTitle = document.querySelector('.board-title');
        var cloneTitle = clone.querySelector('.board-title');
        function isTitleProvided(t){
          if(!t) return false;
          var raw = (t.textContent || '').trim();
          if(!raw) return false;
          return raw.toLowerCase() !== DEFAULT_TITLE_PLACEHOLDER.toLowerCase();
        }
        if (cloneTitle && !isTitleProvided(liveTitle)){
          var wrapTitle = cloneTitle.closest('.board-title-wrap');
          if (wrapTitle && wrapTitle.parentNode) wrapTitle.parentNode.removeChild(wrapTitle);
          clone.classList.add('no-title');
        }

        /* freeze motion only; keep look */
        var reset = doc.createElement('style');
        reset.textContent = `
          .exporting *{ animation:none !important; transition:none !important; }
          .exporting .token, .exporting .token:hover, .exporting .animate-drop, .exporting .flip-anim{ transform:none !important; }
          .exporting .token::after{ content:none !important; display:none !important; }
          .exporting .board-title[contenteditable]:empty::before{ content:'' !important; }
          .exporting .tier-row{ grid-template-columns:180px 1fr !important; }
        `;
        doc.head.appendChild(reset);

        /* CORS for same-origin images */
        clone.querySelectorAll('img').forEach(function(img){
          var src = img.getAttribute('src')||'';
          if (!src.startsWith('data:')) {
            try{
              if (new URL(src, location.href).origin === location.origin){
                img.setAttribute('crossorigin','anonymous');
              }
            }catch(_){}
          }
        });
      }
    }).then(function(canvas){
      var a=document.createElement('a');
      a.href=canvas.toDataURL('image/png');
      a.download='tier-list.png';
      document.body.appendChild(a); a.click(); a.remove();
    }).catch(function(err){
      console.error('Export failed', err);
      alert('Sorry, something went wrong while exporting.');
    }).finally(function(){
      overlay.style.display='none';
      document.body.style.pointerEvents = '';
    });
  });
})();

/* ---------- Autosave ---------- */
var AUTOSAVE_KEY='tm_autosave_v1';
function serializeState(){
  var state={ rows:[], tray:[], version:1 };
  $$('.tier-row').forEach(function(r){
    var chip=$('.label-chip',r), wrap=$('.tier-label',r);
    var color = (chip && chip.dataset.color) || (wrap && wrap.dataset.color) || '#8b7dff';
    var entry={ label: chip.textContent, color: color, items: [] };
    $$('.token', r.querySelector('.tier-drop')).forEach(function(tok){
      if (tok.querySelector('img')) entry.items.push({t:'i', src: tok.querySelector('img').src});
      else entry.items.push({t:'n', text: $('.label',tok).textContent, color: tok.style.background});
    });
    state.rows.push(entry);
  });
  $$('#tray .token').forEach(function(tok){
    if (tok.querySelector('img')) state.tray.push({t:'i', src: tok.querySelector('img').src});
    else state.tray.push({t:'n', text: $('.label',tok).textContent, color: tok.style.background});
  });
  return state;
}
function restoreState(state){
  if(!state || !state.rows) return false;
  $('#tierBoard').innerHTML='';
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
function queueAutosave(){ try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeState())); }catch(_){ } }
function maybeClearAutosaveOnReload(){
  try{
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload'){ localStorage.removeItem(AUTOSAVE_KEY); }
  }catch(_){}
}

/* ---------- Full reset ---------- */
function resetToDefault(){
  try { closeRadial(); } catch(_) {}
  historyStack = []; updateUndo();
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch(_) {}

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
    pIndex = Math.floor(Math.random() * presetPalette.length);
    communityCast.forEach(function(n){
      trayEl.appendChild(buildNameToken(n, nextPreset(), true));
    });
  }

  $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
  $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

  refitAllLabels(); refitAllChips();
  announce('Everything reset to defaults.');
}

/* ---------- Desktop inline-controls merge (unchanged) ---------- */
function setupDesktopControlsMerge(){
  var controls = $('.controls'); if(!controls) return;
  var controlsPanel = controls.closest('.panel'); if(controlsPanel) controlsPanel.classList.add('controls-panel');
  var trayPanel = $('#tray') ? $('#tray').closest('.panel') : null; if(!trayPanel) return;

  var homeMarker = document.createElement('div'); homeMarker.id='controlsHome';
  if (controlsPanel && !$('#controlsHome')) controlsPanel.insertBefore(homeMarker, controls);

  var title = trayPanel.querySelector('.section-title');
  var titleHome = document.createElement('div'); titleHome.id='titleHome';
  if (title && !$('#titleHome')) title.parentNode.insertBefore(titleHome, title.nextSibling);

  var sectionBar = document.createElement('div'); sectionBar.className='section-bar';
  var inlineWrap = document.createElement('div'); inlineWrap.className='controls-inline';

  function apply(){
    if (isDesktopWide()){
      if (!sectionBar.parentNode){ trayPanel.insertBefore(sectionBar, $('#tray')); }
      if (title && title.parentNode !== sectionBar){ sectionBar.appendChild(title); }
      if (!inlineWrap.parentNode){ sectionBar.appendChild(inlineWrap); }
      if (controls.parentNode !== inlineWrap){ inlineWrap.appendChild(controls); }
      document.body.classList.add('controls-merged');
    } else {
      if (titleHome && titleHome.parentNode && title && title.parentNode !== titleHome.parentNode){
        titleHome.parentNode.insertBefore(title, titleHome);
      }
      if (homeMarker && homeMarker.parentNode && controls.parentNode !== homeMarker.parentNode){
        homeMarker.parentNode.insertBefore(controls, homeMarker.nextSibling);
      }
      document.body.classList.remove('controls-merged');
      if (inlineWrap.parentNode) inlineWrap.parentNode.removeChild(inlineWrap);
      if (sectionBar.parentNode) sectionBar.parentNode.removeChild(sectionBar);
    }
  }

  apply();
  on(window,'resize', debounce(apply, 120));
}

/* ---------- Help content: device-specific, no bullets ---------- */
function setHelp(){
  var help=$('#helpText') || $('.help'); if(!help) return;
  var isM = isSmall();
  var tip = isM
    ? '<strong>Help</strong><p>Phone: tap a circle in the storage to pick a row. Once placed, drag to reorder or drag back. Tap a tier label to edit. Tap the small “X” on a tier to delete it.</p>'
    : '<strong>Help</strong><p>Desktop/iPad: drag circles into rows. Use Alt+←/→ to move within a row, Alt+↑/↓ between rows. Click a tier label to edit. Click the small “X” on a tier to delete it.</p>';
  help.setAttribute('role','note');
  help.setAttribute('aria-live','polite');
  help.innerHTML = tip;
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function start(){
  board = $('#tierBoard'); tray = $('#tray');

  swapAllIcons();
  maybeClearAutosaveOnReload();

  var saved=null;
  try{ saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)||'null'); }catch(_){}
  if (saved && restoreState(saved)){
    announce('Restored your last session.'); 
  } else {
    defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });
    communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset(), true)); });
  }

  on($('#addTierBtn'),'click', function(){
    this.classList.add('bounce-anim');
    once(this,'animationend',()=>this.classList.remove('bounce-anim'));
    var row = createRow({label:'NEW', color: nextTierColor()});
    board.appendChild(row);
    var chip = $('.label-chip', row); if (chip) chip.focus();
    refreshRadialOptions(); queueAutosave();
  });

  on($('#addNameBtn'),'click', function(){
    var nameInput = $('#nameInput'); var colorInput = $('#nameColor');
    var name = nameInput.value.trim(); if (!name) return;
    var chosen = colorInput.value;
    tray.appendChild(buildNameToken(name, chosen, false));
    nameInput.value='';
    colorInput.value = nextPreset();
    refitAllLabels(); queueAutosave();
  });

  on($('#imageInput'),'change', function(e){
    Array.prototype.forEach.call(e.target.files, function(file){
      if(!file.type || file.type.indexOf('image/')!==0) return;
      var reader = new FileReader();
      reader.onload = function(ev){ tray.appendChild(buildImageToken(ev.target.result, file.name)); queueAutosave(); };
      reader.readAsDataURL(file);
    });
  });

  setHelp();
  on(window,'resize', debounce(setHelp, 150));

  enableClickToPlace(tray);
  announce('Ready.');
  updateUndo();
  refitAllLabels();
  refitAllChips();

  setupDesktopControlsMerge();

  on($('#trashClear'),'click', function(){
    var ok = confirm('Reset everything to the original state? This clears all circles, custom labels, uploaded items, and the title.');
    if (!ok) return;
    resetToDefault();
  });
});