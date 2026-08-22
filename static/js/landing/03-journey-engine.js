// ─── Journey Engine ───────────────────────────────────────
async function startJourney(e, explicitSlide) {
  if (e) e.preventDefault();
  document.getElementById('journey-dropdown')?.classList.remove('open');
  document.getElementById('campus-dropdown')?.classList.remove('open');
  document.getElementById('nav-links')?.classList.remove('open');

  // Hide top Navbar completely when entering Virtual Journey
  document.getElementById('glass-nav')?.classList.add('nav-hidden');
  document.body.classList.add('journey-active');

  APP.journeyActive = true;

  // Auto detect student ID from login or previous session or fallback session
  const knownStudentId = getEffectiveStudentId();
  APP.journeyStudentId = knownStudentId;
  let targetSlide = 4; // Default directly to Question 1 of Station 1

  const saved = loadStudentProgress(knownStudentId);
  if (saved) {
    APP.journeyStudentName = saved.studentName || APP.journeyStudentName || (knownStudentId !== 'guest_student' ? `طالب ${knownStudentId}` : `طالب رواد`);
    // Quiz score is computed on-the-fly from APP.journeyAnswered, not from saved.score
    APP.journeyAnswered = saved.answered || {};
    APP.journeySeconds = saved.seconds || 0;
    APP.watchedJourneyVideo = saved.watchedVideo || false;
    APP.watchedVideosList = saved.watchedVideosList || {};
    APP.checklistAnswers = saved.checklistAnswers || {};
    APP.checklistVerified = saved.checklistVerified || {};
    APP.journeyFirstAttemptSaved = saved.firstAttemptSaved || false;
    APP.journeyFirstAttemptTime = saved.firstAttemptTime || 0;
    APP.journeyFirstAttemptScore = saved.firstAttemptScore || 0;
    APP.journeyFirstAttemptAnswered = saved.firstAttemptAnswered || null;
    APP.journeyAttemptsHistory = saved.attemptsHistory || [];
    APP.journeyAttemptCount = saved.attemptCount || 1;
    APP.journeyAllCompleted = saved.allCompleted || false;
    if (explicitSlide !== undefined) {
      targetSlide = explicitSlide;
    } else if (saved.slide !== undefined && [4, 5, 6, 10, 11, 12, 15, 16, 17, 21, 22, 23, 27, 28, 29, 30].includes(saved.slide)) {
      targetSlide = saved.slide;
    }
  } else {
    // Brand new student: completely clean slate
    resetStudentInMemoryState(knownStudentId);
    targetSlide = 4;
  }

  // Dynamically load any Admin-created categories, browse cards & questions into the interactive journey
  await loadAndRenderDynamicJourneySections();

  // Load journey quiz questions from database
  await loadJourneyQuestionsFromDB();

  // Check if all questions were already answered (handles old data without allCompleted flag)
  if (!APP.journeyAllCompleted && APP.journeyAnswered && Object.keys(APP.journeyAnswered).length > 0) {
    const allQSlides = [];
    for (let sNum = 1; sNum <= 5; sNum++) {
      const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
      if (cfg && cfg.questionSlides) cfg.questionSlides.forEach(s => allQSlides.push(s));
    }
    if (allQSlides.length > 0 && allQSlides.every(s => APP.journeyAnswered[s] !== undefined)) {
      APP.journeyAllCompleted = true;
      if (!APP.journeyFirstAttemptSaved) {
        APP.journeyFirstAttemptTime = APP.journeySeconds;
        const { totalScore } = calcFinalQuizScore();
        APP.journeyFirstAttemptScore = totalScore;
        APP.journeyFirstAttemptAnswered = JSON.parse(JSON.stringify(APP.journeyAnswered || {}));
        APP.journeyFirstAttemptSaved = true;
      }
      saveStudentProgress({ immediate: true });  // Quiz completed — sync now
    }
  }

  document.getElementById('journey-fullscreen').classList.add('active');
  document.body.style.overflow = 'hidden';
  buildStepper();
  goToSlide(targetSlide);
  if (targetSlide !== 0 && targetSlide !== 30 && !APP.journeyAllCompleted) {
    startTimer();
  } else {
    stopTimer();
  }
  updateScore();
  startCanvasBg();
  restoreAnsweredQuestionsUI();
}

function restoreAnsweredQuestionsUI() {
  if (!APP.journeyAnswered || Object.keys(APP.journeyAnswered).length === 0) return;
  
  Object.keys(APP.journeyAnswered).forEach(slideIdxStr => {
    const slideIndex = Number(slideIdxStr);
    const selectedOption = APP.journeyAnswered[slideIndex];
    const correctOption = APP.journeyCorrectAnswers ? APP.journeyCorrectAnswers[slideIndex] : undefined;

    // Proof upload slides (10, 11): if answered with an object containing fileName, it's a valid proof
    const isProofUpload = (typeof selectedOption === 'object' && selectedOption !== null && selectedOption.fileName);
    const isCorrect = isProofUpload ? true : (correctOption !== undefined ? (selectedOption === correctOption) : true);

    const station = typeof getStationForSlide === 'function' ? getStationForSlide(slideIndex) : null;
    const qList = (station && station.questionSlides) ? station.questionSlides : [slideIndex];
    const ptsPerQ = Math.round((4 / (qList.length || 1)) * 10) / 10;

    // For proof uploads, skip the option buttons UI restore (they don't have options)
    if (!isProofUpload) {
      const optionsContainer = document.getElementById(`j-options-${slideIndex}`);
      if (optionsContainer) {
        const buttons = optionsContainer.querySelectorAll('.j-option-btn');
        buttons.forEach((b, i) => {
          b.classList.add('selected');
          b.style.pointerEvents = 'none';
          if (i === selectedOption) b.classList.add('student-picked');
          if (correctOption !== undefined && i === correctOption) b.classList.add('correct');
          if (i === selectedOption && !isCorrect) b.classList.add('wrong');
        });
      }
    }

    const feedback = document.getElementById(`j-feedback-${slideIndex}`);
    if (feedback) {
      if (isCorrect) {
        feedback.className = 'j-feedback show correct';
        if (isProofUpload) {
          feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ⭐ رائع ومميز! إثباتك معتمد وموثق (+${ptsPerQ} نقاط ضمن ${station ? station.title : 'المحطة'})!`;
        } else {
          feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ⭐ إجابة صحيحة وممتازة! كسبت +${ptsPerQ} نقاط ضمن ${station ? station.title : 'المحطة'}!`;
        }
      } else {
        feedback.className = 'j-feedback show wrong';
        feedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ❌ إجابة خاطئة! لم يتم احتساب نقطة هذا السؤال (${ptsPerQ} نقطة) في هذه المحطة. الإجابة الصحيحة موضحة بالأخضر.`;
      }
      feedback.style.display = 'block';
    }
  });

  buildStepper();
}

function closeJourney() {
  APP.journeyActive = false;
  document.getElementById('journey-fullscreen').classList.remove('active');
  document.body.style.overflow = '';

  // Restore top Navbar when exiting Virtual Journey
  document.getElementById('glass-nav')?.classList.remove('nav-hidden');
  document.body.classList.remove('journey-active');

  stopTimer();
  stopCanvasBg();
  saveStudentProgress();
}

async function restartJourney() {
  // Record previous attempt before restarting
  if (typeof recordJourneyAttempt === 'function') {
    recordJourneyAttempt(APP.journeyAttemptCount || 1);
  }

  // Save first attempt time, score, and answers before resetting (if not already saved)
  if (!APP.journeyFirstAttemptSaved && APP.journeySeconds > 0) {
    APP.journeyFirstAttemptTime = APP.journeySeconds;
    APP.journeyFirstAttemptScore = APP.journeyScore;
    APP.journeyFirstAttemptAnswered = JSON.parse(JSON.stringify(APP.journeyAnswered || {}));
    APP.journeyFirstAttemptSaved = true;
  }
  APP.journeyAttemptCount = (APP.journeyAttemptCount || 1) + 1;

  APP.journeySlide = 4;
  APP.journeyScore = 0;
  APP.journeySeconds = 0; // Reset timer for new attempt

  // ── Proof images: Clear from active session so stepper resets to 0/3 ──
  // The server files (first + previous attempts) remain on disk.
  // Stepper will start fresh — student must re-upload proofs for this attempt.
  APP.journeyAnswered = {};
  APP.journeyRestarted = true; // Flag: don't restore old proofs from localStorage
  // Clear pendingProofs too so old UI state doesn't bleed through
  if (typeof pendingProofs !== 'undefined') {
    Object.keys(pendingProofs).forEach(k => delete pendingProofs[k]);
  }
  // Clear current proof references from localStorage (keep first_proof keys intact)
  try {
    const sid = APP.journeyStudentId || localStorage.getItem('uhb_student_id') || '';
    if (sid) {
      localStorage.removeItem(`uhb_proof_email_${sid}`);
      localStorage.removeItem(`uhb_proof_name_email_${sid}`);
      localStorage.removeItem(`uhb_proof_bb_${sid}`);
      localStorage.removeItem(`uhb_proof_name_bb_${sid}`);
      localStorage.removeItem(`uhb_proof_blackboard_${sid}`);
      localStorage.removeItem(`uhb_proof_name_blackboard_${sid}`);
    }
  } catch(e) {}

  APP.journeyAllCompleted = false;

  await loadAndRenderDynamicJourneySections();

  document.querySelectorAll('.j-option-btn').forEach(btn => {
    btn.classList.remove('correct', 'wrong', 'selected', 'student-picked');
    btn.style.pointerEvents = '';
  });
  document.querySelectorAll('.j-feedback').forEach(fb => {
    fb.style.display = 'none';
    fb.classList.remove('show', 'correct', 'wrong');
  });
  buildStepper();
  goToSlide(4);
  startTimer(); // Fresh timer from 0
  updateScore();
  saveStudentProgress();
}

const JOURNEY_SECTIONS = [
  { id: 'station1', title: 'عن الجامعة',         icon: 'fa-solid fa-building-columns',    slides: [4, 5, 6] },
  { id: 'station2', title: 'الأنظمة التقنية',      icon: 'fa-solid fa-laptop-code',         slides: [10, 11, 12] },
  { id: 'station3', title: 'حقوقك وواجباتك',    icon: 'fa-solid fa-scale-balanced',      slides: [15, 16, 17] },
  { id: 'station4', title: 'القبول والتسجيل',   icon: 'fa-solid fa-graduation-cap',      slides: [21, 22, 23] },
  { id: 'station5', title: 'شؤون الطلاب',       icon: 'fa-solid fa-hand-holding-heart',  slides: [27, 28, 29] },
  { id: 'result',   title: 'النتيجة',           icon: 'fa-solid fa-trophy',              slides: [30] }
];

const QUIZ_SLIDES_SEQUENCE = [4, 5, 6, 10, 11, 12, 15, 16, 17, 21, 22, 23, 27, 28, 29, 30];
window.QUIZ_SLIDES_SEQUENCE = QUIZ_SLIDES_SEQUENCE;

function getNextQuizSlide(current) {
  const seq = window.QUIZ_SLIDES_SEQUENCE || QUIZ_SLIDES_SEQUENCE;
  const idx = seq.indexOf(current);
  if (idx !== -1 && idx < seq.length - 1) {
    return seq[idx + 1];
  }
  const next = seq.find(s => s > current);
  return next !== undefined ? next : 30;
}
window.getNextQuizSlide = getNextQuizSlide;

function getPrevQuizSlide(current) {
  const seq = window.QUIZ_SLIDES_SEQUENCE || QUIZ_SLIDES_SEQUENCE;
  const idx = seq.indexOf(current);
  if (idx > 0) {
    return seq[idx - 1];
  }
  const prev = [...seq].reverse().find(s => s < current);
  return prev !== undefined ? prev : 4;
}
window.getPrevQuizSlide = getPrevQuizSlide;

// ─── Load Journey Quiz Questions from Database ───────────────
async function loadJourneyQuestionsFromDB() {
  try {
    const resp = await fetch('/api/journey/questions');
    const data = await resp.json();
    if (!data.success || !data.questions || !data.correctAnswers) {
      console.warn('[Journey] Failed to load questions from DB, using defaults');
      return;
    }

    // Store questions data
    APP.journeyQuestionsFromDB = data.questions;

    // Build correctAnswers map: {slideNumber: correctOptionIndex}
    APP.journeyCorrectAnswers = {};
    for (const [slideStr, correctIdx] of Object.entries(data.correctAnswers)) {
      APP.journeyCorrectAnswers[parseInt(slideStr)] = correctIdx;
    }
    // Keep proof slides (10, 11) with correct=0 (they're not real MCQs but need entries)
    if (APP.journeyCorrectAnswers[10] === undefined) APP.journeyCorrectAnswers[10] = 0;
    if (APP.journeyCorrectAnswers[11] === undefined) APP.journeyCorrectAnswers[11] = 0;

    // Render quiz question slides dynamically from DB data
    const stationLabels = {
      1: { badge: 'اختبار المحطة الأولى', icon: 'fa-solid fa-circle-question' },
      2: { badge: 'اختبار المحطة الثانية', icon: 'fa-solid fa-circle-question' },
      3: { badge: 'اختبار المحطة الثالثة', icon: 'fa-solid fa-circle-question' },
      4: { badge: 'اختبار المحطة الرابعة', icon: 'fa-solid fa-circle-question' },
      5: { badge: 'اختبار المحطة الخامسة', icon: 'fa-solid fa-circle-question' },
    };

    // Group questions by station to calculate "X من Y"
    const stationQuestionCounts = {};
    const stationQuestionOrder = {};
    for (const q of data.questions) {
      if (!stationQuestionCounts[q.station_number]) {
        stationQuestionCounts[q.station_number] = 0;
        stationQuestionOrder[q.station_number] = 0;
      }
      stationQuestionCounts[q.station_number]++;
    }
    const stationCounter = {};

    for (const q of data.questions) {
      let slideEl = document.getElementById(`j-slide-${q.slide}`);
      
      // If slide doesn't exist in HTML, create it dynamically
      if (!slideEl) {
        slideEl = document.createElement('div');
        slideEl.className = 'j-slide';
        slideEl.id = `j-slide-${q.slide}`;
        slideEl.innerHTML = '<div class="j-slide-content"></div>';
        
        // Find the right place to insert: after the last existing slide of the same station
        // or after any slide with a lower number
        const allSlides = document.querySelectorAll('.j-slide[id^="j-slide-"]');
        let insertAfter = null;
        for (const s of allSlides) {
          const sNum = parseInt(s.id.replace('j-slide-', ''));
          if (sNum < q.slide) insertAfter = s;
        }
        
        if (insertAfter && insertAfter.parentNode) {
          insertAfter.parentNode.insertBefore(slideEl, insertAfter.nextSibling);
        } else {
          // Fallback: append to journey slides container
          const container = document.querySelector('.j-slides');
          if (container) container.appendChild(slideEl);
        }
        
        // Update total slides count
        APP.journeyTotalSlides = Math.max(APP.journeyTotalSlides || 31, q.slide + 1);
        console.log(`[Journey] 🆕 Created dynamic slide #${q.slide} for station ${q.station_number}`);
      }

      // Track question order within station
      if (!stationCounter[q.station_number]) stationCounter[q.station_number] = 0;
      stationCounter[q.station_number]++;
      const qNum = stationCounter[q.station_number];
      const qTotal = stationQuestionCounts[q.station_number];

      const stLabel = stationLabels[q.station_number] || { badge: 'اختبار', icon: 'fa-solid fa-circle-question' };

      // Build options HTML
      const letters = q.options_letters || ['أ', 'ب', 'ج', 'د'];
      let optionsHTML = '';
      q.options.forEach((optText, idx) => {
        optionsHTML += `<button class="j-option-btn" onclick="journeyAnswer(${q.slide}, this, ${idx})"><span class="j-opt-letter">${letters[idx] || ''}</span><span class="j-opt-text">${optText}</span></button>\n`;
      });

      // Replace slide content
      const contentEl = slideEl.querySelector('.j-slide-content');
      if (contentEl) {
        // Build images HTML - support multi-image with captions
        let imageHTML = '';
        const images = q.images && q.images.length > 0 ? q.images : (q.image_url ? [{url: q.image_url, caption: ''}] : []);
        
        if (images.length === 1) {
          // Single image - centered
          imageHTML = `
            <div class="j-question-image-wrap">
              <img src="${images[0].url}" alt="${images[0].caption || 'صورة السؤال'}" class="j-question-image" 
                   onclick="openQuestionImageModal(this.src)"
                   onerror="this.parentElement.style.display='none'">
              ${images[0].caption ? `<p class="j-img-caption">${images[0].caption}</p>` : ''}
            </div>
          `;
        } else if (images.length > 1) {
          // Multiple images - grid layout
          let imgsHtml = '';
          images.forEach((img, i) => {
            imgsHtml += `
              <div class="j-multi-img-item">
                <img src="${img.url}" alt="${img.caption || 'صورة ' + (i+1)}" class="j-question-image"
                     onclick="openQuestionImageModal(this.src)"
                     onerror="this.closest('.j-multi-img-item').style.display='none'">
                ${img.caption ? `<p class="j-img-caption">${img.caption}</p>` : ''}
              </div>
            `;
          });
          imageHTML = `<div class="j-question-images-grid">${imgsHtml}</div>`;
        }

        contentEl.innerHTML = `
          <div class="j-slide-badge"><i class="fa-solid fa-clipboard-question"></i> ${stLabel.badge} | سؤال ${qNum} من ${qTotal}</div>
          <div class="j-slide-icon"><i class="${stLabel.icon}"></i></div>
          <h2>${q.question}</h2>
          ${imageHTML}
          <p class="j-slide-desc">اختر الإجابة الصحيحة:</p>
          <div class="j-options" id="j-options-${q.slide}">
            ${optionsHTML}
          </div>
          <div class="j-feedback" id="j-feedback-${q.slide}"></div>
        `;
      }
    }

    // Rebuild JOURNEY_SECTIONS and QUIZ_SLIDES_SEQUENCE dynamically from DB
    const stationSlides = {};
    for (const q of data.questions) {
      if (!stationSlides[q.station_number]) stationSlides[q.station_number] = [];
      stationSlides[q.station_number].push(q.slide);
    }
    // Add proof slides (10, 11) to station 2
    if (stationSlides[2]) {
      if (!stationSlides[2].includes(10)) stationSlides[2].unshift(10);
      if (!stationSlides[2].includes(11)) stationSlides[2].splice(1, 0, 11);
    }
    
    // Sort slides within each station
    for (const sn in stationSlides) {
      stationSlides[sn].sort((a, b) => a - b);
    }

    // Update JOURNEY_SECTIONS
    const stationMeta = {
      1: { id: 'station1', title: 'عن الجامعة', icon: 'fa-solid fa-building-columns' },
      2: { id: 'station2', title: 'الأنظمة التقنية', icon: 'fa-solid fa-laptop-code' },
      3: { id: 'station3', title: 'حقوقك وواجباتك', icon: 'fa-solid fa-scale-balanced' },
      4: { id: 'station4', title: 'القبول والتسجيل', icon: 'fa-solid fa-graduation-cap' },
      5: { id: 'station5', title: 'شؤون الطلاب', icon: 'fa-solid fa-hand-holding-heart' },
    };

    const dynamicSections = [];
    for (let sn = 1; sn <= 5; sn++) {
      if (stationSlides[sn]) {
        dynamicSections.push({
          ...stationMeta[sn],
          slides: stationSlides[sn]
        });
      }
    }
    dynamicSections.push({ id: 'result', title: 'النتيجة', icon: 'fa-solid fa-trophy', slides: [30] });
    window.DYNAMIC_JOURNEY_SECTIONS = dynamicSections;

    // Rebuild slides sequence
    const allSlideNums = [];
    for (const sec of dynamicSections) {
      allSlideNums.push(...sec.slides);
    }
    allSlideNums.sort((a, b) => a - b);
    window.QUIZ_SLIDES_SEQUENCE = allSlideNums;

    // Update total slides
    APP.journeyTotalSlides = Math.max(...allSlideNums) + 1;

    // Update VIRTUAL_STATIONS_CONFIG questionSlides dynamically
    if (window.VIRTUAL_STATIONS_CONFIG) {
      for (let sn = 1; sn <= 5; sn++) {
        if (window.VIRTUAL_STATIONS_CONFIG[sn] && stationSlides[sn]) {
          window.VIRTUAL_STATIONS_CONFIG[sn].questionSlides = stationSlides[sn];
          console.log(`[Journey] 🔄 Updated Station ${sn} questionSlides:`, stationSlides[sn]);
        }
      }
    }

    console.log(`[Journey] ✅ Loaded ${data.questions.length} questions from DB, ${allSlideNums.length} slides total`);
    
    // Rebuild stepper with updated sections
    if (typeof buildStepper === 'function') buildStepper();
  } catch (err) {
    console.error('[Journey] Error loading questions from DB:', err);
  }
}

async function loadAndRenderDynamicJourneySections() {
  // 6 fixed stations
  renderJourneyRegulations('', 'discipline', 'j-discipline-browse');
  renderJourneyRegulations('', 'study', 'j-study-browse');
  APP.journeyTotalSlides = 31;
}

function buildStepper() {
  const stepper = document.getElementById('journey-stepper');
  if (!stepper) return;

  const sections = window.DYNAMIC_JOURNEY_SECTIONS || JOURNEY_SECTIONS;
  const currentSlide = APP.journeySlide;
  let html = '';

  sections.forEach((sec, secIdx) => {
    const isActive = sec.slides.includes(currentSlide);
    
    // Count ALL answerable slides in this station:
    // MCQ slides = those with a correct answer defined
    // Proof slides = slides 10, 11 (file upload) — counted if answered
    const PROOF_SLIDES = [10, 11];
    const mcqSlides  = sec.slides.filter(s => APP.journeyCorrectAnswers && APP.journeyCorrectAnswers[s] !== undefined);
    const proofSlides = sec.slides.filter(s => PROOF_SLIDES.includes(s));
    const allAnswerableSlides = [...new Set([...mcqSlides, ...proofSlides])];

    const totalQuizzes    = allAnswerableSlides.length;
    const answeredQuizzes = allAnswerableSlides.filter(s => APP.journeyAnswered && APP.journeyAnswered[s] !== undefined).length;
    
    let progressPct = 0;
    if (totalQuizzes > 0) {
      progressPct = Math.round((answeredQuizzes / totalQuizzes) * 100);
    } else if (currentSlide >= sec.slides[0]) {
      progressPct = 100;
    }

    const isFullyDone = totalQuizzes > 0 ? (answeredQuizzes === totalQuizzes) : (currentSlide >= sec.slides[0]);
    const isPartiallyDone = answeredQuizzes > 0 && answeredQuizzes < totalQuizzes;

    // SVG Ring Geometry: 50x50 viewBox, Center (25, 25), Radius = 21
    const radius = 21;
    const circ = 2 * Math.PI * radius; // ≈ 131.95
    const offset = circ - (circ * progressPct) / 100;

    let ringColor = '#F3C649'; // Bright Gold
    if (isFullyDone) ringColor = '#10B981'; // Emerald Green
    else if (progressPct > 0) ringColor = '#F59E0B'; // Amber Gold

    let centerIconHtml = `<i class="${sec.icon}"></i>`;
    if (isFullyDone && totalQuizzes > 0) {
      centerIconHtml = `<i class="fa-solid fa-check" style="font-size:1.15rem; color:#10B981;"></i>`;
    }

    let badgeHtml = '';
    if (totalQuizzes > 0 && answeredQuizzes > 0) {
      const badgeClass = isFullyDone ? 'done' : (isPartiallyDone ? 'partial' : 'empty');
      const badgeText = `${answeredQuizzes}/${totalQuizzes}`;
      badgeHtml = `<span class="j-node-progress-badge ${badgeClass}">${badgeText}</span>`;
    }

    const statusHint = totalQuizzes > 0 ? (isFullyDone ? 'مكتملة (3/3 أسئلة)' : (isPartiallyDone ? `تمت إجابة ${answeredQuizzes} وباقي ${totalQuizzes - answeredQuizzes} أسئلة` : 'لم تبدأ بعد')) : '';

    html += `
      <div class="j-stepper-item ${isActive ? 'active' : ''} ${isFullyDone ? 'completed' : ''} ${isPartiallyDone ? 'partial' : ''}" 
           onclick="goToSlide(${sec.slides[0]})" 
           title="${sec.title} — ${statusHint}">
        <div class="j-stepper-circle-wrap">
          <svg class="j-stepper-svg" viewBox="0 0 50 50">
            <circle class="j-stepper-track" cx="25" cy="25" r="${radius}" />
            <circle class="j-stepper-progress ${isFullyDone ? 'full' : ''}" 
                    cx="25" cy="25" r="${radius}" 
                    stroke="${ringColor}" 
                    stroke-dasharray="${circ.toFixed(2)}" 
                    stroke-dashoffset="${offset.toFixed(2)}" />
          </svg>
          <div class="j-stepper-node ${isActive ? 'active' : ''} ${isFullyDone ? 'done' : ''} ${isPartiallyDone ? 'partial' : ''}">
            ${centerIconHtml}
          </div>
          ${badgeHtml}
        </div>
        <span class="j-stepper-title">${sec.title}</span>
      </div>
    `;

    if (secIdx < sections.length - 1) {
      const lineFilled = isFullyDone;
      html += `<div class="j-stepper-line ${lineFilled ? 'done' : ''}"></div>`;
    }
  });

  stepper.innerHTML = html;
}

function goToSlide(index) {
  if (index < 4 && index !== 0) index = 4;
  APP.journeySlide = index;

  const allSlides = Array.from(document.querySelectorAll('#journey-slides-track .j-slide'));
  let targetSlide = document.getElementById(`j-slide-${index}`);
  if (!targetSlide && allSlides.length > 0) {
    targetSlide = allSlides[0];
  }
  const domIndex = targetSlide ? allSlides.indexOf(targetSlide) : 0;

  const track = document.getElementById('journey-slides-track');
  if (track) track.style.transform = `translateX(${domIndex * 100}%)`;
  buildStepper();

  // Update progress bar based on ANSWERED questions (not current slide position)
  const allQuizSlides = (window.QUIZ_SLIDES_SEQUENCE || QUIZ_SLIDES_SEQUENCE).filter(s => s !== 30); // Exclude result slide
  const answeredCount = allQuizSlides.filter(s => APP.journeyAnswered && APP.journeyAnswered[s] !== undefined).length;
  const totalCount = allQuizSlides.length;
  const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const fill = document.getElementById('journey-progress-fill');
  const txt = document.getElementById('journey-progress-text');
  if (fill) fill.style.width = pct + '%';
  if (txt) txt.textContent = pct + '%';

  const defaultLabels = {
    0: 'التسجيل',
    4: 'المحطة الأولى: سؤال 1 من 3 ⭐',
    5: 'المحطة الأولى: سؤال 2 من 3 ⭐',
    6: 'المحطة الأولى: سؤال 3 من 3 ⭐',
    10: 'المحطة الثانية: مهمة تفعيل الإيميل (Outlook) 📷',
    11: 'المحطة الثانية: مهمة منصة البلاك بورد 📷',
    12: 'المحطة الثانية: سؤال القبول والتسجيل ⭐',
    15: 'المحطة الثالثة: سؤال 1 من 3 ⭐',
    16: 'المحطة الثالثة: سؤال 2 من 3 ⭐',
    17: 'المحطة الثالثة: سؤال 3 من 3 ⭐',
    21: 'المحطة الرابعة: سؤال 1 من 3 ⭐',
    22: 'المحطة الرابعة: سؤال 2 من 3 ⭐',
    23: 'المحطة الرابعة: سؤال 3 من 3 ⭐',
    27: 'المحطة الخامسة: سؤال 1 من 3 ⭐',
    28: 'المحطة الخامسة: سؤال 2 من 3 ⭐',
    29: 'المحطة الخامسة: سؤال 3 من 3 ⭐',
    30: 'النتيجة والتكريم النهائي 🏆'
  };
  const stepLabel = document.getElementById('j-step-label');
  if (stepLabel) stepLabel.textContent = defaultLabels[index] || `سؤال ${index}`;

  const isFirst = index === 4 || index <= 0;
  const isLast = index === 30;
  const prevBtn = document.getElementById('j-btn-prev');
  const nextBtn = document.getElementById('j-btn-next');
  if (prevBtn) prevBtn.disabled = isFirst;
  if (nextBtn) {
    nextBtn.style.display = isLast ? 'none' : '';
    nextBtn.disabled = false;
  }

  // Checklist moved to campus journey

  if (isLast) {
    const { totalScore, correctTotal, questionsTotal } = calcFinalQuizScore();
    APP.journeyScore = totalScore;

    const finalScoreEl = document.getElementById('j-final-score');
    if (finalScoreEl) finalScoreEl.textContent = `${APP.journeyScore} / 20`;

    const finalQEl = document.getElementById('j-final-q-score');
    if (finalQEl) finalQEl.textContent = `${correctTotal} / ${questionsTotal}`;

    const finalVEl = document.getElementById('j-final-v-score');
    if (finalVEl) finalVEl.textContent = `${Math.round((correctTotal / (questionsTotal || 15)) * 100)}%`;

    const mins = Math.floor((APP.journeySeconds || 0) / 60).toString().padStart(2, '0');
    const secs = ((APP.journeySeconds || 0) % 60).toString().padStart(2, '0');
    const finalTimeEl = document.getElementById('j-final-time');
    if (finalTimeEl) finalTimeEl.textContent = `${mins}:${secs}`;

    updateStars();
    stopTimer();

    // Save first attempt data once and for all if not saved
    if (!APP.journeyFirstAttemptSaved) {
      APP.journeyFirstAttemptTime = APP.journeySeconds;
      APP.journeyFirstAttemptScore = totalScore;
      APP.journeyFirstAttemptAnswered = JSON.parse(JSON.stringify(APP.journeyAnswered || {}));
      APP.journeyFirstAttemptSaved = true;
      APP.journeyAttemptCount = 1;
    }

    if (typeof recordJourneyAttempt === 'function') {
      recordJourneyAttempt(APP.journeyAttemptCount || 1);
    }
  }
  restoreAnsweredQuestionsUI();
  if (typeof restoreJourneyProofUI === 'function') restoreJourneyProofUI();
  saveStudentProgress();
}

// ─── Station 6: Student Checklist & Survey Logic (Yes / No) ────────────
const CHECKLIST_ITEMS = [
  // Tech (5)
  { id: 'tech-1', cat: 'tech' },
  { id: 'tech-2', cat: 'tech' },
  { id: 'tech-3', cat: 'tech' },
  { id: 'tech-4', cat: 'tech' },
  { id: 'tech-5', cat: 'tech' },
  // College (6)
  { id: 'col-1', cat: 'college' },
  { id: 'col-2', cat: 'college' },
  { id: 'col-3', cat: 'college' },
  { id: 'col-4', cat: 'college' },
  { id: 'col-5', cat: 'college' },
  { id: 'col-6', cat: 'college' },
  // Affairs (6)
  { id: 'aff-1', cat: 'affairs' },
  { id: 'aff-2', cat: 'affairs' },
  { id: 'aff-3', cat: 'affairs' },
  { id: 'aff-4', cat: 'affairs' },
  { id: 'aff-5', cat: 'affairs' },
  { id: 'aff-6', cat: 'affairs' },
  // Admission (9)
  { id: 'adm-1', cat: 'admission' },
  { id: 'adm-2', cat: 'admission' },
  { id: 'adm-3', cat: 'admission' },
  { id: 'adm-4', cat: 'admission' },
  { id: 'adm-5', cat: 'admission' },
  { id: 'adm-6', cat: 'admission' },
  { id: 'adm-7', cat: 'admission' },
  { id: 'adm-8', cat: 'admission' },
  { id: 'adm-9', cat: 'admission' },
  // Departure (5)
  { id: 'dep-1', cat: 'depart' },
  { id: 'dep-2', cat: 'depart' },
  { id: 'dep-3', cat: 'depart' },
  { id: 'dep-4', cat: 'depart' },
  { id: 'dep-5', cat: 'depart' }
];

function setChecklistAnswer(id, answer, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!APP.checklistAnswers) APP.checklistAnswers = {};
  if (!APP.checklistVerified) APP.checklistVerified = {};

  // If clicking same answer, toggle it off
  if (APP.checklistAnswers[id] === answer) {
    delete APP.checklistAnswers[id];
    delete APP.checklistVerified[id];
  } else {
    APP.checklistAnswers[id] = answer;
    APP.checklistVerified[id] = (answer === 'yes');
    if (typeof fireToast === 'function') {
      if (answer === 'yes') {
        fireToast('تم التحقق بنجاح! ✅', 'fa-solid fa-circle-check');
      } else {
        fireToast('تم تسجيل احتياجك للمساعدة — تفضل بزيارة الركن المختص! ℹ️', 'fa-solid fa-circle-info');
      }
    }
  }

  updateChecklistUI();
  saveStudentProgress();
}

function toggleChecklistItem(id) {
  setChecklistAnswer(id, 'yes');
}

function checkAllChecklistYes() {
  if (!APP.checklistAnswers) APP.checklistAnswers = {};
  if (!APP.checklistVerified) APP.checklistVerified = {};
  
  const allYes = CHECKLIST_ITEMS.every(i => APP.checklistAnswers[i.id] === 'yes');
  CHECKLIST_ITEMS.forEach(item => {
    if (!allYes) {
      APP.checklistAnswers[item.id] = 'yes';
      APP.checklistVerified[item.id] = true;
    } else {
      delete APP.checklistAnswers[item.id];
      delete APP.checklistVerified[item.id];
    }
  });

  updateChecklistUI();
  saveStudentProgress();
  if (typeof fireToast === 'function') {
    fireToast(!allYes ? 'تم تحديد جميع البنود (نعم ✅) بنجاح!' : 'تم مسح الإجابات 🔄', 'fa-solid fa-check-double');
  }
}

function checkAllChecklistItems() {
  checkAllChecklistYes();
}

function filterChecklistCategory(cat, btn) {
  document.querySelectorAll('.j-cl-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  document.querySelectorAll('.j-cl-section').forEach(sec => {
    if (cat === 'all' || sec.dataset.category === cat) {
      sec.style.display = 'block';
    } else {
      sec.style.display = 'none';
    }
  });
}

function updateChecklistUI() {
  if (!APP.checklistAnswers) APP.checklistAnswers = {};
  if (!APP.checklistVerified) APP.checklistVerified = {};
  
  let answeredCount = 0;
  let yesCount = 0;
  let noCount = 0;
  const catAnsweredCounts = { tech: 0, college: 0, affairs: 0, admission: 0, depart: 0 };
  
  CHECKLIST_ITEMS.forEach(item => {
    const ans = APP.checklistAnswers[item.id];
    const card = document.getElementById('chk-' + item.id);
    if (card) {
      card.classList.remove('is-yes', 'is-no', 'verified');
      if (ans === 'yes') {
        card.classList.add('is-yes', 'verified');
      } else if (ans === 'no') {
        card.classList.add('is-no');
      }
    }
    if (ans) {
      answeredCount++;
      if (ans === 'yes') yesCount++;
      if (ans === 'no') noCount++;
      if (catAnsweredCounts[item.cat] !== undefined) catAnsweredCounts[item.cat]++;
    }
  });

  const total = CHECKLIST_ITEMS.length;
  const pct = Math.round((answeredCount / total) * 100);

  const countEl = document.getElementById('j-cl-count');
  const yesCountEl = document.getElementById('j-cl-yes-count');
  const noCountEl = document.getElementById('j-cl-no-count');
  const fillEl = document.getElementById('j-cl-prog-fill');
  const pctEl = document.getElementById('j-cl-prog-pct');

  if (countEl) countEl.textContent = `${answeredCount} / ${total}`;
  if (yesCountEl) yesCountEl.textContent = `${yesCount} ✅`;
  if (noCountEl) noCountEl.textContent = `${noCount} ❌`;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;

  const techCnt = document.getElementById('j-sec-cnt-tech');
  if (techCnt) techCnt.textContent = `${catAnsweredCounts.tech} / 5`;
  const colCnt = document.getElementById('j-sec-cnt-college');
  if (colCnt) colCnt.textContent = `${catAnsweredCounts.college} / 6`;
  const affCnt = document.getElementById('j-sec-cnt-affairs');
  if (affCnt) affCnt.textContent = `${catAnsweredCounts.affairs} / 6`;
  const admCnt = document.getElementById('j-sec-cnt-admission');
  if (admCnt) admCnt.textContent = `${catAnsweredCounts.admission} / 9`;
  const depCnt = document.getElementById('j-sec-cnt-depart');
  if (depCnt) depCnt.textContent = `${catAnsweredCounts.depart} / 5`;
}

let journeyAutoAdvanceTimer = null;

function jumpToSlide(index) { 
  if (journeyAutoAdvanceTimer) { clearTimeout(journeyAutoAdvanceTimer); journeyAutoAdvanceTimer = null; }
  goToSlide(index); 
}
function journeyNext() { 
  if (journeyAutoAdvanceTimer) { clearTimeout(journeyAutoAdvanceTimer); journeyAutoAdvanceTimer = null; }
  goToSlide(getNextQuizSlide(APP.journeySlide)); 
}
function journeyPrev() { 
  if (journeyAutoAdvanceTimer) { clearTimeout(journeyAutoAdvanceTimer); journeyAutoAdvanceTimer = null; }
  goToSlide(getPrevQuizSlide(APP.journeySlide)); 
}
function journeySkip() { 
  if (journeyAutoAdvanceTimer) { clearTimeout(journeyAutoAdvanceTimer); journeyAutoAdvanceTimer = null; }
  goToSlide(getNextQuizSlide(APP.journeySlide)); 
}

function journeyRegister() {
  const id = document.getElementById('j-reg-id')?.value.trim();
  const name = document.getElementById('j-reg-name')?.value.trim() || `طالب رواد`;
  if (!id) { alert('الرجاء إدخال الرقم الجامعي'); return; }
  APP.journeyStudentId = id;
  APP.journeyStudentName = name;
  const saved = loadStudentProgress(id);
  if (saved && saved.seconds !== undefined) {
    APP.journeySeconds = saved.seconds;
  }
  saveStudentProgress();
  goToSlide(4);
  startTimer();
}

// ═══════════════════════════════════════════════════════════════
// OFFICIAL ROWAD 13 SMART & FLEXIBLE SCORING ENGINE
// Virtual Journey (75 pts: St1=10, St2=15, St3=20, St4=15, St5=15) + Comprehensive Final Quiz (20 pts)
// Campus Journey (60 pts booths: 10 pts each, Reception/Exit: 0 pts) + 9 Workshops (45 pts: 5 pts each)
// ═══════════════════════════════════════════════════════════════

const VIRTUAL_STATIONS_CONFIG = {
  1: {
    id: 'station1',
    num: 1,
    title: 'المحطة الأولى: عن الجامعة',
    totalPts: 10,
    items: [
      { id: 'about-university', altIds: ['about', 'about_university', 'university'], name: 'نبذة عن الجامعة', defaultPts: 3.3 },
      { id: 'vision-mission', altIds: ['vision', 'vision_mission', 'mission'], name: 'رؤية الجامعة ورسالتها', defaultPts: 3.3 },
      { id: 'identity-guide', altIds: ['identity', 'identity_guide'], name: 'التعريف بالهوية البصرية', defaultPts: 3.4 }
    ],
    questionSlides: [4, 5, 6]
  },
  2: {
    id: 'station2',
    num: 2,
    title: 'المحطة الثانية: الأنظمة التقنية',
    totalPts: 15,
    items: [
      { id: 'email-internet-guide', altIds: ['email', 'email_internet_guide', 'network'], name: 'دليل تفعيل البريد الجامعي والشبكة', defaultPts: 5 },
      { id: 'admissions', altIds: ['admissions-portal', 'admissions_portal'], name: 'بوابة القبول والتسجيل', defaultPts: 5 },
      { id: 'elearn-system-guide', altIds: ['elearn', 'elearn_system_guide', 'elearning', 'blackboard'], name: 'دليل نظام التعليم الإلكتروني (Blackboard)', defaultPts: 5 }
    ],
    questionSlides: [10, 11, 12]
  },
  3: {
    id: 'station3',
    num: 3,
    title: 'المحطة الثالثة: حقوقك وواجباتك',
    totalPts: 20,
    items: [
      { id: 'discipline-regulations', altIds: ['discipline_regulations', 'discipline', 'regulations-discipline'], name: 'لائحة الانضباط الطلابي', defaultPts: 10 },
      { id: 'study-regulations', altIds: ['study_exam_regulations', 'study', 'study_regulations', 'regulations-study'], name: 'لائحة الدراسة والاختبارات', defaultPts: 10 }
    ],
    questionSlides: [15, 16, 17]
  },
  4: {
    id: 'station4',
    num: 4,
    title: 'المحطة الرابعة: عمادة القبول والتسجيل',
    totalPts: 15,
    items: [
      { id: 'calendar', altIds: ['academic-calendar', 'academic_calendar'], name: 'التقويم الأكاديمي', defaultPts: 5 },
      { id: 'rewards-guide', altIds: ['rewards', 'rewards_guide', 'excellence'], name: 'المكافآت الطلابية ومكافأة التميز', defaultPts: 5 },
      { id: 'admissions-records', altIds: ['records', 'admissions_records', 'records-guide'], name: 'الدليل الإرشادي لنظام سجلات الطلاب', defaultPts: 5 }
    ],
    questionSlides: [21, 22, 23]
  },
  5: {
    id: 'station5',
    num: 5,
    title: 'المحطة الخامسة: عمادة شؤون الطلاب',
    totalPts: 15,
    items: [
      { id: 'student-loans', altIds: ['loans', 'student_loans', 'student-affairs-loans'], name: 'الإعانات الجامعية والقروض الطلابية', defaultPts: 5 },
      { id: 'student-jobs', altIds: ['jobs', 'student_jobs', 'student-affairs-jobs'], name: 'برنامج التشغيل الطلابي والأنشطة', defaultPts: 5 },
      { id: 'skills-guide', altIds: ['skills', 'skills_guide', 'skills-record'], name: 'دليل السجل المهاري للأنشطة', defaultPts: 5 }
    ],
    questionSlides: [27, 28, 29]
  },
  finalQuiz: {
    id: 'finalQuiz',
    title: 'اختبار ختام الرحلة الشامل',
    totalPts: 20
  }
};
window.VIRTUAL_STATIONS_CONFIG = VIRTUAL_STATIONS_CONFIG;

// ─── Integrate Station Videos from DB into VIRTUAL_STATIONS_CONFIG ────────────
// Merges videos assigned to stations as items, recalculates points dynamically.
(function integrateStationVideos() {
  const stationVideos = window.STATION_VIDEOS || [];
  if (!stationVideos.length) {
    // No DB videos — just ensure defaultPts are set correctly from base items
    for (let sNum in VIRTUAL_STATIONS_CONFIG) {
      const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
      if (cfg.items && cfg.totalPts) {
        const perItem = Math.round((cfg.totalPts / cfg.items.length) * 100) / 100;
        cfg.items.forEach(item => { item.dynamicPts = perItem; });
      }
    }
    return;
  }

  // Group videos by station_num
  const videosByStation = {};
  const unassignedVideos = [];
  stationVideos.forEach(v => {
    if (v.station_num && VIRTUAL_STATIONS_CONFIG[v.station_num]) {
      if (!videosByStation[v.station_num]) videosByStation[v.station_num] = [];
      videosByStation[v.station_num].push(v);
    } else {
      unassignedVideos.push(v);
    }
  });

  // Merge assigned videos into station items and recalculate points
  for (let sNum in VIRTUAL_STATIONS_CONFIG) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (!cfg.items) continue;

    const stVideos = videosByStation[sNum] || [];
    // Add video items to station
    stVideos.forEach(v => {
      cfg.items.push({
        id: `station-video-${v.id}`,
        altIds: [`sv-${v.id}`, `station_video_${v.id}`],
        name: v.title,
        videoUrl: v.url,
        isVideo: true,
        dbVideoId: v.id,
        defaultPts: 0 // will be overridden by dynamicPts
      });
    });

    // Recalculate dynamic points: totalPts ÷ total items count
    if (cfg.totalPts && cfg.items.length > 0) {
      const perItem = Math.round((cfg.totalPts / cfg.items.length) * 100) / 100;
      cfg.items.forEach(item => { item.dynamicPts = perItem; });
    }
  }

  // Store unassigned videos for display without points
  window.UNASSIGNED_STATION_VIDEOS = unassignedVideos;

  console.log('[Stations] Videos integrated. Updated points:', 
    Object.entries(VIRTUAL_STATIONS_CONFIG)
      .filter(([k, v]) => v.items)
      .map(([k, v]) => `Station ${k}: ${v.items.length} items × ${(v.totalPts / v.items.length).toFixed(1)} pts`)
  );

  // ─── Inject video items into station dropdown menus + update ALL point badges ───
  function injectVideoItemsIntoDropdowns() {
    // 1) Update ALL station items' point badges to use dynamicPts
    for (let sNum = 1; sNum <= 5; sNum++) {
      const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
      if (!cfg || !cfg.items || !cfg.totalPts) continue;
      const perItem = Math.round((cfg.totalPts / cfg.items.length) * 100) / 100;
      
      cfg.items.forEach(item => {
        const el = document.getElementById(`sub-item-${item.id}`);
        if (el) {
          const ptsBadge = el.querySelector('.sub-item-pts');
          if (ptsBadge) {
            if (ptsBadge.classList.contains('is-done')) {
              // Already completed — update point value but keep ✅ format
              ptsBadge.innerHTML = `<i class="fa-solid fa-check"></i> +${perItem.toFixed(1)}`;
            } else {
              ptsBadge.textContent = `+${perItem.toFixed(1)}`;
            }
          }
        }
      });
    }

    // 2) Inject video elements into station dropdown sub-menus
    for (let sNum in videosByStation) {
      const subMenu = document.querySelector(`#station-subnav-${sNum} .dropdown-sub-menu`);
      if (!subMenu) continue;
      const stVideos = videosByStation[sNum];
      const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
      const perItem = cfg ? Math.round((cfg.totalPts / cfg.items.length) * 100) / 100 : 0;

      stVideos.forEach(v => {
        const itemId = `station-video-${v.id}`;
        // Don't add if already exists
        if (document.getElementById(`sub-item-${itemId}`)) return;
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'dropdown-item sub-item';
        link.id = `sub-item-${itemId}`;
        link.onclick = function(e) {
          e.preventDefault();
          // Close the dropdown menu first
          const dropdownEl = document.getElementById('dropdown-menu');
          if (dropdownEl) dropdownEl.classList.remove('show');
          const navDropdown = dropdownEl ? dropdownEl.closest('.nav-dropdown') : null;
          if (navDropdown) navDropdown.classList.remove('open');

          // Scroll to video section
          const vidSection = document.getElementById('heroVideo') || document.getElementById('video-carousel-section');
          if (vidSection) vidSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Switch to the correct video
          const videoIndex = (window.LANDING_VIDEOS || []).findIndex(lv => lv.url === v.url);
          if (videoIndex >= 0) {
            const currentIdx = window.CURRENT_VIDEO_INDEX || 0;
            const diff = videoIndex - currentIdx;
            if (diff !== 0 && typeof switchVideoSlide === 'function') {
              switchVideoSlide(diff);
            }
          }
        };
        link.innerHTML = `
          <i class="fa-solid fa-film" style="color:#7c3aed;"></i>
          <span>🎬 ${v.title}</span>
          <span class="sub-item-pts">+${perItem.toFixed(1)}</span>
        `;
        subMenu.appendChild(link);
      });
    }

    console.log('[Stations] Dropdown items injected, point badges updated.');
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectVideoItemsIntoDropdowns);
  } else {
    injectVideoItemsIntoDropdowns();
  }
})();

function findVirtualStationItem(docId) {
  if (!docId) return { station: null, item: null };
  const cleanId = String(docId).replace(/^overlay-/, '').trim();

  // Pass 1: Exact id match
  for (let sNum in VIRTUAL_STATIONS_CONFIG) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (cfg.items) {
      const it = cfg.items.find(i => i.id === cleanId || i.id === docId);
      if (it) return { station: cfg, item: it };
    }
  }

  // Pass 2: Exact alias match
  for (let sNum in VIRTUAL_STATIONS_CONFIG) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (cfg.items) {
      const it = cfg.items.find(i => i.altIds && (i.altIds.includes(cleanId) || i.altIds.includes(docId)));
      if (it) return { station: cfg, item: it };
    }
  }

  // Pass 3: Normalized dash/underscore exact match
  const normId = cleanId.replace(/_/g, '-');
  for (let sNum in VIRTUAL_STATIONS_CONFIG) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (cfg.items) {
      const it = cfg.items.find(i => {
        const itemNorm = i.id.replace(/_/g, '-');
        if (itemNorm === normId) return true;
        if (i.altIds && i.altIds.some(a => a.replace(/_/g, '-') === normId)) return true;
        return false;
      });
      if (it) return { station: cfg, item: it };
    }
  }

  return { station: null, item: null };
}
window.findVirtualStationItem = findVirtualStationItem;

function getStationForSlide(slideIndex) {
  for (let sNum in VIRTUAL_STATIONS_CONFIG) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (cfg.questionSlides && cfg.questionSlides.includes(Number(slideIndex))) {
      return cfg;
    }
  }
  return null;
}
window.getStationForSlide = getStationForSlide;

function getPointsPerQuestion(slideIndex) {
  if (slideIndex !== undefined) {
    const station = getStationForSlide(slideIndex);
    if (station && station.questionSlides && station.questionSlides.length > 0) {
      // 4 points per station in the 20-point final quiz
      return Math.round((4 / station.questionSlides.length) * 10) / 10;
    }
  }
  const count = getTotalVirtualQuestionsCount();
  return Math.round((20 / (count || 15)) * 10) / 10;
}
window.getPointsPerQuestion = getPointsPerQuestion;

function calcFinalQuizScore() {
  let totalScore = 0;
  let correctTotal = 0;
  let questionsTotal = 0;
  const breakdown = {};

  for (let sNum = 1; sNum <= 5; sNum++) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (!cfg || !cfg.questionSlides) continue;
    const qSlides = cfg.questionSlides;
    const numQ = qSlides.length;
    let correctInStation = 0;

    qSlides.forEach(slideIdx => {
      questionsTotal++;
      const ans = APP.journeyAnswered ? APP.journeyAnswered[slideIdx] : undefined;
      const correctOpt = APP.journeyCorrectAnswers ? APP.journeyCorrectAnswers[slideIdx] : undefined;
      if (ans !== undefined) {
        if (typeof ans === 'object' && ans.fileName) {
          correctInStation++;
          correctTotal++;
        } else if (correctOpt !== undefined && ans === correctOpt) {
          correctInStation++;
          correctTotal++;
        }
      }
    });

    const ptsPerQ = numQ > 0 ? (4 / numQ) : 0;
    const stationScore = numQ > 0 ? Math.min(4, Math.round((correctInStation * ptsPerQ) * 10) / 10) : 0;
    
    breakdown[sNum] = {
      title: cfg.title,
      correct: correctInStation,
      total: numQ,
      score: stationScore,
      maxScore: 4,
      ptsPerQ: Math.round(ptsPerQ * 10) / 10
    };
    totalScore += stationScore;
  }

  totalScore = Math.min(20, Math.round(totalScore * 10) / 10);
  return { totalScore, correctTotal, questionsTotal, breakdown };
}
window.calcFinalQuizScore = calcFinalQuizScore;

function getTotalVirtualQuestionsCount() {
  const optionsCount = document.querySelectorAll('.j-options').length;
  const proofCount = document.querySelectorAll('.j-proof-upload-box').length;
  const totalInDOM = optionsCount + proofCount;
  if (totalInDOM > 0) return totalInDOM;
  return Object.keys(APP.journeyCorrectAnswers || {}).length || 15;
}
window.getTotalVirtualQuestionsCount = getTotalVirtualQuestionsCount;

function getTotalVirtualVideosCount() {
  if (window.LANDING_VIDEOS && window.LANDING_VIDEOS.length > 0) {
    return window.LANDING_VIDEOS.length;
  }
  const videoElements = document.querySelectorAll('video');
  return videoElements.length > 0 ? videoElements.length : 1;
}
window.getTotalVirtualVideosCount = getTotalVirtualVideosCount;

function getPointsPerVideo() {
  const count = getTotalVirtualVideosCount();
  return Math.round((15 / count) * 10) / 10;
}
window.getPointsPerVideo = getPointsPerVideo;

function awardVideoPoints(videoIndex = 0, watchedSec = 0, dur = 0, isCompleted = true) {
  if (!APP.watchedVideosList) APP.watchedVideosList = {};
  APP.watchedVideosList[videoIndex] = true;
  APP.watchedJourneyVideo = true;
  saveStudentProgress();

  const studentId = (typeof getEffectiveStudentId === 'function') ? getEffectiveStudentId() : '';
  const studentName = APP.journeyStudentName || localStorage.getItem('uhb_student_name') || '';
  const videos = window.LANDING_VIDEOS || [];
  const v = videos[videoIndex] || {};

  // Post to backend database
  if (studentId && studentId !== 'guest_student') {
    try {
      fetch('/api/student/video-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          student_name: studentName,
          video_index: videoIndex,
          video_url: v.url || '',
          video_caption: v.caption || `المقطع ${videoIndex + 1}`,
          watched_seconds: watchedSec,
          video_duration: dur,
          is_completed: isCompleted
        })
      }).then(r => r.json()).then(d => {
        if (d.success) console.log(`[Video Watch] 🎥 Recorded view for video #${videoIndex} in DB!`);
      }).catch(err => console.log('Video tracking note:', err));
    } catch(e) {}
  }

  // ─── Station Video Points: if this video is linked to a station, award explore points ───
  const stationVideos = window.STATION_VIDEOS || [];
  if (stationVideos.length > 0 && v.url) {
    // Find station video by matching URL or index
    const matchedSV = stationVideos.find(sv => sv.url === v.url);
    if (matchedSV && matchedSV.station_num) {
      const stVideoDocId = `station-video-${matchedSV.id}`;
      console.log(`[Video Watch] 🏫 Video belongs to station ${matchedSV.station_num}, awarding explore points as "${stVideoDocId}"`);
      if (typeof awardDocumentExplorePoints === 'function') {
        awardDocumentExplorePoints(stVideoDocId, matchedSV.title);
      }
    }
  }
}
window.awardVideoPoints = awardVideoPoints;

