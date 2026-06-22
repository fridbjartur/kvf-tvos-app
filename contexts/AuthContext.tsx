import { isAuthenticated, subscribeAuthChange, waitForConfig } from "@/services/jellyfinApi";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

interface AuthContextType {
  /** True when a Jellyfin session is present (server + token + user id). */
  isConnected: boolean;
  /** True once the initial async config read has resolved (avoids a first-render flash). */
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Resolve the saved session once at launch, then keep in sync with login/logout.
    waitForConfig().then(() => {
      if (cancelled) return;
      setIsConnected(isAuthenticated());
      setIsReady(true);
    });

    const unsubscribe = subscribeAuthChange(() => setIsConnected(isAuthenticated()));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ isConnected, isReady }), [isConnected, isReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
