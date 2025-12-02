"""
QuizKnaller - Wissen macht BUMM! 💥
Ein Multiplayer-Quiz das einschlägt!
"""

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

# Create Socket.IO server
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="QuizKnaller", description="Wissen macht BUMM! 💥")
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Store for active games
games: dict[str, dict] = {}

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


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
    # Remove player from their game
    for game_code, game in list(games.items()):
        if sid in game.get("players", {}):
            player_name = game["players"][sid]["name"]
            del game["players"][sid]
            await sio.emit("player_left", {"name": player_name}, room=game_code)
        if game.get("host_sid") == sid:
            # Host left, end the game
            await sio.emit("game_ended", {"reason": "Host hat das Spiel verlassen"}, room=game_code)
            del games[game_code]


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8080)
