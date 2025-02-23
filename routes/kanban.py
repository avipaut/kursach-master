from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from routes.models import PriorityLevel, db, Board, List, Card  # Используем уже инициализированный db из app.py
kanban_bp = Blueprint('kanban', __name__)




@kanban_bp.route('/kanban', endpoint='kanban_board')
def trello():
    return render_template('kanban.html')  # Указываем, что рендерим kanban.html


# Helper function to generate a consistent JSON response
def serialize_board(board):
    return {"id": board.id, "name": board.name}

@kanban_bp.route('/boards', methods=['GET'])
@login_required
def get_boards():
    boards = Board.query.all()
    return jsonify([board.to_dict() for board in boards])



@kanban_bp.route('/boards', methods=['POST'])
@login_required
def create_board():
    data = request.get_json()
    new_board = Board(
        name=data.get('name'),
        user_id=current_user.id  # Важно передать ID текущего пользователя
    )
    db.session.add(new_board)
    db.session.commit()
    return jsonify(new_board.to_dict()), 201
@kanban_bp.route('/boards/<int:board_id>', methods=['PUT'])
def update_board(board_id):
    board_obj = Board.query.get(board_id)
    if not board_obj:
        return jsonify({"error": "Board not found"}), 404
    data = request.json
    board_obj.name = data.get('name', board_obj.name)
    db.session.commit()
    return jsonify({"id": board_obj.id, "name": board_obj.name})


@kanban_bp.route('/boards/<int:board_id>', methods=['DELETE'])
def delete_board(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    db.session.delete(board)
    db.session.commit()
    return '', 204

###########

# Получить все списки для конкретной доски
# Пример защищенного маршрута для работы с карточками (списки)
@kanban_bp.route('/boards/<int:board_id>/lists', methods=['GET'])
@login_required  # Защищаем маршрут
def get_lists(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    lists = List.query.filter_by(board_id=board_id).all()
    return jsonify([{"id": l.id, "name": l.name} for l in lists])

# Создать новый список в доске
@kanban_bp.route('/boards/<int:board_id>/lists', methods=['POST'])
@login_required
def create_list(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    
    data = request.json
    new_list = List(name=data['name'], board_id=board_id)
    db.session.add(new_list)
    db.session.commit()
    
    return jsonify({"id": new_list.id, "name": new_list.name}), 201


# Обновить список
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>', methods=['PUT'])
def update_list(board_id, list_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Обновляем список
    data = request.json
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({"error": "Field 'name' is required for update"}), 400

    list_obj.name = data['name']
    db.session.commit()

    return jsonify({"id": list_obj.id, "name": list_obj.name})


# Удалить список
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>', methods=['DELETE'])
def delete_list(board_id, list_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Удаляем список
    db.session.delete(list_obj)
    db.session.commit()
    return '', 204

#####
@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards', methods=['GET'])
def get_cards(board_id, list_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Получаем карточки
    cards = Card.query.filter_by(list_id=list_id).all()
    
    # Возвращаем карточки в виде списка словарей с дополнительной информацией
    return jsonify([card.to_dict() for card in cards])



@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards', methods=['POST'])
@login_required
def create_card(board_id, list_id):
    data = request.json
    new_card = Card(
        title=data['title'],
        description=data.get('description', ''),
        list_id=list_id,
        user_id=current_user.id,  # Добавляем ID текущего пользователя
        priority=PriorityLevel(data.get('priority', 'low'))  # Устанавливаем приоритет
    )
    db.session.add(new_card)
    db.session.commit()
    return jsonify(new_card.to_dict()), 201

# Обновить карточку
@kanban_bp.route('/cards/<int:card_id>', methods=['PUT'])
def update_card(board_id, list_id, card_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

     # Проверяем существование карточки и принадлежность списку
    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

    data = request.json
    card.title = data.get('title', card.title)
    card.description = data.get('description', card.description)
    db.session.commit()
    return jsonify({"id": card.id, "title": card.title, "description": card.description})

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>', methods=['DELETE'])
def delete_card(board_id, list_id, card_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Проверяем существование карточки и принадлежность списку
    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

    # Удаляем карточку
    db.session.delete(card)
    db.session.commit()
    return '', 204

#####

@kanban_bp.route('/boards/<int:board_id>/lists/<int:source_list_id>/cards/<int:card_id>/move/<int:target_list_id>', methods=['PUT'])
def move_card(board_id, source_list_id, card_id, target_list_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование исходного списка и принадлежность доске
    source_list = List.query.filter_by(id=source_list_id, board_id=board_id).first()
    if not source_list:
        return jsonify({"error": "Source list not found or does not belong to the specified board"}), 404

    # Проверяем существование целевого списка и принадлежность доске
    target_list = List.query.filter_by(id=target_list_id, board_id=board_id).first()
    if not target_list:
        return jsonify({"error": "Target list not found or does not belong to the specified board"}), 404

    # Проверяем существование карточки и принадлежность исходному списку
    card = Card.query.filter_by(id=card_id, list_id=source_list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the source list"}), 404

    # Обновляем список карточки
    card.list_id = target_list_id
    db.session.commit()

    return jsonify({"id": card.id, "title": card.title, "description": card.description, "list_id": card.list_id}), 200


@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/reorder', methods=['PUT'])
def reorder_card(board_id, list_id, card_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Проверяем существование карточки
    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

    # Обновляем порядок карточки
    data = request.json
    new_order = data.get('order')
    if new_order is None or not isinstance(new_order, int):
        return jsonify({"error": "Field 'order' is required and must be an integer"}), 400

    # Сдвигаем другие карточки
    cards = Card.query.filter_by(list_id=list_id).order_by(Card.order).all()
    for index, existing_card in enumerate(cards):
        if existing_card.id == card_id:
            continue
        existing_card.order = index if index < new_order else index + 1

    card.order = new_order
    db.session.commit()

    return jsonify({"id": card.id, "title": card.title, "description": card.description, "order": card.order}), 200

# @kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/update_priority', methods=['PUT'])
# @login_required
# def update_priority(board_id, list_id, card_id):
#     # Проверяем существование доски
#     board = Board.query.get(board_id)
#     if not board:
#         return jsonify({"error": "Board not found"}), 404

#     # Проверяем существование списка и принадлежность доске
#     list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
#     if not list_obj:
#         return jsonify({"error": "List not found or does not belong to the specified board"}), 404

#     # Проверяем существование карточки и принадлежность списку
#     card = Card.query.filter_by(id=card_id, list_id=list_id).first()
#     if not card:
#         return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

#     # Получаем данные из запроса
#     data = request.json
#     new_priority = data.get('priority')

#     # Проверка на корректность приоритета
#     if new_priority not in ['low', 'medium', 'high']:
#         return jsonify({"error": "Invalid priority value. Allowed values are 'low', 'medium', 'high'."}), 400

#     # Обновляем приоритет карточки
#     card.priority = new_priority
#     db.session.commit()

#     return jsonify({
#         'message': 'Priority updated successfully',
#         'card_id': card.id,
#         'priority': card.priority
#     }), 200

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/update_priority', methods=['PUT'])
@login_required
def update_priority(board_id, list_id, card_id):
    # Проверяем существование доски
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем существование списка и принадлежность доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Проверяем существование карточки и принадлежность списку
    card = Card.query.filter_by(id=card_id, list_id=list_id).first()
    if not card:
        return jsonify({"error": "Card not found or does not belong to the specified list"}), 404

    # Получаем данные из запроса
    data = request.json
    new_priority = data.get('priority')

    # Проверка на корректность приоритета
    if new_priority not in ['low', 'medium', 'high']:
        return jsonify({"error": "Invalid priority value. Allowed values are 'low', 'medium', 'high'."}), 400

    # Обновляем приоритет карточки
    card.priority = new_priority
    
    # Сохраняем изменения в базу данных
    db.session.commit()

    return jsonify({
        'message': 'Priority updated successfully',
        'card_id': card.id,
        'priority': card.priority
    }), 200

@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards/<int:card_id>/priority', methods=['PUT'])
@login_required
def update_card_priority(board_id, list_id, card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404
    
    data = request.json
    if 'priority' not in data:
        return jsonify({"error": "Priority is required"}), 400
        
    try:
        card.priority = PriorityLevel(data['priority'])
        db.session.commit()
        return jsonify(card.to_dict())
    except ValueError:
        return jsonify({"error": "Invalid priority value"}), 400