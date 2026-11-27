import * as d from './domain.js';
import {createPrivate,unlockPrivate,sealPrivate,privateMovement,privateTotals} from './private-ledger.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// No search terms are persisted. Password entry is only processed on Enter.
export function wirePrivateSearch({el,input,s,change,modal,demo}){
 let busy=false,masked=false;const results=el.querySelector('.search-results');
 const message=(t)=>{results.replaceChildren();const p=document.createElement('p');p.className='muted';p.textContent=t;results.append(p)};
 input.addEventListener('keydown',async e=>{
  if(e.key!=='Enter'||e.isComposing)return;e.preventDefault();e.stopPropagation();if(busy)return;
  const value=input.value;if(value==='/privato configura'){
   input.value='';if(demo){message('Disponibile nel profilo personale, non nella demo.');return;}
   if(s.privateEnvelope){message('Configurazione già esistente. Usa la password per accedere.');return;}
   el.close();setup({modal,change});return;
  }
  if(value==='/privato'&&!masked){masked=true;input.value='';input.type='password';input.placeholder='Password';input.oninput=null;message('Inserisci la password e premi Invio.');return;}
  if(!s.privateEnvelope)return;
  busy=true;input.value='';input.disabled=true;message('Verifica…');
  try{const opened=await unlockPrivate(s.privateEnvelope,value);if(!el.open)return;el.close();workspace({modal,s,change,...opened});}
  catch{if(el.open)message('Nessun risultato.');}finally{busy=false;if(el.open){input.disabled=false;input.focus();}}
 });
}
function setup({modal,change}){
 const el=modal('Configura spazio riservato',`<p class="muted">Password indipendente da quella del profilo. Conservatela: senza di essa i dati privati non sono recuperabili. Non usare la stessa password.</p><form class="stack private-setup"><label>Password (min. 12 caratteri)<input type="password" name="pass" minlength="12" maxlength="256" autocomplete="new-password" required></label><label>Ripeti password<input type="password" name="repeat" minlength="12" maxlength="256" autocomplete="new-password" required></label><button>Crea spazio cifrato</button></form>`);
 const f=el.querySelector('form');f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('button'),v=new FormData(f);btn.disabled=true;try{if(v.get('pass')!==v.get('repeat'))throw Error('Le password non coincidono.');const envelope=await createPrivate(v.get('pass'));if(!el.open)return;await change('Aggiornamento profilo',s=>{if(s.privateEnvelope)throw Error('Spazio già configurato.');s.privateEnvelope=envelope});f.reset();el.close();}catch(err){el.querySelector('.notice').textContent=err.message;}finally{btn.disabled=false;}};
}
function workspace({modal,s,change,key,data}){
 let envelope=s.privateEnvelope,closed=false,busy=false,timer,editing=null;
 const el=modal('Spazio riservato',`<div class="private-body"></div>`);el.classList.add('private-dialog');const body=el.querySelector('.private-body');
 const close=()=>{if(el.open)el.close()};
 const idle=()=>{clearTimeout(timer);if(!closed)timer=setTimeout(close,180000)};
 const onHidden=()=>{if(document.hidden)close()};
 const clean=()=>{if(closed)return;closed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',onHidden);body.replaceChildren();data=null;key=null;editing=null;};
 el.addEventListener('close',clean,{once:true});document.addEventListener('visibilitychange',onHidden);el.addEventListener('pointerdown',idle);el.addEventListener('keydown',idle);idle();
 function draw(){if(closed||!el.open)return;const totals=privateTotals(data),t=editing?data.transactions.find(t=>t.id===editing):null;
 body.innerHTML=`<p class="private-intro">Registro separato e cifrato. Non compare nei saldi, nelle ricerche o nei report ordinari. Chiusura automatica dopo 3 minuti di inattività o quando nascondi la scheda.</p><div class="private-totals">${[['Entrate',totals.income],['Uscite',totals.expense],['Saldo del registro',totals.net]].map(([k,v])=>`<div><small>${k}</small><strong>${d.money(v)}</strong></div>`).join('')}</div><form class="stack private-form"><h3>${t?'Modifica movimento':'Nuovo movimento privato'}</h3><label>Descrizione<input name="description" maxlength="150" value="${esc(t?.description)}" required></label><div class="private-fields"><label>Data<input type="date" name="date" value="${esc(t?.date||d.today())}" required></label><label>Importo con segno (€)<input name="amount" inputmode="decimal" value="${t?esc(String(t.amount/10000).replace('.',',')):''}" placeholder="−50,00 oppure 100,00" required></label></div><label>Nota facoltativa<textarea name="note" maxlength="1000" rows="2">${esc(t?.note)}</textarea></label><div class="row"><button>${t?'Salva modifica':'Registra movimento'}</button>${t?'<button type="button" class="secondary" data-cancel-edit>Annulla</button>':''}</div></form><div class="private-list"><h3>Movimenti registrati</h3>${[...data.transactions].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<article><div><strong>${esc(t.description)}</strong><small>${esc(t.date)}</small>${t.note?`<p>${esc(t.note)}</p>`:''}</div><b class="${t.amount<0?'negative':'positive'}">${d.money(t.amount)}</b><div class="row"><button class="secondary" data-private-edit="${esc(t.id)}">Modifica</button><button class="secondary" data-private-delete="${esc(t.id)}">Elimina</button></div></article>`).join('')||'<p class="muted">Nessun movimento privato.</p>'}</div><button class="secondary" data-private-lock>Chiudi e blocca</button>`;
 const f=body.querySelector('form');f.onsubmit=async e=>{e.preventDefault();try{const tx=privateMovement(Object.fromEntries(new FormData(f)),editing||d.uid());await save(next=>{next.transactions=next.transactions.filter(t=>t.id!==tx.id);next.transactions.push(tx)});editing=null;draw();}catch(err){if(!closed)el.querySelector('.notice').textContent=err.message}};
 body.querySelector('[data-cancel-edit]')?.addEventListener('click',()=>{editing=null;draw()});body.querySelectorAll('[data-private-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.privateEdit;draw();body.querySelector('input').focus()});body.querySelectorAll('[data-private-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Eliminare questo movimento privato?'))return;try{await save(next=>next.transactions=next.transactions.filter(t=>t.id!==b.dataset.privateDelete));editing=null;draw()}catch(err){if(!closed)el.querySelector('.notice').textContent=err.message}});body.querySelector('[data-private-lock]').onclick=close;
 }
 async function save(fn){if(busy||closed)throw Error('Operazione non disponibile.');busy=true;body.querySelectorAll('button').forEach(b=>b.disabled=true);el.querySelector('.notice').textContent='';try{const next=structuredClone(data);fn(next);const updated=await sealPrivate(envelope,key,next);if(closed)throw Error('Spazio bloccato.');await change('Aggiornamento profilo',state=>{if(state.privateEnvelope!==envelope)throw Error('Dati cambiati: riapri lo spazio riservato.');state.privateEnvelope=updated});if(!closed){data=next;envelope=updated;idle()}}finally{busy=false;if(!closed)body.querySelectorAll('button').forEach(b=>b.disabled=false)}}
 draw();
}
