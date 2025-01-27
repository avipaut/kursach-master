from flask import Blueprint, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import sqlite3

chat_bp = Blueprint('chat', __name__)
socketio = SocketIO()

# Функции для работы с базой данных
def get_users():
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('SELECT id, username, room FROM users')
        return cur.fetchall()

def get_rooms():
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('SELECT DISTINCT room FROM users WHERE room IS NOT NULL')
        return cur.fetchall()

def get_messages(room):
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('SELECT username, message, timestamp FROM messages WHERE room = ? ORDER BY timestamp', (room,))
        return cur.fetchall()

def add_user(username, room):
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('INSERT INTO users (username, room) VALUES (?, ?)', (username, room))
        con.commit()

def remove_user(username):
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('DELETE FROM users WHERE username = ?', (username,))
        con.commit()

def save_message(username, message, room):
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('INSERT INTO messages (message, username, room) VALUES (?, ?, ?)', (message, username, room))
        con.commit()

# Роут для чата
@chat_bp.route('/', methods=['GET', 'POST'])
def chat():
    if request.method == 'POST':
        username = request.form['username']
        room = request.form['room']
        add_user(username, room)
        session['username'] = username
        session['room'] = room
        return redirect('/chat')

    users = get_users()
    rooms = get_rooms()
    return render_template('chat.html', users=users, rooms=rooms)

@chat_bp.route('/leave', methods=['POST'])
def leave_room_route():
    username = session.get('username')
    if username:
        remove_user(username)
        session.pop('username', None)
        session.pop('room', None)
    return redirect('/chat')

@chat_bp.route('/room/<room_name>', methods=['GET'])
def room_history(room_name):
    messages = get_messages(room_name)
    return render_template('room_history.html', room_name=room_name, messages=messages)

@socketio.on('send_message')
def handle_message(data):
    if 'message' in data and 'username' in data and 'room' in data:
        print(f"Message received: {data['message']} from {data['username']} in room {data['room']}")
        save_message(data['username'], data['message'], data['room'])  # Сохраняем сообщение в БД
        emit('receive_message', data, room=data['room'])

@socketio.on('join_room')
def handle_join(data):
    username = session.get('username')
    if username:
        room = data['room']
        join_room(room)
        print(f"{username} has joined room {room}")
