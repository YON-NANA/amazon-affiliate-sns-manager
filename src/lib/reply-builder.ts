/**
 * ストアフロント及びカタログURLの取得
 */
export function getCatalogUrls(): {
  amazonStorefront: string;
  rakutenRoom: string;
} {
  const amazonStorefront = process.env.AMAZON_STOREFRONT_URL?.trim() || 'https://www.amazon.co.jp/shop/yonnanahogo';
  const rakutenRoom = process.env.RAKUTEN_ROOM_URL?.trim() || 'https://room.rakuten.co.jp/kurashi_tools_lab/items';
  return { amazonStorefront, rakutenRoom };
}

/**
 * リプライ欄の締めワード候補（文脈に合わせてランダム選定）
 */
export const REPLY_CLOSING_WORDS = [
  '神降臨。',
  'マジ神。',
  'これ、マスト。',
  'たすかるぅ〜。',
  '全飼い主に推したい。',
  'もっと早く買えばよかった…☆ｷﾗｯ',
];

/**
 * リプライ欄の生成ルール（商品紹介・アフィリエイト連携時）
 * 1. 導入: 「てな訳で、おすすめの神アイテムはコチラ ✨️ｷﾗｯ→」
 * 2. 本文（急に真面目レビュー）: 【商品名 / アイテムのジャンル】成分・機能・実用的な解決メリットを客観的かつ具体的に真面目に解説
 * 3. 締めワード: ランダム選定（神降臨。 / マジ神。 / これ、マスト。 / たすかるぅ〜。 / 全飼い主に推したい。 / もっと早く買えばよかった…☆ｷﾗｯ）
 * 4. リンク表示: 🔗 [URL] ※PR
 */
export function buildAffiliateReplyText(params?: {
  productName?: string;
  categoryName?: string;
  reviewText?: string;
  affiliateUrl?: string;
  amazonStorefront?: string;
  rakutenRoom?: string;
  closingWord?: string;
  targetMode?: 'amazon_storefront' | 'room' | 'direct_rakuten' | 'both';
}): string {
  const { amazonStorefront: defaultStorefront, rakutenRoom: defaultRoom } = getCatalogUrls();
  const storefront = params?.amazonStorefront || defaultStorefront;
  const room = params?.rakutenRoom || defaultRoom;
  const closing = params?.closingWord || REPLY_CLOSING_WORDS[Math.floor(Math.random() * REPLY_CLOSING_WORDS.length)];

  const intro = 'てな訳で、おすすめの神アイテムはコチラ ✨️ｷﾗｯ→';

  let reviewBody = '';
  let linkSection = '';

  if (params?.productName) {
    const cleanName = params.productName.slice(0, 32).trim();
    const review = params.reviewText
      ? params.reviewText.trim()
      : '耐久性と実用性に優れた高機能設計。日々の地味なストレスやお掃除の手間を劇的に軽減し、愛犬・愛猫との暮らしを救ってくれる実力派アイテムです。';

    reviewBody = `【${cleanName}】\n${review}\n\n${closing}`;

    if (params.targetMode === 'amazon_storefront') {
      linkSection = `🔗 Amazonストアフロント: ${storefront} ※PR`;
    } else if (params.targetMode === 'room') {
      linkSection = `🔗 楽天ROOM: ${params.affiliateUrl || room} ※PR`;
    } else if (params.targetMode === 'both') {
      linkSection = `🔗 Amazonストアフロント: ${storefront}\n🔗 楽天ROOM: ${room} ※PR`;
    } else {
      linkSection = `🔗 ${params.affiliateUrl || storefront} ※PR`;
    }
  } else {
    const genreTitle = params?.categoryName ? `愛犬・愛猫の暮らしを救う${params.categoryName}まとめ` : '愛犬・愛猫の暮らしを救う神アイテムまとめ';
    reviewBody = `【${genreTitle}】\n我が家のやらかし対策や日々の消耗品、命を守る備えとして実際にリピート愛用している厳選アイテムをまとめています。\n\n${closing}`;

    if (params?.targetMode === 'amazon_storefront') {
      linkSection = `🔗 Amazonストアフロント: ${storefront} ※PR`;
    } else if (params?.targetMode === 'room') {
      linkSection = `🔗 楽天ROOM: ${room} ※PR`;
    } else {
      linkSection = `🔗 Amazonストアフロント: ${storefront}\n🔗 楽天ROOM: ${room} ※PR`;
    }
  }

  let fullReply = `${intro}\n\n${reviewBody}\n\n${linkSection}`.trim();
  if (!fullReply.includes('※PR') && !fullReply.includes('#PR') && !fullReply.includes('#広告')) {
    fullReply = `${fullReply} ※PR`;
  }
  return fullReply;
}

/**
 * 既存のリプライ本文のリンク行を、新しいリンク形式（Amazonストアフロント等）に即座に置換するユーティリティ
 */
export function replaceReplyLinkLine(
  replyText: string,
  newLinkMode: 'amazon_storefront' | 'room' | 'direct_rakuten',
  newUrl: string
): string {
  let targetLinkLine = '';
  if (newLinkMode === 'amazon_storefront') {
    targetLinkLine = `🔗 Amazonストアフロント: ${newUrl} ※PR`;
  } else if (newLinkMode === 'room') {
    targetLinkLine = `🔗 楽天ROOM: ${newUrl} ※PR`;
  } else {
    targetLinkLine = `🔗 ${newUrl} ※PR`;
  }

  // 既存のリンク行（🔗 から始まる行または末尾のURL行）を検索して置換
  const linkRegex = /🔗[^\n]+(\n🔗[^\n]+)?/g;
  if (linkRegex.test(replyText)) {
    return replyText.replace(linkRegex, targetLinkLine).trim();
  }

  // なければ末尾に追加
  return `${replyText.trim()}\n\n${targetLinkLine}`;
}
