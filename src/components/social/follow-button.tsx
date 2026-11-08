"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { followUserAction, unfollowUserAction } from "@/lib/social/follow";

export interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
  className?: string;
}

/**
 * Takip düğmesi. Durum hemen değişir (iyimser); sunucu reddederse eski duruma döner ve hata gösterir.
 */
export function FollowButton({ userId, initialFollowing, className }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(): void {
    const next = !following;
    setError(null);
    setFollowing(next);
    startTransition(async () => {
      const result = next ? await followUserAction(userId) : await unfollowUserAction(userId);
      if (!result.ok) {
        setFollowing(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className={className ? `flex flex-col gap-1 ${className}` : "flex flex-col gap-1"}>
      <Button variant={following ? "secondary" : "primary"} disabled={isPending} onClick={toggle}>
        {following ? "Takibi bırak" : "Takip et"}
      </Button>
      {error ? (
        <p role="alert" className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
