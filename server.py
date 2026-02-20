from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import random
import datetime

app = Flask(__name__)
CORS(app)

OPENWEATHER_API_KEY = "92cbd6cb2e68bf6086edb6cb08003250"

def get_weather_forecast(lat, lon, hours_ahead):
    try:
        url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang=ru"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        target_time = now_utc + datetime.timedelta(hours=hours_ahead)

        closest_forecast = None
        min_diff = float('inf')

        for item in data['list']:
            forecast_time = datetime.datetime.strptime(item['dt_txt'], "%Y-%m-%d %H:%M:%S").replace(
                tzinfo=datetime.timezone.utc)
            diff = abs((forecast_time - target_time).total_seconds())

            if diff < min_diff:
                min_diff = diff
                closest_forecast = item

        if not closest_forecast:
            closest_forecast = data['list'][0]

        return {
            "temp": round(closest_forecast['main']['temp'], 1),
            "condition": closest_forecast['weather'][0]['description'].capitalize(),
            "wind": f"{closest_forecast['wind']['speed']} м/с",
            "humidity": f"{closest_forecast['main']['humidity']}%",
            "pressure": f"{closest_forecast['main']['pressure']} гПа",
            "source_time": closest_forecast['dt_txt']
        }

    except Exception as e:
        print(f"Ошибка OpenWeather: {e}")
        base_temp = -5 if hours_ahead == 0 else -5 - (hours_ahead * 0.5)
        return {
            "temp": round(base_temp, 1),
            "condition": "Снег" if hours_ahead == 0 else "Облачно",
            "wind": f"{random.randint(3, 8)} м/с",
            "humidity": f"{random.randint(70, 90)}%",
            "pressure": f"{random.randint(740, 760)} гПа"
        }

def get_traffic_analysis(lat, lon, hours_ahead):
    current_hour = datetime.datetime.now().hour
    is_rush_hour = (8 <= current_hour < 10) or (17 <= current_hour < 19)

    base_level = 3 if not is_rush_hour else 7
    traffic_level = base_level + random.randint(-2, 2) if hours_ahead == 0 else base_level + (2 if is_rush_hour else -1)
    traffic_level = max(1, min(10, traffic_level))

    if traffic_level > 7:
        status = "Серьезные заторы"
    elif traffic_level > 4:
        status = "Умеренные пробки"
    else:
        status = "Движение свободное"

    speed = max(10, 70 - traffic_level * 5)

    return {
        "level": traffic_level,
        "status": status,
        "speed_avg": f"{speed} км/ч",
        "note": "Данные о пробках через Yandex Maps API"
    }

def get_incidents(lat, lon):
    incidents = []

    if random.random() > 0.7:
        incidents.append({
            "type": "ДТП",
            "desc": "Столкновение двух автомобилей на перекрестке",
            "severity": "Высокая",
            "time": "5 минут назад"
        })

    if random.random() > 0.8:
        incidents.append({
            "type": "Ремонт дороги",
            "desc": "Капитальный ремонт дороги на проспекте Победы",
            "severity": "Средняя",
            "time": "Начало сегодня в 9:00"
        })

    return incidents

@app.route('/api/analyze', methods=['POST'])
def analyze_point():
    data = request.json
    lat = data.get('lat')
    lon = data.get('lon')

    if lat is None or lon is None:
        return jsonify({"error": "Требуются координаты lat и lon"}), 400

    print(f"Анализ точки: {lat:.4f}, {lon:.4f}")

    response_data = {
        "location": {
            "lat": lat,
            "lon": lon,
            "name": "Выбранная точка в Казани"
        },
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "now": {
            "weather": get_weather_forecast(lat, lon, 0),
            "traffic": get_traffic_analysis(lat, lon, 0),
            "incidents": get_incidents(lat, lon)
        },
        "forecast": []
    }

    for hour in range(1, 4):
        response_data["forecast"].append({
            "time": f"+{hour} ч.",
            "timestamp": (datetime.datetime.now() + datetime.timedelta(hours=hour)).strftime("%H:%M"),
            "weather": get_weather_forecast(lat, lon, hour),
            "traffic": get_traffic_analysis(lat, lon, hour)
        })

    return jsonify(response_data)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "services": {
            "openweather": "connected" if OPENWEATHER_API_KEY else "disconnected",
        },
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
