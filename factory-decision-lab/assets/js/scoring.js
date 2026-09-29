/* ==========================================================================
   FACTORY DECISION LAB — Debrief Scoring
   “무엇을 맞혔는가”가 아니라 “어떻게 판단했는가”를 행동 로그 기반으로 분석
   ========================================================================== */
(function () {
  var FACTOR_LABEL = { material: '원자재 Lot 변경 (Material)', equipment: '설비 조건 이상 (Machine)', setting: '작업 Setting 오류 (Method/Man)' };
  var EVID_FACTOR = function (key, cfg) {
    var rc = cfg.rootCause;
    var f = [];
    if (/^(strat\.lot|material\.coa|material\.lots|material\.pcn|line3|cross\..*lot)/.test(key)) f.push('material');
    if (/^(strat\.eq|eq\.alarms|cross\..*eq)/.test(key) || key === 'eq.detail.' + rc.eqId || key === 'eq.inspect.' + rc.eqId) f.push('equipment');
    if (/^(analyst\.recipe|people\.worklog|history\.incidents)/.test(key) || key === 'eq.detail.' + rc.eqId || key === 'eq.inspect.' + rc.eqId) f.push('setting');
    return f;
  };
  var NOISE_KEYS = /^(strat\.(pcb|lane|op)|env\.|aoi|process\.mounter)/;
  var CAT_OF = function (key) {
    if (/(lot|material|pcb|line3)/.test(key)) return 'Material';
    if (/(eq|equipment|lane|mounter|alarms)/.test(key)) return 'Machine';
    if (/(shift|op|people)/.test(key)) return 'Man';
    if (/(recipe|history|changes|incidents)/.test(key)) return 'Method';
    return null;
  };

  function levelOf(v) { return v >= 80 ? '탁월' : v >= 65 ? '우수' : v >= 50 ? '보통' : v >= 35 ? '개선 필요' : '집중 개발 필요'; }
  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  FDL.activeFactors = function (cfg) {
    var rc = cfg.rootCause, f = [];
    if (rc.material) f.push('material');
    if (rc.eqId && rc.tcDrift) f.push('equipment');
    if (rc.eqId && rc.recipeError) f.push('setting');
    return f;
  };
  FDL.FACTOR_LABEL = FACTOR_LABEL;

  FDL.timelineHtml = function (log, all) {
    var TYPE = { system: 'SYSTEM', view: 'EXPLORE', query: 'AI', hyp: 'HYPOTHESIS', hyp_update: 'HYPOTHESIS', decision: 'DECISION', event: 'EVENT', kpi: 'KPI', final: 'FINAL', ack: 'ACK' };
    return log.filter(function (l) {
      if (l.type === 'ack') return false;
      if (all) return true;
      return l.type !== 'view' && l.type !== 'query' || (l.key && /^(strat|cross|material|people\.worklog|history|analyst|line3|eq\.detail|quality\.(trend|pareto))/.test(l.key));
    }).map(function (l) {
      var sub = '';
      if (l.type === 'decision') sub = '근거: ' + l.data.rationale + '\n결과: 불량률 ' + l.data.before.defect + '→' + l.data.after.defect + '%, 생산량 ' + l.data.before.production + '→' + l.data.after.production + '%, 납기 ' + l.data.before.delivery + '→' + l.data.after.delivery;
      if (l.type === 'event' && l.data) sub = l.data.lines[0];
      if (l.type === 'hyp' && l.data && l.data.evidence) sub = '근거: ' + l.data.evidence;
      return '<div class="tl-item tl-' + l.type + '"><div class="tl-t">' + l.clock + '</div><div><span class="tl-type">' + (TYPE[l.type] || l.type) + '</span>' + FDL.escape(l.label) + (sub ? '<div class="tl-sub">' + FDL.escape(sub) + '</div>' : '') + '</div></div>';
    }).join('');
  };

  FDL.score = function (game) {
    var cfg = game.cfg, log = game.log, rc = cfg.rootCause;
    var active = FDL.activeFactors(cfg);
    var clock = function (t) { return game.model.clock(t); };
    var first = function (pred) { for (var i = 0; i < log.length; i++) if (pred(log[i])) return log[i]; return null; };
    var evid = game.evidence; // key -> first t
    var factorFirst = {};
    Object.keys(evid).forEach(function (k) {
      EVID_FACTOR(k, cfg).forEach(function (f) { if (factorFirst[f] == null || evid[k] < factorFirst[f]) factorFirst[f] = evid[k]; });
    });
    var decisions = log.filter(function (l) { return l.type === 'decision'; });
    var events = log.filter(function (l) { return l.type === 'event' && l.data && l.data.major; });
    var hyps = game.hypotheses;
    var fin = game.final || {};
    var hist = game.model.history;
    var start = game.startRec || hist[0] || {}, end = hist[hist.length - 1] || {};
    var R = {};

    /* ---------- SA : Situation Awareness ---------- */
    (function () {
      var s = 0, fb = [], ev = [];
      var q = first(function (l) { return (l.type === 'view' || l.type === 'query') && /^(quality|strat|cross)/.test(l.key || ''); });
      if (q) {
        s += q.t <= 3 ? 40 : q.t <= 7 ? 30 : q.t <= 12 ? 18 : 8;
        ev.push(q.clock + ' 첫 품질 데이터 확인');
        if (q.t <= 5) fb.push('Alert 직후 ' + q.clock + '에 품질 데이터를 확인하며 빠르게 상황 파악에 착수했습니다.');
        else fb.push('첫 품질 데이터 확인이 ' + q.clock + '로 다소 늦었습니다. Alert 직후 “무엇이, 언제부터, 얼마나” 변했는지 먼저 확인하는 습관이 필요합니다.');
      } else fb.push('품질 데이터를 직접 확인하지 않았습니다. 현상의 규모와 시작 시점 파악이 판단의 출발점입니다.');
      if (evid['quality.trend7d'] != null || evid['quality.hourly'] != null) s += 15; else fb.push('시간 추이(Trend) 확인이 없어 “언제부터” 문제가 시작됐는지 판단 근거가 약했습니다.');
      if (evid['quality.pareto'] != null) s += 15; else fb.push('불량 유형(Pareto)을 보지 않아 관련 공정을 좁히는 단서를 놓쳤습니다.');
      // 이벤트 반응성
      var responded = 0;
      events.forEach(function (e) {
        var r = log.some(function (l) { return (l.type === 'decision' || l.type === 'view' || l.type === 'query' || l.type === 'hyp') && l.t >= e.t && l.t <= e.t + 8; });
        if (r) responded++;
      });
      if (events.length) {
        s += 30 * responded / events.length;
        if (responded < events.length) fb.push('발생한 주요 Event ' + events.length + '건 중 ' + (events.length - responded) + '건은 8분 이내 후속 확인/조치가 없었습니다.');
        else fb.push('주요 Event 발생 시마다 8분 이내 후속 확인 또는 조치를 이어갔습니다.');
      } else s += 15;
      R.SA = { score: clamp(s), feedback: fb, evidence: ev };
    })();

    /* ---------- DA : Data Analysis ---------- */
    (function () {
      var s = 0, fb = [];
      var covered = active.filter(function (f) { return factorFirst[f] != null; });
      s += active.length ? 45 * covered.length / active.length : 45;
      var cats = {};
      Object.keys(evid).forEach(function (k) { var c = CAT_OF(k); if (c) cats[c] = true; });
      var nCats = Object.keys(cats).length;
      s += Math.min(20, nCats * 5);
      var crossUsed = Object.keys(evid).some(function (k) { return /^cross\./.test(k); });
      if (crossUsed) { s += 15; fb.push('교차 분석을 활용해 요인 간 결합(교란) 여부를 검토했습니다.'); }
      else fb.push('단일 층별 비교에 머물렀습니다. 복합 원인은 교차 분석(예: 설비 × Lot)에서 드러나는 경우가 많습니다.');
      var queries = log.filter(function (l) { return l.type === 'query' && l.key; }).length;
      if (queries >= 3) s += 10;
      var noise = Object.keys(evid).filter(function (k) { return NOISE_KEYS.test(k); }).length;
      var signal = Object.keys(evid).filter(function (k) { return EVID_FACTOR(k, cfg).length; }).length;
      if (signal >= noise) s += 10; else fb.push('Noise 성격의 데이터(' + noise + '건) 확인 비중이 핵심 데이터(' + signal + '건)보다 컸습니다. 가설 기반으로 탐색 범위를 좁혀 보십시오.');
      // 탐색 순서 피드백
      var order = active.filter(function (f) { return factorFirst[f] != null; }).sort(function (a, b) { return factorFirst[a] - factorFirst[b]; });
      if (order.length >= 2) {
        var f0 = order[0], fl = order[order.length - 1];
        if (factorFirst[fl] - factorFirst[f0] >= 12) fb.push(FACTOR_LABEL[f0] + ' 데이터에 먼저 집중하면서(' + clock(factorFirst[f0]) + '), ' + FACTOR_LABEL[fl] + ' 확인이 ' + clock(factorFirst[fl]) + '로 늦었습니다.');
        else fb.push('여러 원인 후보 데이터를 비교적 균형 있게 탐색했습니다 (' + order.map(function (f) { return FACTOR_LABEL[f].split(' (')[0] + ' ' + clock(factorFirst[f]); }).join(', ') + ').');
      }
      active.forEach(function (f) { if (factorFirst[f] == null) fb.push(FACTOR_LABEL[f] + ' 관련 데이터를 확인하지 않았습니다.'); });
      R.DA = { score: clamp(s), feedback: fb, cats: Object.keys(cats) };
    })();

    /* ---------- HQ : Hypothesis Quality ---------- */
    (function () {
      var s = 0, fb = [];
      var n = hyps.length;
      s += n >= 3 ? 15 : n === 2 ? 10 : n === 1 ? 5 : 0;
      if (!n) fb.push('가설을 등록하지 않았습니다. 가설 없이 탐색하면 데이터가 판단으로 연결되기 어렵습니다.');
      var hypTags = {};
      hyps.forEach(function (h) { var t = FDL.classify(h.title + ' ' + h.evidence, cfg); Object.keys(t).forEach(function (k) { hypTags[k] = true; }); });
      var hypCovered = active.filter(function (f) { return hypTags[f]; });
      s += active.length ? 20 * hypCovered.length / active.length : 20;
      var withEvidence = hyps.filter(function (h) { return (h.evidence || '').trim().length >= 15; }).length;
      if (n) { s += 10 * withEvidence / n; if (withEvidence < n) fb.push('근거가 비어 있거나 짧은 가설이 ' + (n - withEvidence) + '건 있습니다. “어떤 데이터가 이 가설을 지지하는가”를 기록하십시오.'); }
      var updates = log.filter(function (l) { return l.type === 'hyp_update'; }).length;
      var rejected = hyps.filter(function (h) { return h.status === '기각'; }).length;
      if (updates) { s += 10; fb.push('가설의 가능성·상태를 ' + updates + '회 갱신하며 데이터에 따라 판단을 수정했습니다.'); }
      if (rejected) s += 5;
      // 최종 Root Cause
      var finTags = FDL.classify(fin.rootCauseText || '', cfg);
      var IDX = [null, null, null, 'pcb', 'operator', 'nozzle', 'aoi', 'humidity'];
      (fin.rcSel || []).forEach(function (x) {
        if (x.i === 0) finTags.material = true;
        else if (x.i === 1 || x.i === 2) {
          if (x.eq === rc.eqId) finTags[x.i === 1 ? 'equipment' : 'setting'] = true; else finTags.wrongEq = true;
        } else if (IDX[x.i]) finTags[IDX[x.i]] = true;
      });
      var finCovered = active.filter(function (f) { return finTags[f]; });
      var falsePos = ['pcb', 'operator', 'nozzle', 'aoi', 'humidity', 'wrongEq'].filter(function (k) { return finTags[k]; });
      if (!rc.material && finTags.material) falsePos.push('material');
      s += active.length ? 30 * finCovered.length / active.length : 30;
      s -= falsePos.length * 4;
      if (active.length > 1) {
        if (finCovered.length === active.length) fb.push('최종 판단에서 복합 원인 구조(' + active.map(function (f) { return FACTOR_LABEL[f].split(' (')[0]; }).join(' + ') + ')를 모두 식별했습니다.');
        else if (finCovered.length) fb.push('최종 판단에서 일부 원인(' + finCovered.map(function (f) { return FACTOR_LABEL[f].split(' (')[0]; }).join(', ') + ')만 식별했습니다. 하나의 원인을 찾은 뒤에도 “이것으로 전체 현상이 설명되는가?”를 점검하십시오.');
        else fb.push('최종 Root Cause 에 실제 원인 요인이 포함되지 않았습니다.');
      } else if (finCovered.length === active.length) fb.push('최종 판단에서 실제 원인을 식별했습니다.');
      if (falsePos.length) fb.push('최종 원인에 Noise 요인(' + falsePos.join(', ') + ')이 포함되었습니다. 상관관계와 인과관계를 구분하는 검증이 필요합니다.');
      if (finCovered.length >= 2 || hypCovered.length >= 2) s += 10;
      R.HQ = { score: clamp(s), feedback: fb, finCovered: finCovered, falsePos: falsePos };
    })();

    /* ---------- DM : Decision Making ---------- */
    (function () {
      var s = 0, fb = [];
      if (!decisions.length) {
        fb.push('게임 중 의사결정을 한 번도 실행하지 않았습니다. 불완전한 정보에서도 “임시 조치”를 먼저 실행하는 판단이 필요합니다.');
      } else {
        var d0 = decisions[0];
        s += d0.t <= 12 ? 25 : d0.t <= 22 ? 18 : d0.t <= 32 ? 10 : 5;
        fb.push('첫 의사결정: ' + d0.clock + ' — ' + d0.data.actions.map(function (a) { return a.label; }).join(', ') + '.');
        var avgLen = decisions.reduce(function (a, d) { return a + (d.data.rationale || '').length; }, 0) / decisions.length;
        var dataRef = decisions.filter(function (d) { return /(\d|%|eq|lot|로트|데이터|비교|추이)/i.test(d.data.rationale || ''); }).length;
        s += Math.min(15, avgLen / 4) + 10 * dataRef / decisions.length;
        if (dataRef < decisions.length) fb.push('판단 근거에 데이터(수치·비교 결과)가 인용되지 않은 결정이 ' + (decisions.length - dataRef) + '건 있습니다.');
        else fb.push('모든 의사결정 근거에 데이터를 인용했습니다.');
      }
      var init = start.defect || 5.8, base = cfg.effects.base;
      var improve = end.defect != null ? (init - end.defect) / Math.max(0.5, init - base) : 0;
      s += 25 * Math.max(0, Math.min(1, improve));
      if (improve >= 0.8) fb.push('불량률을 ' + init + '% → ' + end.defect + '%로 정상 수준에 가깝게 회복시켰습니다.');
      else if (improve > 0.3) fb.push('불량률이 ' + init + '% → ' + end.defect + '%로 개선되었으나 정상 수준(' + base + '%)에는 도달하지 못했습니다.');
      else fb.push('종료 시점 불량률 ' + end.defect + '% — 조치가 현상 개선으로 이어지지 않았습니다.');
      var contained = game.model.s.hold || game.model.s.fullInspection || game.model.s.lineStopped;
      if (contained) { s += 15; } else fb.push('유출 차단 조치(출하 보류·전수검사 등)가 없어 고객 유출 Risk 가 누적되었습니다.');
      var finAct = ((fin.immediate || '') + (fin.production || '')).length;
      s += Math.min(10, finAct / 12);
      R.DM = { score: clamp(s), feedback: fb };
    })();

    /* ---------- TM : Trade-off Management ---------- */
    (function () {
      var s = 0, fb = [];
      var lv = { LOW: 20, MEDIUM: 14, HIGH: 6, CRITICAL: 0 };
      s += lv[end.delivery] || 0;
      s += lv[end.customer] || 0;
      s += end.defect <= 2.6 ? 20 : end.defect <= 3.6 ? 14 : end.defect <= 5 ? 6 : 0;
      s += end.production >= 88 ? 20 : end.production >= 78 ? 14 : end.production >= 60 ? 6 : 0;
      fb.push('종료 KPI — 불량률 ' + end.defect + '%, 생산량 ' + end.production + '%, 납기 Risk ' + end.delivery + ', 고객 Risk ' + end.customer + '.');
      var capLoss = log.filter(function (l) { return l.type === 'kpi' && /납기 Risk/.test(l.label) && /(HIGH|CRITICAL)/.test(l.label); })[0];
      var mitig = decisions.some(function (d) { return d.data.actions.some(function (a) { return /overtime|reduce|restart_eq|resume_all/.test(a.id); }); });
      if (capLoss) {
        if (mitig) { s += 10; fb.push(capLoss.clock + ' 납기 Risk 악화 이후 생산 만회(잔업·재가동·속도 조정) 방안을 함께 검토했습니다.'); }
        else fb.push('품질 조치로 ' + capLoss.clock + ' 납기 Risk 가 악화되었으나 대체 생산계획(잔업·재가동 등) 검토가 부족했습니다.');
      } else s += 5;
      var collab = fin.collaboration || '';
      var parties = ['생산', '품질', '구매', '설비', '고객', '공급사', '영업', '기술'].filter(function (p) { return collab.indexOf(p) >= 0; });
      s += Math.min(6, parties.length * 2);
      if ((fin.customer || '').trim().length >= 20) s += 4; else fb.push('고객 대응 계획이 구체적이지 않습니다. 유출 범위·임시 조치·보고 일정을 포함하십시오.');
      if (parties.length >= 3) fb.push('협업 대상(' + parties.join('·') + ')을 폭넓게 설정했습니다.');
      R.TM = { score: clamp(s), feedback: fb };
    })();

    /* ---------- AD : Adaptability ---------- */
    (function () {
      var s = 0, fb = [];
      var adapted = 0;
      events.forEach(function (e) {
        if (decisions.some(function (d) { return d.t >= e.t && d.t <= e.t + 10; })) adapted++;
      });
      if (events.length) s += 35 * adapted / events.length;
      if (events.length && adapted) fb.push('주요 Event ' + events.length + '건 중 ' + adapted + '건에 대해 10분 이내 재판단(의사결정)을 실행했습니다.');
      else if (events.length) fb.push('새로운 Event 발생 후 판단을 갱신한 기록이 없습니다. 상황이 바뀌면 이전 결정도 재검토 대상입니다.');
      var lateHyp = log.filter(function (l) { return (l.type === 'hyp' || l.type === 'hyp_update') && l.t >= 15; }).length;
      if (lateHyp) { s += 20; fb.push('게임 중·후반(' + (log.filter(function (l) { return (l.type === 'hyp' || l.type === 'hyp_update') && l.t >= 15; })[0].clock) + ' 이후)에도 가설을 추가·수정하며 새 정보를 반영했습니다.'); }
      else fb.push('초기 가설을 이후 정보로 갱신하지 않았습니다.');
      s += decisions.length >= 3 ? 20 : decisions.length === 2 ? 14 : decisions.length === 1 ? 6 : 0;
      var reversed = decisions.some(function (d) { return d.data.actions.some(function (a) { return /restart_eq|resume_all|recipe_reset/.test(a.id); }); });
      if (reversed) { s += 10; fb.push('이전 조치를 재평가해 재가동·조건 복원 등 방향을 조정했습니다.'); }
      var prev = fin.prevention || '';
      if (/(표준|체크리스트|check|인터락|interlock|변경점|4m|교육|검증|승인|자동)/i.test(prev)) { s += 10; fb.push('재발방지 대책에 시스템적 장치(표준·체크리스트·인터락·변경점 관리 등)를 포함했습니다.'); }
      else fb.push('재발방지 대책이 개인 주의 수준에 머물러 있습니다. 표준·인터락·변경점 관리 등 “구조” 차원의 대책을 고려하십시오.');
      if ((fin.monitoring || []).length || (fin.monitoringText || '').length > 5) s += 5;
      R.AD = { score: clamp(s), feedback: fb };
    })();

    var w = cfg.weights || {}, tw = 0, tot = 0;
    FDL.DOMAINS.forEach(function (d) {
      R[d.id].level = levelOf(R[d.id].score);
      var ww = Number(w[d.id] == null ? 1 : w[d.id]); tw += ww; tot += ww * R[d.id].score;
    });
    return { domains: R, overall: tw ? Math.round(tot / tw) : 0, active: active, factorFirst: factorFirst };
  };
})();
