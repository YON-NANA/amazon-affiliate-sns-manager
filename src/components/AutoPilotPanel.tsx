'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Image as ImageIcon,
  Video,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Trash2,
  Lock,
  PackageCheck,
  PauseCircle,
  FileText,
  Globe,
  Tag,
  Eye,
  Check,
} from 'lucide-react';
import {
  AutomatedExecutionResult,
  PostSet,
  PostSetTag,
  ProfileHpSettings,
} from '@/lib/types';

interface StockMediaItem {
  filename: string;
  relativePath: string;
  publicUrl: string;
  mediaType: 'image' | 'video';
  isUsedOrAssigned: boolean;
  assignedSetId?: string;
  assignedSetStatus?: 'unused' | 'used';
}

interface AutoPilotPanelProps {
  trackingId: string;
  onPostSuccess?: () => void;
}

export function AutoPilotPanel({ onPostSuccess }: AutoPilotPanelProps) {
  const [sets, setSets] = useState<PostSet[]>([]);
  const [unusedCount, setUnusedCount] = useState(0);
  const [usedCount, setUsedCount] = useState(0);
  const [mediaCatalog, setMediaCatalog] = useState<StockMediaItem[]>([]);
  const [profileSettings, setProfileSettings] = useState<ProfileHpSettings | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Set creation form states
  const [title, setTitle] = useState('');
  const [selectedMediaFilename, setSelectedMediaFilename] = useState('');
  const [tag, setTag] = useState<PostSetTag>('暮らし・共感');
  const [useSeparateText, setUseSeparateText] = useState(false);
  const [textThreads, setTextThreads] = useState('');
  const [textX, setTextX] = useState('');
  const [isPetConditionVerified, setIsPetConditionVerified] = useState(false);
  const [reviewSourceCitation, setReviewSourceCitation] = useState('');
  const [hasExceptionAffiliateLink, setHasExceptionAffiliateLink] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmittingSet, setIsSubmittingSet] = useState(false);

  // Profile HP URL form states
  const [hpUrlInput, setHpUrlInput] = useState('');
  const [isHpUrlConfirmed, setIsHpUrlConfirmed] = useState(false);
  const [profileBioThreads, setProfileBioThreads] = useState('');
  const [profileBioX, setProfileBioX] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<AutomatedExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [execNotice, setExecNotice] = useState<string | null>(null);

  // Stock list filter tab
  const [stockFilter, setStockFilter] = useState<'unused' | 'used' | 'all'>('unused');

  const fetchSetsData = async () => {
    try {
      const res = await fetch('/api/post-sets');
      const data = await res.json();
      if (data.success) {
        setSets(data.sets || []);
        setUnusedCount(data.unusedCount || 0);
        setUsedCount(data.usedCount || 0);
        setMediaCatalog(data.mediaCatalog || []);
        if (data.profileSettings) {
          setProfileSettings(data.profileSettings);
          setHpUrlInput(data.profileSettings.hpUrl || '');
          setIsHpUrlConfirmed(Boolean(data.profileSettings.isHpUrlConfirmed));
          setProfileBioThreads(data.profileSettings.profileBioThreads || '');
          setProfileBioX(data.profileSettings.profileBioX || '');
        }
      }
    } catch (e) {
      console.warn('Failed to load post sets:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchSetsData();
  }, []);

  // Available (unused/unassigned) media files
  const availableMedia = mediaCatalog.filter(m => !m.isUsedOrAssigned);
  const selectedMediaObj = mediaCatalog.find(m => m.filename === selectedMediaFilename);

  const handleAddSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmittingSet(true);

    try {
      const effectiveTextX = useSeparateText ? textX : textThreads;
      const res = await fetch('/api/post-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          mediaFilename: selectedMediaFilename,
          textThreads,
          textX: effectiveTextX,
          tag,
          isPetConditionVerified: tag === '宿紹介' ? isPetConditionVerified : undefined,
          reviewSourceCitation: tag === '宿紹介' ? reviewSourceCitation : undefined,
          hasExceptionAffiliateLink,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'セットの登録に失敗しました');
      }

      setFormSuccess('本人確認済みセットをストックに登録しました！');
      setTitle('');
      setSelectedMediaFilename('');
      setTextThreads('');
      setTextX('');
      setIsPetConditionVerified(false);
      setReviewSourceCitation('');
      setHasExceptionAffiliateLink(false);
      await fetchSetsData();
    } catch (err: any) {
      setFormError(err.message || 'エラーが発生しました');
    } finally {
      setIsSubmittingSet(false);
    }
  };

  const handleDeleteUnusedSet = async (id: string) => {
    setFormError(null);
    try {
      const res = await fetch(`/api/post-sets?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '削除に失敗しました');
      }
      await fetchSetsData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);

    try {
      const res = await fetch('/api/post-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          hpUrl: hpUrlInput,
          isHpUrlConfirmed,
          profileBioThreads,
          profileBioX,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'プロフィール設定の更新に失敗しました');
      }
      setProfileSettings(data.profileSettings);
      setProfileMsg('プロフィール・HPリンク設定を保存しました！');
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err: any) {
      setProfileErr(err.message);
    }
  };

  const handleRunPlannedPipeline = async (options?: { setId?: string; dryRun?: boolean }) => {
    setIsRunning(true);
    setExecError(null);
    setExecNotice(null);

    try {
      const res = await fetch('/api/pipeline/run-automated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: options?.setId,
          dryRun: Boolean(options?.dryRun),
          platform: 'both',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '実行に失敗しました');
      }

      setLastResult(data.result);
      setExecNotice(data.message);
      await fetchSetsData();
      if (onPostSuccess) onPostSuccess();
    } catch (err: any) {
      setExecError(err.message || '実行中にエラーが発生しました');
    } finally {
      setIsRunning(false);
    }
  };

  const filteredSets = sets.filter(s => {
    if (stockFilter === 'unused') return s.status === 'unused';
    if (stockFilter === 'used') return s.status === 'used';
    return true;
  });

  const nextPlannedSet = sets.find(s => s.status === 'unused') || null;

  return (
    <div className="space-y-6">
      {/* 1. Top Banner: 2026-11-06 改訂版 計画型・セット制 ステータスモニター */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-sm transition-all ${
          unusedCount > 0
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-zinc-50 dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/30'
            : 'border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-zinc-50 dark:border-amber-900/60 dark:from-amber-950/40 dark:via-zinc-900 dark:to-orange-950/30'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>2026-11-06 改訂ルール適用：計画型・セット制</span>
              </span>

              {unusedCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                  <PackageCheck className="h-3.5 w-3.5" />
                  <span>未使用ストック在庫: {unusedCount} セット（1日1回配信可能）</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>未使用ストック在庫: 0 セット（自動スキップ待機中）</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <Lock className="h-3 w-3 text-zinc-500" />
                <span>使用済み（再投稿ロック済）: {usedCount} セット</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
              {unusedCount > 0
                ? `📋 本人確認済みセットから1日1回自動投稿（残り ${unusedCount} 日分）`
                : '⏸️ 未使用セットが0件のため、自動投稿は安全に停止（スキップ）されています'}
            </h2>

            <p className="text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 max-w-3xl">
              投稿は事前に確認した「メディア（写真・動画）＋文章」のセット単位でのみ行います。
              ツール側でメディアと文章を別々に組み合わせたり、似た文章を自動生成して水増ししたり、使用済みセットを使い回すことは一切ありません。
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 shrink-0 sm:w-72">
            <button
              onClick={() => handleRunPlannedPipeline({ dryRun: false })}
              disabled={isRunning || unusedCount === 0}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-md transition disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>セット処理中...</span>
                </>
              ) : unusedCount > 0 ? (
                <>
                  <Send className="h-4 w-4" />
                  <span>次回セットを今すぐ投稿（1件消費）</span>
                </>
              ) : (
                <>
                  <PauseCircle className="h-4 w-4" />
                  <span>未使用セットなし（投稿スキップ）</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleRunPlannedPipeline({ dryRun: true })}
              disabled={isRunning}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <Eye className="h-3.5 w-3.5 text-teal-600" />
              <span>ドライラン検証（SNS投下せず動作・スキップ確認）</span>
            </button>
          </div>
        </div>

        {/* Notices & Errors */}
        {execNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white/90 p-3.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{execNotice}</span>
          </div>
        )}
        {execError && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{execError}</span>
          </div>
        )}
      </div>

      {/* 2. 改訂版ルール（2026-11-06）要点カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
          <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>1. セット制 ＆ 再使用禁止</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            「メディア＋文章」の固定セットのみ使用。一度投稿したセットは「使用済み」となり、同じ文章・同じメディアの再投稿やAI水増し生成は行いません。在庫が尽きたら自動で止まります。
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
          <div className="text-xs font-black text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            <span>2. リンクとプロフィールの扱い</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            本文・リプライにアフィリエイトリンクや楽天ROOMリンクは付けず、導線はプロフィールのHPリンクに一本化。例外的にアフィリエイトリンクを出す場合は先頭に「PR」と明記します。
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
          <div className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Tag className="h-4 w-4" />
            <span>3. 暮らし・共感 ＆ 確認済み宿紹介</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            基本は「暮らし・共感」。宿紹介はペット同伴条件を1軒ずつ確認済みの宿のみとし、感想は「泊まった人の声」として出典が分かる書き方にします（本人が泊まったように書かない）。
          </p>
        </div>
      </div>

      {/* 3. Main Two-Column Area: Set Registration Form + Stock Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Register New Confirmed Set (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
              <span>確認済み投稿セットの追加</span>
            </h3>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              メディア＋文章セット
            </span>
          </div>

          <form onSubmit={handleAddSet} className="space-y-4">
            {/* 分類タグ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                1. 分類タグ（必須）
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['暮らし・共感', '宿紹介', 'その他'] as PostSetTag[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTag(t)}
                    className={`rounded-xl py-2 px-3 text-xs font-bold border transition ${
                      tag === t
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 宿紹介時の必須確認項目 */}
            {tag === '宿紹介' && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30 space-y-3">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  🏨 宿紹介セットの必須確認（ルール5）
                </p>
                <label className="flex items-start gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPetConditionVerified}
                    onChange={e => setIsPetConditionVerified(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold">
                    ペット同伴条件（頭数・体重・同伴可能エリア等）を1軒ずつ確認済みの宿です（※未確認の宿は登録・投稿できません）
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-1">
                    「泊まった人の声」の出典メモ（必須・本人が泊まったように書かない）
                  </label>
                  <input
                    type="text"
                    value={reviewSourceCitation}
                    onChange={e => setReviewSourceCitation(e.target.value)}
                    placeholder="例: 楽天トラベル 宿泊者口コミより / 宿公式レビューより"
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-hidden dark:border-amber-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
            )}

            {/* メディアファイル選択 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  2. メディアファイル（写真または動画・再使用不可）
                </label>
                <span className="text-[11px] text-zinc-500">
                  未使用メディア残り: {availableMedia.length} 件
                </span>
              </div>

              <select
                value={selectedMediaFilename}
                onChange={e => setSelectedMediaFilename(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-xs font-medium focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">-- public/media-stock/ から未使用メディアを選択 --</option>
                {mediaCatalog.map(item => (
                  <option
                    key={item.filename}
                    value={item.filename}
                    disabled={item.isUsedOrAssigned}
                  >
                    {item.isUsedOrAssigned
                      ? `🔒 [${item.assignedSetStatus === 'used' ? '使用済み' : 'セット登録済'}] ${item.filename}`
                      : `${item.mediaType === 'video' ? '🎬' : '📷'} ${item.filename}`}
                  </option>
                ))}
              </select>

              {selectedMediaObj && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
                  {selectedMediaObj.mediaType === 'video' ? (
                    <video
                      src={selectedMediaObj.relativePath}
                      controls
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <img
                      src={selectedMediaObj.relativePath}
                      alt={selectedMediaObj.filename}
                      className="h-44 w-full object-cover"
                    />
                  )}
                  <div className="px-3 py-1.5 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                    <span className="truncate">{selectedMediaObj.filename}</span>
                    <span className="text-emerald-600 font-bold">未使用・選択中</span>
                  </div>
                </div>
              )}
            </div>

            {/* 管理用メモ・タイトル（任意） */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                セット管理メモ・見出し（任意）
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例: 窓辺でひなたぼっこする猫の日常 / 那須〇〇ホテル紹介"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* 投稿文（Threads用 / X用） */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  3. 投稿文（本人確認済みテキスト）
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSeparateText}
                    onChange={e => setUseSeparateText(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600"
                  />
                  <span>Threads用とX用で文面を分ける</span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                  <span>{useSeparateText ? '🧵 Threads用 投稿文（500文字以内）' : '🧵 / 𝕏 共通投稿文（X向けに140文字以内推奨）'}</span>
                  <span className={textThreads.length > (useSeparateText ? 500 : 140) ? 'text-rose-600 font-bold' : 'font-mono'}>
                    {textThreads.length} 文字
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={textThreads}
                  onChange={e => setTextThreads(e.target.value)}
                  placeholder={
                    tag === '宿紹介'
                      ? '例: 【泊まった人の声（出典：楽天トラベル口コミより）】\n「大型犬と一緒に部屋食ができて、ドッグランも広くて安心でした」との声が寄せられている宿です🐾'
                      : '例: 窓から差し込むぽかぽかの陽だまりの中で、気持ちよさそうに目を細めてうとうとする午後。こういう何気ない時間がいちばんの癒やしですね🐾'
                  }
                  className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs leading-relaxed focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {useSeparateText && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                    <span>𝕏 用 投稿文（140文字以内）</span>
                    <span className={textX.length > 140 ? 'text-rose-600 font-bold' : 'font-mono'}>
                      {textX.length} 文字
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={textX}
                    onChange={e => setTextX(e.target.value)}
                    placeholder="X（旧Twitter）用の投稿文を入力してください..."
                    className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs leading-relaxed focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              )}
            </div>

            {/* 例外的なアフィリエイトリンク設定（ルール3） */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950 space-y-2">
              <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasExceptionAffiliateLink}
                  onChange={e => {
                    const checked = e.target.checked;
                    setHasExceptionAffiliateLink(checked);
                    if (checked && textThreads && !/^(PR|【PR】)/i.test(textThreads.trim())) {
                      setTextThreads(`PR\n${textThreads}`);
                    }
                    if (checked && useSeparateText && textX && !/^(PR|【PR】)/i.test(textX.trim())) {
                      setTextX(`PR\n${textX}`);
                    }
                  }}
                  className="rounded border-zinc-300 text-emerald-600"
                />
                <span className="font-semibold">
                  例外的にアフィリエイトリンクを含む投稿として出す（先頭に「PR」明記必須）
                </span>
              </label>
              <p className="text-[11px] text-zinc-500">
                ※通常は本文・リプライにアフィリエイトリンクや楽天ROOMリンクを付けず、プロフィールのHPリンクに一本化します。楽天ROOMリンクは例外でも使用不可です。
              </p>
            </div>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                {formSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingSet}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 py-3 text-xs font-black text-white shadow-sm transition dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <PlusCircle className="h-4 w-4" />
              <span>この内容で確認済みセットをストックに登録する</span>
            </button>
          </form>
        </div>

        {/* Right: Stock Sets List (Unused Queue & Used History) (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
                <FileText className="h-5 w-5 text-teal-600" />
                <span>投稿セットのストック一覧（計画順）</span>
              </h3>
              <p className="text-xs text-zinc-500">
                上から順番に1日1セットずつ自動投稿されます。一度投稿されたセットは「使用済み」となり再投稿されません。
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-bold dark:bg-zinc-800">
              <button
                onClick={() => setStockFilter('unused')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  stockFilter === 'unused'
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                    : 'text-zinc-500'
                }`}
              >
                未使用 ({unusedCount})
              </button>
              <button
                onClick={() => setStockFilter('used')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  stockFilter === 'used'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500'
                }`}
              >
                使用済み ({usedCount})
              </button>
              <button
                onClick={() => setStockFilter('all')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  stockFilter === 'all'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500'
                }`}
              >
                すべて ({sets.length})
              </button>
            </div>
          </div>

          {isLoadingData ? (
            <div className="py-12 text-center text-xs text-zinc-400">セット一覧を読み込み中...</div>
          ) : filteredSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center space-y-2 dark:border-zinc-700">
              <PauseCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {stockFilter === 'unused'
                  ? '現在、未使用の投稿セットはありません（在庫 0件）'
                  : '該当する投稿セットはありません'}
              </p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                左のフォームから本人確認済みの「メディア＋文章」セットを登録してください。未使用セットが無い日は、使い回しや自動生成を行わず投稿をスキップします。
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {filteredSets.map(item => {
                const isNext = nextPlannedSet?.id === item.id && item.status === 'unused';
                const mediaPath = `/media-stock/${encodeURIComponent(item.mediaFilename)}`;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition ${
                      item.status === 'used'
                        ? 'border-zinc-200 bg-zinc-50/70 opacity-80 dark:border-zinc-800 dark:bg-zinc-950/50'
                        : isNext
                        ? 'border-emerald-400 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20'
                        : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Media Thumbnail */}
                      <div className="w-full sm:w-36 h-28 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 relative">
                        {item.mediaType === 'video' ? (
                          <video src={mediaPath} className="h-full w-full object-cover" />
                        ) : (
                          <img
                            src={mediaPath}
                            alt={item.mediaFilename}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white flex items-center gap-1 max-w-[92%] truncate">
                          {item.mediaType === 'video' ? (
                            <Video className="h-2.5 w-2.5 shrink-0" />
                          ) : (
                            <ImageIcon className="h-2.5 w-2.5 shrink-0" />
                          )}
                          <span className="truncate">{item.mediaFilename}</span>
                        </span>
                      </div>

                      {/* Content & Metadata */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isNext && (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                                次回配信予定
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                item.status === 'unused'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              {item.status === 'unused' ? '● 未使用' : '🔒 使用済み（再投稿不可）'}
                            </span>
                            <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                              {item.tag}
                            </span>
                            {item.tag === '宿紹介' && item.isPetConditionVerified && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                ✓ ペット同伴条件確認済
                              </span>
                            )}
                          </div>

                          {item.publishedAt && (
                            <span className="text-[11px] font-mono text-zinc-500">
                              投稿日時: {new Date(item.publishedAt).toLocaleString('ja-JP')}
                            </span>
                          )}
                        </div>

                        {item.title && (
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {item.title}
                          </p>
                        )}

                        {item.tag === '宿紹介' && item.reviewSourceCitation && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            出典（泊まった人の声）: {item.reviewSourceCitation}
                          </p>
                        )}

                        <div className="rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-800 whitespace-pre-wrap dark:bg-zinc-950 dark:text-zinc-200">
                          {item.textThreads}
                        </div>

                        {item.textX !== item.textThreads && (
                          <div className="rounded-xl bg-zinc-100/80 p-2.5 text-xs text-zinc-700 whitespace-pre-wrap dark:bg-zinc-900 dark:text-zinc-300">
                            <span className="block text-[10px] font-bold text-zinc-500 mb-0.5">
                              【X用文面】
                            </span>
                            {item.textX}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            {item.xPostUrl && (
                              <a
                                href={item.xPostUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                <span>𝕏 投稿を確認</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {item.threadsPostUrl && (
                              <a
                                href={item.threadsPostUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-600 hover:underline"
                              >
                                <span>Threads 投稿を確認</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>

                          {item.status === 'unused' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRunPlannedPipeline({ setId: item.id, dryRun: false })}
                                disabled={isRunning}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white transition"
                              >
                                このセットを今すぐ投稿
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUnusedSet(item.id)}
                                className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 p-1 text-red-600 transition dark:border-red-900/50 dark:bg-red-950/40"
                                title="未使用セットを削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. プロフィール・HPリンク一本化管理（ルール3・4対応） */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
              <Globe className="h-5 w-5 text-indigo-600" />
              <span>プロフィール ＆ HP導線設定（ルール3・4対応）</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              導線はプロフィールのHPリンクに一本化し、プロフィール文から「アフィリエイトしてます」の表記を外します（広告表記はリンクのあるHP側に設置）。
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              profileSettings?.isHpUrlConfirmed
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {profileSettings?.isHpUrlConfirmed ? '✓ HP URL確定済' : '※ HPのURL未定（仮置き中・確定後に差し替え）'}
          </span>
        </div>

        <form onSubmit={handleSaveProfileSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Threads／X プロフィール用 HPリンク（※URL確定後に差し替え）
              </label>
              <input
                type="text"
                value={hpUrlInput}
                onChange={e => setHpUrlInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isHpUrlConfirmed}
                onChange={e => setIsHpUrlConfirmed(e.target.checked)}
                className="rounded border-zinc-300 text-indigo-600"
              />
              <span>HPのURL確定済みとしてマーク</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Threads プロフィール文（「アフィリエイトしてます」表記なし）
              </label>
              <textarea
                rows={3}
                value={profileBioThreads}
                onChange={e => setProfileBioThreads(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs focus:border-indigo-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                X プロフィール文（「アフィリエイトしてます」表記なし）
              </label>
              <textarea
                rows={3}
                value={profileBioX}
                onChange={e => setProfileBioX(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs focus:border-indigo-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {profileErr && (
            <p className="text-xs font-bold text-red-600">{profileErr}</p>
          )}
          {profileMsg && (
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="h-4 w-4" />
              <span>{profileMsg}</span>
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              ※対象外事項：ヨンナナのInstagram・リールでのHP紹介は別途運用。楽天ROOMは単独運用としHP・SNSからリンクしません。
            </span>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition"
            >
              プロフィール・HP設定を保存
            </button>
          </div>
        </form>
      </div>

      {/* Latest Execution Result */}
      {lastResult && (
        <div className="rounded-3xl border border-emerald-300 bg-white p-6 shadow-sm dark:border-emerald-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>直近のパイプライン実行ログ</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              {new Date(lastResult.executedAt).toLocaleString('ja-JP')}
            </span>
          </div>

          {lastResult.skipped ? (
            <div className="rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              ⏸️ スキップ完了: {lastResult.skipReason}
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-50 p-4 text-xs space-y-2 dark:bg-zinc-950">
              <div className="font-bold text-zinc-900 dark:text-white">
                配信セット: {lastResult.topicTitle}（残り未使用ストック: {lastResult.remainingUnusedCount}件）
              </div>
              <div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {lastResult.content}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
