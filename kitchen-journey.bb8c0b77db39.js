(function () {
  'use strict';
  var fridge = document.querySelector('[data-fridge-link]');
  var steps = document.querySelector('[data-kitchen-steps]');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (fridge) fridge.addEventListener('click', function (event) {
    if (reduced.matches || fridge.classList.contains('is-opening')) return;
    event.preventDefault();
    fridge.classList.add('is-opening');
    window.setTimeout(function () { window.location.hash = 'ingredients'; }, 560);
  });

  if (!steps) return;
  var dragging = false, startX = 0, startScroll = 0;
  steps.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'touch') return;
    dragging = true; startX = event.clientX; startScroll = steps.scrollLeft;
    steps.classList.add('is-dragging'); steps.setPointerCapture(event.pointerId);
  });
  steps.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    steps.scrollLeft = startScroll - (event.clientX - startX);
  });
  function stopDrag(event) { if (!dragging) return; dragging = false; steps.classList.remove('is-dragging'); if (steps.hasPointerCapture(event.pointerId)) steps.releasePointerCapture(event.pointerId); }
  steps.addEventListener('pointerup', stopDrag); steps.addEventListener('pointercancel', stopDrag);
  steps.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    steps.scrollBy({ left: event.key === 'ArrowRight' ? 280 : -280, behavior: reduced.matches ? 'auto' : 'smooth' });
  });
}());
