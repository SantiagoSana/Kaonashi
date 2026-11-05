import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Price } from './Price';
import { MenuItem } from '../lib/types';
import { Sparkles, MessageCircle, Send, X, Plus, Check, Bot } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'concierge';
  text: string;
  attachedDishes?: MenuItem[];
  timestamp: string;
}

export const AiConciergeDrawer: React.FC = () => {
  const { locale, t, addToCart, showNotification } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [addedDishIds, setAddedDishIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'concierge',
      text:
        locale === 'ja'
          ? 'いらっしゃいませ。顔無しのAIソムリエ＆コンシェルジュです。今夜の旬の握り、炭火焼き、日本酒のペアリングやアレルギー対応など、どのようなことでもお尋ねください。'
          : locale === 'en'
          ? 'Welcome to Kaonashi. I am your AI Sommelier & Omakase Concierge. How may I guide your palate tonight? Ask me for sake pairings, gluten-free dishes, or chef recommendations.'
          : 'Bienvenido a Kaonashi. Soy tu Sommelier & Concierge AI. ¿Cómo puedo deleitar tu paladar hoy? Pregúntame sobre maridajes de sake noble, opciones sin gluten o sugerencias Omakase.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const quickChips = [
    t('concierge.quickPairSake') || 'Maridar Sake con Toro',
    t('concierge.quickGlutenFree') || 'Opciones sin gluten',
    t('concierge.quickOmakase') || 'Recomendación Omakase',
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          language: locale,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: 'concierge',
          text: data.reply,
          attachedDishes: data.attachedDishes,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'concierge',
        text:
          locale === 'ja'
            ? '通信が一時的に途切れました。大トロ握りには冷えた獺祭23が最も調和いたします。'
            : locale === 'en'
            ? 'Our connection experienced a ripple. For rich Otoro nigiri, we heartily recommend chilled Dassai 23 Junmai Daiginjo.'
            : 'Una suave brisa interrumpió la conexión. Para el noble Otoro Nigiri recomendamos con devoción el sake Dassai 23 Junmai Daiginjo frío.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDish = (dish: MenuItem) => {
    addToCart(dish);
    setAddedDishIds((prev) => new Set(prev).add(dish.id));
    showNotification(`${dish.names[locale] || dish.names.es} añadido al carrito`);
    setTimeout(() => {
      setAddedDishIds((prev) => {
        const next = new Set(prev);
        next.delete(dish.id);
        return next;
      });
    }, 2000);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 py-3 px-4 rounded-full bg-gradient-to-r from-[#1A1A1D] via-[#2B2B30] to-[#121214] text-[#D4AF37] border border-[#D4AF37]/50 shadow-2xl hover:scale-105 active:scale-95 transition-all"
        >
          {/* Pulsing ring */}
          <span className="absolute -inset-1 rounded-full bg-[#D4AF37]/20 blur-sm group-hover:bg-[#D4AF37]/35 transition-all" />
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">
            <Sparkles size={16} />
          </div>
          <span className="relative text-xs font-bold tracking-wider text-white">
            {t('concierge.title')}
          </span>
        </button>
      </div>

      {/* Slide-in Luxury Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[rgb(var(--surface))] border-l border-[#D4AF37]/30 flex flex-col shadow-2xl">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 bg-[rgb(var(--background))]/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center shadow">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[rgb(var(--text))] flex items-center gap-1.5">
                      <span>{t('concierge.title')}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-[11px] text-[rgb(var(--muted))] line-clamp-1">
                      {t('concierge.subtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full text-[rgb(var(--muted))] hover:text-white bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-medium rounded-br-none shadow-md'
                          : 'bg-[rgb(var(--background))] border border-white/10 text-[rgb(var(--text))] rounded-bl-none shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>

                      {/* Interactive Dish Cards attached by Sommelier */}
                      {m.attachedDishes && m.attachedDishes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider block">
                            Platos Sugeridos por el Maestro:
                          </span>
                          {m.attachedDishes.map((dish) => (
                            <div
                              key={dish.id}
                              className="bg-[rgb(var(--surface))] border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0 text-left">
                                <h5 className="font-bold text-[11px] text-white truncate">
                                  {dish.names[locale] || dish.names.es}
                                </h5>
                                <div className="text-[10px] text-[#D4AF37] font-semibold">
                                  <Price amountMinor={dish.price} />
                                </div>
                              </div>
                              <button
                                onClick={() => handleAddDish(dish)}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                  addedDishIds.has(dish.id)
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#D4AF37] text-black hover:brightness-110 active:scale-95'
                                }`}
                                title="Agregar al carrito"
                              >
                                {addedDishIds.has(dish.id) ? <Check size={14} /> : <Plus size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-[rgb(var(--muted))] mt-1 px-1">
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))] italic bg-white/5 py-2 px-3 rounded-xl w-fit">
                    <Sparkles size={13} className="text-[#D4AF37] animate-spin" />
                    <span>Consultando con el Itamae...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="px-4 py-2 border-t border-white/5 bg-[rgb(var(--background))]/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip)}
                    className="text-[11px] whitespace-nowrap bg-[rgb(var(--surface))] border border-white/10 text-[rgb(var(--muted))] hover:text-white hover:border-[#D4AF37]/50 py-1 px-2.5 rounded-full transition-colors shrink-0"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/10 bg-[rgb(var(--background))]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('concierge.inputPlaceholder')}
                    className="flex-1 bg-[rgb(var(--surface))] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[rgb(var(--muted))] focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
