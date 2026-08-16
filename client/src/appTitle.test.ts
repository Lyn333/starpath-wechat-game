import { describe, expect, it } from "vitest";

describe("app title configuration", () => {
  it("exposes the configured title to the client build", () => {
    expect(import.meta.env.VITE_APP_TITLE).toBeTruthy();
  });
});

// The title is a public client setting, not an authenticated credential.
// The test intentionally validates the lightweight client configuration surface.
