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

    // Length limit for standard tweet
    if (content.length > 140) {
      throw new Error(`【文字数オーバー】Xの標準制限140文字を超えています（現在: ${content.length}文字）。`);
    }
  }

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
    ? await client.v2.tweet({ text: content, media: { media_ids: [mediaId] } })
    : await client.v2.tweet(content);

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
