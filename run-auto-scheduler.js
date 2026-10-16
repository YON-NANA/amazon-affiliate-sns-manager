/**
 * スタンドアロン 完全自動化パイプライン 定期実行スケジューラー
 * 
 * 使い方:
 * node run-auto-scheduler.js
 * 
 * 指定したインターバル（デフォルト: 4時間ごと、または刈り取り時間に合わせて）で
 * 完全自動化パイプライン（日時判定 ➔ 高単価選定 ➔ 写真添付 ➔ X/Threads投下）を実行します。
 */

const API_ENDPOINT = 'http://localhost:3001/api/pipeline/run-automated';
const CHECK_INTERVAL_MINUTES = 30; // 30分ごとに時刻をチェック

async function runAutoPilot() {
  const now = new Date();
  console.log(`\n[${now.toLocaleString('ja-JP')}] 🚀 完全自動化パイプラインのチェックを開始します...`);

  try {
    // 1. 現在のモード判定を取得
    const statusRes = await fetch(API_ENDPOINT);
    const statusData = await statusRes.json();
    
    if (!statusData.success) {
      console.error('ステータス取得失敗:', statusData);
      return;
    }

    const { modeInfo } = statusData;
    console.log(`現在の判定: [${modeInfo.mode === 'harvest' ? '🔥 刈り取り' : '🌱 育成'}] ${modeInfo.formattedTime}`);
    console.log(`理由: ${modeInfo.reason}`);

    // 2. パイプラインを実行
    console.log('パイプラインを実行中（商品選定・記事生成・写真添付・SNS投下）...');
    const runRes = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: false, // 実際に投下
      }),
    });

    const runData = await runRes.json();
    if (runData.success && runData.result) {
      console.log('✅ 自動投稿完了！');
      console.log('----------------------------------------------------');
      console.log(`モード: ${runData.result.mode === 'harvest' ? '🔥 刈り取り' : '🌱 育成'}`);
      if (runData.result.selectedProduct) {
        console.log(`選定商品: ${runData.result.selectedProduct.name} (¥${runData.result.selectedProduct.price.toLocaleString()} / ★${runData.result.selectedProduct.rating})`);
        console.log(`選定理由: ${runData.highPriceStats?.selectionReason}`);
      }
      if (runData.result.attachedMedia) {
        console.log(`添付写真: ${runData.result.attachedMedia.filename}`);
      }
      console.log('投稿本文:\n' + runData.result.content);
      console.log('----------------------------------------------------');
      if (runData.result.xResult?.success) {
        console.log(`𝕏 投稿URL: ${runData.result.xResult.postUrl}`);
      }
      if (runData.result.threadsResult?.success) {
        console.log(`Threads 投稿URL: ${runData.result.threadsResult.postUrl}`);
      }
    } else {
      console.error('実行エラー:', runData.error || runData);
    }
  } catch (error) {
    console.error('パイプライン実行中に通信エラーが発生しました:', error.message);
  }
}

// 初回即時実行フラグ（--now が引数にあれば即時実行）
if (process.argv.includes('--now')) {
  runAutoPilot();
} else {
  console.log(`\n======================================================`);
  console.log(`🤖 Amazonアソシエイト SNS完全自動巡回スケジューラー 起動`);
  console.log(`- 監視インターバル: ${CHECK_INTERVAL_MINUTES} 分ごと`);
  console.log(`- 水曜・金曜・日曜 (20:00〜23:00): 🔥 高単価アソシエイトURL＋#PR投下`);
  console.log(`- 上記以外の平日・日中: 🌱 役立つ知恵袋・共感ノウハウ（リンク無・スパム回避）`);
  console.log(`※今すぐテスト実行したい場合は: node run-auto-scheduler.js --now`);
  console.log(`======================================================\n`);
  
  // 定期実行ループ
  setInterval(runAutoPilot, CHECK_INTERVAL_MINUTES * 60 * 1000);
}
