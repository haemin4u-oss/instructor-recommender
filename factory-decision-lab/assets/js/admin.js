/* ==========================================================================
   FACTORY DECISION LAB — Instructor Mode
   ========================================================================== */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = FDL.escape;

  var TABS = [
    { id: 'case', label: 'Case · 난이도', ico: '◧' },
    { id: 'root', label: 'Hidden Root Cause', ico: '◉' },
    { id: 'kpi', label: 'KPI 초기값', ico: '▥' },
    { id: 'data', label: '데이터 공개', ico: '◫' },
    { id: 'events', label: 'Trigger Event', ico: '⚠' },
    { id: 'conseq', label: 'Consequence', ico: '⇄' },
    { id: 'eval', label: '평가기준', ico: '✓' },
    { id: 'deploy', label: '배포 · 저장', ico: '⇪' },
    { id: 'debrief', label: 'Debrief 비교', ico: '☷' }
  ];

  var saved = FDL.store.get('fdl.config', null);
  var cfg = FDL.deepMerge(FDL.clone(FDL.DEFAULT_CONFIG), saved || {});
  delete cfg._source;
  var tab = 'case';
  var dirty = false;
  var imported = [];
  var selected = {};

  function setDirty(v) {
    dirty = v;
    $('#saveState').textContent = v ? '● 저장되지 않은 변경' : (saved ? '저장된 설정 사용 중' : '기본 설정');
    $('#saveState').style.color = v ? 'var(--warn)' : '';
  }

  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, cfg); }
  function set(path, v) {
    var ks = path.split('.'), o = cfg;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  function inp(path, type, attrs) {
    var v = get(path);
    if (type === 'bool') return '<input type="checkbox" data-path="' + path + '" data-type="bool"' + (v ? ' checked' : '') + '>';
    return '<input type="' + (type === 'num' ? 'number' : 'text') + '" data-path="' + path + '" data-type="' + type + '" value="' + esc(v == null ? '' : v) + '" ' + (attrs || '') + '>';
  }
  function field(label, html, cls, help) {
    return '<div class="field ' + (cls || '') + '"><label>' + label + '</label>' + html + (help ? '<span class="muted" style="font-size:11px">' + help + '</span>' : '') + '</div>';
  }
  function sel(path, options) {
    var v = get(path);
    return '<select data-path="' + path + '" data-type="str">' + options.map(function (o) {
      var val = Array.isArray(o) ? o[0] : o, lb = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(val) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(lb) + '</option>';
    }).join('') + '</select>';
  }

  function renderNav() {
    $('#adminNav').innerHTML = '<div class="nav-title">SETTINGS</div>' + TABS.map(function (t) {
      return (t.id === 'deploy' ? '<div class="nav-title" style="margin-top:10px">SESSION</div>' : '') + '<button data-tab="' + t.id + '" class="' + (t.id === tab ? 'active' : '') + '" title="' + t.label + '"><span class="ico">' + t.ico + '</span><span class="nav-label">' + t.label + '</span></button>';
    }).join('');
    $$('#adminNav button').forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-tab'); render(); }; });
  }

  function head(t, s) { return '<div class="view-head"><div><h2>' + t + '</h2><div class="sub">' + (s || '') + '</div></div></div>'; }

  function preview() {
    var m = new FDL.Model(cfg), s = m.snapshot();
    var eqs = FDL.EQUIPMENT.map(function (id) { return '<div><div class="k">' + id + ' 불량률</div><div class="v">' + s.perEq[id].defect.toFixed(1) + '%</div></div>'; }).join('');
    return '<div class="preview"><div><div class="k">초기 불량률</div><div class="v">' + s.defect.toFixed(1) + '%</div></div><div><div class="k">초기 생산량</div><div class="v">' + s.production.toFixed(1) + '%</div></div>' +
      '<div><div class="k">납기 Risk</div><div class="v"><span class="lvl ' + s.delivery + '">' + s.delivery + '</span></div></div><div><div class="k">Customer Risk</div><div class="v"><span class="lvl ' + s.customer + '">' + s.customer + '</span></div></div>' + eqs + '</div>';
  }

  var VIEWS = {};
  VIEWS.case = function () {
    return head('Case · 난이도 · 시간', '교육 대상과 목적에 맞게 Case 를 선택하십시오.') +
      '<div class="card" style="margin-bottom:12px"><h3>CASE 선택</h3><div class="grid c3">' + Object.keys(FDL.CASE_PRESETS).map(function (k) {
        var p = FDL.CASE_PRESETS[k];
        return '<button class="card" data-preset="' + k + '" style="text-align:left;cursor:pointer;' + (cfg.caseId === k ? 'border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset' : '') + '"><b>' + esc(p.name) + '</b><div class="muted" style="font-size:12px;margin-top:6px">' + esc(p.desc) + '</div></button>';
      }).join('') + '</div><p class="note">Case 를 선택하면 Hidden Root Cause 와 영향 계수가 해당 프리셋으로 설정됩니다. 이후 세부 조정이 가능합니다.</p></div>' +
      '<div class="card"><div class="form-grid">' +
      field('Case 명 (교육생 화면 표시)', inp('caseName', 'str'), 'wide') +
      field('난이도', sel('difficulty', [['EASY', 'EASY — AI 힌트 많음, 레시피 버전 목록 표시'], ['NORMAL', 'NORMAL — 표준'], ['HARD', 'HARD — 힌트 없음, 레시피 버전 비표시']])) +
      field('제한시간 (분)', inp('timeLimitMin', 'num', 'min="10" max="120"'), '', '기본 45분. 이벤트 시점도 함께 조정하십시오.') +
      field('진행 속도 (배속)', inp('speed', 'num', 'min="0.5" max="10" step="0.5"'), '', '1 = 실시간. 2 = 45분 Case 를 22.5분에 진행') +
      field('데이터 Seed', inp('seed', 'num'), '', 'Noise 패턴 고정용. 팀 간 동일 데이터 보장') +
      '</div><div class="row" style="margin-top:12px"><button class="btn sm" id="applyDiff">난이도 기본 제한시간 적용</button></div></div>';
  };

  VIEWS.root = function () {
    var rc = cfg.rootCause;
    return head('Hidden Root Cause', '교육생에게 보이지 않는 실제 원인 구조. 모든 데이터·KPI 는 이 설정에서 계산됩니다.') +
      '<div class="callout" style="margin-bottom:12px">원인은 단일이 아니라 결합 구조로 구성하는 것을 권장합니다. 하나의 원인을 발견했다고 문제가 해결되지 않도록 설계되어 있습니다.</div>' +
      '<div class="grid c2"><div class="card"><h3>원인 요인</h3>' +
      '<label class="row" style="margin-bottom:8px">' + inp('rootCause.material', 'bool') + ' <b>원자재</b> — 신규 Solder Paste Lot(SP-0925B) 영향</label>' +
      '<div class="row" style="margin-bottom:8px"><b>이상 설비</b> ' + sel('rootCause.eqId', [['', '없음'], 'EQ-01', 'EQ-02', 'EQ-03', 'EQ-04']) + '</div>' +
      '<label class="row" style="margin-bottom:8px">' + inp('rootCause.tcDrift', 'bool') + ' <b>설비 조건</b> — 이상 설비 Zone 6 열전대 편차</label>' +
      '<label class="row">' + inp('rootCause.recipeError', 'bool') + ' <b>Setting 오류</b> — 야간조 Changeover 시 구 레시피(Rev.C) 로드</label>' +
      (rc.eqId ? '' : '<p class="note">이상 설비가 “없음”이면 설비 조건·Setting 오류는 적용되지 않습니다.</p>') + '</div>' +
      '<div class="card"><h3>영향 계수 (불량률 %p)</h3><div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      field('정상 불량률', inp('effects.base', 'num', 'step="0.1"')) + field('신규 Lot 단독 영향', inp('effects.lotEffect', 'num', 'step="0.1"')) +
      field('구 레시피 단독 영향', inp('effects.recipeEffect', 'num', 'step="0.1"')) + field('Lot × 레시피 결합 영향', inp('effects.interaction', 'num', 'step="0.1"')) +
      field('열전대 편차 영향', inp('effects.tcDrift', 'num', 'step="0.1"')) + field('방치 시 분당 악화', inp('effects.tcDriftRamp', 'num', 'step="0.01"')) +
      '</div></div></div>' +
      '<div class="card" style="margin-top:12px"><h3>게임 시작 시점 미리보기 <span class="tag">자동 계산</span></h3>' + preview() + '</div>';
  };

  VIEWS.kpi = function () {
    return head('KPI 초기값', '생산·납기·고객 관련 기준값. 불량률/수율은 Root Cause 설정에서 계산됩니다.') +
      '<div class="card"><div class="form-grid">' +
      field('생산 기준 Capacity (%)', inp('kpi.baseCapacity', 'num')) + field('설비가동률 기준 (%)', inp('kpi.baseUtil', 'num')) +
      field('시간당 계획 생산 (ea)', inp('kpi.planPerHour', 'num')) + field('18:00 출하 요구 (ea)', inp('kpi.shipmentTarget', 'num')) +
      field('09:00 완제품 재고 (ea)', inp('kpi.fgStock', 'num')) + field('납기 예측 보정 (%p)', inp('kpi.deliveryBias', 'num'), '', '+ 이면 여유, − 이면 압박') +
      field('Customer Risk 초기 노출도', inp('kpi.customerExposure0', 'num', 'step="0.1"'), '', '<1.2 LOW · <2.5 MEDIUM · <4 HIGH') +
      '</div></div><div class="card" style="margin-top:12px"><h3>미리보기</h3>' + preview() + '</div>';
  };

  VIEWS.data = function () {
    var groups = {};
    FDL.DATA_MODULES.forEach(function (m) { (groups[m.menu] = groups[m.menu] || []).push(m); });
    return head('교육생에게 공개할 데이터', '숨긴 데이터는 교육생 화면과 AI Analyst 답변에서 모두 제외됩니다.') +
      '<div class="callout" style="margin-bottom:12px">공급사 PCN, Profiler 실측, 타 라인 정보는 교육생의 조치(공급사 문의·설비 점검)나 Event 발생 후 자동 공개되는 <b>조건부 데이터</b>입니다.</div>' +
      '<div class="grid c2">' + Object.keys(groups).map(function (g) {
        return '<div class="card"><h3>' + g + '</h3><table class="data">' + groups[g].map(function (m) {
          var hidden = cfg.dataVisibility[m.id] === 'hidden';
          return '<tr><td>' + esc(m.label) + '</td><td style="text-align:right"><span class="seg"><button data-vis="' + m.id + '" data-v="open" class="' + (!hidden ? 'on' : '') + '">공개</button><button data-vis="' + m.id + '" data-v="hidden" class="' + (hidden ? 'on' : '') + '">숨김</button></span></td></tr>';
        }).join('') + '</table></div>';
      }).join('') + '</div>';
  };

  VIEWS.events = function () {
    var ce = cfg.conditionalEvents;
    var CE = [['capacityAlert', 'PRODUCTION ALERT — 생산량 85% 미만 시 생산관리팀 연락'], ['stopAllEscalation', '전체 중단 3분 경과 시 공장장 호출'], ['materialStock', '대체 Lot 잔량 부족 경고'], ['customerEscalation', '고객 문의 10분 내 미대응 시 Escalation (+Risk)'], ['inspectionBottleneck', '전수검사 4분 경과 시 검사 병목'], ['qualityCritical', '불량률 8% 초과 시 품질 임계 알림']];
    return head('Trigger Event', '시간 경과 이벤트와 조건부 이벤트를 설정합니다.') +
      '<div class="card" style="margin-bottom:12px"><h3>시간 이벤트 (T+분)</h3><div class="table-wrap"><table class="data"><thead><tr><th>사용</th><th>T+분</th><th>유형</th><th>제목</th><th>메시지 (비우면 상황별 자동 문구)</th></tr></thead><tbody>' +
      cfg.events.map(function (e, i) {
        return '<tr><td>' + inp('events.' + i + '.enabled', 'bool') + '</td><td style="width:80px">' + inp('events.' + i + '.minute', 'num', 'min="1" style="width:70px"') + '</td><td>' + sel('events.' + i + '.type', ['QUALITY', 'PRODUCTION', 'CUSTOMER', 'MATERIAL', 'INFO']) + '</td><td>' + inp('events.' + i + '.title', 'str', 'style="width:100%"') + '</td>' +
          '<td><textarea data-path="events.' + i + '.message" data-type="str" style="width:100%;min-height:40px" placeholder="예) 생산관리팀: ...">' + esc(e.message || '') + '</textarea></td></tr>';
      }).join('') + '</tbody></table></div><p class="note">자동 문구는 교육생의 이전 판단(불량률 개선 여부, 고객 선제 공유 여부 등)에 따라 달라집니다. 직접 입력 시 고정 문구로 표시됩니다.</p></div>' +
      '<div class="card"><h3>조건부 이벤트 (Consequence 연동)</h3>' + CE.map(function (c) { return '<label class="row" style="margin-bottom:8px">' + inp('conditionalEvents.' + c[0], 'bool') + ' ' + esc(c[1]) + '</label>'; }).join('') + '</div>';
  };

  VIEWS.conseq = function () {
    var PL = { rate: '라인 속도 비율', interactionRelief: '결합 영향 완화율', shiftGain: '타 설비 물량 흡수율', stockMin: '대체 Lot 재고 (분)', wipLoss: 'WIP 손실 (%)', productionFactor: '생산 계수', escapeRate: '유출률', durationMin: '소요 시간 (분)', replyMin: '회신 시간 (분)', deliveryPenalty: '납기 페널티', exposureCut: '노출도 감소율', exposureRelief: '노출도 감소', deliveryBonus: '납기 만회 (%)' };
    return head('의사결정별 Consequence', '각 조치의 효과 계수를 조정합니다. KPI 변화는 모델이 계산합니다.') +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>조치</th><th>설명</th><th>계수</th></tr></thead><tbody>' +
      FDL.ACTIONS.map(function (a) {
        var ps = Object.keys(a.params);
        return '<tr><td><b>' + esc(a.label) + '</b></td><td class="muted" style="font-size:12px">' + esc(a.desc) + '</td><td>' + (ps.length ? ps.map(function (k) {
          var v = cfg.actionParams[a.id] && cfg.actionParams[a.id][k] != null ? cfg.actionParams[a.id][k] : a.params[k];
          return '<div class="row" style="margin-bottom:4px"><span class="muted" style="font-size:12px;min-width:120px">' + (PL[k] || k) + '</span><input type="number" step="0.01" style="width:90px" data-ap="' + a.id + '.' + k + '" value="' + v + '"></div>';
        }).join('') : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  };

  VIEWS.eval = function () {
    return head('평가기준', '6대 판단 영역 가중치. 결과 화면의 종합 프로필 계산에 반영됩니다.') +
      '<div class="callout" style="margin-bottom:12px">점수는 순위 경쟁이 아니라 Debrief 대화의 출발점입니다. 각 영역 피드백은 교육생의 실제 행동 로그(탐색 순서, 가설 갱신, 의사결정 근거, Event 대응)를 근거로 생성됩니다.</div>' +
      '<div class="card"><table class="data"><thead><tr><th>영역</th><th>평가 근거 (행동 로그)</th><th>가중치</th></tr></thead><tbody>' +
      [['SA', '첫 품질 데이터 확인 시점, Trend/Pareto 확인, Event 후 8분 내 후속 행동'], ['DA', '실제 원인 요인별 데이터 확인, 4M 탐색 폭, 교차 분석, Noise 비중'], ['HQ', '가설 수·근거·상태 갱신, 최종 Root Cause 의 원인 포함/Noise 포함'], ['DM', '첫 결정 시점, 근거의 데이터 인용, 불량률 개선, 유출 차단'], ['TM', '종료 시 품질·생산·납기·고객 균형, 대체 생산계획, 협업·고객 대응'], ['AD', 'Event 후 재판단, 가설 수정, 조치 재평가, 재발방지의 구조적 대책']].map(function (r) {
        var d = FDL.DOMAINS.filter(function (x) { return x.id === r[0]; })[0];
        return '<tr><td><b>' + d.label + '</b><div class="muted" style="font-size:12px">' + d.ko + '</div></td><td class="muted" style="font-size:12px">' + r[1] + '</td><td style="width:110px">' + inp('weights.' + r[0], 'num', 'min="0" max="3" step="0.5" style="width:80px"') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  };

  VIEWS.deploy = function () {
    var link = location.href.replace(/admin\.html.*$/, 'index.html') + '#cfg=' + FDL.encodeCfg(cfg);
    return head('배포 · 저장', '설정을 교육생 화면에 적용하는 방법') +
      '<div class="grid c2"><div class="card"><h3>① 같은 PC / 브라우저</h3><p class="muted" style="font-size:13px">“이 브라우저에 저장” 후 같은 브라우저에서 교육생 화면(index.html)을 열면 설정이 적용됩니다. 교육생 결과도 이 브라우저에 자동 저장되어 Debrief 비교가 바로 가능합니다.</p>' +
      '<div class="row"><button class="btn primary" id="saveBtn2">이 브라우저에 저장</button><button class="btn danger" id="resetBtn">기본값으로 초기화</button></div></div>' +
      '<div class="card"><h3>② 교육생 배포 링크 (여러 PC)</h3><p class="muted" style="font-size:13px">설정이 URL 에 포함된 링크입니다. 각 교육생 PC 에서 이 링크로 접속하십시오. 결과는 교육생이 “결과 JSON 저장” 후 강사에게 제출합니다.</p>' +
      '<div class="link-box" id="linkBox">' + esc(link) + '</div><div class="row" style="margin-top:8px"><button class="btn" id="copyLink">링크 복사</button><a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">링크로 열기 ↗</a></div></div>' +
      '<div class="card"><h3>③ 설정 파일</h3><p class="muted" style="font-size:13px">Case 설정을 JSON 파일로 보관하고 다음 차수에 재사용합니다.</p><div class="row"><button class="btn" id="expCfg">설정 JSON 내보내기</button><label class="btn">설정 JSON 불러오기<input type="file" id="impCfg" accept=".json" hidden></label></div></div>' +
      '<div class="card"><h3>현재 설정 요약</h3><table class="data"><tr><td class="muted">Case</td><td>' + esc(cfg.caseName) + '</td></tr><tr><td class="muted">난이도 / 시간</td><td>' + cfg.difficulty + ' / ' + cfg.timeLimitMin + '분 (×' + cfg.speed + ')</td></tr><tr><td class="muted">Root Cause</td><td>' + FDL.activeFactors(cfg).map(function (f) { return FDL.FACTOR_LABEL[f]; }).join(' + ') + (cfg.rootCause.eqId ? ' · ' + cfg.rootCause.eqId : '') + '</td></tr><tr><td class="muted">숨긴 데이터</td><td>' + (Object.keys(cfg.dataVisibility).filter(function (k) { return cfg.dataVisibility[k] === 'hidden'; }).join(', ') || '없음') + '</td></tr></table></div></div>';
  };

  /* ---------------- Debrief ---------------- */
  function allResults() {
    var local = FDL.store.get('fdl.results', []);
    return local.map(function (r) { r._src = '브라우저'; return r; }).concat(imported.map(function (r) { r._src = '파일'; return r; }));
  }
  var TEAM_COLORS = FDL.SERIES;

  VIEWS.debrief = function () {
    var list = allResults();
    var chosen = list.filter(function (r) { return selected[r.id]; }).slice(0, 4);
    var out = head('Debrief — 팀별 Decision Timeline 비교', '순위 경쟁이 아니라 “서로 다른 판단과 그 결과”를 비교하는 화면입니다.') +
      '<div class="card" style="margin-bottom:12px"><h3>결과 목록 <span class="row"><label class="btn sm">결과 JSON 불러오기 (복수)<input type="file" id="impRes" accept=".json" multiple hidden></label><button class="btn sm danger" id="clearRes">브라우저 결과 삭제</button></span></h3>' +
      (list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>비교</th><th>팀</th><th>Case</th><th>종료</th><th class="num">소요</th><th class="num">의사결정</th><th class="num">가설</th><th>출처</th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr class="result-row"><td><input type="checkbox" data-sel="' + esc(r.id) + '"' + (selected[r.id] ? ' checked' : '') + '></td><td><b>' + esc(r.team) + '</b></td><td class="muted" style="font-size:12px">' + esc(r.caseName) + '</td><td class="mono" style="font-size:12px">' + esc((r.finishedAt || '').replace('T', ' ').slice(0, 16)) + '</td><td class="num">' + r.gameMinutes + '분</td><td class="num">' + r.log.filter(function (l) { return l.type === 'decision'; }).length + '</td><td class="num">' + r.hypotheses.length + '</td><td class="muted">' + r._src + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="note">최대 4팀까지 선택해 비교합니다. (팀 목록은 종료 시각 순이며 점수 순위를 표시하지 않습니다)</p>'
        : '<p class="muted">아직 결과가 없습니다. 교육생이 이 브라우저에서 게임을 완료하거나, 제출한 결과 JSON 을 불러오십시오.</p>') + '</div>';
    if (!chosen.length) return out;
    var color = function (i) { return TEAM_COLORS[i % TEAM_COLORS.length]; };
    // 요약 비교
    out += '<div class="card" style="margin-bottom:12px"><h3>판단 경로 요약</h3><div class="table-wrap"><table class="data"><thead><tr><th>항목</th>' + chosen.map(function (r, i) { return '<th><span class="team-dot" style="background:' + color(i) + '"></span>' + esc(r.team) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      [['첫 품질 데이터 확인', function (r) { var x = r.log.filter(function (l) { return (l.type === 'view' || l.type === 'query') && /^(quality|strat|cross)/.test(l.key || ''); })[0]; return x ? x.clock : '—'; }],
        ['첫 가설', function (r) { var h = r.hypotheses[0]; return h ? h.clock + ' ' + esc(h.title) : '—'; }],
        ['첫 의사결정', function (r) { var d = r.log.filter(function (l) { return l.type === 'decision'; })[0]; return d ? d.clock + ' ' + esc(d.data.actions.map(function (a) { return a.label + (a.target ? '(' + a.target + ')' : ''); }).join(', ')) : '—'; }],
        ['의사결정 횟수', function (r) { return r.log.filter(function (l) { return l.type === 'decision'; }).length + '회'; }],
        ['요인별 첫 데이터 확인', function (r) { var ff = (r.score && r.score.factorFirst) || {}; return (r.score.active || []).map(function (f) { return FDL.FACTOR_LABEL[f].split(' (')[0] + ' ' + (ff[f] != null ? clockOf(r, ff[f]) : '✕'); }).join('<br>'); }],
        ['최종 Root Cause', function (r) { return esc(((r.final && r.final.rootCauseChecks) || []).join(' / ')) || '—'; }],
        ['종료 불량률 / 생산량', function (r) { var e = r.history[r.history.length - 1]; return e.defect + '% / ' + e.production + '%'; }],
        ['종료 납기 / 고객 Risk', function (r) { var e = r.history[r.history.length - 1]; return '<span class="lvl ' + e.delivery + '">' + e.delivery + '</span> / <span class="lvl ' + e.customer + '">' + e.customer + '</span>'; }]
      ].map(function (row) { return '<tr><td class="muted">' + row[0] + '</td>' + chosen.map(function (r) { return '<td style="font-size:13px">' + row[1](r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
    // 차트
    var maxLen = Math.max.apply(null, chosen.map(function (r) { return r.history.length; }));
    var labels = []; for (var i = 0; i < maxLen; i++) labels.push('T+' + i);
    var pad = function (arr) { var a = arr.slice(); while (a.length < maxLen) a.push(null); return a; };
    out += '<div class="grid c2" style="margin-bottom:12px"><div class="card"><h3>불량률 궤적 비교</h3>' + FDL.charts.line({ labels: labels, width: 560, height: 230, unit: '%', series: chosen.map(function (r, i) { return { name: r.team, color: color(i), values: pad(r.history.map(function (h) { return h.defect; })) }; }) }) + '</div>' +
      '<div class="card"><h3>생산량 궤적 비교</h3>' + FDL.charts.line({ labels: labels, width: 560, height: 230, unit: '%', yMin: 0, yMax: 100, series: chosen.map(function (r, i) { return { name: r.team, color: color(i), values: pad(r.history.map(function (h) { return h.production; })) }; }) }) + '</div></div>';
    out += '<div class="grid c2" style="margin-bottom:12px"><div class="card"><h3>판단 역량 프로필</h3>' + FDL.charts.radar({ axes: FDL.DOMAINS.map(function (d) { return d.ko; }), series: chosen.map(function (r, i) { return { name: r.team, color: color(i), values: FDL.DOMAINS.map(function (d) { return r.score.domains[d.id].score; }) }; }) }) + '</div>' +
      '<div class="card"><h3>Debrief 진행 가이드</h3><ol class="debrief-q"><li>같은 Alert 을 보고 팀마다 <b>처음 확인한 데이터</b>가 달랐습니다. 왜 그것을 먼저 봤습니까?</li><li>첫 의사결정 시점과 조치가 가장 다른 두 팀을 비교해 보십시오. 각 판단의 근거는 무엇이었습니까?</li><li>생산량 궤적이 크게 갈린 지점은 어디입니까? 그 결정의 Trade-off 를 어떻게 설명하겠습니까?</li><li>복합 원인 중 늦게 발견된 요인은 무엇이고, 무엇이 발견을 늦췄습니까?</li><li>우리 현장의 변경점 관리·교대 인수인계에 적용할 교훈은 무엇입니까?</li></ol></div></div>';
    out += '<h2 style="font-size:15px;margin:6px 0 10px">Decision Timeline (팀별 나란히)</h2><div class="compare-cols">' + chosen.map(function (r, i) {
      return '<div class="card"><h3><span><span class="team-dot" style="background:' + color(i) + '"></span>' + esc(r.team) + '</span><span class="tag">' + r.gameMinutes + '분</span></h3><div class="timeline">' + FDL.timelineHtml(r.log, false) + '</div></div>';
    }).join('') + '</div>';
    return out;
  };
  function clockOf(r, t) {
    var x = r.history.filter(function (h) { return h.t === t; })[0];
    if (x) return x.clock;
    var m = 9 * 60 + t; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /* ---------------- render / bind ---------------- */
  function render() {
    renderNav();
    $('#adminView').innerHTML = VIEWS[tab]();
    bind();
  }

  function bind() {
    $$('#adminView [data-path]').forEach(function (el) {
      el.onchange = function () {
        var t = el.getAttribute('data-type'), v;
        if (t === 'bool') v = el.checked;
        else if (t === 'num') v = el.value === '' ? 0 : Number(el.value);
        else v = el.value;
        var path = el.getAttribute('data-path');
        if (path === 'rootCause.eqId' && v === '') v = null;
        set(path, v);
        cfg.caseId = /^(rootCause|effects)/.test(path) ? 'custom' : cfg.caseId;
        setDirty(true);
        if (tab === 'root' || tab === 'kpi') render();
      };
    });
    $$('#adminView [data-preset]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-preset'), p = FDL.CASE_PRESETS[k];
        cfg.caseId = k; cfg.caseName = p.caseName;
        cfg.rootCause = FDL.clone(p.rootCause); cfg.effects = FDL.clone(p.effects);
        setDirty(true); render();
      };
    });
    $$('#adminView [data-vis]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-vis');
        if (b.getAttribute('data-v') === 'hidden') cfg.dataVisibility[id] = 'hidden'; else delete cfg.dataVisibility[id];
        setDirty(true); render();
      };
    });
    $$('#adminView [data-ap]').forEach(function (el) {
      el.onchange = function () {
        var p = el.getAttribute('data-ap').split('.');
        cfg.actionParams[p[0]] = cfg.actionParams[p[0]] || {};
        cfg.actionParams[p[0]][p[1]] = Number(el.value);
        setDirty(true);
      };
    });
    var ad = $('#applyDiff');
    if (ad) ad.onclick = function () { cfg.timeLimitMin = FDL.DIFFICULTY[cfg.difficulty].timeLimitMin; setDirty(true); render(); };
    var s2 = $('#saveBtn2'); if (s2) s2.onclick = save;
    var rb = $('#resetBtn');
    if (rb) rb.onclick = function () { if (!confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) return; cfg = FDL.clone(FDL.DEFAULT_CONFIG); try { localStorage.removeItem('fdl.config'); } catch (e) {} saved = null; setDirty(false); render(); };
    var cl = $('#copyLink');
    if (cl) cl.onclick = function () {
      var txt = $('#linkBox').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { flash('링크를 복사했습니다.'); }, function () { window.prompt('아래 링크를 복사하십시오.', txt); });
    };
    var ec = $('#expCfg');
    if (ec) ec.onclick = function () { download(cfg, 'FDL_config_' + (cfg.caseId || 'custom') + '.json'); };
    var ic = $('#impCfg');
    if (ic) ic.onchange = function () {
      readFiles(ic.files, function (objs) {
        if (!objs[0] || !objs[0].rootCause) { alert('올바른 설정 파일이 아닙니다.'); return; }
        cfg = FDL.deepMerge(FDL.clone(FDL.DEFAULT_CONFIG), objs[0]); setDirty(true); render(); flash('설정을 불러왔습니다. 저장을 눌러 적용하십시오.');
      });
    };
    var ir = $('#impRes');
    if (ir) ir.onchange = function () {
      readFiles(ir.files, function (objs) {
        var n = 0;
        objs.forEach(function (o) { if (o && o.app === 'factory-decision-lab') { o.id = o.id || ('f' + Date.now() + Math.random()); imported.push(o); selected[o.id] = true; n++; } });
        flash(n + '개 결과를 불러왔습니다.'); render();
      });
    };
    var cr = $('#clearRes');
    if (cr) cr.onclick = function () { if (!confirm('이 브라우저에 저장된 교육생 결과를 모두 삭제하시겠습니까?')) return; FDL.store.set('fdl.results', []); render(); };
    $$('#adminView [data-sel]').forEach(function (cb) {
      cb.onchange = function () {
        var id = cb.getAttribute('data-sel');
        if (cb.checked && Object.keys(selected).filter(function (k) { return selected[k]; }).length >= 4) { cb.checked = false; flash('최대 4팀까지 비교할 수 있습니다.'); return; }
        selected[id] = cb.checked; render();
      };
    });
  }

  function readFiles(files, cb) {
    var arr = Array.prototype.slice.call(files || []), out = [], left = arr.length;
    if (!left) return;
    arr.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () { try { out.push(JSON.parse(r.result)); } catch (e) { alert(f.name + ': JSON 파싱 실패'); } if (--left === 0) cb(out); };
      r.readAsText(f);
    });
  }
  function download(obj, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function flash(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.style.bottom = '24px';
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
  }
  function save() {
    if (FDL.store.set('fdl.config', cfg)) { saved = FDL.clone(cfg); setDirty(false); flash('저장했습니다. 이 브라우저의 교육생 화면에 적용됩니다.'); }
    else flash('저장 실패 — 브라우저 저장소를 사용할 수 없습니다. 배포 링크를 사용하십시오.');
  }

  document.addEventListener('DOMContentLoaded', function () {
    FDL.charts.initTooltip();
    $('#saveBtn').onclick = save;
    var hasResults = FDL.store.get('fdl.results', []).length;
    if (location.hash === '#debrief' || (hasResults && !saved)) tab = location.hash === '#debrief' ? 'debrief' : tab;
    setDirty(false);
    render();
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  });
})();
