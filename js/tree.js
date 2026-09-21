/**
 * OSINT Framework–style collapsible horizontal tree (D3 v7).
 * Folder click = expand/collapse. End-node click = note with Resources.
 * Also: search, crosswalk chips, Stages column view, attack-path animate.
 */

import {
  closeAttackAnimation,
  initAnimationUi,
  isAnimationOpen,
  openAttackAnimation
} from "./animate.js";
import { abbrHtml, abbrHoverTitle, escapeHtml } from "./glossary.js";

const MARGIN = { top: 48, right: 320, bottom: 48, left: 120 };
const NODE_GAP = 38;
const DEPTH_GAP = 240;
const BOX_W = 300;
const BOX_H_MIN = 88;
const BOX_GAP = 20;
const LABEL_PAD = 18;
const COACH_KEY = "ai-ad-map-coach-dismissed";

const TYPE_LABELS = {
  root: "Map",
  stage: "Stage",
  attack: "Attack",
  "attack-info": "Attack",
  "defence-group": "Defences",
  defence: "Defence"
};

const HINTS = {
  start: "Click a blue stage · then a red attack · then Attack or a defence",
  stage: "Pick a red attack to open Attack + Defences",
  attack: "Click Attack for how it works · or Defences for mitigations",
  leaf: "Click the note again or press Esc to close",
  note: "Esc closes · Resources open in a new tab",
  stages: "Pick an attack in a column · note opens on the right"
};

const els = {
  host: document.getElementById("tree-host"),
  stagesHost: document.getElementById("stages-host"),
  stagesColumns: document.getElementById("stages-columns"),
  stageNote: document.getElementById("stage-note"),
  notes: document.getElementById("notes"),
  btnHelp: document.getElementById("btn-help"),
  notesClose: document.getElementById("notes-close"),
  btnFit: document.getElementById("btn-fit"),
  btnReset: document.getElementById("btn-reset"),
  btnViewTree: document.getElementById("btn-view-tree"),
  btnViewStages: document.getElementById("btn-view-stages"),
  breadcrumb: document.getElementById("breadcrumb"),
  statusHint: document.getElementById("status-hint"),
  coach: document.getElementById("coach"),
  coachDismiss: document.getElementById("coach-dismiss"),
  searchInput: document.getElementById("search-input"),
  searchResults: document.getElementById("search-results")
};

let root = null;
let rawData = null;
let svg = null;
let gMain = null;
let gLink = null;
let gNode = null;
let gBoxes = null;
let tree = null;
let zoomBehavior = null;
let openLeafId = null;
let focusNodeId = null;
let idCounter = 0;
let resizeTimer = null;
let viewMode = "tree"; // tree | stages
let searchIndex = [];
let searchActive = 0;
let stageFocusAttack = null; // raw attack object for stages view

function isLeaf(d) {
  return !d.children && !d._children;
}

function isFolder(d) {
  return !!(d.children || d._children);
}

function childCount(d) {
  return (d.children || d._children || []).length;
}

function nodeClass(d) {
  const t = d.data.type || "info";
  return [
    "node",
    `node-${t}`,
    d.data.soon ? "node-soon" : "",
    isLeaf(d) ? "is-leaf" : "",
    isFolder(d) ? "is-folder" : "",
    d.children ? "is-open" : "",
    d.id === openLeafId || d.id === focusNodeId ? "is-selected" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function linkClass(d) {
  const t = d.target.data.type || "";
  if (t === "attack" || t === "attack-info") return "link link-attack";
  if (t === "defence" || t === "defence-group") return "link link-defence";
  return "link";
}

function boxClass(d) {
  const t = d.data.type;
  if (t === "defence") return "node-box-link is-defence";
  if (t === "attack-info" || t === "attack") return "node-box-link is-attack";
  return "node-box-link";
}

function nodeTitle(d) {
  let base;
  if (isLeaf(d)) {
    if (d.data.type === "attack-info") base = "Click to read how this attack works";
    else if (d.data.type === "defence") base = "Click to read this defence";
    else base = "Click to open note";
  } else {
    const n = childCount(d);
    base = d.children ? `Click to collapse (${n} open)` : `Click to expand (${n} inside)`;
  }
  const gloss = abbrHoverTitle(d.data.name || "");
  return gloss ? `${base}\n\n${gloss}` : base;
}

function diagonal(s, t) {
  return `M${s.y},${s.x}C${(s.y + t.y) / 2},${s.x} ${(s.y + t.y) / 2},${t.x} ${t.y},${t.x}`;
}

function closeTextBox() {
  openLeafId = null;
  if (root && viewMode === "tree") update(root);
}

function toggle(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}

function pathTo(d) {
  const chain = [];
  let cur = d;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent;
  }
  return chain;
}

function updateBreadcrumb(d) {
  if (!els.breadcrumb) return;
  const chain = d ? pathTo(d).filter((n) => n.depth > 0 || n.data.type === "root") : [];
  const nodes = chain.length ? chain : root ? [root] : [];
  renderBreadcrumb(
    nodes.map((n) => ({
      name: n.data.name || "Map",
      type: n.data.type || "root"
    }))
  );
}

function renderBreadcrumb(items) {
  if (!els.breadcrumb) return;
  els.breadcrumb.innerHTML = "";
  items.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "›";
      sep.setAttribute("aria-hidden", "true");
      els.breadcrumb.appendChild(sep);
    }
    const crumb = document.createElement("span");
    crumb.className = `crumb is-${item.type || "root"}`;
    crumb.innerHTML = abbrHtml(item.name || "Map");
    els.breadcrumb.appendChild(crumb);
  });
}

function updateHint(d) {
  if (!els.statusHint) return;
  if (viewMode === "stages") {
    els.statusHint.textContent = HINTS.stages;
    return;
  }
  if (openLeafId != null) {
    els.statusHint.textContent = HINTS.note;
    return;
  }
  if (!d || d.data.type === "root") {
    els.statusHint.textContent = HINTS.start;
    return;
  }
  if (d.data.type === "stage") {
    els.statusHint.textContent = HINTS.stage;
    return;
  }
  if (d.data.type === "attack" || d.data.type === "defence-group") {
    els.statusHint.textContent = HINTS.attack;
    return;
  }
  if (isLeaf(d)) {
    els.statusHint.textContent = HINTS.leaf;
    return;
  }
  els.statusHint.textContent = HINTS.start;
}

function noteDataFrom(dOrRaw) {
  // Accept hierarchy node or plain JSON node
  return dOrRaw && dOrRaw.data ? dOrRaw.data : dOrRaw;
}

function attackContext(d) {
  let cur = d;
  while (cur) {
    const data = cur.data || {};
    if (data.owaspUrl || data.atlasUrl || (data.tag && String(data.tag).startsWith("OWASP"))) {
      return {
        owasp: data.owasp || data.tag,
        owaspUrl: data.owaspUrl,
        atlasUrl: data.atlasUrl || "https://atlas.mitre.org/"
      };
    }
    cur = cur.parent;
  }
  const raw = noteDataFrom(d) || {};
  return {
    owasp: raw.owasp || raw.tag,
    owaspUrl: raw.owaspUrl,
    atlasUrl: raw.atlasUrl || "https://atlas.mitre.org/"
  };
}

function extLink({ href, className, html, title }) {
  const a = document.createElement("a");
  a.className = className;
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.innerHTML = html;
  if (title) a.title = title;
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}

function noteSection(label, bodyHtml) {
  const s = document.createElement("div");
  s.className = "box-section";
  s.innerHTML = `<span class="box-label">${label}</span><p class="box-body">${bodyHtml}</p>`;
  return s;
}

function animateButton(label, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

/** Shared note body into an HTMLElement (.box-panel or stage-note). */
function populateNoteElement(el, source, { showCloseHint = true } = {}) {
  const data = noteDataFrom(source);
  const ctx =
    source && source.data
      ? attackContext(source)
      : {
          owasp: data.owasp || data.tag,
          owaspUrl: data.owaspUrl,
          atlasUrl: data.atlasUrl
        };

  el.innerHTML = "";
  el.classList.add("box-panel");

  const kicker = document.createElement("p");
  kicker.className = "box-kicker";
  kicker.textContent = TYPE_LABELS[data.type] || "Note";
  el.appendChild(kicker);

  const chips = document.createElement("div");
  chips.className = "box-chips";
  if (ctx.owasp && ctx.owaspUrl) {
    chips.appendChild(
      extLink({
        href: ctx.owaspUrl,
        className: "box-chip is-owasp",
        html: abbrHtml(ctx.owasp),
        title: abbrHoverTitle(ctx.owasp) || undefined
      })
    );
  }
  if (ctx.atlasUrl) {
    chips.appendChild(
      extLink({
        href: ctx.atlasUrl,
        className: "box-chip is-atlas",
        html: abbrHtml("ATLAS")
      })
    );
  }
  if (chips.childNodes.length) el.appendChild(chips);

  const how = data.detail || data.blurb || "";
  const impact = data.impact || "";
  if (how && impact) {
    el.appendChild(noteSection("How", abbrHtml(how)));
    el.appendChild(noteSection("Impact", abbrHtml(impact)));
  } else {
    const p = document.createElement("p");
    p.className = "box-body";
    p.innerHTML = abbrHtml(how || impact || data.name || "");
    el.appendChild(p);
  }

  const links = Array.isArray(data.links) ? data.links : [];
  if (links.length) {
    const res = document.createElement("div");
    res.className = "box-resources";
    const lab = document.createElement("span");
    lab.className = "box-label";
    lab.textContent = "Resources";
    res.appendChild(lab);
    const ul = document.createElement("ul");
    ul.className = "box-link-list";
    links.forEach((link) => {
      if (!link?.url) return;
      const li = document.createElement("li");
      li.appendChild(
        extLink({
          href: link.url,
          className: "box-link",
          html: `<span class="box-link-kind is-${link.kind || "article"}">${escapeHtml(
            link.kind || "link"
          )}</span><span>${abbrHtml(link.title || link.url)}</span>`
        })
      );
      ul.appendChild(li);
    });
    res.appendChild(ul);
    el.appendChild(res);
  }

  const anim = data.animate;
  const hasSteps = Array.isArray(anim?.steps) && anim.steps.length;
  const hasControls = Array.isArray(anim?.controls) && anim.controls.length;
  if (anim && (hasSteps || hasControls)) {
    const row = document.createElement("div");
    row.className = "btn-animate-row";
    const attackName = source?.parent?.data?.name || anim.title || "Attack";
    if (hasSteps) {
      row.appendChild(
        animateButton("Animate attack", "btn-animate", (e) => {
          e.stopPropagation();
          openAttackAnimation(anim, attackName, "attack");
        })
      );
    }
    if (hasControls) {
      row.appendChild(
        animateButton("Animate defences", "btn-animate is-defence", (e) => {
          e.stopPropagation();
          openAttackAnimation(anim, attackName, "defence");
        })
      );
    }
    el.appendChild(row);
  }

  if (showCloseHint) {
    const hint = document.createElement("p");
    hint.className = "box-close-hint";
    hint.textContent = "Esc closes · click empty canvas to dismiss";
    el.appendChild(hint);
  }
}

function fillNotePanel(panelSel, d) {
  const node = panelSel.node();
  if (!node) return;
  populateNoteElement(node, d, { showCloseHint: true });
}

function onNodeClick(event, d) {
  event.stopPropagation();
  focusNodeId = d.id;
  updateBreadcrumb(d);

  if (isLeaf(d)) {
    openLeafId = openLeafId === d.id ? null : d.id;
    updateHint(d);
    update(d);
    return;
  }

  openLeafId = null;
  updateHint(d);

  if (d.data.type === "stage" && d._children) {
    const parent = d.parent;
    if (parent && parent.children) {
      parent.children.forEach((sib) => {
        if (sib !== d && sib.children) {
          sib._children = sib.children;
          sib.children = null;
        }
      });
    }
  }

  toggle(d);
  update(d);
}

function fitTextBox(fo) {
  const panel = fo.querySelector(".box-panel");
  if (!panel) return BOX_H_MIN;
  fo.setAttribute("height", "1200");
  fo.setAttribute("y", "-600");
  panel.style.height = "auto";
  panel.style.maxHeight = "none";
  const h = Math.max(BOX_H_MIN, Math.ceil(panel.getBoundingClientRect().height) + 4);
  fo.setAttribute("height", String(h));
  fo.setAttribute("y", String(-h / 2));
  return h;
}

function labelExtent(d) {
  const el = gNode
    .selectAll("g.node")
    .filter((n) => n.id === d.id)
    .select("text")
    .node();
  if (el && typeof el.getComputedTextLength === "function") {
    return 14 + el.getComputedTextLength() + LABEL_PAD;
  }
  const name = (d.data && d.data.name) || "";
  return 14 + Math.min(220, name.length * 7.2) + LABEL_PAD;
}

function noteAnchorX(d) {
  const sibs = d.parent && d.parent.children ? d.parent.children : [d];
  let max = labelExtent(d);
  sibs.forEach((s) => {
    max = Math.max(max, labelExtent(s));
  });
  return d.y + max + BOX_GAP;
}

function renderTextBoxes(nodes) {
  const openNode = openLeafId ? nodes.find((n) => n.id === openLeafId) : null;
  const data = openNode ? [openNode] : [];

  const boxLinks = gBoxes.selectAll("path.node-box-link").data(data, (d) => d.id);
  boxLinks
    .enter()
    .append("path")
    .attr("class", boxClass)
    .merge(boxLinks)
    .attr("class", boxClass)
    .attr("d", (d) => `M${d.y},${d.x}L${noteAnchorX(d)},${d.x}`);
  boxLinks.exit().remove();

  const boxes = gBoxes.selectAll("g.node-textbox").data(data, (d) => d.id);
  const boxesEnter = boxes
    .enter()
    .append("g")
    .attr("class", (d) => `node-textbox is-${d.data.type || "info"}`)
    .on("click", (event) => {
      if (event.target.closest("a")) return;
      event.stopPropagation();
      closeTextBox();
      updateHint(null);
    });

  boxesEnter
    .append("foreignObject")
    .attr("width", BOX_W)
    .attr("height", BOX_H_MIN)
    .attr("x", 0)
    .attr("y", -BOX_H_MIN / 2)
    .attr("overflow", "visible")
    .append("xhtml:div")
    .attr("xmlns", "http://www.w3.org/1999/xhtml")
    .attr("class", "box-panel");

  const boxesMerge = boxesEnter.merge(boxes);
  boxesMerge
    .attr("class", (d) => `node-textbox is-${d.data.type || "info"}`)
    .attr("transform", (d) => `translate(${noteAnchorX(d)},${d.x})`);

  boxesMerge.select(".box-panel").each(function (d) {
    fillNotePanel(d3.select(this), d);
  });

  let maxHalf = 0;
  let maxRight = 0;
  boxesMerge.select("foreignObject").each(function (d) {
    maxHalf = Math.max(maxHalf, fitTextBox(this) / 2);
    maxRight = Math.max(maxRight, noteAnchorX(d) + BOX_W - d.y);
  });

  boxes.exit().remove();
  return { half: maxHalf, right: maxRight };
}

function syncBadges(selection) {
  selection.each(function (d) {
    const g = d3.select(this);
    const show = isFolder(d) && !d.children && childCount(d) > 0;
    let badge = g.select("g.badge-group");
    if (!show) {
      badge.remove();
      return;
    }
    if (badge.empty()) {
      badge = g.append("g").attr("class", "badge-group");
      badge.append("rect").attr("class", "node-badge");
      badge.append("text").attr("class", "node-badge-text");
    }
    const label = String(childCount(d));
    const tw = Math.max(14, 6 + label.length * 6);
    badge.attr("transform", "translate(8,-14)");
    badge.select("rect").attr("x", 0).attr("y", -7).attr("rx", 3).attr("ry", 3).attr("width", tw).attr("height", 14);
    badge.select("text").attr("x", tw / 2).attr("y", 3).attr("text-anchor", "middle").text(label);
  });
}

function update(source) {
  if (!root || !tree || viewMode !== "tree") return;

  const nodes = root.descendants().reverse();
  const links = root.links();
  tree(root);
  nodes.forEach((d) => {
    d.y = d.depth * DEPTH_GAP;
  });

  let left = root;
  let right = root;
  root.eachBefore((n) => {
    if (n.x < left.x) left = n;
    if (n.x > right.x) right = n;
  });

  const maxDepth = d3.max(nodes, (d) => d.depth) || 0;
  let width = Math.max(
    els.host.clientWidth || 900,
    (maxDepth + 1) * DEPTH_GAP + MARGIN.left + MARGIN.right
  );

  const node = gNode.selectAll("g.node").data(nodes, (d) => d.id);
  const nodeEnter = node
    .enter()
    .append("g")
    .attr("class", nodeClass)
    .attr("transform", () => `translate(${source.y0},${source.x0})`)
    .on("click", onNodeClick);

  nodeEnter.append("circle").attr("r", 6);
  nodeEnter.append("title").attr("class", "node-title");
  nodeEnter.append("text").attr("dy", "0.32em").attr("x", 14).attr("text-anchor", "start");

  const nodeMerge = nodeEnter.merge(node);
  nodeMerge
    .attr("transform", (d) => `translate(${d.y},${d.x})`)
    .attr("opacity", 1)
    .attr("class", nodeClass);
  nodeMerge.select("circle").attr("r", (d) => (d.data.type === "root" ? 8 : 6));
  nodeMerge.select("title").text(nodeTitle);
  nodeMerge
    .select("text")
    .attr("x", 14)
    .attr("text-anchor", "start")
    .attr("class", (d) => (d.data.soon ? "soon" : null))
    .text((d) => d.data.name + (d.data.soon ? " (soon)" : ""));
  syncBadges(nodeMerge);
  node.exit().remove();

  const link = gLink.selectAll("path.link").data(links, (d) => d.target.id);
  link
    .enter()
    .append("path")
    .attr("class", linkClass)
    .merge(link)
    .attr("class", linkClass)
    .attr("d", (d) => diagonal(d.source, d.target));
  link.exit().remove();

  const boxMetrics = renderTextBoxes(nodes) || { half: 0, right: 0 };
  const boxHalf = boxMetrics.half || 0;
  const height = Math.max(480, right.x - left.x + MARGIN.top + MARGIN.bottom + boxHalf * 2);
  const viewY = left.x - MARGIN.top - boxHalf;
  width = Math.max(
    width,
    (maxDepth + 1) * DEPTH_GAP + MARGIN.left + MARGIN.right + (boxMetrics.right || 0) + 40
  );

  svg
    .attr("viewBox", `${-MARGIN.left} ${viewY} ${width} ${height}`)
    .attr("width", width)
    .attr("height", height);

  nodes.forEach((d) => {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

function clearZoom(animate = true) {
  if (!svg || !zoomBehavior) return;
  svg.transition().duration(animate ? 280 : 0).call(zoomBehavior.transform, d3.zoomIdentity);
}

function fitView() {
  clearZoom();
}

function collapseAll(d) {
  if (d.children) {
    d._children = d.children;
    d._children.forEach(collapseAll);
    d.children = null;
  }
}

function openInitialStage() {
  if (!root || !root.children) return null;
  root.children.forEach(collapseAll);
  const training = root.children.find((c) => c.data.name === "Training");
  const stage = training || root.children[0];
  if (stage && stage._children) {
    stage.children = stage._children;
    stage._children = null;
  }
  return stage || root;
}

function resetToInitial() {
  if (!root) return;
  openLeafId = null;
  stageFocusAttack = null;
  const stage = openInitialStage();
  focusNodeId = stage ? stage.id : null;
  updateBreadcrumb(stage || root);
  updateHint(stage || null);
  if (viewMode === "tree") {
    update(root);
    clearZoom();
  } else {
    renderStagesView();
  }
}

function setHelpOpen(open) {
  els.notes.hidden = !open;
  els.btnHelp.setAttribute("aria-expanded", open ? "true" : "false");
}

function showCoachIfNeeded() {
  try {
    if (localStorage.getItem(COACH_KEY) === "1") {
      els.coach.hidden = true;
      return;
    }
  } catch (_) {
    /* ignore */
  }
  els.coach.hidden = false;
}

function dismissCoach() {
  els.coach.hidden = true;
  try {
    localStorage.setItem(COACH_KEY, "1");
  } catch (_) {
    /* ignore */
  }
}

/* ---------- Search ---------- */

function buildSearchIndex(data) {
  const items = [];

  function walk(node, stageName, attackName) {
    const t = node.type;
    let stage = stageName;
    let attack = attackName;
    if (t === "stage") stage = node.name;
    if (t === "attack") attack = node.name;

    if (t === "attack" || t === "attack-info" || t === "defence") {
      const linkTitles = (node.links || []).map((l) => l.title || "").join(" ");
      const hay = [node.name, node.tag, node.owasp, node.detail, node.impact, linkTitles]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      items.push({
        name: node.name,
        type: t,
        stage,
        attack: attack || node.name,
        tag: node.tag || node.owasp || "",
        hay,
        raw: node
      });
    }
    (node.children || []).forEach((c) => walk(c, stage, attack));
  }

  walk(data, null, null);
  return items;
}

function hideSearchResults() {
  els.searchResults.hidden = true;
  els.searchResults.innerHTML = "";
  searchActive = 0;
}

function renderSearchResults(hits) {
  els.searchResults.innerHTML = "";
  if (!hits.length) {
    hideSearchResults();
    return;
  }
  hits.slice(0, 12).forEach((hit, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-hit" + (i === searchActive ? " is-active" : "");
    btn.setAttribute("role", "option");
    btn.innerHTML = `<span>${abbrHtml(hit.name)}</span><span class="hit-meta">${escapeHtml(
      [hit.stage, hit.type, hit.tag].filter(Boolean).join(" · ")
    )}</span>`;
    btn.addEventListener("click", () => {
      jumpToSearchHit(hit);
      hideSearchResults();
      els.searchInput.value = hit.name;
    });
    li.appendChild(btn);
    els.searchResults.appendChild(li);
  });
  els.searchResults.hidden = false;
}

function findHierarchyNode(pred) {
  if (!root) return null;
  let found = null;
  root.each((n) => {
    if (!found && pred(n)) found = n;
  });
  return found;
}

function expandPathTo(node) {
  // Ensure all ancestors are expanded; accordion stages
  const chain = pathTo(node);
  chain.forEach((n) => {
    if (n._children && !n.children) {
      if (n.data.type === "stage" && n.parent && n.parent.children) {
        n.parent.children.forEach((sib) => {
          if (sib !== n && sib.children) {
            sib._children = sib.children;
            sib.children = null;
          }
        });
      }
      n.children = n._children;
      n._children = null;
    }
  });
}

function jumpToSearchHit(hit) {
  setViewMode("tree");

  if (hit.type === "attack") {
    const stageNode = findHierarchyNode(
      (n) => n.data.type === "stage" && n.data.name === hit.stage
    );
    if (stageNode) {
      expandPathTo(stageNode);
      if (!stageNode.children && stageNode._children) {
        stageNode.children = stageNode._children;
        stageNode._children = null;
      }
    }
    const attackNode = findHierarchyNode(
      (n) => n.data.type === "attack" && n.data.name === hit.name
    );
    if (attackNode) {
      expandPathTo(attackNode);
      if (!attackNode.children && attackNode._children) {
        attackNode.children = attackNode._children;
        attackNode._children = null;
      }
      focusNodeId = attackNode.id;
      openLeafId = null;
      updateBreadcrumb(attackNode);
      updateHint(attackNode);
      update(attackNode);
      clearZoom(false);
      return;
    }
  }

  if (hit.type === "attack-info" || hit.type === "defence") {
    const stageNode = findHierarchyNode(
      (n) => n.data.type === "stage" && n.data.name === hit.stage
    );
    const attackNode = findHierarchyNode(
      (n) => n.data.type === "attack" && n.data.name === hit.attack
    );
    if (stageNode) expandPathTo(stageNode);
    if (attackNode) {
      expandPathTo(attackNode);
      if (!attackNode.children && attackNode._children) {
        attackNode.children = attackNode._children;
        attackNode._children = null;
      }
      // Expand defence-group if needed
      if (hit.type === "defence" && attackNode.children) {
        const dg = attackNode.children.find((c) => c.data.type === "defence-group");
        if (dg && dg._children && !dg.children) {
          dg.children = dg._children;
          dg._children = null;
        }
      }
    }
    update(root);
    const leaf = findHierarchyNode(
      (n) =>
        n.data.type === hit.type &&
        n.data.name === hit.name &&
        (!hit.attack || pathTo(n).some((p) => p.data.name === hit.attack))
    );
    if (leaf) {
      focusNodeId = leaf.id;
      openLeafId = leaf.id;
      updateBreadcrumb(leaf);
      updateHint(leaf);
      update(leaf);
      clearZoom(false);
    }
  }
}

function onSearchInput() {
  const q = els.searchInput.value.trim().toLowerCase();
  if (!q) {
    hideSearchResults();
    return;
  }
  const hits = searchIndex.filter((item) => item.hay.includes(q));
  searchActive = 0;
  renderSearchResults(hits);
}

/* ---------- Stages view ---------- */

function findAttackInfo(attackNode) {
  const kids = attackNode.children || [];
  return kids.find((c) => c.type === "attack-info") || null;
}

function renderStagesView() {
  if (!rawData || !els.stagesColumns) return;
  els.stagesColumns.innerHTML = "";
  const stages = (rawData.children || []).filter((c) => c.type === "stage");

  stages.forEach((stage) => {
    const col = document.createElement("section");
    col.className = "stage-col";
    const head = document.createElement("div");
    head.className = "stage-col-head";
    head.textContent = stage.name;
    col.appendChild(head);
    const list = document.createElement("div");
    list.className = "stage-col-list";
    (stage.children || [])
      .filter((a) => a.type === "attack")
      .forEach((attack) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "stage-attack" + (stageFocusAttack === attack ? " is-active" : "");
        btn.innerHTML = `<span>${abbrHtml(attack.name)}</span>${
          attack.tag
            ? `<span class="att-tag">${abbrHtml(attack.tag)}</span>`
            : ""
        }`;
        btn.addEventListener("click", () => {
          stageFocusAttack = attack;
          const info = findAttackInfo(attack);
          showStageNote(info || attack, attack);
          renderStagesView();
          renderBreadcrumb([
            { name: "AI Attack & Defence", type: "root" },
            { name: stage.name, type: "stage" },
            { name: attack.name, type: "attack" }
          ]);
          updateHint(null);
        });
        list.appendChild(btn);
      });
    col.appendChild(list);
    els.stagesColumns.appendChild(col);
  });

  if (stageFocusAttack) {
    const info = findAttackInfo(stageFocusAttack);
    showStageNote(info || stageFocusAttack, stageFocusAttack);
  } else {
    els.stageNote.hidden = true;
    els.stageNote.innerHTML = "";
  }
}

function showStageNote(leaf, attackFolder) {
  els.stageNote.hidden = false;
  // Synthesize hierarchy-like context for chips
  const fake = {
    data: {
      ...leaf,
      owasp: leaf.owasp || attackFolder.owasp || attackFolder.tag,
      owaspUrl: leaf.owaspUrl || attackFolder.owaspUrl,
      atlasUrl: leaf.atlasUrl || attackFolder.atlasUrl
    },
    parent: { data: attackFolder, parent: null }
  };
  populateNoteElement(els.stageNote, fake, { showCloseHint: false });

  // Defence list under attack note
  const dg = (attackFolder.children || []).find((c) => c.type === "defence-group");
  if (dg && (dg.children || []).length) {
    const wrap = document.createElement("div");
    wrap.className = "box-section";
    wrap.style.marginTop = "1rem";
    const lab = document.createElement("span");
    lab.className = "box-label";
    lab.textContent = "Defences";
    wrap.appendChild(lab);
    (dg.children || []).forEach((def) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stage-attack";
      btn.style.borderLeftColor = "#3fb950";
      btn.innerHTML = abbrHtml(def.name);
      const tip = abbrHoverTitle(def.name);
      if (tip) btn.title = tip;
      btn.addEventListener("click", () => {
        const fakeDef = {
          data: {
            ...def,
            owasp: attackFolder.owasp || attackFolder.tag,
            owaspUrl: attackFolder.owaspUrl,
            atlasUrl: attackFolder.atlasUrl
          },
          parent: { data: attackFolder }
        };
        populateNoteElement(els.stageNote, fakeDef, { showCloseHint: false });
        // re-append defence switcher? keep simple — show only this defence; back via attack click
      });
      wrap.appendChild(btn);
    });
    els.stageNote.appendChild(wrap);
  }
}

function setViewMode(mode) {
  viewMode = mode;
  const isTree = mode === "tree";
  els.host.hidden = !isTree;
  els.stagesHost.hidden = isTree;
  els.btnViewTree.classList.toggle("is-active", isTree);
  els.btnViewStages.classList.toggle("is-active", !isTree);
  els.btnViewTree.setAttribute("aria-pressed", isTree ? "true" : "false");
  els.btnViewStages.setAttribute("aria-pressed", isTree ? "false" : "true");
  els.btnFit.hidden = !isTree;
  if (isTree) {
    if (root) update(root);
    updateHint(null);
  } else {
    openLeafId = null;
    renderStagesView();
    updateHint(null);
  }
}

function initTree(data) {
  rawData = data;
  searchIndex = buildSearchIndex(data);
  els.host.innerHTML = "";
  openLeafId = null;
  focusNodeId = null;

  const hostW = els.host.clientWidth || 900;
  const hostH = els.host.clientHeight || 600;

  svg = d3
    .select(els.host)
    .append("svg")
    .attr("class", "tree-svg")
    .attr("width", hostW)
    .attr("height", hostH);

  gMain = svg.append("g");
  gLink = gMain.append("g").attr("class", "links");
  gNode = gMain.append("g").attr("class", "nodes");
  gBoxes = gMain.append("g").attr("class", "boxes");

  tree = d3.tree().nodeSize([NODE_GAP, DEPTH_GAP]);

  root = d3.hierarchy(data);
  root.x0 = hostH / 2;
  root.y0 = 0;
  root.descendants().forEach((d) => {
    d.id = ++idCounter;
  });

  const stage = openInitialStage();
  if (stage) {
    focusNodeId = stage.id;
    updateBreadcrumb(stage);
    updateHint(stage);
  } else {
    updateBreadcrumb(root);
    updateHint(null);
  }

  update(root);

  zoomBehavior = d3
    .zoom()
    .scaleExtent([0.35, 2.75])
    .filter((event) => {
      if (event.type === "mousedown" || event.type === "touchstart") {
        const t = event.target;
        if (t.closest && (t.closest("g.node") || t.closest("g.node-textbox"))) {
          return false;
        }
      }
      return !event.ctrlKey || event.type === "wheel";
    })
    .on("zoom", (event) => {
      gMain.attr("transform", event.transform);
    });

  svg.call(zoomBehavior);
  clearZoom(false);

  svg.on("click", () => {
    if (openLeafId != null) {
      closeTextBox();
      updateHint(null);
    }
  });
}

async function bootstrap() {
  showCoachIfNeeded();
  initAnimationUi();
  els.coachDismiss.addEventListener("click", dismissCoach);
  els.btnHelp.addEventListener("click", () => setHelpOpen(els.notes.hidden));
  els.notesClose.addEventListener("click", () => setHelpOpen(false));
  els.btnFit.addEventListener("click", () => fitView());
  els.btnReset.addEventListener("click", () => resetToInitial());
  els.btnViewTree.addEventListener("click", () => setViewMode("tree"));
  els.btnViewStages.addEventListener("click", () => setViewMode("stages"));

  els.searchInput.addEventListener("input", onSearchInput);
  els.searchInput.addEventListener("keydown", (e) => {
    const items = [...els.searchResults.querySelectorAll(".search-hit")];
    if (e.key === "Escape") {
      hideSearchResults();
      els.searchInput.blur();
      return;
    }
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      searchActive = Math.min(items.length - 1, searchActive + 1);
      items.forEach((el, i) => el.classList.toggle("is-active", i === searchActive));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      searchActive = Math.max(0, searchActive - 1);
      items.forEach((el, i) => el.classList.toggle("is-active", i === searchActive));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[searchActive]?.click();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) hideSearchResults();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (isAnimationOpen()) {
        closeAttackAnimation();
        return;
      }
      closeTextBox();
      setHelpOpen(false);
      hideSearchResults();
      updateHint(null);
    }
    if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (viewMode === "tree") fitView();
    }
    if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !e.altKey) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }
  });

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (root && viewMode === "tree") update(root);
    }, 150);
  });

  try {
    const res = await fetch("data/tree.json");
    if (!res.ok) throw new Error("tree.json missing");
    initTree(await res.json());
  } catch (err) {
    console.error(err);
    els.host.innerHTML =
      '<p style="padding:2rem;color:#8b949e">Serve over HTTP: <code>python3 -m http.server 8080</code></p>';
  }
}

bootstrap();
