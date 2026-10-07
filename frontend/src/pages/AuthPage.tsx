import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap,
  Layers,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface AuthPageProps {
  initialMode?: 'sign-in' | 'sign-up';
}

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'sign-in' }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clerk hooks (active if Clerk is mounted)
  let signInHook: ReturnType<typeof useSignIn> | null = null;
  let signUpHook: ReturnType<typeof useSignUp> | null = null;

  try {
    if (CLERK_KEY) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      signInHook = useSignIn();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      signUpHook = useSignUp();
    }
  } catch {
    // If ClerkProvider is not present, hooks gracefully ignored
  }

  // Handle OAuth Social Sign In (Google / GitHub)
  const handleSocialAuth = async (strategy: 'oauth_google' | 'oauth_github') => {
    if (!signInHook?.signIn) {
      toast.error('Clerk authentication is not initialized');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signInHook.signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/overview',
      });
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = (err as { errors?: Array<{ message: string }> })?.errors?.[0]?.message || 'Social login failed';
      setError(msg);
    }
  };

  // Handle Email Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password');
      return;
    }
    setError(null);
    setIsLoading(true);

    if (!signInHook?.signIn) {
      // Fallback demo mode
      localStorage.setItem('tokentrail_token', 'dev_user_admin');
      toast.success('Logged in as Demo User');
      navigate('/overview');
      return;
    }

    try {
      const result = await signInHook.signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await signInHook.setActive({ session: result.createdSessionId });
        toast.success('Welcome back!');
        navigate('/overview');
      } else {
        setError(`Unexpected authentication status: ${result.status}`);
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: Array<{ message: string }> })?.errors?.[0]?.message || 'Invalid email or password';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Email Sign Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError(null);
    setIsLoading(true);

    if (!signUpHook?.signUp) {
      localStorage.setItem('tokentrail_token', 'dev_user_admin');
      toast.success('Account created in Demo Mode');
      navigate('/overview');
      return;
    }

    try {
      await signUpHook.signUp.create({
        emailAddress: email.trim(),
        password,
      });

      // Send verification code
      await signUpHook.signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      setIsVerifying(true);
      toast.info('Verification code sent to your email');
    } catch (err: unknown) {
      const msg = (err as { errors?: Array<{ message: string }> })?.errors?.[0]?.message || 'Sign up failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verification Code Submission
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }
    setError(null);
    setIsLoading(true);

    if (!signUpHook?.signUp) return;

    try {
      const completeSignUp = await signUpHook.signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (completeSignUp.status === 'complete') {
        await signUpHook.setActive({ session: completeSignUp.createdSessionId });
        toast.success('Account verified successfully!');
        navigate('/overview');
      } else {
        setError(`Verification status: ${completeSignUp.status}`);
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: Array<{ message: string }> })?.errors?.[0]?.message || 'Invalid verification code';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Quick Demo Mode Bypass
  const handleDemoAccess = () => {
    localStorage.setItem('tokentrail_token', 'dev_user_admin');
    toast.success('Entering dashboard in Demo Mode');
    navigate('/overview');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/15 overflow-hidden">
            <img src="/icon.png" alt="TokenTrail Logo" className="w-7 h-7 object-contain" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-white">TokenTrail</span>
          </div>
        </Link>

        <Link
          to="/"
          className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
        >
          <span>Back to Landing</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: TokenTrail Value Proposition & Features */}
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Production-Grade LLM Observability</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Monitor, trace, and optimize your{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                AI agents in real-time
              </span>
              .
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
              TokenTrail instruments your multi-step RAG pipelines and LLM applications with sub-millisecond overhead, hierarchical span inspection, and token cost attribution.
            </p>
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">0.013ms Latency Overhead</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Async background workers never block your LLM responses or agent execution.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Waterfall Span Tree</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track TTFT, tool execution, and hierarchical multi-agent spans in real-time.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/30">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Dynamic Cost Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time dynamic pricing per 1M tokens across all models and providers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/30">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Multi-Project Isolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dedicated API keys and isolated telemetry pipelines for each of your AI apps.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: 100% Native TokenTrail Dark Theme Auth Card */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-7 shadow-2xl space-y-6">
            {/* Header Tabs: Sign In / Create Account */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isVerifying
                    ? 'Verify Your Email'
                    : mode === 'sign-in'
                    ? 'Sign in to TokenTrail'
                    : 'Create your account'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isVerifying
                    ? 'Enter the 6-digit code sent to your email'
                    : mode === 'sign-in'
                    ? 'Welcome back! Select a sign-in method to continue'
                    : 'Get started with free zero-overhead LLM monitoring'}
                </p>
              </div>
            </div>

            {/* Mode Toggle Pills (when not verifying) */}
            {!isVerifying && (
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in');
                    setError(null);
                  }}
                  className={`py-2 rounded-lg transition-all ${
                    mode === 'sign-in'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up');
                    setError(null);
                  }}
                  className={`py-2 rounded-lg transition-all ${
                    mode === 'sign-up'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            {/* Verification Form */}
            {isVerifying ? (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Verify and Continue</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsVerifying(false)}
                  className="w-full text-xs text-slate-400 hover:text-white text-center font-medium pt-1"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth('oauth_google')}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-100 hover:text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialAuth('oauth_github')}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-100 hover:text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-800 w-full" />
                  <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider absolute">
                    or with email
                  </span>
                </div>

                {/* Email Form */}
                <form
                  onSubmit={mode === 'sign-in' ? handleEmailSignIn : handleEmailSignUp}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{mode === 'sign-in' ? 'Sign In to TokenTrail' : 'Create Free Account'}</span>
                  </button>
                </form>

                {/* Quick Demo Access Option */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleDemoAccess}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>⚡ Quick Demo Mode: Enter as demo user</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-5 text-center text-xs text-slate-400 border-t border-slate-900 bg-slate-950/80">
        TokenTrail &copy; {new Date().getFullYear()} &mdash; Zero-overhead LLM Observability & Cost Tracking.
      </footer>
    </div>
  );
};
