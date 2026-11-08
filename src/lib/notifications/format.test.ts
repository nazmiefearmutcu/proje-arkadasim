import { describe, expect, it } from "vitest";
import { FALLBACK_TEXT, formatNotification } from "./format";

const actor = { firstName: "Ayşe", lastName: "Nur Kılıç", username: "aysenur" };
const project = { id: "proj1", title: "Akıllı Sera" };
const FALLBACK = { text: FALLBACK_TEXT, href: "/bildirimler" };

describe("formatNotification", () => {
  it("FOLLOW links to the follower's profile", () => {
    expect(formatNotification({ type: "FOLLOW", data: {}, actor })).toEqual({
      text: "Ayşe Nur Kılıç seni takip etmeye başladı.",
      href: "/u/aysenur",
      icon: "follow",
    });
  });

  it("JOIN_REQUEST links to the applications section of the project", () => {
    expect(formatNotification({ type: "JOIN_REQUEST", data: {}, actor, project })).toEqual({
      text: "Ayşe Nur Kılıç, “Akıllı Sera” projene katılmak istiyor.",
      href: "/projeler/proj1#basvurular",
      icon: "request",
    });
  });

  it("JOIN_ACCEPTED and JOIN_REJECTED link to the project", () => {
    expect(formatNotification({ type: "JOIN_ACCEPTED", data: {}, project })).toEqual({
      text: "“Akıllı Sera” ekibine kabul edildin.",
      href: "/projeler/proj1",
      icon: "accepted",
    });
    expect(formatNotification({ type: "JOIN_REJECTED", data: {}, project })).toEqual({
      text: "“Akıllı Sera” için başvurun bu kez kabul edilmedi.",
      href: "/projeler/proj1",
      icon: "rejected",
    });
  });

  it("INVITE links to the invitations tab of the network", () => {
    expect(formatNotification({ type: "INVITE", data: {}, actor, project })).toEqual({
      text: "Ayşe Nur Kılıç seni “Akıllı Sera” projesine davet etti.",
      href: "/network?sekme=davetler",
      icon: "invite",
    });
  });

  it("INVITE_ACCEPTED and INVITE_DECLINED link to the project", () => {
    expect(formatNotification({ type: "INVITE_ACCEPTED", data: {}, actor, project })).toEqual({
      text: "Ayşe Nur Kılıç, “Akıllı Sera” davetini kabul etti.",
      href: "/projeler/proj1",
      icon: "accepted",
    });
    expect(formatNotification({ type: "INVITE_DECLINED", data: {}, actor, project })).toEqual({
      text: "Ayşe Nur Kılıç, “Akıllı Sera” davetini kabul etmedi.",
      href: "/projeler/proj1",
      icon: "rejected",
    });
  });

  it("MESSAGE_REQUEST links to the requests tab of messages", () => {
    expect(formatNotification({ type: "MESSAGE_REQUEST", data: {}, actor })).toEqual({
      text: "Ayşe Nur Kılıç sana mesaj isteği gönderdi.",
      href: "/mesajlar?sekme=istekler",
      icon: "message",
    });
  });

  it("MESSAGE_REQUEST_ACCEPTED links to the conversation", () => {
    expect(
      formatNotification({ type: "MESSAGE_REQUEST_ACCEPTED", data: {}, actor, conversationId: "conv9" }),
    ).toEqual({
      text: "Ayşe Nur Kılıç mesaj isteğini kabul etti.",
      href: "/mesajlar/conv9",
      icon: "message",
    });
  });

  it.each([
    ["APPROVED", "Belgen doğrulandı. Artık proje paylaşabilir ve projelere katılabilirsin."],
    ["REJECTED", "Belgen doğrulanamadı. Nedenini görmek için dokun."],
    ["MANUAL_REVIEW", "Belgen manuel incelemeye alındı. Sonucu 24 saat içinde bildireceğiz."],
  ])("VERIFICATION_RESULT %s uses its status text and links to /dogrulama", (status, text) => {
    expect(formatNotification({ type: "VERIFICATION_RESULT", data: { status } })).toEqual({
      text,
      href: "/dogrulama",
      icon: "verification",
    });
  });

  it("VERIFICATION_RESULT with an unknown status falls back", () => {
    expect(formatNotification({ type: "VERIFICATION_RESULT", data: { status: "XYZ" } })).toEqual({
      ...FALLBACK,
      icon: "verification",
    });
  });

  it("INTRODUCTION quotes the reason and links to the suggested person", () => {
    expect(
      formatNotification({ type: "INTRODUCTION", data: { reason: "İkiniz de robotik ilgileniyorsunuz." }, actor }),
    ).toEqual({
      text: "Seni Ayşe Nur Kılıç ile tanıştıralım: İkiniz de robotik ilgileniyorsunuz.",
      href: "/u/aysenur",
      icon: "intro",
    });
  });

  it("NEW_PROJECT_FROM_FOLLOWING links to the project", () => {
    expect(formatNotification({ type: "NEW_PROJECT_FROM_FOLLOWING", data: {}, actor, project })).toEqual({
      text: "Ayşe Nur Kılıç yeni bir proje paylaştı: “Akıllı Sera”",
      href: "/projeler/proj1",
      icon: "project",
    });
  });

  it("falls back when the actor was deleted", () => {
    const types = [
      "FOLLOW",
      "JOIN_REQUEST",
      "INVITE",
      "INVITE_ACCEPTED",
      "INVITE_DECLINED",
      "MESSAGE_REQUEST",
      "MESSAGE_REQUEST_ACCEPTED",
      "INTRODUCTION",
      "NEW_PROJECT_FROM_FOLLOWING",
    ];
    for (const type of types) {
      const result = formatNotification({ type, data: { reason: "x" }, actor: null, project, conversationId: "conv1" });
      expect(result.text, type).toBe(FALLBACK_TEXT);
      expect(result.href, type).toBe("/bildirimler");
    }
  });

  it("falls back when the project was deleted", () => {
    const types = [
      "JOIN_REQUEST",
      "JOIN_ACCEPTED",
      "JOIN_REJECTED",
      "INVITE",
      "INVITE_ACCEPTED",
      "INVITE_DECLINED",
      "NEW_PROJECT_FROM_FOLLOWING",
    ];
    for (const type of types) {
      const result = formatNotification({ type, data: {}, actor, project: null });
      expect(result.text, type).toBe(FALLBACK_TEXT);
      expect(result.href, type).toBe("/bildirimler");
    }
  });

  it("falls back when the conversation is gone or the type is unknown", () => {
    expect(formatNotification({ type: "MESSAGE_REQUEST_ACCEPTED", data: {}, actor, conversationId: null })).toEqual({
      ...FALLBACK,
      icon: "message",
    });
    expect(formatNotification({ type: "BILINMEYEN", data: {} })).toEqual({ ...FALLBACK, icon: "project" });
  });
});
