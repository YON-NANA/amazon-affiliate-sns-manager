'use client';

import React, { useState } from 'react';
import { PRESET_PRODUCTS, CATEGORIES } from '@/lib/presets';
import { ProductPreset } from '@/lib/types';
import { Sparkles, Home, HeartPulse, ExternalLink, ArrowRight, Check, Tag } from 'lucide-react';

interface PresetGalleryProps {
  onSelectPreset: (preset: ProductPreset) => void;
}

export function PresetGallery({ onSelectPreset }: PresetGalleryProps) {
  const [activeGenre, setActiveGenre] = useState<'life' | 'pet'>('life');

  const filteredPresets = PRESET_PRODUCTS.filter(p => p.genre === activeGenre);

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <span>暮らし & ペット用品 Amazon売れ筋アイデア集</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            初期段階で何を紹介すべきか迷った時や、すぐにGemini生成を試したいときにワンクリックで入力欄にセットできます。
          </p>
        </div>

        {/* Genre Switcher */}
        <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            onClick={() => setActiveGenre('life')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeGenre === 'life'
                ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>🌿 暮らし・日用品 ({PRESET_PRODUCTS.filter(p => p.genre === 'life').length}選)</span>
          </button>
          <button
            onClick={() => setActiveGenre('pet')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeGenre === 'pet'
                ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-700 dark:text-emerald-300'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <HeartPulse className="h-4 w-4" />
            <span>🐾 ペット・防災・現場厳選 ({PRESET_PRODUCTS.filter(p => p.genre === 'pet').length}選)</span>
          </button>
        </div>
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPresets.map(preset => {
          const cat = CATEGORIES.find(c => c.id === preset.category);

          return (
            <div
              key={preset.asin}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {cat?.name || preset.category}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      ASIN: {preset.asin}
                    </span>
                  </div>
                  {preset.priceRange && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {preset.priceRange}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-sm font-bold text-zinc-900 dark:text-white">
                  {preset.title}
                </h3>

                <div className="mt-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60 text-xs space-y-1.5">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    🎯 ターゲット: <span className="font-normal">{preset.targetAudience}</span>
                  </p>
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">推しポイント:</p>
                    <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 pl-1 space-y-0.5 mt-0.5">
                      {preset.benefits.map((b, idx) => (
                        <li key={idx} className="line-clamp-1">{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <a
                  href={`https://www.amazon.co.jp/dp/${preset.asin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Amazon商品ページ</span>
                </a>

                <button
                  onClick={() => onSelectPreset(preset)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <span>この商品で投稿を作成</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
