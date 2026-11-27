import * as d from './domain.js';
import * as store from './store.js';
// A second independent key; neither the password nor plaintext ledger is part of the normal profile.
export async function createPrivate(password){
 if(typeof password!=='string'||password.length<12||password.length>256||password.startsWith('/')||password!==password.trim())throw Error('Usa almeno 12 caratteri (massimo 256), senza spazi iniziali/finali né / iniziale.');
 const salt=crypto.getRandomValues(new Uint8Array(16));const key=await store.key(password,salt);
 const data={version:1,transactions:[]};return {version:1,salt:btoa(String.fromCharCode(...salt)),payload:await store.seal(data,key)};
}
export async function unlockPrivate(envelope,password){
 if(envelope?.version!==1||typeof password!=='string'||password.length>256)throw Error('Accesso non riuscito.');
 try{const key=await store.key(password,Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0)));const data=await store.open(envelope.payload,key);if(data.version!==1||!Array.isArray(data.transactions))throw Error();return {key,data};}catch{throw Error('Accesso non riuscito.');}
}
export async function sealPrivate(envelope,key,data){return {...envelope,payload:await store.seal(data,key)};}
export function privateMovement(v,id=d.uid()){
 const description=String(v.description??'').trim(), date=String(v.date??''),note=String(v.note??'').trim(),amount=d.minor(v.amount);
 if(!description||description.length>150||note.length>1000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||amount===0||!Number.isSafeInteger(amount))throw Error('Controlla descrizione, data e importo diverso da zero.');
 return {id,description,date,note,amount};
}
export function privateTotals(data){return data.transactions.reduce((a,t)=>{if(t.amount>0)a.income+=t.amount;else a.expense-=t.amount;a.net+=t.amount;return a;},{income:0,expense:0,net:0});}
export function publicExport(s){const {privateEnvelope,...rest}=s;return rest;}
