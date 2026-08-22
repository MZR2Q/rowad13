// ─── Interactive Map Zoom & Pan Engine ────────────────
let MAP_ZOOM = {
  scale: 1,
  minScale: 0.6,
  maxScale: 3.0,
  translateX: 0,
  translateY: 0,
  isDragging: false,
  startX: 0,
  startY: 0
};

function updateMapTransform() {
  const world = document.getElementById('campus-map-world');
  const levelText = document.getElementById('map-zoom-level');
  if (world) {
    world.style.transform = `translate(${MAP_ZOOM.translateX}px, ${MAP_ZOOM.translateY}px) scale(${MAP_ZOOM.scale})`;
  }
  if (levelText) {
    levelText.textContent = `${Math.round(MAP_ZOOM.scale * 100)}%`;
  }
}

function zoomMap(delta) {
  const newScale = Math.min(Math.max(MAP_ZOOM.scale + delta, MAP_ZOOM.minScale), MAP_ZOOM.maxScale);
  MAP_ZOOM.scale = parseFloat(newScale.toFixed(2));
  updateMapTransform();
}

function resetMapZoom() {
  MAP_ZOOM.scale = 1;
  MAP_ZOOM.translateX = 0;
  MAP_ZOOM.translateY = 0;
  updateMapTransform();
}

let mapDragPanInitialized = false;
function initMapDragPan() {
  if (mapDragPanInitialized) return;
  const wrapper = document.getElementById('map-viewport-wrapper');
  if (!wrapper) return;
  mapDragPanInitialized = true;

  wrapper.addEventListener('mousedown', (e) => {
    if (e.target.closest('.map-ctrl-btn') || e.target.closest('.map-station')) return;
    MAP_ZOOM.isDragging = true;
    MAP_ZOOM.startX = e.clientX - MAP_ZOOM.translateX;
    MAP_ZOOM.startY = e.clientY - MAP_ZOOM.translateY;
    wrapper.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!MAP_ZOOM.isDragging) return;
    MAP_ZOOM.translateX = e.clientX - MAP_ZOOM.startX;
    MAP_ZOOM.translateY = e.clientY - MAP_ZOOM.startY;
    updateMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (MAP_ZOOM.isDragging) {
      MAP_ZOOM.isDragging = false;
      const wrapper = document.getElementById('map-viewport-wrapper');
      if (wrapper) wrapper.style.cursor = 'grab';
    }
  });

  // Wheel zoom
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    zoomMap(delta);
  }, { passive: false });

  // Touch handlers
  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      if (e.target.closest('.map-ctrl-btn') || e.target.closest('.map-station')) return;
      MAP_ZOOM.isDragging = true;
      MAP_ZOOM.startX = e.touches[0].clientX - MAP_ZOOM.translateX;
      MAP_ZOOM.startY = e.touches[0].clientY - MAP_ZOOM.translateY;
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (MAP_ZOOM.isDragging && e.touches.length === 1) {
      MAP_ZOOM.translateX = e.touches[0].clientX - MAP_ZOOM.startX;
      MAP_ZOOM.translateY = e.touches[0].clientY - MAP_ZOOM.startY;
      updateMapTransform();
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', () => {
    MAP_ZOOM.isDragging = false;
  });
}

// ─── Dual Orientation Pins Dictionary ──────────────────
const MAP_PIN_POSITIONS = {
  landscape: {
    door: { top: '35.0%', left: '87.6%' },
    booth1: { top: '73.1%', left: '63.5%' },
    booth2: { top: '73.1%', left: '69.5%' },
    booth3: { top: '73.1%', left: '75.6%' },
    booth4: { top: '72.0%', left: '81.7%' },
    theater: { top: '50.0%', left: '10.5%' }
  },
  portrait: {
    door: { top: '87.6%', left: '65.0%' },
    booth1: { top: '63.5%', left: '27.0%' },
    booth2: { top: '69.5%', left: '27.0%' },
    booth3: { top: '75.6%', left: '27.0%' },
    booth4: { top: '81.7%', left: '28.0%' },
    theater: { top: '10.0%', left: '50.1%' }
  }
};

let currentMapOrientation = 'landscape';

function setMapOrientation(mode) {
  currentMapOrientation = mode;
  const world = document.getElementById('campus-map-world');
  const bg = document.querySelector('.map-blueprint-bg');
  const btnLabel = document.getElementById('orientation-label');
  const btnIcon = document.getElementById('orientation-icon');

  if (!world) return;

  world.classList.remove('mode-landscape', 'mode-portrait');
  world.classList.add(`mode-${mode}`);

  if (bg) {
    bg.style.backgroundImage = mode === 'landscape'
      ? "url('/static/img/خريطه_عرضيه.png?v=100')"
      : "url('/static/img/خريطه_طوليه.png?v=100')";
  }

  if (btnLabel) {
    btnLabel.textContent = mode === 'landscape' ? 'عرضي' : 'طولي';
  }
  if (btnIcon) {
    btnIcon.className = mode === 'landscape' ? 'fa-solid fa-arrows-left-right' : 'fa-solid fa-arrows-up-down';
  }

  const posDict = MAP_PIN_POSITIONS[mode];
  if (posDict) {
    Object.keys(posDict).forEach(stId => {
      const pinEl = document.getElementById(`station-${stId}`);
      if (pinEl) {
        pinEl.style.top = posDict[stId].top;
        pinEl.style.left = posDict[stId].left;
      }
    });
  }

  resetMapZoom();
}

function toggleMapOrientation() {
  const nextMode = currentMapOrientation === 'landscape' ? 'portrait' : 'landscape';
  setMapOrientation(nextMode);
}

function toggleMapSidebar() {
  const panel = document.querySelector('.map-sidebar-panel');
  const btn = document.getElementById('sidebar-toggle-btn');
  if (!panel) return;
  panel.classList.toggle('collapsed');
  if (btn) {
    btn.classList.toggle('active', !panel.classList.contains('collapsed'));
  }
}

// ═══════════════════════════════════════════════════════
// ANIMATED CANVAS BACKGROUND ENGINE FOR CAMPUS MAP (رحلة رواد الحضورية)
// ═══════════════════════════════════════════════════════
window.MAP_CANVAS_BG = window.MAP_CANVAS_BG || {
  canvas: null, ctx: null, animId: null, running: false,
  width: 0, height: 0, time: 0, particles: [], nodes: [], waves: [],
  mouse: { x: -1000, y: -1000 }
};
var MAP_CANVAS_BG = window.MAP_CANVAS_BG;

function initMapCanvasBg() {
  MAP_CANVAS_BG.canvas = document.getElementById('campus-map-canvas');
  if (!MAP_CANVAS_BG.canvas) return;
  MAP_CANVAS_BG.ctx = MAP_CANVAS_BG.canvas.getContext('2d');

  function resize() {
    MAP_CANVAS_BG.width = window.innerWidth;
    MAP_CANVAS_BG.height = window.innerHeight;
    MAP_CANVAS_BG.canvas.width = MAP_CANVAS_BG.width;
    MAP_CANVAS_BG.canvas.height = MAP_CANVAS_BG.height;
  }
  resize();
  window.addEventListener('resize', resize);

  document.getElementById('campus-map-fullscreen')?.addEventListener('mousemove', (e) => {
    MAP_CANVAS_BG.mouse.x = e.clientX;
    MAP_CANVAS_BG.mouse.y = e.clientY;
  });

  MAP_CANVAS_BG.particles = [];
  const colors = [
    { r: 135, g: 42, b: 8 },     // #872A08 Royal University Maroon (عودي)
    { r: 211, g: 180, b: 139 },  // #D3B48B Radiant Gold (ذهبي)
    { r: 132, g: 74, b: 53 },    // #844A35 Warm Maroon
    { r: 96, g: 121, b: 118 },   // #607976 Teal
    { r: 180, g: 160, b: 145 }   // warm light gray
  ];

  for (let i = 0; i < 60; i++) {
    const color = colors[i % 5];
    MAP_CANVAS_BG.particles.push({
      x: Math.random() * MAP_CANVAS_BG.width,
      y: Math.random() * MAP_CANVAS_BG.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.35,
      radius: 1.8 + Math.random() * 3.5,
      color: color,
      alpha: 0.25 + Math.random() * 0.35,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.006 + Math.random() * 0.015
    });
  }

  for (let i = 0; i < 10; i++) {
    const ci = i % 3;
    MAP_CANVAS_BG.particles.push({
      x: Math.random() * MAP_CANVAS_BG.width,
      y: Math.random() * MAP_CANVAS_BG.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.12,
      radius: 35 + Math.random() * 55,
      color: colors[ci],
      alpha: 0.03 + Math.random() * 0.06,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.003 + Math.random() * 0.005,
      isOrb: true
    });
  }

  MAP_CANVAS_BG.nodes = [];
  for (let i = 0; i < 40; i++) {
    MAP_CANVAS_BG.nodes.push({
      x: Math.random() * MAP_CANVAS_BG.width,
      y: Math.random() * MAP_CANVAS_BG.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.25,
      radius: 2 + Math.random() * 2
    });
  }

  MAP_CANVAS_BG.waves = [];
  for (let i = 0; i < 6; i++) {
    MAP_CANVAS_BG.waves.push({
      amplitude: 30 + Math.random() * 50,
      frequency: 0.0015 + Math.random() * 0.0025,
      speed: 0.0003 + Math.random() * 0.0006,
      yOffset: 0.2 + Math.random() * 0.6,
      color: colors[i % 3],
      alpha: 0.06 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function startMapCanvasBg() {
  if (MAP_CANVAS_BG.running) return;
  if (!MAP_CANVAS_BG.canvas) initMapCanvasBg();
  if (!MAP_CANVAS_BG.canvas) return;
  MAP_CANVAS_BG.running = true;
  MAP_CANVAS_BG.time = performance.now();
  animateMapCanvas();
}

function stopMapCanvasBg() {
  MAP_CANVAS_BG.running = false;
  if (MAP_CANVAS_BG.animId) {
    cancelAnimationFrame(MAP_CANVAS_BG.animId);
    MAP_CANVAS_BG.animId = null;
  }
}

function animateMapCanvas() {
  if (!MAP_CANVAS_BG.running) return;
  MAP_CANVAS_BG.animId = requestAnimationFrame(animateMapCanvas);

  const ctx = MAP_CANVAS_BG.ctx;
  const W = MAP_CANVAS_BG.width;
  const H = MAP_CANVAS_BG.height;

  // ─── Pure Pearl White & Royal Cream Background ───
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.35, '#FAF8F5');
  bgGrad.addColorStop(0.7, '#F7F3EC');
  bgGrad.addColorStop(1, '#F3EDE2');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Soft Royal University Maroon/Oudi ambient glow (top-left)
  const grd = ctx.createRadialGradient(W * 0.15, H * 0.15, 0, W * 0.15, H * 0.15, W * 0.55);
  grd.addColorStop(0, 'rgba(135, 42, 8, 0.045)');
  grd.addColorStop(0.5, 'rgba(135, 42, 8, 0.015)');
  grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Warm Gold ambient glow (bottom-right)
  const grd2 = ctx.createRadialGradient(W * 0.85, H * 0.8, 0, W * 0.8, H * 0.8, W * 0.55);
  grd2.addColorStop(0, 'rgba(211, 180, 139, 0.08)');
  grd2.addColorStop(0.5, 'rgba(211, 180, 139, 0.025)');
  grd2.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grd2;
  ctx.fillRect(0, 0, W, H);

  MAP_CANVAS_BG.waves.forEach(wave => {
    wave.phase += wave.speed * 16;
    const y0 = H * wave.yOffset;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= W; x += 3) {
      const y = y0 + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude
                    + Math.sin(x * wave.frequency * 0.5 + wave.phase * 1.3) * wave.amplitude * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${wave.color.r}, ${wave.color.g}, ${wave.color.b}, ${wave.alpha})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  const maxDist = 170;
  MAP_CANVAS_BG.nodes.forEach(node => {
    node.x += node.vx;
    node.y += node.vy;
    if (node.x < 0 || node.x > W) node.vx *= -1;
    if (node.y < 0 || node.y > H) node.vy *= -1;
    node.x = Math.max(0, Math.min(W, node.x));
    node.y = Math.max(0, Math.min(H, node.y));
  });

  for (let i = 0; i < MAP_CANVAS_BG.nodes.length; i++) {
    for (let j = i + 1; j < MAP_CANVAS_BG.nodes.length; j++) {
      const a = MAP_CANVAS_BG.nodes[i];
      const b = MAP_CANVAS_BG.nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.15;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(135, 42, 8, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  MAP_CANVAS_BG.nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(135, 42, 8, 0.35)';
    ctx.fill();
  });

  MAP_CANVAS_BG.particles.forEach(p => {
    if (p.isOrb) {
      const mx = (MAP_CANVAS_BG.mouse.x - W / 2) * 0.01;
      const my = (MAP_CANVAS_BG.mouse.y - H / 2) * 0.01;
      p.x += p.vx + mx * 0.02;
      p.y += p.vy + my * 0.02;
    } else {
      p.x += p.vx;
      p.y += p.vy;
    }

    if (p.x < -50) p.x = W + 50;
    if (p.x > W + 50) p.x = -50;
    if (p.y < -50) p.y = H + 50;
    if (p.y > H + 50) p.y = -50;

    p.pulse += p.pulseSpeed;
    const pulseAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));

    if (p.isOrb) {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha * 1.5})`);
      grad.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha * 0.5})`);
      grad.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha})`;
      ctx.fill();

      if (p.radius > 2) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha * 0.1})`;
        ctx.fill();
      }
    }
  });
}

function openWelcomeGuide() {
  const modal = document.getElementById('modal-welcome-guide');
  if (modal) modal.classList.add('active');
}

function closeWelcomeGuide() {
  const modal = document.getElementById('modal-welcome-guide');
  if (modal) modal.classList.remove('active');
}

function startJourneyFromDoor() {
  closeWelcomeGuide();
  // Highlight Main Entrance pin visually to prompt student to click it themselves
  const doorPin = document.getElementById('station-door');
  if (doorPin) {
    doorPin.classList.add('pulse-highlight');
    setTimeout(() => doorPin.classList.remove('pulse-highlight'), 3500);
  }
}

function redirectToDoorStation() {
  closeStationModal();
  visitStation('door');
}

function confirmDoorRead() {
  if (!CAMPUS.visited.door) {
    CAMPUS.visited.door = true;
    CAMPUS.points = (CAMPUS.points || 0) + 5;
    saveCampusProgress();
    updateStudentBadgeUI();
    if (typeof showPointsToast === 'function') {
      showPointsToast('🚪 أحسنت! تم تسجيل دخولك بنجاح وحصلت على +5 نقاط!', '+5');
    }
  } else {
    saveCampusProgress();
  }
  applyStationStates();
  updateCampusProgress();
  closeStationModal();
}

// ─── Open / Close Campus Map ──────────────────────────
function openCampusMap(e) {
  if (e) e.preventDefault();
  ensureStudentIdentified(() => {
    document.getElementById('campus-dropdown')?.classList.remove('open');
    document.getElementById('journey-dropdown')?.classList.remove('open');
    document.getElementById('nav-links')?.classList.remove('open');

    // Hide top Navbar completely when entering In-Person Campus Journey
    document.getElementById('glass-nav')?.classList.add('nav-hidden');
    document.body.classList.add('campus-active');

    loadCampusProgress();
    loadExpeditionProgress();
    CAMPUS.active = true;

    const el = document.getElementById('campus-map-fullscreen');
    el.classList.add('active');
    document.body.style.overflow = 'hidden';

    initMapDragPan();
    const defaultMode = window.innerWidth <= 768 ? 'portrait' : 'landscape';
    setMapOrientation(defaultMode);

    // Apply saved states
    applyStationStates();
    updateCampusProgress();

    // Start animated canvas background matching Virtual Journey
    startMapCanvasBg();

    // Always trigger the Welcome Guide modal automatically every time the map is opened
    setTimeout(() => {
      openWelcomeGuide();
    }, 400);
  });
}

function closeCampusMap() {
  CAMPUS.active = false;
  const el = document.getElementById('campus-map-fullscreen');
  el.classList.remove('active');
  document.body.style.overflow = '';

  // Restore top Navbar when exiting In-Person Campus Journey
  document.getElementById('glass-nav')?.classList.remove('nav-hidden');
  document.body.classList.remove('campus-active');

  closeStationModal();
  closeWelcomeGuide();

  // Stop animated canvas background
  stopMapCanvasBg();
}

// ─── Apply Station Visual States ──────────────────────
function applyStationStates() {
  CAMPUS.stationOrder.forEach(id => {
    const el = document.getElementById(`station-${id}`);
    const sideCard = document.getElementById(`side-card-${id}`);
    const sideStatus = document.getElementById(`side-status-${id}`);

    if (el) el.classList.remove('locked', 'completed', 'active-station');
    if (sideCard) sideCard.classList.remove('locked', 'completed', 'active', 'active-card');

    if (CAMPUS.visited[id]) {
      if (el) el.classList.add('completed');
      if (sideCard) sideCard.classList.add('completed');
      if (sideStatus) sideStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> مكتملة ✅';
    } else if (isStationUnlocked(id)) {
      if (el) el.classList.add('active-station');
      if (sideCard) sideCard.classList.add('active-card');
      if (sideStatus) {
        if (id === 'door') sideStatus.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> اضغط للدخول';
        else sideStatus.innerHTML = '<i class="fa-solid fa-play"></i> متاحة للزيارة';
      }
    } else {
      if (el) el.classList.add('locked');
      if (sideCard) sideCard.classList.add('locked');
      if (sideStatus) sideStatus.innerHTML = '<i class="fa-solid fa-lock"></i> مغلق';
    }
  });

  // Update paths
  updatePathStates();

  // Update scan buttons state
  updateScanButtons();

  // Update workshop buttons state
  updateWorkshopButtons();
}

function isStationUnlocked(id) {
  switch(id) {
    case 'door': return true;
    case 'booth1': return CAMPUS.visited.door;
    case 'booth2': return CAMPUS.visited.door;
    case 'booth3': return CAMPUS.visited.door;
    case 'booth4': return CAMPUS.visited.door;
    case 'theater': return CAMPUS.visited.door && CAMPUS.visited.booth1 && CAMPUS.visited.booth2;
    default: return false;
  }
}

// ─── Update Scan Buttons State ────────────────────────
function updateScanButtons() {
  // Booth scan buttons
  ['booth1', 'booth2'].forEach(id => {
    const btn = document.getElementById(`scan-${id}`);
    if (btn && CAMPUS.scanned[id]) {
      btn.classList.add('scanned');
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم السكان ✅ (+20 نقطة)';
      btn.disabled = true;
    }
  });

  // Theater attendance scan
  const theaterBtn = document.getElementById('scan-theater-attendance');
  if (theaterBtn && CAMPUS.scanned['theater']) {
    theaterBtn.classList.add('scanned');
    theaterBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم تسجيل حضور المسرح بنجاح ✅';
    theaterBtn.disabled = true;
  }
}

// ─── Update Workshop Buttons State ────────────────────
function updateWorkshopButtons() {
  for (let i = 1; i <= 9; i++) {
    const workshopEl = document.getElementById(`workshop-${i}`);
    const key = `workshop_${i}`;
    if (workshopEl && CAMPUS.scanned[key]) {
      workshopEl.classList.add('workshop-completed');
      const btn = workshopEl.querySelector('.workshop-scan-btn');
      if (btn) {
        btn.classList.add('scanned');
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم ✅';
        btn.disabled = true;
      }
    }
  }
}

function updatePathStates() {
  // Path 1: Door → Plaza
  setPathState('path-1', CAMPUS.visited.door ? 'complete' : 'active');
  // Path 2: Plaza → Booths zone
  setPathState('path-2', CAMPUS.visited.door ? 'active' : '');
  if (CAMPUS.visited.booth1) setPathState('path-2', 'complete');
  // Path 2b-2d: Between booths
  setPathState('path-2b', CAMPUS.visited.booth1 ? 'complete' : (CAMPUS.visited.door ? 'active' : ''));
  setPathState('path-2c', CAMPUS.visited.booth2 ? 'complete' : (CAMPUS.visited.door ? 'active' : ''));
  setPathState('path-2d', CAMPUS.visited.booth3 ? 'complete' : (CAMPUS.visited.door ? 'active' : ''));
  // Path 3: Plaza → Corridor up
  setPathState('path-3', CAMPUS.visited.door ? 'complete' : '');
  // Path 4: Corridor → Lobby
  setPathState('path-4', (CAMPUS.visited.booth1 && CAMPUS.visited.booth2) ? 'active' : '');
  // Path 5: Lobby → Theater
  setPathState('path-5', (CAMPUS.visited.booth1 && CAMPUS.visited.booth2) ? 'active' : '');
  // Path 6: Theater → Theater doors
  setPathState('path-6', CAMPUS.visited.theater ? 'complete' : '');
  if (CAMPUS.visited.theater) {
    setPathState('path-4', 'complete');
    setPathState('path-5', 'complete');
  }
}

function setPathState(pathClass, state) {
  document.querySelectorAll(`.${pathClass}`).forEach(el => {
    el.classList.remove('path-active', 'path-complete');
    if (state === 'active') el.classList.add('path-active');
    else if (state === 'complete') el.classList.add('path-complete');
  });
}

// ─── Update Progress Bar ──────────────────────────────
function updateCampusProgress() {
  const completed = CAMPUS.stationOrder.filter(id => CAMPUS.visited[id]).length;
  const pct = Math.round((completed / CAMPUS.totalStations) * 100);
  const fill = document.getElementById('campus-progress-fill');
  const text = document.getElementById('campus-progress-text');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `${completed} / ${CAMPUS.totalStations} محطات | ${CAMPUS.points} نقطة`;
}

// ─── Visit Station ────────────────────────────────────
function visitStation(id) {
  if (!isStationUnlocked(id)) {
    // Show locked modal
    const title = document.getElementById('locked-title');
    const msg = document.getElementById('locked-message');
    if (!CAMPUS.visited.door) {
      if (title) title.textContent = '⛔ يجب البدء من الباب الرئيسي أولاً!';
      if (msg) msg.textContent = 'عزيزي الطالب، جميع البوثات والمسرح مقفلة حالياً. ينبغي عليك أولاً الضغط على (1. الباب الرئيسي) بالخريطة لقراءة التوجيهات والتسجيل للانطلاق.';
    } else if (id === 'theater' && !(CAMPUS.visited.booth1 && CAMPUS.visited.booth2)) {
      if (title) title.textContent = 'المسرح مقفل حالياً';
      if (msg) msg.textContent = 'يجب زيارة بوث شؤون الطلاب وبوث القبول والتسجيل أولاً لفتح المسرح والورش التدريبية.';
    } else {
      if (title) title.textContent = 'هذه المحطة مقفلة';
      if (msg) msg.textContent = 'ادخل من الباب الرئيسي أولاً لفتح باقي المحطات.';
    }
    openStationModal('locked');

    // Highlight Main Entrance Pin
    const doorPin = document.getElementById('station-door');
    if (doorPin) {
      doorPin.classList.add('pulse-highlight');
      setTimeout(() => doorPin.classList.remove('pulse-highlight'), 3000);
    }
    return;
  }

  // Mark as visited (door is only marked visited when student clicks confirmDoorRead button)
  if (id !== 'door' && !CAMPUS.visited[id]) {
    CAMPUS.visited[id] = true;
    CAMPUS.points = (CAMPUS.points || 0) + 5;
    saveCampusProgress();
    updateStudentBadgeUI();
    if (typeof showPointsToast === 'function') {
      showPointsToast('📍 أحسنت! حصلت على +5 نقاط لاستكشاف هذه المحطة!', '+5');
    }
  }

  // Open the appropriate modal
  openStationModal(id);

  // Special: Door animation
  if (id === 'door') {
    setTimeout(() => {
      const panel = document.getElementById('door-panel');
      const light = document.getElementById('door-light');
      if (panel) panel.classList.add('open');
      if (light) light.classList.add('glow');
    }, 400);
  }

  // Update states
  applyStationStates();
  updateCampusProgress();
}

// ─── Mark Booth Viewed (info-only booths: booth3, booth4) ─────
function markBoothViewed(boothId) {
  if (CAMPUS.visited[boothId]) return;

  CAMPUS.visited[boothId] = true;
  saveCampusProgress();

  applyStationStates();
  updateCampusProgress();

  // Check if all done
  checkCompletion();
}

// ─── QR Scanner System ────────────────────────────────
function openQRScanner(targetId, points) {
  // Already scanned?
  if (CAMPUS.scanned[targetId]) {
    return;
  }

  CAMPUS.qrScanTarget = targetId;
  CAMPUS.qrScanPoints = points;

  // Show scanner modal
  const modal = document.getElementById('modal-qr-scanner');
  modal.classList.add('active');

  // Update title
  const title = document.getElementById('qr-scanner-title');
  const subtitle = document.getElementById('qr-scanner-subtitle');
  const status = document.getElementById('qr-scanner-status');

  if (targetId.startsWith('workshop_')) {
    const num = targetId.split('_')[1];
    if (title) title.textContent = `سكان ورشة رقم ${num}`;
    if (subtitle) subtitle.textContent = `وجّه الكاميرا نحو باركود الورشة لتكسب ${points} نقاط`;
  } else if (targetId === 'theater') {
    if (title) title.textContent = 'سكان حضور المسرح';
    if (subtitle) subtitle.textContent = 'وجّه الكاميرا نحو باركود المسرح لتأكيد الحضور';
  } else {
    if (title) title.textContent = 'سكان الباركود';
    if (subtitle) subtitle.textContent = `وجّه الكاميرا نحو باركود QR لتكسب ${points} نقطة`;
  }

  if (status) {
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري تشغيل الكاميرا...';
    status.classList.remove('error');
  }

  // Initialize scanner
  startQRScanner();
}

async function startQRScanner() {
  const readerEl = document.getElementById('qr-reader');
  const statusEl = document.getElementById('qr-scanner-status');
  if (!readerEl) return;

  // Clear previous scanner content
  readerEl.innerHTML = '';

  try {
    CAMPUS.qrScanner = new Html5Qrcode('qr-reader');

    await CAMPUS.qrScanner.start(
      { facingMode: 'environment' }, // Use back camera
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      onQRScanSuccess,
      (errorMessage) => {
        // Ignore scan errors (no QR found yet)
      }
    );

    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-viewfinder"></i> وجّه الكاميرا نحو الباركود...';
    }
  } catch (err) {
    console.error('[QR Scanner] Error:', err);
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> تعذّر تشغيل الكاميرا. تأكد من السماح بالوصول للكاميرا.';
      statusEl.classList.add('error');
    }
  }
}

function onQRScanSuccess(decodedText) {
  console.log('[QR Scanner] Read:', decodedText);

  const targetId = CAMPUS.qrScanTarget;
  const points = CAMPUS.qrScanPoints;

  // Stop scanner
  stopQRScanner();

  // Close scanner modal
  const scannerModal = document.getElementById('modal-qr-scanner');
  scannerModal?.classList.remove('active');

  // Record scan
  if (!CAMPUS.scanned[targetId]) {
    CAMPUS.scanned[targetId] = true;
    CAMPUS.points += points;
    saveCampusProgress();
  }

  // Mark station as visited if it's a main station
  if (['booth1', 'booth2', 'theater'].includes(targetId)) {
    CAMPUS.visited[targetId] = true;
    saveCampusProgress();
  }

  // Show success modal
  showQRSuccess(targetId, points);

  // Update UI
  applyStationStates();
  updateCampusProgress();

  // Check completion
  setTimeout(() => checkCompletion(), 1500);
}

function showQRSuccess(targetId, points) {
  const modal = document.getElementById('modal-qr-success');
  const msgEl = document.getElementById('qr-success-message');
  const pointsEl = document.getElementById('qr-success-points');

  let msg = 'تم تسجيل الحضور وكسب النقاط!';
  if (targetId === 'booth1') msg = 'تم سكان بوث شؤون الطلاب!';
  else if (targetId === 'booth2') msg = 'تم سكان بوث القبول والتسجيل!';
  else if (targetId === 'theater') msg = 'تم تسجيل حضور المسرح بنجاح!';
  else if (targetId.startsWith('workshop_')) {
    const num = targetId.split('_')[1];
    msg = `تم سكان الورشة رقم ${num}!`;
  }

  if (msgEl) msgEl.textContent = msg;
  if (pointsEl) {
    pointsEl.textContent = points > 0 ? `+${points} نقطة` : 'تأكيد حضور المسرح ✅ (بدون نقاط)';
  }

  modal?.classList.add('active');
}

function closeQRSuccess() {
  const modal = document.getElementById('modal-qr-success');
  modal?.classList.remove('active');
}

async function stopQRScanner() {
  try {
    if (CAMPUS.qrScanner) {
      const state = CAMPUS.qrScanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING) {
        await CAMPUS.qrScanner.stop();
      }
      CAMPUS.qrScanner.clear();
      CAMPUS.qrScanner = null;
    }
  } catch (e) {
    console.warn('[QR Scanner] Error stopping:', e);
    CAMPUS.qrScanner = null;
  }
}

function closeQRScanner() {
  stopQRScanner();
  const modal = document.getElementById('modal-qr-scanner');
  modal?.classList.remove('active');
}

// ─── Check Completion ─────────────────────────────────
function checkCompletion() {
  const allVisited = CAMPUS.stationOrder.every(id => CAMPUS.visited[id]);
  if (allVisited) {
    // Update complete modal with total points
    const totalEl = document.getElementById('complete-points-total');
    if (totalEl) totalEl.innerHTML = `مجموع نقاطك: <strong>${CAMPUS.points}</strong> نقطة`;

    setTimeout(() => openStationModal('complete'), 500);
  }
}

// ─── Station Modal System ─────────────────────────────
function openStationModal(id) {
  closeStationModal();
  const modal = document.getElementById(`modal-${id}`);
  if (modal) {
    modal.classList.add('active');
    CAMPUS.currentModal = id;
  }
}

function closeStationModal() {
  if (CAMPUS.currentModal) {
    const modal = document.getElementById(`modal-${CAMPUS.currentModal}`);
    if (modal) modal.classList.remove('active');
    CAMPUS.currentModal = null;
  }
}

// ─── Reset Campus Map ─────────────────────────────────
function resetCampusMap() {
  CAMPUS.visited = { door: false, booth1: false, booth2: false, booth3: false, booth4: false, theater: false };
  CAMPUS.scanned = {};
  CAMPUS.points = 0;
  saveCampusProgress();
  closeStationModal();

  // Reset door animation
  const panel = document.getElementById('door-panel');
  const light = document.getElementById('door-light');
  if (panel) panel.classList.remove('open');
  if (light) light.classList.remove('glow');

  // Reset scan buttons
  ['booth1', 'booth2'].forEach(id => {
    const btn = document.getElementById(`scan-${id}`);
    if (btn) {
      btn.classList.remove('scanned');
      btn.innerHTML = `<i class="fa-solid fa-qrcode"></i> 📷 سكان الباركود`;
      btn.disabled = false;
    }
  });

  // Reset theater attendance button
  const theaterBtn = document.getElementById('scan-theater-attendance');
  if (theaterBtn) {
    theaterBtn.classList.remove('scanned');
    theaterBtn.innerHTML = '<i class="fa-solid fa-qrcode"></i> 📷 سكان حضور المسرح';
    theaterBtn.disabled = false;
  }

  // Reset workshop buttons
  for (let i = 1; i <= 9; i++) {
    const workshopEl = document.getElementById(`workshop-${i}`);
    if (workshopEl) {
      workshopEl.classList.remove('workshop-completed');
      const btn = workshopEl.querySelector('.workshop-scan-btn');
      if (btn) {
        btn.classList.remove('scanned');
        btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> سكان';
        btn.disabled = false;
      }
    }
  }

  applyStationStates();
  updateCampusProgress();
}

// ─── Keyboard support ─────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && CAMPUS.active) {
    if (CAMPUS.currentModal) {
      closeStationModal();
    } else {
      closeCampusMap();
    }
  }
});

// Legacy proof handlers removed to prevent overriding active modal proof persistence

