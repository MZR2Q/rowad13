  const dateEl = document.getElementById('topDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('ar-SA', {
      weekday:'short', month:'long', day:'numeric'
    });
  }

  // ─── Animate counters ───────────────────────────────────
  document.querySelectorAll('.sc-val[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count) || 0;
    if (target === 0) { el.textContent = '0'; return; }
    let cur = 0;
    const duration = 900;
    const start = performance.now();
    const update = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      cur = Math.round(target * ease);
      el.textContent = cur.toLocaleString('ar');
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = target.toLocaleString('ar');
    };
    requestAnimationFrame(update);
  });

  // ─── Tab View Switcher (فتح الشاشات مباشرة بجانب السايد بار بنمط SPA) ────────────
  function switchAdminTab(tabName, el) {
    const views = {
      'category-manager': document.getElementById('view-category-manager'),
      'student-attempts': document.getElementById('view-student-attempts'),
      'video-manager': document.getElementById('view-video-manager'),
      'qrcodes': document.getElementById('view-qrcodes'),
      'station-videos': document.getElementById('view-station-videos'),
      'report': document.getElementById('view-report'),
      'dashboard': document.getElementById('view-dashboard')
    };

    if (el) {
      document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'));
      el.classList.add('active');
    } else {
      document.querySelectorAll('.sb-link').forEach(l => {
        if (l.getAttribute('href') === '#' + tabName) {
          l.classList.add('active');
        } else {
          l.classList.remove('active');
        }
      });
    }

    // Hide all view tabs
    Object.values(views).forEach(v => {
      if (v) {
        v.style.display = 'none';
        v.classList.remove('active-view');
      }
    });

    // Show selected view tab
    const targetView = views[tabName] || views['category-manager'];
    if (targetView) {
      targetView.style.display = 'block';
      targetView.classList.add('active-view');
    }

    // Trigger tab specific data loaders
    if (tabName === 'category-manager' || !tabName) {
      fetchAdminCategories();
    } else if (tabName === 'student-attempts') {
      fetchAdminStudentAttempts();
    } else if (tabName === 'video-manager') {
      loadVideoConfig();
      fetchAdminVideoWatchingAnalytics();
    } else if (tabName === 'station-videos') {
      fetchStationVideos();
    } else if (tabName === 'qrcodes') {
      initDashboardQRCodes();
    } else if (tabName === 'report') {
      fetchAdminComprehensiveReport();
    }

    // Update topbar title
    const titles = {
      'category-manager': 'إدارة بطاقات الأقسام والأسئلة',
      'student-attempts': 'نتائج واختبارات الطلاب',
      'video-manager': 'إدارة فيديو الصفحة الرئيسية',
      'station-videos': 'إدارة مقاطع المحطات الافتراضية 🎬',
      'qrcodes': 'طباعة باركودات الأركان والورش الميدانية (QR)',
      'report': 'التقرير القيادي الشامل للجامعة (رسمي)'
    };
    const titleEl = document.getElementById('topbar-page-title');
    if (titleEl && titles[tabName]) {
      titleEl.innerHTML = `<i class="fa-solid fa-layer-group" style="color:var(--c3); margin-left:6px;"></i> ${titles[tabName]}`;
    }

    if (window.innerWidth <= 900) closeSidebar();
  }

  // ─── Dashboard QR Codes Generator ─────────────────────────
  let qrCodesGenerated = false;
  const DASH_STATIONS = [
    { id: 'reception', name: 'ركن الاستقبال وتسليم الهدايا 🎁', icon: 'fa-solid fa-gift', code: 'UOH-STATION-RECEPTION', typeLabel: 'ركن الاستقبال والهدايا (بدون نقاط)', typeColor: 'background:rgba(217,119,6,0.1); color:#D97706;', extraText: 'استلام الحقيبة الترحيبية وتوثيق الحضور' },
    { id: 'affairs', name: 'عمادة شؤون الطلاب', icon: 'fa-solid fa-users', code: 'UOH-STATION-AFFAIRS', typeLabel: 'ركن حضوري (10 نقاط)', typeColor: 'background:rgba(136,45,27,0.08); color:var(--c1);', extraText: 'التعريف بالخدمات والبرامج والدعم الطلابي' },
    { id: 'admission', name: 'عمادة القبول والتسجيل', icon: 'fa-solid fa-file-signature', code: 'UOH-STATION-ADMISSION', typeLabel: 'ركن حضوري (10 نقاط)', typeColor: 'background:rgba(136,45,27,0.08); color:var(--c1);', extraText: 'الخدمات الأكاديمية والجدول والحذف والإضافة' },
    { id: 'elearn', name: 'التعليم الإلكتروني والتحول الرقمي', icon: 'fa-solid fa-desktop', code: 'UOH-STATION-ELEARN', typeLabel: 'ركن حضوري (10 نقاط)', typeColor: 'background:rgba(136,45,27,0.08); color:var(--c1);', extraText: 'بلاك بورد والبريد الجامعي والأنظمة الرقمية' },
    { id: 'colleges', name: 'الكليات الأكاديمية', icon: 'fa-solid fa-building-columns', code: 'UOH-STATION-COLLEGES', typeLabel: 'ركن حضوري (10 نقاط)', typeColor: 'background:rgba(136,45,27,0.08); color:var(--c1);', extraText: 'مبنى الكلية، القاعات، المعامل والإرشاد الأكاديمي' },
    { id: 'clubs', name: 'الأندية الطلابية والأنشطة', icon: 'fa-solid fa-people-roof', code: 'UOH-STATION-CLUBS', typeLabel: 'ركن حضوري (10 نقاط)', typeColor: 'background:rgba(136,45,27,0.08); color:var(--c1);', extraText: 'عرض الأندية وإتاحة التسجيل والمشاركة' },
    { id: 'clinic', name: 'المركز الطبي الجامعي', icon: 'fa-solid fa-heart-pulse', code: 'UOH-STATION-CLINIC', typeLabel: 'ركن حضوري (10 نقاط)', typeColor: 'background:rgba(136,45,27,0.08); color:var(--c1);', extraText: 'الفحوصات الأولية والخدمات الصحية الجامعية' }
  ];

  const DASH_WORKSHOPS = [
    { num: 1, name: 'من المدرسة إلى الجامعة', code: 'UOH-WS-01', date: 'الاثنين 25 أغسطس' },
    { num: 2, name: 'النزاهة الأكاديمية', code: 'UOH-WS-02', date: 'الأربعاء 2 سبتمبر' },
    { num: 3, name: 'إدارة الوقت وتجنب التسويف', code: 'UOH-WS-03', date: 'الاثنين 25 أغسطس' },
    { num: 4, name: 'كفاء المصطلحات في الدراسة', code: 'UOH-WS-04', date: 'الثلاثاء 26 أغسطس' },
    { num: 5, name: 'التكيف النفسي مع البيئة الجامعية', code: 'UOH-WS-05', date: 'الأربعاء 27 أغسطس' },
    { num: 6, name: 'الأمن الفكري في البيئة الجامعية', code: 'UOH-WS-06', date: 'الأحد 30 أغسطس' },
    { num: 7, name: 'اكتشف شغفك من خلال الأندية', code: 'UOH-WS-07', date: 'الاثنين 31 أغسطس' },
    { num: 8, name: 'مهارات البحث والأنشطة الرقمية', code: 'UOH-WS-08', date: 'الثلاثاء 1 سبتمبر' },
    { num: 9, name: 'التميز الطلابي وصناعة الإنجاز', code: 'UOH-WS-09', date: 'الأربعاء 2 سبتمبر' }
  ];

  const ALL_DASH_QR_ITEMS = [
    ...DASH_STATIONS,
    ...DASH_WORKSHOPS.map(w => ({
      id: `ws-${w.num}`,
      name: `ورشة ${w.num}: ${w.name}`,
      icon: 'fa-solid fa-chalkboard-user',
      code: w.code,
      typeLabel: 'ورشة تدريبية (5 نقاط)',
      typeColor: 'background:rgba(5,150,105,0.08); color:#059669;',
      extraText: `${w.date} • 10:45 - 11:15`
    }))
  ];

  function initDashboardQRCodes() {
    if (qrCodesGenerated) return;
    const stationsGrid = document.getElementById('dashStationsGrid');
    const workshopsGrid = document.getElementById('dashWorkshopsGrid');
    if (!stationsGrid || !workshopsGrid) return;

    stationsGrid.innerHTML = '';
    workshopsGrid.innerHTML = '';

    function renderQRCard(container, item, extraHtml = '') {
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff; border-radius:16px; border:2px solid rgba(211,180,139,0.35); padding:20px; text-align:center; box-shadow:0 4px 16px rgba(0,0,0,0.04); page-break-inside:avoid; display:flex; flex-direction:column; justify-content:space-between; gap:12px;';
      card.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:12px;">
            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, var(--c1), var(--c2)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
              <i class="${item.icon}"></i>
            </div>
            <span style="font-size:0.95rem; font-weight:800; color:var(--ink-800);">${item.name}</span>
          </div>
          <div style="font-size:0.72rem; font-weight:700; color:var(--c1); background:rgba(136,45,27,0.06); padding:3px 10px; border-radius:6px; display:inline-block; margin-bottom:12px; font-family:monospace; direction:ltr;">${item.code}</div>
          <div id="dash-qr-${item.code}" style="margin:0 auto 10px; display:flex; justify-content:center; padding:6px; background:#fff; border-radius:10px;"></div>
          ${extraHtml}
          <div style="margin-top:6px; margin-bottom:4px;">
            <span style="font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:6px; display:inline-block; ${item.typeColor}">${item.typeLabel}</span>
          </div>
        </div>
        <button type="button" onclick="printSingleQRCode('${item.code}')" class="btn-outline no-print" style="width:100%; font-size:0.82rem; padding:8px 12px; border-color:var(--c1); color:var(--c1); border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-weight:700; cursor:pointer; background:#fff; transition:0.2s;" onmouseover="this.style.background='rgba(136,45,27,0.08)'" onmouseout="this.style.background='#fff'">
          <i class="fa-solid fa-print"></i> طباعة هذا الباركود منفرد 🖨️
        </button>
      `;
      container.appendChild(card);

      try {
        const qrEl = document.getElementById(`dash-qr-${item.code}`);
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrEl, {
            text: item.code,
            width: 170,
            height: 170,
            colorDark: '#2D0F08',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
        } else if (qrEl) {
          qrEl.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(item.code)}" alt="${item.code}" style="width:170px; height:170px; border-radius:6px;">`;
        }
      } catch(e) {
        console.error('QR render error:', e);
        const qrEl = document.getElementById(`dash-qr-${item.code}`);
        if (qrEl) {
          qrEl.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(item.code)}" alt="${item.code}" style="width:170px; height:170px; border-radius:6px;">`;
        }
      }
    }

    DASH_STATIONS.forEach(s => {
      renderQRCard(stationsGrid, s);
    });

    DASH_WORKSHOPS.forEach(w => {
      const item = ALL_DASH_QR_ITEMS.find(x => x.code === w.code);
      const extraHtml = `<div style="font-size:0.75rem; color:var(--ink-500); margin-bottom:6px;"><i class="fa-regular fa-calendar" style="color:var(--c3);"></i> ${w.date} &nbsp;<i class="fa-regular fa-clock" style="color:#059669;"></i> 10:45 - 11:15</div>`;
      if (item) renderQRCard(workshopsGrid, item, extraHtml);
    });

    qrCodesGenerated = true;
  }

  function printQRCodesDashboard() {
    window.print();
  }

  function printSingleQRCode(code) {
    const item = ALL_DASH_QR_ITEMS.find(x => x.code === code);
    if (!item) return;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة');
      return;
    }

    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(item.code)}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>طباعة باركود: ${item.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@700;800;900&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Cairo', 'Tajawal', sans-serif;
            background: #fff;
            color: #1c0a06;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 30px;
          }
          .ticket {
            width: 100%;
            max-width: 580px;
            border: 4px solid #882D1B;
            border-radius: 28px;
            padding: 36px 30px;
            text-align: center;
            position: relative;
            background: #fff;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
          }
          .ticket::before {
            content: "";
            position: absolute;
            inset: 6px;
            border: 1.5px dashed #D3B48B;
            border-radius: 20px;
            pointer-events: none;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #F3EDE6;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          .inst-name {
            font-size: 0.92rem;
            font-weight: 700;
            color: #BC8859;
          }
          .inst-sub {
            font-size: 0.8rem;
            color: #6B5B50;
            margin-top: 2px;
          }
          .logo-img {
            height: 52px;
            object-fit: contain;
          }
          .title-box {
            margin-bottom: 18px;
          }
          .main-title {
            font-size: 1.55rem;
            font-weight: 900;
            color: #882D1B;
            margin-bottom: 6px;
          }
          .type-pill {
            display: inline-block;
            background: rgba(136,45,27,0.08);
            color: #882D1B;
            border: 1px solid rgba(136,45,27,0.2);
            padding: 4px 14px;
            border-radius: 20px;
            font-weight: 800;
            font-size: 0.85rem;
          }
          .qr-frame {
            margin: 20px auto;
            width: 250px;
            height: 250px;
            padding: 12px;
            background: #fff;
            border: 2px solid #E2D8CC;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          }
          .qr-frame img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .code-str {
            font-family: monospace;
            font-size: 0.95rem;
            font-weight: 800;
            background: #F8F5F2;
            color: #882D1B;
            padding: 6px 16px;
            border-radius: 8px;
            display: inline-block;
            margin-bottom: 18px;
            border: 1px solid #E5DBD0;
            direction: ltr;
          }
          .instructions {
            background: #FAF8F5;
            border-radius: 14px;
            padding: 14px 16px;
            font-size: 0.88rem;
            font-weight: 700;
            color: #4A3B32;
            line-height: 1.6;
            margin-top: 10px;
          }
          .footer-note {
            margin-top: 20px;
            font-size: 0.76rem;
            color: #8C7E74;
          }
          @media print {
            body { padding: 0; background: #fff; }
            .ticket { box-shadow: none; max-width: 100%; border: 3px solid #000; }
            .ticket::before { border: 1px dashed #666; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <img src="/static/img/شعار جامعة حفرالباطن.png" class="logo-img" alt="جامعة حفر الباطن" onerror="this.style.display='none'">
            <div>
              <div class="inst-name">المملكة العربية السعودية • جامعة حفر الباطن</div>
              <div class="inst-sub">عمادة شؤون الطلاب • برنامج استقبال المستجدين (رواد 13)</div>
            </div>
            <img src="/static/img/شعار_رواد_13_شفاف.png" class="logo-img" alt="رواد 13" onerror="this.style.display='none'">
          </div>

          <div class="title-box">
            <h1 class="main-title">${item.name}</h1>
            <div class="type-pill">${item.typeLabel}</div>
            ${item.extraText ? `<div style="margin-top:8px; font-size:0.85rem; color:#6B5B50;">${item.extraText}</div>` : ''}
          </div>

          <div class="qr-frame">
            <img src="${qrImgUrl}" alt="${item.code}">
          </div>

          <div>
            <span class="code-str">${item.code}</span>
          </div>

          <div class="instructions">
            📷 <strong>طريقة التوثيق للطلاب:</strong><br>
            افتح كاميرا هاتفك أو تطبيق البوابة واضغط على <strong>مسح الباركود</strong> لكسب النقاط وتوثيق حضورك فورياً.
          </div>

          <div class="footer-note">
            منظومة استقبال المستجدين • رواد 13 • جامعة حفر الباطن 1448هـ
          </div>

          <div style="margin-top:16px;" class="no-print">
            <button onclick="window.print()" style="padding:10px 24px; background:#882D1B; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; font-family:inherit;">
              <i class="fa-solid fa-print"></i> بدء الطباعة الآن
            </button>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // ─── Export All QR Codes to Word (.doc) — Clean Plain Layout ─────────
  function exportQRCodesToWord() {
    // Build a simple HTML table-based Word document
    let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: 'Arial', 'Tahoma', sans-serif; direction: rtl; }
  .qr-item {
    page-break-inside: avoid;
    border: 1px solid #ccc;
    padding: 15px;
    margin-bottom: 20px;
    text-align: center;
  }
  .qr-name {
    font-size: 16pt;
    font-weight: bold;
    margin-bottom: 8px;
    color: #333;
  }
  .qr-code-text {
    font-size: 10pt;
    color: #888;
    font-family: 'Courier New', monospace;
    margin-bottom: 10px;
    direction: ltr;
  }
  .qr-img {
    margin: 10px auto;
  }
  h2 {
    font-size: 18pt;
    color: #333;
    border-bottom: 2px solid #333;
    padding-bottom: 5px;
    margin-top: 30px;
    margin-bottom: 15px;
  }
</style>
</head>
<body>
<h2>باركودات الأركان</h2>
`;

    // Add stations
    DASH_STATIONS.forEach(s => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(s.code)}`;
      html += `
<div class="qr-item">
  <div class="qr-name">${s.name}</div>
  <div class="qr-code-text">${s.code}</div>
  <div class="qr-img"><img src="${qrUrl}" width="250" height="250" alt="${s.code}"></div>
</div>
`;
    });

    html += `<h2>باركودات الورش</h2>`;

    // Add workshops
    DASH_WORKSHOPS.forEach(w => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(w.code)}`;
      html += `
<div class="qr-item">
  <div class="qr-name">ورشة ${w.num}: ${w.name}</div>
  <div class="qr-code-text">${w.code}</div>
  <div class="qr-img"><img src="${qrUrl}" width="250" height="250" alt="${w.code}"></div>
</div>
`;
    });

    html += `</body></html>`;

    // Create and download the .doc file
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'باركودات_الأركان_والورش.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Dashboard Comprehensive Report Dynamic Fetch & Print ───
  async function fetchAdminComprehensiveReport() {
    try {
      const res = await fetch('/api/admin/reports/comprehensive');
      const data = await res.json();
      if (data.success && data.report) {
        const rep = data.report;
        const s = rep.summary || {};
        
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('rep-total-students', s.total_students_registered || 0);
        setTxt('rep-active-students', `${s.active_participating_students || 0} طالب متفاعل`);
        setTxt('rep-total-points', s.total_points_awarded || 0);
        setTxt('rep-avg-points', `معدل ${s.average_points_per_student || 0} لكل طالب`);
        setTxt('rep-satisfaction', `${s.overall_satisfaction_stars || 5.0} ★`);
        setTxt('rep-surveys-count', `${s.total_survey_responses || 0} مشاركة بالاستبيان`);
        setTxt('rep-quiz-attempts', s.quiz_attempts_total || 0);
        setTxt('rep-perfect-scores', `${s.quiz_perfect_scores || 0} علامة كاملة`);
        setTxt('report-gen-date', `تاريخ الاستخراج: ${rep.generated_at || 'مباشر'}`);

        // Workshops
        const wsTbody = document.getElementById('rep-workshops-tbody');
        if (wsTbody && rep.workshops_breakdown) {
          if (rep.workshops_breakdown.length === 0) {
            wsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--ink-400);">لا توجد سجلات ورش مسجلة بعد</td></tr>';
          } else {
            wsTbody.innerHTML = rep.workshops_breakdown.map(ws => `
              <tr style="border-bottom:1px solid var(--ink-100);">
                <td style="padding:10px 14px;"><strong>اليوم ${ws.day_number}</strong></td>
                <td style="padding:10px 14px;">${escapeHtml(ws.workshop_title)}</td>
                <td style="padding:10px 14px; text-align:center;"><strong>${ws.attendees_count}</strong> طالب</td>
                <td style="padding:10px 14px; text-align:center; color:#059669; font-weight:700;">${ws.attendees_count * 15} نقطة</td>
                <td style="padding:10px 14px; text-align:center;"><span style="background:#D1FAE5; color:#065F46; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700;"><i class="fa-solid fa-check"></i> نشطة</span></td>
              </tr>
            `).join('');
          }
        }

        // QR Scans
        const qrTbody = document.getElementById('rep-qr-tbody');
        if (qrTbody && rep.qr_scans_breakdown) {
          if (rep.qr_scans_breakdown.length === 0) {
            qrTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--ink-400);">لا توجد عمليات مسح مسجلة</td></tr>';
          } else {
            qrTbody.innerHTML = rep.qr_scans_breakdown.map(q => `
              <tr style="border-bottom:1px solid var(--ink-100);">
                <td style="padding:10px 12px;">${escapeHtml(q.booth_name || 'محطة الحرم')}</td>
                <td style="padding:10px 12px;"><code style="background:var(--ink-100); padding:2px 6px; border-radius:4px; font-size:0.75rem;">${escapeHtml(q.booth_code)}</code></td>
                <td style="padding:10px 12px; text-align:center;"><strong>${q.scan_count}</strong> مرة</td>
              </tr>
            `).join('');
          }
        }

        // Honor Students
        const honorTbody = document.getElementById('rep-honor-tbody');
        if (honorTbody && rep.top_honor_students) {
          if (rep.top_honor_students.length === 0) {
            honorTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--ink-400);">لا توجد سجلات طلاب حالياً</td></tr>';
          } else {
            honorTbody.innerHTML = rep.top_honor_students.slice(0, 7).map((s, idx) => `
              <tr style="border-bottom:1px solid var(--ink-100);">
                <td style="padding:10px 12px;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1)}</td>
                <td style="padding:10px 12px;"><code style="font-size:0.8rem;">${escapeHtml(s.student_id)}</code></td>
                <td style="padding:10px 12px; font-weight:700;">${escapeHtml(s.student_name)}</td>
                <td style="padding:10px 12px; text-align:center; color:#059669; font-weight:800;">${s.total_points}</td>
              </tr>
            `).join('');
          }
        }

        // Feedback
        const fbTbody = document.getElementById('rep-feedback-tbody');
        if (fbTbody && rep.recent_feedback) {
          if (rep.recent_feedback.length === 0) {
            fbTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--ink-400);">لا توجد استبيانات مسجلة</td></tr>';
          } else {
            fbTbody.innerHTML = rep.recent_feedback.map(f => `
              <tr style="border-bottom:1px solid var(--ink-100);">
                <td style="padding:10px 12px;"><code style="font-size:0.8rem;">${escapeHtml(f.student_id)}</code></td>
                <td style="padding:10px 12px; text-align:center; font-weight:800; color:#F59E0B;">${f.satisfaction_rating} / 5 ★</td>
                <td style="padding:10px 12px;">${escapeHtml(f.positive_feedback || '—')}</td>
                <td style="padding:10px 12px;">${escapeHtml(f.suggestions || '—')}</td>
                <td style="padding:10px 12px; font-size:0.75rem; color:var(--ink-500);">${f.created_at || ''}</td>
              </tr>
            `).join('');
          }
        }
      }
    } catch(e) {
      console.error('Fetch comprehensive report error:', e);
    }
  }

