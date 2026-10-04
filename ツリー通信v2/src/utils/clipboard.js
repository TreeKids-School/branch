export async function copyToClipboard(value) {
    const text = String(value ?? '');
    if (!text.trim()) throw new Error('コピーする本文がありません。');
    try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
    } catch { /* Some embedded/mobile browsers need the selection-based fallback. */ }
    const previousFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;';
    try {
        document.body.appendChild(textarea);
        textarea.focus(); textarea.select(); textarea.setSelectionRange(0, text.length);
        if (document.execCommand?.('copy') !== true) throw new Error('copy was not accepted');
    } catch {
        throw new Error('コピーできませんでした。本文を選択して、端末のコピー操作をお使いください。');
    } finally {
        textarea.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    }
}
