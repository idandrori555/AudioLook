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

// Press feedback shared by all tappable rows/cards/buttons.
export const pressTap = { scale: 0.97 } as const;

// Wrapper around motion's hook so callers don't deal with `null`.
export function useAppReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

// Honor reduced-motion: instant (no transform) when the user prefers it.
export function tx(reduced: boolean, t: Transition = springFast): Transition {
  return reduced ? { duration: 0 } : t;
}
