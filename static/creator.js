// QuizKnaller - Quiz Creator

const STORAGE_KEY = 'quizknaller_custom_quiz';

// State
let questions = [];

// DOM Elements
const quizTitleInput = document.getElementById('quiz-title');
const questionCountDisplay = document.getElementById('question-count');
const questionsContainer = document.getElementById('questions-container');
const addQuestionBtn = document.getElementById('add-question-btn');
const saveLocalBtn = document.getElementById('save-local-btn');
const loadLocalBtn = document.getElementById('load-local-btn');
const downloadBtn = document.getElementById('download-btn');
const uploadInput = document.getElementById('upload-input');
const clearBtn = document.getElementById('clear-btn');
const toast = document.getElementById('toast');

// Initialize
init();

function init() {
    // Add event listeners
    addQuestionBtn.addEventListener('click', addQuestion);
    saveLocalBtn.addEventListener('click', saveToLocalStorage);
    loadLocalBtn.addEventListener('click', loadFromLocalStorage);
    downloadBtn.addEventListener('click', downloadAsJSON);
    uploadInput.addEventListener('change', handleFileUpload);
    clearBtn.addEventListener('click', clearAll);
    
    // Show empty state
    updateUI();
}

function addQuestion() {
    const question = {
        id: Date.now(),
        question: '',
        answers: ['', '', '', ''],
        correct: 0,
        time_limit: 20
    };
    
    questions.push(question);
    renderQuestion(question, questions.length - 1);
    updateUI();
    
    // Scroll to the new question
    setTimeout(() => {
        const newCard = document.querySelector(`[data-question-id="${question.id}"]`);
        if (newCard) {
            newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

function renderQuestion(question, index) {
    const questionCard = document.createElement('div');
    questionCard.className = 'question-card';
    questionCard.dataset.questionId = question.id;
    
    questionCard.innerHTML = `
        <div class="question-header">
            <span class="question-number">Frage ${index + 1}</span>
            <button class="btn-remove" onclick="removeQuestion(${question.id})">🗑️ Löschen</button>
        </div>
        
        <div class="form-group">
            <label>Frage *</label>
            <textarea placeholder="Gib deine Frage ein..." data-field="question">${question.question}</textarea>
        </div>
        
        <div class="form-group">
            <label>Antworten * (Wähle die richtige Antwort)</label>
            <div class="answers-grid">
                ${question.answers.map((answer, i) => `
                    <div class="answer-input-group">
                        <input type="radio" name="correct-${question.id}" value="${i}" 
                            ${question.correct === i ? 'checked' : ''} 
                            data-field="correct">
                        <span class="answer-label">Antwort ${i + 1}:</span>
                        <input type="text" placeholder="Antwort eingeben..." 
                            value="${answer}" data-field="answer-${i}">
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="form-group">
            <label>Zeitlimit (Sekunden) *</label>
            <div class="time-limit-group">
                <input type="number" min="5" max="120" value="${question.time_limit}" 
                    data-field="time_limit">
                <span>Sekunden</span>
            </div>
        </div>
    `;
    
    questionsContainer.appendChild(questionCard);
    
    // Add event listeners for this question
    attachQuestionListeners(questionCard, question.id);
}

function attachQuestionListeners(card, questionId) {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return;
    
    // Question text
    const questionTextarea = card.querySelector('[data-field="question"]');
    questionTextarea.addEventListener('input', (e) => {
        questions[questionIndex].question = e.target.value;
    });
    
    // Answers
    for (let i = 0; i < 4; i++) {
        const answerInput = card.querySelector(`[data-field="answer-${i}"]`);
        answerInput.addEventListener('input', (e) => {
            questions[questionIndex].answers[i] = e.target.value;
        });
    }
    
    // Correct answer
    const correctRadios = card.querySelectorAll('[data-field="correct"]');
    correctRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            questions[questionIndex].correct = parseInt(e.target.value);
        });
    });
    
    // Time limit
    const timeLimitInput = card.querySelector('[data-field="time_limit"]');
    timeLimitInput.addEventListener('input', (e) => {
        questions[questionIndex].time_limit = parseInt(e.target.value);
    });
}

function removeQuestion(questionId) {
    if (!confirm('Möchtest du diese Frage wirklich löschen?')) {
        return;
    }
    
    const index = questions.findIndex(q => q.id === questionId);
    if (index !== -1) {
        questions.splice(index, 1);
        updateUI();
    }
}

function updateUI() {
    questionCountDisplay.textContent = questions.length;
    
    // Clear and re-render all questions
    questionsContainer.innerHTML = '';
    
    if (questions.length === 0) {
        questionsContainer.innerHTML = `
            <div class="empty-state">
                <p>Noch keine Fragen vorhanden.</p>
                <p>Klicke auf "+ Frage hinzufügen", um zu starten!</p>
            </div>
        `;
    } else {
        questions.forEach((question, index) => {
            renderQuestion(question, index);
        });
    }
}

function validateQuiz() {
    if (!quizTitleInput.value.trim()) {
        showToast('Bitte gib einen Quiz-Titel ein!', 'error');
        quizTitleInput.focus();
        return false;
    }
    
    if (questions.length === 0) {
        showToast('Bitte füge mindestens eine Frage hinzu!', 'error');
        return false;
    }
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        if (!q.question.trim()) {
            showToast(`Frage ${i + 1}: Bitte gib einen Fragetext ein!`, 'error');
            return false;
        }
        
        for (let j = 0; j < 4; j++) {
            if (!q.answers[j].trim()) {
                showToast(`Frage ${i + 1}: Bitte fülle alle Antworten aus!`, 'error');
                return false;
            }
        }
        
        if (q.time_limit < 5 || q.time_limit > 120) {
            showToast(`Frage ${i + 1}: Zeitlimit muss zwischen 5 und 120 Sekunden liegen!`, 'error');
            return false;
        }
    }
    
    return true;
}

function getQuizData() {
    return {
        title: quizTitleInput.value.trim(),
        questions: questions.map(q => ({
            question: q.question.trim(),
            answers: q.answers.map(a => a.trim()),
            correct: q.correct,
            time_limit: q.time_limit
        }))
    };
}

function saveToLocalStorage() {
    if (!validateQuiz()) {
        return;
    }
    
    const quizData = getQuizData();
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(quizData));
        showToast('Quiz erfolgreich im Browser gespeichert! 💾', 'success');
    } catch (e) {
        showToast('Fehler beim Speichern: ' + e.message, 'error');
    }
}

function loadFromLocalStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        
        if (!data) {
            showToast('Kein gespeichertes Quiz gefunden!', 'error');
            return;
        }
        
        if (!confirm('Möchtest du das gespeicherte Quiz laden? Aktuelle Änderungen gehen verloren!')) {
            return;
        }
        
        const quizData = JSON.parse(data);
        loadQuizData(quizData);
        showToast('Quiz erfolgreich geladen! 📂', 'success');
    } catch (e) {
        showToast('Fehler beim Laden: ' + e.message, 'error');
    }
}

function downloadAsJSON() {
    if (!validateQuiz()) {
        return;
    }
    
    const quizData = getQuizData();
    
    // Create a quiz array with the single quiz (matching the quizzes.json format)
    const exportData = [quizData];
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_${quizData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Quiz als JSON heruntergeladen! ⬇️', 'success');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Check if it's an array (multiple quizzes) or single quiz
            let quizData;
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    showToast('Die JSON-Datei enthält keine Quizze!', 'error');
                    return;
                }
                // Take the first quiz from the array
                quizData = data[0];
            } else {
                quizData = data;
            }
            
            // Validate structure
            if (!quizData.title || !Array.isArray(quizData.questions)) {
                showToast('Ungültiges Quiz-Format!', 'error');
                return;
            }
            
            if (!confirm('Möchtest du dieses Quiz laden? Aktuelle Änderungen gehen verloren!')) {
                return;
            }
            
            loadQuizData(quizData);
            showToast('Quiz erfolgreich importiert! ⬆️', 'success');
        } catch (e) {
            showToast('Fehler beim Lesen der Datei: ' + e.message, 'error');
        }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function loadQuizData(quizData) {
    quizTitleInput.value = quizData.title;
    
    questions = quizData.questions.map((q, index) => ({
        id: Date.now() + index,
        question: q.question,
        answers: q.answers,
        correct: q.correct,
        time_limit: q.time_limit
    }));
    
    updateUI();
}

function clearAll() {
    if (!confirm('Möchtest du wirklich alles löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
        return;
    }
    
    quizTitleInput.value = '';
    questions = [];
    updateUI();
    showToast('Alles gelöscht! 🗑️', 'success');
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Make removeQuestion globally accessible
window.removeQuestion = removeQuestion;
