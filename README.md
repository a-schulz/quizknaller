# QuizKnaller 💥

**Wissen macht BUMM!** - Ein Multiplayer-Quiz das einschlägt!

Ein Kahoot-ähnliches Quiz-Spiel mit einer mobil-optimierten Spieleransicht und einer beamer-optimierten Host-Ansicht.

## Features

- 🎮 **Echtzeit-Multiplayer** via WebSockets
- 📱 **Mobile-optimierte Spieleransicht** - Touch-freundlich mit großen Buttons
- 🖥️ **Beamer-optimierte Host-Ansicht** - Große Schrift, lebhafte Farben, Leaderboard
- ⏱️ **Zeitbasiertes Punktesystem** - Schnellere Antworten = mehr Punkte
- 🔥 **Streak-Bonus** - Belohnungen für aufeinanderfolgende richtige Antworten
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
4. Sobald alle beigetreten sind, starte das Spiel!

## Technologie-Stack

- **Backend:** Python 3.11+, FastAPI, python-socketio
- **Frontend:** Vanilla HTML/CSS/JS
- **Font:** Fredoka (Google Fonts)
