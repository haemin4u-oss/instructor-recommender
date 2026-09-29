/* ==========================================================================
   FACTORY DECISION LAB — Game (Control Room UI)
   NOTICE → EXPLORE → HYPOTHESIZE → DECIDE → EXPERIENCE CONSEQUENCE → REASSESS
   ========================================================================== */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = FDL.escape;
  var r1 = FDL.util.r1;

  var MENUS = [
    { id: 'dashboard', label: 'Dashboard', ico: '▦' },
    { id: 'process', label: 'Process', ico: '⇶' },
    { id: 'quality', label: 'Quality', ico: '◎' },
    { id: 'equipment', label: 'Equipment', ico: '⚙' },
    { id: 'production', label: 'Production', ico: '▤' },
    { id: 'material', label: 'Material', ico: '◫' },
    { id: 'people', label: 'People', ico: '☺' },
    { id: 'history', label: 'History', ico: '↺' }
  ];

  var NODES = [
    { id: 'raw', step: 'INPUT', name: '원자재' },
    { id: 'A', step: 'PROCESS A', name: 'Solder Paste 인쇄', eq: ['PR-01'] },
    { id: 'B', step: 'PROCESS B', name: '부품 실장', eq: ['MT-01', 'MT-02'] },
    { id: 'C', step: 'PROCESS C', name: 'Reflow', eq: FDL.EQUIPMENT },
    { id: 'insp', step: 'INSPECTION', name: '최종검사', eq: ['AOI-01', 'XR-01'] },
    { id: 'ship', step: 'OUTPUT', name: '출하' }
  ];

  var G = {
    cfg: FDL.loadConfig(),
    phase: 'brief',
    team: '',
    log: [],
    evidence: {},
    hypotheses: [],
    fired: {},
    queue: [],
    modalOpen: null,
    paused: false,
    gameSec: 0,
    view: 'dashboard',
    sub: {},
    lastKpiLog: null,
    final: null
  };
  G.model = new FDL.Model(G.cfg);
  G.analyst = new FDL.Analyst(G);
  window.FDL_GAME = G;

  /* ---------------- 공통 ---------------- */
  function now() { return Math.floor(G.model.s.t); }
  function clock() { return G.model.clock(); }
  function log(type, label, data, key) {
    var e = { t: now(), clock: clock(), type: type, label: label, key: key || null, data: data || null };
    G.log.push(e);
    return e;
  }
  function see(key, label) {
    if (!key) return;
    if (G.evidence[key] == null) {
      G.evidence[key] = now();
      log('view', label || key, null, key);
    }
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function fmtPct(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function lvlSpan(l) { return '<span class="lvl ' + l + '">' + l + '</span>'; }
  function locked(msg) { return '<div class="card lock-card"><div class="l-ico">🔒</div><div>' + esc(msg) + '</div></div>'; }
  function hiddenCard(label) { return '<div class="card lock-card"><div class="l-ico">⊘</div><div>' + esc(label) + ' — 이번 세션에서는 제공되지 않는 데이터입니다.</div></div>'; }
  function vis(id) { return FDL.isVisible(G.cfg, id); }

  G.changeLog = function () {
    var rows = [
      { when: '그제 08:00', cat: 'Man', item: '실장 Lane2(MT-02) 주간조 신규 작업자 김OO 배치 (OJT 2주차)' },
      { when: '그제 16:00', cat: 'Method', item: 'AOI-01 검사 프로그램 v3.1 → v3.2 (부품 라이브러리 업데이트)' },
      { when: '어제 09:00', cat: 'Material', item: 'PCB Lot 변경 PCB-0913 → PCB-0920 (동일 사양)' },
      { when: '어제 13:30', cat: 'Method', item: 'Reflow 레시피 PM220_RF Rev.C → Rev.D 전 설비 배포 (PCN-0917 신규 Paste 대응, Soak +5°C)' },
      { when: '어제 14:00', cat: 'Material', item: 'Solder Paste Lot 변경 SP-0911A → SP-0925B' },
      { when: '어제 19:30', cat: 'Environment', item: 'SMT동 공조 습도 설정 50% → 55%RH' },
      { when: '오늘 07:10', cat: 'Machine', item: 'MT-02 Head 3 Nozzle 교체 (정기)' }
    ];
    return rows;
  };
  G.line3Text = function () {
    return G.cfg.rootCause.material
      ? 'Line 3 (동일 Solder Paste Lot SP-0925B 를 오늘 06:00부터 사용, Reflow 설비는 별도 기종)에서 Solder Bridge/Void 불량이 1.8% → 3.3%로 증가했습니다. Line 3 의 레시피는 Rev.D 입니다.'
      : 'Line 3 에서 불량 증가 보고가 있었으나 X-ray 재판정 결과 AOI 오검출(False Call)로 확인되었습니다. 실불량률은 1.9%로 평시 수준입니다. (Line 3 도 SP-0925B 사용 중)';
  };

  /* ---------------- 브리핑 ---------------- */
  function renderBrief() {
    var c = G.cfg, d = FDL.DIFFICULTY[c.difficulty] || FDL.DIFFICULTY.NORMAL;
    var src = { link: '강사 배포 링크 설정 적용', instructor: '강사 모드 저장 설정 적용', default: '기본 케이스' }[c._source];
    $('#fullpage').innerHTML =
      '<div class="fp-inner"><div class="brief-hero"><div>' +
      '<div class="eyebrow">INTERACTIVE CASE SIMULATION · 전자부품 제조</div>' +
      '<h1>FACTORY DECISION LAB</h1>' +
      '<p class="role">당신은 오늘 <b>' + esc(c.caseName.split('—')[0].trim()) + '</b>의 라인 책임자입니다.</p>' +
      '<p class="muted">09:00, 정상적으로 운영되던 생산라인에서 예상하지 못한 문제가 발생합니다. 제한된 시간과 불완전한 정보 속에서 상황을 파악하고, 판단하고, 그 결과에 대응하십시오.</p>' +
      '<div class="cycle"><span>NOTICE</span><span>→ EXPLORE</span><span>→ HYPOTHESIZE</span><span>→ DECIDE</span><span>→ CONSEQUENCE</span><span>→ REASSESS</span></div>' +
      '<ul class="rules">' +
      '<li>하나의 명확한 정답은 없습니다. 모든 데이터가 처음부터 공개되지도 않습니다.</li>' +
      '<li>왼쪽 메뉴와 공정 Map, <b>AI Manufacturing Analyst</b> 로 직접 데이터를 탐색하십시오.</li>' +
      '<li>원인 후보는 <b>Hypothesis Board</b> 에 기록하고, 근거와 상태를 갱신하십시오.</li>' +
      '<li>충분하다고 판단되면 언제든 하단 <b>DECISION</b> 을 실행하십시오. 선택에는 Trade-off 가 따릅니다.</li>' +
      '<li>시간이 흐르면 새로운 상황이 발생합니다. 완벽한 정보가 아닌, 충분한 정보로 판단하십시오.</li>' +
      '</ul></div>' +
      '<div class="card"><h3>SESSION</h3>' +
      '<div class="kv" style="margin-bottom:12px"><div><div class="k">Case</div><div class="v" style="font-size:13px">' + esc(FDL.CASE_PRESETS[c.caseId] ? FDL.CASE_PRESETS[c.caseId].name.split('·')[0] : c.caseId) + '</div></div>' +
      '<div><div class="k">난이도</div><div class="v">' + esc(d.label) + '</div></div>' +
      '<div><div class="k">제한시간</div><div class="v">' + c.timeLimitMin + '분</div></div>' +
      '<div><div class="k">시작 시각</div><div class="v">' + esc(c.startClock) + '</div></div></div>' +
      '<div class="field"><label for="teamName">팀 / 교육생 이름 <span class="req">*</span></label><input type="text" id="teamName" placeholder="예: 3조 / 홍길동" maxlength="30"></div>' +
      '<p class="note muted" style="font-size:12px">설정: ' + esc(src) + (c.speed !== 1 ? ' · 진행속도 ×' + c.speed : '') + '</p>' +
      '<button class="btn primary lg" id="startBtn" style="width:100%;margin-top:6px">근무 시작 (09:00)</button>' +
      '<p class="muted" style="font-size:12px;margin-top:10px">강사용 설정은 <a href="admin.html">Instructor Mode</a> 에서 변경할 수 있습니다.</p>' +
      '</div></div></div>';
    $('#fullpage').classList.remove('hidden');
    var inp = $('#teamName');
    inp.value = FDL.store.get('fdl.lastTeam', '') || '';
    $('#startBtn').onclick = function () {
      var v = inp.value.trim();
      if (!v) { inp.focus(); toast('팀 / 교육생 이름을 입력하십시오.'); return; }
      G.team = v; FDL.store.set('fdl.lastTeam', v);
      start();
    };
  }

  /* ---------------- 시작 ---------------- */
  function start() {
    G.phase = 'running';
    G.startedAt = new Date().toISOString();
    $('#fullpage').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#caseName').innerHTML = '<b>' + esc(G.cfg.caseName) + '</b> · ' + esc(G.team);
    G.startRec = JSON.parse(JSON.stringify(G.model.record()));
    G.startSnap = G.model.snapshot();
    G.lastKpiLog = { defect: G.startSnap.defect, delivery: G.startSnap.delivery, customer: G.startSnap.customer };
    log('system', 'Simulation Start — ' + G.team);
    renderNav(); renderKpis(); renderView(); renderChips(); renderHyps();
    aiSay('<p>AI Manufacturing Analyst 입니다. Case 에 정의된 라인 데이터 범위 안에서 분석을 지원합니다.</p><p class="muted">원인 판단과 의사결정은 책임자님의 몫입니다.</p>');
    G.timerStarted = false;
    fireEvent({
      id: 'initial', type: 'QUALITY', major: false, title: '⚠ QUALITY ALERT',
      lines: [clock() + ' 현재 최종검사 공정에서 특정 유형의 불량이 평소 대비 3배 증가했습니다.', '최종검사 불량률 ' + fmtPct(G.startSnap.defect) + '% (평시 ' + G.cfg.effects.base + '%)'],
      onAck: function () { G.timerStarted = true; log('system', 'Timer Start — 상황 대응 개시'); }
    });
    G.lastTick = performance.now();
    G.timer = setInterval(tick, 250);
    window.addEventListener('beforeunload', function (e) { if (G.phase === 'running') { e.preventDefault(); e.returnValue = ''; } });
  }

  /* ---------------- 타이머 ---------------- */
  function tick() {
    var nowMs = performance.now(), dt = (nowMs - G.lastTick) / 1000;
    G.lastTick = nowMs;
    if (G.phase !== 'running' && G.phase !== 'final') return;
    if (!G.timerStarted || G.paused) return;
    var limit = G.cfg.timeLimitMin * 60;
    G.gameSec = Math.min(limit, G.gameSec + dt * (G.cfg.speed || 1));
    while (Math.floor(G.gameSec / 60) > G.model.s.t && G.model.s.t < G.cfg.timeLimitMin) minuteTick();
    renderClock();
    if (G.gameSec >= limit && !G.timeOver) {
      G.timeOver = true;
      log('system', 'TIME OVER — Final Decision 요청');
      openFinal(true);
    }
  }

  function renderClock() {
    var limit = G.cfg.timeLimitMin * 60, rem = Math.max(0, Math.ceil(limit - G.gameSec));
    $('#remain').textContent = String(Math.floor(rem / 60)).padStart(2, '0') + ':' + String(rem % 60).padStart(2, '0');
    $('#remainBox').classList.toggle('low', rem <= 300);
    var p = (G.cfg.startClock || '09:00').split(':');
    var m = Number(p[0]) * 60 + Number(p[1]) + Math.floor(G.gameSec / 60);
    $('#gameClock').textContent = String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  function minuteTick() {
    var M = G.model;
    M.processTasks().forEach(function (ev) { fireEvent({ id: ev.id + '_' + now(), type: ev.type, title: ev.title, lines: ev.lines, major: ev.type === 'MATERIAL' && ev.id === 'stock_out' }); if (ev.id === 'supplier_reply') log('system', '공급사 회신 수신 — Material > PCN 데이터 공개'); if (ev.id.indexOf('inspection_done_') === 0) see('eq.inspect.' + ev.id.slice(16), ev.id.slice(16) + ' 점검 결과 (Profiler 실측) 확인'); });
    M.step(1);
    var rec = M.record();
    var t = now();
    // 시간 이벤트
    G.cfg.events.forEach(function (ev) {
      if (ev.enabled && !G.fired[ev.id] && t >= ev.minute) timedEvent(ev);
    });
    conditionalEvents(rec);
    kpiChangeLog(rec);
    renderKpis();
    if (G.view === 'dashboard' || G.view === 'process') renderView(true);
    if (G.drawerNode) renderDrawer(G.drawerNode, true);
  }

  function kpiChangeLog(rec) {
    var L = G.lastKpiLog;
    if (rec.delivery !== L.delivery) { log('kpi', '납기 Risk ' + L.delivery + ' → ' + rec.delivery); L.delivery = rec.delivery; }
    if (rec.customer !== L.customer) { log('kpi', '고객 Risk ' + L.customer + ' → ' + rec.customer); L.customer = rec.customer; }
    if (Math.abs(rec.defect - L.defect) >= 0.9) {
      log('kpi', '불량률 ' + (rec.defect < L.defect ? '감소 ' : '증가 ') + fmtPct(L.defect) + '% → ' + fmtPct(rec.defect) + '%');
      L.defect = rec.defect;
    }
  }

  /* ---------------- 이벤트 ---------------- */
  function timedEvent(ev) {
    G.fired[ev.id] = true;
    var snap = G.model.snapshot(), c = G.cfg, lines;
    if (ev.message && ev.message.trim()) lines = ev.message.split('\n');
    else if (ev.id === 'defect_rise') {
      lines = snap.defect > 4
        ? [clock() + ' 현재 최종검사 불량률 ' + fmtPct(snap.defect) + '% — Solder Bridge / Void 유형 중심으로 증가세가 이어지고 있습니다.', '품질팀장이 원인 파악 현황과 임시 조치 계획을 문의합니다.']
        : [clock() + ' 현재 최종검사 불량률 ' + fmtPct(snap.defect) + '% — 조치 이후 변화가 관찰됩니다.', '품질팀은 개선이 “일시적”인지 확인할 모니터링 계획을 요청합니다.'];
    } else if (ev.id === 'plan_request') {
      lines = ['생산관리팀: 고객 출하 ' + c.kpi.shipmentTarget.toLocaleString() + 'ea 를 오늘 18:00 까지 충족해야 합니다.',
        '현재 예상 출하 가능 수량 ' + Math.round(snap.projected).toLocaleString() + 'ea (' + Math.round(snap.deliveryRatio * 100) + '%). 생산 계획 조정 여부를 30분 내 회신 요청합니다.'];
    } else if (ev.id === 'customer_inquiry') {
      G.inquiryAt = now();
      lines = G.model.s.commDone
        ? ['고객사 품질팀: 선제 공유에 감사드립니다.', '오늘 17:00 까지 유출 가능 범위와 임시 조치 결과를 중간 보고해 주십시오.']
        : ['고객사 품질팀: 귀사 입고품 수입검사에서 Solder Bridge 불량 2건이 발견되었습니다.', '유출 범위와 조치 계획을 10분 내 회신해 주십시오. (미회신 시 품질 Escalation)'];
    } else if (ev.id === 'other_line') {
      G.model.s.unlocked.line3 = true;
      lines = [G.line3Text(), 'Material 메뉴에서 Line 3 정보를 확인할 수 있습니다.'];
    } else lines = [ev.title];
    fireEvent({ id: ev.id, type: ev.type, title: ev.title, lines: lines, major: true });
  }

  function conditionalEvents(rec) {
    var ce = G.cfg.conditionalEvents || {}, s = G.model.s, t = now();
    if (ce.capacityAlert && !G.fired.capacity && rec.production < 85 && rec.production > 0) {
      G.fired.capacity = true;
      fireEvent({ id: 'capacity', type: 'PRODUCTION', major: true, title: '⚠ PRODUCTION ALERT',
        lines: ['생산관리팀에서 연락이 왔습니다.', '현재 생산속도(계획 대비 ' + fmtPct(rec.production) + '%)로는 오늘 고객 출하수량을 충족하기 어렵습니다. 예상 ' + Math.round(G.model.snapshot().projected).toLocaleString() + ' / ' + G.cfg.kpi.shipmentTarget.toLocaleString() + 'ea'] });
    }
    if (ce.stopAllEscalation && s.lineStopped) {
      G.stopSince = G.stopSince == null ? t : G.stopSince;
      if (!G.fired.stopall && t - G.stopSince >= 3) {
        G.fired.stopall = true;
        fireEvent({ id: 'stopall', type: 'PRODUCTION', major: true, title: '⚠ 공장장 호출',
          lines: ['공장장: 라인 전체 중단 사유와 재개 예정 시각을 보고해 주십시오.', '중단 1시간당 약 ' + G.cfg.kpi.planPerHour.toLocaleString() + 'ea 생산 손실이 발생합니다.'] });
      }
    } else G.stopSince = null;
    if (ce.materialStock && s.lot === 'OLD' && s.oldStock != null && s.oldStock <= 8 && !G.fired.stockWarn) {
      G.fired.stockWarn = true;
      fireEvent({ id: 'stockWarn', type: 'MATERIAL', major: true, title: 'MATERIAL ALERT — 대체 Lot 잔량 부족',
        lines: ['SP-0911A 잔량이 약 ' + Math.max(0, Math.round(s.oldStock)) + '분 생산 분량 남았습니다.', '소진 시 SP-0925B 재투입 또는 생산 중단 중 판단이 필요합니다.'] });
    }
    if (ce.inspectionBottleneck && s.fullInspection) {
      G.inspSince = G.inspSince == null ? t : G.inspSince;
      if (!G.fired.bottleneck && t - G.inspSince >= 4) {
        G.fired.bottleneck = true;
        fireEvent({ id: 'bottleneck', type: 'PRODUCTION', major: false, title: 'PRODUCTION — 검사 공정 병목',
          lines: ['전수검사로 검사 대기 WIP 가 약 900ea 누적되었습니다.', '검사 인원 2명 추가 투입이 필요하다는 요청이 있습니다.'] });
      }
    }
    if (ce.qualityCritical && !G.fired.qcrit && rec.defect >= 8) {
      G.fired.qcrit = true;
      fireEvent({ id: 'qcrit', type: 'QUALITY', major: true, title: '⚠ QUALITY CRITICAL',
        lines: ['최종검사 불량률이 ' + fmtPct(rec.defect) + '% 로 품질 임계치(8%)를 초과했습니다.', '품질보증팀장이 라인으로 이동 중입니다.'] });
    }
    if (ce.customerEscalation && G.inquiryAt != null && !s.commDone && !G.fired.custEsc && t >= G.inquiryAt + 10) {
      G.fired.custEsc = true;
      s.exposure += 1.2;
      fireEvent({ id: 'custEsc', type: 'CUSTOMER', major: true, title: '⚠ CUSTOMER ESCALATION',
        lines: ['고객사 품질팀이 회신 지연에 대해 공식 Escalation 을 발행했습니다.', '고객사 구매팀장 참조로 8D Report 제출이 요청되었습니다.'] });
    }
  }

  function fireEvent(ev) {
    ev.clock = clock();
    log('event', ev.title.replace(/^⚠\s*/, ''), { type: ev.type, lines: ev.lines, major: !!ev.major });
    $('#ticker').innerHTML = '<span class="t-time">' + ev.clock + '</span><span class="badge ' + (ev.type === 'QUALITY' || ev.type === 'CUSTOMER' ? 'STOP' : 'INSPECT') + '">' + esc(ev.type) + '</span><span class="t-msg">' + esc(ev.lines[0]) + '</span>';
    G.queue.push(ev);
    showNextEvent();
    if (G.view === 'dashboard') renderView(true);
  }

  function showNextEvent() {
    if (G.modalOpen || !G.queue.length) return;
    var ev = G.queue.shift();
    openModal({
      cls: 'alert-modal ' + ev.type,
      title: ev.title,
      right: '<span class="alert-time">' + ev.clock + '</span>',
      body: '<div class="alert-body">' + ev.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>',
      foot: '<button class="btn primary" data-close>확인</button>',
      kind: 'event',
      onClose: function () {
        log('ack', '확인: ' + ev.title.replace(/^⚠\s*/, ''));
        if (ev.onAck) ev.onAck();
      }
    });
  }

  /* ---------------- Modal ---------------- */
  function openModal(o) {
    G.modalOpen = o.kind || 'modal';
    var root = document.createElement('div');
    root.className = 'modal-bg';
    root.innerHTML = '<div class="modal ' + (o.cls || '') + '" role="dialog" aria-modal="true"><div class="m-head"><h3>' + esc(o.title) + '</h3>' + (o.right || '') + '</div><div class="m-body">' + o.body + '</div>' + (o.foot ? '<div class="m-foot">' + o.foot + '</div>' : '') + '</div>';
    $('#modals').appendChild(root);
    var close = function () {
      root.remove();
      G.modalOpen = null;
      if (o.onClose) o.onClose();
      setTimeout(showNextEvent, 250);
    };
    $$('[data-close]', root).forEach(function (b) { b.onclick = close; });
    var f = root.querySelector('[data-close], button, input, textarea');
    if (f) f.focus();
    if (o.onOpen) o.onOpen(root, close);
    return { root: root, close: close };
  }

  /* ---------------- 네비게이션 ---------------- */
  function renderNav() {
    $('#sidenav').innerHTML = '<div class="nav-title">DATA EXPLORER</div>' + MENUS.map(function (m) {
      return '<button data-view="' + m.id + '" class="' + (G.view === m.id ? 'active' : '') + '" title="' + m.label + '"><span class="ico">' + m.ico + '</span><span class="nav-label">' + m.label + '</span>' + (G.visited && G.visited[m.id] ? '' : '<span class="dot"></span>') + '</button>';
    }).join('');
    $$('#sidenav button').forEach(function (b) {
      b.onclick = function () { G.view = b.getAttribute('data-view'); renderNav(); renderView(); $('#view').scrollTop = 0; };
    });
  }

  /* ---------------- KPI ---------------- */
  function renderKpis() {
    var h = G.model.history, first = G.startRec;
    var disp = G.model.snapshot();
    var spark = function (k) { return h.slice(-40).map(function (r) { return r[k]; }); };
    var items = [
      { k: 'production', name: '생산량', val: fmtPct(disp.production), unit: '%', d: disp.production - first.production, goodUp: true, st: disp.production < 80 ? 'crit' : disp.production < 90 ? 'warn' : '' },
      { k: 'yield', name: '수율', val: fmtPct(disp.yield), unit: '%', d: disp.yield - first.yield, goodUp: true, st: disp.yield < 95 ? 'crit' : disp.yield < 97 ? 'warn' : '' },
      { k: 'defect', name: '불량률', val: fmtPct(disp.defect), unit: '%', d: disp.defect - first.defect, goodUp: false, st: disp.defect > 5 ? 'crit' : disp.defect > 3 ? 'warn' : '' },
      { k: 'util', name: '설비가동률', val: fmtPct(disp.util), unit: '%', d: disp.util - first.util, goodUp: true, st: disp.util < 70 ? 'crit' : disp.util < 82 ? 'warn' : '' },
      { k: 'delivery', name: '납기 Risk', lvl: disp.delivery, st: disp.delivery === 'LOW' ? '' : disp.delivery === 'MEDIUM' ? 'warn' : 'crit' },
      { k: 'customer', name: 'Customer Risk', lvl: disp.customer, st: disp.customer === 'LOW' ? '' : disp.customer === 'MEDIUM' ? 'warn' : 'crit' }
    ];
    $('#kpibar').innerHTML = items.map(function (it) {
      var right;
      if (it.lvl) {
        right = '<div class="k-row"><div class="k-val">' + lvlSpan(it.lvl) + '</div></div>';
      } else {
        var arrow = Math.abs(it.d) < 0.1 ? '' : (it.d > 0 ? '▲' : '▼');
        var good = (it.d > 0) === it.goodUp;
        var col = it.k === 'defect' ? '#ec835a' : '#3a9bdc';
        right = '<div class="k-row"><div><span class="k-val">' + it.val + '<small>' + it.unit + '</small></span> ' +
          (arrow ? '<span class="k-delta ' + (good ? 'good' : 'bad') + '">' + arrow + Math.abs(it.d).toFixed(1) + '</span>' : '') + '</div>' +
          FDL.charts.sparkline(spark(it.k), col) + '</div>';
      }
      var flag = it.st === 'crit' ? '⚠ CRITICAL' : '▲ WARNING';
      return '<div class="kpi ' + it.st + '" title="시작 대비 변화"><div class="k-top"><span class="k-name">' + it.name + '</span><span class="k-flag">' + flag + '</span></div>' + right + '</div>';
    }).join('');
  }

  /* ---------------- Views ---------------- */
  function renderView(live) {
    G.visited = G.visited || {};
    G.visited[G.view] = true;
    var fn = VIEWS[G.view];
    // live 갱신 시 사용자가 입력 중인 요소가 있으면 건너뜀
    if (live && document.activeElement && $('#view').contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var y = $('#view').scrollTop;
    $('#view').innerHTML = fn();
    bindView();
    if (live) $('#view').scrollTop = y;
    if (!live) renderNav();
  }

  function head(title, sub, extra) {
    return '<div class="view-head"><div><h2>' + esc(title) + '</h2><div class="sub">' + (sub || '') + '</div></div>' + (extra || '') + '</div>';
  }
  function subtabs(view, tabs) {
    var cur = G.sub[view] || tabs[0][0];
    return '<div class="subtabs">' + tabs.map(function (t) {
      return '<button data-sub="' + view + ':' + t[0] + '" class="' + (cur === t[0] ? 'active' : '') + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  function curSub(view, def) { return G.sub[view] || def; }

  function factoryMap() {
    var s = G.model.s, snap = G.model.snapshot();
    var perHr = Math.round(G.cfg.kpi.planPerHour * snap.production / 100);
    return '<div class="fmap">' + NODES.map(function (n, i) {
      var eqs = '';
      if (n.id === 'C') eqs = '<div class="fn-eq">' + FDL.EQUIPMENT.map(function (id) { var st = snap.perEq[id].status; return '<span class="' + st + '">' + id.replace('EQ-', 'R') + '</span>'; }).join('') + '</div>';
      else if (n.eq) eqs = '<div class="fn-eq">' + n.eq.map(function (id) { return '<span>' + id + '</span>'; }).join('') + '</div>';
      var metric = '';
      if (n.id === 'raw') metric = '<div class="fn-metric"><span>Paste</span><span>' + (s.lot === 'NEW' ? 'SP-0925B' : 'SP-0911A') + '</span></div>';
      else if (n.id === 'insp') metric = '<div class="fn-metric"><span>판정 불량</span><span>' + fmtPct(snap.defect) + '%</span></div>';
      else if (n.id === 'ship') metric = '<div class="fn-metric"><span>예상</span><span>' + Math.round(snap.deliveryRatio * 100) + '%</span></div>';
      else metric = '<div class="fn-metric"><span>UPH</span><span>' + (G.model.s.lineStopped ? 0 : perHr) + '</span></div>';
      var alert = (n.id === 'insp' && snap.defect > 3) ? '<span class="fn-alert">● ALERT</span>' : '';
      return (i ? '<div class="farrow">›</div>' : '') + '<button class="fnode' + (G.drawerNode === n.id ? ' sel' : '') + '" data-node="' + n.id + '">' + alert + '<div class="fn-step">' + n.step + '</div><div class="fn-name">' + n.name + '</div>' + eqs + metric + '</button>';
    }).join('') + '</div>';
  }

  var VIEWS = {};

  VIEWS.dashboard = function () {
    var h = G.model.history, s = G.model.s;
    var labels = h.map(function (r) { return r.clock; });
    var defChart = h.length > 1 ? FDL.charts.line({ labels: labels, series: [{ name: '라인 불량률', color: '#ec835a', values: h.map(function (r) { return r.defect; }) }], unit: '%', width: 560, height: 230, refLines: [{ value: G.cfg.effects.base, label: '평시 ' + G.cfg.effects.base + '%' }], markers: decisionMarkers(), title: '라인 불량률 Live' }) : '<p class="muted">Timer 시작 후 Live 데이터가 누적됩니다.</p>';
    var prodChart = h.length > 1 ? FDL.charts.line({ labels: labels, series: [{ name: '생산량(계획 대비)', color: '#3987e5', values: h.map(function (r) { return r.production; }) }], unit: '%', width: 560, height: 230, yMin: 0, yMax: 100, markers: decisionMarkers(), title: '생산량 Live' }) : '<p class="muted">Timer 시작 후 Live 데이터가 누적됩니다.</p>';
    var events = G.log.filter(function (l) { return l.type === 'event'; }).slice(-6).reverse();
    var tasks = s.tasks.map(function (tk) {
      var nm = tk.type === 'inspection' ? tk.eq + ' 긴급점검' : tk.type === 'recipe' ? tk.eq + ' 레시피 재로드' : '공급사 회신 대기';
      return '<li><span class="when">~' + G.model.clock(tk.doneAt) + '</span>' + esc(nm) + '</li>';
    }).join('');
    var status = [
      ['라인 상태', s.lineStopped ? '<span class="badge STOP">STOP</span>' : '<span class="badge RUN">RUN</span>'],
      ['투입 Paste Lot', s.lot === 'NEW' ? 'SP-0925B' : 'SP-0911A' + (s.oldStock != null ? ' (잔량 ~' + Math.max(0, Math.round(s.oldStock)) + '분)' : '')],
      ['라인 속도', Math.round(s.rate * 100) + '%'],
      ['최종검사 방식', s.fullInspection ? '전수검사' : 'AOI + X-ray 샘플링'],
      ['출하', s.hold ? '의심 Lot 보류 중' : '정상 출하'],
      ['잔업/특근', s.overtime ? '편성' : '미편성']
    ];
    return head('Control Room Dashboard', 'SMT Line 2 · 전장용 파워모듈 PM-220 · 실시간') +
      '<div class="card" style="margin-bottom:12px"><h3>PROCESS FLOW <span class="tag">공정을 클릭해 상세 확인</span></h3>' + factoryMap() + '</div>' +
      '<div class="grid c2" style="margin-bottom:12px"><div class="card"><h3>라인 불량률 (최종검사) <span class="tag">LIVE</span></h3>' + defChart + '</div>' +
      '<div class="card"><h3>생산량 (계획 대비 %) <span class="tag">LIVE</span></h3>' + prodChart + '</div></div>' +
      '<div class="grid c3"><div class="card"><h3>EVENT LOG</h3><ul class="plain">' + (events.length ? events.map(function (e) { return '<li><span class="when">' + e.clock + '</span>' + esc(e.label) + '</li>'; }).join('') : '<li class="muted">없음</li>') + '</ul></div>' +
      '<div class="card"><h3>LINE STATUS</h3><table class="data">' + status.map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="card"><h3>진행 중 조치</h3><ul class="plain">' + (tasks || '<li class="muted">없음</li>') + '</ul><div class="note">DECISION 으로 조치를 실행하면 결과가 KPI·Event 로 반영됩니다.</div></div></div>';
  };

  function decisionMarkers() {
    return G.log.filter(function (l) { return l.type === 'decision'; }).map(function (d, i) {
      return { index: Math.min(d.t, G.model.history.length - 1), label: 'D' + (i + 1) };
    });
  }

  VIEWS.process = function () {
    var snap = G.model.snapshot();
    var perHr = Math.round(G.cfg.kpi.planPerHour * snap.production / 100);
    var rows = [
      ['raw', '원자재', '-', '수입검사 합격 100%', '정상', 'Paste/PCB/부품'],
      ['A', '공정 A · 인쇄', perHr, 'SPI 합격 99.2%', 'RUN', 'PR-01 / SPI-01'],
      ['B', '공정 B · 실장', perHr, '흡착률 99.96%', 'RUN', 'MT-01 / MT-02'],
      ['C', '공정 C · Reflow', perHr, '공정 내 판정 없음', FDL.EQUIPMENT.map(function (id) { return '<span class="badge ' + snap.perEq[id].status + '">' + id.slice(3) + '</span>'; }).join(' '), 'EQ-01 ~ EQ-04'],
      ['insp', '최종검사', perHr, '불량 ' + fmtPct(snap.defect) + '%', 'RUN', 'AOI-01 / XR-01'],
      ['ship', '출하', '-', '예상 ' + Math.round(snap.deliveryRatio * 100) + '%', G.model.s.hold ? '보류' : '정상', '-']
    ];
    return head('Process', '공정 흐름 · 공정을 선택하면 우측에 상세 정보가 표시됩니다.') +
      '<div class="card" style="margin-bottom:12px">' + factoryMap() + '</div>' +
      '<div class="card"><h3>공정 요약</h3><div class="table-wrap"><table class="data"><thead><tr><th>공정</th><th class="num">UPH</th><th>품질 지표</th><th>상태</th><th>설비</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr class="click" data-node="' + r[0] + '"><td><b>' + r[1] + '</b></td><td class="num">' + (G.model.s.lineStopped && r[2] !== '-' ? 0 : r[2]) + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td><td class="muted">' + r[5] + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  };

  VIEWS.quality = function () {
    var tab = curSub('quality', 'trend');
    var out = head('Quality', '최종검사 기준 품질 데이터') + subtabs('quality', [['trend', '불량 Trend (7일)'], ['hourly', '시간대별 추이'], ['pareto', '불량 유형'], ['strat', '층별 분석'], ['cross', '교차 분석']]);
    var M = G.model;
    if (tab === 'trend') {
      if (!vis('quality.trend7d')) return out + hiddenCard('불량 Trend');
      see('quality.trend7d', 'Quality Trend (7일) 확인');
      var tr = M.trend7d();
      out += '<div class="card"><h3>최근 7일 불량률 (%)</h3>' + FDL.charts.bars({ items: tr.map(function (d) { return { label: d.label, value: d.value, color: d.live ? '#ec835a' : '#3987e5' }; }), unit: '%', refLines: [{ value: G.cfg.effects.base, label: '평시' }], height: 230, title: '7일 불량률' }) +
        '<div class="table-wrap"><table class="data"><thead><tr>' + tr.map(function (d) { return '<th class="num">' + d.label + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + tr.map(function (d) { return '<td class="num">' + d.value.toFixed(1) + '%</td>'; }).join('') + '</tr></tbody></table></div></div>';
    } else if (tab === 'hourly') {
      if (!vis('quality.hourly')) return out + hiddenCard('시간대별 추이');
      see('quality.hourly', 'Quality 시간대별 추이 확인');
      var hr = M.hourly();
      var mode = G.sub.hourlyMode || 'line';
      var series = mode === 'eq' ? FDL.EQUIPMENT.map(function (id, i) { return { name: id, color: FDL.SERIES[i], values: hr.series[id] }; }) : [{ name: '라인 불량률', color: '#ec835a', values: hr.overall }];
      if (mode === 'eq') see('strat.eq', '시간대별 설비 분리 추이 확인');
      out += '<div class="card"><h3>최근 24시간 + LIVE 불량률 (%) <span class="row"><button class="btn sm ' + (mode === 'line' ? 'primary' : '') + '" data-hmode="line">라인 전체</button><button class="btn sm ' + (mode === 'eq' ? 'primary' : '') + '" data-hmode="eq">설비별 분리</button></span></h3>' +
        FDL.charts.line({ labels: hr.labels, series: series, unit: '%', height: 280, liveFrom: hr.liveFrom, maxXLabels: 10, refLines: [{ value: G.cfg.effects.base, label: '평시' }], title: '시간대별 불량률' }) +
        '<div class="note">어제 09:00 ~ 현재 · 음영 구간은 게임 진행 중 LIVE 데이터</div></div>';
    } else if (tab === 'pareto') {
      if (!vis('quality.pareto')) return out + hiddenCard('불량 유형');
      see('quality.pareto', '불량 유형 Pareto 확인');
      var p = M.pareto();
      out += '<div class="card"><h3>불량 유형별 기여 (라인 불량률 %p)</h3>' + FDL.charts.pairedH({ items: p.map(function (r) { return { label: r.label, a: r.baseline, b: r.today }; }), nameA: '평시 (D-6~D-2)', nameB: '현재', colorA: '#3987e5', colorB: '#ec835a', unit: '%p' }) +
        '<div class="note">증가한 유형은 어떤 공정의 어떤 조건과 관련이 깊을까요?</div></div>';
    } else if (tab === 'strat') {
      if (!vis('quality.strat')) return out + hiddenCard('층별 분석');
      var dim = G.sub.stratDim || 'eq', per = G.sub.stratPeriod || '48h';
      out += '<div class="card"><h3>층별 분석 (Stratification)</h3><div class="row" style="margin-bottom:10px"><label class="flabel">기준</label><select id="stratDim">' +
        Object.keys(FDL.STRAT_DIMS).map(function (k) { return '<option value="' + k + '"' + (k === dim ? ' selected' : '') + '>' + FDL.STRAT_DIMS[k].label + '</option>'; }).join('') +
        '</select><label class="flabel">기간</label><select id="stratPer"><option value="48h"' + (per === '48h' ? ' selected' : '') + '>최근 48시간</option><option value="24h"' + (per === '24h' ? ' selected' : '') + '>최근 24시간</option><option value="today"' + (per === 'today' ? ' selected' : '') + '>오늘 08:00~</option></select>' +
        '<button class="btn primary sm" id="stratRun">분석 실행</button></div>';
      if (G.sub.stratRan) {
        var rows = M.strat(G.sub.stratRan.dim, G.sub.stratRan.per);
        out += FDL.charts.bars({ items: rows.map(function (r) { return { label: r.label.length > 12 ? r.label.slice(0, 12) + '…' : r.label, value: r.defect, color: '#3987e5', sub: r.label + ' · ' + r.units.toLocaleString() + 'ea' }; }), unit: '%', height: 220, refLines: [{ value: G.cfg.effects.base, label: '평시' }] }) +
          '<div class="table-wrap"><table class="data"><thead><tr><th>' + FDL.STRAT_DIMS[G.sub.stratRan.dim].label + '</th><th class="num">불량률</th><th class="num">생산수량</th></tr></thead><tbody>' +
          rows.map(function (r) { return '<tr><td>' + esc(r.label) + '</td><td class="num">' + r.defect.toFixed(1) + '%</td><td class="num">' + r.units.toLocaleString() + '</td></tr>'; }).join('') + '</tbody></table></div>';
      } else out += '<p class="muted">기준과 기간을 선택한 뒤 “분석 실행”을 누르십시오.</p>';
      out += '</div>';
    } else if (tab === 'cross') {
      if (!vis('quality.cross')) return out + hiddenCard('교차 분석');
      var a = G.sub.crossA || 'eq', b = G.sub.crossB || 'lot', pc = G.sub.crossPer || '48h';
      var opts = function (sel) { return Object.keys(FDL.STRAT_DIMS).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + FDL.STRAT_DIMS[k].label + '</option>'; }).join(''); };
      out += '<div class="card"><h3>교차 분석 (2차원)</h3><div class="row" style="margin-bottom:10px"><label class="flabel">행</label><select id="crossA">' + opts(a) + '</select><label class="flabel">열</label><select id="crossB">' + opts(b) + '</select>' +
        '<select id="crossPer"><option value="48h"' + (pc === '48h' ? ' selected' : '') + '>최근 48시간</option><option value="24h"' + (pc === '24h' ? ' selected' : '') + '>최근 24시간</option><option value="today"' + (pc === 'today' ? ' selected' : '') + '>오늘 08:00~</option></select><button class="btn primary sm" id="crossRun">분석 실행</button></div>';
      if (G.sub.crossRan) {
        var cr = M.cross(G.sub.crossRan.a, G.sub.crossRan.b, G.sub.crossRan.per);
        out += '<div class="table-wrap"><table class="data"><thead><tr><th></th>' + cr.cols.map(function (c) { return '<th class="num">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          cr.rows.map(function (r, i) {
            return '<tr><td><b>' + esc(r) + '</b></td>' + cr.m[i].map(function (cell) {
              if (!cell) return '<td class="num muted">—</td>';
              var heat = Math.min(1, Math.max(0, (cell.v - 1.5) / 10));
              return '<td class="num" style="background:rgba(236,131,90,' + (heat * 0.55).toFixed(2) + ')" data-tip="' + esc(r + ' × ' + ' : ' + cell.v + '% (' + cell.n.toLocaleString() + 'ea)') + '">' + cell.v.toFixed(1) + '%</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div><div class="note">셀 색이 진할수록 불량률이 높습니다. (—: 해당 조합 생산 없음)</div>';
      } else out += '<p class="muted">두 기준을 선택한 뒤 “분석 실행”을 누르십시오. 예: Reflow 설비 × Solder Paste Lot</p>';
      out += '</div>';
    }
    return out;
  };

  VIEWS.equipment = function () {
    if (!vis('equipment.list')) return head('Equipment', '') + hiddenCard('설비 현황');
    see('equipment.list', 'Equipment 설비 현황 확인');
    var snap = G.model.snapshot(), M = G.model, diff = FDL.DIFFICULTY[G.cfg.difficulty] || {};
    var list = [
      ['PR-01', 'Screen Printer', 'A', 'RUN', '96.8%', '5일 전'],
      ['SPI-01', '3D SPI', 'A', 'RUN', '99.1%', '12일 전'],
      ['MT-01', 'Mounter (Lane1)', 'B', 'RUN', '95.2%', '8일 전'],
      ['MT-02', 'Mounter (Lane2)', 'B', 'RUN', '94.7%', '오늘 07:10 (Nozzle)']
    ];
    FDL.EQUIPMENT.map(function (id) { list.push([id, 'Reflow Oven', 'C', snap.perEq[id].status, snap.perEq[id].status === 'RUN' ? (86 + Math.round(FDL.util.noise(G.cfg.seed, id) * 4)) + '%' : '0%', id === 'EQ-02' ? '9일 전' : id === 'EQ-04' ? '3일 전' : '16일 전']); });
    list.push(['AOI-01', 'AOI', '검사', 'RUN', '98.9%', '6일 전'], ['XR-01', 'X-ray (샘플)', '검사', 'RUN', '99.4%', '20일 전']);
    var sel = G.sub.eqSel;
    var out = head('Equipment', '설비 상태 · Reflow 설비를 선택하면 공정조건/알람을 확인할 수 있습니다.') +
      '<div class="card" style="margin-bottom:12px"><div class="table-wrap"><table class="data"><thead><tr><th>설비</th><th>종류</th><th>공정</th><th>상태</th><th class="num">가동률(금일)</th>' + (diff.recipeInList ? '<th>레시피</th>' : '') + '<th>최근 PM/정비</th></tr></thead><tbody>' +
      list.map(function (r) {
        var isEq = FDL.EQUIPMENT.indexOf(r[0]) >= 0;
        return '<tr class="' + (isEq ? 'click' : '') + '" ' + (isEq ? 'data-eq="' + r[0] + '"' : '') + '><td><b>' + r[0] + '</b>' + (sel === r[0] ? ' ◀' : '') + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><span class="badge ' + r[3] + '">' + r[3] + '</span></td><td class="num">' + r[4] + '</td>' + (diff.recipeInList ? '<td class="mono">' + (isEq ? 'PM220_RF_' + M.recipeOf(r[0]) : '-') + '</td>' : '') + '<td class="muted">' + r[5] + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    if (sel) {
      if (!vis('equipment.detail')) return out + hiddenCard('설비 상세');
      see('eq.detail.' + sel, sel + ' 상세 (공정조건/알람) 확인');
      var z = M.zoneTable(sel);
      var recipe = diff.recipeHidden ? 'PM220_RF' : 'PM220_RF_' + M.recipeOf(sel);
      out += '<div class="grid c2"><div class="card"><h3>' + sel + ' 공정조건 <span class="tag">Recipe: ' + esc(recipe) + '</span></h3><div class="table-wrap"><table class="data"><thead><tr><th>Zone</th><th class="num">설정(SV)</th><th class="num">현재(PV)</th><th class="num">Heater 출력</th></tr></thead><tbody>' +
        z.map(function (r) { return '<tr><td>' + r.zone + '</td><td class="num">' + r.sv + '°C</td><td class="num">' + r.pv + '°C</td><td class="num">' + r.out + '%</td></tr>'; }).join('') +
        '</tbody></table></div><div class="note">컨베이어 ' + (78 * G.model.s.rate).toFixed(0) + ' cm/min · N2 820ppm · PV 는 설비 제어 열전대 측정값</div></div>' +
        '<div class="card"><h3>알람 이력 (48h)</h3><ul class="plain">' + (M.alarms(sel).map(function (a) { return '<li><span class="when">' + a.time + '</span><span class="badge cat">' + a.code + '</span> ' + esc(a.msg) + '</li>'; }).join('') || '<li class="muted">알람 없음</li>') + '</ul>' +
        '<h3 style="margin-top:14px">Profiler 실측</h3>' + (G.model.s.unlocked.profile[sel] ? '<ul class="plain">' + G.model.s.findings.filter(function (f) { return f.eq === sel; }).map(function (f) { return f.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join(''); }).join('') + '</ul>' : '<p class="muted">설비 긴급점검 시 실측 데이터가 제공됩니다.</p>') + '</div></div>';
    }
    return out;
  };

  VIEWS.production = function () {
    if (!vis('production.plan')) return head('Production', '') + hiddenCard('생산계획');
    see('production.plan', 'Production 생산계획/출하 확인');
    var c = G.cfg, snap = G.model.snapshot(), h = G.model.history;
    var kv = [
      ['18:00 출하 요구', c.kpi.shipmentTarget.toLocaleString() + ' ea'],
      ['완제품 재고 (09:00)', c.kpi.fgStock.toLocaleString() + ' ea' + (G.model.s.hold ? ' (보류 반영 50%)' : '')],
      ['금일 게임 중 생산 (양품)', Math.round(G.model.s.produced).toLocaleString() + ' ea'],
      ['예상 출하 가능', Math.round(snap.projected).toLocaleString() + ' ea'],
      ['달성 예상률', Math.round(snap.deliveryRatio * 100) + '%'],
      ['시간당 계획', c.kpi.planPerHour.toLocaleString() + ' ea/h']
    ];
    return head('Production', '생산계획 · 출하 · 인력') +
      '<div class="card" style="margin-bottom:12px"><div class="kv" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + kv.map(function (k) { return '<div><div class="k">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>'; }).join('') + '</div></div>' +
      '<div class="grid c2"><div class="card"><h3>생산량 추이 (계획 대비 %)</h3>' + (h.length > 1 ? FDL.charts.line({ labels: h.map(function (r) { return r.clock; }), series: [{ name: '생산량', color: '#3987e5', values: h.map(function (r) { return r.production; }) }], unit: '%', yMin: 0, yMax: 100, width: 560, height: 230, markers: decisionMarkers() }) : '<p class="muted">데이터 누적 중</p>') + '</div>' +
      '<div class="card"><h3>인력 · 가용 자원</h3><table class="data"><tr><td class="muted">주간조 인원</td><td>14명 (결원 1)</td></tr><tr><td class="muted">잔업 가능</td><td>최대 2h (18:00~20:00), 노사 협의 필요</td></tr><tr><td class="muted">대체 라인</td><td>Line 3 — 동일 모델 생산 가능 (전환 90분)</td></tr><tr><td class="muted">검사 지원</td><td>품질팀 검사원 2명 지원 가능</td></tr><tr><td class="muted">고객 입고 기준</td><td>D+1 06:00 고객 라인 투입</td></tr></table></div></div>';
  };

  VIEWS.material = function () {
    var tab = curSub('material', 'lots'), s = G.model.s;
    var out = head('Material', '원자재 Lot · 수입검사 · 공급사') + subtabs('material', [['lots', 'Lot 이력'], ['coa', '수입검사 / COA'], ['pcn', '공급사 정보'], ['line3', '타 라인']]);
    if (tab === 'lots') {
      if (!vis('material.lots')) return out + hiddenCard('Lot 이력');
      see('material.lots', 'Material Lot 이력 확인');
      out += '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>자재</th><th>Lot</th><th>투입 기간</th><th>공급사</th><th>재고</th></tr></thead><tbody>' +
        '<tr><td>Solder Paste (SAC305, T4)</td><td class="mono">SP-0911A</td><td>~ 어제 14:00' + (s.lot === 'OLD' ? ' / 재투입 중' : '') + '</td><td>K-Solder</td><td>' + (s.oldStock == null ? '3 Jar (약 ' + FDL.actionParam(G.cfg, 'quarantine_lot', 'stockMin') + '분 분량)' : '약 ' + Math.max(0, Math.round(s.oldStock)) + '분 분량') + '</td></tr>' +
        '<tr><td>Solder Paste (SAC305, T4)</td><td class="mono">SP-0925B</td><td>어제 14:00 ~ ' + (s.lot === 'NEW' ? '현재' : '격리') + '</td><td>K-Solder</td><td>18 Jar</td></tr>' +
        '<tr><td>PCB (PM-220 Rev.3)</td><td class="mono">PCB-0913</td><td>~ 어제 09:00</td><td>D-Circuit</td><td>0</td></tr>' +
        '<tr><td>PCB (PM-220 Rev.3)</td><td class="mono">PCB-0920</td><td>어제 09:00 ~ 현재</td><td>D-Circuit</td><td>4,200</td></tr>' +
        '<tr><td>MOSFET / MLCC 외 42종</td><td class="mono">각 Lot</td><td>정상 순환</td><td>-</td><td>충분</td></tr>' +
        '</tbody></table></div></div>';
    } else if (tab === 'coa') {
      if (!vis('material.coa')) return out + hiddenCard('수입검사 / COA');
      see('material.coa', 'Material 수입검사/COA 확인');
      out += '<div class="card"><h3>Solder Paste 수입검사 성적 (COA)</h3><div class="table-wrap"><table class="data"><thead><tr><th>항목</th><th>규격</th><th class="num">SP-0911A</th><th class="num">SP-0925B</th><th>판정</th></tr></thead><tbody>' +
        '<tr><td>점도 (Pa·s)</td><td>160 ~ 210</td><td class="num">182</td><td class="num">204</td><td>합격</td></tr>' +
        '<tr><td>Flux 함량 (%)</td><td>11.0 ~ 12.0</td><td class="num">11.4</td><td class="num">11.8</td><td>합격</td></tr>' +
        '<tr><td>분말 입도</td><td>Type 4 (20~38µm)</td><td class="num">T4</td><td class="num">T4</td><td>합격</td></tr>' +
        '<tr><td>Slump (mm)</td><td>≤ 0.3</td><td class="num">0.15</td><td class="num">0.22</td><td>합격</td></tr>' +
        '<tr><td>PCN 적용</td><td>-</td><td class="num">-</td><td class="num">PCN-0917</td><td>-</td></tr>' +
        '</tbody></table></div><div class="note">수입검사 판정은 모두 “합격”입니다. 규격 내 변동이 공정에 미치는 영향은 별도 판단이 필요합니다.</div></div>' +
        '<div class="card" style="margin-top:12px"><h3>PCB 수입검사</h3><table class="data"><tr><td>PCB-0913</td><td>두께 1.60mm · 휨 0.31%</td><td>합격</td></tr><tr><td>PCB-0920</td><td>두께 1.61mm · 휨 0.33%</td><td>합격</td></tr></table></div>';
    } else if (tab === 'pcn') {
      if (!s.unlocked.pcn) return out + locked('공급사 문의(DECISION → 공급사 긴급 문의) 후 회신이 도착하면 확인할 수 있습니다.');
      see('material.pcn', 'Material 공급사 PCN 정보 확인');
      var f = G.log.filter(function (l) { return l.type === 'event' && /공급사 회신/.test(l.label); })[0];
      out += '<div class="card"><h3>공급사 회신 · PCN-0917</h3><ul class="plain">' + (f ? f.data.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') : '') + '</ul></div>';
    } else if (tab === 'line3') {
      if (!s.unlocked.line3) return out + locked('현재 타 라인 공유 정보가 없습니다.');
      see('line3', 'Line 3 동일 현상 정보 확인');
      out += '<div class="card"><h3>Line 3 현황</h3><p>' + esc(G.line3Text()) + '</p></div>';
    }
    return out;
  };

  VIEWS.people = function () {
    var tab = curSub('people', 'roster');
    var coEq = G.model.changeoverEq();
    var out = head('People', '근무조 · 작업자 · 작업일지') + subtabs('people', [['roster', '근무조 / 작업자'], ['worklog', '작업일지'], ['training', '교육 이력']]);
    if (tab === 'roster') {
      if (!vis('people.roster')) return out + hiddenCard('근무조');
      see('people.roster', 'People 근무조/작업자 확인');
      out += '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>조</th><th>공정</th><th>작업자</th><th>경력</th><th>비고</th></tr></thead><tbody>' +
        '<tr><td>주간 (08-20)</td><td>인쇄</td><td>윤OO</td><td>6년</td><td></td></tr>' +
        '<tr><td>주간</td><td>실장 Lane1 (MT-01)</td><td>최OO</td><td>9년</td><td>선임</td></tr>' +
        '<tr><td>주간</td><td>실장 Lane2 (MT-02)</td><td>김OO</td><td>2주</td><td>신규 (OJT 중)</td></tr>' +
        '<tr><td>주간</td><td>Reflow / Changeover</td><td>이OO</td><td>4년</td><td></td></tr>' +
        '<tr><td>야간 (20-08)</td><td>실장 Lane1 (MT-01)</td><td>한OO</td><td>3년</td><td></td></tr>' +
        '<tr><td>야간</td><td>실장 Lane2 (MT-02)</td><td>정OO</td><td>5년</td><td></td></tr>' +
        '<tr><td>야간</td><td>Reflow / Changeover</td><td>박OO</td><td>8개월</td><td>Changeover 인증 1개월</td></tr>' +
        '</tbody></table></div><div class="note">Lane1(MT-01) → EQ-01/EQ-02, Lane2(MT-02) → EQ-03/EQ-04 로 연결됩니다.</div></div>';
    } else if (tab === 'worklog') {
      if (!vis('people.worklog')) return out + hiddenCard('작업일지');
      see('people.worklog', 'People 작업일지 (Changeover) 확인');
      out += '<div class="card"><h3>교대 작업일지 (최근 24h)</h3><ul class="plain">' + [
        ['어제 13:30', '[주간] 기술팀 — Reflow 레시피 Rev.D 전 설비 배포 완료'],
        ['어제 14:00', '[주간] Solder Paste SP-0925B 투입 (SP-0911A 잔량 보관)'],
        ['어제 20:00', '[인수인계] 주간→야간: 특이사항 없음'],
        ['어제 22:10', '[야간] ' + coEq + ' 계획 모델 교체 PM-220 → PM-180 (샘플 50ea) — 박OO'],
        ['어제 22:40', '[야간] ' + coEq + ' PM-180 → PM-220 복귀, 레시피 로드 체크 “완료” — 박OO'],
        ['어제 23:52', '[야간] ' + (G.cfg.rootCause.tcDrift && G.cfg.rootCause.eqId ? G.cfg.rootCause.eqId + ' Heater 출력 경고 1회, Reset 후 가동' : '특이사항 없음')],
        ['오늘 03:20', '[야간] 순회 점검 — 이상 없음'],
        ['오늘 07:10', '[야간] MT-02 Head3 Nozzle 교체 (정기)'],
        ['오늘 08:00', '[인수인계] 야간→주간: “특이사항 없음”']
      ].map(function (r) { return '<li><span class="when">' + r[0] + '</span>' + esc(r[1]) + '</li>'; }).join('') + '</ul><div class="note">Changeover 체크시트에는 레시피 “버전” 기재란이 없습니다.</div></div>';
    } else {
      see('people.training', 'People 교육 이력 확인');
      out += '<div class="card"><table class="data"><thead><tr><th>작업자</th><th>교육</th><th>이수일</th></tr></thead><tbody><tr><td>김OO</td><td>SMT 기초 / 실장기 운전</td><td>3주 전</td></tr><tr><td>박OO</td><td>Reflow Changeover 인증</td><td>1개월 전</td></tr><tr><td>이OO</td><td>Reflow Profile 관리</td><td>1년 전</td></tr><tr><td>전 작업자</td><td>변경점(4M) 관리 교육</td><td>6개월 전</td></tr></tbody></table></div>';
    }
    return out;
  };

  VIEWS.history = function () {
    var tab = curSub('history', 'changes');
    var out = head('History', '변경점 · 과거 이상 · 내 조치 이력') + subtabs('history', [['changes', '4M 변경점'], ['incidents', '과거 이상 이력'], ['mine', '내 조치 이력']]);
    if (tab === 'changes') {
      if (!vis('history.changes')) return out + hiddenCard('4M 변경점');
      see('history.changes', 'History 4M 변경점 확인');
      out += '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>일시</th><th>구분</th><th>변경 내용</th></tr></thead><tbody>' +
        G.changeLog().map(function (c) { return '<tr><td class="mono">' + c.when + '</td><td><span class="badge cat">' + c.cat + '</span></td><td>' + esc(c.item) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="note">변경점 관리대장 등록 기준입니다. 교대 중 작업(Changeover 등)은 작업일지를 확인하십시오.</div></div>';
    } else if (tab === 'incidents') {
      if (!vis('history.incidents')) return out + hiddenCard('과거 이상 이력');
      see('history.incidents', 'History 과거 이상 이력 확인');
      out += '<div class="card"><ul class="plain">' + [
        ['3개월 전', 'Reflow Void 불량 증가 (Line 1) — 원인: 모델 교체 후 이전 모델 레시피 로드 (Changeover 체크리스트 미준수). 대책: 체크리스트 개정'],
        ['6개월 전', 'Mounter 흡착 불량 증가 (Line 2) — 원인: Nozzle 마모. 대책: 교체 주기 단축'],
        ['1년 전', 'Solder Paste 보관 온도 이탈 → 인쇄 불량 — 대책: 냉장고 온도 알람 설치'],
        ['1년 전', 'AOI 오검출 증가 — 프로그램 업데이트 후 라이브러리 불일치. 대책: 업데이트 검증 절차']
      ].map(function (r) { return '<li><span class="when">' + r[0] + '</span>' + esc(r[1]) + '</li>'; }).join('') + '</ul></div>';
    } else {
      var ds = G.log.filter(function (l) { return l.type === 'decision'; });
      out += '<div class="card">' + (ds.length ? '<ul class="plain">' + ds.map(function (d) { return '<li><span class="when">' + d.clock + '</span><b>' + esc(d.data.actions.map(function (a) { return a.label + (a.target ? '(' + a.target + ')' : ''); }).join(', ')) + '</b><div class="muted">근거: ' + esc(d.data.rationale) + '</div></li>'; }).join('') + '</ul>' : '<p class="muted">아직 실행한 의사결정이 없습니다.</p>') + '</div>';
    }
    return out;
  };

  function bindView() {
    $$('#view [data-node]').forEach(function (b) { b.onclick = function () { openDrawer(b.getAttribute('data-node')); }; });
    $$('#view [data-sub]').forEach(function (b) {
      b.onclick = function () { var p = b.getAttribute('data-sub').split(':'); G.sub[p[0]] = p[1]; renderView(); };
    });
    $$('#view [data-hmode]').forEach(function (b) { b.onclick = function () { G.sub.hourlyMode = b.getAttribute('data-hmode'); renderView(); }; });
    $$('#view [data-eq]').forEach(function (b) { b.onclick = function () { G.sub.eqSel = b.getAttribute('data-eq'); renderView(); }; });
    var sr = $('#stratRun');
    if (sr) sr.onclick = function () {
      var dim = $('#stratDim').value, per = $('#stratPer').value;
      G.sub.stratDim = dim; G.sub.stratPeriod = per; G.sub.stratRan = { dim: dim, per: per };
      see('strat.' + dim, '층별 분석: ' + FDL.STRAT_DIMS[dim].label + '별 (' + per + ')');
      renderView();
    };
    var cr = $('#crossRun');
    if (cr) cr.onclick = function () {
      var a = $('#crossA').value, b = $('#crossB').value, per = $('#crossPer').value;
      if (a === b) { toast('서로 다른 두 기준을 선택하십시오.'); return; }
      G.sub.crossA = a; G.sub.crossB = b; G.sub.crossPer = per; G.sub.crossRan = { a: a, b: b, per: per };
      see('cross.' + [a, b].sort().join('x'), '교차 분석: ' + FDL.STRAT_DIMS[a].label + ' × ' + FDL.STRAT_DIMS[b].label);
      renderView();
    };
  }

  /* ---------------- Drawer (공정 상세) ---------------- */
  function openDrawer(id) {
    G.drawerNode = id;
    see('process.' + id, 'Process Map: ' + NODES.filter(function (n) { return n.id === id; })[0].name + ' 상세 확인');
    renderDrawer(id);
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    if (G.view === 'dashboard' || G.view === 'process') renderView(true);
  }
  function closeDrawer() {
    G.drawerNode = null;
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    if (G.view === 'dashboard' || G.view === 'process') renderView(true);
  }

  function renderDrawer(id) {
    var n = NODES.filter(function (x) { return x.id === id; })[0];
    var snap = G.model.snapshot(), s = G.model.s, c = G.cfg;
    var perHr = s.lineStopped ? 0 : Math.round(c.kpi.planPerHour * snap.production / 100);
    var kv = [], cond = [], people = [], changes = [], lots = [], hist = [], eqs = [];
    if (id === 'raw') {
      kv = [['투입량 (UPH)', perHr], ['수입검사 합격률', '100%'], ['불량률', '-'], ['설비 상태', '-']];
      lots = ['Solder Paste: ' + (s.lot === 'NEW' ? 'SP-0925B (어제 14:00~)' : 'SP-0911A (재투입)'), 'PCB: PCB-0920 (어제 09:00~)', '부품: 42종 정상 순환'];
      changes = ['어제 14:00 Solder Paste Lot 변경', '어제 09:00 PCB Lot 변경'];
      people = ['자재 담당: 서OO (주간)'];
      hist = ['1년 전 Paste 보관 온도 이탈'];
      cond = ['Paste 냉장 보관 2~10°C (현재 5.2°C)', '상온 해동 4h 준수'];
    } else if (id === 'A') {
      kv = [['생산량 (UPH)', perHr], ['SPI 합격률', '99.2%'], ['불량률 (SPI)', '0.8%'], ['설비 상태', 'RUN']];
      cond = ['Squeegee 압력 6.5kg · 속도 40mm/s', 'Stencil 130µm · 세정 주기 5매', 'SPI 평균 체적 ' + (c.rootCause.material && s.lot === 'NEW' ? '104%' : '101%') + ' (규격 80~130%)'];
      people = ['주간: 윤OO (6년)'];
      changes = ['최근 7일 변경 없음'];
      lots = ['Paste ' + (s.lot === 'NEW' ? 'SP-0925B' : 'SP-0911A')];
      hist = ['이상 이력 없음'];
    } else if (id === 'B') {
      kv = [['생산량 (UPH)', perHr], ['흡착률', '99.96%'], ['불량률 (실장)', '0.1%'], ['설비 상태', 'RUN ×2']];
      cond = ['Lane1 MT-01 → EQ-01/02', 'Lane2 MT-02 → EQ-03/04', '실장 압력/속도 표준'];
      people = ['주간 Lane1: 최OO (9년)', '주간 Lane2: 김OO (신규 2주)', '야간 Lane1: 한OO / Lane2: 정OO'];
      changes = ['오늘 07:10 MT-02 Head3 Nozzle 교체', '그제 08:00 Lane2 신규 작업자 배치'];
      lots = ['PCB-0920'];
      hist = ['6개월 전 Nozzle 마모 흡착 불량'];
      see('process.mounter', null);
    } else if (id === 'C') {
      kv = [['생산량 (UPH)', perHr], ['공정 내 판정', '없음'], ['불량률', '최종검사 판정'], ['설비 상태', FDL.EQUIPMENT.filter(function (e) { return snap.perEq[e].status === 'RUN'; }).length + ' / 4 RUN']];
      eqs = FDL.EQUIPMENT.map(function (e) { return '<span class="badge ' + snap.perEq[e].status + '">' + e + ' ' + snap.perEq[e].status + '</span>'; });
      cond = ['표준 레시피: PM220_RF Rev.D (어제 13:30 배포)', 'Peak 245°C · TAL 60~75s', '컨베이어 ' + (78 * s.rate).toFixed(0) + ' cm/min · N2 < 1000ppm'];
      people = ['주간: 이OO (4년)', '야간: 박OO (8개월, Changeover 담당)'];
      changes = ['어제 13:30 레시피 Rev.D 전 설비 배포'];
      lots = ['-'];
      hist = ['3개월 전 (Line 1) 모델 교체 후 레시피 오류로 Void 증가'];
    } else if (id === 'insp') {
      kv = [['검사량 (UPH)', perHr], ['수율', fmtPct(snap.yield) + '%'], ['불량률', fmtPct(snap.defect) + '%'], ['설비 상태', 'RUN']];
      cond = ['AOI 전수 + X-ray 샘플링 (' + (s.fullInspection ? '전수검사 전환됨' : '1/50') + ')', 'AOI 프로그램 v3.2', 'False Call 0.9%'];
      people = ['검사: 주간 2명 / 야간 2명'];
      changes = ['그제 16:00 AOI 프로그램 v3.1 → v3.2'];
      lots = ['검사 중 Lot: 최근 2시간 생산분'];
      hist = ['1년 전 AOI 오검출 증가'];
    } else {
      kv = [['출하 요구', c.kpi.shipmentTarget.toLocaleString()], ['예상 가능', Math.round(snap.projected).toLocaleString()], ['완제품 재고', c.kpi.fgStock.toLocaleString()], ['출하 상태', s.hold ? '보류' : '정상']];
      cond = ['고객 라인 투입: D+1 06:00', '출하 검사 샘플링 AQL 0.65'];
      people = ['출하 담당: 물류팀'];
      changes = [s.hold ? '의심 Lot 출하 보류 중' : '변경 없음'];
      lots = ['FG Lot: 어제 14:00 이후 생산분 포함'];
      hist = ['최근 90일 고객 클레임 0건'];
    }
    var list = function (arr) { return '<ul class="plain">' + arr.map(function (x) { return '<li>' + (x.indexOf('<span') === 0 ? x : esc(x)) + '</li>'; }).join('') + '</ul>'; };
    $('#drawerTitle').textContent = n.step + ' · ' + n.name;
    $('#drawerBody').innerHTML =
      '<div class="kv">' + kv.map(function (k) { return '<div><div class="k">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>'; }).join('') + '</div>' +
      (eqs.length ? '<div class="row">' + eqs.join('') + '</div>' : '') +
      '<div class="sect-title">공정조건</div>' + list(cond) +
      '<div class="sect-title">작업자 정보</div>' + list(people) +
      '<div class="sect-title">최근 변경사항</div>' + list(changes) +
      '<div class="sect-title">Lot 정보</div>' + list(lots) +
      '<div class="sect-title">이상 발생 이력</div>' + list(hist);
  }

  /* ---------------- AI Analyst ---------------- */
  function aiSay(html) {
    var d = document.createElement('div');
    d.className = 'msg ai';
    d.innerHTML = '<div class="who">AI ANALYST</div>' + html;
    $('#chat').appendChild(d);
    $$('.ask', d).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); ask(a.getAttribute('data-q')); }; });
    $('#chat').scrollTop = $('#chat').scrollHeight;
  }
  function ask(q) {
    q = String(q || '').trim();
    if (!q) return;
    var u = document.createElement('div');
    u.className = 'msg user'; u.textContent = q;
    $('#chat').appendChild(u);
    var ty = document.createElement('div');
    ty.className = 'typing'; ty.textContent = 'AI Analyst 분석 중…';
    $('#chat').appendChild(ty);
    $('#chat').scrollTop = $('#chat').scrollHeight;
    setTimeout(function () {
      ty.remove();
      var res = G.analyst.answer(q);
      log('query', res.label || ('AI 질의: ' + q), { q: q, intent: res.intent || null }, res.key);
      if (res.key && G.evidence[res.key] == null) G.evidence[res.key] = now();
      aiSay(res.html);
    }, 450 + Math.random() * 400);
  }
  function renderChips() {
    var qs = ['설비별 불량률 비교해줘', '어제와 오늘 달라진 조건이 뭐야?', 'Lot별로 비교해줘', '야간조와 주간조 차이가 있어?', '시간대별 추이 보여줘'];
    $('#askChips').innerHTML = qs.map(function (q) { return '<button class="chip" type="button">' + esc(q) + '</button>'; }).join('');
    $$('#askChips .chip').forEach(function (b) { b.onclick = function () { ask(b.textContent); }; });
    $('#askForm').onsubmit = function (e) { e.preventDefault(); var v = $('#askInput').value; $('#askInput').value = ''; ask(v); };
  }

  /* ---------------- Hypothesis Board ---------------- */
  var LIKE = ['LOW', 'MEDIUM', 'HIGH'], STATUS = ['검증 전', '검증 중', '기각', '유력'];
  function renderHyps() {
    $('#hypCnt').textContent = G.hypotheses.length;
    if (!G.hypotheses.length) {
      $('#hypList').innerHTML = '<div class="card muted" style="font-size:13px">조사 과정에서 떠오른 원인 후보를 등록하십시오.<br>가설 → 근거 → 검증 → 상태 갱신의 흐름이 Debrief 에 기록됩니다.</div>';
      return;
    }
    $('#hypList').innerHTML = G.hypotheses.map(function (h, i) {
      return '<div class="hyp st-' + h.status + '" data-i="' + i + '"><div class="h-top"><span class="h-title">가설 ' + (i + 1) + ' · ' + esc(h.title) + '</span><button class="h-x" data-del="' + i + '" title="삭제">✕</button></div>' +
        '<div class="h-meta"><span class="badge cat">' + esc(h.cat) + '</span>' +
        '<label class="muted" style="font-size:12px">가능성 <select data-like="' + i + '">' + LIKE.map(function (l) { return '<option' + (l === h.like ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label>' +
        '<label class="muted" style="font-size:12px">상태 <select data-st="' + i + '">' + STATUS.map(function (l) { return '<option' + (l === h.status ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label></div>' +
        '<textarea data-ev="' + i + '" placeholder="근거 (어떤 데이터가 지지/반박하는가)">' + esc(h.evidence) + '</textarea>' +
        '<div class="muted" style="font-size:11px;margin-top:4px">등록 ' + h.clock + (h.updated ? ' · 수정 ' + h.updated : '') + '</div></div>';
    }).join('');
    $$('#hypList [data-like]').forEach(function (el) { el.onchange = function () { updHyp(+el.getAttribute('data-like'), 'like', el.value); }; });
    $$('#hypList [data-st]').forEach(function (el) { el.onchange = function () { updHyp(+el.getAttribute('data-st'), 'status', el.value); }; });
    $$('#hypList [data-ev]').forEach(function (el) { el.onchange = function () { updHyp(+el.getAttribute('data-ev'), 'evidence', el.value); }; });
    $$('#hypList [data-del]').forEach(function (el) {
      el.onclick = function () {
        var i = +el.getAttribute('data-del'), h = G.hypotheses[i];
        if (!confirm('가설 “' + h.title + '” 을 삭제하시겠습니까? (기각 처리를 권장합니다)')) return;
        G.hypotheses.splice(i, 1);
        log('hyp_update', '가설 삭제: ' + h.title);
        renderHyps();
      };
    });
  }
  function updHyp(i, field, val) {
    var h = G.hypotheses[i], old = h[field];
    h[field] = val; h.updated = clock();
    var nm = { like: '가능성', status: '상태', evidence: '근거' }[field];
    log('hyp_update', '가설 수정: ' + h.title + ' — ' + nm + (field === 'evidence' ? ' 갱신' : ' ' + old + ' → ' + val), { field: field, from: old, to: val, title: h.title });
    renderHyps();
  }
  function addHypModal() {
    openModal({
      title: '+ 가설 추가',
      body: '<div class="field"><label>가설 (원인 후보) <span class="req">*</span></label><input type="text" id="hTitle" placeholder="예: 설비 EQ-03 이상 / 원자재 Lot 변경 / 신규 작업자 투입" maxlength="60"></div>' +
        '<div class="row"><div class="field" style="flex:1"><label>구분 (4M)</label><select id="hCat"><option>Machine</option><option>Material</option><option>Man</option><option>Method</option><option>Environment</option><option>Measurement</option></select></div>' +
        '<div class="field" style="flex:1"><label>가능성</label><select id="hLike"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option></select></div>' +
        '<div class="field" style="flex:1"><label>상태</label><select id="hSt"><option>검증 전</option><option>검증 중</option><option>기각</option><option>유력</option></select></div></div>' +
        '<div class="field"><label>근거</label><textarea id="hEv" placeholder="이 가설을 뒷받침하는 데이터 / 확인해야 할 데이터"></textarea></div>',
      foot: '<button class="btn" data-close>취소</button><button class="btn primary" id="hSave">등록</button>',
      onOpen: function (root, close) {
        $('#hSave', root).onclick = function () {
          var title = $('#hTitle', root).value.trim();
          if (!title) { $('#hTitle', root).focus(); return; }
          var h = { title: title, cat: $('#hCat', root).value, like: $('#hLike', root).value, status: $('#hSt', root).value, evidence: $('#hEv', root).value.trim(), clock: clock(), t: now() };
          G.hypotheses.push(h);
          log('hyp', '가설 등록: ' + title + ' (' + h.like + ')', { cat: h.cat, evidence: h.evidence });
          close();
          renderHyps();
          switchTab('hyp');
        };
      }
    });
  }
  function switchTab(tab) {
    $$('.rp-tabs [data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    $('#rpAnalyst').classList.toggle('hidden', tab !== 'analyst');
    $('#rpHyp').classList.toggle('hidden', tab !== 'hyp');
  }

  /* ---------------- DECISION ---------------- */
  function openDecision() {
    if (G.phase !== 'running') return;
    if (G.modalOpen === 'event') { toast('먼저 Alert 을 확인하십시오.'); return; }
    var s = G.model.s, snap = G.model.snapshot();
    var running = FDL.EQUIPMENT.filter(function (id) { return s.eq[id].status === 'RUN'; });
    var stopped = FDL.EQUIPMENT.filter(function (id) { return s.eq[id].status === 'STOP'; });
    var avail = FDL.ACTIONS.filter(function (a) {
      if (a.id === 'restart_eq') return stopped.length > 0;
      if (a.id === 'resume_all') return s.lineStopped;
      if (a.id === 'stop_all') return !s.lineStopped;
      if (a.id === 'stop_eq') return running.length > 0 && !s.lineStopped;
      if (a.id === 'quarantine_lot') return s.lot === 'NEW' && (s.oldStock == null || s.oldStock > 0);
      if (a.id === 'full_inspection') return !s.fullInspection;
      if (a.id === 'hold_shipment') return !s.hold;
      if (a.id === 'customer_comm') return !s.commDone;
      if (a.id === 'overtime') return !s.overtime;
      if (a.id === 'reduce') return s.rate === 1;
      return true;
    });
    var tgt = function (a) {
      var list = a.target === 'eqRunning' ? running : a.target === 'eqStopped' ? stopped : FDL.EQUIPMENT;
      return '<select data-target="' + a.id + '">' + list.map(function (id) { return '<option>' + id + '</option>'; }).join('') + '</select>';
    };
    var item = function (a) {
      return '<label class="action-item" data-act="' + a.id + '"><input type="checkbox" value="' + a.id + '"><div><div class="a-label">' + esc(a.label) + '</div><div class="a-desc">' + esc(a.desc) + '</div>' + (a.target ? tgt(a) : '') + (a.id === 'other' ? '<input type="text" data-other placeholder="조치 내용 입력" style="margin-top:6px;width:100%">' : '') + '</div></label>';
    };
    var groups = [['core', '주요 조치'], ['extra', '추가 조치'], ['recover', '복구']];
    var body = '<p style="margin:0;font-size:15px"><b>현재 상황에서 어떤 조치를 취하시겠습니까?</b> <span class="muted">(복수 선택 가능)</span></p>' +
      '<div class="row muted" style="font-size:12px">현재: 불량률 ' + fmtPct(snap.defect) + '% · 생산량 ' + fmtPct(snap.production) + '% · 납기 ' + lvlSpan(snap.delivery) + ' · 고객 ' + lvlSpan(snap.customer) + '</div>' +
      groups.map(function (g) {
        var items = avail.filter(function (a) { return a.group === g[0]; });
        return items.length ? '<div class="group-title">' + g[1] + '</div><div class="action-list">' + items.map(item).join('') + '</div>' : '';
      }).join('') +
      '<div class="field"><label>이 판단의 근거는 무엇입니까? <span class="req">*</span></label><textarea id="dRationale" placeholder="확인한 데이터, 고려한 Trade-off, 기대하는 효과를 기록하십시오." style="min-height:90px"></textarea></div>';
    openModal({
      cls: 'wide', title: 'DECISION — ' + clock(), kind: 'decision', body: body,
      foot: '<span class="muted" style="margin-right:auto;font-size:12px">시간은 계속 흐르고 있습니다.</span><button class="btn" data-close>취소</button><button class="btn primary" id="dRun">의사결정 실행</button>',
      onOpen: function (root, close) {
        $$('.action-item input[type=checkbox]', root).forEach(function (cb) {
          cb.onchange = function () { cb.closest('.action-item').classList.toggle('on', cb.checked); };
        });
        $$('.action-item select, .action-item input[type=text]', root).forEach(function (el) {
          el.onfocus = function () { var cb = el.closest('.action-item').querySelector('input[type=checkbox]'); if (!cb.checked) { cb.checked = true; cb.onchange(); } };
        });
        $('#dRun', root).onclick = function () {
          var chosen = $$('.action-item input[type=checkbox]:checked', root).map(function (cb) {
            var id = cb.value, a = FDL.ACTIONS.filter(function (x) { return x.id === id; })[0];
            var tEl = root.querySelector('[data-target="' + id + '"]');
            var o = { id: id, label: a.label, target: tEl ? tEl.value : null };
            if (id === 'other') o.text = (root.querySelector('[data-other]').value || '').trim();
            return o;
          });
          var rationale = $('#dRationale', root).value.trim();
          if (!chosen.length) { toast('조치를 하나 이상 선택하십시오.'); return; }
          if (chosen.some(function (c) { return c.id === 'other' && !c.text; })) { toast('기타 조치 내용을 입력하십시오.'); return; }
          if (rationale.length < 5) { $('#dRationale', root).focus(); toast('판단 근거를 입력하십시오.'); return; }
          G.modalOpen = null;
          close();
          execDecision(chosen, rationale);
        };
      }
    });
  }

  function execDecision(chosen, rationale) {
    var M = G.model, before = M.snapshot(), notes = [];
    chosen.forEach(function (a) {
      if (a.id === 'other') { notes.push('기타 조치 기록: ' + a.text); return; }
      notes = notes.concat(M.apply(a.id, a.target));
    });
    var after = M.snapshot();
    // 즉시 KPI 반영을 history 마지막 값에 덮어쓰기 (차트 연속성)
    var rec = M.history[M.history.length - 1];
    if (rec && M.history.length > 1) { rec.defect = r1(after.defect); rec.production = r1(after.production); rec.yield = r1(after.yield); rec.util = r1(after.util); rec.delivery = after.delivery; rec.customer = after.customer; FDL.EQUIPMENT.forEach(function (id) { rec.perEq[id] = { s: after.perEq[id].status, d: r1(after.perEq[id].defect) }; }); }
    var d = log('decision', '의사결정: ' + chosen.map(function (a) { return a.label + (a.target ? ' (' + a.target + ')' : '') + (a.text ? ' — ' + a.text : ''); }).join(', '), {
      actions: chosen, rationale: rationale, notes: notes,
      before: { defect: r1(before.defect), production: r1(before.production), delivery: before.delivery, customer: before.customer },
      after: { defect: r1(after.defect), production: r1(after.production), delivery: after.delivery, customer: after.customer }
    });
    showConsequence(before, after, notes, d);
    kpiChangeLog({ defect: after.defect, delivery: after.delivery, customer: after.customer });
    renderKpis(); renderView(true);
    // 즉시 조건 이벤트 점검 (예: 생산 차질)
    setTimeout(function () { conditionalEvents(M.history[M.history.length - 1] ? Object.assign({}, M.history[M.history.length - 1], { production: after.production, defect: after.defect }) : after); }, 1200);
  }

  function showConsequence(b, a, notes) {
    var rows = [
      ['불량률', fmtPct(b.defect) + '%', fmtPct(a.defect) + '%', a.defect < b.defect - 0.05 ? 'better' : a.defect > b.defect + 0.05 ? 'worse' : ''],
      ['수율', fmtPct(b.yield) + '%', fmtPct(a.yield) + '%', a.yield > b.yield + 0.05 ? 'better' : a.yield < b.yield - 0.05 ? 'worse' : ''],
      ['생산량', fmtPct(b.production) + '%', fmtPct(a.production) + '%', a.production > b.production + 0.05 ? 'better' : a.production < b.production - 0.05 ? 'worse' : ''],
      ['설비가동률', fmtPct(b.util) + '%', fmtPct(a.util) + '%', a.util > b.util + 0.05 ? 'better' : a.util < b.util - 0.05 ? 'worse' : ''],
      ['납기 Risk', lvlSpan(b.delivery), lvlSpan(a.delivery), rank(a.delivery) < rank(b.delivery) ? 'better' : rank(a.delivery) > rank(b.delivery) ? 'worse' : ''],
      ['Customer Risk', lvlSpan(b.customer), lvlSpan(a.customer), rank(a.customer) < rank(b.customer) ? 'better' : rank(a.customer) > rank(b.customer) ? 'worse' : '']
    ];
    var tasks = G.model.s.tasks.map(function (t) { return '<li><span class="when">~' + G.model.clock(t.doneAt) + '</span>' + (t.type === 'inspection' ? t.eq + ' 긴급점검 결과 보고 예정' : t.type === 'recipe' ? t.eq + ' 레시피 재로드 완료 예정' : '공급사 회신 예정') + '</li>'; }).join('');
    openModal({
      cls: 'wide', title: 'CONSEQUENCE — 조치 실행 결과', right: '<span class="alert-time">' + clock() + '</span>',
      body: '<ul class="plain">' + notes.map(function (n) { return '<li>▸ ' + esc(n) + '</li>'; }).join('') + '</ul>' +
        '<table class="data diff-table"><thead><tr><th>KPI</th><th class="num">실행 전</th><th></th><th class="num">실행 직후</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="arrow">→</td><td class="num ' + r[3] + '">' + r[2] + '</td></tr>'; }).join('') + '</tbody></table>' +
        (tasks ? '<div class="sect-title">진행 중 조치</div><ul class="plain">' + tasks + '</ul>' : '') +
        '<p class="muted" style="margin:0">조치의 효과와 부작용은 이후 KPI·Event·데이터 변화로 이어집니다. 상황을 계속 모니터링하십시오.</p>',
      foot: '<button class="btn primary" data-close>상황 모니터링 계속</button>'
    });
  }
  function rank(l) { return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[l]; }

  /* ---------------- FINAL DECISION ---------------- */
  var RC_OPTIONS = [
    '신규 Solder Paste Lot (SP-0925B) 특성 변화',
    'Reflow 설비 온도 이상 (열전대/Heater)',
    'Reflow 레시피/공정조건 Setting 오류 (Changeover)',
    'PCB Lot 변경',
    '신규 작업자 투입',
    'Mounter Nozzle 교체',
    'AOI 검사 프로그램 변경',
    '공조 습도 변화'
  ];
  var MON_KPI = ['설비별 불량률', 'Lot별 불량률', 'Reflow Profile 실측 (주기)', 'Heater 출력 %', 'Changeover 후 초품 검사 결과', 'Bridge/Void 유형 불량률', '고객 입고 불량 (PPM)', '생산 달성률'];

  function openFinal(forced) {
    if (G.phase === 'result') return;
    if (!forced && !confirm('FINAL DECISION 을 작성하시겠습니까?\n(작성 중에도 시간은 흐릅니다. 제출하면 시뮬레이션이 종료됩니다.)')) return;
    G.phase = 'final';
    log('system', forced ? 'Final Decision (시간 종료)' : 'Final Decision 작성 시작');
    var eqOpts = '<select id="fRcEq"><option value="">설비 선택</option>' + FDL.EQUIPMENT.map(function (id) { return '<option>' + id + '</option>'; }).join('') + '</select>';
    $('#fullpage').innerHTML = '<div class="fp-inner"><div class="res-head"><div><div class="eyebrow">' + clock() + ' · ' + esc(G.team) + '</div><h1>FINAL DECISION</h1><p class="muted" style="margin:0">책임자로서 최종 판단을 제출하십시오. 정답 여부가 아니라 판단의 구조와 근거가 Debrief 됩니다.</p></div>' +
      (forced ? '<span class="badge STOP" style="font-size:13px">TIME OVER</span>' : '<button class="btn" id="fBack">← 현장으로 돌아가기</button>') + '</div>' +
      '<div class="final-grid">' +
      '<div class="card full"><h3>1. Root Cause <span class="tag">복수 선택 + 서술</span></h3><div class="check-grid">' +
      RC_OPTIONS.map(function (o, i) { return '<label><input type="checkbox" value="' + esc(o) + '" data-rc="' + i + '">' + esc(o) + (i === 1 || i === 2 ? ' — 대상 설비 ' + (i === 1 ? eqOpts : eqOpts.replace('fRcEq', 'fRcEq2')) : '') + '</label>'; }).join('') +
      '</div><textarea id="fRc" placeholder="원인 구조를 서술하십시오. (요인 간 관계, 근거 데이터)" style="margin-top:8px"></textarea></div>' +
      '<div class="card"><h3>2. Immediate Action</h3><textarea id="fImm" placeholder="지금 즉시 실행할 조치 (격리·정지·점검·검사 등)"></textarea></div>' +
      '<div class="card"><h3>3. Production Decision</h3><textarea id="fProd" placeholder="생산 지속/축소/중단/재개 판단과 조건"></textarea></div>' +
      '<div class="card"><h3>4. Collaboration</h3><textarea id="fCol" placeholder="누구와 무엇을 협업할 것인가 (품질·생산관리·구매·설비·기술·고객 등)"></textarea></div>' +
      '<div class="card"><h3>5. Customer Response</h3><textarea id="fCus" placeholder="유출 범위, 임시 조치, 보고 일정, 커뮤니케이션 방식"></textarea></div>' +
      '<div class="card"><h3>6. Recurrence Prevention</h3><textarea id="fPrev" placeholder="재발방지 대책 (표준·체크리스트·인터락·변경점 관리 등)"></textarea></div>' +
      '<div class="card"><h3>7. Monitoring KPI</h3><div class="chips" id="fMon">' + MON_KPI.map(function (k) { return '<button type="button" class="chip">' + esc(k) + '</button>'; }).join('') + '</div><input type="text" id="fMonTxt" placeholder="추가 KPI / 목표값 / 모니터링 기간" style="margin-top:8px;width:100%"></div>' +
      '</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary lg" id="fSubmit">FINAL DECISION 제출</button></div></div>';
    $('#fullpage').classList.remove('hidden');
    $('#fullpage').scrollTop = 0;
    $$('#fMon .chip').forEach(function (c) { c.onclick = function () { c.classList.toggle('on'); }; });
    var back = $('#fBack');
    if (back) back.onclick = function () { G.phase = 'running'; $('#fullpage').classList.add('hidden'); log('system', 'Final Decision 작성 취소 — 현장 복귀'); };
    $('#fSubmit').onclick = submitFinal;
  }

  function submitFinal() {
    var checks = $$('#fullpage [data-rc]:checked').map(function (c) {
      var i = +c.getAttribute('data-rc');
      if (i === 1) return c.value + ' [' + $('#fRcEq').value + ']';
      if (i === 2) return c.value + ' [' + $('#fRcEq2').value + ']';
      return c.value;
    });
    var rcSel = $$('#fullpage [data-rc]:checked').map(function (c) {
      var i = +c.getAttribute('data-rc');
      return { i: i, eq: i === 1 ? $('#fRcEq').value : i === 2 ? $('#fRcEq2').value : null };
    });
    var f = {
      rootCauseChecks: checks, rcSel: rcSel, rootCauseText: $('#fRc').value.trim(),
      immediate: $('#fImm').value.trim(), production: $('#fProd').value.trim(), collaboration: $('#fCol').value.trim(),
      customer: $('#fCus').value.trim(), prevention: $('#fPrev').value.trim(),
      monitoring: $$('#fMon .chip.on').map(function (c) { return c.textContent; }), monitoringText: $('#fMonTxt').value.trim()
    };
    if (rcSel.some(function (x) { return (x.i === 1 || x.i === 2) && !x.eq; })) { toast('설비 관련 원인의 대상 설비를 선택하십시오.'); return; }
    if (!checks.length && !f.rootCauseText) { toast('Root Cause 를 선택하거나 서술하십시오.'); return; }
    var empty = ['immediate', 'production', 'collaboration', 'customer', 'prevention'].filter(function (k) { return !f[k]; });
    if (empty.length && !confirm('비어 있는 항목이 ' + empty.length + '개 있습니다. 그대로 제출하시겠습니까?')) return;
    // Root Cause 의 설비 선택은 체크 항목 텍스트에 포함되어 분류됨
    G.final = f;
    log('final', 'Final Decision 제출', f);
    G.phase = 'result';
    clearInterval(G.timer);
    G.finishedAt = new Date().toISOString();
    G.result = FDL.score(G);
    var saved = saveResult();
    renderResult(saved);
  }

  /* ---------------- 결과 ---------------- */
  function resultPayload() {
    return {
      app: 'factory-decision-lab', v: 1,
      team: G.team, caseId: G.cfg.caseId, caseName: G.cfg.caseName, difficulty: G.cfg.difficulty,
      rootCause: G.cfg.rootCause, start: G.startRec, startedAt: G.startedAt, finishedAt: G.finishedAt, gameMinutes: now(),
      log: G.log, hypotheses: G.hypotheses, final: G.final, history: G.model.history, score: G.result,
      evidence: G.evidence
    };
  }
  function saveResult() {
    var list = FDL.store.get('fdl.results', []);
    var p = resultPayload();
    p.id = 'r' + Date.now();
    list.push(p);
    while (list.length > 40) list.shift();
    return FDL.store.set('fdl.results', list);
  }

  function renderResult(saved) {
    var R = G.result, h = G.model.history, st = G.startRec, en = h[h.length - 1];
    var rc = G.cfg.rootCause;
    var domCards = FDL.DOMAINS.map(function (d) {
      var x = R.domains[d.id];
      return '<div class="dcard"><div class="d-top"><div class="d-name">' + d.label + '<span class="d-ko">' + d.ko + '</span></div><span class="d-lv">' + x.level + ' · ' + x.score + '</span></div><div class="meter"><i style="width:' + x.score + '%"></i></div><ul>' + x.feedback.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    var radar = FDL.charts.radar({ axes: FDL.DOMAINS.map(function (d) { return d.ko; }), series: [{ name: G.team, color: '#3987e5', values: FDL.DOMAINS.map(function (d) { return R.domains[d.id].score; }) }] });
    var kpiRows = [
      ['불량률', st.defect + '%', en.defect + '%'], ['수율', st.yield + '%', en.yield + '%'], ['생산량', st.production + '%', en.production + '%'],
      ['설비가동률', st.util + '%', en.util + '%'], ['납기 Risk', lvlSpan(st.delivery), lvlSpan(en.delivery)], ['Customer Risk', lvlSpan(st.customer), lvlSpan(en.customer)]
    ];
    // 실제 원인 구조
    var factors = [];
    if (rc.material) factors.push({ f: 'material', t: '원자재 Lot 변경', d: 'SP-0925B (Flux 배합 변경, 점도 상한 근접) 어제 14:00 투입' });
    if (rc.eqId && rc.tcDrift) factors.push({ f: 'equipment', t: rc.eqId + ' 설비 조건', d: 'Zone 6 제어 열전대 편차 → 실제 온도 +7°C (Heater 출력 경고 반복)' });
    if (rc.eqId && rc.recipeError) factors.push({ f: 'setting', t: '야간조 Setting 오류', d: '어제 22:40 ' + rc.eqId + ' Changeover 시 구 레시피 Rev.C 로드 (체크시트에 버전 확인란 없음)' });
    var finC = R.domains.HQ.finCovered || [];
    var rcHtml = factors.map(function (x, i) {
      var found = R.factorFirst[x.f];
      var hit = finC.indexOf(x.f) >= 0;
      return (i ? '<div class="plus">+</div>' : '') + '<div class="rc-item ' + (hit ? 'hit' : 'miss') + '"><div class="rc-st">' + (hit ? '✓ 최종 판단에 포함' : '✕ 최종 판단에서 누락') + '</div><b>' + esc(x.t) + '</b><div class="muted" style="font-size:12px;margin-top:4px">' + esc(x.d) + '</div><div style="font-size:12px;margin-top:6px">관련 데이터 첫 확인: ' + (found != null ? G.model.clock(found) : '<span class="muted">확인 안 함</span>') + '</div></div>';
    }).join('');
    var rcCols = factors.length === 3 ? '1fr 20px 1fr 20px 1fr' : factors.length === 2 ? '1fr 20px 1fr' : '1fr';
    var labels = h.map(function (r) { return r.clock; });
    var traj = '<div class="flabel">불량률 (%)</div>' + FDL.charts.line({ labels: labels, width: 560, height: 170, series: [{ name: '불량률', color: '#ec835a', values: h.map(function (r) { return r.defect; }) }], unit: '%', markers: decisionMarkers(), refLines: [{ value: G.cfg.effects.base, label: '평시' }], title: '불량률 궤적' }) +
      '<div class="flabel" style="margin-top:8px">생산량 (계획 대비 %)</div>' + FDL.charts.line({ labels: labels, width: 560, height: 170, series: [{ name: '생산량', color: '#3987e5', values: h.map(function (r) { return r.production; }) }], unit: '%', yMin: 0, yMax: 100, markers: decisionMarkers(), title: '생산량 궤적' });
    $('#app').classList.add('hidden');
    closeDrawer();
    $('#fullpage').innerHTML = '<div class="fp-inner">' +
      '<div class="res-head"><div><div class="eyebrow">DEBRIEF · ' + esc(G.cfg.caseName) + '</div><h1>RESULT DASHBOARD</h1><div class="muted">' + esc(G.team) + ' · 09:00 → ' + clock() + ' (' + now() + '분) · 의사결정 ' + G.log.filter(function (l) { return l.type === 'decision'; }).length + '회 · 가설 ' + G.hypotheses.length + '개 · AI 질의 ' + G.log.filter(function (l) { return l.type === 'query'; }).length + '회</div></div>' +
      '<div class="toolbar"><button class="btn" id="rJson">결과 JSON 저장</button><button class="btn" id="rPrint">인쇄 / PDF</button><button class="btn primary" id="rAgain">다시 시작</button></div></div>' +
      (saved ? '<p class="muted" style="font-size:12px;margin-top:-6px">✓ 이 브라우저에 결과가 저장되었습니다. 강사는 Instructor Mode → Debrief 에서 팀별 비교가 가능합니다. (다른 PC 라면 JSON 파일을 제출하십시오)</p>' : '') +
      '<div class="grid c2" style="margin-bottom:12px"><div class="card"><h3>판단 역량 프로필</h3>' + radar + '<div class="note">점수는 순위가 아니라, 판단 과정에서 “무엇을 했고 무엇을 놓쳤는지”를 돌아보기 위한 지표입니다.</div></div>' +
      '<div class="card"><h3>KPI 변화 (시작 → 종료)</h3><table class="data"><thead><tr><th>KPI</th><th class="num">09:00</th><th class="num">' + en.clock + '</th></tr></thead><tbody>' + kpiRows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h3 style="margin-top:14px">KPI 궤적 <span class="tag">D# = 의사결정 시점</span></h3>' + traj + '</div></div>' +
      '<div class="card" style="margin-bottom:12px"><h3>HIDDEN ROOT CAUSE — 실제 원인 구조</h3><div class="rc-box" style="grid-template-columns:' + rcCols + '">' + rcHtml + '</div>' +
      '<div class="note">Noise: PCB Lot 변경 · 신규 작업자 · MT-02 Nozzle 교체 · AOI 프로그램 변경 · 공조 습도 변경' + (rc.material ? '' : ' · 신규 Paste Lot') + '</div></div>' +
      '<h2 style="font-size:16px;margin:18px 0 10px">6대 판단 영역 피드백</h2><div class="domain-cards" style="margin-bottom:12px">' + domCards + '</div>' +
      '<div class="grid c2"><div class="card"><h3>DECISION TIMELINE <label class="muted" style="font-size:12px;font-weight:400"><input type="checkbox" id="tlAll"> 탐색 로그 모두 보기</label></h3><div class="timeline" id="tl"></div></div>' +
      '<div><div class="card" style="margin-bottom:12px"><h3>FINAL DECISION 제출 내용</h3>' + finalSummary() + '</div>' +
      '<div class="card"><h3>DEBRIEF 질문</h3><ol class="debrief-q">' +
      ['첫 10분 동안 무엇을 근거로 상황의 심각도를 판단했습니까?', '가장 먼저 세운 가설은 무엇이었고, 어떤 데이터가 그 가설을 바꾸게 했습니까?', '품질과 납기 사이에서 가장 어려웠던 Trade-off 는 무엇이었습니까? 다시 한다면 어떻게 하겠습니까?', '하나의 원인을 찾은 뒤 “이것으로 전체 현상이 설명되는가?”를 어떻게 검증했습니까?', '우리 현장에서 같은 구조(변경점 + 설비 조건 + 교대 Setting)의 문제가 생길 수 있는 곳은 어디입니까?']
        .map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol></div></div></div></div>';
    $('#fullpage').classList.remove('hidden');
    $('#fullpage').scrollTop = 0;
    renderTimeline(false);
    $('#tlAll').onchange = function () { renderTimeline(this.checked); };
    $('#rJson').onclick = function () { downloadJson(resultPayload(), 'FDL_' + G.team.replace(/[^\w가-힣-]+/g, '_') + '_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.json'); };
    $('#rPrint').onclick = function () { window.print(); };
    $('#rAgain').onclick = function () { location.reload(); };
  }

  function finalSummary() {
    var f = G.final || {};
    var rows = [['Root Cause', (f.rootCauseChecks || []).join(' / ') + (f.rootCauseText ? '\n' + f.rootCauseText : '')], ['Immediate Action', f.immediate], ['Production Decision', f.production], ['Collaboration', f.collaboration], ['Customer Response', f.customer], ['Recurrence Prevention', f.prevention], ['Monitoring KPI', (f.monitoring || []).join(', ') + (f.monitoringText ? ' · ' + f.monitoringText : '')]];
    return '<table class="data">' + rows.map(function (r) { return '<tr><td class="muted" style="width:34%">' + r[0] + '</td><td style="white-space:pre-wrap">' + (r[1] ? esc(r[1]) : '<span class="muted">(미작성)</span>') + '</td></tr>'; }).join('') + '</table>';
  }

  function renderTimeline(all) { $('#tl').innerHTML = FDL.timelineHtml(G.log, all); }

  function downloadJson(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------------- 바인딩 ---------------- */
  function bindShell() {
    $('#decisionBtn').onclick = openDecision;
    $('#finalBtn').onclick = function () { openFinal(false); };
    $('#addHypBtn').onclick = addHypModal;
    $('#drawerClose').onclick = closeDrawer;
    $$('.rp-tabs [data-tab]').forEach(function (b) { b.onclick = function () { switchTab(b.getAttribute('data-tab')); }; });
    $('#panelOpen').onclick = function () { $('#rightpanel').classList.add('open'); };
    $('#panelClose').onclick = function () { $('#rightpanel').classList.remove('open'); };
    $('#pauseBtn').onclick = function () {
      G.paused = !G.paused;
      this.textContent = G.paused ? '▶ 재개' : '⏸ 일시정지';
      log('system', G.paused ? '강사 일시정지' : '진행 재개');
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if ($('#drawer').classList.contains('open')) closeDrawer(); $('#rightpanel').classList.remove('open'); }
    });
    if (!vis('analyst')) {
      $('#rpAnalyst').innerHTML = '<div class="chat"><div class="card muted">이번 세션에서는 AI Analyst 가 제공되지 않습니다.</div></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    FDL.charts.initTooltip();
    bindShell();
    renderBrief();
  });
})();
