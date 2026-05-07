(function () {
    "use strict";

    let isFullscreen = false;

    function getFullscreenElement() {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    function requestFullscreen(element) {
        if (element.requestFullscreen) return element.requestFullscreen();
        if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
        if (element.mozRequestFullScreen) return element.mozRequestFullScreen();
        if (element.msRequestFullscreen) return element.msRequestFullscreen();
    }

    function exitFullscreen() {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
        if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
        if (document.msExitFullscreen) return document.msExitFullscreen();
    }

    function toggleFullscreen() {
        const root = document.documentElement;

        if (!getFullscreenElement()) {
            requestFullscreen(root);
            isFullscreen = true;
        } else {
            exitFullscreen();
            isFullscreen = false;
        }

        updateUI();
    }

    function forceExitFullscreen() {
        if (getFullscreenElement()) {
            exitFullscreen();
            isFullscreen = false;
            updateUI();
        }
    }

    function updateUI() {
        const btn = document.querySelector('[data-fullscreen-btn]');
        if (!btn) return;

        btn.textContent = getFullscreenElement()
            ? "Quitter plein écran"
            : "Plein écran";
    }

    function init() {
        // Bouton fullscreen
        document.addEventListener("click", function (e) {
            const btn = e.target.closest('[data-fullscreen-btn]');
            if (!btn) return;

            e.preventDefault();
            toggleFullscreen();
        });

        // ESC global (CAPTURE = priorité max)
        document.addEventListener(
            "keydown",
            function (e) {
                if (e.key === "Escape") {
                    forceExitFullscreen();
                }
            },
            true // 🔥 important : capture
        );

        // Sync si fullscreen changé autrement
        document.addEventListener("fullscreenchange", updateUI);
        document.addEventListener("webkitfullscreenchange", updateUI);
        document.addEventListener("mozfullscreenchange", updateUI);
        document.addEventListener("MSFullscreenChange", updateUI);
    }

    // Lancement
    init();
})();