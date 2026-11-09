"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CATEGORIES, CITIES, STAGES, WORK_MODES } from "@/config/taxonomy";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { projectsHref, type ProjectFilterState } from "@/lib/projects/filters";

export interface ProjectFiltersProps {
  initial: ProjectFilterState;
  activeCount: number;
}

/**
 * Filtreler paneli. Alanlar alttan açılan panelde; uygula düğmesi adresi URL parametreleriyle günceller
 * (sayfa 1'e döner). Disiplin çipleri sayfanın üst kısmındadır ve bu panelden bağımsızdır.
 */
export function ProjectFilters({ initial, activeCount }: ProjectFiltersProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initial.q);
  const [category, setCategory] = useState(initial.category ?? "");
  const [workMode, setWorkMode] = useState(initial.workMode ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [stage, setStage] = useState(initial.stage ?? "");

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const href = projectsHref({
      mine: initial.mine,
      disciplineGroup: initial.disciplineGroup,
      q: q.trim(),
      category: category || null,
      workMode: workMode || null,
      city: city || null,
      stage: stage || null,
      page: 1,
    });
    setOpen(false);
    router.push(href);
  }

  function clear(): void {
    setOpen(false);
    router.push(projectsHref({ mine: initial.mine, disciplineGroup: initial.disciplineGroup }));
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={activeCount > 0 ? `Filtreler, ${activeCount} etkin` : "Filtreler"}
      >
        <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} className="size-5" />
        Filtreler
        {activeCount > 0 ? (
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-chip bg-pen px-1 text-[12px] leading-none font-[650] text-pen-ink">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtreler">
        <form method="post" onSubmit={apply} className="flex flex-col gap-4 px-2 pt-2 pb-2">
          <Field id="filter-q" label="Arama" hint="Başlık, özet, etiket ya da rol adı.">
            <Input value={q} onChange={(event) => setQ(event.target.value)} autoComplete="off" />
          </Field>
          <Field id="filter-category" label="Kategori">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Tümü</option>
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="filter-work-mode" label="Çalışma şekli">
            <Select value={workMode} onChange={(event) => setWorkMode(event.target.value)}>
              <option value="">Tümü</option>
              {WORK_MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="filter-city" label="Şehir">
            <Select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Tümü</option>
              {CITIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="filter-stage" label="Aşama">
            <Select value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="">Tümü</option>
              {STAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="flex-1">
              Filtreleri uygula
            </Button>
            <Button type="button" variant="secondary" onClick={clear}>
              Temizle
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
