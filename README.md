# ToolBox

Cassetta degli attrezzi digitale pubblicabile su **GitHub Pages**.

Strumenti disponibili:

- **Generatore QR** — crea un codice QR da un link e lo scarica in PNG
- **Countdown** — inserisci un orario e conta fino a quel momento
- **Foto → PDF** — carica foto e genera un PDF con un’immagine per pagina

## Anteprima locale

Apri `index.html` nel browser, oppure da terminale:

```bash
# Python
python -m http.server 5500

# oppure Node
npx serve .
```

Poi visita `http://localhost:5500`.

## Pubblicare su GitHub Pages

1. Crea un repository su GitHub (es. `ToolBox`).
2. Carica questi file sul branch `main` (o `master`).
3. Su GitHub: **Settings → Pages**.
4. In **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` / `(root)`
5. Salva e attendi qualche minuto.

Il sito sarà disponibile su:

`https://<tuo-username>.github.io/ToolBox/`

> Se il repository non si chiama `ToolBox`, sostituisci il nome nell’URL.

## Struttura

```
ToolBox/
├── index.html          # Home
├── tools/
│   ├── qr.html         # Generatore QR
│   ├── countdown.html  # Countdown orario
│   └── foto-pdf.html   # Foto → PDF
├── assets/
│   ├── styles.css
│   ├── nav.js
│   ├── qr.js
│   ├── countdown.js
│   └── foto-pdf.js
└── README.md
```

## Aggiungere nuovi strumenti

1. Crea una pagina in `tools/` (es. `tools/nuovo.html`).
2. Aggiungi il link nella lista su `index.html`.
