import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

describe("privacy storage boundaries", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => vi.restoreAllMocks());

  it("does not read legacy optional content until affirmative opt-in", async () => {
    const preferences = await import("../privacy-preferences");
    localStorage.setItem("plemu-product-v1", "private prior collection");
    const read = vi.spyOn(Storage.prototype, "getItem");
    expect(preferences.readOptionalStorage("plemu-product-v1")).toBeNull();
    expect(read).not.toHaveBeenCalledWith("plemu-product-v1");
    preferences.choosePersistence(true);
    expect(preferences.readOptionalStorage("plemu-product-v1")).toBe(
      "private prior collection",
    );
  });

  it("commits denial before clearing and blocks a competing tab's attempted recreation", async () => {
    const preferences = await import("../privacy-preferences");
    preferences.choosePersistence(true);
    preferences.writeOptionalStorage("plemu-product-v1", "collection");
    localStorage.setItem("unrelated-setting", "keep");
    localStorage.setItem("walletName", "independent legacy library record");
    preferences.recordTermsReceipt();
    const remove = Storage.prototype.removeItem;
    let choiceDuringDeletion: unknown;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === "plemu-product-v1") {
        choiceDuringDeletion = JSON.parse(
          this.getItem(preferences.PRIVACY_CHOICE_KEY) || "null",
        ).persistence;
        expect(preferences.writeOptionalStorage(key, "late stale write")).toBe(
          false,
        );
      }
      remove.call(this, key);
    });
    preferences.choosePersistence(false);
    expect(choiceDuringDeletion).toBe(false);
    expect(localStorage.getItem("plemu-product-v1")).toBeNull();
    expect(localStorage.getItem("unrelated-setting")).toBe("keep");
    expect(localStorage.getItem("walletName")).toBe(
      "independent legacy library record",
    );
    expect(preferences.hasCurrentTermsReceipt()).toBe(true);
    expect(preferences.writeOptionalStorage("plemu-product-v1", "later")).toBe(
      false,
    );
  });

  it("removes stale permission and stays denied when a denial record cannot be written", async () => {
    const preferences = await import("../privacy-preferences");
    preferences.choosePersistence(true);
    preferences.writeOptionalStorage("plemu-creator-profile", "profile");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(preferences.choosePersistence(false)).toBe(false);
    expect(localStorage.getItem(preferences.PRIVACY_CHOICE_KEY)).toBeNull();
    expect(localStorage.getItem("plemu-creator-profile")).toBeNull();
    expect(
      preferences.writeOptionalStorage("plemu-creator-profile", "stale write"),
    ).toBe(false);
  });

  it("removes a write if consent changes between its initial check and storage mutation", async () => {
    const preferences = await import("../privacy-preferences");
    preferences.choosePersistence(true);
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "plemu-product-v1")
        set.call(
          this,
          preferences.PRIVACY_CHOICE_KEY,
          JSON.stringify({
            version: 1,
            persistence: false,
            recordedAt: new Date().toISOString(),
          }),
        );
      set.call(this, key, value);
    });
    expect(
      preferences.writeOptionalStorage("plemu-product-v1", "late write"),
    ).toBe(false);
    expect(localStorage.getItem("plemu-product-v1")).toBeNull();
  });

  it("requires the current terms identity and distinguishes draft from effective receipts", async () => {
    const preferences = await import("../privacy-preferences");
    localStorage.setItem(
      preferences.TERMS_RECEIPT_KEY,
      JSON.stringify({
        version: "older:draft",
        recordedAt: new Date().toISOString(),
      }),
    );
    expect(preferences.hasCurrentTermsReceipt()).toBe(false);
    preferences.recordTermsReceipt();
    expect(preferences.hasCurrentTermsReceipt()).toBe(true);
    expect(preferences.TERMS_VERSION).toMatch(/:draft$/);
    localStorage.removeItem(preferences.TERMS_RECEIPT_KEY);
    expect(preferences.hasCurrentTermsReceipt()).toBe(false);
  });
});
