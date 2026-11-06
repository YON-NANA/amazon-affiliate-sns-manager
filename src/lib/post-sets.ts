import fs from 'fs';
import path from 'path';
import { PostSet, PostSetTag, ProfileHpSettings } from './types';
import { getAppBaseUrl } from './pipeline';

const DATA_DIR = path.join(process.cwd(), 'data');
const POST_SETS_FILE = path.join(DATA_DIR, 'post-sets.json');
const MEDIA_STOCK_DIR = path.join(process.cwd(), 'public', 'media-stock');

export interface PostSetsStore {
  sets: PostSet[];
  profileSettings: ProfileHpSettings;
}

const DEFAULT_PROFILE_SETTINGS: ProfileHpSettings = {
  hpUrl: 'https://pet-kurashi.vercel.app',
  isHpUrlConfirmed: true,
  profileBioThreads:
    '愛犬・愛猫との穏やかな日常と、ペットと暮らす日々の工夫を綴っています🐾\nペットと泊まれる宿や暮らしのまとめは下記HP（ペットと愉しい暮らし）からどうぞ🌿',
  profileBioX:
    '愛犬・愛猫との穏やかな日常と、ペットと暮らす日々の工夫🐾\nペットと泊まれる宿・暮らしのまとめはHP（ペットと愉しい暮らし）に掲載しています🌿',
  updatedAt: new Date().toISOString(),
};

/**
 * ストアファイル（data/post-sets.json）の読み込み
 */
export function readPostSetsStore(): PostSetsStore {
  try {
    if (fs.existsSync(POST_SETS_FILE)) {
      const raw = fs.readFileSync(POST_SETS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        sets: Array.isArray(parsed.sets) ? parsed.sets : [],
        profileSettings: parsed.profileSettings || DEFAULT_PROFILE_SETTINGS,
      };
    }
  } catch (e) {
    console.warn('[PostSets] Failed to read post-sets.json:', e);
  }
  return {
    sets: [],
    profileSettings: DEFAULT_PROFILE_SETTINGS,
  };
}

/**
 * ストアファイル（data/post-sets.json）への保存
 */
export function writePostSetsStore(store: PostSetsStore): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(POST_SETS_FILE, JSON.stringify(store, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[PostSets] Failed to write post-sets.json:', e);
    return false;
  }
}

/**
 * 全セット一覧を取得
 */
export function getAllPostSets(): PostSet[] {
  const store = readPostSetsStore();
  return store.sets;
}

/**
 * プロフィール・HPリンク設定を取得
 */
export function getProfileHpSettings(): ProfileHpSettings {
  const store = readPostSetsStore();
  return store.profileSettings;
}

/**
 * プロフィール・HPリンク設定を更新
 * ルール4: プロフィール文から「アフィリエイトしてます」等の表記を禁止（広告表記はHP側に置く）
 */
export function updateProfileHpSettings(input: Partial<ProfileHpSettings>): {
  success: boolean;
  settings?: ProfileHpSettings;
  error?: string;
} {
  const store = readPostSetsStore();
  const nextBioThreads = input.profileBioThreads ?? store.profileSettings.profileBioThreads;
  const nextBioX = input.profileBioX ?? store.profileSettings.profileBioX;
  const nextHpUrl = input.hpUrl !== undefined ? input.hpUrl.trim() : store.profileSettings.hpUrl;

  // ルール4 & 対象外: 楽天ROOMリンクや「アフィリエイトしてます」表記をブロック
  if (/room\.rakuten\.co\.jp/i.test(nextHpUrl) || /room\.rakuten\.co\.jp/i.test(nextBioThreads) || /room\.rakuten\.co\.jp/i.test(nextBioX)) {
    return {
      success: false,
      error: '【ルール違反】楽天ROOMは単独運用のため、プロフィールやHPリンクに設定することはできません。',
    };
  }

  if (/アフィリエイトして|アフィリエイトやって|アソシエイト参加/i.test(nextBioThreads) || /アフィリエイトして|アフィリエイトやって|アソシエイト参加/i.test(nextBioX)) {
    return {
      success: false,
      error: '【ルール4違反】プロフィール文から「アフィリエイトしてます」等の表記は外してください（広告表記はリンクのあるHP側に置きます）。',
    };
  }

  const updated: ProfileHpSettings = {
    hpUrl: nextHpUrl,
    isHpUrlConfirmed: input.isHpUrlConfirmed ?? store.profileSettings.isHpUrlConfirmed,
    profileBioThreads: nextBioThreads,
    profileBioX: nextBioX,
    updatedAt: new Date().toISOString(),
  };

  store.profileSettings = updated;
  writePostSetsStore(store);
  return { success: true, settings: updated };
}

/**
 * public/media-stock/ 内の利用可能なメディアファイル一覧と使用状況を取得
 */
export interface StockMediaItem {
  filename: string;
  relativePath: string;
  publicUrl: string;
  absolutePath: string;
  mediaType: 'image' | 'video';
  isUsedOrAssigned: boolean; // 既にセットに登録済みまたは使用済みか
  assignedSetId?: string;
  assignedSetStatus?: 'unused' | 'used';
}

export function getStockMediaCatalog(): StockMediaItem[] {
  const sets = getAllPostSets();
  const usedMap = new Map<string, { id: string; status: 'unused' | 'used' }>();
  for (const s of sets) {
    if (s.mediaFilename) {
      usedMap.set(s.mediaFilename, { id: s.id, status: s.status });
    }
  }

  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov'];
  let filenames: string[] = [];

  try {
    if (fs.existsSync(MEDIA_STOCK_DIR)) {
      filenames = fs.readdirSync(MEDIA_STOCK_DIR).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return validExtensions.includes(ext);
      });
    }
  } catch (e) {
    console.warn('[PostSets] Failed to read media-stock directory:', e);
  }

  const baseUrl = getAppBaseUrl();

  return filenames.map(filename => {
    const ext = path.extname(filename).toLowerCase();
    const mediaType: 'image' | 'video' = ext === '.mp4' || ext === '.mov' ? 'video' : 'image';
    const relativePath = `/media-stock/${encodeURIComponent(filename)}`;
    const publicUrl = `${baseUrl}${relativePath}`;
    const absolutePath = path.join(MEDIA_STOCK_DIR, filename);
    const assigned = usedMap.get(filename);

    return {
      filename,
      relativePath,
      publicUrl,
      absolutePath,
      mediaType,
      isUsedOrAssigned: Boolean(assigned),
      assignedSetId: assigned?.id,
      assignedSetStatus: assigned?.status,
    };
  });
}

/**
 * テキスト正規化（重複・使い回し判定用）
 */
function normalizeTextForComparison(text: string): string {
  return text.replace(/\s+/g, '').trim();
}

/**
 * アフィリエイトリンクが含まれているか判定
 */
export function containsAffiliateLink(text: string): boolean {
  return /amazon\.co\.jp|amzn\.to|hb\.afl\.rakuten\.co\.jp|a\.r10\.to/i.test(text);
}

/**
 * 楽天ROOMのリンク・誘導が含まれているか判定
 * ルール3 & 対象外: 投稿本文・リプライに楽天ROOMのリンクを付けない。楽天ROOMは単独運用とし、HP・SNSからリンクしない。
 */
export function containsRakutenRoomReference(text: string): boolean {
  return /room\.rakuten\.co\.jp|楽天ROOM|プロフのリンク（ROOM）|ROOMにまとめてます/i.test(text);
}

/**
 * 先頭に「PR」と明記されているか判定
 * ルール3: アフィリエイトリンクを含む投稿を例外的に出す場合は、先頭に「PR」と明記する。
 */
export function startsWithPrDisclosure(text: string): boolean {
  const trimmed = text.trim();
  return /^(PR|【PR】|\[PR\])(\s|　|\n|：|:|$)/i.test(trimmed);
}

/**
 * 2026-11-06 改訂版投稿ルールに基づくセット検証
 */
export function validatePostSetInput(
  input: {
    id?: string; // 編集時は自身のIDを除外して重複チェック
    mediaFilename: string;
    textThreads: string;
    textX: string;
    tag: PostSetTag;
    isPetConditionVerified?: boolean;
    reviewSourceCitation?: string;
    hasExceptionAffiliateLink?: boolean;
  },
  existingSets: PostSet[]
): { valid: boolean; error?: string } {
  const mediaFilename = (input.mediaFilename || '').trim();
  const textThreads = (input.textThreads || '').trim();
  const textX = (input.textX || '').trim();

  // ルール1: セット制（メディア＋文章のセット単位のみ）
  if (!mediaFilename) {
    return {
      valid: false,
      error: '【ルール1：セット制】メディアファイル（写真または動画）を指定してください。文章のみの投稿はできません。',
    };
  }

  if (!textThreads || !textX) {
    return {
      valid: false,
      error: '【ルール1：セット制】投稿文（Threads用・X用）を入力してください。メディアのみの投稿はできません。',
    };
  }

  // 文字数チェック（Xは140文字目安・最大280ウェイト、Threadsは500文字）
  if (textThreads.length > 500) {
    return {
      valid: false,
      error: `Threads用投稿文が500文字を超えています（現在 ${textThreads.length} 文字）。`,
    };
  }

  // ルール2: 文章・メディアの再使用禁止
  const normThreads = normalizeTextForComparison(textThreads);
  const normX = normalizeTextForComparison(textX);

  for (const existing of existingSets) {
    if (input.id && existing.id === input.id) continue;

    if (existing.mediaFilename === mediaFilename) {
      return {
        valid: false,
        error: `【ルール2：再使用禁止】メディア「${mediaFilename}」は既に別のセット（${existing.status === 'used' ? '使用済み' : '未使用ストック'}）に登録されています。同じメディアは再使用できません。`,
      };
    }

    const existNormThreads = normalizeTextForComparison(existing.textThreads);
    const existNormX = normalizeTextForComparison(existing.textX);

    if (normThreads === existNormThreads || normThreads === existNormX || normX === existNormThreads || normX === existNormX) {
      return {
        valid: false,
        error: `【ルール2：文章の再使用禁止】既に登録済み（または使用済み）のセットと同じ文章が含まれています。同じ文章は再投稿できません。`,
      };
    }
  }

  // ルール3 & 対象外: 楽天ROOMリンク・誘導の完全禁止
  if (containsRakutenRoomReference(textThreads) || containsRakutenRoomReference(textX)) {
    return {
      valid: false,
      error: '【ルール3・対象外】投稿本文に楽天ROOMのリンクやROOM誘導文を含めることは禁止されています（導線はプロフィールのHPリンクに一本化・楽天ROOMは単独運用）。',
    };
  }

  // ルール3: アフィリエイトリンクの扱い
  const hasAffThreads = containsAffiliateLink(textThreads);
  const hasAffX = containsAffiliateLink(textX);

  if ((hasAffThreads || hasAffX) && !input.hasExceptionAffiliateLink) {
    return {
      valid: false,
      error: '【ルール3：リンクの扱い】通常投稿の本文にアフィリエイトリンクを付けることは禁止されています。例外的に出す場合は「例外としてアフィリエイトリンクを含む（先頭PR必須）」をONにし、先頭に「PR」と明記してください。',
    };
  }

  if (input.hasExceptionAffiliateLink || hasAffThreads || hasAffX) {
    if (!startsWithPrDisclosure(textThreads) || !startsWithPrDisclosure(textX)) {
      return {
        valid: false,
        error: '【ルール3：先頭PR明記】アフィリエイトリンクを例外的に含む投稿は、Threads用・X用の両方の本文先頭に「PR」と明記してください（例: 「PR\\n...」または「【PR】...」）。',
      };
    }
  }

  // ルール5: 投稿内容の柱（宿紹介のルール）
  if (input.tag === '宿紹介') {
    if (!input.isPetConditionVerified) {
      return {
        valid: false,
        error: '【ルール5：宿紹介】ペット同伴条件を1軒ずつ確認済みの宿のセットのみ登録・投稿できます。未確認の宿は投稿できません。',
      };
    }
    if (!input.reviewSourceCitation || !input.reviewSourceCitation.trim()) {
      return {
        valid: false,
        error: '【ルール5：宿紹介】宿の感想は「泊まった人の声」として出典（例：楽天トラベル口コミ、公式宿レビュー等）を入力してください。',
      };
    }
    // 本人が泊まったかのような表現の警告チェック
    const firstPersonStayPattern = /泊まってきました|泊まりました|行ってきました|我が家も宿泊|先日泊まった/;
    if (firstPersonStayPattern.test(textThreads) || firstPersonStayPattern.test(textX)) {
      return {
        valid: false,
        error: '【ルール5：宿紹介】宿の感想は「泊まった人の声」として出典が分かる書き方にし、本人が泊まったように書かないでください（「泊まってきました」等の表現が含まれています）。',
      };
    }
  }

  return { valid: true };
}

/**
 * 新規セットをストックに追加
 */
export function addPostSet(input: {
  title?: string;
  mediaFilename: string;
  textThreads: string;
  textX?: string;
  tag: PostSetTag;
  isPetConditionVerified?: boolean;
  reviewSourceCitation?: string;
  hasExceptionAffiliateLink?: boolean;
}): { success: boolean; set?: PostSet; error?: string } {
  const store = readPostSetsStore();
  const effectiveTextThreads = input.textThreads.trim();
  const effectiveTextX = (input.textX && input.textX.trim()) ? input.textX.trim() : effectiveTextThreads;

  const validation = validatePostSetInput(
    {
      mediaFilename: input.mediaFilename,
      textThreads: effectiveTextThreads,
      textX: effectiveTextX,
      tag: input.tag,
      isPetConditionVerified: input.isPetConditionVerified,
      reviewSourceCitation: input.reviewSourceCitation,
      hasExceptionAffiliateLink: input.hasExceptionAffiliateLink,
    },
    store.sets
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const ext = path.extname(input.mediaFilename).toLowerCase();
  const mediaType: 'image' | 'video' = ext === '.mp4' || ext === '.mov' ? 'video' : 'image';
  const baseUrl = getAppBaseUrl();
  const relativePath = `/media-stock/${encodeURIComponent(input.mediaFilename)}`;
  const mediaUrl = `${baseUrl}${relativePath}`;
  const now = new Date().toISOString();

  const newSet: PostSet = {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: input.title?.trim() || `${input.tag}セット (${input.mediaFilename})`,
    mediaFilename: input.mediaFilename,
    mediaType,
    mediaUrl,
    textThreads: effectiveTextThreads,
    textX: effectiveTextX,
    tag: input.tag,
    status: 'unused',
    publishedAt: null,
    isPetConditionVerified: input.tag === '宿紹介' ? Boolean(input.isPetConditionVerified) : undefined,
    reviewSourceCitation: input.tag === '宿紹介' ? input.reviewSourceCitation?.trim() : undefined,
    hasExceptionAffiliateLink: Boolean(input.hasExceptionAffiliateLink),
    createdAt: now,
    updatedAt: now,
  };

  store.sets.push(newSet);
  writePostSetsStore(store);

  return { success: true, set: newSet };
}

/**
 * 未使用セットの編集
 * ※一度「使用済み (used)」になったセットは再使用・改ざん防止のため編集不可
 */
export function updateUnusedPostSet(
  id: string,
  updates: {
    title?: string;
    mediaFilename?: string;
    textThreads?: string;
    textX?: string;
    tag?: PostSetTag;
    isPetConditionVerified?: boolean;
    reviewSourceCitation?: string;
    hasExceptionAffiliateLink?: boolean;
  }
): { success: boolean; set?: PostSet; error?: string } {
  const store = readPostSetsStore();
  const idx = store.sets.findIndex(s => s.id === id);
  if (idx === -1) {
    return { success: false, error: '指定されたセットが見つかりません。' };
  }

  const current = store.sets[idx];
  if (current.status === 'used') {
    return {
      success: false,
      error: '【ルール2：再使用禁止】一度使用済みになったセットは編集や再使用ができません。',
    };
  }

  const nextMedia = updates.mediaFilename ?? current.mediaFilename;
  const nextThreads = updates.textThreads !== undefined ? updates.textThreads.trim() : current.textThreads;
  const nextX = updates.textX !== undefined ? updates.textX.trim() : current.textX;
  const nextTag = updates.tag ?? current.tag;
  const nextVerified = updates.isPetConditionVerified ?? current.isPetConditionVerified;
  const nextCitation = updates.reviewSourceCitation ?? current.reviewSourceCitation;
  const nextException = updates.hasExceptionAffiliateLink ?? current.hasExceptionAffiliateLink;

  const validation = validatePostSetInput(
    {
      id,
      mediaFilename: nextMedia,
      textThreads: nextThreads,
      textX: nextX,
      tag: nextTag,
      isPetConditionVerified: nextVerified,
      reviewSourceCitation: nextCitation,
      hasExceptionAffiliateLink: nextException,
    },
    store.sets
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const ext = path.extname(nextMedia).toLowerCase();
  const mediaType: 'image' | 'video' = ext === '.mp4' || ext === '.mov' ? 'video' : 'image';
  const baseUrl = getAppBaseUrl();
  const relativePath = `/media-stock/${encodeURIComponent(nextMedia)}`;

  const updatedSet: PostSet = {
    ...current,
    title: updates.title !== undefined ? updates.title.trim() : current.title,
    mediaFilename: nextMedia,
    mediaType,
    mediaUrl: `${baseUrl}${relativePath}`,
    textThreads: nextThreads,
    textX: nextX,
    tag: nextTag,
    isPetConditionVerified: nextTag === '宿紹介' ? Boolean(nextVerified) : undefined,
    reviewSourceCitation: nextTag === '宿紹介' ? nextCitation?.trim() : undefined,
    hasExceptionAffiliateLink: Boolean(nextException),
    updatedAt: new Date().toISOString(),
  };

  store.sets[idx] = updatedSet;
  writePostSetsStore(store);

  return { success: true, set: updatedSet };
}

/**
 * セットの削除（未使用セットのみ削除可能。使用済みセットは再投稿防止履歴として保持）
 */
export function deleteUnusedPostSet(id: string): { success: boolean; error?: string } {
  const store = readPostSetsStore();
  const target = store.sets.find(s => s.id === id);
  if (!target) {
    return { success: false, error: '指定されたセットが見つかりません。' };
  }
  if (target.status === 'used') {
    return {
      success: false,
      error: '【ルール2：再使用禁止】使用済みセットは同じ文章・メディアの再投稿を防ぐ履歴として保持されるため削除できません。',
    };
  }

  store.sets = store.sets.filter(s => s.id !== id);
  writePostSetsStore(store);
  return { success: true };
}

/**
 * 次に投稿すべき「未使用 (unused)」かつルール適合のセットを1件取得
 * - 未使用セットが無い場合は null を返す（使い回しや自動生成は一切しない）
 */
export function getNextUnusedPostSet(specificSetId?: string): {
  set: PostSet | null;
  unusedCount: number;
  usedCount: number;
  skipReason?: string;
} {
  const store = readPostSetsStore();
  const usedSets = store.sets.filter(s => s.status === 'used');
  const unusedSets = store.sets.filter(s => s.status === 'unused');

  if (unusedSets.length === 0) {
    return {
      set: null,
      unusedCount: 0,
      usedCount: usedSets.length,
      skipReason: '未使用の投稿セット（ストック在庫）が0件のため、本日の投稿をスキップしました（使い回し・自動生成禁止ルール適用）。',
    };
  }

  const candidateList = specificSetId
    ? unusedSets.filter(s => s.id === specificSetId)
    : unusedSets;

  if (candidateList.length === 0) {
    return {
      set: null,
      unusedCount: unusedSets.length,
      usedCount: usedSets.length,
      skipReason: '指定された未使用セットが見つかりません。',
    };
  }

  // 順番にルール適合性を確認（万一未確認の宿紹介などがあればスキップ）
  for (const candidate of candidateList) {
    const check = validatePostSetInput(
      {
        id: candidate.id,
        mediaFilename: candidate.mediaFilename,
        textThreads: candidate.textThreads,
        textX: candidate.textX,
        tag: candidate.tag,
        isPetConditionVerified: candidate.isPetConditionVerified,
        reviewSourceCitation: candidate.reviewSourceCitation,
        hasExceptionAffiliateLink: candidate.hasExceptionAffiliateLink,
      },
      store.sets
    );

    if (check.valid) {
      return {
        set: candidate,
        unusedCount: unusedSets.length,
        usedCount: usedSets.length,
      };
    } else {
      console.warn(`[PostSets] Skipping invalid set ${candidate.id}: ${check.error}`);
    }
  }

  return {
    set: null,
    unusedCount: unusedSets.length,
    usedCount: usedSets.length,
    skipReason: '未使用セットはありますが、投稿ルール（宿の同伴条件確認・リンク規約等）を満たす有効なセットがないため投稿をスキップしました。',
  };
}

/**
 * 投稿完了したセットを「使用済み (used)」に更新し、投稿日時を記録
 */
export function markPostSetAsUsed(
  id: string,
  resultInfo: {
    xPostId?: string;
    xPostUrl?: string;
    threadsPostId?: string;
    threadsPostUrl?: string;
  }
): PostSet | null {
  const store = readPostSetsStore();
  const idx = store.sets.findIndex(s => s.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  store.sets[idx] = {
    ...store.sets[idx],
    status: 'used',
    publishedAt: now,
    xPostId: resultInfo.xPostId || store.sets[idx].xPostId,
    xPostUrl: resultInfo.xPostUrl || store.sets[idx].xPostUrl,
    threadsPostId: resultInfo.threadsPostId || store.sets[idx].threadsPostId,
    threadsPostUrl: resultInfo.threadsPostUrl || store.sets[idx].threadsPostUrl,
    updatedAt: now,
  };

  writePostSetsStore(store);
  return store.sets[idx];
}

