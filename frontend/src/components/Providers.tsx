"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

/**
 * Client-side context providers, mounted once in the root layout.
 * I18n wraps Auth because the RequireRole guard reads translations.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  );
}
