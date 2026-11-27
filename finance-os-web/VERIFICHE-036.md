# Finance OS 0.3.6 — Invest
Base: archivio originale 0.3.5 World Plus, senza eliminazioni di file. Il nuovo Portafoglio conserva biblioteca fiscale, convertitore e albero in schede separate.

Riferimenti di progetto (funzionalità pubblicamente documentate):
- https://www.monarch.com/features/tracking
- https://www.getquin.com/portfolio-performance/
- https://www.tradingview.com/support/solutions/43000760937-tradingview-portfolios-track-your-assets-know-your-trades/
- https://www.sharesight.com/investment-portfolio-performance/
- https://www.portfolio-performance.info/en/

Test: 71/71 Node (63 precedenti, 8 nuovi). Chromium: 126 combinazioni (7 schede × 12 larghezze ordinarie, 7 × 6 larghezze private simulate); 320–1920 px, nessun overflow globale o errore JS rilevato. Creazione posizione, vendita parziale, blocco sovravendita, escaping HTML, watchlist, precompilazione simulatore fiscale e cambio manuale verificati. Browser con moduli caricati in memoria, storage simulato; vista privata ottenuta con fixture di test in memoria, non prova di autenticazione live. Non verificati CSP in produzione, cache PWA, API cambi live, dispositivi fisici/Safari, né collegamento broker. Nessun test offensivo contro sistemi esterni.

Limiti: valori in EUR, prezzi manuali, nessun ordine o sincronizzazione di broker, nessun collegamento contabile automatico ai conti, costo medio gestionale non fiscale, nessun rendimento storico TWR/IRR. Dati fiscali invariati rispetto alla versione 0.3.5: 250 giurisdizioni, 102 schede indicative, 148 da completare. Nessuna garanzia di accuratezza fiscale universale.
