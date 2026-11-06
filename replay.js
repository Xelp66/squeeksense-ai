(()=>{'use strict';
const STEP=1800000,KEY='squeeksense.replay.v1';
const $=s=>document.querySelector(s),set=(id,x)=>{const e=document.getElementById(id);if(e)e.textContent=String(x)};
let state={played:0,wins:0,baseline:0},round=null,loaded=null,sequence=0;
try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&typeof x.played==='number')state=x}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function update(){set('rp-played',state.played);set('rp-wins',state.wins);set('rp-ai',state.baseline)}
function work(b){
 if(!b||b.coverage!=='complete')return null;
 const str=String(b.workUnits??'');if(!/^\d+$/.test(str))return null;
 const v=Number(str);return Number.isSafeInteger(v)?v:null;
}
function flatten(data){
 const result=[];
 for(const d of data.activity?.days||[]){
  if(!Array.isArray(d.buckets)||!/\d{4}-\d{2}-\d{2}/.test(d.date||''))continue;
  const noon=Date.parse(d.date+'T12:00:00Z');
  for(let i=0;i<48;i++)result.push({at:noon+i*STEP,work:work(d.buckets[i])});
 }
 return result.sort((a,b)=>a.at-b.at);
}
function complete(items){
 return items.every((x,i)=>x&&x.work!==null&&(!i||x.at-items[i-1].at===STEP));
}
async function data(){
 if(loaded)return loaded;
 const shared=window.SqueekBrowserLab?.history;
 if(shared?.activity?.days){loaded=shared;return loaded}
 const response=await window.SqueekAPI.get('/measurement/stats?range=30d');
 if(!Array.isArray(response.activity?.days))throw Error('Measurement history unavailable');
 loaded=response;return loaded;
}
function questionLabel(kind,n){
 if(kind==='activity')return'Will ANY recorded wheel movement occur in the next '+(n*30)+' minutes?';
 if(kind==='count')return'How many of the next '+n+' complete half-hour windows will show wheel movement?';
 if(kind==='first')return'Which upcoming half-hour will FIRST show activity? (1–'+n+', or 0 for none)';
 return'Will total measured work exceed the previous '+(n*30)+' minutes?';
}
async function next(){
 $('#rp-reveal').disabled=true;
 const n=Number($('#rp-length').value);
 if(!Number.isInteger(n)||n<1||n>24){set('rp-result','Enter between 1 and 24 complete half-hour slots.');return}
 try{
  set('rp-result','Loading complete recorded Squeekchain intervals…');
  const all=flatten(await data()),eligible=[];
  for(let i=Math.max(12,n);i+n<=all.length;i++){
   if(complete(all.slice(i-Math.max(12,n),i))&&complete(all.slice(i,i+n)))eligible.push(i)
  }
  if(!eligible.length){set('rp-result','There are not enough complete historical measurement windows for this duration. Try fewer slots.');return}
  const i=eligible[Math.floor(Math.random()*eligible.length)],kind=['activity','count','first','surge'][sequence++%4],future=all.slice(i,i+n),prev=all.slice(i-Math.max(12,n),i);
  const past=all.slice(0,i),historic=past.filter(x=>x.work!==null);
  const rate=(historic.filter(x=>x.work>0).length+1)/(historic.length+2);
  const recent=prev.slice(-n),priorWork=recent.reduce((a,b)=>a+b.work,0),futureWork=future.reduce((a,b)=>a+b.work,0);
  const active=future.filter(x=>x.work>0).length,first=future.findIndex(x=>x.work>0);
  const outcome=kind==='activity'?active>0?'yes':'no':kind==='count'?active:kind==='first'?first+1:futureWork>priorWork?'yes':'no';
  const prediction=kind==='activity'?rate>1/(n+1)?'yes':'no':kind==='count'?Math.round(n*rate):kind==='first'?(rate>=.2?1:0):rate>=.5?'yes':'no';
  round={kind,n,outcome,prediction,at:future[0].at,sourceAt:prev.at(-1)?.at,active,futureWork,priorWork,revealed:false};
  set('rp-kind','REPLAY '+sequence+' • '+kind.toUpperCase()+' • HISTORICAL EVIDENCE');
  set('rp-question',questionLabel(kind,n));
  const context=prev.slice(-4).map(x=>(x.work>0?'●':'○')).join(' ')+' (active ● / quiet ○)';
  set('rp-context','Only previous data shown: '+context+' · Earlier window ends '+new Date(prev.at(-1).at+STEP).toLocaleString()+'. Outcome remains hidden.');
  const yesno=kind==='activity'||kind==='surge';
  $('#rp-yesno').hidden=!yesno;$('#rp-numeric').hidden=yesno;
  $('#rp-number').value='';$('#rp-reveal').disabled=false;
  set('rp-result','Prediction ready! Choose your answer, then reveal the recorded result. Past-only baseline makes its prediction without seeing the future.');
 }catch(e){set('rp-result','Source unavailable: '+e.message+'. No fake historical outcomes are generated.')}
}
function reveal(){
 if(!round||round.revealed)return;
 const choice=round.kind==='activity'||round.kind==='surge';
 const answer=choice?$('input[name="rp-choice"]:checked')?.value:Number($('#rp-number').value);
 if(!choice&&($('#rp-number').value.trim()===''||!Number.isInteger(answer)||answer<0))return set('rp-result','Enter a valid whole number before revealing.');
 const good=answer===round.outcome,ai=round.prediction===round.outcome;
 round.revealed=true;state.played++;state.wins+=good?1:0;state.baseline+=ai?1:0;save();update();
 set('rp-result',(good?'✓ CORRECT! ':'✕ MISSED. ')+
  'Recorded outcome: '+String(round.outcome).toUpperCase()+'. Baseline guess: '+String(round.prediction).toUpperCase()+
  ' · '+(ai?'baseline correct':'baseline missed')+' · Historical start: '+new Date(round.at).toLocaleString()+
  ' · Source: complete 30-minute Squeekchain measurement buckets. This result is practice-only.');
 $('#rp-reveal').disabled=true;
}
function init(){
 $('#rp-next').addEventListener('click',next);
 $('#rp-reveal').addEventListener('click',reveal);
 $('#rp-length').addEventListener('input',()=>{round=null;$('#rp-reveal').disabled=true;set('rp-result','Duration changed. Press New Challenge for a new complete measurement window.')});
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
