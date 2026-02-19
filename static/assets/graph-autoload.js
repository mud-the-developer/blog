(() => {
  if (window.__BLOG_GRAPH_AUTOLOADER_ACTIVE) {
    return;
  }
  window.__BLOG_GRAPH_AUTOLOADER_ACTIVE = true;

  const runtimeConfig =
    window.__BLOG_RUNTIME_CONFIG__ && typeof window.__BLOG_RUNTIME_CONFIG__ === "object"
      ? window.__BLOG_RUNTIME_CONFIG__
      : {};
  const graphDataUrl =
    typeof runtimeConfig.graphDataUrl === "string" && runtimeConfig.graphDataUrl.length > 0
      ? runtimeConfig.graphDataUrl
      : "/graph.json";
  const graphCenterId =
    typeof runtimeConfig.graphCenterId === "string" ? runtimeConfig.graphCenterId : "";
  const graphScriptUrl = "/assets/graph-view.min.js";

  const loadScript = (src) => {
    const selector = `script[data-script-src="${src}"]`;
    if (document.querySelector(selector)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.defer = true;
      script.src = src;
      script.setAttribute("data-script-src", src);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  const createGraphStatus = ({ stageId, nodeLayerId, statusId, loadingText, delayedText }) => {
    const stage = document.getElementById(stageId || "");
    const nodeLayer = document.getElementById(nodeLayerId || "");
    const status = document.getElementById(statusId || "");

    if (!(stage instanceof Element && nodeLayer instanceof Element && status instanceof HTMLElement)) {
      return {
        markUnavailable: () => {}
      };
    }

    let settled = false;
    let delayedTimer = 0;
    let observer = null;

    const setStatus = (state, text) => {
      status.hidden = false;
      status.classList.toggle("is-loading", state === "loading");
      status.classList.toggle("is-delayed", state === "delayed");
      status.classList.toggle("is-error", state === "error");
      status.textContent = text;
    };

    const settle = () => {
      if (settled) {
        return;
      }
      settled = true;
      stage.classList.remove("is-loading");
      stage.removeAttribute("aria-busy");
      status.hidden = true;
      window.clearTimeout(delayedTimer);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    stage.classList.add("is-loading");
    stage.setAttribute("aria-busy", "true");
    setStatus("loading", loadingText || "Loading graph...");

    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(() => {
        if (nodeLayer.childElementCount > 0) {
          settle();
        }
      });
      observer.observe(nodeLayer, { childList: true });
    }

    delayedTimer = window.setTimeout(() => {
      if (settled || nodeLayer.childElementCount > 0) {
        settle();
        return;
      }
      setStatus("delayed", delayedText || "Still loading graph data...");
    }, 4200);

    return {
      markUnavailable: (message) => {
        if (settled) {
          return;
        }
        stage.classList.remove("is-loading");
        stage.removeAttribute("aria-busy");
        window.clearTimeout(delayedTimer);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        setStatus("error", message || "Graph preview is unavailable right now.");
      }
    };
  };

  const installInitGuard = () => {
    if (window.__BLOG_GRAPH_INIT_GUARD_INSTALLED || typeof window.initGraphView !== "function") {
      return;
    }

    const originalInit = window.initGraphView;
    window.initGraphView = (options) => {
      const stageId = options && typeof options.stageId === "string" ? options.stageId : "";
      const stage = document.getElementById(stageId);
      if (stage && stage.dataset.graphInitialized === "1") {
        return;
      }
      if (stage) {
        stage.dataset.graphInitialized = "1";
      }
      return originalInit(options);
    };

    window.__BLOG_GRAPH_INIT_GUARD_INSTALLED = true;
  };

  const tryInitGraphs = async () => {
    const globalStage = document.getElementById("global-graph-stage");
    const sideStage = document.getElementById("side-graph-stage");

    if (!(globalStage instanceof Element || sideStage instanceof Element)) {
      return;
    }

    const globalLayer = document.getElementById("global-graph-node-layer");
    const sideLayer = document.getElementById("side-graph-node-layer");

    if (
      (globalLayer instanceof Element && globalLayer.childElementCount > 0) ||
      (sideLayer instanceof Element && sideLayer.childElementCount > 0)
    ) {
      return;
    }

    const globalStatus = createGraphStatus({
      stageId: "global-graph-stage",
      nodeLayerId: "global-graph-node-layer",
      statusId: "global-graph-status",
      loadingText: "Loading graph map...",
      delayedText: "Still loading graph map..."
    });
    const sideStatus = createGraphStatus({
      stageId: "side-graph-stage",
      nodeLayerId: "side-graph-node-layer",
      statusId: "side-graph-status",
      loadingText: "Loading graph preview...",
      delayedText: "Still loading graph preview..."
    });

    try {
      await loadScript(graphScriptUrl);

      if (typeof window.initGraphView !== "function") {
        globalStatus.markUnavailable("Graph module failed to initialize.");
        sideStatus.markUnavailable("Graph module failed to initialize.");
        return;
      }

      installInitGuard();

      if (globalStage instanceof Element) {
        window.initGraphView({
          stageId: "global-graph-stage",
          svgId: "global-graph-svg",
          linkLayerId: "global-graph-link-layer",
          nodeLayerId: "global-graph-node-layer",
          detailId: "global-graph-detail",
          zoomInButtonId: "global-graph-zoom-in",
          zoomOutButtonId: "global-graph-zoom-out",
          searchInputId: "global-graph-search",
          resetButtonId: "global-graph-reset",
          toggleButtonId: "global-graph-toggle",
          dataUrl: "/graph.json",
          width: 1000,
          height: 640,
          idealDistance: 112,
          nodeRadius: 9,
          showLabels: true,
          labelFontSize: 12,
          freezeVelocity: 999999,
          freezeStableFrames: 1,
          emptyText: "No graph data yet."
        });
      }

      if (sideStage instanceof Element) {
        window.initGraphView({
          stageId: "side-graph-stage",
          svgId: "side-graph-svg",
          linkLayerId: "side-graph-link-layer",
          nodeLayerId: "side-graph-node-layer",
          detailId: "side-graph-detail",
          zoomInButtonId: "side-graph-zoom-in",
          zoomOutButtonId: "side-graph-zoom-out",
          resetButtonId: "side-graph-reset",
          dataUrl: graphDataUrl,
          fallbackDataUrl: "/graph.json",
          centerNodeId: graphCenterId,
          width: 540,
          height: 420,
          idealDistance: 88,
          nodeRadius: 7,
          showLabels: true,
          labelFontSize: 10,
          freezeVelocity: 999999,
          freezeStableFrames: 1,
          idleText: "Hover nodes to inspect relationships.",
          emptyText: "No graph data yet."
        });
      }
    } catch (_error) {
      globalStatus.markUnavailable("Graph panel is unavailable right now.");
      sideStatus.markUnavailable("Graph panel is unavailable right now.");
    }
  };

  let initQueued = false;
  const queueInit = () => {
    if (initQueued) {
      return;
    }
    initQueued = true;
    Promise.resolve()
      .then(() => tryInitGraphs())
      .finally(() => {
        initQueued = false;
      });
  };

  const start = () => {
    queueInit();
    window.setTimeout(queueInit, 1000);
    window.setTimeout(queueInit, 2600);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", () => {
    window.setTimeout(queueInit, 120);
  });
})();
