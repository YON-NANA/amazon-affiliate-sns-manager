import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

export interface PostToXParams {
  content: string;
  isNoLink?: boolean;
  mediaPath?: string; // ローカル画像ファイルパス
  mediaUrl?: string;  // 公開画像URL（Vercel CDN等のHTTPS）
  credentials?: {
    appKey?: string;
    appSecret?: string;
    accessToken?: string;
    accessSecret?: string;
  };
}

/**
 * X (Twitter) 用のテキスト整形・安全ガード
 * - URL（https://...）はX上で23文字（全角11.5文字分）としてカウントされる
 * - 最重要パーツ（商品URL、ストアフロントURL、#PR、ハッシュタグ）は絶対に削らず末尾に保持
 * - 文字数がオーバーした場合のみ、本文（メッセージ部分）だけを適切に短縮して「…」を付与
 */
export function formatTweetContent(rawContent: string): string {
  const content = rawContent.trim();
  const lines = content.split('\n');

  // 1. URL行（httpを含む行）を抽出
  const urlLines = lines.filter(l => l.includes('http'));
  // 2. ハッシュタグ行を抽出
  const tagLines = lines.filter(l => l.trim().startsWith('#') && !l.includes('http'));
  // 3. 本文行（URLもタグも含まない行）を抽出
  const bodyLines = lines.filter(l => !l.includes('http') && !(l.trim().startsWith('#') && !l.includes('http')));

  let bodyText = bodyLines.join('\n').trim();
  let urlSection = urlLines.join('\n').trim();
  const tagSection = tagLines.join(' ').trim();

  // URLが含まれていて #PR がない場合は自動付与（ステマ規制ガード）
  if (urlSection && !urlSection.includes('#PR') && !urlSection.includes('#広告') && !bodyText.includes('#PR')) {
    urlSection = `${urlSection} #PR`;
  }

  // 末尾に必ず残すフッター部分（URL + タグ）
  let footer = '';
  if (urlSection && tagSection) {
    footer = `\n\n${urlSection}\n${tagSection}`;
  } else if (urlSection) {
    footer = `\n\n${urlSection}`;
  } else if (tagSection) {
    footer = `\n\n${tagSection}`;
  }

  // Xの文字数ウェイト計算（全角2ウェイト、半角1ウェイト、URLは一律23ウェイト）
  // 上限280ウェイト（全角140文字）
  const calculateWeight = (text: string) => {
    // URLを一時的に23文字のダミー文字列に置換してウェイト計算
    const textWithoutUrls = text.replace(/https?:\/\/[^\s]+/g, 'U'.repeat(23));
    let weight = 0;
    for (const char of textWithoutUrls) {
      const code = char.charCodeAt(0);
      if (
        (code >= 0x3000 && code <= 0x9fff) ||
        (code >= 0xff01 && code <= 0xff60) ||
        char.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/) ||
        code > 0x007f
      ) {
        weight += 2;
      } else {
        weight += 1;
      }
    }
    return weight;
  };

  const maxTotalWeight = 270; // 280上限に対して安全マージン10
  const footerWeight = calculateWeight(footer);
  const allowedBodyWeight = Math.max(40, maxTotalWeight - footerWeight);

  // 本文が許容ウェイトを超える場合、本文のみを末尾から削る
  if (calculateWeight(bodyText) > allowedBodyWeight) {
    while (calculateWeight(bodyText + '…') > allowedBodyWeight && bodyText.length > 0) {
      bodyText = bodyText.slice(0, -1);
    }
    bodyText = bodyText.trim() + '…';
  }

  return (bodyText + footer).trim();
}

export async function executePostToX(params: PostToXParams) {
  const { content, isNoLink, mediaPath, mediaUrl, credentials } = params;

  if (!content || !content.trim()) {
    throw new Error('投稿本文が空です');
  }

  // 1. Anti-BAN Safety Validations
  if (!isNoLink) {
    // Must contain #PR disclosure if it has an affiliate link
    if (content.includes('amazon.co.jp') && !content.includes('#PR') && !content.includes('#広告')) {
      throw new Error('【アカバン防止ガード】Amazonアフィリエイトリンクを含む投稿には「#PR」の表記が必須です。');
    }
  }

  // X（Twitter）標準仕様: 全角140文字（280ウェイト）制限
  // 肝心な「商品URL」「#PR」「ハッシュタグ」が絶対に欠けないよう、本文のみを安全に調整
  const finalContent = formatTweetContent(content);

  // 2. Resolve Twitter API Credentials
  const appKey = credentials?.appKey || process.env.TWITTER_API_KEY || process.env.X_API_KEY;
  const appSecret = credentials?.appSecret || process.env.TWITTER_API_SECRET || process.env.X_API_SECRET;
  const accessToken = credentials?.accessToken || process.env.TWITTER_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
  const accessSecret = credentials?.accessSecret || process.env.TWITTER_ACCESS_SECRET || process.env.X_ACCESS_SECRET;

  // If Twitter API is not yet configured, provide a dry-run / simulation response with instructions
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return {
      success: true,
      isSimulated: true,
      message: '【テスト/シミュレーション成功】X APIキーが未設定のため模擬配信として処理しました。キーを設定すると実際に自動投稿されます。',
      tweetId: `sim_${Date.now()}`,
      tweetUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(content)}`,
      attachedMediaId: null,
    };
  }

  // 3. Post to Twitter via API v2 (with optional media attachment)
  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });

  let mediaId: string | undefined;

  // If mediaPath or mediaUrl is provided, upload image via v1.uploadMedia
  try {
    const fs = await import('fs');
    if (mediaPath && fs.existsSync(mediaPath)) {
      console.log(`Uploading local media to X: ${mediaPath}`);
      mediaId = await client.v1.uploadMedia(mediaPath);
      console.log(`Media uploaded to X successfully, ID: ${mediaId}`);
    } else if (mediaUrl && mediaUrl.startsWith('https://')) {
      console.log(`Fetching and uploading remote media to X: ${mediaUrl}`);
      const res = await fetch(mediaUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        mediaId = await client.v1.uploadMedia(buffer, { mimeType: contentType });
        console.log(`Remote media uploaded to X successfully, ID: ${mediaId}`);
      }
    }
  } catch (mediaError) {
    console.warn('Failed to upload media to X, falling back to text-only tweet:', mediaError);
  }

  const tweet = mediaId
    ? await client.v2.tweet({ text: finalContent, media: { media_ids: [mediaId] } })
    : await client.v2.tweet(finalContent);

  return {
    success: true,
    isSimulated: false,
    message: mediaId ? 'X (Twitter) へ画像付きで自動投稿に成功しました！' : 'X (Twitter) への自動投稿に成功しました！',
    tweetId: tweet.data.id,
    tweetUrl: `https://x.com/i/web/status/${tweet.data.id}`,
    attachedMediaId: mediaId || null,
  };
}

export async function POST(req: Request) {
  try {
    const body: PostToXParams = await req.json();
    const result = await executePostToX(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Twitter API error:', error);
    return NextResponse.json({
      error: error.message || 'X APIへの投稿中にエラーが発生しました',
      details: error.data || null,
    }, { status: 500 });
  }
}
