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
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: input };
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
    <main className="flex h-screen flex-col bg-black text-white">
  <div className="flex-1 overflow-y-auto p-6">
    <div className="mx-auto max-w-2xl space-y-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-lg rounded-lg px-4 py-2 ${
            m.role === 'user' ? 'ml-auto bg-white text-black' : 'bg-zinc-800'
          }`}
        >
          {m.content}
        </div>
      ))}
      {loading && <div className="text-zinc-500">Thinking...</div>}
      <div ref={bottomRef} />
    </div>
  </div>

  <div className="border-t border-zinc-800 p-4">
    <div className="mx-auto flex max-w-2xl gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        placeholder='Try: "schedule meet with Ayush and email him"'
        className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 outline-none"
      />
      <button
        onClick={sendMessage}
        className="rounded-lg bg-white px-4 py-2 text-black font-medium"
      >
        Send
      </button>
    </div>
  </div>
</main>
  );
}