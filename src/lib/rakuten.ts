/**
 * 楽天アフィリエイト URL ユーティリティ
 */

// デフォルトの楽天アフィリエイトID（未設定時のフォールバック用）
export const DEFAULT_RAKUTEN_AFFILIATE_ID = 'g0190dd1.aflrakuten';

/**
 * 楽天アフィリエイトリンク（hb.afl.rakuten.co.jp / a.r10.to）かどうか判定
 */
export function isRakutenAffiliateLink(url: string): boolean {
  return /hb\.afl\.rakuten\.co\.jp|a\.r10\.to/i.test(url);
}

/**
 * 楽天トラベルのURLかどうか判定
 */
export function isRakutenTravelUrl(url: string): boolean {
  return /travel\.rakuten\.co\.jp/i.test(url);
}

/**
 * 楽天市場・楽天トラベルのURLを、成果の発生する楽天アフィリエイトカスタムURLに自動変換
 * 
 * 形式: https://hb.afl.rakuten.co.jp/hgc/${affiliateId}/?pc=${encodeURIComponent(url)}
 */
export function convertToRakutenAffiliateUrl(url: string, affiliateId?: string): string {
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  // すでに楽天アフィリエイトリンク（短縮URL a.r10.to や hb.afl...）の場合はそのまま使用
  if (isRakutenAffiliateLink(cleanUrl)) {
    return cleanUrl;
  }

  // 楽天トラベルまたは楽天市場のURLの場合、カスタムURL形式に自動変換
  if (isRakutenTravelUrl(cleanUrl) || /item\.rakuten\.co\.jp|rakuten\.co\.jp/i.test(cleanUrl)) {
    const activeAffId = (affiliateId || '').trim() || DEFAULT_RAKUTEN_AFFILIATE_ID;
    const encodedTarget = encodeURIComponent(cleanUrl);
    return `https://hb.afl.rakuten.co.jp/hgc/${activeAffId}/?pc=${encodedTarget}`;
  }

  // 該当しない場合はそのまま返す
  return cleanUrl;
}
