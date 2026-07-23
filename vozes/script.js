/**
 * script.js - Página "as vozes no meio do redemunho"
 * Revelação orgânica com máscara radial + hover/click.
 * Vanilla JS, sem canvas, sem GSAP.
 */

// ============================================================
// CONSTANTES - Dimensões originais da imagem (coords absolutas)
// ============================================================
const IMG_W = 2524;
const IMG_H = 3508;

// Coordenadas absolutas originais (vindas do coords.json).
const HOTSPOTS_RAW = [
    { id: "vaqueiro", x: 694, y: 922, w: 251, h: 238 },
    { id: "fogueira", x: 972, y: 922, w: 236, h: 230 },
    { id: "sol", x: 1262, y: 855, w: 379, h: 342 },
    { id: "peixes", x: 1656, y: 907, w: 262, h: 218 },
    { id: "facas", x: 1931, y: 885, w: 283, h: 283 },
    { id: "passaro", x: 1787, y: 1492, w: 573, h: 963 },
    { id: "onça", x: 1641, y: 2483, w: 237, h: 314 },
    { id: "barquinho", x: 1282, y: 2520, w: 314, h: 218 },
    { id: "garças", x: 1003, y: 2483, w: 236, h: 232 },
    { id: "estrelas", x: 635, y: 2483, w: 337, h: 255 },
    { id: "boi", x: 331, y: 2455, w: 263, h: 278 },
    { id: "cobra", x: 239, y: 1408, w: 519, h: 963 },
    { id: "boneco", x: 787, y: 1326, w: 949, h: 923 },
];

function toRelative(coord) {
    return {
        id: coord.id,
        left: (coord.x / IMG_W) * 100,
        top: (coord.y / IMG_H) * 100,
        width: (coord.w / IMG_W) * 100,
        height: (coord.h / IMG_H) * 100,
    };
}

const HOTSPOTS = HOTSPOTS_RAW.map(toRelative);

// Placeholder MP3 — troque para assets/<id>.mp3 em produção.
const MP3_URL = "https://samplelib.com/lib/preview/mp3/sample-3s.mp3";
function audioSrc(id) {
    return MP3_URL;
}

// ============================================================
// CLASSE: AudioPlayer
// ============================================================
class AudioPlayer {
    constructor(host) {
        this.host = host;
        this.audio = null;
        this.element = null;
        this.currentHotspotId = null;
        this.isOpen = false;
        this.isDragging = false;
        this._build();
    }

    _build() {
        const player = document.createElement("div");
        player.className = "custom-player";
        player.innerHTML = `
            <button class="player-btn" aria-label="Play/Pause">
                <i class="fa-solid fa-play"></i>
            </button>
            <div class="player-track">
                <div class="player-fill">
                    <div class="player-thumb"></div>
                </div>
            </div>
            <span class="player-time">0:00</span>
            <button class="player-close" aria-label="Fechar">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        this.host.appendChild(player);
        this.element = player;

        this.btn = player.querySelector(".player-btn");
        this.icon = player.querySelector(".player-btn i");
        this.track = player.querySelector(".player-track");
        this.fill = player.querySelector(".player-fill");
        this.thumb = player.querySelector(".player-thumb");
        this.time = player.querySelector(".player-time");
        this.closeBtn = player.querySelector(".player-close");

        this._wireEvents();
    }

    _wireEvents() {
        this.btn.addEventListener("click", () => this.toggle());
        this.closeBtn.addEventListener("click", () => this.close());

        this.track.addEventListener("click", (e) => {
            if (!this.audio || this.isDragging) return;
            const rect = this.track.getBoundingClientRect();
            this.seek(clamp((e.clientX - rect.left) / rect.width, 0, 1));
        });

        const onDown = (e) => {
            if (!this.audio) return;
            e.preventDefault();
            this.isDragging = true;
            this.audio.pause();
        };
        this.thumb.addEventListener("mousedown", onDown);
        this.thumb.addEventListener("touchstart", onDown, { passive: false });

        const onMove = (e) => {
            if (!this.isDragging || !this.audio) return;
            const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
            if (cx == null) return;
            const rect = this.track.getBoundingClientRect();
            this.seek(clamp((cx - rect.left) / rect.width, 0, 1));
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("touchmove", onMove, { passive: false });

        const onUp = () => {
            if (!this.isDragging || !this.audio) return;
            this.isDragging = false;
            this.audio.play();
        };
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchend", onUp);
    }

    open(id, refEl) {
        if (this.isOpen && this.currentHotspotId === id) return;
        this.close();
        this.currentHotspotId = id;
        this._createAudio(id);
        this._position(refEl);
        this.element.classList.add("is-open");
        this.isOpen = true;
    }

    close() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.currentHotspotId = null;
        this.isOpen = false;
        this.element.classList.remove("is-open");
    }

    toggle() {
        if (!this.audio) return;
        if (this.audio.paused) {
            this.audio.play();
            this.icon.className = "fa-solid fa-pause";
        } else {
            this.audio.pause();
            this.icon.className = "fa-solid fa-play";
        }
    }

    seek(fraction) {
        if (!this.audio) return;
        this.audio.currentTime = fraction * this.audio.duration;
    }

    _createAudio(id) {
        if (this.audio) {
            this.audio.pause();
            this.audio.remove();
        }
        this.audio = new Audio(audioSrc(id));
        this.audio.preload = "auto";
        this.audio.addEventListener("timeupdate", () => this._sync());
        this.audio.addEventListener("ended", () => {
            this.icon.className = "fa-solid fa-play";
            this.audio.currentTime = 0;
        });
        this.audio.addEventListener("loadedmetadata", () => this._sync());
    }

    _sync() {
        if (!this.audio) return;
        const dur = this.audio.duration || 1;
        const cur = this.audio.currentTime;
        const pct = (cur / dur) * 100;
        this.fill.style.width = pct + "%";
        this.time.textContent = formatTime(cur);
    }

    _position(refEl) {
        const rect = refEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        this.element.style.left = Math.round(cx) + "px";
        this.element.style.top = Math.round(cy) + "px";
        this.element.style.transform = "translate(-50%, -50%) scale(1)";
    }
}

// ============================================================
// CLASSE: HotspotManager
// ============================================================
class HotspotManager {
    constructor(container, darkenEl, player) {
        this.container = container;
        this.darkenEl = darkenEl;
        this.player = player;
        this.hotspots = [];
        this.activeId = null;
    }

    render() {
        const imgSrc = document.getElementById("vozes-image").getAttribute("src");

        HOTSPOTS.forEach((h) => {
            const div = document.createElement("div");
            div.className = "hotspot";
            div.dataset.id = h.id;
            div.style.left = h.left + "%";
            div.style.top = h.top + "%";
            div.style.width = h.width + "%";
            div.style.height = h.height + "%";

            // Passa background-image para o ::before via CSS custom properties
            const bgW = (100 / h.width) * 100;
            const bgH = (100 / h.height) * 100;
            div.style.setProperty("--bg-img", "url(" + imgSrc + ")");
            div.style.setProperty("--bg-size", bgW + "% " + bgH + "%");
            div.style.setProperty("--bg-pos", (-h.left / h.width) * 100 + "% " + (-h.top / h.height) * 100 + "%");

            this.container.appendChild(div);

            this.hotspots.push({ id: h.id, el: div });

            div.addEventListener("click", () => this._onClick(h.id));
        });
    }

    _onClick(id) {
        const found = this.hotspots.find((x) => x.id === id);
        if (!found) return;

        // Se já está ativo, fecha
        if (this.activeId === id) {
            this._deactivate();
            this.player.close();
            return;
        }

        // Se outro hotspot estava ativo, desativa antes
        if (this.activeId !== null) {
            const old = this.hotspots.find((x) => x.id === this.activeId);
            if (old) old.el.classList.remove("is-active");
            this.activeId = null;
        }

        // Ativa o novo
        this.activeId = id;
        found.el.classList.add("is-active");
        this.darkenEl.classList.add("is-visible");
        this.player.open(id, found.el);
    }

    _deactivate() {
        if (this.activeId) {
            const old = this.hotspots.find((x) => x.id === this.activeId);
            if (old) old.el.classList.remove("is-active");
        }
        this.activeId = null;
        this.darkenEl.classList.remove("is-visible");
        this.player.close();
    }
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + s.toString().padStart(2, "0");
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    const hotspotsLayer = document.getElementById("vozes-hotspots");
    const darkenEl = document.getElementById("vozes-darken");
    const playerHost = document.getElementById("player-host");

    if (!hotspotsLayer || !darkenEl || !playerHost) {
        console.warn("[vozes] Elementos essenciais não encontrados.");
        return;
    }

    const player = new AudioPlayer(playerHost);
    const manager = new HotspotManager(hotspotsLayer, darkenEl, player);
    manager.render();
});
