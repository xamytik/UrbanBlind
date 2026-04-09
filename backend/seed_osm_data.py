import asyncio
import osmnx as ox
from shapely.geometry import LineString
from sqlalchemy import text
import sys

sys.path.append(".")

from database import AsyncSessionLocal

async def seed_real_city():
    print("🌍 Подключение к базе данных UrbanBlind...")
    async with AsyncSessionLocal() as session:
        print("🧹 Очистка старых моковых данных из графа...")
        await session.execute(text("TRUNCATE TABLE edges, nodes RESTART IDENTITY CASCADE;"))
        await session.commit()

        print("📡 Скачивание пешеходных дорог ВСЕЙ Казани через OSMnx (может занять 5-10 минут)...")
        G = ox.graph_from_place('Казань, Россия', network_type='walk')
        
        print(f"✅ Граф скачан! Найдено узлов: {len(G.nodes)}, Ребер: {len(G.edges)}")
        
        # ======= Шаг В: Сохранение УЗЛОВ (Массовая пакетная вставка) =======
        print("💾 Быстрый инсерт узлов в PostGIS (массовая загрузка)...")
        nodes_batch = []
        insert_node_query = text("""
            INSERT INTO nodes (id, geom) 
            VALUES (:id, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
        """)
        
        for node_id, data in G.nodes(data=True):
            nodes_batch.append({
                "id": node_id,
                "lon": data['x'],
                "lat": data['y']
            })
            if len(nodes_batch) == 5000:
                await session.execute(insert_node_query, nodes_batch)
                nodes_batch = []
        if nodes_batch:
            await session.execute(insert_node_query, nodes_batch)
            
        # ======= Шаг Г: Сохранение РЕБЕР (Массовая пакетная вставка) =======
        print("💾 Быстрый инсерт дорог в PostGIS и сборка геометрии (массовая загрузка)...")
        edges_batch = []
        insert_edge_query = text("""
            INSERT INTO edges (start_node_id, end_node_id, base_weight, current_risk_weight, geom)
            VALUES (:start_id, :end_id, :weight, 0, ST_GeomFromText(:geom_wkt, 4326))
        """)
        
        for u, v, data in G.edges(data=True):
            length = data.get('length', 10.0)
            if isinstance(length, list):
                length = length[0]
            
            geom = data.get('geometry')
            if geom:
                geom_wkt = geom.wkt
            else:
                u_data = G.nodes[u]
                v_data = G.nodes[v]
                geom_wkt = LineString([(u_data['x'], u_data['y']), (v_data['x'], v_data['y'])]).wkt

            edges_batch.append({
                "start_id": u,
                "end_id": v,
                "weight": float(length),
                "geom_wkt": geom_wkt
            })
            
            if len(edges_batch) == 5000:
                await session.execute(insert_edge_query, edges_batch)
                edges_batch = []
        if edges_batch:
            await session.execute(insert_edge_query, edges_batch)
            
        await session.commit()
    print("🏆 Реальный фрагмент города загружен в движок UrbanBlind!")

if __name__ == "__main__":
    if sys.platform == 'win32':
        # Необходимый патч для Windows и asyncio
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_real_city())
