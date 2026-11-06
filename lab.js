(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=String(value)};
const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const pct=v=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*100)+'%':'—';
let token='',player='',question=null,locked=false,requestId=0;
try{token=localStorage.getItem('squeeksense.session.v2')||''}catch{}
const date=t=>t?new Date(t).toLocaleString():'—';
function note(v,bad=false){set('v3-message',v);$('#v3-message').style.color=bad?'#f4aaa4':'#a9dba9'}
async function api(path,options={}){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),13000);
 try{
  const r=await fetch(path,{...options,signal:abort.signal,cache:'no-store',headers:{
    Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),
    ...(token?{Authorization:'Bearer '+token}:{})}});
  const data=await r.json().catch(()=>({error:'Non-JSON API response'}));
  if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;
 }finally{clearTimeout(timer)}
}
function minutes(){const v=Number($('#v3-minutes').value);return Number.isInteger(v)&&v>=1&&v<=1440?v:null}
function showAuth(){
 $('#v3-auth-box').hidden=Boolean(player);$('#v3-profile-box').hidden=!player;
 set('v3-current-user',player?'@'+player:'—');
 $('#v3-submit').disabled=!player||!question||locked||!minutes();
}
function showQuestion(q){
 question=q;
 set('v3-question-type',q.type.toUpperCase()+' • MEASUREMENT-VERIFIED');
 set('v3-question-title',q.label);
 const help={activity:'YES or NO — will recorded wheel movement occur during your custom interval? An unanswered or unprovable round is not scored.',
  segments:'Enter how many signed device run segments will begin within the chosen window.',
  duration:'Predict, in seconds, the first complete recorded passage segment starting in the window. A segment is not necessarily a full run.',
  buckets:'Predict how many full 30-minute intervals entirely inside your window will show recorded wheel work.'};
 set('v3-question-note',help[q.type]||'Awaiting the next measured challenge.');
 $('#v3-yesno').hidden=q.type!=='activity';
 $('#v3-numeric-label').hidden=q.type==='activity';
 set('v3-number-label',q.type==='duration'?'Your guess (seconds)':q.type==='buckets'?'Active 30-minute intervals':'Count of device run segments');
 $('#v3-number').value='';
 showAuth();
}
async function nextQuestion(){
 if(!player||locked){showAuth();return}
 const n=minutes();if(!n){note('Enter any whole number of minutes between 1 and 1440.',true);return}
 const request=++requestId;
 try{
  const r=await api('/api/arena?action=question&minutes='+n);
  if(request!==requestId)return;
  if(r.active){locked=true;question=null;set('v3-question-type','CURRENT MATCH · LOCKED');set('v3-question-title',r.round.label);set('v3-question-note','Your server-locked match starts '+date(r.round.start)+' and ends '+date(r.round.end)+'.');}
  else{locked=false;showQuestion(r.question)}
  showAuth();
 }catch(e){question=null;showAuth();note('Question service: '+e.message,true)}
}
async function auth(mode){
 const username=$('#v3-username').value.trim(),password=$('#v3-password').value;
 if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))return note('Username must be 3–20 letters, digits or underscores.',true);
 if(password.length<10||password.length>128)return note('Password must contain 10–128 characters.',true);
 try{
  note('Authenticating your player profile…');
  const r=await api('/api/arena?action='+mode,{method:'POST',body:JSON.stringify({username,password})});
  token=r.token;player=r.username;
  localStorage.setItem('squeeksense.session.v2',token);$('#v3-password').value='';
  showAuth();note('Signed in as @'+player+' — server-locked rounds and shared verified scores are enabled.');
  await profile();await nextQuestion();
 }catch(e){note('Account error: '+e.message,true)}
}
async function profile(){
 if(!token)return;
 try{
  const r=await api('/api/arena?action=me');
  player=r.identity.username;showAuth();
  set('v3-my-score',r.score.correct+' / '+r.score.played+' correct');
  const root=$('#v3-my-rounds');root.replaceChildren();
  for(const game of r.rounds.slice(0,7)){
   const row=document.createElement('div'),left=document.createElement('span'),right=document.createElement('b');
   row.className='v3-event';left.textContent=date(game.start)+' · '+game.minutes+' min · '+game.type;
   right.textContent=game.status==='verified'?(game.correct?'✓ CORRECT':'✕ MISSED'):game.status==='unverified'?'UNVERIFIED':game.status==='pending'?'IN PLAY':'WAITING FOR EVIDENCE';
   if(game.source)row.title='Source: '+game.source;
   row.append(left,right);root.append(row);
  }
  if(!r.rounds.length){const p=document.createElement('p');p.className='v3-note';p.textContent='No recorded matches yet. Start your first verified prediction.';root.append(p)}
  const first=r.rounds[0];locked=Boolean(first&&['pending','awaiting-evidence'].includes(first.status));
  set('v3-locked',locked?'Match locked: '+first.type+' · '+date(first.start)+' → '+date(first.end):'No active game. A new question becomes available each round.');
  if(!locked&&question===null)await nextQuestion();
  showAuth();
 }catch(e){
  if(/sign in/i.test(e.message)){token='';player='';localStorage.removeItem('squeeksense.session.v2');showAuth();note('Session expired. Sign in again.',true)}
  else note('Profile check: '+e.message,true);
 }
}
async function submit(){
 if(!player||!question||locked||!minutes())return;
 let answer;
 if(question.type==='activity')answer=$('input[name="v3-choice"]:checked')?.value;
 else{if($('#v3-number').value.trim()==='')return note('Enter a number before locking your prediction.',true);
  answer=Number($('#v3-number').value)}
 if(answer===undefined||(question.type!=='activity'&&(!Number.isInteger(answer)||answer<0||answer>100000)))return note('Choose a valid prediction.',true);
 $('#v3-submit').disabled=true;
 try{
  const r=await api('/api/arena?action=start',{method:'POST',body:JSON.stringify({minutes:minutes(),answer})});
  locked=true;question=null;showAuth();
  note('Prediction saved and locked on server! Your round starts '+date(r.round.start)+'.');
  set('v3-locked',r.round.label+' · '+r.round.minutes+' min · Answer: '+answer+'.');
  await profile();
 }catch(e){note('Could not lock prediction: '+e.message,true);await nextQuestion()}
}
async function leaderboard(){
 try{
  const r=await api('/api/arena?action=leaderboard'),root=$('#v3-ranking');root.replaceChildren();
  for(const [i,u]of r.rows.slice(0,8).entries()){
   const row=document.createElement('div'),name=document.createElement('b'),score=document.createElement('span');
   row.className='v3-ranked';name.textContent=(i+1)+'. @'+u.name;score.textContent=u.correct+' correct / '+u.played+' played';
   row.append(name,score);root.append(row);
  }
  if(!r.rows.length){const p=document.createElement('p');p.className='v3-note';p.textContent='No verified games yet. Be the first!';root.append(p)}
  set('v3-rank-scope',r.scope);
 }catch(e){set('v3-rank-scope','Leaderboard temporarily unavailable: '+e.message)}
}
async function learning(){
 try{
  const r=await api('/api/learning');
  if(r.status!=='available')throw Error(r.reason||'Insufficient training observations');
  set('lab-training',fmt(r.trainingSamples));set('lab-new',fmt(r.newlyLearned));set('lab-val-accuracy',pct(r.validation.accuracy));
  set('lab-val-accuracy-copy',pct(r.validation.accuracy));set('lab-samples',fmt(r.validation.samples)+' untouched later validation intervals');
  set('lab-baseline',pct(r.validation.baselineAccuracy));set('lab-next',pct(r.next30Probability));set('v3-ai-signal',pct(r.next30Probability));
  set('lab-brier',fmt(r.validation.brier,3));set('lab-through',date(r.trainedThrough));set('lab-updated',date(r.updatedAt));
  set('lab-model-source',r.source);set('lab-status',r.source==='saved-snapshot'?'SAVED MODEL SNAPSHOT':'LIVE LEARNING ENGINE READY');
  const diff=r.validation.accuracy-r.validation.baselineAccuracy;
  set('lab-gain',Number.isFinite(diff)?(diff>=0?'+':'')+(diff*100).toFixed(1)+' percentage points versus baseline':'Baseline comparison unavailable');
  $('#lab-accuracy-bar').style.width=pct(r.validation.accuracy)==='—'?'0%':pct(r.validation.accuracy);
  $('#lab-baseline-bar').style.width=pct(r.validation.baselineAccuracy)==='—'?'0%':pct(r.validation.baselineAccuracy);
  set('lab-explanation',r.message);
  set('lab-online',r.liveValidation?.n?'Newly observed labelled windows scored before learning: '+r.liveValidation.n+' · '+pct(r.liveValidation.accuracy)+' correct':'Waiting for new verified training windows. Performance cannot be guaranteed.');
 }catch(e){if(window.SqueekBrowserLab)return window.SqueekBrowserLab.learn();set('lab-status','HISTORY TEMPORARILY UNAVAILABLE');set('lab-explanation',e.message+' — no invented predictions or metrics.')}
}
async function health(){
 try{
  const r=await api('/api/health');if(!r.apiReachable&&window.SqueekBrowserLab)return window.SqueekBrowserLab.health();const m=r.live;
  const name={running:'🏃 RUNNING',still:'🧍 IDLE / WHEEL STILL',stale:'⚠️ STALE MEASUREMENT','api-error':'⛔ API ERROR','no-measurement':'⛔ NO MEASUREMENT','hardware-alert':'⚠️ DEVICE ISSUE'};
  set('v3-health-status',name[m.state]||'NO SIGNAL');
  set('v3-health-detail',date(m.lastObservedAt)+' · '+(m.provenance||'unknown'));
  set('v3-health-history',r.history.available?'AVAILABLE · '+r.history.days+' days':'UNAVAILABLE');
  set('v3-health-runs',r.runs.available?'CONNECTED · '+r.runs.count+' segments':'UNAVAILABLE');
  set('v3-health-time',date(r.checkedAt));set('v3-running',m.state==='running'?fmt(m.rpm,2)+' RPM':m.state==='still'?'STILL (not confirmed sleep)':'UNKNOWN');
  $('#v3-signal-running').classList.toggle('active',m.state==='running');
  $('#v3-signal-still').classList.toggle('active',m.state==='still');
  set('v3-live-source','Sensor provenance: '+(m.provenance||'unknown')+' · '+(m.remark||''));
 }catch(e){if(window.SqueekBrowserLab)return window.SqueekBrowserLab.health();set('v3-health-status','CHECK UNAVAILABLE');set('v3-health-detail',e.message)}
}
function annotate(){
 const value=$('#v3-annotation').value;
 const text={unknown:'No observation',eating:'🥕 User reported: feeding',sleeping:'💤 User reported: sleeping',falling:'⚠️ User reported: stumble / fall'};
 localStorage.setItem('squeeksense.manual.v1',JSON.stringify({value,time:Date.now()}));
 set('v3-annotation-result',(text[value]||text.unknown)+' · Not sensor verified and never an AI training label.');
}
function init(){
 $('#v3-signup').addEventListener('click',()=>auth('signup'));
 $('#v3-signin').addEventListener('click',()=>auth('login'));
 $('#v3-signout').addEventListener('click',()=>{player='';token='';question=null;locked=false;localStorage.removeItem('squeeksense.session.v2');showAuth();set('v3-question-title','Sign in to unlock rotating questions.');note('Signed out.')});
 $('#v3-submit').addEventListener('click',submit);
 $('#v3-minutes').addEventListener('input',()=>{set('v3-length-note',minutes()?'Custom window: '+minutes()+' minutes':'Whole minutes 1–1440 required');showAuth();clearTimeout(init.timer);init.timer=setTimeout(nextQuestion,450)});
 $('#v3-observe').addEventListener('click',annotate);
 try{const o=JSON.parse(localStorage.getItem('squeeksense.manual.v1')||'null');if(o&&Date.now()-o.time<3600000){$('#v3-annotation').value=o.value;set('v3-annotation-result','User-reported observation recorded '+date(o.time)+'. Unverified.')}}catch{}
 showAuth();learning();health();leaderboard();
 if(token){player='Loading profile';showAuth();profile().then(nextQuestion)}
 setInterval(learning,5*60000);setInterval(health,60000);setInterval(leaderboard,120000);
 setInterval(()=>{if(token)profile()},60000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();