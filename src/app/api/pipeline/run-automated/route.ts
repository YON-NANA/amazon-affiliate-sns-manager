import { NextResponse } from 'next/server';
import { executeAutomatedPipeline, validateCronAuth, RunAutomatedOptions } from '@/lib/pipeline-executor';
import { getAllPostSets, getProfileHpSettings } from '@/lib/post-sets';

// Vercel Serverless Function タイムアウト対策 (最大60秒)
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const isCronTrigger =
      authHeader?.startsWith('Bearer ') ||
      url.searchParams.get('trigger') === 'cron' ||
      !!url.searchParams.get('cron_key');

    if (isCronTrigger) {
      const auth = validateCronAuth(req);
      if (!auth.authorized) {
        return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
      }

      console.log('⏰ [Pipeline Triggered] Running planned set pipeline...');
      const executionResult = await executeAutomatedPipeline();
      return NextResponse.json(executionResult);
    }

    // 通常のステータス取得（セット在庫状況・プロフィール設定）
    const sets = getAllPostSets();
    const unusedSets = sets.filter(s => s.status === 'unused');
    const usedSets = sets.filter(s => s.status === 'used');
    const profileSettings = getProfileHpSettings();

    return NextResponse.json({
      success: true,
      ruleVersion: '2026-11-06 改訂版（計画型・セット制）',
      stockStatus: {
        unusedCount: unusedSets.length,
        usedCount: usedSets.length,
        nextSet: unusedSets[0] || null,
      },
      profileSettings,
      cronInfo: {
        schedule: '1日1回',
        note: '未使用の投稿セットがある場合のみ1日1回投稿し、在庫が無い日は自動でスキップします（使い回し・AI自動生成禁止）。',
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
      error: error.message || '計画型セット投稿パイプラインの実行中にエラーが発生しました',
    }, { status: 500 });
  }
}
