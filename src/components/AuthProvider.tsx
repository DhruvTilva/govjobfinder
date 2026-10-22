"use client";

import { createContext, useContext } from "react";

type Auth = { enabled: boolean; userId: number | null };
const Ctx = createContext<Auth>({ enabled: false, userId: null });

/** Tells client components whether login is configured and who is logged in. */
export function AuthProvider({ enabled, userId, children }: Auth & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ enabled, userId }}>{children}</Ctx.Provider>;
}

/** `loginRequired`: saving needs an account (login is configured and nobody is logged in). */
export function useAuth() {
  const { enabled, userId } = useContext(Ctx);
  return { enabled, userId, loginRequired: enabled && !userId };
}
