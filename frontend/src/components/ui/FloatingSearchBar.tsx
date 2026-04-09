"use client";

import { Mic, Search } from "lucide-react";
import { motion } from "framer-motion";

export function FloatingSearchBar() {
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center bg-glass-white backdrop-blur-glass shadow-glass rounded-full px-4 py-3 border border-white/40"
      >
        <Search className="w-5 h-5 text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="Куда отправимся?"
          className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 font-sans"
        />

        <div className="flex items-center ml-2 space-x-3">
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <Mic className="w-5 h-5" />
          </button>

          {/* ИИ "Юби": Пульсирующий кружок */}
          <div className="relative flex items-center justify-center cursor-pointer group">
            <span className="absolute inline-flex h-full w-full rounded-full bg-route-indigo opacity-30 group-hover:opacity-50 animate-ping transition-opacity"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-route-indigo"></span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
