// React wrapper for <kibo-nav-sandbox>. Copy this file into your React app.
//
//   <KiboNavSandbox />
//   <KiboNavSandbox id="class-a" height="720px" theme="light" onRouteChange={(d) => console.log(d.route)} />
//
// `src` is where you put kibo-nav-sandbox.js (e.g. your static folder).
// Alternatively, delete loadSandbox() and just `import './kibo-nav-sandbox.js';` at the top.
import { useEffect, useRef } from 'react';

const DEFAULT_SRC = '/static/kibo/kibo-nav-sandbox.js';
let loading = null;

function loadSandbox(src) {
  if (window.customElements && window.customElements.get('kibo-nav-sandbox')) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { loading = null; reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export default function KiboNavSandbox({
  id = 'kibo-nav-sandbox',
  height = '680px',
  theme,
  configUrl,
  src = DEFAULT_SRC,
  onRouteChange,
}) {
  const ref = useRef(null);

  useEffect(() => {
    loadSandbox(src).catch((err) => console.error(err));
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onRouteChange) return undefined;
    const handler = (e) => onRouteChange(e.detail);
    el.addEventListener('routechange', handler);
    return () => el.removeEventListener('routechange', handler);
  }, [onRouteChange]);

  return <kibo-nav-sandbox ref={ref} id={id} height={height} theme={theme} config-url={configUrl} />;
}
