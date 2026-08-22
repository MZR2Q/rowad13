// ─── Unique QR Codes for each Station/Workshop ────────────────────
const QR_CODE_MAP = {
  // Stations
  reception: 'UOH-STATION-RECEPTION',
  affairs:   'UOH-STATION-AFFAIRS',
  admission: 'UOH-STATION-ADMISSION',
  elearn:    'UOH-STATION-ELEARN',
  colleges:  'UOH-STATION-COLLEGES',
  clubs:     'UOH-STATION-CLUBS',
  clinic:    'UOH-STATION-CLINIC',
  // Workshops
  'ws-1':  'UOH-WS-01',
  'ws-2':  'UOH-WS-02',
  'ws-3':  'UOH-WS-03',
  'ws-4':  'UOH-WS-04',
  'ws-5':  'UOH-WS-05',
  'ws-6':  'UOH-WS-06',
  'ws-7':  'UOH-WS-07',
  'ws-8':  'UOH-WS-08',
  'ws-9':  'UOH-WS-09'
};

// Reverse lookup: QR code → { type, id, name }
const QR_REVERSE_MAP = {};
Object.entries(QR_CODE_MAP).forEach(([key, code]) => {
  if (key.startsWith('ws-')) {
    const num = parseInt(key.split('-')[1]);
    QR_REVERSE_MAP[code] = { type: 'workshop', id: key, num, name: `ورشة ${num.toString().padStart(2,'0')}` };
  } else {
    const station = EXPEDITION_STATIONS_DATA[key];
    QR_REVERSE_MAP[code] = { type: 'station', id: key, name: station ? station.name : key };
  }
});

// ─── Station-to-Survey Mapping ────────────────────────
const STATION_SURVEY_MAP = {
  elearn: {
    title: 'الخدمات التقنية',
    icon: 'fa-solid fa-laptop-code',
    items: [
      { id: 'tech-1', text: 'أستطيع الدخول إلى البريد الجامعي.' },
      { id: 'tech-2', text: 'أستطيع الدخول إلى منصة إدارة التعلم (Blackboard).' },
      { id: 'tech-3', text: 'أعرف كيفية الدخول إلى نظام سجلات الطلاب (SIS).' },
      { id: 'tech-4', text: 'لا توجد لدي مشكلة في اسم المستخدم أو كلمة المرور.' },
      { id: 'tech-5', text: 'أعرف كيفية التواصل مع الدعم الفني عند الحاجة.' }
    ]
  },
  colleges: {
    title: 'الكلية والتخصص',
    icon: 'fa-solid fa-building-columns',
    items: [
      { id: 'col-1', text: 'أعرف كليتي وتخصصي.' },
      { id: 'col-2', text: 'أعرف موقع الكلية والقاعات والمعامل التي سأستخدمها.' },
      { id: 'col-3', text: 'اطلعت على الخطة الدراسية لتخصصي وأعرف كيفية الوصول إليها.' },
      { id: 'col-4', text: 'أعرف أهمية خطة المقرر (Syllabus) وما تتضمنه من توزيع الدرجات والاختبارات والتكليفات.' },
      { id: 'col-5', text: 'أعرف مرشدي الأكاديمي وكيفية التواصل معه.' },
      { id: 'col-6', text: 'أعرف الجهة التي أراجعها عند وجود استفسار أكاديمي متعلق بتخصصي.' }
    ]
  },
  affairs: {
    title: 'خدمات عمادة شؤون الطلاب',
    icon: 'fa-solid fa-hand-holding-heart',
    items: [
      { id: 'aff-1', text: 'تعرفت على أبرز خدمات عمادة شؤون الطلاب.' },
      { id: 'aff-2', text: 'أعرف كيفية المشاركة في الأندية والأنشطة الطلابية.' },
      { id: 'aff-3', text: 'تعرفت على فرص التطوع والمسابقات والبرامج والفعاليات الطلابية.' },
      { id: 'aff-4', text: 'أعرف الخدمات المتاحة في مجال الدعم والإرشاد الطلابي.' },
      { id: 'aff-5', text: 'أعرف أهم المرافق والخدمات الطلابية في الجامعة.' },
      { id: 'aff-6', text: 'حصلت على الروابط أو رمز الاستجابة السريعة (QR) الخاص بالخدمات الطلابية.' }
    ]
  },
  admission: {
    title: 'القبول والتسجيل',
    icon: 'fa-solid fa-graduation-cap',
    items: [
      { id: 'adm-1', text: 'أستطيع الدخول إلى نظام سجلات الطلاب (SIS).' },
      { id: 'adm-2', text: 'يظهر لدي الجدول الدراسي بشكل صحيح.' },
      { id: 'adm-3', text: 'أعرف كيفية قراءة الجدول: اليوم - الوقت - رقم الشعبة - القاعة.' },
      { id: 'adm-4', text: 'لا توجد لدي مشكلة في تسجيل المقررات أو الجدول الدراسي.' },
      { id: 'adm-5', text: 'تعرفت على التعليمات الأساسية المتعلقة بالحذف والإضافة.' },
      { id: 'adm-6', text: 'اطلعت على التقويم الأكاديمي للعام الجامعي 1448هـ، وتعرفت على أهم المواعيد الأكاديمية فيه.' },
      { id: 'adm-7', text: 'أعرف التعليمات المتعلقة بالحضور والغياب والحرمان.' },
      { id: 'adm-8', text: 'أعرف بشكل عام مفهوم المعدل الأكاديمي والإنذارات الأكاديمية.' },
      { id: 'adm-9', text: 'أعرف الجهة التي أراجعها عند وجود مشكلة في القبول أو التسجيل أو السجل الأكاديمي.' }
    ]
  },
  exit: {
    title: 'قبل أن تغادر',
    icon: 'fa-solid fa-flag-checkered',
    items: [
      { id: 'dep-1', text: 'أعرف أين ستكون أول محاضرة لي.' },
      { id: 'dep-2', text: 'أستطيع الدخول إلى الأنظمة الجامعية الأساسية.' },
      { id: 'dep-3', text: 'أعرف مرشدي الأكاديمي.' },
      { id: 'dep-4', text: 'أعرف أين أراجع عند وجود مشكلة أو استفسار.' },
      { id: 'dep-5', text: 'حصلت على روابط وأدلة الخدمات المهمة.' }
    ]
  }
};

// Campus survey answers stored per-station
if (!window.campusSurveyAnswers) window.campusSurveyAnswers = {};

function loadCampusSurveyProgress() {
  try {
    const saved = localStorage.getItem('uoh_campus_survey_v1');
    if (saved) window.campusSurveyAnswers = JSON.parse(saved);
  } catch(e) {}
}

function saveCampusSurveyProgress() {
  try {
    localStorage.setItem('uoh_campus_survey_v1', JSON.stringify(window.campusSurveyAnswers));
  } catch(e) {}
  saveExpeditionProgress();
}

// ─── Save & Load In-Person Expedition Progress (Stations, Workshops, Points) ───
function saveExpeditionProgress() {
  const effectiveId = (typeof APP !== 'undefined' && APP.journeyStudentId) || localStorage.getItem('uhb_student_id') || localStorage.getItem('uhb_last_student_id') || 'guest_student';
  const completedStations = {};
  Object.keys(EXPEDITION_STATIONS_DATA).forEach(id => {
    if (EXPEDITION_STATIONS_DATA[id].completed) {
      completedStations[id] = true;
    }
  });

  const completedWorkshops = {};
  for (let i = 1; i <= 9; i++) {
    const row = document.getElementById(`ws-row-${i}`);
    if (row && (row.classList.contains('is-done') || row.classList.contains('is-completed'))) {
      completedWorkshops[i] = true;
    }
  }

  const payload = {
    points: expeditionTotalPoints,
    stations: completedStations,
    workshops: completedWorkshops,
    surveys: window.campusSurveyAnswers || {},
    lastSaved: new Date().toISOString()
  };

  try {
    localStorage.setItem('uoh_expedition_progress_' + effectiveId, JSON.stringify(payload));
    localStorage.setItem('uoh_expedition_progress_latest', JSON.stringify(payload));
  } catch(e) {
    console.error('Failed to save expedition progress:', e);
  }
}

function loadExpeditionProgress() {
  loadCampusSurveyProgress();
  const effectiveId = (typeof APP !== 'undefined' && APP.journeyStudentId) || localStorage.getItem('uhb_student_id') || localStorage.getItem('uhb_last_student_id') || 'guest_student';
  try {
    const raw = localStorage.getItem('uoh_expedition_progress_' + effectiveId) || localStorage.getItem('uoh_expedition_progress_latest');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data) return;

    if (typeof data.points === 'number') {
      expeditionTotalPoints = data.points;
    }

    if (data.stations) {
      Object.keys(data.stations).forEach(id => {
        if (EXPEDITION_STATIONS_DATA[id]) {
          EXPEDITION_STATIONS_DATA[id].completed = true;
          const node = document.getElementById(`map-node-${id}`);
          if (node) {
            node.classList.remove('is-unvisited', 'is-selected-destination');
            node.classList.add('is-completed');
            if (id === 'exit') node.classList.remove('is-locked');
            const sphere = node.querySelector('.u-node-sphere');
            if (sphere) {
              sphere.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:1.5rem;"></i>`;
              sphere.style.background = 'rgba(16, 185, 129, 0.12)';
              sphere.style.borderColor = '#10B981';
              sphere.style.color = '#059669';
            }
            const sub = node.querySelector('.u-node-sub');
            if (sub) {
              sub.textContent = id === 'reception' ? 'تم تأكيد الحضور ✅' : (id === 'exit' ? 'مكتمل ✅' : 'تم المسح ✅ (+10)');
              sub.style.color = '#059669';
            }
          }
        }
      });
    }

    if (data.workshops) {
      Object.keys(data.workshops).forEach(num => {
        const row = document.getElementById(`ws-row-${num}`);
        if (row) {
          row.classList.remove('is-unvisited');
          row.classList.add('is-done', 'is-completed');
          const badge = row.querySelector('.ws-card-reward-badge');
          if (badge) badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم الحضور ✅';
        }
      });
    }

    updateExpeditionPointsDisplay(expeditionTotalPoints);
  } catch(e) {
    console.error('Failed to load expedition progress:', e);
  }
}

function isSurveyComplete(stationId) {
  const survey = STATION_SURVEY_MAP[stationId];
  if (!survey) return true;
  const answers = window.campusSurveyAnswers[stationId] || {};
  return survey.items.every(item => answers[item.id] === true);
}

function setSurveyAnswer(stationId, itemId, val) {
  if (!window.campusSurveyAnswers[stationId]) window.campusSurveyAnswers[stationId] = {};
  window.campusSurveyAnswers[stationId][itemId] = val;
  saveCampusSurveyProgress();

  // Re-render the survey to reflect visual state
  renderCenterSurvey(stationId);

  // Check if all answered yes -> reveal camera
  checkSurveyAndRevealCamera(stationId);
}
window.setSurveyAnswer = setSurveyAnswer;

function toggleSurveyCheckbox(stationId, itemId) {
  if (!window.campusSurveyAnswers[stationId]) window.campusSurveyAnswers[stationId] = {};
  const current = window.campusSurveyAnswers[stationId][itemId];
  setSurveyAnswer(stationId, itemId, !current);
}

function checkSurveyAndRevealCamera(stationId) {
  const survey = STATION_SURVEY_MAP[stationId];
  if (!survey) return;
  const answers = window.campusSurveyAnswers[stationId] || {};
  const total = survey.items.length;
  const yesCount = survey.items.filter(i => answers[i.id] === true).length;

  // Update progress bar
  const fill = document.getElementById('campus-survey-prog-fill');
  const txt = document.getElementById('campus-survey-prog-text');
  const pct = Math.round((yesCount / total) * 100);
  if (fill) fill.style.width = `${pct}%`;
  if (txt) txt.textContent = `${yesCount} من ${total} مؤكدة`;

  // Show/hide camera button
  const cameraSection = document.getElementById('campus-survey-camera-section');
  
  if (yesCount === total) {
    if (cameraSection) {
      cameraSection.classList.add('visible');
      cameraSection.style.display = 'block';
    }
    // Special: exit door has no camera, show completion
    if (stationId === 'exit') {
      if (cameraSection) cameraSection.innerHTML = `
        <div style="text-align:center; padding:24px;">
          <div style="font-size:3rem; margin-bottom:12px;">🎉</div>
          <h3 style="color:#10B981; font-weight:800; margin-bottom:8px;">أحسنت! أنت جاهز للانطلاق</h3>
          <p style="color:#6B5B50; font-size:0.95rem;">أكملت جميع بنود الجاهزية بنجاح — حظاً موفقاً في مسيرتك الجامعية!</p>
        </div>
      `;
      EXPEDITION_STATIONS_DATA.exit.completed = true;
      const exitNode = document.getElementById('map-node-exit');
      if (exitNode) {
        exitNode.classList.remove('is-unvisited', 'is-selected-destination', 'is-locked');
        exitNode.classList.add('is-completed');
        const sphere = exitNode.querySelector('.u-node-sphere');
        if (sphere) {
          sphere.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size:1.5rem;"></i>';
          sphere.style.background = 'rgba(16, 185, 129, 0.12)';
          sphere.style.borderColor = '#10B981';
          sphere.style.color = '#059669';
        }
        const sub = exitNode.querySelector('.u-node-sub');
        if (sub) { sub.textContent = 'مكتمل ✅'; sub.style.color = '#059669'; }
      }
      updateExpeditionPointsDisplay(expeditionTotalPoints);
      saveExpeditionProgress();
      if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 }, colors: ['#F3C649', '#BC8859', '#7A2416', '#22C55E'] });
      }
      fireExpeditionToast('🏆 أحسنت! أكملت استبيان المغادرة بنجاح — حظاً موفقاً!', 'fa-solid fa-trophy');
    } else {
      playExpeditionAudioChime('success');
      fireExpeditionToast('أحسنت! أكملت جميع بنود الاستبيان ✅', 'fa-solid fa-circle-check');
    }
  } else {
    if (cameraSection) {
      cameraSection.classList.remove('visible');
      cameraSection.style.display = 'none';
    }
  }
}

function renderCenterSurvey(stationId) {
  hideSchedulePanel(); // Hide schedule when showing survey
  const station = EXPEDITION_STATIONS_DATA[stationId];
  const survey = STATION_SURVEY_MAP[stationId];
  const heroCenter = document.getElementById('hero-center-content');
  if (!heroCenter || !station) return;

  const answers = window.campusSurveyAnswers[stationId] || {};
  const total = survey ? survey.items.length : 0;
  const yesCount = survey ? survey.items.filter(i => answers[i.id] === true).length : 0;
  const pct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
  const allDone = yesCount === total && total > 0;

  // Update outer hero titles
  const heroTitle = document.getElementById('heroStationTitleText');
  if (heroTitle) heroTitle.style.display = 'none';
  const heroLead = document.getElementById('heroLeadHint');
  if (heroLead) heroLead.style.display = 'none';
  const heroTag = document.querySelector('.hero-tag-badge');
  if (heroTag) heroTag.style.display = 'none';
  const heroBounty = document.getElementById('heroBountyChip');
  if (heroBounty) heroBounty.style.display = 'none';

  let html = `
    <div class="campus-survey-container" id="campusSurveyContainer">
      
      <!-- Sleek Compact Header (بدون حشو زائد ومباشر للأسئلة) -->
      <div class="survey-compact-topbar">
        <div class="survey-topbar-right">
          <div class="survey-topbar-icon"><i class="${survey ? survey.icon : station.icon}"></i></div>
          <div>
            <h3 class="survey-topbar-title">${survey ? survey.title : station.fullName}</h3>
            <span class="survey-topbar-sub">${station.desc}</span>
          </div>
        </div>
        <div class="survey-topbar-badge ${allDone ? 'is-complete' : ''}" id="campus-survey-prog-text">
          ${allDone ? '<i class="fa-solid fa-circle-check"></i> مكتمل ✅' : `${yesCount} من ${total} مؤكدة`}
        </div>
      </div>

      <!-- Slim Progress Line -->
      <div class="campus-survey-prog-track" style="margin: 8px 0 14px 0; height:8px;">
        <div class="campus-survey-prog-fill" id="campus-survey-prog-fill" style="width:${pct}%"></div>
      </div>

      <div class="campus-survey-items" id="campus-survey-items-section">
  `;

  if (survey) {
    survey.items.forEach((item, idx) => {
      const currentAns = answers[item.id];
      const isYes = currentAns === true;
      const isNo = currentAns === false;
      const cardClass = isYes ? 'answered-yes' : (isNo ? 'answered-no' : '');

      html += `
        <div class="survey-q-card ${cardClass}" id="survey-q-${item.id}">
          <div class="survey-q-header">
            <span class="survey-q-num">${idx + 1}</span>
            <p class="survey-q-text">${item.text}</p>
          </div>
          <div class="survey-q-actions">
            <button type="button" class="survey-choice-btn btn-yes ${isYes ? 'selected' : ''}" 
                    onclick="setSurveyAnswer('${stationId}', '${item.id}', true)">
              <i class="fa-solid fa-circle-check"></i>
              <span>نعم</span>
            </button>
            <button type="button" class="survey-choice-btn btn-no ${isNo ? 'selected' : ''}" 
                    onclick="setSurveyAnswer('${stationId}', '${item.id}', false)">
              <i class="fa-solid fa-circle-xmark"></i>
              <span>لا</span>
            </button>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;

  // Camera section (hidden until all checked yes)
  const isExit = stationId === 'exit';
  if (isExit && allDone) {
    html += `
      <div class="campus-survey-camera-section visible" id="campus-survey-camera-section" style="display:block;">
        <div style="text-align:center; padding:24px;">
          <div style="font-size:3rem; margin-bottom:12px;">🎉</div>
          <h3 style="color:#10B981; font-weight:800; margin-bottom:8px;">أحسنت! أنت جاهز للانطلاق</h3>
          <p style="color:#6B5B50; font-size:0.95rem;">أكملت جميع بنود الجاهزية بنجاح</p>
        </div>
      </div>
    `;
  } else if (!isExit) {
    html += `
      <div class="campus-survey-camera-section ${allDone ? 'visible' : ''}" id="campus-survey-camera-section" style="display:${allDone ? 'block' : 'none'};">
        <div class="campus-camera-unlock-msg">
          <i class="fa-solid fa-unlock" style="color:#10B981; font-size:1.2rem;"></i>
          <span>تم إكمال الاستبيان بنجاح! افتح الكاميرا الآن 🎉</span>
        </div>
        <button class="campus-survey-scan-btn" onclick="openActiveScannerModal()">
          <i class="fa-solid fa-camera"></i>
          <span>افتح الكاميرا وامسح الباركود الآن واكسب +${station.pts} نقاط 🔥</span>
        </button>
      </div>
    `;
  }

  html += `</div>`;
  heroCenter.innerHTML = html;
}

function openCampusExpoView(e) {
  if (e) e.preventDefault();
  openCampusMap(e);
}
window.openCampusExpoView = openCampusExpoView;

function openCampusWorkshopsView(e) {
  if (e) e.preventDefault();
  ensureStudentIdentified(() => {
    document.getElementById('campus-dropdown')?.classList.remove('open');
    document.getElementById('journey-dropdown')?.classList.remove('open');
    document.getElementById('quiz-stations-dropdown')?.classList.remove('open');
    document.getElementById('nav-links')?.classList.remove('open');

    document.getElementById('glass-nav')?.classList.add('nav-hidden');
    document.body.classList.add('campus-active');

    loadCampusProgress();
    loadExpeditionProgress();

    const wsEl = document.getElementById('campus-workshops-fullscreen');
    if (wsEl) {
      wsEl.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    const pointsEl = document.getElementById('ws-stat-points-num');
    if (pointsEl) pointsEl.textContent = `${expeditionTotalPoints} نقطة`;

    syncStandaloneWorkshopsVisuals();
  });
}
window.openCampusWorkshopsView = openCampusWorkshopsView;

function closeCampusWorkshopsView() {
  // Close any open workshop scanner modal
  if (typeof closeWsScanner === 'function') closeWsScanner();
  const wsEl = document.getElementById('campus-workshops-fullscreen');
  if (wsEl) wsEl.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('glass-nav')?.classList.remove('nav-hidden');
  document.body.classList.remove('campus-active');
}
window.closeCampusWorkshopsView = closeCampusWorkshopsView;

function filterWorkshopsTimeline(day, btn) {
  const groups = document.querySelectorAll('.ws-timeline-day-group');
  const btns = document.querySelectorAll('.ws-filter-chip');
  btns.forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  groups.forEach(group => {
    if (day === 'all') {
      group.style.display = '';
    } else {
      const groupDay = group.getAttribute('data-day');
      if (groupDay === day) {
        group.style.display = '';
      } else {
        group.style.display = 'none';
      }
    }
  });
}
window.filterWorkshopsTimeline = filterWorkshopsTimeline;

function syncStandaloneWorkshopsVisuals() {
  const effectiveId = (typeof APP !== 'undefined' && APP.journeyStudentId) || localStorage.getItem('uhb_student_id') || localStorage.getItem('uhb_last_student_id') || 'guest_student';
  try {
    const raw = localStorage.getItem('uoh_expedition_progress_' + effectiveId) || localStorage.getItem('uoh_expedition_progress_latest');
    let doneCount = 0;
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.workshops) {
        const keys = Object.keys(data.workshops);
        doneCount = keys.length;
        keys.forEach(num => {
          const card = document.getElementById(`standalone-ws-${num}`);
          const btn = document.getElementById(`ws-btn-${num}`);
          if (card) {
            card.classList.add('is-done');
          }
          if (btn) {
            btn.classList.add('is-attended');
            btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>تم تسجيل الحضور بنجاح ✅</span>';
          }
        });
      }
    }

    const progressFill = document.getElementById('ws-timeline-progress-fill');
    const progressText = document.getElementById('ws-timeline-progress-text');
    const pointsText = document.getElementById('ws-timeline-points-text');
    if (progressFill) progressFill.style.width = `${Math.round((doneCount / 9) * 100)}%`;
    if (progressText) progressText.textContent = `${doneCount} من 9 ورش مكتملة`;
    if (pointsText) pointsText.textContent = `${doneCount * 5} / 45 نقطة`;
  } catch(e) {}
}
window.syncStandaloneWorkshopsVisuals = syncStandaloneWorkshopsVisuals;

function renderCenterCamera(stationId) {
  hideSchedulePanel();
  const station = EXPEDITION_STATIONS_DATA[stationId];
  const heroCenter = document.getElementById('hero-center-content');
  if (!heroCenter || !station) return;

  const isReception = stationId === 'reception';
  const btnLabel = isReception 
    ? 'افتح الكاميرا وامسح الباركود لتأكيد حضورك واستلام الحقيبة 🎁'
    : (station.pts > 0 ? `افتح الكاميرا وامسح QR الآن واكسب +${station.pts} نقاط 🔥` : 'افتح الكاميرا وامسح QR الآن 📷');

  heroCenter.innerHTML = `
    <div class="campus-survey-container">
      <div class="survey-compact-topbar">
        <div class="survey-topbar-right">
          <div class="survey-topbar-icon"><i class="${station.icon}"></i></div>
          <div>
            <h3 class="survey-topbar-title">${station.fullName}</h3>
            <span class="survey-topbar-sub">${station.desc}</span>
          </div>
        </div>
        <div class="survey-topbar-badge ${station.completed ? 'is-complete' : ''}">
          ${station.completed ? '<i class="fa-solid fa-circle-check"></i> تم التأكيد ✅' : (isReception ? '🎁 الحقيبة الترحيبية' : `+${station.pts} نقاط`)}
        </div>
      </div>
      <div class="campus-survey-camera-section visible" id="campus-survey-camera-section" style="display:block; padding: 20px 0 10px 0;">
        <button class="campus-survey-scan-btn" onclick="openActiveScannerModal()">
          <i class="fa-solid fa-camera"></i>
          <span>${btnLabel}</span>
        </button>
      </div>
    </div>
  `;
}

let currentExpeditionStationId = 'affairs';
let expeditionTotalPoints = 0;
let expeditionCameraStream = null;

// Load survey on init
loadCampusSurveyProgress();

function triggerStationScan(stationId) {
  // Exit door: check if all other stations completed
  if (stationId === 'exit') {
    const surveyStations = ['affairs', 'admission', 'elearn', 'colleges'];
    const allDone = surveyStations.every(id => EXPEDITION_STATIONS_DATA[id].completed);
    if (!allDone) {
      fireExpeditionToast('يرجى إكمال استبيان باقي الأركان لكي يفتح لك باب المغادرة', 'fa-solid fa-lock');
      return;
    }
  }

  selectExpeditionStation(stationId);
  
  const station = EXPEDITION_STATIONS_DATA[stationId];
  if (station.hasSurvey) {
    renderCenterSurvey(stationId);
  } else {
    renderCenterCamera(stationId);
  }

  // Smoothly scroll to the survey on mobile and highlight
  setTimeout(() => {
    const target = document.getElementById('hero-center-content') || document.getElementById('heroStationTitleText');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const box = document.getElementById('campusSurveyContainer') || target;
      box.classList.add('survey-focus-pulse');
      setTimeout(() => box.classList.remove('survey-focus-pulse'), 1200);
    }
  }, 100);
}

function selectExpeditionStation(stationId) {
  currentExpeditionStationId = stationId;
  const station = EXPEDITION_STATIONS_DATA[stationId];
  playExpeditionAudioChime('select');

  Object.keys(EXPEDITION_STATIONS_DATA).forEach(id => {
    const node = document.getElementById(`map-node-${id}`);
    if (!node) return;
    node.classList.remove('is-selected-destination');
    if (id === stationId) {
      node.classList.add('is-selected-destination');
    }
  });

  const titleEl = document.getElementById('heroStationTitleText');
  const bountyEl = document.getElementById('heroBountyChip');
  const ctaBtn = document.getElementById('heroMasterCtaBtn');
  const ctaLbl = document.getElementById('heroCtaButtonLabel');
  const podiumIcon = document.getElementById('heroPodiumIcon');
  const statusTag = document.getElementById('heroStatusBadgeTag');

  if (titleEl) titleEl.textContent = station.fullName;
  if (bountyEl) bountyEl.innerHTML = `<i class="fa-solid fa-star"></i> +${station.pts} نقاط`;
  if (podiumIcon) podiumIcon.className = station.icon;

  if (station.completed) {
    if (statusTag) statusTag.textContent = 'محطة مكتملة ✓';
    if (ctaLbl) ctaLbl.textContent = `تم إكمال هذا الركن مسبقاً (+${station.pts} نقاط) ✅`;
    if (ctaBtn) ctaBtn.style.opacity = '0.85';
  } else {
    if (statusTag) statusTag.textContent = 'وجهتك المحددة الآن 🎯';
    if (ctaLbl) ctaLbl.textContent = station.hasSurvey ? 'أكمل الاستبيان أولاً ثم امسح الباركود' : `افتح الكاميرا وامسح QR الآن واكسب +${station.pts} نقاط 🔥`;
    if (ctaBtn) ctaBtn.style.opacity = '1';
  }
}

function triggerWorkshopScan(num, name, isDone) {
  try { playExpeditionAudioChime('select'); } catch(e) {}
  if (isDone) {
    fireExpeditionToast(`✅ تم حضور ورشة (${name}) مسبقاً`, 'fa-solid fa-circle-check');
    return;
  }

  // ── Create a self-contained scanner modal INSIDE the workshops container ──
  const wsContainer = document.getElementById('campus-workshops-fullscreen');
  const parent = wsContainer || document.body;

  // Remove any existing workshop scanner modal
  const existingModal = document.getElementById('wsQrScannerOverlay');
  if (existingModal) existingModal.remove();

  // Create the modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'wsQrScannerOverlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(6, 2, 4, 0.92);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px; opacity: 0;
    transition: opacity 0.3s ease;
  `;
  overlay.onclick = function(e) {
    if (e.target === overlay) closeWsScanner();
  };

  overlay.innerHTML = `
    <div style="
      width: 100%; max-width: 440px;
      background: linear-gradient(145deg, rgba(28, 9, 14, 0.98), rgba(14, 4, 7, 0.98));
      border: 2px solid #D4A359;
      border-radius: 28px;
      padding: 24px 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85), 0 0 45px rgba(243, 198, 73, 0.35);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 14px; position: relative;
      transform: scale(0.9) translateY(20px);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    " id="wsModalBox">
      <button onclick="closeWsScanner()" style="
        position: absolute; top: 16px; left: 16px;
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
        color: #D8CFC8; font-size: 0.95rem;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 10;
      "><i class="fa-solid fa-xmark"></i></button>

      <div style="
        width: 64px; height: 64px; border-radius: 50%;
        background: linear-gradient(135deg, #D4A359, #C59040);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 30px rgba(212, 163, 89, 0.5);
      ">
        <i class="fa-solid fa-camera" style="font-size: 1.5rem; color: #1C0A06;"></i>
      </div>

      <div style="text-align: center;">
        <h3 style="color: #F5EEE6; font-size: 1.15rem; font-weight: 800; margin: 0;">ورشة ${num}: ${name}</h3>
        <p style="color: #BEB0A3; font-size: 0.85rem; margin: 6px 0 0 0;">وجّه الكاميرا نحو باركود الورشة لتسجيل حضورك وكسب +5 نقاط</p>
      </div>

      <div style="
        padding: 6px 16px; border-radius: 999px;
        background: linear-gradient(135deg, rgba(212,163,89,0.15), rgba(197,144,64,0.1));
        border: 1px solid rgba(212,163,89,0.4); color: #D4A359;
        font-size: 0.82rem; font-weight: 700;
      "><i class="fa-solid fa-star"></i> المكافأة: +5 نقاط</div>

      <div style="
        width: 100%; aspect-ratio: 4/3; border-radius: 16px;
        overflow: hidden; position: relative;
        background: #0A0305; border: 2px solid rgba(212,163,89,0.3);
      ">
        <video id="wsLiveVideo" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; display:none;"></video>
        <div class="camera-viewfinder-brackets" style="position:absolute; inset:0; pointer-events:none;"></div>
        <div class="laser-line-runner" style="position:absolute; left:10%; right:10%; height:2px;"></div>
        <div id="wsFallbackUI" style="
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:12px; color:#BEB0A3;
        ">
          <i class="fa-solid fa-camera" style="font-size:2rem; opacity:0.5;"></i>
          <span style="font-size:0.85rem;">وجّه كاميرا هاتفك نحو رمز QR لإتمام المسح</span>
        </div>
      </div>

      <button id="wsScanBtn" onclick="wsManualScanAttempt()" style="
        width: 100%; padding: 14px 20px; border-radius: 14px;
        background: linear-gradient(135deg, #882D1B, #A33625);
        border: 1.5px solid rgba(212,163,89,0.4); color: #FFF;
        font-size: 0.95rem; font-weight: 700; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: all 0.2s;
      ">
        <i class="fa-solid fa-qrcode"></i>
        <span id="wsScanBtnLabel">وجّه الكاميرا نحو باركود الورشة 📷</span>
      </button>
    </div>
  `;

  parent.appendChild(overlay);

  // Set workshop scan context
  window.activeModalContext = { type: 'workshop', num, name, pts: 5 };
  window._wsQrScanActive = false;

  // Animate in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    const box = document.getElementById('wsModalBox');
    if (box) box.style.transform = 'scale(1) translateY(0)';
  });

  // Start camera
  startWsCameraFeed();
}

// ── Workshop Camera Feed (independent from stations) ──
let _wsCameraStream = null;

async function startWsCameraFeed() {
  const videoEl = document.getElementById('wsLiveVideo');
  const fallbackEl = document.getElementById('wsFallbackUI');
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      _wsCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (videoEl) {
        videoEl.srcObject = _wsCameraStream;
        videoEl.style.display = 'block';
      }
      if (fallbackEl) fallbackEl.style.display = 'none';
      window._wsQrScanActive = true;
      scanWsQRFromVideo();
    }
  } catch (err) {
    console.warn('Workshop camera error:', err);
    if (videoEl) videoEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'flex';
  }
}

function stopWsCameraFeed() {
  window._wsQrScanActive = false;
  if (_wsCameraStream) {
    _wsCameraStream.getTracks().forEach(t => t.stop());
    _wsCameraStream = null;
  }
  const videoEl = document.getElementById('wsLiveVideo');
  if (videoEl) { videoEl.srcObject = null; videoEl.style.display = 'none'; }
}

function closeWsScanner() {
  stopWsCameraFeed();
  const overlay = document.getElementById('wsQrScannerOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }
}
window.closeWsScanner = closeWsScanner;

// ── Workshop QR Scanning Loop ──
function scanWsQRFromVideo() {
  if (!window._wsQrScanActive) return;
  const videoEl = document.getElementById('wsLiveVideo');
  if (!videoEl || videoEl.readyState < 2) {
    setTimeout(scanWsQRFromVideo, 300);
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx2d = canvas.getContext('2d');
  ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);

  if (typeof jsQR === 'function') {
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      window._wsQrScanActive = false;
      handleScannedQR(code.data.trim());
      return;
    }
  }
  if (window._wsQrScanActive) {
    setTimeout(scanWsQRFromVideo, 300);
  }
}

// ── Workshop Manual Scan Attempt ──
function wsManualScanAttempt() {
  const btn = document.getElementById('wsScanBtn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري البحث عن الباركود...</span>';

  const videoEl = document.getElementById('wsLiveVideo');
  if (videoEl && videoEl.readyState >= 2 && typeof jsQR === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx2d = canvas.getContext('2d');
    ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      window._wsQrScanActive = false;
      handleScannedQR(code.data.trim());
      return;
    }
  }

  setTimeout(() => {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> <span>لم يُكتشف باركود — وجّه الكاميرا وحاول مرة أخرى</span>';
    }
    fireExpeditionToast('📷 لم يُكتشف باركود — تأكد أن الكاميرا موجهة نحو الباركود الصحيح', 'fa-solid fa-camera-rotate');
    window._wsQrScanActive = true;
    scanWsQRFromVideo();
  }, 1200);
}
window.wsManualScanAttempt = wsManualScanAttempt;


function openActiveScannerModal() {
  const station = EXPEDITION_STATIONS_DATA[currentExpeditionStationId];
  const modal = document.getElementById('expeditionModalOverlay');
  if (!modal || !station) return;

  const title = document.getElementById('modalStationTitle');
  const desc = document.getElementById('modalStationDesc');
  const reward = document.getElementById('modalRewardBadge');
  const icon = document.getElementById('modalHeroIcon');
  const btn = document.getElementById('modalConfirmScanBtn');
  const btnLbl = document.getElementById('modalConfirmBtnLabel');

  if (title) title.textContent = station.fullName;
  if (desc) desc.textContent = station.desc;
  if (reward) reward.innerHTML = `<i class="fa-solid fa-star"></i> المكافأة: +${station.pts} نقاط`;
  if (icon) icon.className = 'fa-solid fa-camera';

  if (station.completed) {
    if (btnLbl) btnLbl.textContent = 'تم إكمال هذه المحطة مسبقاً ✅';
    if (btn) btn.style.opacity = '0.7';
  } else {
    if (btnLbl) btnLbl.textContent = `وجّه الكاميرا نحو باركود (${station.name}) 📷`;
    if (btn) btn.style.opacity = '1';
  }

  window.activeModalContext = { type: 'station', stationId: station.id, pts: station.pts };
  modal.classList.add('active');
  playExpeditionAudioChime('success');
  startExpeditionCameraFeed();
}

function closeExpeditionModal() {
  const modal = document.getElementById('expeditionModalOverlay');
  if (modal) modal.classList.remove('active');
  stopExpeditionCameraFeed();
}

function closeModalOnBackdrop(e) {
  if (e && e.target && e.target.id === 'expeditionModalOverlay') closeExpeditionModal();
}

async function startExpeditionCameraFeed() {
  const videoEl = document.getElementById('cameraLiveVideo');
  const fallbackEl = document.getElementById('cameraFallbackUI');
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      expeditionCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (videoEl) {
        videoEl.srcObject = expeditionCameraStream;
        videoEl.style.display = 'block';
      }
      if (fallbackEl) fallbackEl.style.display = 'none';

      // Start continuous QR scanning loop
      window._qrScanActive = true;
      scanQRFromVideo();
    }
  } catch (err) {
    if (videoEl) videoEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'flex';
  }
}

function stopExpeditionCameraFeed() {
  window._qrScanActive = false;
  if (expeditionCameraStream) {
    expeditionCameraStream.getTracks().forEach(track => track.stop());
    expeditionCameraStream = null;
  }
  const videoEl = document.getElementById('cameraLiveVideo');
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.style.display = 'none';
  }
  const fallbackEl = document.getElementById('cameraFallbackUI');
  if (fallbackEl) fallbackEl.style.display = 'flex';
}

// ─── Real QR Scanning from Camera Feed ────────────────────
function scanQRFromVideo() {
  if (!window._qrScanActive) return;
  const videoEl = document.getElementById('cameraLiveVideo');
  if (!videoEl || videoEl.readyState < 2) {
    setTimeout(scanQRFromVideo, 300);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx2d = canvas.getContext('2d');
  ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);

  // Use jsQR if available
  if (typeof jsQR === 'function') {
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      window._qrScanActive = false;
      handleScannedQR(code.data.trim());
      return;
    }
  }

  // Continue scanning
  if (window._qrScanActive) {
    setTimeout(scanQRFromVideo, 300);
  }
}

function handleScannedQR(scannedCode) {
  const ctx = window.activeModalContext;
  if (!ctx) { closeExpeditionModal(); return; }

  // Detect which modal is active: workshop or station
  const isWorkshop = ctx.type === 'workshop';
  const btn = isWorkshop
    ? document.getElementById('wsScanBtn')
    : document.getElementById('modalConfirmScanBtn');
  const closeFn = isWorkshop ? closeWsScanner : closeExpeditionModal;
  const resumeScanFn = isWorkshop ? scanWsQRFromVideo : scanQRFromVideo;
  const scanActiveKey = isWorkshop ? '_wsQrScanActive' : '_qrScanActive';

  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#D3B48B;"></i> <span>جاري التحقق من صحة الباركود...</span>`;
    btn.style.background = 'linear-gradient(135deg, #1C0A06, #2D0F08)';
  }

  // Determine expected QR code
  let expectedCode = '';
  let expectedName = '';
  if (ctx.type === 'station') {
    expectedCode = QR_CODE_MAP[ctx.stationId] || '';
    expectedName = EXPEDITION_STATIONS_DATA[ctx.stationId]?.name || ctx.stationId;
  } else if (ctx.type === 'workshop') {
    expectedCode = QR_CODE_MAP[`ws-${ctx.num}`] || '';
    expectedName = ctx.name;
  }

  setTimeout(() => {
    if (scannedCode === expectedCode) {

      let alreadyDone = false;
      if (ctx.type === 'station') {
        alreadyDone = EXPEDITION_STATIONS_DATA[ctx.stationId]?.completed === true;
      } else if (ctx.type === 'workshop') {
        const row = document.getElementById(`ws-row-${ctx.num}`);
        alreadyDone = row && (row.classList.contains('is-done') || row.classList.contains('is-completed'));
      }

      if (alreadyDone) {
        if (btn) {
          btn.innerHTML = `<i class="fa-solid fa-circle-info" style="color:#fff;"></i> <span>سبق لك مسح هذا الباركود — (${expectedName}) مكتمل ✅</span>`;
          btn.style.background = 'linear-gradient(135deg, #0369A1, #0284C7)';
        }
        fireExpeditionToast(`ℹ️ سبق لك إتمام مسح باركود (${expectedName}) من قبل — لا حاجة لإعادة المسح`, 'fa-solid fa-circle-info');
        setTimeout(() => { closeFn(); }, 2000);
        return;
      }

      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#fff;"></i> <span>تم التحقق بنجاح! (+${ctx.pts} نقاط) ✅</span>`;
        btn.style.background = 'linear-gradient(135deg, #059669, #10B981)';
      }
      playExpeditionAudioChime('unlock');
      fireExpeditionToast(`✅ تم التحقق من باركود (${expectedName}) بنجاح!`, 'fa-solid fa-circle-check');

      setTimeout(() => {
        closeFn();
        completeScannedItem(ctx);
      }, 700);
    } else {
      const scannedItem = QR_REVERSE_MAP[scannedCode];
      if (scannedItem) {
        if (btn) {
          btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#fff;"></i> <span>هذا باركود (${scannedItem.name}) — اذهب إلى ركن (${expectedName}) 📍</span>`;
          btn.style.background = 'linear-gradient(135deg, #D97706, #B45309)';
        }
        fireExpeditionToast(`⚠️ باركود خطأ! هذا باركود (${scannedItem.name})، يرجى مسح باركود (${expectedName})`, 'fa-solid fa-location-dot');
      } else {
        if (btn) {
          btn.innerHTML = '<i class="fa-solid fa-xmark"></i> <span>باركود غير معتمد — حاول مرة أخرى</span>';
          btn.style.background = 'linear-gradient(135deg, #DC2626, #991B1B)';
        }
        fireExpeditionToast('❌ باركود غير معتمد — وجّه الكاميرا نحو باركود الركن الرسمي', 'fa-solid fa-ban');
      }
      setTimeout(() => {
        window[scanActiveKey] = true;
        resumeScanFn();
        if (btn) {
          btn.innerHTML = `<i class="fa-solid fa-camera"></i> <span>وجّه الكاميرا نحو الباركود...</span>`;
          btn.style.background = '';
        }
      }, 2500);
    }
  }, 400);
}


function completeScannedItem(ctx) {
  if (ctx.type === 'station') {
    const station = EXPEDITION_STATIONS_DATA[ctx.stationId];
    if (station && !station.completed) {
      station.completed = true;
      expeditionTotalPoints += ctx.pts;

      const node = document.getElementById(`map-node-${ctx.stationId}`);
      if (node) {
        node.classList.remove('is-unvisited', 'is-selected-destination');
        node.classList.add('is-completed');
        const sphere = node.querySelector('.u-node-sphere');
        if (sphere) {
          sphere.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:1.5rem;"></i>`;
          sphere.style.background = 'rgba(16, 185, 129, 0.12)';
          sphere.style.borderColor = '#10B981';
          sphere.style.color = '#059669';
        }
        const sub = node.querySelector('.u-node-sub');
        if (sub) {
          sub.textContent = ctx.stationId === 'reception' ? 'تم تأكيد الحضور ✅' : (ctx.stationId === 'exit' ? 'مكتمل ✅' : 'تم المسح ✅ (+10)');
          sub.style.color = '#059669';
        }
      }

      updateExpeditionPointsDisplay(expeditionTotalPoints);
      saveExpeditionProgress();
      playExpeditionAudioChime('unlock');
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 95,
          spread: 80,
          origin: { y: 0.55 },
          colors: ['#BC8859', '#F3C649', '#7A2416', '#FEFEFE']
        });
      }
      // Server-Side Zero-Loss Atomic Sync
      const effectiveId = getEffectiveStudentId();
      if (effectiveId && effectiveId !== 'guest_student') {
        const officialCode = QR_CODE_MAP[ctx.stationId] || ctx.stationId;
        const officialName = station ? (station.fullName || station.name) : ctx.stationId;
        fetch('/api/student/qr/scan', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            student_id: effectiveId,
            booth_code: officialCode,
            booth_name: officialName,
            points: ctx.pts || 10
          })
        }).then(r => r.json()).then(d => {
          if (d.success) {
            console.log('[QR Sync] Saved to DB:', d);
            updateStudentBadgeUI();
          }
        }).catch(e => console.warn('[QR Sync Error]:', e));
      }

      if (ctx.stationId === 'reception') {
        fireExpeditionToast(`🎉 مرحباً بك! تم تأكيد حضورك واستلام الحقيبة الترحيبية بنجاح 🎁`, 'fa-solid fa-gift');
      } else {
        fireExpeditionToast(`🎉 تم إنجاز ركن (${station.name}) بنجاح! كسبت +${ctx.pts} نقاط!`, 'fa-solid fa-trophy');
      }
    } else {
      fireExpeditionToast(`ℹ️ سبق لك إتمام مسح ركن (${station ? station.name : ''}) من قبل`, 'fa-solid fa-circle-info');
    }
  } else if (ctx.type === 'workshop') {
    const row = document.getElementById(`ws-row-${ctx.num}`);
    const standaloneCard = document.getElementById(`standalone-ws-${ctx.num}`);
    const standaloneBtn = document.getElementById(`ws-btn-${ctx.num}`);
    const isAlreadyDone = (row && row.classList.contains('is-done')) || (standaloneCard && standaloneCard.classList.contains('is-done'));

    if (!isAlreadyDone) {
      if (row) {
        row.classList.remove('is-unvisited');
        row.classList.add('is-done', 'is-completed');
        const badge = row.querySelector('.ws-card-reward-badge');
        if (badge) badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم الحضور ✅';
      }
      if (standaloneCard) {
        standaloneCard.classList.add('is-done');
      }
      if (standaloneBtn) {
        standaloneBtn.classList.add('is-attended');
        standaloneBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>تم تسجيل الحضور بنجاح ✅</span>';
      }

      expeditionTotalPoints += ctx.pts;
      updateExpeditionPointsDisplay(expeditionTotalPoints);
      const wsPts = document.getElementById('ws-stat-points-num');
      if (wsPts) wsPts.textContent = `${expeditionTotalPoints} نقطة`;

      saveExpeditionProgress();

      // Server-Side Zero-Loss Atomic Sync for Workshop Attendance & QR Log
      const effectiveId = getEffectiveStudentId();
      if (effectiveId && effectiveId !== 'guest_student') {
        const wsCode = QR_CODE_MAP[`ws-${ctx.num}`] || `UOH-WS-0${ctx.num}`;
        const wsTitle = ctx.name || `ورشة ${ctx.num}`;
        const wsDay = ctx.day || (ctx.num <= 3 ? 1 : (ctx.num <= 6 ? 2 : 3));
        
        fetch('/api/student/workshop/attend', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            student_id: effectiveId,
            workshop_id: wsCode,
            workshop_title: wsTitle,
            day_number: wsDay,
            points: ctx.pts || 5
          })
        }).then(r => r.json()).then(d => {
          if (d.success) {
            console.log('[Workshop Sync] Saved to DB:', d);
            updateStudentBadgeUI();
          }
        }).catch(e => console.warn('[Workshop Sync Error]:', e));

        // Also record QR scan so it reflects on the QR analytics table
        fetch('/api/student/qr/scan', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            student_id: effectiveId,
            booth_code: wsCode,
            booth_name: wsTitle,
            points: 0
          })
        }).catch(e => {});
      }

      playExpeditionAudioChime('unlock');
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.75 },
          colors: ['#F3C649', '#BC8859', '#FEFEFE']
        });
      }
      fireExpeditionToast(`🎖️ تم تسجيل حضور ورشة 0${ctx.num} وكسب +${ctx.pts} نقاط!`, 'fa-solid fa-award');
    } else {
      fireExpeditionToast(`ℹ️ سبق لك تسجيل حضور هذه الورشة من قبل`, 'fa-solid fa-circle-info');
    }
  }
}

// Manual scan button fallback (when camera can't read QR automatically)
function executeScanRewardFlow() {
  const ctx = window.activeModalContext;
  if (!ctx) { closeExpeditionModal(); return; }

  const btn = document.getElementById('modalConfirmScanBtn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري البحث عن الباركود...</span>';

  // Try one more scan attempt, then close
  const videoEl = document.getElementById('cameraLiveVideo');
  if (videoEl && videoEl.readyState >= 2 && typeof jsQR === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx2d = canvas.getContext('2d');
    ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      window._qrScanActive = false;
      handleScannedQR(code.data.trim());
      return;
    }
  }

  // If no QR detected
  setTimeout(() => {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> <span>لم يُكتشف باركود — وجّه الكاميرا وحاول مرة أخرى</span>';
    }
    fireExpeditionToast('📷 لم يُكتشف باركود — تأكد أن الكاميرا موجهة نحو الباركود الصحيح', 'fa-solid fa-camera-rotate');
    // Resume auto-scanning
    window._qrScanActive = true;
    scanQRFromVideo();
  }, 1200);
}

function updateExpeditionPointsDisplay(newPts) {
  const pill = document.getElementById('pointsPillBadge');
  const txt = document.getElementById('stat-points-num');
  if (txt) txt.textContent = `${newPts} نقطة`;
  if (pill) {
    pill.classList.add('bump-pts');
    setTimeout(() => pill.classList.remove('bump-pts'), 400);
  }

  // Update Navbar Student Status Chip via proper total calculation
  if (typeof updateStudentBadgeUI === 'function') {
    updateStudentBadgeUI();
  }

  const totalStations = Object.keys(EXPEDITION_STATIONS_DATA).length;
  const completedCount = Object.values(EXPEDITION_STATIONS_DATA).filter(s => s.completed).length;
  const progressStat = document.getElementById('journeyProgressStat');
  if (progressStat) progressStat.textContent = `${completedCount} من ${totalStations} مكتملة`;
  const snippet = document.getElementById('heroProgressSnippet');
  if (snippet) snippet.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--green-success)"></i> ${completedCount} من ${totalStations} محطات مكتملة (بقيت ${totalStations - completedCount} محطات)`;

  // Unlock exit door if all 4 survey stations are completed
  const surveyStations = ['affairs', 'admission', 'elearn', 'colleges'];
  const allMainDone = surveyStations.every(id => EXPEDITION_STATIONS_DATA[id].completed);
  const exitNode = document.getElementById('map-node-exit');
  if (exitNode) {
    if (allMainDone) {
      exitNode.classList.remove('is-locked');
      const sub = exitNode.querySelector('.u-node-sub');
      if (sub) sub.textContent = 'أكمل استبيان الجاهزية';
      const lockIcon = exitNode.querySelector('.u-exit-lock-icon');
      if (lockIcon) lockIcon.innerHTML = '<i class="fa-solid fa-lock-open"></i>';
    }
  }
}

let _mwtTimer = null;
function showModernWelcomeToast(studentName, collegeName) {
  const modal = document.getElementById('modernWelcomeToast');
  const backdrop = document.getElementById('modernWelcomeToastBackdrop');
  const nameEl = document.getElementById('mwtStudentName');
  const collegeEl = document.getElementById('mwtCollegeText');
  const barEl = document.getElementById('mwtTimerBar');

  if (!modal || !backdrop) return;

  if (nameEl) nameEl.textContent = studentName || 'طالبنا العزيز';
  if (collegeEl) {
    const cleanCollege = String(collegeName || 'جامعة حفر الباطن').replace('🏛️', '').replace('كليتك:', '').trim();
    collegeEl.textContent = cleanCollege;
  }

  // Reset bar
  if (barEl) {
    barEl.style.transition = 'none';
    barEl.style.transform = 'scaleX(1)';
    setTimeout(() => {
      barEl.style.transition = 'transform 3.8s linear';
      barEl.style.transform = 'scaleX(0)';
    }, 60);
  }

  // Show
  backdrop.classList.add('active');
  modal.classList.add('active');

  // Play royal soft chime
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.35); // C6
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch(e) {}

  clearTimeout(_mwtTimer);
  _mwtTimer = setTimeout(() => {
    dismissModernWelcomeToast();
  }, 4000);
}

function dismissModernWelcomeToast() {
  clearTimeout(_mwtTimer);
  const modal = document.getElementById('modernWelcomeToast');
  const backdrop = document.getElementById('modernWelcomeToastBackdrop');
  if (modal) modal.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}
window.showModernWelcomeToast = showModernWelcomeToast;
window.dismissModernWelcomeToast = dismissModernWelcomeToast;

function fireToast(msg, icon = 'fa-solid fa-graduation-cap', duration = 3600) {
  const toast = document.getElementById('expeditionToast');
  if (!toast) return;

  const iconEl = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const subEl = document.getElementById('toastSub');
  const msgEl = document.getElementById('toastMsg');

  // Handle multi-line message (e.g. title \n subtitle)
  const lines = String(msg || '').split('\n');
  const mainTitle = lines[0] || '';
  let subText = lines.slice(1).join(' ').trim();

  if (iconEl) iconEl.className = icon;
  if (titleEl) titleEl.textContent = mainTitle;
  if (subEl) {
    if (subText) {
      subText = subText.replace('🏛️', '').replace('كليتك:', '').trim();
      subEl.innerHTML = `<i class="fa-solid fa-building-columns"></i> <span>${subText}</span>`;
      subEl.style.display = 'inline-flex';
    } else {
      subEl.style.display = 'none';
    }
  }
  if (msgEl) msgEl.textContent = msg;

  // Show luxury toast with smooth animation
  toast.classList.add('show');

  // Play subtle royal chime
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.25); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch(e) {}

  clearTimeout(window.expeditionToastTimer);
  window.expeditionToastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}
window.fireToast = fireToast;
window.fireExpeditionToast = fireToast;

function celebrateTrophyDome() {
  playExpeditionAudioChime('unlock');
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.55 },
      colors: ['#F3C649', '#BC8859', '#7A2416', '#FEFEFE', '#22C55E']
    });
  }
  fireExpeditionToast('🏆 وسام رواد 13 — تهانينا على إنجازك الأكاديمي الحافل!', 'fa-solid fa-trophy');
}


// ═══════════════════════════════════════════════════════
// AWARD TABS SWITCHING LOGIC
// ═══════════════════════════════════════════════════════
function switchAwardTab(index) {
    const btns = document.querySelectorAll('.award-tab-btn');
    const contents = document.querySelectorAll('.award-tab-content');
    
    btns.forEach((btn, i) => {
        if (i === index) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    contents.forEach((content, i) => {
        if (i === index) {
            content.classList.add('active');
            // Re-trigger animation
            content.style.animation = 'none';
            content.offsetHeight; /* trigger reflow */
            content.style.animation = null; 
        }
        else {
            content.classList.remove('active');
        }
    });
}
window.switchAwardTab = switchAwardTab;

// ═══ Question Image Modal (click to enlarge) ═══
function openQuestionImageModal(src) {
  // Remove existing modal if any
  const existing = document.getElementById('q-image-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'q-image-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    cursor: zoom-out; opacity: 0; transition: opacity 0.3s ease;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  `;
  modal.innerHTML = `
    <img src="${src}" style="
      max-width: 90vw; max-height: 85vh; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      transform: scale(0.8); transition: transform 0.3s ease;
    " />
    <button style="
      position: absolute; top: 20px; right: 24px;
      background: rgba(255,255,255,0.15); border: none; color: white;
      font-size: 1.6rem; width: 44px; height: 44px; border-radius: 50%;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px); transition: background 0.2s;
    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
       onmouseout="this.style.background='rgba(255,255,255,0.15)'"
       onclick="closeQuestionImageModal()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modal.querySelector('img').style.transform = 'scale(1)';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeQuestionImageModal();
  });
}
window.openQuestionImageModal = openQuestionImageModal;

function closeQuestionImageModal() {
  const modal = document.getElementById('q-image-modal');
  if (modal) {
    modal.style.opacity = '0';
    const img = modal.querySelector('img');
    if (img) img.style.transform = 'scale(0.8)';
    setTimeout(() => modal.remove(), 300);
  }
}
window.closeQuestionImageModal = closeQuestionImageModal;

// ══════════════════════════════════════════════════════════════════
// FINAL SAFETY NET: Force-update ALL station dropdown point badges
// Runs AFTER everything else to guarantee correct dynamic points
// ══════════════════════════════════════════════════════════════════
(function forceUpdateAllStationBadges() {
  function doUpdate() {
    if (typeof VIRTUAL_STATIONS_CONFIG === 'undefined') return;
    let updatedCount = 0;
    for (let sNum = 1; sNum <= 5; sNum++) {
      const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
      if (!cfg || !cfg.items || !cfg.totalPts) continue;
      const perItem = Math.round((cfg.totalPts / cfg.items.length) * 100) / 100;
      
      cfg.items.forEach(item => {
        const el = document.getElementById('sub-item-' + item.id);
        if (!el) return;
        const ptsBadge = el.querySelector('.sub-item-pts');
        if (!ptsBadge) return;
        
        // Force update regardless of is-done state
        if (ptsBadge.classList.contains('is-done')) {
          ptsBadge.innerHTML = '<i class="fa-solid fa-check"></i> +' + perItem.toFixed(1);
        } else {
          ptsBadge.textContent = '+' + perItem.toFixed(1);
        }
        updatedCount++;
      });
    }
    console.log('[Stations] Force-updated ' + updatedCount + ' point badges.');
  }

  // Run multiple times to catch any late-running scripts that override badges
  if (document.readyState === 'complete') {
    setTimeout(doUpdate, 300);
    setTimeout(doUpdate, 1000);
  } else {
    window.addEventListener('load', function() {
      setTimeout(doUpdate, 300);
      setTimeout(doUpdate, 1000);
    });
  }
})();
