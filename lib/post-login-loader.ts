/** Bridges login success → dashboard with a premium loading moment. */
export const POST_LOGIN_LOADER_KEY = "bqi.showPostLoginLoader";

/** Minimum time the loader stays up after login so status phrases are visible. */
export const POST_LOGIN_LOADER_MIN_MS = 1200;

/** Brief settle time when auth hydrates from cache (otherwise a single frame). */
export const AUTH_SETTLE_LOADER_MIN_MS = 600;

export function markPostLoginLoader(): void {
  try {
    sessionStorage.setItem(POST_LOGIN_LOADER_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

export function hasPostLoginLoaderFlag(): boolean {
  try {
    return sessionStorage.getItem(POST_LOGIN_LOADER_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPostLoginLoaderFlag(): void {
  try {
    sessionStorage.removeItem(POST_LOGIN_LOADER_KEY);
  } catch {
    /* ignore */
  }
}
