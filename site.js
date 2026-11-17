// Mounts the assistant inside the page and wires the page's language buttons to it.
// Load it with:
//   <script type="module" src="site.js"></script>
// The language buttons do not need the chat: one click asks the assistant to rewrite the
// notice in place. The page's number lock checks every section before it is shown.
import { LANGUAGES } from "./js/notice.js";

/**
 * Boots the browser runtime in the page's assistant section.
 */
export class AssistantMount {
  /**
   * The first chat message once the visitor has a key.
   */
  static GREETING = "Namaste! Pick a language above, or ask me here: I can show this notice, or text you paste in the box, in 12 Indian languages. The page checks every number before it shows a translation.";

  /**
   * This site has no irreversible actions, so it needs no dialogs of its own.
   */
  static DIALOGS = {};

  /**
   * The runtime engine once it has booted, or null.
   */
  static engine = null;

  /**
   * Boot the runtime and report the result in the status line.
   *
   * :return: The runtime engine, or null when boot failed.
   */
  static async start() {
    const status = document.querySelector("#assistant-status");
    const siteBase = new URL("./", import.meta.url).href;
    AssistantMount.wireButtons();
    try {
      const { boot } = await import("./runtime/index.js");
      const booted = await boot("#agent-app", {
        originUrl: siteBase,
        sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
      });
      AssistantMount.engine = booted.engine;
      AssistantMount.defaultConsent = booted.engine.onConsent;
      booted.engine.onConsent = AssistantMount.consent;
      if (AssistantMount.needsKey()) {
        status.textContent = "Add your AI provider key in ⚙ AI model settings below to start. A free Google AI Studio key works.";
      } else {
        status.textContent = "Assistant connected. Pick a language above.";
        AssistantMount.greet();
      }
      return booted.engine;
    } catch (error) {
      // The page must keep working without the assistant.
      status.textContent = "The assistant could not load. The notice is still readable in English.";
      console.error("Assistant startup failed", error);
      return null;
    }
  }

  /**
   * Tell whether the chat still needs a key. This is the same test as the runtime's
   * "API key required" badge in runtime/ui.js.
   *
   * :return: True when the visitor has not added a key yet.
   */
  static needsKey() {
    const engine = AssistantMount.engine;
    return !engine || (!engine.mockLLM && (!engine.byokKey || engine.byokKey === "demo"));
  }

  /**
   * Replace the runtime's general first chat message with GREETING.
   */
  static greet() {
    const first = document.querySelector("#ns-msgs .ns-msg.bot");
    if (first) {
      first.textContent = AssistantMount.GREETING;
    }
  }

  /**
   * Add a button for each language and connect the paste box's button.
   */
  static wireButtons() {
    const bar = document.querySelector("#lang-bar");
    const select = document.querySelector("#paste-lang");
    for (const language of LANGUAGES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lang-button";
      button.textContent = language.native;
      button.setAttribute("lang", language.code);
      button.setAttribute("aria-label", `Show the notice in ${language.name}`);
      button.title = language.name;
      button.addEventListener("click", AssistantMount.translateNotice.bind(null, language));
      bar.append(button);
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = `${language.native} — ${language.name}`;
      select.append(option);
    }
    document.querySelector("#paste-translate").addEventListener("click", AssistantMount.translatePasted);
  }

  /**
   * Read the reading level the visitor picked on the page.
   *
   * :return: "simple" or "standard".
   */
  static level() {
    const checked = document.querySelector('input[name="level"]:checked');
    return checked ? checked.value : "simple";
  }

  /**
   * Ask the assistant to show the whole notice in one language.
   *
   * :param language: The language entry from LANGUAGES.
   */
  static translateNotice(language) {
    AssistantMount.ask(`Show the whole notice in ${AssistantMount.level()} ${language.name}.`);
  }

  /**
   * Ask the assistant to translate the text in the paste box.
   */
  static translatePasted() {
    const code = document.querySelector("#paste-lang").value;
    const language = LANGUAGES.find(AssistantMount.hasCode.bind(null, code));
    if (!document.querySelector("#paste-source").value.trim()) {
      document.querySelector("#paste-note").textContent = "Paste some English text into the box first.";
      return;
    }
    document.querySelector("#paste-note").textContent = "";
    AssistantMount.ask(`Translate the text in the paste box into ${AssistantMount.level()} ${language.name}.`);
  }

  /**
   * Tell whether a language has a code.
   *
   * :param code: The code.
   * :param language: A language entry.
   * :return: True when they match.
   */
  static hasCode(code, language) {
    return language.code === code;
  }

  /**
   * Send a request to the assistant as if the visitor had typed it in the chat.
   *
   * :param text: The request.
   */
  static ask(text) {
    const status = document.querySelector("#assistant-status");
    if (AssistantMount.needsKey()) {
      status.textContent = "First add your AI provider key in ⚙ AI model settings below. A free Google AI Studio key works.";
      document.querySelector("#assistant").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const input = document.querySelector("#ns-input");
    const send = document.querySelector("#ns-send");
    if (!input || !send || send.disabled) {
      status.textContent = "The assistant is busy. Try again when it has answered.";
      return;
    }
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    send.click();
    status.textContent = `Asked: “${text}”`;
  }

  /**
   * Show the runtime's consent card, then put focus back in the chat. This site calls no
   * partner sites itself, but a network it loads could ask.
   *
   * :param info: What the card shows.
   * :return: The card's answer, unchanged.
   */
  static async consent(info) {
    const decision = await AssistantMount.defaultConsent(info);
    if (document.activeElement === document.body || document.activeElement === null) {
      document.querySelector("#ns-input")?.focus();
    }
    return decision;
  }
}

// Boot only in a browser. Node tests import this file to check the page wiring.
if (typeof window !== "undefined") {
  await AssistantMount.start();
}
