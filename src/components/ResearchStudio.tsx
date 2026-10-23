'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Star,
  MessageSquare,
  TrendingUp,
  Flame,
  ShieldCheck,
  Tent,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Copy,
  Check,
  Send,
  RefreshCw,
  SlidersHorizontal,
  Home,
  Tag,
  Info,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sprout,
  BookmarkCheck,
  FolderGit2
} from 'lucide-react';
import { ResearchProduct, ResearchPreset, Post, CategoryId } from '@/lib/types';
import { RESEARCH_PRESETS } from '@/lib/presets';
import { buildAffiliateReplyText, replaceReplyLinkLine } from '@/lib/reply-builder';
import {
  fetchUserExemplars,
  getRoomUrlForGenre,
  saveCategoryRoomUrls,
  getStorefrontUrlForGenre,
  saveCategoryStorefrontUrls,
  DEFAULT_AMAZON_STOREFRONT_URL
} from '@/lib/supabase';

interface ResearchStudioProps {
  onSavePost: (post: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => Promise<Post>;
  onNavigateToPipeline?: () => void;
  defaultRoomUrl?: string;
  defaultStorefrontUrl?: string;
}

export interface GeneratedVariationItem {
  id: string;
  toneId: string;
  toneName: string;
  badge: string;
  headline: string;
  mainContent: string;
  replyContent: string;
  isNoLink: boolean;
}

type GenreTab = 'pet' | 'camp' | 'disaster';
export type LinkOption = 'amazon_storefront' | 'room' | 'direct_rakuten';

export function ResearchStudio({ onSavePost, onNavigateToPipeline, defaultRoomUrl, defaultStorefrontUrl }: ResearchStudioProps) {
  // State
  const [selectedGenre, setSelectedGenre] = useState<GenreTab>('pet');
  const [keyword, setKeyword] = useState('ペットシーツ 薄型 大容量');
  const [sortOption, setSortOption] = useState('+reviewCount');
  const [products, setProducts] = useState<ResearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  // Selected Product & AI Generation Variations
  const [selectedProduct, setSelectedProduct] = useState<ResearchProduct | null>(null);
  const [linkOption, setLinkOption] = useState<LinkOption>('amazon_storefront');
  const [roomUrl, setRoomUrl] = useState(defaultRoomUrl || 'https://room.rakuten.co.jp/yonnana_pet/items');
  const [storefrontUrl, setStorefrontUrl] = useState(defaultStorefrontUrl || DEFAULT_AMAZON_STOREFRONT_URL);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 複数バリエーション（切り口）を保持し、自由に行き来できるようにする
  const [variations, setVariations] = useState<GeneratedVariationItem[]>([]);
  const [currentVariationIndex, setCurrentVariationIndex] = useState<number>(0);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'main' | 'reply' | null>(null);

  // AI自己育成用のお手本学習件数 & URL個別保存メッセージ
  const [exemplarsCount, setExemplarsCount] = useState<number>(0);
  const [savedCategoryRoomMsg, setSavedCategoryRoomMsg] = useState(false);
  const [savedCategoryStorefrontMsg, setSavedCategoryStorefrontMsg] = useState(false);

  // Initial research, category URLs sync, and user exemplars count on genre switch
  useEffect(() => {
    const presetsForGenre = RESEARCH_PRESETS.filter(p => p.genre === selectedGenre);
    if (presetsForGenre.length > 0) {
      setKeyword(presetsForGenre[0].keyword);
      fetchResearchProducts(presetsForGenre[0].keyword, selectedGenre, sortOption);
    }

    // カテゴリー専用のROOMコレクションURL & AmazonストアフロントURLを自動取得・セット
    const catRoomUrl = getRoomUrlForGenre(selectedGenre);
    setRoomUrl(catRoomUrl);

    const catStorefrontUrl = getStorefrontUrlForGenre(selectedGenre);
    setStorefrontUrl(catStorefrontUrl);

    // このジャンルでユーザーが過去に承認・編集したお手本ポスト件数を取得
    fetchUserExemplars(selectedGenre).then(exs => {
      setExemplarsCount(exs.length);
    });
  }, [selectedGenre]);

  // 現在のカテゴリー専用ROOM URLとして即座に保存
  const handleSaveCurrentGenreRoomUrl = () => {
    if (!roomUrl.trim()) return;
    saveCategoryRoomUrls({
      [selectedGenre]: roomUrl.trim(),
    });
    setSavedCategoryRoomMsg(true);
    setTimeout(() => setSavedCategoryRoomMsg(false), 2000);
  };

  // 現在のカテゴリー専用AmazonストアフロントURLとして即座に保存
  const handleSaveCurrentGenreStorefrontUrl = () => {
    if (!storefrontUrl.trim()) return;
    saveCategoryStorefrontUrls({
      [selectedGenre]: storefrontUrl.trim(),
    });
    setSavedCategoryStorefrontMsg(true);
    setTimeout(() => setSavedCategoryStorefrontMsg(false), 2000);
  };

  // Fetch products from Rakuten Search API route
  const fetchResearchProducts = async (searchKw: string, genre: GenreTab, sort: string) => {
    setIsLoading(true);
    setSearchNotice(null);
    try {
      const storedAppId = typeof window !== 'undefined' ? localStorage.getItem('rakuten_app_id') || '' : '';
      const storedAffId = typeof window !== 'undefined' ? localStorage.getItem('rakuten_affiliate_id') || '' : '';

      const res = await fetch('/api/research/rakuten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKw,
          genre,
          sort,
          applicationId: storedAppId || undefined,
          affiliateId: storedAffId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
        setIsSimulated(!!data.isSimulated);
        if (data.notice) {
          setSearchNotice(data.notice);
        }
      } else {
        console.warn('API error:', data.error);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    fetchResearchProducts(keyword, selectedGenre, sortOption);
  };

  const handleSelectPreset = (preset: ResearchPreset) => {
    setKeyword(preset.keyword);
    fetchResearchProducts(preset.keyword, selectedGenre, sortOption);
  };

  // ワンタップでリンク形式（Amazonストアフロント / 楽天ROOM / 楽天直リンク）を切り替え
  const handleSwitchLinkOption = (newOption: LinkOption) => {
    setLinkOption(newOption);
    let targetUrl = '';
    if (newOption === 'amazon_storefront') {
      targetUrl = storefrontUrl.trim() || DEFAULT_AMAZON_STOREFRONT_URL;
    } else if (newOption === 'room') {
      targetUrl = roomUrl.trim();
    } else {
      targetUrl = selectedProduct?.affiliateUrl || selectedProduct?.itemUrl || '';
    }

    // 既に生成済みの全バリエーションのリプライ本文内のリンクを即座に置換（再生成待ち不要）
    setVariations(prev =>
      prev.map(v => ({
        ...v,
        replyContent: replaceReplyLinkLine(v.replyContent, newOption, targetUrl),
      }))
    );
  };

  // Trigger AI Post Generation for Selected Product
  const handleOpenAiGenerator = async (prod: ResearchProduct, overrideLinkOption?: LinkOption) => {
    setSelectedProduct(prod);
    setSaveSuccessMsg(null);
    setIsGenerating(true);

    const activeLinkOpt = overrideLinkOption || linkOption;
    let targetLink = '';
    if (activeLinkOpt === 'amazon_storefront') {
      targetLink = storefrontUrl.trim() || DEFAULT_AMAZON_STOREFRONT_URL;
    } else if (activeLinkOpt === 'room') {
      targetLink = roomUrl.trim();
    } else {
      targetLink = prod.affiliateUrl || prod.itemUrl;
    }

    try {
      // 直近のユーザー手動編集・確定ポストをお手本（Few-Shot学習用）として取得
      const userExemplars = await fetchUserExemplars(prod.genre as any, 4);
      setExemplarsCount(userExemplars.length);

      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asin: prod.itemId,
          title: prod.title,
          category: prod.category,
          genre: prod.genre === 'camp' ? 'life' : (prod.genre as any),
          affiliateUrl: targetLink,
          platform: 'both',
          benefits: [
            `★${prod.reviewAverage}（レビュー${prod.reviewCount.toLocaleString()}件の圧倒的評価）`,
            prod.caption?.slice(0, 80) || '売れ筋・高評価アイテム',
            `${prod.price.toLocaleString()}円 ${prod.postageFlag === 1 ? '送料無料' : ''}`,
          ],
          includeNoLinkPost: true,
          targetMode: 'pattern_b_all',
          userExemplars,
        }),
      });

      const data = await res.json();
      if (res.ok && data.variations && data.variations.length > 0) {
        const fallbackReply = buildAffiliateReplyText({
          productName: prod.title,
          reviewText: prod.caption?.slice(0, 100) || `★${prod.reviewAverage} (${prod.reviewCount.toLocaleString()}件レビュー)。使い勝手・耐久性ともに抜群で日々のストレスが激減します。`,
          affiliateUrl: targetLink,
          amazonStorefront: storefrontUrl.trim() || DEFAULT_AMAZON_STOREFRONT_URL,
          rakutenRoom: roomUrl.trim(),
          targetMode: activeLinkOpt,
        });

        const mapped: GeneratedVariationItem[] = data.variations.map((v: any, idx: number) => {
          let badge = '💡 お悩み解決';
          if (v.isNoLink || v.tone === 'no_link_tips') {
            badge = '🐾 下僕エピソード';
          } else if (idx === 1 || v.tone === 'honest_review') {
            badge = '⭐ 本音レビュー';
          } else if (idx === 2 || v.tone === 'empathy_story') {
            badge = '🐱 クセ・やらかし';
          }

          // 本文からリンク行・商品スペック・宣伝文を完全分離して、純粋な共感文に整形（パターンBとしてリプライに集約）
          let cleanContent = (v.content || '').trim();
          cleanContent = cleanContent
            .replace(/👇[^\n]*\n?/g, '')
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/#PR\s*/g, '')
            .replace(/★\s*\d+(\.\d+)?(\s*（[^）]+）)?/g, '')
            .replace(/レビュー\s*[\d,]+件[^\n]*\n?/g, '')
            .replace(/【商品名】[^\n]*\n?/g, '')
            .replace(/【[^】]*スペック[^】]*】[^\n]*\n?/g, '')
            .replace(/（※[^\n]*）/g, '')
            .trim();

          return {
            id: v.id || `var_${idx + 1}`,
            toneId: v.tone || `tone_${idx + 1}`,
            toneName: v.toneName || `案${idx + 1}`,
            badge,
            headline: v.headline || prod.title.slice(0, 25),
            mainContent: cleanContent,
            replyContent: v.replyContent || fallbackReply,
            isNoLink: true,
          };
        });

        setVariations(mapped);
        // パターンB（下僕エピソード）があればそれを初期選択、なければ0番目
        const defaultIdx = mapped.findIndex(m => m.badge.includes('下僕'));
        setCurrentVariationIndex(defaultIdx >= 0 ? defaultIdx : 0);
      }
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextVariation = () => {
    if (variations.length === 0) return;
    setCurrentVariationIndex((prev) => (prev + 1) % variations.length);
  };

  const handlePrevVariation = () => {
    if (variations.length === 0) return;
    setCurrentVariationIndex((prev) => (prev - 1 + variations.length) % variations.length);
  };

  const handleUpdateMainContent = (text: string) => {
    setVariations((prev) => {
      const next = [...prev];
      if (next[currentVariationIndex]) {
        next[currentVariationIndex] = { ...next[currentVariationIndex], mainContent: text };
      }
      return next;
    });
  };

  const handleUpdateReplyContent = (text: string) => {
    setVariations((prev) => {
      const next = [...prev];
      if (next[currentVariationIndex]) {
        next[currentVariationIndex] = { ...next[currentVariationIndex], replyContent: text };
      }
      return next;
    });
  };

  // Save to Queue (Scheduled or Draft)
  const handleSaveToPipeline = async (status: 'scheduled' | 'draft') => {
    const activeVar = variations[currentVariationIndex];
    if (!selectedProduct || !activeVar) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      let targetLink = '';
      if (linkOption === 'amazon_storefront') {
        targetLink = storefrontUrl.trim() || DEFAULT_AMAZON_STOREFRONT_URL;
      } else if (linkOption === 'room') {
        targetLink = roomUrl.trim();
      } else {
        targetLink = selectedProduct.affiliateUrl || selectedProduct.itemUrl;
      }

      // Auto schedule time for tonight 21:00 or tomorrow morning 07:30
      const now = new Date();
      const scheduledDate = new Date();
      if (now.getHours() < 20) {
        scheduledDate.setHours(21, 0, 0, 0);
      } else {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
        scheduledDate.setHours(7, 30, 0, 0);
      }

      await onSavePost({
        title: selectedProduct.title.slice(0, 50),
        asin: selectedProduct.itemId,
        amazon_url: selectedProduct.itemUrl,
        affiliate_url: targetLink,
        room_url: linkOption === 'room' ? targetLink : undefined,
        affiliate_provider: linkOption === 'amazon_storefront' ? 'amazon_storefront' : linkOption === 'room' ? 'room' : 'rakuten',
        category: selectedProduct.category,
        target_audience: selectedGenre === 'pet' ? '40〜60代女性・ペット飼い主' : selectedGenre === 'camp' ? 'ファミリー・ソロキャンパー' : '防災備蓄を整えたい人',
        platform: 'both',
        tone: 'no_link_tips',
        content: activeVar.mainContent,
        reply_content: activeVar.replyContent,
        key_benefits: [
          `★${selectedProduct.reviewAverage}`,
          `レビュー${selectedProduct.reviewCount}件`,
          selectedProduct.shopName,
        ],
        status,
        scheduled_at: status === 'scheduled' ? scheduledDate.toISOString() : null,
        published_at: null,
        tags: [selectedGenre, '楽天売れ筋', '愛用品紹介'],
        is_no_link: true,
        is_user_curated: true,
        metrics: { clicks: 0 },
      });

      setSaveSuccessMsg(
        status === 'scheduled'
          ? `🎉 スケジュールキューに予約登録しました！（予約日時: ${scheduledDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}）🌱 この文章は次回からのAI学習データに反映されます！`
          : '📝 下書きキューへ登録しました！🌱 この文章は次回からのAI学習データに反映されます！'
      );
      setExemplarsCount(prev => prev + 1);
    } catch (err: any) {
      alert(`保存エラー: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyText = (text: string, type: 'main' | 'reply') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const currentPresets = RESEARCH_PRESETS.filter(p => p.genre === selectedGenre);

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-amber-500/10 p-6 shadow-sm dark:border-emerald-500/10 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>ワンストップ棚並べ ✕ 売れ筋リサーチStudio</span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
              売れ筋リサーチから紹介文生成・キュー登録まで直結
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
              レビュー件数・高評価順に楽天市場の本当の売れ筋を自動抽出。共感あるある投稿＋ぶら下げリプライを一括生成します。
            </p>
          </div>

          {/* Genre Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl bg-white/80 p-1.5 shadow-xs backdrop-blur-md dark:bg-zinc-800/80">
            <button
              onClick={() => setSelectedGenre('pet')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedGenre === 'pet'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span>🐾</span>
              <span>ペット用品（主軸）</span>
            </button>
            <button
              onClick={() => setSelectedGenre('camp')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedGenre === 'camp'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span>⛺</span>
              <span>キャンプ・アウトドア</span>
            </button>
            <button
              onClick={() => setSelectedGenre('disaster')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedGenre === 'disaster'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>防災・ポータブル電源</span>
            </button>
          </div>
        </div>

        {/* Notice badge if simulated */}
        {searchNotice && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{searchNotice}</div>
          </div>
        )}
      </div>

      {/* Preset Needs Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            注目の売れ筋ニーズ・プリセット（クリックで即時リサーチ）
          </span>
          <span className="text-[11px] text-zinc-500">
            {currentPresets.length}個の厳選テーマ
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentPresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className="group flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-600 dark:hover:bg-zinc-800 transition"
            >
              <span>{preset.name}</span>
              {preset.badgeText && (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {preset.badgeText}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="検索キーワードを入力（例: ペットシーツ 薄型 大容量）"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortOption}
              onChange={e => {
                setSortOption(e.target.value);
                fetchResearchProducts(keyword, selectedGenre, e.target.value);
              }}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="+reviewCount">👑 レビュー件数順（最も確実な売れ筋）</option>
              <option value="-reviewAverage">⭐ 評価が高い順（★4.5以上優先）</option>
              <option value="-itemPrice">💰 高単価順（報酬狙い）</option>
              <option value="+itemPrice">🏷️ 低価格順（まとめ買い向け）</option>
            </select>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>リサーチ中...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>売れ筋を検索</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Product Results Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>リサーチ結果</span>
            </h3>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {products.length}件ヒット
            </span>
          </div>

          {/* Quick Link Selector Bar (一覧画面からでもワンタップで事前切替可能) */}
          <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
            <span className="px-2 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              誘導先:
            </span>
            <button
              type="button"
              onClick={() => handleSwitchLinkOption('amazon_storefront')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                linkOption === 'amazon_storefront'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Amazonストアフロント（shop/〇〇）へ誘導"
            >
              <span>🛒</span>
              <span>Amazonストアフロント</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLinkOption('room')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                linkOption === 'room'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="楽天ROOMのコレクションへ誘導"
            >
              <span>🏠</span>
              <span>楽天ROOM</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLinkOption('direct_rakuten')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                linkOption === 'direct_rakuten'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="楽天商品ページへ直接誘導"
            >
              <span>🔗</span>
              <span>楽天直リンク</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            現在の誘導先: <strong className={linkOption === 'amazon_storefront' ? 'text-amber-600' : linkOption === 'room' ? 'text-emerald-600' : 'text-teal-600'}>{linkOption === 'amazon_storefront' ? '🛒 Amazonストアフロント' : linkOption === 'room' ? '🏠 楽天ROOM' : '🔗 楽天アフィリエイト直リンク'}</strong>
          </span>
          <span>
            気になる商品の「✨️ この商品でAI作成」を押すと紹介文を即時生成できます
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              楽天市場の売れ筋・口コミデータを取得中...
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
            該当する商品が見つかりませんでした。別のキーワードでお試しください。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(prod => {
              const isSelected = selectedProduct?.itemId === prod.itemId;

              return (
                <div
                  key={prod.itemId}
                  className={`flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition hover:shadow-md dark:bg-zinc-900 ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div>
                    {/* Image & Badges */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={prod.imageUrl}
                        alt={prod.title}
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{prod.reviewAverage.toFixed(1)}</span>
                        <span className="text-zinc-300">({prod.reviewCount.toLocaleString()}件)</span>
                      </div>
                      {prod.postageFlag === 1 && (
                        <div className="absolute top-2 right-2 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          送料無料
                        </div>
                      )}
                    </div>

                    {/* Shop & Title */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="truncate">{prod.shopName}</span>
                      <a
                        href={prod.itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-0.5 text-emerald-600 hover:underline"
                      >
                        <span>楽天詳細</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <h4 className="mt-1 text-xs font-bold leading-snug text-zinc-900 line-clamp-2 dark:text-white">
                      {prod.title}
                    </h4>

                    {/* Caption snippet */}
                    {prod.caption && (
                      <p className="mt-2 text-[11px] text-zinc-600 line-clamp-2 dark:text-zinc-400 leading-relaxed">
                        {prod.caption}
                      </p>
                    )}
                  </div>

                  {/* Bottom: Price & Action */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-zinc-400">税込価格</div>
                      <div className="text-base font-extrabold text-zinc-900 dark:text-white">
                        ¥{prod.price.toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenAiGenerator(prod)}
                      className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:from-emerald-700 hover:to-teal-700 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>この商品でAI作成</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Post Generation & Direct Queue Enrollment Drawer / Modal */}
      {selectedProduct && (
        <div className="rounded-3xl border border-emerald-500/30 bg-white p-6 shadow-xl dark:border-emerald-500/20 dark:bg-zinc-900 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ✨️ AI紹介文生成スタジオ
                </span>
                <span className="text-xs text-zinc-500">
                  選択中: {selectedProduct.shopName}
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-white line-clamp-1">
                {selectedProduct.title}
              </h3>
            </div>

            <button
              onClick={() => setSelectedProduct(null)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              閉じる ✕
            </button>
          </div>

          {/* Link Type Selector: 楽天ROOM vs 楽天アフィリエイト直リンク */}
          <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                <span>紹介リンクの誘導形式</span>
              </label>
              <span className="text-[11px] text-zinc-500">
                状況に合わせてワンクリックで切り替え可能
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Amazonストアフロント */}
              <button
                type="button"
                onClick={() => handleSwitchLinkOption('amazon_storefront')}
                className={`flex flex-col p-3 rounded-xl border text-left transition ${
                  linkOption === 'amazon_storefront'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1 text-amber-900 dark:text-amber-300">
                    <span>🛒</span> Amazonストアフロント
                  </span>
                  {linkOption === 'amazon_storefront' && <Check className="h-4 w-4 text-amber-600" />}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  公式ストアフロント（shop/〇〇）へ誘導。Amazon派フォロワーのまとめ買い報酬を最大化。
                </p>
              </button>

              {/* 2. 楽天ROOM */}
              <button
                type="button"
                onClick={() => handleSwitchLinkOption('room')}
                className={`flex flex-col p-3 rounded-xl border text-left transition ${
                  linkOption === 'room'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1 text-emerald-900 dark:text-emerald-300">
                    <span>🏠</span> 楽天ROOMへ誘導
                  </span>
                  {linkOption === 'room' && <Check className="h-4 w-4 text-emerald-600" />}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  コレクションやマイページへ誘導。見栄えが良く楽天ROOM経由のまとめ買いを最大化。
                </p>
              </button>

              {/* 3. 楽天アフィリエイト直リンク */}
              <button
                type="button"
                onClick={() => handleSwitchLinkOption('direct_rakuten')}
                className={`flex flex-col p-3 rounded-xl border text-left transition ${
                  linkOption === 'direct_rakuten'
                    ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1 text-teal-900 dark:text-teal-300">
                    <span>🔗</span> 楽天アフィリ直リンク
                  </span>
                  {linkOption === 'direct_rakuten' && <Check className="h-4 w-4 text-teal-600" />}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  セール時や単品で強烈に今すぐ買わせたい時に。商品詳細ページへダイレクト遷移。
                </p>
              </button>
            </div>

            {/* If Amazon Storefront selected, input storefront URL */}
            {linkOption === 'amazon_storefront' && (
              <div className="mt-3 p-3.5 rounded-xl border border-amber-300/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1">
                      <span>🛒</span> 誘導先 AmazonストアフロントURL:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      <span>{selectedGenre === 'pet' ? '🐶 ペット用' : selectedGenre === 'camp' ? '⛺ キャンプ用' : '🎒 防災用'}連動中</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    カテゴリー切り替えで各専用URLが自動セットされます
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={storefrontUrl}
                    onChange={e => {
                      const newUrl = e.target.value;
                      setStorefrontUrl(newUrl);
                      // 既存リプライ文も連動置換
                      setVariations(prev =>
                        prev.map(v => ({
                          ...v,
                          replyContent: replaceReplyLinkLine(v.replyContent, 'amazon_storefront', newUrl.trim() || DEFAULT_AMAZON_STOREFRONT_URL),
                        }))
                      );
                    }}
                    placeholder="https://www.amazon.co.jp/shop/ユーザー名"
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-amber-500 focus:outline-hidden dark:border-amber-800 dark:bg-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentGenreStorefrontUrl}
                    title="現在のカテゴリー（ペット/キャンプ/防災）のデフォルトURLとして保存"
                    className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs flex items-center gap-1 transition"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5 text-white" />
                    <span>このカテゴリーに保存</span>
                  </button>
                </div>

                {savedCategoryStorefrontMsg && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>現在のカテゴリー（{selectedGenre === 'pet' ? 'ペット' : selectedGenre === 'camp' ? 'キャンプ' : '防災'}）専用AmazonストアフロントURLとして保存しました！</span>
                  </p>
                )}
              </div>
            )}

            {/* If ROOM selected, input room URL */}
            {linkOption === 'room' && (
              <div className="mt-3 p-3.5 rounded-xl border border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                      <span>🏠</span> 誘導先 楽天ROOMコレクションURL:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      <span>{selectedGenre === 'pet' ? '🐶 ペット用' : selectedGenre === 'camp' ? '⛺ キャンプ用' : '🎒 防災用'}連動中</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    カテゴリー切り替えで各専用URLが自動セットされます
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={roomUrl}
                    onChange={e => {
                      const newUrl = e.target.value;
                      setRoomUrl(newUrl);
                      // 既存リプライ文も連動置換
                      setVariations(prev =>
                        prev.map(v => ({
                          ...v,
                          replyContent: replaceReplyLinkLine(v.replyContent, 'room', newUrl.trim()),
                        }))
                      );
                    }}
                    placeholder="https://room.rakuten.co.jp/ユーザー名/items"
                    className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-emerald-800 dark:bg-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentGenreRoomUrl}
                    title="現在のカテゴリー（ペット/キャンプ/防災）のデフォルトURLとして保存"
                    className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs flex items-center gap-1 transition"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5 text-white" />
                    <span>このカテゴリーに保存</span>
                  </button>
                </div>

                {savedCategoryRoomMsg && (
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>現在のカテゴリー（{selectedGenre === 'pet' ? 'ペット' : selectedGenre === 'camp' ? 'キャンプ' : '防災'}）専用ROOM URLとして保存しました！</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Generation Result Previews */}
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-10">
              <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />
              <p className="mt-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                おっちょこちょいマダムの共感起承転結 ＆ リプライツリー（全4切り口）を生成中...
              </p>
            </div>
          ) : variations.length > 0 && variations[currentVariationIndex] ? (
            <div className="space-y-4">
              {/* 切り口切り替えタブバー */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/70 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                      <span>切り口を選択（全{variations.length}案）:</span>
                    </span>
                    {exemplarsCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700" title="過去にあなたが手動編集・確定した文章をFew-Shot学習としてプロンプトに動的反映しています">
                        <Sprout className="h-3 w-3 text-emerald-600 animate-pulse" />
                        <span>AI自己育成中（お手本 {exemplarsCount}件 学習反映中）</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-normal text-zinc-500">
                    💡 タップでいつでも前の案・別の案に行き来できます
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {variations.map((v, idx) => {
                    const isCurrent = currentVariationIndex === idx;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setCurrentVariationIndex(idx)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                          isCurrent
                            ? 'border-emerald-500 bg-white dark:bg-zinc-900 shadow-sm ring-2 ring-emerald-500/20'
                            : 'border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/40 hover:bg-white text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-bold ${isCurrent ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                            {idx + 1}. {v.badge}
                          </span>
                          {isCurrent && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        </div>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-1 font-normal">
                          {v.headline}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Textareas for Active Variation */}
              {(() => {
                const activeVar = variations[currentVariationIndex];
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Main Post Preview */}
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-2">
                        <span className="flex items-center gap-1.5">
                          <span>🐾</span>
                          <span>メイン投稿（{activeVar.badge}・リンクなし共感）</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(activeVar.mainContent, 'main')}
                          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-600"
                        >
                          {copiedType === 'main' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedType === 'main' ? 'コピー済' : 'コピー'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={9}
                        value={activeVar.mainContent}
                        onChange={e => handleUpdateMainContent(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-800 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 font-sans"
                      />
                      <div className="mt-1 text-[11px] text-zinc-400 text-right">
                        文字数: {activeVar.mainContent.length}文字
                      </div>
                    </div>

                    {/* Reply Post Preview */}
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-950 dark:bg-indigo-950/20">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-2">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                          <span>自動ぶら下げリプライ（商品レビュー ＋ #PR）</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(activeVar.replyContent, 'reply')}
                          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                        >
                          {copiedType === 'reply' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedType === 'reply' ? 'コピー済' : 'コピー'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={9}
                        value={activeVar.replyContent}
                        onChange={e => handleUpdateReplyContent(e.target.value)}
                        className="w-full rounded-xl border border-indigo-200 bg-white p-3 text-xs leading-relaxed text-zinc-800 focus:border-indigo-500 focus:outline-hidden dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-200 font-sans"
                      />
                      <div className="mt-1 text-[11px] text-zinc-400 text-right">
                        文字数: {activeVar.replyContent.length}文字
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Success Message Banner */}
              {saveSuccessMsg && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                  {onNavigateToPipeline && (
                    <button
                      type="button"
                      onClick={onNavigateToPipeline}
                      className="flex items-center gap-1 font-bold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-300 shrink-0"
                    >
                      <span>パイプラインで確認</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons to Switch & Save */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                {/* 双方向切り替え＆再生成コントロール */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePrevVariation}
                    className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs transition"
                    title="さっきの案に戻る"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>前の案に戻る</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextVariation}
                    className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-2xs transition"
                    title="次の切り口案に切り替える"
                  >
                    <span>別の切り口に切替 (案 {currentVariationIndex + 1}/{variations.length})</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAiGenerator(selectedProduct)}
                    disabled={isGenerating}
                    className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 transition"
                    title="新しく4案をAI再生成"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>新しく4案を再生成</span>
                  </button>
                </div>

                {/* キュー保存ボタン */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveToPipeline('draft')}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>下書きキューへ保存</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveToPipeline('scheduled')}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-indigo-700 transition"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>📅 最適時間に予約登録する</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
