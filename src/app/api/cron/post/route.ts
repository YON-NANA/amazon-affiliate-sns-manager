import { NextResponse } from 'next/server';
import { executeAutomatedPipeline, validateCronAuth, RunAutomatedOptions } from '@/lib/pipeline-executor';
import { checkPipelineMode, selectRandomStockMedia } from '@/lib/pipeline';

// Vercel Serverless Function タイムアウト対策 (最大60秒)
export const maxDuration = 60;

/**
 * GET /api/cron/post
 * Vercel Cron（または外部監視サービス・Webhook）からの定期トリガー用エンドポイント
 * - Authorization: Bearer <CRON_SECRET> ヘッダーによる認証ガード
 * - クエリパラメータ ?cron_key=<CRON_SECRET> にも対応
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const isCronTrigger = authHeader?.startsWith('Bearer ') || url.searchParams.get('trigger') === 'cron' || !!url.searchParams.get('cron_key');

    // 認証ガードチェック
    const auth = validateCronAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
    }

    // Cronトリガー、またはクエリ指定時の自動パイプライン実行
    if (isCronTrigger) {
      console.log('⏰ [Cron Trigger: /api/cron/post] Running automated pipeline...');
      const forceModeParam = url.searchParams.get('mode') as any;
      const forceTimeSlotParam = url.searchParams.get('slot') as any;
      const dryRunParam = url.searchParams.get('dry_run') === 'true';

      const executionResult = await executeAutomatedPipeline({
        forceMode: forceModeParam,
        forceTimeSlot: forceTimeSlotParam,
        dryRun: dryRunParam,
      });

      return NextResponse.json(executionResult);
    }

    // パラメータなし通常アクセスの場合はステータス＆次回配信枠情報を返却
    const modeInfo = checkPipelineMode();
    const sampleMedia = selectRandomStockMedia();

    return NextResponse.json({
      status: 'active',
      endpoint: '/api/cron/post',
      modeInfo,
      sampleStockMedia: sampleMedia ? {
        filename: sampleMedia.filename,
        publicUrl: sampleMedia.publicUrl,
      } : null,
      currentTimeJST: modeInfo.formattedTime,
      instructions: 'Vercel Cronから叩かれると完全自動投稿が実行されます。手動テストは ?trigger=cron&cron_key=<CRON_SECRET> で実行可能。',
    });
  } catch (error: any) {
    console.error('[/api/cron/post Error]:', error);
    return NextResponse.json({ error: error.message || 'Cron execution failed' }, { status: 500 });
  }
}

/**
 * POST /api/cron/post
 * 管理画面や外部からの手動・強制・カスタム実行
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
    console.error('POST /api/cron/post Error:', error);
    return NextResponse.json({
      error: error.message || '完全自動化パイプラインの実行中にエラーが発生しました',
    }, { status: 500 });
  }
}
