import * as d from './domain.js';
export const assetTypes=['Azioni','ETF','Obbligazioni','Fondi','Criptovalute','Materie prime','Altro'];
const MAX=BigInt(Number.MAX_SAFE_INTEGER),SCALE=1000000n;
const safe=n=>{if(n>MAX||n< -MAX)throw Error('Importo troppo grande.');return Number(n)};
const div=(a,b)=>(a+b/2n)/b;
export function quantity(v){let s=String(v??'').trim().replace(',','.');if(!/^\d+(\.\d{1,6})?$/.test(s))throw Error('Quantità non valida (massimo 6 decimali).');let [a,b='']=s.split('.');let n=safe(BigInt(a)*SCALE+BigInt(b.padEnd(6,'0')));if(n<=0)throw Error('Quantità positiva richiesta.');return n}
export function qtyText(n){return String(n/1e6)}
const cash=(x,zero=true)=>{let n=d.minor(x);if(n<0||(!zero&&n===0))throw Error('Importo non valido.');return n};
const text=(x,max=120)=>{let t=String(x??'').trim();if(t.length>max)throw Error('Testo troppo lungo.');return t};
export function ticker(v){let s=text(v,40).toUpperCase();if(s&&!/^[A-Z0-9][A-Z0-9._:/-]*$/.test(s))throw Error('Ticker non valido. Es. NASDAQ:AAPL');return s}
export function marketUrl(v){return 'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(ticker(v))}
const date=v=>{let s=String(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s||s>d.today())throw Error('Data non valida o futura.');return s};
const value=(q,p)=>safe(div(BigInt(q)*BigInt(p),SCALE));
export function createPosition(v,id=d.uid()){
 const name=text(v.name);if(!name)throw Error('Inserisci il nome dello strumento.');const type=assetTypes.includes(v.type)?v.type:'Altro';const amount=cash(v.amount),units=v.quantity==='0'?0:v.quantity?quantity(v.quantity):null,price=v.price===''||v.price==null?null:cash(v.price);
 if(units===0&&(amount!==0||(price!=null&&price!==0)))throw Error('Una posizione chiusa deve avere costo e valore zero.');
 if(v.quantity&&price!==null&&units===null)throw Error('Quantità non valida.');
 return {id,name,ticker:ticker(v.ticker),type,amount,price,units,broker:text(v.broker,80),quoteDate:price!==null?date(v.date||d.today()):null,events:[]};
}
export function editPosition(row,v){const info=createPosition(v,row.id);if(row.events?.some(e=>e.kind!=='dividend')&&(info.units!==row.units||info.amount!==row.amount))throw Error('Quantità e costo sono gestiti dalle operazioni registrate.');Object.assign(row,info,{events:row.events||[]});return row}
export function applyOperation(row,v,id=d.uid()){
 const kind=v.kind,day=date(v.date),fee=cash(v.fee||'0');if(!['buy','sell','dividend'].includes(kind))throw Error('Operazione sconosciuta.');const events=row.events||[];if(events.some(e=>e.id===id))throw Error('Operazione duplicata.');if(events.length&&day<events.at(-1).date)throw Error('Registra le operazioni in ordine cronologico.');
 let units=row.units,amount=row.amount,price=row.price,realized=0,net=0,q=0,unitPrice=0,gross=0;
 if(kind==='dividend'){gross=cash(v.total,false);net=gross-fee;if(net<0)throw Error('Costi superiori al dividendo.');}
 else {if(!Number.isSafeInteger(units)||units<0)throw Error('Imposta prima la quantità realmente detenuta nella posizione.');q=quantity(v.quantity);unitPrice=cash(v.unitPrice,false);gross=value(q,unitPrice);if(!gross)throw Error('Valore operazione troppo piccolo.');if(kind==='buy'){units=safe(BigInt(units)+BigInt(q));amount=safe(BigInt(amount)+BigInt(gross)+BigInt(fee));net=-safe(BigInt(gross)+BigInt(fee));}else{if(q>units)throw Error('Quantità superiore alla disponibilità.');if(fee>gross)throw Error('Costi superiori al ricavato.');let cost=q===units?amount:safe(div(BigInt(amount)*BigInt(q),BigInt(units)));units-=q;amount-=cost;net=gross-fee;realized=net-cost;}if(row.price!=null&&row.units>0)price=safe(div(BigInt(row.price)*BigInt(units),BigInt(row.units)));else price=units===0?0:null;}
 const event={id,kind,date:day,quantity:q,unitPrice,gross,fee,net,realized};Object.assign(row,{units,amount,price,events:[...events,event]});return event;
}
export function summary(rows){let cost=0,value=0,knownCost=0,missing=0,realized=0,dividends=0,fees=0;const allocation=new Map(),events=[];for(const r of rows){cost+=r.amount;if(r.price==null){if(r.units!==0)missing++;}else{value+=r.price;knownCost+=r.amount;let k=assetTypes.includes(r.type)?r.type:'Altro';allocation.set(k,(allocation.get(k)||0)+r.price);}for(const e of r.events||[]){realized+=e.realized;fees+=e.fee;if(e.kind==='dividend')dividends+=e.net;events.push({...e,name:r.name,scope:r.__scope});}}return {cost,value,missing,knownCost,gain:value-knownCost,realized,dividends,fees,allocation:[...allocation].sort((a,b)=>b[1]-a[1]),events:events.sort((a,b)=>b.date.localeCompare(a.date))}}
export function validateInvestments(s){for(const r of s.portfolio||[]){if(r.units!=null&&(!Number.isSafeInteger(r.units)||r.units<0))throw Error('Quantità non valida nel portafoglio.');if(r.events!=null){if(!Array.isArray(r.events)||r.events.length>100000)throw Error('Registro investimenti non valido.');const ids=new Set();for(const e of r.events){if(!e||typeof e.id!=='string'||!(/^[a-zA-Z0-9_.-]{1,160}$/).test(e.id)||ids.has(e.id)||!['buy','sell','dividend'].includes(e.kind)||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!['quantity','unitPrice','gross','fee','net','realized'].every(k=>Number.isSafeInteger(e[k]))||e.quantity<0||e.gross<0||e.fee<0||e.unitPrice<0)throw Error('Operazione investimento non valida.');ids.add(e.id);}}}return s}
