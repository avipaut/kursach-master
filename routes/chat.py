# chat.py

import os
import uuid
from flask import Blueprint, render_template, request, jsonify, send_from_directory, current_app
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from routes.models import db, User, Message, MessageType, Lobby, ReadReceipt

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
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
    
    return render_template('chat.html', users=users, lobbies=lobbies)

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
    """Get all lobbies for the current user"""
    lobbies = [lobby.to_dict() for lobby in current_user.lobbies]
    return jsonify(lobbies)

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
    for message in messages:
        if message.sender_id != current_user.id:
            # Check if receipt already exists
            receipt = ReadReceipt.query.filter_by(
                message_id=message.id,
                user_id=current_user.id
            ).first()
            
            if not receipt:
                receipt = ReadReceipt(message_id=message.id, user_id=current_user.id)
                db.session.add(receipt)
    
    db.session.commit()
    
    return jsonify([message.to_dict() for message in messages])

@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Upload a file for a message"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['file']
    message_text = request.form.get('message', '')
    lobby_id = request.form.get('lobby_id')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    if not lobby_id:
        return jsonify({'success': False, 'error': 'No lobby selected'})
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return jsonify({'success': False, 'error': 'Invalid lobby or unauthorized'}), 403
    
    if file and allowed_file(file.filename):
        # Generate unique filename to prevent overwriting
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(file_path)
        
        # Determine message type based on file extension
        message_type = get_file_type(original_filename)
        
        # Create message with attachment
        new_message = Message(
            sender_id=current_user.id,
            lobby_id=lobby_id,
            text=message_text,
            message_type=message_type,
            file_path=f'/uploads/{unique_filename}',
            file_name=original_filename,
            file_size=os.path.getsize(file_path),
            file_type=request.files['file'].content_type
        )
        
        db.session.add(new_message)
        db.session.commit()
        
        # Emit message to all users in the lobby
        message_data = new_message.to_dict()
        for user in lobby.users:
            emit('new_message', message_data, room=f'user_{user.id}', namespace='/')
        
        return jsonify({'success': True, 'message': new_message.to_dict()})
    
    return jsonify({'success': False, 'error': 'File type not allowed'})

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

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    if current_user.is_authenticated:
        # Join a room specific to this user
        join_room(f'user_{current_user.id}')
        
        # Join rooms for all lobbies the user is in
        for lobby in current_user.lobbies:
            join_room(f'lobby_{lobby.id}')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    if current_user.is_authenticated:
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
    message_text = data.get('message', '')
    lobby_id = data.get('lobby_id')
    
    if not message_text or not lobby_id:
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return
    
    # Create new message
    new_message = Message(
        sender_id=current_user.id,
        lobby_id=lobby_id,
        text=message_text,
        message_type=MessageType.TEXT
    )
    
    db.session.add(new_message)
    db.session.commit()
    
    # Emit message to all users in the lobby
    message_data = new_message.to_dict()
    for user in lobby.users:
        emit('new_message', message_data, room=f'user_{user.id}')

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
    """Mark messages as read"""
    lobby_id = data.get('lobby_id')
    
    if not lobby_id:
        return
    
    # Check if lobby exists and user is a member
    lobby = Lobby.query.get(lobby_id)
    if not lobby or current_user not in lobby.users:
        return
    
    # Mark all messages in the lobby as read by the current user
    unread_messages = Message.query.filter_by(lobby_id=lobby_id).filter(
        ~Message.read_by.any(ReadReceipt.user_id == current_user.id)
    ).all()
    
    for message in unread_messages:
        receipt = ReadReceipt(message_id=message.id, user_id=current_user.id)
        db.session.add(receipt)
    
    db.session.commit()
    
    # Notify other users that messages were read
    for user in lobby.users:
        if user.id != current_user.id:
            emit('messages_read', {
                'lobby_id': lobby_id,
                'user_id': current_user.id
            }, room=f'user_{user.id}')