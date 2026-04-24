export interface Block {
  /** 1-based inclusive. */
  startLine: number;
  endLine: number;
  /** Block text with line endings normalised to '\n'. */
  text: string;
}

const SEPARATOR = /^#{3,}(?:\s.*)?$/;

export function splitIntoBlocks(raw: string): Block[] {
  if (raw.length === 0) return [];

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let current: { start: number; lines: string[] } | null = null;

  const finalize = (endLine: number): void => {
    if (!current) return;
    blocks.push({ startLine: current.start, endLine, text: current.lines.join('\n') });
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (SEPARATOR.test(line)) {
      if (current) finalize(lineNumber - 1);
      current = { start: lineNumber, lines: [line] };
    } else {
      if (!current) current = { start: lineNumber, lines: [] };
      current.lines.push(line);
    }
  }

  if (current) finalize(lines.length);
  return blocks;
}
