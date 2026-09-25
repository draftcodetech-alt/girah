import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, updateProfileSchema } from "@/modules/accounts/schema";

// Phase 4 L1: emails are normalized (trim + lowercase) by the schemas, so
// Alice@Example.COM and alice@example.com can never become two accounts.
// These tests also pin the Zod v4 chain order: transforms run before .email().

describe("email normalization", () => {
  it("loginSchema trims and lowercases", () => {
    const parsed = loginSchema.safeParse({
      email: "  Alice.Smith@Example.COM  ",
      password: "x",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("alice.smith@example.com");
  });

  it("registerSchema trims and lowercases", () => {
    const parsed = registerSchema.safeParse({
      name: "Alice",
      email: " ALICE@Test.Example ",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("alice@test.example");
  });

  it("updateProfileSchema trims and lowercases", () => {
    const parsed = updateProfileSchema.safeParse({
      name: "Alice",
      email: "  BOB+news@Sub.Example.ORG",
      phone: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("bob+news@sub.example.org");
  });

  it("still rejects malformed emails after normalization", () => {
    for (const schema of [loginSchema, registerSchema, updateProfileSchema]) {
      const email = "not-an-email";
      const parsed =
        schema === loginSchema
          ? schema.safeParse({ email, password: "x" })
          : schema === registerSchema
            ? schema.safeParse({
                name: "A",
                email,
                password: "password123",
                confirmPassword: "password123",
              })
            : schema.safeParse({ name: "A", email, phone: "" });
      expect(parsed.success).toBe(false);
    }
  });
});
