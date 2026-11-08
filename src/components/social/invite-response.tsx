"use client";

import { Button } from "@/components/ui/button";
import { useRunAction } from "@/components/projects/use-run-action";
import { respondToInviteAction } from "@/lib/projects/actions";

export interface InviteResponseProps {
  inviteId: string;
}

/** Gelen proje davetine Kabul et / Reddet yanıtı. */
export function InviteResponse({ inviteId }: InviteResponseProps) {
  const { isPending, error, run } = useRunAction();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button className="flex-1" disabled={isPending} onClick={() => run(() => respondToInviteAction(inviteId, "ACCEPT"))}>
          Kabul et
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          disabled={isPending}
          onClick={() => run(() => respondToInviteAction(inviteId, "DECLINE"))}
        >
          Reddet
        </Button>
      </div>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
