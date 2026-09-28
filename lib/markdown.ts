/** Escape HTML then apply a tiny markdown subset: **bold**, _em_, `code`, newlines. */
export function mdLite(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md" style="background:var(--surface-2)">$1</code>')
    .replace(/\n/g, "<br/>");
}
