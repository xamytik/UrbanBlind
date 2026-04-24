use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct RouteRequest {
    pub start_lon: f64,
    pub start_lat: f64,
    pub end_lon: f64,
    pub end_lat: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct IncidentResponse {
    pub id: i32,
    pub description: String,
    pub status: String,
    pub confidence: f64,
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RiskZoneCreate {
    pub lat: f64,
    pub lon: f64,
    pub description: Option<String>,
}
