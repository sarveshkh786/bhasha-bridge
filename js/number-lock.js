// Number lock: checks that a translation keeps every number, link and email of its source.
//
// Translations most often go wrong on the parts that hurt people when they are wrong:
// dates, times, amounts, phone numbers and links. A model may drop "12" from a date,
// turn 4:30 into 4:00, or invent a fee. This module finds those mistakes with plain code,
// so the page never shows a translation that changed a number, whatever model wrote it.
//
// Digits may be written in the target script (हिन्दी ४:३०, বাংলা ৪:৩০, اردو ۴:۳۰): they are
// read as the same numbers. Grouping commas are ignored, so 1,20,000 and 120,000 and
// 120000 are all the same number.

/**
 * The code point of the digit zero in each script that has its own digits.
 * Digits of a script are the ten code points that start at its zero.
 */
const DIGIT_ZEROS = [
  0x0030, // ASCII
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic (Urdu)
  0x0966, // Devanagari (Hindi, Marathi)
  0x09e6, // Bengali (Bengali, Assamese)
  0x0a66, // Gurmukhi (Punjabi)
  0x0ae6, // Gujarati
  0x0b66, // Odia
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
];

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?।]/gu;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu;

/**
 * Pure functions for comparing the numbers, links and emails of two texts.
 */
export class NumberLock {
  /**
   * Replace every digit of a supported script with its ASCII digit.
   *
   * :param text: Any text.
   * :return: The text with ASCII digits only.
   */
  static toAsciiDigits(text) {
    let out = "";
    for (const char of String(text)) {
      const code = char.codePointAt(0);
      let replaced = char;
      for (const zero of DIGIT_ZEROS) {
        if (code >= zero && code <= zero + 9) {
          replaced = String(code - zero);
          break;
        }
      }
      out += replaced;
    }
    return out;
  }

  /**
   * Remove links and emails, which are compared whole, so their digits are not counted
   * as numbers.
   *
   * :param text: Text with ASCII digits.
   * :return: The text without links and emails.
   */
  static withoutLinks(text) {
    return text.replace(URL_PATTERN, " ").replace(EMAIL_PATTERN, " ");
  }

  /**
   * List the numbers in a text, in order, as they are written there.
   *
   * A number is a run of digits. Commas between digit groups (1,20,000) are part of the
   * number. Any other mark, such as ":" in 4:30 or "-" in a phone number, splits it into
   * parts, so 4:30 is the two numbers 4 and 30.
   *
   * :param text: Any text, in any supported script.
   * :return: A list of {written, value}: the number as written (ASCII digits) and its
   *   value without commas and leading zeros.
   */
  static numbers(text) {
    const ascii = NumberLock.withoutLinks(NumberLock.toAsciiDigits(text));
    const found = [];
    for (const match of ascii.matchAll(/\d+(?:,\d+)*/gu)) {
      const written = match[0];
      const digits = written.replaceAll(",", "");
      const value = digits.replace(/^0+(?=\d)/u, "");
      found.push({
        written: written,
        value: value,
      });
    }
    return found;
  }

  /**
   * List the links and emails in a text, exactly as written.
   *
   * :param text: Any text.
   * :return: The links and emails, in order.
   */
  static links(text) {
    const value = String(text);
    return [...value.matchAll(URL_PATTERN), ...value.matchAll(EMAIL_PATTERN)].map(NumberLock.firstGroup);
  }

  /**
   * Return the whole match of a regular expression match.
   *
   * :param match: A match from matchAll.
   * :return: Its text.
   */
  static firstGroup(match) {
    return match[0];
  }

  /**
   * Count how often each value occurs in a list.
   *
   * :param values: A list of strings.
   * :return: A Map of value to count.
   */
  static counts(values) {
    const counts = new Map();
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return counts;
  }

  /**
   * List the values that `wanted` has more often than `have`, once per missing copy.
   *
   * :param wanted: Map of value to count that must be present.
   * :param have: Map of value to count that is present.
   * :return: The missing values.
   */
  static shortfall(wanted, have) {
    const missing = [];
    for (const [value, count] of wanted) {
      for (let index = have.get(value) || 0; index < count; index += 1) {
        missing.push(value);
      }
    }
    return missing;
  }

  /**
   * Compare a translation with its source.
   *
   * :param source: The original text.
   * :param translation: The translated text.
   * :return: {ok, kept, missing, added, linksMissing}. kept lists the source numbers as
   *   written; missing lists source numbers the translation lacks; added lists numbers the
   *   translation has and the source does not; linksMissing lists links or emails that are
   *   not copied exactly.
   */
  static compare(source, translation) {
    const sourceNumbers = NumberLock.numbers(source);
    const unused = NumberLock.numbers(translation);
    // Match each source number with one translated number of the same value. Numbers
    // written identically are matched first, so 00, 000 and 0000 (all the value 0) pair
    // with their own kind, and a message names the number the reader can find.
    let unmatched = sourceNumbers;
    for (const same of [NumberLock.sameWriting, NumberLock.sameValue]) {
      const still = [];
      for (const number of unmatched) {
        const index = unused.findIndex(same.bind(null, number));
        if (index === -1) {
          still.push(number);
        } else {
          unused.splice(index, 1);
        }
      }
      unmatched = still;
    }
    const missing = unmatched.map(NumberLock.writtenOf);
    const added = unused.map(NumberLock.writtenOf);
    const translatedLinks = NumberLock.counts(NumberLock.links(translation));
    const linksMissing = NumberLock.shortfall(NumberLock.counts(NumberLock.links(source)), translatedLinks);
    return {
      ok: missing.length === 0 && added.length === 0 && linksMissing.length === 0,
      kept: sourceNumbers.map(NumberLock.writtenOf),
      missing: missing,
      added: added,
      linksMissing: linksMissing,
    };
  }

  /**
   * Tell whether two numbers have the same value.
   *
   * :param a: An entry from numbers().
   * :param b: Another entry.
   * :return: True when their values match.
   */
  static sameValue(a, b) {
    return a.value === b.value;
  }

  /**
   * Tell whether two numbers are written the same way, grouping commas aside.
   *
   * :param a: An entry from numbers().
   * :param b: Another entry.
   * :return: True when their digits match exactly.
   */
  static sameWriting(a, b) {
    return a.written.replaceAll(",", "") === b.written.replaceAll(",", "");
  }

  /**
   * Return a number as written.
   *
   * :param number: An entry from numbers().
   * :return: Its written form.
   */
  static writtenOf(number) {
    return number.written;
  }

  /**
   * Explain a failed comparison in one sentence a model or a person can act on.
   *
   * :param result: The result of compare().
   * :return: The explanation, or "" when the comparison passed.
   */
  static explain(result) {
    const parts = [];
    if (result.missing.length) {
      parts.push(`it drops or changes ${NumberLock.quoteList(result.missing)}`);
    }
    if (result.added.length) {
      parts.push(`it adds ${NumberLock.quoteList(result.added)}, which the original does not have`);
    }
    if (result.linksMissing.length) {
      parts.push(`it does not copy ${NumberLock.quoteList(result.linksMissing)} exactly`);
    }
    if (!parts.length) {
      return "";
    }
    return `Number lock refused this translation: ${parts.join("; ")}. Keep every number, link and email exactly as in the original (digits of the target script are fine) and try again.`;
  }

  /**
   * Quote a list of values for a message.
   *
   * :param values: The values.
   * :return: For example: "4", "30" and "2026".
   */
  static quoteList(values) {
    const quoted = values.map(NumberLock.quote);
    if (quoted.length === 1) {
      return quoted[0];
    }
    return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
  }

  /**
   * Put one value in quotes.
   *
   * :param value: The value.
   * :return: The quoted value.
   */
  static quote(value) {
    return `"${value}"`;
  }
}
