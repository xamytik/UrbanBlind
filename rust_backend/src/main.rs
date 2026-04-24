use axum::{
    routing::get,
    Router,
};
use sqlx::PgPool;
use std::net::SocketAddr;
use std::sync::Arc;

mod database;
mod models;

mod api_map;
mod routing;
mod api_vision;

pub struct AppState {
    pub db: PgPool,
    pub tx: tokio::sync::broadcast::Sender<String>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env");
    
    tracing::info!("Подключение к базе данных...");
    let pool = database::establish_connection(&db_url).await;
    tracing::info!("Успешное подключение к PostgreSQL!");

    // Канал для WebSockets (оповещение об инцидентах)
    let (tx, _rx) = tokio::sync::broadcast::channel(100);

    let shared_state = Arc::new(AppState { db: pool.clone(), tx: tx.clone() });

    // Фоновая задача (аналог APScheduler в Python)
    tokio::spawn({
        let db = pool.clone();
        async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600)); // Каждый час
            loop {
                interval.tick().await;
                tracing::info!("🧹 [Background Worker] Очистка старых рисков...");
                
                // Находим устаревшие инциденты
                let find_q = "SELECT edge_id FROM incidents WHERE status = 'verified' AND created_at < NOW() - INTERVAL '24 hours'";
                if let Ok(rows) = sqlx::query(find_q).fetch_all(&db).await {
                    for row in rows {
                        use sqlx::Row;
                        let edge_id: i32 = row.get("edge_id");
                        
                        let _ = sqlx::query("UPDATE incidents SET status = 'resolved' WHERE edge_id = $1").bind(edge_id).execute(&db).await;
                        let _ = sqlx::query("UPDATE edges SET current_risk_weight = GREATEST(current_risk_weight - 50, 0) WHERE id = $1").bind(edge_id).execute(&db).await;
                    }
                }
            }
        }
    });

    // Настройка роутов с CORS
    use axum::routing::post;
    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/map/network", get(api_map::get_network))
        .route("/api/map/risk-layers", get(api_map::get_risk_layers))
        .route("/api/route", post(routing::calculate_route))
        .route("/api/vision/analyze", post(api_vision::analyze_vision_frame))
        .route("/ws/incidents", get(api_vision::websocket_handler))
        .with_state(shared_state)
        // Временный пустой CORS без tower_http, позже добавим полноценный
        .layer(tower_http::cors::CorsLayer::permissive());



    // Запуск сервера
    let addr = SocketAddr::from(([0, 0, 0, 0], 8001));
    tracing::info!("Бэкенд на Rust запущен на http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "Rust Backend is alive and incredibly fast! 🦀⚡"
}
