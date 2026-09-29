/* ==========================================================================
   FACTORY DECISION LAB — Simulation Model (Hidden Variables + Consequence)
   모든 KPI/데이터는 Hidden Root Cause 설정과 현재 상태로부터 계산됩니다.
   ========================================================================== */
(function () {
  var EQ = FDL.EQUIPMENT;
  var EQ_OFFSET = { 'EQ-01': -0.1, 'EQ-02': 0.1, 'EQ-03': 0, 'EQ-04': 0.05 };
  var LANE = { 'EQ-01': 'MT-01', 'EQ-02': 'MT-01', 'EQ-03': 'MT-02', 'EQ-04': 'MT-02' };
  var OPERATOR = { day: { 'MT-01': '최OO (선임)', 'MT-02': '김OO (신규)' }, night: { 'MT-01': '한OO', 'MT-02': '정OO' } };
  var H_LOT = -19;          // 어제 14:00 Paste Lot 변경
  var H_PCB = -24;          // 어제 09:00 PCB Lot 변경
  var H_RECIPE = -10 - 1 / 3; // 어제 22:40 Changeover
  var UNITS_PER_EQ_HOUR = 275;

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function noise(seed, key) { return ((hash(seed + '|' + key) % 10000) / 10000) * 2 - 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }

  function Model(cfg) {
    this.cfg = cfg;
    this.seed = String(cfg.seed || 1);
    var eq = {};
    EQ.forEach(function (id) { eq[id] = { status: 'RUN', prev: 'RUN', until: null }; });
    this.s = {
      t: 0,
      lot: 'NEW',
      oldStock: null,
      eq: eq,
      recipeFixed: false,
      tcFixed: false,
      rate: 1,
      lineStopped: false,
      fullInspection: false,
      hold: false,
      overtime: false,
      commDone: false,
      commAt: null,
      exposure: cfg.kpi.customerExposure0,
      produced: 0,
      prodSum: 0,
      prodN: 0,
      lastDefect: null,
      tasks: [],
      unlocked: { pcn: false, line3: false, profile: {} },
      findings: []
    };
    this.history = [];
  }

  Model.prototype.clock = function (t) {
    var p = (this.cfg.startClock || '09:00').split(':');
    var m = Math.round(Number(p[0]) * 60 + Number(p[1]) + (t === undefined ? this.s.t : t));
    m = ((m % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  Model.prototype.shiftAt = function (h) {
    // h: 게임 시작(09:00) 기준 상대 시간(시간). 주간 08-20, 야간 20-08
    var hod = ((9 + h) % 24 + 24) % 24;
    return (hod >= 8 && hod < 20) ? 'day' : 'night';
  };

  /* 과거 시점(h, 시간 단위) 설비별 불량률 */
  Model.prototype.historicDefect = function (id, h) {
    var c = this.cfg, rc = c.rootCause, ef = c.effects;
    var lotNew = h >= H_LOT;
    var d = ef.base + EQ_OFFSET[id];
    if (rc.material && lotNew) d += ef.lotEffect;
    if (rc.eqId === id) {
      if (rc.recipeError && h >= H_RECIPE) {
        d += ef.recipeEffect;
        if (rc.material && lotNew) d += ef.interaction;
      }
      if (rc.tcDrift) d += ef.tcDrift * clamp((h + 48) / 48, 0, 1);
    }
    d *= 1 + noise(this.seed, id + '@' + Math.round(h * 12)) * 0.07;
    return Math.max(0.4, d);
  };

  /* 현재 상태 기준 설비별 불량률 */
  Model.prototype.liveDefect = function (id, t) {
    var c = this.cfg, rc = c.rootCause, ef = c.effects, s = this.s;
    t = t === undefined ? s.t : t;
    var lotNew = s.lot === 'NEW';
    var d = ef.base + EQ_OFFSET[id];
    if (rc.material && lotNew) d += ef.lotEffect;
    if (rc.eqId === id) {
      if (rc.recipeError && !s.recipeFixed) {
        d += ef.recipeEffect;
        if (rc.material && lotNew) {
          var relief = s.rate < 1 ? FDL.actionParam(c, 'reduce', 'interactionRelief') : 0;
          d += ef.interaction * (1 - relief);
        }
      }
      if (rc.tcDrift && !s.tcFixed) d += ef.tcDrift + Math.min(ef.tcDriftRamp * t, 6);
    }
    d *= 1 + noise(this.seed, id + '#' + Math.floor(t / 3)) * 0.04;
    return Math.max(0.4, d);
  };

  Model.prototype.running = function () {
    var s = this.s;
    if (s.lineStopped) return [];
    return EQ.filter(function (id) { return s.eq[id].status === 'RUN'; });
  };

  Model.prototype.level = function (kind, v) {
    if (kind === 'delivery') return v >= 1.03 ? 'LOW' : v >= 0.97 ? 'MEDIUM' : v >= 0.86 ? 'HIGH' : 'CRITICAL';
    return v < 1.2 ? 'LOW' : v < 2.5 ? 'MEDIUM' : v < 4 ? 'HIGH' : 'CRITICAL';
  };

  /* KPI 스냅샷 */
  Model.prototype.snapshot = function () {
    var c = this.cfg, s = this.s, self = this;
    var run = this.running();
    var perEq = {};
    EQ.forEach(function (id) { perEq[id] = { status: s.lineStopped ? 'STOP' : s.eq[id].status, defect: self.liveDefect(id) }; });
    var defect;
    if (run.length) {
      defect = run.reduce(function (a, id) { return a + perEq[id].defect; }, 0) / run.length;
      s.lastDefect = defect;
    } else {
      defect = s.lastDefect == null ? c.effects.base : s.lastDefect;
    }
    var share = run.length / EQ.length;
    if (run.length > 0 && run.length < EQ.length) share = Math.min(1, share * (1 + FDL.actionParam(c, 'stop_eq', 'shiftGain')));
    var prod = 0;
    if (run.length) {
      prod = c.kpi.baseCapacity * share * s.rate * (s.fullInspection ? FDL.actionParam(c, 'full_inspection', 'productionFactor') : 1);
      prod -= Math.max(0, defect - c.effects.base);
      prod = Math.max(0, prod);
    }
    var util = run.length ? c.kpi.baseUtil * (run.length / EQ.length) * (s.rate < 1 ? 0.93 : 1) : 0;

    // 납기 예측
    var remainH = Math.max(0, 9 - s.t / 60);
    var fg = c.kpi.fgStock * (s.hold ? 0.5 : 1);
    var projected = fg + s.produced + remainH * c.kpi.planPerHour * prod / 100 + (s.overtime ? FDL.actionParam(c, 'overtime', 'deliveryBonus') / 100 * c.kpi.shipmentTarget : 0);
    var ratio = projected / c.kpi.shipmentTarget + (c.kpi.deliveryBias || 0) / 100;

    return {
      t: s.t, clock: this.clock(),
      defect: defect, yield: 100 - defect, production: prod, util: util,
      projected: projected, deliveryRatio: ratio, delivery: this.level('delivery', ratio),
      exposure: s.exposure, customer: this.level('customer', s.exposure),
      perEq: perEq, running: run.length, lot: s.lot
    };
  };

  /* 1 게임 분 진행 */
  Model.prototype.step = function (dt) {
    var c = this.cfg, s = this.s;
    var snap = this.snapshot();
    // 누적 생산
    s.produced += c.kpi.planPerHour * snap.production / 100 * dt / 60;
    s.prodSum += snap.production * dt; s.prodN += dt;
    // 고객 노출도 (유출)
    if (snap.running > 0) {
      var esc = s.fullInspection ? FDL.actionParam(c, 'full_inspection', 'escapeRate') : 0.10;
      s.exposure += snap.defect / 100 * esc * 12 * (s.hold ? 0.3 : 1) * dt;
    }
    // 대체 Lot 소모
    if (s.lot === 'OLD' && s.oldStock != null && snap.running > 0) {
      s.oldStock -= dt * (snap.running / EQ.length) * s.rate;
    }
    s.t += dt;
  };

  Model.prototype.record = function () {
    var snap = this.snapshot();
    var rec = {
      t: Math.round(snap.t), clock: snap.clock,
      defect: r1(snap.defect), yield: r1(snap.yield), production: r1(snap.production), util: r1(snap.util),
      delivery: snap.delivery, customer: snap.customer, ratio: Math.round(snap.deliveryRatio * 1000) / 1000,
      exposure: Math.round(snap.exposure * 100) / 100, perEq: {},
      lot: this.s.lot === 'NEW' ? 'SP-0925B' : 'SP-0911A'
    };
    Object.keys(snap.perEq).forEach(function (id) { rec.perEq[id] = { s: snap.perEq[id].status, d: r1(snap.perEq[id].defect) }; });
    this.history.push(rec);
    return rec;
  };

  /* ---------------- 조치 적용 (Consequence) ---------------- */
  Model.prototype.apply = function (actionId, target) {
    var c = this.cfg, s = this.s, notes = [];
    var P = function (k) { return FDL.actionParam(c, actionId, k); };
    switch (actionId) {
      case 'continue':
        notes.push('현 생산조건 유지'); break;
      case 'reduce':
        s.rate = P('rate'); notes.push('라인 속도 ' + Math.round(s.rate * 100) + '%로 조정'); break;
      case 'stop_eq':
        if (target && s.eq[target]) { s.eq[target].status = 'STOP'; notes.push(target + ' 정지, 물량 타 설비 분산'); }
        break;
      case 'restart_eq':
        if (target && s.eq[target] && s.eq[target].status === 'STOP') { s.eq[target].status = 'RUN'; notes.push(target + ' 재가동'); }
        break;
      case 'stop_all':
        s.lineStopped = true; notes.push('라인 전체 생산 중단'); break;
      case 'resume_all':
        s.lineStopped = false; notes.push('라인 생산 재개'); break;
      case 'quarantine_lot':
        if (s.lot === 'NEW' && (s.oldStock == null || s.oldStock > 0)) {
          s.lot = 'OLD';
          if (s.oldStock == null) s.oldStock = P('stockMin');
          s.produced = Math.max(0, s.produced - P('wipLoss') / 100 * c.kpi.planPerHour);
          notes.push('SP-0925B 격리 → SP-0911A 투입 (재고 약 ' + Math.round(s.oldStock) + '분)');
        } else notes.push('대체 Lot 재고 없음 — 격리 불가');
        break;
      case 'full_inspection':
        s.fullInspection = true; notes.push('최종검사 전수검사 전환'); break;
      case 'hold_shipment':
        if (!s.hold) { s.hold = true; s.exposure *= (1 - P('exposureCut')); }
        notes.push('어제 14:00 이후 생산분 출하 보류'); break;
      case 'customer_comm':
        if (!s.commDone) { s.commDone = true; s.commAt = s.t; s.exposure = Math.max(0.3, s.exposure - P('exposureRelief')); }
        notes.push('고객 품질팀 선제 공유'); break;
      case 'overtime':
        s.overtime = true; notes.push('잔업·특근 편성'); break;
      case 'eq_inspection':
        if (target && s.eq[target]) {
          var e = s.eq[target];
          if (e.status !== 'INSPECT') { e.prev = e.status === 'STOP' ? 'STOP' : 'RUN'; e.status = 'INSPECT'; }
          s.tasks.push({ type: 'inspection', eq: target, doneAt: s.t + P('durationMin') });
          notes.push(target + ' 긴급점검 착수 (약 ' + P('durationMin') + '분 소요)');
        }
        break;
      case 'recipe_reset':
        if (target && s.eq[target]) {
          var e2 = s.eq[target];
          if (e2.status === 'RUN' || e2.status === 'STOP') { e2.prev = e2.status; e2.status = 'SETUP'; }
          s.tasks.push({ type: 'recipe', eq: target, doneAt: s.t + P('durationMin') });
          notes.push(target + ' 레시피 재로드 (약 ' + P('durationMin') + '분 소요)');
        }
        break;
      case 'supplier_inquiry':
        if (!s.tasks.some(function (x) { return x.type === 'supplier'; }) && !s.unlocked.pcn) {
          s.tasks.push({ type: 'supplier', doneAt: s.t + P('replyMin') });
        }
        notes.push('공급사 회신 대기 (약 ' + P('replyMin') + '분)'); break;
    }
    return notes;
  };

  /* 진행 중 작업 완료 처리 → 결과 이벤트 반환 */
  Model.prototype.processTasks = function () {
    var s = this.s, rc = this.cfg.rootCause, out = [], self = this;
    var remain = [];
    s.tasks.forEach(function (task) {
      if (task.doneAt > s.t) { remain.push(task); return; }
      if (task.type === 'inspection') {
        var e = s.eq[task.eq];
        e.status = s.tasks.some(function (x) { return x !== task && x.eq === task.eq && x.doneAt > s.t; }) ? e.status : e.prev;
        s.unlocked.profile[task.eq] = true;
        var lines = [];
        if (rc.eqId === task.eq && rc.tcDrift && !s.tcFixed) {
          s.tcFixed = true;
          lines.push('Profiler 실측: Zone 6 실제 온도가 설정 대비 +7°C 높게 측정됨 (제어 열전대 편차) → 열전대 교체·교정 완료');
        } else {
          lines.push('Profiler 실측: 존별 실측 온도 설정 대비 ±1°C 이내 (정상)');
        }
        if (rc.eqId === task.eq && rc.recipeError && !s.recipeFixed) {
          lines.push('로드된 레시피: PM220_RF_Rev.C (타 설비는 Rev.D). Soak 구간 설정이 타 설비 대비 5°C 낮음');
          lines.push('※ 점검팀은 레시피를 임의 변경하지 않았습니다. 레시피 재설정 여부는 책임자 판단이 필요합니다.');
        } else {
          lines.push('로드된 레시피: PM220_RF_Rev.D (표준과 일치)');
        }
        lines.push('컨베이어 속도·N2 농도·Fan 회전수 정상');
        s.findings.push({ t: s.t, eq: task.eq, lines: lines });
        out.push({ id: 'inspection_done_' + task.eq, type: 'EQUIPMENT', title: 'EQUIPMENT REPORT — ' + task.eq + ' 긴급점검 결과', lines: lines });
      } else if (task.type === 'recipe') {
        var e3 = s.eq[task.eq];
        e3.status = e3.prev === 'STOP' ? 'STOP' : 'RUN';
        var fixed = rc.eqId === task.eq && rc.recipeError && !s.recipeFixed;
        if (fixed) s.recipeFixed = true;
        out.push({ id: 'recipe_done_' + task.eq, type: 'EQUIPMENT', title: 'EQUIPMENT — ' + task.eq + ' 레시피 재로드 완료',
          lines: [fixed ? '레시피 PM220_RF_Rev.C → Rev.D 로 변경 로드되었습니다.' : '기존과 동일한 Rev.D 레시피가 재로드되었습니다. (변경 사항 없음)', task.eq + ' 가동 상태로 복귀했습니다.'] });
      } else if (task.type === 'supplier') {
        s.unlocked.pcn = true;
        var lines2 = rc.material ? [
          '공급사 회신: SP-0925B 는 활성제(Flux) 배합 변경 Lot 입니다. (PCN-0917, 9/17 통보)',
          '점도 204 Pa·s 로 규격(160~210) 상한에 근접한 Lot 이며, 변경 배합은 Soak 구간 +5°C 권장 Profile 필요.',
          '대체 Lot SP-0927C (점도 185) 는 내일 06:00 입고 가능합니다.'
        ] : [
          '공급사 회신: SP-0925B 는 PCN-0917(활성제 배합 변경) 적용 Lot 이며 출하검사 전 항목 합격입니다.',
          '동일 Lot 을 사용하는 타 고객사 이상 보고는 없습니다. 권장 Profile 은 Soak +5°C (귀사 Rev.D 반영 완료).',
          '대체 Lot 이 필요하면 내일 06:00 입고 가능합니다.'
        ];
        out.push({ id: 'supplier_reply', type: 'MATERIAL', title: 'MATERIAL — 공급사 회신 도착', lines: lines2 });
      }
    });
    s.tasks = remain;
    // 대체 Lot 소진
    if (s.lot === 'OLD' && s.oldStock != null && s.oldStock <= 0) {
      s.lot = 'NEW';
      out.push({ id: 'stock_out', type: 'MATERIAL', title: 'MATERIAL ALERT — 대체 Lot 소진',
        lines: ['SP-0911A 재고가 소진되었습니다.', '생산 유지를 위해 라인에 SP-0925B 가 다시 투입되었습니다. 추가 판단이 필요합니다.'] });
    }
    return out;
  };

  /* ---------------- 데이터 생성 (탐색용) ---------------- */
  Model.prototype.trend7d = function () {
    var self = this, out = [];
    for (var d = 6; d >= 2; d--) {
      out.push({ label: 'D-' + d, value: r1(this.cfg.effects.base + 0.05 * (6 - d) * 0.3 + noise(this.seed, 'day' + d) * 0.12) });
    }
    // 어제: 00~24시 평균
    var sum = 0, n = 0;
    for (var h = -33; h < -9; h += 0.5) { EQ.forEach(function (id) { sum += self.historicDefect(id, h); n++; }); }
    out.push({ label: 'D-1 (어제)', value: r1(sum / n) });
    out.push({ label: '오늘', value: r1(this.snapshot().defect), live: true });
    return out;
  };

  Model.prototype.hourly = function () {
    var self = this, labels = [], series = {}, overall = [];
    EQ.forEach(function (id) { series[id] = []; });
    for (var h = -24; h < 0; h++) {
      labels.push(this.clock(h * 60));
      var sum = 0;
      EQ.forEach(function (id) {
        var v = 0; for (var k = 0; k < 4; k++) v += self.historicDefect(id, h + k / 4); v /= 4;
        series[id].push(r1(v)); sum += v;
      });
      overall.push(r1(sum / EQ.length));
    }
    // 게임 진행분 (5분 단위)
    for (var i = 0; i < this.history.length; i += 5) {
      var rec = this.history[i];
      labels.push(rec.clock);
      EQ.forEach(function (id) { series[id].push(rec.perEq[id].s === 'RUN' ? rec.perEq[id].d : null); });
      overall.push(rec.defect);
    }
    return { labels: labels, series: series, overall: overall, liveFrom: 24 };
  };

  Model.prototype.pareto = function () {
    var base = this.cfg.effects.base;
    var now = this.snapshot().defect;
    var baseMix = [['부품 틀어짐', 0.30], ['미납 (Insufficient)', 0.24], ['Solder Bridge', 0.16], ['Void', 0.12], ['Tombstone', 0.10], ['기타', 0.08]];
    var excessMix = { 'Solder Bridge': 0.52, 'Void': 0.38, '미납 (Insufficient)': 0.10 };
    var ex = Math.max(0, now - base);
    return baseMix.map(function (m) {
      var today = base * m[1] + ex * (excessMix[m[0]] || 0);
      return { label: m[0], baseline: Math.round(base * m[1] * 100) / 100, today: Math.round(today * 100) / 100 };
    }).sort(function (a, b) { return b.today - a.today; });
  };

  /* 표본 생성: 과거(시간 단위) + 게임 진행(분 단위) */
  Model.prototype.samples = function (period) {
    var self = this, out = [];
    var from = period === '24h' ? -24 : period === 'today' ? -1 : -48;
    for (var h = from; h < 0; h += 0.5) {
      var shift = this.shiftAt(h);
      EQ.forEach(function (id) {
        out.push({
          eq: id, h: h, d: self.historicDefect(id, h), n: UNITS_PER_EQ_HOUR / 2,
          lot: h >= H_LOT ? 'SP-0925B' : 'SP-0911A', pcb: h >= H_PCB ? 'PCB-0920' : 'PCB-0913',
          shift: shift, lane: LANE[id], op: OPERATOR[shift][LANE[id]],
          hod: self.clock(Math.floor(h) * 60).slice(0, 2) + '시'
        });
      });
    }
    this.history.forEach(function (rec) {
      EQ.forEach(function (id) {
        if (rec.perEq[id].s !== 'RUN') return;
        out.push({
          eq: id, h: rec.t / 60, d: rec.perEq[id].d, n: UNITS_PER_EQ_HOUR / 60,
          lot: rec.lot || 'SP-0925B', pcb: 'PCB-0920', shift: 'day', lane: LANE[id], op: OPERATOR.day[LANE[id]],
          hod: rec.clock.slice(0, 2) + '시'
        });
      });
    });
    return out;
  };

  FDL.STRAT_DIMS = {
    eq: { label: 'Reflow 설비', key: 'eq' },
    lot: { label: 'Solder Paste Lot', key: 'lot' },
    shift: { label: '작업조 (주간/야간)', key: 'shiftLabel' },
    pcb: { label: 'PCB Lot', key: 'pcb' },
    lane: { label: '실장 Lane (Mounter)', key: 'lane' },
    op: { label: '실장 작업자', key: 'op' },
    hod: { label: '시간대', key: 'hod' }
  };

  Model.prototype.groupKey = function (smp, dim) {
    if (dim === 'shift') {
      var h = smp.h;
      if (h >= -1) return '주간조 (오늘)';
      if (h >= -13) return '야간조 (어젯밤)';
      if (h >= -25) return '주간조 (어제)';
      if (h >= -37) return '야간조 (그젯밤)';
      return '주간조 (그제)';
    }
    return smp[FDL.STRAT_DIMS[dim].key];
  };

  Model.prototype.strat = function (dim, period) {
    var self = this, g = {};
    this.samples(period).forEach(function (smp) {
      var k = self.groupKey(smp, dim);
      if (!g[k]) g[k] = { label: k, def: 0, n: 0, first: smp.h };
      g[k].def += smp.d / 100 * smp.n; g[k].n += smp.n;
      g[k].first = Math.min(g[k].first, smp.h);
    });
    var rows = Object.keys(g).map(function (k) { return { label: k, defect: r1(g[k].def / g[k].n * 100), units: Math.round(g[k].n), first: g[k].first }; });
    if (dim === 'hod' || dim === 'shift') rows.sort(function (a, b) { return a.first - b.first; });
    else rows.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
    return rows;
  };

  Model.prototype.cross = function (dimA, dimB, period) {
    var self = this, cells = {}, rowsK = {}, colsK = {};
    this.samples(period).forEach(function (smp) {
      var a = self.groupKey(smp, dimA), b = self.groupKey(smp, dimB);
      rowsK[a] = Math.min(rowsK[a] === undefined ? 99 : rowsK[a], smp.h);
      colsK[b] = Math.min(colsK[b] === undefined ? 99 : colsK[b], smp.h);
      var k = a + '||' + b;
      if (!cells[k]) cells[k] = { def: 0, n: 0 };
      cells[k].def += smp.d / 100 * smp.n; cells[k].n += smp.n;
    });
    function order(obj, dim) {
      var ks = Object.keys(obj);
      if (dim === 'hod' || dim === 'shift') return ks.sort(function (x, y) { return obj[x] - obj[y]; });
      return ks.sort();
    }
    var rows = order(rowsK, dimA), cols = order(colsK, dimB);
    var m = rows.map(function (r) {
      return cols.map(function (cName) {
        var cell = cells[r + '||' + cName];
        return cell ? { v: r1(cell.def / cell.n * 100), n: Math.round(cell.n) } : null;
      });
    });
    return { rows: rows, cols: cols, m: m };
  };

  Model.prototype.recipeOf = function (id) {
    var rc = this.cfg.rootCause;
    return (rc.eqId === id && rc.recipeError && !this.s.recipeFixed) ? 'Rev.C' : 'Rev.D';
  };

  Model.prototype.zoneTable = function (id) {
    var rev = this.recipeOf(id);
    var sp = rev === 'Rev.D' ? [120, 150, 170, 180, 215, 245, 235, 180] : [120, 150, 165, 175, 215, 240, 235, 180];
    var rc = this.cfg.rootCause, s = this.s, self = this;
    var drift = rc.eqId === id && rc.tcDrift && !s.tcFixed;
    return sp.map(function (v, i) {
      var pv = v + Math.round(noise(self.seed, id + 'z' + i) * 10) / 10;
      var out = 55 + Math.round((noise(self.seed, id + 'o' + i) + 1) * 8);
      if (drift && i === 5) out = 91 + Math.round(Math.min(s.t / 10, 3));
      return { zone: 'Z' + (i + 1), sv: v, pv: r1(pv), out: out };
    });
  };

  Model.prototype.alarms = function (id) {
    var rc = this.cfg.rootCause, list = [];
    if (rc.eqId === id && rc.tcDrift) {
      list.push({ time: '어제 23:52', code: 'W-216', msg: 'Zone 6 Heater 출력 90% 초과 (Warning) — 작업자 Reset' });
      list.push({ time: '오늘 04:17', code: 'W-216', msg: 'Zone 6 Heater 출력 90% 초과 (Warning) — 작업자 Reset' });
      if (!this.s.tcFixed) list.push({ time: '오늘 08:41', code: 'W-216', msg: 'Zone 6 Heater 출력 92% (Warning)' });
    }
    if (id === 'EQ-01') list.push({ time: '어제 15:05', code: 'I-102', msg: '컨베이어 폭 자동조정 완료 (Info)' });
    if (id === 'EQ-04') list.push({ time: '그제 11:30', code: 'W-310', msg: 'N2 농도 일시 상승 1,050ppm (Warning) — 자동 복귀' });
    if (id === 'EQ-02') list.push({ time: '오늘 06:12', code: 'I-120', msg: '냉각 Fan 정기 점검 알림 (Info)' });
    return list;
  };

  Model.prototype.changeoverEq = function () { return this.cfg.rootCause.eqId || 'EQ-02'; };

  FDL.Model = Model;
  FDL.util = { r1: r1, clamp: clamp, noise: noise };
})();
