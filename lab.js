/* SqueekSense Learning Lab and live signal controls.
   Arena and Replay have been intentionally retired from the public UI;
   historical model snapshots and user records remain untouched. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=String(value)};
const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const pct=v=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*100)+'%':'—';
const date=t=>t?new Date(t).toLocaleString():'—';
async function api(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),13000);
 try{
  const response=await fetch(path,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
  const data=await response.json().catch(()=>({error:'Invalid API response'}));
  if(!response.ok)throw Error(data.error||'HTTP '+response.status);
  return data;
 }finally{clearTimeout(timer)}
}
async function learning(){
 // Browsers are the API's supported public CORS callers; prefer this legal path.
 if(window.SqueekBrowserLab){
  const result=await window.SqueekBrowserLab.learn();
  if(result)return;
 }
 // Keep the server learning route for the day upstream allows Vercel to read.
 try{
  const r=await api('/api/learning');
  if(r.status!=='available')throw Error(r.reason||'Insufficient training observations');
  set('lab-training',fmt(r.trainingSamples));set('lab-new',fmt(r.newlyLearned));set('lab-val-accuracy',pct(r.validation.accuracy));
  set('lab-val-accuracy-copy',pct(r.validation.accuracy));set('lab-samples',fmt(r.validation.samples)+' later validation intervals');
  set('lab-baseline',pct(r.validation.baselineAccuracy));set('lab-next',pct(r.next30Probability));set('v3-ai-signal',pct(r.next30Probability));
  set('lab-brier',fmt(r.validation.brier,3));set('lab-through',date(r.trainedThrough));set('lab-updated',date(r.updatedAt));
  set('lab-model-source',r.source);set('lab-status','SHARED LEARNING ENGINE READY');
  const diff=r.validation.accuracy-r.validation.baselineAccuracy;
  set('lab-gain',Number.isFinite(diff)?(diff>=0?'+':'')+(diff*100).toFixed(1)+' percentage points versus baseline':'Baseline comparison unavailable');
  $('#lab-accuracy-bar').style.width=pct(r.validation.accuracy)==='—'?'0%':pct(r.validation.accuracy);
  $('#lab-baseline-bar').style.width=pct(r.validation.baselineAccuracy)==='—'?'0%':pct(r.validation.baselineAccuracy);
  set('lab-explanation',r.message);
  set('lab-online',r.liveValidation?.n?'New unseen windows tested before learning: '+r.liveValidation.n+' · '+pct(r.liveValidation.accuracy)+' correct':'Waiting for new labelled observations.');
 }catch(e){set('lab-status','LEARNING SOURCE UNAVAILABLE');set('lab-explanation','Both browser and server data paths are currently unavailable. '+e.message)}
}
async function health(){
 // Device state must come from the SAME public browser API path as the working live monitor.
 // Vercel's /api/health can be Cloudflare-challenged and must not overwrite a healthy
 // browser status with a misleading backend connectivity warning.
 if(!window.SqueekBrowserLab || typeof window.SqueekBrowserLab.health!=='function'){
   set('v3-health-status','⏳ INITIALIZING BROWSER TELEMETRY');
   set('v3-health-detail','Waiting for the public Squeekchain browser API client.');
   set('v3-live-source','Server access is a separate diagnostic, not the wheel state.');
   return;
 }
 try{
   await window.SqueekBrowserLab.health();
 }catch(e){
   set('v3-health-status','⚠️ BROWSER TELEMETRY UNAVAILABLE');
   set('v3-health-detail','Public API request failed: '+String(e.message||e).slice(0,200));
   set('v3-health-history','UNKNOWN');
   set('v3-health-runs','UNKNOWN');
   set('v3-running','UNKNOWN');
   set('v3-live-source','The live wheel state cannot be confirmed in this browser. See the independent connection diagnostic below.');
 }
}
function annotate(){
 const value=$('#v3-annotation').value;
 const text={unknown:'No observation',eating:'🥕 User reported: feeding',sleeping:'💤 User reported: sleeping',falling:'⚠️ User reported: stumble / fall'};
 localStorage.setItem('squeeksense.manual.v1',JSON.stringify({value,time:Date.now()}));
 set('v3-annotation-result',(text[value]||text.unknown)+' · Not sensor verified and never an AI training label.');
}
function init(){
 const observer=$('#v3-observe');
 if(observer)observer.addEventListener('click',annotate);
 try{
  const item=JSON.parse(localStorage.getItem('squeeksense.manual.v1')||'null');
  if(item&&Date.now()-item.time<3600000&&$('#v3-annotation')){
   $('#v3-annotation').value=item.value;
   set('v3-annotation-result','User-reported observation recorded '+date(item.time)+'. Unverified.');
  }
 }catch{}
 void learning();
 void health();
 setInterval(()=>{void learning()},5*60000);
 setInterval(()=>{void health()},60*1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();