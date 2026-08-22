// ─── Navigation ───────────────────────────────────────────
function showHome(e) {
  if (e) e.preventDefault();
  closeOverlay();
  closeMobileMenu();
  setActiveNav('home');
}

function toggleDropdown(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  document.getElementById('quiz-stations-dropdown')?.classList.remove('open');
  document.getElementById('campus-dropdown')?.classList.remove('open');
  document.getElementById('journey-dropdown')?.classList.toggle('open');
}
window.toggleDropdown = toggleDropdown;

function toggleCampusDropdown(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  document.getElementById('journey-dropdown')?.classList.remove('open');
  document.getElementById('quiz-stations-dropdown')?.classList.remove('open');
  document.getElementById('campus-dropdown')?.classList.toggle('open');
}
window.toggleCampusDropdown = toggleCampusDropdown;

function toggleQuizDropdown(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  document.getElementById('journey-dropdown')?.classList.remove('open');
  document.getElementById('campus-dropdown')?.classList.remove('open');
  document.getElementById('quiz-stations-dropdown')?.classList.toggle('open');
}
window.toggleQuizDropdown = toggleQuizDropdown;

function openHeroDropdownTarget(targetName, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Close all open dropdowns first
  document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));

  const isMobile = window.innerWidth <= 992;
  const navLinks = document.getElementById('nav-links');

  if (targetName === 'virtual') {
    const dd = document.getElementById('journey-dropdown');
    if (isMobile && navLinks && !navLinks.classList.contains('open')) {
      navLinks.classList.add('open');
      document.getElementById('mobile-nav-backdrop')?.classList.add('active');
    }
    if (dd) {
      dd.classList.add('open');
      dd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else if (targetName === 'campus') {
    const dd = document.getElementById('campus-dropdown');
    if (isMobile && navLinks && !navLinks.classList.contains('open')) {
      navLinks.classList.add('open');
      document.getElementById('mobile-nav-backdrop')?.classList.add('active');
    }
    if (dd) {
      dd.classList.add('open');
      dd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else if (targetName === 'quiz') {
    const dd = document.getElementById('quiz-stations-dropdown');
    if (isMobile && navLinks && !navLinks.classList.contains('open')) {
      navLinks.classList.add('open');
      document.getElementById('mobile-nav-backdrop')?.classList.add('active');
    }
    if (dd) {
      dd.classList.add('open');
      dd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else if (targetName === 'award') {
    openOverlay('award', event);
  }
}
window.openHeroDropdownTarget = openHeroDropdownTarget;

function toggleHubCard(cardId) {
  const card = document.getElementById(`hub-card-${cardId}`);
  if (!card) return;

  const isExpanded = card.classList.contains('is-expanded');

  // Close all other hub cards for clean accordion feel:
  document.querySelectorAll('.hub-interactive-card').forEach(c => {
    if (c !== card) c.classList.remove('is-expanded');
  });

  if (isExpanded) {
    card.classList.remove('is-expanded');
  } else {
    card.classList.add('is-expanded');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
window.toggleHubCard = toggleHubCard;

function openStationQuiz(stationNumber, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
  document.getElementById('nav-links')?.classList.remove('open');

  // Map of stations to their quiz question starting slide:
  const stationMap = {
    1: 4,   // اختبار المحطة الأولى (سؤال 1)
    2: 10,  // اختبار المحطة الثانية (مهمة/سؤال 1)
    3: 15,  // اختبار المحطة الثالثة (سؤال 1)
    4: 21,  // اختبار المحطة الرابعة (سؤال 1)
    5: 27   // اختبار المحطة الخامسة (سؤال 1)
  };

  const target = stationMap[stationNumber] !== undefined ? stationMap[stationNumber] : 4;
  startJourney(e, target);
}
window.openStationQuiz = openStationQuiz;

function toggleStationSubmenu(stationNum, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const item = document.getElementById(`station-subnav-${stationNum}`);
  // Close any other open station submenus
  document.querySelectorAll('.station-sub-group').forEach(sg => {
    if (sg !== item) sg.classList.remove('open');
  });
  if (item) item.classList.toggle('open');
}
window.toggleStationSubmenu = toggleStationSubmenu;

function toggleDeanshipsSubmenu(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const item = document.getElementById('deanships-subnav');
  if (item) item.classList.toggle('open');
}

function toggleMobileMenu() {
  const navLinks = document.getElementById('nav-links');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  if (navLinks) {
    const isOpen = navLinks.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
}
window.toggleMobileMenu = toggleMobileMenu;

function closeMobileMenu() {
  const navLinks = document.getElementById('nav-links');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  if (navLinks) navLinks.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  document.body.style.overflow = '';
}
window.closeMobileMenu = closeMobileMenu;

function setActiveNav(section) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-section="${section}"]`);
  if (link) link.classList.add('active');
}

// ─── Overlay System ───────────────────────────────────────
function openOverlay(id, e, docKey) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  document.getElementById('journey-dropdown')?.classList.remove('open');
  document.getElementById('quiz-stations-dropdown')?.classList.remove('open');
  document.getElementById('campus-dropdown')?.classList.remove('open');
  closeMobileMenu();
  if (APP.currentOverlay) {
    document.getElementById(`overlay-${APP.currentOverlay}`)?.classList.remove('active');
  }

  const cleanId = (id || '').replace(/^overlay-/, '');
  const overlay = document.getElementById(`overlay-${cleanId}`) || document.getElementById(id);
  if (overlay) {
    overlay.classList.add('active');
    APP.currentOverlay = cleanId;
    document.body.style.overflow = 'hidden';

    // Award exploration points for opening this station document/guide
    const trackKey = docKey || cleanId;
    if (typeof awardDocumentExplorePoints === 'function') {
      awardDocumentExplorePoints(trackKey);
    }
  }
}

function closeOverlay() {
  if (APP.currentOverlay) {
    document.getElementById(`overlay-${APP.currentOverlay}`)?.classList.remove('active');
    APP.currentOverlay = null;
    document.body.style.overflow = '';
  }
}

// ─── Regulations ──────────────────────────────────────────
async function loadRegulations() {
  try {
    const res = await fetch('/articles');
    const data = await res.json();
    if (!data.sources) return;
    const study = data.sources.find(s => s.document_id === 'study_exam_regulations');
    const disc = data.sources.find(s => s.document_id === 'discipline_regulations');
    if (study) APP.regulations.study = [...(study.items || []), ...(study.tables || []), ...(study.formulas || [])];
    if (disc) APP.regulations.discipline = disc.items || [];
    renderRegulations();
    renderJourneyRegulations('', 'discipline', 'j-discipline-browse'); // Populate discipline browse
    renderJourneyRegulations('', 'study', 'j-study-browse'); // Populate study browse
  } catch (e) {
    console.error('[Regs] Load error:', e);
  }
}

function switchRegDoc(docId) {
  APP.currentRegDoc = docId;
  document.getElementById('sw-study').classList.toggle('active', docId === 'study_exam_regulations');
  document.getElementById('sw-discipline').classList.toggle('active', docId === 'discipline_regulations');
  document.getElementById('reg-search-input').value = '';
  renderRegulations();

  if (typeof awardDocumentExplorePoints === 'function') {
    awardDocumentExplorePoints(docId);
  }
}

function renderRegulations(filter = '') {
  const isDisc = APP.currentRegDoc === 'discipline_regulations';
  const key = isDisc ? 'discipline' : 'study';
  let items = APP.regulations[key] || [];
  if (filter) {
    const q = filter.toLowerCase().replace(/[أإآ]/g, 'ا');
    items = items.filter(item => {
      const text = `${item.title || ''} ${item.content || ''} ${(item.tags || []).join(' ')}`.toLowerCase().replace(/[أإآ]/g, 'ا');
      return text.includes(q);
    });
  }
  const container = document.getElementById('reg-articles-list');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">لا توجد نتائج</div>`;
    return;
  }
  container.innerHTML = items.map(item => {
    const artNum = item.article_number || `#${item.id}`;
    const title = item.title || '';
    const content = (item.content || '').replace(/\n/g, '<br>');
    return `<div class="reg-article-item" onclick="toggleArticle(this)"><div class="reg-article-header"><span class="reg-article-num">${artNum}</span><span class="reg-article-title">${title}</span><i class="fa-solid fa-chevron-down reg-article-toggle"></i></div><div class="reg-article-content">${content}</div></div>`;
  }).join('');
}

function toggleArticle(el) {
  if (!el) return;
  const item = el.closest('.reg-article-item') || el;
  const isExpanded = item.classList.toggle('expanded');
  const content = item.querySelector('.reg-article-content');
  const icon = item.querySelector('.reg-article-toggle');
  
  if (content) {
    if (isExpanded) {
      content.style.display = 'block';
      content.style.maxHeight = 'none';
      content.style.opacity = '1';
    } else {
      content.style.display = 'none';
      content.style.maxHeight = '0';
    }
  }
  if (icon) {
    icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    icon.style.transition = 'transform 0.2s ease';
  }
}
function filterRegulations(value) { renderRegulations(value); }

// ─── Journey Regulations Browse ───────────────────────────
let currentJourneyDocFilter = 'study';

function setJourneyDocFilter(docType) {
  currentJourneyDocFilter = docType;
  const filterInput = document.getElementById('j-reg-search');
  const val = filterInput ? filterInput.value : '';
  renderJourneyRegulations(val, docType);
}

function renderJourneyRegulations(filter = '', docFilter = currentJourneyDocFilter, containerId = 'j-reg-browse') {
  let items = [];
  if (docFilter === 'discipline') {
    items = APP.regulations.discipline || [];
  } else if (docFilter === 'study') {
    items = APP.regulations.study || [];
  } else {
    items = [...(APP.regulations.study || []), ...(APP.regulations.discipline || [])];
  }

  if (filter) {
    const q = filter.toLowerCase().replace(/[أإآ]/g, 'ا');
    items = items.filter(item => {
      const text = `${item.title || ''} ${item.content || ''} ${(item.tags || []).join(' ')}`.toLowerCase().replace(/[أإآ]/g, 'ا');
      return text.includes(q);
    });
  }
  const container = document.getElementById(containerId);
  if (!container) return;

  const docTabsHtml = `
    <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; justify-content:center;">
      <button type="button" onclick="setJourneyDocFilter('study')" class="doc-switch-btn ${docFilter === 'study' ? 'active' : ''}" style="padding:6px 14px; font-size:0.82rem; border-radius:20px; font-weight:700;">
        <i class="fa-solid fa-book-open"></i> اللوائح والأنظمة الأكاديمية (${(APP.regulations.study||[]).length})
      </button>
      <button type="button" onclick="setJourneyDocFilter('discipline')" class="doc-switch-btn ${docFilter === 'discipline' ? 'active' : ''}" style="padding:6px 14px; font-size:0.82rem; border-radius:20px; font-weight:700; background:${docFilter === 'discipline' ? 'linear-gradient(135deg,#882D1B,#7D321D)' : ''}; color:${docFilter === 'discipline' ? '#fff' : ''};">
        <i class="fa-solid fa-gavel"></i> لائحة الانضباط الطلابي 1447-2026 (${(APP.regulations.discipline||[]).length})
      </button>
      <button type="button" onclick="setJourneyDocFilter('all')" class="doc-switch-btn ${docFilter === 'all' ? 'active' : ''}" style="padding:6px 14px; font-size:0.82rem; border-radius:20px; font-weight:700;">
        <i class="fa-solid fa-layer-group"></i> جميع اللوائح (${(APP.regulations.study||[]).length + (APP.regulations.discipline||[]).length})
      </button>
    </div>
  `;

  if (!items.length) {
    container.innerHTML = docTabsHtml + `<div style="padding:30px;text-align:center;color:var(--text-muted)">لا توجد نتائج</div>`;
    return;
  }

  container.innerHTML = docTabsHtml + items.map(item => {
    const isDisc = (item.document_name && item.document_name.includes('الانضباط')) || item.document_id === 'discipline_regulations';
    const badgeText = isDisc ? '⚖️ لائحة الانضباط الطلابي' : '📖 لائحة الدراسة والاختبارات';
    const badgeColor = isDisc ? '#882D1B' : 'var(--c1)';
    const artNum = item.article_number || `#${item.id}`;
    const title = item.title || '';
    const content = (item.content || '').replace(/\n/g, '<br>');
    return `
      <div class="reg-article-item" onclick="toggleArticle(this)">
        <div class="reg-article-header">
          <span class="reg-article-num" style="background:${badgeColor}15; color:${badgeColor}; border:1px solid ${badgeColor}30;">${artNum}</span>
          <span class="reg-article-title">${title} <small style="font-size:0.75rem; color:${badgeColor}; font-weight:700; margin-right:8px;">[${badgeText}]</small></span>
          <i class="fa-solid fa-chevron-down reg-article-toggle"></i>
        </div>
        <div class="reg-article-content">${content}</div>
      </div>
    `;
  }).join('');
}

function filterJourneyReg(value) { renderJourneyRegulations(value, currentJourneyDocFilter, 'j-reg-browse'); }

// ─── Calendar ─────────────────────────────────────────────
async function loadCalendar() {
  try {
    const res = await fetch('/api/calendar');
    const data = await res.json();
    if (data.semesters) {
      APP.calendarData = data.semesters;
      renderCalendar();
      renderJourneyCalendar(); // Populate journey browse
    }
  } catch (e) {
    console.warn('[Calendar] Could not load calendar data:', e);
  }
}

function filterCalendar(sem, btn) {
  APP.calendarFilter = sem;
  document.querySelectorAll('.cal-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCalendar();
}

function renderCalendar() {
  const container = document.getElementById('cal-events-list');
  if (!APP.calendarData.length) {
    container.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted)">جاري تحميل التقويم...</div>';
    return;
  }
  let events = [];
  APP.calendarData.forEach(sem => {
    if (APP.calendarFilter === 'all' || sem.semester_code === APP.calendarFilter) {
      (sem.events || []).forEach(ev => events.push({ ...ev, semester: sem.semester_name }));
    }
  });
  container.innerHTML = events.map(ev => {
    const hijri = ev.hijri || `${ev.start_hijri || ''} — ${ev.end_hijri || ''}`;
    const greg = ev.gregorian || `${ev.start_gregorian || ''} — ${ev.end_gregorian || ''}`;
    return `<div class="cal-event-item"><div class="cal-event-name">${ev.event}</div><div class="cal-event-dates"><span><i class="fa-solid fa-moon"></i> ${hijri}</span><span><i class="fa-solid fa-calendar-check"></i> ${greg}</span>${ev.day ? `<span><i class="fa-solid fa-clock"></i> ${ev.day}</span>` : ''}</div></div>`;
  }).join('');
}

// ─── Journey Calendar Browse ──────────────────────────────
function renderJourneyCalendar() {
  const container = document.getElementById('j-cal-browse');
  if (!container || !APP.calendarData.length) return;

  let html = '';
  APP.calendarData.forEach(sem => {
    html += `<div class="j-section-block"><h4><i class="fa-solid fa-calendar-days"></i> ${sem.semester_name}</h4><div style="display:flex;flex-direction:column;gap:6px">`;
    (sem.events || []).forEach(ev => {
      const hijri = ev.hijri || `${ev.start_hijri || ''} — ${ev.end_hijri || ''}`;
      const greg = ev.gregorian || `${ev.start_gregorian || ''} — ${ev.end_gregorian || ''}`;
      html += `<div class="cal-event-item"><div class="cal-event-name">${ev.event}</div><div class="cal-event-dates"><span><i class="fa-solid fa-moon"></i> ${hijri}</span><span><i class="fa-solid fa-calendar-check"></i> ${greg}</span>${ev.day ? `<span><i class="fa-solid fa-clock"></i> ${ev.day}</span>` : ''}</div></div>`;
    });
    html += `</div></div>`;
  });
  container.innerHTML = html;
}

