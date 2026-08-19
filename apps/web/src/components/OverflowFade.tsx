import {
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { useOverflowFade } from "../hooks/useOverflowFade";

function assignRef<T>(ref: Ref<T | null> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as RefObject<T | null>).current = value;
}

type OverflowFadeProps = {
  axis?: "y" | "x";
  className?: string;
  fadeClassName?: string;
  scrollRef?: Ref<HTMLDivElement | null>;
  children: ReactNode;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "style" | "children">;

export function OverflowFade({
  axis = "y",
  className,
  fadeClassName,
  scrollRef,
  children,
  style,
  ...scrollProps
}: OverflowFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasMore = useOverflowFade(ref, axis);
  const moreClass = axis === "x" ? "has-more-end" : "has-more-below";

  return (
    <div
      className={[
        "nocta-scroll-fade",
        axis === "x" ? "is-x" : undefined,
        hasMore ? moreClass : undefined,
        fadeClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <div
        {...scrollProps}
        ref={(node) => {
          ref.current = node;
          assignRef(scrollRef, node);
        }}
        className={["nocta-scroll", axis === "x" ? "is-x" : undefined, className]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
