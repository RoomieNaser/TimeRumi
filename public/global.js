//basic ui stuff here
const hamIcon = document.getElementById("ham");
const toggler = document.getElementById("darkModeToggle");
const ytLogo = document.getElementById("ytlogo");
const copyLogo = document.getElementById("copyIcon");
const audio = document.getElementById("clickAudio");

hamIcon.addEventListener("click", () => {
  audio.currentTime = 0;
  audio.volume = 0.7;
  audio.play();
});



//Dark Mode Toggle
toggler.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", isDark);

  //Icon change
  toggler.src = isDark ? "/assets/darkMode.svg" : "/assets/lightMode.svg";
  ytLogo.src = isDark ? "/assets/logoDark.png" : "/assets/logo.png";
  hamIcon.src = isDark ? "/assets/homeDark.svg" : "/assets/homeLight.svg";
  copyLogo.src = isDark ? "/assets/copyDark.svg" : "/assets/copyLight.svg";
});

//DARK RESTORATION SPELL
window.addEventListener("DOMContentLoaded", () => {
  const isDark = localStorage.getItem("darkMode") === "true";
  if (isDark) {
    document.body.classList.add("dark-mode");
  }

  //exportCSV
  document.getElementById('exportCSV').addEventListener('click', () => {
    const rows = document.querySelectorAll('#history-table tr');
    let csvContent = '';

    rows.forEach(row => {
      const cols = Array.from(row.querySelectorAll('th, td')).map(cell =>
        `"${cell.textContent.trim()}"`
      );
      csvContent += cols.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'solve_history.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });


  //ICON RESTORATION SPELL
  toggler.src = isDark ? "/assets/darkMode.svg" : "/assets/lightMode.svg";
  ytLogo.src = isDark ? "/assets/logoDark.png" : "/assets/logo.png";
  hamIcon.src = isDark ? "/assets/homeDark.svg" : "/assets/homeLight.svg";
  copyLogo.src = isDark ? "/assets/copyDark.svg" : "/assets/copyLight.svg";
});
