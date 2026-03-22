/**
 * File: LoginPage.tsx
 * Purpose: Login screen with Google OAuth + Guest mode
 * Layer: UI (Page)
 * Domain: Auth → [Google sign-in, guest mode]
 *
 * Data Contract:
 * - Input:  User click actions
 * - Output: Auth state change → redirect to main app
 */

import React from 'react';
import { useAuthStore } from '../../store/use_auth_store';
import { BookOpen, Chrome, ArrowRight, Sparkles } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { signInWithGoogle, continueAsGuest, isLoading } = useAuthStore();

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary mb-6 shadow-lg shadow-accent-primary/20">
            <BookOpen size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            VietTruyện
          </h1>
          <p className="text-text-muted text-sm max-w-xs mx-auto">
            Nền tảng viết truyện AI-powered dành cho tác giả Việt Nam
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-xl">
          <div className="space-y-4">
            {/* Google Sign In */}
            <button
              onClick={signInWithGoogle}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-800 rounded-xl font-medium transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span>{isLoading ? 'Đang kết nối...' : 'Đăng nhập với Google'}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-text-muted text-xs uppercase tracking-wider">hoặc</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>

            {/* Guest Mode */}
            <button
              onClick={continueAsGuest}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated hover:bg-bg-surface text-text-secondary hover:text-text-primary rounded-xl font-medium transition-all duration-200 border border-border-subtle hover:border-border-default disabled:opacity-50"
            >
              <ArrowRight size={18} />
              <span>Dùng thử không cần đăng nhập</span>
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-bg-elevated rounded-xl border border-border-subtle">
            <div className="flex gap-3">
              <Sparkles size={18} className="text-accent-primary shrink-0 mt-0.5" />
              <div className="text-xs text-text-muted leading-relaxed">
                <strong className="text-text-secondary">Đăng nhập</strong> để đồng bộ dữ liệu trên đám mây, truy cập từ nhiều thiết bị.
                <br />
                <strong className="text-text-secondary">Chế độ khách</strong> lưu dữ liệu tại máy, không cần tài khoản.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-6">
          Bằng việc đăng nhập, bạn đồng ý với điều khoản sử dụng
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
