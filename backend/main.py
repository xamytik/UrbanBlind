import random
import os
import base64
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Загружаем .env файл
load_dotenv()

# Инициализируем Gemini Vision клиент
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    print("✅ Gemini Vision API: инициализирован (google.genai)")
else:
    gemini_client = None
    print("⚠️  GEMINI_API_KEY не задан — Vision API будет использовать мок")

# Импортируем нашу RouteRequest
from schemas import RiskZoneCreate, RiskZoneResponse, RouteRequest
from database import AsyncSessionLocal
from services.risk_engine import add_risk_zone_and_diffuse, get_risk_edges_geojson, get_full_network_geojson

# Импортируем новый сервис маршрутизации
from services.routing import find_safe_route

app = FastAPI(
    title="UrbanBlind Core API",
    version="0.1.0"
)

# Настройка CORS: открытый доступ для туннелей и мобильных устройств
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === WebSocket Manager ===
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/incidents")
async def websocket_incidents_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# === Инициализируем планировщик ===
scheduler = AsyncIOScheduler()

async def cleanup_old_incidents():
    """Фоновая задача для очистки инцидентов старше 24 часов и снижения рисков"""
    print("🧹 [APScheduler] Запуск проверки устаревших инцидентов...")
    
    # Открываем независимую сессию для фоновой задачи
    async with AsyncSessionLocal() as db:
        try:
            # Находим edge_id устаревших инцидентов
            find_old = text("""
                SELECT edge_id FROM incidents
                WHERE status = 'verified'
                  AND created_at < NOW() - INTERVAL '24 hours'
            """)
            result = await db.execute(find_old)
            edges_to_clean = [row[0] for row in result.fetchall()]
            
            if not edges_to_clean:
                print("✨ [APScheduler] Устаревших инцидентов нет. Граф чист.")
                return
                
            # Шаг А: Помечаем инциденты как resolved
            resolve_incidents = text("""
                UPDATE incidents
                SET status = 'resolved'
                WHERE status = 'verified'
                  AND created_at < NOW() - INTERVAL '24 hours'
            """)
            await db.execute(resolve_incidents)
            
            # Шаг Б: Снижаем current_risk_weight у найденных рёбер
            for edge_id in edges_to_clean:
                reduce_risk = text("""
                    UPDATE edges
                    SET current_risk_weight = GREATEST(current_risk_weight - 50, 0)
                    WHERE id = :edge_id
                """)
                await db.execute(reduce_risk, {"edge_id": edge_id})
                
            await db.commit()
            print(f"✅ [APScheduler] Устранены риски для {len(edges_to_clean)} инцидентов.")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ [APScheduler] Ошибка очистки графа: {e}")

@app.on_event("startup")
async def startup_event():
    # Запускаем задачу каждый час
    scheduler.add_job(cleanup_old_incidents, 'interval', hours=1)
    scheduler.start()
    print("⏳ Планировщик APScheduler запущен (интервал: 1 час).")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    print("🛑 Планировщик APScheduler корректно остановлен.")

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "engine": "UrbanBlind Core",
        "version": "0.1.0",
        "vision_api": "gemini-2.0-flash (google.genai)" if gemini_client else "mock"
    }

@app.post("/api/risk-zones", response_model=RiskZoneResponse)
async def create_risk_zone(zone_in: RiskZoneCreate, db: AsyncSession = Depends(get_db)):
    zone_id = await add_risk_zone_and_diffuse(db, zone_in)
    return RiskZoneResponse(id=zone_id, message="Risk zone added and diffused successfully.")

@app.get("/api/map/risk-layers")
async def get_risk_layers(db: AsyncSession = Depends(get_db)):
    geojson_data = await get_risk_edges_geojson(db)
    return geojson_data

@app.get("/api/map/network")
async def get_full_network(
    min_lon: float = -180.0,
    min_lat: float = -90.0,
    max_lon: float = 180.0,
    max_lat: float = 90.0,
    db: AsyncSession = Depends(get_db)
):
    """
    Скачивает граф дорог из БД (edges) в формате GeoJSON строго внутри заданного BBox
    (текущего экрана на устройстве) для экономии ОЗУ и работы по всей стране.
    """
    geojson_data = await get_full_network_geojson(db, min_lon, min_lat, max_lon, max_lat)
    return geojson_data

@app.post("/api/route")
async def calculate_route(req: RouteRequest, db: AsyncSession = Depends(get_db)):
    """
    Рассчитывает самый безопасный маршрут между двумя точками с учетом диффузии риска.
    Возвращает список LineString-ов в виде GeoJSON FeatureCollection для Deck.gl.
    """
    route_geojson = await find_safe_route(db, req)
    return route_geojson

# Системный промпт для AI-поводыря (жёсткий, без воды)
VISION_SYSTEM_PROMPT = (
    "Ты — ИИ-поводырь для незрячего человека. "
    "Проанализируй кадр с камеры смартфона (уровень груди). "
    "Ищи ТОЛЬКО физические препятствия прямо по курсу: "
    "ямы, брошенные самокаты, открытые люки, столбы, низкие ветки, бордюры. "
    "Если путь чист и явных преград нет — ответь ровно одним словом: CLEAN. "
    "Если есть угроза — ответь коротким предупреждением на русском языке "
    "(максимум 5-8 слов, например: 'Впереди открытый люк' или 'Осторожно, брошенный самокат'). "
    "Никаких лишних слов, пояснений или вводных фраз."
)

# Мок-препятствия для режима без API ключа
MOCK_HAZARDS = [
    "Внимание, препятствие: припаркованный электросамокат",
    "Осторожно, опасность: глубокая яма в тротуаре",
    "Внимание: низко нависающая ветка дерева",
    "Осторожно: большая лужа перекрывает тротуар",
    "Внимание: строительные леса, сужение прохода",
]

@app.post("/api/vision/analyze")
async def analyze_vision_frame(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Анализирует кадр через Gemini Vision.
    При обнаружении угрозы + координатах пользователя —
    автоматически поднимает риск ближайшего ребра в PostGIS (краудсорсинг).
    """
    image_base64_raw = payload.get("image_base64", "")
    lat = payload.get("lat")
    lon = payload.get("lon")
    force_hazard = payload.get("force_hazard", False)  # ручное тестирование

    if not image_base64_raw:
        return {"hazard_detected": False}

    hazard_detected = False
    message = None

    # === РЕЖИМ ПРИНУДИТЕЛЬНОГО ТЕСТА ===
    if force_hazard:
        hazard_detected = True
        message = random.choice(MOCK_HAZARDS)

    # === БОЕВОЙ РЕЖИМ: google.genai SDK ===
    elif gemini_client:
        try:
            if "," in image_base64_raw:
                image_base64_clean = image_base64_raw.split(",", 1)[1]
            else:
                image_base64_clean = image_base64_raw

            image_bytes = base64.b64decode(image_base64_clean)

            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    VISION_SYSTEM_PROMPT
                ]
            )

            ai_response_text = response.text.strip()
            print(f"🔍 Gemini Vision: '{ai_response_text}'")

            if "clean" in ai_response_text.lower():
                hazard_detected = False
            else:
                hazard_detected = True
                message = ai_response_text

        except Exception as e:
            print(f"❌ Ошибка Gemini Vision API: {e}")
            return {"hazard_detected": False}

    # === МОК-РЕЖИМ: нет ключа ===
    else:
        if random.random() < 0.3:
            hazard_detected = True
            message = random.choice(MOCK_HAZARDS)

    # === INCIDENT MANAGEMENT: консенсус вместо прямого UPDATE ===
    if hazard_detected and lat is not None and lon is not None:
        try:
            # Шаг А: Найти ближайшее ребро
            edge_query = text("""
                SELECT id FROM edges
                ORDER BY ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                )
                LIMIT 1
            """)
            edge_result = await db.execute(edge_query, {"lat": lat, "lon": lon})
            edge_id = edge_result.scalar_one_or_none()

            if edge_id is not None:
                # Шаг Б: Создать запись инцидента со статусом 'pending'
                insert_incident = text("""
                    INSERT INTO incidents (edge_id, geom, description, confidence, status)
                    VALUES (
                        :edge_id,
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                        :description,
                        1.0,
                        'pending'
                    )
                """)
                await db.execute(insert_incident, {
                    "edge_id": edge_id,
                    "lon": lon,
                    "lat": lat,
                    "description": message or "Неизвестное препятствие"
                })
                print(f"📋 Инцидент создан: edge_id={edge_id}, '{message}'")

                # Шаг В: Консенсус — pending-инциденты на этом ребре за 15 мин
                consensus_query = text("""
                    SELECT COUNT(*) FROM incidents
                    WHERE edge_id = :edge_id
                      AND status   = 'pending'
                      AND created_at >= NOW() - INTERVAL '15 minutes'
                """)
                count_result = await db.execute(consensus_query, {"edge_id": edge_id})
                incident_count = count_result.scalar_one()
                print(f"🔢 Инцидентов на edge {edge_id} за 15 мин: {incident_count}")

                # Шаг Г: Консенсус достигнут — верифицируем и поднимаем риск
                if incident_count >= 2:
                    verify_incidents = text("""
                        UPDATE incidents
                        SET status = 'verified'
                        WHERE edge_id    = :edge_id
                          AND status     = 'pending'
                          AND created_at >= NOW() - INTERVAL '15 minutes'
                    """)
                    await db.execute(verify_incidents, {"edge_id": edge_id})

                    raise_risk = text("""
                        UPDATE edges
                        SET current_risk_weight = current_risk_weight + 50
                        WHERE id = :edge_id
                    """)
                    await db.execute(raise_risk, {"edge_id": edge_id})
                    print(f"🚨 КОНСЕНСУС! Риск +50 для ребра {edge_id} ({incident_count} подтверждения)")

                    # Мгновенное оповещение фронтенда
                    await manager.broadcast('{"type": "HAZARD_UPDATED"}')

            await db.commit()

        except Exception as e:
            print(f"❌ Ошибка Incident Management: {e}")
            await db.rollback()

    if hazard_detected:
        return {"hazard_detected": True, "message": message}
    return {"hazard_detected": False}

# === НОВЫЙ ЭНДПОИНТ: Dashboard инцидентов ===
@app.get("/api/incidents")
async def get_recent_incidents(db: AsyncSession = Depends(get_db)):
    """
    Возвращает последние 20 инцидентов для дашборда модератора.
    """
    query = text("""
        SELECT id, description, status, confidence, created_at
        FROM incidents
        ORDER BY created_at DESC
        LIMIT 20
    """)
    result = await db.execute(query)
    
    incidents = []
    for row in result.fetchall():
        incidents.append({
            "id": row[0],
            "description": row[1],
            "status": row[2],
            "confidence": row[3],
            "created_at": row[4].isoformat() if row[4] else None
        })
    return incidents

@app.post("/api/map/reset_risks")
async def reset_risks(db: AsyncSession = Depends(get_db)):
    """
    Сбрасывает все риски и инциденты — для демо-режима и модератора.
    """
    await db.execute(text("UPDATE edges SET current_risk_weight = 0"))
    await db.execute(text("UPDATE incidents SET status = 'resolved'"))
    await db.commit()
    print("♻️ Все риски и инциденты сброшены")
    return {"status": "success", "message": "Риски сброшены"}
