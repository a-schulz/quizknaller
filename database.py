"""
Database module for QuizKnaller persistence
Handles SQLite operations for games, players, and quizzes
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_PATH = Path(__file__).parent / "quizknaller.db"


def init_db():
    """Initialize the database with required tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Games table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS games (
            game_code TEXT PRIMARY KEY,
            host_sid TEXT,
            quiz_name TEXT NOT NULL,
            quiz_data TEXT NOT NULL,
            current_question_index INTEGER DEFAULT -1,
            state TEXT DEFAULT 'lobby',
            team_mode BOOLEAN DEFAULT 0,
            teams TEXT,
            top_n_players INTEGER DEFAULT 3,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Players table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_code TEXT NOT NULL,
            session_id TEXT NOT NULL,
            name TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            team TEXT,
            connected BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_code) REFERENCES games(game_code) ON DELETE CASCADE,
            UNIQUE(game_code, name)
        )
    """)
    
    # Question responses table (for analytics)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS question_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_code TEXT NOT NULL,
            player_name TEXT NOT NULL,
            question_index INTEGER NOT NULL,
            answer_index INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            time_taken_ms INTEGER NOT NULL,
            points_awarded INTEGER NOT NULL,
            answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_code) REFERENCES games(game_code) ON DELETE CASCADE
        )
    """)
    
    # Create indexes for better query performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_players_game_code 
        ON players(game_code)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_players_session_id 
        ON players(session_id)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_responses_game_code 
        ON question_responses(game_code)
    """)
    
    conn.commit()
    conn.close()


def get_connection():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# Game operations
def create_game(game_code: str, host_sid: str, quiz_name: str, quiz_data: dict, 
                team_mode: bool = False, teams: Optional[List[str]] = None, 
                top_n_players: int = 3) -> bool:
    """Create a new game in the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO games 
            (game_code, host_sid, quiz_name, quiz_data, team_mode, teams, top_n_players)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            game_code,
            host_sid,
            quiz_name,
            json.dumps(quiz_data),
            team_mode,
            json.dumps(teams) if teams else None,
            top_n_players
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error creating game: {e}")
        return False


def get_game(game_code: str) -> Optional[Dict[str, Any]]:
    """Retrieve a game from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM games WHERE game_code = ?", (game_code,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "game_code": row["game_code"],
            "host_sid": row["host_sid"],
            "quiz_name": row["quiz_name"],
            "quiz": json.loads(row["quiz_data"]),
            "current_question": row["current_question_index"],
            "state": row["state"],
            "team_mode": bool(row["team_mode"]),
            "teams": json.loads(row["teams"]) if row["teams"] else [],
            "top_n_players": row["top_n_players"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }
    return None


def update_game(game_code: str, **updates) -> bool:
    """Update game fields."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Build UPDATE query dynamically
        set_clauses = []
        values = []
        
        for key, value in updates.items():
            if key == "quiz":
                set_clauses.append("quiz_data = ?")
                values.append(json.dumps(value))
            elif key == "current_question":
                set_clauses.append("current_question_index = ?")
                values.append(value)
            elif key == "teams":
                set_clauses.append("teams = ?")
                values.append(json.dumps(value) if value else None)
            else:
                set_clauses.append(f"{key} = ?")
                values.append(value)
        
        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        values.append(game_code)
        
        query = f"UPDATE games SET {', '.join(set_clauses)} WHERE game_code = ?"
        cursor.execute(query, values)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating game: {e}")
        return False


def delete_game(game_code: str) -> bool:
    """Delete a game and all associated data."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM games WHERE game_code = ?", (game_code,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error deleting game: {e}")
        return False


# Player operations
def add_player(game_code: str, session_id: str, name: str, team: Optional[str] = None) -> bool:
    """Add a player to the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO players (game_code, session_id, name, team)
            VALUES (?, ?, ?, ?)
        """, (game_code, session_id, name, team))
        
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        # Player name already exists in this game
        return False
    except Exception as e:
        print(f"Error adding player: {e}")
        return False


def get_players(game_code: str) -> List[Dict[str, Any]]:
    """Get all players for a game."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM players 
        WHERE game_code = ? 
        ORDER BY score DESC, created_at ASC
    """, (game_code,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{
        "name": row["name"],
        "score": row["score"],
        "team": row["team"],
        "session_id": row["session_id"],
        "connected": bool(row["connected"])
    } for row in rows]


def get_player_by_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get player by session ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM players WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "game_code": row["game_code"],
            "name": row["name"],
            "score": row["score"],
            "team": row["team"],
            "connected": bool(row["connected"])
        }
    return None


def update_player_session(game_code: str, name: str, new_session_id: str) -> bool:
    """Update player's session ID (for reconnection)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE players 
            SET session_id = ?, connected = 1, updated_at = CURRENT_TIMESTAMP
            WHERE game_code = ? AND name = ?
        """, (new_session_id, game_code, name))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating player session: {e}")
        return False


def update_player_score(game_code: str, name: str, score: int) -> bool:
    """Update player's score."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE players 
            SET score = ?, updated_at = CURRENT_TIMESTAMP
            WHERE game_code = ? AND name = ?
        """, (score, game_code, name))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating player score: {e}")
        return False


def update_player_team(game_code: str, name: str, team: str) -> bool:
    """Update player's team."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE players 
            SET team = ?, updated_at = CURRENT_TIMESTAMP
            WHERE game_code = ? AND name = ?
        """, (team, game_code, name))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating player team: {e}")
        return False


def set_player_connected(session_id: str, connected: bool) -> bool:
    """Set player connection status."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE players 
            SET connected = ?, updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        """, (connected, session_id))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error setting player connected status: {e}")
        return False


# Question response operations
def record_answer(game_code: str, player_name: str, question_index: int,
                  answer_index: int, is_correct: bool, time_taken_ms: int,
                  points_awarded: int) -> bool:
    """Record a player's answer to a question."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO question_responses 
            (game_code, player_name, question_index, answer_index, is_correct, time_taken_ms, points_awarded)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (game_code, player_name, question_index, answer_index, is_correct, time_taken_ms, points_awarded))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error recording answer: {e}")
        return False


def get_game_statistics(game_code: str) -> Dict[str, Any]:
    """Get statistics for a completed game."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get total questions answered
    cursor.execute("""
        SELECT COUNT(*) as total_responses,
               AVG(time_taken_ms) as avg_time,
               SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers
        FROM question_responses
        WHERE game_code = ?
    """, (game_code,))
    
    stats = cursor.fetchone()
    conn.close()
    
    return {
        "total_responses": stats["total_responses"],
        "avg_response_time_ms": stats["avg_time"],
        "correct_answers": stats["correct_answers"],
        "accuracy": (stats["correct_answers"] / stats["total_responses"] * 100) if stats["total_responses"] > 0 else 0
    }


# Cleanup operations
def cleanup_old_games(hours: int = 24) -> int:
    """Delete games older than specified hours."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM games 
            WHERE datetime(updated_at) < datetime('now', '-' || ? || ' hours')
        """, (hours,))
        
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        return deleted
    except Exception as e:
        print(f"Error cleaning up old games: {e}")
        return 0
