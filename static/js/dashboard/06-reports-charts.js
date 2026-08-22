  function renderDossierVideosPane(s) {
    const totalConfigured = s.total_configured_videos || (s.student_videos_detailed ? s.student_videos_detailed.length : 0);
    const completedCount = s.completed_videos_count || 0;

    const tabCount = document.getElementById('sdm-tab-videos-count');
    if (tabCount) tabCount.textContent = `${completedCount}/${totalConfigured}`;

    const pill = document.getElementById('sdm-videos-count-pill');
    if (pill) pill.textContent = `${completedCount} من ${totalConfigured}`;

    const overallBadge = document.getElementById('sdm-videos-overall-status');
    if (overallBadge) {
      if (completedCount === totalConfigured && totalConfigured > 0) {
        overallBadge.style.background = '#ECFDF5';
        overallBadge.style.borderColor = '#10B981';
        overallBadge.style.color = '#065F46';
        overallBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> شاهد جميع المقاطع (${completedCount} من ${totalConfigured}) 100% 👑`;
      } else if (completedCount > 0) {
        overallBadge.style.background = '#FFFBEB';
        overallBadge.style.borderColor = '#F59E0B';
        overallBadge.style.color = '#92400E';
        overallBadge.innerHTML = `<i class="fa-solid fa-clock"></i> شاهد جزئياً (${completedCount} من أصل ${totalConfigured}) ⏳`;
      } else {
        overallBadge.style.background = '#FEF2F2';
        overallBadge.style.borderColor = '#EF4444';
        overallBadge.style.color = '#991B1B';
        overallBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> لم يشاهد أي مقطع بعد (0 من ${totalConfigured}) ❌`;
      }
    }

    const container = document.getElementById('sdm-videos-cards-list');
    if (!container) return;

    const list = s.student_videos_detailed || [];
    if (list.length === 0) {
      container.innerHTML = `<div style="background:#fff; padding:30px; text-align:center; border-radius:12px; color:var(--ink-400); border:1px dashed var(--ink-300);">لا توجد فيديوهات مضافة في الصفحة الرئيسية حالياً.</div>`;
      return;
    }

    container.innerHTML = list.map((v, i) => {
      const isDone = v.is_completed;
      const borderCol = isDone ? '#10B981' : '#CBD5E1';
      
      return `
        <div style="background:#fff; border:1.5px solid ${borderCol}; border-right:6px solid ${isDone ? '#10B981' : '#94A3B8'}; border-radius:14px; padding:16px 20px; box-shadow:0 2px 8px rgba(0,0,0,0.03); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:42px; height:42px; border-radius:10px; background:${isDone ? 'rgba(16,185,129,0.12)' : 'var(--ink-100)'}; color:${isDone ? '#10B981' : 'var(--ink-400)'}; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
              <i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-film'}"></i>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:900; color:var(--c1); font-size:0.95rem;">المقطع ${v.video_number || (i + 1)}:</span>
                <span style="font-weight:800; color:var(--ink-800); font-size:0.95rem;">${escapeHtml(v.video_caption || 'مقطع تعريفي')}</span>
              </div>
              <div style="font-size:0.78rem; color:var(--ink-500); margin-top:3px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                ${isDone ? `<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-calendar-check"></i> تاريخ المشاهدة: ${v.last_watched_at || 'تم التوثيق'}</span>` : '<span style="color:#64748b; font-weight:600;"><i class="fa-regular fa-clock"></i> في انتظار مشاهدة الطالب</span>'}
                ${v.video_url ? `<span>• <a href="${v.video_url}" target="_blank" style="color:#2563eb; text-decoration:none; font-weight:700;"><i class="fa-solid fa-play"></i> فتح المقطع 🔍</a></span>` : ''}
              </div>
            </div>
          </div>
          <div>
            ${isDone ? `
              <span style="background:#ECFDF5; color:#065F46; border:1px solid #10B981; padding:6px 14px; border-radius:20px; font-weight:800; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-check-double"></i> تمت المشاهدة بالكامل ✅
              </span>
            ` : `
              <span style="background:#FEF2F2; color:#991B1B; border:1px solid #FCA5A5; padding:6px 14px; border-radius:20px; font-weight:800; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-xmark"></i> لم يشاهد هذا المقطع ❌
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderDossierQuizPane(s) {
    const headerBanner = document.getElementById('sdm-quiz-header-banner');
    const qList = document.getElementById('sdm-quiz-questions-list');

    if (!s.has_attempted_quiz) {
      if (headerBanner) headerBanner.style.display = 'none';
      if (qList) {
        qList.innerHTML = `
          <div style="background:#fff; border:2px dashed #cbd5e1; border-radius:16px; padding:48px 24px; text-align:center;">
            <div style="width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg, #f1f5f9, #e2e8f0); margin:0 auto 16px; display:flex; align-items:center; justify-content:center;">
              <i class="fa-solid fa-clock-rotate-left" style="font-size:1.8rem; color:#94a3b8;"></i>
            </div>
            <h4 style="font-size:1.05rem; font-weight:800; color:#334155; margin:0 0 8px;">لم يقم الطالب بخوض الاختبار النهائي حتى الآن</h4>
            <p style="font-size:0.84rem; margin:0; color:#64748b; max-width:400px; margin:0 auto; line-height:1.7;">عند إنهاء الطالب للاختبار في محطة "ابدأ رحلتك الجامعية"، ستظهر جميع إجاباته والتفاصيل الدقيقة هنا تلقائياً.</p>
          </div>
        `;
      }
      return;
    }

    if (headerBanner) {
      headerBanner.style.display = 'flex';
      const score = Math.round(s.quiz_score || 0);
      const scoreColor = score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#e11d48';
      const scoreEmoji = score >= 80 ? '🎉' : score >= 50 ? '⚡' : '📋';
      
      headerBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="position:relative; width:56px; height:56px;">
            <svg viewBox="0 0 36 36" style="width:56px; height:56px; transform:rotate(-90deg);">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="3"></circle>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="${scoreColor}" stroke-width="3" stroke-dasharray="${score} ${100 - score}" stroke-linecap="round" style="transition:stroke-dasharray 1s ease;"></circle>
            </svg>
            <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:900; color:${scoreColor};">${score}%</div>
          </div>
          <div>
            <div style="font-size:1rem; font-weight:900; color:#0f172a;">${scoreEmoji} النتيجة النهائية</div>
            <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">تاريخ الاختبار: ${s.quiz_date || '—'} • المستغرق: <strong style="color:#0f172a;">${s.quiz_time_formatted}</strong></div>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <span style="background:rgba(5,150,105,0.08); border:1px solid rgba(5,150,105,0.2); color:#059669; padding:5px 12px; border-radius:20px; font-weight:800; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-check" style="font-size:0.65rem;"></i> ${s.quiz_correct} صحيحة
          </span>
          <span style="background:rgba(225,29,72,0.06); border:1px solid rgba(225,29,72,0.2); color:#e11d48; padding:5px 12px; border-radius:20px; font-weight:800; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-xmark" style="font-size:0.65rem;"></i> ${s.quiz_wrong} خاطئة
          </span>
          <span style="background:#f1f5f9; border:1px solid #e2e8f0; color:#475569; padding:5px 12px; border-radius:20px; font-weight:800; font-size:0.78rem;">
            ${s.quiz_total} سؤال
          </span>
        </div>
      `;
    }

    if (qList) {
      const details = s.quiz_answers_detail || [];
      if (details.length === 0) {
        qList.innerHTML = `<div style="background:#fff; padding:30px; text-align:center; border-radius:14px; color:#64748b; border:1px solid #e2e8f0;">تم رصد الدرجة العامة (${Math.round(s.quiz_score)}%) ولم يتم تسجيل تفاصيل الأسئلة المفردة لهذه المحاولة.</div>`;
      } else {
        let currentStation = '';
        let html = '';
        
        details.forEach((q, idx) => {
          const isCorr = q.is_correct;
          
          // Station group header
          if (q.station && q.station !== currentStation) {
            currentStation = q.station;
            html += `
              <div style="display:flex; align-items:center; gap:10px; margin:${idx > 0 ? '20px' : '4px'} 0 8px; padding:0 4px;">
                <div style="width:8px; height:8px; border-radius:50%; background:linear-gradient(135deg, #059669, #10b981); flex-shrink:0;"></div>
                <span style="font-size:0.82rem; font-weight:800; color:#334155; letter-spacing:-0.01em;">${escapeHtml(q.station)}</span>
                <div style="flex:1; height:1px; background:linear-gradient(to left, transparent, #cbd5e1);"></div>
              </div>
            `;
          }
          
          html += `
            <div style="background:#fff; border:1px solid ${isCorr ? '#d1fae5' : '#fecdd3'}; border-radius:14px; overflow:hidden; box-shadow:0 1px 4px ${isCorr ? 'rgba(5,150,105,0.06)' : 'rgba(225,29,72,0.06)'}; transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 16px ${isCorr ? 'rgba(5,150,105,0.12)' : 'rgba(225,29,72,0.12)'}'" onmouseout="this.style.boxShadow='0 1px 4px ${isCorr ? 'rgba(5,150,105,0.06)' : 'rgba(225,29,72,0.06)'}'"  >
              
              <!-- Question header -->
              <div style="padding:12px 16px; background:${isCorr ? 'rgba(5,150,105,0.04)' : 'rgba(225,29,72,0.03)'}; border-bottom:1px solid ${isCorr ? '#d1fae5' : '#fecdd3'}; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:28px; height:28px; border-radius:8px; background:${isCorr ? '#059669' : '#e11d48'}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:900; flex-shrink:0;">${idx + 1}</span>
                  <span style="font-size:0.78rem; font-weight:700; color:#64748b;">من ${details.length}</span>
                </div>
                <span style="background:${isCorr ? 'rgba(5,150,105,0.1)' : 'rgba(225,29,72,0.08)'}; color:${isCorr ? '#059669' : '#e11d48'}; font-weight:800; font-size:0.76rem; padding:4px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fa-solid ${isCorr ? 'fa-circle-check' : 'fa-circle-xmark'}" style="font-size:0.7rem;"></i>
                  ${isCorr ? 'صحيحة' : 'خاطئة'}
                </span>
              </div>
              
              <!-- Question text -->
              <div style="padding:14px 16px 12px;">
                <div style="font-weight:700; font-size:0.92rem; color:#0f172a; line-height:1.7; margin-bottom:12px;">
                  ${escapeHtml(q.question)}
                </div>
                
                <!-- Answer cards -->
                <div style="display:grid; gap:8px; ${!isCorr ? 'grid-template-columns:1fr 1fr;' : ''}">
                  <div style="padding:10px 14px; border-radius:10px; background:${isCorr ? '#f0fdf4' : '#fff1f2'}; border:1.5px solid ${isCorr ? '#86efac' : '#fda4af'};">
                    <div style="font-size:0.7rem; font-weight:800; color:${isCorr ? '#059669' : '#e11d48'}; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.02em;">
                      <i class="fa-solid fa-user" style="font-size:0.6rem; margin-left:3px;"></i> خيار الطالب
                    </div>
                    <div style="font-weight:700; font-size:0.85rem; color:${isCorr ? '#065f46' : '#881337'}; line-height:1.6;">
                      (${escapeHtml(q.selected_option || '—')}) ${escapeHtml(q.selected_text || 'لم يتم الإجابة')}
                    </div>
                  </div>
                  ${!isCorr ? `
                    <div style="padding:10px 14px; border-radius:10px; background:#f0fdf4; border:1.5px solid #86efac;">
                      <div style="font-size:0.7rem; font-weight:800; color:#059669; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.02em;">
                        <i class="fa-solid fa-check" style="font-size:0.6rem; margin-left:3px;"></i> الإجابة الصحيحة
                      </div>
                      <div style="font-weight:700; font-size:0.85rem; color:#065f46; line-height:1.6;">
                        (${escapeHtml(q.correct_option || '—')}) ${escapeHtml(q.correct_text || '')}
                      </div>
                    </div>
                  ` : ''}
                </div>
                
                ${q.explanation || q.article_ref ? `
                  <div style="margin-top:10px; padding:8px 12px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-size:0.78rem; color:#475569; line-height:1.65; display:flex; align-items:flex-start; gap:6px;">
                    <i class="fa-solid fa-lightbulb" style="color:#d97706; margin-top:3px; flex-shrink:0;"></i>
                    <span>${escapeHtml(q.explanation || '')} ${q.article_ref ? `<strong style="color:#334155;">(${escapeHtml(q.article_ref)})</strong>` : ''}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        });
        
        qList.innerHTML = html;
      }
    }
  }

  function renderDossierDocsPane(s) {
    const badge = document.getElementById('sdm-docs-badge');
    const tbody = document.getElementById('sdm-docs-tbody');
    const docs = s.docs_list || [];

    const videoItems = docs.filter(d => (d.id || '').startsWith('station-video-'));
    const docItems = docs.filter(d => !(d.id || '').startsWith('station-video-'));

    if (badge) badge.textContent = `${docItems.length} لائحة + ${videoItems.length} مقطع`;

    if (!tbody) return;
    if (docs.length === 0) {
      tbody.innerHTML = `<div style="text-align:center; padding:30px; color:var(--ink-400);">لم يقم الطالب بتصفح اللوائح أو مشاهدة المقاطع بعد.</div>`;
      return;
    }

    tbody.innerHTML = docs.map((d, i) => {
      const isVideo = (d.id || '').startsWith('station-video-');
      const icon = isVideo ? '<i class="fa-solid fa-film" style="color:#7c3aed;"></i>' : '<i class="fa-solid fa-book-open" style="color:var(--c1);"></i>';
      const typeLabel = isVideo ? '🎬 شاهد المقطع' : '📄 تصفح';
      const badgeBg = isVideo ? 'rgba(124,58,237,0.1)' : 'rgba(5,150,105,0.1)';
      const badgeColor = isVideo ? '#7c3aed' : '#059669';
      return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fff; border:1px solid var(--ink-200); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="width:28px; height:28px; border-radius:50%; background:${badgeBg}; color:${badgeColor}; display:flex; align-items:center; justify-content:center; font-size:0.85rem;">${icon}</span>
          <div>
            <span style="font-weight:700; color:var(--ink-800); font-size:0.88rem;">${escapeHtml(d.name || d.id)}</span>
            <div style="font-size:0.7rem; color:var(--ink-400); margin-top:2px;">${typeLabel} ${d.timestamp ? '• ' + new Date(d.timestamp).toLocaleString('ar-SA') : ''}</div>
          </div>
        </div>
        <span style="background:${badgeBg}; color:${badgeColor}; font-weight:800; font-size:0.78rem; padding:3px 8px; border-radius:6px;">
          ⭐ +${d.pts || 5} نقاط
        </span>
      </div>
    `;}).join('');
  }

  function renderDossierStationsPane(s) {
    const badge = document.getElementById('sdm-stations-badge');
    const tbody = document.getElementById('sdm-stations-tbody');
    const stations = s.stations_list || [];

    if (badge) badge.textContent = `${stations.length} أركان ممسوحة`;

    if (!tbody) return;
    if (stations.length === 0) {
      tbody.innerHTML = `<div style="text-align:center; padding:30px; color:var(--ink-400);">لا توجد أركان ميدانية ممسوحة مسجلة للطالب.</div>`;
      return;
    }

    tbody.innerHTML = stations.map((st, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fff; border:1px solid var(--ink-200); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:28px; height:28px; border-radius:8px; background:rgba(5,150,105,0.1); color:#059669; display:flex; align-items:center; justify-content:center; font-size:0.85rem;">
            <i class="fa-solid fa-qrcode"></i>
          </div>
          <div>
            <div style="font-weight:800; color:var(--ink-800); font-size:0.88rem;">${escapeHtml(st.booth_name || st.booth_code)}</div>
            <div style="font-size:0.72rem; color:var(--ink-400);">تاريخ المسح: ${st.scanned_at || '—'}</div>
          </div>
        </div>
        <span style="background:rgba(5,150,105,0.1); color:#059669; font-weight:800; font-size:0.78rem; padding:3px 8px; border-radius:6px;">
          ⭐ +${st.points_earned || 0} نقطة
        </span>
      </div>
    `).join('');
  }

  function renderDossierWorkshopsPane(s) {
    const badge = document.getElementById('sdm-workshops-badge');
    const tbody = document.getElementById('sdm-workshops-tbody');
    const workshops = s.workshops_list || [];

    if (badge) badge.textContent = `${workshops.length} ورش مسجلة`;

    if (!tbody) return;
    if (workshops.length === 0) {
      tbody.innerHTML = `<div style="text-align:center; padding:30px; color:var(--ink-400);">لم يسجل الطالب حضور أي ورشة تدريبية بعد.</div>`;
      return;
    }

    tbody.innerHTML = workshops.map((ws, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fff; border:1px solid var(--ink-200); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:28px; height:28px; border-radius:8px; background:rgba(124,58,237,0.1); color:#7c3aed; display:flex; align-items:center; justify-content:center; font-size:0.85rem;">
            <i class="fa-solid fa-chalkboard-user"></i>
          </div>
          <div>
            <div style="font-weight:800; color:var(--ink-800); font-size:0.88rem;">${escapeHtml(ws.workshop_title || ws.workshop_id)}</div>
            <div style="font-size:0.72rem; color:var(--ink-400);">${ws.day_number ? `اليوم التدريبي #${ws.day_number} • ` : ''}تاريخ الحضور: ${ws.attended_at || '—'}</div>
          </div>
        </div>
        <span style="background:rgba(124,58,237,0.1); color:#7c3aed; font-weight:800; font-size:0.78rem; padding:3px 8px; border-radius:6px;">
          ⭐ +${ws.points_earned || 5} نقاط
        </span>
      </div>
    `).join('');
  }

  function renderDossierContactPane(s) {
    document.getElementById('sdm-info-fullname').textContent = s.student_name || '—';
    document.getElementById('sdm-info-sid').textContent = s.student_id || '—';
    document.getElementById('sdm-info-college').textContent = s.college || '—';
    document.getElementById('sdm-info-gender').textContent = s.gender || '—';
    document.getElementById('sdm-info-natid').textContent = s.national_id || '—';
    document.getElementById('sdm-info-phone').textContent = s.mobile_phone || '—';
    document.getElementById('sdm-info-email').textContent = `s${s.student_id}@uoh.edu.sa`;
  }

  // ─── Sidebar toggle ─────────────────────────────────────
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sbOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sbOverlay').classList.remove('show');
    document.body.style.overflow = '';
  }

  // ─── Highlight today's trend bar ─────────────────────────
  document.querySelectorAll('.tc-fill.is-today').forEach(el => {
    el.style.boxShadow = '0 0 16px rgba(188,136,89,.5)';
  });

  // ─── Mobile table → feed switch ──────────────────────────
  function handleResize() {
    const tables = document.querySelectorAll('.hide-sm');
    const feeds  = document.querySelectorAll('.show-sm');
    const isMob  = window.innerWidth <= 768;
    tables.forEach(t => t.style.display = isMob ? 'none' : '');
    feeds.forEach(f  => f.style.display  = isMob ? 'block' : 'none');
  }
  window.addEventListener('resize', handleResize);
  handleResize();

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'category-manager';
    switchAdminTab(hash);
  });

  document.addEventListener('DOMContentLoaded', () => {
    fetchAdminCategories();
    fetchAdminQuestions();
    fetchJourneyStations();
    const hash = window.location.hash.replace('#', '') || 'category-manager';
    switchAdminTab(hash);
  });
  // ─── Video Config Management (Multi-Video) ───────────────
  let adminVideosList = [];

  async function loadVideoConfig() {
    try {
      const res = await fetch('/api/admin/landing-config');
      const data = await res.json();
      adminVideosList = data.videos || [];
      const toggle = document.getElementById('video-enabled-toggle');
      toggle.checked = data.video_enabled || false;
      updateToggleVisual(toggle.checked);
      renderVideosList();
    } catch(e) { console.error('Load config error:', e); }
  }

  function renderVideosList() {
    const listEl = document.getElementById('admin-videos-list');
    const emptyEl = document.getElementById('admin-videos-empty');
    const badge = document.getElementById('videos-count-badge');
    if (!listEl) return;

    badge.textContent = adminVideosList.length;
    listEl.innerHTML = '';

    if (adminVideosList.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    adminVideosList.forEach((v, i) => {
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;background:white;border:1px solid var(--ink-200);border-radius:var(--r-md);transition:.2s;';
      card.innerHTML = `
        <div style="width:32px;height:32px;border-radius:50%;background:var(--c1);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.88rem;color:var(--ink-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.caption || 'بدون عنوان'}</div>
          <div style="font-size:0.72rem;color:var(--ink-500);direction:ltr;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${v.url}</div>
        </div>
        <button onclick="removeVideoFromList(${i})" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--danger);background:transparent;color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.75rem;transition:.2s;flex-shrink:0;" title="حذف">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
      listEl.appendChild(card);
    });
  }

  function removeVideoFromList(idx) {
    if (!confirm('هل تريد حذف هذا الفيديو؟')) return;
    adminVideosList.splice(idx, 1);
    renderVideosList();
  }

