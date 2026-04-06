(() => {
  const targets = Array.from(document.querySelectorAll('[data-reveal]'));
  if (targets.length === 0 || typeof window.IntersectionObserver !== 'function') {
    targets.forEach(target => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.12,
    },
  );

  targets.forEach(target => observer.observe(target));
})();
