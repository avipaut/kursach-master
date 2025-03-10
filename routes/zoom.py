from flask import Blueprint, request, jsonify, render_template
import requests
import base64
import json
import logging
from datetime import datetime, timedelta
from .config_zoom import Config

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

zoom_bp = Blueprint('zoom', __name__)

# Хранилище для всех событий (и встреч Zoom, и обычных задач)
class EventStore:
    def __init__(self):
        self.events = []
        self.next_id = 1
        self.card_event_map = {}  # Maps kanban card IDs to event IDs

    def add_event(self, event):
        # Check if this is a kanban card event
        kanban_card_id = event.get('kanban_card_id')
        
        if kanban_card_id:
            # If we already have an event for this card, update it instead
            existing_event_id = self.card_event_map.get(str(kanban_card_id))
            if existing_event_id:
                for i, e in enumerate(self.events):
                    if e.get('id') == existing_event_id:
                        # Update the existing event
                        e.update({
                            'title': event['title'],
                            'start': event['start'],
                            'end': event.get('end', event['start']),
                            'description': event.get('description', ''),
                            'color': event.get('color', '#3788d8')
                        })
                        return e
        
        # If no existing event or not a kanban card, create new event
        event['id'] = str(self.next_id)
        self.next_id += 1
        self.events.append(event)
        
        # If this is a kanban card, store the mapping
        if kanban_card_id:
            self.card_event_map[str(kanban_card_id)] = event['id']
            
        return event

    def get_events(self):
        return self.events

    def update_event(self, event_id, updated_data):
        for event in self.events:
            if event['id'] == event_id:
                event.update(updated_data)
                return event
        return None

    def delete_event(self, event_id):
        # Find and remove the event
        event_to_remove = None
        for event in self.events:
            if event['id'] == event_id:
                event_to_remove = event
                break
                
        if event_to_remove:
            self.events.remove(event_to_remove)
            
            # If this was a kanban card event, remove from map
            for card_id, mapped_event_id in list(self.card_event_map.items()):
                if mapped_event_id == event_id:
                    del self.card_event_map[card_id]
                    break

event_store = EventStore()


@zoom_bp.route('/')
def zoom():
    try:
        return render_template('zoom.html')
    except Exception as e:
        logger.error(f"Error rendering template: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@zoom_bp.route('/get_events', methods=['GET'])
def get_events():
    try:
        return jsonify(event_store.get_events())
    except Exception as e:
        logger.error(f"Error getting events: {str(e)}")
        return jsonify({"error": "Failed to get events"}), 500

@zoom_bp.route('/create_task', methods=['POST'])
def create_task():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['title', 'start']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        new_task = {
            'title': data['title'],
            'start': data['start'],
            'end': data.get('end', data['start']),
            'description': data.get('description', ''),
            'type': 'task',
            'color': data.get('color', '#3788d8'),
            'allDay': data.get('allDay', False)
        }
        
        # Add kanban card ID if provided (for tracking)
        if 'kanban_card_id' in data:
            new_task['kanban_card_id'] = data['kanban_card_id']

        event = event_store.add_event(new_task)
        logger.info(f"Created/updated task: {event}")
        return jsonify(event)

    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        return jsonify({"error": "Failed to create task"}), 500

@zoom_bp.route('/create_meeting', methods=['POST'])
def create_meeting():
    try:
        access_token = get_zoom_access_token()
        if not access_token:
            logger.error("Failed to get Zoom access token")
            return jsonify({"error": "Failed to get access token"}), 401

        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Создание встречи в Zoom
        meeting_response = create_zoom_meeting(access_token, data)
        if not meeting_response:
            return jsonify({"error": "Failed to create Zoom meeting"}), 500

        join_url = meeting_response['join_url']

        # Модифицируем ссылку, чтобы она открывалась в браузере
        web_url = join_url.replace("/j/", "/wc/join/")  # Формируем URL для браузера


        # Создание события в календаре
        event = {
            'title': data['topic'],
            'start': data['start_time'],
            'end': calculate_end_time(data['start_time'], data['duration']),
            'type': 'zoom',
            'zoom_url': web_url,
            'description': data.get('agenda', ''),
            'color': '#2196F3'  # Специальный цвет для Zoom встреч
        }

        saved_event = event_store.add_event(event)
        return jsonify({
            "meeting": meeting_response,
            "event": saved_event
        })

    except Exception as e:
        logger.error(f"Error in create_meeting: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@zoom_bp.route('/update_event/<event_id>', methods=['PUT'])
def update_event(event_id):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        updated_event = event_store.update_event(event_id, data)
        if updated_event:
            return jsonify(updated_event)
        return jsonify({"error": "Event not found"}), 404

    except Exception as e:
        logger.error(f"Error updating event: {str(e)}")
        return jsonify({"error": "Failed to update event"}), 500

@zoom_bp.route('/delete_event/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    try:
        event_store.delete_event(event_id)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error deleting event: {str(e)}")
        return jsonify({"error": "Failed to delete event"}), 500

def get_zoom_access_token():
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

def create_zoom_meeting(access_token, data):
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        meeting_data = {
            "topic": data["topic"],
            "type": 2,
            "start_time": data["start_time"],
            "duration": data["duration"],
            "timezone": "Europe/Moscow",
            "settings": {
                "host_video": True,
                "participant_video": True,
                "join_before_host": False,
                "mute_upon_entry": True,
                "waiting_room": True
            }
        }

        response = requests.post(
            "https://api.zoom.us/v2/users/me/meetings",
            headers=headers,
            json=meeting_data
        )

        if response.status_code != 201:
            logger.error(f"Zoom meeting creation error: {response.text}")
            return None

        return response.json()
    except Exception as e:
        logger.error(f"Error creating Zoom meeting: {str(e)}")
        return None

def calculate_end_time(start_time, duration):
    start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    end = start + timedelta(minutes=int(duration))
    return end.isoformat()