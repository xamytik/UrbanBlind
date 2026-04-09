import json
import networkx as nx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from schemas import RouteRequest

async def find_safe_route(session: AsyncSession, req: RouteRequest) -> dict:
    # Шаг А: Поиск ближайших узлов старта и финиша в графе
    closest_node_query = text("""
        SELECT id
        FROM nodes
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
        LIMIT 1;
    """)
    
    start_res = await session.execute(closest_node_query, {"lon": req.start_lon, "lat": req.start_lat})
    start_node_id = start_res.scalar_one()

    end_res = await session.execute(closest_node_query, {"lon": req.end_lon, "lat": req.end_lat})
    end_node_id = end_res.scalar_one()

    # Шаг Б: Загрузка всех ребер для построения in-memory графа
    edges_query = text("""
        SELECT 
            id,
            start_node_id, 
            end_node_id, 
            base_weight, 
            current_risk_weight, 
            ST_AsGeoJSON(geom) as geometry
        FROM edges;
    """)
    
    edges_res = await session.execute(edges_query)
    edges = edges_res.fetchall()

    # Шаг В: Билд графа через NetworkX
    G = nx.Graph()
    edge_geometries = {}

    for edge in edges:
        # Умный комбинированный вес = длина дороги + штраф за уровень угрозы!
        total_weight = edge.base_weight + edge.current_risk_weight
        
        # Добавляем ребро в граф
        G.add_edge(edge.start_node_id, edge.end_node_id, weight=total_weight)
        
        # Кешируем GeoJSON ребра, чтобы моментально собрать геометрию пути (связь двунаправленная)
        edge_geometries[(edge.start_node_id, edge.end_node_id)] = edge.geometry
        edge_geometries[(edge.end_node_id, edge.start_node_id)] = edge.geometry

    # Шаг Г: Алгоритм Дейкстры (или A*) на минимальный суммарный "штрафной" вес
    try:
        path_nodes = nx.shortest_path(G, source=start_node_id, target=end_node_id, weight='weight')
    except nx.NetworkXNoPath:
        return {"type": "FeatureCollection", "features": []}

    # Шаг Д: Сборка финального GeoJSON для отдачи на фронтенд
    features = []
    
    for i in range(len(path_nodes) - 1):
        u = path_nodes[i]
        v = path_nodes[i+1]
        
        geom_json_str = edge_geometries.get((u, v))
        if geom_json_str:
            features.append({
                "type": "Feature",
                "properties": {
                    "is_safe_route": True
                },
                "geometry": json.loads(geom_json_str)
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }
