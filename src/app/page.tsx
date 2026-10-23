'use client';

import React, { useState, useEffect } from 'react';
import { Header, NavTabId } from '@/components/Header';
import { AutoPilotPanel } from '@/components/AutoPilotPanel';
import { PostGenerator } from '@/components/PostGenerator';
import { PostPipeline } from '@/components/PostPipeline';
import { SchedulerCalendar } from '@/components/SchedulerCalendar';
import { DailyTrendsPanel } from '@/components/DailyTrendsPanel';
import { CustomProductsManager } from '@/components/CustomProductsManager';
import { ResearchStudio } from '@/components/ResearchStudio';
import { PresetGallery } from '@/components/PresetGallery';
import { SettingsModal } from '@/components/SettingsModal';
import { DeviceConnectModal } from '@/components/DeviceConnectModal';
import { fetchPosts, savePost, updatePostStatus, deletePost, fetchCustomProducts, saveCustomProduct, deleteCustomProduct } from '@/lib/supabase';
import { Post, PostStatus, ProductPreset, CustomProduct, DailyTrendIdea } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTabId>('autopilot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  const [isSupabase, setIsSupabase] = useState(false);
  const [trackingId, setTrackingId] = useState('sample-22');
  const [presetToLoad, setPresetToLoad] = useState<ProductPreset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  // Load tracking ID and initial posts & products
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTag = localStorage.getItem('affiliate_tracking_id');
      if (storedTag) {
        setTrackingId(storedTag);
      } else if (process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID) {
        setTrackingId(process.env.NEXT_PUBLIC_AMAZON_TRACKING_ID);
      }
    }

    const loadData = async () => {
      setIsLoading(true);
      const [resPosts, resProds] = await Promise.all([
        fetchPosts(),
        fetchCustomProducts(),
      ]);
      setPosts(resPosts.posts);
      setCustomProducts(resProds.products);
      setIsSupabase(resPosts.isSupabase);
      setIsLoading(false);
    };

    loadData();
  }, []);

  const handleUpdateTrackingId = (newId: string) => {
    setTrackingId(newId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('affiliate_tracking_id', newId);
    }
  };

  const handleSavePost = async (postData: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => {
    const saved = await savePost(postData);
    setPosts(prev => {
      const filtered = prev.filter(p => p.id !== saved.id);
      return [saved, ...filtered];
    });
    return saved;
  };

  const handleUpdateStatus = async (
    id: string,
    status: PostStatus,
    extras?: { scheduled_at?: string | null; published_at?: string | null; tweet_id?: string }
  ) => {
    await updatePostStatus(id, status, extras);
    setPosts(prev =>
      prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            status,
            updated_at: new Date().toISOString(),
            ...extras,
          };
        }
        return p;
      })
    );
  };

  const handleDeletePost = async (id: string) => {
    await deletePost(id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  // Custom product handlers
  const handleSaveProduct = async (prodData: Omit<CustomProduct, 'id' | 'created_at'>) => {
    const saved = await saveCustomProduct(prodData);
    setCustomProducts(prev => {
      const filtered = prev.filter(p => p.id !== saved.id && p.asin !== saved.asin);
      return [saved, ...filtered];
    });
    return saved;
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteCustomProduct(id);
    setCustomProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleSelectCustomProductForPost = (prod: CustomProduct) => {
    setPresetToLoad({
      asin: prod.asin,
      title: prod.title,
      category: prod.category,
      genre: prod.genre,
      targetAudience: prod.genre === 'pet' ? '愛犬・愛猫の飼い主' : '暮らしを整えたい人',
      benefits: prod.default_benefits || [],
      priceRange: prod.price_hint,
      suggestedTones: ['problem_solving', 'honest_review'],
    });
    setActiveTab('generator');
  };

  // Trend handler
  const handleUseTrend = (trend: DailyTrendIdea) => {
    setPresetToLoad({
      asin: '',
      title: trend.themeTitle,
      category: trend.category,
      genre: trend.genre,
      targetAudience: trend.targetAudience,
      benefits: [trend.angle, `推奨検索: ${trend.suggestedKeyword}`],
      suggestedTones: ['problem_solving', 'honest_review'],
    });
    setActiveTab('generator');
  };

  const handleSelectPreset = (preset: ProductPreset) => {
    setPresetToLoad(preset);
    setActiveTab('generator');
  };

  const pendingCount = posts.filter(p => p.status === 'pending').length;
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSupabase={isSupabase}
        trackingId={trackingId}
        hasGeminiKey={true}
        pendingCount={pendingCount}
        scheduledCount={scheduledCount}
        productCount={customProducts.length}
        onOpenDeviceConnect={() => setIsDeviceModalOpen(true)}
      />

      {/* Main Container */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <span>データを読み込み中...</span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'autopilot' && (
              <AutoPilotPanel
                trackingId={trackingId}
                onPostSuccess={async () => {
                  const resPosts = await fetchPosts();
                  setPosts(resPosts.posts);
                }}
              />
            )}

            {activeTab === 'research' && (
              <ResearchStudio
                onSavePost={handleSavePost}
                onNavigateToPipeline={() => setActiveTab('pipeline')}
              />
            )}

            {activeTab === 'trends' && (
              <DailyTrendsPanel
                onUseTrend={handleUseTrend}
              />
            )}

            {activeTab === 'custom_products' && (
              <CustomProductsManager
                products={customProducts}
                trackingId={trackingId}
                onSaveProduct={handleSaveProduct}
                onDeleteProduct={handleDeleteProduct}
                onSelectForPost={handleSelectCustomProductForPost}
              />
            )}

            {activeTab === 'generator' && (
              <PostGenerator
                trackingId={trackingId}
                onSavePost={handleSavePost}
                onScheduledSuccess={() => setActiveTab('pipeline')}
                presetToLoad={presetToLoad}
                onClearPreset={() => setPresetToLoad(null)}
              />
            )}

            {activeTab === 'pipeline' && (
              <PostPipeline
                posts={posts}
                onUpdateStatus={handleUpdateStatus}
                onDeletePost={handleDeletePost}
              />
            )}

            {activeTab === 'calendar' && (
              <SchedulerCalendar
                posts={posts}
                onUpdateStatus={handleUpdateStatus}
              />
            )}

            {activeTab === 'presets' && (
              <PresetGallery
                onSelectPreset={handleSelectPreset}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsModal
                currentTrackingId={trackingId}
                onUpdateTrackingId={handleUpdateTrackingId}
                isSupabase={isSupabase}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p>
          暮らし & ペット用品 Amazon アフィリエイトSNS投稿マネージャー ｜ 日次トレンド更新 ✕ アカバン防止ガード ✕ X自動予約
        </p>
      </footer>

      {/* Other Device Connect Modal */}
      <DeviceConnectModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />
    </div>
  );
}
