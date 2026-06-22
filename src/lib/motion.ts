// ============================================================
// NEXORA — Motion System
// Lightweight motion tokens for premium movement without hurting UX.
// ============================================================

export const motionDurations = {
  quick: 0.18,
  normal: 0.28,
  slow: 0.42,
};

export const motionEase = [0.25, 0.46, 0.45, 0.94] as const;

export const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: motionDurations.normal, ease: motionEase },
};

export const softScale = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: motionDurations.normal, ease: motionEase },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};
