use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::AppState;

#[derive(Deserialize)]
pub struct BBoxQuery {
    #[serde(default = "default_min_lon")]
    min_lon: f64,
    #[serde(default = "default_min_lat")]
    min_lat: f64,
    #[serde(default = "default_max_lon")]
    max_lon: f64,
    #[serde(default = "default_max_lat")]
    max_lat: f64,
}

fn default_min_lon() -> f64 { -180.0 }
fn default_min_lat() -> f64 { -90.0 }
fn default_max_lon() -> f64 { 180.0 }
fn default_max_lat() -> f64 { 90.0 }

// Возвращаем полный граф дорог для отрисовки на Deck.gl
pub async fn get_network(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BBoxQuery>,
) -> Json<Value> {
    let query = r#"
        SELECT 
            id,
            base_weight,
            current_risk_weight,
            ST_AsGeoJSON(geom) as geometry
        FROM edges
        WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326);
    "#;

    let rows = sqlx::query(query)
        .bind(params.min_lon)
        .bind(params.min_lat)
        .bind(params.max_lon)
        .bind(params.max_lat)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let mut features = Vec::with_capacity(rows.len());

    for row in rows {
        let id: i32 = row.get("id");
        let base_weight: f64 = row.get("base_weight");
        let current_risk_weight: f64 = row.get("current_risk_weight");
        
        if let Some(geom_str) = row.try_get::<String, _>("geometry").ok() {
            let geometry: Value = serde_json::from_str(&geom_str).unwrap_or(json!({}));
            
            features.push(json!({
                "type": "Feature",
                "properties": {
                    "id": id,
                    "base_weight": base_weight,
                    "current_risk_weight": current_risk_weight
                },
                "geometry": geometry
            }));
        }
    }

    Json(json!({
        "type": "FeatureCollection",
        "features": features
    }))
}

// Возвращаем только линии с риском > 0
pub async fn get_risk_layers(State(state): State<Arc<AppState>>) -> Json<Value> {
    let query = r#"
        SELECT 
            id,
            base_weight,
            current_risk_weight,
            ST_AsGeoJSON(geom) as geometry
        FROM edges
        WHERE current_risk_weight > 0;
    "#;

    let rows = sqlx::query(query)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let mut features = Vec::with_capacity(rows.len());

    for row in rows {
        let id: i32 = row.get("id");
        let base_weight: f64 = row.get("base_weight");
        let current_risk_weight: f64 = row.get("current_risk_weight");
        
        if let Some(geom_str) = row.try_get::<String, _>("geometry").ok() {
            let geometry: Value = serde_json::from_str(&geom_str).unwrap_or(json!({}));
            
            features.push(json!({
                "type": "Feature",
                "properties": {
                    "id": id,
                    "base_weight": base_weight,
                    "current_risk_weight": current_risk_weight
                },
                "geometry": geometry
            }));
        }
    }

    Json(json!({
        "type": "FeatureCollection",
        "features": features
    }))
}
