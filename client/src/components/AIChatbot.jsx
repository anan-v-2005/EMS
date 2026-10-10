import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, RotateCcw, Send, Sparkles, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";

const starterPrompts = [
  "How does attendance work?",
  "How do I apply for leave?",
  "Explain payslips",
];

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I’m your EMS AI Assistant. Ask me about attendance, leave, employees, payslips, settings, or how the system works.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const sendMessageRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const sendMessage = async (value = input) => {
    const content = value.trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await api.post("/ai/chat", {
        message: content,
        history: next.slice(-8),
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: res.data.answer || "I couldn't generate a response.",
        },
      ]);
    } catch (error) {
      const message =
        error.response?.data?.error ||
        "The assistant is temporarily unavailable.";
      toast.error(message);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I’m having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    const handler = (event) => {
      const prompt = event.detail;
      if (!prompt) return;
      setOpen(true);
      setTimeout(() => sendMessageRef.current?.(prompt), 120);
    };
    window.addEventListener("ems-ai-prompt", handler);
    return () => window.removeEventListener("ems-ai-prompt", handler);
  }, []);

  const clearChat = () =>
    setMessages([
      {
        role: "assistant",
        content: "New conversation started. What would you like to know about EMS?",
      },
    ]);

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 20 }}
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(true)}
            aria-label="Open EMS AI Assistant"
            className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/25 ring-4 ring-white/80 transition-shadow hover:shadow-2xl hover:shadow-indigo-500/30"
          >
            <MessageCircle className="h-6 w-6" strokeWidth={2} />
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.section
            ref={panelRef}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed bottom-5 right-5 z-[60] flex h-[min(680px,calc(100vh-40px))] w-[min(420px,calc(100vw-40px))] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.25)]"
          >
            {/* Header */}
            <header className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-white px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                    <Sparkles className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
                      EMS AI Assistant
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Online • Gemini-powered
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={clearChat}
                    aria-label="Clear chat"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-5">
              {/* Starter Prompts */}
              {messages.length === 1 && (
                <div className="mb-6 space-y-3">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Suggested questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message List */}
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${message.role}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-2.5 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                        <Bot className="h-4 w-4" strokeWidth={2} />
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                        message.role === "user"
                          ? "rounded-br-md bg-slate-900 text-white shadow-sm"
                          : "rounded-bl-md border border-slate-200/80 bg-white text-slate-700 shadow-sm"
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.role === "user" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                        <User className="h-4 w-4" strokeWidth={2} />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Typing Indicator */}
                {sending && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                      <Bot className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"
                            style={{ animationDelay: `${i * 140}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input Area */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
              className="shrink-0 border-t border-slate-100 bg-white p-4"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 transition-all focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  maxLength={1200}
                  placeholder="Ask about attendance, leave, payslips..."
                  className="max-h-28 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              <p className="mt-2.5 px-1 text-center text-[10px] text-slate-400">
                AI can make mistakes. Avoid sharing sensitive information.
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}