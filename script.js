/* ---------- Helpers ---------- */
const $  = (s, ctx=document) => ctx.querySelector(s);
const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
const uid = () => 'id-' + Math.random().toString(36).slice(2,10);
const live = (msg) => { const n = $('#live'); if (n){ n.textContent=''; setTimeout(()=> n.textContent = msg, 0); } };
const vib = (ms=8) => 'vibrate' in navigator && navigator.vibrate(ms);
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isSmall = () => matchMedia('(max-width: 768px)').matches;

/* ---------- Colors ---------- */
function hexToRgb(hex){ const h=hex.replace('#',''); const v=h.length===3?h.split('').map(x=>x+x).join(''):h; const n=parseInt(v,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function relativeLuminance({r,g,b}){ const sr=[r,g,b].map(v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*sr[0]+0.7152*sr[1]+0.0722*sr[2]; }
function contrastColor(bgHex){ const L=relativeLuminance(hexToRgb(bgHex)); return L > 0.58 ? '#000000' : '#ffffff'; }

/* ---------- Theme (button shows TARGET mode) ---------- */
(function initTheme(){
  const root = document.documentElement;
  const toggle = $('#themeToggle');
  const icon = $('.theme-icon', toggle);
  const text = $('.theme-text', toggle);

  const preferred = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(localStorage.getItem('tm_theme') || preferred);

  toggle.addEventListener('click', ()=> setTheme(root.getAttribute('data-theme')==='dark' ? 'light' : 'dark'));

  function setTheme(mode){
    root.setAttribute('data-theme', mode); localStorage.setItem('tm_theme', mode);
    const target = mode === 'dark' ? 'Light' : 'Dark';
    text.textContent = target;
    icon.innerHTML = target === 'Light'
      ? `<svg viewBox="0 0 24 24"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.22 19.78l1.79-1.79 1.8 1.79-1.8 1.8-1.79-1.8zM20 13h3v-2h-3v2zM12 1h2v3h-2V1zm6.01 3.05l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>`;
    retintAllRows();
  }
})();

/* ---------- Board / Rows ---------- */
const defaultTiers = [
  { label:'S', color:'#ff6b6b' },
  { label:'A', color:'#f4a261' },
  { label:'B', color:'#ffe66d' },
  { label:'C', color:'#5ee27a' },
  { label:'D', color:'#6cb3ff' }
];

const board = $('#tierBoard');
const rowTpl = $('#tierRowTemplate');

function tintFrom(color){
  // Blend row background toward label color (theme-safe)
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#111219';
  const a = hexToRgb(surface), b = hexToRgb(color);
  const amt = (document.documentElement.getAttribute('data-theme') !== 'light') ? 0.14 : 0.09;
  const r = Math.round(a.r + (b.r - a.r) * amt);
  const g = Math.round(a.g + (b.g - a.g) * amt);
  const b2= Math.round(a.b + (b.b - a.b) * amt);
  return rgbToHex(r,g,b2);
}
function ensureId(el, prefix='id'){ if (!el.id) el.id = `${prefix}-${uid()}`; return el.id; }

function createRow({label, color}){
  const node = rowTpl.content.firstElementChild.cloneNode(true);
  const labelArea = $('.tier-label', node);
  const chip = $('.label-chip', node);
  const menuBtn = $('.row-menu', node);
  const pop = $('.row-popover', node);
  const drop = $('.tier-drop', node);

  ensureId(drop,'zone');

  chip.textContent = label;
  chip.dataset.color = color;
  chip.style.background = color;

  const tint = tintFrom(color);
  drop.style.background = tint;
  drop.dataset.manual = 'false';
  $('.rowColor', pop).value = tint;
  $('.labelColor', pop).value = color;

  chip.addEventListener('keydown', e=> { if(e.key==='Enter'){ e.preventDefault(); chip.blur(); } });

  // Popover + color controls
  menuBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const opened = $('.row-popover.open'); if(opened && opened!==pop) opened.classList.remove('open');
    pop.classList.toggle('open');
  });
  document.addEventListener('click', ()=> pop.classList.remove('open'));
  $('.labelColor', pop).addEventListener('input', (e)=>{
    chip.dataset.color = e.target.value; chip.style.background = chip.dataset.color;
    if (drop.dataset.manual !== 'true'){
      const nt = tintFrom(chip.dataset.color);
      drop.style.background = nt; $('.rowColor', pop).value = nt;
    }
  });
  $('.rowColor', pop).addEventListener('input', (e)=>{ drop.dataset.manual='true'; drop.style.background = e.target.value; });
  $('.removeRow', pop).addEventListener('click', ()=> node.remove());
  $('.clearRow',  pop).addEventListener('click', ()=> $$('.token', drop).forEach(n => n.remove()));

  enableRowReorder(labelArea, node);
  enableClickToPlace(drop);
  return node;
}

function initBoard(){ defaultTiers.forEach(t => board.appendChild(createRow(t))); }
initBoard();

$('#addTierBtn').addEventListener('click', ()=>{
  board.appendChild(createRow({label:'NEW', color:'#8b7dff'}));
  refreshRadialOptions(); // mobile picker reflects new tiers
});

function retintAllRows(){
  $$('.tier-row').forEach(row=>{
    const chip = $('.label-chip', row);
    const drop = $('.tier-drop', row);
    const pop = $('.row-popover', row);
    if (drop.dataset.manual !== 'true'){
      const nt = tintFrom(chip.dataset.color || '#8b7dff');
      drop.style.background = nt;
      $('.rowColor', pop).value = nt;
    }
  });
  refreshRadialOptions();
}

/* ---------- Tray & Tokens ---------- */
const tray = $('#tray'); ensureId(tray,'zone'); enableClickToPlace(tray);

const communityCast = [
  "Anette","Authority","B7","Cindy","Clamy","Clay","Cody","Denver","Devon","Dexy","Domo",
  "Gavin","Jay","Jeremy","Katie","Keyon","Kiev","Kyle","Lewis","Meegan","Munch","Paper",
  "Ray","Safoof","V","Verse","Wobbles","Xavier"
];

const palette = [
  '#8b7dff','#68ddff','#ff9f4d','#ff6b9c','#5ee27a','#ffd166','#6cb3ff','#e86fff','#00d3a7','#ffa24c',
  '#7af0b8','#ff6b6b','#c4f75b','#58e1ff','#ffb86c','#ff7eb6','#9aff5b','#7da7ff','#ffc542','#f582ae',
  '#3ddc97','#facc15','#a78bfa','#22d3ee','#fb7185','#84cc16','#ed64a6','#f472b6','#22c55e','#06b6d4',
  '#f59e0b','#34d399','#60a5fa','#f43f5e','#10b981','#a3e635','#eab308','#14b8a6'
];
let pIndex = Math.floor(Math.random()*palette.length);
const nextColor = () => palette[(pIndex++) % palette.length];

$('#nameColor').value = nextColor();
communityCast.forEach((n,i)=> tray.appendChild(buildNameToken(n, palette[i % palette.length])));

$('#addNameBtn').addEventListener('click', ()=>{
  const name = $('#nameInput').value.trim();
  if (!name) return;
  tray.appendChild(buildNameToken(name, $('#nameColor').value));
  $('#nameInput').value=''; $('#nameColor').value = nextColor();
});
$('#imageInput').addEventListener('change', (e)=> handleFiles(e.target.files));
function handleFiles(files){
  [...files].forEach(file=>{
    if(!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => tray.appendChild(buildImageToken(ev.target.result, file.name));
    reader.readAsDataURL(file);
  });
}

function buildTokenBase(){
  const el = document.createElement('div');
  el.className='token';
  el.id = uid();

  // Desktop / large screens: custom pointer-drag
  if (!isSmall()){
    enablePointerDrag(el);
  }

  // Tap-to-select (both): on small screens opens radial picker
  el.addEventListener('click', ()=>{
    const already = el.classList.contains('selected');
    $$('.token.selected').forEach(t=>t.classList.remove('selected'));
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
  const el = buildTokenBase();
  el.style.background = color;
  const label = document.createElement('div'); label.className='label'; label.textContent=name;
  label.style.color = contrastColor(color);
  if (label.style.color === '#000000') label.style.textShadow = '0 1px 1px rgba(255,255,255,.15)';
  el.appendChild(label);
  return el;
}
function buildImageToken(src, alt=''){
  const el = buildTokenBase();
  const img = document.createElement('img'); img.src=src; img.alt=alt; el.appendChild(img);
  return el;
}

/* ---------- Placement history (Undo) ---------- */
const historyStack = []; // {itemId, fromId, toId, beforeId}
function recordPlacement(itemId, fromId, toId, beforeId){
  if (!fromId || !toId || fromId===toId) return;
  historyStack.push({itemId, fromId, toId, beforeId: beforeId || ''});
  $('#undoBtn').disabled = historyStack.length === 0;
}
function performMove(itemId, parentId, beforeId){
  const item = document.getElementById(itemId);
  const parent = document.getElementById(parentId);
  if (!item || !parent) return;
  if (beforeId){
    const before = document.getElementById(beforeId);
    if (before && before.parentElement === parent){ parent.insertBefore(item, before); return; }
  }
  parent.appendChild(item);
}
$('#undoBtn').addEventListener('click', ()=>{
  const last = historyStack.pop();
  if (!last) return;
  performMove(last.itemId, last.fromId, last.beforeId);
  $('#undoBtn').disabled = historyStack.length === 0;
});

/* ---------- Click-to-place (works for tray & rows) ---------- */
function ensureId(el, prefix='id'){ if (!el.id) el.id = `${prefix}-${uid()}`; return el.id; } // (double-guard in case of bundlers)
function enableClickToPlace(zone){
  ensureId(zone,'zone');
  zone.addEventListener('click', (e)=>{
    if (e.target.closest('.row-menu') || e.target.closest('.row-popover')) return;
    const selected = $('.token.selected'); if (!selected) return;
    const fromId = ensureId(selected.parentElement,'zone');
    zone.appendChild(selected);
    selected.classList.remove('selected');
    recordPlacement(selected.id, fromId, zone.id);
    live(`Moved "${selected.innerText || 'item'}" to ${zone.closest('.tier-row') ? $('.label-chip', zone.closest('.tier-row')).textContent.trim() : 'tray'}`);
    vib(6);
    closeRadial();
  });
}

/* ---------- Pointer-drag (desktop / large screens) ---------- */
function enablePointerDrag(node){
  let ghost=null, originParent=null, originNext=null, currentZone=null;
  let offsetX=0, offsetY=0, x=0, y=0, raf=null;

  node.addEventListener('pointerdown', (e)=>{
    if (isSmall()) return; // no drag on small screens
    if (e.button !== 0) return;
    node.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-item');

    originParent = node.parentElement; originNext = node.nextElementSibling;
    const r=node.getBoundingClientRect();
    offsetX=e.clientX-r.left; offsetY=e.clientY-r.top; x=e.clientX; y=e.clientY;

    ghost = node.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.appendChild(ghost);
    node.classList.add('drag-hidden');

    const move = (ev)=>{ x=ev.clientX; y=ev.clientY; };
    const up = ()=>{
      node.releasePointerCapture(e.pointerId);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      cancelAnimationFrame(raf);
      const target = document.elementFromPoint(x,y);
      if (ghost) ghost.remove(); node.classList.remove('drag-hidden');
      document.body.classList.remove('dragging-item');

      const zone = getDropZoneFromElement(target);
      if (zone){
        const fromId = ensureId(originParent,'zone');
        const toId = ensureId(zone,'zone');
        const beforeId = originNext ? ensureId(originNext,'tok') : '';
        zone.appendChild(node);
        recordPlacement(node.id, fromId, toId, beforeId);
        node.classList.add('animate-drop'); setTimeout(()=>node.classList.remove('animate-drop'),180);
        live(`Moved "${node.innerText || 'item'}" to ${zone.closest('.tier-row') ? $('.label-chip', zone.closest('.tier-row')).textContent.trim() : 'tray'}`);
        vib(6);
      } else {
        if (originNext && originNext.parentElement === originParent) originParent.insertBefore(node, originNext);
        else originParent.appendChild(node);
      }
      if (currentZone) currentZone.classList.remove('drag-over');
      currentZone=null;
    };

    document.addEventListener('pointermove', move, {passive:true});
    document.addEventListener('pointerup', up, {once:true});
    loop();

    function loop(){
      raf = requestAnimationFrame(loop);
      ghost.style.transform = `translate3d(${x - offsetX}px, ${y - offsetY}px, 0)`;
      const el = document.elementFromPoint(x,y);
      const zone = getDropZoneFromElement(el);

      if (currentZone && currentZone !== zone) currentZone.classList.remove('drag-over');
      if (zone && zone !== currentZone) zone.classList.add('drag-over');
      currentZone = zone || null;

      // edge auto scroll
      const topZone = innerHeight * 0.2, bottomZone = innerHeight * 0.25, speed = 18;
      if (y < topZone) window.scrollBy(0, -speed);
      else if (y > innerHeight - bottomZone) window.scrollBy(0, speed);
    }
  });
}
function getDropZoneFromElement(el){
  if (!el) return null;
  const dz = el.closest('.dropzone'); if (dz) return dz;
  const chip = el.closest('.label-chip');
  if (chip){ return chip.closest('.tier-row')?.querySelector('.tier-drop') || null; }
  return null;
}

/* ---------- Row reordering (by label, disabled on small touch) ---------- */
function enableRowReorder(labelArea, row){
  let placeholder=null;
  labelArea.addEventListener('mousedown', arm);
  labelArea.addEventListener('touchstart', arm, {passive:true});
  function arm(e){
    if (e.target.closest('.row-menu') || e.target.closest('.row-popover')) return;
    const chip = $('.label-chip', row); if (document.activeElement === chip) return;
    if (isSmall() && isTouch) return;
    row.setAttribute('draggable','true');
  }
  row.addEventListener('dragstart', ()=>{
    document.body.classList.add('dragging-item');
    placeholder = document.createElement('div');
    placeholder.className = 'tier-row';
    placeholder.style.height = row.getBoundingClientRect().height + 'px';
    placeholder.style.borderRadius = '12px';
    placeholder.style.border = '2px dashed rgba(139,125,255,.25)';
    board.insertBefore(placeholder, row.nextSibling);
    setTimeout(()=> row.style.display='none', 0);
  });
  row.addEventListener('dragend', ()=>{
    row.style.display='';
    if (placeholder && placeholder.parentNode){ board.insertBefore(row, placeholder); placeholder.remove(); }
    row.removeAttribute('draggable');
    placeholder=null;
    document.body.classList.remove('dragging-item');
  });
  board.addEventListener('dragover', (e)=>{
    if (!placeholder) return; e.preventDefault();
    const after = rowAfterY(board, e.clientY);
    if (after) board.insertBefore(placeholder, after); else board.appendChild(placeholder);
  });
  function rowAfterY(container, y){
    const rows = [...container.querySelectorAll('.tier-row')].filter(r => r !== placeholder && r.style.display !== 'none');
    for (const r of rows){ const rect = r.getBoundingClientRect(); if (y < rect.top + rect.height/2) return r; }
    return null;
  }
}

/* ---------- Radial picker (mobile) ---------- */
const radial = $('#radialPicker');
const radialOpts = $('.radial-options', radial);
const radialHighlight = $('.radial-highlight', radial);
const radialCloseBtn = $('.radial-close', radial);
let radialForToken = null;

function refreshRadialOptions(){
  if (!isSmall()) return;
  if (!radial.classList.contains('hidden') && radialForToken){ openRadial(radialForToken); }
}

function openRadial(token){
  radialForToken = token;
  const rect = token.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;

  radialOpts.innerHTML='';
  const rows = $$('.tier-row');
  const N = rows.length; if (!N) return;

  // Size the arc based on count
  let R = 120 + Math.max(0, N-5)*10;

  // Above by default; flip if near top
  const margin = 16;
  let degStart = 200, degEnd = 340; // above
  if (cy - R - margin < 0){ degStart = 20; degEnd = 160; } // below
  const step = (degEnd - degStart) / Math.max(1,(N-1));

  radialHighlight.hidden = true;

  // Center close button
  radialCloseBtn.style.left = cx + 'px';
  radialCloseBtn.style.top  = cy + 'px';

  rows.forEach((row, i)=>{
    const btn = document.createElement('button');
    btn.type='button'; btn.className='radial-option';
    const labelText = $('.label-chip', row)?.textContent?.trim() || `Row ${i+1}`;
    btn.textContent = labelText;

    const ang = (degStart + step*i) * Math.PI/180;
    const ox = cx + R * Math.cos(ang);
    const oy = cy + R * Math.sin(ang);

    btn.style.left = ox + 'px';
    btn.style.top  = oy + 'px';

    const moveHighlight = ()=> {
      radialHighlight.hidden = false;
      radialHighlight.style.left = ox + 'px';
      radialHighlight.style.top  = oy + 'px';
    };
    btn.addEventListener('pointerenter', moveHighlight);
    btn.addEventListener('focus', moveHighlight);

    btn.addEventListener('click', ()=>{
      if (!radialForToken) return;
      const zone = row.querySelector('.tier-drop');
      const fromId = ensureId(radialForToken.parentElement,'zone');
      ensureId(zone,'zone');
      zone.appendChild(radialForToken);
      radialForToken.classList.remove('selected');
      recordPlacement(radialForToken.id, fromId, zone.id);
      vib(6);
      closeRadial();
    });

    radialOpts.appendChild(btn);
  });

  radial.classList.remove('hidden');
  radial.setAttribute('aria-hidden','false');
}
function closeRadial(){
  radial.classList.add('hidden');
  radial.setAttribute('aria-hidden','true');
  radialForToken = null;
}

/* Close radial on outside tap/scroll/resize */
document.addEventListener('click', (e)=>{
  if (radial.classList.contains('hidden')) return;
  if (radial.contains(e.target)) return;
  if (radialForToken && radialForToken.contains(e.target)) return;
  closeRadial();
});
radialCloseBtn.addEventListener('click', closeRadial);
addEventListener('scroll', ()=> closeRadial(), {passive:true});
addEventListener('resize', ()=> closeRadial(), {passive:true});

/* ---------- Clear Board ---------- */
$('#trashClear').addEventListener('click', ()=>{
  const ok = confirm('Clear the entire tier board? This moves all placed items back to the tray.');
  if (!ok) return;
  const t = $('#tray');
  $$('.tier-drop .token').forEach(tok => t.appendChild(tok));
});

/* ---------- Save PNG ---------- */
$('#saveBtn').addEventListener('click', async ()=>{
  const node = $('#tierBoard');
  closeRadial();
  $$('.row-popover.open').forEach(p=>p.classList.remove('open'));
  $$('.token.selected').forEach(t=>t.classList.remove('selected'));
  $$('.dropzone.drag-over').forEach(z=>z.classList.remove('drag-over'));
  $$('.label-chip.dragOver').forEach(z=>z.classList.remove('dragOver'));

  const canvas = await html2canvas(node, {
    backgroundColor: cssVar('--surface') || null,
    useCORS: true,
    scale: Math.min(3, window.devicePixelRatio || 2)
  });

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'tier-list.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

/* ---------- Done ---------- */
live('Ready. Drag on desktop; tap a circle for the curved picker on mobile.');
