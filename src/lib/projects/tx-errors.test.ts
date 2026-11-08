import { describe, expect, it } from "vitest";
import { isTransientTxError } from "./tx-errors";

describe("isTransientTxError", () => {
  it("Prisma yazma çakışması ve transaction zaman aşımı kodlarını geçici sayar", () => {
    expect(isTransientTxError(Object.assign(new Error("write conflict"), { code: "P2034" }))).toBe(true);
    expect(isTransientTxError(Object.assign(new Error("Transaction API error"), { code: "P2028" }))).toBe(true);
  });

  it("SQLite kilit iletilerini geçici sayar", () => {
    expect(isTransientTxError(new Error("Error code 5: database is locked"))).toBe(true);
    expect(isTransientTxError(new Error("SqliteFailure { code: DatabaseBusy }"))).toBe(true);
    expect(isTransientTxError(new Error("SQLITE_BUSY: cannot commit"))).toBe(true);
  });

  it("diğer hataları geçici saymaz", () => {
    expect(isTransientTxError(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe(false);
    expect(isTransientTxError(new Error("Bu rolün kontenjanı dolu."))).toBe(false);
    expect(isTransientTxError("database is locked")).toBe(false);
    expect(isTransientTxError(null)).toBe(false);
  });
});
