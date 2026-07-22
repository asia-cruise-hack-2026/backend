#!/usr/bin/env bash
# Scrape tamnao 특산/기념품 (SV) list ajax -> raw html chunks per category+page
set -u
cd "$(dirname "$0")"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36"
URL="https://www.tamnao.com/web/sv/productList.ajax"
REF="https://www.tamnao.com/web/goods/jeju.do"
OUTD=goods_raw
rm -rf "$OUTD"; mkdir -p "$OUTD"

fetch () {  # $1=ctgr(subctgr encoded) $2=page $3=tag
  local q="$1" p="$2" tag="$3"
  curl -s --max-time 30 -X POST "$URL" -H "User-Agent: $UA" -H "X-Requested-With: XMLHttpRequest" \
    -H "Referer: $REF" --data "totSch=SV&orderCd=GPA&pageIndex=$p&$q" -o "$OUTD/${tag}_${p}.html"
}
export -f fetch; export UA URL REF OUTD

# category list: code|subcode|label(for tagging only)
CATS=(
"S100|S110" "S100|S120" "S100|S130"
"S400|S420" "S400|S430" "S400|S440" "S400|S460" "S400|S470" "S400|S480" "S400|S490"
"S500|" "S600|" "S600|S630"
)
for c in "${CATS[@]}"; do
  main="${c%%|*}"; sub="${c##*|}"
  if [ -n "$sub" ]; then q="sCtgr=$main&sSubCtgr=$sub"; tag="${main}-${sub}"; else q="sCtgr=$main"; tag="$main"; fi
  # first page to learn totalPageCnt
  fetch "$q" 1 "$tag"
  tp=$(grep -o -a -E 'totalPageCnt="[0-9]+"' "$OUTD/${tag}_1.html" | head -1 | grep -o -E '[0-9]+')
  tc=$(grep -o -a -E 'totalCnt="[0-9]+"' "$OUTD/${tag}_1.html" | head -1 | grep -o -E '[0-9]+')
  tp=${tp:-1}
  echo "$tag: totalCnt=$tc pages=$tp" >&2
  if [ "$tp" -gt 1 ]; then
    seq 2 "$tp" | xargs -P 8 -I{} bash -c 'fetch "$1" "$2" "$3"' _ "$q" {} "$tag"
  fi
done
echo "files=$(ls "$OUTD" | wc -l)" >&2
