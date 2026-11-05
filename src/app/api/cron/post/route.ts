import { NextResponse } from 'next/server';
import { executeAutomatedPipeline, validateCronAuth, RunAutomatedOptions } from '@/lib/pipeline-executor';
import { getAllPostSets, getProfileHpSettings } from '@/lib/post-sets';

// Vercel Serverless Function タイムアウト対策 (最大60秒)
export const maxDuration = 60;

/**
 * GET /api/cron/post
 * 計画型・セット制 1日1回自動投稿エンドポイント
 * - 未使用セットがある場合のみ1セット投稿し「使用済み」にする
 * - 未使用セットが無い日は投稿をスキップする（使い回し・自動生成は一切しない）
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const isCronTrigger =
      authHeader?.startsWith('Bearer ') ||
      url.searchParams.get('trigger') === 'cron' ||
      !!url.searchParams.get('cron_key');

    const auth = validateCronAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
    }

    if (isCronTrigger) {
      console.log('⏰ [Cron Trigger: /api/cron/post] Running planned set pipeline (1/day)...');
      const dryRunParam = url.searchParams.get('dry_run') === 'true';

      const executionResult = await executeAutomatedPipeline({
        dryRun: dryRunParam,
      });

      return NextResponse.json(executionResult);
    }

    // パラメータなし通常アクセスの場合はストック在庫ステータスを返却
    const sets = getAllPostSets();
    const unusedSets = sets.filter(s => s.status === 'unused');
    const usedSets = sets.filter(s => s.status === 'used');
    const profileSettings = getProfileHpSettings();

    return NextResponse.json({
      status: 'active',
      ruleVersion: '2026-11-06 改訂版（計画型・セット制）',
      endpoint: '/api/cron/post',
      schedule: '1日1回（未使用セット在庫が尽きたら自動スキップ）',
      stockStatus: {
        unusedCount: unusedSets.length,
        usedCount: usedSets.length,
        nextSet: unusedSets[0] || null,
      },
      profileSettings,
      instructions:
        '事前に本人が確認した「メディア＋文章」の未使用セットから1日1回投稿します。未使用セットが無い日は自動的にスキップされます。',
    });
  } catch (error: any) {
    console.error('[/api/cron/post Error]:', error);
    return NextResponse.json({ error: error.message || 'Cron execution failed' }, { status: 500 });
  }
}

/**
 * POST /api/cron/post
 * 管理画面からの手動実行・ドライラン確認
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
      error: error.message || '計画型セット投稿パイプラインの実行中にエラーが発生しました',
    }, { status: 500 });
  }
}
