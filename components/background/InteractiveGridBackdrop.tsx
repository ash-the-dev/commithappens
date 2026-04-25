"use client";

import { useEffect, useRef } from "react";

type Props = {
  className?: string;
};

export function InteractiveGridBackdrop({ className = "" }: Props) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isPointerDown = false;
    let fadeTimer: number | undefined;

    function setGlowActive(active: boolean) {
      const glow = glowRef.current;

      if (!glow) {
        return;
      }

      glow.style.setProperty("--hero-pointer-opacity", active ? "1" : "0");
    }

    function updateGlow(clientX: number, clientY: number) {
      const glow = glowRef.current;

      if (!glow) {
        return false;
      }

      const rect = glow.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const isInside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;

      if (!isInside) {
        setGlowActive(false);
        return false;
      }

      window.clearTimeout(fadeTimer);
      glow.style.setProperty("--hero-pointer-x", `${x}px`);
      glow.style.setProperty("--hero-pointer-y", `${y}px`);
      setGlowActive(true);

      if (!isPointerDown) {
        fadeTimer = window.setTimeout(() => setGlowActive(false), 900);
      }

      return true;
    }

    function handlePointerDown(event: PointerEvent) {
      isPointerDown = true;
      updateGlow(event.clientX, event.clientY);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" && !isPointerDown) {
        return;
      }

      updateGlow(event.clientX, event.clientY);
    }

    function handlePointerUp(event: PointerEvent) {
      isPointerDown = false;

      if (updateGlow(event.clientX, event.clientY)) {
        fadeTimer = window.setTimeout(() => setGlowActive(false), 650);
      }
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      isPointerDown = true;
      updateGlow(touch.clientX, touch.clientY);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      updateGlow(touch.clientX, touch.clientY);
    }

    function handleTouchEnd() {
      isPointerDown = false;
      fadeTimer = window.setTimeout(() => setGlowActive(false), 650);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.clearTimeout(fadeTimer);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      <div className="absolute inset-0 hero-grid-bg" />
      <div className="absolute inset-0 hero-grid-glow" />
      <div ref={glowRef} className="absolute inset-0 hero-pointer-glow" />
    </div>
  );
}
