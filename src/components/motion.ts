import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';

// Shared animation tokens — GPU-friendly tweens (transform + opacity only).
//
// Why tweens over springs: springs re-solve physics on the JS thread every
// frame until they settle, and overshoot keeps repainting (blur/shadow-heavy
// cards jank on phones, especially with the 500ms-ticking player subtree).
// Short expo-out tweens settle in a fixed frame budget, feel Apple-smooth,
// and cost a fraction of the CPU. Overshoot "pop" is faked with a gentle
// back-ease cubic — no physics simulation needed.
export const easeApple = [0.22, 1, 0.36, 1] as const;
export const easePop = [0.34, 1.35, 0.64, 1] as const;

export const durFast = 0.16;
export const durSnappy = 0.18;
export const durMed = 0.22;
export const durGentle = 0.28;

// General UI (drawers, backdrops, panels, dock).
export const springFast: Transition = {
  type: 'tween',
  duration: durMed,
  ease: easeApple,
};

// Micro-interactions (icons, pills, taps).
export const springSnappy: Transition = {
  type: 'tween',
  duration: durSnappy,
  ease: easeApple,
};

export const fadeDuration = 0.16;

// Soft entrance for cards and hero blocks.
export const springGentle: Transition = {
  type: 'tween',
  duration: durGentle,
  ease: easeApple,
};

// Pop for badges, dots and small celebratory bits (subtle overshoot, no spring).
export const springBouncy: Transition = {
  type: 'tween',
  duration: 0.3,
  ease: easePop,
};

// Press feedback shared by all tappable rows/cards/buttons.
export const pressTap = { scale: 0.97 } as const;

// Stagger helper — tight + capped so lists feel instant, not wavy.
// Only the first few rows stagger; the rest appear together (cheap + fast).
export function staggerDelay(index: number, step = 0.03, max = 0.18): number {
  return Math.min(index * step, max);
}

// Tab views unmount/remount on every tab switch (AnimatePresence keyed by
// tab). Replaying the full entrance choreography on each revisit reads as a
// "double blink": container fade first, then the staggered list wave after.
// Gate entrances to the first mount per view so revisits appear instantly.
const introPlayedKeys = new Set<string>();
export function useIntroPlayed(key: string): boolean {
  const [intro] = useState(() => !introPlayedKeys.has(key));
  useEffect(() => {
    introPlayedKeys.add(key);
  }, [key]);
  return intro;
}

// Wrapper around motion's hook so callers don't deal with `null`.
export function useAppReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

// Honor reduced-motion: instant (no transform) when the user prefers it.
export function tx(reduced: boolean, t: Transition = springFast): Transition {
  return reduced ? { duration: 0 } : t;
}
