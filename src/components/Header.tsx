'use client';

import React from 'react';
import { Sparkles, Database, Tag, Settings, Calendar, ListTodo, PlusCircle, ShoppingBag, ShieldCheck, Flame, PackagePlus, Zap, Search, Smartphone } from 'lucide-react';

export type NavTabId = 'autopilot' | 'research' | 'generator' | 'pipeline' | 'calendar' | 'trends' | 'custom_products' | 'presets' | 'settings';

interface HeaderProps {
  activeTab: NavTabId;
  setActiveTab: (tab: NavTabId) => void;
  isSupabase: boolean;
  trackingId: string;
  hasGeminiKey: boolean;
  pendingCount: number;
  scheduledCount: number;
  productCount: number;
  onOpenDeviceConnect?: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  isSupabase,
  trackingId,
  hasGeminiKey,
  pendingCount,
  scheduledCount,
  productCount,
  onOpenDeviceConnect,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-900/10 bg-white/90 backdrop-blur-md dark:border-emerald-500/10 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 text-white shadow-md shadow-emerald-500/20">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">
                暮らし & ペット用品 Amazon アフィリエイト
              </h1>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                🚀 完全自動化
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              刈り取り/育成日時自動判定 ✕ 高単価★4以上自動選定 ✕ 写真自動添付 ✕ X/Threads投下
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Supabase status badge */}
          <div
            title={isSupabase ? 'SupabaseクラウドDBに接続中' : 'ローカルDB（LocalStorage）で安全に動作中'}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isSupabase
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>{isSupabase ? 'Supabase接続中' : 'ローカルDB動作中'}</span>
          </div>

          {/* Tracking ID badge */}
          <div
            title="Amazonアソシエイト トラッキングID"
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Tag className="h-3.5 w-3.5 text-emerald-600" />
            <span>{trackingId || 'ID未設定'}</span>
          </div>

          {/* Anti-BAN Shield Indicator */}
          <div
            title="Xスパム検知回避：ランダムジッター・PR自動付与・共感ポスト支援ON"
            className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>アカバン防止ガード稼働中</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
          {/* 🚀 完全自動化タブ (最重要看板) */}
          <button
            onClick={() => setActiveTab('autopilot')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition sm:text-sm shadow-xs ${
              activeTab === 'autopilot'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-purple-500/30'
                : 'border border-purple-200 bg-purple-50/70 text-purple-800 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300'
            }`}
          >
            <Zap className="h-4 w-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span>🚀 完全自動化</span>
          </button>

          {/* 🔍 売れ筋リサーチ・棚並べ */}
          <button
            onClick={() => setActiveTab('research')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'research'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>売れ筋リサーチ</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'trends'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span>日次トレンド</span>
          </button>

          <button
            onClick={() => setActiveTab('custom_products')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'custom_products'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            <span>マイ商品 ({productCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'generator'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>投稿生成</span>
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'pipeline'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            <span>投稿管理</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'calendar'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>予約</span>
            {scheduledCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
                {scheduledCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`hidden sm:flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'presets'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>定番4選</span>
          </button>

          {/* 📱 スマホ・他デバイス確認ボタン */}
          <button
            type="button"
            onClick={onOpenDeviceConnect}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 shadow-xs transition"
            title="スマートフォン・タブレットなどの他デバイスで確認（QRコード表示）"
          >
            <Smartphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">📱 スマホで確認</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1 rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 ${
              activeTab === 'settings' ? 'bg-zinc-200 dark:bg-zinc-800' : ''
            }`}
            title="設定・X API・アカバンガード"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
