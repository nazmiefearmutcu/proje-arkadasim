import { CATEGORIES, CITIES, STAGES, WORK_MODES, isDisciplineGroupId } from "@/config/taxonomy";

// Keşif filtreleri URL'de tutulur (paylaşılabilir). Bu dosya saf TypeScript'tir: istemci ve sunucu kullanır.

export interface ProjectFilterState {
  q: string;
  category: string | null;
  disciplineGroup: string | null;
  workMode: string | null;
  city: string | null;
  stage: string | null;
  page: number;
  /** `filtre=benim`: kullanıcının kendi ve üye olduğu projeler. */
  mine: boolean;
}

type RawParams = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 80;
const MAX_PAGE = 1000;

function first(params: RawParams, key: string): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function oneOf(value: string | undefined, allowed: readonly string[]): string | null {
  return value !== undefined && allowed.includes(value) ? value : null;
}

/** Arama sayfası parametrelerini doğrular. Tanınmayan değerler sessizce atılır. */
export function parseProjectFilters(params: RawParams): ProjectFilterState {
  const rawQuery = first(params, "q") ?? "";
  const rawPage = Number.parseInt(first(params, "sayfa") ?? "1", 10);
  const disciplineRaw = first(params, "disiplin");

  return {
    q: rawQuery.trim().slice(0, MAX_QUERY_LENGTH),
    category: oneOf(first(params, "kategori"), CATEGORIES.map((option) => option.value)),
    disciplineGroup: disciplineRaw !== undefined && isDisciplineGroupId(disciplineRaw) ? disciplineRaw : null,
    workMode: oneOf(first(params, "calisma"), WORK_MODES.map((option) => option.value)),
    city: oneOf(first(params, "sehir"), CITIES),
    stage: oneOf(first(params, "asama"), STAGES.map((option) => option.value)),
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, MAX_PAGE) : 1,
    mine: first(params, "filtre") === "benim",
  };
}

/** Filtre sayısı: kategori, çalışma şekli, şehir, aşama ve arama kutusu. Disiplin çipleri ayrı sayılmaz. */
export function activeFilterCount(state: ProjectFilterState): number {
  return [state.q, state.category, state.workMode, state.city, state.stage].filter(
    (value) => value !== null && value !== "",
  ).length;
}

/**
 * Filtre durumundan bağlantı üretir. Sayfa 1 ise `sayfa` yazılmaz. `base` varsayılan `/projeler`.
 */
export function projectsHref(state: Partial<ProjectFilterState>, base = "/projeler"): string {
  const search = new URLSearchParams();
  if (state.mine) search.set("filtre", "benim");
  if (state.q) search.set("q", state.q);
  if (state.category) search.set("kategori", state.category);
  if (state.disciplineGroup) search.set("disiplin", state.disciplineGroup);
  if (state.workMode) search.set("calisma", state.workMode);
  if (state.city) search.set("sehir", state.city);
  if (state.stage) search.set("asama", state.stage);
  if (state.page && state.page > 1) search.set("sayfa", String(state.page));
  const query = search.toString();
  return query.length > 0 ? `${base}?${query}` : base;
}
