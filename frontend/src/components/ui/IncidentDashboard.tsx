"use client";

import { useEffect, useState } from 'react';

type Incident = {
  id: number;
  description: string;
  status: string;
  confidence: number;
  created_at: string;
};

interface IncidentDashboardProps {
  refreshTrigger: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function IncidentDashboard({ refreshTrigger }: IncidentDashboardProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isOpen, setIsOpen] = useState(false); 

  useEffect(() => {
    fetch(`${API_URL}/api/incidents`)
      .then(res => res.json())
      .then(data => setIncidents(data))
      .catch(err => console.error("Ошибка загрузки инцидентов:", err));
  }, [refreshTrigger]);

  useEffect(() => {
    if (refreshTrigger === 0) return;
    setIsOpen(true);
    const timer = setTimeout(() => { setIsOpen(false); }, 8000);
    return () => clearTimeout(timer);
  }, [refreshTrigger]);

  return (
    <>
      {/* Кнопка открытия лога (когда лог закрыт) */}
      <div className={`absolute top-6 right-6 z-20 pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${!isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div 
          className="p-6 -m-6 group/wrapper cursor-pointer flex items-center justify-end"
          onClick={() => setIsOpen(true)}
        >
          <button 
            className="group relative flex items-center justify-end h-[48px] w-[48px] rounded-full overflow-hidden bg-white/90 backdrop-blur-xl border border-slate-200 shadow-lg text-slate-700 hover:text-slate-900 transition-all duration-500 group-hover/wrapper:w-[130px] group-hover/wrapper:-translate-y-[4px]"
            style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            <span className="whitespace-nowrap font-bold text-[13px] opacity-0 group-hover/wrapper:opacity-100 transition-opacity duration-300 pr-2">
              Лог угроз
            </span>
            <div className="flex items-center justify-center min-w-[48px] h-full shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            </div>
          </button>
        </div>
      </div>

      {/* Основная панель (когда открыта) */}
      <div className={`absolute top-6 right-6 z-20 w-72 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-3xl p-4 overflow-hidden flex flex-col max-h-64 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'}`}>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-[11px] font-bold tracking-wider uppercase text-[#1c3044] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1c3044] animate-pulse"></span>
            Лог Угроз
          </h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
            title="Свернуть"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        
        <div className="overflow-y-auto pr-2 flex-1 flex flex-col gap-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          {incidents.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-4 font-medium">Активных угроз нет</p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                    incident.status === 'verified' 
                      ? 'bg-red-50 text-red-600 border-red-100' 
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {incident.status === 'verified' ? 'Подтверждено' : 'Ожидает'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono font-medium">
                    {new Date(incident.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-tight font-medium">
                  {incident.description}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
