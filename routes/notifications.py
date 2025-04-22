from flask import Blueprint, jsonify, render_template, request, redirect, url_for, current_app
from flask_login import login_required, current_user
from .models import db, Notification, User, Lobby

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/')
@login_required
def notifications_page():
    """Full notifications page view"""
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).all()

    # Mark all as read when viewing full page
    for notification in notifications:
        notification.read = True
    db.session.commit()

    return render_template('navbar/notifications.html', notifications=notifications)

@notifications_bp.route('/get_unread_count')
@login_required
def get_unread_count():
    """Get count of unread notifications - used by navbar"""
    count = Notification.query.filter_by(
        user_id=current_user.id,
        read=False
    ).count()

    return jsonify({'count': count})

@notifications_bp.route('/get_recent')
@login_required
def get_recent():
    """Get recent notifications for dropdown"""
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(5).all()

    return jsonify({
        'notifications': [n.to_dict() for n in notifications],
        'unread_count': Notification.query.filter_by(
            user_id=current_user.id,
            read=False
        ).count()
    })

@notifications_bp.route('/mark_as_read/<int:notification_id>', methods=['POST'])
@login_required
def mark_as_read(notification_id):
    """Mark a single notification as read"""
    notification = Notification.query.get_or_404(notification_id)

    if notification.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    notification.read = True
    db.session.commit()

    return jsonify({'success': True})

@notifications_bp.route('/mark_all_as_read', methods=['POST'])
@login_required
def mark_all_as_read():
    """Mark all notifications as read"""
    Notification.query.filter_by(
        user_id=current_user.id,
        read=False
    ).update({Notification.read: True})

    db.session.commit()

    return jsonify({'success': True})

# Helper function to add new notification
def add_notification(user_id, message, category='info', link=None):
    """Add a new notification for a user"""
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=link
    )
    db.session.add(notification)
    db.session.commit()
    return notification

def notify_user(user_id, message, category='info', link=None):
    """
    Helper function to add a notification for a user

    Args:
        user_id: ID of the user to notify
        message: Notification message text
        category: One of 'info', 'success', 'warning', 'danger'
        link: Optional URL to link to from notification
    """
    from .models import db, Notification

    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=link
    )
    
    db.session.add(notification)
    db.session.commit()

def create_message_notification(recipient_id, sender_id, lobby_id, message_text):
    """
    Создает уведомление о новом сообщении
    """
    sender = User.query.get(sender_id)
    lobby = Lobby.query.get(lobby_id)
    
    if not sender or not lobby:
        return
    
    # Текст уведомления зависит от типа лобби
    if lobby.is_group:
        notification_text = f"{sender.username} sent a message in {lobby.name}"
    else:
        notification_text = f"New message from {sender.username}"
    
    # Добавляем краткий текст сообщения
    if message_text:
        if len(message_text) > 30:
            message_text = message_text[:27] + "..."
        notification_text += f": {message_text}"
    
    # Ссылка на чат
    link = f"/chat?lobby_id={lobby_id}"
    
    # Создаем уведомление
    notification = Notification(
        user_id=recipient_id,
        message=notification_text,
        link=link,
        category='info'
    )
    
    db.session.add(notification)
    db.session.commit()