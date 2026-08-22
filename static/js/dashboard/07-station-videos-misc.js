  function addVideoToList() {
    const urlInput = document.getElementById('video-url-input');
    const captionInput = document.getElementById('video-caption-input');
    const url = urlInput.value.trim();
    const caption = captionInput.value.trim() || 'فيديو ' + (adminVideosList.length + 1);

    if (!url) {
      alert('يرجى رفع ملف فيديو أو إدخال رابط أولاً');
      return;
    }

    adminVideosList.push({ url, caption });
    urlInput.value = '';
    captionInput.value = '';
    document.getElementById('video-upload-status').textContent = '';
    renderVideosList();
  }

  async function saveVideoConfig() {
    const enabled = document.getElementById('video-enabled-toggle').checked;
    try {
      const res = await fetch('/api/admin/landing-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: adminVideosList, video_enabled: enabled })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ تم حفظ ${adminVideosList.length} فيديو بنجاح`);
      } else {
        alert('❌ حدث خطأ في الحفظ');
      }
    } catch(e) { alert('❌ خطأ في الاتصال'); }
  }

  async function uploadVideoFile() {
    const fileInput = document.getElementById('video-file-input');
    const status = document.getElementById('video-upload-status');
    if (!fileInput.files.length) return;
    
    const file = fileInput.files[0];
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const formData = new FormData();
    formData.append('video', file);
    status.textContent = `جاري رفع ${file.name} (${sizeMB}MB)...`;
    status.style.color = 'var(--c3)';

    try {
      const res = await fetch('/api/admin/upload-video', { method: 'POST', body: formData });
      let data;
      try { data = await res.json(); } catch(e) { data = { error: `HTTP ${res.status}` }; }
      
      if (res.ok && data.success) {
        const caption = document.getElementById('video-caption-input').value.trim() || file.name.replace(/\.[^.]+$/, '');
        adminVideosList.push({ url: data.video_url, caption });
        document.getElementById('video-caption-input').value = '';
        document.getElementById('video-url-input').value = '';
        fileInput.value = '';
        renderVideosList();
        status.textContent = `✅ تم رفع وإضافة "${caption}" (${sizeMB}MB)`;
        status.style.color = 'var(--success)';
      } else {
        status.textContent = `❌ فشل الرفع: ${data.error || 'خطأ غير معروف'}`;
        status.style.color = 'var(--danger)';
      }
    } catch(e) {
      status.textContent = `❌ خطأ في الاتصال: ${e.message}`;
      status.style.color = 'var(--danger)';
    }
  }

  function updateToggleVisual(checked) {
    const dot = document.getElementById('video-toggle-dot');
    const span = dot?.previousElementSibling;
    if (checked) {
      if (span) span.style.background = 'var(--c1)';
      if (dot) dot.style.right = '27px';
    } else {
      if (span) span.style.background = 'var(--ink-300)';
      if (dot) dot.style.right = '3px';
    }
  }

  document.addEventListener('change', function(e) {
    if (e.target.id === 'video-enabled-toggle') {
      updateToggleVisual(e.target.checked);
    }
  });

  // ─── Video Watching Analytics & Tracking ─────────────────
  let allAdminVideoAnalytics = null;

  async function fetchAdminVideoWatchingAnalytics() {
    const tbody = document.getElementById('admin-video-analytics-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:var(--ink-400);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem; margin-bottom:8px; display:block; color:var(--c1);"></i> جاري تحميل سجلات المشاهدة للطلاب...</td></tr>`;
    }
    try {
      const res = await fetch('/api/admin/videos/analytics');
      const data = await res.json();
      if (data.success && data.analytics) {
        allAdminVideoAnalytics = data.analytics;
        renderAdminVideoAnalytics(data.analytics);
      } else {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--danger);">فشل تحميل سجل المشاهدات</td></tr>`;
      }
    } catch(e) {
      console.error('Fetch video analytics error:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--danger);">خطأ في الاتصال أثناء جلب المشاهدات</td></tr>`;
    }
  }

  function renderAdminVideoAnalytics(analytics) {
    if (!analytics) return;

    // Update Summary Metrics
    const setNum = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setNum('va-metric-all-done', analytics.completed_all_count || 0);
    setNum('va-metric-partial', analytics.partial_viewers_count || 0);
    setNum('va-metric-none', analytics.non_viewers_count || 0);
    setNum('va-metric-total-plays', analytics.total_video_plays || 0);

    filterAdminVideoAnalyticsTable();
  }

  function filterAdminVideoAnalyticsTable() {
    const tbody = document.getElementById('admin-video-analytics-tbody');
    if (!tbody || !allAdminVideoAnalytics) return;

    const search = (document.getElementById('va-search-input')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('va-filter-status')?.value || 'all';

    let list = allAdminVideoAnalytics.students || [];

    if (statusFilter !== 'all') {
      list = list.filter(s => s.watch_status === statusFilter);
    }

    if (search) {
      list = list.filter(s => 
        (s.student_name || '').toLowerCase().includes(search) ||
        (s.student_id || '').toLowerCase().includes(search) ||
        (s.college || '').toLowerCase().includes(search)
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:var(--ink-400);"><i class="fa-solid fa-user-slash" style="font-size:1.8rem; margin-bottom:8px; display:block;"></i> لا يوجد طلاب يطابقون معايير البحث والفلترة المحددة</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((s, idx) => {
      let statusBadge = '';
      let progColor = '#10B981';
      if (s.watch_status === 'all_completed') {
        statusBadge = `<span style="background:#ECFDF5; color:#065F46; border:1px solid #10B981; padding:4px 10px; border-radius:20px; font-weight:800; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-check"></i> شاهد جميع المقاطع (100%) 👑</span>`;
        progColor = '#10B981';
      } else if (s.watch_status === 'partial') {
        statusBadge = `<span style="background:#FFFBEB; color:#92400E; border:1px solid #F59E0B; padding:4px 10px; border-radius:20px; font-weight:800; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-clock"></i> شاهد جزئياً (${s.completed_videos_count}/${s.total_configured_videos}) ⏳</span>`;
        progColor = '#F59E0B';
      } else {
        statusBadge = `<span style="background:#FEF2F2; color:#991B1B; border:1px solid #EF4444; padding:4px 10px; border-radius:20px; font-weight:800; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-xmark"></i> لم يشاهد أي مقطع ❌</span>`;
        progColor = '#EF4444';
      }

      // Render individual videos pills
      const videosPills = (s.videos_status || []).map((v, i) => {
        if (v.is_completed) {
          return `
            <div style="background:#F0FDF4; border:1px solid #10B981; border-radius:8px; padding:4px 8px; font-size:0.75rem; color:#065F46; display:inline-flex; align-items:center; gap:5px; margin:2px;" title="${escapeHtml(v.video_caption)}${v.last_watched_at ? ' • ' + v.last_watched_at : ''}">
              <i class="fa-solid fa-check" style="color:#10B981;"></i>
              <strong>المقطع ${i + 1}</strong>
              <span style="font-size:0.7rem; color:#047857;">(مكتمل ✅)</span>
            </div>
          `;
        } else {
          return `
            <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:8px; padding:4px 8px; font-size:0.75rem; color:#64748B; display:inline-flex; align-items:center; gap:5px; margin:2px;" title="${escapeHtml(v.video_caption)} (لم يكتمل بعد)">
              <i class="fa-regular fa-circle" style="color:#94A3B8;"></i>
              <span>المقطع ${i + 1}</span>
            </div>
          `;
        }
      }).join('');

      return `
        <tr style="border-bottom:1px solid var(--ink-100); transition:background 0.15s;" onmouseover="this.style.background='var(--ink-50)'" onmouseout="this.style.background='transparent'">
          <td style="padding:12px 10px; text-align:center; font-weight:800; color:var(--ink-500);">${s.rank || (idx + 1)}</td>
          <td style="padding:12px 14px;">
            <div style="font-weight:800; color:var(--ink-800); font-size:0.92rem;">${escapeHtml(s.student_name)}</div>
            <div style="font-size:0.75rem; color:var(--ink-500);"><i class="fa-solid fa-building-columns" style="color:var(--c3);"></i> ${escapeHtml(s.college)}</div>
          </td>
          <td style="padding:12px 14px;">
            <code style="font-size:0.85rem; font-family:monospace; background:var(--ink-100); padding:3px 7px; border-radius:6px; border:1px solid var(--ink-200);">${escapeHtml(s.student_id)}</code>
            <div style="font-size:0.7rem; color:var(--ink-400); margin-top:2px;">${escapeHtml(s.gender || '—')}</div>
          </td>
          <td style="padding:12px 14px; text-align:center;">
            <div style="margin-bottom:5px;">${statusBadge}</div>
            <div style="width:100%; max-width:140px; height:6px; background:var(--ink-200); border-radius:10px; margin:0 auto; overflow:hidden;">
              <div style="width:${s.completion_ratio}%; height:100%; background:${progColor}; border-radius:10px;"></div>
            </div>
          </td>
          <td style="padding:12px 14px; text-align:center;">
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:4px; max-width:280px; margin:0 auto;">
              ${videosPills}
            </div>
          </td>
          <td style="padding:12px 14px; text-align:center;">
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }


  // ════════════════════════════════════════════════════════════════════════════
  // ─── Station Videos Management (Admin Dashboard) ────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  const STATION_NAMES = {
    1: '🏫 المحطة الأولى — عن الجامعة (10 نقاط)',
    2: '📚 المحطة الثانية — الأنظمة التقنية (15 نقاط)',
    3: '⚖️ المحطة الثالثة — حقوقك وواجباتك (20 نقاط)',
    4: '🎓 المحطة الرابعة — القبول والتسجيل (15 نقاط)',
    5: '🏛️ المحطة الخامسة — شؤون الطلاب (15 نقاط)'
  };

  let allStationVideos = [];

  async function fetchStationVideos() {
    const tbody = document.getElementById('station-videos-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.3rem; color:#7c3aed;"></i> جاري التحميل...</td></tr>`;
    try {
      const res = await fetch('/api/admin/station-videos');
      const data = await res.json();
      if (data.success) {
        allStationVideos = data.videos || [];
        renderStationVideosTable(allStationVideos);
        const badge = document.getElementById('sb-station-videos-badge');
        if (badge) badge.textContent = allStationVideos.length || '🎬';
      }
    } catch(e) {
      console.error('Fetch station videos error:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--danger);">خطأ في التحميل</td></tr>`;
    }
  }

  function renderStationVideosTable(videos) {
    const tbody = document.getElementById('station-videos-tbody');
    if (!tbody) return;
    if (!videos || videos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--ink-400);"><i class="fa-solid fa-film" style="font-size:2rem; margin-bottom:8px; display:block; color:var(--ink-300);"></i>لا توجد مقاطع بعد — اضغط "إضافة مقطع جديد" للبدء</td></tr>`;
      return;
    }

    tbody.innerHTML = videos.map((v, i) => {
      const isConfig = String(v.id).startsWith('config-');
      const stationLabel = v.station_num ? (STATION_NAMES[v.station_num] || `محطة ${v.station_num}`) : '<span style="color:var(--ink-400);">📺 عام</span>';
      const statusBadge = v.is_active
        ? '<span style="background:rgba(5,150,105,0.12); color:#059669; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.78rem;">✅ مفعّل</span>'
        : '<span style="background:rgba(239,68,68,0.12); color:#ef4444; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.78rem;">⏸️ معطّل</span>';
      const sourceBadge = isConfig
        ? '<span style="background:rgba(37,99,235,0.1); color:#2563eb; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:700;">📄 ملف الإعدادات</span>'
        : '<span style="background:rgba(124,58,237,0.1); color:#7c3aed; padding:2px 8px; border-radius:6px; font-size:0.68rem; font-weight:700;">🗃️ قاعدة البيانات</span>';

      const actionButtons = isConfig
        ? `<span style="font-size:0.72rem; color:var(--ink-400);">يُدار من إعدادات الصفحة</span>`
        : `<div style="display:flex; gap:6px; justify-content:center;">
              <button onclick="editStationVideo(${v.id})" style="background:rgba(37,99,235,0.1); color:#2563eb; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:0.78rem; font-weight:700;" title="تعديل">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button onclick="toggleStationVideoActive(${v.id}, ${v.is_active ? 0 : 1})" style="background:${v.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(5,150,105,0.1)'}; color:${v.is_active ? '#ef4444' : '#059669'}; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:0.78rem; font-weight:700;" title="${v.is_active ? 'تعطيل' : 'تفعيل'}">
                <i class="fa-solid ${v.is_active ? 'fa-pause' : 'fa-play'}"></i>
              </button>
              <button onclick="deleteStationVideo(${v.id}, '${escapeHtml(v.title)}')" style="background:rgba(239,68,68,0.1); color:#ef4444; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:0.78rem; font-weight:700;" title="حذف">
                <i class="fa-solid fa-trash"></i>
              </button>
           </div>`;

      return `
        <tr style="border-bottom:1px solid var(--ink-200);" onmouseover="this.style.background='rgba(124,58,237,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding:12px; text-align:center; font-weight:800; color:var(--ink-500);">${i + 1}</td>
          <td style="padding:12px 14px;">
            <div style="font-weight:800; color:var(--ink-800);">${escapeHtml(v.title)}</div>
            <div style="font-size:0.75rem; color:var(--ink-400); margin-top:2px; display:flex; gap:6px; align-items:center;">
              ${sourceBadge}
            </div>
          </td>
          <td style="padding:12px 14px; text-align:center; font-size:0.82rem;">
            ${stationLabel}
          </td>
          <td style="padding:12px 14px; text-align:center;">
            ${statusBadge}
          </td>
          <td style="padding:12px 14px; text-align:center;">
            <a href="${escapeHtml(v.url)}" target="_blank" style="color:#7c3aed; font-size:0.78rem; font-weight:700;">
              <i class="fa-solid fa-external-link"></i> فتح
            </a>
          </td>
          <td style="padding:12px 14px; text-align:center;">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join('');
  }

  let svUploadedUrl = ''; // Stores URL after file upload
  let svInputMode = 'upload'; // 'upload' or 'url'

  function switchSvInputMode(mode) {
    svInputMode = mode;
    const uploadArea = document.getElementById('sv-upload-area');
    const urlArea = document.getElementById('sv-url-area');
    const uploadBtn = document.getElementById('sv-mode-upload');
    const urlBtn = document.getElementById('sv-mode-url');

    if (mode === 'upload') {
      if (uploadArea) uploadArea.style.display = '';
      if (urlArea) urlArea.style.display = 'none';
      if (uploadBtn) { uploadBtn.style.background = 'linear-gradient(135deg, #7c3aed, #8b5cf6)'; uploadBtn.style.color = '#fff'; }
      if (urlBtn) { urlBtn.style.background = 'var(--ink-100)'; urlBtn.style.color = 'var(--ink-600)'; }
    } else {
      if (uploadArea) uploadArea.style.display = 'none';
      if (urlArea) urlArea.style.display = '';
      if (urlBtn) { urlBtn.style.background = 'linear-gradient(135deg, #7c3aed, #8b5cf6)'; urlBtn.style.color = '#fff'; }
      if (uploadBtn) { uploadBtn.style.background = 'var(--ink-100)'; uploadBtn.style.color = 'var(--ink-600)'; }
    }
  }

  function handleSvFileSelect(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const validExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      alert('صيغة الملف غير مدعومة! الصيغ المسموحة: ' + validExts.join(', '));
      input.value = '';
      return;
    }

    const progressDiv = document.getElementById('sv-upload-progress');
    const progressBar = document.getElementById('sv-upload-bar');
    const statusText = document.getElementById('sv-upload-status');
    const dropZone = document.getElementById('sv-drop-zone');
    const selectedFile = document.getElementById('sv-selected-file');
    const selectedName = document.getElementById('sv-selected-filename');

    if (progressDiv) progressDiv.style.display = '';
    if (dropZone) dropZone.style.display = 'none';
    if (selectedFile) selectedFile.style.display = 'none';
    if (statusText) statusText.textContent = `جاري رفع "${file.name}"...`;
    if (progressBar) progressBar.style.width = '0%';

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload-video', true);

    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (statusText) statusText.textContent = `جاري الرفع... ${pct}%`;
      }
    };

    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success && data.video_url) {
            svUploadedUrl = data.video_url;
            if (progressDiv) progressDiv.style.display = 'none';
            if (selectedFile) selectedFile.style.display = '';
            if (selectedName) selectedName.textContent = `تم رفع: ${file.name}`;
            console.log('[StationVideo] File uploaded:', svUploadedUrl);
          } else {
            alert('خطأ في رفع الملف: ' + (data.error || 'غير معروف'));
            resetSvUploadUI();
          }
        } catch(e) {
          alert('خطأ في معالجة الرد');
          resetSvUploadUI();
        }
      } else {
        alert('خطأ في رفع الملف (HTTP ' + xhr.status + ')');
        resetSvUploadUI();
      }
    };

    xhr.onerror = function() {
      alert('خطأ في الاتصال أثناء الرفع');
      resetSvUploadUI();
    };

    xhr.send(formData);
  }

  function resetSvUploadUI() {
    const progressDiv = document.getElementById('sv-upload-progress');
    const dropZone = document.getElementById('sv-drop-zone');
    const selectedFile = document.getElementById('sv-selected-file');
    const fileInput = document.getElementById('sv-file-input');
    if (progressDiv) progressDiv.style.display = 'none';
    if (dropZone) dropZone.style.display = '';
    if (selectedFile) selectedFile.style.display = 'none';
    if (fileInput) fileInput.value = '';
    svUploadedUrl = '';
  }

  function openStationVideoModal(editData) {
    svUploadedUrl = '';
    document.getElementById('sv-edit-id').value = editData ? editData.id : '';
    document.getElementById('sv-title').value = editData ? editData.title : '';
    document.getElementById('sv-url').value = editData ? editData.url : '';
    document.getElementById('sv-station').value = editData ? (editData.station_num || '') : '';
    document.getElementById('sv-sort').value = editData ? (editData.sort_order || 0) : 0;
    document.getElementById('stationVideoModalTitle').innerHTML = editData
      ? '<i class="fa-solid fa-pen"></i> تعديل المقطع'
      : '<i class="fa-solid fa-film"></i> إضافة مقطع جديد';

    // Reset upload UI
    resetSvUploadUI();
    if (editData && editData.url) {
      // In edit mode, show URL mode with existing URL
      switchSvInputMode('url');
      svUploadedUrl = editData.url;
    } else {
      switchSvInputMode('upload');
    }

    document.getElementById('stationVideoModal').style.display = '';
  }

  function closeStationVideoModal() {
    document.getElementById('stationVideoModal').style.display = 'none';
  }

  async function saveStationVideo() {
    const editId = document.getElementById('sv-edit-id').value;
    const title = document.getElementById('sv-title').value.trim();
    const stationNum = document.getElementById('sv-station').value;
    const sortOrder = parseInt(document.getElementById('sv-sort').value) || 0;

    // Get URL from correct source
    let url = '';
    if (svInputMode === 'upload') {
      url = svUploadedUrl;
    } else {
      url = (document.getElementById('sv-url').value || '').trim();
    }
    // In edit mode, keep existing URL if not changed
    if (!url && editId && svUploadedUrl) {
      url = svUploadedUrl;
    }

    if (!title) {
      alert('العنوان مطلوب!');
      return;
    }
    if (!url) {
      alert('الرجاء رفع ملف فيديو أو كتابة الرابط!');
      return;
    }

    try {
      const isEdit = editId && editId !== '';
      const endpoint = isEdit ? `/api/admin/station-videos/${editId}` : '/api/admin/station-videos';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          url: url,
          station_num: stationNum || null,
          sort_order: sortOrder
        })
      });
      const data = await res.json();
      if (data.success) {
        closeStationVideoModal();
        fetchStationVideos();
      } else {
        alert(data.message || 'حدث خطأ');
      }
    } catch(e) {
      console.error('Save station video error:', e);
      alert('خطأ في حفظ المقطع');
    }
  }

  function editStationVideo(videoId) {
    const v = allStationVideos.find(x => x.id === videoId);
    if (v) openStationVideoModal(v);
  }

  async function toggleStationVideoActive(videoId, newStatus) {
    try {
      const res = await fetch(`/api/admin/station-videos/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });
      const data = await res.json();
      if (data.success) fetchStationVideos();
    } catch(e) {
      console.error('Toggle station video error:', e);
    }
  }

  async function deleteStationVideo(videoId, title) {
    if (!confirm(`هل أنت متأكد من حذف المقطع "${title}"؟`)) return;
    try {
      const res = await fetch(`/api/admin/station-videos/${videoId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchStationVideos();
      else alert(data.message || 'خطأ في الحذف');
    } catch(e) {
      console.error('Delete station video error:', e);
    }
  }