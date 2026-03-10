# QuizKnaller 💥

**Wissen macht BUMM!** - Ein Multiplayer-Quiz das einschlägt!

Ein Kahoot-ähnliches Quiz-Spiel mit einer mobil-optimierten Spieleransicht und einer beamer-optimierten Host-Ansicht.

## Features

- 🎮 **Echtzeit-Multiplayer** via WebSockets
- 📱 **Mobile-optimierte Spieleransicht** - Touch-freundlich mit großen Buttons
- 🖥️ **Beamer-optimierte Host-Ansicht** - Große Schrift, lebhafte Farben, Leaderboard
- ⏱️ **Zeitbasiertes Punktesystem** - Schnellere Antworten = mehr Punkte
- 🔥 **Streak-Bonus** - Belohnungen für aufeinanderfolgende richtige Antworten
- 👥 **Team-Modus** - Spieler können in Teams gegeneinander antreten
- 🏅 **Flexible Team-Wertung** - Host konfiguriert, wie viele Top-Spieler pro Team zählen
- ▶️ **Autoplay-Modus** - Automatisches Durchlaufen der Fragen für nahtloses Spiel
- 🗑️ **Auto-Remove Inactive Users** - Automatisches Entfernen inaktiver Spieler
- 🎄 **Weihnachtsquiz** - Spezielles Quiz mit 15 Weihnachtsfragen
- 🏆 **Podium & Konfetti** - Feierliches Spielende
- 💾 **SQLite Persistenz** - Spieldaten werden in Datenbank gespeichert
- 🔄 **Reconnect-Funktion** - Spieler können nach Verbindungsabbruch wieder einsteigen
- 🔁 **Quizwechsel ohne neuen Code** - Host kann in derselben Session ein neues Quiz wählen, Spieler bleiben verbunden

## Schnellstart (Lokal)

```bash
# Abhängigkeiten installieren
uv sync

# Server starten
uv run python main.py
```

Der Server startet auf `http://localhost:8000`.

## Deployment auf Netcup

**Live:** https://rubberducking.ninja

```bash
# Deployment-Paket hochladen
./upload_to_netcup.sh

# Dann auf dem Server entpacken
ssh hosting181513@202.61.232.187
cd rubberducking.ninja
rm -rf quizknaller
unzip quizknaller.zip
rm quizknaller.zip
exit
```

Anschließend in Netcup WCP → Python-App → "Neuladen" klicken.

Siehe [NETCUP_DEPLOYMENT.md](NETCUP_DEPLOYMENT.md) für Details.

## Verwendung

1. **Host:** Öffne `http://localhost:8000/host` auf dem Beamer/Präsentationsgerät
2. **Spieler:** Öffnen `http://localhost:8000` auf ihren Handys
3. Wähle ein Quiz aus (z.B. das neue Weihnachtsquiz 🎄)
4. **(Optional) Team-Modus:** Aktiviere den Team-Modus, konfiguriere Teams und lege fest, wie viele Top-Spieler pro Team zählen
5. **(Optional) Auto-Remove:** Aktiviere das automatische Entfernen inaktiver Spieler in den Einstellungen
6. **(Optional) Autoplay:** Aktiviere "Automatisch zur nächsten Frage" für nahtloses Durchlaufen
7. Spieler treten bei und wählen ggf. ihr Team aus
8. Sobald alle beigetreten sind, starte das Spiel!

### Autoplay-Modus
Der Host kann den Autoplay-Modus aktivieren:
- Checkbox in der Lobby aktivieren
- Nach jeder Frage wird automatisch nach 5 Sekunden zur nächsten Frage gewechselt
- Ideal für flüssige Quizabende ohne manuelle Steuerung

### Team-Modus
Der Host kann den Team-Modus in der Lobby aktivieren und Teams konfigurieren:
- Definiere beliebige Team-Namen (z.B. "Team Rot, Team Blau, Team Grün")
- Lege fest, wie viele Top-Spieler pro Team zur Teamwertung beitragen (z.B. Top 3)
- Spieler wählen beim Beitritt ihr Team aus
- Am Ende werden sowohl Team- als auch Einzelrankings angezeigt

Siehe [TEAM_MODE_README.md](TEAM_MODE_README.md) für weitere Details.

### Auto-Remove Inactive Users
Der Host kann das automatische Entfernen inaktiver Spieler aktivieren:
- Öffne die Einstellungen (⚙️ Teams/Einstellungen) in der Lobby
- Aktiviere "Inaktive Spieler automatisch entfernen"
- Lege fest, nach wie vielen Fragen ohne Antwort ein Spieler als inaktiv gilt (1-10 Fragen, Standard: 3)
- Inaktive Spieler werden automatisch nach jeder Frage entfernt, wenn sie die konfigurierte Anzahl aufeinanderfolgender Fragen nicht beantwortet haben
- Ideal, um Spieler zu entfernen, die die Verbindung verloren haben oder das Quiz-Tab offen gelassen haben

## Technologie-Stack

- **Backend:** Python 3.11+, FastAPI, python-socketio
- **Frontend:** Vanilla HTML/CSS/JS
- **Font:** Fredoka (Google Fonts)
