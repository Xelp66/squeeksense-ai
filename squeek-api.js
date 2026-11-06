/* Shared browser-only reader for the documented, public Squeekchain API.
   No credentials, no third-party proxy, no attempt to bypass upstream access controls. */
(()=>{'use strict';
 const BASE='https://api.squeekchain.com/v1';
 const entries=new Map(),pending=new Map(),cooldowns=new Map();
 const patterns=[/^\/status$/, /^\/core$/, /^\/measurement\/stats\?range=(?:7d|30d)$/, /^\/measurement\/runs\?limit=(?:[1-9]|[1-9]\d|100)$/];
 function allowed(path){return patterns.some(re=>re.test(path))}
 function ttl(path){return path.startsWith('/measurement/stats')?60000:path.startsWith('/measurement/runs')?13000:path==='/status'?7000:10000}
 function failure(message,code,status){const e=new Error(message);e.code=code;e.status=status;return e}
 function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
 async function request(path,attempt=0){
  const previous=entries.get(path);
  const cooldown=cooldowns.get(path)||0;if(cooldown>Date.now())await sleep(Math.min(cooldown-Date.now(),15000));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const headers={Accept:'application/json'};
   if(previous?.etag)headers['If-None-Match']=previous.etag;
   let response;
   try{response=await fetch(BASE+path,{signal:controller.signal,cache:'no-store',headers,credentials:'omit'})}
   catch(e){throw failure(e.name==='AbortError'?'Squeekchain request timed out':'Squeekchain API is unreachable or browser CORS was blocked','NETWORK',null)}
   if(response.status===304&&previous){previous.until=Date.now()+ttl(path);previous.checkedAt=Date.now();return previous.data}
   const type=response.headers.get('Content-Type')||'';
   if(response.status===429||response.status===503||response.status===504){
     const raw=Number(response.headers.get('Retry-After'));const wait=Number.isFinite(raw)&&raw>0?Math.min(raw*1000,20000):Math.min((attempt+1)*2500,6000);
     cooldowns.set(path,Date.now()+wait);
     if(attempt<1){await sleep(wait);return request(path,attempt+1)}
   }
   if(!response.ok){
    const challenge=response.headers.get('cf-mitigated')==='challenge'||(/html/i.test(type)&&(response.status===403||response.status===503));
    throw failure(challenge?'Upstream Cloudflare challenge: this client cannot access the public API':'Squeekchain API HTTP '+response.status,challenge?'UPSTREAM_CHALLENGE':'HTTP_ERROR',response.status);
   }
   if(!type.includes('json'))throw failure('Upstream returned a non-JSON page instead of API data','INVALID_RESPONSE',response.status);
   let data;try{data=await response.json()}catch{throw failure('Squeekchain returned malformed JSON','INVALID_RESPONSE',response.status)}
   if(!data||typeof data!=='object'||Array.isArray(data))throw failure('Unexpected Squeekchain response','INVALID_RESPONSE',response.status);
   if(data.status==='unavailable')throw failure('Source temporarily unavailable: '+String(data.reason||'unknown reason'),'DATA_UNAVAILABLE',response.status);
   if(path==='/status'&&!(data.measurement===null||data.measurement&&typeof data.measurement==='object'))
    throw failure('Status payload missing the measurement object','INVALID_RESPONSE',response.status);
   if(path.startsWith('/measurement/stats')&&!Array.isArray(data.activity?.days))
    throw failure('Stats payload has no historical day array','INVALID_RESPONSE',response.status);
   if(path.startsWith('/measurement/runs')&&!Array.isArray(data.items))
    throw failure('Run segments payload is missing items','INVALID_RESPONSE',response.status);
   entries.set(path,{data,etag:response.headers.get('ETag'),until:Date.now()+ttl(path),checkedAt:Date.now()});
   return data;
  }finally{clearTimeout(timer)}
 }
 async function get(path,opts={}){
  if(typeof path!=='string'||!allowed(path))throw failure('API path not on the SqueekSense allowlist','INVALID_QUERY',400);
  const record=entries.get(path);
  if(!opts.force&&record&&record.until>Date.now())return record.data;
  if(!pending.has(path)){const promise=request(path).finally(()=>pending.delete(path));pending.set(path,promise)}
  return pending.get(path);
 }
 function state(){return Array.from(entries.entries()).map(([path,e])=>({path,checkedAt:e.checkedAt,cachedUntil:e.until}))}
 // Compare API timestamps to the API's own generatedAt rather than the viewer's clock.
 function measurementStatus(data){
  const m=data?.measurement;if(!m)return{state:'missing',fresh:false,secondsOld:null};
  const serverNow=Date.parse(data?.generatedAt||''),received=Date.parse(m.receivedAt||m.observedAt||'');
  const secondsOld=Number.isFinite(serverNow)&&Number.isFinite(received)?Math.max(0,(serverNow-received)/1000):null;
  const fresh=m.freshness==='online'&&secondsOld!==null&&secondsOld<=Math.max(120,Number(m.staleAfterSeconds||120));
  return{state:!fresh?'stale':m.coreStatus==='ACTIVE'?'running':m.coreStatus==='IDLE'?'idle':'unknown',fresh,secondsOld};
 }
 window.SqueekAPI={get,state,measurementStatus};
})();