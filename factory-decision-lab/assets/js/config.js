/* ==========================================================================
   FACTORY DECISION LAB — Case configuration
   - 모든 수치/데이터는 이 설정(Hidden Variables)에서 모델로 계산됩니다.
   - 강사 모드(admin.html)에서 수정 → localStorage 또는 URL(#cfg=)로 배포
   ========================================================================== */
window.FDL = window.FDL || {};

FDL.EQUIPMENT = ['EQ-01', 'EQ-02', 'EQ-03', 'EQ-04'];

/* 의사결정 조치 목록 (params 는 강사 모드에서 수정 가능) */
FDL.ACTIONS = [
  { id: 'continue', group: 'core', label: '생산 지속', desc: '현 조건 그대로 생산을 유지합니다.', params: {} },
  { id: 'reduce', group: 'core', label: '생산량 축소', desc: '라인 속도를 낮춰 생산합니다. (Reflow 체류시간 증가)',
    params: { rate: 0.75, interactionRelief: 0.3 } },
  { id: 'stop_eq', group: 'core', label: '특정 설비 정지', desc: '선택한 Reflow 설비를 정지하고 물량을 타 설비로 분산합니다.',
    target: 'eqRunning', params: { shiftGain: 0.08 } },
  { id: 'stop_all', group: 'core', label: '전체 생산 중단', desc: '라인 전체 생산을 중단합니다.', params: {} },
  { id: 'quarantine_lot', group: 'core', label: '원자재 Lot 격리', desc: '신규 Solder Paste Lot(SP-0925B)을 격리하고 이전 Lot(SP-0911A)으로 교체합니다. 이전 Lot 재고는 제한적입니다.',
    params: { stockMin: 28, wipLoss: 3 } },
  { id: 'full_inspection', group: 'core', label: '전수검사 실시', desc: '최종검사 X-ray/육안 전수검사로 유출을 차단합니다. 검사 병목이 발생합니다.',
    params: { productionFactor: 0.88, escapeRate: 0.02 } },
  { id: 'eq_inspection', group: 'core', label: '설비 긴급점검', desc: '선택 설비를 일시 정지하고 Profiler 실측·열전대·레시피를 점검합니다.',
    target: 'eqAny', params: { durationMin: 10 } },
  { id: 'recipe_reset', group: 'extra', label: '레시피/공정조건 재설정', desc: '선택 설비의 Reflow 레시피를 표준(최신 Rev.)으로 재로드합니다.',
    target: 'eqAny', params: { durationMin: 4 } },
  { id: 'supplier_inquiry', group: 'extra', label: '공급사 긴급 문의', desc: 'Solder Paste 공급사에 Lot 변경점·품질 이력 확인을 요청합니다.',
    params: { replyMin: 8 } },
  { id: 'hold_shipment', group: 'extra', label: '의심 Lot 출하 보류', desc: '어제 14:00 이후 생산분 출하를 보류하고 재검 후 출하합니다.',
    params: { deliveryPenalty: 7, exposureCut: 0.45 } },
  { id: 'customer_comm', group: 'extra', label: '고객사 선제 커뮤니케이션', desc: '고객 품질팀에 현황·조치계획을 선제 공유합니다.',
    params: { exposureRelief: 1.0 } },
  { id: 'overtime', group: 'extra', label: '잔업·특근 편성', desc: '잔업/특근으로 부족 물량 만회 계획을 수립합니다.',
    params: { deliveryBonus: 9 } },
  { id: 'restart_eq', group: 'recover', label: '정지 설비 재가동', desc: '정지한 설비를 다시 가동합니다.', target: 'eqStopped', params: {} },
  { id: 'resume_all', group: 'recover', label: '전체 생산 재개', desc: '중단된 라인 생산을 재개합니다.', params: {} },
  { id: 'other', group: 'core', label: '기타 (직접 입력)', desc: '위에 없는 조치를 직접 입력합니다.', params: {} }
];

/* 데이터 모듈 공개 설정 */
FDL.DATA_MODULES = [
  { id: 'quality.trend7d', menu: 'Quality', label: '불량 Trend (7일)' },
  { id: 'quality.hourly', menu: 'Quality', label: '시간대별 불량 추이' },
  { id: 'quality.pareto', menu: 'Quality', label: '불량 유형 Pareto' },
  { id: 'quality.strat', menu: 'Quality', label: '층별 분석 (설비/Lot/조/작업자)' },
  { id: 'quality.cross', menu: 'Quality', label: '교차 분석 (2차원)' },
  { id: 'equipment.list', menu: 'Equipment', label: '설비 현황' },
  { id: 'equipment.detail', menu: 'Equipment', label: '설비 상세 (공정조건/알람)' },
  { id: 'production.plan', menu: 'Production', label: '생산계획/출하' },
  { id: 'material.lots', menu: 'Material', label: '원자재 Lot 이력' },
  { id: 'material.coa', menu: 'Material', label: '수입검사 / COA' },
  { id: 'people.roster', menu: 'People', label: '근무조/작업자' },
  { id: 'people.worklog', menu: 'People', label: '작업일지 (Changeover 기록)' },
  { id: 'history.changes', menu: 'History', label: '4M 변경점 이력' },
  { id: 'history.incidents', menu: 'History', label: '과거 이상 발생 이력' },
  { id: 'analyst', menu: 'AI', label: 'AI Manufacturing Analyst' }
];

FDL.DOMAINS = [
  { id: 'SA', label: 'Situation Awareness', ko: '상황 인지' },
  { id: 'DA', label: 'Data Analysis', ko: '데이터 분석' },
  { id: 'HQ', label: 'Hypothesis Quality', ko: '가설 품질' },
  { id: 'DM', label: 'Decision Making', ko: '의사결정' },
  { id: 'TM', label: 'Trade-off Management', ko: 'Trade-off 관리' },
  { id: 'AD', label: 'Adaptability', ko: '적응력' }
];

/* 시간 이벤트 (T+분) — message 가 비어 있으면 상황에 따라 동적 문구 사용 */
FDL.DEFAULT_EVENTS = [
  { id: 'defect_rise', minute: 10, enabled: true, type: 'QUALITY', title: 'QUALITY ALERT — 불량 추가 증가', message: '' },
  { id: 'plan_request', minute: 20, enabled: true, type: 'PRODUCTION', title: 'PRODUCTION ALERT — 생산계획팀 긴급 요청', message: '' },
  { id: 'customer_inquiry', minute: 30, enabled: true, type: 'CUSTOMER', title: 'CUSTOMER ALERT — 고객사 품질팀 문의', message: '' },
  { id: 'other_line', minute: 40, enabled: true, type: 'QUALITY', title: 'QUALITY ALERT — 타 라인 동일 현상 발견', message: '' }
];

FDL.DEFAULT_CONFIG = {
  version: 1,
  caseId: 'A',
  caseName: 'SMT Line 2 — 전장용 파워모듈 PM-220 불량 급증',
  difficulty: 'NORMAL',
  timeLimitMin: 45,
  speed: 1,
  startClock: '09:00',
  seed: 20260929,
  rootCause: {
    material: true,       // 신규 Solder Paste Lot 영향
    eqId: 'EQ-03',        // 이상 설비
    recipeError: true,    // 야간조 Changeover 시 구 레시피(Rev.C) 로드
    tcDrift: true         // 해당 설비 Zone 6 열전대 편차
  },
  effects: {
    base: 1.9,            // 정상 불량률 (%)
    lotEffect: 1.3,       // 신규 Lot 단독 영향 (전 설비)
    recipeEffect: 1.0,    // 구 레시피 단독 영향
    interaction: 8.6,     // 신규 Lot × 구 레시피 결합 영향
    tcDrift: 0.8,         // 열전대 편차 영향 (현재)
    tcDriftRamp: 0.1      // 방치 시 분당 추가 악화 (%p)
  },
  kpi: {
    baseCapacity: 96,     // 생산량 계획 대비 기준 (%)
    baseUtil: 87,         // 설비가동률 기준 (%)
    deliveryBias: 0,      // 납기 예측 보정 (%p)
    customerExposure0: 0.6, // 고객 Risk 초기 노출도
    shipmentTarget: 12000, // 금일 18:00 출하 요구 수량
    fgStock: 3100,        // 09:00 기준 완제품 재고 (어제 14:00 이후 생산분 포함)
    planPerHour: 1100     // 시간당 계획 생산량 (ea)
  },
  events: JSON.parse(JSON.stringify(FDL.DEFAULT_EVENTS)),
  conditionalEvents: {
    capacityAlert: true, stopAllEscalation: true, materialStock: true,
    customerEscalation: true, inspectionBottleneck: true, qualityCritical: true
  },
  dataVisibility: {},     // { moduleId: 'hidden' } — 기본은 모두 공개
  actionParams: {},       // { actionId: { param: value } } — ACTIONS 기본값 덮어쓰기
  weights: { SA: 1, DA: 1, HQ: 1, DM: 1, TM: 1, AD: 1 }
};

FDL.CASE_PRESETS = {
  A: {
    name: 'Case A · 복합 원인 (표준)',
    caseName: 'SMT Line 2 — 전장용 파워모듈 PM-220 불량 급증',
    desc: '원자재 Lot 변경 + 특정 설비 공정조건 + 야간조 Setting 오류가 결합된 표준 케이스',
    rootCause: { material: true, eqId: 'EQ-03', recipeError: true, tcDrift: true },
    effects: { base: 1.9, lotEffect: 1.3, recipeEffect: 1.0, interaction: 8.6, tcDrift: 0.8, tcDriftRamp: 0.1 }
  },
  B: {
    name: 'Case B · 원자재 단독 (입문)',
    caseName: 'SMT Line 2 — Solder Paste 변경 후 불량 증가',
    desc: '신규 원자재 Lot 단독 원인. 설비별 차이가 없어 Lot 층별이 핵심',
    rootCause: { material: true, eqId: null, recipeError: false, tcDrift: false },
    effects: { base: 1.9, lotEffect: 3.9, recipeEffect: 0, interaction: 0, tcDrift: 0, tcDriftRamp: 0 }
  },
  C: {
    name: 'Case C · 설비 + Setting (원자재 무관)',
    caseName: 'SMT Line 2 — 특정 Reflow 불량 급증',
    desc: '신규 Lot 투입은 Noise. 설비 열전대 편차 + 야간조 레시피 오류가 원인. Lot 격리는 효과 없음',
    rootCause: { material: false, eqId: 'EQ-02', recipeError: true, tcDrift: true },
    effects: { base: 1.9, lotEffect: 0, recipeEffect: 13.4, interaction: 0, tcDrift: 0.9, tcDriftRamp: 0.08 }
  }
};

FDL.DIFFICULTY = {
  EASY: { label: 'EASY', timeLimitMin: 50, hints: 'high', recipeInList: true },
  NORMAL: { label: 'NORMAL', timeLimitMin: 45, hints: 'mid', recipeInList: false },
  HARD: { label: 'HARD', timeLimitMin: 35, hints: 'low', recipeInList: false, recipeHidden: true }
};

/* ---------- 유틸 ---------- */
FDL.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

FDL.deepMerge = function (base, over) {
  if (!over || typeof over !== 'object') return base;
  Object.keys(over).forEach(function (k) {
    var v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      FDL.deepMerge(base[k], v);
    } else {
      base[k] = v;
    }
  });
  return base;
};

FDL.actionParam = function (cfg, actionId, key) {
  var o = cfg.actionParams && cfg.actionParams[actionId];
  if (o && o[key] !== undefined && o[key] !== '') return Number(o[key]);
  var a = FDL.ACTIONS.find(function (x) { return x.id === actionId; });
  return a ? a.params[key] : undefined;
};

FDL.isVisible = function (cfg, moduleId) {
  return !(cfg.dataVisibility && cfg.dataVisibility[moduleId] === 'hidden');
};

/* URL-safe base64 for Korean text */
FDL.encodeCfg = function (obj) {
  var s = JSON.stringify(obj);
  var b = btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
FDL.decodeCfg = function (str) {
  var b = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  return JSON.parse(decodeURIComponent(escape(atob(b))));
};

FDL.store = {
  get: function (k, fallback) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  },
  set: function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
};

/* 게임에 적용할 설정: URL(#cfg=) > localStorage(강사 저장) > 기본값 */
FDL.loadConfig = function () {
  var cfg = FDL.clone(FDL.DEFAULT_CONFIG);
  var src = 'default';
  try {
    var m = location.hash.match(/cfg=([^&]+)/);
    if (m) { FDL.deepMerge(cfg, FDL.decodeCfg(m[1])); src = 'link'; }
    else {
      var saved = FDL.store.get('fdl.config', null);
      if (saved) { FDL.deepMerge(cfg, saved); src = 'instructor'; }
    }
  } catch (e) { console.warn('config load failed', e); }
  var sp = new URLSearchParams(location.search);
  if (sp.get('speed')) cfg.speed = Number(sp.get('speed')) || cfg.speed;
  cfg._source = src;
  return cfg;
};

FDL.escape = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

/* ---------- 브라우저 대화상자 대체 (임베드 환경에서도 동작) ---------- */
FDL.dialog = function (o) {
  var bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.style.zIndex = 130;
  bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="m-head"><h3>' + FDL.escape(o.title || '확인') + '</h3></div>' +
    '<div class="m-body">' + (o.html || '<p style="margin:0;white-space:pre-wrap">' + FDL.escape(o.message || '') + '</p>') + '</div>' +
    '<div class="m-foot">' + (o.cancel === false ? '' : '<button class="btn" data-no>' + FDL.escape(o.cancel || '취소') + '</button>') +
    '<button class="btn primary" data-yes>' + FDL.escape(o.ok || '확인') + '</button></div></div>';
  document.body.appendChild(bg);
  var close = function () { bg.remove(); };
  var no = bg.querySelector('[data-no]');
  if (no) no.onclick = function () { close(); if (o.onNo) o.onNo(); };
  bg.querySelector('[data-yes]').onclick = function () { close(); if (o.onYes) o.onYes(); };
  bg.querySelector('[data-yes]').focus();
  if (o.onOpen) o.onOpen(bg, close);
  return close;
};
FDL.confirmBox = function (message, onYes, ok) { return FDL.dialog({ message: message, onYes: onYes, ok: ok }); };
FDL.alertBox = function (message) { return FDL.dialog({ title: '알림', message: message, cancel: false }); };

FDL.copyText = function (text, done) {
  var ok = function () { if (done) done(true); };
  var fail = function () { if (done) done(false); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
    else fail();
  } catch (e) { fail(); }
};

/* JSON 파일 저장. 다운로드가 막힌 환경(임베드 뷰어)에서는 복사용 창을 띄움 */
FDL.saveJson = function (obj, name) {
  var text = JSON.stringify(obj, null, 1);
  if (!window.FDL_EMBED) {
    try {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return;
    } catch (e) { /* fall through */ }
  }
  FDL.dialog({
    title: 'JSON 복사 — ' + name, ok: '복사', cancel: '닫기',
    html: '<p class="muted" style="margin:0;font-size:13px">이 환경에서는 파일 다운로드가 제한됩니다. 아래 내용을 복사해 메모장에 붙여 넣고 <b>' + FDL.escape(name) + '</b> 로 저장하십시오.</p>' +
      '<textarea id="fdlJsonOut" readonly style="width:100%;min-height:220px;font-family:var(--mono);font-size:11px">' + FDL.escape(text) + '</textarea>',
    onYes: function () {},
    onOpen: function (bg) {
      var ta = bg.querySelector('#fdlJsonOut'), yes = bg.querySelector('[data-yes]');
      yes.onclick = function () {
        FDL.copyText(text, function (okd) {
          if (!okd) { ta.focus(); ta.select(); }
          yes.textContent = okd ? '복사됨 ✓' : '전체 선택됨 — Ctrl+C';
        });
      };
    }
  });
};
