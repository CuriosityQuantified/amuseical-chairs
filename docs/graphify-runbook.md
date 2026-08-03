# graphify runbook

How to install [graphify](https://github.com/Graphify-Labs/graphify) in a repo, commit
the knowledge graph, make an assistant actually use it, and keep it from rotting.

Written from doing it to this repo (a Node/Express party game). Steps are generic
unless marked **[node]**; the worked numbers are from this repo, and they are here
because the failure modes are much easier to recognise with real figures attached.

The two things most worth copying are **step 2** (which decides whether the graph is
useful at all) and **step 7** (where two obvious designs are wrong).

---

## 0. Quickstart

```bash
uv tool install "graphifyy[mcp]"          # 1. install
graphify install --project                # 1. register the skill
$EDITOR .graphifyignore                   # 2. exclude vendored code FIRST
graphify extract . --code-only            # 3. free/deterministic pass
graphify god-nodes                        # 3. STOP and read this before continuing
graphify extract . --backend claude-cli   # 3. semantic pass over docs
graphify label . --backend=claude-cli     # 3. name the communities
graphify hook install                     # 6. post-commit rebuild + merge driver
```

Then do steps 4–7 (what to commit, MCP wiring, freshness gate) by hand.

---

## 1. Install

```bash
uv tool install "graphifyy[mcp]"    # or: pipx install "graphifyy[mcp]"
graphify install --project
```

- The PyPI package is **`graphifyy`** (double-y). The command is `graphify`.
- Take the **`[mcp]` extra on the first install**. Plain `graphifyy` installs the
  `graphify-mcp` executable but *not* the `mcp` package, so the server dies at
  startup with `ModuleNotFoundError: No module named 'mcp'`.
- `graphify install --project` writes `.claude/skills/graphify/` (SKILL.md plus a
  `references/` sidecar), `.claude/CLAUDE.md`, a `## graphify` section in the root
  `CLAUDE.md`, and PreToolUse hooks into `.claude/settings.json`. See step 4 for
  why those hooks must not stay in that file.
- No API key? `--backend claude-cli` shells out to a local `claude` CLI. The
  `claude` backend (direct API) requires `ANTHROPIC_API_KEY`.

---

## 2. Write `.graphifyignore` before you extract

This single step decides whether the graph is worth having.

```
.claude/            # graphify's own vendored skill docs (~124KB of markdown)
CLAUDE.md
graphify-out/
package-lock.json   # a lockfile is a manifest, not a concept map
public/vendor/      # vendored three.js  <- the one that mattered
```

`.gitignore` is honoured too, so `node_modules/` is already out.

**What happens if you skip it.** This repo's first extraction returned **2815 nodes**
whose god nodes were `Vector3`, `WebGLRenderer`, `Object3D`, `BatchedMesh`,
`Matrix4` — 2MB of vendored three.js against ~300KB of actual project code. `Room`,
the real centre of the system, placed **third**. After excluding `public/vendor/`:
**361 nodes**, `Room` first at 57 edges, and every community name recognisable.

**The diagnostic — run this, do not skip it:**

```bash
graphify extract . --code-only && graphify god-nodes
```

If the top of that list is not code your repo is answerable for, the ignore file is
wrong. Fix it and re-extract before spending an LLM pass on anything.

Generic candidates to exclude: vendored or bundled dependencies, generated API
clients, protobuf/OpenAPI output, minified assets, fixtures, lockfiles, and any
tool's own documentation that happens to live in the tree.

---

## 3. Build the graph

```bash
graphify extract . --code-only              # local tree-sitter AST: free, deterministic, offline
graphify extract . --backend claude-cli     # adds docs/PDFs/images via an LLM
graphify label . --backend=claude-cli       # community names
```

Split it this way deliberately: the code pass costs nothing and is reproducible, so
get it right first. Only then spend tokens on the semantic pass.

Outputs land in `graphify-out/`: `graph.json` (queried), `graph.html` (interactive),
`GRAPH_REPORT.md` (god nodes, communities, suggested questions).

Verify with real queries rather than trusting the build log:

```bash
graphify explain "<your central class>"
graphify path "<A>" "<B>"
graphify query "how does X work?"
graphify affected "<a function everything depends on>"
```

`affected` is the one that earns its keep. In this repo, `affected "seededRng()"`
returns 20 nodes — the 8 call sites plus the tests and the static checker — which is
exactly the blast radius of its "no `Math.random()`" rule.

---

## 4. Decide what to commit

**Commit:**

| File | Why |
|---|---|
| `graphify-out/graph.json` | what every query reads; a fresh clone can query with no rebuild |
| `graphify-out/graph.html`, `GRAPH_REPORT.md` | the human-facing artifacts |
| `graphify-out/.graphify_labels.json` + `.sig` | LLM community names survive an AST-only rebuild |
| `graphify-out/graph-lock.json` | the freshness gate (step 7) |
| `.mcp.json`, `.gitattributes`, `.claude/skills/`, `CLAUDE.md` | the wiring |

**Never commit:**

| File | Why |
|---|---|
| `graphify-out/.graphify_root` | contains an **absolute path** |
| `graphify-out/manifest.json` | per-file **mtimes** = checkout time on a fresh clone, so every machine's first rebuild rewrites every entry |
| `cache/`, `memory/`, `reflections/`, `YYYY-MM-DD/` backups | regenerable churn |
| `.claude/settings.local.json` | machine-specific (below) |

**Move the PreToolUse hooks out of `.claude/settings.json` into
`.claude/settings.local.json`, and gitignore that.** `graphify install` resolves the
graphify executable to an absolute path at install time (`/root/.local/bin/graphify`
in our container). That is a deliberate cross-shell fix upstream and correct on
exactly one machine — committed, it is a broken hook on every other. Each developer
runs the install themselves and gets their own paths.

Suggested `.gitignore` block:

```gitignore
graphify-out/.graphify_root
graphify-out/.graphify_analysis.json
graphify-out/.graphify_semantic_marker
graphify-out/manifest.json
graphify-out/cache/
graphify-out/memory/
graphify-out/reflections/
graphify-out/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/
.claude/settings.local.json
```

---

## 5. Make it get used: MCP, not bash

A graph queried by a command someone has to remember is a graph that gets
documented and not used. Register it as a project MCP server instead:

```json
{
  "mcpServers": {
    "graphify": {
      "command": "graphify-mcp",
      "args": ["--graph", "graphify-out/graph.json"],
      "env": {}
    }
  }
}
```

Commit that as `.mcp.json`. It yields 10 native tools: `query_graph`, `get_node`,
`get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, and
three PR tools.

A **bare, PATH-resolved command is correct here**, unlike the hooks in step 4: a
missing MCP server simply fails to start and reports it, rather than erroring on
every file read.

**One-time approval.** Project `.mcp.json` servers need a trust prompt — a real
security boundary, since a cloned repo should not silently execute a binary.
`"enabledMcpjsonServers": ["graphify"]` in `.claude/settings.local.json` approves it
per-machine. Putting it in a committed `.claude/settings.json` approves it for
everyone, which is defensible for a repo's own tooling but spends a security
decision on your contributors' behalf — decide that deliberately.

Verify by *calling a tool*, not by reading config. `claude mcp list` can report
"Pending approval" while the running session already has the tools, because it reads
approval state from a different file.

---

## 6. Keep it current

```bash
graphify hook install
```

Installs a post-commit rebuild and a post-checkout hook, registers a union **merge
driver** in git config, and writes `.gitattributes`.

**Commit the `.gitattributes` line.** It is the only portable half:

```gitattributes
graphify-out/graph.json merge=graphify
```

`graph.json` is ~13k lines of generated JSON that two branches will both touch.
Without the driver, every branch merge is a conflict in a generated file, and the
realistic outcome of that is not careful resolution — it is somebody deleting the
graph. Git falls back to an ordinary text merge where the driver is not configured,
so committing the attributes file is safe for everyone.

**[node]** Package the commands so nobody has to remember them:

```json
"graph":         "graphify update . && node scripts/graph-lock.mjs",
"graph:rebuild": "graphify extract . && node scripts/graph-lock.mjs",
"graph:report":  "graphify god-nodes --top 15",
"graph:setup":   "graphify install --project && graphify hook install"
```

`graphify update .` is AST-only: no API key, no cost, no LLM. That is the one to run
after a normal code change. `graphify extract .` also re-reads docs and needs a backend.

---

## 7. The freshness gate

A committed graph is only worth having while it is true. Gate it in CI — but three
obvious designs are wrong, and two of them look fine until you test them.

### Designs that do not work

**`built_at_commit` vs `HEAD`.** The graph records the commit it was built from and
*cannot* record the commit that adds it, so a single commit carrying code + graph
always reads one behind. Permanently red.

**Co-change ("`graph.json` must appear in the same diff as the code").** This is the
trap. It diffs `merge-base..HEAD`, so whichever commit first added the graph
satisfies the rule for the entire life of the branch. Shipped it, wrote a mutation
test, and the test came back **green** on a source change with no graph refresh.

**Rebuild in CI and diff.** Flaky. Leiden clustering is not stable: identical code
re-clustered into 17 → 20 → 19 → 21 → 24 communities across successive rebuilds here.

### What works: content hashes

graphify already MD5s every file it indexes, in `manifest.json`. That file is not
committable (mtimes, step 4), so distil it into one that is.

**`graph-lock.json`** — sorted `path → {ast, semantic}`, no mtimes, so it is
byte-identical across machines and manufactures no merge conflicts:

```json
{ "files": { "server/room.js": { "ast": "351b61…", "semantic": "351b61…" } } }
```

Generator contract (~40 lines in any language; ours is `scripts/graph-lock.mjs`):

1. Read `graphify-out/manifest.json`.
2. For each path **sorted**, emit `{ast: entry.ast_hash, semantic: entry.semantic_hash || null}`.
3. Skip entries with no `ast_hash` and say so — an empty hash makes the check
   unfalsifiable for that file.
4. Write with stable formatting and a trailing newline.

Wire it into the same command that rebuilds the graph, so it can never drift.

Checker logic (ours is rule 7 in `scripts/check.mjs`):

```
for each (path, {ast, semantic}) in lock.files:
    missing on disk        -> FAIL "indexed, now deleted"
    md5(path) != ast       -> FAIL "stale"
    doc and semantic != md5-> WARN  (see below)
for each source file in the tree:
    not in lock            -> FAIL "new, never indexed"
```

Needs no git history, so it holds in a shallow clone, a tarball, and CI without any
extra checkout depth.

### Two hashes, two severities

The subtlety worth carrying over. graphify keeps **`ast_hash`** *and*
**`semantic_hash`**, and blanks the semantic one whenever a file changes.
`graphify update` refreshes the AST for free but **never re-reads a doc**.

So a lock keyed on `ast` alone reports a rewritten README as fresh while its doc
nodes still describe the old prose — a false green, which is the exact failure a
freshness gate exists to prevent.

- **Hard-fail on `ast`** — fixable for free by `graphify update .`, so CI can demand it.
- **Warn on `semantic`** for `.md`/`.html`/`.yml` — fixable only by a rebuild with an
  LLM backend, which CI does not have and should not gate on.

### Mutation-test it

A freshness rule that never fires is worse than none. Test all four, in a throwaway
copy of the repo:

| Mutation | Expected |
|---|---|
| edit an indexed source file | FAIL "stale" |
| delete an indexed source file | FAIL "indexed, now deleted" |
| add a new module | FAIL "new, never indexed" |
| delete the lock | FAIL "missing" |

---

## 8. Gotchas

- **Package `graphifyy`, command `graphify`.** Other `graphify*` packages are unrelated.
- **`uvx graphify …` fails.** Use `uvx --from graphifyy graphify …`.
- **Node counts in prose are self-defeating.** Documenting the graph edits the docs
  the graph indexes, so any hardcoded figure is wrong by the next commit. Let the
  generated `GRAPH_REPORT.md` carry exact numbers; keep prose approximate.
- **Community names drift** on every rebuild, and some fall back to hub names. Re-run
  `graphify label .`. Committing `.graphify_labels.json` preserves them across
  AST-only updates.
- **`dropped N out-of-scope node(s) (#1895)`** is benign: the model mis-attributed
  nodes to files it was not given and graphify discarded them itself.
- **`graph.html` loads vis-network from a CDN.** It needs a network to render;
  `graph.json` and `GRAPH_REPORT.md` are self-contained and every CLI command is offline.
- **Order of operations:** edit docs → rebuild → commit. The docs are indexed too.
- **The graph is one commit behind by construction.** Do not try to fix this; it is
  why the freshness gate hashes content instead of comparing commits.

---

## 9. Adapting to a non-Node repo

Only the packaging is Node-specific. Replace it with whatever the repo already uses
so the graph rides existing habits rather than adding new ones:

| Node here | Elsewhere |
|---|---|
| `package.json` scripts | `Makefile` targets, `just` recipes, `tox`/`nox`, `cargo xtask` |
| `scripts/graph-lock.mjs` | ~40 lines of Python/Go/Ruby against the same manifest |
| rule 7 in `scripts/check.mjs` | a `pre-commit` hook, a pytest, a lint step |
| `npm run check` in CI | whatever job already blocks a merge |

Put the freshness check wherever your repo already fails builds. A gate in a job
nobody watches is the same as no gate.
