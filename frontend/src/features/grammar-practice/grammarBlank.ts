export function grammarBlankParts(prompt: string): { before: string; after: string } | null {
    const match = /\{\{blank\}\}|_{2,}/u.exec(prompt);
    return match ? {
        before: prompt.slice(0, match.index),
        after: prompt.slice(match.index + match[0].length),
    } : null;
}

export function grammarSelectWidth(options: string[] = []): number {
    const longest = options.reduce((length, option) => Math.max(length, Array.from(option.normalize('NFC')).length), 0);
    return Math.min(24, Math.max(9, longest + 5));
}
