# Vokabel-App: Entscheidungen

Stand: 1. November 2026. Der klickbare Mock liegt in [mock/index.html](../mock/index.html).

## Ziel

Eine eigene Karteikarten-App für Vokabeln, die auf dem NUC zu Hause läuft und auf iPhone, MacBook und Arbeitslaptop nutzbar ist.

## Lernlogik

- Nach dem Umdrehen gibt es zwei Bewertungen: **Richtig** und **Falsch**.
- Karteikasten mit den Fächern Neu und 1 bis 5. Richtig schiebt eine Karte ein Fach weiter, Falsch schickt sie zurück in Fach 1.
- Abfrageabstand pro Fach: 1, 2, 4, 8 und 16 Tage.
- Eine Karte, die in einer Runde falsch war, kommt in derselben Runde noch einmal und bleibt danach in Fach 1.

## Inhalte einer Karte

- Vorder- und Rückseite mit Text.
- **Pro Seite** ein Bild und ein Audio:
  - Bild aus der Mediathek oder direkt mit der Kamera aufgenommen,
  - Audio direkt in der App aufgenommen oder als Datei hochgeladen.
- Bilder werden beim Speichern verkleinert. Audio bleibt im Originalformat, auf dem iPhone ist das m4a.

## Design

- Tagmodus in Weiß und Grün, Nachtmodus in Schwarz-Grün.
- Ohne eigene Wahl folgt die App dem System. Die Wahl über den Umschalter wird pro Gerät gespeichert.

## Architektur

**Stufe 1: nur im Heimnetz erreichbar** (wird zuerst gebaut)

- **PWA, offline-first:** Die App wird einmal zu Hause auf jedem Gerät installiert und läuft danach überall offline.
- **Abgleich** mit dem NUC, sobald das Gerät im Heimnetz ist. Neue App-Versionen kommen dabei mit.
- **Stack:**
  - SvelteKit (TypeScript)
  - Server: SQLite mit Drizzle
  - Geräte: IndexedDB mit Dexie
- **Abgleich ohne Konflikte:**
  - Jede Antwort ist ein Eintrag im Review-Log, der nur angehängt wird.
  - Das Fach einer Karte berechnet der Server aus diesem Log.
  - IDs werden auf dem Gerät erzeugt, damit offline angelegte Karten nicht kollidieren.
- **Medien:**
  - Dateien liegen unter `/data/media/`, in der Datenbank steht nur der Pfad.
  - Auf den Geräten werden sie für die Offline-Nutzung zwischengespeichert.
- **Hosting:**
  - NUC → Proxmox → Ubuntu-VM → Docker Compose.
  - Alle Daten liegen in einem Ordner `/data` (`vokabeln.db` und `media/`).
- **Adresse und HTTPS:**
  - `https://vokabeln.<domain>` zeigt per DNS auf die interne IP des NUC.
  - Das Zertifikat kommt von Let's Encrypt über eine DNS-Prüfung. Dafür muss der NUC von außen nicht erreichbar sein.
  - Ohne HTTPS lässt sich die PWA nicht offline installieren.
- **Backup:** Ein Backup-Job in Proxmox sichert die VM regelmäßig. In der App gibt es dafür nichts Eigenes.
- **Login:**
  - Auch im Heimnetz, damit Gäste und andere Geräte im WLAN nicht an die App kommen.
  - Ein Benutzer, das Passwort steht in `APP_PASSWORD`.
  - Eine Anmeldung gilt 90 Tage pro Gerät und verlängert sich bei Nutzung.
  - Nach 5 Fehlversuchen ist der Login 15 Minuten gesperrt.
  - Zusätzlich gehören Gäste und smarte Geräte ins Gäste-WLAN des Routers.
- **Entwicklung:** direkt auf dem MacBook. Das Docker-Image wird in der CI unter Linux gebaut und getestet.

**Stufe 2: von überall erreichbar** (später, optional)

- **Cloudflare Tunnel:** Ein `cloudflared`-Container auf dem NUC baut den Tunnel nach außen auf. Am Router wird kein Port geöffnet.
- **Cloudflare Access als Login:** Anmeldung per E-Mail-Code, bis zu einen Monat gültig. Nur die eigene E-Mail-Adresse ist freigeschaltet.
- **Folgen für die App:**
  - Der NUC nimmt dann nur noch Verbindungen über den Tunnel an. So schützt Access auch zu Hause jeden Zugriff, denn Cloudflare prüft nur, was über Cloudflare läuft.
  - Der App-Login bleibt als zweite Absicherung.
  - Ist die Anmeldung abgelaufen, zeigt die App „Bitte neu anmelden“. Lernen geht offline weiter.
- **Bewusster Kompromiss:** Cloudflare entschlüsselt den Verkehr. Als Alternative mit mehr Privatsphäre bleibt Tailscale Funnel. Dann bräuchte die App aber einen eigenen Login, zum Beispiel per Passkey.

## Tests und Auslieferung

- **Unit- und Integrationstests mit Vitest:** Karteikasten-Logik, Abgleich und API-Routen gegen eine frische SQLite-Datenbank, einschließlich der Migrationen.
- **End-to-End mit Playwright:**
  - auch mit WebKit, der Safari-Engine, in iPhone-Größe,
  - Stapel und Karten anlegen, Lernrunde,
  - offline lernen und danach abgleichen.
- **Manuell auf dem iPhone:** Kamera und Mikrofon.
- **Auslieferung:**
  1. GitHub Actions führt bei jedem Push Typecheck und Tests aus.
  2. Ist `main` grün, wird ein Docker-Image gebaut und in der GitHub Container Registry abgelegt.
  3. Auf der VM prüft ein Timer regelmäßig auf ein neues Image und startet es. Dafür ist kein Zugang von außen nötig.
  4. Ein Rollback heißt: das vorherige Image starten.

## Bewusst nicht in Version 1

- Statistik und Aktivitätsübersicht
- Anki-Import
- mehrere Benutzer

## Offene Punkte

- [ ] **Domain kaufen.** Empfehlung: bei Cloudflare, dann passt sie direkt zu Stufe 2 und das automatische Zertifikat funktioniert. `.de` gibt es dort nicht.
- [ ] **Telekom-Router (Speedport):**
  - Prüfen, ob er Adressen blockiert, die auf interne IPs zeigen (DNS-Rebind-Schutz).
  - Plan B: ein kleiner DNS-Server auf dem NUC, zum Beispiel AdGuard Home.
- [ ] **Arbeitslaptop:**
  - Erreicht er zu Hause trotz Firmen-VPN den NUC?
  - Test: die Proxmox-Oberfläche unter `https://<IP-vom-NUC>:8006` öffnen.
  - Auch der Firmen-DNS könnte Adressen blockieren, die auf interne IPs zeigen. Lernen geht offline in jedem Fall, nur der Abgleich hängt davon ab.
- [ ] **Ubuntu-VM** in Proxmox anlegen und Docker installieren.
