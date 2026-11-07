/* ════════════════════════════════════════════════════════════════
   نَقاء | NAQAA — محرك المحاكاة التفاعلية
   فصل الكشف عن الإغلاق: رصد ← أمر عمل ← تحقق آلي في مرور لاحق ← إغلاق موثّق
   HTML/CSS/JS خام — بدون أي مكتبات أو خادم.
   ════════════════════════════════════════════════════════════════ */
(() => {
"use strict";

/* ─────────── إعدادات عامة ─────────── */
const CFG = {
  THR_HIGH: 0.85,          // عتبة الثقة العليا → أمر عمل تلقائي
  THR_LOW:  0.60,          // عتبة الثقة الدنيا → مراجعة مشغّل
  CLEAN_NEEDED: 2,         // عدد المشاهدات النظيفة المتتالية لإثبات الاستمرار
  MAX_ROUNDS: 6,           // سقف أمان للجولات
  ROUND_MIN: 120,          // دقائق محاكاة بين كل مرور وآخر (ساعتان)
  STEP_MIN: 6,             // دقائق بين كل حاوية وأخرى في نفس الجولة
  DAY_START: 5 * 60 + 30,  // بداية اليوم 05:30
  SPEEDS: [1, 2, 4],
};

/* ─────────── نقاط المسار (حلقة) ─────────── */
const WP = [
  {x:110,y:120}, {x:300,y:120}, {x:490,y:120}, {x:680,y:120},
  {x:680,y:300}, {x:680,y:430},
  {x:490,y:430}, {x:300,y:430}, {x:110,y:430},
  {x:110,y:300},
];
const DEPOT_WP = 0; // المستودع (انطلاق الشاحنة)

/* ─────────── الحاويات وسيناريوهاتها ───────────
   كل حاوية مربوطة بنقطة مسار، ولها سيناريو مكتوب لكل جولة.
   أنواع الرصد: dirty(+ثقة) | clean | obstructed | legal | nothing            */
const CONTAINERS = [
  { id:"C1", wp:1, name:"شارع الأمير — حي ١",
    script:{1:{t:"dirty",c:0.91}, 2:{t:"clean"}, 3:{t:"clean"}},
    tale:"المسار المثالي: رصد عالي الثقة → أمر عمل → مروران نظيفان → إغلاق موثّق." },

  { id:"C2", wp:3, name:"ميدان الحديقة — حي ٢",
    script:{1:{t:"dirty",c:0.88}, 2:{t:"dirty",c:0.80}, 3:{t:"clean"}, 4:{t:"clean"}},
    tale:"إفادة الفريق لا تُغلق البلاغ: بقيت مخلفات في المرور التالي → إعادة عمل، ثم إغلاق بعد التحقق." },

  { id:"C3", wp:5, name:"طريق السوق — حي ٣",
    script:{1:{t:"dirty",c:0.90}, 2:{t:"obstructed"}, 3:{t:"clean"}, 4:{t:"clean"}},
    tale:"المشهد محجوب بمركبة واقفة → حالة «غير مؤكد» تمنع الإغلاق، ويُعاد الرصد." },

  { id:"C4", wp:6, name:"ممشى الكورنيش — حي ٤",
    script:{1:{t:"dirty",c:0.72}, 2:{t:"clean"}, 3:{t:"clean"}},
    tale:"ثقة متوسطة → القرار للمشغّل، فيعتمد أمر العمل، ثم يُغلق بعد التحقق." },

  { id:"C5", wp:7, name:"زاوية المدرسة — حي ٥",
    script:{1:{t:"dirty",c:0.48}, 2:{t:"clean"}},
    tale:"ثقة منخفضة → لا يُرسل طاقم، ويُعاد الرصد — تجنّب زيارة مهدورة." },

  { id:"C6", wp:9, name:"محطة الحاويات — حي ٦",
    script:{1:{t:"legal"}, 2:{t:"clean"}},
    tale:"إخراج نظامي للنفايات في موعد الجمع → فئة سلبية، لا مخالفة ولا أمر عمل." },
];

/* ─────────── الحالة العامة ─────────── */
let S;
function freshState(){
  return {
    running:false, speed:1, round:0,
    dist:0, prevFire:-1, firedThisRound:new Set(),
    pendingStep:false,
    reports:{},          // بحسب معرّف الحاوية
    contState:{},        // حالة بصرية لكل حاوية على الخريطة
    citizenPending:null,
    kpis:{ open:0, closed:0, rework:0, uncertain:0, review:0, neg:0, avoided:0, merged:0, vttcList:[] },
    finished:false,
  };
}

/* ─────────── أدوات المسار ─────────── */
let ROUTE;
function buildRoute(points){
  const segs=[]; let total=0;
  for(let i=0;i<points.length;i++){
    const a=points[i], b=points[(i+1)%points.length];
    const len=Math.hypot(b.x-a.x,b.y-a.y);
    segs.push({a,b,len,start:total}); total+=len;
  }
  // مسافة كل نقطة على المسار = بداية القطعة الخارجة منها
  const wpDist = points.map((_,i)=> segs[i].start);
  return {segs,total,wpDist};
}
function posAt(d){
  d = ((d % ROUTE.total)+ROUTE.total)%ROUTE.total;
  for(const s of ROUTE.segs){
    if(d <= s.start+s.len){
      const t=(d-s.start)/s.len;
      return {x:s.a.x+(s.b.x-s.a.x)*t, y:s.a.y+(s.b.y-s.a.y)*t, seg:s, t};
    }
  }
  const last=ROUTE.segs[ROUTE.segs.length-1];
  return {x:last.b.x,y:last.b.y,seg:last,t:1};
}

/* ─────────── ساعة المحاكاة ─────────── */
function stampFor(round, wpIndex){
  return CFG.DAY_START + (round-1)*CFG.ROUND_MIN + wpIndex*CFG.STEP_MIN;
}
function fmtClock(mins){
  const m=((mins%1440)+1440)%1440;
  const hh=String(Math.floor(m/60)).padStart(2,"0");
  const mm=String(m%60).padStart(2,"0");
  return `${hh}:${mm}`;
}
function dayOf(mins){ return Math.floor(mins/1440)+1; }
function fmtDur(mins){
  if(mins<60) return `${Math.round(mins)}د`;
  const h=Math.floor(mins/60), m=Math.round(mins%60);
  return m? `${h}س ${m}د` : `${h}س`;
}

/* ════════════════════════════════════════════════════════════════
   رسم الخريطة (SVG)
   ════════════════════════════════════════════════════════════════ */
const SVGNS="http://www.w3.org/2000/svg";
const mapEl=document.getElementById("map");
let truckEl, scanEl, routeDoneEl;

function el(tag,attrs){ const e=document.createElementNS(SVGNS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }

function drawMap(){
  mapEl.innerHTML="";
  // مربّعات المباني (زينة)
  const blocks=[[40,40,150,110],[220,40,160,110],[410,40,160,110],[600,40,150,110],
                [40,160,150,130],[600,160,150,130],
                [40,300,150,180],[220,300,160,180],[410,300,160,180],[600,300,150,180],
                [220,160,350,130]];
  blocks.forEach(b=>mapEl.appendChild(el("rect",{x:b[0],y:b[1],width:b[2],height:b[3],rx:8,class:"block"})));

  // الشوارع تحت المسار
  const streetPts = WP.map(p=>`${p.x},${p.y}`).join(" ") + ` ${WP[0].x},${WP[0].y}`;
  mapEl.appendChild(el("polyline",{points:streetPts,class:"street"}));

  // المسار (منقّط)
  mapEl.appendChild(el("polyline",{points:streetPts,class:"route"}));
  // المسار المقطوع (يُرسم فوقه تقدّم الشاحنة)
  routeDoneEl = el("path",{d:"",class:"route-done"});
  mapEl.appendChild(routeDoneEl);

  // المستودع
  const dp=WP[DEPOT_WP];
  mapEl.appendChild(el("rect",{x:dp.x-16,y:dp.y-16,width:32,height:32,rx:7,class:"depot"}));
  const dt=el("text",{x:dp.x,y:dp.y+30,class:"cont-label"}); dt.textContent="المستودع"; mapEl.appendChild(dt);

  // الحاويات
  CONTAINERS.forEach(c=>{
    const p=WP[c.wp];
    const pulse=el("circle",{cx:p.x,cy:p.y,r:16,fill:"var(--orange)",class:"cont-pulse",id:`pulse-${c.id}`,opacity:0});
    mapEl.appendChild(pulse);
    const node=el("circle",{cx:p.x,cy:p.y,r:12,class:"cont-base",fill:"var(--teal)",id:`node-${c.id}`});
    mapEl.appendChild(node);
    const lbl=el("text",{x:p.x,y:p.y-20,class:"cont-label"}); lbl.textContent=c.id; mapEl.appendChild(lbl);
  });

  // حلقة المسح + الشاحنة
  scanEl=el("circle",{cx:dp.x,cy:dp.y,r:14,class:"scan-ring"});
  mapEl.appendChild(scanEl);
  truckEl=buildTruck();
  mapEl.appendChild(truckEl);
  updateTruck();
}

function buildTruck(){
  const g=el("g",{class:"truck",id:"truck"});
  g.appendChild(el("rect",{x:-18,y:-11,width:36,height:22,rx:5,fill:"var(--navy)"}));
  g.appendChild(el("rect",{x:8,y:-11,width:12,height:22,rx:4,fill:"var(--teal)"})); // المقصورة
  g.appendChild(el("circle",{cx:-9,cy:12,r:4,fill:"#2a2a2a"}));
  g.appendChild(el("circle",{cx:9,cy:12,r:4,fill:"#2a2a2a"}));
  // ثلاث كاميرات
  [[-12,-14],[0,-14],[12,-14]].forEach(c=>g.appendChild(el("circle",{cx:c[0],cy:c[1],r:2.4,fill:"var(--focus)"})));
  return g;
}

function updateTruck(){
  const pos=posAt(S.dist);
  truckEl.setAttribute("transform",`translate(${pos.x},${pos.y})`);
  scanEl.setAttribute("cx",pos.x); scanEl.setAttribute("cy",pos.y);
  // رسم الجزء المقطوع من المسار
  const n=Math.max(2,Math.floor(S.dist/6));
  let d="";
  for(let i=0;i<=n;i++){ const pp=posAt(i*6); d+=(i===0?"M":"L")+pp.x+" "+pp.y+" "; }
  routeDoneEl.setAttribute("d",d);
}

function setNodeState(id, state){
  S.contState[id]=state;
  const node=document.getElementById(`node-${id}`);
  const map={clean:"var(--teal)",dirty:"var(--orange)",work:"var(--amber)",
             verify:"var(--blue)",closed:"var(--green)",uncertain:"var(--slate)",
             review:"#5E35B1",legal:"var(--slate)"};
  if(node) node.setAttribute("fill", map[state]||"var(--teal)");
}

function pingNode(id){
  const pulse=document.getElementById(`pulse-${id}`);
  if(!pulse) return;
  pulse.setAttribute("fill", getComputedStyle(document.getElementById(`node-${id}`)).fill);
  pulse.style.animation="none"; void pulse.offsetWidth; pulse.style.animation="";
}

/* ════════════════════════════════════════════════════════════════
   الكاميرات + مشهد بوابة الثقة
   ════════════════════════════════════════════════════════════════ */
const camsEl=document.getElementById("cams");
const CAMS=[
  {id:"CAM-01",name:"الطريق"},
  {id:"CAM-02",name:"النظافة"},
  {id:"CAM-03",name:"الإنارة"},
];
function buildCams(){
  camsEl.innerHTML="";
  CAMS.forEach((c,i)=>{
    const d=document.createElement("div"); d.className="cam"; d.id=`cam-${i}`;
    d.innerHTML=`
      <div class="cam-top"><span class="cam-id">${c.id}</span>
        <span class="cam-rec"><i></i> مراقبة</span></div>
      <div class="cam-view" id="view-${i}">${sceneSVG(i==1?"clean":"road")}</div>
      <div class="cam-name">${c.name}</div>`;
    camsEl.appendChild(d);
  });
}
function setCam(i, sceneType, det){
  const v=document.getElementById(`view-${i}`);
  if(!v) return;
  v.innerHTML = sceneSVG(sceneType, det);
  const cam=document.getElementById(`cam-${i}`);
  cam.classList.toggle("active", !!det);
}

/* مشاهد كاميرا مبسّطة (SVG) */
function sceneSVG(type, det){
  const sky=`<rect width="200" height="150" fill="#0a3b47"/>
             <rect y="95" width="200" height="55" fill="#0e4c58"/>`;
  const container=`<rect x="76" y="58" width="48" height="42" rx="4" fill="#2f6b73"/>
                   <rect x="76" y="54" width="48" height="8" rx="3" fill="#24565d"/>`;
  const blur=`<text x="100" y="18" fill="#8FCFC8" font-size="8" text-anchor="middle">تعتيم الأشخاص واللوحات قبل الحفظ</text>`;
  let body="";
  if(type==="road"){
    body=`<rect x="20" y="110" width="160" height="6" rx="3" fill="#2a5b63"/>
          <rect x="60" y="120" width="30" height="4" rx="2" fill="#2a5b63"/>
          <text x="100" y="80" fill="#6fb3ad" font-size="9" text-anchor="middle">المسار سالك</text>`;
  } else if(type==="light"){
    body=`<line x1="100" y1="30" x2="100" y2="70" stroke="#2a5b63" stroke-width="4"/>
          <circle cx="100" cy="30" r="10" fill="#ffd56b" opacity=".85"/>
          <text x="100" y="120" fill="#6fb3ad" font-size="9" text-anchor="middle">الإنارة تعمل</text>`;
  } else if(type==="clean"){
    body=`${container}<circle cx="100" cy="118" r="18" fill="#1d5a52" opacity=".4"/>
          <text x="100" y="135" fill="#7fd3ca" font-size="9" text-anchor="middle">محيط نظيف</text>`;
  } else if(type==="dirty"){
    body=`${container}
          <ellipse cx="60" cy="104" rx="13" ry="7" fill="#b9792f"/>
          <ellipse cx="140" cy="106" rx="15" ry="8" fill="#a8702c"/>
          <circle cx="70" cy="96" r="5" fill="#c98a3d"/><circle cx="132" cy="94" r="6" fill="#c98a3d"/>
          <rect x="88" y="100" width="24" height="10" rx="3" fill="#b9792f"/>`;
  } else if(type==="obstructed"){
    body=`${container}
          <rect x="30" y="86" width="70" height="30" rx="7" fill="#394a52"/>
          <circle cx="48" cy="118" r="7" fill="#1c262b"/><circle cx="86" cy="118" r="7" fill="#1c262b"/>
          <text x="100" y="135" fill="#9fb3ba" font-size="9" text-anchor="middle">مركبة تحجب المشهد</text>`;
  } else if(type==="legal"){
    body=`${container}
          <rect x="56" y="92" width="18" height="18" rx="3" fill="#3a6b5f"/>
          <rect x="126" y="92" width="18" height="18" rx="3" fill="#3a6b5f"/>
          <text x="100" y="135" fill="#7fd3ca" font-size="8" text-anchor="middle">إخراج نظامي · موعد الجمع</text>`;
  }
  let overlay="";
  if(det){
    overlay=`<rect x="50" y="52" width="100" height="56" class="det-box"/>
             <rect x="50" y="34" width="100" height="17" rx="3" class="det-tag-bg"/>
             <text x="100" y="46" class="det-tag">مخلفات ${(det.c*100).toFixed(0)}%</text>`;
  }
  return `<svg viewBox="0 0 200 150">${sky}${body}${overlay}${type==='dirty'||type==='clean'||type==='obstructed'||type==='legal'?blur:''}</svg>`;
}

/* بوابة الثقة */
const needleEl=document.getElementById("needle");
const gateSceneEl=document.getElementById("gateScene");
const gateVerdictEl=document.getElementById("gateVerdict");
function showGate(c, sceneType, verdict, cls){
  needleEl.style.insetInlineStart = `calc(${(c*100).toFixed(1)}% - 2px)`;
  gateSceneEl.innerHTML = `<div><div class="gate-conf" style="color:${cls==='v-high'?'var(--green)':cls==='v-mid'?'var(--amber)':'var(--orange)'}">${c.toFixed(2)}</div>
     <div style="font-size:.78rem;color:var(--muted)">درجة ثقة الرصد</div></div>`;
  gateVerdictEl.textContent=verdict;
  gateVerdictEl.className="gate-verdict "+(cls||"");
}
function gateIdle(){
  needleEl.style.insetInlineStart="-4px";
  gateSceneEl.innerHTML=`<div class="gate-idle">بانتظار رصد…</div>`;
  gateVerdictEl.textContent="—"; gateVerdictEl.className="gate-verdict";
}

/* ════════════════════════════════════════════════════════════════
   السجل + المؤشرات + البلاغات
   ════════════════════════════════════════════════════════════════ */
const logEl=document.getElementById("log");
function log(mins, msg, kind="info"){
  const line=document.createElement("div");
  line.className="logline "+kind;
  line.innerHTML=`<span class="t">${fmtClock(mins)}</span><span class="m">${msg}</span>`;
  logEl.prepend(line);
  while(logEl.children.length>60) logEl.lastChild.remove();
}

const tickerText=document.getElementById("tickerText");
function say(msg){ tickerText.textContent=msg; }

function renderKPIs(){
  const k=S.kpis;
  const avg = k.vttcList.length ? fmtDur(k.vttcList.reduce((a,b)=>a+b,0)/k.vttcList.length) : "—";
  const defs=[
    ["k-open",k.open,"بلاغات مفتوحة"],
    ["k-closed",k.closed,"مغلق موثّق"],
    ["k-rework",k.rework,"إعادة عمل"],
    ["k-uncertain",k.uncertain,"غير مؤكد"],
    ["k-review",k.review,"مراجعة مشغّل"],
    ["k-vttc",avg,"متوسط vTTC"],
  ];
  document.getElementById("kpis").innerHTML = defs.map(d=>
    `<div class="kpi ${d[0]}"><div class="v">${d[1]}</div><div class="l">${d[2]}</div></div>`).join("");
}

const BADGE={
  WORK_ORDER:["b-work","أمر عمل"], OPERATOR:["b-review","مراجعة مشغّل"],
  VERIFYING:["b-verify","قيد التحقق"], REWORK:["b-rework","إعادة عمل"],
  UNCERTAIN:["b-uncertain","غير مؤكد"], CLOSED:["b-closed","مغلق موثّق"],
};
function renderReports(){
  const box=document.getElementById("reports");
  const list=Object.values(S.reports).sort((a,b)=>a.created-b.created);
  document.getElementById("reportsCount").textContent=list.length;
  if(!list.length){ box.innerHTML=`<p class="empty">لا توجد بلاغات بعد — شغّل المحاكاة.</p>`; return; }
  box.innerHTML=list.map(r=>{
    const bd=BADGE[r.state]||["b-work",r.state];
    let dots="";
    if(["VERIFYING","CLOSED","REWORK","UNCERTAIN"].includes(r.state)){
      for(let i=0;i<CFG.CLEAN_NEEDED;i++) dots+=`<span class="vdot ${i<r.cleanObs?'on':''}"></span>`;
      dots=`<span class="dots" title="مشاهدات نظيفة">${dots}</span>`;
    }
    const vttc = r.state==="CLOSED" ? `<span class="merge-chip">vTTC ${fmtDur(r.vttc)}</span>` : "";
    const merge = r.merged ? `<span class="merge-chip">+${r.merged} بلاغ مواطن</span>` : "";
    return `<div class="rep">
      <div class="rep-top"><span class="rep-loc">${r.name}</span><span class="badge ${bd[0]}">${bd[1]}</span></div>
      <div class="rep-meta"><span class="rep-id">${r.id}</span>
        <span>ثقة ${r.conf.toFixed(2)}</span>${dots}${vttc}${merge}</div>
    </div>`;
  }).join("");
}

/* ════════════════════════════════════════════════════════════════
   محرك الحالات — المنطق الجوهري
   ════════════════════════════════════════════════════════════════ */
function handleObservation(c, round){
  const obs = (c.script[round]) || {t:"nothing"};
  const wpi = c.wp;
  const now = stampFor(round, wpi);
  updateClock(now);

  // عرض الكاميرات: CAM-02 (النظافة) هي المعنية بالرصد
  pingNode(c.id);
  const isDet = obs.t==="dirty";
  setCam(0,"road"); setCam(2,"light");
  setCam(1, obs.t==="nothing" ? "clean" : obs.t, isDet?{c:obs.c}:null);
  if(isDet) showGateFor(obs.c);
  else gateIdle();

  let rep = S.reports[c.id];

  // ─── رصد تراكم ───
  if(obs.t==="dirty"){
    if(!rep || rep.state==="CLOSED"){
      // رصد جديد → بوابة الثقة
      if(obs.c >= CFG.THR_HIGH){
        rep = createReport(c, obs.c, now, "WORK_ORDER");
        setNodeState(c.id,"work");
        log(now, `🟡 ${c.name}: رصد ثقة ${obs.c.toFixed(2)} ≥ 0.85 → <b>أمر عمل تلقائي</b> (${rep.id})`, "warn");
        say(`${c.name}: ثقة عالية — أُنشئ أمر عمل تلقائيًا دون تدخل بشري.`);
      } else if(obs.c >= CFG.THR_LOW){
        rep = createReport(c, obs.c, now, "OPERATOR");
        setNodeState(c.id,"review");
        log(now, `🟣 ${c.name}: ثقة ${obs.c.toFixed(2)} (متوسطة) → بانتظار اعتماد المشغّل (${rep.id})`, "info");
        say(`${c.name}: ثقة متوسطة — القرار للمشغّل.`);
        S.kpis.review++;
        scheduleOperatorDecision(c.id, now);
      } else {
        // ثقة منخفضة — لا إرسال طاقم
        setNodeState(c.id,"dirty");
        S.kpis.avoided++;
        log(now, `⚪ ${c.name}: ثقة ${obs.c.toFixed(2)} < 0.60 → لا يُرسل طاقم، يُعاد الرصد — تجنّب زيارة مهدورة`, "neg");
        say(`${c.name}: ثقة منخفضة — لم يُرسل طاقم، سيُعاد الرصد في مرور لاحق.`);
      }
    } else if(["WORK_ORDER","OPERATOR","VERIFYING","UNCERTAIN","REWORK"].includes(rep.state)){
      // بلاغ قائم وما زال متسخًا
      if(rep.teamClaimedDone){
        // الفريق أفاد بالإنجاز، لكن الشاحنة ترى مخلفات → إعادة عمل
        rep.state="REWORK"; rep.teamClaimedDone=false; rep.cleanObs=0;
        setNodeState(c.id,"dirty"); S.kpis.rework++;
        log(now, `🟠 ${c.name}: الفريق أفاد بالإنجاز لكن بقيت مخلفات → <b>إعادة عمل</b> (لا إغلاق)`, "bad");
        say(`${c.name}: إفادة الفريق لا تُغلق البلاغ — بقيت مخلفات، أُعيد إسناد المهمة.`);
      } else {
        log(now, `🟠 ${c.name}: ما زال التراكم — البلاغ مفتوح`, "warn");
      }
    }
  }

  // ─── مشهد نظيف ───
  else if(obs.t==="clean"){
    setNodeState(c.id, rep && rep.state!=="CLOSED" ? "verify" : "clean");
    if(rep && rep.state!=="CLOSED" && rep.teamClaimedDone){
      rep.cleanObs++;
      if(rep.cleanObs>=CFG.CLEAN_NEEDED){
        closeReport(rep, now);
        setNodeState(c.id,"closed");
      } else {
        rep.state="VERIFYING";
        log(now, `🔵 ${c.name}: مشاهدة نظيفة (${rep.cleanObs}/${CFG.CLEAN_NEEDED}) — زوال التراكم ✓، بانتظار إثبات الاستمرار`, "info");
        say(`${c.name}: رُصد زوال التراكم. التحقق يحتاج مشاهدة نظيفة أخرى قبل الإغلاق.`);
      }
    }
  }

  // ─── مشهد محجوب ───
  else if(obs.t==="obstructed"){
    if(rep && rep.state!=="CLOSED"){
      rep.state="UNCERTAIN"; S.kpis.uncertain++;
      setNodeState(c.id,"uncertain");
      log(now, `⚫ ${c.name}: المشهد محجوب (مركبة واقفة) → <b>غير مؤكد</b>، يُعاد الرصد — لا إغلاق`, "warn");
      say(`${c.name}: لا يمكن التحقق — المشهد محجوب. تأجّل القرار إلى المرور التالي.`);
    }
  }

  // ─── إخراج نظامي (فئة سلبية) ───
  else if(obs.t==="legal"){
    setNodeState(c.id,"legal"); S.kpis.neg++;
    setCam(1,"legal");
    log(now, `🟩 ${c.name}: إخراج نظامي للنفايات في موعد الجمع → فئة سلبية، لا مخالفة`, "neg");
    say(`${c.name}: النظام ميّز الإخراج النظامي للنفايات — لا يُعدّ مخالفة ولا يُنشأ أمر عمل.`);
  }

  renderAll();
}

function createReport(c, conf, now, state){
  const rep={ id:`BLG-${1000+Object.keys(S.reports).length+1}`, cid:c.id, name:c.name,
    conf, created:now, firstDet:now, state, teamClaimedDone:false, cleanObs:0, merged:0, vttc:null };
  S.reports[c.id]=rep;
  recountOpen();
  return rep;
}
function closeReport(rep, now){
  rep.state="CLOSED"; rep.closed=now; rep.vttc=now-rep.firstDet;
  S.kpis.closed++; S.kpis.vttcList.push(rep.vttc);
  recountOpen();
  log(now, `✅ ${rep.name}: تحقق الشروط الثلاثة → <b>مغلق موثّق</b> · vTTC = ${fmtDur(rep.vttc)}`, "ok");
  say(`${rep.name}: أُغلق البلاغ بالدليل بعد تحقق آلي — زمن التنظيف المؤكَّد ${fmtDur(rep.vttc)}.`);
}
function recountOpen(){
  S.kpis.open = Object.values(S.reports).filter(r=>r.state!=="CLOSED").length;
}

/* قرار المشغّل (محاكاة اعتماد بعد لحظة) */
function scheduleOperatorDecision(cid, now){
  setTimeout(()=>{
    const rep=S.reports[cid];
    if(rep && rep.state==="OPERATOR"){
      rep.state="WORK_ORDER";
      setNodeState(cid,"work");
      log(now+2, `🟡 ${rep.name}: المشغّل اعتمد الأمر → تحوّل إلى <b>أمر عمل</b> (${rep.id})`, "warn");
      renderAll();
    }
  }, 1400/Math.max(1,S.speed));
}

/* بين الجولات: الفريق يستجيب (يفيد بالإنجاز) — لكنه لا يُغلق البلاغ */
function teamResponds(round){
  Object.values(S.reports).forEach(rep=>{
    if(["WORK_ORDER","REWORK","UNCERTAIN","VERIFYING"].includes(rep.state)){
      rep.teamClaimedDone=true;
      if(rep.state==="REWORK"){
        log(stampFor(round,0)-5, `🔧 ${rep.name}: أُعيد إسناد المهمة وأفاد الفريق بالمعالجة — بانتظار تحقق الشاحنة`, "info");
      }
    }
  });
}

/* بلاغ مواطن — يُدمج مع رصد قائم لنفس الموقع (دمج التكرار) */
function injectCitizen(){
  const open=Object.values(S.reports).filter(r=>r.state!=="CLOSED");
  const now=stampFor(Math.max(1,S.round), 4)+3;
  updateClock(now);
  if(open.length){
    const rep=open[Math.floor(Math.random()*open.length)];
    rep.merged=(rep.merged||0)+1; S.kpis.merged++;
    log(now, `📣 بلاغ مواطن عن «${rep.name}» → <b>دُمج</b> في الحدث القائم ${rep.id} (لا تكرار)`, "info");
    say(`بلاغ مواطن عن موقع قيد المعالجة — دُمج تلقائيًا في البلاغ القائم بدل إنشاء بلاغ جديد.`);
  } else {
    log(now, `📣 بلاغ مواطن جديد → يُحال للمراجعة الفنية (لا رصد سابق للموقع)`, "info");
    say(`بلاغ مواطن جديد لا يقابله رصد من الشاحنة — يُحال للمراجعة الفنية.`);
  }
  renderAll();
}

/* ════════════════════════════════════════════════════════════════
   حلقة التشغيل
   ════════════════════════════════════════════════════════════════ */
let raf=null, lastT=0;
const BASE_SPEED=78; // بكسل/ثانية عند ×1

function startLoop(){
  if(raf) return;
  lastT=performance.now();
  const frame=(t)=>{
    const dt=Math.min(0.05,(t-lastT)/1000); lastT=t;
    if(S.running){ advance(dt*BASE_SPEED*S.speed); }
    raf=requestAnimationFrame(frame);
  };
  raf=requestAnimationFrame(frame);
}

function advance(delta){
  if(S.round===0) beginRound(1);
  const before=S.dist;
  S.dist+=delta;

  // إطلاق رصد الحاويات التي عبرتها الشاحنة هذه الجولة
  CONTAINERS.forEach(c=>{
    const cd=ROUTE.wpDist[c.wp];
    if(!S.firedThisRound.has(c.id) && S.dist>=cd){
      S.firedThisRound.add(c.id);
      handleObservation(c, S.round);
      if(S.pendingStep){ S.pendingStep=false; S.running=false; updatePlayBtn(); }
    }
  });

  // اكتمال الجولة؟
  if(S.dist>=ROUTE.total){
    S.dist-=ROUTE.total;
    finishRound();
  }
  updateTruck();
  updateHeader();
}

function beginRound(r){
  S.round=r; S.firedThisRound.clear();
  if(r>1) teamResponds(r);
  log(stampFor(r,0), `🚛 بدء الجولة ${r} — انطلاق الشاحنة من المستودع`, "info");
  say(`الجولة ${r}: الشاحنة تبدأ مرورها المعتاد للرصد والتحقق.`);
}

function finishRound(){
  const done = Object.values(S.reports).every(r=>r.state==="CLOSED");
  const anyReports = Object.keys(S.reports).length>0;
  const noMoreScript = S.round>=4;
  if((anyReports && done && noMoreScript) || S.round>=CFG.MAX_ROUNDS){
    S.running=false; S.finished=true; updatePlayBtn();
    const now=stampFor(S.round,10);
    log(now, `🏁 اكتملت المحاكاة — كل البلاغات أُغلقت بعد التحقق`, "ok");
    const avg = S.kpis.vttcList.length ? fmtDur(S.kpis.vttcList.reduce((a,b)=>a+b,0)/S.kpis.vttcList.length):"—";
    say(`اكتملت الجولات ✅ — ${S.kpis.closed} بلاغًا أُغلق بالدليل، متوسط زمن التنظيف المؤكَّد ${avg}. اضغط «إعادة» للتكرار.`);
    return;
  }
  beginRound(S.round+1);
}

/* ─────────── واجهة الرأس ─────────── */
function updateClock(mins){ S.simClock=mins; }
function updateHeader(){
  const now = S.simClock ?? CFG.DAY_START;
  document.getElementById("simClock").textContent=fmtClock(now);
  document.getElementById("dayNum").textContent=dayOf(now);
  document.getElementById("roundNum").textContent=S.round;
}
function showGateFor(c){
  if(c>=CFG.THR_HIGH) showGate(c,"dirty","ثقة عالية → أمر عمل تلقائي","v-high");
  else if(c>=CFG.THR_LOW) showGate(c,"dirty","ثقة متوسطة → قرار المشغّل","v-mid");
  else showGate(c,"dirty","ثقة منخفضة → لا طاقم، إعادة رصد","v-low");
}

function renderAll(){ renderKPIs(); renderReports(); updateHeader(); }

/* ════════════════════════════════════════════════════════════════
   الأزرار
   ════════════════════════════════════════════════════════════════ */
const btnPlay=document.getElementById("btnPlay");
function updatePlayBtn(){ btnPlay.textContent = S.running ? "⏸ إيقاف" : (S.finished?"▶ تشغيل":"▶ تشغيل"); }

btnPlay.onclick=()=>{
  if(S.finished) resetSim();
  S.running=!S.running; S.pendingStep=false; updatePlayBtn();
  if(S.running) say("المحاكاة تعمل…");
};
document.getElementById("btnStep").onclick=()=>{
  if(S.finished) return;
  S.pendingStep=true; S.running=true; updatePlayBtn();
  say("خطوة واحدة — إلى الرصد التالي.");
};
document.getElementById("btnSpeed").onclick=(e)=>{
  const i=CFG.SPEEDS.indexOf(S.speed);
  S.speed=CFG.SPEEDS[(i+1)%CFG.SPEEDS.length];
  e.target.textContent=`السرعة ×${S.speed}`;
};
document.getElementById("btnCitizen").onclick=injectCitizen;
document.getElementById("btnReset").onclick=resetSim;
document.getElementById("btnFull").onclick=()=>{
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

function resetSim(){
  S=freshState();
  logEl.innerHTML=""; gateIdle();
  drawMap(); buildCams(); renderAll();
  CONTAINERS.forEach(c=>setNodeState(c.id,"clean"));
  updatePlayBtn();
  say("جاهز. اضغط «تشغيل» لتبدأ جولة الشاحنة من الرصد إلى الإغلاق الموثّق.");
}

/* ════════════════════════════════════════════════════════════════
   الإقلاع
   ════════════════════════════════════════════════════════════════ */
ROUTE=buildRoute(WP);
resetSim();
startLoop();

})();
