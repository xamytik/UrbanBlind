"use client";

import { useState, useEffect } from "react";
import { BaseMap, preloadNetworkData } from "../components/map/BaseMap";

export default function Home() {
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    preloadNetworkData();
  }, []);

  if (!showMap) {
    return (
      <main className="relative w-full h-screen flex flex-col items-center justify-center bg-[#F8FAFC] overflow-hidden">
        {/* Абстрактный геометрический узор на фоне (холодный серый) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.4]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern)" />
          </svg>
        </div>

        <div className="text-center z-10 flex flex-col items-center max-w-2xl px-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {/* Иконка / Логотип (UB) */}
          <div className="w-24 h-24 bg-[#1c3044] rounded-[24px] shadow-xl flex items-center justify-center mb-8 rotate-3 hover:rotate-0 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-[#1c3044] tracking-tight mb-4 drop-shadow-sm">
            UrbanBlind
          </h1>
          <p className="text-lg md:text-xl text-[#304356] mb-12 font-medium tracking-wide max-w-lg mx-auto">
            Надежный навигатор по доступной городской среде.
          </p>
          <button 
            onClick={() => setShowMap(true)}
            className="group relative px-12 py-5 bg-[#1c3044] text-white font-bold text-lg rounded-[16px] shadow-[0_10px_30px_-5px_rgba(28,48,68,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#304356] overflow-hidden"
          >
            <span className="relative z-10">Приступить к работе</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-pearl-gray">
      {/* Интерактивная Карта MapLibre */}
      <BaseMap />
    </main>
  );
}
