// A minimal DOM stand-in for the page code. It knows the ids in index.html, so a
// mistyped id fails instead of passing silently.
import { readFile } from "node:fs/promises";

/**
 * One element: the properties and methods the page code uses.
 */
export class FakeElement {
  /**
   * Create an element.
   *
   * :param tag: Its tag name or id.
   */
  constructor(tag) {
    this.tag = tag;
    this.attributes = {};
    this.dataset = {};
    this.children = [];
    this.handlers = {};
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.className = "";
    this.type = "";
    this.title = "";
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
  }

  addEventListener(name, handler) {
    (this.handlers[name] ||= []).push(handler);
  }

  dispatch(name, event = {}) {
    for (const handler of this.handlers[name] || []) {
      handler(event);
    }
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  scrollIntoView() {}

  replaceChildren(...nodes) {
    this.children = nodes;
  }
}

/**
 * The document: elements by id, for the ids index.html has.
 */
export class FakeDocument {
  /**
   * Read index.html and create a document that knows its ids.
   *
   * :return: The document.
   */
  static async fromIndex() {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
    const ids = new Map();
    for (const match of html.matchAll(/\sid="([^"]+)"/g)) {
      ids.set(match[1], FakeDocument.elementFor(html, match));
    }
    return new FakeDocument(ids);
  }

  /**
   * Create the element for one id, with the textarea's starting text as its value.
   *
   * :param html: The page.
   * :param match: The id attribute's match.
   * :return: The element.
   */
  static elementFor(html, match) {
    const element = new FakeElement(match[1]);
    const start = html.lastIndexOf("<", match.index);
    const tagEnd = html.indexOf(">", match.index);
    const openTag = html.slice(start, tagEnd + 1);
    element.hidden = /\shidden[\s>]/.test(openTag);
    if (openTag.startsWith("<textarea")) {
      element.value = html.slice(tagEnd + 1, html.indexOf("</textarea>", tagEnd));
    }
    return element;
  }

  /**
   * Create the document.
   *
   * :param ids: Map of id to element.
   */
  constructor(ids) {
    this.ids = ids;
    this.checkedLevel = new FakeElement("level");
    this.checkedLevel.value = "simple";
  }

  /**
   * Find an element by "#id", or the checked reading level.
   *
   * :param selector: The selector the page uses.
   * :return: The element.
   * :raises Error: For an id index.html does not have, or a selector this stand-in cannot search.
   */
  querySelector(selector) {
    if (selector === 'input[name="level"]:checked') {
      return this.checkedLevel;
    }
    if (!selector.startsWith("#") || /[\s.[:]/.test(selector.slice(1))) {
      throw new Error(`The test document cannot search for ${selector}`);
    }
    const element = this.ids.get(selector.slice(1));
    if (!element) {
      throw new Error(`index.html has no element ${selector}`);
    }
    return element;
  }

  /**
   * Create a new element.
   *
   * :param tag: The tag name.
   * :return: The element.
   */
  createElement(tag) {
    return new FakeElement(tag);
  }
}
