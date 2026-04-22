/**
 * File: collaboration_service.ts
 * Purpose: Multi-user collaboration — invite, chapter locking, merge requests
 * Layer: Infrastructure (Service)
 * Domain: Collaboration → [invite, lock, merge request]
 *
 * Data Contract:
 * - Input: projectId, userId, email, role
 * - Output: ProjectMember[], lock status
 * - Uses existing: project_members, chapters.locked_by
 */

import { supabase } from './supabase_client';

export type MemberRole = 'co_author' | 'beta_reader' | 'viewer';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  joined_at: string;
  user_email?: string;
  user_name?: string;
  user_avatar?: string;
}

export interface ChapterLock {
  chapter_id: string;
  locked_by: string | null;
  locked_at: string | null;
  locker_name?: string;
  is_expired: boolean;
}

const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 phút

// ── Invite Member ──

export async function inviteMember(
  projectId: string,
  email: string,
  role: MemberRole,
  invitedBy: string
): Promise<ProjectMember | { error: string }> {
  // STEP 1: Tìm user theo email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email)
    .single();

  if (!profile) return { error: 'Không tìm thấy người dùng với email này' };

  // STEP 2: Kiểm tra đã là member chưa
  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (existing) return { error: 'Người này đã là thành viên của dự án' };

  // STEP 3: Kiểm tra không tự mời chính mình
  if (profile.id === invitedBy) return { error: 'Không thể mời chính mình' };

  // STEP 4: Insert member
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: profile.id,
      role,
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return mapMemberRow({ ...data, profiles: profile });
}

// ── List Members ──

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select(`
      *,
      profiles:user_id ( email, full_name, avatar_url )
    `)
    .eq('project_id', projectId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapMemberRow);
}

// ── Update Member Role ──

export async function updateMemberRole(
  memberId: string,
  role: MemberRole
): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId);

  if (error) throw error;
}

// ── Remove Member ──

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
}

// ── Chapter Locking ──

export async function lockChapter(
  chapterId: string,
  userId: string
): Promise<{ success: boolean; lockedBy?: string }> {
  // Kiểm tra lock hiện tại
  const { data: chapter } = await supabase
    .from('chapters')
    .select('locked_by, locked_at')
    .eq('id', chapterId)
    .single();

  if (chapter?.locked_by && chapter.locked_by !== userId) {
    // Kiểm tra hết hạn
    const lockedAt = new Date(chapter.locked_at!).getTime();
    const now = Date.now();
    if (now - lockedAt < LOCK_DURATION_MS) {
      return { success: false, lockedBy: chapter.locked_by };
    }
    // Lock đã hết hạn → cho phép override
  }

  const { error } = await supabase
    .from('chapters')
    .update({
      locked_by: userId,
      locked_at: new Date().toISOString(),
    })
    .eq('id', chapterId);

  if (error) throw error;
  return { success: true };
}

export async function unlockChapter(chapterId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('chapters')
    .update({ locked_by: null, locked_at: null })
    .eq('id', chapterId)
    .eq('locked_by', userId); // Chỉ unlock nếu chính mình đang lock

  if (error) throw error;
}

export async function getChapterLocks(
  projectId: string
): Promise<ChapterLock[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select(`
      id, locked_by, locked_at,
      profiles:locked_by ( full_name )
    `)
    .eq('project_id', projectId)
    .not('locked_by', 'is', null);

  if (error) throw error;

  return (data || []).map((ch: Record<string, unknown>) => {
    const lockedAt = ch.locked_at as string;
    const isExpired = Date.now() - new Date(lockedAt).getTime() > LOCK_DURATION_MS;
    const profiles = ch.profiles as Record<string, unknown> | null;
    return {
      chapter_id: ch.id as string,
      locked_by: ch.locked_by as string,
      locked_at: lockedAt,
      locker_name: (profiles?.full_name as string) || 'Ẩn danh',
      is_expired: isExpired,
    };
  });
}

// ── Helpers ──

function mapMemberRow(row: Record<string, unknown>): ProjectMember {
  const profiles = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    role: row.role as MemberRole,
    invited_by: (row.invited_by as string) || null,
    joined_at: row.joined_at as string,
    user_email: (profiles?.email as string) || undefined,
    user_name: (profiles?.full_name as string) || undefined,
    user_avatar: (profiles?.avatar_url as string) || undefined,
  };
}

// ── Role Labels (tiếng Việt) ──

export const ROLE_LABELS: Record<MemberRole, string> = {
  co_author: '✏️ Đồng tác giả',
  beta_reader: '📖 Beta Reader',
  viewer: '👁️ Người xem',
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  co_author: 'Viết, chỉnh sửa trên nhánh riêng, tạo merge request',
  beta_reader: 'Đọc, bình luận, đánh giá — không chỉnh sửa',
  viewer: 'Chỉ đọc — không bình luận',
};
