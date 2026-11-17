// Run: node --test "tests/*.test.mjs"
import assert from "node:assert/strict";
import test from "node:test";
import { NumberLock } from "../js/number-lock.js";

const SOURCE = "Water supply in Wards 12, 13 and 14 will be stopped from 6:00 AM to 4:30 PM on 19-12-2026. Late fee ₹1,50,000. Call 1800-000-0000 or see https://example.org/water-notice or write to help@example.org.";

test("a faithful Hindi translation with Devanagari digits passes", () => {
  const hindi = "वार्ड १२, १३ और १४ में पानी की आपूर्ति १९-१२-२०२६ को सुबह ६:०० से शाम ४:३० बजे तक बंद रहेगी। विलंब शुल्क ₹१,५०,०००। 1800-000-0000 पर कॉल करें, https://example.org/water-notice देखें या help@example.org पर लिखें।";
  const result = NumberLock.compare(SOURCE, hindi);
  assert.equal(result.ok, true, NumberLock.explain(result));
  assert.equal(NumberLock.explain(result), "");
});

test("digits of every supported script read as the same numbers", () => {
  const scripts = ["४:३०", "৪:৩০", "੪:੩੦", "૪:૩૦", "୪:୩୦", "௪:௩௦", "౪:౩౦", "೪:೩೦", "൪:൩൦", "۴:۳۰", "٤:٣٠"];
  for (const written of scripts) {
    assert.equal(NumberLock.compare("at 4:30", `समय ${written}`).ok, true, written);
  }
});

test("grouping commas and leading zeros do not matter, other separators may change", () => {
  assert.equal(NumberLock.compare("₹1,20,000", "₹120,000").ok, true);
  assert.equal(NumberLock.compare("₹1,20,000", "₹120000").ok, true);
  assert.equal(NumberLock.compare("at 09:05", "9:5 बजे").ok, true);
  assert.equal(NumberLock.compare("Call 1800-000-0000", "1800 000 0000 पर").ok, true);
});

test("a changed time, a dropped date part and an invented fee are each named", () => {
  const wrong = "वार्ड 12, 13 और 14 में 19 दिसंबर 2026 को सुबह 6:00 से शाम 4:00 बजे तक पानी बंद। शुल्क ₹200 और ₹1,50,000। 1800-000-0000, https://example.org/water-notice, help@example.org";
  const result = NumberLock.compare(SOURCE, wrong);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.sort(), ["12", "30"]);
  assert.deepEqual(result.added.sort(), ["00", "200"]);
  assert.deepEqual(result.linksMissing, []);
  assert.match(NumberLock.explain(result), /drops or changes "12" and "30"; it adds "00" and "200"/);
});

test("a number repeated in the original must be repeated in the translation", () => {
  const result = NumberLock.compare("Ward 12 on 12-12", "वार्ड 12, 12 तारीख");
  assert.deepEqual(result.missing, ["12"]);
});

test("links and emails must be copied exactly, and their digits are not counted twice", () => {
  const result = NumberLock.compare("See https://example.org/notice-2026 now", "देखें https://example.org/notice-2O26");
  assert.equal(result.ok, false);
  assert.deepEqual(result.linksMissing, ["https://example.org/notice-2026"]);
  assert.deepEqual(result.missing, []);
  assert.equal(NumberLock.compare("Write to a1@example.org.", "a1@example.org पर लिखें।").ok, true);
});

test("a link at the end of a sentence keeps its own characters, not the full stop", () => {
  assert.deepEqual(NumberLock.links("Details: https://example.org/water-notice."), ["https://example.org/water-notice"]);
  assert.deepEqual(NumberLock.links("विवरण: https://example.org/water-notice।"), ["https://example.org/water-notice"]);
});

test("text without numbers passes when the translation adds none", () => {
  assert.equal(NumberLock.compare("Keep taps closed.", "नल बंद रखें।").ok, true);
  assert.equal(NumberLock.compare("Keep taps closed.", "2 नल बंद रखें।").ok, false);
});
