/**
 * File: CollaborationPanel.tsx
 * Purpose: Panel mời cộng tác — invite, quản lý members, xem role
 * Layer: UI Component
 * Domain: Collaboration → [invite, member management]
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, UserPlus, Users, Trash2, ChevronDown, Mail, Shield,
} from 'lucide-react';
import * as collabService from '../../lib/supabase/collaboration_service';
import type { ProjectMember, MemberRole } from '../../lib/supabase/collaboration_service';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../lib/supabase/collaboration_service';
import { useAuthStore } from '../../store/use_auth_store';

interface CollaborationPanelProps {
  projectId: string;
  isOwner: boolean;
  onClose: () => void;
}

type PanelView = 'members' | 'invite';

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  projectId, isOwner, onClose,
}) => {
  const { user } = useAuthStore();
  const [view, setView] = useState<PanelView>('members');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('co_author');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await collabService.listMembers(projectId);
      setMembers(data);
    } catch (err) {
      console.error('[Collab] Load members failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleInvite = async () => {
    if (!user || !email.trim() || inviting) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const result = await collabService.inviteMember(projectId, email.trim(), role, user.id);
      if ('error' in result) {
        setInviteError(result.error);
      } else {
        setInviteSuccess(`Đã mời ${result.user_email || email} thành công!`);
        setEmail('');
        await loadMembers();
      }
    } catch (err) {
      setInviteError('Có lỗi xảy ra, vui lòng thử lại');
      console.error('[Collab] Invite failed:', err);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await collabService.removeMember(memberId);
      await loadMembers();
    } catch (err) {
      console.error('[Collab] Remove failed:', err);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
    try {
      await collabService.updateMemberRole(memberId, newRole);
      await loadMembers();
    } catch (err) {
      console.error('[Collab] Role update failed:', err);
    }
  };

  const ROLE_STYLE: Record<MemberRole, string> = {
    co_author: 'bg-accent-teal/15 text-accent-teal',
    beta_reader: 'bg-accent-amber/15 text-accent-amber',
    viewer: 'bg-bg-elevated text-text-muted',
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-bg-surface border-l border-border-subtle shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pb-4 mb-4 shrink-0">
          <h2 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
            <Users size={16} className="text-accent-teal" />
            {view === 'members' ? 'Thành viên dự án' : 'Mời cộng tác'}
          </h2>
          <div className="flex gap-2">
            {view !== 'members' && (
              <button onClick={() => { setView('members'); setInviteError(''); setInviteSuccess(''); }} className="btn-ghost btn-sm">← Quay lại</button>
            )}
            <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* MEMBERS */}
          {view === 'members' && (
            <div className="space-y-3">
              {isOwner && (
                <button onClick={() => setView('invite')} className="btn-primary btn-sm w-full">
                  <UserPlus size={14} /> Mời người cộng tác
                </button>
              )}

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-accent-teal/30 border-t-accent-teal rounded-full animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={36} className="text-text-muted mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-text-muted">Chưa có thành viên nào</p>
                  {isOwner && <p className="text-xs text-text-muted mt-1">Mời người khác cùng viết, review truyện.</p>}
                </div>
              ) : (
                members.map(m => (
                  <div key={m.id} className="card-interactive">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                        {m.user_avatar ? (
                          <img src={m.user_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-text-muted">{(m.user_name || m.user_email || '?')[0].toUpperCase()}</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{m.user_name || m.user_email}</p>
                        {m.user_email && m.user_name && (
                          <p className="text-[10px] text-text-muted truncate">{m.user_email}</p>
                        )}
                      </div>
                      {/* Role */}
                      {isOwner && m.user_id !== user?.id ? (
                        <div className="relative group">
                          <button className={`badge text-[10px] ${ROLE_STYLE[m.role]} cursor-pointer flex items-center gap-1`}>
                            {ROLE_LABELS[m.role]} <ChevronDown size={10} />
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-bg-surface bg-surface-container-low rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10 min-w-[180px]">
                            {(Object.keys(ROLE_LABELS) as MemberRole[]).map(r => (
                              <button
                                key={r}
                                onClick={() => handleRoleChange(m.id, r)}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-elevated transition-colors ${m.role === r ? 'text-accent-teal font-bold' : 'text-text-secondary'}`}
                              >
                                {ROLE_LABELS[r]}
                                <span className="block text-[9px] text-text-muted">{ROLE_DESCRIPTIONS[r]}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className={`badge text-[10px] ${ROLE_STYLE[m.role]}`}>
                          {m.user_id === user?.id ? '👤 Bạn' : ROLE_LABELS[m.role]}
                        </span>
                      )}
                      {/* Remove */}
                      {isOwner && m.user_id !== user?.id && (
                        <button onClick={() => handleRemove(m.id)} className="btn-ghost btn-sm text-accent-rose">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* INVITE */}
          {view === 'invite' && (
            <div className="space-y-4">
              <div>
                <label className="label">Email người muốn mời</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      className="input-base pl-9"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setInviteError(''); }}
                      placeholder="email@example.com"
                      type="email"
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Vai trò</label>
                <div className="space-y-2">
                  {(Object.keys(ROLE_LABELS) as MemberRole[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        role === r
                          ? 'border-accent-teal/40 bg-accent-teal/5'
                          : 'border-border-subtle bg-bg-elevated hover:border-border-subtle/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Shield size={14} className={role === r ? 'text-accent-teal' : 'text-text-muted'} />
                        <div>
                          <span className="text-sm font-semibold text-text-primary">{ROLE_LABELS[r]}</span>
                          <p className="text-[10px] text-text-muted">{ROLE_DESCRIPTIONS[r]}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {inviteError && (
                <div className="text-sm text-accent-rose bg-accent-rose/10 rounded-lg px-3 py-2">⚠️ {inviteError}</div>
              )}
              {inviteSuccess && (
                <div className="text-sm text-accent-teal bg-accent-teal/10 rounded-lg px-3 py-2">✅ {inviteSuccess}</div>
              )}

              <button
                onClick={handleInvite}
                disabled={!email.trim() || inviting}
                className="btn-primary w-full"
              >
                <UserPlus size={14} />
                {inviting ? 'Đang mời...' : 'Gửi lời mời'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollaborationPanel;
