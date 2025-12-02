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
- 🏆 **Podium & Konfetti** - Feierliches Spielende

## Schnellstart

```bash
# Abhängigkeiten installieren
uv sync

# Server starten
uv run python main.py
```

Der Server startet auf `http://localhost:8000`.

## Verwendung

1. **Host:** Öffne `http://localhost:8000/host` auf dem Beamer/Präsentationsgerät
2. **Spieler:** Öffnen `http://localhost:8000` auf ihren Handys
3. Wähle ein Quiz aus und teile den Spiel-Code mit den Spielern
4. **(Optional) Team-Modus:** Aktiviere den Team-Modus, konfiguriere Teams und lege fest, wie viele Top-Spieler pro Team zählen
5. Spieler treten bei und wählen ggf. ihr Team aus
6. Sobald alle beigetreten sind, starte das Spiel!

### Team-Modus
Der Host kann den Team-Modus in der Lobby aktivieren und Teams konfigurieren:
- Definiere beliebige Team-Namen (z.B. "Team Rot, Team Blau, Team Grün")
- Lege fest, wie viele Top-Spieler pro Team zur Teamwertung beitragen (z.B. Top 3)
- Spieler wählen beim Beitritt ihr Team aus
- Am Ende werden sowohl Team- als auch Einzelrankings angezeigt

Siehe [TEAM_MODE_README.md](TEAM_MODE_README.md) für weitere Details.

## Technologie-Stack

- **Backend:** Python 3.11+, FastAPI, python-socketio
- **Frontend:** Vanilla HTML/CSS/JS
- **Font:** Fredoka (Google Fonts)
