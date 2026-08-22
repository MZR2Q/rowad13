  function printReportDashboard() {
    window.print();
  }

  // ─── Comprehensive Student Directory, Smart Ranking & Full Dossier Management ───
  let allStudentsDirectory = [];
  let currentActiveStudentDossier = null;

  async function fetchAdminStudentsDirectory(sortBy = 'smart') {
    const tbodyMale = document.getElementById('student-attempts-tbody-male');
    const tbodyFemale = document.getElementById('student-attempts-tbody-female');
    const tbodyLegacy = document.getElementById('student-attempts-tbody');
    const loadingRow = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--ink-500);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:8px; display:block; color:#059669;"></i> جاري جلب وتحليل بيانات الطلاب وترتيبهم...</td></tr>`;
    if (tbodyMale) tbodyMale.innerHTML = loadingRow;
    if (tbodyFemale) tbodyFemale.innerHTML = loadingRow;
    if (tbodyLegacy) tbodyLegacy.innerHTML = loadingRow;
    try {
      const selectedSort = sortBy || (document.getElementById('filter-dir-sort')?.value || 'smart');
      const res = await fetch(`/api/admin/students/directory?sort_by=${encodeURIComponent(selectedSort)}`);
      const data = await res.json();
      if (data.success) {
        allStudentsDirectory = data.students || [];
        updateStudentsDirectoryStats(allStudentsDirectory);
        populateCollegeFilterOptions(allStudentsDirectory);
        renderStudentsDirectoryTable(allStudentsDirectory);
        
        const badge = document.getElementById('sb-attempts-badge');
        if (badge) badge.textContent = allStudentsDirectory.length;
      } else {
        const errRow = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--danger);">${data.error || 'تعذر تحميل قائمة الطلاب'}</td></tr>`;
        if (tbodyMale) tbodyMale.innerHTML = errRow;
        if (tbodyFemale) tbodyFemale.innerHTML = errRow;
        if (tbodyLegacy) tbodyLegacy.innerHTML = errRow;
      }
    } catch(e) {
      console.error('Fetch students directory error:', e);
      const connErrRow = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--danger);">خطأ في الاتصال بالخادم.</td></tr>`;
      if (tbodyMale) tbodyMale.innerHTML = connErrRow;
      if (tbodyFemale) tbodyFemale.innerHTML = connErrRow;
      if (tbodyLegacy) tbodyLegacy.innerHTML = connErrRow;
    }
  }
  window.fetchAdminStudentAttempts = fetchAdminStudentsDirectory; // backward-compat alias

  function updateStudentsDirectoryStats(list) {
    const totalEl = document.getElementById('stat-dir-total-students');
    const testedEl = document.getElementById('stat-dir-tested-students');
    const timeEl = document.getElementById('stat-dir-avg-time');
    const docsEl = document.getElementById('stat-dir-total-docs');
    const scansEl = document.getElementById('stat-dir-total-scans');

    if (totalEl) totalEl.textContent = `${list.length} طالب وطالبة`;

    const testedStudents = list.filter(s => s.has_attempted_quiz);
    const testedCount = testedStudents.length;
    const testRate = list.length > 0 ? Math.round((testedCount / list.length) * 100) : 0;
    if (testedEl) testedEl.textContent = `${testedCount} (${testRate}%)`;

    if (testedStudents.length > 0) {
      const validTimes = testedStudents.map(s => s.quiz_time_seconds).filter(t => t > 0 && t < 999999);
      if (validTimes.length > 0) {
        const minSec = Math.min(...validTimes);
        const avgSec = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
        const minFmt = `${Math.floor(minSec / 60)}:${String(minSec % 60).padStart(2, '0')}`;
        const avgFmt = `${Math.floor(avgSec / 60)}:${String(avgSec % 60).padStart(2, '0')}`;
        if (timeEl) timeEl.innerHTML = `<span style="font-size:0.95rem;">⚡ أسرع: <strong>${minFmt}د</strong></span> • <span style="font-size:0.85rem; color:var(--ink-600);">متوسط: ${avgFmt}د</span>`;
      } else {
        if (timeEl) timeEl.textContent = '--';
      }
    } else {
      if (timeEl) timeEl.textContent = 'لا توجد محاولات';
    }

    const totalDocs = list.reduce((acc, s) => acc + (s.docs_count || 0), 0);
    if (docsEl) docsEl.textContent = `${totalDocs} ملف`;

    const totalScans = list.reduce((acc, s) => acc + (s.stations_count || 0) + (s.workshops_count || 0), 0);
    if (scansEl) scansEl.textContent = `${totalScans} مسح`;
  }

  function populateCollegeFilterOptions(list) {
    const select = document.getElementById('filter-dir-college');
    if (!select) return;
    const colleges = Array.from(new Set(list.map(s => s.college).filter(c => c && c !== 'غير محدد'))).sort();
    const currentVal = select.value || 'all';
    
    select.innerHTML = '<option value="all">جميع الكليات</option>' +
      colleges.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    select.value = currentVal;
  }

  function applyStudentsDirectorySort() {
    const sortBy = document.getElementById('filter-dir-sort')?.value || 'smart';
    fetchAdminStudentsDirectory(sortBy);
  }

  function filterStudentsDirectoryTable() {
    const q = (document.getElementById('filter-dir-search')?.value || '').trim().toLowerCase();
    const quizFilter = document.getElementById('filter-dir-quiz-status')?.value || 'all';
    const collegeFilter = document.getElementById('filter-dir-college')?.value || 'all';

    const filtered = allStudentsDirectory.filter(s => {
      const name = (s.student_name || '').toLowerCase();
      const sid = (s.student_id || '').toLowerCase();
      const col = (s.college || '').toLowerCase();
      const matchQuery = !q || name.includes(q) || sid.includes(q) || col.includes(q);

      let matchCollege = (collegeFilter === 'all' || (s.college || '') === collegeFilter);

      let matchQuiz = true;
      if (quizFilter === 'tested') matchQuiz = s.has_attempted_quiz;
      else if (quizFilter === 'untested') matchQuiz = !s.has_attempted_quiz;
      else if (quizFilter === 'high') matchQuiz = (s.has_attempted_quiz && s.quiz_score >= 80);
      else if (quizFilter === 'pass') matchQuiz = (s.has_attempted_quiz && s.quiz_score >= 60 && s.quiz_score < 80);
      else if (quizFilter === 'low') matchQuiz = (s.has_attempted_quiz && s.quiz_score < 60);

      return matchQuery && matchCollege && matchQuiz;
    });

    renderStudentsDirectoryTable(filtered);
  }

  function renderStudentsDirectoryTable(list) {
    const tbodyMale = document.getElementById('student-attempts-tbody-male');
    const tbodyFemale = document.getElementById('student-attempts-tbody-female');
    // Backward compat: if old single tbody exists, use it
    const tbodyLegacy = document.getElementById('student-attempts-tbody');

    if (!tbodyMale && !tbodyFemale && !tbodyLegacy) return;

    if (!list || list.length === 0) {
      const emptyRow = `
        <tr>
          <td colspan="9" style="text-align:center; padding:40px; color:var(--ink-400);">
            <i class="fa-solid fa-users-slash" style="font-size:2rem; margin-bottom:8px; display:block; color:var(--ink-300);"></i>
            لا يوجد طلاب مطابقين لمعايير البحث والفرز المحددة.
          </td>
        </tr>
      `;
      if (tbodyMale) tbodyMale.innerHTML = emptyRow;
      if (tbodyFemale) tbodyFemale.innerHTML = emptyRow;
      if (tbodyLegacy) tbodyLegacy.innerHTML = emptyRow;
      // Update tab counts
      const maleCountEl = document.getElementById('tab-male-count');
      const femaleCountEl = document.getElementById('tab-female-count');
      if (maleCountEl) maleCountEl.textContent = '0';
      if (femaleCountEl) femaleCountEl.textContent = '0';
      return;
    }

    // Classify gender: "ذكر" or contains "male" = male, "أنثى" or "female" = female, else = male (default)
    function isFemale(g) {
      if (!g || g === '—') return false;
      const gl = g.toLowerCase().trim();
      return gl === 'أنثى' || gl === 'انثى' || gl === 'female' || gl === 'f' || gl === 'طالبة';
    }

    const males = list.filter(s => !isFemale(s.gender));
    const females = list.filter(s => isFemale(s.gender));

    // Update tab counts
    const maleCountEl = document.getElementById('tab-male-count');
    const femaleCountEl = document.getElementById('tab-female-count');
    if (maleCountEl) maleCountEl.textContent = males.length;
    if (femaleCountEl) femaleCountEl.textContent = females.length;

    function buildRowsHtml(genderList) {
      return genderList.map((stu, idx) => {
        const rank = idx + 1;
        let rankBadge = `<span style="font-weight:800; color:var(--ink-600);">${rank}</span>`;
        if (rank === 1) rankBadge = `<span style="font-size:1.1rem;" title="المركز الأول 🥇">🥇</span>`;
        else if (rank === 2) rankBadge = `<span style="font-size:1.1rem;" title="المركز الثاني 🥈">🥈</span>`;
        else if (rank === 3) rankBadge = `<span style="font-size:1.1rem;" title="المركز الثالث 🥉">🥉</span>`;

        // Quiz cell
        let quizCell = '';
        if (stu.has_attempted_quiz) {
          const score = Math.round(stu.quiz_score || 0);
          let badgeColor = 'background:rgba(192,57,43,0.1); color:#c0392b; border:1px solid rgba(192,57,43,0.3);';
          let label = '⚠️ يحتاج مراجعة';
          if (score >= 80) {
            badgeColor = 'background:rgba(5,150,105,0.1); color:#059669; border:1px solid rgba(5,150,105,0.3);';
            label = '👑 ممتاز';
          } else if (score >= 60) {
            badgeColor = 'background:rgba(37,99,235,0.1); color:#2563eb; border:1px solid rgba(37,99,235,0.3);';
            label = '👍 ناجح';
          }

          quizCell = `
            <div style="display:inline-flex; flex-direction:column; align-items:center; gap:3px;">
              <span style="display:inline-block; padding:3px 10px; border-radius:14px; font-weight:800; font-size:0.8rem; ${badgeColor}">
                ${score}% • ${label}
              </span>
              <span style="font-size:0.75rem; color:var(--ink-500);">
                <span style="color:#059669; font-weight:700;">✅ ${stu.quiz_correct}</span> / <span style="color:#c0392b; font-weight:700;">❌ ${stu.quiz_wrong}</span>
              </span>
            </div>
          `;
        } else {
          quizCell = `<span class="pill pill-gray" style="font-size:0.75rem; opacity:0.85;">لم يختبر بعد ⏳</span>`;
        }

        // Time cell
        let timeCell = '—';
        if (stu.has_attempted_quiz && stu.quiz_time_seconds < 999999) {
          const sec = stu.quiz_time_seconds;
          let timeColor = '#059669';
          if (sec > 180) timeColor = '#d97706';
          if (sec > 300) timeColor = '#c0392b';
          timeCell = `<span style="font-weight:800; color:${timeColor}; font-size:0.85rem;"><i class="fa-solid fa-stopwatch"></i> ${stu.quiz_time_formatted}</span>`;
        }

        return `
          <tr style="border-bottom:1px solid var(--ink-200); transition:background 0.18s;" onmouseover="this.style.background='rgba(5,150,105,0.03)'" onmouseout="this.style.background='transparent'">
            <td style="padding:14px 12px; text-align:center; font-weight:800;">
              ${rankBadge}
            </td>
            <td style="padding:14px;">
              <div style="font-weight:800; color:var(--ink-800); font-size:0.92rem;">${escapeHtml(stu.student_name)}</div>
              <div style="font-size:0.75rem; color:var(--ink-500); margin-top:2px; display:flex; gap:6px; align-items:center;">
                <span style="background:var(--ink-100); padding:2px 6px; border-radius:4px; font-weight:700;">${escapeHtml(stu.college || 'كلية عامة')}</span>
              </div>
            </td>
            <td style="padding:14px; font-family:monospace; font-weight:700; color:var(--ink-700);">
              <code>${escapeHtml(stu.student_id)}</code>
            </td>
            <td style="padding:14px; text-align:center;">
              ${quizCell}
            </td>
            <td style="padding:14px; text-align:center;">
              ${timeCell}
            </td>
            <td style="padding:14px; text-align:center;">
              <span style="background:rgba(136,45,27,0.08); color:var(--c1); padding:3px 8px; border-radius:6px; font-size:0.78rem; font-weight:800;">
                📖 ${stu.docs_count || 0} ملف
              </span>
            </td>
            <td style="padding:14px; text-align:center;">
              <span style="background:rgba(96,121,118,0.1); color:#3b514e; padding:3px 8px; border-radius:6px; font-size:0.78rem; font-weight:800;">
                🏫 ${stu.stations_count || 0} أركان • 🎯 ${stu.workshops_count || 0} ورش
              </span>
            </td>
            <td style="padding:14px; text-align:center;">
              <span style="display:inline-block; background:linear-gradient(135deg, rgba(5,150,105,0.12), rgba(16,185,129,0.06)); border:1px solid rgba(5,150,105,0.25); color:#059669; font-weight:900; font-size:0.88rem; padding:4px 10px; border-radius:12px;">
                ⭐ ${Math.round(stu.total_points || 0)} نقطة
              </span>
            </td>
            <td style="padding:14px; text-align:center;">
              <button class="btn-outline" onclick="openStudentFullDossierModal('${escapeHtml(stu.student_id)}')" style="padding:6px 12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; border-color:#059669; color:#059669; font-weight:800; border-radius:8px;">
                <i class="fa-solid fa-id-badge"></i> عرض الملف الشامل 👁️
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const maleHtml = males.length > 0 ? buildRowsHtml(males) : `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--ink-400);">لا يوجد طلاب مطابقين</td></tr>`;
    const femaleHtml = females.length > 0 ? buildRowsHtml(females) : `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--ink-400);">لا توجد طالبات مطابقات</td></tr>`;

    if (tbodyMale) tbodyMale.innerHTML = maleHtml;
    if (tbodyFemale) tbodyFemale.innerHTML = femaleHtml;
    // Backward compat
    if (tbodyLegacy && !tbodyMale) tbodyLegacy.innerHTML = buildRowsHtml(list);
  }

  // ─── Gender Tab Switch ─────────────────────────────────
  let currentGenderTab = 'male';
  function switchGenderTab(gender) {
    currentGenderTab = gender;
    const maleSection = document.getElementById('gender-section-male');
    const femaleSection = document.getElementById('gender-section-female');
    const maleTab = document.getElementById('tab-gender-male');
    const femaleTab = document.getElementById('tab-gender-female');

    if (gender === 'male') {
      if (maleSection) maleSection.style.display = '';
      if (femaleSection) femaleSection.style.display = 'none';
      if (maleTab) { maleTab.style.background = 'linear-gradient(135deg, #2563eb, #3b82f6)'; maleTab.style.color = '#fff'; }
      if (femaleTab) { femaleTab.style.background = 'transparent'; femaleTab.style.color = 'var(--ink-600)'; }
    } else {
      if (maleSection) maleSection.style.display = 'none';
      if (femaleSection) femaleSection.style.display = '';
      if (femaleTab) { femaleTab.style.background = 'linear-gradient(135deg, #a855f7, #8b5cf6)'; femaleTab.style.color = '#fff'; }
      if (maleTab) { maleTab.style.background = 'transparent'; maleTab.style.color = 'var(--ink-600)'; }
    }
  }

  // ─── Full Student Profile & Dossier Modal Engine ───
  async function openStudentFullDossierModal(studentId) {
    const modal = document.getElementById('studentFullProfileModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Show Loading in header
    document.getElementById('sdm-student-name').textContent = 'جاري تحميل الملف الشامل...';
    document.getElementById('sdm-student-id').textContent = studentId;
    document.getElementById('sdm-quiz-questions-list').innerHTML = '<div style="text-align:center; padding:40px; color:var(--ink-500);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; color:#059669; margin-bottom:8px; display:block;"></i> جاري تجميع كافة سجلات وإجابات الطالب...</div>';

    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/full-profile`);
      const data = await res.json();

      if (!data.success || !data.student) {
        alert('تعذر جلب ملف الطالب الشامل');
        closeStudentFullDossierModal();
        return;
      }

      currentActiveStudentDossier = data.student;
      const s = data.student;

      // Populate Header & Quick Bar
      document.getElementById('sdm-student-name').textContent = s.student_name || `طالب ${s.student_id}`;
      document.getElementById('sdm-student-id').textContent = s.student_id;
      document.getElementById('sdm-student-college').textContent = s.college || 'غير محدد';
      document.getElementById('sdm-student-gender').textContent = s.gender || '—';
      document.getElementById('sdm-rank-badge').textContent = `🏆 الترتيب: #${s.rank || '--'} على مستوى الجامعة`;

      // ═══ Progress Ring: Points out of 200 ═══
      const MAX_PTS = 200;
      const totalPts = Math.min(Math.round(s.total_points || 0), MAX_PTS);
      const pctOf200 = Math.round((totalPts / MAX_PTS) * 100);
      const remaining = MAX_PTS - totalPts;

      // Ring color based on progress
      let ringColor = '#e11d48'; // red < 25%
      let levelLabel = 'مبتدئ';
      if (pctOf200 >= 100) { ringColor = '#059669'; levelLabel = '🏆 خبير'; }
      else if (pctOf200 >= 75) { ringColor = '#059669'; levelLabel = 'متقدم 🌟'; }
      else if (pctOf200 >= 40) { ringColor = '#d97706'; levelLabel = 'متوسط ⚡'; }
      else if (pctOf200 >= 15) { ringColor = '#f59e0b'; levelLabel = 'نشط 📈'; }

      // Update ring SVG
      const ringCircle = document.getElementById('sdm-ring-circle');
      if (ringCircle) {
        ringCircle.setAttribute('stroke-dasharray', `${pctOf200} ${100 - pctOf200}`);
        ringCircle.setAttribute('stroke', ringColor);
      }
      document.getElementById('sdm-total-pts').textContent = totalPts;
      document.getElementById('sdm-total-pts').style.color = ringColor;
      const levelEl = document.getElementById('sdm-pts-level');
      if (levelEl) { levelEl.textContent = levelLabel; levelEl.style.color = ringColor; }

      // Remaining bar
      const fillEl = document.getElementById('sdm-remaining-fill');
      const remLabel = document.getElementById('sdm-remaining-label');
      const pctLabel = document.getElementById('sdm-pct-label');
      if (fillEl) {
        fillEl.style.width = `${pctOf200}%`;
        fillEl.style.background = `linear-gradient(90deg, ${ringColor}, ${ringColor}cc)`;
      }
      if (remLabel) remLabel.textContent = remaining > 0 ? `⭐ باقي ${remaining} نقطة` : '🎉 مكتمل!';
      if (pctLabel) { pctLabel.textContent = `${pctOf200}%`; pctLabel.style.color = ringColor; }

      // Other stats
      document.getElementById('sdm-quiz-score-pill').textContent = s.has_attempted_quiz ? `${Math.round(s.quiz_score)}%` : 'لم يختبر ⏳';
      document.getElementById('sdm-quiz-time').textContent = s.has_attempted_quiz ? s.quiz_time_formatted : '—';
      document.getElementById('sdm-docs-count').textContent = `${s.docs_count || 0} لائحة/ملف`;
      document.getElementById('sdm-stations-count').textContent = `${s.stations_count || 0} أركان`;
      document.getElementById('sdm-workshops-count').textContent = `${s.workshops_count || 0} ورش`;

      // Points breakdown by category
      const elExPts = document.getElementById('sdm-explore-pts');
      const elQzPts = document.getElementById('sdm-quiz-pts');
      const elCmPts = document.getElementById('sdm-campus-pts');
      const elWsPts = document.getElementById('sdm-workshop-pts');
      if (elExPts) elExPts.textContent = Math.round(s.explore_points || 0);
      if (elQzPts) elQzPts.textContent = Math.round(s.quiz_points || 0);
      if (elCmPts) elCmPts.textContent = Math.round(s.campus_points || 0);
      if (elWsPts) elWsPts.textContent = Math.round(s.workshop_points || 0);

      // Render Tab 1: Quiz Details
      renderDossierQuizPane(s);

      // Render Tab 2: Proofs (Blackboard & Email Uploads)
      renderDossierProofsPane(s);

      // Render Tab: Homepage Videos Detailed Tracking
      renderDossierVideosPane(s);

      // Render Tab 3: Docs Explored
      renderDossierDocsPane(s);

      // Render Tab 4: Stations Scanned
      renderDossierStationsPane(s);

      // Render Tab 5: Workshops Attended
      renderDossierWorkshopsPane(s);

      // Render Tab 6: Contact Info
      renderDossierContactPane(s);

      // Default to quiz tab
      switchStudentDossierTab('quiz');

    } catch(e) {
      console.error('Open full dossier error:', e);
      alert('خطأ في جلب ملف الطالب الشامل');
      closeStudentFullDossierModal();
    }
  }

  function closeStudentFullDossierModal() {
    const modal = document.getElementById('studentFullProfileModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function switchStudentDossierTab(tabKey, btn) {
    // Remove active from all tabs (new sdm-tab2 class)
    document.querySelectorAll('.sdm-tab2').forEach(b => b.classList.remove('active'));
    if (btn) {
      btn.classList.add('active');
    } else {
      const activeBtn = document.querySelector(`.sdm-tab2[onclick*="'${tabKey}'"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }
    // Switch panes
    document.querySelectorAll('.sdm-tab-pane').forEach(p => p.style.display = 'none');
    const pane = document.getElementById(`sdm-pane-${tabKey}`);
    if (pane) pane.style.display = 'block';
  }

  function renderDossierProofsPane(s) {
    const emailProof = s.proof_email;
    const bbProof = s.proof_blackboard;
    const latestEmailProof = s.latest_proof_email;
    const latestBbProof = s.latest_proof_blackboard;
    const emailBadge = document.getElementById('sdm-proof-email-badge');
    const emailBody = document.getElementById('sdm-proof-email-body');
    const bbBadge = document.getElementById('sdm-proof-bb-badge');
    const bbBody = document.getElementById('sdm-proof-bb-body');
    const overallStatus = document.getElementById('sdm-proofs-overall-status');
    const checklistGrid = document.getElementById('sdm-proofs-checklist-grid');

    const emailDone = Boolean(emailProof && (emailProof.dataUrl || emailProof.url || emailProof.fileName));
    const bbDone = Boolean(bbProof && (bbProof.dataUrl || bbProof.url || bbProof.fileName));

    // Helper: check if two proofs are different
    function isDifferentProof(p1, p2) {
      if (!p1 || !p2) return false;
      if (typeof p1 !== 'object' || typeof p2 !== 'object') return false;
      const d1 = p1.dataUrl || p1.url || '';
      const d2 = p2.dataUrl || p2.url || '';
      return d1 !== d2 && d2 !== '';
    }

    // Helper: render a proof image card
    function renderProofImage(proof, label, borderColor, isLatest = false) {
      // Smart image source selection:
      // 1. If dataUrl starts with "data:" → use it (embedded base64, always works)
      // 2. If url starts with "/static/" → use it (server file path, may 404)
      // 3. If dataUrl is a URL path → use it
      // 4. If url is anything → use it as last resort
      let imgSrc = '';
      const du = proof.dataUrl || '';
      const u = proof.url || '';
      
      if (du.startsWith('data:')) {
        imgSrc = du;  // Base64 embedded — always reliable
      } else if (u.startsWith('/static/')) {
        imgSrc = u;   // Server-hosted file
      } else if (du.startsWith('/static/') || du.startsWith('http')) {
        imgSrc = du;
      } else if (u) {
        imgSrc = u;
      } else if (du) {
        imgSrc = du;
      }
      
      if (!imgSrc) return '';
      
      // Fallback source for onerror: try the other option
      const fallbackSrc = imgSrc === du ? u : du;
      const onerrorAttr = fallbackSrc ? `onerror="if(this.src!=='${fallbackSrc.replace(/'/g, "\\'")}'){this.src='${fallbackSrc.replace(/'/g, "\\'")}';}"` : '';
      
      return `
        <div style="width:100%; display:flex; flex-direction:column; gap:8px; ${isLatest ? 'margin-top:12px; padding-top:12px; border-top:1px dashed #cbd5e1;' : ''}">
          ${isLatest ? `<div style="font-size:0.75rem; font-weight:800; color:#d97706; display:flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-clock-rotate-left" style="font-size:0.65rem;"></i> صورة المحاولة الأخيرة (للمقارنة)
          </div>` : ''}
          <div style="position:relative; width:100%; max-height:${isLatest ? '180' : '220'}px; border-radius:12px; overflow:hidden; border:2px solid ${borderColor}; box-shadow:0 4px 14px ${borderColor}26; background:#0f172a; text-align:center; ${isLatest ? 'opacity:0.85;' : ''}">
            <img src="${imgSrc}" alt="${label}" ${onerrorAttr} style="max-height:${isLatest ? '180' : '220'}px; width:auto; max-width:100%; object-fit:contain; cursor:pointer;" onclick="window.open(this.src, '_blank')" title="انقر لعرض الصورة بالحجم الكامل 🔍" />
            <a href="${imgSrc}" target="_blank" style="position:absolute; bottom:8px; left:8px; background:rgba(0,0,0,0.75); color:#fff; padding:4px 10px; border-radius:6px; font-size:0.72rem; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-up-right-from-square"></i> عرض بالحجم الكامل
            </a>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; background:${isLatest ? '#fffbeb' : '#f1f5f9'}; padding:6px 10px; border-radius:8px; font-size:0.75rem;">
            <span style="color:#475569; font-weight:700;"><i class="fa-solid fa-file-image" style="margin-left:3px;"></i> ${escapeHtml(proof.fileName || 'proof.png')}</span>
            <span style="font-weight:800; color:${isLatest ? '#d97706' : '#059669'}; font-size:0.72rem;">${isLatest ? '🔄 أحدث رفع' : '👑 المحاولة الأولى (معتمد)'}</span>
          </div>
          ${proof.timestamp ? `<div style="font-size:0.7rem; color:#94a3b8; text-align:left;">تاريخ التوثيق: ${proof.timestamp}</div>` : ''}
        </div>
      `;
    }

    if (overallStatus) {
      if (emailDone && bbDone) {
        overallStatus.innerHTML = '<span style="color:#059669;"><i class="fa-solid fa-circle-check"></i> مكتمل: تم توثيق البريد والبلاك بورد (+10 نقاط) 👑</span>';
      } else if (emailDone || bbDone) {
        overallStatus.innerHTML = '<span style="color:#d97706;"><i class="fa-solid fa-clock"></i> مكتمل جزئياً (1 من 2 إثباتات معتمدة) 👍</span>';
      } else {
        overallStatus.innerHTML = '<span style="color:#64748b;"><i class="fa-solid fa-hourglass-start"></i> لم يرفع إثباتات التفعيل بعد ⏳</span>';
      }
    }

    // Email Proof Card
    if (emailBadge) {
      if (emailDone) {
        emailBadge.className = 'pill pill-success';
        emailBadge.innerHTML = '👑 معتمد: المحاولة الأولى';
      } else {
        emailBadge.className = 'pill pill-gray';
        emailBadge.innerHTML = '⏳ لم يرفع بعد';
      }
    }

    if (emailBody) {
      if (emailDone) {
        let html = renderProofImage(emailProof, 'إثبات تفعيل البريد الجامعي', '#2563eb', false);
        // Show latest if different
        if (isDifferentProof(emailProof, latestEmailProof)) {
          html += renderProofImage(latestEmailProof, 'إثبات البريد (أحدث)', '#d97706', true);
        }
        emailBody.innerHTML = `<div style="width:100%; display:flex; flex-direction:column; align-items:center;">${html}</div>`;
      } else {
        emailBody.innerHTML = `
          <div style="text-align:center; padding:30px 16px; color:#94a3b8;">
            <i class="fa-solid fa-envelope-open-text" style="font-size:2.4rem; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
            <div style="font-weight:700; color:#475569; font-size:0.9rem; margin-bottom:4px;">لم يتم رفع لقطة شاشة لإثبات البريد</div>
            <p style="font-size:0.78rem; margin:0;">سيتم عرض صورة إثبات تفعيل البريد الجامعي هنا فور رفعها.</p>
          </div>
        `;
      }
    }

    // Blackboard Proof Card
    if (bbBadge) {
      if (bbDone) {
        bbBadge.className = 'pill pill-success';
        bbBadge.innerHTML = '👑 معتمد: المحاولة الأولى';
      } else {
        bbBadge.className = 'pill pill-gray';
        bbBadge.innerHTML = '⏳ لم يرفع بعد';
      }
    }

    if (bbBody) {
      if (bbDone) {
        let html = renderProofImage(bbProof, 'إثبات دخول البلاك بورد', '#d97706', false);
        // Show latest if different
        if (isDifferentProof(bbProof, latestBbProof)) {
          html += renderProofImage(latestBbProof, 'إثبات البلاك بورد (أحدث)', '#7c3aed', true);
        }
        bbBody.innerHTML = `<div style="width:100%; display:flex; flex-direction:column; align-items:center;">${html}</div>`;
      } else {
        bbBody.innerHTML = `
          <div style="text-align:center; padding:30px 16px; color:#94a3b8;">
            <i class="fa-solid fa-chalkboard" style="font-size:2.4rem; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
            <div style="font-weight:700; color:#475569; font-size:0.9rem; margin-bottom:4px;">لم يتم رفع لقطة شاشة لإثبات البلاك بورد</div>
            <p style="font-size:0.78rem; margin:0;">سيتم عرض صورة إثبات تسجيل دخول البلاك بورد هنا فور رفعها.</p>
          </div>
        `;
      }
    }

    // Additional Checklist Grid
    if (checklistGrid) {
      const chk = s.checklist_verified || {};
      const videoWatched = s.watched_video || (s.watched_videos_list && Object.keys(s.watched_videos_list).length > 0);
      
      const items = [
        { label: 'مشاهدة الفيديو الترحيبي والتعريفي', done: videoWatched, icon: 'fa-video' },
        { label: 'الاطلاع على الخريطة التفاعلية للأركان', done: s.stations_count > 0, icon: 'fa-map-location-dot' },
        { label: 'تصفح وقراءة الأدلة واللوائح الأكاديمية', done: s.docs_count > 0, icon: 'fa-book-open' },
        { label: 'خوض واجتياز الاختبار المعرفي النهائي', done: s.has_attempted_quiz, icon: 'fa-clipboard-check' },
      ];

      checklistGrid.innerHTML = items.map(item => `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:${item.done ? 'rgba(5,150,105,0.06)' : '#f8fafc'}; border:1px solid ${item.done ? 'rgba(5,150,105,0.2)' : '#e2e8f0'}; border-radius:10px;">
          <i class="fa-solid ${item.icon}" style="color:${item.done ? '#059669' : '#94a3b8'}; font-size:1.1rem;"></i>
          <span style="font-size:0.85rem; font-weight:700; color:${item.done ? '#065f46' : '#475569'}; flex:1;">${item.label}</span>
          <span style="font-size:0.8rem; font-weight:800; color:${item.done ? '#059669' : '#94a3b8'};">${item.done ? '✅ مكتمل' : '⏳ متبقي'}</span>
        </div>
      `).join('');
    }
  }

