import requests
import base64
import json
from flask import Blueprint, request, jsonify
from routes.config_zoom import ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
from flask import render_template

zoom_bp = Blueprint('zoom', __name__)

@zoom_bp.route('/')
def zoom():
    return render_template('zoom.html')

def get_zoom_access_token():
    url = "https://zoom.us/oauth/token"
    headers = {
        "Authorization": "Basic " + base64.b64encode(f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}".encode()).decode(),
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "grant_type": "account_credentials",
        "account_id": ZOOM_ACCOUNT_ID
    }
    response = requests.post(url, headers=headers, data=data)

    if response.status_code == 200:
        return response.json().get("access_token")
    else:
        return None

@zoom_bp.route('/create_meeting', methods=['POST'])
def create_meeting():
    access_token = get_zoom_access_token()
    if not access_token:
        return jsonify({"error": "Failed to get Zoom access token"}), 400

    data = request.json
    meeting_data = {
        "topic": data.get("topic", "Новая конференция"),
        "type": 2,  # Scheduled meeting
        "duration": int(data.get("duration", 30)),
        "timezone": "UTC",
        "agenda": "Автоматически созданная встреча",
        "settings": {
            "host_video": True,
            "participant_video": True,
            "join_before_host": False,
            "mute_upon_entry": True,
            "approval_type": 0
        }
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    user_id = "me"  # Используем "me", если токен связан с единственным аккаунтом

    response = requests.post(
        f"https://api.zoom.us/v2/users/{user_id}/meetings",
        headers=headers,
        json=meeting_data
    )

    if response.status_code == 201:
        meeting = response.json()

        # Получаем веб-ссылку для конференции
        join_url = meeting.get("join_url", "")
        if join_url:
            # Преобразуем ссылку в браузерную версию
            web_url = join_url.replace("/j/", "/wc/join/")  # Формируем URL для браузера
            return jsonify({"web_url": web_url})  # Отправляем ссылку на фронтенд
        else:
            return jsonify({"error": "Ошибка получения ссылки для конференции"}), 400
    else:
        return jsonify({"error": response.json()}), response.status_code
