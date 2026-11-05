import { NextResponse } from 'next/server';
import path from 'path';
import { uploadToPublicImageHost } from '@/lib/pipeline';
import {
  containsAffiliateLink,
  containsRakutenRoomReference,
  startsWithPrDisclosure,
} from '@/lib/post-sets';

export interface PostToThreadsParams {
  postId?: string;
  content: string;
  isNoLink?: boolean;
  hasExceptionAffiliateLink?: boolean;
  mediaPath?: string;
  imageUrl?: string;
  mediaType?: 'image' | 'video';
  replyToId?: string;
}

export async function executePostToThreads(params: PostToThreadsParams) {
  const {
    content,
    hasExceptionAffiliateLink,
    mediaPath,
    imageUrl,
    mediaType,
    replyToId,
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

  // Threads character limit is 500 characters
  if (postContent.length > 500) {
    throw new Error(`Threadsの文字数上限500文字を超えています（現在: ${postContent.length}文字）。`);
  }

  // 2. Resolve Threads API Credentials
  const accessToken = process.env.THREADS_ACCESS_TOKEN?.trim();
  const userId = (process.env.THREADS_USER_ID || 'me').trim();

  // If Threads API is not yet configured, return simulation response
  if (!accessToken || accessToken === 'your_threads_access_token' || accessToken.startsWith('your_')) {
    return {
      success: true,
      isSimulated: true,
      message: '【テスト/シミュレーション成功】Threads APIアクセストークンが未設定のため模擬配信として処理しました。設定すると実際に自動投稿されます。',
      postId: `sim_th_${Date.now()}`,
      postUrl: `https://threads.net/intent/post?text=${encodeURIComponent(postContent)}`,
      replyToId: replyToId || null,
    };
  }

  // 3. Resolve Media URL if provided
  let publicMediaUrl: string | null = imageUrl || null;
  if ((!publicMediaUrl || publicMediaUrl.includes('localhost')) && mediaPath) {
    publicMediaUrl = await uploadToPublicImageHost(mediaPath, imageUrl);
  }

  if (!publicMediaUrl || !publicMediaUrl.startsWith('https://')) {
    throw new Error('【ルール1：セット制ガード】Threads用の公開メディアURLが取得できなかったため、文章単体での投稿を中止しました。');
  }

  const ext = path.extname(mediaPath || publicMediaUrl).toLowerCase();
  const isVideo = mediaType === 'video' || ext === '.mp4' || ext === '.mov';

  // 4. Step 1: Create Threads Media Container
  const createContainerUrl = `https://graph.threads.net/v1.0/${userId}/threads`;
  const containerParams = new URLSearchParams({
    access_token: accessToken,
    text: postContent,
  });

  if (replyToId) {
    containerParams.append('reply_to_id', replyToId);
  }

  if (isVideo) {
    containerParams.append('media_type', 'VIDEO');
    containerParams.append('video_url', publicMediaUrl);
  } else {
    containerParams.append('media_type', 'IMAGE');
    containerParams.append('image_url', publicMediaUrl);
  }

  const createRes = await fetch(createContainerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: containerParams.toString(),
  });

  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    throw new Error(createData.error?.message || 'Threadsメディアコンテナの作成に失敗しました');
  }

  const creationId = createData.id;

  // Wait for Meta propagation delay (video requires slightly longer wait)
  await new Promise((resolve) => setTimeout(resolve, isVideo ? 6000 : 3000));

  // 5. Step 2: Publish the Container (with retry for replication lag)
  const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  let publishData: any = null;
  let lastError = '';

  for (let attempt = 1; attempt <= 4; attempt++) {
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams.toString(),
    });

    publishData = await publishRes.json();
    if (publishRes.ok && publishData.id) {
      break;
    }

    lastError = publishData?.error?.message || 'Threadsへの投稿公開に失敗しました';
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else {
      break;
    }
  }

  if (!publishData || !publishData.id) {
    throw new Error(lastError);
  }

  return {
    success: true,
    isSimulated: false,
    message: 'Threadsへ確認済みセット（メディア＋文章）の自動投稿に成功しました！',
    postId: publishData.id,
    postUrl: `https://www.threads.net/post/${publishData.id}`,
    replyToId: replyToId || null,
  };
}

export async function POST(req: Request) {
  try {
    const body: PostToThreadsParams = await req.json();
    const result = await executePostToThreads(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Threads API Error:', error);
    return NextResponse.json({
      error: error.message || 'Threads APIへの投稿中にエラーが発生しました',
    }, { status: 500 });
  }
}
