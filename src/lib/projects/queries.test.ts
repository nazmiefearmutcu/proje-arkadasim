import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { toSearchText } from "@/lib/tr";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { getProjectDetail, getViewerOpenProjectsForInvite, listProjects } from "./queries";

interface ProjectSeed {
  ownerId: string;
  title: string;
  summary?: string;
  category?: string;
  stage?: string;
  workMode?: string;
  city?: string | null;
  status?: string;
  createdAt?: Date;
  roles?: Array<{ title: string; disciplineGroup: string; slots: number }>;
  memberIds?: string[];
}

async function makeProject(seed: ProjectSeed) {
  const roles = seed.roles ?? [{ title: "Geliştirici", disciplineGroup: "yazilim", slots: 2 }];
  const title = seed.title;
  const summary = seed.summary ?? "Öğrencilerin birlikte geliştirdiği bir proje özeti.";
  const project = await db.project.create({
    data: {
      ownerId: seed.ownerId,
      title,
      summary,
      description: "Açıklama metni, en az seksen karakter olacak şekilde yazılmış bir proje açıklaması.",
      category: seed.category ?? "YAZILIM",
      stage: seed.stage ?? "FIKIR",
      workMode: seed.workMode ?? "UZAKTAN",
      city: seed.city ?? null,
      status: seed.status ?? "OPEN",
      createdAt: seed.createdAt ?? new Date(),
      searchText: toSearchText(title, summary, roles.map((role) => role.title)),
      roles: {
        create: roles.map((role) => ({
          title: role.title,
          disciplineGroup: role.disciplineGroup,
          slots: role.slots,
        })),
      },
      members: { create: [{ userId: seed.ownerId, isOwner: true }] },
    },
    include: { roles: true },
  });
  for (const memberId of seed.memberIds ?? []) {
    await db.projectMember.create({
      data: { projectId: project.id, userId: memberId, roleId: project.roles[0]?.id ?? null },
    });
  }
  return project;
}

describe("listProjects", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("arama sorgusunu katlanmış belirteçlerle AND olarak eşleştirir", async () => {
    const owner = await createUser();
    const match = await makeProject({ ownerId: owner.id, title: "Robotik kol kontrolü" , summary: "Kameralı robotik kol için yazılım altyapısı kuruyoruz."});
    await makeProject({ ownerId: owner.id, title: "Robotik olmayan proje", summary: "Bu projede bambaşka bir konu ele alınıyor." });

    const result = await listProjects({ q: "ROBOTİK motor" });
    expect(result.items.map((item) => item.id)).toEqual([]);

    const found = await listProjects({ q: "Robotik KOL" });
    expect(found.items.map((item) => item.id)).toEqual([match.id]);
  });

  it("disiplin filtresi yalnız o disiplini arayan rolü olan projeleri getirir", async () => {
    const owner = await createUser();
    const design = await makeProject({
      ownerId: owner.id,
      title: "Tasarım odaklı uygulama",
      roles: [{ title: "UI tasarımcısı", disciplineGroup: "tasarim", slots: 1 }],
    });
    await makeProject({
      ownerId: owner.id,
      title: "Sadece yazılım projesi",
      roles: [{ title: "Backend geliştirici", disciplineGroup: "yazilim", slots: 1 }],
    });

    const result = await listProjects({ disciplineGroup: "tasarim" });
    expect(result.items.map((item) => item.id)).toEqual([design.id]);
  });

  it("çalışma şekli ve şehir filtrelerini uygular", async () => {
    const owner = await createUser();
    const onsite = await makeProject({ ownerId: owner.id, title: "Ankara yüz yüze proje", workMode: "YUZ_YUZE", city: "Ankara" });
    await makeProject({ ownerId: owner.id, title: "Uzaktan proje birinci", workMode: "UZAKTAN" });
    await makeProject({ ownerId: owner.id, title: "İzmir yüz yüze proje", workMode: "YUZ_YUZE", city: "İzmir" });

    const byMode = await listProjects({ workMode: "YUZ_YUZE" });
    expect(byMode.items).toHaveLength(2);

    const byCity = await listProjects({ workMode: "YUZ_YUZE", city: "Ankara" });
    expect(byCity.items.map((item) => item.id)).toEqual([onsite.id]);
  });

  it("kapalı projeleri keşifte gizler", async () => {
    const owner = await createUser();
    const open = await makeProject({ ownerId: owner.id, title: "Açık olan proje" });
    await makeProject({ ownerId: owner.id, title: "Kapanmış olan proje", status: "CLOSED" });

    const result = await listProjects({});
    expect(result.items.map((item) => item.id)).toEqual([open.id]);
  });

  it("ownerOrMemberId modunda kapalı projeler de görünür, başkalarınınki görünmez", async () => {
    const me = await createUser();
    const other = await createUser();
    const closedOwned = await makeProject({ ownerId: me.id, title: "Kapalı kendi projem", status: "CLOSED" });
    const memberOf = await makeProject({ ownerId: other.id, title: "Üyesi olduğum proje", status: "OPEN" });
    await db.projectMember.create({ data: { projectId: memberOf.id, userId: me.id } });
    await makeProject({ ownerId: other.id, title: "Hiç ilgim olmayan proje" });

    const result = await listProjects({ ownerOrMemberId: me.id });
    expect(result.items.map((item) => item.id).sort()).toEqual([closedOwned.id, memberOf.id].sort());
  });

  it("sayfalama: hasMore son sayfada false olur, en yeni önce gelir", async () => {
    const owner = await createUser();
    const base = Date.now();
    const first = await makeProject({ ownerId: owner.id, title: "Birinci en eski proje", createdAt: new Date(base - 3000) });
    const second = await makeProject({ ownerId: owner.id, title: "İkinci orta yaşlı proje", createdAt: new Date(base - 2000) });
    const third = await makeProject({ ownerId: owner.id, title: "Üçüncü en yeni proje", createdAt: new Date(base - 1000) });

    const page1 = await listProjects({ page: 1, pageSize: 2 });
    expect(page1.items.map((item) => item.id)).toEqual([third.id, second.id]);
    expect(page1.hasMore).toBe(true);

    const page2 = await listProjects({ page: 2, pageSize: 2 });
    expect(page2.items.map((item) => item.id)).toEqual([first.id]);
    expect(page2.hasMore).toBe(false);
  });
});

describe("getProjectDetail", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sahibe başvuru ve davet listelerini gösterir, ziyaretçiye göstermez", async () => {
    const owner = await createUser();
    const applicant = await createUser({ firstName: "Can", lastName: "Demir" });
    const project = await makeProject({ ownerId: owner.id, title: "Başvuru alan proje" });
    const role = project.roles[0];
    await db.joinRequest.create({
      data: {
        projectId: project.id,
        userId: applicant.id,
        roleId: role?.id,
        message: "Bu projede gerçekten katkı sunabilirim, deneyimim var.",
      },
    });

    const asOwner = await getProjectDetail(project.id, owner);
    expect(asOwner?.viewer.isOwner).toBe(true);
    expect(asOwner?.ownerView?.requests).toHaveLength(1);
    expect(asOwner?.ownerView?.requests[0]?.person.firstName).toBe("Can");

    const asGuest = await getProjectDetail(project.id, null);
    expect(asGuest?.viewer.isOwner).toBe(false);
    expect(asGuest?.ownerView).toBeNull();
  });

  it("ziyaretçinin bekleyen başvurusunu ve dolu rol durumunu döner", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const project = await makeProject({
      ownerId: owner.id,
      title: "Rol durumu olan proje",
      roles: [{ title: "Geliştirici", disciplineGroup: "yazilim", slots: 1 }],
    });
    const role = project.roles[0];
    if (!role) throw new Error("rol oluşturulamadı");
    const request = await db.joinRequest.create({
      data: {
        projectId: project.id,
        userId: applicant.id,
        roleId: role.id,
        message: "Bu projede gerçekten katkı sunabilirim, deneyimim var.",
      },
    });

    const detail = await getProjectDetail(project.id, applicant);
    expect(detail?.viewer.pendingRequest?.id).toBe(request.id);
    expect(detail?.roles[0]).toMatchObject({ filled: 0, open: 1, full: false });
    expect(detail?.counts.members).toBe(1);
  });

  it("olmayan proje için null döner", async () => {
    expect(await getProjectDetail("yok-boyle-bir-proje", null)).toBeNull();
  });
});

describe("getViewerOpenProjectsForInvite", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("yalnız görüntüleyenin açık projelerini roller ve açık kontenjanla döner", async () => {
    const me = await createUser();
    const other = await createUser();
    const mine = await makeProject({ ownerId: me.id, title: "Benim açık projem" });
    await makeProject({ ownerId: me.id, title: "Benim kapalı projem", status: "CLOSED" });
    await makeProject({ ownerId: other.id, title: "Başkasının projesi" });

    const list = await getViewerOpenProjectsForInvite(me.id);
    expect(list.map((project) => project.id)).toEqual([mine.id]);
    expect(list[0]?.roles[0]).toMatchObject({ openSlots: 2 });
  });
});
