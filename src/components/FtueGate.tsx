import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSession } from "../lib/auth-client";
import { clearFtueCompletedLocally, isFtueCompletedLocally, markFtueCompletedLocally } from "../lib/ftue";
import { completeTutorial, fetchProfile, resetTutorial as resetTutorialApi } from "../lib/profile-api";
import { FtueOverlay } from "./FtueOverlay";

type FtueContextValue = {
  resetTutorial: () => Promise<void>;
};

const FtueContext = createContext<FtueContextValue | null>(null);

const FTUE_SKIP_PATHS = new Set(["/reset-password"]);

export function useFtue() {
  const context = useContext(FtueContext);
  if (!context) {
    throw new Error("useFtue must be used within FtueGate");
  }
  return context;
}

export function FtueGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const userId = session.data?.user.id;
  const [checking, setChecking] = useState(true);
  const [showFtue, setShowFtue] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  const skipFtueForRoute = FTUE_SKIP_PATHS.has(pathname) || pathname.startsWith("/crew/invite/");

  useEffect(() => {
    let cancelled = false;

    const resolveFtueState = async () => {
      if (skipFtueForRoute) {
        if (!cancelled) {
          setShowFtue(false);
          setChecking(false);
        }
        return;
      }

      if (forceShow) {
        if (!cancelled) {
          setShowFtue(true);
          setChecking(false);
        }
        return;
      }

      if (userId) {
        try {
          const profile = await fetchProfile();
          if (cancelled) return;
          if (profile.tutorialCompleted) {
            markFtueCompletedLocally();
            setShowFtue(false);
          } else {
            setShowFtue(true);
          }
        } catch {
          if (cancelled) return;
          setShowFtue(!isFtueCompletedLocally());
        } finally {
          if (!cancelled) setChecking(false);
        }
        return;
      }

      if (!cancelled) {
        setShowFtue(!isFtueCompletedLocally());
        setChecking(false);
      }
    };

    setChecking(true);
    void resolveFtueState();

    return () => {
      cancelled = true;
    };
  }, [forceShow, skipFtueForRoute, userId]);

  const completeFtue = useCallback(async () => {
    markFtueCompletedLocally();
    setShowFtue(false);
    setForceShow(false);

    try {
      await completeTutorial();
    } catch {
      // Expected when offline or not signed in yet.
    }
  }, []);

  const resetTutorial = useCallback(async () => {
    clearFtueCompletedLocally();
    setForceShow(true);
    setShowFtue(true);

    if (userId) {
      try {
        await resetTutorialApi();
      } catch {
        // Local reset still shows the tutorial on this device.
      }
    }
  }, [userId]);

  const value = useMemo(() => ({ resetTutorial }), [resetTutorial]);

  return (
    <FtueContext.Provider value={value}>
      {children}
      {!checking && showFtue && !skipFtueForRoute && <FtueOverlay onComplete={() => void completeFtue()} />}
    </FtueContext.Provider>
  );
}
