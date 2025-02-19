# chat.py

import sqlite3
import os
import uuid
import datetime
from flask import Blueprint, render_template, request, redirect, url_for, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import current_user, login_required

chat_bp = Blueprint('chat', __name__)
socketio = SocketIO(cors_allowed_origins="*")

# Папка для загрузки файлов с уникальными именами
UPLOAD_FOLDER = 'uploaded_documents'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

users_online = {}  # Список онлайн пользователей
active_rooms = {}  # Активные комнаты чата

# Инициализация базы данных с расширенной схемой
def init_databases():
    with sqlite3.connect('messages.db') as con:
        cur = con.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        room_id TEXT,
                        sender TEXT,
                        message TEXT,
                        message_type TEXT DEFAULT 'text',
                        file_path TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )''')
        cur.execute('''CREATE TABLE IF NOT EXISTS chat_rooms (
                        room_id TEXT PRIMARY KEY,
                        user1 TEXT,
                        user2 TEXT,
                        last_message TEXT,
                        last_message_time DATETIME
                    )''')
        con.commit()

init_databases()

@chat_bp.route('/messenger')
@login_required
def messenger_page():
    username = current_user.username
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute("SELECT id, username FROM users WHERE username != ?", (username,))
        users = cur.fetchall()
    
    # Добавляем информацию о статусе онлайн
    users_with_status = [
        {'id': user[0], 'username': user[1], 'is_online': user[1] in users_online}
        for user in users
    ]
    
    return render_template('chat.html', username=username, users=users_with_status)


@chat_bp.route('/get_chat_history/<int:user_id>', methods=['GET'])
@login_required
def get_chat_history(user_id):
    """Получение истории сообщений для конкретного чата."""
    current_username = current_user.username
    with sqlite3.connect('users.db') as user_con:
        cur = user_con.cursor()
        cur.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        recipient = cur.fetchone()[0]

    room_id = generate_room_id(current_username, recipient)
    
    with sqlite3.connect('messages.db') as msg_con:
        cur = msg_con.cursor()
        cur.execute('''
            SELECT sender, message, message_type, file_path, timestamp 
            FROM messages 
            WHERE room_id = ? 
            ORDER BY timestamp
        ''', (room_id,))
        messages = cur.fetchall()
    
    return jsonify([{
        'sender': msg[0], 
        'message': msg[1], 
        'type': msg[2], 
        'file_path': msg[3], 
        'timestamp': msg[4]
    } for msg in messages])

def generate_room_id(user1, user2):
    """Генерация уникального идентификатора комнаты."""
    return '_'.join(sorted([user1, user2]))

@socketio.on('send_message')
def handle_send_message(data):
    """Расширенная обработка отправки сообщений."""
    sender = current_user.username
    recipient = data.get('recipient')
    message = data.get('message')
    message_type = data.get('type', 'text')
    file_path = data.get('file_path', '')
    
    room_id = generate_room_id(sender, recipient)
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    with sqlite3.connect('messages.db') as con:
        cur = con.cursor()
        cur.execute('''
            INSERT INTO messages (room_id, sender, message, message_type, file_path) 
            VALUES (?, ?, ?, ?, ?)
        ''', (room_id, sender, message, message_type, file_path))
        
        # Обновляем информацию о комнате
        cur.execute('''
            INSERT OR REPLACE INTO chat_rooms (room_id, user1, user2, last_message, last_message_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (room_id, sender, recipient, message, timestamp))
        
        con.commit()
    
    # Отправляем сообщение получателю
    emit('receive_message', {
        'sender': sender, 
        'message': message, 
        'type': message_type,
        'file_path': file_path,
        'timestamp': timestamp
    }, room=users_online.get(recipient))

@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Универсальная загрузка файлов."""
    file = request.files.get('file')
    message_type = request.form.get('type', 'file')
    recipient = request.form.get('recipient')
    
    if file:
        # Генерируем уникальное имя файла
        filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        return jsonify({
            'file_path': f"/uploads/{filename}",
            'original_name': file.filename,
            'type': message_type
        })
    
    return jsonify({'error': 'No file uploaded'}), 400

@socketio.on('connect')
def handle_connect():
    """Обработка подключения пользователя."""
    if current_user.is_authenticated:
        users_online[current_user.username] = request.sid
        emit('user_online', {'username': current_user.username}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    """Обработка отключения пользователя."""
    if current_user.is_authenticated:
        username = current_user.username
        if username in users_online:
            del users_online[username]
        emit('user_offline', {'username': username}, broadcast=True)

@chat_bp.route('/uploads/<filename>')
def uploaded_file(filename):
    """Безопасная выдача загруженных файлов."""
    return send_from_directory(UPLOAD_FOLDER, filename)