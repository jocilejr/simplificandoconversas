import { describe, it, expect } from "vitest";
import { normalizeEmail } from "@/lib/emailNormalizer";

describe("emailNormalizer", () => {
  // Exact — should not be touched
  it("leaves correct gmail.com as exact", () => {
    const r = normalizeEmail("teste@gmail.com");
    expect(r.status).toBe("exact");
    expect(r.email).toBe("teste@gmail.com");
    expect(r.corrected).toBe(false);
  });

  it("leaves correct hotmail.com as exact", () => {
    const r = normalizeEmail("user@hotmail.com");
    expect(r.status).toBe("exact");
    expect(r.corrected).toBe(false);
  });

  it("leaves corporate domain as exact", () => {
    const r = normalizeEmail("empresa@minhadomain.com.br");
    expect(r.status).toBe("exact");
    expect(r.corrected).toBe(false);
  });

  // Corrected — high confidence fixes
  it("corrects gmail.comn → gmail.com", () => {
    const r = normalizeEmail("teste@gmail.comn");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("teste@gmail.com");
  });

  it("corrects hotmail.com8 → hotmail.com", () => {
    const r = normalizeEmail("teste@hotmail.com8");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("teste@hotmail.com");
  });

  it("corrects gmil.comeh → gmail.com", () => {
    const r = normalizeEmail("teste@gmil.comeh");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("teste@gmail.com");
  });

  it("corrects 736gmail.com.br → gmail.com (with @ missing)", () => {
    // With @ present and junk prefix in domain
    const r = normalizeEmail("teste@736gmail.com.br");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("teste@gmail.com");
  });

  it("corrects gmial.com → gmail.com", () => {
    const r = normalizeEmail("user@gmial.com");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("teste@gmail.com".replace("teste", "user"));
  });

  it("corrects hotmal.com → hotmail.com", () => {
    const r = normalizeEmail("user@hotmal.com");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("user@hotmail.com");
  });

  it("corrects outlok.com → outlook.com", () => {
    const r = normalizeEmail("user@outlok.com");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("user@outlook.com");
  });

  it("corrects gmail.con → gmail.com", () => {
    const r = normalizeEmail("user@gmail.con");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("user@gmail.com");
  });

  it("corrects gmail.comm → gmail.com", () => {
    const r = normalizeEmail("user@gmail.comm");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("user@gmail.com");
  });

  // Missing @ inference
  it("infers @ in testegmail.com", () => {
    const r = normalizeEmail("testegmail.com");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("teste@gmail.com");
  });

  // Never touches local part
  it("never changes local part", () => {
    const r = normalizeEmail("My.User+tag@gmial.com");
    expect(r.email).toContain("my.user+tag@");
  });

  // Invalid
  it("marks empty as invalid", () => {
    const r = normalizeEmail("");
    expect(r.status).toBe("invalid");
  });

  it("marks no-domain string as invalid", () => {
    const r = normalizeEmail("justtext");
    expect(r.status).toBe("invalid");
  });

  // Uppercase handling
  it("lowercases everything", () => {
    const r = normalizeEmail("User@GMAIL.COM");
    expect(r.email).toBe("user@gmail.com");
  });

  // .com.br variations
  it("corrects uol.com (without .br) → uol.com.br", () => {
    const r = normalizeEmail("user@uol.com");
    expect(r.status).toBe("corrected");
    expect(r.email).toBe("user@uol.com.br");
  });
});
