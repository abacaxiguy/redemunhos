/**
 * font-size.js - Controle de tamanho da fonte nas páginas de leitura
 * Dois botões discretos (A− / A+), quadrados e separados, fixos no canto
 * da tela. O passo escolhido vira o fator --fs no <html> (o style.css
 * multiplica os tamanhos de texto por ele) e fica salvo no localStorage,
 * valendo para todas as páginas.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "redemunhos:fonte";

    // Fatores aplicados sobre o tamanho original de cada trecho de texto.
    const STEPS = [0.9, 1, 1.15, 1.3, 1.5, 1.75];
    const DEFAULT_STEP = 1;

    // Blocos de texto usados para não perder o ponto de leitura ao trocar
    // o tamanho (ver captureAnchor).
    const READING_BLOCKS = ".blog-post > *, .definition > *";

    const root = document.documentElement;

    function loadStep() {
        try {
            const saved = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
            if (saved >= 0 && saved < STEPS.length) return saved;
        } catch (err) {
            // localStorage indisponível (modo privado etc.): segue com o padrão.
        }
        return DEFAULT_STEP;
    }

    function saveStep(step) {
        try {
            localStorage.setItem(STORAGE_KEY, String(step));
        } catch (err) {
            // Sem persistência, mas o tamanho continua valendo nesta página.
        }
    }

    function applyStep(step) {
        root.style.setProperty("--fs", STEPS[step]);
        // Classes só quando aumenta: com a coluna estreita e o texto
        // justificado, fonte grande abre buracos enormes entre as palavras
        // (o CSS hifeniza em fs-scaled e, em celular, alinha à esquerda em
        // fs-large).
        root.classList.toggle("fs-scaled", STEPS[step] > 1);
        root.classList.toggle("fs-large", STEPS[step] >= 1.5);
    }

    // Aplica já no <head>, antes da primeira pintura, para a página não
    // abrir no tamanho padrão e "pular" para o salvo.
    let step = loadStep();
    applyStep(step);

    // ------------------------------------------------------------
    // Âncora de leitura
    // Trocar a fonte reflui o texto inteiro e o que se estava lendo sai
    // da tela. Guardamos qual bloco estava na "linha de leitura" (e em que
    // fração dele) e, depois da troca, rolamos de volta até ali.
    // ------------------------------------------------------------
    function readingLine() {
        return window.innerHeight * 0.25;
    }

    function captureAnchor() {
        // No topo da página não há o que preservar — e ancorar faria a
        // tela descer sozinha até o primeiro parágrafo.
        if (window.scrollY <= 0) return null;

        const line = readingLine();
        for (const el of document.querySelectorAll(READING_BLOCKS)) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom <= line) continue;
            // Linha caiu no espaço entre blocos: o espaço não escala com a
            // fonte, então guardamos em px; dentro do bloco, em fração.
            return rect.top >= line ? { el, gap: rect.top - line } : { el, ratio: (line - rect.top) / rect.height };
        }
        return null;
    }

    function restoreAnchor(anchor) {
        const line = readingLine();
        const rect = anchor.el.getBoundingClientRect();
        const wantedTop = anchor.ratio === undefined ? line + anchor.gap : line - anchor.ratio * rect.height;
        window.scrollBy(0, rect.top - wantedTop);
    }

    // ------------------------------------------------------------
    // Interface
    // ------------------------------------------------------------
    function buildControl() {
        const control = document.createElement("div");
        control.className = "font-size-control";
        control.setAttribute("role", "group");
        control.setAttribute("aria-label", "tamanho do texto");
        control.innerHTML =
            '<button type="button" class="font-size-btn font-size-btn--down" aria-label="diminuir fonte" title="diminuir fonte">' +
            '<span aria-hidden="true">A<span class="font-size-sign">\u2212</span></span></button>' +
            '<button type="button" class="font-size-btn font-size-btn--up" aria-label="aumentar fonte" title="aumentar fonte">' +
            '<span aria-hidden="true">A<span class="font-size-sign">+</span></span></button>' +
            '<span class="font-size-status" role="status" aria-live="polite"></span>';

        const down = control.querySelector(".font-size-btn--down");
        const up = control.querySelector(".font-size-btn--up");
        const status = control.querySelector(".font-size-status");

        // aria-disabled (e não "disabled") para o botão não perder o foco
        // do teclado ao chegar no limite.
        function refresh(announce) {
            down.setAttribute("aria-disabled", String(step === 0));
            up.setAttribute("aria-disabled", String(step === STEPS.length - 1));
            if (!announce) return;
            const edge = step === 0 ? " (mínimo)" : step === STEPS.length - 1 ? " (máximo)" : "";
            status.textContent = "tamanho do texto: " + Math.round(STEPS[step] * 100) + "%" + edge;
        }

        function change(delta) {
            const next = Math.min(STEPS.length - 1, Math.max(0, step + delta));
            if (next === step) return;

            const anchor = captureAnchor();
            step = next;
            applyStep(step);
            saveStep(step);
            if (anchor) restoreAnchor(anchor);
            refresh(true);
        }

        down.addEventListener("click", () => change(-1));
        up.addEventListener("click", () => change(1));

        refresh(false);
        document.body.appendChild(control);
    }

    document.addEventListener("DOMContentLoaded", () => {
        // Só nas páginas com texto corrido; nas demais o script não faz nada.
        if (document.querySelector(READING_BLOCKS)) buildControl();
    });
})();
