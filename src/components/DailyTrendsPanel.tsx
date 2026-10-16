'use client';

import React, { useState, useEffect } from 'react';
import { DailyTrendIdea, CategoryId } from '@/lib/types';
import { Sparkles, TrendingUp, Search, ArrowRight, RefreshCw, ExternalLink, Calendar, Home, HeartPulse, Check } from 'lucide-react';

interface DailyTrendsPanelProps {
  onUseTrend: (trend: DailyTrendIdea) => void;
}

export function DailyTrendsPanel({ onUseTrend }: DailyTrendsPanelProps) {
  const [trends, setTrends] = useState<DailyTrendIdea[]>([]);
  const [seasonContext, setSeasonContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<'all' | 'life' | 'pet'>('all');
  const [source, setSource] = useState('');

  const fetchTrends = async (genre = selectedGenre) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/daily-trends?genre=${genre}`);
      const data = await res.json();
      if (data.trends) {
        setTrends(data.trends);
        setSeasonContext(data.seasonContext || '');
        setSource(data.source || '');
      }
    } catch (e) {
      console.error('Failed to load trends:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends(selectedGenre);
  }, [selectedGenre]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 p-5 shadow-xs dark:border-amber-900/60 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  🔥 日替わり売れ筋トレンド & 企画AI提案
                </h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {seasonContext || '本日の旬企画'}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                今日の季節・気候・ユーザーの悩みに合わせてGeminiが「今Amazonで何が売れるか」を自動予測。気になる企画は1クリックで投稿生成へ投入できます。
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Genre filter */}
            <div className="flex rounded-xl bg-white/80 p-0.5 shadow-2xs dark:bg-zinc-800">
              <button
                onClick={() => setSelectedGenre('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  selectedGenre === 'all'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setSelectedGenre('life')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  selectedGenre === 'life'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Home className="h-3 w-3" />
                暮らし
              </button>
              <button
                onClick={() => setSelectedGenre('pet')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  selectedGenre === 'pet'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <HeartPulse className="h-3 w-3" />
                ペット
              </button>
            </div>

            <button
              onClick={() => fetchTrends(selectedGenre)}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              title="トレンドを再取得"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
              <span>更新</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Trend Cards */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <span>季節トレンドをGeminiが分析中...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trends.map((trend, idx) => (
            <div
              key={trend.id || idx}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-amber-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {trend.genre === 'pet' ? '🐾 ペット用品' : '🌿 暮らし・日用品'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {trend.seasonContext}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-zinc-900 line-clamp-2 dark:text-white leading-snug">
                  {trend.themeTitle}
                </h3>

                <div className="mt-2.5 rounded-xl bg-zinc-50 p-3 text-xs space-y-1.5 dark:bg-zinc-950/60">
                  <p className="text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">🔍 推奨検索KW:</span>{' '}
                    <span className="font-mono text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                      {trend.suggestedKeyword}
                    </span>
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">🎯 ターゲット:</span>{' '}
                    {trend.targetAudience}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">💡 訴求アングル:</span>{' '}
                    {trend.angle}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <a
                  href={trend.sampleSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 font-medium"
                >
                  <Search className="h-3 w-3" />
                  <span>Amazonで商品を探す</span>
                </a>

                <button
                  onClick={() => onUseTrend(trend)}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:from-amber-600 hover:to-orange-600 transition"
                >
                  <span>この企画で生成</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
