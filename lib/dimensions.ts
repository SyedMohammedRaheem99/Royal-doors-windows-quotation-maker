/**
 * Site measurements are recorded in millimetres and billed in decimal feet,
 * snapped to 0.5 ft steps. Reverse-engineered from `_reference/Royal - March.xlsx`
 * (see the mm -> billed-feet table mined across all 76 sheets). There is no
 * formula for this in the source workbooks — operators round by hand, and their
 * own rounding is inconsistent at the boundaries (1715mm -> 5.5ft but 1750mm ->
 * 6.0ft on the same sheet). This function is a best-effort suggestion; the
 * builder UI must always let the user override the result.
 */

const MM_PER_FOOT = 304.8;

export function mmToFeet(mm: number): number {
  return mm / MM_PER_FOOT;
}

export function snapToHalfFoot(feet: number): number {
  return Math.round(feet * 2) / 2;
}

/**
 * Applies the observed floor behaviour for small openings:
 * true ft <= 1.1  -> billed 1.0
 * true ft <= 2.0  -> billed 2.0
 * above that, snap to the nearest 0.5 ft with no floor.
 */
export function suggestBilledFeet(mm: number): number {
  const trueFeet = mmToFeet(mm);
  if (trueFeet <= 1.1) return 1.0;
  if (trueFeet <= 2.0) return 2.0;
  return snapToHalfFoot(trueFeet);
}

/**
 * Billed dimensions are always whole or half feet, so the inch part is always
 * 0" or 6" — this is a plain unit conversion, not a second rounding step.
 * "5'-6\"" reads naturally on a diagram; decimal feet don't.
 */
export function feetToArchLabel(feet: number): string {
  const whole = Math.floor(feet);
  const inches = Math.round((feet - whole) * 12);
  return inches === 0 ? `${whole}'-0"` : `${whole}'-${inches}"`;
}
