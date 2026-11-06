(()=>{'use strict';
const HOST='https://api.squeekchain.com/v1',STEP=1800000,KEY='squeeksense.local-learning.v2';
const el=id=>document.getElementById(id),set=(id,x)=>{if(el(id))el(id).textContent=String(x)};
const pct=x=>typeof x==='number'&&Number.isFinite(x)?Math.round(100*x)+'%':'—';
const number=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
const sigmoid=x=>1/(1+Math.exp(-Math.max(-20,Math.min(20,x)))), dot=(w,x)=>x.reduce((s,v,i)=>s+v*w[i],0),clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
let history=null,model=null,lastLearnFetch=0;
try{model=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
async function request(path){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),12500);
 try{const r=await fetch(HOST+path,{cache:'no-store',signal:c.signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('Squeekchain HTTP '+r.status);
  const d=await r.json();if(!d||d.status==='unavailable')throw Error(d?.reason||'No usable response');return d
 }finally{clearTimeout(timer)}
}
function work(b){if(!b||b.coverage!=='complete')return null;const s=String(b.workUnits??'');if(!/^\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)?n:null}
function buckets(api){
 const out=[];
 for(const d of api.activity?.days||[]){
  if(!/^\d{4}-\d\d-\d\d$/.test(d.date||'')||!Array.isArray(d.buckets))continue;
  const noon=Date.parse(d.date+'T12:00:00.000Z');
  d.buckets.slice(0,48).forEach((b,i)=>out.push({at:noon+i*STEP,work:work(b)}));
 }
 return out.sort((a,b)=>a.at-b.at);
}
function features(at,prior){
 const z=new Date(at),hour=z.getUTCHours()+z.getUTCMinutes()/60,day=z.getUTCDay(),bits=prior.map(x=>x.work>0?1:0);
 const avg=s=>s.reduce((n,v)=>n+v,0)/s.length;
 return [1,Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24),Math.sin(2*Math.PI*day/7),Math.cos(2*Math.PI*day/7),
 bits[5],avg(bits.slice(-3)),avg(bits),Math.log1p(Math.min(prior[5].work,1e7))/16,
 avg(prior.map(x=>Math.log1p(Math.min(x.work,1e7))/16))];
}
function labels(raw){
 const out=[];
 for(let i=6;i<raw.length;i++){
  const prev=raw.slice(i-6,i),now=raw[i];
  if(now.work===null||prev.some((x,j)=>x.work===null||(j&&x.at-prev[j-1].at!==STEP))||now.at-prev[5].at!==STEP)continue;
  const date=new Date(now.at);
  out.push({at:now.at,x:features(now.at,prev),y:now.work>0?1:0,slot:date.getUTCHours()*2+Math.floor(date.getUTCMinutes()/30)});
 }
 return out;
}
function update(w,item,rate){
 const p=sigmoid(dot(w,item.x));for(let i=0;i<w.length;i++)w[i]=clamp(w[i]+rate*((item.y-p)*item.x[i]-(i?0.0005*w[i]:0)),-12,12);
}
function base(train){
 const global=(1+train.reduce((s,x)=>s+x.y,0))/(train.length+2),slots=Array.from({length:48},()=>({n:0,y:0}));
 for(const x of train){slots[x.slot].n++;slots[x.slot].y+=x.y}
 return{global,slots};
}
function validate(test,weights,ref){
 let correct=0,baseHits=0,brier=0;for(const x of test){
  const p=sigmoid(dot(weights,x.x)),s=ref.slots[x.slot],q=s.n>=3?(s.y+2*ref.global)/(s.n+2):ref.global;
  correct+=Number((p>=.5)===Boolean(x.y));baseHits+=Number((q>=.5)===Boolean(x.y));brier+=(p-x.y)**2;
 }
 return{n:test.length,accuracy:test.length?correct/test.length:null,baselineAccuracy:test.length?baseHits/test.length:null,brier:test.length?brier/test.length:null};
}
function show(m,raw){
 const f=m.validation||{};
 set('lab-status','🧠 LEARNING LOCALLY · SQUEEKCHAIN DATA');
 set('lab-model-source','Browser-direct / per-device training');
 set('lab-training',number(m.trainingSamples));set('lab-new',number(m.newSamples));
 set('lab-val-accuracy',pct(f.accuracy));set('lab-val-accuracy-copy',pct(f.accuracy));
 set('lab-baseline',pct(f.baselineAccuracy));set('lab-brier',number(f.brier));
 set('lab-samples',number(f.n)+' later withheld validation windows');
 const delta=f.accuracy-f.baselineAccuracy;
 set('lab-gain',Number.isFinite(delta)?(delta>=0?'+':'')+(delta*100).toFixed(1)+' percentage points versus baseline':'Not enough validation data');
 el('lab-accuracy-bar').style.width=pct(f.accuracy)==='—'?'0%':pct(f.accuracy);
 el('lab-baseline-bar').style.width=pct(f.baselineAccuracy)==='—'?'0%':pct(f.baselineAccuracy);
 set('lab-through',new Date(m.lastAt).toLocaleString());set('lab-updated',new Date(m.updatedAt).toLocaleString());
 const complete=raw.filter(x=>x.work!==null),last=complete.slice(-6);
 const contiguous=last.length===6&&last.every((v,i)=>!i||v.at-last[i-1].at===STEP);
 const nowStart=Math.floor(Date.now()/STEP)*STEP;
 const next=contiguous&&last[5].at+STEP===nowStart?sigmoid(dot(m.weights,features(nowStart,last))):null;
 set('lab-next',pct(next));
 set('lab-online',m.live?.n?'Post-deployment new windows evaluated BEFORE training: '+m.live.n+' · '+pct(m.live.correct/m.live.n)+' accuracy':'Awaiting new observed intervals for prequential test-then-learn.');
 set('lab-explanation','On-device adaptive logistic regression; initial 75% of earlier observations train the model, later 25% test it without leakage. Once newer labelled windows arrive, the algorithm scores each prediction before updating its parameters. This fallback runs in your browser because the API currently challenges Vercel server requests.');
}
async function learn(){
 if(Date.now()-lastLearnFetch<45000)return;lastLearnFetch=Date.now();
 try{
  const d=await request('/measurement/stats?range=30d');
  history=d;window.SqueekBrowserLab.history=d;
  const raw=buckets(d),items=labels(raw);
  if(items.length<25){set('lab-status','INSUFFICIENT MEASURED HISTORY');set('lab-explanation','Only '+items.length+' complete, contiguous training examples. No fake model scores.');return}
  if(!model||model.version!=='local-logistic-v2'||!Array.isArray(model.weights)){
   const split=Math.max(12,Math.floor(items.length*.75)),train=items.slice(0,split),test=items.slice(split),w=Array(10).fill(0);
   for(let epoch=0;epoch<16;epoch++)for(const x of train)update(w,x,.06/(1+epoch*.15));
   model={version:'local-logistic-v2',weights:w,trainingSamples:train.length,lastAt:items.at(-1).at,
    validation:validate(test,w,base(train)),newSamples:0,live:{n:0,correct:0},updatedAt:Date.now()};
  }else{
   for(const x of items.filter(x=>x.at>model.lastAt).slice(0,500)){
    const p=sigmoid(dot(model.weights,x.x));model.live=model.live||{n:0,correct:0};
    model.live.n++;model.live.correct+=(p>=.5)===Boolean(x.y)?1:0;
    update(model.weights,x,.045);model.lastAt=x.at;model.newSamples++;model.trainingSamples++;
   }
   model.updatedAt=Date.now();
  }
  localStorage.setItem(KEY,JSON.stringify(model));show(model,raw);
 }catch(e){
  if(model&&Array.isArray(model.weights)){set('lab-status','SAVED DEVICE MODEL · DATA UNAVAILABLE');set('lab-explanation',String(e.message)+' — saved training state preserved; no new observations learned.')}
  else{set('lab-status','LEARNING DATA UNAVAILABLE');set('lab-explanation','Could not load direct Squeekchain history: '+e.message)}
 }
}
async function health(){
 const [a,b,c]=await Promise.allSettled([request('/status'),request('/measurement/stats?range=7d'),request('/measurement/runs?limit=25')]);
 const st=a.status==='fulfilled'?a.value:null,m=st?.measurement;
 const age=m&&st?.generatedAt?Date.parse(st.generatedAt)-Date.parse(m.receivedAt||m.observedAt):Infinity;
 const fresh=Boolean(m&&m.freshness==='online'&&age<=150000);
 const state=!st?'API ERROR':!m?'NO DEVICE MEASUREMENT':!fresh?'STALE READING':m.coreStatus==='ACTIVE'?'RUNNING':m.coreStatus==='IDLE'?'WHEEL STILL':m.coreStatus||'UNKNOWN';
 set('v3-health-status','BROWSER API: '+state);
 set('v3-health-detail',m?.observedAt?new Date(m.observedAt).toLocaleString()+' · '+m.provenance:'No live reading');
 set('v3-health-history',b.status==='fulfilled'?'AVAILABLE · '+(b.value.activity?.days?.length||0)+' days':'UNAVAILABLE');
 set('v3-health-runs',c.status==='fulfilled'?'AVAILABLE · '+(c.value.items?.length||0)+' segments':'UNAVAILABLE');
 set('v3-health-time',new Date().toLocaleTimeString());
 set('v3-running',fresh&&m.coreStatus==='ACTIVE'?(m.rpmMilli/1000).toFixed(2)+' RPM':'No verified movement');
 el('v3-signal-running').classList.toggle('active',state==='RUNNING');
 el('v3-signal-still').classList.toggle('active',state==='WHEEL STILL');
 set('v3-live-source','Browser-direct public API, source: '+(m?.provenance||'unknown')+'. Eating, sleep and falls cannot be determined from wheel telemetry.');
}
window.SqueekBrowserLab={learn,health,history:null,get model(){return model}};
})();
