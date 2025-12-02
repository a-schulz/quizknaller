# Team Mode Feature

## Overview
Added a comprehensive team mode feature to QuizKnaller that allows players to compete in teams with customizable scoring based on top N players per team.

## Features Added

### 1. Host Configuration
- **Team Mode Toggle**: Host can enable/disable team mode in the lobby
- **Team Setup**: Host can define custom teams (comma-separated list)
- **Top N Players Setting**: Host can configure how many top players from each team count toward the team score (default: 3)
- **Team Configuration UI**: Located in the lobby screen below the QR code

### 2. Player Team Selection
- **Team Selection Screen**: After joining, players see a team selection screen if team mode is enabled
- **Team Buttons**: Large, touch-friendly buttons for each team
- **Dynamic Updates**: If host enables team mode after players join, they'll see the team selection screen

### 3. Enhanced Lobby Display
- **Team Grouping**: Players are displayed grouped by their teams
- **Team Headers**: Clear visual separation between teams
- **No Team Section**: Shows players who haven't selected a team yet

### 4. Team Leaderboard
- **Team Scoring**: Calculates team scores based on the sum of top N players
- **Team Podium**: Shows top 3 teams with medals and scores
- **Individual Rankings**: Still shows individual player rankings below team results
- **Player Count**: Displays how many players are in each team

### 5. Player Experience
- **Team Display**: Players see their team name in the final screen
- **Individual Scoring**: Individual scores are still tracked and displayed
- **Team Context**: Players know which team they're contributing to

## How to Use

### As a Host:
1. Create a game and select a quiz
2. In the lobby, check "Team-Modus aktivieren"
3. Enter team names separated by commas (e.g., "Team Rot, Team Blau, Team Grün")
4. Set the number of top players per team (e.g., 3 means only the top 3 players from each team count)
5. Click "Teams speichern"
6. Wait for players to join and select their teams
7. Start the game

### As a Player:
1. Join the game with code and name
2. If team mode is enabled, select your team
3. Play the quiz normally
4. See both your individual score and your team's ranking at the end

## Technical Changes

### Backend (main.py)
- Added `team_mode`, `teams`, and `top_n_players` fields to game state
- Added `team` field to player data
- Created `configure_teams` socket event for host configuration
- Created `select_team` socket event for player team selection
- Enhanced `end_game` to calculate team leaderboard based on top N players
- Added `player_updated` event for real-time team selection updates

### Frontend - Host
- **host.html**: Added team configuration form in lobby
- **host.js**: 
  - Team configuration handling
  - Player display grouped by teams
  - Team leaderboard display in final screen
- **host.css**: Styling for team config UI and team headers

### Frontend - Player
- **player.html**: Added team selection screen
- **player.js**: 
  - Team selection logic
  - Display team in final results
- **player.css**: Styling for team selection buttons

## Example Scenarios

### Scenario 1: Classroom Competition
- Host creates 3 teams: "Reihe 1", "Reihe 2", "Reihe 3"
- Sets top 5 players per team
- Students join and select their row team
- Final score shows which row performed best

### Scenario 2: Company Event
- Host creates teams by department: "Marketing", "Sales", "Engineering"
- Sets top 3 players per team
- Employees compete, but only top 3 from each department count
- Encourages broad participation while rewarding top performers

## Configuration Options

- **Team Count**: Minimum 2 teams, no maximum
- **Top N Players**: 1-10 players (default: 3)
- **Team Names**: Any text, comma-separated
- **Toggle**: Can be enabled/disabled at any time before game starts
