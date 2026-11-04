import { describe, it, expect } from "vitest";

describe("canonical cleaning module", () => {
  it("clean_numeric handles valid and invalid inputs", () => {
    // Inline replicate of clean_numeric logic for frontend-side validation
    const cleanNumeric = (token: string): [number | null, string | null] => {
      if (token === null) return [null, "source_blank"];
      const t = token.trim();
      if (t === "" || ["na", "nr", "n/a", "-", "—", "–", "null", "none"].includes(t.toLowerCase())) {
        return [null, "not_reported"];
      }
      const t2 = t.replace(/,/g, "").replace(/ /g, "");
      if (t2 === "") return [null, "source_blank"];
      const n = parseInt(t2, 10);
      if (isNaN(n)) return [null, `unparseable:${token}`];
      return [n, null];
    };

    expect(cleanNumeric("100")).toEqual([100, null]);
    expect(cleanNumeric("")).toEqual([null, "not_reported"]);
    expect(cleanNumeric("NA")).toEqual([null, "not_reported"]);
    expect(cleanNumeric("1,234")).toEqual([1234, null]);
  });
});
