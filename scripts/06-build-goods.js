const fs=require('fs'), path=require('path');
const SRC=path.join(__dirname,'.work','goods_raw');
const OUT=path.join(__dirname,'..','data');
fs.mkdirSync(OUT,{recursive:true});

// tamnao category code -> korean label + app shop category (설계: food/cosmetics/alcohol/souvenir)
const CAT={
 'S100-S110':{ko:'농산품',        app:'food'},
 'S100-S120':{ko:'수산품',        app:'food'},
 'S100-S130':{ko:'축산품',        app:'food'},
 'S400-S420':{ko:'꿀/잼',         app:'food'},
 'S400-S430':{ko:'간식/유제품',    app:'food'},
 'S400-S440':{ko:'커피/차/음료',   app:'food'},
 'S400-S460':{ko:'건강식품',       app:'food'},
 'S400-S470':{ko:'오메기떡/기정떡', app:'food'},
 'S400-S480':{ko:'반찬/젓갈/간편식',app:'food'},
 'S400-S490':{ko:'양념/가루/오일',  app:'food'},
 'S500'     :{ko:'화장품/미용',    app:'cosmetics'},
 'S600'     :{ko:'제주 기념품/공예품',app:'souvenir'},
 'S600-S630':{ko:'반려동물용품',   app:'souvenir'},
};

const dec=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
              .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
              .replace(/　/g,' ').replace(/\s+/g,' ').trim();

const rows=new Map();
for(const f of fs.readdirSync(SRC)){
  const tag=f.replace(/_\d+\.html$/,'');
  const cat=CAT[tag]; if(!cat) continue;
  const html=fs.readFileSync(path.join(SRC,f),'utf8');
  // split per <li class="list-item">
  for(const blk of html.split(/<li class="list-item"/).slice(1)){
    const id=(blk.match(/prdtNum=(SV\d{8})/)||[])[1]; if(!id) continue;
    const img=(blk.match(/<img src="([^"]+)"/)||[])[1]||'';
    const name=dec((blk.match(/class="bxTitle">([^<]*)</)||[])[1]||'');
    const desc=dec((blk.match(/class="bxEvent">([^<]*)</)||[])[1]||'');
    const priceS=(blk.match(/class="text__price">([\d,]+)</)||[])[1]||'';
    const price=priceS?parseInt(priceS.replace(/,/g,''),10):null;
    if(!name) continue;
    if(rows.has(id)) continue;
    rows.set(id,{
      prdtNum:id, name, desc, price,
      tamnao_category:cat.ko, shop_category:cat.app,
      thumbnail: img.startsWith('http')?img:('https://www.tamnao.com'+img),
      url:'https://www.tamnao.com/web/sv/detailPrdt.do?prdtNum='+id
    });
  }
}
let list=[...rows.values()];

// ---- 반입규정(customs/cruise-line) 룰 엔진 ----
// 설계의 4단계: allowed / conditional / restricted / prohibited
const RULE={
 prohibited :['prohibited','육류·축산물 — 대부분 국가에서 반입이 금지돼요.','선내 육류 반입이 불가합니다.'],
 alcohol    :['conditional','주류 — 면세 한도 내에서만 반입할 수 있어요.','미개봉 상태로 승선 시 승무원이 보관합니다.'],
 seafood    :['restricted','신선 수산물 — 다수 국가에서 검역 대상이에요.','선내 냉장 보관이 제한됩니다.'],
 produce    :['restricted','생과일·채소 — 다수 국가에서 검역·반입이 제한돼요.','당일 선내 취식용만 허용됩니다.'],
 perishable :['restricted','신선 식품 — 당일 소비용이라 반입에 적합하지 않아요.','선내 냉장 보관이 제한됩니다.'],
 cosmetics  :['allowed','화장품 — 자가 사용 한도 내에서 반입 가능해요.','액체류는 객실 반입 한도 내에서 가능합니다.'],
 souvenir   :['allowed','비식품 잡화 — 반입 제한이 없어요.','선사 반입 제한이 없습니다.'],
 packaged   :['allowed','포장·가공 식품 — 반입 제한이 없어요.','선사 반입 제한이 없습니다.'],
};
// 가공/보존 처리된 식품은 신선품 규칙보다 우선 (감귤초콜릿·귤청·건표고 등 오탐 방지)
const PROCESSED=/초콜릿|초콜렛|쿠키|과자|스낵|칩스|칩\b|젤리|캔디|사탕|잼|청\b|시럽|주스|착즙|즙\b|음료|에이드|차\b|티백|분말|가루|파우더|건조|말린|말랭이|건\b|절임|장아찌|통조림|캔\b|엑기스|농축|정과|양갱|한과|약과|카스테라|비스킷|타르트|파이\b|마들렌|휘낭시에|마카롱|라면|국수|면\b|소스|드레싱|식초|오일|기름|소금|설탕|꿀|환\b|정제|캡슐|스틱/;
const NONALC =/무알콜|무알코올|논알콜|논알코올|알콜프리/;
const MEAT   =/육포|육가공|햄\b|소시지|비프|우육|돈육|오겹|삼겹|근고기|목살|갈비|스테이크|말고기|말육|닭\b|재래닭|구엄닭|오리\b|삼계탕|백숙|유정란|계란|달걀|한우|흑우/;
const ALCOHOL=/막걸리|맥주|소주(?!잔)|와인(?!잔)|위스키|증류주|리큐르|고량주|청주|약주|사케|하이볼|뱅쇼|주류/;
const SEAFOOD=/생물|활\b|선어|회\b|횟감|물회|전복|해삼|성게|소라|문어|오징어|갈치|옥돔|고등어|참조기|조기\b|딱새우|새우\b|멸치(?!볶음)|한치|방어|다금바리|젓갈|명란|김치/;
const PRODUCE=/한라봉|천혜향|레드향|황금향|카라향|만감|감귤|귤(?!피)|오렌지|자몽|레몬|라임|바나나|파파야|망고|키위|아보카도|포도|복숭아|자두|체리|블루베리|딸기|사과|배\b|참외|수박|멜론|메론|무화과|생과일|과일|채소|나물|무\b|당근|양배추|브로콜리|마늘|양파|감자|고구마|옥수수|호박|오이|상추|깻잎/;
const FRESH  =/떡\b|오메기|기정떡|빵\b|케이크|생크림|푸딩|요거트|우유|치즈|두부|순두부|콩나물/;

for(const p of list){
  const n=p.name+' '+p.desc;
  let key;
  if(p.shop_category==='cosmetics')      key='cosmetics';
  else if(p.shop_category==='souvenir')  key='souvenir';
  else if(MEAT.test(n))                  key='prohibited';
  else if(ALCOHOL.test(n)&&!NONALC.test(n)) key='alcohol';
  else if(PROCESSED.test(n))             key='packaged';
  else if(SEAFOOD.test(n))               key='seafood';
  else if(PRODUCE.test(n))               key='produce';
  else if(FRESH.test(n))                 key='perishable';
  else                                   key='packaged';
  const r=RULE[key];
  p.import_status=r[0]; p.customs_note=r[1]; p.line_note=r[2];
}

fs.writeFileSync(path.join(OUT,'goods.json'), JSON.stringify(list,null,1));
const cols=['prdtNum','name','desc','price','tamnao_category','shop_category','import_status','customs_note','line_note','thumbnail','url'];
const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
fs.writeFileSync(path.join(OUT,'goods.csv'),
  '﻿'+cols.join(',')+'\n'+list.map(r=>cols.map(c=>q(r[c])).join(',')).join('\n')+'\n');

const by=k=>list.reduce((a,p)=>(a[p[k]]=(a[p[k]]||0)+1,a),{});
console.log('goods=%d  withPrice=%d  withThumb=%d', list.length,
  list.filter(p=>p.price).length, list.filter(p=>p.thumbnail&&!/no-image/.test(p.thumbnail)).length);
console.log('shop_category:', by('shop_category'));
console.log('import_status:', by('import_status'));
console.log('OUT ->', OUT);
