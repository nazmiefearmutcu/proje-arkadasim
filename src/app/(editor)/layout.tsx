import { LogOut } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { EditorNav } from "@/components/editor/editor-nav";
import type { EditorCounts } from "@/components/editor/editor-nav";
import { focusRing } from "@/components/ui/styles";
import { requireAdmin } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";
import { db } from "@/lib/db";

/**
 * Editör arayüzü (spec 2026-11-27 §2). Öğrenci arayüzünden ayrı bir kabuktur: açık üst bar, solda
 * editör menüsü, çıkış. Arama, bildirim zili ve öğrenci alt menüsü yoktur. Editör değilse 404 döner;
 * alanın varlığı gizlenir.
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  const [content, documents, reports] = await Promise.all([
    db.project.count({ where: { moderationStatus: "PENDING" } }),
    db.verificationAttempt.count({ where: { status: "MANUAL_REVIEW" } }),
    db.report.count({ where: { status: "OPEN", targetType: { not: "PROJECT" } } }),
  ]);
  const counts: EditorCounts = { content, documents, reports };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-surface supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="flex h-[60px] items-center gap-3 px-4 lg:px-5">
          <Link href="/editor" className={`inline-flex items-center gap-3 rounded-control py-2 ${focusRing}`}>
            <Logo onLight />
            <span className="rounded-full border border-line px-2.5 py-1 t-meta font-[600] text-ink-2">Editör</span>
          </Link>
          <form action={logoutAction} className="ml-auto">
            <button
              type="submit"
              className={`inline-flex h-10 items-center gap-2 rounded-control px-3 t-label text-ink-2 hover:bg-black/[0.05] hover:text-ink ${focusRing}`}
            >
              <LogOut aria-hidden="true" strokeWidth={1.75} className="size-4" />
              Çıkış
            </button>
          </form>
        </div>
        <EditorNav counts={counts} variant="tabs" />
      </header>

      <aside className="fixed top-[60px] bottom-0 left-0 z-20 hidden w-[230px] border-r border-line bg-surface lg:block">
        <EditorNav counts={counts} variant="side" />
      </aside>

      <div className="w-full lg:pl-[230px]">
        <main className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
          {children}
        </main>
      </div>
    </>
  );
}
