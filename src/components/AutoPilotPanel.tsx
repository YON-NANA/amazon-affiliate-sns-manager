'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Image as ImageIcon,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Sliders,
  DollarSign,
  Star,
  Play,
  Layers,
  ChevronRight,
  Flame,
  Sprout,
} from 'lucide-react';
import { AutomatedExecutionResult, CandidateProduct, PipelineMode } from '@/lib/types';

interface AutoPilotPanelProps {
  trackingId: string;
  onPostSuccess?: () => void;
}

export function AutoPilotPanel({ trackingId, onPostSuccess }: AutoPilotPanelProps) {
  // Mode Info State
  const [modeInfo, setModeInfo] = useState<{
    mode: PipelineMode;
    reason: string;
    isHarvestTime: boolean;
    dayOfWeek: number;
    dayName: string;
    hour: number;
    formattedTime: string;
    nextHarvestWindow: string;
  } | null>(null);

  const [stockMedia, setStockMedia] = useState<{
    filename: string;
    relativePath: string;
  } | null>(null);

  // Settings & Controls
  const [forceMode, setForceMode] = useState<'auto' | 'harvest' | 'nurture'>('auto');
  const [genre, setGenre] = useState<'random' | 'life' | 'pet'>('random');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');

  // Results & History
  const [lastResult, setLastResult] = useState<AutomatedExecutionResult | null>(null);
  const [highPriceStats, setHighPriceStats] = useState<any>(null);
  const [executionLogs, setExecutionLogs] = useState<AutomatedExecutionResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto Timer switch
  const [isAutoTimerEnabled, setIsAutoTimerEnabled] = useState(false);
  const [timerIntervalHours, setTimerIntervalHours] = useState(4);
  const [nextRunCountdown, setNextRunCountdown] = useState<string>('未待機');

  // Load Status on mount
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/pipeline/run-automated');
      const data = await res.json();
      if (data.success && data.modeInfo) {
        setModeInfo(data.modeInfo);
        setStockMedia(data.stockMedia);
      }
    } catch (e) {
      console.warn('Failed to fetch pipeline status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30秒ごとに時刻・モード更新
    return () => clearInterval(interval);
  }, []);

  // Run Pipeline Handler
  const handleRunPipeline = async (overrideMode?: 'harvest' | 'nurture') => {
    setIsRunning(true);
    setErrorMsg(null);
    setCurrentStep(1);
    setStepMessage('1/4: システム日時から投稿モードを判定中...');

    try {
      await new Promise(r => setTimeout(r, 600));

      const effectiveForceMode = overrideMode || (forceMode === 'auto' ? undefined : forceMode);

      setCurrentStep(2);
      setStepMessage(
        effectiveForceMode === 'harvest' || (effectiveForceMode === undefined && modeInfo?.mode === 'harvest')
          ? '2/4: Amazon売れ筋上位10件を取得 ➔ ★4.0未満を除外 ➔ 最も高単価な商品を自動選定中...'
          : '2/4: アカウント健全性維持：URL無しの有益知恵袋・共感ノウハウを生成中...'
      );

      const effectiveGenre = genre === 'random' ? undefined : genre;

      const res = await fetch('/api/pipeline/run-automated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceMode: effectiveForceMode,
          genre: effectiveGenre,
          dryRun: false, // 実際に投下
        }),
      });

      setCurrentStep(3);
      setStepMessage('3/4: 写真ストックフォルダから最適な画像をランダム選定中...');
      await new Promise(r => setTimeout(r, 700));

      setCurrentStep(4);
      setStepMessage(
        effectiveForceMode === 'harvest' || (effectiveForceMode === undefined && modeInfo?.mode === 'harvest')
          ? '4/4: X (Twitter) および Threads へ画像付きで直接訴求投稿を投下中...'
          : '4/4: メイン投稿を投下後、自動でリプライ欄へアフィリエイトリンクをぶら下げ中...'
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'パイプライン実行に失敗しました');
      }

      setLastResult(data.result);
      setHighPriceStats(data.highPriceStats);
      setExecutionLogs(prev => [data.result, ...prev]);

      if (onPostSuccess) onPostSuccess();
      fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || '予期せぬエラーが発生しました');
    } finally {
      setIsRunning(false);
      setCurrentStep(0);
      setStepMessage('');
    }
  };

  const isHarvestActive = modeInfo?.mode === 'harvest';

  return (
    <div className="space-y-6">
      {/* Top Banner: Real-time Mode Monitor */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-sm transition-all ${
        isHarvestActive
          ? 'border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 dark:border-rose-900/60 dark:from-rose-950/40 dark:via-zinc-900 dark:to-orange-950/30'
          : 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-zinc-50 dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/30'
      }`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                isHarvestActive
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
              }`}>
                {isHarvestActive ? (
                  <>
                    <Flame className="h-3.5 w-3.5 animate-bounce" />
                    <span>刈り取りモード稼働中</span>
                  </>
                ) : (
                  <>
                    <Sprout className="h-3.5 w-3.5" />
                    <span>育成モード稼働中</span>
                  </>
                )}
              </span>

              <span className="flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-mono font-semibold text-zinc-700 shadow-xs dark:bg-zinc-800/80 dark:text-zinc-300 backdrop-blur-xs">
                <Clock className="h-3 w-3 text-zinc-500" />
                現在時刻: {modeInfo?.formattedTime || '取得中...'}
              </span>

              <span className="flex items-center gap-1 rounded-full bg-blue-100/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                <ShieldCheck className="h-3 w-3 text-blue-600" />
                スパム判定・凍結リスク完全ゼロ
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
              {isHarvestActive
                ? '🔥 水・金・日 夜間ゴールデンタイム：高単価商品 集中投下'
                : '🌱 平日・日中：お役立ち知恵袋・共感ノウハウでフォロワー急増'}
            </h2>

            <p className="text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 max-w-3xl">
              {modeInfo?.reason || '日時判定エンジンが自動でモードを切り替え、最適な記事・商品・画像を自動選定します。'}
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>次回スケジュール: </span>
              <span className="text-zinc-900 dark:text-zinc-100 font-bold">{modeInfo?.nextHarvestWindow}</span>
            </div>
          </div>

          {/* Big Action Button */}
          <div className="flex flex-col gap-2 shrink-0 sm:w-64">
            <button
              onClick={() => handleRunPipeline()}
              disabled={isRunning}
              className={`group relative flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                isHarvestActive
                  ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 shadow-rose-500/25'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-emerald-500/25'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>完全自動実行中...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 text-yellow-300 animate-pulse" />
                  <span>今すぐ完全自動実行</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-zinc-500 dark:text-zinc-400">
              手動作業ゼロで記事選定〜写真添付〜SNS投下まで完了
            </p>
          </div>
        </div>

        {/* Step-by-Step Execution Progress Bar */}
        {isRunning && (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-white/95 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-zinc-900/95">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>{stepMessage}</span>
              </span>
              <span>{currentStep}/4 ステップ</span>
            </div>
            {/* Progress bar line */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notification if any */}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Control Grid: Settings, Override, Stock Media Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pipeline Execution Controls */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white">
              <Sliders className="h-4 w-4 text-emerald-600" />
              <span>自動化パイプライン設定</span>
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono">v2.0 Auto</span>
          </div>

          {/* Mode Override Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              動作モード切り替え
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 text-xs font-semibold">
              <button
                onClick={() => setForceMode('auto')}
                className={`rounded-lg py-1.5 transition ${
                  forceMode === 'auto'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                自動判定（推奨）
              </button>
              <button
                onClick={() => setForceMode('harvest')}
                className={`rounded-lg py-1.5 transition ${
                  forceMode === 'harvest'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-rose-600'
                }`}
              >
                強制: 刈り取り
              </button>
              <button
                onClick={() => setForceMode('nurture')}
                className={`rounded-lg py-1.5 transition ${
                  forceMode === 'nurture'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-emerald-600'
                }`}
              >
                強制: 育成
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              ※通常は「自動判定」にしておくだけで、曜日・時間に合わせて完全自動で切り替わります。
            </p>
          </div>

          {/* Genre Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              対象ジャンル
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 text-xs font-semibold">
              <button
                onClick={() => setGenre('random')}
                className={`rounded-lg py-1.5 transition ${
                  genre === 'random'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500'
                }`}
              >
                自動・交互
              </button>
              <button
                onClick={() => setGenre('life')}
                className={`rounded-lg py-1.5 transition ${
                  genre === 'life'
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                    : 'text-zinc-500'
                }`}
              >
                🌿 暮らし
              </button>
              <button
                onClick={() => setGenre('pet')}
                className={`rounded-lg py-1.5 transition ${
                  genre === 'pet'
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                    : 'text-zinc-500'
                }`}
              >
                🐾 ペット
              </button>
            </div>
          </div>

          {/* Quick Trigger Buttons */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800 space-y-2">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">個別テスト実行</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRunPipeline('harvest')}
                disabled={isRunning}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50/80 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>刈り取りをテスト</span>
              </button>
              <button
                onClick={() => handleRunPipeline('nurture')}
                disabled={isRunning}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/80 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>育成をテスト</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Column: Photo Stock Folder & Random Media Selection */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white">
              <ImageIcon className="h-4 w-4 text-teal-600" />
              <span>写真ストック自動添付</span>
            </h3>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              常時有効
            </span>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
            指定フォルダ内の画像から、投稿ごとにランダムで1枚選定してXおよびThreadsへ自動添付します。
          </p>

          {/* Directory location box */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs font-mono text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="truncate">public/media-stock/</span>
          </div>

          {/* Current selected image preview */}
          {stockMedia ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
              <img
                src={stockMedia.relativePath}
                alt="Selected Stock"
                className="h-full w-full object-cover transition hover:scale-105"
              />
              <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-xs flex items-center justify-between">
                <span className="truncate">次回候補: {stockMedia.filename}</span>
                <span className="shrink-0 text-emerald-300 font-bold">自動添付OK</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-400">
              画像ファイルを読み込み中...
            </div>
          )}

          <p className="text-[11px] text-zinc-400">
            ※PC内の写真フォルダに画像（.jpg / .png）を追加するだけで、次回投稿から自動的に候補に含まれます。
          </p>
        </div>

        {/* Right Column: High-Price Product Selection Specs */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white">
              <DollarSign className="h-4 w-4 text-amber-600" />
              <span>高単価自動選定アルゴリズム</span>
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              刈り取り時
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                1
              </span>
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200">売れ筋上位10件取得</p>
                <p className="text-zinc-500">キーワードに関連するAmazon人気候補を自動抽出</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-800">
                2
              </span>
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200">★4.0未満を完全除外</p>
                <p className="text-zinc-500">クレームや低評価の低品質商品を足切りフィルタ</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
                3
              </span>
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200">最高単価の1品を自動選定</p>
                <p className="text-zinc-500">最も紹介料インパクトが大きい高額商品を決定</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-800">
                4
              </span>
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200">URL ＋ #PR を自動結合</p>
                <p className="text-zinc-500">アソシエイトURLと法令遵守のPRタグを自然に配置</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Result Showcase (If just executed) */}
      {lastResult && (
        <div className="rounded-3xl border border-emerald-300 bg-white p-6 shadow-md dark:border-emerald-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 animate-bounce" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                最新の自動投下結果（手放し完了）
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                lastResult.mode === 'harvest'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {lastResult.mode === 'harvest' ? '🔥 刈り取り投稿' : '🌱 育成投稿（リンク無）'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {lastResult.xResult?.success && lastResult.xResult.postUrl && (
                <a
                  href={lastResult.xResult.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <span>𝕏 で投稿を見る</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {lastResult.threadsResult?.success && lastResult.threadsResult.postUrl && (
                <a
                  href={lastResult.threadsResult.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-xl border border-pink-300 bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-700 hover:bg-pink-100 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-300"
                >
                  <span>Threads で投稿を見る</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* High Price Selection Info (If Harvest) */}
          {lastResult.selectedProduct && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                  <span>自動選定された最高単価商品</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ★{lastResult.selectedProduct.rating} / ¥{lastResult.selectedProduct.price.toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                {lastResult.selectedProduct.name}
              </p>
              {highPriceStats?.selectionReason && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {highPriceStats.selectionReason}
                </p>
              )}
            </div>
          )}

          {/* Content & Media Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 rounded-2xl bg-zinc-50 p-4 text-xs sm:text-sm leading-relaxed text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 whitespace-pre-wrap font-sans">
              <div className="text-[11px] font-bold text-zinc-400 mb-1">【メイン投稿】</div>
              {lastResult.content}
            </div>

            {lastResult.attachedMedia && (
              <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
                <img
                  src={lastResult.attachedMedia.publicUrl}
                  alt="Attached Media"
                  className="h-40 w-full object-cover"
                />
                <div className="p-2 text-[11px] text-zinc-500 text-center font-mono truncate">
                  添付メディア: {lastResult.attachedMedia.filename}
                </div>
              </div>
            )}
          </div>

          {/* Reply Tree Showcase (If Pattern B or reply exists) */}
          {lastResult.replyText && (lastResult.xResult?.replyPostId || lastResult.threadsResult?.replyPostId || lastResult.isNoLink) && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-4 dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-purple-950/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-black">↳</span>
                  <span className="font-bold">自動ぶら下げリプライ（ツリー返信：カタログ・アフィリエイト導線）</span>
                </span>
                <div className="flex items-center gap-2">
                  {lastResult.xResult?.replyPostId && (
                    <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      𝕏 リプライ投稿済
                    </span>
                  )}
                  {lastResult.threadsResult?.replyPostId && (
                    <span className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      Threads リプライ投稿済
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-white/90 p-3 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-200 whitespace-pre-wrap font-sans border border-indigo-100 dark:border-indigo-900/40">
                {lastResult.replyText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
