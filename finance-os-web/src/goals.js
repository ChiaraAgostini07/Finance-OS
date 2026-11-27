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
