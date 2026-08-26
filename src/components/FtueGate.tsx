import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { useSession } from "../lib/auth-client";
import { clearFtueCompletedLocally, isFtueCompletedLocally, markFtueCompletedLocally } from "../lib/ftue";
import { setIosMapTouchCaptureSuspended } from "../lib/native/ios-map-touch-suspend";
import { getNativePlatform } from "../lib/platform";
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

  useEffect(() => {
    const ftueActive = showFtue && !checking && !skipFtueForRoute
    if (ftueActive) {
      document.documentElement.setAttribute("data-ftue-active", "1");
    } else {
      document.documentElement.removeAttribute("data-ftue-active");
    }

    if (getNativePlatform() !== "ios") {
      return () => {
        document.documentElement.removeAttribute("data-ftue-active");
      };
    }

    if (!ftueActive) {
      void setIosMapTouchCaptureSuspended(false);
      return () => {
        document.documentElement.removeAttribute("data-ftue-active");
      };
    }

    void setIosMapTouchCaptureSuspended(true);
    const resync = window.setInterval(() => {
      void setIosMapTouchCaptureSuspended(true);
    }, 400);

    return () => {
      clearInterval(resync);
      document.documentElement.removeAttribute("data-ftue-active");
      void setIosMapTouchCaptureSuspended(false);
    };
  }, [checking, showFtue, skipFtueForRoute]);

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

  const ftueOverlay =
    !checking && showFtue && !skipFtueForRoute ? (
      <FtueOverlay onComplete={() => void completeFtue()} />
    ) : null;

  return (
    <FtueContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" && ftueOverlay
        ? createPortal(ftueOverlay, document.body)
        : null}
    </FtueContext.Provider>
  );
}
