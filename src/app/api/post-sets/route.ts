import { NextResponse } from 'next/server';
import {
  getAllPostSets,
  getProfileHpSettings,
  updateProfileHpSettings,
  getStockMediaCatalog,
  addPostSet,
  updateUnusedPostSet,
  deleteUnusedPostSet,
} from '@/lib/post-sets';
import { PostSetTag } from '@/lib/types';

/**
 * GET /api/post-sets
 * 計画型・セット制ストックの一覧、未使用・使用済み件数、利用可能メディア一覧、プロフィールHP設定を取得
 */
export async function GET() {
  try {
    const sets = getAllPostSets();
    const unusedSets = sets.filter(s => s.status === 'unused');
    const usedSets = sets.filter(s => s.status === 'used');
    const mediaCatalog = getStockMediaCatalog();
    const profileSettings = getProfileHpSettings();

    return NextResponse.json({
      success: true,
      sets,
      unusedCount: unusedSets.length,
      usedCount: usedSets.length,
      nextSet: unusedSets[0] || null,
      mediaCatalog,
      profileSettings,
    });
  } catch (error: any) {
    console.error('[GET /api/post-sets Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'セット一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/post-sets
 * - action === 'update_profile': プロフィール・HPリンク（仮置き/確定）の更新
 * - デフォルト: 本人確認済みの新規セット（メディア＋文章＋分類タグ）をストックに追加
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'update_profile') {
      const res = updateProfileHpSettings({
        hpUrl: body.hpUrl,
        isHpUrlConfirmed: body.isHpUrlConfirmed,
        profileBioThreads: body.profileBioThreads,
        profileBioX: body.profileBioX,
      });
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, profileSettings: res.settings });
    }

    const result = addPostSet({
      title: body.title,
      mediaFilename: body.mediaFilename,
      textThreads: body.textThreads,
      textX: body.textX,
      tag: (body.tag as PostSetTag) || '暮らし・共感',
      isPetConditionVerified: body.isPetConditionVerified,
      reviewSourceCitation: body.reviewSourceCitation,
      hasExceptionAffiliateLink: body.hasExceptionAffiliateLink,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      set: result.set,
      message: '確認済み投稿セットをストックに登録しました。',
    });
  } catch (error: any) {
    console.error('[POST /api/post-sets Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'セットの登録に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/post-sets
 * 未使用セットの内容を更新（※使用済みセットは再使用禁止のため更新不可）
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'セットIDが指定されていません' }, { status: 400 });
    }

    const result = updateUnusedPostSet(body.id, {
      title: body.title,
      mediaFilename: body.mediaFilename,
      textThreads: body.textThreads,
      textX: body.textX,
      tag: body.tag,
      isPetConditionVerified: body.isPetConditionVerified,
      reviewSourceCitation: body.reviewSourceCitation,
      hasExceptionAffiliateLink: body.hasExceptionAffiliateLink,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      set: result.set,
      message: '未使用セットを更新しました。',
    });
  } catch (error: any) {
    console.error('[PATCH /api/post-sets Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'セットの更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/post-sets?id=xxx
 * 未使用セットの削除（※使用済みセットは再投稿防止履歴として保持するため削除不可）
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '削除するセットIDが指定されていません' }, { status: 400 });
    }

    const result = deleteUnusedPostSet(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '未使用セットを削除しました。',
    });
  } catch (error: any) {
    console.error('[DELETE /api/post-sets Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'セットの削除に失敗しました' },
      { status: 500 }
    );
  }
}

