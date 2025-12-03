"""
QuizKnaller - Wissen macht BUMM! 💥
Ein Multiplayer-Quiz das einschlägt!
"""

import sys
import os

# Add site-packages to path (for bundled dependencies on Netcup)
app_dir = os.path.dirname(os.path.abspath(__file__))
site_packages = os.path.join(app_dir, 'site-packages')
if os.path.exists(site_packages) and site_packages not in sys.path:
    sys.path.insert(0, site_packages)

import asyncio
import io
import json
import uuid
from pathlib import Path

import qrcode
import socketio
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import database as db

# Create Socket.IO server
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="QuizKnaller", description="Wissen macht BUMM! 💥")
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Initialize database
db.init_db()

# In-memory cache for active games (with database persistence)
games: dict[str, dict] = {}

# Track pending host disconnection cleanup tasks
host_disconnect_tasks: dict[str, asyncio.Task] = {}

# Configuration
HOST_RECONNECT_GRACE_PERIOD = 60  # seconds to wait before ending game after host disconnect

# Load quiz data
QUIZ_FILE = Path(__file__).parent / "quizzes.json"


def load_quizzes() -> list[dict]:
    if QUIZ_FILE.exists():
        with open(QUIZ_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def generate_game_code() -> str:
    """Generate a 6-character game code."""
    return str(uuid.uuid4())[:6].upper()


# Serve static files
static_path = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_path), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the player (mobile) interface."""
    return FileResponse(static_path / "player.html")


@app.get("/host", response_class=HTMLResponse)
async def host():
    """Serve the host (beamer) interface."""
    return FileResponse(static_path / "host.html")


@app.get("/api/qrcode")
async def get_qrcode(request: Request, code: str):
    """Generate a QR code for the game join URL."""
    # Get the base URL from the request
    base_url = f"{request.url.scheme}://{request.headers.get('host', 'localhost:8080')}"
    join_url = f"{base_url}/?code={code}"
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(join_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="#2D3436", back_color="white")
    
    # Save to bytes buffer
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")


@app.get("/api/quizzes")
async def get_quizzes():
    """Get available quizzes."""
    quizzes = load_quizzes()
    return [{"id": i, "title": q["title"], "questionCount": len(q["questions"])} for i, q in enumerate(quizzes)]


# Socket.IO events
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


def sync_game_to_db(game_code: str):
    """Sync in-memory game state to database."""
    if game_code not in games:
        return
    
    game = games[game_code]
    db.update_game(
        game_code,
        host_sid=game["host_sid"],
        current_question=game["current_question"],
        state=game["state"],
        team_mode=game["team_mode"],
        teams=game["teams"],
        top_n_players=game["top_n_players"]
    )


def load_game_from_db(game_code: str) -> bool:
    """Load game from database into memory."""
    game_data = db.get_game(game_code)
    if not game_data:
        return False
    
    # Load players
    players_data = db.get_players(game_code)
    players = {}
    for p in players_data:
        players[p["session_id"]] = {
            "name": p["name"],
            "score": p["score"],
            "team": p["team"],
            "streak": 0,  # Reset streak on load
        }
    
    games[game_code] = {
        "host_sid": game_data["host_sid"],
        "quiz": game_data["quiz"],
        "players": players,
        "current_question": game_data["current_question"],
        "state": game_data["state"],
        "answers": {},
        "question_start_time": None,
        "team_mode": game_data["team_mode"],
        "teams": game_data["teams"],
        "top_n_players": game_data["top_n_players"],
    }
    
    return True


@sio.event
async def reconnect_host(sid, data):
    """Host reconnects to their game."""
    game_code = data.get("code")
    
    # Try to load from database if not in memory
    if game_code not in games:
        if not load_game_from_db(game_code):
            await sio.emit("reconnect_failed", {"message": "Spiel nicht gefunden"}, to=sid)
            return
    
    game = games[game_code]
    old_host_sid = game["host_sid"]
    
    # Cancel any pending cleanup task
    if game_code in host_disconnect_tasks:
        print(f"Host reconnected to game {game_code}, cancelling cleanup task")
        host_disconnect_tasks[game_code].cancel()
        del host_disconnect_tasks[game_code]
    
    # Clear disconnected flag
    game["host_disconnected"] = False
    
    # Update host SID
    game["host_sid"] = sid
    db.update_game(game_code, host_sid=sid)
    await sio.enter_room(sid, game_code)
    
    # Notify players that host is back
    await sio.emit("host_reconnected", {
        "message": "Der Host ist wieder verbunden!"
    }, room=game_code)
    
    # Send current game state to host
    await sio.emit("reconnected_host", {
        "code": game_code,
        "quiz_title": game["quiz"]["title"],
        "state": game["state"],
        "current_question": game["current_question"],
        "players": [{"name": p["name"], "score": p["score"], "team": p["team"]} for p in game["players"].values()],
        "team_mode": game["team_mode"],
        "teams": game["teams"],
    }, to=sid)


@sio.event
async def reconnect_player(sid, data):
    """Player reconnects to their game."""
    game_code = data.get("code")
    player_name = data.get("name")
    
    # Try to load from database if not in memory
    if game_code not in games:
        if not load_game_from_db(game_code):
            await sio.emit("reconnect_failed", {"message": "Spiel nicht gefunden"}, to=sid)
            return
    
    game = games[game_code]
    
    # Find player by name
    old_sid = None
    for player_sid, player in game["players"].items():
        if player["name"].lower() == player_name.lower():
            old_sid = player_sid
            break
    
    if old_sid is None:
        await sio.emit("reconnect_failed", {"message": "Spieler nicht gefunden"}, to=sid)
        return
    
    # Transfer player data to new SID
    player_data = game["players"][old_sid]
    del game["players"][old_sid]
    game["players"][sid] = player_data
    
    # Update database
    db.update_player_session(game_code, player_name, sid)
    
    # Transfer answer if exists
    if old_sid in game["answers"]:
        game["answers"][sid] = game["answers"][old_sid]
        del game["answers"][old_sid]
    
    await sio.enter_room(sid, game_code)
    
    # Send current game state
    await sio.emit("reconnected_player", {
        "code": game_code,
        "quiz_title": game["quiz"]["title"],
        "state": game["state"],
        "score": player_data["score"],
        "team": player_data["team"],
        "team_mode": game["team_mode"],
        "teams": game["teams"],
    }, to=sid)


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
    # Mark player as disconnected in database
    db.set_player_connected(sid, False)
    
    # Find which game this player was in and notify the host
    for game_code, game in list(games.items()):
        if sid in game["players"]:
            player_name = game["players"][sid]["name"]
            # Remove player from game
            del game["players"][sid]
            
            # Notify host and remaining players about the disconnection
            player_list = [{"name": p["name"], "score": p["score"], "team": p["team"]} for p in game["players"].values()]
            await sio.emit("player_left", {
                "name": player_name,
                "players": player_list
            }, room=game_code)
            break
        elif sid == game["host_sid"]:
            # Host disconnected - start grace period for reconnection
            print(f"Host disconnected from game {game_code}, starting {HOST_RECONNECT_GRACE_PERIOD}s grace period")
            
            # Mark host as disconnected (but don't delete game)
            game["host_disconnected"] = True
            
            # Notify players that host is temporarily disconnected
            await sio.emit("host_disconnected", {
                "message": "Der Host hat die Verbindung verloren. Warte auf Wiederverbindung...",
                "grace_period": HOST_RECONNECT_GRACE_PERIOD
            }, room=game_code)
            
            # Cancel any existing cleanup task for this game
            if game_code in host_disconnect_tasks:
                host_disconnect_tasks[game_code].cancel()
            
            # Start cleanup task with grace period
            async def cleanup_after_grace_period(code: str):
                try:
                    await asyncio.sleep(HOST_RECONNECT_GRACE_PERIOD)
                    # Check if host is still disconnected
                    if code in games and games[code].get("host_disconnected", False):
                        print(f"Host did not reconnect to game {code}, ending game")
                        await sio.emit("game_ended", {
                            "reason": "Der Host hat das Spiel verlassen."
                        }, room=code)
                        await asyncio.sleep(0.5)
                        if code in games:
                            del games[code]
                    # Clean up task reference
                    if code in host_disconnect_tasks:
                        del host_disconnect_tasks[code]
                except asyncio.CancelledError:
                    # Task was cancelled because host reconnected
                    pass
            
            host_disconnect_tasks[game_code] = asyncio.create_task(
                cleanup_after_grace_period(game_code)
            )
            break


@sio.event
async def create_game(sid, data):
    """Host creates a new game."""
    quiz_id = data.get("quiz_id", 0)
    quizzes = load_quizzes()
    
    if quiz_id >= len(quizzes):
        await sio.emit("error", {"message": "Quiz nicht gefunden"}, to=sid)
        return
    
    game_code = generate_game_code()
    quiz = quizzes[quiz_id]
    
    # Create in database
    db.create_game(game_code, sid, quiz["title"], quiz)
    
    games[game_code] = {
        "host_sid": sid,
        "quiz": quiz,
        "players": {},
        "current_question": -1,
        "state": "lobby",  # lobby, question, results, leaderboard, ended
        "answers": {},
        "question_start_time": None,
        "team_mode": False,
        "teams": [],
        "top_n_players": 3,
    }
    
    await sio.enter_room(sid, game_code)
    await sio.emit("game_created", {
        "code": game_code,
        "quiz_title": quiz["title"],
        "question_count": len(quiz["questions"])
    }, to=sid)


@sio.event
async def join_game(sid, data):
    """Player joins a game."""
    game_code = data.get("code", "").upper()
    player_name = data.get("name", "").strip()
    
    if not player_name:
        await sio.emit("error", {"message": "Bitte gib einen Namen ein"}, to=sid)
        return
    
    if game_code not in games:
        await sio.emit("error", {"message": "Spiel nicht gefunden"}, to=sid)
        return
    
    game = games[game_code]
    
    if game["state"] != "lobby":
        await sio.emit("error", {"message": "Spiel hat bereits begonnen"}, to=sid)
        return
    
    # Check for duplicate names
    for player in game["players"].values():
        if player["name"].lower() == player_name.lower():
            await sio.emit("error", {"message": "Name bereits vergeben"}, to=sid)
            return
    
    # Add to database
    if not db.add_player(game_code, sid, player_name):
        await sio.emit("error", {"message": "Fehler beim Beitreten"}, to=sid)
        return
    
    game["players"][sid] = {
        "name": player_name,
        "score": 0,
        "streak": 0,
        "team": None,
    }
    
    await sio.enter_room(sid, game_code)
    await sio.emit("joined_game", {
        "code": game_code,
        "quiz_title": game["quiz"]["title"],
        "team_mode": game["team_mode"],
        "teams": game["teams"]
    }, to=sid)
    
    # Notify host
    player_list = [{"name": p["name"], "score": p["score"], "team": p["team"]} for p in game["players"].values()]
    await sio.emit("player_joined", {
        "name": player_name,
        "players": player_list
    }, room=game_code)


@sio.event
async def start_game(sid, data):
    """Host starts the game."""
    game_code = data.get("code")
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["host_sid"] != sid:
        return
    
    if len(game["players"]) < 1:
        await sio.emit("error", {"message": "Mindestens 1 Spieler benötigt"}, to=sid)
        return
    
    game["state"] = "starting"
    await sio.emit("game_starting", {}, room=game_code)
    
    # Short countdown before first question
    sync_game_to_db(game_code)
    await asyncio.sleep(3)
    await next_question(game_code)


async def next_question(game_code: str):
    """Send the next question to all players."""
    if game_code not in games:
        return
    
    game = games[game_code]
    game["current_question"] += 1
    game["answers"] = {}
    
    if game["current_question"] >= len(game["quiz"]["questions"]):
        # Game over
        await end_game(game_code)
        return
    
    question = game["quiz"]["questions"][game["current_question"]]
    game["state"] = "question"
    game["question_start_time"] = asyncio.get_event_loop().time()
    
    # Sync to database
    sync_game_to_db(game_code)
    
    # Send question to host (with correct answer)
    await sio.emit("show_question", {
        "question_num": game["current_question"] + 1,
        "total_questions": len(game["quiz"]["questions"]),
        "question": question["question"],
        "answers": question["answers"],
        "correct_index": question["correct"],
        "time_limit": question.get("time_limit", 20),
    }, to=game["host_sid"])
    
    # Send question to players (without correct answer)
    for player_sid in game["players"]:
        await sio.emit("show_question", {
            "question_num": game["current_question"] + 1,
            "total_questions": len(game["quiz"]["questions"]),
            "question": question["question"],
            "answers": question["answers"],
            "time_limit": question.get("time_limit", 20),
        }, to=player_sid)


@sio.event
async def submit_answer(sid, data):
    """Player submits an answer."""
    game_code = data.get("code")
    answer_index = data.get("answer")
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if sid not in game["players"]:
        return
    
    if game["state"] != "question":
        return
    
    if sid in game["answers"]:
        return  # Already answered
    
    # Calculate response time
    response_time = asyncio.get_event_loop().time() - game["question_start_time"]
    question = game["quiz"]["questions"][game["current_question"]]
    time_limit = question.get("time_limit", 20)
    
    game["answers"][sid] = {
        "answer": answer_index,
        "time": response_time,
    }
    
    # Record answer in database
    player = game["players"][sid]
    is_correct = answer_index == question["correct"]
    db.record_answer(
        game_code,
        player["name"],
        game["current_question"],
        answer_index,
        is_correct,
        int(response_time * 1000),  # Convert to milliseconds
        0  # Points will be updated in show_results
    )
    
    await sio.emit("answer_received", {}, to=sid)
    
    # Notify host of answer count
    await sio.emit("answer_update", {
        "answered": len(game["answers"]),
        "total": len(game["players"])
    }, to=game["host_sid"])
    
    # If all players answered, show results
    if len(game["answers"]) >= len(game["players"]):
        await show_results(game_code)


@sio.event
async def autoplay_started(sid, data):
    """Host signals autoplay countdown has started - forward to players."""
    game_code = data.get("code")
    seconds = data.get("seconds", 10)  # Default matches AUTOPLAY_COUNTDOWN_SECONDS in JS
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["host_sid"] != sid:
        return
    
    # Send autoplay countdown to all players
    for player_sid in game["players"]:
        await sio.emit("autoplay_countdown", {"seconds": seconds}, to=player_sid)


@sio.event
async def time_up(sid, data):
    """Host signals time is up."""
    game_code = data.get("code")
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["host_sid"] != sid:
        return
    
    await show_results(game_code)


async def show_results(game_code: str):
    """Calculate and show results for the current question."""
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["state"] != "question":
        return
    
    game["state"] = "results"
    question = game["quiz"]["questions"][game["current_question"]]
    correct_index = question["correct"]
    time_limit = question.get("time_limit", 20)
    
    results = []
    answer_counts = [0, 0, 0, 0]
    
    for player_sid, answer_data in game["answers"].items():
        player = game["players"][player_sid]
        is_correct = answer_data["answer"] == correct_index
        
        if answer_data["answer"] is not None and answer_data["answer"] < 4:
            answer_counts[answer_data["answer"]] += 1
        
        if is_correct:
            # Score based on speed (max 1000, min 500)
            time_bonus = max(0, 1 - (answer_data["time"] / time_limit))
            score = int(500 + (500 * time_bonus))
            player["streak"] += 1
            # Streak bonus
            if player["streak"] > 1:
                score += min(player["streak"] * 50, 200)
            player["score"] += score
            
            # Update database
            db.update_player_score(game_code, player["name"], player["score"])
            
            results.append({
                "sid": player_sid,
                "name": player["name"],
                "correct": True,
                "score_gained": score,
                "total_score": player["score"],
                "streak": player["streak"],
            })
        else:
            player["streak"] = 0
            results.append({
                "sid": player_sid,
                "name": player["name"],
                "correct": False,
                "score_gained": 0,
                "total_score": player["score"],
                "streak": 0,
            })
    
    # Players who didn't answer
    for player_sid in game["players"]:
        if player_sid not in game["answers"]:
            player = game["players"][player_sid]
            player["streak"] = 0
            results.append({
                "sid": player_sid,
                "name": player["name"],
                "correct": False,
                "score_gained": 0,
                "total_score": player["score"],
                "streak": 0,
            })
    
    # Sort by score
    results.sort(key=lambda x: x["total_score"], reverse=True)
    
    # Send results to host
    await sio.emit("show_results", {
        "correct_index": correct_index,
        "correct_answer": question["answers"][correct_index],
        "answer_counts": answer_counts,
        "results": [{"name": r["name"], "correct": r["correct"], "score_gained": r["score_gained"], "total_score": r["total_score"]} for r in results],
    }, to=game["host_sid"])
    
    # Send individual results to players
    for result in results:
        await sio.emit("your_result", {
            "correct": result["correct"],
            "correct_answer": question["answers"][correct_index],
            "score_gained": result["score_gained"],
            "total_score": result["total_score"],
            "streak": result["streak"],
            "rank": results.index(result) + 1,
            "total_players": len(results),
        }, to=result["sid"])


@sio.event
async def configure_teams(sid, data):
    """Host configures team mode."""
    game_code = data.get("code")
    team_mode = data.get("team_mode", False)
    teams = data.get("teams", [])
    top_n_players = data.get("top_n_players", 3)
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["host_sid"] != sid:
        return
    
    if game["state"] != "lobby":
        return
    
    game["team_mode"] = team_mode
    game["teams"] = teams
    game["top_n_players"] = top_n_players
    
    # Update database
    db.update_game(game_code, team_mode=team_mode, teams=teams, top_n_players=top_n_players)
    
    # Notify all players about team mode update
    await sio.emit("team_config_updated", {
        "team_mode": team_mode,
        "teams": teams
    }, room=game_code)


@sio.event
async def select_team(sid, data):
    """Player selects their team."""
    game_code = data.get("code")
    team = data.get("team")
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if sid not in game["players"]:
        return
    
    if game["state"] != "lobby":
        return
    
    if not game["team_mode"]:
        return
    
    if team not in game["teams"]:
        await sio.emit("error", {"message": "Ungültiges Team"}, to=sid)
        return
    
    game["players"][sid]["team"] = team
    
    # Update database
    db.update_player_team(game_code, game["players"][sid]["name"], team)
    
    # Notify host and all players
    player_list = [{"name": p["name"], "score": p["score"], "team": p["team"]} for p in game["players"].values()]
    await sio.emit("player_updated", {
        "players": player_list
    }, room=game_code)


@sio.event
async def next_question_request(sid, data):
    """Host requests next question."""
    game_code = data.get("code")
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["host_sid"] != sid:
        return
    
    await next_question(game_code)


@sio.event
async def end_game_request(sid, data):
    """Host requests to end the game early."""
    game_code = data.get("code")
    
    if game_code not in games:
        return
    
    game = games[game_code]
    
    if game["host_sid"] != sid:
        return
    
    # Notify all players that the game has ended
    await sio.emit("game_ended", {"message": "Das Spiel wurde vom Host beendet."}, room=game_code)
    
    # Give some time for the message to be delivered
    await asyncio.sleep(0.5)
    
    # Clean up the game
    if game_code in games:
        del games[game_code]


async def end_game(game_code: str):
    """End the game and show final leaderboard."""
    if game_code not in games:
        return
    
    game = games[game_code]
    game["state"] = "ended"
    
    # Final leaderboard
    leaderboard = [
        {"name": p["name"], "score": p["score"], "team": p["team"]}
        for p in game["players"].values()
    ]
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    
    # Calculate team leaderboard if team mode is enabled
    team_leaderboard = []
    if game["team_mode"]:
        team_scores = {}
        for team in game["teams"]:
            # Get all players in this team
            team_players = [
                {"name": p["name"], "score": p["score"]}
                for p in game["players"].values()
                if p["team"] == team
            ]
            # Sort by score and take top N players
            team_players.sort(key=lambda x: x["score"], reverse=True)
            top_players = team_players[:game["top_n_players"]]
            # Sum scores of top players
            team_total = sum(p["score"] for p in top_players)
            team_scores[team] = {
                "team": team,
                "score": team_total,
                "player_count": len(team_players),
                "top_players": top_players
            }
        
        team_leaderboard = list(team_scores.values())
        team_leaderboard.sort(key=lambda x: x["score"], reverse=True)
    
    await sio.emit("game_ended", {
        "leaderboard": leaderboard,
        "team_mode": game["team_mode"],
        "team_leaderboard": team_leaderboard,
        "top_n_players": game["top_n_players"]
    }, room=game_code)
    
    # Update final state in database
    db.update_game(game_code, state="ended")


# Startup cleanup
@app.on_event("startup")
async def startup_cleanup():
    """Clean up old games on startup."""
    deleted = db.cleanup_old_games(24)
    if deleted > 0:
        print(f"Cleaned up {deleted} old games")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8080)
