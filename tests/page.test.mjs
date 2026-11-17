// Run: node --test "tests/*.test.mjs"
// Checks the page object, the site actions and the published files together, with a
// stand-in DOM and no model. The browser runtime itself is checked in a browser.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FakeDocument } from "./dom.mjs";

globalThis.document = await FakeDocument.fromIndex();
const { App } = await import("../js/app.js");
const { NOTICE } = await import("../js/notice.js");
const { registerActions } = await import("../site-actions.js");
const { AssistantMount } = await import("../site.js");
const manifest = JSON.parse(await readFile(new URL("../agent-manifest.json", import.meta.url), "utf8"));
const network = JSON.parse(await readFile(new URL("../bhasha_bridge.network.json", import.meta.url), "utf8"));

const HEADLINE_HI = {
  sectionId: "headline",
  lang: "hi",
  level: "simple",
  heading: "शनिवार, 19 दिसंबर 2026 को पानी नहीं आएगा",
  text: "वार्ड १२, १३ और १४ में १९-१२-२०२६ को सुबह ६:०० से शाम ४:३० बजे तक पाइप की मरम्मत के लिए पानी बंद रहेगा।",
};

/**
 * Register the site's actions and return them by name.
 *
 * :return: Map of action name to definition.
 */
function actions() {
  const byName = new Map();
  registerActions({ register: (definition) => byName.set(definition.name, definition) });
  return byName;
}

/**
 * Take a copy of what the page shows in every section.
 *
 * :return: The visible text, lang, dir and badge of each section.
 */
function visible() {
  return NOTICE.sections.map((section) => ({
    heading: document.querySelector(`#sec-${section.id}-heading`).textContent,
    text: document.querySelector(`#sec-${section.id}-text`).textContent,
    lang: document.querySelector(`#sec-${section.id}`).getAttribute("lang"),
    dir: document.querySelector(`#sec-${section.id}`).getAttribute("dir"),
    badge: document.querySelector(`#sec-${section.id}-badge`).textContent,
  }));
}

test("the page starts in English with the original text", () => {
  const state = App.page.getState();
  assert.equal(state.sections.length, 5);
  for (const section of state.sections) {
    assert.equal(section.shown.lang, "en");
  }
  assert.equal(document.querySelector("#sec-headline-text").textContent, NOTICE.sections[0].text);
  assert.deepEqual(state.sections[0].numbers, ["19", "2026", "12", "13", "14", "6", "00", "4", "30", "19", "12", "2026"]);
  assert.equal(document.querySelector("#show-original").disabled, true);
});

test("show_translation shows a checked translation with its language and direction", async () => {
  const receipt = await actions().get("show_translation").execute(HEADLINE_HI);
  assert.equal(receipt.ok, true);
  assert.equal(document.querySelector("#sec-headline-heading").textContent, HEADLINE_HI.heading);
  assert.equal(document.querySelector("#sec-headline").getAttribute("lang"), "hi");
  assert.equal(document.querySelector("#sec-headline").getAttribute("dir"), "ltr");
  assert.equal(document.querySelector("#sec-headline-badge").hidden, false);
  assert.match(document.querySelector("#sec-headline-badge").textContent, /हिन्दी · number lock passed: 19, 2026, 12, 13, 14, 6, 00, 4, 30/);
  assert.match(document.querySelector("#notice-status").textContent, /English \+ हिन्दी|हिन्दी \+ English/);
  assert.equal(document.querySelector("#show-original").disabled, false);
  assert.equal(App.page.getState().sections[0].shown.lang, "hi");
});

test("a translation that changes a number is refused and changes nothing", async () => {
  const before = visible();
  const stateBefore = App.page.getState();
  const receipt = await actions().get("show_translation").execute({
    sectionId: "tanker",
    lang: "ta",
    level: "standard",
    heading: "இலவச தண்ணீர் லாரி",
    text: "வார்டு 13 சமூக மண்டபத்தில் காலை 9:00 முதல் மதியம் 12:00 வரை இலவச தண்ணீர் லாரி நிற்கும்.",
  });
  assert.equal(receipt.ok, false);
  assert.deepEqual(receipt.missing, ["1"]);
  assert.deepEqual(receipt.added, ["12"]);
  assert.match(receipt.reason, /Number lock refused/);
  assert.deepEqual(visible(), before);
  assert.deepEqual(App.page.getState(), stateBefore);
});

test("an empty heading, an unknown section and an unknown language are refused", () => {
  assert.equal(App.page.setTranslation({ ...HEADLINE_HI, heading: "  " }).field, "heading");
  assert.equal(App.page.setTranslation({ ...HEADLINE_HI, sectionId: "nope" }).field, "sectionId");
  assert.equal(App.page.setTranslation({ ...HEADLINE_HI, lang: "fr" }).field, "lang");
  assert.equal(App.page.setTranslation({ ...HEADLINE_HI, level: "fancy" }).field, "level");
});

test("Urdu is shown right to left", () => {
  const receipt = App.page.setTranslation({
    sectionId: "bills",
    lang: "ur",
    level: "simple",
    heading: "آپ کا پانی کا بل",
    text: "اس مرمت سے آپ کا بل نہیں بدلے گا۔ ۳۱-۱۲-۲۰۲۶ تک ادا کیے گئے بلوں پر ₹۱۵۰ کی لیٹ فیس معاف ہے۔",
  });
  assert.equal(receipt.ok, true, receipt.reason);
  assert.equal(document.querySelector("#sec-bills").getAttribute("dir"), "rtl");
  assert.equal(document.querySelector("#sec-bills").getAttribute("lang"), "ur");
});

test("show_original puts every section back in English", async () => {
  const receipt = await actions().get("show_original").execute({ sectionId: "all" });
  assert.equal(receipt.ok, true);
  for (const [index, section] of visible().entries()) {
    assert.equal(section.text, NOTICE.sections[index].text);
    assert.equal(section.lang, "en");
    assert.equal(section.badge, "");
  }
  assert.equal(document.querySelector("#notice-status").textContent, "Showing the original English.");
});

test("the pasted translation is checked against the paste box", async () => {
  const pasteBox = document.querySelector("#paste-source");
  pasteBox.value = "";
  const empty = await actions().get("show_pasted_translation").execute({ lang: "bn", level: "simple", text: "কিছু" });
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /paste box is empty/);
  pasteBox.value = "  Your bill of ₹1,240 is due on 25-11-2026. Call 1912.  ";
  const wrong = await actions().get("show_pasted_translation").execute({ lang: "bn", level: "simple", text: "আপনার ₹১,২৪০ বিল ২৫ নভেম্বর ২০২৬ তারিখে দিতে হবে। ১৯১২ নম্বরে ফোন করুন।" });
  assert.equal(wrong.ok, false);
  assert.deepEqual(wrong.missing, ["11"]);
  assert.equal(document.querySelector("#paste-result").hidden, true);
  const right = await actions().get("show_pasted_translation").execute({ lang: "bn", level: "simple", text: "আপনার ₹১,২৪০ বিল ২৫-১১-২০২৬ তারিখের মধ্যে দিতে হবে। ১৯১২ নম্বরে ফোন করুন।" });
  assert.equal(right.ok, true);
  assert.equal(document.querySelector("#paste-result").hidden, false);
  assert.equal(document.querySelector("#paste-result-text").getAttribute("lang"), "bn");
  assert.equal(App.page.getState().pasted.source, "Your bill of ₹1,240 is due on 25-11-2026. Call 1912.");
  assert.equal(App.page.getState().pasted.translation.lang, "bn");
  pasteBox.value = "Different text now.";
  assert.equal(App.page.getState().pasted.translation, null);
});

test("every agentTools name is registered, with the effect the page needs", () => {
  const byName = actions();
  assert.deepEqual([...byName.keys()].sort(), [...manifest.actions.agentTools].sort());
  assert.equal(byName.get("get_notice").effect, "read");
  for (const name of ["show_translation", "show_original", "show_pasted_translation"]) {
    assert.equal(byName.get(name).effect, "write");
  }
});

test("action schemas use only the keywords the runtime accepts", () => {
  const allowed = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "format", "title", "description", "default"]);
  const visit = (schema, path) => {
    for (const [key, value] of Object.entries(schema)) {
      assert.ok(allowed.has(key) || key.startsWith("x-"), `${path}.${key}`);
      if (key === "additionalProperties") {
        assert.equal(value, false, path);
      }
    }
    for (const [name, child] of Object.entries(schema.properties || {})) {
      visit(child, `${path}.${name}`);
    }
  };
  for (const [name, definition] of actions()) {
    assert.match(name, /^[A-Za-z][A-Za-z0-9_-]{0,79}$/);
    assert.equal(definition.inputSchema.type, "object");
    assert.equal(definition.inputSchema.additionalProperties, false);
    visit(definition.inputSchema, name);
  }
});

test("the published network and manifest agree", () => {
  const entry = manifest.networks[0];
  assert.equal(entry.name, "bhasha_bridge");
  assert.deepEqual(network.metadata.sample_queries, entry.sample_queries);
  assert.deepEqual(network.tools.map((agent) => agent.name), [entry.front_man]);
  assert.equal(network.llm_config.model_name, "models/gemini-3.8-flash");
  assert.equal(manifest.llm_router.base_url, "https://generativelanguage.googleapis.com/v1beta/openai");
});

test("the language buttons ask the assistant, and say so when no key is set", () => {
  AssistantMount.wireButtons();
  const bar = document.querySelector("#lang-bar");
  assert.equal(bar.children.length, 12);
  assert.equal(document.querySelector("#paste-lang").children.length, 12);
  assert.equal(bar.children[0].textContent, "हिन्दी");
  bar.children[0].dispatch("click");
  assert.match(document.querySelector("#assistant-status").textContent, /add your AI provider key/);
});

test("the lock log shows what the number lock caught, and only lock refusals", () => {
  const log = document.querySelector("#lock-log");
  const count = App.page.refusals.length;
  App.page.setTranslation({ ...HEADLINE_HI, heading: "" });
  assert.equal(App.page.refusals.length, count);
  App.page.setTranslation({ ...HEADLINE_HI, text: HEADLINE_HI.text.replace("४:३०", "४:००") });
  assert.equal(App.page.refusals.length, count + 1);
  assert.equal(log.hidden, false);
  assert.match(log.textContent, /Last one \(headline\): dropped or changed 30; added 00\. Nothing wrong was shown\./);
});
