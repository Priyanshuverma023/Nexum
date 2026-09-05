'use client';

import { useState, useEffect, useRef } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/chat')
      .then((res) => res.json())
      .then(setMessages);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: userMsg.content }),
    });
    const data = await res.json();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: data.reply },
    ]);
    setLoading(false);
  }

  return (
    <main className='flex h-screen flex-col bg-[#0a0a0a] text-zinc-100'>
      {/* Header */}
      <header className='flex items-center gap-3 border-b border-zinc-800 px-6 py-4'>
        <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-sm'>
          N
        </div>
        <div>
          <h1 className='text-sm font-semibold leading-none'>Nexum</h1>
          <p className='text-xs text-zinc-500'>AI email & calendar assistant</p>
        </div>
        <div className='ml-auto flex items-center gap-2 text-xs text-zinc-500'>
          <span className='h-2 w-2 rounded-full bg-emerald-500' />
          Gmail & Calendar connected
        </div>
      </header>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-6 py-6'>
        <div className='mx-auto flex max-w-2xl flex-col gap-4'>
          {messages.length === 0 && !loading && (
            <div className='mt-24 text-center text-zinc-500'>
              <p className='text-sm'>Try something like:</p>
              <p className='mt-2 text-zinc-300'>
                "Schedule a meeting with Ayush tomorrow and email him
                ayush@gmail.com"
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  m.role === 'user'
                    ? 'bg-zinc-700'
                    : 'bg-gradient-to-br from-indigo-500 to-violet-600'
                }`}
              >
                {m.role === 'user' ? 'You' : 'N'}
              </div>
              <div
                className={`max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-tr-sm bg-zinc-800'
                    : 'rounded-tl-sm bg-zinc-900 border border-zinc-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className='flex gap-3'>
              <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-medium'>
                N
              </div>
              <div className='flex items-center gap-1 rounded-2xl rounded-tl-sm border border-zinc-800 bg-zinc-900 px-4 py-3'>
                <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]' />
                <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]' />
                <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500' />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className='border-t border-zinc-800 px-6 py-4'>
        <div className='mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1.5'>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder='Schedule a meeting, send an email, or ask about your inbox...'
            className='flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-600'
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40'
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
