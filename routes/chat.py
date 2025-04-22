# chat.py

import os
import uuid
from flask import Blueprint, render_template, request, jsonify, send_from_directory, current_app
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from routes.models import db, User, Message, MessageType, Lobby, ReadReceipt
from datetime import datetime

# Create Blueprint
chat_bp = Blueprint('chat', __name__)
socketio = SocketIO()

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'uploads')
AVATAR_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'avatars')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(AVATAR_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar', 'mp3', 'mp4', 'wav'}

def allowed_file(filename):
    """Check if file extension is allowed"""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def get_file_type(filename):
    """Determine file type based on extension"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if ext in ['jpg', 'jpeg', 'png', 'gif']:
        return MessageType.IMAGE
    elif ext in ['mp3', 'wav']:
        return MessageType.AUDIO
    elif ext in ['mp4']:
        return MessageType.VIDEO
    else:
        return MessageType.FILE

@chat_bp.route('/')
@login_required
def messenger_page():
    """Main messenger page with chat functionality"""
    # Get all users except current user
    users = User.query.filter(User.id != current_user.id).all()
    
    # Get all lobbies where the current user is a member
    lobbies = current_user.lobbies
    
    # Можно передавать lobby_id в шаблон для его использования в JavaScript
    lobby_id = request.args.get('lobby_id')
    
    return render_template('chats/chat.html', users=users, lobbies=lobbies, initial_lobby_id=lobby_id)

@chat_bp.route('/api/user/current')
@login_required
def get_current_user():
    """Get current user info"""
    return jsonify(current_user.to_dict())

@chat_bp.route('/api/all_users')
@login_required
def get_all_users():
    """Get all users except current user for contacts list"""
    users = User.query.filter(User.id != current_user.id).all()
    return jsonify([user.to_dict() for user in users])

@chat_bp.route('/api/users')
@login_required
def get_users():
    """Get all users except current user"""
    users = User.query.filter(User.id != current_user.id).all()
    return jsonify([user.to_dict() for user in users])

@chat_bp.route('/lobbies')
@login_required
def get_lobbies():
    """Get all non-archived lobbies for the current user"""
    include_archived = request.args.get('include_archived', 'false').lower() == 'true'
    
    query = Lobby.query.filter(Lobby.users.contains(current_user))
    
    if not include_archived:
        query = query.filter(Lobby.is_archived == False)
    
    lobbies = query.all()
    
    return jsonify([lobby.to_dict() for lobby in lobbies])

@chat_bp.route('/create_lobby', methods=['POST'])
@login_required
def create_lobby():
    """Create a new lobby"""
    data = request.json
    user_ids = data.get('user_ids', [])
    is_group = data.get('is_group', False)
    name = data.get('name', None)
    description = data.get('description', None)
    
    # Add current user to the list
    if current_user.id not in user_ids:
        user_ids.append(current_user.id)
    
    # Check if this is a direct message between two users
    if len(user_ids) == 2 and not is_group:
        # Check if there's already a direct message lobby between these users
        existing_lobby = Lobby.query.filter(Lobby.is_group.is_(False)).join(
            Lobby.users
        ).filter(
            User.id.in_(user_ids)
        ).group_by(
            Lobby.id
        ).having(
            db.func.count(User.id) == 2
        ).first()
        
        if existing_lobby:
            return jsonify(existing_lobby.to_dict()), 200
    
    # Create new lobby
    lobby = Lobby(
        name=name,
        description=description,
        is_group=is_group,
        created_by=current_user.id
    )
    
    # Add users to lobby
    for user_id in user_ids:
        user = User.query.get(user_id)
        if user:
            lobby.users.append(user)
    
    db.session.add(lobby)
    db.session.commit()
    
    # Notify all users in the lobby about its creation
    for user_id in user_ids:
        emit('lobby_created', lobby.to_dict(), room=f'user_{user_id}', namespace='/')
    
    return jsonify(lobby.to_dict()), 201

@chat_bp.route('/lobby/<int:lobby_id>')
@login_required
def get_lobby(lobby_id):
    """Get details of a specific lobby"""
    lobby = Lobby.query.get_or_404(lobby_id)
    
    # Check if user is a member of this lobby
    if current_user not in lobby.users:
        return jsonify({'error': 'Unauthorized access to lobby'}), 403
    
    return jsonify(lobby.to_dict())

@chat_bp.route('/lobby/<int:lobby_id>/messages')
@login_required
def get_lobby_messages(lobby_id):
    """Get messages for a specific lobby"""
    lobby = Lobby.query.get_or_404(lobby_id)
    
    # Check if user is a member of this lobby
    if current_user not in lobby.users:
        return jsonify({'error': 'Unauthorized access to lobby messages'}), 403
    
    # Get messages for this lobby
    messages = Message.query.filter_by(lobby_id=lobby_id).order_by(Message.timestamp).all()
    
    # Mark messages as read
    unread_messages = []
    for message in messages:
        if message.sender_id != current_user.id:
            # Check if receipt already exists
            receipt = ReadReceipt.query.filter_by(
                message_id=message.id,
                user_id=current_user.id
            ).first()
            
            if not receipt:
                unread_messages.append(message.id)
                receipt = ReadReceipt(message_id=message.id, user_id=current_user.id)
                db.session.add(receipt)
    
    if unread_messages:
        db.session.commit()
        
        # Notify other users about message read status
        for user in lobby.users:
            if user.id != current_user.id:
                emit('messages_read', {
                    'lobby_id': lobby_id,
                    'user_id': current_user.id,
                    'message_ids': unread_messages
                }, room=f'user_{user.id}', namespace='/')
    
    return jsonify([message.to_dict() for message in messages])

# Archive/unarchive lobby route
@chat_bp.route('/lobby/<int:lobby_id>/archive', methods=['POST'])
@login_required
def toggle_archive_lobby(lobby_id):
    """Archive or unarchive a lobby"""
    lobby = Lobby.query.get_or_404(lobby_id)
    
    # Check if user is a member of this lobby
    if current_user not in lobby.users:
        return jsonify({'success': False, 'error': 'Unauthorized access to lobby'}), 403
    
    # Toggle archive status
    lobby.is_archived = not lobby.is_archived
    
    if lobby.is_archived:
        # Update archive info
        lobby.archived_at = datetime.utcnow()
        lobby.archived_by = current_user.id
        message = "Lobby archived successfully"
    else:
        # Reset archive info
        lobby.archived_at = None
        lobby.archived_by = None
        message = "Lobby unarchived successfully"
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'is_archived': lobby.is_archived,
        'message': message,
        'lobby': lobby.to_dict()
    })

# Delete lobby route
@chat_bp.route('/lobby/<int:lobby_id>/delete', methods=['DELETE'])
@login_required
def delete_lobby(lobby_id):
    """Delete a lobby and all its messages"""
    lobby = Lobby.query.get_or_404(lobby_id)
    
    # Check if user is a member of this lobby
    if current_user not in lobby.users:
        return jsonify({'success': False, 'error': 'Unauthorized access to lobby'}), 403
    
    # Additional check for group chats - only creator or admin can delete
    if lobby.is_group and lobby.created_by != current_user.id and not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Only the creator or an admin can delete group chats'}), 403
    
    try:
        # Delete the lobby
        db.session.delete(lobby)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Lobby deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

# Get archived lobbies
@chat_bp.route('/lobbies/archived')
@login_required
def get_archived_lobbies():
    """Get all archived lobbies for the current user"""
    archived_lobbies = Lobby.query.filter(
        Lobby.users.contains(current_user),
        Lobby.is_archived == True
    ).all()
    
    return jsonify([lobby.to_dict() for lobby in archived_lobbies])

@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Upload a file for a message"""
    try:
        print("=== UPLOAD REQUEST RECEIVED ===")
        print(f"Request form data: {request.form}")
        print(f"Request files: {list(request.files.keys())}")
        
        if 'file' not in request.files:
            print("Error: No file part in request")
            return jsonify({'success': False, 'error': 'No file part in request'}), 400
        
        file = request.files['file']
        message_text = request.form.get('message', '')
        lobby_id = request.form.get('lobby_id')
        
        print(f"File received: {file.filename}, type: {file.content_type}")
        print(f"Message text: {message_text}")
        print(f"Lobby ID: {lobby_id}")
        
        if file.filename == '':
            print("Error: File has no filename")
            return jsonify({'success': False, 'error': 'No selected file'}), 400
        
        if not lobby_id:
            print("Error: No lobby_id provided")
            return jsonify({'success': False, 'error': 'No lobby selected'}), 400
        
        # Check if lobby exists and user is a member
        lobby = Lobby.query.get(lobby_id)
        if not lobby:
            print(f"Error: Lobby {lobby_id} not found")
            return jsonify({'success': False, 'error': 'Lobby not found'}), 404
        
        if current_user not in lobby.users:
            print(f"Error: User {current_user.id} not in lobby {lobby_id}")
            return jsonify({'success': False, 'error': 'Unauthorized access to lobby'}), 403
        
        # Check file type
        if allowed_file(file.filename):
            try:
                # Make sure upload folder exists
                if not os.path.exists(UPLOAD_FOLDER):
                    print(f"Creating upload directory: {UPLOAD_FOLDER}")
                    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
                
                # Generate unique filename
                original_filename = secure_filename(file.filename)
                file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
                unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
                
                # Full path for saving the file
                file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
                print(f"Saving file to: {file_path}")
                
                # Save the file
                file.save(file_path)
                
                # Verify file was saved
                if not os.path.exists(file_path):
                    print(f"Error: File not saved at {file_path}")
                    return jsonify({'success': False, 'error': 'Failed to save file'}), 500
                
                file_size = os.path.getsize(file_path)
                print(f"File saved successfully, size: {file_size} bytes")
                
                # Determine message type
                message_type = get_file_type(original_filename)
                print(f"Message type: {message_type}")
                
                # URL path (not filesystem path)
                url_path = f'/uploads/{unique_filename}'
                
                # Create message with explicit transaction
                try:
                    # Create message
                    new_message = Message(
                        sender_id=current_user.id,
                        lobby_id=lobby_id,
                        text=message_text,
                        message_type=message_type,
                        file_path=url_path,
                        file_name=original_filename,
                        file_size=file_size,
                        file_type=file.content_type
                    )
                    
                    # Important: Save message to get its ID
                    db.session.add(new_message)
                    db.session.flush()  # This assigns the ID without committing
                    
                    print(f"Created message with ID: {new_message.id}")
                    
                    # Now create read receipt with the valid message ID
                    receipt = ReadReceipt(
                        message_id=new_message.id,
                        user_id=current_user.id
                    )
                    db.session.add(receipt)
                    
                    # Commit both objects
                    db.session.commit()
                    print("Successfully committed message and read receipt")
                    
                except Exception as db_error:
                    db.session.rollback()
                    print(f"Database error: {str(db_error)}")
                    return jsonify({'success': False, 'error': f"Database error: {str(db_error)}"}), 500
                
                # Get message data for response
                message_data = new_message.to_dict()
                print(f"Message data for response: {message_data}")
                
                # Emit to all users in lobby
                socketio_success = True
                try:
                    for user in lobby.users:
                        print(f"Emitting to user_{user.id}")
                        socketio.emit('new_message', message_data, room=f'user_{user.id}')
                        
                        # Create notification for other users
                        if user.id != current_user.id:
                            notification_text = None
                            if message_text:
                                notification_text = message_text
                            elif message_type == MessageType.IMAGE:
                                notification_text = "📷 Image"
                            elif message_type == MessageType.AUDIO:
                                notification_text = "🎵 Audio"
                            elif message_type == MessageType.VIDEO:
                                notification_text = "📹 Video"
                            elif message_type == MessageType.FILE:
                                notification_text = f"📎 File: {original_filename}"
                            
                            from routes.notifications import create_message_notification
                            create_message_notification(user.id, current_user.id, lobby_id, notification_text)
                except Exception as emit_error:
                    print(f"Socket.IO emit error: {str(emit_error)}")
                    socketio_success = False
                
                print(f"Socket.IO emit successful: {socketio_success}")
                print("=== UPLOAD COMPLETED SUCCESSFULLY ===")
                
                return jsonify({
                    'success': True,
                    'message': message_data,
                    'socketio_success': socketio_success
                })
                
            except Exception as e:
                import traceback
                print(f"Exception during upload processing: {str(e)}")
                traceback.print_exc()
                db.session.rollback()
                return jsonify({'success': False, 'error': str(e)}), 500
        else:
            print(f"Error: File type not allowed for {file.filename}")
            return jsonify({'success': False, 'error': 'File type not allowed'}), 400
    
    except Exception as e:
        import traceback
        print(f"Unexpected exception in upload_file: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': f"Server error: {str(e)}"}), 500

# Also ensure get_file_type is working correctly:
def get_file_type(filename):
    """Determine file type based on extension"""
    print(f"Determining file type for: {filename}")
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    print(f"File extension: {ext}")
    
    if ext in ['jpg', 'jpeg', 'png', 'gif']:
        print("File type: IMAGE")
        return MessageType.IMAGE
    elif ext in ['mp3', 'wav', 'ogg']:
        print("File type: AUDIO")
        return MessageType.AUDIO
    elif ext in ['mp4', 'webm', 'mov']:
        print("File type: VIDEO")
        return MessageType.VIDEO
    else:
        print("File type: FILE")
        return MessageType.FILE

@chat_bp.route('/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    """Upload a user avatar"""
    if 'avatar' not in request.files:
        return jsonify({'success': False, 'error': 'No avatar file provided'})
    
    avatar_file = request.files['avatar']
    
    if avatar_file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    if avatar_file and allowed_file(avatar_file.filename):
        # Generate unique filename
        file_extension = avatar_file.filename.rsplit('.', 1)[1].lower() if '.' in avatar_file.filename else ''
        unique_filename = f"avatar_{current_user.id}_{uuid.uuid4().hex}.{file_extension}"
        
        avatar_path = os.path.join(AVATAR_FOLDER, unique_filename)
        avatar_file.save(avatar_path)
        
        # Update user avatar
        current_user.avatar = f'/avatars/{unique_filename}'
        db.session.commit()
        
        return jsonify({'success': True, 'avatar_url': current_user.avatar})
    
    return jsonify({'success': False, 'error': 'File type not allowed'})

@chat_bp.route('/uploads/<filename>')
@login_required
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@chat_bp.route('/avatars/<filename>')
def avatar_file(filename):
    """Serve avatar images"""
    return send_from_directory(AVATAR_FOLDER, filename)

# маршрут для отладки
@chat_bp.route('/debug/messages')
@login_required
def debug_messages():
    """Debug route to check messages in the database"""
    messages = Message.query.order_by(Message.timestamp.desc()).limit(20).all()
    return jsonify([{
        'id': msg.id,
        'sender_id': msg.sender_id,
        'lobby_id': msg.lobby_id,
        'text': msg.text,
        'timestamp': msg.timestamp.isoformat(),
        'message_type': msg.message_type.value if msg.message_type else None
    } for msg in messages])

@chat_bp.route('/api/unread_messages_total')
@login_required
def get_total_unread_messages():
    """Получить общее количество непрочитанных сообщений для текущего пользователя"""
    from sqlalchemy import and_, not_
    
    # Запрос непрочитанных сообщений для пользователя
    total_unread = Message.query.join(
        Message.lobby
    ).filter(
        Lobby.users.contains(current_user),  # Пользователь состоит в лобби
        Message.sender_id != current_user.id,  # Сообщения не от текущего пользователя
        ~Message.read_by.any(ReadReceipt.user_id == current_user.id)  # Сообщения не прочитаны текущим пользователем
    ).count()
    
    return jsonify({'unread_count': total_unread})

@chat_bp.route('/api/lobbies_with_unread')
@login_required
def get_lobbies_with_unread():
    """Получить список лобби с количеством непрочитанных сообщений"""
    from sqlalchemy import and_, not_, func
    
    # Подзапрос для подсчета непрочитанных сообщений в каждом лобби
    subquery = db.session.query(
        Message.lobby_id,
        func.count(Message.id).label('unread_count')
    ).filter(
        Message.sender_id != current_user.id,  # Сообщения не от текущего пользователя
        ~Message.read_by.any(ReadReceipt.user_id == current_user.id)  # Сообщения не прочитаны текущим пользователем
    ).group_by(Message.lobby_id).subquery()
    
    # Получаем лобби, в которых есть непрочитанные сообщения
    lobbies_with_unread = db.session.query(
        Lobby, subquery.c.unread_count
    ).join(
        subquery, Lobby.id == subquery.c.lobby_id
    ).join(
        Lobby.users
    ).filter(
        User.id == current_user.id  # Пользователь состоит в лобби
    ).all()
    
    result = []
    for lobby, unread_count in lobbies_with_unread:
        result.append({
            'lobby_id': lobby.id,
            'unread_count': unread_count
        })
    
    return jsonify(result)

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    if current_user.is_authenticated:
        # Обновляем статус онлайн
        current_user.is_online = True
        current_user.last_seen = datetime.utcnow()
        db.session.commit()
        
        # Оповещаем других пользователей
        emit('user_status_change', {
            'user_id': current_user.id,
            'is_online': True
        }, broadcast=True)
        
        # Join a room specific to this user
        join_room(f'user_{current_user.id}')
        
        # Join rooms for all lobbies the user is in
        for lobby in current_user.lobbies:
            join_room(f'lobby_{lobby.id}')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    if current_user.is_authenticated:
        # Обновляем статус оффлайн
        current_user.is_online = False
        current_user.last_seen = datetime.utcnow()
        db.session.commit()
        
        # Оповещаем других пользователей
        emit('user_status_change', {
            'user_id': current_user.id,
            'is_online': False
        }, broadcast=True)
        
        # Leave user-specific room
        leave_room(f'user_{current_user.id}')
        
        # Leave all lobby rooms
        for lobby in current_user.lobbies:
            leave_room(f'lobby_{lobby.id}')

@socketio.on('join_lobby')
def handle_join_lobby(data):
    """Handle user joining a specific lobby"""
    lobby_id = data.get('lobby_id')
    
    if not lobby_id:
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return
    
    # Join the lobby room
    join_room(f'lobby_{lobby_id}')

@socketio.on('leave_lobby')
def handle_leave_lobby(data):
    """Handle user leaving a specific lobby"""
    lobby_id = data.get('lobby_id')
    
    if lobby_id:
        leave_room(f'lobby_{lobby_id}')

@socketio.on('send_message')
def handle_send_message(data):
    """Handle sending a text message"""
    print(f"Received message: {data}")
    message_text = data.get('message', '')
    lobby_id = data.get('lobby_id')
    
    if not message_text or not lobby_id:
        print("Missing message text or lobby_id")
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        print(f"Lobby {lobby_id} not found or user not in lobby")
        return
    
    try:
        # Create new message
        new_message = Message(
            sender_id=current_user.id,
            lobby_id=lobby_id,
            text=message_text,
            message_type=MessageType.TEXT
        )
        
        db.session.add(new_message)
        db.session.commit()
        
        # Автоматически отмечаем сообщение как прочитанное отправителем
        receipt = ReadReceipt(message_id=new_message.id, user_id=current_user.id)
        db.session.add(receipt)
        db.session.commit()
        
        # Prepare message data
        message_data = new_message.to_dict()
        print(f"Created message: {message_data}")
        
        # Emit message to all users in the lobby
        for user in lobby.users:
            print(f"Emitting message to user {user.id}")
            emit('new_message', message_data, room=f'user_{user.id}')
            
            # Создаем уведомление для других пользователей
            if user.id != current_user.id:
                from routes.notifications import create_message_notification
                create_message_notification(user.id, current_user.id, lobby_id, message_text)
        
        print("Message sent successfully")
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        db.session.rollback()
    
@socketio.on('user_typing')
def handle_user_typing(data):
    """Handle user typing indicator"""
    lobby_id = data.get('lobby_id')
    
    if not lobby_id:
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return
    
    # Emit typing indicator to all users in the lobby
    for user in lobby.users:
        if user.id != current_user.id:
            emit('user_typing', {
                'lobby_id': lobby_id,
                'user_id': current_user.id,
                'username': current_user.username
            }, room=f'user_{user.id}')

@socketio.on('stop_typing')
def handle_stop_typing(data):
    """Handle user stop typing indicator"""
    lobby_id = data.get('lobby_id')
    
    if not lobby_id:
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return
    
    # Emit stop typing indicator to all users in the lobby
    for user in lobby.users:
        if user.id != current_user.id:
            emit('user_stop_typing', {
                'lobby_id': lobby_id,
                'user_id': current_user.id
            }, room=f'user_{user.id}')

@socketio.on('read_messages')
def handle_read_messages(data):
    """Mark messages as read and notify other users"""
    lobby_id = data.get('lobby_id')
    
    if not lobby_id:
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return
    
    # Mark all messages in the lobby as read by the current user
    unread_messages = Message.query.filter_by(lobby_id=lobby_id).filter(
        Message.sender_id != current_user.id,
        ~Message.read_by.any(ReadReceipt.user_id == current_user.id)
    ).all()
    
    message_ids = []  # Список ID прочитанных сообщений
    
    for message in unread_messages:
        receipt = ReadReceipt(message_id=message.id, user_id=current_user.id)
        db.session.add(receipt)
        message_ids.append(message.id)
    
    db.session.commit()
    
    # Notify other users that messages were read
    for user in lobby.users:
        if user.id != current_user.id:
            emit('messages_read', {
                'lobby_id': lobby_id,
                'user_id': current_user.id,
                'message_ids': message_ids
            }, room=f'user_{user.id}')

@socketio.on('join_user_room')
def handle_join_user_room(data):
    """Handle user joining their personal notification room for global notifications"""
    user_id = data.get('user_id')
    
    if not user_id:
        return
        
    # Check if the user is authorized
    if not current_user.is_authenticated or current_user.id != user_id:
        return
    
    # Join the user specific room
    room_name = f'user_{user_id}'
    join_room(room_name)
    print(f"User {user_id} joined global notification room: {room_name}")