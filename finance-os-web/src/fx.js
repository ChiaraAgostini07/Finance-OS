// EUR remains the accounting currency. FX is an explicit independent calculator.
export const FX_ENDPOINT='https://api.frankfurter.dev/v1/latest?base=EUR';
export const currencies=(()=>{let list;try{list=Intl.supportedValuesOf('currency')}catch{list=['EUR','USD','GBP','CHF','JPY','CAD','AUD','CNY','INR','BRL','SEK','NOK','DKK','PLN','CZK','HUF','KRW','MXN','ZAR','TRY','NZD','HKD','SGD']}return [...new Set(['EUR',...list])].sort()})();
export function decimal(raw){const s=String(raw).trim().replace(',','.');if(!/^\d+(?:\.\d{1,8})?$/.test(s)||!Number.isFinite(Number(s))||Number(s)>1e12)throw Error('Inserisci un numero positivo valido (massimo 8 decimali).');return Number(s)}
export function validateRates(data){if(data?.base!=='EUR'||typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date))||new Date(data.date).toISOString().slice(0,10)!==data.date||data.date>new Date().toISOString().slice(0,10)||!data.rates||typeof data.rates!=='object'||Array.isArray(data.rates))throw Error('Risposta cambi non valida.');const rates={EUR:1};for(const [code,rate] of Object.entries(data.rates))if(currencies.includes(code)&&code!=='EUR'&&typeof rate==='number'&&Number.isFinite(rate)&&rate>0&&rate<1e12)rates[code]=rate;if(Object.keys(rates).length<2)throw Error('Nessun tasso valido.');return {date:data.date,rates}}
export function convert(amount,from,to,table,manual=null,fee=0){if(!currencies.includes(from)||!currencies.includes(to)||!Number.isFinite(amount)||amount<0||!Number.isFinite(fee)||fee<0||fee>100)throw Error('Parametri non validi');const a=table?.rates?.[from],b=table?.rates?.[to];const rate=from===to?1:manual??(a>0&&b>0?b/a:NaN);if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(amount*rate))throw Error('Cambio non disponibile: aggiorna i tassi o inserisci un cambio manuale.');return {rate,gross:amount*rate,net:amount*rate*(1-fee/100)}}
export async function fetchRates(fetcher=fetch){const res=await fetcher(FX_ENDPOINT,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(10000):undefined});if(!res.ok)throw Error('Servizio cambi non disponibile.');return validateRates(await res.json())}

// V2 offers broader coverage. A quote may have a different observation date from another.
export const FX_V2_ENDPOINT='https://api.frankfurter.dev/v2/rates?base=EUR';
export function validateV2(rows){
 if(!Array.isArray(rows)||rows.length>2000)throw Error('Tabella cambi non valida.');
 const rates=Object.create(null),dates=Object.create(null);rates.EUR=1;
 const today=new Date().toISOString().slice(0,10);
 for(const r of rows){if(r?.base!=='EUR'||!currencies.includes(r.quote)||r.quote==='EUR'||typeof r.rate!=='number'||!Number.isFinite(r.rate)||r.rate<=0||r.rate>=1e12||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||r.date>today)continue;if(!dates[r.quote]||r.date>=dates[r.quote]){rates[r.quote]=r.rate;dates[r.quote]=r.date;}}
 if(Object.keys(rates).length<2)throw Error('Nessun tasso valido.');
 const days=Object.values(dates).sort();return {rates,dates,date:days.at(-1),source:'Frankfurter v2'};
}
export async function fetchWorldRates(fetcher=fetch){
 const opts={credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(8000):undefined,redirect:'error'};
 try{const res=await fetcher(FX_V2_ENDPOINT,opts);if(!res.ok)throw Error();return validateV2(await res.json());}catch{const table=await fetchRates(fetcher);return {...table,source:'Frankfurter v1 / BCE'};}
}
export function quoteDates(table,from,to){if(!table)return '';const days=[from,to].filter(x=>x!=='EUR').map(x=>table.dates?.[x]||table.date).filter(Boolean);return [...new Set(days)].join(' / ')}
