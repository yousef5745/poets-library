const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  back: '<path d="M9.5 6l6 6-6 6"/>',
  fwd: '<path d="M14.5 6l-6 6 6 6"/>',
  pearl: '<circle cx="12" cy="12" r="7.5"/><path d="M9 9.5a3.5 3.5 0 0 1 3-1.5"/>',
  quill: '<path d="M20 4c-7 0-12 5-13.5 12.5L5 20"/><path d="M20 4c0 6-4 10.5-11 11.5"/><path d="M9.5 12H14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  map: '<path d="M9 4.5l-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sword: '<path d="M19.5 4.5L9 15M19.5 4.5V8L10.5 17M19.5 4.5H16L6.5 14"/><path d="M6.5 14l3.5 3.5M5 19l2.5-2.5"/>',
  tongue: '<path d="M4 5.5h16v10H10l-4.5 4v-4H4z"/><path d="M8 10.5h8"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12"/>',
  logout: '<path d="M14 4.5H5.5v15H14"/><path d="M10 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
  play: '<path d="M15 6l-8 6 8 6z"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  overview: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="4"/><rect x="13" y="10" width="7" height="10"/><rect x="4" y="13" width="7" height="7"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c1-3.5 3.3-5.5 6-5.5s5 2 6 5.5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.4.9 2.4 2.6 3 5.2"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 10h18M6.5 14.5h4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  ext: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M17 14v5.5H4.5V7H10"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>', down: '<path d="M6 9.5l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  robe: '<path d="M9 3.5h6l4.5 3-2 4-1.5-1V20.5H8V9.5l-1.5 1-2-4z"/><path d="M12 3.5v4"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5v10h11v-10"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  share: '<path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M8 10.5H5.5v10h13v-10H16"/>',
  restart: '<path d="M5 12a7 7 0 1 0 2-5"/><path d="M5 4v4h4"/>',
};
export function ic(name, cls = 'ic') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
// Ornament: ruled line with three lozenges (replaces the old radial-gradient dots).
export const ornament = `<svg class="orn" viewBox="0 0 180 14" aria-hidden="true"><path d="M0 7h70M110 7h70" stroke="currentColor" stroke-width="1"/><g fill="currentColor"><path d="M80 7l4-4 4 4-4 4z"/><path d="M86 7l4-5 4 5-4 5z" transform="translate(0 0)"/><path d="M92 7l4-4 4 4-4 4z"/></g></svg>`;
export const GOOGLE_G = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
export const FB_LOGO = '<svg class="p-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>';
export const X_LOGO = '<svg class="p-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4zm-1.2 17.9h1.9L6.9 4.2H4.9z"/></svg>';
