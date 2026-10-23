import { NextResponse } from 'next/server';
import { uploadToPublicImageHost } from '@/lib/pipeline';

export interface PostToThreadsParams {
  postId?: string;
  content: string;
  isNoLink?: boolean;
  mediaPath?: string;
  imageUrl?: string;
  replyToId?: string; // 返信先Threads投稿ID（リプライツリー用）
}

export async function executePostToThreads(params: PostToThreadsParams) {
  const { content, isNoLink, mediaPath, imageUrl, replyToId } = params;

  if (!content || !content.trim()) {
    throw new Error('投稿本文が空です');
  }

  // 1. Anti-BAN & Compliance Check
  if (!isNoLink) {
    if (content.includes('amazon.co.jp') && !content.includes('#PR') && !content.includes('#広告')) {
      throw new Error('【アカバン防止ガード】Amazonアフィリエイトリンクを含む投稿には「#PR」の表記が必須です。');
    }
  }

  // Threads character limit is 500 characters
  if (content.length > 500) {
    throw new Error(`Threadsの文字数上限500文字を超えています（現在: ${content.length}文字）。`);
  }

  // 2. Resolve Threads API Credentials
  const accessToken = process.env.THREADS_ACCESS_TOKEN?.trim();
  const userId = (process.env.THREADS_USER_ID || 'me').trim();

  // If Threads API is not yet configured, return simulation response
  if (!accessToken || accessToken === 'your_threads_access_token' || accessToken.startsWith('your_')) {
    return {
      success: true,
      isSimulated: true,
      message: replyToId
        ? '【テスト/シミュレーション成功】Threads APIキー未設定のためリプライ模擬配信として処理しました。'
        : '【テスト/シミュレーション成功】Threads APIアクセストークンが未設定のため模擬配信として処理しました。設定すると実際に自動投稿されます。',
      postId: `sim_th_${Date.now()}`,
      postUrl: `https://threads.net/intent/post?text=${encodeURIComponent(content)}`,
      replyToId: replyToId || null,
    };
  }

  // 3. Resolve Media URL if provided
  let publicImageUrl: string | null = imageUrl || null;
  if (!publicImageUrl && mediaPath) {
    publicImageUrl = await uploadToPublicImageHost(mediaPath, imageUrl);
  }

  // 4. Step 1: Create Threads Media Container
  const createContainerUrl = `https://graph.threads.net/v1.0/${userId}/threads`;
  const containerParams = new URLSearchParams({
    access_token: accessToken,
    text: content,
  });

  // リプライ投稿の場合は返信先投稿ID（reply_to_id）を付与
  if (replyToId) {
    containerParams.append('reply_to_id', replyToId);
  }

  if (publicImageUrl && publicImageUrl.startsWith('https://')) {
    containerParams.append('media_type', 'IMAGE');
    containerParams.append('image_url', publicImageUrl);
  } else {
    containerParams.append('media_type', 'TEXT');
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

  // Wait for Meta propagation delay (usually 2-3 seconds)
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 4. Step 2: Publish the Container (with retry for replication lag)
  const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  let publishData: any = null;
  let lastError = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
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
    if (publishData?.error?.error_subcode === 4279009 && attempt < 3) {
      // Wait and retry if media is still replicating
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
    message: replyToId ? 'Threadsへのリプライ投稿に成功しました！' : 'Threadsへの自動投稿に成功しました！',
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
