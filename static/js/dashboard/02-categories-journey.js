  function addBrowseCardField() {
    const currentCatName = document.getElementById('catName') ? document.getElementById('catName').value.trim() : '';
    if (isProtectedCoreCategory(currentCatName)) {
      alert('🔒 لا يمكن إضافة بطاقة تصفح لهذا القسم لأنه قسم محمي ويعتمد بالكامل على نصوص ومواد اللوائح الرسمية المعتمدة.');
      return;
    }
    if (adminBrowseCards.length >= 6) {
      alert('الحد الأقصى لبطاقات التصفح هو 6 بطاقات فقط لكل قسم لضمان التناسق والمظهر المؤسسي.');
      return;
    }
    adminBrowseCards.push({
      title: `${adminBrowseCards.length + 1}. عنوان بطاقة جديد`,
      desc: '',
      icon: 'fa-circle-info'
    });
    renderBrowseCardsBuilder();
  }

  function removeBrowseCardField(idx) {
    adminBrowseCards.splice(idx, 1);
    renderBrowseCardsBuilder();
  }

  function updateBrowseCardData(idx, field, value) {
    if (adminBrowseCards[idx]) {
      adminBrowseCards[idx][field] = value;
      const counter = document.getElementById('browse-cards-counter');
      if (counter) counter.textContent = `${adminBrowseCards.length} من 6 بطاقات مضافة`;
    }
  }

  function populateCategorySelects() {
    const qSelect = document.getElementById('qCategorySelect');
    const filterSelect = document.getElementById('admin-category-filter');
    
    if (qSelect) {
      const curVal = qSelect.value;
      qSelect.innerHTML = `<option value="">اختر القسم التابع له السؤال *</option>` +
        allAdminCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      qSelect.value = curVal;
    }

    if (filterSelect) {
      const curVal = filterSelect.value;
      filterSelect.innerHTML = `<option value="all">🔍 جميع الأقسام والتصنيفات (${allAdminQuestions.length} سؤال)</option>` +
        allAdminCategories.map(c => {
          const qCount = allAdminQuestions.filter(q => String(q.category_id) === String(c.id)).length;
          return `<option value="${c.id}">📂 قسم: ${c.name} (${qCount} أسئلة)</option>`;
        }).join('');
      filterSelect.value = curVal;
    }
  }

  function toggleCustomCategoryIcon(val) {
    const customInput = document.getElementById('catIconCustom');
    if (customInput) {
      customInput.style.display = (val === 'custom') ? 'block' : 'none';
    }
  }

  function openAddCategoryModal() {
    document.getElementById('catId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catDescription').value = '';
    document.getElementById('catIcon').value = 'fa-folder';
    const customInput = document.getElementById('catIconCustom');
    if (customInput) {
      customInput.value = '';
      customInput.style.display = 'none';
    }
    document.getElementById('catColor').value = '#882D1B';
    document.getElementById('catModalTitle').innerHTML = `<i class="fa-solid fa-folder-plus" style="color:var(--c3);"></i> إنشاء قسم جديد ومستقبلي`;
    adminBrowseCards = [];
    renderBrowseCardsBuilder();
    document.getElementById('categoryModal').style.display = 'flex';
  }

  function editAdminCategory(c) {
    document.getElementById('catId').value = c.id;
    document.getElementById('catName').value = c.name || '';
    document.getElementById('catDescription').value = c.description || '';
    
    const iconSel = document.getElementById('catIcon');
    const customInput = document.getElementById('catIconCustom');
    const iconVal = c.icon || 'fa-folder';
    
    let existsInSelect = false;
    if (iconSel) {
      for (let opt of iconSel.options) {
        if (opt.value === iconVal) {
          existsInSelect = true;
          break;
        }
      }
      if (existsInSelect) {
        iconSel.value = iconVal;
        if (customInput) customInput.style.display = 'none';
      } else {
        iconSel.value = 'custom';
        if (customInput) {
          customInput.value = iconVal;
          customInput.style.display = 'block';
        }
      }
    }

    document.getElementById('catColor').value = c.color || '#882D1B';
    document.getElementById('catModalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square" style="color:var(--c3);"></i> تعديل القسم #${c.id} وبطاقات التصفح`;
    adminBrowseCards = Array.isArray(c.browse_cards) ? JSON.parse(JSON.stringify(c.browse_cards)) : [];
    renderBrowseCardsBuilder();
    document.getElementById('categoryModal').style.display = 'flex';
  }

  function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    const cid = document.getElementById('catId').value;
    
    let selectedIcon = document.getElementById('catIcon').value.trim();
    if (selectedIcon === 'custom') {
      const customVal = document.getElementById('catIconCustom').value.trim();
      selectedIcon = customVal || 'fa-folder';
    }

    const payload = {
      name: document.getElementById('catName').value.trim(),
      description: document.getElementById('catDescription').value.trim(),
      icon: selectedIcon,
      color: document.getElementById('catColor').value.trim(),
      browse_cards: adminBrowseCards
    };

    const url = cid ? `/api/admin/quiz-categories/edit/${cid}` : '/api/admin/quiz-categories/add';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'تم حفظ القسم الجديد وبطاقات التصفح بنجاح!');
        closeCategoryModal();
        fetchAdminCategories();
      } else {
        alert(data.error || 'حدث خطأ أثناء الحفظ.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالسيرفر.');
    }
  }

  async function deleteAdminCategory(cid) {
    if (!confirm('هل أنت تأكد من رغبتك في حذف هذا القسم؟ سيتم تفريغ ربط الأسئلة به.')) return;
    try {
      const res = await fetch(`/api/admin/quiz-categories/delete/${cid}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchAdminCategories();
        fetchAdminQuestions();
      } else {
        alert(data.error || 'حدث خطأ في الحذف.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالسيرفر.');
    }
  }

  function switchQSubtab(target) {
    const quizBtn = document.getElementById('btn-subtab-quiz');
    const journeyBtn = document.getElementById('btn-subtab-journey');
    const quizContent = document.getElementById('subtab-quiz-content');
    const journeyContent = document.getElementById('subtab-journey-content');

    if (target === 'quiz') {
      if (quizBtn) quizBtn.classList.add('active-subtab');
      if (journeyBtn) journeyBtn.classList.remove('active-subtab');
      if (quizContent) quizContent.style.display = 'block';
      if (journeyContent) journeyContent.style.display = 'none';
    } else {
      if (journeyBtn) journeyBtn.classList.add('active-subtab');
      if (quizBtn) quizBtn.classList.remove('active-subtab');
      if (journeyContent) journeyContent.style.display = 'block';
      if (quizContent) quizContent.style.display = 'none';
      fetchJourneyQuestionsAdmin();
    }
  }

  async function fetchAdminQuestions() {
    try {
      const res = await fetch('/api/admin/quiz-questions');
      const data = await res.json();
      if (data.success) {
        allAdminQuestions = data.questions || [];
        renderAdminCategoriesGrid();
        
        ['hdr-bank-q-count', 'modal-bank-q-count', 'quiz-q-count-badge'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = allAdminQuestions.length;
        });

        if (document.getElementById('allQuestionsBankModal') && document.getElementById('allQuestionsBankModal').style.display !== 'none') {
          filterGlobalBankQuestions();
        }
      }
    } catch (e) {
      console.error('Fetch questions error:', e);
    }
  }

  function renderAdminQuestionsTable(list) {
    const tbody = document.getElementById('admin-questions-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--ink-400);">لا توجد أسئلة مضافة بعد. اضغط "إضافة سؤال جديد" لبدء الإضافة.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(q => {
      const isTF = (q.option_a && q.option_a.includes('صح')) && (!q.option_c && !q.option_d);
      const typeBadge = isTF ? `<span class="pill pill-info"><i class="fa-solid fa-check-double"></i> صح/خطأ</span>` : `<span class="pill pill-warn"><i class="fa-solid fa-list-ul"></i> خيارات متعددة</span>`;
      const catBadge = q.category_name ? `<span class="pill pill-tan" style="font-size:0.73rem;"><i class="fa-solid fa-folder"></i> ${q.category_name}</span>` : `<span class="pill pill-neu" style="font-size:0.73rem;">عام</span>`;

      let optsText = `أ: ${q.option_a || '—'} | ب: ${q.option_b || '—'}`;
      if (q.option_c) optsText += ` | ج: ${q.option_c}`;
      if (q.option_d) optsText += ` | د: ${q.option_d}`;

      const imgBadge = q.image_url ? `<div style="margin-top:4px;"><img src="${q.image_url}" style="height:36px; border-radius:6px; border:1px solid var(--ink-300);"></div>` : '';

      return `
        <tr>
          <td><strong>#${q.id}</strong></td>
          <td>${catBadge}</td>
          <td style="max-width:280px; font-weight:700;">
            ${q.question}
            ${imgBadge}
          </td>
          <td>${typeBadge}</td>
          <td style="max-width:220px; font-size:0.8rem; color:var(--ink-600);">${optsText} <br><strong style="color:var(--c1);">[الإجابة: ${q.correct_option.toUpperCase()}]</strong></td>
          <td><span class="pill pill-neu">${q.article_ref || 'عام'}</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick='editAdminQuestion(${JSON.stringify(q).replace(/'/g, "&#39;")})' class="tb-btn" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteAdminQuestion(${q.id})" class="tb-btn" style="color:var(--danger);" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function filterAdminQuestions(type) {
    document.querySelectorAll('[id^="filter-"]').forEach(b => b.classList.remove('active-filter'));
    const btn = document.getElementById('filter-' + type);
    if (btn) btn.classList.add('active-filter');

    if (type === 'all') {
      renderAdminQuestionsTable(allAdminQuestions);
    } else if (type === 'tf') {
      const filtered = allAdminQuestions.filter(q => (q.option_a && q.option_a.includes('صح')) && (!q.option_c && !q.option_d));
      renderAdminQuestionsTable(filtered);
    } else if (type === 'mc') {
      const filtered = allAdminQuestions.filter(q => !(q.option_a && q.option_a.includes('صح')) || (q.option_c || q.option_d));
      renderAdminQuestionsTable(filtered);
    }
  }

  function filterAdminQuestionsByCategory(catId) {
    if (catId === 'all') {
      renderAdminQuestionsTable(allAdminQuestions);
    } else {
      const filtered = allAdminQuestions.filter(q => String(q.category_id) === String(catId));
      renderAdminQuestionsTable(filtered);
    }
  }

  // ─── Multi-Image Management (up to 4 images with captions) ──────
  let currentQuestionImages = []; // [{url, caption}, ...]
  const MAX_QUESTION_IMAGES = 4;

  async function uploadQuizQuestionImage(input) {
    if (!input.files || !input.files[0]) return;
    if (currentQuestionImages.length >= MAX_QUESTION_IMAGES) {
      alert(`⚠️ الحد الأقصى ${MAX_QUESTION_IMAGES} صور لكل سؤال`);
      input.value = '';
      return;
    }
    const file = input.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        currentQuestionImages.push({ url: data.url, caption: '' });
        renderQuestionImagesUI();
      } else {
        alert(data.error || 'فشل رفع الصورة');
      }
    } catch (e) {
      alert('حدث خطأ أثناء رفع الصورة');
    }
    input.value = '';
  }

  async function replaceQuestionImage(index) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async function() {
      if (!this.files || !this.files[0]) return;
      const formData = new FormData();
      formData.append('image', this.files[0]);
      try {
        const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
          currentQuestionImages[index].url = data.url;
          renderQuestionImagesUI();
        } else {
          alert(data.error || 'فشل تغيير الصورة');
        }
      } catch(e) {
        alert('حدث خطأ أثناء رفع الصورة');
      }
    };
    fileInput.click();
  }

  function removeQuestionImage(index) {
    currentQuestionImages.splice(index, 1);
    renderQuestionImagesUI();
  }

  function updateQuestionImageCaption(index, caption) {
    if (currentQuestionImages[index]) {
      currentQuestionImages[index].caption = caption;
    }
  }

  function removeQuizQuestionImage() {
    const el = document.getElementById('qImageUrl');
    if (el) el.value = '';
    const fi = document.getElementById('qImageFile');
    if (fi) fi.value = '';
    const pw = document.getElementById('qImgPreviewWrap');
    if (pw) pw.style.display = 'none';
    const rb = document.getElementById('removeQImgBtn');
    if (rb) rb.style.display = 'none';
    currentQuestionImages = [];
    renderQuestionImagesUI();
  }

  function renderQuestionImagesUI() {
    const container = document.getElementById('qMultiImagesContainer');
    if (!container) return;

    const hiddenField = document.getElementById('qImagesJson');
    if (hiddenField) hiddenField.value = JSON.stringify(currentQuestionImages);

    const legacyField = document.getElementById('qImageUrl');
    if (legacyField) legacyField.value = currentQuestionImages.length > 0 ? currentQuestionImages[0].url : '';

    const oldPreview = document.getElementById('qImgPreviewWrap');
    if (oldPreview) oldPreview.style.display = 'none';
    const oldRemoveBtn = document.getElementById('removeQImgBtn');
    if (oldRemoveBtn) oldRemoveBtn.style.display = 'none';

    if (currentQuestionImages.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--ink-400); font-size:0.82rem;"><i class="fa-regular fa-image" style="font-size:1.5rem; margin-bottom:6px; display:block;"></i>لم يتم رفع أي صور بعد</div>';
      return;
    }

    let html = '';
    currentQuestionImages.forEach((img, idx) => {
      html += `
        <div style="
          display:flex; gap:10px; align-items:flex-start; padding:10px;
          background:var(--ink-50); border-radius:12px; border:1px solid var(--ink-200);
          margin-bottom:8px; position:relative;
        ">
          <div style="position:relative; flex-shrink:0;">
            <img src="${img.url}" style="
              width:90px; height:90px; object-fit:cover; border-radius:10px;
              border:2px solid var(--ink-200); cursor:pointer;
            " onclick="window.open('${img.url}','_blank')" title="اضغط لفتح الصورة">
            <div style="
              position:absolute; top:-6px; right:-6px; background:var(--c2);
              color:white; width:20px; height:20px; border-radius:50%;
              display:flex; align-items:center; justify-content:center;
              font-size:0.7rem; font-weight:700;
            ">${idx + 1}</div>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <input type="text" value="${(img.caption || '').replace(/"/g, '&quot;')}" 
                   placeholder="اكتب وصف الصورة هنا..." 
                   onchange="updateQuestionImageCaption(${idx}, this.value)"
                   style="
                     width:100%; padding:8px 10px; border:1px solid var(--ink-200);
                     border-radius:8px; font-size:0.82rem; font-family:inherit;
                     background:white; transition:border-color 0.2s;
                   "
                   onfocus="this.style.borderColor='var(--c2)'"
                   onblur="this.style.borderColor='var(--ink-200)'"
            >
            <div style="display:flex; gap:6px;">
              <button type="button" onclick="replaceQuestionImage(${idx})" 
                      class="btn-outline" style="font-size:0.75rem; padding:4px 10px;">
                <i class="fa-solid fa-arrows-rotate"></i> تغيير
              </button>
              <button type="button" onclick="removeQuestionImage(${idx})" 
                      class="btn-outline" style="font-size:0.75rem; padding:4px 10px; color:var(--danger); border-color:var(--danger);">
                <i class="fa-solid fa-trash"></i> حذف
              </button>
            </div>
          </div>
        </div>
      `;
    });

    if (currentQuestionImages.length < MAX_QUESTION_IMAGES) {
      html += `<div style="text-align:center; padding:8px;"><span style="font-size:0.75rem; color:var(--ink-400);">${currentQuestionImages.length} من ${MAX_QUESTION_IMAGES} صور</span></div>`;
    } else {
      html += `<div style="text-align:center; padding:6px; color:var(--c2); font-size:0.75rem; font-weight:700;"><i class="fa-solid fa-circle-check"></i> تم الوصول للحد الأقصى (${MAX_QUESTION_IMAGES} صور)</div>`;
    }

    container.innerHTML = html;
  }

  window.uploadQuizQuestionImage = uploadQuizQuestionImage;
  window.replaceQuestionImage = replaceQuestionImage;
  window.removeQuestionImage = removeQuestionImage;
  window.updateQuestionImageCaption = updateQuestionImageCaption;
  window.removeQuizQuestionImage = removeQuizQuestionImage;


  // ─── Attachment Upload/Management Functions ──────────────
  let currentAttachments = [];

  async function uploadQuizAttachment(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload-attachment', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        currentAttachments.push({
          url: data.url,
          original_name: data.original_name,
          file_type: data.file_type,
          extension: data.extension
        });
        document.getElementById('qAttachments').value = JSON.stringify(currentAttachments);
        renderAttachmentsList();
      } else {
        alert(data.error || 'فشل رفع المرفق');
      }
    } catch (e) {
      alert('حدث خطأ أثناء رفع المرفق');
    }
    input.value = '';
  }

  function removeAttachment(idx) {
    currentAttachments.splice(idx, 1);
    document.getElementById('qAttachments').value = JSON.stringify(currentAttachments);
    renderAttachmentsList();
  }

  function renderAttachmentsList() {
    const container = document.getElementById('qAttachList');
    if (!container) return;

    if (currentAttachments.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = currentAttachments.map((att, idx) => {
      const iconMap = {
        'image': 'fa-file-image',
        'pdf': 'fa-file-pdf',
        'document': 'fa-file-word'
      };
      const colorMap = {
        'image': '#3B82F6',
        'pdf': '#EF4444',
        'document': '#2563EB'
      };
      const icon = iconMap[att.file_type] || 'fa-file';
      const color = colorMap[att.file_type] || 'var(--ink-500)';

      return `
        <div style="display:flex; align-items:center; gap:8px; background:#fff; padding:8px 12px; border-radius:8px; border:1px solid var(--ink-200);">
          <i class="fa-solid ${icon}" style="color:${color}; font-size:1rem;"></i>
          <a href="${att.url}" target="_blank" style="flex:1; font-size:0.82rem; font-weight:600; color:var(--ink-700); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${att.original_name}</a>
          <span style="font-size:0.7rem; color:var(--ink-400); background:var(--ink-100); padding:2px 6px; border-radius:4px;">${att.extension}</span>
          <button type="button" onclick="removeAttachment(${idx})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.85rem;" title="حذف المرفق">
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  function openAddQuestionModal() {
    populateCategorySelects();
    if (document.getElementById('qId')) document.getElementById('qId').value = '';
    
    // Auto-select category if currently filtered
    const filterSelect = document.getElementById('admin-category-filter');
    const curFilter = filterSelect ? filterSelect.value : 'all';
    const catSelect = document.getElementById('qCategorySelect');
    if (catSelect) {
      catSelect.value = (curFilter !== 'all') ? curFilter : '';
    }
    if (document.getElementById('qText')) document.getElementById('qText').value = '';
    if (document.getElementById('qType')) document.getElementById('qType').value = 'mc';
    if (document.getElementById('optA')) document.getElementById('optA').value = '';
    if (document.getElementById('optB')) document.getElementById('optB').value = '';
    if (document.getElementById('optC')) document.getElementById('optC').value = '';
    if (document.getElementById('optD')) document.getElementById('optD').value = '';
    if (document.getElementById('qCorrect')) document.getElementById('qCorrect').value = 'a';
    if (document.getElementById('qArticleRef')) document.getElementById('qArticleRef').value = '';
    if (document.getElementById('qExplanation')) document.getElementById('qExplanation').value = '';
    
    // Reset station and options count
    if (document.getElementById('qStationSelect')) document.getElementById('qStationSelect').value = '';
    if (document.getElementById('qOptionsCount')) document.getElementById('qOptionsCount').value = '4';
    toggleOptionsCountFields();

    // Reset image & attachments safely
    removeQuizQuestionImage();
    currentAttachments = [];
    if (document.getElementById('qAttachments')) document.getElementById('qAttachments').value = '[]';
    renderAttachmentsList();
    if (document.getElementById('qDifficulty')) document.getElementById('qDifficulty').value = 'medium';

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-plus-circle" style="color:var(--c3);"></i> إضافة سؤال جديد`;
    
    toggleQTypeFields();
    
    const modal = document.getElementById('questionModal');
    if (modal) modal.style.display = 'flex';
  }

