import { describe, expect, it } from "vitest";
import { normalizeUsername, placeholderEmail } from "./username";
import { changeOwnPasswordSchema, usernameSchema } from "./validation";

describe("usernameSchema", () => {
  it("accepts letters, numbers, dots and underscores and stores them lowercase", () => {
    expect(usernameSchema.parse("Dr.Ahmed_2")).toBe("dr.ahmed_2");
    expect(usernameSchema.parse("  resident.mona ")).toBe("resident.mona");
  });

  it("rejects too short, too long and other characters", () => {
    expect(usernameSchema.safeParse("").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(31)).success).toBe(false);
    expect(usernameSchema.safeParse("dr ahmed").success).toBe(false);
    expect(usernameSchema.safeParse("ahmed@nide").success).toBe(false);
    expect(usernameSchema.safeParse("أحمد").success).toBe(false);
  });
});

describe("placeholder email", () => {
  it("is on the reserved .invalid domain and follows the normalised username", () => {
    expect(placeholderEmail("Dr.Ahmed")).toBe("dr.ahmed@users.nide-ward.invalid");
    expect(normalizeUsername("MONA")).toBe("mona");
  });
});

describe("changeOwnPasswordSchema", () => {
  it("requires a new password of 10+ characters that differs from the current one", () => {
    expect(changeOwnPasswordSchema.safeParse({ currentPassword: "temporary-123", newPassword: "short" }).success).toBe(false);
    expect(changeOwnPasswordSchema.safeParse({ currentPassword: "temporary-123", newPassword: "temporary-123" }).success).toBe(false);
    expect(changeOwnPasswordSchema.safeParse({ currentPassword: "temporary-123", newPassword: "my-own-password" }).success).toBe(true);
  });
});
