"use client";

import { Button } from "@/components/ui/button";
import { useRunAction } from "@/components/projects/use-run-action";
import { blockUserAction, unblockUserAction } from "@/lib/social/moderation";

export interface BlockButtonProps {
  userId: string;
  /** Görüntüleyen bu kişiyi engellemişse true: düğme "Engeli kaldır" olur. */
  blocked: boolean;
}

const CONFIRM_TEXT =
  "Bu kişiyi engellemek istiyor musun? Takip ilişkileriniz kalkar ve birbirinize mesaj ya da davet gönderemezsiniz.";

/** Engelle / Engeli kaldır. Engellemeden önce onay ister. */
export function BlockButton({ userId, blocked }: BlockButtonProps) {
  const { isPending, error, run } = useRunAction();

  function onClick(): void {
    if (blocked) {
      run(() => unblockUserAction(userId));
      return;
    }
    if (!window.confirm(CONFIRM_TEXT)) return;
    run(() => blockUserAction(userId));
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" disabled={isPending} onClick={onClick}>
        {blocked ? "Engeli kaldır" : "Engelle"}
      </Button>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
