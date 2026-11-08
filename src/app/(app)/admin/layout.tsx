import { AdminTabs } from "@/components/admin/admin-tabs";
import { requireAdmin } from "@/lib/auth/guards";

/** Yönetim alanı. Yönetici değilse 404 döner (alanın varlığını gizler). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <div className="pb-2">
        <AdminTabs />
      </div>
      {children}
    </>
  );
}
