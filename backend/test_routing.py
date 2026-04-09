import asyncio
import sys
sys.path.append(".")
from schemas import RouteRequest
from database import AsyncSessionLocal
from services.routing import find_safe_route

async def test():
    async with AsyncSessionLocal() as session:
        req = RouteRequest(
            start_lat=55.7539,
            start_lon=37.6208,
            end_lat=55.7600,
            end_lon=37.6300
        )
        res = await find_safe_route(session, req)
        print("Success! Features count:", len(res["features"]))

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test())
