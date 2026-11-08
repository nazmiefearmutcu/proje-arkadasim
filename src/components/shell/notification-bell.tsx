"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/styles";
import type { Counters } from "@/lib/counters";
import { cn } from "@/lib/cn";
import { useCounters } from "./use-counters";

export interface NotificationBellProps {
  initial: Counters | null;
}

/** Bildirim zili (44 px). Misafir girişe yönlenir; oturum açıksa okunmamış sayı rozeti gösterilir. */
export function NotificationBell({ initial }: NotificationBellProps) {
  const counters = useCounters(initial);
  const signedIn = initial !== null;
  const unread = counters?.notifications ?? 0;

  return (
    <Link
      href={signedIn ? "/bildirimler" : "/giris?next=/bildirimler"}
      aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2",
        focusRing,
      )}
    >
      <Bell aria-hidden="true" strokeWidth={1.75} className="size-5" />
      <Badge count={unread} className="absolute top-1 right-0.5" />
    </Link>
  );
}
