(function () {
  function initFileTree(options) {
    const opts = options || {};
    const container = document.getElementById(opts.containerId || "");
    if (!container) {
      return;
    }

    const dataUrl = opts.dataUrl || "/filetree.json";
    const openStorageKey = opts.openStorageKey || "dg-filetree-open";
    const scrollStorageKey = opts.scrollStorageKey || "dg-filetree-scroll";
    const scrollHost = document.querySelector(opts.scrollHostSelector || ".page-tabs");
    const normalizePath = (value) => {
      const base = String(value || "/").split(/[?#]/)[0] || "/";
      return base.endsWith("/") ? base : base + "/";
    };
    const activePath = normalizePath(opts.activePath || window.location.pathname);

    let activeEl = null;
    const loadOpenSet = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(openStorageKey) || "[]");
        if (!Array.isArray(parsed)) {
          return new Set();
        }
        return new Set(parsed.map((value) => String(value)));
      } catch (_) {
        return new Set();
      }
    };
    const saveOpenSet = (openSet) => {
      try {
        localStorage.setItem(openStorageKey, JSON.stringify(Array.from(openSet)));
      } catch (_) {}
    };

    const openSet = loadOpenSet();

    const buildTree = (nodes, parentList) => {
      let hasActive = false;
      nodes.forEach((node) => {
        const item = document.createElement("li");
        item.className = "filetree-item";

        if (node.kind === "folder") {
          const details = document.createElement("details");
          details.className = "filetree-folder";
          details.dataset.nodeId = String(node.id || "");

          const summary = document.createElement("summary");
          summary.className = "filetree-folder-label";
          summary.textContent = String(node.label || "Folder");
          details.appendChild(summary);

          const childList = document.createElement("ul");
          childList.className = "filetree-list filetree-list--nested";
          const childHasActive = buildTree(Array.isArray(node.children) ? node.children : [], childList);
          details.appendChild(childList);

          if (childHasActive || openSet.has(String(node.id || ""))) {
            details.open = true;
          }

          details.addEventListener("toggle", () => {
            const id = String(node.id || "");
            if (!id) {
              return;
            }
            if (details.open) {
              openSet.add(id);
            } else {
              openSet.delete(id);
            }
            saveOpenSet(openSet);
          });

          item.appendChild(details);
          hasActive = hasActive || childHasActive;
        } else {
          const url = normalizePath(node.url || "/");
          const link = document.createElement("a");
          link.className = "page-tab filetree-note";
          link.href = url;

          const title = document.createElement("span");
          title.className = "page-tab-title";
          title.textContent = String(node.label || "Untitled");
          link.appendChild(title);

          const preview = String(node.preview || "").trim();
          if (preview.length > 0) {
            const previewEl = document.createElement("span");
            previewEl.className = "page-tab-preview";
            previewEl.textContent = preview;
            link.appendChild(previewEl);
          }

          if (url === activePath) {
            link.classList.add("is-active");
            activeEl = link;
            hasActive = true;
          }

          item.appendChild(link);
        }

        parentList.appendChild(item);
      });

      return hasActive;
    };

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("filetree fetch failed");
        }
        return response.json();
      })
      .then((payload) => {
        const nodes = Array.isArray(payload) ? payload : [];
        if (nodes.length === 0) {
          return;
        }

        const list = document.createElement("ul");
        list.className = "filetree-list";
        buildTree(nodes, list);

        container.innerHTML = "";
        container.classList.add("filetree-root");
        container.appendChild(list);

        if (activeEl) {
          requestAnimationFrame(() => {
            activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
          });
        }

        if (scrollHost) {
          try {
            const saved = Number(localStorage.getItem(scrollStorageKey) || "0");
            if (Number.isFinite(saved) && saved > 0) {
              requestAnimationFrame(() => {
                scrollHost.scrollTop = saved;
              });
            }
          } catch (_) {}

          let scrollRaf = 0;
          scrollHost.addEventListener(
            "scroll",
            () => {
              if (scrollRaf) {
                return;
              }
              scrollRaf = window.requestAnimationFrame(() => {
                scrollRaf = 0;
                try {
                  localStorage.setItem(scrollStorageKey, String(Math.round(scrollHost.scrollTop)));
                } catch (_) {}
              });
            },
            { passive: true }
          );
        }
      })
      .catch(() => {});
  }

  window.initFileTree = initFileTree;
})();
