// The "See the number lock work" box. It runs the same check as the page, with no model.
import { NumberLock } from "./number-lock.js";

/**
 * Shows the number lock's verdict for the two boxes as the visitor edits them.
 */
export class LockDemo {
  /**
   * Connect the boxes and show the first verdict.
   */
  static start() {
    const source = document.querySelector("#lock-source");
    const translation = document.querySelector("#lock-translation");
    source.addEventListener("input", LockDemo.render);
    translation.addEventListener("input", LockDemo.render);
    LockDemo.render();
  }

  /**
   * Compare the two boxes and show the result.
   */
  static render() {
    const source = document.querySelector("#lock-source").value;
    const translation = document.querySelector("#lock-translation").value;
    const result = NumberLock.compare(source, translation);
    const box = document.querySelector("#lock-result");
    box.dataset.ok = result.ok ? "true" : "false";
    box.replaceChildren();
    const verdict = document.createElement("p");
    verdict.className = "lock-verdict";
    verdict.textContent = result.ok
      ? `✅ Passed: all ${result.kept.length} numbers, links and emails are the same.`
      : "⛔ Refused: the page would not show this translation.";
    box.append(verdict);
    const rows = [
      ["Must keep", result.kept],
      ["Dropped or changed", result.missing],
      ["Added", result.added],
      ["Links or emails not copied exactly", result.linksMissing],
    ];
    const list = document.createElement("dl");
    for (const [label, values] of rows) {
      if (!values.length && label !== "Must keep") {
        continue;
      }
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = values.length ? values.join("  ·  ") : "none";
      list.append(term, detail);
    }
    box.append(list);
  }
}

LockDemo.start();
