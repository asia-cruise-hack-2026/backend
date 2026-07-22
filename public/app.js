/* TAMRA PASS — 설계(dc.html)를 실제 코드로 재구현
   화면: 언어 → 크루즈 → [홈·탐방(구글맵)·쇼핑·이동·마이] + 스팟상세/AI패키지/매칭/상품/결제 */

const API = '/api/v1';
const MAPS_KEY = window.__MAPS_KEY__ || '';
const SESSION = localStorage.getItem('tp_sid') ||
  (() => { const s = 'sid_' + Math.random().toString(36).slice(2, 11); localStorage.setItem('tp_sid', s); return s; })();

/* ---------------- i18n (설계 STR 이관) ---------------- */
const STR = {
  choose_language:{ko:"언어를 선택하세요",en:"Choose your language",zh:"请选择语言",ja:"言語を選択"},
  lang_sub:{ko:"제주 체류 동안 이 언어로 안내해 드릴게요.",en:"We'll guide you in this language throughout your stay in Jeju.",zh:"停留期间将以此语言为您服务。",ja:"済州滞在中はこの言語でご案内します。"},
  continue:{ko:"계속하기",en:"Continue",zh:"继续",ja:"続ける"},
  official_badge:{ko:"제주 공식 여행 공공 플랫폼",en:"Jeju official public travel platform",zh:"济州官方公共旅游平台",ja:"済州公式旅行公共プラットフォーム"},
  powered_tamnao:{ko:"탐나오 공식 제휴",en:"in partnership with Tamnao",zh:"与Tamnao官方合作",ja:"Tamnao公式提携"},
  cruise_q:{ko:"어떤 크루즈로 오셨나요?",en:"Which cruise did you arrive on?",zh:"您乘坐哪艘邮轮抵达？",ja:"どのクルーズで到着しましたか？"},
  cruise_q_sub:{ko:"크루즈를 선택하면 체류 시간에 딱 맞는 일정을 추천해 드려요.",en:"Pick your ship and we'll tailor everything to your time ashore.",zh:"选择邮轮后，我们将为您的岸上时间量身推荐。",ja:"船を選ぶと滞在時間に合わせてご提案します。"},
  select_cruise:{ko:"크루즈 선택",en:"Select your cruise",zh:"选择邮轮",ja:"クルーズを選択"},
  docking_port:{ko:"정박 항구",en:"Docking port",zh:"停靠港口",ja:"停泊港"},
  time_in_jeju:{ko:"제주 체류 시간",en:"Time in Jeju",zh:"济州停留时间",ja:"済州滞在時間"},
  next_dest:{ko:"다음 목적지",en:"Next destination",zh:"下一目的地",ja:"次の目的地"},
  board_by:{ko:"탑승 마감",en:"Back on board by",zh:"返船截止",ja:"乗船締切"},
  get_started:{ko:"시작하기",en:"Get started",zh:"开始",ja:"始める"},
  nav_home:{ko:"홈",en:"Home",zh:"首页",ja:"ホーム"},
  nav_explore:{ko:"탐방",en:"Explore",zh:"探索",ja:"探索"},
  nav_shop:{ko:"쇼핑",en:"Shop",zh:"购物",ja:"ショップ"},
  nav_move:{ko:"이동",en:"Ride",zh:"出行",ja:"移動"},
  nav_my:{ko:"마이",en:"Me",zh:"我的",ja:"マイ"},
  until_departure:{ko:"출항까지",en:"Departs in",zh:"距出航",ja:"出航まで"},
  hello:{ko:"제주에 오신 것을 환영해요",en:"Welcome to Jeju",zh:"欢迎来到济州",ja:"済州へようこそ"},
  qa_explore:{ko:"항구 주변 스팟 탐방",en:"Explore spots near the port",zh:"探索港口周边景点",ja:"港周辺スポット探索"},
  qa_ai:{ko:"AI 올인원 패키지",en:"AI all-in-one package",zh:"AI一站式套餐",ja:"AIオールインワン"},
  qa_shop:{ko:"특산품 쇼핑 · 배송",en:"Local goods & delivery",zh:"特产购物·配送",ja:"特産品·配送"},
  qa_taxi:{ko:"택시 · 실시간 교통",en:"Taxi & live traffic",zh:"出租车·实时交通",ja:"タクシー·交通"},
  near_port:{ko:"지금 항구에서 갈 만한 곳",en:"Great picks right by the port",zh:"港口附近推荐",ja:"港からすぐの人気スポット"},
  see_all:{ko:"전체보기",en:"See all",zh:"查看全部",ja:"すべて"},
  spot_map:{ko:"제주 스팟 지도",en:"Jeju spot map",zh:"济州景点地图",ja:"済州スポットマップ"},
  main_spots:{ko:"메인 스팟",en:"Main spots",zh:"主要景点",ja:"メインスポット"},
  pick_main_hint:{ko:"메인 스팟을 고르면 주변 스팟을 추천하고 패키지를 만들어 드려요.",en:"Pick a main spot — we'll suggest nearby stops and build a package.",zh:"选择主要景点，我们会推荐周边并生成套餐。",ja:"メインスポットを選ぶと周辺を提案し、パッケージを作成します。"},
  add_package:{ko:"패키지 담기",en:"Add to package",zh:"加入套餐",ja:"パッケージに追加"},
  added:{ko:"패키지에 담김",en:"Added to package",zh:"已加入套餐",ja:"パッケージに追加済み"},
  removed:{ko:"패키지에서 뺐어요",en:"Removed from package",zh:"已从套餐移除",ja:"パッケージから削除"},
  from_port:{ko:"항구에서",en:"from port",zh:"距港口",ja:"港から"},
  approx:{ko:"약",en:"~",zh:"约",ja:"約"},
  min:{ko:"분",en:"min",zh:"分钟",ja:"分"},
  nearby_subs:{ko:"주변 추천 스팟",en:"Recommended nearby",zh:"周边推荐",ja:"周辺のおすすめ"},
  make_ai_from_spot:{ko:"이 스팟으로 AI 패키지 만들기",en:"Build an AI package from here",zh:"以此生成AI套餐",ja:"ここからAIパッケージ作成"},
  ai_making:{ko:"AI가 패키지를 만들고 있어요",en:"AI is building your package",zh:"AI正在生成套餐",ja:"AIがパッケージを作成中"},
  ai_step1:{ko:"선택한 스팟 분석",en:"Analyzing your spots",zh:"分析所选景点",ja:"スポットを分析"},
  ai_step2:{ko:"최적 동선 계산",en:"Optimizing the route",zh:"优化行程路线",ja:"最適ルートを計算"},
  ai_step3:{ko:"체류 시간 · 반입 규정 검토",en:"Checking time & customs rules",zh:"核对时间与携带规定",ja:"滞在時間·持込規定を確認"},
  ai_step4:{ko:"패키지 구성 완료",en:"Package ready",zh:"套餐完成",ja:"パッケージ完成"},
  package_ready:{ko:"올인원 패키지 완성",en:"Your all-in-one package",zh:"一站式套餐已就绪",ja:"オールインワン完成"},
  package_sub:{ko:"체류 시간에 맞춰 최적 동선으로 구성했어요.",en:"Optimized to fit the time you have ashore.",zh:"已按您的岸上时间优化行程。",ja:"滞在時間に合わせて最適化しました。"},
  total_course:{ko:"총 코스",en:"Total",zh:"总行程",ja:"総所要"},
  fits_stay:{ko:"체류 시간 내 완료 가능",en:"Fits within your time ashore",zh:"可在停留时间内完成",ja:"滞在時間内に完了可能"},
  over_stay:{ko:"체류 시간 초과",en:"Over your time ashore",zh:"超出停留时间",ja:"滞在時間を超過"},
  buffer:{ko:"여유",en:"buffer",zh:"余量",ja:"余裕"},
  return_port:{ko:"항구 복귀",en:"Back at port",zh:"返回港口",ja:"港へ戻る"},
  match_driver:{ko:"기사 · 가이드 매칭하기",en:"Match a driver or guide",zh:"匹配司机·向导",ja:"ドライバー·ガイドをマッチ"},
  finding_partners:{ko:"주변 파트너를 찾고 있어요",en:"Finding partners near you",zh:"正在寻找周边合作方",ja:"周辺のパートナーを検索中"},
  partners_ready:{ko:"매칭 가능한 파트너",en:"Available partners",zh:"可匹配的合作方",ja:"マッチ可能なパートナー"},
  verified:{ko:"탐나오 공식 검증",en:"Tamnao verified",zh:"Tamnao官方认证",ja:"Tamnao公式認証"},
  langs_ok:{ko:"가능 언어",en:"Languages",zh:"可用语言",ja:"対応言語"},
  book_partner:{ko:"이 파트너로 예약",en:"Book",zh:"预订",ja:"予約"},
  booked:{ko:"예약이 접수되었어요",en:"Booking received",zh:"预订已受理",ja:"予約を受け付けました"},
  shop_title:{ko:"제주 특산품 · 기념품",en:"Jeju goods & souvenirs",zh:"济州特产·纪念品",ja:"済州特産·お土産"},
  shop_trust:{ko:"탐나오가 검증한 제주 공식 상품이에요.",en:"Official Jeju products verified by Tamnao.",zh:"经Tamnao核验的济州官方商品。",ja:"Tamnaoが検証した済州公式商品です。"},
  add_cart:{ko:"장바구니",en:"Add to cart",zh:"加入购物车",ja:"カートに追加"},
  added_cart:{ko:"장바구니에 담았어요",en:"Added to cart",zh:"已加入购物车",ja:"カートに追加しました"},
  customs_line_info:{ko:"세관 · 선사 반입 안내",en:"Customs & cruise line rules",zh:"海关·邮轮携带规定",ja:"税関·船社の持込案内"},
  customs_note:{ko:"세관",en:"Customs",zh:"海关",ja:"税関"},
  line_note:{ko:"선사",en:"Cruise line",zh:"邮轮",ja:"船社"},
  receive_how:{ko:"받는 방법",en:"How to receive",zh:"收货方式",ja:"受取方法"},
  d_ship:{ko:"크루즈 선박으로 배송",en:"Deliver to the ship",zh:"配送至邮轮",ja:"クルーズ船へ配送"},
  d_pickup:{ko:"항구 픽업 지점 수령",en:"Pick up at the port",zh:"港口取货点自取",ja:"港のピックアップで受取"},
  d_stay:{ko:"현위치 배송",en:"Deliver to me now",zh:"当前位置配送",ja:"現在地へ配送"},
  buy_now:{ko:"구매하기",en:"Buy now",zh:"立即购买",ja:"購入する"},
  go_cart:{ko:"장바구니",en:"Cart",zh:"购物车",ja:"カート"},
  order_summary:{ko:"주문 상품",en:"Order summary",zh:"订单商品",ja:"注文内容"},
  confirm_before_pay:{ko:"결제 전 다시 한번 확인해 주세요",en:"Please confirm before you pay",zh:"付款前请再次确认",ja:"お支払い前にもう一度ご確認ください"},
  confirm_import_desc:{ko:"선택하신 상품의 크루즈 반입 규정이에요. 규정을 확인하고 동의해 주세요.",en:"Boarding rules for your items. Review and confirm to continue.",zh:"所选商品的携带规定，请确认并同意。",ja:"商品の持込規定です。ご確認のうえ同意してください。"},
  agree_import:{ko:"반입 규정을 확인했으며 이에 동의합니다",en:"I have reviewed and agree to the boarding rules",zh:"我已阅读并同意携带规定",ja:"持込規定を確認し同意します"},
  total:{ko:"합계",en:"Total",zh:"合计",ja:"合計"},
  pay:{ko:"결제하기",en:"Pay",zh:"支付",ja:"支払う"},
  order_done:{ko:"주문이 완료되었어요",en:"Order complete",zh:"下单完成",ja:"注文が完了しました"},
  cart_empty:{ko:"장바구니가 비어 있어요.",en:"Your cart is empty.",zh:"购物车是空的。",ja:"カートは空です。"},
  taxi_title:{ko:"택시 · 교통",en:"Taxi & transport",zh:"出租车·交通",ja:"タクシー·交通"},
  live_traffic:{ko:"실시간 교통 원활",en:"Live traffic: smooth",zh:"实时交通：畅通",ja:"交通状況：良好"},
  traffic_sub:{ko:"항구 주변 도로가 원활해요.",en:"Roads near the port are clear.",zh:"港口周边道路畅通。",ja:"港周辺の道路は順調です。"},
  pickup:{ko:"출발지",en:"Pick-up",zh:"出发地",ja:"出発地"},
  dest:{ko:"목적지",en:"Destination",zh:"目的地",ja:"目的地"},
  choose_dest:{ko:"목적지를 선택하세요",en:"Choose a destination",zh:"请选择目的地",ja:"目的地を選択"},
  est_fare:{ko:"예상 요금",en:"Est. fare",zh:"预计费用",ja:"予想料金"},
  est_time:{ko:"예상 소요",en:"Est. time",zh:"预计时间",ja:"所要時間"},
  call_taxi:{ko:"택시 호출하기",en:"Request taxi",zh:"呼叫出租车",ja:"タクシーを呼ぶ"},
  finding_driver:{ko:"주변 택시를 찾고 있어요",en:"Finding a nearby taxi",zh:"正在寻找附近出租车",ja:"近くのタクシーを検索中"},
  driver_assigned:{ko:"기사님이 배정되었어요",en:"Driver assigned",zh:"已分配司机",ja:"ドライバー決定"},
  plate:{ko:"차량번호",en:"Plate",zh:"车牌",ja:"ナンバー"},
  my_cruise:{ko:"내 크루즈",en:"My cruise",zh:"我的邮轮",ja:"マイクルーズ"},
  language:{ko:"언어",en:"Language",zh:"语言",ja:"言語"},
  about_trust:{ko:"믿을 수 있는 이유",en:"Why you can trust us",zh:"值得信赖的理由",ja:"信頼できる理由"},
  trust_body:{ko:"탐라패스는 제주특별자치도와 제주관광협회가 운영하는 공공 여행 플랫폼 '탐나오'와 제휴합니다. 특정 영리 업체가 아닌, 제주도가 검증한 정보와 상품·기사만 연결해 드려요.",en:"Tamra Pass partners with Tamnao, the public travel platform run by Jeju Province and the Jeju Tourism Association. We connect you only to Jeju-verified info, products and drivers.",zh:"Tamra Pass与由济州道及济州观光协会运营的公共旅游平台Tamnao合作，仅为您连接经济州官方核验的信息、商品与司机。",ja:"Tamra Passは済州道と済州観光協会が運営する公共旅行プラットフォーム「Tamnao」と提携。済州が検証した情報·商品·ドライバーのみをご案内します。"},
  all:{ko:"전체",en:"All",zh:"全部",ja:"すべて"},
  more:{ko:"더 보기",en:"Load more",zh:"加载更多",ja:"もっと見る"},
  empty_spots:{ko:"조건에 맞는 스팟이 없어요.\n카테고리를 바꿔보세요.",en:"No spots match.\nTry another category.",zh:"没有符合的景点。\n请更换类别。",ja:"該当なし。\nカテゴリを変更してください。"},
  fit_ok:{ko:"시간 내 가능",en:"Fits",zh:"时间充足",ja:"時間内"},
  fit_no:{ko:"시간 초과",en:"Too far",zh:"超时",ja:"時間超過"},
  bookable:{ko:"예약가능",en:"Bookable",zh:"可预订",ja:"予約可"},
  build_pkg:{ko:"개 스팟으로 패키지 만들기",en:" spots · Build package",zh:"个景点·生成套餐",ja:"件でパッケージ作成"},
  detail_page:{ko:"상세 페이지 보기",en:"View details",zh:"查看详情",ja:"詳細を見る"},
  drive:{ko:"차량",en:"drive",zh:"车程",ja:"車"},
  stay_t:{ko:"체류",en:"stay",zh:"停留",ja:"滞在"},
};
const LANG_META = {
  ko:{flag:"🇰🇷",label:"한국어",sub:"Korean",code:"KO"},
  en:{flag:"🇬🇧",label:"English",sub:"English",code:"EN"},
  zh:{flag:"🇨🇳",label:"简体中文",sub:"Chinese",code:"ZH"},
  ja:{flag:"🇯🇵",label:"日本語",sub:"Japanese",code:"JA"},
};

/* ---------------- 상태 ---------------- */
const S = {
  view:'lang', route:'home', lang:'ko',
  cruises:[], cruise:null,
  spots:[], total:0, page:1, size:20, categories:[], category:'all',
  pkg:new Set(), activeSpot:null, currentSpot:null, package:null, partners:[], matchedId:null,
  goods:[], goodsTotal:0, goodsPage:1, shopCat:'all', goodsCats:[], currentGoods:null,
  cart:[], deliveryIdx:0, importAgree:false, order:null,
  taxiDest:'', taxiState:'idle', taxiInfo:null,
  map:null, AdvancedMarker:null, markers:new Map(), portMarker:null, route:null, mapReady:false,
};
S.route = 'home';

const t = k => (STR[k] && (STR[k][S.lang] || STR[k].ko)) || k;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hm = m => { const h=Math.floor(m/60), mm=m%60;
  return S.lang==='ko'?`${h}시간 ${mm}분`:S.lang==='zh'?`${h}小时${mm}分`:S.lang==='ja'?`${h}時間${mm}分`:`${h}h ${mm}m`; };
const hLabel = h => S.lang==='ko'?`${h}시간`:S.lang==='zh'?`${h}小时`:S.lang==='ja'?`${h}時間`:`${h} hours`;
const money = n => S.lang==='ko' ? n.toLocaleString('ko-KR')+'원' : '₩'+n.toLocaleString('en-US');

function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1700); }

async function api(p, opt={}){
  const r = await fetch(API+p, {...opt, headers:{'Content-Type':'application/json','X-Session-Id':SESSION,...(opt.headers||{})}});
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw Object.assign(new Error(j?.error?.message||'오류가 발생했어요'), {payload:j});
  return j;
}
const track = (type, refId, meta) =>
  api('/events',{method:'POST',body:JSON.stringify({type,refId,lang:S.lang,meta})}).catch(()=>{});

/* ---------------- 아이콘 ---------------- */
const I = {
  ship:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c1.5.9 3 .9 4.5 0s3-.9 4.5 0 3 .9 4.5 0 3-.9 4.5 0"/><path d="M5 15l1.6-4.6A2 2 0 0 1 8.5 9H16l3.5 6"/><path d="M9 9V5.5h4L16 9"/></svg>`,
  back:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"/></svg>`,
  home:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>`,
  map:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/></svg>`,
  bag:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,
  car:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-3.5L6 8h12l2 4.5V16"/><path d="M3 16h18"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/></svg>`,
  user:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 5"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  spark:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2z"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"/></svg>`,
  warn:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z"/></svg>`,
  star:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.5 7 .9-5 4.9 1.2 7L12 18l-6.2 3.3L7 14.3l-5-4.9 7-.9L12 2z"/></svg>`,
  guide:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h7v14H4z"/><path d="M13 6h7v14h-7z"/><path d="M11 6c0-1.1.9-2 2-2"/></svg>`,
  van:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16V8h12l4 4v4"/><path d="M2 16h20"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>`,
  traffic:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M5 8h14M5 16h14"/></svg>`,
};

/* ---------------- 라우팅 ---------------- */
function go(route){
  S.route = route;
  render();
  const sc = $('.scroll'); if(sc) sc.scrollTop = 0;
}
const TABS = ['home','explore','shop','move','my'];

function render(){
  const el = $('#screen');
  const sb = $('#sbLang'); if(sb) sb.textContent = LANG_META[S.lang].code;
  if(S.view==='lang')   return el.innerHTML = viewLang(), bindLang();
  if(S.view==='cruise') return el.innerHTML = viewCruise(), bindCruise();

  const R = {
    home:viewHome, explore:viewExplore, spot:viewSpot, package:viewPackage,
    matching:viewMatching, shop:viewShop, product:viewProduct, checkout:viewCheckout,
    move:viewMove, my:viewMy,
  }[S.route] || viewHome;

  // position:relative → .bottomcta가 탭바를 덮지 않고 콘텐츠 영역 안에 고정됨
  el.innerHTML = `<div class="fade" style="flex:1;min-height:0;display:flex;flex-direction:column;position:relative">${R()}</div>
    ${TABS.includes(S.route)?tabbar():''}`;
  bindCommon();
  ({explore:bindExplore, spot:bindSpot, package:bindPackage, matching:bindMatching,
    shop:bindShop, product:bindProduct, checkout:bindCheckout, move:bindMove, home:bindHome,
    my:bindMy}[S.route]||(()=>{}))();
}
function tabbar(){
  const items = [['home',I.home,'nav_home'],['explore',I.map,'nav_explore'],['shop',I.bag,'nav_shop'],
                 ['move',I.car,'nav_move'],['my',I.user,'nav_my']];
  return `<nav class="tabbar">${items.map(([k,ic,lb])=>
    `<button data-tab="${k}" aria-current="${S.route===k}">${ic}<span class="lb">${t(lb)}</span></button>`).join('')}</nav>`;
}
function bindCommon(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>go(b.dataset.tab));
  const bk = $('[data-back]'); if(bk) bk.onclick = () => go(bk.dataset.back);
}
const topbar = (title, back) =>
  `<div class="topbar">${back?`<button class="back" data-back="${back}">${I.back}</button>`:''}<div class="t">${esc(title)}</div></div>`;

/* ---------------- 1. 언어 선택 ---------------- */
function viewLang(){
  return `<div class="scroll pad" style="padding-top:34px">
    <div class="h1">${t('choose_language')}</div>
    <p class="sub" style="margin:10px 0 26px">${t('lang_sub')}</p>
    <div class="langgrid">
      ${['ko','en','zh','ja'].map(c=>{const m=LANG_META[c];
        return `<button class="langopt" data-lang="${c}" aria-pressed="${S.lang===c}">
          <span class="flag">${m.flag}</span>
          <span><span class="lb">${m.label}</span><br><span class="ls">${m.sub}</span></span>
          <span class="code">${m.code}</span></button>`;}).join('')}
    </div>
    <div style="height:20px"></div>
  </div>
  <div style="padding:12px 20px 18px;flex:none">
    <button class="btn" id="langNext">${t('continue')}</button>
    <div class="trust">${I.shield}${t('official_badge')} · ${t('powered_tamnao')}</div>
  </div>`;
}
function bindLang(){
  document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{ S.lang=b.dataset.lang; render(); });
  $('#langNext').onclick = async () => { await loadCruises(); S.view='cruise'; render(); };
}

/* ---------------- 2. 크루즈 선택 ---------------- */
async function loadCruises(){
  S.cruises = (await api('/cruises?lang='+S.lang)).items;
  if(!S.cruise) S.cruise = S.cruises[0];
  else S.cruise = S.cruises.find(c=>c.id===S.cruise.id) || S.cruises[0];
}
function viewCruise(){
  const c = S.cruise;
  return `<div class="scroll pad" style="padding-top:30px">
    <div class="h1">${t('cruise_q')}</div>
    <p class="sub" style="margin:10px 0 22px">${t('cruise_q_sub')}</p>
    <label class="sub" style="font-size:12.5px;font-weight:650;display:block;margin-bottom:7px">${t('select_cruise')}</label>
    <select class="sel" id="cruiseSel">
      ${S.cruises.map(x=>`<option value="${x.id}" ${x.id===c.id?'selected':''}>${esc(x.ship)} · ${esc(x.line)}</option>`).join('')}
    </select>
    <div class="infocard">
      <div class="inforow"><span class="k">${t('docking_port')}</span><span class="v">${esc(c.port.name)}</span></div>
      <div class="inforow"><span class="k">${t('time_in_jeju')}</span><span class="v">${hLabel(Math.round(c.stayMinutes/60))} · ${c.arrival}–${c.departure}</span></div>
      <div class="inforow"><span class="k">${t('board_by')}</span><span class="v">${c.boardByTime}</span></div>
      <div class="inforow"><span class="k">${t('next_dest')}</span><span class="v">${esc(c.nextDestination)}</span></div>
    </div>
    <div style="height:20px"></div>
  </div>
  <div style="padding:12px 20px 18px;flex:none">
    <button class="btn" id="startBtn">${t('get_started')}</button>
    <div class="trust">${I.shield}${t('official_badge')} · ${t('powered_tamnao')}</div>
  </div>`;
}
function bindCruise(){
  $('#cruiseSel').onchange = e => { S.cruise = S.cruises.find(x=>x.id===e.target.value); render(); };
  $('#startBtn').onclick = async () => { S.view='app'; go('home'); await loadSpots(true); render(); };
}

/* ---------------- 3. 홈 ---------------- */
function timeLeft(){
  const c=S.cruise, [ah,am]=c.arrival.split(':').map(Number), [dh,dm]=c.departure.split(':').map(Number);
  const nowM = ah*60+am+90;                      // 설계와 동일: 도착 90분 경과 가정
  return Math.max(0, dh*60+dm - nowM);
}
function viewHome(){
  const c = S.cruise;
  const near = S.spots.slice(0,8);
  return `<div class="scroll" style="padding-bottom:14px">
    <div class="hero">
      <div class="hi">${t('hello')}</div>
      <div class="ship">${esc(c.ship)}</div>
      <div class="cd">
        <div><div class="lbl">${t('until_departure')}</div><div class="val">${hm(timeLeft())}</div></div>
        <div class="brd">${t('board_by')} ${c.boardByTime}</div>
      </div>
    </div>
    <div class="qa">
      ${[['explore','#E7F1FF','#0066FF',I.pin,'qa_explore'],
         ['ai','#F3ECFF','#8B3FF0',I.spark,'qa_ai'],
         ['shop','#FFF1E6','#E8820E',I.bag,'qa_shop'],
         ['move','#E7F6EC','#12A150',I.car,'qa_taxi']].map(([k,bg,fg,ic,lb])=>
        `<button class="qabtn" data-qa="${k}"><span class="ic" style="background:${bg};color:${fg}">${ic}</span>
          <span class="tx">${t(lb)}</span></button>`).join('')}
    </div>
    <div class="sechead"><span class="t">${t('near_port')}</span>
      <button class="more" data-qa="explore">${t('see_all')}</button></div>
    <div class="hscroll">
      ${near.length?near.map(s=>`<button class="hcard" data-spot="${esc(s.id)}">
        <img loading="lazy" src="${esc(s.thumbnail||'')}" alt="" onerror="this.style.visibility='hidden'">
        <div class="n">${esc(s.name)}</div>
        <div class="m">${esc(s.category.label)} · ${s.distanceKm}km</div></button>`).join('')
        :`<div class="sub" style="padding:8px 0">…</div>`}
    </div>
  </div>`;
}
function bindHome(){
  document.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.qa;
    if(k==='ai'){ if(!S.pkg.size){ toast(t('pick_main_hint')); return go('explore'); } return startAi(); }
    go(k);
  });
  document.querySelectorAll('[data-spot]').forEach(b=>b.onclick=()=>openSpot(b.dataset.spot));
}

/* ---------------- 4. 탐방 (구글맵) ---------------- */
async function loadSpots(reset){
  if(reset){ S.page=1; }
  const p = new URLSearchParams({cruiseId:S.cruise.id, lang:S.lang, page:S.page, size:S.size, sort:'distance'});
  if(S.category!=='all') p.set('category', S.category);
  const r = await api('/spots?'+p);
  S.spots = reset ? r.items : S.spots.concat(r.items);
  S.total = r.totalCount;
  if(!S.categories.length){
    const c = await api(`/spots/categories?lang=${S.lang}`);
    S.categories = [{key:'all',label:t('all'),count:null}, ...c.items];
  }
}
function viewExplore(){
  return `<div class="topbar" style="padding-bottom:8px"><div class="t">${t('spot_map')}</div>
      <span class="sub" style="font-size:12px;display:inline-flex;align-items:center;gap:4px">
        <span style="color:var(--primary);display:inline-flex;width:13px">${I.pin}</span>${esc(S.cruise.port.name)}</span></div>
    <div id="map"><div class="maploading">지도를 불러오는 중…</div></div>
    <div class="chips" id="chips">
      ${S.categories.map(c=>`<button class="chip" data-cat="${c.key}" aria-pressed="${c.key===S.category}">
        ${esc(c.label)}${c.count!=null?`<span class="n">${c.count}</span>`:''}</button>`).join('')}
    </div>
    <div class="scroll" style="padding:0 20px 96px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">
        <span class="h3">${t('main_spots')}</span>
        <span class="sub" style="font-size:12px"><b>${S.total}</b></span>
      </div>
      <p class="sub" style="font-size:12.5px;margin:0 0 12px">${t('pick_main_hint')}</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${S.spots.length ? S.spots.map(spotCard).join('')
          : `<div class="empty">${esc(t('empty_spots')).replace(/\n/g,'<br>')}</div>`}
      </div>
      ${S.spots.length<S.total?`<button class="btn ghost sm" id="moreBtn" style="margin-top:12px">${t('more')} (${S.spots.length}/${S.total})</button>`:''}
    </div>
    ${S.pkg.size?`<div class="bottomcta"><button class="btn purple" id="pkgBtn">${S.pkg.size}${t('build_pkg')}</button></div>`:''}`;
}
function spotCard(s){
  const inPkg = S.pkg.has(s.id);
  return `<div class="spotcard ${S.activeSpot===s.id?'active':''}" data-spot="${esc(s.id)}">
    <img loading="lazy" src="${esc(s.thumbnail||'')}" alt="" onerror="this.style.visibility='hidden'">
    <div class="b">
      <div class="n">${esc(s.name)}</div>
      <div class="m">${esc(s.category.label)} · ${s.distanceKm}km · ${t('drive')} ${s.driveMinutes}${t('min')}</div>
      ${s.description?`<div class="d">${esc(s.description)}</div>`:''}
      <div class="badges">
        ${s.bookable?`<span class="bdg book">${t('bookable')}</span>`:''}
        <span class="bdg ${s.fitsWindow?'fit':'nofit'}">${s.fitsWindow?t('fit_ok'):t('fit_no')}</span>
      </div>
    </div>
    <button class="addbtn ${inPkg?'on':''}" data-add="${esc(s.id)}">${inPkg?I.check:I.plus}</button>
  </div>`;
}
function bindExplore(){
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=async()=>{
    S.category=b.dataset.cat; await loadSpots(true); render();
  });
  document.querySelectorAll('.spotcard').forEach(c=>c.onclick=e=>{
    if(e.target.closest('[data-add]')) return; openSpot(c.dataset.spot);
  });
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); togglePkg(b.dataset.add); });
  const mb=$('#moreBtn'); if(mb) mb.onclick=async()=>{ S.page++; await loadSpots(false); render(); };
  const pb=$('#pkgBtn'); if(pb) pb.onclick=startAi;
  initMap();
}
function togglePkg(id){
  if(S.pkg.has(id)){ S.pkg.delete(id); toast(t('removed')); }
  else { S.pkg.add(id); toast(t('added')); track('spot_add_package', id); }
  render();
}

/* ----- 구글맵 ----- */
async function initMap(){
  const box = $('#map'); if(!box) return;
  if(!MAPS_KEY){
    box.outerHTML = `<div class="keyerr"><b>구글맵 API 키가 없습니다.</b><br>
      <code>.env</code>에 <code>VITE_GOOGLE_MAPS_API_KEY</code>를 넣고 서버를 재시작하세요.</div>`;
    return;
  }
  try{
    if(!window.google?.maps){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src=`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=marker&language=${S.lang==='zh'?'zh-CN':S.lang}&loading=async&callback=__mapsReady`;
        s.async=true; window.__mapsReady=res; s.onerror=()=>rej(new Error('load fail'));
        document.head.appendChild(s);
      });
    }
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
    S.AdvancedMarker = AdvancedMarkerElement;
    S.map = new Map(box, {
      center:{lat:S.cruise.port.lat,lng:S.cruise.port.lng}, zoom:11, mapId:'TAMRAPASS_MAP',
      mapTypeControl:false, streetViewControl:false, fullscreenControl:false, clickableIcons:false,
      zoomControl:true,
    });
    S.mapReady = true;
    drawMarkers();
  }catch(e){
    box.innerHTML = `<div class="maploading">지도를 불러오지 못했어요. 키 제한(HTTP 리퍼러) 설정을 확인해 주세요.</div>`;
  }
}
function drawMarkers(){
  if(!S.mapReady || !S.map) return;
  S.markers.forEach(m=>m.map=null); S.markers.clear();
  const bounds = new google.maps.LatLngBounds();
  bounds.extend({lat:S.cruise.port.lat,lng:S.cruise.port.lng});
  for(const s of S.spots.slice(0,60)){
    if(s.lat==null) continue;
    const el=document.createElement('div');
    el.className='pin'+(S.activeSpot===s.id?' active':'')+(S.pkg.has(s.id)?' inpkg':'');
    el.innerHTML=`<span class="bub">${esc(s.name.length>12?s.name.slice(0,11)+'…':s.name)}</span><span class="tail"></span>`;
    el.onclick=ev=>{ ev.stopPropagation(); openSpot(s.id); };
    S.markers.set(s.id, new S.AdvancedMarker({map:S.map,position:{lat:s.lat,lng:s.lng},content:el,
      zIndex:S.activeSpot===s.id?99:1}));
    bounds.extend({lat:s.lat,lng:s.lng});
  }
  if(S.portMarker) S.portMarker.map=null;
  const p=document.createElement('div'); p.className='portpin';
  p.innerHTML=`${I.ship}${esc(S.cruise.port.name)}`;
  S.portMarker=new S.AdvancedMarker({map:S.map,position:{lat:S.cruise.port.lat,lng:S.cruise.port.lng},content:p,zIndex:100});
  if(S.spots.length) S.map.fitBounds(bounds,{top:40,right:40,bottom:40,left:40});
}

/* ---------------- 5. 스팟 상세 ---------------- */
async function openSpot(id){
  S.activeSpot=id;
  track('spot_view', id);
  S.currentSpot = null; go('spot');
  try{
    const d = await api(`/spots/${encodeURIComponent(id)}?lang=${S.lang}&cruiseId=${S.cruise.id}`);
    const nb = await api(`/spots/${encodeURIComponent(id)}/nearby?lang=${S.lang}&radius=3&limit=4`).catch(()=>({items:[]}));
    S.currentSpot = {...d, nearby:nb.items};
    render();
  }catch(e){ toast(e.message); go('explore'); }
}
function viewSpot(){
  const d = S.currentSpot;
  if(!d) return `${topbar('', 'explore')}<div class="empty">…</div>`;
  const inPkg = S.pkg.has(d.id);
  return `${topbar(d.name,'explore')}
  <div class="scroll" style="padding-bottom:100px">
    ${d.thumbnail?`<img src="${esc(d.images?.[0]||d.thumbnail)}" alt="" style="width:100%;height:196px;object-fit:cover;display:block;background:var(--fill)" onerror="this.style.display='none'">`:''}
    <div class="pad" style="padding-top:16px">
      <span class="bdg ${d.fitsWindow?'fit':'nofit'}">${d.fitsWindow?t('fit_ok'):t('fit_no')}</span>
      ${d.bookable?`<span class="bdg book" style="margin-left:4px">${t('bookable')}</span>`:''}
      <div class="h2" style="margin-top:9px">${esc(d.name)}</div>
      <div class="sub" style="margin-top:6px">${esc(d.category.label)} · ${d.distanceKm}km ${t('from_port')} · ${t('approx')} ${d.driveMinutes}${t('min')} · ${t('stay_t')} ${d.stayMinutes}${t('min')}</div>
      ${d.address?`<div class="sub" style="display:flex;gap:6px;margin-top:10px">
        <span style="width:14px;flex:none;color:var(--label-assistive)">${I.pin}</span>${esc(d.address)}</div>`:''}
      ${d.description?`<p style="font-size:14px;line-height:1.65;color:var(--label-neutral);margin:14px 0 0">${esc(d.description)}</p>`:''}
      ${d.tags?.length?`<div class="badges" style="margin-top:12px">${d.tags.slice(0,6).map(x=>`<span class="bdg" style="background:var(--fill);color:var(--label-neutral)">${esc(x)}</span>`).join('')}</div>`:''}
      <a class="btn ghost sm" href="${esc(d.detailUrl)}" target="_blank" rel="noopener" style="margin-top:16px;text-decoration:none">${t('detail_page')}</a>

      ${d.nearby?.length?`<div style="margin-top:24px">
        <div class="h3" style="margin-bottom:10px">${t('nearby_subs')}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${d.nearby.map(n=>`<div class="spotcard" data-spot="${esc(n.id)}" style="padding:9px">
            <img loading="lazy" src="${esc(n.thumbnail||'')}" alt="" style="flex:0 0 48px;height:48px" onerror="this.style.visibility='hidden'">
            <div class="b"><div class="n" style="font-size:13.5px">${esc(n.name)}</div>
              <div class="m">${esc(n.type)} · ${n.distanceKm}km${n.bookable?' · '+t('bookable'):''}</div></div>
          </div>`).join('')}
        </div></div>`:''}
    </div>
  </div>
  <div class="bottomcta" style="display:flex;gap:9px">
    <button class="btn ${inPkg?'ghost':''}" id="spotAdd" style="flex:1">${inPkg?t('added'):t('add_package')}</button>
    <button class="btn purple" id="spotAi" style="flex:1.4">${t('make_ai_from_spot')}</button>
  </div>`;
}
function bindSpot(){
  document.querySelectorAll('[data-spot]').forEach(b=>b.onclick=()=>openSpot(b.dataset.spot));
  const a=$('#spotAdd'); if(a) a.onclick=()=>{ togglePkg(S.currentSpot.id); };
  const ai=$('#spotAi'); if(ai) ai.onclick=()=>{ S.pkg.add(S.currentSpot.id); startAi(); };
}

/* ---------------- 6. AI 패키지 ---------------- */
async function startAi(){
  S.package=null; S.aiStep=0; go('package');
  const iv = setInterval(()=>{ S.aiStep=Math.min(3,S.aiStep+1); const el=$('#aiSteps'); if(el) el.innerHTML=aiStepsHtml(); }, 620);
  try{
    const p = await api('/packages',{method:'POST',
      body:JSON.stringify({cruiseId:S.cruise.id, spotIds:[...S.pkg], lang:S.lang})});
    await new Promise(r=>setTimeout(r,700));
    clearInterval(iv); S.package=p; render();
  }catch(e){ clearInterval(iv); toast(e.message); go('explore'); }
}
function aiStepsHtml(){
  return [1,2,3,4].map((n,i)=>{
    const done=S.aiStep>i, active=S.aiStep===i;
    return `<div class="aistep ${done?'done':active?'active':'pending'}">
      <span class="dot">${done?I.check:''}</span>${t('ai_step'+n)}</div>`;
  }).join('');
}
function viewPackage(){
  if(!S.package) return `<div class="aiwrap">
    <div class="airing"></div>
    <div class="h3" style="text-align:center">${t('ai_making')}</div>
    <div id="aiSteps" style="display:flex;flex-direction:column;gap:11px">${aiStepsHtml()}</div></div>`;
  const p=S.package, pct=Math.min(100,Math.round(p.totalMinutes/p.availableMinutes*100)), over=!p.fitsWindow;
  return `${topbar(t('package_ready'),'explore')}
  <div class="scroll" style="padding-bottom:100px">
    <div class="pad">
      <p class="sub" style="margin:0 0 2px">${t('package_sub')}</p>
      <div class="fitbar ${over?'over':''}">
        <span>${t('total_course')} ${hm(p.totalMinutes)}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <span style="color:${over?'var(--no)':'var(--ok)'}">${over
          ? `+${p.totalMinutes-p.availableMinutes}${t('min')}` : `${t('buffer')} ${p.returnToPort.bufferMinutes}${t('min')}`}</span>
      </div>
      <div class="sub" style="font-size:12px;margin-top:6px;color:${over?'var(--restr)':'var(--ok)'}">
        ${over?(p.suggestion?esc(p.suggestion.message):t('over_stay')):t('fits_stay')}</div>
      <div style="margin-top:18px">
        ${p.itinerary.map(i=>`<div class="itin">
          <div class="no">${i.no}</div>
          <div style="flex:1;min-width:0"><div class="n">${esc(i.name)}</div>
            <div class="m">${i.arriveAt} – ${i.departAt} · ${esc(i.category)} · ${t('stay_t')} ${i.stayMinutes}${t('min')}</div></div>
          ${i.thumbnail?`<img src="${esc(i.thumbnail)}" alt="" onerror="this.style.visibility='hidden'">`:''}
        </div>`).join('')}
        <div class="itin"><div class="no" style="background:var(--primary)">${I.ship}</div>
          <div style="flex:1"><div class="n">${esc(p.port.name)}</div>
          <div class="m">${t('return_port')} ${p.returnToPort.arriveAt}</div></div></div>
      </div>
    </div>
  </div>
  <div class="bottomcta"><button class="btn purple" id="matchBtn">${t('match_driver')}</button></div>`;
}
function bindPackage(){ const b=$('#matchBtn'); if(b) b.onclick=goMatching; }

/* ---------------- 7. 매칭 ---------------- */
async function goMatching(){
  S.partners=[]; S.matchedId=null; go('matching');
  await new Promise(r=>setTimeout(r,1400));
  S.partners = (await api('/partners?lang='+S.lang)).items;
  render();
}
function viewMatching(){
  if(!S.partners.length) return `${topbar(t('finding_partners'),'package')}
    <div class="searching" style="flex:1;justify-content:center">
      <div class="radar"><i></i><i></i><i></i></div>
      <div class="h3">${t('finding_partners')}</div></div>`;
  return `${topbar(t('partners_ready'),'package')}
  <div class="scroll pad" style="padding-bottom:24px">
    <div style="display:flex;flex-direction:column;gap:11px">
      ${S.partners.map(p=>{const booked=S.matchedId===p.id;
        const color=p.id==='van'?'#0066FF':p.id==='taxi'?'#12A150':'#8B3FF0';
        return `<div class="partner" style="${booked?'box-shadow:inset 0 0 0 2px var(--primary)':''}">
        <span class="av" style="background:${color}">${p.id==='semi'?I.guide:p.id==='van'?I.van:I.car}</span>
        <div style="flex:1;min-width:0">
          <div class="n">${esc(p.name)}</div>
          <div class="r">${esc(p.role)} · ${esc(p.vehicle)}</div>
          <div class="r" style="display:flex;align-items:center;gap:4px;margin-top:3px">
            <span style="color:#F5A623;display:inline-flex;width:12px">${I.star}</span>${p.rating}
            · ${t('langs_ok')} ${p.languages.map(l=>LANG_META[l]?.code||l).join('·')}</div>
          ${p.verified?`<span class="vbadge">${I.shield}${t('verified')}</span>`:''}
        </div>
        <div style="text-align:right;flex:none">
          <div style="font-size:13.5px;font-weight:800">${esc(p.priceLabel)}</div>
          <button class="btn ${booked?'ghost':''} sm" data-book="${p.id}" style="width:auto;padding:0 13px;margin-top:6px">
            ${booked?t('booked'):t('book_partner')}</button>
        </div></div>`;}).join('')}
    </div>
  </div>`;
}
function bindMatching(){
  document.querySelectorAll('[data-book]').forEach(b=>b.onclick=async()=>{
    try{ await api('/bookings',{method:'POST',body:JSON.stringify({packageId:S.package?.id,partnerId:b.dataset.book})});
      S.matchedId=b.dataset.book; toast(t('booked')); render();
    }catch(e){ toast(e.message); }
  });
}

/* ---------------- 8. 쇼핑 ---------------- */
async function loadGoods(reset){
  if(reset) S.goodsPage=1;
  const p=new URLSearchParams({lang:S.lang,page:S.goodsPage,size:12});
  if(S.shopCat!=='all') p.set('category',S.shopCat);
  const r=await api('/goods?'+p);
  S.goods = reset ? r.items : S.goods.concat(r.items);
  S.goodsTotal = r.totalCount;
  if(!S.goodsCats.length) S.goodsCats=(await api('/goods/categories?lang='+S.lang)).items;
}
function viewShop(){
  return `<div class="topbar"><div class="t">${t('shop_title')}</div></div>
  <div class="pad" style="padding-bottom:8px"><div class="sub" style="display:flex;align-items:center;gap:5px;font-size:12px">
    <span style="color:var(--primary);display:inline-flex;width:13px">${I.shield}</span>${t('shop_trust')}</div></div>
  <div class="chips">${S.goodsCats.map(c=>`<button class="chip" data-gcat="${c.key}" aria-pressed="${c.key===S.shopCat}">
    ${esc(c.label)}<span class="n">${c.count}</span></button>`).join('')}</div>
  <div class="scroll" style="padding-bottom:${S.cart.length?'96px':'20px'}">
    <div class="goodsgrid">
      ${S.goods.map(g=>`<div class="gcard" data-goods="${esc(g.id)}">
        <img loading="lazy" src="${esc(g.thumbnail)}" alt="" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E'">
        <div class="n">${esc(g.name)}</div>
        <div class="p">${esc(g.priceLabel)}</div>
        <span class="imp ${g.importStatus}"><span class="d"></span>${esc(g.importLabel)}</span>
      </div>`).join('')}
    </div>
    ${S.goods.length<S.goodsTotal?`<div class="pad" style="margin-top:14px">
      <button class="btn ghost sm" id="moreGoods">${t('more')} (${S.goods.length}/${S.goodsTotal})</button></div>`:''}
  </div>
  ${S.cart.length?`<div class="bottomcta"><button class="btn" id="goCart">${t('go_cart')} · ${S.cart.length}</button></div>`:''}`;
}
function bindShop(){
  document.querySelectorAll('[data-gcat]').forEach(b=>b.onclick=async()=>{ S.shopCat=b.dataset.gcat; await loadGoods(true); render(); });
  document.querySelectorAll('[data-goods]').forEach(b=>b.onclick=()=>openGoods(b.dataset.goods));
  const m=$('#moreGoods'); if(m) m.onclick=async()=>{ S.goodsPage++; await loadGoods(false); render(); };
  const c=$('#goCart'); if(c) c.onclick=()=>{ S.importAgree=false; S.order=null; go('checkout'); };
}

/* ---------------- 9. 상품 상세 ---------------- */
async function openGoods(id){
  S.currentGoods=null; S.deliveryIdx=0; go('product');
  try{ S.currentGoods = await api(`/goods/${encodeURIComponent(id)}?lang=${S.lang}`); render(); }
  catch(e){ toast(e.message); go('shop'); }
}
const IMP_COLOR = {allowed:['var(--ok-bg)','var(--ok)'],conditional:['var(--cond-bg)','var(--cond)'],
  restricted:['var(--restr-bg)','var(--restr)'],prohibited:['var(--no-bg)','var(--no)']};
function viewProduct(){
  const g=S.currentGoods;
  if(!g) return `${topbar('','shop')}<div class="empty">…</div>`;
  const [bg,fg]=IMP_COLOR[g.importStatus]||IMP_COLOR.allowed;
  return `${topbar(g.name,'shop')}
  <div class="scroll" style="padding-bottom:100px">
    <img src="${esc(g.thumbnail)}" alt="" style="width:100%;height:230px;object-fit:cover;display:block;background:var(--fill)" onerror="this.style.display='none'">
    <div class="pad" style="padding-top:15px">
      <span class="imp ${g.importStatus}"><span class="d"></span>${esc(g.importLabel)}</span>
      <div class="h2" style="margin-top:8px">${esc(g.name)}</div>
      ${g.description?`<p class="sub" style="margin:7px 0 0">${esc(g.description)}</p>`:''}
      <div style="font-size:22px;font-weight:800;margin-top:10px">${esc(g.priceLabel)}</div>

      <div class="rulebox">
        <div class="rulehead" style="background:${bg};color:${fg}">${I.warn}${t('customs_line_info')}</div>
        <div class="rulerow"><span class="k">${t('customs_note')}</span><span class="v">${esc(g.customsNote)}</span></div>
        <div class="rulerow"><span class="k">${t('line_note')}</span><span class="v">${esc(g.cruiseLineNote)}</span></div>
      </div>

      <div style="margin-top:20px">
        <div class="h3" style="margin-bottom:9px">${t('receive_how')}</div>
        ${[t('d_ship'),t('d_pickup'),t('d_stay')].map((lb,i)=>
          `<div class="optrow ${S.deliveryIdx===i?'on':''}" data-del="${i}"><span class="radio"></span>${lb}</div>`).join('')}
      </div>
      <a class="btn ghost sm" href="${esc(g.detailUrl)}" target="_blank" rel="noopener" style="margin-top:8px;text-decoration:none">${t('detail_page')}</a>
    </div>
  </div>
  <div class="bottomcta" style="display:flex;gap:9px">
    <button class="btn ghost" id="addCart" style="flex:1">${t('add_cart')}</button>
    <button class="btn" id="buyNow" style="flex:1.4">${t('buy_now')}</button>
  </div>`;
}
function bindProduct(){
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ S.deliveryIdx=+b.dataset.del; render(); });
  const a=$('#addCart'); if(a) a.onclick=()=>{ addCart(S.currentGoods); toast(t('added_cart')); };
  const b=$('#buyNow'); if(b) b.onclick=()=>{ addCart(S.currentGoods); S.importAgree=false; S.order=null; go('checkout'); };
}
function addCart(g){ if(!S.cart.find(x=>x.id===g.id)) S.cart.push(g); }

/* ---------------- 10. 결제 (반입 동의 게이트) ---------------- */
function viewCheckout(){
  if(S.order) return `${topbar('','shop')}
    <div class="scroll pad" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center;gap:14px">
      <div style="width:66px;height:66px;border-radius:99px;background:var(--ok-bg);color:var(--ok);display:flex;align-items:center;justify-content:center">
        <span style="width:30px;display:inline-flex">${I.check}</span></div>
      <div class="h2">${t('order_done')}</div>
      <p class="sub">${esc(S.order.deliveryNote)}</p>
      <div style="font-size:18px;font-weight:800">${esc(S.order.totalPriceLabel)}</div>
      <button class="btn ghost sm" id="backShop" style="width:auto;padding:0 20px;margin-top:8px">${t('nav_shop')}</button>
    </div>`;
  if(!S.cart.length) return `${topbar('','shop')}<div class="empty">${t('cart_empty')}</div>`;

  const restricted = S.cart.filter(g=>g.importStatus==='restricted'||g.importStatus==='prohibited');
  const total = S.cart.reduce((a,g)=>a+g.price,0);
  const needAgree = restricted.length>0;
  return `${topbar(t('confirm_before_pay'),'shop')}
  <div class="scroll pad" style="padding-bottom:100px">
    <div class="h3">${t('order_summary')}</div>
    <div style="margin-top:6px">
      ${S.cart.map(g=>`<div class="corow">
        <span style="display:flex;align-items:center;gap:9px;min-width:0">
          <img src="${esc(g.thumbnail)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;background:var(--fill)" onerror="this.style.visibility='hidden'">
          <span style="min-width:0"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${esc(g.name)}</span>
          <span class="imp ${g.importStatus}" style="margin-top:3px"><span class="d"></span>${esc(g.importLabel)}</span></span>
        </span>
        <span style="display:flex;align-items:center;gap:8px;flex:none">
          <b style="font-variant-numeric:tabular-nums">${esc(g.priceLabel)}</b>
          <button data-rm="${esc(g.id)}" style="color:var(--label-assistive);font-size:17px;line-height:1">×</button></span>
      </div>`).join('')}
    </div>
    <div class="cototal"><span>${t('total')}</span><span>${money(total)}</span></div>

    ${needAgree?`
      <p class="sub" style="font-size:12.5px;margin-top:16px">${t('confirm_import_desc')}</p>
      ${restricted.map(g=>`<div class="warnbox">
        <div class="t">${I.warn}${esc(g.name)} · ${esc(g.importLabel)}</div>
        <div class="b">${esc(g.customsNote)} ${esc(g.cruiseLineNote)}</div></div>`).join('')}
      <div class="agreebox ${S.importAgree?'on':''}" id="agreeBox">
        <span class="check">${S.importAgree?I.check:''}</span>
        <span class="t">${t('agree_import')}</span></div>`:''}
  </div>
  <div class="bottomcta"><button class="btn" id="payBtn" ${needAgree&&!S.importAgree?'disabled':''}>${t('pay')}</button></div>`;
}
function bindCheckout(){
  const bs=$('#backShop'); if(bs) bs.onclick=()=>{ S.cart=[]; S.order=null; go('shop'); };
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ S.cart=S.cart.filter(x=>x.id!==b.dataset.rm); render(); });
  const ag=$('#agreeBox'); if(ag) ag.onclick=()=>{ S.importAgree=!S.importAgree; render(); };
  const pay=$('#payBtn'); if(pay) pay.onclick=async()=>{
    try{
      S.order = await api('/orders',{method:'POST',body:JSON.stringify({
        items:S.cart.map(g=>({goodsId:g.id,qty:1})),
        deliveryMethod:['ship','port_pickup','current_location'][S.deliveryIdx],
        importAgreed:S.importAgree, lang:S.lang })});
      render();
    }catch(e){
      // 서버가 409로 막는 경우 (프론트 우회 시도 방어)
      toast(e.message);
    }
  };
}

/* ---------------- 11. 이동 (택시) ---------------- */
function viewMove(){
  const opts = S.spots.slice(0,30);
  const d = S.taxiInfo;
  return `<div class="topbar"><div class="t">${t('taxi_title')}</div></div>
  <div class="scroll pad" style="padding-bottom:100px">
    <div class="trafficbox">
      <span class="ic">${I.traffic}</span>
      <div><div style="font-size:14px;font-weight:700">${t('live_traffic')}</div>
        <div class="sub" style="font-size:12px">${t('traffic_sub')}</div></div>
    </div>
    <div style="margin-top:18px">
      <label class="sub" style="font-size:12.5px;font-weight:650;display:block;margin-bottom:6px">${t('pickup')}</label>
      <div class="optrow on"><span class="radio"></span>${esc(S.cruise.port.name)}</div>
      <label class="sub" style="font-size:12.5px;font-weight:650;display:block;margin:14px 0 6px">${t('dest')}</label>
      <select class="sel" id="taxiSel">
        <option value="">${t('choose_dest')}</option>
        ${opts.map(s=>`<option value="${esc(s.id)}" ${S.taxiDest===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    ${S.taxiFare?`<div class="fare">
      <div class="farebox"><div class="k">${t('est_fare')}</div><div class="v">${esc(S.taxiFare.fareLabel)}</div></div>
      <div class="farebox"><div class="k">${t('est_time')}</div><div class="v">${S.taxiFare.durationMinutes}${t('min')}</div></div>
    </div>`:''}
    ${S.taxiState==='searching'?`<div class="searching"><div class="radar"><i></i><i></i><i></i></div>
      <div class="h3">${t('finding_driver')}</div></div>`:''}
    ${S.taxiState==='assigned'&&d?`<div class="partner" style="margin-top:16px">
      <span class="av" style="background:#12A150">${I.car}</span>
      <div style="flex:1"><div class="n">${esc(d.driver.name)}</div>
        <div class="r">${esc(d.driver.vehicle)} · ${t('plate')} ${esc(d.driver.plate)}</div>
        <div class="r" style="display:flex;align-items:center;gap:4px;margin-top:3px">
          <span style="color:#F5A623;display:inline-flex;width:12px">${I.star}</span>${d.driver.rating}</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:800;color:var(--primary)">${d.etaMinutes}${t('min')}</div>
        <div class="sub" style="font-size:11px">${t('driver_assigned')}</div></div>
    </div>`:''}
  </div>
  ${S.taxiState!=='assigned'?`<div class="bottomcta">
    <button class="btn" id="callTaxi" ${!S.taxiDest?'disabled':''}>${t('call_taxi')}</button></div>`:''}`;
}
function bindMove(){
  const sel=$('#taxiSel');
  if(sel) sel.onchange=async e=>{
    S.taxiDest=e.target.value; S.taxiState='idle'; S.taxiInfo=null; S.taxiFare=null;
    if(S.taxiDest){
      try{ S.taxiFare=await api(`/taxi/estimate?port=${S.cruise.port.key}&spotId=${encodeURIComponent(S.taxiDest)}&lang=${S.lang}`); }
      catch(err){ toast(err.message); }
    }
    render();
  };
  const c=$('#callTaxi');
  if(c) c.onclick=async()=>{
    S.taxiState='searching'; render();
    await new Promise(r=>setTimeout(r,1800));
    try{ S.taxiInfo=await api('/taxi/requests',{method:'POST',
      body:JSON.stringify({port:S.cruise.port.key,spotId:S.taxiDest,lang:S.lang})});
      S.taxiState='assigned';
    }catch(e){ S.taxiState='idle'; toast(e.message); }
    render();
  };
}

/* ---------------- 12. 마이 ---------------- */
function viewMy(){
  const c=S.cruise;
  return `<div class="topbar"><div class="t">${t('nav_my')}</div></div>
  <div class="scroll pad" style="padding-bottom:20px">
    <div class="infocard" style="margin-top:0">
      <div class="sub" style="font-size:12px">${t('my_cruise')}</div>
      <div class="h3" style="margin-top:4px">${esc(c.ship)}</div>
      <div class="sub" style="font-size:12.5px;margin-top:3px">${esc(c.line)} · ${esc(c.port.name)}</div>
      <div class="sub" style="font-size:12.5px;margin-top:8px">${c.arrival}–${c.departure} · ${t('board_by')} ${c.boardByTime}</div>
    </div>
    <div style="margin-top:8px">
      <div class="myrow"><span class="k">${t('language')}</span>
        <span class="v">${LANG_META[S.lang].label}</span></div>
      <div class="myrow"><span class="k">${t('next_dest')}</span><span class="v">${esc(c.nextDestination)}</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn ghost sm" id="reLang">${t('language')}</button>
      <button class="btn ghost sm" id="reCruise">${t('select_cruise')}</button>
    </div>
    <div class="trustbox">
      <div class="t">${I.shield}${t('about_trust')}</div>
      <div class="b">${t('trust_body')}</div>
    </div>
  </div>`;
}
function bindMy(){
  $('#reLang').onclick=()=>{ S.view='lang'; render(); };
  $('#reCruise').onclick=()=>{ S.view='cruise'; render(); };
}

/* ---------------- 부팅 ---------------- */
(async function boot(){
  try{
    await loadCruises();
    render();
    // 백그라운드 선로딩
    loadGoods(true).catch(()=>{});
  }catch(e){
    $('#screen').innerHTML=`<div class="keyerr">서버에 연결하지 못했어요.<br><code>node server/server.js</code> 실행 여부를 확인해 주세요.</div>`;
  }
})();
