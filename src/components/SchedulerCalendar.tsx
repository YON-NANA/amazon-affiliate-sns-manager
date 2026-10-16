'use client';

import React from 'react';
import { Post, PostStatus } from '@/lib/types';
import { Calendar, Clock, Check, ExternalLink, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';

interface SchedulerCalendarProps {
  posts: Post[];
  onUpdateStatus: (id: string, status: PostStatus, extras?: { scheduled_at?: string | null; published_at?: string | null }) => Promise<void>;
}

export function SchedulerCalendar({ posts, onUpdateStatus }: SchedulerCalendarProps) {
  const scheduledPosts = posts
    .filter(p => p.status === 'scheduled')
    .sort((a, b) => {
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return timeA - timeB;
    });

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Golden Time Guide Banner */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-amber-500/10 p-5 shadow-xs dark:border-teal-900/60 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              暮らし & ペット用品のAmazonアフィリエイト 黄金投稿スケジュール
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              X・Threadsで最もインプレッションとCTRが高まる4つの時間帯に合わせて配信をスケジュールしましょう。
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-white/80 p-2.5 text-xs shadow-2xs dark:bg-zinc-800/80">
                <p className="font-bold text-teal-700 dark:text-teal-400">🌅 朝 07:00〜08:30</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">通勤中のスマホチェック。時短家事・朝活アイテムが好評</p>
              </div>
              <div className="rounded-xl bg-white/80 p-2.5 text-xs shadow-2xs dark:bg-zinc-800/80">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">🍱 昼 12:00〜13:00</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">お昼休み。1,000〜3,000円台の衝動買い・便利雑貨が伸びる</p>
              </div>
              <div className="rounded-xl bg-white/80 p-2.5 text-xs shadow-2xs dark:bg-zinc-800/80">
                <p className="font-bold text-amber-700 dark:text-amber-400">☕ 夕 15:00〜16:30</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">在宅ワーカー・主婦層。キッチン掃除や整理整頓のBefore/After</p>
              </div>
              <div className="rounded-xl bg-white/80 p-2.5 text-xs shadow-2xs dark:bg-zinc-800/80">
                <p className="font-bold text-purple-700 dark:text-purple-400">🌙 夜 20:30〜22:30</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">最高のアクティブ帯。ペットの癒し・じっくり長文レビュー</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled Timeline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white mb-4">
          <Calendar className="h-4 w-4 text-emerald-600" />
          <span>配信予定タイムライン（予約中: {scheduledPosts.length}件）</span>
        </h2>

        {scheduledPosts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
            <Clock className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              現在予約中の投稿はありません
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              「新規生成」タブで投稿を作成し、「予約リストに追加」を選択するとここに表示されます。
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-emerald-200 dark:before:bg-emerald-950">
            {scheduledPosts.map((post, idx) => {
              const targetDate = post.scheduled_at ? new Date(post.scheduled_at) : null;
              const isPast = targetDate ? targetDate < now : false;

              return (
                <div key={post.id} className="relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-xs ${
                      isPast ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Card */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 transition hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:bg-zinc-900">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-teal-600" />
                          {targetDate
                            ? targetDate.toLocaleString('ja-JP', {
                                month: 'numeric',
                                day: 'numeric',
                                weekday: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '日時未指定'}
                        </span>
                        {isPast && (
                          <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            予定時刻を通過中（今すぐ投稿推奨）
                          </span>
                        )}
                        <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {post.platform === 'x' ? '𝕏' : 'Threads'}
                        </span>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {post.asin}
                        </span>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://x.com/intent/tweet?text=${encodeURIComponent(post.content)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          <span>𝕏 で今すぐ投稿</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => onUpdateStatus(post.id, 'published', { published_at: new Date().toISOString() })}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" />
                          <span>投稿完了にする</span>
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {post.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 font-sans">
                      {post.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
