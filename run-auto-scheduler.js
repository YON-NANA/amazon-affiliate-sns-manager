/**
 * スタンドアロン 計画型・セット制 定期実行スケジューラー（2026-11-06 改訂ルール版）
 *
 * 使い方:
 * node run-auto-scheduler.js
 *
 * 1日1回（24時間ごと）に確認済み投稿セットのストックを確認し、
 * 未使用セットがある場合のみ1セット投稿して「使用済み」にします。
 * 未使用セットが無い日は投稿をスキップします（使い回し・自動生成は一切しません）。
 */

const API_ENDPOINT = 'http://localhost:3000/api/pipeline/run-automated';
const CHECK_INTERVAL_HOURS = 24; // 1日1回スケジュール

async function runPlannedSetPost() {
  const now = new Date();
  console.log(`\n[${now.toLocaleString('ja-JP')}] 📋 計画型・セット制 自動投稿チェックを開始します...`);

  try {
    const statusRes = await fetch(API_ENDPOINT);
    const statusData = await statusRes.json();

    if (!statusData.success) {
      console.error('ステータス取得失敗:', statusData);
      return;
    }

    const { stockStatus } = statusData;
    console.log(`現在のストック状況: 未使用 ${stockStatus?.unusedCount ?? 0} セット / 使用済み ${stockStatus?.usedCount ?? 0} セット`);

    if (!stockStatus || stockStatus.unusedCount === 0) {
      console.log('⏸️ 未使用セットが0件のため、本日の投稿をスキップしました（使い回し・自動生成禁止ルール適用）。');
      return;
    }

    console.log('確認済みセットの投稿を実行中...');
    const runRes = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: false,
      }),
    });

    const runData = await runRes.json();
    if (runData.success) {
      if (runData.skipped) {
        console.log(`⏸️ スキップ: ${runData.message}`);
      } else {
        console.log('✅ 確認済みセットの自動投稿完了！');
        console.log('----------------------------------------------------');
        console.log(`セット: ${runData.result?.topicTitle}`);
        console.log(`添付メディア: ${runData.result?.attachedMedia?.filename}`);
        console.log(`残り未使用在庫: ${runData.result?.remainingUnusedCount} セット`);
        console.log('----------------------------------------------------');
      }
    } else {
      console.error('実行エラー:', runData.error || runData);
    }
  } catch (error) {
    console.error('パイプライン実行中に通信エラーが発生しました:', error.message);
  }
}

if (process.argv.includes('--now')) {
  runPlannedSetPost();
} else {
  console.log(`\n======================================================`);
  console.log(`📋 Threads／X 計画型・セット制 スケジューラー（1日1回）`);
  console.log(`- 事前に本人が確認した「メディア＋文章」のセットのみ投稿`);
  console.log(`- 未使用セットが無い日は自動でスキップ（使い回し・自動生成禁止）`);
  console.log(`※今すぐ実行したい場合は: node run-auto-scheduler.js --now`);
  console.log(`======================================================\n`);

  setInterval(runPlannedSetPost, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
}
