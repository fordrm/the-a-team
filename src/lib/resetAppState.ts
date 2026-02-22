const APP_STATE_KEYS = [
  "activeGroupId",
  "selectedGroupId",
  "activePersonId",
  "selectedPersonId",
];

// Match the localStorage keys used by person selector (activePerson_*)
const PERSON_SELECTOR_PREFIX = "activePerson_";

export function resetAppState() {
  // Clear known app state keys
  for (const key of APP_STATE_KEYS) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  // Clear all person selector keys from localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PERSON_SELECTOR_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (_) {}

  // Clear sessionStorage person selector keys too
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PERSON_SELECTOR_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      sessionStorage.removeItem(key);
    }
  } catch (_) {}
}
