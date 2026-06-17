/* ==========================================================================
   NextQuest — Slide controller + GSAP animations
   ========================================================================== */

(() => {
  const deck = document.getElementById('deck');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const totalSlides = slides.length;

  const elCurrent = document.getElementById('slide-current');
  const elTotal = document.getElementById('slide-total');
  const elProgress = document.getElementById('hud-progress-fill');
  const helpOverlay = document.getElementById('help-overlay');
  const helpBtn = document.getElementById('hud-help-btn');

  elTotal.textContent = totalSlides;

  let currentSlide = 0;
  let currentFragment = -1;
  let isAnimating = false;

  /* -------------------- Helpers -------------------- */

  function getFragments(slide) {
    return Array.from(slide.querySelectorAll('[data-fragment]'))
      .filter(el => el.dataset.fragment !== '0');
  }

  function getInitialFragments(slide) {
    // éléments avec data-fragment="0" : visibles dès le début de la slide
    return Array.from(slide.querySelectorAll('[data-fragment="0"]'));
  }

  function setHUD() {
    elCurrent.textContent = currentSlide + 1;
    elProgress.style.width = `${((currentSlide + 1) / totalSlides) * 100}%`;
    document.body.dataset.slide = currentSlide + 1;
  }

  /* -------------------- Animations par slide -------------------- */

  function animateSlideIntro(slide) {
    const slideNum = parseInt(slide.dataset.slide, 10);

    // Reset
    gsap.set(slide.querySelectorAll('[data-fragment]'), { opacity: 0, y: 20 });
    gsap.set(slide.querySelectorAll('[data-fragment="0"]'), { opacity: 0, y: 20 });

    const tl = gsap.timeline({ defaults: { duration: 0.7, ease: 'power2.out' } });

    // Animation d'intro spécifique à chaque slide
    switch (slideNum) {
      case 1: // Cover
        gsap.set('.cover-logo', { opacity: 0, scale: 0.6, rotation: -8 });
        gsap.set('.cover-title-line', { opacity: 0, y: 30 });
        gsap.set('.cover-meta, .cover-author', { opacity: 0, y: 15 });

        tl.to('.cover-logo', { opacity: 1, scale: 1, rotation: 0, duration: 1.4, ease: 'elastic.out(1, 0.6)' })
          .to('.cover-title-line', { opacity: 1, y: 0, stagger: 0.18, duration: 0.9 }, '-=0.6')
          .to('.cover-meta', { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
          .to('.cover-author', { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');
        break;

      case 2: // Hook
        tl.to(getInitialFragments(slide), { opacity: 1, y: 0, stagger: 0.08, duration: 0.6 });
        break;

      case 11: // End
        gsap.set('.end-logo', { opacity: 0, scale: 0.7 });
        gsap.set('.end-thanks', { opacity: 0, y: 25 });
        gsap.set('.end-meta', { opacity: 0, y: 15 });

        tl.to('.end-logo', { opacity: 1, scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.7)' })
          .to('.end-thanks', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
          .to('.end-meta', { opacity: 1, y: 0, duration: 0.6 }, '-=0.4');
        break;

      default:
        // header (eyebrow + title) apparaît tout de suite
        const initial = getInitialFragments(slide);
        if (initial.length > 0) {
          tl.to(initial, { opacity: 1, y: 0, stagger: 0.1, duration: 0.6 });
        }
    }
  }

  function showFragment(slide, idx) {
    const frags = getFragments(slide);
    if (idx < 0 || idx >= frags.length) return;

    const el = frags[idx];
    el.classList.add('is-visible');

    // Animation par type d'élément (auto)
    const tl = gsap.timeline({ defaults: { duration: 0.6, ease: 'power2.out' } });

    if (el.classList.contains('lib-counts') || el.parentElement?.classList.contains('lib-counts')) {
      // count up sur les chiffres
      tl.to(el, { opacity: 1, y: 0, duration: 0.5 });
      const counter = el.querySelector('.lib-count');
      if (counter && counter.dataset.count) {
        const target = parseInt(counter.dataset.count, 10);
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => { counter.textContent = Math.round(obj.val); }
        });
      }
    } else if (el.classList.contains('patch')) {
      tl.fromTo(el, { opacity: 0, scale: 0.85, rotation: -2 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.5)' });
    } else if (el.classList.contains('pillar')) {
      tl.fromTo(el, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6 });
    } else if (el.classList.contains('member')) {
      tl.fromTo(el, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.4)' });
    } else if (el.classList.contains('archi-box')) {
      tl.fromTo(el, { opacity: 0, y: 15, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.5 });
    } else if (el.classList.contains('archi-arrows')) {
      tl.fromTo(el, { opacity: 0 }, { opacity: 0.6, duration: 0.4 });
    } else if (el.classList.contains('choice')) {
      tl.fromTo(el, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6 });
    } else if (el.classList.contains('sec-card')) {
      tl.fromTo(el, { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.3)' });
    } else if (el.classList.contains('status-item')) {
      tl.fromTo(el, { opacity: 0, x: -25 }, { opacity: 1, x: 0, duration: 0.5 });
    } else if (el.classList.contains('roadmap-step')) {
      const isLast = el.classList.contains('roadmap-step--treasure');
      tl.fromTo(el, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: isLast ? 0.9 : 0.5, ease: isLast ? 'elastic.out(1, 0.6)' : 'power2.out' });
    } else if (el.classList.contains('screenshot')) {
      const rot = parseFloat(getComputedStyle(el).rotate) || 0;
      tl.fromTo(el, { opacity: 0, scale: 0.85, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.3)' });
    } else {
      tl.to(el, { opacity: 1, y: 0, duration: 0.5 });
    }
  }

  function showAllFragments(slide) {
    const frags = getFragments(slide);
    frags.forEach(el => {
      el.classList.add('is-visible');
      gsap.set(el, { opacity: 1, y: 0 });
    });
    // count-up final
    slide.querySelectorAll('.lib-count[data-count]').forEach(c => {
      c.textContent = c.dataset.count;
    });
  }

  function hideAllFragments(slide) {
    const frags = getFragments(slide);
    frags.forEach(el => {
      el.classList.remove('is-visible');
      gsap.set(el, { opacity: 0, y: 20 });
    });
  }

  /* -------------------- Navigation -------------------- */

  function activateSlide(idx, { instant = false } = {}) {
    if (idx < 0 || idx >= totalSlides) return;
    if (isAnimating) return;
    isAnimating = true;

    const prev = slides[currentSlide];
    const next = slides[idx];

    if (prev !== next) {
      prev.classList.remove('is-active');
      hideAllFragments(prev);
    }

    next.classList.add('is-active');
    currentSlide = idx;
    currentFragment = -1;
    setHUD();

    if (instant) {
      isAnimating = false;
      return;
    }

    // Petit fade entre les slides
    gsap.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out', onComplete: () => {
      animateSlideIntro(next);
      isAnimating = false;
    }});
  }

  function nextStep() {
    const slide = slides[currentSlide];
    const frags = getFragments(slide);

    if (currentFragment < frags.length - 1) {
      currentFragment += 1;
      showFragment(slide, currentFragment);
    } else if (currentSlide < totalSlides - 1) {
      activateSlide(currentSlide + 1);
    }
  }

  function prevStep() {
    const slide = slides[currentSlide];

    if (currentFragment > -1) {
      const frags = getFragments(slide);
      const el = frags[currentFragment];
      if (el) {
        el.classList.remove('is-visible');
        gsap.to(el, { opacity: 0, y: 20, duration: 0.25, ease: 'power1.in' });
      }
      currentFragment -= 1;
    } else if (currentSlide > 0) {
      activateSlide(currentSlide - 1);
      // afficher tous les fragments de la slide précédente pour qu'on revienne au "bout"
      requestAnimationFrame(() => {
        const newSlide = slides[currentSlide];
        showAllFragments(newSlide);
        currentFragment = getFragments(newSlide).length - 1;
      });
    }
  }

  /* -------------------- Inputs -------------------- */

  document.addEventListener('keydown', (e) => {
    // Aide : ? ou Cmd+/
    if (e.key === '?' || (e.shiftKey && e.key === '/') || (e.metaKey && e.key === '/')) {
      e.preventDefault();
      helpOverlay.hidden = !helpOverlay.hidden;
      return;
    }
    if (!helpOverlay.hidden) {
      if (e.key === 'Escape') { helpOverlay.hidden = true; }
      return;
    }

    // Cmd + flèches : aller au début/fin
    if (e.metaKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      activateSlide(0);
      return;
    }
    if (e.metaKey && e.key === 'ArrowRight') {
      e.preventDefault();
      activateSlide(totalSlides - 1);
      return;
    }

    // Touches numériques 1-9 : aller à la slide N (sans modifier)
    if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) {
      const n = parseInt(e.key, 10);
      if (n <= totalSlides) {
        e.preventDefault();
        activateSlide(n - 1);
        return;
      }
    }
    // 0 = slide 10
    if (!e.metaKey && !e.ctrlKey && e.key === '0' && totalSlides >= 10) {
      e.preventDefault();
      activateSlide(9);
      return;
    }

    // Avancer / reculer
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextStep();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prevStep();
    } else if (e.key === 'Home') {
      // fn + ← sur Mac
      e.preventDefault();
      activateSlide(0);
    } else if (e.key === 'End') {
      // fn + → sur Mac
      e.preventDefault();
      activateSlide(totalSlides - 1);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } else if (e.key === 'Escape' && document.fullscreenElement) {
      // sortie plein écran déjà gérée par le navigateur, on laisse
    }
  });

  // Click sur la slide active = next (sauf sur le bouton help)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.hud-help-btn, .help-overlay')) return;
    nextStep();
  });

  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    helpOverlay.hidden = !helpOverlay.hidden;
  });

  helpOverlay.addEventListener('click', () => {
    helpOverlay.hidden = true;
  });

  /* -------------------- Init -------------------- */

  // Initialise les fragments invisibles
  document.querySelectorAll('[data-fragment]').forEach(el => {
    if (el.dataset.fragment === '0') {
      gsap.set(el, { opacity: 0, y: 20 });
    } else {
      gsap.set(el, { opacity: 0, y: 20 });
    }
  });

  activateSlide(0);
})();
