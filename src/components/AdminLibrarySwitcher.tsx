'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { switchAdminLibrary } from '@/app/actions/admin-actions';
import { Building2, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MinimalLibrary = {
  id: string;
  name: string;
};

interface AdminLibrarySwitcherProps {
  libraries: MinimalLibrary[];
  activeLibraryId: string;
}

export function AdminLibrarySwitcher({ libraries, activeLibraryId }: AdminLibrarySwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSelect(id: string | null) {
    if (!id || id === activeLibraryId) return;
    
    startTransition(async () => {
      try {
        await switchAdminLibrary(id);
        router.refresh();
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div className="w-full relative mt-4">
      <Select value={activeLibraryId} onValueChange={handleSelect} disabled={isPending}>
        <SelectTrigger className="w-full bg-background border-border flex items-center gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin shrink-0 text-muted-foreground" /> : <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />}
          <div className="flex-1 text-left truncate">
            <SelectValue placeholder="Select Library" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {libraries.map((lib) => (
            <SelectItem key={lib.id} value={lib.id}>
              {lib.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
