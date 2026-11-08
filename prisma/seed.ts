import { PrismaClient } from "@prisma/client";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { toSearchText } from "../src/lib/tr";

const prisma = new PrismaClient();

// Yönetici tohumu. SEED_ADMIN_EMAIL adresiyle hesap yoksa role ADMIN olarak oluşturur.
// Var olan bir hesabı yönetici YAPMAZ: e-posta sahipliği doğrulanmadığı için, bu adresi önceden
// kaydetmiş bir yabancının hesabı tohum çalışınca yönetici olmamalı. Bu durumda yetki el ile verilir.
async function bootstrapAdmin(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    console.info("SEED_ADMIN_EMAIL boş; yönetici oluşturulmadı.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    console.info(
      existing.role === "ADMIN"
        ? "Yönetici hesabı zaten var."
        : "Bu e-posta zaten kayıtlı ve yönetici değil. Hiçbir hesap değiştirilmedi; yönetici yetkisi el ile verilmeli.",
    );
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  const problem = validatePasswordStrength(password);
  if (problem) throw new Error(`SEED_ADMIN_PASSWORD geçersiz: ${problem}`);

  const firstName = "Yönetici";
  const lastName = "Hesabı";
  const username = "yonetici";
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      firstName,
      lastName,
      username,
      role: "ADMIN",
      searchText: toSearchText(firstName, lastName, username),
    },
  });
  console.info("Yönetici hesabı oluşturuldu.");
}

async function main(): Promise<void> {
  await bootstrapAdmin();
  // Sonraki görevler örnek veriyi burada üretecek.
  console.log("Seed henüz hazır değil");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed başarısız oldu.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
