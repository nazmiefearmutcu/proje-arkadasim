"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/components/projects/use-run-action";
import { dismissIntroductionAction } from "@/lib/social/introductions";

export interface DismissButtonProps {
  userId: string;
}

/** Tanıştırma önerisini gizler. Başarılı olunca düğme kaybolur. */
export function DismissButton({ userId }: DismissButtonProps) {
  const [hidden, setHidden] = useState(false);
  const { isPending, error, run } = useRunAction();

  if (hidden) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" disabled={isPending} onClick={() => run(() => dismissIntroductionAction(userId), () => setHidden(true))}>
        Gizle
      </Button>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
