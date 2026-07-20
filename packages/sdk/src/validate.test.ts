import { describe, expect, test } from "bun:test";
import { UseBugReportConfigError } from "./types";
import {
  INGEST_KEY_PREFIX,
  MIN_INGEST_KEY_LENGTH,
  validateProjectKey,
} from "./validate";

const VALID_KEY = `${INGEST_KEY_PREFIX}${"a".repeat(MIN_INGEST_KEY_LENGTH - INGEST_KEY_PREFIX.length)}`;
const PROJECT_KEY_REQUIRED_PATTERN = /projectKey is required/;
const PROJECT_INGEST_KEY_PATTERN = /project ingest key/;
const TRUNCATED_KEY_PATTERN = /truncated/;

describe("validateProjectKey", () => {
  test("accepts a valid ingest key", () => {
    expect(() => validateProjectKey(VALID_KEY)).not.toThrow();
  });

  test("rejects missing or empty keys", () => {
    for (const key of [undefined, null, "", "   "]) {
      expect(() => validateProjectKey(key)).toThrow(UseBugReportConfigError);
      expect(() => validateProjectKey(key)).toThrow(
        PROJECT_KEY_REQUIRED_PATTERN
      );
    }
  });

  test("rejects whitespace-padded keys", () => {
    expect(() => validateProjectKey(` ${VALID_KEY}`)).toThrow(
      UseBugReportConfigError
    );
    expect(() => validateProjectKey(`${VALID_KEY} `)).toThrow(
      PROJECT_KEY_REQUIRED_PATTERN
    );
  });

  test("rejects wrong prefix", () => {
    expect(() =>
      validateProjectKey("ubr_wrong_abcdefghijklmnopqrstuvwxyz123456")
    ).toThrow(PROJECT_INGEST_KEY_PATTERN);
  });

  test("rejects truncated keys", () => {
    expect(() => validateProjectKey(`${INGEST_KEY_PREFIX}short`)).toThrow(
      TRUNCATED_KEY_PATTERN
    );
  });
});
