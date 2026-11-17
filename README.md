# 🌉 Bhasha Bridge

**English notices, in your language. Every number checked.**

Live site: https://sarveshkh786.github.io/bhasha-bridge/
Network URL: `https://sarveshkh786.github.io/bhasha-bridge/bhasha_bridge`

Bhasha Bridge is an [open agentic website](https://github.com/cognizant-ai-labs/agentic-web).
It puts English notices, bills and short texts into 12 Indian languages (Hindi, Bengali,
Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, Punjabi and Assamese), in
easy-read or standard style. It runs entirely in your browser, on the AI model and key
you choose.

Then it does what no model can promise: a **number lock**, written in plain code, checks
that every date, time, amount, phone number, link and email in the translation matches
the original before the page shows it.

## Why

The mistakes that hurt in a translated notice are rarely the words. They are the water cut
that moved from 4:30 to 4:00, the helpline that lost a digit, the "19-12-2026" that became
"19 December" and lost the month someone checks, the fee that appeared from nowhere. Models
make exactly these mistakes, and a reader who cannot read the original cannot catch them.

So the model translates, and code verifies. A wrong translation is refused, the model is
told exactly which numbers to fix, and nothing wrong ever reaches the page.

## What it does

- **One-click page rewriting.** Pick a language above the notice. The agent reads the
  page, writes each section in that language through the site's own tools, and the page
  rewrites itself in place, with the right `lang` and `dir` attributes for screen readers
  and right-to-left Urdu. It is not only a chatbot.
- **Number lock.** [`js/number-lock.js`](js/number-lock.js) reads digits in every script
  the page offers (४:३० = ৪:৩০ = ۴:۳۰ = 4:30), ignores grouping commas (₹1,20,000 =
  ₹120000), and compares numbers as multisets, so a repeated number must stay repeated.
  Links and emails must be copied exactly. It names what was dropped, changed or added.
- **Self-correcting loop.** A refusal goes back to the model as a tool result with the
  exact numbers to fix. It retries once. The page's lock log shows what was caught.
- **Your own text.** Paste any English text into the box; the lock checks the
  translation against what you pasted.
- **No key needed to see the lock.** The "See the number lock work" box runs the same
  check live, with no model at all.
- **Callable by any agentic site.** Other sites add the network URL to an agent's
  `tools`. Their visitor approves a consent card, the network runs in that visitor's
  browser on their own key, and it answers with the translation plus a `Numbers kept:`
  line, so the caller can run the same check with the copyable lock module.

## How it fits the Open Agentic Web spec

| Spec piece | Here |
| --- | --- |
| Data-only network | [`bhasha_bridge.hocon`](bhasha_bridge.hocon) → [`bhasha_bridge.network.json`](bhasha_bridge.network.json) |
| Manifest | [`agent-manifest.json`](agent-manifest.json): network, front agent, router, peer policy, actions |
| Browser runtime | [`runtime/`](runtime/): the agentify-website skill's patched nsdeploy runtime, unchanged |
| BYOK | ⚙ AI model settings in the chat. Default: Google AI Studio (free tier), `models/gemini-3.8-flash`. Any OpenAI-compatible provider that allows browser calls works. |
| Grounded site actions | [`site-actions.js`](site-actions.js): `get_notice` (read), `show_translation`, `show_original`, `show_pasted_translation` (writes the visitor can undo on the page) |
| Peer linking | Network URL above; `links.json`, `bridge/`, `.well-known/` discovery files |

The agent network is one agent, `bhasha_translator`, which owns every `website_*` tool.
Translating the whole notice takes three model calls when nothing is refused: read, write
all five sections in one reply, answer.

## Run it locally

```shell
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/, expand **⚙ AI model settings**, pick a provider and paste
your key, then select **Save and start**. On `localhost` the runtime also keeps the key in
a cookie for local ports, so use a key with a low limit, and afterwards select
**Delete setup** under **Advanced settings** and close the tab.

## Tests

```shell
python3 scripts/build.py --check     # network, manifest and generated files agree
node --test "tests/*.test.mjs"       # number lock, page object, actions, published files
```

`scripts/build.py` turns the HOCON into the published JSON and writes the discovery files.
Edit the `.hocon` or the manifest, never the generated files.

The full agent loop (runtime → model → `website_*` tools → number lock → page) was also
checked in headless Chrome against a local scripted OpenAI-compatible model that makes
one deliberate number mistake: the lock refused it, the model fixed it, and only correct
text reached the page.

## Privacy and limits

- Your messages and the page text go to the AI provider you pick, with your key. Nothing
  goes to this site: it is static files on GitHub Pages.
- The network file, instructions included, is public by design.
- The lock checks numbers, links and emails. It cannot judge the meaning of the words, and
  numbers written as words ("two") are not checked. Translations are not certified for
  legal or official use.
- Other agent sites that call this network get no `website_*` tools, so the lock does not
  run for them unless they copy `js/number-lock.js`; the `Numbers kept:` line makes that
  easy.
- GitHub Pages cannot set the `Content-Security-Policy` header the spec suggests for
  `runtime/sandbox-worker.js`. This site runs no coded tools.
- The Shantinagar notice is fictional; its phone number and link are placeholders.

## Files

```text
index.html, styles.css, favicon.svg   the page
js/notice.js                          languages, reading levels and the sample notice
js/number-lock.js                     the number lock (no dependencies)
js/app.js                             the page object: state, rendering, every change
js/lock-demo.js                       the no-key lock demo
site.js                               boots the runtime, wires the language buttons
site-actions.js                       the website_* tools
bhasha_bridge.hocon                   the agent network (source of truth)
bhasha_bridge.network.json            generated
agent-manifest.json, links.json       public bundle files
agent-mcp.json, .well-known/, bridge/ generated discovery and bridge files
runtime/                              browser runtime (Apache-2.0, see runtime/README.md)
scripts/build.py                      build and checks
tests/                                Node tests
```

## Credits

Built for the [Open Agentic Web Challenge](https://cognizant-agenticweb.devpost.com/).
The browser runtime is the agentify-website skill's copy of
[nsdeploy](https://github.com/cognizant-ai-lab/nsdeploy)'s runtime (Apache-2.0).
Written with help from an AI coding assistant (Claude). Licensed under Apache-2.0.
