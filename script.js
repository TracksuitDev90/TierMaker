/* ===== Polyfills (for older iOS Safari) ===== */
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

/* ===== Safe addEventListener options ===== */
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

/* ===== Utilities ===== */
var $  = function (s, ctx){ return (ctx||document).querySelector(s); };
var $$ = function (s, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); };
function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
function live(msg){ var n=$('#live'); if(!n) return; n.textContent=''; setTimeout(function(){ n.textContent=msg; },0); }
function vib(ms){ if('vibrate' in navigator) navigator.vibrate(ms||8); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
function isSmall(){ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }

/* ===== Color helpers ===== */
function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3){ h=h.split('').map(function(x){return x+x;}).join(''); } var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''); }
function relativeLuminance(rgb){ function srgb(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); } return 0.2126*srgb(rgb.r)+0.7152*srgb(rgb.g)+0.0722*srgb(rgb.b); }
function contrastColor(bgHex){ var L=relativeLuminance(hexToRgb(bgHex)); return L>0.58 ? '#000000' : '#ffffff'; }

/* ===== Theme (button shows TARGET mode) ===== */
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
    // If rows exist, retint them; otherwise this is a no-op.
    $$('.tier-row').forEach(function(row){
      var chip=$('.label-chip',row), drop=$('.tier-drop',row);
      if (drop && drop.dataset.manual!=='true'){
        var nt = tintFrom(chip && chip.dataset.color ? chip.dataset.color : '#8b7dff');
        drop.style.background = nt;
      }
    });
  }
})();

/* ===== Board state (assigned at start) ===== */
var board, tray;

/* ===== Row DOM builder (no <template> needed) ===== */
function buildRowDom(){
  var row = document.createElement('div');
  row.className='tier-row';

  var labelWrap = document.createElement('div');
  labelWrap.className='tier-label';

  var chip = document.createElement('div');
  chip.className='label-chip';
  chip.setAttribute('contenteditable','true');
  chip.setAttribute('spellcheck','false');

  var menuBtn = document.createElement('button');
  menuBtn.className='row-menu';
  menuBtn.setAttribute('type','button');
  menuBtn.textContent='⋯';

  var pop = document.createElement('div');
  pop.className='row-popover';
  pop.innerHTML =
    '<div class="row-option"><span>Label color</span><input class="labelColor" type="color" value="#ff6b6b" /></div>' +
    '<div class="row-option"><span>Row color</span><input class="rowColor" type="color" /></div>' +
    '<div class="row-buttons">' +
      '<button class="btn small clearRow" type="button">Clear row</button>' +
      '<button class="btn btn-danger small removeRow" type="button">Delete row</button>' +
    '</div>';

  labelWrap.appendChild(chip); labelWrap.appendChild(menuBtn); labelWrap.appendChild(pop);

  var drop = document.createElement('div');
  drop.className='tier-drop dropzone';
  drop.setAttribute('tabindex','0');

  row.appendChild(labelWrap); row.appendChild(drop);

  return { row: row, chip: chip, menuBtn: menuBtn, pop: pop, drop: drop, labelWrap: labelWrap };
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
function ensureId(el, prefix){ if(!el.id){ el.id=(prefix||'id')+'-'+uid(); } return el.id; }
function rowLabel(row){ var chip=row?row.querySelector('.label-chip'):null; return chip?chip.textContent.replace(/\s+/g,' ').trim():'row'; }

/* ===== Create / wire a new row ===== */
function createRow(cfg){
  var dom = buildRowDom();
  var node = dom.row, chip = dom.chip, menuBtn = dom.menuBtn, pop = dom.pop, drop = dom.drop, labelArea = dom.labelWrap;

  ensureId(drop,'zone');
  chip.textContent = cfg.label;
  chip.dataset.color = cfg.color;
  chip.style.background = cfg.color;

  var tint = tintFrom(cfg.color);
  drop.style.background = tint; drop.dataset.manual = 'false';
  $('.rowColor', pop).value = tint; $('.labelColor', pop).value = cfg.color;

  on(chip,'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });

  on(menuBtn,'click', function(e){
    e.stopPropagation();
    var opened = $('.row-popover.open'); if(opened && opened!==pop) opened.classList.remove('open');
    pop.classList.toggle('open');
  });
  on(document,'click', function(){ pop.classList.remove('open'); });

  on($('.labelColor', pop),'input', function(e){
    chip.dataset.color = e.target.value; chip.style.background = chip.dataset.color;
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

/* ===== Defaults ===== */
var defaultTiers = [
  { label:'S', color:'#ff6b6b' },
  { label:'A', color:'#f4a261' },
  { label:'B', color:'#ffe66d' },
  { label:'C', color:'#5ee27a' },
  { label:'D', color:'#6cb3ff' }
];
var communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Jay","Jeremy","Katie","Keyon","Kiev","Kyle","Lewis","Meegan","Munch","Paper",
  "Ray","Safoof","V","Verse","Wobbles","Xavier"
];
var palette = [
  '#8b7dff','#68ddff','#ff9f4d','#ff6b9c','#5ee27a','#ffd166','#6cb3ff','#e86fff','#00d3a7','#ffa24c',
  '#7af0b8','#ff6b6b','#c4f75b','#58e1ff','#ffb86c','#ff7eb6','#9aff5b','#7da7ff','#ffc542','#f582ae',
  '#3ddc97','#facc15','#a78bfa','#22d3ee','#fb7185','#84cc16','#ed64a6','#f472b6','#22c55e','#06b6d4',
  '#f59e0b','#34d399','#60a5fa','#f43f5e','#10b981','#a3e635','#eab308','#14b8a6'
];
var pIndex = Math.floor(Math.random()*palette.length);
function nextColor(){ var c = palette[pIndex % palette.length]; pIndex++; return c; }

/* ===== Tokens ===== */
function buildTokenBase(){
  var el = document.createElement('div');
  el.className='token'; el.id = uid();

  if (!isSmall()){ enablePointerDrag(el); } // desktop drag only

  on(el,'click', function(){
    var already = el.classList.contains('selected');
    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    if (!already){
      el.classList.add('selected');
      if (isSmall()) openRadial(el);
    } else if (isSmall()){
      closeRadial();
    }
  });

  return el;
}
function buildNameToken(name, color){
  var el = buildTokenBase();
  el.style.background = color;
  var label = document.createElement('div'); label.className='label'; label.textContent=name;
  label.style.color = contrastColor(color);
  if (label.style.color === '#000000') label.style.textShadow = '0 1px 1px rgba(255,255,255,.15)';
  el.appendChild(label);
  return el;
}
function buildImageToken(src, alt){
  var el = buildTokenBase();
  var img = document.createElement('img'); img.src=src; img.alt=alt||''; el.appendChild(img);
  return el;
}

/* ===== History (Undo) ===== */
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

/* ===== Click-to-place (tray & rows) ===== */
function enableClickToPlace(zone){
  ensureId(zone,'zone');
  on(zone,'click', function(e){
    if (e.target.closest && (e.target.closest('.row-menu') || e.target.closest('.row-popover'))) return;
    var selected = $('.token.selected'); if (!selected) return;
    var fromId = ensureId(selected.parentElement,'zone');
    zone.appendChild(selected);
    selected.classList.remove('selected');
    recordPlacement(selected.id, fromId, zone.id);
    var r = zone.closest ? zone.closest('.tier-row') : null;
    live('Moved "'+(selected.innerText||'item')+'" to '+ (r?rowLabel(r):'tray') );
    vib(6);
    closeRadial();
  });
}

/* ===== Pointer-drag (desktop) ===== */
function enablePointerDrag(node){
  var ghost=null, originParent=null, originNext=null, currentZone=null;
  var offsetX=0, offsetY=0, x=0, y=0, raf=null;

  on(node,'pointerdown', function(e){
    if (isSmall()) return; if (e.button!==0) return;
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
        var beforeId = originNext ? ensureId(originNext,'tok') : '';
        zone.appendChild(node);
        recordPlacement(node.id, fromId, toId, beforeId);
        node.classList.add('animate-drop'); setTimeout(function(){ node.classList.remove('animate-drop'); },180);
        var r = zone.closest ? zone.closest('.tier-row') : null;
        live('Moved "'+(node.innerText||'item')+'" to '+ (r?rowLabel(r):'tray') );
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

      var topZone = innerHeight*0.2, bottomZone=innerHeight*0.25, speed=18;
      if (y < topZone) window.scrollBy(0,-speed);
      else if (y > innerHeight-bottomZone) window.scrollBy(0,speed);
    }
  });
}
function getDropZoneFromElement(el){
  if (!el) return null;
  var dz=el.closest('.dropzone'); if(dz) return dz;
  var chip=el.closest('.label-chip'); if(chip){ var row=chip.closest('.tier-row'); return row?row.querySelector('.tier-drop'):null; }
  return null;
}

/* ===== Row reorder (disable on small touch) ===== */
function enableRowReorder(labelArea, row){
  var placeholder=null;
  function arm(e){
    if (e.target.closest && (e.target.closest('.row-menu') || e.target.closest('.row-popover'))) return;
    var chip = $('.label-chip', row); if (document.activeElement===chip) return;
    if (isSmall() && isTouch) return;
    row.setAttribute('draggable','true');
  }
  on(labelArea,'mousedown', arm);
  on(labelArea,'touchstart', arm, _supportsPassive?{passive:true}:false);

  on(row,'dragstart', function(){
    document.body.classList.add('dragging-item');
    placeholder = document.createElement('div');
    placeholder.className='tier-row';
    placeholder.style.height = row.getBoundingClientRect().height+'px';
    placeholder.style.borderRadius='12px';
    placeholder.style.border='2px dashed rgba(139,125,255,.25)';
    board.insertBefore(placeholder, row.nextSibling);
    setTimeout(function(){ row.style.display='none'; },0);
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

/* ===== Radial picker (mobile) ===== */
var radial, radialOpts, radialHighlight, radialCloseBtn, radialForToken=null;
function refreshRadialOptions(){ if (!isSmall()) return; if (!radial.classList.contains('hidden') && radialForToken){ openRadial(radialForToken); } }
function openRadial(token){
  radialForToken = token;
  var rect = token.getBoundingClientRect();
  var cx = rect.left + rect.width/2;
  var cy = rect.top + rect.height/2;

  radialOpts.innerHTML='';
  var rows = $$('.tier-row'); var N = rows.length; if (!N) return;

  var R = 120 + Math.max(0, N-5)*10;
  var margin=16;
  var degStart=200, degEnd=340; if (cy - R - margin < 0){ degStart=20; degEnd=160; }
  var step = (degEnd - degStart) / Math.max(1,(N-1));
  radialHighlight.hidden = true;

  radialCloseBtn.style.left = cx+'px';
  radialCloseBtn.style.top  = cy+'px';

  for (var i=0;i<N;i++){
    (function(i){
      var row = rows[i];
      var btn = document.createElement('button');
      btn.type='button'; btn.className='radial-option';
      btn.textContent = rowLabel(row);

      var ang = (degStart + step*i) * Math.PI/180;
      var ox = cx + R*Math.cos(ang);
      var oy = cy + R*Math.sin(ang);

      btn.style.left = ox+'px'; btn.style.top  = oy+'px';

      function moveHL(){ radialHighlight.hidden=false; radialHighlight.style.left=ox+'px'; radialHighlight.style.top=oy+'px'; }
      on(btn,'pointerenter', moveHL); on(btn,'focus', moveHL);

      on(btn,'click', function(){
        if (!radialForToken) return;
        var zone = row.querySelector('.tier-drop');
        var fromId = ensureId(radialForToken.parentElement,'zone');
        ensureId(zone,'zone');
        zone.appendChild(radialForToken);
        radialForToken.classList.remove('selected');
        recordPlacement(radialForToken.id, fromId, zone.id);
        vib(6);
        closeRadial();
      });

      radialOpts.appendChild(btn);
    })(i);
  }

  radial.classList.remove('hidden');
  radial.setAttribute('aria-hidden','false');
}
function closeRadial(){ radial.classList.add('hidden'); radial.setAttribute('aria-hidden','true'); radialForToken=null; }

/* ===== Start after DOM is ready ===== */
document.addEventListener('DOMContentLoaded', function start(){
  board = $('#tierBoard'); tray = $('#tray');

  // Build default rows
  defaultTiers.forEach(function(t){ board.appendChild(createRow(t)); });

  // Build default community tokens
  $('#nameColor').value = nextColor();
  communityCast.forEach(function(n,i){ tray.appendChild(buildNameToken(n, palette[i % palette.length])); });

  // Wire controls
  on($('#addTierBtn'),'click', function(){ board.appendChild(createRow({label:'NEW', color:'#8b7dff'})); refreshRadialOptions(); });
  on($('#undoBtn'),'click', function(){
    var last = historyStack.pop(); if (!last) return;
    performMove(last.itemId, last.fromId, last.beforeId);
    $('#undoBtn').disabled = historyStack.length===0;
  });
  on($('#trashClear'),'click', function(){
    if (!confirm('Clear the entire tier board? This moves all placed items back to the tray.')) return;
    $$('.tier-drop .token').forEach(function(tok){ tray.appendChild(tok); });
  });
  on($('#saveBtn'),'click', function(){
    closeRadial();
    $$('.row-popover.open').forEach(function(p){ p.classList.remove('open'); });
    $$('.token.selected').forEach(function(t){ t.classList.remove('selected'); });
    $$('.dropzone.drag-over').forEach(function(z){ z.classList.remove('drag-over'); });
    $$('.label-chip.dragOver').forEach(function(z){ z.classList.remove('dragOver'); });

    html2canvas($('#tierBoard'), {
      backgroundColor: cssVar('--surface') || null,
      useCORS: true,
      scale: Math.min(3, window.devicePixelRatio || 2)
    }).then(function(canvas){
      var a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tier-list.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
  });

  // Name/image creators
  on($('#addNameBtn'),'click', function(){
    var name = $('#nameInput').value.trim();
    if (!name) return;
    tray.appendChild(buildNameToken(name, $('#nameColor').value));
    $('#nameInput').value=''; $('#nameColor').value = nextColor();
  });
  on($('#imageInput'),'change', function(e){
    Array.prototype.forEach.call(e.target.files, function(file){
      if(!file.type || file.type.indexOf('image/')!==0) return;
      var reader = new FileReader();
      reader.onload = function(ev){ tray.appendChild(buildImageToken(ev.target.result, file.name)); };
      reader.readAsDataURL(file);
    });
  });

  // Radial picker DOM refs + listeners (mobile)
  radial = $('#radialPicker'); radialOpts = $('.radial-options', radial);
  radialHighlight = $('.radial-highlight', radial); radialCloseBtn = $('.radial-close', radial);
  on(document,'click', function(e){
    if (radial.classList.contains('hidden')) return;
    if (radial.contains(e.target)) return;
    var sel = $('.token.selected'); if (sel && sel.contains(e.target)) return;
    closeRadial();
  });
  on(radialCloseBtn,'click', closeRadial);
  on(window,'scroll', closeRadial, _supportsPassive?{passive:true}:false);
  on(window,'resize', closeRadial, _supportsPassive?{passive:true}:false);

  live('Ready. Drag on desktop; tap a circle for the curved picker on mobile.');
});

/* ===== Helpers used above ===== */
function refreshRadialOptions(){ if (!isSmall()) return; if (!radial || radial.classList.contains('hidden') || !radialForToken) return; openRadial(radialForToken); }
