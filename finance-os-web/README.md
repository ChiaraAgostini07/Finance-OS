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
