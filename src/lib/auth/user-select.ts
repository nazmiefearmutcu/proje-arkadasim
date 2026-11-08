import type { Prisma } from "@prisma/client";

// Oturumdaki kullanıcıya ait alanlar. Parola özeti ve e-posta dışındaki kişisel alanlar yalnız
// ihtiyaç duyulan kadar seçilir. Ayrı dosyada tutulur ki session.ts ile guards.ts döngüsel
// içe aktarma yapmasın; guards.ts bunu yeniden dışa aktarır.
export const currentUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarPath: true,
  role: true,
  verificationStatus: true,
  academicStatus: true,
  university: true,
  faculty: true,
  department: true,
  disciplineGroup: true,
  degreeLevel: true,
  classYear: true,
  graduationYear: true,
  city: true,
  skillsJson: true,
  interestsJson: true,
  lookingForProject: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type CurrentUser = Prisma.UserGetPayload<{ select: typeof currentUserSelect }>;
