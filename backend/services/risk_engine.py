import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from schemas import RiskZoneCreate

async def add_risk_zone_and_diffuse(session: AsyncSession, zone_in: RiskZoneCreate) -> int:
    # Шаг А: Вставка новой зоны риска и получение её ID
    insert_query = text("""
        INSERT INTO risk_zones (intensity, radius, geom)
        VALUES (:intensity, :radius, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326))
        RETURNING id;
    """)
    result = await session.execute(
        insert_query,
        {
            "intensity": zone_in.intensity,
            "radius": zone_in.radius,
            "longitude": zone_in.longitude,
            "latitude": zone_in.latitude
        }
    )
    new_zone_id = result.scalar_one()

    # Шаг Б: Диффузия риска — увеличиваем текущий вес (current_risk_weight) для улиц, попавших в радиус
    update_query = text("""
        UPDATE edges
        SET current_risk_weight = current_risk_weight + :intensity
        WHERE ST_DWithin(
            geom::geography, 
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, 
            :radius
        );
    """)
    await session.execute(
        update_query,
        {
            "intensity": zone_in.intensity,
            "radius": zone_in.radius,
            "longitude": zone_in.longitude,
            "latitude": zone_in.latitude
        }
    )

    # Фиксируем транзакцию
    await session.commit()
    
    return new_zone_id


async def get_risk_edges_geojson(session: AsyncSession) -> dict:
    """
    Извлекает из базы дороги с ненулевым риском и формирует FeatureCollection
    """
    query = text("""
        SELECT 
            id,
            current_risk_weight,
            base_weight,
            ST_AsGeoJSON(geom) as geometry
        FROM edges
        WHERE current_risk_weight > 0;
    """)
    result = await session.execute(query)
    rows = result.fetchall()

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "properties": {
                "id": row.id,
                "current_risk_weight": row.current_risk_weight,
                "base_weight": row.base_weight
            },
            # ST_AsGeoJSON возвращает строку, поэтому парсим её в dict
            "geometry": json.loads(row.geometry)
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }

async def get_full_network_geojson(
    session: AsyncSession, 
    min_lon: float, 
    min_lat: float, 
    max_lon: float, 
    max_lat: float
) -> dict:
    try:
        query = text("""
            SELECT 
                id,
                base_weight,
                current_risk_weight,
                ST_AsGeoJSON(geom) as geometry
            FROM edges
            WHERE geom && ST_MakeEnvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326);
        """)
        
        result = await session.execute(query, {
            "min_lon": min_lon,
            "min_lat": min_lat,
            "max_lon": max_lon,
            "max_lat": max_lat
        })
        edges = result.fetchall()
        
        features = []
        for edge in edges:
            geom_str = edge.geometry
            if not geom_str:
                continue
                
            features.append({
                "type": "Feature",
                "properties": {
                    "id": edge.id,
                    "base_weight": edge.base_weight,
                    "current_risk_weight": float(edge.current_risk_weight)
                },
                "geometry": json.loads(geom_str)
            })
            
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        print(f"BBox вне пределов локальной БД или ошибка PostGIS: {e}")
        return {
            "type": "FeatureCollection",
            "features": []
        }

