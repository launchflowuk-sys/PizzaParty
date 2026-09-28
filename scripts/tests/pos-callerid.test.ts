import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCallerIdLine } from "../../apps/web/src/components/pos/callerid-parser";

test("parses NMBR=, spaced NMBR =, CALL, and raw-digit caller-ID lines", () => {
  assert.equal(parseCallerIdLine("NMBR=07902810090"), "07902810090");
  assert.equal(parseCallerIdLine("NMBR = 07902 810090"), "07902810090");
  assert.equal(parseCallerIdLine("CALL 07902810090"), "07902810090");
  assert.equal(parseCallerIdLine("07902810090"), "07902810090");
  assert.equal(parseCallerIdLine("+447902810090"), "+447902810090");
});

test("rejects non-number lines a caller-ID box also prints", () => {
  assert.equal(parseCallerIdLine("RING"), null);
  assert.equal(parseCallerIdLine("DATE=280926"), null);
  assert.equal(parseCallerIdLine("TIME=1015"), null);
  assert.equal(parseCallerIdLine(""), null);
  assert.equal(parseCallerIdLine("   "), null);
});
