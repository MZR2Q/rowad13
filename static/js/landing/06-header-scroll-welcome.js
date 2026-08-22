// ─── DYNAMIC HEADER SCROLL LISTENER (RAF THROTTLED & ANTI-JITTER) ───
let _headerScrollTicking = false;
let _headerIsScrolled = false;
window.addEventListener('scroll', function() {
  if (!_headerScrollTicking) {
    window.requestAnimationFrame(function() {
      const nav = document.getElementById('glass-nav');
      if (nav) {
        const shouldBeScrolled = window.scrollY > 30;
        if (shouldBeScrolled !== _headerIsScrolled) {
          _headerIsScrolled = shouldBeScrolled;
          if (_headerIsScrolled) {
            nav.classList.add('scrolled');
          } else {
            nav.classList.remove('scrolled');
          }
        }
      }
      _headerScrollTicking = false;
    });
    _headerScrollTicking = true;
  }
}, { passive: true });


/* ═══════════════════════════════════════════════════════════════
   STUDENT PROFILE & PROGRESS PERSISTENCE (SMART RECOGNITION & DB SYNC)
   ═══════════════════════════════════════════════════════════════ */

async function syncStudentProgressToBackend(studentId) {
  const effectiveId = studentId || getEffectiveStudentId();
  if (!effectiveId || effectiveId === 'guest_student') return;

  const explorePts = getStudentExplorePoints(effectiveId);
  const quizPts = getStudentQuizPoints(effectiveId);
  const campusPts = getStudentCampusPoints(effectiveId);
  
  // Calculate workshop points from expedition progress
  let wsPts = 0;
  try {
    const exp = localStorage.getItem('uoh_expedition_progress_' + effectiveId);
    if (exp) {
      const p = JSON.parse(exp);
      if (p && p.workshops) wsPts = Object.keys(p.workshops).length * 5;
    }
  } catch(e) {}

  const totalPts = getStudentTotalCombinedPoints(effectiveId);

  let exploredDocs = {};
  try { exploredDocs = JSON.parse(localStorage.getItem('uhb_explored_docs_' + effectiveId) || '{}'); } catch(e) {}
  
  let quizData = {};
  try { quizData = JSON.parse(localStorage.getItem('uhb_student_' + effectiveId) || '{}'); } catch(e) {}
  if (!quizData || typeof quizData !== 'object') quizData = {};
  if (!quizData.answered && APP.journeyAnswered) quizData.answered = APP.journeyAnswered;
  if (!quizData.checklistVerified && APP.checklistVerified) quizData.checklistVerified = APP.checklistVerified;
  
  const firstEmailUrl = localStorage.getItem(`uhb_first_proof_email_${effectiveId}`);
  const firstEmailName = localStorage.getItem(`uhb_first_proof_name_email_${effectiveId}`) || 'outlook_proof_attempt1.png';
  const firstEmailTime = localStorage.getItem(`uhb_first_proof_time_email_${effectiveId}`);

  const firstBbUrl = localStorage.getItem(`uhb_first_proof_bb_${effectiveId}`);
  const firstBbName = localStorage.getItem(`uhb_first_proof_name_bb_${effectiveId}`) || 'blackboard_proof_attempt1.png';
  const firstBbTime = localStorage.getItem(`uhb_first_proof_time_bb_${effectiveId}`);

  const firstEmailObj = APP.journeyFirstAttemptAnswered?.[10] || (firstEmailUrl ? { dataUrl: firstEmailUrl, fileName: firstEmailName, type: 'email', timestamp: firstEmailTime } : null);
  const firstBbObj = APP.journeyFirstAttemptAnswered?.[11] || (firstBbUrl ? { dataUrl: firstBbUrl, fileName: firstBbName, type: 'bb', timestamp: firstBbTime } : null);

  const activeEmailUrl = localStorage.getItem(`uhb_proof_email_${effectiveId}`);
  const activeEmailName = localStorage.getItem(`uhb_proof_name_email_${effectiveId}`) || 'outlook_proof.png';
  const activeBbUrl = localStorage.getItem(`uhb_proof_bb_${effectiveId}`);
  const activeBbName = localStorage.getItem(`uhb_proof_name_bb_${effectiveId}`) || 'blackboard_proof.png';

  const activeEmailObj = APP.journeyAnswered?.[10] || (activeEmailUrl ? { dataUrl: activeEmailUrl, fileName: activeEmailName, type: 'email' } : null);
  const activeBbObj = APP.journeyAnswered?.[11] || (activeBbUrl ? { dataUrl: activeBbUrl, fileName: activeBbName, type: 'bb' } : null);

  // Attach first attempt proofs (Permanent, certified proof of 1st attempt)
  quizData.firstAttemptProofs = {
    email: firstEmailObj,
    blackboard: firstBbObj
  };

  quizData.latestProofs = {
    email: activeEmailObj,
    blackboard: activeBbObj
  };

  // Primary proofs sent to admin is FIRST ATTEMPT PROOFS
  quizData.proofs = {
    email: firstEmailObj || activeEmailObj,
    blackboard: firstBbObj || activeBbObj
  };

  // Attach first attempt metadata for admin review
  if (APP.journeyFirstAttemptSaved || firstEmailObj || firstBbObj) {
    quizData.firstAttempt = {
      time: APP.journeyFirstAttemptTime || 0,
      score: APP.journeyFirstAttemptScore || 0,
      answered: APP.journeyFirstAttemptAnswered || {},
      attemptCount: 1
    };
  }

  // Attach complete attempts history (attempts 1, 2, 3...) for tracking student progress in reports
  quizData.attemptsHistory = APP.journeyAttemptsHistory || [];
  quizData.total_attempts = APP.journeyAttemptCount || (APP.journeyAttemptsHistory ? APP.journeyAttemptsHistory.length : 1);

  let campusData = {};
  try { campusData = JSON.parse(localStorage.getItem('uoh_campus_journey_v10_' + effectiveId) || '{}'); } catch(e) {}

  const studentName = APP.journeyStudentName || localStorage.getItem('uhb_student_name') || `طالب ${effectiveId}`;

  try {
    const res = await fetch('/api/student/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: effectiveId,
        student_name: studentName,
        explore_points: explorePts,
        quiz_points: quizPts,
        campus_points: campusPts,
        workshop_points: wsPts || 0,
        total_points: totalPts,
        explored_docs: exploredDocs,
        quiz_data: quizData,
        campus_data: campusData
      })
    });
    const result = await res.json();
    if (result.success) {
      console.log(`[Student DB] 💾 Progress successfully synced to SQLite for ${effectiveId}: ${totalPts} pts`);
    }
  } catch (e) {
    console.warn('[Student DB] Background sync error:', e);
  }
}
window.syncStudentProgressToBackend = syncStudentProgressToBackend;

async function fetchStudentProgressFromBackend(studentId) {
  if (!studentId || studentId === 'guest_student') return null;
  const cleanId = String(studentId).trim();
  try {
    const res = await fetch(`/api/student/progress?student_id=${encodeURIComponent(cleanId)}`);
    const data = await res.json();

    if (data.success && data.found && data.data) {
      const dbProgress = data.data;
      console.log(`[Student DB] ⚡ Loaded persistent progress from SQLite for ${cleanId}:`, dbProgress);

      // ══════════════════════════════════════════════════════════════
      // GLOBAL RESET EPOCH CHECK: If admin wiped data, clear local cache
      // ══════════════════════════════════════════════════════════════
      const serverEpoch = data.global_reset_epoch || '';
      const localEpochKey = 'uhb_global_reset_epoch';
      const localEpoch = localStorage.getItem(localEpochKey) || '';
      
      if (serverEpoch && serverEpoch !== localEpoch) {
        console.log(`[Student DB] 🔄 Global reset detected! Server epoch: ${serverEpoch}, Local: ${localEpoch}. Clearing ALL cached data.`);
        
        // Clear ALL student-related localStorage keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('uhb_explored_docs_') ||
            key.startsWith('uhb_student_') ||
            key.startsWith('uoh_campus_journey_') ||
            key.startsWith('uhb_workshop_') ||
            key.startsWith('uhb_proof_') ||
            key.startsWith('uhb_first_proof_') ||
            key === 'uhb_student_name' ||
            key === 'uhb_journey_latest_session'
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        
        // Reset in-memory state
        APP.journeyAnswered = {};
        APP.journeyFirstAttemptAnswered = {};
        APP.journeySlide = 0;
        APP.journeyScore = 0;
        APP.journeySeconds = 0;
        APP.journeyAttemptCount = 0;
        APP.journeyAttemptsHistory = [];
        APP.journeyQuizCompleted = false;
        APP.journeyFirstAttemptSaved = false;
        
        // Save new epoch
        localStorage.setItem(localEpochKey, serverEpoch);
        
        console.log(`[Student DB] ✅ Cleared ${keysToRemove.length} cached keys. Local state reset.`);
        
        // Don't merge stale localStorage, just use DB data (which is empty after wipe)
        if (typeof updateStudentBadgeUI === 'function') updateStudentBadgeUI();
        if (typeof updateLiveStudentDashboard === 'function') updateLiveStudentDashboard();
        return dbProgress;
      }

      // 1. Sync explored documents: Merge DB + Local docs (Never lose viewed docs!)
      const localExpKey = `uhb_explored_docs_${cleanId}`;
      const dbExp = dbProgress.explored_docs || {};
      let localExp = {};
      try { localExp = JSON.parse(localStorage.getItem(localExpKey) || '{}'); } catch(e) {}
      const mergedExp = Object.assign({}, localExp, dbExp);
      localStorage.setItem(localExpKey, JSON.stringify(mergedExp));

      // 2. Sync campus progress
      const localCampusKey = `uoh_campus_journey_v10_${cleanId}`;
      const dbCampus = dbProgress.campus_data || {};
      let localCampus = {};
      try { localCampus = JSON.parse(localStorage.getItem(localCampusKey) || '{}'); } catch(e) {}
      const campusObj = {
        visited: Object.assign({}, localCampus.visited || {}, dbCampus.visited || {}),
        scanned: Object.assign({}, localCampus.scanned || {}, dbCampus.scanned || {}),
        points: Math.max(Number(dbProgress.campus_points) || 0, Number(localCampus.points) || 0),
        studentId: cleanId
      };
      localStorage.setItem(localCampusKey, JSON.stringify(campusObj));
      localStorage.setItem('uoh_campus_journey_v10', JSON.stringify(campusObj));

      // 3. Sync quiz progress
      const localQuizKey = `uhb_student_${cleanId}`;
      const dbQuiz = dbProgress.quiz_data || {};
      let localQuiz = {};
      try { localQuiz = JSON.parse(localStorage.getItem(localQuizKey) || '{}'); } catch(e) {}
      const mergedQuiz = Object.assign({}, dbQuiz, localQuiz, { studentId: cleanId });
      if (dbQuiz.answered || localQuiz.answered) {
        mergedQuiz.answered = Object.assign({}, dbQuiz.answered || {}, localQuiz.answered || {});
        // === PRIVACY: Strip proof entries that belong to other students ===
        [10, 11, '10', '11'].forEach(proofKey => {
          const proof = mergedQuiz.answered[proofKey];
          if (proof && typeof proof === 'object') {
            const pUrl = proof.url || proof.dataUrl || '';
            if (pUrl && pUrl.startsWith('/static/uploads/proofs/') && !pUrl.includes(cleanId)) {
              console.log(`[Privacy] Stripped foreign proof from quiz_data.answered[${proofKey}] for ${cleanId}`);
              delete mergedQuiz.answered[proofKey];
            }
          }
        });
      }
      localStorage.setItem(localQuizKey, JSON.stringify(mergedQuiz));

      if (dbProgress.student_name && (!APP.journeyStudentName || APP.journeyStudentName.startsWith('طالب'))) {
        APP.journeyStudentName = dbProgress.student_name;
        localStorage.setItem('uhb_student_name', dbProgress.student_name);
      }

      // ═══ CRITICAL: Store DB points as authoritative floor values ═══
      // Frontend recalculation may produce lower values (e.g. before journeyCorrectAnswers loads)
      // DB values are the source of truth — never show less than what DB has
      APP._dbPoints = {
        explore: Number(dbProgress.explore_points) || 0,
        quiz: Number(dbProgress.quiz_points) || 0,
        campus: Number(dbProgress.campus_points) || 0,
        workshop: Number(dbProgress.workshop_points) || 0,
        total: Number(dbProgress.total_points) || 0
      };
      console.log('[Student DB] 📌 DB authoritative points stored:', APP._dbPoints);

      // Also restore in-memory quiz state from merged data
      if (mergedQuiz.answered) APP.journeyAnswered = mergedQuiz.answered;
      if (mergedQuiz.firstAttemptSaved) APP.journeyFirstAttemptSaved = true;
      if (mergedQuiz.firstAttemptAnswered) APP.journeyFirstAttemptAnswered = mergedQuiz.firstAttemptAnswered;
      if (mergedQuiz.attemptsHistory) APP.journeyAttemptsHistory = mergedQuiz.attemptsHistory;
      if (mergedQuiz.attemptCount) APP.journeyAttemptCount = mergedQuiz.attemptCount;

      // Restore UI across all systems
      if (typeof restoreExploredDocumentsUI === 'function') restoreExploredDocumentsUI();
      if (typeof loadCampusProgress === 'function') loadCampusProgress();
      if (typeof updateStudentBadgeUI === 'function') updateStudentBadgeUI();
      if (typeof updateLiveStudentDashboard === 'function') updateLiveStudentDashboard();
      if (typeof syncStandaloneWorkshopsVisuals === 'function') syncStandaloneWorkshopsVisuals();

      // NOTE: Do NOT sync back here — it would restore wiped data.
      // saveStudentProgress() handles syncing only when student takes action.
      return dbProgress;

    } else if (data.success && !data.found) {
      // If DB has no record yet, sync current local session to DB
      console.log(`[Student DB] 🔄 Initializing DB record for student ${cleanId}`);
      syncStudentProgressToBackend(cleanId);
    }
  } catch (e) {
    console.warn('[Student DB] Fetch error:', e);
  }
  return null;
}
window.fetchStudentProgressFromBackend = fetchStudentProgressFromBackend;

function identifyAndSyncStudent(studentId, studentName) {
  if (!studentId) return null;
  const cleanId = String(studentId).trim();
  if (!cleanId || cleanId === 'guest_student') return null;

  // 1. Reset in-memory state completely to prevent cross-student data leakage
  resetStudentInMemoryState(cleanId, studentName);

  APP.journeyStudentId = cleanId;
  try {
    localStorage.setItem('uhb_student_id', cleanId);
    localStorage.setItem('uhb_last_student_id', cleanId);
    if (studentName) {
      APP.journeyStudentName = studentName;
      localStorage.setItem('uhb_student_name', studentName);
    }
  } catch(e) {}

  // 2. Load this student's own progress (strictly isolated by student_id)
  const saved = loadStudentProgress(cleanId);
  if (saved) {
    if (saved.studentName) APP.journeyStudentName = saved.studentName;
    APP.journeyAnswered = saved.answered || {};
    APP.journeySeconds = saved.seconds || 0;
    APP.journeySlide = saved.slide || 4;
    APP.checklistAnswers = saved.checklistAnswers || {};
    APP.checklistVerified = saved.checklistVerified || {};
    APP.watchedJourneyVideo = saved.watchedVideo || false;
    APP.watchedVideosList = saved.watchedVideosList || {};
    APP.journeyFirstAttemptSaved = saved.firstAttemptSaved || false;
    APP.journeyFirstAttemptTime = saved.firstAttemptTime || 0;
    APP.journeyFirstAttemptScore = saved.firstAttemptScore || 0;
    APP.journeyFirstAttemptAnswered = saved.firstAttemptAnswered || null;
    APP.journeyAttemptsHistory = saved.attemptsHistory || [];
    APP.journeyAttemptCount = saved.attemptCount || 1;
    APP.journeyAllCompleted = saved.allCompleted || false;
  }

  // 3. Verify student ID against Official University Roster
  fetch(`/api/student/verify-id?student_id=${encodeURIComponent(cleanId)}`)
    .then(r => r.json())
    .then(data => {
      if (data.success && data.found && data.student) {
        APP.journeyStudentName = data.student.full_name;
        APP.journeyStudentCollege = data.student.college;
        APP.journeyStudentGender = data.student.gender;
        try {
          localStorage.setItem('uhb_student_name', data.student.full_name);
          localStorage.setItem('uhb_student_college', data.student.college);
          localStorage.setItem('uhb_student_gender', data.student.gender);
          localStorage.setItem('uhb_student_mobile', data.student.mobile_phone || '');
          localStorage.setItem('uhb_student_national_id', data.student.national_id || '');
        } catch(e) {}

        const chipName = document.getElementById('student-chip-name');
        if (chipName) chipName.textContent = data.student.full_name;
        updateStudentBadgeUI();
      }
    })
    .catch(e => console.warn('[Student Verify]', e));

  // Restore UI across all systems seamlessly
  if (typeof restoreExploredDocumentsUI === 'function') restoreExploredDocumentsUI();
  if (typeof loadCampusProgress === 'function') loadCampusProgress();
  if (typeof updateScore === 'function') updateScore();
  if (typeof updateStudentBadgeUI === 'function') updateStudentBadgeUI();
  if (typeof updateLiveStudentDashboard === 'function') updateLiveStudentDashboard();
  if (typeof restoreJourneyProofUI === 'function') restoreJourneyProofUI();

  // Async sync with database
  fetchStudentProgressFromBackend(cleanId).then(() => {
    syncStudentProgressToBackend(cleanId);
  });

  return cleanId;
}
window.identifyAndSyncStudent = identifyAndSyncStudent;

function loadStudentProgress(studentId) {
  try {
    const cleanId = studentId || getEffectiveStudentId();
    if (!cleanId || cleanId === 'guest_student') return null;
    const raw = localStorage.getItem('uhb_student_' + cleanId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed) {
      if (parsed.checklistVerified) APP.checklistVerified = parsed.checklistVerified;
      if (parsed.checklistAnswers) APP.checklistAnswers = parsed.checklistAnswers;
      if (parsed.answered) {
        // === PRIVACY: Strip proof entries from other students before loading ===
        [10, 11, '10', '11'].forEach(pk => {
          const p = parsed.answered[pk];
          if (p && typeof p === 'object') {
            const pUrl = p.url || p.dataUrl || '';
            if (pUrl && pUrl.startsWith('/static/uploads/proofs/') && !pUrl.includes(cleanId)) {
              delete parsed.answered[pk];
            }
          }
        });
        // === RESTART: Strip proof entries if journey was restarted ===
        if (parsed.journeyRestarted) {
          [10, 11, '10', '11'].forEach(pk => delete parsed.answered[pk]);
        }
        APP.journeyAnswered = parsed.answered;
      }
      // Quiz score is derived from APP.journeyAnswered, not stored as a flat number
      if (parsed.seconds !== undefined) APP.journeySeconds = parsed.seconds;
      if (parsed.watchedVideo !== undefined) APP.watchedJourneyVideo = parsed.watchedVideo;
      if (parsed.watchedVideosList) APP.watchedVideosList = parsed.watchedVideosList;
      // First attempt tracking
      if (parsed.firstAttemptTime !== undefined) APP.journeyFirstAttemptTime = parsed.firstAttemptTime;
      if (parsed.firstAttemptScore !== undefined) APP.journeyFirstAttemptScore = parsed.firstAttemptScore;
      if (parsed.firstAttemptSaved) APP.journeyFirstAttemptSaved = true;
      if (parsed.firstAttemptAnswered) APP.journeyFirstAttemptAnswered = parsed.firstAttemptAnswered;
      if (parsed.attemptsHistory) APP.journeyAttemptsHistory = parsed.attemptsHistory;
      if (parsed.allCompleted) APP.journeyAllCompleted = true;
      if (parsed.attemptCount) APP.journeyAttemptCount = parsed.attemptCount;
      if (parsed.journeyRestarted) APP.journeyRestarted = true;
    }
    return parsed;
  } catch(e) { return null; }
}

// ─── Sync debounce state ──────────────────────────────────────────────────────
let _syncDebounceTimer = null;
let _lastSyncTime = 0;
const _SYNC_DEBOUNCE_MS = 8000;  // 8 seconds between API calls
const _SYNC_MIN_INTERVAL_MS = 3000;  // Never sync faster than 3s

function saveStudentProgress(opts = {}) {
  const effectiveId = getEffectiveStudentId();
  APP.journeyStudentId = effectiveId;
  if (!APP.journeyStudentName) {
    APP.journeyStudentName = localStorage.getItem('uhb_student_name') || `طالب رواد`;
  }

  const data = {
    studentId: effectiveId,
    studentName: APP.journeyStudentName,
    score: APP.journeyScore || 0,
    slide: APP.journeySlide || 1,
    seconds: APP.journeySeconds || 0,
    answered: APP.journeyAnswered || {},
    checklistVerified: APP.checklistVerified || {},
    checklistAnswers: APP.checklistAnswers || {},
    watchedVideo: APP.watchedJourneyVideo || false,
    watchedVideosList: APP.watchedVideosList || {},
    videoPointsAwarded: APP.videoPointsAwarded || false,
    firstAttemptTime: APP.journeyFirstAttemptTime || 0,
    firstAttemptScore: APP.journeyFirstAttemptScore || 0,
    firstAttemptSaved: APP.journeyFirstAttemptSaved || false,
    firstAttemptAnswered: APP.journeyFirstAttemptAnswered || null,
    attemptsHistory: APP.journeyAttemptsHistory || [],
    allCompleted: APP.journeyAllCompleted || false,
    attemptCount: APP.journeyAttemptCount || 1,
    journeyRestarted: APP.journeyRestarted || false,
    lastActive: new Date().toISOString()
  };
  try {
    if (effectiveId !== 'guest_student') {
      localStorage.setItem('uhb_student_' + effectiveId, JSON.stringify(data));
      localStorage.setItem('uhb_student_id', effectiveId);
      localStorage.setItem('uhb_last_student_id', effectiveId);
    }
    localStorage.setItem('uhb_journey_latest_session', JSON.stringify(data));
  } catch(e) {
    console.error('Error saving progress:', e);
  }
  updateStudentBadgeUI();

  // ─── Smart debounced backend sync ────────────────────────────────────────
  // opts.immediate = true → sync right away (proof uploads, quiz completion)
  // Normal saves are debounced to reduce API calls under high load
  if (typeof syncStudentProgressToBackend === 'function') {
    const immediate = opts.immediate === true;
    const now = Date.now();
    const timeSinceLast = now - _lastSyncTime;

    if (immediate && timeSinceLast >= _SYNC_MIN_INTERVAL_MS) {
      clearTimeout(_syncDebounceTimer);
      _lastSyncTime = now;
      syncStudentProgressToBackend(effectiveId);
    } else if (immediate) {
      // Too soon — schedule in 1 second
      clearTimeout(_syncDebounceTimer);
      _syncDebounceTimer = setTimeout(() => {
        _lastSyncTime = Date.now();
        syncStudentProgressToBackend(effectiveId);
      }, 1000);
    } else {
      // Regular save — debounce
      clearTimeout(_syncDebounceTimer);
      _syncDebounceTimer = setTimeout(() => {
        _lastSyncTime = Date.now();
        syncStudentProgressToBackend(effectiveId);
      }, _SYNC_DEBOUNCE_MS);
    }
  }
}

function getStudentExplorePoints(studentId) {
  const effectiveId = studentId || getEffectiveStudentId();
  let viewed = {};
  
  if (effectiveId && effectiveId !== 'guest_student') {
    try { viewed = JSON.parse(localStorage.getItem(`uhb_explored_docs_${effectiveId}`) || '{}'); } catch(e) {}
  } else {
    try { viewed = JSON.parse(localStorage.getItem('uhb_explored_docs_guest_student') || '{}'); } catch(e) {}
  }
  
  let total = 0;
  Object.values(viewed).forEach(item => {
    if (item && item.pts) total += Number(item.pts);
  });
  const calculated = Math.min(75, Math.round(total * 10) / 10);
  // Use DB value as floor if available
  const dbFloor = (APP._dbPoints && APP._dbPoints.explore) || 0;
  return Math.max(calculated, dbFloor);
}
window.getStudentExplorePoints = getStudentExplorePoints;

function getStudentQuizPoints(studentId) {
  const effectiveId = studentId || getEffectiveStudentId();
  const saved = loadStudentProgress(effectiveId);
  if (!saved) return 0;

  // ═══ CRITICAL: Points are ONLY from the FIRST attempt ═══
  // If first attempt answers were saved, use THOSE exclusively for scoring.
  // Subsequent attempts (2nd, 3rd...) do NOT affect points.
  let answersToScore = null;
  if (saved.firstAttemptSaved && saved.firstAttemptAnswered && Object.keys(saved.firstAttemptAnswered).length > 0) {
    answersToScore = saved.firstAttemptAnswered;
  } else if (saved.answered && Object.keys(saved.answered).length > 0) {
    // Student has not yet completed first attempt — use current answers in progress
    answersToScore = saved.answered;
  }
  
  if (!answersToScore || Object.keys(answersToScore).length === 0) return 0;
  
  let totalScore = 0;
  for (let sNum = 1; sNum <= 5; sNum++) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (!cfg || !cfg.questionSlides) continue;
    const qSlides = cfg.questionSlides;
    const numQ = qSlides.length;
    let correctInStation = 0;

    qSlides.forEach(slideIdx => {
      const ans = answersToScore[slideIdx];
      const correctOpt = APP.journeyCorrectAnswers ? APP.journeyCorrectAnswers[slideIdx] : undefined;
      if (ans !== undefined) {
        if (typeof ans === 'object' && ans.fileName) {
          correctInStation++;
        } else if (correctOpt !== undefined && ans === correctOpt) {
          correctInStation++;
        }
      }
    });
    const ptsPerQ = numQ > 0 ? (4 / numQ) : 0;
    totalScore += numQ > 0 ? Math.min(4, Math.round((correctInStation * ptsPerQ) * 10) / 10) : 0;
  }
  const calculated = Math.min(20, Math.round(totalScore * 10) / 10);
  // Use DB value as floor if available (fixes race condition with journeyCorrectAnswers)
  const dbFloor = (APP._dbPoints && APP._dbPoints.quiz) || 0;
  return Math.max(calculated, dbFloor);
}
window.getStudentQuizPoints = getStudentQuizPoints;

function getStudentCampusPoints(studentId) {
  const effectiveId = studentId || getEffectiveStudentId();
  try {
    let saved = null;
    if (effectiveId && effectiveId !== 'guest_student') {
      saved = localStorage.getItem('uoh_campus_journey_v10_' + effectiveId) 
           || localStorage.getItem('uoh_expedition_progress_' + effectiveId);
    } else {
      saved = localStorage.getItem('uoh_campus_journey_v10')
           || localStorage.getItem('uoh_expedition_progress_latest');
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      const calculated = Number(parsed.points || parsed.totalPoints) || 0;
      const dbFloor = (APP._dbPoints && APP._dbPoints.campus) || 0;
      return Math.max(calculated, dbFloor);
    }
  } catch(e) {}
  // Use DB value as floor even if no localStorage data
  return (APP._dbPoints && APP._dbPoints.campus) || 0;
}
window.getStudentCampusPoints = getStudentCampusPoints;

function getStudentTotalCombinedPoints(studentId) {
  const effectiveId = studentId || getEffectiveStudentId();
  const explorePts = getStudentExplorePoints(effectiveId);
  const quizPts = getStudentQuizPoints(effectiveId);
  const campusPts = getStudentCampusPoints(effectiveId);
  
  let wsPts = 0;
  try {
    let exp = null;
    if (effectiveId && effectiveId !== 'guest_student') {
      exp = localStorage.getItem('uoh_expedition_progress_' + effectiveId);
    } else {
      exp = localStorage.getItem('uoh_expedition_progress_latest');
    }
    if (exp) {
      const p = JSON.parse(exp);
      if (p && p.workshops) {
        wsPts = Object.keys(p.workshops).length * 5;
      }
    }
  } catch(e) {}

  const combined = explorePts + quizPts + campusPts + wsPts;
  const calculated = Math.min(200, Math.round(combined * 10) / 10);
  // Use DB total as floor — never show less than what DB has
  const dbFloor = (APP._dbPoints && APP._dbPoints.total) || 0;
  return Math.max(calculated, dbFloor);
}
window.getStudentTotalCombinedPoints = getStudentTotalCombinedPoints;

function updateStudentBadgeUI() {
  const effectiveId = getEffectiveStudentId();
  updateLiveStudentDashboard();
  
  const saved = loadStudentProgress(effectiveId);
  const totalPts = getStudentTotalCombinedPoints(effectiveId);

  const chip = document.getElementById('student-status-chip');
  const chipName = document.getElementById('student-chip-name');
  const chipScore = document.getElementById('student-chip-points');
  const chipLevel = document.getElementById('student-chip-level');
  const chipIcon = document.getElementById('student-chip-icon');

  // Overall Progress % across 200 points
  const progressPct = Math.min(100, Math.round((totalPts / 200) * 100));

  let levelName = 'مستكشف 🧭';
  let levelIconClass = 'fa-solid fa-compass';
  let levelThemeClass = 'lvl-explorer';

  if (totalPts >= 120 || progressPct >= 80) {
    levelName = 'سفير رواد 👑';
    levelIconClass = 'fa-solid fa-crown';
    levelThemeClass = 'lvl-ambassador';
  } else if (totalPts >= 75 || progressPct >= 50) {
    levelName = 'متمكن 🎖️';
    levelIconClass = 'fa-solid fa-award';
    levelThemeClass = 'lvl-proficient';
  } else if (totalPts >= 30 || progressPct >= 20) {
    levelName = 'مبادر 🚀';
    levelIconClass = 'fa-solid fa-rocket';
    levelThemeClass = 'lvl-initiator';
  } else {
    levelName = 'مستكشف 🧭';
    levelIconClass = 'fa-solid fa-compass';
    levelThemeClass = 'lvl-explorer';
  }

  if (chip && chipName && chipScore) {
    const displayId = (effectiveId && effectiveId !== 'guest_student') ? effectiveId : (saved?.studentId || '2230005799');
    chipName.textContent = 'الرقم: ' + displayId;
    chipScore.textContent = totalPts;
    if (chipLevel) chipLevel.textContent = levelName;
    if (chipIcon) {
      chipIcon.innerHTML = `<i class="${levelIconClass}"></i><span class="chip-pulse-ring"></span>`;
    }
    chip.className = 'student-status-chip ' + levelThemeClass;
    chip.style.display = 'inline-flex';
  }
}

let pendingStudentActionCallback = null;

function ensureStudentIdentified(callback) {
  const currentId = APP.journeyStudentId || localStorage.getItem('uhb_last_student_id');
  if (currentId) {
    if (!APP.journeyStudentId) {
      APP.journeyStudentId = currentId;
      const saved = loadStudentProgress(currentId);
      if (saved) {
        APP.journeyAnswered = saved.answered || {};
        APP.watchedJourneyVideo = saved.watchedVideo || false;
      }
    }
    if (callback) callback();
    return;
  }
  pendingStudentActionCallback = callback;
  openStudentQuickModal();
}

function openStudentQuickModal() {
  const modal = document.getElementById('student-quick-modal');
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => {
      document.getElementById('quick-student-id-input')?.focus();
    }, 150);
  }
}

function closeStudentQuickModal() {
  const modal = document.getElementById('student-quick-modal');
  if (modal) modal.classList.remove('active');
  if (pendingStudentActionCallback) {
    const cb = pendingStudentActionCallback;
    pendingStudentActionCallback = null;
    cb();
  }
}

function submitStudentQuickModal(e) {
  if (e) e.preventDefault();
  const idInput = document.getElementById('quick-student-id-input');
  const id = idInput?.value.trim();
  if (!id) return;
  
  APP.journeyStudentId = id;
  const saved = loadStudentProgress(id);
  if (saved) {
    APP.journeyAnswered = saved.answered || {};
    APP.watchedJourneyVideo = saved.watchedVideo || false;
    APP.videoPointsAwarded = saved.videoPointsAwarded || false;
  } else {
    saveStudentProgress();
  }
  
  updateScore();
  updateStudentBadgeUI();
  
  const modal = document.getElementById('student-quick-modal');
  if (modal) modal.classList.remove('active');
  
  if (pendingStudentActionCallback) {
    const cb = pendingStudentActionCallback;
    pendingStudentActionCallback = null;
    cb();
  }
}

function checkExistingStudentOnInput() {
  const idInput = document.getElementById('j-reg-id');
  const resumeBox = document.getElementById('j-resume-box');
  const startBtn = document.getElementById('j-btn-start-reg');
  if (!idInput) return;
  
  const id = idInput.value.trim();
  if (id.length >= 5) {
    const saved = loadStudentProgress(id);
    if (saved) {
      if (resumeBox) {
        const answeredCount = Object.keys(saved.answered || {}).length;
        resumeBox.style.display = 'block';
        resumeBox.innerHTML = `
          <div class="j-resume-banner" style="background:rgba(188,136,89,0.12); border:1.5px solid var(--gold); border-radius:12px; padding:12px; text-align:right;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <i class="fa-solid fa-sparkles" style="color:var(--gold); font-size:1.2rem;"></i>
              <div>
                <strong style="color:var(--text-main); font-size:0.92rem;">مرحباً بك (الرقم: ${saved.studentId})</strong>
                <p style="margin:0; font-size:0.8rem; color:var(--text-sub);">لديك تقدم محفوظ: <b>${saved.score || 0} نقطة</b> | <b>${answeredCount}/15 سؤال محلول</b></p>
              </div>
            </div>
            <button type="button" class="j-btn-primary" style="width:100%; justify-content:center; padding:10px; font-size:0.88rem; gap:8px;" onclick="resumeSavedJourney('${id}')">
              <i class="fa-solid fa-forward-step"></i> متابعة من حيث توقفت (المرحلة ${saved.slide || 1})
            </button>
          </div>
        `;
      }
      if (startBtn) startBtn.querySelector('span').textContent = 'بدء من المحطة الأولى';
    } else {
      if (resumeBox) resumeBox.style.display = 'none';
      if (startBtn) startBtn.querySelector('span').textContent = 'ابدأ الرحلة!';
    }
  } else {
    if (resumeBox) resumeBox.style.display = 'none';
    if (startBtn) startBtn.querySelector('span').textContent = 'ابدأ الرحلة!';
  }
}

function resumeSavedJourney(studentId) {
  const saved = loadStudentProgress(studentId);
  if (!saved) return;
  APP.journeyStudentId = saved.studentId;
  APP.journeyStudentName = saved.studentName;
  APP.journeyAnswered = saved.answered || {};
  APP.watchedJourneyVideo = saved.watchedVideo || false;

  updateScore();
  buildStepper();

  // Restore answer selections in UI
  Object.keys(APP.journeyAnswered).forEach(slideIdx => {
    const selectedOpt = APP.journeyAnswered[slideIdx];
    // Skip proof upload slides (they store objects, not option indices)
    if (typeof selectedOpt === 'object' && selectedOpt !== null && selectedOpt.fileName) return;
    const correctOpt = APP.journeyCorrectAnswers[slideIdx];
    const container = document.getElementById(`j-options-${slideIdx}`);
    if (container) {
      const buttons = container.querySelectorAll('.j-option-btn');
      buttons.forEach((b, i) => {
        b.classList.add('selected');
        if (i === correctOpt) b.classList.add('correct');
        if (i === selectedOpt && selectedOpt !== correctOpt) b.classList.add('wrong');
      });
    }
  });

  const targetSlide = saved.slide > 0 ? saved.slide : 1;
  goToSlide(targetSlide);
}

/* ═══════════════════════════════════════════════════════════════
   VERIFIED VIDEO PLAYER (Station 1) — Full 100% Mandatory Viewing
   ═══════════════════════════════════════════════════════════════ */

function initJourneyVideo() {
  const video = document.getElementById('journey-welcome-video');
  if (!video) return;
  
  const status = document.getElementById('journey-video-status');
  const progressFill = document.getElementById('journey-video-progress-fill');
  const nextBtn = document.getElementById('j-btn-next');

  // If already watched previously by this student
  if (APP.watchedJourneyVideo) {
    if (status) {
      status.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> تمت مشاهدة الفيديو مسبقاً بنجاح!';
      status.style.color = '#10b981';
      status.style.borderColor = 'rgba(16,185,129,0.3)';
    }
    if (progressFill) progressFill.style.width = '100%';
    if (nextBtn && APP.journeySlide === 1) nextBtn.disabled = false;
    return;
  }

  // Lock next button until full completion
  if (nextBtn && APP.journeySlide === 1) nextBtn.disabled = true;

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
    if (progressFill) progressFill.style.width = pct + '%';
    
    if (pct >= 98 || video.ended) {
      APP.watchedJourneyVideo = true;
      awardVideoPoints();
      saveStudentProgress();
      if (status) {
        status.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> 🎉 أحسنت! أكملت مشاهدة الفيديو كاملاً — كسبت النقاط وتم فتح المتابعة الآن!';
        status.style.color = '#10b981';
        status.style.borderColor = 'rgba(16,185,129,0.3)';
      }
      if (nextBtn && APP.journeySlide === 1) {
        nextBtn.disabled = false;
      }
    } else {
      if (status) {
        status.innerHTML = `<i class="fa-solid fa-play" style="color:var(--gold);"></i> جاري المشاهدة: ${pct}% (مشاهدة المقطع كاملاً إلزامية لفتح المتابعة)`;
      }
    }
  });

  video.addEventListener('ended', () => {
    APP.watchedJourneyVideo = true;
    awardVideoPoints();
    saveStudentProgress();
    if (status) {
      status.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> 🎉 أحسنت! أكملت مشاهدة الفيديو كاملاً — كسبت النقاط وتم فتح المتابعة الآن!';
      status.style.color = '#10b981';
      status.style.borderColor = 'rgba(16,185,129,0.3)';
    }
    if (nextBtn && APP.journeySlide === 1) {
      nextBtn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   POINTS TOAST & CELEBRATION (ROYAL LUXURY FLOATING TOAST)
   ═══════════════════════════════════════════════════════════════ */

function showPointsToast(msg, pointsBadge) {
  let toast = document.getElementById('points-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'points-toast-notification';
    toast.className = 'points-toast-notification';
  }
  document.body.appendChild(toast); // Topmost stacking position

  let displayMsg = msg || 'تم كسب النقاط بنجاح!';
  let displayBadge = pointsBadge || '';
  
  if (!displayBadge && msg) {
    const match = msg.match(/(\+\d+(\.\d+)?\s*(نقاط|نقطة)?)/);
    if (match) {
      displayBadge = match[1];
    }
  }

  toast.innerHTML = `
    <div class="points-toast-icon-wrap">
      <svg class="toast-success-svg" viewBox="0 0 52 52">
        <circle class="toast-success-circle" cx="26" cy="26" r="23"/>
        <path class="toast-success-check" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
      </svg>
    </div>
    <div class="points-toast-content">
      <span class="points-toast-title">${displayMsg}</span>
      <span class="points-toast-sub">تم توثيق تقدمك وإضافة النقاط بنجاح إلى رصيدك</span>
    </div>
    ${displayBadge ? `<span class="points-toast-badge-pill">${displayBadge}</span>` : ''}
  `;

  toast.onclick = () => {
    toast.classList.remove('show');
  };

  toast.classList.remove('show');
  void toast.offsetWidth; // Trigger reflow for fresh animation sequence
  toast.classList.add('show');

  clearTimeout(window.pointsToastTimeout);
  window.pointsToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 5800);
}
window.showPointsToast = showPointsToast;

// awardVideoPoints is already defined globally at the scoring engine section above.
// This shim ensures backward compatibility with the hero video carousel calls.
// DO NOT redefine awardVideoPoints here - it's set via window.awardVideoPoints above.

// Track Home Page Video for points across all carousel clips
function initHeroVideoPoints() {
  const heroVideo = document.getElementById('welcome-video');
  if (!heroVideo) return;
  
  // Track that user has actually interacted with the video
  let userActuallyPlayed = {};

  heroVideo.addEventListener('playing', () => {
    const idx = window.CURRENT_VIDEO_INDEX || 0;
    userActuallyPlayed[idx] = true;
  });

  heroVideo.addEventListener('timeupdate', () => {
    if (!heroVideo.duration) return;
    const idx = window.CURRENT_VIDEO_INDEX || 0;
    if (!userActuallyPlayed[idx]) return;
    
    const pct = (heroVideo.currentTime / heroVideo.duration) * 100;
    if (pct >= 90 || heroVideo.ended) {
      awardVideoPoints(idx, heroVideo.currentTime, heroVideo.duration, true);
    }
  });

  heroVideo.addEventListener('ended', () => {
    const idx = window.CURRENT_VIDEO_INDEX || 0;
    if (!userActuallyPlayed[idx]) return;
    awardVideoPoints(idx, heroVideo.duration || heroVideo.currentTime, heroVideo.duration || heroVideo.currentTime, true);
  });
}
document.addEventListener('DOMContentLoaded', initHeroVideoPoints);

/* ═══════════════════════════════════════════════════════════════
   LIVE CALCULATION FOR 'يظهر للطالب في حسابه'
   ═══════════════════════════════════════════════════════════════ */

function updateLiveStudentDashboard() {
  const currentId = getEffectiveStudentId();
  const saved = currentId ? (loadStudentProgress(currentId) || {}) : {};
  
  // 1. Unified Total Points calculation
  const totalPts = getStudentTotalCombinedPoints(currentId);
  const explorePts = getStudentExplorePoints(currentId);
  const quizPts = getStudentQuizPoints(currentId);
  const campusPts = getStudentCampusPoints(currentId);

  // 2. Completed Stations in Virtual Journey (5 stations total)
  // Use first attempt answers as the official record; fall back to current answers if first not yet locked
  const officialAnswers = (saved.firstAttemptSaved && saved.firstAttemptAnswered && Object.keys(saved.firstAttemptAnswered).length > 0)
    ? saved.firstAttemptAnswered
    : (saved.answered || APP.journeyAnswered || {});
  let completedStationsCount = 0;
  const stationQuizzes = { station1: [4, 5, 6], station2: [10, 11, 12], station3: [15, 16, 17], station4: [21, 22, 23], station5: [27, 28, 29] };
  Object.keys(stationQuizzes).forEach(stKey => {
    const qList = stationQuizzes[stKey];
    if (qList.every(qIdx => officialAnswers[qIdx] !== undefined)) completedStationsCount++;
  });

  const remainingStations = Math.max(0, 5 - completedStationsCount);
  const progressPct = Math.min(100, Math.round((totalPts / 200) * 100));

  // 3. Rank Calculation
  let rankStr = '#4 ⭐ (المستوى البرونزي)';
  if (totalPts >= 120) rankStr = '#1 🥇 (المستوى الماسي)';
  else if (totalPts >= 75) rankStr = '#2 🥈 (المستوى الذهبي)';
  else if (totalPts >= 30) rankStr = '#3 🥉 (المستوى الفضي)';
  else if (totalPts > 0) rankStr = '#4 ⭐ (المستوى البرونزي)';
  else rankStr = '#5 (مبتدئ)';

  // Update UI Elements
  const elPoints = document.getElementById('acc-stat-points');
  const elProgress = document.getElementById('acc-stat-progress');
  const elRemaining = document.getElementById('acc-stat-remaining');
  const elRank = document.getElementById('acc-stat-rank');
  const tabId = document.getElementById('tab-student-id-display');

  if (elPoints) elPoints.textContent = totalPts + ' نقطة';
  if (elProgress) elProgress.textContent = progressPct + '%';
  if (elRemaining) {
    if (remainingStations === 0) {
      elRemaining.textContent = 'مكتملة بالكامل 🎉';
      elRemaining.style.color = '#10b981';
    } else {
      elRemaining.textContent = remainingStations + ' محطات';
    }
  }
  if (elRank) elRank.textContent = rankStr;

  if (tabId && currentId && currentId !== 'guest_student') {
    tabId.textContent = 'الرقم: ' + currentId;
    tabId.style.display = 'inline-block';
  }
}

// Hook dashboard update inside updateStudentBadgeUI

/* ═══════════════════════════════════════════════════════════════
   STUDENT PROFILE MODAL LOGIC (Matching 4 KPIs in user image)
   ═══════════════════════════════════════════════════════════════ */

function openRowadAwardModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('modal-rowad-award-guide');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 15);
    document.body.style.overflow = 'hidden';
    if (typeof playExpeditionAudioChime === 'function') {
      playExpeditionAudioChime('select');
    }
  }
}

function closeRowadAwardModal() {
  const modal = document.getElementById('modal-rowad-award-guide');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      if (!modal.classList.contains('active')) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }, 200);
  }
}

function openStudentProfileModal(e) {
  if (e) e.preventDefault();
  closeMobileMenu();
  const currentId = getEffectiveStudentId();
  if (!currentId || currentId === 'guest_student') {
    openStudentQuickModal();
    return;
  }

  renderStudentProfileModalData(currentId);
  const modal = document.getElementById('student-profile-modal');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }
}

function closeStudentProfileModal() {
  const modal = document.getElementById('student-profile-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      if (!modal.classList.contains('active')) {
        modal.style.display = 'none';
      }
    }, 200);
  }
}

function renderStudentProfileModalData(studentId) {
  const effectiveId = studentId || getEffectiveStudentId();
  const saved = loadStudentProgress(effectiveId) || {
    studentId: effectiveId,
    score: APP.journeyScore || 0,
    answered: APP.journeyAnswered || {}
  };

  // ═══════════════════════════════════════════════════════
  // 0. POPULATE OFFICIAL STUDENT CREDENTIALS BIO CARD
  // ═══════════════════════════════════════════════════════
  const sName = APP.journeyStudentName || localStorage.getItem('uhb_student_name') || (effectiveId !== 'guest_student' ? `طالب ${effectiveId}` : 'زائر رواد');
  const sCollege = APP.journeyStudentCollege || localStorage.getItem('uhb_student_college') || (effectiveId !== 'guest_student' ? 'جامعة حفر الباطن' : '—');
  const sGender = APP.journeyStudentGender || localStorage.getItem('uhb_student_gender') || '—';
  const sMobile = localStorage.getItem('uhb_student_mobile') || '—';
  const sNationalId = localStorage.getItem('uhb_student_national_id') || '—';

  const fnEl = document.getElementById('sp-bio-fullname');
  if (fnEl) fnEl.textContent = sName;

  const colEl = document.getElementById('sp-bio-college');
  if (colEl) colEl.innerHTML = `<i class="fa-solid fa-building-columns"></i> ${sCollege}`;

  const idEl2 = document.getElementById('sp-bio-studentid');
  if (idEl2) idEl2.textContent = effectiveId;

  const natEl = document.getElementById('sp-bio-nationalid');
  if (natEl) natEl.textContent = sNationalId;

  const mobEl = document.getElementById('sp-bio-mobile');
  if (mobEl) mobEl.textContent = sMobile;

  const genEl = document.getElementById('sp-bio-gender');
  if (genEl) genEl.textContent = sGender;

  // ═══════════════════════════════════════════════════════
  // 1. EXPLORATION DOCUMENTS CALCULATION (استكشاف الأدلة واللوائح: 75 نقطة)
  // ═══════════════════════════════════════════════════════
  const storageKey = `uhb_explored_docs_${effectiveId}`;
  let viewedDocs = {};
  try { viewedDocs = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) {}

  let explorePoints = 0;
  let exploredDocsHtml = '';
  let totalDocsCount = 0;
  let exploredDocsCount = 0;

  for (let sNum = 1; sNum <= 5; sNum++) {
    const station = VIRTUAL_STATIONS_CONFIG[sNum];
    if (!station || !station.items) continue;
    
    station.items.forEach(item => {
      totalDocsCount++;
      const isExplored = Boolean(viewedDocs[item.id] || (item.altIds && item.altIds.some(alt => viewedDocs[alt])));
      const pts = item.dynamicPts || item.defaultPts || (Math.round((station.totalPts / station.items.length) * 10) / 10);
      if (isExplored) {
        exploredDocsCount++;
        explorePoints += pts;
      }
      const icon = item.isVideo ? '🎬' : '📄';
      const typeLabel = item.isVideo ? 'مشاهدة' : 'تصفح';
      exploredDocsHtml += `
        <div class="sp-sum-item ${isExplored ? 'done' : ''}">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;" title="${item.name}">${isExplored ? icon : '⏳'} ${item.name}</span>
          <span class="sp-sum-badge ${isExplored ? 'done' : 'empty'}">${isExplored ? `تم ال${typeLabel} ✔️ (+${pts.toFixed(1)})` : `لم يُستكشف (+${pts.toFixed(1)})`}</span>
        </div>
      `;
    });
  }
  explorePoints = Math.min(75, Math.round(explorePoints * 10) / 10);

  // ═══════════════════════════════════════════════════════
  // 2. COMPREHENSIVE QUIZ CALCULATION (اختبار ختام الرحلة: 20 نقطة)
  // ═══════════════════════════════════════════════════════
  const quizData = calcFinalQuizScore();
  const quizPoints = quizData.totalScore || 0;
  const quizCorrectCount = quizData.correctTotal || 0;
  const quizTotalCount = quizData.questionsTotal || 15;

  let quizStationsHtml = '';
  Object.keys(quizData.breakdown || {}).forEach(sNum => {
    const brk = quizData.breakdown[sNum];
    const isDone = brk.correct === brk.total;
    const isPartial = brk.correct > 0 && !isDone;
    let badgeClass = isDone ? 'done' : isPartial ? 'pending' : 'empty';
    let badgeText = isDone ? `مكتملة (${brk.score}/4 نقاط) ✔️` : isPartial ? `${brk.correct}/${brk.total} صح (+${brk.score} نقاط)` : `0/${brk.total} (${brk.score}/4 نقاط)`;
    
    quizStationsHtml += `
      <div class="sp-sum-item ${isDone ? 'done' : ''}">
        <span>📝 ${brk.title}</span>
        <span class="sp-sum-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
  });

  // ═══════════════════════════════════════════════════════
  // 3. CAMPUS IN-PERSON JOURNEY CALCULATION (الرحلة الحضورية: 105 نقاط)
  // ═══════════════════════════════════════════════════════
  const campusStationsList = [
    { id: 'affairs', name: 'عمادة شؤون الطلاب', pts: 10 },
    { id: 'admission', name: 'عمادة القبول والتسجيل', pts: 10 },
    { id: 'elearn', name: 'التعليم الإلكتروني', pts: 10 },
    { id: 'colleges', name: 'الكليات الأكاديمية', pts: 10 },
    { id: 'clubs', name: 'الأندية الطلابية', pts: 10 },
    { id: 'clinic', name: 'المركز الطبي', pts: 10 }
  ];

  let campusStationsDoneCount = 0;
  let campusBoothsPoints = 0;
  let campusStationsHtml = '';

  campusStationsList.forEach(st => {
    const isVisited = Boolean(EXPEDITION_STATIONS_DATA && EXPEDITION_STATIONS_DATA[st.id] && EXPEDITION_STATIONS_DATA[st.id].completed);
    if (isVisited) {
      campusStationsDoneCount++;
      campusBoothsPoints += st.pts;
    }
    campusStationsHtml += `
      <div class="sp-sum-item ${isVisited ? 'done' : ''}">
        <span>🏛️ ${st.name}</span>
        <span class="sp-sum-badge ${isVisited ? 'done' : 'empty'}">${isVisited ? 'تم المسح (+10) ✔️' : 'لم يُمسح (+10)'}</span>
      </div>
    `;
  });

  // Workshops (9 workshops x 5 pts = 45 pts)
  let campusWorkshopsDoneCount = 0;
  for (let w = 1; w <= 9; w++) {
    const wsRow = document.getElementById(`ws-row-${w}`) || document.getElementById(`campus-ws-${w}`);
    if (wsRow && wsRow.classList.contains('is-done')) {
      campusWorkshopsDoneCount++;
    }
  }
  const campusWorkshopsPoints = campusWorkshopsDoneCount * 5;
  const campusTotalPoints = getStudentCampusPoints(effectiveId);

  // ═══════════════════════════════════════════════════════
  // 4. OVERALL COMBINED POINTS & MILESTONES (المجموع الكلي: 200 نقطة)
  // ═══════════════════════════════════════════════════════
  const grandTotalPoints = getStudentTotalCombinedPoints(effectiveId);
  const overallProgressPct = Math.min(100, Math.round((grandTotalPoints / 200) * 100));

  const pointsEl = document.getElementById('sp-kpi-points');
  if (pointsEl) {
    pointsEl.innerHTML = `<strong style="font-size:1.2rem; color:#872A08;">${grandTotalPoints} نقطة</strong> <span style="font-size:0.75rem; color:#64748b; display:block;">(استكشاف: ${explorePoints} + اختبار: ${quizPoints} + حضورية: ${campusTotalPoints})</span>`;
  }

  const idEl = document.getElementById('sp-pill-id-text');
  if (idEl) idEl.textContent = 'الرقم: ' + effectiveId;

  const progEl = document.getElementById('sp-kpi-progress');
  if (progEl) progEl.textContent = overallProgressPct + '%';

  const remDocs = Math.max(0, totalDocsCount - exploredDocsCount);
  const remBooths = Math.max(0, 6 - campusStationsDoneCount);
  const remEl = document.getElementById('sp-kpi-remaining');
  if (remEl) {
    remEl.innerHTML = `<span style="color:#872A08;">${remDocs + remBooths} مهام متبقية</span> <span style="font-size:0.72rem; color:#64748b; display:block;">(${remDocs} أدلة + ${remBooths} أجنحة)</span>`;
  }

  // Milestone Tiers
  let rankText = 'مستكشف 🧭';
  let activeLevelIdx = 1;

  if (grandTotalPoints >= 120 || overallProgressPct >= 80) {
    rankText = 'سفير رواد 👑';
    activeLevelIdx = 4;
  } else if (grandTotalPoints >= 75 || overallProgressPct >= 50) {
    rankText = 'متمكن 🎖️';
    activeLevelIdx = 3;
  } else if (grandTotalPoints >= 30 || overallProgressPct >= 20) {
    rankText = 'مبادر 🚀';
    activeLevelIdx = 2;
  } else {
    rankText = 'مستكشف 🧭';
    activeLevelIdx = 1;
  }

  const rankEl = document.getElementById('sp-kpi-rank');
  if (rankEl) rankEl.textContent = rankText;

  // Highlight Achievement Levels in Modal
  [1, 2, 3, 4].forEach(lvl => {
    const node = document.getElementById('sp-lvl-' + lvl);
    if (node) {
      node.classList.remove('unlocked', 'active-current');
      if (lvl < activeLevelIdx) {
        node.classList.add('unlocked');
      } else if (lvl === activeLevelIdx) {
        node.classList.add('active-current', 'unlocked');
      }
    }
  });

  const fillBar = document.getElementById('sp-levels-fill-bar');
  if (fillBar) {
    const fillPercentages = { 1: 15, 2: 45, 3: 75, 4: 100 };
    fillBar.style.width = (fillPercentages[activeLevelIdx] || 0) + '%';
  }

  // ═══════════════════════════════════════════════════════
  // 5. RENDER 3 DISTINCT TRACKS IN SUMMARY
  // ═══════════════════════════════════════════════════════
  const summaryGrid = document.getElementById('sp-summary-grid');
  if (summaryGrid) {
    summaryGrid.innerHTML = `
      <!-- ═══ TRACK 1: VIRTUAL EXPLORATION ═══ -->
      <div class="sp-journey-track-block" style="grid-column: 1 / -1; background:#FFF; border:1.5px solid #EAE0D5; border-radius:14px; padding:14px 16px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #F1ECE6; padding-bottom:8px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px; font-weight:900; color:#7A2416; font-size:0.95rem;">
            <i class="fa-solid fa-compass"></i>
            <span>1. استكشاف أدلة ولوائح الرحلة الافتراضية (75 نقطة)</span>
          </div>
          <span style="background:rgba(122,36,22,0.08); color:#7A2416; padding:3px 10px; border-radius:12px; font-size:0.78rem; font-weight:900;">
            ${explorePoints} / 75 نقطة
          </span>
        </div>
        <div class="sp-summary-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:8px;">
          ${exploredDocsHtml}
        </div>
      </div>

      <!-- ═══ TRACK 2: COMPREHENSIVE QUIZ ═══ -->
      <div class="sp-journey-track-block" style="grid-column: 1 / -1; background:#FFF; border:1.5px solid #EAE0D5; border-radius:14px; padding:14px 16px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #F1ECE6; padding-bottom:8px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px; font-weight:900; color:#7A2416; font-size:0.95rem;">
            <i class="fa-solid fa-graduation-cap"></i>
            <span>2. اختبار ختام الرحلة الشامل (20 نقطة)</span>
          </div>
          <span style="background:rgba(122,36,22,0.08); color:#7A2416; padding:3px 10px; border-radius:12px; font-size:0.78rem; font-weight:900;">
            ${quizPoints} / 20 نقطة (${quizCorrectCount}/${quizTotalCount} صحيحة)
          </span>
        </div>

        <!-- Smart Live Performance Breakdown -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:10px; background:#F8FAFC; padding:8px 10px; border-radius:10px; border:1px solid #E2E8F0; text-align:center;">
          <div>
            <div style="font-size:0.68rem; color:#64748b; font-weight:700;">الإجابات الصحيحة</div>
            <strong style="font-size:0.92rem; color:#059669;">${quizCorrectCount} ✔️</strong>
          </div>
          <div>
            <div style="font-size:0.68rem; color:#64748b; font-weight:700;">الإجابات الخاطئة</div>
            <strong style="font-size:0.92rem; color:#dc2626;">${Math.max(0, quizTotalCount - quizCorrectCount)} ❌</strong>
          </div>
          <div>
            <div style="font-size:0.68rem; color:#64748b; font-weight:700;">نسبة الدقة</div>
            <strong style="font-size:0.92rem; color:#872A08;">${quizTotalCount > 0 ? Math.round((quizCorrectCount / quizTotalCount) * 100) : 0}% 🎯</strong>
          </div>
          <div>
            <div style="font-size:0.68rem; color:#64748b; font-weight:700;">الوقت المستغرق</div>
            <strong style="font-size:0.92rem; color:#475569;">${Math.floor((saved.seconds || APP.journeySeconds || 0) / 60)}د ${Math.round((saved.seconds || APP.journeySeconds || 0) % 60)}ث ⏱️</strong>
          </div>
        </div>

        <div class="sp-summary-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:8px;">
          ${quizStationsHtml}
        </div>
      </div>

      <!-- ═══ TRACK 3: CAMPUS IN-PERSON JOURNEY ═══ -->
      <div class="sp-journey-track-block" style="grid-column: 1 / -1; background:#FFF; border:1.5px solid #EAE0D5; border-radius:14px; padding:14px 16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #F1ECE6; padding-bottom:8px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px; font-weight:900; color:#872A08; font-size:0.95rem;">
            <i class="fa-solid fa-map-location-dot"></i>
            <span>3. رحلة رواد الحضورية (105 نقاط)</span>
          </div>
          <span style="background:rgba(188,136,89,0.15); color:#872A08; padding:3px 10px; border-radius:12px; font-size:0.78rem; font-weight:900;">
            ${campusTotalPoints} / 105 نقاط
          </span>
        </div>
        <div style="font-size:0.76rem; color:#64748b; font-weight:700; margin-bottom:8px;">
          🏛️ أركان الكليات والعمادات (6 أجنحة × 10 = 60 نقطة) + 🎓 الورش التثقيفية (9 ورش × 5 = 45 نقطة):
        </div>
        <div class="sp-summary-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:8px; margin-bottom:8px;">
          ${campusStationsHtml}
        </div>
        <div class="sp-sum-item ${campusWorkshopsDoneCount >= 5 ? 'done' : ''}" style="margin-top:6px;">
          <span>🎯 ورش بناء المهارات (المسار الثالث)</span>
          <span class="sp-sum-badge ${campusWorkshopsDoneCount > 0 ? (campusWorkshopsDoneCount >= 9 ? 'done' : 'pending') : 'empty'}">
            ${campusWorkshopsDoneCount}/9 ورش منجزة (+${campusWorkshopsPoints} نقاط)
          </span>
        </div>
      </div>
    `;
  }
}

function resumeJourneyFromProfile() {
  closeStudentProfileModal();
  const currentId = APP.journeyStudentId || localStorage.getItem('uhb_last_student_id');
  if (currentId) {
    resumeSavedJourney(currentId);
  } else {
    startJourney();
  }
}

function switchStudentAccount() {
  closeStudentProfileModal();
  localStorage.removeItem('uhb_last_student_id');
  APP.journeyStudentId = null;
  APP.journeyScore = 0;
  APP.journeyAnswered = {};
  APP.watchedJourneyVideo = false;
  updateStudentBadgeUI();
  openStudentQuickModal();
}


// ─── Smart Royal Personalized Welcome ──────────────────────────
let smartWelcomeTimer = null;

function triggerSmartRoyalWelcome(studentId, isNewRegistration) {
  const banner = document.getElementById('smart-royal-welcome');
  const title = document.getElementById('srw-student-name-title');
  const sub = document.getElementById('srw-student-sub');
  const timeGreeting = document.getElementById('srw-time-greeting');
  const timerBar = document.getElementById('srw-timer-bar');
  if (!banner) return;

  const hour = new Date().getHours();
  let timeStr = 'أهلاً بك';
  if (hour >= 5 && hour < 12) timeStr = '☀️ صباح التميز والريادة';
  else if (hour >= 12 && hour < 17) timeStr = '✨ طاب مساؤك بالخير والنجاح';
  else timeStr = '🌙 مساء الإبداع والهمة العالية';

  if (timeGreeting) {
    timeGreeting.innerHTML = `<i class="fa-solid fa-sparkles"></i> ${timeStr}`;
  }

  const saved = studentId ? loadStudentProgress(studentId) : null;
  const displayName = (saved && saved.studentName) ? saved.studentName : (studentId ? `الرقم: ${studentId}` : 'رائدنا المتميز');

  if (title) {
    title.innerHTML = `أهلاً وسهلاً بك <span class="srw-highlight">${displayName}</span> في رواد 13! 🎓`;
  }

  if (sub) {
    if (isNewRegistration) {
      sub.innerHTML = `تم حفظ ملفك الجامعي بنجاح! استكشف الحرم واجمع نقاطك لتنال وسام (سفير رواد).`;
    } else {
      const totalCombined = getStudentTotalCombinedPoints(studentId);
      sub.innerHTML = `رصيدك الحالي <strong>${totalCombined} نقطة</strong> من 200 • واصل مسيرتك الرائعة اليوم!`;
    }
  }

  banner.style.display = 'block';
  setTimeout(() => {
    banner.classList.add('show');
    if (timerBar) {
      timerBar.style.width = '0%';
    }
  }, 30);

  if (smartWelcomeTimer) clearTimeout(smartWelcomeTimer);
  smartWelcomeTimer = setTimeout(() => {
    closeSmartRoyalWelcome();
  }, 6500);
}

function closeSmartRoyalWelcome() {
  const banner = document.getElementById('smart-royal-welcome');
  if (!banner) return;
  banner.classList.remove('show');
  setTimeout(() => {
    banner.style.display = 'none';
  }, 450);
}

/* ═══ 3-COLUMN INTERACTIVE EXPEDITION SYSTEM JAVASCRIPT LOGIC ═══ */
let expeditionAudioCtx = null;
function playExpeditionAudioChime(mode = 'success') {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!expeditionAudioCtx && AC) expeditionAudioCtx = new AC();
    if (expeditionAudioCtx && expeditionAudioCtx.state === 'suspended') expeditionAudioCtx.resume();
    if (!expeditionAudioCtx) return;

    const osc = expeditionAudioCtx.createOscillator();
    const gain = expeditionAudioCtx.createGain();
    osc.connect(gain);
    gain.connect(expeditionAudioCtx.destination);
    const now = expeditionAudioCtx.currentTime;

    if (mode === 'success') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.22);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (mode === 'unlock') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.3);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (mode === 'select') {
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch(e) {}
}

// ─── College Reception Schedule (Side Panel) ────────────────────
const VENUE_NOTES = {
  male: 'تقام جميع اللقاءات في مسرح مبنى (2)، باستثناء لقاء الكلية التطبيقية في مقر الكلية التطبيقية.',
  female: 'تقام جميع اللقاءات في مسرح مجمع ياسمين، باستثناء كلية الآداب والكلية التطبيقية في مسرح مجمع واحات وكلية إدارة الأعمال في مسرح مجمع الناخية.'
};

function toggleScheduleSidePanel(e) {
  if (e && e.preventDefault) e.preventDefault();
  // From dropdown → use the proper overlay (right side)
  openOverlay('colleges-schedule', e);
}

function renderScheduleInCenter() {
  const heroCenter = document.getElementById('hero-center-content');
  if (!heroCenter) return;
  heroCenter.innerHTML = `
    <div class="campus-survey-container" style="padding:14px 10px;">
      <div style="font-size:0.95rem;font-weight:900;color:#2D0F08;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-calendar-days" style="color:#7A2416; font-size:1.15rem;"></i>
        جدول اللقاءات التعريفية بالكليات
      </div>
      <div style="background:#FAF8F5; border:1px solid #E8DDD2; border-right:3px solid #7A2416; border-radius:10px; padding:8px 12px; margin-bottom:12px; font-size:0.8rem; color:#6B5B50; line-height:1.6;">
        <strong style="color:#7A2416; display:block; margin-bottom:2px;">📌 إرشادات الحضور والأركان:</strong>
        اللقاءات مخصصة لطلاب الكلية المحددة مع إتاحة الحضور لكافة الطلاب، وتظل أركان المعرض وبوثات الفعاليات مفتوحة للجميع طوال أيام البرنامج.
      </div>
      <div class="sched-tabs" style="margin-bottom:10px;">
        <button class="sched-tab active" id="sched-tab-male" onclick="switchSchedTab('male')">
          <i class="fa-solid fa-person"></i> برنامج الطلاب
        </button>
        <button class="sched-tab" id="sched-tab-female" onclick="switchSchedTab('female')">
          <i class="fa-solid fa-person-dress"></i> برنامج الطالبات
        </button>
      </div>
      <div class="sched-table-wrap" style="max-height:320px;overflow-y:auto;">
        <table class="sched-tbl">
          <thead><tr><th>الكلية</th><th>الوقت</th><th>التاريخ</th></tr></thead>
          <tbody>
            <tr><td>كلية الآداب</td><td>9:30 - 10:30</td><td>الأربعاء 26 أغسطس</td></tr>
            <tr><td>كلية إدارة الأعمال</td><td>11:30 - 12:30</td><td>الأربعاء 26 أغسطس</td></tr>
            <tr><td>الكلية التطبيقية</td><td>9:30 - 10:30</td><td>الخميس 27 أغسطس</td></tr>
            <tr><td>السنة المشتركة - الصحي</td><td>11:30 - 12:30</td><td>الخميس 27 أغسطس</td></tr>
            <tr><td>السنة المشتركة - الهندسي</td><td>9:30 - 10:30</td><td>الأحد 30 أغسطس</td></tr>
            <tr><td>كلية العلوم</td><td>11:30 - 12:30</td><td>الأحد 30 أغسطس</td></tr>
            <tr><td>كلية العلوم الطبية التطبيقية</td><td>9:30 - 10:30</td><td>الاثنين 31 أغسطس</td></tr>
            <tr><td>كلية الصيدلة</td><td>11:30 - 12:30</td><td>الاثنين 31 أغسطس</td></tr>
            <tr><td>كلية الهندسة</td><td>9:30 - 10:30</td><td>الثلاثاء 1 سبتمبر</td></tr>
            <tr><td>كلية التمريض</td><td>11:30 - 12:30</td><td>الثلاثاء 1 سبتمبر</td></tr>
            <tr><td>كلية علوم وهندسة الحاسب</td><td>9:30 - 10:30</td><td>الأربعاء 2 سبتمبر</td></tr>
          </tbody>
        </table>
        <div class="sched-venue-note" id="schedVenueNote">
          <i class="fa-solid fa-location-dot"></i>
          <span id="schedVenueText">${VENUE_NOTES.male}</span>
        </div>
      </div>
    </div>
  `;
}

function switchSchedTab(tab) {
  // Update all tab sets (campus map + overlay)
  ['sched-tab-male', 'ov-sched-tab-male'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', tab === 'male');
  });
  ['sched-tab-female', 'ov-sched-tab-female'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', tab === 'female');
  });
  // Update all venue texts (campus map + overlay)
  ['schedVenueText', 'ov-schedVenueText'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = VENUE_NOTES[tab];
  });
}

// Keep for compatibility — no-ops now
function hideSchedulePanel() {}
function toggleSchedulePanel() { toggleScheduleSidePanel(); }

const EXPEDITION_STATIONS_DATA = {
  reception: { id: 'reception', name: 'ركن الاستقبال', fullName: 'ركن الاستقبال — استلام الحقيبة الترحيبية', icon: 'fa-solid fa-gift', pts: 0, completed: false, desc: 'مرحباً بك في الجامعة! امسح الباركود عند ركن الاستقبال لتأكيد حضورك واستلام حقيبتك الترحيبية', hasSurvey: false },
  affairs: { id: 'affairs', name: 'عمادة شؤون الطلاب', fullName: 'ركن عمادة شؤون الطلاب', icon: 'fa-solid fa-users', pts: 10, completed: false, desc: 'التعريف بالخدمات والبرامج والدعم الطلابي', hasSurvey: true },
  admission: { id: 'admission', name: 'عمادة القبول والتسجيل', fullName: 'ركن عمادة القبول والتسجيل', icon: 'fa-solid fa-file-signature', pts: 10, completed: false, desc: 'التعريف بأهم الخدمات الأكاديمية والإجراءات التي يحتاج إليها الطالب', hasSurvey: true },
  elearn: { id: 'elearn', name: 'التعليم الإلكتروني', fullName: 'عمادة التعليم الإلكتروني والتحول الرقمي', icon: 'fa-solid fa-desktop', pts: 10, completed: false, desc: 'التعريف بالخدمات الإلكترونية المقدمة والتطبيقات الرقمية', hasSurvey: true },
  colleges: { id: 'colleges', name: 'الكليات', fullName: 'ركن الكليات الأكاديمية', icon: 'fa-solid fa-building-columns', pts: 10, completed: false, desc: 'التعرف على مبنى الكلية، الأقسام الأكاديمية، القاعات والمختبرات', hasSurvey: true },
  clubs: { id: 'clubs', name: 'الأندية الطلابية', fullName: 'ركن الأندية والأنشطة الطلابية', icon: 'fa-solid fa-people-roof', pts: 10, completed: false, desc: 'عرض الأندية وإتاحة التسجيل أو إبداء الاهتمام بالانضمام إليها', hasSurvey: false },
  clinic: { id: 'clinic', name: 'المركز الطبي', fullName: 'ركن المركز الطبي الجامعي', icon: 'fa-solid fa-heart-pulse', pts: 10, completed: false, desc: 'إجراء فحوصات أولية وتوعية بالخدمات الصحية الجامعية', hasSurvey: false },
  exit: { id: 'exit', name: 'باب المغادرة', fullName: 'باب المغادرة واستبيان الجاهزية', icon: 'fa-solid fa-door-open', pts: 0, completed: false, desc: 'أكمل استبيان الجاهزية قبل مغادرة الرحلة', hasSurvey: true }
};

