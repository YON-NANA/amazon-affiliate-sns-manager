import {
  checkPipelineMode,
  selectRandomStockMedia,
  selectHighPriceProduct,
  generateAutomatedPost,
} from '@/lib/pipeline';
import { AutomatedExecutionResult, CandidateProduct, PipelineMode, TimeSlot } from '@/lib/types';
import { executePostToX } from '@/app/api/post-to-x/route';
import { executePostToThreads } from '@/app/api/post-to-threads/route';

export interface RunAutomatedOptions {
  forceMode?: PipelineMode; // 手動テスト・強制実行用 ('harvest' | 'nurture')
  forceTimeSlot?: TimeSlot; // 手動テスト用の時間帯スロット
  genre?: 'life' | 'pet';
  customKeyword?: string;
  customMediaDir?: string;
  dryRun?: boolean; // テスト実行用（実際のSNS投下をスキップするか）
  platform?: 'both' | 'x' | 'threads';
  postReplyTree?: boolean; // XのリプライツリーとしてカタログURLを自動投下するか (デフォルト: false でコスト抑制)
}

/**
 * Vercel Cronまたは外部実行用の認証ガード
 * - Authorization: Bearer <CRON_SECRET>
 * - または ?cron_key=<CRON_SECRET>
 */
export function validateCronAuth(req: Request): { authorized: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET?.trim();
  
  // CRON_SECRETが未設定の場合は開発環境または未設定とみなし通過（警告ログ出力）
  if (!cronSecret) {
    console.log('[Cron Auth] CRON_SECRET is not configured. Allowing execution.');
    return { authorized: true };
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true };
  }

  const url = new URL(req.url);
  const queryKey = url.searchParams.get('cron_key') || url.searchParams.get('key');
  if (queryKey === cronSecret) {
    return { authorized: true };
  }

  // ローカル開発環境 (localhost) での管理画面からの呼び出しは許可
  const host = req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return { authorized: true };
  }

  return { authorized: false, reason: 'Invalid or missing CRON_SECRET' };
}

/**
 * 自動投稿パイプラインの中核実行ロジック
 * - 日本の生活リズム（朝・昼・夜）に応じたテーマ・キーワード選定
 * - Amazonストアフロント（防災系）／楽天ROOM（消耗品系）／個別アフィリエイトURLの自動ルーティング
 * - X（140文字制限・安全トリミング）＋Threads（500文字）への同時・個別配信
 */
export async function executeAutomatedPipeline(options: RunAutomatedOptions = {}) {
  const {
    forceMode,
    forceTimeSlot,
    genre: requestedGenre,
    customKeyword,
    customMediaDir,
    dryRun = false,
    platform = 'both',
    postReplyTree = false,
  } = options;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const trackingId = process.env.AMAZON_TRACKING_ID || process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID || 'kurashitools-22';

  // 1. 投稿モードと時間帯スロットの自動判定ロジック
  const modeInfo = checkPipelineMode();
  const effectiveMode: PipelineMode = forceMode || modeInfo.mode;
  const effectiveTimeSlot: TimeSlot = forceTimeSlot || modeInfo.timeSlot;

  const modeReason = forceMode
    ? `【強制実行モード】手動指定により「${forceMode === 'harvest' ? '刈り取り' : '育成'}」で実行`
    : modeInfo.reason;

  // ジャンル決定（ペット優先、または指定値）
  const effectiveGenre: 'life' | 'pet' = requestedGenre || 'pet';

  let selectedProduct: CandidateProduct | undefined;
  let highPriceStats: any = null;

  // 2. 高単価商品・厳選アイテムの自動選定（刈り取りモード時）
  if (effectiveMode === 'harvest') {
    // 時間帯ごとのテーマキーワード（指定がなければ時間帯スロットの推奨ワードを使用）
    const defaultKeyword = customKeyword || modeInfo.suggestedKeyword;

    const highPriceResult = await selectHighPriceProduct({
      keyword: defaultKeyword,
      genre: effectiveGenre,
      trackingId,
      apiKey,
    });

    selectedProduct = highPriceResult.selected;
    highPriceStats = {
      candidatesTotal: highPriceResult.candidatesTotal,
      highRatedCount: highPriceResult.filteredCandidates.length,
      selectionReason: highPriceResult.selectionReason,
      allCandidates: highPriceResult.allCandidates,
    };
  }

  // 3. 記事本文と導線URL（個別・カタログ・リプライ用）の自動生成
  const postData = await generateAutomatedPost({
    mode: effectiveMode,
    timeSlot: effectiveTimeSlot,
    genre: effectiveGenre,
    selectedProduct,
    trackingId,
    apiKey,
  });

  // ★フェイルセーフ：親ポスト（メイン本文）には絶対にURLや#PRを混入させない
  // 暴言や規約違反リスクのある単語も確実にサニタイズ
  const sanitizedMainContent = postData.content
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/#PR|#pr|PR/g, '')
    .replace(/しめるぞ|ゴルァ|しばくぞ/g, '勘弁して〜！')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 4. 写真ストックフォルダ／CDN公開URLからの自動画像選定
  const chosenMedia = selectRandomStockMedia(customMediaDir);

  // 運用ルール徹底：メイン本文にはリンクを置かず（isNoLink: true）、
  // 100%リプライ欄にアフィリエイトリンク・カタログをぶら下げる
  const shouldPostReply = Boolean(postData.replyText);

  // 5. SNS自動投下（X & Threads）※メイン成功後にリプライを自動投稿
  let xResult: { success: boolean; postId?: string; postUrl?: string; replyPostId?: string; replyError?: string; error?: string } = { success: false };
  let threadsResult: { success: boolean; postId?: string; postUrl?: string; replyPostId?: string; replyError?: string; error?: string } = { success: false };

  // 待機用スリープヘルパー（API側の反映ラグ防止）
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (!dryRun) {
    // 5-1. X (Twitter) へ直接投下
    if (platform === 'both' || platform === 'x') {
      try {
        const xRes = await executePostToX({
          content: sanitizedMainContent,
          isNoLink: true,
          mediaPath: chosenMedia?.absolutePath,
          mediaUrl: chosenMedia?.publicUrl,
        });
        xResult = {
          success: xRes.success,
          postId: xRes.tweetId,
          postUrl: xRes.tweetUrl,
        };

        // メイン投稿成功時: 2秒待機後にリプライをぶら下げる
        if (shouldPostReply && xRes.success && xRes.tweetId && postData.replyText) {
          try {
            console.log(`[Pipeline] Waiting 2 seconds before posting reply to tweet ${xRes.tweetId}...`);
            await sleep(2000); // 待機（sleep: API反映ラグ防止）

            const replyRes = await executePostToX({
              content: postData.replyText,
              replyToTweetId: xRes.tweetId,
              isNoLink: false,
            });
            if (replyRes.success) {
              xResult.replyPostId = replyRes.tweetId;
              console.log(`[Pipeline] X reply tree posted successfully: ${replyRes.tweetId}`);
            }
          } catch (replyErr: any) {
            console.error('[Pipeline] Failed to post reply tree to X:', replyErr);
            xResult.replyError = replyErr.message || 'Xリプライ投稿エラー';
          }
        }
      } catch (e: any) {
        console.error('Direct PostToX Error:', e);
        xResult = { success: false, error: e.message || 'X投稿エラー' };
        // メイン投稿が失敗した場合はリプライ処理をスキップ
      }
    }

    // 5-2. Threads へ直接投下
    if (platform === 'both' || platform === 'threads') {
      try {
        const thRes = await executePostToThreads({
          content: sanitizedMainContent,
          isNoLink: true,
          mediaPath: chosenMedia?.absolutePath,
          imageUrl: chosenMedia?.publicUrl,
        });
        threadsResult = {
          success: thRes.success,
          postId: thRes.postId,
          postUrl: thRes.postUrl,
        };

        // メイン投稿成功時: 2秒待機後にリプライをぶら下げる
        if (shouldPostReply && thRes.success && thRes.postId && postData.replyText) {
          try {
            console.log(`[Pipeline] Waiting 2 seconds before posting reply to Threads ${thRes.postId}...`);
            await sleep(2000); // 待機（sleep: API反映ラグ防止）

            const replyRes = await executePostToThreads({
              content: postData.replyText,
              replyToId: thRes.postId,
              isNoLink: false,
            });
            if (replyRes.success) {
              threadsResult.replyPostId = replyRes.postId;
              console.log(`[Pipeline] Threads reply posted successfully: ${replyRes.postId}`);
            }
          } catch (replyErr: any) {
            console.error('[Pipeline] Failed to post reply tree to Threads:', replyErr);
            threadsResult.replyError = replyErr.message || 'Threadsリプライ投稿エラー';
          }
        }
      } catch (e: any) {
        console.error('Direct PostToThreads Error:', e);
        threadsResult = { success: false, error: e.message || 'Threads投稿エラー' };
        // メイン投稿が失敗した場合はリプライ処理をスキップ
      }
    }
  } else {
    xResult = {
      success: true,
      postId: 'dry_run_x',
      postUrl: 'https://x.com (テスト実行)',
      replyPostId: shouldPostReply ? 'dry_run_x_reply' : undefined,
    };
    threadsResult = {
      success: true,
      postId: 'dry_run_th',
      postUrl: 'https://threads.net (テスト実行)',
      replyPostId: shouldPostReply ? 'dry_run_th_reply' : undefined,
    };
  }

  const executionResult: AutomatedExecutionResult = {
    id: `exec_${Date.now()}`,
    executedAt: new Date().toISOString(),
    timeSlot: effectiveTimeSlot,
    mode: effectiveMode,
    modeReason,
    topicTitle: postData.title,
    genre: effectiveGenre,
    content: postData.content,
    replyText: postData.replyText,
    catalogUrls: postData.catalogUrls,
    isNoLink: postData.isNoLink,
    selectedProduct,
    affiliateUrl: postData.affiliateUrl,
    attachedMedia: chosenMedia ? {
      filename: chosenMedia.filename,
      localPath: chosenMedia.absolutePath,
      publicUrl: chosenMedia.publicUrl,
    } : undefined,
    xResult,
    threadsResult,
  };

  return {
    success: true,
    message: dryRun ? '【テスト実行完了】SNS投下はスキップされました' : '完全自動化パイプラインの実行が完了しました！',
    result: executionResult,
    highPriceStats,
    modeInfo,
  };
}
