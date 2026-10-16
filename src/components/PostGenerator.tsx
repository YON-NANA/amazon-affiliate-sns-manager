'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
  Calendar,
  Share2,
  Clock,
  AlertCircle,
  Home,
  HeartPulse,
  Send,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Tag,
  BookmarkPlus
} from 'lucide-react';
import { parseAmazonInput, generateAffiliateUrl } from '@/lib/amazon';
import { CATEGORIES } from '@/lib/presets';
import { CategoryId, GeneratedVariation, PlatformId, Post, ProductPreset, ToneId } from '@/lib/types';
import confetti from 'canvas-confetti';

interface PostGeneratorProps {
  trackingId: string;
  onSavePost: (post: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => Promise<Post>;
  onScheduledSuccess?: () => void;
  presetToLoad?: ProductPreset | null;
  onClearPreset?: () => void;
}

const TARGET_PRESETS_LIFE = [
  '共働き・子育て世帯',
  '一人暮らし・自炊派',
  '掃除の手間を減らしたい人',
  'キッチンが狭くて悩む人',
  'QOLを上げたいミニマリスト',
];

const TARGET_PRESETS_PET = [
  '猫の爪とぎ被害に悩む飼い主',
  '愛猫の水分補給が心配な人',
  '犬の留守番中のいたずら対策',
  '部屋の抜け毛・換毛期に悩む人',
  'ペットのニオイを消したい人',
];

export function PostGenerator({
  trackingId,
  onSavePost,
  onScheduledSuccess,
  presetToLoad,
  onClearPreset,
}: PostGeneratorProps) {
  // Input states
  const [urlInput, setUrlInput] = useState('');
  const [detectedAsin, setDetectedAsin] = useState<string | null>(null);
  const [affiliateLink, setAffiliateLink] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<'life' | 'pet'>('life');
  const [category, setCategory] = useState<CategoryId>('kitchen');
  const [targetAudience, setTargetAudience] = useState('');
  const [benefits, setBenefits] = useState<string[]>(['']);
  const [platform, setPlatform] = useState<PlatformId>('x');
  const [customNotes, setCustomNotes] = useState('');

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<GeneratedVariation[]>([]);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [editedContent, setEditedContent] = useState('');
  const [generationSource, setGenerationSource] = useState<string>('');

  // Feedback states
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Scheduling states
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Handle URL change
  useEffect(() => {
    if (!urlInput.trim()) {
      setDetectedAsin(null);
      setAffiliateLink('');
      return;
    }
    const result = parseAmazonInput(urlInput, trackingId);
    if (result.isValid && result.asin) {
      setDetectedAsin(result.asin);
      setAffiliateLink(result.affiliateUrl || '');
    } else {
      setDetectedAsin(null);
      setAffiliateLink('');
    }
  }, [urlInput, trackingId]);

  // Load preset if provided
  useEffect(() => {
    if (presetToLoad) {
      setUrlInput(`https://www.amazon.co.jp/dp/${presetToLoad.asin}`);
      setTitle(presetToLoad.title);
      setGenre(presetToLoad.genre);
      setCategory(presetToLoad.category);
      setTargetAudience(presetToLoad.targetAudience);
      setBenefits(presetToLoad.benefits);
      if (onClearPreset) onClearPreset();
    }
  }, [presetToLoad, onClearPreset]);

  // Sync editedContent when active variation changes
  useEffect(() => {
    if (variations[activeVariationIndex]) {
      setEditedContent(variations[activeVariationIndex].content);
    }
  }, [activeVariationIndex, variations]);

  // Add benefit field
  const addBenefitField = () => {
    setBenefits([...benefits, '']);
  };

  const updateBenefit = (index: number, val: string) => {
    const updated = [...benefits];
    updated[index] = val;
    setBenefits(updated);
  };

  const removeBenefit = (index: number) => {
    const updated = benefits.filter((_, i) => i !== index);
    setBenefits(updated.length ? updated : ['']);
  };

  // Generate with AI
  const handleGenerate = async () => {
    if (!title.trim()) {
      setStatusMessage('商品名を入力してください。');
      return;
    }
    const effectiveAsin = detectedAsin || 'B0SAMPLE10';
    const effectiveAffiliateUrl = affiliateLink || generateAffiliateUrl(effectiveAsin, trackingId);

    setIsGenerating(true);
    setStatusMessage(null);

    try {
      const filteredBenefits = benefits.filter(b => b.trim().length > 0);
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asin: effectiveAsin,
          title: title.trim(),
          category,
          genre,
          targetAudience: targetAudience.trim(),
          affiliateUrl: effectiveAffiliateUrl,
          platform,
          benefits: filteredBenefits,
          customNotes: customNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '生成に失敗しました');
      }

      if (data.variations && data.variations.length > 0) {
        setVariations(data.variations);
        setActiveVariationIndex(0);
        setEditedContent(data.variations[0].content);
        setGenerationSource(data.source || 'gemini');
        
        try {
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
        } catch {
          // ignore
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成中にエラーが発生しました';
      setStatusMessage(`エラー: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!editedContent) return;
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Quick schedule recommendation times
  const setQuickSchedule = (hoursAhead: number) => {
    const target = new Date();
    target.setHours(target.getHours() + hoursAhead);
    target.setMinutes(0);
    // Format to datetime-local string (YYYY-MM-DDTHH:mm)
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(localIso);
  };

  const setRecommendedTime = (hour: number, minute: number) => {
    const target = new Date();
    // If target hour is already passed today, schedule for tomorrow
    if (target.getHours() > hour || (target.getHours() === hour && target.getMinutes() >= minute)) {
      target.setDate(target.getDate() + 1);
    }
    target.setHours(hour, minute, 0, 0);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(localIso);
  };

  // Save post with status
  const handleSaveWithStatus = async (status: 'draft' | 'pending' | 'scheduled' | 'published') => {
    if (!editedContent.trim()) {
      setStatusMessage('保存する投稿本文がありません。');
      return;
    }

    setIsSaving(true);
    try {
      const effectiveAsin = detectedAsin || 'B0SAMPLE10';
      const effectiveAffiliateUrl = affiliateLink || generateAffiliateUrl(effectiveAsin, trackingId);
      const activeVariation = variations[activeVariationIndex];

      await onSavePost({
        title: title || '無題の商品投稿',
        asin: effectiveAsin,
        amazon_url: urlInput || `https://www.amazon.co.jp/dp/${effectiveAsin}`,
        affiliate_url: effectiveAffiliateUrl,
        category,
        target_audience: targetAudience || 'おすすめ読者',
        platform,
        tone: activeVariation?.tone || 'honest_review',
        content: editedContent,
        key_benefits: benefits.filter(b => b.trim().length > 0),
        status,
        scheduled_at: status === 'scheduled' ? (scheduledDateTime ? new Date(scheduledDateTime).toISOString() : new Date().toISOString()) : null,
        published_at: status === 'published' ? new Date().toISOString() : null,
        tags: activeVariation?.tags || ['Amazonアソシエイト', 'PR'],
        metrics: { clicks: 0, likes: 0, shares: 0 },
        notes: customNotes,
      });

      setStatusMessage(
        status === 'scheduled'
          ? '🎉 予約投稿リストに追加しました！'
          : status === 'published'
          ? '✅ 投稿完了として記録しました！'
          : status === 'pending'
          ? '⏳ 承認待ちリストに保存しました！'
          : '📁 下書き保存しました！'
      );

      if (onScheduledSuccess && (status === 'scheduled' || status === 'pending')) {
        setTimeout(() => {
          onScheduledSuccess();
        }, 1200);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : '保存に失敗しました';
      setStatusMessage(`保存エラー: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Open X (Twitter) or Threads Web Intent
  const handleOpenX = () => {
    const encoded = encodeURIComponent(editedContent);
    window.open(`https://x.com/intent/tweet?text=${encoded}`, '_blank');
  };

  const handleOpenThreads = () => {
    const encoded = encodeURIComponent(editedContent);
    window.open(`https://threads.net/intent/post?text=${encoded}`, '_blank');
  };

  const charCount = editedContent.length;
  const isXOverLimit = platform === 'x' && charCount > 140;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Form & Inputs */}
      <div className="lg:col-span-6 space-y-6">
        {/* Amazon Input Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
              <LinkIcon className="h-4 w-4 text-emerald-600" />
              <span>1. Amazon商品URL または ASIN</span>
            </h2>
            <span className="text-xs text-zinc-500">PA-API未利用でも即時利用可能</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="https://www.amazon.co.jp/dp/B0XXXXXXXX または 10桁ASIN"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:focus:bg-zinc-900"
                />
              </div>

              {/* ASIN & Affiliate URL detection feedback */}
              {detectedAsin ? (
                <div className="mt-2.5 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-2">
                  <div className="space-y-0.5 overflow-hidden">
                    <p className="font-semibold flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                      ASIN検出: <span className="font-mono bg-emerald-200/60 dark:bg-emerald-800/60 px-1 py-0.5 rounded">{detectedAsin}</span>
                    </p>
                    <p className="truncate text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                      リンク: {affiliateLink}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    タグ付与済
                  </span>
                </div>
              ) : urlInput.trim() ? (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  有効なAmazon URL (dp/B0...) または10桁のASINを入力してください
                </p>
              ) : null}
            </div>

            {/* Product Title */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                商品名・アイテム概要 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例: ぶんぶんチョッパー スーパー5 みじん切り器 900ml"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm transition focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Category & Genre Selection */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-emerald-600" />
              <span>2. 特化ジャンル & カテゴリ</span>
            </span>
            <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setGenre('life');
                  setCategory('kitchen');
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  genre === 'life'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-300'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Home className="h-3.5 w-3.5" />
                <span>暮らし・日用品</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGenre('pet');
                  setCategory('pet_cat');
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  genre === 'pet'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-300'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <HeartPulse className="h-3.5 w-3.5" />
                <span>ペット用品</span>
              </button>
            </div>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.filter(c => c.genre === genre).map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left text-xs transition ${
                  category === cat.id
                    ? 'border-emerald-500 bg-emerald-50/60 font-semibold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="font-medium">{cat.name}</span>
                <span className="mt-1 text-[10px] text-zinc-400 line-clamp-1">{cat.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Target Audience & Benefits */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                ターゲット読者層（誰に刺したいか）
              </label>
              <span className="text-[11px] text-zinc-400">クリックでかんたん入力</span>
            </div>
            <input
              type="text"
              placeholder="例: 夕飯の支度を少しでも短縮したい共働き家庭"
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm transition focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {/* Quick target buttons */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(genre === 'pet' ? TARGET_PRESETS_PET : TARGET_PRESETS_LIFE).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTargetAudience(item)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                推しポイント・具体的なベネフィット（箇条書き）
              </label>
              <button
                type="button"
                onClick={addBenefitField}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                + 項目を追加
              </button>
            </div>
            <div className="space-y-2">
              {benefits.map((b, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`推しポイント ${idx + 1} (例: 8秒引くだけでみじん切り完成、丸洗いできる)`}
                    value={b}
                    onChange={e => updateBenefit(idx, e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs transition focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  {benefits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBenefit(idx)}
                      className="px-2 text-xs text-zinc-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Platform selection */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              配信先SNS
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPlatform('x')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition ${
                  platform === 'x'
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <span>𝕏 (140字最適)</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform('threads')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition ${
                  platform === 'threads'
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <span>Threads (共感型)</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform('both')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition ${
                  platform === 'both'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <span>両対応</span>
              </button>
            </div>
          </div>

          {/* Action: Generate button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Geminiが訴求文を生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Geminiで投稿文を生成する（3パターン）</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: AI Output & Semi-automatic Approval / Scheduling */}
      <div className="lg:col-span-6 space-y-6">
        {/* Status banner */}
        {statusMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              閉じる
            </button>
          </div>
        )}

        {/* Generated Result Container */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                3. 生成プレビュー & ワンクリック承認・予約
              </h2>
            </div>
            {generationSource && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {generationSource === 'gemini' ? '✨ Gemini生成' : '⚡ テンプレート生成'}
              </span>
            )}
          </div>

          {variations.length > 0 ? (
            <div className="space-y-4">
              {/* Variation Tabs */}
              <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                {variations.map((v, idx) => (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => setActiveVariationIndex(idx)}
                    className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition ${
                      activeVariationIndex === idx
                        ? 'bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-300'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    {v.toneName || `パターン ${idx + 1}`}
                  </button>
                ))}
              </div>

              {/* Editable Preview Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>投稿本文（直接微調整できます）</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        isXOverLimit ? 'text-red-500 font-bold' : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {charCount} 文字 {platform === 'x' ? '/ 140字' : ''}
                    </span>
                    {isXOverLimit && (
                      <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/60 px-1 py-0.5 rounded">
                        140字超過
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition focus-within:border-emerald-500 focus-within:bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  {/* Mock SNS Header */}
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-[10px] font-bold text-white flex items-center justify-center">
                        {genre === 'pet' ? '🐾' : '🌿'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {genre === 'pet' ? 'ペットと暮らす便利帖' : '日々の暮らし整え帖'}
                        </p>
                        <p className="text-[10px] text-zinc-400">@curated_affiliate</p>
                      </div>
                    </div>
                    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {platform === 'x' ? '𝕏 ポスト' : 'Threads'}
                    </span>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={8}
                    value={editedContent}
                    onChange={e => setEditedContent(e.target.value)}
                    className="w-full resize-y bg-transparent text-sm leading-relaxed text-zinc-900 focus:outline-none dark:text-zinc-100"
                    placeholder="投稿本文がここに表示されます..."
                  />

                  {/* PR Tag Notice */}
                  <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-200/60 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800">
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      規約遵守
                    </span>
                    <span>アフィリエイト広告である旨（#PR）が含まれています</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Quick Copy & Open SNS */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600">コピー完了！</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>本文コピー</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenX}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  <span>𝕏 で開く</span>
                  <ExternalLink className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenThreads}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-100 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  <span>Threads で開く</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              {/* Semi-automatic Scheduling Section */}
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>予約投稿日時の設定（半自動スケジューラー）</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    ベストタイム推奨
                  </span>
                </div>

                {/* Quick Recommendation Hours */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRecommendedTime(7, 30)}
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 shadow-xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
                  >
                    🌅 朝 07:30 (通勤)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecommendedTime(12, 15)}
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 shadow-xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
                  >
                    🍱 昼 12:15 (ランチ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecommendedTime(20, 30)}
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 shadow-xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
                  >
                    🌙 夜 20:30 (ゴールデン)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSchedule(2)}
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 shadow-xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
                  >
                    ⏱ 2時間後
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={e => setScheduledDateTime(e.target.value)}
                    className="flex-1 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveWithStatus('scheduled')}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>予約リストに追加</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveWithStatus('pending')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    <span>承認待ち保存</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveWithStatus('published')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    title="既に投稿した場合は完了マーク"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>投稿済</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                まだ投稿が生成されていません
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-400">
                左側のフォームに商品URLまたはASINを入力し、「Geminiで投稿文を生成する」をクリックしてください。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
