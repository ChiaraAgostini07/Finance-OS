# Finance OS Web — alpha 0.1

Adattamento iniziale, local-first, della specifica desktop in `docs/specifica-originale.md`. Interfaccia italiana, responsive, senza dipendenze esterne o server applicativo. Non è una riscrittura completa del programma WPF.

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
