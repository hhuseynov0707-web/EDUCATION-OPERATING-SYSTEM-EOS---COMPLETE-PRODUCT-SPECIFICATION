'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setSavingEmail(true);
    try {
      await api.patch('/auth/email', { newEmail, currentPassword: emailPwd });
      setEmailMsg({ ok: true, text: 'Email updated. Reloading…' });
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change email.' });
    } finally {
      setSavingEmail(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: 'New password and confirmation do not match.' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: 'Password changed. Use the new password next time you log in.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>My account</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium">{user?.role?.replace('_', ' ')}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change login email</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changeEmail} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">New email</label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Current password (to confirm)</label>
              <Input type="password" value={emailPwd} onChange={(e) => setEmailPwd(e.target.value)} required />
            </div>
            {emailMsg && <p className={emailMsg.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{emailMsg.text}</p>}
            <Button disabled={savingEmail}>{savingEmail ? 'Saving…' : 'Change email'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Current password</label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">New password</label>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Confirm new password</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {msg && <p className={msg.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.text}</p>}
            <Button disabled={saving}>{saving ? 'Saving…' : 'Change password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
