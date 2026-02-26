(function () {
  function initFileTree(options) {
    const opts = options || {};
    const container = document.getElementById(opts.containerId || "");
    if (!container) {
      return;
    }

    const dataUrl = opts.dataUrl || "/filetree.json";
    const openStorageKey = opts.openStorageKey || "note-filetree-open";
    const scrollStorageKey = opts.scrollStorageKey || "note-filetree-scroll";
    const iconBaseUrl = opts.iconBaseUrl || "/assets/icons/neo/";
    const iconBase = String(iconBaseUrl).endsWith("/") ? String(iconBaseUrl) : String(iconBaseUrl) + "/";
    const scrollHost = document.querySelector(opts.scrollHostSelector || ".page-tabs");
    const normalizePath = (value) => {
      const base = String(value || "/").split(/[?#]/)[0] || "/";
      return base.endsWith("/") ? base : base + "/";
    };
    const iconUrl = (iconName, fallbackName) => {
      const name = String(iconName || fallbackName || "").trim();
      if (name.length === 0) {
        return "";
      }
      if (name.startsWith("http://") || name.startsWith("https://") || name.startsWith("/")) {
        return name;
      }
      return iconBase + name;
    };
    const createIconElement = (iconName, className, fallbackName) => {
      const src = iconUrl(iconName, fallbackName);
      if (src.length === 0) {
        return null;
      }
      const icon = document.createElement("img");
      icon.className = className;
      icon.src = src;
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      icon.decoding = "async";
      icon.loading = "lazy";
      return icon;
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
    const hasStoredOpenState = (() => {
      try {
        return localStorage.getItem(openStorageKey) !== null;
      } catch (_) {
        return false;
      }
    })();
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

          const folderIcon = createIconElement(
            node.icon || "folder-base.svg",
            "filetree-icon filetree-folder-icon",
            "folder-base.svg"
          );
          if (folderIcon) {
            folderIcon.dataset.iconClosed = String(node.icon || "folder-base.svg");
            folderIcon.dataset.iconOpen = String(node.icon_open || "folder-base-open.svg");
            summary.appendChild(folderIcon);
          }

          const folderText = document.createElement("span");
          folderText.className = "filetree-folder-text";
          folderText.textContent = String(node.label || "Folder");
          summary.appendChild(folderText);

          details.appendChild(summary);

          const childList = document.createElement("ul");
          childList.className = "filetree-list filetree-list--nested";
          const childHasActive = buildTree(Array.isArray(node.children) ? node.children : [], childList);
          details.appendChild(childList);

          if (openSet.has(String(node.id || "")) && hasStoredOpenState) {
            details.open = true;
          }

          const syncFolderIcon = () => {
            if (!folderIcon) {
              return;
            }
            const closedName = folderIcon.dataset.iconClosed || "folder-base.svg";
            const openName = folderIcon.dataset.iconOpen || "folder-base-open.svg";
            folderIcon.src = iconUrl(details.open ? openName : closedName, closedName);
          };

          syncFolderIcon();

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
            syncFolderIcon();
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

          const noteIcon = createIconElement(node.icon || "markdown.svg", "filetree-icon filetree-note-icon", "document.svg");
          if (noteIcon) {
            title.appendChild(noteIcon);
          }

          const titleText = document.createElement("span");
          titleText.className = "page-tab-title-text";
          titleText.textContent = String(node.label || "Untitled");
          title.appendChild(titleText);

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
