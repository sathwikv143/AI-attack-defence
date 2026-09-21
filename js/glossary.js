/**
 * Shortform → full form for hover tooltips across notes, captions, and labels.
 * Longer keys first so compounds (RLHF/DPO, DP-SGD) win over fragments.
 */

const ENTRIES = [
  ["REDUCE/GLOBAL", "Pickle opcodes that can run attacker code on load"],
  ["RLHF/DPO", "Reinforcement Learning from Human Feedback / Direct Preference Optimization"],
  ["DPO/RLHF", "Direct Preference Optimization / Reinforcement Learning from Human Feedback"],
  ["DP-SGD", "Differentially Private Stochastic Gradient Descent"],
  ["ML-BOM", "Machine Learning Bill of Materials"],
  ["CI/CD", "Continuous Integration / Continuous Delivery"],
  ["OWASP", "Open Worldwide Application Security Project"],
  ["ATLAS", "Adversarial Threat Landscape for Artificial-Intelligence Systems (MITRE)"],
  ["MITRE", "MITRE Corporation (maintains ATT&CK / ATLAS)"],
  ["OSINT", "Open-Source Intelligence"],
  ["RLHF", "Reinforcement Learning from Human Feedback"],
  ["DPO", "Direct Preference Optimization"],
  ["SFT", "Supervised Fine-Tuning"],
  ["LoRA", "Low-Rank Adaptation"],
  ["PEFT", "Parameter-Efficient Fine-Tuning"],
  ["RAG", "Retrieval-Augmented Generation"],
  ["MCP", "Model Context Protocol"],
  ["LLM", "Large Language Model"],
  ["PII", "Personally Identifiable Information"],
  ["API", "Application Programming Interface"],
  ["DLP", "Data Loss Prevention"],
  ["SBOM", "Software Bill of Materials"],
  ["RCE", "Remote Code Execution"],
  ["XSS", "Cross-Site Scripting"],
  ["SQLi", "SQL Injection"],
  ["SQL", "Structured Query Language"],
  ["HTML", "HyperText Markup Language"],
  ["JSON", "JavaScript Object Notation"],
  ["IAM", "Identity and Access Management"],
  ["TTL", "Time To Live"],
  ["ACL", "Access Control List"],
  ["SLO", "Service Level Objective"],
  ["NFS", "Network File System"],
  ["MMR", "Maximal Marginal Relevance"],
  ["OOD", "Out-Of-Distribution"],
  ["CUDA", "Compute Unified Device Architecture (NVIDIA)"],
  ["ONNX", "Open Neural Network Exchange"],
  ["CDN", "Content Delivery Network"],
  ["CVE", "Common Vulnerabilities and Exposures"],
  ["SOC", "Security Operations Center"],
  ["GPU", "Graphics Processing Unit"],
  ["VM", "Virtual Machine"],
  ["DoS", "Denial of Service"],
  ["SHA", "Secure Hash Algorithm"],
  ["PyPI", "Python Package Index"],
  ["PyTorch", "PyTorch deep-learning framework"],
  ["TensorRT", "NVIDIA TensorRT inference optimizer"],
  ["safetensors", "SafeTensors — tensor format without pickle execution"],
  ["torch.load", "PyTorch API that deserializes a saved tensor / checkpoint"],
  ["weights_only", "torch.load flag that refuses arbitrary pickle objects"],
  ["state_dict", "PyTorch mapping of parameter names to tensors"],
  ["Hugging Face", "Hugging Face (model hub / transformers)"],
  ["pip", "pip — Python package installer"],
  ["conda", "conda — package and environment manager"],
  ["REDUCE", "Pickle REDUCE opcode (can invoke callables on load)"],
  ["GLOBAL", "Pickle GLOBAL opcode (imports a module attribute)"],
  ["SEO", "Search Engine Optimization"],
  ["IP", "Intellectual Property"],
  ["RL", "Reinforcement Learning"],
  ["RM-only", "Reward-Model-only (optimize for the RM score alone)"],
  ["RM", "Reward Model"],
  ["HF", "Hugging Face"],
  ["DP", "Differential Privacy"],
  ["ML", "Machine Learning"],
  ["FT", "Fine-Tuning"],
  ["IR", "Incident Response"],
  ["DB", "Database"],
  ["UI", "User Interface"],
  ["CI", "Continuous Integration"],
  ["AI", "Artificial Intelligence"],
  ["ID", "Identifier"]
];

/** Plural / possessive endings we still treat as the same shortform. */
const PLURAL_OK = new Set([
  "LLM",
  "API",
  "ACL",
  "VM",
  "GPU",
  "CVE",
  "ID",
  "DB"
]);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PATTERN = new RegExp(
  "\\b(" + ENTRIES.map(([k]) => escapeRegex(k)).join("|") + ")(s)?\\b",
  "g"
);

const LOOKUP = new Map(ENTRIES);
const LOOKUP_CI = new Map(ENTRIES.map(([k, v]) => [k.toLowerCase(), [k, v]]));

function resolveEntry(term) {
  if (LOOKUP.has(term)) return [term, LOOKUP.get(term)];
  return LOOKUP_CI.get(term.toLowerCase()) || null;
}

/**
 * Escape text and wrap known shortforms in <abbr title="…">.
 */
export function abbrHtml(text) {
  if (text == null || text === "") return "";
  const escaped = escapeHtml(text);
  return escaped.replace(PATTERN, (match, term, plural) => {
    const hit = resolveEntry(term);
    if (!hit) return match;
    const [canon, full] = hit;
    if (plural && canon.length <= 2 && !PLURAL_OK.has(canon)) return match;
    const shown = plural ? term + plural : term;
    return `<abbr class="gloss" title="${escapeHtml(full)}">${shown}</abbr>`;
  });
}

/**
 * Plain-text title listing expansions found in a string (for SVG title= / hover).
 */
export function abbrHoverTitle(text) {
  if (!text) return "";
  const found = [];
  const seen = new Set();
  String(text).replace(PATTERN, (match, term) => {
    const hit = resolveEntry(term);
    if (!hit) return match;
    const [canon, full] = hit;
    if (seen.has(canon)) return match;
    seen.add(canon);
    found.push(`${canon}: ${full}`);
    return match;
  });
  return found.join("\n");
}

export { escapeHtml };
