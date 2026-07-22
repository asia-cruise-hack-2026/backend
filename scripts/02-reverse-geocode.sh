#!/usr/bin/env bash
# Reverse-geocode coords via Nominatim + compute distance to Jeju/Gangjeong ports.
# Output enriched.tsv: num div cat lat lng jejuKm gangKm name poi addr_short addr_full url
set -u
cd "$(dirname "$0")"
UA="${NOMINATIM_UA:-tamrapass-hackathon/1.0 (contact: set NOMINATIM_UA env)}"
JLAT=33.5230; JLNG=126.5370      # 제주항(제주국제여객/크루즈)
GLAT=33.2246; GLNG=126.4790      # 강정항(서귀포크루즈터미널)

hav () { # lat1 lng1 lat2 lng2 -> km
  awk -v a=$1 -v b=$2 -v c=$3 -v d=$4 'BEGIN{
    r=6371; p=atan2(0,-1)/180;
    dl=(c-a)*p; dn=(d-b)*p;
    x=sin(dl/2)^2+cos(a*p)*cos(c*p)*sin(dn/2)^2;
    printf "%.1f", r*2*atan2(sqrt(x),sqrt(1-x)) }'
}
getk () { # json key -> first string value
  printf '%s' "$1" | grep -o -a -E "\"$2\":\"[^\"]*\"" | head -1 | sed -E "s/\"$2\":\"//; s/\"$//"
}

: > enriched.tsv
n=0
while IFS=$'\t' read -r num div cat lat lng name addr price; do
  n=$((n+1))
  poi=""; ashort=""; afull=""
  if [ -n "$lat" ] && [ -n "$lng" ]; then
    jk=$(hav "$lat" "$lng" "$JLAT" "$JLNG")
    gk=$(hav "$lat" "$lng" "$GLAT" "$GLNG")
    j=$(curl -s --max-time 20 -H "User-Agent: $UA" \
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ko&zoom=18&lat=$lat&lon=$lng")
    afull=$(getk "$j" display_name | sed -E 's/, ?대한민국$//; s/, ?[0-9]{5}//')
    l1=$(getk "$j" city); [ -z "$l1" ] && l1=$(getk "$j" county)
    l2=$(getk "$j" town); [ -z "$l2" ] && l2=$(getk "$j" city_district); [ -z "$l2" ] && l2=$(getk "$j" borough)
    l3=$(getk "$j" suburb); [ -z "$l3" ] && l3=$(getk "$j" village); [ -z "$l3" ] && l3=$(getk "$j" neighbourhood); [ -z "$l3" ] && l3=$(getk "$j" quarter)
    road=$(getk "$j" road)
    for tk in tourism leisure attraction amenity shop building; do v=$(getk "$j" "$tk"); [ -n "$v" ] && { poi="$v"; break; }; done
    ashort=$(printf '%s %s %s %s' "$l1" "$l2" "$l3" "$road" | sed -E 's/  +/ /g; s/^ +//; s/ +$//')
    sleep 1.1
  else
    jk=""; gk=""
  fi
  url="https://www.tamnao.com/web/sp/detailPrdt.do?prdtNum=$num&prdtDiv=$div"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$num" "$div" "$cat" "$lat" "$lng" "$jk" "$gk" "$name" "$poi" "$ashort" "$afull" "$url" >> enriched.tsv
  [ $((n%40)) -eq 0 ] && echo "...$n/270" >&2
done < results.tsv
echo "DONE rows=$(wc -l < enriched.tsv)" >&2
