(() => {
  if (window.__BLOG_HERO_WOBBLE_ACTIVE) {
    return;
  }
  window.__BLOG_HERO_WOBBLE_ACTIVE = true;

  const hero = document.querySelector(".home-hero");
  if (!(hero instanceof HTMLElement)) {
    return;
  }

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const motionScale = coarsePointer ? 0.78 : 1;

  let impulse = 0;
  let targetX = 0;
  let targetY = 0;
  let targetRot = 0;
  let targetStretch = 1;

  let currentX = 0;
  let currentY = 0;
  let currentRot = 0;
  let currentStretch = 1;

  let rafId = 0;
  let lastScrollY = window.scrollY || window.pageYOffset || 0;

  const queueTick = () => {
    if (rafId !== 0) {
      return;
    }
    rafId = window.requestAnimationFrame(tick);
  };

  const updateTargets = () => {
    const rect = hero.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    const range = clamp(viewportHeight * 0.58, 180, 440);
    const heroAnchor = rect.top + rect.height * 0.26;
    const viewportAnchor = viewportHeight * 0.4;
    const normalized = clamp((viewportAnchor - heroAnchor) / range, -1.2, 1.2);
    const swing = Math.sin(normalized * Math.PI * 0.9) * motionScale;

    targetX = swing * 11 + impulse * 0.32;
    targetY = Math.cos(normalized * Math.PI) * -3.8 * motionScale + Math.abs(impulse) * 0.09;
    targetRot = swing * 3.8 + impulse * 0.14;
    targetStretch = 1 + Math.min(0.14, Math.abs(impulse) * 0.007 + Math.abs(swing) * 0.045);
  };

  const tick = () => {
    rafId = 0;
    updateTargets();

    currentX += (targetX - currentX) * 0.18;
    currentY += (targetY - currentY) * 0.18;
    currentRot += (targetRot - currentRot) * 0.16;
    currentStretch += (targetStretch - currentStretch) * 0.14;
    impulse *= 0.84;

    hero.style.setProperty("--hero-drop-x", `${currentX.toFixed(2)}px`);
    hero.style.setProperty("--hero-drop-y", `${currentY.toFixed(2)}px`);
    hero.style.setProperty("--hero-drop-rot", `${currentRot.toFixed(2)}deg`);
    hero.style.setProperty("--hero-drop-sx", currentStretch.toFixed(4));
    hero.style.setProperty("--hero-drop-sy", (1 / currentStretch).toFixed(4));

    const stillMoving =
      Math.abs(targetX - currentX) > 0.05 ||
      Math.abs(targetY - currentY) > 0.05 ||
      Math.abs(targetRot - currentRot) > 0.05 ||
      Math.abs(targetStretch - currentStretch) > 0.002 ||
      Math.abs(impulse) > 0.04;

    if (stillMoving && !document.hidden) {
      queueTick();
    }
  };

  const onScroll = () => {
    const nextScrollY = window.scrollY || window.pageYOffset || 0;
    const delta = nextScrollY - lastScrollY;
    lastScrollY = nextScrollY;
    impulse = clamp(impulse + delta * 0.09 * motionScale, -14, 14);
    queueTick();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", queueTick, { passive: true });
  window.addEventListener(
    "orientationchange",
    () => {
      impulse = 0;
      queueTick();
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      return;
    }
    lastScrollY = window.scrollY || window.pageYOffset || 0;
    queueTick();
  });

  queueTick();
})();
