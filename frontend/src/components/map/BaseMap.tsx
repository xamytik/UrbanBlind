"use client";

import DeckGL from '@deck.gl/react';
import { FlyToInterpolator, WebMercatorViewport } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CameraScanner } from '../vision/CameraScanner';
import { IncidentDashboard } from '../ui/IncidentDashboard';

let cachedNetworkData: any = null;
let networkFetchPromise: Promise<any> | null = null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const preloadNetworkData = () => {
  if (!networkFetchPromise) {
    networkFetchPromise = fetch(`${API_URL}/api/map/network`).then(res => res.json());
    networkFetchPromise.then(data => { cachedNetworkData = data; }).catch(console.error);
  }
};

const INITIAL_VIEW_STATE = {
  longitude: 49.1088,
  latitude: 55.7963,
  zoom: 14,
  pitch: 45,
  bearing: 0
};

const PinMarker = ({ color }: { color: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill={color} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all duration-200">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3.5" fill="white" stroke="none" />
  </svg>
);

const ExpandableButton = ({ icon, text, onClick, isActive = false, className = "" }: any) => (
  <button
    onClick={onClick}
    className={`group relative flex items-center justify-start w-full h-[54px] rounded-2xl overflow-hidden transition-all duration-300 shadow-sm active:scale-[0.98] ${isActive
      ? 'bg-[#1c3044] text-white'
      : 'bg-white text-[#1c3044] border hover:bg-slate-50'
      } ${className}`}
  >
    <div className="flex items-center justify-center min-w-[54px] h-full shrink-0">
      {icon}
    </div>
    <span className={`font-bold text-[14px]`}>
      {text}
    </span>
  </button>
);

export function BaseMap() {
  const [isMounted, setIsMounted] = useState(false);
  const [networkData, setNetworkData] = useState(null);

  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [userRealLocation, setUserRealLocation] = useState<[number, number] | null>(null);
  const [routeData, setRouteData] = useState(null);
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);

  // A -> B Search State
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startResults, setStartResults] = useState<any[]>([]);
  const [endResults, setEndResults] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<'start' | 'end' | null>(null);
  const [isListening, setIsListening] = useState<'start' | 'end' | null>(null);

  const [incidentRefreshTrigger, setIncidentRefreshTrigger] = useState(0);
  const [showZones, setShowZones] = useState(true);
  const [isVisionEnabled, setIsVisionEnabled] = useState(false);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const fetchNetworkData = useCallback(async (forceReload = false) => {
    try {
      if (cachedNetworkData && !forceReload) {
        setNetworkData(cachedNetworkData);
        return;
      }
      if (forceReload || !networkFetchPromise) {
        networkFetchPromise = fetch(`${API_URL}/api/map/network`).then(res => res.json());
        networkFetchPromise.then(data => { cachedNetworkData = data; }).catch(console.error);
      }
      const data = await networkFetchPromise;
      setNetworkData(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleHazardDetected = useCallback(() => {
    fetchNetworkData(true);
  }, [fetchNetworkData]);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      ws = new WebSocket('ws://localhost:8000/ws/incidents');
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'HAZARD_UPDATED') {
            handleHazardDetected();
            setIncidentRefreshTrigger(Date.now());
          }
        } catch (err) { }
      };
      ws.onclose = () => { reconnectTimeout = setTimeout(connectWebSocket, 3000); };
      ws.onerror = () => ws.close();
    };

    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [handleHazardDetected]);

  useEffect(() => {
    fetchNetworkData();
  }, [fetchNetworkData]);

  const handleViewStateChange = ({ viewState: newViewState }: any) => {
    setViewState(newViewState);
  };

  const buildRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    try {
      const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`);
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        if (osrmData.routes && osrmData.routes.length > 0) {
          setRouteData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: osrmData.routes[0].geometry }]
          } as any);
        }
      }
    } catch (e) {
      console.error("OSRM Routing error:", e);
    }
  }, []);

  useEffect(() => {
    if (startPoint && endPoint) buildRoute(startPoint, endPoint);
  }, [endPoint, startPoint, buildRoute]);

  // Photon API Suggestions
  const fetchSuggestions = async (query: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (!query.trim()) {
      setter([]);
      return;
    }
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=ru`);
      const data = await res.json();
      setter(data.features || []);
    } catch (e) {
      console.error("Photon API Error", e);
    }
  };

  const handleSelectLocation = (result: any, type: 'start' | 'end') => {
    const coords = result.geometry.coordinates;
    const name = result.properties.name || result.properties.street || '';
    const city = result.properties.city || result.properties.state || '';
    const displayName = [name, city].filter(Boolean).join(', ');

    if (type === 'start') {
      setStartPoint([coords[0], coords[1]]);
      setStartQuery(displayName);
      setStartResults([]);
    } else {
      setEndPoint([coords[0], coords[1]]);
      setEndQuery(displayName);
      setEndResults([]);
    }
    setActiveInput(null);
    setViewState({
      longitude: coords[0], latitude: coords[1], zoom: 16, pitch: 45, bearing: 0,
      transitionDuration: 1200, transitionInterpolator: new FlyToInterpolator()
    });
  };

  const startVoiceRecognition = (type: 'start' | 'end') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Ваш браузер не поддерживает голосовой ввод");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(type);
    recognition.onend = () => setIsListening(null);
    recognition.onerror = () => setIsListening(null);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (type === 'start') {
        setStartQuery(transcript);
        fetchSuggestions(transcript, setStartResults);
        setActiveInput('start');
      } else {
        setEndQuery(transcript);
        fetchSuggestions(transcript, setEndResults);
        setActiveInput('end');
      }
    };

    try {
      recognition.start();
    } catch(e) {
      console.error(e);
      setIsListening(null);
    }
  };

  const locateUser = () => {
    const successCb = (lon: number, lat: number) => {
      setUserRealLocation([lon, lat]);
      setViewState((prev: any) => ({
        ...prev, longitude: lon, latitude: lat, zoom: 16, transitionDuration: 1200, transitionInterpolator: new FlyToInterpolator()
      }));
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => successCb(position.coords.longitude, position.coords.latitude),
        () => {
          fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(d => { if(d.longitude) successCb(d.longitude, d.latitude); })
            .catch(() => successCb(49.1233, 55.7887)); // fallback Казань
        },
        { enableHighAccuracy: false, maximumAge: Infinity, timeout: 1500 }
      );
    }
  };

  const handleMapClick = async (info: any) => {
    if (!info.coordinate) return;
    const [lon, lat] = info.coordinate;
    if (!startPoint || (startPoint && endPoint)) {
      setStartPoint([lon, lat]);
      setStartQuery(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      setEndPoint(null);
      setEndQuery('');
      setRouteData(null);
    } else if (startPoint && !endPoint) {
      setEndPoint([lon, lat]);
      setEndQuery(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }
  };

  const networkLayer = useMemo(() => networkData ? new GeoJsonLayer({
    id: 'real-network-edges-layer',
    data: networkData,
    visible: showZones,
    pickable: false,
    stroked: false,
    filled: false,
    extruded: false,
    lineWidthScale: 4,
    getLineColor: (d: any) => {
      const risk = d.properties?.current_risk_weight;
      return risk > 0 ? [220, 50, 50, 255] : [190, 240, 215, 255]; // OPAQUE light emerald (fixes WebGL alpha lag)
    },
    getLineWidth: 1,
    updateTriggers: { getLineColor: [networkData] }
  }) : null, [networkData, showZones]);

  const routeLayer = useMemo(() => routeData ? new GeoJsonLayer({
    id: 'route-line-layer',
    data: routeData,
    stroked: true,
    filled: false,
    lineWidthScale: 5,
    lineWidthMinPixels: 4,
    getLineColor: [28, 48, 68, 255], // #1c3044 route line
    getLineWidth: 2
  }) : null, [routeData]);

  const renderOverlay = () => {
    return (
      <div className={`absolute top-6 left-6 z-20 w-[340px] bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-2xl rounded-[28px] py-6 px-6 text-slate-800 font-sans pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'} flex flex-col`}>

        <h3 className="text-[20px] font-black tracking-tight text-[#1c3044] flex items-center gap-2 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          UrbanBlind
        </h3>

        {/* Умный Поиск A -> B */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Начальная точка</span>
            <input
              value={startQuery}
              onChange={(e) => {
                setStartQuery(e.target.value);
                fetchSuggestions(e.target.value, setStartResults);
              }}
              onFocus={() => setActiveInput('start')}
              placeholder="Введите адрес..."
              className="w-full bg-slate-50 border border-slate-200 rounded-[14px] pl-4 pr-12 py-3.5 text-sm text-[#1c3044] placeholder-slate-400 outline-none focus:border-[#1c3044] transition-all duration-200 ease-out font-medium hover:bg-slate-100"
            />
            <div className="absolute right-2 top-7 flex gap-1">
              <button
                onClick={() => startVoiceRecognition('start')}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${isListening === 'start' ? 'bg-red-100 text-red-500 animate-pulse' : 'text-slate-400 hover:text-[#1c3044]'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              </button>
            </div>

            {activeInput === 'start' && startResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-xl rounded-xl z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                {startResults.map((r: any, i: number) => (
                  <div key={i} onClick={() => handleSelectLocation(r, 'start')} className="px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors duration-200">
                    <p className="text-sm font-bold text-[#1c3044]">{r.properties.name || r.properties.street}</p>
                    <p className="text-xs text-slate-500">{[r.properties.city, r.properties.state, r.properties.country].filter(Boolean).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Конечная точка</span>
            <input
              value={endQuery}
              onChange={(e) => {
                setEndQuery(e.target.value);
                fetchSuggestions(e.target.value, setEndResults);
              }}
              onFocus={() => setActiveInput('end')}
              placeholder="Введите адрес..."
              className="w-full bg-slate-50 border border-slate-200 rounded-[14px] pl-4 pr-12 py-3.5 text-sm text-[#1c3044] placeholder-slate-400 outline-none focus:border-[#1c3044] transition-all duration-200 ease-out font-medium hover:bg-slate-100"
            />
            <div className="absolute right-2 top-7 flex gap-1">
              <button
                onClick={() => startVoiceRecognition('end')}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${isListening === 'end' ? 'bg-red-100 text-red-500 animate-pulse' : 'text-slate-400 hover:text-[#1c3044]'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              </button>
            </div>
            {activeInput === 'end' && endResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-xl rounded-xl z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                {endResults.map((r: any, i: number) => (
                  <div key={i} onClick={() => handleSelectLocation(r, 'end')} className="px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors duration-200">
                    <p className="text-sm font-bold text-[#1c3044]">{r.properties.name || r.properties.street}</p>
                    <p className="text-xs text-slate-500">{[r.properties.city, r.properties.state, r.properties.country].filter(Boolean).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between h-12 mb-4 px-1 mt-auto pt-4 border-t border-slate-100">
          <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest pl-1 leading-tight flex-shrink-0">Зоны Рисков</span>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 m-0 leading-none">
            <input type="checkbox" checked={showZones} onChange={() => setShowZones(!showZones)} className="sr-only peer" />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all active:scale-95 peer-checked:bg-[#1c3044]"></div>
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <ExpandableButton
            onClick={locateUser}
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><circle cx="12" cy="12" r="7" /></svg>}
            text="Найти Меня"
            className="border-slate-200 text-[#1c3044]"
          />

          <ExpandableButton
            onClick={() => setIsVisionEnabled(prev => !prev)}
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="square"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>}
            text={isVisionEnabled ? 'Отключить AI-Зрение' : 'Включить AI-Зрение'}
            isActive={true}
            className="border-transparent bg-[#1c3044] text-white"
          />

          <ExpandableButton
            onClick={async () => {
              try {
                await fetch(`${API_URL}/api/map/reset_risks`, { method: 'POST' });
                handleHazardDetected();
              } catch (e) { console.error(e); }
            }}
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>}
            text="Сброс Рисков"
            className="border-slate-200 text-amber-600 hover:bg-amber-50"
          />

          {(startPoint || endPoint) && (
            <ExpandableButton
              onClick={() => { setStartPoint(null); setStartQuery(''); setEndPoint(null); setEndQuery(''); setRouteData(null); }}
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>}
              text="Сброс Маршрута"
              className="border-slate-200 mt-2 text-red-500"
            />
          )}
        </div>
      </div>
    );
  };

  const renderZoomControls = () => (
    <div className="absolute right-4 top-1/4 flex flex-col gap-3 z-20 pointer-events-auto">
      <button 
        onClick={() => setViewState((prev: any) => ({ ...prev, zoom: Math.min(prev.zoom + 1, 20), transitionDuration: 300, transitionInterpolator: new FlyToInterpolator() }))} 
        className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center text-2xl font-medium text-[#1c3044] hover:bg-slate-100 active:scale-95 transition-all">
        +
      </button>
      <button 
        onClick={() => setViewState((prev: any) => ({ ...prev, zoom: Math.max(prev.zoom - 1, 1), transitionDuration: 300, transitionInterpolator: new FlyToInterpolator() }))} 
        className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center text-3xl font-medium pb-1 text-[#1c3044] hover:bg-slate-100 active:scale-95 transition-all">
        -
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 w-full h-full z-0 font-sans pointer-events-none overflow-hidden bg-slate-50">
      <div className="absolute inset-0 z-20 pointer-events-none">
        {renderOverlay()}
        {renderZoomControls()}
        <IncidentDashboard refreshTrigger={incidentRefreshTrigger} />
        {isVisionEnabled && (
          <CameraScanner onClose={() => setIsVisionEnabled(false)} userLocation={startPoint ?? undefined} onHazardDetected={handleHazardDetected} />
        )}
      </div>
      <div className="absolute inset-0 pointer-events-auto">
        <DeckGL
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          controller={true}
          onClick={handleMapClick}
          getCursor={({ isDragging }) => isDragging ? 'grabbing' : 'crosshair'}
          layers={[networkLayer, routeLayer].filter(Boolean)}
        >
          <Map mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">
            {userRealLocation && (
              <Marker longitude={userRealLocation[0]} latitude={userRealLocation[1]} anchor="center">
                <div className="relative flex items-center justify-center w-6 h-6">
                  <span className="absolute w-full h-full bg-emerald-500 rounded-full animate-ping opacity-75"></span>
                  <span className="relative w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] border-2 border-white"></span>
                </div>
              </Marker>
            )}
            {startPoint && (
              <Marker longitude={startPoint[0]} latitude={startPoint[1]} anchor="bottom">
                <PinMarker color="#304356" />
              </Marker>
            )}
            {endPoint && (
              <Marker longitude={endPoint[0]} latitude={endPoint[1]} anchor="bottom">
                <PinMarker color="#1c3044" />
              </Marker>
            )}
          </Map>
        </DeckGL>
      </div>
    </div>
  );
}
