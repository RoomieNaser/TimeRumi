const header = document.querySelector("header");
const slider = document.querySelector(".slider");
const slides = slider.querySelectorAll("img");
const description = document.getElementById("carousel-description");
const navDots = document.querySelectorAll('.nav-dot');

const descriptions = [
    "Click the singleplayer button to enter solo mode, no need for a name",
    "You will be greeted with a scramble, timer UI, and averages",
    "Hold space to prepare the timer. Release to start",
    "Solve the cube while the timer runs!",
    "Apply penalties if needed per WCA rules",
    "Use the left button to open statistics",
    "Edit or delete solves via stats panel",
    "Delete all solves with confirmation",
    "Export solves as a CSV file",
    "Customize everything in settings and enjoy!"
];

let currentIndex = 0;
const totalSlides = slides.length;
let autoSlideInterval;
let pauseTimeout;

function goToSlide(index) {
    currentIndex = index;
    const offset = slides[index].offsetLeft;
    slider.scrollTo({ left: offset, behavior: 'smooth' });
    description.textContent = descriptions[index];
    updateNavDots(index);
}


function startAutoSlide() {
  clearInterval(autoSlideInterval);
  autoSlideInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % totalSlides;
    goToSlide(currentIndex);
  }, 5000);
}

function pauseAutoSlide(tempPause = 3000) {
  clearInterval(autoSlideInterval);
  clearTimeout(pauseTimeout);
  pauseTimeout = setTimeout(startAutoSlide, tempPause);
}

function updateNavDots(index) {
  navDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// Handle manual dot click
navDots.forEach((dot, index) => {
  dot.addEventListener('click', (e) => {
    e.preventDefault(); // prevents anchor scroll
    goToSlide(index);
    pauseAutoSlide(); // pause and resume later
  });
});

// Optional: pause on hover
slider.addEventListener('mouseenter', () => {
  clearInterval(autoSlideInterval);
});
slider.addEventListener('mouseleave', () => {
  pauseAutoSlide(2000);
});



// Start the slideshow
goToSlide(0);
startAutoSlide();


window.addEventListener("scroll", () => {
    if (window.scrollY > 800) {
        header.style.display = "none";
    } else {
        header.style.display = "flex";
    }
});

