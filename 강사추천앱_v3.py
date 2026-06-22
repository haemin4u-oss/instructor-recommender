"""
강사 추천 자동화 v3
- 강사 레벨 / 교육 대상 선택
- 4단계 플로우: 조건입력 → 후보선택(클릭) → 적합성검증 → 결과+Notion선택저장
- 스케줄 자동화 준비
"""

import streamlit as st
import anthropic
import sqlite3
import json
import re
import requests
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="강사 추천 자동화", page_icon="🎯", layout="wide")

# ─────────────────────────────────────────────
# 상수
# ─────────────────────────────────────────────
INSTRUCTOR_LEVELS = [
    "대학교수 / 연구원",
    "프리랜서 강사",
    "유튜버 / 크리에이터",
    "연예인 / 방송인",
    "운동선수 / 스포츠인",
    "작가 / 저술가",
    "컨설팅펌 전문가",
    "기업체 대표 / 임원",
    "스타트업 창업자",
    "정부 / 공공기관 전문가",
    "기타 (직접 입력)",
]

AUDIENCE_OPTIONS = [
    "신입사원 (1~3년차)",
    "주임·대리급 (3~7년차)",
    "과장·차장급 (7~12년차)",
    "팀장 / 리더급",
    "임원 / 경영진",
    "전사원 (전 직급 통합)",
    "기타 (직접 입력)",
]

# ─────────────────────────────────────────────
# Session State
# ─────────────────────────────────────────────
def init():
    defaults = {
        "step": 1,
        "topic": "",
        "background": "",
        "levels": [],
        "audience": AUDIENCE_OPTIONS[0],
        "candidates": [],
        "prev_names": [],
        "selected_for_verify": [],
        "verified": [],
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init()

# ─────────────────────────────────────────────
# DB
# ─────────────────────────────────────────────
@st.cache_resource
def get_db():
    conn = sqlite3.connect("instructor_history.db", check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT, levels TEXT, audience TEXT,
            name TEXT, specialty TEXT, affiliation TEXT,
            yt_score INT, ref_score INT, fit_score INT, target_score INT,
            total_score INT, verdict TEXT,
            yt_urls TEXT, ref_summary TEXT, verdict_reason TEXT,
            verified_at TEXT, notion_saved INT DEFAULT 0
        )
    """)
    conn.commit()
    return conn

DB = get_db()

# ─────────────────────────────────────────────
# API 키 (Streamlit Secrets → .env 순서)
# ─────────────────────────────────────────────
def _secret(key, default=""):
    try:
        return st.secrets[key]
    except Exception:
        return os.getenv(key, default)

CLAUDE_KEY   = _secret("ANTHROPIC_API_KEY").strip()
TAVILY_KEY   = _secret("TAVILY_API_KEY").strip()
YOUTUBE_KEY  = _secret("YOUTUBE_API_KEY").strip()
NOTION_TOKEN_VAL = _secret("NOTION_TOKEN").strip()
NOTION_DB_VAL    = _secret("NOTION_DB_ID", "5ade06bd-27f0-4434-b8c2-0deeb54e3d35").strip()

use_notion   = bool(NOTION_TOKEN_VAL)
notion_token = NOTION_TOKEN_VAL
notion_db_id = NOTION_DB_VAL

def api_ok():
    return bool(CLAUDE_KEY and TAVILY_KEY and YOUTUBE_KEY)

# ─────────────────────────────────────────────
# API 함수
# ─────────────────────────────────────────────
def claude_client():
    return anthropic.Anthropic(api_key=CLAUDE_KEY)

def get_candidates(topic, levels, audience, background="", exclude=None, count=10, extra_direction=""):
    exclude = exclude or []
    background_str = f"\n강연 배경/맥락: {background}" if background else ""
    exclude_str    = f"\n제외 강사(이미 추천됨): {', '.join(exclude)}" if exclude else ""
    direction_str  = f"\n추가 서칭 방향: {extra_direction}" if extra_direction else ""
    prompt = f"""교육 주제: '{topic}'
강사 분류: {', '.join(levels) if levels else '제한 없음'}
교육 대상: {audience}{background_str}{exclude_str}{direction_str}

실존하는 강사/강연자 {count}명을 추천하세요.
JSON 배열로만 응답 (다른 텍스트 없이):
[{{"name":"강사명","level":"분류","specialty":"전문분야","affiliation":"소속/직함","reason":"추천이유(2문장)","keyword":"검색키워드","fee_range":"예상강연료(예:300~500만원)"}}]"""
    try:
        r = claude_client().messages.create(
            model="claude-opus-4-5", max_tokens=3000,
            messages=[{"role":"user","content":prompt}])
        m = re.search(r'\[.*\]', r.content[0].text, re.DOTALL)
        if m: return json.loads(m.group())
    except Exception as e:
        st.error(f"Claude 오류: {e}")
    return []

def youtube_top3(name, topic):
    queries = [f"{name} 강연", f"{name} {topic} 강의", f"{name} 특강"]
    results, seen = [], set()
    for q in queries:
        try:
            r = requests.get("https://www.googleapis.com/youtube/v3/search",
                params={"key":YOUTUBE_KEY,"q":q,"type":"video","maxResults":5,
                        "part":"snippet","relevanceLanguage":"ko"}, timeout=10)
            if r.status_code == 200:
                for item in r.json().get("items",[]):
                    vid = item["id"]["videoId"]
                    if vid not in seen:
                        seen.add(vid)
                        s = item["snippet"]
                        results.append({
                            "url": f"https://youtube.com/watch?v={vid}",
                            "title": s.get("title",""),
                            "channel": s.get("channelTitle",""),
                            "desc": s.get("description","")[:150],
                        })
        except: continue
    # 강연 관련 키워드 우선 정렬
    kws = ["강연","강의","특강","lecture",topic]
    results.sort(key=lambda x: -sum(k in x["title"]+x["desc"] for k in kws))
    return results[:3]

def tavily_ref(keyword):
    try:
        r = requests.post("https://api.tavily.com/search",
            json={"api_key":TAVILY_KEY,"query":f"{keyword} 강연 이력 경력","max_results":5},
            timeout=10)
        if r.status_code == 200:
            items = r.json().get("results",[])
            return " | ".join(x.get("content","")[:150] for x in items[:3])
    except: pass
    return "검색 결과 없음"

def tavily_fee(name):
    """강연료/섭외비 웹 검색"""
    try:
        r = requests.post("https://api.tavily.com/search",
            json={"api_key":TAVILY_KEY,
                  "query":f"{name} 강연료 섭외비 강사비 출연료",
                  "max_results":5},
            timeout=10)
        if r.status_code == 200:
            items = r.json().get("results",[])
            return " | ".join(x.get("content","")[:200] for x in items[:3])
    except: pass
    return ""

def estimate_fee(name, specialty, affiliation, level, ref_info, fee_web):
    """Claude로 예상 강연료 추정"""
    prompt = f"""강사 정보를 바탕으로 1회 강연(2시간 기준) 예상 강연료를 추정하세요.

강사: {name}
소속/직함: {affiliation}
전문분야: {specialty}
강사 분류: {level}

[웹 레퍼런스 - 이력/경력]
{ref_info[:300]}

[웹 검색 - 강연료 관련]
{fee_web[:300] if fee_web else "검색 결과 없음"}

한국 기업 교육 시장 기준으로 현실적인 범위를 추정하세요.
JSON으로만 응답:
{{"fee_range":"예: 300~500만원","fee_basis":"추정 근거 (1문장)"}}"""
    try:
        r = claude_client().messages.create(
            model="claude-opus-4-5", max_tokens=200,
            messages=[{"role":"user","content":prompt}])
        m = re.search(r'\{.*\}', r.content[0].text, re.DOTALL)
        if m:
            return json.loads(m.group())
    except: pass
    return {"fee_range":"추정 불가", "fee_basis":""}

def verify(name, specialty, affiliation, topic, levels, audience, ref_info, yt_list):
    """
    적합성 검증 로직 (총 100점)
    ① YouTube 영상  : 40점 (존재 20 + 주제적합 10 + 채널신뢰도 10)
    ② 레퍼런스      : 30점 (강연이력 15 + 주요기관 10 + 최근활동 5)
    ③ 전문분야 일치 : 20점 (Claude 평가)
    ④ 교육대상 적합 : 10점 (Claude 평가)
    판정: ≥70 ✅적합 / 50~69 🔶검토필요 / <50 ❌부적합
    """
    yt_text = "\n".join(f"- {x['title']} ({x['channel']}): {x['desc']}" for x in yt_list) or "없음"
    prompt = f"""강사 적합성 검증.

강사: {name} / {affiliation} / {specialty}
주제: {topic} | 대상: {audience} | 분류: {', '.join(levels)}

[웹 레퍼런스] {ref_info[:400]}
[유튜브({len(yt_list)}개)] {yt_text}

JSON으로만:
{{"yt_score":0~40,"ref_score":0~30,"fit_score":0~20,"target_score":0~10,
  "ref_summary":"레퍼런스 요약(2~3문장)","verdict_reason":"판정 근거(1~2문장)"}}"""
    try:
        r = claude_client().messages.create(
            model="claude-opus-4-5", max_tokens=500,
            messages=[{"role":"user","content":prompt}])
        m = re.search(r'\{.*\}', r.content[0].text, re.DOTALL)
        if m:
            d = json.loads(m.group())
            total = min(d.get("yt_score",0)+d.get("ref_score",0)+d.get("fit_score",0)+d.get("target_score",0), 100)
            d["total"] = total
            d["verdict"] = "✅ 적합" if total>=70 else "🔶 검토 필요" if total>=50 else "❌ 부적합"
            return d
    except: pass
    return {"yt_score":0,"ref_score":0,"fit_score":0,"target_score":0,
            "total":0,"verdict":"⏳ 오류","ref_summary":"평가 불가","verdict_reason":""}

def notion_save(name, specialty, affiliation, level, topic, audience,
                yt_score, ref_score, fit_score, target_score, total,
                verdict, ref_summary, verdict_reason, yt_list, fee_range=""):
    yt_text = "\n".join(x["url"] for x in yt_list)
    # 교육대상 선택값을 Notion SELECT 옵션값에 맞게 변환
    audience_map = {
        "신입사원 (1~3년차)":    "신입사원",
        "주임·대리급 (3~7년차)": "주임대리급",
        "과장·차장급 (7~12년차)":"과장차장급",
        "팀장 / 리더급":          "팀장/리더급",
        "임원 / 경영진":          "임원/경영진",
        "전사원 (전 직급 통합)":  "전사원",
    }
    level_map = {
        "대학교수 / 연구원":      "대학교수/연구원",
        "프리랜서 강사":          "프리랜서 강사",
        "유튜버 / 크리에이터":    "유튜버/크리에이터",
        "연예인 / 방송인":        "연예인/방송인",
        "운동선수 / 스포츠인":    "운동선수/스포츠인",
        "작가 / 저술가":          "작가/저술가",
        "컨설팅펌 전문가":        "컨설팅펌 전문가",
        "기업체 대표 / 임원":     "기업체 대표/임원",
        "스타트업 창업자":        "스타트업 창업자",
        "정부 / 공공기관 전문가": "정부/공공기관 전문가",
    }
    notion_audience = audience_map.get(audience, audience.split(" ")[0])
    notion_level    = level_map.get(level, level)
    try:
        r = requests.post("https://api.notion.com/v1/pages",
            headers={"Authorization":f"Bearer {notion_token}",
                     "Content-Type":"application/json","Notion-Version":"2022-06-28"},
            json={"parent":{"database_id":notion_db_id},"properties":{
                "강사명":      {"title":     [{"text":{"content":name}}]},
                "교육주제":    {"rich_text": [{"text":{"content":topic}}]},
                "강사유형":    {"select":    {"name": notion_level}},
                "교육대상":    {"select":    {"name": notion_audience}},
                "전문분야":    {"rich_text": [{"text":{"content":specialty}}]},
                "소속직함":    {"rich_text": [{"text":{"content":affiliation}}]},
                "YouTube점수": {"number":    yt_score},
                "레퍼런스점수":{"number":    ref_score},
                "전문분야일치":{"number":    fit_score},
                "교육대상적합":{"number":    target_score},
                "종합점수":    {"number":    total},
                "별점":        {"number":    round(total/10)},
                "판정":        {"select":    {"name": verdict}},
                "유튜브URL":   {"rich_text": [{"text":{"content":yt_text[:2000]}}]},
                "레퍼런스요약":{"rich_text": [{"text":{"content":ref_summary[:2000]}}]},
                "판정근거":    {"rich_text": [{"text":{"content":verdict_reason[:500]}}]},
                **({"예상단가": {"rich_text": [{"text":{"content":fee_range}}]}} if fee_range else {}),
            }}, timeout=10)
        return r.status_code == 200
    except: return False

# ─────────────────────────────────────────────
# 진행 단계 표시
# ─────────────────────────────────────────────
def show_steps(current):
    st.write("")
    c1, c2, c3, c4 = st.columns(4)
    for col, n, label in [
        (c1,1,"① 조건 입력"),
        (c2,2,"② 후보 선택"),
        (c3,3,"③ 적합성 검증"),
        (c4,4,"④ 결과 · 저장"),
    ]:
        if n < current:
            col.success(f"✅ {label}")
        elif n == current:
            col.info(f"▶ {label}")
        else:
            col.write(f"○ {label}")
    st.divider()

# ─────────────────────────────────────────────
# 주제 추천 엔진
# ─────────────────────────────────────────────
def search_topic_trends(company_keywords, audience):
    """Tavily로 최신 트렌드 뉴스 멀티 서칭"""
    queries = [
        "기업 교육 HRD 트렌드 2025 2026",
        "직장인 역량 개발 핫이슈 2025",
    ]
    if company_keywords.strip():
        queries.append(f"{company_keywords} 이슈 트렌드 2025 2026")
        queries.append(f"{company_keywords} 기업 사례 변화")
    if audience and "신입" in audience:
        queries.append("MZ세대 신입사원 교육 트렌드")
    elif audience and ("임원" in audience or "리더" in audience):
        queries.append("경영진 리더십 트렌드 2025")

    results = []
    for q in queries:
        try:
            r = requests.post("https://api.tavily.com/search",
                json={"api_key": TAVILY_KEY, "query": q,
                      "max_results": 4, "search_depth": "advanced"},
                timeout=10)
            if r.status_code == 200:
                for item in r.json().get("results", []):
                    results.append({
                        "title":   item.get("title", ""),
                        "content": item.get("content", "")[:200],
                        "url":     item.get("url", ""),
                    })
        except: continue
    return results

def suggest_topics_with_claude(trend_results, company_keywords, audience):
    """트렌드 데이터 → Claude가 주제 제안"""
    trend_text = "\n".join(
        f"- {r['title']}: {r['content']}" for r in trend_results[:12]
    )
    audience_str = audience if audience else "전사원"
    company_str  = f"회사/업종 키워드: {company_keywords}" if company_keywords.strip() else ""

    prompt = f"""당신은 기업 HRD 담당자입니다. 아래 최신 트렌드 뉴스와 회사 맥락을 바탕으로
교육 주제를 제안해주세요.

교육 대상: {audience_str}
{company_str}

[최신 트렌드 뉴스]
{trend_text}

조건:
- 지금 당장 기업에서 필요한 현실적인 주제
- 트렌드와 연관성이 높은 것
- 구체적이고 강연 제목으로 바로 쓸 수 있는 수준

JSON 배열로만 응답:
[
  {{"topic": "강연 주제", "reason": "이 주제가 지금 필요한 이유 (1~2문장)", "trend_basis": "관련 트렌드 키워드"}}
]
총 7개 제안."""
    try:
        r = claude_client().messages.create(
            model="claude-opus-4-5", max_tokens=1500,
            messages=[{"role": "user", "content": prompt}])
        m = re.search(r'\[.*\]', r.content[0].text, re.DOTALL)
        if m:
            return json.loads(m.group())
    except: pass
    return []


# ─────────────────────────────────────────────
# STEP 1 : 조건 입력
# ─────────────────────────────────────────────
def step1():
    show_steps(1)
    st.subheader("교육 조건을 입력해 주세요")

    # ── 주제 추천 섹션 ────────────────────────
    with st.expander("💡 주제가 떠오르지 않는다면? 트렌드 기반 추천받기", expanded=False):
        st.caption("최신 뉴스와 HRD 트렌드를 분석해 지금 꼭 필요한 강연 주제를 제안합니다.")
        COMPANY = "삼성전기 (Samsung Electro-mechanics)"
        suggest_audience = st.selectbox(
            "교육 대상 (미리 선택)",
            AUDIENCE_OPTIONS[:-1], key="suggest_aud"
        )

        if st.button("🔍 트렌드 분석 후 주제 추천", key="btn_suggest"):
            with st.spinner("최신 뉴스·트렌드 서칭 중... (10~20초 소요)"):
                trends = search_topic_trends(COMPANY, suggest_audience)
            if not trends:
                st.warning("트렌드 검색에 실패했습니다. Tavily 키를 확인하세요.")
            else:
                with st.spinner("Claude가 주제를 분석 중..."):
                    suggestions = suggest_topics_with_claude(
                        trends, COMPANY, suggest_audience)
                if suggestions:
                    st.session_state["topic_suggestions"] = suggestions
                    st.session_state["suggest_audience_val"] = suggest_audience
                else:
                    st.warning("주제 생성에 실패했습니다.")

        suggestions = st.session_state.get("topic_suggestions", [])
        if suggestions:
            st.write("**📋 추천 강연 주제** — 클릭하면 바로 입력됩니다")
            for i, s in enumerate(suggestions):
                col_btn, col_desc = st.columns([3, 7])
                with col_btn:
                    if st.button(f"➕ {s['topic']}", key=f"pick_topic_{i}"):
                        st.session_state["picked_topic"] = s["topic"]
                        st.session_state["picked_audience"] = st.session_state.get(
                            "suggest_audience_val", AUDIENCE_OPTIONS[0])
                        st.rerun()
                with col_desc:
                    st.caption(f"{s.get('reason','')}  |  🔖 {s.get('trend_basis','')}")

    st.write("")
    # 추천 주제가 선택된 경우 자동 반영
    picked = st.session_state.pop("picked_topic", None)
    default_topic = picked if picked else st.session_state.topic

    topic = st.text_input("📌 교육 주제",
        value=default_topic,
        placeholder="예: 리더십, AI 활용, 조직문화 혁신...")

    st.write("")
    st.markdown("**📝 강연 배경 / 맥락** (선택)")
    background = st.text_area(
        label="강연 배경",
        value=st.session_state.background,
        placeholder="예: 올해 조직 개편 이후 팀장급 리더들의 변화 관리 역량 강화가 필요합니다. 특히 MZ세대와의 소통 방식에 어려움을 겪고 있어, 실무 중심의 생생한 사례를 전달할 수 있는 강사를 원합니다.",
        height=100,
        label_visibility="collapsed",
    )

    st.write("")
    st.markdown("**🎤 원하는 강사 유형** (복수 선택 가능)")
    levels_raw = st.multiselect(
        label="강사 유형 선택",
        options=INSTRUCTOR_LEVELS,
        default=[l for l in st.session_state.levels if l in INSTRUCTOR_LEVELS],
        label_visibility="collapsed",
    )
    # 기타 직접 입력
    custom_level = ""
    if "기타 (직접 입력)" in levels_raw:
        custom_level = st.text_input("강사 유형 직접 입력", key="custom_level",
                                     placeholder="예: 유명 셰프, 의사, 법조인, 전직 외교관...")
    levels = [l for l in levels_raw if l != "기타 (직접 입력)"]
    if custom_level.strip():
        levels.append(custom_level.strip())

    st.write("")
    st.markdown("**👥 교육 대상**")
    saved_audience = st.session_state.pop("picked_audience", None) or st.session_state.audience
    audience_idx = AUDIENCE_OPTIONS.index(saved_audience) if saved_audience in AUDIENCE_OPTIONS else 0
    audience_raw = st.selectbox(
        label="교육 대상 선택",
        options=AUDIENCE_OPTIONS,
        index=audience_idx,
        label_visibility="collapsed",
    )
    # 기타 직접 입력
    if audience_raw == "기타 (직접 입력)":
        audience = st.text_input("교육 대상 직접 입력", key="custom_audience",
                                 placeholder="예: 해외주재원, 연구개발 직군, 고객상담사...")
        if not audience.strip():
            audience = "기타"
    else:
        audience = audience_raw

    st.write("")
    if st.button("🔍  강사 후보 서칭 시작", type="primary", use_container_width=True):
        if not topic.strip():
            st.warning("교육 주제를 입력하세요."); return
        if not levels:
            st.warning("강사 유형을 하나 이상 선택하세요."); return
        if not api_ok():
            st.error("API 키가 설정되지 않았습니다. Streamlit Secrets를 확인하세요."); return

        st.session_state.update(topic=topic, background=background,
                                levels=levels, audience=audience,
                                prev_names=[], selected_for_verify=[], verified=[])
        with st.spinner("Claude AI가 강사 후보 10명을 탐색 중..."):
            cands = get_candidates(topic, levels, audience, background=background, count=10)
        if not cands:
            st.error("후보를 찾지 못했습니다. 다시 시도해 주세요."); return
        st.session_state.candidates = cands
        st.session_state.prev_names = [c["name"] for c in cands]
        st.session_state.step = 2
        st.rerun()

# ─────────────────────────────────────────────
# STEP 2 : 후보 선택
# ─────────────────────────────────────────────
def step2():
    show_steps(2)
    topic, levels, audience = (st.session_state.topic,
                               st.session_state.levels,
                               st.session_state.audience)

    st.subheader("강사 후보 목록")
    st.caption(f"주제: **{topic}** | 유형: **{', '.join(levels)}** | 대상: **{audience}**")
    st.info("검증할 강사를 체크하세요. 여러 명 선택 가능합니다.")

    # 체크박스 상태 초기화
    for c in st.session_state.candidates:
        key = f"sel_{c['name']}"
        if key not in st.session_state:
            st.session_state[key] = False

    for c in st.session_state.candidates:
        key  = f"sel_{c['name']}"
        col_chk, col_name, col_info = st.columns([1, 4, 7])
        with col_chk:
            st.checkbox("선택", key=key, label_visibility="collapsed")
        with col_name:
            st.markdown(f"**{c['name']}**  \n`{c.get('level','')}`")
            fee = c.get("fee_range","")
            if fee:
                st.caption(f"💰 {fee}")
        with col_info:
            st.caption(f"{c.get('affiliation','')}  |  {c.get('specialty','')}")
            st.caption(c.get('reason',''))
        st.divider()

    selected = [c["name"] for c in st.session_state.candidates
                if st.session_state.get(f"sel_{c['name']}", False)]
    st.write(f"✔ 선택된 강사: **{len(selected)}명**")

    st.divider()
    st.markdown("**➕ 추가 서칭**")
    extra_direction = st.text_area(
        "추가 서칭 방향 (선택)",
        placeholder="예: 지금 추천된 분들은 이론 중심인 것 같아요. 실무 현장 경험이 풍부한 분 위주로 더 찾아주세요. 또는 IT 기업 출신 임원이 없으니 그쪽으로 보완해주세요.",
        height=80,
        key="extra_direction_input",
        label_visibility="collapsed",
    )

    col1, col2, col3 = st.columns([3, 4, 2])
    with col1:
        if st.button("➕ 추가 서칭 (5명 추가)"):
            with st.spinner("추가 후보 5명 탐색 중..."):
                more = get_candidates(topic, levels, audience,
                                      background=st.session_state.get("background",""),
                                      exclude=st.session_state.prev_names,
                                      count=5,
                                      extra_direction=extra_direction)
            if more:
                st.session_state.candidates += more
                st.session_state.prev_names += [c["name"] for c in more]
                st.rerun()
            else:
                st.warning("추가 후보를 찾지 못했습니다.")
    with col2:
        if st.button("✅  선택 완료 → 적합성 검증 시작", type="primary"):
            if not selected:
                st.warning("최소 1명을 선택하세요."); return
            st.session_state.selected_for_verify = selected
            st.session_state.step = 3
            st.rerun()
    with col3:
        if st.button("↩ 처음으로"):
            st.session_state.step = 1; st.rerun()

# ─────────────────────────────────────────────
# STEP 3 : 적합성 검증 실행
# ─────────────────────────────────────────────
def step3():
    show_steps(3)
    st.subheader("적합성 검증 진행 중...")

    names   = st.session_state.selected_for_verify
    cdict   = {c["name"]: c for c in st.session_state.candidates}
    topic   = st.session_state.topic
    levels  = st.session_state.levels
    audience= st.session_state.audience
    total_n = len(names)
    prog    = st.progress(0)
    status  = st.empty()
    results = []

    for i, name in enumerate(names):
        c = cdict.get(name, {})
        status.info(f"검증 중 ({i+1}/{total_n}): **{name}**")
        ref   = tavily_ref(c.get("keyword", name))
        yts   = youtube_top3(name, topic)
        score = verify(name, c.get("specialty",""), c.get("affiliation",""),
                       topic, levels, audience, ref, yts)
        # 예상단가: 웹 서칭 + Claude 추정
        status.info(f"검증 중 ({i+1}/{total_n}): **{name}** — 강연료 조사 중...")
        fee_web  = tavily_fee(name)
        fee_data = estimate_fee(name, c.get("specialty",""), c.get("affiliation",""),
                                c.get("level",""), ref, fee_web)
        fee_range = fee_data.get("fee_range", c.get("fee_range","추정 불가"))
        fee_basis = fee_data.get("fee_basis","")

        DB.execute("""INSERT INTO verifications
            (topic,levels,audience,name,specialty,affiliation,
             yt_score,ref_score,fit_score,target_score,total_score,verdict,
             yt_urls,ref_summary,verdict_reason,verified_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (topic, json.dumps(levels,ensure_ascii=False), audience,
             name, c.get("specialty",""), c.get("affiliation",""),
             score.get("yt_score",0), score.get("ref_score",0),
             score.get("fit_score",0), score.get("target_score",0),
             score.get("total",0), score.get("verdict",""),
             json.dumps([x["url"] for x in yts],ensure_ascii=False),
             score.get("ref_summary",""), score.get("verdict_reason",""),
             datetime.now().isoformat()))
        DB.commit()
        results.append({**c, **score, "yt_list": yts,
                        "fee_range": fee_range, "fee_basis": fee_basis})
        prog.progress(int((i+1)/total_n*100))

    status.success(f"✅ 검증 완료! {total_n}명 처리")
    st.session_state.verified = results
    st.session_state.step = 4
    st.rerun()

# ─────────────────────────────────────────────
# STEP 4 : 결과 + Notion 선택 저장
# ─────────────────────────────────────────────
def step4():
    show_steps(4)
    verified = st.session_state.verified
    topic    = st.session_state.topic

    passed = [v for v in verified if v.get("total",0) >= 70]
    review = [v for v in verified if 50 <= v.get("total",0) < 70]
    failed = [v for v in verified if v.get("total",0) < 50]

    m1,m2,m3,m4 = st.columns(4)
    m1.metric("전체 검증",   f"{len(verified)}명")
    m2.metric("✅ 적합",     f"{len(passed)}명",  "70점 이상")
    m3.metric("🔶 검토 필요", f"{len(review)}명", "50~69점")
    m4.metric("❌ 부적합",   f"{len(failed)}명",  "49점 이하")

    st.divider()
    st.subheader("검증 결과 상세")

    sorted_v = sorted(verified, key=lambda x: x.get("total",0), reverse=True)

    for v in sorted_v:
        total   = v.get("total", 0)
        verdict = v.get("verdict", "")
        name    = v.get("name", "")

        fee_range = v.get("fee_range","")
        fee_label = f"  |  💰 {fee_range}" if fee_range else ""
        with st.expander(f"{verdict}  {name}  |  {v.get('specialty','')}  |  {total}점{fee_label}",
                         expanded=(total >= 70)):
            c_score, c_info = st.columns([4,6])

            with c_score:
                st.markdown("**점수 상세**")
                for label, s, mx in [
                    ("YouTube 영상",   v.get("yt_score",0),     40),
                    ("레퍼런스",       v.get("ref_score",0),    30),
                    ("전문분야 일치",  v.get("fit_score",0),    20),
                    ("교육대상 적합",  v.get("target_score",0), 10),
                ]:
                    st.write(f"{label}: **{s}/{mx}점**")
                    st.progress(s/mx if mx else 0)
                st.metric("종합 점수", f"{total}점")
                if fee_range:
                    st.divider()
                    st.markdown(f"**💰 예상 강연료**")
                    st.info(fee_range)
                    if v.get("fee_basis"):
                        st.caption(v["fee_basis"])

            with c_info:
                st.markdown("**레퍼런스 요약**")
                st.write(v.get("ref_summary","-"))
                st.markdown("**판정 근거**")
                st.write(v.get("verdict_reason","-"))

                st.markdown("**🎬 유튜브 강연 영상**")
                yts = v.get("yt_list", [])
                if yts:
                    for yt in yts:
                        st.markdown(f"- [{yt['title']}]({yt['url']})  `{yt['channel']}`")
                else:
                    st.caption("검색된 영상 없음")

    # ── Notion 선택 저장 ──────────────────────
    if use_notion and notion_token:
        st.divider()
        st.subheader("📦 Notion 저장")
        st.write("Notion에 저장할 강사를 선택하세요.")

        notion_candidates = [v for v in sorted_v if v.get("total",0) >= 50]
        if not notion_candidates:
            st.info("저장 가능한 강사(50점 이상)가 없습니다.")
        else:
            for v in notion_candidates:
                key = f"notion_chk_{v['name']}"
                if key not in st.session_state:
                    st.session_state[key] = v.get("total",0) >= 70
                st.checkbox(
                    f"{v.get('verdict','')} **{v['name']}** ({v.get('total',0)}점)",
                    key=key
                )

            if st.button("✅ 선택한 강사 Notion에 저장", type="primary"):
                saved, failed_n = [], []
                for v in notion_candidates:
                    if st.session_state.get(f"notion_chk_{v['name']}", False):
                        ok = notion_save(
                            v["name"], v.get("specialty",""), v.get("affiliation",""),
                            v.get("level",""), topic, st.session_state.audience,
                            v.get("yt_score",0), v.get("ref_score",0),
                            v.get("fit_score",0), v.get("target_score",0),
                            v.get("total",0), v.get("verdict",""),
                            v.get("ref_summary",""), v.get("verdict_reason",""),
                            v.get("yt_list",[]), v.get("fee_range","")
                        )
                        if ok:
                            saved.append(v["name"])
                            DB.execute("UPDATE verifications SET notion_saved=1 WHERE name=? AND topic=?",
                                       (v["name"], topic))
                        else:
                            failed_n.append(v["name"])
                DB.commit()
                if saved:
                    st.success(f"저장 완료: {', '.join(saved)}")
                if failed_n:
                    st.error(f"저장 실패: {', '.join(failed_n)} — Notion 토큰/DB ID 확인")

    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        if st.button("↩ 후보 다시 선택"):
            st.session_state.step = 2; st.rerun()
    with col2:
        if st.button("🔄 처음부터", type="primary"):
            for k in list(st.session_state.keys()):
                del st.session_state[k]
            st.rerun()

# ─────────────────────────────────────────────
# 스케줄 자동화 탭
# ─────────────────────────────────────────────
def tab_schedule():
    st.subheader("⏰ 스케줄 자동화")
    st.info("""
자동화 설정을 저장하면 **auto_run.py** 가 조건을 읽어 전체 프로세스를 자동 실행합니다.
- 사람이 없어도 자동으로 후보 탐색 → 전원 검증 → 기준점 이상 자동 Notion 저장
- Windows 작업 스케줄러에 등록하면 원하는 시간에 자동 실행됩니다.
    """)

    st.markdown("**자동화 조건 설정**")
    a_topic    = st.text_input("교육 주제", key="a_topic")
    a_levels   = st.multiselect("강사 유형", INSTRUCTOR_LEVELS, key="a_levels")
    a_audience = st.selectbox("교육 대상",   AUDIENCE_OPTIONS,  key="a_audience")
    a_count    = st.slider("추천 강사 수", 5, 10, 7, key="a_count")
    a_thresh   = st.slider("자동 Notion 저장 기준 점수", 50, 90, 70, key="a_thresh",
                           help="이 점수 이상인 강사만 자동으로 Notion에 저장됩니다")

    st.markdown("**실행 주기**")
    a_freq = st.radio("주기", ["매일", "매주 월요일", "매월 1일"], horizontal=True, key="a_freq")
    a_hour = st.slider("실행 시각 (시)", 0, 23, 9, key="a_hour")

    if st.button("💾 설정 저장 (schedule_config.json)", type="primary"):
        cfg = {
            "topic": a_topic, "levels": a_levels, "audience": a_audience,
            "count": a_count, "threshold": a_thresh,
            "frequency": a_freq, "run_hour": a_hour,
            "ANTHROPIC_API_KEY": claude_key,
            "TAVILY_API_KEY":    tavily_key,
            "YOUTUBE_API_KEY":   youtube_key,
            "NOTION_TOKEN":  notion_token if use_notion else "",
            "NOTION_DB_ID":  notion_db_id if use_notion else "",
        }
        with open("schedule_config.json", "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        st.success("✅ schedule_config.json 저장 완료!")

    if os.path.exists("schedule_config.json"):
        st.divider()
        st.markdown("**자동 실행 방법**")
        st.code("""# 1) 수동 테스트 실행
python auto_run.py

# 2) Windows 작업 스케줄러 등록
#    시작 메뉴 → "작업 스케줄러" → 기본 작업 만들기
#    트리거: 설정한 주기·시각
#    동작 프로그램: python
#    인수: C:\\경로\\강사추천앱\\auto_run.py""", language="bash")

# ─────────────────────────────────────────────
# Notion 기존 항목 단가 업데이트
# ─────────────────────────────────────────────
def tab_notion_update():
    st.subheader("💰 Notion 기존 강사 단가 업데이트")
    st.info("Notion DB에 저장된 강사들 중 예상단가가 없는 항목을 조회하고, 웹 서칭으로 단가를 채워 넣습니다.")

    if not (use_notion and notion_token):
        st.warning("Notion 연동이 설정되지 않았습니다. Streamlit Secrets에 NOTION_TOKEN을 확인하세요.")
        return

    if st.button("📋 단가 미입력 항목 조회", type="primary"):
        with st.spinner("Notion에서 항목 불러오는 중..."):
            try:
                resp = requests.post(
                    f"https://api.notion.com/v1/databases/{notion_db_id}/query",
                    headers={"Authorization": f"Bearer {notion_token}",
                             "Content-Type": "application/json",
                             "Notion-Version": "2022-06-28"},
                    json={"filter": {"property": "예상단가",
                                     "rich_text": {"is_empty": True}},
                          "page_size": 50},
                    timeout=15
                )
                if resp.status_code == 200:
                    pages = resp.json().get("results", [])
                    st.session_state["notion_no_fee"] = pages
                    st.success(f"단가 미입력 항목: **{len(pages)}건**")
                else:
                    st.error(f"조회 실패: {resp.status_code} — {resp.text[:200]}")
            except Exception as e:
                st.error(f"오류: {e}")

    pages = st.session_state.get("notion_no_fee", [])
    if not pages:
        return

    # 항목 목록 표시
    names_in_notion = []
    for p in pages:
        props = p.get("properties", {})
        name = ""
        try: name = props["강사명"]["title"][0]["text"]["content"]
        except: pass
        specialty = ""
        try: specialty = props["전문분야"]["rich_text"][0]["text"]["content"]
        except: pass
        affiliation = ""
        try: affiliation = props["소속직함"]["rich_text"][0]["text"]["content"]
        except: pass
        level = ""
        try: level = props["강사유형"]["select"]["name"]
        except: pass
        names_in_notion.append({"page_id": p["id"], "name": name,
                                 "specialty": specialty, "affiliation": affiliation,
                                 "level": level})
        if name:
            st.caption(f"· {name} ({specialty})")

    st.write("")
    if st.button(f"🔄 {len(pages)}건 단가 일괄 업데이트 시작", type="primary"):
        prog = st.progress(0)
        status = st.empty()
        success_count = 0
        for i, item in enumerate(names_in_notion):
            name = item["name"]
            if not name:
                continue
            status.info(f"({i+1}/{len(names_in_notion)}) {name} 단가 조사 중...")
            ref_info = tavily_ref(name)
            fee_web  = tavily_fee(name)
            fee_data = estimate_fee(name, item["specialty"], item["affiliation"],
                                    item["level"], ref_info, fee_web)
            fee_range = fee_data.get("fee_range", "")
            if fee_range and fee_range != "추정 불가":
                try:
                    r = requests.patch(
                        f"https://api.notion.com/v1/pages/{item['page_id']}",
                        headers={"Authorization": f"Bearer {notion_token}",
                                 "Content-Type": "application/json",
                                 "Notion-Version": "2022-06-28"},
                        json={"properties": {
                            "예상단가": {"rich_text": [{"text": {"content": fee_range}}]}
                        }},
                        timeout=10
                    )
                    if r.status_code == 200:
                        success_count += 1
                except: pass
            prog.progress(int((i+1)/len(names_in_notion)*100))

        status.success(f"✅ 완료! {success_count}/{len(names_in_notion)}건 업데이트")
        st.session_state.pop("notion_no_fee", None)


# ─────────────────────────────────────────────
# 이력 탭
# ─────────────────────────────────────────────
def tab_history():
    st.subheader("📋 검증 이력")
    rows = DB.execute("""
        SELECT topic, name, specialty, total_score, verdict,
               yt_urls, ref_summary, verified_at, notion_saved
        FROM verifications ORDER BY verified_at DESC LIMIT 100
    """).fetchall()

    if not rows:
        st.info("아직 검증 이력이 없습니다."); return

    topics = ["전체"] + list(dict.fromkeys(r[0] for r in rows))
    filter_topic   = st.selectbox("주제 필터", topics)
    filter_verdict = st.multiselect("판정 필터",
        ["✅ 적합","🔶 검토 필요","❌ 부적합"], default=["✅ 적합","🔶 검토 필요"])

    filtered = [r for r in rows
                if (filter_topic=="전체" or r[0]==filter_topic)
                and (not filter_verdict or r[4] in filter_verdict)]

    for topic,name,spec,score,verdict,yt_j,ref_sum,at,nsaved in filtered:
        badge = " 📦" if nsaved else ""
        with st.expander(f"{verdict}{badge} **{name}** | {topic} | {score}점 | {(at or '')[:10]}"):
            st.caption(f"전문분야: {spec}")
            if ref_sum: st.write(ref_sum)
            try:
                for url in json.loads(yt_j or "[]"):
                    st.markdown(f"🎬 {url}")
            except: pass

# ─────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────
st.title("🎯 강사 추천 자동화")
st.caption("Claude AI · Tavily · YouTube 기반 강사 발굴 및 적합성 검증 시스템")

t_main, t_schedule, t_history, t_update = st.tabs(
    ["🔍 강사 추천", "⏰ 스케줄 자동화", "📋 검증 이력", "💰 단가 업데이트"])

with t_main:
    if   st.session_state.step == 1: step1()
    elif st.session_state.step == 2: step2()
    elif st.session_state.step == 3: step3()
    elif st.session_state.step == 4: step4()

with t_schedule:
    tab_schedule()

with t_history:
    tab_history()

with t_update:
    tab_notion_update()
