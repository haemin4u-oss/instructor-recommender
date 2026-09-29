#!/usr/bin/env python3
"""CSS/JS 를 인라인한 단일 HTML 파일을 만듭니다.

    python3 tools/build_single.py            # dist/ 에 단독 실행 파일 2개 생성 (메일·메신저 배포용)
    python3 tools/build_single.py --embed    # 임베드 뷰어용 (다운로드/인쇄 대체 UI 사용)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def inline(html: str, embed: bool) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        code = (ROOT / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        return "<script>\n" + code + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="(assets/css/[^"]+)">', css, html)
    html = re.sub(r'<script src="(assets/js/[^"]+)"></script>', js, html)
    if embed:
        html = html.replace("<script>\n", "<script>window.FDL_EMBED = true;</script>\n<script>\n", 1)
        html = html.replace('href="index.html"', 'href="./"')
    return html


def main():
    embed = "--embed" in sys.argv
    out = ROOT / "dist" / ("embed" if embed else "")
    out.mkdir(parents=True, exist_ok=True)
    names = {"index.html": "index.html", "admin.html": "admin.html"}
    for src, dst in names.items():
        html = inline((ROOT / src).read_text(encoding="utf-8"), embed)
        (out / dst).write_text(html, encoding="utf-8")
        print("wrote", out / dst, f"{len(html) // 1024} KB")


if __name__ == "__main__":
    main()
