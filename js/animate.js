/**
 * Shared AI-stack path animation for attack notes.
 * Modes: attack (red path) | defence (green controls on components).
 * Multiple items on the same component = one beat with bullet captions.
 * Diagrams switch per stage via animate.diagram (see diagrams.js).
 */

import { renderDiagram } from "./diagrams.js";
import { abbrHtml, abbrHoverTitle, escapeHtml } from "./glossary.js";

const STEP_MS = 1400;
const NODE_CLASSES = ["is-active", "is-done", "is-secure", "is-secure-active"];
const EDGE_CLASSES = ["is-active", "is-done", "is-blocked"];

const ELS_IDS = {
  overlay: "path-overlay",
  title: "path-title",
  kicker: "path-kicker",
  caption: "path-caption",
  progress: "path-progress",
  btnPlay: "path-play",
  btnReplay: "path-replay",
  btnModeAttack: "path-mode-attack",
  btnModeDefence: "path-mode-defence",
  hint: "path-hint",
  svgHost: "path-svg-host"
};

const els = Object.fromEntries([...Object.keys(ELS_IDS), "svg", "dialog"].map((k) => [k, null]));

let animateData = null;
let mode = "attack";
let beats = [];
let beatIndex = -1;
let timer = null;
let playing = false;
let wiredSvgClicks = false;

function ensureEls() {
  if (els.overlay) return;
  for (const [key, id] of Object.entries(ELS_IDS)) {
    els[key] = document.getElementById(id);
  }
  els.dialog = document.querySelector(".path-dialog");
}

function clearTimer() {
  if (timer == null) return;
  clearTimeout(timer);
  timer = null;
}

function mountDiagram(diagramId) {
  ensureEls();
  if (!els.svgHost) return;
  els.svgHost.innerHTML = renderDiagram(diagramId || "rag");
  els.svg = els.svgHost.querySelector("svg");
  annotateDiagramAbbrs(els.svg);
  if (wiredSvgClicks) return;
  els.svgHost.addEventListener("click", (e) => {
    const node = e.target.closest?.(".path-node");
    if (!node || !els.svgHost.contains(node)) return;
    selectComponent(node.getAttribute("data-id"));
  });
  wiredSvgClicks = true;
}

function groupByComponent(raw) {
  const out = [];
  for (const item of raw || []) {
    if (!item?.id) continue;
    const last = out[out.length - 1];
    if (last && last.id === item.id) last.items.push(item);
    else out.push({ id: item.id, items: [item] });
  }
  return out;
}

function currentRaw() {
  if (!animateData) return [];
  return mode === "defence" ? animateData.controls || [] : animateData.steps || [];
}

function setPlaying(on) {
  playing = on;
  if (els.btnPlay) els.btnPlay.textContent = on ? "Pause" : "Play";
}

function nodeEls(id) {
  const node = els.svg?.querySelector(`.path-node[data-id="${id}"]`);
  return { node, comp: node?.querySelector(".path-comp") };
}

function resetVisuals() {
  if (!els.svg) return;
  els.svg.querySelectorAll(".path-node, .path-comp").forEach((n) => {
    n.classList.remove(...NODE_CLASSES);
  });
  els.svg.querySelectorAll(".path-edge").forEach((e) => {
    e.classList.remove(...EDGE_CLASSES);
  });
  els.svg.querySelectorAll(".path-shield").forEach((s) => s.remove());
}

function edgeBetween(a, b) {
  return els.svg?.querySelector(`.path-edge[data-from="${a}"][data-to="${b}"]`) || null;
}

function placeShield(nodeEl) {
  if (!nodeEl || nodeEl.querySelector(".path-shield")) return;
  const rect = nodeEl.querySelector(".path-comp");
  if (!rect) return;
  const w = Number(rect.getAttribute("width") || 80);
  const shield = document.createElementNS("http://www.w3.org/2000/svg", "g");
  shield.setAttribute("class", "path-shield");
  shield.innerHTML = `
    <circle cx="${w - 10}" cy="12" r="11" class="path-shield-disc"/>
    <path class="path-shield-mark" d="M${w - 10},5 l5,3 v5 c0,4 -5,7 -5,7 s-5,-3 -5,-7 v-5 z"/>
  `;
  nodeEl.appendChild(shield);
}

function annotateDiagramAbbrs(svg) {
  if (!svg) return;
  svg.querySelectorAll(".path-node").forEach((n) => {
    const labels = [...n.querySelectorAll(".path-comp-label")]
      .map((t) => t.textContent || "")
      .join(" ");
    const tip = abbrHoverTitle(labels) || abbrHoverTitle(n.getAttribute("data-id") || "");
    if (!tip) return;
    let title = n.querySelector("title.path-abbr");
    if (!title) {
      title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.setAttribute("class", "path-abbr");
      n.insertBefore(title, n.firstChild);
    }
    title.textContent = tip;
  });
}

function formatItemLine(it, preferName) {
  if (preferName && it.name) {
    return `<strong>${abbrHtml(it.name)}</strong> — ${abbrHtml(it.label || "")}`;
  }
  const title = it.name || it.id;
  const detail = it.label || "";
  if (title && detail && title !== detail) {
    return `<strong>${abbrHtml(title)}</strong> — ${abbrHtml(detail)}`;
  }
  return abbrHtml(detail || title || "");
}

function formatCaptionBody(items, { preferName = false } = {}) {
  if (!items.length) return "";
  if (items.length === 1) return formatItemLine(items[0], preferName);
  return `<ul class="path-caption-list">${items
    .map((it) => `<li>${formatItemLine(it, preferName)}</li>`)
    .join("")}</ul>`;
}

function setCaption(step, body = "") {
  els.caption.innerHTML = `<span class="path-caption-step">${step}</span>${body}`;
}

function setProgress(current) {
  els.progress.textContent = `${current} / ${beats.length}`;
}

function paintNode(id, { past, defence }) {
  const { node, comp } = nodeEls(id);
  const cls = defence
    ? past
      ? "is-secure"
      : "is-secure-active"
    : past
      ? "is-done"
      : "is-active";
  node?.classList.add(cls);
  comp?.classList.add(cls);
  if (defence) placeShield(node);
}

function applyBlockEdges(throughIndex) {
  const secured = new Set(beats.slice(0, throughIndex + 1).map((b) => b.id));
  for (const spec of animateData?.blockEdges || []) {
    const when = spec.when || spec.to;
    if (when && secured.has(when)) edgeBetween(spec.from, spec.to)?.classList.add("is-blocked");
  }
}

function applyBeat(index) {
  resetVisuals();
  const defence = mode === "defence";
  const label = defence ? "Defence" : "Attack";

  if (index < 0 || !beats.length) {
    setCaption(
      `${defence ? "Defences" : "Attack"} · ready`,
      defence
        ? "Press Play, or click a component to see its controls."
        : "Press Play, or click a component to inspect that step."
    );
    setProgress(0);
    if (defence) applyBlockEdges(-1);
    return;
  }

  for (let i = 0; i <= index; i++) {
    paintNode(beats[i].id, { past: i < index, defence });
    if (!defence && i > 0) {
      const edge = edgeBetween(beats[i - 1].id, beats[i].id);
      edge?.classList.add(i < index ? "is-done" : "is-active");
    }
  }
  if (defence) applyBlockEdges(index);

  const beat = beats[index];
  const n = beat.items.length;
  const plural = defence ? "controls" : "events";
  setCaption(
    `${label} · ${index + 1} / ${beats.length} · ${escapeHtml(beat.id)}${
      n > 1 ? ` · ${n} ${plural}` : ""
    }`,
    formatCaptionBody(beat.items, { preferName: defence })
  );
  setProgress(index + 1);
}

function selectComponent(id) {
  if (!id || !animateData) return;
  clearTimer();
  setPlaying(false);
  syncModeUi();

  const index = beats.findIndex((b) => b.id === id);
  if (index < 0) {
    beatIndex = -1;
    resetVisuals();
    paintNode(id, { past: false, defence: mode === "defence" });
    setCaption(
      `${mode === "defence" ? "Defence" : "Attack"} · ${escapeHtml(id)}`,
      `No ${mode === "defence" ? "controls" : "attacks"} on this component for this scenario.`
    );
    els.progress.textContent = `— / ${beats.length}`;
    return;
  }

  beatIndex = index;
  applyBeat(beatIndex);
}

function markInteractiveNodes() {
  if (!els.svg) return;
  const withContent = new Set(beats.map((b) => b.id));
  els.svg.querySelectorAll(".path-node").forEach((n) => {
    n.classList.add("is-clickable");
    n.classList.toggle("has-content", withContent.has(n.getAttribute("data-id")));
  });
}

function scheduleNext() {
  clearTimer();
  if (!playing) return;
  if (beatIndex >= beats.length - 1) {
    setPlaying(false);
    syncModeUi();
    return;
  }
  timer = setTimeout(() => {
    beatIndex += 1;
    applyBeat(beatIndex);
    scheduleNext();
  }, STEP_MS);
}

function syncModeUi() {
  const hasControls = !!(animateData?.controls?.length);
  els.dialog?.classList.toggle("is-defence-mode", mode === "defence");
  els.dialog?.classList.toggle("is-attack-mode", mode === "attack");

  if (els.kicker) {
    els.kicker.textContent = mode === "defence" ? "Security controls" : "Attack path";
  }
  els.btnModeAttack?.classList.toggle("is-active", mode === "attack");
  els.btnModeDefence?.classList.toggle("is-active", mode === "defence");
  if (els.btnModeDefence) {
    els.btnModeDefence.disabled = !hasControls;
    els.btnModeDefence.hidden = !hasControls;
  }
  els.btnPlay?.classList.toggle("is-defence", mode === "defence");
  if (els.hint) {
    els.hint.textContent =
      mode === "defence"
        ? "Click a component · green = control"
        : "Click a component · red = attack path";
  }
  setPlaying(playing);
  markInteractiveNodes();
}

function loadMode(nextMode) {
  clearTimer();
  setPlaying(false);
  mode = nextMode;
  beats = groupByComponent(currentRaw());
  beatIndex = -1;
  syncModeUi();
  applyBeat(-1);
}

function beginPlayback(startIndex) {
  if (!beats.length) return;
  clearTimer();
  beatIndex = startIndex;
  setPlaying(true);
  syncModeUi();
  applyBeat(beatIndex);
  scheduleNext();
}

function startPlay() {
  if (!beats.length) return;
  if (playing) {
    setPlaying(false);
    clearTimer();
    syncModeUi();
    return;
  }
  if (beatIndex < 0 || beatIndex >= beats.length - 1) {
    beginPlayback(0);
    return;
  }
  setPlaying(true);
  syncModeUi();
  scheduleNext();
}

function startReplay() {
  beginPlayback(0);
}

export function openAttackAnimation(animate, attackName, startMode = "attack") {
  ensureEls();
  if (!els.overlay || !animate) return;
  const hasSteps = Array.isArray(animate.steps) && animate.steps.length;
  const hasControls = Array.isArray(animate.controls) && animate.controls.length;
  if (!hasSteps && !hasControls) return;

  animateData = animate;
  clearTimer();
  setPlaying(false);
  els.title.innerHTML = abbrHtml(animate.title || attackName || "Attack path");
  mountDiagram(animate.diagram || "rag");

  const initial =
    startMode === "defence" && hasControls ? "defence" : hasSteps ? "attack" : "defence";
  loadMode(initial);

  els.overlay.hidden = false;
  els.btnPlay?.focus();
}

export function closeAttackAnimation() {
  ensureEls();
  clearTimer();
  setPlaying(false);
  beatIndex = -1;
  beats = [];
  animateData = null;
  mode = "attack";
  if (els.overlay) els.overlay.hidden = true;
  resetVisuals();
  syncModeUi();
}

export function isAnimationOpen() {
  ensureEls();
  return !!(els.overlay && !els.overlay.hidden);
}

export function initAnimationUi() {
  ensureEls();
  if (!els.overlay) return;

  els.btnPlay?.addEventListener("click", startPlay);
  els.btnReplay?.addEventListener("click", startReplay);
  els.btnModeAttack?.addEventListener("click", () => loadMode("attack"));
  els.btnModeDefence?.addEventListener("click", () => {
    if (animateData?.controls?.length) loadMode("defence");
  });
  document.getElementById("path-close")?.addEventListener("click", closeAttackAnimation);
  els.overlay.addEventListener("click", (e) => {
    if (e.target === els.overlay) closeAttackAnimation();
  });
}
