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

  const isTravel = /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション|pet_travel/i.test(
    `${params?.productName || ''} ${params?.categoryName || ''} ${params?.affiliateUrl || ''}`
  );

  const rawTargetUrl = params?.affiliateUrl || '';
  const effectiveAffiliateUrl = isTravel && rawTargetUrl
    ? convertToRakutenAffiliateUrl(rawTargetUrl)
    : rawTargetUrl;

  // 商品指定あり
  if (params?.productName) {
    const cleanName = params.productName.slice(0, 24).trim();
    if (isTravel) {
      return `【おすすめのお宿情報🐾】\n${cleanName}\n愛犬と安心して泊まれる充実のおもてなし宿です✨️\n\n👇空室確認・プラン詳細はこちら\n${effectiveAffiliateUrl || room}\n\n#PR #犬連れ旅行 #ペットと泊まれる宿`;
    }
    const targetUrl = effectiveAffiliateUrl || room;
    return `【愛用アイテム詳細🐾】\n${cleanName}\n日々の暮らしがぐっと快適になるおすすめグッズです✨️\n\n👇詳細・お買い物はこちら\n${targetUrl}\n\n#PR #買ってよかった #ペットのいる暮らし`;
  }

  // カタログ・まとめ型（商品未指定・育成モード時）
  if (isTravel) {
    return `【愛犬同伴の神宿まとめ🐾】\n愛犬と一緒に泊まって本当に良かった安心のお宿をコレクションにまとめています✨️\n\n👇楽天トラベル厳選宿はこちら\n${room}\n\n#PR #犬連れ旅行 #ペットと泊まれる宿`;
  }

  // 物販（楽天ROOM中心・プロフリンク対応）
  return `【愛用アイテムまとめ🐾】\n我が家で本当に助かっている愛用グッズをコレクションにまとめています✨️\n\n👇愛用アイテム一覧はこちら（楽天ROOM）\n${room}\n\n#PR #買ってよかった #ペットのいる暮らし`;
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
