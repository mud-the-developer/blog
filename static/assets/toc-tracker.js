(() => {
  function initTocTracker(options) {
    const opts = options || {};
    const panelSelector = opts.panelSelector || '.toc-panel';
    const panel = document.querySelector(panelSelector);
    if (!panel) {
      return;
    }

    const links = Array.from(panel.querySelectorAll(".toc-link[href^='#']"));
    if (!links.length) {
      return;
    }

    const entries = links
      .map((link) => {
        const id = decodeURIComponent((link.getAttribute('href') || '').slice(1));
        const heading = id ? document.getElementById(id) : null;
        if (!heading) {
          return null;
        }
        return { id, link, heading };
      })
      .filter(Boolean);

    if (!entries.length) {
      return;
    }

    let activeId = '';
    let rafId = 0;

    const setActive = (id) => {
      if (activeId === id) {
        return;
      }
      activeId = id;
      entries.forEach((entry) => {
        entry.link.classList.toggle('is-active', entry.id === id);
      });
    };

    const computeActiveId = () => {
      let candidate = entries[0].id;
      const threshold = 140;

      for (const entry of entries) {
        const top = entry.heading.getBoundingClientRect().top;
        if (top - threshold <= 0) {
          candidate = entry.id;
        } else {
          break;
        }
      }

      return candidate;
    };

    const requestUpdate = () => {
      if (rafId !== 0) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        setActive(computeActiveId());
      });
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const targetId = decodeURIComponent((link.getAttribute('href') || '').slice(1));
        if (targetId) {
          setActive(targetId);
        }
      });
    });

    document.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    requestUpdate();
  }

  window.initTocTracker = initTocTracker;
})();
