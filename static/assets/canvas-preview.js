(() => {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const asNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const nodePosition = (node) => {
    if (!node || typeof node !== "object") {
      return null;
    }

    const x =
      asNumber(node.x) ??
      asNumber(node.pos?.x) ??
      asNumber(node.position?.x) ??
      asNumber(node.coords?.x);
    const y =
      asNumber(node.y) ??
      asNumber(node.pos?.y) ??
      asNumber(node.position?.y) ??
      asNumber(node.coords?.y);
    const width =
      asNumber(node.width) ??
      asNumber(node.size?.width) ??
      asNumber(node.w) ??
      180;
    const height =
      asNumber(node.height) ??
      asNumber(node.size?.height) ??
      asNumber(node.h) ??
      92;

    if (x == null || y == null) {
      return null;
    }

    return { x, y, width, height };
  };

  const nodeLabel = (node) => {
    const label =
      node?.text ??
      node?.label ??
      node?.title ??
      node?.id ??
      "Node";
    return String(label).replace(/\s+/g, " ").trim() || "Node";
  };

  const edgeEndpoint = (edge, which) => {
    if (!edge || typeof edge !== "object") {
      return "";
    }
    if (which === "from") {
      return String(edge.fromNode || edge.from || edge.source || edge.fromId || "");
    }
    return String(edge.toNode || edge.to || edge.target || edge.toId || "");
  };

  const toView = (pos, bounds, scale, padding) => ({
    x: (pos.x - bounds.minX) * scale + padding,
    y: (pos.y - bounds.minY) * scale + padding,
    width: Math.max(42, pos.width * scale),
    height: Math.max(28, pos.height * scale),
  });

  const truncate = (text, max) => {
    if (text.length <= max) {
      return text;
    }
    return text.slice(0, max - 1) + "…";
  };

  const renderCanvas = (embed, payload) => {
    const placeholder = embed.querySelector(".note-canvas-placeholder");
    const preview = embed.querySelector(".note-canvas-preview");
    if (!preview) {
      return;
    }

    const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload?.edges) ? payload.edges : [];

    const validNodes = [];
    const byId = new Map();
    for (const node of nodes) {
      const id = String(node?.id || "");
      if (!id) {
        continue;
      }
      const pos = nodePosition(node);
      const label = nodeLabel(node);
      validNodes.push({ id, pos, label });
      byId.set(id, { pos, label });
    }

    const stats =
      '<p class="note-canvas-stats">' +
      escapeHtml(String(validNodes.length)) +
      " nodes · " +
      escapeHtml(String(edges.length)) +
      " edges</p>";

    let mapHtml = "";
    const positioned = validNodes.filter((node) => !!node.pos);
    if (positioned.length > 0) {
      const minX = Math.min(...positioned.map((item) => item.pos.x));
      const minY = Math.min(...positioned.map((item) => item.pos.y));
      const maxX = Math.max(...positioned.map((item) => item.pos.x + item.pos.width));
      const maxY = Math.max(...positioned.map((item) => item.pos.y + item.pos.height));
      const bounds = { minX, minY, maxX, maxY };
      const canvasWidth = 540;
      const canvasHeight = 260;
      const padding = 14;
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const scale = Math.min((canvasWidth - padding * 2) / spanX, (canvasHeight - padding * 2) / spanY);

      const links = [];
      for (const edge of edges) {
        const from = byId.get(edgeEndpoint(edge, "from"));
        const to = byId.get(edgeEndpoint(edge, "to"));
        if (!from?.pos || !to?.pos) {
          continue;
        }
        const a = toView(from.pos, bounds, scale, padding);
        const b = toView(to.pos, bounds, scale, padding);
        links.push(
          '<line x1="' +
            a.x.toFixed(2) +
            '" y1="' +
            a.y.toFixed(2) +
            '" x2="' +
            b.x.toFixed(2) +
            '" y2="' +
            b.y.toFixed(2) +
            '" />'
        );
      }

      const nodeShapes = [];
      for (const node of positioned.slice(0, 120)) {
        const p = toView(node.pos, bounds, scale, padding);
        const text = escapeHtml(truncate(node.label, 16));
        nodeShapes.push(
          '<g class="note-canvas-node">' +
            '<rect x="' +
            p.x.toFixed(2) +
            '" y="' +
            p.y.toFixed(2) +
            '" width="' +
            p.width.toFixed(2) +
            '" height="' +
            p.height.toFixed(2) +
            '" rx="6" ry="6" />' +
            '<text x="' +
            (p.x + 8).toFixed(2) +
            '" y="' +
            (p.y + 16).toFixed(2) +
            '">' +
            text +
            "</text>" +
            "</g>"
        );
      }

      mapHtml =
        '<svg class="note-canvas-map" viewBox="0 0 540 260" role="img" aria-label="Canvas preview map">' +
        '<g class="note-canvas-links">' +
        links.join("") +
        "</g>" +
        '<g class="note-canvas-nodes">' +
        nodeShapes.join("") +
        "</g>" +
        "</svg>";
    }

    const topNodes = validNodes
      .slice(0, 8)
      .map((node) => "<li>" + escapeHtml(node.label) + "</li>")
      .join("");
    const listHtml = topNodes
      ? '<ul class="note-canvas-node-list">' + topNodes + "</ul>"
      : '<p class="note-canvas-empty">No nodes found.</p>';

    preview.innerHTML = stats + mapHtml + listHtml;
    preview.hidden = false;
    if (placeholder) {
      placeholder.hidden = true;
    }
  };

  const renderError = (embed, message) => {
    const placeholder = embed.querySelector(".note-canvas-placeholder");
    if (placeholder) {
      placeholder.textContent = message;
    }
  };

  const init = async () => {
    const embeds = Array.from(document.querySelectorAll(".note-canvas-embed[data-canvas-src]"));
    if (!embeds.length) {
      return;
    }

    await Promise.all(
      embeds.map(async (embed) => {
        const src = embed.getAttribute("data-canvas-src") || "";
        if (!src) {
          renderError(embed, "Canvas source is missing.");
          return;
        }

        try {
          const response = await fetch(src, { cache: "no-store" });
          if (!response.ok) {
            throw new Error("failed to fetch canvas");
          }
          const payload = await response.json();
          renderCanvas(embed, payload);
        } catch (_) {
          renderError(embed, "Canvas preview is unavailable in this browser.");
        }
      })
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        init();
      },
      { once: true }
    );
  } else {
    init();
  }
})();
