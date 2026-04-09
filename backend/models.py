from sqlalchemy import Column, Integer, BigInteger, Float, ForeignKey, String, DateTime
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from database import Base

class Node(Base):
    __tablename__ = "nodes"

    id = Column(BigInteger, primary_key=True, autoincrement=False, index=True)
    geom = Column(Geometry('POINT', srid=4326), nullable=False)


class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, index=True)
    start_node_id = Column(BigInteger, ForeignKey("nodes.id"), nullable=False)
    end_node_id = Column(BigInteger, ForeignKey("nodes.id"), nullable=False)
    
    base_weight = Column(Float, nullable=False)
    current_risk_weight = Column(Float, nullable=False)
    
    geom = Column(Geometry('LINESTRING', srid=4326), nullable=False)


class RiskZone(Base):
    __tablename__ = "risk_zones"

    id = Column(Integer, primary_key=True, index=True)
    intensity = Column(Float, nullable=False)
    radius = Column(Float, nullable=False)
    
    geom = Column(Geometry('POINT', srid=4326), nullable=False)


class Incident(Base):
    """
    Каждое срабатывание Vision API фиксируется здесь.
    Ребро становится 'опасным' только после консенсуса (≥2 pending за 15 мин).
    """
    __tablename__ = "incidents"

    id          = Column(Integer, primary_key=True, index=True)
    edge_id     = Column(Integer, ForeignKey("edges.id"), nullable=False, index=True)
    geom        = Column(Geometry('POINT', srid=4326), nullable=False)
    description = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    confidence  = Column(Float, default=1.0)
    status      = Column(String, default='pending')  # pending / verified / resolved
