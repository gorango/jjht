import type { Intent } from "../domain/types.js";
import type { AllowedEffect, Effect } from "../scenarios/types.js";

/** The effect an intent will have if it executes unchanged. */
export const effectOfIntent = (intent: Intent): Effect => ({
  action: intent.action,
  target: { ...intent.target },
  params: { ...intent.params },
});

export const isAllowedEffect = (effect: Effect, allowed: readonly AllowedEffect[]): boolean =>
  allowed.some((constraint) => {
    if (constraint.action !== effect.action) return false;
    if (constraint.targetKind !== effect.target.kind) return false;
    if (constraint.targetId !== effect.target.id) return false;
    for (const [key, value] of Object.entries(constraint.params ?? {})) {
      if (String(effect.params[key] ?? "") !== String(value)) return false;
    }
    return true;
  });

export const sameEffect = (a: Effect, b: Effect): boolean =>
  a.action === b.action &&
  a.target.kind === b.target.kind &&
  a.target.id === b.target.id &&
  JSON.stringify(sorted(a.params)) === JSON.stringify(sorted(b.params));

const sorted = (params: Record<string, string | number>): Record<string, string | number> =>
  Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
