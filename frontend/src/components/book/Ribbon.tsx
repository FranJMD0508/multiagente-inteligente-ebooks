"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Cinta marcapáginas. Solo marca "Tu turno" (docs/07 §2.6).
 * Al aparecer cae desde el borde de la página (~300 ms).
 */
export function Ribbon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <motion.span
      aria-hidden
      className={cn("cinta", className)}
      style={{ transformOrigin: "top", ...style }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
    />
  );
}
