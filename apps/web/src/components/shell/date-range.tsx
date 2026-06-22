'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Preset date-range for the shell. The full calendar picker (custom range) lands with
// the first dashboard that reads data (Phase 6) — docs/11 §5 / TASK-008 plan.
const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export function DateRange() {
  const [range, setRange] = useState('30d');

  return (
    <Select value={range} onValueChange={setRange}>
      <SelectTrigger className="w-[11rem]" aria-label="Select date range">
        <span className="flex items-center gap-2 truncate">
          <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden="true" />
          <SelectValue placeholder="Date range" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
