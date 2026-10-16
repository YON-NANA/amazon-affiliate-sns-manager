import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Post, PostStatus, CustomProduct } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (supabaseUrl && supabaseAnonKey && supabaseAnonKey !== '【取得したPublishable keyを貼り付け】' && !supabaseAnonKey.startsWith('your_')) {
    try {
      client = createClient(supabaseUrl, supabaseAnonKey);
      return client;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

// LocalStorage keys
const LOCAL_STORAGE_POSTS_KEY = 'affiliate_manager_posts_v1';
const LOCAL_STORAGE_PRODUCTS_KEY = 'affiliate_manager_custom_products_v1';

// Initial mock posts
const INITIAL_MOCK_POSTS: Post[] = [
  {
    id: 'mock-1',
    title: '猫壱 バリバリボウル 猫柄 すり鉢型爪とぎベッド',
    asin: 'B01FXF56K8',
    amazon_url: 'https://www.amazon.co.jp/dp/B01FXF56K8',
    affiliate_url: 'https://www.amazon.co.jp/dp/B01FXF56K8?tag=sample-22',
    category: 'pet_cat',
    target_audience: '猫の爪とぎ家具被害に悩む飼い主',
    platform: 'x',
    tone: 'problem_solving',
    content: 'ソファで爪を研がれて頭抱えてたんだけど、これ置いたら一瞬で解決した…！\n\nすり鉢状のカーブが絶妙らしくて、研いだ後はそのまま中で丸まって爆睡💤\n\n研ぎカスも全然散らからないし中のすり鉢だけ交換できるから長持ち。猫飼い全員におすすめしたい。\n\nhttps://www.amazon.co.jp/dp/B01FXF56K8?tag=sample-22 #PR',
    key_benefits: ['すり鉢形状で爆睡', '削りカスが散らからない', '交換式で高コスパ'],
    status: 'scheduled',
    scheduled_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    published_at: null,
    tags: ['猫のいる暮らし', '猫壱', '買ってよかった'],
    metrics: { clicks: 12, likes: 24, shares: 3 },
    notes: '20:30の猫飼いフォロワーアクティブ時間に予約',
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'mock-2',
    title: 'ぶんぶんチョッパー スーパー5 みじん切り器 900ml',
    asin: 'B077Z2W3M9',
    amazon_url: 'https://www.amazon.co.jp/dp/B077Z2W3M9',
    affiliate_url: 'https://www.amazon.co.jp/dp/B077Z2W3M9?tag=sample-22',
    category: 'kitchen',
    target_audience: '夕飯の支度を少しでも短縮したい共働き家庭',
    platform: 'threads',
    tone: 'honest_review',
    content: '自炊のハードルが半分以下になった神アイテム🍳\n\n玉ねぎのみじん切り、包丁で刻むと涙止まらないしまな板からポロポロ落ちて地味にストレスだったのが、これに入れて紐を8回引くだけで秒で終わる…！\n\n丸洗いできるし電気コードも不要だから使うまでのハードルがゼロなのが最高です。\nハンバーグやドライカレー作るときはもう手放せない。新生活にも超おすすめ。\n\nhttps://www.amazon.co.jp/dp/B077Z2W3M9?tag=sample-22 #PR',
    key_benefits: ['8秒引くだけでみじん切り完成', '電気不要で丸洗い', 'ハンバーグの準備が1/3に'],
    status: 'pending',
    scheduled_at: null,
    published_at: null,
    tags: ['時短料理', '便利キッチングッズ', 'QOL向上'],
    metrics: { clicks: 0 },
    notes: 'Threadsの夕方投稿用にレビュー待ち',
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
];

// Initial mock products
const INITIAL_MOCK_PRODUCTS: CustomProduct[] = [
  {
    id: 'prod-1',
    asin: 'B01FXF56K8',
    title: '猫壱(necoichi) バリバリボウル 猫柄 すり鉢型爪とぎベッド',
    category: 'pet_cat',
    genre: 'pet',
    amazon_url: 'https://www.amazon.co.jp/dp/B01FXF56K8',
    affiliate_url: 'https://www.amazon.co.jp/dp/B01FXF56K8?tag=sample-22',
    default_benefits: ['すり鉢形状が体にフィットして爆睡', 'カスが出にくい高密度ダンボール', 'すり鉢部分だけ交換可能'],
    price_hint: '¥2,380',
    tags: ['猫壱', '爪とぎ', '猫ベッド'],
    notes: '定期的にセール対象になる大定番',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    asin: 'B077Z2W3M9',
    title: 'ぶんぶんチョッパー スーパー5 みじん切り器 900ml',
    category: 'kitchen',
    genre: 'life',
    amazon_url: 'https://www.amazon.co.jp/dp/B077Z2W3M9',
    affiliate_url: 'https://www.amazon.co.jp/dp/B077Z2W3M9?tag=sample-22',
    default_benefits: ['8秒引くだけでみじん切り完成', '丸洗い可能で電気不要', '離乳食やハンバーグ作りに最適'],
    price_hint: '¥1,980',
    tags: ['時短料理', '調理器具', '離乳食'],
    notes: '新生活や共働き世帯に高CV',
    created_at: new Date().toISOString(),
  },
];

/**
 * Posts Storage API
 */
export async function fetchPosts(): Promise<{ posts: Post[]; isSupabase: boolean; error?: string }> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return { posts: data as Post[], isSupabase: true };
      }
      console.warn('Supabase query failed, falling back to LocalStorage:', error?.message);
    } catch (err: unknown) {
      console.warn('Supabase network error, fallback to LocalStorage:', err);
    }
  }

  // Fallback to LocalStorage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { posts: parsed, isSupabase: false };
      } catch (e) {
        console.error('Failed to parse local storage posts', e);
      }
    }
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(INITIAL_MOCK_POSTS));
    return { posts: INITIAL_MOCK_POSTS, isSupabase: false };
  }

  return { posts: INITIAL_MOCK_POSTS, isSupabase: false };
}

export async function savePost(post: Omit<Post, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Post> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const id = post.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'post_' + Math.random().toString(36).substring(2, 9));

  const newPost: Post = {
    ...post,
    id,
    created_at: now,
    updated_at: now,
    metrics: post.metrics || { clicks: 0, likes: 0, shares: 0 },
  };

  if (sb) {
    try {
      const { data, error } = await sb
        .from('posts')
        .upsert([newPost])
        .select()
        .single();

      if (!error && data) {
        return data as Post;
      }
      console.warn('Supabase upsert failed, storing locally:', error?.message);
    } catch (err) {
      console.warn('Supabase save error, storing locally:', err);
    }
  }

  // Fallback to LocalStorage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    const list: Post[] = raw ? JSON.parse(raw) : INITIAL_MOCK_POSTS;
    const existingIndex = list.findIndex(p => p.id === newPost.id);
    if (existingIndex >= 0) {
      list[existingIndex] = newPost;
    } else {
      list.unshift(newPost);
    }
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(list));
  }

  return newPost;
}

export async function updatePostStatus(
  id: string, 
  status: PostStatus, 
  extras?: { scheduled_at?: string | null; published_at?: string | null; tweet_id?: string }
): Promise<boolean> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const updates: Partial<Post> = {
    status,
    updated_at: now,
    ...extras,
  };

  if (sb) {
    try {
      const { error } = await sb
        .from('posts')
        .update(updates)
        .eq('id', id);

      if (!error) return true;
    } catch (e) {
      console.warn('Supabase status update error:', e);
    }
  }

  // Local fallback
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (raw) {
      const list: Post[] = JSON.parse(raw);
      const target = list.find(p => p.id === id);
      if (target) {
        Object.assign(target, updates);
        localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(list));
        return true;
      }
    }
  }

  return false;
}

export async function deletePost(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from('posts')
        .delete()
        .eq('id', id);

      if (!error) return true;
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }

  // Local fallback
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (raw) {
      const list: Post[] = JSON.parse(raw);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(filtered));
      return true;
    }
  }

  return false;
}

/**
 * Custom Products Storage API (マイ商品リスト)
 */
export async function fetchCustomProducts(): Promise<{ products: CustomProduct[]; isSupabase: boolean }> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return {
          products: data.map((d: any) => ({
            id: d.id,
            asin: d.asin,
            title: d.title,
            category: d.category || 'life_general',
            genre: (d.category?.startsWith('pet') ? 'pet' : 'life'),
            amazon_url: d.amazon_url || `https://www.amazon.co.jp/dp/${d.asin}`,
            affiliate_url: d.affiliate_url || '',
            default_benefits: d.features || [],
            price_hint: d.default_price || '',
            notes: d.notes || '',
            created_at: d.created_at,
          })),
          isSupabase: true,
        };
      }
    } catch (e) {
      console.warn('Supabase fetch products error, fallback:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (raw) {
      try {
        return { products: JSON.parse(raw), isSupabase: false };
      } catch (e) {
        console.error('Failed to parse products', e);
      }
    }
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(INITIAL_MOCK_PRODUCTS));
    return { products: INITIAL_MOCK_PRODUCTS, isSupabase: false };
  }

  return { products: INITIAL_MOCK_PRODUCTS, isSupabase: false };
}

export async function saveCustomProduct(product: Omit<CustomProduct, 'id' | 'created_at'> & { id?: string }): Promise<CustomProduct> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const id = product.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'prod_' + Math.random().toString(36).substring(2, 9));

  const newProd: CustomProduct = {
    ...product,
    id,
    created_at: now,
  };

  if (sb) {
    try {
      await sb.from('products').upsert([{
        id: newProd.id,
        asin: newProd.asin,
        title: newProd.title,
        category: newProd.category,
        default_price: newProd.price_hint,
        amazon_url: newProd.amazon_url,
        affiliate_url: newProd.affiliate_url,
        features: newProd.default_benefits,
        notes: newProd.notes,
      }]);
    } catch (err) {
      console.warn('Supabase product save error:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    const list: CustomProduct[] = raw ? JSON.parse(raw) : INITIAL_MOCK_PRODUCTS;
    const idx = list.findIndex(p => p.asin === newProd.asin || p.id === newProd.id);
    if (idx >= 0) {
      list[idx] = newProd;
    } else {
      list.unshift(newProd);
    }
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(list));
  }

  return newProd;
}

export async function deleteCustomProduct(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('products').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete product error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (raw) {
      const list: CustomProduct[] = JSON.parse(raw);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(filtered));
      return true;
    }
  }

  return false;
}
