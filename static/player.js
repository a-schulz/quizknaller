// QuizKnaller - Player Client
const socket = io();

// Configuration
const AUTOPLAY_COUNTDOWN_SECONDS = 10;

let gameCode = null;
let timeLimit = 20;
let timerInterval = null;
let autoplayCountdownInterval = null;

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
    playAgainBtn: document.getElementById('play-again-btn'),
    playerAutoplayCountdown: document.getElementById('player-autoplay-countdown'),
    playerAutoplayTimer: document.getElementById('player-autoplay-timer'),
    playerAutoplayMessage: document.getElementById('player-autoplay-message'),
    hostDisconnectOverlay: document.getElementById('host-disconnect-overlay'),
    hostReconnectTimer: document.getElementById('host-reconnect-timer')
};

let hostReconnectCountdownInterval = null;

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
    localStorage.removeItem('playerGameCode');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerQuizTitle');
    elements.gameCodeInput.value = '';
    elements.playerNameInput.value = '';
    showScreen('join');
});

// Socket Events
socket.on('error', (data) => {
    showError(data.message);
    
    // If game not found, clear localStorage so we don't keep trying to reconnect
    if (data.message && (data.message.includes('nicht gefunden') || data.message.includes('not found'))) {
        localStorage.removeItem('playerGameCode');
        localStorage.removeItem('playerQuizTitle');
    }
});

// Handle host disconnection
socket.on('host_disconnected', (data) => {
    const gracePeriod = data.grace_period || 60;
    let countdown = gracePeriod;
    
    if (elements.hostDisconnectOverlay && elements.hostReconnectTimer) {
        elements.hostReconnectTimer.textContent = countdown;
        elements.hostDisconnectOverlay.style.display = 'flex';
        
        // Clear any existing countdown
        if (hostReconnectCountdownInterval) {
            clearInterval(hostReconnectCountdownInterval);
        }
        
        hostReconnectCountdownInterval = setInterval(() => {
            countdown--;
            elements.hostReconnectTimer.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(hostReconnectCountdownInterval);
                hostReconnectCountdownInterval = null;
            }
        }, 1000);
    }
});

// Handle host reconnection
socket.on('host_reconnected', (data) => {
    if (hostReconnectCountdownInterval) {
        clearInterval(hostReconnectCountdownInterval);
        hostReconnectCountdownInterval = null;
    }
    
    if (elements.hostDisconnectOverlay) {
        elements.hostDisconnectOverlay.style.display = 'none';
    }
});

// Try to reconnect on page load or auto-fill code from URL
window.addEventListener('load', () => {
    // Check for game code in URL (from QR code scan)
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    
    if (codeFromUrl) {
        elements.gameCodeInput.value = codeFromUrl.toUpperCase();
        // Pre-fill name if we have it saved
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
            elements.playerNameInput.value = savedName;
        }
        // Focus on name input since code is already filled
        elements.playerNameInput.focus();
        // Clear the URL parameter without reloading the page
        window.history.replaceState({}, document.title, window.location.pathname);
        // Don't try to reconnect if coming from QR code - let user enter their name
        return;
    }
    
    // Try to reconnect if we have saved session (only if not from QR code)
    const savedGameCode = localStorage.getItem('playerGameCode');
    const savedPlayerName = localStorage.getItem('playerName');
    if (savedGameCode && savedPlayerName) {
        // Pre-fill the inputs for visual feedback
        elements.gameCodeInput.value = savedGameCode;
        elements.playerNameInput.value = savedPlayerName;
        socket.emit('reconnect_player', { code: savedGameCode, name: savedPlayerName });
    }
});

// Reconnection handlers
socket.on('reconnected_player', (data) => {
    gameCode = data.code;
    elements.playerNameInput.value = localStorage.getItem('playerName');
    elements.waitingQuizTitle.textContent = data.quiz_title;
    
    // Restore to appropriate screen based on state
    if (data.state === 'lobby') {
        if (data.team_mode && data.teams && data.teams.length > 0 && !data.team) {
            showTeamSelection(data.teams);
        } else {
            showScreen('waiting');
        }
    } else if (data.state === 'starting') {
        showScreen('starting');
    } else if (data.state === 'question') {
        showScreen('question');
    } else if (data.state === 'results') {
        showScreen('answered');
    } else if (data.state === 'ended') {
        showScreen('final');
    }
});

socket.on('reconnect_failed', (data) => {
    localStorage.removeItem('playerGameCode');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerQuizTitle');
    showError(data.message || 'Verbindung fehlgeschlagen');
    showScreen('join');
});

socket.on('joined_game', (data) => {
    gameCode = data.code;
    // Save to localStorage for reconnection
    localStorage.setItem('playerGameCode', data.code);
    localStorage.setItem('playerName', elements.playerNameInput.value.trim());
    localStorage.setItem('playerQuizTitle', data.quiz_title);
    
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

// Reading phase - show question only
socket.on('show_question_reading', (data) => {
    // Clear previous state
    if (timerInterval) clearInterval(timerInterval);
    
    elements.questionNumber.textContent = `${data.question_num}/${data.total_questions}`;
    elements.questionText.textContent = data.question;
    
    // Hide answer buttons during reading phase
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach(btn => {
        btn.textContent = '';
        btn.classList.add('hidden');
        btn.classList.remove('disabled', 'selected');
    });
    
    // Show reading indicator in timer bar
    elements.timerFill.style.width = '100%';
    elements.timerFill.classList.remove('warning', 'danger');
    elements.timerFill.classList.add('reading');
    
    showScreen('question');
    
    // Animate reading countdown
    let readingTimeLeft = data.reading_time;
    timerInterval = setInterval(() => {
        readingTimeLeft -= 0.1;
        const percent = (readingTimeLeft / data.reading_time) * 100;
        elements.timerFill.style.width = `${percent}%`;
        
        if (readingTimeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 100);
});

// Show answers after reading phase
socket.on('show_answers', (data) => {
    // Clear reading timer
    if (timerInterval) clearInterval(timerInterval);
    
    timeLimit = data.time_limit;
    
    // Reveal answer buttons
    const buttons = document.querySelectorAll('.answer-btn');
    data.answers.forEach((answer, i) => {
        buttons[i].textContent = answer;
        buttons[i].classList.remove('hidden', 'disabled', 'selected');
    });
    
    // Reset and start answer timer
    elements.timerFill.style.width = '100%';
    elements.timerFill.classList.remove('warning', 'danger', 'reading');
    
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

// Legacy handler for backwards compatibility
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
        buttons[i].classList.remove('disabled', 'selected', 'hidden');
    });
    
    // Reset and start timer
    elements.timerFill.style.width = '100%';
    elements.timerFill.classList.remove('warning', 'danger', 'reading');
    
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
    if (autoplayCountdownInterval) clearInterval(autoplayCountdownInterval);
    
    // Hide autoplay countdown initially
    if (elements.playerAutoplayCountdown) {
        elements.playerAutoplayCountdown.style.display = 'none';
    }
    
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

// Handle autoplay countdown from host
socket.on('autoplay_countdown', (data) => {
    if (elements.playerAutoplayCountdown && elements.playerAutoplayTimer) {
        let countdown = data.seconds || AUTOPLAY_COUNTDOWN_SECONDS;
        elements.playerAutoplayTimer.textContent = countdown;
        
        // Set message based on whether this is the last question
        if (elements.playerAutoplayMessage) {
            if (data.is_last_question) {
                elements.playerAutoplayMessage.textContent = '🎉 Ergebnisse in';
            } else {
                elements.playerAutoplayMessage.textContent = 'Nächste Frage in';
            }
        }
        
        elements.playerAutoplayCountdown.style.display = 'block';
        
        if (autoplayCountdownInterval) clearInterval(autoplayCountdownInterval);
        
        autoplayCountdownInterval = setInterval(() => {
            countdown--;
            elements.playerAutoplayTimer.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(autoplayCountdownInterval);
                autoplayCountdownInterval = null;
                elements.playerAutoplayCountdown.style.display = 'none';
            }
        }, 1000);
    }
});

socket.on('game_ended', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    if (autoplayCountdownInterval) {
        clearInterval(autoplayCountdownInterval);
        autoplayCountdownInterval = null;
    }
    
    gameCode = null;
    localStorage.removeItem('playerGameCode');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerQuizTitle');
    
    if (data.reason || data.message) {
        // Show a more prominent notification for game ended by host
        alert(data.reason || data.message);
        elements.gameCodeInput.value = '';
        elements.playerNameInput.value = '';
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

// Prevent zoom on double tap, but allow input fields to work properly
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    // Allow input fields to work normally (shows keyboard)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }
    
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });
