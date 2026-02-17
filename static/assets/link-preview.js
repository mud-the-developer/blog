(function () {
  function initLinkPreview(options) {
    const opts = options || {};
    const containerSelector = opts.containerSelector || ".note-body";
    const containers = Array.from(document.querySelectorAll(containerSelector));
    if (!containers.length) {
      return;
    }

    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const indexUrl = opts.indexUrl || "/search-index.json";
    const currentPath = normalizePath(window.location.pathname);
    const card = document.createElement("aside");
    card.className = "link-preview-card";
    card.hidden = true;
    document.body.appendChild(card);

    let mapByUrl = null;
    let loadPromise = null;
    let activeAnchor = null;
    let showTimer = 0;
    let hideTimer = 0;
    let requestToken = 0;

    function normalizePath(raw) {
      const path = String(raw || "").split("#")[0].split("?")[0] || "/";
      return path.endsWith("/") ? path : path + "/";
    }

    function pathFromHref(href) {
      try {
        const parsed = new URL(href, window.location.origin);
        if (parsed.origin !== window.location.origin) {
          return "";
        }
        return normalizePath(parsed.pathname);
      } catch (_) {
        return "";
      }
    }

    function isInternalNoteLink(anchor) {
      const path = pathFromHref(anchor && anchor.href ? anchor.href : "");
      return path.startsWith("/notes/") && path !== currentPath;
    }

    function loadIndexMap() {
      if (mapByUrl) {
        return Promise.resolve(mapByUrl);
      }
      if (loadPromise) {
        return loadPromise;
      }

      loadPromise = fetch(indexUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error("search index unavailable");
          }
          return response.json();
        })
        .then((payload) => {
          const items = Array.isArray(payload) ? payload : [];
          const map = new Map();
          items.forEach((item) => {
            const key = normalizePath(item && item.url ? item.url : "");
            if (key && !map.has(key)) {
              map.set(key, item);
            }
          });
          mapByUrl = map;
          return map;
        })
        .catch(() => new Map());

      return loadPromise;
    }

    function positionCard(anchor) {
      const rect = anchor.getBoundingClientRect();
      const margin = 10;
      const width = card.offsetWidth || 320;
      const height = card.offsetHeight || 140;

      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + margin;

      const maxLeft = window.scrollX + window.innerWidth - width - margin;
      if (left > maxLeft) {
        left = maxLeft;
      }
      if (left < window.scrollX + margin) {
        left = window.scrollX + margin;
      }

      const maxTop = window.scrollY + window.innerHeight - height - margin;
      if (top > maxTop) {
        top = rect.top + window.scrollY - height - margin;
      }
      if (top < window.scrollY + margin) {
        top = window.scrollY + margin;
      }

      card.style.left = Math.round(left) + "px";
      card.style.top = Math.round(top) + "px";
    }

    function recordFromAnchor(anchor, path) {
      const titleText = String(
        (anchor.querySelector(".page-tab-title") && anchor.querySelector(".page-tab-title").textContent) ||
          anchor.textContent ||
          "Linked note"
      )
        .replace(/\s+/g, " ")
        .trim();

      const previewText = String(
        (anchor.querySelector(".page-tab-preview") && anchor.querySelector(".page-tab-preview").textContent) || ""
      )
        .replace(/\s+/g, " ")
        .trim();

      return {
        title: titleText || "Linked note",
        excerpt: previewText || "Preview not available.",
        tags: [],
        url: path,
      };
    }

    function renderCard(record, path) {
      const title = document.createElement("p");
      title.className = "link-preview-title";
      title.textContent = record && record.title ? record.title : "Linked note";

      const pathMeta = document.createElement("p");
      pathMeta.className = "link-preview-path";
      pathMeta.textContent = String(path || "")
        .replace(/^\/notes\//, "")
        .replace(/\/$/, "");

      const excerpt = document.createElement("p");
      excerpt.className = "link-preview-excerpt";
      excerpt.textContent = record && record.excerpt ? record.excerpt : "Preview not available.";

      card.replaceChildren(title, pathMeta, excerpt);

      const tags = Array.isArray(record && record.tags) ? record.tags.filter(Boolean).slice(0, 4) : [];
      if (tags.length) {
        const tagWrap = document.createElement("div");
        tagWrap.className = "link-preview-tags";
        tags.forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "link-preview-tag";
          chip.textContent = "#" + tag;
          tagWrap.appendChild(chip);
        });
        card.appendChild(tagWrap);
      }
    }

    function showForAnchor(anchor) {
      const path = pathFromHref(anchor && anchor.href ? anchor.href : "");
      if (!path || path === currentPath) {
        return;
      }

      const token = ++requestToken;
      loadIndexMap().then((map) => {
        if (token !== requestToken || activeAnchor !== anchor) {
          return;
        }

        const record = map.get(path) || recordFromAnchor(anchor, path);
        renderCard(record, path);
        card.hidden = false;
        positionCard(anchor);
      });
    }

    function hideCard() {
      card.hidden = true;
      requestToken += 1;
    }

    function scheduleShow(anchor) {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      activeAnchor = anchor;
      showTimer = window.setTimeout(() => showForAnchor(anchor), 150);
    }

    function scheduleHide(anchor) {
      if (activeAnchor !== anchor) {
        return;
      }
      clearTimeout(showTimer);
      hideTimer = window.setTimeout(() => {
        activeAnchor = null;
        hideCard();
      }, 80);
    }

    function findAnchor(target) {
      if (!(target instanceof Element)) {
        return null;
      }
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return null;
      }
      return anchor;
    }

    containers.forEach((container) => {
      container.addEventListener("pointerover", (event) => {
        const anchor = findAnchor(event.target);
        if (!anchor || !isInternalNoteLink(anchor)) {
          return;
        }
        if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) {
          return;
        }
        scheduleShow(anchor);
      });

      container.addEventListener("pointerout", (event) => {
        const anchor = findAnchor(event.target);
        if (!anchor || !isInternalNoteLink(anchor)) {
          return;
        }
        if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) {
          return;
        }
        scheduleHide(anchor);
      });

      container.addEventListener("focusin", (event) => {
        const anchor = findAnchor(event.target);
        if (!anchor || !isInternalNoteLink(anchor)) {
          return;
        }
        scheduleShow(anchor);
      });

      container.addEventListener("focusout", (event) => {
        const anchor = findAnchor(event.target);
        if (!anchor || !isInternalNoteLink(anchor)) {
          return;
        }
        scheduleHide(anchor);
      });

      container.addEventListener("click", hideCard);
    });

    document.addEventListener(
      "scroll",
      () => {
        if (activeAnchor && !card.hidden) {
          positionCard(activeAnchor);
        }
      },
      { passive: true }
    );

    window.addEventListener("resize", () => {
      if (activeAnchor && !card.hidden) {
        positionCard(activeAnchor);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        activeAnchor = null;
        hideCard();
      }
    });
  }

  window.initLinkPreview = initLinkPreview;
})();
