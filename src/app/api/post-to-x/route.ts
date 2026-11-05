import { NextResponse } from 'next/server';
import path from 'path';
import { TwitterApi } from 'twitter-api-v2';
import {
  containsAffiliateLink,
  containsRakutenRoomReference,
  startsWithPrDisclosure,
} from '@/lib/post-sets';

export interface PostToXParams {
  content: string;
  isNoLink?: boolean;
  hasExceptionAffiliateLink?: boolean;
  mediaPath?: string; // ローカル画像・動画ファイルパス
  mediaUrl?: string;  // 公開画像・動画URL（Vercel CDN等のHTTPS）
  replyToTweetId?: string;
  credentials?: {
    appKey?: string;
    appSecret?: string;
    accessToken?: string;
    accessSecret?: string;
  };
}

/**
 * X (Twitter) 用のテキストウェイト検証・整形
 * - 改訂ルール（2026-11-06）に基づき、ツール側で勝手に文面を組み立てたり末尾に#PRを付け足したりしない
 * - アフィリエイトリンクを例外的に含む場合は「先頭にPR」があることを厳格チェック
 */
export function formatTweetContent(rawContent: string): string {
  return rawContent.trim();
}

export async function executePostToX(params: PostToXParams) {
  const {
    content,
    hasExceptionAffiliateLink,
    mediaPath,
    mediaUrl,
    replyToTweetId,
    credentials,
  } = params;

  if (!content || !content.trim()) {
    throw new Error('投稿本文が空です');
  }

  const postContent = content.trim();

  // 1. 2026-11-06 改訂ルール チェック
  // ルール3 & 対象外: 楽天ROOMのリンク・誘導は完全禁止
  if (containsRakutenRoomReference(postContent)) {
    throw new Error('【投稿ルール違反】投稿本文に楽天ROOMのリンクや誘導を含めることは禁止されています。');
  }

  // ルール3: アフィリエイトリンクを含む場合は例外フラグ＆先頭「PR」明記が必須
  const hasAffiliate = containsAffiliateLink(postContent);
  if (hasAffiliate) {
    if (!hasExceptionAffiliateLink && !startsWithPrDisclosure(postContent)) {
      throw new Error('【投稿ルール3違反】アフィリエイトリンクを含む投稿を例外的に出す場合は、本文の先頭に「PR」と明記してください。');
    }
    if (!startsWithPrDisclosure(postContent)) {
      throw new Error('【投稿ルール3違反】アフィリエイトリンクを含む投稿は、必ず先頭に「PR」と明記してください。');
    }
  }

  const finalContent = formatTweetContent(postContent);

  // 2. Resolve Twitter API Credentials
  const appKey = credentials?.appKey || process.env.TWITTER_API_KEY || process.env.X_API_KEY;
  const appSecret = credentials?.appSecret || process.env.TWITTER_API_SECRET || process.env.X_API_SECRET;
  const accessToken = credentials?.accessToken || process.env.TWITTER_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
  const accessSecret = credentials?.accessSecret || process.env.TWITTER_ACCESS_SECRET || process.env.X_ACCESS_SECRET;

  // If Twitter API is not yet configured, provide a dry-run / simulation response
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return {
      success: true,
      isSimulated: true,
      message: '【テスト/シミュレーション成功】X APIキーが未設定のため模擬配信として処理しました。キーを設定すると実際に自動投稿されます。',
      tweetId: `sim_${Date.now()}`,
      tweetUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(finalContent)}`,
      attachedMediaId: null,
      inReplyToTweetId: replyToTweetId || null,
    };
  }

  // 3. Post to Twitter via API v2 (with media attachment from the confirmed set)
  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });

  let mediaId: string | undefined;

  try {
    const fs = await import('fs');
    if (mediaPath && fs.existsSync(mediaPath)) {
      console.log(`Uploading local set media to X: ${mediaPath}`);
      mediaId = await client.v1.uploadMedia(mediaPath);
      console.log(`Media uploaded to X successfully, ID: ${mediaId}`);
    } else if (mediaUrl && mediaUrl.startsWith('https://')) {
      console.log(`Fetching and uploading remote set media to X: ${mediaUrl}`);
      const res = await fetch(mediaUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = path.extname(new URL(mediaUrl).pathname).toLowerCase();
        const defaultMime = ext === '.mp4' ? 'video/mp4' : ext === '.png' ? 'image/png' : 'image/jpeg';
        const contentType = res.headers.get('content-type') || defaultMime;
        mediaId = await client.v1.uploadMedia(buffer, { mimeType: contentType });
        console.log(`Remote media uploaded to X successfully, ID: ${mediaId}`);
      }
    }
  } catch (mediaError: any) {
    throw new Error(`【ルール1：セット制ガード】Xへのメディアアップロードに失敗したため、文章単体での投稿を中止しました: ${mediaError.message || mediaError}`);
  }

  const tweetPayload: any = { text: finalContent };
  if (mediaId) {
    tweetPayload.media = { media_ids: [mediaId] };
  }
  if (replyToTweetId) {
    tweetPayload.reply = { in_reply_to_tweet_id: replyToTweetId };
  }

  const tweet = await client.v2.tweet(tweetPayload);

  return {
    success: true,
    isSimulated: false,
    message: 'X (Twitter) へ確認済みセット（メディア＋文章）の投稿に成功しました！',
    tweetId: tweet.data.id,
    tweetUrl: `https://x.com/i/web/status/${tweet.data.id}`,
    attachedMediaId: mediaId || null,
    inReplyToTweetId: replyToTweetId || null,
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
