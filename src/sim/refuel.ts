/**
 * Aphelion — refuel
 *
 * Pure pricing + fill calculation for buying hyperspace fuel at a
 * docked station. The trade screen reads game state (current fuel,
 * credits, max-fuel constant), passes it through applyRefuel, then
 * applies the result.
 *
 * Caps:
 *   * Can't fill past maxFuel — fuel scoops aren't a thing yet, so
 *     a 7-LY tank stays a 7-LY tank.
 *   * Can't buy more LY than credits afford. If affording is the
 *     bottleneck, you fill what you can and keep the change.
 *   * No fractional LY sold — you buy whole light-years to keep the
 *     numbers readable on the HUD.
 */

/** Price per light-year of fuel, in credits. Elite-ish round number. */
export const FUEL_PRICE_PER_LY = 5;

export interface RefuelResult {
  /** Fuel after the purchase, in light-years. */
  readonly newFuel: number;
  /** Credits remaining after the purchase. */
  readonly newCredits: number;
  /** How many light-years were actually bought (0 if tank was full
   *  or credits insufficient for even one). */
  readonly bought: number;
}

/**
 * Buy as much fuel as possible up to a full tank, capped by what
 * the player can afford. Whole light-years only. Pure: returns a
 * new result object, never mutates inputs.
 */
export function applyRefuel(
  currentFuel: number,
  currentCredits: number,
  maxFuel: number,
): RefuelResult {
  const needed = Math.max(0, maxFuel - currentFuel);
  // Tank already full: nothing to do.
  if (needed <= 0 || currentCredits < FUEL_PRICE_PER_LY) {
    return { newFuel: currentFuel, newCredits: currentCredits, bought: 0 };
  }
  const affordable = Math.floor(currentCredits / FUEL_PRICE_PER_LY);
  // Buy whole light-years; if the deficit isn't an integer, take
  // the floor so we never overfill — change is preserved as the
  // fractional remainder still in the tank.
  const bought = Math.min(Math.floor(needed), affordable);
  return {
    newFuel:    currentFuel + bought,
    newCredits: currentCredits - bought * FUEL_PRICE_PER_LY,
    bought,
  };
}

/**
 * Cost in credits to fill the tank to max from the current state.
 * Useful for previewing the price in the UI before the player
 * commits.
 */
export function refuelCost(currentFuel: number, maxFuel: number): number {
  const need = Math.max(0, Math.floor(maxFuel - currentFuel));
  return need * FUEL_PRICE_PER_LY;
}
