import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { PersonSummary } from "@/lib/dto";
import { VerifiedStamp } from "./verified-stamp";

export interface UserRowProps {
  person: PersonSummary;
  /** Gösterilecek ad. Çağıran taraf `displayName` ile seçer (tam ad yalnız doğrulanmış görüntüleyiciye). */
  name: string;
  reason?: string;
  action?: ReactNode;
  /**
   * Verilirse profil resmi ve ad bilgisi tek bir bağlantı olur (ör. `/u/<username>`). Yalnız profili
   * görebilecek (doğrulanmış) görüntüleyici için verilir; ayrı bir "Profili gör" düğmesine gerek kalmaz.
   */
  href?: string;
}

/** Kişi satırı: 48 px profil resmi, ad ve doğrulama mührü, bölüm ve üniversite, isteğe bağlı gerekçe ve eylem. */
export function UserRow({ person, name, reason, action, href }: UserRowProps) {
  const identity = (
    <>
      <Avatar
        size={48}
        name={name}
        seed={person.username}
        avatarPath={person.avatarPath}
        disciplineGroup={person.disciplineGroup}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="t-label min-w-0 truncate text-ink">{name}</span>
          {person.verified ? <VerifiedStamp size="sm" academicStatus={person.academicStatus} /> : null}
        </div>
        {person.department || person.university ? (
          <div className="t-meta flex min-w-0 flex-col text-ink-2 sm:flex-row sm:gap-2">
            {person.department ? <span className="truncate">{person.department}</span> : null}
            {person.university ? <span className="truncate">{person.university}</span> : null}
          </div>
        ) : null}
        {reason ? <p className="t-meta text-ink-3">{reason}</p> : null}
      </div>
    </>
  );

  return (
    <div className="flex min-h-16 items-center gap-3 py-3">
      {href ? (
        <Link href={href} className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-control", focusRing)}>
          {identity}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{identity}</div>
      )}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
