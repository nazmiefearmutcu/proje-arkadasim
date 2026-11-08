import { foldTr } from "@/lib/tr";

// Ortak seçenek biçimi: veritabanına `value`, ekrana `label` yazılır.
export interface Option {
  readonly value: string;
  readonly label: string;
}

export const CATEGORIES = [
  { value: "YAZILIM", label: "Yazılım" },
  { value: "DONANIM", label: "Donanım" },
  { value: "TASARIM", label: "Tasarım" },
  { value: "GIRISIM", label: "Girişim" },
  { value: "ARASTIRMA", label: "Araştırma" },
  { value: "SOSYAL_SORUMLULUK", label: "Sosyal sorumluluk" },
  { value: "SANAT_MEDYA", label: "Sanat ve medya" },
  { value: "OYUN", label: "Oyun" },
  { value: "DIGER", label: "Diğer" },
] as const satisfies readonly Option[];
export type Category = (typeof CATEGORIES)[number]["value"];

export const STAGES = [
  { value: "FIKIR", label: "Fikir" },
  { value: "PROTOTIP", label: "Prototip" },
  { value: "GELISTIRME", label: "Geliştirme" },
  { value: "YAYINDA", label: "Yayında" },
] as const satisfies readonly Option[];
export type Stage = (typeof STAGES)[number]["value"];

export const WORK_MODES = [
  { value: "UZAKTAN", label: "Uzaktan" },
  { value: "YUZ_YUZE", label: "Yüz yüze" },
  { value: "HIBRIT", label: "Hibrit" },
] as const satisfies readonly Option[];
export type WorkMode = (typeof WORK_MODES)[number]["value"];

export const ACADEMIC_STATUSES = [
  { value: "STUDENT", label: "Öğrenci" },
  { value: "GRADUATE", label: "Mezun" },
] as const satisfies readonly Option[];
export type AcademicStatus = (typeof ACADEMIC_STATUSES)[number]["value"];

export const DEGREE_LEVELS = [
  { value: "ONLISANS", label: "Ön lisans" },
  { value: "LISANS", label: "Lisans" },
  { value: "YUKSEK_LISANS", label: "Yüksek lisans" },
  { value: "DOKTORA", label: "Doktora" },
] as const satisfies readonly Option[];
export type DegreeLevel = (typeof DEGREE_LEVELS)[number]["value"];

export const VERIFICATION_STATUSES = [
  { value: "UNVERIFIED", label: "Doğrulanmadı" },
  { value: "PENDING", label: "İnceleniyor" },
  { value: "MANUAL_REVIEW", label: "Manuel incelemede" },
  { value: "VERIFIED", label: "Doğrulandı" },
  { value: "REJECTED", label: "Reddedildi" },
] as const satisfies readonly Option[];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]["value"];

// Disiplin grupları. Anahtar kelimeler katlanmış (foldTr) biçimde yazılır.
// Anahtar kelime, bölüm adının ardışık belirteçleriyle eşleşir; her bölüm belirteci
// anahtar kelime belirteciyle BAŞLAMALIDIR (önek eşleşmesi). Bu yüzden ekli
// biçimler yerine kök kullanılır (ör. "ogretmen" -> "Öğretmenliği").
export const DISCIPLINE_GROUP_IDS = [
  "yazilim",
  "elektronik",
  "makine",
  "endustri",
  "mimarlik",
  "tasarim",
  "isletme",
  "saglik",
  "hukuk",
  "sosyal",
  "temel",
  "sanat",
] as const;
export type DisciplineGroupId = (typeof DISCIPLINE_GROUP_IDS)[number];

export interface DisciplineGroup {
  readonly id: DisciplineGroupId;
  readonly label: string;
  readonly color: string;
  readonly keywords: readonly string[];
  readonly complements: readonly DisciplineGroupId[];
}

export const DISCIPLINE_GROUPS: readonly DisciplineGroup[] = [
  {
    id: "yazilim",
    label: "Yazılım ve bilişim",
    color: "#0B7285",
    keywords: ["bilgisayar", "yazilim", "bilisim", "yonetim bilisim", "veri bilimi", "yapay zeka"],
    complements: ["tasarim", "isletme", "elektronik"],
  },
  {
    id: "elektronik",
    label: "Elektrik ve elektronik",
    color: "#E8590C",
    keywords: ["elektrik", "elektronik", "haberlesme", "telekomunikasyon", "biyomedikal"],
    complements: ["yazilim", "makine", "tasarim"],
  },
  {
    id: "makine",
    label: "Makine ve imalat",
    color: "#495057",
    keywords: ["makine", "mekatronik", "otomotiv", "havacilik", "uzay", "imalat", "metalurji", "malzeme"],
    complements: ["elektronik", "yazilim", "endustri"],
  },
  {
    id: "endustri",
    label: "Endüstri ve yönetim",
    color: "#E0A800",
    keywords: ["endustri muhendis", "yonetim muhendis", "lojistik"],
    complements: ["yazilim", "isletme", "makine"],
  },
  {
    id: "mimarlik",
    label: "İnşaat ve mimarlık",
    color: "#9C6644",
    keywords: ["mimarlik", "insaat", "sehir ve bolge planlama", "peyzaj", "harita"],
    complements: ["tasarim", "makine", "sanat"],
  },
  {
    id: "tasarim",
    label: "Tasarım",
    color: "#D6336C",
    keywords: [
      "endustriyel tasarim",
      "grafik tasarim",
      "ic mimarlik",
      "moda",
      "iletisim tasarimi",
      "gorsel iletisim",
    ],
    complements: ["yazilim", "isletme", "makine"],
  },
  {
    id: "isletme",
    label: "İşletme ve ekonomi",
    color: "#2F9E44",
    keywords: ["isletme", "iktisat", "ekonomi", "finans", "muhasebe", "pazarlama", "uluslararasi ticaret", "maliye"],
    complements: ["yazilim", "tasarim", "hukuk"],
  },
  {
    id: "saglik",
    label: "Sağlık",
    color: "#C92A2A",
    keywords: ["tip", "hemsirelik", "eczacilik", "dis hekimligi", "dishekimligi", "fizyoterapi", "beslenme", "saglik"],
    complements: ["yazilim", "elektronik", "temel"],
  },
  {
    id: "hukuk",
    label: "Hukuk ve siyaset",
    color: "#3B5BDB",
    keywords: ["hukuk", "siyaset", "kamu yonetimi", "uluslararasi iliskiler"],
    complements: ["isletme", "yazilim", "sosyal"],
  },
  {
    id: "sosyal",
    label: "Sosyal bilimler ve iletişim",
    color: "#845EF7",
    keywords: [
      "psikoloji",
      "sosyoloji",
      "iletisim",
      "gazetecilik",
      "halkla iliskiler",
      "egitim",
      "ogretmen",
      "tarih",
      "felsefe",
      "edebiyat",
      "dil",
    ],
    complements: ["yazilim", "tasarim", "sanat"],
  },
  {
    id: "temel",
    label: "Temel bilimler",
    color: "#74B816",
    keywords: ["matematik", "fizik", "kimya", "biyoloji", "molekuler", "istatistik", "astronomi", "genetik"],
    complements: ["yazilim", "saglik", "elektronik"],
  },
  {
    id: "sanat",
    label: "Sanat ve medya",
    color: "#AE3EC9",
    keywords: ["muzik", "sinema", "televizyon", "resim", "heykel", "guzel sanatlar", "tiyatro", "fotograf", "animasyon"],
    complements: ["yazilim", "tasarim", "sosyal"],
  },
];

interface KeywordEntry {
  readonly groupId: DisciplineGroupId;
  readonly tokens: readonly string[];
  readonly text: string;
}

// Tüm anahtar kelimeler: önce belirteç sayısına göre (çoktan aza), sonra karakter sayısına göre.
const KEYWORD_ENTRIES: readonly KeywordEntry[] = DISCIPLINE_GROUPS.flatMap((group) =>
  group.keywords.map((keyword) => ({
    groupId: group.id,
    tokens: keyword.split(" ").filter((token) => token.length > 0),
    text: keyword,
  })),
).sort(
  (a, b) => b.tokens.length - a.tokens.length || b.text.length - a.text.length,
);

/**
 * Bölüm adından disiplin grubunu bulur. Bölüm adı katlanır, belirteçlere ayrılır;
 * bir anahtar kelime, bölümde ardışık belirteçlerle eşleşirse (her bölüm belirteci
 * anahtar kelime belirteciyle başlıyorsa) o grup döner. İlk eşleşen kazanır.
 */
export function disciplineGroupForDepartment(
  department: string | null | undefined,
): DisciplineGroupId | null {
  if (!department) return null;
  const tokens = foldTr(department)
    .split(" ")
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;

  for (const entry of KEYWORD_ENTRIES) {
    const span = entry.tokens.length;
    for (let start = 0; start + span <= tokens.length; start++) {
      const matches = entry.tokens.every((keywordToken, offset) =>
        tokens[start + offset].startsWith(keywordToken),
      );
      if (matches) return entry.groupId;
    }
  }
  return null;
}

export function getDisciplineGroup(id: string): DisciplineGroup | undefined {
  return DISCIPLINE_GROUPS.find((group) => group.id === id);
}

export function isDisciplineGroupId(value: unknown): value is DisciplineGroupId {
  return typeof value === "string" && (DISCIPLINE_GROUP_IDS as readonly string[]).includes(value);
}

// Türkiye'nin 81 ili, Türkçe alfabe sırasıyla.
export const CITIES = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bartın",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Düzce",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Iğdır",
  "Isparta",
  "İstanbul",
  "İzmir",
  "Kahramanmaraş",
  "Karabük",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kilis",
  "Kırıkkale",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Şanlıurfa",
  "Şırnak",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Uşak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
] as const;
export type City = (typeof CITIES)[number];

/** Değerin Türkçe etiketini döner; seçenek bulunamazsa değerin kendisini döner. */
export function labelOf(list: readonly Option[], value: string): string {
  return list.find((option) => option.value === value)?.label ?? value;
}
