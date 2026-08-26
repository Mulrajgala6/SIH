"use client";

/**
 * Authentication context for DAKSYNC.
 *
 * Holds the current user + bearer token, persists them to localStorage, and
 * exposes `login` / `logout`. `RequireRole` guards a page: it waits for
 * hydration, redirects unauthenticated visitors to `/login`, and shows a
 * friendly "not authorized" panel when the role does not match.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login as apiLogin, getMe, type Role, type UserOut } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Spinner } from "@/components/Spinner";

const TOKEN_STORAGE_KEY = "daksync_token";
const USER_STORAGE_KEY = "daksync_user";

export interface AuthContextValue {
  user: UserOut | null;
  token: string | null;
  /** True once we have attempted to restore the session from localStorage. */
  ready: boolean;
  login: (email: string, password: string) => Promise<UserOut>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Restore session after mount.
  useEffect(() => {
    try {
      const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as UserOut);
        // Best-effort refresh of the profile; silently drop an invalid token.
        getMe(storedToken)
          .then((fresh) => {
            setUser(fresh);
            window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
          })
          .catch(() => {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(USER_STORAGE_KEY);
            setToken(null);
            setUser(null);
          });
      }
    } catch {
      /* corrupt storage — ignore */
    } finally {
      setReady(true);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<UserOut> => {
      const res = await apiLogin(email, password);
      setToken(res.access_token);
      setUser(res.user);
      try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, res.access_token);
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      } catch {
        /* ignore */
      }
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, ready, login, logout }),
    [user, token, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/**
 * Route guard. Renders children only when a signed-in user holds one of the
 * allowed roles. Redirects to /login when unauthenticated; shows a
 * "not authorized" panel when the role is wrong.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        {t("guard.redirecting")}
      </div>
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">
          {t("guard.notAuthorizedTitle")}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("guard.notAuthorizedDesc")}
        </p>
        <Link
          href="/"
          className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t("guard.goHome")}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
