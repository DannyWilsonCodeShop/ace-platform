import { useState, useEffect } from 'react';
import { signIn, signOut, getCurrentUser, fetchAuthSession, confirmSignIn } from 'aws-amplify/auth';

interface CustomAuthProps {
  children: (props: { user: any; signOut: () => void }) => React.ReactNode;
}

export default function CustomAuth({ children }: CustomAuthProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      setUser({ ...currentUser, session });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSigningIn(true);
    try {
      const result = await signIn({ username: email, password });
      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNeedsNewPassword(true);
      } else if (result.isSignedIn) {
        await checkUser();
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSigningIn(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSigningIn(true);
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        await checkUser();
      }
    } catch (err: any) {
      setError(err.message || 'Password change failed');
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e]">
        <div className="text-[#a0a0a0] animate-pulse">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <>{children({ user, signOut: handleSignOut })}</>;
  }

  // New password required screen
  if (needsNewPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] p-4" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(0,180,216,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(233,30,140,0.05) 0%, transparent 50%)'
      }}>
        <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.06)] rounded-2xl p-10 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00b4d8] via-[#7b2ff7] to-[#e91e8c] bg-clip-text text-transparent">ACE Portal</h1>
            <p className="text-[#a0a0a0] text-sm mt-2">Set your new password</p>
          </div>
          <form onSubmit={handleNewPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-[#a0a0a0] mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-white focus:border-[#7b2ff7] focus:outline-none transition-colors" required />
            </div>
            {error && <p className="text-[#e91e8c] text-sm">{error}</p>}
            <button type="submit" disabled={signingIn}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-[#00b4d8] via-[#7b2ff7] to-[#e91e8c] hover:opacity-90 transition-opacity">
              {signingIn ? 'Setting...' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Login screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] p-4" style={{
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(0,180,216,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(233,30,140,0.05) 0%, transparent 50%)'
    }}>
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.06)] rounded-2xl p-10 max-w-md w-full shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00b4d8] via-[#7b2ff7] to-[#e91e8c] bg-clip-text text-transparent">ACE Portal</h1>
          <p className="text-[#a0a0a0] text-sm mt-2">Atlanta Creative Exchange</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0e0e0e] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:border-[#7b2ff7] focus:outline-none transition-colors"
              placeholder="your@email.com" required />
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0e0e0e] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:border-[#7b2ff7] focus:outline-none transition-colors"
              placeholder="••••••••" required />
          </div>
          {error && <p className="text-[#e91e8c] text-sm">{error}</p>}
          <button type="submit" disabled={signingIn}
            className="w-full py-3.5 rounded-lg font-semibold text-white bg-gradient-to-r from-[#00b4d8] via-[#7b2ff7] to-[#e91e8c] hover:opacity-90 transition-opacity shadow-lg shadow-[rgba(123,47,247,0.3)]">
            {signingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[#555] text-xs mt-8">&copy; 2026 Atlanta Creative Exchange</p>
      </div>
    </div>
  );
}
