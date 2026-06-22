import { isAuthenticated, subscribeAuthChange, waitForConfig } from "@/services/jellyfinApi";
import { router } from "expo-router";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  const prevConnectedRef = useRef(false);
  const wasReadyRef = useRef(false);

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

  // Route to the Library tab on a runtime login. Revealing the Search tab remounts the whole tab
  // navigator, which tears down per-screen effects mid-login (e.g. Quick Connect's polling lives in
  // a SettingsScreen effect that resets on remount), so navigation must happen here — above the
  // navigator and after the remount has committed (a passive effect runs post-commit). Guarded so
  // the initial launch resolution (false→true alongside isReady) doesn't hijack a deep link.
  useEffect(() => {
    if (wasReadyRef.current && isReady && isConnected && !prevConnectedRef.current) {
      router.navigate("/");
    }
    prevConnectedRef.current = isConnected;
    wasReadyRef.current = isReady;
  }, [isConnected, isReady]);

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
