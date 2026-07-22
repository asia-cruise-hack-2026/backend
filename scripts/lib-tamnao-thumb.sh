#!/usr/bin/env bash
pair="$1"
num=$(printf '%s' "$pair" | grep -o -E 'SP[0-9]{8}')
html=$(curl -s --max-time 25 "https://www.tamnao.com/web/sp/detailPrdt.do?$pair")
img=$(printf '%s' "$html" | grep -o -a -E '<meta property="og:image" content="[^"]*"' | head -1 | sed -E 's/.*content="//; s/"$//')
printf '%s\t%s\n' "$num" "$img"
