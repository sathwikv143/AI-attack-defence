/**
 * Stage-specific stack diagrams for attack/defence path animation.
 * Node ids must match animate.steps[].id / animate.controls[].id.
 */

const ARROW = `
  <defs>
    <marker id="path-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#30363d" />
    </marker>
  </defs>`;

function node(id, x, y, w, h, lines) {
  const labels = lines
    .map((line, i) => {
      const n = lines.length;
      const base = h / 2 + 4;
      const yOff = n === 1 ? base : base - 8 + i * 16;
      const size = line.size ? ` style="font-size:${line.size}px"` : "";
      return `<text class="path-comp-label" x="${w / 2}" y="${yOff}"${size}>${line.t}</text>`;
    })
    .join("");
  return `<g class="path-node" data-id="${id}" transform="translate(${x},${y})">
    <rect class="path-comp" width="${w}" height="${h}" rx="4" />
    ${labels}
  </g>`;
}

function edge(from, to, d, extraClass = "") {
  const cls = extraClass ? `path-edge ${extraClass}` : "path-edge";
  return `<path class="${cls}" data-from="${from}" data-to="${to}" d="${d}" />`;
}

/** Training / pretrain pipeline */
function train() {
  return `<svg class="path-svg" viewBox="0 0 920 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "dataset", "M110,120 H150")}
    ${edge("dataset", "labeler", "M250,120 H290")}
    ${edge("labeler", "trainer", "M390,120 H430")}
    ${edge("trainer", "model", "M530,120 H570")}
    ${edge("model", "api", "M670,120 H710")}
    ${edge("api", "user", "M810,120 H850")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("dataset", 150, 80, 100, 80, [{ t: "Dataset" }, { t: "/ corpus", size: 10 }])}
    ${node("labeler", 290, 80, 100, 80, [{ t: "Labeler" }])}
    ${node("trainer", 430, 80, 100, 80, [{ t: "Trainer" }])}
    ${node("model", 570, 80, 100, 80, [{ t: "Model" }])}
    ${node("api", 710, 80, 100, 80, [{ t: "API" }, { t: "/ serve", size: 10 }])}
    ${node("user", 850, 80, 60, 80, [{ t: "User" }])}
  </svg>`;
}

/** Fine-tuning / RLHF / adapters */
function finetune() {
  return `<svg class="path-svg" viewBox="0 0 920 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "data", "M110,120 H150")}
    ${edge("data", "trainer", "M250,120 H290")}
    ${edge("trainer", "adapter", "M390,120 H430")}
    ${edge("adapter", "base", "M530,120 H570")}
    ${edge("base", "eval", "M670,120 H710")}
    ${edge("eval", "deploy", "M810,120 H850")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("data", 150, 80, 100, 80, [{ t: "SFT / prefs" }])}
    ${node("trainer", 290, 80, 100, 80, [{ t: "Trainer" }])}
    ${node("adapter", 430, 80, 100, 80, [{ t: "Adapter" }, { t: "/ LoRA", size: 10 }])}
    ${node("base", 570, 80, 100, 80, [{ t: "Base" }, { t: "model", size: 10 }])}
    ${node("eval", 710, 80, 100, 80, [{ t: "Eval" }])}
    ${node("deploy", 850, 80, 60, 80, [{ t: "Deploy" }])}
  </svg>`;
}

/** Model / package supply chain */
function supply() {
  return `<svg class="path-svg" viewBox="0 0 920 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "registry", "M110,120 H150")}
    ${edge("registry", "artifact", "M250,120 H290")}
    ${edge("artifact", "loader", "M390,120 H430")}
    ${edge("loader", "runtime", "M530,120 H570")}
    ${edge("runtime", "host", "M670,120 H710")}
    ${edge("host", "user", "M810,120 H850")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("registry", 150, 80, 100, 80, [{ t: "Hub" }, { t: "/ registry", size: 10 }])}
    ${node("artifact", 290, 80, 100, 80, [{ t: "Artifact" }])}
    ${node("loader", 430, 80, 100, 80, [{ t: "Loader" }])}
    ${node("runtime", 570, 80, 100, 80, [{ t: "Runtime" }])}
    ${node("host", 710, 80, 100, 80, [{ t: "Host" }])}
    ${node("user", 850, 80, 60, 80, [{ t: "User" }])}
  </svg>`;
}

/** Inference / prompt path */
function infer() {
  return `<svg class="path-svg" viewBox="0 0 920 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "input", "M110,120 H150")}
    ${edge("input", "gateway", "M250,120 H290")}
    ${edge("gateway", "llm", "M390,120 H430")}
    ${edge("llm", "tools", "M530,120 H570")}
    ${edge("tools", "output", "M670,120 H710")}
    ${edge("output", "user", "M810,120 H850")}
    ${edge("user", "input", "M880,160 C880,220 200,220 200,160", "path-edge-loop")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("input", 150, 80, 100, 80, [{ t: "Input" }, { t: "/ context", size: 10 }])}
    ${node("gateway", 290, 80, 100, 80, [{ t: "Gateway" }])}
    ${node("llm", 430, 80, 100, 80, [{ t: "LLM" }])}
    ${node("tools", 570, 80, 100, 80, [{ t: "Tools" }])}
    ${node("output", 710, 80, 100, 80, [{ t: "Output" }])}
    ${node("user", 850, 80, 60, 80, [{ t: "User" }])}
  </svg>`;
}

/** RAG / retrieval stack */
function rag() {
  return `<svg class="path-svg" viewBox="0 0 920 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "corpus", "M110,120 H150")}
    ${edge("corpus", "embedder", "M250,120 H290")}
    ${edge("embedder", "vector_db", "M390,120 H430")}
    ${edge("vector_db", "retriever", "M530,120 H570")}
    ${edge("retriever", "llm", "M670,120 H710")}
    ${edge("llm", "user", "M780,120 H830")}
    ${edge("user", "retriever", "M865,160 C865,220 620,220 620,160", "path-edge-loop")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("corpus", 150, 80, 100, 80, [{ t: "Corpus" }, { t: "/ docs", size: 10 }])}
    ${node("embedder", 290, 80, 100, 80, [{ t: "Embedder" }])}
    ${node("vector_db", 430, 80, 100, 80, [{ t: "Vector" }, { t: "DB", size: 10 }])}
    ${node("retriever", 570, 80, 100, 80, [{ t: "Retriever" }])}
    ${node("llm", 710, 80, 70, 80, [{ t: "LLM" }])}
    ${node("user", 830, 80, 70, 80, [{ t: "User" }])}
  </svg>`;
}

/** Agentic systems */
function agent() {
  return `<svg class="path-svg" viewBox="0 0 920 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "user", "M110,120 H150")}
    ${edge("user", "planner", "M220,120 H260")}
    ${edge("planner", "llm", "M360,120 H400")}
    ${edge("llm", "tools", "M500,120 H540")}
    ${edge("tools", "memory", "M640,120 H680")}
    ${edge("memory", "egress", "M780,120 H820")}
    ${edge("tools", "egress", "M640,160 C700,210 800,210 855,160", "path-edge-loop")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("user", 150, 80, 70, 80, [{ t: "User" }])}
    ${node("planner", 260, 80, 100, 80, [{ t: "Planner" }])}
    ${node("llm", 400, 80, 100, 80, [{ t: "LLM" }])}
    ${node("tools", 540, 80, 100, 80, [{ t: "Tools" }, { t: "/ MCP", size: 10 }])}
    ${node("memory", 680, 80, 100, 80, [{ t: "Memory" }])}
    ${node("egress", 820, 80, 80, 80, [{ t: "Egress" }])}
  </svg>`;
}

/** Monitoring / ops feedback */
function monitor() {
  return `<svg class="path-svg" viewBox="0 0 920 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${ARROW}
    ${edge("attacker", "traffic", "M110,120 H150")}
    ${edge("traffic", "detectors", "M250,120 H290")}
    ${edge("detectors", "logs", "M390,120 H430")}
    ${edge("logs", "feedback", "M530,120 H570")}
    ${edge("feedback", "ops", "M670,120 H710")}
    ${edge("ops", "traffic", "M760,160 C760,220 200,220 200,160", "path-edge-loop")}
    ${node("attacker", 30, 80, 80, 80, [{ t: "Attacker" }])}
    ${node("traffic", 150, 80, 100, 80, [{ t: "Traffic" }, { t: "/ prod", size: 10 }])}
    ${node("detectors", 290, 80, 100, 80, [{ t: "Detectors" }])}
    ${node("logs", 430, 80, 100, 80, [{ t: "Logs" }])}
    ${node("feedback", 570, 80, 100, 80, [{ t: "Feedback" }])}
    ${node("ops", 710, 80, 100, 80, [{ t: "Ops" }])}
  </svg>`;
}

export const DIAGRAMS = {
  train,
  finetune,
  supply,
  infer,
  rag,
  agent,
  monitor
};

export function renderDiagram(id) {
  const fn = DIAGRAMS[id] || DIAGRAMS.rag;
  return fn();
}
