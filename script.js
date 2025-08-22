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

/* ---------- Event helper ---------- */
var _supportsPassive = false;
try {
  var _opts = Object.defineProperty({}, 'passive', { get: function(){ _supportsPassive = true; } });
  window.addEventListener('passive-test', null, _opts);
  window.removeEventListener('passive-test', null, _opts);
} catch(e){ _supportsPassive = false; }
function on(el, t, h, o){ if(!el) return;
  if (!o) { el.addEventListener(t, h, false); return; }
  if (typeof o === 'object' && !_supportsPassive) el.addEventListener(t, h, !!o.capture);
  else el.addEventListener(t, h, o);
}

/* ---------- Utils ---------- */
var $  = function (s, ctx){ return (ctx||document).querySelector(s); };
var $$ = function (s, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); };
function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
function live(msg){ var n=$('#live'); if(!n) return; n.textContent=''; setTimeout(function(){ n.textContent=msg; },0); }
function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* WIDTH-BASED: phones only (iPad gets desktop behavior) */
function isSmall(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }

/* Colors */
function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3){ h=h.split('').map(function(x){return x+x;}).join(''); } var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
function relativeLuminance(rgb){ function srgb(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); } return 0.2126*srgb(rgb.r)+0.7152*srgb(rgb.g)+0.0722*srgb(rgb.b); }
function contrastColor(bgHex){ var L=relativeLuminance(hexToRgb(bgHex)); return L>0.58 ? '#000000' : '#ffffff'; }

/* ---------- Theme toggle ---------- */
(function(){
  var root=document.documentElement;
  var toggle=$('#themeToggle'); if(!toggle) return;
  var icon=$('.theme-icon',toggle), text=$('.theme-text',toggle);
  var prefersLight = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  setTheme(localStorage.getItem('tm_theme') || (prefersLight ? 'light' : 'dark'));
  on(toggle,'click', function(){ setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark'); });

  function setTheme(mode){
    root.setAttribute('data-theme', mode); localStorage.setItem('tm_theme', mode);
    var target = mode==='dark' ? 'Light' : 'Dark';
    if(text) text.textContent = target;
    if(icon) icon.innerHTML = (target==='Light'
      ? '<svg viewBox="0 0 24 24"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.22 19.78l1.79-1.79 1.8 1.79-1.8 1.8-1.79-1.8zM20 13h3v-2h-3v2zM12 1h2v3h-2V1zm6.01 3.05l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>');
    toggle.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');

    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', cssVar('--surface') || '#0f1115');

    // retint row backgrounds
    $$('.tier-row').forEach(function(row){
      var chip=$('.label-chip',row), drop=$('.tier-drop',row);
      if (chip && drop && drop.dataset.manual!=='true'){
        var nt = tintFrom(chip.dataset.color || '#8b7dff');
        drop.style.background = nt;
      }
    });
  }
})();

/* ---------- DOM refs ---------- */
var board = null, tray = null;

/* ---------- Build a row ---------- */
function buildRowDom(){
  var row = document.createElement('div'); row.className='tier-row';
  var labelWrap = document.createElement('div'); labelWrap.className='tier-label';

  var chip = document.createElement('div');
  chip.className='label-chip'; chip.setAttribute('contenteditable','true'); chip.setAttribute('spellcheck','false');

  var menuBtn = document.createElement('button');
  menuBtn.className='row-menu'; menuBtn.type='button'; menuBtn.textContent='⋯';

  var pop = document.createElement('div'); pop.className='row-popover';
  pop.innerHTML =
    '<div class="row-option"><span>Label color</span><input class="labelColor" type="color" value="#ff6b6b" /></div>' +
    '<div class="row-option"><span>Row color</span><input class="rowColor" type="color" /></div>' +
    '<div class="row-buttons">' +
      '<button class="btn small clearRow" type="button">Clear row</button>' +
      '<button class="btn btn-danger small removeRow" type="button">Delete row</button>' +
    '</div>';

  labelWrap.appendChild(chip); labelWrap.appendChild(menuBtn); labelWrap.appendChild(pop);

  var drop = document.createElement('div');
  drop.className='tier-drop dropzone'; drop.setAttribute('tabindex','0');

  row.appendChild(labelWrap); row.appendChild(drop);
  return { row: row, chip: chip, menuBtn: menuBtn, pop: pop, drop: drop, labelWrap: labelWrap };
}

function tintFrom(color){
  var surface = cssVar('--surface') || '#111219';
  var a=hexToRgb(surface), b=hexToRgb(color||'#8b7dff');
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

/* ---------- Create / wire a new row ---------- */
function createRow(cfg){
  var dom = buildRowDom();
  var node = dom.row, chip = dom.chip, menuBtn = dom.menuBtn, pop = dom.pop, drop = dom.drop, labelArea = dom.labelWrap;

  ensureId(drop,'zone');
  chip.textContent = cfg.label;
  chip.dataset.color = cfg.color;
  chip.style.background = cfg.color;
  chip.style.color = contrastColor(cfg.color);

  // ARIA
  chip.id = chip.id || ('chip-' + uid());
  node.setAttribute('role','group');
  node.setAttribute('aria-labelledby', chip.id);
  drop.setAttribute('role','list');
  drop.setAttribute('aria-labelledby', chip.id);

  var tint = tintFrom(cfg.color);
  drop.style.background = tint; drop.dataset.manual = 'false';
  $('.rowColor', pop).value = tint; $('.labelColor', pop).value = cfg.color;

  on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });

  on(menuBtn,'click', function(e){
    e.stopPropagation();
    var opened = $('.row-popover.open'); if(opened && opened!==pop) opened.classList.remove('open');
    pop.classList.toggle('open');
    if (pop.classList.contains('open')) adjustPopover(pop, labelArea);
  });

  on($('.labelColor', pop),'input', function(e){
    chip.dataset.color = e.target.value; chip.style.background = chip.dataset.color;
    chip.style.color = contrastColor(chip.dataset.color);
    if (drop.dataset.manual!=='true'){
      var nt = tintFrom(chip.dataset.color);
      drop.style.background = nt; $('.rowColor', pop).value = nt;
    }
  });
  on($('.rowColor', pop),'input', function(e){ drop.dataset.manual='true'; drop.style.background = e.target.value; });

  on($('.removeRow', pop),'click', function(){ node.remove(); refreshRadialOptions(); });
  on($('.clearRow',  pop),'click', function(){ $$('.token', drop).forEach(function(n){ n.remove(); }); });

  enableRowReorder(labelArea, node);
  enableClickToPlace(drop);
  return node;
}

/* Ensure popover stays inside viewport */
function adjustPopover(pop, anchor){
  // Default styles (desktop)
  pop.style.left = 'calc(100% + 8px)';
  pop.style.right = 'auto';
  pop.style.top = '50%';
  pop.style.transform = 'translateY(-50%)';

  var r = pop.getBoundingClientRect();
  var vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

  // If it overflows right, flip to left
  if (r.right > vw - 8){
    pop.style.left = 'auto';
    pop.style.right = '8px';
    pop.style.transform = 'translateY(-50%)';
  }

  // On small screens, center below the chip
  if (isSmall()){
    pop.style.left = '50%';
    pop.style.right = 'auto';
    pop.style.top = 'calc(100% + 8px)';
    pop.style.transform = 'translate(-50%,0)';
  }
}

/* Close open popover when clicking elsewhere */
on(document,'click', function(e){
  var opened = $('.row-popover.open');
  if (!opened) return;
  if (e.target.closest('.row-popover') || e.target.closest('.row-menu')) return;
  opened.classList.remove('open');
});

/* ---------- Defaults ---------- */
var defaultTiers = [
  { label:'S', color:'#ff6b6b' },
  { label:'A', color:'#f59e0b' },
  { label:'B', color:'#22c55e' },
  { label:'C', color:'#3b82f6' },
  { label:'D', color:'#a78bfa' }
];

var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Jay","Jeremy","Katie","Keyon","Kiev","Kyle","Lewis","Meegan","Munch","Paper",
  "Ray","Safoof","V","Verse","Wobbles","Xavier"
];

var palette = [
  '#f97316','#ef4444','#22c55e','#3b82f6','#a78bfa','#06b6d4','#eab308','#10b981',
  '#f43f5e','#8b5cf6','#0ea5e9','#84cc16','#fb923c','#f472b6','#14b8a6','#60a5fa',
  '#f59e0b','#34d399','#7dd3fc','#c084fc','#fca5a5','#86efac','#fde047','#93c5fd'
];
var pIndex = Math.floor(Math.random()*palette.length);
function nextColor(){ var c = palette[pIndex % palette.length]; pIndex++; return c; }

/* ---------- Tokens ---------- */
function buildTokenBase(){
  var el = document.createElement('div');
  el.className='token'; el.id = uid();
  el.setAttribute('tabindex','0'); el.setAttribute('role','listitem');
  el.style.touchAction = 'none'; el.setAttribute('draggable','false');

  if (!isSmall()){
    if (window.PointerEvent) enablePointerDrag(el);
    else enableMouseTouchDragFallback(el);
  }

  on(el,'click', function(ev){
    // Prevent zone click handler from firing behind us (fixes "jump to bottom")
    ev.stopPropagation();

    var already = el.classList.contains('selected');
    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });

    if (!already){
      el.classList.add('selected');
      if (isSmall()) openRadial(el);
    } else if (isSmall()){
      closeRadial();
    }
  });

  on(el,'keydown', function(e){
    if (e.key==='Enter' || e.key===' '){ e.preventDefault(); el.click(); }
  });

  return el;
}
function buildNameToken(name, color){
  var el = buildTokenBase();
  el.style.background = color;
  var label = document.createElement('div'); label.className='label'; label.textContent=name;
  label.style.color = contrastColor(color);
  el.setAttribute('aria-label', 'Token ' + name);
  el.appendChild(label);
  return el;
}
function buildImageToken(src, alt){
  var el = buildTokenBase();
  var img = document.createElement('img'); img.src=src; img.alt=alt||''; img.draggable=false; el.appendChild(img);
  el.setAttribute('aria-label', alt ? ('Image token ' + alt) : 'Image token');
  return el;
}

/* ---------- History ---------- */
var historyStack = []; // {itemId, fromId, toId, beforeId}
function recordPlacement(itemId, fromId, toId, beforeId){
  if (!fromId || !toId || fromId===toId) return;
  historyStack.push({itemId:itemId, fromId:fromId, toId:toId, beforeId: beforeId||''});
  var u = $('#undoBtn'); if (u) u.disabled = historyStack.length===0;
}
function performMove(itemId, parentId, beforeId){
  var item = document.getElementById(itemId);
  var parent = document.getElementById(parentId);
  if (!item || !parent) return;
  if (beforeId){
    var before = document.getElementById(beforeId);
    if (before && before.parentElement === parent){ parent.insertBefore(item, before); return; }
  }
  parent.appendChild(item);
}

/* ---------- Nearest insert ---------- */
function nearestTokenInZone(zone, x, y, except){
  var toks = Array.prototype.slice.call(zone.querySelectorAll('.token'));
  var best = null, bestD = Infinity;
  for (var i=0;i<toks.length;i++){
    var t = toks[i]; if (t===except) continue;
    var r = t.getBoundingClientRect();
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    var dx = cx - x, dy = cy - y, d = dx*dx + dy*dy;
    if (d < bestD){ bestD = d; best = t; }
  }
  return best;
}

/* ---------- Click-to-place (rows & tray) ---------- */
function enableClickToPlace(zone){
  ensureId(zone,'zone');
  on(zone,'click', function(e){
    // If the radial is open, ignore placements (prevents accidental moves on phones)
    var radial = $('#radialPicker');
    if (radial && !radial.classList.contains('hidden')) return;

    // If user clicked the menu/popover, ignore
    if (e.target.closest && (e.target.closest('.row-menu') || e.target.closest('.row-popover'))) return;

    var selected = $('.token.selected'); if (!selected) return;
    var fromId = ensureId(selected.parentElement,'zone');
    // If clicking the same zone, do nothing (avoid "send to bottom")
    if (fromId === zone.id) return;

    var originNext = selected.nextElementSibling;
    var beforeId = originNext ? ensureId(originNext,'tok') : '';
    zone.appendChild(selected);
    selected.classList.remove('selected');
    recordPlacement(selected.id, fromId, zone.id, beforeId);
    var r = zone.closest ? zone.closest('.tier-row') : null;
    live('Moved "'+(selected.innerText||'item')+'" to '+ (r?rowLabel(r):'Image Storage') );
    vib(6);
  });
}

/* ---------- Get dropzone ---------- */
function getDropZoneFromElement(el){
  if (!el) return null;
  var dz=el.closest('.dropzone, #tray'); if(dz) return dz;
  var chip=el.closest('.label-chip'); if(chip){ var row=chip.closest('.tier-row'); return row?row.querySelector('.tier-drop'):null; }
  return null;
}

/* ---------- Desktop drag (Pointer Events) ---------- */
function enablePointerDrag(node){
  var ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  on(node,'pointerdown', function(e){
    if (isSmall()) return;
    if (e.button!==0) return;
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-item');

    originParent = node.parentElement; originNext = node.nextElementSibling;
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
        var fromId = ensureId(originParent,'zone');
        var toId   = ensureId(zone,'zone');
        var beforeTok = nearestTokenInZone(zone, x, y, node);
        var beforeId = beforeTok ? ensureId(beforeTok,'tok') : '';
        if (beforeTok) zone.insertBefore(node, beforeTok); else zone.appendChild(node);
        recordPlacement(node.id, fromId, toId, beforeId);
        node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
        var rr = zone.closest ? zone.closest('.tier-row') : null;
        live('Moved "'+(node.innerText||'item')+'" to '+ (rr?rowLabel(rr):'Image Storage') );
        vib(6);
      } else {
        if (originNext && originNext.parentElement===originParent) originParent.insertBefore(node, originNext);
        else originParent.appendChild(node);
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

/* ---------- Fallback drag (legacy) ---------- */
function enableMouseTouchDragFallback(node){
  var dragging=false, ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  function start(e, clientX, clientY){
    if (isSmall()) return;
    dragging=true; document.body.classList.add('dragging-item');
    if (e && e.preventDefault) e.preventDefault();

    originParent=node.parentElement; originNext=node.nextElementSibling;
    var r=node.getBoundingClientRect(); offsetX=clientX-r.left; offsetY=clientY-r.top; x=clientX; y=clientY;

    ghost = node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden');
    loop();
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
      var beforeTok = nearestTokenInZone(zone, x, y, node);
      var beforeId = beforeTok ? ensureId(beforeTok,'tok') : '';
      if (beforeTok) zone.insertBefore(node, beforeTok); else zone.appendChild(node);
      recordPlacement(node.id, fromId, toId, beforeId);
      node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
      var rr = zone.closest ? zone.closest('.tier-row') : null;
      live('Moved "'+(node.innerText||'item')+'" to '+ (rr?rowLabel(rr):'Image Storage') );
      vib(6);
    } else {
      if (originNext && originNext.parentElement===originParent) originParent.insertBefore(node, originNext);
      else originParent.appendChild(node);
    }
    if (currentZone) currentZone.classList.remove('drag-over');
    currentZone=null;
  }

  on(node,'mousedown', function(e){ if(e.button!==0) return; start(e,e.clientX,e.clientY);
    on(document,'mousemove', onMouseMove); on(document,'mouseup', onMouseUp); });
  function onMouseMove(e){ move(e.clientX,e.clientY); }
  function onMouseUp(){ document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); end(); }

  on(node,'touchstart', function(e){ var t=e.touches[0]; start(e,t.clientX,t.clientY);
    on(document,'touchmove', onTouchMove, _supportsPassive?{passive:true}:false);
    on(document,'touchend', onTouchEnd, false); }, _supportsPassive?{passive:true}:false);
  function onTouchMove(e){ var t=e.touches[0]; if(t) move(t.clientX,t.clientY); }
  function onTouchEnd(){ document.removeEventListener('touchmove', onTouchMove, false); document.removeEventListener('touchend', onTouchEnd, false); end(); }

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

/* ---------- Row reorder ---------- */
function enableRowReorder(labelArea, row){
  var placeholder=null;
  function arm(e){
    if (e.target.closest && (e.target.closest('.row-menu') || e.target.closest('.row-popover'))) return;
    var chip = $('.label-chip', row); if (document.activeElement===chip) return;
    if (isSmall() && (('ontouchstart' in window) || navigator.maxTouchPoints>0)) return;
    row.setAttribute('draggable','true');
  }
  on(labelArea,'mousedown', arm);
  on(labelArea,'touchstart', arm, _supportsPassive?{passive:true}:false);

  on(row,'dragstart', function(){
    document.body.classList.add('dragging-item');
    var ph = document.createElement('div');
    ph.className='tier-row';
    ph.style.height = row.getBoundingClientRect().height+'px';
    ph.style.borderRadius='12px';
    ph.style.border='2px dashed rgba(139,125,255,.25)';
    board.insertBefore(ph, row.nextSibling);
    setTimeout(function(){ row.style.display='none'; },0);
    placeholder = ph;
  });
  on(row,'dragend', function(){
    row.style.display='';
    if (placeholder && placeholder.parentNode){ board.insertBefore(row, placeholder); placeholder.parentNode.removeChild(placeholder); }
    row.removeAttribute('draggable'); placeholder=null;
    document.body.classList.remove('dragging-item');
  });
  on(board,'dragover', function(e){
    if(!placeholder) return; e.preventDefault();
    var after = rowAfterY(board, e.clientY);
    if (after) board.insertBefore(placeholder, after); else board.appendChild(placeholder);
  });
  function rowAfterY(container, y){
    var rows = Array.prototype.filter.call(container.querySelectorAll('.tier-row'), function(r){ return r!==placeholder && r.style.display!=='none'; });
    for (var i=0;i<rows.length;i++){ var r=rows[i], rect=r.getBoundingClientRect(); if (y < rect.top + rect.height/2) return r; }
    return null;
  }
}

/* ---------- Radial (mobile) ---------- */
var radial = $('#radialPicker');
var radialBackdrop = radial ? $('.radial-backdrop', radial) : null;
var radialOpts = radial ? $('.radial-options', radial) : null;
var radialHighlight = radial ? $('.radial-highlight', radial) : null;
var radialCloseBtn = radial ? $('.radial-close', radial) : null;
var radialForToken = null;
var _radialGeo = []; // [{x,y,row,btn}]
var radialCancelRequested = false;

function rowCount(){ return $$('.tier-row').length; }

/* Keep uniform look but nudge away from edges without changing radius */
function uniformCenter(cx, cy, R){
  var M = 14;
  var nx = Math.max(M + R, Math.min(window.innerWidth - M - R, cx));
  var ny = Math.max(M + R, cy);
  return {x:nx, y:ny};
}

function refreshRadialOptions(){
  if (!isSmall() || !radial || !radialForToken) return;
  openRadial(radialForToken);
}

function openRadial(token){
  if (!radial || !isSmall()) return;
  radialCancelRequested = false;
  radialForToken = token;

  var rect = token.getBoundingClientRect();
  var cx = rect.left + rect.width/2;
  var cy = rect.top + rect.height/2;

  var rows = $$('.tier-row');
  var labels = rows.map(function(r){ return rowLabel(r); });
  var N = labels.length; if (!N) return;

  var BASE_R = 78;
  var center = uniformCenter(cx, cy, BASE_R);
  var R = BASE_R;

  var degStart = 205, degEnd = 315;               // uniform compressed arc above
  var step = (degEnd - degStart) / Math.max(1,(N-1));

  var positions = [];
  for (var i=0;i<N;i++){
    var ang = (degStart + step*i) * Math.PI/180;
    positions.push({ i:i, ang:ang, x: center.x + R*Math.cos(ang), y: center.y + R*Math.sin(ang) });
  }
  positions.sort(function(a,b){ return a.x - b.x; });
  _radialGeo = [];

  radialCloseBtn.style.left = cx+'px';
  radialCloseBtn.style.top  = cy+'px';

  radialOpts.innerHTML = '';
  for (var j=0;j<N;j++){
    (function(j){
      var row = rows[j];
      var pos = positions[j];
      var btn = document.createElement('button');
      btn.type='button'; btn.className='radial-option';
      btn.textContent = labels[j];
      btn.style.left = pos.x+'px';
      btn.style.top  = pos.y+'px';
      btn.style.transitionDelay = (j*18)+'ms';

      function focusHL(){ updateHighlight(j); }
      on(btn,'pointerenter', focusHL);
      on(btn,'focus', focusHL);
      on(btn,'click', function(){ selectRadialTarget(row); });

      radialOpts.appendChild(btn);
      _radialGeo.push({x:pos.x, y:pos.y, row:row, btn:btn});
    })(j);
  }

  radial.setAttribute('aria-hidden','false');
  radial.classList.remove('hidden');
  radial.classList.add('visible','show');
  setTimeout(function(){ radial.classList.remove('show'); }, 200 + N*18);

  if (_radialGeo.length){ updateHighlight(0); }
}

function updateHighlight(index){
  if (!_radialGeo.length) return;
  for (var i=0;i<_radialGeo.length;i++){
    var b = _radialGeo[i].btn;
    if (b) b.classList.toggle('is-highlighted', i===index);
  }
  if (radialHighlight) {
    radialHighlight.hidden = true; // chip itself is neon
    radialHighlight.dataset.index = String(index);
  }
}

/* Drag finger anywhere to choose; X cancels cleanly */
function _radialTrackStart(e){
  if (!radial || radial.classList.contains('hidden')) return;
  var tracking = true;

  function update(ev){
    if (!tracking || radialCancelRequested) return;
    var x = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    var y = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY);
    var bestIndex = 0, bestD = Infinity;
    for (var k=0;k<_radialGeo.length;k++){
      var g=_radialGeo[k]; var dx=g.x-x, dy=g.y-y; var d=dx*dx+dy*dy;
      if (d < bestD){ bestD=d; bestIndex=k; }
    }
    updateHighlight(bestIndex);
  }
  function end(){
    if (radialCancelRequested) { cleanup(); return; }
    var idx = parseInt(radialHighlight && radialHighlight.dataset.index || '0',10);
    var target = _radialGeo[idx];
    if (target){ selectRadialTarget(target.row); }
    cleanup();
  }
  function cancel(){ cleanup(); }
  function cleanup(){
    tracking = false;
    document.removeEventListener('pointermove', update);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('touchmove', update);
    document.removeEventListener('touchend', end);
    document.removeEventListener('pointercancel', cancel);
    document.removeEventListener('touchcancel', cancel);
  }

  document.addEventListener('pointermove', update, _supportsPassive?{passive:true}:false);
  document.addEventListener('pointerup', end, false);
  document.addEventListener('touchmove', update, _supportsPassive?{passive:true}:false);
  document.addEventListener('touchend', end, false);
  document.addEventListener('pointercancel', cancel, false);
  document.addEventListener('touchcancel', cancel, false);
}
var rb = radialBackdrop;
if (rb){
  on(rb,'pointerdown', _radialTrackStart, _supportsPassive?{passive:true}:false);
  on(rb,'touchstart', _radialTrackStart, _supportsPassive?{passive:true}:false);
}
if (radialCloseBtn){
  on(radialCloseBtn,'pointerdown', function(e){ radialCancelRequested = true; e.stopPropagation(); }, false);
  on(radialCloseBtn,'click', function(e){ e.stopPropagation(); closeRadial(); }, false);
}

function selectRadialTarget(row){
  if (!radialForToken || !row) return;
  var zone = row.querySelector('.tier-drop');
  var fromId = ensureId(radialForToken.parentElement,'zone');
  var originNext = radialForToken.nextElementSibling;
  var beforeId = originNext ? ensureId(originNext,'tok') : '';
  ensureId(zone,'zone');
  zone.appendChild(radialForToken);
  radialForToken.classList.remove('selected');
  recordPlacement(radialForToken.id, fromId, zone.id, beforeId);
  vib(7);
  closeRadial();
}

function closeRadial(){
  if (!radial) return;
  radial.classList.add('hidden');
  radial.classList.remove('visible','show');
  radial.setAttribute('aria-hidden','true');
  radialForToken = null;
  radialCancelRequested = false;
  _radialGeo = [];
}
on(window,'resize', refreshRadialOptions);

/* ---------- Clear / Undo / Save ---------- */
on($('#trashClear'),'click', function(){
  if (!confirm('Clear the entire tier board? This moves all placed items back to Image Storage.')) return;
  $$('.tier-drop .token').forEach(function(tok){ tray.appendChild(tok); });
});

on($('#undoBtn'),'click', function(){
  var last = historyStack.pop(); if (!last) return;
  performMove(last.itemId, last.fromId, last.beforeId);
  $('#undoBtn').disabled = historyStack.length===0;
});

on($('#saveBtn'),'click', function(){
  closeRadial();
  $$('.row-popover.open').forEach(function(p){ p.classList.remove('open'); });
  $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
  $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });

  var panel = $('#boardPanel');
  var cloneWrap = document.createElement('div');
  cloneWrap.style.position='fixed'; cloneWrap.style.left='-99999px'; cloneWrap.style.top='0';

  var clone = panel.cloneNode(true);
  var title = clone.querySelector('.board-title');
  if (title && title.textContent.replace(/\s+/g,'').length===0){
    title.parentNode.removeChild(title);
  }

  clone.style.width = '1200px';
  clone.style.maxWidth = '1200px';
  cloneWrap.appendChild(clone);
  document.body.appendChild(cloneWrap);

  html2canvas(clone, {
    backgroundColor: cssVar('--surface') || null,
    useCORS: true,
    scale: 2,
    width: 1200,
    windowWidth: 1200
  }).then(function(canvas){
    var a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tier-list.png';
    document.body.appendChild(a); a.click(); a.remove();
    cloneWrap.remove();
  }).catch(function(){ cloneWrap.remove(); });
});

/* ---------- Keyboard quick-jump ---------- */
on(document,'keydown', function(e){
  var selected = $('.token.selected'); if(!selected) return;
  var n = parseInt(e.key,10);
  if (!isNaN(n) && n>=1 && n<=rowCount()){
    e.preventDefault();
    var rows = $$('.tier-row'); var row = rows[n-1];
    if (row){
      var zone = row.querySelector('.tier-drop');
      var fromId = ensureId(selected.parentElement,'zone');
      if (fromId === ensureId(zone,'zone')) return;
      var originNext = selected.nextElementSibling;
      var beforeId = originNext ? ensureId(originNext,'tok') : '';
      zone.appendChild(selected);
      selected.classList.remove('selected');
      recordPlacement(selected.id, fromId, zone.id, beforeId);
      vib(4);
      live('Moved "'+(selected.innerText||'item')+'" to '+ rowLabel(row));
    }
  }
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function start(){
  board = $('#tierBoard'); tray = $('#tray');

  // rows
  var initTiers = (window.defaultTiers && Array.isArray(window.defaultTiers)) ? window.defaultTiers : defaultTiers;
  initTiers.forEach(function(t){ board.appendChild(createRow(t)); });

  // tray defaults
  var nameColor = $('#nameColor'); var nameInput = $('#nameInput');
  if (nameColor) nameColor.value = nextColor();
  communityCast.forEach(function(n,i){ tray.appendChild(buildNameToken(n, palette[i % palette.length])); });

  // add tier
  on($('#addTierBtn'),'click', function(){
    board.appendChild(createRow({label:'NEW', color: nextColor()}));
    refreshRadialOptions();
  });

  // creators
  on($('#addNameBtn'),'click', function(){
    if (!nameInput || !nameColor) return;
    var name = nameInput.value.trim();
    if (!name) return;
    tray.appendChild(buildNameToken(name, nameColor.value));
    nameInput.value=''; nameColor.value = nextColor();
  });

  on($('#imageInput'),'change', function(e){
    Array.prototype.forEach.call(e.target.files, function(file){
      if(!file.type || file.type.indexOf('image/')!==0) return;
      var reader = new FileReader();
      reader.onload = function(ev){ tray.appendChild(buildImageToken(ev.target.result, file.name)); };
      reader.readAsDataURL(file);
    });
  });

  // click-to-place allowed on the tray too
  enableClickToPlace(tray);

  live('Ready. Desktop/iPad: drag items. Phone: tap a circle to place with the curved picker.');
});
