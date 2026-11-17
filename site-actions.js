// Registers this website's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the names in
// "actions.agentTools" become model tools, called website_<name>.
// Each action wraps a method of the page object in js/app.js. The number lock runs inside
// those methods, so the assistant cannot show a translation that changed a number.
import { App, TranslationPage } from "./js/app.js";

const LANG_DESCRIPTION = "Target language code from website_get_notice: hi, bn, mr, te, ta, gu, ur, kn, or, ml, pa or as.";
const LEVEL_DESCRIPTION = "simple (easy-read) or standard, as the visitor asked; simple when they did not say.";

/**
 * Describes the page's operations as actions the agents can call.
 */
class SiteActions {
  /**
   * Register every site action with the runtime.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    actions.register(SiteActions.getNoticeAction());
    actions.register(SiteActions.showTranslationAction());
    actions.register(SiteActions.showOriginalAction());
    actions.register(SiteActions.showPastedTranslationAction());
  }

  /**
   * Describe the read action.
   *
   * :return: The action definition.
   */
  static getNoticeAction() {
    return {
      name: "get_notice",
      description: "Read the notice on this page: every section's original English heading and text, the numbers each contains, the language each section is shown in now, the languages and reading levels offered, and the text the visitor pasted into the page's paste box (empty when none).",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: SiteActions.getNotice,
    };
  }

  /**
   * Return the page state.
   *
   * :return: The state from the page object.
   */
  static getNotice() {
    return App.page.getState();
  }

  /**
   * Describe the write that shows one section's translation.
   *
   * :return: The action definition.
   */
  static showTranslationAction() {
    return {
      name: "show_translation",
      description: "Show your translation of one notice section on the page. The page's number lock first checks that it keeps every number, link and email of the original; if not it changes nothing and returns ok false with the reason and the numbers to fix. The visitor can switch back to English on the page.",
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["sectionId", "lang", "level", "heading", "text"],
        properties: {
          sectionId: {
            type: "string",
            enum: TranslationPage.sectionIds(),
            description: "Section id from website_get_notice.",
          },
          lang: {
            type: "string",
            enum: TranslationPage.languageCodes(),
            description: LANG_DESCRIPTION,
          },
          level: {
            type: "string",
            enum: TranslationPage.levelCodes(),
            description: LEVEL_DESCRIPTION,
          },
          heading: {
            type: "string",
            minLength: 1,
            maxLength: 400,
            description: "The section heading, translated.",
          },
          text: {
            type: "string",
            minLength: 1,
            maxLength: 2000,
            description: "The section text, translated. Keep every number exactly; target-script digits are fine.",
          },
        },
      },
      execute: SiteActions.showTranslation,
    };
  }

  /**
   * Show a translation through the page object.
   *
   * :param args: The validated arguments.
   * :return: The page's receipt or refusal.
   */
  static showTranslation(args) {
    return App.page.setTranslation(args);
  }

  /**
   * Describe the write that switches sections back to English.
   *
   * :return: The action definition.
   */
  static showOriginalAction() {
    return {
      name: "show_original",
      description: "Show one notice section, or all of them, in the original English again.",
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["sectionId"],
        properties: {
          sectionId: {
            type: "string",
            enum: [...TranslationPage.sectionIds(), "all"],
            description: "A section id from website_get_notice, or all.",
          },
        },
      },
      execute: SiteActions.showOriginal,
    };
  }

  /**
   * Switch sections back to English through the page object.
   *
   * :param args: The validated arguments.
   * :return: The page's receipt or refusal.
   */
  static showOriginal(args) {
    return App.page.showOriginal(args.sectionId);
  }

  /**
   * Describe the write that shows the pasted text's translation.
   *
   * :return: The action definition.
   */
  static showPastedTranslationAction() {
    return {
      name: "show_pasted_translation",
      description: "Show your translation of the text in the page's paste box, below the box. The number lock checks it against the pasted text first and refuses, changing nothing, when a number, link or email differs.",
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["lang", "level", "text"],
        properties: {
          lang: {
            type: "string",
            enum: TranslationPage.languageCodes(),
            description: LANG_DESCRIPTION,
          },
          level: {
            type: "string",
            enum: TranslationPage.levelCodes(),
            description: LEVEL_DESCRIPTION,
          },
          text: {
            type: "string",
            minLength: 1,
            maxLength: 8000,
            description: "The whole pasted text, translated. Keep every number exactly.",
          },
        },
      },
      execute: SiteActions.showPastedTranslation,
    };
  }

  /**
   * Show the pasted text's translation through the page object.
   *
   * :param args: The validated arguments.
   * :return: The page's receipt or refusal.
   */
  static showPastedTranslation(args) {
    return App.page.setPastedTranslation(args);
  }
}

// The runtime calls the module's registerActions export.
export const registerActions = SiteActions.registerActions;
