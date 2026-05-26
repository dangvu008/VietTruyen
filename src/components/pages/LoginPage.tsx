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

import React, { useState } from 'react';
import { useAuthStore } from '../../store/use_auth_store';
import { Sparkles, Feather, Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { isTauriEnvironment } from '../../lib/storage/detect_environment';

const LoginPage: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInAsGuest, isLoading } = useAuthStore();
  const [authMode, setAuthMode] = useState<'choices' | 'email-login' | 'email-signup'>('choices');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isSignup = authMode === 'email-signup';
  const isDesktopApp = isTauriEnvironment();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (isSignup && password.length < 6) {
      setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (isSignup && !agreedToTerms) {
      setErrorMsg('Bạn cần đồng ý với Điều khoản và Chính sách bảo mật.');
      return;
    }

    if (authMode === 'email-login') {
      const { error } = await signInWithEmail(email, password);
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await signUpWithEmail(email, password);
      if (error) setErrorMsg(error.message);
      else {
        setAuthMode('email-login');
        setConfirmPassword('');
        setAgreedToTerms(false);
        setErrorMsg('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
      }
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="min-h-screen flex w-full" style={{ background: '#151310', color: '#e8e1dc', fontFamily: 'Manrope, sans-serif' }}>

      {/* Left Panel: Editorial Branding */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-between p-16" style={{ background: '#1d1b18' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px]" style={{ background: 'rgba(242, 192, 141, 0.08)' }} />
          <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full blur-[100px]" style={{ background: 'rgba(165, 208, 230, 0.05)' }} />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03' }}>
            V
          </div>
          <span className="font-display font-bold text-2xl tracking-tight" style={{ color: '#f2c08d' }}>VietTruyen</span>
        </div>

        <div className="relative z-10 max-w-lg mt-auto mb-32">
          <Feather size={32} className="mb-6 opacity-40" style={{ color: '#d4c4b7' }} />
          <h2 className="text-4xl md:text-5xl font-display font-light leading-snug mb-6" style={{ color: '#f2c08d' }}>
            Nơi những câu chuyện được sinh ra từ trong bóng tối.
          </h2>
          <p className="text-lg leading-relaxed" style={{ color: '#9c8e82' }}>
            VietTruyen kết hợp màn đêm tĩnh lặng cùng công nghệ AI để tạo nên không gian sáng tác hoàn hảo dành riêng cho tác giả Việt Nam.
          </p>
        </div>

        <div className="relative z-10 flex gap-6 text-sm font-medium" style={{ color: '#9c8e82' }}>
          <span>© 2026 VietTruyen</span>
          <a href="#" className="hover:text-[#f2c08d] transition-colors">Điều khoản</a>
          <a href="#" className="hover:text-[#f2c08d] transition-colors">Bảo mật</a>
        </div>
      </div>

      {/* Right Panel: Auth Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 relative">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03' }}>
              V
            </div>
            <span className="font-display font-bold text-2xl tracking-tight" style={{ color: '#f2c08d' }}>VietTruyen</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-display font-bold mb-3" style={{ color: '#e8e1dc' }}>
              {authMode === 'email-signup' ? 'Tạo tài khoản' : 'Chào mừng trở lại'}
            </h1>
            <p className="text-sm" style={{ color: '#9c8e82' }}>
              {authMode === 'email-signup'
                ? 'Đăng ký để bắt đầu hành trình sáng tác của bạn.'
                : 'Đăng nhập để vào không gian sáng tác của bạn.'}
            </p>
          </div>

          {/* Login Card/Area */}
          <div className="space-y-4">
            {authMode === 'choices' ? (
              <>
                <button
                  onClick={() => setAuthMode('email-login')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 group relative overflow-hidden"
                  style={{ background: '#1d1b18', color: '#e8e1dc', border: '1px solid #50453b' }}
                >
                  <Mail size={20} style={{ color: '#d4a574' }} />
                  <span>Đăng nhập với Email</span>
                </button>

                {/* Google Sign In */}
                <button
                  onClick={handleGoogleAuth}
                  disabled={isLoading || isDesktopApp}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden mt-3"
                  style={{ background: '#1d1b18', color: '#e8e1dc' }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(242,192,141,0.05), transparent)' }} />
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-transparent rounded-full animate-spin" style={{ borderTopColor: '#f2c08d' }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  <span>{isLoading ? 'Đang kết nối...' : 'Tiếp tục với Google'}</span>
                </button>

                {/* Guest Mode Bypass */}
                <button
                  onClick={signInAsGuest}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 group relative overflow-hidden mt-3"
                  style={{ background: '#1d1b18', color: '#e8e1dc', border: '1px solid #3a322b' }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(242,192,141,0.05), transparent)' }} />
                  <Sparkles size={20} style={{ color: '#d4a574' }} />
                  <span>Dùng thử không cần đăng nhập</span>
                </button>

                {isDesktopApp && (
                  <p className="px-1 text-xs leading-relaxed" style={{ color: '#9c8e82' }}>
                    Google OAuth hiện chỉ hỗ trợ bản web. Trong ứng dụng desktop, hãy dùng đăng nhập email hoặc chế độ khách.
                  </p>
                )}

              </>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {/* Email */}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9c8e82]" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email của bạn"
                    className="w-full bg-[#1d1b18] text-[#e8e1dc] px-12 py-4 rounded-xl outline-none border border-transparent focus:border-[#d4a574] transition-colors placeholder:text-[#50453b]"
                    required
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9c8e82]" size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu"
                    className="w-full bg-[#1d1b18] text-[#e8e1dc] px-12 py-4 rounded-xl outline-none border border-transparent focus:border-[#d4a574] transition-colors placeholder:text-[#50453b] pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9c8e82] hover:text-[#d4c4b7] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Confirm Password — signup only */}
                {isSignup && (
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9c8e82]" size={20} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Xác nhận mật khẩu"
                      className="w-full bg-[#1d1b18] text-[#e8e1dc] px-12 py-4 rounded-xl outline-none border border-transparent focus:border-[#d4a574] transition-colors placeholder:text-[#50453b] pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9c8e82] hover:text-[#d4c4b7] transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}

                {/* Terms & Privacy — signup only */}
                {isSignup && (
                  <label className="flex items-start gap-3 cursor-pointer group py-1">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div
                        className="w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center peer-checked:border-[#d4a574] peer-checked:bg-[#d4a574]"
                        style={{ borderColor: agreedToTerms ? '#d4a574' : '#50453b', background: agreedToTerms ? '#d4a574' : 'transparent' }}
                      >
                        {agreedToTerms && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#472a03" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-xs leading-relaxed" style={{ color: '#9c8e82' }}>
                      Tôi đồng ý với{' '}
                      <a href="#" className="underline underline-offset-2 hover:text-[#f2c08d] transition-colors" style={{ color: '#d4c4b7' }}>Điều khoản dịch vụ</a>
                      {' '}và{' '}
                      <a href="#" className="underline underline-offset-2 hover:text-[#f2c08d] transition-colors" style={{ color: '#d4c4b7' }}>Chính sách bảo mật</a>
                      {' '}của VietTruyen.
                    </span>
                  </label>
                )}

                {/* Error / Success Message */}
                {errorMsg && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                    style={{
                      background: errorMsg.includes('thành công') ? 'rgba(52,168,83,0.1)' : 'rgba(234,67,53,0.1)',
                      color: errorMsg.includes('thành công') ? '#34A853' : '#EA4335',
                      border: `1px solid ${errorMsg.includes('thành công') ? 'rgba(52,168,83,0.2)' : 'rgba(234,67,53,0.2)'}`,
                    }}
                  >
                    <Shield size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || (isSignup && !agreedToTerms)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03' }}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-transparent rounded-full animate-spin" style={{ borderTopColor: '#472a03' }} />
                  ) : null}
                  <span>{isSignup ? 'Tạo tài khoản' : 'Đăng nhập'}</span>
                </button>

                {/* Toggle login ↔ signup + back */}
                <div className="flex flex-col items-center gap-2 mt-4 text-sm" style={{ color: '#9c8e82' }}>
                  <button type="button" onClick={() => {
                    setAuthMode(isSignup ? 'email-login' : 'email-signup');
                    setErrorMsg('');
                    setConfirmPassword('');
                    setAgreedToTerms(false);
                  }} className="hover:text-[#f2c08d] transition-colors">
                    {isSignup ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
                  </button>
                  <button type="button" onClick={() => {
                    setAuthMode('choices');
                    setErrorMsg('');
                    setConfirmPassword('');
                    setAgreedToTerms(false);
                  }} className="hover:text-[#e8e1dc] transition-colors mt-2 text-xs opacity-70">
                    ← Trở lại
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Info */}
          <div className="mt-10 p-5 rounded-2xl relative overflow-hidden" style={{ background: '#1d1b18' }}>
            <div className="absolute top-0 left-0 w-1 h-full bg-[#F59E0B]" style={{ background: '#f2c08d' }} />
            <div className="flex gap-4">
              <Sparkles size={18} className="shrink-0 mt-0.5" style={{ color: '#f2c08d' }} />
              <div className="text-xs leading-relaxed" style={{ color: '#9c8e82' }}>
                <strong style={{ color: '#d4c4b7' }}>Đăng nhập</strong> để đồng bộ dữ liệu trên đám mây an toàn.<br />
                <strong style={{ color: '#d4c4b7' }}>Chế độ khách</strong> dành cho người dùng nhanh, nhưng dữ liệu chỉ nằm trong trình duyệt của bạn (Local Storage).
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
