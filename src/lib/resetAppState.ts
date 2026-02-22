const APP_STATE_KEYS = [
  "activeGroupId",
  "selectedGroupId",
  "activePersonId",
  "selectedPersonId",
];

export function resetAppState() {
  for (const key of APP_STATE_KEYS) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  }
}
