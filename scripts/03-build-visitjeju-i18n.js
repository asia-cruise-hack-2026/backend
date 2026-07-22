const fs=require('fs'), path=require('path');
const SRC=path.join(__dirname,'.work');
const OUT=path.join(__dirname,'.work');   // 중간 산출물
fs.mkdirSync(OUT,{recursive:true});

// visitjeju locale -> app lang (설계: ko/en/ja/zh)
const LOC={kr:'ko', en:'en', jp:'ja', cn:'zh'};

const JLAT=33.5230,JLNG=126.5370, GLAT=33.2246,GLNG=126.4790;
const hav=(a,b,c,d)=>{const R=6371,p=Math.PI/180,dl=(c-a)*p,dn=(d-b)*p;
  const x=Math.sin(dl/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dn/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const r1=n=>n==null?null:Math.round(n*10)/10;
const clean=s=>(s||'').replace(/\s+/g,' ').trim();

// gather per locale
const byLang={};            // lang -> Map(id -> item)
const geo=new Map();        // id -> {lat,lng,...} (language independent)
for(const [loc,lang] of Object.entries(LOC)){
  const m=new Map();
  for(const p of [1,2,3]){
    const f=path.join(SRC,`vjl_${loc}_${p}.json`);
    if(!fs.existsSync(f)) continue;
    for(const it of (JSON.parse(fs.readFileSync(f,'utf8')).items||[])){
      const id=it.contentsid; if(!id||m.has(id)) continue;
      m.set(id,it);
      if(!geo.has(id)){
        const lat=typeof it.latitude==='number'?it.latitude:null;
        const lng=typeof it.longitude==='number'?it.longitude:null;
        let dj=null,dg=null,np='';
        if(lat&&lng&&lat>32&&lat<34&&lng>125&&lng<128){
          dj=r1(hav(lat,lng,JLAT,JLNG)); dg=r1(hav(lat,lng,GLAT,GLNG));
          np=dj<=dg?'제주항':'강정항';
        }
        const ph=it.repPhoto&&it.repPhoto.photoid||{};
        geo.set(id,{lat,lng,dj,dg,np,
          thumbnail:ph.thumbnailpath||'', image:ph.imgpath||''});
      }
    }
  }
  byLang[lang]=m;
}

const allIds=[...new Set(Object.values(byLang).flatMap(m=>[...m.keys()]))];
const rows=[];
for(const id of allIds){
  const g=geo.get(id)||{};
  for(const lang of ['ko','en','ja','zh']){
    const it=byLang[lang].get(id);
    const fb=!it;                                   // 해당 언어 없음 -> ko 폴백
    const src=it||byLang['ko'].get(id); if(!src) continue;
    const lbl=o=>o&&o.label?o.label:'';
    rows.push({
      id:'vj_'+id, contentsid:id, lang, source:'visitjeju',
      name:clean(src.title),
      description:clean(src.introduction),
      category:lbl(src.contentscd),
      region1:lbl(src.region1cd), region2:lbl(src.region2cd),
      address:clean(src.roadaddress)||clean(src.address),
      lat:g.lat, lng:g.lng,
      thumbnail:g.thumbnail, image:g.image,
      phone:(src.phoneno&&src.phoneno!=='*')?src.phoneno:'',
      tags:clean(src.tag),
      dist_jeju_km:g.dj, dist_gangjeong_km:g.dg, nearest_port:g.np,
      lang_fallback:fb?1:0,
      detail_url:`https://visitjeju.net/${lang==='ko'?'kr':lang==='ja'?'jp':lang==='zh'?'cn':'en'}/detail/view?contentsid=${id}`
    });
  }
}

fs.writeFileSync(path.join(OUT,'visitjeju_spots_i18n.json'), JSON.stringify(rows,null,1));
const cols=['id','contentsid','lang','source','name','description','category','region1','region2','address','lat','lng','thumbnail','image','phone','tags','dist_jeju_km','dist_gangjeong_km','nearest_port','lang_fallback','detail_url'];
const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
fs.writeFileSync(path.join(OUT,'visitjeju_spots_i18n.csv'),
  '﻿'+cols.join(',')+'\n'+rows.map(r=>cols.map(c=>q(r[c])).join(',')).join('\n')+'\n');

const per=l=>rows.filter(r=>r.lang===l);
console.log('unique spots = %d,  rows(id×lang) = %d', allIds.length, rows.length);
for(const l of ['ko','en','ja','zh'])
  console.log('  %s: %d rows (폴백 %d)', l, per(l).length, per(l).filter(r=>r.lang_fallback).length);
console.log('썸네일 보유: %d / %d', rows.filter(r=>r.thumbnail).length/4|0, allIds.length);
console.log('좌표 보유: %d / %d', rows.filter(r=>r.lang==='ko'&&r.lat!=null).length, allIds.length);
console.log('OUT ->', OUT);
