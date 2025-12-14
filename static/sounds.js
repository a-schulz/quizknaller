// QuizKnaller - Sound Manager
// Manages all game sounds using Web Audio API

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterVolume = 0.3; // Default volume (0.0 to 1.0)
        this.backgroundMusic = null;
        this.isMuted = false;
        
        // Initialize audio context on first user interaction
        this.initialized = false;
    }

    // Initialize audio context (must be called after user interaction)
    init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported', e);
        }
    }

    // Ensure audio context is initialized and resumed
    async ensureContext() {
        if (!this.initialized) {
            this.init();
        }
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Play pop sound when answer is submitted
    async playPopSound() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Create oscillator for pop sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Pop sound: quick frequency drop with envelope
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        
        gainNode.gain.setValueAtTime(this.masterVolume * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }

    // Play success sound for correct answer
    async playSuccessSound() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Create a cheerful ascending tone
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, now); // C5
        oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
        oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
        
        gainNode.gain.setValueAtTime(this.masterVolume * 0.4, now);
        gainNode.gain.setValueAtTime(this.masterVolume * 0.4, now + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        oscillator.start(now);
        oscillator.stop(now + 0.4);
    }

    // Play error sound for incorrect answer
    async playErrorSound() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Create a descending tone
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.3);
        
        gainNode.gain.setValueAtTime(this.masterVolume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }

    // Play round end sound
    async playRoundEndSound() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Create a fanfare-like sound
        const playNote = (frequency, startTime, duration) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(frequency, startTime);
            
            gainNode.gain.setValueAtTime(this.masterVolume * 0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        };
        
        // Play a short fanfare
        playNote(523, now, 0.15); // C5
        playNote(659, now + 0.15, 0.15); // E5
        playNote(784, now + 0.3, 0.3); // G5
    }

    // Play celebration sound for leaderboard
    async playCelebrationSound() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Create a celebratory ascending arpeggio
        const playNote = (frequency, startTime, duration) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, startTime);
            
            gainNode.gain.setValueAtTime(this.masterVolume * 0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        };
        
        // Play celebration arpeggio
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((note, i) => {
            playNote(note, now + i * 0.1, 0.3);
        });
    }

    // Start playful background music for rounds
    async startBackgroundMusic() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        // Stop existing music if any
        this.stopBackgroundMusic();

        const now = this.audioContext.currentTime;
        
        // Create a simple looping melody
        const playMelodyNote = (frequency, startTime, duration) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filterNode = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(frequency, startTime);
            
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(2000, startTime);
            
            gainNode.gain.setValueAtTime(this.masterVolume * 0.15, startTime);
            gainNode.gain.setValueAtTime(this.masterVolume * 0.15, startTime + duration - 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
            
            return oscillator;
        };

        // Simple upbeat melody pattern (repeating)
        const melody = [
            { note: 523, duration: 0.2 }, // C5
            { note: 659, duration: 0.2 }, // E5
            { note: 784, duration: 0.2 }, // G5
            { note: 659, duration: 0.2 }, // E5
            { note: 523, duration: 0.2 }, // C5
            { note: 659, duration: 0.2 }, // E5
            { note: 784, duration: 0.4 }, // G5
            { note: 784, duration: 0.4 }, // G5
        ];

        let currentTime = now;
        const patternDuration = melody.reduce((sum, note) => sum + note.duration, 0);
        
        // Play pattern multiple times (for 60 seconds)
        const repetitions = Math.ceil(60 / patternDuration);
        
        for (let rep = 0; rep < repetitions; rep++) {
            melody.forEach(({ note, duration }) => {
                playMelodyNote(note, currentTime, duration);
                currentTime += duration;
            });
        }

        // Store reference to stop it later
        this.backgroundMusic = {
            startTime: now,
            duration: repetitions * patternDuration
        };

        // Auto-restart after duration
        setTimeout(() => {
            if (this.backgroundMusic) {
                this.startBackgroundMusic();
            }
        }, repetitions * patternDuration * 1000);
    }

    // Stop background music
    stopBackgroundMusic() {
        this.backgroundMusic = null;
    }

    // Play countdown tick sound
    async playCountdownTick() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        
        gainNode.gain.setValueAtTime(this.masterVolume * 0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }

    // Play start game countdown (final beep)
    async playCountdownFinal() {
        if (this.isMuted) return;
        await this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, now);
        
        gainNode.gain.setValueAtTime(this.masterVolume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }

    // Toggle mute
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBackgroundMusic();
        }
        return this.isMuted;
    }

    // Set volume (0.0 to 1.0)
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();
