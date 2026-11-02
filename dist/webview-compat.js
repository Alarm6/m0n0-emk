/* Shared WebKit / Android WebView safeguards; no app SDK required. */
(() => {
  const embedded = /Instagram|FBAN|FBAV|VK(App|Client)|VKontakte|Telegram|; wv\)/i.test(navigator.userAgent);
  if (embedded) document.documentElement.classList.add('embedded-browser');
  const style = document.createElement('style');
  style.textContent = `html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
  @media(max-width:700px){input,textarea,select{font-size:16px!important}dialog{max-width:calc(100vw - 24px);max-height:calc(var(--visual-height,100svh) - 24px)}}
  .embedded-browser video{ -webkit-transform:translateZ(0) }
  @media(max-width:700px){.embedded-browser header button{ -webkit-backdrop-filter:none;backdrop-filter:none }}
  `;
  document.head.append(style);
  const prepare = video => {
    video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
    if (video.hasAttribute('muted')) {video.muted=true;video.defaultMuted=true;}
  };
  const videos = [...document.querySelectorAll('video')];videos.forEach(prepare);
  // Retry blocked muted loops only on a real gesture or returning to the app.
  const resume = () => {
    if(document.hidden)return;
    videos.forEach(video => {
      const r=video.getBoundingClientRect();
      if(video.muted && (video.loop || video.autoplay) && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth && video.getAttribute('src')) {
        const attempt=video.play();if(attempt)attempt.catch(()=>{});
      }
    });
  };
  document.addEventListener('pointerup',resume,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)videos.forEach(v=>{if(v.muted && (v.loop||v.autoplay))v.pause()});else resume()});
  window.addEventListener('pageshow',resume);
})();
