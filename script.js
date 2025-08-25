/* =========================================================
   Tier Maker — Full Script (final polish)
========================================================= */

/* ---------- Passive listener detection ---------- */
var _supportsPassive = false;
try {
  var __opts = Object.defineProperty({}, 'passive', { get: function(){ _supportsPassive = true; } });
  window.addEventListener('x', null, __opts); window.removeEventListener('x', null, __opts);
} catch(e){}

function on(el, t, h, o){ if(!el) return;
  if (!o) { el.addEventListener(t, h, false); return; }
  if (typeof o === 'object' && !_supportsPassive) el.addEventListener(t, h, !!o.capture);
  else el.addEventListener(t, h, o);
}
var $=function(s,c){return (c||document).querySelector(s);};
var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};
function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function isSmall(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }
function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }

/* ---------- Color helpers ---------- */
function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3){h=h.split('').map(function(x){return x+x;}).join('');} var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
function relativeLuminance(rgb){ function srgb(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); } return 0.2126*srgb(rgb.r)+0.7152*srgb(rgb.g)+0.0722*srgb(rgb.b); }
function contrastColor(bg){ var L=relativeLuminance(hexToRgb(bg)); return L>0.58 ? '#000' : '#fff'; }
function darken(hex,p){ var c=hexToRgb(hex), f=(1-(p||0)); return rgbToHex(Math.round(c.r*f),Math.round(c.g*f),Math.round(c.b*f)); }
function lighten(hex,p){ var c=hexToRgb(hex), f=p||0; return rgbToHex(Math.round(c.r+(255-c.r)*f), Math.round(c.g+(255-c.g)*f), Math.round(c.b+(255-c.b)*f)); }

/* ---------- Live region ---------- */
function live(msg){ var n=$('#live'); if(!n) return; n.textContent=''; setTimeout(function(){ n.textContent = msg; }, 0); }

/* ---------- Theme toggle (button shows TARGET mode) ---------- */
(function(){
  var root=document.documentElement, toggle=$('#themeToggle');
  if(!toggle) return;
  var icon=$('.theme-icon',toggle), text=$('.theme-text',toggle);
  var prefersLight=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);
  setTheme(localStorage.getItem('tm_theme') || (prefersLight ? 'light' : 'dark'));
  on(toggle,'click',function(){ setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark'); });

  function setTheme(mode){
    root.setAttribute('data-theme',mode); localStorage.setItem('tm_theme',mode);
    var target=mode==='dark'?'Light':'Dark';
    if(text) text.textContent=target;
    if(icon) icon.innerHTML=(target==='Light'
      ? '<svg viewBox="0 0 24 24"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.22 19.78l1.79-1.79 1.8 1.79-1.8 1.8-1.79-1.8zM20 13h3v-2h-3v2zM12 1h2v3h-2V1zm6.01 3.05l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>');
    // retint rows
    $$('.tier-row').forEach(function(row){
      var chip=$('.label-chip',row), drop=$('.tier-drop',row);
      if(drop && drop.dataset.manual!=='true'){
        var c=(chip && chip.dataset.color) || '#8b7dff';
        drop.style.background = tintFrom(c);
      }
    });
  }
})();

/* ---------- Tint util for row bodies ---------- */
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
function ensureId(el, prefix){ if(!el.id){ el.id=(prefix||'id')+'-'+uid(); } return el.id; }
function rowLabel(row){ var chip=row?row.querySelector('.label-chip'):null; return chip?chip.textContent.replace(/\s+/g,' ').trim():'row'; }

/* ---------- FLIP micro-anim for token moves ---------- */
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
          t.style.willChange='transform';
          t.style.transform='translate('+dx+'px,'+dy+'px)';
          requestAnimationFrame(function(){
            t.style.transition='transform .22s ease';
            t.style.transform='translate(0,0)';
            setTimeout(function(){ t.style.transition=''; t.style.transform=''; t.style.willChange=''; },240);
          });
        }
      });
    });
  });
}

/* ---------- Build row (grip + safe label chip + delete) ---------- */
function buildRowDom(){
  var row=document.createElement('div'); row.className='tier-row';

  var labelWrap=document.createElement('div'); labelWrap.className='tier-label';

  // grip (visible indicator that row can be dragged)
  var grip=document.createElement('button'); grip.type='button'; grip.className='row-grip';
  grip.setAttribute('aria-label','Drag to reorder row'); grip.title='Drag to reorder row';
  grip.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 6h2v2H7V6zm8 0h2v2h-2V6zM7 11h2v2H7v-2zm8 0h2v2h-2v-2zM7 16h2v2H7v-2zm8 0h2v2h-2v-2z"/></svg>';

  // label chip (never pushes into row; ellipsizes)
  var chip=document.createElement('div'); chip.className='label-chip';
  chip.setAttribute('contenteditable','true'); chip.setAttribute('spellcheck','false');
  chip.style.whiteSpace='nowrap'; chip.style.overflow='hidden'; chip.style.textOverflow='ellipsis';
  chip.style.display='flex'; chip.style.alignItems='center'; chip.style.justifyContent='center';

  var del=document.createElement('button'); del.className='row-del'; del.type='button';
  del.setAttribute('aria-label','Delete row');
  del.innerHTML='<svg viewBox="0 0 24 24"><path d="M18.3 5.7L12 12l-6.3-6.3-1.4 1.4L10.6 13.4l-6.3 6.3 1.4 1.4L12 14.4l6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3z"/></svg>';

  labelWrap.appendChild(grip);
  labelWrap.appendChild(chip);
  labelWrap.appendChild(del);

  var drop=document.createElement('div'); drop.className='tier-drop dropzone'; drop.setAttribute('tabindex','0');

  row.appendChild(labelWrap); row.appendChild(drop);
  return {row, grip, chip, del, drop, labelWrap};
}

/* ---------- Wire up a row ---------- */
function createRow(cfg){
  var {row, grip, chip, del, drop} = buildRowDom();

  ensureId(drop,'zone');
  chip.textContent = cfg.label;
  chip.dataset.color = cfg.color;
  chip.style.background = cfg.color;
  chip.style.color = contrastColor(cfg.color);
  del.style.background = darken(cfg.color, 0.35);

  var tint = tintFrom(cfg.color);
  drop.style.background = tint; drop.dataset.manual = 'false';

  on(chip,'keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });

  on(del,'click',function(){
    if(!confirm('Delete this tier? Items will return to Image Storage.')) return;
    var tokens=$$('.token',drop);
    flipZones([drop,tray],function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
    row.remove(); saveBoard();
  });

  enableRowReorder(grip,row);
  enableClickToPlace(drop);
  return row;
}

/* ---------- Defaults ---------- */
var defaultTiers = [
  { label:'S', color:'#ff6b6b' },
  { label:'A', color:'#f6c02f' }, // slightly more yellow
  { label:'B', color:'#22c55e' },
  { label:'C', color:'#3b82f6' },
  { label:'D', color:'#a78bfa' }
];

/* Bright cycle for new tiers */
var TIER_CYCLE = ['#ff6b6b','#f6c02f','#22c55e','#3b82f6','#a78bfa','#06b6d4','#e11d48','#16a34a','#f97316','#0ea5e9'];
var tierIdx=0; function nextTierColor(){ var c=TIER_CYCLE[tierIdx%TIER_CYCLE.length]; tierIdx++; return c; }

/* Pre-rendered names (incl. Kikki, Tems, TomTom) */
var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo","Gavin","Harry","Jay","Jeremy",
  "Katie","Keyon","Kiev","Kikki","Kyle","Lewis","Meegan","Munch","Paper","Ray","Safoof","Temz","TomTom","V","Versse","Wobbles","Xavier"
];

/* ---------- PRE-RENDERED PALETTE (20% less pale; black labels) ---------- */
var BASE_PALETTE = [
  '#FCE38A','#F3A683','#F5CD7A','#F7D794',
  '#778BEB','#EB8688','#CF6A87','#786FA6',
  '#F8A5C2','#64CDDB','#3EC1D3','#E77F67',
  '#FA991C','#FAD4C9','#7FC4D4','#A7B3E9',
  '#FBD78B','#EFA7A7','#9FD8DF','#C8B6FF',
  '#B8E1FF','#FFD6A5','#C3F0CA','#FFE5EC',
  '#F4B942','#9EE493','#8AC6D1','#FF8FAB','#B0A8F0'
];
function contrastForBlack(hex){ var L=relativeLuminance(hexToRgb(hex)); return (L+0.05)/0.05; }
/* lighten step reduced from 0.0375 to 0.03 (≈20% less pale) */
function ensureForBlack(hex){ var out=hex, steps=0; while(contrastForBlack(out)<4.5 && steps<6){ out=lighten(out,0.03); steps++; } return out; }
var presetPalette = BASE_PALETTE.map(ensureForBlack);
var pIndex=0; function nextPreset(){ var c=presetPalette[pIndex%presetPalette.length]; pIndex++; return c; }

/* ---------- Token builders ---------- */
function fitLabelForUI(lbl){
  // single line, center; grow as much as possible without overflow (UI only)
  var tok = lbl.parentElement, D = tok.clientWidth;
  lbl.style.whiteSpace='nowrap';
  lbl.style.display='flex';
  lbl.style.alignItems='center';
  lbl.style.justifyContent='center';
  lbl.style.height='100%';
  lbl.style.lineHeight='1';
  var pad=10, min=Math.max(12,Math.floor(D*0.22)), max=Math.floor(D*0.42), best=min;
  function fits(px){ lbl.style.fontSize=px+'px'; return lbl.scrollWidth <= (D-pad*2); }
  while(min<=max){ var mid=(min+max)>>1; if(fits(mid)){ best=mid; min=mid+1; } else { max=mid-1; } }
  lbl.style.fontSize=best+'px';
}
function buildTokenBase(){
  var el=document.createElement('div'); el.className='token'; el.id=uid();
  el.setAttribute('tabindex','0'); el.setAttribute('role','listitem'); el.setAttribute('aria-label','Draggable token');
  el.style.touchAction='none'; el.setAttribute('draggable','false');

  if(!isSmall()){ if(window.PointerEvent) enablePointerDrag(el); else enableMouseTouchDragFallback(el); }
  else { enableMobileTouchDrag(el); }

  on(el,'click',function(ev){
    ev.stopPropagation();
    var already=el.classList.contains('selected');
    $$('.token.selected').forEach(function(t){t.classList.remove('selected');});
    var inTray=!!el.closest('#tray');
    if(!already){ el.classList.add('selected'); if(isSmall()&&inTray) openRadial(el); }
    else if(isSmall()&&inTray){ closeRadial(); }
  });
  on(el,'keydown',function(e){
    // Alt+Arrow to reorder within row
    if(e.altKey && (e.key==='ArrowLeft' || e.key==='ArrowRight')){
      var zone=el.parentElement, sib = (e.key==='ArrowLeft') ? el.previousElementSibling : el.nextElementSibling;
      if(zone && sib){
        e.preventDefault();
        flipZones([zone],function(){ zone.insertBefore(el, (e.key==='ArrowLeft') ? sib : sib.nextElementSibling); });
        saveBoard();
      }
    }
    if((e.key==='Enter'||e.key===' ') && isSmall()){ e.preventDefault(); if(el.closest('#tray')) openRadial(el); }
  });
  return el;
}
function buildNameToken(name,color,forceBlack){
  var el=buildTokenBase(); el.style.background=color;
  var label=document.createElement('div'); label.className='label'; label.textContent=name; label.style.color=forceBlack?'#111':contrastColor(color);
  el.appendChild(label); fitLabelForUI(label); return el;
}
function buildImageToken(src,alt){
  var el=buildTokenBase(); var img=document.createElement('img'); img.src=src; img.alt=alt||''; img.draggable=false; el.appendChild(img); return el;
}

/* ---------- History / Undo ---------- */
var historyStack=[]; // {itemId, fromId, toId, beforeId}
function recordPlacement(itemId,fromId,toId,beforeId){
  if(!fromId||!toId||fromId===toId) return;
  historyStack.push({itemId,fromId,toId,beforeId:beforeId||''});
  var u=$('#undoBtn'); if(u) u.disabled = historyStack.length===0;
}
function performMove(itemId,parentId,beforeId){
  var item=document.getElementById(itemId), parent=document.getElementById(parentId); if(!item||!parent) return;
  flipZones([item.parentElement,parent],function(){
    if(beforeId){ var before=document.getElementById(beforeId); if(before&&before.parentElement===parent){ parent.insertBefore(item,before); return; } }
    parent.appendChild(item);
  });
}

/* ---------- Insert helper for drop placement ---------- */
function insertBeforeForPoint(zone,x,y,except){
  var tokens=[].slice.call(zone.querySelectorAll('.token')).filter(function(t){return t!==except;});
  if(!tokens.length) return null;
  var centers=tokens.map(function(t){var r=t.getBoundingClientRect();return{t:t,cx:r.left+r.width/2,cy:r.top+r.height/2};});
  var rightMost=centers.reduce(function(a,b){return(b.cx>a.cx)?b:a;});
  var zr=zone.getBoundingClientRect();
  if(x>rightMost.cx+24) return null;
  if(y>zr.bottom-12) return null;
  var best=null,bestD=Infinity;
  centers.forEach(function(c){var dx=c.cx-x,dy=c.cy-y;var d=dx*dx+dy*dy;if(d<bestD){bestD=d;best=c.t;}});
  return best;
}

/* ---------- Click-to-place for tray & rows ---------- */
function enableClickToPlace(zone){
  ensureId(zone,'zone');
  on(zone,'click',function(){
    var picker=$('#radialPicker'); if(picker && !picker.classList.contains('hidden')) return;
    var selected=$('.token.selected'); if(!selected) return;
    if(isSmall() && !selected.closest('#tray')) return; // phone uses radial from tray only
    var fromId=ensureId(selected.parentElement,'zone'); if(fromId===zone.id) return;
    var origin=selected.parentElement;
    flipZones([origin,zone],function(){ zone.appendChild(selected); });
    selected.classList.remove('selected');
    recordPlacement(selected.id,fromId,zone.id);
    vib(6); saveBoard();
  });
}

/* ---------- Determine drop zone from element ---------- */
function getDropZoneFromElement(el){
  if(!el) return null;
  var dz=el.closest('.dropzone, #tray'); if(dz) return dz;
  var chip=el.closest('.tier-label'); if(chip){ var row=chip.closest('.tier-row'); return row?row.querySelector('.tier-drop'):null; }
  return null;
}

/* ---------- Desktop / large screens: pointer drag ---------- */
function enablePointerDrag(node){
  var ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  on(node,'pointerdown',function(e){
    if(isSmall()||e.button!==0) return;
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
      var target=document.elementFromPoint(x,y);
      if(ghost&&ghost.parentNode) ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden');
      document.body.classList.remove('dragging-item');

      var zone=getDropZoneFromElement(target);
      if(zone){
        var fromId=ensureId(originParent,'zone');
        var toId=ensureId(zone,'zone');
        var beforeTok=insertBeforeForPoint(zone,x,y,node);
        var beforeId=beforeTok?ensureId(beforeTok,'tok'):'';
        flipZones([originParent,zone],function(){ if(beforeTok) zone.insertBefore(node,beforeTok); else zone.appendChild(node); });
        recordPlacement(node.id,fromId,toId,beforeId);
        node.classList.add('animate-drop'); setTimeout(function(){node.classList.remove('animate-drop');},180);
        vib(6); saveBoard();
      } else {
        flipZones([originParent],function(){
          if(originNext && originNext.parentElement===originParent) originParent.insertBefore(node,originNext);
          else originParent.appendChild(node);
        });
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
      currentZone = zone || null;
    }
  });
}

/* ---------- Legacy mouse/touch fallback ---------- */
function enableMouseTouchDragFallback(node){
  var dragging=false, ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  function start(e, clientX, clientY){
    if(isSmall()) return; dragging=true; document.body.classList.add('dragging-item');
    if(e && e.preventDefault) e.preventDefault();

    originParent=node.parentElement; originNext=node.nextElementSibling;
    var r=node.getBoundingClientRect(); offsetX=clientX-r.left; offsetY=clientY-r.top; x=clientX; y=clientY;

    ghost=node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden'); loop();
  }
  function move(clientX,clientY){ if(!dragging) return; x=clientX; y=clientY; }
  function end(){
    if(!dragging) return; dragging=false;
    cancelAnimationFrame(raf);
    var target=document.elementFromPoint(x,y);
    if(ghost&&ghost.parentNode) ghost.parentNode.removeChild(ghost);
    node.classList.remove('drag-hidden'); document.body.classList.remove('dragging-item');
    var zone=getDropZoneFromElement(target);
    if(zone){
      var fromId=ensureId(originParent,'zone'), toId=ensureId(zone,'zone');
      var beforeTok=insertBeforeForPoint(zone,x,y,node); var beforeId=beforeTok?ensureId(beforeTok,'tok'):'';
      flipZones([originParent,zone],function(){ if(beforeTok) zone.insertBefore(node,beforeTok); else zone.appendChild(node); });
      recordPlacement(node.id,fromId,toId,beforeId); node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
      vib(6); saveBoard();
    } else {
      flipZones([originParent],function(){
        if(originNext && originNext.parentElement===originParent) originParent.insertBefore(node,originNext);
        else originParent.appendChild(node);
      });
    }
    if(currentZone) currentZone.classList.remove('drag-over'); currentZone=null;
  }

  on(node,'mousedown',function(e){ if(e.button!==0) return; start(e,e.clientX,e.clientY);
    on(document,'mousemove', onMouseMove); on(document,'mouseup', onMouseUp); });
  function onMouseMove(e){ move(e.clientX,e.clientY); }
  function onMouseUp(){ document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); end(); }

  on(node,'touchstart',function(e){ var t=e.touches[0]; start(e,t.clientX,t.clientY);
    on(document,'touchmove', onTouchMove, _supportsPassive?{passive:true}:false);
    on(document,'touchend', onTouchEnd, false); }, _supportsPassive?{passive:true}:false);
  function onTouchMove(e){ var t=e.touches[0]; if(t) move(t.clientX,t.clientY); }
  function onTouchEnd(){ document.removeEventListener('touchmove', onTouchMove, false); document.removeEventListener('touchend', onTouchEnd, false); end(); }

  function loop(){
    raf=requestAnimationFrame(loop);
    ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';
    var el=document.elementFromPoint(x,y);
    var zone=getDropZoneFromElement(el);
    if(currentZone && currentZone!==zone) currentZone.classList.remove('drag-over');
    if(zone && zone!==currentZone) zone.classList.add('drag-over');
    currentZone = zone || null;
  }
}

/* ---------- Mobile touch drag for placed tokens ---------- */
function enableMobileTouchDrag(node){
  if(!('PointerEvent' in window)) return;
  on(node,'pointerdown',function(e){
    if(!isSmall()) return;
    if(e.pointerType!=='touch' && e.pointerType!=='pen') return;
    if(!node.closest('.tier-drop')) return;
    e.preventDefault(); node.setPointerCapture(e.pointerId); document.body.classList.add('dragging-item');

    var ghost=node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    var originParent=node.parentElement, originNext=node.nextElementSibling;
    node.classList.add('drag-hidden');

    var r=node.getBoundingClientRect(), offsetX=e.clientX-r.left, offsetY=e.clientY-r.top, x=e.clientX, y=e.clientY;
    function move(ev){ x=ev.clientX; y=ev.clientY; ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)'; }
    function up(){
      try{node.releasePointerCapture(e.pointerId);}catch(_){}
      document.removeEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
      document.removeEventListener('pointerup', up, false);
      if(ghost&&ghost.parentNode) ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden'); document.body.classList.remove('dragging-item');

      var target=document.elementFromPoint(x,y); var zone=getDropZoneFromElement(target);
      if(zone){
        var fromId=ensureId(originParent,'zone'), toId=ensureId(zone,'zone');
        var beforeTok=insertBeforeForPoint(zone,x,y,node); var beforeId=beforeTok?ensureId(beforeTok,'tok'):'';
        flipZones([originParent,zone],function(){ if(beforeTok) zone.insertBefore(node,beforeTok); else zone.appendChild(node); });
        recordPlacement(node.id,fromId,toId,beforeId); node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
        vib(6); saveBoard();
      } else {
        flipZones([originParent],function(){
          if(originNext && originNext.parentElement===originParent) originParent.insertBefore(node,originNext);
          else originParent.appendChild(node);
        });
      }
    }
    document.addEventListener('pointermove', move, _supportsPassive?{passive:true}:false);
    document.addEventListener('pointerup', up, false);
  }, _supportsPassive?{passive:false}:false);
}

/* ---------- Row reorder by grip ---------- */
function enableRowReorder(grip,row){
  var placeholder=null;
  function arm(){ row.setAttribute('draggable','true'); grip.classList.add('dragging'); }
  function disarm(){ row.removeAttribute('draggable'); grip.classList.remove('dragging'); }
  on(grip,'mousedown',arm); on(grip,'touchstart',arm,_supportsPassive?{passive:true}:false);

  on(row,'dragstart',function(){
    document.body.classList.add('dragging-item');
    placeholder=document.createElement('div'); placeholder.className='tier-row';
    placeholder.style.height=row.getBoundingClientRect().height+'px';
    placeholder.style.border='2px dashed rgba(139,125,255,.28)';
    placeholder.style.borderRadius='12px';
    row.parentElement.insertBefore(placeholder,row.nextSibling);
    setTimeout(function(){ row.style.display='none'; },0);
  });
  on(row,'dragend',function(){
    row.style.display='';
    if(placeholder&&placeholder.parentNode){ row.parentElement.insertBefore(row,placeholder); placeholder.remove(); }
    document.body.classList.remove('dragging-item'); disarm(); saveBoard();
  });
  on(row.parentElement,'dragover',function(e){
    if(!placeholder) return; e.preventDefault();
    var after = rowAfterY(row.parentElement, e.clientY);
    if(after) row.parentElement.insertBefore(placeholder,after); else row.parentElement.appendChild(placeholder);
  });
  function rowAfterY(container,y){
    var rows=[].slice.call(container.querySelectorAll('.tier-row')).filter(function(r){return r!==placeholder && r.style.display!=='none';});
    for(var i=0;i<rows.length;i++){ var r=rows[i], rect=r.getBoundingClientRect(); if(y < rect.top + rect.height/2) return r; }
    return null;
  }
}

/* ---------- Radial picker (compact + uniform) ---------- */
var radial=$('#radialPicker'), radialOpts=radial?$('.radial-options',radial):null, radialCloseBtn=radial?$('.radial-close',radial):null;
var radialForToken=null, _radialGeo=[];
function rowCount(){ return $$('.tier-row').length; }
function uniformCenter(cx,cy,R){ var M=16; return {x:Math.max(M+R,Math.min(window.innerWidth-M-R,cx)), y:Math.max(M+R,cy)}; }
function refreshRadialOptions(){ if(!isSmall()||!radial||!radialForToken) return; openRadial(radialForToken); }

function openRadial(token){
  if(!radial||!isSmall()) return; radialForToken=token;
  var rect=token.getBoundingClientRect(), cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  var rows=$$('.tier-row'); var labels=rows.map(function(r){return rowLabel(r);}); var N=labels.length; if(!N) return;

  var DOT=42, GAP=6, degStart=200, degEnd=340, stepDeg=(degEnd-degStart)/Math.max(1,(N-1)), stepRad=stepDeg*Math.PI/180;
  var BASE_R=96, need=(DOT+GAP)/(2*Math.sin(Math.max(stepRad/2,0.05))); var R=Math.max(BASE_R,need);
  var center=uniformCenter(cx,cy,R);

  var positions=[]; for(var i=0;i<N;i++){ var ang=(degStart+stepDeg*i)*Math.PI/180; positions.push({i:i,ang:ang,x:center.x+R*Math.cos(ang),y:center.y+R*Math.sin(ang)}); }
  positions.sort(function(a,b){return a.x-b.x;}); _radialGeo=[];

  radialCloseBtn.style.left=cx+'px'; radialCloseBtn.style.top=cy+'px';

  radialOpts.innerHTML=''; for(let j=0;j<N;j++){ (function(j){
    var row=rows[j], pos=positions[j], btn=document.createElement('button');
    btn.type='button'; btn.className='radial-option'; btn.style.left=pos.x+'px'; btn.style.top=pos.y+'px'; btn.style.transitionDelay=(j*14)+'ms';
    var dot=document.createElement('span'); dot.className='dot'; dot.textContent=labels[j]; btn.appendChild(dot);
    on(btn,'pointerenter', function(){ updateHighlight(j); });
    on(btn,'pointerdown', function(e){ e.preventDefault(); updateHighlight(j); });
    on(btn,'click', function(){ selectRadialTarget(row); });
    radialOpts.appendChild(btn); _radialGeo.push({x:pos.x,y:pos.y,row:row,btn:btn});
  })(j); }

  function backdrop(ev){
    if(ev.target.closest('.radial-option') || ev.target.closest('.radial-close')) return;
    var x=(ev.touches&&ev.touches[0]?ev.touches[0].clientX:ev.clientX);
    var y=(ev.touches&&ev.touches[0]?ev.touches[0].clientY:ev.clientY);
    var prevPE=radial.style.pointerEvents; radial.style.pointerEvents='none'; var under=document.elementFromPoint(x,y); radial.style.pointerEvents=prevPE||'auto';
    var other=under && under.closest && under.closest('#tray .token');
    if(other){ closeRadial(); $$('.token.selected').forEach(function(t){t.classList.remove('selected');}); other.classList.add('selected'); openRadial(other); ev.preventDefault(); return; }
    closeRadial();
  }
  radial.addEventListener('pointerdown',backdrop,{passive:false}); radial._backdropHandler=backdrop;

  radial.classList.remove('hidden'); radial.classList.add('visible','show'); radial.setAttribute('aria-hidden','false');
  setTimeout(function(){ radial.classList.remove('show'); }, 160 + N*14); if(_radialGeo.length){ updateHighlight(0); }
}
function updateHighlight(index){ if(!_radialGeo.length) return; for(var i=0;i<_radialGeo.length;i++){ _radialGeo[i].btn.classList.toggle('is-hot', i===index); } }
if(radialCloseBtn){ on(radialCloseBtn,'click',function(e){ e.stopPropagation(); closeRadial(); }, false); }
function selectRadialTarget(row){
  if(!radialForToken||!row) return; var zone=row.querySelector('.tier-drop'); var fromId=ensureId(radialForToken.parentElement,'zone'); var origin=radialForToken.parentElement; ensureId(zone,'zone');
  flipZones([origin,zone],function(){ zone.appendChild(radialForToken); });
  radialForToken.classList.remove('selected'); recordPlacement(radialForToken.id,fromId,zone.id); vib(7); closeRadial(); saveBoard();
}
function closeRadial(){
  if(!radial) return;
  if(radial._backdropHandler){ radial.removeEventListener('pointerdown',radial._backdropHandler); delete radial._backdropHandler; }
  radial.classList.add('hidden'); radial.classList.remove('visible','show'); radial.setAttribute('aria-hidden','true'); radialForToken=null; _radialGeo=[];
}
on(window,'resize',refreshRadialOptions);

/* ---------- Clear / Undo ---------- */
on($('#trashClear'),'click',function(){
  if(!confirm('Clear the entire tier board? This moves all placed items back to Image Storage.')) return;
  $$('.tier-drop .token').forEach(function(tok){ tray.appendChild(tok); });
  historyStack=[]; var u=$('#undoBtn'); if(u) u.disabled=true; saveBoard();
});
on($('#undoBtn'),'click',function(){
  var last=historyStack.pop(); if(!last) return; performMove(last.itemId,last.fromId,last.beforeId); $('#undoBtn').disabled=historyStack.length===0; saveBoard();
});

/* ---------- Export PNG (exact on-screen sizes + perfect centering) ---------- */
function fitExportLabel(lbl){
  var token=lbl.parentElement, D=token.clientWidth, pad=8;
  lbl.style.whiteSpace='nowrap'; lbl.style.display='flex'; lbl.style.alignItems='center'; lbl.style.justifyContent='center';
  lbl.style.height='100%'; lbl.style.lineHeight='1'; lbl.style.padding='0 '+pad+'px';
  var min=Math.max(12,Math.floor(D*0.22)), max=Math.floor(D*0.46), best=min;
  function fits(px){ lbl.style.fontSize=px+'px'; return lbl.scrollWidth <= (D - pad*2); }
  while(min<=max){ var mid=(min+max)>>1; if(fits(mid)){ best=mid; min=mid+1; } else { max=mid-1; } }
  lbl.style.fontSize=best+'px';
}
function showExportOverlay(text){
  var ov=document.createElement('div'); ov.id='exportOverlay';
  ov.style.cssText='position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.35);backdrop-filter:saturate(140%) blur(2px);z-index:9999;color:#fff;font:600 16px/1.2 system-ui;';
  ov.innerHTML='<div style="background:rgba(20,20,28,.9);padding:16px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.15);box-shadow:0 10px 32px rgba(0,0,0,.35)">'+text+'</div>';
  document.body.appendChild(ov); return ov;
}
on($('#saveBtn'),'click',function(){
  if(!window.html2canvas){ alert('Export error: html2canvas failed to load.'); return; }
  $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
  $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

  var panel=$('#boardPanel');
  var cloneWrap=document.createElement('div'); cloneWrap.style.position='fixed'; cloneWrap.style.left='-99999px'; cloneWrap.style.top='0';
  var clone=panel.cloneNode(true);

  var style=document.createElement('style');
  style.textContent='.row-del{display:none !important}.token .label{font-weight:900 !important;display:flex !important;align-items:center !important;justify-content:center !important;line-height:1 !important;white-space:nowrap !important;padding:0 6px !important;text-shadow:none !important}';
  clone.appendChild(style);

  // drop empty title
  var title=clone.querySelector('.board-title');
  if(title && title.textContent.replace(/\s+/g,'')===''){ var wrap=title.parentElement; if(wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }

  // fit labels
  $$('.token .label', clone).forEach(fitExportLabel);

  cloneWrap.appendChild(clone); document.body.appendChild(cloneWrap);

  var overlay=showExportOverlay('Rendering PNG…');
  html2canvas(clone, {
    backgroundColor: cssVar('--surface') || null,
    useCORS: true,
    scale: 2
  }).then(function(canvas){
    var a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tier-list.png';
    document.body.appendChild(a); a.click(); a.remove(); cloneWrap.remove(); overlay.remove();
  }).catch(function(err){ cloneWrap.remove(); overlay.remove(); alert('Export failed.'); });
});

/* ---------- Help copy (multi-line) ---------- */
function setHelp(){
  var help=$('#helpText') || $('.help'); if(!help) return;
  help.innerHTML =
    '<strong style="color:var(--accent)">Help</strong>' +
    '<div style="margin-top:6px;display:grid;gap:6px;color:var(--muted)">' +
      '<div>Desktop/iPad: <b>drag</b> circles into rows. Reorder by dragging items or with <b>Alt + Arrow keys</b>.</div>' +
      '<div>Phone: tap a circle in Image Storage to choose a row. Once placed, drag to reorder or back to storage.</div>' +
      '<div>Rows: drag the <b>grip</b> on the tier label to reorder rows. Click the label to edit it. Tap the small <b>X</b> to delete a row (its items return to Image Storage).</div>' +
    '</div>';
}

/* ---------- Autosave to sessionStorage (restore unless full reload) ---------- */
function saveBoard(){
  var data = {
    rows: $$('.tier-row').map(function(r){
      var drop=r.querySelector('.tier-drop'); var chip=r.querySelector('.label-chip');
      return {
        label: chip.textContent, color: chip.dataset.color,
        items: $$('.token', drop).map(function(t){ return { id:t.id, isImg: !!t.querySelector('img'), label: t.querySelector('.label')?t.querySelector('.label').textContent:null, bg:t.style.background, src:(t.querySelector('img')||{}).src || null }; })
      };
    }),
    tray: $$('#tray .token').map(function(t){ return { id:t.id, isImg: !!t.querySelector('img'), label: t.querySelector('.label')?t.querySelector('.label').textContent:null, bg:t.style.background, src:(t.querySelector('img')||{}).src || null }; })
  };
  try { sessionStorage.setItem('tm_state', JSON.stringify(data)); } catch(e){}
}
function restoreBoardIfApplicable(){
  var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {type:'navigate'};
  if(nav.type === 'reload') { try{ sessionStorage.removeItem('tm_state'); }catch(e){} return; }
  var raw = sessionStorage.getItem('tm_state'); if(!raw) return;
  try {
    var data = JSON.parse(raw); if(!data || !data.rows) return;
    // clear
    $('#tierBoard').innerHTML=''; $('#tray').innerHTML='';
    // rebuild rows
    data.rows.forEach(function(r){
      var node=createRow({label:r.label, color:r.color}); $('#tierBoard').appendChild(node);
      var zone=node.querySelector('.tier-drop');
      (r.items||[]).forEach(function(it){
        var el = it.isImg ? buildImageToken(it.src, it.label||'') : buildNameToken(it.label||'', it.bg||nextPreset(), true);
        el.id = it.id || uid(); zone.appendChild(el);
      });
    });
    // tray
    (data.tray||[]).forEach(function(it){
      var el = it.isImg ? buildImageToken(it.src, it.label||'') : buildNameToken(it.label||'', it.bg||nextPreset(), true);
      el.id = it.id || uid(); $('#tray').appendChild(el);
    });
  } catch(e){}
}

/* ---------- Init ---------- */
var board=null, tray=null;
document.addEventListener('DOMContentLoaded', function(){
  board=$('#tierBoard'); tray=$('#tray');

  // Rows (or restore)
  restoreBoardIfApplicable();
  if(!board.children.length){
    defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });
  }

  // Tray defaults (pre-rendered with black labels)
  if(!$('#tray .token')){
    communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset(), true)); });
  }

  // Hook up zones
  enableClickToPlace(tray);

  // Add tier
  on($('#addTierBtn'),'click',function(){
    board.appendChild(createRow({label:'NEW',color:nextTierColor()}));
    saveBoard();
  });

  // Add custom name + improved color picker preview
  var nameColor=$('#nameColor'), nameInput=$('#nameInput'), addBtn=$('#addNameBtn');
  var lastColor = nameColor ? nameColor.value : '#8b7dff';
  if(nameColor){
    on(nameColor,'input',function(){ lastColor = nameColor.value; nameColor.style.boxShadow='0 0 0 3px rgba(0,0,0,.35) inset, 0 0 0 3px '+lastColor+'33'; });
  }
  on(addBtn,'click',function(){
    var name=(nameInput.value||'').trim(); if(!name) return;
    var color = (nameColor && nameColor.value) || nextPreset();
    tray.appendChild(buildNameToken(name, color, false));
    nameInput.value=''; // keep last chosen color visible (no reset)
    saveBoard();
  });

  // Add images
  on($('#imageInput'),'change',function(e){
    Array.prototype.forEach.call(e.target.files,function(file){
      if(!file.type || file.type.indexOf('image/')!==0) return;
      var fr=new FileReader();
      fr.onload=function(ev){ tray.appendChild(buildImageToken(ev.target.result, file.name)); saveBoard(); };
      fr.readAsDataURL(file);
    });
  });

  // Help
  setHelp();

  // Keyboard quick-jump 1..N
  on(document,'keydown',function(e){
    var selected=$('.token.selected'); if(!selected) return;
    var n=parseInt(e.key,10); if(!isNaN(n)&&n>=1&&n<=rowCount()){
      e.preventDefault(); var rows=$$('.tier-row'); var row=rows[n-1]; if(!row) return;
      var zone=row.querySelector('.tier-drop'); var fromId=ensureId(selected.parentElement,'zone');
      var origin=selected.parentElement; ensureId(zone,'zone');
      flipZones([origin,zone],function(){ zone.appendChild(selected); });
      selected.classList.remove('selected');
      recordPlacement(selected.id,fromId,zone.id,''); vib(4); saveBoard();
    }
  });

  // Undo initial disabled
  var u=$('#undoBtn'); if(u) u.disabled=true;

  live('Ready.');
});
