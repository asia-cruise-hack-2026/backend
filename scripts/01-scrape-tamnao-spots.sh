#!/usr/bin/env bash
# Scrape tamnao detail pages -> TSV: prdtNum \t prdtDiv \t cat \t lat \t lng \t name \t address \t price
set -u
BASE="https://www.tamnao.com/web/sp/detailPrdt.do"

fetch_one () {
  local pair="$1" cat="$2"
  local prdt="${pair%%&*}"          # prdtNum=SPxxxx
  local div="${pair##*=}"           # COUP / TOUR
  local num="${prdt#prdtNum=}"
  local html
  html=$(curl -s --max-time 25 "$BASE?$pair")
  # name
  local name
  name=$(printf '%s' "$html" | grep -o -a -E '<meta property="og:title" content="[^"]*"' | head -1 | sed -E 's/.*content="//; s/"$//; s/&amp;/\&/g')
  [ -z "$name" ] && name=$(printf '%s' "$html" | grep -o -a -E '<title>[^<]*</title>' | head -1 | sed -E 's/<[^>]*>//g; s/ - 제주도 공공플랫폼 탐나오//; s/&amp;/\&/g')
  # coords
  local ll lat lng
  ll=$(printf '%s' "$html" | grep -o -a -E 'LatLng\([0-9.]+, ?[0-9.]+\)' | head -1)
  lat=$(printf '%s' "$ll" | sed -E 's/LatLng\(([0-9.]+), ?([0-9.]+)\)/\1/')
  lng=$(printf '%s' "$ll" | sed -E 's/LatLng\(([0-9.]+), ?([0-9.]+)\)/\2/')
  # address: prefer 업체주소 / 주소 label; drop footer(관광협회) addr
  local addr
  addr=$(printf '%s' "$html" | grep -o -a -E '(업체주소|주소)[  ]*:?[  ]*제주[가-힣A-Za-z0-9 ,()·.-]{4,60}' | head -1 | sed -E 's/^(업체주소|주소)[  ]*:?[  ]*//')
  if [ -z "$addr" ]; then
    addr=$(printf '%s' "$html" | grep -o -a -E '제주특별자치도[가-힣A-Za-z0-9 ,()·.-]{4,55}' | grep -v '첨단로 213-65' | grep -v '제주종합비즈니스센터' | grep -v '관광협회' | head -1)
  fi
  addr=$(printf '%s' "$addr" | sed -E 's/[[:space:]]+/ /g; s/ +$//')
  # price (min '숫자원')
  local price
  price=$(printf '%s' "$html" | grep -o -a -E '[0-9]{1,3}(,[0-9]{3})+원' | head -1)
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$num" "$div" "$cat" "$lat" "$lng" "$name" "$addr" "$price"
}
export -f fetch_one
export BASE

cd "$(dirname "$0")"
: > results.tsv
run_cat () {
  local file="$1" cat="$2"
  cat "$file" | xargs -P 8 -I{} bash -c 'fetch_one "$1" "$2"' _ {} "$cat"
}
run_cat ids_C200.txt C200 >> results.tsv
run_cat ids_C300.txt C300 >> results.tsv
echo "DONE rows=$(wc -l < results.tsv)"
