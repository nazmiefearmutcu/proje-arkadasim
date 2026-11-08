import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm, type ProjectFormInitial } from "@/components/projects/project-form";
import { requireVerified } from "@/lib/auth/guards";
import { getProjectDetail } from "@/lib/projects/queries";
import { updateProjectAction } from "@/lib/projects/actions";

export const metadata = { title: "Projeyi düzenle" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireVerified(`/projeler/${id}/duzenle`);
  const project = await getProjectDetail(id, viewer);
  if (!project || !project.viewer.isOwner) notFound();

  const initial: ProjectFormInitial = {
    title: project.title,
    summary: project.summary,
    description: project.description,
    category: project.category,
    stage: project.stage,
    workMode: project.workMode,
    city: project.city,
    tags: project.tags,
    roles: project.roles.map((role) => ({
      id: role.id,
      title: role.title,
      disciplineGroup: role.disciplineGroup,
      slots: role.slots,
      description: role.description,
    })),
  };

  return (
    <>
      <PageHeader title="Projeyi düzenle" />
      <ProjectForm
        action={updateProjectAction.bind(null, project.id)}
        initial={initial}
        submitLabel="Değişiklikleri kaydet"
        cancelHref={`/projeler/${project.id}`}
      />
    </>
  );
}
