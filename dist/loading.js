(() => {
  const root = document.getElementById('site-content');
  const loader = document.getElementById('site-loader');
  let finished = !document.documentElement.classList.contains('is-loading');
  if (root && !finished) {
    root.inert = true;
    root.setAttribute('aria-busy', 'true');
  }
  window.EMKLoader = {
    finish(state = 'ready') {
      if (finished) return;
      finished = true;
      document.documentElement.classList.remove('is-loading');
      document.documentElement.dataset.sceneState = state;
      if (root) { root.inert = false; root.removeAttribute('aria-busy'); }
      if (loader) loader.hidden = true;
    }
  };
})();
