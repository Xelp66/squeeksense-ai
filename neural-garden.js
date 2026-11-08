/* SqueekSense — Neural Garden x Feature Brain, no dependencies.
   All real predictions are captured BEFORE their UTC window and scored only
   against complete Squeekchain half-hour buckets. Demo never changes records. */
(()=>{'use strict';
const HALF=1800000,KEY='squeeksense.neural-ledger.v1';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const FEATURE_NAMES=['Baseline','Daily rhythm · sin','Daily rhythm · cos','Weekly rhythm · sin','Weekly rhythm · cos','Last interval active','Recent 90m activity','Last 3h activity','Previous work intensity','Average work intensity'];
const EXPLAINS=[
  'Model intercept. Baseline tendency before other inputs.',
  'Cyclic hour-of-day sine component.',
  'Cyclic hour-of-day cosine component.',
  'Cyclic day-of-week sine component.',
  'Cyclic day-of-week cosine component.',
  'Whether the last observed half-hour contained wheel work.',
  'Share of the last three complete half-hours with movement.',
  'Share of the last six complete half-hours with movement.',
  'Log-scaled work units from the last half-hour.',
  'Average log-scaled work units across the previous three hours.'
];
const viewClock=n=>new Date(n).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const esc=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const rng=(seed)=>{let x=seed|0;return()=>((x=(1664525*x+1013904223)|0)>>>0)/4294967296};
const svg=(v)=>Number(v).toFixed(2);
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&v.version===1&&Array.isArray(v.rounds)?{version:1,rounds:v.rounds.slice(-160)}:{version:1,rounds:[]}}catch{return{version:1,rounds:[]}}}
function save(state){try{localStorage.setItem(KEY,JSON.stringify({version:1,rounds:state.rounds.slice(-160)}))}catch{}}
function realStats(rounds){
 const done=rounds.filter(r=>r.status==='correct'||r.status==='wrong');
 const correct=done.filter(r=>r.status==='correct').length;
 const recent=done.slice(-30),acc=recent.length?recent.filter(r=>r.status==='correct').length/recent.length:null;
 let streak=0;for(let i=done.length-1;i>=0&&done[i].status==='correct';i--)streak++;
 const vitality=done.length?clamp(26+100*(acc-.5)*.92+Math.min(done.length,60)*.35,13,98):null;
 const grade=vitality===null?0:Math.min(7,Math.max(1,Math.round(vitality/15)));
 return {done,correct,wrong:done.length-correct,acc,streak,vitality,grade};
}
function starfield(){
 const random=rng(8241),nodes=[];
 for(let i=0;i<38;i++){const x=12+random()*576,y=20+random()*290,r=.45+random()*1.3;
  nodes.push('<circle class="ng-particle" cx="'+svg(x)+'" cy="'+svg(y)+'" r="'+svg(r)+'" fill="'+(i%4===0?'#d5b5fc':'#a4efce')+'" opacity="'+svg(.16+random()*.57)+'" style="animation-delay:-'+svg(random()*4)+'s"/>')}
 return nodes.join('');
}
function makeTree(vitality,seedCount){
 const rand=rng(2104),out=[],leaves=[];
 const grade=vitality===null?2:clamp(Math.round(vitality/16),2,7);
 const depth=grade<3?4:grade<5?5:6;
 const draw=(x,y,len,angle,step,idx)=>{
  const nx=x+Math.cos(angle)*len,ny=y+Math.sin(angle)*len;
  const cx=x+Math.cos(angle-.23)*len*.42,cy=y+Math.sin(angle-.23)*len*.52;
  const width=Math.max(.7,6.4*Math.pow(.69,step));
  out.push('<path d="M'+svg(x)+' '+svg(y)+' Q'+svg(cx)+' '+svg(cy)+' '+svg(nx)+' '+svg(ny)+'" stroke="'+(step<2?'url(#ng-wood)':'#82bc9a')+'" stroke-width="'+svg(width)+'" stroke-linecap="round" fill="none" opacity="'+svg(.95-step*.067)+'"/>');
  if(step>=depth){
   const size=2.8+rand()*4.7;
   leaves.push('<ellipse class="ng-leaf" cx="'+svg(nx)+'" cy="'+svg(ny)+'" rx="'+svg(size)+'" ry="'+svg(size*1.8)+'" transform="rotate('+svg((angle*180/Math.PI)+90)+' '+svg(nx)+' '+svg(ny)+')" fill="'+(idx%5===0?'#cdfd97':idx%3===0?'#7cc9bd':'#86dcab')+'" opacity="'+(.6+rand()*.3)+'" style="animation-delay:-'+svg(rand()*3.2)+'s"/>');
   if(seedCount>0 && idx%Math.max(3,Math.floor(19/grade))===0){
    leaves.push('<circle cx="'+svg(nx)+'" cy="'+svg(ny)+'" r="'+svg(2+rand()*2.1)+'" fill="'+(idx%2?'#efb6ed':'#e7ffbc')+'" opacity=".85" filter="url(#ng-bloom)"/>')}
   return;
  }
  const spread=.38+.11*rand();
  const mult=.71+rand()*.07;
  draw(nx,ny,len*mult,angle-spread,step+1,idx*2+1);
  draw(nx,ny,len*(mult-.03),angle+spread,step+1,idx*2+2);
  if(step===2&&grade>=5)draw(nx,ny,len*.66,angle+.05,step+2,idx*3+9);
 };
 draw(305,396,grade<=2?71:82,-Math.PI/2,0,1);
 return '<g>'+out.join('')+'</g><g>'+leaves.join('')+'</g>';
}
function gardenSVG(stats){
 const score=stats.vitality;const tree=makeTree(score,stats.correct);
 return '<svg class="ng-art garden-svg" viewBox="0 0 600 450" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive illustration of a luminous tree that grows or recedes with verified prediction performance">'
 +'<defs><radialGradient id="ng-sky"><stop stop-color="#8ff5ab" stop-opacity=".16"/><stop offset="1" stop-color="#8ff5ab" stop-opacity="0"/></radialGradient><linearGradient id="ng-wood" x1="0" y1="1" x2=".6" y2="0"><stop stop-color="#407c5f"/><stop offset=".5" stop-color="#76ae7b"/><stop offset="1" stop-color="#b1e0a0"/></linearGradient><linearGradient id="ng-floor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1c5036"/><stop offset="1" stop-color="#0a2018"/></linearGradient><filter id="ng-bloom"><feGaussianBlur stdDeviation="3"/></filter></defs>'
 +'<circle cx="304" cy="200" r="185" fill="url(#ng-sky)"/><circle cx="302" cy="202" r="165" fill="none" stroke="#b4d999" stroke-opacity=".14" stroke-dasharray="2 10"/>'
 +'<circle cx="305" cy="215" r="128" fill="none" stroke="#b9e9a5" stroke-opacity=".09"/>'+starfield()
 +'<g class="ng-orbit"><ellipse cx="304" cy="214" rx="220" ry="58" transform="rotate(-19 304 214)" stroke="#b0f5bb" stroke-opacity=".14" fill="none" stroke-dasharray="8 12"/></g>'
 +'<path d="M0 401Q95 359 181 384T360 379T600 402V450H0Z" fill="#123528"/><path d="M0 422Q90 379 185 419T415 413T600 424V450H0Z" fill="url(#ng-floor)"/>'
 +'<ellipse cx="305" cy="412" rx="145" ry="22" fill="#8ede90" opacity=".13" filter="url(#ng-bloom)"/>'
 +tree
 +'<path d="M40 426Q130 386 199 425M397 425Q485 388 560 425" stroke="#78a280" stroke-width="2" fill="none" opacity=".15"/>'
 +'<g opacity=".7"><circle cx="106" cy="372" r="2" fill="#b7f7ad"/><circle cx="475" cy="348" r="2" fill="#b7f7ad"/><circle cx="406" cy="289" r="3" fill="#b9f2ad"/></g></svg>';
}
function brainSVG(weights,selected){
 const random=rng(92177),cx=268,cy=220;
 let orbits='<g class="ng-orbit"><circle cx="'+cx+'" cy="'+cy+'" r="179" fill="none" stroke="#c8b7ff" stroke-opacity=".13" stroke-dasharray="5 11"/><ellipse cx="'+cx+'" cy="'+cy+'" rx="224" ry="89" transform="rotate(-32 '+cx+' '+cy+')" stroke="#c4b3ff" stroke-opacity=".16" fill="none"/></g>';
 let links='',nodes='';
 for(let i=0;i<10;i++){
  const angle=-Math.PI/2+i*(2*Math.PI/10),x=cx+Math.cos(angle)*153,y=cy+Math.sin(angle)*153;
  const w=Number(weights?.[i])||0,active=selected===i,positive=w>=0;
  const color=positive?'#a6ebc9':'#b8a1ff';
  const r=6.5+Math.min(7,Math.abs(w)*3.2);
  const x1=cx+Math.cos(angle)*74,y1=cy+Math.sin(angle)*74;
  links+='<path class="ng-line" d="M'+svg(x)+' '+svg(y)+' Q'+svg((x+x1)/2+Math.sin(angle)*19)+' '+svg((y+y1)/2)+' '+svg(x1)+' '+svg(y1)+'" stroke="'+color+'" stroke-opacity="'+(active?.8:.22+Math.min(.33,Math.abs(w)*.12))+'" stroke-width="'+(active?2.8:1.3)+'" fill="none"/>';
  nodes+='<g class="ng-node" role="button" tabindex="0" data-ng-feature="'+i+'" aria-label="'+esc(FEATURE_NAMES[i])+': '+svg(w)+' model coefficient">'
  +'<circle cx="'+svg(x)+'" cy="'+svg(y)+'" r="'+svg(r+8)+'" fill="'+color+'" opacity="'+(active?.13:.038)+'"/>'
  +'<circle class="ng-node-face" cx="'+svg(x)+'" cy="'+svg(y)+'" r="'+svg(r)+'" stroke="'+color+'" stroke-opacity="'+(active?'1':'.6')+'" stroke-width="1.1" fill="#1d2840"/>'
  +'<circle cx="'+svg(x)+'" cy="'+svg(y)+'" r="2.5" fill="'+color+'"/>'
  +'<text x="'+svg(x+(x>=cx?14:-14))+'" y="'+svg(y-9)+'" fill="'+(active?'#f4e9ff':'#9d98b9')+'" text-anchor="'+(x>=cx?'start':'end')+'">F'+(i+1)+'</text>'
  +'</g>';
 }
 let sparks='';
 for(let i=0;i<55;i++){const x=65+random()*404,y=35+random()*370;
  sparks+='<circle class="ng-particle" cx="'+svg(x)+'" cy="'+svg(y)+'" r="'+svg(.3+random()*1.2)+'" fill="'+(i%2?'#b1b6ff':'#c4ffa3')+'" opacity="'+svg(random()*.38+.08)+'" style="animation-delay:-'+svg(random()*4)+'s"/>'}
 return '<svg class="ng-art brain-svg" viewBox="0 0 540 450" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive diagram of the ten actual input feature coefficients in our logistic regression model">'
 +'<defs><radialGradient id="ng-brain-bg"><stop stop-color="#b18cf4" stop-opacity=".22"/><stop offset="1" stop-color="#806acc" stop-opacity="0"/></radialGradient><radialGradient id="ng-brain-core"><stop stop-color="#d1b5ff"/><stop offset=".4" stop-color="#947bf4"/><stop offset="1" stop-color="#3d3f87"/></radialGradient><filter id="ng-brain-glow"><feGaussianBlur stdDeviation="9"/></filter></defs>'
 +'<circle cx="268" cy="220" r="194" fill="url(#ng-brain-bg)"/>'+sparks+orbits
 +'<g class="ng-orbit alt"><circle cx="268" cy="220" r="98" stroke="#a48ce8" fill="none" stroke-dasharray="6 16" stroke-opacity=".28"/></g>'
 +links
 +'<circle cx="268" cy="220" r="70" fill="#b198f0" opacity=".13" filter="url(#ng-brain-glow)"/><circle class="ng-core" cx="268" cy="220" r="62" stroke="#cdbfff" stroke-width="1.1" stroke-opacity=".5" fill="url(#ng-brain-core)"/>'
 +'<circle cx="268" cy="220" r="52" fill="none" stroke="#fff" stroke-opacity=".18" stroke-dasharray="2 5"/><path d="M241 218Q240 194 255 196Q276 180 290 197Q308 192 303 218Q312 238 296 243Q280 255 269 245Q247 255 237 239Q224 227 241 218Z" fill="none" stroke="#f3eaff" stroke-opacity=".85" stroke-width="2"/>'
 +'<path d="M268 192V247M242 220L263 218M274 222L302 216M254 196L259 205M289 205L295 243" fill="none" stroke="#f4eaff" stroke-opacity=".65" stroke-width="1.5"/>'
 +'<circle cx="268" cy="218" r="6" fill="#eaf7d7" opacity=".95"/>'+nodes+'</svg>';
}
function shell(mode){
 const isDemo=mode==='demo';
 return '<div class="ng-glow"></div><div class="ng-top"><div><div class="ng-eyebrow"><span class="ng-pulse"></span> LIVING INTELLIGENCE / EXPERIMENT 01</div><h2 class="ng-title">Neural <span>Garden</span> <i style="color:#759989;font-style:normal">×</i> Feature Brain</h2><p class="ng-desc">Every verified 30-minute prediction leaves a trace. The garden mirrors recent outcomes; the brain reveals the model features behind each forecast.</p></div><div class="ng-controls">'
  +'<span class="ng-badge '+(isDemo?'demo':'')+'" data-ng-mode-label>'+(isDemo?'CINEMATIC DEMO · SIMULATED':'REAL OBSERVATIONS · THIS DEVICE')+'</span>'
  +'<button type="button" class="ng-btn" data-ng-toggle>'+(isDemo?'Switch to live data':'Explore interactive demo')+'</button>'
  +'<button type="button" class="ng-btn ng-btn-primary" data-ng-action>'+(isDemo?'▶ Play the trailer':'↻ Sync Learning Lab')+'</button></div></div>'
  +'<div class="ng-views"><div class="ng-scene garden"><div class="ng-scene-meta"><div><div class="ng-suptitle">01 · THE LIVING GARDEN</div><small>Each prediction shapes the ecosystem</small></div><span class="ng-level" data-ng-stage>AWAITING DATA</span></div><div data-ng-garden></div><div class="ng-scene-spot"><div><strong data-ng-garden-title>Seed stage</strong><small data-ng-garden-caption>No verified predictions yet</small></div><span class="ng-signal" data-ng-vitality>—</span></div></div>'
  +'<div class="ng-scene brain"><div class="ng-scene-meta"><div><div class="ng-suptitle">02 · INSIDE THE MODEL</div><small>Click an input node to inspect its influence</small></div><span class="ng-level">10 FEATURES</span></div><div data-ng-brain></div><div class="ng-scene-spot"><div><strong data-ng-brain-insight>Feature intelligence</strong><small data-ng-brain-explain>Explore the weights shaping the 30-minute forecast.</small></div><span class="ng-signal" data-ng-brain-value>COEFFICIENTS</span></div></div></div>'
  +'<div class="ng-data-strip"><section class="ng-panel"><div class="ng-section-label">THE GROWTH LOG · VERIFIED OUTCOMES</div><h3>Evolution, not decoration.</h3><p data-ng-summary>True/false outcomes become growth signals. A miss can reduce vitality; model updates remain independent.</p><div class="ng-progress" data-ng-progress aria-label="Recent verified forecast outcomes"></div><div class="ng-row"><span data-ng-score-label>Verified 30-minute predictions</span><strong data-ng-score>—</strong></div><div class="ng-ledger" data-ng-ledger></div></section>'
  +'<section class="ng-panel"><div class="ng-section-label">PREDICTION ORBIT · NEXT WINDOW</div><h3 data-ng-window-title>Waiting for a locked forecast</h3><p data-ng-window-copy>Predictions are frozen before their start time. Outcomes are only graded after complete public measurements arrive.</p><div class="ng-pred-grid"><div class="ng-pred"><small>MOVE PROBABILITY</small><strong data-ng-prob>—</strong></div><div class="ng-pred violet"><small>RECENT ACCURACY</small><strong data-ng-accuracy>—</strong></div><div class="ng-pred"><small>VERIFIED ROUNDS</small><strong data-ng-total>0</strong></div></div><div class="ng-row"><span>Input status</span><strong data-ng-status>Awaiting Squeekchain history</strong></div></section></div>'
  +'<div class="ng-footer"><b>Methodology:</b> The brain visualizes ten input coefficients of a real <i>logistic regression</i> model (not an actual neural network). A correct/incorrect forecast only changes the visual garden; model parameters update from new recorded measurements. Live prediction records are stored in this browser and cannot run while nobody has the page open. '+(isDemo?'All trailer outcomes and evolution are simulated for design preview; none are official measurements.':'Missing or partial measurements are never counted as misses.')+'</div>';
}
function seededDemo(){return {version:1,rounds:[true,true,false,true,true,true,false,true,true].map((ok,i)=>({start:Date.now()-(9-i)*HALF,madeAt:Date.now()-(10-i)*HALF,p:.48+(i%4)*.13,choice:ok?'run':'still',status:ok?'correct':'wrong',observed:ok?'run':'still'}))}}
class NG {
 constructor(root){this.root=root;this.mode=root.dataset.ngMode==='demo'?'demo':'live';this.real=load();this.demo=seededDemo();this.selected=5;this.playing=null;this.ledgIdx=-1;root.innerHTML=shell(this.mode);this.bind();this.draw();this.sync();}
 q(s){return this.root.querySelector(s)}
 bind(){
  this.q('[data-ng-toggle]').addEventListener('click',()=>{this.stop();this.mode=this.mode==='demo'?'live':'demo';this.selected=5;this.q('[data-ng-mode-label]').textContent=this.mode==='demo'?'CINEMATIC DEMO · SIMULATED':'REAL OBSERVATIONS · THIS DEVICE';this.q('[data-ng-mode-label]').classList.toggle('demo',this.mode==='demo');this.q('[data-ng-toggle]').textContent=this.mode==='demo'?'Switch to live data':'Explore interactive demo';this.q('[data-ng-action]').textContent=this.mode==='demo'?'▶ Play the trailer':'↻ Sync Learning Lab';this.draw();if(this.mode==='live')this.sync()});
  this.q('[data-ng-action]').addEventListener('click',async()=>{if(this.mode==='demo'){this.trailer();return}this.q('[data-ng-action]').disabled=true;this.q('[data-ng-action]').textContent='Syncing…';try{await window.SqueekBrowserLab?.learn?.();this.sync()}finally{this.q('[data-ng-action]').disabled=false;this.q('[data-ng-action]').textContent='↻ Sync Learning Lab'}});
  this.root.addEventListener('click',ev=>{
   const node=ev.target.closest('[data-ng-feature]');if(node){this.selected=Number(node.dataset.ngFeature);this.drawBrain();return}
   const tick=ev.target.closest('[data-ng-result]');if(tick){this.ledgIdx=Number(tick.dataset.ngResult);this.drawLedger();return}
  });
  this.root.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.closest('[data-ng-feature]')){ev.preventDefault();this.selected=Number(ev.target.closest('[data-ng-feature]').dataset.ngFeature);this.drawBrain()}});
  // Gentle pointer parallax only; the model does not change when visitors move the scene.
  const garden=this.q('.ng-scene.garden'),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(garden&&!reduced){
   garden.addEventListener('pointermove',ev=>{
    if(ev.pointerType==='touch')return;
    const rect=garden.getBoundingClientRect(),x=(ev.clientX-rect.left)/rect.width-.5,y=(ev.clientY-rect.top)/rect.height-.5;
    const art=garden.querySelector('.ng-art.garden-svg');
    if(art)art.style.transform='translate3d('+(-x*9).toFixed(1)+'px,'+(-y*6).toFixed(1)+'px,0)';
   });
   garden.addEventListener('pointerleave',()=>{const art=garden.querySelector('.ng-art.garden-svg');if(art)art.style.transform='' });
  }
  window.addEventListener('squeek:learning-ready',()=>{if(this.mode==='live')this.sync()});
  window.addEventListener('storage',e=>{if(e.key===KEY){this.real=load();if(this.mode==='live')this.draw()}});
  setInterval(()=>{if(this.mode==='live')this.sync()},60000);
 }
 stop(){if(this.playing){clearInterval(this.playing);this.playing=null}}
 trailer(){
  this.stop();this.demo=seededDemo();this.demo.rounds=this.demo.rounds.slice(0,3);this.draw();this.q('[data-ng-action]').textContent='Ⅱ Pause trailer';
  const outcomes=[true,true,false,true,true,true,false,true,true];
  let i=0;this.playing=setInterval(()=>{
   const ok=outcomes[i%outcomes.length],n=this.demo.rounds.length;
   this.demo.rounds.push({start:Date.now()+n*HALF,madeAt:Date.now(),p:ok?.81:.68,choice:ok?'run':'still',status:ok?'correct':'wrong',observed:ok?'run':'still'});
   if(this.demo.rounds.length>35)this.demo.rounds.shift();
   this.draw();i++;if(i>=outcomes.length){this.stop();this.q('[data-ng-action]').textContent='▶ Replay trailer'}
  },1400);
 }
 stats(){return realStats((this.mode==='demo'?this.demo:this.real).rounds)}
 model(){return window.SqueekBrowserLab?.model||null}
 draw(){
  const s=this.stats();this.q('[data-ng-garden]').innerHTML=gardenSVG(s);
  this.q('[data-ng-stage]').textContent=this.mode==='demo'?'DEMO · STAGE '+Math.max(2,s.grade):s.grade?'STAGE '+s.grade+' / 7':'UNSCORED · SEED';
  this.q('[data-ng-garden-title]').textContent=this.mode==='demo'?'A growing intelligence garden':s.done.length?'A garden shaped by verified outcomes':'The first seed is planted';
  this.q('[data-ng-garden-caption]').textContent=s.done.length?'Last '+Math.min(s.done.length,30)+' verified rounds · '+s.correct+' correct · '+s.wrong+' missed':'Awaiting first pre-committed verified prediction';
  this.q('[data-ng-vitality]').textContent=s.vitality===null?'NOT YET SCORED':Math.round(s.vitality)+'% VITALITY';
  this.q('[data-ng-score]').textContent=s.done.length?s.correct+' correct / '+s.done.length:'No verified rounds';
  this.q('[data-ng-score-label]').textContent=this.mode==='demo'?'SIMULATED DESIGN DEMO':'VERIFIED HALF-HOUR ROUNDS · DEVICE-LOCAL';
  this.q('[data-ng-accuracy]').textContent=s.acc===null?'—':Math.round(s.acc*100)+'%';
  this.q('[data-ng-total]').textContent=String(s.done.length);
  this.q('[data-ng-summary]').textContent=s.done.length?'Every settled 30-minute result adjusts the garden. '+(s.streak?'Current correct streak: '+s.streak+'. ':'')+'A single missed prediction is a normal learning signal, not proof the model is bad.':'New forecasts will be recorded before each future 30-minute window when this browser is open. Only complete public data can settle a result.';
  this.drawLedger();this.drawBrain();this.drawPrediction();
 }
 drawBrain(){
  const m=this.model(),weight=this.mode==='demo'?[.5,-.82,.96,.25,-.44,1.32,.76,.5,.23,-.2]:Array.isArray(m?.weights)?m.weights:Array(10).fill(0);
  this.q('[data-ng-brain]').innerHTML=brainSVG(weight,this.selected);
  const coeff=weight[this.selected]||0;
  this.q('[data-ng-brain-insight]').textContent='F'+(this.selected+1)+' · '+FEATURE_NAMES[this.selected];
  this.q('[data-ng-brain-explain]').textContent=EXPLAINS[this.selected]+(this.mode==='demo'?' · Illustrative demo weight.':m?' · Actual signed model coefficient.':' · Awaiting real model weights.');
  this.q('[data-ng-brain-value]').textContent=this.mode==='demo'?'DEMO WEIGHT':m?(coeff>=0?'+':'')+coeff.toFixed(3):'NO MODEL';
 }
 drawLedger(){
  const data=(this.mode==='demo'?this.demo:this.real).rounds.slice(-12),box=this.q('[data-ng-ledger]'),progress=this.q('[data-ng-progress]');
  const item=(r,i)=>{
    const color=r.status==='correct'?'correct':r.status==='wrong'?'wrong':r.status==='pending'?'pending':'empty';
    const label=r.status==='correct'?'✓':r.status==='wrong'?'×':r.status==='pending'?'◌':'–';
    return '<button class="ng-mark '+color+'" type="button" data-ng-result="'+i+'" title="'+esc(viewClock(r.start)+' · '+r.status.toUpperCase()+(typeof r.p==='number'?' · '+Math.round(r.p*100)+'% run chance':''))+'" aria-label="'+esc('Prediction '+(i+1)+', '+r.status)+'">'+label+'</button>';
  };
  box.innerHTML=data.length?data.map(item).join(''):'<span class="ng-badge">No predictions settled yet</span>';
  progress.innerHTML=Array.from({length:20},(_,i)=>{
    const j=data.length-20+i,r=j>=0?data[j]:null;
    const h=r?(r.status==='correct'?84:r.status==='wrong'?32:52):9;
    return '<span style="height:'+h+'%" class="'+(r?r.status==='correct'?'ng-good':r.status==='wrong'?'ng-bad':'ng-empty':'ng-empty')+'"></span>';
  }).join('');
  if(this.ledgIdx>=0&&data[this.ledgIdx]){
    const r=data[this.ledgIdx];this.q('[data-ng-summary]').textContent='Window '+new Date(r.start).toLocaleString()+' · Locked '+(typeof r.p==='number'?Math.round(r.p*100)+'% RUN':'—')+' · Outcome '+(r.observed||'pending').toUpperCase()+' · '+r.status.toUpperCase()+'.';
  }
 }
 drawPrediction(){
  const rounds=(this.mode==='demo'?this.demo:this.real).rounds;
  const next=rounds.findLast(r=>r.status==='pending');
  if(this.mode==='demo'){
   this.q('[data-ng-window-title]').textContent='Predicting next wheel activity';
   this.q('[data-ng-window-copy]').textContent='Illustrative: at every UTC 30-minute boundary the model locks a probability, then evaluates against measured activity.';
   this.q('[data-ng-prob]').textContent='74%';this.q('[data-ng-status]').textContent='SIMULATED • DESIGN PREVIEW';
  }else if(next){
   this.q('[data-ng-window-title]').textContent=viewClock(next.start)+'–'+viewClock(next.start+HALF)+' · PENDING';
   this.q('[data-ng-window-copy]').textContent='Frozen '+new Date(next.madeAt).toLocaleTimeString()+' before this window. Predicted '+(next.choice==='run'?'RUN':'QUIET')+'. Waiting for a complete official 30-minute measurement.';
   this.q('[data-ng-prob]').textContent=Math.round(next.p*100)+'%';this.q('[data-ng-status]').textContent='LOCKED • THIS BROWSER';
  }else{
   this.q('[data-ng-window-title]').textContent='Next forecast awaiting a valid input';
   this.q('[data-ng-window-copy]').textContent='Once the model has enough complete, recent history, it will lock a forecast before the next half-hour starts. No fabricated outcomes.';
   this.q('[data-ng-prob]').textContent='—';this.q('[data-ng-status]').textContent=this.model()?'WAITING FOR COMPLETE DATA':'MODEL NOT READY';
  }
 }
 sync(){
  if(this.mode!=='live')return;
  const lab=window.SqueekBrowserLab,raw=lab?.history,model=lab?.model;
  if(!raw?.activity?.days||!Array.isArray(model?.weights)){this.draw();return}
  const buckets=lab?.getBuckets?.()||[];
  const map=new Map(buckets.filter(x=>x.work!==null).map(x=>[x.at,x]));
  let touched=false;
  for(const r of this.real.rounds){
   if(r.status!=='pending'||Date.now()<r.start+HALF)continue;
   const actual=map.get(r.start);
   if(actual){r.observed=actual.work>0?'run':'still';r.status=r.observed===r.choice?'correct':'wrong';r.scoredAt=Date.now();touched=true}
   else if(Date.now()-r.start>48*3600000){r.status='unverified';r.observed=null;touched=true}
  }
  const start=(Math.floor(Date.now()/HALF)+1)*HALF;
  if(!this.real.rounds.some(r=>r.start===start)){
   const p=lab?.predictForWindow?.(start);
   if(p&&Number.isFinite(p.p)&&p.inputThrough<start&&Date.now()<start){
    this.real.rounds.push({start,madeAt:Date.now(),p:p.p,choice:p.p>=.5?'run':'still',inputThrough:p.inputThrough,status:'pending',source:'Squeekchain public stats / logistic-v2'});
    touched=true;
   }
  }
  if(touched){this.real.rounds=this.real.rounds.slice(-160);save(this.real);this.ledgIdx=-1}
  this.draw();
 }
}
function boot(){document.querySelectorAll('[data-neural-garden]').forEach(root=>{if(!root.__ng)root.__ng=new NG(root)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();