(()=>{
/* public hooks so review add-ons can layer on without forking the core loop; defaults = shipped behaviour */
const CFG=Object.assign({reelMs:2200,pickMs:2600,auto:true},window.S06CFG||{});
const S=window.S06={auto:CFG.auto,pauseUntil:0,filter:null,text:null,onHot:[],onReel:[],onSwap:[]};
const r=document.querySelector('.reel-in'),n=r.children.length;let k=0;
setInterval(()=>{k++;r.style.transition='';r.style.transform=`translateY(-${k*100/n}%)`;S.onReel.forEach(f=>f(k%(n-1)));
 if(k===n-1)setTimeout(()=>{r.style.transition='none';r.style.transform='translateY(0)';k=0},650)},CFG.reelMs);

const NAMES={"accenture": "Accenture", "amazon": "Amazon", "barclays": "Barclays", "byjus": "BYJU'S", "capgemini": "Capgemini", "cognizant": "Cognizant", "ey": "EY", "google": "Google", "groww": "Groww", "phonepe": "PhonePe", "postman": "Postman", "razorpay": "Razorpay", "swiggy": "Swiggy", "zerodha": "Zerodha", "hsbc": "HSBC", "tcs": "TCS", "wipro": "Wipro", "deloitte": "Deloitte", "hcl": "HCLTech", "icici_bank": "ICICI Bank", "infosys": "Infosys", "jpmorgan": "J.P. Morgan", "novartis": "Novartis", "ola": "Ola", "rapido": "Rapido", "zomato": "Zomato"},ROLES={"swiggy": 42, "razorpay": 27, "phonepe": 35, "accenture": 310, "amazon": 120, "infosys": 260, "zomato": 19, "groww": 22, "hcl": 180, "wipro": 140, "tcs": 410, "cognizant": 230, "barclays": 38, "deloitte": 95, "hsbc": 44, "capgemini": 170, "ola": 16, "byjus": 24, "zerodha": 12, "icici_bank": 88, "postman": 9, "ey": 76, "rapido": 21, "jpmorgan": 63, "novartis": 31, "google": 54},WIDE=new Set(["deloitte", "hcl", "icici_bank", "infosys", "jpmorgan", "novartis", "ola", "rapido", "zomato"]);
const stage=document.querySelector('.stage'),tip=document.querySelector('.tip');
const bubs=[...document.querySelectorAll('.bub')],vis=bubs.filter(b=>b.hasAttribute('data-vis'));
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
let hot=null,recent=[];
Object.assign(S,{NAMES,ROLES,stage,tip,bubs,vis,calm});Object.defineProperty(S,'hot',{get:()=>hot});

/* 1 · tooltip: random pick among every clearly-visible bubble, never one of the last few */
function rolesText(b){const l=b.dataset.logo;return NAMES[l]+' · <b>'+ROLES[l]+' open roles</b>'}
function setHot(b){
  if(hot)hot.classList.remove('hot');hot=b;if(!b){tip.classList.remove('on');return}
  recent.push(b);if(recent.length>5)recent.shift();
  b.classList.add('hot');tip.innerHTML=(S.text||rolesText)(b);place(true);tip.classList.add('on');S.onHot.forEach(f=>f(b));
}
function pick(){
  if(hot){hot.classList.remove('hot')}tip.classList.remove('on');
  setTimeout(()=>{
    const base=vis.filter(b=>!b.classList.contains('swapping'));
    const want=S.filter?base.filter(S.filter):base;
    let pool=want.filter(b=>!recent.includes(b));if(!pool.length)pool=want.filter(b=>b!==hot);if(!pool.length)pool=base;
    setHot(pool[Math.floor(Math.random()*pool.length)]);
  },380);
}
S.setHot=setHot;S.pick=pick;
/* keep the tooltip glued to its drifting bubble; flip below / slide sideways near the edges */
function place(once){
  if(hot){
    const s=stage.getBoundingClientRect(),r=hot.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight,gap=12,pad=8;
    const cx=r.left+r.width/2-s.left;let x=cx-tw/2;x=Math.max(pad,Math.min(s.width-tw-pad,x));
    const below=(r.top-s.top)-th-gap<pad;const y=below?(r.bottom-s.top+gap):(r.top-s.top-th-gap);
    tip.classList.toggle('below',below);tip.style.setProperty('--ax',(cx-x)+'px');
    tip.style.transform=`translate3d(${x}px,${y}px,0)`;
  }
  if(once!==true)requestAnimationFrame(place);
}
requestAnimationFrame(place);
if(S.auto)pick();
setInterval(()=>{if(S.auto&&Date.now()>S.pauseUntil)pick()},CFG.pickMs);

/* 2 · logo shuffle: every few seconds one quiet bubble dissolves into a company not on screen */
if(!calm){
  const onScreen=()=>new Set(bubs.map(b=>b.dataset.logo));
  setInterval(()=>{
    const spare=Object.keys(NAMES).filter(n=>!onScreen().has(n));
    const cand=bubs.filter(b=>b!==hot&&!b.classList.contains('swapping')&&!b.classList.contains('peer'));
    if(!spare.length||!cand.length)return;
    const b=cand[Math.floor(Math.random()*cand.length)],f=b.querySelector('.face'),n=spare[Math.floor(Math.random()*spare.length)];
    b.classList.add('swapping');f.classList.add('out');
    setTimeout(()=>{b.dataset.logo=n;f.querySelector('.logo').className='logo lg-'+n;f.classList.toggle('wide',WIDE.has(n));
      f.classList.remove('out');S.onSwap.forEach(fn=>fn(b));setTimeout(()=>b.classList.remove('swapping'),650)},650);
  },2300);
}
})();

(()=>{const S=window.S06,DIM=5;           /* ~1 in 5 bubbles greyed at any moment */
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const free=b=>b!==S.hot&&!b.classList.contains('big')&&!b.classList.contains('swapping');
/* seed: spread the first greys out so they never clump together */
const seed=[...S.bubs].filter(free).sort(()=>Math.random()-.5);const picked=[];
for(const b of seed){if(picked.length>=DIM)break;const r=b.getBoundingClientRect();
  if(picked.every(p=>{const q=p.getBoundingClientRect();return Math.hypot(q.left-r.left,q.top-r.top)>r.width*1.6}))picked.push(b)}
picked.forEach(b=>b.classList.add('dim'));
S.filter=b=>!b.classList.contains('dim');   /* tooltip only ever lands on a full-colour logo */
/* every few seconds one grey bubble warms back to colour and another cools — a slow swap, never a flash */
if(!S.calm)setInterval(()=>{
  const d=S.bubs.filter(b=>b.classList.contains('dim')),c=S.bubs.filter(b=>free(b)&&!b.classList.contains('dim'));
  if(!d.length||!c.length)return;
  rnd(d).classList.remove('dim');setTimeout(()=>rnd(c.filter(free)).classList.add('dim'),450);
},2400);
})();
