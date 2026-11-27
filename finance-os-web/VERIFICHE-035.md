# Finance OS Wealth 0.3.5 — World Plus

## Provenienza
Base esatta: `Finance-OS-Wealth-033-private-merge (1).zip`, SHA-256 `5ba85dcc367db53af5ac6cc64cc0932408412f9e8effcc66775b94377ec32b28`. Applicate le modifiche incrementali World già sviluppate e poi una revisione aggiuntiva. Nessun file della base rimosso. Il motore contabile, la palette delle carte, il salvadanaio, l'albero e le risorse originali restano invariati rispetto a 0.3.3, salvo le integrazioni nei moduli d'interfaccia. Nessuna migrazione di valuta o modifica automatica dei saldi.

## Verifiche ripetute in questa revisione
- `npm test`: 63/63, inclusi 47 test già presenti nella base. Verifica sintattica e risoluzione degli import locali, presenza delle risorse pre-cache.
- Chromium: 21 pagine, 12 larghezze (320–1920 px) in demo e 6 larghezze (320–1440 px) con vista privata combinata di prova, totale 378 verifiche; nessun overflow globale > 2 px e nessun errore JS rilevato. Tabelle possono scorrere all'interno dei pannelli.
- Inserimento in demo di un movimento con stringa HTML ostile: testo visibile, nessun elemento immagine iniettato. Precompilazione fiscale da posizione inserita in demo. Conversione manuale, commissione, aggiornamento v2 simulato, confronto di tre Paesi, ricerca e filtro fonte verificati.
- Il browser non consente la navigazione HTTP locale (ERR_BLOCKED_BY_ADMINISTRATOR). L'interfaccia è stata provata con HTML/CSS e moduli reali assemblati in memoria, archivio simulato, dati dimostrativi e vista privata creata in memoria. Le prove WebCrypto e persistenza cifrata sono effettuate separatamente con Node. La CSP non è applicata nell'ambiente di prova UI; non è quindi una verifica del suo funzionamento live.
- Test difensivi assistiti da IA: cifratura AES-GCM alterata, password errata, separazione cifrata, conflitti di revisione, iniezioni prototipali, ID ostili o duplicati, risposta cambi malformata e fallback. Non si tratta di un audit indipendente o di un penetration test sul sito pubblico. Non usare l'app come unico archivio di dati importanti.

## Fonti fiscali e cambi
La directory comprende 250 Paesi e territori (ISO più Kosovo). 102 hanno un'indicazione di riferimento, 148 non hanno aliquota indicata; 15 riferimenti ricontrollati in questa revisione sono contrassegnati con data. Le altre schede informative riportano riferimenti preesistenti da riconfermare. Il campo non verificato non equivale a zero. Il simulatore è ipotetico e non determina il debito fiscale reale. La residenza fiscale, la tipologia di titolo, la data e le condizioni di realizzo sono determinanti.
- Italia: https://taxsummaries.pwc.com/italy/individual/income-determination
- Francia: https://taxsummaries.pwc.com/france/individual/taxes-on-personal-income
- Irlanda: https://www.revenue.ie/en/gains-gifts-and-inheritance/transfering-an-asset/how-to-calculate-CGT.aspx
- Regno Unito: https://www.gov.uk/capital-gains-tax/rates
- USA: https://www.irs.gov/taxtopics/tc409
- Belgio: https://taxsummaries.pwc.com/belgium
- Svizzera: https://taxsummaries.pwc.com/switzerland/individual/income-determination
- Altri riferimenti sono collegati nelle singole schede.
- Cambio: https://frankfurter.dev/ (v2) e https://frankfurter.dev/v1/ (fallback). La richiesta contiene solo la base EUR, non importi, movimenti o dati del profilo. Tassi indicativi, non live intraday; disponibilità variabile per valuta. La connessione reale resta da provare.

## Pubblicazione
Backup cifrato prima dell'aggiornamento, conservato fuori dalla repository. Sostituire i file mantenendo il percorso esistente. Verificare su GitHub Pages HTTPS, cache PWA, import, backup, accesso privato e cambio live. Nessun test su dispositivi fisici, Safari iOS, pieghevoli o cerniere di dispositivi dual screen: gli adattamenti si basano su media query, viewport e CSS segmentato sperimentale. Non promettono compatibilità assoluta.
