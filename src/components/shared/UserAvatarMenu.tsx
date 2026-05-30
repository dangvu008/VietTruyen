import React, { useRef, useState, useEffect } from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserAvatarMenuProps {
  user: SupabaseUser;
  onSignOut: () => void;
  onOpenSettings?: () => void;
}

const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({ user, onSignOut, onOpenSettings }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const displayName = user.user_metadata?.full_name || user.email || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;
  const email = user.email || '';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f0c59a]/20 bg-[#241c17] text-xs font-bold text-[#f0c59a] transition-all hover:border-[#f0c59a]/40 hover:shadow-[0_0_12px_rgba(240,197,154,0.15)]"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="User" className="h-full w-full object-cover" />
        ) : (
          displayName[0].toUpperCase()
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-white/10 bg-[#1a1514] shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f0c59a]/20 bg-[#241c17] text-sm font-bold text-[#f0c59a]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User" className="h-full w-full object-cover" />
                ) : (
                  displayName[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#f5ede4] truncate">{displayName}</p>
                <p className="text-[11px] text-[#6e6257] truncate">{email}</p>
              </div>
            </div>
          </div>

          <div className="py-1.5">
            {onOpenSettings && (
              <button
                onClick={() => { setOpen(false); onOpenSettings(); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#a29081] hover:bg-white/[0.04] hover:text-[#f5ede4] transition-colors"
              >
                <Settings size={15} />
                <span>Cài đặt</span>
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#a29081] hover:bg-white/[0.04] hover:text-[#f5ede4] transition-colors"
            >
              <User size={15} />
              <span>Tài khoản</span>
            </button>
          </div>

          <div className="border-t border-white/5 py-1.5">
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-red-400/80 hover:bg-red-500/[0.06] hover:text-red-400 transition-colors"
            >
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatarMenu;
