(function () {
  function initGraphView(options) {
    const opts = options || {};
    const stage = document.getElementById(opts.stageId || "");
    const svg = document.getElementById(opts.svgId || "");
    const linkLayer = document.getElementById(opts.linkLayerId || "");
    const nodeLayer = document.getElementById(opts.nodeLayerId || "");

    if (!stage || !svg || !linkLayer || !nodeLayer) {
      return;
    }

    const detail = document.getElementById(opts.detailId || "");
    const searchInput = document.getElementById(opts.searchInputId || "");
    const resetButton = document.getElementById(opts.resetButtonId || "");
    const toggleButton = document.getElementById(opts.toggleButtonId || "");
    const zoomSlider = document.getElementById(opts.zoomSliderId || "");

    const width = opts.width || 1000;
    const height = opts.height || 640;
    const centerX = width / 2;
    const centerY = height / 2;
    const dataUrl = opts.dataUrl || "/graph.json";
    const fallbackDataUrl = opts.fallbackDataUrl || "";
    const preferredCenterNodeId = typeof opts.centerNodeId === "string" ? opts.centerNodeId : "";
    const idealDistance = opts.idealDistance || 120;
    const nodeRadius = opts.nodeRadius || 9;
    const showLabels = opts.showLabels !== false;
    const labelOffsetX = opts.labelOffsetX || nodeRadius + 6;
    const labelOffsetY = opts.labelOffsetY || 4;
    const labelFontSize = opts.labelFontSize || 12;
    const labelMaxChars = opts.labelMaxChars || 28;
    const minZoom = opts.minZoom || 0.45;
    const maxZoom = opts.maxZoom || 3.1;
    const zoomStep = opts.zoomStep || 0.0017;
    const autoFreeze = opts.autoFreeze !== false;
    const freezeVelocity = opts.freezeVelocity || 0.095;
    const freezeStableFrames = opts.freezeStableFrames || 55;
    const idleText =
      typeof opts.idleText === "string" ? opts.idleText : "Hover nodes to inspect relationships.";
    const emptyText =
      typeof opts.emptyText === "string" ? opts.emptyText : "No graph data available yet.";
    const errorText =
      typeof opts.errorText === "string" ? opts.errorText : "Failed to load graph data.";

    if (!showLabels) {
      stage.classList.add("graph-no-labels");
    }

    const ns = "http://www.w3.org/2000/svg";
    const createSvgEl = (name) => document.createElementNS(ns, name);

    const graphState = {
      nodes: [],
      links: [],
      nodesById: new Map(),
      running: true,
      manuallyPaused: false,
      stableFrames: 0,
      dragging: "",
      dragPointerId: -1,
      dragMoved: false,
      dragStartClientX: 0,
      dragStartClientY: 0,
      activeNodeId: "",
      defaultActiveNodeId: "",
      searchTerm: "",
      viewport: {
        scale: 1,
        tx: 0,
        ty: 0,
        panning: false,
        panPointerId: -1,
        panStartX: 0,
        panStartY: 0,
        panOriginTx: 0,
        panOriginTy: 0
      }
    };

    let rafId = 0;

    const pointInSvg = (event) => {
      const rect = svg.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height
      };
    };

    const toGraphPoint = (point) => {
      const view = graphState.viewport;
      return {
        x: (point.x - view.tx) / view.scale,
        y: (point.y - view.ty) / view.scale
      };
    };

    const clampScale = (value) => Math.min(maxZoom, Math.max(minZoom, value));

    const syncZoomSlider = () => {
      if (!(zoomSlider instanceof HTMLInputElement)) {
        return;
      }
      zoomSlider.value = graphState.viewport.scale.toFixed(4);
    };

    const applyViewportTransform = () => {
      const view = graphState.viewport;
      const transform =
        "translate(" + view.tx.toFixed(2) + "," + view.ty.toFixed(2) + ") scale(" + view.scale.toFixed(4) + ")";
      linkLayer.setAttribute("transform", transform);
      nodeLayer.setAttribute("transform", transform);
      syncZoomSlider();
    };

    const resetViewport = () => {
      graphState.viewport.scale = 1;
      graphState.viewport.tx = 0;
      graphState.viewport.ty = 0;
      applyViewportTransform();
    };

    const focusNode = (node, preferredScale) => {
      if (!node) {
        return;
      }

      const nextScale =
        typeof preferredScale === "number"
          ? clampScale(preferredScale)
          : graphState.viewport.scale;

      graphState.viewport.scale = nextScale;
      graphState.viewport.tx = centerX - node.x * nextScale;
      graphState.viewport.ty = centerY - node.y * nextScale;
      applyViewportTransform();
      wakeSimulation();
    };

    const setScaleAroundPoint = (nextScale, anchorPoint) => {
      const safeScale = clampScale(nextScale);
      const view = graphState.viewport;
      const anchor = anchorPoint || { x: centerX, y: centerY };
      const originX = (anchor.x - view.tx) / view.scale;
      const originY = (anchor.y - view.ty) / view.scale;
      view.scale = safeScale;
      view.tx = anchor.x - originX * safeScale;
      view.ty = anchor.y - originY * safeScale;
      applyViewportTransform();
      wakeSimulation();
    };

    const resetLayout = () => {
      const count = Math.max(graphState.nodes.length, 1);
      const radius = Math.min(width, height) * 0.34;
      graphState.nodes.forEach((node, index) => {
        const angle = (Math.PI * 2 * index) / count;
        node.x = centerX + Math.cos(angle) * radius;
        node.y = centerY + Math.sin(angle) * radius;
        node.vx = 0;
        node.vy = 0;
      });
    };

    const renderScene = () => {
      graphState.links.forEach((link) => {
        const source = graphState.nodesById.get(link.source);
        const target = graphState.nodesById.get(link.target);
        if (!source || !target) {
          return;
        }

        link.el.setAttribute("x1", String(source.x));
        link.el.setAttribute("y1", String(source.y));
        link.el.setAttribute("x2", String(target.x));
        link.el.setAttribute("y2", String(target.y));
      });

      graphState.nodes.forEach((node) => {
        node.el.setAttribute("transform", "translate(" + node.x + "," + node.y + ")");
      });
    };

    const scheduleTick = () => {
      if (rafId !== 0 || !graphState.running) {
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    const stopTicking = () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const wakeSimulation = () => {
      graphState.stableFrames = 0;
      if (graphState.manuallyPaused) {
        return;
      }
      graphState.running = true;
      scheduleTick();
    };

    const updateDetail = (node) => {
      if (!detail) {
        return;
      }

      if (!node) {
        detail.textContent = idleText;
        return;
      }

      const outgoing = graphState.links.filter((link) => link.source === node.id).length;
      const incoming = graphState.links.filter((link) => link.target === node.id).length;
      detail.innerHTML =
        "<strong>" +
        node.title +
        "</strong> (" +
        node.id +
        ") • " +
        incoming +
        " incoming • " +
        outgoing +
        " outgoing";
    };

    const applyVisualState = () => {
      const active = graphState.activeNodeId;
      const query = graphState.searchTerm;
      const adjacency = new Map();
      graphState.nodes.forEach((node) => adjacency.set(node.id, new Set([node.id])));

      graphState.links.forEach((link) => {
        if (adjacency.has(link.source)) {
          adjacency.get(link.source).add(link.target);
        }
        if (adjacency.has(link.target)) {
          adjacency.get(link.target).add(link.source);
        }
      });

      graphState.nodes.forEach((node) => {
        const matchesSearch =
          query.length === 0 ||
          node.title.toLowerCase().includes(query) ||
          node.id.toLowerCase().includes(query);
        const inFocus = active.length === 0 || (adjacency.get(active) && adjacency.get(active).has(node.id));
        const isActive = active.length > 0 && node.id === active;

        node.el.classList.toggle("is-active", isActive);
        node.el.classList.toggle("is-dim", !matchesSearch || !inFocus);
      });

      graphState.links.forEach((link) => {
        const hasActive = active.length > 0 && (link.source === active || link.target === active);
        const sourceNode = graphState.nodesById.get(link.source);
        const targetNode = graphState.nodesById.get(link.target);
        const visibleBySearch =
          sourceNode &&
          targetNode &&
          !sourceNode.el.classList.contains("is-dim") &&
          !targetNode.el.classList.contains("is-dim");

        link.el.classList.toggle("is-active", hasActive);
        link.el.classList.toggle("is-dim", !visibleBySearch || (active.length > 0 && !hasActive));
      });
    };

    const tick = () => {
      rafId = 0;
      if (!graphState.running) {
        return;
      }

      const repulsion = 1900;
      const spring = 0.018;
      const damping = 0.86;
      const centerPull = 0.003;
      let totalVelocity = 0;

      for (let i = 0; i < graphState.nodes.length; i += 1) {
        const a = graphState.nodes[i];
        for (let j = i + 1; j < graphState.nodes.length; j += 1) {
          const b = graphState.nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy;

          if (dist2 < 25) {
            dist2 = 25;
          }

          const force = repulsion / dist2;
          const dist = Math.sqrt(dist2);
          dx /= dist;
          dy /= dist;

          a.vx += dx * force;
          a.vy += dy * force;
          b.vx -= dx * force;
          b.vy -= dy * force;
        }
      }

      graphState.links.forEach((link) => {
        const source = graphState.nodesById.get(link.source);
        const target = graphState.nodesById.get(link.target);
        if (!source || !target) {
          return;
        }

        let dx = target.x - source.x;
        let dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = (dist - idealDistance) * spring;
        dx /= dist;
        dy /= dist;

        source.vx += dx * pull;
        source.vy += dy * pull;
        target.vx -= dx * pull;
        target.vy -= dy * pull;
      });

      graphState.nodes.forEach((node) => {
        if (graphState.dragging === node.id) {
          node.vx = 0;
          node.vy = 0;
          return;
        }

        node.vx += (centerX - node.x) * centerPull;
        node.vy += (centerY - node.y) * centerPull;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
        totalVelocity += Math.abs(node.vx) + Math.abs(node.vy);
      });

      renderScene();

      const avgVelocity =
        graphState.nodes.length > 0 ? totalVelocity / graphState.nodes.length : 0;

      if (autoFreeze && !graphState.dragging && !graphState.viewport.panning) {
        if (avgVelocity < freezeVelocity) {
          graphState.stableFrames += 1;
        } else {
          graphState.stableFrames = 0;
        }

        if (graphState.stableFrames >= freezeStableFrames) {
          graphState.running = false;
          if (toggleButton && !graphState.manuallyPaused) {
            toggleButton.textContent = "Resume";
          }
          return;
        }
      }

      scheduleTick();
    };

    const finishPointerAction = (event) => {
      const pointerId = typeof event.pointerId === "number" ? event.pointerId : -1;
      const wasDraggingNodeId = graphState.dragging;
      const isDragPointer = graphState.dragPointerId === pointerId || pointerId < 0;
      const shouldNavigate =
        event &&
        event.type === "pointerup" &&
        isDragPointer &&
        wasDraggingNodeId &&
        !graphState.dragMoved;

      if (isDragPointer) {
        graphState.dragging = "";
        graphState.dragPointerId = -1;
        svg.classList.remove("is-dragging");
      }

      if (graphState.viewport.panPointerId === pointerId || pointerId < 0) {
        graphState.viewport.panning = false;
        graphState.viewport.panPointerId = -1;
        svg.classList.remove("is-panning");
      }

      if (pointerId >= 0 && typeof svg.hasPointerCapture === "function" && svg.hasPointerCapture(pointerId)) {
        svg.releasePointerCapture(pointerId);
      }

      if (shouldNavigate) {
        const node = graphState.nodesById.get(wasDraggingNodeId);
        if (node && typeof node.url === "string" && node.url.length > 0) {
          window.location.assign(node.url);
          return;
        }
      }

      wakeSimulation();
    };

    const attachInteractionEvents = () => {
      svg.addEventListener("pointermove", (event) => {
        if (graphState.dragging) {
          if (graphState.dragPointerId !== event.pointerId) {
            return;
          }

          const node = graphState.nodesById.get(graphState.dragging);
          if (!node) {
            return;
          }

          const point = toGraphPoint(pointInSvg(event));
          const movedDistance = Math.hypot(
            event.clientX - graphState.dragStartClientX,
            event.clientY - graphState.dragStartClientY
          );
          if (movedDistance > 4) {
            graphState.dragMoved = true;
          }
          node.x = point.x;
          node.y = point.y;
          renderScene();
          return;
        }

        if (!graphState.viewport.panning || graphState.viewport.panPointerId !== event.pointerId) {
          return;
        }

        const point = pointInSvg(event);
        graphState.viewport.tx = graphState.viewport.panOriginTx + (point.x - graphState.viewport.panStartX);
        graphState.viewport.ty = graphState.viewport.panOriginTy + (point.y - graphState.viewport.panStartY);
        applyViewportTransform();
        wakeSimulation();
      });

      svg.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest(".graph-node")) {
          return;
        }

        const point = pointInSvg(event);
        graphState.viewport.panning = true;
        graphState.viewport.panPointerId = event.pointerId;
        graphState.viewport.panStartX = point.x;
        graphState.viewport.panStartY = point.y;
        graphState.viewport.panOriginTx = graphState.viewport.tx;
        graphState.viewport.panOriginTy = graphState.viewport.ty;
        svg.classList.add("is-panning");
        wakeSimulation();
        if (typeof svg.setPointerCapture === "function") {
          svg.setPointerCapture(event.pointerId);
        }
      });

      svg.addEventListener("pointerup", finishPointerAction);
      svg.addEventListener("pointercancel", finishPointerAction);
      svg.addEventListener("pointerleave", (event) => {
        if (!graphState.viewport.panning && !graphState.dragging) {
          return;
        }
        finishPointerAction(event);
      });

      svg.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();

          const view = graphState.viewport;
          const pointer = pointInSvg(event);
          const factor = Math.exp(-event.deltaY * zoomStep);
          const nextScale = clampScale(view.scale * factor);

          if (Math.abs(nextScale - view.scale) < 0.0001) {
            return;
          }

          setScaleAroundPoint(nextScale, pointer);
        },
        { passive: false }
      );
    };

    const fetchGraphPayload = (url) =>
      fetch(url).then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load graph JSON");
        }
        return response.json();
      });

    let payloadPromise = fetchGraphPayload(dataUrl);
    if (fallbackDataUrl && fallbackDataUrl !== dataUrl) {
      payloadPromise = payloadPromise.catch(() => fetchGraphPayload(fallbackDataUrl));
    }

    payloadPromise
      .then((payload) => {
        const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        const links = Array.isArray(payload.links) ? payload.links : [];

        if (nodes.length === 0) {
          if (detail) {
            detail.textContent = emptyText;
          }
          return;
        }

        graphState.nodes = nodes.map((node) => ({
          id: node.id,
          title: node.title,
          url: node.url,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          el: null
        }));
        graphState.links = links.map((link) => ({
          source: link.source,
          target: link.target,
          el: null
        }));
        graphState.nodesById = new Map(graphState.nodes.map((node) => [node.id, node]));

        const payloadCenterNodeId = typeof payload.center === "string" ? payload.center : "";
        const defaultCenterNodeId = payloadCenterNodeId || preferredCenterNodeId;
        if (defaultCenterNodeId && graphState.nodesById.has(defaultCenterNodeId)) {
          graphState.defaultActiveNodeId = defaultCenterNodeId;
          graphState.activeNodeId = defaultCenterNodeId;
        }

        resetLayout();
        resetViewport();

        if (graphState.defaultActiveNodeId) {
          const centerNode = graphState.nodesById.get(graphState.defaultActiveNodeId);
          focusNode(centerNode, 1.12);
        }

        graphState.links.forEach((link) => {
          const line = createSvgEl("line");
          line.classList.add("graph-link");
          line.setAttribute("stroke-linecap", "round");
          linkLayer.appendChild(line);
          link.el = line;
        });

        graphState.nodes.forEach((node) => {
          const group = createSvgEl("g");
          group.classList.add("graph-node");

          const circle = createSvgEl("circle");
          circle.setAttribute("r", String(nodeRadius));
          group.appendChild(circle);

          if (showLabels) {
            const label = createSvgEl("text");
            label.setAttribute("x", String(labelOffsetX));
            label.setAttribute("y", String(labelOffsetY));
            label.style.fontSize = String(labelFontSize) + "px";
            label.textContent =
              node.title.length > labelMaxChars ? node.title.slice(0, labelMaxChars - 1) + "…" : node.title;
            group.appendChild(label);
          }

          group.addEventListener("mouseenter", () => {
            graphState.activeNodeId = node.id;
            updateDetail(node);
            applyVisualState();
          });

          group.addEventListener("mouseleave", () => {
            graphState.activeNodeId = graphState.defaultActiveNodeId;
            const defaultNode = graphState.nodesById.get(graphState.defaultActiveNodeId);
            updateDetail(defaultNode || null);
            applyVisualState();
          });

          group.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
            graphState.dragging = node.id;
            graphState.dragPointerId = event.pointerId;
            graphState.dragMoved = false;
            graphState.dragStartClientX = event.clientX;
            graphState.dragStartClientY = event.clientY;
            svg.classList.add("is-dragging");
            wakeSimulation();
            if (typeof svg.setPointerCapture === "function") {
              svg.setPointerCapture(event.pointerId);
            }
          });

          nodeLayer.appendChild(group);
          node.el = group;
        });

        attachInteractionEvents();
        const initialNode = graphState.nodesById.get(graphState.defaultActiveNodeId);
        updateDetail(initialNode || null);

        if (searchInput) {
          searchInput.addEventListener("input", () => {
            graphState.searchTerm = searchInput.value.trim().toLowerCase();
            applyVisualState();
          });

          searchInput.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
              return;
            }

            const query = searchInput.value.trim().toLowerCase();
            if (!query) {
              graphState.activeNodeId = graphState.defaultActiveNodeId;
              const defaultNode = graphState.nodesById.get(graphState.defaultActiveNodeId);
              updateDetail(defaultNode || null);
              applyVisualState();
              return;
            }

            const match = graphState.nodes.find(
              (node) =>
                node.title.toLowerCase().includes(query) || node.id.toLowerCase().includes(query)
            );
            if (!match) {
              return;
            }

            graphState.activeNodeId = match.id;
            updateDetail(match);
            applyVisualState();
            focusNode(match, Math.max(graphState.viewport.scale, 1.14));
          });
        }

        if (resetButton) {
          resetButton.addEventListener("click", () => {
            resetLayout();
            resetViewport();
            wakeSimulation();
            applyVisualState();
          });
        }

        if (zoomSlider instanceof HTMLInputElement) {
          zoomSlider.min = String(minZoom);
          zoomSlider.max = String(maxZoom);
          zoomSlider.step = "0.01";
          syncZoomSlider();
          zoomSlider.addEventListener("input", () => {
            const nextScale = Number.parseFloat(zoomSlider.value);
            if (!Number.isFinite(nextScale)) {
              return;
            }
            setScaleAroundPoint(nextScale, { x: centerX, y: centerY });
          });
        }

        if (toggleButton) {
          toggleButton.addEventListener("click", () => {
            if (graphState.manuallyPaused) {
              graphState.manuallyPaused = false;
              graphState.running = true;
              graphState.stableFrames = 0;
              toggleButton.textContent = "Pause";
              scheduleTick();
              return;
            }

            if (!graphState.running) {
              graphState.running = true;
              graphState.stableFrames = 0;
              toggleButton.textContent = "Pause";
              scheduleTick();
              return;
            }

            graphState.manuallyPaused = true;
            if (graphState.manuallyPaused) {
              graphState.running = false;
              stopTicking();
              toggleButton.textContent = "Resume";
            }
          });
        }

        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            stopTicking();
            return;
          }
          wakeSimulation();
        });

        applyVisualState();
        renderScene();
        scheduleTick();
      })
      .catch(() => {
        if (detail) {
          detail.textContent = errorText;
        }
      });
  }

  window.initGraphView = initGraphView;
})();
