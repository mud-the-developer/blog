(() => {
  const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css";
  const KATEX_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js";
  const KATEX_AUTORENDER_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js";

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

  const run = async () => {
    const container = document.querySelector(".note-body");
    if (!container) {
      return;
    }

    if (!(container.textContent || "").includes("$")) {
      return;
    }

    try {
      ensureStylesheet(KATEX_CSS);
      await ensureScript(KATEX_JS, "core");
      await ensureScript(KATEX_AUTORENDER_JS, "auto-render");

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
    } catch (_) {
      // Keep raw math syntax as plain text when KaTeX cannot be loaded.
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
