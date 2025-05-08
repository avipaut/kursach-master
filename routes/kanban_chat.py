# Add these functions to kanban.py or create a new module kanban_chat.py

from routes.models import db, User, Board, Card, Lobby, Message, MessageType
from datetime import datetime

def create_board_chat(board_name, users, created_by, board_id):
    """
    Create a chat lobby for a board
    
    Args:
        board_name (str): Name of the board
        users (list): List of User objects to add to the lobby
        created_by (int): User ID of the creator
        board_id (int): ID of the board
        
    Returns:
        Lobby: The created lobby object or None if failed
    """
    try:
        # Create a new lobby for this board
        lobby_name = f"Доска: {board_name}"
        
        lobby = Lobby(
            name=lobby_name,
            description=f"Обсуждение доски '{board_name}'",
            is_group=True,
            created_by=created_by
        )
        
        # Add users to the lobby
        for user in users:
            if user not in lobby.users:
                lobby.users.append(user)
        
        db.session.add(lobby)
        db.session.flush()  # Get the ID without committing
        
        # Create a welcome message
        welcome_message = Message(
            sender_id=created_by,
            lobby_id=lobby.id,
            text=f"Добро пожаловать в обсуждение доски '{board_name}'!",
            message_type=MessageType.TEXT
        )
        
        db.session.add(welcome_message)
        
        return lobby
    except Exception as e:
        print(f"Error creating board chat: {str(e)}")
        db.session.rollback()
        return None

def create_card_chat(card_title, users, created_by, card_id):
    """
    Create a chat lobby for a card
    
    Args:
        card_title (str): Title of the card
        users (list): List of User objects to add to the lobby
        created_by (int): User ID of the creator
        card_id (int): ID of the card
        
    Returns:
        Lobby: The created lobby object or None if failed
    """
    try:
        # Create a new lobby for this card
        lobby_name = f"Карточка: {card_title}"
        
        lobby = Lobby(
            name=lobby_name,
            description=f"Обсуждение карточки '{card_title}'",
            is_group=True,
            created_by=created_by
        )
        
        # Add users to the lobby
        for user in users:
            if user not in lobby.users:
                lobby.users.append(user)
        
        db.session.add(lobby)
        db.session.flush()  # Get the ID without committing
        
        # Create a welcome message
        welcome_message = Message(
            sender_id=created_by,
            lobby_id=lobby.id,
            text=f"Добро пожаловать в обсуждение карточки '{card_title}'!",
            message_type=MessageType.TEXT
        )
        
        db.session.add(welcome_message)
        
        return lobby
    except Exception as e:
        print(f"Error creating card chat: {str(e)}")
        db.session.rollback()
        return None

# Add these functions to handle user assignment changes

def update_card_chat_members(card_id, old_user_ids, new_user_ids):
    """
    Update the members of a card's chat lobby when assignments change
    
    Args:
        card_id (int): ID of the card
        old_user_ids (list): List of previously assigned user IDs
        new_user_ids (list): List of newly assigned user IDs
    """
    card = Card.query.get(card_id)
    if not card or not card.chat_lobby_id:
        return
    
    lobby = Lobby.query.get(card.chat_lobby_id)
    if not lobby:
        return
    
    # Find users to add and remove
    users_to_add = []
    for user_id in new_user_ids:
        if user_id not in old_user_ids:
            user = User.query.get(user_id)
            if user and user not in lobby.users:
                users_to_add.append(user)
    
    users_to_remove = []
    for user_id in old_user_ids:
        if user_id not in new_user_ids:
            user = User.query.get(user_id)
            if user and user in lobby.users:
                # Don't remove the creator of the lobby
                if user.id != lobby.created_by:
                    users_to_remove.append(user)
    
    # Update lobby members
    for user in users_to_add:
        lobby.users.append(user)
    
    for user in users_to_remove:
        lobby.users.remove(user)
    
    db.session.commit()
    
    # Add system messages about user changes
    if users_to_add:
        user_names = ", ".join([user.username for user in users_to_add])
        system_message = Message(
            sender_id=card.user_id,  # Creator of the card
            lobby_id=lobby.id,
            text=f"Пользователи {user_names} добавлены в обсуждение",
            message_type=MessageType.TEXT
        )
        db.session.add(system_message)
    
    if users_to_remove:
        user_names = ", ".join([user.username for user in users_to_remove])
        system_message = Message(
            sender_id=card.user_id,  # Creator of the card
            lobby_id=lobby.id,
            text=f"Пользователи {user_names} удалены из обсуждения",
            message_type=MessageType.TEXT
        )
        db.session.add(system_message)
    
    if users_to_add or users_to_remove:
        db.session.commit()

def update_board_chat_members(board_id, old_user_ids, new_user_ids):
    """
    Update the members of a board's chat lobby when users are added or removed
    
    Args:
        board_id (int): ID of the board
        old_user_ids (list): List of previous user IDs
        new_user_ids (list): List of new user IDs
    """
    board = Board.query.get(board_id)
    if not board or not board.chat_lobby_id:
        return
    
    lobby = Lobby.query.get(board.chat_lobby_id)
    if not lobby:
        return
    
    # Find users to add and remove
    users_to_add = []
    for user_id in new_user_ids:
        if user_id not in old_user_ids:
            user = User.query.get(user_id)
            if user and user not in lobby.users:
                users_to_add.append(user)
    
    users_to_remove = []
    for user_id in old_user_ids:
        if user_id not in new_user_ids:
            user = User.query.get(user_id)
            if user and user in lobby.users:
                # Don't remove the creator of the lobby
                if user.id != lobby.created_by:
                    users_to_remove.append(user)
    
    # Update lobby members
    for user in users_to_add:
        lobby.users.append(user)
    
    for user in users_to_remove:
        lobby.users.remove(user)
    
    db.session.commit()
    
    # Add system messages about user changes
    if users_to_add:
        user_names = ", ".join([user.username for user in users_to_add])
        system_message = Message(
            sender_id=board.user_id,  # Creator of the board
            lobby_id=lobby.id,
            text=f"Пользователи {user_names} добавлены в обсуждение",
            message_type=MessageType.TEXT
        )
        db.session.add(system_message)
    
    if users_to_remove:
        user_names = ", ".join([user.username for user in users_to_remove])
        system_message = Message(
            sender_id=board.user_id,  # Creator of the board
            lobby_id=lobby.id,
            text=f"Пользователи {user_names} удалены из обсуждения",
            message_type=MessageType.TEXT
        )
        db.session.add(system_message)
    
    if users_to_add or users_to_remove:
        db.session.commit()