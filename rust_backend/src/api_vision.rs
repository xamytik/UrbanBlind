use axum::{
    extract::{State, WebSocketUpgrade},
    extract::ws::{Message, WebSocket},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use reqwest::Client;

use crate::AppState;

#[derive(Deserialize)]
pub struct VisionPayload {
    pub image_base64: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub force_hazard: Option<bool>,
}

#[derive(Serialize)]
pub struct VisionResponse {
    pub hazard_detected: bool,
    pub message: Option<String>,
}

pub async fn analyze_vision_frame(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VisionPayload>,
) -> Json<VisionResponse> {
    let force_hazard = payload.force_hazard.unwrap_or(false);
    let mut hazard_detected = false;
    let mut hazard_msg = None;

    if force_hazard {
        hazard_detected = true;
        hazard_msg = Some("Внимание: тестовый инцидент (Rust)".to_string());
    } else if let Some(base64_img) = &payload.image_base64 {
        // Вызов Gemini REST API
        if let Ok(key) = std::env::var("GEMINI_API_KEY") {
            let client = Client::new();
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}", key);
            
            let clean_base64 = if base64_img.contains(',') {
                base64_img.split(',').nth(1).unwrap_or(base64_img)
            } else {
                base64_img
            };

            let gemini_payload = json!({
                "contents": [{
                    "parts": [
                        { "text": "Ты — ИИ-поводырь. Ищи опасности прямо по курсу камеры (ямы, столбы). Если чисто ответь CLEAN. Иначе короткое предупреждение на русском." },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": clean_base64
                            }
                        }
                    ]
                }]
            });

            if let Ok(resp) = client.post(&url).json(&gemini_payload).send().await {
                if let Ok(json_resp) = resp.json::<Value>().await {
                    if let Some(text) = json_resp["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                        tracing::info!("🔍 Gemini (Rust): {}", text);
                        if !text.to_lowercase().contains("clean") {
                            hazard_detected = true;
                            hazard_msg = Some(text.to_string());
                        }
                    }
                }
            }
        }
    }

    // Режим Консенсуса и обновление БД
    if hazard_detected {
        if let (Some(lat), Some(lon)) = (payload.lat, payload.lon) {
            let edge_query = r#"
                SELECT id FROM edges
                ORDER BY ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                )
                LIMIT 1
            "#;

            if let Ok(row) = sqlx::query(edge_query)
                .bind(lon)
                .bind(lat)
                .fetch_one(&state.db).await 
            {
                let edge_id: i32 = row.get("id");
                
                // Вставляем pending инцидент
                let insert_inc = r#"
                    INSERT INTO incidents (edge_id, geom, description, confidence, status)
                    VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, 1.0, 'pending')
                "#;
                
                let msg = hazard_msg.clone().unwrap_or_else(|| "Неизвестная угроза".to_string());
                let _ = sqlx::query(insert_inc)
                    .bind(edge_id)
                    .bind(lon)
                    .bind(lat)
                    .bind(&msg)
                    .execute(&state.db).await;

                // Проверяем консенсус (>= 2 за 15 мин)
                let consensus_query = r#"
                    SELECT COUNT(*) as count FROM incidents
                    WHERE edge_id = $1 AND status = 'pending'
                      AND created_at >= NOW() - INTERVAL '15 minutes'
                "#;

                if let Ok(count_row) = sqlx::query(consensus_query).bind(edge_id).fetch_one(&state.db).await {
                    let count: i64 = count_row.get("count");
                    if count >= 2 {
                        // Консенсус достигнут!
                        let _ = sqlx::query("UPDATE incidents SET status = 'verified' WHERE edge_id = $1 AND status = 'pending' AND created_at >= NOW() - INTERVAL '15 minutes'").bind(edge_id).execute(&state.db).await;
                        let _ = sqlx::query("UPDATE edges SET current_risk_weight = current_risk_weight + 50 WHERE id = $1").bind(edge_id).execute(&state.db).await;
                        
                        tracing::warn!("🚨 КОНСЕНСУС ИИ (Edge {}): Опасность подтверждена!", edge_id);
                        
                        // Отправляем WebSocket Broadcast
                        let _ = state.tx.send(json!({"type": "HAZARD_UPDATED"}).to_string());
                    }
                }
            }
        }
    }

    Json(VisionResponse {
        hazard_detected,
        message: hazard_msg,
    })
}

// WebSocket обработчик
pub async fn websocket_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> axum::response::Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.tx.subscribe();
    
    // Бесконечный цикл, слушающий общий канал `tx`
    while let Ok(msg) = rx.recv().await {
        if socket.send(Message::Text(msg)).await.is_err() {
            // Клиент отключился
            break;
        }
    }
}
