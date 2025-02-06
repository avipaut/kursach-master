from flask import Blueprint, jsonify, request
from routes.db_kanban import  db  # Импортируйте объект app из main.py

kanban_bp = Blueprint('kanban', __name__)
class Board(db.Model):
    __tablename__ = 'boards'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    lists = db.relationship('List', backref='board', cascade="all, delete-orphan", lazy=True)

class List(db.Model):
    __tablename__ = 'lists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey('boards.id'), nullable=False)
    cards = db.relationship('Card', backref='list', cascade="all, delete-orphan", lazy=True)

class Card(db.Model):
    __tablename__ = 'cards'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    list_id = db.Column(db.Integer, db.ForeignKey('lists.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)  # Новое поле для порядка


# Helper function to generate a consistent JSON response
def serialize_board(board):
    return {"id": board.id, "name": board.name}

# Get all boards
@kanban_bp.route('/boards', methods=['GET'])
def get_boards():
    boards = Board.query.all()
    return jsonify([{"id": b.id, "name": b.name} for b in boards])


@kanban_bp.route('/boards', methods=['POST'])
def create_board():
    data = request.json
    new_board = Board(name=data['name'])
    db.session.add(new_board)
    db.session.commit()
    return jsonify({"id": new_board.id, "name": new_board.name}), 201

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
@kanban_bp.route('/boards/<int:board_id>/lists', methods=['GET'])
def get_lists(board_id):
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404
    lists = List.query.filter_by(board_id=board_id).all()
    return jsonify([{"id": l.id, "name": l.name} for l in lists])

# Создать новый список в доске
@kanban_bp.route('/boards/<int:board_id>/lists', methods=['POST'])
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
    return jsonify([{"id": c.id, "title": c.title, "description": c.description} for c in cards])


@kanban_bp.route('/boards/<int:board_id>/lists/<int:list_id>/cards', methods=['POST'])
def create_card(board_id, list_id):
    # Проверяем, существует ли доска
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Проверяем, существует ли список и принадлежит ли он доске
    list_obj = List.query.filter_by(id=list_id, board_id=board_id).first()
    if not list_obj:
        return jsonify({"error": "List not found or does not belong to the specified board"}), 404

    # Проверяем данные запроса
    data = request.json
    if not data or 'title' not in data or not data['title'].strip():
        return jsonify({"error": "Field 'title' is required and cannot be empty"}), 400

    # Создаем карточку
    description = data.get('description', '')
    new_card = Card(title=data['title'], description=description, list_id=list_id)
    db.session.add(new_card)
    db.session.commit()

    return jsonify({"id": new_card.id, "title": new_card.title, "description": new_card.description}), 201

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