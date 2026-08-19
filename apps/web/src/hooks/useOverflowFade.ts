import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

const THRESHOLD = 8;

export function useOverflowFade<T extends HTMLElement>(
  ref: RefObject<T | null>,
  axis: "y" | "x" = "y"
): boolean {
  const [hasMore, setHasMore] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setHasMore(false);
      return;
    }
    if (axis === "x") {
      setHasMore(el.scrollWidth - el.scrollLeft - el.clientWidth > THRESHOLD);
      return;
    }
    setHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > THRESHOLD);
  }, [axis, ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [update]);

  return hasMore;
}
