function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let allAdminQuestions = [];
  let allAdminCategories = [];
  let journeyQuestionsData = {};

  function openAllQuestionsBankModal() {
    populateCategorySelects();
    
    const modalFilter = document.getElementById('bankCategoryFilter');
    if (modalFilter) {
      modalFilter.innerHTML = `<option value="all">🔍 جميع الأقسام والتصنيفات (${allAdminQuestions.length} سؤال)</option>` +
        allAdminCategories.map(c => {
          const qCount = allAdminQuestions.filter(q => String(q.category_id) === String(c.id)).length;
          return `<option value="${c.id}">📂 قسم: ${c.name} (${qCount} أسئلة)</option>`;
        }).join('');
    }

    const modalBadge = document.getElementById('modal-bank-q-count');
    if (modalBadge) modalBadge.textContent = allAdminQuestions.length;

    renderGlobalBankQuestions(allAdminQuestions);
    document.getElementById('allQuestionsBankModal').style.display = 'flex';
  }

  function closeAllQuestionsBankModal() {
    document.getElementById('allQuestionsBankModal').style.display = 'none';
  }

  function filterGlobalBankQuestions() {
    const search = (document.getElementById('bankSearchInput')?.value || '').trim().toLowerCase();
    const catId = document.getElementById('bankCategoryFilter')?.value || 'all';

    let list = allAdminQuestions;
    if (catId !== 'all') {
      list = list.filter(q => String(q.category_id) === String(catId));
    }

    if (search) {
      list = list.filter(q => (q.question || '').toLowerCase().includes(search) || (q.article_ref || '').toLowerCase().includes(search) || (q.document_name || '').toLowerCase().includes(search));
    }

    renderGlobalBankQuestions(list);
  }

  function renderGlobalBankQuestions(list) {
    const container = document.getElementById('global-bank-questions-list');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; background:#fff; border-radius:12px; color:var(--ink-400); font-weight:600;">لا توجد أسئلة تطابق البحث أو الفلتر المختار.</div>`;
      return;
    }

    container.innerHTML = list.map(q => {
      const isTF = (q.option_a && q.option_a.includes('صح')) && (!q.option_c && !q.option_d);
      const catObj = allAdminCategories.find(c => String(c.id) === String(q.category_id));
      const catName = catObj ? catObj.name : (q.category_name || 'قسم عام');
      const catColor = catObj ? (catObj.color || 'var(--c1)') : 'var(--c1)';

      let optsText = `أ: ${q.option_a || '—'} | ب: ${q.option_b || '—'}`;
      if (q.option_c) optsText += ` | ج: ${q.option_c}`;
      if (q.option_d) optsText += ` | د: ${q.option_d}`;

      const imgBadge = q.image_url ? `<div style="margin-top:6px;"><img src="${q.image_url}" style="max-height:80px; border-radius:8px; border:1px solid var(--ink-300); object-fit:contain;"></div>` : '';

      const docNameStr = q.document_name || catName || 'لوائح وأنظمة الجامعة';
      const articleRefStr = q.article_ref ? ` — (${q.article_ref})` : '';

      const docBadgeHtml = `
        <div style="margin-bottom:6px; font-size:0.78rem; font-weight:700; color:var(--c1); background:rgba(136,45,27,0.06); padding:3px 8px; border-radius:6px; display:inline-block; border:1px solid rgba(136,45,27,0.15);">
          <i class="fa-solid fa-file-contract"></i> <strong>المستند والمادة:</strong> ${docNameStr}${articleRefStr}
        </div>
      `;

      const isDiscipline = (docNameStr && docNameStr.includes('الانضباط')) || (catName && catName.includes('الانضباط'));
      const docLinkHtml = isDiscipline ? `
        <div style="margin-top:6px; font-size:0.75rem;">
          <a href="/static/uploads/docs/student_discipline_regulations_uhb.docx" target="_blank" download style="color:#059669; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-file-word"></i> 📥 مستند لائحة الانضباط الطلابي 1447-2026 (.docx)
          </a>
        </div>
      ` : '';

      return `
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:14px; padding:16px; box-shadow:var(--sh-xs); border-right:6px solid ${catColor}; transition:transform 0.2s ease;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-weight:800; color:var(--c1); font-size:0.9rem;">#${q.id}</span>
              <span class="pill" style="background:${catColor}18; color:${catColor}; font-weight:800; border:1px solid ${catColor}40; font-size:0.8rem; padding:4px 10px;">
                <i class="fa-solid fa-folder-open"></i> مخصص لـ: قسم ${catName}
              </span>
              <span class="pill pill-neu" style="font-size:0.75rem;">${isTF ? 'صح / خطأ' : 'اختيار من متعدد'}</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <select onchange="reassignQuestionCategory(${q.id}, this.value)" style="font-size:0.76rem; padding:4px 8px; border-radius:6px; border:1px solid var(--ink-300); background:#fff; font-weight:600; cursor:pointer;" title="إعادة تخصيص السؤال لقسم آخر">
                <option value="">🔄 نقل لقسم آخر...</option>
                ${allAdminCategories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(q.category_id) ? 'disabled style="color:#94a3b8;"' : ''}>${String(cat.id) === String(q.category_id) ? '✓ ' + cat.name : 'نقل إلى: ' + cat.name}</option>`).join('')}
              </select>
              <button onclick='editAdminQuestion(${JSON.stringify(q).replace(/'/g, "&#39;")})' class="btn-outline" style="font-size:0.78rem; padding:5px 10px; border-color:var(--c1); color:var(--c1);" title="تعديل السؤال">
                <i class="fa-solid fa-pen-to-square"></i> تعديل
              </button>
              <button onclick="deleteAdminQuestion(${q.id})" class="btn-outline" style="font-size:0.78rem; padding:5px 10px; color:var(--danger); border-color:var(--danger);" title="حذف السؤال">
                <i class="fa-solid fa-trash"></i> حذف
              </button>
            </div>
          </div>

          ${docBadgeHtml}
          <h4 style="font-size:0.95rem; font-weight:800; color:var(--ink-800); margin-bottom:6px; line-height:1.5;">${q.question}</h4>
          ${docLinkHtml}
          ${imgBadge}
          
          <div style="background:#f8fafc; padding:10px 14px; border-radius:10px; margin-top:8px; font-size:0.82rem; color:var(--ink-600); border:1px solid #e2e8f0;">
            <div>${optsText}</div>
            <div style="margin-top:6px; font-weight:700; color:#059669;">
              ✅ الإجابة الصحيحة: [${(q.correct_option || 'a').toUpperCase()}] ${q.correct_option === 'a' ? q.option_a : (q.correct_option === 'b' ? q.option_b : (q.correct_option === 'c' ? q.option_c : q.option_d))}
            </div>
            ${q.explanation ? `<div style="margin-top:4px; font-size:0.76rem; color:#475569;">💡 <strong>الشرح والمادة:</strong> ${q.explanation}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function fetchAdminCategories() {
    try {
      const res = await fetch('/api/admin/quiz-categories');
      const data = await res.json();
      if (data.success) {
        allAdminCategories = data.categories || [];
        renderAdminCategoriesGrid();
        populateCategorySelects();
      }
    } catch (e) {
      console.error('Fetch categories error:', e);
    }
  }

  // ═══ JOURNEY STATIONS MANAGEMENT ═══
  let journeyStationsData = [];

  async function fetchJourneyStations() {
    const grid = document.getElementById('journey-stations-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; color:#059669;"></i><div style="margin-top:8px;">جاري تحميل المحطات...</div></div>';
    try {
      const res = await fetch('/api/admin/journey/stations');
      const data = await res.json();
      if (data.success) {
        journeyStationsData = data.stations || [];
        renderJourneyStationsGrid(journeyStationsData);
      }
    } catch(e) {
      console.error('Fetch stations error:', e);
      if (grid) grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--danger);">خطأ في تحميل المحطات</div>';
    }
  }
  window.fetchJourneyStations = fetchJourneyStations;

  function renderJourneyStationsGrid(stations) {
    const grid = document.getElementById('journey-stations-grid');
    if (!grid) return;

    grid.innerHTML = stations.map(st => {
      const qCount = st.questions_count || 0;
      const ppq = st.points_per_question || 0;
      const proofSlots = st.proof_slots || [];

      // Questions list HTML
      const questionsHtml = st.questions.map((q, qi) => `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; margin-bottom:6px; font-size:0.82rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div style="flex:1;">
              <span style="color:${st.color}; font-weight:800;">#${q.id}</span>
              <span style="font-weight:700; color:#1e293b;">${q.question}</span>
              <div style="margin-top:4px; font-size:0.73rem; color:#64748b;">
                ${q.options_count} خيارات | الصحيحة: <strong style="color:#059669;">[${(q.correct_option||'a').toUpperCase()}]</strong>
                | ${ppq} نقطة
              </div>
            </div>
            <div style="display:flex; gap:4px; flex-shrink:0;">
              <select onchange="moveQuestionToStation(${q.id}, this.value)" style="font-size:0.7rem; padding:2px 4px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer;" title="نقل لمحطة أخرى">
                <option value="">🔄 نقل...</option>
                ${[1,2,3,4,5].filter(s => s !== st.station_number).map(s => `<option value="${s}">محطة ${s}</option>`).join('')}
              </select>
              <button onclick='editAdminQuestion(${JSON.stringify(q).replace(/'/g, "&#39;")})' style="background:none; border:none; color:${st.color}; cursor:pointer; font-size:0.9rem;" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteAdminQuestion(${q.id})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem;" title="حذف"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
      `).join('');

      // Proof slots HTML (protected)
      const proofsHtml = proofSlots.map(p => `
        <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:8px 12px; margin-bottom:6px; font-size:0.8rem; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-shield-halved" style="color:#d97706;"></i>
          <span style="font-weight:700; color:#92400e;">📸 ${p.label}</span>
          <span style="margin-right:auto; font-size:0.7rem; color:#a16207; background:#fef9c3; padding:2px 8px; border-radius:6px;">محمي — لا يمكن التعديل</span>
        </div>
      `).join('');

      return `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04); border-top:4px solid ${st.color};">
          <!-- Station Header -->
          <div style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:42px; height:42px; border-radius:12px; background:${st.color}15; color:${st.color}; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                <i class="fa-solid ${st.icon}"></i>
              </div>
              <div>
                <h3 style="font-size:1rem; font-weight:800; color:#1e293b; margin:0;">المحطة ${st.station_number}: ${st.name}</h3>
                <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                  <span style="background:${st.color}15; color:${st.color}; padding:2px 8px; border-radius:6px; font-weight:700;">${qCount} أسئلة</span>
                  ${proofSlots.length ? `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:6px; font-weight:700; margin-right:4px;">${proofSlots.length} إثبات</span>` : ''}
                  <span style="color:#059669; font-weight:700; margin-right:4px;">4 نقاط</span>
                  ${qCount > 0 ? `<span style="color:#64748b;">(${ppq} نقطة/سؤال)</span>` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Questions List -->
          <div style="padding:0 16px 12px; max-height:300px; overflow-y:auto;">
            ${proofsHtml}
            ${qCount > 0 ? questionsHtml : '<div style="text-align:center; padding:16px; color:#94a3b8; font-size:0.85rem;"><i class="fa-solid fa-inbox" style="font-size:1.2rem; display:block; margin-bottom:6px;"></i>لا توجد أسئلة في هذه المحطة بعد</div>'}
          </div>

          <!-- Add Question Button -->
          <div style="padding:8px 16px 14px; border-top:1px solid #f1f5f9;">
            <button onclick="openAddQuestionForStation(${st.station_number})" class="btn-primary" style="width:100%; justify-content:center; font-size:0.82rem; padding:8px; background:${st.color}; border-radius:10px;">
              <i class="fa-solid fa-circle-plus"></i> إضافة سؤال للمحطة ${st.station_number} ➕
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function openAddQuestionForStation(stationNum) {
    openAddQuestionModal();
    // Set station in the modal
    const stationSelect = document.getElementById('qStationSelect');
    if (stationSelect) stationSelect.value = stationNum;
    const title = document.getElementById('modalTitle');
    const stNames = {1:'عن الجامعة', 2:'الأنظمة التقنية', 3:'حقوقك وواجباتك', 4:'القبول والتسجيل', 5:'شؤون الطلاب'};
    if (title) title.innerHTML = `<i class="fa-solid fa-plus-circle" style="color:var(--c3);"></i> إضافة سؤال للمحطة ${stationNum}: <span style="color:var(--c1); font-weight:800;">${stNames[stationNum] || ''}</span>`;
  }
  window.openAddQuestionForStation = openAddQuestionForStation;

  async function moveQuestionToStation(qid, newStation) {
    if (!newStation) return;
    const sn = parseInt(newStation);
    const stNames = {1:'عن الجامعة', 2:'الأنظمة التقنية', 3:'حقوقك وواجباتك', 4:'القبول والتسجيل', 5:'شؤون الطلاب'};
    if (!confirm(`هل تريد نقل السؤال #${qid} إلى المحطة ${sn}: ${stNames[sn]}؟`)) {
      fetchJourneyStations();
      return;
    }
    try {
      const res = await fetch(`/api/admin/quiz-questions/edit/${qid}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({station_number: sn})
      });
      const data = await res.json();
      if (data.success) {
        alert(`تم نقل السؤال إلى المحطة ${sn} بنجاح!`);
        fetchJourneyStations();
      }
    } catch(e) {
      console.error('Move question error:', e);
    }
  }
  window.moveQuestionToStation = moveQuestionToStation;

  function renderAdminCategoriesGrid() {
    const container = document.getElementById('admin-categories-grid');
    if (!container) return;

    if (allAdminCategories.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--ink-400);">لا توجد أقسام مضافة بعد. اضغط "إضافة قسم جديد" لبدء الإضافة.</div>`;
      return;
    }

    container.innerHTML = allAdminCategories.map(c => {
      const cardCount = Array.isArray(c.browse_cards) ? c.browse_cards.length : 0;
      const catQuestions = allAdminQuestions.filter(q => String(q.category_id) === String(c.id));

      return `
        <div style="background:#fff; border:1px solid var(--ink-200); border-radius:16px; padding:20px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--sh-xs); position:relative; border-top:4px solid ${c.color || 'var(--c1)'};">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="width:38px; height:38px; border-radius:10px; background:${c.color}15; color:${c.color}; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                <i class="fa-solid ${c.icon || 'fa-folder'}"></i>
              </div>
              <div style="display:flex; gap:6px;">
                <span class="pill pill-success" style="font-size:0.72rem;"><i class="fa-solid fa-layer-group"></i> ${cardCount} بطاقات تصفح</span>
                <span class="pill pill-info" style="font-size:0.72rem;">${catQuestions.length} أسئلة</span>
              </div>
            </div>
            <h3 style="font-size:1rem; font-weight:800; color:var(--ink-800); margin-bottom:6px;">${c.name}</h3>
            <p style="font-size:0.82rem; color:var(--ink-500); line-height:1.5; margin-bottom:10px;">${c.description || 'لا يوجد وصف مضاف.'}</p>
            
            <!-- ─── QUESTIONS ACCORDION INSIDE CATEGORY CARD ─── -->
            <div style="margin-top:10px; border-top:1px dashed var(--ink-200); padding-top:10px;">
              <button type="button" onclick="toggleCategoryQuestionsList(${c.id})" class="btn-outline" style="width:100%; justify-content:space-between; font-size:0.78rem; padding:6px 12px; background:#f8fafc; border-color:var(--ink-300);">
                <span><i class="fa-solid fa-list-check" style="color:var(--c1);"></i> استعراض أسئلة هذا القسم (${catQuestions.length})</span>
                <i class="fa-solid fa-chevron-down" id="cat-q-arrow-${c.id}"></i>
              </button>
              
              <div id="cat-q-wrap-${c.id}" style="display:none; margin-top:8px; max-height:260px; overflow-y:auto; padding:6px; background:#f1f5f9; border-radius:10px; border:1px solid #e2e8f0;">
                ${catQuestions.length === 0 ? `
                  <div style="text-align:center; padding:12px; font-size:0.78rem; color:var(--ink-500);">
                    لا توجد أسئلة مضافة لهذا القسم بعد.
                    <div style="margin-top:6px;">
                      <button onclick="addQuestionToCategory(${c.id})" class="btn-primary" style="font-size:0.75rem; padding:4px 10px; background:var(--c1);">
                        <i class="fa-solid fa-plus"></i> إضافة أول سؤال
                      </button>
                    </div>
                  </div>
                ` : catQuestions.map(q => `
                  <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:6px; font-size:0.8rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                      <div style="font-weight:700; color:var(--ink-800); flex:1;">
                        <strong style="color:var(--c1);">#${q.id}</strong> ${q.question}
                      </div>
                      <div style="display:flex; gap:4px; flex-shrink:0; align-items:center;">
                        <select onchange="reassignQuestionCategory(${q.id}, this.value)" style="font-size:0.7rem; padding:2px 4px; border-radius:4px; border:1px solid var(--ink-300); background:#fff; cursor:pointer;" title="نقل السؤال لقسم آخر">
                          <option value="">🔄 نقل لقسم آخر...</option>
                          ${allAdminCategories.filter(cat => String(cat.id) !== String(c.id)).map(cat => `<option value="${cat.id}">نقل إلى: ${cat.name}</option>`).join('')}
                        </select>
                        <button onclick='editAdminQuestion(${JSON.stringify(q).replace(/'/g, "&#39;")})' style="background:none; border:none; color:var(--c1); cursor:pointer; font-size:0.85rem;" title="تعديل السؤال">
                          <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="deleteAdminQuestion(${q.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.85rem;" title="حذف السؤال">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                    <div style="font-size:0.73rem; color:var(--ink-500); margin-top:4px;">
                      الإجابة الصحيحة: <strong style="color:#059669;">[${(q.correct_option || 'a').toUpperCase()}]</strong> | أ: ${q.option_a || '—'} | ب: ${q.option_b || '—'} ${q.option_c ? ' | ج: ' + q.option_c : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--ink-100); padding-top:12px; margin-top:10px;">
            <button onclick="addQuestionToCategory(${c.id})" class="btn-primary" style="font-size:0.8rem; padding:6px 12px; width:100%; justify-content:center; background:var(--c1);">
              <i class="fa-solid fa-circle-plus"></i> إضافة سؤال لهذا القسم ➕
            </button>
            <div style="display:flex; justify-content:space-between; gap:8px;">
              ${isProtectedCoreCategory(c.name) ? `
                <button disabled class="btn-outline" style="font-size:0.76rem; padding:4px 8px; flex:1; opacity:0.8; cursor:not-allowed; background:#fff8f6; color:#882D1B; border-color:#fecdd3;" title="بطاقات هذا القسم محمية ومدرجة تلقائياً من اللوائح الرسمية">
                  <i class="fa-solid fa-shield-halved"></i> قسم محمي تلقائياً
                </button>
              ` : `
                <button onclick='editAdminCategory(${JSON.stringify(c).replace(/'/g, "&#39;")})' class="btn-outline" style="font-size:0.78rem; padding:4px 10px; flex:1;">
                  <i class="fa-solid fa-pen-to-square"></i> تعديل البطاقات
                </button>
              `}
              <button onclick="deleteAdminCategory(${c.id})" class="btn-outline" style="font-size:0.78rem; padding:4px 10px; color:var(--danger); border-color:var(--danger);">
                <i class="fa-solid fa-trash"></i> حذف القسم
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function addQuestionToCategory(categoryId) {
    openAddQuestionModal();
    const catSelect = document.getElementById('qCategorySelect');
    if (catSelect) catSelect.value = categoryId;
    
    const cat = allAdminCategories.find(c => String(c.id) === String(categoryId));
    const categoryName = cat ? cat.name : '';
    const title = document.getElementById('modalTitle');
    if (title) title.innerHTML = `<i class="fa-solid fa-plus-circle" style="color:var(--c3);"></i> إضافة سؤال لقسم: <span style="color:var(--c1); font-weight:800;">${categoryName}</span>`;
  }

  function toggleCategoryQuestionsList(cid) {
    const wrap = document.getElementById(`cat-q-wrap-${cid}`);
    const arrow = document.getElementById(`cat-q-arrow-${cid}`);
    if (!wrap) return;
    const isHidden = wrap.style.display === 'none';
    wrap.style.display = isHidden ? 'block' : 'none';
    if (arrow) arrow.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
  }

  async function deleteAdminCategory(cid) {
    const catQuestions = allAdminQuestions.filter(q => String(q.category_id) === String(cid));
    
    // Strict Prevention Rule: BLOCK deletion if questions exist!
    if (catQuestions.length > 0) {
      alert(`🚫 حظر حذف القسم:\n\nلا يمكن حذف هذا القسم لأنه يحتوي على (${catQuestions.length}) أسئلة مضافة!\n\nيرجى الضغط على "استعراض أسئلة هذا القسم" داخل كارد القسم وحذف جميع الأسئلة التابعة له أولاً حتى تتمكن من حذف القسم نهائياً.`);
      return;
    }
    
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا القسم الخالي من الأسئلة نهائياً؟')) return;
    try {
      const res = await fetch(`/api/admin/quiz-categories/delete/${cid}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'تم حذف القسم بنجاح!');
        await fetchAdminCategories();
        await fetchAdminQuestions();
      } else {
        alert(data.error || 'حدث خطأ في الحذف.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالسيرفر.');
    }
  }

  function isProtectedCoreCategory(catName) {
    if (!catName) return false;
    const name = catName.trim();
    return name.includes('اللوائح والأنظمة') || 
           name.includes('الانضباط الطلابي') || 
           name.includes('التقويم الأكاديمي');
  }

  // ─── BROWSE CARDS BUILDER LOGIC ───
  let adminBrowseCards = [];

  function renderBrowseCardsBuilder() {
    const container = document.getElementById('browse-cards-builder');
    const counter = document.getElementById('browse-cards-counter');
    const addBtn = document.getElementById('btn-add-browse-card');

    if (!container) return;

    const currentCatName = document.getElementById('catName') ? document.getElementById('catName').value.trim() : '';

    if (isProtectedCoreCategory(currentCatName)) {
      if (addBtn) addBtn.style.display = 'none';
      if (counter) counter.textContent = '🔒 بطاقات هذا القسم محمية ومدرجة تلقائياً';
      container.innerHTML = `
        <div style="padding:18px; background:#fff8f6; border:1px solid #fecdd3; border-radius:14px; text-align:center; color:#882D1B;">
          <i class="fa-solid fa-shield-halved" style="font-size:1.6rem; color:#882D1B; margin-bottom:8px; display:block;"></i>
          <div style="font-weight:800; font-size:0.92rem; margin-bottom:4px;">🔒 بطاقات تصفح هذا القسم محمية ومدرجة تلقائياً بالنظام</div>
          <div style="font-size:0.82rem; color:#7D321D; line-height:1.5;">
            هذا القسم (<strong>${currentCatName}</strong>) يعتمد بالكامل على نصوص ومواد اللوائح الرسمية المعالجة تلقائياً بالملفات المعتمدة بالنظام (regulations.json). تم قفل إضافة وتعديل بطاقات تصفح له لضمان دقة وسلامة البيانات.
          </div>
        </div>
      `;
      return;
    }

    if (adminBrowseCards.length >= 6) {
      if (addBtn) addBtn.style.display = 'none';
    } else {
      if (addBtn) addBtn.style.display = 'inline-flex';
    }

    if (counter) counter.textContent = `${adminBrowseCards.length} من 6 بطاقات مضافة`;

    if (adminBrowseCards.length === 0) {
      container.innerHTML = `
        <div style="padding:16px; background:#f8fafc; border:1px dashed var(--ink-200); border-radius:12px; text-align:center; color:var(--ink-500); font-size:0.82rem;">
          <i class="fa-solid fa-folder-open" style="font-size:1.2rem; margin-bottom:6px; display:block; color:var(--c2);"></i>
          لا توجد بطاقات تصفح مضافة حتى الآن. اضغط <strong>"+ إضافة بطاقة تصفح"</strong> لبناء المعلومات قبل أسئلة القسم (حتى 6 بطاقات).
        </div>
      `;
      return;
    }

    container.innerHTML = adminBrowseCards.map((card, idx) => {
      const charLen = (card.desc || '').length;
      const wordCount = (card.desc || '').trim() ? (card.desc || '').trim().split(/\s+/).length : 0;
      const isOverLimit = charLen > 140;

      return `
        <div style="background:#f8fafc; border:1px solid ${isOverLimit ? '#ef4444' : '#e2e8f0'}; border-radius:12px; padding:14px; position:relative; transition:all 0.2s ease;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:0.82rem; font-weight:800; color:var(--c1);">
              <i class="fa-solid fa-square-pen"></i> بطاقة تصفح #${idx + 1}
            </div>
            <button type="button" onclick="removeBrowseCardField(${idx})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.82rem;" title="حذف البطاقة">
              <i class="fa-solid fa-trash"></i> حذف البطاقة
            </button>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:var(--ink-700); display:block; margin-bottom:4px;">عنوان البطاقة المعرف *</label>
              <input type="text" value="${card.title || ''}" 
                     oninput="updateBrowseCardData(${idx}, 'title', this.value)"
                     onkeydown="if(event.key==='Enter'){ event.preventDefault(); addBrowseCardField(); }"
                     placeholder="مثال: ${idx + 1}. تسجيل الدخول وإثبات الحساب"
                     style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--ink-300); font-size:0.83rem; font-family:inherit;">
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:var(--ink-700); display:block; margin-bottom:4px;">أيقونة البطاقة</label>
              <select onchange="updateBrowseCardData(${idx}, 'icon', this.value)" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--ink-300); font-size:0.8rem; font-family:inherit;">
                <option value="fa-key" ${card.icon === 'fa-key' ? 'selected' : ''}>🔑 مفتاح / دخول (fa-key)</option>
                <option value="fa-display" ${card.icon === 'fa-display' ? 'selected' : ''}>🖥️ شاشة / بث (fa-display)</option>
                <option value="fa-file-arrow-up" ${card.icon === 'fa-file-arrow-up' ? 'selected' : ''}>📤 رفع واجب (fa-file-arrow-up)</option>
                <option value="fa-spell-check" ${card.icon === 'fa-spell-check' ? 'selected' : ''}>📝 اختبارات (fa-spell-check)</option>
                <option value="fa-square-poll-vertical" ${card.icon === 'fa-square-poll-vertical' ? 'selected' : ''}>📊 درجات ومعدل (fa-square-poll-vertical)</option>
                <option value="fa-comments" ${card.icon === 'fa-comments' ? 'selected' : ''}>💬 نقاش وتواصل (fa-comments)</option>
                <option value="fa-id-card-clip" ${card.icon === 'fa-id-card-clip' ? 'selected' : ''}>🪪 هوية وبوابة (fa-id-card-clip)</option>
                <option value="fa-file-invoice-dollar" ${card.icon === 'fa-file-invoice-dollar' ? 'selected' : ''}>📜 كشف درجات (fa-file-invoice-dollar)</option>
                <option value="fa-calendar-week" ${card.icon === 'fa-calendar-week' ? 'selected' : ''}>📅 جدول دراسي (fa-calendar-week)</option>
                <option value="fa-arrows-split-up-and-left" ${card.icon === 'fa-arrows-split-up-and-left' ? 'selected' : ''}>🔀 طلبات واعتذارات (fa-arrows-split-up-and-left)</option>
                <option value="fa-repeat" ${card.icon === 'fa-repeat' ? 'selected' : ''}>🔄 تحويل تخصص (fa-repeat)</option>
                <option value="fa-certificate" ${card.icon === 'fa-certificate' ? 'selected' : ''}>🎓 وثيقة تخرج (fa-certificate)</option>
                <option value="fa-circle-info" ${card.icon === 'fa-circle-info' || !card.icon ? 'selected' : ''}>ℹ️ معلومات عامة (fa-circle-info)</option>
              </select>
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label style="font-size:0.75rem; font-weight:700; color:var(--ink-700);">شرح وتفاصيل البطاقة (موجز ومؤسسي) *</label>
              <span style="font-size:0.72rem; font-weight:700; color:${isOverLimit ? '#ef4444' : '#059669'};">
                [${charLen} / 140 حرف - ${wordCount} كلمة] ${isOverLimit ? '⚠️ تجاوزت الحد الموصى به' : ''}
              </span>
            </div>
            <textarea rows="2" 
                      oninput="updateBrowseCardData(${idx}, 'desc', this.value)"
                      placeholder="اكتب شرحاً موجزاً ومؤسسياً بحدود 25-30 كلمة..."
                      style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid ${isOverLimit ? '#ef4444' : 'var(--ink-300)'}; font-size:0.82rem; font-family:inherit; resize:vertical;">${card.desc || ''}</textarea>
          </div>
        </div>
      `;
    }).join('');
  }

