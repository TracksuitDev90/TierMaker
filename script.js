/* ---------- Polyfills (padStart, matches, closest) ---------- */
(function () {
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (targetLength, padString) {
      targetLength = targetLength >> 0;
      padString = String(padString || ' ');
      if (this.length >= targetLength) return String(this);
      var toPad = targetLength - this.length;
      if (toPad > padString.length) padString += padString.repeat(Math.ceil(toPad / padString.length));
      return padString.slice(0, toPad) + String(this);
    };
  }
  if (!Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.msMatchesSelector ||
      Element.prototype.webkitMatchesSelector ||
      function (sel) {
        var m = (this.document || this.ownerDocument).querySelectorAll(sel), i = m.length;
        while (--i >= 0 && m.item(i) !== this) {}
        return i > -1;
      };
  }
  if (!Element.prototype.closest) {
    Element.prototype.closest = function (sel) {
      var el = this;
      if (!document.documentElement.contains(el)) return null;
      do { if (el.matches(sel)) return el; el = el.parentElement || el.parentNode; }
      while (el && el.nodeType === 1);
      return null;
    };
  }
})();

/* ---------- Small helpers ---------- */
var $  = function (s, ctx){ return (ctx||document).querySelector(s); };
var $$ = function (s, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); };
function on(el, ev, h, opt){ if(!el) return; el.addEventListener(ev, h, opt||false); }
function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
function isSmall(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }
function live(msg){ var n=$('#live'); if(!n) return; n.textContent=''; setTimeout(function(){ n.textContent=msg; },0); }
function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function ensureId(el, prefix){ if(!el.id){ el.id=(prefix||'id')+'-'+uid(); } return el.id; }

/* ---------- Color utils ---------- */
function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3){ h=h.split('').map(function(x){return x+x;}).join(''); } var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
function relativeLuminance(rgb){ function srgb(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); } return 0.2126*srgb(rgb.r)+0.7152*srgb(rgb.g)+0.0722*srgb(rgb.b); }
function contrastColor(bgHex){ var L=relativeLuminance(hexToRgb(bgHex)); return L>0.58 ? '#000000' : '#ffffff'; }
function lighten(hex,p){ var c=hexToRgb(hex), f=p||0; return rgbToHex(Math.round(c.r+(255-c.r)*f), Math.round(c.g+(255-c.g)*f), Math.round(c.b+(255-c.b)*f)); }
function darken(hex,p){ var c=hexToRgb(hex), f=(1-(p||0)); return rgbToHex(Math.round(c.r*f), Math.round(c.g*f), Math.round(c.b*f)); }

/* ---------- Global refs ---------- */
var board = null, tray = null;

/* ---------- Palettes ---------- */
/* Pre-rendered palette tuned so black labels work and colors aren’t washed out */
var BASE_PALETTE = [
  '#FCE38A','#F3A683','#F5CD7A','#F7D794',
  '#778BEB','#EB8688','#CF6A87','#786FA6',
  '#F8A5C2','#64CDDB','#3EC1D3','#E77F67',
  '#FA991C','#FAD4C9','#7FC4D4','#A7B3E9',
  '#FBD78B','#EFA7A7','#9FD8DF','#C8B6FF',
  '#B8E1FF','#FFD6A5','#C3F0CA','#FFE5EC',
  '#F4B942','#9EE493','#8AC6D1','#FF8FAB','#B0A8F0'
];
function ensureForBlack(hex){
  var out=hex, step=0;
  while (step<3) {
    var L=relativeLuminance(hexToRgb(out));
    if ((L+0.05)/0.05 >= 4.5) break;
    out = lighten(out, 0.03);
    step++;
  }
  return out;
}
var presetPalette = BASE_PALETTE.map(ensureForBlack);
var pIndex = 0; function nextPreset(){ var c=presetPalette[pIndex % presetPalette.length]; pIndex++; return c; }

/* New row colors (bright) + A row more yellow */
var defaultTiers = [
  { label:'S', color:'#ff6b6b' },
  { label:'A', color:'#f6c02f' },
  { label:'B', color:'#22c55e' },
  { label:'C', color:'#3b82f6' },
  { label:'D', color:'#a78bfa' }
];
var TIER_CYCLE = ['#ff6b6b','#f6c02f','#22c55e','#3b82f6','#a78bfa','#06b6d4','#e11d48','#16a34a','#f97316','#0ea5e9'];
var tierIdx = 0; function nextTierColor(){ var c=TIER_CYCLE[tierIdx%TIER_CYCLE.length]; tierIdx++; return c; }

/* ---------- Community cast (incl. Kikki, Tems, TomTom) ---------- */
var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Harry","Jay","Jeremy","Katie","Keyon","Kiev","Kikki","Kyle","Lewis","Meegan","Munch",
  "Paper","Ray","Safoof","Temz","TomTom","V","Versse","Wobbles","Xavier"
];

/* ---------- Label fitting ---------- */
/* Circle token labels (UI + reliability): single line, big as possible */
function fitTokenLabel(labelEl, tokenEl){
  var D = Math.min(tokenEl.clientWidth, tokenEl.clientHeight);
  if (!D) return;
  var pad = 12;
  labelEl.style.whiteSpace = 'nowrap';
  labelEl.style.wordBreak = 'normal';
  labelEl.style.overflow = 'hidden';
  labelEl.style.textOverflow = 'clip';
  labelEl.style.display = 'flex';
  labelEl.style.alignItems = 'center';
  labelEl.style.justifyContent = 'center';
  labelEl.style.height = '100%';
  labelEl.style.padding = '0 '+pad+'px';

  // aggressive but safe: long names shrink slightly; short names stay big
  var min = Math.max(12, Math.floor(D * 0.20));
  var max = Math.floor(D * 0.44);
  var best = min;

  function fits(px){
    labelEl.style.fontSize = px + 'px';
    return labelEl.scrollWidth <= (D - pad*2);
  }
  while (min <= max){
    var mid = (min + max) >> 1;
    if (fits(mid)){ best = mid; min = mid + 1; } else { max = mid - 1; }
  }
  labelEl.style.fontSize = best + 'px';
}

/* Tier chip text: start BIG (single letters), shrink as text grows */
function fitChipText(chip){
  if (!chip) return;
  // make the chip behave like a centered label box
  chip.style.display='flex';
  chip.style.alignItems='center';
  chip.style.justifyContent='center';
  chip.style.whiteSpace='nowrap';
  chip.style.overflow='hidden';
  chip.style.textOverflow='clip';

  var pad = 14;
  var W = chip.clientWidth - pad*2;
  var H = chip.clientHeight - 8;
  // default large (for single letter), shrink as needed
  var max = Math.floor(H * 0.70); // BIG default
  var min = 12, best = min;

  function fits(px){
    chip.style.fontSize = px+'px';
    return chip.scrollWidth <= W && chip.scrollHeight <= H;
  }
  // grow first (for single letters), then back off
  var lo=min, hi=max;
  while(lo<=hi){
    var mid=(lo+hi)>>1;
    if(fits(mid)){ best=mid; lo=mid+1; } else { hi=mid-1; }
  }
  chip.style.fontSize = best+'px';
}

/* ---------- Smooth FLIP animation for token reorder ---------- */
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
          t.style.transition='transform .22s ease';
          t.style.transform='translate('+dx+'px,'+dy+'px)';
          requestAnimationFrame(function(){
            t.style.transform='translate(0,0)';
            setTimeout(function(){ t.style.transition=''; t.style.transform=''; },240);
          });
        }
      });
    });
  });
}

/* ---------- Build tokens ---------- */
function buildTokenBase(){
  var el = document.createElement('div');
  el.className='token';
  el.id = uid();
  el.setAttribute('tabindex','0');
  el.setAttribute('role','listitem');
  el.setAttribute('aria-grabbed','false');
  el.setAttribute('draggable','false');
  el.style.touchAction='none';

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
  on(el,'keydown', function(e){
    // keyboard reorder within a row, and send to prev/next row
    if (!el.parentElement) return;
    var zone = el.parentElement;
    if (!e.altKey) return;
    if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
      e.preventDefault();
      var sibs=[].slice.call(zone.querySelectorAll('.token'));
      var i=sibs.indexOf(el);
      if (i<0) return;
      var j = e.key==='ArrowLeft' ? Math.max(0,i-1) : Math.min(sibs.length-1,i+1);
      if (j!==i){
        var before = sibs[j + (e.key==='ArrowRight'?1:0)] || null;
        var fromId=ensureId(zone,'zone'), toId=fromId, beforeId = before?ensureId(before,'tok'):'';
        flipZones([zone], function(){
          if(before) zone.insertBefore(el,before); else zone.appendChild(el);
        });
        recordPlacement(el.id, fromId, toId, beforeId);
        scheduleSave();
      }
    } else if (e.key==='ArrowUp' && e.altKey){
      e.preventDefault();
      var rows=$$('.tier-row'); var r=el.closest('.tier-row'); var idx=rows.indexOf(r);
      if (idx>0){ var target=rows[idx-1].querySelector('.tier-drop'); moveToken(el,target); }
    } else if (e.key==='ArrowDown' && e.altKey){
      e.preventDefault();
      var rows=$$('.tier-row'); var r=el.closest('.tier-row'); var idx=rows.indexOf(r);
      if (idx>=0 && idx<rows.length-1){ var target=rows[idx+1].querySelector('.tier-drop'); moveToken(el,target); }
    }
  });

  if (!isSmall()){
    if (window.PointerEvent) enablePointerDrag(el);
    else enableMouseTouchDragFallback(el);
  } else {
    enableMobileTouchDrag(el);
  }

  return el;
}
function buildNameToken(name, color, forceBlack){
  var el = buildTokenBase();
  el.style.background = color;
  var label = document.createElement('div');
  label.className='label';
  label.textContent = name;
  label.style.color = forceBlack ? '#111' : contrastColor(color);
  el.appendChild(label);
  fitTokenLabel(label, el);
  el.setAttribute('aria-label', 'Token '+name);
  return el;
}
function buildImageToken(src, alt){
  var el = buildTokenBase();
  var img = document.createElement('img'); img.src=src; img.alt=alt||''; img.draggable=false; el.appendChild(img);
  el.setAttribute('aria-label', 'Image token '+(alt||''));
  return el;
}

/* ---------- Placement helpers ---------- */
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
function getDropZoneFromElement(el){
  if (!el) return null;
  var dz=el.closest('.dropzone, #tray'); if(dz) return dz;
  var chip=el.closest('.tier-label'); if(chip){ var row=chip.closest('.tier-row'); return row?row.querySelector('.tier-drop'):null; }
  return null;
}
function moveToken(token, toZone){
  if (!token || !toZone) return;
  var origin = token.parentElement;
  var fromId = ensureId(origin,'zone');
  var toId = ensureId(toZone,'zone');
  flipZones([origin, toZone], function(){ toZone.appendChild(token); });
  recordPlacement(token.id, fromId, toId, '');
}

/* ---------- Drag (desktop/iPad) ---------- */
function enablePointerDrag(node){
  var ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  on(node,'pointerdown', function(e){
    if (isSmall()) return;
    if (e.button!==0) return;
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-item');
    node.setAttribute('aria-grabbed','true');

    originParent = node.parentElement; originNext = node.nextElementSibling;
    var r=node.getBoundingClientRect(); offsetX=e.clientX-r.left; offsetY=e.clientY-r.top; x=e.clientX; y=e.clientY;

    ghost = node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden');

    function move(ev){ x=ev.clientX; y=ev.clientY; }
    function up(){
      try{ node.releasePointerCapture(e.pointerId); }catch(_){}
      document.removeEventListener('pointermove', move, false);
      document.removeEventListener('pointerup', up, false);
      cancelAnimationFrame(raf);
      var target = document.elementFromPoint(x,y);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden');
      document.body.classList.remove('dragging-item');
      node.setAttribute('aria-grabbed','false');

      var zone = getDropZoneFromElement(target);
      if (zone){
        var fromId = ensureId(originParent,'zone');
        var toId   = ensureId(zone,'zone');
        var beforeTok = insertBeforeForPoint(zone,x,y,node);
        var beforeId = beforeTok ? ensureId(beforeTok,'tok') : '';
        flipZones([originParent, zone], function(){
          if(beforeTok) zone.insertBefore(node, beforeTok); else zone.appendChild(node);
        });
        recordPlacement(node.id, fromId, toId, beforeId);
        node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
        var rr = zone.closest ? zone.closest('.tier-row') : null;
        live('Moved "'+(node.innerText||'item')+'" to '+ (rr?rowLabel(rr):'Image Storage') );
        vib(6);
        scheduleSave();
      } else {
        flipZones([originParent], function(){
          if (originNext && originNext.parentElement===originParent) originParent.insertBefore(node, originNext);
          else originParent.appendChild(node);
        });
      }
      if (currentZone) currentZone.classList.remove('drag-over');
      currentZone=null;
    }

    document.addEventListener('pointermove', move, false);
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

/* ---------- Legacy mouse drag fallback ---------- */
function enableMouseTouchDragFallback(node){
  var dragging=false, ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  function start(e, clientX, clientY){
    if (isSmall()) return; dragging=true; document.body.classList.add('dragging-item');
    if (e && e.preventDefault) e.preventDefault();

    originParent=node.parentElement; originNext=node.nextElementSibling;
    var r=node.getBoundingClientRect(); offsetX=clientX-r.left; offsetY=clientY-r.top; x=clientX; y=clientY;

    ghost = node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden'); loop();
  }
  function move(clientX, clientY){ if(!dragging) return; x=clientX; y=clientY; }
  function end(){
    if(!dragging) return; dragging=false;
    cancelAnimationFrame(raf);
    var target=document.elementFromPoint(x,y);
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    node.classList.remove('drag-hidden');
    document.body.classList.remove('dragging-item');
    var zone=getDropZoneFromElement(target);
    if (zone){
      var fromId=ensureId(originParent,'zone'), toId=ensureId(zone,'zone');
      var beforeTok=insertBeforeForPoint(zone,x,y,node);
      var beforeId = beforeTok ? ensureId(beforeTok,'tok') : '';
      flipZones([originParent, zone], function(){
        if(beforeTok) zone.insertBefore(node,beforeTok); else zone.appendChild(node);
      });
      recordPlacement(node.id, fromId, toId, beforeId);
      node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
      var rr = zone.closest ? zone.closest('.tier-row') : null;
      live('Moved "'+(node.innerText||'item')+'" to '+ (rr?rowLabel(rr):'Image Storage') );
      vib(6);
      scheduleSave();
    } else {
      flipZones([originParent], function(){
        if (originNext && originNext.parentElement===originParent) originParent.insertBefore(node, originNext);
        else originParent.appendChild(node);
      });
    }
    if (currentZone) currentZone.classList.remove('drag-over');
    currentZone=null;
  }

  on(node,'mousedown', function(e){ if(e.button!==0) return; start(e,e.clientX,e.clientY);
    on(document,'mousemove', onMouseMove); on(document,'mouseup', onMouseUp); });
  function onMouseMove(e){ move(e.clientX,e.clientY); }
  function onMouseUp(){ document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); end(); }

  function loop(){
    raf=requestAnimationFrame(loop);
    ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';
    var el=document.elementFromPoint(x,y);
    var zone=getDropZoneFromElement(el);
    if (currentZone && currentZone!==zone) currentZone.classList.remove('drag-over');
    if (zone && zone!==currentZone) zone.classList.add('drag-over');
    currentZone = zone || null;
  }
}

/* ---------- Mobile touch drag (reorder inside rows) ---------- */
function enableMobileTouchDrag(node){
  if(!('PointerEvent' in window)) return;
  on(node,'pointerdown',function(e){
    if(!isSmall())return;
    if(e.pointerType!=='touch' && e.pointerType!=='pen')return;
    if(!node.closest('.tier-drop'))return;
    e.preventDefault(); node.setPointerCapture(e.pointerId); document.body.classList.add('dragging-item');

    var ghost=node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    var originParent=node.parentElement, originNext=node.nextElementSibling;
    node.classList.add('drag-hidden');

    var r=node.getBoundingClientRect(), offsetX=e.clientX-r.left, offsetY=e.clientY-r.top, x=e.clientX, y=e.clientY;
    function move(ev){x=ev.clientX;y=ev.clientY; ghost.style.transform='translate3d('+(x-offsetX)+'px,'+(y-offsetY)+'px,0)';}
    function up(){
      try{node.releasePointerCapture(e.pointerId);}catch(_){}
      document.removeEventListener('pointermove',move,false);
      document.removeEventListener('pointerup',up,false);
      if(ghost&&ghost.parentNode)ghost.parentNode.removeChild(ghost);
      node.classList.remove('drag-hidden'); document.body.classList.remove('dragging-item');

      var target=document.elementFromPoint(x,y); var zone=getDropZoneFromElement(target);
      if(zone){
        var fromId=ensureId(originParent,'zone'), toId=ensureId(zone,'zone');
        var beforeTok=insertBeforeForPoint(zone,x,y,node);
        var beforeId=beforeTok?ensureId(beforeTok,'tok'):'';
        flipZones([originParent, zone], function(){
          if(beforeTok)zone.insertBefore(node,beforeTok); else zone.appendChild(node);
        });
        recordPlacement(node.id,fromId,toId,beforeId);
        node.classList.add('animate-drop'); setTimeout(function(){node.classList.remove('animate-drop');},180);
        var rr=zone.closest?zone.closest('.tier-row'):null; live('Moved "'+(node.innerText||'item')+'" to '+(rr?rowLabel(rr):'Image Storage'));
        vib(6);
        scheduleSave();
      } else {
        flipZones([originParent], function(){
          if(originNext&&originNext.parentElement===originParent)originParent.insertBefore(node,originNext);
          else originParent.appendChild(node);
        });
      }
    }
    document.addEventListener('pointermove',move,false);
    document.addEventListener('pointerup',up,false);
  },false);
}

/* ---------- Rows (build + tint) ---------- */
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

function buildRowDom(){
  var row=document.createElement('div'); row.className='tier-row';

  var labelWrap=document.createElement('div'); labelWrap.className='tier-label'; labelWrap.setAttribute('aria-label','Tier label (drag to reorder rows)');

  var chip=document.createElement('div');
  chip.className='label-chip'; chip.setAttribute('contenteditable','true'); chip.setAttribute('spellcheck','false');
  chip.title='Click to edit tier name';
  // BIG default, shrink-to-fit on input
  chip.addEventListener('input', function(){ fitChipText(chip); scheduleSave(); });

  var grip=document.createElement('span'); grip.className='row-grip'; grip.setAttribute('aria-hidden','true'); grip.innerHTML='≡';
  // If you style grips in CSS, keep this span absolutely or inline as desired.
  labelWrap.appendChild(grip);
  labelWrap.appendChild(chip);

  var del=document.createElement('button'); del.className='row-del'; del.type='button';
  del.setAttribute('aria-label','Delete row');
  del.innerHTML='<svg viewBox="0 0 24 24"><path d="M18.3 5.7L12 12l-6.3-6.3-1.4 1.4L10.6 13.4l-6.3 6.3 1.4 1.4L12 14.4l6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3z"/></svg>';
  labelWrap.appendChild(del);

  var drop=document.createElement('div');
  drop.className='tier-drop dropzone'; drop.setAttribute('tabindex','0');

  row.appendChild(labelWrap); row.appendChild(drop);

  // Make the label area the row drag handle
  enableRowReorder(labelWrap, row);

  return { row: row, chip: chip, del: del, drop: drop, labelWrap: labelWrap };
}

function createRow(cfg){
  var dom = buildRowDom();
  var node = dom.row, chip = dom.chip, del = dom.del, drop = dom.drop;

  ensureId(node,'row'); ensureId(drop,'zone');

  chip.textContent = cfg.label;                   // default single letter
  chip.dataset.color = cfg.color;
  chip.style.background = cfg.color;
  chip.style.color = contrastColor(cfg.color);
  del.style.background = darken(cfg.color, 0.35);
  fitChipText(chip);                               // make it BIG, then shrink as needed

  var tint = tintFrom(cfg.color);
  drop.style.background = tint; drop.dataset.manual = 'false';

  on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });

  on(del,'click', function(){
    if (!confirm('Delete this tier? Its items will return to Image Storage.')) return;
    var tokens = $$('.token', drop);
    flipZones([drop,tray], function(){ tokens.forEach(function(t){ tray.appendChild(t); }); });
    node.remove(); refreshRadialOptions(); scheduleSave();
  });

  enableClickToPlace(drop);
  return node;
}

/* ---------- Row drag/reorder (pointer-based) ---------- */
function enableRowReorder(handle, row){
  var dragging=false, placeholder=null;

  function start(e){
    if (isSmall() && (('ontouchstart' in window)||navigator.maxTouchPoints>0)) return; // desktop/iPad only
    dragging=true; e.preventDefault();
    placeholder = document.createElement('div');
    placeholder.className='tier-row';
    placeholder.style.height = row.getBoundingClientRect().height+'px';
    placeholder.style.borderRadius='12px';
    placeholder.style.border='2px dashed rgba(139,125,255,.25)';
    board.insertBefore(placeholder, row.nextSibling);
    row.style.opacity='.35';
    recordRowOrder(); // capture pre-drag order for undo
    document.addEventListener('mousemove', move); document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('mouseup', end);    document.addEventListener('touchend', end);
  }
  function move(e){
    if(!dragging) return;
    e.preventDefault();
    var y=(e.touches?e.touches[0].clientY:e.clientY);
    var after = rowAfterY(board, y);
    if (after) board.insertBefore(placeholder, after); else board.appendChild(placeholder);
  }
  function end(){
    if(!dragging) return; dragging=false;
    board.insertBefore(row, placeholder);
    placeholder.remove(); placeholder=null;
    row.style.opacity='';
    scheduleSave();
    document.removeEventListener('mousemove', move); document.removeEventListener('touchmove', move);
    document.removeEventListener('mouseup', end);    document.removeEventListener('touchend', end);
  }
  function rowAfterY(container, y){
    var rows = Array.prototype.filter.call(container.querySelectorAll('.tier-row'), function(r){ return r!==row && r!==placeholder; });
    for (var i=0;i<rows.length;i++){ var r=rows[i], rect=r.getBoundingClientRect(); if (y < rect.top + rect.height/2) return r; }
    return null;
  }

  on(handle,'mousedown', start);
  on(handle,'touchstart', start, {passive:false});
}

/* ---------- Click-to-place ---------- */
function enableClickToPlace(zone){
  ensureId(zone,'zone');
  on(zone,'click', function(e){
    var picker=$('#radialPicker'); if(picker && !picker.classList.contains('hidden')) return;
    var selected = $('.token.selected'); if (!selected) return;
    if(isSmall() && !selected.closest('#tray')) return; // mobile: tray-only
    var fromId = ensureId(selected.parentElement,'zone'); if(fromId===zone.id) return;
    var origin = selected.parentElement;
    flipZones([origin, zone], function(){ zone.appendChild(selected); });
    selected.classList.remove('selected');
    recordPlacement(selected.id, fromId, zone.id);
    var r = zone.closest ? zone.closest('.tier-row') : null;
    live('Moved "'+(selected.innerText||'item')+'" to '+ (r?rowLabel(r):'Image Storage') );
    vib(6);
    scheduleSave();
  });
}

/* ---------- Mobile radial (tray -> row) ---------- */
var radial = $('#radialPicker');
var radialOpts = radial?$('.radial-options', radial):null;
var radialCloseBtn = radial?$('.radial-close', radial):null;
var radialForToken = null;

function rowCount(){ return $$('.tier-row').length; }
function uniformCenter(cx, cy, R){
  var M=16; return { x: Math.max(M+R, Math.min(window.innerWidth-M-R, cx)), y: Math.max(M+R, cy) };
}
function refreshRadialOptions(){
  if (!isSmall() || !radial || !radialForToken) return;
  openRadial(radialForToken);
}
function openRadial(token){
  if(!radial||!isSmall()) return;
  radialForToken = token;

  var rect = token.getBoundingClientRect();
  var cx = rect.left + rect.width/2;
  var cy = rect.top + rect.height/2;

  var rows = $$('.tier-row');
  var labels = rows.map(function(r){ return rowLabel(r); });
  var N = labels.length; if (!N) return;

  var DOT=42, GAP=8, degStart=200, degEnd=340, stepDeg=(degEnd-degStart)/Math.max(1,(N-1)), stepRad=stepDeg*Math.PI/180;
  var BASE_R=90, need=(DOT+GAP)/(2*Math.sin(Math.max(stepRad/2,0.05)));
  var R=Math.max(BASE_R, need);
  var center=uniformCenter(cx,cy,R);

  radialOpts.innerHTML = '';
  for (var i=0;i<N;i++){
    var ang=(degStart+stepDeg*i)*Math.PI/180;
    var x=center.x+R*Math.cos(ang), y=center.y+R*Math.sin(ang);
    var btn = document.createElement('button'); btn.type='button'; btn.className='radial-option';
    btn.style.left = x+'px'; btn.style.top = y+'px'; btn.style.transitionDelay = (i*14)+'ms';
    var dot=document.createElement('span'); dot.className='dot'; dot.textContent=labels[i]; btn.appendChild(dot);
    (function(row){ on(btn,'click', function(){ selectRadialTarget(row); }); })(rows[i]);
    radialOpts.appendChild(btn);
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

  radial.classList.remove('hidden'); radial.classList.add('visible','show'); radial.setAttribute('aria-hidden','false');
  setTimeout(function(){ radial.classList.remove('show'); }, 160 + N*14);
}
function selectRadialTarget(row){
  if (!radialForToken || !row) return;
  var zone = row.querySelector('.tier-drop');
  var fromId = ensureId(radialForToken.parentElement,'zone');
  var origin = radialForToken.parentElement; ensureId(zone,'zone');
  flipZones([origin, zone], function(){ zone.appendChild(radialForToken); });
  radialForToken.classList.remove('selected');
  recordPlacement(radialForToken.id, fromId, zone.id);
  vib(7); scheduleSave();
  closeRadial();
}
function closeRadial(){
  if(!radial) return;
  if(radial._backdropHandler){ radial.removeEventListener('pointerdown', radial._backdropHandler); delete radial._backdropHandler; }
  radial.classList.add('hidden'); radial.classList.remove('visible','show'); radial.setAttribute('aria-hidden','true');
  radialForToken = null;
}
on(window,'resize', function(){
  // Re-fit all token labels on resize
  $$('.token').forEach(function(t){ var l=$('.label',t); if(l) fitTokenLabel(l,t); });
  refreshRadialOptions();
});

/* ---------- History (Undo) ---------- */
var historyStack = []; // {type:'move'|'rows', itemId, fromId, toId, beforeId, order}
function recordPlacement(itemId, fromId, toId, beforeId){
  if (!fromId || !toId || (fromId===toId && !beforeId)) return;
  historyStack.push({type:'move', itemId:itemId, fromId:fromId, toId:toId, beforeId: beforeId||''});
  $('#undoBtn').disabled = historyStack.length===0;
}
function recordRowOrder(){
  var ids = $$('.tier-row').map(function(r){ return ensureId(r,'row'); });
  historyStack.push({type:'rows', order: ids});
  $('#undoBtn').disabled = historyStack.length===0;
}
function performMove(itemId, parentId, beforeId){
  var item = document.getElementById(itemId);
  var parent = document.getElementById(parentId);
  if (!item || !parent) return;
  flipZones([item.parentElement, parent], function(){
    if (beforeId){
      var before = document.getElementById(beforeId);
      if (before && before.parentElement === parent){ parent.insertBefore(item, before); return; }
    }
    parent.appendChild(item);
  });
}

/* ---------- Clear / Undo ---------- */
on($('#trashClear'),'click', function(){
  if (!confirm('Clear the entire tier board? This moves all placed items back to Image Storage.')) return;
  $$('.tier-drop .token').forEach(function(tok){ tray.appendChild(tok); });
  scheduleSave();
});
on($('#undoBtn'),'click', function(){
  var last = historyStack.pop(); if (!last) return;
  if (last.type==='move'){
    performMove(last.itemId, last.fromId, last.beforeId);
  } else if (last.type==='rows'){
    var map=new Map(); $$('.tier-row').forEach(function(r){ map.set(r.id, r); });
    last.order.forEach(function(id){ var r=map.get(id); if(r) board.appendChild(r); });
  }
  $('#undoBtn').disabled = historyStack.length===0;
  scheduleSave();
});

/* ---------- Export (PNG) — exact on-page sizes ---------- */
on($('#saveBtn'),'click', function(){
  if (!window.html2canvas) { alert('The export library failed to load. Please try again.'); return; }

  var toast=document.createElement('div');
  toast.style.position='fixed'; toast.style.right='16px'; toast.style.bottom='16px';
  toast.style.padding='10px 12px'; toast.style.borderRadius='10px';
  toast.style.background='rgba(0,0,0,.7)'; toast.style.color='#fff'; toast.style.zIndex='9999';
  toast.style.font='600 14px/1.2 ui-sans-serif, system-ui, -apple-system';
  toast.textContent='Rendering PNG…';
  document.body.appendChild(toast);

  var panel = $('#boardPanel');

  // clone whole panel; keep actual sizes; center labels in export; DO NOT resize circles
  var cloneWrap = document.createElement('div');
  cloneWrap.style.position='fixed'; cloneWrap.style.left='-99999px'; cloneWrap.style.top='0';

  var clone = panel.cloneNode(true);

  // Hide row delete X; make label boxes perfectly centered (no vertical shift)
  var style = document.createElement('style');
  style.textContent = `
    .row-del{ display:none !important; }
    .token .label{
      display:flex !important;
      align-items:center !important;
      justify-content:center !important;
      line-height:1 !important;
      white-space:nowrap !important;
      height:100% !important;
      padding:0 8px !important;
      text-shadow:none !important;
    }
  `;
  clone.appendChild(style);

  // If the title is blank, drop it from the export
  var title = clone.querySelector('.board-title');
  if (title && !title.textContent.trim()){
    var wrap = title.parentElement; if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
  }

  cloneWrap.appendChild(clone);
  document.body.appendChild(cloneWrap);

  // Use the clone’s own measured size to ensure “entire board” capture
  // (scrollWidth/Height get all content even if panel is larger than viewport)
  var width  = Math.ceil(clone.scrollWidth);
  var height = Math.ceil(clone.scrollHeight);

  html2canvas(clone, {
    backgroundColor: cssVar('--surface') || null,
    useCORS: true,
    scale: 2,
    width: width,
    height: height,
    windowWidth: width,
    windowHeight: height
  }).then(function(canvas){
    var a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tier-list.png';
    document.body.appendChild(a); a.click(); a.remove();
  }).catch(function(err){
    console.error(err);
    alert('Sorry, PNG export failed.');
  }).finally(function(){
    cloneWrap.remove(); toast.remove();
  });
});

/* ---------- Autosave (restore unless hard reload) ---------- */
function snapshot(){
  var rows = $$('.tier-row').map(function(r){
    var chip=$('.label-chip',r);
    var items=$$('.token', $('.tier-drop',r)).map(serializeToken);
    return { id:r.id, label: chip?chip.textContent:'', color: chip?chip.dataset.color:'#8b7dff', items: items };
  });
  var trayItems = $$('.token', tray).map(serializeToken);
  return { rows: rows, tray: trayItems };
}
function serializeToken(t){
  var img=t.querySelector('img');
  return img
    ? { id:t.id, kind:'img', src:img.src, alt:img.alt }
    : { id:t.id, kind:'name', text:$('.label',t).textContent, bg:t.style.background, forceBlack: ($('.label',t).style.color||'#000').toLowerCase()==='#111' };
}
function restore(state){
  board.innerHTML=''; tray.innerHTML='';
  state.rows.forEach(function(r){
    var row=createRow({label:r.label, color:r.color});
    board.appendChild(row);
    var drop=row.querySelector('.tier-drop');
    r.items.forEach(function(it){ drop.appendChild(deserializeToken(it)); });
  });
  state.tray.forEach(function(it){ tray.appendChild(deserializeToken(it)); });
  // re-fit all labels after restore
  $$('.token').forEach(function(t){ var l=$('.label',t); if(l) fitTokenLabel(l,t); });
  refreshRadialOptions();
}
function deserializeToken(obj){
  if (obj.kind==='img'){ var t=buildImageToken(obj.src, obj.alt||''); t.id=obj.id||uid(); return t; }
  var t=buildNameToken(obj.text, obj.bg||nextPreset(), obj.forceBlack); t.id=obj.id||uid(); return t;
}
var saveTimer=null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveNow, 160); }
function saveNow(){ try{ localStorage.setItem('tm_state', JSON.stringify(snapshot())); }catch(_){ } }

/* ---------- Device-aware tips (no “Help” word) ---------- */
function setTips(){
  var help=$('#helpText') || $('.help'); if(!help) return;
  var rowsLine = 'Rows: drag the tier label to reorder rows. Click the tier name to edit it. Tap the small X on a tier label to delete that row (its items return to Image Storage).';
  var deviceLine = isSmall()
    ? 'Phone: tap a circle in Image Storage to choose a row. Once placed, drag to reorder or drag back to Image Storage.'
    : 'Desktop/Tablet: drag circles into rows. Reorder by dragging items or use Alt+Arrow keys.';
  help.innerHTML =
    '<div>'+deviceLine+'</div>' +
    '<div>'+rowsLine+'</div>';
}

/* ---------- Color picker UX ---------- */
(function(){
  var input = $('#nameColor'); if(!input) return;
  on(input,'input', function(){ input.setAttribute('aria-label','Selected color '+input.value); });
})();

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function start(){
  board = $('#tierBoard'); tray = $('#tray');

  // Restore unless it’s a reload navigation
  var nav = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
  var isReload = nav && (nav.type === 'reload');
  if (isReload) { try{ localStorage.removeItem('tm_state'); }catch(_){ } }

  var state=null; try{ state=JSON.parse(localStorage.getItem('tm_state')||''); }catch(_){}
  if (state && !isReload){ restore(state); }
  else {
    // defaults: BIG single letters
    defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });
    communityCast.forEach(function(n){ tray.appendChild(buildNameToken(n, nextPreset(), true)); });
  }

  // Add tier
  on($('#addTierBtn'),'click', function(){
    board.appendChild(createRow({label:'NEW', color: nextTierColor()}));
    refreshRadialOptions(); scheduleSave();
  });

  // Creator: name + color + add (keep chosen color)
  on($('#addNameBtn'),'click', function(){
    var name = $('#nameInput').value.trim();
    if (!name) return;
    var colorInput=$('#nameColor');
    var chosen = colorInput.value || nextPreset();
    var tok = buildNameToken(name, chosen, false);
    tray.appendChild(tok);
    $('#nameInput').value='';
    scheduleSave();
  });

  // Image uploads
  on($('#imageInput'),'change', function(e){
    Array.prototype.forEach.call(e.target.files, function(file){
      if(!file.type || file.type.indexOf('image/')!==0) return;
      var reader = new FileReader();
      reader.onload = function(ev){ tray.appendChild(buildImageToken(ev.target.result, file.name)); scheduleSave(); };
      reader.readAsDataURL(file);
    });
  });

  // Enable click-to-place on tray
  enableClickToPlace(tray);

  // Initial tips + refit on resize
  setTips();
  on(window,'resize', setTips);

  // Make sure all current labels are sized
  $$('.token').forEach(function(t){ var l=$('.label',t); if(l) fitTokenLabel(l,t); });

  // Undo button state
  $('#undoBtn').disabled = historyStack.length===0;

  live('Ready.');
});

/* ---------- Radial close when clicking outside ---------- */
on(document,'click', function(e){
  if (radial && !radial.classList.contains('hidden') &&
      !e.target.closest('#radialPicker') &&
      !e.target.closest('#tray .token')){
    closeRadial();
  }
});
