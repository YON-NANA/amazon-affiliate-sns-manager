'use client';

import React, { useState } from 'react';
import { CustomProduct, CategoryId } from '@/lib/types';
import { CATEGORIES } from '@/lib/presets';
import { parseAmazonInput } from '@/lib/amazon';
import {
  PackagePlus,
  Trash2,
  ExternalLink,
  Sparkles,
  Search,
  Plus,
  Home,
  HeartPulse,
  Tag,
  ArrowRight,
  Check,
  AlertCircle
} from 'lucide-react';

interface CustomProductsManagerProps {
  products: CustomProduct[];
  trackingId: string;
  onSaveProduct: (prod: Omit<CustomProduct, 'id' | 'created_at'>) => Promise<CustomProduct>;
  onDeleteProduct: (id: string) => Promise<void>;
  onSelectForPost: (prod: CustomProduct) => void;
}

export function CustomProductsManager({
  products,
  trackingId,
  onSaveProduct,
  onDeleteProduct,
  onSelectForPost,
}: CustomProductsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<'life' | 'pet'>('life');
  const [category, setCategory] = useState<CategoryId>('kitchen');
  const [benefitsInput, setBenefitsInput] = useState('');
  const [priceHint, setPriceHint] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parseResult = parseAmazonInput(urlInput, trackingId);
    if (!parseResult.isValid || !parseResult.asin) {
      setErrorMsg('有効なAmazon商品URLまたは10桁のASINを入力してください。');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('商品名を入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      const benefits = benefitsInput
        .split('\n')
        .map(b => b.trim())
        .filter(b => b.length > 0);

      await onSaveProduct({
        asin: parseResult.asin,
        title: title.trim(),
        category,
        genre,
        amazon_url: parseResult.cleanUrl || `https://www.amazon.co.jp/dp/${parseResult.asin}`,
        affiliate_url: parseResult.affiliateUrl || `https://www.amazon.co.jp/dp/${parseResult.asin}?tag=${trackingId}`,
        default_benefits: benefits,
        price_hint: priceHint.trim(),
        notes: notes.trim(),
      });

      // Reset form
      setUrlInput('');
      setTitle('');
      setBenefitsInput('');
      setPriceHint('');
      setNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg(err.message || '商品の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q) || (p.notes && p.notes.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
            <PackagePlus className="h-5 w-5 text-emerald-600" />
            <span>マイ商品リスト（日々の売れ筋ストック管理）</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Amazonで見つけた売れ筋商品やタイムセール対象をストックしておき、いつでもワンクリックでAI投稿生成を行えます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="商品名やASINで検索"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-44 rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-3 py-1.5 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{showAddForm ? 'フォームを閉じる' : '新規商品を登録'}</span>
          </button>
        </div>
      </div>

      {/* Add Product Form Modal / Accordion */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-zinc-900 space-y-4">
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            <span>新しい売れ筋商品をストックに追加</span>
          </h3>

          {errorMsg && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/60 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Amazon商品URL または 10桁ASIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="https://www.amazon.co.jp/dp/B0XXXXXXXX"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                商品名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例: 猫壱 バリバリボウル 猫柄 すり鉢型爪とぎ"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                ジャンル & カテゴリ
              </label>
              <div className="flex gap-2">
                <select
                  value={genre}
                  onChange={e => {
                    const g = e.target.value as 'life' | 'pet';
                    setGenre(g);
                    setCategory(g === 'pet' ? 'pet_cat' : 'kitchen');
                  }}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="life">🌿 暮らし・日用品</option>
                  <option value="pet">🐾 ペット用品</option>
                </select>

                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as CategoryId)}
                  className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {CATEGORIES.filter(c => c.genre === genre).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                参考価格帯・セール情報 (任意)
              </label>
              <input
                type="text"
                placeholder="例: ¥2,380前後 (タイムセール時10%OFF)"
                value={priceHint}
                onChange={e => setPriceHint(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              推しポイント・特徴メモ（改行で複数行入力）
            </label>
            <textarea
              rows={2}
              placeholder="・すり鉢形状が体にフィットして丸まって寝る&#10;・削りカスがほとんど散らからない&#10;・中身だけ交換できるからコスパ最高"
              value={benefitsInput}
              onChange={e => setBenefitsInput(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '商品を登録する'}
            </button>
          </div>
        </form>
      )}

      {/* Product List Grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
          <PackagePlus className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            登録されたマイ商品がありません
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            「新規商品を登録」ボタンから、Amazonで見つけた気になる売れ筋商品を追加してください。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(prod => {
            const cat = CATEGORIES.find(c => c.id === prod.category);
            return (
              <div
                key={prod.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {prod.genre === 'pet' ? '🐾 ペット' : '🌿 暮らし'}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {prod.asin}
                      </span>
                    </div>

                    {prod.price_hint && (
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                        {prod.price_hint}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2.5 text-sm font-bold text-zinc-900 line-clamp-2 dark:text-white">
                    {prod.title}
                  </h3>

                  {prod.default_benefits && prod.default_benefits.length > 0 && (
                    <ul className="mt-2.5 rounded-xl bg-zinc-50 p-2.5 text-[11px] text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-400 space-y-1 list-disc list-inside">
                      {prod.default_benefits.slice(0, 3).map((b, idx) => (
                        <li key={idx} className="line-clamp-1">{b}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <a
                      href={prod.amazon_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Amazonで商品を見る"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <button
                      onClick={() => {
                        if (confirm(`「${prod.title}」を削除しますか？`)) {
                          onDeleteProduct(prod.id);
                        }
                      }}
                      className="text-zinc-400 hover:text-red-500"
                      title="マイ商品から削除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectForPost(prod)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>投稿を生成</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
