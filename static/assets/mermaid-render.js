(() => {
  const run = async () => {
    const blocks = Array.from(
      document.querySelectorAll(
        '.note-body pre > code.language-mermaid, .note-body pre > code.lang-mermaid',
      ),
    );

    if (!blocks.length) {
      return;
    }

    try {
      const module = await import(
        'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
      );
      const mermaid = module && module.default ? module.default : module;
      const theme =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme,
      });

      for (let index = 0; index < blocks.length; index += 1) {
        const code = blocks[index];
        const pre = code.closest('pre');
        const source = (code.textContent || '').trim();
        if (!pre || !source) {
          continue;
        }

        try {
          const id = 'mermaid-' + index + '-' + Date.now();
          const rendered = await mermaid.render(id, source);
          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-render';
          wrapper.innerHTML = rendered.svg;
          if (typeof rendered.bindFunctions === 'function') {
            rendered.bindFunctions(wrapper);
          }
          pre.replaceWith(wrapper);
        } catch (_) {
          pre.classList.add('mermaid-render-failed');
        }
      }
    } catch (_) {
      // Keep original code fences when Mermaid cannot be loaded.
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        run();
      },
      { once: true },
    );
  } else {
    run();
  }
})();
