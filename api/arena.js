'use strict';
const crypto=require('node:crypto');
const {reply,error,onlySameOrigin,sha,safeUser,userKey,sign,bearer,credential,safePass,readJSON,writeJSON,listKeys,getAPI,utcBuckets}=require('./_lib');
const QUESTIONS=[
 {type:'activity',label:'Will any recorded wheel activity occur?',input:'choice',unit:'yes/no'},
 {type:'segments',label:'How many device run segments will begin?',input:'number',unit:'segments'},
 {type:'duration',label:'How long will the first completed passage segment last?',input:'number',unit:'seconds'},
 {type:'buckets',label:'How many complete 30-minute intervals will show movement?',input:'number',unit:'intervals'}
];
function durationMinutes(v){const n=Number(v);return Number.isInteger(n)&&n>=5&&n<=1440?n:null}
function questionFor(index,minutes){const usable=minutes>=30?QUESTIONS:QUESTIONS.slice(0,3);return usable[index%usable.length]}
function answerOK(q,a){if(q==='activity')return a==='yes'||a==='no';return typeof a==='number'&&Number.isInteger(a)&&a>=0&&a<=100000}
function isCorrect(round,outcome){
 if(round.type==='activity')return round.answer===outcome;
 if(round.type==='duration')return Math.abs(round.answer-outcome)<=Math.max(5,Math.ceil(outcome*.15));
 return round.answer===outcome;
}
async function allRounds(user){const names=await listKeys('rounds/v2/'+user.uid+'/',150);const rs=await Promise.all(names.slice(-80).map(readJSON));return rs.filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt)}
async function findResult(round){return readJSON('outcomes/v2/'+round.id+'.json')}
function parseTimes(v){const t=Date.parse(v||'');return Number.isFinite(t)?t:null}
async function evidenceRuns(windowStart){
 const first=await getAPI('/measurement/runs?limit=100');
 if(!Array.isArray(first.items)||!first.coverageStartAt||!first.coverageThroughAt)throw Error('Segment coverage unavailable');
 const byId=new Map();for(const item of first.items)byId.set(item.segmentId||JSON.stringify(item),item);
 let cursor=first.nextCursor,oldest=Math.min(Infinity,...first.items.map(x=>parseTimes(x.startAt)).filter(x=>x!==null)),pages=1;
 // The cursor may cover further passage segments. Never claim an exact count from a truncated page.
 while(cursor&&oldest>windowStart&&pages<5){
  const more=await getAPI('/measurement/runs?limit=100&cursor='+encodeURIComponent(cursor));
  if(!Array.isArray(more.items))break;
  for(const item of more.items)byId.set(item.segmentId||JSON.stringify(item),item);
  oldest=Math.min(oldest,...more.items.map(x=>parseTimes(x.startAt)).filter(x=>x!==null));
  cursor=more.nextCursor;pages++;
 }
 return{items:[...byId.values()],coverageStart:parseTimes(first.coverageStartAt),
  coverageEnd:parseTimes(first.coverageThroughAt),freshness:first.freshness,provenance:first.provenance,
  pageCoverageEnough:!cursor||oldest<=windowStart};
}
async function settle(round){
 if(Date.now()<round.end+120000)return null; // allow delayed API snapshots
 let outcome=null,source=null,reason='Insufficient complete measurements';
 // 30-minute stats: definitive for complete buckets, no guessing from missing/partial data.
 if(round.type==='buckets'||round.type==='activity'){
  try{
   const d=await getAPI('/measurement/stats?range=30d'),all=utcBuckets(d.activity?.days),needed=[];
   const until=round.type==='buckets'?round.start+Math.floor(round.minutes/30)*1800000:round.end;
   for(let t=round.start;t<until;t+=1800000)needed.push(all.find(x=>x.at===t&&x.complete));
   if(needed.length&&needed.every(Boolean)&&round.type==='buckets'){
    outcome=needed.filter(x=>x.work>0).length;source='complete half-hour Squeekchain statistics';
   }else if(round.type==='activity'&&round.minutes%30===0&&needed.length&&needed.every(Boolean)){
    outcome=needed.some(x=>x.work>0)?'yes':'no';source='complete half-hour Squeekchain statistics';
   }
  }catch(e){reason='Measurement statistics not yet available'}
 }
 if(outcome===null&&round.type!=='buckets'){
  try{
   const evidence=await evidenceRuns(round.start);
   const segments=evidence.items.filter(x=>x&&x.measurementEligible!==false&&parseTimes(x.startAt)!==null&&parseTimes(x.endAt)!==null);
   const starts=segments.filter(x=>{const t=parseTimes(x.startAt);return t>=round.start&&t<round.end});
   const sufficient=evidence.pageCoverageEnough&&evidence.coverageStart!==null&&evidence.coverageStart<=round.start&&evidence.coverageEnd!==null&&evidence.coverageEnd>=round.end;
   if(round.type==='activity'){
    const touched=segments.some(x=>parseTimes(x.startAt)<round.end&&parseTimes(x.endAt)>=round.start);
    if(touched){outcome='yes';source='signed device run-segment evidence'}
    else if(sufficient&&evidence.freshness==='fresh'){outcome='no';source='fresh device segment coverage through full interval'}
    // Without complete coverage, missing passages do not prove quietness.
   }else if(round.type==='segments'&&sufficient){
    outcome=starts.length;source='device run-segment index with full coverage';
   }else if(round.type==='duration'){
    const first=starts.find(x=>parseTimes(x.endAt)<=round.end);
    if(first){outcome=Math.max(0,Math.round((parseTimes(first.endAt)-parseTimes(first.startAt))/1000));source='signed device passage segment timestamps'}
    else if(sufficient&&starts.length===0&&evidence.freshness==='fresh'){
      outcome=0;source='fresh device segment coverage, no segment started in interval';
    }else if(starts.length===0)reason='Cannot confirm absence of run segments';
   }
   if(outcome===null&&evidence.freshness==='unavailable')reason='Device segment feed unavailable';
  }catch(e){reason='Run-segment API unavailable or incomplete'}
 }
 if(outcome===null&&Date.now()<round.end+48*3600000)return null;
 const verified=outcome!==null;
 const result={id:round.id,uid:round.uid,name:round.name,type:round.type,start:round.start,end:round.end,minutes:round.minutes,
 answer:round.answer,outcome:verified?outcome:null,correct:verified?isCorrect(round,outcome):false,
 verified,source:verified?source:null,reason:verified?null:reason,settledAt:Date.now()};
 try{await writeJSON('outcomes/v2/'+round.id+'.json',result,false)}catch{
  const prev=await findResult(round);if(prev)return prev;throw Error('Outcome could not be saved');
 }
 if(verified){
   const safe=Buffer.from(round.name,'utf8').toString('base64url');
   const summary='scores/v2/'+round.start+'__'+safe+'__'+(result.correct?'1':'0')+'__'+round.id+'.json';
   await writeJSON(summary,{id:round.id,verified:true,roundStart:round.start},false).catch(e=>console.warn('Score summary missing',e.message));
 }
 return result;
}
async function profile(req,res){
 const user=bearer(req);if(!user)return error(res,'Sign in to view your profile',401);
 const rounds=await allRounds(user);const view=[];
 for(const round of rounds.slice(0,30)){
  let result=await findResult(round);
  if(!result&&Date.now()>=round.end+120000){try{result=await settle(round)}catch(e){console.warn('settlement deferred',e.message)}}
  view.push({id:round.id,type:round.type,label:round.label,minutes:round.minutes,start:round.start,end:round.end,
    answer:round.answer,createdAt:round.createdAt,status:result?(result.verified?'verified':'unverified'):Date.now()<round.end?'pending':'awaiting-evidence',
    outcome:result?.outcome??null,correct:result?.correct??null,source:result?.source||null,reason:result?.reason||null});
 }
 const verified=view.filter(x=>x.status==='verified');
 return reply(res,200,{identity:{username:user.name},score:{played:verified.length,correct:verified.filter(x=>x.correct).length},rounds:view});
}
async function leader(res){
 const keys=await listKeys('scores/v2/',500),table=new Map();
 for(const key of keys){
  const name=key.slice('scores/v2/'.length).match(/^\d+__([A-Za-z0-9_-]+)__([01])__/);if(!name)continue;
  let n;try{n=Buffer.from(name[1],'base64url').toString('utf8')}catch{continue}
  if(!safeUser(n))continue;
  const entry=table.get(n)||{name:n,played:0,correct:0};entry.played++;entry.correct+=Number(name[2]);table.set(n,entry);
 }
 const rows=[...table.values()].map(r=>({...r,accuracy:r.played?r.correct/r.played:0})).sort((a,b)=>b.correct-a.correct||b.accuracy-a.accuracy).slice(0,25);
 return reply(res,200,{scope:'Verified rounds available in latest 500 game records (not lifetime if more exist)',roundsConsidered:keys.length,rows});
}
module.exports=async function handler(req,res){
 if(!onlySameOrigin(req))return error(res,'Origin not permitted',403);
 const method=req.method,action=String(req.query?.action||'');
 try{
  if(method==='POST'&&(action==='signup'||action==='login')){
   const {username,password}=req.body||{};
   if(!safeUser(username)||!safePass(password))return error(res,'Username: 3–20 letters/numbers/underscores. Password: 10–128 characters.');
   const name=username.toLowerCase(),path=userKey(name);
   let account=await readJSON(path);
   if(action==='signup'){
    if(account)return error(res,'Username already registered. Sign in instead.',409);
    const salt=crypto.randomBytes(24).toString('hex'),uid=sha(name);
    account={uid,name,salt,hash:credential(password,salt),createdAt:Date.now()};
    try{await writeJSON(path,account,false)}catch{return error(res,'Name unavailable; try signing in or choose a different name',409)}
   }else{
    if(!account)return error(res,'Invalid username or password',401);
    const hash=credential(password,account.salt);
    if(!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(account.hash,'hex')))return error(res,'Invalid username or password',401);
   }
   const token=sign({uid:account.uid,name:account.name,exp:Date.now()+30*86400000});
   return reply(res,200,{token,username:account.name,expiresInDays:30});
  }
  if(method==='GET'&&action==='me')return profile(req,res);
  if(method==='GET'&&action==='leaderboard')return leader(res);
  if(method==='GET'&&action==='question'){
    const user=bearer(req);if(!user)return error(res,'Sign in to play',401);
    const minutes=durationMinutes(req.query.minutes);if(!minutes)return error(res,'Choose a whole number of minutes, 5–1440');
    const rounds=await allRounds(user);
    const active=rounds.find(x=>!x.cancelled);
    let live=null;
    if(active&&Date.now()<active.end+48*3600000&&!await findResult(active))live=active;
    if(live)return reply(res,200,{active:true,round:{id:live.id,label:live.label,type:live.type,start:live.start,end:live.end,minutes:live.minutes}});
    const q=questionFor(rounds.length,minutes);
    return reply(res,200,{active:false,question:q,minutes});
  }
  if(method==='POST'&&action==='start'){
    const user=bearer(req);if(!user)return error(res,'Sign in to play',401);
    const minutes=durationMinutes(req.body?.minutes),answer=req.body?.answer;
    if(!minutes)return error(res,'Enter 5–1440 whole minutes');
    const rounds=await allRounds(user);
    // Detect outstanding rounds; never grant a second scoreable round to same account
    for(const existing of rounds.slice(0,15)){
      if(Date.now()<existing.end+48*3600000&&!await findResult(existing))return error(res,'An earlier round is still active or awaiting verification',409);
    }
    const q=questionFor(rounds.length,minutes);
    if(!answerOK(q.type,answer))return error(res,'Choose a valid answer for the current question');
    const interval=q.type==='buckets'?1800000:600000,now=Date.now(),start=(Math.floor(now/interval)+1)*interval;
    const round={id:crypto.randomUUID(),uid:user.uid,name:user.name,minutes,type:q.type,label:q.label,answer,start,end:start+minutes*60000,createdAt:now};
    await writeJSON('rounds/v2/'+user.uid+'/'+round.id+'.json',round,false);
    return reply(res,201,{round:{id:round.id,type:round.type,label:round.label,minutes,start:round.start,end:round.end,answer},message:'Round locked on server. Outcome will be verified from Squeekchain data.'});
  }
  return error(res,'Unknown route',404);
 }catch(e){console.error('arena',e);return error(res,'Arena service temporarily unavailable',503)}
};
