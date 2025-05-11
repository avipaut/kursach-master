# kanban.py

from datetime import datetime
from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from routes.models import PriorityLevel, User, db, Board, List, Card, Todo  # Make sure this import works with your project structure
from functools import wraps
from sqlalchemy import case
from routes.notifications import notify_user  # Добавить этот импорт в начало файла

kanban_bp = Blueprint('kanban', __name__)

# ===== PERMISSION DECORATORS =====

def admin_required(f):
    """Decorator to restrict access to admin users only"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
            # Return 403 Forbidden for API endpoints
            if request.path.startswith('/api/') or request.is_json:
                return jsonify({"error": "Administrator privileges required"}), 403
            # Flash a message and redirect for regular routes
            flash('This action requires administrator privileges.', 'error')
            return redirect(url_for('kanban.kanban_board'))
        return f(*args, **kwargs)
    return decorated_function

# ===== BOARD ROUTES =====
# Убедитесь, что маршрут определен именно так
@kanban_bp.route('/', endpoint='kanban_board')
@login_required
def kanban_board():
    is_admin = False
    if hasattr(current_user, 'is_admin'):
        is_admin = current_user.is_admin
    return render_template('kanban/kanban.html', username=current_user.username, is_admin=is_admin)
@kanban_bp.route('kanban/api/current_user', methods=['GET'])
@login_required
def get_current_user():
    is_admin = False
    if hasattr(current_user, 'is_admin'):
        is_admin = current_user.is_admin
    return jsonify({
        "username": current_user.username,
        "is_admin": is_admin
    })

@kanban_bp.route('/boards', methods=['GET'])
@login_required
def get_boards():
    # Check if is_admin attribute exists
    is_admin = False
    if hasattr(current_user, 'is_admin'):
        is_admin = current_user.is_admin
        
    # Admins see all boards
    if is_admin:
        boards = Board.query.all()
    else:
        # Non-admins see only their own boards and boards they've been given access to
        boards = Board.query.filter(
            (Board.user_id == current_user.id) |  # Boards created by the user
            (Board.users.contains(current_user))   # Boards the user has been added to
        ).all()
    
    return jsonify([board.to_dict() for board in boards])
@kanban_bp.route('/boards/<int:board_id>', methods=['GET'])
@login_required
def get_board(board_id):
    is_admin = getattr(current_user, 'is_admin', False)

    # Получаем доску по ID
    board = Board.query.get_or_404(board_id)

    # Проверка доступа: если не админ — можно только свои или с доступом
    if not is_admin:
        if board.user_id != current_user.id and current_user not in board.users:
            return jsonify({"error": "Access denied"}), 403

    return jsonify(board.to_dict())

# функция создания доски 
@kanban_bp.route('/boards', methods=['POST'])
@login_required
@admin_required  # Only admins can create boards
def create_board():
    data = request.get_json()
    
    # Create the board
    board_kwargs = {
        'name': data.get('name'),
        'user_id': current_user.id,
        'admin_only': data.get('admin_only', False)  # Default to public board
    }
    
    new_board = Board(**board_kwargs)
    
    # Add the creator to the board's users
    new_board.users.append(current_user)
    
    # Add any additional users specified in the request
    added_users = []
    if data.get('user_ids'):
        for user_id in data.get('user_ids'):
            # Пропускаем создателя доски
            if user_id == current_user.id:
                continue
                
            user = User.query.get(user_id)
            if user:
                new_board.users.append(user)
                added_users.append(user_id)
    
    db.session.add(new_board)
    db.session.commit()
    
    # Отправляем уведомления добавленным пользователям
    for user_id in added_users:
        notify_user(
            user_id=user_id,
            message=f"Вы были добавлены к новой доске '{new_board.name}'",
            category='info',
            link=f"/kanban?board_id={new_board.id}"
        )
    
    return jsonify(new_board.to_dict()), 201

# Обновите функцию обновления доски для отправки уведомлений
@kanban_bp.route('/boards/<int:board_id>', methods=['PUT'])
@login_required
def update_board(board_id):
    board_obj = Board.query.get(board_id)
    if not board_obj:
        return jsonify({"error": "Board not found"}), 404
    
    # Only board creator or admin can update the board
    if board_obj.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"error": "Permission denied"}), 403
    
    data = request.json
    
    # Сохраняем старое название доски для сравнения
    old_name = board_obj.name
    name_changed = False
    
    # Сохраняем текущих пользователей для отслеживания изменений
    current_users = set(user.id for user in board_obj.users)
    
    # Update basic board info
    if 'name' in data:
        name_changed = old_name != data['name']
        board_obj.name = data['name']
    
    if 'admin_only' in data and current_user.is_admin:
        board_obj.admin_only = data['admin_only']
    
    # Update board users
    if 'user_ids' in data:
        new_user_ids = set(data['user_ids'])
        
        # Сохраняем создателя доски
        creator_id = board_obj.user_id
        if creator_id not in new_user_ids:
            new_user_ids.add(creator_id)
        
        # Находим пользователей, которые будут добавлены
        users_to_add = new_user_ids - current_users
        
        # Находим пользователей, которые будут удалены
        users_to_remove = current_users - new_user_ids
        
        # Обновляем список пользователей доски
        board_obj.users = []
        
        # Добавляем всех указанных пользователей
        for user_id in new_user_ids:
            user = User.query.get(user_id)
            if user:
                board_obj.users.append(user)
        
        # Уведомляем новых пользователей
        for user_id in users_to_add:
            notify_user(
                user_id=user_id,
                message=f"Вы были добавлены к доске '{board_obj.name}'",
                category='info',
                link=f"/kanban?board_id={board_id}"
            )
        
        # Уведомляем удаленных пользователей
        for user_id in users_to_remove:
            notify_user(
                user_id=user_id,
                message=f"Вы были удалены из доски '{board_obj.name}'",
                category='warning',
                link="/kanban"  # Ссылка на общий список досок
            )
    
    db.session.commit()
    
    # Если название доски изменилось, уведомляем всех участников
    if name_changed:
        for user in board_obj.users:
            # Не отправляем уведомление пользователю, который сделал изменение
            if user.id != current_user.id:
                notify_user(
                    user_id=user.id,
                    message=f"Название доски изменено на '{board_obj.name}'",
                    category='info',
                    link=f"/kanban?board_id={board_id}"
                )
    
    return jsonify(board_obj.to_dict())
@kanban_bp.route('/boards/<int:board_id>/users', methods=['POST'])
@login_required
def add_board_user(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Only board creator or admin can add users
    if board.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"error": "Permission denied"}), 403
    
    data = request.json
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Check if user is already added to the board
    if user in board.users:
        return jsonify({"message": "User already has access to this board"}), 200
    
    # Add user to the board
    board.users.append(user)
    db.session.commit()
    
    # Отправляем уведомление пользователю о добавлении его к доске
    notify_user(
        user_id=user_id,
        message=f"Вы были добавлены к доске '{board.name}'",
        category='info',
        link=f"/kanban?board_id={board_id}"
    )
    
    return jsonify({"message": "User added to board successfully"}), 200

# Обновите функцию remove_board_user для отправки уведомлений
@kanban_bp.route('/boards/<int:board_id>/users/<int:user_id>', methods=['DELETE'])
@login_required
def remove_board_user(board_id, user_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Only board creator or admin can remove users
    if board.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"error": "Permission denied"}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Prevent removing the board creator
    if user.id == board.user_id:
        return jsonify({"error": "Cannot remove board creator"}), 400
    
    # Remove user from the board
    if user in board.users:
        board.users.remove(user)
        db.session.commit()
        
        # Отправляем уведомление пользователю об удалении его из доски
        notify_user(
            user_id=user_id,
            message=f"Вы были удалены из доски '{board.name}'",
            category='warning',
            link="/kanban"  # Ссылка на общий список досок
        )
        
        return jsonify({"message": "User removed from board successfully"}), 200
    else:
        return jsonify({"error": "User does not have access to this board"}), 404

@kanban_bp.route('/boards/<int:board_id>/users', methods=['GET'])
@login_required
def get_board_users(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Only users with access to the board can see its users
    if current_user not in board.users and not current_user.is_admin:
        return jsonify({"error": "Permission denied"}), 403
    
    return jsonify([user.to_dict() for user in board.users]), 200
@kanban_bp.route('/boards/<int:board_id>', methods=['DELETE'])
@login_required
@admin_required  # Only admins can delete boards
def delete_board(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    db.session.delete(board)
    db.session.commit()
    return '', 204

# ===== LIST ROUTES =====

@kanban_bp.route('/boards/<int:board_id>/lists', methods=['GET'])
@login_required
def get_lists(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Check if user has access to this board
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    has_admin_only = hasattr(board, 'admin_only') and board.admin_only
    
    if has_admin_only and not is_admin:
        return jsonify({"error": "You don't have permission to view this board's lists"}), 403
    
    # Получаем списки, сортируя их по полю position
    lists = List.query.filter_by(board_id=board_id).order_by(List.position).all()
    
    # Формируем ответ с учетом новых полей color и text_color
    result = []
    for l in lists:
        list_data = {
            "id": l.id, 
            "name": l.name, 
            "position": getattr(l, 'position', 0)
        }
        
        # Добавляем цвета, если они есть
        if hasattr(l, 'color') and l.color:
            list_data["color"] = l.color
        
        if hasattr(l, 'text_color') and l.text_color:
            list_data["textColor"] = l.text_color
        
        result.append(list_data)
    
    return jsonify(result)

@kanban_bp.route('/boards/<int:board_id>/lists', methods=['POST'])
@login_required
@admin_required  # Only admins can create lists
def create_list(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    data = request.json
    
    # Получаем максимальную текущую позицию списков в этой доске
    max_position = db.session.query(db.func.max(List.position)).filter(List.board_id == board_id).scalar()
    if max_position is None:
        max_position = -1  # Если списков еще нет
    
    # Создаем новый список с позицией в конце
    new_list = List(
        name=data['name'], 
        board_id=board_id,
        position=max_position + 1
    )
    
    db.session.add(new_list)
    db.session.commit()
    
    return jsonify({
        "id": new_list.id, 
        "name": new_list.name, 
        "position": new_list.position
    }), 201

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>', methods=['PUT'])
@login_required
@admin_required  # Only admins can update lists
def update_list(board_id, list_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    data = request.json
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({"error": "Field 'name' is required for update"}), 400

    list_obj.name = data['name']
    db.session.commit()

    return jsonify({"id": list_obj.id, "name": list_obj.name})

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>', methods=['DELETE'])
@login_required
@admin_required  # Only admins can delete lists
def delete_list(board_id, list_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    db.session.delete(list_obj)
    db.session.commit()
    return '', 204

# ===== CARD ROUTES =====

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards', methods=['GET'])
@login_required
def get_cards(board_id, list_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Check if user has access to this board
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    has_admin_only = hasattr(board, 'admin_only') and board.admin_only
    
    if has_admin_only and not is_admin:
        return jsonify({"error": "You don't have permission to view this board's cards"}), 403

    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Получаем карточки с сортировкой по позиции (если поле существует)
    if hasattr(Card, 'position'):
        cards = Card.query.filter_by(list_id=list_id).order_by(Card.position).all()
    else:
        cards = Card.query.filter_by(list_id=list_id).all()
        
    return jsonify([card.to_dict() for card in cards])

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>', methods=['GET'])
@login_required
def get_single_card(board_id, list_id, card_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Check if user has access to this board
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    has_admin_only = hasattr(board, 'admin_only') and board.admin_only
    
    if has_admin_only and not is_admin:
        return jsonify({"error": "You don't have permission to view this card"}), 403
    
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404
    
    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found"}), 404

    return jsonify(card.to_dict())

# Изменения для функции создания карточки (create_card)
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards', methods=['POST'])
@login_required
@admin_required  # Only admins can create cards
def create_card(board_id, list_id):
    data = request.json
    
    # Получаем максимальную текущую позицию карточек в этом списке
    max_position = db.session.query(db.func.max(Card.position)).filter(Card.list_id == list_id).scalar()
    if max_position is None:
        max_position = -1  # Если карточек еще нет
    
    new_card = Card(
        title=data['title'],
        description=data.get('description', ''),
        list_id=list_id,
        user_id=current_user.id,
        priority=PriorityLevel(data.get('priority', 'low')),
        position=max_position + 1  # Устанавливаем позицию в конце списка
    )
    
    # Если карточка сразу назначается на пользователя, получаем его
    assigned_to = data.get('assigned_to')
    if assigned_to:
        user = User.query.get(assigned_to)
        if user:
            new_card.assigned_to = assigned_to
            
            # Если карточка назначается пользователю при создании, отправляем уведомление
            board = Board.query.get(board_id)
            if board and assigned_to != current_user.id:
                notify_user(
                    user_id=assigned_to,
                    message=f"Вам назначена новая карточка '{data['title']}' в доске '{board.name}'",
                    category='info',
                    link=f"/kanban?board_id={board_id}"
                )
    
    db.session.add(new_card)
    db.session.commit()
    return jsonify(new_card.to_dict()), 201
# Обновите функцию обновления карточки, чтобы назначенные пользователи получали уведомления
@kanban_bp.route('/kanban/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>', methods=['PUT'])
@login_required
@admin_required  # Only admins can update card details
def update_card(board_id, list_id, card_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

    data = request.json
    
    # Сохраняем старые значения для сравнения
    old_title = card.title
    old_description = card.description
    
    # Обновляем карточку
    card.title = data.get('title', card.title)
    card.description = data.get('description', card.description)
    
    # Проверяем, изменилось ли название или описание
    title_changed = old_title != card.title
    description_changed = old_description != card.description
    
    db.session.commit()
    
    # Если карточка назначена пользователю и не текущему пользователю,
    # отправляем уведомление об изменениях
    if card.assigned_to and card.assigned_to != current_user.id and (title_changed or description_changed):
        change_type = []
        if title_changed:
            change_type.append("название")
        if description_changed:
            change_type.append("описание")
        
        changes = " и ".join(change_type)
        
        notify_user(
            user_id=card.assigned_to,
            message=f"Изменено {changes} карточки '{card.title}' в доске '{board.name}'",
            category='info',
            link=f"/kanban?board_id={board_id}"
        )
    
    return jsonify({"id": card.id, "title": card.title, "description": card.description})
@kanban_bp.route('/kanban/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>', methods=['DELETE'])
@login_required
@admin_required  # Only admins can delete cards
def delete_card(board_id, list_id, card_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

    db.session.delete(card)
    db.session.commit()
    notify_user(
            user_id=card.assigned_to,
            message=f"Удалена карточка '{card.title}' в доске '{board.name}'",
            category='info',
            link=f"/kanban?board_id={board_id}"
        )
    return '', 204

# ===== USER ROUTES =====

@kanban_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

# ===== CARD STATUS ROUTES =====

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/toggle-completion', methods=['PUT'])
@login_required
def toggle_card_completion(board_id, list_id, card_id):
    # Any user can toggle card completion status
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404
    
    # Get the completion status from the request
    data = request.json
    old_completed = card.completed
    
    if 'completed' in data:
        card.completed = data['completed']
    else:
        # Toggle if not specified
        card.completed = not card.completed
    
    # Only send notification if status actually changed
    status_changed = old_completed != card.completed
    
    db.session.commit()
    
    # Получаем информацию о доске для ссылки в уведомлении
    board = Board.query.get(board_id)
    
    # Отправляем уведомление создателю карточки, если карточка помечена как выполненная
    if status_changed and card.completed and card.user_id != current_user.id:
        if board:
            notify_user(
                user_id=card.user_id,
                message=f"Карточка '{card.title}' в доске '{board.name}' была помечена как завершенная",
                category='success',
                link=f"/kanban?board_id={board_id}"
            )
    
    # Если карточка была снова открыта и у неё есть назначенный пользователь
    if status_changed and not card.completed and card.assigned_to and card.assigned_to != current_user.id:
        if board:
            notify_user(
                user_id=card.assigned_to,
                message=f"Карточка '{card.title}' в доске '{board.name}' была снова открыта",
                category='warning',
                link=f"/kanban?board_id={board_id}"
            )
    
    return jsonify({
        'message': 'Card completion status updated',
        'card_id': card.id,
        'completed': card.completed
    })


# Затем обновите функцию назначения пользователя на карточку
@kanban_bp.route('/kanban/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/assign', methods=['PUT'])
@login_required
@admin_required  # Only admins can assign users to cards
def assign_user_to_card(board_id, list_id, card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404
    
    data = request.json
    user_id = data.get('user_id')
    
    # Запоминаем предыдущего назначенного пользователя (для уведомления об отмене назначения)
    previous_assigned_user_id = card.assigned_to
    
    # Check if user exists if an ID was provided
    if user_id:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        card.assigned_to = user_id
        
        # Отправляем уведомление новому назначенному пользователю
        board = Board.query.get(board_id)
        if board:
            notify_user(
                user_id=user_id,
                message=f"Вы были назначены ответственным за карточку '{card.title}' в доске '{board.name}'",
                category='info',
                link=f"/kanban?board_id={board_id}"
            )
    else:
        card.assigned_to = None  # Unassign
        
        # Если пользователь был снят, отправляем ему уведомление
        if previous_assigned_user_id:
            board = Board.query.get(board_id)
            if board:
                notify_user(
                    user_id=previous_assigned_user_id,
                    message=f"Вы были сняты с карточки '{card.title}' в доске '{board.name}'",
                    category='info',
                    link=f"/kanban?board_id={board_id}"
                )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Card assignment updated',
        'card_id': card.id,
        'assigned_to': card.assigned_to,
        'assigned_to_name': card.assigned_user.username if card.assigned_user else None
    })
# Обновите функцию установки крайнего срока
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/deadline', methods=['PUT'])
@login_required
@admin_required  # Only admins can set deadlines
def set_card_deadline(board_id, list_id, card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404
    
    data = request.json
    deadline_str = data.get('deadline')
    
    try:
        if deadline_str:
            new_deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            
            # Проверяем, изменился ли крайний срок
            deadline_changed = card.deadline != new_deadline
            card.deadline = new_deadline
            
            # Отправляем уведомления пользователю, назначенному на карточку
            if deadline_changed and card.assigned_to:
                board = Board.query.get(board_id)
                if board:
                    deadline_formatted = new_deadline.strftime('%d.%m.%Y %H:%M')
                    notify_user(
                        user_id=card.assigned_to,
                        message=f"Установлен новый срок ({deadline_formatted}) для карточки '{card.title}' в доске '{board.name}'",
                        category='warning',
                        link=f"/kanban?board_id={board_id}"
                    )
        else:
            # Если крайний срок был удален
            if card.deadline and card.assigned_to:
                board = Board.query.get(board_id)
                if board:
                    notify_user(
                        user_id=card.assigned_to,
                        message=f"Крайний срок для карточки '{card.title}' в доске '{board.name}' был удален",
                        category='info',
                        link=f"/kanban?board_id={board_id}"
                    )
            card.deadline = None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Card deadline updated',
            'card_id': card.id,
            'deadline': card.deadline.isoformat() if card.deadline else None
        })
    except ValueError as e:
        return jsonify({"error": f"Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS): {str(e)}"}), 400

# Обновите функцию изменения приоритета карточки
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/priority', methods=['PUT'])
@login_required
@admin_required  # Only admins can update card priority
def update_card_priority(board_id, list_id, card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404
    
    data = request.json
    if 'priority' not in data:
        return jsonify({"error": "Priority is required"}), 400
    
    try:
        old_priority = card.priority.value if card.priority else 'low'
        new_priority = data['priority']
        
        # Проверяем, изменился ли приоритет
        priority_changed = old_priority != new_priority
        
        card.priority = PriorityLevel(new_priority)
        db.session.commit()
        
        # Отправляем уведомление при повышении приоритета
        if priority_changed and card.assigned_to and new_priority in ['medium', 'high'] and old_priority != new_priority:
            # Приоритет был повышен
            board = Board.query.get(board_id)
            if board:
                priority_text = "высокий" if new_priority == 'high' else "средний"
                notify_user(
                    user_id=card.assigned_to,
                    message=f"Установлен {priority_text} приоритет для карточки '{card.title}' в доске '{board.name}'",
                    category='warning' if new_priority == 'high' else 'info',
                    link=f"/kanban?board_id={board_id}"
                )
        
        return jsonify(card.to_dict())
    except ValueError:
        return jsonify({"error": "Invalid priority value"}), 400

# ===== TODO ROUTES =====
# Add this route to your kanban.py file

@kanban_bp.route('/cards/<int:card_id>/todos', methods=['GET'])
@login_required
def get_card_todos(card_id):
    """Get all todos for a specific card"""
    try:
        # Find the card
        card = Card.query.get(card_id)
        if not card:
            return jsonify({'success': False, 'message': 'Card not found'}), 404
            
        # Anyone can view todos, but we'll check if the board is admin-only
        list_obj = List.query.get(card.list_id)
        if not list_obj:
            return jsonify({'success': False, 'message': 'List not found'}), 404
            
        board = Board.query.get(list_obj.board_id)
        if not board:
            return jsonify({'success': False, 'message': 'Board not found'}), 404
            
        # Check if user has access to this board
        is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
        has_admin_only = hasattr(board, 'admin_only') and board.admin_only
        
        if has_admin_only and not is_admin:
            return jsonify({'success': False, 'message': 'You do not have permission to view these todos'}), 403
            
        # Get all todos for this card
        todos = Todo.query.filter_by(card_id=card_id).all()
        
        return jsonify({
            'success': True,
            'todos': [todo.to_dict() for todo in todos]
        })
    except Exception as e:
        print(f"Error getting todos: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500
# Обновляем обработчик создания задач в карточке
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/todos', methods=['POST'])
@login_required
@admin_required  # Only admins can create todos
def create_todo(board_id, list_id, card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404
    
    data = request.json
    content = data.get('content')
    
    if not content or not content.strip():
        return jsonify({"error": "Todo content is required"}), 400
    
    todo = Todo(content=content, card_id=card_id)
    db.session.add(todo)
    db.session.commit()
    
    # Отправляем уведомление о добавлении новой задачи
    if card.assigned_to:
        board = Board.query.get(board_id)
        if board:
            notify_user(
                user_id=card.assigned_to,
                message=f"Добавлена новая задача в карточку '{card.title}' в доске '{board.name}'",
                category='info',
                link=f"/kanban?board_id={board_id}"
            )
    
    return jsonify(todo.to_dict()), 201
# Replace your existing update_todo route with this one

# Изменения к функциям обновления задач в карточке (update_todo)
@kanban_bp.route('/todos/<int:todo_id>', methods=['PUT'])
@login_required
def update_todo(todo_id):
    """Update a todo - regular users can update completion status only"""
    todo = Todo.query.get(todo_id)
    if not todo:
        return jsonify({"success": False, "message": "Todo not found"}), 404
    
    data = request.json
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    
    # Сохраняем старое состояние для отслеживания изменений
    old_completed = todo.completed
    old_content = todo.content
    
    # For content updates, user must be an admin
    if 'content' in data and not is_admin:
        return jsonify({"success": False, "message": "Only administrators can update todo content"}), 403
    
    # For completion status, any user can update
    if 'content' in data and is_admin:
        todo.content = data['content']
        
    if 'completed' in data:
        todo.completed = data['completed']
    
    db.session.commit()
    
    # Проверяем, изменился ли статус завершения
    completion_changed = old_completed != todo.completed
    content_changed = old_content != todo.content
    
    # Если произошли изменения, получаем информацию о карточке и доске для отправки уведомления
    if (completion_changed or content_changed) and todo.card_id:
        card = Card.query.get(todo.card_id)
        if card and card.assigned_to and card.assigned_to != current_user.id:
            # Находим список и доску для формирования ссылки
            list_obj = List.query.get(card.list_id)
            if list_obj:
                board = Board.query.get(list_obj.board_id)
                if board:
                    # Формируем соответствующее уведомление
                    if completion_changed:
                        status_text = "выполнена" if todo.completed else "возобновлена"
                        notify_user(
                            user_id=card.assigned_to,
                            message=f"Задача '{todo.content}' в карточке '{card.title}' была {status_text}",
                            category='success' if todo.completed else 'info',
                            link=f"/kanban?board_id={board.id}"
                        )
                    
                    elif content_changed and current_user.id != card.assigned_to:
                        notify_user(
                            user_id=card.assigned_to,
                            message=f"Задача в карточке '{card.title}' была обновлена",
                            category='info',
                            link=f"/kanban?board_id={board.id}"
                        )
    
    return jsonify({
        "success": True,
        "message": "Todo updated successfully",
        "todo": todo.to_dict()
    })

# Изменения к функции удаления задач (delete_todo)
@kanban_bp.route('/todos/<int:todo_id>', methods=['DELETE'])
@admin_required
@login_required
def delete_todo(todo_id):
    try:
        print(f"Attempting to delete todo with ID: {todo_id}")
        
        todo = Todo.query.get(todo_id)
        if not todo:
            print(f"Todo not found with ID: {todo_id}")
            return jsonify({'success': False, 'message': 'Todo not found'}), 404
            
        # Store card_id before deleting the todo to return in the response
        card_id = todo.card_id
        todo_content = todo.content
        
        # Получаем информацию о карточке для отправки уведомления
        card = Card.query.get(card_id)
        
        # Delete the todo
        db.session.delete(todo)
        db.session.commit()
        
        # Отправляем уведомление, если у карточки есть назначенный пользователь
        if card and card.assigned_to and card.assigned_to != current_user.id:
            # Находим список и доску для формирования ссылки
            list_obj = List.query.get(card.list_id)
            if list_obj:
                board = Board.query.get(list_obj.board_id)
                if board:
                    notify_user(
                        user_id=card.assigned_to,
                        message=f"Задача '{todo_content}' была удалена из карточки '{card.title}'",
                        category='info',
                        link=f"/kanban?board_id={board.id}"
                    )
        
        print(f"Todo deleted successfully: {todo_id}")
        # Ensure we're returning a proper JSON response
        return jsonify({
            'success': True, 
            'message': 'Todo deleted successfully',
            'todo_id': todo_id,
            'card_id': card_id
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting todo: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ===== CARD MOVEMENT ROUTES =====

# Обновите функцию перемещения карточки между списками
@kanban_bp.route('/boards/<int:board_id>/lists/<int:source_list_id>/cards/<int:card_id>/move/<int:target_list_id>', methods=['PUT'])
@login_required
@admin_required  # Only admins can move cards
def move_card(board_id, source_list_id, card_id, target_list_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    source_list = List.query.filter_by(id=source_list_id, board_id=board_id).first()
    if not source_list:
        return jsonify({"error": "Source list not found or does not belong to the specified board"}), 404

    target_list = List.query.filter_by(id=target_list_id, board_id=board_id).first()
    if not target_list:
        return jsonify({"error": "Target list not found or does not belong to the specified board"}), 404

    card = Card.query.filter_by(id=card_id, list_id=source_list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the source list"}), 404

    card.list_id = target_list_id
    db.session.commit()
    
    # Отправляем уведомление о перемещении карточки
    if card.assigned_to:
        notify_user(
            user_id=card.assigned_to,
            message=f"Карточка '{card.title}' перемещена из '{source_list.name}' в '{target_list.name}' в доске '{board.name}'",
            category='info',
            link=f"/kanban?board_id={board_id}"
        )

    return jsonify({"id": card.id, "title": card.title, "description": card.description, "list_id": card.list_id}), 200

@kanban_bp.route('/boards/<int:board_id>/lists/reorder', methods=['PUT'])
@login_required
@admin_required  # Только администраторы могут изменять порядок списков
def reorder_lists(board_id):
    """Изменение порядка списков на доске"""
    
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Получаем данные из запроса
    data = request.json
    if not data or 'list_ids' not in data:
        return jsonify({"error": "Missing list_ids parameter"}), 400
    
    list_ids = data['list_ids']
    
    try:
        # Проверяем, что все списки существуют и принадлежат этой доске
        lists_to_update = List.query.filter(
            List.id.in_(list_ids), 
            List.board_id == board_id
        ).all()
        
        if len(lists_to_update) != len(list_ids):
            return jsonify({"error": "Some lists not found or do not belong to this board"}), 400
        
        # Добавим поле position в таблицу List, если его еще нет
        if not hasattr(List, 'position'):
            from sqlalchemy import Column, Integer
            List.position = Column(Integer, default=0)
            db.create_all()
        
        # Обновляем позиции списков согласно полученному порядку
        for index, list_id in enumerate(list_ids):
            list_obj = next((l for l in lists_to_update if l.id == list_id), None)
            if list_obj:
                list_obj.position = index
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Lists reordered successfully",
            "lists": [list_obj.to_dict() for list_obj in lists_to_update]
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error reordering lists: {str(e)}")
        return jsonify({"error": f"Failed to reorder lists: {str(e)}"}), 500

# Добавьте этот маршрут в файл kanban.py

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/reorder', methods=['PUT'])
@login_required
@admin_required  # Только админы могут изменять порядок карточек
def reorder_cards(board_id, list_id):
    """Изменение порядка карточек внутри списка"""
    
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to this board"}), 404
    
    # Получаем данные из запроса
    data = request.json
    if not data or 'card_ids' not in data:
        return jsonify({"error": "Missing card_ids parameter"}), 400
    
    card_ids = data['card_ids']
    
    try:
        # Проверяем, что все карточки существуют и принадлежат этому списку
        cards_to_update = Card.query.filter(
            Card.id.in_(card_ids), 
            Card.list_id == list_id
        ).all()
        
        if len(cards_to_update) != len(card_ids):
            return jsonify({"error": "Some cards not found or do not belong to this list"}), 400
        
        # Добавим поле position в таблицу Card, если его еще нет
        if not hasattr(Card, 'position'):
            from sqlalchemy import Column, Integer
            Card.position = Column(Integer, default=0)
            db.create_all()
        
        # Обновляем позиции карточек согласно полученному порядку
        for index, card_id in enumerate(card_ids):
            card_obj = next((c for c in cards_to_update if c.id == card_id), None)
            if card_obj:
                card_obj.position = index
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Cards reordered successfully",
            "cards": [card_obj.to_dict() for card_obj in cards_to_update]
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error reordering cards: {str(e)}")
        return jsonify({"error": f"Failed to reorder cards: {str(e)}"}), 500
# Маршрут для установки цвета списка
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/color', methods=['PUT'])
@login_required
@admin_required  # Только администраторы могут изменять цвета списков
def set_list_color(board_id, list_id):
    """Установка цвета для списка"""
    # Проверяем, существуют ли доска и список
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to this board"}), 404
    
    # Получаем данные из запроса
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Извлекаем цвета
    color = data.get('color')
    text_color = data.get('text_color', 'black')
    
    try:
        # Добавляем поля color и text_color в модель List, если их нет
        has_color = hasattr(list_obj, 'color')
        has_text_color = hasattr(list_obj, 'text_color')
        
        if not has_color or not has_text_color:
            from sqlalchemy import Column, String
            if not has_color:
                List.color = Column(String(50), nullable=True)
            if not has_text_color:
                List.text_color = Column(String(50), nullable=True)
            
            # Применяем изменения к схеме БД
            try:
                db.create_all()
            except Exception as e:
                print(f"Warning: Could not automatically create columns: {str(e)}")
                # В случае ошибки создаем временные атрибуты (не сохранятся в БД)
                if not has_color:
                    setattr(List, 'color', None)
                if not has_text_color:
                    setattr(List, 'text_color', None)
        
        # Устанавливаем цвета
        list_obj.color = color
        list_obj.text_color = text_color
        
        # Сохраняем изменения
        db.session.commit()
        
        # Обновляем метод to_dict для включения цветов
        if not hasattr(List, '_original_to_dict'):
            List._original_to_dict = List.to_dict
            
            def new_to_dict(self):
                result = self._original_to_dict()
                result['color'] = getattr(self, 'color', None)
                result['text_color'] = getattr(self, 'text_color', None)
                return result
            
            List.to_dict = new_to_dict
        
        return jsonify({
            "success": True,
            "message": "List color updated successfully",
            "list": list_obj.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error setting list color: {str(e)}")
        return jsonify({"error": f"Failed to set list color: {str(e)}"}), 500
    
# Маршрут для установки цвета карточки
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/color', methods=['PUT'])
@login_required
def set_card_color(board_id, list_id, card_id):
    """Установка цвета для карточки"""
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    # Проверяем существование списка
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to this board"}), 404
    
    # Проверяем существование карточки
    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to this list"}), 404
    
    # Получаем данные из запроса
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    color = data.get('color')  # Может быть None, если цвет сбрасывается
    
    try:
        # Добавляем поле custom_color в модель Card, если его нет
        has_custom_color = hasattr(card, 'custom_color')
        
        if not has_custom_color:
            from sqlalchemy import Column, String
            Card.custom_color = Column(String(50), nullable=True)
            
            # Применяем изменения к схеме БД
            try:
                db.create_all()
            except Exception as e:
                print(f"Warning: Could not automatically create column: {str(e)}")
                # В случае ошибки создаем временный атрибут
                setattr(Card, 'custom_color', None)
        
        # Устанавливаем цвет
        card.custom_color = color
        
        # Сохраняем изменения
        db.session.commit()
        
        # Обновляем метод to_dict для включения цвета
        if not hasattr(Card, '_original_to_dict'):
            Card._original_to_dict = Card.to_dict
            
            def new_to_dict(self):
                result = self._original_to_dict()
                result['custom_color'] = getattr(self, 'custom_color', None)
                return result
            
            Card.to_dict = new_to_dict
        
        return jsonify({
            "success": True,
            "message": "Card color updated successfully",
            "card": card.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error setting card color: {str(e)}")
        return jsonify({"error": f"Failed to set card color: {str(e)}"}), 500

# Additional routes to add to kanban.py

# These endpoints will move more logic to the backend and fix creator display issues

@kanban_bp.route('/api/board/<int:board_id>/full_data', methods=['GET'])
@login_required
def get_full_board_data(board_id):
    """Get complete board data including lists, cards, and creator information in a single request."""
    try:
        # Get the board
        board = Board.query.get(board_id)
        if not board:
            return jsonify({"error": "Board not found"}), 404
        
        # Check if user has access to this board
        is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
        has_admin_only = hasattr(board, 'admin_only') and board.admin_only
        
        if has_admin_only and not is_admin:
            if current_user not in board.users and board.user_id != current_user.id:
                return jsonify({"error": "Access denied"}), 403
        
        # Get creator information
        creator = User.query.get(board.user_id)
        creator_data = creator.to_dict() if creator else {"username": "Unknown User"}
        
        # Get all lists with cards
        lists_query = List.query.filter_by(board_id=board_id).order_by(List.position)
        lists_data = []
        
        for list_obj in lists_query:
            list_info = list_obj.to_dict()
            
            # Get cards for this list
            cards_query = Card.query.filter_by(list_id=list_obj.id).order_by(Card.position)
            cards_data = []
            
            for card in cards_query:
                card_data = card.to_dict()
                cards_data.append(card_data)
            
            list_info["cards"] = cards_data
            lists_data.append(list_info)
        
        # Get users who have access to this board
        board_users = [user.to_dict() for user in board.users]
        
        # Add creator if not already in the list
        if creator and not any(user["id"] == creator.id for user in board_users):
            board_users.append(creator_data)
        
        # Build complete response
        response = {
            "board": board.to_dict(),
            "creator": creator_data,
            "lists": lists_data,
            "users": board_users
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"Error getting full board data: {str(e)}")
        return jsonify({"error": f"Failed to get board data: {str(e)}"}), 500

@kanban_bp.route('/api/card/<int:card_id>/creator_info', methods=['GET'])
@login_required
def get_card_creator_info(card_id):
    """Get creator information for a specific card."""
    try:
        # Find the card
        card = Card.query.get(card_id)
        if not card:
            return jsonify({"error": "Card not found"}), 404
        
        # Get creator information
        creator = User.query.get(card.user_id)
        if not creator:
            return jsonify({
                "success": True,
                "creator_name": "Unknown User",
                "created_at": card.created_at.isoformat() if card.created_at else None
            })
        
        return jsonify({
            "success": True,
            "creator_name": creator.username,
            "creator_id": creator.id,
            "created_at": card.created_at.isoformat() if card.created_at else None
        })
    
    except Exception as e:
        print(f"Error getting card creator info: {str(e)}")
        return jsonify({"error": f"Failed to get creator info: {str(e)}"}), 500

@kanban_bp.route('/api/board/<int:board_id>/creator_info', methods=['GET'])
@login_required
def get_board_creator_info(board_id):
    """Get creator information for a specific board."""
    try:
        # Find the board
        board = Board.query.get(board_id)
        if not board:
            return jsonify({"error": "Board not found"}), 404
        
        # Get creator information
        creator = User.query.get(board.user_id)
        if not creator:
            return jsonify({
                "success": True,
                "creator_name": "Unknown User",
                "created_at": board.created_at.isoformat() if board.created_at else None
            })
        
        return jsonify({
            "success": True,
            "creator_name": creator.username,
            "creator_id": creator.id,
            "created_at": board.created_at.isoformat() if board.created_at else None
        })
    
    except Exception as e:
        print(f"Error getting board creator info: {str(e)}")
        return jsonify({"error": f"Failed to get creator info: {str(e)}"}), 500

@kanban_bp.route('/api/boards/<int:board_id>/lists/with_cards', methods=['GET'])
@login_required
def get_lists_with_cards(board_id):
    """Get all lists for a board with their cards in a single request."""
    try:
        # Check if board exists and user has access
        board = Board.query.get(board_id)
        if not board:
            return jsonify({"error": "Board not found"}), 404
        
        # Check if user has access to this board
        is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
        has_admin_only = hasattr(board, 'admin_only') and board.admin_only
        
        if has_admin_only and not is_admin:
            if current_user not in board.users and board.user_id != current_user.id:
                return jsonify({"error": "Access denied"}), 403
        
        # Get all lists for this board, ordered by position
        lists_query = List.query.filter_by(board_id=board_id).order_by(List.position)
        lists_data = []
        
        for list_obj in lists_query:
            list_info = list_obj.to_dict()
            
            # Get cards for this list, ordered by position
            cards = Card.query.filter_by(list_id=list_obj.id).order_by(Card.position).all()
            cards_data = []
            
            for card in cards:
                card_data = card.to_dict()
                cards_data.append(card_data)
            
            list_info["cards"] = cards_data
            lists_data.append(list_info)
        
        return jsonify(lists_data)
    
    except Exception as e:
        print(f"Error getting lists with cards: {str(e)}")
        return jsonify({"error": f"Failed to get lists with cards: {str(e)}"}), 500

@kanban_bp.route('/api/cards/<int:card_id>/move_to_list/<int:target_list_id>', methods=['PUT'])
@login_required
@admin_required
def move_card_to_list(card_id, target_list_id):
    """Move a card to a different list and update positions."""
    try:
        # Get the card
        card = Card.query.get(card_id)
        if not card:
            return jsonify({"error": "Card not found"}), 404
        
        # Get source and target lists
        source_list_id = card.list_id
        source_list = List.query.get(source_list_id)
        target_list = List.query.get(target_list_id)
        
        if not source_list or not target_list:
            return jsonify({"error": "List not found"}), 404
        
        # Ensure both lists belong to the same board
        if source_list.board_id != target_list.board_id:
            return jsonify({"error": "Lists do not belong to the same board"}), 400
        
        # Get the board
        board = Board.query.get(source_list.board_id)
        if not board:
            return jsonify({"error": "Board not found"}), 404
        
        # Get the position in target list (default to end position)
        data = request.json or {}
        position = data.get('position')
        
        # Get current max position in target list if position not specified
        if position is None:
            max_position = db.session.query(db.func.max(Card.position)).filter(Card.list_id == target_list_id).scalar()
            position = 0 if max_position is None else max_position + 1
        
        # Move the card
        card.list_id = target_list_id
        card.position = position
        
        # Update positions of other cards if needed
        if position is not None:
            # Move other cards down to make room for the inserted card
            cards_to_move = Card.query.filter(
                Card.list_id == target_list_id,
                Card.id != card_id,
                Card.position >= position
            ).all()
            
            for other_card in cards_to_move:
                other_card.position += 1
        
        db.session.commit()
        
        # Notify assigned user if the card is assigned
        if card.assigned_to:
            notify_user(
                user_id=card.assigned_to,
                message=f"Card '{card.title}' was moved from '{source_list.name}' to '{target_list.name}'",
                category='info',
                link=f"/kanban?board_id={board.id}"
            )
        
        return jsonify({
            "success": True,
            "message": "Card moved successfully",
            "card": card.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error moving card: {str(e)}")
        return jsonify({"error": f"Failed to move card: {str(e)}"}), 500

@kanban_bp.route('/api/users/current', methods=['GET'])
@login_required
def get_current_user_info():
    """Get detailed information about the current logged-in user."""
    try:
        user_data = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email if hasattr(current_user, 'email') else None,
            "is_admin": current_user.is_admin if hasattr(current_user, 'is_admin') else False
        }
        
        # Add additional fields if available
        if hasattr(current_user, 'full_name'):
            user_data["full_name"] = current_user.full_name
        
        if hasattr(current_user, 'avatar_url'):
            user_data["avatar_url"] = current_user.avatar_url
        
        return jsonify({
            "success": True,
            "user": user_data
        })
    
    except Exception as e:
        print(f"Error getting current user info: {str(e)}")
        return jsonify({"error": f"Failed to get user info: {str(e)}"}), 500

# Optional but helpful - Migration function to set missing creator info
def migrate_missing_creator_info():
    """
    Set creator info for boards and cards that don't have it.
    This function can be called once manually to fix existing data.
    """
    try:
        # Get admin user as fallback creator
        admin_user = User.query.filter_by(is_admin=True).first()
        
        if not admin_user:
            print("No admin user found for fallback creator")
            return False
        
        # Update boards with missing user_id
        boards_updated = 0
        for board in Board.query.filter_by(user_id=None).all():
            board.user_id = admin_user.id
            boards_updated += 1
        
        # Update cards with missing user_id
        cards_updated = 0
        for card in Card.query.filter_by(user_id=None).all():
            card.user_id = admin_user.id
            cards_updated += 1
        
        db.session.commit()
        print(f"Updated {boards_updated} boards and {cards_updated} cards with creator info")
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Error migrating creator info: {str(e)}")
        return False

# Add this function to an endpoint that can be called once to fix data
@kanban_bp.route('/api/maintenance/migrate_creator_info', methods=['POST'])
@login_required
@admin_required  # Only admins can run maintenance functions
def run_creator_migration():
    """Run migration to fix missing creator information for existing boards and cards."""
    success = migrate_missing_creator_info()
    
    if success:
        return jsonify({
            "success": True,
            "message": "Creator information migration completed successfully"
        })
    else:
        return jsonify({
            "success": False,
            "message": "Error during creator information migration. Check logs for details."
        }), 500

