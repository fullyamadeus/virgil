import assert from "node:assert/strict";
import test from "node:test";
import { classDateBounds, recurringClassVisible } from "../src/lib/calendar";

const term = { label: "2026/2027 · Winter", starts_on: "2026-09-01", ends_on: "2027-02-28" };
const weeks = [
  { starts_on: "2026-11-12", ends_on: "2026-11-23" },
  { starts_on: "2026-12-10", ends_on: "2026-12-17" },
  { starts_on: "2027-01-10", ends_on: "2027-01-20" },
];

test("weekly classes pause during the first exam week, then resume", () => {
  assert.equal(recurringClassVisible("2026-11-11", term, weeks), true);
  assert.equal(recurringClassVisible("2026-11-12", term, weeks), false);
  assert.equal(recurringClassVisible("2026-11-23", term, weeks), false);
  assert.equal(recurringClassVisible("2026-11-24", term, weeks), true);
});

test("weekly classes stop at the second exam week and never resume", () => {
  assert.equal(recurringClassVisible("2026-12-09", term, weeks), true);
  assert.equal(recurringClassVisible("2026-12-10", term, weeks), false);
  assert.equal(recurringClassVisible("2026-12-18", term, weeks), false);
  assert.equal(recurringClassVisible("2027-01-11", term, weeks), false);
});

test("winter classes use October through December; summer uses February through May", () => {
  assert.deepEqual(classDateBounds(term), { starts_on: "2026-10-01", ends_on: "2026-12-31" });
  assert.equal(recurringClassVisible("2026-09-30", term, []), false);
  assert.equal(recurringClassVisible("2026-10-01", term, []), true);
  assert.equal(recurringClassVisible("2026-12-31", term, []), true);
  assert.equal(recurringClassVisible("2027-01-01", term, []), false);
  const summer = { label: "2026/2027 · Summer", starts_on: "2027-02-01", ends_on: "2027-08-31" };
  assert.equal(recurringClassVisible("2027-02-17", summer, []), false);
  assert.equal(recurringClassVisible("2027-02-18", summer, []), true);
  assert.equal(recurringClassVisible("2027-05-31", summer, []), true);
  assert.equal(recurringClassVisible("2027-06-01", summer, []), false);
});
