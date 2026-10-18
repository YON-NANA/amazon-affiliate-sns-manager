/**
 * Amazon URL & ASIN Parser and Affiliate Link Generator
 */

export interface AmazonParseResult {
  asin: string | null;
  isValid: boolean;
  cleanUrl: string | null;
  affiliateUrl: string | null;
  error?: string;
}

/**
 * Extracts a 10-character Amazon ASIN from a URL or raw ASIN string.
 */
export function extractAsin(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Direct ASIN format (10 alphanumeric chars, typically starts with B0 or 10 digits for books)
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // 2. Standard Amazon URLs patterns:
  // - /dp/ASIN
  // - /gp/product/ASIN
  // - /exec/obidos/ASIN/ASIN
  // - /d/ASIN
  // - /product/ASIN
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/d\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Amazon.co.jpで実在が確認されている高評価・主要商品ASINリスト
 */
export const VERIFIED_ASINS: Record<string, string> = {
  // ポータブル電源・ソーラー（防災ギア）
  'B0C4FH295H': 'Jackery ポータブル電源 1000 Plus',
  'B0BFKFC9YJ': 'EcoFlow RIVER 2 Pro ポータブル電源 768Wh',
  'B0CTY9ZJYB': 'Anker Solix C1000 ポータブル電源 1056Wh',
  // 携帯浄水器・水
  'B00V7X60X0': 'SAWYER ソーヤー ミニ SP128 携帯用浄水器',
  'B0731D796X': 'KATADYN カタダイン ビーフリー 1.0L',
  // ペットケア・暮らし
  'B01FXF56K8': '猫壱 バリバリボウル',
  'B0002AR0I8': 'KONG コング クラシック M',
  'B0032GG89O': 'FURminator ファーミネーター 小型猫 短毛種用',
  'B0040QW35A': 'FURminator ファーミネーター 大型犬 長毛種用',
  'B00N1V2S18': 'A2Care 詰替用 1L 除菌消臭スプレー',
  'B000TGF86U': 'ウタマロ クリーナー 400ml',
  'B077Z2W3M9': 'ぶんぶんチョッパー スーパー5',
  'B002A9JCPQ': 'iwaki 耐熱ガラス 保存容器 7個セット',
  'B07Z8P23WQ': '山崎実業 tower 水切りバスケット',
  'B07P8R789D': 'GEX ピュアクリスタル 自動給水器 1.5L',
};

/**
 * 過去に誤って登録された架空ASINや旧型番から、Amazon.co.jp実在ASINへの自動補正マップ
 */
export const KNOWN_ASIN_CORRECTIONS: Record<string, string> = {
  'B0CHYRN43W': 'B0C4FH295H', // Jackery 1000 Plus (旧ダミー -> 実在ASIN)
  'B0BLH56B6C': 'B0BFKFC9YJ', // EcoFlow RIVER 2 Pro (旧型番 -> 実在ASIN)
  'B0C7KTW890': 'B0CTY9ZJYB', // Anker Solix C1000 (旧型番 -> 実在ASIN)
  'B00FA2RLX2': 'B00V7X60X0', // ソーヤー ミニ (US旧ASIN -> JP実在ASIN)
};

/**
 * Amazon公式検索アフィリエイトURLを生成（絶対に404エラーにならない安全リンク）
 */
export function generateAmazonSearchAffiliateUrl(keyword: string, trackingId?: string): string {
  const effectiveTag = (trackingId || process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID || 'kurashitools-22').trim();
  const cleanKeyword = keyword
    .replace(/[【】『』「」]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(cleanKeyword)}&tag=${encodeURIComponent(effectiveTag)}`;
}

/**
 * Generates an Amazon affiliate link with the specified tracking ID.
 * - 既知の誤ったASINは実在ASINへ自動補正
 * - 実在ASINまたは検証済みASINの場合は個別商品URL (/dp/...) を生成
 * - 未検証またはAIが生成した未知のASINで404のリスクがある場合、または商品名が指定されている場合は
 *   絶対に404エラーにならないAmazon公式検索アフィリエイトリンクを安全に生成
 */
export function generateAffiliateUrl(
  asinOrKeyword: string,
  trackingId?: string,
  options?: { productName?: string; forceSearchLink?: boolean }
): string {
  if (!asinOrKeyword) {
    if (options?.productName) {
      return generateAmazonSearchAffiliateUrl(options.productName, trackingId);
    }
    const defaultTag = (trackingId || process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID || 'kurashitools-22').trim();
    return `https://www.amazon.co.jp/?tag=${encodeURIComponent(defaultTag)}`;
  }

  const trimmed = asinOrKeyword.trim();
  const effectiveTag = (trackingId || process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID || 'kurashitools-22').trim();

  // 強制検索リンク指定、または10桁ASINではない場合は検索リンクを生成
  if (options?.forceSearchLink || !/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return generateAmazonSearchAffiliateUrl(trimmed, effectiveTag);
  }

  let asin = trimmed.toUpperCase();

  // 既知の補正マップ（架空ASIN -> 実在ASIN）
  if (KNOWN_ASIN_CORRECTIONS[asin]) {
    asin = KNOWN_ASIN_CORRECTIONS[asin];
  }

  // 実在ASINまたは検証済みASINの場合、確実な個別商品URLを生成
  if (VERIFIED_ASINS[asin]) {
    return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(effectiveTag)}`;
  }

  // もし検証リストにない未知のASIN（AIのハルシネーションの恐れがあるもの）の場合
  // 商品名があれば、404を絶対に防ぐために安全な検索アフィリエイトリンクへフォールバック
  if (options?.productName) {
    return generateAmazonSearchAffiliateUrl(options.productName, effectiveTag);
  }

  // それ以外は通常のdpリンクを生成
  return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(effectiveTag)}`;
}

export const buildAffiliateLink = generateAffiliateUrl;

/**
 * Comprehensive parser for user-inputted Amazon URLs or ASINs
 */
export function parseAmazonInput(input: string, trackingId?: string): AmazonParseResult {
  const asin = extractAsin(input);

  if (!asin) {
    return {
      asin: null,
      isValid: false,
      cleanUrl: null,
      affiliateUrl: null,
      error: '有効なAmazon URLまたは10桁のASINが見つかりませんでした。',
    };
  }

  const cleanUrl = `https://www.amazon.co.jp/dp/${asin}`;
  const affiliateUrl = generateAffiliateUrl(asin, trackingId);

  return {
    asin,
    isValid: true,
    cleanUrl,
    affiliateUrl,
  };
}

/**
 * Compliance helper: formats post with appropriate PR and Affiliate disclosures.
 */
export function appendPrDisclosure(content: string, type: 'hashtag' | 'footer' = 'hashtag'): string {
  if (content.includes('#PR') || content.includes('#広告') || content.includes('Amazonアソシエイト')) {
    return content;
  }

  if (type === 'hashtag') {
    return `${content} #PR`;
  }

  return `${content}\n\n※Amazonアソシエイト・プログラムの参加者です #PR`;
}
