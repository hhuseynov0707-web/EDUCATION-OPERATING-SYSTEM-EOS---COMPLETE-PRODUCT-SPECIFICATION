'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface Thread { otherUserId: string; otherName: string; lastBody: string; lastAt: string; unread: number }
interface Contact { userId: string; name: string; role: string }
interface Msg { id: string; mine: boolean; body: string; createdAt: string; student: { firstName: string; lastName: string } | null }
interface AdminMsg { id: string; from: string; fromRole: string; to: string; toRole: string; student: string | null; body: string; createdAt: string; read: boolean }

export default function MessagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const [adminView, setAdminView] = useState(false);
  const [adminMsgs, setAdminMsgs] = useState<AdminMsg[]>([]);

  const loadThreads = useCallback(() => {
    api.get<Thread[]>('/messages/threads').then(setThreads).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadThreads();
    api.get<Contact[]>('/messages/contacts').then(setContacts).catch(() => undefined);
  }, [loadThreads]);

  const openConversation = useCallback((id: string, name: string) => {
    setActive({ id, name });
    setPicking(false);
    api.get<Msg[]>(`/messages/with/${id}`).then((m) => {
      setMessages(m);
      loadThreads();
    }).catch(() => undefined);
  }, [loadThreads]);

  async function send() {
    if (!active || !text.trim()) return;
    await api.post('/messages', { recipientId: active.id, body: text.trim() }).catch(() => undefined);
    setText('');
    openConversation(active.id, active.name);
  }

  function loadAdmin() {
    setAdminView(true);
    api.get<AdminMsg[]>('/messages/admin/all').then(setAdminMsgs).catch(() => undefined);
  }

  if (adminView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">All Messages (oversight)</h1>
          <Button variant="outline" onClick={() => setAdminView(false)}>Back to my inbox</Button>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">When</th><th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th><th className="px-4 py-2">Re: student</th>
                <th className="px-4 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {adminMsgs.map((m) => (
                <tr key={m.id} className="border-t border-border align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{m.from} <span className="text-muted-foreground">({m.fromRole})</span></td>
                  <td className="px-4 py-2">{m.to} <span className="text-muted-foreground">({m.toRole})</span></td>
                  <td className="px-4 py-2 text-muted-foreground">{m.student ?? '—'}</td>
                  <td className="px-4 py-2">{m.body}</td>
                </tr>
              ))}
              {adminMsgs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No messages yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Messages</h1>
        {isAdmin && <Button variant="outline" onClick={loadAdmin}>All messages (oversight)</Button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3" style={{ minHeight: 460 }}>
        {/* Threads / contacts */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Conversations</CardTitle>
            <Button size="sm" variant={picking ? 'outline' : 'default'} onClick={() => setPicking((p) => !p)}>
              {picking ? 'Close' : 'New'}
            </Button>
          </CardHeader>
          <CardContent>
            {picking && (
              <div className="mb-3 max-h-56 overflow-auto rounded-md border border-border">
                {contacts.length === 0 && <p className="p-3 text-sm text-muted-foreground">No contacts available.</p>}
                {contacts.map((c) => (
                  <button
                    key={c.userId}
                    onClick={() => openConversation(c.userId, c.name)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {c.name} <span className="text-muted-foreground">({c.role.toLowerCase()})</span>
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.otherUserId}>
                  <button
                    onClick={() => openConversation(t.otherUserId, t.otherName)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                      active?.id === t.otherUserId && 'bg-muted',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{t.otherName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t.lastBody}</span>
                    </span>
                    {t.unread > 0 && <Badge tone="blue">{t.unread}</Badge>}
                  </button>
                </li>
              ))}
              {threads.length === 0 && !picking && (
                <li className="px-1 py-4 text-sm text-muted-foreground">No conversations yet. Click “New”.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader><CardTitle>{active ? active.name : 'Select a conversation'}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {!active ? (
              <p className="text-sm text-muted-foreground">Pick a conversation on the left, or click “New” to start one.</p>
            ) : (
              <>
                <div className="flex-1 space-y-2 overflow-auto pb-3" style={{ maxHeight: 320 }}>
                  {messages.map((m) => (
                    <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                        m.mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}>
                        {m.student && <div className={cn('mb-0.5 text-xs', m.mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>Re: {m.student.firstName} {m.student.lastName}</div>}
                        {m.body}
                        <div className={cn('mt-0.5 text-[10px]', m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>}
                </div>
                <div className="flex gap-2 border-t border-border pt-3">
                  <Textarea
                    rows={2}
                    placeholder="Write a message…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <Button onClick={send} disabled={!text.trim()}>Send</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
