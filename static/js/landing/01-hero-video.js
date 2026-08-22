/* ============================================================
   رواد 13 — SPA CONTROLLER v51.0
   Font Awesome 6 Icons  |  Full Browse Journey
   ============================================================ */
'use strict';

const APP = {
  currentOverlay: null,
  regulations: { study: [], discipline: [] },
  currentRegDoc: 'study_exam_regulations',
  calendarData: [],
  calendarFilter: 'all',
  journeyActive: false,
  journeySlide: 0,
  journeyTotalSlides: 36,
  journeyScore: 0,
  journeyTimer: null,
  journeySeconds: 0,
  journeyAnswered: {},
  journeyCorrectAnswers: {}, // Loaded from DB via /api/journey/questions
  journeyQuestionsFromDB: [], // Full question data from DB
  journeyStudentName: '',
  journeyStudentId: '',
  journeyAttemptsHistory: [],
  journeyAttemptCount: 1,
  dropdownOpen: false,
  mobileMenuOpen: false,
};

function resetStudentInMemoryState(studentId, studentName) {
  APP.journeyStudentId = studentId || 'guest_student';
  APP.journeyStudentName = studentName || (studentId && studentId !== 'guest_student' ? `طالب ${studentId}` : 'زائر رواد');
  APP.journeyScore = 0;
  APP.journeySlide = 4;
  APP.journeySeconds = 0;
  APP.journeyAnswered = {};
  APP.journeyAttemptsHistory = [];
  APP.journeyAttemptCount = 1;
  APP.journeyFirstAttemptSaved = false;
  APP.journeyFirstAttemptTime = 0;
  APP.journeyFirstAttemptScore = 0;
  APP.journeyFirstAttemptAnswered = null;
  APP.journeyAllCompleted = false;
  APP.checklistAnswers = {};
  APP.checklistVerified = {};
  APP.watchedJourneyVideo = false;
  APP.watchedVideosList = {};
  APP.videoPointsAwarded = false;
}
window.resetStudentInMemoryState = resetStudentInMemoryState;

function getEffectiveStudentId() {
  if (APP.journeyStudentId && APP.journeyStudentId !== 'guest_student' && String(APP.journeyStudentId).trim().length >= 5) {
    return String(APP.journeyStudentId).trim();
  }
  try {
    const id = localStorage.getItem('uhb_student_id') || localStorage.getItem('uhb_last_student_id');
    if (id && id !== 'guest_student' && String(id).trim().length >= 5) {
      APP.journeyStudentId = String(id).trim();
      return String(id).trim();
    }
  } catch(e) {}
  return 'guest_student';
}
window.getEffectiveStudentId = getEffectiveStudentId;

// ─── GRAND ROYAL INAUGURATION CANVAS & CONFETTI PHYSICS ───
let ceremonyCanvas, ceremonyCtx;
let ceremonyParticles = [];
let confettiParticles = [];
let ceremonyAnimFrame;

function checkCeremonyState() {
  const overlay = document.getElementById('grand-opening-overlay');
  if (!overlay) return true;

  try {
    const isVerified = sessionStorage.getItem('uhb_student_verified') === 'true' ||
                       sessionStorage.getItem('uoh_reception_ceremony_seen') === 'true';
    if (isVerified) {
      overlay.style.display = 'none';
      overlay.classList.add('ribbon-cut');
      document.documentElement.classList.add('ceremony-already-seen');
      document.body.style.overflow = '';
      if (typeof ceremonyAnimFrame !== 'undefined' && ceremonyAnimFrame) {
        cancelAnimationFrame(ceremonyAnimFrame);
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function initCeremonyCanvas() {
  if (checkCeremonyState()) return;

  ceremonyCanvas = document.getElementById('ceremony-canvas');
  if (!ceremonyCanvas) return;
  ceremonyCtx = ceremonyCanvas.getContext('2d');
  
  function resize() {
    ceremonyCanvas.width = window.innerWidth;
    ceremonyCanvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  ceremonyParticles = [];
  for (let i = 0; i < 70; i++) {
    ceremonyParticles.push({
      x: Math.random() * ceremonyCanvas.width,
      y: Math.random() * ceremonyCanvas.height,
      r: Math.random() * 2.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.5 - 0.2,
    });
  }

  function loop() {
    if (!ceremonyCtx) return;
    ceremonyCtx.clearRect(0, 0, ceremonyCanvas.width, ceremonyCanvas.height);

    ceremonyParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < 0) p.y = ceremonyCanvas.height;
      if (p.x < 0) p.x = ceremonyCanvas.width;
      if (p.x > ceremonyCanvas.width) p.x = 0;

      ceremonyCtx.beginPath();
      ceremonyCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ceremonyCtx.fillStyle = `rgba(212, 163, 89, ${p.alpha * 0.7})`;
      ceremonyCtx.shadowBlur = 8;
      ceremonyCtx.shadowColor = '#D4A359';
      ceremonyCtx.fill();
    });

    if (confettiParticles.length > 0) {
      confettiParticles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.008;

        if (p.alpha <= 0) {
          confettiParticles.splice(index, 1);
          return;
        }

        ceremonyCtx.save();
        ceremonyCtx.translate(p.x, p.y);
        ceremonyCtx.rotate(p.rotation);
        ceremonyCtx.fillStyle = p.color;
        ceremonyCtx.globalAlpha = Math.max(0, p.alpha);
        ceremonyCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ceremonyCtx.restore();
      });
    }

    ceremonyAnimFrame = requestAnimationFrame(loop);
  }
  loop();

  const seal = document.getElementById('ribbon-seal');
  if (seal) {
    window.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      seal.style.transform = `perspective(1000px) rotateY(${dx * 18}deg) rotateX(${-dy * 18}deg) scale(1.05)`;
    });
  }
}

function triggerConfettiBurst() {
  if (!ceremonyCanvas) return;
  const colors = ['#fbbf24', '#f59e0b', '#d97706', '#ffffff', '#e11d48', '#10b981'];
  const cx = ceremonyCanvas.width / 2;
  const cy = ceremonyCanvas.height / 2;

  for (let i = 0; i < 180; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 15 + 6;
    confettiParticles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      gravity: 0.24,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      alpha: 1
    });
  }
}

let _studentCheckTimer = null;
function checkStudentIdInput(val) {
  const id = (val || '').trim();
  const title = document.getElementById('op-welcome-title');
  const subtitle = document.getElementById('op-welcome-subtitle');
  const idInput = document.getElementById('opening-student-id-input');
  if (idInput) idInput.classList.remove('input-required-error');

  // Check prefix: Must start with 227
  if (id.length > 0 && !id.startsWith('227')) {
    if (idInput) idInput.style.borderColor = '#DC2626';
    if (title) title.innerHTML = `<span style="color:#DC2626;"><i class="fa-solid fa-user-xmark"></i> تنبيه فئة الطلاب</span>`;
    if (subtitle) subtitle.innerHTML = `<span style="color:#DC2626; font-weight:700;">يُسمح فقط للطلاب المستجدين فقط</span>`;
    return;
  }

  // Check valid length & prefix
  if (id.length === 10 && id.startsWith('227')) {
    if (idInput) idInput.style.borderColor = '#10B981';
    clearTimeout(_studentCheckTimer);
    _studentCheckTimer = setTimeout(() => {
      fetch(`/api/student/verify-id?student_id=${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.found && data.student) {
            if (title) title.innerHTML = `مرحباً بك يا ${data.student.full_name}! <i class="fa-solid fa-graduation-cap" style="color:#D4A359; margin-right:4px;"></i>`;
            if (subtitle) subtitle.innerHTML = `<i class="fa-solid fa-building-columns" style="color:#882D1B; margin-left:4px;"></i><strong>كليتك: ${data.student.college}</strong> • اضغط ابدأ رحلتك التعريفية للانطلاق`;
          } else {
            if (title) title.innerHTML = `<span style="color:#DC2626;"><i class="fa-solid fa-circle-exclamation"></i> رقم جامعي غير مسجل</span>`;
            if (subtitle) subtitle.innerHTML = `<span style="color:#DC2626;">الرقم (${id}) غير مدرج في سجلات الطلاب المعتمدة للجامعة.</span>`;
          }
        })
        .catch(e => console.warn(e));
    }, 200);
  } else if (id.length > 0 && id.length < 10) {
    if (idInput) idInput.style.borderColor = '#D97706';
    if (title) title.innerHTML = `أهلاً بك يا مستجد رواد <i class="fa-solid fa-graduation-cap" style="color:#D4A359; margin-right:4px;"></i>`;
    if (subtitle) subtitle.innerHTML = `اكتب باقي الرقم الجامعي (${id.length}/10 أرقام)...`;
  } else {
    if (idInput) idInput.style.borderColor = '';
    if (title) title.innerHTML = `أهلاً بك في رحاب جامعتك! <i class="fa-solid fa-graduation-cap" style="color:#D4A359; margin-right:4px;"></i>`;
    if (subtitle) subtitle.innerHTML = `أدخل رقمك الجامعي المكون من 10 أرقام (للطلاب المستجدين)`;
  }
}

async function cutOpeningRibbon() {
  const overlay = document.getElementById('grand-opening-overlay');
  const btn = document.getElementById('cut-ribbon-btn');
  const scissors = document.getElementById('ceremonial-scissors');
  const idInput = document.getElementById('opening-student-id-input');

  let studentId = idInput ? idInput.value.trim() : '';

  // 1. If prefix is not 227 -> tell them only freshman allowed
  if (studentId.length > 0 && !studentId.startsWith('227')) {
    if (idInput) {
      idInput.focus();
      idInput.style.borderColor = '#DC2626';
    }
    if (typeof fireToast === 'function') {
      fireToast('⚠️ يُسمح فقط للطلاب المستجدين فقط', 'fa-solid fa-user-xmark');
    }
    return;
  }

  // 2. If fewer/more than 10 digits upon submit -> tell them numbers must be 10 digits
  if (!studentId || studentId.length !== 10 || !/^\d+$/.test(studentId)) {
    if (idInput) {
      idInput.focus();
      idInput.style.borderColor = '#DC2626';
    }
    if (typeof fireToast === 'function') {
      fireToast('⚠️ الرقم الجامعي يجب أن يتكون من 10 أرقام فقط (مثال: 2270005709)', 'fa-solid fa-arrow-up-1-9');
    }
    return;
  }

  // 3. Show verifying spinner on button
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#D3B48B;"></i> <span>جاري التحقق من السجلات الرسمية...</span>`;
    btn.style.background = 'linear-gradient(135deg, #1C0A06, #2D0F08)';
  }

  // 4. Strict Official Verification with Server API
  try {
    const res = await fetch(`/api/student/verify-id?student_id=${encodeURIComponent(studentId)}`);
    const data = await res.json();

    if (!data.success || !data.found || !data.student) {
      // ❌ Unauthorized student ID — Block entry completely!
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-ban" style="color:#fff;"></i> <span>رقم جامعي غير معتمد — تم حظر الدخول</span>`;
        btn.style.background = 'linear-gradient(135deg, #DC2626, #991B1B)';
      }
      if (idInput) {
        idInput.style.borderColor = '#DC2626';
        idInput.focus();
      }
      if (typeof fireToast === 'function') {
        fireToast(data.message || `❌ عذراً، الرقم الجامعي (${studentId}) غير مصرح له بالدخول للمنصة!`, 'fa-solid fa-ban');
      }
      setTimeout(() => {
        if (btn) {
          btn.innerHTML = `<div class="btn-icon-circle"><i class="fa-solid fa-compass"></i></div><span class="btn-text">ابدأ رحلتك التعريفية</span>`;
          btn.style.background = '';
        }
      }, 3000);
      return;
    }

    // ✅ Verified student! Personalize session and continue inauguration
    const stu = data.student;
    APP.journeyStudentId = stu.student_id;
    APP.journeyStudentName = stu.full_name;
    APP.journeyStudentCollege = stu.college;
    APP.journeyStudentGender = stu.gender;

    try {
      sessionStorage.setItem('uhb_student_verified', 'true');
      sessionStorage.setItem('uoh_reception_ceremony_seen', 'true');
      sessionStorage.setItem('uhb_session_student_id', stu.student_id);
      localStorage.setItem('uhb_last_student_id', stu.student_id);
      localStorage.setItem('uhb_student_id', stu.student_id);
      localStorage.setItem('uhb_student_name', stu.full_name);
      localStorage.setItem('uhb_student_college', stu.college);
      localStorage.setItem('uhb_student_gender', stu.gender);
      localStorage.setItem('uhb_student_mobile', stu.mobile_phone || '');
      localStorage.setItem('uhb_student_national_id', stu.national_id || '');
    } catch (e) {}

    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#fff;"></i> <span>أهلاً بك الطالب ${stu.full_name} 🎓</span>`;
      btn.style.background = 'linear-gradient(135deg, #059669, #10B981)';
    }

    if (scissors) {
      scissors.classList.add('snipping');
    }

    // Play welcome audio chime & confetti
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}

    try {
      if (typeof triggerConfettiBurst === 'function') triggerConfettiBurst();
    } catch (e) {}

    // Trigger student sync and badge update
    if (typeof identifyAndSyncStudent === 'function') {
      identifyAndSyncStudent(stu.student_id, stu.full_name);
    }

    // Instantly trigger cut animation and hide overlay
    if (overlay) {
      overlay.classList.add('ribbon-cut');
    }

    setTimeout(() => {
      document.documentElement.classList.add('ceremony-already-seen');
      if (overlay) {
        overlay.style.setProperty('display', 'none', 'important');
        overlay.style.setProperty('opacity', '0', 'important');
        overlay.style.setProperty('visibility', 'hidden', 'important');
        overlay.style.setProperty('pointer-events', 'none', 'important');
      }
      document.body.style.overflow = '';
      if (typeof ceremonyAnimFrame !== 'undefined' && ceremonyAnimFrame) {
        cancelAnimationFrame(ceremonyAnimFrame);
      }
      if (typeof showModernWelcomeToast === 'function') {
        showModernWelcomeToast(stu.full_name, stu.college);
      }
      try { if (typeof updateStudentBadgeUI === 'function') updateStudentBadgeUI(); } catch(e) {}
    }, 450);

  } catch(err) {
    console.error('[Verify ID Error]:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<div class="btn-icon-circle"><i class="fa-solid fa-compass"></i></div><span class="btn-text">ابدأ رحلتك التعريفية</span>`;
      btn.style.background = '';
    }
  }
}
window.cutOpeningRibbon = cutOpeningRibbon;

function initOpeningStudentCheck() {
  const lastId = localStorage.getItem('uhb_last_student_id') || localStorage.getItem('uhb_student_id');
  const idInput = document.getElementById('opening-student-id-input');
  
  if (lastId && lastId.length === 10 && lastId.startsWith('227')) {
    if (idInput) {
      idInput.value = lastId;
      checkStudentIdInput(lastId);
    }
    identifyAndSyncStudent(lastId);
  } else {
    // Evict invalid legacy/test ID
    try {
      localStorage.removeItem('uhb_last_student_id');
      localStorage.removeItem('uhb_student_id');
      sessionStorage.removeItem('uhb_student_verified');
      sessionStorage.removeItem('uoh_reception_ceremony_seen');
      document.documentElement.classList.remove('ceremony-already-seen');
    } catch(e) {}
  }
}
document.addEventListener('DOMContentLoaded', initOpeningStudentCheck);

function replayOpeningCeremony() {
  try {
    sessionStorage.removeItem('uhb_student_verified');
    sessionStorage.removeItem('uoh_reception_ceremony_seen');
    sessionStorage.removeItem('uhb_session_student_id');
    document.documentElement.classList.remove('ceremony-already-seen');
  } catch (e) {}

  const overlay = document.getElementById('grand-opening-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.classList.remove('ribbon-cut');

  const scissors = document.getElementById('ceremonial-scissors');
  if (scissors) scissors.classList.remove('snipping');

  const btn = document.getElementById('cut-ribbon-btn');
  if (btn) {
    btn.style.transform = 'scale(1)';
    btn.innerHTML = `<div class="btn-icon-circle"><i class="fa-solid fa-compass"></i></div><span class="btn-text">ابدأ رحلتك التعريفية</span>`;
  }

  initCeremonyCanvas();
}
window.replayOpeningCeremony = replayOpeningCeremony;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCeremonyCanvas);
} else {
  initCeremonyCanvas();
}

// ─── Royal Institutional Hero Title ───────────────────────
function initHeroTypewriter() {
  const titleEl = document.querySelector('.hero-royal-title');
  if (!titleEl) return;
  titleEl.style.animation = 'heroRoyalFadeIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroTypewriter);
} else {
  initHeroTypewriter();
}

// ─── Video Player ──────────────────────────────────────────
function toggleVideo() {
  const video = document.getElementById('welcome-video');
  const overlay = document.getElementById('video-play-overlay');
  const icon = document.getElementById('video-play-icon');
  const playText = document.getElementById('video-play-text');
  if (!video || !video.querySelector('source')?.src) return;

  if (video.paused || video.muted) {
    // Play — unmute, play, hide overlay
    video.muted = false;
    video.classList.remove('preview-mode');
    video.classList.add('full-mode');
    video.play().catch(() => {});
    overlay?.classList.add('hidden');
    if (icon) icon.className = 'fa-solid fa-pause';
    if (playText) playText.textContent = 'إيقاف مؤقت';
  } else {
    // Pause — show overlay with play button
    video.pause();
    overlay?.classList.remove('hidden');
    if (icon) icon.className = 'fa-solid fa-play';
    if (playText) playText.textContent = 'متابعة المشاهدة';
  }
}

// Allow clicking on the video itself to pause/play and track student watching
document.addEventListener('DOMContentLoaded', () => {
  loadExpeditionProgress();
  const video = document.getElementById('welcome-video');
  if (video) {
    video.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleVideo();
    });
    video.style.cursor = 'pointer';

    // Track watching progress in real time
    video.addEventListener('timeupdate', () => {
      const idx = window.CURRENT_VIDEO_INDEX || 0;
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        const pct = (video.currentTime / video.duration) * 100;
        if (pct >= 75 && (!APP.watchedVideosList || !APP.watchedVideosList[idx])) {
          awardVideoPoints(idx, video.currentTime, video.duration, true);
        }
      }
    });

    video.addEventListener('ended', () => {
      const idx = window.CURRENT_VIDEO_INDEX || 0;
      awardVideoPoints(idx, video.duration || video.currentTime, video.duration || video.currentTime, true);
    });
  }
});

// ─── Video Carousel ────────────────────────────────────────
function switchVideoSlide(dir) {
  const videos = window.LANDING_VIDEOS || [];
  if (videos.length <= 1) return;

  let idx = (window.CURRENT_VIDEO_INDEX || 0) + dir;
  if (idx < 0) idx = videos.length - 1;
  if (idx >= videos.length) idx = 0;
  window.CURRENT_VIDEO_INDEX = idx;

  const video = document.getElementById('welcome-video');
  const overlay = document.getElementById('video-play-overlay');
  const icon = document.getElementById('video-play-icon');
  const playText = document.getElementById('video-play-text');
  const captionDisplay = document.getElementById('video-caption-display');
  const counterNum = document.getElementById('video-current-num');

  if (!video) return;
  const v = videos[idx];

  // Fade out, switch, fade in
  video.classList.remove('preview-mode', 'full-mode');
  setTimeout(() => {
    const src = video.querySelector('source');
    if (src) src.src = v.url;
    video.load();
    video.muted = true;
    video.play().then(() => {
      video.classList.add('preview-mode');
    }).catch(() => {});
  }, 300);

  // Update labels
  if (playText) playText.textContent = v.caption || 'شاهد الفيديو التعريفي';
  if (captionDisplay) captionDisplay.textContent = v.caption || '';
  if (counterNum) counterNum.textContent = idx + 1;

  // Reset overlay
  overlay?.classList.remove('hidden');
  if (icon) icon.className = 'fa-solid fa-play';

  // Update duration for new video
  setTimeout(() => updateVideoDuration(), 500);
}

// ─── Video Duration Display ────────────────────────────────
function updateVideoDuration() {
  const video = document.getElementById('welcome-video');
  const durationEl = document.getElementById('video-duration');
  if (!video || !durationEl) return;

  if (video.readyState >= 1 && video.duration && isFinite(video.duration)) {
    const mins = Math.floor(video.duration / 60);
    const secs = Math.floor(video.duration % 60);
    durationEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  } else {
    video.addEventListener('loadedmetadata', () => {
      if (video.duration && isFinite(video.duration)) {
        const mins = Math.floor(video.duration / 60);
        const secs = Math.floor(video.duration % 60);
        durationEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }, { once: true });
  }
}

// ─── Video Collapse / Expand ────────────────────────────────
function toggleVideoCollapse() {
  const frame = document.getElementById('video-frame');
  const btn = document.getElementById('video-collapse-btn');
  const icon = btn?.querySelector('i');
  if (!frame) return;

  frame.classList.toggle('collapsed');
  if (frame.classList.contains('collapsed')) {
    frame.style.maxHeight = '0px';
    frame.style.overflow = 'hidden';
    frame.style.opacity = '0';
    frame.style.margin = '0';
    frame.style.padding = '0';
    if (icon) icon.className = 'fa-solid fa-chevron-down';
    if (btn) btn.title = 'فتح الفيديو';
    // Pause video
    const video = document.getElementById('welcome-video');
    if (video) video.pause();
  } else {
    frame.style.maxHeight = '';
    frame.style.overflow = '';
    frame.style.opacity = '';
    frame.style.margin = '';
    frame.style.padding = '';
    if (icon) icon.className = 'fa-solid fa-chevron-up';
    if (btn) btn.title = 'إغلاق الفيديو';
  }
}

// ─── Video Fullscreen Toggle ────────────────────────────────
function toggleVideoFullscreen() {
  const container = document.getElementById('video-container');
  const video = document.getElementById('welcome-video');
  const frame = document.getElementById('video-frame');
  if (!container || !video) return;

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    // Try native video fullscreen first
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {
        // Fallback to container fullscreen
        container.requestFullscreen?.().catch(() => {});
      });
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  }
}

// ─── Scroll & Jump to Homepage Video with Auto-Selection ───
function scrollToHomepageVideos(videoIndex) {
  if (typeof closeOverlay === 'function') closeOverlay();
  setTimeout(() => {
    const videoSection = document.getElementById('welcome-video') || document.getElementById('video-frame') || document.getElementById('hero-video-card') || document.querySelector('.hero-video-section');
    if (videoSection) {
      videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // If a specific video index is passed, switch to it
      if (typeof videoIndex === 'number' && window.LANDING_VIDEOS && window.LANDING_VIDEOS[videoIndex]) {
        const currentIdx = window.CURRENT_VIDEO_INDEX || 0;
        const diff = videoIndex - currentIdx;
        if (diff !== 0 && typeof switchVideoSlide === 'function') {
          switchVideoSlide(diff);
        }
      }

      // Golden pulse highlight
      const card = document.getElementById('hero-video-card') || videoSection.closest('.video-showcase-card') || videoSection.parentElement;
      if (card) {
        card.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.boxShadow = '0 0 45px rgba(243,198,73,0.9), 0 0 20px rgba(122,36,22,0.6)';
        card.style.transform = 'scale(1.025)';
        setTimeout(() => {
          card.style.boxShadow = '';
          card.style.transform = '';
        }, 2200);
      }

      if (typeof fireToast === 'function') {
        fireToast('شاهد مقاطع الفيديو التثقيفية بالكامل لكسب نقاط التميز! 🎬', 'fa-solid fa-film');
      }
    }
  }, 100);
}
window.scrollToHomepageVideos = scrollToHomepageVideos;

function startJourneyAtStation(stationIdx) {
  if (typeof closeOverlay === 'function') closeOverlay();
  setTimeout(() => {
    if (typeof openOverlay === 'function') openOverlay('journey');
    
    // Map station number (1..5, or final quiz) to slide index
    const stationSlideMap = {
      1: 1,   // Station 1: About University
      2: 7,   // Station 2: Tech & Systems
      3: 12,  // Station 3: Rights & Regulations
      4: 16,  // Station 4: Admission & Registration
      5: 20,  // Station 5: Student Affairs
      6: 24   // Station 6: Final Quiz
    };
    const targetSlide = stationSlideMap[stationIdx] || 0;
    setTimeout(() => {
      if (typeof goToSlide === 'function') {
        goToSlide(targetSlide);
      }
    }, 250);
  }, 100);
}
window.startJourneyAtStation = startJourneyAtStation;

// ─── Dynamic 3D Hero Interactions ────────────────────────
function initDynamicHeroInteractions() {
  const container = document.querySelector('.hero-grand-container');
  const videoCard = document.getElementById('hero-video-card');
  const emblemWrap = document.getElementById('bg-central-emblem-wrap');
  const glow1 = document.querySelector('.hero-ambient-glow.glow-1');
  const glow2 = document.querySelector('.hero-ambient-glow.glow-2');

  if (!container || window.innerWidth < 900) return;

  window.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;

    if (videoCard) {
      videoCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    }

    if (emblemWrap) {
      const offsetX = (centerX - x) * 0.025;
      const offsetY = (centerY - y) * 0.025;
      emblemWrap.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }

    if (glow1) {
      glow1.style.transform = `translate(${(x - centerX) * 0.05}px, ${(y - centerY) * 0.05}px)`;
    }
    if (glow2) {
      glow2.style.transform = `translate(${(centerX - x) * 0.05}px, ${(centerY - y) * 0.05}px)`;
    }
  });

  window.addEventListener('mouseleave', () => {
    if (videoCard) {
      videoCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
    }
    if (emblemWrap) {
      emblemWrap.style.transform = 'translate(-50%, -50%)';
    }
    if (glow1) glow1.style.transform = 'translate(0,0)';
    if (glow2) glow2.style.transform = 'translate(0,0)';
  });
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadRegulations();
  loadCalendar();
  createParticles();
  updateStudentBadgeUI();
  initDynamicHeroInteractions();
  setTimeout(() => updateVideoDuration(), 1000);

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('journey-dropdown');
    if (dd && !dd.contains(e.target)) {
      dd.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (APP.journeyActive) closeJourney();
      else if (APP.currentOverlay) closeOverlay();
    }
  });
});

// ─── Radiant Background Particles ─────────────────────────
function createParticles() {
  const container = document.getElementById('bg-particles');
  if (!container) return;
  
  // Golden Radiant Sparkle Particles
  const colors = ['rgba(239,198,143,0.45)', 'rgba(211,180,139,0.4)', 'rgba(135,42,8,0.22)', 'rgba(255,255,255,0.7)'];
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    const c = colors[i % colors.length];
    const size = 2 + Math.random() * 4;
    p.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${c};border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 10px ${c};animation:particleFloat ${8+Math.random()*12}s ease-in-out infinite;animation-delay:${Math.random()*5}s;`;
    container.appendChild(p);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes particleFloat{0%,100%{transform:translateY(0) translateX(0);opacity:0.3}25%{transform:translateY(-20px) translateX(10px);opacity:0.75}50%{transform:translateY(-40px) translateX(-5px);opacity:0.4}75%{transform:translateY(-15px) translateX(-10px);opacity:0.85}}
  `;
  document.head.appendChild(style);
}

