from flask import current_app
import requests
import base64
import json
import logging
from datetime import datetime, timedelta
from routes.config_zoom import Config
from routes.models import db, CalendarEvent, User

logger = logging.getLogger(__name__)

class ZoomService:
    @staticmethod
    def get_access_token():
        """Получение токена для API Zoom"""
        try:
            url = "https://zoom.us/oauth/token"
            auth_string = base64.b64encode(
                f"{Config.ZOOM_CLIENT_ID}:{Config.ZOOM_CLIENT_SECRET}".encode()
            ).decode()
            
            headers = {
                "Authorization": f"Basic {auth_string}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "grant_type": "account_credentials",
                "account_id": Config.ZOOM_ACCOUNT_ID
            }

            response = requests.post(url, headers=headers, data=data)
            if response.status_code != 200:
                logger.error(f"Zoom token error: {response.text}")
                return None

            return response.json().get("access_token")
        except Exception as e:
            logger.error(f"Error getting Zoom token: {str(e)}")
            return None

    @staticmethod
    def get_zak_token(access_token):
        """Получение ZAK токена для организатора"""
        try:
            headers = {
                "Authorization": f"Bearer {access_token}"
            }
            
            response = requests.get(
                "https://api.zoom.us/v2/users/me/token?type=zak",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"ZAK token error: {response.text}")
                return None
                
            return response.json().get("token")
        except Exception as e:
            logger.error(f"Error getting ZAK token: {str(e)}")
            return None

    @staticmethod
    def create_meeting(data, creator_id):
        """Создание встречи в Zoom и сохранение в БД с использованием ZAK токенов для прав организатора"""
        try:
            # Получаем токен доступа API
            access_token = ZoomService.get_access_token()
            if not access_token:
                logger.error("Failed to get Zoom access token")
                return None, "Не удалось получить токен доступа к Zoom API"

            # Получаем ZAK токен для передачи прав организатора
            zak_token = ZoomService.get_zak_token(access_token)
            if not zak_token:
                logger.warning("Failed to get ZAK token - users may need to wait for host")
                # Продолжаем без ZAK токена, но предупреждаем в логах

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            # Создание встречи с оптимальными настройками для работы без явного организатора
            meeting_data = {
                "topic": data["topic"],
                "type": 2,  # Scheduled meeting
                "start_time": data["start_time"],
                "duration": data["duration"],
                "timezone": "Europe/Moscow",
                "settings": {
                    "host_video": True,
                    "participant_video": True,
                    "join_before_host": True,  # Разрешаем присоединяться до прихода организатора
                    "mute_upon_entry": True,
                    "waiting_room": False,  # Отключаем зал ожидания для мгновенного присоединения
                    "auto_recording": "none",
                    "alternative_hosts_email_notification": False,
                    "use_pmi": False  # Не использовать Personal Meeting ID
                }
            }

            # Создаем встречу через API
            response = requests.post(
                "https://api.zoom.us/v2/users/me/meetings",
                headers=headers,
                json=meeting_data
            )

            if response.status_code != 201:
                logger.error(f"Zoom meeting creation error: {response.text}")
                return None, f"Ошибка создания встречи в Zoom: {response.text}"

            meeting_response = response.json()
            
            # Преобразуем время начала и окончания
            start_time = datetime.fromisoformat(data["start_time"].replace('Z', '+00:00'))
            end_time = start_time + timedelta(minutes=int(data["duration"]))
            
            # Базовая ссылка на встречу
            join_url = meeting_response['join_url']
            meeting_id = meeting_response.get("id")
            
            # Модифицируем ссылку для браузера
            web_url = join_url.replace("/j/", "/wc/join/")
            
            # Добавляем ZAK токен для передачи прав организатора, если он получен
            if zak_token:
                # Добавляем токен к URL
                if "?" in web_url:
                    web_url = f"{web_url}&zak={zak_token}"
                else:
                    web_url = f"{web_url}?zak={zak_token}"
            
            # Создаем запись в базе данных
            event = CalendarEvent(
                title=data["topic"],
                start_time=start_time,
                end_time=end_time,
                description=data.get("agenda", ""),
                event_type="zoom",
                color="#2196F3",
                creator_id=creator_id,
                zoom_url=web_url,
                zoom_meeting_id=meeting_id
            )
            
            db.session.add(event)
            db.session.commit()
            
            # Формируем ответ с информацией о встрече и токенах
            result = {
                "meeting": meeting_response,
                "event": event.to_dict(),
                "has_host_permissions": zak_token is not None
            }
            
            return result, None
        except Exception as e:
            logger.error(f"Error creating Zoom meeting: {str(e)}")
            db.session.rollback()
            return None, f"Ошибка создания встречи Zoom: {str(e)}"

    @staticmethod
    def generate_host_url(event_id):
        """Создать свежую ссылку с правами организатора для существующей встречи"""
        try:
            # Получаем событие из БД
            event = CalendarEvent.query.get(event_id)
            if not event or event.event_type != 'zoom' or not event.zoom_meeting_id:
                return None, "Встреча не найдена или не является Zoom-конференцией"
            
            # Получаем свежие токены
            access_token = ZoomService.get_access_token()
            if not access_token:
                return None, "Не удалось получить токен доступа к Zoom API"
                
            zak_token = ZoomService.get_zak_token(access_token)
            if not zak_token:
                return None, "Не удалось получить ZAK токен для прав организатора"
                
            # Формируем URL с правами организатора
            meeting_id = event.zoom_meeting_id
            host_url = f"https://zoom.us/wc/join/{meeting_id}?zak={zak_token}"
            
            return {"host_url": host_url}, None
            
        except Exception as e:
            logger.error(f"Error generating host URL: {str(e)}")
            return None, f"Ошибка создания ссылки организатора: {str(e)}"

    @staticmethod
    def update_meeting_settings(meeting_id):
        """Обновить настройки существующей встречи для лучшей работы без организатора"""
        try:
            access_token = ZoomService.get_access_token()
            if not access_token:
                return False, "Не удалось получить токен доступа"
                
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Оптимальные настройки для встречи
            settings_data = {
                "settings": {
                    "join_before_host": True,
                    "waiting_room": False,
                    "participant_video": True,
                    "auto_recording": "none"
                }
            }
            
            response = requests.patch(
                f"https://api.zoom.us/v2/meetings/{meeting_id}",
                headers=headers,
                json=settings_data
            )
            
            if response.status_code != 204:
                logger.error(f"Failed to update meeting settings: {response.text}")
                return False, f"Ошибка обновления настроек: {response.text}"
                
            return True, None
            
        except Exception as e:
            logger.error(f"Error updating meeting settings: {str(e)}")
            return False, f"Ошибка обновления настроек встречи: {str(e)}"

    @staticmethod
    def add_alternative_host(meeting_id, user_email):
        """Добавить альтернативного организатора к встрече по email"""
        try:
            access_token = ZoomService.get_access_token()
            if not access_token:
                return False, "Не удалось получить токен доступа"
                
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json" 
            }
            
            data = {
                "alternative_hosts": user_email
            }
            
            response = requests.patch(
                f"https://api.zoom.us/v2/meetings/{meeting_id}",
                headers=headers,
                json=data
            )
            
            if response.status_code != 204:
                logger.error(f"Failed to add alternative host: {response.text}")
                return False, f"Ошибка добавления альтернативного организатора: {response.text}"
                
            return True, None
            
        except Exception as e:
            logger.error(f"Error adding alternative host: {str(e)}")
            return False, f"Ошибка добавления альтернативного организатора: {str(e)}"