import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBillableSubscriptionStatus,
  organizationHasAppAccess,
} from "./billing-access";

describe("organizationHasAppAccess", () => {
  it("exempts CREATOR without Stripe", () => {
    assert.equal(
      organizationHasAppAccess({
        tier: "CREATOR",
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      }),
      true
    );
  });

  it("blocks STARTER with no subscription (seed Acme)", () => {
    assert.equal(
      organizationHasAppAccess({
        tier: "STARTER",
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      }),
      false
    );
  });

  it("allows billable statuses and blocks incomplete or canceled", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      assert.equal(
        organizationHasAppAccess({
          tier: "PROFESSIONAL",
          stripeSubscriptionId: "sub_123",
          stripeSubscriptionStatus: status,
        }),
        true,
        status
      );
    }
    for (const status of ["incomplete", "incomplete_expired", "unpaid", "canceled", "paused"]) {
      assert.equal(
        organizationHasAppAccess({
          tier: "STARTER",
          stripeSubscriptionId: "sub_123",
          stripeSubscriptionStatus: status,
        }),
        false,
        status
      );
    }
  });

  it("allows a legacy subscription id that has no stored status", () => {
    assert.equal(
      organizationHasAppAccess({
        tier: "ENTERPRISE",
        stripeSubscriptionId: "sub_legacy",
        stripeSubscriptionStatus: null,
      }),
      true
    );
  });

  it("does not treat a status without a subscription id as access", () => {
    assert.equal(
      organizationHasAppAccess({
        tier: "STARTER",
        stripeSubscriptionId: "",
        stripeSubscriptionStatus: "active",
      }),
      false
    );
    assert.equal(isBillableSubscriptionStatus("active"), true);
    assert.equal(isBillableSubscriptionStatus("incomplete"), false);
  });
});
