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

  const isRenderableElement = (element) => {
    if (!element || typeof element !== "object") {
      return false;
    }
    const type = String(element.type || "").toLowerCase();
    return ["rectangle", "ellipse", "diamond", "text", "line", "arrow", "freedraw"].includes(type);
  };

  const elementBounds = (element) => {
    const x = asNumber(element.x) ?? 0;
    const y = asNumber(element.y) ?? 0;
    const width = Math.max(4, Math.abs(asNumber(element.width) ?? 64));
    const height = Math.max(4, Math.abs(asNumber(element.height) ?? 42));
    return { x, y, width, height };
  };

  const toView = (pos, bounds, scale, padding) => ({
    x: (pos.x - bounds.minX) * scale + padding,
    y: (pos.y - bounds.minY) * scale + padding,
    width: Math.max(4, pos.width * scale),
    height: Math.max(4, pos.height * scale),
  });

  const buildPathPoints = (element, view, scale) => {
    const points = Array.isArray(element?.points) ? element.points : [];
    if (!points.length) {
      return "";
    }

    return points
      .slice(0, 96)
      .map((point) => {
        const px = asNumber(point?.[0]) ?? 0;
        const py = asNumber(point?.[1]) ?? 0;
        const x = view.x + px * scale;
        const y = view.y + py * scale;
        return x.toFixed(2) + "," + y.toFixed(2);
      })
      .join(" ");
  };

  const renderExcalidraw = (embed, payload) => {
    const placeholder = embed.querySelector(".dg-excalidraw-placeholder");
    const previewWrap = embed.querySelector(".dg-excalidraw-preview-wrap");
    if (!previewWrap) {
      return;
    }

    const elementsRaw = Array.isArray(payload?.elements) ? payload.elements : [];
    const elements = elementsRaw.filter(isRenderableElement).slice(0, 180);
    if (!elements.length) {
      if (placeholder) {
        placeholder.textContent = "No drawable elements in this Excalidraw file.";
      }
      return;
    }

    const boundsList = elements.map(elementBounds);
    const minX = Math.min(...boundsList.map((item) => item.x));
    const minY = Math.min(...boundsList.map((item) => item.y));
    const maxX = Math.max(...boundsList.map((item) => item.x + item.width));
    const maxY = Math.max(...boundsList.map((item) => item.y + item.height));

    const width = 560;
    const height = 280;
    const padding = 14;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const bounds = { minX, minY, maxX, maxY };

    const shapes = [];
    for (let i = 0; i < elements.length; i += 1) {
      const element = elements[i];
      const type = String(element.type || "").toLowerCase();
      const pos = elementBounds(element);
      const view = toView(pos, bounds, scale, padding);
      const stroke = escapeHtml(String(element.strokeColor || "#2f5f95"));
      const fill = escapeHtml(String(element.backgroundColor || "transparent"));

      if (type === "line" || type === "arrow" || type === "freedraw") {
        const points = buildPathPoints(element, view, scale);
        if (points) {
          shapes.push(
            '<polyline class="dg-excalidraw-stroke" points="' +
              points +
              '" stroke="' +
              stroke +
              '" fill="none" />'
          );
        }
        continue;
      }

      if (type === "ellipse") {
        shapes.push(
          '<ellipse class="dg-excalidraw-shape" cx="' +
            (view.x + view.width / 2).toFixed(2) +
            '" cy="' +
            (view.y + view.height / 2).toFixed(2) +
            '" rx="' +
            (view.width / 2).toFixed(2) +
            '" ry="' +
            (view.height / 2).toFixed(2) +
            '" stroke="' +
            stroke +
            '" fill="' +
            fill +
            '" />'
        );
        continue;
      }

      if (type === "diamond") {
        const cx = view.x + view.width / 2;
        const cy = view.y + view.height / 2;
        const points = [
          cx.toFixed(2) + "," + view.y.toFixed(2),
          (view.x + view.width).toFixed(2) + "," + cy.toFixed(2),
          cx.toFixed(2) + "," + (view.y + view.height).toFixed(2),
          view.x.toFixed(2) + "," + cy.toFixed(2),
        ].join(" ");
        shapes.push(
          '<polygon class="dg-excalidraw-shape" points="' +
            points +
            '" stroke="' +
            stroke +
            '" fill="' +
            fill +
            '" />'
        );
        continue;
      }

      if (type === "text") {
        const text = escapeHtml(String(element.text || "Text").replace(/\s+/g, " ").trim() || "Text");
        shapes.push(
          '<text class="dg-excalidraw-text" x="' +
            view.x.toFixed(2) +
            '" y="' +
            (view.y + 14).toFixed(2) +
            '" fill="' +
            stroke +
            '">' +
            text +
            "</text>"
        );
        continue;
      }

      shapes.push(
        '<rect class="dg-excalidraw-shape" x="' +
          view.x.toFixed(2) +
          '" y="' +
          view.y.toFixed(2) +
          '" width="' +
          view.width.toFixed(2) +
          '" height="' +
          view.height.toFixed(2) +
          '" rx="4" ry="4" stroke="' +
          stroke +
          '" fill="' +
          fill +
          '" />'
      );
    }

    const stats =
      '<p class="dg-excalidraw-stats">' +
      escapeHtml(String(elements.length)) +
      " elements</p>";
    const svg =
      '<svg class="dg-excalidraw-map" viewBox="0 0 560 280" role="img" aria-label="Excalidraw preview map">' +
      shapes.join("") +
      "</svg>";

    previewWrap.innerHTML = stats + svg;
    previewWrap.hidden = false;
    embed.classList.add("is-enhanced");
    if (placeholder) {
      placeholder.hidden = true;
    }
  };

  const renderError = (embed, message) => {
    const placeholder = embed.querySelector(".dg-excalidraw-placeholder");
    if (placeholder) {
      placeholder.textContent = message;
    }
  };

  const init = async () => {
    const embeds = Array.from(document.querySelectorAll(".dg-excalidraw-embed[data-excalidraw-src]"));
    if (!embeds.length) {
      return;
    }

    await Promise.all(
      embeds.map(async (embed) => {
        const src = embed.getAttribute("data-excalidraw-src") || "";
        if (!src) {
          renderError(embed, "Excalidraw source is missing.");
          return;
        }

        try {
          const response = await fetch(src, { cache: "no-store" });
          if (!response.ok) {
            throw new Error("failed to fetch excalidraw");
          }
          const payload = await response.json();
          renderExcalidraw(embed, payload);
        } catch (_) {
          renderError(embed, "Excalidraw preview is unavailable in this browser.");
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
