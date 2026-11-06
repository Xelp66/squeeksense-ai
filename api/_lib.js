'use strict';
const { get, put, list } = require('@vercel/blob');
const crypto = require('node:crypto');

const SITE_ORIGIN='https://squeeksense.xyz';
const API='https://api.squeekchain.com/v1';
const readOpts={access:'private',useCache:false};
function reply(res,code,obj){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');return res.status(code).json(obj)}
function error(res,message,code=400){return reply(res,code,{error:message})}
function onlySameOrigin(req){const o=req.headers.origin;return !o||o===SITE_ORIGIN||/^https:\/\/squeeksense-ai-app(?:-[a-z\d-]+)?\.vercel\.app$/.test(o)}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
function safeUser(n){return typeof n==='string'&&/^[a-zA-Z0-9_]{3,20}$/.test(n)}
function userKey(n){return 'users/v2/'+sha(n.toLowerCase())+'.json'}
function sign(payload){
 if(!process.env.ARENA_SESSION_SECRET)throw Error('session signing secret not configured');
 const data=Buffer.from(JSON.stringify(payload)).toString('base64url');
 const sig=crypto.createHmac('sha256',process.env.ARENA_SESSION_SECRET).update(data).digest('base64url');
 return data+'.'+sig;
}
function verify(token){
 if(typeof token!=='string'||token.length>2048)return null;
 const parts=token.split('.');if(parts.length!==2)return null;
 const expected=crypto.createHmac('sha256',process.env.ARENA_SESSION_SECRET||'missing').update(parts[0]).digest();
 const given=Buffer.from(parts[1],'base64url');
 if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected))return null;
 try{const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());return p.exp>Date.now()&&typeof p.uid==='string'&&typeof p.name==='string'?p:null}catch{return null}
}
function bearer(req){return verify((req.headers.authorization||'').replace(/^Bearer /i,''))}
function credential(password,salt){return crypto.scryptSync(password,salt,64).toString('hex')}
function safePass(s){return typeof s==='string'&&s.length>=10&&s.length<=128}
async function readJSON(path){
 try{const r=await get(path,readOpts);if(!r||r.statusCode!==200||!r.stream)return null;return JSON.parse(await new Response(r.stream).text())}catch(e){if(/not.found|404/i.test(String(e?.message)))return null;throw e}
}
async function writeJSON(path,obj,overwrite=false){return put(path,JSON.stringify(obj),{access:'private',contentType:'application/json',allowOverwrite:overwrite,addRandomSuffix:false,cacheControlMaxAge:60})}
async function listKeys(prefix,max=400){
 const paths=[];let cursor;
 while(paths.length<max){const r=await list({prefix,limit:Math.min(100,max-paths.length),...(cursor?{cursor}:{})});paths.push(...(r.blobs||[]).map(b=>b.pathname));if(!r.hasMore||!r.cursor)break;cursor=r.cursor}
 return paths;
}
async function getAPI(path){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);
 try{const r=await fetch(API+path,{signal:c.signal,headers:{Accept:'application/json'}});
   if(!r.ok)throw Error('Squeekchain HTTP '+r.status);
   const d=await r.json();if(!d||typeof d!=='object'||d.status==='unavailable')throw Error(d?.reason||'data unavailable');
   return d;
 }finally{clearTimeout(t)}
}
function bucketValue(b){
 if(!b||b.coverage!=='complete')return null;
 const str=String(b.workUnits??'');
 if(!/^\d+$/.test(str))return null;
 const v=Number(str);return Number.isSafeInteger(v)&&v>=0?v:null;
}
function utcBuckets(days){
 const out=[];
 for(const day of days||[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day?.date||'')||!Array.isArray(day.buckets))continue;
  const start=Date.parse(day.date+'T12:00:00Z');
  for(let i=0;i<48;i++){const b=day.buckets[i],work=bucketValue(b);out.push({at:start+i*1800000,work,complete:work!==null,provenance:b?.provenance||null})}
 }
 return out.sort((a,b)=>a.at-b.at);
}
module.exports={reply,error,onlySameOrigin,sha,safeUser,userKey,sign,verify,bearer,credential,safePass,readJSON,writeJSON,listKeys,getAPI,bucketValue,utcBuckets};
