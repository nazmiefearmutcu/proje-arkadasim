import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { requireVerified } from "@/lib/auth/guards";
import { createProjectAction } from "@/lib/projects/actions";

export const metadata = { title: "Projeyi paylaş" };

export default async function Page() {
  await requireVerified("/paylas");

  return (
    <>
      <PageHeader title="Projeyi paylaş" />
      <ProjectForm action={createProjectAction} submitLabel="Projeyi paylaş" />
    </>
  );
}
