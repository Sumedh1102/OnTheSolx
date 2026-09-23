import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { toCsv, toXlsx } from "./tabular";

describe("toCsv", () => {
  it("quotes commas/quotes and neutralises formulas", () => {
    const csv = toCsv({ name: "t", columns: ["a", "b"], rows: [["x,y", '=HYPERLINK("evil")'], [1, null]] });
    expect(csv).toContain('"x,y"');
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv.startsWith("﻿a,b\r\n")).toBe(true);
  });
});

describe("toXlsx", () => {
  it("produces a zip whose worksheet round-trips", () => {
    const buf = toXlsx([{ name: "Revenue", columns: ["Day", "Amount"], rows: [["2026-09-01", 1200], ["<b>&", 3.5]] }]);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    // find the sheet entry and inflate it
    const marker = Buffer.from("xl/worksheets/sheet1.xml");
    const idx = buf.indexOf(marker);
    const compSize = buf.readUInt32LE(idx - 30 + 18);
    const xml = inflateRawSync(buf.subarray(idx + marker.length, idx + marker.length + compSize)).toString();
    expect(xml).toContain("<v>1200</v>");
    expect(xml).toContain("&lt;b&gt;&amp;");
  });
});
