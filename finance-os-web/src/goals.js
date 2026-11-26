import {minor} from './domain.js';
export function goalProgress(g){const ratio=g.amount>0?Math.max(0,Math.min(1,g.saved/g.amount)):0;return {ratio,percent:ratio===1?100:Math.floor(ratio*100),remaining:Math.max(0,g.amount-g.saved)}}
export function updateSavings(g,raw,direction,now=new Date().toISOString()){
  if(!g||!Number.isSafeInteger(g.saved)||g.saved<0)throw Error('Obiettivo non valido.');
  if(!['deposit','withdraw'].includes(direction))throw Error('Operazione non valida.');
  const n=minor(raw);if(n<=0)throw Error('Inserisci un importo maggiore di zero.');
  const delta=direction==='withdraw'?-n:n,next=g.saved+delta;
  if(!Number.isSafeInteger(next))throw Error('Importo troppo grande.');
  if(next<0)throw Error('Non puoi prelevare più di quanto hai accantonato.');
  g.history??=[];g.history.push({date:now,delta,balance:next,type:direction});g.saved=next;return next;
}

// A separate operation preserves the goal and records the exact amount removed.
export function emptySavings(g,now=new Date().toISOString()){
 if(!g||!Number.isSafeInteger(g.saved)||g.saved<=0)throw Error('Il salvadanaio è già vuoto o non valido.');
 const delta=-g.saved;g.history??=[];g.history.push({date:now,delta,balance:0,type:'empty'});g.saved=0;return 0;
}
// Seeded scatter: the same goal keeps its arrangement across navigation and reloads.
// Continuous positions and varying orientations, no rows or repeated textures.
export function scatteredCash(id){
 let seed=2166136261;for(const c of String(id??'')){seed=Math.imul(seed^c.charCodeAt(0),16777619)}
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const out=[];for(let i=0;i<85;i++){const y=66+rnd()*143,span=82*Math.sqrt(Math.max(.1,1-((y-133)/84)**2));const x=184+(rnd()*2-1)*span+(y>110&&y<165?rnd()*24:0);const kind=rnd()<.29?'note':'coin';out.push({x:Math.round(x),y:Math.round(y),scale:.53+rnd()*.43,rotation:(rnd()-.5)*(kind==='note'?145:175),kind,rank:y+rnd()*22})}
 return out.sort((a,b)=>b.rank-a.rank).map((o,index)=>({...o,index}));
}
