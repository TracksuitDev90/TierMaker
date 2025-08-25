/* ---------- Minimal polyfills (old Safari/edge cases) ---------- */
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

/* ---------- Helpers ---------- */
var $  = function (s, ctx){ return (ctx||document).querySelector(s); };
var $$ = function (s, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); };
function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function isSmall(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }
function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }
function live(msg){ var n=$('#live'); if(!n) return; n.textContent=''; setTimeout(function(){ n.textContent=msg; },0); }

var _supportsPassive=false;
try{ var _opts=Object.defineProperty({},"passive",{get:function(){_supportsPassive=true;}}); window.addEventListener("x",null,_opts); window.removeEventListener("x",null,_opts);}catch(e){}
function on(el,ev,fn,opt){ if(!el) return; if(!opt){ el.addEventListener(ev,fn,false); return; } if(typeof opt==="object" && !_supportsPassive){ el.addEventListener(ev,fn,!!opt.capture); } else { el.addEventListener(ev,fn,opt); }}

/* ---------- Color utilities ---------- */
function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3){ h=h.split('').map(function(x){return x+x;}).join(''); } var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
function relativeLuminance(rgb){ function srgb(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); } return 0.2126*srgb(rgb.r)+0.7152*srgb(rgb.g)+0.0722*srgb(rgb.b); }
function contrastColor(bgHex){ var L=relativeLuminance(hexToRgb(bgHex)); return L>0.58 ? '#000' : '#fff'; }
function lighten(hex,p){ var c=hexToRgb(hex), f=p||0; return rgbToHex(Math.round(c.r+(255-c.r)*f), Math.round(c.g+(255-c.g)*f), Math.round(c.b+(255-c.b)*f)); }
function darken(hex,p){ var c=hexToRgb(hex); var f=(1-(p||0)); return rgbToHex(Math.round(c.r*f),Math.round(c.g*f),Math.round(c.b*f)); }

/* ---------- Palette (20% less pale, still black-readable) ---------- */
var BASE_PALETTE = [
  '#FCE38A','#F3A683','#F5CD7A','#F7D794',
  '#778BEB','#EB8688','#CF6A87','#786FA6',
  '#F8A5C2','#64CDDB','#3EC1D3','#E77F67',
  '#FA991C','#7FC4D4','#A7B3E9','#FBD78B',
  '#EFA7A7','#9FD8DF','#C8B6FF','#B8E1FF',
  '#FFD6A5','#C3F0CA','#FFE5EC','#E77F67',
  '#E26042'
];
// keep colors closer to originals; only nudge if contrast vs black < 4.5:1
function ensureForBlack(hex){
  var out=hex, steps=0;
  function ratio(h){ var L=relativeLuminance(hexToRgb(h)); return (L+0.05)/0.05; }
  while(ratio(out) < 4.5 && steps < 3){ out = lighten(out, 0.03); steps++; }
  // 20% less “pale” than before → tiny counter-darken if we overshoot too bright
  if (ratio(out) > 9) out = darken(out, 0.96);
  return out;
}
var presetPalette = BASE_PALETTE.map(ensureForBlack);
var pIndex = 0; function nextPreset(){ var c = presetPalette[pIndex % presetPalette.length]; pIndex++; return c; }

/* ---------- Tier defaults ---------- */
var defaultTiers = [
  { label:'S', color:'#ff6b6b' },
  { label:'A', color:'#f6c02f' },   // a bit more yellow than orange
  { label:'B', color:'#22c55e' },
  { label:'C', color:'#3b82f6' },
  { label:'D', color:'#a78bfa' }
];
var TIER_CYCLE = ['#ff6b6b','#f6c02f','#22c55e','#3b82f6','#a78bfa','#06b6d4','#e11d48','#f97316','#16a34a','#0ea5e9'];
var tierIdx=0; function nextTierColor(){ var c=TIER_CYCLE[tierIdx%TIER_CYCLE.length]; tierIdx++; return c; }

/* ---------- Pre-rendered names (incl. Kikki, Tems, TomTom) ---------- */
var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Harry","Jay","Jeremy","Katie","Keyon","Kiev","Kikki","Kyle","Lewis",
  "Meegan","Munch","Paper","Ray","Safoof","Temz","TomTom","V","Versse","Wobbles","Xavier"
];

/* ---------- Label fitting (tokens + export) ---------- */
/* UI tokens: start big, shrink only as needed; keep single line, centered */
function fitTokenLabel(label, container){
  if(!label) return;
  var max = Math.floor(container.clientWidth * 0.33); // generous starting point
  var min = 11;
  label.style.whiteSpace = 'nowrap';
  label.style.lineHeight = '1';
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.justifyContent = 'center';
  label.style.height = '100%';
  label.style.padding = '0 8px';

  var left = min, right = max, best = Math.max(18, Math.min(26, max));
  function fits(px){
    label.style.fontSize = px + 'px';
    return label.scrollWidth <= (container.clientWidth - 16);
  }
  // bias upwards quickly then binary search
  var probe = best;
  while (probe <= right && fits(probe)) { best = probe; probe += 2; }
  right = probe; // last fail bound
  while (left <= right){
    var mid = (left + right) >> 1;
    if (fits(mid)){ best = mid; left = mid + 1; }
    else { right = mid - 1; }
  }
  label.style.fontSize = best + 'px';
}

/* Export fitter: recompute using the cloned DOM size (exactly-as-shown) */
function fitExportLabel(lbl){
  var token = lbl.parentElement;
  var inner = 10;
  lbl.style.whiteSpace='nowrap';
  lbl.style.lineHeight='1';
  lbl.style.display='flex';
  lbl.style.alignItems='center';
  lbl.style.justifyContent='center';
  lbl.style.height='100%';
  lbl.style.padding='0 '+inner+'px';
  var min = 12, max = Math.floor(token.clientWidth * 0.44), best = min;
  function fits(px){ lbl.style.fontSize = px + 'px'; return lbl.scrollWidth <= (token.clientWidth - inner*2); }
  while (min <= max){ var mid=(min+max)>>1; if(fits(mid)){ best=mid; min=mid+1; } else { max=mid-1; } }
  lbl.style.fontSize = best + 'px';
}

/* ---------- DOM refs ---------- */
var board=null, tray=null;

/* ---------- Build rows ---------- */
function tintFrom(color){
  var surface = cssVar('--surface') || '#0f1115';
  var a = hexToRgb(surface), b = hexToRgb(color);
  var dark = (document.documentElement.getAttribute('data-theme')!=='light');
  var amt = dark ? 0.14 : 0.09;
  return rgbToHex(
    Math.round(a.r+(b.r-a.r)*amt),
    Math.round(a.g+(b.g-a.g)*amt),
    Math.round(a.b+(b.b-a.b)*amt)
  );
}
function rowLabel(row){ var chip=row?row.querySelector('.label-chip'):null; return chip?chip.textContent.replace(/\s+/g,' ').trim():'Row'; }

function buildRowDom(){
  var row=document.createElement('div'); row.className='tier-row';
  var labelWrap=document.createElement('div'); labelWrap.className='tier-label'; labelWrap.setAttribute('aria-label','Tier label');
  var chip=document.createElement('div'); chip.className='label-chip'; chip.setAttribute('contenteditable','true'); chip.setAttribute('spellcheck','false');
  var del=document.createElement('button'); del.className='row-del'; del.type='button'; del.setAttribute('aria-label','Delete this row');
  del.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7L12 12l-6.3-6.3-1.4 1.4L10.6 13.4l-6.3 6.3 1.4 1.4L12 14.4l6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3z"/></svg>';
  labelWrap.appendChild(chip); labelWrap.appendChild(del);

  var drop=document.createElement('div'); drop.className='tier-drop dropzone'; drop.setAttribute('tabindex','0'); drop.setAttribute('aria-label','Tier drop area');

  row.appendChild(labelWrap); row.appendChild(drop);
  return {row:row, chip:chip, del:del, drop:drop};
}

function fitChipText(chip){
  // Large by default. As user types more, shrink to fit chip box.
  var box = chip.getBoundingClientRect();
  var max = Math.max(22, Math.floor(box.height * 0.55));
  var min = 12, left=min, right=max, best=min;
  chip.style.whiteSpace='nowrap';
  chip.style.display='flex';
  chip.style.alignItems='center';
  chip.style.justifyContent='center';
  chip.style.lineHeight='1';
  chip.style.padding='0 8px';
  function fits(px){ chip.style.fontSize=px+'px'; return chip.scrollWidth <= (box.width - 16); }
  while (left<=right){ var mid=(left+right)>>1; if(fits(mid)){ best=mid; left=mid+1; } else { right=mid-1; } }
  chip.style.fontSize=best+'px';
}

function createRow(cfg){
  var dom=buildRowDom();
  var n=dom.row, chip=dom.chip, del=dom.del, drop=dom.drop;

  chip.textContent = cfg.label || 'S';
  chip.dataset.color = cfg.color;
  chip.style.background = cfg.color;
  chip.style.color = contrastColor(cfg.color);
  fitChipText(chip);

  var tint = tintFrom(cfg.color);
  drop.style.background = tint;
  drop.dataset.manual = 'false';
  del.style.background = darken(cfg.color, 0.35);

  on(chip,'input', function(){ fitChipText(chip); });
  on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });

  on(del,'click', function(){
    if(!confirm('Delete this row? Items will return to Image Storage.')) return;
    var toks=$$('.token', drop);
    toks.forEach(function(t){ tray.appendChild(t); });
    n.remove();
  });

  enableClickToPlace(drop);   // click-to-place for selected token
  enableRowReorder(n);        // whole-row drag handle not injected (CSS can show cursor)
  return n;
}

/* ---------- Tokens ---------- */
function buildTokenBase(){
  var el = document.createElement('div');
  el.className='token'; el.id=uid(); el.setAttribute('tabindex','0'); el.setAttribute('role','listitem'); el.setAttribute('aria-label','Circle item');
  el.style.touchAction='none'; el.setAttribute('draggable','false');

  // desktop / tablet pointer drag
  if (window.PointerEvent){
    enablePointerDrag(el);
  } else {
    enableMouseTouchFallback(el);
  }

  // select behavior + mobile radial
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
  on(el,'keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); } });
  return el;
}
function buildNameToken(name, color, forceBlack){
  var el=buildTokenBase();
  el.style.background = color;
  var lab=document.createElement('div'); lab.className='label'; lab.textContent = name;
  lab.style.color = forceBlack ? '#111' : contrastColor(color);
  el.appendChild(lab);
  // fit once when created
  requestAnimationFrame(function(){ fitTokenLabel(lab, el); });
  return el;
}
function buildImageToken(src, alt){
  var el=buildTokenBase();
  var img=document.createElement('img'); img.src=src; img.alt=alt||''; img.draggable=false;
  el.appendChild(img);
  return el;
}

/* ---------- History (Undo) ---------- */
var historyStack=[]; // {itemId, fromId, toId, beforeId}
function ensureId(el,prefix){ if(!el.id) el.id=(prefix||'id')+'-'+uid(); return el.id; }
function recordPlacement(itemId, fromId, toId, beforeId){
  if (!fromId || !toId || fromId===toId) return;
  historyStack.push({itemId:itemId, fromId:fromId, toId:toId, beforeId: beforeId||''});
  var u=$('#undoBtn'); if(u) u.disabled = historyStack.length===0;
}
function performMove(itemId, parentId, beforeId){
  var item=document.getElementById(itemId);
  var parent=document.getElementById(parentId);
  if(!item||!parent) return;
  if (beforeId){
    var before=document.getElementById(beforeId);
    if(before && before.parentElement===parent){ parent.insertBefore(item,before); return; }
  }
  parent.appendChild(item);
}

/* ---------- DnD helpers ---------- */
function getDropZoneFromElement(el){
  if (!el) return null;
  var dz=el.closest('.dropzone, #tray'); if(dz) return dz;
  var chip=el.closest('.tier-label'); if(chip){ var row=chip.closest('.tier-row'); return row?row.querySelector('.tier-drop'):null; }
  return null;
}
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

/* ---------- Pointer drag (mouse/touch) ---------- */
function enablePointerDrag(node){
  var ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  on(node,'pointerdown', function(e){
    // Mobile: allow drag only when inside a row (in tray we use radial picker)
    var inTray = !!node.closest('#tray');
    if (isSmall() && inTray) return;

    if (e.button!==0 && e.pointerType==='mouse') return;
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-item');

    originParent=node.parentElement; originNext=node.nextElementSibling;
    var r=node.getBoundingClientRect(); offsetX=e.clientX-r.left; offsetY=e.clientY-r.top; x=e.clientX; y=e.clientY;

    ghost=node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden');

    function move(ev){ x=ev.clientX; y=ev.clientY; }
    function up(){
      try{ node.releasePointerCapture(e.pointerId); }catch(_){}
      document.removeEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
      document.removeEventListener('pointerup', up, false);
      cancelAnimationFrame(raf);
      if(ghost&&ghost.parentNode) ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden'); document.body.classList.remove('dragging-item');

      var target=document.elementFromPoint(x,y);
      var zone=getDropZoneFromElement(target);
      if(zone){
        var fromId=ensureId(originParent,'zone'), toId=ensureId(zone,'zone');
        var beforeTok=insertBeforeForPoint(zone,x,y,node);
        var beforeId=beforeTok?ensureId(beforeTok,'tok'):'';
        if(beforeTok) zone.insertBefore(node,beforeTok); else zone.appendChild(node);
        recordPlacement(node.id,fromId,toId,beforeId);
        vib(6);
        // refit text after move in case CSS changed
        var lab = node.querySelector('.label'); if(lab) fitTokenLabel(lab,node);
      } else {
        if (originNext && originNext.parentElement===originParent) originParent.insertBefore(node,originNext);
        else originParent.appendChild(node);
      }
      if(currentZone) currentZone.classList.remove('drag-over');
      currentZone=null;
    }

    document.addEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
    document.addEventListener('pointerup', up, false);
    loop();

    function loop(){
      raf=requestAnimationFrame(loop);
      ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';
      var el=document.elementFromPoint(x,y);
      var zone=getDropZoneFromElement(el);
      if(currentZone && currentZone!==zone) currentZone.classList.remove('drag-over');
      if(zone && zone!==currentZone) zone.classList.add('drag-over');
      currentZone=zone||null;
    }
  }, _supportsPassive?{passive:false}:false);
}

/* Fallback for very old browsers */
function enableMouseTouchFallback(node){
  on(node,'mousedown', function(e){ e.preventDefault(); });
}

/* ---------- Click-to-place for selected token ---------- */
function enableClickToPlace(zone){
  ensureId(zone,'zone');
  on(zone,'click', function(e){
    var picker=$('#radialPicker'); if(picker && !picker.classList.contains('hidden')) return;
    var selected = $('.token.selected'); if (!selected) return;
    if(isSmall() && !!selected.closest('#tray')) return; // on phone, placing from tray uses radial picker
    var fromId=ensureId(selected.parentElement,'zone'); if(fromId===zone.id) return;
    var beforeId=''; // append by default
    zone.appendChild(selected);
    selected.classList.remove('selected');
    recordPlacement(selected.id, fromId, zone.id, beforeId);
    vib(6);
    var lab=selected.querySelector('.label'); if(lab) fitTokenLabel(lab, selected);
  });
}

/* ---------- Row reordering (drag entire row) ---------- */
function enableRowReorder(row){
  // Make the left label block act as the draggable area (no extra icons)
  var area = row.querySelector('.tier-label');
  var placeholder=null, dragging=false, startY=0;

  on(area,'mousedown', arm);
  on(area,'touchstart', arm, _supportsPassive?{passive:true}:false);

  function arm(e){
    if (document.activeElement===row.querySelector('.label-chip')) return;
    // only desktop/tablet; phone row reorder off by default
    if (isSmall()) return;
    row.setAttribute('draggable','true');
  }
  on(row,'dragstart', function(e){
    dragging=true;
    placeholder = document.createElement('div');
    placeholder.className='tier-row';
    placeholder.style.height = row.getBoundingClientRect().height+'px';
    placeholder.style.border = '2px dashed rgba(139,125,255,.25)';
    placeholder.style.borderRadius='12px';
    row.style.opacity='0.6';
    board.insertBefore(placeholder, row.nextSibling);
    startY = e.clientY || 0;
  });
  on(row,'dragend', function(){
    dragging=false;
    row.style.opacity='';
    if (placeholder && placeholder.parentNode){ board.insertBefore(row, placeholder); placeholder.remove(); }
    row.removeAttribute('draggable');
  });
  on(board,'dragover', function(e){
    if(!dragging || !placeholder) return; e.preventDefault();
    var after = rowAfterY(board, e.clientY);
    if (after) board.insertBefore(placeholder, after); else board.appendChild(placeholder);
  });
  on(board,'drop', function(){
    if(!dragging || !placeholder) return;
    board.insertBefore(row, placeholder);
    placeholder.remove(); placeholder=null;
  });

  function rowAfterY(container, y){
    var rows=[].slice.call(container.querySelectorAll('.tier-row')).filter(function(r){ return r!==placeholder; });
    for (var i=0;i<rows.length;i++){ var r=rows[i], rect=r.getBoundingClientRect(); if (y < rect.top + rect.height/2) return r; }
    return null;
  }
}

/* ---------- Mobile radial picker (tray → choose row) ---------- */
var radial = $('#radialPicker');
var radialOpts = radial?$('.radial-options', radial):null;
var radialCloseBtn = radial?$('.radial-close', radial):null;
var radialForToken = null;
var _radialGeo = [];

function rowCount(){ return $$('.tier-row').length; }
function uniformCenter(cx, cy, R){
  var M=16; return { x: Math.max(M+R, Math.min(window.innerWidth-M-R, cx)), y: Math.max(M+R, cy) };
}
function refreshRadial(){ if (!isSmall() || !radial || !radialForToken) return; openRadial(radialForToken); }

function openRadial(token){
  if(!radial||!isSmall()) return;
  radialForToken = token;

  var rect = token.getBoundingClientRect();
  var cx = rect.left + rect.width/2;
  var cy = rect.top + rect.height/2;

  var rows = $$('.tier-row');
  var labels = rows.map(function(r){ return rowLabel(r); });
  var N = labels.length; if (!N) return;

  // compact half-arc (always same density)
  var DOT=44, GAP=8, degStart=200, degEnd=340, stepDeg=(degEnd-degStart)/Math.max(1,(N-1));
  var stepRad=stepDeg*Math.PI/180, BASE_R=96, need=(DOT+GAP)/(2*Math.sin(Math.max(stepRad/2,0.05)));
  var R=Math.max(BASE_R, need);
  var center=uniformCenter(cx,cy,R);

  radialOpts.innerHTML = '';
  _radialGeo = [];

  for (var i=0;i<N;i++){
    var ang=(degStart+stepDeg*i)*Math.PI/180;
    var x=center.x+R*Math.cos(ang), y=center.y+R*Math.sin(ang);
    var row = rows[i];

    var btn=document.createElement('button'); btn.type='button'; btn.className='radial-option';
    btn.style.left=x+'px'; btn.style.top=y+'px';
    var dot=document.createElement('span'); dot.className='dot'; dot.textContent=labels[i];
    btn.appendChild(dot);
    on(btn,'click', function(row){ return function(){ selectRadialTarget(row); }; }(row));
    radialOpts.appendChild(btn);
    _radialGeo.push({x:x,y:y,row:row,btn:btn});
  }

  function backdrop(ev){
    if(ev.target.closest('.radial-option') || ev.target.closest('.radial-close')) return;
    var t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    var prevPE=radial.style.pointerEvents; radial.style.pointerEvents='none';
    var under=document.elementFromPoint(t.clientX,t.clientY); radial.style.pointerEvents=prevPE||'auto';
    var other = under && under.closest && under.closest('#tray .token');
    if(other){ closeRadial(); $$('.token.selected').forEach(function(t){ t.classList.remove('selected');}); other.classList.add('selected'); openRadial(other); ev.preventDefault(); return; }
    closeRadial();
  }
  radial.addEventListener('pointerdown',backdrop,{passive:false});
  radial._backdropHandler=backdrop;

  radial.classList.remove('hidden');
  radial.classList.add('visible');
  radial.setAttribute('aria-hidden','false');
}
function closeRadial(){
  if(!radial) return;
  if(radial._backdropHandler){ radial.removeEventListener('pointerdown', radial._backdropHandler); delete radial._backdropHandler; }
  radial.classList.add('hidden');
  radial.classList.remove('visible');
  radial.setAttribute('aria-hidden','true');
  radialForToken = null;
  _radialGeo = [];
}
if(radialCloseBtn){ on(radialCloseBtn,'click', function(e){ e.stopPropagation(); closeRadial(); }); }
on(window,'resize', refreshRadial);

/* ---------- Clear / Undo ---------- */
on($('#trashClear'),'click', function(){
  if(!confirm('Clear the entire board? Items will return to Image Storage.')) return;
  $$('.tier-drop .token').forEach(function(tok){ tray.appendChild(tok); });
});
on($('#undoBtn'),'click', function(){
  var last=historyStack.pop(); if(!last) return;
  performMove(last.itemId, last.fromId, last.beforeId);
  $('#undoBtn').disabled = historyStack.length===0;
});

/* ---------- Export PNG (exactly as shown) ---------- */
on($('#saveBtn'),'click', function(){
  // verify html2canvas
  if (typeof html2canvas !== 'function'){
    alert('Export error: html2canvas not loaded.');
    return;
  }
  // clean transient UI
  closeRadial();
  $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
  $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

  // clone the board exactly as visible
  var panel = $('#boardPanel');
  var wrap = document.createElement('div');
  wrap.style.position='fixed'; wrap.style.left='-99999px'; wrap.style.top='0';
  var clone = panel.cloneNode(true);
  // hide row X in export
  var style = document.createElement('style');
  style.textContent = '.row-del{display:none!important} .token .label{display:flex;align-items:center;justify-content:center;line-height:1;white-space:nowrap;padding:0 6px;}';
  clone.appendChild(style);

  // If title is literally the default placeholder, drop it
  var title = clone.querySelector('.board-title');
  if (title) {
    var t = title.textContent.trim();
    if (!t || /optional title/i.test(t)) {
      // remove the title container (h2) but keep the board
      title.remove();
    }
  }

  // ensure export labels fit (same size container)
  $$('.token .label', clone).forEach(fitExportLabel);

  wrap.appendChild(clone); document.body.appendChild(wrap);

  // feedback (simple)
  var busy = document.createElement('div');
  busy.style.position='fixed'; busy.style.right='12px'; busy.style.bottom='12px';
  busy.style.padding='10px 12px'; busy.style.borderRadius='10px';
  busy.style.background='rgba(0,0,0,.6)'; busy.style.color='#fff'; busy.style.fontWeight='700';
  busy.style.zIndex='9999'; busy.textContent='Rendering PNG…';
  document.body.appendChild(busy);

  html2canvas(clone, {
    backgroundColor: cssVar('--surface') || null,
    useCORS: true,
    scale: 2
  }).then(function(canvas){
    var a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tier-list.png';
    document.body.appendChild(a); a.click(); a.remove();
  }).catch(function(err){
    console.error(err); alert('Sorry, something went wrong creating the PNG.');
  }).finally(function(){
    if (busy && busy.parentNode) busy.parentNode.removeChild(busy);
    wrap.remove();
  });
});

/* ---------- Keyboard quick placement (1..N) ---------- */
on(document,'keydown', function(e){
  var selected=$('.token.selected'); if(!selected) return;
  var n=parseInt(e.key,10);
  if(!isNaN(n) && n>=1 && n<=rowCount()){
    e.preventDefault();
    var row=$$('.tier-row')[n-1]; if(!row) return;
    var zone=row.querySelector('.tier-drop');
    var fromId=ensureId(selected.parentElement,'zone'); ensureId(zone,'zone');
    zone.appendChild(selected); selected.classList.remove('selected');
    recordPlacement(selected.id,fromId,zone.id,'');
    vib(4);
  }
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function(){
  board = $('#tierBoard'); tray = $('#tray');

  // rows
  defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });

  // pre-rendered tokens (black text, solid colors)
  communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset(), true)); });

  // creator: add custom name
  on($('#addNameBtn'),'click', function(){
    var name = $('#nameInput').value.trim();
    if (!name) return;
    var color = $('#nameColor').value || nextPreset();
    tray.appendChild(buildNameToken(name, color, false));
    $('#nameInput').value='';
  });
  // custom images
  on($('#imageInput'),'change', function(e){
    Array.prototype.forEach.call(e.target.files, function(file){
      if(!file.type || file.type.indexOf('image/')!==0) return;
      var reader=new FileReader();
      reader.onload=function(ev){ tray.appendChild(buildImageToken(ev.target.result,file.name)); };
      reader.readAsDataURL(file);
    });
  });

  // add tier
  on($('#addTierBtn'),'click', function(){
    board.appendChild(createRow({label:'NEW', color: nextTierColor()}));
  });

  // device-specific tips (no "Help" heading)
  var tips=$('#helpText')||$('.help');
  if(tips){
    var phone = isSmall();
    tips.innerHTML =
      (phone
        ? '<strong>Phone:</strong> tap a circle in Image Storage to choose a row. Once placed, drag to reorder or drag back to Image Storage.'
        : '<strong>Desktop/Tablet:</strong> drag circles into rows. You can reorder or drag back to Image Storage.'
      ) + '<br><strong>Rows:</strong> click the tier label to edit; drag the label area to reorder the whole row; click the small X to delete the row (items return to Image Storage).';
  }

  // theme toggle text/icon
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
        ? '<svg viewBox="0 0 24 24"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.22 19.78l1.79-1.79 1.8 1.79-1.8 1.8-1.79-1.8zM20 13h3v-2h-3v2zM12 1h2v3h-2V1zm6.01 3.05l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>');
      // retint drops to match label chip
      $$('.tier-row').forEach(function(row){
        var chip=$('.label-chip',row), drop=$('.tier-drop',row);
        if (drop && drop.dataset.manual!=='true'){
          var base=(chip&&chip.dataset.color)?chip.dataset.color:'#8b7dff';
          drop.style.background=tintFrom(base);
        }
      });
    }
  })();

  live('Ready.');
});
</script>