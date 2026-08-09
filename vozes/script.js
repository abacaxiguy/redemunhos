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

// Coordenadas absolutas originais + áudio associado.
// O campo `audio` viaja junto do hotspot para que a relação fique
// explícita — sem precisar conferir duas listas em paralelo.
const HOTSPOTS_RAW = [
    { id: "vaqueiro", audio: "../assets/audio/vaqueiro (GLORIA MACIEL).m4a", x: 694, y: 922, w: 251, h: 238 },
    { id: "fogueira", audio: "../assets/audio/fogueira (LUCIANO PEDRO JR).m4a", x: 972, y: 922, w: 236, h: 230 },
    { id: "sol", audio: "../assets/audio/sol (ADELAIDE IVÁNOVA).m4a", x: 1262, y: 855, w: 379, h: 342 },
    { id: "peixes", audio: "../assets/audio/peixes (ÉRIKA SANTOS).m4a", x: 1656, y: 907, w: 262, h: 218 },
    { id: "facas", audio: "../assets/audio/facas (MARIANA SALVADOR).m4a", x: 1931, y: 885, w: 283, h: 283 },
    { id: "passaro", audio: "../assets/audio/pássaro grande (KENNYO SEVERA).m4a", x: 1787, y: 1492, w: 573, h: 963 },
    { id: "onça", audio: "../assets/audio/onça (GUILHERME GONTIJO FLORES).m4a", x: 1641, y: 2483, w: 237, h: 314 },
    { id: "barquinho", audio: "../assets/audio/barquinho (CÁSSIA DE JESUS).m4a", x: 1282, y: 2520, w: 314, h: 218 },
    { id: "garças", audio: "../assets/audio/garças (LUCAS LITRENTO).m4a", x: 1003, y: 2483, w: 236, h: 232 },
    { id: "estrelas", audio: "../assets/audio/estrelas (JÚLIA CUNHA).m4a", x: 635, y: 2483, w: 337, h: 255 },
    { id: "boi", audio: "../assets/audio/cabeça de boi (TAMLYN GHANNAM).m4a", x: 331, y: 2455, w: 263, h: 278 },
    { id: "cobra", audio: "../assets/audio/cobra grande (JESUÍTA BARBOSA).m4a", x: 239, y: 1408, w: 519, h: 963 },
    { id: "boneco", audio: "../assets/audio/diabo no meio (AMANDYRA).m4a", x: 787, y: 1326, w: 949, h: 923 },
];

function toRelative(coord) {
    return {
        id: coord.id,
        audio: coord.audio,
        left: (coord.x / IMG_W) * 100,
        top: (coord.y / IMG_H) * 100,
        width: (coord.w / IMG_W) * 100,
        height: (coord.h / IMG_H) * 100,
    };
}

const HOTSPOTS = HOTSPOTS_RAW.map(toRelative);

// Índice por id para lookup O(1).
const HOTSPOT_BY_ID = Object.fromEntries(HOTSPOTS.map((h) => [h.id, h]));

function audioSrc(id) {
    return HOTSPOT_BY_ID[id]?.audio;
}

// ============================================================
// CLASSE: AudioPlayer
// ============================================================
class AudioPlayer {
    constructor(host) {
        this.host = host;
        this.element = null;
        this.currentHotspotId = null;
        this.isOpen = false;
        this.isDragging = false;
        // Um único <audio> reaproveitado entre hotspots. iOS/WebKit exige
        // que cada elemento de mídia seja "desbloqueado" pelo próprio gesto
        // do usuário — pausar um elemento e dar play() num Audio() novo no
        // mesmo clique é silenciosamente rejeitado lá (por isso a troca de
        // hotspot exigia um segundo toque no iPhone, mas funcionava no
        // Android). Reaproveitando o mesmo elemento, ele fica desbloqueado
        // depois do primeiro play() e todas as trocas seguintes funcionam
        // de primeira, nos dois sistemas.
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.addEventListener("timeupdate", () => this._sync());
        this.audio.addEventListener("ended", () => {
            this.icon.className = "fa-solid fa-play";
            this.audio.currentTime = 0;
            // Sinaliza que o áudio nao está mais tocando para que o
            // HotspotManager possa liberar o overlay se o mouse ja
            // tiver saído do hotspot.
            this.element?.dispatchEvent(new CustomEvent("audio-ended"));
        });
        this.audio.addEventListener("loadedmetadata", () => this._sync());
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
        // Ao clicar na figura, já inicia o áudio
        this.toggle();
    }

    isPlaying() {
        // Considera "tocando" qualquer áudio que esteja carregado e em
        // estado de reproduçao (nao pausado, nao encerrado).
        return !!(this.audio && !this.audio.paused && !this.audio.ended);
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
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = audioSrc(id);
        this.audio.load();
    }

    _sync() {
        if (!this.audio) return;
        const dur = this.audio.duration || 1;
        const cur = this.audio.currentTime;
        const pct = (cur / dur) * 100;
        this.fill.style.width = pct + "%";
        this.time.textContent = formatTime(dur - cur);
    }

    _position(refEl) {
        // Usa a geometria estática (left/top/width/height em %, gravados
        // no render()) em vez de getBoundingClientRect(refEl): o hotspot
        // pode estar no meio da animação de hover/active (transform: scale),
        // e isso deixaria a posição ligeiramente diferente a cada clique.
        const wrap = document.getElementById("vozes-image-wrap");
        const wrapRect = wrap.getBoundingClientRect();
        const leftPct = parseFloat(refEl.style.left) / 100;
        const topPct = parseFloat(refEl.style.top) / 100;
        const widthPct = parseFloat(refEl.style.width) / 100;
        const heightPct = parseFloat(refEl.style.height) / 100;

        const boxLeft = wrapRect.left + leftPct * wrapRect.width;
        const boxTop = wrapRect.top + topPct * wrapRect.height;
        const boxWidth = widthPct * wrapRect.width;
        const boxHeight = heightPct * wrapRect.height;

        const cx = boxLeft + window.scrollX + boxWidth / 2;
        const cy = boxTop + boxHeight + window.scrollY + 12;

        // Trava a pílula dentro da viewport: hotspots próximos da borda
        // (ex.: "boi", "cobra") centralizariam o player fora da tela,
        // cortando o botão de play/fechar do lado que escapa.
        const margin = 10;
        const playerWidth = this.element.offsetWidth || 170;
        const viewportLeft = window.scrollX + margin + playerWidth / 2;
        const viewportRight = window.scrollX + document.documentElement.clientWidth - margin - playerWidth / 2;
        const clampedCx = clamp(cx, viewportLeft, viewportRight);

        this.element.style.left = Math.round(clampedCx) + "px";
        this.element.style.top = Math.round(cy) + "px";
        this.element.style.transform = "translate(-50%, 0)";
    }
}

// ============================================================
// CLASSE: VideoPlayer (player minimalista do vídeo final)
// ============================================================
class VideoPlayer {
    constructor(frame) {
        this.frame = frame;
        this.video = frame.querySelector(".vozes-video");
        this.centerBtn = frame.querySelector(".video-center-btn");
        this.centerIcon = this.centerBtn.querySelector("i");
        this.track = frame.querySelector(".video-track");
        this.fill = frame.querySelector(".video-fill");
        this.fullscreenBtn = frame.querySelector(".video-fullscreen-btn");
        this.fullscreenIcon = this.fullscreenBtn.querySelector("i");
        this.isDragging = false;
        this.wasPlayingBeforeDrag = false;
        this._wireEvents();
    }

    _wireEvents() {
        this.video.addEventListener("click", () => this.toggle());
        this.centerBtn.addEventListener("click", () => this.toggle());

        this.video.addEventListener("play", () => {
            this.frame.classList.add("is-playing");
            this.centerIcon.className = "fa-solid fa-pause";
        });
        this.video.addEventListener("pause", () => {
            this.frame.classList.remove("is-playing");
            this.centerIcon.className = "fa-solid fa-play";
        });
        this.video.addEventListener("ended", () => {
            this.frame.classList.remove("is-playing");
            this.centerIcon.className = "fa-solid fa-play";
            this.video.currentTime = 0;
        });
        this.video.addEventListener("timeupdate", () => this._sync());
        this.video.addEventListener("loadedmetadata", () => this._sync());

        this.fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
        document.addEventListener("fullscreenchange", () => this._syncFullscreenIcon());

        const seekFromEvent = (e) => {
            const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
            if (cx == null) return;
            const rect = this.track.getBoundingClientRect();
            this.seek(clamp((cx - rect.left) / rect.width, 0, 1));
        };

        const onDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = true;
            this.wasPlayingBeforeDrag = !this.video.paused;
            this.video.pause();
            seekFromEvent(e);
        };
        this.track.addEventListener("mousedown", onDown);
        this.track.addEventListener("touchstart", onDown, { passive: false });

        const onMove = (e) => {
            if (!this.isDragging) return;
            seekFromEvent(e);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("touchmove", onMove, { passive: false });

        const onUp = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            if (this.wasPlayingBeforeDrag) this.video.play();
        };
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchend", onUp);
    }

    toggle() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    seek(fraction) {
        const dur = this.video.duration;
        if (!isFinite(dur)) return;
        this.video.currentTime = fraction * dur;
        this._sync();
    }

    toggleFullscreen() {
        if (document.fullscreenElement === this.frame) {
            document.exitFullscreen();
        } else {
            this.frame.requestFullscreen?.().catch(() => {});
        }
    }

    _syncFullscreenIcon() {
        const isFullscreen = document.fullscreenElement === this.frame;
        this.fullscreenIcon.className = isFullscreen ? "fa-solid fa-compress" : "fa-solid fa-expand";
    }

    _sync() {
        const dur = this.video.duration || 1;
        const pct = (this.video.currentTime / dur) * 100;
        this.fill.style.width = pct + "%";
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
        // Quando o áudio termina ou é pausado/fechado e o mouse ja nao
        // está sobre um hotspot, libera o overlay.
        this.player.element.addEventListener("audio-ended", () => {
            if (this.activeId === null && !this._anyHovered()) {
                this.darkenEl.classList.remove("is-visible");
            }
        });
    }

    _anyHovered() {
        return this.hotspots.some((h) => h.el.matches(":hover"));
    }

    render() {
        const imgEl = document.getElementById("vozes-image");
        const imgSrc = imgEl.getAttribute("src");
        const wrap = this.container.parentElement;
        const wrapRect = wrap.getBoundingClientRect();
        const wrapW = wrapRect.width;
        const wrapH = wrapRect.height;

        const expand = 1.25;
        const MIRAGE_OFFSET = 5;

        HOTSPOTS.forEach((h) => {
            const div = document.createElement("div");
            div.className = "hotspot";
            div.dataset.id = h.id;

            const newW = h.width * expand;
            const newH = h.height * expand;
            const dx = (h.width * (expand - 1)) / 2;
            const dy = (h.height * (expand - 1)) / 2;

            div.style.left = (h.left - dx) + "%";
            div.style.top = (h.top - dy) + "%";
            div.style.width = newW + "%";
            div.style.height = newH + "%";

            const offsetX = -((h.left - dx) / 100) * wrapW;
            const offsetY = -((h.top - dy) / 100) * wrapH;
            div.style.setProperty("--noise-x", offsetX + "px");
            div.style.setProperty("--noise-y", offsetY + "px");
            div.style.setProperty("--clone-w", wrapW + "px");

            const mirage = document.createElement("img");
            mirage.className = "hotspot-mirage";
            mirage.src = imgSrc;
            mirage.alt = "";
            mirage.draggable = false;
            mirage.style.left = (offsetX + MIRAGE_OFFSET) + "px";
            mirage.style.top = (offsetY + MIRAGE_OFFSET) + "px";
            mirage.style.width = wrapW + "px";
            div.appendChild(mirage);

            const clone = document.createElement("img");
            clone.className = "hotspot-clone";
            clone.src = imgSrc;
            clone.alt = "";
            clone.draggable = false;
            clone.style.left = offsetX + "px";
            clone.style.top = offsetY + "px";
            clone.style.width = wrapW + "px";
            div.appendChild(clone);

            this.container.appendChild(div);
            this.hotspots.push({ id: h.id, el: div });

            // Hover: ativa o hotspot visual + darken (igual ao click)
            div.addEventListener("mouseenter", () => {
                this.darkenEl.classList.add("is-visible");
                div.classList.add("is-hovered");
            });
            div.addEventListener("mouseleave", () => {
                // Se há áudio tocando, mantém o overlay ativo mesmo com o
                // mouse fora do hotspot — só some quando o áudio terminar
                // ou for pausado/fechado.
                if (this.activeId !== h.id && !this.player.isPlaying()) {
                    this.darkenEl.classList.remove("is-visible");
                }
                div.classList.remove("is-hovered");
            });

            // Click: ativa o player e inicia o áudio
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

    const videoFrame = document.getElementById("vozes-video-frame");
    if (videoFrame) new VideoPlayer(videoFrame);
});