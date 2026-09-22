import { useEffect, useRef } from "react";

/**
 * Mobile-Komfort: Die Bildschirmtastatur schließt sich, sobald der Nutzer
 * scrollt oder außerhalb des Suchfeldes tippt. Der eingegebene Text bleibt
 * erhalten — es wird nur der Fokus aufgehoben.
 */
export function useDismissKeyboard<T extends HTMLElement = HTMLInputElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    function blurIfFocused() {
      const el = ref.current;
      if (el && document.activeElement === el) el.blur();
    }

    function onTouchStart(event: TouchEvent) {
      const el = ref.current;
      if (!el || document.activeElement !== el) return;
      const target = event.target as Node | null;
      if (target && el.contains(target)) return;
      el.blur();
    }

    window.addEventListener("scroll", blurIfFocused, { passive: true, capture: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      window.removeEventListener("scroll", blurIfFocused, true);
      document.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return ref;
}
