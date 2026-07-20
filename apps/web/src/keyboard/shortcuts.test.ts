import { describe, expect, test } from "bun:test";
import {
  GLOBAL_SHORTCUTS,
  REPORT_LIST_SHORTCUTS,
  SHORTCUTS,
  SHORTCUTS_BY_ID,
} from "./shortcuts";

describe("keyboard shortcuts registry", () => {
  test("exports unique shortcut ids", () => {
    const ids = SHORTCUTS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("includes global help binding", () => {
    expect(SHORTCUTS_BY_ID[GLOBAL_SHORTCUTS.help.id]?.keys).toBe("?");
  });

  test("list navigation bindings stay centralized", () => {
    expect(REPORT_LIST_SHORTCUTS.focusNext.keys).toBe("j");
  });
});
