let isAnimatingScramble = false;
let lastScramble = "";

function typeScramble(scrambleText) {
    if (isAnimatingScramble) return; // 🚫 protect from overlapping
    
    isAnimatingScramble = true;

    const scrambleEl = document.getElementById('scramble');
    scrambleEl.textContent = "";
    scrambleEl.classList.add("typing-cursor");

    let scrambleIndex = 0;

    function typeNextChar() {
        if (scrambleIndex < scrambleText.length) {
            scrambleEl.textContent += scrambleText.charAt(scrambleIndex++);
            setTimeout(typeNextChar, 50);
        } else {
            scrambleEl.classList.remove("typing-cursor");
            isAnimatingScramble = false;
            lastScramble = scrambleText;
        }
    }

    typeNextChar();
}



//waits for html page to fully load that's coolll
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM FULLY LOADED");
    document.body.classList.add('loaded');

    document.getElementById('time').addEventListener('input', (e) => {
    let raw = e.target.value.replace(/\D/g, ''); // remove non-digits

    if (raw.length === 0) {
        e.target.value = '';
    } else if (raw.length === 1) {
        e.target.value = '0.0' + raw;
    } else if (raw.length === 2) {
        e.target.value = '0.' + raw;
    } else {
        const sec = raw.slice(0, -2).replace(/^0+/, '') || '0'; // remove leading 0s, fallback to 0
        const decimal = raw.slice(-2);
        e.target.value = sec + '.' + decimal;
    }
});


    const label = document.getElementById("scramble-label");
    const fullText = "Current Scramble:";
    let charIndex = 0;

    label.textContent = "";
    label.classList.add("typing-cursor");

    const typingSpeed = 80; // ms per character

    const typingInterval = setInterval(() => {
        if (charIndex < fullText.length) {
            label.textContent += fullText.charAt(charIndex++);
        } else {
            clearInterval(typingInterval);
            label.classList.remove("typing-cursor");

            // ✅ Now fetch the scramble after label is done
            const savedName = localStorage.getItem('roomixName');
            if (savedName) {
                document.getElementById('name').value = savedName;
            }

            fetch('/scramble')
                .then(res => res.json())
                .then(data => {
                    typeScramble(data.scramble); // ✅ Animate scramble now
                });
        }
    }, typingSpeed);
});

//hamburger
const hamburger = document.getElementById('ham');
const hamSound = new Audio('/sounds/hamburgerSound.mp3');

hamburger.addEventListener('click', () => {
    console.log('Ham detected!');
    hamSound.currentTime = 0;
    hamSound.volume = 0.7;
    hamSound.play();
});


//Listen for form submission (Enter key in time input)
document.getElementById('solveForm').addEventListener('submit', async (e) => {
    e.preventDefault(); //prevents page reload damnnn
    console.log("Form submitted!");

    const name = document.getElementById('name').value.trim();
    const timeInput = document.getElementById('time');
    const time = parseFloat(timeInput.value);

    console.log("Parsed values!");

    if (!name || isNaN(time)){
        console.log("Invalid Input!");
        return;
    }

    localStorage.setItem('roomixName', name);

    //send to server
    const res = await fetch('/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, time})
    });

    //Display from server
    const result = await res.json();
    
    const responseEl = document.getElementById('response');

    if(res.status !== 200){
        responseEl.textContent = result.error || "idek wtf happened here";
        responseEl.classList.remove('fade-out');
        setTimeout(() => {
            responseEl.textContent = '';
        }, 3000);
        return;
    }

    //on succeeess
    responseEl.textContent = result.message || "Submitted!";
    responseEl.classList.remove('fade-out');
    setTimeout(() => {
        responseEl.classList.add('fade-out')
    }, 2000);
    setTimeout(() => {
        responseEl.textContent = '';
        responseEl.classList.remove('fade-out');
    }, 3000);

    //Clear time field for next solve
    timeInput.value = '';
    timeInput.focus();
    checkScrambleChange();
});

//Trying not to refresh every time by refreshing from the backend instead lmao - credit for this is chatgpt fr fr
lastScramble = "";

async function checkScrambleChange() {
    if (isAnimatingScramble) return; // 🚫 don't interrupt typing

    try {
        const res = await fetch('/scramble');
        const data = await res.json();

        // ✅ Bail early if it's identical or already queued
        if (!data.scramble || data.scramble === lastScramble) return;

        typeScramble(data.scramble);
    } catch (err) {
        console.error("Error checking scramble:", err);
    }
}



setInterval(checkScrambleChange, 2000);

//Color change on epic typing
const nameInput = document.querySelector('.form-box input');

nameInput.addEventListener('blur', () => {
  if (nameInput.value.trim() !== "") {
    nameInput.classList.add('has-text');
  } else {
    nameInput.classList.remove('has-text');
  }
});


//Dark-mode logiccc
const darkToggle = document.getElementById('darkModeToggle');
const toggleIcon = document.getElementById('darkModeToggle');
const ytLogo = document.getElementById('ytlogo');
const ham = document.getElementById('ham');
const body = document.body;

// restore previous reload mode
if (localStorage.getItem('darkMode') === 'true') {
    body.classList.add('dark-mode');
    toggleIcon.src = 'assets/lightMoon.png';
    ytLogo.src = 'assets/logoDark.png';
    ham.src = 'assets/hamburger-menu-dark.svg';
}

toggleIcon.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');

    const isDark = document.body.classList.contains('dark-mode');

    toggleIcon.src = isDark ? 'assets/lightMoon.png' : 'assets/darkMoon.png';
    ytLogo.src = isDark ? 'assets/logoDark.png' : 'assets/logo.png';
    ham.src = isDark ? 'assets/hamburger-menu-dark.svg' : 'assets/hamburger-menu.svg';
    localStorage.setItem('darkMode', isDark);
});

//LEADERBOARD STUFFS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);

    if (mins > 0) {
        const [secWhole, secDecimal] = secs.split(".");
        return `${mins}:${secWhole.padStart(2, '0')}.${secDecimal}`;
    } else {
        return `${secs}s`;
    }
}

let previousTop5 = [];

async function updateLeaderboard() {
    try {
        const res = await fetch('/leaderboard');
        const data = await res.json();
        const list = document.getElementById('top5');
        list.innerHTML = ''; // clear existing

        data.top5.forEach((entry, i) => {
            const li = document.createElement('li');
            const timeStr = formatTime(entry.time);

            let rankClass = '';
            if(i === 0) rankClass = 'gold';
            else if (i === 1) rankClass = 'silver';
            else if (i === 2) rankClass = 'bronze';

            li.innerHTML = `
                <span class="rank ${rankClass}">${i + 1}.</span>
                <span class="name">${entry.name}</span>
                <span class="time">${timeStr}</span>
            `;

            // Check for overtakes or new entries
            const prev = previousTop5[i];
            const isNew = !prev || prev.name !== entry.name || prev.time !== entry.time;

            if (isNew) {
                li.classList.add('new-entry');
                setTimeout(() => {
                    li.classList.remove('new-entry');
                }, 1500);
            }

            list.appendChild(li);
        });

        // Update the cache
        previousTop5 = [...data.top5];

    } catch (err) {
        console.error("Leaderboard could not be fetched, bruh lmao", err);
    }
}

setInterval(updateLeaderboard, 3000);
updateLeaderboard();




