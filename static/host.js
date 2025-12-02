// QuizKnaller - Host Client
const socket = io();

let gameCode = null;
let correctIndex = null;
let timeLimit = 20;
let timerInterval = null;
let totalPlayers = 0;

// DOM Elements
const screens = {
    select: document.getElementById('select-screen'),
    lobby: document.getElementById('lobby-screen'),
    countdown: document.getElementById('countdown-screen'),
    question: document.getElementById('question-screen'),
    results: document.getElementById('results-screen'),
    final: document.getElementById('final-screen')
};

const elements = {
    quizList: document.getElementById('quiz-list'),
    lobbyQuizTitle: document.getElementById('lobby-quiz-title'),
    joinUrl: document.getElementById('join-url'),
    gameCodeDisplay: document.getElementById('game-code-display'),
    qrCode: document.getElementById('qr-code'),
    playerCount: document.getElementById('player-count'),
    playersGrid: document.getElementById('players-grid'),
    startGameBtn: document.getElementById('start-game-btn'),
    countdownNumber: document.getElementById('countdown-number'),
    questionNumber: document.getElementById('question-number'),
    timerProgress: document.getElementById('timer-progress'),
    timerText: document.getElementById('timer-text'),
    answeredCount: document.getElementById('answered-count'),
    totalPlayersDisplay: document.getElementById('total-players'),
    questionText: document.getElementById('question-text'),
    answersDisplay: document.getElementById('answers-display'),
    correctAnswerBox: document.getElementById('correct-answer-box'),
    leaderboardPreview: document.getElementById('leaderboard-preview'),
    nextQuestionBtn: document.getElementById('next-question-btn'),
    podium: document.getElementById('podium'),
    fullLeaderboard: document.getElementById('full-leaderboard'),
    newGameBtn: document.getElementById('new-game-btn'),
    confetti: document.getElementById('confetti')
};

// Helper functions
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Load quizzes
async function loadQuizzes() {
    const response = await fetch('/api/quizzes');
    const quizzes = await response.json();
    
    elements.quizList.innerHTML = '';
    quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
            <h3>${quiz.title}</h3>
            <span>${quiz.questionCount} Fragen</span>
        `;
        card.addEventListener('click', () => {
            socket.emit('create_game', { quiz_id: quiz.id });
        });
        elements.quizList.appendChild(card);
    });
}

// Initialize
loadQuizzes();

// Event Listeners
elements.startGameBtn.addEventListener('click', () => {
    socket.emit('start_game', { code: gameCode });
});

elements.nextQuestionBtn.addEventListener('click', () => {
    socket.emit('next_question_request', { code: gameCode });
});

elements.newGameBtn.addEventListener('click', () => {
    gameCode = null;
    loadQuizzes();
    showScreen('select');
});

// Socket Events
socket.on('game_created', (data) => {
    gameCode = data.code;
    elements.lobbyQuizTitle.textContent = data.quiz_title;
    elements.joinUrl.textContent = window.location.host;
    elements.gameCodeDisplay.textContent = data.code;
    elements.qrCode.src = `/api/qrcode?code=${data.code}`;
    elements.playersGrid.innerHTML = '';
    elements.playerCount.textContent = '0';
    elements.startGameBtn.disabled = true;
    showScreen('lobby');
});

socket.on('player_joined', (data) => {
    elements.playersGrid.innerHTML = '';
    data.players.forEach(player => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.textContent = player.name;
        elements.playersGrid.appendChild(chip);
    });
    
    totalPlayers = data.players.length;
    elements.playerCount.textContent = totalPlayers;
    elements.startGameBtn.disabled = totalPlayers < 1;
});

socket.on('player_left', (data) => {
    // Will be handled by next player_joined event
});

socket.on('game_starting', () => {
    showScreen('countdown');
    let count = 3;
    elements.countdownNumber.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.countdownNumber.textContent = count;
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);
});

socket.on('show_question', (data) => {
    // Clear previous state
    if (timerInterval) clearInterval(timerInterval);
    
    correctIndex = data.correct_index;
    timeLimit = data.time_limit;
    totalPlayers = parseInt(elements.playerCount.textContent) || totalPlayers;
    
    elements.questionNumber.textContent = `Frage ${data.question_num} von ${data.total_questions}`;
    elements.questionText.textContent = data.question;
    elements.answeredCount.textContent = '0';
    elements.totalPlayersDisplay.textContent = totalPlayers;
    
    // Set up answer options
    data.answers.forEach((answer, i) => {
        document.getElementById(`answer-${i}`).textContent = answer;
        const option = document.querySelector(`.answer-option.answer-${i}`);
        option.classList.remove('correct', 'incorrect');
    });
    
    // Reset timer
    elements.timerProgress.style.strokeDashoffset = '0';
    elements.timerProgress.classList.remove('warning', 'danger');
    elements.timerText.textContent = timeLimit;
    
    showScreen('question');
    
    // Start timer
    let timeLeft = timeLimit;
    const circumference = 283; // 2 * PI * 45
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        const progress = timeLeft / timeLimit;
        elements.timerProgress.style.strokeDashoffset = circumference * (1 - progress);
        elements.timerText.textContent = Math.ceil(timeLeft);
        
        if (progress < 0.25) {
            elements.timerProgress.classList.add('danger');
            elements.timerProgress.classList.remove('warning');
        } else if (progress < 0.5) {
            elements.timerProgress.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            socket.emit('time_up', { code: gameCode });
        }
    }, 100);
});

socket.on('answer_update', (data) => {
    elements.answeredCount.textContent = data.answered;
    elements.totalPlayersDisplay.textContent = data.total;
    totalPlayers = data.total;
});

socket.on('show_results', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    
    // Highlight correct/incorrect answers
    document.querySelectorAll('.answer-option').forEach((option, i) => {
        if (i === data.correct_index) {
            option.classList.add('correct');
        } else {
            option.classList.add('incorrect');
        }
    });
    
    // Wait a moment to show the highlight, then show results
    setTimeout(() => {
        elements.correctAnswerBox.textContent = data.correct_answer;
        elements.correctAnswerBox.className = `correct-answer-box answer-${data.correct_index}`;
        
        // Update answer stats
        const totalAnswers = data.answer_counts.reduce((a, b) => a + b, 0) || 1;
        data.answer_counts.forEach((count, i) => {
            const percent = (count / totalAnswers) * 100;
            document.getElementById(`stat-fill-${i}`).style.height = `${percent}%`;
            document.getElementById(`stat-count-${i}`).textContent = count;
        });
        
        // Update leaderboard preview
        elements.leaderboardPreview.innerHTML = '';
        data.results.forEach((player, i) => {
            const item = document.createElement('div');
            item.className = `leaderboard-item ${player.correct ? 'correct' : 'incorrect'}`;
            item.innerHTML = `
                <span class="leaderboard-rank">${i + 1}</span>
                <span class="leaderboard-name">${player.name}</span>
                <span class="leaderboard-score">${player.total_score}</span>
                ${player.score_gained > 0 ? `<span class="leaderboard-gained">+${player.score_gained}</span>` : ''}
            `;
            elements.leaderboardPreview.appendChild(item);
        });
        
        showScreen('results');
    }, 1500);
});

socket.on('game_ended', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    
    if (data.reason) {
        alert(data.reason);
        showScreen('select');
        return;
    }
    
    const leaderboard = data.leaderboard;
    
    // Create podium
    elements.podium.innerHTML = '';
    const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
    const medals = ['🥇', '🥈', '🥉'];
    const standClasses = ['second', 'first', 'third'];
    
    podiumOrder.forEach((rank, displayOrder) => {
        if (leaderboard[rank]) {
            const place = document.createElement('div');
            place.className = 'podium-place';
            place.innerHTML = `
                <div class="podium-avatar">${medals[rank]}</div>
                <div class="podium-name">${leaderboard[rank].name}</div>
                <div class="podium-score">${leaderboard[rank].score} Punkte</div>
                <div class="podium-stand ${standClasses[displayOrder]}">${rank + 1}</div>
            `;
            elements.podium.appendChild(place);
        }
    });
    
    // Full leaderboard (rest of players)
    elements.fullLeaderboard.innerHTML = '';
    leaderboard.slice(3).forEach((player, i) => {
        const item = document.createElement('div');
        item.className = 'final-leaderboard-item';
        item.innerHTML = `
            <span class="rank">${i + 4}.</span>
            <span class="name">${player.name}</span>
            <span class="score">${player.score}</span>
        `;
        elements.fullLeaderboard.appendChild(item);
    });
    
    // Create confetti
    createConfetti();
    
    showScreen('final');
});

function createConfetti() {
    elements.confetti.innerHTML = '';
    const colors = ['#E74C3C', '#3498DB', '#F39C12', '#27AE60', '#9B59B6', '#FD79A8'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
        elements.confetti.appendChild(confetti);
    }
}

socket.on('error', (data) => {
    alert(data.message);
});
