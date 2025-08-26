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

/* ---------- Theme toggle keeps current styles in sync ---------- */
(function(){
  var root=document.documentElement;
  var toggle=$('#themeToggle'); if(!toggle) return;
  var icon=$('.theme-icon',toggle), text=$('.theme-text',toggle);
  var prefersLight=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);
  setTheme(localStorage.getItem('tm_theme') || (prefersLight ? 'light' : 'dark'));
  on(toggle,'click', function(){ setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark'); });
  function setTheme(mode){
    root.setAttribute('data-theme', mode); localStorage.setItem('tm_theme', mode);
    var target = mode==='dark' ? 'Light' : 'Dark';
    if(text) text.textContent = target;
    if(icon) icon.innerHTML = (target==='Light'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.22 19.78l1.79-1.79 1.8 1.79-1.8 1.8-1.79-1.8zM20 13h3v-2h-3v2zM12 1h2v3h-2V1zm6.01 3.05l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>');
    // re-tint row backgrounds based on label color
    $$('.tier-row').forEach(function(row){
      var chip=$('.label-chip',row), drop=$('.tier-drop',row);
      if (drop && drop.dataset.manual!=='true'){
        drop.style.background = tintFrom(chip && chip.dataset.color ? chip.dataset.color : '#8b7dff');
      }
    });
  }
})();

/* ---------- Globals ---------- */
var board=null, tray=null;

/* ---------- FLIP animation helper ---------- */
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
  del.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7L12 12l-6.3-6.3-1.4 1.4L10.6 13.4l-6.3 6.3 1.4 1.4L12 14.4l6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3z"/></svg>';

  labelWrap.appendChild(handle);
  labelWrap.appendChild(chip);
  labelWrap.appendChild(del);

  var drop=document.createElement('div');
  drop.className='tier-drop dropzone'; drop.setAttribute('tabindex','0');

  row.appendChild(labelWrap); row.appendChild(drop);
  return { row: row, chip: chip, del: del, drop: drop, handle: handle };
}
function tintFrom(color){
  var surface = cssVar('--surface') || '#111219';
  var a=hexToRgb(surface), b=hexToRgb(color);
  var dark = document.documentElement.getAttribute('data-theme')!=='light';
  var amt = dark?0.14:0.09;
  return rgbToHex(
    Math.round(a.r+(b.r-a.r)*amt),
    Math.round(a.g+(b.g-a.g)*amt),
    Math.round(a.b+(b.b-a.b)*amt)
  );
}
function rowLabel(row){ var chip=row?row.querySelector('.label-chip'):null; return chip?chip.textContent.replace(/\s+/g,' ').trim():'row'; }

/* ---------- Tier-label sizing (NEW) ---------- */
/* 1) Keep the chip’s native width (never grows horizontally).
   2) Auto-size the chip’s text so long labels shrink and can wrap.
   3) Chip may grow vertically; stays centered. */
function setChipWidthClamp(row){
  var wrap = row.querySelector('.tier-label');
  var chip = row.querySelector('.label-chip');
  var handle = row.querySelector('.row-handle');
  var del = row.querySelector('.row-del');
  if (!wrap || !chip) return;

  // 1) remember native width the very first time
  if (!chip.dataset.nativeW) {
    chip.dataset.nativeW = String(Math.max(80, Math.round(chip.getBoundingClientRect().width || 120)));
  }
  var nativeW = parseFloat(chip.dataset.nativeW);

  // Available inner width of the labelWrap minus handle/del + gutter
  var cs = getComputedStyle(wrap);
  var inner = wrap.clientWidth
    - (parseFloat(cs.paddingLeft)||0)
    - (parseFloat(cs.paddingRight)||0);

  var reserve = 0;
  if (handle) reserve += (handle.offsetWidth || 40) + 8;
  if (del)    reserve += (del.offsetWidth    || 40) + 8;

  var gutter = 16;
  var allowed = Math.max(80, inner - reserve - gutter);

  // Final fixed width: keep native unless layout forces us smaller
  var finalW = Math.min(nativeW, allowed);
  chip.style.width = finalW + 'px';
  chip.style.maxWidth = finalW + 'px';
}

function fitTierLabelText(chip){
  if (!chip) return;

  // allow wrapping; center; let height expand
  chip.style.whiteSpace = 'normal';
  chip.style.wordBreak  = 'break-word';
  chip.style.hyphens    = 'auto';
  chip.style.textAlign  = 'center';
  chip.style.lineHeight = '1.05';
  chip.style.display    = 'flex';
  chip.style.alignItems = 'center';
  chip.style.justifyContent = 'center';
  chip.style.padding = '6px 10px';
  chip.style.overflow = 'hidden';

  // Binary search the largest font that never overflows horizontally.
  // Start generous so single letters are big.
  var W = chip.clientWidth - 20; // minus padding
  var minPx = 10;
  var maxPx = Math.max(28, Math.floor(Math.min(200, W * 0.95))); // let single letters get large
  var best = minPx;

  function fits(px){
    chip.style.fontSize = px + 'px';
    // No horizontal overflow if scrollWidth <= clientWidth
    return chip.scrollWidth <= chip.clientWidth;
  }
  while (minPx <= maxPx){
    var mid = (minPx + maxPx) >> 1;
    if (fits(mid)){ best = mid; minPx = mid + 1; }
    else { maxPx = mid - 1; }
  }
  chip.style.fontSize = best + 'px';
}

function fitAllTierLabels(){
  $$('.tier-row').forEach(function(row){
    setChipWidthClamp(row);
    fitTierLabelText($('.label-chip', row));
  });
}

/* ---------- Create / wire a row ---------- */
function createRow(cfg){
  var dom = buildRowDom();
  var node = dom.row, chip = dom.chip, del = dom.del, drop = dom.drop, handle = dom.handle;

  chip.textContent = cfg.label;
  chip.dataset.color = cfg.color;
  chip.style.background = cfg.color;
  chip.style.color = contrastColor(cfg.color);
  del.style.background = darken(cfg.color, 0.35);

  var tint = tintFrom(cfg.color);
  drop.style.background = tint; drop.dataset.manual = 'false';

  on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });
  on(chip,'input', function(){ setChipWidthClamp(node); fitTierLabelText(chip); queueAutosave(); });

  on(del,'click', function(){
    var ok = confirm('Delete this row? Items in it will return to Image Storage.');
    if(!ok) return;
    var tokens = $$('.token', drop);
    flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
    node.remove(); refreshRadialOptions(); queueAutosave();
    historyStack.push({type:'row-delete', rowHTML: node.outerHTML});
    updateUndo();
  });

  enableRowReorder(handle, node);
  enableClickToPlace(drop);

  // Initial clamp & fit
  setTimeout(function(){ setChipWidthClamp(node); fitTierLabelText(chip); },0);

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

/* ---------- Tier cycle (new rows) ---------- */
var TIER_CYCLE = ['#ff6b6b','#f6c02f','#22c55e','#3b82f6','#a78bfa','#06b6d4','#e11d48','#16a34a','#f97316','#0ea5e9'];
var tierIdx = 0; function nextTierColor(){ var c=TIER_CYCLE[tierIdx%TIER_CYCLE.length]; tierIdx++; return c; }

/* ---------- Preset names (Tems→Temz, Verse→Versse) ---------- */
var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Harry","Jay","Jeremy","Katie","Keyon","Kiev","Kikki","Kyle","Lewis","Meegan",
  "Munch","Paper","Ray","Safoof","Temz","TomTom","V","Versse","Wobbles","Xavier"
];

/* ---------- Palette (already tuned earlier) ---------- */
var BASE_PALETTE = [
  '#FCE38A','#F3A683','#F5CD7A','#F7D794',
  '#778BEB','#EB8688','#CF6A87','#786FA6',
  '#F8A5C2','#64CDDB','#3EC1D3','#E77F67',
  '#FA991C','#FAD4C9','#7FC4D4','#A7B3E9',
  '#FBD78B','#EFA7A7','#9FD8DF','#C8B6FF',
  '#B8E1FF','#FFD6A5','#C3F0CA','#FFE5EC',
  '#F4B942','#9EE493','#8AC6D1','#FF8FAB','#B0A8F0'
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

/* ---------- Live label fitter for TOKENS (circles) — unchanged ---------- */
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
on(window,'resize', debounce(function(){ refitAllTierLabels(); refitAllLabels(); }, 120));

/* ---------- Tokens ---------- */
function buildTokenBase(){
  var el = document.createElement('div');
  el.className='token'; el.id = uid(); el.setAttribute('tabindex','0'); el.setAttribute('role','listitem');
  el.style.touchAction='none'; el.setAttribute('draggable','false');

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
      if(e.key==='ArrowUp'){
        destRow = row ? rows[idx-1] : rows[rows.length-1];
      }else{
        destRow = row ? rows[idx+1] : rows[0];
      }
      if(destRow){
        moveToken(el, destRow.querySelector('.tier-drop'), null);
        el.focus();
      }
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
  return {
    itemId: node.id || (node.id=uid()),
    fromId: parent.id || (parent.id=uid()),
    fromBeforeId: fromBefore
  };
}

function moveToken(node, toZone, beforeTok){
  var snap = snapshotBefore(node);
  var toId = toZone.id || (toZone.id=uid());
  var beforeId = beforeTok ? (beforeTok.id || (beforeTok.id=uid())) : '';
  var originParent = node.parentElement;
  flipZones([originParent, toZone], function(){
    if(beforeTok) toZone.insertBefore(node,beforeTok); else toZone.appendChild(node);
  });
  historyStack.push({
    type:'move',
    itemId:snap.itemId,
    fromId:snap.fromId,
    fromBeforeId:snap.fromBeforeId,
    toId:toId,
    toBeforeId:beforeId
  });
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
      if(before && before.parentElement===container) container.insertBefore(r,before);
      else container.appendChild(r);
    }
  } else if (last.type==='row-delete'){
    var container = $('#tierBoard');
    if(container){
      var tmp=document.createElement('div'); tmp.innerHTML=last.rowHTML.trim();
      var row=tmp.firstElementChild;
      container.appendChild(row);
      var chip=$('.label-chip',row), del=$('.row-del',row), drop=$('.tier-drop',row), handle=$('.row-handle',row);
      enableRowReorder(handle,row); enableClickToPlace(drop);
      on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });
      on(chip,'input', function(){ setChipWidthClamp(row); fitTierLabelText(chip); queueAutosave(); });
      on(del,'click', function(){
        if(!confirm('Delete this row? Items in it will return to Image Storage.')) return;
        var tokens = $$('.token', drop);
        flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
        row.remove(); refreshRadialOptions(); queueAutosave();
        historyStack.push({type:'row-delete', rowHTML: row.outerHTML}); updateUndo();
      });
      setChipWidthClamp(row); fitTierLabelText(chip);
    }
  }
  updateUndo(); queueAutosave();
});

/* ---------- Insert position helper ---------- */
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
  on(zone,'click', function(e){
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

/* ---------- Pointer drag (desktop) ---------- */
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
    ghost = node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden');

    function move(ev){ x=ev.clientX; y=ev.clientY; }
    function up(){
      try{ node.releasePointerCapture(e.pointerId); }catch(_){}
      document.removeEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
      document.removeEventListener('pointerup', up, false);
      cancelAnimationFrame(raf);
      var target = document.elementFromPoint(x,y);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden');
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

/* ---------- Legacy mouse/touch fallback (desktop) ---------- */
function enableMouseTouchDragFallback(node){
  on(node,'mousedown', function(e){ e.preventDefault(); });
}

/* ---------- Mobile touch drag (placed tokens) ---------- */
function enableMobileTouchDrag(node){
  if(!('PointerEvent' in window)) return;
  on(node,'pointerdown',function(e){
    if(!isSmall())return;
    if(e.pointerType!=='touch' && e.pointerType!=='pen')return;
    if(!node.closest('.tier-drop'))return;
    e.preventDefault(); node.setPointerCapture(e.pointerId); document.body.classList.add('dragging-item');

    var ghost=node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    var originNext=node.nextElementSibling;
    node.classList.add('drag-hidden');

    var r=node.getBoundingClientRect(), offsetX=e.clientX-r.left, offsetY=e.clientY-r.top, x=e.clientX, y=e.clientY;

    function move(ev){x=ev.clientX;y=ev.clientY; ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';}
    function up(){
      try{node.releasePointerCapture(e.pointerId);}catch(_){}
      document.removeEventListener('pointermove',move,_supportsPassive?{passive:true}:false);
      document.removeEventListener('pointerup',up,false);
      if(ghost&&ghost.parentNode)ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden'); document.body.classList.remove('dragging-item');

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

/* ---------- Row reorder with handle ---------- */
function enableRowReorder(handle, row){
  var placeholder=null, originNext=null;

  function arm(e){
    row.setAttribute('draggable','true');
    originNext = row.nextElementSibling;
  }
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

/* ---------- Radial picker (mobile) ---------- */
var radial = $('#radialPicker');
var radialOpts = radial?$('.radial-options', radial):null;
var radialCloseBtn = radial?$('.radial-close', radial):null;
var radialForToken = null;
var _radialGeo = [];

function rowCount(){ return $$('.tier-row').length; }
function uniformCenter(cx, cy, R){
  var M=16; return { x: Math.max(M+R, Math.min(window.innerWidth-M-R, cx)), y: Math.max(M+R, cy) };
}
function refreshRadialOptions(){ if (!isSmall() || !radial || !radialForToken) return; openRadial(radialForToken); }

function openRadial(token){
  if(!radial||!isSmall()) return;
  radialForToken = token;

  var rect = token.getBoundingClientRect();
  var cx = rect.left + rect.width/2;
  var cy = rect.top + rect.height/2;

  var rows = $$('.tier-row');
  var labels = rows.map(function(r){ return rowLabel(r); });
  var N = labels.length; if (!N) return;

  var DOT=42, GAP=6, degStart=200, degEnd=340, stepDeg=(degEnd-degStart)/Math.max(1,(N-1)), stepRad=stepDeg*Math.PI/180;
  var BASE_R=96, need=(DOT+GAP)/(2*Math.sin(Math.max(stepRad/2,0.05)));
  var R=Math.max(BASE_R, need);
  var center=uniformCenter(cx,cy,R);

  var positions=[];
  for (var i=0;i<N;i++){
    var ang=(degStart+stepDeg*i)*Math.PI/180;
    positions.push({ i:i, x:center.x+R*Math.cos(ang), y:center.y+R*Math.sin(ang) });
  }
  positions.sort(function(a,b){ return a.x - b.x; });
  _radialGeo = [];

  radialCloseBtn.style.left = cx+'px';
  radialCloseBtn.style.top  = cy+'px';

  radialOpts.innerHTML = '';
  for (let j=0;j<N;j++){
    (function(j){
      var row = rows[j];
      var pos = positions[j];
      var btn = document.createElement('button');
      btn.type='button'; btn.className='radial-option';
      btn.style.left = pos.x+'px';
      btn.style.top  = pos.y+'px';
      btn.style.transitionDelay = (j*14)+'ms';
      var dot=document.createElement('span'); dot.className='dot'; dot.textContent=labels[j]; btn.appendChild(dot);

      on(btn,'pointerenter', function(){ btn.classList.add('is-hot'); });
      on(btn,'pointerleave', function(){ btn.classList.remove('is-hot'); });
      on(btn,'pointerdown', function(e){ e.preventDefault(); });
      on(btn,'click', function(){ moveToken(token, row.querySelector('.tier-drop'), null); closeRadial(); });
      radialOpts.appendChild(btn);
      _radialGeo.push({row:row, btn:btn});
    })(j);
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
  radial.classList.add('visible','show');
  radial.setAttribute('aria-hidden','false');
  setTimeout(function(){ radial.classList.remove('show'); }, 160 + N*14);
}
if(radialCloseBtn){ on(radialCloseBtn,'click', function(e){ e.stopPropagation(); closeRadial(); }, false); }
function closeRadial(){
  if(!radial) return;
  if(radial._backdropHandler){ radial.removeEventListener('pointerdown', radial._backdropHandler); delete radial._backdropHandler; }
  radial.classList.add('hidden');
  radial.classList.remove('visible','show');
  radial.setAttribute('aria-hidden','true');
  radialForToken = null; _radialGeo = [];
}
on(window,'resize', refreshRadialOptions);

/* ---------- Clear / Undo buttons ---------- */
on($('#trashClear'),'click', function(){
  if (!confirm('Clear the entire tier board? Items move back to Image Storage.')) return;
  $$('.tier-drop .token').forEach(function(tok){ tray.appendChild(tok); });
  queueAutosave();
});

/* ---------- EXPORT: exact on-screen sizes ---------- */
(function(){
  var overlay=document.createElement('div');
  overlay.id='exportOverlay'; overlay.setAttribute('aria-live','polite');
  overlay.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;';
  overlay.innerHTML='<div style="padding:14px 18px;border-radius:10px;background:#111;color:#fff;font-weight:600;display:flex;gap:10px;align-items:center;"><span class="spinner" style="width:18px;height:18px;border-radius:50%;border:3px solid #fff;border-right-color:transparent;display:inline-block;animation:spin .9s linear infinite;"></span><span>Rendering PNG…</span></div>';
  document.body.appendChild(overlay);
  var style=document.createElement('style'); style.textContent='@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(style);

  on($('#saveBtn'),'click', function(){
    if (typeof html2canvas !== 'function'){
      alert('Sorry, PNG export is unavailable (html2canvas not loaded).'); return;
    }
    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

    var panel = $('#boardPanel');
    var cloneWrap = document.createElement('div');
    cloneWrap.style.position='fixed'; cloneWrap.style.left='-99999px'; cloneWrap.style.top='0';

    var clone = panel.cloneNode(true);
    clone.style.width = panel.getBoundingClientRect().width + 'px';
    var s = document.createElement('style'); s.textContent='.row-del{display:none !important;}'; clone.appendChild(s);

    var title = clone.querySelector('.board-title');
    if (title && title.textContent.replace(/\s+/g,'') === '') {
      var wrap = title.parentElement; if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    cloneWrap.appendChild(clone); document.body.appendChild(cloneWrap);
    overlay.style.display='flex';

    html2canvas(clone, {
      backgroundColor: cssVar('--surface') || null,
      useCORS: true,
      scale: 2,
      width: clone.getBoundingClientRect().width,
      windowWidth: Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    }).then(function(canvas){
      var a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tier-list.png';
      document.body.appendChild(a); a.click(); a.remove();
      cloneWrap.remove();
    }).catch(function(err){
      console.error('Export failed', err);
      alert('Sorry, something went wrong while exporting.');
      cloneWrap.remove();
    }).finally(function(){ overlay.style.display='none'; });
  });
})();

/* ---------- Color picker improvements ---------- */
(function(){
  var colorInput = $('#nameColor');
  var preview = $('#colorPreview');
  if (!preview) {
    var addBtn = $('#addNameBtn');
    preview=document.createElement('span'); preview.id='colorPreview';
    preview.setAttribute('aria-hidden','true');
    preview.style.cssText='display:inline-block;width:22px;height:22px;border-radius:50%;border:3px solid #111;margin-left:8px;vertical-align:middle;';
    if(addBtn && addBtn.parentElement) addBtn.parentElement.insertBefore(preview, addBtn);
  }
  function updatePreview(){ var v=colorInput.value || '#dddddd'; preview.style.background=v; }
  on(colorInput,'input', updatePreview);
  on(document,'DOMContentLoaded', updatePreview);
})();

/* ---------- Autosave (localStorage), cleared on hard refresh ---------- */
var AUTOSAVE_KEY='tm_autosave_v1';
function serializeState(){
  var state={ rows:[], tray:[], version:1 };
  $$('.tier-row').forEach(function(r){
    var chip=$('.label-chip',r);
    var entry={ label: chip.textContent, color: chip.dataset.color || '#8b7dff', items: [] };
    $$('.token', r.querySelector('.tier-drop')).forEach(function(tok){
      if (tok.querySelector('img')){
        entry.items.push({t:'i', src: tok.querySelector('img').src});
      } else {
        entry.items.push({t:'n', text: $('.label',tok).textContent, color: tok.style.background});
      }
    });
    state.rows.push(entry);
  });
  $$('#tray .token').forEach(function(tok){
    if (tok.querySelector('img')){
      state.tray.push({t:'i', src: tok.querySelector('img').src});
    } else {
      state.tray.push({t:'n', text: $('.label',tok).textContent, color: tok.style.background});
    }
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
  refitAllLabels();
  fitAllTierLabels();
  return true;
}
function queueAutosave(){ try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeState())); }catch(_){ } }
function maybeClearAutosaveOnReload(){
  try{
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload'){ localStorage.removeItem(AUTOSAVE_KEY); }
  }catch(_){}
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function start(){
  maybeClearAutosaveOnReload();

  board = $('#tierBoard'); tray = $('#tray');

  var saved=null;
  try{ saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)||'null'); }catch(_){}
  if (saved && restoreState(saved)){
    announce('Restored your last session.'); 
  } else {
    defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });
    communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset(), true)); });
  }

  on($('#addTierBtn'),'click', function(){
    board.appendChild(createRow({label:'NEW', color: nextTierColor()}));
    refreshRadialOptions(); queueAutosave();
    fitAllTierLabels();
  });

  on($('#addNameBtn'),'click', function(){
    var nameInput = $('#nameInput'); var colorInput = $('#nameColor');
    var name = nameInput.value.trim(); if (!name) return;
    var chosen = colorInput.value;
    tray.appendChild(buildNameToken(name, chosen, false));
    nameInput.value='';
    colorInput.value = nextPreset();
    var preview = $('#colorPreview'); if(preview) preview.style.background = colorInput.value;
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

  var help=$('#helpText') || $('.help');
  if(help){
    help.setAttribute('role','note');
    help.setAttribute('aria-live','polite');
    help.innerHTML =
      '<strong>Help</strong><br>' +
      (isSmall()
       ? 'Phone: tap a circle in Image Storage to choose a row. Once placed, drag to reorder or drag back to Image Storage.'
       : 'Desktop/iPad: drag circles into rows. Reorder by dragging items or use Alt+Arrow keys. Drag the grip to reorder rows.') +
      ' Click the tier label to edit it. Tap the small X on a tier label to delete that row (its items return to Image Storage).';
  }

  enableClickToPlace(tray);

  // Initial fits
  refitAllLabels();
  fitAllTierLabels();

  announce('Ready.');
  updateUndo();
});
