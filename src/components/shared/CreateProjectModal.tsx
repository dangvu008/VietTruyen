import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { normalizeProjectTitle } from '../../lib/project/project_title';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
  defaultTitle?: string;
  existingTitles?: string[];
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultTitle = 'Tác phẩm mới',
  existingTitles = [],
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setTitle(defaultTitle);
    setError('');

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [defaultTitle, isOpen]);

  if (!isOpen) return null;

  const normalizedTitle = title.trim() || defaultTitle;
  const isDuplicate = existingTitles.some(
    (existingTitle) => normalizeProjectTitle(existingTitle) === normalizeProjectTitle(normalizedTitle)
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDuplicate) {
      setError('Tên tác phẩm này đã tồn tại. Hãy đổi tên hoặc mở tác phẩm cũ để chỉnh sửa.');
      return;
    }

    setError('');
    onConfirm(normalizedTitle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng hộp thoại tạo tác phẩm"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-3xl border border-[#2a2420] bg-[#161210] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl border border-[#f0c59a]/20 bg-[#f0c59a]/10 p-3 text-[#f0c59a]">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#fff3e9]">Tạo tác phẩm mới</h3>
              <p className="mt-1 text-sm leading-6 text-[#8f7f72]">
                Đặt tên trước khi vào workspace. Bạn vẫn có thể đổi lại sau.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#8f7f72] transition-colors hover:bg-white/[0.04] hover:text-[#f2e6dc]"
          >
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8f7f72]">
            Tên tác phẩm
          </label>
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) {
                setError('');
              }
            }}
            className="w-full rounded-2xl border border-[#2a2420] bg-[#0f0d0b] px-4 py-3 text-[#f7ede5] outline-none transition-all placeholder:text-[#6f6259] focus:border-[#f0c59a]/40 focus:ring-1 focus:ring-[#f0c59a]/35"
            placeholder="Ví dụ: Sương Rơi Trên Thành Cũ"
          />
          {(error || isDuplicate) && (
            <p className="mt-2 text-sm text-[#fca5a5]">
              {error || 'Tên tác phẩm này đã tồn tại. Hãy đổi tên hoặc mở tác phẩm cũ để chỉnh sửa.'}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2a2420] px-4 py-2.5 text-sm font-medium text-[#a29081] transition-colors hover:border-white/10 hover:text-[#f2e6dc]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isDuplicate}
            className="rounded-xl bg-[#e5b589] px-4 py-2.5 text-sm font-bold text-[#2c1e16] transition-all hover:bg-[#ebd0b5] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Tạo tác phẩm
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectModal;
