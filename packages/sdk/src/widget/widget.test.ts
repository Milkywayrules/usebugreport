import "../test/preload.ts";
import { afterEach, describe, expect, test } from "bun:test";
import { dispose } from "../dispose";
import { init } from "../init";
import { INGEST_KEY_PREFIX, MIN_INGEST_KEY_LENGTH } from "../validate";
import { openSubmitModal } from "./modal";

const VALID_KEY = `${INGEST_KEY_PREFIX}${"b".repeat(MIN_INGEST_KEY_LENGTH - INGEST_KEY_PREFIX.length)}`;

afterEach(() => {
  dispose();
});

describe("submit widget", () => {
  test("openSubmitModal renders shadow-root form controls", () => {
    init({
      apiBaseUrl: "https://api.test",
      projectKey: VALID_KEY,
      widget: false,
    });

    const close = openSubmitModal({ apiBaseUrl: "https://api.test" });
    const host = document.querySelector('[data-usebugreport-widget="modal"]');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot?.querySelector("#ubr-title")).not.toBeNull();
    expect(host?.shadowRoot?.querySelector("#ubr-description")).not.toBeNull();
    close();
  });
});
