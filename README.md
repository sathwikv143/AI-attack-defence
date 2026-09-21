# AI Attack & Defence Map

An open educational map of **AI / LLM attacks and the controls that blunt them**, organized by lifecycle stage.

Browse it like [OSINT Framework](https://osintframework.com/): expand a stage, open an attack, read how it works, then the paired defences. Every attack also has a short path animation through a stage-specific stack (training pipeline, RAG, agents, …).

No accounts. No backend. Static HTML/CSS/JS + [D3](https://d3js.org/) from a CDN. Content lives in one file: `[data/tree.json](data/tree.json)`.

This is **defence-oriented education** — high-level mechanisms and mitigations, not exploit recipes or payloads.

## Demo

<video src="assets/usage.mov" controls width="720" title="AI Attack & Defence Map usage demo"></video>

[Download usage demo (.mov)](assets/usage.mov) — Tree → attack note → Animate attack / Defences.

## Who it’s for

- Security engineers and AppSec reviewing LLM / RAG / agent designs
- ML / platform teams pairing threats with concrete controls
- Educators and students who want a single navigable overview (OWASP LLM Top 10– and MITRE ATLAS–aligned where tagged)



## What’s in the map


|                     |                                                      |
| ------------------- | ---------------------------------------------------- |
| **58 attacks**      | Across 7 lifecycle stages                            |
| **~174 defences**   | Grouped under each attack                            |
| **Path animations** | Attack (red) + Defences (green) for every attack     |
| **Resources**       | Optional papers, tools, standards on leaves          |
| **Crosswalk**       | OWASP / ATLAS chips where tagged                     |
| **Glossary**        | Hover shortforms (RLHF, LoRA, RAG, …) for expansions |




### Stages


| Stage        | Count | Examples                                                                         |
| ------------ | ----- | -------------------------------------------------------------------------------- |
| Training     | 7     | Data poisoning, backdoors, membership inference, gradient leakage                |
| Fine-tuning  | 8     | Alignment poison, preference hacking, LoRA backdoors, refusal bypass             |
| Supply Chain | 7     | Pickle / `torch.load`, hub malware, dependency poison, checkpoint swap           |
| Inference    | 10    | Prompt injection, jailbreaks, insecure output handling, model extraction         |
| RAG          | 8     | Corpus poison, indirect injection via docs, vector DB abuse, embedding inversion |
| Agents       | 9     | Tool misuse, plan hijack, malicious MCP, memory poison, credential exfil         |
| Monitoring   | 9     | Eval gaming, silent drift, poisoned feedback, shadow AI, alert fatigue           |




## Run locally

Any static file server works. From the repo root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

> Opening `index.html` as a `file://` URL may block loading `data/tree.json` in some browsers — use a local server.



## How to use the UI

1. **Tree** (default) — click a blue **stage**, then a red **attack**. Click **Attack** or a defence for the note (How / Impact / Resources). Drag to pan, scroll to zoom. **Fit** clears pan/zoom; **Reset** returns to Training.
2. **Stages** — same content as columns; pick an attack to read the note on the right.
3. **Search** — type to jump (`/` focuses the box). Matches names, tags, and resource titles.
4. **Animate attack / Animate defences** — on an attack note, walk the path through the stack. Click a component to inspect that step; multiple controls on one box show as bullets.
5. **Help** — short coach / how-to drawer.

Tablets are usable (pinch-zoom tree, Stages view). Phones work but the horizontal tree is cramped — a tighter mobile layout is planned later.

## Repo layout

```
index.html          App shell
css/                Layout, tree, path overlay
js/                 Tree, Stages, search, animate, glossary
data/tree.json      All attacks, defences, links, animate data
assets/usage.mov    Short UI walkthrough (linked above)
```



## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for node schema, link rules, animate paths, and how to add an attack safely.

## License

[MIT](LICENSE)