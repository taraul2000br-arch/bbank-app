import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { CustomerSupportChat } from "./CustomerSupportChat";
import { getMyUnreadCount } from "@/lib/chat.functions";

export function FloatingChatWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Poll for unread messages count every 8 seconds
  useEffect(() => {
    if (pathname === "/support") return;
    let active = true;
    const fetchUnread = async () => {
      try {
        const res = await getMyUnreadCount();
        if (active) {
          setUnreadCount(res.unreadCount);
        }
      } catch (err) {
        // Silently handle if unauthenticated or network drop
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pathname]);

  // When on the dedicated /support page, suppress floating widget completely
  if (pathname === "/support") {
    return null;
  }

  // When chat is opened, clear unread badge locally
  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating launcher trigger button */}
      {!isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-5 md:right-7 z-40 select-none">
          <button
            onClick={handleOpen}
            aria-label="Open Customer Support with Camila Ricci"
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-[#002D62] hover:bg-[#00395D] text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-[1.02] border border-sky-400/30"
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5 text-sky-300 group-hover:text-white transition" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold leading-tight flex items-center gap-1">
                Camila Ricci
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              </p>
              <p className="text-[10px] text-sky-200 leading-tight">Customer Support</p>
            </div>
          </button>
        </div>
      )}

      {/* Floating Chat Window rendered via Portal directly to body */}
      {/* Strict Modal Rule: Explicit close only. Zero backdrop click dismiss. Zero ESC dismiss. */}
      {isOpen && mounted &&
        createPortal(
          <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-[9999] pointer-events-none flex flex-col justify-end items-end">
            <div className="pointer-events-auto w-full h-[100dvh] sm:h-[min(620px,calc(100dvh-2.5rem))] sm:w-[410px] sm:max-w-[calc(100vw-2.5rem)] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              <CustomerSupportChat mode="widget" onClose={handleClose} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
