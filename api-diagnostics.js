/* Status diagnostics display only. Does not bypass Cloudflare or treat pasted/cached
   telemetry as fresh data, and never forwards user-pasted JSON to the backend. */
(()=>{'use strict';
const $=id=>document.getElementById(id),write=(id,value)=>{if($(id))$(id).textContent=String(value)};
let lastServerTest=0,openedOnce=false,lastBrowserError=null;
const escapeForReport=s=>String(s||'').slice(0,600);
function archived(){
 const last=window.SqueekAPI?.lastSuccessfulStatus?.();
 if(!last?.data){write('diag-last','No earlier successful API response saved in this browser.');return}
 const m=last.data.measurement,obs=m?.observedAt||m?.receivedAt||last.data.generatedAt;
 const when=Number.isFinite(Date.parse(obs||''))?new Date(obs).toLocaleString():'time unknown';
 write('diag-last','Last successful response: '+when+' • device reported '+String(m?.coreStatus||'no state')+' • '+(m&&Number.isFinite(m.rpmMilli)?(m.rpmMilli/1000).toFixed(1)+' RPM':'no RPM')+'. ARCHIVED — not a current reading.');
}
function reportText(){
 const dx=window.SqueekAPI?.diagnostic?.()||{failures:[]};
 return [
  'SqueekSense AI — connectivity report',
  'Time: '+new Date().toISOString(),
  'App: '+location.origin,
  'Public API: https://api.squeekchain.com/v1/status',
  'Browser result: '+($('diag-browser')?.textContent||'unknown'),
  'Server result: '+($('diag-server')?.textContent||'unknown'),
  'Last confirmed snapshot: '+($('diag-last')?.textContent||'none'),
  'Client detail: '+dx.failures.map(x=>x.path+': '+x.code+' '+(x.httpStatus||'')+' '+x.message).join('; ').slice(0,800),
  'No passwords, session tokens, or other private data attached.'
 ].join('\n');
}
async function serverTest(force=false){
 if(!force&&Date.now()-lastServerTest<120000)return;
 lastServerTest=Date.now();
 write('diag-server','Checking Vercel → Squeekchain connection…');
 try{
  const controller=new AbortController(),time=setTimeout(()=>controller.abort(),12000);
  let res;
  try{res=await fetch('/api/health',{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}})}
  finally{clearTimeout(time)}
  if(!res.ok)throw Error('Our diagnostics endpoint returned HTTP '+res.status);
  const data=await res.json();
  if(data.upstream?.state==='server-challenged')
   write('diag-server','BLOCKED by upstream Cloudflare • HTTP '+(data.upstream.httpStatus||403)+' • Vercel cannot fetch the public API. Approval from Squeekchain is required.');
  else if(data.apiReachable)
   write('diag-server','CONNECTED • Vercel successfully fetched the official API. Device state: '+(data.live?.state||'unknown')+'.');
  else write('diag-server','UNREACHABLE • '+(data.upstream?.errorCode||'unknown')+'. This does not prove the hamster is offline.');
 }catch(e){write('diag-server','Diagnostics endpoint unavailable: '+escapeForReport(e.message))}
}
function connected(data){
 if($('api-diagnostics'))$('api-diagnostics').hidden=true;
 lastBrowserError=null;
 write('diag-browser','CONNECTED • official Squeekchain API returned a valid response at '+new Date().toLocaleTimeString()+'.');
 archived();
}
function failed(error){
 lastBrowserError=error;
 const diag=$('api-diagnostics');if(!diag)return;
 diag.hidden=false;
 if(!openedOnce){diag.open=true;openedOnce=true}
 const code=error?.code||'UNKNOWN',http=error?.status||null;
 const msg=code==='NETWORK'?'Browser request failed: upstream challenge, browser privacy settings, CORS or network access may be responsible. Browser JavaScript cannot distinguish these reliably.':
 code==='UPSTREAM_CHALLENGE'?'Upstream Cloudflare challenge'+(http?' (HTTP '+http+')':'')+' prevented the API read.':
 code==='HTTP_ERROR'?'Squeekchain returned HTTP '+http+'.':
 code==='DATA_UNAVAILABLE'?'Squeekchain returned a valid unavailable-data response.':
 code==='INVALID_QUERY'?'The API rejected the request format.':
 code==='RATE_LIMIT'?'Too many requests; wait before retrying.':
 'Request failed: '+escapeForReport(error?.message);
 write('diag-browser','NOT CONNECTED • '+msg);
 archived();
 void serverTest();
}
function manual(){
 const el=$('diag-json'),status=$('diag-import-result');if(!el||!status)return;
 if(el.value.length>100000){status.textContent='Maximum input size: 100 KB.';return}
 try{
  const data=JSON.parse(el.value);
  if(data?.schemaVersion!==1||typeof data?.generatedAt!=='string'||!Number.isFinite(Date.parse(data.generatedAt))||
     (data.measurement!==null&&(typeof data.measurement!=='object'||Array.isArray(data.measurement))))throw Error('Not a valid Squeekchain /v1/status snapshot');
  const m=data.measurement;const time=m?.observedAt||data.generatedAt;
  const rpm=m&&Number.isFinite(m.rpmMilli)?(m.rpmMilli/1000).toFixed(2)+' RPM':'RPM unknown';
  status.textContent='USER-PASTED HISTORICAL SNAPSHOT · '+new Date(time).toLocaleString()+' · '+String(m?.coreStatus||'no device state')+' · '+rpm+'. Not live, not authenticated, and not used to verify games or train AI.';
  el.value='';
 }catch(e){status.textContent='Could not read a valid status JSON: '+escapeForReport(e.message)}
}
function init(){
 $('diag-retry')?.addEventListener('click',()=>{
   write('diag-browser','Retrying direct public API…');
   window.dispatchEvent(new CustomEvent('squeek:retry-live'));
 });
 $('diag-recheck')?.addEventListener('click',()=>serverTest(true));
 $('diag-import')?.addEventListener('click',manual);
 $('diag-copy')?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(reportText());write('diag-copy-result','Diagnostics copied (contains no player credentials).')}
  catch{write('diag-copy-result','Clipboard unavailable. Select and copy the diagnostic lines manually.')}
 });
 archived();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.SqueekDiagnostics={failed,connected,serverTest,reportText};
})();