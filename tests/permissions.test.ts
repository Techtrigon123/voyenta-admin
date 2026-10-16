import { describe, expect, it } from "vitest";
import { PERMISSIONS, SUB_DEFAULT, SUB_GRANTABLE, can, cleanSubPermissions, type Permission } from "@/lib/permissions";

const MONEY_AND_OWNER: Permission[] = ["payments.decide", "payments.refund", "agents.plan", "agents.delete", "agents.email", "admins.manage", "audit.view", "settings.manage"];

describe("permissions", () => {
  it("masters can do everything", () => {
    const master = { role: "master" as const, permissions: [] };
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(can(master, p)).toBe(true);
  });

  it("nobody signed in can do anything", () => {
    expect(can(null, "payments.view")).toBe(false);
    expect(can(undefined, "agents.view")).toBe(false);
  });

  it("sub-admins only get what they were given", () => {
    const sub = { role: "sub" as const, permissions: ["payments.view"] };
    expect(can(sub, "payments.view")).toBe(true);
    expect(can(sub, "payments.check")).toBe(false);
  });

  it("a sub-admin can never move money or manage the business, even if the database says so", () => {
    const tampered = { role: "sub" as const, permissions: Object.keys(PERMISSIONS) };
    for (const p of MONEY_AND_OWNER) expect(can(tampered, p)).toBe(false);
  });

  it("none of the money or owner permissions can be granted to a sub-admin", () => {
    for (const p of MONEY_AND_OWNER) expect(SUB_GRANTABLE).not.toContain(p);
  });

  it("new sub-admins start with the default set, all of it grantable", () => {
    for (const p of SUB_DEFAULT) expect(SUB_GRANTABLE).toContain(p);
  });

  it("cleanSubPermissions drops unknown and master-only permissions", () => {
    expect(cleanSubPermissions(["payments.view", "settings.manage", "made.up", 42])).toEqual(["payments.view"]);
    expect(cleanSubPermissions("payments.view")).toEqual([]);
    expect(cleanSubPermissions(null)).toEqual([]);
  });
});
