import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';

// Shared animation tokens — subtle & fast (Apple-like, 150–250ms feel).
// Transform + opacity only; never animate layout-affecting props inside
// the 500ms-ticking player subtree (re-render churn would jank springs).
export const springFast: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.6,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 700,
  damping: 32,
  mass: 0.5,
};

export const fadeDuration = 0.16;

// Soft, floaty entrance for cards and hero blocks.
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.8,
};

// Playful pop for badges, dots and small celebratory bits.
export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 550,
  damping: 16,
  mass: 0.55,
};

// Press feedback shared by all tappable rows/cards/buttons.
export const pressTap = { scale: 0.97 } as const;

// Stagger helper — cap per-index delay so long lists still feel instant.
export function staggerDelay(index: number, step = 0.045, max = 0.35): number {
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
