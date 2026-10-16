'use client';

import React, { useState } from 'react';
import { Database, Copy, Check, Key, Tag, Sparkles, ExternalLink, ShieldCheck, Download, Trash2, Send, AlertTriangle } from 'lucide-react';

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

      {/* Amazon Tracking ID Configuration */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-600" />
          <span>Amazonアソシエイト トラッキングID設定</span>
        </h3>

        <form onSubmit={handleSaveTrackingId}>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            トラッキングID (例: yourname-22)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackingIdInput}
              onChange={e => setTrackingIdInput(e.target.value)}
              placeholder="例: pet-lifestyle-22"
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              更新
            </button>
          </div>
          {savedTrackingMsg && (
            <p className="mt-1 text-xs text-emerald-600 font-semibold">トラッキングIDを更新しました！</p>
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
