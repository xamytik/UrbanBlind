from flask import Flask, render_template, jsonify
import requests
import os
from dotenv import load_dotenv

# Загружаем переменные из .env
load_dotenv()

app = Flask(__name__)

# --- Настройки API ---
TOMTOM_KEY = os.getenv("TOMTOM_KEY")
MEERSENS_KEY = os.getenv("MEERSENS_KEY")
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
SUNRISE_URL = "https://api.sunrise-sunset.org/json"

# --- Функции для получения данных от сторонних API ---
def fetch_traffic_from_tomtom(lat, lon, key):
    """Функция для запроса данных о пробках от TomTom."""
    if not key:
        return {"error": "TomTom key not configured", "source": "server_error"}
    url = f"https://api.tomtom.com/traffic/services/4/flow/current/absolute/10/json"
    params = {
        "point": f"{lat},{lon}",
        "key": key
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        # Обработка ответа TomTom (примерная структура)
        seg_data = data.get("flowResponse", {}).get("segments", [{}])[0]
        current_speed = seg_data.get("currentSpeed", 0)
        free_flow_speed = seg_data.get("freeFlowSpeed", 50)

        traffic_level = 0
        if free_flow_speed > 0:
            speed_ratio = current_speed / free_flow_speed
            traffic_level = min(10, round((1 - speed_ratio) * 10))

        status_map = {0: "Свободно", 1: "Свободно", 5: "Умеренная загр.", 8: "Высокая загр.", 10: "Колонна"}
        status = status_map.get(traffic_level, "Неизвестно")

        return {
            "level": traffic_level,
            "status": status,
            "speed_avg": f"{current_speed} km/h",
            "source": "tomtom_server"
        }
    except requests.exceptions.RequestException as e:
        print(f"TomTom API error: {e}")
        # Возвращаем fallback данные
        hour = 9 # Имитация времени для fallback
        level = 7 if (7 <= hour < 10 or 17 <= hour < 20) else 4
        status = "Пиковые часы" if level == 7 else "Дневная активность"
        return {"level": level, "status": status, "speed_avg": "N/A", "source": "fallback_server"}

def fetch_noise_from_meersens(lat, lon, key):
    """Функция для запроса данных о шуме от Meersens."""
    if not key:
        return {"error": "Meersens key not configured", "source": "server_error"}
    url = f"https://api.meersens.com/environment/public/noise/v1/current"
    params = {"lat": lat, "lng": lon}
    headers = {"apikey": key}
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        # Обработка ответа Meersens (примерная структура)
        noise_level = data.get("atmospheric_noise", {}).get("value")
        if noise_level is not None:
            risk = min(100, max(0, ((noise_level - 30) / 55) * 100))
            return {
                "level": round(noise_level),
                "risk": round(risk),
                "desc": get_noise_description_server(noise_level),
                "source": "meersens_server"
            }
        else:
            raise ValueError("Noise value not found in response")
    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"Meersens API error: {e}")
        # Fallback через OSM на сервере
        query = f'[out:json][timeout:25];(node["amenity"~"cafe|bar|pub|fast_food|restaurant"](around:200,{lat},{lon});way["highway"~"primary|secondary|tertiary"](around:150,{lat},{lon}););out count;'
        try:
            r_osm = requests.post(OVERPASS_URL, data={'data': query})
            r_osm.raise_for_status()
            osm_data = r_osm.json()
            count = osm_data['elements'][0]['tags']['count'] if osm_data['elements'] else 0
            level = 40 + min(30, count * 0.5)
            risk = min(100, max(0, ((level - 30) / 55) * 100))
            return {"level": round(level), "risk": round(risk), "desc": "Fallback (OSM)", "source": "fallback_server_osm"}
        except:
            return {"level": 50, "risk": 40, "desc": "Fallback (Error)", "source": "fallback_server_error"}

def get_noise_description_server(db):
    """Вспомогательная функция для описания шума (на сервере)."""
    if db < 45: return 'Тихо: спокойная зона'
    if db < 55: return 'Умеренный шум: жилая зона'
    if db < 65: return 'Заметный шум: оживлённая улица'
    if db < 75: return 'Шумно: транспортная магистраль'
    return 'Очень шумно: зона высокого риска'

# --- Маршруты Flask ---
@app.route("/")
def index():
    """Отдаёт основной HTML-файл."""
    return render_template("secondpage.html")

@app.route("/api/traffic/<float:lat>,<float:lon>")
def api_traffic(lat, lon):
    """Маршрут для получения данных о пробках через сервер."""
    traffic_data = fetch_traffic_from_tomtom(lat, lon, TOMTOM_KEY)
    return jsonify(traffic_data)

@app.route("/api/noise/<float:lat>,<float:lon>")
def api_noise(lat, lon):
    """Маршрут для получения данных о шуме через сервер."""
    noise_data = fetch_noise_from_meersens(lat, lon, MEERSENS_KEY)
    return jsonify(noise_data)

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
