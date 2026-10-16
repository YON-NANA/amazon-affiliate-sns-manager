-- ========================================================
-- 暮らし・ペット用品 AmazonアフィリエイトSNS投稿管理アプリ
-- Supabase Database Schema
-- ========================================================

-- 1. 投稿管理テーブル (posts)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    asin VARCHAR(20) NOT NULL,
    amazon_url TEXT,
    affiliate_url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'life', -- 'life' (暮らし), 'pet' (ペット), 'kitchen', 'cleaning', 'interior', 'pet_cat', 'pet_dog', 'pet_care'
    target_audience TEXT, -- ターゲット層 (例: 共働き夫婦、一人暮らし、愛猫家、愛犬家)
    platform VARCHAR(20) NOT NULL DEFAULT 'x', -- 'x', 'threads', 'both'
    tone VARCHAR(30) NOT NULL DEFAULT 'review', -- 'review', 'problem_solving', 'deal_sale', 'empathy_story'
    content TEXT NOT NULL, -- 投稿本文
    key_benefits TEXT[] DEFAULT '{}', -- 訴求ポイント
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- 'draft', 'pending', 'scheduled', 'published', 'archived'
    scheduled_at TIMESTAMPTZ, -- 予約投稿日時
    published_at TIMESTAMPTZ, -- 投稿完了日時
    tags TEXT[] DEFAULT '{}', -- ハッシュタグ
    metrics JSONB DEFAULT '{"clicks": 0, "shares": 0, "likes": 0}'::jsonb, -- 成果・メトリクス
    notes TEXT, -- メモ・改善点
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. 商品マスターテーブル (products)
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

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_asin ON public.posts(asin);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);
CREATE INDEX IF NOT EXISTS idx_products_asin ON public.products(asin);

-- RLS (Row Level Security) 設定
-- 初期運用ではAnonキーからの読み書きを許可するポリシー
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read posts" ON public.posts
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert posts" ON public.posts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update posts" ON public.posts
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete posts" ON public.posts
    FOR DELETE USING (true);

CREATE POLICY "Allow public all products" ON public.products
    FOR ALL USING (true);

-- 自動 updated_at トリガー
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_posts_updated_at ON public.posts;
CREATE TRIGGER tr_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_products_updated_at ON public.products;
CREATE TRIGGER tr_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
