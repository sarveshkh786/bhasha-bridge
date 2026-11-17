// The page object: shows the notice, keeps what each section currently shows, and owns
// every change to it. The page's own buttons and the assistant's website_* tools call the
// same methods, so both follow the same rules, the number lock included.
import { LANGUAGES, NOTICE, READING_LEVELS } from "./notice.js";
import { NumberLock } from "./number-lock.js";

/**
 * The notice page.
 */
export class TranslationPage {
  /**
   * Create the page and show the original notice.
   */
  constructor() {
    this.sections = new Map();
    for (const section of NOTICE.sections) {
      this.sections.set(section.id, {
        id: section.id,
        heading: section.heading,
        text: section.text,
        shown: null,
      });
    }
    this.pasted = null;
    this.refusals = [];
    this.renderAll();
  }

  /**
   * The ids of the notice's sections, for the action schemas.
   *
   * :return: The section ids in page order.
   */
  static sectionIds() {
    return NOTICE.sections.map(TranslationPage.idOf);
  }

  /**
   * The codes of the languages the page can show.
   *
   * :return: The language codes.
   */
  static languageCodes() {
    return LANGUAGES.map(TranslationPage.codeOf);
  }

  /**
   * The codes of the reading levels.
   *
   * :return: The level codes.
   */
  static levelCodes() {
    return READING_LEVELS.map(TranslationPage.codeOf);
  }

  /**
   * Return an entry's id.
   *
   * :param entry: An object with an id.
   * :return: The id.
   */
  static idOf(entry) {
    return entry.id;
  }

  /**
   * Return an entry's code.
   *
   * :param entry: An object with a code.
   * :return: The code.
   */
  static codeOf(entry) {
    return entry.code;
  }

  /**
   * Find a language by its code.
   *
   * :param code: A language code.
   * :return: The language entry, or undefined.
   */
  static language(code) {
    return LANGUAGES.find(TranslationPage.hasCode.bind(null, code));
  }

  /**
   * Tell whether an entry has a code.
   *
   * :param code: The code.
   * :param entry: An entry with a code.
   * :return: True when they match.
   */
  static hasCode(code, entry) {
    return entry.code === code;
  }

  /**
   * Read the page as plain data: the languages, every section in the original and as
   * shown now, and the pasted text with its translation.
   *
   * :return: The page state, as copies.
   */
  getState() {
    const sections = [];
    for (const section of this.sections.values()) {
      sections.push({
        id: section.id,
        original: {
          heading: section.heading,
          text: section.text,
        },
        numbers: NumberLock.numbers(`${section.heading}\n${section.text}`).map(TranslationPage.writtenOf),
        shown: section.shown ? { ...section.shown } : { lang: "en", note: "original English" },
      });
    }
    const pastedSource = TranslationPage.pastedSource();
    return {
      notice: NOTICE.title,
      originalLanguage: "en",
      languages: LANGUAGES.map(TranslationPage.copy),
      readingLevels: READING_LEVELS.map(TranslationPage.copy),
      sections: sections,
      pasted: {
        source: pastedSource,
        translation: this.pasted && this.pasted.source === pastedSource ? { ...this.pasted.result } : null,
      },
    };
  }

  /**
   * Copy a plain object.
   *
   * :param entry: The object.
   * :return: A shallow copy.
   */
  static copy(entry) {
    return { ...entry };
  }

  /**
   * Return a number's written form.
   *
   * :param number: An entry from NumberLock.numbers().
   * :return: Its written form.
   */
  static writtenOf(number) {
    return number.written;
  }

  /**
   * Read the text the visitor pasted into the page's own box.
   *
   * :return: The pasted text, trimmed.
   */
  static pastedSource() {
    return document.querySelector("#paste-source").value.trim();
  }

  /**
   * Check a translation of one section without changing anything.
   *
   * :param args: sectionId, lang, level, heading and text.
   * :return: {ok: true, kept} or {ok: false, reason, field, missing, added, linksMissing}.
   */
  checkTranslation(args) {
    const section = this.sections.get(args.sectionId);
    if (!section) {
      return { ok: false, field: "sectionId", reason: `There is no section "${args.sectionId}". Use an id from website_get_notice.` };
    }
    const refusal = TranslationPage.checkLanguage(args);
    if (refusal) {
      return refusal;
    }
    const heading = String(args.heading || "").trim();
    const text = String(args.text || "").trim();
    if (!heading || !text) {
      return { ok: false, field: heading ? "text" : "heading", reason: "Give both the translated heading and the translated text." };
    }
    return TranslationPage.lockResult(`${section.heading}\n${section.text}`, `${heading}\n${text}`);
  }

  /**
   * Check the language and reading level of a translation.
   *
   * :param args: The arguments with lang and level.
   * :return: A refusal, or null when both are offered.
   */
  static checkLanguage(args) {
    if (!TranslationPage.language(args.lang)) {
      return { ok: false, field: "lang", reason: `This page does not offer the language "${args.lang}".` };
    }
    if (!TranslationPage.levelCodes().includes(args.level)) {
      return { ok: false, field: "level", reason: `Use reading level "simple" or "standard", not "${args.level}".` };
    }
    return null;
  }

  /**
   * Run the number lock and turn its result into the page's answer.
   *
   * :param source: The original text.
   * :param translation: The translated text.
   * :return: {ok: true, kept} or a refusal with the lock's findings.
   */
  static lockResult(source, translation) {
    const lock = NumberLock.compare(source, translation);
    if (!lock.ok) {
      return {
        ok: false,
        field: "text",
        reason: NumberLock.explain(lock),
        missing: lock.missing,
        added: lock.added,
        linksMissing: lock.linksMissing,
      };
    }
    return { ok: true, kept: lock.kept };
  }

  /**
   * Show a translation of one section, after the number lock passes.
   *
   * :param args: sectionId, lang, level, heading and text.
   * :return: {ok: true, sectionId, shown, numbersKept} or the refusal from
   *   checkTranslation(), with nothing changed.
   */
  setTranslation(args) {
    const check = this.checkTranslation(args);
    if (!check.ok) {
      this.noteRefusal(args.sectionId, check);
      return check;
    }
    const section = this.sections.get(args.sectionId);
    section.shown = {
      lang: args.lang,
      level: args.level,
      heading: String(args.heading).trim(),
      text: String(args.text).trim(),
    };
    this.renderSection(section);
    this.renderStatus();
    return {
      ok: true,
      sectionId: section.id,
      shown: { ...section.shown },
      numbersKept: check.kept,
    };
  }

  /**
   * Show one section, or every section, in the original English again.
   *
   * :param sectionId: A section id, or "all".
   * :return: {ok: true, restored} or {ok: false, reason}.
   */
  showOriginal(sectionId) {
    let ids = [sectionId];
    if (sectionId === "all") {
      ids = TranslationPage.sectionIds();
    } else if (!this.sections.has(sectionId)) {
      return { ok: false, field: "sectionId", reason: `There is no section "${sectionId}".` };
    }
    for (const id of ids) {
      const section = this.sections.get(id);
      section.shown = null;
      this.renderSection(section);
    }
    this.renderStatus();
    return { ok: true, restored: ids };
  }

  /**
   * Check a translation of the pasted text without changing anything.
   *
   * :param args: lang, level and text.
   * :return: {ok: true, kept} or a refusal.
   */
  checkPasted(args) {
    const source = TranslationPage.pastedSource();
    if (!source) {
      return { ok: false, field: "text", reason: "The paste box is empty. Ask the visitor to paste the text into the box on the page first." };
    }
    const refusal = TranslationPage.checkLanguage(args);
    if (refusal) {
      return refusal;
    }
    const text = String(args.text || "").trim();
    if (!text) {
      return { ok: false, field: "text", reason: "Give the translated text." };
    }
    return TranslationPage.lockResult(source, text);
  }

  /**
   * Show a translation of the pasted text, after the number lock passes.
   *
   * :param args: lang, level and text.
   * :return: {ok: true, shown, numbersKept} or the refusal from checkPasted().
   */
  setPastedTranslation(args) {
    const check = this.checkPasted(args);
    if (!check.ok) {
      this.noteRefusal("paste", check);
      return check;
    }
    this.pasted = {
      source: TranslationPage.pastedSource(),
      result: {
        lang: args.lang,
        level: args.level,
        text: String(args.text).trim(),
      },
    };
    this.renderPasted(check.kept);
    return {
      ok: true,
      shown: { ...this.pasted.result },
      numbersKept: check.kept,
    };
  }

  /**
   * Record a number lock refusal and show it in the page's lock log, so the visitor
   * sees what the lock caught. Other refusals, such as an empty heading, are not shown.
   *
   * :param where: The section id, or "paste".
   * :param check: The refusal.
   */
  noteRefusal(where, check) {
    if (!check.missing) {
      return;
    }
    this.refusals.push({
      where: where,
      missing: check.missing,
      added: check.added,
      linksMissing: check.linksMissing,
    });
    const log = document.querySelector("#lock-log");
    const last = this.refusals[this.refusals.length - 1];
    const parts = [];
    if (last.missing.length) {
      parts.push(`dropped or changed ${last.missing.join(", ")}`);
    }
    if (last.added.length) {
      parts.push(`added ${last.added.join(", ")}`);
    }
    if (last.linksMissing.length) {
      parts.push(`altered ${last.linksMissing.join(", ")}`);
    }
    const count = this.refusals.length;
    log.textContent = `⛔ Number lock refused ${count} translation${count === 1 ? "" : "s"} this visit. Last one (${where}): ${parts.join("; ")}. Nothing wrong was shown.`;
    log.hidden = false;
  }

  /**
   * Show every section and the status line.
   */
  renderAll() {
    document.querySelector("#notice-title").textContent = NOTICE.title;
    for (const section of this.sections.values()) {
      this.renderSection(section);
    }
    this.renderStatus();
  }

  /**
   * Show one section as it is now: the original, or its checked translation.
   *
   * :param section: The section record.
   */
  renderSection(section) {
    const box = document.querySelector(`#sec-${section.id}`);
    const heading = document.querySelector(`#sec-${section.id}-heading`);
    const text = document.querySelector(`#sec-${section.id}-text`);
    const badge = document.querySelector(`#sec-${section.id}-badge`);
    const shown = section.shown;
    const language = shown ? TranslationPage.language(shown.lang) : null;
    heading.textContent = shown ? shown.heading : section.heading;
    text.textContent = shown ? shown.text : section.text;
    box.setAttribute("lang", language ? language.code : "en");
    box.setAttribute("dir", language ? language.dir : "ltr");
    box.dataset.translated = shown ? "true" : "false";
    if (shown) {
      const kept = NumberLock.numbers(`${section.heading}\n${section.text}`).map(TranslationPage.writtenOf);
      badge.textContent = kept.length
        ? `${language.native} · number lock passed: ${TranslationPage.unique(kept).join(", ")}`
        : `${language.native} · number lock passed (no numbers)`;
      badge.hidden = false;
    } else {
      badge.textContent = "";
      badge.hidden = true;
    }
  }

  /**
   * Show which languages the notice is in now.
   */
  renderStatus() {
    const shown = new Set();
    for (const section of this.sections.values()) {
      shown.add(section.shown ? section.shown.lang : "en");
    }
    const names = [...shown].map(TranslationPage.nameOf);
    document.querySelector("#notice-status").textContent = shown.size === 1 && shown.has("en")
      ? "Showing the original English."
      : `Showing: ${names.join(" + ")}. Every number, link and email was checked by code against the original.`;
    document.querySelector("#show-original").disabled = shown.size === 1 && shown.has("en");
  }

  /**
   * Name a language for the status line.
   *
   * :param code: A language code, or "en".
   * :return: Its native name, or "English".
   */
  static nameOf(code) {
    const language = TranslationPage.language(code);
    return language ? language.native : "English";
  }

  /**
   * Remove repeated values, keeping the first of each.
   *
   * :param values: A list of strings.
   * :return: The list without repeats.
   */
  static unique(values) {
    return [...new Set(values)];
  }

  /**
   * Show the pasted text's checked translation.
   *
   * :param kept: The numbers the lock found in the source.
   */
  renderPasted(kept) {
    const result = this.pasted.result;
    const language = TranslationPage.language(result.lang);
    const box = document.querySelector("#paste-result");
    const text = document.querySelector("#paste-result-text");
    box.hidden = false;
    text.textContent = result.text;
    text.setAttribute("lang", language.code);
    text.setAttribute("dir", language.dir);
    document.querySelector("#paste-badge").textContent = kept.length
      ? `${language.native} · number lock passed: ${TranslationPage.unique(kept).join(", ")}`
      : `${language.native} · number lock passed (no numbers)`;
  }
}

/**
 * The one page object, shared by the page's buttons, site-actions.js and site.js.
 */
export class App {
  static page = new TranslationPage();
}

// The page's own button. It uses the same method as the assistant's tool.
document.querySelector("#show-original").addEventListener("click", App.page.showOriginal.bind(App.page, "all"));
