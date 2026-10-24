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

import { convertToRakutenAffiliateUrl } from './rakuten';

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

  const isTravel = /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション|pet_travel/i.test(
    `${params?.productName || ''} ${params?.categoryName || ''} ${params?.affiliateUrl || ''}`
  );

  const intro = isTravel
    ? 'てな訳で、今回お邪魔した（おすすめの）神宿はコチラ ✨️ｷﾗｯ→'
    : 'てな訳で、おすすめの神アイテムはコチラ ✨️ｷﾗｯ→';

  // 宿・ホテルの場合、素のURL（travel.rakuten.co.jp）が渡されても自動的にアフィリエイトリンクに変換
  const rawTargetUrl = params?.affiliateUrl || '';
  const effectiveAffiliateUrl = isTravel && rawTargetUrl
    ? convertToRakutenAffiliateUrl(rawTargetUrl)
    : rawTargetUrl;

  let reviewBody = '';
  let linkSection = '';

  if (params?.productName) {
    const cleanName = params.productName.slice(0, 32).trim();
    const defaultReview = isTravel
      ? '愛犬・愛猫と気兼ねなく過ごせる充実の設備とおもてなし。客室温泉やドッグラン、美味しい食事で家族みんなが笑顔になれる特別な宿です。'
      : '耐久性と実用性に優れた高機能設計。日々の地味なストレスやお掃除の手間を劇的に軽減し、愛犬・愛猫との暮らしを救ってくれる実力派アイテムです。';
    const review = params.reviewText ? params.reviewText.trim() : defaultReview;

    reviewBody = `【${cleanName}】\n${review}\n\n${closing}`;

    if (params.targetMode === 'amazon_storefront') {
      linkSection = `🔗 Amazonストアフロント: ${storefront} ※PR`;
    } else if (params.targetMode === 'room') {
      linkSection = `🔗 楽天ROOM: ${effectiveAffiliateUrl || room} ※PR`;
    } else if (params.targetMode === 'both') {
      linkSection = `🔗 Amazonストアフロント: ${storefront}\n🔗 楽天ROOM: ${room} ※PR`;
    } else {
      linkSection = isTravel
        ? `🔗 楽天トラベル詳細・空室確認: ${effectiveAffiliateUrl || room} ※PR`
        : `🔗 ${effectiveAffiliateUrl || storefront} ※PR`;
    }
  } else {
    const defaultGenreTitle = isTravel
      ? '一度は泊まりたい！愛犬同伴の神宿まとめ'
      : '愛犬・愛猫の暮らしを救う神アイテムまとめ';
    const genreTitle = params?.categoryName
      ? (isTravel ? params.categoryName : `愛犬・愛猫の暮らしを救う${params.categoryName}まとめ`)
      : defaultGenreTitle;

    const defaultReview = isTravel
      ? '愛犬と一緒に泊まって本当に良かった神宿や、客室露天・プライベートドッグラン付きの安心宿をコレクションにまとめています。\n\n一生の思い出になった…☆ｷﾗｯ'
      : '我が家のやらかし対策や日々の消耗品、命を守る備えとして実際にリピート愛用している厳選アイテムをまとめています。\n\n' + closing;

    reviewBody = `【${genreTitle}】\n${defaultReview}`;

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
    const isTravel = /travel\.rakuten|a\.r10\.to|hb\.afl\.rakuten/i.test(newUrl);
    const effectiveTargetUrl = isTravel ? convertToRakutenAffiliateUrl(newUrl) : newUrl;
    targetLinkLine = isTravel
      ? `🔗 楽天トラベル詳細・空室確認: ${effectiveTargetUrl} ※PR`
      : `🔗 ${effectiveTargetUrl} ※PR`;
  }

  // 既存のリンク行（🔗 から始まる行または末尾のURL行）を検索して置換
  const linkRegex = /🔗[^\n]+(\n🔗[^\n]+)?/g;
  if (linkRegex.test(replyText)) {
    return replyText.replace(linkRegex, targetLinkLine).trim();
  }

  // なければ末尾に追加
  return `${replyText.trim()}\n\n${targetLinkLine}`;
}
