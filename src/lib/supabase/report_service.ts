/**
 * File: report_service.ts
 * Purpose: Supabase CRUD service cho báo cáo lỗi truyện public
 * Layer: Infrastructure (Service)
 * Domain: Community → [report submission, author report management]
 *
 * Data Contract:
 * - Input:  CreateReportInput, report status updates
 * - Output: StoryReport[]
 * - Allowed Deps: supabase_client, report types ONLY
 */

import { supabase } from './supabase_client';
import type {
  StoryReport,
  CreateReportInput,
  ReportStatus,
} from '../../types/report';

// ── Submit Report (Reader) ──

export async function submitReport(
  reporterId: string,
  input: CreateReportInput
): Promise<StoryReport> {
  const { data, error } = await (supabase
    .from('story_reports') as any)
    .insert({
      story_id: input.story_id,
      reporter_id: reporterId,
      chapter_index: input.chapter_index ?? null,
      category: input.category,
      excerpt: input.excerpt || null,
      description: input.description,
    })
    .select()
    .single();

  if (error) throw error;
  return mapReportRow(data);
}

// ── Fetch Reports for Story (Author) ──

export async function fetchReportsForStory(storyId: string): Promise<StoryReport[]> {
  const { data, error } = await supabase
    .from('story_reports')
    .select(`
      *,
      profiles:reporter_id ( full_name, avatar_url )
    `)
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapReportRow);
}

// ── Fetch Reports I submitted (Reader) ──

export async function fetchMyReports(userId: string): Promise<StoryReport[]> {
  const { data, error } = await supabase
    .from('story_reports')
    .select('*')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapReportRow);
}

// ── Update Report Status (Author) ──

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  authorNote?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (authorNote !== undefined) {
    patch.author_note = authorNote;
  }

  const { error } = await supabase
    .from('story_reports')
    .update(patch)
    .eq('id', reportId);

  if (error) throw error;
}

// ── Count open reports for a story (badge) ──

export async function getOpenReportCount(storyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('story_reports')
    .select('*', { count: 'exact', head: true })
    .eq('story_id', storyId)
    .eq('status', 'open');

  if (error) throw error;
  return count || 0;
}

// ── Helpers ──

function mapReportRow(row: Record<string, unknown>): StoryReport {
  const profiles = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    story_id: row.story_id as string,
    reporter_id: row.reporter_id as string,
    chapter_index: (row.chapter_index as number) ?? null,
    category: (row.category as StoryReport['category']) || 'other',
    excerpt: (row.excerpt as string) || null,
    description: (row.description as string) || '',
    status: (row.status as StoryReport['status']) || 'open',
    author_note: (row.author_note as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    reporter_name: (profiles?.full_name as string) || 'Ẩn danh',
    reporter_avatar: (profiles?.avatar_url as string) || undefined,
  };
}
