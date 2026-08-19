import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";

type VenueTrustBadgeProps = {
  ownerId?: string;
  className?: string;
  /** En cards del listado, solo se muestra el check verificado. */
  showUnclaimed?: boolean;
};

const HOVER_DESKTOP_MQ =
  "(min-width: 992px) and (hover: hover) and (pointer: fine)";

function isHoverDesktop() {
  return window.matchMedia(HOVER_DESKTOP_MQ).matches;
}

function stopCardNav(event: MouseEvent | PointerEvent) {
  event.stopPropagation();
}

function popoverStyle(trigger: HTMLElement | null): CSSProperties {
  if (!trigger) return {};
  const rect = trigger.getBoundingClientRect();
  const pad = 12;
  const width = Math.min(272, window.innerWidth * 0.78);
  const half = width / 2;
  const left = Math.min(
    window.innerWidth - pad - half,
    Math.max(pad + half, rect.left + rect.width / 2)
  );
  return {
    ["--trust-top" as string]: `${rect.bottom}px`,
    ["--trust-left" as string]: `${left}px`,
  };
}

export function VenueTrustBadge({
  ownerId,
  className = "",
  showUnclaimed = true,
}: VenueTrustBadgeProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const verified = Boolean(ownerId);
  const visible = open || hovering;
  const classes = `venue-trust-badge${className ? ` ${className}` : ""}`;

  const syncPos = useCallback(() => {
    setStyle(popoverStyle(triggerRef.current));
  }, []);

  useEffect(() => {
    if (!visible) return;
    syncPos();
    const onWin = () => syncPos();
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("resize", onWin);
    };
  }, [visible, syncPos]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (isHoverDesktop()) return;
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia(HOVER_DESKTOP_MQ);
    const onChange = () => {
      setOpen(false);
      setHovering(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!verified && !showUnclaimed) return null;

  if (verified) {
    return (
      <span
        className={`${classes} is-verified`}
        aria-label="Organizador verificado"
        title="Organizador verificado"
      >
        <i className="bi bi-patch-check-fill" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      ref={rootRef}
      className={`${classes} is-unclaimed venue-trust-help${visible ? " is-open" : ""}`}
      onClick={stopCardNav}
      onPointerDown={stopCardNav}
      onPointerEnter={() => {
        syncPos();
        if (isHoverDesktop()) setHovering(true);
      }}
      onPointerLeave={() => {
        if (isHoverDesktop()) setHovering(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="venue-trust-help-trigger"
        aria-label="Este espacio aún no tiene organizador en Nocta"
        aria-expanded={visible}
        onClick={(event) => {
          stopCardNav(event);
          if (isHoverDesktop()) return;
          setOpen((value) => !value);
        }}
      >
        <i className="bi bi-patch-question-fill" aria-hidden="true" />
      </button>
      <span className="venue-trust-help-popover" role="tooltip" style={style}>
        Si sos el organizador de este espacio y querés administrarlo en Nocta,
        completá el formulario al pie de tu perfil.
      </span>
    </span>
  );
}
