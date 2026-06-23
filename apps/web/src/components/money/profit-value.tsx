import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

type Tone = 'profit' | 'loss' | 'neutral';

function tone(minorUnits: bigint): Tone {
  if (minorUnits > 0n) return 'profit';
  if (minorUnits < 0n) return 'loss';
  return 'neutral';
}

function toneClass(t: Tone): string {
  switch (t) {
    case 'profit':
      return 'text-profit';
    case 'loss':
      return 'text-loss';
    default:
      return 'text-muted-foreground';
  }
}

export interface ProfitValueProps {
  /** Signed minor units. Negative = loss. */
  minorUnits: bigint;
  currency: string;
  className?: string;
}

/**
 * Profit/loss money display. A11y contract (docs/11 §3/§6 — bind-down 1): meaning is
 * carried by SIGN (+/−, visible) + LABEL (profit/loss, screen-reader text) + colour —
 * NEVER colour alone. Tabular figures for column alignment.
 */
export function ProfitValue({
  minorUnits,
  currency,
  className,
}: ProfitValueProps) {
  const t = tone(minorUnits);
  const sign = t === 'profit' ? '+' : t === 'loss' ? '−' : '';
  const label = t === 'profit' ? 'profit' : t === 'loss' ? 'loss' : 'break-even';
  const amount = formatMoney(minorUnits, currency);

  return (
    <span className={cn('tabular-money font-medium', toneClass(t), className)}>
      <span aria-hidden="true">
        {sign}
        {amount}
      </span>
      <span className="sr-only">
        {amount} {label}
      </span>
    </span>
  );
}

export interface DeltaProps {
  /** Signed change in minor units. */
  minorUnits: bigint;
  currency: string;
  className?: string;
}

/**
 * Period-over-period change. Same a11y contract as ProfitValue: sign + label
 * (increase/decrease/no change) + colour, never colour alone.
 */
export function Delta({ minorUnits, currency, className }: DeltaProps) {
  const t = tone(minorUnits);
  const sign = t === 'profit' ? '+' : t === 'loss' ? '−' : '';
  const label =
    t === 'profit' ? 'increase' : t === 'loss' ? 'decrease' : 'no change';
  const amount = formatMoney(minorUnits, currency);

  return (
    <span className={cn('tabular-money text-sm font-medium', toneClass(t), className)}>
      <span aria-hidden="true">
        {sign}
        {amount}
      </span>
      <span className="sr-only">
        {amount} {label}
      </span>
    </span>
  );
}
