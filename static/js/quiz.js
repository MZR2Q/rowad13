/* ═══════════════════════════════════════════════════════════
   Quiz Page Logic — Client side state machine
   جامعة حفر الباطن — بوابة اللوائح الطلابية
   ═══════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  // State variables
  let questions = [];
  let currentQuestionIndex = 0;
  let answers = {}; // {question_id: option}
  let timerInterval = null;
  let timeRemaining = 20;
  let totalTimeStart = 0;
  let correctCountLive = 0;
  let accumulatedElapsed = 0; // Flexible timer: accumulated seconds from previous sessions

  // DOM Elements
  const screenRegister = document.getElementById("screen-register");
  const screenLoading = document.getElementById("screen-loading");
  const screenReady = document.getElementById("screen-ready");
  const screenQuiz = document.getElementById("screen-quiz");
  const screenResults = document.getElementById("screen-results");

  const registerForm = document.getElementById("register-form");
  const studentIdInput = document.getElementById("student-id");
  const studentNameInput = document.getElementById("student-name");

  const questionText = document.getElementById("question-text");
  const optA = document.getElementById("opt-a");
  const optB = document.getElementById("opt-b");
  const optC = document.getElementById("opt-c");
  const optd = document.getElementById("opt-d");
  const optionBtns = document.querySelectorAll(".option-btn");
  const optionsGrid = document.getElementById("options-grid");

  const qCurrent = document.getElementById("q-current");
  const qTotal = document.getElementById("q-total");
  const progressBar = document.getElementById("progress-bar");
  const liveScore = document.getElementById("live-score");

  const timerProgress = document.getElementById("timer-progress");
  const timerText = document.getElementById("timer-text");

  const feedbackArea = document.getElementById("feedback-area");
  const feedbackIcon = document.getElementById("feedback-icon");
  const feedbackText = document.getElementById("feedback-text");

  const resultsEmoji = document.getElementById("results-emoji");
  const resultsTitle = document.getElementById("results-title");
  const resultsSubtitle = document.getElementById("results-subtitle");
  const scorePercent = document.getElementById("score-percent");
  const scoreFill = document.getElementById("score-fill");
  const correctCountSpan = document.getElementById("correct-count");
  const wrongCountSpan = document.getElementById("wrong-count");
  const timeDisplaySpan = document.getElementById("time-display");
  const leaderboardList = document.getElementById("leaderboard-list");
  const btnRetry = document.getElementById("btn-retry");
  let quizAdvanceTimer = null;

  // Show a specific screen
  function showScreen(screen) {
    [screenRegister, screenLoading, screenReady, screenQuiz, screenResults].forEach((s) => {
      if (s) s.classList.remove("active");
    });
    if (screen) screen.classList.add("active");
  }

  // Auth Mode State (quick vs new)
  let quizAuthMode = "quick";

  window.setQuizAuthMode = function(mode) {
    quizAuthMode = mode;
    const tabQuick = document.getElementById("quiz-tab-quick");
    const tabNew = document.getElementById("quiz-tab-new");
    const groupName = document.getElementById("group-student-name");
    const btnText = document.getElementById("btn-start-text");
    const feedback = document.getElementById("quiz-lookup-feedback");
    const nameInput = document.getElementById("student-name");

    if (feedback) feedback.className = "lookup-feedback hidden";

    if (mode === "quick") {
      if (tabQuick) tabQuick.classList.add("active");
      if (tabNew) tabNew.classList.remove("active");
      if (groupName) groupName.style.display = "none";
      if (nameInput) nameInput.removeAttribute("required");
      if (btnText) btnText.textContent = "تحقق وابدأ المسابقة";
    } else {
      if (tabNew) tabNew.classList.add("active");
      if (tabQuick) tabQuick.classList.remove("active");
      if (groupName) groupName.style.display = "block";
      if (nameInput) nameInput.setAttribute("required", "required");
      if (btnText) btnText.textContent = "ابدأ المسابقة";
    }
  };

  // Load Categories for Student Select
  async function loadCategoriesForQuiz() {
    const select = document.getElementById("student-category");
    if (!select) return;
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success && data.categories) {
        select.innerHTML = `<option value="all">🏆 جميع الأقسام والتصنيفات (اختبار شامل)</option>` +
          data.categories.map(c => `<option value="${c.id}">${c.name} (${c.question_count || 0} أسئلة)</option>`).join('');
      }
    } catch(e) {
      console.error("Failed to load categories:", e);
    }
  }
  loadCategoriesForQuiz();

  // Helper to show lookup feedback
  function showLookupFeedback(msg, type = "info") {
    const feedback = document.getElementById("quiz-lookup-feedback");
    if (!feedback) return;
    feedback.className = `lookup-feedback ${type}`;
    feedback.innerHTML = msg;
  }

  // Auto-lookup when typing 10 digits in student-id input
  if (studentIdInput) {
    studentIdInput.addEventListener("input", async () => {
      const val = studentIdInput.value.trim();
      if (/^\d{10}$/.test(val)) {
        showLookupFeedback('<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق من الرقم الجامعي...', 'info');
        try {
          const res = await fetch(`/api/student/lookup?student_id=${val}`);
          const data = await res.json();
          if (data.success && data.found) {
            studentNameInput.value = data.student_name;
            if (quizAuthMode === "quick") {
              const scoreMsg = data.max_score !== undefined ? `أعلى نتيجة: ${data.max_score}%` : 'جاهز للتحدي';
              const attemptsMsg = data.total_attempts ? `محاولات سابقة: ${data.total_attempts}` : 'عضو مسجل';

              showLookupFeedback(`
                <div class="student-recognized-card">
                  <div class="student-recognized-header">
                    <div class="student-avatar-badge">🏆</div>
                    <div class="student-welcome-info">
                      <h4 class="student-welcome-title">أهلاً بعودتك يا ${data.student_name}! 👋</h4>
                      <p class="student-welcome-desc">تم التعرف عليك بنجاح بالرقم الجامعي <strong>${data.student_id}</strong></p>
                    </div>
                  </div>
                  <div class="student-badge-chips">
                    <span class="student-chip">⭐ ${scoreMsg}</span>
                    <span class="student-chip">🔄 ${attemptsMsg}</span>
                  </div>
                </div>
              `, 'clean');

              const btnText = document.getElementById('btn-start-text');
              if (btnText) btnText.textContent = `انطلق للمسابقة يا ${data.student_name.split(' ')[0]} 🚀`;
            } else {
              showLookupFeedback(`
                <div class="institution-alert-card error">
                  <div class="alert-header">
                    <div class="alert-icon-wrap"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="alert-header-text">
                      <h4>تنبيه أكاديمي: حساب مسجل مسبقاً</h4>
                      <p>الرقم الجامعي (<strong>${val}</strong>) مسجل في المنصة مسبقاً باسم <strong>${data.student_name}</strong>.</p>
                    </div>
                  </div>
                  <div class="alert-footer">
                    <button type="button" class="alert-switch-btn" onclick="setQuizAuthMode('quick')">
                      <i class="fa-solid fa-bolt"></i> اضغط هنا للتحويل إلى "مسجل من قبل" والدخول فوراً
                    </button>
                  </div>
                </div>
              `, 'clean');
            }
          } else {
            if (quizAuthMode === "quick") {
              showLookupFeedback(`
                <div class="institution-alert-card warning">
                  <div class="alert-header">
                    <div class="alert-icon-wrap"><i class="fa-solid fa-circle-info"></i></div>
                    <div class="alert-header-text">
                      <h4>رقم جامعي غير مسجل</h4>
                      <p>الرقم الجامعي (<strong>${val}</strong>) غير مسجل في النظام سابقاً.</p>
                    </div>
                  </div>
                  <div class="alert-footer">
                    <button type="button" class="alert-switch-btn" onclick="setQuizAuthMode('new')">
                      <i class="fa-solid fa-user-plus"></i> اضغط هنا للانتقال إلى "طالب جديد" لإنشاء الحساب
                    </button>
                  </div>
                </div>
              `, 'clean');
            } else {
              showLookupFeedback(`
                <div class="institution-alert-card success">
                  <div class="alert-header">
                    <div class="alert-icon-wrap"><i class="fa-solid fa-circle-check"></i></div>
                    <div class="alert-header-text">
                      <h4>الرقم الجامعي متاح</h4>
                      <p>يمكنك الآن إدخال اسمك الكريم وإكمال التسجيل بنجاح.</p>
                    </div>
                  </div>
                </div>
              `, 'clean');
            }
          }
        } catch (err) {
          showLookupFeedback('⚠️ تعذر التحقق حالياً. يرجى اختيار تبويب طالب جديد.', 'error');
        }
      }
    });
  }

  // Handle Registration Form Submission
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentId = studentIdInput.value.trim();
    let studentName = studentNameInput.value.trim();

    if (!/^\d{10}$/.test(studentId)) {
      alert("عذراً، يجب أن يتكون الرقم الجامعي من 10 أرقام بالضبط (مثال: 2210001234).");
      studentIdInput.focus();
      return;
    }

    if (quizAuthMode === "new") {
      showLookupFeedback('<i class="fa-solid fa-spinner fa-spin"></i> جاري التأكد من توفر الرقم الجامعي...', 'info');
      try {
        const res = await fetch(`/api/student/lookup?student_id=${studentId}`);
        const data = await res.json();
        if (data.success && data.found) {
          showLookupFeedback(`
            <div class="institution-alert-card error">
              <div class="alert-header">
                <div class="alert-icon-wrap"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="alert-header-text">
                  <h4>تنبيه أكاديمي: حساب مسجل مسبقاً</h4>
                  <p>الرقم الجامعي (<strong>${studentId}</strong>) مسجل في المنصة مسبقاً باسم <strong>${data.student_name}</strong>.</p>
                </div>
              </div>
              <div class="alert-footer">
                <button type="button" class="alert-switch-btn" onclick="setQuizAuthMode('quick')">
                  <i class="fa-solid fa-bolt"></i> اضغط هنا للتحويل إلى "مسجل من قبل" والدخول فوراً
                </button>
              </div>
            </div>
          `, 'clean');
          return;
        }
      } catch (err) {}
    }

    if (quizAuthMode === "quick" && !studentName) {
      showLookupFeedback('<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق من الحساب...', 'info');
      try {
        const res = await fetch(`/api/student/lookup?student_id=${studentId}`);
        const data = await res.json();
        if (data.success && data.found) {
          studentName = data.student_name;
          studentNameInput.value = studentName;
        } else {
          showLookupFeedback(`
            <div class="institution-alert-card warning">
              <div class="alert-header">
                <div class="alert-icon-wrap"><i class="fa-solid fa-circle-info"></i></div>
                <div class="alert-header-text">
                  <h4>رقم جامعي غير مسجل</h4>
                  <p>الرقم الجامعي غير مسجل في النظام سابقاً.</p>
                </div>
              </div>
              <div class="alert-footer">
                <button type="button" class="alert-switch-btn" onclick="setQuizAuthMode('new')">
                  <i class="fa-solid fa-user-plus"></i> اضغط هنا للانتقال إلى "طالب جديد" لإنشاء الحساب
                </button>
              </div>
            </div>
          `, 'clean');
          return;
        }
      } catch (err) {
        showLookupFeedback('⚠️ تعذر الاتصال، يرجى التغيير إلى "طالب جديد".', 'error');
        return;
      }
    }

    if (!studentName) {
      alert("يرجى إدخال الاسم كاملاً.");
      studentNameInput.focus();
      return;
    }

    showScreen(screenLoading);

    const categorySelect = document.getElementById("student-category");
    const selectedCat = categorySelect ? categorySelect.value : "all";

    try {
      const response = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          student_name: studentName,
          category_id: selectedCat
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.error || "خطأ أثناء محاولة بدء المسابقة.");
        showScreen(screenRegister);
        return;
      }

      const data = await response.json();
      sessionStorage.setItem("quiz_student_id", studentId);
      sessionStorage.setItem("quiz_student_name", studentName);
      questions = data.questions;
      currentQuestionIndex = 0;
      answers = {};
      correctCountLive = 0;
      accumulatedElapsed = 0;
      liveScore.textContent = "0";
      if (!questions || questions.length === 0) {
        alert("لم يتم العثور على أسئلة الكويز.");
        showScreen(screenRegister);
        return;
      }

      // Save fresh quiz state to sessionStorage
      saveQuizProgress();
      showScreen(screenReady);

    } catch (err) {
      console.error(err);
      alert("تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالشبكة.");
      showScreen(screenRegister);
    }
  });

  // Handle actual start button click on the get ready screen
  const btnStartActual = document.getElementById("btn-start-actual");
  if (btnStartActual) {
    btnStartActual.addEventListener("click", () => {
      totalTimeStart = Date.now();
      showScreen(screenQuiz);
      loadQuestion(0);
    });
  }

  // ═══ FLEXIBLE TIMER: Save/Restore Quiz Progress via sessionStorage ═══
  function saveQuizProgress() {
    try {
      // Calculate elapsed seconds for this session so far
      let sessionElapsed = 0;
      if (totalTimeStart > 0) {
        sessionElapsed = Math.round((Date.now() - totalTimeStart) / 1000);
      }
      sessionStorage.setItem('quiz_progress', JSON.stringify({
        questions: questions,
        currentIndex: currentQuestionIndex,
        answers: answers,
        correctCount: correctCountLive,
        accumulatedElapsed: accumulatedElapsed + sessionElapsed,
        savedAt: Date.now()
      }));
    } catch(e) { console.warn('saveQuizProgress:', e); }
  }

  function clearQuizProgress() {
    sessionStorage.removeItem('quiz_progress');
  }

  function tryResumeQuiz() {
    try {
      const saved = sessionStorage.getItem('quiz_progress');
      if (!saved) return false;
      const state = JSON.parse(saved);
      if (!state.questions || state.questions.length === 0) return false;
      // Check if quiz was already completed (all questions answered)
      const answeredCount = Object.keys(state.answers || {}).length;
      if (answeredCount >= state.questions.length) {
        clearQuizProgress();
        return false;
      }

      // Restore state
      questions = state.questions;
      answers = state.answers || {};
      correctCountLive = state.correctCount || 0;
      accumulatedElapsed = state.accumulatedElapsed || 0;
      currentQuestionIndex = state.currentIndex || 0;

      // Find the next unanswered question
      while (currentQuestionIndex < questions.length && answers[questions[currentQuestionIndex].id] !== undefined) {
        currentQuestionIndex++;
      }
      if (currentQuestionIndex >= questions.length) {
        clearQuizProgress();
        return false;
      }

      // Resume
      liveScore.textContent = String(correctCountLive);
      totalTimeStart = Date.now();
      showScreen(screenQuiz);
      loadQuestion(currentQuestionIndex);
      return true;
    } catch(e) {
      console.warn('tryResumeQuiz:', e);
      return false;
    }
  }

  // Save progress on every page exit / tab switch
  window.addEventListener('beforeunload', () => {
    if (questions.length > 0 && totalTimeStart > 0) {
      saveQuizProgress();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && questions.length > 0 && totalTimeStart > 0) {
      saveQuizProgress();
    }
  });

  // On page load: check for resumable quiz
  const existingStudentId = sessionStorage.getItem('quiz_student_id');
  if (existingStudentId) {
    const resumed = tryResumeQuiz();
    if (resumed) {
      console.log('[Quiz] Resumed in-progress quiz for student:', existingStudentId);
    }
  }

  // Load a question by index
  function loadQuestion(index) {
    currentQuestionIndex = index;
    const q = questions[index];

    // Reset UI state
    qCurrent.textContent = index + 1;
    qTotal.textContent = questions.length;
    progressBar.style.width = `${((index) / questions.length) * 100}%`;

    questionText.textContent = q.question;
    
    // Check if question has image
    let imgEl = document.getElementById('quiz-q-img');
    if (q.image_url) {
      if (!imgEl) {
        imgEl = document.createElement('img');
        imgEl.id = 'quiz-q-img';
        imgEl.className = 'quiz-q-image';
        imgEl.style.maxWidth = '100%';
        imgEl.style.maxHeight = '220px';
        imgEl.style.objectFit = 'contain';
        imgEl.style.borderRadius = '12px';
        imgEl.style.marginTop = '12px';
        imgEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        questionText.parentNode.appendChild(imgEl);
      }
      imgEl.src = q.image_url;
      imgEl.style.display = 'block';
    } else if (imgEl) {
      imgEl.style.display = 'none';
    }

    optA.textContent = q.options[0];
    optB.textContent = q.options[1];
    optC.textContent = q.options[2];
    optd.textContent = q.options[3];

    // Proof upload box check
    const proofBox = document.getElementById('proof-upload-box');
    const proofPreview = document.getElementById('proof-preview-wrap');
    if (proofBox) {
      if (q.question.includes('صورة') || q.question.includes('إرفاق') || q.question.includes('Screenshot')) {
        proofBox.classList.remove('hidden');
        if (proofPreview) proofPreview.style.display = 'none';
      } else {
        proofBox.classList.add('hidden');
      }
    }

    feedbackArea.classList.add("hidden");

    optionBtns.forEach((btn) => {
      btn.className = "option-btn";
      btn.style.transform = "";
    });

    startQuestionTimer();
  }

  // Start question timer (20 seconds)
  function startQuestionTimer() {
    clearInterval(timerInterval);
    timeRemaining = 20;
    updateTimerUI();

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerUI();

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        handleTimeOut();
      }
    }, 1000);
  }

  // Update timer circle & text UI
  function updateTimerUI() {
    timerText.textContent = timeRemaining;

    // SVG dash offset calculation
    // Circle radius = 20, perimeter = 2 * PI * 20 ≈ 125.66
    const perimeter = 125.66;
    const offset = perimeter - (timeRemaining / 20) * perimeter;
    timerProgress.style.strokeDashoffset = offset;

    if (timeRemaining <= 5) {
      timerProgress.classList.add("danger");
      timerText.classList.add("danger");
    } else {
      timerProgress.classList.remove("danger");
      timerText.classList.remove("danger");
    }
  }

  // Option select handler
  optionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      clearInterval(timerInterval);
      const selectedOption = btn.dataset.option;
      answers[questions[currentQuestionIndex].id] = selectedOption;
      saveQuizProgress(); // Persist after every answer
      submitAnswer(selectedOption);
    });
  });

  // Handle when student clicks an answer
  function submitAnswer(selectedOption) {
    const q = questions[currentQuestionIndex];
    const correct = q.correct_option.toLowerCase().trim();
    const isCorrect = (selectedOption === correct);

    optionBtns.forEach((btn) => {
      btn.classList.add("disabled");
      const opt = btn.dataset.option.toLowerCase().trim();
      if (opt === correct) {
        btn.classList.add("correct");
      } else if (opt === selectedOption) {
        btn.classList.add("wrong");
      }
    });

    // Update live score
    if (isCorrect) {
      correctCountLive++;
      liveScore.textContent = correctCountLive;
      feedbackIcon.innerHTML = '<i class="ph ph-check-circle" style="color: var(--q-correct)"></i>';
      feedbackText.innerHTML = `<strong>إجابة صحيحة!</strong> ${q.explanation || ''}`;
    } else {
      feedbackIcon.innerHTML = '<i class="ph ph-x-circle" style="color: var(--q-wrong)"></i>';
      feedbackText.innerHTML = `<strong>إجابة خاطئة!</strong> الإجابة الصحيحة هي (${correct.toUpperCase()}). ${q.explanation || ''}`;
    }

    feedbackArea.classList.remove("hidden");
    feedbackArea.style.cursor = "pointer";
    feedbackArea.title = "اضغط للمتابعة للسؤال التالي فوراً";

    // Wait 2.2 seconds before moving to next question (or tap to skip)
    if (quizAdvanceTimer) clearTimeout(quizAdvanceTimer);
    quizAdvanceTimer = setTimeout(() => {
      goToNextQuestion();
    }, 2200);
  }

  // Handle when 20 seconds expires without answer
  function handleTimeOut() {
    const q = questions[currentQuestionIndex];
    const correct = q.correct_option.toLowerCase().trim();
    answers[q.id] = ""; // unanswered
    saveQuizProgress(); // Persist timeout as answered

    // Trigger card shake animation
    const card = document.querySelector(".question-card");
    if (card) {
      card.classList.add("shake-anim");
      setTimeout(() => {
        card.classList.remove("shake-anim");
      }, 500);
    }

    optionBtns.forEach((btn) => {
      btn.classList.add("disabled");
      if (btn.dataset.option.toLowerCase().trim() === correct) {
        btn.classList.add("correct");
      }
    });
    
    // Show time expired message
    feedbackIcon.innerHTML = '<i class="ph ph-warning-circle" style="color: var(--q-wrong)"></i>';
    feedbackText.innerHTML = `<strong>انتهى الوقت!</strong> الإجابة الصحيحة هي (${correct.toUpperCase()}). ${q.explanation || ''}`;
    feedbackArea.classList.remove("hidden");
    feedbackArea.style.cursor = "pointer";
    feedbackArea.title = "اضغط للمتابعة للسؤال التالي فوراً";

    if (quizAdvanceTimer) clearTimeout(quizAdvanceTimer);
    quizAdvanceTimer = setTimeout(() => {
      goToNextQuestion();
    }, 2200);
  }

  // Allow instant advance on tapping feedback area
  if (feedbackArea) {
    feedbackArea.addEventListener('click', () => {
      goToNextQuestion();
    });
  }

  // Go to next question or complete quiz
  function goToNextQuestion() {
    if (quizAdvanceTimer) {
      clearTimeout(quizAdvanceTimer);
      quizAdvanceTimer = null;
    }
    if (currentQuestionIndex < questions.length - 1) {
      loadQuestion(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  }

  // Finish quiz and show results screen
  async function finishQuiz() {
    showScreen(screenLoading);
    // Flexible timer: accumulated time from all sessions + current session
    const currentSessionTime = totalTimeStart > 0 ? Math.round((Date.now() - totalTimeStart) / 1000) : 0;
    const totalTimeTaken = accumulatedElapsed + currentSessionTime;
    clearQuizProgress(); // Quiz is done, clean up saved state
    const studentId = sessionStorage.getItem("quiz_student_id") || (studentIdInput ? studentIdInput.value.trim() : "");
    const studentName = sessionStorage.getItem("quiz_student_name") || (studentNameInput ? studentNameInput.value.trim() : "");
    const selectedCat = document.getElementById("student-category") ? document.getElementById("student-category").value : "all";

    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answers,
          time_taken: totalTimeTaken,
          student_id: studentId,
          student_name: studentName,
          category_id: selectedCat
        }),
      });

      if (!response.ok) {
        alert("حدث خطأ أثناء إرسال إجابات الكويز.");
        showScreen(screenRegister);
        return;
      }

      const data = await response.json();
      showScreen(screenResults);

      // Render results
      const score = data.score_percent;
      scorePercent.textContent = score;

      // Circular progress bar animate
      // Score Fill radius = 54, perimeter = 2 * PI * 54 = 339.29
      const fillPerimeter = 339.29;
      const fillOffset = fillPerimeter - (score / 100) * fillPerimeter;
      
      // Delay slightly for CSS transition to trigger nicely
      setTimeout(() => {
        scoreFill.style.strokeDashoffset = fillOffset;
      }, 200);

      correctCountSpan.textContent = data.correct_count;
      wrongCountSpan.textContent = data.wrong_count !== undefined ? data.wrong_count : (data.total - data.correct_count);
      timeDisplaySpan.textContent = totalTimeTaken;

      // Show points earned banner if element exists or add badge
      let ptsBanner = document.getElementById("quiz-points-badge");
      if (!ptsBanner && scorePercent) {
        ptsBanner = document.createElement("div");
        ptsBanner.id = "quiz-points-badge";
        ptsBanner.className = "quiz-account-linked-badge";
        ptsBanner.style.cssText = "background: linear-gradient(135deg, rgba(5,150,105,0.12), rgba(16,185,129,0.06)); border: 1px solid rgba(5,150,105,0.25); border-radius: 12px; padding: 12px 16px; margin: 16px auto; max-width: 440px; text-align: center; color: #065f46; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 10px;";
        const cardParent = document.querySelector(".results-card") || screenResults;
        if (cardParent) {
          const statsGrid = document.querySelector(".results-stats");
          if (statsGrid) statsGrid.parentNode.insertBefore(ptsBanner, statsGrid.nextSibling);
          else cardParent.appendChild(ptsBanner);
        }
      }
      if (ptsBanner) {
        if (data.is_first_attempt) {
          ptsBanner.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669; font-size: 1.2rem;"></i> <div><strong>تم التوثيق وربط الحساب:</strong> تم رصد <strong>${data.points_earned || 0} نقطة</strong> وإضافتها لرصيدك الموحد (الإجمالي: <strong>${data.total_points || data.points_earned || 0} نقطة</strong>) باسم الطالب <strong>${data.student_name || studentName}</strong>. <br><i class="fa-solid fa-star" style="color:#C9A227;"></i> <strong>هذه محاولتك الأولى وهي المعتمدة للترتيب!</strong></div>`;
        } else {
          ptsBanner.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.06))';
          ptsBanner.style.borderColor = 'rgba(59,130,246,0.25)';
          ptsBanner.style.color = '#1e3a5f';
          ptsBanner.innerHTML = `<i class="fa-solid fa-rotate" style="color: #3B82F6; font-size: 1.2rem;"></i> <div><strong>محاولة تدريبية #${data.total_attempts}:</strong> نتيجتك ${data.score_percent}% — المحاولة الأولى هي المعتمدة للترتيب (<strong>${data.first_attempt_score}%</strong> في <strong>${data.first_attempt_time} ثانية</strong>).</div>`;
        }
      }

      // Adjust emoji/titles based on score
      if (score >= 90) {
        resultsEmoji.textContent = "👑";
        resultsTitle.textContent = "عبقري اللوائح!";
        resultsSubtitle.textContent = "تميز مذهل ومعرفة قانونية كاملة للأنظمة!";
      } else if (score >= 60) {
        resultsEmoji.textContent = "🎉";
        resultsTitle.textContent = "أحسنت صنعاً!";
        resultsSubtitle.textContent = "لديك دراية جيدة باللوائح الجامعية.";
      } else {
        resultsEmoji.textContent = "📚";
        resultsTitle.textContent = "تحتاج لمزيد من القراءة";
        resultsSubtitle.textContent = "ننصحك بمراجعة دليل اللوائح والأنظمة.";
      }

      // Check if player reached #1 or scored >= 80% to launch celebratory confetti
      const isFirstPlace = data.leaderboard && data.leaderboard.length > 0 && String(data.leaderboard[0].student_id) === String(sessionStorage.getItem('quiz_student_id') || '');
      if (score >= 80 || isFirstPlace) {
        triggerConfetti();
      }

      // Render Question Answers Review List
      renderReviewList();

      // Render Leaderboard
      renderLeaderboard(data.leaderboard);

    } catch (err) {
      console.error(err);
      alert("عذراً، لم نتمكن من الحصول على النتيجة.");
      showScreen(screenRegister);
    }
  }

  // Render Question Answers Review List
  function renderReviewList() {
    const reviewList = document.getElementById("review-list");
    if (!reviewList) return;
    reviewList.innerHTML = "";

    questions.forEach((q, index) => {
      const selected = (answers[q.id] || "").toLowerCase().trim();
      const correct = (q.correct_option || "").toLowerCase().trim();
      const isCorrect = (selected === correct);

      const optionLetterMap = { "a": 0, "b": 1, "c": 2, "d": 3 };
      const selectedIndex = optionLetterMap[selected];
      const correctIndex = optionLetterMap[correct];

      const selectedText = selectedIndex !== undefined ? q.options[selectedIndex] : "لم يتم إجابة السؤال (انتهى الوقت)";
      const correctText = correctIndex !== undefined ? q.options[correctIndex] : "";

      const card = document.createElement("div");
      card.className = "review-card";
      card.innerHTML = `
        <div class="review-header">
          <span class="q-num">السؤال ${index + 1} من ${questions.length}</span>
          <span class="review-badge ${isCorrect ? 'correct' : 'wrong'}">
            ${isCorrect ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة'}
          </span>
        </div>
        <div class="review-q-text">${q.question}</div>
        <div class="review-ans-row student-ans">
          <strong>إجابتك:</strong> (${selected.toUpperCase() || '—'}) ${selectedText}
        </div>
        ${!isCorrect ? `
        <div class="review-ans-row correct-ans">
          <strong>الإجابة الصحيحة:</strong> (${correct.toUpperCase()}) ${correctText}
        </div>` : ''}
        ${q.explanation ? `<div class="review-exp"><strong>الشرح:</strong> ${q.explanation}</div>` : ''}
      `;
      reviewList.appendChild(card);
    });
  }

  // Render Leaderboard list
  function renderLeaderboard(list) {
    // Reset podium steps
    const steps = [1, 2, 3];
    steps.forEach(i => {
      const stepEl = document.getElementById(`podium-step-${i}`);
      const nameEl = document.getElementById(`podium-${i}-name`);
      const scoreEl = document.getElementById(`podium-${i}-score`);
      if (stepEl) {
        stepEl.style.opacity = "0.4";
        stepEl.classList.remove("active");
      }
      if (nameEl) nameEl.textContent = "في انتظار بطل...";
      if (scoreEl) scoreEl.textContent = "--";
    });

    leaderboardList.innerHTML = "";

    if (!list || list.length === 0) {
      leaderboardList.innerHTML = '<div class="lb-empty">لا توجد محاولات سابقة بعد. كن أول المتصدرين!</div>';
      return;
    }

    list.forEach((item, index) => {
      if (index < 3) {
        // Populate Podium Step
        const stepNum = index + 1; // 1, 2, 3
        const stepEl = document.getElementById(`podium-step-${stepNum}`);
        const nameEl = document.getElementById(`podium-${stepNum}-name`);
        const scoreEl = document.getElementById(`podium-${stepNum}-score`);
        
        if (nameEl) nameEl.textContent = item.student_name;
        if (scoreEl) scoreEl.textContent = `${item.best_score} / 200`;
        if (stepEl) {
          stepEl.style.opacity = "1";
          stepEl.classList.add("active");
        }
      } else {
        // List item for 4th place and lower
        const itemEl = document.createElement("div");
        itemEl.className = "lb-item";
        itemEl.innerHTML = `
          <div class="lb-rank">${index + 1}</div>
          <div class="lb-info">
            <div class="lb-name">${item.student_name}</div>
            <div class="lb-id">${item.student_id} • الوقت: ${item.best_time} ثانية</div>
          </div>
          <div class="lb-score">${item.best_score} / 200</div>
        `;
        leaderboardList.appendChild(itemEl);
      }
    });
  }

  // Pure JS Confetti Engine
  function triggerConfetti() {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.pointerEvents = "none";
    container.style.zIndex = "9999";
    container.style.overflow = "hidden";
    document.body.appendChild(container);

    const colors = ["#8B1A26", "#C9A227", "#E2C060", "#2ECC71", "#3498DB", "#9B59B6"];
    for (let i = 0; i < 110; i++) {
      const particle = document.createElement("div");
      particle.className = "confetti-particle";
      particle.style.left = Math.random() * 100 + "vw";
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.width = (Math.random() * 6 + 6) + "px";
      particle.style.height = (Math.random() * 10 + 6) + "px";
      particle.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";

      const duration = Math.random() * 2 + 2.5; // 2.5s - 4.5s
      const delay = Math.random() * 0.6; // 0s - 0.6s
      particle.style.animation = `confetti-fall-${i % 4} ${duration}s linear ${delay}s forwards`;

      container.appendChild(particle);
    }

    setTimeout(() => {
      container.remove();
    }, 5000);
  }

  // Retry quiz
  btnRetry.addEventListener("click", () => {
    // Reset all state for a fresh new attempt
    questions = [];
    currentQuestionIndex = 0;
    answers = {};
    correctCountLive = 0;
    accumulatedElapsed = 0; // Reset timer completely for new attempt
    totalTimeStart = 0;
    clearQuizProgress(); // Clear any saved progress
    liveScore.textContent = "0";
    // Reset score circle
    if (scoreFill) scoreFill.style.strokeDashoffset = 339.29;
    showScreen(screenRegister);
  });
});

window.handleStudentProofUpload = function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const previewWrap = document.getElementById('proof-preview-wrap');
    const previewImg = document.getElementById('proof-img-preview');
    const confirmActions = document.getElementById('proof-confirm-actions');
    const confirmedBadge = document.getElementById('proof-confirmed-badge');
    if (previewImg) previewImg.src = e.target.result;
    if (previewWrap) previewWrap.style.display = 'block';
    if (confirmActions) confirmActions.style.display = 'flex';
    if (confirmedBadge) confirmedBadge.style.display = 'none';
  };
  reader.readAsDataURL(file);
};

window.confirmQuizStudentProof = function() {
  const confirmActions = document.getElementById('proof-confirm-actions');
  const confirmedBadge = document.getElementById('proof-confirmed-badge');
  if (confirmActions) confirmActions.style.display = 'none';
  if (confirmedBadge) confirmedBadge.style.display = 'block';
};
