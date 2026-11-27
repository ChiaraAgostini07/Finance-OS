// ISO country/territory index. Rates are informational, never applied to the ledger.
export const COUNTRY_CODES='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const P='https://taxsummaries.pwc.com/quick-charts/capital-gains-tax-cgt-rates';
const T='https://taxfoundation.org/data/all/eu/capital-gains-tax-rates-europe/';
// General individual headline rates, not universally applicable to securities.
const headline={AL:'15%',AO:'10%',AR:'15%',AM:'10–20%',AT:'27,5%',AZ:'14%',BD:'15% (azioni quotate)',BW:'25%',BR:'15–22,5%',BG:'10%',CV:'1% (partecipazioni)',KH:'20%',CM:'16,5% (azioni)',CL:'fino al 40%',CN:'20%',CR:'15% (regimi speciali)',HR:'12%',EC:'10% (partecipazioni)',EG:'0 / 10 / 27,5%',SV:'10 / 30%',ET:'15% (azioni e obbligazioni)',GA:'25%',GT:'10%',GY:'20%',HN:'10%',HU:'15% (+ contributi possibili)',IS:'22%',IL:'25%',ME:'15%',MA:'20%',MZ:'10–32%',MM:'10%',NI:'15%',MK:'10%',PE:'5%',RW:'10%',RS:'15%',ZA:'fino al 18% effettivo',SE:'30%',UA:'18% + 5% prelievo militare',MG:'20%',PG:'15% (attività limitate)',AU:'Imposta sul reddito',BA:'Imposta sul reddito',CG:'Imposta sul reddito',DO:'Imposta sul reddito',GQ:'Imposta sul reddito',ID:'Regole per strumento',IQ:'Imposta sul reddito',MR:'Imposta sul reddito',NG:'Imposta sul reddito',PY:'Imposta sul reddito',SN:'Imposta sul reddito',TH:'Imposta sul reddito'};
const special={
 MX:['10% (borsa messicana)','Per residenti, realizzi tramite mercato azionario messicano: 10% del risultato netto annuale. Altre cessioni possono avere un regime diverso.','https://taxsummaries.pwc.com/mexico/individual/income-determination'],
 TW:['Regole per strumento','Non esiste una CGT separata generale; titoli negoziabili e immobili seguono regole ed eccezioni specifiche.','https://taxsummaries.pwc.com/taiwan/individual/income-determination'],
 KE:['15% (riferimento generale)','Indicazione generale sulle plusvalenze; verificare l’esenzione o la disciplina del singolo titolo prima di usare l’aliquota.','https://taxsummaries.pwc.com/kenya'],

 QA:['0% (condizionato)','Cessioni di titoli personali esenti se non appartengono a un’attività imponibile; regole diverse per non residenti.','https://taxsummaries.pwc.com/qatar/individual/income-determination'],
 UY:['12% (titoli locali)','Partecipazioni in società uruguaiane soggette all’imposta societaria; investimenti esteri seguono regole specifiche.','https://taxsummaries.pwc.com/uruguay/individual/income-determination'],
 TZ:['10% (residenti, riferimento)','Indicazione generale; aliquote e imponibile variano secondo il bene e la residenza.','https://taxsummaries.pwc.com/tanzania'],
 PK:['Variabile','Titoli quotati: periodo di acquisto, detenzione e condizioni del contribuente determinano l’imposta.','https://taxsummaries.pwc.com/pakistan/individual/income-determination'],
 SA:['Regime da verificare','Non esiste un’imposta personale generale sul reddito; ciò non implica esenzione per ogni investimento o attività.','https://taxsummaries.pwc.com/saudi-arabia/individual/income-determination'],

 SG:['0% (in generale)','Le plusvalenze da investimenti personali sono generalmente non imponibili; attività commerciale da valutare.','https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/what-is-taxable-what-is-not/gains-from-sale-of-property-shares-and-financial-instruments'],
 HK:['0% (beni di capitale)','Distinguere le plusvalenze patrimoniali dai profitti imponibili di attività commerciali.','https://www.ird.gov.hk/eng/tax/bus_pft.htm'],
 AE:['Esclusione investimenti personali','I redditi da investimento personale della persona fisica non rientrano nella corporate tax; verificare natura e residenza.','https://tax.gov.ae/en/taxes/corporate.tax/corporate.tax.topics/basis.of.taxation.natural.person.aspx'],
 KR:['Variabile','Azioni quotate e partecipazioni rilevanti seguono regole differenti; per grandi azionisti possono applicarsi aliquote 22–27,5%, o 33% in alcuni casi.','https://taxsummaries.pwc.com/republic-of-korea/individual/income-determination'],
 IT:['26%','Azioni e molti titoli: regime ordinario. Titoli pubblici qualificati: 12,5%; criptoattività con regole proprie. Verificare la compensabilità delle minusvalenze.','https://taxsummaries.pwc.com/italy/individual/income-determination'],
 DE:['26,375%','25% più solidarietà; eventuale imposta ecclesiastica.',P],
 FR:['31,4% (PFU)','Dal 2026 la maggior parte delle plusvalenze mobiliari è soggetta al PFU, con possibili sovrattasse o regimi alternativi.','https://taxsummaries.pwc.com/france/individual/taxes-on-personal-income'],
 ES:['fino al 30%','Aliquote progressive sul reddito da risparmio dei residenti.',P],
 GB:['18% / 24%','Dipende dalla fascia di reddito, dal bene e dalle franchigie.','https://www.gov.uk/capital-gains-tax/rates'],
 US:['0% / 15% / 20%','Aliquote federali per molte plusvalenze a lungo termine; imposte statali e NIIT possibili.','https://www.irs.gov/taxtopics/tc409'],
 CA:['50% della plusvalenza imponibile','La quota imponibile confluisce nel reddito ordinario; non è un’aliquota del 50%.',P],
 BE:['10%','Regime 2026: franchigia annuale di 10.000 EUR; regole differenti per partecipazioni rilevanti e speculazione.',P],
 CH:['0% (condizionato)','Plusvalenze su azioni detenute privatamente generalmente esenti, salvo qualifica di operatore professionale. Regole diverse per immobili.','https://taxsummaries.pwc.com/switzerland/individual/income-determination'],
 JP:['20,315%','Cessione di azioni; altri beni soggetti a regole diverse.',P],
 IN:['12,5% / 20%','Titoli qualificati: lungo/breve termine, soglie e maggiorazioni da verificare.',P],
 FI:['30% / 34%','Scaglioni del reddito da capitale: soglia 30.000 EUR.',P],
 DK:['27% / 42%','Reddito azionario, aliquote progressive.',T],
 EE:['22%','Aliquota indicata per il 2026 nella tabella europea.',T],
 CY:['0% (condizionato)','Titoli quotati qualificati; immobili e società immobiliari seguono altre regole.',T],
 CZ:['0% (condizionato)','Esenzione subordinata al periodo di detenzione e ai requisiti.',T],
 GE:['0% (condizionato)','Azioni detenute oltre due anni: verificare requisiti.',T],
 GR:['0% / 15%','Partecipazioni quotate: rileva la quota detenuta.',T],
 LU:['0% (condizionato)','Piccole partecipazioni detenute almeno sei mesi; altri casi progressivi.',T],
 MT:['0% (condizionato)','Titoli quotati su mercati riconosciuti: verificare esclusioni.',T],
 MD:['6% indicativo','Metà della plusvalenza soggetta all’imposta personale.',T],
 NL:['Regime Box 3','Il 36% riguarda il rendimento imponibile del regime patrimoniale, non una semplice tassa sulla vendita.',T],
 NO:['37,84%','Aliquota effettiva indicativa per azioni.',P],
 PL:['19%','Trasferimento di azioni.',P],
 PT:['28% ordinario','Riduzioni per detenzione e possibili scaglioni: verificare durata e reddito.',T],
 RO:['Variabile','Regole modificate e dipendenti da intermediario; consultare fonte aggiornata.',P],
 SK:['0% (condizionato)','Esenzione per titoli qualificati detenuti oltre un anno.',T],
 SI:['0–25%','Dipende dagli anni di possesso; esenzione dopo 15 anni.',T],
 TR:['0% (condizionato)','Titoli quotati e requisiti di detenzione; non vale per tutti i beni.',T],
 LV:['25,5% (+ possibili 3%)','Possibile maggiorazione per redditi elevati.',T],
 LT:['fino al 32%','La sintesi PwC è stata aggiornata a novembre 2026; verificare l’anno fiscale applicabile.',P],
 IE:['31% (dal 7/10/2026)','Prima del 7 ottobre 2026: 33% ordinario. Fondi e ETF possono avere un regime diverso (38% per fondi qualificati dal 2026).','https://www.revenue.ie/en/gains-gifts-and-inheritance/transfering-an-asset/how-to-calculate-CGT.aspx'],
 NZ:['Nessuna CGT generale','Alcune vendite sono comunque reddito imponibile: non equivale a esenzione universale.',P],
 CO:['15% (condizionato)','Beni detenuti almeno due anni; altrimenti regime ordinario.',P],
 GH:['Progressiva / 25%','Possibile opzione per realizzi da investimenti; controllare condizioni.',P],
 JM:['Nessuna CGT generale','Possibile imposta di trasferimento su titoli e immobili.',P]
};
const names=new Intl.DisplayNames(['it'],{type:'region'});
export const taxCountries=COUNTRY_CODES.map(code=>{const spec=special[code],rate=spec?.[0]||headline[code]||null;return {code,name:code==='XK'?'Kosovo':names.of(code),rate,detail:spec?.[1]||(rate?'Indicatore generale per persone fisiche; verificare strumento, residenza ed eccezioni.':'Scheda indicizzata: aliquota non verificata. Non usare zero come valore predefinito.'),source:spec?.[2]||P,checked:['IT','FR','IE','BE','QA','UY','TZ','PK','SA','MX','TW','KE','CH','GB','US'].includes(code)?'2026-11-27':null};}).sort((a,b)=>a.name.localeCompare(b.name,'it'));
export function filterTax(q='',only=false){const norm=s=>s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');return taxCountries.filter(x=>(!only||(x.rate&&x.rate!=='Da verificare'))&&norm(x.name+' '+x.code).includes(norm(q.trim())))}
export function taxEstimate(cost,sale,rate,fees=0){if(![cost,sale,rate,fees].every(Number.isFinite)||cost<0||sale<0||fees<0||rate<0||rate>100)throw Error('Valori non validi');const gain=sale-cost-fees,tax=Math.max(0,gain)*rate/100;return {gain,tax,net:gain-tax}}
