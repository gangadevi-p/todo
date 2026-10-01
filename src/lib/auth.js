// Local sign-in for the personal space. Only a salted PBKDF2 hash is stored
// (in the user data folder under Electron, localStorage in a plain browser).
// There is no server: this keeps the app private on screen, it is not
// encryption of the data file.

const bridge = typeof window !== 'undefined' ? window.nudge : undefined;
const LS_KEY = 'nudge:auth:v1';
const ITERATIONS = 210000;
const enc = new TextEncoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toB64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations }, key, 256));
}

const same = (a, b) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const clean = (name) => name.trim().toLowerCase();

/** The deployed website: opens on the demo, with an "Owner sign in" link (#owner) to the personal space. */
export const publicWeb = !bridge && !import.meta.env.DEV;

/** Every build can sign in; the public web build just starts on the demo instead of the sign-in screen. */
export const authEnabled = true;

export async function getAuth() {
  if (bridge) return bridge.authGet();
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
}

export async function createAuth(username, password) {
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const cred = { username: username.trim(), salt, iterations: ITERATIONS, hash: await derive(password, salt, ITERATIONS) };
  if (bridge) return bridge.authSet(cred);
  try { localStorage.setItem(LS_KEY, JSON.stringify(cred)); return true; } catch { return false; }
}

export async function verifyAuth(auth, username, password) {
  const hash = await derive(password, auth.salt, auth.iterations || ITERATIONS);
  return clean(username) === clean(auth.username) && same(hash, auth.hash);
}

// "Keep me signed in": after a successful login the device remembers it for a
// while, so a refresh or relaunch opens the personal space without asking for
// the password again. The saved login itself is unchanged. Signing out forgets it.
const SESSION_KEY = 'nudge:session:v1';
const SPACE_KEY = 'nudge:space:v1'; // per tab: lets a refresh stay in the demo
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function rememberSession() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ until: Date.now() + SESSION_MS })); } catch {}
}

export function hasSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return Boolean(s) && s.until > Date.now();
  } catch { return false; }
}

export function endSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function setOpenSpace(space) {
  try { sessionStorage.setItem(SPACE_KEY, space); } catch {}
}

export function openSpace() {
  try { return sessionStorage.getItem(SPACE_KEY); } catch { return null; }
}

/** Called by the sidebar button: signing out forgets the remembered login, leaving the demo just reopens the entry screen. */
export function leaveSpace(space) {
  if (space === 'owner') endSession();
  try { sessionStorage.removeItem(SPACE_KEY); } catch {}
}
