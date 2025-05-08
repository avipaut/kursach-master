# calendar_routes.py

from flask import Blueprint, flash, request, jsonify, render_template, current_app, session, g
from flask_login import login_required, current_user
from routes.models import db, User, CalendarEvent, Card, List
from routes.zoom_service import EnhancedZoomService
import json
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import redirect  # подсвечивается жёлтым


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
# Добавьте этот эндпоинт в calendar_routes.py

# Исправленный эндпоинт users для calendar_routes.py

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
        logger.error(f"Error getting events: {str(e)}")
        return jsonify({"error": "Failed to get events"}), 500

# Create a personal task
@calendar_bp.route('/task', methods=['POST'])
@login_required
def create_task():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['title', 'start']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        # Create personal task
        task, error = EnhancedZoomService.create_personal_task(data, current_user.id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(task)
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        return jsonify({"error": f"Failed to create task: {str(e)}"}), 500

# Create a Zoom meeting
@calendar_bp.route('/meeting', methods=['POST'])
@login_required
def create_meeting():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['topic', 'start_time', 'duration']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
            
        # Get participant IDs if provided
        participant_ids = data.get('participants', [])
        
        # Create the Zoom meeting
        result, error = EnhancedZoomService.create_meeting(data, current_user.id, participant_ids)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error creating meeting: {str(e)}")
        return jsonify({"error": f"Failed to create meeting: {str(e)}"}), 500

# Add participants to a meeting
@calendar_bp.route('/meeting/<event_id>/participants', methods=['POST'])
@login_required
def add_participants(event_id):
    try:
        data = request.json
        if not data or 'participant_ids' not in data:
            return jsonify({"error": "No participant IDs provided"}), 400
            
        # Check if user is admin or event creator
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Event not found"}), 404
            
        if event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        # Add participants
        success, error = EnhancedZoomService.add_participants_to_meeting(event_id, data['participant_ids'])
        if not success:
            return jsonify({"error": error}), 500
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error adding participants: {str(e)}")
        return jsonify({"error": f"Failed to add participants: {str(e)}"}), 500

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
        logger.error(f"Error getting host URL: {str(e)}")
        return jsonify({"error": f"Failed to get host URL: {str(e)}"}), 500
    
# Get recordings for a meeting
@calendar_bp.route('/meeting/<meeting_id>/recordings', methods=['GET'])
@login_required
def get_meeting_recordings(meeting_id):
    try:
        recordings, error = EnhancedZoomService.get_meeting_recordings(meeting_id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(recordings)
    except Exception as e:
        logger.error(f"Error getting recordings: {str(e)}")
        return jsonify({"error": f"Failed to get recordings: {str(e)}"}), 500

# Get all recordings (admin only)
@calendar_bp.route('/recordings', methods=['GET'])
@login_required
@admin_required
def get_all_recordings():
    try:
        from_date = request.args.get('from')
        to_date = request.args.get('to')
        
        recordings, error = EnhancedZoomService.get_all_recordings(from_date, to_date)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(recordings)
    except Exception as e:
        logger.error(f"Error getting all recordings: {str(e)}")
        return jsonify({"error": f"Failed to get recordings: {str(e)}"}), 500

# Recordings archive page
@calendar_bp.route('/recordings-archive')
@login_required
def recordings_archive():
    return render_template('calendar_zoom/recordings.html')

# Update an event
@calendar_bp.route('/event/<event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Update the event
        result, error = EnhancedZoomService.update_event(event_id, data, current_user.id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error updating event: {str(e)}")
        return jsonify({"error": f"Failed to update event: {str(e)}"}), 500

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
        logger.error(f"Error deleting event: {str(e)}")
        return jsonify({"error": f"Failed to delete event: {str(e)}"}), 500

# Get participant information for a meeting
@calendar_bp.route('/meeting/<event_id>/participants', methods=['GET'])
@login_required
def get_meeting_participants(event_id):
    try:
        # Check if user has access to the meeting
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Event not found"}), 404
            
        # Check if user is participant, creator, or admin
        if current_user.id not in [p.id for p in event.participants] and \
           event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        participants, error = EnhancedZoomService.get_meeting_participants(event_id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(participants)
    except Exception as e:
        logger.error(f"Error getting participants: {str(e)}")
        return jsonify({"error": f"Failed to get participants: {str(e)}"}), 500

# Remove participant from a meeting
@calendar_bp.route('/meeting/<event_id>/participants/<user_id>', methods=['DELETE'])
@login_required
def remove_participant(event_id, user_id):
    try:
        # Check if user is admin or event creator
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Event not found"}), 404
            
        if event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        # Remove participant
        success, error = EnhancedZoomService.remove_participant_from_meeting(event_id, user_id)
        if not success:
            return jsonify({"error": error}), 500
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error removing participant: {str(e)}")
        return jsonify({"error": f"Failed to remove participant: {str(e)}"}), 500

# Get meeting join URL
@calendar_bp.route('/meeting/<event_id>/join-url', methods=['GET'])
@login_required
def get_join_url(event_id):
    try:
        # Check if user has access to the meeting
        event = CalendarEvent.query.get(event_id)
        if not event:
            return jsonify({"error": "Event not found"}), 404
            
        # Check if user is participant, creator, or admin
        if current_user.id not in [p.id for p in event.participants] and \
           event.creator_id != current_user.id and not current_user.is_admin:
            return jsonify({"error": "Недостаточно прав"}), 403
            
        join_url, error = EnhancedZoomService.generate_join_url(event_id, current_user.id)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify({"join_url": join_url})
    except Exception as e:
        logger.error(f"Error getting join URL: {str(e)}")
        return jsonify({"error": f"Failed to get join URL: {str(e)}"}), 500

# Исправленный эндпоинт available-users для calendar_routes.py

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
            # Поскольку в вашей модели нет department_id, мы просто получаем всех активных пользователей
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
        return jsonify({"error": f"Ошибка получения доступных пользователей: {str(e)}"}), 500# Generate meeting report
@calendar_bp.route('/meeting/<event_id>/report', methods=['GET'])
@login_required
@admin_required
def generate_meeting_report(event_id):
    try:
        report_format = request.args.get('format', 'json')
        
        # Generate report data
        report_data, error = EnhancedZoomService.generate_meeting_report(event_id)
        if error:
            return jsonify({"error": error}), 500
            
        # Format response based on requested format
        if report_format == 'csv':
            import csv
            from io import StringIO
            
            output = StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Participant', 'Email', 'Join Time', 'Leave Time', 'Duration (minutes)'])
            
            # Write data
            for participant in report_data['participants']:
                writer.writerow([
                    participant['name'],
                    participant['email'],
                    participant['join_time'],
                    participant['leave_time'],
                    participant['duration_minutes']
                ])
                
            # Prepare response
            from flask import Response
            response = Response(output.getvalue(), mimetype='text/csv')
            response.headers["Content-Disposition"] = f"attachment; filename=meeting_report_{event_id}.csv"
            return response
        else:
            # Default to JSON format
            return jsonify(report_data)
    except Exception as e:
        logger.error(f"Error generating meeting report: {str(e)}")
        return jsonify({"error": f"Failed to generate meeting report: {str(e)}"}), 500

# Manage recurring meetings
@calendar_bp.route('/recurring-meeting', methods=['POST'])
@login_required
def create_recurring_meeting():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['topic', 'start_time', 'duration', 'recurrence_type']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
            
        # Get participant IDs if provided
        participant_ids = data.get('participants', [])
        
        # Create the recurring Zoom meeting
        result, error = EnhancedZoomService.create_recurring_meeting(data, current_user.id, participant_ids)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error creating recurring meeting: {str(e)}")
        return jsonify({"error": f"Failed to create recurring meeting: {str(e)}"}), 500

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
        logger.error(f"Error getting calendar settings: {str(e)}")
        return jsonify({"error": f"Failed to get calendar settings: {str(e)}"}), 500

# Update calendar settings
@calendar_bp.route('/settings', methods=['PUT'])
@login_required
def update_calendar_settings():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Update user time zone if provided
        if 'time_zone' in data:
            current_user.time_zone = data['time_zone']
            db.session.commit()
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error updating calendar settings: {str(e)}")
        return jsonify({"error": f"Failed to update calendar settings: {str(e)}"}), 500
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
            return jsonify({"error": "Board not found for this card"}), 404

        # Redirect to the kanban board with card ID parameter
        return redirect(f"/kanban/board/{board_id}?card={card_id}")
    except Exception as e:
        logger.error(f"Error viewing card: {str(e)}")
        return jsonify({"error": f"Failed to view card: {str(e)}"}), 500

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
        logger.error(f"Error completing card: {str(e)}")
        db.session.rollback()
        return jsonify({"error": f"Failed to complete card: {str(e)}"}), 500
    

@calendar_bp.route('/goto-card/<card_id>')
@login_required
def goto_card(card_id):
    try:
        # Find the card
        card = Card.query.get_or_404(card_id)
        
        # Find the list and board
        list_id = card.list_id
        list_obj = List.query.get(list_id)
        
        if not list_obj:
            # If list not found, redirect to kanban home
            return redirect('/kanban')
            
        board_id = list_obj.board_id
        
        # Redirect to the board view with the card highlighted
        return redirect(f"/kanban/board/{board_id}?highlight_card={card_id}")
    except Exception as e:
        logger.error(f"Error navigating to card: {str(e)}")
        # Redirect to kanban home in case of error
        return redirect('/kanban')