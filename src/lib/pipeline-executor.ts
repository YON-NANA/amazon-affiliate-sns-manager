import path from 'path';
import { getAppBaseUrl } from '@/lib/pipeline';
import {
  getNextUnusedPostSet,
  markPostSetAsUsed,
  getAllPostSets,
  getProfileHpSettings,
} from '@/lib/post-sets';
import { AutomatedExecutionResult, PipelineMode, TimeSlot } from '@/lib/types';
import { executePostToX } from '@/app/api/post-to-x/route';
import { executePostToThreads } from '@/app/api/post-to-threads/route';

export interface RunAutomatedOptions {
  setId?: string; // 特定の未使用セットを指定して投稿する場合
  forceMode?: PipelineMode;
  forceTimeSlot?: TimeSlot;
  genre?: 'life' | 'pet';
  customKeyword?: string;
  customMediaDir?: string;
  dryRun?: boolean; // テスト実行用（実際のSNS投下および「使用済み」化をスキップするか）
  platform?: 'both' | 'x' | 'threads';
}

/**
 * Vercel Cronまたは外部実行用の認証ガード
 * - Authorization: Bearer <CRON_SECRET>
 * - または ?cron_key=<CRON_SECRET>
 */
export function validateCronAuth(req: Request): { authorized: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET?.trim();

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

  const host = req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return { authorized: true };
  }

  return { authorized: false, reason: 'Invalid or missing CRON_SECRET' };
}

/**
 * 2026-11-06 改訂版：計画型・セット制 自動投稿パイプライン
 * - 事前に本人が確認した「メディア（写真・動画）＋文章」のセット単位でのみ投稿を行う
 * - ツール側でメディアと文章を別々に選んで組み合わせること・AIで似た文章を自動生成することは禁止
 * - 未使用セットが無い日は投稿をスキップする（使い回しで埋めない）
 * - 投稿本文・リプライにアフィリエイトリンクや楽天ROOMのリンクを付けない（例外時は先頭にPR明記）
 * - 一度投稿したセットは「使用済み」とし、同じ文章・同じメディアを再投稿しない
 */
export async function executeAutomatedPipeline(options: RunAutomatedOptions = {}) {
  const {
    setId,
    dryRun = false,
    platform = 'both',
  } = options;

  // 1. ストックから次回の「未使用 (unused)」かつルール適合のセットを1件取得
  const nextInfo = getNextUnusedPostSet(setId);
  const profileSettings = getProfileHpSettings();

  // 未使用セットが無い日は投稿をスキップ（使い回し・自動生成は一切しない）
  if (!nextInfo.set) {
    const skipResult: AutomatedExecutionResult = {
      id: `skip_${Date.now()}`,
      executedAt: new Date().toISOString(),
      skipped: true,
      skipReason: nextInfo.skipReason || '未使用セットが無いため本日の投稿をスキップしました。',
      remainingUnusedCount: 0,
      mode: 'nurture',
      modeReason: '【計画型・セット制】未使用セット在庫切れのため自動スキップ（使い回し・自動生成禁止）',
      topicTitle: '投稿スキップ（未使用セット在庫なし）',
      genre: 'pet',
      content: '',
      isNoLink: true,
    };

    console.log(`[Planned Pipeline] Skipped posting: ${skipResult.skipReason}`);

    return {
      success: true,
      skipped: true,
      message: skipResult.skipReason,
      result: skipResult,
      stockStatus: {
        unusedCount: nextInfo.unusedCount,
        usedCount: nextInfo.usedCount,
      },
      profileSettings,
    };
  }

  const targetSet = nextInfo.set;
  const baseMediaDir = path.join(process.cwd(), 'public', 'media-stock');
  const absoluteMediaPath = path.join(baseMediaDir, targetSet.mediaFilename);
  const baseUrl = getAppBaseUrl();
  const publicMediaUrl = targetSet.mediaUrl || `${baseUrl}/media-stock/${encodeURIComponent(targetSet.mediaFilename)}`;

  let xResult: { success: boolean; postId?: string; postUrl?: string; error?: string } = { success: false };
  let threadsResult: { success: boolean; postId?: string; postUrl?: string; error?: string } = { success: false };

  if (!dryRun) {
    // 2-1. X (Twitter) へ確認済みセット（メディア＋X用文章）を投稿（※リプライは一切付けない）
    if (platform === 'both' || platform === 'x') {
      try {
        const xRes = await executePostToX({
          content: targetSet.textX,
          isNoLink: !targetSet.hasExceptionAffiliateLink,
          hasExceptionAffiliateLink: targetSet.hasExceptionAffiliateLink,
          mediaPath: absoluteMediaPath,
          mediaUrl: publicMediaUrl,
        });
        xResult = {
          success: xRes.success,
          postId: xRes.tweetId,
          postUrl: xRes.tweetUrl,
        };
      } catch (e: any) {
        console.error('Planned Set PostToX Error:', e);
        xResult = { success: false, error: e.message || 'X投稿エラー' };
      }
    }

    // 2-2. Threads へ確認済みセット（メディア＋Threads用文章）を投稿（※リプライは一切付けない）
    if (platform === 'both' || platform === 'threads') {
      try {
        const thRes = await executePostToThreads({
          content: targetSet.textThreads,
          isNoLink: !targetSet.hasExceptionAffiliateLink,
          hasExceptionAffiliateLink: targetSet.hasExceptionAffiliateLink,
          mediaPath: absoluteMediaPath,
          imageUrl: publicMediaUrl,
          mediaType: targetSet.mediaType,
        });
        threadsResult = {
          success: thRes.success,
          postId: thRes.postId,
          postUrl: thRes.postUrl,
        };
      } catch (e: any) {
        console.error('Planned Set PostToThreads Error:', e);
        threadsResult = { success: false, error: e.message || 'Threads投稿エラー' };
      }
    }

    // 3. 投稿成功時、セットを「使用済み (used)」に更新し、二度と再投稿されないようにロック
    const anySuccess =
      (platform === 'both' && (xResult.success || threadsResult.success)) ||
      (platform === 'x' && xResult.success) ||
      (platform === 'threads' && threadsResult.success);

    if (anySuccess) {
      markPostSetAsUsed(targetSet.id, {
        xPostId: xResult.postId,
        xPostUrl: xResult.postUrl,
        threadsPostId: threadsResult.postId,
        threadsPostUrl: threadsResult.postUrl,
      });
    }
  } else {
    // ドライラン（テスト確認用：SNS投下も使用済み化もしない）
    xResult = {
      success: true,
      postId: 'dry_run_x',
      postUrl: 'https://x.com (ドライラン確認・未投下)',
    };
    threadsResult = {
      success: true,
      postId: 'dry_run_th',
      postUrl: 'https://threads.net (ドライラン確認・未投下)',
    };
  }

  const allSetsAfter = getAllPostSets();
  const remainingUnusedCount = allSetsAfter.filter(s => s.status === 'unused').length;
  const usedCountAfter = allSetsAfter.filter(s => s.status === 'used').length;

  const executionResult: AutomatedExecutionResult = {
    id: `exec_${Date.now()}`,
    executedAt: new Date().toISOString(),
    skipped: false,
    usedSet: {
      ...targetSet,
      status: dryRun ? targetSet.status : 'used',
      publishedAt: dryRun ? targetSet.publishedAt : new Date().toISOString(),
    },
    remainingUnusedCount,
    mode: 'nurture',
    modeReason: `【計画型・セット制】分類タグ「${targetSet.tag}」の確認済みセットを配信（残り未使用在庫: ${remainingUnusedCount}件）`,
    topicTitle: targetSet.title || `【${targetSet.tag}】${targetSet.mediaFilename}`,
    genre: 'pet',
    content: targetSet.textX,
    contentThreads: targetSet.textThreads,
    isNoLink: !targetSet.hasExceptionAffiliateLink,
    attachedMedia: {
      filename: targetSet.mediaFilename,
      localPath: absoluteMediaPath,
      publicUrl: publicMediaUrl,
    },
    xResult,
    threadsResult,
  };

  return {
    success: true,
    skipped: false,
    message: dryRun
      ? '【ドライラン確認完了】セット内容の検証に成功しました（実際のSNS投下および使用済み更新は行っていません）'
      : `確認済みセット「${targetSet.title || targetSet.mediaFilename}」を投稿し、「使用済み」に更新しました（残り在庫: ${remainingUnusedCount}セット）`,
    result: executionResult,
    stockStatus: {
      unusedCount: remainingUnusedCount,
      usedCount: usedCountAfter,
    },
    profileSettings,
  };
}
