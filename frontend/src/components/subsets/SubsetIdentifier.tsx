import * as React from "react";
import type { Subset } from "../../lib/api";
import { cn } from "../../lib/utils";
import { UserAvatar } from "../UserAvatar";

export function formatLockedDate(lockedAt: string | null): string {
  if (!lockedAt) return "";
  return new Date(lockedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(name: string, max: number): string {
  return name.length > max ? name.slice(0, max).trimEnd() + "…" : name;
}

type SubsetIdentifierProps = {
  subset: Pick<Subset, "name" | "lockedAt" | "ownedBy">;
  showDate?: boolean;
  maxNameLength?: number;
  compact?: boolean;
  className?: string;
};

export function SubsetIdentifier({
  subset,
  showDate = true,
  maxNameLength = 16,
  compact = false,
  className,
}: SubsetIdentifierProps): React.ReactElement {
  const displayName = truncate(subset.name, maxNameLength);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <UserAvatar
        displayName={subset.ownedBy.displayName}
        avatarUrl={subset.ownedBy.avatarUrl}
        className={compact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"}
      />
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={`shrink-0 font-medium ${compact ? "text-xs" : "text-sm"}`}>
          {displayName}
        </span>
        {showDate && subset.lockedAt && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatLockedDate(subset.lockedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
