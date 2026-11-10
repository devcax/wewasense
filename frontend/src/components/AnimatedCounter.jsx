import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

export default function AnimatedCounter({ value, decimals = 0, suffix = "" }) {
  const elementRef = useRef(null);
  const previousValue = useRef(0);

  useEffect(() => {
    if (value === null || value === undefined || !elementRef.current) {
      return undefined;
    }
    const controls = animate(previousValue.current, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (elementRef.current) {
          elementRef.current.textContent = `${latest.toFixed(decimals)}${suffix}`;
        }
      },
    });
    previousValue.current = value;
    return () => controls.stop();
  }, [value, decimals, suffix]);

  return <span ref={elementRef}>{value === null || value === undefined ? "–" : `0${suffix}`}</span>;
}
