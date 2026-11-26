# Finance OS — Specifica completa del codice e delle funzionalità

**Scopo del documento.** Descrivere in modo completo e verificabile il programma Finance OS così come è
realizzato oggi, con tutte le informazioni necessarie a riscriverne il codice da zero mantenendo
caratteristiche e comportamento identici: architettura, dipendenze, schema del database, regole di
calcolo, servizi, integrazioni, interfaccia, test, build e distribuzione.

| Voce | Valore |
|---|---|
| Programma | Finance OS (versione `1.0.0-alpha.1`) |
| Genere | Applicazione desktop di finanza personale, utente singolo, dati locali |
| Piattaforma | Windows x64 (WPF, .NET 8) |
| Codice analizzato | `D:\Lavori\programmi\Finance OS\Test alpha\relase alpha 1.0` (il nome della cartella è scritto «relase») |
| Dimensione | 57.421 righe fra `src` e `tests` (52.065 in `src`, 5.356 in `tests`), 6 progetti; 44.849 righe di solo C# in `src` |
| Data dell'analisi | 3 novembre 2026 |
| Moneta interna | interi in unità minori 1/10⁴, valuta ISO 4217 obbligatoria |
| Database | SQLite, EF Core 8, una sola migrazione iniziale |
| Lingua | interfaccia e messaggi in italiano (`it-IT`), identificatori di codice in inglese, commenti in italiano |

**Indice.** [0](#0-come-usare-questo-documento-per-una-riscrittura-fedele) · [1](#1-identità-del-programma-e-requisiti) · [2](#2-stack-tecnologico-e-configurazione-di-build) · [3](#3-struttura-della-soluzione-dipendenze-e-inventario-dei-file) · [4](#4-avvio-sessione-e-ciclo-di-vita) · [5](#5-configurazione-percorsi-e-log) · [6](#6-profili-locali-autenticazione-e-segreti) · [7](#7-modello-dati) · [8](#8-denaro-valute-date-e-formati) · [9](#9-regole-contabili-e-motori-di-calcolo) · [10](#10-servizi-applicativi) · [11](#11-integrazioni) · [12](#12-interfaccia-wpf) · [13](#13-dashboard) · [14](#14-strumento-da-riga-di-comando-financeos-cli) · [15](#15-test-automatici) · [16](#16-build-rilascio-e-installazione) · [17](#17-convenzioni-e-regole-per-una-riscrittura-fedele) · [18](#18-checklist-di-accettazione) · [19](#19-appendici)

## 0. Come usare questo documento per una riscrittura fedele

L'ordine consigliato è quello delle sezioni: prima l'impianto (progetti, dipendenze, versioni), poi il
modello dati, poi i motori di calcolo puri (testabili senza database), poi i servizi, poi l'interfaccia.
I vincoli che non si possono cambiare senza alterare il comportamento sono raccolti nella sezione 17 e
nella checklist della sezione 18.

Tre avvertenze metodologiche:

1. **Il denaro non è mai un `double`.** Ogni importo persistito è un `long` in unità da 1/10⁴ e ogni
   somma avviene su interi o su `decimal`. Una riscrittura che usasse virgola mobile produrrebbe
   differenze di centesimi e renderebbe incompatibili i database esistenti.
2. **I calcoli non stanno nei view model.** Stanno in classi pure che ricevono una fotografia dei dati
   (`LedgerSnapshot`) e restituiscono valori. Questa separazione è essa stessa una caratteristica del
   programma: permette i test senza database e il riuso da dashboard, report, assistente e CLI.
3. **Il programma non inventa mai un dato mancante.** Prezzo assente, tasso di cambio assente, periodo
   non coperto dalle aliquote IRPEF, rendimento non calcolabile: in tutti questi casi il risultato è
   dichiarato «non disponibile» e la posizione è segnalata, non stimata.

---

## 1. Identità del programma e requisiti

**Che cosa fa.** Finance OS tiene la contabilità personale su un solo computer: conti e saldi, movimenti
con categoria e suddivisioni, trasferimenti interni, budget, spese ricorrenti e abbonamenti, obiettivi di
risparmio e fondo emergenze, patrimonio netto (attività e passività), portafoglio titoli con prezzi,
dividendi e stime fiscali italiane, riconciliazione dei saldi con l'estratto conto, importazione CSV,
sincronizzazione bancaria PSD2 opzionale, report esportabili, un assistente locale sui propri dati e una
dashboard di 29 widget componibili.

**Requisiti funzionali non negoziabili** (sono le caratteristiche che una riscrittura deve conservare):

- I dati restano sul computer dell'utente. Nessun invio automatico di dati finanziari; le sole funzioni
  di rete sono i connettori bancari configurati dall'utente, l'aggiornamento dei tassi e il provider IA
  opzionale, tutti disattivati per impostazione predefinita (i tassi si possono importare manualmente;
  l'IA richiede consenso esplicito).
- Multi-profilo locale: più account sullo stesso PC, ognuno con la propria cartella dati e il proprio
  database; l'accesso avviene prima di aprire i dati.
- Separazione contabile rigorosa: un trasferimento fra conti propri non è mai entrata né spesa; un
  acquisto di strumenti finanziari non è una spesa di consumo; la quota capitale di una rata non è un
  costo, la quota interessi sì.
- Saldi, patrimonio, budget consumato e plusvalenze sono sempre **derivati**, mai memorizzati come stato.
- Ogni modifica rilevante è registrata nel registro di audit locale.
- Backup cifrato con chiave protetta da DPAPI e ripristino esplicito; esportazione completa dei dati
  personali in JSON; cancellazione irreversibile con frase di conferma.
- Interfaccia italiana, con formati `1.234,56 €` e `gg/mm/aaaa`, tema chiaro/scuro/sistema.

**Requisiti non funzionali.** Avvio senza amministratore; nessuna installazione di servizi o driver;
database a file; nessuna dipendenza da un server; errori non gestiti mostrati con un messaggio
comprensibile e registrati su file, senza terminare l'applicazione a metà operazione.

**Cosa il programma non fa** (per non reintrodurlo per errore): non fa scraping di home banking, non
promette rendimenti, non dà consulenza fiscale o di investimento, non gestisce utenti remoti, non invia
notifiche a servizi esterni, non memorizza credenziali in chiaro e non usa `double` per il denaro.

---

## 2. Stack tecnologico e configurazione di build

### 2.1 Proprietà comuni (`Directory.Build.props`)

| Proprietà | Valore | Effetto |
|---|---|---|
| `LangVersion` | `12.0` | collection expressions `[...]`, primary constructor, pattern list |
| `Nullable` | `enable` | nullability attiva su tutti i progetti |
| `ImplicitUsings` | `enable` | `System`, `System.Linq`, `System.Collections.Generic`, `System.Threading.Tasks`, `System.IO` impliciti |
| `TreatWarningsAsErrors` | `false` (con `WarningsAsErrors` vuoto) | gli avvisi non bloccano la build |
| `EnableNETAnalyzers` | `true`, `AnalysisLevel=latest-recommended` | analizzatori attivi |
| `NoWarn` | lista lunga (CS8714, CA1822, CA1416, CA1303, CA1305, CA1002, CA1819, CA2007, CA1031, CA1051, CA1062, CA1032, CA2227, CA1815, CA1707, CA1720, CA1725, CA1716, CA5394, CA1307, CA1310, CA1861, CA1859, CA1848, CA1812, CA1852, CA2000, CA1860, CA1862, CA1308, CA5390, CA5398, CA5350, CA5351, CA3003, CA2100, CA2105, CA2211, CA1721, CA1854, CA1849) | scelte consapevoli documentate nel file |
| `NeutralLanguage` | `it-IT` | lingua neutra degli assembly |
| `InvariantGlobalization` | `false` | cultura italiana reale disponibile |
| `Version` / `Product` / `Company` | `1.0.0-alpha.1` / `Finance OS` / `Finance OS` | identità degli assembly |
| `Copyright` | `Finance OS - uso personale` | |
| `DebugType` | `portable` | |
| `GenerateDocumentationFile` | `false` | i commenti XML non producono file |
| `UserSecretsId` | `finance-os-local` | segnaposto; il progetto non deve contenere segreti |

### 2.2 Versioni dei pacchetti (gestione centralizzata, `Directory.Packages.props`)

`ManagePackageVersionsCentrally=true`, `CentralPackageTransitivePinningEnabled=false`.

| Area | Pacchetto | Versione |
|---|---|---|
| Persistenza | `Microsoft.EntityFrameworkCore.Sqlite` | 8.0.31 |
| Persistenza | `Microsoft.EntityFrameworkCore.Relational` | 8.0.31 |
| Persistenza | `Microsoft.EntityFrameworkCore.Design` | 8.0.31 |
| Persistenza | `Microsoft.Data.Sqlite` | 8.0.31 |
| Hosting/DI | `Microsoft.Extensions.Hosting` | 8.0.1 |
| Hosting/DI | `Microsoft.Extensions.DependencyInjection` | 8.0.1 |
| Hosting/DI | `Microsoft.Extensions.DependencyInjection.Abstractions` | 8.0.2 |
| Hosting/DI | `Microsoft.Extensions.Logging` | 8.0.1 |
| Hosting/DI | `Microsoft.Extensions.Logging.Abstractions` | 8.0.2 |
| Hosting/DI | `Microsoft.Extensions.Logging.Console` | 8.0.1 |
| Hosting/DI | `Microsoft.Extensions.Configuration.Json` | 8.0.1 |
| Hosting/DI | `Microsoft.Extensions.Http` | 8.0.1 |
| UI | `CommunityToolkit.Mvvm` | 8.4.2 |
| UI | `LiveChartsCore.SkiaSharpView.WPF` | 2.0.5 |
| Import/export | `CsvHelper` | 33.1.0 |
| Import/export | `ClosedXML` | 0.105.1 |
| Import/export | `QuestPDF` | 2026.9.1 |
| Sicurezza | `System.Security.Cryptography.ProtectedData` | 8.0.0 |
| Test | `Microsoft.NET.Test.Sdk` | 17.12.0 |
| Test | `xunit` | 2.9.3 |
| Test | `xunit.runner.visualstudio` | 2.8.2 |
| Test | `coverlet.collector` | 6.0.2 |

### 2.3 Progetti e target framework

| Progetto | Tipo | TFM | Nome assembly | Note di build |
|---|---|---|---|---|
| `FinanceOS.Domain` | libreria | `net8.0` | `FinanceOS.Domain` | nessun pacchetto: solo BCL |
| `FinanceOS.Data` | libreria | `net8.0` | `FinanceOS.Data` | EF Core Sqlite/Relational/Design, DI/Logging abstractions, `ProtectedData` |
| `FinanceOS.Integrations` | libreria | `net8.0` | `FinanceOS.Integrations` | CsvHelper, ClosedXML, QuestPDF, Http, Logging/DI abstractions, Configuration.Json |
| `FinanceOS.App` | app WPF | `net8.0-windows10.0.19041.0` | `FinanceOS` (quindi `FinanceOS.exe`) | `WinExe`, `UseWPF`, icona `Assets\FinanceOS.ico`, manifest `app.manifest`, `StartupObject=FinanceOS.App.Program`, `SupportedOSPlatformVersion=10.0.17763.0`, `SatelliteResourceLanguages=it;en` |
| `FinanceOS.Cli` | console | `net8.0` | `financeos-cli` | copia `samples/*.csv` nell'output |
| `FinanceOS.Tests` | xUnit | `net8.0` | — | 236 casi di test (184 `[Fact]` + 8 `[Theory]` con 52 `[InlineData]`), esecuzione non parallela |

Dettagli di build dell'app che è facile sbagliare:

- `App.xaml` è incluso come **`Page`**, non come `ApplicationDefinition` (`<ApplicationDefinition Remove="App.xaml" />`):
  il punto di ingresso è `Program.Main`, così esiste un solo `Main` e `App` può avere un costruttore con
  parametri (riceve l'host di dependency injection).
- L'icona è sia `ApplicationIcon` (incorporata nell'eseguibile) sia `Resource` (usata dalle finestre come
  `/Assets/FinanceOS.ico`).
- `appsettings.json` viene copiato nell'output con `PreserveNewest`.
- Il TFM «versionato» `net8.0-windows10.0.19041.0` è richiesto dal gruppo nativo di LiveCharts2/SkiaSharp:
  evita il fallback su .NET Framework (avvisi NU1701/OpenTK).
- Il file `FinanceOS.sln` contiene la cartella di soluzione `src` con i cinque progetti e la cartella
  `tests` con `FinanceOS.Tests`; configurazioni `Debug|Any CPU` e `Release|Any CPU`.---

## 3. Struttura della soluzione, dipendenze e inventario dei file

### 3.1 Livelli

```
FinanceOS.App (WPF, MVVM)      interfaccia, viste, view model, grafici, tema
        │
FinanceOS.Integrations         import CSV, export/report, connettori bancari, dati di mercato, assistente
        │
FinanceOS.Data                 EF Core + SQLite, servizi applicativi, sicurezza, backup, audit
        │
FinanceOS.Domain               entità, regole contabili, motori di calcolo puri (nessuna dipendenza)
```

Le dipendenze vanno in una sola direzione: Domain ← Data ← Integrations ← App. Nessun progetto conosce
quello sopra. `FinanceOS.Cli` referenzia Domain, Data e Integrations (non App).

### 3.2 Inventario dei file e responsabilità

**FinanceOS.Domain** (9.044 righe)

| File | Responsabilità |
|---|---|
| `Common/Money.cs` | `MoneyPrecision` (4 decimali, fattore 10.000), `Money` (`readonly struct`), `CurrencyMismatchException` |
| `Common/Decimals.cs` | conversioni decimale↔intero scalato (scala 0–9, quantità 10⁸), `SafeRatio`, `Clamp`, `Invariant` |
| `Common/CurrencyCode.cs` | anagrafica ISO 4217: decimali legali, simboli, `Normalize`, `IsSupported`, `MinorUnits`, `Symbol`, `DisplayName` |
| `Common/MoneyFormatter.cs` | formattazione italiana di importi, percentuali, quantità, date |
| `Common/MoneyMath.cs` | somme e medie di elenchi di `Money` con valuta coerente |
| `Common/DateRange.cs` | `DateRange`, `PeriodGranularity`, `PeriodPreset`, etichette ed intervalli |
| `Common/AmountParser.cs` | lettura di importi in notazione italiana o invariante |
| `Common/CategoryKey.cs` | chiave `Guid` per le categorie senza categoria (`Guid.Empty`) |
| `Common/IClock.cs` | `IClock`, `SystemClock`, `FixedClock` (test) |
| `Accounting/FlowClass.cs` | `FlowClass` e `FlowClassification` (effetti di un movimento sui prospetti) |
| `Accounting/AccountingClassifier.cs` | classificazione di un movimento e ripartizione di una rata |
| `Accounting/CashFlowEngine.cs` | entrate/uscite/costi/investimenti, per mese e per categoria |
| `Accounting/AccountBalanceCalculator.cs` | saldo di conto e saldi di tutti i conti a una data |
| `Accounting/LedgerSnapshot.cs` | fotografia coerente dei dati per i motori |
| `Accounting/CurrencyConverter.cs` | `ICurrencyConverter`, `IExchangeRateProvider`, convertitore, errori, provider identità/fisso |
| `Accounting/ReconciliationAdvisor.cs` | diagnosi delle differenze di saldo con azioni proposte |
| `Analytics/AnomalyDetector.cs` | spese anomale (per categoria e per singolo movimento) |
| `Analytics/DuplicateDetector.cs` | impronta deterministica e candidati duplicati |
| `Analytics/RuleEngine.cs` | regole automatiche e suggerimento di categoria per parole chiave |
| `Budgeting/BudgetEngine.cs` | stato dei budget: limite, riporto, speso, residuo, proiezione |
| `Dashboard/*` | `DashboardPeriods`, `AccountScope`, `CashFlowTimeline`, `ComparisonDelta`, `NetWorthTrend`, `SpendingBreakdown`, `BudgetPlan`, `ScopedMetrics`, `FinancialCalendar` |
| `Entities/*` | entità persistite e relative proprietà calcolate |
| `Forecasting/ForecastEngine.cs` | previsione di liquidità e simulazioni di scenario |
| `Goals/GoalEngine.cs` | avanzamento e proiezioni degli obiettivi |
| `NetWorth/NetWorthEngine.cs` | patrimonio netto, liquidità, investimenti, storia mensile |
| `Portfolio/PortfolioEngine.cs` | posizioni, costo di carico, plusvalenze, allocazioni |
| `Portfolio/PerformanceCalculator.cs` | XIRR, TWR, Dietz modificato, annualizzazione, CAGR, volatilità, drawdown |
| `Portfolio/FiscalItalyEstimator.cs` | stima fiscale italiana su plusvalenze, dividendi, imposta di bollo |
| `Protection/CsvSanitizer.cs` | neutralizzazione delle formule nei CSV e ispezione dei file |
| `Recurring/RecurrenceEngine.cs` | calendario delle ricorrenze, totali equivalenti, aumenti, disdette, duplicati |
| `Seed/DefaultCategoryTree.cs` | 104 categorie predefinite con identificativi deterministici |
| `Seed/DeterministicGuid.cs` | GUID stabili da una chiave testuale |
| `Settings/AppSettingKeys.cs` | tutte le chiavi di impostazione e l'elenco di quelle segrete |
| `Tax/IrpefCalculator.cs` | IRPEF a scaglioni per anni 2023–2026 |

**FinanceOS.Data** (13.022 righe, di cui ~5.800 di migrazione generata)

| File | Responsabilità |
|---|---|
| `AppPaths.cs` | percorsi locali, variabili d'ambiente, stringa di connessione, nomi dei file |
| `FinanceOsDbContext.cs` | 30 `DbSet`, convenzioni, configurazione completa di tabelle/indici/relazioni |
| `DatabaseInitializer.cs` | migrazioni + seed idempotente di categorie, layout, impostazioni; `DatabaseStatus` |
| `DesignTimeDbContextFactory.cs` | contesto per `dotnet ef` |
| `DependencyInjection.cs` | `AddFinanceOsData` / `AddFinanceOsDataForTests` |
| `ExchangeRateTableProvider.cs` | tassi da tabella, con ricerca della data più recente |
| `LedgerLoader.cs` | carica la `LedgerSnapshot` e costruisce il convertitore |
| `Migrations/20261012131051_InitialCreate*` | unica migrazione: schema completo (1.401 righe + designer 2.204 + snapshot 2.201) |
| `Auth/AuthService.cs` | profili locali, accesso, password, credenziali ricordate, cartelle, note |
| `Auth/PasswordHasher.cs` | PBKDF2-HMAC-SHA256, formato e verifica |
| `Auth/UserAccount.cs` | modello del profilo |
| `Protection/SecretProtector.cs` | `ISecretProtector`, DPAPI e variante di test |
| `Services/AccountService.cs` | CRUD conti, saldi, archiviazione, riordino, riconciliazione |
| `Services/TransactionService.cs` | ricerca filtrabile, validazione, salvataggio, duplicati, trasferimenti, modifiche massive, regole |
| `Services/CategoryService.cs` | albero categorie, percorso, CRUD, spostamento, ripristino predefinite |
| `Services/LedgerService.cs` | contesto pronto all'uso per dashboard/report/assistente |
| `Services/PlanningService.cs` | `BudgetService`, `RecurringService`, `SavingsGoalService`, `BalanceSheetService` |
| `Services/PortfolioDataService.cs` | strumenti, operazioni, prezzi, dividendi, tassi, snapshot posizioni |
| `Services/ReconciliationService.cs` | analisi e chiusura delle differenze di saldo, rettifiche, correzioni |
| `Services/DashboardLayoutService.cs` | layout, widget, preset, impacchettamento a griglia |
| `Services/NotificationService.cs` | notifiche locali e `AuditService` |
| `Services/SettingsService.cs` | impostazioni chiave/valore con cifratura dei segreti |
| `Services/BackupService.cs` | backup/ripristino `FOSX`, `PersonalDataService` (export JSON, cancellazione) |
| `Services/DemoDataService.cs` | dataset dimostrativo sintetico e sua rimozione |
| `Services/AuditSaveChangesInterceptor.cs` | audit automatico delle entità rilevanti |

**FinanceOS.Integrations** (6.004 righe)

| File | Responsabilità |
|---|---|
| `DependencyInjection.cs` | `AddFinanceOsIntegrations(includeNetworkConnectors)`, sorgente tassi offline, `AssistantService` |
| `Ai/AssistantService.cs` | assistente deterministico locale, intenti, risposte con fatti e limiti |
| `Banking/BankContracts.cs` | contratti dei connettori, DTO, esiti, eccezioni |
| `Banking/BankSyncService.cs` | registro connettori, avvio/completamento connessione, sincronizzazione, revoca, consensi |
| `Banking/DemoBankConnector.cs` | banca simulata (istituto, conti, movimenti finti) |
| `Banking/GoCardlessBankDataConnector.cs` | connettore PSD2 GoCardless |
| `Banking/EnableBanking/*` | connettore Enable Banking: client HTTP, JWT RS256, modelli, provider impostazioni |
| `Import/CsvImportModels.cs` | profilo, mappatura colonne, righe di anteprima, risultato |
| `Import/CsvImportProfiles.cs` | 7 profili predefiniti |
| `Import/CsvImportService.cs` | lettura, rilevamento colonne, anteprima, deduplicazione, import in lotto |
| `MarketData/MarketDataService.cs` | fonte prezzi/tassi, contratti e servizio |
| `Reporting/ReportModels.cs` | documento di report: sezioni, tabelle, grafici |
| `Reporting/ReportBuilder.cs` | 8 report (flussi, budget, patrimonio, portafoglio, ricorrenti, obiettivi, previsione, anno su anno) |
| `Reporting/ExportService.cs` | CSV (movimenti e tabelle), XLSX, PDF, JSON |

**FinanceOS.App** (29.306 righe)

| File | Responsabilità |
|---|---|
| `Program.cs` | punto di ingresso, host, cultura, DI, self-check |
| `App.xaml` / `App.xaml.cs` | risorse globali, ciclo di vita, sessione, errori |
| `Converters/*` | convertitori di binding, normalizzazione dei campi importo |
| `Services/ViewFactory.cs` | mappa chiave → (vista, view model) |
| `Services/DialogService.cs` | `IDialogService` e dialoghi Windows |
| `Services/ThemeManager.cs` | tema chiaro/scuro/sistema |
| `Services/FileLoggerProvider.cs` | log giornaliero su file con oscuramento |
| `Services/AutoSave.cs` | salvataggio automatico con debounce |
| `Services/SessionCoordinator.cs` | richiesta di disconnessione |
| `Services/CountryCatalog.cs`, `DomainLabels.cs` | etichette italiane di tipi e voci |
| `ViewModels/MainViewModel.cs` | guscio: navigazione, periodo, valuta, ricerca, tema, notifiche |
| `ViewModels/DashboardViewModel*.cs`, `DashboardInsights.cs`, `Widget*.cs` | dashboard, widget, approfondimenti |
| `ViewModels/TransactionsViewModel*.cs` | registro movimenti (filtri, colonne, selezione, scheda, autosalvataggio) |
| `ViewModels/AccountsViewModel*.cs`, `AccountViewModel.cs` | conti e riconciliazione; gestione profilo |
| `ViewModels/BudgetViewModel.cs`, `RecurringViewModel.cs`, `GoalsViewModel.cs` | budget, ricorrenti, obiettivi |
| `ViewModels/NetWorthViewModel.cs`, `PortfolioViewModel.cs` | patrimonio, investimenti |
| `ViewModels/ReportsViewModel.cs`, `ImportViewModel.cs`, `AssistantViewModel.cs`, `SettingsViewModel*.cs` | report, importazione, assistente, impostazioni |
| `ViewModels/LoginViewModel.cs`, `OnboardingViewModel.cs` | accesso e procedura guidata |
| `Views/*.xaml` + `.xaml.cs` | finestre e pagine; code-behind solo per comportamento visivo |
| `Themes/Light.xaml`, `Dark.xaml`, `Controls.xaml` | palette e stili |

**FinanceOS.Cli** (675 righe): `Program.cs` con i comandi descritti nella sezione 14.

**tests/FinanceOS.Tests** (5.356 righe): 21 file `.cs` (18 con test, 3 di supporto), 236 casi di test (sezione 15).

---

## 4. Avvio, sessione e ciclo di vita

### 4.1 `Program.Main` — sequenza esatta

1. Riconosce l'argomento `--self-check` (confronto senza distinzione di maiuscole).
2. Applica la cultura italiana: `CultureInfo.DefaultThreadCurrentCulture`, `DefaultThreadCurrentUICulture` e
   `CurrentCulture` = `it-IT`. Da qui derivano separatore decimale «,», separatore delle migliaia «.» e
   date `gg/mm/aaaa` in tutta l'applicazione.
3. `AppPaths.EnsureDirectories()`: crea cartella dati, backup, allegati, log, import.
4. Costruisce l'host con `Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { ContentRootPath = AppContext.BaseDirectory })`.
   La configurazione (`appsettings.json`) si legge **accanto all'eseguibile**, non nella cartella di avvio:
   un collegamento con «Esegui in» diverso non perde le impostazioni.
5. Logging: rimuove i provider predefiniti, aggiunge `FileLoggerProvider(AppPaths.LogsDirectory)`, livello
   minimo `Information`.
6. Risolve la cartella dei profili: prima `FINANCEOS_USERS_DIR`, poi `FinanceOS:UsersDirectory` di
   `appsettings.json`; se entrambe assenti passa `null` (l'`AuthService` userà `%LOCALAPPDATA%\FinanceOS\users`).
7. `AddFinanceOsData(usersRoot: …)` e `AddFinanceOsIntegrations()`.
8. Registra `IDialogService → DialogService`, `SessionCoordinator`, `ViewFactory` come singleton.
9. Registra i view model (16 singleton): `LoginViewModel`, `AccountViewModel`, `MainViewModel`,
   `OnboardingViewModel`, `DashboardViewModel`, `AccountsViewModel`, `TransactionsViewModel`,
   `BudgetViewModel`, `RecurringViewModel`, `GoalsViewModel`, `NetWorthViewModel`, `PortfolioViewModel`,
   `ReportsViewModel`, `ImportViewModel`, `AssistantViewModel`, `SettingsViewModel`.
10. Registra le viste: `MainWindow`, `AccountWindow`, `LoginWindow`, `OnboardingWindow` come **transient**
    (una finestra chiusa non si può rimostrare: serve una nuova istanza a ogni accesso); le 12 pagine
    (`DashboardView`, `AccountsView`, `TransactionsView`, `BudgetView`, `RecurringView`, `GoalsView`,
    `NetWorthView`, `PortfolioView`, `ReportsView`, `ImportView`, `AssistantView`, `SettingsView`) come
    singleton.
11. `host.Build()`.
12. `PrepareUserFolders`: chiama `AuthService.EnsureUserFolders()` per allineare le cartelle dei profili
    (sezione 6.3) e registra gli spostamenti; un errore sui file viene registrato come avviso e **non**
    impedisce l'avvio.
13. `new App(host)` + `app.InitializeComponent()`.
14. Se `--self-check`: esegue `RunSelfCheck(host)`, libera l'host e restituisce il codice di uscita.
15. Altrimenti `app.Run()`, poi `host.Dispose()`.

### 4.2 Verifica di integrità (`FinanceOS.exe --self-check`)

Non apre finestre. Esegue `DatabaseInitializer.InitializeAsync()` e stampa percorso del database, numero di
movimenti e di conti; poi risolve dal contenitore 35 tipi (le 4 finestre, le 12 pagine, i 16 view model,
`SessionCoordinator`, `AccountViewModel`, `AccountWindow`) stampando `ok: <tipo>`. Raccoglie i fallimenti e
restituisce `0` se non ce ne sono, `1` altrimenti. Serve a escludere errori di configurazione XAML/DI prima
dell'uso normale, ed è usato dagli script di rilascio.

### 4.3 `App` — ciclo di vita e sessione

Costruttore: risolve logger e `AuthService`; chiama `AmountFieldNormalizer.Attach()` (normalizzazione dei
campi importo quando perdono il fuoco); sottoscrive `DispatcherUnhandledException`,
`AppDomain.CurrentDomain.UnhandledException`, `TaskScheduler.UnobservedTaskException`.

`OnStartup`:

- `ShutdownMode = OnExplicitShutdown` (l'applicazione non termina quando si chiude una finestra qualsiasi).
- Sottoscrive `SessionCoordinator.LogoutRequested`.
- Avvia `StartSessionAsync()` (fire-and-forget, errori gestiti internamente).

`StartSessionAsync`:

1. Mostra `LoginWindow` in modale. Se l'utente annulla: registra «Accesso annullato: applicazione chiusa
   senza aprire i dati» e `Shutdown(0)` — nessun dato viene letto prima dell'accesso.
2. Registra l'account connesso.
3. `DatabaseInitializer.InitializeAsync()` (migrazioni + seed) sul database del profilo scelto.
4. Legge `ui.theme` (default `FollowSystem`) e applica il tema.
5. Scrive `system.lastOpenedAtUtc`.
6. Se `onboarding.completed` è falso mostra `OnboardingWindow`, altrimenti `MainWindow`; imposta
   `Application.MainWindow`, sottoscrive `Closed` e mostra.
7. Qualsiasi eccezione: log `Critical`, `MessageBox` con il messaggio e il percorso dei log, `Shutdown(1)`.

Disconnessione (`SessionCoordinator.RequestLogout()` → `App.OnLogoutRequested` accodata al dispatcher a
priorità `Background`, così la finestra account si chiude prima): chiude tutte le finestre con
`_loggingOut = true`, `AuthService.Logout()` (azzera l'utente e la variabile `FINANCEOS_DATA_DIR`),
`MainViewModel.Reset()`, poi riavvia `StartSessionAsync()`.

Chiusura finestre (`OnStartupWindowClosed`): durante la disconnessione non fa nulla; se non restano finestre
termina; se nessuna finestra è caricata e visibile termina. In pratica: chiudere la finestra principale (o
l'onboarding) chiude l'applicazione.

Errori non gestiti: l'eccezione del dispatcher viene registrata, mostrata con «Si è verificato un errore
imprevisto… L'operazione è stata annullata: nessun dato è stato modificato a metà.» e marcata gestita
(`e.Handled = true`), quindi l'applicazione resta aperta. Le eccezioni di dominio sono registrate come
critiche; quelle delle attività non osservate vengono registrate e marcate osservate.

### 4.4 Accesso (schermata di login)

`LoginWindow` + `LoginViewModel`: se non esistono profili la schermata crea il primo account (nome utente,
password, conferma, nome visualizzato); altrimenti autentica. Il comando `SwitchMode` alterna
accesso/creazione. Se per il profilo esiste una credenziale ricordata (file `.remember`, sezione 6.4) la
password viene proposta già pronta. L'accesso attiva la cartella dati del profilo prima di aprire il
database.

### 4.5 Procedura guidata iniziale (`OnboardingWindow`)

Sei passaggi, navigabili avanti/indietro e saltabili singolarmente (`Next`, `Back`, `SkipStep`, `Complete`):

- **A — Profilo**: valuta di riferimento, paese, esperienza (semplice/avanzata).
- **B — Conti**: elenco modificabile (nome, tipo, valuta, saldo iniziale, istituto) con `AddAccount` /
  `RemoveAccount`.
- **C — Categorie**: albero predefinito, rinomina (`RenameCategory`) e ripristino (`RestoreDefaultCategories`).
- **D — Budget**: primo budget mensile.
- **E — Dashboard**: scelta del layout iniziale.
- **F — Importazioni**: rimando alla schermata di importazione.

I messaggi di avviso del passaggio sono mostrati accanto ai campi. Al termine scrive
`onboarding.completed = true`.

---

## 5. Configurazione, percorsi e log

### 5.1 `appsettings.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "FinanceOS": {
    "UsersDirectory": "D:\\Lavori\\programmi\\Finance OS\\Utenti",
    "EnableNetworkConnectors": true,
    "RefreshMarketDataOnStartup": false
  }
}
```

Note vincolanti:

- **Nessun segreto** nel file. Le chiavi API si inseriscono dall'applicazione e restano cifrate con DPAPI.
- `UsersDirectory` è una comodità di **sviluppo**: il pacchetto distribuito viene riscritto da
  `build-release.ps1` senza questa chiave, così in produzione si usa `%LOCALAPPDATA%\FinanceOS\users`.
- Le chiavi il cui nome inizia per `//` sono commenti.
- Il programma **non legge file `.env`**: il file `.env.example` elenca soltanto i nomi delle variabili
  riconosciute, per chi le inietta con uno script o con Infisical.

### 5.2 Variabili d'ambiente

| Variabile | Effetto | Precedenza |
|---|---|---|
| `FINANCEOS_USERS_DIR` | cartella che contiene `accounts.json` e una sottocartella per profilo | massima su `FinanceOS:UsersDirectory` |
| `FINANCEOS_DATA_DIR` | cartella dati del profilo attivo (database, backup, allegati, log, import) | impostata da `AuthService.Activate` all'accesso; usata dai test per isolare i dati |

### 5.3 `AppPaths`

| Proprietà | Valore |
|---|---|
| `AuthRootDirectory` | `FINANCEOS_USERS_DIR` se impostata, altrimenti `%LOCALAPPDATA%\FinanceOS\users` |
| `DataDirectory` | `FINANCEOS_DATA_DIR` se impostata, altrimenti `%LOCALAPPDATA%\FinanceOS` |
| `DatabasePath` | `<DataDirectory>\financeos.db` |
| `BackupsDirectory` | `<DataDirectory>\backups` |
| `AttachmentsDirectory` | `<DataDirectory>\attachments` |
| `LogsDirectory` | `<DataDirectory>\logs` |
| `ImportsDirectory` | `<DataDirectory>\imports` |
| `SuggestedExportDirectory` | `Documenti\FinanceOS` (non la cartella dati) |
| `ConnectionString` | `Data Source=<DatabasePath>;Cache=Shared;Foreign Keys=True` |
| `BackupFileName(ts, encrypted)` | `financeos-yyyyMMdd-HHmmss.fosx` (cifrato) oppure `.db` |
| `LogFilePath` | `<LogsDirectory>\financeos-.log` (segnaposto; il provider usa il nome giornaliero) |

### 5.4 Log

`FileLoggerProvider` scrive **un file per giorno**: `financeos-yyyyMMdd.log` nella cartella dei log del
profilo. Ogni riga: `yyyy-MM-dd HH:mm:ss [Livello] Categoria: messaggio`. I messaggi sono filtrati da una
funzione di oscuramento che nasconde password, token e chiavi. Un errore di scrittura del log non
interrompe mai l'applicazione. `IsEnabled` è vero per livello ≥ `Information`; le categorie
`Microsoft.EntityFrameworkCore.Database.Command` sono silenziate a `Warning` dalla configurazione.---

## 6. Profili locali, autenticazione e segreti

### 6.1 Elenco dei profili (`accounts.json`)

Un unico file JSON nella cartella utenti contiene un **array** di profili (`UserAccount`), non un oggetto
con versione:

```json
[
  {
    "Id": "9f2c1d7a4b8e4f0c8a1b2c3d4e5f6071",
    "UserName": "Moldrok",
    "DisplayName": "Moldrok",
    "PasswordHash": "pbkdf2-sha256$210000$<sale Base64>$<chiave Base64>",
    "CreatedAtUtc": "2026-10-12T09:41:22.0000000+00:00",
    "LastLoginAtUtc": "2026-10-20T18:03:11.0000000+00:00",
    "LoginCount": 17,
    "AllowPasswordlessLogin": true
  }
]
```

| Campo | Tipo | Note |
|---|---|---|
| `Id` | string | GUID senza trattini (`Guid.NewGuid().ToString("N")`); identificativo interno stabile, usato anche come nome della vecchia cartella |
| `UserName` | string | 3–32 caratteri, solo lettere, cifre, spazi e `. _ -`; unico senza distinzione fra maiuscole e minuscole; **determina il nome della cartella dati** e non è modificabile |
| `DisplayName` | string | 1–60 caratteri, modificabile (`UpdateProfile`); se vuoto alla creazione diventa uguale a `UserName` |
| `PasswordHash` | string | `pbkdf2-sha256$iterazioni$sale$hash` (base64), mai la password |
| `CreatedAtUtc`, `LastLoginAtUtc` | string | date ISO 8601 «O» (UTC); proprietà calcolate `CreatedAt` (`DateTimeOffset`, `MinValue` se illeggibile) e `LastLoginAt` (nullable) |
| `LoginCount` | int | incrementato a ogni accesso riuscito |
| `AllowPasswordlessLogin` | bool | true quando esiste il file `.remember` valido |

Serializzazione: `WriteIndented = true`, `DefaultIgnoreCondition = WhenWritingNull`.
Scrittura **atomica**: si scrive `<file>.tmp` e si esegue `File.Move(tmp, file, overwrite: true)`; una
interruzione non lascia un elenco troncato. La cartella viene creata se manca.

**Elenco illeggibile.** Se il file esiste ma non è leggibile o non è JSON valido, `Load()` non lancia:
imposta `StoreError` con un messaggio che riporta causa, percorso e istruzioni (copiare il file, ripristinare
un backup, o rinominarlo per ripartire) e restituisce un elenco vuoto. In questo stato:

- `ListUsers()` restituisce vuoto ma `HasUsers()` è falso: la schermata di accesso mostra l'errore, non
  propone la creazione di un nuovo profilo;
- `Register` e `Authenticate` rifiutano con lo stesso messaggio, **senza mai sovrascrivere** il file;
- `StoreError` si azzera alla prima lettura riuscita.

Un file mancante non è un errore: significa «nessun profilo».

### 6.2 Password

`PasswordHasher` (statico):

| Parametro | Valore |
|---|---|
| Algoritmo | PBKDF2-HMAC-SHA256 (`Rfc2898DeriveBytes.Pbkdf2`) |
| Iterazioni | 210.000 (`DefaultIterations`) |
| Sale | 16 byte casuali (`RandomNumberGenerator.GetBytes`) per ogni hash |
| Lunghezza chiave | 32 byte |
| Formato | `pbkdf2-sha256$<iterazioni>$<sale base64>$<chiave base64>` |
| Verifica | ricalcolo con le iterazioni memorizzate + `CryptographicOperations.FixedTimeEquals` |
| Hash malformato | `Verify` restituisce `false` (nessuna eccezione) |
| Aggiornamento | `NeedsRehash` vero se il prefisso non è quello atteso o se `iterazioni < 210.000`; all'accesso riuscito l'hash viene rigenerato senza chiedere la password |

Regole di validazione (`AuthService.ValidatePassword`): minimo 8 caratteri (`MinimumPasswordLength`),
almeno una lettera e almeno una cifra. Non ci sono requisiti di simboli o scadenza.

Comportamenti di sicurezza deliberati: messaggio identico per utente inesistente e password errata («Nome
utente o password non corretti.»); nessuna registrazione della password nei log; `ChangePassword` verifica
la password attuale e, se le credenziali erano ricordate, **riscrive subito** il file protetto.

### 6.3 Cartelle dei profili e migrazione

- Cartella dati di un profilo: `<cartella utenti>\<nome utente ripulito>`, per esempio
  `%LOCALAPPDATA%\FinanceOS\users\Moldrok`.
- Ripulitura del nome: caratteri non ammessi nel file system → `_`; punti e spazi finali rimossi; se resta
  vuoto → `profilo`; se il nome è riservato da Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
  `LPT1`–`LPT9`, senza distinzione di maiuscole) → si aggiunge `_profilo`.
- Oltre al database, la cartella contiene `backups`, `attachments`, `logs`, `imports`, il file di note
  `<nome utente>.md` e l'eventuale `.remember`.
- `FolderNameFor` usa la cartella con il nome utente se esiste; altrimenti, per i profili non ancora
  migrati, usa la cartella con l'identificativo interno (comportamento delle versioni precedenti).
- `EnsureUserFolders()` (chiamato all'avvio prima della finestra di accesso) per ogni profilo:
  1. se la cartella col nome utente esiste → nessuno spostamento (registra `Moved=false`);
  2. altrimenti se esiste la cartella con l'id → `Directory.Move(legacy, expected)`; se lo spostamento
     fallisce (`IOException`/`UnauthorizedAccessException`, file in uso) ricrea la cartella legacy e
     continua con quella, senza interrompere l'avvio;
  3. altrimenti crea la cartella.
  Poi riscrive il file di note di ogni profilo. Restituisce `UserFolderChange(UserName, From, To, Moved)`.
- `Activate(user)` crea la cartella, imposta la variabile `FINANCEOS_DATA_DIR` su di essa e chiama
  `AppPaths.EnsureDirectories()`: da quel momento ogni servizio che usa `AppPaths` lavora solo sui dati di
  quel profilo. `Logout()`/`Deactivate()` rimuove la variabile.

### 6.4 Credenziale ricordata (`.remember`)

- File: `<cartella profilo>\.remember`, **nascosto** (`FileAttributes.Hidden`), scritto in UTF-8,
  sempre tramite `<file>.tmp` + `File.Move(…, overwrite: true)`.
- Contenuto: stringa protetta con DPAPI `Protect("<nome utente>\n<password>")`, restituita Base64.
  Il nome utente nel payload impedisce che un file copiato valga per un altro profilo; la lettura
  confronta il nome (senza distinzione di maiuscole) e rifiuta il resto.
- Entropia: `Encoding.UTF8.GetBytes("FinanceOS.SecretStore.v1")`, ambito `CurrentUser`.
- Se DPAPI non è disponibile (`IsAvailable` falso, cioè fuori da Windows) il file viene cancellato e
  `AllowPasswordlessLogin` posto a false: si preferisce chiedere la password piuttosto che salvarla male.
- `RememberCredentials` / `ForgetCredentials` aggiornano anche il campo `AllowPasswordlessLogin` e le note;
  `ForgetCredentials` azzera gli attributi prima di cancellare.
- `HasRememberedCredential`, `RememberedPassword`, `FindRememberedUser` sono tolleranti: un errore di I/O
  restituisce `false`/`null`, mai un'eccezione nella schermata di accesso.

### 6.5 Note del profilo (`<nome utente>.md`)

`WriteAccountNotes` rigenera a ogni accesso (e a ogni modifica di profilo o credenziale) un file Markdown
nella cartella del profilo, in UTF-8. Contiene: nome di accesso, nome mostrato, identificativo, data di
creazione, ultimo accesso, numero di accessi, presenza delle credenziali ricordate, descrizione
dell'algoritmo di hashing (senza segreti), percorsi di cartella, database (con dimensione in byte), backup,
allegati, registro, `.remember` ed elenco profili, più una lista di operazioni utili (copia di sicurezza,
spostamento su un altro computer, import/export, eliminazione, avvertenza di non modificare a mano il
database). Le date sono in `dd/MM/yyyy HH:mm` locali, «mai» se assenti. Un errore di scrittura viene
ignorato: le note sono informative e non devono impedire l'accesso.

### 6.6 Segreti nei dati: DPAPI

`ISecretProtector` ha due implementazioni. `DpapiSecretProtector` (produzione): `ProtectedData.Protect` con
entropia `FinanceOS.SecretStore.v1` e `DataProtectionScope.CurrentUser`, risultato Base64; `Unprotect`
restituisce `null` su `FormatException`/`CryptographicException` invece di lanciare. `InMemorySecretProtector`
(solo test): AES-256 con chiave fissa `SHA256("financeos-test-key")`, IV casuale anteposto al testo cifrato.
Il protettore DPAPI viene usato per le credenziali ricordate, per i valori di impostazione marcati segreti
(`AppSettingKeys.IsSecret`) e per le chiavi dei connettori bancari. La chiave del backup cifrato è protetta
allo stesso modo (sezione 6.8).

### 6.7 Registro di audit

Due meccanismi, entrambi locali:

1. **Automatico** — `AuditSaveChangesInterceptor` (`SaveChangesInterceptor`) intercetta `SavingChanges` e
   `SavingChangesAsync`. Per ogni entità dell'elenco chiuso (Account, Transaction, TransactionSplit,
   Category, Budget, BudgetAllocation, RecurringTransaction, SavingsGoal, Asset, Liability, Security,
   InvestmentTransaction, Dividend, MarketPrice, ExchangeRate, Rule, DashboardLayout, Integration,
   ImportBatch) aggiunge un `AuditEvent` con `Action` (`Create`/`Update`/`Delete`), `Category` e
   `EntityType` = nome del tipo, `EntityId`, `Summary` («Creazione Account: …», «Modifica …», usando la
   prima proprietà fra `Name`, `Description`, `FileName`, troncata a 120 caratteri più «…»), `AppVersion`
   e, solo per le modifiche, `DetailsJson = {"ChangedProperties":[nomi ordinati]}`. **Nessun valore** viene
   registrato: solo nomi di proprietà.
2. **Esplicito** — `AuditService` usato dai servizi per eventi che non passano da `SaveChanges` o che
   meritano una descrizione propria (accesso, backup, ripristino, importazioni, sincronizzazione,
   cancellazione dati, modifiche di impostazioni sensibili).### 6.8 Backup cifrato e ripristino

`BackupService` produce file `.fosx` (cifrati) o `.db` (copia in chiaro), nella cartella `backups` del
profilo o in una cartella scelta. Nome: `financeos-yyyyMMdd-HHmmss.fosx`.

**Creazione.**

1. Copia coerente del database **in esercizio** con `VACUUM INTO $target` (file temporaneo in `%TEMP%`):
   è la modalità documentata da SQLite per ottenere una copia compatta e consistente senza fermare l'app.
2. Se cifrato, generazione di chiave AES-256 casuale (32 byte) e IV casuale (16 byte); la chiave in
   Base64 viene protetta con DPAPI e la copia in chiaro viene **sempre** eliminata (`finally`).
3. Scrittura del file e aggiornamento dell'impostazione `backup.lastAtUtc`; restituisce `BackupInfo`
   (percorso, nome, dimensione, data, cifrato, `DisplaySize` in B/KB/MB).

**Struttura binaria del `.fosx`** (tutti gli interi in little-endian):

| Offset | Lunghezza | Contenuto |
|---|---|---|
| 0 | 4 | magic ASCII `FOSX` (`"FOSX"u8`) |
| 4 | 1 | versione del formato = `1` |
| 5 | 16 | IV AES casuale |
| 21 | 4 | `int32` lunghezza `L` della chiave protetta |
| 25 | `L` | chiave AES-256 in Base64, cifrata con DPAPI (UTF-8) |
| 25+L | resto | database cifrato AES-256-CBC, padding PKCS7 |

**Ripristino.** Prima di toccare il database corrente viene salvata una copia di sicurezza non cifrata
`pre-ripristino-yyyyMMdd-HHmmss.db`; poi il file viene decifrato (o copiato) in un temporaneo, verificato con
`PRAGMA integrity_check` (deve rispondere `ok`), solo allora `SqliteConnection.ClearAllPools()` e
`File.Copy(decrypted, database, overwrite: true)`. Il temporaneo viene sempre eliminato.

**Errori previsti** (messaggi in italiano, nessun dato toccato): «Il file non è un backup cifrato di Finance
OS.» (magic errato), «Versione del formato di backup non supportata (n).», «Backup danneggiato: chiave non
valida.» (lunghezza fuori da 1–4096), «File di backup incompleto o danneggiato.», «Impossibile decifrare il
backup: la chiave è protetta da un altro profilo Windows…», «Il file di backup non è integro: <esito>».
Conseguenza dichiarata: un `.fosx` è ripristinabile solo dallo stesso utente Windows sullo stesso computer
(o con il profilo DPAPI migrato); per il trasporto fra computer serve una copia `.db` o un export JSON.

**Elenco** (`ListBackupsAsync`): solo file `.db` e `.fosx`, ordinati per data di scrittura decrescente.
**Eliminazione**: `DeleteBackupAsync` elimina il file indicato se esiste e restituisce `false` altrimenti.

### 6.9 Esportazione e cancellazione dei dati personali (`PersonalDataService`)

**Export JSON** (`ExportAllDataJsonAsync`): un solo file, `WriteIndented`, `WhenWritingNull`,
`ReferenceHandler.IgnoreCycles` (le entità hanno riferimenti bidirezionali). Contenuto: `ExportInfo`
(`Application="Finance OS"`, `ExportedAtUtc`, `FormatVersion=1`, nota), poi `Accounts`, `Categories`,
`Transactions` (con `Splits`), `Budgets` (con `Allocations`), `RecurringTransactions`, `SavingsGoals`,
`Assets`, `Liabilities`, `Securities`, `InvestmentTransactions`, `Dividends`, `MarketPrices`,
`ExchangeRates`, `Rules` (con `Conditions`), `DashboardLayouts` (con `Widgets`), `Notifications`,
`ImportBatches` e `Settings` **solo non segrete** (chiave, valore, data). Le tabelle `AuditEvents`,
`SyncRuns`, `Integrations`, `PortfolioPositions`, `BudgetPeriods`, `RecurringAmountChanges`,
`BalanceReconciliations`, `Attachments`, `AppSettings` segrete **non** sono incluse. Viene scritta una voce di
audit `Export` nella categoria «Privacy» e restituito il percorso.

**Cancellazione** (`DeleteAllPersonalDataAsync`): richiede la frase esatta `ELIMINA TUTTO`
(confronto ordinale, dopo `Trim`), altrimenti lancia `InvalidOperationException` con il messaggio
«Conferma non valida: digitare esattamente «ELIMINA TUTTO» per procedere.». Ordine di svuotamento (per
rispettare i vincoli di chiave esterna): TransactionSplits, Attachments, Transactions,
InvestmentTransactions, Dividends, PortfolioPositions, MarketPrices, Securities, ExchangeRates,
BudgetPeriods, BudgetAllocations, Budgets, RecurringAmountChanges, RecurringTransactions, SavingsGoals,
Assets, Liabilities, RuleConditions, Rules, BalanceReconciliations, Accounts, ImportBatches, SyncRuns,
Integrations, Notifications, DashboardWidgets, DashboardLayouts, AuditEvents. Le impostazioni segrete
(`IsSecret`) vengono **sempre** eliminate; le altre solo con `keepSettings=false`. Restituisce
`DeletionReport` (dizionario tabella → righe eliminate, `TotalRows`, `SettingsKept`) e scrive una voce di
audit `Delete`.---

## 7. Modello dati

### 7.1 Principi e convenzioni del `FinanceOsDbContext`

- EF Core 8 + provider SQLite; contesto costruito da `IDbContextFactory<FinanceOsDbContext>` (un contesto per
  operazione, mai un contesto condiviso di lunga durata).
- Convenzioni globali (`ConfigureConventions`): `string` → lunghezza massima **4000** (ogni campo che la
  richiede la sovrascrive esplicitamente), `decimal` → `ScaledDecimalConverter` (intero `long` ×10⁶).
- Gli `enum` sono persistiti come **interi** con i valori della sezione 18.1; cambiarne il valore rompe i
  dati esistenti.
- Le date di calendario sono `DateOnly` (in SQLite testo `yyyy-MM-dd`), gli istanti sono `DateTime`/`DateTimeOffset`
  UTC; le date «di giornata» mostrate all'utente vengono convertite in locale solo per la visualizzazione.
- Gli importi sono `long` in unità 1/10⁴ (`…Minor`); le quantità sono `long` scalate a 10⁸ (`QuantityScaled`).
- Nessuno stato derivato è persistito: saldi, spesi, patrimonio, plusvalenze e riporti dei budget sono
  calcolati. Le uniche eccezioni dichiarate sono `PortfolioPositions` (cache ricostruibile) e
  `BudgetPeriods.RolloverInMinor` (riporto storicizzato per periodo).
- Tutte le tabelle hanno `Id` `Guid` con default `Guid.NewGuid()` lato oggetto; `CreatedAtUtc`/`UpdatedAtUtc`
  sono valorizzati nel codice (non da trigger).
- Proprietà `[NotMapped]` di comodo (`Amount`, `OpeningBalance`, `Difference`, `Quantity`, `DisplayName`, …)
  espongono `Money`/`decimal` senza essere colonne.

### 7.2 Conti e riconciliazioni

**`Accounts`** (`Account`)

| Campo | Tipo | Note |
|---|---|---|
| `Id` | Guid | chiave |
| `Name` | string(200), obbligatorio | |
| `Type` | `AccountType` | default `Checking` |
| `Nature` | `AccountNature` | default `Asset`; `Liability` per carte di credito/linee |
| `Currency` | char(3), obbligatorio | default `EUR` |
| `OpeningBalanceMinor` | long | saldo all'apertura/aggiunta, 1/10⁴ |
| `OpeningBalanceDate` | DateOnly | default oggi |
| `OpeningBalanceIsEstimate` | bool | saldo iniziale dichiarato per stima |
| `Institution` | string(200)? | |
| `Notes` | string(2000)? | |
| `ExternalId` | string(200)? | IBAN mascherato / `account_id` del provider |
| `IsArchived` | bool | archiviato ≠ eliminato |
| `IncludeInNetWorth` | bool | default true |
| `IncludeInLiquidity` | bool | default true |
| `IsInternal` | bool | conto tecnico interno |
| `CreditLimitMinor` | long? | limite informativo (positivo) |
| `IntegrationId` | Guid? | FK `Integrations`, `SET NULL` |
| `SortOrder` | int | ordine manuale |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | UTC |

Proprietà calcolate: `OpeningBalance`, `CreditLimit`, `IsLiquid` (natura `Asset` **e** tipo fra Checking,
Savings, Deposit, Cash, DebitCard, DigitalWallet), `IsInvestmentAccount` (Broker o Investment), `DisplayName`
(`Name · Institution` se c'è l'istituto).
Indici: `Name`, `(IntegrationId, ExternalId)`, `SortOrder`.

**`BalanceReconciliations`** (`BalanceReconciliation`): `Id`, `AccountId` (FK `Accounts`, **Cascade**),
`StatementDate` DateOnly, `StatementBalanceMinor` long, `ComputedBalanceMinor` long, `Currency` char(3),
`Notes`(2000), `IsResolved` bool, `ResolvedByTransactionId` Guid?, `CreatedAtUtc`. Calcolate: `Difference`
(= calcolato − estratto conto), `StatementBalance`, `ComputedBalance`. Indice unico `(AccountId, StatementDate)`.
La differenza non viene mai corretta in automatico.

### 7.3 Categorie e regole

**`Categories`** (`Category`)

| Campo | Tipo | Note |
|---|---|---|
| `Id` | Guid | le 104 categorie predefinite hanno GUID deterministici |
| `Name` | string(120), obbligatorio | unico fra fratelli |
| `Kind` | `CategoryKind` | una figlia deve avere la stessa natura del padre |
| `ParentId` | Guid? | FK `Categories` **Restrict** (eliminare il padre non elimina i figli; l'app impedisce comunque l'eliminazione con figli) |
| `Icon` | string(60)? | nome dell'icona, non un percorso |
| `ColorHex` | string(9)? | `#RRGGBB` |
| `SortOrder` | int | |
| `IsArchived` | bool | |
| `IsDeletable` | bool | false per le categorie di sistema |
| `IsSystem` | bool | generata da seed o sistema |
| `Description` | string(500)? | |
| `Slug` | string(120)? | chiave stabile (usata da obiettivi/trasferimenti) |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | |

Calcolate: `IsIncome`, `IsExpenseLike` (Expense, Fee, Tax, Debt), `IsRealExpense` (solo Expense),
`IsFinancialCost` (Fee, Tax), `IsInvestment`, `IsTransfer`; metodo `RootId(byId)` che risale al padre con
massimo 32 livelli (guardia contro cicli) per i raggruppamenti di primo livello.
Indici: `Slug`; unico `(ParentId, Name)`.

**`Rules`** / **`RuleConditions`**: `Rule` ha `Id`, `Name`(200), `Priority` (default 100), `IsEnabled`,
`MatchAll` (true = tutte le condizioni, false = almeno una), `SetCategoryId` (FK `Categories`, `SET NULL`),
`SetPayee`(200), `SetTags`(500), `AppendNote`(1000), `SetStatus` (`TransactionStatus?`), `StopProcessing`,
`TimesApplied`, `LastAppliedAtUtc?`, date, `Conditions`. `RuleCondition` ha `Id`, `RuleId` (FK **Cascade**),
`Field` (`RuleMatchField`), `Operator` (`RuleOperator`), `Value`(500), `SecondValue`(500, per `Between`),
`CaseSensitive`, `SortOrder`. Indici: `Rules.Priority`, `RuleConditions.RuleId`.

### 7.4 Movimenti, suddivisioni, allegati

**`Transactions`** (`Transaction`) — convenzione di segno: **negativo = uscita dal conto, positivo = entrata**.

| Campo | Tipo | Note |
|---|---|---|
| `Id` | Guid | |
| `Date` | DateOnly | data contabile |
| `Time` | TimeOnly? | ora facoltativa |
| `AmountMinor` | long | importo con segno, 1/10⁴ |
| `Currency` | char(3), obbligatorio | valuta del conto |
| `Description` | string(500), obbligatorio | descrizione |
| `Payee` | string(200)? | esercente |
| `AccountId` | Guid | FK `Accounts` **Restrict** |
| `CounterpartyAccountId` | Guid? | conto di destinazione (solo trasferimenti), FK Restrict |
| `TransferGroupId` | Guid? | lega le due gambe di un trasferimento |
| `CategoryId` | Guid? | FK `Categories` **Restrict** |
| `Status` | `TransactionStatus` | default `Confirmed` |
| `Source` | `TransactionSource` | default `Manual` |
| `Notes` | string(4000)? | |
| `Tags` | string(500)? | separati da virgola, minuscolo |
| `ExternalId` | string(200)? | identificativo della fonte esterna |
| `DedupeHash` | char(64)? | SHA-256 esadecimale dell'impronta (sezione 11.2) |
| `ImportBatchId` | Guid? | FK `ImportBatches` `SET NULL` |
| `RecurringTransactionId` | Guid? | FK `RecurringTransactions` `SET NULL` |
| `InvestmentTransactionId` | Guid? | riferimento all'operazione di portafoglio (nessuna FK dichiarata) |
| `LiabilityId` | Guid? | FK `Liabilities` `SET NULL` |
| `PrincipalMinor` | long? | quota capitale della rata |
| `InterestMinor` | long? | quota interessi (l'unica parte che è un costo) |
| `HasSplits` | bool | true se esistono righe in `TransactionSplits` |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | |

Calcolate: `Amount`, `AbsAmount`, `IsOutflow`, `IsInflow`, `IsInternalTransfer` (`TransferGroupId` o
`CounterpartyAccountId` valorizzati), `Principal`, `Interest`, `TagList`.
Indici: `Date`, `(AccountId, Date)`, `(CategoryId, Date)`, `DedupeHash`, `TransferGroupId`, `ImportBatchId`,
`RecurringTransactionId`, `Status`, e **unico filtrato** `(AccountId, ExternalId) WHERE "ExternalId" IS NOT NULL`
(difesa strutturale contro i doppi import).

**`TransactionSplits`** (`TransactionSplit`): `Id`, `TransactionId` (FK **Cascade**), `CategoryId` (FK
**Restrict**), `AmountMinor`, `Currency` char(3), `Note`(1000), `Tags`(500), `SortOrder`. Vincolo
applicativo: **la somma delle quote è esattamente l'importo del movimento** (stesso segno, stessa valuta).
Indici `TransactionId`, `CategoryId`.

**`Attachments`** (`Attachment`): `Id`, `TransactionId` (FK **Cascade**, nullable), `EntityType` (default
`"Transaction"`), `EntityId`, `FileName`(300, obbligatorio), `ContentType`(150), `SizeBytes` long,
`RelativePath`(500) **relativo** alla cartella dati, `Sha256` char(64), `CreatedAtUtc`, `Notes`(1000).
Indici `(EntityType, EntityId)`, `Sha256`.

### 7.5 Budget

**`Budgets`** (`Budget`): `Id`, `Name`(200), `PeriodType` (`Monthly`), `StartDate`, `EndDate?`,
`TotalLimitMinor` (long?, null = somma dei limiti di categoria), `Currency`, `RolloverMode` (`None`,
`PositiveOnly`, `Full`), `AlertThresholdPercent` (default 80, ammesso 0–200), `IsActive`, `IncludeSubcategories`
(default true), `SortOrder`, `Notes`(2000), `IsGlobal` (budget generale su tutte le spese), date. Calcolate:
`TotalLimit`. Indici `IsActive`, `SortOrder`.

**`BudgetAllocations`**: `Id`, `BudgetId` (FK **Cascade**), `CategoryId` (Guid?, FK **Restrict**),
`LimitMinor`, `Currency`, `SortOrder`, `Notes`(1000); calcolata `Limit`. Indice `(BudgetId, CategoryId)`.

**`BudgetPeriods`**: `Id`, `BudgetId` (FK **Cascade**), `StartDate`, `EndDate`, `RolloverInMinor` (long;
positivo = residuo disponibile, negativo = sforamento riportato), `LimitOverrideMinor` (long?), `IsClosed`,
`Notes`(1000), `CreatedAtUtc`, `Currency`; calcolate `RolloverIn`, `LimitOverride`. Indice unico
`(BudgetId, StartDate)`.

### 7.6 Ricorrenze

**`RecurringTransactions`** (`RecurringTransaction`): `Id`, `Name`(200), `Frequency` (`RecurrenceFrequency`),
`Interval` (default 1, es. ogni 3 mesi), `CustomIntervalDays` (int?), `StartDate`, `EndDate?`, `NextDueDate`,
`ExpectedAmountMinor` (long, con segno), `Currency`, `AccountId` (FK **Restrict**), `CategoryId` (FK
**Restrict**, nullable), `Payee`(200), `DayOfMonth` (1–31, informativo), `ReminderDaysBefore` (default 3),
`CreateDraftTransaction` (crea un movimento `Draft` alla maturazione), `Status` (`Active`), `MaxOccurrences`
(int?), `OccurrencesCount`, `LastOccurrenceDate?`, `Notes`(2000), `Tags`(500), `IsSubscription`, date,
`AmountChanges`. Calcolata `ExpectedAmount`. Indici `NextDueDate`, `Status`, `(AccountId, Name)`.
Il programma non crea né cancella mai da solo l'addebito: genera promemoria e, se richiesto, una bozza.

**`RecurringAmountChanges`**: `Id`, `RecurringTransactionId` (FK **Cascade**), `EffectiveDate`,
`PreviousAmountMinor`, `NewAmountMinor`, `Currency`, `DetectedAutomatically`, `Notes`(1000), `CreatedAtUtc`;
indice `(RecurringTransactionId, EffectiveDate)`.

### 7.7 Obiettivi

**`SavingsGoals`** (`SavingsGoal`): `Id`, `Name`(200), `Type` (`GoalType`), `TargetAmountMinor`, `Currency`,
`TargetDate?`, `ManualCurrentAmountMinor` (long?; se null la quota è calcolata dai movimenti),
`LinkedAccountId` (FK `Accounts` `SET NULL`), `LinkedCategoryId` (FK `Categories` `SET NULL`),
`ContributionTag`(120) (alternativa al conto), `PlannedMonthlyContributionMinor` (long?), `EmergencyFundMonths`
(int?, per il fondo emergenze), `Priority` (default 3), `AchievedDate?`, `IsArchived`, `Notes`(2000),
`SortOrder`, `ColorHex`(9), date. Calcolate `TargetAmount`, `ManualCurrentAmount`,
`PlannedMonthlyContribution`, `IsManual`. Indice `Priority`.### 7.8 Patrimonio netto: attività e passività

**`Assets`** (`Asset`): `Id`, `Name`(200), `Kind` (`AssetKind`), `EstimatedValueMinor`, `Currency`,
`ValueDate` (default oggi), `IsEstimate` (default **true**: il valore è dichiarato dall'utente, non una
quotazione verificata), `AnnualDepreciationRate` (decimal?, es. `0.15`, solo informativo), `IsArchived`,
`Notes`(2000), `LinkedAccountId` (FK `Accounts` `SET NULL`), date. Calcolata `EstimatedValue`. Indice `Kind`.

**`Liabilities`** (`Liability`): `Id`, `Name`(200), `Kind` (`LiabilityKind`), `Currency`, `PrincipalMinor`
(capitale finanziato), `OutstandingMinor` (capitale residuo, positivo), `AnnualInterestRate` (decimal),
`SpreadRate` (decimal?), `IsVariableRate`, `StartDate`, `EndDate?`, `InstallmentAmountMinor` (long?),
`RemainingInstallments` (int?), `InstallmentsPerYear` (default 12), `LinkedAccountId` (FK `SET NULL`),
`LinkedCategoryId` (FK `SET NULL`), `IsArchived`, `Notes`(2000), `Institution`(200), date. Calcolate
`Principal`, `Outstanding`, `InstallmentAmount`, `RepaidRatio` (= `1 − Outstanding/Principal`, 0 se capitale 0).
Indice `Kind`. L'app non modifica mai il debito senza un movimento: il residuo cambia solo con le rate.

### 7.9 Investimenti

**`Securities`** (`Security`): `Id`, `Name`(200), `Ticker`(30)?, `Isin`(12)?, `Exchange`(60)?,
`Type` (`SecurityType`, default `Etf`), `Currency`, `Sector`(120)?, `Region`(120)?, `IsGovernmentBond`
(aliquota 12,5% nella stima fiscale), `IsActive` (default true), `Notes`(2000), `PriceSymbol`(60)?
(simbolo per il provider di prezzi, non una credenziale), date. Calcolata `DisplayName` (`Name (Ticker)`).
Indici `Ticker`, `Isin`, `(Name, Currency)`.

**`InvestmentTransactions`** (`InvestmentTransaction`)

| Campo | Tipo | Note |
|---|---|---|
| `Id` | Guid | |
| `SecurityId` | Guid | FK `Securities` **Restrict** |
| `AccountId` | Guid | FK `Accounts` **Restrict** |
| `Type` | `InvestmentTransactionType` | default `Buy`; `IncreasesPosition` = Buy/TransferIn, `DecreasesPosition` = Sell/TransferOut |
| `TradeDate` | DateOnly | |
| `SettlementDate` | DateOnly? | |
| `QuantityScaled` | long | quantità ×10⁸ (frazioni e cripto) |
| `PricePerUnitMinor` | long | prezzo unitario, 1/10⁴ |
| `GrossAmountMinor` | long | quantità × prezzo, valuta dello strumento |
| `FeesMinor` | long | commissioni |
| `TaxesMinor` | long | imposte |
| `NetAmountMinor` | long | cassa netta (positivo = denaro in entrata sul conto) |
| `Currency` | char(3) | |
| `ExchangeRateToAccountCurrency` | decimal? | cambio registrato all'operazione |
| `LinkedTransactionId` | Guid? | FK `Transactions` `SET NULL`: riconcilia portafoglio e conto |
| `ExternalId` | string(200)? | |
| `ImportBatchId` | Guid? | FK `ImportBatches` `SET NULL` |
| `Notes` | string(2000)? | |

Calcolate: `Quantity` (decimale da `QuantityScaled`), `PricePerUnit`, `GrossAmount`, `Fees`, `Taxes`,
`NetAmount`. Indici `(SecurityId, TradeDate)`, `(AccountId, TradeDate)`, `LinkedTransactionId`, `ImportBatchId`.

**`PortfolioPositions`** (`PortfolioPosition`) — cache derivata, ricostruibile dalle operazioni:
`Id`, `AccountId` (FK **Cascade**), `SecurityId` (FK **Cascade**), `QuantityScaled`, `AverageCostPerUnitMinor`,
`CostBasisMinor`, `LastPriceMinor` (long?), `LastPriceDate` (DateOnly?), `MarketValueMinor` (long?),
`RealizedPnlMinor`, `RealizedFeesMinor`, `RealizedTaxesMinor`, `DividendsMinor`, `Currency`,
`Method` (`CostBasisMethod`), `IsPriceStale`, `UpdatedAtUtc`. Calcolate `Quantity`, `CostBasis`,
`MarketValue`, `LastPrice`, `RealizedPnl`, `UnrealizedPnl` (null se manca il prezzo). Indice unico
`(AccountId, SecurityId)`.

**`Dividends`** (`Dividend`): `Id`, `SecurityId` (FK **Restrict**), `AccountId` (FK **Restrict**),
`PaymentDate`, `ExDate?`, `GrossAmountMinor`, `WithholdingTaxMinor`, `NetAmountMinor`, `Currency`,
`InvestmentTransactionId` (Guid?, nessuna FK), `IsReinvested`, `Notes`(1000), `ExternalId`(200), `CreatedAtUtc`.
Calcolate `GrossAmount`, `NetAmount`, `WithholdingTax`. Indice `(SecurityId, PaymentDate)`.

**`MarketPrices`** (`MarketPrice`): `Id`, `SecurityId` (FK **Cascade**), `Date`, `PriceMinor`, `Currency`,
`SourceKind` (`PriceSourceKind`, default `Manual`), `SourceName`(120)?, `IsStale`, `RetrievedAtUtc`.
Calcolata `Price`. Indice unico `(SecurityId, Date, SourceKind)` e indice su `Date`.

**`ExchangeRates`** (`ExchangeRate`): `Id`, `BaseCurrency` char(3), `QuoteCurrency` char(3), `Date`,
`Rate` decimal (quante unità di `QuoteCurrency` vale **1** unità di `BaseCurrency`), `SourceKind`
(`ExchangeRateSourceKind`, default `Manual`), `SourceName`(120)?, `IsManual`, `RetrievedAtUtc`, `Notes`(1000).
Indice unico `(BaseCurrency, QuoteCurrency, Date, SourceKind)` e indice su `Date`.

### 7.10 Piattaforma

**`Integrations`** (`Integration`): `Id`, `ProviderSlug`(120, obbligatorio), `DisplayName`(200, obbligatorio),
`Kind` (`IntegrationKind`), `Status` (`IntegrationStatus`, default `NotConfigured`), `Environment`
(`Sandbox`/`Production`, default Sandbox), `InstitutionId`(200)?, `InstitutionName`(200)?,
`ExternalReference`(300)?, `AccessValidUntil` (DateOnly?), `LastReconfirmationDate` (DateOnly?),
`DefaultAccountId` (Guid?), `SettingsJson`(20000) **senza credenziali**, `LastErrorMessage`(2000),
`LastSyncAtUtc?`, `LastSuccessAtUtc?`, `IsDemo`, `IsEnabled`, `SecretReference`(200) (nome della voce
nello storage protetto), date, `SyncRuns`. Indici `ProviderSlug`, `Status`.

**`SyncRuns`** (`SyncRun`): `Id`, `IntegrationId` (FK **Cascade**), `StartedAtUtc`, `FinishedAtUtc?`,
`Status` (`SyncRunStatus`), `AccountsProcessed`, `TransactionsFetched`, `TransactionsImported`,
`DuplicatesSkipped`, `ErrorsCount`, `IsDemo`, `PeriodFrom?`, `PeriodTo?`, `NextCursor`(500),
`ErrorMessage`(2000), `LogJson`(20000). Indice `(IntegrationId, StartedAtUtc)`.

**`DashboardLayouts`** (`DashboardLayout`): `Id`, `Name`(120, obbligatorio, **unico**), `Description`(500)?,
`IsDefault`, `IsBuiltIn`, `SortOrder`, date, `Widgets`.

**`DashboardWidgets`** (`DashboardWidget`): `Id`, `LayoutId` (FK **Cascade**), `WidgetType`,
`CustomTitle`(120)?, `Row`, `Column`, `Width` (default 4, griglia a **12 colonne**), `Height` (default 220 px
logici), `Size` (`WidgetSize`), `IsVisible` (default true), `SortOrder`, `SettingsJson`(10000).
Indice `(LayoutId, Row, Column)`.

**`Notifications`** (`Notification`): `Id`, `Kind` (`NotificationKind`), `Severity` (`NotificationSeverity`),
`Title`(200, obbligatorio), `Message`(2000), `CreatedAtUtc`, `IsRead`, `ReadAtUtc?`, `RelatedEntityType`(120)?,
`RelatedEntityId` (Guid?), `DedupeKey`(300)?, `ActionHint`(200)?. Indice `(IsRead, CreatedAtUtc)` e indice
**unico filtrato** su `DedupeKey WHERE "DedupeKey" IS NOT NULL` (evita lo stesso avviso ogni giorno).
Nessuna notifica esce dal computer.

**`AuditEvents`** (`AuditEvent`): `Id`, `TimestampUtc`, `Action` (`AuditAction`), `Category`(120, default
«Generale»), `EntityType`(120), `EntityId` (Guid?), `Summary`(500), `DetailsJson`(20000)?,
`AppVersion`(40). Indici `TimestampUtc`, `(EntityType, EntityId)`.

**`AppSettings`** (`AppSetting`): chiave primaria `Key` (string 200), `Value`(8000)?, `IsSecret`, `IsEncrypted`,
`UpdatedAtUtc`, `Description`(500)?. I valori con `IsSecret` sono cifrati con DPAPI prima di essere scritti.

**`ImportBatches`** (`ImportBatch`): `Id`, `Source`(120, obbligatorio), `FileName`(300)?, `FileSha256`
char(64)?, `ProfileName`(120)?, `PeriodFrom?`, `PeriodTo?`, `RowsTotal`, `RowsImported`, `RowsSkipped`,
`RowsFailed`, `DuplicatesDetected`, `DefaultAccountId` (Guid?), `MappingJson`(10000)?, `ErrorSummary`(4000)?,
`DryRun`, `ImportedAtUtc`, `Notes`(2000)?. Indici `ImportedAtUtc`, `FileSha256`.

### 7.11 Tabelle colonna per colonna (tutti i 30 `DbSet`)

Legenda dei tipi SQL (SQLite): `Guid` → `TEXT`, `string` → `TEXT`, `long`/`int`/`bool`/`enum` → `INTEGER`
(`bool` come 0/1), `DateTime` → `TEXT` ISO 8601, `DateOnly` → `TEXT` `yyyy-MM-dd`, `TimeOnly` → `TEXT`
`HH:mm:ss`, `decimal` → `INTEGER` scalato ×10⁶ (`ScaledDecimalConverter`). Le lunghezze indicate sono quelle
configurate in EF Core: SQLite non le impone, ma EF le valida e le usa nelle migrazioni per altri provider.
“Obbl.” = colonna `NOT NULL`.

#### 7.11.1 `Accounts` (`Account`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | `IX_Accounts_Name` | — |
| `Type` | `AccountType` | INTEGER | — | sì | — | — |
| `Nature` | `AccountNature` | INTEGER | — | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `OpeningBalanceMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `OpeningBalanceDate` | DateOnly | TEXT | — | sì | — | — |
| `OpeningBalanceIsEstimate` | bool | INTEGER | — | sì | — | — |
| `Institution` | string? | TEXT | 200 | no | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `ExternalId` | string? | TEXT | 200 | no | `IX_Accounts_IntegrationId_ExternalId` | — |
| `IsArchived` | bool | INTEGER | — | sì | — | — |
| `IncludeInNetWorth` | bool | INTEGER | — | sì | — | — |
| `IncludeInLiquidity` | bool | INTEGER | — | sì | — | — |
| `IsInternal` | bool | INTEGER | — | sì | — | — |
| `CreditLimitMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `IntegrationId` | Guid? | TEXT | — | no | `IX_Accounts_IntegrationId_ExternalId` | `Integrations.Id` → **SET NULL** |
| `SortOrder` | int | INTEGER | — | sì | `IX_Accounts_SortOrder` | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.2 `BalanceReconciliations` (`BalanceReconciliation`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `AccountId` | Guid | TEXT | — | sì | unico `(AccountId, StatementDate)` | `Accounts.Id` → **CASCADE** |
| `StatementDate` | DateOnly | TEXT | — | sì | unico `(AccountId, StatementDate)` | — |
| `StatementBalanceMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `ComputedBalanceMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `IsResolved` | bool | INTEGER | — | sì | — | — |
| `ResolvedByTransactionId` | Guid? | TEXT | — | no | — | nessuna FK dichiarata |
| `CreatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.3 `Transactions` (`Transaction`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Date` | DateOnly | TEXT | — | sì | `IX_Transactions_Date`, `(AccountId, Date)`, `(CategoryId, Date)` | — |
| `Time` | TimeOnly? | TEXT | — | no | — | — |
| `AmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `Description` | string | TEXT | 500 | sì | — | — |
| `Payee` | string? | TEXT | 200 | no | — | — |
| `AccountId` | Guid | TEXT | — | sì | `(AccountId, Date)` | `Accounts.Id` → **RESTRICT** |
| `CounterpartyAccountId` | Guid? | TEXT | — | no | — | `Accounts.Id` → **RESTRICT** |
| `TransferGroupId` | Guid? | TEXT | — | no | `IX_Transactions_TransferGroupId` | — |
| `CategoryId` | Guid? | TEXT | — | no | `(CategoryId, Date)` | `Categories.Id` → **RESTRICT** |
| `Status` | `TransactionStatus` | INTEGER | — | sì | `IX_Transactions_Status` | — |
| `Source` | `TransactionSource` | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 4000 | no | — | — |
| `Tags` | string? | TEXT | 500 | no | — | — |
| `ExternalId` | string? | TEXT | 200 | no | **unico filtrato** `(AccountId, ExternalId) WHERE "ExternalId" IS NOT NULL` | — |
| `DedupeHash` | string? | TEXT | 64 (fisso) | no | `IX_Transactions_DedupeHash` | — |
| `ImportBatchId` | Guid? | TEXT | — | no | `IX_Transactions_ImportBatchId` | `ImportBatches.Id` → **SET NULL** |
| `RecurringTransactionId` | Guid? | TEXT | — | no | `IX_Transactions_RecurringTransactionId` | `RecurringTransactions.Id` → **SET NULL** |
| `InvestmentTransactionId` | Guid? | TEXT | — | no | — | nessuna FK dichiarata |
| `LiabilityId` | Guid? | TEXT | — | no | — | `Liabilities.Id` → **SET NULL** |
| `PrincipalMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `InterestMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `HasSplits` | bool | INTEGER | — | sì | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.4 `TransactionSplits` (`TransactionSplit`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `TransactionId` | Guid | TEXT | — | sì | `IX_TransactionSplits_TransactionId` | `Transactions.Id` → **CASCADE** |
| `CategoryId` | Guid | TEXT | — | sì | `IX_TransactionSplits_CategoryId` | `Categories.Id` → **RESTRICT** |
| `AmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `Note` | string? | TEXT | 1000 | no | — | — |
| `Tags` | string? | TEXT | 500 | no | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |

#### 7.11.5 `Attachments` (`Attachment`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `TransactionId` | Guid? | TEXT | — | no | — | `Transactions.Id` → **CASCADE** |
| `EntityType` | string | TEXT | 4000 (default) | sì | `(EntityType, EntityId)` | — |
| `EntityId` | Guid | TEXT | — | sì | `(EntityType, EntityId)` | — |
| `FileName` | string | TEXT | 300 | sì | — | — |
| `ContentType` | string | TEXT | 150 | sì | — | — |
| `SizeBytes` | long | INTEGER | — | sì | — | — |
| `RelativePath` | string | TEXT | 500 | sì | — | — |
| `Sha256` | string | TEXT | 64 (fisso) | sì | `IX_Attachments_Sha256` | — |
| `CreatedAtUtc` | DateTime | TEXT | — | sì | — | — |
| `Notes` | string? | TEXT | 1000 | no | — | — |

#### 7.11.6 `Categories` (`Category`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 120 | sì | unico `(ParentId, Name)` | — |
| `Kind` | `CategoryKind` | INTEGER | — | sì | — | — |
| `ParentId` | Guid? | TEXT | — | no | unico `(ParentId, Name)` | `Categories.Id` → **RESTRICT** |
| `Icon` | string? | TEXT | 60 | no | — | — |
| `ColorHex` | string? | TEXT | 9 | no | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |
| `IsArchived` | bool | INTEGER | — | sì | — | — |
| `IsDeletable` | bool | INTEGER | — | sì | — | — |
| `IsSystem` | bool | INTEGER | — | sì | — | — |
| `Description` | string? | TEXT | 500 | no | — | — |
| `Slug` | string? | TEXT | 120 | no | `IX_Categories_Slug` | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.7 `Rules` (`Rule`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | — | — |
| `Priority` | int | INTEGER | — | sì | `IX_Rules_Priority` | — |
| `IsEnabled` | bool | INTEGER | — | sì | — | — |
| `MatchAll` | bool | INTEGER | — | sì | — | — |
| `SetCategoryId` | Guid? | TEXT | — | no | — | `Categories.Id` → **SET NULL** |
| `SetPayee` | string? | TEXT | 200 | no | — | — |
| `SetTags` | string? | TEXT | 500 | no | — | — |
| `AppendNote` | string? | TEXT | 1000 | no | — | — |
| `SetStatus` | `TransactionStatus?` | INTEGER | — | no | — | — |
| `StopProcessing` | bool | INTEGER | — | sì | — | — |
| `TimesApplied` | int | INTEGER | — | sì | — | — |
| `LastAppliedAtUtc` | DateTime? | TEXT | — | no | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.8 `RuleConditions` (`RuleCondition`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `RuleId` | Guid | TEXT | — | sì | `IX_RuleConditions_RuleId` | `Rules.Id` → **CASCADE** |
| `Field` | `RuleMatchField` | INTEGER | — | sì | — | — |
| `Operator` | `RuleOperator` | INTEGER | — | sì | — | — |
| `Value` | string? | TEXT | 500 | no | — | — |
| `SecondValue` | string? | TEXT | 500 | no | — | — |
| `CaseSensitive` | bool | INTEGER | — | sì | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |

#### 7.11.9 `Budgets` (`Budget`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | — | — |
| `PeriodType` | `BudgetPeriodType` | INTEGER | — | sì | — | — |
| `StartDate` | DateOnly | TEXT | — | sì | — | — |
| `EndDate` | DateOnly? | TEXT | — | no | — | — |
| `TotalLimitMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `RolloverMode` | `RolloverMode` | INTEGER | — | sì | — | — |
| `AlertThresholdPercent` | int | INTEGER | 0–200 | sì | — | — |
| `IsActive` | bool | INTEGER | — | sì | `IX_Budgets_IsActive` | — |
| `IncludeSubcategories` | bool | INTEGER | — | sì | — | — |
| `SortOrder` | int | INTEGER | — | sì | `IX_Budgets_SortOrder` | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `IsGlobal` | bool | INTEGER | — | sì | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.10 `BudgetAllocations` (`BudgetAllocation`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `BudgetId` | Guid | TEXT | — | sì | `(BudgetId, CategoryId)` | `Budgets.Id` → **CASCADE** |
| `CategoryId` | Guid? | TEXT | — | no | `(BudgetId, CategoryId)` | `Categories.Id` → **RESTRICT** |
| `LimitMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 1000 | no | — | — |

#### 7.11.11 `BudgetPeriods` (`BudgetPeriod`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `BudgetId` | Guid | TEXT | — | sì | unico `(BudgetId, StartDate)` | `Budgets.Id` → **CASCADE** |
| `StartDate` | DateOnly | TEXT | — | sì | unico `(BudgetId, StartDate)` | — |
| `EndDate` | DateOnly | TEXT | — | sì | — | — |
| `RolloverInMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `LimitOverrideMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `IsClosed` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 1000 | no | — | — |
| `CreatedAtUtc` | DateTime | TEXT | — | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |

#### 7.11.12 `RecurringTransactions` (`RecurringTransaction`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | `(AccountId, Name)` | — |
| `Frequency` | `RecurrenceFrequency` | INTEGER | — | sì | — | — |
| `Interval` | int | INTEGER | ≥ 1 | sì | — | — |
| `CustomIntervalDays` | int? | INTEGER | — | no | — | — |
| `StartDate` | DateOnly | TEXT | — | sì | — | — |
| `EndDate` | DateOnly? | TEXT | — | no | — | — |
| `NextDueDate` | DateOnly | TEXT | — | sì | `IX_RecurringTransactions_NextDueDate` | — |
| `ExpectedAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `AccountId` | Guid | TEXT | — | sì | `(AccountId, Name)` | `Accounts.Id` → **RESTRICT** |
| `CategoryId` | Guid? | TEXT | — | no | — | `Categories.Id` → **RESTRICT** |
| `Payee` | string? | TEXT | 200 | no | — | — |
| `DayOfMonth` | int? | INTEGER | 1–31 | no | — | — |
| `ReminderDaysBefore` | int | INTEGER | — | sì | — | — |
| `CreateDraftTransaction` | bool | INTEGER | — | sì | — | — |
| `Status` | `RecurringStatus` | INTEGER | — | sì | `IX_RecurringTransactions_Status` | — |
| `MaxOccurrences` | int? | INTEGER | — | no | — | — |
| `OccurrencesCount` | int | INTEGER | — | sì | — | — |
| `LastOccurrenceDate` | DateOnly? | TEXT | — | no | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `Tags` | string? | TEXT | 500 | no | — | — |
| `IsSubscription` | bool | INTEGER | — | sì | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.13 `RecurringAmountChanges` (`RecurringAmountChange`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `RecurringTransactionId` | Guid | TEXT | — | sì | `(RecurringTransactionId, EffectiveDate)` | `RecurringTransactions.Id` → **CASCADE** |
| `EffectiveDate` | DateOnly | TEXT | — | sì | `(RecurringTransactionId, EffectiveDate)` | — |
| `PreviousAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `NewAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `DetectedAutomatically` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 1000 | no | — | — |
| `CreatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.14 `SavingsGoals` (`SavingsGoal`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | — | — |
| `Type` | `GoalType` | INTEGER | — | sì | — | — |
| `TargetAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `TargetDate` | DateOnly? | TEXT | — | no | — | — |
| `ManualCurrentAmountMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `LinkedAccountId` | Guid? | TEXT | — | no | — | `Accounts.Id` → **SET NULL** |
| `LinkedCategoryId` | Guid? | TEXT | — | no | — | `Categories.Id` → **SET NULL** |
| `ContributionTag` | string? | TEXT | 120 | no | — | — |
| `PlannedMonthlyContributionMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `EmergencyFundMonths` | int? | INTEGER | — | no | — | — |
| `Priority` | int | INTEGER | — | sì | `IX_SavingsGoals_Priority` | — |
| `AchievedDate` | DateOnly? | TEXT | — | no | — | — |
| `IsArchived` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |
| `ColorHex` | string? | TEXT | 9 | no | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.15 `Assets` (`Asset`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | — | — |
| `Kind` | `AssetKind` | INTEGER | — | sì | `IX_Assets_Kind` | — |
| `EstimatedValueMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `ValueDate` | DateOnly | TEXT | — | sì | — | — |
| `IsEstimate` | bool | INTEGER | — | sì | — | — |
| `AnnualDepreciationRate` | decimal? | INTEGER | ×10⁶ | no | — | — |
| `IsArchived` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `LinkedAccountId` | Guid? | TEXT | — | no | — | `Accounts.Id` → **SET NULL** |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.16 `Liabilities` (`Liability`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | — | — |
| `Kind` | `LiabilityKind` | INTEGER | — | sì | `IX_Liabilities_Kind` | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `PrincipalMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `OutstandingMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `AnnualInterestRate` | decimal | INTEGER | ×10⁶ | sì | — | — |
| `SpreadRate` | decimal? | INTEGER | ×10⁶ | no | — | — |
| `IsVariableRate` | bool | INTEGER | — | sì | — | — |
| `StartDate` | DateOnly | TEXT | — | sì | — | — |
| `EndDate` | DateOnly? | TEXT | — | no | — | — |
| `InstallmentAmountMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `RemainingInstallments` | int? | INTEGER | — | no | — | — |
| `InstallmentsPerYear` | int | INTEGER | — | sì | — | — |
| `LinkedAccountId` | Guid? | TEXT | — | no | — | `Accounts.Id` → **SET NULL** |
| `LinkedCategoryId` | Guid? | TEXT | — | no | — | `Categories.Id` → **SET NULL** |
| `IsArchived` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `Institution` | string? | TEXT | 200 | no | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.17 `Securities` (`Security`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 200 | sì | `(Name, Currency)` | — |
| `Ticker` | string? | TEXT | 30 | no | `IX_Securities_Ticker` | — |
| `Isin` | string? | TEXT | 12 | no | `IX_Securities_Isin` | — |
| `Exchange` | string? | TEXT | 60 | no | — | — |
| `Type` | `SecurityType` | INTEGER | — | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | `(Name, Currency)` | — |
| `Sector` | string? | TEXT | 120 | no | — | — |
| `Region` | string? | TEXT | 120 | no | — | — |
| `IsGovernmentBond` | bool | INTEGER | — | sì | — | — |
| `IsActive` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `PriceSymbol` | string? | TEXT | 60 | no | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.18 `InvestmentTransactions` (`InvestmentTransaction`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `SecurityId` | Guid | TEXT | — | sì | `(SecurityId, TradeDate)` | `Securities.Id` → **RESTRICT** |
| `AccountId` | Guid | TEXT | — | sì | `(AccountId, TradeDate)` | `Accounts.Id` → **RESTRICT** |
| `Type` | `InvestmentTransactionType` | INTEGER | — | sì | — | — |
| `TradeDate` | DateOnly | TEXT | — | sì | `(SecurityId, TradeDate)`, `(AccountId, TradeDate)` | — |
| `SettlementDate` | DateOnly? | TEXT | — | no | — | — |
| `QuantityScaled` | long | INTEGER | ×10⁸ | sì | — | — |
| `PricePerUnitMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `GrossAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `FeesMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `TaxesMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `NetAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `ExchangeRateToAccountCurrency` | decimal? | INTEGER | ×10⁶ | no | — | — |
| `LinkedTransactionId` | Guid? | TEXT | — | no | `IX_InvestmentTransactions_LinkedTransactionId` | `Transactions.Id` → **SET NULL** |
| `ExternalId` | string? | TEXT | 200 | no | — | — |
| `ImportBatchId` | Guid? | TEXT | — | no | `IX_InvestmentTransactions_ImportBatchId` | `ImportBatches.Id` → **SET NULL** |
| `Notes` | string? | TEXT | 2000 | no | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.19 `PortfolioPositions` (`PortfolioPosition`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `AccountId` | Guid | TEXT | — | sì | **unico** `(AccountId, SecurityId)` | `Accounts.Id` → **CASCADE** |
| `SecurityId` | Guid | TEXT | — | sì | **unico** `(AccountId, SecurityId)` | `Securities.Id` → **CASCADE** |
| `QuantityScaled` | long | INTEGER | ×10⁸ | sì | — | — |
| `AverageCostPerUnitMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `CostBasisMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `LastPriceMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `LastPriceDate` | DateOnly? | TEXT | — | no | — | — |
| `MarketValueMinor` | long? | INTEGER | 1/10⁴ | no | — | — |
| `RealizedPnlMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `RealizedFeesMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `RealizedTaxesMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `DividendsMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `Method` | `CostBasisMethod` | INTEGER | — | sì | — | — |
| `IsPriceStale` | bool | INTEGER | — | sì | — | — |
| `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.20 `Dividends` (`Dividend`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `SecurityId` | Guid | TEXT | — | sì | `(SecurityId, PaymentDate)` | `Securities.Id` → **RESTRICT** |
| `AccountId` | Guid | TEXT | — | sì | — | `Accounts.Id` → **RESTRICT** |
| `PaymentDate` | DateOnly | TEXT | — | sì | `(SecurityId, PaymentDate)` | — |
| `ExDate` | DateOnly? | TEXT | — | no | — | — |
| `GrossAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `WithholdingTaxMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `NetAmountMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `InvestmentTransactionId` | Guid? | TEXT | — | no | — | nessuna FK dichiarata |
| `IsReinvested` | bool | INTEGER | — | sì | — | — |
| `Notes` | string? | TEXT | 1000 | no | — | — |
| `ExternalId` | string? | TEXT | 200 | no | — | — |
| `CreatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.21 `MarketPrices` (`MarketPrice`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `SecurityId` | Guid | TEXT | — | sì | **unico** `(SecurityId, Date, SourceKind)` | `Securities.Id` → **CASCADE** |
| `Date` | DateOnly | TEXT | — | sì | **unico** `(SecurityId, Date, SourceKind)`, `IX_MarketPrices_Date` | — |
| `PriceMinor` | long | INTEGER | 1/10⁴ | sì | — | — |
| `Currency` | string | TEXT | 3 (fisso) | sì | — | — |
| `SourceKind` | `PriceSourceKind` | INTEGER | — | sì | **unico** `(SecurityId, Date, SourceKind)` | — |
| `SourceName` | string? | TEXT | 120 | no | — | — |
| `IsStale` | bool | INTEGER | — | sì | — | — |
| `RetrievedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.22 `ExchangeRates` (`ExchangeRate`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `BaseCurrency` | string | TEXT | 3 (fisso) | sì | **unico** `(BaseCurrency, QuoteCurrency, Date, SourceKind)` | — |
| `QuoteCurrency` | string | TEXT | 3 (fisso) | sì | **unico** `(BaseCurrency, QuoteCurrency, Date, SourceKind)` | — |
| `Date` | DateOnly | TEXT | — | sì | **unico** `(…, Date, …)`, `IX_ExchangeRates_Date` | — |
| `Rate` | decimal | INTEGER | ×10⁶ | sì | — | — |
| `SourceKind` | `ExchangeRateSourceKind` | INTEGER | — | sì | **unico** `(…, SourceKind)` | — |
| `SourceName` | string? | TEXT | 120 | no | — | — |
| `IsManual` | bool | INTEGER | — | sì | — | — |
| `RetrievedAtUtc` | DateTime | TEXT | — | sì | — | — |
| `Notes` | string? | TEXT | 1000 | no | — | — |

#### 7.11.23 `Integrations` (`Integration`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `ProviderSlug` | string | TEXT | 120 | sì | `IX_Integrations_ProviderSlug` | — |
| `DisplayName` | string | TEXT | 200 | sì | — | — |
| `Kind` | `IntegrationKind` | INTEGER | — | sì | — | — |
| `Status` | `IntegrationStatus` | INTEGER | — | sì | `IX_Integrations_Status` | — |
| `Environment` | `IntegrationEnvironment` | INTEGER | — | sì | — | — |
| `InstitutionId` | string? | TEXT | 200 | no | — | — |
| `InstitutionName` | string? | TEXT | 200 | no | — | — |
| `ExternalReference` | string? | TEXT | 300 | no | — | — |
| `AccessValidUntil` | DateOnly? | TEXT | — | no | — | — |
| `LastReconfirmationDate` | DateOnly? | TEXT | — | no | — | — |
| `DefaultAccountId` | Guid? | TEXT | — | no | — | nessuna FK dichiarata |
| `SettingsJson` | string? | TEXT | 20000 | no | — | — |
| `LastErrorMessage` | string? | TEXT | 2000 | no | — | — |
| `LastSyncAtUtc` | DateTime? | TEXT | — | no | — | — |
| `LastSuccessAtUtc` | DateTime? | TEXT | — | no | — | — |
| `IsDemo` | bool | INTEGER | — | sì | — | — |
| `IsEnabled` | bool | INTEGER | — | sì | — | — |
| `SecretReference` | string? | TEXT | 200 | no | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.24 `SyncRuns` (`SyncRun`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `IntegrationId` | Guid | TEXT | — | sì | `(IntegrationId, StartedAtUtc)` | `Integrations.Id` → **CASCADE** |
| `StartedAtUtc` | DateTime | TEXT | — | sì | `(IntegrationId, StartedAtUtc)` | — |
| `FinishedAtUtc` | DateTime? | TEXT | — | no | — | — |
| `Status` | `SyncRunStatus` | INTEGER | — | sì | — | — |
| `AccountsProcessed` | int | INTEGER | — | sì | — | — |
| `TransactionsFetched` | int | INTEGER | — | sì | — | — |
| `TransactionsImported` | int | INTEGER | — | sì | — | — |
| `DuplicatesSkipped` | int | INTEGER | — | sì | — | — |
| `ErrorsCount` | int | INTEGER | — | sì | — | — |
| `IsDemo` | bool | INTEGER | — | sì | — | — |
| `PeriodFrom`, `PeriodTo` | DateOnly? | TEXT | — | no | — | — |
| `NextCursor` | string? | TEXT | 500 | no | — | — |
| `ErrorMessage` | string? | TEXT | 2000 | no | — | — |
| `LogJson` | string? | TEXT | 20000 | no | — | — |

#### 7.11.25 `DashboardLayouts` (`DashboardLayout`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Name` | string | TEXT | 120 | sì | **unico** `IX_DashboardLayouts_Name` | — |
| `Description` | string? | TEXT | 500 | no | — | — |
| `IsDefault` | bool | INTEGER | — | sì | — | — |
| `IsBuiltIn` | bool | INTEGER | — | sì | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |
| `CreatedAtUtc`, `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |

#### 7.11.26 `DashboardWidgets` (`DashboardWidget`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `LayoutId` | Guid | TEXT | — | sì | `(LayoutId, Row, Column)` | `DashboardLayouts.Id` → **CASCADE** |
| `WidgetType` | `WidgetType` | INTEGER | — | sì | — | — |
| `CustomTitle` | string? | TEXT | 120 | no | — | — |
| `Row` | int | INTEGER | — | sì | `(LayoutId, Row, Column)` | — |
| `Column` | int | INTEGER | — | sì | `(LayoutId, Row, Column)` | — |
| `Width` | int | INTEGER | default 4 | sì | — | — |
| `Height` | int | INTEGER | default 220 | sì | — | — |
| `Size` | `WidgetSize` | INTEGER | default `Medium` | sì | — | — |
| `IsVisible` | bool | INTEGER | default `true` | sì | — | — |
| `SortOrder` | int | INTEGER | — | sì | — | — |
| `SettingsJson` | string? | TEXT | 10000 | no | — | — |

#### 7.11.27 `Notifications` (`Notification`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Kind` | `NotificationKind` | INTEGER | — | sì | — | — |
| `Severity` | `NotificationSeverity` | INTEGER | — | sì | — | — |
| `Title` | string | TEXT | 200 | sì | — | — |
| `Message` | string | TEXT | 2000 | no (string vuota di default) | — | — |
| `CreatedAtUtc` | DateTime | TEXT | — | sì | `(IsRead, CreatedAtUtc)` | — |
| `IsRead` | bool | INTEGER | — | sì | `(IsRead, CreatedAtUtc)` | — |
| `ReadAtUtc` | DateTime? | TEXT | — | no | — | — |
| `RelatedEntityType` | string? | TEXT | 120 | no | — | — |
| `RelatedEntityId` | Guid? | TEXT | — | no | — | nessuna FK dichiarata |
| `DedupeKey` | string? | TEXT | 300 | no | **unico filtrato** `WHERE "DedupeKey" IS NOT NULL` | — |
| `ActionHint` | string? | TEXT | 200 | no | — | — |

#### 7.11.28 `AuditEvents` (`AuditEvent`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `TimestampUtc` | DateTime | TEXT | — | sì | `IX_AuditEvents_TimestampUtc` | — |
| `Action` | `AuditAction` | INTEGER | — | sì | — | — |
| `Category` | string | TEXT | 120 | sì | — | — |
| `EntityType` | string | TEXT | 120 | sì | `(EntityType, EntityId)` | — |
| `EntityId` | Guid? | TEXT | — | no | `(EntityType, EntityId)` | nessuna FK dichiarata |
| `Summary` | string | TEXT | 500 | sì | — | — |
| `DetailsJson` | string? | TEXT | 20000 | no | — | — |
| `AppVersion` | string | TEXT | 40 | sì | — | — |

#### 7.11.29 `AppSettings` (`AppSetting`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Key` | string | TEXT | 200 | sì | **PK** (chiave stringa) | — |
| `Value` | string? | TEXT | 8000 | no | — | — |
| `IsSecret` | bool | INTEGER | — | sì | — | — |
| `IsEncrypted` | bool | INTEGER | — | sì | — | — |
| `UpdatedAtUtc` | DateTime | TEXT | — | sì | — | — |
| `Description` | string? | TEXT | 500 | no | — | — |

#### 7.11.30 `ImportBatches` (`ImportBatch`)

| Colonna | CLR | SQL | Lunghezza | Obbl. | Indice | FK / eliminazione |
|---|---|---|---|---|---|---|
| `Id` | Guid | TEXT | — | sì | PK | — |
| `Source` | string | TEXT | 120 | sì | — | — |
| `FileName` | string? | TEXT | 300 | no | — | — |
| `FileSha256` | string? | TEXT | 64 (fisso) | no | `IX_ImportBatches_FileSha256` | — |
| `ProfileName` | string? | TEXT | 120 | no | — | — |
| `PeriodFrom`, `PeriodTo` | DateOnly? | TEXT | — | no | — | — |
| `RowsTotal` | int | INTEGER | — | sì | — | — |
| `RowsImported` | int | INTEGER | — | sì | — | — |
| `RowsSkipped` | int | INTEGER | — | sì | — | — |
| `RowsFailed` | int | INTEGER | — | sì | — | — |
| `DuplicatesDetected` | int | INTEGER | — | sì | — | — |
| `DefaultAccountId` | Guid? | TEXT | — | no | — | nessuna FK dichiarata |
| `MappingJson` | string? | TEXT | 10000 | no | — | — |
| `ErrorSummary` | string? | TEXT | 4000 | no | — | — |
| `DryRun` | bool | INTEGER | — | sì | — | — |
| `ImportedAtUtc` | DateTime | TEXT | — | sì | `IX_ImportBatches_ImportedAtUtc` | — |
| `Notes` | string? | TEXT | 2000 | no | — | — |

### 7.12 Vincoli trasversali, conversione e audit automatico

**Convenzioni globali** (`ConfigureConventions`):

- ogni `string` senza lunghezza esplicita diventa `HasMaxLength(4000)` (per esempio `Attachments.EntityType`);
- ogni `decimal` passa da `ScaledDecimalConverter`, un `ValueConverter<decimal, long>` che scrive
  `Decimals.ToScaled(value, 6)` e rilegge `Decimals.FromScaled(value, 6)`: serve a tassi, aliquote e percentuali,
  che restano esatti e ordinabili in SQL (l'arrotondamento è away-from-zero);
- gli **importi** non passano dal convertitore: sono già `long` in unità minori 1/10⁴ (`MoneyPrecision.Factor =
  10_000`), quindi somme e confronti in SQL non introducono errori;
- le **quantità** degli investimenti sono `long` scalate ×10⁸ (`QuantityScaled`).

**Stringa di connessione** (`AppPaths.ConnectionString` e `DependencyInjection`):
`Data Source={DatabasePath};Cache=Shared;Foreign Keys=True` — i vincoli di chiave esterna sono realmente attivi su
SQLite. **Non esistono trigger**: l'integrità sta nelle chiavi esterne, negli indici unici e nelle validazioni dei
servizi (il `PRAGMA integrity_check` compare solo nel controllo di integrità dei backup).

**Indici unici filtrati** (gli unici due del modello):

| Tabella | Indice | Filtro |
|---|---|---|
| `Transactions` | `(AccountId, ExternalId)` unico | `"ExternalId" IS NOT NULL` |
| `Notifications` | `DedupeKey` unico | `"DedupeKey" IS NOT NULL` |

**Audit automatico** (`AuditSaveChangesInterceptor`, registrato in `DependencyInjection` con
`options.AddInterceptors`): intercetta `SavingChanges`/`SavingChangesAsync` e, per ogni entità tracciata in stato
`Added`/`Modified`/`Deleted`, accoda un `AuditEvent` prima del salvataggio. Entità sorvegliate (19): `Account`,
`Transaction`, `TransactionSplit`, `Category`, `Budget`, `BudgetAllocation`, `RecurringTransaction`, `SavingsGoal`,
`Asset`, `Liability`, `Security`, `InvestmentTransaction`, `Dividend`, `MarketPrice`, `ExchangeRate`, `Rule`,
`DashboardLayout`, `Integration`, `ImportBatch`. Per ogni voce:

| Campo | Valore prodotto |
|---|---|
| `Action` | `Create` / `Update` / `Delete` dallo stato dell'entità |
| `Category`, `EntityType` | nome del tipo CLR (per esempio `Transaction`) |
| `EntityId` | valore della proprietà `Id` (riflessione), `null` se assente |
| `Summary` | «Creazione|Modifica|Eliminazione {Tipo}: {nome}» con la prima proprietà presente tra `Name`, `Description`, `FileName`, troncata a 120 caratteri con «…» |
| `DetailsJson` | solo per le modifiche: `{"ChangedProperties":[…]}` con i **nomi** delle proprietà modificate in ordine ordinale (mai i valori) |
| `AppVersion` | proprietà dell'interceptor, valore predefinito `0.1.0` |
| `TimestampUtc` | `DateTime.UtcNow` al momento della creazione della voce |

Le entità `AuditEvent` stesse non vengono sorvegliate (nessuna ricorsione).

### 7.13 Seed idempotente (`DatabaseInitializer`)

`InitializeAsync` crea le cartelle, legge le migrazioni pendenti (registrandole), esegue `MigrateAsync` e poi
chiama i tre seed nell'ordine categorie → layout → impostazioni. Rieseguirlo non duplica né sovrascrive le
scelte dell'utente.

| Seed | Criterio di idempotenza |
|---|---|
| Categorie (104 nel seed) | si leggono gli `Slug` esistenti e si aggiungono solo le voci con `Slug` non ancora presente; gli identificativi sono GUID deterministici ricavati dallo `Slug` (`DeterministicGuid`), quindi la stessa categoria ha lo stesso `Id` su ogni installazione |
| Layout di dashboard (6) | eseguito **solo se la tabella è vuota**; i widget vengono impacchettati con `DashboardLayoutService.Pack` |
| Impostazioni (33) | si aggiungono solo le chiavi mancanti; `IsSecret` viene da `AppSettingKeys.SecretKeys`, `IsEncrypted = false` finché il valore non viene cifrato al primo salvataggio |

**Difetto dichiarato nel seed delle categorie.** Il filtro è
`Where(c => c.Slug is null || !existing.Contains(c.Slug))`: una categoria predefinita **senza** `Slug`
verrebbe inserita a ogni avvio, duplicandosi. Oggi tutte le 104 voci hanno uno `Slug`, quindi il difetto è
latente; chi riscrive deve o mantenere l'invariante «ogni categoria predefinita ha uno Slug» o correggere il
filtro (comportamento preferibile: saltare le voci prive di chiave stabile).

**Schema dei GUID deterministici** (`DeterministicGuid.FromKey`): si calcola `SHA256("financeos:" + chiave.Trim().ToLowerInvariant())`,
si prendono i **primi 16 byte**, poi si forza `bytes[7] = (bytes[7] & 0x0F) | 0x50` (versione 5) e
`bytes[8] = (bytes[8] & 0x3F) | 0x80` (variante RFC 4122). La chiave usata dal seed è lo `Slug` della categoria:
l'`Id` è quindi identico su ogni installazione e i riferimenti già salvati dall'utente restano validi dopo un re-seed.

**Impostazioni predefinite: 33 voci** (`SeedSettingsAsync`). Sono inserite solo le chiavi mancanti; per tutte
`IsEncrypted = false` (la cifratura avviene al primo salvataggio di un valore segreto) e `IsSecret` viene da
`AppSettingKeys.SecretKeys` — nessuna delle 33 chiavi seminate è segreta.

| Costante | Chiave reale | Valore predefinito |
|---|---|---|
| `OnboardingCompleted` | `onboarding.completed` | `false` |
| `ProfileBaseCurrency` | `profile.baseCurrency` | `CurrencyCode.Default` (`EUR`) |
| `ProfileCountry` | `profile.country` | `IT` |
| `ProfileLocale` | `profile.locale` | `it-IT` |
| `ProfileDateFormat` | `profile.dateFormat` | `dd/MM/yyyy` |
| `ProfileFiscalMonthStartDay` | `profile.fiscalMonthStartDay` | `1` |
| `ProfileExperienceMode` | `profile.experienceMode` | `Simple` |
| `ProfileDataMode` | `profile.dataMode` | `Local` |
| `Theme` | `ui.theme` | `FollowSystem` |
| `AccentColor` | `ui.accentColor` | `#1565C0` |
| `WindowWidth` | `ui.window.width` | `1440` |
| `WindowHeight` | `ui.window.height` | `900` |
| `AutoLockEnabled` | `security.autoLockEnabled` | `false` |
| `AutoLockMinutes` | `security.autoLockMinutes` | `15` |
| `BackupOnExit` | `security.backupOnExit` | `false` |
| `EncryptBackups` | `security.encryptBackups` | `true` |
| `PortfolioCostBasisMethod` | `portfolio.costBasisMethod` | `WeightedAverage` |
| `PortfolioIncludeFeesInCostBasis` | `portfolio.includeFeesInCostBasis` | `true` |
| `PortfolioStalePriceDays` | `portfolio.stalePriceDays` | `7` |
| `FiscalGeneralRate` | `fiscal.generalRate` | `0,26` |
| `FiscalGovernmentBondRate` | `fiscal.governmentBondRate` | `0,125` |
| `FiscalLossCarryForwardYears` | `fiscal.lossCarryForwardYears` | `4` |
| `FiscalStampDutyRate` | `fiscal.stampDutyRate` | `0,002` |
| `BudgetDefaultAlertThreshold` | `budget.defaultAlertThreshold` | `80` |
| `BudgetDefaultRolloverMode` | `budget.defaultRolloverMode` | `None` |
| `CategoryMaxDepth` | `categories.maxDepth` | `3` |
| `AiEnabled` | `ai.enabled` | `false` |
| `AiRemoteProcessingConsent` | `ai.remoteProcessingConsent` | `false` |
| `AiSendAggregatedOnly` | `ai.sendAggregatedOnly` | `true` |
| `TelemetryEnabled` | `privacy.telemetryEnabled` | `false` |
| `InstallId` | `system.installId` | `Guid.NewGuid().ToString("N")` — unico valore diverso per installazione |
| `FirstRunAtUtc` | `system.firstRunAtUtc` | `DateTimeOffset.UtcNow.ToString("O")` al primo avvio |
| `DatabaseSchemaVersion` | `system.schemaVersion` | `1` |

`AppSettingKeys` definisce in totale 66 costanti (33 seminate più chiavi di onboarding, finestra, elenco movimenti,
backup, benchmark, IA, integrazioni e privacy); le 8 chiavi segrete sono `integration.gocardless.secretId`,
`integration.gocardless.secretKey`, `integration.plaid.clientId`, `integration.plaid.secret`,
`integration.enablebanking.applicationId`, `integration.enablebanking.privateKey`, `integration.marketdata.apiKey`,
`ai.apiKey`.

`GetStatusAsync` restituisce `DatabaseStatus`: percorso, dimensione, ultima scrittura, migrazioni applicate e
pendenti, numero di movimenti, conti e categorie; `IsUpToDate` è vero senza migrazioni pendenti.

### 7.14 Riepilogo dei comportamenti di eliminazione

| Relazione | Comportamento | Perché |
|---|---|---|
| `Transactions` → `Accounts`, `Categories`, `CounterpartyAccount`, `TransactionSplits` → `Categories` | **Restrict** | un conto o una categoria in uso non si può cancellare: si archivia |
| `BalanceReconciliations`, `TransactionSplits`, `Attachments`, `RuleConditions`, `BudgetAllocations`, `BudgetPeriods`, `RecurringAmountChanges`, `SyncRuns`, `DashboardWidgets` | **Cascade** dal padre | sono parti del padre |
| `Categories.Parent` | **Restrict** | eliminare un padre non deve cancellare i figli |
| `Accounts.IntegrationId`, `Rules.SetCategoryId`, `SavingsGoals`/`Assets`/`Liabilities` verso conti e categorie, `Transactions.ImportBatchId`, `Transactions.RecurringTransactionId`, `Transactions.LiabilityId`, `InvestmentTransactions.LinkedTransactionId` e `ImportBatchId` | **SetNull** | il dato resta, si perde solo il collegamento |
| `PortfolioPositions` → `Accounts`, `Securities`; `MarketPrices` → `Securities` | **Cascade** | cache priva di valore senza la sorgente |
SQLite viene aperto con `Foreign Keys=True` nella stringa di connessione: i vincoli sono realmente attivi.

---

## 8. Denaro, valute, date e formati

### 8.1 `Money` e `MoneyPrecision`

```csharp
MoneyPrecision.Decimals = 4;
MoneyPrecision.Factor   = 10_000L;   // unità minori persistite
```

`Money` è un `readonly struct` con due soli dati: `decimal Amount` e `string Currency` (normalizzata dal
costruttore). Non esiste un `Money` senza valuta: il costruttore senza codice usa `EUR`.

| Membro | Comportamento |
|---|---|
| `FromMinor(long, string)` | `minor / 10_000m`, valuta data |
| `ToMinor()` | `Decimals.ToScaled(Amount, 4)` (arrotondamento away-from-zero) |
| `Of`, `Zero`, `ZeroOf(currency)` | costruzione e zero tipizzato |
| `+ - * /` | `+`/`-`/confronti richiedono **la stessa valuta**, altrimenti `CurrencyMismatchException` («Valute non compatibili: EUR e USD. Convertire esplicitamente prima dell'operazione.»); `/` per zero lancia `DivideByZeroException("Divisione di un importo per zero.")` |
| `Abs()`, `Sign`, `IsZero/IsPositive/IsNegative` | segno e valore assoluto |
| `Round(int decimals)` | `Math.Round(..., MidpointRounding.AwayFromZero)` |
| `RoundToCurrency()` | arrotonda ai decimali legali (`CurrencyCode.MinorUnits`) |
| `Convert(rate, target)` | richiede `rate > 0` (altrimenti `ArgumentOutOfRangeException`), moltiplica e arrotonda ai decimali legali della valuta di destinazione |
| `Equals`/`==` | valuta senza distinzione di maiuscole **e** importo uguale; `GetHashCode` usa la valuta in maiuscolo |
| `ToString()` | `"<importo> <CODICE>"` invariante (`0.####`), utile per log e file |

**Ripartizione con il metodo del resto maggiore** — `Allocate(ratios, decimals = 2)`. Garanzia: la somma
delle parti è **esattamente** l'importo arrotondato ai decimali richiesti (nessun centesimo perso o creato).

```
se ratios è vuoto            -> ArgumentException("Serve almeno un peso per la ripartizione.")
se somma(ratios) <= 0        -> ArgumentException("La somma dei pesi deve essere positiva.")

working = Round(decimals).Amount          // importo di lavoro, arrotondato
unit    = 10^(-decimals)                  // 0,01 con decimals = 2
per ogni i:  esatto[i] = working * ratio[i] / somma(ratios)
             parte[i]  = floor(esatto[i] / unit) * unit     // troncamento verso il basso
assegnato = somma(parte)
resto     = round((working - assegnato) / unit, 0, AwayFromZero)   // numero di unità da distribuire
ordine    = indici ordinati per (esatto[i] - parte[i]) decrescente, poi per indice
per k = 0 .. resto-1:  parte[ordine[k % n]] += segno(working) * unit
```

Note di fedeltà: il troncamento è sempre verso il basso anche per importi negativi, quindi le unità residue
vengono **sottratte** in valore assoluto per gli importi negativi (`segno(working) = -1`): la somma resta
uguale anche ripartendo un rimborso. Con `resto` maggiore del numero di parti le unità girano ciclicamente
sull'ordine calcolato.

### 8.2 `Decimals` — conversioni scalate

| Funzione | Comportamento |
|---|---|
| `QuantityScale` | `8` (quantità di strumenti: azioni frazionarie e cripto) |
| `ToScaled(value, scale)` | `round(value × 10^scale, 0, AwayFromZero)`; `scale` 0–9, altrimenti `ArgumentOutOfRangeException` |
| `FromScaled(value, scale)` | `value / 10^scale` |
| `QuantityFromScaled` / `QuantityToScaled` | scorciatoie con scala 8 |
| `SafeRatio(num, den)` | `null` se `den == 0`, mai un'eccezione |
| `Clamp(value, min, max)` | limitazione a intervallo |
| `Invariant(value, decimals = 4)` | testo `0.####` con punto decimale, per file e log |

Le potenze sono una tabella `long[10]` (1 … 1.000.000.000): nessuna `Math.Pow` in virgola mobile.

### 8.3 `CurrencyCode` — anagrafica valute

- `Default = "EUR"`.
- `Normalize(code)`: `null`/vuoto → `EUR`; altrimenti `Trim().ToUpperInvariant()` e verifica con regex
  `^[A-Z]{3}$`; se non corrisponde lancia `ArgumentException("Codice valuta non valido: \"XXX\". Atteso un codice ISO 4217 di 3 lettere.")`.
- `MinorUnitsByCode` (33 valute): **2 decimali** per EUR, USD, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON,
  BGN, TRY, CAD, AUD, NZD, BRL, MXN, CNY, HKD, SGD, INR, ZAR, ILS; **0 decimali** per JPY, KRW, ISK, CLP,
  VND; **3 decimali** per KWD, BHD, OMR, TND.
- `MinorUnits(code)`: valore della tabella, **2** per qualunque codice non presente.
- `Symbol(code)`: simbolo della tabella (`€`, `$`, `£`, `¥`, `CHF`, `zł`, `Kč`, `Ft`, `lei`, `лв`, `₺`, `C$`,
  `A$`, `NZ$`, `R$`, `MX$`, `HK$`, `S$`, `₹`, `R`, `₪`, `₩`, `kr`, `CLP`, `₫`, `KD`, `BD`, `OMR`, `DT`),
  altrimenti il codice stesso.
- `DisplayName(code)`: nome italiano per EUR, USD, GBP, CHF, JPY, SEK, NOK, DKK, PLN, CZK, HUF, RON, CAD,
  AUD, CNY, HKD, SGD, INR, BRL, MXN; per le altre restituisce il codice.
- `IsSupported(code)`: presenza nella tabella dei decimali.

### 8.4 `MoneyFormatter` — formati italiani

Cultura fissa `it-IT` (`MoneyFormatter.Italian`).

| Funzione | Esempio |
|---|---|
| `Format(money, decimals?, withSymbol = true)` | `1.234,56 €`; con `withSymbol=false` → `1.234,56 EUR`; valuta non EUR → simbolo della tabella (`1.234,56 $`) |
| `FormatSigned` | antepone `+` solo ai positivi (`+1.234,56 €`, `-12,00 €`) |
| `FormatCompact` | `1,2 Mln €`, `850,0 k €`, `2,5 Mld €`; sotto 1.000 usa il formato normale |
| `FormatPercent(ratio, decimals = 1)` | `12,5 %`; `null` → `n.d.` (mai uno zero inventato) |
| `FormatNumber(value, decimals = 2)` | `1.234,57` |
| `FormatQuantity(q)` | fino a 8 decimali, zeri finali rimossi; interi senza decimali (`12`, `0,00000045`) |
| `FormatDate` / `FormatDateLong` | `03/11/2026` / `3 novembre 2026` |
| `FormatDateRange` | `01/10/2026 – 31/10/2026` (trattino lungo) |
| `FormatDateTime` | `03/11/2026 14:05` (ora locale) |

Il numero di decimali predefinito dipende dalla valuta: 2 per EUR/USD, 0 per JPY, 3 per i dinari del Golfo.

### 8.5 `AmountParser` — lettura di importi digitati

Due modalità (`AmountNotation`):

- `Automatic` (importi di denaro): accetta «1.234,56», «1234.56», «12,5», «1.500», «€ 1.234,56», «-12,50»;
- `DecimalSeparator` (aliquote, percentuali, quantità): un solo separatore ammesso; «1.234.567» è rifiutato.

Procedura: si eliminano tutti i caratteri che non sono cifre, `,`, `.`, `-`, `+`; si legge il segno iniziale;
poi:

| Caso | Interpretazione |
|---|---|
| presenti sia `,` sia `.` | l'ultimo è decimale, l'altro separatore delle migliaia |
| solo `,` | separatore decimale, i `.` sono migliaia |
| solo `.` | se le cifre dopo l'ultimo punto sono 3 o ci sono più punti → migliaia (`1.234` = 1234); altrimenti decimale (`12.5` = 12,5) |
| nessun separatore | intero |

Il testo normalizzato viene letto con `NumberStyles.AllowDecimalPoint` e cultura invariante; il segno viene
riapplicato dopo. `TryParse` restituisce `false` senza eccezioni per testi non interpretabili.
`ToInvariant(value)` produce `0.####` con punto decimale.

### 8.6 `DateRange` e periodi

`DateRange(DateOnly From, DateOnly To)` è un record struct **inclusivo** con: `ForMonth(year, month)`,
`ForYear(year)`, `LastDays(reference, days)`, `LastMonths(reference, months)`, `Days`, `Contains`,
`Overlaps`, `Clamp(bounds)`, `Months()` (anno/mese in sequenza), `MonthCount()` = `round(giorni / 30,4375, 4)`
(per medie e proiezioni), `AddMonths(n)`, `ToString()` `yyyy-MM-dd..yyyy-MM-dd`.

`PeriodGranularity`: `Day`, `Week`, `Month`, `Quarter`, `Year`, `Custom`.
`PeriodPreset` e risoluzione rispetto a «oggi»:

| Preset | Etichetta | Intervallo |
|---|---|---|
| `CurrentMonth` | Mese corrente | mese di oggi |
| `PreviousMonth` | Mese precedente | mese precedente intero |
| `Last3Months` | Ultimi 3 mesi | dal primo giorno di 2 mesi fa a oggi |
| `Last6Months` | Ultimi 6 mesi | analogo, 5 mesi indietro |
| `YearToDate` | Anno in corso | 1° gennaio → oggi |
| `CurrentYear` | Anno corrente | 1° gennaio → 31 dicembre |
| `PreviousYear` | Anno precedente | anno solare precedente |
| `Last12Months` | Ultimi 12 mesi | 11 mesi indietro → oggi |
| `All` | Tutto lo storico | 01/01/1900 → oggi |
| `Custom` | Personalizzato | mese corrente come segnaposto (l'utente imposta le date) |

### 8.7 Chiavi di impostazione (`AppSettingKeys`)

Prefissi stabili: cambiarli richiede una migrazione. Nessun valore segreto è scritto nel codice.

| Gruppo | Chiavi |
|---|---|
| Onboarding | `onboarding.completed`, `onboarding.lastStep` |
| Profilo | `profile.baseCurrency`, `profile.country`, `profile.locale`, `profile.dateFormat`, `profile.fiscalMonthStartDay`, `profile.timeZone`, `profile.experienceMode`, `profile.dataMode`, `profile.userName` |
| Interfaccia | `ui.theme`, `ui.accentColor`, `ui.window.width`, `ui.window.height`, `ui.window.maximized`, `ui.dashboard.activeLayoutId`, `ui.numberFormatCulture`, `ui.showCents`, `ui.startPage`, `ui.sidebar.collapsed` |
| Movimenti | `ui.transactions.columns`, `ui.transactions.pageSize`, `ui.transactions.range`, `ui.transactions.followPeriod`, `ui.transactions.categoryUsage` |
| Sicurezza e backup | `security.autoLockEnabled`, `security.autoLockMinutes`, `security.backupOnExit`, `security.backupFolder`, `security.encryptBackups`, `security.lastBackupAtUtc` |
| Portafoglio | `portfolio.costBasisMethod`, `portfolio.includeFeesInCostBasis`, `portfolio.stalePriceDays`, `portfolio.defaultBenchmark` |
| Fisco | `fiscal.generalRate`, `fiscal.governmentBondRate`, `fiscal.lossCarryForwardYears`, `fiscal.stampDutyRate` |
| Budget e categorie | `budget.defaultAlertThreshold`, `budget.defaultRolloverMode`, `categories.maxDepth` |
| Assistente IA | `ai.enabled`, `ai.provider`, `ai.model`, `ai.baseUrl`, `ai.remoteProcessingConsent`, `ai.consentDateUtc`, `ai.sendAggregatedOnly`, `ai.apiKey` (segreto) |
| Banche | `integration.gocardless.secretId`, `integration.gocardless.secretKey`, `integration.plaid.clientId`, `integration.plaid.secret`, `integration.enablebanking.applicationId`, `integration.enablebanking.privateKey` (segreti), `integration.enablebanking.redirectUri`, `integration.enablebanking.consentDays`, `integration.enablebanking.psuType` |
| Privacy e sistema | `privacy.telemetryEnabled`, `privacy.lastDataExportAtUtc`, `system.schemaVersion`, `system.installId`, `system.firstRunAtUtc`, `system.lastOpenedAtUtc` |

`SecretKeys` (ciò che viene **sempre** cifrato con DPAPI e mai esportato): `integration.gocardless.secretId`,
`integration.gocardless.secretKey`, `integration.plaid.clientId`, `integration.plaid.secret`,
`integration.enablebanking.applicationId`, `integration.enablebanking.privateKey`,
`integration.marketdata.apiKey`, `ai.apiKey`.---

## 9. Regole contabili e motori di calcolo

Tutti i motori sono classi pure che ricevono un `LedgerSnapshot` (fotografia di conti, categorie, movimenti,
investimenti, prezzi, tassi, budget) e un convertitore di valuta; non toccano il database e non conoscono WPF.

### 9.1 Classificazione dei movimenti (`AccountingClassifier`)

Ordine di priorità, verificabile nel codice:

1. `transaction.IsInternalTransfer` (transfer group o conto controparte) → **trasferimento**;
2. categoria di natura `Transfer` → **trasferimento**;
3. movimento collegato a una passività con `InterestMinor` valorizzato → **interessi del debito** se
   `InterestMinor > 0`, altrimenti **quota capitale**;
4. categoria `Investment` **o** `InvestmentTransactionId` valorizzato → **acquisto** (uscita) o **vendita**
   (entrata) di investimento;
5. nessuna categoria → **senza categoria** (entra nei totali ma è segnalato «da classificare»);
6. natura della categoria: `Income` → entrata (o **rimborso** se è un'uscita); `Fee`/`Tax`/`Debt` → costo
   finanziario (o rimborso se entrata); `Expense` → spesa (o rimborso); `Other` → spesa se uscita, entrata se
   entrata.

`FlowClassification` porta: classe (`Income`, `Expense`, `FinancialCost`, `DebtInterest`, `DebtPrincipal`,
`Refund`, `InvestmentBuy`, `InvestmentSell`, `InternalTransfer`, `Unclassified`), `NeedsClassification`,
`IsFinancialCost`.

**Ripartizione di una rata** (`SplitInstallment(liability, payment)`):

```
periodi   = InstallmentsPerYear <= 0 ? 12 : InstallmentsPerYear
interessi = round(capitale_residuo / 10^4 × AnnualInterestRate / periodi, 2, away-from-zero)
se interessi > |rata| → interessi = |rata|
capitale  = max(0, |rata| − interessi)
```

È una stima deterministica dichiarata tale: non sostituisce il piano di ammortamento della banca.

### 9.2 Flussi di cassa (`CashFlowEngine`)

`Compute(snapshot, range, targetCurrency, options)` con `CashFlowOptions`: `IncludeDraft`,
`IncludeUnclassified` (default true), `AccountIds`/`ExcludedAccountIds`, `SplitInvestmentsSeparately`.

Un movimento **suddiviso** viene espanso: ogni quota è classificata con la propria categoria e convertita
con il cambio del movimento (`ExpandSplits`); la quota capitale/interessi viene azzerata nelle copie per non
contarla più volte.

Significato dei campi di `CashFlowSummary`:

| Campo | Contenuto |
|---|---|
| `Income` | entrate reali |
| `Expenses` | spese di consumo (senza commissioni, imposte, interessi) |
| `FinancialCosts` | commissioni, imposte, altri costi finanziari |
| `TotalOutflows` | `Expenses + FinancialCosts` |
| `NetSavings` | `Income − TotalOutflows` |
| `Refunds` | rimborsi (riducono le spese, mai contati come entrata) |
| `InvestmentContributions` / `InvestmentWithdrawals` | versamenti e prelievi da investimenti |
| `DividendsAndInterest` | dividendi e cedole con movimento di cassa |
| `DebtPrincipal` | quota capitale delle rate |
| `InternalTransferVolume` | volume dei trasferimenti, contato **una sola volta** (solo la gamba in uscita) |
| `UnclassifiedExpenses` / `UnclassifiedIncome` | importi senza categoria |
| `SavingsRate` | `NetSavings / Income`, `null` se entrate ≤ 0 |
| `ExpenseRatio`, `InvestmentRate` | `TotalOutflows / Income`, `InvestmentContributions / Income` |
| `ByMonth` | `MonthlyFlow` per anno/mese con entrate, spese, risparmio, investimenti, trasferimenti e `SavingsRate` |
| `HasMissingRates` | true se qualche importo non è stato convertito |
| `AverageMonthlyIncome/Expenses` | totale diviso `round(MonthCount)` (minimo 1) |

Tasso di conversione mancante: l'importo viene **escluso** e `HasMissingRates` diventa vero (non si inventa
un cambio). I dividendi registrati solo nel modulo investimenti (senza movimento di cassa) vengono aggiunti a
`Income` e `DividendsAndInterest`, saltando quelli con `LinkedTransactionId` (già contati).

### 9.3 Saldi (`AccountBalanceCalculator`)

```
saldo(conto, data) = (OpeningBalanceDate <= data ? OpeningBalanceMinor : 0)
                   + Σ AmountMinor dei movimenti con Date <= data,
                     Status != Cancelled e (includeDraft oppure Status != Draft)
```

Nessun saldo è memorizzato. `BalancesOfAll` fa la stessa cosa in un'unica passata raggruppata per conto;
`Snapshot` restituisce `AccountBalance` (saldo, saldo convertito o `null` con `HasMissingRates`, numero di
movimenti) per i conti non archiviati ordinati per `SortOrder` e nome.

### 9.4 Budget (`BudgetEngine`)

Periodo corrente (`ResolvePeriod`): `Weekly` (blocchi di 7 giorni ancorati a `StartDate`), `Monthly`
(mese di calendario), `Quarterly` (trimestre di calendario), `Annual` (anno solare), `Custom` (cicli di un mese
da `StartDate`, limitati da `EndDate`).

```
elapsedRatio = clamp(giorni trascorsi nel periodo / giorni totali, 0, 1)
rolloverIn   = RolloverMode == None ? 0 : riporto calcolato ricorsivamente dai periodi precedenti
limit        = LimitOverrideMinor del periodo, altrimenti TotalLimitMinor, altrimenti Σ LimitMinor delle categorie
effective    = limit + rolloverIn
spent        = Σ consumo del periodo nel perimetro (spese, costi finanziari, interessi, senza categoria, rimborsi)
remaining    = effective − spent
usedPercent  = effective <= 0 ? null : spent / effective
projected    = elapsedRatio <= 0 ? spent : round(spent / elapsedRatio)
dailyAllowance = remaining <= 0 ? 0 : round(remaining / giorni rimanenti)
alert        = usedPercent × 100 >= AlertThresholdPercent
```

Riporto (`ComputeRollover`): si parte da `StartDate` e si accumula periodo per periodo (tetto di 120 cicli):
`carried = carried + limit − spent`, poi `Full` → tutto il residuo, `PositiveOnly` → `max(0, residuo)`, `None` → 0.

Perimetro (`ResolveScope`/`InScope`): budget `IsGlobal` → tutto; altrimenti solo le categorie con un'allocazione
e, se `IncludeSubcategories`, i loro discendenti (risalita del padre con tetto di 32 livelli). Le quote di un
movimento suddiviso sono ripartite in proporzione all'importo del movimento **convertito** (così una spesa in
valuta estera non entra non convertita).

**Asimmetria dichiarata**: il riporto (`SpentIn`) somma le quote delle suddivisioni **senza conversione**
(`−split.AmountMinor`) mentre il totale del periodo converte l'importo: con movimenti suddivisi in valuta
diversa dalla valuta di riferimento il riporto e il consumo corrente possono divergere. Chi riscrive deve
riprodurre il comportamento o correggerlo consapevolmente.

`BudgetCategoryStatus` per ogni allocazione: limite, speso (con discendenti), residuo, percentuale usata
(`null` se limite ≤ 0), spesa proiettata, `WillExceed`, `IsUnclassified` (allocazione senza categoria).

### 9.5 Patrimonio netto (`NetWorthEngine`)

Componenti: 1) saldi dei conti non archiviati (attività, o passività se `Nature = Liability` o saldo negativo);
2) posizioni di portafoglio valorizzate a mercato (se manca il prezzo → **valore al costo**, `IsEstimate = true`);
3) attività dichiarate (`Assets`); 4) passività (`Liabilities` con residuo > 0).

**Esclusione dei conti broker.** Dopo aver calcolato il portafoglio, i saldi dei conti che compaiono in almeno
una posizione vengono rimossi dai componenti per evitare il doppio conteggio (il conto broker contiene la
liquidità, il portafoglio il valore dei titoli); il fatto viene annotato in `DataQualityNotes`.

Totali: `TotalAssets`, `TotalLiabilities`, `NetWorth = Assets − Liabilities`, `LiquidAssets`,
`InvestedAssets`, `OtherAssets`; rapporti `InvestedRatio`, `LiquidityRatio`, `DebtRatio` (`null` se attività
nulla); indicatori di qualità `HasMissingRates`, `HasEstimates`, `HasStalePrices`. La storia mensile produce
`NetWorthHistoryPoint`.

### 9.6 Portafoglio (`PortfolioEngine`)

Operazioni considerate: `TradeDate <= asOf`, ordinate per data e `CreatedAtUtc`, raggruppate per
`(AccountId, SecurityId)`.

| Tipo operazione | Effetto |
|---|---|
| `Buy`, `TransferIn` | nuovo lotto con costo unitario `lordo/quantità` (+ commissioni se `IncludeFeesInCostBasis`); aumenta quantità e costo di carico |
| `Sell`, `TransferOut` | smobilizzo secondo `Method`; plusvalenza = `proventi − costo_smobilizzato − commissioni − imposte`; genera `RealizedOperation` |
| `Split` | moltiplica le quantità e divide il costo unitario per il fattore, costo complessivo invariato |
| `Dividend`, `Coupon`, `Interest` | somma ai dividendi |
| `Fee` | commissione: nei costi realizzati e nel costo di carico |
| `Tax` | imposta realizzata |
| `Deposit`, `Withdrawal` | nessun effetto sulla posizione |

Metodi di smobilizzo: **FIFO** (dal lotto più vecchio), **LIFO** (dal più recente), **media ponderata**
(costo unitario medio applicato alla quantità ceduta, lotti ridotti in proporzione).
Prezzo: l'ultimo `MarketPrice` con `Date <= asOf` (a parità di data preferisce `Manual`); se la valuta del
prezzo è diversa da quella dello strumento viene convertita; se manca il prezzo `MarketValue` è `null`, la
posizione viene valorizzata al costo e il totale di mercato è dichiarato incompleto. Prezzo «vecchio» se più
vecchio di `StalePriceDays` (default 7) → `IsPriceStale`, `PriceAgeDays`.

Riepilogo: `TotalMarketValue`, `TotalCostBasis`, `UnrealizedPnl`, `RealizedPnl`, `Dividends`, `Fees`, `Taxes`,
`UnrealizedPercent` (`null` se costo 0), allocazioni per tipo, strumento, settore, area, valuta, conto,
`LargestPositionShare`, `CostOfMissingPrices`, `Warnings` (testo italiano, una riga per strumento).

### 9.7 Performance (`PerformanceCalculator`)

| Metodo | Implementazione |
|---|---|
| **XIRR** | bisezione su `[−0,9999, 10]` (estesa ×10 fino a 20 volte se il segno non cambia), NPV = `Σ flusso / (1+r)^(giorni/365)`, massimo 200 iterazioni, risultato arrotondato a 6 decimali; `null` se meno di due flussi, se non ci sono sia entrate sia uscite o se l'arco è nullo |
| **TWR** | sotto-periodi delimitati dai flussi esterni; rendimento del periodo = `valore_finale / (valore_iniziale + flusso) − 1` (flusso all'inizio del periodo); concatenamento geometrico `Π(1+rᵢ) − 1`; annualizzazione actual/365 |
| **Dietz modificato** | `(fine − inizio − flusso_netto) / (inizio + Σ flussoᵢ × giorni_pesati/giorni_totali)`; `null` se giorni ≤ 0 o inizio ≤ 0 |
| **CAGR** | `(fine/inizio)^(1/anni) − 1`; `null` se inizio ≤ 0, anni ≤ 0 o fine < 0 |
| **Volatilità annualizzata** | deviazione standard campionaria dei rendimenti periodici × `√periodi_per_anno`; `null` con meno di 2 osservazioni |
| **Drawdown massimo** | massimo `(valore − picco)/picco` sulla serie, con date di picco e minimo |

Ogni risultato è `PerformanceResult` con metodo, rendimento totale, annualizzato, giorni, motivo di
indisponibilità (`NotAvailableReason`) e note: quando i dati non bastano il campo è nullo e la ragione è
scritta, mai un numero inventato.

### 9.8 Stima fiscale italiana (`FiscalItalyEstimator`)

Lavora su plusvalenze realizzate e dividendi, con aliquote lette dalle impostazioni
(`fiscal.generalRate` 0,26, `fiscal.governmentBondRate` 0,125, `fiscal.lossCarryForwardYears` 4,
`fiscal.stampDutyRate` 0,002). Distingue titoli di Stato e assimilati (`IsGovernmentBond`) dalle altre
posizioni, compensa le minusvalenze realizzate con le plusvalenze dello stesso gruppo entro l'anno e riporta
le minusvalenze residue per gli anni successivi, calcola l'imposta di bollo annuale sul valore del portafoglio.
Il risultato è una **stima dichiarata** con le ipotesi elencate (non tiene conto di ogni caso particolare,
non sostituisce un consulente).

### 9.9 Obiettivi (`GoalEngine`)

`EvaluateAll` considera gli obiettivi non archiviati, ordinati per `Priority` e poi `SortOrder`. Per ognuno:

| Passo | Regola esatta |
|---|---|
| Obiettivo | `TargetAmount` convertito ai tassi più recenti; se la valuta differisce si aggiunge la nota «Obiettivo in XXX: convertito con il tasso più recente disponibile.» |
| Quota accumulata | 1) `ManualCurrentAmountMinor` se presente → nota «Quota accumulata inserita manualmente: non è verificata dai movimenti.»; 2) altrimenti saldo del conto collegato (`AccountBalanceCalculator.BalanceOf`) → nota «Quota derivata dal saldo del conto «N».»; 3) altrimenti somma dei valori assoluti dei movimenti della categoria collegata → nota «Quota derivata dai movimenti classificati nella categoria collegata.»; 4) altrimenti somma dei valori assoluti dei movimenti con tag `ContributionTag` → nota «Quota derivata dai movimenti con tag «T».»; 5) nessuna fonte → zero e nota «Nessuna fonte collegata: la quota accumulata risulta zero finché non ne indichi una.» |
| Avanzamento | `progress = clamp(current / target, 0, 1)`, `0` se obiettivo ≤ 0; `remaining = target − current` (mai negativo nel risultato) |
| Versamento pianificato | convertito se in altra valuta; se > 0 e `remaining > 0`: `mesi = ceil(remaining / mensile)` e `completamento = oggi.AddMonths(mesi)` |
| Versamento necessario | solo con `TargetDate`: `mesi = max(1, (anno−anno_oggi)×12 + mese−mese_oggi)`; `necessario = round(remaining / mesi, decimali valuta)` |
| In linea | `completamento ≤ TargetDate` se esiste una proiezione; se manca il versamento pianificato ma la quota è derivata, si usa il versamento medio degli ultimi **6 mesi** (somma dei valori assoluti / 6) e si aggiunge la nota «Proiezione basata sul versamento medio degli ultimi 6 mesi (importo).»; nessun versamento recente → nota «Nessun versamento recente rilevato: la proiezione non è calcolabile.»; nessuna delle due → nota «Indica un versamento mensile pianificato per ottenere la proiezione di completamento.» |
| Raggiunto | `remaining <= 0`; `IsDerivedFromData` distingue la quota calcolata da quella manuale |

Il fondo emergenze non ha una formula separata nel motore: `EmergencyFundMonths` è il dato con cui la UI
confronta la quota con la copertura in mesi; il motore espone comunque `Current`, `Target` e `Progress`.

### 9.10 Ricorrenze (`RecurrenceEngine`)

**Occorrenze per anno** (`OccurrencesPerYear`), poi divise per `max(1, Interval)`:

| Frequenza | Occorrenze/anno |
|---|---|
| `Daily` | 365 |
| `Weekly` | 52 |
| `Biweekly` | 26 |
| `Monthly` | 12 |
| `Bimonthly` | 6 |
| `Quarterly` | 4 |
| `Semiannual` | 2 |
| `Annual` | 1 |
| `Custom` | `365 / max(1, CustomIntervalDays ?? 30)` |
| default | 12 |

`MonthlyEquivalent` = `importo × occorrenze/anno / 12` arrotondato ai decimali della valuta;
`YearlyEquivalent` = `importo × occorrenze/anno`. `Advance` aggiunge giorni (7/14 per settimanale/quindicinale,
`max(1, CustomIntervalDays ?? 30)` per `Custom`) oppure mesi tramite `AddMonthsClamped`, che applica
`DayOfMonth` se presente (altrimenti il giorno corrente) e lo limita a `1..giorni_del_mese`, così il 31 diventa
il 28/29/30 nei mesi corti e non slitta. `Within` richiede `StartDate <= data <= EndDate` e
`OccurrencesCount < MaxOccurrences` (se presenti).

| Funzione | Dettagli |
|---|---|
| `NextOccurrence(from, includeToday)` | parte da `NextDueDate`; con `includeToday = false` avanza subito se coincide con `from`; se è precedente avanza fino a raggiungere `from` con un tetto di **5.000** avanzamenti; restituisce `null` se la data esce dal periodo dell'occorrenza |
| `Occurrences(range)` | avanza fino all'inizio dell'intervallo (tetto **10.000**) e poi enumera fino alla fine (tetto complessivo **20.000**), fermandosi quando supera `MaxOccurrences` |
| `BuildOverview(view, today, upcomingDays = 45, includePaused = false)` | prossime scadenze entro **45 giorni** (solo attive salvo `includePaused`), totali mensili/annuali di abbonamenti (`IsSubscription`), spese (`ExpectedAmountMinor < 0`) e entrate (`> 0`), aumenti, possibili disdette, candidati duplicati |

**Totali per valuta.** `SumCostByCurrency` somma solo gli importi della valuta più diffusa fra le ricorrenze,
normalizzando il segno (un costo si mostra positivo); le altre valute restano visibili nel dettaglio. Non c'è
conversione automatica in questo motore.

**Aumenti di prezzo** (`DetectPriceChanges`): per ogni ricorrenza attiva o in pausa si guardano i movimenti
dello stesso conto con data entro **400 giorni**, si prendono i **due più recenti con importo diverso** e si
segnala l'aumento solo se `nuovo > precedente × 1,02` (soglia **+2%**).

**Corrispondenza movimento ↔ ricorrenza** (`MatchesRecurrence`), nell'ordine: se entrambi hanno esercente e
uno non contiene l'altro → non corrisponde; se la categoria coincide → corrisponde; se
`||importo| − |previsto|| <= max(50 unità minori, 10% del previsto)` → corrisponde (50 unità minori = 0,005 €,
quindi in pratica conta il 10%); altrimenti la descrizione deve contenere il nome della ricorrenza, che deve
essere più lungo di 3 caratteri. Il confronto è su testo normalizzato (minuscolo, `Trim`).

**Possibili disdette** (`DetectDiscontinued`): solo ricorrenze attive; `ciclo = round(365 / occorrenze/anno)`
con minimo 0,1; finestra di ricerca `max(45, 2 × ciclo)` giorni; se non c'è alcun movimento corrispondente e la
ricorrenza è iniziata prima dell'inizio della finestra, viene segnalata.

**Ricorrenze duplicate** (`DetectDuplicateRecurrences`): stesso conto e stessa frequenza **e**
(`stesso importo` e `stesso nome`) oppure (`stesso esercente` e `stesso importo`); viene segnalata la seconda.
Il motore non crea, non modifica e non cancella movimenti.

### 9.11 Previsioni (`ForecastEngine`)

**Liquidità** (`ForecastLiquidity`): conti inclusi = non archiviati, `Nature = Asset`, `IncludeInLiquidity`,
opzionalmente filtrati; saldo di partenza = somma dei saldi convertiti (un cambio mancante esclude il conto e
imposta `HasMissingRates`). Spesa variabile = uscite non collegate a ricorrenze attive e classificate come
`Expense`/`FinancialCost`/`Unclassified` negli ultimi `variableSpendLookbackMonths` mesi (**default 3**, minimo 1);
`spesa_giornaliera = totale / giorni_della_finestra`. Per ogni giorno da oggi all'orizzonte:

```
netto_ricorrenze = Σ importi previsti delle ricorrenze attive con occorrenza in quel giorno (convertiti)
saldo          += netto_ricorrenze − spesa_giornaliera        (il giorno di oggi non ha spesa variabile)
banda_inferiore += netto_ricorrenze − spesa_giornaliera × 1,35
banda_superiore += netto_ricorrenze − spesa_giornaliera × 0,70
```

Risultato: saldo finale, saldo minimo e sua data, giorni con saldo negativo, punti giornalieri, ipotesi
(saldo di partenza, conti inclusi, spesa variabile media, numero di ricorrenze attive, orizzonte) e quattro
limitazioni dichiarate: la spesa variabile è una media storica (le spese straordinarie non sono previste); la
banda rappresenta solo la sensibilità alla spesa variabile (da −30% a +35%) e **non** è un intervallo di
confidenza; le ricorrenze usano gli importi registrati; non sono considerati interessi attivi, rivalutazioni,
vendite di investimenti o entrate non ricorrenti.

**Scenari** (`ScenarioOutcome`, avvertenza costante):

> «Simulazione basata su ipotesi inserite dall'utente. Non è una previsione, non è una garanzia e non
> costituisce una raccomandazione di investimento. I rendimenti passati non sono indicativi di quelli futuri.»

- `SimulateAccumulation(valore iniziale, versamento mensile, anni, rendimento nominale, inflazione, costi)`: anni
  limitati a **1–60**; per ogni anno si aggiungono 12 versamenti, si sottraggono i costi (`nominale × costo annuo`)
  e si applica il rendimento; il valore reale è `nominale / Π(1 + inflazione)`; righe annuali con valore
  nominale, versamenti cumulati, valore reale e costi cumulati. Limitazioni dichiarate: il rendimento è
  un'ipotesi, non sono modellate imposte, commissioni di negoziazione, spread e differenze di valuta, l'inflazione
  è a sua volta una stima.
- `SimulateOneOffExpense(baseline, data, importo, orizzonte)`: sottrae la spesa dal saldo finale e dal saldo
  minimo se la data cade nell'orizzonte; dichiara che il calendario delle ricorrenze non viene ricalcolato.
- `SimulateMonthlyChange(titolo, valore iniziale, variazione mensile, anni, rendimento, withReturn)`: accumulo
  annuo `(saldo + variazione × 12) × (1 + rendimento)`; con `withReturn = false` il rendimento è zero e
  l'accumulo è puramente aritmetico.

### 9.12 Analisi (`AnomalyDetector`, `DuplicateDetector`, `RuleEngine`, `ReconciliationAdvisor`)

**Anomalie** (`AnomalyDetector.Options`): `LookbackMonths = 6`, `RelativeThreshold = 0,5` (+50%),
`RobustScoreThreshold = 3,5`, `MinimumRelevantAmount = 25` (unità di valuta).

- *Picchi per categoria*: si confrontano i mesi completi precedenti (almeno **2** mesi di storia); per ogni
  categoria si calcola mediana e MAD; `robustScore = (attuale − mediana) / (1,4826 × MAD)` (se MAD = 0 → 99 per
  uno scostamento positivo, 0 altrimenti). Si segnala solo se scostamento ≥ 50%, differenza assoluta ≥ 25 e
  `robustScore ≥ 3,5`. Testo: «Spesa superiore alla mediana degli ultimi 6 mesi del X%.»
- *Movimenti insoliti*: raggruppati per categoria negli ultimi 6 mesi, minimo **5** movimenti, soglia
  `mediana + 1,4826 × MAD × 3,5`; si segnala se l'importo supera la soglia **e** la differenza dalla mediana è
  almeno 25. Testo: ««descrizione» è N,N scarti robusti sopra la mediana della categoria.» Massimo **50**
  risultati, ordinati per punteggio.

**Duplicati** (`DuplicateDetector`):

- `DedupeHash` = SHA-256 (esadecimale **maiuscolo**) del testo
  `accountId(N) | data(yyyy-MM-dd) | importoInUnitàMinori | descrizione normalizzata | esercente normalizzato`,
  separatore `|`; la normalizzazione toglie accenti, punteggiatura, spazi multipli e porta in minuscolo.
- Ricerca con `similarityThreshold = 0,85` e `windowDays = 5`: (1) stesso `ExternalId` nello stesso conto →
  `SameExternalId`, duplicato **certo**; (2) stesso conto, stessa data (±5 giorni), stesso importo e somiglianza
  ≥ 0,999 → `ExactMatch`; (3) come sopra con somiglianza ≥ 0,85 → `SimilarDescription`; (4) conti diversi, data
  entro **1 giorno** e somiglianza ≥ 0,85 → `CrossAccount`.
- Somiglianza = Jaccard sui token (parole di più di 1 carattere), normalizzati; due testi vuoti danno 1.
- Ogni candidato porta spiegazione e azione raccomandata; nulla viene eliminato automaticamente.

**Regole** (`RuleEngine`): regole abilitate in ordine di `Priority`; `MatchAll` = tutte le condizioni, altrimenti
ne basta una; una regola senza condizioni non corrisponde mai. Vince il primo valore non nullo
(`categoria ??= …`), i tag si uniscono e si deduplicano senza distinzione di maiuscole, le note si concatenano
con « · », `StopProcessing` interrompe la catena. Condizioni: testo (`Contains`, `NotContains`, `Equals`,
`StartsWith`, `EndsWith`, `Regex`, `IsEmpty`, `IsNotEmpty`) con confronto sensibile o meno alle maiuscole;
importi su valore assoluto (`Equals`, `GreaterThan`, `LessThan`, `Between`), letti prima in `it-IT` poi
invariante; `AccountId`/`CategoryId` come GUID; `TransactionSource` come nome dell'enum. La regex è rifiutata
oltre **200 caratteri** e ha timeout di **150 ms** (nessuna espressione patologica blocca l'app).

*Suggerimento di categoria* (`SuggestCategory`), in ordine di affidabilità: regola → confidenza **0,95** con
«Corrisponde alla regola «N».»; storico dell'esercente (chiave normalizzata di almeno 4 caratteri, solo
movimenti confermati) → confidenza `min(0,9; 0,5 + 0,1 × numero di volte)` con ««X» è stato classificato così
N volte.»; parola chiave → confidenza **0,6** con «La descrizione contiene «parola».». L'elenco di parole chiave
è esplicito (`KeywordMap`): supermercati, ristoranti, bar, consegne, carburante, trasporto pubblico, taxi,
pedaggi, parcheggi, utenze, telefonia e internet, farmacia e salute, palestra, abbigliamento, cura personale,
hardware e software, servizi digitali, streaming e musica, cloud, domini e hosting, viaggi e vacanze,
videogiochi, cinema ed eventi, assicurazioni, commissioni bancarie, imposte e bollo, contributi, stipendio,
interessi e dividendi, trasferimenti verso risparmio, mutuo e rate, affitto e condominio, regali e donazioni.
Nessun modello opaco: il suggerimento non modifica il movimento.

**Riconciliazione** (`ReconciliationAdvisor`): tolleranza predefinita **0,05** (5 centesimi). Se la valuta del
saldo dichiarato non è quella del conto l'analisi si rifiuta con «Il saldo dichiarato è in XXX mentre il conto
«N» è in YYY: indicare il saldo nella valuta del conto.». Differenza = calcolato − dichiarato, sempre esposta.

Ordine delle proposte (l'ultima è sempre la rettifica):

1. saldo già allineato → «Saldo allineato» (resta comunque il controllo dei trasferimenti incompleti);
2. movimenti provvisori entro la data dell'estratto conto, con effetto complessivo e residuo dopo la conferma
   («Conferma N movimenti provvisori»);
3. movimento registrato **dopo** la data dell'estratto conto il cui spostamento azzererebbe la differenza
   («Data da verificare: …», uno solo);
4. trasferimenti interni senza la gamba di controparte (informativo: manca all'altro conto);
5. possibili duplicati (stessa data e importo, almeno 2 movimenti) con residuo dopo la rimozione;
6. saldo iniziale dichiarato come stima, con il valore che renderebbe coerente il saldo;
7. differenza entro la tolleranza → «Differenza minima» (probabili arrotondamenti);
8. **rettifica**: «Registra un movimento di ±X» — movimento reale, visibile nei report, mai correzione nascosta.

Ogni voce dichiara `EffectOnComputed` e `ExplainsDifference` (vero solo se applicarla azzera la differenza);
`ResidualAfter(finding)` è il numero mostrato prima di applicare. Nulla viene applicato senza conferma.

### 9.13 IRPEF (`IrpefCalculator`)

Scaglioni per anno di imposta (aliquote marginali crescenti, calcolo progressivo):

| Anno | Scaglioni |
|---|---|
| 2023 | 23% fino a 15.000 €, 25% fino a 28.000 €, 35% fino a 50.000 €, 43% oltre |
| 2024–2025 | 23% fino a 28.000 €, 35% fino a 50.000 €, 43% oltre |
| 2026 | 23% fino a 28.000 €, 33% fino a 50.000 €, 43% oltre |

Dettagli verificati: `SupportedYears` = `[2026, 2025, 2024, 2023]`; `GetRules(anno)` restituisce `null` per
un anno non coperto, `GrossTax(imponibile, anno)` restituisce `null` (non zero) e `Compute(...)` restituisce
`null`: **non vengono mai applicate aliquote non verificate**. Il calcolo azzera un imponibile negativo, applica
gli scaglioni in ordine, arrotonda ogni quota a **2 decimali** (away-from-zero), somma le bande e calcola
`netto = max(0, lordo − detrazioni)` (detrazioni negative azzerate). `IrpefResult` espone `Year`,
`TaxableIncome`, `GrossTax`, `Bands` (`From`, `To`, `Rate`, `Tax`), `Deductions`, `NetTax` e tre note: fonte
degli scaglioni (Agenzia delle Entrate), detrazioni da inserire esplicitamente, addizionali regionali e comunali
escluse. Non esistono quindi aliquota media o marginale come campi: si ricavano dal rapporto fra `GrossTax` e
`TaxableIncome` e dall'aliquota dell'ultima banda.---

## 10. Servizi applicativi

Ogni servizio riceve `IDbContextFactory<FinanceOsDbContext>` e crea un contesto per operazione. Le operazioni
modificanti scrivono nel registro di audit tramite `AuditService` (automatico o esplicito). Nessun servizio
formatta testo per la UI: restituisce dati.

### 10.1 `TransactionService`

| Operazione | Comportamento |
|---|---|
| ricerca filtrabile | periodo, conti, categorie (con discendenti), testo su descrizione/esercente/note, importo minimo/massimo, stato, tipo (entrate, uscite, trasferimenti, senza categoria), tag, origine; ordinamento per data/importo e paginazione |
| lettura singola | movimento con suddivisioni e allegati |
| salvataggio | validazione (sezione 10.2), aggiornamento `UpdatedAtUtc`, audit |
| eliminazione | rimuove il movimento e, se è una gamba di trasferimento, l'intero gruppo con conferma esplicita della UI |
| duplicazione | copia con nuova `Id`, data odierna e `DedupeHash` ricalcolato |
| trasferimento | crea **due** movimenti collegati da `TransferGroupId`, con `CounterpartyAccountId` incrociati, importi opposti e stessa data; consente valute diverse registrando gli importi nelle rispettive valute |
| modifica multipla | applica categoria, tag, stato, nota o conto a un insieme di movimenti, saltando quelli non compatibili (es. trasferimenti per la categoria) |
| applicazione regole | esegue le regole attive sui movimenti selezionati o su tutti, con riepilogo di quante modifiche |
| suggerimento categoria | usa `RuleEngine` e lo storico esercente per proporre una categoria, senza applicarla |
| totali | entrate, uscite, saldo netto del filtro corrente |

### 10.2 Validazioni dei movimenti (vincolanti)

1. importo diverso da zero; valuta valida;
2. descrizione obbligatoria (max 500);
3. conto esistente e non archiviato;
4. se `HasSplits`: almeno due quote, stessa valuta del movimento, somma esattamente uguale all'importo,
   categorie esistenti e non archiviate;
5. trasferimento: conto controparte obbligatorio, diverso dal conto di origine, importo non nullo;
6. rata: `PrincipalMinor + InterestMinor` coerente con l'importo quando entrambi presenti;
7. `ExternalId` unico per conto (violazione dell'indice → messaggio comprensibile, non eccezione grezza);
8. data non nel futuro oltre il consentito dalla UI (avviso, non blocco);
9. tag normalizzati (minuscolo, senza duplicati).

### 10.3 `AccountService`

Elenco con saldo calcolato, creazione, modifica, archiviazione (mai eliminazione se ci sono movimenti),
riordino (`SortOrder`), saldo a una data, riconciliazione (`BalanceReconciliations`), conti collegati a
integrazioni, totali per natura (attività/passività) e per liquidità. Un conto con `IsInternal` è escluso dai
prospetti di consumo.

### 10.4 `CategoryService`

Albero completo con percorsi («Casa › Utenze › Luce»), creazione (stessa natura del padre), rinomina,
spostamento (con controllo dei cicli), archiviazione, eliminazione consentita solo senza movimenti, senza
figli e con `IsDeletable = true`, ripristino delle categorie predefinite mancanti (per `Slug`), conteggio dei
movimenti per categoria, ricerca.

### 10.5 `PlanningService`

Contiene quattro servizi:

- `BudgetService`: CRUD budget e allocazioni, periodi (`BudgetPeriods`), override del limite, chiusura del
  periodo, stato calcolato con `BudgetEngine`;
- `RecurringService`: CRUD ricorrenze, conferma dell'occorrenza (crea il movimento o la bozza, incrementa
  `OccurrencesCount`, sposta `NextDueDate`), salto dell'occorrenza, pausa/ripresa, registrazione degli aumenti;
- `SavingsGoalService`: CRUD obiettivi, versamenti, stato con `GoalEngine`;
- `BalanceSheetService`: attività, passività e patrimonio con `NetWorthEngine`.

### 10.6 `PortfolioDataService`

CRUD strumenti, operazioni, prezzi e dividendi; import di prezzi da CSV; ricalcolo e salvataggio di
`PortfolioPositions` (cache); riepilogo con `PortfolioEngine`; performance con `PerformanceCalculator`;
stima fiscale con `FiscalItalyEstimator`; serie storiche per i grafici. Il ricalcolo delle posizioni non è
mai necessario alla correttezza: le posizioni sono ricostruibili dalle operazioni.

### 10.7 `ReconciliationService`

Registra l'estratto conto (`StatementDate`, saldo dichiarato, saldo calcolato), calcola la differenza, propone
le cause probabili (`ReconciliationAdvisor`), crea rettifiche esplicite e chiude la riconciliazione. Una
differenza non viene mai assorbita in silenzio.

### 10.8 `DashboardLayoutService`

CRUD dei layout e dei widget, impostazione del layout predefinito, duplicazione, riordino, visibilità,
ridimensionamento; `Pack(widgets)` impacchetta i widget sulla griglia a 12 colonne riempiendo le righe in
ordine di `SortOrder`, assegnando `Row`/`Column` coerenti e conservando le larghezze. I 6 preset iniziali sono
creati dal seed.

### 10.9 `SettingsService`

`Get/Set/GetBool/GetInt/GetDecimal` con cache in memoria per contesto; i valori con chiave in
`AppSettingKeys.SecretKeys` vengono cifrati con `ISecretProtector` e marcati `IsSecret = true`,
`IsEncrypted = true`. Un valore segreto non decifrabile viene restituito come assente (mai un errore bloccante).

### 10.10 `AuditService` e `NotificationService`

`AuditService.WriteAsync(action, category, summary, entityType?, entityId?, detailsJson?)` inserisce una voce
con versione applicativa e data UTC. `NotificationService` crea notifiche locali con `DedupeKey` per non
ripetere lo stesso avviso, le elenca per lettura/data, le marca lette e le elimina; le notifiche non escono dal
computer.

### 10.11 `DemoDataService`

Crea un dataset dimostrativo sintetico (conti, categorie esistenti, movimenti su dodici mesi, budget,
ricorrenze, obblighi) marcato con `Source = Demo` e nomi riconoscibili; `ClearDemoData` elimina **solo** i dati
così marcati. Non tocca mai dati reali e non richiede connessione.

### 10.12 `LedgerService` e `LedgerLoader`

`LedgerLoader` carica in un'unica passata conti, categorie, movimenti (con suddivisioni), ricorrenze, budget,
investimenti, prezzi, tassi e passività, e costruisce il `CurrencyConverter` con i tassi disponibili e la
valuta di riferimento del profilo. `LedgerService` espone `LoadAsync()` e le operazioni di alto livello usate da
dashboard, report, assistente e CLI, così tutti leggono gli stessi numeri.

---

## 11. Integrazioni

### 11.1 Contratti bancari (`BankContracts`)

| Tipo | Ruolo |
|---|---|
| `IBankConnector` | contratto di base: `ProviderSlug`, `DisplayName`, `IsDemo`; `ListInstitutionsAsync(countryCode)`, `StartAuthorizationAsync(institutionId, redirectUri)`, `CompleteAuthorizationAsync(...)` |
| `IBankDataConnector : IBankConnector` | aggiunge `GetBalancesAsync(accountExternalId)` e `GetTransactionsAsync(...)` (periodo e cursore) |
| `IAuthorizationCodeConnector` | connettori che completano il consenso con un codice di autorizzazione (redirect) |
| `IConnectorStatusRefresh` | riallineamento dello stato del consenso (scadenza, revoca) |
| `BankInstitution` | istituto: identificativo, nome, paese, logo |
| `BankAccountRef` | conto esterno: identificativo, nome, IBAN mascherato, valuta, tipo |
| `BankBalanceDto` | saldo dichiarato dalla banca con valuta e data di riferimento |
| `BankTransactionDto` | movimento esterno: identificativo, data, importo, valuta, descrizione, esercente, controparte, stato |
| `BankAuthorization` | avvio del consenso: URL di autorizzazione, stato, riferimento esterno |
| `AuthorizationResult` | esito del consenso: riferimento, scadenza, esito |
| `ConnectorStatus` | stato del connettore e messaggio per l'utente |
| `SyncRequest` / `SyncOutcome` | richiesta di sincronizzazione (conti, periodo, cursore) ed esito con contatori |

### 11.2 `BankSyncService`

Registro dei connettori per `ProviderSlug`. Avvio: crea o aggiorna l'`Integration` con stato
`PendingAuthorization` e conserva `InstitutionId`/`ExternalReference`; completamento: salva riferimento,
`AccessValidUntil`, `LastReconfirmationDate` e porta lo stato a `Connected`. Sincronizzazione: per ogni conto
letto dal connettore si creano o si riusano i conti locali (per `IntegrationId` + `ExternalId`), si leggono i
movimenti del periodo richiesto, si scartano quelli già presenti (indice unico `(AccountId, ExternalId)` e
`DedupeHash`), si inseriscono gli altri con `Source = Api`, e si registra un `SyncRun` con
`AccountsProcessed`, `TransactionsFetched`, `TransactionsImported`, `DuplicatesSkipped`, `ErrorsCount`,
`NextCursor`, `PeriodFrom`/`PeriodTo`, `IsDemo`, `ErrorMessage`, `LogJson`; lo stato passa a `Succeeded`,
`PartiallySucceeded` (errori parziali), `Failed` o `RateLimited`. Si aggiornano `LastSyncAtUtc`,
`LastSuccessAtUtc` e `LastErrorMessage`. Le credenziali restano nelle impostazioni cifrate: l'`Integration`
contiene solo `SettingsJson` non segreto e `SecretReference`.
Revoca: stato `Revoked`, consenso annullato, `Integration` conservata; i movimenti già importati non vengono
mai cancellati. Un consenso scaduto porta lo stato a `Expired` e genera una notifica `ConsentExpiring`.

### 11.3 Connettori

| Connettore | `ProviderSlug` | Note |
|---|---|---|
| `DemoBankConnector` | `demo-bank` (dichiarato in `ProviderSlug`) | banca simulata: istituto fittizio, conti e movimenti generati senza rete; `IsDemo = true`; serve a provare l'intero flusso senza credenziali |
| `GoCardlessBankDataConnector` | `gocardless-bank-account-data` (slug citato nella documentazione dell'entità `Integration`) | PSD2 GoCardless: `integration.gocardless.secretId`/`secretKey` dalle impostazioni cifrate, consenso con redirect, elenco conti e movimenti, gestione di scadenza consenso e limite di frequenza |
| Enable Banking (`EnableBanking/*`) | `enable-banking` | PSD2 Enable Banking: JWT **RS256** firmato con `integration.enablebanking.privateKey`, `applicationId`, `redirectUri`, `consentDays`, `psuType`; client HTTP e modelli propri, `IConnectorStatusRefresh` per la scadenza del consenso |

I connettori di rete vengono registrati solo con `EnableNetworkConnectors = true` (configurazione); il
connettore demo è sempre disponibile e serve a provare il flusso senza credenziali.

### 11.4 Importazione CSV (`CsvImportService`)

7 profili predefiniti (`CsvImportProfiles.BuiltIn`), con i nomi esatti:

| # | Profilo | Delimitatore | Convenzione di segno | Colonne mappate |
|---|---|---|---|---|
| 1 | Estratto conto bancario (generico) | `;` | `AsIs` | Data, Importo, Descrizione, Beneficiario, Valuta |
| 2 | Estratto conto con addebiti e accrediti separati | `;` | `DebitCreditColumns` | Data, Addebiti, Accrediti, Descrizione |
| 3 | Export inglese (date ISO, punto decimale) | `,` | `AsIs` | Date, Amount, Description, Payee, Currency, Transaction ID; date `yyyy-MM-dd` e `dd/MM/yyyy`, decimale `.`, migliaia `,` |
| 4 | Movimenti carta / portafoglio digitale | `,` | `TypeColumn` | Data, Importo, Tipo, Descrizione, Esercente |
| 5 | Fineco (movimenti esportati) | `;` | `AsIs` | Data operazione, Data valuta, Importo, Descrizione (usata anche come esercente), Divisa |
| 6 | Scalable Capital (transactions export) | `,` | `AsIs` | date, amount, description, type, transactionId; date `yyyy-MM-dd`, `dd.MM.yyyy`, `dd/MM/yyyy`; non è un estratto conto (`IsBankStatement = false`) |
| 7 | Portafoglio / prezzi strumenti | `;` | `AsIs` | Data, Prezzo, Simbolo, Valuta; non è un estratto conto |

`Suggest(headers, delimiter)` assegna **2 punti** per ogni colonna del profilo riconosciuta fra le intestazioni
(normalizzate: minuscolo, senza accenti né punteggiatura) e **1 punto** se il delimitatore coincide; sceglie il
punteggio più alto e rimappa le colonne sulle intestazioni reali (prima uguaglianza, poi contenimento). Il
risultato è solo una proposta: ogni associazione è modificabile.

Flusso: lettura con CsvHelper e rilevamento automatico delle colonne (per nome e per contenuto), **anteprima**
con le prime righe interpretate e gli errori per riga, scelta di conto predefinito e profilo, importazione
**in lotto** con `ImportBatch` (conteggi, mapping, impronta SHA-256 del file), deduplicazione, e
**annullamento del lotto** che elimina solo i movimenti creati da quel lotto.
`CsvSanitizer` neutralizza le formule (celle che iniziano con `=`, `+`, `-`, `@`, tabulazione o ritorno
carro) nei file esportati e ispeziona quelli importati: una cella non viene mai eseguita.

### 11.5 Dati di mercato

`MarketDataService` (Integrations):

| Membro | Comportamento |
|---|---|
| `IExchangeRateSource` / `DailyRate` | contratto di una fonte di tassi giornalieri: `GetDailyRatesAsync(base, quote, from, to)` |
| `EuropeanCentralBankRateSource` | fonte BCE via `HttpClient` (nessuna chiave); registrata solo con `EnableNetworkConnectors = true` |
| `UpdateExchangeRatesAsync(from, to)` | scarica i tassi del periodo, li salva in `ExchangeRates` con `SourceKind`/`SourceName`, salta i duplicati (indice unico su base/quote/data/fonte) e restituisce `ExchangeRateUpdateResult` con inseriti, saltati ed errori |
| `RefreshPositionsAsync(asOf)` | ricalcola le `PortfolioPositions` alla data indicata |
| `DescribePriceQualityAsync(staleDays = 7)` | elenco di avvisi leggibili su prezzi mancanti o più vecchi della soglia |

Prezzi: inserimento manuale, import CSV (profilo «Portafoglio / prezzi strumenti») e `SourceKind`
(`Manual`, `CsvImport`, `Provider`, `Broker`, `DerivedCarryForward`); il prezzo più recente ≤ data richiesta
alimenta il portafoglio, `IsStale` segnala quelli vecchi. Una fonte non configurata non produce valori
inventati: il prezzo manca e il portafoglio lo dichiara.
`ExchangeRateTableProvider` (Data) legge i tassi registrati e, per una data senza quotazione, usa il più
recente precedente; senza alcun tasso la conversione restituisce `null` e il motore segnala `HasMissingRates`.

### 11.6 Assistente (`AssistantService`)

Deterministico e **locale**: `AskAsync(domanda)` normalizza il testo (minuscolo, apostrofi e punteggiatura
trasformati in spazi, quindi «dall'anno» diventa «dall anno») e riconosce l'intento con espressioni regolari
generate: simulazione di risparmio, abbonamenti, scadenze, patrimonio netto, liquidità, portafoglio, confronto
fra periodi, anomalie, versamenti periodici e spesa (anche «quanto ho speso per …»). Il periodo si ricava da
«anno scorso»/«anno precedente», «questo anno»/«anno in corso»/«dall'inizio dell'anno», «mese scorso»/«mese
precedente», oppure dai mesi o anni citati nel testo (espressioni `LineMonths`/`LineYears`); gli importi si
leggono con `ParseNumber`. La risposta cita periodo, perimetro e valuta, elenca le righe di dettaglio in una
tabella (la vista mostra le colonne Dato/Valore) e, quando non capisce o il dato manca, restituisce una
spiegazione con esempi invece di inventare un numero (`Help(domanda, motivo)`).
Il provider IA remoto è opzionale, spento per default e richiede consenso esplicito registrato
(`ai.remoteProcessingConsent`, `ai.consentDateUtc`); con `ai.sendAggregatedOnly = true` si inviano solo aggregati.
La chiave `ai.apiKey` è un segreto DPAPI e non compare mai nelle risposte né nei log.

#### 11.6.1 Ordine di valutazione degli intenti

`AskAsync` prova gli intenti **in quest'ordine** e si ferma al primo che corrisponde: la stessa domanda viene
quindi attribuita all'intento più specifico e non a quello generico che la contiene.

| # | Intento (`Intent` restituito) | Espressione regolare | Condizione aggiuntiva |
|---|---|---|---|
| 0 | `Aiuto` | — | testo vuoto: `Help(text, "Domanda vuota.")` |
| 1 | `Simulazione di risparmio` | `risparmi\w*[^\d]{0,24}(?<amount>\d+(?:[.,]\d+)?)\s*(?:euro\|eur)?[^\d]{0,24}(?<years>\d+)\s*ann` | importo > 0 e anni 1–60; altrimenti si prosegue |
| 2 | `Abbonamenti e ricorrenze` | `abbonament\|subscription\|rinnov` | finestra 90 giorni |
| 3 | `Scadenze` | `scadenz\|prossim[ie] (?:pagament\|addebit)\|deadline` | finestra 45 giorni, primi 5 |
| 4 | `Patrimonio netto` | `patrimoni\|net ?worth` | — |
| 5 | `Liquidità disponibile` | `liquidit\|disponibil\|senza vendere` | — |
| 6 | `Portafoglio` | `portafogli\|investiment\|titoli` | — |
| 7 | `Confronto categorie` | `aumentat\|diminuit\|rispetto al mese\|rispetto all anno\|confronto` | mesi correnti e precedenti |
| 8 | `Spese anomale` | `spes[ea] anom\|insolit\|strano\|impennat` | — |
| 9 | `Risparmio del periodo` | `quanto ho risparmiat\|risparmio (?:questo\|nell)\|ho messo da parte` | valutato **prima** delle spese, che contiene |
| 10 | `Spese per categoria` | `quanto ho speso\|spes[ea] totale\|totale (?:delle )?spes` | periodo da `ResolvePeriod`, termine da `ExtractCategoryTerm` |
| 11 | `Aiuto` | — | nessuna corrispondenza: `Help(text, "Domanda non riconosciuta.")` |

Tutte le espressioni sono `[GeneratedRegex]` con `RegexOptions.IgnoreCase | RegexOptions.CultureInvariant` e
lavorano sul testo **normalizzato** da `DuplicateDetector.Normalize` (minuscolo, accenti e punteggiatura ridotti a
spazi: «dall'anno» → «dall anno»). L'esito del confronto è `bool`: l'unica regex con gruppi nominati è quella della
simulazione (`amount`, `years`), letti con `ParseNumber` (rimuove i punti delle migliaia, converte la virgola in
punto, `decimal.TryParse` invariante; valore non valido → `0`).

#### 11.6.2 Espressioni di periodo (`ResolvePeriod`)

Valutate in quest'ordine, la prima che corrisponde determina il periodo:

| Ordine | Regola | Regex / testo cercato | Risultato |
|---|---|---|---|
| 1 | mesi citati | `ultim[ie] (?<n>\d+)\s*mes` | `DateRange.LastMonths(today, Clamp(n, 1, 120))` |
| 2 | anni citati | `ultim[ie] (?<n>\d+)\s*ann` | `DateRange.LastMonths(today, Clamp(n × 12, 1, 240))` |
| 3 | anno precedente | `anno scorso`, `anno precedente` | `DateRange.ForYear(today.Year - 1)` |
| 4 | anno corrente | `questo anno`, `anno in corso`, `quest anno`, `dall inizio dell anno` | `DateRange.ForYear(today.Year)` |
| 5 | mese precedente | `mese scorso`, `mese precedente` | `DateRange.ForMonth(today.Year, today.Month).AddMonths(-1)` |
| 6 | predefinito | — | mese corrente `DateRange.ForMonth(today.Year, today.Month)` |

L'intento «Risparmio del periodo» non usa `ResolvePeriod`: sceglie `DateRange.ForYear` se il testo contiene
«ann», altrimenti il mese corrente. Il confronto fra categorie usa sempre `mese corrente −1` contro `−2`.

#### 11.6.3 Termine di ricerca della categoria (`ExtractCategoryTerm`)

1. se compare «speso in » o «speso per », il termine è il testo successivo;
2. altrimenti si prende il testo dopo «speso»; se «speso» manca, il termine è vuoto;
3. si eliminano con `PeriodNoiseRegex` i numeri e le parole di periodo (`negli`, `nello`, `nella`, `nelle`, `ultim[ie]`,
   `ultimo`, `ultima`, `mes[ei]`, `ann[oi]`, `questo`, `questa`, `scorso`, `scorsa`, `precedente`, `in corso`, `dall`,
   `inizio`, `dell`, `totale`, `delle`, `dei`, `degli`, `oggi`, `adesso`) e con `StopWordsRegex` le parole di servizio
   (`quanto`, `ho`, `hai`, `abbiamo`, `di`, `del`, `della`, `per`, `in`, `il`, `lo`, `la`, `le`, `i`, `gli`, `un`, `una`,
   `e`, `al`, `ai`);
4. il residuo viene normalizzato e confrontato per sottostringa con il percorso normalizzato delle categorie.

#### 11.6.4 Messaggi restituiti

| Intento | Testo della risposta |
|---|---|
| Simulazione | «Risparmiando {importo} al mese per {anni} anni accumuli {totale}, senza ipotizzare alcun rendimento. Con un rendimento ipotetico il risultato cambierebbe: la simulazione con ipotesi è disponibile in Previsioni.» — avvertenza: «Calcolo aritmetico: non è una promessa di rendimento né una previsione.» |
| Abbonamenti | «Gli abbonamenti registrati costano {mese} al mese, pari a {anno} all'anno. Tutte le spese ricorrenti insieme valgono {anno} all'anno, mentre le entrate ricorrenti valgono {anno}: saldo ricorrente {mese} al mese. L'applicazione non disdice nulla automaticamente: la decisione resta all'utente.» |
| Scadenze | «Prossime scadenze: {nome} ({importo}) il {data}; …» oppure «Non risultano scadenze ricorrenti nei prossimi 45 giorni.» |
| Patrimonio netto | «Il tuo patrimonio netto è {valore} (attività {attività}, passività {passività}).» più «Il totale include valori stimati o prezzi non aggiornati: le note sono visibili nel widget Patrimonio netto.» o «Tutti i valori provengono da saldi e prezzi registrati.» |
| Liquidità | «Hai {valore} di liquidità immediatamente disponibile, senza vendere investimenti (conti correnti, deposito, contanti e carte di debito).» |
| Portafoglio | «Il portafoglio vale {valore mercato} con un risultato non realizzato di {P&L}. Le posizioni senza prezzo sono valorizzate al costo di carico.» — avvertenza: primi 3 `Warnings` del motore, se presenti |
| Confronto | «Categorie aumentate rispetto al mese precedente: {categoria} ({variazione%}); …» oppure «Nessuna categoria risulta aumentata rispetto al mese precedente tra quelle presenti in entrambi i mesi.» — avvertenza: confronto fra i due intervalli di date |
| Anomalie | «Spese insolitamente alte: {categoria} ({effettivo} contro una mediana di {mediana}); …» (massimo 4) oppure «Non risultano aumenti anomali di spesa rispetto ai mesi precedenti.» — avvertenza: «La rilevazione usa mediana e scarto assoluto mediano: un singolo valore estremo non falsa la base di confronto.» |
| Risparmio periodo | «Nel periodo {intervallo} hai incassato {entrate} e sostenuto uscite per {uscite}: risparmio netto {valore} (tasso di risparmio {percentuale}).» — avvertenza: «I trasferimenti tra conti propri e gli acquisti di investimenti non sono conteggiati come spese.» |
| Spese per categoria | «Nel periodo {intervallo} hai speso {totale} {in totale/per «termine»}. La voce principale è {categoria} con {importo}.» — se il termine non trova nulla: «Non trovo spese per «{termine}» nel periodo {intervallo}. Il confronto avviene sui nomi delle categorie usati nell'applicazione.» |
| Aiuto | «{motivo} L'assistente risponde esclusivamente con calcoli sui tuoi dati: nessuna stima inventata, nessuna raccomandazione di investimento.» — avvertenza: «Tutte le risposte sono calcolate localmente da funzioni verificabili. Nessun dato viene inviato all'esterno.» |

Ogni risposta contiene `Facts` (coppie etichetta/valore già formattate con `MoneyFormatter`), `UsedRemoteModel =
false` per il motore locale e `SuggestedQuestions` = `HelpSuggestions`. I fatti per intento: simulazione (versamento
mensile, durata, totale versato, rendimento ipotizzato «nessuno (calcolo aritmetico)», valore finale stimato);
abbonamenti (mese, anno, spese ricorrenti, entrate ricorrenti, ricorrenze attive); scadenze (una voce per scadenza:
«{importo} · {data}», massimo 5); patrimonio (attività, passività, patrimonio, liquidità, investimenti); liquidità
(una voce); portafoglio (valore di mercato, costo di carico, non realizzato, realizzato, dividendi incassati);
confronto (per categoria: «{precedente} → {corrente} ({variazione%})», massimo 5); anomalie (per categoria:
«{effettivo} · {scostamento%} sulla mediana», massimo 5); risparmio (entrate, spese di consumo, costi finanziari,
risparmio netto, tasso); spese (prime 8 categorie con «{importo} · {quota%} delle uscite», poi «Totale selezionato»
e «Periodo»). Se `flow.HasMissingRates` è vero la risposta aggiunge: «Alcuni importi non sono stati convertiti per
mancanza di tassi di cambio e non sono inclusi nei totali.»

`HelpSuggestions` (10 domande di esempio, esposte anche da `AssistantIntents.Examples`): «Quanto ho speso in
ristoranti negli ultimi 3 mesi?», «Quanto pago all'anno di abbonamenti?», «Se risparmio 150 euro al mese per 5 anni,
quanto accumulo senza rendimento?», «Quali categorie sono aumentate rispetto al mese precedente?», «Qual è il mio
patrimonio netto?», «Quanta liquidità ho disponibile?», «Quanto ho risparmiato questo mese?», «Quanto vale il mio
portafoglio?», «Quali sono le prossime scadenze?», «Ci sono spese anomale questo mese?». Il nome del provider locale è
«Motore locale deterministico» con `IsRemote = false`.

### 11.7 Report ed esportazioni (`ReportBuilder`, `ExportService`)

Otto report, uno per metodo di `ReportBuilder`:

| Metodo | Report | Parametri |
|---|---|---|
| `BuildCashFlowReportAsync` | Flussi di cassa | `DateRange` |
| `BuildBudgetReportAsync` | Budget | data di riferimento |
| `BuildNetWorthReportAsync` | Patrimonio netto | data |
| `BuildPortfolioReportAsync` | Portafoglio | data |
| `BuildRecurringReportAsync` | Spese ricorrenti e abbonamenti | data |
| `BuildGoalsReportAsync` | Obiettivi | data |
| `BuildForecastReportAsync` | Previsione di liquidità | data e orizzonte in giorni |
| `BuildYearOverYearReportAsync` | Confronto anno su anno | anno |

Ogni report è un `ReportDocument` con titolo, periodo, valuta, sottotitolo, avvertenze e sezioni
(`ReportSection`) di tipo tabella, elenco puntato, indicatori o serie per grafico. La CLI li richiama con
`--kind cashflow|budget|networth|portfolio|recurring|goals|forecast|yoy`.

| Formato | Contenuto |
|---|---|
| CSV | tabelle e elenco movimenti, con intestazioni italiane e importi invarianti (punto decimale) per non perdere precisione |
| XLSX (ClosedXML) | un foglio per sezione, intestazioni in grassetto, formati numerici, larghezze automatiche |
| PDF (QuestPDF) | impaginazione con intestazione, data di stampa, tabelle e note; licenza Community |
| JSON | esportazione completa dei dati personali (sezione 6.9) |

Ogni esportazione registra una voce di audit `Export` con il nome del file.---

## 12. Interfaccia WPF

### 12.1 Guscio (`MainWindow` + `MainViewModel`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sidebar (66 px compressa / 248 px estesa)  │  Barra superiore        │
│  ▸ 12 voci di navigazione con icona        │  periodo · valuta ·     │
│  ▸ sezione attiva evidenziata              │  ricerca · tema ·       │
│  ▸ pulsante di compressione                │  notifiche · profilo    │
│                                            ├─────────────────────────┤
│                                            │  Contenuto (pagina)     │
│                                            │                         │
│                                            ├─────────────────────────┤
│                                            │  Barra di stato         │
└──────────────────────────────────────────────────────────────────────┘
```

- Navigazione: `Dashboard`, `Movimenti`, `Conti`, `Budget`, `Ricorrenti`, `Obiettivi`, `Patrimonio`,
  `Investimenti`, `Report`, `Importazione`, `Assistente`, `Impostazioni` (12 sezioni).
- Compressione della sidebar persistita in `ui.sidebar.collapsed`; larghezza e altezza finestra in
  `ui.window.width`/`height`, stato massimizzato in `ui.window.maximized` (valori iniziali 1440×900).
- `MainViewModel` espone: sezione attiva, elenco periodi (`PeriodPreset` con etichette italiane), intervallo
  personalizzato, valuta di visualizzazione, testo di ricerca globale, comando tema (chiaro/scuro/sistema),
  notifiche non lette, nome del profilo, comandi di navigazione e `Reset()` alla disconnessione.
- Passaggio di sezione: `ViewFactory` restituisce la coppia (vista, view model) registrata; le pagine sono
  singleton (stato conservato), le finestre di dialogo transient.

### 12.2 Temi e stili

`Themes/Light.xaml` e `Themes/Dark.xaml` contengono **le stesse 28 chiavi** (`SolidColorBrush`), quindi il cambio
tema è una semplice sostituzione del dizionario; `Themes/Controls.xaml` contiene **32 stili** con chiave. L'elenco
completo, chiave per chiave e con i valori esadecimali reali, è nella §12.7. Colore d'accento predefinito `#1565C0`
(`ui.accentColor`). `ThemePreference.FollowSystem` segue l'impostazione di Windows anche quando cambia.

### 12.3 Convertitori, dialoghi, autosalvataggio

- Convertitori in `Converters/`: `AmountTextConverter.cs` e `AppConverters.cs`. L'elenco completo delle classi,
  con proprietà e comportamento, è nella §12.8.
- `Converters/AmountFieldNormalizer.cs` (`AmountFieldNormalizer.Attach()`) aggancia un gestore globale: quando
  un campo importo perde il fuoco, il testo viene riletto con `AmountParser` (accetta «12,5» e «12.5») e
  riscritto nella forma italiana.
- `IDialogService`: messaggi informativi, avvisi, errori, conferme (con testo del pulsante), richiesta di
  testo (per la frase di cancellazione), scelta file (aperura/salvataggio con filtri), cartella.
- **Autosalvataggio**: le schede di modifica salvano con debounce di **1 secondo** dall'ultima modifica;
  `Ctrl+S` forza il salvataggio immediato; uscendo da una scheda con modifiche non salvate viene chiesto
  conferma. Gli errori di salvataggio lasciano la scheda aperta con il messaggio.
- **Scorciatoie**: `Ctrl+N` nuovo movimento, `Ctrl+S` salva, `Ctrl+Shift+S` salva e chiude, `Ctrl+D` duplica,
  `Ctrl+E` modifica, `F5` aggiorna, `Canc` elimina la riga selezionata, `Esc` annulla/chiude.

### 12.4 Schermate

**Movimenti** — la schermata più densa.

- Barra dei filtri: periodo (con `ui.transactions.followPeriod` per seguire il periodo globale), conti,
  categorie (con sottocategorie), testo, importo minimo/massimo, stato, tipo, tag, origine.
- Tabella con **12 colonne** definite in `ColumnCatalog` (chiave, intestazione, larghezza in pixel, visibile
  per default):

| Chiave | Intestazione | Larghezza | Visibile all'apertura |
|---|---|---|---|
| `date` | Data | 96 | sì |
| `description` | Descrizione | 280 | sì |
| `payee` | Esercente | 160 | no |
| `account` | Conto | 150 | sì |
| `category` | Categoria | 150 | sì |
| `subcategory` | Sottocategoria | 160 | no |
| `flow` | Tipo | 100 | no |
| `amount` | Importo | 120 | sì |
| `status` | Stato | 105 | no |
| `source` | Fonte | 105 | no |
| `tags` | Tag | 140 | no |
| `notes` | Note | 220 | no |

  Tutte le larghezze sono in **pixel** (nessuna stella); l'utente mostra/nasconde le colonne dal pannello
  contestuale (`ToggleColumnPanel`, `ToggleColumn`, `ResetColumns`) e la scelta è salvata come elenco di chiavi
  in `ui.transactions.columns`; riaprendo, le colonne non presenti nell'elenco tornano al default e almeno due
  restano visibili.
- **Minimo due colonne visibili**: con due colonne attive l'ultima non si può nascondere (il comando lascia lo
  stato invariato e mostra un messaggio).
- Menu di riga con **Apri**, **Duplica**, **Elimina** (`DuplicateRowAsync`, `DeleteRowAsync`); l'eliminazione
  chiede conferma e, per un trasferimento o un movimento ricorrente, avverte che l'operazione coinvolge
  l'intera coppia.
- Riga selezionata → pannello laterale di dettaglio con campi, suddivisioni (con la somma residua sempre
  visibile), allegati e note; doppio clic apre la scheda di modifica.
- Totali del filtro in fondo (entrate, uscite, saldo) e paginazione con dimensione da
  `ui.transactions.pageSize`.
- Modifica multipla sulla selezione multipla; menu «Altro» con applicazione regole, esportazione del filtro,
  eliminazione multipla.

**Conti** — elenco a schede con saldo, natura, valuta, istituto, ultima riconciliazione; pannello di sintesi
(totale attività, passività, liquidità); comandi nuovo conto, modifica, archivia, riconcilia, riordina.

**Budget** — elenco dei budget attivi con barra di avanzamento, residuo, riporto, proiezione e stato di
avviso; dettaglio per categoria; comandi nuovo budget, modifica limiti, chiudi periodo, override del limite.

**Ricorrenti** — prossime scadenze in ordine di data, totale mensile equivalente, aumenti rilevati,
abbonamenti, ricorrenze senza addebito; comandi nuova ricorrenza, conferma occorrenza, salta, pausa/riprendi,
registra aumento.

**Obiettivi** — schede con avanzamento, importo mancante, data prevista, versamento mensile necessario;
fondo emergenze con copertura in mesi.

**Patrimonio** — attività/passività con componenti, note sulla qualità dei dati (stime, prezzi vecchi, cambi
mancanti), storia mensile, rapporti (investito/attivi, liquidità, debito).

**Investimenti** — posizioni (quantità, costo medio, prezzo e data, valore, plusvalenza), operazioni,
dividendi, prezzi, allocazioni, performance (XIRR, TWR, Dietz, CAGR, volatilità, drawdown), stima fiscale;
comandi nuovo strumento, nuova operazione, nuovo dividendo, aggiorna prezzo, importa prezzi, ricalcola.

**Report** — scelta fra gli 8 report, periodo, perimetro conti, anteprima e esportazione (CSV, XLSX, PDF).

**Importazione** — scelta file, profilo, rilevamento colonne, anteprima con errori per riga, conto predefinito,
importazione o simulazione, elenco dei lotti con possibilità di annullamento.

**Assistente** — campo domanda, elenco delle domande di esempio, risposta con periodo e perimetro citati,
avvertenza quando il dato non è disponibile, interruttore per l'uso del provider remoto (solo con consenso).

**Impostazioni** — sezioni: Profilo, Aspetto, Movimenti, Budget, Portafoglio, Fisco, Banche e integrazioni,
Assistente, Privacy e dati, Sicurezza e backup, Informazioni. Comandi: cambia password, ricordi/dimentica
credenziali, modifica note, esporta dati, cancella dati, crea/ripristina backup, verifica database, apri
cartella dati e log.

**Account** (finestra modale) — tre schede (`Header`): «Profilo», «Sicurezza», «Cartella»: profilo corrente,
nome mostrato, cambio password, credenziali ricordate, disconnessione, eliminazione profilo con o senza dati,
percorsi di cartelle e file.

### 12.5 Inventario dei view model (proprietà e comandi)

I campi sono dichiarati con `[ObservableProperty]` (il toolkit genera la proprietà PascalCase e `On…Changed`);
i comandi nascono da `[RelayCommand]` sui metodi elencati (nome del comando = metodo senza `Async` + `Command`).

| View model | Proprietà (campi osservabili) | Comandi |
|---|---|---|
| `MainViewModel` | accountLabel, accountInitial, selectedNav, currentView, currentTitle, currentDescription, selectedPeriod, customFrom, customTo, periodLabel, selectedCurrency, searchText, isBusy, statusMessage, themeLabel, isAdvancedMode, isSidebarCollapsed, dataFolder, unreadNotifications | ReloadCurrentAsync, ApplyCustomPeriodAsync, SearchAsync, ToggleSidebarAsync, ToggleThemeAsync, RefreshNotificationsAsync, OpenDataFolder |
| `TransactionsViewModel` | categoryId, amount, note, selectedItem, searchText, filterAccount, filterCategory, onlyOutflows, onlyInflows, onlyUnclassified, excludeTransfers, includeDraft, pageSize, isBusy, statusMessage, totalInflowsText, totalOutflowsText, countText, editingId, editDate, editAmount, editDescription, editPayee, editAccount, editCategory, editStatus, editNotes, editTags, editSource, splitTotal, splitDifferenceText | LoadLookupsAsync, ApplyFiltersAsync, ClearFilters, NewTransaction, AddSplit, RemoveSplit, SaveAsync, DeleteAsync, DeleteRowAsync, DuplicateAsync, DuplicateRowAsync, ConfirmAsync, CancelTransactionAsync, MarkDraftAsync, BulkAssignAsync, ApplyRulesAsync, FindDuplicatesAsync, MergeDuplicatesAsync, ExportAsync |
| `TransactionsViewModel` (registro) | isSelected, isVisible, rangePreset, customFrom, customTo, followWorkspacePeriod, rangeText, netText, netAmount, toClassifyText, toReconcileText, transfersText, bulkCategory, showColumnPanel, showActionsPanel | SelectRangeAsync, ApplyCustomRangeAsync, ToggleColumn, ResetColumns, ToggleColumnPanel, ToggleActionsPanel, SelectAllRows, ClearSelection, ApplyCategoryToSelectionAsync, ApplyFrequentCategoryAsync, ConfirmSelectionAsync, MarkDraftSelectionAsync, CancelSelectionAsync, DeleteSelectionAsync, OpenImport, OpenAccounts, SaveAndNewAsync |
| `TransactionsViewModel` (autosalvataggio) | autoSaveText, hasUnsavedChanges | — |
| `AccountsViewModel` | selectedAccount, includeArchived, isBusy, statusMessage, totalAssetsText, totalLiabilitiesText, liquidityText, netTotalText, editingId, editName, editType, editNature, editCurrency, editOpeningBalance, editOpeningBalanceDate, editInstitution, editNotes, editIncludeInNetWorth, editIncludeInLiquidity, transferFromId, transferToId, transferAmount, transferDate, transferDescription, reconciliationAccountText, statementDate, declaredBalanceText, reconciliationSummary, residualDifferenceText, reconciliationPlanHint, reconciliationStaleText, reconciliationRecordNotes, hasReconciliation, reconciliationResolved, reconciliationStale, reconciliationRecordId | ReloadAsync, NewAccount, SaveAsync, ArchiveAsync, DeleteAsync, DeclareBalanceAsync, RefreshReconciliationAsync, ApplyFindingAsync, VerifyDifferenceAsync, ReopenReconciliationAsync, CreateTransferAsync |
| `AccountsViewModel` (autosalvataggio) | autoSaveText, hasUnsavedChanges | — |
| `BudgetViewModel` | categoryId, limit, selectedRow, isBusy, statusMessage, summaryText, editingId, editName, editPeriodType, editTotalLimit, editIsGlobal, editIncludeSubcategories, editRolloverMode, editAlertThreshold, editIsActive, editStartDate, editEndDate | ReloadAsync, NewBudget, AddAllocation, RemoveAllocation, SaveAsync, DeleteAsync |
| `RecurringViewModel` | selectedRow, includeEnded, isBusy, statusMessage, monthlyTotalText, yearlyTotalText, subscriptionsMonthlyText, incomeMonthlyText, editingId, editName, editFrequency, editInterval, editExpectedAmount, editStartDate, editEndDate, editNextDueDate, editAccount, editCategory, editPayee, editIsSubscription, editCreateDraft, editReminderDays, editDayOfMonth, editStatus, editNotes | ReloadAsync, NewRecurring, SaveAsync, DeleteAsync, PauseAsync, ResumeAsync, EndAsync, RegisterOccurrenceAsync |
| `GoalsViewModel` | selectedRow, includeArchived, isBusy, statusMessage, totalSavedText, totalTargetText, editingId, editName, editType, editTargetAmount, editCurrency, editTargetDate, editManualCurrent, editLinkedAccount, editLinkedCategory, editContributionTag, editPlannedMonthly, editEmergencyMonths, editIsArchived, editNotes | ReloadAsync, NewGoal, SaveAsync, DeleteAsync |
| `NetWorthViewModel` | isBusy, statusMessage, netWorthText, assetsText, liabilitiesText, liquidityText, investedText, debtRatioText, hasEstimates, editingAssetId, assetName, assetKind, assetValue, assetCurrency, assetValueDate, assetIsEstimate, assetDepreciation, assetNotes, editingLiabilityId, liabilityName, liabilityKind, liabilityPrincipal, liabilityOutstanding, liabilityRate, liabilityStartDate, liabilityEndDate, liabilityInstallment, liabilityRemainingInstallments, liabilityInstallmentsPerYear, liabilityInstitution, liabilityNotes, liabilityAccount | ReloadAsync, NewAsset, SaveAssetAsync, DeleteAssetAsync, EditAsset, NewLiability, SaveLiabilityAsync, EditLiability, DeleteLiabilityAsync, RegisterInstallmentAsync |
| `PortfolioViewModel` | isBusy, statusMessage, marketValueText, costBasisText, unrealizedText, realizedText, dividendsText, feesText, taxesText, concentrationText, fiscalTaxText, fiscalDisclaimer, stalePriceCount, missingPriceCount, priceDate, editingSecurityId, securityName, securityTicker, securityIsin, securityType, securityCurrency, securitySector, securityRegion, securityIsGovernmentBond, operationSecurity, operationAccount, operationType, operationDate, operationQuantity, operationPrice, operationFees, operationTaxes, operationNotes, dividendSecurity, dividendAccount, dividendDate, dividendGross, dividendTaxRate, priceSecurity, priceValue, priceSourceName, manualRate, manualRateBase, manualRateQuote | ReloadAsync, NewSecurity, SaveSecurityAsync, NewOperation, SaveOperationAsync, DeleteOperationAsync, NewDividend, SaveDividendAsync, NewPrice, SavePriceAsync, SaveExchangeRateAsync, RefreshPositionsAsync |
| `ReportsViewModel` | selectedChoice, document, selectedYear, forecastHorizonDays, isBusy, statusMessage, documentHeader, scenarioTitle, scenarioInitialValue, scenarioMonthlyChange, scenarioYears, scenarioAnnualReturn, scenarioWithReturn, scenarioInflation, scenarioFeeRate, scenarioDisclaimer, scenarioResultText | BuildAsync, ExportAsync, RunScenarioAsync, RunOneOffExpenseAsync |
| `ImportViewModel` | selectedProfile, targetAccount, defaultCategory, selectedFilePath, preview, isBusy, statusMessage, previewSummary, hasDangerousContent, selectedInstitution, selectedInstitutionCountry, bankStatusMessage, redirectUri, authorizationCallback | ReloadAsync, ChooseFile, PreviewAsync, ImportAsync, UndoBatchAsync, LoadInstitutionsAsync, ConnectBankAsync, CompleteConnectionAsync, SyncAsync, RevokeAsync |
| `AssistantViewModel` | question, answerText, intentText, disclaimer, isBusy, statusMessage, engineName, isRemoteEnabled, aiEnabled, remoteConsent, sendAggregatedOnly, privacyText | LoadSettingsAsync, UseSuggestion, AskAsync, ToggleEnabledAsync, GiveConsentAsync, ToggleAggregatedOnlyAsync |
| `SettingsViewModel` | selectedTabIndex, isBusy, statusMessage, baseCurrency, country, locale, dateFormat, fiscalMonthStartDay, timeZone, experienceMode, userName, theme, accentColor, autoLockEnabled, autoLockMinutes, backupOnExit, encryptBackups, backupFolder, telemetryEnabled, lastExportText, costBasisMethod, includeFeesInCostBasis, stalePriceDays, fiscalGeneralRate, fiscalGovernmentBondRate, fiscalLossCarryForwardYears, fiscalStampDutyRate, enableBankingRedirectUri, enableBankingConsentDays, demoDataPresent, marketDataAttribution | ReloadAsync, SaveAsync, CreateBackupAsync, RestoreBackupAsync, ChooseBackupFolderAsync, ExportPersonalDataAsync, DeletePersonalDataAsync, SeedDemoDataAsync, ClearDemoDataAsync, MarkNotificationReadAsync, MarkAllNotificationsReadAsync, SetSecretFromFileAsync; gruppi: SaveGroupAsync, CancelGroupAsync, SkipToNextGroup, SkipToPreviousGroup, SkipToUnsavedGroup, GoToGroup |
| `AccountViewModel` | userName, displayName, createdAtLabel, lastLoginLabel, dataFolder, usersFolder, accountsFile, notesFile, hasRememberedCredentials, baseCurrency, isAdvancedMode, statusMessage, errorMessage, isBusy | SaveProfileAsync, SavePreferencesAsync, ChangePasswordAsync, ForgetRememberedCredentials, OpenUsersFolder, Logout |
| `LoginViewModel` | mode, userName, displayName, password, confirmPassword, errorMessage, isBusy, rememberMe, hasPrefilledCredentials | SwitchMode |
| `OnboardingViewModel` | isSelected, stepIndex, isBusy, statusMessage, stepTitle, stepDescription, progressText, baseCurrency, country, locale, dateFormat, fiscalMonthStartDay, experienceMode, keepDataLocal, userName, accountName, accountType, accountCurrency, accountOpeningBalance, accountOpeningDate, accountInstitution, selectedCategory, categoryName, categoryColor, monthlyBudget, savingsTarget, createEmergencyFund, emergencyMonths, selectedPreset, replaceDefaultLayout, completed | NextAsync, Back, SkipStep, AddAccountAsync, RemoveAccountAsync, LoadCategoriesAsync, RenameCategoryAsync, RestoreDefaultCategoriesAsync, CompleteAsync |
| `DashboardViewModel` | hasUnsavedChanges, selectedLayout, selectedWidgetToAdd, isBusy, isEditing, statusMessage, periodLabel, lastRefreshLabel, gridRowCount, layoutInfo, hasError, errorMessage | RefreshAsync, ToggleEditing, AddWidget, RemoveWidget, MoveUp, MoveDown, SetSize, SaveAllAsync, SaveLayoutAsync, DuplicateLayoutAsync, DeleteLayoutAsync, ResetLayoutAsync, CreateLayoutFromPresetAsync, ExportDashboardAsync |
| `DashboardViewModel` (approfondimenti) | selectedPeriodChip, selectedGranularityChip, dashboardPeriod, dashboardGranularity, customFrom, customTo, selectedAccountScope, currencyLabel, filterSummary, granularityNote, cashFlowSeries, cashFlowXAxes, cashFlowYAxes, cashFlowHeadline, cashFlowNote, spendingSeries, spendEvolutionSeries, spendEvolutionXAxes, spendEvolutionYAxes, spendingHeadline, spendingNote, selectedSlice, spendingScopeText, budgetHeadline, budgetNote, netWorthSeries, netWorthXAxes, netWorthYAxes, netWorthHeadline, netWorthNote, portfolioSeries, portfolioHeadline, portfolioNote, goalsHeadline, goalsNote, calendarSeries, calendarXAxes, calendarYAxes, calendarHeadline, calendarNote, fiscalHeadline, fiscalNote, isDrillDownOpen, drillDownTitle, drillDownSubtitle, drillDownTotals, drillDownNavigation | SetPeriodAsync, SetGranularityAsync, ApplyCustomPeriodAsync, ResetInsightsFiltersAsync, CloseDrillDown, OpenDrillDownTarget, OpenSlice, SelectSlice, OpenBucket, OpenTransactions, OpenTarget, OpenTransaction |
| `WidgetViewModel` (base di ogni widget) | isBusy, errorMessage, hasError, gridRow, gridColumn, gridSpan, height | comandi specifici del widget |

### 12.6 Struttura delle viste (XAML)

17 file XAML: `MainWindow`, `LoginWindow`, `OnboardingWindow`, `AccountWindow` (finestre) e 12 pagine
(`DashboardView`, `AccountsView`, `TransactionsView`, `BudgetView`, `RecurringView`, `GoalsView`,
`NetWorthView`, `PortfolioView`, `ReportsView`, `ImportView`, `AssistantView`, `SettingsView`) più
`WidgetHost` (contenitore dei widget). Il code-behind contiene solo comportamento visivo (focus, chiusura,
scorrimento); i dati arrivano dai binding.

| Vista | Struttura e colonne principali |
|---|---|
| `MainWindow` | sidebar con le 12 voci (glifo + titolo), barra superiore con periodo, valuta, ricerca, tema, notifiche (`UnreadNotifications`), iniziale del profilo, pulsante Account; area contenuto (`CurrentView`) con titolo e descrizione; barra di stato con `StatusMessage` e `PeriodLabel` |
| `TransactionsView` | `Grid` a due colonne: elenco (`*`) e pannello di dettaglio largo **430 px**; barra filtri con campi da 210/160/200 px; pannello colonne (`ItemsControl` su `Columns`, `ToggleColumnPanel`, `ResetColumns`); tabella con le 12 colonne del catalogo (`date` 96, `description` 280, `payee` 160, `account` 150, `category` 150, `subcategory` 160, `flow` 100, `amount` 120, `status` 105, `source` 105, `tags` 140, `notes` 220 — le prime cinque visibili all'apertura); scheda di modifica a destra con importi, stato (`StatusOptions`), origine (`SourceOptions`), suddivisioni (riga con larghezza 96 px per l'importo) e allegati |
| `AccountsView` | colonne: Conto, Istituto, Tipo, Valuta, Saldo, Nella valuta di riferimento, Movimenti, Riconciliazione; riquadri di sintesi (attività, passività, liquidità, totale) |
| `BudgetView` | colonne: Budget, Periodo, Limite, Speso, Residuo, Consumato, Disponibile al giorno, Fine periodo stimata; dettaglio per categoria con barra di avanzamento |
| `RecurringView` | colonne: Nome, Frequenza, Importo, Mese equivalente, Anno equivalente, Prossima scadenza, Conto, Categoria |
| `GoalsView` | colonne: Obiettivo, Tipo, Accumulato, Obiettivo, Mancante, Avanzamento, Completamento previsto, Versamento mensile necessario |
| `NetWorthView` | colonne: Voce, Valore, Quota sulle attività, Periodo, Attività, Passività, Patrimonio netto, Include stime |
| `PortfolioView` | colonne: Strumento, Tipo, Conto, Quantità, Costo di carico, Prezzo medio, Ultimo prezzo, Valore; riquadri per plusvalenze, dividendi, costi, imposte, concentrazione e stima fiscale |
| `ImportView` | anteprima con colonne: Riga, Data, Importo, Descrizione, Esercente, Valuta, Stato, Messaggi; avviso `HasDangerousContent`; sezione bancaria con istituti, redirect e stato |
| `ReportsView` | scelta del report, anno, orizzonte della previsione; tabella dello scenario: Anno, Valore nominale, Versamenti, Valore reale, Costi |
| `SettingsView` | schede «Profilo» e «Sicurezza e backup» (e gruppi successivi); elenco backup con colonne File, Dimensione, Creato, Cifrato, Quando, Azione |
| `AssistantView` | casella domanda, suggerimenti, risposta con tabella Dato/Valore, avvertenze e interruttori di consenso |
| `OnboardingWindow` | sei passaggi; tabelle di conti (Nome, Tipo, Valuta, Saldo iniziale, Istituto) e categorie (Categoria, Tipo, Colore) |
| `DashboardView` | griglia a 12 colonne di widget, pannello «Riquadri personalizzati», comandi di modifica e scelta layout |
| `WidgetHost` | contenitore con stato di caricamento, errore e stato vuoto per ogni widget |
| `LoginWindow` | accesso/creazione profilo, password, conferma, «ricordami», errore, password precompilata |

### 12.7 Temi e risorse

#### 12.7.1 Chiavi della palette (28, identiche nei due temi)

| # | Chiave | Ruolo | Chiaro (`Light.xaml`) | Scuro (`Dark.xaml`) |
|---|---|---|---|---|
| 1 | `WindowBackgroundBrush` | sfondo della finestra | `#F4F6F8` | `#11181F` |
| 2 | `SurfaceBrush` | superficie di card e pannelli | `#FFFFFF` | `#1A232C` |
| 3 | `SurfaceAltBrush` | superficie alternata (righe, zone) | `#F8FAFC` | `#212C37` |
| 4 | `SurfaceHoverBrush` | superficie al passaggio del mouse | `#EEF2F7` | `#26333F` |
| 5 | `BorderSoftBrush` | bordo leggero | `#D9E0E8` | `#2C3A47` |
| 6 | `BorderStrongBrush` | bordo marcato, separatori netti | `#B9C4D0` | `#3D4E5E` |
| 7 | `TextPrimaryBrush` | testo principale | `#15202B` | `#EDF2F7` |
| 8 | `TextSecondaryBrush` | testo secondario | `#55636F` | `#B4C0CC` |
| 9 | `TextMutedBrush` | testo attenuato, note | `#7B8794` | `#8A98A6` |
| 10 | `TextOnAccentBrush` | testo sopra l'accento | `#FFFFFF` | `#0B1520` |
| 11 | `AccentBrush` | colore d'accento | `#1565C0` | `#5AA9F0` |
| 12 | `AccentHoverBrush` | accento al passaggio del mouse | `#0D47A1` | `#82C0F7` |
| 13 | `AccentSoftBrush` | accento tenue (sfondo di selezione) | `#E3EEFA` | `#1D3A55` |
| 14 | `PositiveBrush` | valori positivi, guadagni | `#1B7F3B` | `#4ECB71` |
| 15 | `PositiveSoftBrush` | sfondo positivo tenue | `#E4F4E9` | `#15321F` |
| 16 | `NegativeBrush` | valori negativi, perdite | `#B3261E` | `#F27A72` |
| 17 | `NegativeSoftBrush` | sfondo negativo tenue | `#FBE7E5` | `#3A1C1A` |
| 18 | `WarningBrush` | avvisi | `#B26A00` | `#F0B357` |
| 19 | `WarningSoftBrush` | sfondo di avviso | `#FDF1DC` | `#3A2C13` |
| 20 | `InfoBrush` | informazioni | `#1565C0` | `#5AA9F0` |
| 21 | `InfoSoftBrush` | sfondo informativo | `#E3EEFA` | `#1D3A55` |
| 22 | `NeutralBrush` | neutro (etichette, badge) | `#455A64` | `#9FB0BE` |
| 23 | `NeutralSoftBrush` | sfondo neutro | `#ECEFF1` | `#22303C` |
| 24 | `SidebarBrush` | sfondo della barra laterale | `#10202F` | `#0C1319` |
| 25 | `SidebarTextBrush` | testo della barra laterale | `#DCE6EF` | `#DCE6EF` |
| 26 | `SidebarMutedBrush` | testo attenuato della barra laterale | `#8FA3B5` | `#7E8FA0` |
| 27 | `SidebarHoverBrush` | voce della barra laterale sotto il mouse | `#1B3244` | `#182430` |
| 28 | `SidebarActiveBrush` | voce attiva della barra laterale | `#1E4C7A` | `#1E4C7A` |

Non esistono chiavi per ombre, raggi o spaziature: quei valori sono scritti direttamente negli stili di
`Controls.xaml`.

#### 12.7.2 Stili con chiave in `Themes/Controls.xaml` (32)

| # | Chiave | `TargetType` | Base | Ruolo |
|---|---|---|---|---|
| 1 | `PageTitle` | `TextBlock` | — | titolo di pagina |
| 2 | `PageSubtitle` | `TextBlock` | — | sottotitolo di pagina |
| 3 | `SectionTitle` | `TextBlock` | — | titolo di sezione dentro una pagina |
| 4 | `Body` | `TextBlock` | — | testo corrente |
| 5 | `Caption` | `TextBlock` | — | didascalia, note minori |
| 6 | `FieldLabel` | `TextBlock` | — | etichetta di un campo di modulo |
| 7 | `MetricLabel` | `TextBlock` | — | etichetta di una metrica |
| 8 | `MetricValue` | `TextBlock` | — | valore di una metrica |
| 9 | `PrimaryValue` | `TextBlock` | — | valore principale di una card |
| 10 | `Card` | `Border` | — | contenitore card (superficie, bordo, raggio) |
| 11 | `Panel` | `Border` | — | pannello di sezione |
| 12 | `Separator` | `Border` | — | linea di separazione |
| 13 | `BaseButton` | `Button` | — | modello di tutti i pulsanti (template completo con stati) |
| 14 | `PrimaryButton` | `Button` | `BaseButton` | azione principale |
| 15 | `SecondaryButton` | `Button` | `BaseButton` | azione secondaria |
| 16 | `GhostButton` | `Button` | `BaseButton` | azione senza sfondo |
| 17 | `DangerButton` | `Button` | `BaseButton` | azione distruttiva |
| 18 | `InputBox` | `TextBox` | — | campo di testo (template con segnaposto e stato fuoco) |
| 19 | `PasswordBoxStd` | `PasswordBox` | — | campo password con rivelazione |
| 20 | `ComboItemStd` | `ComboBoxItem` | — | voce di elenco a discesa |
| 21 | `ComboStd` | `ComboBox` | — | elenco a discesa (template completo) |
| 22 | `CheckStd` | `CheckBox` | — | casella di spunta |
| 23 | `NavList` | `ListBox` | — | elenco di navigazione (include lo stile implicito di `ListBoxItem`) |
| 24 | `ChipButton` | `Button` | `BaseButton` | pulsante a pillola (filtri rapidi) |
| 25 | `ChipToggle` | `ToggleButton` | — | pillola attivabile/disattivabile |
| 26 | `SummaryValue` | `TextBlock` | — | valore di riepilogo in testata |
| 27 | `GridCellRight` | `TextBlock` | — | cella allineata a destra (importi) |
| 28 | `GridHeader` | `DataGridColumnHeader` | — | intestazione di colonna |
| 29 | `GridHeaderRight` | `DataGridColumnHeader` | `GridHeader` | intestazione allineata a destra |
| 30 | `GridRow` | `DataGridRow` | — | riga della tabella (selezione e hover) |
| 31 | `GridCell` | `DataGridCell` | — | cella della tabella |
| 32 | `DataGridStd` | `DataGrid` | — | tabella completa (griglia, intestazioni, righe) |

Il cambio tema sostituisce il solo dizionario della palette: gli stili non contengono colori letterali.
Le icone delle finestre vengono da `/Assets/FinanceOS.ico` (risorsa incorporata).

### 12.8 Convertitori (elenco completo)

**`Converters/AppConverters.cs` — 10 convertitori, tutti `IValueConverter`.**

| # | Classe | `Convert` | `ConvertBack` |
|---|---|---|---|
| 1 | `InverseBoolToVisibilityConverter` | `true` → `Collapsed`, ogni altro valore → `Visible` | `Visibility.Collapsed` → `true`, altrimenti `false` |
| 2 | `NotEmptyToVisibilityConverter` | `string.IsNullOrWhiteSpace` → `Collapsed`, altrimenti `Visible` | `NotSupportedException` |
| 3 | `CountToVisibilityConverter` | `int` → se stesso, `ICollection` → `Count`, `null` → 0, altro → 1; > 0 → `Visible`, altrimenti `Collapsed`; con parametro stringa `"inverse"` la visibilità è invertita | `NotSupportedException` |
| 4 | `MetricToneToBrushConverter` | `MetricTone.Positive` → `PositiveBrush`, `Negative` → `NegativeBrush`, `Warning` → `WarningBrush`, `Info` → `InfoBrush`, `Neutral` (o valore assente) → `TextPrimaryBrush`; risorsa mancante → `Brushes.Black` | `NotSupportedException` |
| 5 | `AmountToBrushConverter` | `decimal` o `double`: > 0 → `PositiveBrush`, < 0 → `NegativeBrush`, = 0 (o valore assente) → `TextSecondaryBrush`; risorsa mancante → `Brushes.Black` | `NotSupportedException` |
| 6 | `SidebarWidthConverter` | `true` (barra compressa) → `GridLength(66)`, `false` → `GridLength(248)` | `NotSupportedException` |
| 7 | `HexToBrushConverter` | stringa esadecimale → `SolidColorBrush`; vuota, non stringa o non valida (`FormatException`) → `Brushes.Transparent` | `NotSupportedException` |
| 8 | `EnumLabelConverter` | `DomainLabels.Label(value)` (etichetta italiana del valore di dominio) | `NotSupportedException` |
| 9 | `MoneyTextConverter` | `Money` → `MoneyFormatter.Format(money)`; qualsiasi altro valore → stringa vuota | `NotSupportedException` |
| 10 | `DateToTextConverter` | `DateOnly`/`DateTime` → `dd/MM/yyyy` (cultura `it-IT`), `DateTimeOffset` → `dd/MM/yyyy HH:mm` in ora locale, altro → stringa vuota | `NotSupportedException` |

**`Converters/AmountTextConverter.cs` — valore ↔ testo, il `ConverterParameter` sceglie la notazione.**

| `ConverterParameter` | Uso | Scrittura (`Convert`) | Lettura (`ConvertBack`) |
|---|---|---|---|
| `money` | campi importo | `MoneyFormatter.FormatNumber(value)`: raggruppamento delle migliaia, virgola decimale | `AmountNotation.Automatic` (accetta sia la virgola sia il punto, gestisce le migliaia) |
| `qty` | quantità degli strumenti | `MoneyFormatter.FormatQuantity(value)` | `AmountNotation.DecimalSeparator` (il separatore decimale è l'unico separatore ammesso) |
| nessuno oppure `rate` | aliquote, tassi, percentuali (comportamento predefinito) | `value.ToString("N4", MoneyFormatter.Italian)` con zeri finali e virgola finale rimossi (26 · 12,5 · 0,2) | `AmountNotation.DecimalSeparator` |

`Convert`: per un `decimal` restituisce il testo formattato, **tranne** quando il valore è quello appena letto dal
campo che l'utente sta compilando (`ConsumeOwnEdit`): in quel caso restituisce `Binding.DoNothing` e il testo digitato
resta intatto (così «1500.75» non viene riscritto a ogni battuta); qualsiasi altro tipo → stringa vuota.
`ConvertBack`: testo vuoto o solo spazi → `null` se la proprietà di destinazione è annullabile, altrimenti
`Binding.DoNothing` (il valore precedente non viene azzerato a metà digitazione); testo non interpretabile da
`AmountParser.TryParse` → `Binding.DoNothing`; altrimenti il `decimal` letto, memorizzato come `_pendingTypedValue`
perché il successivo `Convert` possa riconoscerlo.

Il motivo del convertitore: i campi numerici WPF usano la lingua dell'elemento (inglese americano), quindi con il solo
convertitore predefinito «12,50» non veniva letto e restava il valore precedente; `AmountParser` accetta invece virgola
e punto.

**`Converters/AmountFieldNormalizer.cs` — normalizzazione all'uscita dal campo.**

`AmountFieldNormalizer.Attach()` viene chiamata **una sola volta** all'avvio e registra un gestore di classe
(`EventManager.RegisterClassHandler` su `TextBox` per `UIElement.LostKeyboardFocusEvent`). Quando un `TextBox`
perde il fuoco, il gestore interviene **solo** se il binding di `TextBox.Text` ha come `Converter` un
`AmountTextConverter` (gli altri campi — nomi, descrizioni, ricerche — non vengono toccati) e chiama
`BindingExpression.UpdateTarget()`, che rilegge il valore e lo riscrive nella forma definitiva («1500.75» diventa
«1.500,75»). Serve perché durante la digitazione il convertitore lascia il testo come viene scritto: riscriverlo a ogni
battuta sposterebbe il cursore a metà digitazione.

---

## 13. Dashboard

### 13.1 Griglia e layout

Griglia a **12 colonne**, altezza del widget in pixel logici (default 220), larghezze predefinite per
dimensione: `Small` 3, `Medium` 4, `Large` 6, `Wide` 8, `Full` 12. `Pack` riempie le righe in ordine di
`SortOrder` senza sovrapposizioni. Modifica: trascinamento, ridimensionamento, rinomina del titolo,
nascondi/mostra, aggiungi widget, salva come nuovo layout, imposta predefinito, elimina layout utente
(i layout `IsBuiltIn` non si eliminano). Persistenza in `DashboardLayouts`/`DashboardWidgets`, layout attivo in
`ui.dashboard.activeLayoutId`.

6 preset creati dal seed (`DashboardPresets.All`, in `DashboardLayoutService`):

| Preset | Descrizione | Widget |
|---|---|---|
| **Panoramica generale** (predefinito) | Vista d'insieme su patrimonio, flussi e obiettivi | 14 |
| **Controllo delle spese** | Dove finiscono i soldi e quanto resta da spendere | 9 |
| **Risparmio** | Quanto risparmio e quanto manca agli obiettivi | 9 |
| **Investimenti** | Composizione, performance e costi del portafoglio | 7 |
| **Patrimonio** | Attività, passività e loro evoluzione | 6 |
| **Analisi avanzata** | Confronti, anomalie e previsioni | 9 |

Ogni preset fissa anche la dimensione dei widget più importanti (`Sizes`); gli altri restano `Medium`.

### 13.2 Tipi di widget (29)

| # | Tipo | Cosa mostra |
|---|---|---|
| 0 | `NetWorth` | patrimonio netto con variazione del periodo |
| 1 | `TotalAccountBalance` | somma dei saldi dei conti |
| 2 | `AvailableLiquidity` | liquidità disponibile senza vendere investimenti |
| 3 | `MonthlyIncome` | entrate del mese |
| 4 | `MonthlyExpenses` | spese del mese |
| 5 | `MonthlyNetSavings` | risparmio netto |
| 6 | `SavingsRate` | tasso di risparmio |
| 7 | `BudgetRemaining` | residuo dei budget attivi |
| 8 | `ExpensesByCategory` | spese per categoria (grafico) |
| 9 | `IncomeBySource` | entrate per categoria |
| 10 | `NetWorthTrend` | andamento mensile del patrimonio |
| 11 | `CashFlowTrend` | entrate/uscite per mese |
| 12 | `MonthComparison` | confronto mese corrente/precedente |
| 13 | `UpcomingRecurring` | prossime scadenze |
| 14 | `Subscriptions` | abbonamenti e costo mensile equivalente |
| 15 | `RecentTransactions` | ultimi movimenti |
| 16 | `TransactionsToClassify` | movimenti senza categoria |
| 17 | `SavingsGoals` | avanzamento degli obiettivi |
| 18 | `EmergencyFund` | copertura del fondo emergenze in mesi |
| 19 | `DebtsAndInstallments` | debiti residui e rate |
| 20 | `PortfolioAllocation` | allocazione del portafoglio |
| 21 | `InvestmentPerformance` | rendimenti (XIRR/TWR) |
| 22 | `DividendsReceived` | dividendi e cedole incassati |
| 23 | `FeesAndTaxes` | commissioni e imposte |
| 24 | `DeadlinesAndReminders` | scadenze e promemoria |
| 25 | `LiquidityForecast` | previsione di liquidità |
| 26 | `UnusualExpenses` | spese anomale |
| 27 | `NetWorthByAssetType` | patrimonio per tipo di attività |
| 28 | `FiscalSummary` | riepilogo fiscale stimato |

Ogni widget: titolo (personalizzabile), descrizione breve, dati usati, periodo e perimetro conti, stato di
caricamento, stato vuoto con invito all'azione (es. «Nessun budget: creane uno»), errore di dati mancanti
(«prezzo non disponibile», «tasso di cambio mancante»).

### 13.3 Periodo, perimetro e approfondimenti

- Il periodo globale (preset o personalizzato) vale per tutti i widget che mostrano intervalli; i widget di
  stato (patrimonio, saldi) usano la data di oggi.
- Perimetro conti: tutti, solo liquidi, esclusi gli interni, selezione manuale; salvato per widget in
  `SettingsJson`.
- **Drill-down**: clic su una categoria apre i movimenti filtrati; clic su una scadenza apre la ricorrenza;
  clic su una posizione apre lo strumento. Il passaggio mantiene periodo e perimetro.
- `DashboardInsights` produce le frasi di sintesi («Questo mese hai speso il 12% in meno…»), sempre calcolate
  e mai inventate: se il confronto non è possibile il testo lo dice.---

## 14. Strumento da riga di comando (`financeos-cli`)

Console `net8.0` che usa gli stessi servizi dell'app (Domain → Data → Integrations), con i dati del profilo
indicato da `FINANCEOS_DATA_DIR`. Uscita leggibile, codici di uscita `0` successo e `1` errore; nessuna
interattività e nessuna finestra.

Il comando è `args[0].ToLowerInvariant()`, con `"help"` quando non ci sono argomenti; uno `switch` lo smista e
un comando sconosciuto stampa l'uso e restituisce `1`. Le opzioni si leggono come coppie `--nome valore`.

| Comando | Effetto |
|---|---|
| `init` | crea le cartelle e applica migrazioni e seed |
| `status` | percorso del database, dimensione, migrazioni applicate/pendenti, numero di conti, movimenti, categorie |
| `seed-demo` | inserisce il dataset dimostrativo |
| `clear-demo` | elimina solo i dati dimostrativi |
| `check` | verifica di integrità (stato database, coerenza saldi, movimenti senza categoria, prezzi mancanti) |
| `report` | genera un report: `--kind` fra `cashflow` (default), `budget`, `networth`, `portfolio`, `recurring`, `goals`, `forecast`, `yoy`; `--format` fra `pdf` (default), `xlsx`, `json`, `csv`; `--days` (default **90**) per la previsione; `--months` (default **12**) per i flussi; `--out` cartella di destinazione (default `Documenti\FinanceOS`) |
| `export` | esporta movimenti o tutti i dati personali (JSON) nella cartella indicata o in `--out` |
| `import` | importa un file CSV con profilo e conto indicati |
| `backup` | crea un backup cifrato `.fosx` (`.db` con l'opzione che disattiva la cifratura) |
| `settings` | legge o imposta un'impostazione (le chiavi di `SecretKeys` vengono cifrate con DPAPI) |
| `ask` | interroga l'assistente locale e stampa la risposta |
| `irpef` | calcola l'IRPEF: importo e anno (default: anno corrente) |
| `help`, `--help`, `-h` | elenco dei comandi |

Le eccezioni sono intercettate: il messaggio in italiano viene stampato senza traccia di stack (che resta nei
log) e il codice di uscita è `1`; `0` significa successo.

---

## 15. Test automatici

Il progetto `tests/FinanceOS.Tests` contiene **21 file `.cs`**: 18 con test e 3 di supporto
(`TestData.cs`, `TestInfrastructure.cs`, `FakeEnableBankingApi.cs`). Gli attributi sono **184 `[Fact]`** e
**8 `[Theory]`** con **52 `[InlineData]`**, cioè **236 casi eseguiti**; l'esecuzione è **non parallela** (le
variabili d'ambiente condivise renderebbero i test instabili). Nessun test tocca i dati reali: si usa
`FINANCEOS_DATA_DIR` su una cartella temporanea, `InMemorySecretProtector` e un clock fisso.

| File | Attributi |
|---|---|
| `AuthenticationTests.cs` | 27 |
| `EnableBankingTests.cs` | 21 |
| `DashboardAnalyticsTests.cs` | 19 |
| `AccountingTests.cs` | 15 |
| `AnalyticsAndSafetyTests.cs` | 12 |
| `PortfolioTests.cs` | 12 |
| `BudgetAndNetWorthTests.cs` | 11 |
| `ImportAndConnectionTests.cs` | 11 |
| `PersistenceTests.cs` | 11 |
| `MoneyAndPeriodTests.cs` | 8 |
| `OnboardingAndDashboardTests.cs` | 8 |
| `ReconciliationTests.cs` | 8 |
| `AmountTextTests.cs` | 7 |
| `EnableBankingSyncTests.cs` | 7 |
| `IrpefTests.cs` | 6 |
| `ExportTests.cs` | 4 |
| `TransactionsRegistryTests.cs` | 4 |
| `DashboardRefreshTests.cs` | 1 |

| Area | Cosa garantiscono |
|---|---|
| Denaro (`Money`, `Decimals`) | aritmetica esatta, rifiuto di valute diverse, `FromMinor/ToMinor` reversibili, arrotondamenti away-from-zero, ripartizione con resto maggiore (somma sempre uguale, anche con importi negativi e pesi sbilanciati) |
| Valute e formati | anagrafica, decimali legali, simboli, formattazione italiana, compatti, percentuali n.d., quantità |
| Lettura importi | notazione italiana e con punto, migliaia, segni, rifiuti in modalità decimale |
| Date e periodi | preset, `LastMonths`, `MonthCount`, sovrapposizioni, `Clamp` |
| Classificazione | trasferimenti, rate, investimenti, categorie, senza categoria, rimborsi |
| Flussi di cassa | trasferimenti mai entrate/spese, volume contato una volta, rimborsi, suddivisioni, dividendi senza doppio conteggio, tassi mancanti |
| Budget | periodi, riporto per modalità, proiezioni, soglie, sottocategorie, perimetro |
| Patrimonio | componenti, esclusione dei conti broker, stime e prezzi vecchi segnalati |
| Portafoglio | media ponderata/FIFO/LIFO, commissioni nel costo, split, dividendi, prezzi mancanti, conversioni |
| Performance | XIRR su casi noti, TWR concatenato, Dietz, CAGR, volatilità, drawdown, risultati «non disponibili» |
| Fisco | scaglioni IRPEF 2023/2024-2025/2026, anno non coperto, stima su plusvalenze e dividendi, riporto minusvalenze |
| Obiettivi e ricorrenze | avanzamento, proiezioni, avanzamento delle date, mesi corti, aumenti, disdette |
| Previsioni | linea di base, scenari, primo giorno negativo |
| Analisi | anomalie, impronta dei duplicati, regole (operatori, precedenza, stop) |
| Sicurezza | hashing e verifica PBKDF2, formati malformati, rehash, protettore di test, `.remember` (payload, nome utente, assenza del file) |
| Backup | struttura `FOSX`, magic errato, versione non supportata, chiave non valida, file incompleto, ripristino con verifica |
| Importazione | profili, rilevamento colonne, importi e date, righe errate, deduplicazione, annullamento del lotto |
| Dati dimostrativi | creazione e cancellazione selettiva |
| Dashboard | impacchettamento a griglia, larghezze, ordine, nessuna sovrapposizione |
| Riconciliazione | differenze, proposte, chiusura |

---

## 16. Build, rilascio e installazione

### 16.1 Compilare

```
$ dotnet restore FinanceOS.sln
$ dotnet build FinanceOS.sln -c Release
$ dotnet test tests/FinanceOS.Tests/FinanceOS.Tests.csproj -c Release
$ dotnet run --project src/FinanceOS.Cli -- status
```

### 16.2 `build-release.ps1`

1. build della soluzione in `Release`; in caso di errore si ferma.
2. test (236 casi); in caso di errore si ferma. Il comando effettivo è `dotnet test FinanceOS.sln -c Release --no-build`.
3. publish **self-contained** `win-x64` per `FinanceOS.App` e per `financeos-cli`, con eseguibili autonomi.
4. riscrittura dell'`appsettings.json` pubblicato in forma **neutra** (senza `UsersDirectory`), così in
   produzione i profili stanno in `%LOCALAPPDATA%\FinanceOS\users`.
5. creazione dello ZIP di distribuzione con eseguibili, `appsettings.json`, icona e file di supporto.
6. chiamata a `install.ps1` e creazione dei collegamenti su Desktop e menu Start.

### 16.3 `install.ps1`

- Copia in `%LOCALAPPDATA%\Programs\FinanceOS` (nessun amministratore, nessuna modifica al sistema).
- Crea i collegamenti «Finance OS» su Desktop e Start.
- `-Uninstall` rimuove programma e collegamenti **senza toccare i dati** (cartella `users` e cartelle dei
  profili restano).
- `Aggiorna-FinanceOS.cmd` richiama lo script di aggiornamento per chi non usa PowerShell a mano.

---

## 17. Convenzioni e regole per una riscrittura fedele

1. **Denaro**: mai `double`/`float`; `long` in 1/10⁴ persistito, `decimal` nei calcoli, `Money` per valuta.
2. **Derivazione**: saldi, spese, patrimonio, plusvalenze e stato dei budget si calcolano; non esistono colonne
   di stato aggiornate a mano.
3. **Classificazione**: passa sempre da `AccountingClassifier`; nessuna schermata decide da sola cosa è spesa.
4. **Suddivisioni**: la somma delle quote è l'importo; ogni motore espande le quote allo stesso modo.
5. **Valute**: nessuna somma silenziosa; tasso mancante → importo escluso e `HasMissingRates`.
6. **Dati mancanti**: `null` + motivo, mai zero o stima non dichiarata.
7. **Eliminazione**: si archivia; le cancellazioni distruttive chiedono conferma esplicita.
8. **Segreti**: solo DPAPI, mai in chiaro, mai nei log, mai negli export.
9. **Audit**: ogni modifica rilevante lascia una voce senza valori sensibili.
10. **Cultura**: `it-IT` per formati, testi e messaggi; identificatori in inglese.
11. **MVVM**: i view model espongono comandi e stato, nessun calcolo di dominio; le viste non contengono logica
    oltre al comportamento visivo.
12. **Migrazioni**: una sola migrazione iniziale; ogni cambiamento futuro è una nuova migrazione, mai una
    modifica di quella esistente.
13. **Enum**: i valori numerici sono persistiti (appendice 19.1): non si riordinano e non si rinumerano.
14. **Chiavi di impostazione**: stabili, prefissate, le segrete elencate in `SecretKeys`.

---

## 18. Checklist di accettazione

- [ ] build `Release` senza errori e 236 casi di test verdi.
- [ ] `FinanceOS.exe --self-check` restituisce `0` e risolve tutte le viste e i view model.
- [ ] Primo avvio senza profili: creazione account, cartella `…\users\<Nome>` creata con note `.md`.
- [ ] Accesso sbagliato → messaggio unico; accesso corretto → database con 104 categorie, 6 layout,
      33 impostazioni predefinite.
- [ ] Onboarding completabile e saltabile; `onboarding.completed` diventa `true`.
- [ ] Movimento di spesa, entrata, trasferimento e movimento suddiviso: i totali di dashboard e budget
      tornano; il trasferimento non appare né come entrata né come spesa.
- [ ] Budget con riporto: residuo = limite + riporto − speso; avviso alla soglia.
- [ ] Acquisto/vendita in portafoglio con prezzo e senza prezzo: la posizione senza prezzo è segnalata e il
      valore di mercato dichiarato incompleto.
- [ ] Patrimonio: i conti broker non sono contati due volte.
- [ ] Import CSV con anteprima, importazione, annullamento del lotto; doppio import dello stesso file non duplica.
- [ ] Backup `.fosx` creato, ripristinato su database nuovo, integrità verificata; copia di sicurezza
      pre-ripristino presente.
- [ ] Export JSON senza impostazioni segrete; cancellazione con frase `ELIMINA TUTTO`.
- [ ] Dashboard: 6 preset, spostamento/ridimensionamento salvati, drill-down con periodo conservato.
- [ ] Movimenti: colonne in pixel, minimo due visibili, menu «⋮» con apertura/duplica/elimina, autosalvataggio 1 s.
- [ ] Tema chiaro/scuro/sistema e accento persistiti.
- [ ] Disconnessione: nessun dato accessibile prima di un nuovo accesso.
- [ ] Log giornaliero presente, senza password né chiavi.
- [ ] CLI: `status`, `seed-demo`, `clear-demo`, `backup`, `irpef` funzionanti.
- [ ] Distribuzione: ZIP con `appsettings.json` neutro; `install.ps1` installa e disinstalla senza toccare i dati.

---

## 19. Appendici

### 19.1 Enumerazioni e valori numerici

| Enum | Valori |
|---|---|
| `AccountType` | Checking 0, Savings 1, Deposit 2, DebitCard 3, CreditCard 4, Cash 5, Broker 6, DigitalWallet 7, Investment 8, Custom 9 |
| `AccountNature` | Asset 0, Liability 1 |
| `CategoryKind` | Income 0, Expense 1, Transfer 2, Investment 3, Debt 4, Tax 5, Fee 6, Other 7 |
| `TransactionStatus` | Draft 0, Confirmed 1, Cancelled 2, Reconciled 3 |
| `TransactionSource` | Manual 0, CsvImport 1, Api 2, Recurring 3, BrokerImport 4, AiSuggestion 5, Demo 6 |
| `RecurrenceFrequency` | Daily 0, Weekly 1, Biweekly 2, Monthly 3, Bimonthly 4, Quarterly 5, Semiannual 6, Annual 7, Custom 8 |
| `RecurringStatus` | Active 0, Paused 1, Ended 2 |
| `BudgetPeriodType` | Weekly 0, Monthly 1, Quarterly 2, Annual 3, Custom 4 |
| `RolloverMode` | None 0, PositiveOnly 1, Full 2 |
| `GoalType` | Savings 0, EmergencyFund 1, Purchase 2, DebtPayoff 3, Custom 4 |
| `AssetKind` | Property 0, Vehicle 1, Collectible 2, Business 3, Receivable 4, Other 5 |
| `LiabilityKind` | Mortgage 0, Loan 1, CreditCardDebt 2, Installment 3, Overdraft 4, TaxDebt 5, Other 6 |
| `SecurityType` | Stock 0, Etf 1, Bond 2, Fund 3, MoneyMarket 4, Crypto 5, Commodity 6, Cash 7, Other 8 |
| `InvestmentTransactionType` | Buy 0, Sell 1, Dividend 2, Coupon 3, Fee 4, Tax 5, Deposit 6, Withdrawal 7, Split 8, TransferIn 9, TransferOut 10, Interest 11 |
| `CostBasisMethod` | WeightedAverage 0, Fifo 1, Lifo 2 |
| `PriceSourceKind` | Manual 0, CsvImport 1, Provider 2, Broker 3, DerivedCarryForward 4 |
| `ExchangeRateSourceKind` | Manual 0, EuropeanCentralBank 1, Provider 2, CsvImport 3, Identity 4 |
| `IntegrationKind` | Bank 0, Broker 1, MarketData 2, Ai 3 |
| `IntegrationStatus` | NotConfigured 0, Demo 1, PendingAuthorization 2, Connected 3, Expired 4, Error 5, Revoked 6 |
| `IntegrationEnvironment` | Sandbox 0, Production 1 |
| `SyncRunStatus` | Running 0, Succeeded 1, PartiallySucceeded 2, Failed 3, RateLimited 4 |
| `NotificationSeverity` | Info 0, Success 1, Warning 2, Critical 3 |
| `NotificationKind` | BudgetThreshold 0, BudgetExceeded 1, RecurringUpcoming 2, RecurringPriceIncrease 3, RecurringMissing 4, GoalReached 5, GoalAtRisk 6, SyncFailed 7, ConsentExpiring 8, AnomalyDetected 9, ReconciliationMismatch 10, BackupReminder 11, Informational 12 |
| `WidgetType` | NetWorth 0, TotalAccountBalance 1, AvailableLiquidity 2, MonthlyIncome 3, MonthlyExpenses 4, MonthlyNetSavings 5, SavingsRate 6, BudgetRemaining 7, ExpensesByCategory 8, IncomeBySource 9, NetWorthTrend 10, CashFlowTrend 11, MonthComparison 12, UpcomingRecurring 13, Subscriptions 14, RecentTransactions 15, TransactionsToClassify 16, SavingsGoals 17, EmergencyFund 18, DebtsAndInstallments 19, PortfolioAllocation 20, InvestmentPerformance 21, DividendsReceived 22, FeesAndTaxes 23, DeadlinesAndReminders 24, LiquidityForecast 25, UnusualExpenses 26, NetWorthByAssetType 27, FiscalSummary 28 |
| `WidgetSize` | Small 0, Medium 1, Large 2, Wide 3, Full 4 |
| `RuleMatchField` | Description 0, Payee 1, Amount 2, AccountId 3, CategoryId 4, Tags 5, TransactionSource 6, Counterparty 7 |
| `RuleOperator` | Contains 0, NotContains 1, Equals 2, StartsWith 3, EndsWith 4, Regex 5, GreaterThan 6, LessThan 7, Between 8, IsEmpty 9, IsNotEmpty 10 |
| `ThemePreference` | Light 0, Dark 1, FollowSystem 2 |
| `ExperienceMode` | Simple 0, Advanced 1 |
| `AuditAction` | Create 0, Update 1, Delete 2, Import 3, Export 4, Login 5, SettingsChange 6, Backup 7, Restore 8, SecureAccess 9 |
| `PeriodGranularity` | Day 0, Week 1, Month 2, Quarter 3, Year 4, Custom 5 |
| `PeriodPreset` | CurrentMonth 0, PreviousMonth 1, Last3Months 2, Last6Months 3, YearToDate 4, CurrentYear 5, PreviousYear 6, Last12Months 7, All 8, Custom 9 |
| `AmountNotation` | Automatic 0, DecimalSeparator 1 |
| `FlowClass` | Income, Expense, FinancialCost, DebtInterest, DebtPrincipal, Refund, InvestmentBuy, InvestmentSell, InternalTransfer, Unclassified |

### 19.2 Impostazioni predefinite create dal seed (33)

`onboarding.completed = false`; `profile.baseCurrency = EUR`; `profile.country = IT`; `profile.locale = it-IT`;
`profile.dateFormat = dd/MM/yyyy`; `profile.fiscalMonthStartDay = 1`; `profile.experienceMode = Simple`;
`profile.dataMode = Local`; `ui.theme = FollowSystem`; `ui.accentColor = #1565C0`; `ui.window.width = 1440`;
`ui.window.height = 900`; `security.autoLockEnabled = false`; `security.autoLockMinutes = 15`;
`security.backupOnExit = false`; `security.encryptBackups = true`;
`portfolio.costBasisMethod = WeightedAverage`; `portfolio.includeFeesInCostBasis = true`;
`portfolio.stalePriceDays = 7`; `fiscal.generalRate = 0,26`; `fiscal.governmentBondRate = 0,125`;
`fiscal.lossCarryForwardYears = 4`; `fiscal.stampDutyRate = 0,002`; `budget.defaultAlertThreshold = 80`;
`budget.defaultRolloverMode = None`; `categories.maxDepth = 3`; `ai.enabled = false`;
`ai.remoteProcessingConsent = false`; `ai.sendAggregatedOnly = true`; `privacy.telemetryEnabled = false`;
`system.installId` (GUID nuovo); `system.firstRunAtUtc` (adesso, ISO 8601); `system.schemaVersion = 1`.

### 19.3 Schema del database in sintesi

30 tabelle: `Accounts`, `BalanceReconciliations`, `Transactions`, `TransactionSplits`, `Attachments`,
`Categories`, `Rules`, `RuleConditions`, `Budgets`, `BudgetAllocations`, `BudgetPeriods`,
`RecurringTransactions`, `RecurringAmountChanges`, `SavingsGoals`, `Assets`, `Liabilities`, `Securities`,
`InvestmentTransactions`, `PortfolioPositions`, `Dividends`, `MarketPrices`, `ExchangeRates`, `Integrations`,
`SyncRuns`, `DashboardLayouts`, `DashboardWidgets`, `Notifications`, `AuditEvents`, `AppSettings`,
`ImportBatches`. Unica migrazione: `20261012131051_InitialCreate`.

### 19.4 Mappa dei file (riferimento rapido)

| Cartella | Contenuto |
|---|---|
| `src/FinanceOS.Domain/Common` | Money, Decimals, CurrencyCode, MoneyFormatter, MoneyMath, DateRange, AmountParser, CategoryKey, IClock |
| `src/FinanceOS.Domain/Accounting` | FlowClass, AccountingClassifier, CashFlowEngine, AccountBalanceCalculator, LedgerSnapshot, CurrencyConverter, ReconciliationAdvisor |
| `src/FinanceOS.Domain/Analytics` | AnomalyDetector, DuplicateDetector, RuleEngine |
| `src/FinanceOS.Domain/Budgeting` | BudgetEngine |
| `src/FinanceOS.Domain/Dashboard` | DashboardPeriods, AccountScope, CashFlowTimeline, ComparisonDelta, NetWorthTrend, SpendingBreakdown, BudgetPlan, ScopedMetrics, FinancialCalendar |
| `src/FinanceOS.Domain/Entities` | Accounts, Transactions, Categories, Budgeting, Recurring, Goals, NetWorth, Investments, Platform, Enums |
| `src/FinanceOS.Domain/Forecasting` | ForecastEngine |
| `src/FinanceOS.Domain/Goals` | GoalEngine |
| `src/FinanceOS.Domain/NetWorth` | NetWorthEngine |
| `src/FinanceOS.Domain/Portfolio` | PortfolioEngine, PerformanceCalculator, FiscalItalyEstimator |
| `src/FinanceOS.Domain/Protection` | CsvSanitizer |
| `src/FinanceOS.Domain/Recurring` | RecurrenceEngine |
| `src/FinanceOS.Domain/Seed` | DefaultCategoryTree, DeterministicGuid, DashboardPresets |
| `src/FinanceOS.Domain/Settings` | AppSettingKeys |
| `src/FinanceOS.Domain/Tax` | IrpefCalculator |
| `src/FinanceOS.Data` | AppPaths, FinanceOsDbContext, DatabaseInitializer, ExchangeRateTableProvider, LedgerLoader, DependencyInjection, DesignTimeDbContextFactory |
| `src/FinanceOS.Data/Auth` | AuthService, PasswordHasher, UserAccount |
| `src/FinanceOS.Data/Protection` | SecretProtector (DPAPI e di test) |
| `src/FinanceOS.Data/Services` | Account, Transaction, Category, Ledger, Planning, PortfolioData, Reconciliation, DashboardLayout, Notification, Settings, Backup + PersonalData, DemoData, AuditSaveChangesInterceptor |
| `src/FinanceOS.Data/Migrations` | `20261012131051_InitialCreate` |
| `src/FinanceOS.Integrations/Ai` | AssistantService |
| `src/FinanceOS.Integrations/Banking` | BankContracts, BankSyncService, DemoBankConnector, GoCardlessBankDataConnector, EnableBanking |
| `src/FinanceOS.Integrations/Import` | CsvImportModels, CsvImportProfiles, CsvImportService |
| `src/FinanceOS.Integrations/MarketData` | MarketDataService |
| `src/FinanceOS.Integrations/Reporting` | ReportModels, ReportBuilder, ExportService |
| `src/FinanceOS.App` | Program, App, Converters, Services, ViewModels, Views, Themes, Assets, appsettings.json |
| `src/FinanceOS.Cli` | Program |
| `tests/FinanceOS.Tests` | 21 file `.cs` (18 con test, 3 di supporto), 236 casi di test |
| radice | `Directory.Build.props`, `Directory.Packages.props`, `FinanceOS.sln`, `build-release.ps1`, `install.ps1`, `Aggiorna-FinanceOS.cmd`, documentazione |

---

*Documento derivato dalla lettura diretta del codice della versione `1.0.0-alpha.1`. Dove la documentazione
precedente del progetto diverge dal codice, vale il codice. Nessuna credenziale e nessun dato personale è
riportato.*