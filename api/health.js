'use strict';
const {reply,error,getAPI}=require('./_lib');
function age(t){const v=Date.parse(t||'');return Number.isFinite(v)?Math.max(0,Date.now()-v):null}
module.exports=async function(req,res){
 if(req.method!=='GET')return error(res,'Method not allowed',405);
 const [status,history,runs]=await Promise.allSettled([
  getAPI('/status'),getAPI('/measurement/stats?range=7d'),getAPI('/measurement/runs?limit=25')
 ]);
 const s=status.status==='fulfilled'?status.value:null;
 const m=s?.measurement,ageMs=age(m?.receivedAt||m?.observedAt);
 const fresh=Boolean(m&&m.freshness==='online'&&ageMs!==null&&ageMs<=Math.max(120000,Number(m.staleAfterSeconds||120)*1000));
 const state=!s?'api-error':!m?'no-measurement':!fresh?'stale':m.coreStatus==='ACTIVE'?'running':m.coreStatus==='IDLE'?'still':'hardware-alert';
 const hist=history.status==='fulfilled'?history.value:null;
 const seg=runs.status==='fulfilled'?runs.value:null;
 return reply(res,200,{checkedAt:new Date().toISOString(),apiReachable:Boolean(s),live:{
  state,connected:Boolean(s),readingFresh:fresh,lastObservedAt:m?.observedAt||null,lastReceivedAt:m?.receivedAt||null,
  freshness:m?.freshness||null,deviceStatus:m?.coreStatus||null,provenance:m?.provenance||null,
  rpm:fresh&&Number.isFinite(m?.rpmMilli)?m.rpmMilli/1000:null,
  distanceMeters:fresh&&Number.isFinite(m?.distanceMm)?m.distanceMm/1000:null,
  remark:!s?'API request failed':!m?'No device measurement received':fresh&&m.coreStatus==='ACTIVE'?'Wheel motion recorded':fresh&&m.coreStatus==='IDLE'?'Wheel still; sleep, feeding and falls not observable from wheel telemetry':'Measurement unavailable or stale'
 },history:{available:Boolean(hist?.activity?.days),days:hist?.activity?.days?.length||0,coverage:hist?.activity?.coverage?.coverageBps??null},
 runs:{available:Boolean(seg&&Array.isArray(seg.items)),count:seg?.items?.length||0,freshness:seg?.freshness||null,coverageThroughAt:seg?.coverageThroughAt||null},
 source:'Squeekchain public read-only API; 7-day statistics and recent device passage segments'});
};