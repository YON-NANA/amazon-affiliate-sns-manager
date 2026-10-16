'use client';

import React, { useState } from 'react';
import {
  Post,
  PostStatus,
  CategoryId
} from '@/lib/types';
import {
  ListTodo,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Calendar,
  Filter,
  Search,
  AlertCircle,
  Home,
  HeartPulse,
  Share2,
  Tag,
  ArrowRight,
  Send,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { CATEGORIES } from '@/lib/presets';

interface PostPipelineProps {
  posts: Post[];
  onUpdateStatus: (id: string, status: PostStatus, extras?: { scheduled_at?: string | null; published_at?: string | null; tweet_id?: string }) => Promise<void>;
  onDeletePost: (id: string) => Promise<void>;
  onSelectForEdit?: (post: Post) => void;
}

export function PostPipeline({
  posts,
  onUpdateStatus,
  onDeletePost,
  onSelectForEdit,
}: PostPipelineProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState<{ id: string; msg: string; isError?: boolean } | null>(null);

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (selectedStatus !== 'all' && post.status !== selectedStatus) return false;
    
    const cat = CATEGORIES.find(c => c.id === post.category);
    const postGenre = cat?.genre || (post.category.startsWith('pet') ? 'pet' : 'life');
    if (selectedGenre !== 'all' && postGenre !== selectedGenre) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = post.title.toLowerCase().includes(q);
      const matchAsin = post.asin.toLowerCase().includes(q);
      const matchContent = post.content.toLowerCase().includes(q);
      if (!matchTitle && !matchAsin && !matchContent) return false;
    }

    return true;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Direct X API post execution
  const handlePostViaApi = async (post: Post) => {
    setPostingId(post.id);
    setApiNotice(null);

    try {
      const res = await fetch('/api/post-to-x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          content: post.content,
          isNoLink: post.is_no_link || false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'X APIへの投稿に失敗しました');
      }

      setApiNotice({
        id: post.id,
        msg: data.isSimulated
          ? '【シミュレーション完了】X API認証キーが未設定のため模擬成功として記録しました。'
          : '🎉 Xへの自動投稿が完了しました！',
      });

      // Update post status to published
      await onUpdateStatus(post.id, 'published', {
        published_at: new Date().toISOString(),
        tweet_id: data.tweetId,
      });
    } catch (e: any) {
      setApiNotice({
        id: post.id,
        msg: `エラー: ${e.message}`,
        isError: true,
      });
    } finally {
      setPostingId(null);
    }
  };

  // Direct Threads API post execution
  const handlePostToThreadsViaApi = async (post: Post) => {
    setPostingId(`th_${post.id}`);
    setApiNotice(null);

    try {
      const res = await fetch('/api/post-to-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          content: post.content,
          isNoLink: post.is_no_link || false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Threads APIへの投稿に失敗しました');
      }

      setApiNotice({
        id: post.id,
        msg: data.isSimulated
          ? '【シミュレーション完了】Threads APIアクセストークンが未設定のため模擬成功として記録しました。'
          : '🎉 Threadsへの自動投稿が完了しました！',
      });

      await onUpdateStatus(post.id, 'published', {
        published_at: new Date().toISOString(),
      });
    } catch (e: any) {
      setApiNotice({
        id: post.id,
        msg: `Threadsエラー: ${e.message}`,
        isError: true,
      });
    } finally {
      setPostingId(null);
    }
  };

  const getStatusBadge = (status: PostStatus, isNoLink?: boolean) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
            <Clock className="h-3 w-3" />
            承認待ち
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950/70 dark:text-teal-300">
            <Calendar className="h-3 w-3" />
            予約中
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            投稿完了
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            下書き
          </span>
        );
    }
  };

  const formatSchedule = (isoString: string | null) => {
    if (!isoString) return '未定';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const pendingCount = posts.filter(p => p.status === 'pending').length;
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;
  const publishedCount = posts.filter(p => p.status === 'published').length;

  return (
    <div className="space-y-6">
      {/* Anti-BAN Health Meter & Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500">総登録投稿数</p>
          <p className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">{posts.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">承認待ち（要確認）</p>
          <p className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-200">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-xs dark:border-teal-900/50 dark:bg-teal-950/20">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">予約中（自動配信待機）</p>
          <p className="mt-1 text-2xl font-black text-teal-900 dark:text-teal-200">{scheduledCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">投稿完了</p>
          <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-200">{publishedCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'all', label: `すべて (${posts.length})` },
            { id: 'pending', label: `承認待ち (${pendingCount})` },
            { id: 'scheduled', label: `予約中 (${scheduledCount})` },
            { id: 'published', label: `投稿済 (${publishedCount})` },
            { id: 'draft', label: '下書き' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                selectedStatus === tab.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Genre & Search */}
        <div className="flex items-center gap-2">
          {/* Genre Toggle */}
          <div className="flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
            <button
              onClick={() => setSelectedGenre('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                selectedGenre === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500'
              }`}
            >
              全ジャンル
            </button>
            <button
              onClick={() => setSelectedGenre('life')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                selectedGenre === 'life'
                  ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                  : 'text-zinc-500'
              }`}
            >
              🌿 暮らし
            </button>
            <button
              onClick={() => setSelectedGenre('pet')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                selectedGenre === 'pet'
                  ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                  : 'text-zinc-500'
              }`}
            >
              🐾 ペット
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="検索 (ASIN, 商品名...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-40 sm:w-48 rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-3 py-1.5 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* Post Cards List */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
          <ListTodo className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            該当する投稿がありません
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            「投稿生成」タブまたは「日次トレンド」タブから投稿を作成してください。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPosts.map(post => {
            const isPet = post.category.startsWith('pet');
            const hasNotice = apiNotice && apiNotice.id === post.id;

            return (
              <div
                key={post.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Genre Icon */}
                      <span className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {isPet ? '🐾 ペット用品' : '🌿 暮らし・日用品'}
                      </span>
                      {/* Platform */}
                      <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {post.platform === 'x' ? '𝕏' : post.platform === 'threads' ? 'Threads' : '𝕏 & Threads'}
                      </span>
                      {/* ASIN */}
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {post.asin}
                      </span>
                      {post.is_no_link && (
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          🛡️ リンク無し共感
                        </span>
                      )}
                    </div>

                    {getStatusBadge(post.status)}
                  </div>

                  {/* Title */}
                  <h3 className="mt-3 text-sm font-bold text-zinc-900 line-clamp-1 dark:text-white">
                    {post.title}
                  </h3>

                  {/* Scheduled time info */}
                  {post.status === 'scheduled' && post.scheduled_at && (
                    <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
                      <Clock className="h-3 w-3" />
                      <span>予約日時: {formatSchedule(post.scheduled_at)}</span>
                    </div>
                  )}

                  {/* Content snippet */}
                  <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 whitespace-pre-wrap font-sans max-h-44 overflow-y-auto">
                    {post.content}
                  </div>

                  {/* Notice feedback if any */}
                  {hasNotice && (
                    <div className={`mt-2 rounded-xl p-2 text-xs font-semibold ${apiNotice.isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                      {apiNotice.msg}
                    </div>
                  )}

                  {/* Affiliate Link Badge */}
                  {!post.is_no_link && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50/50 px-2.5 py-1 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <span className="truncate font-mono">{post.affiliate_url}</span>
                      <a
                        href={post.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-0.5 text-emerald-700 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        開く
                      </a>
                    </div>
                  )}
                </div>

                {/* Card Actions (Semi-automatic control + Direct API Post) */}
                <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Copy button */}
                    <button
                      onClick={() => handleCopy(post.id, post.content)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {copiedId === post.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">コピー済</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>本文コピー</span>
                        </>
                      )}
                    </button>

                    {/* Direct X API Auto Post */}
                    <button
                      onClick={() => handlePostViaApi(post)}
                      disabled={postingId === post.id}
                      className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                      title="X API経由で直接自動投稿（未設定時はシミュレーション）"
                    >
                      <Send className="h-3 w-3" />
                      <span>{postingId === post.id ? '送信中...' : '𝕏 API配信'}</span>
                    </button>

                    {/* Direct Threads API Auto Post */}
                    <button
                      onClick={() => handlePostToThreadsViaApi(post)}
                      disabled={postingId === `th_${post.id}`}
                      className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:from-pink-700 hover:to-rose-700 disabled:opacity-50"
                      title="Threads API経由で直接自動投稿（未設定時はシミュレーション）"
                    >
                      <Send className="h-3 w-3" />
                      <span>{postingId === `th_${post.id}` ? '送信中...' : 'Threads API'}</span>
                    </button>

                    {/* Open in X web intent */}
                    <a
                      href={`https://x.com/intent/tweet?text=${encodeURIComponent(post.content)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 rounded-xl bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                      title="ブラウザでX投稿画面を開く"
                    >
                      <span>𝕏</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>

                    {/* Open in Threads web intent */}
                    <a
                      href={`https://threads.net/intent/post?text=${encodeURIComponent(post.content)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 rounded-xl border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-xs font-semibold text-zinc-900 shadow-xs hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      title="ブラウザでThreads投稿画面を開く"
                    >
                      <span>Threads</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>

                  {/* Status update transitions */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1.5">
                      {post.status !== 'published' && (
                        <button
                          onClick={() => onUpdateStatus(post.id, 'published', { published_at: new Date().toISOString() })}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <Check className="h-3 w-3" />
                          投稿完了にする
                        </button>
                      )}
                      {post.status === 'pending' && (
                        <button
                          onClick={() => {
                            const twoHoursLater = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
                            onUpdateStatus(post.id, 'scheduled', { scheduled_at: twoHoursLater });
                          }}
                          className="flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300"
                        >
                          <Calendar className="h-3 w-3" />
                          予約に承認
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`「${post.title}」を削除しますか？`)) {
                          onDeletePost(post.id);
                        }
                      }}
                      className="text-zinc-400 hover:text-red-500 p-1"
                      title="投稿を削除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
