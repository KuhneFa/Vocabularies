# Karteikasten

Selbst gehostete Vokabel-App: Karteikarten mit Bild und Audio, Lernen nach dem Karteikasten-Prinzip,
offline nutzbar auf iPhone, Mac und Laptop. Läuft auf dem NUC zu Hause.

- Entscheidungen und Architektur: [docs/entscheidungen.md](docs/entscheidungen.md)
- Klickbarer Mock: [mock/index.html](mock/index.html)

## Entwickeln

Voraussetzung: Node.js 22.17 oder neuer.

```sh
npm install
cp .env.example .env   # dann APP_PASSWORD setzen
npm run dev            # http://localhost:5173
```

Zum Testen auf dem iPhone im selben WLAN: `npm run dev -- --host`, dann die angezeigte Netzwerk-Adresse öffnen.

## Tests

```sh
npm test         # Unit- und Integrationstests (Vitest)
npm run check    # Typprüfung
```

## Datenbank

SQLite unter `data/vokabeln.db`, Zugriff über Drizzle. Schema: `src/lib/server/db/schema.ts`.

Nach einer Schema-Änderung die Migration erzeugen und mit einchecken:

```sh
npx drizzle-kit generate --name <was-sich-geändert-hat>
```

Migrationen laufen beim Start der App automatisch.
