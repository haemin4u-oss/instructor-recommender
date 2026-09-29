/* ==========================================================================
   FACTORY DECISION LAB — AI Manufacturing Analyst (rule-based, case-bounded)
   원칙: Case 데이터 범위 안에서만 답변 / 원인을 직접 알려주지 않음 / 확인 질문으로 되돌려줌
   ========================================================================== */
(function () {
  var esc = FDL.escape;

  var DIM_WORDS = [
    ['eq', /(설비|eq-?\d*|리플로우|reflow|오븐)/i],
    ['lot', /(lot|로트|랏|페이스트|paste|솔더|원자재)/i],
    ['shift', /(작업조|야간|주간|조별|shift)/i],
    ['pcb', /(pcb|기판)/i],
    ['lane', /(lane|레인|마운터|mounter|실장기)/i],
    ['op', /(작업자|오퍼레이터|operator|신규)/i],
    ['hod', /(시간대|시간별)/i]
  ];

  /* 가설/최종 원인 텍스트 분류 (평가에도 사용) */
  FDL.classify = function (text, cfg) {
    var t = String(text || '');
    var tags = {};
    if (/(lot|로트|랏|페이스트|paste|솔더|flux|플럭스|점도|원자재|자재)/i.test(t) && !/^\s*(pcb|기판)/i.test(t)) tags.material = true;
    var eqm = t.match(/eq-?0?([1-4])/i);
    if (eqm) {
      var id = 'EQ-0' + eqm[1];
      if (cfg && cfg.rootCause.eqId === id) tags.equipment = true; else tags.wrongEq = true;
    }
    if (!tags.wrongEq && /(열전대|히터|heater|thermocouple|tc 편차|온도 편차|실측|profiler|프로파일러)/i.test(t)) tags.equipment = true;
    if (!eqm && /(설비|리플로우|reflow|오븐)/i.test(t)) tags.equipmentGeneric = true;
    if (/(레시피|recipe|rev\.?\s?[cd]|셋팅|세팅|setting|changeover|체인지오버|모델 ?교체|설정 ?오류|조건 ?오류|로드)/i.test(t)) tags.setting = true;
    if (/(pcb|기판)/i.test(t)) tags.pcb = true;
    if (/(신규 ?작업자|신입|김oo|숙련도)/i.test(t)) tags.operator = true;
    if (/(노즐|nozzle|마운터|mounter|실장기)/i.test(t)) tags.nozzle = true;
    if (/(aoi|검사 ?프로그램|오검출|false ?call)/i.test(t)) tags.aoi = true;
    if (/(습도|공조|온습도)/i.test(t)) tags.humidity = true;
    return tags;
  };

  function Analyst(game) { this.g = game; }

  Analyst.prototype.table = function (rows, cols) {
    var h = '<table class="mini"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table>';
  };

  Analyst.prototype.hint = function (level, text) {
    var h = FDL.DIFFICULTY[this.g.cfg.difficulty].hints;
    if (h === 'low') return '';
    if (level === 'high' && h !== 'high') return '';
    return '<p class="hint">💡 ' + text + '</p>';
  };

  Analyst.prototype.dims = function (q) {
    var out = [];
    DIM_WORDS.forEach(function (d) { if (d[1].test(q) && out.indexOf(d[0]) < 0) out.push(d[0]); });
    return out;
  };

  Analyst.prototype.period = function (q) {
    if (/(오늘|금일)/.test(q)) return 'today';
    if (/(24|하루|어제)/.test(q)) return '24h';
    return '48h';
  };

  Analyst.prototype.periodLabel = function (p) {
    return p === 'today' ? '오늘 08:00~현재' : p === '24h' ? '최근 24시간' : '최근 48시간';
  };

  Analyst.prototype.hidden = function (moduleId) {
    return !FDL.isVisible(this.g.cfg, moduleId);
  };

  Analyst.prototype.stratAnswer = function (dim, period) {
    if (this.hidden('quality.strat')) return this.notProvided();
    var m = this.g.model, rows = m.strat(dim, period);
    var max = Math.max.apply(null, rows.map(function (r) { return r.defect; }));
    var min = Math.min.apply(null, rows.map(function (r) { return r.defect; }));
    var html = '<p>' + esc(FDL.STRAT_DIMS[dim].label) + '별 불량률을 비교했습니다. <span class="muted">(' + this.periodLabel(period) + ')</span></p>';
    html += this.table(rows.map(function (r) {
      return ['<b>' + esc(r.label) + '</b>', '<span class="' + (r.defect === max && max - min > 1 ? 'hi' : '') + '">' + r.defect.toFixed(1) + '%</span>', r.units.toLocaleString()];
    }), [FDL.STRAT_DIMS[dim].label, '불량률', '생산수량']);
    var top = rows.filter(function (r) { return r.defect === max; })[0];
    if (max - min > 1.2) html += '<p>' + esc(top.label) + ' 에서 상대적으로 높은 불량률이 확인됩니다.</p>';
    else html += '<p>그룹 간 뚜렷한 차이는 관찰되지 않습니다.</p>';
    if (dim === 'eq') html += this.hint('mid', '특정 설비의 차이가 “언제부터” 시작됐는지, 다른 요인과 겹치는지도 확인해 보시겠습니까?');
    if (dim === 'lot') html += this.hint('mid', 'Lot 전환 시점과 불량 상승 시점이 일치하는지, 설비별로 동일하게 나타나는지 확인해 보시겠습니까?');
    if (dim === 'pcb' || dim === 'op' || dim === 'lane') html += this.hint('mid', '이 차이가 다른 변수와 겹쳐서(교란) 나타난 것은 아닌지 교차 분석으로 확인할 수 있습니다.');
    if (dim === 'shift') html += this.hint('mid', '조별 차이가 “사람” 때문인지, 그 시간대에 “무언가 바뀐 것” 때문인지 구분이 필요합니다.');
    return { html: html, key: 'strat.' + dim, label: 'AI 분석: ' + FDL.STRAT_DIMS[dim].label + '별 비교' };
  };

  Analyst.prototype.crossAnswer = function (a, b, period) {
    if (this.hidden('quality.cross')) return this.notProvided();
    var c = this.g.model.cross(a, b, period);
    var html = '<p>' + esc(FDL.STRAT_DIMS[a].label) + ' × ' + esc(FDL.STRAT_DIMS[b].label) + ' 교차 분석 결과입니다. <span class="muted">(' + this.periodLabel(period) + ')</span></p>';
    html += this.table(c.rows.map(function (r, i) {
      return ['<b>' + esc(r) + '</b>'].concat(c.m[i].map(function (cell) { return cell ? cell.v.toFixed(1) + '%' : '<span class="muted">—</span>'; }));
    }), [''].concat(c.cols));
    html += '<p>교차 조건에 따라 불량률 편차가 다르게 나타납니다. 어떤 조합에서 차이가 커지는지 확인해 보십시오.</p>';
    return { html: html, key: 'cross.' + [a, b].sort().join('x'), label: 'AI 분석: ' + FDL.STRAT_DIMS[a].label + ' × ' + FDL.STRAT_DIMS[b].label };
  };

  Analyst.prototype.notProvided = function () {
    return { html: '<p>해당 데이터는 이번 교육 세션에서 제공되지 않습니다. 다른 관점의 데이터로 판단해 주십시오.</p>', key: null, label: 'AI 질의 (비공개 데이터)' };
  };

  Analyst.prototype.answer = function (raw) {
    var q = String(raw || '').trim();
    var g = this.g, m = g.model, cfg = g.cfg, rc = cfg.rootCause, self = this;
    var snap = m.snapshot();
    if (this.hidden('analyst')) return { html: '<p>AI Analyst 가 비활성화되어 있습니다.</p>' };

    // 1) 정답 요구 → 원인 직접 제시 금지
    if (/(정답|답 ?알려|원인.*(뭐|무엇|알려|말해)|뭐가 문제|어떻게 해야|해결책|결론 ?내려)/.test(q)) {
      var notSeen = [];
      if (!g.evidence['strat.eq']) notSeen.push('설비별 비교');
      if (!g.evidence['strat.lot']) notSeen.push('원자재 Lot별 비교');
      if (!g.evidence['strat.shift']) notSeen.push('작업조별 비교');
      if (!g.evidence['history.changes']) notSeen.push('4M 변경점 이력');
      var html = '<p>원인에 대한 판단은 책임자님의 몫입니다. 저는 데이터 분석을 지원하겠습니다.</p>' +
        '<p>4M 관점(Man · Machine · Material · Method)으로 가설을 세우고, 각 가설을 지지/반박하는 데이터를 확인해 보시겠습니까?</p>';
      if (notSeen.length) html += this.hint('mid', '아직 확인하지 않은 관점: ' + notSeen.join(', '));
      return { html: html, key: null, label: 'AI 질의: 원인 문의', intent: 'ask_answer' };
    }

    // 2) 원인 단정 → 소크라테스식 되묻기
    if (/(원인|범인|때문|주범|확실)/.test(q) && /(네|다|야|같아|같은데|듯|맞지|맞아|확실|이군|인가\?*$|겠)/.test(q) && !/(비교|보여|분석|알려)/.test(q)) {
      var tags = FDL.classify(q, cfg);
      var subj = q.match(/eq-?0?[1-4]/i) ? q.match(/eq-?0?[1-4]/i)[0].toUpperCase() :
        tags.material ? '원자재 Lot' : tags.setting ? '공정조건/레시피' : tags.operator ? '작업자 요인' : tags.pcb ? 'PCB Lot' : '해당 요인';
      var html2 = '<p>현재 데이터에서는 <b>' + esc(subj) + '</b>와(과) 불량 간 연관성이 관찰됩니다.</p>' +
        '<p>다만 상관관계만으로 원인을 확정하기는 어렵습니다. <b>원인으로 확정하기 위해 어떤 정보를 추가로 확인하시겠습니까?</b></p>' +
        '<ul class="tight"><li>변화 시점과 불량 상승 시점이 일치하는가?</li><li>다른 요인과 겹쳐 나타난 것은 아닌가? (교차 분석)</li><li>그 요인만 제거·변경했을 때 불량이 재현/해소되는가?</li><li>하나의 요인으로 전체 현상이 설명되는가?</li></ul>';
      return { html: html2, key: null, label: 'AI 대화: 원인 주장 “' + q.slice(0, 40) + '”', intent: 'claim' };
    }

    // 3) 교차 분석
    var dims = this.dims(q);
    var period = this.period(q);
    if (dims.length >= 2 && /(교차|별로|×|조합|같이|함께|나눠|x)/i.test(q)) return this.crossAnswer(dims[0], dims[1], period);

    // 4) 레시피/공정조건
    if (/(레시피|recipe|rev|버전|프로파일|profile|셋팅|세팅|setting|공정 ?조건|설정 ?온도|존 ?온도|zone)/i.test(q)) {
      var html3 = '<p>Reflow 설비별 현재 로드 레시피와 주요 설정값입니다.</p>';
      html3 += this.table(FDL.EQUIPMENT.map(function (id) {
        var z = m.zoneTable(id);
        return ['<b>' + id + '</b>', 'PM220_RF_' + m.recipeOf(id), z[2].sv + ' / ' + z[3].sv, z[5].sv, z[5].out + '%'];
      }), ['설비', '레시피', 'Soak Z3/Z4(°C)', 'Peak Z6(°C)', 'Z6 Heater 출력']);
      html3 += '<p class="muted">※ 표시 온도는 설비 자체 열전대 기준값입니다. 실제 기판 온도는 Profiler 실측(설비 점검) 시 확인 가능합니다.</p>';
      html3 += this.hint('mid', '레시피 변경 이력과 설비별 설정 차이가 언제, 누구에 의해 생겼는지 작업일지에서 확인할 수 있습니다.');
      return { html: html3, key: 'analyst.recipe', label: 'AI 분석: 설비별 레시피/공정조건' };
    }

    // 5) 변경점
    if (/(달라진|변경|변화|바뀐|차이점|4m|어제와)/i.test(q)) {
      if (this.hidden('history.changes')) return this.notProvided();
      var html4 = '<p>최근 48시간 등록된 4M 변경점입니다. (변경점 관리대장 기준)</p>';
      html4 += this.table(g.changeLog().map(function (c) { return [c.when, c.cat, esc(c.item)]; }), ['일시', '구분', '변경 내용']);
      html4 += '<p class="muted">※ 변경점 관리대장에 등록되지 않은 작업(예: 교대 중 Changeover)은 작업일지에서 확인해야 합니다.</p>';
      return { html: html4, key: 'history.changes', label: 'AI 분석: 변경점 조회' };
    }

    // 6) 단일 차원 층별
    if (dims.length === 1 && dims[0] !== 'hod' || /(비교|별 ?불량|층별)/.test(q) && dims.length) {
      return this.stratAnswer(dims[0], period);
    }

    // 7) 추이/시간
    if (/(추이|트렌드|trend|시간대|언제부터|시작|시점|7일|일주일)/i.test(q)) {
      if (this.hidden('quality.hourly')) return this.notProvided();
      var hr = m.hourly();
      var picks = [];
      for (var i = 0; i < hr.labels.length; i += 2) picks.push([hr.labels[i], hr.overall[i].toFixed(1) + '%']);
      var html5 = '<p>최근 24시간 시간대별 라인 불량률 (2시간 간격 표시)</p>' + this.table(picks, ['시각', '불량률']);
      html5 += '<p>상승이 관찰되는 구간이 있습니다. 해당 시각 전후의 변경 사항과 대조해 보시겠습니까?</p>';
      return { html: html5, key: 'quality.hourly', label: 'AI 분석: 시간대별 추이' };
    }

    if (/(유형|pareto|파레토|모드|종류)/i.test(q)) {
      var p = m.pareto();
      var html6 = '<p>불량 유형별 비율 (평시 → 현재, 라인 불량률 기여 %p)</p>' + this.table(p.map(function (r) { return [esc(r.label), r.baseline.toFixed(2), '<b>' + r.today.toFixed(2) + '</b>']; }), ['유형', '평시', '현재']);
      html6 += '<p>증가폭이 큰 유형이 어느 공정(인쇄·실장·리플로우)과 관련이 깊은지 생각해 보십시오.</p>';
      return { html: html6, key: 'quality.pareto', label: 'AI 분석: 불량 유형' };
    }

    if (/(습도|온습도|환경|공조)/.test(q)) {
      return { html: '<p>SMT 동 공조: 온도 24.1°C / 습도 55~58%RH (관리기준 40~60%RH, 어제 19:30 설정 50→55% 변경). 관리기준 내에서 운영 중입니다.</p>', key: 'env.humidity', label: 'AI 분석: 환경 조건' };
    }
    if (/(aoi|검사기|오검출|false)/i.test(q)) {
      return { html: '<p>AOI-01 프로그램 v3.2 (D-2 16:00 업데이트). False Call 률 0.8% → 0.9%. X-ray 샘플 재판정 결과 AOI 불량 판정 일치율 97% 입니다.</p>', key: 'aoi', label: 'AI 분석: AOI 검사' };
    }
    if (/(알람|alarm|경고)/i.test(q)) {
      var rows = [];
      FDL.EQUIPMENT.forEach(function (id) { m.alarms(id).forEach(function (a) { rows.push([id, a.time, esc(a.msg)]); }); });
      return { html: '<p>최근 48시간 Reflow 설비 알람 이력입니다.</p>' + this.table(rows, ['설비', '일시', '내용']), key: 'eq.alarms', label: 'AI 분석: 설비 알람 이력' };
    }
    if (/(타 ?라인|line ?3|라인 ?3|다른 라인)/i.test(q)) {
      if (!m.s.unlocked.line3) return { html: '<p>현재 타 라인에서 보고된 이상 정보는 없습니다.</p>', key: null, label: 'AI 질의: 타 라인' };
      return { html: '<p>' + g.line3Text() + '</p>', key: 'line3', label: 'AI 분석: 타 라인 정보' };
    }
    if (/(재고|대체)/.test(q)) {
      var st = m.s.oldStock == null ? FDL.actionParam(cfg, 'quarantine_lot', 'stockMin') : Math.max(0, Math.round(m.s.oldStock));
      return { html: '<p>이전 Paste Lot SP-0911A 잔량: 약 ' + st + '분 생산 분량 (Full Rate 기준). 대체 신규 Lot 은 공급사 확인이 필요합니다.</p>', key: 'material.stock', label: 'AI 분석: 대체 자재 재고' };
    }
    if (/(납기|출하|생산량|계획|물량)/.test(q)) {
      return { html: '<p>금일 18:00 출하 요구: <b>' + cfg.kpi.shipmentTarget.toLocaleString() + 'ea</b> · 현재 예상 출하 가능: <b>' + Math.round(snap.projected).toLocaleString() + 'ea</b> (' + Math.round(snap.deliveryRatio * 100) + '%)</p><p>계획 대비 생산 ' + snap.production.toFixed(1) + '% · 완제품 재고 ' + cfg.kpi.fgStock.toLocaleString() + 'ea (어제 14:00 이후 생산분 포함)</p>', key: 'production.plan', label: 'AI 분석: 납기/출하' };
    }
    if (/(고객)/.test(q)) {
      return { html: '<p>고객사: 완성차 Tier-1 전장 모듈 업체. 최근 90일 클레임 0건. 현재 고객 Risk 는 ' + snap.customer + ' 입니다. 유출 가능 수량은 불량률·검사 방식·출하 여부에 따라 달라집니다.</p>', key: 'customer', label: 'AI 분석: 고객 현황' };
    }
    if (/(불량률|불량|수율)/.test(q)) {
      return this.stratAnswer('eq', 'today');
    }
    return {
      html: '<p>Case 데이터 범위 안에서 분석을 도와드립니다. 예를 들어 이렇게 요청해 보세요.</p><ul class="tight">' +
        ['설비별 불량률 비교해줘', '어제와 오늘 달라진 조건이 뭐야?', 'Lot별로 비교해줘', '야간조와 주간조 차이가 있어?', '설비별로 Lot 교차 분석해줘', '설비별 레시피 확인해줘', '시간대별 추이 보여줘']
          .map(function (s) { return '<li><a href="#" class="ask" data-q="' + esc(s) + '">' + esc(s) + '</a></li>'; }).join('') + '</ul>',
      key: null, label: 'AI 질의: “' + q.slice(0, 30) + '”'
    };
  };

  FDL.Analyst = Analyst;
})();
