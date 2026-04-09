from pydantic import BaseModel

class RiskZoneCreate(BaseModel):
    latitude: float
    longitude: float
    intensity: float
    radius: float

class RiskZoneResponse(BaseModel):
    id: int
    message: str

class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
