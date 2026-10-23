'use client';

import React, { useState } from 'react';
import { Database, Copy, Check, Key, Tag, Sparkles, ExternalLink, ShieldCheck, Download, Trash2, Send, AlertTriangle, ShoppingBag, FolderGit2 } from 'lucide-react';
import {
  getCategoryRoomUrls,
  saveCategoryRoomUrls,
  getCategoryStorefrontUrls,
  saveCategoryStorefrontUrls,
  DEFAULT_AMAZON_STOREFRONT_URL
} from '@/lib/supabase';

interface SettingsModalProps {
  currentTrackingId: string;
  onUpdateTrackingId: (newId: string) => void;
  isSupabase: boolean;
}

const SUPABASE_SCHEMA_SQL = `-- 暮らし・ペット用品 AmazonアフィリエイトSNS投稿管理 Supabase Schema
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    asin VARCHAR(20) NOT NULL,
    amazon_url TEXT,
    affiliate_url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'life',
    target_audience TEXT,
    platform VARCHAR(20) NOT NULL DEFAULT 'x',
    tone VARCHAR(30) NOT NULL DEFAULT 'review',
    content TEXT NOT NULL,
    key_benefits TEXT[] DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metrics JSONB DEFAULT '{"clicks": 0, "shares": 0, "likes": 0}'::jsonb,
    notes TEXT,
    is_no_link BOOLEAN DEFAULT false,
    tweet_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asin VARCHAR(20) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'life',
    default_price TEXT,
    amazon_url TEXT,
    affiliate_url TEXT,
    features TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert posts" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update posts" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete posts" ON public.posts FOR DELETE USING (true);
CREATE POLICY "Allow public all products" ON public.products FOR ALL USING (true);`;

export function SettingsModal({
  currentTrackingId,
  onUpdateTrackingId,
  isSupabase,
}: SettingsModalProps) {
  const [trackingIdInput, setTrackingIdInput] = useState(currentTrackingId);
  const [copiedSql, setCopiedSql] = useState(false);
  const [savedTrackingMsg, setSavedTrackingMsg] = useState(false);

  // X API key inputs (stored in localStorage for convenience)
  const [xAppKey, setXAppKey] = useState('');
  const [xAppSecret, setXAppSecret] = useState('');
  const [xAccessToken, setXAccessToken] = useState('');
  const [xAccessSecret, setXAccessSecret] = useState('');
  const [savedXKeysMsg, setSavedXKeysMsg] = useState(false);

  // Amazon Storefront settings
  const [storefrontUrlGeneral, setStorefrontUrlGeneral] = useState('');
  const [storefrontUrlPet, setStorefrontUrlPet] = useState('');
  const [storefrontUrlCamp, setStorefrontUrlCamp] = useState('');
  const [storefrontUrlDisaster, setStorefrontUrlDisaster] = useState('');
  const [savedStorefrontMsg, setSavedStorefrontMsg] = useState(false);

  // Rakuten & ROOM settings
  const [rakutenAppId, setRakutenAppId] = useState('');
  const [rakutenAffId, setRakutenAffId] = useState('');
  const [roomUrlPet, setRoomUrlPet] = useState('');
  const [roomUrlCamp, setRoomUrlCamp] = useState('');
  const [roomUrlDisaster, setRoomUrlDisaster] = useState('');
  const [rakutenRoomUrl, setRakutenRoomUrl] = useState('');
  const [savedRakutenMsg, setSavedRakutenMsg] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Storefront URLs
      const sfUrls = getCategoryStorefrontUrls();
      setStorefrontUrlGeneral(sfUrls.general || DEFAULT_AMAZON_STOREFRONT_URL);
      setStorefrontUrlPet(sfUrls.pet || '');
      setStorefrontUrlCamp(sfUrls.camp || '');
      setStorefrontUrlDisaster(sfUrls.disaster || '');

      // Rakuten & ROOM URLs
      setRakutenAppId(localStorage.getItem('rakuten_app_id') || '');
      setRakutenAffId(localStorage.getItem('rakuten_affiliate_id') || '');
      const roomUrls = getCategoryRoomUrls();
      setRoomUrlPet(roomUrls.pet || '');
      setRoomUrlCamp(roomUrls.camp || '');
      setRoomUrlDisaster(roomUrls.disaster || '');
      setRakutenRoomUrl(roomUrls.general || 'https://room.rakuten.co.jp/yonnana_pet/items');
    }
  }, []);

  const handleSaveStorefront = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      saveCategoryStorefrontUrls({
        general: storefrontUrlGeneral.trim() || DEFAULT_AMAZON_STOREFRONT_URL,
        pet: storefrontUrlPet.trim(),
        camp: storefrontUrlCamp.trim(),
        disaster: storefrontUrlDisaster.trim(),
      });
    }
    setSavedStorefrontMsg(true);
    setTimeout(() => setSavedStorefrontMsg(false), 2000);
  };

  const handleSaveRakuten = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('rakuten_app_id', rakutenAppId.trim());
      localStorage.setItem('rakuten_affiliate_id', rakutenAffId.trim());
      saveCategoryRoomUrls({
        pet: roomUrlPet.trim(),
        camp: roomUrlCamp.trim(),
        disaster: roomUrlDisaster.trim(),
        general: rakutenRoomUrl.trim(),
      });
    }
    setSavedRakutenMsg(true);
    setTimeout(() => setSavedRakutenMsg(false), 2000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleSaveTrackingId = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTrackingId(trackingIdInput.trim());
    setSavedTrackingMsg(true);
    setTimeout(() => setSavedTrackingMsg(false), 2000);
  };

  const handleExportJson = () => {
    if (typeof window !== 'undefined') {
      const postsRaw = localStorage.getItem('affiliate_manager_posts_v1') || '[]';
      const prodsRaw = localStorage.getItem('affiliate_manager_custom_products_v1') || '[]';
      const backup = {
        exportedAt: new Date().toISOString(),
        posts: JSON.parse(postsRaw),
        products: JSON.parse(prodsRaw),
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affiliate_manager_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Database className="h-5 w-5 text-emerald-600" />
          <span>システム設定 & 外部連携（X API / Supabase / アカバン防止）</span>
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          X (Twitter) Developer API自動投稿の設定、Supabase SQLスキーマのセットアップ、アカバン防止ルールの確認を行えます。
        </p>
      </div>

      {/* Anti-BAN Shield Settings & Safety Rules */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-5 shadow-xs dark:border-blue-900/60 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">
            🛡️ アカバン（アカウント凍結・シャドウバン）防止ガード機能
          </h3>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          当システムは、X・Amazonアソシエイトの最新スパム検知アルゴリズムを回避するための以下の安全ルールを自動適用しています。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="rounded-xl border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-zinc-950">
            <p className="font-bold text-blue-700 dark:text-blue-400">1. ステルスマーケティング規制厳守</p>
            <p className="mt-1 text-zinc-500 text-[11px]">
              アフィリエイトリンクを含む投稿には「#PR」を必須化。未記載の投稿はAPI送信前に自動ブロック。
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-zinc-950">
            <p className="font-bold text-indigo-700 dark:text-indigo-400">2. リンク無し共感ポスト支援</p>
            <p className="mt-1 text-zinc-500 text-[11px]">
              リンク付きばかりを連投するとbot判定されるため、日常の豆知識・知恵袋ポストを間に挟む機能を内蔵。
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-zinc-950">
            <p className="font-bold text-teal-700 dark:text-teal-400">3. 人間的な投稿リズム</p>
            <p className="mt-1 text-zinc-500 text-[11px]">
              毎時00分ジャストの機械的配信ではなく、ランダムな分単位ジッターを持たせて自然なアカウントとして運用。
            </p>
          </div>
        </div>
      </div>

      {/* X (Twitter) Developer API Settings */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              𝕏 (Twitter) Developer API 自動投稿設定
            </h3>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Free / Basic tier 対応
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          X Developer Portalで取得したキーを <code className="bg-zinc-100 px-1 py-0.5 rounded text-emerald-700 font-mono">.env.local</code> に設定すると、ボタン1つでXへ実配信されます（未設定時はテストシミュレーションとして安全に動作します）。
        </p>

        <div className="rounded-xl bg-zinc-50 p-3 text-xs font-mono text-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300 space-y-1">
          <p className="font-semibold text-zinc-900 dark:text-white font-sans text-xs mb-1">
            📝 .env.local に追記するキー:
          </p>
          <p>TWITTER_API_KEY=your_consumer_key</p>
          <p>TWITTER_API_SECRET=your_consumer_secret</p>
          <p>TWITTER_ACCESS_TOKEN=your_access_token</p>
          <p>TWITTER_ACCESS_SECRET=your_access_token_secret</p>
        </div>
      </div>

      {/* Meta Threads API Settings */}
      <div className="rounded-2xl border border-pink-200 bg-white p-5 shadow-xs dark:border-pink-900/50 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-pink-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              🧵 Meta Threads API 自動投稿設定
            </h3>
          </div>
          <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[10px] font-mono text-pink-700 dark:bg-pink-950 dark:text-pink-300">
            Threads Graph API v1.0
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          Meta for Developersで発行したThreadsアクセストークンを <code className="bg-zinc-100 px-1 py-0.5 rounded text-pink-700 font-mono">.env.local</code> に設定すると、ボタン1つでThreadsへ直接バックグラウンド自動投稿されます（未設定時はテストシミュレーションとして安全に動作します）。
        </p>

        <div className="rounded-xl bg-zinc-50 p-3 text-xs font-mono text-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300 space-y-1">
          <p className="font-semibold text-zinc-900 dark:text-white font-sans text-xs mb-1">
            📝 .env.local に追記するThreadsキー:
          </p>
          <p>THREADS_ACCESS_TOKEN=your_threads_access_token</p>
          <p>THREADS_USER_ID=me</p>
        </div>
      </div>

      {/* Amazon Tracking ID & Storefront Configuration */}
      <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-xs dark:border-amber-950/60 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              🛒 Amazonアソシエイト ＆ ストアフロント設定
            </h3>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-mono text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Amazon Influencer / Associates
          </span>
        </div>

        {/* トラッキングID */}
        <form onSubmit={handleSaveTrackingId} className="space-y-1">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Amazonアソシエイト トラッキングID (例: yourname-22)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackingIdInput}
              onChange={e => setTrackingIdInput(e.target.value)}
              placeholder="例: pet-lifestyle-22"
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
            >
              更新
            </button>
          </div>
          {savedTrackingMsg && (
            <p className="mt-1 text-xs text-amber-600 font-semibold">トラッキングIDを更新しました！</p>
          )}
        </form>

        {/* ストアフロントURL設定 */}
        <form onSubmit={handleSaveStorefront} className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>🛒</span>
                <span>基本 AmazonストアフロントURL (shop/〇〇)</span>
              </label>
              <a
                href="https://www.amazon.co.jp/shop"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5"
              >
                <span>Amazonで確認</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={storefrontUrlGeneral}
                onChange={e => setStorefrontUrlGeneral(e.target.value)}
                placeholder="https://www.amazon.co.jp/shop/ユーザー名"
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
              >
                保存
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              売れ筋リサーチStudioや自動化パイプラインのリプライ欄に誘導先リンクとして自動挿入されます。
            </p>
          </div>

          {/* カテゴリー別 ストアフロント（アイデアリスト）URL */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-amber-600" />
                <span>カテゴリー別 アイデアリストURL（オプション）</span>
              </span>
              <span className="text-[10px] text-zinc-400">
                リサーチ画面でジャンルを切り替えると自動セットされます
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <span>🐶</span>
                  <span>ペット用品</span>
                </label>
                <input
                  type="text"
                  value={storefrontUrlPet}
                  onChange={e => setStorefrontUrlPet(e.target.value)}
                  placeholder="ペット用リストURL"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-mono focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <span>⛺</span>
                  <span>キャンプ用品</span>
                </label>
                <input
                  type="text"
                  value={storefrontUrlCamp}
                  onChange={e => setStorefrontUrlCamp(e.target.value)}
                  placeholder="キャンプ用リストURL"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-mono focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <span>🎒</span>
                  <span>防災用品</span>
                </label>
                <input
                  type="text"
                  value={storefrontUrlDisaster}
                  onChange={e => setStorefrontUrlDisaster(e.target.value)}
                  placeholder="防災用リストURL"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-mono focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 px-4 py-1.5 text-xs font-bold transition shadow-xs"
              >
                カテゴリー別URLを一括保存
              </button>
            </div>
          </div>

          {savedStorefrontMsg && (
            <p className="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="h-4 w-4" />
              <span>Amazonストアフロント設定を更新しました！</span>
            </p>
          )}
        </form>
      </div>

      {/* Rakuten API & ROOM Settings */}
      <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-xs dark:border-red-950/60 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              🛍️ 楽天市場商品検索API ＆ 楽天ROOM設定
            </h3>
          </div>
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-mono text-red-700 dark:bg-red-950 dark:text-red-300">
            Rakuten Developers 対応
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          楽天市場商品検索API（Application ID）を設定すると、新設した「売れ筋リサーチ」タブで最新のレビュー件数・高評価順ランキングをリアルタイム取得できます。未設定時はシミュレーションデータで安全に全機能をお試しいただけます。
        </p>

        <form onSubmit={handleSaveRakuten} className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                楽天 Application ID（アプリID）
              </label>
              <a
                href="https://webservice.rakuten.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-red-600 hover:underline flex items-center gap-0.5"
              >
                <span>Rakuten Developersで無料発行</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <input
              type="text"
              value={rakutenAppId}
              onChange={e => setRakutenAppId(e.target.value)}
              placeholder="例: 10xxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-red-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                楽天 アフィリエイトID (オプション)
              </label>
              <input
                type="text"
                value={rakutenAffId}
                onChange={e => setRakutenAffId(e.target.value)}
                placeholder="例: 1xxxxxxx.xxxxxxxx.1xxxxxxx"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-red-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>🌐</span>
                <span>共通・基本 ROOM URL (未設定時)</span>
              </label>
              <input
                type="text"
                value={rakutenRoomUrl}
                onChange={e => setRakutenRoomUrl(e.target.value)}
                placeholder="https://room.rakuten.co.jp/ユーザー名/items"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-red-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* カテゴリー別 ROOM コレクションURL */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-red-500" />
                <span>カテゴリー別 楽天ROOM コレクションURL（自動連動）</span>
              </span>
              <span className="text-[10px] text-zinc-400">
                リサーチ画面のタブ切り替えで自動セットされます
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <span>🐶</span>
                  <span>ペット用品</span>
                </label>
                <input
                  type="text"
                  value={roomUrlPet}
                  onChange={e => setRoomUrlPet(e.target.value)}
                  placeholder="ペット用コレクションURL"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-mono focus:border-red-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <span>⛺</span>
                  <span>キャンプ・アウトドア</span>
                </label>
                <input
                  type="text"
                  value={roomUrlCamp}
                  onChange={e => setRoomUrlCamp(e.target.value)}
                  placeholder="キャンプ用コレクションURL"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-mono focus:border-red-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <span>🎒</span>
                  <span>防災・備蓄</span>
                </label>
                <input
                  type="text"
                  value={roomUrlDisaster}
                  onChange={e => setRoomUrlDisaster(e.target.value)}
                  placeholder="防災用コレクションURL"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-mono focus:border-red-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-400">
              ※ ブラウザ内に安全に保存され、即座に売れ筋リサーチStudioへ反映されます
            </span>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-red-700 hover:to-rose-700 transition"
            >
              楽天設定を保存
            </button>
          </div>

          {savedRakutenMsg && (
            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              <span>楽天設定を保存しました！売れ筋リサーチStudioで即座に有効になります。</span>
            </p>
          )}
        </form>
      </div>

      {/* Supabase SQL Setup Section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              <span>Supabase テーブル作成 SQL (posts & products)</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Supabaseダッシュボードの「SQL Editor」で実行することで、即座にクラウドDBと同期できます。
            </p>
          </div>

          <button
            onClick={handleCopySql}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            {copiedSql ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>コピー完了！</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>SQLをコピー</span>
              </>
            )}
          </button>
        </div>

        <pre className="rounded-xl bg-zinc-950 p-4 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-56">
          {SUPABASE_SCHEMA_SQL}
        </pre>
      </div>

      {/* Local Data Backup / Export */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            ローカルデータのバックアップ / エクスポート
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            保存されている投稿データおよびマイ商品リストをJSON形式でPCにダウンロードできます。
          </p>
        </div>
        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <Download className="h-3.5 w-3.5" />
          <span>JSONエクスポート</span>
        </button>
      </div>
    </div>
  );
}
