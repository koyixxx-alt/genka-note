/* 原価ノート — 飲食店のメニュー原価計算（データはこの端末のブラウザに保存） */
(function(){
'use strict';
const KEY='genka_v1';
const UNITS=['g','kg','ml','L','個','本','枚','玉','食','袋','パック'];
// 量の換算（kg→g、L→ml）。材料の単位と使う量の単位はそろえて入力する前提
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(Number(n)||0).toLocaleString('ja-JP');
// 1円未満も見たい原価（例: ¥87.3）
const yen1=n=>{n=Number(n)||0;return '¥'+(Math.round(n*10)/10).toLocaleString('ja-JP',{minimumFractionDigits:n<1000?1:0,maximumFractionDigits:1});};
const yenU=n=>{n=Number(n)||0;return n>=100?yen(n):n>=1?'¥'+(Math.round(n*100)/100).toLocaleString('ja-JP'):'¥'+(Math.round(n*1000)/1000).toLocaleString('ja-JP');};
const pct=n=>(Math.round((Number(n)||0)*10)/10).toFixed(1)+'%';
const fq=n=>String(Math.round((Number(n)||0)*1000)/1000);
const num=v=>{const n=Number(String(v??'').replace(/[,，\s]/g,''));return isFinite(n)?n:0;};

/* ---------------- データ ---------------- */
const blankStore=name=>({id:uid(),name,target:30,round:10,mats:[],preps:[],menus:[],cats:['メイン','サイド','ドリンク','その他']});
let DATA=load();
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.stores&&d.stores.length)return d;}catch(e){}
  return {stores:[],cur:null,theme:'auto',shops:[]};}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(DATA));}catch(e){toast('保存できませんでした（ブラウザの保存領域を確認してください）');}}
const store=()=>DATA.stores.find(s=>s.id===DATA.cur)||DATA.stores[0];
const S={view:'home',q:'',cat:'',simUp:0,simMode:'price'};

/* ---------------- 計算 ---------------- */
// 仕入価格（税抜）。税込で入力した材料は税率で割り戻す
const matEx=m=>num(m.price)/(m.taxin?1+num(m.taxin)/100:1);
// 1単位あたり（1g・1ml・1個）＝ 税抜仕入価格 ÷（内容量 × 歩留まり）
function matUnit(m,up){const n=num(m.size)*(num(m.yield)||100)/100;return n>0?matEx(m)*(1+(up||0)/100)/n:0;}
function refUnit(st,ref,up,depth){
  if(!ref)return 0;const [k,id]=ref.split(':');
  if(k==='m'){const m=st.mats.find(x=>x.id===id);return m?matUnit(m,up):0;}
  if(k==='p'){const p=st.preps.find(x=>x.id===id);if(!p||(depth||0)>6)return 0;const out=num(p.out);return out>0?linesCost(st,p.lines,up,(depth||0)+1)/out:0;}
  return 0;}
const refInfo=(st,ref)=>{if(!ref)return null;const [k,id]=ref.split(':');const x=(k==='m'?st.mats:st.preps).find(x=>x.id===id);return x?{kind:k,name:x.name,unit:k==='m'?x.unit:x.unit,item:x}:null;};
function linesCost(st,lines,up,depth){return (lines||[]).reduce((a,l)=>a+refUnit(st,l.ref,up,depth)*num(l.qty),0);}
// メニューの原価（材料＋その他）。売価は税込で入力、原価率は税抜売価で計算
const menuCost=(st,m,up)=>linesCost(st,m.lines,up)+num(m.misc)*(1+(up||0)/100);
const priceEx=m=>num(m.price)/(1+(num(m.tax)||10)/100);
const rateOf=(cost,ex)=>ex>0?cost/ex*100:0;
// 目標の原価率になる税込売価（端数は店舗設定の単位で切り上げ）
function targetPrice(st,m,cost){if(!(cost>0))return 0;const r=num(st.target)||30,u=num(st.round)||1,inc=cost/(r/100)*(1+(num(m.tax)||10)/100);return Math.ceil(inc/u)*u;}
function calc(st,m,up){const cost=menuCost(st,m,up),ex=priceEx(m),rate=rateOf(cost,ex);return {cost,ex,rate,gross:ex-cost,tp:targetPrice(st,m,cost)};}
const level=(st,rate)=>{const t=num(st.target)||30;return rate>t?'over':rate>t-3?'near':'ok';};
const usedBy=(st,ref)=>[...st.menus.filter(m=>(m.lines||[]).some(l=>l.ref===ref)),...st.preps.filter(p=>(p.lines||[]).some(l=>l.ref===ref))];

/* ---------------- 見本データ ---------------- */
function sampleUdon(){const st=blankStore('うどん ちゅるちゅる');st.target=30;st.round=10;st.cats=['うどん','トッピング','ご飯もの','ドリンク'];
  const M=(name,price,size,unit,y,taxin,supplier)=>({id:uid(),name,price,size,unit,yield:y,taxin:taxin||0,supplier:supplier||'',updated:today(),hist:[]});
  const ms={men:M('冷凍うどん玉',1100,25,'玉',100),dashi:M('いりこ・昆布・かつお節（だし用）',2400,1000,'g',100),usu:M('うすくち醤油',480,1800,'ml',100),mirin:M('みりん',520,1800,'ml',100),
    negi:M('青ねぎ',300,500,'g',85),age:M('味付けきつね揚げ',900,30,'枚',100),ebi:M('えび（天ぷら用）',2200,40,'本',100),ko:M('天ぷら粉',900,2000,'g',100),abura:M('揚げ油',3200,16500,'g',60),
    tama:M('卵',300,10,'個',100),kome:M('米',4200,10000,'g',100),niku:M('牛バラ切り落とし',2200,1000,'g',95),sato:M('砂糖',250,1000,'g',100),cola:M('コーラ 500ml',1500,24,'本',100),
    uji:M('使い捨て箸・おしぼり',1500,500,'個',100)};
  st.mats=Object.values(ms);
  const dashi={id:uid(),name:'かけだし',out:10000,unit:'ml',memo:'1日分の仕込み',lines:[{ref:'m:'+ms.dashi.id,qty:250},{ref:'m:'+ms.usu.id,qty:400},{ref:'m:'+ms.mirin.id,qty:300}]};
  const nikuP={id:uid(),name:'甘辛牛肉（仕込み）',out:1100,unit:'g',memo:'',lines:[{ref:'m:'+ms.niku.id,qty:1000},{ref:'m:'+ms.usu.id,qty:100},{ref:'m:'+ms.sato.id,qty:80},{ref:'m:'+ms.mirin.id,qty:100}]};
  const ten={id:uid(),name:'えび天（1本）',out:1,unit:'本',memo:'衣・油込み',lines:[{ref:'m:'+ms.ebi.id,qty:1},{ref:'m:'+ms.ko.id,qty:20},{ref:'m:'+ms.abura.id,qty:15}]};
  st.preps=[dashi,nikuP,ten];
  const base=[{ref:'m:'+ms.men.id,qty:1},{ref:'p:'+dashi.id,qty:350},{ref:'m:'+ms.negi.id,qty:5},{ref:'m:'+ms.uji.id,qty:1}];
  const N=(name,cat,price,lines,misc,qty,tax)=>({id:uid(),name,cat,price,tax:tax||10,lines,misc:misc||0,qty:qty||0,memo:'',active:true});
  st.menus=[N('かけうどん','うどん',450,base,0,600),N('きつねうどん','うどん',600,[...base,{ref:'m:'+ms.age.id,qty:2}],0,450),
    N('肉うどん','うどん',850,[...base,{ref:'p:'+nikuP.id,qty:60}],0,380),N('えび天うどん','うどん',950,[...base,{ref:'p:'+ten.id,qty:2}],0,300),
    N('月見うどん','うどん',550,[...base,{ref:'m:'+ms.tama.id,qty:1}],0,200),N('えび天（単品）','トッピング',250,[{ref:'p:'+ten.id,qty:1}],0,150),
    N('ご飯（小）','ご飯もの',200,[{ref:'m:'+ms.kome.id,qty:130}],0,250),N('肉ごはん','ご飯もの',550,[{ref:'m:'+ms.kome.id,qty:180},{ref:'p:'+nikuP.id,qty:40}],0,180),
    N('コーラ','ドリンク',250,[{ref:'m:'+ms.cola.id,qty:1}],0,120)];
  return st;}
function sampleBar(){const st=blankStore('Room YOLO');st.target=22;st.round=100;st.cats=['ドリンク','ショット','ボトル','シャンパン','フード'];
  const M=(name,price,size,unit,y)=>({id:uid(),name,price,size,unit,yield:y,taxin:0,supplier:'',updated:today(),hist:[]});
  const ms={kaku:M('角瓶',1500,700,'ml',95),tan:M('炭酸水',100,1000,'ml',100),kori:M('氷',300,1000,'g',80),lemon:M('レモン',60,8,'個',100),teq:M('テキーラ',1800,750,'ml',95),
    beer:M('ビール中瓶',220,1,'本',100),cassis:M('カシスリキュール',1300,700,'ml',95),oj:M('オレンジジュース',250,1000,'ml',100),kyo:M('鏡月 1.8L',1100,1,'本',100),
    moe:M('モエ・エ・シャンドン',6500,1,'本',100),nuts:M('ミックスナッツ',1800,1000,'g',100)};
  st.mats=Object.values(ms);
  const N=(name,cat,price,lines,misc,qty)=>({id:uid(),name,cat,price,tax:10,lines,misc:misc||0,qty:qty||0,memo:'',active:true});
  st.menus=[N('ハイボール','ドリンク',800,[{ref:'m:'+ms.kaku.id,qty:30},{ref:'m:'+ms.tan.id,qty:120},{ref:'m:'+ms.kori.id,qty:150}],5,500),
    N('カシスオレンジ','ドリンク',900,[{ref:'m:'+ms.cassis.id,qty:30},{ref:'m:'+ms.oj.id,qty:120},{ref:'m:'+ms.kori.id,qty:150}],5,300),
    N('ビール','ドリンク',900,[{ref:'m:'+ms.beer.id,qty:1}],5,250),
    N('キャストドリンク','ドリンク',1100,[{ref:'m:'+ms.kaku.id,qty:20},{ref:'m:'+ms.tan.id,qty:100},{ref:'m:'+ms.kori.id,qty:120}],5,900),
    N('テキーラショット','ショット',1100,[{ref:'m:'+ms.teq.id,qty:30},{ref:'m:'+ms.lemon.id,qty:1}],0,400),
    N('鏡月ボトル','ボトル',5500,[{ref:'m:'+ms.kyo.id,qty:1}],300,30),N('モエ・エ・シャンドン','シャンパン',22000,[{ref:'m:'+ms.moe.id,qty:1}],0,8),
    N('ナッツ','フード',700,[{ref:'m:'+ms.nuts.id,qty:40}],10,150)];
  return st;}

/* ---------------- 共通UI ---------------- */
let tt;function toast(m){const el=document.getElementById('toast');el.textContent=m;el.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('on'),2200);}
function sheet(title,body,foot){const w=document.getElementById('sheet');w.innerHTML=`<div class="sheet" role="dialog" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><span class="spacer"></span><button class="icon-btn" data-act="close" aria-label="閉じる">✕</button></header><div class="body">${body}</div>${foot?`<footer>${foot}</footer>`:''}</div>`;w.classList.add('on');document.body.style.overflow='hidden';}
function closeSheet(){const w=document.getElementById('sheet');w.classList.remove('on');w.innerHTML='';document.body.style.overflow='';}
const ICON={home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',menus:'<path d="M4 6h16M4 12h16M4 18h10"/>',mats:'<path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.8h-7A2 2 0 0 1 6.5 19z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',preps:'<path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M8 6c0-1 1-1 1-2M12 6c0-1 1-1 1-2M16 6c0-1 1-1 1-2"/>',sim:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>',compare:'<path d="M6 20V9M12 20V4M18 20v-7"/><circle cx="18" cy="8" r="2"/>'};
const TABS=[['home','ホーム'],['menus','メニュー'],['scan','読取'],['mats','材料'],['compare','比較']];
const TAB_OF={preps:'mats',sim:'menus',settings:''};
function renderTabs(){document.getElementById('tabs').innerHTML=TABS.map(([k,l])=>`<button class="${(TAB_OF[S.view]??S.view)===k?'on':''}${k==='scan'?' scan':''}" data-act="nav" data-v="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>${l}</button>`).join('');}
function render(){
  document.documentElement.dataset.theme=DATA.theme&&DATA.theme!=='auto'?DATA.theme:'';
  if(!DATA.stores.length){document.getElementById('storeBtn').innerHTML='原価ノート';document.getElementById('tabs').innerHTML='';document.getElementById('main').innerHTML=welcome();return;}
  const st=store();DATA.cur=st.id;
  document.getElementById('storeBtn').innerHTML=`${esc(st.name)}`;
  renderTabs();document.getElementById('main').innerHTML=(V[S.view]||V.home)(st);
}
const bar=(st,rate)=>{const t=num(st.target)||30,max=Math.max(60,t*2);return `<div class="bar"><i class="${level(st,rate)}" style="width:${Math.min(100,rate/max*100)}%"></i><b style="left:${t/max*100}%"></b></div>`;};
const rateChip=(st,rate)=>{const l=level(st,rate);return `<span class="chip ${l==='over'?'danger':l==='near'?'warn':'ok'}">${pct(rate)}</span>`;};

/* ---------------- 画面 ---------------- */
const V={};
function welcome(){return `<div class="stack" style="max-width:520px;margin:24px auto 0">
  <div><h1>原価ノート</h1><p class="sub">材料の仕入れ値とレシピから、メニューごとの原価・原価率・粗利・目標の売価を計算します。</p></div>
  <div class="card stack"><h2>はじめかた</h2>
   <button class="btn primary" data-act="addSample" data-k="udon">うどん店の見本で始める</button>
   <button class="btn" data-act="addSample" data-k="bar">バーの見本で始める</button>
   <form data-submit="addStore" class="row"><input class="input" name="name" placeholder="店舗名を入れて空から始める" required><button class="btn">作成</button></form></div>
  <p class="note">データはこの端末のブラウザ内に保存されます。設定 →「バックアップ」で書き出しておくと、機種変更や別端末でも復元できます。</p></div>`;}

V.home=st=>{
  const rows=st.menus.filter(m=>m.active!==false).map(m=>({m,...calc(st,m)}));
  const priced=rows.filter(r=>r.cost>0),avg=priced.length?priced.reduce((a,r)=>a+r.rate,0)/priced.length:0;
  const withQty=rows.filter(r=>num(r.m.qty)>0),sales=withQty.reduce((a,r)=>a+r.ex*num(r.m.qty),0),cost=withQty.reduce((a,r)=>a+r.cost*num(r.m.qty),0);
  const over=priced.filter(r=>level(st,r.rate)==='over').sort((a,b)=>b.rate-a.rate);
  const noCost=rows.filter(r=>!(r.cost>0));
  const old=st.mats.filter(m=>m.updated&&(Date.now()-new Date(m.updated))/864e5>90);
  return `<div class="stack">
  <div class="kpis">
   <div class="card kpi"><div class="l">メニュー平均の原価率</div><div class="v ${avg>st.target?'down':''}">${pct(avg)}<small>目標 ${pct(st.target)}</small></div></div>
   <div class="card kpi"><div class="l">想定の月原価率（販売数で加重）</div><div class="v ${rateOf(cost,sales)>st.target?'down':''}">${sales?pct(rateOf(cost,sales)):'—'}</div></div>
   <div class="card kpi"><div class="l">想定の月粗利（税抜）</div><div class="v">${sales?yen(sales-cost):'—'}</div></div>
   <div class="card kpi"><div class="l">目標超え / 原価未入力</div><div class="v ${over.length?'down':''}">${over.length}<small>品 / ${noCost.length}品</small></div></div></div>
  ${!sales?`<p class="note" style="margin-top:6px">「試算」タブで月の想定販売数を入れると、加重平均の原価率と月の粗利が出ます。</p>`:''}
  <div class="card"><div class="row"><h2>目標の原価率を超えているメニュー</h2></div>
   <div class="list" style="margin-top:4px">${over.map(r=>`<div class="li" data-act="editMenu" data-id="${r.m.id}"><div class="main"><div class="name">${esc(r.m.name)}</div><div class="meta">売価 ${yen(r.m.price)} → 目標にするなら <b>${yen(r.tp)}</b>（税込）</div>${bar(st,r.rate)}</div><div class="val">${rateChip(st,r.rate)}<div class="small sub">原価 ${yen1(r.cost)}</div></div></div>`).join('')||'<div class="empty">すべて目標の原価率以内です 🎉</div>'}</div></div>
  ${old.length?`<div class="card"><h2>3か月以上 仕入れ値を見直していない材料</h2><div class="list">${old.slice(0,8).map(m=>`<div class="li" data-act="editMat" data-id="${m.id}"><div class="main"><div class="name">${esc(m.name)}</div><div class="meta">最終更新 ${esc(m.updated)}</div></div><div class="val">${yen(m.price)}</div></div>`).join('')}</div></div>`:''}
  <div class="card"><h2>計算のしかた</h2>
   <div class="small sub" style="margin-top:6px;line-height:1.9">材料の1単位あたり ＝ 税抜の仕入価格 ÷（内容量 × 歩留まり）<br>メニューの原価 ＝ Σ（1単位あたり × 使う量）＋ その他（容器・おしぼり等）<br>原価率 ＝ 原価 ÷ 税抜売価（税込売価 ÷ 1.1）<br>目標の売価 ＝ 原価 ÷ 目標原価率 × 1.1（${st.round}円単位で切り上げ）</div></div></div>`;
};

V.menus=st=>{
  const q=S.q.trim().toLowerCase(),cats=[...new Set([...st.cats,...st.menus.map(m=>m.cat||'その他')])];
  const list=st.menus.filter(m=>!q||m.name.toLowerCase().includes(q)).filter(m=>!S.cat||(m.cat||'その他')===S.cat);
  const sortBy=S.sort||'order';
  const item=m=>{const r=calc(st,m);return `<div class="li" data-act="editMenu" data-id="${m.id}" style="${m.active===false?'opacity:.5':''}"><div class="main"><div class="name">${esc(m.name)}</div>
    <div class="meta">売価 ${yen(m.price)}・原価 ${r.cost?yen1(r.cost):'未入力'}・粗利 ${r.cost?yen(r.gross):'—'}</div>${r.cost?bar(st,r.rate):''}</div>
    <div class="val">${r.cost?rateChip(st,r.rate):'<span class="chip">—</span>'}${r.cost&&level(st,r.rate)==='over'?`<div class="small down">→ ${yen(r.tp)}</div>`:''}</div></div>`;};
  let body;
  if(sortBy==='rate')body=`<div class="card"><div class="list">${list.slice().sort((a,b)=>calc(st,b).rate-calc(st,a).rate).map(item).join('')||'<div class="empty">メニューがありません</div>'}</div></div>`;
  else if(sortBy==='gross')body=`<div class="card"><div class="list">${list.slice().sort((a,b)=>calc(st,b).gross-calc(st,a).gross).map(item).join('')||'<div class="empty">メニューがありません</div>'}</div></div>`;
  else body=cats.map(c=>{const ms=list.filter(m=>(m.cat||'その他')===c);return ms.length?`<div class="group-title">${esc(c)}<span class="chip">${ms.length}</span></div><div class="card" style="padding:4px 14px">${ms.map(item).join('')}</div>`:'';}).join('')||'<div class="card empty">メニューがありません。「＋ メニュー」から追加してください。</div>';
  return `<div class="seg" style="margin-bottom:10px"><button class="${S.view==='menus'?'on':''}" data-act="nav" data-v="menus">メニュー一覧</button><button class="${S.view==='sim'?'on':''}" data-act="nav" data-v="sim">試算</button></div><div class="row wrap" style="margin-bottom:10px"><h1 style="margin:0">メニュー</h1><span class="spacer"></span><button class="btn primary" data-act="editMenu" data-id="">＋ メニュー</button></div>
   <input class="input search" placeholder="メニューを検索" value="${esc(S.q)}" data-input="q">
   <div class="row wrap" style="margin-bottom:6px"><div class="seg">${[['order','分類順'],['rate','原価率が高い順'],['gross','粗利が大きい順']].map(([k,l])=>`<button class="${sortBy===k?'on':''}" data-act="sort" data-k="${k}">${l}</button>`).join('')}</div>
   <select class="input" style="width:auto;height:38px" data-change="cat"><option value="">すべての分類</option>${cats.map(c=>`<option ${S.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>${body}`;
};

V.mats=st=>{const q=S.q.trim().toLowerCase(),list=st.mats.filter(m=>!q||(m.name+(m.supplier||'')).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  return `<div class="seg" style="margin-bottom:10px"><button class="${S.view==='mats'?'on':''}" data-act="nav" data-v="mats">材料</button><button class="${S.view==='preps'?'on':''}" data-act="nav" data-v="preps">仕込み</button></div><div class="row wrap" style="margin-bottom:10px"><h1 style="margin:0">材料</h1><span class="spacer"></span><button class="btn primary" data-act="editMat" data-id="">＋ 材料</button></div>
   <input class="input search" placeholder="材料・仕入先を検索" value="${esc(S.q)}" data-input="q">
   <div class="card" style="padding:4px 14px"><div class="list">${list.map(m=>{const n=usedBy(st,'m:'+m.id).length;return `<div class="li" data-act="editMat" data-id="${m.id}"><div class="main"><div class="name">${esc(m.name)}</div>
    <div class="meta">${yen(m.price)}${m.taxin?'（税込）':''} / ${fq(m.size)}${esc(m.unit)}${num(m.yield)<100?`・歩留まり${fq(m.yield)}%`:''}${m.supplier?'・'+esc(m.supplier):''}</div></div>
    <div class="val"><b>${yenU(matUnit(m))}</b><span class="small sub">/${esc(m.unit)}</span><div class="small sub">${n?`${n}品で使用`:'未使用'}</div></div></div>`;}).join('')||'<div class="empty">材料がありません。仕入れ伝票を見ながら登録してください。</div>'}</div></div>
   <p class="note">仕入れ値を変えると、その材料を使うメニュー・仕込みの原価がすべて自動で変わります。変更前の値は履歴に残ります。</p>`;
};

V.preps=st=>`<div class="seg" style="margin-bottom:10px"><button class="${S.view==='mats'?'on':''}" data-act="nav" data-v="mats">材料</button><button class="${S.view==='preps'?'on':''}" data-act="nav" data-v="preps">仕込み</button></div><div class="row wrap" style="margin-bottom:10px"><h1 style="margin:0">仕込み</h1><span class="spacer"></span><button class="btn primary" data-act="editPrep" data-id="">＋ 仕込み</button></div>
  <p class="sub small" style="margin:-4px 0 10px">だし・タレ・天ぷらなど、まとめて作ってから使うものを登録します。メニューのレシピで材料と同じように選べます。</p>
  <div class="card" style="padding:4px 14px"><div class="list">${st.preps.map(p=>{const tot=linesCost(st,p.lines),u=num(p.out)?tot/num(p.out):0,n=usedBy(st,'p:'+p.id).length;
   return `<div class="li" data-act="editPrep" data-id="${p.id}"><div class="main"><div class="name">${esc(p.name)}</div><div class="meta">${fq(p.out)}${esc(p.unit)}できる・材料費 ${yen(tot)}${p.memo?'・'+esc(p.memo):''}</div></div><div class="val"><b>${yenU(u)}</b><span class="small sub">/${esc(p.unit)}</span><div class="small sub">${n?`${n}品で使用`:'未使用'}</div></div></div>`;}).join('')||'<div class="empty">仕込みはまだありません（例: かけだし 10L、甘辛牛肉 1.1kg）</div>'}</div></div>`;

V.sim=st=>{const up=S.simUp,rows=st.menus.filter(m=>m.active!==false).map(m=>({m,a:calc(st,m),b:calc(st,m,up)}));
  const sum=(k,x)=>rows.reduce((a,r)=>a+r[x][k]*num(r.m.qty),0),salesA=sum('ex','a'),costA=sum('cost','a'),costB=sum('cost','b');
  return `<div class="seg" style="margin-bottom:10px"><button class="${S.view==='menus'?'on':''}" data-act="nav" data-v="menus">メニュー一覧</button><button class="${S.view==='sim'?'on':''}" data-act="nav" data-v="sim">試算</button></div><h1>試算</h1><p class="sub small" style="margin-top:0">月の想定販売数を入れると、売上・原価・粗利の見込みが出ます。仕入れ値の値上がりの影響も確かめられます。</p>
  <div class="card"><div class="row"><h2>仕入れ値が上がったら</h2><span class="spacer"></span><b class="num" style="font-size:20px" id="upLabel">+${up}%</b></div>
   <input type="range" class="range" min="0" max="50" step="1" value="${up}" data-input="simUpLive" data-change="simUp" style="margin-top:10px" aria-label="仕入れ値の上昇率">
   <div class="kpis" style="margin-top:10px">
    <div class="kpi"><div class="l">月の売上（税抜）</div><div class="v">${yen(salesA)}</div></div>
    <div class="kpi"><div class="l">月の原価</div><div class="v">${yen(costB)}${up?`<small class="down">+${yen(costB-costA)}</small>`:''}</div></div>
    <div class="kpi"><div class="l">月の粗利</div><div class="v">${yen(salesA-costB)}</div></div>
    <div class="kpi"><div class="l">原価率</div><div class="v ${rateOf(costB,salesA)>st.target?'down':''}">${salesA?pct(rateOf(costB,salesA)):'—'}${up&&salesA?`<small>今 ${pct(rateOf(costA,salesA))}</small>`:''}</div></div></div>
   ${up&&salesA?`<p class="note">原価が月 <b>${yen(costB-costA)}</b> 増えます。今と同じ粗利を保つには、平均 <b>${pct((costB-costA)/salesA*100)}</b> の値上げ（売上が同じ数のとき）が必要です。</p>`:''}</div>
  <div class="card" style="margin-top:12px"><h2>メニュー別（数を入れると上の合計に反映）</h2>
   <div class="scroll-x"><table class="t" style="margin-top:6px"><tr><th>メニュー</th><th class="r">月の数</th><th class="r">原価率${up?`（+${up}%）`:''}</th><th class="r">1品の粗利</th><th class="r">月の粗利</th><th class="r">目標の売価</th></tr>
   ${rows.map(r=>`<tr><td>${esc(r.m.name)}<div class="small mute">${yen(r.m.price)}</div></td><td class="r"><input class="input r" style="width:84px;height:36px" type="number" inputmode="numeric" min="0" value="${num(r.m.qty)||''}" placeholder="0" data-change="qty" data-id="${r.m.id}"></td>
    <td class="r num ${level(st,r.b.rate)==='over'?'down':''}">${r.b.cost?pct(r.b.rate):'—'}</td><td class="r num">${r.b.cost?yen(r.b.gross):'—'}</td><td class="r num">${num(r.m.qty)&&r.b.cost?yen(r.b.gross*num(r.m.qty)):'—'}</td><td class="r num sub">${r.b.cost?yen(r.b.tp):'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">メニューがありません</td></tr>'}</table></div>
   <p class="note">粗利・売上は税抜です。目標の売価は税込（目標原価率 ${pct(st.target)}・${st.round}円単位で切り上げ）。</p></div>`;
};

V.settings=st=>`<h1>設定</h1><div class="stack">
  <div class="card"><h2>この店舗</h2><form data-submit="saveStore" class="grid2" style="margin-top:12px">
   <label class="f full">店舗名<input class="input" name="name" value="${esc(st.name)}" required></label>
   <label class="f">目標の原価率（%）<input class="input r" name="target" type="number" min="1" max="95" step="0.5" value="${st.target}"></label>
   <label class="f">目標売価の端数<select class="input" name="round">${[1,10,50,100].map(u=>`<option value="${u}" ${num(st.round)===u?'selected':''}>${u}円単位で切り上げ</option>`).join('')}</select></label>
   <label class="f full">メニューの分類（「、」区切り）<input class="input" name="cats" value="${esc(st.cats.join('、'))}"></label>
   <div class="full row"><span class="spacer"></span><button class="btn primary">保存</button></div></form></div>
  <div class="card"><h2>店舗</h2><div class="list" style="margin-top:4px">${DATA.stores.map(s=>`<div class="li" data-act="switchStore" data-id="${s.id}"><div class="main"><div class="name">${esc(s.name)}</div><div class="meta">メニュー${s.menus.length}・材料${s.mats.length}・仕込み${s.preps.length}</div></div>${s.id===st.id?'<span class="chip accent">表示中</span>':''}</div>`).join('')}</div>
   <form data-submit="addStore" class="row" style="margin-top:10px"><input class="input" name="name" placeholder="新しい店舗名" required><button class="btn">追加</button></form>
   <div class="row wrap" style="margin-top:10px"><button class="btn sm ghost" data-act="addSample" data-k="udon">うどん店の見本を追加</button><button class="btn sm ghost" data-act="addSample" data-k="bar">バーの見本を追加</button></div></div>
  <div class="card"><h2>出力・バックアップ</h2><p class="sub small" style="margin:4px 0 10px">データはこの端末のブラウザ内だけに保存されています。定期的にバックアップを書き出してください。</p>
   <div class="row wrap"><button class="btn" data-act="csv" data-k="menus">メニュー原価表（CSV）</button><button class="btn" data-act="csv" data-k="mats">材料一覧（CSV）</button><button class="btn" data-act="print">印刷・PDF</button></div>
   <div class="row wrap" style="margin-top:8px"><button class="btn" data-act="backup">バックアップを書き出す</button><label class="btn">バックアップから復元<input type="file" accept="application/json,.json" data-change="restore" class="hidden"></label></div></div>
  ${AI.mode==='api'?`<div class="card"><h2>読み取り（Claude）の接続</h2><p class="sub small" style="margin:4px 0 10px">Netlify などで公開したときに使います。サーバー側に API キーの設定が必要です（README 参照）。</p><div class="grid2">
   <label class="f">接続先<input class="input" value="${esc(DATA.apiUrl||'api/read')}" data-change="apiUrl"></label><label class="f">合言葉（サーバーで設定した場合）<input class="input" type="password" value="${esc(DATA.apiPass||'')}" data-change="apiPass" autocomplete="off"></label></div></div>`:''}
  <div class="card"><h2>表示</h2><div class="seg" style="margin-top:8px">${[['auto','自動'],['light','ライト'],['dark','ダーク']].map(([k,l])=>`<button class="${(DATA.theme||'auto')===k?'on':''}" data-act="theme" data-k="${k}">${l}</button>`).join('')}</div></div>
  <div class="card"><h2>削除</h2><div class="row wrap" style="margin-top:8px"><button class="btn danger" data-act="delStore">この店舗を削除</button></div></div></div>`;

/* ---------------- 編集シート ---------------- */
function refOptions(st,sel,excludePrep){
  const o=(v,l)=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`;
  return `<option value="">— 選ぶ —</option><optgroup label="材料">${st.mats.slice().sort((a,b)=>a.name.localeCompare(b.name,'ja')).map(m=>o('m:'+m.id,`${esc(m.name)}（${esc(m.unit)}）`)).join('')}</optgroup>`+
    (st.preps.filter(p=>p.id!==excludePrep).length?`<optgroup label="仕込み">${st.preps.filter(p=>p.id!==excludePrep).map(p=>o('p:'+p.id,`${esc(p.name)}（${esc(p.unit)}）`)).join('')}</optgroup>`:'');}
function lineRows(st,lines,excludePrep){const ls=(lines||[]).concat([{},{}]);
  return `<div id="lines">${ls.map(l=>lineRow(st,l,excludePrep)).join('')}</div><button type="button" class="btn sm ghost" data-act="addLine" data-x="${excludePrep||''}">＋ 行を追加</button>`;}
const lineRow=(st,l,ex)=>`<div class="line-row"><select class="input" name="ref" style="height:40px">${refOptions(st,l.ref,ex)}</select><input class="input r" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${l.qty??''}" placeholder="使う量"><span class="c"></span><button type="button" class="x" data-act="delLine" aria-label="行を削除">×</button></div>`;
function readLines(form){return [...form.querySelectorAll('.line-row')].map(r=>({ref:r.querySelector('[name=ref]').value,qty:num(r.querySelector('[name=qty]').value)})).filter(l=>l.ref&&l.qty>0);}
function paintLines(st,form){form.querySelectorAll('.line-row').forEach(row=>{const ref=row.querySelector('[name=ref]').value,q=num(row.querySelector('[name=qty]').value),inf=refInfo(st,ref);
  row.querySelector('[name=qty]').placeholder=inf?`量（${inf.unit}）`:'使う量';row.querySelector('.c').innerHTML=inf?`<span class="u">${esc(inf.unit)}</span>${q?' '+yen1(refUnit(st,ref)*q):''}`:'';});}

function editMenu(id){const st=store(),m=id?st.menus.find(x=>x.id===id):{name:'',cat:S.cat||st.cats[0]||'',price:'',tax:10,lines:[],misc:'',qty:'',memo:'',active:true};if(!m)return;
  sheet(m.id?'メニューを編集':'メニューを追加',`<form id="f" data-submit="saveMenu" data-input="menuCalc" data-change="menuCalc"><input type="hidden" name="id" value="${m.id||''}">
   <div class="grid2"><label class="f full">メニュー名<input class="input" name="name" value="${esc(m.name)}" required placeholder="例: 肉うどん"></label>
   <label class="f">分類<input class="input" name="cat" value="${esc(m.cat||'')}" list="catList"><datalist id="catList">${st.cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
   <label class="f">売価（税込・円）<input class="input r" name="price" type="number" inputmode="numeric" min="0" value="${m.price}" required></label>
   <label class="f">消費税<select class="input" name="tax"><option value="10" ${num(m.tax)!==8?'selected':''}>10%（店内）</option><option value="8" ${num(m.tax)===8?'selected':''}>8%（持ち帰り）</option></select></label>
   <label class="f">月の想定販売数<input class="input r" name="mqty" type="number" inputmode="numeric" min="0" value="${m.qty||''}" placeholder="試算用"></label></div>
   <h3>レシピ（1人前に使う量）</h3>${lineRows(st,m.lines)}
   <label class="f" style="margin-top:10px">その他（容器・箸・おしぼり・調味料の目安・円）<input class="input r" name="misc" type="number" inputmode="decimal" min="0" step="any" value="${m.misc||''}" placeholder="0"></label>
   <div class="result" id="res"></div>
   <label class="f" style="margin-top:12px">メモ<textarea class="input" name="memo" placeholder="盛り付け・作り方のポイントなど">${esc(m.memo||'')}</textarea></label>
   <label class="row small sub" style="margin-top:10px"><input type="checkbox" name="active" ${m.active!==false?'checked':''}> 販売中（外すと集計から除外）</label></form>`,
   `${m.id?`<button class="btn danger" data-act="delMenu" data-id="${m.id}">削除</button><button class="btn ghost" data-act="dupMenu" data-id="${m.id}">複製</button>`:''}<span class="spacer"></span><button class="btn primary" data-act="submit">保存</button>`);
  menuCalc();}
function menuCalc(){const st=store(),f=document.getElementById('f');if(!f)return;paintLines(st,f);
  const m={price:num(f.price.value),tax:num(f.tax.value),lines:readLines(f),misc:num(f.misc.value)},r=calc(st,m),l=level(st,r.rate);
  document.getElementById('res').innerHTML=`<div class="tot"><span>原価</span><b>${yen1(r.cost)}</b></div><div class="tot"><span>税抜売価</span><span>${yen1(r.ex)}</span></div>
   <div class="tot"><span>原価率</span><span class="${l==='over'?'down':''}">${r.cost?pct(r.rate):'—'}（目標 ${pct(st.target)}）</span></div>${r.cost?bar(st,r.rate):''}
   <div class="tot big"><span>1品の粗利（税抜）</span><span>${yen(r.gross)}</span></div>
   ${r.cost?`<div class="tot"><span>目標の原価率になる売価（税込）</span><b class="${l==='over'?'down':''}">${yen(r.tp)}</b></div>`:''}`;}

function editMat(id){const st=store(),m=id?st.mats.find(x=>x.id===id):{name:'',price:'',size:'',unit:'g',yield:100,taxin:0,supplier:''};if(!m)return;
  const used=m.id?usedBy(st,'m:'+m.id):[];
  sheet(m.id?'材料を編集':'材料を追加',`<form id="f" data-submit="saveMat" data-input="matCalc" data-change="matCalc"><input type="hidden" name="id" value="${m.id||''}">
   <div class="grid2"><label class="f full">材料名<input class="input" name="name" value="${esc(m.name)}" required placeholder="例: 冷凍うどん玉"></label>
   <label class="f">仕入価格（円）<input class="input r" name="price" type="number" inputmode="decimal" min="0" step="any" value="${m.price}" required></label>
   <label class="f">価格の税<select class="input" name="taxin"><option value="0" ${!num(m.taxin)?'selected':''}>税抜</option><option value="8" ${num(m.taxin)===8?'selected':''}>税込（8%・食品）</option><option value="10" ${num(m.taxin)===10?'selected':''}>税込（10%・酒・資材）</option></select></label>
   <label class="f">内容量<input class="input r" name="size" type="number" inputmode="decimal" min="0" step="any" value="${m.size}" required placeholder="例: 25"></label>
   <label class="f">単位<select class="input" name="unit">${UNITS.concat(UNITS.includes(m.unit)?[]:[m.unit]).map(u=>`<option ${m.unit===u?'selected':''}>${esc(u)}</option>`).join('')}</select></label>
   <label class="f">歩留まり（%）<input class="input r" name="yield" type="number" inputmode="decimal" min="1" max="100" step="any" value="${m.yield||100}"></label>
   <label class="f">仕入先<input class="input" name="supplier" value="${esc(m.supplier||'')}" placeholder="任意"></label></div>
   <div class="result" id="res"></div>
   <p class="note">歩留まり ＝ 使える部分の割合。ねぎの根・野菜の皮、揚げ油の吸油・廃棄、ボトルの注ぎ残しなどのロスを引きます（目安: 野菜80〜90%、油50〜70%、酒95%）。</p>
   ${m.hist&&m.hist.length?`<h3>仕入れ値の履歴</h3><div class="list">${m.hist.slice().reverse().map(h=>`<div class="li" style="cursor:default"><span class="main small">${esc(h.d)}</span><span class="num">${yen(h.price)}</span></div>`).join('')}</div>`:''}
   ${m.id?matPricesHtml(st,m):''}
   ${used.length?`<h3>この材料を使っているもの（${used.length}）</h3><p class="small sub">${used.map(x=>esc(x.name)).join('、')}</p>`:''}</form>`,
   `${m.id?`<button class="btn danger" data-act="delMat" data-id="${m.id}">削除</button>`:''}<span class="spacer"></span><button class="btn primary" data-act="submit">保存</button>`);
  matCalc();}
function matCalc(){const f=document.getElementById('f');if(!f)return;const m={price:f.price.value,taxin:num(f.taxin.value),size:f.size.value,yield:f.yield.value,unit:f.unit.value},u=matUnit(m);
  document.getElementById('res').innerHTML=u?`<div class="tot"><span>1${esc(m.unit)}あたり</span><b>${yenU(u)}</b></div><div class="small mute">${m.taxin?`税抜 ${yen1(matEx(m))} ÷`:`${yen(m.price)} ÷`}（${fq(m.size)}${esc(m.unit)} × ${fq(num(m.yield)||100)}%）</div>`:'<span class="small mute">価格と内容量を入れると1単位あたりの単価が出ます</span>';}

function editPrep(id){const st=store(),p=id?st.preps.find(x=>x.id===id):{name:'',out:'',unit:'ml',lines:[],memo:''};if(!p)return;
  sheet(p.id?'仕込みを編集':'仕込みを追加',`<form id="f" data-submit="savePrep" data-input="prepCalc" data-change="prepCalc"><input type="hidden" name="id" value="${p.id||''}">
   <div class="grid2"><label class="f full">名前<input class="input" name="name" value="${esc(p.name)}" required placeholder="例: かけだし"></label>
   <label class="f">できあがり量<input class="input r" name="out" type="number" inputmode="decimal" min="0" step="any" value="${p.out}" required placeholder="例: 10000"></label>
   <label class="f">単位<select class="input" name="unit">${UNITS.concat(UNITS.includes(p.unit)?[]:[p.unit]).map(u=>`<option ${p.unit===u?'selected':''}>${esc(u)}</option>`).join('')}</select></label></div>
   <h3>使う材料（1回の仕込み分）</h3>${lineRows(st,p.lines,p.id||'_new')}
   <div class="result" id="res"></div>
   <label class="f" style="margin-top:12px">メモ<textarea class="input" name="memo">${esc(p.memo||'')}</textarea></label></form>`,
   `${p.id?`<button class="btn danger" data-act="delPrep" data-id="${p.id}">削除</button>`:''}<span class="spacer"></span><button class="btn primary" data-act="submit">保存</button>`);
  prepCalc();}
function prepCalc(){const st=store(),f=document.getElementById('f');if(!f)return;paintLines(st,f);const tot=linesCost(st,readLines(f)),out=num(f.out.value);
  document.getElementById('res').innerHTML=`<div class="tot"><span>材料費の合計</span><b>${yen1(tot)}</b></div><div class="tot"><span>1${esc(f.unit.value)}あたり</span><b>${out?yenU(tot/out):'—'}</b></div>`;}

/* ---------------- CSV ---------------- */
function downloadText(name,text,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);}
function csv(name,head,rows){const q=v=>{v=v==null?'':String(v);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};downloadText(name+'.csv','﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
const r1=n=>Math.round(n*10)/10;

/* ---------------- イベント ---------------- */
const ACT={
  nav(d){S.view=d.v;S.q='';window.scrollTo(0,0);render();},
  close:closeSheet,
  submit(){const f=document.getElementById('f');if(f.reportValidity())f.requestSubmit();},
  sort(d){S.sort=d.k;render();},
  storeMenu(){if(!DATA.stores.length)return;sheet('店舗を切り替え',`<div class="list">${DATA.stores.map(s=>`<div class="li" data-act="switchStore" data-id="${s.id}"><div class="main"><div class="name">${esc(s.name)}</div><div class="meta">メニュー${s.menus.length}・材料${s.mats.length}</div></div>${s.id===store().id?'<span class="chip accent">表示中</span>':''}</div>`).join('')}</div>
    <p class="note">店舗の追加は 設定 から行います。</p>`);},
  switchStore(d){DATA.cur=d.id;persist();closeSheet();S.cat='';render();toast(`${store().name} に切り替えました`);},
  addSample(d){const st=d.k==='bar'?sampleBar():sampleUdon();samplePrices(st);DATA.stores.push(st);DATA.cur=st.id;persist();S.view='home';render();toast(`見本「${st.name}」を追加しました`);},
  editMenu(d){editMenu(d.id);},editMat(d){editMat(d.id);},editPrep(d){editPrep(d.id);},
  addLine(d){document.getElementById('lines').insertAdjacentHTML('beforeend',lineRow(store(),{},d.x||''));},
  delLine(d,el){const f=el.closest('form');el.closest('.line-row').remove();(f.dataset.submit==='saveMenu'?menuCalc:prepCalc)();},
  delMenu(d){if(!confirm('このメニューを削除しますか？'))return;const st=store();st.menus=st.menus.filter(m=>m.id!==d.id);persist();closeSheet();render();toast('削除しました');},
  dupMenu(d){const st=store(),m=st.menus.find(x=>x.id===d.id);const c={...JSON.parse(JSON.stringify(m)),id:uid(),name:m.name+'（コピー）'};st.menus.push(c);persist();render();editMenu(c.id);toast('複製しました');},
  delMat(d){const st=store(),used=usedBy(st,'m:'+d.id);if(!confirm(used.length?`この材料は ${used.length} 件のレシピで使われています。削除するとその分の原価が0になります。削除しますか？`:'この材料を削除しますか？'))return;
    st.mats=st.mats.filter(m=>m.id!==d.id);st.prices=prices(st).filter(p=>p.mat!==d.id);[...st.menus,...st.preps].forEach(x=>x.lines=(x.lines||[]).filter(l=>l.ref!=='m:'+d.id));persist();closeSheet();render();toast('削除しました');},
  delPrep(d){const st=store(),used=usedBy(st,'p:'+d.id);if(!confirm(used.length?`この仕込みは ${used.length} 件のレシピで使われています。削除しますか？`:'この仕込みを削除しますか？'))return;
    st.preps=st.preps.filter(p=>p.id!==d.id);[...st.menus,...st.preps].forEach(x=>x.lines=(x.lines||[]).filter(l=>l.ref!=='p:'+d.id));persist();closeSheet();render();toast('削除しました');},
  delStore(){const st=store();if(!confirm(`「${st.name}」のメニュー・材料・仕込みをすべて削除します。元に戻せません。削除しますか？`))return;DATA.stores=DATA.stores.filter(s=>s.id!==st.id);DATA.cur=DATA.stores[0]?.id||null;persist();S.view='home';render();toast('店舗を削除しました');},
  theme(d){DATA.theme=d.k;persist();render();},
  print(){window.print();},
  csv(d){const st=store();
    if(d.k==='menus')csv(`メニュー原価_${st.name}_${today()}`,['分類','メニュー','売価(税込)','税率','税抜売価','原価','原価率(%)','粗利(税抜)','目標の売価(税込)','月の想定数','レシピ'],
      st.menus.map(m=>{const r=calc(st,m);return [m.cat,m.name,m.price,m.tax,r1(r.ex),r1(r.cost),r1(r.rate),Math.round(r.gross),r.tp,m.qty||'',(m.lines||[]).map(l=>{const i=refInfo(st,l.ref);return i?`${i.name} ${l.qty}${i.unit}`:'';}).filter(Boolean).join(' / ')+(num(m.misc)?` / その他 ${m.misc}円`:'')];}));
    else csv(`材料_${st.name}_${today()}`,['材料','仕入価格','税','内容量','単位','歩留まり(%)','1単位あたり(税抜)','仕入先','更新日'],st.mats.map(m=>[m.name,m.price,m.taxin?`税込${m.taxin}%`:'税抜',m.size,m.unit,m.yield,Math.round(matUnit(m)*1000)/1000,m.supplier||'',m.updated||'']));},
  backup(){downloadText(`原価ノート_バックアップ_${today()}.json`,JSON.stringify(DATA,null,1),'application/json');toast('バックアップを書き出しました');}
};
const SUB={
  addStore(f){const st=blankStore(f.name.trim());DATA.stores.push(st);DATA.cur=st.id;persist();S.view='home';render();toast(`「${st.name}」を作成しました。材料から登録しましょう`);},
  saveStore(f){const st=store();Object.assign(st,{name:f.name.trim(),target:num(f.target)||30,round:num(f.round)||10,cats:String(f.cats).split(/[,、]/).map(s=>s.trim()).filter(Boolean)});persist();render();toast('保存しました');},
  saveMenu(f,form){const st=store(),old=st.menus.find(m=>m.id===f.id),m={...(old||{}),id:f.id||uid(),name:f.name.trim(),cat:(f.cat||'').trim()||'その他',price:num(f.price),tax:num(f.tax)||10,qty:num(f.mqty),misc:num(f.misc),memo:f.memo||'',active:!!f.active,lines:readLines(form)};
    if(old)Object.assign(old,m);else st.menus.push(m);if(m.cat&&!st.cats.includes(m.cat))st.cats.push(m.cat);persist();closeSheet();render();const r=calc(st,m);toast(r.cost?`保存しました（原価率 ${pct(r.rate)}）`:'保存しました');},
  saveMat(f){const st=store(),old=st.mats.find(m=>m.id===f.id),price=num(f.price);
    const m={...(old||{hist:[]}),id:f.id||uid(),name:f.name.trim(),price,taxin:num(f.taxin),size:num(f.size),unit:f.unit,yield:Math.min(100,Math.max(1,num(f.yield)||100)),supplier:(f.supplier||'').trim(),updated:today()};
    if(!(m.size>0)){toast('内容量を入れてください');return;}
    if(old&&num(old.price)!==price)m.hist=[...(old.hist||[]),{d:old.updated||'',price:num(old.price)}].slice(-20);
    const changed=old&&num(old.price)!==price;if(old)Object.assign(old,m);else st.mats.push(m);persist();closeSheet();render();
    const n=usedBy(st,'m:'+m.id).length;toast(changed&&n?`仕入れ値を更新しました（${n}件のレシピに反映）`:'保存しました');},
  savePrep(f,form){const st=store(),old=st.preps.find(p=>p.id===f.id),p={...(old||{}),id:f.id||uid(),name:f.name.trim(),out:num(f.out),unit:f.unit,memo:f.memo||'',lines:readLines(form)};
    if(!(p.out>0)){toast('できあがり量を入れてください');return;}
    if(old)Object.assign(old,p);else st.preps.push(p);persist();closeSheet();render();toast('保存しました');}
};
const INP={q(v){S.q=v;const pos=document.activeElement.selectionStart;render();const el=document.querySelector('[data-input=q]');if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(e){}}},
  simUpLive(v){const el=document.getElementById('upLabel');if(el)el.textContent='+'+num(v)+'%';},menuCalc,matCalc,prepCalc};
const CHG={cat(v){S.cat=v;render();},simUp(v){S.simUp=num(v);render();},qty(v,el){const m=store().menus.find(x=>x.id===el.dataset.id);if(m){m.qty=num(v);persist();render();}},menuCalc,matCalc,prepCalc,
  restore(v,el){const file=el.files[0];if(!file)return;const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(!d.stores||!Array.isArray(d.stores))throw 0;
    if(!confirm(`バックアップ（${d.stores.length}店舗）で今のデータを置き換えます。よろしいですか？`))return;DATA=d;persist();S.view='home';render();toast('復元しました');}catch(e){toast('バックアップファイルを読み込めませんでした');}};rd.readAsText(file);}};

document.addEventListener('click',e=>{if(e.target.id==='sheet'){closeSheet();return;}const el=e.target.closest('[data-act]');if(!el)return;const fn=ACT[el.dataset.act];if(fn){e.preventDefault();fn(el.dataset,el,e);}});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-submit]');if(!f)return;e.preventDefault();const fn=SUB[f.dataset.submit];if(fn)fn(Object.fromEntries(new FormData(f)),f);});
// フォーム全体に付けた data-input / data-change は、中の入力が変わるたびに呼ぶ
document.addEventListener('compositionend',e=>e.target.dispatchEvent(new Event('input',{bubbles:true})));
document.addEventListener('input',e=>{if(e.isComposing)return;const el=e.target.closest('[data-input]');if(!el)return;const fn=INP[el.dataset.input];if(fn)fn(e.target.value,e.target);});
document.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(!el)return;const fn=CHG[el.dataset.change];if(fn)fn(e.target.value,e.target);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});
/* ================= 読み取り（レシート・納品書・値札）とスーパー比較 ================= */
// 量の換算: 材料の単位にそろえる（kg→g、L→ml）。換算できないときは null
const UNIT_BASE={g:['g',1],kg:['g',1000],mg:['g',0.001],ml:['ml',1],cc:['ml',1],L:['ml',1000],l:['ml',1000]};
function conv(q,from,to){q=num(q);if(!from||!to)return null;if(from===to)return q;const a=UNIT_BASE[from],b=UNIT_BASE[to];return a&&b&&a[0]===b[0]?q*a[1]/b[1]:null;}
const shops=()=>DATA.shops||(DATA.shops=[]);
const shopName=id=>(shops().find(s=>s.id===id)||{}).name||'（店不明）';
const prices=st=>st.prices||(st.prices=[]);
// 仕入れ記録1件の、材料の単位あたり税抜価格（歩留まりは含めない＝店どうしの比較用）
function obsUnit(o,m){const sz=conv(o.size,o.unit,m.unit);if(!(sz>0))return null;return num(o.price)/(o.taxin?1+num(o.taxin)/100:1)/sz;}
const matBuyUnit=m=>{const s=num(m.size);return s>0?matEx(m)/s:0;};
const ageDays=d=>d?Math.floor((Date.now()-new Date(d))/864e5):9999;
// 店ごとの最新の価格（材料ごと）
function latestByShop(st,m){const o={};prices(st).filter(p=>p.mat===m.id&&p.shop).forEach(p=>{const u=obsUnit(p,m);if(u==null)return;if(!o[p.shop]||(p.date||'')>=(o[p.shop].date||''))o[p.shop]={...p,u};});return Object.values(o).sort((a,b)=>a.u-b.u);}
// 月の想定販売数から、材料ごとの月の仕入れ量（材料の単位、歩留まりのロス込み）
function monthlyUsage(st){const use={};
  const add=(ref,amt,depth)=>{if(!ref||!(amt>0)||depth>6)return;const [k,id]=ref.split(':');
    if(k==='m'){const m=st.mats.find(x=>x.id===id);if(m)use[id]=(use[id]||0)+amt/((num(m.yield)||100)/100);}
    else{const p=st.preps.find(x=>x.id===id);if(p&&num(p.out)>0)(p.lines||[]).forEach(l=>add(l.ref,amt/num(p.out)*num(l.qty),depth+1));}};
  st.menus.filter(m=>m.active!==false&&num(m.qty)>0).forEach(m=>(m.lines||[]).forEach(l=>add(l.ref,num(l.qty)*num(m.qty),0)));return use;}
// 比較の集計: 材料ごとの最安店・今の単価との差・月の差額、店ごとの価格指数
function compareData(st){const use=monthlyUsage(st),rows=[],shopAgg={};
  st.mats.forEach(m=>{const ls=latestByShop(st,m);if(!ls.length)return;const best=ls[0],cur=matBuyUnit(m),u=use[m.id]||0;
    const save=cur>best.u?(cur-best.u)*u:0;rows.push({m,ls,best,cur,use:u,save});
    if(ls.length>1)ls.forEach(p=>{const a=shopAgg[p.shop]=shopAgg[p.shop]||{shop:p.shop,n:0,ratio:0,wins:0,cost:0,bestCost:0};a.n++;a.ratio+=p.u/best.u;if(p===best)a.wins++;a.cost+=p.u*u;a.bestCost+=best.u*u;});});
  const ranking=Object.values(shopAgg).map(a=>({...a,index:a.ratio/a.n*100})).sort((a,b)=>a.index-b.index||b.n-a.n);
  const plan={};rows.filter(r=>r.ls.length>1||r.save>0).forEach(r=>{(plan[r.best.shop]=plan[r.best.shop]||[]).push(r);});
  return {rows,ranking,plan,save:rows.reduce((a,r)=>a+r.save,0),compared:rows.filter(r=>r.ls.length>1).length};}

/* ---------- AI（Claude）呼び出し ---------- */
// claude.ai のページでは閲覧者の Claude（sample）、Netlify などでは /api/read（サーバー側の API キー）を使う
const AI={mode:null,sample:null,images:false};
async function aiInit(){
  if(window.claude&&window.claude.use){try{const s=await window.claude.use('sample');if(s){AI.sample=s;const lim=await s.limits().catch(()=>null);AI.images=!!(lim&&lim.images);AI.mode='sample';}else AI.mode='none';}catch(e){AI.mode='none';}}
  else AI.mode=location.protocol.startsWith('http')?'api':'none';
  if(S.view==='scan'||S.view==='compare')render();}
async function aiJSON(prompt,blobs,signal){
  if(AI.mode==='sample'){if(blobs.length&&!AI.images)throw {code:'images_unavailable'};
    return AI.sample.json(prompt,{images:blobs.length?blobs:undefined,signal,cache:false});}
  if(AI.mode==='api'){const images=await Promise.all(blobs.map(async b=>({media_type:'image/jpeg',data:await b64(b)})));
    const r=await fetch(DATA.apiUrl||'api/read',{method:'POST',signal,headers:{'content-type':'application/json','x-app-pass':DATA.apiPass||''},body:JSON.stringify({prompt,images})});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw {code:j.error||'http_'+r.status,message:j.message||''};return parseJSON(j.text||'');}
  throw {code:'unavailable'};}
function parseJSON(t){try{return JSON.parse(t);}catch(e){}const f=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(f)try{return JSON.parse(f[1]);}catch(e){}
  const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)try{return JSON.parse(t.slice(a,b+1));}catch(e){}throw {code:'invalid_json'};}
const b64=blob=>new Promise((ok,ng)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=ng;r.readAsDataURL(blob);});
const AI_ERR={not_granted:'Claude の利用が許可されませんでした。もう一度「読み取る」を押すと確認が出ます（ページを開き直してください）。',sampling_disabled:'このアカウントでは Claude を呼び出せません。',
  rate_limited:'混み合っています。少し待ってからもう一度お試しください。',image_rejected:'この画像は読み取れません。別の写真でお試しください。',images_unavailable:'この画面では画像を送れません。',
  invalid_json:'読み取り結果を整理できませんでした。もう一度お試しください。',refused:'この画像は読み取れませんでした。',passcode:'合言葉が違います（設定 → 読み取り）。',
  no_api_key:'サーバーに Claude の API キーが設定されていません（README の「読み取りの設定」を参照）。',unavailable:'読み取り機能がこの環境では使えません。',cancelled:''};
const aiErr=e=>AI_ERR[e&&e.code]??('読み取りに失敗しました'+(e&&e.code?`（${e.code}）`:'')+'。通信状況を確認して、もう一度お試しください。');

/* ---------- 画像・PDF の準備 ---------- */
// 長い辺を 1600px に縮めて JPEG にする（文字が読める大きさで、送る量を抑える）
async function toJpeg(src){const img=src instanceof HTMLCanvasElement?src:await new Promise((ok,ng)=>{const u=URL.createObjectURL(src),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i);};i.onerror=()=>{URL.revokeObjectURL(u);ng(new Error('画像を開けません'));};i.src=u;});
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,k=Math.min(1,1600/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);return new Promise(ok=>c.toBlob(ok,'image/jpeg',.85));}
let pdfjs=null;
async function loadPdfjs(){if(pdfjs)return pdfjs;const base='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  await new Promise((ok,ng)=>{const s=document.createElement('script');s.src=base+'pdf.min.js';s.onload=ok;s.onerror=()=>ng(new Error('PDFの読み込み部品を取得できません'));document.head.appendChild(s);});
  pdfjs=window.pdfjsLib;pdfjs.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.js';return pdfjs;}
// PDF は先頭 4 ページまでを画像にする
async function pdfToJpegs(file){const lib=await loadPdfjs(),doc=await lib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
  for(let i=1;i<=Math.min(doc.numPages,4);i++){const pg=await doc.getPage(i),vp0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:Math.min(3,1600/Math.max(vp0.width,vp0.height))}),c=document.createElement('canvas');
    c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push(await toJpeg(c));}return out;}

/* ---------- 読み取り画面 ---------- */
const SCAN={files:[],busy:false,ctl:null,err:''};
function scanPrompt(st){return `あなたは飲食店の仕入れ記録をつける係です。添付の画像は、レシート・納品書・請求書・スーパーの値札（棚札）のどれかです。複数枚あるときは同じ書類の続きです。
書かれている内容を読み取り、次の形のJSONだけを返してください。説明文は不要です。
{"doc_type":"receipt|delivery|invoice|price_tag|other","shop":"店名・仕入先（チェーン名＋店舗名。なければ空文字）","date":"YYYY-MM-DD（不明なら空文字）","tax":"included|excluded|unknown",
 "items":[{"name":"商品名（略称は分かる範囲で一般的な名前に）","qty":購入個数(数値。値札なら1),"size":1個あたりの内容量(数値。不明なら null),"unit":"g|ml|個|本|枚|玉|袋|パック など size の単位","price":その行の支払金額(数値。値引き後・個数分),"tax_rate":8 または 10,"match":"下の材料リストのうち同じ物の名前（なければ空文字）","note":"特売・値引き・見切りなど（なければ空文字）"}]}
ルール:
- 合計・小計・消費税・ポイント・レジ袋・預り金・お釣りの行は items に入れない
- 値引きの行は直前の商品の price から引いて反映する
- 内容量は商品名などから読み取り、kg は g に、L は ml に換算する（例: 1.8L → 1800 ml、2kg → 2000 g）。卵10個入りなら size 10・unit 個
- 軽減税率（※・☆などの印、食品）は tax_rate 8、酒類・日用品は 10
- tax は価格が税込表示なら included、税抜なら excluded
- 読めない数字は推測せず null にする
材料リスト: ${st.mats.map(m=>m.name).join('、')||'（なし）'}`;}

V.scan=st=>{const ready=AI.mode==='sample'?AI.images:AI.mode==='api';
  return `<h1>読み取り</h1><p class="sub small" style="margin-top:0">レシート・納品書・値札の写真や PDF から、仕入れ値を記録します。読み取った内容は保存前に確認・修正できます。</p>
  <div class="card stack">
   <label class="drop" id="drop"><input type="file" accept="image/*,application/pdf" multiple data-change="scanFiles" class="hidden">
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
    <b>写真を撮る・ファイルを選ぶ</b><span class="small sub">レシート／納品書／値札（JPEG・PNG・PDF、複数枚OK）</span></label>
   ${SCAN.files.length?`<div class="thumbs">${SCAN.files.map((f,i)=>`<div class="thumb">${f.type==='application/pdf'?`<span class="pdf">PDF</span><small>${esc(f.name)}</small>`:`<img src="${f.url}" alt="">`}<button class="x" data-act="scanRemove" data-i="${i}" aria-label="外す">×</button></div>`).join('')}</div>`:''}
   ${SCAN.err?`<p class="small down">${esc(SCAN.err)}</p>`:''}
   <div class="row">${SCAN.busy?`<span class="spin"></span><span class="sub">読み取り中…（10〜60秒ほど）</span><span class="spacer"></span><button class="btn" data-act="scanStop">中止</button>`:
    `<span class="spacer"></span><button class="btn primary" data-act="scanRun" ${SCAN.files.length&&ready?'':'disabled'}>読み取る</button>`}</div>
   ${!ready?`<p class="note">${AI.mode===null?'読み取り機能を準備しています…':AI.mode==='sample'?'この画面では画像を Claude に送れません。':'読み取り機能を使うには設定が必要です（README の「読み取りの設定」）。手入力は 材料 の各画面から行えます。'}</p>`:''}
  </div>
  <div class="card" style="margin-top:12px"><div class="row"><h2>最近の仕入れ記録</h2><span class="spacer"></span><button class="btn sm ghost" data-act="nav" data-v="compare">比較を見る</button></div>
   <div class="list">${prices(st).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0)).slice(0,12).map(p=>{const m=st.mats.find(x=>x.id===p.mat);return `<div class="li" data-act="editMat" data-id="${p.mat}"><div class="main"><div class="name">${esc(m?m.name:'（削除した材料）')}</div><div class="meta">${esc(shopName(p.shop))}・${esc(p.date||'日付なし')}・${fq(p.size)}${esc(p.unit)}${p.src==='scan'?'・読取':''}</div></div><div class="val"><b>${yen(p.price)}</b><div class="small sub">${p.taxin?'税込':'税抜'}</div></div></div>`;}).join('')||'<div class="empty">まだ記録がありません</div>'}</div></div>`;};

// 読み取り結果の確認シート
let REVIEW=null;
function openReview(st,res){const its=Array.isArray(res.items)?res.items:[];
  const findShop=n=>{n=String(n||'').trim();if(!n)return '';const s=shops().find(x=>x.name===n||n.includes(x.name)||x.name.includes(n));return s?s.id:'';};
  const findMat=(n,name)=>{const t=String(n||name||'').trim();if(!t)return '';const m=st.mats.find(x=>x.name===t)||st.mats.find(x=>t.includes(x.name)||x.name.includes(t));return m?m.id:'';};
  const taxin=res.tax==='excluded'?0:null;
  REVIEW={shop:findShop(res.shop),shopNew:findShop(res.shop)?'':String(res.shop||''),date:/^\d{4}-\d{2}-\d{2}$/.test(res.date||'')?res.date:today(),doc:res.doc_type||'',
    rows:its.filter(x=>x&&x.name).map(x=>{const qty=num(x.qty)||1,size=x.size==null?null:num(x.size),mat=findMat(x.match,x.name),m=st.mats.find(y=>y.id===mat);
      // 値札・レシートの金額は「個数分」なので、1個あたりにする
      const unitPrice=Math.round(num(x.price)/qty*100)/100,tr=num(x.tax_rate)===8?8:num(x.tax_rate)===10?10:8;
      return {on:num(x.price)>0,name:String(x.name),mat:mat||'',size:size||(m?num(m.size):''),unit:String(x.unit||'')||(m?m.unit:'個'),price:unitPrice,taxin:taxin===0?0:tr,note:String(x.note||''),apply:true};})};
  renderReview();}
function reviewRowHtml(st,r,i){const m=st.mats.find(x=>x.id===r.mat),o={price:r.price,taxin:r.taxin,size:r.size,unit:r.unit},u=m?obsUnit(o,m):null,cur=m?matBuyUnit(m):0;
  return `<div class="rv ${r.on?'':'off'}" data-i="${i}">
   <div class="row"><label class="row" style="gap:6px;flex:1;min-width:0"><input type="checkbox" data-rv="on" ${r.on?'checked':''}><b class="ell">${esc(r.name)}</b></label>${r.note?`<span class="chip warn">${esc(r.note)}</span>`:''}</div>
   <div class="rv-grid">
    <select class="input" data-rv="mat"><option value="">＋ 新しい材料として登録</option>${st.mats.slice().sort((a,b)=>a.name.localeCompare(b.name,'ja')).map(x=>`<option value="${x.id}" ${x.id===r.mat?'selected':''}>${esc(x.name)}（${esc(x.unit)}）</option>`).join('')}</select>
    <div class="row" style="gap:4px"><input class="input r" type="number" step="any" min="0" data-rv="size" value="${r.size??''}" placeholder="内容量"><select class="input" data-rv="unit" style="width:84px">${UNITS.concat(UNITS.includes(r.unit)?[]:[r.unit]).map(x=>`<option ${x===r.unit?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="row" style="gap:4px"><input class="input r" type="number" step="any" min="0" data-rv="price" value="${r.price}" placeholder="1個の価格"><select class="input" data-rv="taxin" style="width:96px"><option value="8" ${r.taxin===8?'selected':''}>税込8%</option><option value="10" ${r.taxin===10?'selected':''}>税込10%</option><option value="0" ${!r.taxin?'selected':''}>税抜</option></select></div>
   </div>
   <div class="small sub" style="margin-top:4px">${m?(u==null?`<span class="down">単位を「${esc(m.unit)}」に換算できません。内容量の単位を合わせてください</span>`:`1${esc(m.unit)}あたり ${yenU(u)}（今の原価 ${yenU(cur)}${cur?`、${u<cur?'<b class="up">'+pct((cur-u)/cur*100)+' 安い</b>':u>cur?'<b class="down">'+pct((u-cur)/cur*100)+' 高い</b>':'同じ'}`:''}）
     <label class="row" style="display:inline-flex;gap:4px;margin-left:6px"><input type="checkbox" data-rv="apply" ${r.apply?'checked':''}>原価にも反映</label>`):'新しい材料として、この価格で登録します'}</div></div>`;}
function renderReview(){const st=store(),R=REVIEW,on=R.rows.filter(r=>r.on).length;
  sheet('読み取り結果の確認',`<div class="grid2">
   <label class="f">お店・仕入先<select class="input" data-rvh="shop"><option value="">＋ 新しいお店</option>${shops().map(s=>`<option value="${s.id}" ${s.id===R.shop?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
   <label class="f ${R.shop?'hidden':''}">新しいお店の名前<input class="input" data-rvh="shopNew" value="${esc(R.shopNew)}" placeholder="例: オークワ 有田店"></label>
   <label class="f">日付<input class="input" type="date" data-rvh="date" value="${esc(R.date)}"></label></div>
   <p class="note">価格は「1個（1袋・1本）あたり」です。内容量は材料の単位（g・ml・個 など）で入れてください。チェックを外した行は保存しません。</p>
   <div id="rvRows">${R.rows.map((r,i)=>reviewRowHtml(st,r,i)).join('')||'<div class="empty">商品を読み取れませんでした。写真を撮り直すか、手入力してください。</div>'}</div>`,
   `<span class="small sub" style="align-self:center" id="rvCount">${on}件を保存</span><span class="spacer"></span><button class="btn ghost" data-act="close">キャンセル</button><button class="btn primary" data-act="reviewSave" ${on?'':'disabled'}>保存</button>`);}
function saveReview(){const st=store(),R=REVIEW;let shop=R.shop;
  if(!shop){const n=R.shopNew.trim();if(!n){toast('お店の名前を入れてください');return;}const s={id:uid(),name:n};shops().push(s);shop=s.id;}
  let added=0,updated=0,created=0,bad=0;const now=Date.now();
  R.rows.filter(r=>r.on).forEach(r=>{const size=num(r.size),price=num(r.price);if(!(size>0)||!(price>0)){bad++;return;}
    let m=st.mats.find(x=>x.id===r.mat);
    if(!m){m={id:uid(),name:r.name,price,taxin:num(r.taxin),size,unit:r.unit,yield:100,supplier:shopName(shop),updated:R.date,hist:[]};st.mats.push(m);created++;}
    else if(r.apply){const sz=conv(size,r.unit,m.unit);if(sz>0){if(num(m.price)!==price||num(m.size)!==sz){m.hist=[...(m.hist||[]),{d:m.updated||'',price:num(m.price)}].slice(-20);updated++;}Object.assign(m,{price,taxin:num(r.taxin),size:sz,supplier:shopName(shop),updated:R.date});}}
    prices(st).push({id:uid(),mat:m.id,shop,price,taxin:num(r.taxin),size,unit:r.unit,date:R.date,src:'scan',at:now});added++;});
  persist();closeSheet();REVIEW=null;SCAN.files.forEach(f=>f.url&&URL.revokeObjectURL(f.url));SCAN.files=[];render();
  toast(`${added}件を記録しました`+(created?`（新しい材料 ${created}）`:'')+(updated?`・原価を${updated}件更新`:'')+(bad?`・内容量/価格がない${bad}件は保存していません`:''));}

// 見本: 架空のお店3つと、いくつかの材料の価格（比較画面の見本用）
function samplePrices(st){const names=['スーパーA','スーパーB','業務用スーパーC'],ids=names.map(n=>{let x=shops().find(s=>s.name===n);if(!x){x={id:uid(),name:n};shops().push(x);}return x.id;});
  const d=n=>{const t=new Date();t.setDate(t.getDate()-n);return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;};
  // 材料の名前・[お店ごとの (価格, 内容量, 単位)]（null はそのお店で未記録）
  const T={'冷凍うどん玉':[[230,5,'玉'],[218,5,'玉'],[1100,25,'玉']],'青ねぎ':[[198,100,'g'],[158,100,'g'],[300,500,'g']],'卵':[[248,10,'個'],[268,10,'個'],[298,10,'個']],
    '米':[[2580,5,'kg'],[2480,5,'kg'],[4200,10,'kg']],'牛バラ切り落とし':[[398,200,'g'],[358,200,'g'],[2200,1,'kg']],'砂糖':[[228,1,'kg'],[198,1,'kg'],null],
    'コーラ 500ml':[[98,1,'本'],[88,1,'本'],[1500,24,'本']],'炭酸水':[[88,1,'L'],[78,1,'L'],[1580,24,'L']],'レモン':[[98,1,'個'],[128,1,'個'],null],'氷':[[248,1,'kg'],null,[300,1,'kg']]};
  st.prices=st.prices||[];st.mats.forEach(m=>{const t=T[m.name];if(!t)return;t.forEach((v,i)=>{if(v)st.prices.push({id:uid(),mat:m.id,shop:ids[i],price:v[0],taxin:8,size:v[1],unit:v[2],date:d(3+i*5),src:'sample',at:Date.now()});});});}
/* ---------- 比較画面 ---------- */
V.compare=st=>{const c=compareData(st),old=c.rows.filter(r=>r.ls.some(p=>ageDays(p.date)>60));
  const top=c.ranking[0];
  const suggest=[];
  if(top&&top.n>=2)suggest.push(`<b>1か所でまとめて買うなら「${esc(shopName(top.shop))}」</b>。比べられた ${top.n} 品の価格指数 ${Math.round(top.index)}（100＝すべて最安値）で、${top.wins} 品が最安値です。`);
  if(c.save>=1)suggest.push(`<b>お店を使い分けると、月 ${yen(c.save)}（年 ${yen(c.save*12)}）安くなる見込み</b>です（今の原価の単価と最安値の差 × 月の使用量）。`);
  const twoShop=Object.keys(c.plan).length>1;
  if(!c.rows.length)suggest.push('まだ比較できる記録がありません。「読み取り」でレシートや値札を記録すると、ここに比較が出ます。');
  else if(!c.compared)suggest.push('同じ材料を2か所以上のお店で記録すると、どこが安いか比べられます。');
  if(!st.menus.some(m=>num(m.qty)>0)&&c.rows.length)suggest.push('メニュー → 試算 で月の販売数を入れると、節約できる金額（月額）も計算します。');
  return `<h1>比較・提案</h1><p class="sub small" style="margin-top:0">記録した仕入れ値から、材料ごとに一番安いお店と、使い分けたときの節約額を出します（税抜・材料の単位あたりで比較）。</p>
  <div class="card suggest"><h2>提案</h2><ul>${suggest.map(s=>`<li>${s}</li>`).join('')}</ul>
   ${c.compared&&AI.mode&&AI.mode!=='none'?`<div class="row" style="margin-top:6px"><span class="spacer"></span><button class="btn sm" data-act="aiAdvice" ${S.adviceBusy?'disabled':''}>${S.adviceBusy?'考え中…':'AIに買い方を相談する'}</button></div>`:''}
   ${S.advice?`<div class="advice">${esc(S.advice)}</div>`:''}</div>
  ${c.ranking.length?`<div class="card" style="margin-top:12px"><h2>お店のランキング</h2><div class="list">${c.ranking.map((a,i)=>`<div class="li" style="cursor:default"><span class="rank">${i+1}</span><div class="main"><div class="name">${esc(shopName(a.shop))}</div><div class="meta">比較 ${a.n} 品・最安値 ${a.wins} 品</div></div><div class="val"><b>${Math.round(a.index)}</b><div class="small sub">価格指数</div></div></div>`).join('')}</div>
   <p class="note">価格指数 ＝ そのお店の単価 ÷ 最安値の単価 の平均 × 100。100 に近いほど安いお店です（そのお店で記録がある材料だけで比較）。</p></div>`:''}
  ${twoShop?`<div class="card" style="margin-top:12px"><h2>買い物リスト（お店別）</h2>${Object.entries(c.plan).map(([sid,rs])=>`<div class="group-title">${esc(shopName(sid))}<span class="chip">${rs.length}品</span></div><div class="small">${rs.map(r=>esc(r.m.name)).join('、')}</div>`).join('')}</div>`:''}
  <div class="card" style="margin-top:12px"><h2>材料ごとの比較</h2><div class="list">${c.rows.sort((a,b)=>b.save-a.save||b.ls.length-a.ls.length).map(r=>`<div class="li" data-act="editMat" data-id="${r.m.id}"><div class="main"><div class="name">${esc(r.m.name)}</div>
    <div class="cmp">${r.ls.map((p,i)=>`<span class="${i===0&&r.ls.length>1?'best':''}">${esc(shopName(p.shop))} ${yenU(p.u)}/${esc(r.m.unit)}${ageDays(p.date)>60?' <i class="mute">古い</i>':''}</span>`).join('')}</div></div>
    <div class="val">${r.save>=1?`<b class="up">月 −${yen(r.save)}</b><div class="small sub">最安に替えた場合</div>`:r.ls.length>1?`<span class="chip ok">最安で購入中</span>`:'<span class="chip">1店のみ</span>'}</div></div>`).join('')||'<div class="empty">記録がありません</div>'}</div>
   ${old.length?`<p class="note">60日より前の価格を含む材料が ${old.length} 品あります。最近の値札やレシートで更新すると比較が正確になります。</p>`:''}</div>`;};

async function aiAdvice(){const st=store(),c=compareData(st);S.adviceBusy=true;S.advice='';render();
  const lines=c.rows.filter(r=>r.ls.length>1).slice(0,40).map(r=>`${r.m.name}（月の使用量 ${Math.round(r.use)}${r.m.unit}）: `+r.ls.map(p=>`${shopName(p.shop)} ${Math.round(p.u*1000)/1000}円/${r.m.unit}（${p.date||'日付不明'}）`).join(' / '));
  const prompt=`あなたは飲食店の仕入れのアドバイザーです。次は「${st.name}」が記録した、材料ごとのお店別の税抜単価です。
買い物の回数・移動の手間も考えて、どのお店で何を買うのが良いか、具体的に3〜5行の箇条書きで日本語で提案してください。金額の根拠も短く添えてください。
最後に「次の一手」を1行で書いてください。次の形のJSONだけで返してください: {"advice":"本文（改行は\\n）"}
データ:
${lines.join('\n')}
使い分けた場合の節約見込み: 月 ${Math.round(c.save)} 円`;
  try{const j=await aiJSON(prompt,[]);S.advice=String(j.advice||'').trim()||'提案を作れませんでした。';}catch(e){S.advice=aiErr(e);}
  S.adviceBusy=false;render();}

/* ---------- 材料シートの「お店別の価格」 ---------- */
function matPricesHtml(st,m){const ps=prices(st).filter(p=>p.mat===m.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return `<h3>お店別の価格（${ps.length}）</h3><div class="list">${ps.map(p=>{const u=obsUnit(p,m);return `<div class="li" style="cursor:default"><div class="main"><div class="name">${esc(shopName(p.shop))}</div><div class="meta">${esc(p.date||'')}・${yen(p.price)}${p.taxin?'（税込）':''} / ${fq(p.size)}${esc(p.unit)}</div></div><div class="val">${u==null?'<span class="small down">単位違い</span>':`<b>${yenU(u)}</b><span class="small sub">/${esc(m.unit)}</span>`}<div><button type="button" class="btn sm ghost" data-act="usePrice" data-id="${p.id}">原価に使う</button><button type="button" class="x" data-act="delPrice" data-id="${p.id}" aria-label="削除">×</button></div></div></div>`;}).join('')||'<div class="empty" style="padding:10px">まだ記録がありません</div>'}</div>
   <details class="addp"><summary class="small">＋ 値札・チラシの価格を手入力</summary><div class="grid2" style="margin-top:8px">
    <label class="f">お店<input class="input" id="ap_shop" list="shopList" placeholder="例: オークワ"><datalist id="shopList">${shops().map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist></label>
    <label class="f">日付<input class="input" id="ap_date" type="date" value="${today()}"></label>
    <label class="f">価格（円）<input class="input r" id="ap_price" type="number" step="any" min="0"></label>
    <label class="f">税<select class="input" id="ap_tax"><option value="8">税込8%</option><option value="10">税込10%</option><option value="0">税抜</option></select></label>
    <label class="f">内容量<input class="input r" id="ap_size" type="number" step="any" min="0" value="${m.size||''}"></label>
    <label class="f">単位<select class="input" id="ap_unit">${UNITS.map(u=>`<option ${u===m.unit?'selected':''}>${u}</option>`).join('')}</select></label>
    <div class="full row"><span class="spacer"></span><button type="button" class="btn sm" data-act="addPrice" data-id="${m.id}">価格を記録</button></div></div></details>`;}

Object.assign(ACT,{
  scanRemove(d){const f=SCAN.files[Number(d.i)];if(f&&f.url)URL.revokeObjectURL(f.url);SCAN.files.splice(Number(d.i),1);render();},
  scanStop(){SCAN.ctl&&SCAN.ctl.abort();},
  async scanRun(){const st=store();if(SCAN.busy||!SCAN.files.length)return;SCAN.busy=true;SCAN.err='';SCAN.ctl=new AbortController();render();
    try{const blobs=[];for(const f of SCAN.files){if(f.type==='application/pdf')blobs.push(...await pdfToJpegs(f.file));else blobs.push(await toJpeg(f.file));}
      const res=await aiJSON(scanPrompt(st),blobs.slice(0,5),SCAN.ctl.signal);SCAN.busy=false;render();openReview(st,res||{});}
    catch(e){SCAN.busy=false;SCAN.err=e&&e.code?aiErr(e):(e&&e.message)||aiErr(e);render();}},
  reviewSave:saveReview,
  aiAdvice,
  addPrice(d){const st=store(),m=st.mats.find(x=>x.id===d.id),g=id=>document.getElementById(id).value;const name=g('ap_shop').trim(),price=num(g('ap_price')),size=num(g('ap_size'));
    if(!name||!(price>0)||!(size>0)){toast('お店・価格・内容量を入れてください');return;}
    let s=shops().find(x=>x.name===name);if(!s){s={id:uid(),name};shops().push(s);}
    prices(st).push({id:uid(),mat:m.id,shop:s.id,price,taxin:num(g('ap_tax')),size,unit:g('ap_unit'),date:g('ap_date')||today(),src:'manual',at:Date.now()});persist();editMat(m.id);toast('価格を記録しました');},
  delPrice(d){const st=store(),p=prices(st).find(x=>x.id===d.id);if(!p||!confirm('この価格の記録を削除しますか？'))return;st.prices=prices(st).filter(x=>x.id!==d.id);persist();editMat(p.mat);render();},
  usePrice(d){const st=store(),p=prices(st).find(x=>x.id===d.id),m=p&&st.mats.find(x=>x.id===p.mat);if(!m)return;const sz=conv(p.size,p.unit,m.unit);if(!(sz>0)){toast(`単位（${p.unit}→${m.unit}）を換算できません`);return;}
    if(num(m.price)!==num(p.price)||num(m.size)!==sz)m.hist=[...(m.hist||[]),{d:m.updated||'',price:num(m.price)}].slice(-20);
    Object.assign(m,{price:num(p.price),taxin:num(p.taxin),size:sz,supplier:shopName(p.shop),updated:p.date||today()});persist();editMat(m.id);render();toast(`${shopName(p.shop)} の価格を原価に使います`);}
});
Object.assign(CHG,{
  scanFiles(v,el){const fs=[...el.files].filter(f=>/^image\//.test(f.type)||f.type==='application/pdf');if(!fs.length){toast('画像か PDF を選んでください');return;}
    fs.forEach(f=>SCAN.files.push({file:f,type:f.type,name:f.name,url:f.type==='application/pdf'?null:URL.createObjectURL(f)}));SCAN.files=SCAN.files.slice(0,6);SCAN.err='';el.value='';render();},
  apiUrl(v){DATA.apiUrl=v.trim();persist();},apiPass(v){DATA.apiPass=v;persist();}
});
// 確認シートの入力（行ごと・見出し）
document.addEventListener('change',e=>{if(!REVIEW)return;const t=e.target,st=store();
  if(t.dataset.rvh){REVIEW[t.dataset.rvh]=t.value;if(t.dataset.rvh==='shop')renderReview();return;}
  const k=t.dataset.rv;if(!k)return;const box=t.closest('.rv'),i=Number(box.dataset.i),r=REVIEW.rows[i];
  r[k]=t.type==='checkbox'?t.checked:k==='taxin'?num(t.value):k==='mat'||k==='unit'?t.value:num(t.value);
  if(k==='mat'){const m=st.mats.find(x=>x.id===r.mat);if(m&&!conv(r.size,r.unit,m.unit)&&r.unit!==m.unit){r.unit=m.unit;}}
  box.outerHTML=reviewRowHtml(st,r,i);const on=REVIEW.rows.filter(r=>r.on).length,btn=document.querySelector('[data-act=reviewSave]');if(btn)btn.disabled=!on;const ct=document.getElementById('rvCount');if(ct)ct.textContent=`${on}件を保存`;});
document.addEventListener('input',e=>{if(REVIEW&&e.target.dataset.rvh==='shopNew')REVIEW.shopNew=e.target.value;});
// ドラッグ＆ドロップ
document.addEventListener('dragover',e=>{if(e.target.closest&&e.target.closest('#drop')){e.preventDefault();}});
document.addEventListener('drop',e=>{const d=e.target.closest&&e.target.closest('#drop');if(!d)return;e.preventDefault();CHG.scanFiles('',{files:e.dataTransfer.files,set value(v){}});});

if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
render();aiInit();
})();
