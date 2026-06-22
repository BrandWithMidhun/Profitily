'use client';

import { Store } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getStubStores } from '@/lib/session';

// STUB(TASK-010/011): static stores; switching is local-only until the membership API.
export function StoreSwitcher() {
  const stores = getStubStores();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');

  return (
    <Select value={storeId} onValueChange={setStoreId}>
      <SelectTrigger className="w-[12rem]" aria-label="Switch store">
        <span className="flex items-center gap-2 truncate">
          <Store className="size-4 shrink-0 opacity-70" aria-hidden="true" />
          <SelectValue placeholder="Select store" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
