import { NextResponse } from 'next/server';
import { executeAutomatedPipeline, validateCronAuth, RunAutomatedOptions } from '@/lib/pipeline-executor';
import { checkPipelineMode, selectRandomStockMedia } from '@/lib/pipeline';

// Vercel Serverless Function タイムアウト対策 (最大60秒)
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const isCronTrigger = authHeader?.startsWith('Bearer ') || url.searchParams.get('trigger') === 'cron' || !!url.searchParams.get('cron_key');

    // Cronリクエストの場合は認証チェックの上でパイプラインを自動実行
    if (isCronTrigger) {
      const auth = validateCronAuth(req);
      if (!auth.authorized) {
        return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
      }

      console.log('⏰ [Pipeline Triggered] Running automated pipeline...');
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
