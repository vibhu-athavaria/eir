// Shared tab-pillar navigation helpers used by BottomNav, AppLayout, and TopNav.

export const ROOT_TABS = ['/', '/activities', '/vent', '/contacts', '/settings'];

export const SUB_PAGE_PARENT = {
  '/alternatives': '/contacts',
  '/progress': '/settings',
  '/journal': '/settings',
};

// Returns the bottom-tab pillar that owns a given route path.
export function pillarOf(path) {
  if (ROOT_TABS.includes(path)) return path;
  return SUB_PAGE_PARENT[path] || null;
}

// Last visited route path under each tab pillar (module-level, survives re-renders).
const lastPaths = {};

export function recordVisit(path) {
  const pillar = pillarOf(path);
  if (pillar) lastPaths[pillar] = path;
}

export function getLastPath(pillar) {
  return lastPaths[pillar] || pillar;
}