// ── App Constants ─────────────────────────────────────────────────────────────

export const APP_VERSION = '26.06.09.1';

export const DAILY_LIMIT = 20;

export const STAFF_OPTIONS = ['ブラック', 'パープル', 'さくら', 'ブラウン', 'ブルー', 'ネイビー'];

export function getStaffInstruction(staff) {
    if (!staff) return '';
    const map = {
        'ブラック': '- 文体: 明瞭で力強い表現を好む。簡潔にまとめる。',
        'パープル': '- 文体: 丁寧で落ち着いた表現。情緒的なニュアンスも大切にする。',
        'さくら': '- 文体: 温かみがあり、やわらかい表現。ひらがな多め。',
        'ブラウン': '- 文体: 安心感を与える穏やかな文体。保護者に寄り添う言い回し。',
        'ブルー': '- 文体: 爽やかで明るい表現。前向きな言葉を多く使う。',
        'ネイビー': '- 文体: 信頼感のある落ち着いた表現。論理的にまとめる。',
    };
    return map[staff] || '';
}

// parseForceSheet / buildForceSheet
export { parseForceSheet, buildForceSheet } from './utils/parseForceSheet';

export function getRoleFromPost(post) {
    if (!post) return '';
    const posts = Array.isArray(post) ? post : [post];
    if (posts.includes('管理者')) return '管理者';
    if (posts.includes('児発管')) return '児発管';
    if (posts.includes('児童指導員・保育士')) return '児童指導員・保育士';
    if (posts.includes('指導員')) return '指導員';
    if (posts.includes('スタッフ')) return 'スタッフ';
    return '';
}
