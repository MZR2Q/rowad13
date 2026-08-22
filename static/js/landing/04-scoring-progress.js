// ─── Document & Overlay Exploration Scoring ───
function awardDocumentExplorePoints(docId, customTitle) {
  if (!docId) return;
  const studentId = (typeof APP !== 'undefined' && APP.journeyStudentId) || localStorage.getItem('uhb_student_id') || localStorage.getItem('uhb_last_student_id') || 'guest_student';
  const storageKey = `uhb_explored_docs_${studentId}`;
  let viewed = {};
  try { viewed = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) {}

  const { station: matchedStation, item: matchedItem } = findVirtualStationItem(docId);

  if (!matchedItem) {
    console.warn('[Explore] No matching config for docId:', docId);
    return;
  }

  const effectiveId = matchedItem.id;

  if (viewed[effectiveId]) {
    // Already viewed and points awarded, ensure UI reflects it
    markDropdownItemCompleted(effectiveId);
    return;
  }

  // Flexible dynamic points calculation per file/document — uses dynamicPts from video integration
  const pts = matchedItem.dynamicPts || matchedItem.defaultPts || (Math.round((matchedStation.totalPts / matchedStation.items.length) * 10) / 10);
  viewed[effectiveId] = { timestamp: new Date().toISOString(), pts: pts, name: matchedItem.name };
  try { localStorage.setItem(storageKey, JSON.stringify(viewed)); } catch(e) {}

  if (typeof APP !== 'undefined') {
    saveStudentProgress();
    if (typeof updateStudentBadgeUI === 'function') updateStudentBadgeUI();
  }

  if (typeof showPointsToast === 'function') {
    const verb = matchedItem.isVideo ? 'شاهدت المقطع' : 'تصفحت';
    showPointsToast(`⭐ رائع! ${verb} (${matchedItem.name}) وكسبت +${pts} نقاط ضمن ${matchedStation.title}!`, `+${pts} نقاط`);
  } else if (typeof fireExpeditionToast === 'function') {
    fireExpeditionToast(`⭐ تصفحت (${matchedItem.name}) وكسبت +${pts} نقاط!`, 'fa-solid fa-file-circle-check');
  }

  if (typeof playExpeditionAudioChime === 'function') {
    playExpeditionAudioChime('success');
  }

  markDropdownItemCompleted(effectiveId, pts);
  if (typeof syncStudentProgressToBackend === 'function') {
    syncStudentProgressToBackend(studentId);
  }
}
window.awardDocumentExplorePoints = awardDocumentExplorePoints;

function markDropdownItemCompleted(docId, pts) {
  if (!docId) return;
  const { station, item } = findVirtualStationItem(docId);
  const targetIds = [docId];
  let displayPts = pts;
  if (item) {
    targetIds.push(item.id);
    if (item.altIds) targetIds.push(...item.altIds);
    if (displayPts === undefined) {
      displayPts = item.dynamicPts || item.defaultPts || (station ? Math.round((station.totalPts / station.items.length) * 10) / 10 : 5);
    }
  }

  targetIds.forEach(idKey => {
    const cleanKey = String(idKey).replace(/^overlay-/, '');
    const candidateIds = [
      `sub-item-${cleanKey}`,
      `sub-item-${cleanKey.replace(/_/g, '-')}`,
      `sub-item-${cleanKey.replace(/-/g, '_')}`
    ];
    candidateIds.forEach(elemId => {
      const el = document.getElementById(elemId);
      if (el) {
        const ptsBadge = el.querySelector('.sub-item-pts');
        if (ptsBadge) {
          ptsBadge.classList.add('is-done');
          ptsBadge.innerHTML = `<i class="fa-solid fa-check"></i> <span>${displayPts !== undefined ? `+${displayPts}` : '✓'}</span>`;
        }
      }
    });
  });
}
window.markDropdownItemCompleted = markDropdownItemCompleted;

function restoreExploredDocumentsUI() {
  const studentId = (typeof APP !== 'undefined' && APP.journeyStudentId) || localStorage.getItem('uhb_student_id') || localStorage.getItem('uhb_last_student_id') || 'guest_student';
  const storageKey = `uhb_explored_docs_${studentId}`;
  let viewed = {};
  try { viewed = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) {}

  Object.keys(viewed).forEach(docId => {
    markDropdownItemCompleted(docId, viewed[docId]?.pts);
  });
}
window.restoreExploredDocumentsUI = restoreExploredDocumentsUI;
document.addEventListener('DOMContentLoaded', restoreExploredDocumentsUI);

let pendingProofs = {};

function previewJourneyProof(slideIndex, input, type) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const dataUrl = e.target.result;
    pendingProofs[slideIndex] = {
      type: type,
      fileName: file.name,
      dataUrl: dataUrl
    };

    // Background upload to server
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('student_id', typeof getEffectiveStudentId === 'function' ? getEffectiveStudentId() : '');
      formData.append('proof_type', type);
      formData.append('attempt_num', String(APP.journeyAttemptCount || 1));  // Pass attempt number
      fetch('/api/student/upload-proof', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(d => {
          if (d.success && pendingProofs[slideIndex]) {
            const serverUrl = d.url || '';
            const firstUrl = d.first_proof_url || serverUrl;
            // ── CRITICAL: Replace base64 dataUrl with server URL ──
            // This prevents _strip_base64 from re-creating files on every sync
            pendingProofs[slideIndex].url = serverUrl;
            pendingProofs[slideIndex].firstProofUrl = firstUrl;
            pendingProofs[slideIndex].dataUrl = serverUrl;  // ← Replace base64 with URL!

            if (APP.journeyAnswered[slideIndex]) {
              APP.journeyAnswered[slideIndex].url = serverUrl;
              APP.journeyAnswered[slideIndex].firstProofUrl = firstUrl;
              APP.journeyAnswered[slideIndex].dataUrl = serverUrl;  // ← Replace base64 with URL!
            }
            // Save first proof URL to localStorage (permanent reference)
            const sid = typeof getEffectiveStudentId === 'function' ? getEffectiveStudentId() : '';
            if (sid) {
              localStorage.setItem(`uhb_first_proof_url_${pendingProofs[slideIndex].type}_${sid}`, firstUrl);
            }
            console.log(`[Proof] ${d.is_first_upload ? 'FIRST' : 'UPDATE'} proof saved: ${serverUrl} (base64 cleared)`);
            // Re-save to backend now that we have the real server URL
            // (previous save may have stored 'pending_upload' as dataUrl)
            saveStudentProgress({ immediate: true });
          }
        }).catch(err => console.log('Proof upload note:', err));
    } catch(err) {}

    const preview = document.getElementById(`j-proof-preview-${slideIndex}`);
    const dropzone = document.getElementById(`j-dropzone-${slideIndex}`);

    if (input) {
      input.style.display = 'none';
      input.style.pointerEvents = 'none';
    }

    if (dropzone) {
      const uploadLabel = dropzone.querySelector('.j-proof-upload-label');
      if (uploadLabel) uploadLabel.style.display = 'none';
      dropzone.classList.add('has-preview');
      dropzone.style.cursor = 'default';
    }

    if (preview) {
      const pts = getPointsPerQuestion(slideIndex);
      preview.innerHTML = `
        <div style="background:rgba(255,255,255,0.98); border:2px solid #7A3117; border-radius:16px; padding:16px; margin-top:12px; box-shadow:0 6px 20px rgba(0,0,0,0.08); display:flex; flex-direction:column; align-items:center; gap:12px; text-align:right; position:relative; z-index:50;">
          <div style="display:flex; align-items:center; gap:14px; width:100%;">
            <img src="${dataUrl}" alt="معاينة الصورة" style="width:64px; height:64px; object-fit:cover; border-radius:10px; border:2px solid #7A3117; flex-shrink:0;" />
            <div style="flex:1;">
              <strong style="font-size:0.95rem; color:#1E1713; display:block; margin-bottom:4px;"><i class="fa-solid fa-image" style="color:#7A3117;"></i> ${file.name}</strong>
              <span style="font-size:0.84rem; color:#7A3117; font-weight:700;"><i class="fa-solid fa-circle-question"></i> هل تود تأكيد إرفاق هذه الصورة لتوثيق إثباتك؟</span>
            </div>
          </div>
          <div style="display:flex; gap:10px; width:100%; justify-content:center; margin-top:6px; flex-wrap:wrap; position:relative; z-index:60;">
            <button type="button" class="j-btn-primary" onclick="event.stopPropagation(); confirmJourneyProof(${slideIndex});" style="padding:10px 22px; font-size:0.92rem; background:linear-gradient(135deg, #10B981, #059669); border:none; color:#FFFFFF; border-radius:10px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(16,185,129,0.35); position:relative; z-index:70;">
              <i class="fa-solid fa-circle-check"></i>
              <span>تأكيد الإرسال والتوثيق (+${pts} نقاط)</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); changeJourneyProof(${slideIndex});" style="padding:10px 18px; font-size:0.88rem; background:#F5EEE6; border:1px solid rgba(122,49,23,0.3); color:#7A3117; border-radius:10px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; position:relative; z-index:70;">
              <i class="fa-solid fa-arrow-rotate-left"></i>
              <span>اختيار صورة أخرى 🔄</span>
            </button>
          </div>
        </div>
      `;
      preview.style.display = 'block';
    }
  };

  reader.readAsDataURL(file);
}
window.previewJourneyProof = previewJourneyProof;

function resetJourneyProof(slideIndex) {
  delete pendingProofs[slideIndex];
  const preview = document.getElementById(`j-proof-preview-${slideIndex}`);
  const dropzone = document.getElementById(`j-dropzone-${slideIndex}`);
  const input = document.getElementById(slideIndex === 10 ? 'proof-email-input' : 'proof-bb-input');
  if (input) {
    input.value = '';
    input.style.display = '';
    input.style.pointerEvents = '';
  }
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
  if (dropzone) {
    const uploadLabel = dropzone.querySelector('.j-proof-upload-label');
    if (uploadLabel) uploadLabel.style.display = 'flex';
    dropzone.classList.remove('uploaded', 'has-preview');
    dropzone.style.cursor = 'pointer';
  }
}
window.resetJourneyProof = resetJourneyProof;

function changeJourneyProof(slideIndex) {
  const dropzone = document.getElementById(`j-dropzone-${slideIndex}`);
  if (dropzone) {
    const uploadLabel = dropzone.querySelector('.j-proof-upload-label');
    if (uploadLabel) uploadLabel.style.display = 'flex';
    dropzone.classList.remove('uploaded', 'has-preview');
    dropzone.style.cursor = 'pointer';
  }
  const input = document.getElementById(slideIndex === 10 ? 'proof-email-input' : 'proof-bb-input');
  if (input) {
    input.style.display = '';
    input.style.pointerEvents = '';
    input.value = '';
    setTimeout(() => {
      input.click();
    }, 50);
  }
}
window.changeJourneyProof = changeJourneyProof;

function confirmJourneyProof(slideIndex) {
  const pending = pendingProofs[slideIndex];
  if (!pending) return;

  // Use server URL if upload completed, otherwise mark as pending
  // This prevents _strip_base64_from_quiz from creating duplicate files
  const safeDataUrl = pending.url || (pending.dataUrl && pending.dataUrl.startsWith('data:') ? 'pending_upload' : pending.dataUrl) || 'pending_upload';
  const serverUrl = pending.url || '';

  const proofObj = {
    type: pending.type,
    fileName: pending.fileName,
    dataUrl: safeDataUrl,      // Never store raw base64 here
    url: serverUrl,
    timestamp: new Date().toISOString()
  };

  APP.journeyAnswered[slideIndex] = proofObj;
  // Clear restart flag — student has uploaded new proof, so it should persist
  APP.journeyRestarted = false;

  const type = pending.type;
  const isFirstAttempt = !APP.journeyFirstAttemptSaved;

  // 1. Lock in first attempt proof reference in localStorage (URL only, never base64)
  const existingFirstProof = localStorage.getItem(`uhb_first_proof_${type}_${APP.journeyStudentId}`);
  if (isFirstAttempt || !existingFirstProof) {
    try {
      localStorage.setItem(`uhb_first_proof_${type}_${APP.journeyStudentId}`, serverUrl || pending.fileName);
      localStorage.setItem(`uhb_first_proof_name_${type}_${APP.journeyStudentId}`, pending.fileName);
      localStorage.setItem(`uhb_first_proof_time_${type}_${APP.journeyStudentId}`, new Date().toISOString());
    } catch(err) {}
    if (!APP.journeyFirstAttemptAnswered) APP.journeyFirstAttemptAnswered = {};
    APP.journeyFirstAttemptAnswered[slideIndex] = JSON.parse(JSON.stringify(proofObj));
  }

  // 2. Save proof reference in localStorage (URL only, never base64)
  try {
    localStorage.setItem(`uhb_proof_${pending.type}_${APP.journeyStudentId}`, serverUrl || pending.fileName);
    localStorage.setItem(`uhb_proof_name_${pending.type}_${APP.journeyStudentId}`, pending.fileName);
  } catch(err) {}

  const preview = document.getElementById(`j-proof-preview-${slideIndex}`);
  const dropzone = document.getElementById(`j-dropzone-${slideIndex}`);
  const feedback = document.getElementById(`j-feedback-${slideIndex}`);
  const input = document.getElementById(slideIndex === 10 ? 'proof-email-input' : 'proof-bb-input');

  if (input) {
    input.style.display = 'none';
    input.style.pointerEvents = 'none';
  }

  if (preview) {
    preview.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; background:#F0FDF4; padding:14px 18px; border-radius:14px; border:2px solid #10B981; margin-top:12px; text-align:right; flex-wrap:wrap; box-shadow:0 4px 16px rgba(16,185,129,0.12); position:relative; z-index:50;">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${pending.dataUrl}" alt="إثبات" style="width:60px; height:60px; object-fit:cover; border-radius:10px; border:2px solid #10B981; flex-shrink:0;" />
          <div>
            <strong style="font-size:0.95rem; color:#065F46; display:block; margin-bottom:2px;"><i class="fa-solid fa-circle-check"></i> تم التوثيق واعتماد الإثبات بنجاح!</strong>
            <span style="font-size:0.82rem; color:#047857; font-weight:600;"><i class="fa-solid fa-file-image"></i> ${pending.fileName}</span>
          </div>
        </div>
        <button type="button" onclick="event.stopPropagation(); changeJourneyProof(${slideIndex});" style="padding:8px 16px; background:#FFFFFF; border:1.5px solid #10B981; color:#065F46; border-radius:10px; font-weight:800; font-size:0.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(16,185,129,0.15); transition:0.2s; position:relative; z-index:60;" onmouseover="this.style.background='#ECFDF5'" onmouseout="this.style.background='#FFFFFF'">
          <i class="fa-solid fa-arrows-rotate"></i>
          <span>تغيير / استبدال الصورة 🔄</span>
        </button>
      </div>
    `;
    preview.style.display = 'block';
  }
  if (dropzone) {
    dropzone.classList.add('uploaded');
    dropzone.classList.remove('has-preview');
    dropzone.style.cursor = 'default';
  }

  const station = typeof getStationForSlide === 'function' ? getStationForSlide(slideIndex) : null;
  const pts = getPointsPerQuestion(slideIndex);

  if (feedback) {
    feedback.className = 'j-feedback show correct';
    feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ⭐ رائع ومميز! تم توثيق إثباتك وحصولك على +${pts} نقاط ضمن ${station ? station.title : 'المحطة'}!`;
    feedback.style.display = 'block';
  }

  if (typeof showPointsToast === 'function') {
    showPointsToast(`⭐ تم اعتماد الإثبات بنجاح! كسبت +${pts} نقاط ضمن ${station ? station.title : 'المحطة'}!`, `+${pts} نقاط`);
  }
  if (typeof playExpeditionAudioChime === 'function') {
    playExpeditionAudioChime('success');
  }

  const { totalScore } = calcFinalQuizScore();
  APP.journeyScore = totalScore;

  updateScore();
  buildStepper();
  // Force progress bar refresh immediately (reflects newly answered proof)
  goToSlide(APP.journeySlide);
  saveStudentProgress({ immediate: true });  // Proof = always sync immediately
  checkAllQuestionsCompleted(); // Auto-stop timer if all done
  if (journeyAutoAdvanceTimer) clearTimeout(journeyAutoAdvanceTimer);
  journeyAutoAdvanceTimer = setTimeout(() => {
    if (APP.journeySlide === slideIndex) goToSlide(getNextQuizSlide(slideIndex));
  }, 2200);
}
window.confirmJourneyProof = confirmJourneyProof;

function restoreJourneyProofUI() {
  const effectiveId = typeof getEffectiveStudentId === 'function' ? getEffectiveStudentId() : '';
  
  [10, 11].forEach(slideIndex => {
    let ans = APP.journeyAnswered ? APP.journeyAnswered[slideIndex] : null;

    // === PRIVACY: Validate proof belongs to current student ===
    if (ans && effectiveId && effectiveId !== 'guest_student') {
      const proofUrl = ans.url || ans.dataUrl || '';
      if (proofUrl && proofUrl.startsWith('/static/uploads/proofs/') && !proofUrl.includes(effectiveId)) {
        console.log(`[Proof] Blocked foreign proof for slide ${slideIndex}: ${proofUrl} (not for ${effectiveId})`);
        ans = null;
        if (APP.journeyAnswered) delete APP.journeyAnswered[slideIndex];
      }
    }

    if (!ans && effectiveId && effectiveId !== 'guest_student' && !APP.journeyRestarted) {
      const pType = slideIndex === 10 ? 'email' : 'blackboard';
      const stored = localStorage.getItem(`uhb_proof_${pType}_${effectiveId}`) || localStorage.getItem(`uhb_proof_${pType === 'blackboard' ? 'bb' : 'email'}_${effectiveId}`);
      if (stored) {
        if (!stored.startsWith('/static/uploads/proofs/') || stored.includes(effectiveId)) {
          ans = { type: pType, fileName: slideIndex === 10 ? 'إثبات تفعيل البريد الجامعي' : 'إثبات الدخول للبلاك بورد', dataUrl: stored, timestamp: '' };
          if (APP.journeyAnswered) APP.journeyAnswered[slideIndex] = ans;
        }
      }
    }

    if (ans && (ans.dataUrl || ans.url || ans.fileName)) {
      let imgSrc = ans.url || ans.dataUrl || '';
      // === FINAL PRIVACY CHECK: Never render another student's proof image ===
      if (imgSrc && imgSrc.startsWith('/static/uploads/proofs/') && effectiveId && effectiveId !== 'guest_student' && !imgSrc.includes(effectiveId)) {
        imgSrc = '';
      }
      const preview = document.getElementById(`j-proof-preview-${slideIndex}`);
      const dropzone = document.getElementById(`j-dropzone-${slideIndex}`);
      const feedback = document.getElementById(`j-feedback-${slideIndex}`);
      const input = document.getElementById(slideIndex === 10 ? 'proof-email-input' : 'proof-bb-input');

      if (input) {
        input.style.display = 'none';
        input.style.pointerEvents = 'none';
      }

      if (dropzone) {
        const uploadLabel = dropzone.querySelector('.j-proof-upload-label');
        if (uploadLabel) uploadLabel.style.display = 'none';
        dropzone.classList.add('uploaded');
        dropzone.classList.remove('has-preview');
        dropzone.style.cursor = 'default';
      }

      if (preview) {
        preview.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; background:#F0FDF4; padding:14px 18px; border-radius:14px; border:2px solid #10B981; margin-top:12px; text-align:right; flex-wrap:wrap; box-shadow:0 4px 16px rgba(16,185,129,0.12); position:relative; z-index:50;">
            <div style="display:flex; align-items:center; gap:12px;">
              ${imgSrc ? `
                <div style="position:relative; width:62px; height:62px; border-radius:10px; overflow:hidden; border:2px solid #10B981; flex-shrink:0; background:#0f172a; cursor:pointer;" onclick="window.open('${imgSrc}', '_blank')" title="انقر لتكبير الصورة 🔍">
                  <img src="${imgSrc}" alt="إثبات" style="width:100%; height:100%; object-fit:cover;" />
                  <span style="position:absolute; bottom:2px; left:2px; background:rgba(0,0,0,0.7); color:#fff; font-size:0.6rem; padding:1px 3px; border-radius:3px;">🔍</span>
                </div>
              ` : ''}
              <div>
                <strong style="font-size:0.95rem; color:#065F46; display:block; margin-bottom:2px;"><i class="fa-solid fa-circle-check"></i> تم التوثيق واعتماد صورتك بنجاح! ✅</strong>
                <span style="font-size:0.82rem; color:#047857; font-weight:600;"><i class="fa-solid fa-file-image"></i> ${ans.fileName || 'ملف الإثبات المعتمد'}</span>
              </div>
            </div>
            <button type="button" onclick="event.stopPropagation(); changeJourneyProof(${slideIndex});" style="padding:8px 16px; background:#FFFFFF; border:1.5px solid #10B981; color:#065F46; border-radius:10px; font-weight:800; font-size:0.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(16,185,129,0.15); transition:0.2s; position:relative; z-index:60;" onmouseover="this.style.background='#ECFDF5'" onmouseout="this.style.background='#FFFFFF'">
              <i class="fa-solid fa-arrows-rotate"></i>
              <span>تغيير / استبدال الصورة 🔄</span>
            </button>
          </div>
        `;
        preview.style.display = 'block';
      }

      if (feedback && !feedback.classList.contains('show')) {
        feedback.className = 'j-feedback show correct';
        feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ⭐ رائع ومميز! إثباتك معتمد وموثق (+5 نقاط)!`;
        feedback.style.display = 'block';
      }
    }
  });
}
window.restoreJourneyProofUI = restoreJourneyProofUI;
document.addEventListener('DOMContentLoaded', restoreJourneyProofUI);

function journeyAnswer(slideIndex, btn, selectedOption) {
  if (APP.journeyAnswered[slideIndex] !== undefined) return;
  const correctOption = APP.journeyCorrectAnswers[slideIndex];
  const isCorrect = selectedOption === correctOption;
  APP.journeyAnswered[slideIndex] = selectedOption;

  const optionsContainer = document.getElementById(`j-options-${slideIndex}`);
  if (optionsContainer) {
    const buttons = optionsContainer.querySelectorAll('.j-option-btn');
    buttons.forEach((b, i) => {
      b.classList.add('selected');
      if (i === selectedOption) b.classList.add('student-picked');
      if (i === correctOption) b.classList.add('correct');
      if (i === selectedOption && !isCorrect) b.classList.add('wrong');
    });
  }

  const station = typeof getStationForSlide === 'function' ? getStationForSlide(slideIndex) : null;
  const pts = getPointsPerQuestion(slideIndex);
  const feedback = document.getElementById(`j-feedback-${slideIndex}`);

  if (feedback) {
    if (isCorrect) {
      feedback.className = 'j-feedback show correct';
      feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ⭐ إجابة صحيحة وممتازة! كسبت +${pts} نقاط ضمن ${station ? station.title : 'المحطة'}!`;
      if (typeof showPointsToast === 'function') {
        showPointsToast(`⭐ إجابة صحيحة! كسبت +${pts} نقاط ضمن ${station ? station.title : 'المحطة'}!`, `+${pts} نقاط`);
      }
      if (typeof playExpeditionAudioChime === 'function') {
        playExpeditionAudioChime('success');
      }
    } else {
      feedback.className = 'j-feedback show wrong';
      feedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ❌ إجابة خاطئة! لم يتم احتساب نقطة هذا السؤال (${pts} نقطة) في هذه المحطة. الإجابة الصحيحة موضحة بالأخضر.`;
    }
    feedback.style.display = 'block';
  }

  const { totalScore } = calcFinalQuizScore();
  APP.journeyScore = totalScore;

  updateScore();
  buildStepper();
  saveStudentProgress();
  checkAllQuestionsCompleted(); // Auto-stop timer if all done
  if (journeyAutoAdvanceTimer) clearTimeout(journeyAutoAdvanceTimer);
  journeyAutoAdvanceTimer = setTimeout(() => {
    if (APP.journeySlide === slideIndex) goToSlide(getNextQuizSlide(slideIndex));
  }, 1800);
}

function updateScore() {
  const el = document.getElementById('j-score');
  if (el) el.textContent = Math.round(APP.journeyScore || 0);
}

function updateStars() {
  const maxScore = 100;
  const pct = (APP.journeyScore || 0) / maxScore;
  let stars = 0;
  if (pct >= 0.9) stars = 5;
  else if (pct >= 0.75) stars = 4;
  else if (pct >= 0.55) stars = 3;
  else if (pct >= 0.35) stars = 2;
  else if (pct >= 0.15) stars = 1;
  const starsContainer = document.getElementById('j-stars');
  if (starsContainer) {
    const icons = starsContainer.querySelectorAll('i');
    icons.forEach((icon, i) => {
      if (i < stars) {
        icon.classList.add('filled');
        icon.className = 'fa-solid fa-star filled';
      }
    });
  }
}

// ─── Record a single attempt into attempts history for admin reporting ───
function recordJourneyAttempt(attemptNum) {
  if (!APP.journeyAttemptsHistory) APP.journeyAttemptsHistory = [];
  const currentNum = attemptNum || APP.journeyAttemptCount || 1;
  const { totalScore, correctTotal, questionsTotal } = calcFinalQuizScore();
  const scorePercent = questionsTotal > 0 ? Math.round((correctTotal / questionsTotal) * 100) : 0;

  const attemptObj = {
    attemptNumber: currentNum,
    score: totalScore,
    scorePercent: scorePercent,
    correctCount: correctTotal,
    totalQuestions: questionsTotal,
    timeSeconds: APP.journeySeconds || 0,
    completedAt: new Date().toISOString(),
    answered: JSON.parse(JSON.stringify(APP.journeyAnswered || {})),
    isFirstAttempt: (currentNum === 1)
  };

  const existIdx = APP.journeyAttemptsHistory.findIndex(a => a && a.attemptNumber === currentNum);
  if (existIdx >= 0) {
    APP.journeyAttemptsHistory[existIdx] = attemptObj;
  } else {
    APP.journeyAttemptsHistory.push(attemptObj);
  }
}
window.recordJourneyAttempt = recordJourneyAttempt;

// ─── Check if ALL questions in ALL stations are completed ───
function checkAllQuestionsCompleted() {
  if (APP.journeyAllCompleted) return; // Already completed, no need to check again

  const allQuestionSlides = [];
  for (let sNum = 1; sNum <= 5; sNum++) {
    const cfg = VIRTUAL_STATIONS_CONFIG[sNum];
    if (cfg && cfg.questionSlides) {
      cfg.questionSlides.forEach(s => allQuestionSlides.push(s));
    }
  }

  const allAnswered = allQuestionSlides.every(s => APP.journeyAnswered && APP.journeyAnswered[s] !== undefined);

  if (allAnswered && allQuestionSlides.length > 0) {
    APP.journeyAllCompleted = true;
    stopTimer(); // Stop the timer immediately

    // Save first attempt time, score, and answers (only once - never overwritten)
    if (!APP.journeyFirstAttemptSaved) {
      APP.journeyFirstAttemptTime = APP.journeySeconds;
      const { totalScore } = calcFinalQuizScore();
      APP.journeyFirstAttemptScore = totalScore;
      APP.journeyFirstAttemptAnswered = JSON.parse(JSON.stringify(APP.journeyAnswered || {}));
      APP.journeyFirstAttemptSaved = true;
      APP.journeyAttemptCount = 1;
    }

    // Record this attempt in the full attempts history log
    recordJourneyAttempt(APP.journeyAttemptCount || 1);

    saveStudentProgress();

    // Show toast notification
    if (typeof showPointsToast === 'function') {
      const mins = Math.floor(APP.journeySeconds / 60).toString().padStart(2, '0');
      const secs = (APP.journeySeconds % 60).toString().padStart(2, '0');
      showPointsToast(`🎉 أحسنت! أكملت جميع الأسئلة في ${mins}:${secs} — تم إيقاف العداد وحفظ نتيجتك!`, `✅ مكتمل`);
    }
  }
}
window.checkAllQuestionsCompleted = checkAllQuestionsCompleted;

function startTimer() {
  stopTimer();
  if (APP.journeySlide === 0 || APP.journeySlide === 30) return;
  if (APP.journeyAllCompleted) return; // Don't restart timer if all questions completed
  if (APP.journeySeconds === undefined || APP.journeySeconds === null) {
    APP.journeySeconds = 0;
  }
  const updateDisplay = () => {
    const mins = Math.floor(APP.journeySeconds / 60).toString().padStart(2, '0');
    const secs = (APP.journeySeconds % 60).toString().padStart(2, '0');
    const el = document.getElementById('j-timer');
    if (el) el.textContent = `${mins}:${secs}`;
  };
  updateDisplay();
  APP.journeyTimer = setInterval(() => {
    APP.journeySeconds++;
    updateDisplay();
    if (APP.journeySeconds % 2 === 0) {
      saveStudentProgress();
    }
  }, 1000);
}

function stopTimer() {
  if (APP.journeyTimer) { 
    clearInterval(APP.journeyTimer); 
    APP.journeyTimer = null; 
    saveStudentProgress();
  }
}

// ─── Seamless Multi-Session Time Tracking Guard ───
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (APP.journeyActive) {
      stopTimer();
    }
  } else if (document.visibilityState === 'visible') {
    if (APP.journeyActive) {
      startTimer();
    }
  }
});
window.addEventListener('beforeunload', () => {
  if (APP.journeyActive) {
    saveStudentProgress();
  }
});

// ═══════════════════════════════════════════════════════
// ANIMATED CANVAS BACKGROUND ENGINE
// Uses ONLY the 5 brand colors: #882D1B, #BC8859, #607976, #868185, #FEFEFE
// ═══════════════════════════════════════════════════════

const CANVAS_BG = {
  canvas: null,
  ctx: null,
  animId: null,
  running: false,
  width: 0,
  height: 0,
  time: 0,
  particles: [],
  nodes: [],
  waves: [],
  mouse: { x: -1000, y: -1000 },
};

function initCanvasBg() {
  CANVAS_BG.canvas = document.getElementById('journey-canvas');
  if (!CANVAS_BG.canvas) return;
  CANVAS_BG.ctx = CANVAS_BG.canvas.getContext('2d');

  function resize() {
    CANVAS_BG.width = window.innerWidth;
    CANVAS_BG.height = window.innerHeight;
    CANVAS_BG.canvas.width = CANVAS_BG.width;
    CANVAS_BG.canvas.height = CANVAS_BG.height;
  }
  resize();
  window.addEventListener('resize', resize);

  // Track mouse for interactive parallax
  document.getElementById('journey-fullscreen')?.addEventListener('mousemove', (e) => {
    CANVAS_BG.mouse.x = e.clientX;
    CANVAS_BG.mouse.y = e.clientY;
  });

  // Create particles (floating orbs)
  CANVAS_BG.particles = [];
  const colors = [
    { r: 135, g: 42, b: 8 },     // #872A08 Royal University Maroon (عودي)
    { r: 211, g: 180, b: 139 },  // #D3B48B Radiant Gold (ذهبي)
    { r: 132, g: 74, b: 53 },    // #844A35 Warm Maroon
    { r: 96, g: 121, b: 118 },   // #607976 Teal
    { r: 180, g: 160, b: 145 },  // Warm Elegant Gray
  ];

  // Small floating particles
  for (let i = 0; i < 60; i++) {
    const color = colors[i % 5];
    CANVAS_BG.particles.push({
      x: Math.random() * CANVAS_BG.width,
      y: Math.random() * CANVAS_BG.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.35,
      radius: 1.8 + Math.random() * 3.5,
      color: color,
      alpha: 0.25 + Math.random() * 0.35,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.006 + Math.random() * 0.015,
    });
  }

  // Large subtle ambient orbs
  for (let i = 0; i < 10; i++) {
    const ci = i % 3;
    CANVAS_BG.particles.push({
      x: Math.random() * CANVAS_BG.width,
      y: Math.random() * CANVAS_BG.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.12,
      radius: 35 + Math.random() * 55,
      color: colors[ci],
      alpha: 0.03 + Math.random() * 0.06,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.003 + Math.random() * 0.005,
      isOrb: true,
    });
  }

  // Constellation nodes
  CANVAS_BG.nodes = [];
  for (let i = 0; i < 40; i++) {
    CANVAS_BG.nodes.push({
      x: Math.random() * CANVAS_BG.width,
      y: Math.random() * CANVAS_BG.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.25,
      radius: 2 + Math.random() * 2,
    });
  }

  // Animated Waves
  CANVAS_BG.waves = [];
  for (let i = 0; i < 6; i++) {
    CANVAS_BG.waves.push({
      amplitude: 30 + Math.random() * 50,
      frequency: 0.0015 + Math.random() * 0.0025,
      speed: 0.0003 + Math.random() * 0.0006,
      yOffset: 0.2 + Math.random() * 0.6,
      color: colors[i % 3],
      alpha: 0.06 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function startCanvasBg() {
  if (CANVAS_BG.running) return;
  if (!CANVAS_BG.canvas) initCanvasBg();
  if (!CANVAS_BG.canvas) return;
  CANVAS_BG.running = true;
  CANVAS_BG.time = performance.now();
  animateCanvas();
}

function stopCanvasBg() {
  CANVAS_BG.running = false;
  if (CANVAS_BG.animId) {
    cancelAnimationFrame(CANVAS_BG.animId);
    CANVAS_BG.animId = null;
  }
}

function animateCanvas() {
  if (!CANVAS_BG.running) return;
  CANVAS_BG.animId = requestAnimationFrame(animateCanvas);

  const ctx = CANVAS_BG.ctx;
  const W = CANVAS_BG.width;
  const H = CANVAS_BG.height;
  const now = performance.now();
  const dt = now - CANVAS_BG.time;

  // ─── Pure Royal Pearl White & Cream Background ───
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

  // ─── Draw animated waves ───
  CANVAS_BG.waves.forEach(wave => {
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

  // ─── Draw constellation network ───
  const maxDist = 170;
  CANVAS_BG.nodes.forEach(node => {
    // Move
    node.x += node.vx;
    node.y += node.vy;
    if (node.x < 0 || node.x > W) node.vx *= -1;
    if (node.y < 0 || node.y > H) node.vy *= -1;
    node.x = Math.max(0, Math.min(W, node.x));
    node.y = Math.max(0, Math.min(H, node.y));
  });

  // Draw connections
  for (let i = 0; i < CANVAS_BG.nodes.length; i++) {
    for (let j = i + 1; j < CANVAS_BG.nodes.length; j++) {
      const a = CANVAS_BG.nodes[i];
      const b = CANVAS_BG.nodes[j];
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

  // Draw node dots
  CANVAS_BG.nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(135, 42, 8, 0.35)';
    ctx.fill();
  });

  // ─── Draw particles & orbs ───
  CANVAS_BG.particles.forEach(p => {
    // Mouse parallax for orbs
    if (p.isOrb) {
      const mx = (CANVAS_BG.mouse.x - W / 2) * 0.01;
      const my = (CANVAS_BG.mouse.y - H / 2) * 0.01;
      p.x += p.vx + mx * 0.02;
      p.y += p.vy + my * 0.02;
    } else {
      p.x += p.vx;
      p.y += p.vy;
    }

    // Wrap around edges
    if (p.x < -50) p.x = W + 50;
    if (p.x > W + 50) p.x = -50;
    if (p.y < -50) p.y = H + 50;
    if (p.y > H + 50) p.y = -50;

    // Pulse alpha
    p.pulse += p.pulseSpeed;
    const pulseAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));

    if (p.isOrb) {
      // Draw glowing orb
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha * 1.5})`);
      grad.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha * 0.5})`);
      grad.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Draw small particle with glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha})`;
      ctx.fill();

      // Subtle glow
      if (p.radius > 2) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${pulseAlpha * 0.1})`;
        ctx.fill();
      }
    }
  });

  // ─── Draw subtle grid ───
  ctx.strokeStyle = 'rgba(134, 129, 133, 0.03)';
  ctx.lineWidth = 0.5;
  const gridSize = 80;
  const gridOffsetX = (now * 0.005) % gridSize;
  for (let x = -gridSize + gridOffsetX; x < W + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}


// ═══════════════════════════════════════════════════════
// CAMPUS MAP: رحلة رواد الحضورية — Interactive Map Logic + QR Scanner + Points
// ═══════════════════════════════════════════════════════════════════════════════

const CAMPUS = {
  active: false,
  currentModal: null,
  visited: { door: false, booth1: false, booth2: false, booth3: false, booth4: false, theater: false },
  scanned: {}, // tracks which stations/workshops have been QR-scanned
  points: 0,
  stationOrder: ['door', 'booth1', 'booth2', 'booth3', 'booth4', 'theater'],
  totalStations: 6,
  qrScanner: null, // html5-qrcode scanner instance
  qrScanTarget: null, // current scan target (station or workshop id)
  qrScanPoints: 0, // points for current scan
};

// ─── Load saved progress ──────────────────────────────
function getEffectiveStudentId() {
  return (typeof APP !== 'undefined' && APP.journeyStudentId) 
      || localStorage.getItem('uhb_student_id') 
      || localStorage.getItem('uhb_last_student_id') 
      || 'guest_student';
}
window.getEffectiveStudentId = getEffectiveStudentId;

function loadCampusProgress() {
  try {
    const studentId = getEffectiveStudentId();
    const saved = localStorage.getItem('uoh_campus_journey_v10_' + studentId) || localStorage.getItem('uoh_campus_journey_v10');
    if (saved) {
      const data = JSON.parse(saved);
      CAMPUS.stationOrder.forEach(key => {
        if (data.visited?.[key] !== undefined) CAMPUS.visited[key] = !!data.visited[key];
      });
      CAMPUS.scanned = data.scanned || {};
      CAMPUS.points = data.points || 0;
    }
  } catch(e) { console.warn('[Campus] Failed to load progress', e); }
}

function saveCampusProgress() {
  try {
    const studentId = getEffectiveStudentId();
    const payload = JSON.stringify({
      visited: CAMPUS.visited,
      scanned: CAMPUS.scanned,
      points: CAMPUS.points,
      studentId: studentId
    });
    localStorage.setItem('uoh_campus_journey_v10_' + studentId, payload);
    localStorage.setItem('uoh_campus_journey_v10', payload);
    if (typeof syncStudentProgressToBackend === 'function') {
      syncStudentProgressToBackend(studentId);
    }
  } catch(e) { console.warn('[Campus] Failed to save progress', e); }
}

function resetCampusProgress() {
  const studentId = getEffectiveStudentId();
  CAMPUS.visited = { door: false, booth1: false, booth2: false, booth3: false, booth4: false, theater: false };
  CAMPUS.scanned = {};
  CAMPUS.points = 0;
  localStorage.removeItem('uoh_campus_journey_v10_' + studentId);
  localStorage.removeItem('uoh_campus_journey_v10');
  localStorage.removeItem('campus_progress_v2');
  applyStationStates();
  updateCampusProgress();
  openWelcomeGuide();
}

// ─── Dropdown Toggle ──────────────────────────────────
function toggleCampusDropdown(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const dd = document.getElementById('campus-dropdown');
  // Close other dropdowns
  document.getElementById('journey-dropdown')?.classList.remove('open');
  document.getElementById('quiz-stations-dropdown')?.classList.remove('open');
  dd?.classList.toggle('open');
}

// Close all nav dropdowns on outside click
document.addEventListener('click', (e) => {
  const quizDd = document.getElementById('quiz-stations-dropdown');
  if (quizDd && !quizDd.contains(e.target)) {
    quizDd.classList.remove('open');
  }
  const journeyDd = document.getElementById('journey-dropdown');
  if (journeyDd && !journeyDd.contains(e.target)) {
    journeyDd.classList.remove('open');
  }
  const campusDd = document.getElementById('campus-dropdown');
  if (campusDd && !campusDd.contains(e.target)) {
    campusDd.classList.remove('open');
  }
});

