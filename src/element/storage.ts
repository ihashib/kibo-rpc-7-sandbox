// localStorage, never throwing (private mode or blocked storage just means nothing is kept).
const STORE_PREFIX = 'kibo-nav-sandbox:';
function storeGet(key: string): any { try { const s = window.localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function storeSet(key: string, val: unknown): boolean { try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
function storeDel(key: string): void { try { window.localStorage.removeItem(key); } catch (e) { /* storage blocked */ } }

export { STORE_PREFIX, storeDel, storeGet, storeSet };
