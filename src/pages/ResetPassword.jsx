import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function ResetPassword() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not update your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthLayout icon={KeyRound} title="Link expired" subtitle="This password reset link is invalid or has expired.">
        <Button className="w-full h-12 rounded-xl font-medium" onClick={() => navigate('/login')}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout icon={KeyRound} title="Password updated" subtitle="Your password has been changed.">
        <Button className="w-full h-12 rounded-xl font-medium" onClick={() => navigate('/')}>
          Continue
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={KeyRound} title="Set a new password" subtitle="Choose a new password for your account">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl mt-1"
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-xl mt-1"
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-medium">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
