# Finance OS Web — alpha 0.1

Adattamento iniziale, local-first, della specifica desktop fornita dall’utente (non inclusa nell’archivio di distribuzione). Interfaccia italiana, responsive, senza dipendenze esterne o server applicativo. Non è una riscrittura completa del programma WPF.

## Avvio

Con Node.js 18+ eseguire `npm start` dalla cartella e aprire http://localhost:8080. Preferire un browser moderno. Non aprire index.html direttamente da file: i moduli ES e Web Crypto necessitano di un contesto compatibile.

## GitHub

Caricare il contenuto della cartella nella repository. Per GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root). Il sito statico funziona anche su hosting HTTPS. Non caricare backup personali o esportazioni. Il browser conserva i dati per origine: passare a un altro dominio richiede backup e ripristino.

## Funzioni presenti

Profili locali cifrati (PBKDF2 210.000 iterazioni, AES-GCM); saldi derivati; movimenti, trasferimenti a due gambe, budget mensili base, registro ricorrenze, obiettivi manuali, attività/passività, registro investimenti manuale, report CSV/stampa, import CSV semplice con deduplicazione e conferma, assistente deterministico, temi, 18 widget selezionabili, backup cifrato e audit. Importi in interi a quattro decimali (EUR; limite di precisione degli interi JavaScript). Nessuna richiesta di rete esterna. Il backup è un formato web JSON, non FOSX. La password non è recuperabile.

## Limiti e lavoro restante

Non implementati: parità SQLite/EF/DPAPI e migrazione DB, 104 categorie gerarchiche, 29 widget e 6 preset, drag/drop, valute multiple e cambi, split nell'interfaccia, modifica completa dei record, riconciliazione, regole, ricorrenze automatiche, rollover, proiezioni, performance titoli e fiscalità, PSD2, provider IA, allegati, XLSX, CLI originale, onboarding e i 236 test originali. Il CSV supporta un formato semplice, non tutti i CSV con delimitatori quotati. La cifratura locale non protegge da codice malevolo eseguito sulla stessa origine o da un dispositivo compromesso. LocalStorage ha spazio limitato; conservare backup separati. Non usare ancora come unica fonte di dati finanziari reali. Non sottoposto ad audit di sicurezza.

## Test

`npm test` verifica le regole contabili implementate. I test non equivalgono alla suite originale. La UI non è stata sottoposta a test end-to-end.

## Redesign — Finance OS

Nuovo design professionale: verde bosco, avorio, iconografia vettoriale, schermata di accesso con illustrazione finanziaria e valori di esempio esplicitamente identificati, scheda patrimoniale con dati reali, responsive. Nessun font o asset remoto. I nuovi profili partono dal tema chiaro, quelli esistenti conservano le preferenze. Chiave e formato di archiviazione invariati.

Per aggiornare GitHub Pages, sovrascrivere i file nella sottocartella `finance-os-web` mantenendo lo stesso percorso e includendo `assets/finance-icon.svg`. Non pubblicare backup, esportazioni o documenti con dati personali. La specifica originale è esclusa dal pacchetto pubblico perché contiene anche percorsi locali.

Verifica: cinque test contabili superati, sintassi JavaScript verificata; test Node di registrazione, accesso, cifratura e generazione del markup superato. La navigazione Chromium è bloccata dall’ambiente (ERR_BLOCKED_BY_ADMINISTRATOR), quindi non è stato possibile completare la verifica visiva o end-to-end.

## Aggiornamento interfaccia
La home pubblica offre una demo interattiva con dati sintetici, non salvati. I profili reali restano locali e cifrati. La dashboard usa grafici e categorie calcolati sui movimenti; il grafico della home è illustrativo. Nessuna dipendenza esterna.

Verifica revisione: test contabili e smoke test DOM simulato superati. Verifica visiva Chromium non completata: navigazione locale bloccata dalla policy del browser di test.

## Studio 0.2 — aggiornamento funzionale

Mantiene l'interfaccia Studio precedente. Caricare tutti i file nella stessa sottocartella GitHub Pages (non cambiare origine o percorso di pubblicazione). I profili esistenti continuano a usare la stessa chiave di archiviazione; consigliato un backup cifrato prima dell'aggiornamento. Non cancellare i dati del browser.

- Dashboard: andamento storico dei saldi dei conti (non del patrimonio storico completo), periodi 1S–1A, analisi mensile e confronto categorie; ordine drag-and-drop o frecce e tre dimensioni dei widget, salvati nel profilo. Il grafico storico usa il periodo corrente indipendentemente dal selettore del mese.
- Conti: carte colorate, istituto e nome personalizzabili. La modalità privacy oscura visivamente gli importi e alcuni grafici: non è un controllo di accesso e non protegge i dati da chi usa il dispositivo.
- Movimenti: modifica dei singoli movimenti non suddivisi e non appartenenti a trasferimenti. I trasferimenti restano indivisibili; eliminazione e nuova registrazione per correggerli.
- Obiettivi: foto locale opzionale fino a 300 KB, modifica dati e stima indicativa dei versamenti mensili; nessuna sincronizzazione con banche.
- Calendario: ricorrenze settimanali/mensili/annuali e movimenti registrati; nessuna generazione automatica di movimenti.
- Previsioni: scenario prudenziale a 90 giorni, sole uscite ricorrenti, non entrate o altre operazioni future; simulatore a rendimento costante lordo, puramente illustrativo.
- Ricerca Ctrl/Command+K; avvisi locali per scadenze e budget (non notifiche push); guida iniziale; tre accenti cromatici; FAQ, novità e collegamenti in homepage; stampa mensile con salvataggio PDF tramite browser.
- PWA: manifest, icone e service worker per risorse statiche; l'installabilità dipende da browser e HTTPS. Non si tratta di un'app nativa. Il service worker non salva dati finanziari nella cache.

Verifiche: 11 test Node superati; sintassi JS verificata; Chromium ha verificato DOM e interazioni della demo mediante caricamento locale in pagina (navigazione, modifica conto/movimento, calendario, simulatore). L'accesso HTTP al server locale è bloccato nell'ambiente di verifica: non sono stati testati end-to-end installazione PWA, login cifrato e pubblicazione GitHub Pages in questa revisione. Le funzionalità avanzate mancanti della specifica desktop non sono state introdotte da questo aggiornamento.

## Aggiornamento 0.2.1

- Mantiene il CSS di Studio e tutti i moduli di Studio Plus.
- Menu laterale: conserva lo scorrimento durante la navigazione e il salvataggio; su mobile conserva anche lo scorrimento orizzontale.
- Carte con proporzioni ISO ID-1 (85,6 × 53,98), chip e grafica contactless decorativi, quattro colori con campioni visivi; il salvia è più saturo. Non sono carte di pagamento reali.
- Obiettivi: salvadanaio SVG con livello proporzionale al risparmio e animazione di riempimento, rispetto delle preferenze di movimento ridotto. Accantona aggiorna soltanto il valore del risparmio, senza creare un movimento bancario.
- Nessuna modifica allo schema dei profili o ai dati già salvati.
- Verifiche: 11 test Node e test UI Chromium su demo tramite caricamento in memoria; navigazione di rete e PWA non verificabili nell’ambiente.

### 0.2.2 — Obiettivi
Versamenti e prelievi direttamente nella scheda, storico locale, salvadanaio SVG con effetto tridimensionale e animazione delle singole monete e banconote. Il progresso è salvato nello stesso profilo cifrato; gli accantonamenti non generano movimenti bancari. Lo storico parte da questa versione.

### 0.2.3 — Salvadanaio animato
Monete e banconote individuali con disposizione irregolare deterministica, senza righe. Effetti di entrata e uscita, progresso animato, confetti al primo raggiungimento del 100% mediante un accantonamento. Il pulsante Svuota richiede conferma, registra l'importo esatto nello storico e azzera solo il risparmio dell'obiettivo; martello, frammenti e denaro che cade, poi salvadanaio vuoto. Le animazioni rispettano la preferenza di movimento ridotto. Nessuna modifica ai conti, ai movimenti o allo schema dati. Le illustrazioni sono SVG con profondità simulata, non modelli 3D. Test: 18 Node superati; test UI Chromium con moduli caricati in memoria (navigazione HTTP bloccata dall'ambiente). Verifica pubblicazione e PWA ancora da effettuare.

Aggiornamento: sovrascrivere i file nella stessa sottocartella `finance-os-web` di GitHub Pages, senza aggiungere una sottocartella duplicata. Il pacchetto patch contiene solo i file modificati rispetto a 0.2.2. Conservare un backup cifrato prima di aggiornare; non pubblicare il backup nella repository.

### 0.2.4 — Causali obiettivi
Campo facoltativo fino a 160 caratteri per accantonamenti, prelievi e svuotamenti. Lo storico mostra la causale quando presente e si apre dopo una nuova operazione. Le operazioni precedenti senza causale restano compatibili; il campo viene salvato nello stesso profilo cifrato. Nessuna modifica ai saldi bancari o alle animazioni. Patch rispetto a 0.2.3.
Verifiche 0.2.4: 21 test Node superati; test demo Chromium con moduli caricati in memoria: versamento con completamento, prelievo, annullamento e conferma dello svuotamento, nuovo versamento, storico e stati delle animazioni, nessun errore JavaScript. Pubblicazione e PWA non verificate.

### 0.2.5 — Layout obiettivi
Ogni obiettivo occupa una scheda orizzontale: dati e azioni a sinistra, salvadanaio animato a destra, storico e azioni di gestione sotto. Su schermi stretti le due colonne si dispongono verticalmente. Nessuna modifica al formato dei dati o al motore delle animazioni. Risorse e cache PWA aggiornate per la nuova versione. Test: 21 Node superati; Chromium in memoria ha verificato disposizione desktop (1440 px) e mobile (390 px), versamento, prelievo, annullamento/svuotamento, causali, completamento e storico senza errori JavaScript. Pubblicazione GitHub Pages e aggiornamento della PWA non verificati.

### 0.2.6 — Palette coordinata
16 colori comuni per interfaccia, carte e salvadanai; le tre preferenze sono indipendenti e salvate nel profilo. Gli obiettivi esistenti senza colore mantengono il verde predefinito. La homepage pubblica conserva lo stile Studio.

### 0.2.7 — Wealth
Aggiornamento incrementale della versione Palette. Conservati tutti i 24 file originali; `domain.js`, `store.js`, `goals.js`, `pro.js`, `palette.js`, i CSS originali e gli asset sono identici a 0.2.6. Nuovi moduli: `wealth.js`, `wealth-ui.js`, `wealth.css`, `tests/wealth.test.js`.
- Patrimonio: cassaforte animata per una riserva dichiarata, mappa delle attività e indicatore orientativo di salute finanziaria. La riserva non è un nuovo saldo. Il portafoglio manuale rimane escluso dal patrimonio per evitare doppio conteggio, come nella versione precedente.
- Portafoglio: albero vettoriale per costo di carico e guadagno non realizzato. Nessun prezzo stimato.
- Report: Finance Wrapped mensile/annuale, storico reale dei flussi e degli obiettivi.
- Ricorrenti: abbonamenti, scadenze e costi equivalenti; monogrammi locali, non loghi ufficiali; nessuna disdetta automatica.
- Pianificazione: desideri collegabili agli obiettivi, acquisti, sfide anche 52 settimane, debiti e rate. Registri separati, senza generazione automatica di movimenti.
- Diario; allegati immagine ai movimenti (max 300 KB); esportazione selettiva e lettura di copie JSON in chiaro, non sincronizzazione multiutente.
- I dati aggiuntivi sono salvati nel profilo esistente (`extras` o allegato sul movimento). Mantieni il medesimo URL e fai un backup prima di aggiornare. PWA conservata, cache aggiornata.
- Test: 30 automatici; navigazione e operazioni principali in Chromium con moduli caricati in memoria e UUID simulati soltanto nel test (restrizioni di rete dell'ambiente). Deploy HTTPS e installazione PWA da verificare.

### Wealth 0.3.0
- Revisione dei margini e allineamento dei controlli, tabelle, schede e dati, con regole responsive aggiuntive. Palette e grafica precedente conservate. Righe di indicatori predefinite bilanciate automaticamente, senza modificare le dimensioni dei widget impostate dall’utente. Carte centrate e proporzioni preservate.
- Progetti riunisce Desideri, Acquisti e Sfide; usa le stesse collezioni dati preesistenti. Le vecchie voci sono ancora ricercabili.
- Albero ridisegnato con foglie singole e monete sparse in posizioni stabili. Capitale e rendimento mantengono il significato precedente; le monete sono simboliche.
- Registro riservato: dalla ricerca globale (Ctrl/⌘ K), digitare `/privato configura` e premere Invio per impostare una seconda password (minimo 12 caratteri). Nei successivi accessi digitare la password esatta nella ricerca e premere Invio oppure usare `/privato` + Invio per passare a un campo mascherato. Il registro rimane separato dai movimenti, dai saldi e dagli export ordinari. Backup cifrato completo include la busta cifrata del registro; serve ancora la seconda password per aprirla. Export JSON pubblico esclude la busta. Il registro non è una copia completa del gestionale e non sincronizza conti bancari. Non è invisibile a chi ispeziona il codice o la struttura dei dati; non protegge da malware, estensioni ostili o accesso al dispositivo mentre è sbloccato. Nessun recupero della seconda password. Non disponibile nella demo. Chiudere e bloccare dopo l'uso; timeout di inattività di 3 minuti e blocco quando la scheda viene nascosta.

### 0.3.1 — Importazione CSV
Nuovo importatore locale: separatore automatico o manuale (virgola, punto e virgola, tab), associazione colonne, date ISO/DMY/MDY, importi con segno o accrediti/addebiti distinti, formati numerici IT/EN, anteprima, errori per riga e duplicati potenziali. Soltanto EUR; UTF-8; massimo 10 MB e 50.000 righe. Dati statistici nazionali riconosciuti e respinti. Nessuna importazione prima della conferma. Excel: esportare in CSV. Non importare totali o saldi cumulativi. Il saldo di apertura deve precedere le operazioni importate.

### 0.3.2 — Due ambienti indipendenti
- Il pulsante **Spazio privato** nella barra superiore e il collegamento nella ricerca globale aprono la configurazione o lo sblocco con seconda password (almeno 12 caratteri). I comandi `/privato` e `/privato configura` rimangono utilizzabili; si può anche inviare la password dalla ricerca, ma è preferibile il campo mascherato.
- Lo spazio privato riutilizza tutte le 21 sezioni dell'app, con dati e impostazioni indipendenti. Parte vuoto, senza copiare i dati ordinari. Eventuali movimenti del vecchio registro vengono convertiti in un conto privato dedicato, mantenendo importi, date, descrizioni e note; la migrazione viene salvata alla prima modifica.
- Il contenuto privato viene cifrato separatamente; il backup cifrato ordinario conserva anche la busta privata. Gli export ordinari in chiaro non la includono. Nello spazio privato è disponibile un backup cifrato dedicato, ripristinabile solo da quello spazio. Le esportazioni volontarie in chiaro e la stampa richiedono attenzione: i file esportati non sono protetti dalla password.
- Il pulsante Blocca privato torna al profilo ordinario; il blocco avviene anche dopo tre minuti di inattività o quando il documento diventa nascosto. Non è un ambiente isolato a livello di sistema operativo: estensioni, malware e strumenti di sviluppo durante lo sblocco possono accedere alla sessione.

### Wealth 0.3.4 — World
- Nel Portafoglio, nuovo convertitore di valuta con cambio incrociato, commissione percentuale, inversione e cambio manuale. Tassi pubblici Frankfurter scaricati su richiesta, data del fixing mostrata e disponibilità variabile per valuta. Il servizio non riceve importi, movimenti o saldi. La contabilità e gli import CSV rimangono in EUR; il convertitore non genera movimenti né saldi multivaluta. Non è un servizio di esecuzione ordini.
- Biblioteca fiscale: indice ISO di 250 Paesi/territori (incl. Kosovo), ricerca e paginazione, 93 schede con indicazioni fiscali, fonti e condizioni; le altre 157 sono da verificare. Dati consultati il 27/11/2026, non aggiornati automaticamente. Le regole sono indicative, per persone fisiche, e non costituiscono un calcolo fiscale individuale. Le aliquote non sono applicate automaticamente al portafoglio. Simulatore indipendente di guadagno, imposta ipotetica, costi e netto.
- Nell'area privata, dati ordinari in sola lettura più voci private, con badge distintivi, nuova palette notte viola, trasferimenti e import su conti ordinari corretti, conservazione delle animazioni degli obiettivi. I movimenti privati non vengono aggiunti al profilo ordinario. Il backup ordinario cifrato comprende anche la busta privata; gli export della vista privata richiedono conferma e sono in chiaro.
- Protezioni aggiuntive: policy CSP, validazione dei dati ripristinati, rifiuto di nomi/chiavi riservate, verifica di modifiche concorrenti sul salvataggio (controllo ottimistico, non lock atomico fra processi), validazione delle risposte FX. Cifratura AES-GCM/PBKDF2 preesistente mantenuta e verificata; nessuna migrazione del formato. Il codice pubblico di una PWA non può garantire protezione da estensioni malevole, dispositivo compromesso o furto della password.
- Layout adattivo per finestre strette, tablet e desktop, campi mobile leggibili, regole responsive aggiuntive. Test emulati a 320, 344, 360, 390, 412, 540, 673, 768, 820, 1024, 1440, 1920 px; non certificazione di singoli hardware, Safari/iOS, cerniere o doppio schermo fisici.
- Test: `npm test` (57 test); verifica UI Chromium con moduli caricati in memoria e bridge crittografico locale per simulare il browser, 504 combinazioni di pagine/larghezze, nessun overflow orizzontale globale o errore JS rilevato. Tassi live simulati nella prova; disponibilità del servizio, CSP sulla pubblicazione HTTPS, PWA, WebKit/Safari e dispositivi reali non verificati. Vedi `VERIFICHE-034.md`.
- Prima dell'aggiornamento esportare il backup cifrato e mantenerlo fuori dalla repository. Sostituire i file nella stessa directory e conservare lo stesso URL/origine.

## 0.3.5 — World Plus (base 0.3.3 allegata)
- Convertitore con Frankfurter v2, fallback v1, date per singola valuta, cambio manuale e commissione. Contabilità invariata in EUR.
- Biblioteca: 250 Paesi e territori, 102 indicazioni da consultare, 15 riferimenti ricontrollati nella revisione del 27 novembre 2026. Confronto fino a tre schede, filtri e fonti. Le aliquote non ricontrollate sono esplicitamente distinte e non sono automaticamente applicate. Simulatore con precompilazione facoltativa da posizione del portafoglio.
- Validazione dei dati prima del salvataggio, protezione da identificativi duplicati tra ambiente ordinario e privato; esportazione JSON privata del solo registro privato (i report combinati richiedono conferma).
- Layout responsive, supporto CSS sperimentale ai viewport segmentati. Vedere VERIFICHE-035.md per risultati e limiti.

### 0.3.6 — Invest
Portafoglio riprogettato in sette schede: panoramica, posizioni, operazioni, mercati (watchlist), fiscalità, cambio e albero. I dati precedenti restano compatibili: le posizioni con soli costo e valore non vengono convertite in quantità inventate. Inserire la quantità reale prima di registrare compravendite. Costo medio ponderato gestionale, commissioni di acquisto capitalizzate, plusvalenze realizzate sulle vendite, dividendi netti. Le valutazioni sono manuali in EUR; dopo compravendite il valore noto è proporzionato alla quantità usando l'ultima valutazione disponibile, salvo aggiornamento manuale. La watchlist apre grafici esterni TradingView su richiesta. Non sono disponibili esecuzione di ordini, prezzi live integrati, rendimenti TWR/IRR o fiscalità dichiarativa. Il registro non modifica conti o patrimonio, per prevenire doppi conteggi. I dati ordinari nella vista privata sono in sola lettura. Le operazioni registrate non sono modificabili singolarmente; l'eliminazione della posizione cancella anche il suo storico previa conferma. Fare un backup prima di aggiornare.
