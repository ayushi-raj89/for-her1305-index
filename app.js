// --- App State Management ---
let audioPlaying = false;
let particlesInterval = null;
let currentSongIndex = 0;
let playlist = [];
let memoriesList = [];
let reasonsList = [];
let datesList = [];

// Edit trackers
let activeEditMemoryId = null;
let activeEditSongId = null;
let activeEditDateId = null;
let selectedMemoryFile = null;
let selectedSongFile = null;

// Opening Screen State
let welcomeStars = [];
let welcomeStarsActive = true;
let isWarpActive = false;
let welcomeCanvas, welcomeCtx;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupEventListeners();
    setupDatePickerDefaults();
    initWelcomeStars();
    runWelcomeTyping();
    
    // Check initial Supabase settings
    document.addEventListener('supabase-status-changed', (e) => {
        updateDbStatusUi(e.detail.isDemoMode, e.detail.url, e.detail.key);
        // Refresh dynamic lists
        loadAllData();
    });
    
    // Call manual init for form inputs loading
    initDbConfigInputs();
    
    // Trigger initial Supabase connection status check and data load
    if (typeof initSupabase === 'function') {
        initSupabase();
    }
});

// Set up Date Picker limits and default values
function setupDatePickerDefaults() {
    const today = new Date().toISOString().split('T')[0];
    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        datePicker.min = today;
        datePicker.value = today; // Default to today
    }
    const timePicker = document.getElementById('time-picker');
    if (timePicker) {
        timePicker.value = "19:00"; // Default to 7:00 PM
    }
}

// --- Screen Transitions Router ---
function navigateTo(screenId) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Custom animation triggers depending on screen
        if (screenId === 'reasons-screen') {
            switchReasonsTab('his');
        } else {
            resetReasonsAnimation();
        }
        
        if (screenId === 'secret-screen') {
            initSecretScreen();
            displayDailyQuote();
        } else {
            stopSecretScreen();
        }
        
        if (screenId === 'menu-screen') {
            startAmbientParticles();
        }

        // Toggle lyrics positioning class (bottom for home/menu, top for sub-screens)
        const lyricsBg = document.getElementById('lyrics-background');
        if (lyricsBg) {
            if (screenId !== 'welcome-screen' && screenId !== 'menu-screen') {
                lyricsBg.classList.add('sub-screen-active');
            } else {
                lyricsBg.classList.remove('sub-screen-active');
            }
        }
    }
}

// --- Setup Click & Action Handlers ---
function setupEventListeners() {
    // Enter Our World Button
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            triggerEnterWorldTransition();
        });
    }

    // Music Toggle Button
    const musicBtn = document.getElementById('music-toggle');
    if (musicBtn) {
        musicBtn.addEventListener('click', () => {
            toggleMusic();
        });
    }

    // Sync Lyrics with Background Music
    const audio = document.getElementById('bg-music');
    if (audio) {
        audio.addEventListener('timeupdate', () => {
            const currentTime = audio.currentTime;
            updateLyrics(currentTime);
            updateSpotifyProgressBar(currentTime, audio.duration);
        });
        
        // Autoplay next song on completion
        audio.addEventListener('ended', () => {
            playNextSong();
        });
    }

    // RSVP Yes Button
    const rsvpBtn = document.getElementById('rsvp-yes-btn');
    if (rsvpBtn) {
        rsvpBtn.addEventListener('click', () => {
            triggerRsvpAcceptance();
        });
    }

    // Spotify Screen Play/Pause Button
    const spotifyPlayBtn = document.getElementById('spotify-play-btn');
    if (spotifyPlayBtn) {
        spotifyPlayBtn.addEventListener('click', () => {
            toggleMusic();
        });
    }

    // Spotify Screen Seeking Controls (Previous 10s / Next 10s)
    const spotifyPrevBtn = document.getElementById('spotify-prev-btn');
    if (spotifyPrevBtn) {
        spotifyPrevBtn.addEventListener('click', () => {
            playPrevSong();
        });
    }

    const spotifyNextBtn = document.getElementById('spotify-next-btn');
    if (spotifyNextBtn) {
        spotifyNextBtn.addEventListener('click', () => {
            playNextSong();
        });
    }

    // Spotify Shuffle & Repeat toggles (Visual active state feedback)
    const shuffleBtn = document.getElementById('spotify-shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            shuffleBtn.classList.toggle('secondary');
        });
    }

    const repeatBtn = document.getElementById('spotify-repeat-btn');
    if (repeatBtn) {
        repeatBtn.addEventListener('click', () => {
            repeatBtn.classList.toggle('secondary');
        });
    }

    // Click on progress track to seek
    const progressTrack = document.getElementById('spotify-progress-track');
    if (progressTrack) {
        progressTrack.addEventListener('click', (e) => {
            const rect = progressTrack.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const percent = clickX / width;
            const duration = audio.duration || 177;
            audio.currentTime = percent * duration;
        });
    }

    // PWA Install Button Click Handler
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            installBtn.classList.add('hidden');
        });
    }
}

// --- Magical Opening Screen Logic ---
function initWelcomeStars() {
    welcomeCanvas = document.getElementById('welcome-stars-canvas');
    if (!welcomeCanvas) return;
    welcomeCtx = welcomeCanvas.getContext('2d');
    
    function resizeCanvas() {
        if (!welcomeCanvas) return;
        welcomeCanvas.width = window.innerWidth;
        welcomeCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const numStars = 180;
    welcomeStars = [];
    for (let i = 0; i < numStars; i++) {
        welcomeStars.push({
            x: (Math.random() - 0.5) * welcomeCanvas.width * 2,
            y: (Math.random() - 0.5) * welcomeCanvas.height * 2,
            z: Math.random() * welcomeCanvas.width,
            color: Math.random() > 0.82 ? '#c0392b' : '#ffffff'
        });
    }
    
    function animate() {
        if (!welcomeStarsActive || !welcomeCanvas) return;
        requestAnimationFrame(animate);
        
        if (isWarpActive) {
            welcomeCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            welcomeCtx.fillRect(0, 0, welcomeCanvas.width, welcomeCanvas.height);
        } else {
            welcomeCtx.clearRect(0, 0, welcomeCanvas.width, welcomeCanvas.height);
        }
        
        const centerX = welcomeCanvas.width / 2;
        const centerY = welcomeCanvas.height / 2;
        
        for (let i = 0; i < welcomeStars.length; i++) {
            const star = welcomeStars[i];
            const speed = isWarpActive ? 32 : 0.45;
            star.z -= speed;
            
            if (star.z <= 0) {
                star.x = (Math.random() - 0.5) * welcomeCanvas.width * 2;
                star.y = (Math.random() - 0.5) * welcomeCanvas.height * 2;
                star.z = welcomeCanvas.width;
            }
            
            const px = (star.x / star.z) * centerX + centerX;
            const py = (star.y / star.z) * centerY + centerY;
            
            if (px >= 0 && px < welcomeCanvas.width && py >= 0 && py < welcomeCanvas.height) {
                const size = (1 - star.z / welcomeCanvas.width) * 3 + 0.5;
                const alpha = (1 - star.z / welcomeCanvas.width) * 0.8 + 0.2;
                
                welcomeCtx.fillStyle = star.color === '#ffffff' ? `rgba(255, 255, 255, ${alpha})` : `rgba(192, 57, 43, ${alpha})`;
                welcomeCtx.beginPath();
                welcomeCtx.arc(px, py, size, 0, Math.PI * 2);
                welcomeCtx.fill();
            }
        }
    }
    animate();
}

function runWelcomeTyping() {
    const textEl = document.getElementById('welcome-text');
    if (!textEl) return;
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDate = today.getDate();
    
    let message = "somewhere in this universe... there is a place just for us";
    
    if (currentMonth === 5 && currentDate === 13) {
        message = "happy anniversary, my love! ❤️ somewhere in this universe... there is a place just for us";
    } else if (currentMonth === 10 && currentDate === 15) {
        message = "happy birthday, beautiful! 🎂 somewhere in this universe... there is a place just for us";
    }
    
    let index = 0;
    textEl.textContent = "";
    
    function type() {
        if (index < message.length) {
            textEl.textContent += message.charAt(index);
            index++;
            const char = message.charAt(index - 1);
            let speed = 40;
            if (char === '.' || char === '!' || char === '❤️' || char === '🎂') {
                speed = 350;
            } else if (char === ',') {
                speed = 200;
            } else {
                speed = 35 + Math.random() * 30;
            }
            setTimeout(type, speed);
        } else {
            const enterBtn = document.getElementById('enter-btn');
            if (enterBtn) {
                enterBtn.classList.add('show');
            }
        }
    }
    setTimeout(type, 1500);
}

function triggerEnterWorldTransition() {
    const audio = document.getElementById('bg-music');
    // Load initial song URL if dynamic songs are loaded
    if (playlist.length > 0) {
        audio.src = playlist[currentSongIndex].audio_url;
    }
    audio.play().then(() => {
        audioPlaying = true;
        updateMusicUi(true);
    }).catch(err => {
        console.log("Audio autoplay blocked or failed:", err);
    });

    isWarpActive = true;
    
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
        enterBtn.classList.remove('show');
        enterBtn.style.pointerEvents = 'none';
    }
    
    const welcomeScreen = document.getElementById('welcome-screen');
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.classList.add('warp-fade');
    }, 300);
    
    setTimeout(() => {
        if (welcomeScreen) welcomeScreen.classList.remove('active');
        welcomeStarsActive = false;
        
        navigateTo('menu-screen');
        startAmbientParticles();
        
        updateDaysTogetherCounter();
    }, 2000);
}

function updateDaysTogetherCounter() {
    const counterEl = document.getElementById('days-counter');
    if (!counterEl) return;
    
    const anniversaryDate = new Date('2024-05-13T00:00:00'); // May 13, 2024
    const today = new Date();
    
    const diffTime = today.getTime() - anniversaryDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0) {
        counterEl.textContent = `${diffDays} Days Together`;
    }
}

// --- Music Player Controller ---
function toggleMusic() {
    const audio = document.getElementById('bg-music');
    if (!audio) return;
    
    if (audioPlaying) {
        audio.pause();
        audioPlaying = false;
        updateMusicUi(false);
    } else {
        // Ensure source exists
        if (!audio.src && playlist.length > 0) {
            audio.src = playlist[currentSongIndex].audio_url;
        }
        audio.play().then(() => {
            audioPlaying = true;
            updateMusicUi(true);
        }).catch(err => console.log("Music play error:", err));
    }
}

function updateMusicUi(isPlaying) {
    const footer = document.querySelector('.menu-footer');
    if (footer) {
        if (isPlaying) {
            footer.classList.add('music-playing');
        } else {
            footer.classList.remove('music-playing');
        }
    }

    // Update Spotify screen play button icon dynamically
    const spotifyPlayIcon = document.getElementById('spotify-play-icon');
    if (spotifyPlayIcon) {
        if (isPlaying) {
            spotifyPlayIcon.setAttribute('data-lucide', 'pause');
        } else {
            spotifyPlayIcon.setAttribute('data-lucide', 'play');
        }
        lucide.createIcons();
    }
    
    // Spinning Cover Art record animation
    const coverArt = document.querySelector('.spotify-cover-img');
    if (coverArt) {
        if (isPlaying) {
            coverArt.classList.add('music-playing-record');
        } else {
            coverArt.classList.remove('music-playing-record');
        }
    }
}

function playSong(index) {
    if (index < 0 || index >= playlist.length) return;
    currentSongIndex = index;
    const song = playlist[currentSongIndex];
    
    const audio = document.getElementById('bg-music');
    if (!audio) return;
    
    audio.src = song.audio_url;
    
    // Update player UI elements
    const songTitleEl = document.querySelector('.spotify-song-title');
    const songArtistEl = document.querySelector('.spotify-song-artist');
    const playerCover = document.querySelector('.spotify-cover-img');
    const backgroundBlurCover = document.querySelector('.spotify-bg-blur');
    
    if (songTitleEl) songTitleEl.textContent = song.title;
    if (songArtistEl) songArtistEl.textContent = song.artist;
    if (playerCover) playerCover.src = song.cover_url || 'assets/memory1.png';
    if (backgroundBlurCover) backgroundBlurCover.style.backgroundImage = `url('${song.cover_url || 'assets/memory1.png'}')`;
    
    // Render list active state
    renderPlaylist();
    
    audio.play().then(() => {
        audioPlaying = true;
        updateMusicUi(true);
    }).catch(err => console.log(err));
}

function playNextSong() {
    const shuffleBtn = document.getElementById('spotify-shuffle-btn');
    const repeatBtn = document.getElementById('spotify-repeat-btn');
    
    if (playlist.length === 0) return;
    
    // Repeat active song
    if (repeatBtn && !repeatBtn.classList.contains('secondary')) {
        playSong(currentSongIndex);
        return;
    }
    
    // Shuffle active song
    if (shuffleBtn && !shuffleBtn.classList.contains('secondary')) {
        const randomIndex = Math.floor(Math.random() * playlist.length);
        playSong(randomIndex);
        return;
    }
    
    const nextIndex = (currentSongIndex + 1) % playlist.length;
    playSong(nextIndex);
}

function playPrevSong() {
    if (playlist.length === 0) return;
    const prevIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    playSong(prevIndex);
}

// --- Background Particle Sparkles & Hearts ---
function startAmbientParticles() {
    if (particlesInterval) return;

    const container = document.getElementById('particles-container');
    if (!container) return;
    
    particlesInterval = setInterval(() => {
        if (Math.random() > 0.45) {
            createStarlight(container);
        } else {
            createHeart(container);
        }
    }, 700);
}

function createStarlight(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    const size = Math.random() * 4 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.opacity = Math.random() * 0.5 + 0.2;
    particle.style.animationDuration = `${Math.random() * 6 + 6}s`;

    container.appendChild(particle);

    setTimeout(() => {
        particle.remove();
    }, 12000);
}

function createHeart(container) {
    const heart = document.createElement('div');
    heart.className = 'heart-particle';
    heart.innerHTML = '❤️';
    
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.fontSize = `${Math.random() * 12 + 10}px`;
    heart.style.animationDuration = `${Math.random() * 8 + 8}s`;
    
    container.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 16000);
}

// --- Fallback & Mock Databases ---
const fallbackMemories = [
    {
        id: 'mock-1',
        title: 'the day distance finally lost',
        date: '2024-05-13',
        description: `
            <p>for 1.5 years, we only knew each other through screens, thousands of messages, endless calls, random fights, silent nights, misunderstandings, and moments when things felt impossible, but no matter what happened, we always found our way back to each other,</p>
            <p>then came the day we had been waiting for,</p>
            <p>the moment i saw her standing in front of me, everything around me disappeared, all the things i planned to say were gone, i was so lost in her beauty that i honestly wasn't paying attention to anything else, she grabbed my hand, and i just followed her without a second thought,</p>
            <p>which, as it turns out, wasn't the smartest decision,</p>
            <p>a few minutes later, we accidentally walked into the women's metro coach, for a moment neither of us realized it, and when we did, the embarrassment hit instantly, looking back now, it's one of the funniest memories from our first date,</p>
            <p>but my favorite part of that day wasn't the metro incident,</p>
            <p>it was her,</p>
            <p>the same girl who could talk to me for hours online was suddenly so nervous that she was literally shaking when we met, seeing her like that made everything feel real, after all those months of waiting, hoping, and dreaming about this moment, she was finally there beside me,</p>
            <p>this photo isn't perfect,</p>
            <p>our hair isn't perfect, the lighting isn't perfect, the pose isn't perfect,</p>
            <p>but it's my favorite photo because it captured the exact moment when two people who spent 1.5 years loving each other from a distance finally got to stand side by side,</p>
            <p>and honestly, it was even better than we imagined,</p>
        `,
        src: 'assets/memory1.png',
        added_by: 'Shivam'
    },
    {
        id: 'mock-2',
        title: 'the weekend promise',
        date: '2024-06-08',
        description: `
            <p>i don't think you ever realized how important that day was to me,</p>
            <p>it was the first time i picked you up from your pw classes, and i remember thinking that i didn't want you going home alone anymore, so i made a promise to myself, no matter what happened, every weekend i'd come pick you up and make sure you got to your metro safely,</p>
            <p>it wasn't anything grand, just a small thing, but somehow those weekends became one of my favorite parts of the week,</p>
            <p>we'd sit together in the metro, talking about random things, laughing at things that weren't even funny, teasing each other for no reason, and turning an ordinary ride home into something i'd look forward to all week,</p>
            <p>and then there was you,</p>
            <p>every time i'd get a little too close or tease you too much, you'd immediately look around and whisper,</p>
            <p>"koi dekh lega yaar"</p>
            <p>and somehow that only made me want to tease you more,</p>
            <p>looking back now, it wasn't really about the metro rides,</p>
            <p>it was about knowing that for a little while, before we both went back to our own lives, i got to be with you,</p>
            <p>just us, talking, laughing, and making memories between a classroom and a metro station,</p>
            <p>a simple routine that slowly became one of my favorite memories with you,</p>
        `,
        src: 'assets/memory2.png',
        added_by: 'Shivam'
    },
    {
        id: 'mock-3',
        title: 'lost in the woods',
        date: '2024-07-22',
        description: `
            <p>out of all the places we could've gone, we ended up having a date in a jungle,</p>
            <p>sanjay van wasn't filled with loud people, traffic, or the noise of the city, it was just trees, nature, fresh air, and us,</p>
            <p>we spent hours walking around, talking about random things, enjoying every little moment together, and for once it felt like nothing else mattered,</p>
            <p>i still remember looking around at all the greenery and thinking just one thing,</p>
            <p>i hope we can stay here forever,</p>
            <p>not because of the place itself, but because of how peaceful everything felt when i was with you,</p>
            <p>for a little while, it felt like the world had stopped moving,</p>
            <p>there were no worries about going home, no overthinking about the future, no distractions,</p>
            <p>just you, me, and nature,</p>
            <p>sometimes i look back at this photo and realize that what made that day special wasn't the jungle,</p>
            <p>it was the feeling of being completely at peace because you were there beside me,</p>
            <p>and if i could relive one quiet day with you over and over again,</p>
            <p>it would probably be this one,</p>
        `,
        src: 'assets/memory3.png',
        added_by: 'Shivam'
    },
    {
        id: 'mock-4',
        title: 'our first kiss',
        date: '2024-08-14',
        description: `
            <p>before our first date, we had already made a plan,</p>
            <p>keep it simple, don't be awkward, and if everything goes well, maybe we'll get a hug,</p>
            <p>that was the entire plan,</p>
            <p>after all, most couples take time to get comfortable around each other, especially after spending so long talking through a screen,</p>
            <p>but somehow, the moment we met, everything felt natural,</p>
            <p>all the nervousness, overthinking, and "what if it gets awkward" thoughts disappeared much faster than we expected,</p>
            <p>and before we knew it, our tiny little plan had completely gone out the window,</p>
            <p>we went from "maybe a hug" to creating a memory neither of us had expected,</p>
            <p>looking back now, what makes me smile isn't that the plan changed,</p>
            <p>it's how comfortable being with you felt,</p>
            <p>for two people meeting in person after so much time online, everything just clicked,</p>
            <p>sometimes the best moments aren't the ones you spend weeks planning,</p>
            <p>they're the ones that happen naturally,</p>
            <p>and somehow, our first date became one of those moments,</p>
        `,
        src: 'assets/memory4.png',
        added_by: 'Shivam'
    },
    {
        id: 'mock-5',
        title: '29 hours, one call',
        date: '2024-09-30',
        description: `
            <p>sometimes i still can't believe we actually did it,</p>
            <p>both of our parents happened to go to our hometowns at the same time, and for once there were no interruptions, no one calling us away, no distractions,</p>
            <p>it felt like the universe accidentally gave us a whole day just for us,</p>
            <p>what started as a normal video call turned into something neither of us expected,</p>
            <p>one hour became two, two became five, five became ten, and before we knew it, we had been on a video call for 29 hours straight,</p>
            <p>we ate together, watched each other do random things, talked about everything and nothing, laughed at the dumbest jokes, got sleepy together, woke up together, and somehow never ran out of things to say,</p>
            <p>it didn't feel like a call anymore,</p>
            <p>it felt like we were spending an entire day together, even though we were miles apart,</p>
            <p>for a relationship that started online, moments like this meant everything,</p>
            <p>because even with all the distance between us, we always found ways to make each other feel close,</p>
            <p>29 hours sounds crazy when i say it out loud,</p>
            <p>but when i'm talking to you, time has always had a funny way of disappearing,</p>
        `,
        src: 'assets/memory5.png',
        added_by: 'Shivam'
    },
    {
        id: 'mock-6',
        title: 'the consent letter',
        date: '2024-11-12',
        description: `
            <p>out of all the things i expected to do in a relationship,</p>
            <p>signing a consent letter was definitely not one of them,</p>
            <p>but somehow, you managed to make me sign one,</p>
            <p>a whole agreement saying that i love you, that i'm your husband, and that i'll never leave your side,</p>
            <p>looking back, it's honestly one of the funniest things you've ever made me do,</p>
            <p>at the time, you told me you wanted it because you were scared,</p>
            <p>scared that one day i'd leave, scared that maybe you weren't enough, scared that you didn't deserve me,</p>
            <p>and i remember thinking how wrong you were,</p>
            <p>because if i'm being honest,</p>
            <p>you were never the one who didn't deserve me,</p>
            <p>if anything, it was the other way around,</p>
            <p>you've always been more caring than you realize, more understanding than you give yourself credit for, and stronger than you think,</p>
            <p>so while everyone else probably sees that consent letter as a funny joke,</p>
            <p>when i look back at it, i see something else,</p>
            <p>i see a girl who loved so deeply that she wanted reassurance that i'd stay,</p>
            <p>and a boy who would've signed that paper a thousand times if it made her smile,</p>
            <p>still though,</p>
            <p>i'm never letting you forget that you actually made me sign a relationship contract 😭</p>
        `,
        src: 'assets/memory6.png',
        added_by: 'Shivam'
    }
];

const fallbackReasons = [
    { id: 'mock-r-1', text: "You make my bad days softer and my good days brighter.", type: 'his' },
    { id: 'mock-r-2', text: "You listen – really listen – and that means everything to me.", type: 'his' },
    { id: 'mock-r-3', text: "You're my calm and my beautiful chaos at the same time.", type: 'his' },
    { id: 'mock-r-4', text: "You support my dreams as if they were your own.", type: 'his' },
    { id: 'mock-r-5', text: "Just being around you feels like home.", type: 'his' },
    { id: 'mock-r-6', text: "I love you through every single doubt, every distance, and every day that lies ahead.", type: 'his' },
    { id: 'mock-r-7', text: "I love you because even on our hardest days, you are the only one I want to talk to.", type: 'his' },
    { id: 'mock-r-8', text: "I love you for your warmth, your care, and the beautiful reassurance you give my heart.", type: 'his' },
    { id: 'mock-r-9', text: "I love you in the quiet moments, in the chaos, and in everything in between.", type: 'his' },
    { id: 'mock-r-10', text: "I love you simply because you are my home, my peace, and my favorite adventure.", type: 'his' }
];

const DEFAULT_PLAYLIST = [
    {
        id: 'default-s-1',
        title: 'Until I Found You',
        artist: 'Stephen Sanchez',
        audio_url: 'assets/bg_music.mp3',
        cover_url: 'assets/memory1.png'
    }
];

// --- Database Configuration Panel UI Handler ---
function initDbConfigInputs() {
    const url = localStorage.getItem('SUPABASE_URL') || window.SUPABASE_URL || "";
    const key = localStorage.getItem('SUPABASE_ANON_KEY') || window.SUPABASE_ANON_KEY || "";
    
    const urlInput = document.getElementById('db-url');
    const keyInput = document.getElementById('db-key');
    if (urlInput) urlInput.value = url;
    if (keyInput) keyInput.value = key;
}

function openDbSettingsModal() {
    const modal = document.getElementById('db-settings-modal');
    if (modal) {
        initDbConfigInputs();
        modal.classList.remove('hidden');
    }
}

function closeDbSettingsModal() {
    const modal = document.getElementById('db-settings-modal');
    if (modal) modal.classList.add('hidden');
}

function toggleInstructions() {
    const content = document.getElementById('instructions-content');
    const chevron = document.getElementById('instructions-chevron');
    if (content) {
        content.classList.toggle('hidden');
        if (chevron) {
            chevron.setAttribute('data-lucide', content.classList.contains('hidden') ? 'chevron-down' : 'chevron-up');
            lucide.createIcons();
        }
    }
}

async function testDbConnection() {
    const url = document.getElementById('db-url').value.trim();
    const key = document.getElementById('db-key').value.trim();
    const banner = document.getElementById('db-conn-status');
    
    if (!url || !key) {
        alert("Please enter URL and Anon Key first.");
        return;
    }
    
    if (banner) {
        banner.className = "db-status-banner warning";
        banner.innerHTML = `<i data-lucide="loader" class="btn-icon spin"></i><span>Testing connection settings...</span>`;
        lucide.createIcons();
    }
    
    const result = await testSupabaseConnection(url, key);
    
    if (banner) {
        if (result.success) {
            banner.className = "db-status-banner success";
            banner.innerHTML = `<i data-lucide="check-circle"></i><span>Connected successfully! Run SQL setup to create tables if you haven't.</span>`;
        } else {
            banner.className = "db-status-banner error";
            banner.innerHTML = `<i data-lucide="alert-octagon"></i><span>Connection failed: ${result.message}</span>`;
        }
        lucide.createIcons();
    }
}

function saveDbSettings(event) {
    event.preventDefault();
    const url = document.getElementById('db-url').value.trim();
    const key = document.getElementById('db-key').value.trim();
    
    saveSupabaseCredentials(url, key);
    closeDbSettingsModal();
    alert("Database configuration saved successfully! ❤️");
}

function clearDbSettings() {
    saveSupabaseCredentials("", "");
    closeDbSettingsModal();
    alert("Configuration cleared. Running in local Demo mode.");
}

function updateDbStatusUi(isDemo, url, key) {
    const badge = document.getElementById('db-status-badge');
    const banner = document.getElementById('db-conn-status');
    
    if (badge) {
        badge.textContent = isDemo ? "Demo Mode" : "Supabase Live";
        badge.style.color = isDemo ? "var(--text-secondary)" : "#2ecc71";
    }
    
    if (banner) {
        if (isDemo) {
            banner.className = "db-status-banner warning";
            banner.innerHTML = `<i data-lucide="alert-triangle"></i><span>Running in Demo mode. Connect to Supabase to upload your photos.</span>`;
        } else {
            banner.className = "db-status-banner success";
            banner.innerHTML = `<i data-lucide="check-circle"></i><span>Connected to Supabase! You are live!</span>`;
        }
        lucide.createIcons();
    }
}

// --- Dynamic Dynamic Loaders & Renderers ---
async function loadAllData() {
    // 1. Song Library
    try {
        const dynamicSongs = await dbGetSongs();
        if (dynamicSongs && dynamicSongs.length > 0) {
            playlist = [...DEFAULT_PLAYLIST, ...dynamicSongs];
        } else {
            playlist = [...DEFAULT_PLAYLIST];
        }
    } catch(e) {
        playlist = [...DEFAULT_PLAYLIST];
    }
    renderPlaylist();

    // 2. Memories Grid
    try {
        const dynamicMemories = await dbGetMemories();
        if (dynamicMemories && dynamicMemories.length > 0) {
            memoriesList = dynamicMemories;
        } else {
            memoriesList = [...fallbackMemories];
        }
    } catch(e) {
        memoriesList = [...fallbackMemories];
    }
    renderMemories();

    // 3. Why I Love You Reasons
    try {
        const dynamicReasons = await dbGetReasons();
        if (dynamicReasons && dynamicReasons.length > 0) {
            reasonsList = dynamicReasons;
        } else {
            reasonsList = [...fallbackReasons];
        }
    } catch(e) {
        reasonsList = [...fallbackReasons];
    }
    renderReasons();

    // 4. Date Planner Scheduled Dates
    try {
        const dynamicDates = await dbGetDates();
        if (dynamicDates) {
            datesList = dynamicDates;
        } else {
            datesList = JSON.parse(localStorage.getItem('SAVED_DATES') || '[]');
        }
    } catch(e) {
        datesList = JSON.parse(localStorage.getItem('SAVED_DATES') || '[]');
    }
    renderDates();
}

// Format Date string helper
function formatDateString(dateStr) {
    if (!dateStr) return "";
    try {
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
            return dateObj.toLocaleDateString('en-US', options);
        }
    } catch(e) {}
    return dateStr;
}

// Format short Date helper
function formatShortDate(dateStr) {
    if (!dateStr) return "";
    try {
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    } catch(e) {}
    return dateStr;
}

// Format Time helper
function formatTimeString(timeStr) {
    if (!timeStr) return "";
    try {
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
            let hours = parseInt(timeParts[0]);
            const minutes = timeParts[1];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${hours}:${minutes} ${ampm}`;
        }
    } catch(e) {}
    return timeStr;
}

// RENDER: Memories Grid
function renderMemories() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    
    // Clear out existing dynamic contents
    const addCard = grid.querySelector('.add-memory-card');
    grid.innerHTML = "";
    if (addCard) {
        grid.appendChild(addCard);
    } else {
        // Fallback card structure
        const card = document.createElement('div');
        card.className = 'gallery-item add-memory-card glass-card';
        card.style.setProperty('--item-index', 1);
        card.onclick = openMemoryModal;
        card.innerHTML = `
            <div class="add-memory-card-inner">
                <i data-lucide="plus-circle" class="add-icon"></i>
                <span>Add New Memory</span>
            </div>
        `;
        grid.appendChild(card);
    }
    
    memoriesList.forEach((mem, index) => {
        const indexVar = index + 2; // offset for card animations
        const card = document.createElement('div');
        card.className = 'gallery-item glass-card';
        card.style.setProperty('--item-index', indexVar);
        
        // Clicks on card body open lightbox details (zoom)
        card.onclick = (e) => {
            // Prevent trigger if action buttons are clicked
            if (e.target.closest('.card-actions-overlay')) return;
            openMemoryLightboxByObject(mem);
        };
        
        // Stagger masonry styling aspect-ratios
        let aspectClass = "aspect-ratio: 1.4 / 1;";
        if (index % 3 === 0) aspectClass = "aspect-ratio: 1.1 / 1;";
        else if (index % 3 === 2) aspectClass = "aspect-ratio: 1.6 / 1;";
        
        const deleteBtn = isDemoMode && mem.id.startsWith('mock') ? '' : `
            <button class="card-action-btn delete" onclick="deleteMemoryItem(event, '${mem.id}')" title="Delete Memory">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        
        const editBtn = isDemoMode && mem.id.startsWith('mock') ? '' : `
            <button class="card-action-btn edit" onclick="openEditMemoryModal(event, '${mem.id}')" title="Edit Memory">
                <i data-lucide="edit-3"></i>
            </button>
        `;
        
        const imageSrc = mem.image_url || mem.src;
        const author = mem.added_by || "Shivam";
        
        card.innerHTML = `
            <div class="card-actions-overlay">
                ${editBtn}
                ${deleteBtn}
            </div>
            <div class="gallery-img-container" style="${aspectClass}">
                <img src="${imageSrc}" alt="${mem.title}" loading="lazy">
            </div>
            <div class="gallery-card-content">
                <span class="gallery-card-date">${formatShortDate(mem.date)}</span>
                <h3 class="gallery-card-title">${mem.title}</h3>
                <p class="gallery-card-desc">${mem.description || mem.caption || ""}</p>
                <div class="gallery-card-footer">
                    <span class="gallery-card-tag">Added by ${author}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    lucide.createIcons();
}

// RENDER: Reasons
function renderReasons() {
    const hisList = document.getElementById('reasons-list-his');
    const herList = document.getElementById('reasons-list-her');
    
    if (hisList) hisList.innerHTML = "";
    if (herList) herList.innerHTML = "";
    
    const hisItems = reasonsList.filter(r => r.type === 'his');
    const herItems = reasonsList.filter(r => r.type === 'her');
    
    // Draw His
    if (hisList) {
        if (hisItems.length === 0) {
            hisList.innerHTML = `
                <div class="empty-tab-placeholder glass-card" style="width:100%; border:none; box-shadow:none;">
                    <i data-lucide="help-circle" class="placeholder-icon"></i>
                    <p style="font-size: 15px; font-weight: 500;">No reasons written yet... 🥺</p>
                </div>
            `;
        } else {
            hisItems.forEach((reason, index) => {
                const li = document.createElement('li');
                li.className = 'reason-item glass-card';
                li.style.setProperty('--item-index', index + 1);
                
                const deleteBtn = isDemoMode && reason.id.startsWith('mock') ? '' : `
                    <button class="action-btn delete-btn" onclick="deleteReasonItem('${reason.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                `;
                const editBtn = isDemoMode && reason.id.startsWith('mock') ? '' : `
                    <button class="action-btn edit-btn" onclick="editReasonItem('${reason.id}')" title="Edit"><i data-lucide="edit-3"></i></button>
                `;
                
                li.innerHTML = `
                    <div class="reason-icon">
                        <i data-lucide="heart" class="active-heart"></i>
                    </div>
                    <p class="reason-text">${reason.text}</p>
                    <div class="reason-actions-overlay">
                        ${editBtn}
                        ${deleteBtn}
                    </div>
                `;
                hisList.appendChild(li);
            });
        }
    }
    
    // Draw Her
    if (herList) {
        if (herItems.length === 0) {
            herList.innerHTML = `
                <div class="empty-tab-placeholder glass-card" style="width:100%; border:none; box-shadow:none;">
                    <i data-lucide="help-circle" class="placeholder-icon"></i>
                    <p style="font-size: 15px; font-weight: 500;">She hasn't written yet... 🥺</p>
                </div>
            `;
        } else {
            herItems.forEach((reason, index) => {
                const li = document.createElement('li');
                li.className = 'reason-item glass-card';
                li.style.setProperty('--item-index', index + 1);
                
                const deleteBtn = isDemoMode && reason.id.startsWith('mock') ? '' : `
                    <button class="action-btn delete-btn" onclick="deleteReasonItem('${reason.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                `;
                const editBtn = isDemoMode && reason.id.startsWith('mock') ? '' : `
                    <button class="action-btn edit-btn" onclick="editReasonItem('${reason.id}')" title="Edit"><i data-lucide="edit-3"></i></button>
                `;
                
                li.innerHTML = `
                    <div class="reason-icon">
                        <i data-lucide="heart" class="active-heart"></i>
                    </div>
                    <p class="reason-text">${reason.text}</p>
                    <div class="reason-actions-overlay">
                        ${editBtn}
                        ${deleteBtn}
                    </div>
                `;
                herList.appendChild(li);
            });
        }
    }
    lucide.createIcons();
}

// RENDER: Date Planner Upcoming Dates
function renderDates() {
    const container = document.getElementById('upcoming-dates-grid');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (datesList.length === 0) {
        container.innerHTML = `
            <div class="empty-tab-placeholder glass-card" style="grid-column: 1 / -1; width:100%;">
                <i data-lucide="calendar" class="placeholder-icon"></i>
                <p style="font-size: 15px; font-weight: 500;">No dates scheduled yet! Go plan one above. ❤️</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    datesList.forEach((datePlan) => {
        const card = document.createElement('div');
        card.className = "date-ticket-card glass-card";
        
        card.innerHTML = `
            <div class="date-ticket-badge">UPCOMING</div>
            <div class="date-ticket-header">
                <h3 class="date-ticket-title">${datePlan.activity}</h3>
                <p class="date-ticket-place"><i data-lucide="map-pin" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>${datePlan.place}</p>
            </div>
            <div class="date-ticket-footer">
                <div class="date-ticket-info">
                    <span class="info-label" style="font-size: 9px;">DATE & TIME</span>
                    <span class="info-value" style="font-size: 12.5px; font-weight: 600; color:var(--gold);">${formatShortDate(datePlan.date)} at ${formatTimeString(datePlan.time)}</span>
                </div>
                <div class="date-ticket-actions">
                    <button class="action-btn edit-btn" onclick="editDatePlan('${datePlan.id}')" title="Edit Plan"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteDatePlan('${datePlan.id}')" title="Delete Plan"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}

// RENDER: Playlist list for Spotify Screen
function renderPlaylist() {
    const list = document.getElementById('spotify-playlist-list');
    if (!list) return;
    
    list.innerHTML = "";
    
    playlist.forEach((song, index) => {
        const item = document.createElement('div');
        const isActive = index === currentSongIndex;
        item.className = `song-item ${isActive ? 'active-song' : ''}`;
        
        // Single click plays it
        item.onclick = (e) => {
            if (e.target.closest('.song-actions')) return;
            playSong(index);
        };
        
        // Sound waves when active
        let statusIcon = `<span class="song-index">${index + 1}</span>`;
        if (isActive) {
            statusIcon = audioPlaying ? `
                <div class="playlist-sound-wave">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            ` : `<i data-lucide="play" style="width:14px; height:14px;"></i>`;
        }
        
        const deleteBtn = isDemoMode && song.id.startsWith('default') ? '' : `
            <button class="song-action-btn delete" onclick="deleteSongItem(event, '${song.id}')" title="Delete Song">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        
        const editBtn = isDemoMode && song.id.startsWith('default') ? '' : `
            <button class="song-action-btn edit" onclick="openEditSongModal(event, '${song.id}')" title="Edit Song">
                <i data-lucide="edit-3"></i>
            </button>
        `;
        
        item.innerHTML = `
            <div class="song-item-left">
                <div class="song-status-icon">
                    ${statusIcon}
                </div>
                <div class="song-details">
                    <span class="song-title-text">${song.title}</span>
                    <span class="song-artist-text">${song.artist}</span>
                </div>
            </div>
            <div class="song-actions">
                ${editBtn}
                ${deleteBtn}
            </div>
        `;
        list.appendChild(item);
    });
    
    lucide.createIcons();
}

// --- Lightbox Details Display ---
function openLightbox(id) {
    const memory = memoriesList.find(m => m.id == id || m.id === id);
    if (!memory) return;
    openMemoryLightboxByObject(memory);
}

function openMemoryLightboxByObject(memory) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDate = document.getElementById('lightbox-date');
    const lightboxCaption = document.getElementById('lightbox-caption');

    lightboxImg.src = memory.image_url || memory.src;
    lightboxTitle.textContent = memory.title;
    if (lightboxDate) {
        lightboxDate.textContent = formatDateString(memory.date);
    }
    lightboxCaption.innerHTML = memory.description || memory.caption || "";
    lightbox.classList.add('active');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) lightbox.classList.remove('active');
}

// --- Love Letters Database ---
const lettersData = {
    'shivam-letter-1': {
        salutation: 'Dearest Ayushi,',
        body: `
            <p>I wanted to take a moment to tell you how incredibly lucky I feel to have you in my life.</p>
            <p>Every day with you is a new adventure, and your smile is literally my favorite thing in the world. You bring so much light and joy into my days.</p>
            <p>I can't wait to make a million more beautiful memories with you.</p>
        `,
        signature: 'Forever yours,<br>Shivam'
    }
};

function switchLettersTab(tab) {
    const himBtn = document.getElementById('tab-letters-him');
    const herBtn = document.getElementById('tab-letters-her');
    const himPanel = document.getElementById('letters-from-him');
    const herPanel = document.getElementById('letters-from-her');

    if (tab === 'him') {
        if (himBtn) himBtn.classList.add('active');
        if (herBtn) herBtn.classList.remove('active');
        if (himPanel) himPanel.classList.add('active');
        if (herPanel) herPanel.classList.remove('active');
    } else {
        if (himBtn) himBtn.classList.remove('active');
        if (herBtn) herBtn.classList.add('active');
        if (himPanel) himPanel.classList.remove('active');
        if (herPanel) herPanel.classList.add('active');
    }
}

function openFullLetter(letterId) {
    const letter = lettersData[letterId];
    if (!letter) return;

    const modal = document.getElementById('letter-reader-modal');
    const display = document.getElementById('full-letter-display');
    
    if (display) {
        display.innerHTML = `
            <button class="letter-modal-close" onclick="closeFullLetter()">&times;</button>
            <div class="letter-modal-salutation">${letter.salutation}</div>
            <div style="font-family: var(--font-sans); font-size: 15px; line-height: 1.8; color: #f5eedc; margin-bottom: 24px;">
                ${letter.body}
            </div>
            <div class="letter-modal-signature">${letter.signature}</div>
        `;
    }
    
    if (modal) {
        modal.classList.add('active');
    }
}

function closeFullLetter() {
    const modal = document.getElementById('letter-reader-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// --- Why I Love You Reasons Animations ---
function triggerReasonsAnimation() {
    const items = document.querySelectorAll('.reason-item');
    items.forEach((item, index) => {
        setTimeout(() => {
            item.classList.add('show');
        }, index * 80);
    });
}

// Restoring reason details animations
function resetReasonsAnimation() {
    const items = document.querySelectorAll('.reason-item');
    items.forEach(item => {
        item.classList.remove('show');
    });
}

function switchReasonsTab(tab) {
    const hisBtn = document.getElementById('tab-reasons-his');
    const herBtn = document.getElementById('tab-reasons-her');
    const hisPanel = document.getElementById('reasons-his');
    const herPanel = document.getElementById('reasons-her');

    if (tab === 'his') {
        if (hisBtn) hisBtn.classList.add('active');
        if (herBtn) herBtn.classList.remove('active');
        if (hisPanel) hisPanel.classList.add('active');
        if (herPanel) herPanel.classList.remove('active');
        
        resetReasonsAnimation();
        setTimeout(triggerReasonsAnimation, 50);
    } else {
        if (hisBtn) hisBtn.classList.remove('active');
        if (herBtn) herBtn.classList.add('active');
        if (hisPanel) hisPanel.classList.remove('active');
        if (herPanel) herPanel.classList.add('active');
        
        resetReasonsAnimation();
        setTimeout(triggerReasonsAnimation, 50);
    }
}

// --- Dynamic Why I Love You Actions ---
async function addNewReason(type) {
    const input = document.getElementById(`add-reason-input-${type}`);
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) {
        alert("Please write a reason first! ❤️");
        return;
    }
    
    const newReason = {
        id: Math.random().toString(36).substring(2) + Date.now(),
        text: text,
        type: type
    };
    
    try {
        if (!isDemoMode) {
            const dbData = { text, type };
            await dbAddReason(dbData);
        } else {
            // Push mock reasons local
            reasonsList.push(newReason);
        }
        
        input.value = "";
        
        // Refresh local lists
        if (!isDemoMode) {
            const dynamicReasons = await dbGetReasons();
            reasonsList = dynamicReasons || [];
        }
        
        renderReasons();
        switchReasonsTab(type);
        
    } catch(e) {
        alert("Failed to add reason: " + e.message);
    }
}

async function editReasonItem(id) {
    const reason = reasonsList.find(r => r.id === id);
    if (!reason) return;
    
    const newText = prompt("Edit your reason:", reason.text);
    if (newText === null) return;
    if (!newText.trim()) {
        alert("Reason cannot be empty.");
        return;
    }
    
    try {
        if (!isDemoMode) {
            await dbUpdateReason(id, { text: newText.trim() });
            const dynamicReasons = await dbGetReasons();
            reasonsList = dynamicReasons || [];
        } else {
            reason.text = newText.trim();
        }
        renderReasons();
        switchReasonsTab(reason.type);
    } catch(e) {
        alert("Failed to update reason: " + e.message);
    }
}

async function deleteReasonItem(id) {
    if (!confirm("Are you sure you want to delete this reason? 🥺")) return;
    const reason = reasonsList.find(r => r.id === id);
    if (!reason) return;
    
    try {
        if (!isDemoMode) {
            await dbDeleteReason(id);
            const dynamicReasons = await dbGetReasons();
            reasonsList = dynamicReasons || [];
        } else {
            reasonsList = reasonsList.filter(r => r.id !== id);
        }
        renderReasons();
        switchReasonsTab(reason.type);
    } catch(e) {
        alert("Failed to delete reason: " + e.message);
    }
}

// --- Date Planner Dynamic RSVP & Confetti ---
async function triggerRsvpAcceptance() {
    const dateInput = document.getElementById('date-picker').value;
    const timeInput = document.getElementById('time-picker').value;
    const placeInput = document.getElementById('place-picker').value.trim() || 'Our Special Spot';
    const activityInput = document.getElementById('activity-picker').value.trim() || 'Spending Sweet Time Together';

    if (!dateInput || !timeInput) {
        alert("Please pick a date and time first! ❤️");
        return;
    }

    const newDate = {
        id: 'date-' + Date.now(),
        date: dateInput,
        time: timeInput,
        place: placeInput,
        activity: activityInput
    };

    try {
        if (activeEditDateId) {
            // Update mode
            if (!isDemoMode) {
                const dbData = { date: dateInput, time: timeInput, place: placeInput, activity: activityInput };
                await dbUpdateDate(activeEditDateId, dbData);
                const dynamicDates = await dbGetDates();
                datesList = dynamicDates || [];
            } else {
                const idx = datesList.findIndex(d => d.id === activeEditDateId);
                if (idx !== -1) {
                    datesList[idx] = { ...datesList[idx], date: dateInput, time: timeInput, place: placeInput, activity: activityInput };
                }
            }
            activeEditDateId = null;
            const yesBtnSpan = document.querySelector('#rsvp-yes-btn span');
            if (yesBtnSpan) yesBtnSpan.textContent = "Lock in our date!";
        } else {
            // Insert mode
            if (!isDemoMode) {
                const dbData = { date: dateInput, time: timeInput, place: placeInput, activity: activityInput };
                await dbAddDate(dbData);
                const dynamicDates = await dbGetDates();
                datesList = dynamicDates || [];
            } else {
                datesList.push(newDate);
                localStorage.setItem('SAVED_DATES', JSON.stringify(datesList));
            }
        }

        renderDates();
        
        // Show RSVP dialog
        const formattedDate = formatDateString(dateInput);
        const formattedTime = formatTimeString(timeInput);
        
        const rsvpControls = document.getElementById('rsvp-controls');
        const successMsg = document.getElementById('rsvp-success-message');
        const successDetails = document.getElementById('rsvp-success-details');
        const ticket = document.getElementById('date-ticket');

        if (successDetails) {
            successDetails.innerHTML = `
                Can't wait to see you on <br>
                <span style="color:var(--gold); font-size:16px; font-weight:600; display:inline-block; margin:6px 0;">${formattedDate}</span><br>
                at <span style="color:var(--accent); font-size:16px; font-weight:600; display:inline-block; margin-bottom:6px;">${formattedTime}</span>.<br>
                <span style="color:var(--text-secondary); font-size:13px;">Place: <b>${placeInput}</b></span><br>
                <span style="color:var(--text-secondary); font-size:13px;">Activity: <b>${activityInput}</b></span>
            `;
        }

        rsvpControls.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
        ticket.style.borderColor = 'rgba(192, 57, 43, 0.45)';
        ticket.style.boxShadow = '0 15px 45px rgba(192, 57, 43, 0.3)';

        triggerConfettiExplosion();
        
        // Reset form inputs
        document.getElementById('place-picker').value = "";
        document.getElementById('activity-picker').value = "";
        
        // Restore RSVP form after 6 seconds
        setTimeout(() => {
            rsvpControls.classList.remove('hidden');
            successMsg.classList.add('hidden');
            ticket.style.borderColor = '';
            ticket.style.boxShadow = '';
        }, 6000);
        
    } catch(e) {
        alert("Failed to save date plan: " + e.message);
    }
}

async function editDatePlan(id) {
    const plan = datesList.find(d => d.id === id);
    if (!plan) return;
    
    // Set inputs
    document.getElementById('date-picker').value = plan.date;
    document.getElementById('time-picker').value = plan.time;
    document.getElementById('place-picker').value = plan.place;
    document.getElementById('activity-picker').value = plan.activity;
    
    // Jump scroll to top of ticket forms
    document.getElementById('date-screen').scrollTop = 0;
    
    // Animate focus highlights
    const form = document.getElementById('rsvp-controls');
    form.style.boxShadow = "0 0 15px rgba(223, 183, 108, 0.2)";
    setTimeout(() => { form.style.boxShadow = ""; }, 2000);
    
    activeEditDateId = id;
    
    const yesBtnSpan = document.querySelector('#rsvp-yes-btn span');
    if (yesBtnSpan) yesBtnSpan.textContent = "Update date plan!";
}

async function deleteDatePlan(id) {
    if (!confirm("Cancel this scheduled date? 🥺")) return;
    try {
        if (!isDemoMode) {
            await dbDeleteDate(id);
            const dynamicDates = await dbGetDates();
            datesList = dynamicDates || [];
        } else {
            datesList = datesList.filter(d => d.id !== id);
            localStorage.setItem('SAVED_DATES', JSON.stringify(datesList));
        }
        renderDates();
    } catch(e) {
        alert("Failed to delete date plan: " + e.message);
    }
}

function triggerConfettiExplosion() {
    const colors = ['#ff3366', '#dfb76c', '#ffffff', '#ffccd5'];
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.1, y: 0.6 },
        colors: colors
    });
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.9, y: 0.6 },
        colors: colors
    });
    setTimeout(() => {
        confetti({
            particleCount: 100,
            spread: 90,
            origin: { y: 0.55 },
            colors: colors
        });
    }, 250);
}

// --- Synced Background Floating Lyrics ---
const lyricData = [
    { time: 0, text: '' },
    { time: 10.6, text: 'Georgia, wrap me up in all your...' },
    { time: 17.0, text: 'I want ya\', in my arms' },
    { time: 22.4, text: 'Oh, let me hold ya\'' },
    { time: 27.8, text: 'I\'ll never let you go again, like I did' },
    { time: 33.4, text: 'Oh, I used to say' },
    { time: 37.4, text: '"I would never fall in love again until I found her"' },
    { time: 44.2, text: 'I said, "I would never fall unless it\'s you I fall into"' },
    { time: 51.4, text: 'I was lost within the darkness, but then i found her' },
    { time: 58.2, text: 'I found you' },
    { time: 67.7, text: 'Georgia, pulled me in, I asked to...' },
    { time: 74.4, text: 'Love her, once again' },
    { time: 79.5, text: 'You fell, i caught ya\'' },
    { time: 83.3, text: 'I\'ll never let you go again, like I did' },
    { time: 90.7, text: 'Oh, I used to say' },
    { time: 94.2, text: '"I would never fall in love again until I found her"' },
    { time: 101.3, text: 'I said, "I would never fall unless it\'s you I fall into"' },
    { time: 108.4, text: 'I was lost within the darkness, but then i found her' },
    { time: 115.2, text: 'I found you' },
    { time: 136.8, text: '"I would never fall in love again until I found her"' },
    { time: 144.0, text: 'I said, "I would never fall unless it\'s you I fall into"' },
    { time: 151.2, text: 'I was lost within the darkness, but then i found her' },
    { time: 157.9, text: 'I found you' }
];

let currentLyricIndex = -1;

function updateLyrics(currentTime) {
    if (playlist.length === 0) return;
    
    // Only use synced lyric lines for Sanchez default song
    const currentSong = playlist[currentSongIndex];
    const isSanchezSong = currentSong.audio_url === 'assets/bg_music.mp3' || currentSong.id === 'default-s-1';
    
    if (isSanchezSong) {
        let activeIndex = -1;
        for (let i = 0; i < lyricData.length; i++) {
            if (currentTime >= lyricData[i].time) {
                activeIndex = i;
            } else {
                break;
            }
        }
        
        if (activeIndex !== currentLyricIndex) {
            currentLyricIndex = activeIndex;
            const currentText = currentLyricIndex >= 0 ? lyricData[currentLyricIndex].text : '';
            displayLyric(currentText);
        }
    } else {
        // Dynamic dynamic visual update
        const customText = audioPlaying ? `Listening to: "${currentSong.title}" - ${currentSong.artist} ❤️` : "";
        displayLyric(customText);
    }
}

function displayLyric(text) {
    const lyricElements = document.querySelectorAll('.lyric-line');
    lyricElements.forEach(el => {
        el.classList.remove('active');
        
        setTimeout(() => {
            el.textContent = text;
            if (text) {
                el.classList.add('active');
            }
        }, 200);
    });
}

function updateSpotifyProgressBar(currentTime, duration) {
    const progressFill = document.getElementById('spotify-progress-fill');
    const timeCurrent = document.getElementById('spotify-time-current');
    const timeDuration = document.getElementById('spotify-time-duration');
    
    if (progressFill && timeCurrent) {
        timeCurrent.textContent = formatTime(currentTime);
        
        if (duration && !isNaN(duration)) {
            timeDuration.textContent = formatTime(duration);
            const percent = (currentTime / duration) * 100;
            progressFill.style.width = `${percent}%`;
        } else {
            const fallbackDuration = 177;
            timeDuration.textContent = formatTime(fallbackDuration);
            const percent = (currentTime / fallbackDuration) * 100;
            progressFill.style.width = `${percent}%`;
        }
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- PWA Custom Install Prompt handlers ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed successfully!');
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.add('hidden');
    }
    deferredPrompt = null;
});

// --- Upload/Edit Memories Modal Managers ---
function openMemoryModal() {
    activeEditMemoryId = null;
    selectedMemoryFile = null;
    
    document.getElementById('memory-form').reset();
    document.getElementById('memory-modal-title').textContent = "Upload a Memory";
    document.getElementById('memory-submit-text').textContent = "Upload Memory";
    
    document.getElementById('memory-preview-container').classList.add('hidden');
    document.getElementById('memory-dropzone').classList.remove('hidden');
    
    const modal = document.getElementById('memory-modal');
    if (modal) modal.classList.remove('hidden');
}

function openEditMemoryModal(e, id) {
    e.stopPropagation();
    activeEditMemoryId = id;
    selectedMemoryFile = null;
    
    const mem = memoriesList.find(m => m.id === id);
    if (!mem) return;
    
    document.getElementById('memory-modal-title').textContent = "Edit Memory Settings";
    document.getElementById('memory-submit-text').textContent = "Save Changes";
    
    document.getElementById('memory-title').value = mem.title;
    document.getElementById('memory-date').value = mem.date;
    document.getElementById('memory-author').value = mem.added_by || "Shivam";
    document.getElementById('memory-desc').value = mem.description || mem.caption || "";
    
    // Preview current photo
    const imageSrc = mem.image_url || mem.src;
    const previewContainer = document.getElementById('memory-preview-container');
    const previewImg = document.getElementById('memory-preview-img');
    const dropzone = document.getElementById('memory-dropzone');
    
    if (previewImg && previewContainer) {
        previewImg.src = imageSrc;
        previewContainer.classList.remove('hidden');
        if (dropzone) dropzone.classList.add('hidden');
    }
    
    const modal = document.getElementById('memory-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeMemoryModal() {
    const modal = document.getElementById('memory-modal');
    if (modal) modal.classList.add('hidden');
}

function handleMemoryFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    selectedMemoryFile = file;
    
    const previewContainer = document.getElementById('memory-preview-container');
    const previewImg = document.getElementById('memory-preview-img');
    const dropzone = document.getElementById('memory-dropzone');
    
    // Read local file preview
    const reader = new FileReader();
    reader.onload = (event) => {
        if (previewImg && previewContainer) {
            previewImg.src = event.target.result;
            previewContainer.classList.remove('hidden');
            if (dropzone) dropzone.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
}

function removeMemoryFilePreview(e) {
    e.stopPropagation();
    selectedMemoryFile = null;
    document.getElementById('memory-file').value = "";
    
    document.getElementById('memory-preview-container').classList.add('hidden');
    document.getElementById('memory-dropzone').classList.remove('hidden');
}

async function submitMemoryForm(event) {
    event.preventDefault();
    
    const title = document.getElementById('memory-title').value.trim();
    const date = document.getElementById('memory-date').value;
    const author = document.getElementById('memory-author').value;
    const desc = document.getElementById('memory-desc').value.trim();
    
    const submitBtn = document.querySelector('#memory-form button[type="submit"]');
    const origHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Saving changes...</span><i data-lucide="loader" class="btn-icon spin"></i>`;
    lucide.createIcons();
    
    try {
        let finalImageUrl = "";
        
        // Handle image loading
        if (selectedMemoryFile) {
            if (!isDemoMode) {
                finalImageUrl = await uploadFile('memories', selectedMemoryFile);
            } else {
                // local Base64 URL storage
                finalImageUrl = document.getElementById('memory-preview-img').src;
            }
        } else if (activeEditMemoryId) {
            // Keep old image url
            const oldMem = memoriesList.find(m => m.id === activeEditMemoryId);
            finalImageUrl = oldMem ? (oldMem.image_url || oldMem.src) : "";
        }
        
        if (!finalImageUrl && !activeEditMemoryId) {
            alert("Please select a memory photo first.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
            return;
        }
        
        const memoryDataObj = {
            title: title,
            date: date,
            added_by: author,
            description: desc,
            image_url: finalImageUrl
        };
        
        if (activeEditMemoryId) {
            if (!isDemoMode) {
                await dbUpdateMemory(activeEditMemoryId, memoryDataObj);
            } else {
                const idx = memoriesList.findIndex(m => m.id === activeEditMemoryId);
                if (idx !== -1) {
                    memoriesList[idx] = { ...memoriesList[idx], ...memoryDataObj };
                }
            }
        } else {
            if (!isDemoMode) {
                await dbAddMemory(memoryDataObj);
            } else {
                const newMem = {
                    id: 'mock-mem-' + Date.now(),
                    ...memoryDataObj,
                    src: finalImageUrl
                };
                memoriesList.push(newMem);
            }
        }
        
        closeMemoryModal();
        
        // Refresh local UI states
        if (!isDemoMode) {
            const dynamicMemories = await dbGetMemories();
            memoriesList = dynamicMemories || [];
        }
        renderMemories();
        
    } catch(e) {
        alert("Failed to save memory: " + e.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
        lucide.createIcons();
    }
}

async function deleteMemoryItem(e, id) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this memory forever? 🥺")) return;
    
    const mem = memoriesList.find(m => m.id === id);
    if (!mem) return;
    
    try {
        if (!isDemoMode) {
            await dbDeleteMemory(id, mem.image_url);
            const dynamicMemories = await dbGetMemories();
            memoriesList = dynamicMemories || [];
        } else {
            memoriesList = memoriesList.filter(m => m.id !== id);
        }
        renderMemories();
    } catch(e) {
        alert("Failed to delete memory: " + e.message);
    }
}

// --- Upload/Edit Songs Modal Managers ---
function openSongModal() {
    activeEditSongId = null;
    selectedSongFile = null;
    
    document.getElementById('song-form').reset();
    document.getElementById('song-modal-title').textContent = "Upload a Song";
    document.getElementById('song-submit-text').textContent = "Upload Song";
    
    document.getElementById('song-file-info').classList.add('hidden');
    document.getElementById('song-dropzone').classList.remove('hidden');
    
    const modal = document.getElementById('song-modal');
    if (modal) modal.classList.remove('hidden');
}

function openEditSongModal(e, id) {
    e.stopPropagation();
    activeEditSongId = id;
    selectedSongFile = null;
    
    const song = playlist.find(s => s.id === id);
    if (!song) return;
    
    document.getElementById('song-modal-title').textContent = "Edit Song Settings";
    document.getElementById('song-submit-text').textContent = "Save Changes";
    
    document.getElementById('song-title').value = song.title;
    document.getElementById('song-artist').value = song.artist;
    
    const fileInfo = document.getElementById('song-file-info');
    const fileNameText = document.getElementById('song-file-name');
    const dropzone = document.getElementById('song-dropzone');
    
    if (fileInfo && fileNameText && dropzone) {
        fileNameText.textContent = "Audio linked (Click below to replace file)";
        fileInfo.classList.remove('hidden');
        dropzone.classList.add('hidden');
    }
    
    const modal = document.getElementById('song-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSongModal() {
    const modal = document.getElementById('song-modal');
    if (modal) modal.classList.add('hidden');
}

function handleSongFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    selectedSongFile = file;
    
    const fileInfo = document.getElementById('song-file-info');
    const fileNameText = document.getElementById('song-file-name');
    const dropzone = document.getElementById('song-dropzone');
    
    if (fileInfo && fileNameText && dropzone) {
        fileNameText.textContent = file.name;
        fileInfo.classList.remove('hidden');
        dropzone.classList.add('hidden');
    }
}

function removeSongFilePreview(e) {
    e.stopPropagation();
    selectedSongFile = null;
    document.getElementById('song-file').value = "";
    
    document.getElementById('song-file-info').classList.add('hidden');
    document.getElementById('song-dropzone').classList.remove('hidden');
}

async function submitSongForm(event) {
    event.preventDefault();
    
    const title = document.getElementById('song-title').value.trim();
    const artist = document.getElementById('song-artist').value.trim();
    
    const submitBtn = document.querySelector('#song-form button[type="submit"]');
    const origHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Saving changes...</span><i data-lucide="loader" class="btn-icon spin"></i>`;
    lucide.createIcons();
    
    try {
        let finalAudioUrl = "";
        
        if (selectedSongFile) {
            if (!isDemoMode) {
                finalAudioUrl = await uploadFile('songs', selectedSongFile);
            } else {
                // local Blob URL for current session only
                finalAudioUrl = URL.createObjectURL(selectedSongFile);
            }
        } else if (activeEditSongId) {
            const oldSong = playlist.find(s => s.id === activeEditSongId);
            finalAudioUrl = oldSong ? oldSong.audio_url : "";
        }
        
        if (!finalAudioUrl && !activeEditSongId) {
            alert("Please select an MP3 file first.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
            return;
        }
        
        const songDataObj = {
            title: title,
            artist: artist,
            audio_url: finalAudioUrl
        };
        
        if (activeEditSongId) {
            if (!isDemoMode) {
                await dbUpdateSong(activeEditSongId, songDataObj);
            } else {
                const idx = playlist.findIndex(s => s.id === activeEditSongId);
                if (idx !== -1) {
                    playlist[idx] = { ...playlist[idx], ...songDataObj };
                }
            }
        } else {
            if (!isDemoMode) {
                await dbAddSong(songDataObj);
            } else {
                const newSong = {
                    id: 'mock-song-' + Date.now(),
                    ...songDataObj
                };
                playlist.push(newSong);
            }
        }
        
        closeSongModal();
        
        // Refresh local playlist
        if (!isDemoMode) {
            const dynamicSongs = await dbGetSongs();
            playlist = dynamicSongs ? [...DEFAULT_PLAYLIST, ...dynamicSongs] : [...DEFAULT_PLAYLIST];
        }
        renderPlaylist();
        
    } catch(e) {
        alert("Failed to save song: " + e.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
        lucide.createIcons();
    }
}

async function deleteSongItem(e, id) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this song? 🥺")) return;
    
    const song = playlist.find(s => s.id === id);
    if (!song) return;
    
    try {
        if (!isDemoMode) {
            await dbDeleteSong(id, song.audio_url);
            const dynamicSongs = await dbGetSongs();
            playlist = dynamicSongs ? [...DEFAULT_PLAYLIST, ...dynamicSongs] : [...DEFAULT_PLAYLIST];
        } else {
            playlist = playlist.filter(s => s.id !== id);
        }
        
        // Adjust index if we deleted currently playing song
        if (currentSongIndex >= playlist.length) {
            currentSongIndex = Math.max(0, playlist.length - 1);
        }
        
        renderPlaylist();
    } catch(e) {
        alert("Failed to delete song: " + e.message);
    }
}

// --- Our World Secret Screen Logic ---
let secretCanvas, secretCtx;
let secretStars = [];
let secretNebulaTime = 0;
let secretStarsActive = false;
let secretZoomSpeed = 30;
let floaters = [];
let floatingAnimFrame = null;

const LOVE_QUOTES = [
    "You are my today and all of my tomorrows. ❤️",
    "In a sea of people, my eyes will always search for you.",
    "If I know what love is, it is because of you.",
    "My heart is and always will be yours. 🌹",
    "To the world you may be one person, but to me you are the world.",
    "I love you more than words can show, I think about you more than you could know.",
    "Distance means so little when someone means so much.",
    "Every love story is beautiful, but ours is my favorite.",
    "Together with you is my favorite place to be. ✨",
    "You make my heart smile in ways nobody else can.",
    "You are my favorite notification. 😊",
    "We love because it's the only true adventure.",
    "You are the best thing that's ever been mine.",
    "You make me want to be a better person.",
    "You are my home, my peace, and my beautiful chaos.",
    "In your smile, I see something more beautiful than the stars.",
    "Loving you is the easiest thing I have ever done. ❤️",
    "My favorite place in the universe is right next to you.",
    "You are the music that my heart beats to. 🎶",
    "With you, time stands still and forever doesn't seem long enough.",
    "You have a place in my heart no one else could ever have.",
    "I would walk through a thousand universes just to hold your hand.",
    "You are my calm in the middle of any storm.",
    "Every day spent with you is my favorite day. So, today is my new favorite day.",
    "I love you not only for what you are, but for what I am when I am with you.",
    "You are my heart's permanent home. 🏠",
    "I need you like a heart needs a beat.",
    "You are the poem I never knew how to write, and this life is the story I always wanted to tell.",
    "You are my anchor in this crazy universe.",
    "My love for you is a journey, starting at forever and ending at never."
];

function initSecretScreen() {
    secretCanvas = document.getElementById('secret-canvas');
    if (!secretCanvas) return;
    secretCtx = secretCanvas.getContext('2d');
    
    function resizeCanvas() {
        if (!secretCanvas) return;
        secretCanvas.width = window.innerWidth;
        secretCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create secret stars
    const numStars = 120;
    secretStars = [];
    for (let i = 0; i < numStars; i++) {
        secretStars.push({
            x: (Math.random() - 0.5) * secretCanvas.width * 2,
            y: (Math.random() - 0.5) * secretCanvas.height * 2,
            z: Math.random() * secretCanvas.width,
            twinkle: Math.random() * 0.04 + 0.01,
            twinkleDir: Math.random() > 0.5 ? 1 : -1,
            opacity: Math.random() * 0.8 + 0.2
        });
    }
    
    secretNebulaTime = 0;
    secretZoomSpeed = 30; // High speed entry zoom
    secretStarsActive = true;
    
    // Populate floating polaroids
    const container = document.getElementById('floating-photos-container');
    if (container) {
        container.innerHTML = "";
        floaters = [];
        
        // Filter memories that have images
        const photoMemories = memoriesList.filter(m => m.image_url || m.src);
        
        photoMemories.forEach((mem, index) => {
            const card = document.createElement('div');
            card.className = 'floating-polaroid';
            card.innerHTML = `
                <div class="floating-polaroid-img-wrapper">
                    <img src="${mem.image_url || mem.src}" alt="${mem.title}">
                </div>
                <div class="floating-polaroid-caption">${mem.title}</div>
            `;
            
            const w = window.innerWidth;
            const h = window.innerHeight;
            
            // Random positions (avoid center quote box overlay)
            let x = Math.random() * (w - 180);
            let y = Math.random() * (h - 220);
            
            const cx = w / 2;
            const cy = h / 2;
            if (Math.abs(x - cx) < 200 && Math.abs(y - cy) < 200) {
                x = x < cx ? x - 150 : x + 150;
                y = y < cy ? y - 150 : y + 150;
            }
            
            card.style.left = `${x}px`;
            card.style.top = `${y}px`;
            
            const rotation = (Math.random() - 0.5) * 24;
            card.style.transform = `rotate(${rotation}deg)`;
            
            container.appendChild(card);
            
            const floater = {
                el: card,
                x: x,
                y: y,
                width: 160,
                height: 200,
                rotation: rotation,
                targetRotation: rotation,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                rotSpeed: (Math.random() - 0.5) * 0.05,
                isDragging: false,
                isHovered: false,
                dragged: false,
                startX: 0,
                startY: 0
            };
            
            card.addEventListener('click', (e) => {
                if (floater.dragged) {
                    floater.dragged = false;
                    return;
                }
                openMemoryLightboxByObject(mem);
            });
            
            card.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                startDrag(e, floater);
            });
            
            card.addEventListener('touchstart', (e) => {
                startDrag(e.touches[0], floater);
            });
            
            card.addEventListener('mouseenter', () => {
                floater.isHovered = true;
            });
            
            card.addEventListener('mouseleave', () => {
                floater.isHovered = false;
            });
            
            floaters.push(floater);
        });
        
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('touchmove', handleTouchDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchend', handleDragEnd);
    }
    
    function animate() {
        if (!secretStarsActive || !secretCanvas) return;
        floatingAnimFrame = requestAnimationFrame(animate);
        
        if (secretZoomSpeed > 0.45) {
            secretZoomSpeed -= 0.65;
        } else {
            secretZoomSpeed = 0.45;
        }
        
        secretNebulaTime += 0.002;
        const h1 = 260 + Math.sin(secretNebulaTime) * 35;
        const h2 = 200 + Math.cos(secretNebulaTime * 0.8) * 30;
        const h3 = 345 + Math.sin(secretNebulaTime * 0.5) * 15;
        
        const width = secretCanvas.width;
        const height = secretCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        const gradient = secretCtx.createRadialGradient(
            centerX + Math.sin(secretNebulaTime * 1.5) * (width * 0.25),
            centerY + Math.cos(secretNebulaTime) * (height * 0.25),
            10,
            centerX,
            centerY,
            Math.max(width, height) * 0.8
        );
        
        gradient.addColorStop(0, `hsla(${h1}, 70%, 10%, 1)`);
        gradient.addColorStop(0.4, `hsla(${h2}, 60%, 7%, 1)`);
        gradient.addColorStop(0.7, `hsla(${h3}, 55%, 8%, 0.8)`);
        gradient.addColorStop(1, '#050505');
        
        secretCtx.fillStyle = gradient;
        secretCtx.fillRect(0, 0, width, height);
        
        for (let i = 0; i < secretStars.length; i++) {
            const star = secretStars[i];
            star.z -= secretZoomSpeed;
            
            if (star.z <= 0) {
                star.x = (Math.random() - 0.5) * secretCanvas.width * 2;
                star.y = (Math.random() - 0.5) * secretCanvas.height * 2;
                star.z = secretCanvas.width;
            }
            
            const px = (star.x / star.z) * centerX + centerX;
            const py = (star.y / star.z) * centerY + centerY;
            
            if (px >= 0 && px < width && py >= 0 && py < height) {
                if (secretZoomSpeed <= 0.5) {
                    star.opacity += star.twinkle * star.twinkleDir;
                    if (star.opacity >= 1) {
                        star.opacity = 1;
                        star.twinkleDir = -1;
                    } else if (star.opacity <= 0.15) {
                        star.opacity = 0.15;
                        star.twinkleDir = 1;
                    }
                }
                
                const size = (1 - star.z / secretCanvas.width) * 3 + 0.3;
                
                secretCtx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
                secretCtx.beginPath();
                secretCtx.arc(px, py, size, 0, Math.PI * 2);
                secretCtx.fill();
            }
        }
        
        // Update physics
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        floaters.forEach(floater => {
            if (floater.isDragging) return;
            
            if (!floater.isHovered) {
                floater.x += floater.vx;
                floater.y += floater.vy;
                floater.rotation += floater.rotSpeed;
                floater.targetRotation = floater.rotation;
            }
            
            const buffer = 15;
            if (floater.x < -floater.width + buffer) {
                floater.x = -floater.width + buffer;
                floater.vx *= -1;
            } else if (floater.x > w - buffer) {
                floater.x = w - buffer;
                floater.vx *= -1;
            }
            
            if (floater.y < -floater.height + buffer) {
                floater.y = -floater.height + buffer;
                floater.vy *= -1;
            } else if (floater.y > h - buffer) {
                floater.y = h - buffer;
                floater.vy *= -1;
            }
            
            floater.el.style.left = `${floater.x}px`;
            floater.el.style.top = `${floater.y}px`;
            
            if (!floater.isHovered) {
                floater.el.style.transform = `rotate(${floater.rotation}deg)`;
            }
        });
    }
    animate();
}

function startDrag(e, floater) {
    floater.isDragging = true;
    floater.dragged = false;
    const rect = floater.el.getBoundingClientRect();
    floater.startX = e.clientX - rect.left;
    floater.startY = e.clientY - rect.top;
    floater.el.style.cursor = 'grabbing';
    
    floaters.forEach(f => f.el.style.zIndex = 2);
    floater.el.style.zIndex = 101;
}

function handleDragMove(e) {
    const activeFloater = floaters.find(f => f.isDragging);
    if (!activeFloater) return;
    
    activeFloater.dragged = true;
    
    activeFloater.x = e.clientX - activeFloater.startX;
    activeFloater.y = e.clientY - activeFloater.startY;
    
    activeFloater.el.style.left = `${activeFloater.x}px`;
    activeFloater.el.style.top = `${activeFloater.y}px`;
    activeFloater.el.style.transform = `scale(1.15) rotate(${activeFloater.rotation}deg)`;
}

function handleTouchDragMove(e) {
    if (e.touches.length === 0) return;
    handleDragMove(e.touches[0]);
}

function handleDragEnd() {
    const activeFloater = floaters.find(f => f.isDragging);
    if (!activeFloater) return;
    
    activeFloater.isDragging = false;
    activeFloater.el.style.cursor = 'grab';
    
    activeFloater.vx = (Math.random() - 0.5) * 0.6;
    activeFloater.vy = (Math.random() - 0.5) * 0.6;
    activeFloater.rotSpeed = (Math.random() - 0.5) * 0.05;
    
    activeFloater.el.style.transform = `rotate(${activeFloater.rotation}deg)`;
    
    setTimeout(() => {
        activeFloater.dragged = false;
    }, 80);
}

function stopSecretScreen() {
    secretStarsActive = false;
    if (floatingAnimFrame) {
        cancelAnimationFrame(floatingAnimFrame);
        floatingAnimFrame = null;
    }
}

function exitSecretScreen() {
    stopSecretScreen();
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('touchmove', handleTouchDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('touchend', handleDragEnd);
    navigateTo('menu-screen');
}

function displayDailyQuote() {
    const quoteEl = document.getElementById('daily-quote');
    if (!quoteEl) return;
    
    const today = new Date();
    const dayIndex = (today.getFullYear() * 372 + today.getMonth() * 31 + today.getDate()) % LOVE_QUOTES.length;
    
    quoteEl.textContent = `"${LOVE_QUOTES[dayIndex]}"`;
}
