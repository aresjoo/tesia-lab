#!/bin/sh
# 전체 빌드: CSS 합치기 → 블록 적용(두 번) → 중복 제거 → 합니다체 → 회귀 확인
set -e
cd "$(dirname "$0")"
cat bt.v0.css bt2.css bt3.css bt4.css bt5.css bt6.css pl.css px.css sk-settings.css sk-copy.css sk-main.css > bt.css
node apply2.cjs >/dev/null; node apply2.cjs
node dedupe.cjs >/dev/null
node hapnida.cjs
node hapnida.cjs
node rename.cjs
node usd.cjs
[ "$1" = "fast" ] || node regress.mjs 2>&1 | tail -6
