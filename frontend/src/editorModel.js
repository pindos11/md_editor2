import { marked } from "marked";

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;
const RELATION_FIELD_PATTERN = /(relation|relations|related|link|links)$/i;

export function flattenFiles(nodes) {
  const files = [];
  for (const node of nodes) {
    if (node.node_type === "file") {
      files.push(node);
    }
    if (node.children?.length) {
      files.push(...flattenFiles(node.children));
    }
  }
  return files;
}

export function buildAliasMap(tree) {
  const map = new Map();
  for (const node of flattenFiles(tree)) {
    const keys = [node.path, node.name, node.name.replace(/\.md$/i, ""), node.path.replace(/\.md$/i, "")]
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    for (const key of keys) {
      if (!map.has(key)) {
        map.set(key, node.path);
      }
    }
  }
  return map;
}

export function pathExists(nodes, expectedPath) {
  return nodes.some((node) => node.path === expectedPath || pathExists(node.children || [], expectedPath));
}

export function renderPreview(content) {
  const { body } = parseFrontmatter(content);
  const withWikiLinks = body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, rawTarget, rawLabel) => {
    const target = encodeURIComponent(rawTarget.trim());
    const label = (rawLabel || rawTarget).trim();
    return `[${label}](wikilink:${target})`;
  });
  const html = marked.parse(withWikiLinks || "");
  return html.replace(/href="wikilink:([^"]+)"/g, 'href="#" data-wikilink="$1"');
}

export function parseBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let cursor = 0;
  let start = 0;

  function pushBlock(endExclusive) {
    const raw = lines.slice(start, endExclusive).join("\n");
    const trimmed = raw.trim();
    if (!trimmed) {
      start = endExclusive;
      return;
    }
    const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
    blocks.push({
      id: `${start}-${endExclusive}`,
      startLine: start,
      endLine: endExclusive - 1,
      startOffset: cursorForLine(lines, start),
      endOffset: cursorForLine(lines, endExclusive),
      text: raw,
      title: match ? match[2] : trimmed.split("\n")[0],
      type: match ? "heading" : inferBlockType(trimmed),
      level: match ? match[1].length : null
    });
    start = endExclusive;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const isSeparator = lines[index].trim() === "";
    if (isSeparator) {
      pushBlock(index);
      start = index + 1;
    }
  }
  pushBlock(lines.length);
  if (!blocks.length && content.trim()) {
    blocks.push({
      id: "0-0",
      startLine: 0,
      endLine: lines.length - 1,
      startOffset: 0,
      endOffset: content.length,
      text: content,
      title: content.split("\n")[0],
      type: inferBlockType(content.trim()),
      level: null
    });
  }
  return blocks;
}

function inferBlockType(trimmed) {
  if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
    return "todo";
  }
  if (trimmed.startsWith(">")) {
    return "quote";
  }
  if (trimmed.startsWith("```")) {
    return "code";
  }
  if (trimmed.startsWith("|")) {
    return "table";
  }
  return "text";
}

function cursorForLine(lines, lineNumber) {
  let total = 0;
  for (let index = 0; index < lineNumber; index += 1) {
    total += lines[index].length + 1;
  }
  return total;
}

export function moveBlock(content, blocks, blockIndex, direction) {
  const targetIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;
  if (targetIndex < 0 || targetIndex >= blocks.length) {
    return content;
  }
  const reordered = [...blocks];
  const [moved] = reordered.splice(blockIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  return reordered.map((block) => block.text.trimEnd()).join("\n\n");
}

export function buildVisibleContent(content, collapsedHeadings) {
  const blocks = parseBlocks(content);
  const visibleBlocks = [];
  let activeCollapsedLevel = null;

  for (const block of blocks) {
    if (block.type === "heading") {
      if (activeCollapsedLevel !== null && block.level <= activeCollapsedLevel) {
        activeCollapsedLevel = null;
      }
      visibleBlocks.push(block.text.trimEnd());
      if (collapsedHeadings.has(block.startOffset)) {
        activeCollapsedLevel = block.level;
      }
      continue;
    }
    if (activeCollapsedLevel === null) {
      visibleBlocks.push(block.text.trimEnd());
    }
  }

  return visibleBlocks.join("\n\n");
}

export function getWikiAutocomplete(content, cursorPosition, tree) {
  const beforeCursor = content.slice(0, cursorPosition);
  const match = beforeCursor.match(/\[\[([^\]]*)$/);
  if (!match) {
    return { open: false, query: "", items: [] };
  }
  const query = match[1].toLowerCase();
  const items = flattenFiles(tree)
    .filter((node) => node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query))
    .slice(0, 6)
    .map((node) => ({
      id: node.path,
      label: node.name.replace(/\.md$/i, ""),
      path: node.path
    }));
  return {
    open: items.length > 0,
    query,
    items,
    rangeStart: beforeCursor.lastIndexOf("[[") + 2,
    rangeEnd: cursorPosition
  };
}

export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const rawFrontmatter = match[1];
  const body = content.slice(match[0].length);
  const frontmatter = {};
  let currentKey = null;
  for (const rawLine of rawFrontmatter.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }
    if (line.trimStart().startsWith("- ") && currentKey) {
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      frontmatter[currentKey].push(line.trimStart().slice(2).trim());
      continue;
    }
    if (!line.includes(":")) {
      currentKey = null;
      continue;
    }
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim();
    const value = rest.join(":").trim();
    currentKey = key;
    frontmatter[key] = value ? value : [];
  }
  return { frontmatter, body };
}

export function isRelationField(key) {
  return RELATION_FIELD_PATTERN.test(key);
}

export function normalizeRelationItems(rawValue) {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\[\[|\]\]$/g, "").trim())
    .filter(Boolean);
}

export function getRelationItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return normalizeRelationItems(value);
  }
  return [];
}

export function updateFrontmatter(content, key, rawValue) {
  const { frontmatter, body } = parseFrontmatter(content);
  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    delete frontmatter[key];
  } else if (key === "tags") {
    frontmatter[key] = normalizedValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (isRelationField(key)) {
    frontmatter[key] = normalizeRelationItems(normalizedValue);
  } else {
    frontmatter[key] = normalizedValue;
  }

  const entries = Object.entries(frontmatter);
  if (!entries.length) {
    return body.trimStart();
  }

  const frontmatterLines = entries.flatMap(([entryKey, value]) => {
    if (Array.isArray(value)) {
      if (!value.length) {
        return [`${entryKey}:`];
      }
      return [`${entryKey}:`, ...value.map((item) => `  - ${item}`)];
    }
    return [`${entryKey}: ${value}`];
  });

  return `---\n${frontmatterLines.join("\n")}\n---\n${body.replace(/^\n*/, "")}`;
}
