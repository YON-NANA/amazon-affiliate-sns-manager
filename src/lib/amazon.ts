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
 * Generates an Amazon affiliate link with the specified tracking ID.
 */
export function generateAffiliateUrl(asin: string, trackingId?: string): string {
  const cleanAsin = asin.trim().toUpperCase();
  const effectiveTag = (trackingId || process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID || 'affiliate-22').trim();

  return `https://www.amazon.co.jp/dp/${cleanAsin}?tag=${encodeURIComponent(effectiveTag)}`;
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
