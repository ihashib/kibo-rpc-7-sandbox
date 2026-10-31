// three.js r128 and OrbitControls, loaded the first time the 3D view is needed. They are files of this project, found next to the
// script (../vendor/ from dist/kibo-nav-sandbox.js), so the tool needs no other site, whatever folder of a website it is put in.
// Run as a module or a bundle with no script tag (no address to go by), it falls back to the CDNs.
const HERE = typeof document !== 'undefined' && document.currentScript ? (document.currentScript as HTMLScriptElement).src : '';
const THREE_URL = HERE ? new URL('../vendor/three.min.js', HERE).href : 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_URL = HERE ? new URL('../vendor/OrbitControls.js', HERE).href : 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
// The exact files (they match the npm package): a CDN that was broken into could otherwise run anything here, tokens in reach.
const THREE_HASH = 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu';
const ORBIT_HASH = 'sha384-wagZhIFgY4hD+7awjQjR4e2E294y6J2HSnd8eTNc15ZubTeQeVRZwhQJ+W6hnBsf';
import type { Three } from './types.js';
import { L } from '../i18n.js';

let threePromise: Promise<Three | undefined> | null = null;

function loadScript(src: string, hash: string) {
  return new Promise<void>(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous'; s.integrity = hash;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error(L('Could not load ', 'লোড করা গেল না: ') + src)); };
    document.head.appendChild(s);
  });
}

function ensureThree(): Promise<Three | undefined> {
  if (window.THREE && window.THREE.OrbitControls) return Promise.resolve(window.THREE);

  if (!threePromise) {
    threePromise = (window.THREE ? Promise.resolve() : loadScript(THREE_URL, THREE_HASH))
      .then(function () { return window.THREE.OrbitControls ? null : loadScript(ORBIT_URL, ORBIT_HASH); })
      .then(function () { return window.THREE; });
    threePromise.catch(function () { threePromise = null; });
  }

  return threePromise;
}

export { ensureThree };
