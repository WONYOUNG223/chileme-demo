(function () {
  'use strict';

  function initializeJourney() {
    var root = document.getElementById('meal-journey');
    var home = document.getElementById('home');
    var stage = root && root.querySelector('.journey-stage');
    if (!root || !home || !stage) return;

    var intro = root.querySelector('.journey-intro');
    var bowl = root.querySelector('.journey-bowl');
    var plate = root.querySelector('.journey-plate');
    var controls = root.querySelector('.journey-controls');
    var copies = Array.from(root.querySelectorAll('[data-meal-copy]'));
    var memories = Array.from(root.querySelectorAll('[data-memory]'));
    var buttons = Array.from(root.querySelectorAll('[data-meal-stop]'));
    var start = document.getElementById('journey-scroll-start');
    var next = document.getElementById('journey-next');
    var skip = document.getElementById('journey-skip');
    var motion = document.getElementById('journey-motion');
    var currentLabel = document.getElementById('journey-current');
    var status = document.getElementById('journey-status');
    var reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    var names = ['breakfast', 'lunch', 'dinner'];
    var labels = ['早餐', '午餐', '晚餐'];
    var stops = [0.34, 0.62, 0.88];
    var documentTop = 0;
    var travel = 1;
    var viewportHeight = window.innerHeight;
    var targetProgress = 0;
    var renderedProgress = 0;
    var reducedSelection = 0;
    var activeMeal = -2;
    var frame = 0;
    var previousTime = 0;
    var manualReduced = false;
    var reduced = reducedMedia.matches;
    var wasVisible = !home.hidden && !document.hidden;

    function clamp(value, min, max) {
      return Math.min(max === undefined ? 1 : max, Math.max(min === undefined ? 0 : min, value));
    }

    function easeBetween(startValue, endValue, value) {
      var normalized = clamp((value - startValue) / (endValue - startValue));
      return normalized * normalized * (3 - 2 * normalized);
    }

    function mix(from, to, amount) {
      return from + (to - from) * amount;
    }

    function isVisible() {
      return !home.hidden && !document.hidden;
    }

    function css(element, property, value, unit) {
      if (!element) return;
      element.style.setProperty(property, Number(value.toFixed(4)) + (unit || ''));
    }

    function accessible(element, available) {
      if (!element) return;
      element.inert = !available;
      element.setAttribute('aria-hidden', available ? 'false' : 'true');
      element.style.pointerEvents = available ? 'auto' : 'none';
    }

    function measure() {
      if (!isVisible()) return;
      viewportHeight = window.innerHeight;
      documentTop = root.getBoundingClientRect().top + window.scrollY;
      travel = Math.max(1, root.offsetHeight - viewportHeight);
      targetProgress = clamp((window.scrollY - documentTop) / travel);
    }

    function readScroll() {
      targetProgress = clamp((window.scrollY - documentTop) / travel);
    }

    function render(rawProgress) {
      var p = reduced && rawProgress >= 0.18 ? stops[reducedSelection] : rawProgress;
      var entrance = easeBetween(0.10, 0.27, p);
      var introOpacity = 1 - easeBetween(0.055, 0.15, p);
      var bowlOpacity = 1 - easeBetween(0.11, 0.255, p);
      var plateOpacity = easeBetween(0.13, 0.25, p);
      var controlsOpacity = easeBetween(0.23, 0.30, p);
      var headingOpacity = easeBetween(0.21, 0.28, p);
      var introIsCurrent = p < 0.27;
      var index = introIsCurrent ? -1 : p < 0.48 ? 0 : p < 0.75 ? 1 : 2;
      var angle = p <= stops[0]
        ? mix(-45, 0, easeBetween(0.13, stops[0], p))
        : p <= stops[1]
          ? mix(0, 120, easeBetween(stops[0], stops[1], p))
          : mix(120, 240, easeBetween(stops[1], stops[2], p));
      var phase = index < 0 ? 'intro' : names[index];

      if (reduced) {
        introIsCurrent = rawProgress < 0.18;
        index = introIsCurrent ? -1 : reducedSelection;
        phase = index < 0 ? 'intro' : names[index];
        introOpacity = introIsCurrent ? 1 : 0;
        bowlOpacity = introIsCurrent ? 1 : 0;
        plateOpacity = introIsCurrent ? 0 : 1;
        controlsOpacity = introIsCurrent ? 0 : 1;
        headingOpacity = controlsOpacity;
        entrance = controlsOpacity;
        angle = 0;
      }

      css(stage, '--intro-opacity', introOpacity);
      css(stage, '--intro-y', reduced ? 0 : -110 * easeBetween(0.01, 0.18, p), 'px');
      css(stage, '--bowl-opacity', bowlOpacity);
      css(stage, '--bowl-y', reduced ? 0 : -viewportHeight * 0.45 * easeBetween(0.05, 0.27, p), 'px');
      css(stage, '--bowl-scale', reduced ? 1 : mix(1, 0.72, entrance));
      css(stage, '--bowl-rotate', reduced ? 0 : -16 * entrance, 'deg');
      css(stage, '--plate-opacity', plateOpacity);
      css(stage, '--plate-y', reduced ? 0 : viewportHeight * 0.64 * (1 - entrance), 'px');
      css(stage, '--plate-scale', reduced ? 1 : mix(0.76, 1, entrance));
      css(stage, '--plate-angle', angle, 'deg');
      css(stage, '--scene-mix', entrance);
      css(stage, '--controls-opacity', controlsOpacity);
      css(stage, '--heading-opacity', headingOpacity);
      css(stage, '--progress', reduced && index >= 0 ? (index + 1) / 3 : p);

      root.dataset.meal = phase;
      stage.dataset.active = phase;
      accessible(intro, introOpacity > 0.04 && index < 0);
      accessible(bowl, bowlOpacity > 0.04);
      accessible(plate, plateOpacity > 0.04);
      accessible(start, introOpacity > 0.04 && index < 0);
      accessible(controls, controlsOpacity > 0.45);

      var breakfastOpacity = easeBetween(0.25, 0.32, p) * (1 - easeBetween(0.44, 0.52, p));
      var lunchOpacity = easeBetween(0.44, 0.52, p) * (1 - easeBetween(0.71, 0.79, p));
      var dinnerOpacity = easeBetween(0.71, 0.79, p);
      var copyOpacities = [breakfastOpacity, lunchOpacity, dinnerOpacity];

      copies.forEach(function (copy) {
        var copyIndex = Number(copy.dataset.mealCopy);
        if (copyIndex < 0 || copyIndex > 2) return;
        var opacity = reduced ? (copyIndex === index ? 1 : 0) : copyOpacities[copyIndex];
        var offset = reduced ? 0 : clamp((p - stops[copyIndex]) / 0.19, -1, 1);
        css(copy, '--copy-opacity', opacity);
        css(copy, '--copy-y', -offset * 38, 'px');
        accessible(copy, copyIndex === index && opacity > 0.15);
      });

      memories.forEach(function (memory) {
        var memoryIndex = Number(memory.dataset.memory);
        if (memoryIndex < 0 || memoryIndex > 2) return;
        var opacity = reduced ? (memoryIndex === index ? 1 : 0) : copyOpacities[memoryIndex];
        var drift = reduced ? 0 : clamp((p - stops[memoryIndex]) / 0.22, -1, 1);
        css(memory, '--memory-opacity', opacity);
        css(memory, '--memory-y', -drift * viewportHeight * 0.24, 'px');
        accessible(memory, memoryIndex === index && opacity > 0.15);
      });

      if (activeMeal !== index) {
        activeMeal = index;
        buttons.forEach(function (button) {
          button.setAttribute('aria-pressed', Number(button.dataset.mealStop) === index ? 'true' : 'false');
        });
        if (currentLabel) currentLabel.textContent = index < 0 ? '01' : String(index + 1).padStart(2, '0');
        if (status) status.textContent = index < 0 ? '' : labels[index] + '，' + (index + 1) + ' / 3';
        if (next) {
          var nextLabel = index < 0 ? '看看早餐' : index < 2 ? '下一餐：' + labels[index + 1] : '继续，开始安排我的三餐';
          next.setAttribute('aria-label', nextLabel);
          next.setAttribute('title', nextLabel);
        }
      }
    }

    function animate(time) {
      frame = 0;
      if (!isVisible()) {
        previousTime = 0;
        return;
      }
      var elapsed = previousTime ? Math.min(64, time - previousTime) : 16.667;
      previousTime = time;
      var difference = targetProgress - renderedProgress;
      if (reduced || Math.abs(difference) < 0.00015) {
        renderedProgress = targetProgress;
        render(renderedProgress);
        previousTime = 0;
        return;
      }
      renderedProgress += difference * (1 - Math.pow(0.86, elapsed / 16.667));
      render(renderedProgress);
      frame = window.requestAnimationFrame(animate);
    }

    function schedule() {
      if (!isVisible() || frame) return;
      frame = window.requestAnimationFrame(animate);
    }

    function refresh() {
      if (!isVisible()) {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        previousTime = 0;
        wasVisible = false;
        return;
      }
      measure();
      if (!wasVisible) {
        renderedProgress = targetProgress;
        render(renderedProgress);
      }
      wasVisible = true;
      schedule();
    }

    function scrollToMeal(index) {
      index = clamp(index, 0, 2);
      measure();
      if (reduced) {
        reducedSelection = index;
        if (targetProgress >= 0.18) {
          renderedProgress = targetProgress;
          render(renderedProgress);
          return;
        }
        window.scrollTo({ top: documentTop + travel * 0.42, behavior: 'auto' });
      } else {
        window.scrollTo({ top: documentTop + travel * stops[index], behavior: 'smooth' });
      }
      readScroll();
      schedule();
    }

    function scrollBeyondJourney() {
      measure();
      window.scrollTo({ top: documentTop + root.offsetHeight + 20, behavior: reduced ? 'auto' : 'smooth' });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        scrollToMeal(Number(button.dataset.mealStop));
      });
    });
    if (start) start.addEventListener('click', function () { scrollToMeal(0); });
    if (skip) skip.addEventListener('click', scrollBeyondJourney);
    if (next) next.addEventListener('click', function () {
      if (activeMeal < 2) scrollToMeal(activeMeal + 1);
      else scrollBeyondJourney();
    });

    if (controls) controls.addEventListener('keydown', function (event) {
      if (!event.target.closest('[data-meal-stop]') || event.altKey || event.ctrlKey || event.metaKey) return;
      var requested = null;
      var focused = Number(event.target.closest('[data-meal-stop]').dataset.mealStop);
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') requested = (focused + 1) % 3;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') requested = (focused + 2) % 3;
      if (event.key === 'Home') requested = 0;
      if (event.key === 'End') requested = 2;
      if (requested === null) return;
      event.preventDefault();
      var destination = buttons.find(function (button) { return Number(button.dataset.mealStop) === requested; });
      if (destination) destination.focus({ preventScroll: true });
      scrollToMeal(requested);
    });

    window.addEventListener('scroll', function () {
      if (!isVisible()) return;
      readScroll();
      schedule();
    }, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', refresh, { passive: true });
    window.addEventListener('hashchange', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);

    function updateMotionControl() {
      if (!motion) return;
      motion.setAttribute('aria-pressed', reduced ? 'true' : 'false');
      motion.disabled = reducedMedia.matches;
      motion.textContent = reducedMedia.matches ? '系统已减少动态' : reduced ? '恢复滚动动画' : '减少动态';
    }

    function changeMotionPreference() {
      var nextReduced = manualReduced || reducedMedia.matches;
      if (nextReduced === reduced) {
        updateMotionControl();
        return;
      }

      var visible = isVisible();
      if (visible) measure();
      var selectedMeal = activeMeal >= 0 ? activeMeal : -1;
      var oldScroll = window.scrollY;
      var oldBottom = documentTop + root.offsetHeight;
      var belowJourney = visible && oldScroll >= oldBottom;
      var beforeJourney = visible && oldScroll < documentTop;
      if (selectedMeal >= 0) reducedSelection = selectedMeal;

      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      reduced = nextReduced;
      root.classList.toggle('is-reduced', reduced);
      updateMotionControl();
      measure();

      if (visible && !beforeJourney) {
        var destination = belowJourney
          ? documentTop + root.offsetHeight + (oldScroll - oldBottom)
          : selectedMeal < 0
            ? documentTop
            : documentTop + travel * (reduced ? 0.42 : stops[selectedMeal]);
        window.scrollTo({ top: destination, behavior: 'auto' });
        readScroll();
      }
      activeMeal = -2;
      renderedProgress = targetProgress;
      render(renderedProgress);
      refresh();
    }
    if (motion) motion.addEventListener('click', function () {
      manualReduced = !manualReduced;
      changeMotionPreference();
    });
    if (reducedMedia.addEventListener) reducedMedia.addEventListener('change', changeMotionPreference);
    else reducedMedia.addListener(changeMotionPreference);

    root.classList.add('is-enhanced');
    root.classList.toggle('is-reduced', reduced);
    updateMotionControl();
    if (window.ResizeObserver) new ResizeObserver(refresh).observe(root);
    if (window.MutationObserver) new MutationObserver(refresh).observe(home, { attributes: true, attributeFilter: ['hidden'] });
    measure();
    renderedProgress = targetProgress;
    render(renderedProgress);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeJourney, { once: true });
  else initializeJourney();
}());
