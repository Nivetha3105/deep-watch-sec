const SESSION_KEY = "sentinel_analyst_session";

export type AnalystSession = {
  email: string;
  label: string;
  signedInAt: string;
};

export function getDemoSession(): AnalystSession | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as AnalystSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function signInDemo(email: string, remember = true): AnalystSession {
  const session: AnalystSession = {
    email,
    label: "Analyst",
    signedInAt: new Date().toISOString(),
  };
  const storage = remember ? window.localStorage : window.sessionStorage;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function signOutDemo() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  }
}