const header = document.querySelector("header");

const singleplayerBox = document.getElementById("singleplayer-help");
const multiplayerBox = document.getElementById("multiplayer-help");
const streamBox = document.getElementById("stream-help");

const singleplayerSection = document.getElementById("singleplayer-section");
const multiplayerSection = document.getElementById("multiplayer-section");
const streamSection = document.getElementById("streaming-section");

// Description Sets
const timerTutorialDescriptions = [
  "Click the singleplayer button to enter solo mode, no need for a name",
  "You will be greeted with a scramble, timer UI, and averages",
  "Hold space to prepare the timer. Release to start",
  "Solve the cube while the timer runs! You can stop the timer using any key",
  "Apply penalties if needed per WCA rules",
  "Use the left button to open statistics",
  "Edit or delete solves via stats panel",
  "Delete all solves with confirmation",
  "Export solves as a CSV file",
  "Customize everything in settings and enjoy!"
];

const customizationDescriptions = [
  "Go into the settings menu to start customizing!",
  "Select a font for the overall website (excluding the timer)",
  "Turn on focus mode to remove decorations",
  "Turn on dark mode if you like your eyes",
  "If seeing the leaderboard is distracting in multiplayer, turn it off!",
  "Turn off averages for hiding the ao5 and ao12 in singleplayer mode",
  "Under 'Timer Settings', use the font dropdown to choose the timer's font (I like Digital-7!)",
  "If you prefer using your own timer, select manual mode and type out your entries as shown. Remember - the last two digits will be what's in the fractional part! (Accuracy up to 2 decimals only)",
  "Turn on WCA inspection for 15 seconds of inspection time with auto penalties on exceeding it. The timer will beep twice during inspection - once when 8 seconds have passed and again once 12 seconds have passed respectively"
];



// Loop through each carousel
document.querySelectorAll(".slider-wrapper").forEach((wrapper) => {
  const slider = wrapper.querySelector(".slider");
  const slides = slider.querySelectorAll("img, video");
  const navDots = wrapper.querySelectorAll(".nav-dot");
  const description = wrapper.parentElement.querySelector(".carousel-desc");
  const carouselType = wrapper.dataset.carousel;
  

  // Determine which descriptions to use
  let descriptions = [];
  switch (carouselType) {
    case "customization":
      descriptions = customizationDescriptions;
      break;
    case "timer":
      descriptions = timerTutorialDescriptions;
      break;
    default:
      descriptions = []; // Fallback if needed
  }

  let currentIndex = 0;
  let autoSlideInterval;
  let pauseTimeout;
  console.log(`Carousel: ${carouselType}, Description[${currentIndex}]: ${descriptions[currentIndex]}`);


  function goToSlide(index) {
    currentIndex = index;
    const targetSlide = slides[index];
    if (!targetSlide) return;

    slider.scrollTo({ left: targetSlide.offsetLeft, behavior: 'smooth' });

    // Pause all videos
    slides.forEach(slide => {
      if (slide.tagName === "VIDEO") {
        slide.pause();
        slide.currentTime = 0;
      }
    });

    if (targetSlide.tagName === "VIDEO") {
      targetSlide.play().catch(err => console.warn("Video autoplay failed", err));
    }

    if (description) description.textContent = descriptions[index] || "";
    updateNavDots(index);
  }

  function startAutoSlide() {
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => {
      const currentSlide = slides[currentIndex];
      if (currentSlide?.tagName === "VIDEO" && !currentSlide.ended) return;
      currentIndex = (currentIndex + 1) % slides.length;
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
      dot.classList.toggle("active", i === index);
    });
  }

  navDots.forEach((dot, index) => {
    dot.addEventListener("click", (e) => {
      e.preventDefault();
      goToSlide(index);
      pauseAutoSlide();
    });
  });

  slider.addEventListener("mouseenter", () => clearInterval(autoSlideInterval));
  slider.addEventListener("mouseleave", () => pauseAutoSlide(2000));

  // Init
  goToSlide(0);
  startAutoSlide();
});

// Scrolling nav
window.addEventListener("scroll", () => {
  header.style.display = window.scrollY > 800 ? "none" : "flex";
});

function scrollToSection(target) {
  if (!target) return;
  const y = target.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: y, behavior: "smooth" });
}

singleplayerBox.addEventListener("click", () => scrollToSection(singleplayerSection));
multiplayerBox.addEventListener("click", () => scrollToSection(multiplayerSection));
streamBox.addEventListener("click", () => scrollToSection(streamSection));

