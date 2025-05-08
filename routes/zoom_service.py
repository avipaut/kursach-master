# zoom_service.py

from flask import current_app
import requests
import base64
import json
import logging
from datetime import datetime, timedelta
from routes.models import db, CalendarEvent, User, event_participants, Card

logger = logging.getLogger(__name__)

# Zoom API configuration
class Config:
    ZOOM_CLIENT_ID = "w_fzfD1TTZytEbhNulxnvw"
    ZOOM_CLIENT_SECRET = "SoBr0k2T9Gmj80sfzOfwXUZ6CesQqoCW"
    ZOOM_ACCOUNT_ID = "bcNFDbsfSj6SKa7SbfdUvQ"

class EnhancedZoomService:
    @staticmethod
    def get_access_token():
        """Get Zoom API access token with detailed error handling"""
        try:
            url = "https://zoom.us/oauth/token"
            
            # Базовая аутентификация
            auth_str = f"{Config.ZOOM_CLIENT_ID}:{Config.ZOOM_CLIENT_SECRET}"
            auth_bytes = auth_str.encode('ascii')
            base64_bytes = base64.b64encode(auth_bytes)
            base64_auth = base64_bytes.decode('ascii')
            
            headers = {
                'Authorization': f'Basic {base64_auth}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            payload = {
                'grant_type': 'account_credentials',
                'account_id': Config.ZOOM_ACCOUNT_ID
            }
            
            logger.info(f"Requesting Zoom access token using account_id: {Config.ZOOM_ACCOUNT_ID[:5]}...")
            response = requests.post(url, headers=headers, data=payload)
            
            logger.info(f"Access token response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"Access token error: {response.status_code}, {response.text}")
                
                # Возможные проблемы
                if response.status_code == 401:
                    logger.error("Authentication failed: Check CLIENT_ID and CLIENT_SECRET")
                elif response.status_code == 400:
                    logger.error("Bad request: Check account_id and grant_type")
                    
                return None
                
            data = response.json()
            access_token = data.get('access_token')
            expires_in = data.get('expires_in')
            
            if not access_token:
                logger.error("No access token found in response")
                return None
                
            logger.info(f"Successfully obtained access token (expires in {expires_in} seconds)")
            return access_token
        except Exception as e:
            logger.error(f"Exception in get_access_token: {str(e)}")
            return None
    @staticmethod
    def get_zak_token(access_token):
        """Get ZAK token for host privileges with enhanced error handling"""
        try:
            if not access_token:
                logger.error("Cannot get ZAK token: No access token provided")
                return None
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"  # Добавляем Content-Type
            }
            
            url = "https://api.zoom.us/v2/users/me/token?type=zak"
            logger.info(f"Requesting ZAK token from Zoom API...")
            
            # Попытка получить ZAK токен
            response = requests.get(url, headers=headers)
            
            # Подробное логирование результата
            logger.info(f"ZAK token response status: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"ZAK token error: Status {response.status_code}, Response: {error_text}")
            
            # Проверяем конкретные ошибки
                try:
                    error_data = response.json()
                    error_code = error_data.get("code")
                    error_message = error_data.get("message")
                    
                    if error_code == 124:  # Invalid access token
                        logger.error("Access token is invalid or expired")
                        return None
                    elif error_code == 1001:  # User does not exist
                        logger.error("User not found - check Zoom account")
                        return None
                    
                    logger.error(f"Zoom API error: {error_code} - {error_message}")
                except:
                    pass
                
                return None
                
        # Парсим результат
            try:
                token_data = response.json()
                zak_token = token_data.get("token")
            
                if not zak_token:
                    logger.error(f"ZAK token not found in response: {token_data}")
                    return None
                
                logger.info("Successfully retrieved ZAK token")
                return zak_token
            except Exception as parse_error:
                logger.error(f"Failed to parse ZAK token response: {str(parse_error)}")
                return None
        except Exception as e:
            logger.error(f"Exception in get_zak_token: {str(e)}")
            return None
    @staticmethod
    def create_meeting(data, creator_id, participant_ids=None):
        """
        Create a Zoom meeting and save to database
        
        Args:
            data: Meeting data (topic, start_time, duration, etc.)
            creator_id: User ID of the meeting creator
            participant_ids: List of user IDs to add as participants
        """
        try:
            # Get API access token
            access_token = EnhancedZoomService.get_access_token()
            if not access_token:
                logger.error("Failed to get Zoom access token")
                return None, "Не удалось получить токен доступа к Zoom API"

            # Get ZAK token for host privileges
            zak_token = EnhancedZoomService.get_zak_token(access_token)
            if not zak_token:
                logger.warning("Failed to get ZAK token - users may need to wait for host")

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            # Configure meeting with optimal settings
            meeting_data = {
                "topic": data["topic"],
                "type": 2,  # Scheduled meeting
                "start_time": data["start_time"],
                "duration": data["duration"],
                "timezone": "Europe/Moscow",
                "settings": {
                    "host_video": True,
                    "participant_video": True,
                    "join_before_host": True,  # Allow joining before host arrives
                    "mute_upon_entry": True,
                    "waiting_room": False,  # Disable waiting room for instant join
                    "auto_recording": "cloud" if data.get("auto_record", False) else "none",  # Auto-record if requested
                    "alternative_hosts_email_notification": False,
                    "use_pmi": False,  # Don't use Personal Meeting ID
                    "approval_type": 0,  # Автоматическое одобрение
                    "registration_type": 1  # Регистрация не требуется
                }
            }

            # Create meeting via API
            response = requests.post(
                "https://api.zoom.us/v2/users/me/meetings",
                headers=headers,
                json=meeting_data
            )

            if response.status_code != 201:
                logger.error(f"Zoom meeting creation error: {response.text}")
                return None, f"Ошибка создания встречи в Zoom: {response.text}"

            meeting_response = response.json()
            
            # Convert start and end times
            start_time = datetime.fromisoformat(data["start_time"].replace('Z', '+00:00'))
            end_time = start_time + timedelta(minutes=int(data["duration"]))
            
            # Get meeting details
            join_url = meeting_response['join_url']
            meeting_id = meeting_response.get("id")
            password = meeting_response.get("password")
            
            # Modify link for browser
            web_url = join_url.replace("/j/", "/wc/join/")
            
            # Add ZAK token for host privileges if available
            if zak_token:
                # Add token to URL
                if "?" in web_url:
                    web_url = f"{web_url}&zak={zak_token}"
                else:
                    web_url = f"{web_url}?zak={zak_token}"
            
            # Create database record
            event = CalendarEvent(
                title=data["topic"],
                start_time=start_time,
                end_time=end_time,
                description=data.get("agenda", ""),
                event_type="zoom",
                color="#2196F3",
                creator_id=creator_id,
                zoom_url=web_url,
                zoom_meeting_id=meeting_id,
                zoom_password=password,
            )
            
            db.session.add(event)
            
            # Add participants if provided
            if participant_ids:
                participants = User.query.filter(User.id.in_(participant_ids)).all()
                for participant in participants:
                    event.participants.append(participant)
            
            db.session.commit()
            
            # Prepare response with meeting info and tokens
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
    def get_meeting_recordings(meeting_id):
        """Get recordings for a specific meeting"""
        try:
            access_token = EnhancedZoomService.get_access_token()
            if not access_token:
                return None, "Не удалось получить токен доступа"
                
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Request recordings for this meeting
            response = requests.get(
                f"https://api.zoom.us/v2/meetings/{meeting_id}/recordings",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to get recordings: {response.text}")
                # If meeting not found or no recordings yet
                if response.status_code == 404:
                    return [], None
                return None, f"Ошибка получения записей: {response.text}"
                
            recordings_data = response.json()
            
            # Update the event with recording information
            event = CalendarEvent.query.filter_by(zoom_meeting_id=meeting_id).first()
            if event and recordings_data.get('recording_files'):
                event.is_recorded = True
                
                # Get the share URL for the recording
                recording_url = recordings_data.get('share_url')
                if not recording_url and recordings_data.get('recording_files'):
                    # Use the first recording file's play URL if no share URL
                    recording_url = recordings_data['recording_files'][0].get('play_url')
                
                event.recording_url = recording_url
                db.session.commit()
            
            return recordings_data, None
            
        except Exception as e:
            logger.error(f"Error getting recordings: {str(e)}")
            return None, f"Ошибка получения записей встречи: {str(e)}"
    
    @staticmethod
    def get_all_recordings(from_date=None, to_date=None):
        """Get all recordings within a date range"""
        try:
            access_token = EnhancedZoomService.get_access_token()
            if not access_token:
                return None, "Не удалось получить токен доступа"
                
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Set default date range to last 30 days if not specified
            if not from_date:
                from_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            if not to_date:
                to_date = datetime.utcnow().strftime("%Y-%m-%d")
                
            # Request all recordings in date range
            params = {
                "from": from_date,
                "to": to_date
            }
            
            response = requests.get(
                "https://api.zoom.us/v2/users/me/recordings",
                headers=headers,
                params=params
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to get recordings: {response.text}")
                return None, f"Ошибка получения записей: {response.text}"
                
            return response.json(), None
            
        except Exception as e:
            logger.error(f"Error getting recordings: {str(e)}")
            return None, f"Ошибка получения записей: {str(e)}"

    @staticmethod
    def add_participants_to_meeting(event_id, participant_ids):
        """
        Add participants to an existing meeting
        
        Args:
            event_id: CalendarEvent ID
            participant_ids: List of user IDs to add as participants
        """
        try:
            event = CalendarEvent.query.get(event_id)
            if not event or event.event_type != 'zoom':
                return False, "Встреча не найдена или не является Zoom-конференцией"
                
            # Get users to add
            participants = User.query.filter(User.id.in_(participant_ids)).all()
            
            # Add each user if not already a participant
            current_participant_ids = [p.id for p in event.participants]
            for participant in participants:
                if participant.id not in current_participant_ids:
                    event.participants.append(participant)
            
            db.session.commit()
            return True, None
            
        except Exception as e:
            logger.error(f"Error adding participants: {str(e)}")
            db.session.rollback()
            return False, f"Ошибка добавления участников: {str(e)}"

    @staticmethod
    def generate_host_url(event_id):
        """Create a fresh host URL with better error handling"""
        try:
            # Получаем данные о встрече
            event = CalendarEvent.query.get(event_id)
            if not event:
                logger.error(f"Event not found: {event_id}")
                return None, "Встреча не найдена"
                
            if event.event_type != 'zoom' or not event.zoom_meeting_id:
                logger.error(f"Event is not a Zoom meeting: {event_id}")
                return None, "Это событие не является Zoom-конференцией"
            
            # Получаем токены для URL организатора
            logger.info(f"Generating host URL for meeting: {event.zoom_meeting_id}")
            
            # Получаем токен доступа
            access_token = EnhancedZoomService.get_access_token()
            if not access_token:
                logger.error("Failed to get access token")
                return None, "Не удалось получить токен доступа к Zoom API"
            
            # Проверяем актуальность встречи в Zoom
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Проверка статуса встречи
            meeting_id = event.zoom_meeting_id
            try:
                meeting_response = requests.get(
                    f"https://api.zoom.us/v2/meetings/{meeting_id}",
                    headers=headers
                )
                
                if meeting_response.status_code != 200:
                    logger.error(f"Meeting check failed: {meeting_response.status_code}, {meeting_response.text}")
                    # Если встреча не найдена, пробуем альтернативный подход
                    if meeting_response.status_code == 404:
                        logger.warning("Meeting not found in Zoom, using alternative approach")
                        # Упрощенная версия URL без ZAK
                        return {"host_url": f"https://zoom.us/s/{meeting_id}"}, None
                
                meeting_data = meeting_response.json()
                logger.info(f"Meeting exists, status: {meeting_data.get('status')}")
                
            except Exception as e:
                logger.error(f"Error checking meeting: {str(e)}")
                # Продолжаем, даже если проверка не удалась
            
            # Получаем ZAK токен
            zak_token = EnhancedZoomService.get_zak_token(access_token)
            
            # Если не удалось получить ZAK токен, попробуем альтернативный подход
            if not zak_token:
                logger.warning("ZAK token not available, using alternative URL method")
                
                # Попробуем использовать start_url из данных встречи
                alternative_url = f"https://zoom.us/s/{meeting_id}"
                return {"host_url": alternative_url, "warning": "ZAK токен не получен, некоторые функции организатора могут быть недоступны"}, None
            
            # Создаем URL с ZAK токеном
            host_url = f"https://zoom.us/wc/join/{meeting_id}?zak={zak_token}"
            logger.info(f"Successfully generated host URL with ZAK token")
            
            return {"host_url": host_url}, None
        
        except Exception as e:
            logger.error(f"Error generating host URL: {str(e)}")
            return None, f"Ошибка создания ссылки организатора: {str(e)}"
    @staticmethod
    def create_personal_task(data, user_id):
        """Create a personal task visible only to the creator"""
        try:
            # Convert start and end times
            start_time = datetime.fromisoformat(data["start"].replace('Z', '+00:00') if 'Z' in data["start"] else data["start"])
            
            # Use end time if provided, otherwise set to same as start
            if data.get("end"):
                end_time = datetime.fromisoformat(data["end"].replace('Z', '+00:00') if 'Z' in data["end"] else data["end"])
            else:
                end_time = start_time + timedelta(hours=1)  # Default to 1 hour duration
            
            # Create the personal task
            task = CalendarEvent(
                title=data["title"],
                start_time=start_time,
                end_time=end_time,
                description=data.get("description", ""),
                event_type="personal",
                color=data.get("color", "#3788d8"),
                all_day=data.get("allDay", False),
                creator_id=user_id,
                is_private=True  # Mark as private so only the creator can see it
            )
            
            db.session.add(task)
            db.session.commit()
            
            return task.to_dict(), None
            
        except Exception as e:
            logger.error(f"Error creating personal task: {str(e)}")
            db.session.rollback()
            return None, f"Ошибка создания задачи: {str(e)}"

    @staticmethod
    def update_event(event_id, data, user_id):
        """Update an existing event (with permission check)"""
        try:
            event = CalendarEvent.query.get(event_id)
            if not event:
                return None, "Событие не найдено"
                
            # Check permissions - only admin or creator can update
            user = User.query.get(user_id)
            if not user:
                return None, "Пользователь не найден"
                
            if event.creator_id != user_id and not user.is_admin:
                return None, "Недостаточно прав для редактирования события"
            
            # Update basic event fields
            if "title" in data:
                event.title = data["title"]
            if "description" in data:
                event.description = data["description"]
            if "start" in data:
                event.start_time = datetime.fromisoformat(data["start"].replace('Z', '+00:00') if 'Z' in data["start"] else data["start"])
            if "end" in data:
                event.end_time = datetime.fromisoformat(data["end"].replace('Z', '+00:00') if 'Z' in data["end"] else data["end"])
            if "color" in data:
                event.color = data["color"]
            if "allDay" in data:
                event.all_day = data["allDay"]
                
            # Handle participant updates if provided and event is not personal
            if "participants" in data and not event.is_private:
                # Clear current participants and add new ones
                event.participants = []
                
                participant_ids = data["participants"]
                participants = User.query.filter(User.id.in_(participant_ids)).all()
                for participant in participants:
                    event.participants.append(participant)
            
            db.session.commit()
            return event.to_dict(), None
            
        except Exception as e:
            logger.error(f"Error updating event: {str(e)}")
            db.session.rollback()
            return None, f"Ошибка обновления события: {str(e)}"

    @staticmethod
    def delete_event(event_id, user_id):
        """Delete an event (with permission check)"""
        try:
            event = CalendarEvent.query.get(event_id)
            if not event:
                return False, "Событие не найдено"
                
            # Check permissions - only admin or creator can delete
            user = User.query.get(user_id)
            if not user:
                return False, "Пользователь не найден"
                
            if event.creator_id != user_id and not user.is_admin:
                return False, "Недостаточно прав для удаления события"
            
            # If it's a Zoom meeting, consider cancelling it via API
            if event.event_type == 'zoom' and event.zoom_meeting_id:
                # Only cancel meetings in the future
                if event.start_time > datetime.utcnow():
                    access_token = EnhancedZoomService.get_access_token()
                    if access_token:
                        headers = {
                            "Authorization": f"Bearer {access_token}",
                            "Content-Type": "application/json"
                        }
                        
                        # Try to delete the meeting from Zoom
                        response = requests.delete(
                            f"https://api.zoom.us/v2/meetings/{event.zoom_meeting_id}",
                            headers=headers
                        )
                        
                        if response.status_code not in [204, 404]:  # 204=Success, 404=Already deleted
                            logger.warning(f"Failed to delete Zoom meeting: {response.text}")
            
            # Delete from database
            db.session.delete(event)
            db.session.commit()
            return True, None
            
        except Exception as e:
            logger.error(f"Error deleting event: {str(e)}")
            db.session.rollback()
            return False, f"Ошибка удаления события: {str(e)}"
            
    # Add this function to the EnhancedZoomService class in zoom_service.py

    @staticmethod
    def get_events(user_id):
        """
        Get all events visible to the user:
        - All public events
        - All private events created by the user
        - Only card deadlines where the user is assigned as responsible (no duplicates)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "Пользователь не найден"
                
            # Get all public events (avoid events related to cards)
            public_events = CalendarEvent.query.filter(
                CalendarEvent.is_private == False,
                ~CalendarEvent.title.like("%[DEADLINE]%")  # Exclude any existing card deadline events
            ).all()
            
            # Get all private events created by the user (avoid events related to cards)
            private_events = CalendarEvent.query.filter(
                CalendarEvent.is_private == True,
                CalendarEvent.creator_id == user_id,
                ~CalendarEvent.title.like("%[DEADLINE]%")  # Exclude any existing card deadline events
            ).all()
            
            # Get ONLY cards where the user is assigned and has a deadline
            cards_with_deadline = []
            
            # Check cards where user is directly assigned (assigned_to field)
            direct_assigned_cards = Card.query.filter(
                Card.assigned_to == user_id,
                Card.deadline.isnot(None),
                Card.completed == False
            ).all()
            cards_with_deadline.extend(direct_assigned_cards)
            
            # Check cards where user is in the assigned_users relationship
            multi_assigned_cards = Card.query.filter(
                Card.assigned_users.any(id=user_id),
                Card.deadline.isnot(None),
                Card.completed == False
            ).all()
            
            # Add cards from multi-assignment if not already included
            for card in multi_assigned_cards:
                if card not in cards_with_deadline:
                    cards_with_deadline.append(card)
            
            # Convert cards to calendar events
            card_events = []
            for card in cards_with_deadline:
                # Create a calendar event object from the card
                deadline_date = card.deadline
                
                # Set event end time to end of the day
                end_time = datetime.combine(
                    deadline_date.date(),
                    datetime.max.time()
                )
                
                # Get the board and list names for context
                list_name = card.list.name if card.list else "Unknown List"
                board_name = card.list.board.name if card.list and card.list.board else "Unknown Board"
                
                # Create an event dict in the format expected by the frontend
                card_event = {
                    'id': f"card_{card.id}",  # Prefix with 'card_' to differentiate from regular events
                    'title': f"[DEADLINE] {card.title}",
                    'start': deadline_date.isoformat(),
                    'end': end_time.isoformat(),
                    'description': f"Card: {card.title}\nDescription: {card.description}\nBoard: {board_name}\nList: {list_name}",
                    'type': 'task',
                    'color': card.custom_color or "#FF5722",  # Use card color or default to orange
                    'allDay': True,
                    'creator_id': card.user_id,
                    'creator_name': card.user.username if card.user else "Unknown",
                    'is_card': True,  # Flag to identify this as a card deadline
                    'card_id': card.id,
                    'board_id': card.list.board_id if card.list and card.list.board else None,
                    'list_id': card.list_id,
                    'priority': card.priority.value if card.priority else 'low'
                }
                card_events.append(card_event)
            
            # Combine regular events and card events
            all_visible_events = [event.to_dict() for event in (public_events + private_events)]
            all_visible_events.extend(card_events)
            
            return all_visible_events, None
            
        except Exception as e:
            logger.error(f"Error getting events: {str(e)}")
            return None, f"Ошибка получения событий: {str(e)}"
    @staticmethod
    def get_meeting_participants(event_id):
        """Get list of participants for a meeting"""
        try:
            event = CalendarEvent.query.get(event_id)
            if not event:
                return None, "Событие не найдено"
                
            # Convert participants to dict format
            participants = []
            for participant in event.participants:
                participants.append({
                    "id": participant.id,
                    "name": participant.name,
                    "email": participant.email,
                    "avatar": participant.avatar,
                    "department": participant.department.name if participant.department else None
                })
                
            return participants, None
            
        except Exception as e:
            logger.error(f"Error getting meeting participants: {str(e)}")
            return None, f"Ошибка получения участников встречи: {str(e)}"

    @staticmethod
    def remove_participant_from_meeting(event_id, user_id):
        """Remove a participant from a meeting"""
        try:
            event = CalendarEvent.query.get(event_id)
            if not event:
                return False, "Событие не найдено"
                
            # Find the participant to remove
            participant = User.query.get(user_id)
            if not participant:
                return False, "Пользователь не найден"
                
            # Remove from the event
            if participant in event.participants:
                event.participants.remove(participant)
                db.session.commit()
                return True, None
            else:
                return False, "Пользователь не является участником встречи"
            
        except Exception as e:
            logger.error(f"Error removing participant: {str(e)}")
            db.session.rollback()
            return False, f"Ошибка удаления участника: {str(e)}"

    @staticmethod
    def generate_join_url(event_id, user_id):
        """Generate a join URL for a participant"""
        try:
            event = CalendarEvent.query.get(event_id)
            if not event or event.event_type != 'zoom':
                return None, "Встреча не найдена или не является Zoom-конференцией"
            
            # Check if the user is the creator
            is_creator = (event.creator_id == user_id)
            
            # If creator, try to get a host URL with ZAK token
            if is_creator:
                access_token = EnhancedZoomService.get_access_token()
                if access_token:
                    zak_token = EnhancedZoomService.get_zak_token(access_token)
                    if zak_token:
                        meeting_id = event.zoom_meeting_id
                        host_url = f"https://zoom.us/wc/join/{meeting_id}?zak={zak_token}"
                        return host_url, None
            
            # Return regular join URL for participant
            if event.zoom_url:
                return event.zoom_url, None
            else:
                return f"https://zoom.us/wc/join/{event.zoom_meeting_id}", None
            
        except Exception as e:
            logger.error(f"Error generating join URL: {str(e)}")
            return None, f"Ошибка создания ссылки для подключения: {str(e)}"

    @staticmethod
    def create_recurring_meeting(data, creator_id, participant_ids=None):
        """Create a recurring Zoom meeting"""
        try:
            # Get API access token
            access_token = EnhancedZoomService.get_access_token()
            if not access_token:
                logger.error("Failed to get Zoom access token")
                return None, "Не удалось получить токен доступа к Zoom API"

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            # Set up recurrence information
            recurrence_type = data.get("recurrence_type", "weekly")
            recurrence_config = {
                "type": 2,  # Weekly by default
                "repeat_interval": data.get("repeat_interval", 1)
            }
            
            # Configure type based on selection
            if recurrence_type == "daily":
                recurrence_config["type"] = 1
            elif recurrence_type == "weekly":
                recurrence_config["type"] = 2
                recurrence_config["weekly_days"] = data.get("weekly_days", "1")  # Monday by default
            elif recurrence_type == "monthly":
                recurrence_config["type"] = 3
                recurrence_config["monthly_day"] = data.get("monthly_day", 1)  # 1st day by default

            # Configure end date if provided
            if data.get("end_date_time"):
                recurrence_config["end_date_time"] = data.get("end_date_time")
            elif data.get("end_times"):
                recurrence_config["end_times"] = data.get("end_times")
                
            # Configure meeting with recurrence
            meeting_data = {
                "topic": data["topic"],
                "type": 8,  # Recurring meeting with fixed time
                "start_time": data["start_time"],
                "duration": data["duration"],
                "timezone": "Europe/Moscow",
                "recurrence": recurrence_config,
                "settings": {
                    "host_video": True,
                    "participant_video": True,
                    "join_before_host": True,
                    "mute_upon_entry": True,
                    "waiting_room": False,
                    "auto_recording": "cloud" if data.get("auto_record", False) else "none",
                    "alternative_hosts_email_notification": False,
                    "use_pmi": False
                }
            }

            # Create meeting via API
            response = requests.post(
                "https://api.zoom.us/v2/users/me/meetings",
                headers=headers,
                json=meeting_data
            )

            if response.status_code != 201:
                logger.error(f"Zoom recurring meeting creation error: {response.text}")
                return None, f"Ошибка создания повторяющейся встречи в Zoom: {response.text}"

            meeting_response = response.json()
            
            # Convert start and end times for first occurrence
            start_time = datetime.fromisoformat(data["start_time"].replace('Z', '+00:00'))
            end_time = start_time + timedelta(minutes=int(data["duration"]))
            
            # Get meeting details
            join_url = meeting_response['join_url']
            meeting_id = meeting_response.get("id")
            password = meeting_response.get("password")
            
            # Modify link for browser
            web_url = join_url.replace("/j/", "/wc/join/")
            
            # Create database record for the recurring meeting series
            event = CalendarEvent(
                title=data["topic"],
                start_time=start_time,
                end_time=end_time,
                description=data.get("agenda", ""),
                event_type="zoom_recurring",
                color="#9C27B0",  # Different color for recurring meetings
                creator_id=creator_id,
                zoom_url=web_url,
                zoom_meeting_id=meeting_id,
                zoom_password=password,
                is_recorded=data.get("auto_record", False),
                recurrence_info=json.dumps(recurrence_config)
            )
            
            db.session.add(event)
            
            # Add participants if provided
            if participant_ids:
                participants = User.query.filter(User.id.in_(participant_ids)).all()
                for participant in participants:
                    event.participants.append(participant)
            
            db.session.commit()
            
            # Prepare response
            result = {
                "meeting": meeting_response,
                "event": event.to_dict()
            }
            
            return result, None
            
        except Exception as e:
            logger.error(f"Error creating recurring Zoom meeting: {str(e)}")
            db.session.rollback()
            return None, f"Ошибка создания повторяющейся встречи Zoom: {str(e)}"

    @staticmethod
    def generate_meeting_report(event_id):
        """Generate a detailed report for a meeting"""
        try:
            event = CalendarEvent.query.get(event_id)
            if not event or not event.zoom_meeting_id:
                return None, "Событие не найдено или не является Zoom-конференцией"
                
            # Get meeting details from Zoom API
            access_token = EnhancedZoomService.get_access_token()
            if not access_token:
                return None, "Не удалось получить токен доступа к Zoom API"
                
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Get meeting participants from Zoom
            response = requests.get(
                f"https://api.zoom.us/v2/past_meetings/{event.zoom_meeting_id}/participants",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to get meeting participants: {response.text}")
                return None, f"Ошибка получения отчета о встрече: {response.text}"
                
            participants_data = response.json().get("participants", [])
            
            # Format report data
            report = {
                "meeting_id": event.zoom_meeting_id,
                "meeting_topic": event.title,
                "start_time": event.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": event.end_time.strftime("%Y-%m-%d %H:%M:%S"),
                "duration_minutes": int((event.end_time - event.start_time).total_seconds() / 60),
                "participants": []
            }
            
            # Add participant details
            for participant in participants_data:
                participant_info = {
                    "name": participant.get("name", "Unknown"),
                    "email": participant.get("user_email", ""),
                    "join_time": participant.get("join_time", ""),
                    "leave_time": participant.get("leave_time", ""),
                    "duration_minutes": participant.get("duration", 0),
                    "status": "Attended"
                }
                report["participants"].append(participant_info)
                
            # Add invited participants who didn't attend
            invited_participants = event.participants
            invited_emails = [p.email for p in invited_participants]
            attended_emails = [p.get("email") for p in report["participants"] if p.get("email")]
            
            # Find participants who didn't attend
            for participant in invited_participants:
                if participant.email not in attended_emails:
                    report["participants"].append({
                        "name": participant.name,
                        "email": participant.email,
                        "join_time": "",
                        "leave_time": "",
                        "duration_minutes": 0,
                        "status": "No-show"
                    })
            
            return report, None
            
        except Exception as e:
            logger.error(f"Error generating meeting report: {str(e)}")
            return None, f"Ошибка создания отчета о встрече: {str(e)}"