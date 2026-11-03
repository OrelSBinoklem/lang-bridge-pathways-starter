import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'frontend', 'public', 'grammar', 'hints');
const destDir = path.join(sourceDir, 'uk');
const files = Array.from({ length: 20 }, (_, i) => `${i + 80}.html`);

const cache = new Map();

function hasCyrillic(text) {
  return /[\p{Script=Cyrillic}]/u.test(text);
}

function extractSegments(text) {
  const pattern = /[\p{Script=Cyrillic}0-9\s.,;:!?()«»"“”'’–—-]+/gu;
  const segments = [];

  for (const match of text.matchAll(pattern)) {
    const segment = match[0];
    if (hasCyrillic(segment)) {
      segments.push(segment);
    }
  }

  return segments;
}

async function translateSegment(segment) {
  if (cache.has(segment)) {
    return cache.get(segment);
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(segment)}&langpair=ru|uk`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const translated = String(payload?.responseData?.translatedText ?? segment);
  cache.set(segment, translated);
  return translated;
}

function walkTextNodes(node, acc) {
  for (const child of node.children ?? []) {
    if (child.type === 'text') {
      acc.push(child);
    } else if (child.type === 'tag' || child.type === 'root') {
      walkTextNodes(child, acc);
    }
  }
}

async function processFile(filename) {
  const sourcePath = path.join(sourceDir, filename);
  const destPath = path.join(destDir, filename);
  const source = await fs.readFile(sourcePath, 'utf8');
  const $ = cheerio.load(source, { decodeEntities: false });

  $('html').attr('lang', 'uk');
  $('link[rel="stylesheet"][href="styles.css"]').attr('href', '../styles.css');

  const textNodes = [];
  walkTextNodes($.root().get(0), textNodes);

  return { filename, $, textNodes };
}

async function translateAll(filesData) {
  const uniqueSegments = [];
  const seen = new Set();

  for (const fileData of filesData) {
    for (const textNode of fileData.textNodes) {
      for (const segment of extractSegments(textNode.data)) {
        if (!seen.has(segment)) {
          seen.add(segment);
          uniqueSegments.push(segment);
        }
      }
    }
  }

  for (const segment of uniqueSegments) {
    await translateSegment(segment);
  }
}

function applyTranslations(text) {
  if (!hasCyrillic(text)) {
    return text;
  }

  const pattern = /[\p{Script=Cyrillic}0-9\s.,;:!?()«»"“”'’–—-]+/gu;
  return text.replace(pattern, (segment) => {
    if (!hasCyrillic(segment)) {
      return segment;
    }
    return cache.get(segment) ?? segment;
  });
}

async function writeFile(fileData) {
  for (const textNode of fileData.textNodes) {
    textNode.data = applyTranslations(textNode.data);
  }

  const out = '<!DOCTYPE html>\n' + fileData.$.html();
  await fs.mkdir(destDir, { recursive: true });
  await fs.writeFile(path.join(destDir, fileData.filename), out, 'utf8');
}

async function main() {
  const filesData = [];
  for (const filename of files) {
    filesData.push(await processFile(filename));
  }

  await translateAll(filesData);

  for (const fileData of filesData) {
    await writeFile(fileData);
  }

  console.log(`Created ${filesData.length} Ukrainian hint files:`);
  console.log(filesData.map(({ filename }) => filename).join(' '));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
