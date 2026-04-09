import asyncio
import sys
from sqlalchemy import text

# Добавляем корневую папку бэкенда в PYTHONPATH, чтобы импорты работали
sys.path.append(".")

from database import AsyncSessionLocal

async def seed_grid():
    async with AsyncSessionLocal() as session:
        print("Очистка таблиц графа (edges, nodes)...")
        # Очищаем узлы и ребра с каскадом, обнуляя счетчики ID
        await session.execute(text("TRUNCATE TABLE edges, nodes RESTART IDENTITY CASCADE;"))
        # Полезно также почистить зоны риска, чтобы новая сетка была чистой
        await session.execute(text("TRUNCATE TABLE risk_zones RESTART IDENTITY CASCADE;"))

        # Центр сетки: Красная площадь, Москва
        center_lat = 55.7539
        center_lon = 37.6208
        step = 0.002
        grid_size = 10

        print(f"Генерация {grid_size}x{grid_size} перекрестков (nodes)...")
        
        # Матрица для хранения ID и координат узлов: node_matrix[i][j] = dict()
        node_matrix = []
        for i in range(grid_size):
            row = []
            for j in range(grid_size):
                # Сдвигаем координаты относительно центра
                lat = center_lat + (i - grid_size // 2) * step
                lon = center_lon + (j - grid_size // 2) * step
                
                # Создаем узел с геометрией POINT
                insert_node = text("""
                    INSERT INTO nodes (geom)
                    VALUES (ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
                    RETURNING id;
                """)
                res = await session.execute(insert_node, {"lon": lon, "lat": lat})
                node_id = res.scalar_one()
                
                row.append({"id": node_id, "lon": lon, "lat": lat})
            node_matrix.append(row)

        print("Связывание перекрестков дорогами (edges)...")
        
        # Запрос создания ребра с геометрией LINESTRING между двумя точками
        insert_edge = text("""
            INSERT INTO edges (start_node_id, end_node_id, base_weight, current_risk_weight, geom)
            VALUES (
                :start_id, :end_id, :base_weight, :risk, 
                ST_SetSRID(ST_MakeLine(ST_MakePoint(:lon1, :lat1), ST_MakePoint(:lon2, :lat2)), 4326)
            )
        """)

        # Проходим по всем узлам и соединяем их с соседом справа (горизонталь) и соседом сверху (вертикаль)
        for i in range(grid_size):
            for j in range(grid_size):
                curr = node_matrix[i][j]
                
                # Горизонтальное соединение (сосед справа)
                if j < grid_size - 1:
                    right = node_matrix[i][j + 1]
                    await session.execute(insert_edge, {
                        "start_id": curr["id"],
                        "end_id": right["id"],
                        "base_weight": 100.0,
                        "risk": 0.0,
                        "lon1": curr["lon"], "lat1": curr["lat"],
                        "lon2": right["lon"], "lat2": right["lat"]
                    })
                
                # Вертикальное соединение (сосед сверху)
                if i < grid_size - 1:
                    top = node_matrix[i + 1][j]
                    await session.execute(insert_edge, {
                        "start_id": curr["id"],
                        "end_id": top["id"],
                        "base_weight": 100.0,
                        "risk": 0.0,
                        "lon1": curr["lon"], "lat1": curr["lat"],
                        "lon2": top["lon"], "lat2": top["lat"]
                    })

        # Фиксируем транзакцию
        await session.commit()
        print(f"Сетка успешно загружена в БД: {(grid_size * (grid_size - 1)) * 2} дорог создано!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_grid())
