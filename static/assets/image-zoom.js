(() => {
  const MODAL_ID = "note-image-zoom-modal";

  const createModal = () => {
    let modal = document.getElementById(MODAL_ID);
    if (modal instanceof HTMLElement) {
      return modal;
    }

    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "note-image-zoom-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Image zoom view");
    modal.innerHTML = `
      <div class="note-image-zoom-surface">
        <button class="note-image-zoom-close" type="button" aria-label="Close image zoom">✕</button>
        <img class="note-image-zoom-media" alt="" />
        <p class="note-image-zoom-caption" hidden></p>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  const isStandaloneImageLink = (img) => {
    if (!(img instanceof HTMLImageElement)) {
      return null;
    }
    const anchor = img.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) {
      return null;
    }
    if (!anchor.contains(img)) {
      return null;
    }
    if (anchor.childNodes.length !== 1 || anchor.firstElementChild !== img) {
      return null;
    }
    return anchor;
  };

  const wrapZoomTarget = (img) => {
    if (!(img instanceof HTMLImageElement) || !img.parentNode) {
      return null;
    }
    if (img.closest(".note-image-zoom-wrap")) {
      return null;
    }

    const link = isStandaloneImageLink(img);
    const target = link || img;
    const parent = target.parentNode;
    if (!parent) {
      return null;
    }

    const wrap = document.createElement("span");
    wrap.className = "note-image-zoom-wrap";
    parent.insertBefore(wrap, target);
    wrap.appendChild(target);
    return wrap;
  };

  const installZoomButton = (img, onOpen) => {
    const wrap = wrapZoomTarget(img);
    if (!(wrap instanceof HTMLElement)) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-image-zoom-button";
    button.setAttribute(
      "aria-label",
      img.alt && img.alt.trim().length > 0
        ? `Enlarge image: ${img.alt.trim()}`
        : "Enlarge image",
    );
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="6.5"></circle>
        <path d="M20 20l-4.2-4.2"></path>
        <path d="M11 8.5v5"></path>
        <path d="M8.5 11h5"></path>
      </svg>
    `;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onOpen(img);
    });
    wrap.appendChild(button);
  };

  const initImageZoom = () => {
    const noteBody = document.querySelector(".note-body");
    if (!(noteBody instanceof HTMLElement)) {
      return;
    }

    const modal = createModal();
    const surface = modal.querySelector(".note-image-zoom-surface");
    const closeButton = modal.querySelector(".note-image-zoom-close");
    const media = modal.querySelector(".note-image-zoom-media");
    const caption = modal.querySelector(".note-image-zoom-caption");
    if (
      !(surface instanceof HTMLElement) ||
      !(closeButton instanceof HTMLButtonElement) ||
      !(media instanceof HTMLImageElement) ||
      !(caption instanceof HTMLElement)
    ) {
      return;
    }

    let previousFocus = null;

    const closeModal = () => {
      if (modal.hidden) {
        return;
      }
      modal.hidden = true;
      media.removeAttribute("src");
      media.alt = "";
      caption.hidden = true;
      caption.textContent = "";
      document.body.classList.remove("note-image-zoom-open");
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus({ preventScroll: true });
      }
      previousFocus = null;
    };

    const openModal = (img) => {
      const source = img.currentSrc || img.src;
      if (!source) {
        return;
      }
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      media.src = source;
      media.alt = img.alt || "";
      const label = (img.getAttribute("title") || img.alt || "").trim();
      if (label.length > 0) {
        caption.textContent = label;
        caption.hidden = false;
      } else {
        caption.textContent = "";
        caption.hidden = true;
      }
      modal.hidden = false;
      document.body.classList.add("note-image-zoom-open");
      closeButton.focus({ preventScroll: true });
    };

    closeButton.addEventListener("click", () => {
      closeModal();
    });

    modal.addEventListener("click", (event) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (event.target === modal || !surface.contains(event.target)) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    });

    const images = noteBody.querySelectorAll("img");
    images.forEach((img) => {
      if (!(img instanceof HTMLImageElement)) {
        return;
      }
      if (img.closest(".note-image-zoom-wrap")) {
        return;
      }
      if (img.closest(".link-preview-card")) {
        return;
      }
      installZoomButton(img, openModal);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImageZoom, { once: true });
  } else {
    initImageZoom();
  }
})();
