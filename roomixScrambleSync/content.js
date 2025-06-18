//quick lil test
console.log("Roomix content script loaded!");

function getScramble() {
    const el = document.getElementById("scrambleTxt");
    return el ? el.innerText.trim() : null;
}

//quick lil visual stuff
function showIndicator() {
    let badge = document.getElementById("roomixSyncBadge");

    if (!badge) {
        badge = document.createElement("div");
        badge.id = "roomixSyncBadge";
        badge.innerText = "Synced!";
        Object.assign(badge.style, {
            position: "fixed",
            top: "6px",
            right: "90px",
            padding: "6px 12px",
            background: "transparent",
            color: "white",
            fontWeight: "bold",
            borderRadius: "8px",
            boxShadow: "0 0 6px rgba(0,0,0,0.2)",
            zIndex: "9999",
            fontFamily: "sans-serif",
            transition: "opacity 0.3s",
        });
        document.body.appendChild(badge);
    }

    badge.style.opacity = "1";

    setTimeout(() => {
        badge.style.opacity = "0";
    }, 1000);
}

let lastSent = "";

setInterval(() => {
    const scramble = getScramble();

    if (scramble && scramble !== lastSent) {
        lastSent = scramble;

        fetch("http://localhost:3000/scramble", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scramble })
        })
        .then(res => res.json())
        .then(data => {
            console.log("Scramble synced LES GOOO", data.message);
            showIndicator();
        })
        .catch(err => console.error("Failed to sync scramble noooooo:", err));
    }
}, 2000);
