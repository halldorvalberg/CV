#!/usr/bin/env node

/**
 * Minimal Markdown -> PDF generator
 *
 * Quick start
 * 1) Install
 *    npm init -y
 *    npm i pdfmake
 *
 * 2) Add fonts (required by pdfmake). Create ./fonts and add TTF files (example names):
 *    fonts/Roboto-Regular.ttf
 *    fonts/Roboto-Italic.ttf
 *    fonts/Roboto-Bold.ttf
 *    fonts/RobotoMono-Regular.ttf
 *
 * 3) Run
 *    node genpdf.js input.md output.pdf
 *
 *    or read from stdin / write to output:
 *    cat input.md | node genpdf.js - output.pdf
 *
 * Notes
 * - Single runtime dependency: pdfmake
 * - Two A4 pages target with auto font-size tuning
 * - Basic Markdown coverage: headings, lists, bold/italic, code, links, blockquotes
 */

const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

// ---------- CLI I/O and metadata flags ----------
const args = process.argv.slice(2);
const inPath = args[0];
const outPath = args[1];

if (!inPath || !outPath) {
  console.error('Usage: node genpdf.js <input.md | -> <output.pdf> [--txt] [--title=] [--author=] [--subject=] [--keywords=] [--h1=] [--h2=] [--h3=] [--h1d=] [--h2d=] [--h3d=]');
  process.exit(1);
}

// defaults; allow simple overrides via --title= --author= --subject= --keywords=
const meta = {
  title: 'Halldor Valberg - CV',
  author: 'Halldor Valberg',
  subject: 'Full-stack Developer CV',
  keywords: 'Full-stack; .NET; Angular; TypeScript; PostgreSQL; Next.js; Iceland'
};

const wantTxt = args.includes('--txt');

for (const a of args.slice(2)) {
  if (a.startsWith('--title=')) meta.title = a.split('=')[1];
  if (a.startsWith('--author=')) meta.author = a.split('=')[1];
  if (a.startsWith('--subject=')) meta.subject = a.split('=')[1];
  if (a.startsWith('--keywords=')) meta.keywords = a.split('=')[1];
}

// ---------- CLI knobs for headings ----------
function getNumFlag(name) {
  const f = args.find(a => a.startsWith(name + '='));
  return f ? Number(f.split('=')[1]) : undefined;
}
// Absolute overrides (take precedence if set)
const H1_ABS = getNumFlag('--h1');   // e.g. --h1=14
const H2_ABS = getNumFlag('--h2');   // e.g. --h2=13
const H3_ABS = getNumFlag('--h3');   // e.g. --h3=12
// Relative deltas (fallback if absolutes not provided)
const H1_D  = getNumFlag('--h1d') ?? 2;  // default +2pt over body
const H2_D  = getNumFlag('--h2d') ?? 1.5;
const H3_D  = getNumFlag('--h3d') ?? 1;

const readMarkdown = () =>
  inPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(inPath, 'utf8');

// ---------- Fonts ----------
const fonts = {
  Roboto: {
    normal: path.resolve(__dirname, 'fonts/Roboto-Regular.ttf'),
    bold: path.resolve(__dirname, 'fonts/Roboto-Bold.ttf'),
    italics: path.resolve(__dirname, 'fonts/Roboto-Italic.ttf'),
    // If you have Roboto-BoldItalic.ttf, use it for proper bold+italic rendering.
    bolditalics: path.resolve(__dirname, 'fonts/Roboto-BoldItalic.ttf'),
  },
  Mono: {
    normal: path.resolve(__dirname, 'fonts/RobotoMono-Regular.ttf'),
    bold: path.resolve(__dirname, 'fonts/RobotoMono-Regular.ttf'),
    italics: path.resolve(__dirname, 'fonts/RobotoMono-Regular.ttf'),
    bolditalics: path.resolve(__dirname, 'fonts/RobotoMono-Regular.ttf'),
  }
};

for (const family of Object.values(fonts)) {
  for (const key of Object.keys(family)) {
    if (!fs.existsSync(family[key])) {
      console.error(`Missing font file: ${family[key]}`);
      console.error('Add TTF fonts under ./fonts. See README in the script header.');
      process.exit(1);
    }
  }
}

const printer = new PdfPrinter(fonts);

// ---------- Tiny Markdown Parser -> pdfmake content ----------
function mdInline(text) {
  // decode entities so &nbsp; becomes a non-breaking space here too
  text = decodeEntities(String(text));
  // Escape pdfmake text can be raw. Apply inline transforms carefully.
  // Links [text](url)
  const parts = [];
  let remaining = text;

  // Helper to push styled fragments
  const pushStyled = (t, style = {}) => parts.push({ text: t, ...style });

  // Simple tokenizer for links
  // Links [text](url) - allow http(s) and mailto: and tel:
  const linkRe = /\[([^\]]+?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)/g;
  let last = 0;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) {
      remaining = text.slice(last, m.index);
      inlineNoLinks(remaining, parts);
    }
    pushStyled(m[1], { link: m[2], color: '#1a73e8' });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    inlineNoLinks(text.slice(last), parts);
  }
  return parts;
}

// Minimal entity decoder for our use-case (only nbsp for now)
function decodeEntities(s) {
  return s.replace(/&nbsp;/g, '\u00A0');
}

function inlineNoLinks(segment, parts) {
  // Bold **text**
  // Italic *text*
  // Inline code `code`
  // Also support __bold__ and _italic_ (underscores)
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = re.exec(segment)) !== null) {
    if (match.index > last) {
      parts.push({ text: segment.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      // **bold** or __bold__
      parts.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('*') || token.startsWith('_')) {
      // *italic* or _italic_
      parts.push({ text: token.slice(1, -1), italics: true });
    } else if (token.startsWith('`')) {
      parts.push({ text: token.slice(1, -1), font: 'Mono', background: '#f2f2f2' });
    }
    last = match.index + token.length;
  }
  if (last < segment.length) {
    parts.push({ text: segment.slice(last) });
  }
}

function mdToPdfmake(md, opts = {}) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  const baseFontSize = opts.baseFontSize || 11;
  const headingMargins = opts.headingMargins || {1:[0,4,0,10],2:[0,4,0,8],3:[0,2,0,6]};
  // Compute heading sizes: absolute overrides > relative deltas from base
  const hSizes = {
    1: (typeof H1_ABS === 'number' && !isNaN(H1_ABS)) ? H1_ABS : baseFontSize + H1_D,
    2: (typeof H2_ABS === 'number' && !isNaN(H2_ABS)) ? H2_ABS : baseFontSize + H2_D,
    3: (typeof H3_ABS === 'number' && !isNaN(H3_ABS)) ? H3_ABS : baseFontSize + H3_D,
  };
  const content = [];
  let inCode = false;
  let codeBuffer = [];
  let listBuffer = null; // { type: 'ul'|'ol', items: [] }
  let blockquoteBuffer = [];
  // Keep sections between '##' headings together
  let collectingSection = false;
  let sectionBuffer = null; // array of pdfmake nodes for the current section
  let sectionCharCount = 0;
  const unbreakableCharThreshold = 1200; // conservative threshold for marking unbreakable

  const addToSection = (node, approxLen = 50) => {
    sectionBuffer.push(node);
    sectionCharCount += approxLen;
  };

  // paragraph parts: array of { text: string, softBreak: boolean }
  const flushParagraph = (parts) => {
    if (!parts || !parts.length) return;

    // Build a single pdfmake text node with inline spans and '\n' where needed
    const chunks = [];
    for (const part of parts) {
      // Decode entities (e.g. &nbsp;) and DO NOT trim leading spaces
      const txt = decodeEntities(part.text);
      const spans = mdInline(txt);
      chunks.push(...spans);
      if (part.softBreak) chunks.push('\n');
      else chunks.push(' ');
    }
    // trim trailing space/newline token if any
    if (chunks.length && typeof chunks[chunks.length - 1] === 'string') chunks.pop();

    const node = { text: chunks, margin: [0, 2, 0, 8] };
    const approxLen = parts.reduce((s, p) => s + String(p.text).length, 0);
    if (collectingSection && Array.isArray(sectionBuffer)) addToSection(node, approxLen);
    else content.push(node);
  };

  const flushList = () => {
    if (!listBuffer) return;
    const listItems = listBuffer.items.map(item => ({ text: mdInline(item) }));
    const approxLen = listBuffer.items.join(' ').length;
    if (listBuffer.type === 'ul') {
      const node = { ul: listItems, margin: [0, 0, 0, 8] };
      if (collectingSection && Array.isArray(sectionBuffer)) addToSection(node, approxLen);
      else content.push(node);
    } else {
      const node = { ol: listItems, margin: [0, 0, 0, 8] };
      if (collectingSection && Array.isArray(sectionBuffer)) addToSection(node, approxLen);
      else content.push(node);
    }
    listBuffer = null;
  };

  const flushBlockquote = () => {
    if (!blockquoteBuffer.length) return;
    const joined = blockquoteBuffer.join('\n');
    const node = {
      table: {
        widths: ['*'],
        body: [[
          { text: mdInline(joined.replace(/^>\s?/gm, '')), margin: [8, 6, 8, 6] }
        ]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0
      },
      fillColor: '#f9f9f9',
      margin: [0, 0, 0, 8]
    };
    const approxLen = joined.length;
    if (collectingSection && Array.isArray(sectionBuffer)) addToSection(node, approxLen);
    else content.push(node);
    blockquoteBuffer = [];
  };

  let paragraph = [];

  const flushParagraphIfAny = () => {
    if (paragraph.length) {
      flushParagraph(paragraph);
      paragraph = [];
    }
  };

  let pendingPageBreak = false;
  for (let raw of lines) {
    const line = raw;

    // pagebreak sentinel: only honored if the next non-empty line is a heading
    if (line.trim() === '<!--pagebreak-->') {
      pendingPageBreak = true;
      continue;
    }

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        // entering
        flushParagraphIfAny();
        flushList();
        flushBlockquote();
        inCode = true;
        codeBuffer = [];
      } else {
        // leaving
        const codeNode = {
          text: codeBuffer.join('\n'),
          font: 'Mono',
          fontSize: 9,
          margin: [0, 0, 0, 8],
          color: '#222',
          background: '#f2f2f2'
        };
        if (collectingSection && Array.isArray(sectionBuffer)) addToSection(codeNode, codeBuffer.join('\n').length);
        else content.push(codeNode);
        inCode = false;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      flushParagraphIfAny();
      flushList();
      blockquoteBuffer.push(line);
      continue;
    } else if (blockquoteBuffer.length && line.trim() === '') {
      flushBlockquote();
      continue;
    }

    // Headings
    const hMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (hMatch) {
      flushParagraphIfAny();
      flushList();
      flushBlockquote();

      const level = hMatch[1].length;
      // preserve leading non-breaking spaces if present; trim end only
      let rawHeading = hMatch[2];
      rawHeading = decodeEntities(rawHeading);
      const text = rawHeading.replace(/\s+$/,'');
      const headingObj = {
        text,
        fontSize: hSizes[level] || (baseFontSize + (4 - level)), // fallback gradient
        bold: true,
        margin: headingMargins[level] || [0,4,0,8]
      };
      if (pendingPageBreak) {
        headingObj.pageBreak = 'before';
      }
      // pagebreak sentinel only applies to the immediate next non-empty heading
      pendingPageBreak = false;

      // If it's a level-2 heading, start a collected unbreakable section so the
      // heading and everything until the next level-2 heading stay on the same page.
      if (level === 2) {
        // If we were already collecting, flush the previous section with size guard
        if (collectingSection && Array.isArray(sectionBuffer)) {
          const asStack = { stack: sectionBuffer, margin: [0, 0, 0, 8] };
          if (sectionCharCount < unbreakableCharThreshold) asStack.unbreakable = true;
          content.push(asStack);
        }
        // start a new section buffer with the heading
        collectingSection = true;
        sectionBuffer = [headingObj];
        sectionCharCount = headingObj.text ? String(headingObj.text).length : 0;
        continue;
      }

      // Non-level-2 headings: push into current section if collecting, else to content
      if (collectingSection && Array.isArray(sectionBuffer)) addToSection(headingObj, headingObj.text ? String(headingObj.text).length : 20);
      else content.push(headingObj);
      continue;
    }

    // Lists
    const ulMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ulMatch || olMatch) {
      flushParagraphIfAny();
      flushBlockquote();
      const type = ulMatch ? 'ul' : 'ol';
      // decode entities and trim end only so leading &nbsp; survive
      const rawItem = (ulMatch ? ulMatch[1] : olMatch[1]);
      const item = decodeEntities(rawItem).replace(/\s+$/,'');

      if (!listBuffer) listBuffer = { type, items: [] };
      if (listBuffer.type !== type) {
        // switched type mid-stream, flush previous
        flushList();
        listBuffer = { type, items: [] };
      }
      listBuffer.items.push(item);
      continue;
    }

    if (line.trim() === '') {
      flushParagraphIfAny();
      flushList();
      flushBlockquote();
      continue;
    }

    // Preserve soft line breaks (two trailing spaces) and leading indents
    const endsWithSoftBreak = /\s{2}$/.test(line);
    const lineNoTrail = line.replace(/\s+$/, ''); // trim end only
    paragraph.push({ text: lineNoTrail, softBreak: endsWithSoftBreak });
  }

  // Final flush
  flushParagraphIfAny();
  flushList();
  flushBlockquote();

  // After final flushes, close any open collected section
  if (collectingSection && Array.isArray(sectionBuffer) && sectionBuffer.length) {
    const asStack = { stack: sectionBuffer, margin: [0, 0, 0, 8] };
    if (sectionCharCount < unbreakableCharThreshold) asStack.unbreakable = true;
    content.push(asStack);
    collectingSection = false;
    sectionBuffer = null;
    sectionCharCount = 0;
  }

  return content;
}

// ---------- Two-page fit heuristic ----------
function tuneFontSizeForTwoPages(mdText, baseFontSize = 11) {
  // Crude, effective. Adjust as needed for your templates.
  // A4 portrait usable chars per page at 11pt with these margins ~ 2800 to 3300
  const words = mdText.trim().split(/\s+/).length;
  const approxChars = mdText.length;
  // Use the stricter of word or char estimate
  const pressure = Math.max(approxChars / 6000, words / 900); // 2 pages budget

  if (pressure <= 1.0) return baseFontSize;          // fits
  if (pressure <= 1.15) return baseFontSize - 1;     // slightly tight
  if (pressure <= 1.35) return baseFontSize - 2;
  if (pressure <= 1.6) return baseFontSize - 3;
  if (pressure <= 1.9) return baseFontSize - 4;
  return Math.max(8, baseFontSize - 5);              // absolute floor
}

// ---------- Document factory ----------
// Accepts options to allow iterative adjustments (font size, margins)
function buildDocDefinition(mdText, options = {}) {
  const tunedFontSize = options.fontSizeOverride != null
    ? options.fontSizeOverride
    : tuneFontSizeForTwoPages(mdText, 11);
  const content = mdToPdfmake(mdText, { baseFontSize: tunedFontSize, headingMargins: options.headingMarginsOverride });

  // Keep a compact (empty) header if desired; do not print page numbers in footer.
  const header = (currentPage, pageCount) => ({
    margin: [40, 20, 40, 0],
    columns: [
      { text: '', style: 'headerLeft' },
      { text: '', alignment: 'right', style: 'headerRight' }
    ]
  });

  const pageMargins = options.pageMarginsOverride || [40, 60, 40, 60];

  return {
    pageSize: 'A4',
    pageMargins,
    defaultStyle: {
      font: 'Roboto',
      fontSize: tunedFontSize,
      lineHeight: options.lineHeightOverride != null ? options.lineHeightOverride : 1.2,
      alignment: 'justify'
    },
    styles: {
      headerLeft: { fontSize: 9, color: '#777' },
      headerRight: { fontSize: 9, color: '#777' }
    },
    header,
    // PDF metadata for ATS/indexers
    info: {
      title: meta.title,
      author: meta.author,
      subject: meta.subject,
      keywords: meta.keywords,
      creator: 'genpdf.js',
      producer: 'pdfmake'
    },
    content
  };
}

// Strip HTML tags while preserving fenced code blocks (so code isn't mangled)
function stripHtmlPreserveCode(md) {
  const codeBlocks = [];
  // pull out fenced code blocks
  const placeholder = (i) => `@@CODEBLOCK${i}@@`;
  md = md.replace(/```[\s\S]*?```/g, (m) => {
    const i = codeBlocks.push(m) - 1;
    return placeholder(i);
  });

  // convert angle-bracketed URL autolinks like <https://...> or <www.example.com>
  md = md.replace(/<((?:https?:\/\/|www\.)[^\s>]+)>/gi, (m, url) => {
    const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`;
    return `[${url}](${href})`;
  });

  // remove HTML tags from the rest but preserve angle-bracketed emails/links
  // match typical HTML tags like <div ...> or </p> but avoid removing <me@host>
  md = md.replace(/<\/?[a-zA-Z][\w:\-]*(\s+[^>]*?)?>/g, '');

  // restore code blocks
  md = md.replace(/@@CODEBLOCK(\d+)@@/g, (m, n) => codeBlocks[Number(n)] || '');
  // convert angle-bracketed emails to mailto: links
  md = md.replace(/<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/g, (m, email) => {
    return `[${email}](mailto:${email})`;
  });

  // convert angle-bracketed phone numbers to tel: links (sanitized)
  md = md.replace(/<([+0-9][0-9 ()+\-]{5,})>/g, (m, tel) => {
    const telSan = tel.replace(/[() \t]/g, '');
    return `[${tel}](tel:${telSan})`;
  });

  return md;
}

// --- optional .txt sidecar for ATS/indexers ---
function writeTxtSidecar(md) {
  if (!wantTxt) return;
  const txtPath = outPath.replace(/\.pdf$/i, '.txt');
  const plain = md
    .replace(/```[\s\S]*?```/g, s => '\n[code]\n' + s.replace(/```/g,'').trim() + '\n[/code]\n')
    .replace(/!\[[^\]]*]\([^\)]+\)/g, '')         // strip images
    .replace(/\[([^\]]+)]\([^\)]+\)/g, '$1')      // links -> text
    .replace(/[*_`#>-]/g, '')                    // markdown tokens
    .replace(/[ \t]+\n/g, '\n')                  // trim line endings
    .replace(/\n{3,}/g, '\n\n')                  // condense blank lines
    .trim();
  try {
    fs.writeFileSync(txtPath, plain, 'utf8');
    console.error(`Wrote TXT sidecar: ${txtPath}`);
  } catch (err) {
    console.error('Failed to write TXT sidecar:', err.message || err);
  }
}

// --- AI comment extractor: pull <!--ai:key=value--> comments out of the markdown
// Returns { md: cleanedMarkdown, ai: { key: value, ... } }
function extractAiComments(md) {
  const ai = {};
  md = md.replace(/<!--\s*ai:([^=\s]+)\s*=\s*([^>]+?)\s*-->/g, (m, k, v) => {
    ai[k] = v.trim();
    return '';
  });
  return { md, ai };
}

function writeAiSidecar(aiObj) {
  if (!aiObj || Object.keys(aiObj).length === 0) return;
  try {
    const aiPath = outPath.replace(/\.pdf$/i, '.ai.json');
    fs.writeFileSync(aiPath, JSON.stringify(aiObj, null, 2), 'utf8');
    console.error(`Wrote AI sidecar: ${aiPath}`);
  } catch (err) {
    console.error('Failed to write AI sidecar:', err.message || err);
  }
}

// Create a PDF buffer from a docDefinition
function createPdfBufferFromDoc(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data', (c) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------- Main ----------
(async function main() {
  try {
    let md = readMarkdown();
    if (!md || !md.trim()) {
      console.error('No markdown input provided.');
      process.exit(1);
    }

    // extract AI comments like <!--ai:favorite_colour=purple-->
    const extracted = extractAiComments(md);
    md = extracted.md;
    const aiMeta = extracted.ai;
    // write a small JSON sidecar for AI tooling (not visible in PDF body)
    writeAiSidecar(aiMeta);

    // remove HTML tags but keep code blocks intact
    md = stripHtmlPreserveCode(md);

    // optional TXT sidecar for ATS
    writeTxtSidecar(md);

    // append any AI metadata into keywords so it's present in PDF info (hidden visually)
    if (aiMeta && Object.keys(aiMeta).length) {
      const baseKeys = (meta.keywords || '').trim();
      const aiKeys = Object.entries(aiMeta).map(([k, v]) => `${k}:${v}`).join('; ');
      meta.keywords = [baseKeys, aiKeys].filter(Boolean).join('; ');
    }

    // Iteratively try to fit into 2 pages by adjusting font size and margins
    let baseFont = tuneFontSizeForTwoPages(md, 11);
  let fontSize = baseFont;
  let margins = [40, 60, 40, 60];
  const lineHeights = [1.2, 1.18, 1.16, 1.15];
  let lhIdx = 0;
  let lineHeight = lineHeights[lhIdx];
  const minFont = 8;
  const minMargin = 10;

    let finalBuffer = null;
    let lastPages = Infinity;

    for (let attempt = 0; attempt < 20; attempt++) {
      const docDefinition = buildDocDefinition(md, { fontSizeOverride: fontSize, pageMarginsOverride: margins, lineHeightOverride: lineHeight });
      const buf = await createPdfBufferFromDoc(docDefinition);

      // crude page count: count '/Type /Page' occurrences
      const pdfStr = buf.toString('latin1');
      let pages = (pdfStr.match(/\/Type\s*\/Page\b/g) || []).length || 0;
      // fallback: try to read a /Count value (Pages node)
      if (pages === 0) {
        const m = pdfStr.match(/\/Count\s+(\d+)/);
        if (m) pages = parseInt(m[1], 10) || 0;
      }
      if (pages === 0) pages = 1;

      // remember last buffer
      finalBuffer = buf;
      lastPages = pages;

      if (pages <= 2) {
        break;
      }

      // try shrinking font first
      if (fontSize > minFont) {
        fontSize -= 1;
        continue;
      }

      // then reduce margins gradually
      if (margins[0] > minMargin) {
        margins = margins.map(m => Math.max(minMargin, m - 6));
        continue;
      }

      // as a last-ditch, slightly reduce line height in steps (less aggressive than margins)
      if (lhIdx < lineHeights.length - 1) {
        lhIdx++;
        lineHeight = lineHeights[lhIdx];
        continue;
      }

      // can't reduce further
      break;
    }

    if (!finalBuffer) throw new Error('Failed to generate PDF');

  // ensure output directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // write the final buffer to disk
  fs.writeFileSync(outPath, finalBuffer);

    if (lastPages > 2) {
      console.warn(`Warning: generated PDF has ${lastPages} pages (could not fit to 2 pages with safe reductions).`);
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
})();
