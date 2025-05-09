# calendar_routes.py

from flask import Blueprint, flash, request, jsonify, render_template, current_app, session, g
from flask_login import login_required, current_user
from routes.models import db, User, CalendarEvent, Card, List
from routes.zoom_service import EnhancedZoomService
import json
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import redirect
from routes.notifications import notify_user


# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

calendar_bp = Blueprint('calendar', __name__, url_prefix='/calendar')

# Decorator to check if user is admin
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
        return f(*args, **kwargs)
    return decorated_function

# Main calendar page
@calendar_bp.route('/')
@login_required
def calendar_page():
    return render_template('calendar_zoom/calendar.html')

# Get users for participant selection
@calendar_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    try:
        # Получить параметры запроса для фильтрации
        query = request.args.get('query', '')
        
        # Получить всех активных пользователей с возможной фильтрацией
        users = User.query.filter(
            (User.username.ilike(f'%{query}%') | User.email.ilike(f'%{query}%')),
            User.active == True
        ).all()
        
        # Форматировать пользователей для ответа
        user_list = [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "avatar": user.avatar
            }
            for user in users
        ]
            
        return jsonify(user_list)
    except Exception as e:
        logger.error(f"Ошибка получения пользователей: {str(e)}")
        # Добавляем Stack Trace для отладки
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Ошибка получения пользователей: {str(e)}"}), 500
    
# Get all events visible to the current user
@calendar_bp.route('/events', methods=['GET'])
@login_required
def get_events():
    try:
        events, error = EnhancedZoomService.get_events(current_user.id)
        if error:
            return jsonify({"error": error}), 500
        return jsonify(events)
    except Exception as e:
        logger.error(f"Ошибка получения событий: {str(e)}")
        return jsonify({"error": "Не удалось получить события"}), 500

# Create a personal task
@calendar_bp.route('/task', methods=['POST'])
@login_required
def create_task():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        required_fields = ['title', 'start']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Отсутствуют обязательные поля"}), 400

        # Create personal task
        task, error = EnhancedZoomService.create_personal_task(data, current_user.id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(task)
    except Exception as e:
        logger.error(f"Ошибка создания задачи: {str(e)}")
        return jsonify({"error": f"Не удалось создать задачу: {str(e)}"}), 500

# Create a Zoom meeting
@calendar_bp.route('/meeting', methods=['POST'])
@login_required
def create_meeting():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400

        required_fields = ['topic', 'start_time', 'duration']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Отсутствуют обязательные поля"}), 400
            
        # Get participant IDs if provided
        participant_ids = data.get('participants', [])
        
        # Create the Zoom meeting
        result, error = EnhancedZoomService.create_meeting(data, current_user.id, participant_ids)
        if error:
            return jsonify({"error": error}), 500
        
        # Send notifications to participants if the meeting was created successfully
        if result and 'event' in result:
            event_id = result['event']['id']
            event = CalendarEvent.query.get(event_id)
            
            if event:
                # Форматируем дату и время для уведомления
                meeting_date = event.start_time.strftime("%d.%m.%Y")
                meeting_time = event.start_time.strftime("%H:%M")
                
                # Notify participants
                for participant_id in participant_ids:
                    if participant_id != current_user.id:  # Don't notify the creator
                        message = f"{current_user.username} добавил(а) вас в конференцию \"{event.title}\" на {meeting_date} в {meeting_time}"
                        link = f"/calendar?event={event_id}"
                        notify_user(participant_id, message, "info", link)
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка создания конференции: {str(e)}")
        return jsonify({"error": f"Не удалось создать конференцию: {str(e)}"}), 500

# Add participants to a meeting
@calendar_bp.route('/meeting/<event_id>/participants', methods=['POST'])
@login_required
def add_participants(event_id):
    try:
        data = request.json
        if not data or 'participant_ids' not in data:
            return jsonify({"error": "Не предоставлены ID участников"}), 400
            
        # Check if user is admin or event creator
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Событие не найдено"}), 404
            
        if event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        # Get current participants before adding new ones
        current_participant_ids = [p.id for p in event.participants]
            
        # Add participants
        success, error = EnhancedZoomService.add_participants_to_meeting(event_id, data['participant_ids'])
        if not success:
            return jsonify({"error": error}), 500
        
        # Форматируем дату и время для уведомления
        meeting_date = event.start_time.strftime("%d.%m.%Y")
        meeting_time = event.start_time.strftime("%H:%M")
        
        # Send notifications to newly added participants
        for participant_id in data['participant_ids']:
            # Only notify new participants
            if participant_id not in current_participant_ids:
                message = f"{current_user.username} добавил(а) вас в конференцию \"{event.title}\" на {meeting_date} в {meeting_time}"
                link = f"/calendar?event={event_id}"
                notify_user(participant_id, message, "info", link)
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка добавления участников: {str(e)}")
        return jsonify({"error": f"Не удалось добавить участников: {str(e)}"}), 500


# Get host URL for a meeting (creator or admin)
@calendar_bp.route('/meeting/<event_id>/host-url', methods=['GET'])
@login_required
def get_host_url(event_id):
    try:
        # Получаем событие из БД
        event = CalendarEvent.query.get_or_404(event_id)
        
        # Проверка прав доступа: только создатель или админ
        if event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "У вас нет прав для получения URL организатора"}), 403
        
        result, error = EnhancedZoomService.generate_host_url(event_id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка получения ссылки организатора: {str(e)}")
        return jsonify({"error": f"Не удалось получить ссылку организатора: {str(e)}"}), 500

# Update an event
@calendar_bp.route('/event/<event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400
            
        # Update the event
        result, error = EnhancedZoomService.update_event(event_id, data, current_user.id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка обновления события: {str(e)}")
        return jsonify({"error": f"Не удалось обновить событие: {str(e)}"}), 500

# Delete an event
@calendar_bp.route('/event/<event_id>', methods=['DELETE'])
@login_required
def delete_event(event_id):
    try:
        # Delete the event
        success, error = EnhancedZoomService.delete_event(event_id, current_user.id)
        if not success:
            return jsonify({"error": error}), 500
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка удаления события: {str(e)}")
        return jsonify({"error": f"Не удалось удалить событие: {str(e)}"}), 500

# Get participant information for a meeting
@calendar_bp.route('/meeting/<event_id>/participants', methods=['GET'])
@login_required
def get_meeting_participants(event_id):
    try:
        # Check if user has access to the meeting
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Событие не найдено"}), 404
            
        # Check if user is participant, creator, or admin
        if current_user.id not in [p.id for p in event.participants] and \
           event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        participants, error = EnhancedZoomService.get_meeting_participants(event_id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(participants)
    except Exception as e:
        logger.error(f"Ошибка получения участников: {str(e)}")
        return jsonify({"error": f"Не удалось получить участников: {str(e)}"}), 500

# Remove participant from a meeting
@calendar_bp.route('/meeting/<event_id>/participants/<user_id>', methods=['DELETE'])
@login_required
def remove_participant(event_id, user_id):
    try:
        # Check if user is admin or event creator
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Событие не найдено"}), 404
            
        if event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        # Remove participant
        success, error = EnhancedZoomService.remove_participant_from_meeting(event_id, user_id)
        if not success:
            return jsonify({"error": error}), 500
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка удаления участника: {str(e)}")
        return jsonify({"error": f"Не удалось удалить участника: {str(e)}"}), 500

# Get meeting join URL
@calendar_bp.route('/meeting/<event_id>/join-url', methods=['GET'])
@login_required
def get_join_url(event_id):
    try:
        # Check if user has access to the meeting
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Событие не найдено"}), 404
            
        # Check if user is participant, creator, or admin
        if current_user.id not in [p.id for p in event.participants] and \
           event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        join_url, error = EnhancedZoomService.generate_join_url(event_id, current_user.id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify({"join_url": join_url})
    except Exception as e:
        logger.error(f"Ошибка получения ссылки для подключения: {str(e)}")
        return jsonify({"error": f"Не удалось получить ссылку для подключения: {str(e)}"}), 500

# Get available users for participant selection
@calendar_bp.route('/available-users', methods=['GET'])
@login_required
def get_available_users():
    try:
        # Получить параметры запроса для фильтрации
        query = request.args.get('query', '')
        
        # Получить пользователей на основе роли
        if current_user.is_admin:
            # Администраторы могут видеть всех пользователей
            users = User.query.filter(
                (User.username.ilike(f'%{query}%') | User.email.ilike(f'%{query}%')),
                User.active == True
            ).all()
        else:
            # Обычные пользователи видят всех активных пользователей
            users = User.query.filter(
                (User.username.ilike(f'%{query}%') | User.email.ilike(f'%{query}%')),
                User.active == True
            ).all()
            
        # Форматировать пользователей для ответа
        user_list = [
            {
                "id": user.id,
                "username": user.username,
                "name": user.username,  # Добавляем name для совместимости с JS кодом
                "email": user.email,
                "avatar": user.avatar
            }
            for user in users
        ]
            
        return jsonify(user_list)
    except Exception as e:
        logger.error(f"Ошибка получения доступных пользователей: {str(e)}")
        # Добавляем Stack Trace для отладки
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Ошибка получения доступных пользователей: {str(e)}"}), 500

# Get calendar settings
@calendar_bp.route('/settings', methods=['GET'])
@login_required
def get_calendar_settings():
    try:
        settings = {
            "default_meeting_duration": 60,
            "default_reminder_time": 15,
            "working_hours": {
                "start": "09:00",
                "end": "18:00"
            },
            "working_days": [1, 2, 3, 4, 5],  # Monday to Friday
            "time_zone": current_user.time_zone or "UTC"
        }
        
        return jsonify(settings)
    except Exception as e:
        logger.error(f"Ошибка получения настроек календаря: {str(e)}")
        return jsonify({"error": f"Не удалось получить настройки календаря: {str(e)}"}), 500

# Update calendar settings
@calendar_bp.route('/settings', methods=['PUT'])
@login_required
def update_calendar_settings():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Данные не предоставлены"}), 400
            
        # Update user time zone if provided
        if 'time_zone' in data:
            current_user.time_zone = data['time_zone']
            db.session.commit()
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка обновления настроек календаря: {str(e)}")
        return jsonify({"error": f"Не удалось обновить настройки календаря: {str(e)}"}), 500

# Add an endpoint to handle navigation to cards from the calendar
@calendar_bp.route('/card/<card_id>')
@login_required
def view_card(card_id):
    """Redirect to the kanban board with the specific card highlighted"""
    try:
        # Check if card exists
        card = Card.query.get_or_404(card_id)
        
        # Get the board ID from the card's list
        board_id = card.list.board_id if card.list else None
        
        if not board_id:
            return jsonify({"error": "Доска не найдена для этой карточки"}), 404

        # Redirect to the kanban board with card ID parameter
        return redirect(f"/kanban/boards/{board_id}?card={card_id}")
    except Exception as e:
        logger.error(f"Ошибка просмотра карточки: {str(e)}")
        return jsonify({"error": f"Не удалось просмотреть карточку: {str(e)}"}), 500

# You can also add a route to mark a card as completed directly from the calendar
@calendar_bp.route('/card/<card_id>/complete', methods=['POST'])
@login_required
def complete_card(card_id):
    """Mark a card as completed from the calendar"""
    try:
        # Check if card exists
        card = Card.query.get_or_404(card_id)
        
        # Check permissions (assigned user or creator or admin)
        if card.user_id != current_user.id and card.assigned_to != current_user.id and current_user.id not in [u.id for u in card.assigned_users] and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав для изменения карточки"}), 403
        
        # Mark as completed
        card.completed = True
        db.session.commit()
        
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка завершения карточки: {str(e)}")
        db.session.rollback()
        return jsonify({"error": f"Не удалось завершить карточку: {str(e)}"}), 500
    
# В файле calendar.py, исправьте маршрут goto_card, чтобы он корректно перенаправлял на канбан

@calendar_bp.route('/goto-card/<card_id>')
@login_required
def goto_card(card_id):
    try:
        # Добавляем отладочную информацию
        current_app.logger.info(f"Запрос перехода к карточке {card_id}")
        
        # Находим карточку
        card = Card.query.get(card_id)
        if not card:
            current_app.logger.error(f"Карточка с ID {card_id} не найдена")
            flash('Карточка не найдена', 'error')
            return redirect('/kanban')
        
        current_app.logger.info(f"Карточка найдена: {card.title}")
        
        # Проверяем, есть ли список и доска
        list_id = card.list_id
        list_obj = List.query.get(list_id)
        
        if not list_obj:
            current_app.logger.warning(f"Список не найден для карточки {card_id}")
            flash('Список не найден', 'warning')
            return redirect('/kanban')
            
        board_id = list_obj.board_id
        current_app.logger.info(f"Доска найдена: {board_id}")
        
        # Формируем URL для перенаправления
        # Используем путь /kanban вместо /kanban/boards/{board_id}
        redirect_url = f"/kanban?board_id={board_id}&highlight_card={card_id}"
        current_app.logger.info(f"Перенаправление на: {redirect_url}")
        
        # Перенаправляем на доску с параметром highlight_card для подсветки карточки
        return redirect(redirect_url)
    except Exception as e:
        current_app.logger.error(f"Ошибка перехода к карточке: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        flash('Произошла ошибка при переходе к карточке', 'error')
        return redirect('/kanban')