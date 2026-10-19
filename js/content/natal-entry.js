export const NATAL_CONTENT_VERSION = '1.0.0';

// Rows contain authored copy; this helper only attaches a stable schema.
export function natalEntry(id, requires, row, role = 'base') {
  const [title, summary, first, second, question, action] = row;
  return { id, requires, title, summary, paragraphs: second ? [first, second] : [first],
    question, action: role === 'base' ? action : null, version: NATAL_CONTENT_VERSION, role };
}
