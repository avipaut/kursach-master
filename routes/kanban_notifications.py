# Этот файл можно сохранить как routes/kanban_notifications.py

from flask import url_for
from routes.models import db, User, Notification, Board, List, Card

def notify_card_assignment(user_id, card, board, is_assigned=True):
    """
    Отправляет уведомление о назначении или снятии пользователя с карточки
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        is_assigned: True если пользователь назначается, False если снимается
    """
    if is_assigned:
        message = f"Вы назначены ответственным за карточку '{card.title}' в доске '{board.name}'"
        category = 'info'
    else:
        message = f"Вы были сняты с карточки '{card.title}' в доске '{board.name}'"
        category = 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass  # Socket.io не доступен или не используется

def notify_deadline_change(user_id, card, board, deadline=None, removed=False):
    """
    Отправляет уведомление об изменении срока выполнения карточки
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        deadline: Новый срок (datetime)
        removed: True если срок был удален
    """
    if removed:
        message = f"Крайний срок для карточки '{card.title}' в доске '{board.name}' был удален"
        category = 'info'
    else:
        deadline_formatted = deadline.strftime('%d.%m.%Y %H:%M')
        message = f"Установлен новый срок ({deadline_formatted}) для карточки '{card.title}' в доске '{board.name}'"
        category = 'warning'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_priority_change(user_id, card, board, new_priority):
    """
    Отправляет уведомление об изменении приоритета карточки
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        new_priority: Новый приоритет карточки ('low', 'medium', 'high')
    """
    priority_text = {
        'low': 'низкий',
        'medium': 'средний',
        'high': 'высокий'
    }.get(new_priority, new_priority)
    
    message = f"Установлен {priority_text} приоритет для карточки '{card.title}' в доске '{board.name}'"
    category = 'warning' if new_priority == 'high' else 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_card_move(user_id, card, board, source_list, target_list):
    """
    Отправляет уведомление о перемещении карточки между списками
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        source_list: Исходный список
        target_list: Целевой список
    """
    message = f"Карточка '{card.title}' перемещена из '{source_list.name}' в '{target_list.name}' в доске '{board.name}'"
    category = 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_task_added(user_id, card, board, todo_content):
    """
    Отправляет уведомление о добавлении новой задачи в карточку
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        todo_content: Содержание задачи
    """
    
    # Сокращаем содержание задачи, если оно слишком длинное
    short_content = todo_content
    if len(short_content) > 40:
        short_content = short_content[:37] + '...'
    
    message = f"Добавлена новая задача '{short_content}' в карточку '{card.title}' в доске '{board.name}'"
    category = 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_task_updated(user_id, card, board, todo, completion_changed=False, content_changed=False):
    """
    Отправляет уведомление об обновлении задачи в карточке
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        todo: Объект задачи
        completion_changed: Изменился ли статус выполнения
        content_changed: Изменилось ли содержание
    """
    # Сокращаем содержание задачи, если оно слишком длинное
    short_content = todo.content
    if len(short_content) > 40:
        short_content = short_content[:37] + '...'
    
    if completion_changed:
        status_text = "выполнена" if todo.completed else "возобновлена"
        message = f"Задача '{short_content}' в карточке '{card.title}' была {status_text}"
        category = 'success' if todo.completed else 'info'
    elif content_changed:
        message = f"Задача '{short_content}' в карточке '{card.title}' была обновлена"
        category = 'info'
    else:
        message = f"Задача в карточке '{card.title}' была обновлена"
        category = 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_task_deleted(user_id, card, board, todo_content):
    """
    Отправляет уведомление об удалении задачи из карточки
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        todo_content: Содержание удаленной задачи
    """
    # Сокращаем содержание задачи, если оно слишком длинное
    short_content = todo_content
    if len(short_content) > 40:
        short_content = short_content[:37] + '...'
    
    message = f"Задача '{short_content}' была удалена из карточки '{card.title}' в доске '{board.name}'"
    category = 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_card_completion(user_id, card, board, is_completed):
    """
    Отправляет уведомление о изменении статуса завершения карточки
    
    Args:
        user_id: ID пользователя для уведомления
        card: Объект карточки
        board: Объект доски
        is_completed: True если карточка помечена как выполненная, False если открыта
    """
    if is_completed:
        message = f"Карточка '{card.title}' в доске '{board.name}' была помечена как завершенная"
        category = 'success'
    else:
        message = f"Карточка '{card.title}' в доске '{board.name}' была снова открыта"
        category = 'warning'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass

def notify_add_to_board(user_id, board):
    """
    Отправляет уведомление пользователю о добавлении его к доске
    
    Args:
        user_id: ID пользователя для уведомления
        board: Объект доски
    """
    message = f"Вы были добавлены к доске '{board.name}'"
    category = 'info'
    
    notification = Notification(
        user_id=user_id,
        message=message,
        category=category,
        link=f"/kanban?board_id={board.id}"
    )
    
    db.session.add(notification)
    db.session.commit()
    
    # Если подключен WebSocket, отправляем уведомление
    try:
        from app import socketio
        socketio.emit('new_notification', {
            'user_id': user_id,
            'count': Notification.query.filter_by(user_id=user_id, read=False).count()
        }, namespace='/notifications')
    except ImportError:
        pass