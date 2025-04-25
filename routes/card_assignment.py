# routes/card_assignment.py

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from routes.models import User, db, Board, List, Card, PriorityLevel
from functools import wraps
from routes.notifications import notify_user  # Добавить этот импорт в начало файла

card_assignment_bp = Blueprint('card_assignment', __name__)

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
            return jsonify({"error": "Administrator privileges required"}), 403
        return f(*args, **kwargs)
    return decorated_function

# ===== DB INITIALIZATION =====
def init_card_assignment_db():
    """
    Migrate existing single-assignee data to the new relationship.
    This should be run after database migrations are complete.
    """
    try:
        # Get all cards with an assigned_to value
        cards_with_assignee = Card.query.filter(Card.assigned_to != None).all()
        print(f"Found {len(cards_with_assignee)} cards with single assignee to migrate")
        
        # For each card, add the assigned user to the assigned_users relationship if not already there
        for card in cards_with_assignee:
            # Get the assigned user
            user = User.query.get(card.assigned_to)
            if user and hasattr(card, 'assigned_users'):
                # Only add if not already in the relationship
                if user not in card.assigned_users:
                    card.assigned_users.append(user)
                    print(f"Migrated card {card.id} assignee to new relationship")
        
        # Commit the changes
        db.session.commit()
        print("Migration of existing assignees completed successfully")
    
    except Exception as e:
        db.session.rollback()
        print(f"Error migrating existing assignees: {str(e)}")

# ===== CARD ASSIGNMENT ROUTES =====

# Изменения для файла card_assignment.py

# Добавьте импорт функции уведомлений в начало файла

# Обновите функцию назначения нескольких пользователей
@card_assignment_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/assign-multiple', methods=['PUT'])
@login_required
@admin_required  # Only admins can assign multiple users to cards
def assign_multiple_users_to_card(board_id, list_id, card_id):
    """Assign multiple users to a card"""
    
    # Find the card
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"success": False, "message": "Card not found"}), 404
    
    # Verify card belongs to the specified list and board
    list_obj = List.query.get(list_id)
    if not list_obj or list_obj.board_id != board_id:
        return jsonify({"success": False, "message": "List not found or does not belong to specified board"}), 404
    
    if card.list_id != list_id:
        return jsonify({"success": False, "message": "Card does not belong to specified list"}), 404
    
    # Get the board to check user access
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"success": False, "message": "Board not found"}), 404
    
    # Get user IDs from the request
    data = request.json
    user_ids = data.get('user_ids', [])
    
    try:
        # Сохраняем список текущих назначенных пользователей для отслеживания изменений
        current_assigned_users = list(card.assigned_users)
        current_assigned_user_ids = [user.id for user in current_assigned_users]
        
        # Validate all users exist and have access to the board
        valid_users = []
        for user_id in user_ids:
            user = User.query.get(user_id)
            if not user:
                continue  # Skip invalid users
            
            # Check if user has access to the board
            if user in board.users or user.id == board.user_id:
                valid_users.append(user)
        
        # Clear existing assignments and add new ones
        card.assigned_users = []
        
        for user in valid_users:
            card.assigned_users.append(user)
        
        # Also update the single assignee field for backward compatibility
        if valid_users:
            card.assigned_to = valid_users[0].id
        else:
            card.assigned_to = None
        
        db.session.commit()
        
        # Определяем новых пользователей для отправки уведомлений
        new_user_ids = [user.id for user in valid_users]
        
        # Отправляем уведомления новым назначенным пользователям
        for user in valid_users:
            # Если пользователь ранее не был назначен
            if user.id not in current_assigned_user_ids:
                notify_user(
                    user_id=user.id,
                    message=f"Вы были назначены на карточку '{card.title}' в доске '{board.name}'",
                    category='info',
                    link=f"/kanban?board_id={board_id}"
                )
        
        # Отправляем уведомления пользователям, которые были сняты с карточки
        for user in current_assigned_users:
            if user.id not in new_user_ids:
                notify_user(
                    user_id=user.id,
                    message=f"Вы были сняты с карточки '{card.title}' в доске '{board.name}'",
                    category='info',
                    link=f"/kanban?board_id={board_id}"
                )
        
        return jsonify({
            "success": True,
            "message": "Card assignments updated successfully",
            "assigned_users": [{'id': user.id, 'username': user.username} for user in valid_users]
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error assigning users to card: {str(e)}")
        return jsonify({"success": False, "message": f"Failed to assign users: {str(e)}"}), 500
@card_assignment_bp.route('/cards/<int:card_id>/assignees', methods=['GET'])
@login_required
def get_card_assignees(card_id):
    """Get all users assigned to a card"""
    
    # Find the card
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"success": False, "message": "Card not found"}), 404
    
    try:
        assigned_users = [{'id': user.id, 'username': user.username} 
                         for user in card.assigned_users]
        
        return jsonify({
            "success": True,
            "card_id": card.id,
            "assignees": assigned_users
        })
    
    except Exception as e:
        print(f"Error getting card assignees: {str(e)}")
        return jsonify({"success": False, "message": f"Failed to get assignees: {str(e)}"}), 500

@card_assignment_bp.route('/boards/<int:board_id>/users', methods=['GET'])
@login_required
def get_board_users(board_id):
    """Get all users that have access to a specific board"""
    
    # Find the board
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"success": False, "message": "Board not found"}), 404
    
    # Check if user has access to this board
    if current_user not in board.users and board.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"success": False, "message": "Permission denied"}), 403
    
    try:
        # Get users from board.users and the board creator
        board_users = list(board.users)
        
        # Add the board creator if not already in the list
        creator = User.query.get(board.user_id)
        if creator and creator not in board_users:
            board_users.append(creator)
        
        return jsonify([user.to_dict() for user in board_users])
    
    except Exception as e:
        print(f"Error getting board users: {str(e)}")
        return jsonify({"success": False, "message": f"Failed to get board users: {str(e)}"}), 500

# Routes to get creator information

@card_assignment_bp.route('/boards/<int:board_id>/creator', methods=['GET'])
@login_required
def get_board_creator(board_id):
    """Get creator information for a board"""
    
    # Find the board
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"success": False, "message": "Board not found"}), 404
    
    # Check if user has access to this board
    if current_user not in board.users and board.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"success": False, "message": "Permission denied"}), 403
    
    try:
        # Get the creator
        creator = User.query.get(board.user_id)
        if not creator:
            return jsonify({"success": False, "message": "Creator not found"}), 404
        
        return jsonify({
            "success": True,
            "board_id": board.id,
            "creator": creator.to_dict(),
            "created_at": board.created_at.isoformat() if board.created_at else None
        })
    
    except Exception as e:
        print(f"Error getting board creator: {str(e)}")
        return jsonify({"success": False, "message": f"Failed to get board creator: {str(e)}"}), 500

@card_assignment_bp.route('/cards/<int:card_id>/creator', methods=['GET'])
@login_required
def get_card_creator(card_id):
    """Get creator information for a card"""
    
    # Find the card
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"success": False, "message": "Card not found"}), 404
    
    # Get the list and board to check access permissions
    list_obj = List.query.get(card.list_id)
    if not list_obj:
        return jsonify({"success": False, "message": "List not found"}), 404
    
    board = Board.query.get(list_obj.board_id)
    if not board:
        return jsonify({"success": False, "message": "Board not found"}), 404
    
    # Check if user has access to this board
    if current_user not in board.users and board.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"success": False, "message": "Permission denied"}), 403
    
    try:
        # Get the creator
        creator = User.query.get(card.user_id)
        if not creator:
            return jsonify({"success": False, "message": "Creator not found"}), 404
        
        return jsonify({
            "success": True,
            "card_id": card.id,
            "creator": creator.to_dict(),
            "created_at": card.created_at.isoformat() if card.created_at else None
        })
    
    except Exception as e:
        print(f"Error getting card creator: {str(e)}")
        return jsonify({"success": False, "message": f"Failed to get card creator: {str(e)}"}), 500