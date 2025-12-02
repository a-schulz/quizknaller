// QuizKnaller - Player Client
const socket = io();

let gameCode = null;
let timeLimit = 20;
let timerInterval = null;

// DOM Elements
const screens = {
    join: document.getElementById('join-screen'),
    team: document.getElementById('team-screen'),
    waiting: document.getElementById('waiting-screen'),
    starting: document.getElementById('starting-screen'),
    question: document.getElementById('question-screen'),
    answered: document.getElementById('answered-screen'),
    result: document.getElementById('result-screen'),
    final: document.getElementById('final-screen')
};

const elements = {
    gameCodeInput: document.getElementById('game-code'),
    playerNameInput: document.getElementById('player-name'),
    joinBtn: document.getElementById('join-btn'),
    errorMessage: document.getElementById('error-message'),
    teamList: document.getElementById('team-list'),
    waitingQuizTitle: document.getElementById('waiting-quiz-title'),
    startCountdown: document.getElementById('start-countdown'),
    questionNumber: document.getElementById('question-number'),
    timerFill: document.getElementById('timer-fill'),
    questionText: document.getElementById('question-text'),
    answersGrid: document.getElementById('answers-grid'),
    resultIcon: document.getElementById('result-icon'),
    resultTitle: document.getElementById('result-title'),
    correctAnswer: document.getElementById('correct-answer'),
    scoreGained: document.getElementById('score-gained'),
    totalScore: document.getElementById('total-score'),
    rankDisplay: document.getElementById('rank-display'),
    streakDisplay: document.getElementById('streak-display'),
    resultScreen: document.getElementById('result-screen'),
    finalRank: document.getElementById('final-rank'),
    finalScore: document.getElementById('final-score'),
    playAgainBtn: document.getElementById('play-again-btn')
};

// Helper functions
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add('show');
    setTimeout(() => elements.errorMessage.classList.remove('show'), 3000);
}

// Event Listeners
elements.joinBtn.addEventListener('click', () => {
    const code = elements.gameCodeInput.value.trim().toUpperCase();
    const name = elements.playerNameInput.value.trim();
    
    if (!code || code.length < 4) {
        showError('Bitte gib einen gültigen Spiel-Code ein');
        return;
    }
    
    if (!name) {
        showError('Bitte gib deinen Namen ein');
        return;
    }
    
    socket.emit('join_game', { code, name });
});

// Allow Enter key to submit
elements.gameCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.playerNameInput.focus();
});

elements.playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.joinBtn.click();
});

// Answer buttons
document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;
        
        const answerIndex = parseInt(btn.dataset.index);
        socket.emit('submit_answer', { code: gameCode, answer: answerIndex });
        
        // Disable all buttons and mark selected
        document.querySelectorAll('.answer-btn').forEach(b => {
            b.classList.add('disabled');
            if (b === btn) b.classList.add('selected');
        });
    });
});

elements.playAgainBtn.addEventListener('click', () => {
    gameCode = null;
    elements.gameCodeInput.value = '';
    showScreen('join');
});

// Socket Events
socket.on('error', (data) => {
    showError(data.message);
});

socket.on('joined_game', (data) => {
    gameCode = data.code;
    elements.waitingQuizTitle.textContent = data.quiz_title;
    
    // If team mode is enabled, show team selection
    if (data.team_mode && data.teams && data.teams.length > 0) {
        showTeamSelection(data.teams);
    } else {
        showScreen('waiting');
    }
});

function showTeamSelection(teams) {
    elements.teamList.innerHTML = '';
    teams.forEach(team => {
        const teamBtn = document.createElement('button');
        teamBtn.className = 'team-btn';
        teamBtn.textContent = team;
        teamBtn.addEventListener('click', () => {
            socket.emit('select_team', { code: gameCode, team: team });
            showScreen('waiting');
        });
        elements.teamList.appendChild(teamBtn);
    });
    showScreen('team');
}

socket.on('team_config_updated', (data) => {
    // If team mode was enabled after joining, show team selection
    if (data.team_mode && data.teams && data.teams.length > 0) {
        if (screens.waiting.classList.contains('active')) {
            showTeamSelection(data.teams);
        }
    }
});

socket.on('game_starting', () => {
    showScreen('starting');
    let count = 3;
    elements.startCountdown.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.startCountdown.textContent = count;
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);
});

socket.on('show_question', (data) => {
    // Clear previous state
    if (timerInterval) clearInterval(timerInterval);
    
    elements.questionNumber.textContent = `${data.question_num}/${data.total_questions}`;
    elements.questionText.textContent = data.question;
    timeLimit = data.time_limit;
    
    // Set up answer buttons
    const buttons = document.querySelectorAll('.answer-btn');
    data.answers.forEach((answer, i) => {
        buttons[i].textContent = answer;
        buttons[i].classList.remove('disabled', 'selected');
    });
    
    // Reset and start timer
    elements.timerFill.style.width = '100%';
    elements.timerFill.classList.remove('warning', 'danger');
    
    showScreen('question');
    
    let timeLeft = timeLimit;
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        const percent = (timeLeft / timeLimit) * 100;
        elements.timerFill.style.width = `${percent}%`;
        
        if (percent < 25) {
            elements.timerFill.classList.add('danger');
            elements.timerFill.classList.remove('warning');
        } else if (percent < 50) {
            elements.timerFill.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 100);
});

socket.on('answer_received', () => {
    if (timerInterval) clearInterval(timerInterval);
    showScreen('answered');
});

socket.on('your_result', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    
    if (data.correct) {
        elements.resultScreen.classList.remove('incorrect');
        elements.resultScreen.classList.add('correct');
        elements.resultIcon.textContent = '✓';
        elements.resultTitle.textContent = 'Richtig!';
    } else {
        elements.resultScreen.classList.remove('correct');
        elements.resultScreen.classList.add('incorrect');
        elements.resultIcon.textContent = '✗';
        elements.resultTitle.textContent = 'Falsch!';
    }
    
    elements.correctAnswer.textContent = `Richtige Antwort: ${data.correct_answer}`;
    elements.scoreGained.textContent = data.score_gained > 0 ? `+${data.score_gained}` : '0';
    elements.totalScore.textContent = data.total_score;
    elements.rankDisplay.textContent = `Platz ${data.rank} von ${data.total_players}`;
    
    if (data.streak > 1) {
        elements.streakDisplay.textContent = `🔥 ${data.streak}er Serie!`;
        elements.streakDisplay.style.display = 'block';
    } else {
        elements.streakDisplay.style.display = 'none';
    }
    
    showScreen('result');
});

socket.on('game_ended', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    
    if (data.reason) {
        showError(data.reason);
        showScreen('join');
        return;
    }
    
    const leaderboard = data.leaderboard;
    const myName = elements.playerNameInput.value.trim();
    const myRank = leaderboard.findIndex(p => p.name.toLowerCase() === myName.toLowerCase()) + 1;
    const myScore = leaderboard.find(p => p.name.toLowerCase() === myName.toLowerCase())?.score || 0;
    const myTeam = leaderboard.find(p => p.name.toLowerCase() === myName.toLowerCase())?.team;
    
    let rankEmoji = '';
    if (myRank === 1) rankEmoji = '🥇';
    else if (myRank === 2) rankEmoji = '🥈';
    else if (myRank === 3) rankEmoji = '🥉';
    else rankEmoji = `#${myRank}`;
    
    let finalText = `${myScore} Punkte`;
    if (data.team_mode && myTeam) {
        finalText += ` (Team: ${myTeam})`;
    }
    
    elements.finalRank.textContent = rankEmoji;
    elements.finalScore.textContent = finalText;
    
    showScreen('final');
});

// Prevent zoom on double tap
document.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.target.click();
}, { passive: false });
