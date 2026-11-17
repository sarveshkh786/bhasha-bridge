#!/usr/bin/env python3
"""Build Bhasha Bridge's published files from bhasha_bridge.hocon and agent-manifest.json.

Writes bhasha_bridge.network.json (the HOCON as JSON, as the browser runtime loads it), the
optional discovery files and the bridge manifest, then checks the network the way the
agentify-website skill's build does for this site: names, placeholders, tool names,
sample queries and instruction sizes. Run from the repository root:

    python3 scripts/build.py          # build and check
    python3 scripts/build.py --check  # check only; fail if a generated file is out of date
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NETWORK = "bhasha_bridge"
MAX_INSTRUCTIONS = 5000


def hocon_to_json(text):
    """Convert the HOCON subset this site uses (comments, triple-quoted strings) to JSON."""
    out = []
    i = 0
    in_string = False
    while i < len(text):
        if not in_string and text.startswith('"""', i):
            end = text.index('"""', i + 3)
            out.append(json.dumps(text[i + 3:end]))
            i = end + 3
            continue
        char = text[i]
        if in_string:
            out.append(char)
            if char == "\\":
                out.append(text[i + 1])
                i += 1
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
            out.append(char)
        elif char == "#" or text.startswith("//", i):
            while i < len(text) and text[i] != "\n":
                i += 1
            continue
        else:
            out.append(char)
        i += 1
    joined = "".join(out)
    # Allow trailing commas, which HOCON accepts.
    joined = re.sub(r",(\s*[}\]])", r"\1", joined)
    return json.loads(joined)


def expand(instructions, replacements):
    """Expand {placeholders} once, as the browser does, and report unknown ones."""
    unknown = []

    def substitute(match):
        key = match.group(1)
        if key in replacements:
            return replacements[key]
        unknown.append(key)
        return match.group(0)

    return re.sub(r"\{([a-z_]+)\}", substitute, instructions), unknown


def check(network, manifest):
    """Return a list of errors for the network and manifest."""
    errors = []
    entry = manifest["networks"][0]
    if entry["name"] != NETWORK or entry["hocon"] != f"./{NETWORK}.network.json":
        errors.append("manifest network name or hocon path does not match the file name")
    agents = {agent["name"]: agent for agent in network["tools"]}
    if entry["front_man"] not in agents:
        errors.append(f"front_man {entry['front_man']} is not an agent in the network")
    if network["metadata"]["sample_queries"] != entry["sample_queries"]:
        errors.append("sample_queries differ between the HOCON and the manifest")
    replacements = network["commondefs"]["replacement_strings"]
    for key, value in replacements.items():
        if re.search(r"\{[a-z_]+\}", value):
            errors.append(f"replacement string {key} contains a placeholder; the browser expands once")
    agent_tools = set(manifest["actions"]["agentTools"])
    actions_source = (ROOT / "site-actions.js").read_text(encoding="utf-8")
    registered = set(re.findall(r'name: "([a-z_]+)"', actions_source))
    for name in agent_tools - registered:
        errors.append(f"agentTools lists {name}, which site-actions.js does not register")
    text_blob = json.dumps(network)
    for marker in ("TODO", "<site", "<network", "<front", "demo_mode", "AAOSA", "aaosa"):
        if marker in text_blob:
            errors.append(f"leftover marker {marker!r} in the network")
    for name, agent in agents.items():
        expanded, unknown = expand(agent.get("instructions", ""), replacements)
        for key in unknown:
            errors.append(f"agent {name} uses unknown placeholder {{{key}}}")
        for tool in set(re.findall(r"website_([a-z_]+)", expanded)):
            if tool not in agent_tools:
                errors.append(f"agent {name} names website_{tool}, which agentTools does not list")
        if len(expanded) > MAX_INSTRUCTIONS:
            errors.append(f"agent {name} instructions are {len(expanded)} characters (limit {MAX_INSTRUCTIONS})")
        for ref in agent.get("tools", []):
            if isinstance(ref, str) and not ref.startswith("http") and ref not in agents:
                errors.append(f"agent {name} calls unknown agent {ref}")
        print(f"agent {name}: {len(expanded)} characters of expanded instructions")
    if "model_name" not in network.get("llm_config", {}):
        errors.append("llm_config.model_name is missing")
    return errors


def generated_files(network, manifest):
    """Return the generated files as a mapping of path to text."""
    def dump(value):
        return json.dumps(value, indent=2, ensure_ascii=False) + "\n"

    bridge_manifest = {
        "networks": [{"name": entry["name"]} for entry in manifest["networks"]],
        "actions": {"version": 1},
    }
    return {
        f"{NETWORK}.network.json": dump(network),
        "agent-mcp.json": dump(manifest["agent_mcp"]),
        ".well-known/nsdeploy-agent.json": dump(manifest["agent_mcp"]),
        ".well-known/nsdeploy.json": dump(manifest["linking"]),
        "bridge/agent-manifest.json": dump(bridge_manifest),
    }


def main():
    only_check = "--check" in sys.argv
    network = hocon_to_json((ROOT / f"{NETWORK}.hocon").read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / "agent-manifest.json").read_text(encoding="utf-8"))
    errors = check(network, manifest)
    for path, text in generated_files(network, manifest).items():
        target = ROOT / path
        if only_check:
            if not target.exists() or target.read_text(encoding="utf-8") != text:
                errors.append(f"{path} is out of date; run python3 scripts/build.py")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")
            print(f"wrote {path}")
    if not (ROOT / "bridge" / "action-bridge.html").exists():
        errors.append("bridge/action-bridge.html is missing; copy it from the skill's templates/bridge/")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
