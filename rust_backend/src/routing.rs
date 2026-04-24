use axum::{
    extract::State,
    Json,
};
use serde_json::{json, Value};
use sqlx::Row;
use petgraph::graphmap::UnGraphMap;
use petgraph::algo::astar;
use std::sync::Arc;
use std::collections::HashMap;

use crate::{AppState, models::RouteRequest};

pub async fn calculate_route(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RouteRequest>,
) -> Json<Value> {
    tracing::info!("Поиск безопасного маршрута между ({}, {}) и ({}, {})", req.start_lon, req.start_lat, req.end_lon, req.end_lat);

    // 1. Поиск ближайших узлов старта и финиша в графе
    let node_query = r#"
        SELECT id
        FROM nodes
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
        LIMIT 1;
    "#;

    let start_node: i64 = match sqlx::query(node_query)
        .bind(req.start_lon)
        .bind(req.start_lat)
        .fetch_one(&state.db).await {
            Ok(row) => row.get("id"),
            Err(e) => {
                tracing::error!("Start node not found: {}", e);
                return Json(json!({"type": "FeatureCollection", "features": []}));
            }
        };

    let end_node: i64 = match sqlx::query(node_query)
        .bind(req.end_lon)
        .bind(req.end_lat)
        .fetch_one(&state.db).await {
            Ok(row) => row.get("id"),
            Err(e) => {
                tracing::error!("End node not found: {}", e);
                return Json(json!({"type": "FeatureCollection", "features": []}));
            }
        };

    // 2. Получение всех ребер для построения in-memory графа (Аналог nx.Graph())
    let edges_query = r#"
        SELECT 
            start_node_id, 
            end_node_id, 
            base_weight, 
            current_risk_weight, 
            ST_AsGeoJSON(geom) as geometry
        FROM edges;
    "#;

    let rows = match sqlx::query(edges_query).fetch_all(&state.db).await {
        Ok(res) => res,
        Err(e) => {
            tracing::error!("Error fetching edges: {}", e);
            return Json(json!({"type": "FeatureCollection", "features": []}));
        }
    };

    // Строим неориентированный граф (UnGraphMap)
    let mut graph = UnGraphMap::<i64, f64>::with_capacity(rows.len(), rows.len() * 2);
    let mut geometries = HashMap::with_capacity(rows.len());

    for row in rows {
        let u: i64 = row.get("start_node_id");
        let v: i64 = row.get("end_node_id");
        let base_weight: f64 = row.get("base_weight");
        let current_risk_weight: f64 = row.get("current_risk_weight");
        
        // Ключевая формула безопасного пути (как в Питоне)
        let weight = base_weight + current_risk_weight;
        graph.add_edge(u, v, weight);

        if let Ok(geom_str) = row.try_get::<String, _>("geometry") {
            // Геометрия не зависит от направления ребра
            let key = if u < v { (u, v) } else { (v, u) };
            geometries.insert(key, geom_str);
        }
    }

    // 3. Вычисление кратчайшего пути (A*)
    tracing::info!("Билд графа завершен. Запуск A*...");
    let path = astar(
        &graph,
        start_node,
        |finish| finish == end_node,
        |e| *e.2, // e - это кортеж (откуда, куда, ссылка_на_вес)
        |_| 0.0, // эвристика равна нулю = алгоритм Дейкстры
    );

    // 4. Сборка GeoJSON для фронтенда
    let mut features = Vec::new();

    if let Some((total_weight, nodes)) = path {
        tracing::info!("Маршрут найден! Вес: {}, Узлов: {}", total_weight, nodes.len());
        for i in 0..nodes.len() - 1 {
            let u = nodes[i];
            let v = nodes[i+1];
            let key = if u < v { (u, v) } else { (v, u) };

            if let Some(geom_str) = geometries.get(&key) {
                let geom_json: Value = serde_json::from_str(geom_str).unwrap_or(json!({}));
                features.push(json!({
                    "type": "Feature",
                    "properties": {
                        "is_safe_route": true
                    },
                    "geometry": geom_json
                }));
            }
        }
    } else {
        tracing::warn!("Маршрут не найден!");
    }

    Json(json!({
        "type": "FeatureCollection",
        "features": features
    }))
}
