# Contributing

Most contributions are **content**: edit [`data/tree.json`](data/tree.json). The UI reads that file and draws the tree.

Code changes (layout, animations, glossary) live under `js/` and `css/`. Keep the product educational: describe mechanisms and mitigations, **not** exploit payloads or step-by-step attack recipes.

## Quick path: add or edit an attack

1. Open `data/tree.json` and find the right **stage** (`Training`, `RAG`, …).
2. Copy an existing `attack` sibling as a template.
3. Fill `name`, `tag` / `owasp`, `detail`, `impact`, defences, optional `links`, and `animate` (see below).
4. Serve locally and click through Tree + Animate for that leaf:

```bash
python3 -m http.server 8080
```

5. Open a PR that says what you added and why (one sentence is enough).

## Node types

| `type` | Color / role | Notes |
|--------|----------------|-------|
| `root` | Map root | One node |
| `stage` | Blue folder | Lifecycle bucket |
| `attack` | Red folder | Threat name; holds Attack + Defences |
| `attack-info` | Red leaf | Usually named `"Attack"` — How, Impact, Resources, Animate |
| `defence-group` | Folder | Usually named `"Defences"` |
| `defence` | Teal leaf | One control |

Typical shape under a stage:

```text
stage
└── attack
    ├── attack-info      ("Attack")
    └── defence-group    ("Defences")
        ├── defence
        └── defence
```

Keep `detail` and `impact` to **1–2 sentences** each. Prefer concrete verbs (“indexes the poisoned chunk”) over vague risk language.

## Example attack stub

```json
{
  "name": "Example Attack",
  "type": "attack",
  "tag": "OWASP-LLM01",
  "severity": "high",
  "children": [
    {
      "name": "Attack",
      "type": "attack-info",
      "detail": "One or two sentences on the mechanism — not a recipe.",
      "impact": "What goes wrong for the system or user.",
      "owasp": "OWASP-LLM01",
      "owaspUrl": "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
      "atlasUrl": "https://atlas.mitre.org/",
      "links": [
        {
          "kind": "standard",
          "title": "OWASP LLM01",
          "url": "https://genai.owasp.org/llmrisk/llm01-prompt-injection/"
        }
      ],
      "animate": {
        "title": "Example Attack",
        "diagram": "infer",
        "steps": [
          { "id": "attacker", "label": "Attacker crafts untrusted input." },
          { "id": "input", "label": "Input enters the prompt path." },
          { "id": "llm", "label": "Model follows the steered instruction." }
        ],
        "controls": [
          {
            "id": "gateway",
            "name": "Instruction hierarchy",
            "label": "System policy outranks untrusted user/tool text."
          }
        ],
        "blockEdges": [
          { "from": "attacker", "to": "input", "when": "input" }
        ]
      }
    },
    {
      "name": "Defences",
      "type": "defence-group",
      "children": [
        {
          "name": "Instruction hierarchy",
          "type": "defence",
          "detail": "System policy outranks untrusted user/tool text."
        }
      ]
    }
  ],
  "owasp": "OWASP-LLM01",
  "owaspUrl": "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
  "atlasUrl": "https://atlas.mitre.org/"
}
```

Put crosswalk fields (`owasp`, `owaspUrl`, `atlasUrl`, `tag`) on the `attack` folder and mirror them on `attack-info` when useful so chips still show if someone opens only the leaf.

## Resources (`links`)

Optional on `attack-info` and `defence`:

| `kind` | Use for |
|--------|---------|
| `article` | Papers, blog posts, explainers |
| `tool` | Scanners, libraries, benchmarks |
| `standard` | OWASP, ATLAS, NIST, vendor guidance |
| `checklist` | Operational checklists |

Rules:

- Link to docs, papers, project homes, or standards — **never** to exploit kits or “how to attack X” walkthroughs.
- Prefer **1–3** strong links over long lists.
- Titles should be short and scannable.

## Animate paths

`animate` on `attack-info` powers **Animate attack** and **Animate defences**.

| Field | Meaning |
|-------|---------|
| `title` | Overlay heading |
| `diagram` | Which stack SVG to show |
| `steps` | Attack path beats (`id` + `label`) |
| `controls` | Defence beats (`id`, `name`, `label`) — usually match the defence children |
| `blockEdges` | Optional: green-block an edge once a component is secured |

### Diagrams and valid `id`s

Defined in [`js/diagrams.js`](js/diagrams.js):

| `diagram` | Stage | Component ids (in order) |
|-----------|--------|---------------------------|
| `train` | Training | `attacker` → `dataset` → `labeler` → `trainer` → `model` → `api` → `user` |
| `finetune` | Fine-tuning | `attacker` → `data` → `trainer` → `adapter` → `base` → `eval` → `deploy` |
| `supply` | Supply Chain | `attacker` → `registry` → `artifact` → `loader` → `runtime` → `host` → `user` |
| `infer` | Inference | `attacker` → `input` → `gateway` → `llm` → `tools` → `output` → `user` |
| `rag` | RAG | `attacker` → `corpus` → `embedder` → `vector_db` → `retriever` → `llm` → `user` |
| `agent` | Agents | `attacker` → `user` → `planner` → `llm` → `tools` → `memory` → `egress` |
| `monitor` | Monitoring | `attacker` → `traffic` → `detectors` → `logs` → `feedback` → `ops` |

Rules:

- Every `steps[].id` / `controls[].id` **must** exist on that diagram.
- Consecutive items with the **same** `id` share one beat; captions become bullets.
- Captions stay educational — mechanism and control placement, not reproduction steps.
- Keep `controls` aligned with the defence children under that attack (same names where possible).

## Glossary shortforms

Hover expansions live in [`js/glossary.js`](js/glossary.js). If you introduce a new acronym in copy (e.g. a new training method), add it there so notes and captions pick it up.

## UI / code changes

- Prefer small, focused PRs (content vs. behavior separated when possible).
- Match existing vanilla JS style; no bundler required.
- After changing diagrams, spot-check one attack per stage with Animate attack + Defences.
- Don’t add auth, analytics, or a backend without discussion — the project is intentionally static.

## License

By contributing you agree your changes are licensed under the [MIT License](LICENSE).
