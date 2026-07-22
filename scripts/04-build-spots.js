const fs=require('fs'), path=require('path');
const SRC=path.join(__dirname,'.work');
const OUT=path.join(__dirname,'..','data');
fs.mkdirSync(OUT,{recursive:true});

const clean=s=>(s||'').replace(/\s+/g,' ').trim();

// ---- 1) visitjeju (i18n) ----
const vj=JSON.parse(fs.readFileSync(path.join(SRC,'visitjeju_spots_i18n.json'),'utf8'));

// ---- 2) tamnao spots + thumbnails ----
const thumbs=new Map();
for(const line of fs.readFileSync(path.join(SRC,'tamnao_thumbs.tsv'),'utf8').split(/\r?\n/)){
  const [num,img]=line.split('\t'); if(num&&img) thumbs.set(num,img);
}
const tnRows=fs.readFileSync(path.join(SRC,'enriched.tsv'),'utf8').split(/\r?\n/).filter(Boolean).map(l=>l.split('\t'));
// enriched.tsv: num div cat lat lng jkm gkm name poi addr_short addr_full url

// 카테고리 정규화 (지도 필터 칩용)
const CAT=[
 [/해변|해수욕|바다|해안|포구|항\b/, 'beach',   {ko:'해변·바다',en:'Beach',ja:'ビーチ',zh:'海滩'}],
 [/오름|산\b|봉\b|숲|곶자왈|폭포|계곡|동굴|자연|생태|공원|정원|수목/, 'nature', {ko:'자연·경관',en:'Nature',ja:'自然',zh:'自然景观'}],
 [/박물관|미술관|전시|기념관|문화|역사|유적|사찰|성당|교회|마을/, 'culture', {ko:'문화·역사',en:'Culture',ja:'文化',zh:'文化历史'}],
 [/체험|승마|카트|요트|다이빙|서핑|낚시|공방|클래스|만들기|테마파크|랜드|월드/, 'activity',{ko:'체험·액티비티',en:'Activity',ja:'体験',zh:'体验活动'}],
 [/카페|커피|맛집|식당|음식|레스토랑|시장|먹거리|횟집|고기/, 'food',   {ko:'맛집·카페',en:'Food',ja:'グルメ',zh:'美食'}],
 [/온천|스파|족욕|마사지|힐링|찜질/, 'wellness',{ko:'웰니스',en:'Wellness',ja:'ウェルネス',zh:'康养'}],
];
const catOf=(txt)=>{ for(const [re,key,lab] of CAT) if(re.test(txt)) return {key,lab};
  return {key:'attraction',lab:{ko:'관광지',en:'Attraction',ja:'観光地',zh:'景点'}}; };

const LANGS=['ko','en','ja','zh'];
const rows=[];

// 카테고리는 언어와 무관해야 하므로 한국어 원문 기준으로 1회만 판정
const catById=new Map();
for(const r of vj) if(r.lang==='ko') catById.set(r.id, catOf(r.name+' '+r.category+' '+r.tags));

// visitjeju -> unified
for(const r of vj){
  const c=catById.get(r.id) || catOf(r.name+' '+r.category+' '+r.tags);
  rows.push({
    id:r.id, lang:r.lang, source:'visitjeju',
    name:r.name, description:r.description,
    category:c.key, category_label:c.lab[r.lang]||c.lab.ko,
    lat:r.lat, lng:r.lng, address:r.address, phone:r.phone,
    thumbnail:r.thumbnail, image:r.image, tags:r.tags,
    dist_jeju_km:r.dist_jeju_km, dist_gangjeong_km:r.dist_gangjeong_km, nearest_port:r.nearest_port,
    bookable:0, price:null,
    stay_minutes:60,
    lang_fallback:r.lang_fallback,
    detail_url:r.detail_url
  });
}
// tamnao -> unified (한국어 원문만 존재 -> 4개 언어 모두 ko 텍스트로 폴백)
for(const t of tnRows){
  const [num,div,cat,lat,lng,jkm,gkm,name,poi,ashort,afull,url]=t;
  if(!name) continue;
  const c=catOf(name+' '+(cat==='C300'?'맛집':''));
  for(const lang of LANGS){
    rows.push({
      id:'tn_'+num, lang, source:'tamnao',
      name:clean(name), description:'',
      category:c.key, category_label:c.lab[lang]||c.lab.ko,
      lat:lat?+lat:null, lng:lng?+lng:null,
      address:clean(ashort), phone:'',
      thumbnail:thumbs.get(num)||'', image:thumbs.get(num)||'', tags:'',
      dist_jeju_km:jkm?+jkm:null, dist_gangjeong_km:gkm?+gkm:null,
      nearest_port:(jkm&&gkm)?(+jkm<=+gkm?'제주항':'강정항'):'',
      bookable:1, price:null,
      stay_minutes:90,
      lang_fallback:lang==='ko'?0:1,
      detail_url:url
    });
  }
}

fs.writeFileSync(path.join(OUT,'spots.json'), JSON.stringify(rows,null,1));
const cols=['id','lang','source','name','description','category','category_label','lat','lng','address','phone','thumbnail','image','tags','dist_jeju_km','dist_gangjeong_km','nearest_port','bookable','price','stay_minutes','lang_fallback','detail_url'];
const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
fs.writeFileSync(path.join(OUT,'spots.csv'),
  '﻿'+cols.join(',')+'\n'+rows.map(r=>cols.map(c=>q(r[c])).join(',')).join('\n')+'\n');

const ko=rows.filter(r=>r.lang==='ko');
const byCat=ko.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{});
console.log('총 행(id×lang) = %d', rows.length);
console.log('고유 스팟 = %d  (visitjeju %d + tamnao %d)',
  ko.length, ko.filter(r=>r.source==='visitjeju').length, ko.filter(r=>r.source==='tamnao').length);
console.log('좌표 보유 = %d, 썸네일 보유 = %d', ko.filter(r=>r.lat!=null).length, ko.filter(r=>r.thumbnail).length);
console.log('카테고리:', byCat);
const geo=ko.filter(r=>r.lat!=null);
const band=k=>geo.filter(r=>Math.min(r.dist_jeju_km,r.dist_gangjeong_km)<=k).length;
console.log('최근접항 반경 ≤10km %d · ≤20km %d · ≤30km %d', band(10), band(20), band(30));
console.log('OUT ->', OUT);
