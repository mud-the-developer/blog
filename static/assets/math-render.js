(() => {
  const MATHJAX_JS = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js";
  const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css";
  const KATEX_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js";
  const KATEX_AUTORENDER_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js";

  const hasLikelyMathSyntax = (text) => {
    if (!text) {
      return false;
    }
    return text.includes("$") || text.includes("\\(") || text.includes("\\[");
  };

  const ensureStylesheet = (href) => {
    if (document.querySelector('link[data-dg-katex="1"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-dg-katex", "1");
    document.head.appendChild(link);
  };

  const ensureScript = (src, marker) => {
    if (document.querySelector('script[data-dg-katex-script="' + marker + '"]')) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute("data-dg-katex-script", marker);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("failed to load " + marker));
      document.head.appendChild(script);
    });
  };

  const ensureMathJax = async () => {
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      return true;
    }

    if (!window.MathJax || typeof window.MathJax !== "object") {
      window.MathJax = {
        tex: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
          displayMath: [
            ["$$", "$$"],
            ["\\[", "\\]"],
          ],
          processEscapes: true,
          packages: { "[+]": ["noerrors", "noundefined"] },
        },
        options: {
          skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
          ignoreHtmlClass: "no-math",
        },
        startup: {
          typeset: false,
        },
      };
    }

    await ensureScript(MATHJAX_JS, "mathjax");
    const startup = window.MathJax && window.MathJax.startup;
    if (startup && startup.promise && typeof startup.promise.then === "function") {
      await startup.promise;
    }

    return !!(window.MathJax && typeof window.MathJax.typesetPromise === "function");
  };

  const renderWithMathJax = async (container) => {
    const ready = await ensureMathJax();
    if (!ready) {
      return false;
    }

    if (typeof window.MathJax.typesetClear === "function") {
      window.MathJax.typesetClear([container]);
    }
    await window.MathJax.typesetPromise([container]);
    return true;
  };

  const renderWithKatex = async (container) => {
    if (typeof window.renderMathInElement !== "function") {
      ensureStylesheet(KATEX_CSS);
      await ensureScript(KATEX_JS, "core");
      await ensureScript(KATEX_AUTORENDER_JS, "auto-render");
    }

    if (typeof window.renderMathInElement !== "function") {
      return;
    }

    window.renderMathInElement(container, {
      throwOnError: false,
      strict: "ignore",
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      ignoredClasses: ["no-math"],
    });
  };

  const run = async () => {
    const container = document.querySelector(".note-body");
    if (!container) {
      return;
    }

    if (!hasLikelyMathSyntax(container.textContent || "")) {
      return;
    }

    const preferredEngine = (
      document.documentElement.getAttribute("data-math-engine") ||
      window.DG_MATH_ENGINE ||
      "mathjax"
    )
      .toString()
      .toLowerCase();

    try {
      if (preferredEngine !== "katex") {
        const rendered = await renderWithMathJax(container);
        if (rendered) {
          return;
        }
      }
      await renderWithKatex(container);
    } catch (_) {
      try {
        await renderWithKatex(container);
      } catch (_) {
        // Keep raw math syntax as plain text when renderer scripts cannot be loaded.
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        run();
      },
      { once: true }
    );
  } else {
    run();
  }
})();
