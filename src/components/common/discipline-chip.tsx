import { getDisciplineGroup, isDisciplineGroupId } from "@/config/taxonomy";
import { Chip } from "@/components/ui/chip";

/** Disiplin çipi: baştaki nokta grubun rengi, etiket taksonomiden. Bilinmeyen grup ham değeriyle gösterilir. */
export function DisciplineChip({ id, selected }: { id: string; selected?: boolean }) {
  const group = isDisciplineGroupId(id) ? getDisciplineGroup(id) : undefined;
  return (
    <Chip dotColor={group ? `var(--d-${group.id})` : undefined} selected={selected}>
      {group?.label ?? id}
    </Chip>
  );
}
