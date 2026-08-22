  function toggleOptionsCountFields() {
    const count = parseInt(document.getElementById('qOptionsCount')?.value || '4');
    const optC = document.getElementById('optC');
    const optD = document.getElementById('optD');
    const correctSelect = document.getElementById('qCorrect');

    if (optC) optC.parentElement.style.display = count >= 3 ? 'block' : 'none';
    if (optD) optD.parentElement.style.display = count >= 4 ? 'block' : 'none';
    
    // Clear hidden fields
    if (count < 3 && optC) optC.value = '';
    if (count < 4 && optD) optD.value = '';
    
    // Adjust correct option selector
    if (correctSelect) {
      const currentVal = correctSelect.value;
      correctSelect.innerHTML = '';
      const labels = {a: 'الخيار أ', b: 'الخيار ب', c: 'الخيار ج', d: 'الخيار د'};
      const opts = ['a', 'b', 'c', 'd'].slice(0, count);
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = labels[o];
        correctSelect.appendChild(opt);
      });
      if (opts.includes(currentVal)) correctSelect.value = currentVal;
      else correctSelect.value = 'a';
    }
  }
  window.toggleOptionsCountFields = toggleOptionsCountFields;

  function editAdminQuestion(q) {
    document.getElementById('qId').value = q.id;
    if (document.getElementById('qCategorySelect')) document.getElementById('qCategorySelect').value = q.category_id || '';
    document.getElementById('qText').value = q.question || '';
    
    const isTF = (q.option_a && q.option_a.includes('صح')) && (!q.option_c && !q.option_d);
    document.getElementById('qType').value = isTF ? 'tf' : 'mc';

    document.getElementById('optA').value = q.option_a || '';
    document.getElementById('optB').value = q.option_b || '';
    document.getElementById('optC').value = q.option_c || '';
    document.getElementById('optD').value = q.option_d || '';
    document.getElementById('qCorrect').value = q.correct_option || 'a';
    document.getElementById('qArticleRef').value = q.article_ref || '';
    document.getElementById('qExplanation').value = q.explanation || '';

    // Set station
    const stSelect = document.getElementById('qStationSelect');
    if (stSelect) stSelect.value = q.station_number || '';

    // Set options count
    const optCount = [q.option_a, q.option_b, q.option_c, q.option_d].filter(o => o && o.trim()).length || 4;
    const ocSelect = document.getElementById('qOptionsCount');
    if (ocSelect) ocSelect.value = String(optCount);
    toggleOptionsCountFields();

    // Load multi-images from images_json
    try {
      const imagesData = q.images_json ? JSON.parse(q.images_json) : [];
      currentQuestionImages = Array.isArray(imagesData) ? imagesData : [];
    } catch(e) {
      currentQuestionImages = [];
    }
    // Fallback: if no multi-images but has legacy single image
    if (currentQuestionImages.length === 0 && q.image_url) {
      currentQuestionImages = [{ url: q.image_url, caption: '' }];
    }
    renderQuestionImagesUI();

    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square" style="color:var(--c3);"></i> تعديل السؤال #${q.id}`;
    toggleQTypeFields();
    document.getElementById('questionModal').style.display = 'flex';
  }

  function closeQuestionModal() {
    document.getElementById('questionModal').style.display = 'none';
  }

  function toggleQTypeFields() {
    const qType = document.getElementById('qType').value;
    const mcGroup = document.getElementById('mcOptionsGroup');
    const mcOnlyOpts = document.querySelectorAll('.mc-only');

    if (qType === 'tf') {
      mcGroup.style.display = 'none';
      mcOnlyOpts.forEach(o => o.style.display = 'none');
    } else {
      mcGroup.style.display = 'flex';
      mcOnlyOpts.forEach(o => o.style.display = 'block');
    }
  }

  async function reassignQuestionCategory(qid, newCatId) {
    if (!newCatId) return;
    const catObj = allAdminCategories.find(c => String(c.id) === String(newCatId));
    const catName = catObj ? catObj.name : '';

    // Check duplicate in target category before reassigning
    const targetQ = allAdminQuestions.find(q => String(q.id) === String(qid));
    if (targetQ) {
      const normText = (targetQ.question || '').toLowerCase().replace(/[^\w\sأ-ي]/g, '');
      const dup = allAdminQuestions.find(q => String(q.id) !== String(qid) && String(q.category_id) === String(newCatId) && (q.question || '').toLowerCase().replace(/[^\w\sأ-ي]/g, '') === normText);
      if (dup) {
        if (!confirm(`⚠️ تنبيه تكرار السؤال:\n\nقسم [${catName}] يحتوي مسبقاً على سؤال مطبق بنفس النص:\n📌 "${dup.question}" (سؤال #${dup.id})\n\nهل أنت تأكد من رغبتك في نقل السؤال لهذا القسم رغم تكراره؟`)) {
          await fetchAdminQuestions();
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/admin/quiz-questions/edit/${qid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: parseInt(newCatId), category_name: catName })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `تم نقل وتخصيص السؤال بنجاح إلى قسم [${catName}]!`);
        await fetchAdminQuestions();
        await fetchAdminCategories();
      } else {
        alert(data.error || 'حدث خطأ في إعادة تخصيص السؤال.');
      }
    } catch (e) {
      alert('حدث خطأ بالاتصال بالسيرفر.');
    }
  }

  async function handleQuestionSubmit(e) {
    e.preventDefault();
    const qid = document.getElementById('qId').value;
    const qType = document.getElementById('qType').value;

    const catSelect = document.getElementById('qCategorySelect');
    const selectedCatId = catSelect ? catSelect.value : '';
    const selectedCatName = catSelect && catSelect.selectedIndex >= 0 && selectedCatId ? catSelect.options[catSelect.selectedIndex].text : '';

    const questionText = document.getElementById('qText').value.trim();
    if (!questionText) {
      alert('⚠️ يرجى كتابة نص السؤال.');
      return;
    }

    // Station is optional - questions always stored in bank
    const stationVal = document.getElementById('qStationSelect')?.value || '';

    // ─── Duplicate Check within the same Category ───
    const normNew = questionText.toLowerCase().replace(/[^\w\sأ-ي]/g, '');
    const duplicateInCat = allAdminQuestions.find(q => {
      if (qid && String(q.id) === String(qid)) return false;
      if (String(q.category_id) !== String(selectedCatId)) return false;
      const normExisting = (q.question || '').toLowerCase().replace(/[^\w\sأ-ي]/g, '');
      return normExisting === normNew || (normExisting.length > 12 && (normExisting.includes(normNew) || normNew.includes(normExisting)));
    });

    if (duplicateInCat) {
      const catObj = allAdminCategories.find(c => String(c.id) === String(selectedCatId));
      const targetCatName = catObj ? catObj.name : selectedCatName;
      const confirmMsg = `⚠️ تنبيه: هذا السؤال موجود مسبقاً في قسم [${targetCatName}]!\n\n📌 السؤال المضاف سابقاً: "${duplicateInCat.question}" (سؤال #${duplicateInCat.id})\n\nهل أنت تأكد من رغبتك في حفظ هذا السؤال المكرر في نفس القسم أم تريد الإلغاء لتعديله؟\n\n- اضغط "موافق (OK)" لمتابعة الحفظ بالتكرار.\n- اضغط "إلغاء (Cancel)" للتراجع والتعديل.`;
      if (!confirm(confirmMsg)) {
        return; // User canceled submit to avoid duplicate cluttering!
      }
    }

    const payload = {
      question: questionText,
      question_type: qType,
      category_id: selectedCatId ? parseInt(selectedCatId) : null,
      category_name: selectedCatName,
      option_a: document.getElementById('optA').value.trim(),
      option_b: document.getElementById('optB').value.trim(),
      option_c: document.getElementById('optC').value.trim(),
      option_d: document.getElementById('optD').value.trim(),
      correct_option: document.getElementById('qCorrect').value,
      article_ref: document.getElementById('qArticleRef').value.trim(),
      explanation: document.getElementById('qExplanation').value.trim(),
      image_url: document.getElementById('qImageUrl').value.trim(),
      images: currentQuestionImages,
      station_number: document.getElementById('qStationSelect')?.value || null
    };

    const url = qid ? `/api/admin/quiz-questions/edit/${qid}` : '/api/admin/quiz-questions/add';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'تم حفظ وتخصيص السؤال بنجاح!');
        closeQuestionModal();
        await fetchAdminQuestions();
        await fetchAdminCategories();
        fetchJourneyStations();
      } else {
        alert(data.error || 'حدث خطأ أثناء الحفظ.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالسيرفر.');
    }
  }

  async function deleteAdminQuestion(qid) {
    if (!confirm('هل أنت تأكد من رغبتك في حذف هذا السؤال نهائياً؟')) return;
    try {
      const res = await fetch(`/api/admin/quiz-questions/delete/${qid}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'تم حذف السؤال بنجاح!');
        await fetchAdminQuestions();
        await fetchAdminCategories();
        fetchJourneyStations();
      } else {
        alert(data.error || 'حدث خطأ في الحذف.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالسيرفر.');
    }
  }

  // ─── Journey Questions Admin Functions ──────────────────────
  async function fetchJourneyQuestionsAdmin() {
    try {
      const res = await fetch('/api/admin/journey-questions');
      const data = await res.json();
      if (data.success && data.questions) {
        journeyQuestionsData = data.questions;
        renderJourneyQuestionsAdmin();
      }
    } catch (e) {
      console.error('Fetch journey questions error:', e);
    }
  }

  function renderJourneyQuestionsAdmin() {
    const container = document.getElementById('subtab-journey-content');
    if (!container) return;

    const stepIds = Object.keys(journeyQuestionsData).sort((a, b) => parseInt(a) - parseInt(b));
    const totalSteps = stepIds.length;

    let html = `
      <div class="ch" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="ch-icon ic-teal" style="background:rgba(96,121,118,.15);">
            <i class="fa-solid fa-map-location-dot" style="color:var(--a1);"></i>
          </div>
          <div>
            <h2>محطات "ابدأ رحلتك" (${totalSteps} محطة)</h2>
            <p style="font-size:0.8rem; color:var(--ink-500); margin-top:2px;">إضافة، تعديل، حذف، ترتيب المحطات — صلاحيات لا محدودة</p>
          </div>
        </div>
        <button class="btn-primary" onclick="openAddJourneyStepModal()" style="font-size:0.85rem;">
          <i class="fa-solid fa-plus"></i> إضافة محطة جديدة
        </button>
      </div>
      <div class="cb" style="display:flex; flex-direction:column; gap:16px;">
    `;

    if (totalSteps === 0) {
      html += `<div style="text-align:center; padding:40px; color:var(--ink-400);"><i class="fa-solid fa-inbox" style="font-size:2rem; margin-bottom:10px; display:block;"></i>لا توجد محطات. اضغط "إضافة محطة جديدة" للبدء.</div>`;
    }

    stepIds.forEach(id => {
      const qData = journeyQuestionsData[id] || {};
      const title = qData.title || `محطة ${id}`;
      const qText = qData.question || 'لم يتم تحديد السؤال بعد';
      const explanation = qData.explanation || '—';
      const opts = qData.options || [];
      const correct = qData.correct || '';
      const qType = qData.question_type || 'mcq';
      const imgUrl = qData.image_url || '';

      const typeLabel = qType === 'tf' ? 'صح/خطأ' : qType === 'open' ? 'إجابة مفتوحة' : 'خيارات متعددة';
      const typeColor = qType === 'tf' ? 'pill-info' : qType === 'open' ? 'pill-teal' : 'pill-warn';

      let optsHtml = '';
      if (opts.length > 0 && qType !== 'open') {
        optsHtml = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin:8px 0;">' +
          opts.map((op, idx) => {
            const isCorrect = (correct === op || correct === String(idx));
            const bg = isCorrect ? 'rgba(46,125,94,.12)' : 'var(--ink-100)';
            const clr = isCorrect ? 'var(--success)' : 'var(--ink-700)';
            const fw = isCorrect ? '700' : '400';
            const check = isCorrect ? ' ✅' : '';
            return '<div style="padding:6px 12px; background:' + bg + '; color:' + clr + '; font-weight:' + fw + '; border-radius:6px; font-size:0.82rem;">' + (['أ','ب','ج','د','هـ'][idx] || '') + ': ' + op + check + '</div>';
          }).join('') + '</div>';
      }

      const imgPreviewHtml = imgUrl ? '<div style="margin:8px 0;"><img src="' + imgUrl + '" style="max-height:90px; border-radius:8px; border:1px solid var(--ink-300); object-fit:contain;"></div>' : '';

      html += `
        <div style="border:1px solid var(--ink-200); border-radius:14px; padding:18px; background:#fff; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="pill pill-info" style="font-size:0.78rem;"><i class="fa-solid fa-map-pin"></i> المحطة ${id}</span>
              <span style="font-size:0.82rem; font-weight:700; color:var(--ink-700);">${title}</span>
              <span class="pill ${typeColor}" style="font-size:0.72rem;">${typeLabel}</span>
            </div>
            <div style="display:flex; gap:6px;">
              <button onclick="openEditJourneyStepModal('${id}')" class="btn-outline" style="font-size:0.78rem; padding:5px 10px;">
                <i class="fa-solid fa-pen-to-square"></i> تعديل
              </button>
              <button onclick="deleteJourneyStep('${id}')" class="btn-outline" style="font-size:0.78rem; padding:5px 10px; color:var(--danger); border-color:var(--danger);">
                <i class="fa-solid fa-trash"></i> حذف
              </button>
            </div>
          </div>
          <h4 style="font-size:0.92rem; font-weight:800; color:var(--ink-800); margin-bottom:4px;">${qText}</h4>
          ${imgPreviewHtml}
          ${optsHtml}
          <div style="font-size:0.8rem; color:var(--ink-500); background:var(--ink-100); padding:8px 12px; border-radius:8px;">
            💡 <strong>التلميح:</strong> ${explanation}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // ─── Add New Journey Step ─────────────────────────────────
  function openAddJourneyStepModal() {
    document.getElementById('jStepId').value = '';
    document.getElementById('jStepQuestion').value = '';
    document.getElementById('jStepExplanation').value = '';
    document.getElementById('jOpt0').value = '';
    document.getElementById('jOpt1').value = '';
    document.getElementById('jOpt2').value = '';
    removeJourneyStepImage();

    // Add title and question_type fields if they exist
    const titleEl = document.getElementById('jStepTitle');
    if (titleEl) titleEl.value = '';
    const typeEl = document.getElementById('jStepType');
    if (typeEl) typeEl.value = 'mcq';
    const correctEl = document.getElementById('jStepCorrect');
    if (correctEl) correctEl.value = '';

    document.getElementById('jModalTitle').innerHTML = '<i class="fa-solid fa-plus-circle" style="color:var(--c3);"></i> إضافة محطة جديدة في الرحلة';
    document.getElementById('journeyStepModal').style.display = 'flex';
  }

  // ─── Delete Journey Step ──────────────────────────────────
  async function deleteJourneyStep(stepId) {
    if (!confirm('هل أنت متأكد من حذف المحطة #' + stepId + '؟ سيتم إعادة ترقيم المحطات تلقائياً.')) return;
    try {
      const res = await fetch('/api/admin/journey-questions/delete/' + stepId, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchJourneyQuestionsAdmin();
      } else {
        alert(data.error || 'حدث خطأ أثناء الحذف');
      }
    } catch(e) {
      alert('حدث خطأ بالاتصال بالسيرفر');
    }
  }

  function openEditJourneyStepModal(stepId) {
    const qData = journeyQuestionsData[stepId] || {};
    document.getElementById('jStepId').value = stepId;
    document.getElementById('jStepTitle').value = qData.title || '';
    document.getElementById('jStepQuestion').value = qData.question || '';
    document.getElementById('jStepExplanation').value = qData.explanation || '';
    document.getElementById('jStepType').value = qData.question_type || 'mcq';
    document.getElementById('jStepCorrect').value = qData.correct || '';
    
    const opts = qData.options || [];
    document.getElementById('jOpt0').value = opts[0] || '';
    document.getElementById('jOpt1').value = opts[1] || '';
    document.getElementById('jOpt2').value = opts[2] || '';
    document.getElementById('jOpt3').value = opts[3] || '';

    if (qData.image_url) {
      document.getElementById('jImageUrl').value = qData.image_url;
      document.getElementById('jImgPreview').src = qData.image_url;
      document.getElementById('jImgPreviewWrap').style.display = 'block';
      document.getElementById('removeJImgBtn').style.display = 'inline-flex';
    } else {
      removeJourneyStepImage();
    }

    toggleJourneyQTypeFields();
    document.getElementById('jModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color:var(--c3);"></i> تعديل المحطة #' + stepId;
    document.getElementById('journeyStepModal').style.display = 'flex';
  }

  function toggleJourneyQTypeFields() {
    const qType = document.getElementById('jStepType').value;
    const mcqWrap = document.getElementById('jStepOptionsWrap');
    const tfWrap = document.getElementById('jStepTFWrap');

    if (qType === 'mcq') {
      mcqWrap.style.display = 'flex';
      tfWrap.style.display = 'none';
    } else if (qType === 'tf') {
      mcqWrap.style.display = 'none';
      tfWrap.style.display = 'block';
    } else {
      mcqWrap.style.display = 'none';
      tfWrap.style.display = 'none';
    }
  }

  function closeJourneyStepModal() {
    document.getElementById('journeyStepModal').style.display = 'none';
  }

  async function uploadJourneyStepImage(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        document.getElementById('jImageUrl').value = data.url;
        document.getElementById('jImgPreview').src = data.url;
        document.getElementById('jImgPreviewWrap').style.display = 'block';
        document.getElementById('removeJImgBtn').style.display = 'inline-flex';
      } else {
        alert(data.error || 'فشل رفع الصورة');
      }
    } catch (e) {
      alert('حدث خطأ أثناء رفع الصورة');
    }
  }

  function removeJourneyStepImage() {
    document.getElementById('jImageUrl').value = '';
    document.getElementById('jImageFile').value = '';
    document.getElementById('jImgPreview').src = '';
    document.getElementById('jImgPreviewWrap').style.display = 'none';
    document.getElementById('removeJImgBtn').style.display = 'none';
  }

  async function handleJourneyStepSubmit(e) {
    e.preventDefault();
    const stepId = document.getElementById('jStepId').value;
    const qType = document.getElementById('jStepType').value;

    let opts = [];
    if (qType === 'mcq') {
      opts = [
        document.getElementById('jOpt0').value.trim(),
        document.getElementById('jOpt1').value.trim(),
        document.getElementById('jOpt2').value.trim(),
        document.getElementById('jOpt3').value.trim()
      ].filter(o => o !== '');
    } else if (qType === 'tf') {
      opts = ['صح', 'خطأ'];
    }

    const payload = {
      title: document.getElementById('jStepTitle').value.trim(),
      question: document.getElementById('jStepQuestion').value.trim(),
      question_type: qType,
      explanation: document.getElementById('jStepExplanation').value.trim(),
      image_url: document.getElementById('jImageUrl').value.trim(),
      correct: document.getElementById('jStepCorrect').value.trim(),
      options: opts
    };

    // Decide add vs edit
    const isNew = !stepId;
    const url = isNew ? '/api/admin/journey-questions/add' : `/api/admin/journey-questions/edit/${stepId}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'تم الحفظ بنجاح!');
        closeJourneyStepModal();
        fetchJourneyQuestionsAdmin();
      } else {
        alert(data.error || 'حدث خطأ بالعملية.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء الاتصال بالسيرفر.');
    }
  }

  // ─── Date ───────────────────────────────────────────────
