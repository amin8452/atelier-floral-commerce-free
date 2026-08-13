import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".prisma",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".runtime",
  "coverage",
  "dist",
  "generated",
  "node_modules",
]);

const SUSPICIOUS_SEQUENCES = [
  String.fromCodePoint(0x00c3),
  String.fromCodePoint(0x00c2),
  String.fromCodePoint(0xfffd),
  String.fromCodePoint(0x00e2, 0x20ac, 0x2122),
  String.fromCodePoint(0x00e2, 0x20ac, 0x0153),
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name)
          ? []
          : sourceFiles(resolve(directory, entry.name));
      }

      const file = resolve(directory, entry.name);
      return entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name)) ? [file] : [];
    }),
  );

  return files.flat();
}

describe("source encoding", () => {
  it("keeps source files in valid UTF-8 without common mojibake", async () => {
    const workspace = resolve(process.cwd(), "../..");
    const decoder = new TextDecoder("utf-8", { fatal: true });

    for (const file of await sourceFiles(workspace)) {
      const content = decoder.decode(await readFile(file));

      for (const sequence of SUSPICIOUS_SEQUENCES) {
        expect(content, `${file} contient une séquence d’encodage corrompue`).not.toContain(sequence);
      }
    }
  });
});
