// QuizKnaller - Host Client
const socket = io();

// Configuration
const AUTOPLAY_COUNTDOWN_SECONDS = 10;
const CUSTOM_QUIZZES_STORAGE_KEY = 'quizknaller_custom_quizzes';

let gameCode = null;
let correctIndex = null;
let timeLimit = 20;
let timerInterval = null;
let totalPlayers = 0;
let autoplayEnabled = false;
let autoplayTimeout = null;
let autoplayCountdownInterval = null;

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
    uploadQuizBtn: document.getElementById('upload-quiz-btn'),
    uploadQuizInput: document.getElementById('upload-quiz-input'),
    lobbyQuizTitle: document.getElementById('lobby-quiz-title'),
    joinUrl: document.getElementById('join-url'),
    gameCodeDisplay: document.getElementById('game-code-display'),
    qrCode: document.getElementById('qr-code'),
    playerCount: document.getElementById('player-count'),
    playersGrid: document.getElementById('players-grid'),
    startGameBtn: document.getElementById('start-game-btn'),
    endGameBtn: document.getElementById('end-game-btn'),
    autoplayCheckbox: document.getElementById('autoplay-checkbox'),
    // Desktop team config elements
    teamModeCheckbox: document.getElementById('team-mode-checkbox'),
    teamSettings: document.getElementById('team-settings'),
    teamsInput: document.getElementById('teams-input'),
    topNInput: document.getElementById('top-n-input'),
    saveTeamsBtn: document.getElementById('save-teams-btn'),
    // Mobile team config elements
    teamModeCheckboxMobile: document.getElementById('team-mode-checkbox-mobile'),
    teamSettingsMobile: document.getElementById('team-settings-mobile'),
    teamsInputMobile: document.getElementById('teams-input-mobile'),
    topNInputMobile: document.getElementById('top-n-input-mobile'),
    saveTeamsBtnMobile: document.getElementById('save-teams-btn-mobile'),
    // Desktop auto-remove config elements
    autoRemoveCheckbox: document.getElementById('auto-remove-checkbox'),
    autoRemoveSettings: document.getElementById('auto-remove-settings'),
    inactivityThreshold: document.getElementById('inactivity-threshold'),
    // Mobile auto-remove config elements
    autoRemoveCheckboxMobile: document.getElementById('auto-remove-checkbox-mobile'),
    autoRemoveSettingsMobile: document.getElementById('auto-remove-settings-mobile'),
    inactivityThresholdMobile: document.getElementById('inactivity-threshold-mobile'),
    // Offcanvas elements
    teamConfigToggle: document.getElementById('team-config-toggle'),
    teamConfigOffcanvas: document.getElementById('team-config-offcanvas'),
    teamConfigClose: document.getElementById('team-config-close'),
    offcanvasBackdrop: document.getElementById('offcanvas-backdrop'),
    // Header game code elements
    questionGameCode: document.getElementById('question-game-code'),
    resultsGameCode: document.getElementById('results-game-code'),
    endGameBtnResults: document.getElementById('end-game-btn-results'),
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
    autoplayCountdown: document.getElementById('autoplay-countdown'),
    autoplayTimer: document.getElementById('autoplay-timer'),
    autoplayMessage: document.getElementById('autoplay-message'),
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

// Update game code displays in headers
function updateHeaderGameCodes(code) {
    const codeValue = code || '';
    document.querySelectorAll('.header-code-value').forEach(el => {
        el.textContent = codeValue;
    });
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Custom quiz management
function getCustomQuizzes() {
    try {
        const data = localStorage.getItem(CUSTOM_QUIZZES_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading custom quizzes:', e);
        return [];
    }
}

function saveCustomQuizzes(quizzes) {
    try {
        localStorage.setItem(CUSTOM_QUIZZES_STORAGE_KEY, JSON.stringify(quizzes));
    } catch (e) {
        console.error('Error saving custom quizzes:', e);
        alert('Fehler beim Speichern der Quizze: ' + e.message);
    }
}

function addCustomQuiz(quizData) {
    const customQuizzes = getCustomQuizzes();
    const newQuiz = {
        id: `custom_${Date.now()}`,
        ...quizData,
        isCustom: true
    };
    customQuizzes.push(newQuiz);
    saveCustomQuizzes(customQuizzes);
    return newQuiz;
}

function deleteCustomQuiz(quizId) {
    const customQuizzes = getCustomQuizzes();
    const filtered = customQuizzes.filter(q => q.id !== quizId);
    saveCustomQuizzes(filtered);
}

// Load quizzes
async function loadQuizzes() {
    const response = await fetch('/api/quizzes');
    const defaultQuizzes = await response.json();
    const customQuizzes = getCustomQuizzes();
    
    elements.quizList.innerHTML = '';
    
    // Add default quizzes
    defaultQuizzes.forEach(quiz => {
        const card = createQuizCard(quiz, false);
        elements.quizList.appendChild(card);
    });
    
    // Add custom quizzes
    customQuizzes.forEach(quiz => {
        const card = createQuizCard(quiz, true);
        elements.quizList.appendChild(card);
    });
}

function createQuizCard(quiz, isCustom) {
    const card = document.createElement('div');
    card.className = isCustom ? 'quiz-card custom-quiz' : 'quiz-card';
    
    const questionCount = isCustom 
        ? quiz.questions.length 
        : quiz.questionCount;
    
    card.innerHTML = `
        <h3>${escapeHtml(quiz.title)}</h3>
        <span>${questionCount} Fragen</span>
        ${isCustom ? '<button class="delete-quiz-btn" title="Quiz löschen">🗑️</button>' : ''}
    `;
    
    // Add click handler for playing the quiz
    const cardClickArea = card;
    cardClickArea.addEventListener('click', (e) => {
        // Don't trigger if clicking delete button
        if (e.target.classList.contains('delete-quiz-btn')) {
            return;
        }
        
        if (isCustom) {
            // Create game with custom quiz data
            socket.emit('create_custom_game', { quiz: quiz });
        } else {
            socket.emit('create_game', { quiz_id: quiz.id });
        }
    });
    
    // Add delete handler for custom quizzes
    if (isCustom) {
        const deleteBtn = card.querySelector('.delete-quiz-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Möchtest du das Quiz "${quiz.title}" wirklich löschen?`)) {
                deleteCustomQuiz(quiz.id);
                loadQuizzes();
            }
        });
    }
    
    return card;
}

// Handle file upload
function handleQuizUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Check if it's an array (multiple quizzes) or single quiz
            let quizzes;
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    alert('Die JSON-Datei enthält keine Quizze!');
                    return;
                }
                quizzes = data;
            } else {
                quizzes = [data];
            }
            
            // Validate and add each quiz
            let addedCount = 0;
            for (const quizData of quizzes) {
                // Validate structure
                if (!quizData.title || !Array.isArray(quizData.questions)) {
                    alert(`Ungültiges Quiz-Format in einem der Quizze!`);
                    continue;
                }
                
                // Validate each question
                let valid = true;
                for (let i = 0; i < quizData.questions.length; i++) {
                    const q = quizData.questions[i];
                    if (!q.question || 
                        !Array.isArray(q.answers) || 
                        q.answers.length !== 4 ||
                        typeof q.correct !== 'number' ||
                        q.correct < 0 || 
                        q.correct > 3 ||
                        typeof q.time_limit !== 'number' ||
                        q.time_limit < 5 ||
                        q.time_limit > 120) {
                        alert(`Ungültiges Format bei Frage ${i + 1} in Quiz "${quizData.title}"!`);
                        valid = false;
                        break;
                    }
                }
                
                if (valid) {
                    addCustomQuiz(quizData);
                    addedCount++;
                }
            }
            
            if (addedCount > 0) {
                alert(`${addedCount} Quiz(ze) erfolgreich hochgeladen! ⬆️`);
                loadQuizzes();
            }
        } catch (e) {
            alert('Fehler beim Lesen der Datei: ' + e.message);
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}

// Initialize upload handler
elements.uploadQuizBtn.addEventListener('click', () => {
    elements.uploadQuizInput.click();
});

elements.uploadQuizInput.addEventListener('change', handleQuizUpload);

// Initialize
loadQuizzes();

// Try to reconnect on page load
window.addEventListener('load', () => {
    const savedGameCode = localStorage.getItem('hostGameCode');
    if (savedGameCode) {
        socket.emit('reconnect_host', { code: savedGameCode });
    }
});

// Reconnection handlers
socket.on('reconnected_host', (data) => {
    gameCode = data.code;
    
    // Update localStorage
    localStorage.setItem('hostGameCode', data.code);
    localStorage.setItem('hostQuizTitle', data.quiz_title);
    
    // Update header game codes
    updateHeaderGameCodes(data.code);
    
    elements.lobbyQuizTitle.textContent = data.quiz_title;
    elements.joinUrl.textContent = window.location.host;
    elements.gameCodeDisplay.textContent = data.code;
    elements.qrCode.src = `/api/qrcode?code=${data.code}`;
    
    // Restore players using helper function
    updatePlayerDisplay(data.players);
    
    // Restore to appropriate screen based on state
    if (data.state === 'lobby') {
        showScreen('lobby');
    } else if (data.state === 'starting') {
        showScreen('countdown');
    } else if (data.state === 'question') {
        // Host will receive show_question event from backend
        showScreen('lobby'); // Temporary, will switch when question arrives
    } else if (data.state === 'results') {
        showScreen('lobby'); // Temporary
    } else if (data.state === 'ended') {
        showScreen('final');
    }
});

socket.on('reconnect_failed', (data) => {
    localStorage.removeItem('hostGameCode');
    localStorage.removeItem('hostQuizTitle');
    updateHeaderGameCodes(null);
    alert(data.message || 'Verbindung fehlgeschlagen');
    showScreen('select');
});

// Offcanvas toggle functions
function openOffcanvas() {
    elements.teamConfigOffcanvas.classList.add('open');
    elements.offcanvasBackdrop.classList.add('open');
}

function closeOffcanvas() {
    elements.teamConfigOffcanvas.classList.remove('open');
    elements.offcanvasBackdrop.classList.remove('open');
}

// Event Listeners
elements.startGameBtn.addEventListener('click', () => {
    // Initialize sound on first user interaction
    soundManager.init();
    socket.emit('start_game', { code: gameCode });
});

elements.endGameBtn.addEventListener('click', () => {
    if (confirm('Möchtest du das Spiel wirklich beenden?')) {
        socket.emit('end_game_request', { code: gameCode });
        gameCode = null;
        localStorage.removeItem('hostGameCode');
        localStorage.removeItem('hostQuizTitle');
        updateHeaderGameCodes(null);
        showScreen('select');
    }
});

// End game button on results screen
elements.endGameBtnResults.addEventListener('click', () => {
    if (confirm('Möchtest du das Spiel wirklich beenden?')) {
        socket.emit('end_game_request', { code: gameCode });
        gameCode = null;
        localStorage.removeItem('hostGameCode');
        localStorage.removeItem('hostQuizTitle');
        updateHeaderGameCodes(null);
        showScreen('select');
    }
});

// Offcanvas toggle
elements.teamConfigToggle.addEventListener('click', openOffcanvas);
elements.teamConfigClose.addEventListener('click', closeOffcanvas);
elements.offcanvasBackdrop.addEventListener('click', closeOffcanvas);

elements.autoplayCheckbox.addEventListener('change', (e) => {
    autoplayEnabled = e.target.checked;
});

// Desktop team mode checkbox
elements.teamModeCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        elements.teamSettings.style.display = 'block';
    } else {
        elements.teamSettings.style.display = 'none';
        // Disable team mode
        socket.emit('configure_teams', {
            code: gameCode,
            team_mode: false,
            teams: [],
            top_n_players: 3
        });
    }
});

// Mobile team mode checkbox
elements.teamModeCheckboxMobile.addEventListener('change', (e) => {
    if (e.target.checked) {
        elements.teamSettingsMobile.style.display = 'block';
    } else {
        elements.teamSettingsMobile.style.display = 'none';
        // Disable team mode
        socket.emit('configure_teams', {
            code: gameCode,
            team_mode: false,
            teams: [],
            top_n_players: 3
        });
    }
});

// Desktop save teams
elements.saveTeamsBtn.addEventListener('click', () => {
    const teamsText = elements.teamsInput.value.trim();
    const topN = parseInt(elements.topNInput.value) || 3;
    
    if (!teamsText) {
        alert('Bitte geben Sie mindestens ein Team ein');
        return;
    }
    
    const teams = teamsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    if (teams.length < 2) {
        alert('Bitte geben Sie mindestens 2 Teams ein');
        return;
    }
    
    socket.emit('configure_teams', {
        code: gameCode,
        team_mode: true,
        teams: teams,
        top_n_players: topN
    });
    
    alert('Team-Konfiguration gespeichert!');
    closeOffcanvas();
});

// Mobile save teams
elements.saveTeamsBtnMobile.addEventListener('click', () => {
    const teamsText = elements.teamsInputMobile.value.trim();
    const topN = parseInt(elements.topNInputMobile.value) || 3;
    
    if (!teamsText) {
        alert('Bitte geben Sie mindestens ein Team ein');
        return;
    }
    
    const teams = teamsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    if (teams.length < 2) {
        alert('Bitte geben Sie mindestens 2 Teams ein');
        return;
    }
    
    socket.emit('configure_teams', {
        code: gameCode,
        team_mode: true,
        teams: teams,
        top_n_players: topN
    });
    
    alert('Team-Konfiguration gespeichert!');
});

// Desktop auto-remove checkbox
elements.autoRemoveCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        elements.autoRemoveSettings.style.display = 'block';
        // Enable auto-remove with current threshold
        const threshold = parseInt(elements.inactivityThreshold.value) || 3;
        socket.emit('configure_auto_remove', {
            code: gameCode,
            auto_remove_inactive: true,
            inactivity_threshold: threshold
        });
    } else {
        elements.autoRemoveSettings.style.display = 'none';
        // Disable auto-remove
        socket.emit('configure_auto_remove', {
            code: gameCode,
            auto_remove_inactive: false,
            inactivity_threshold: 3
        });
    }
});

// Mobile auto-remove checkbox
elements.autoRemoveCheckboxMobile.addEventListener('change', (e) => {
    if (e.target.checked) {
        elements.autoRemoveSettingsMobile.style.display = 'block';
        // Enable auto-remove with current threshold
        const threshold = parseInt(elements.inactivityThresholdMobile.value) || 3;
        socket.emit('configure_auto_remove', {
            code: gameCode,
            auto_remove_inactive: true,
            inactivity_threshold: threshold
        });
    } else {
        elements.autoRemoveSettingsMobile.style.display = 'none';
        // Disable auto-remove
        socket.emit('configure_auto_remove', {
            code: gameCode,
            auto_remove_inactive: false,
            inactivity_threshold: 3
        });
    }
});

// Update threshold when changed (desktop)
elements.inactivityThreshold.addEventListener('change', (e) => {
    if (elements.autoRemoveCheckbox.checked) {
        const threshold = parseInt(e.target.value) || 3;
        socket.emit('configure_auto_remove', {
            code: gameCode,
            auto_remove_inactive: true,
            inactivity_threshold: threshold
        });
    }
});

// Update threshold when changed (mobile)
elements.inactivityThresholdMobile.addEventListener('change', (e) => {
    if (elements.autoRemoveCheckboxMobile.checked) {
        const threshold = parseInt(e.target.value) || 3;
        socket.emit('configure_auto_remove', {
            code: gameCode,
            auto_remove_inactive: true,
            inactivity_threshold: threshold
        });
    }
});

elements.nextQuestionBtn.addEventListener('click', () => {
    if (autoplayTimeout) {
        clearTimeout(autoplayTimeout);
        autoplayTimeout = null;
    }
    if (autoplayCountdownInterval) {
        clearInterval(autoplayCountdownInterval);
        autoplayCountdownInterval = null;
    }
    if (elements.autoplayCountdown) {
        elements.autoplayCountdown.style.display = 'none';
    }
    socket.emit('next_question_request', { code: gameCode });
});

elements.newGameBtn.addEventListener('click', () => {
    gameCode = null;
    localStorage.removeItem('hostGameCode');
    localStorage.removeItem('hostQuizTitle');
    updateHeaderGameCodes(null);
    loadQuizzes();
    showScreen('select');
});

// Socket Events
socket.on('game_created', (data) => {
    gameCode = data.code;
    // Save to localStorage for reconnection
    localStorage.setItem('hostGameCode', data.code);
    localStorage.setItem('hostQuizTitle', data.quiz_title);
    
    elements.lobbyQuizTitle.textContent = data.quiz_title;
    elements.joinUrl.textContent = window.location.host;
    elements.gameCodeDisplay.textContent = data.code;
    elements.qrCode.src = `/api/qrcode?code=${data.code}`;
    elements.playersGrid.innerHTML = '';
    elements.playerCount.textContent = '0';
    elements.startGameBtn.disabled = true;
    
    // Update header game codes
    updateHeaderGameCodes(data.code);
    
    showScreen('lobby');
});

// Helper function to update player display
function updatePlayerDisplay(players) {
    elements.playersGrid.innerHTML = '';
    
    // Group players by team if team mode is active
    const teamMode = players.some(p => p.team !== null && p.team !== undefined);
    
    if (teamMode) {
        // Group players by team
        const teams = {};
        const noTeam = [];
        
        players.forEach(player => {
            if (player.team) {
                if (!teams[player.team]) teams[player.team] = [];
                teams[player.team].push(player);
            } else {
                noTeam.push(player);
            }
        });
        
        // Display teams
        Object.keys(teams).forEach(teamName => {
            const teamHeader = document.createElement('div');
            teamHeader.className = 'team-header';
            teamHeader.textContent = teamName;
            elements.playersGrid.appendChild(teamHeader);
            
            teams[teamName].forEach(player => {
                const chip = document.createElement('div');
                chip.className = 'player-chip';
                chip.textContent = player.name;
                elements.playersGrid.appendChild(chip);
            });
        });
        
        // Display players without team
        if (noTeam.length > 0) {
            const teamHeader = document.createElement('div');
            teamHeader.className = 'team-header no-team';
            teamHeader.textContent = 'Kein Team';
            elements.playersGrid.appendChild(teamHeader);
            
            noTeam.forEach(player => {
                const chip = document.createElement('div');
                chip.className = 'player-chip no-team';
                chip.textContent = player.name;
                elements.playersGrid.appendChild(chip);
            });
        }
    } else {
        // Normal display
        players.forEach(player => {
            const chip = document.createElement('div');
            chip.className = 'player-chip';
            chip.textContent = player.name;
            elements.playersGrid.appendChild(chip);
        });
    }
    
    totalPlayers = players.length;
    elements.playerCount.textContent = totalPlayers;
    elements.startGameBtn.disabled = totalPlayers < 1;
}

socket.on('player_joined', (data) => {
    updatePlayerDisplay(data.players);
});

socket.on('player_left', (data) => {
    updatePlayerDisplay(data.players);
});

socket.on('player_updated', (data) => {
    updatePlayerDisplay(data.players);
});

socket.on('game_starting', () => {
    showScreen('countdown');
    let count = 3;
    elements.countdownNumber.textContent = count;
    
    // Play countdown tick sound
    soundManager.playCountdownTick().catch(() => {}); // Silently ignore sound errors
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.countdownNumber.textContent = count;
            soundManager.playCountdownTick().catch(() => {}); // Silently ignore sound errors
        } else {
            clearInterval(countdownInterval);
            soundManager.playCountdownFinal().catch(() => {}); // Silently ignore sound errors
        }
    }, 1000);
});

// Reading phase - show question only
socket.on('show_question_reading', (data) => {
    // Clear previous state
    if (timerInterval) clearInterval(timerInterval);
    
    // Start background music on first question
    if (data.question_num === 1) {
        soundManager.startBackgroundMusic().catch(() => {}); // Silently ignore sound errors
    }
    
    totalPlayers = parseInt(elements.playerCount.textContent) || totalPlayers;
    
    elements.questionNumber.textContent = `Frage ${data.question_num} von ${data.total_questions}`;
    elements.questionText.textContent = data.question;
    elements.answeredCount.textContent = '0';
    elements.totalPlayersDisplay.textContent = totalPlayers;
    
    // Hide answer options during reading phase
    document.querySelectorAll('.answer-option').forEach((option, i) => {
        option.classList.remove('correct', 'incorrect');
        option.classList.add('hidden');
        document.getElementById(`answer-${i}`).textContent = '';
    });
    
    // Show reading countdown in timer
    elements.timerProgress.style.strokeDashoffset = '0';
    elements.timerProgress.classList.remove('warning', 'danger');
    elements.timerProgress.classList.add('reading');
    elements.timerText.textContent = '📖';
    
    showScreen('question');
    
    // Animate reading countdown
    let readingTimeLeft = data.reading_time;
    const circumference = 283;
    
    timerInterval = setInterval(() => {
        readingTimeLeft -= 0.1;
        const progress = readingTimeLeft / data.reading_time;
        elements.timerProgress.style.strokeDashoffset = circumference * (1 - progress);
        
        if (readingTimeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 100);
});

// Show answers after reading phase
socket.on('show_answers', (data) => {
    // Clear reading timer
    if (timerInterval) clearInterval(timerInterval);
    
    correctIndex = data.correct_index;
    timeLimit = data.time_limit;
    
    // Reveal answer options
    data.answers.forEach((answer, i) => {
        document.getElementById(`answer-${i}`).textContent = answer;
        const option = document.querySelector(`.answer-option.answer-${i}`);
        option.classList.remove('hidden', 'correct', 'incorrect');
    });
    
    // Reset and start answer timer
    elements.timerProgress.style.strokeDashoffset = '0';
    elements.timerProgress.classList.remove('warning', 'danger', 'reading');
    elements.timerText.textContent = timeLimit;
    
    // Start timer
    let timeLeft = timeLimit;
    const circumference = 283;
    
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

// Legacy handler for backwards compatibility
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
        option.classList.remove('correct', 'incorrect', 'hidden');
    });
    
    // Reset timer
    elements.timerProgress.style.strokeDashoffset = '0';
    elements.timerProgress.classList.remove('warning', 'danger', 'reading');
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
    
    // Play feedback sound when an answer is submitted
    soundManager.playPopSound().catch(() => {}); // Silently ignore sound errors
});

socket.on('show_results', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    
    // Play round end sound
    soundManager.playRoundEndSound().catch(() => {}); // Silently ignore sound errors
    
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
        const totalAnswers = data.answer_counts.reduce((a, b) => a + b, 0);
        data.answer_counts.forEach((count, i) => {
            const percent = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
            document.getElementById(`stat-fill-${i}`).style.height = `${percent}%`;
            document.getElementById(`stat-count-${i}`).textContent = count;
            document.getElementById(`stat-percent-${i}`).textContent = `${Math.round(percent)}%`;
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
        
        // Auto-advance to next question if autoplay is enabled
        if (autoplayEnabled) {
            let countdown = AUTOPLAY_COUNTDOWN_SECONDS;
            elements.autoplayTimer.textContent = countdown;
            
            // Set message based on whether this is the last question
            if (data.is_last_question) {
                elements.autoplayMessage.textContent = '🎉 Ergebnisse in';
            } else {
                elements.autoplayMessage.textContent = 'Nächste Frage in';
            }
            
            elements.autoplayCountdown.style.display = 'block';
            
            // Notify players about autoplay countdown (with is_last_question flag)
            socket.emit('autoplay_started', { code: gameCode, seconds: countdown, is_last_question: data.is_last_question });
            
            autoplayCountdownInterval = setInterval(() => {
                countdown--;
                elements.autoplayTimer.textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(autoplayCountdownInterval);
                    autoplayCountdownInterval = null;
                }
            }, 1000);
            
            autoplayTimeout = setTimeout(() => {
                elements.autoplayCountdown.style.display = 'none';
                elements.nextQuestionBtn.click();
            }, AUTOPLAY_COUNTDOWN_SECONDS * 1000);
        }
    }, 1500);
});

socket.on('game_ended', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    localStorage.removeItem('hostGameCode');
    
    // Stop background music
    soundManager.stopBackgroundMusic();
    
    // Play celebration sound for final leaderboard
    soundManager.playCelebrationSound().catch(() => {}); // Silently ignore sound errors
    
    if (data.reason) {
        alert(data.reason);
        showScreen('select');
        return;
    }
    
    const leaderboard = data.leaderboard;
    
    // If team mode, show team leaderboard first
    if (data.team_mode && data.team_leaderboard && data.team_leaderboard.length > 0) {
        // Create team podium
        elements.podium.innerHTML = '<h2 style="text-align: center; margin-bottom: 20px;">Team-Rangliste</h2>';
        const teamPodiumOrder = [1, 0, 2];
        const medals = ['🥇', '🥈', '🥉'];
        const standClasses = ['second', 'first', 'third'];
        
        teamPodiumOrder.forEach((rank, displayOrder) => {
            if (data.team_leaderboard[rank]) {
                const place = document.createElement('div');
                place.className = 'podium-place';
                place.innerHTML = `
                    <div class="podium-avatar">${medals[rank]}</div>
                    <div class="podium-name">${data.team_leaderboard[rank].team}</div>
                    <div class="podium-score">${data.team_leaderboard[rank].score} Punkte</div>
                    <div class="podium-stand ${standClasses[displayOrder]}">${rank + 1}</div>
                `;
                elements.podium.appendChild(place);
            }
        });
        
        // Show individual leaderboard
        elements.fullLeaderboard.innerHTML = '<h3 style="text-align: center; margin: 20px 0;">Individuelle Rangliste</h3>';
        leaderboard.forEach((player, i) => {
            const item = document.createElement('div');
            item.className = 'final-leaderboard-item';
            item.innerHTML = `
                <span class="rank">${i + 1}.</span>
                <span class="name">${player.name}${player.team ? ` (${player.team})` : ''}</span>
                <span class="score">${player.score}</span>
            `;
            elements.fullLeaderboard.appendChild(item);
        });
    } else {
        // Normal individual podium
        elements.podium.innerHTML = '';
        const podiumOrder = [1, 0, 2];
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
    }
    
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

socket.on('inactive_players_removed', (data) => {
    const playerNames = data.players.join(', ');
    const message = `${data.count} inaktive Spieler entfernt: ${playerNames}`;
    
    // Show a notification (could be improved with a nicer toast notification)
    console.log(message);
    
    // You could also show a subtle toast message here instead of alert
    // For now, we'll just log it to avoid disrupting the game flow
});
