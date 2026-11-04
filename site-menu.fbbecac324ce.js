(function () {
  'use strict';
  var dialog = document.getElementById('site-menu');
  var toggle = document.getElementById('site-menu-toggle');
  var close = document.getElementById('site-menu-close');
  if (!dialog || !toggle || !close) return;

  function setExpanded(open) { toggle.setAttribute('aria-expanded', String(open)); }
  function openMenu() { if (!dialog.open) dialog.showModal(); setExpanded(true); close.focus(); }
  function closeMenu() { if (dialog.open) dialog.close(); }
  toggle.addEventListener('click', openMenu);
  close.addEventListener('click', closeMenu);
  dialog.addEventListener('close', function () { setExpanded(false); toggle.focus({ preventScroll: true }); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) closeMenu(); });
  dialog.querySelectorAll('a[href^="#"]').forEach(function (link) { link.addEventListener('click', closeMenu); });
  window.addEventListener('hashchange', closeMenu);
}());
