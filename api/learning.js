'use strict';
const {reply,error,readJSON,writeJSON,getAPI,utcBuckets}=require('./_lib');
const MODEL_PATH='learning/v2/model.json',MODEL_VERSION='logistic-v2';
const ONE=1800000;
function sigmoid(z){return 1/(1+Math.exp(-Math.max(-25,Math.min(25,z))))}
function dot(a,b){return a.reduce((v,x,i)=>v+x*(b[i]||0),0)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function features(at,history){
 const date=new Date(at),h=date.getUTCHours()+date.getUTCMinutes()/60,d=date.getUTCDay();
 const active=history.map(x=>x.work>0?1:0);
 const last=active[active.length-1],avg3=active.slice(-3).reduce((a,b)=>a+b,0)/3;
 const avg6=active.slice(-6).reduce((a,b)=>a+b,0)/6;
 const prev=history[history.length-1].work,meanWork=history.reduce((a,b)=>a+Math.log1p(Math.min(b.work,1e7)),0)/(history.length*16);
 return [1,Math.sin(2*Math.PI*h/24),Math.cos(2*Math.PI*h/24),
 Math.sin(2*Math.PI*d/7),Math.cos(2*Math.PI*d/7),last,avg3,avg6,
 clamp(Math.log1p(Math.min(prev,1e7))/16,0,1),clamp(meanWork,0,1)];
}
function samples(raw){
 const out=[];
 for(let i=6;i<raw.length;i++){
  const prior=raw.slice(i-6,i),current=raw[i];
  if(!current.complete||prior.some((r,j)=>!r.complete||(j&&r.at-prior[j-1].at!==ONE))||current.at-prior[5].at!==ONE)continue;
  out.push({at:current.at,x:features(current.at,prior),y:current.work>0?1:0,slot:new Date(current.at).getUTCHours()*2+Math.floor(new Date(current.at).getUTCMinutes()/30)});
 }
 return out;
}
function step(weights,item,rate=.035){
 const p=sigmoid(dot(weights,item.x));
 for(let i=0;i<weights.length;i++){const lambda=i?0.0005:0;weights[i]+=rate*((item.y-p)*item.x[i]-lambda*weights[i]);weights[i]=clamp(weights[i],-12,12)}
}
function baseline(train){
 const global=(train.reduce((n,x)=>n+x.y,0)+1)/(train.length+2);
 const bins=Array.from({length:48},()=>({n:0,hits:0}));
 train.forEach(x=>{bins[x.slot].n++;bins[x.slot].hits+=x.y});
 return{global,bins};
}
function baselinePredict(b,item){
 const x=b.bins[item.slot];return x.n>=3?(x.hits+2*b.global)/(x.n+2):b.global;
}
function score(items,weights,ref){
 const n=items.length;if(!n)return{n:0,accuracy:null,brier:null,baselineAccuracy:null,baselineBrier:null};
 let hits=0,bs=0,baseHits=0,baseBS=0;
 for(const item of items){const p=sigmoid(dot(weights,item.x)),q=baselinePredict(ref,item);hits+=(p>=.5)===Boolean(item.y)?1:0;bs+=(p-item.y)**2;baseHits+=(q>=.5)===Boolean(item.y)?1:0;baseBS+=(q-item.y)**2}
 return{n,accuracy:hits/n,brier:bs/n,baselineAccuracy:baseHits/n,baselineBrier:baseBS/n};
}
function formatSnapshot(snapshot,stale=false){
 const e=snapshot.evaluation||{};
 return{status:'available',modelVersion:MODEL_VERSION,updatedAt:snapshot.updatedAt,
 source:stale?'saved-snapshot':'squeekchain-measurement-stats',
 sampleCount:snapshot.sampleCount||0,trainingSamples:snapshot.trainingSamples||0,
 newlyLearned:snapshot.newlyLearned||0,trainedThrough:snapshot.lastSeenAt?new Date(snapshot.lastSeenAt).toISOString():null,
 validation:{samples:e.n||0,accuracy:e.accuracy??null,brier:e.brier??null,
 baselineAccuracy:e.baselineAccuracy??null,baselineBrier:e.baselineBrier??null},
 liveValidation:snapshot.liveValidation||{n:0,accuracy:null,brier:null},
 next30Probability:snapshot.next30Probability??null,
 freshDataThrough:snapshot.freshDataThrough||null,
 message:stale?'Latest source unavailable: showing last verified training snapshot.':'A shared statistical ML model trains on past wheel activity, then tests on later unseen windows. New results are scored before the model learns from them.',
 note:'Predicts recorded wheel movement only. No visual sensors for sleeping, feeding, stumbling or falls. Measured outcomes may include simulated/replay sources.'};
}
async function compute(snapshot,data){
 if(data.status==='unavailable'||!Array.isArray(data.activity?.days))throw Error('Measurement history unavailable');
 const raw=utcBuckets(data.activity.days),items=samples(raw);
 if(items.length<25)return{status:'insufficient',reason:'At least 25 complete, contiguous historical examples are required to train safely.',availableSamples:items.length};
 if(snapshot?.modelVersion!==MODEL_VERSION||!Array.isArray(snapshot?.weights)){
  const split=Math.max(12,Math.floor(items.length*.75));
  const train=items.slice(0,split),test=items.slice(split);
  let weights=Array(10).fill(0);
  // chronological mini-batch passes; validation samples never enter initial training
  for(let ep=0;ep<16;ep++)for(const item of train)step(weights,item,.06/(1+ep*.15));
  const ref=baseline(train),evals=score(test,weights,ref);
  snapshot={modelVersion:MODEL_VERSION,weights,trainingSamples:train.length,sampleCount:items.length,
    newlyLearned:0,lastSeenAt:items[items.length-1].at,initialLastSeenAt:items[items.length-1].at,
    evaluation:evals,liveValidation:{n:0,hits:0,brierSum:0,accuracy:null,brier:null},
    updatedAt:new Date().toISOString()};
 }else{
  const newItems=items.filter(x=>x.at>snapshot.lastSeenAt).slice(0,500);
  for(const item of newItems){
   const p=sigmoid(dot(snapshot.weights,item.x));
   const live=snapshot.liveValidation||(snapshot.liveValidation={n:0,hits:0,brierSum:0});
   live.n++;live.hits+=(p>=.5)===Boolean(item.y)?1:0;live.brierSum+=(p-item.y)**2;
   step(snapshot.weights,item,.045);
   snapshot.lastSeenAt=item.at;snapshot.trainingSamples++;
  }
  snapshot.liveValidation.accuracy=snapshot.liveValidation.n?snapshot.liveValidation.hits/snapshot.liveValidation.n:null;
  snapshot.liveValidation.brier=snapshot.liveValidation.n?snapshot.liveValidation.brierSum/snapshot.liveValidation.n:null;
  snapshot.newlyLearned=(snapshot.newlyLearned||0)+newItems.length;
  snapshot.sampleCount=items.length;
 }
 const last=raw[raw.length-1],tail=raw.filter(x=>x.complete).slice(-6);
 const contiguous=tail.length===6&&tail.every((x,i)=>!i||x.at-tail[i-1].at===ONE);
 snapshot.next30Probability=contiguous&&tail.length===6&&tail[5].at+ONE===Math.floor(Date.now()/ONE)*ONE?sigmoid(dot(snapshot.weights,features(tail[5].at+ONE,tail))):null;
 snapshot.freshDataThrough=tail.length?new Date(tail[tail.length-1].at).toISOString():null;
 snapshot.updatedAt=new Date().toISOString();
 return snapshot;
}
module.exports=async function handler(req,res){
 if(req.method!=='GET')return error(res,'Method not allowed',405);
 try{
   let saved=await readJSON(MODEL_PATH);
   if(saved?.modelVersion===MODEL_VERSION&&Date.now()-Date.parse(saved.updatedAt)<300000)return reply(res,200,formatSnapshot(saved));
   let data;
   try{data=await getAPI('/measurement/stats?range=30d')}catch(e){
     if(saved?.modelVersion===MODEL_VERSION)return reply(res,200,formatSnapshot(saved,true));
     return reply(res,503,{status:'unavailable',reason:'Squeekchain history is temporarily unavailable. Try later.'});
   }
   const current=await compute(saved,data);
   if(current.status==='insufficient')return reply(res,200,current);
   try{await writeJSON(MODEL_PATH,current,true)}catch(e){console.warn('Could not persist learning snapshot',String(e))}
   return reply(res,200,formatSnapshot(current));
 }catch(e){console.error('learning',e);return error(res,'Learning engine temporarily unavailable',503)}
};
