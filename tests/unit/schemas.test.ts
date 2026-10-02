import { describe, it, expect } from "vitest";
import {
  productSchema,
  variationSchema,
  createVariationSchema,
  categorySchema,
  stockAdjustmentSchema,
} from "@/modules/admin/schema";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/modules/accounts/schema";

// Coverage gap: these 8 schemas had zero direct tests (only the admin actions
// exercised productSchema indirectly, and changePasswordSchema only via its
// action). Field messages and coercion rules are asserted here so a message
// typo can't silently drift from what the forms render.

function firstError(
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { issues: { path: PropertyKey[]; message: string }[] };
    };
  },
  value: unknown
) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return null;
  return parsed.error?.issues[0];
}

describe("productSchema", () => {
  it("accepts a valid product and trims every string", () => {
    const parsed = productSchema.safeParse({
      name: "  Bouquet  ",
      slug: "bouquet",
      description: "  pretty  ",
      categoryId: "cat_1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Bouquet");
      expect(parsed.data.description).toBe("pretty");
    }
  });

  it("requires name, slug, description and categoryId", () => {
    const parsed = productSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => String(i.path[0]));
      expect(paths).toEqual(expect.arrayContaining(["name", "slug", "description", "categoryId"]));
    }
  });

  it("rejects uppercase/spaced slugs with the documented message", () => {
    expect(firstError(productSchema, { name: "n", slug: "Bad Slug!", description: "d", categoryId: "c" })?.message).toBe(
      "Slug must be lowercase letters, numbers, and hyphens only"
    );
    expect(firstError(productSchema, { name: "n", slug: "Also_Bad", description: "d", categoryId: "c" })?.message).toBe(
      "Slug must be lowercase letters, numbers, and hyphens only"
    );
  });

  it("keeps hyphenated multi-segment slugs valid", () => {
    expect(productSchema.safeParse({ name: "n", slug: "red-roses-bouquet-2026", description: "d", categoryId: "c" }).success).toBe(true);
  });
});

describe("variationSchema", () => {
  it("coerces price strings to integer paisa and requires isEnabled", () => {
    const parsed = variationSchema.safeParse({ name: "Large", price: "150000", isEnabled: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.price).toBe(150000);
  });

  it("rejects a zero/fractional price", () => {
    expect(firstError(variationSchema, { name: "L", price: 0, isEnabled: true })?.message).toBe(
      "Price must be greater than 0"
    );
    // .int() fires with Zod's default message on a fractional paisa value.
    expect(variationSchema.safeParse({ name: "L", price: 99.5, isEnabled: true }).success).toBe(false);
  });

  it("requires isEnabled as a boolean", () => {
    expect(variationSchema.safeParse({ name: "L", price: 100 }).success).toBe(false);
    expect(variationSchema.safeParse({ name: "L", price: 100, isEnabled: "yes" }).success).toBe(false);
  });
});

describe("createVariationSchema", () => {
  it("accepts rupees >= 0.01 and non-negative integer stock", () => {
    const parsed = createVariationSchema.safeParse({
      productId: "p1",
      name: "Small",
      price: "8.5",
      stock: "2",
      isEnabled: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.price).toBe(8.5);
      expect(parsed.data.stock).toBe(2);
    }
  });

  it("rejects a sub-rupee price and negative/fractional stock", () => {
    expect(
      firstError(createVariationSchema, { productId: "p", name: "n", price: 0.001, stock: 0, isEnabled: true })?.message
    ).toBe("Price must be greater than 0");
    expect(
      firstError(createVariationSchema, { productId: "p", name: "n", price: 1, stock: -1, isEnabled: true })?.message
    ).toBe("Stock cannot be negative");
    expect(createVariationSchema.safeParse({ productId: "p", name: "n", price: 1, stock: 2.5, isEnabled: true }).success).toBe(false);
  });
});

describe("categorySchema", () => {
  it("accepts a trimmed name with a kebab slug", () => {
    const parsed = categorySchema.safeParse({ name: "  Weddings  ", slug: "wedding-bouquets" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Weddings");
  });

  it("requires both fields and the slug format", () => {
    // Empty strings hit the custom messages; missing keys hit Zod's
    // default type error — either way the field is rejected.
    expect(firstError(categorySchema, { name: "", slug: "s" })?.message).toBe("Name is required");
    expect(firstError(categorySchema, { name: "n", slug: "" })?.message).toBe("Slug is required");
    expect(categorySchema.safeParse({ slug: "s" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "n" }).success).toBe(false);
    expect(firstError(categorySchema, { name: "n", slug: "N o P e" })?.message).toBe(
      "Slug must be lowercase letters, numbers, and hyphens only"
    );
  });
});

describe("stockAdjustmentSchema", () => {
  it("coerces the adjustment to an integer and trims the reason", () => {
    const parsed = stockAdjustmentSchema.safeParse({ adjustment: "-3", reason: "  restock  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.adjustment).toBe(-3);
      expect(parsed.data.reason).toBe("restock");
    }
  });

  it("rejects a fractional adjustment and an empty reason", () => {
    expect(stockAdjustmentSchema.safeParse({ adjustment: 1.5, reason: "x" }).success).toBe(false);
    expect(firstError(stockAdjustmentSchema, { adjustment: 1, reason: "   " })?.message).toBe(
      "A reason is required"
    );
  });
});

describe("changePasswordSchema", () => {
  it("accepts a matching pair with a strong enough new password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      }).success
    ).toBe(true);
  });

  it("requires the current password", () => {
    expect(
      firstError(changePasswordSchema, { currentPassword: "", newPassword: "NewPassword1!", confirmNewPassword: "NewPassword1!" })?.message
    ).toBe("Current password is required");
  });

  it("enforces the 8-character minimum on the NEW password only", () => {
    const issue = firstError(changePasswordSchema, { currentPassword: "old", newPassword: "short", confirmNewPassword: "short" });
    expect(issue?.message).toBe("New password must be at least 8 characters");
    expect(issue?.path).toEqual(["newPassword"]);
  });

  it("flags a mismatch on confirmNewPassword", () => {
    const issue = firstError(changePasswordSchema, { currentPassword: "old", newPassword: "NewPassword1!", confirmNewPassword: "Other1234!" });
    expect(issue?.message).toBe("Passwords do not match");
    expect(issue?.path).toEqual(["confirmNewPassword"]);
  });
});

describe("forgotPasswordSchema", () => {
  it("trims and lowercases the email", () => {
    const parsed = forgotPasswordSchema.safeParse({ email: "  User@Example.COM " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("user@example.com");
  });

  it("rejects a malformed email", () => {
    expect(firstError(forgotPasswordSchema, { email: "not-an-email" })?.message).toBe(
      "Please enter a valid email address"
    );
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a valid token with matching passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ token: " tok_abc ", password: "NewPassword1!", confirmPassword: "NewPassword1!" }).success
    ).toBe(true);
  });

  it("refuses an empty token with the expired-link message", () => {
    expect(
      firstError(resetPasswordSchema, { token: "  ", password: "NewPassword1!", confirmPassword: "NewPassword1!" })?.message
    ).toBe("This reset link is invalid or has expired.");
  });

  it("enforces length and matching", () => {
    expect(
      firstError(resetPasswordSchema, { token: "t", password: "short", confirmPassword: "short" })?.message
    ).toBe("Password must be at least 8 characters");
    const issue = firstError(resetPasswordSchema, { token: "t", password: "NewPassword1!", confirmPassword: "Nope1234!" });
    expect(issue?.message).toBe("Passwords do not match");
    expect(issue?.path).toEqual(["confirmPassword"]);
  });
});
