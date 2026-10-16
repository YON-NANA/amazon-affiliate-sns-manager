import { NextResponse } from 'next/server';
import {
  checkPipelineMode,
  selectRandomStockMedia,
  selectHighPriceProduct,
  generateAutomatedPost,
} from '@/lib/pipeline';
import { AutomatedExecutionResult, CandidateProduct, PipelineMode } from '@/lib/types';
import { executePostToX } from '@/app/api/post-to-x/route';
import { executePostToThreads } from '@/app/api/post-to-threads/route';

interface RunAutomatedOptions {
  forceMode?: PipelineMode; // 手動テスト・強制実行用 ('harvest' | 'nurture')
  genre?: 'life' | 'pet';
  customKeyword?: string;
  customMediaDir?: string;
  dryRun?: boolean; // テスト実行用（実際のSNS投下をスキップするか）
  platform?: 'both' | 'x' | 'threads';
}

/**
 * Vercel Cronまたは外部実行用の認証ガード
 * - Authorization: Bearer <CRON_SECRET>
 * - または ?cron_key=<CRON_SECRET>
 */
function validateCronAuth(req: Request): { authorized: boolean; reason?: string } {
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
 */
async function executeAutomatedPipeline(options: RunAutomatedOptions = {}) {
  const {
    forceMode,
    genre: requestedGenre,
    customKeyword,
    customMediaDir,
    dryRun = false,
    platform = 'both',
  } = options;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const trackingId = process.env.AMAZON_TRACKING_ID || process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID || 'kurashitools-22';

  // 1. 投稿モードの自動判定ロジック
  const modeInfo = checkPipelineMode();
  const effectiveMode: PipelineMode = forceMode || modeInfo.mode;
  const modeReason = forceMode
    ? `【強制実行モード】手動指定により「${forceMode === 'harvest' ? '刈り取り' : '育成'}」で実行`
    : modeInfo.reason;

  // ジャンル決定（ペット優先、または指定値）
  const effectiveGenre: 'life' | 'pet' = requestedGenre || 'pet';

  let selectedProduct: CandidateProduct | undefined;
  let highPriceStats: any = null;

  // 2. 高単価商品の自動選定アルゴリズム（刈り取りモード時）
  if (effectiveMode === 'harvest') {
    // 防災・ポタ電・携帯浄水器・現場消耗品を網羅するキーワード
    const defaultKeyword = customKeyword || 'ポータブル電源 ソーラーパネル 携帯浄水器 ペット保存水 消臭ペットシーツ';

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

  // 3. 記事本文の自動生成（新ペルソナ：動物保護12年・1000頭・被災地取材・フェーズフリー）
  const postData = await generateAutomatedPost({
    mode: effectiveMode,
    genre: effectiveGenre,
    selectedProduct,
    trackingId,
    apiKey,
  });

  // 4. 写真ストックフォルダ／CDN公開URLからの自動画像選定
  const chosenMedia = selectRandomStockMedia(customMediaDir);

  // 5. SNS自動投下（X & Threads）※Serverless Function内で直接実行
  let xResult: { success: boolean; postId?: string; postUrl?: string; error?: string } = { success: false };
  let threadsResult: { success: boolean; postId?: string; postUrl?: string; error?: string } = { success: false };

  if (!dryRun) {
    // 5-1. X (Twitter) へ直接投下
    if (platform === 'both' || platform === 'x') {
      try {
        const xRes = await executePostToX({
          content: postData.content,
          isNoLink: postData.isNoLink,
          mediaPath: chosenMedia?.absolutePath,
          mediaUrl: chosenMedia?.publicUrl,
        });
        xResult = {
          success: xRes.success,
          postId: xRes.tweetId,
          postUrl: xRes.tweetUrl,
        };
      } catch (e: any) {
        console.error('Direct PostToX Error:', e);
        xResult = { success: false, error: e.message || 'X投稿エラー' };
      }
    }

    // 5-2. Threads へ直接投下
    if (platform === 'both' || platform === 'threads') {
      try {
        const thRes = await executePostToThreads({
          content: postData.content,
          isNoLink: postData.isNoLink,
          mediaPath: chosenMedia?.absolutePath,
          imageUrl: chosenMedia?.publicUrl,
        });
        threadsResult = {
          success: thRes.success,
          postId: thRes.postId,
          postUrl: thRes.postUrl,
        };
      } catch (e: any) {
        console.error('Direct PostToThreads Error:', e);
        threadsResult = { success: false, error: e.message || 'Threads投稿エラー' };
      }
    }
  } else {
    xResult = { success: true, postId: 'dry_run_x', postUrl: 'https://x.com (テスト実行)' };
    threadsResult = { success: true, postId: 'dry_run_th', postUrl: 'https://threads.net (テスト実行)' };
  }

  const executionResult: AutomatedExecutionResult = {
    id: `exec_${Date.now()}`,
    executedAt: new Date().toISOString(),
    mode: effectiveMode,
    modeReason,
    topicTitle: postData.title,
    genre: effectiveGenre,
    content: postData.content,
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

/**
 * GET:
 * - Vercel Cron実行（Authorizationヘッダーあり、または ?trigger=cron）の場合は自動投稿パイプラインを実行！
 * - ブラウザからの通常閲覧アクセスは現在のステータス・次回枠・画像ストック情報を返却
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const isCronTrigger = authHeader?.startsWith('Bearer ') || url.searchParams.get('trigger') === 'cron';

    // Cronリクエストの場合は認証チェックの上でパイプラインを自動実行
    if (isCronTrigger) {
      const auth = validateCronAuth(req);
      if (!auth.authorized) {
        return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
      }

      console.log('⏰ [Vercel Cron Triggered] Running automated pipeline...');
      const executionResult = await executeAutomatedPipeline();
      return NextResponse.json(executionResult);
    }

    // 通常のステータス取得
    const modeInfo = checkPipelineMode();
    const sampleMedia = selectRandomStockMedia();

    return NextResponse.json({
      success: true,
      modeInfo,
      stockMedia: sampleMedia ? {
        filename: sampleMedia.filename,
        relativePath: sampleMedia.relativePath,
        publicUrl: sampleMedia.publicUrl,
      } : null,
      currentTimeJST: modeInfo.formattedTime,
      cronInfo: {
        note: 'Vercel Cronから叩かれると完全自動投稿が実行されます。手動テストは ?trigger=cron&cron_key=<CRON_SECRET> で可能。',
      },
    });
  } catch (error: any) {
    console.error('GET Pipeline Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: 管理画面やAPIからの手動・強制・テスト実行
 */
export async function POST(req: Request) {
  try {
    const auth = validateCronAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
    }

    const body: RunAutomatedOptions = await req.json().catch(() => ({}));
    const result = await executeAutomatedPipeline(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('POST Automated Pipeline Error:', error);
    return NextResponse.json({
      error: error.message || '完全自動化パイプラインの実行中にエラーが発生しました',
    }, { status: 500 });
  }
}
