// Edge money formatting for display (docs/11 §3): format from BigInt minor units +
// currency code. The CANONICAL Money helper (exact splits, currency fraction digits,
// largest-remainder) lives in packages/shared/core and lands with the engine (TASK-050);
// this is display-only formatting at the UI edge.

export function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** Format signed/unsigned minor units to a localized currency string (abs value). */
export function formatMoney(
  minorUnits: bigint,
  currency: string,
  locale = 'en-US',
): string {
  const fractionDigits = 2; // shell default; per-currency digits handled by the canonical helper later
  const major = Number(absBigInt(minorUnits)) / 10 ** fractionDigits;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major);
}
