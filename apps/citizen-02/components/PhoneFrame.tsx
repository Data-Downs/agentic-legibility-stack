"use client";

import { useEffect, useState } from "react";

/**
 * Wraps the app in an iPhone-style device frame on desktop viewports.
 * On mobile (<768px) the frame disappears and the app renders full-screen.
 *
 * Uses an iframe on desktop to provide true viewport containment —
 * position:fixed elements naturally pin to the iframe boundaries.
 */

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();

  // On mobile or during SSR, render children directly
  if (!isDesktop) {
    return <>{children}</>;
  }

  // On desktop, wrap in phone frame with children rendered inside
  return (
    <div className="phone-frame-wrapper">
      <div className="phone-frame-device">
        <div className="phone-frame-island" />
        <div className="phone-frame-screen">
          {children}
        </div>
        <div className="phone-frame-home-indicator">
          <div className="phone-frame-home-bar" />
        </div>
      </div>
    </div>
  );
}
