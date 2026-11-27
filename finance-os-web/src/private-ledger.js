import * as d from './domain.js';
import * as store from './store.js';
// A second independent key; neither the password nor plaintext ledger is part of the normal profile.
export async function createPrivate(password, initial={version:1,transactions:[]}){
 if(typeof password!=='string'||password.length<12||password.length>256||password.startsWith('/')||password!==password.trim())throw Error('Usa almeno 12 caratteri (massimo 256), senza spazi iniziali/finali né / iniziale.');
 const salt=crypto.getRandomValues(new Uint8Array(16));const key=await store.key(password,salt);
 const data=initial;return {version:1,salt:btoa(String.fromCharCode(...salt)),payload:await store.seal(data,key)};
}
export async function unlockPrivate(envelope,password){
 if(envelope?.version!==1||typeof password!=='string'||password.length>256)throw Error('Accesso non riuscito.');
 try{const key=await store.key(password,Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0)));const data=await store.open(envelope.payload,key);if(![1,2].includes(data.version)||!Array.isArray(data.transactions))throw Error();if(data.version===2)validateWorkspace(data);return {key,data};}catch{throw Error('Accesso non riuscito.');}
}
export async function sealPrivate(envelope,key,data){return {...envelope,payload:await store.seal(data,key)};}
export function privateMovement(v,id=d.uid()){
 const description=String(v.description??'').trim(), date=String(v.date??''),note=String(v.note??'').trim(),amount=d.minor(v.amount);
 if(!description||description.length>150||note.length>1000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||amount===0||!Number.isSafeInteger(amount))throw Error('Controlla descrizione, data e importo diverso da zero.');
 return {id,description,date,note,amount};
}
export function privateTotals(data){return data.transactions.reduce((a,t)=>{if(t.amount>0)a.income+=t.amount;else a.expense-=t.amount;a.net+=t.amount;return a;},{income:0,expense:0,net:0});}
export function publicExport(s){const {privateEnvelope,...rest}=s;return rest;}

// Use the same financial model as the normal workspace, with an independent state.
export function validateWorkspace(data){
 if(!data||data.version!==2||data.privateEnvelope!==undefined||!Array.isArray(data.widgets)||!['light','dark','system'].includes(data.theme))throw Error('Backup privato non valido.');
 for(const name of ['accounts','transactions','budgets','recurring','goals','assets','liabilities','portfolio','audit'])if(!Array.isArray(data[name]))throw Error('Backup privato non valido.');
 return data;
}
export function newPrivateWorkspace(theme='light'){return {...d.empty(),theme:['light','dark','system'].includes(theme)?theme:'light',version:2};}
export function upgradePrivateWorkspace(data,theme='light'){
 if(data.version===2)return validateWorkspace(data);
 if(data.version!==1||!Array.isArray(data.transactions))throw Error('Registro privato non valido.');
 const next=newPrivateWorkspace(theme);
 if(data.transactions.length){const id=d.uid();next.accounts.push({id,name:'Registro privato precedente',type:'Cash',opening:0,date:data.transactions.map(t=>t.date).sort()[0],currency:'EUR'});next.transactions=data.transactions.map(t=>({...t,account:id,kind:t.amount<0?'Expense':'Income',status:'Confirmed',category:''}));}
 return next;
}
export async function savePrivateWorkspace(parent,envelope,key,data){
 validateWorkspace(data);
 if(parent.data.privateEnvelope!==envelope)throw Error('Spazio privato cambiato: riaprilo.');
 const updated=await sealPrivate(envelope,key,data);
 parent.data.privateEnvelope=updated;
 try{await store.save(parent);}catch(e){parent.data.privateEnvelope=envelope;throw e;}
 return updated;
}
