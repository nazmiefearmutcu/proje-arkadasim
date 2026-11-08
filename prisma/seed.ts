import { randomBytes } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { CATEGORIES, disciplineGroupForDepartment, getDisciplineGroup, labelOf } from "../src/config/taxonomy";
import type { Category, DisciplineGroupId, Stage, WorkMode } from "../src/config/taxonomy";
import { LEGAL_VERSION, MASKED_TEXT_RETENTION_DAYS } from "../src/config/legal";
import { seedProblem } from "../src/lib/seed-guard";
import { toListJson } from "../src/lib/json-fields";
import { toSearchText } from "../src/lib/tr";

// Tohum (seed) verisi: `npm run seed`. Önce tüm tabloları siler, sonra tek bir transaction içinde
// yeniden doldurur; bu yüzden tekrar çalıştırmak güvenlidir (ama mevcut verinin tamamını siler).
// Parolalar yalnız ortam değişkenlerinden okunur (.env.example'a bakın). Hiçbir parola yazdırılmaz.

const DEMO_USERNAME = "elif.yilmaz";
const DEMO_DOMAIN = "ornek.edu.tr";
const ADMIN_USERNAME = "yonetici";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// .env dosyasını (varsa) yükler; ortamda zaten tanımlı değişkenler ezilmez.
function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // .env yoksa ortam değişkenleri olduğu gibi kullanılır.
  }
}

function requireEnv(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`${name} tanımlı değil. .env.example dosyasındaki değeri .env dosyasına kopyalayın.`);
  }
  return value;
}

function randomDocHash(): string {
  return randomBytes(32).toString("hex");
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Kullanıcılar (16 doğrulanmış + yönetici + doğrulanmamış + manuel incelemede)
// ---------------------------------------------------------------------------

interface PersonSeed {
  username: string;
  firstName: string;
  lastName: string;
  university: string;
  faculty: string;
  department: string;
  city: string;
  academicStatus: "STUDENT" | "GRADUATE";
  degreeLevel: "LISANS" | "YUKSEK_LISANS";
  classYear: number | null;
  graduationYear: number | null;
  bio: string;
  skills: string[];
  interests: string[];
  lookingForProject: boolean;
  crossBorderAi: boolean;
  documentType: "OGRENCI_BELGESI" | "MEZUN_BELGESI";
}

const PEOPLE: PersonSeed[] = [
  {
    username: "ayse.kaya",
    firstName: "Ayşe Nur",
    lastName: "Kaya",
    university: "ODTÜ",
    faculty: "Mühendislik Fakültesi",
    department: "Bilgisayar Mühendisliği",
    city: "Ankara",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 3,
    graduationYear: null,
    bio: "Veri ve yazılım tarafında çalışıyorum. Açık kaynak projelerde kod incelemesi yapmak ve küçük araçlar yazmak hoşuma gidiyor.",
    skills: ["Python", "TypeScript", "Veri analizi", "Git"],
    interests: ["yapay zeka", "açık kaynak"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "mert.demir",
    firstName: "Mert",
    lastName: "Demir",
    university: "İTÜ",
    faculty: "Elektrik-Elektronik Fakültesi",
    department: "Elektrik-Elektronik Mühendisliği",
    city: "İstanbul",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 4,
    graduationYear: null,
    bio: "Mikrodenetleyicilerle sensör okuyan küçük cihazlar yapıyorum. Tarlada gerçekten çalışan bir şey üretmek istiyorum.",
    skills: ["C", "Gömülü sistemler", "PCB tasarımı", "Arduino"],
    interests: ["robotik", "akıllı tarım"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "zeynep.arslan",
    firstName: "Zeynep",
    lastName: "Arslan",
    university: "Boğaziçi Üniversitesi",
    faculty: "Tasarım Fakültesi",
    department: "Endüstriyel Tasarım",
    city: "İstanbul",
    academicStatus: "GRADUATE",
    degreeLevel: "LISANS",
    classYear: null,
    graduationYear: 2023,
    bio: "Kullanıcının günlük hayatına dokunan ürünler tasarlıyorum. Atık malzemeyle çalışmayı seviyorum.",
    skills: ["Form tasarımı", "Eskiz", "Rhino", "Kullanıcı araştırması"],
    interests: ["sürdürülebilirlik", "sosyal girişimcilik"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "MEZUN_BELGESI",
  },
  {
    username: "emre.ozturk",
    firstName: "Emre",
    lastName: "Öztürk",
    university: "Hacettepe Üniversitesi",
    faculty: "Tıp Fakültesi",
    department: "Tıp",
    city: "Ankara",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 4,
    graduationYear: null,
    bio: "Tıp eğitimimin son yıllarındayım. Görüntüleme ve klinik karar destek konularına ilgim var.",
    skills: ["Tıbbi literatür taraması", "İstatistik", "R", "Sağlık verisi"],
    interests: ["sağlık teknolojileri", "yapay zeka"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: DEMO_USERNAME,
    firstName: "Elif",
    lastName: "Yılmaz",
    university: "Ege Üniversitesi",
    faculty: "İktisadi ve İdari Bilimler Fakültesi",
    department: "İşletme",
    city: "İzmir",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 2,
    graduationYear: null,
    bio: "Ödeme ve bütçe konularına ilgi duyan bir işletme öğrencisiyim. Öğrenci projelerinin ilk iş planını çıkarmasına yardım etmek istiyorum.",
    skills: ["Finansal modelleme", "Excel", "Pazar araştırması", "Sunum"],
    interests: ["finans teknolojileri", "sosyal girişimcilik"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "burak.sahin",
    firstName: "Burak",
    lastName: "Şahin",
    university: "Dokuz Eylül Üniversitesi",
    faculty: "Edebiyat Fakültesi",
    department: "Psikoloji",
    city: "İzmir",
    academicStatus: "GRADUATE",
    degreeLevel: "LISANS",
    classYear: null,
    graduationYear: 2021,
    bio: "Psikoloji mezunuyum; insanların öğrenirken neye ihtiyaç duyduğuyla ilgileniyorum. Eğitici oyunlar üzerine düşünmeyi seviyorum.",
    skills: ["Anket tasarımı", "Oyun tasarımı", "Kullanılabilirlik testi"],
    interests: ["eğitim teknolojileri", "oyun geliştirme"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "MEZUN_BELGESI",
  },
  {
    username: "deniz.aksoy",
    firstName: "Deniz",
    lastName: "Aksoy",
    university: "Bilkent Üniversitesi",
    faculty: "Hukuk Fakültesi",
    department: "Hukuk",
    city: "Ankara",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 3,
    graduationYear: null,
    bio: "Hukuk öğrencisiyim. Karmaşık metinleri sade bir dille anlatmanın yollarını arıyorum.",
    skills: ["Sözleşme hukuku", "Araştırma", "Hukuki metin yazımı", "Veri koruma"],
    interests: ["sosyal girişimcilik", "eğitim teknolojileri"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "selin.koc",
    firstName: "Selin",
    lastName: "Koç",
    university: "Yıldız Teknik Üniversitesi",
    faculty: "Mimarlık Fakültesi",
    department: "Mimarlık",
    city: "İstanbul",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 2,
    graduationYear: null,
    bio: "Mimarlık ikinci sınıf öğrencisiyim. Yapılarda malzeme seçimini ve doğal ışığı düşünmekten keyif alıyorum.",
    skills: ["Revit", "Maket yapımı", "AutoCAD"],
    interests: ["sürdürülebilirlik", "sosyal girişimcilik"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "can.yildirim",
    firstName: "Can",
    lastName: "Yıldırım",
    university: "Ankara Üniversitesi",
    faculty: "Mühendislik Fakültesi",
    department: "Makine Mühendisliği",
    city: "Bursa",
    academicStatus: "GRADUATE",
    degreeLevel: "LISANS",
    classYear: null,
    graduationYear: 2020,
    bio: "Makine mühendisliği mezunuyum ve Bursa'da bir imalat firmasında çalışıyorum. Hafta sonları robot prototipleriyle uğraşıyorum.",
    skills: ["SolidWorks", "Mekanik tasarım", "CNC", "Prototipleme"],
    interests: ["robotik", "mobil uygulama"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "MEZUN_BELGESI",
  },
  {
    username: "ece.polat",
    firstName: "Ece",
    lastName: "Polat",
    university: "Marmara Üniversitesi",
    faculty: "İktisadi ve İdari Bilimler Fakültesi",
    department: "İşletme",
    city: "İstanbul",
    academicStatus: "GRADUATE",
    degreeLevel: "YUKSEK_LISANS",
    classYear: null,
    graduationYear: 2024,
    bio: "İşletme yüksek lisansımı yeni tamamladım. Küçük ekiplerin ürününü kullanıcıya nasıl ulaştıracağını çözmekle ilgileniyorum.",
    skills: ["Pazarlama stratejisi", "Veri okuma", "Büyüme analizi"],
    interests: ["finans teknolojileri", "sosyal girişimcilik"],
    lookingForProject: false,
    crossBorderAi: false,
    documentType: "MEZUN_BELGESI",
  },
  {
    username: "kerem.aydin",
    firstName: "Kerem",
    lastName: "Aydın",
    university: "Erciyes Üniversitesi",
    faculty: "Mühendislik Fakültesi",
    department: "Endüstri Mühendisliği",
    city: "Kayseri",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 3,
    graduationYear: null,
    bio: "Üretim hatlarındaki israfı azaltmak için veriye bakıyorum. Büyük yemekhanelerin de aynı mantıkla iyileşebileceğini düşünüyorum.",
    skills: ["Simülasyon", "Süreç iyileştirme", "Python", "Lean"],
    interests: ["akıllı tarım", "robotik"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "irem.gunes",
    firstName: "İrem",
    lastName: "Güneş",
    university: "Karadeniz Teknik Üniversitesi",
    faculty: "Fen Fakültesi",
    department: "Moleküler Biyoloji ve Genetik",
    city: "Trabzon",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 4,
    graduationYear: null,
    bio: "Genetik laboratuvarında bitirme tezimi yazıyorum. Biyolojik veriyi anlaşılır hale getiren araçlara ilgim var.",
    skills: ["Laboratuvar teknikleri", "R", "Dizi analizi", "Akademik yazım"],
    interests: ["sağlık teknolojileri", "yapay zeka"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "baris.tekin",
    firstName: "Barış",
    lastName: "Tekin",
    university: "Anadolu Üniversitesi",
    faculty: "Güzel Sanatlar Fakültesi",
    department: "Müzik",
    city: "Eskişehir",
    academicStatus: "STUDENT",
    degreeLevel: "LISANS",
    classYear: 2,
    graduationYear: null,
    bio: "Türk halk müziği ezgilerini nota yazarak derliyorum. Teknolojinin bu işi hızlandırabileceğine inanıyorum.",
    skills: ["Türk müziği nazariyatı", "Kanun", "Nota yazımı", "Ses kaydı"],
    interests: ["müzik teknolojisi", "oyun geliştirme"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "OGRENCI_BELGESI",
  },
  {
    username: "ozge.karaca",
    firstName: "Özge",
    lastName: "Karaca",
    university: "Gazi Üniversitesi",
    faculty: "İletişim Fakültesi",
    department: "Sinema-TV",
    city: "Ankara",
    academicStatus: "GRADUATE",
    degreeLevel: "LISANS",
    classYear: null,
    graduationYear: 2022,
    bio: "Sinema-TV bölümünü bitirdim; şimdi kısa animasyon ve eğitim videoları üretiyorum. Hikayeyle öğretmenin gücüne inanıyorum.",
    skills: ["Kurgu", "Kamera", "Hikaye anlatımı", "Animasyon"],
    interests: ["oyun geliştirme", "eğitim teknolojileri"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "MEZUN_BELGESI",
  },
  {
    username: "tolga.erdogan",
    firstName: "Tolga",
    lastName: "Erdoğan",
    university: "Çukurova Üniversitesi",
    faculty: "Mühendislik Fakültesi",
    department: "Bilgisayar Mühendisliği",
    city: "Adana",
    academicStatus: "GRADUATE",
    degreeLevel: "LISANS",
    classYear: null,
    graduationYear: 2019,
    bio: "Adana'da bir yazılım şirketinde çalışıyorum. Hafta sonları küçük mobil uygulamalar yazıyorum.",
    skills: ["Java", "Kotlin", "Veritabanı tasarımı", "Test otomasyonu"],
    interests: ["açık kaynak", "mobil uygulama"],
    lookingForProject: false,
    crossBorderAi: true,
    documentType: "MEZUN_BELGESI",
  },
  {
    username: "nazli.bozkurt",
    firstName: "Nazlı",
    lastName: "Bozkurt",
    university: "Atatürk Üniversitesi",
    faculty: "Edebiyat Fakültesi",
    department: "Psikoloji",
    city: "Erzurum",
    academicStatus: "GRADUATE",
    degreeLevel: "LISANS",
    classYear: null,
    graduationYear: 2025,
    bio: "Psikoloji mezunuyum ve özel eğitim alanında gönüllü çalışıyorum. Öğrenmeyi destekleyen araçların çocuklara göre tasarlanmasını istiyorum.",
    skills: ["Gözlem", "Görüşme tekniği", "SPSS", "Özel eğitim"],
    interests: ["eğitim teknolojileri", "sosyal girişimcilik"],
    lookingForProject: true,
    crossBorderAi: true,
    documentType: "MEZUN_BELGESI",
  },
];

// Takip listeleri (kullanıcı adı -> takip ettikleri). Her kullanıcı 3–6 kişiyi takip eder; bazıları karşılıklıdır.
const FOLLOWS: Record<string, string[]> = {
  "ayse.kaya": ["mert.demir", "zeynep.arslan", DEMO_USERNAME, "tolga.erdogan"],
  "mert.demir": ["ayse.kaya", "can.yildirim", "selin.koc", "kerem.aydin"],
  "zeynep.arslan": ["selin.koc", "ayse.kaya", DEMO_USERNAME, "ozge.karaca", "deniz.aksoy"],
  "emre.ozturk": ["ayse.kaya", "irem.gunes", "mert.demir"],
  [DEMO_USERNAME]: ["zeynep.arslan", "ece.polat", "burak.sahin", "ayse.kaya", "baris.tekin"],
  "burak.sahin": [DEMO_USERNAME, "ozge.karaca", "nazli.bozkurt", "emre.ozturk"],
  "deniz.aksoy": ["ece.polat", "zeynep.arslan", "ayse.kaya", "nazli.bozkurt"],
  "selin.koc": ["zeynep.arslan", "can.yildirim", "ayse.kaya"],
  "can.yildirim": ["mert.demir", "kerem.aydin", "selin.koc", "tolga.erdogan"],
  "ece.polat": [DEMO_USERNAME, "deniz.aksoy", "ayse.kaya", "zeynep.arslan"],
  "kerem.aydin": ["mert.demir", "can.yildirim", "irem.gunes"],
  "irem.gunes": ["emre.ozturk", "kerem.aydin", "ayse.kaya", "nazli.bozkurt"],
  "baris.tekin": ["ozge.karaca", DEMO_USERNAME, "zeynep.arslan"],
  "ozge.karaca": ["baris.tekin", "burak.sahin", "zeynep.arslan", "nazli.bozkurt", "tolga.erdogan"],
  "tolga.erdogan": ["ayse.kaya", "mert.demir", "can.yildirim", "ozge.karaca"],
  "nazli.bozkurt": ["burak.sahin", "deniz.aksoy", "irem.gunes", "ozge.karaca"],
};

// ---------------------------------------------------------------------------
// Projeler (12). Sahip, roller, kabul edilen üyeler, bekleyen başvurular ve davetler.
// ---------------------------------------------------------------------------

interface RoleSeed {
  title: string;
  group: DisciplineGroupId;
  slots: number;
  description?: string;
}

interface ProjectSeed {
  owner: string;
  title: string;
  summary: string;
  paragraphs: string[];
  category: Category;
  stage: Stage;
  workMode: WorkMode;
  city: string | null;
  tags: string[];
  status: "OPEN" | "CLOSED";
  roles: RoleSeed[];
  members: Array<{ username: string; role: string }>;
  joinRequests: Array<{ username: string; role: string; message: string }>;
  invites: Array<{ username: string; role: string; message: string }>;
}

const PROJECTS: ProjectSeed[] = [
  {
    owner: "mert.demir",
    title: "Akıllı sulama için düşük maliyetli nem sensörü",
    summary: "Toprak nemini ölçüp sulamayı yalnız gerektiğinde açan, pilli ve ucuz bir sensör.",
    paragraphs: [
      "Çiftçilerin büyük kısmı sulamayı takvime göre yapıyor. Toprak nemi bilinmeden yapılan sulama hem su israfına hem de verimsiz bir köke yol açıyor.",
      "Elimizde iki prototip var: toprağa gömülen bir nem ölçer ve bu ölçümü düşük güçle yayınlayan bir alıcı. Maliyeti piyasadaki ticari sistemlerin yaklaşık üçte biri.",
      "Ekipte gömülü yazılım, toprak bilimi ve mekanik tasarım konularında destek arıyoruz. Adana'daki bir pilot tarlada ölçümleri birlikte kalibre edeceğiz.",
    ],
    category: "DONANIM",
    stage: "PROTOTIP",
    workMode: "HIBRIT",
    city: "Adana",
    tags: ["IoT", "tarım", "sensör"],
    status: "OPEN",
    roles: [
      { title: "Gömülü yazılım geliştirici", group: "yazilim", slots: 1 },
      {
        title: "Toprak bilimci",
        group: "temel",
        slots: 1,
        description: "Ölçüm kalibrasyonu için saha verisi toplayabilecek biri.",
      },
      { title: "Mekanik tasarımcı", group: "makine", slots: 1 },
    ],
    members: [{ username: "tolga.erdogan", role: "Gömülü yazılım geliştirici" }],
    joinRequests: [],
    invites: [],
  },
  {
    owner: DEMO_USERNAME,
    title: "Üniversite öğrencileri için ikinci el ders kitabı pazarı",
    summary: "Öğrenciler eski ders kitaplarını güvenle alıp satabilsin diye kampüs odaklı bir pazar yeri.",
    paragraphs: [
      "Her dönem aynı kitaplar için yüksek fiyatlar ödeniyor, eski kitaplar ise raflarda kalıyor. Kampüs içinde güvenilir bir alım satım kanalı bu döngüyü kırabilir.",
      "Fikir aşamasındayız. İlk hedef, tek bir üniversitenin ders listelerini içeren ve teslim noktası seçilebilen basit bir web uygulaması.",
      "Ürün tasarımı ve mobil geliştirme konusunda ekip arıyoruz. Önce anketle talebi ölçeceğiz, sonra ilk pilotu başlatacağız.",
    ],
    category: "GIRISIM",
    stage: "FIKIR",
    workMode: "UZAKTAN",
    city: null,
    tags: ["pazar yeri", "öğrenci", "ikinci el"],
    status: "OPEN",
    roles: [
      { title: "Ürün tasarımcısı", group: "tasarim", slots: 1 },
      { title: "Mobil geliştirici", group: "yazilim", slots: 2 },
    ],
    members: [],
    joinRequests: [],
    invites: [],
  },
  {
    owner: "burak.sahin",
    title: "Otizmli çocuklar için duygu tanıma oyunu",
    summary: "Çocukların yüz ifadelerini ve duyguları adım adım tanımasına yardım eden kısa bir oyun.",
    paragraphs: [
      "Otizm spektrumundaki birçok çocuk yüz ifadelerini okumakta zorlanıyor. Bu zorluğu, düşük baskılı ve tekrar edilebilir bir oyunla çalıştırmak istiyoruz.",
      "Oyunda çocuk önce tek bir duyguyu tanır, sonra iki üç duygu arasında ayrım yapar. Her oyun bir terapist ya da ebeveynle birlikte oynanabilir.",
      "Oyun geliştirme, özel eğitim ve çizim konularında katkı arıyoruz. Oyunun ilk sürümünü bir özel eğitim merkeziyle birlikte deneyeceğiz.",
    ],
    category: "OYUN",
    stage: "GELISTIRME",
    workMode: "UZAKTAN",
    city: null,
    tags: ["oyun", "özel eğitim", "duygu"],
    status: "OPEN",
    roles: [
      { title: "Oyun geliştirici", group: "yazilim", slots: 1 },
      { title: "Özel eğitim uzmanı", group: "saglik", slots: 1 },
      { title: "Çizim ve animasyon", group: "sanat", slots: 2 },
    ],
    members: [{ username: "ozge.karaca", role: "Çizim ve animasyon" }],
    joinRequests: [
      {
        username: "nazli.bozkurt",
        role: "Özel eğitim uzmanı",
        message: "Psikoloji mezunuyum ve özel eğitim alanında gönüllü çalışıyorum. Oyunun çocuklarda nasıl işlediğini gözlemleyebilirim.",
      },
    ],
    invites: [],
  },
  {
    owner: "kerem.aydin",
    title: "Kampüs içi yemek israfını azaltan mobil uygulama",
    summary: "Yemekhanedeki artan porsiyonları öğrencilere indirimli sunan, kolay bir mobil uygulama.",
    paragraphs: [
      "Yemekhanelerde her gün pişirilen yemeğin önemli bir kısmı kullanılmadan çöpe gidiyor. Öğrenciler ise çoğu zaman indirimden habersiz.",
      "Uygulama, akşam kalan porsiyonları saat aralığıyla listeler. Öğrenci rezervasyon yapar, yemekhane de o kadar porsiyon hazırlar.",
      "Flutter geliştirici, süreç analisti ve arayüz tasarımcısı arıyoruz. Pilot olarak bir yemekhanede iki haftalık deneme yapmayı planlıyoruz.",
    ],
    category: "SOSYAL_SORUMLULUK",
    stage: "PROTOTIP",
    workMode: "YUZ_YUZE",
    city: "Kayseri",
    tags: ["israf", "kampüs", "mobil"],
    status: "OPEN",
    roles: [
      { title: "Flutter geliştirici", group: "yazilim", slots: 1 },
      { title: "Süreç analisti", group: "endustri", slots: 1 },
      { title: "Arayüz tasarımcısı", group: "tasarim", slots: 1 },
    ],
    members: [],
    joinRequests: [],
    invites: [
      {
        username: "ayse.kaya",
        role: "Flutter geliştirici",
        message: "Yemekhane verisini analiz edecek ve uygulamanın ilk sürümünü kuracak birine ihtiyacımız var.",
      },
    ],
  },
  {
    owner: "baris.tekin",
    title: "Türk halk müziği için yapay zeka destekli nota çıkarıcı",
    summary: "Kayıtlı halk ezgilerini ses analiziyle nota yazısına çeviren bir araştırma prototipi.",
    paragraphs: [
      "Halk ezgilerinin büyük kısmı yalnızca kayıt olarak duruyor. Nota yazımı hem zaman alıyor hem de ezgiye özgü süsleme ve aralıkları kaçırmaya açık.",
      "Prototip, kayıttan perde ve süre bilgisini çıkarıp ezgiyi nota yazısına çevirmeye çalışır. Çıktıyı bir müzikologun kontrol etmesi şarttır.",
      "Makine öğrenmesi mühendisi ve müzikolog arıyoruz. Veri setini birlikte hazırlayıp açık bir kütüphane olarak yayımlamayı hedefliyoruz.",
    ],
    category: "ARASTIRMA",
    stage: "GELISTIRME",
    workMode: "UZAKTAN",
    city: null,
    tags: ["halk müziği", "yapay zeka", "nota"],
    status: "OPEN",
    roles: [
      { title: "Makine öğrenmesi mühendisi", group: "yazilim", slots: 1 },
      { title: "Müzikolog", group: "sanat", slots: 2 },
    ],
    members: [],
    joinRequests: [
      {
        username: "ozge.karaca",
        role: "Müzikolog",
        message: "Halk ezgilerinin kayıt düzenlemesinde yıllardır çalışıyorum. Veri setini hazırlamak için yardımcı olabilirim.",
      },
    ],
    invites: [],
  },
  {
    owner: "can.yildirim",
    title: "Deprem sonrası enkaz altı ses algılama cihazı",
    summary: "Enkaz altındaki ses ve vuruş örüntülerini algılayıp arama ekiplerine bildiren taşınabilir bir cihaz.",
    paragraphs: [
      "Arama kurtarma ekipleri enkaz altındaki insanları çoğu zaman sadece ses ile bulabiliyor. Gürültülü ortamda bu sesleri ayırt etmek zor.",
      "Cihaz, birkaç mikrofonla sesin yönünü ve vuruş örüntüsünü ayırır. Sonuç, ekibin tablet ekranında basit bir yön oku olarak görünür.",
      "Ses işleme, yapısal mühendislik ve mekanik tasarım konularında katkı istiyoruz. Prototipi Bursa'daki bir afet gönüllüleri grubuyla test edeceğiz.",
    ],
    category: "DONANIM",
    stage: "PROTOTIP",
    workMode: "YUZ_YUZE",
    city: "Bursa",
    tags: ["afet", "sinyal işleme", "arama kurtarma"],
    status: "OPEN",
    roles: [
      { title: "Ses işleme mühendisi", group: "elektronik", slots: 2 },
      { title: "Yapısal mühendis", group: "mimarlik", slots: 1 },
      { title: "Mekanik tasarımcı", group: "makine", slots: 1 },
    ],
    members: [{ username: "mert.demir", role: "Ses işleme mühendisi" }],
    joinRequests: [],
    invites: [],
  },
  {
    owner: "ayse.kaya",
    title: "Tıbbi görüntüleri etiketleyen yapay zeka destekli araç",
    summary: "Hekimlerin görüntü etiketleme işini hızlandıran, anonimleştirilmiş veriyle çalışan bir araç.",
    paragraphs: [
      "Görüntü etiketleme, tıbbi yapay zeka projelerinin en yavaş ve en pahalı adımı. Her etiket bir uzmanın zamanını alıyor.",
      "Araç, modelin önerdiği etiketleri hekime sıralı olarak gösterir ve onaylanan etiketleri eğitim verisine ekler. Veri yalnızca anonimleştirilmiş görüntülerle çalışır.",
      "Veri bilimci ve hekim danışman arıyoruz. Etik kurul süreçlerini ve veri güvenliğini baştan birlikte planlamak istiyoruz.",
    ],
    category: "ARASTIRMA",
    stage: "FIKIR",
    workMode: "HIBRIT",
    city: "Ankara",
    tags: ["yapay zeka", "sağlık", "görüntü işleme"],
    status: "OPEN",
    roles: [
      { title: "Veri bilimci", group: "yazilim", slots: 1 },
      { title: "Hekim danışman", group: "saglik", slots: 1 },
    ],
    members: [{ username: "tolga.erdogan", role: "Veri bilimci" }],
    joinRequests: [
      {
        username: "emre.ozturk",
        role: "Hekim danışman",
        message: "Tıp eğitimimde görüntü okuma dersleri aldım. Etiketleme kurallarını klinik açıdan kontrol edebilirim.",
      },
    ],
    invites: [],
  },
  {
    owner: "ece.polat",
    title: "Mezunlar için mentorluk ve kariyer eşleştirme platformu",
    summary: "Mezun ve öğrenci arasında kısa mentorluk görüşmeleri kuran sade bir web uygulaması.",
    paragraphs: [
      "Mezunların birçoğu öğrencilere yardım etmek istiyor, ama nereden başlayacağını bilmiyor. Öğrenciler de doğru kişiye ulaşmakta zorlanıyor.",
      "Platform, ilgi alanına göre kısa ve planlı görüşmeler önerir. Görüşme sonrası kısa bir geri bildirim formu da vardır.",
      "Bu proje kapandı: ilk pilot tamamlandı ve sonuçlar değerlendirildi. Benzer bir çalışmaya katılmak isteyenler için notlar projenin sayfasında kaldı.",
    ],
    category: "GIRISIM",
    stage: "GELISTIRME",
    workMode: "UZAKTAN",
    city: null,
    tags: ["mentorluk", "kariyer"],
    status: "CLOSED",
    roles: [
      { title: "Frontend geliştirici", group: "yazilim", slots: 2 },
      { title: "Pazarlama uzmanı", group: "isletme", slots: 1 },
    ],
    members: [{ username: "ayse.kaya", role: "Frontend geliştirici" }],
    joinRequests: [],
    invites: [],
  },
  {
    owner: "zeynep.arslan",
    title: "Kampüs bisiklet istasyonları için tasarım seti",
    summary: "Bisiklet park noktalarının kimliğini, yönlendirme levhalarını ve kullanım kılavuzunu tek dille birleştiren proje.",
    paragraphs: [
      "Kampüslerdeki bisiklet istasyonları birbirine benzemiyor; öğrenciler nereye ne bırakacağını bilmiyor. Ortak bir tasarım dili bu karmaşayı azaltabilir.",
      "Set; istasyon tabelası, zemin işaretleri ve iki dilli kısa kılavuzdan oluşuyor. Malzeme seçimini dayanıklılık ve geri dönüşüm üzerinden yapıyoruz.",
      "Endüstriyel tasarımcı, şehir plancısı ve iş geliştirme uzmanı arıyoruz. Bütçe ve pilot kurulum planını da birlikte çıkaracağız.",
    ],
    category: "TASARIM",
    stage: "FIKIR",
    workMode: "YUZ_YUZE",
    city: "İstanbul",
    tags: ["kentsel tasarım", "bisiklet", "ulaşım"],
    status: "OPEN",
    roles: [
      { title: "Endüstriyel tasarımcı", group: "tasarim", slots: 1 },
      { title: "Şehir plancısı", group: "mimarlik", slots: 1 },
      { title: "İş geliştirme uzmanı", group: "isletme", slots: 1 },
    ],
    members: [],
    joinRequests: [],
    invites: [
      {
        username: DEMO_USERNAME,
        role: "İş geliştirme uzmanı",
        message: "Pilot kurulum ve bütçe planı için ekibe ihtiyacımız var. İşletme tarafındaki bakış açın çok işe yarar.",
      },
    ],
  },
  {
    owner: "selin.koc",
    title: "Mimari maketler için açık kaynak malzeme kütüphanesi",
    summary: "Maket yapımında kullanılan doku ve malzeme örneklerini ücretsiz paylaşan bir kütüphane.",
    paragraphs: [
      "Öğrenci maketlerinde gerçek malzeme hissi vermek için her seferinde aynı dokuları yeniden arıyoruz. Bu arama hem zaman hem de para kaybettiriyor.",
      "Kütüphane, lisansı açık doku ve malzeme örneklerini kategorilere ayırıp arama ile sunar. Her örneğin kullanım notu ve kaynağı belirtilir.",
      "Bu proje tamamlandı ve yayında. Katkı vermek isteyenler için kütüphanenin depo bağlantısı proje sayfasında duruyor.",
    ],
    category: "YAZILIM",
    stage: "YAYINDA",
    workMode: "UZAKTAN",
    city: null,
    tags: ["açık kaynak", "maket", "mimarlık"],
    status: "CLOSED",
    roles: [
      { title: "Web geliştirici", group: "yazilim", slots: 1 },
      { title: "3B modelleyici", group: "mimarlik", slots: 2 },
    ],
    members: [],
    joinRequests: [],
    invites: [],
  },
  {
    owner: "deniz.aksoy",
    title: "Hukuk öğrencileri için sözleşme okuma asistanı",
    summary: "Uzun sözleşmelerdeki riskli maddeleri işaretleyip sade bir dille özetleyen bir prototip.",
    paragraphs: [
      "Hukuk öğrencileri ve küçük işletmeler, uzun sözleşmelerin hangi maddesinin riskli olduğunu hızlıca anlamakta zorlanıyor.",
      "Prototip, sözleşmeyi bölümlere ayırır, riskli kalıpları işaretler ve her işaretin gerekçesini kısa bir dille yazar. Nihai değerlendirme her zaman bir avukata aittir.",
      "Hukuk danışmanı ve doğal dil işleme geliştiricisi arıyoruz. Test seti için kamuya açık sözleşme örneklerini birlikte derleyeceğiz.",
    ],
    category: "YAZILIM",
    stage: "PROTOTIP",
    workMode: "HIBRIT",
    city: "Ankara",
    tags: ["hukuk", "doğal dil işleme", "sözleşme"],
    status: "OPEN",
    roles: [
      { title: "Hukuk danışmanı", group: "hukuk", slots: 1 },
      { title: "Doğal dil işleme geliştiricisi", group: "yazilim", slots: 1 },
    ],
    members: [],
    joinRequests: [],
    invites: [],
  },
  {
    owner: "irem.gunes",
    title: "Yerel üreticiler için hasat tahmin paneli",
    summary: "Hava ve toprak verisinden hasat dönemini tahmin edip üreticilere sade bir panel sunan proje.",
    paragraphs: [
      "Küçük üreticiler hasat zamanını çoğunlukla gözleme göre belirliyor. Bu da pazarlama ve depolama kararlarını zorlaştırıyor.",
      "Panel, açık meteoroloji verisi ve bölgesel toprak analizlerini birleştirerek bir hasat aralığı önerir. Tahmin belirsizliği her zaman gösterilir.",
      "Veri analisti, biyolog ve saha veri toplayıcısı arıyoruz. Trabzon'daki iki köyde ilk saha çalışmasını planlıyoruz.",
    ],
    category: "ARASTIRMA",
    stage: "GELISTIRME",
    workMode: "UZAKTAN",
    city: null,
    tags: ["tarım", "veri", "hasat"],
    status: "OPEN",
    roles: [
      { title: "Veri analisti", group: "yazilim", slots: 1 },
      { title: "Biyolog", group: "temel", slots: 1 },
      {
        title: "Sahadan veri toplayıcı",
        group: "sosyal",
        slots: 2,
        description: "Köy ziyaretlerinde kısa anketleri uygulayabilecek biri.",
      },
    ],
    members: [],
    joinRequests: [],
    invites: [
      {
        username: "nazli.bozkurt",
        role: "Sahadan veri toplayıcı",
        message: "Köy ziyaretlerinde anket uygulamak için destek arıyoruz. Görüşme tekniği bilgin bu iş için çok uygun.",
      },
    ],
  },
];

// Mesajlaşma ve bildirim verisi.
const ACTIVE_CHAT_BODIES: Array<{ from: string; body: string }> = [
  { from: "ayse.kaya", body: "Merhaba Mert, sulama sensörü paylaşımını gördüm. Veri analizi tarafında yardımcı olabilir miyim?" },
  { from: "mert.demir", body: "Selam Ayşe! Evet, özellikle sensör verisini temizleyip görselleştirme kısmına ihtiyacımız var." },
  { from: "ayse.kaya", body: "Harika. Ölçüm dosyalarını nasıl topluyorsunuz? CSV mi, yoksa doğrudan bir veritabanına mı yazıyorsunuz?" },
  { from: "mert.demir", body: "Şimdilik SD karta CSV yazıyoruz. Sonrasında bir sunucuya toplamayı düşünüyoruz." },
  { from: "ayse.kaya", body: "O zaman önce CSV şemasını sabitleyelim. Bir taslak yollayabilirim, bakarsın." },
  { from: "mert.demir", body: "Olur, bu hafta sonu bakarım. Salı günü saha ziyareti planlıyoruz, katılmak ister misin?" },
];

const REQUEST_CHAT_BODY = {
  from: "deniz.aksoy",
  body: "Merhaba Elif, ders kitabı pazarı projene baktım. Sözleşme ve kullanım koşulları tarafında destek olabilirim.",
};

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** Kullanıcı kimliklerini sıralı çift olarak döner (userAId < userBId). */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Proje arama metni: projects/actions.ts içindeki projectSearchText ile aynı kurallar. */
function projectSearchText(input: {
  title: string;
  summary: string;
  description: string;
  tags: string[];
  roles: RoleSeed[];
  category: Category;
  city: string | null;
}): string {
  return toSearchText(
    input.title,
    input.summary,
    input.description,
    input.tags,
    input.roles.map((role) => role.title),
    input.roles.map((role) => getDisciplineGroup(role.group)?.label ?? ""),
    labelOf(CATEGORIES, input.category),
    input.city ?? "",
  );
}

const MASKED_SAMPLE_TEXT = [
  "ÖĞRENCİ BELGESİ",
  "Adı Soyadı: [AD SOYAD]",
  "T.C. Kimlik No: [TCKN]",
  "Ana Adı: [GİZLİ]",
  "Kurum: Yabancı üniversite (örnek kayıt)",
  "Program: Bilgisayar Bilimleri, Yüksek Lisans",
  "Akademik Yıl: 2026-2027",
].join("\n");

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

interface Counts {
  users: number;
  verifiedUsers: number;
  projects: number;
  roles: number;
  members: number;
  joinRequests: number;
  invites: number;
  follows: number;
  conversations: number;
  messages: number;
  notifications: number;
  reports: number;
}

async function wipe(tx: Prisma.TransactionClient): Promise<void> {
  // Yabancı anahtar sırası: önce çocuk tablolar, en son kullanıcılar.
  await tx.adminAuditLog.deleteMany();
  await tx.report.deleteMany();
  await tx.block.deleteMany();
  await tx.notification.deleteMany();
  await tx.message.deleteMany();
  await tx.conversationRead.deleteMany();
  await tx.conversation.deleteMany();
  await tx.introduction.deleteMany();
  await tx.follow.deleteMany();
  await tx.projectInvite.deleteMany();
  await tx.joinRequest.deleteMany();
  await tx.projectMember.deleteMany();
  await tx.projectRole.deleteMany();
  await tx.project.deleteMany();
  await tx.verificationAttempt.deleteMany();
  await tx.consent.deleteMany();
  await tx.passwordResetToken.deleteMany();
  await tx.loginEvent.deleteMany();
  await tx.session.deleteMany();
  await tx.user.deleteMany();
}

interface PasswordHashes {
  admin: string;
  user: string;
}

async function populate(
  tx: Prisma.TransactionClient,
  hashes: PasswordHashes,
  adminEmail: string,
): Promise<Counts> {
  const now = new Date();
  const ids: Record<string, string> = {};
  const counts: Counts = {
    users: 0,
    verifiedUsers: 0,
    projects: 0,
    roles: 0,
    members: 0,
    joinRequests: 0,
    invites: 0,
    follows: 0,
    conversations: 0,
    messages: 0,
    notifications: 0,
    reports: 0,
  };

  // Yönetici: yalnız role ADMIN ile yetki verilir (ADMIN_EMAILS yetki vermez).
  const admin = await tx.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashes.admin,
      firstName: "Proje",
      lastName: "Yönetimi",
      username: ADMIN_USERNAME,
      role: "ADMIN",
      verificationStatus: "VERIFIED",
      verifiedAt: now,
      searchText: toSearchText("Proje", "Yönetimi", ADMIN_USERNAME),
    },
    select: { id: true },
  });
  ids[ADMIN_USERNAME] = admin.id;
  await tx.consent.createMany({
    data: [
      { userId: admin.id, type: "PRIVACY_NOTICE", version: LEGAL_VERSION, granted: true },
      { userId: admin.id, type: "TERMS", version: LEGAL_VERSION, granted: true },
    ],
  });
  counts.users += 1;

  // 16 doğrulanmış kullanıcı: profil, onaylı belge kaydı ve rızalar.
  for (const person of PEOPLE) {
    const disciplineGroup = disciplineGroupForDepartment(person.department);
    if (!disciplineGroup) {
      throw new Error(`Bölüm bir disiplin grubuna eşlenemedi: ${person.department}`);
    }
    const skillsJson = toListJson(person.skills);
    const interestsJson = toListJson(person.interests);
    const user = await tx.user.create({
      data: {
        email: `${person.username}@${DEMO_DOMAIN}`,
        passwordHash: hashes.user,
        firstName: person.firstName,
        lastName: person.lastName,
        username: person.username,
        bio: person.bio,
        city: person.city,
        skillsJson,
        interestsJson,
        lookingForProject: person.lookingForProject,
        verificationStatus: "VERIFIED",
        academicStatus: person.academicStatus,
        university: person.university,
        faculty: person.faculty,
        department: person.department,
        disciplineGroup,
        degreeLevel: person.degreeLevel,
        classYear: person.classYear,
        graduationYear: person.graduationYear,
        verifiedAt: now,
        searchText: toSearchText(
          person.firstName,
          person.lastName,
          person.username,
          person.university,
          person.faculty,
          person.department,
          person.city,
          person.skills,
          person.interests,
        ),
      },
      select: { id: true },
    });
    ids[person.username] = user.id;

    await tx.verificationAttempt.create({
      data: {
        userId: user.id,
        status: "APPROVED",
        source: "PDF_TEXT",
        docHash: randomDocHash(),
        nameMatch: true,
        documentType: person.documentType,
        aiUsed: true,
        aiModel: "seed",
        aiConfidence: 0.95,
        aiSummary: "Belge yükseköğretim kurumu belgesi biçiminde tutarlı görünüyor.",
        redFlagsJson: "[]",
        extractedJson: JSON.stringify({
          academicStatus: person.academicStatus,
          university: person.university,
          faculty: person.faculty,
          department: person.department,
          degreeLevel: person.degreeLevel,
          classYear: person.classYear,
          graduationYear: person.graduationYear,
        }),
        processingMs: randomInt(1800, 4200),
        createdAt: now,
      },
    });

    await tx.consent.createMany({
      data: [
        { userId: user.id, type: "PRIVACY_NOTICE", version: LEGAL_VERSION, granted: true },
        { userId: user.id, type: "TERMS", version: LEGAL_VERSION, granted: true },
        { userId: user.id, type: "CROSS_BORDER_AI", version: LEGAL_VERSION, granted: person.crossBorderAi },
      ],
    });
    counts.users += 1;
    counts.verifiedUsers += 1;
  }

  // Doğrulanmamış kullanıcı: belge yüklemedi, misafir yetkisinin ötesine geçemez.
  const unverified = await tx.user.create({
    data: {
      email: `yeni.kullanici@${DEMO_DOMAIN}`,
      passwordHash: hashes.user,
      firstName: "Kaan",
      lastName: "Eren",
      username: "yeni.kullanici",
      verificationStatus: "UNVERIFIED",
      searchText: toSearchText("Kaan", "Eren", "yeni.kullanici"),
    },
    select: { id: true },
  });
  ids["yeni.kullanici"] = unverified.id;
  await tx.consent.createMany({
    data: [
      { userId: unverified.id, type: "PRIVACY_NOTICE", version: LEGAL_VERSION, granted: true },
      { userId: unverified.id, type: "TERMS", version: LEGAL_VERSION, granted: true },
      { userId: unverified.id, type: "CROSS_BORDER_AI", version: LEGAL_VERSION, granted: false },
    ],
  });
  counts.users += 1;

  // Manuel incelemede: maskeli örnek metin yalnız bu kayıtta tutulur.
  const pending = await tx.user.create({
    data: {
      email: `oguz.tuna@${DEMO_DOMAIN}`,
      passwordHash: hashes.user,
      firstName: "Oğuz",
      lastName: "Tuna",
      username: "oguz.tuna",
      verificationStatus: "MANUAL_REVIEW",
      searchText: toSearchText("Oğuz", "Tuna", "oguz.tuna"),
    },
    select: { id: true },
  });
  ids["oguz.tuna"] = pending.id;
  await tx.verificationAttempt.create({
    data: {
      userId: pending.id,
      status: "MANUAL_REVIEW",
      source: "PDF_TEXT",
      docHash: randomDocHash(),
      nameMatch: true,
      documentType: "DIPLOMA",
      aiUsed: true,
      aiModel: "seed",
      aiConfidence: 0.62,
      aiSummary: "Belge yabancı bir kuruma ait görünüyor; insan incelemesi gerekli.",
      redFlagsJson: JSON.stringify(["Kurum adı Türkiye dışında görünüyor"]),
      extractedJson: "{}",
      maskedText: MASKED_SAMPLE_TEXT,
      maskedTextExpiresAt: new Date(now.getTime() + MASKED_TEXT_RETENTION_DAYS * DAY),
      rejectReason: "Belge yabancı bir kuruma ait görünüyor; inceleme gerekli.",
      processingMs: 3100,
      createdAt: now,
    },
  });
  await tx.consent.createMany({
    data: [
      { userId: pending.id, type: "PRIVACY_NOTICE", version: LEGAL_VERSION, granted: true },
      { userId: pending.id, type: "TERMS", version: LEGAL_VERSION, granted: true },
      { userId: pending.id, type: "CROSS_BORDER_AI", version: LEGAL_VERSION, granted: true },
    ],
  });
  counts.users += 1;

  // Takipler.
  const followRows: Array<{ followerId: string; followingId: string }> = [];
  for (const [follower, targets] of Object.entries(FOLLOWS)) {
    for (const target of targets) {
      followRows.push({ followerId: ids[follower], followingId: ids[target] });
    }
  }
  await tx.follow.createMany({ data: followRows });
  counts.follows = followRows.length;

  // Projeler, roller, sahip ve üyeler.
  const projectIds: Record<string, string> = {};
  const roleIdByProject: Record<string, Record<string, string>> = {};
  for (const seed of PROJECTS) {
    const description = seed.paragraphs.join("\n\n");
    const project = await tx.project.create({
      data: {
        ownerId: ids[seed.owner],
        title: seed.title,
        summary: seed.summary,
        description,
        category: seed.category,
        stage: seed.stage,
        workMode: seed.workMode,
        city: seed.city,
        tagsJson: toListJson(seed.tags),
        status: seed.status,
        searchText: projectSearchText({
          title: seed.title,
          summary: seed.summary,
          description,
          tags: seed.tags,
          roles: seed.roles,
          category: seed.category,
          city: seed.city,
        }),
        roles: {
          create: seed.roles.map((role) => ({
            title: role.title,
            disciplineGroup: role.group,
            description: role.description ?? null,
            slots: role.slots,
          })),
        },
      },
      include: { roles: true },
    });
    projectIds[seed.title] = project.id;
    counts.projects += 1;
    counts.roles += project.roles.length;

    const roleIds: Record<string, string> = {};
    for (const role of project.roles) roleIds[role.title] = role.id;
    roleIdByProject[seed.title] = roleIds;

    const roleFor = (title: string): string => {
      const roleId = roleIds[title];
      if (!roleId) throw new Error(`Rol bulunamadı: ${seed.title} / ${title}`);
      return roleId;
    };

    await tx.projectMember.create({
      data: { projectId: project.id, userId: ids[seed.owner], roleId: null, isOwner: true },
    });
    counts.members += 1;

    for (const member of seed.members) {
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: ids[member.username],
          roleId: roleFor(member.role),
          isOwner: false,
        },
      });
      counts.members += 1;
    }

    for (const request of seed.joinRequests) {
      await tx.joinRequest.create({
        data: {
          projectId: project.id,
          userId: ids[request.username],
          roleId: roleFor(request.role),
          message: request.message,
          status: "PENDING",
        },
      });
      counts.joinRequests += 1;
    }

    for (const invite of seed.invites) {
      await tx.projectInvite.create({
        data: {
          projectId: project.id,
          inviterId: ids[seed.owner],
          inviteeId: ids[invite.username],
          roleId: roleFor(invite.role),
          message: invite.message,
          status: "PENDING",
        },
      });
      counts.invites += 1;
    }
  }

  // Aktif sohbet: karşılıklı takipçiler (ayşe ↔ mert), 6 mesaj.
  const chatStart = now.getTime() - 3 * HOUR;
  const [activeA, activeB] = orderedPair(ids["ayse.kaya"], ids["mert.demir"]);
  const activeConversation = await tx.conversation.create({
    data: {
      userAId: activeA,
      userBId: activeB,
      initiatorId: ids["ayse.kaya"],
      status: "ACTIVE",
      lastMessageAt: new Date(chatStart + ACTIVE_CHAT_BODIES.length * 5 * MINUTE),
    },
    select: { id: true },
  });
  await tx.message.createMany({
    data: ACTIVE_CHAT_BODIES.map((message, index) => ({
      conversationId: activeConversation.id,
      senderId: ids[message.from],
      body: message.body,
      createdAt: new Date(chatStart + index * 5 * MINUTE),
    })),
  });
  await tx.conversationRead.create({
    data: {
      conversationId: activeConversation.id,
      userId: ids["ayse.kaya"],
      lastReadAt: new Date(chatStart + ACTIVE_CHAT_BODIES.length * 5 * MINUTE),
    },
  });
  counts.conversations += 1;
  counts.messages += ACTIVE_CHAT_BODIES.length;

  // Mesaj isteği: deniz (takip etmiyor) demo kullanıcıya ilk mesajı gönderdi.
  const [requestA, requestB] = orderedPair(ids["deniz.aksoy"], ids[DEMO_USERNAME]);
  const requestConversation = await tx.conversation.create({
    data: {
      userAId: requestA,
      userBId: requestB,
      initiatorId: ids["deniz.aksoy"],
      status: "REQUEST",
      lastMessageAt: new Date(now.getTime() - 40 * MINUTE),
    },
    select: { id: true },
  });
  await tx.message.create({
    data: {
      conversationId: requestConversation.id,
      senderId: ids[REQUEST_CHAT_BODY.from],
      body: REQUEST_CHAT_BODY.body,
      createdAt: new Date(now.getTime() - 40 * MINUTE),
    },
  });
  counts.conversations += 1;
  counts.messages += 1;

  // Bildirimler (demo kullanıcı için farklı türler; bazıları okunmamış).
  const notifications: Array<{
    userId: string;
    type: string;
    actorId?: string;
    projectId?: string;
    conversationId?: string;
    data?: Record<string, unknown>;
    readAt: Date | null;
    minutesAgo: number;
  }> = [
    {
      userId: ids[DEMO_USERNAME],
      type: "FOLLOW",
      actorId: ids["ayse.kaya"],
      readAt: null,
      minutesAgo: 25,
    },
    {
      userId: ids[DEMO_USERNAME],
      type: "MESSAGE_REQUEST",
      actorId: ids["deniz.aksoy"],
      conversationId: requestConversation.id,
      readAt: null,
      minutesAgo: 40,
    },
    {
      userId: ids[DEMO_USERNAME],
      type: "INVITE",
      actorId: ids["zeynep.arslan"],
      projectId: projectIds["Kampüs bisiklet istasyonları için tasarım seti"],
      data: { role: "İş geliştirme uzmanı" },
      readAt: null,
      minutesAgo: 90,
    },
    {
      userId: ids[DEMO_USERNAME],
      type: "NEW_PROJECT_FROM_FOLLOWING",
      actorId: ids["zeynep.arslan"],
      projectId: projectIds["Kampüs bisiklet istasyonları için tasarım seti"],
      readAt: null,
      minutesAgo: 120,
    },
    {
      userId: ids[DEMO_USERNAME],
      type: "VERIFICATION_RESULT",
      data: { status: "APPROVED" },
      readAt: new Date(now.getTime() - 2 * DAY),
      minutesAgo: 2 * 24 * 60,
    },
    {
      userId: ids["burak.sahin"],
      type: "JOIN_REQUEST",
      actorId: ids["nazli.bozkurt"],
      projectId: projectIds["Otizmli çocuklar için duygu tanıma oyunu"],
      readAt: null,
      minutesAgo: 60,
    },
    {
      userId: ids["baris.tekin"],
      type: "JOIN_REQUEST",
      actorId: ids["ozge.karaca"],
      projectId: projectIds["Türk halk müziği için yapay zeka destekli nota çıkarıcı"],
      readAt: null,
      minutesAgo: 180,
    },
    {
      userId: ids["ayse.kaya"],
      type: "JOIN_ACCEPTED",
      actorId: ids["ece.polat"],
      projectId: projectIds["Mezunlar için mentorluk ve kariyer eşleştirme platformu"],
      readAt: new Date(now.getTime() - DAY),
      minutesAgo: 3 * 24 * 60,
    },
  ];
  await tx.notification.createMany({
    data: notifications.map((item) => ({
      userId: item.userId,
      type: item.type,
      actorId: item.actorId ?? null,
      projectId: item.projectId ?? null,
      conversationId: item.conversationId ?? null,
      dataJson: JSON.stringify(item.data ?? {}),
      readAt: item.readAt,
      createdAt: new Date(now.getTime() - item.minutesAgo * MINUTE),
    })),
  });
  counts.notifications = notifications.length;

  // Açık bir şikayet (moderasyon kuyruğu için).
  await tx.report.create({
    data: {
      reporterId: ids["nazli.bozkurt"],
      targetType: "PROJECT",
      targetId: projectIds["Yerel üreticiler için hasat tahmin paneli"],
      reason: "Gerçek olmayan proje",
      details: "Proje sayfasında hasat verisinin nereden alındığı belirtilmemiş.",
      status: "OPEN",
    },
  });
  counts.reports = 1;

  return counts;
}

async function main(): Promise<void> {
  loadDotEnv();

  const problem = seedProblem(process.env);
  if (problem) throw new Error(problem);

  const adminEmail = requireEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const userPassword = requireEnv("SEED_USER_PASSWORD");
  for (const password of [adminPassword, userPassword]) {
    const passwordProblem = validatePasswordStrength(password);
    if (passwordProblem) throw new Error(`Tohum parolası geçersiz: ${passwordProblem}`);
  }

  // Parola özetleri bir kez hesaplanır. Tohum kullanıcıları ortak geliştirme parolasını kullanır.
  const hashes: PasswordHashes = {
    admin: await hashPassword(adminPassword),
    user: await hashPassword(userPassword),
  };

  const prisma = new PrismaClient();
  try {
    console.log("Tohum verisi yazılıyor. Mevcut tüm veriler silinir.");
    const counts = await prisma.$transaction(
      async (tx) => {
        await wipe(tx);
        return populate(tx, hashes, adminEmail);
      },
      { timeout: 120_000, maxWait: 20_000 },
    );

    console.log("Tohum tamamlandı:");
    console.log(`- Kullanıcı: ${counts.users} (doğrulanmış ${counts.verifiedUsers}, yönetici 1, doğrulanmamış 1, manuel incelemede 1)`);
    console.log(`- Proje: ${counts.projects} (rol ${counts.roles}, üye ${counts.members})`);
    console.log(`- Katılma başvurusu: ${counts.joinRequests} bekleyen; davet: ${counts.invites} bekleyen`);
    console.log(`- Takip ilişkisi: ${counts.follows}`);
    console.log(`- Sohbet: ${counts.conversations} (mesaj ${counts.messages})`);
    console.log(`- Bildirim: ${counts.notifications}; açık şikayet: ${counts.reports}`);
    console.log("Demo giriş e-postaları:");
    console.log(`- Yönetici: ${adminEmail}`);
    console.log(`- Demo kullanıcı (bildirim ve davet içerir): ${DEMO_USERNAME}@${DEMO_DOMAIN}`);
    console.log("Parolalar .env.example dosyasındaki SEED_ADMIN_PASSWORD ve SEED_USER_PASSWORD değerleridir.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Tohum çalıştırılamadı.");
  process.exitCode = 1;
});
