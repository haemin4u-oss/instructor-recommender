# FACTORY DECISION LAB

전자부품 제조부문 교육용 **Interactive Case Study Simulation Game**

> 교육생은 오늘 SMT 라인의 책임자가 되어
> **NOTICE → EXPLORE → HYPOTHESIZE → DECIDE → EXPERIENCE CONSEQUENCE → REASSESS**
> 를 반복하며 불완전한 정보 속에서 판단합니다. 퀴즈가 아니라 **판단 과정**을 Debrief 합니다.

---

## 1. 실행 방법

| 방법 | 설명 |
|---|---|
| **파일 더블클릭** | `index.html`(교육생) / `admin.html`(강사) 을 Chrome·Edge 로 엽니다. 서버·설치·인터넷이 필요 없습니다. |
| **사내 웹 배포** | `factory-decision-lab/` 폴더를 그대로 사내 웹서버 또는 GitHub Pages 에 올립니다. |
| **시연용 빠른 진행** | `index.html?speed=10` → 10배속 (45분 Case 를 4.5분에) |

- 외부 라이브러리/CDN 을 사용하지 않아 **폐쇄망 제조현장 PC 에서도 동작**합니다.
- 권장 해상도: PC 1440px 이상 / 태블릿 1024px 가로 (모바일도 동작하나 권장하지 않음)

---

## 2. 교육 운영 흐름 (강사용)

| 단계 | 시간 | 내용 |
|---|---|---|
| ① 사전 설정 | 교육 전 | `admin.html` → Case·난이도·제한시간·공개 데이터 설정 → **배포 링크 복사** |
| ② 브리핑 | 5분 | 역할 부여: “당신은 오늘 이 라인의 책임자입니다.” / 정답이 없다는 원칙 안내 |
| ③ 시뮬레이션 | 35~50분 | 팀별 플레이. 강사는 상단 `⏸ 일시정지` 로 진행 조절 가능 |
| ④ 결과 제출 | 5분 | 같은 PC → 자동 저장 / 다른 PC → 결과 화면에서 **결과 JSON 저장** 후 제출 |
| ⑤ Debrief | 30분 | `admin.html` → **Debrief 비교** → 팀 선택(최대 4) → 판단 경로·Timeline 나란히 비교 |

**설정 적용 우선순위:** 배포 링크(`#cfg=`) > 강사 모드 “이 브라우저에 저장” > 기본값

---

## 3. 화면 구성

| 영역 | 기능 |
|---|---|
| **KPI Bar** | 생산량 · 수율 · 불량률 · 설비가동률 · 납기 Risk · Customer Risk (시작 대비 증감, Sparkline, WARNING/CRITICAL) |
| **Factory Map** | 원자재 → 인쇄 → 실장 → Reflow → 검사 → 출하. 클릭 시 Side Panel (생산량·수율·불량률·설비상태·공정조건·작업자·변경사항·Lot·이상이력) |
| **Data Explorer** | Dashboard · Process · Quality(Trend/시간대/Pareto/층별/교차) · Equipment · Production · Material · People · History |
| **AI Analyst** | 자연어 질의 → Case 데이터 범위 내 분석. **원인을 직접 알려주지 않고** 확인 질문으로 되돌려줌 |
| **Hypothesis Board** | 가설 · 4M 구분 · 가능성(LOW/MEDIUM/HIGH) · 근거 · 상태(검증 전/검증 중/기각/유력) |
| **DECISION** | 복수 조치 선택 + 근거 필수 입력 → Consequence 화면 (KPI 전/후) → 후속 Event |
| **FINAL DECISION** | Root Cause · Immediate Action · Production · Collaboration · Customer · Recurrence Prevention · Monitoring KPI |
| **Result Dashboard** | 6대 영역 프로필 + 행동 근거 피드백, Hidden Root Cause 공개, KPI 궤적, Decision Timeline, Debrief 질문 |

---

## 4. Case 설계 (기본 Case A)

**SMT Line 2 — 전장용 파워모듈 PM-220 불량 급증 (09:00, 불량률 1.9% → 5.8%)**

| 구분 | 내용 |
|---|---|
| **Hidden Root Cause** | ① Solder Paste Lot 변경(SP-0925B, 점도 상한 근접) **+** ② EQ-03 Zone 6 열전대 편차 **+** ③ 야간조 Changeover 시 구 레시피(Rev.C) 로드 |
| **결합 효과** | 신규 Lot × 구 레시피 조합에서 불량 급증 → 하나만 조치하면 **부분 개선**에 그침 |
| **Noise** | PCB Lot 변경 · 신규 작업자(Lane2) · MT-02 Nozzle 교체 · AOI 프로그램 업데이트 · 공조 습도 변경 (일부는 교란 변수로 상관이 보이도록 설계) |
| **Time Event** | T+10 불량 증가 / T+20 생산계획팀 긴급 요청 / T+30 고객사 문의 / T+40 타 라인 동일 현상 |
| **조건부 Event** | 생산 차질(생산량<85%), 공장장 호출, 대체 Lot 잔량·소진, 고객 Escalation, 검사 병목, 품질 임계 |

**프리셋:** Case A 복합원인(표준) · Case B 원자재 단독(입문) · Case C 설비+Setting (원자재는 Noise, Lot 격리 효과 없음)

### Consequence 예시 (Case A)

| 조치 | 즉시 결과 | 이후 전개 |
|---|---|---|
| EQ-03 정지 | 불량률 5.8→3.2%, 생산량 92→76%, 납기 MEDIUM→HIGH | PRODUCTION ALERT (출하 수량 미달) |
| 원자재 Lot 격리 | 불량률 → 약 2.4% (EQ-03 은 여전히 높음) | 대체 Lot 재고 약 28분 → 소진 시 신규 Lot 재투입 |
| EQ-03 긴급점검 | 10분간 정지 | 열전대 교정 + “Rev.C 로드” 발견 → 레시피 재설정 판단 필요 |
| 아무 조치 없음 | 변화 없음 | 불량 점진 악화, 고객 Risk CRITICAL |

---

## 5. 평가 (Debrief) 기준

점수는 순위가 아니라 **행동 로그 기반 피드백**의 요약입니다.

| 영역 | 행동 근거 |
|---|---|
| Situation Awareness | 첫 품질 데이터 확인 시점, Trend/Pareto 확인, Event 후 8분 내 후속 행동 |
| Data Analysis | 원인 요인별 데이터 확인 여부·순서, 4M 탐색 폭, 교차 분석, Noise 비중 |
| Hypothesis Quality | 가설 수·근거·상태 갱신, 최종 Root Cause 의 원인 포함/Noise 포함 |
| Decision Making | 첫 결정 시점, 근거의 데이터 인용, 불량률 개선, 유출 차단 |
| Trade-off Management | 종료 시 품질·생산·납기·고객 균형, 대체 생산계획, 협업·고객 대응 |
| Adaptability | Event 후 재판단, 가설 수정, 조치 재평가, 구조적 재발방지 대책 |

---

## 6. 파일 구조

```
factory-decision-lab/
├─ index.html            교육생 게임 화면
├─ admin.html            강사 모드 (설정 · 배포 · Debrief 비교)
└─ assets/
   ├─ css/style.css      Control Room 다크 테마 / 반응형
   └─ js/
      ├─ config.js       Case·조치·이벤트·프리셋 설정
      ├─ model.js        시뮬레이션 모델 (Hidden Variables → KPI/데이터 계산, Consequence)
      ├─ analyst.js      AI Manufacturing Analyst (규칙 기반, Case 범위 한정)
      ├─ scoring.js      Debrief 평가 · Timeline
      ├─ charts.js       SVG 차트 (외부 의존성 없음)
      ├─ game.js         교육생 UI · 타이머 · 이벤트 · 의사결정
      └─ admin.js        강사 모드
```

모든 데이터(7일 Trend, 시간대별 추이, 층별·교차 분석, 설비 조건)는 `model.js` 가 Hidden Root Cause 설정으로부터 **일관되게 계산**합니다. 강사가 원인 구조를 바꾸면 데이터 전체가 그에 맞게 바뀝니다.
