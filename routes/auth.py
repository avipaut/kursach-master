from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

auth_bp = Blueprint('auth', __name__)

# Глобальная переменная login_manager
login_manager = None

def init_login_manager(manager):
    global login_manager
    login_manager = manager

    # Устанавливаем загрузчик пользователя после инициализации login_manager
    @login_manager.user_loader
    def load_user(user_id):
        return User.get(user_id)

# === Инициализация базы данных ===
def init_db():
    with sqlite3.connect('users.db') as con:
        cur = con.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )''')
        con.commit()

init_db()

# === Класс пользователя ===
class User(UserMixin):
    def __init__(self, id_, username):
        self.id = id_
        self.username = username

    @staticmethod
    def get(user_id):
        with sqlite3.connect('users.db') as con:
            cur = con.cursor()
            cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
            user = cur.fetchone()
            if user:
                return User(user[0], user[1])
        return None

    @staticmethod
    def get_by_username(username):
        with sqlite3.connect('users.db') as con:
            cur = con.cursor()
            cur.execute("SELECT id, username, password FROM users WHERE username = ?", (username,))
            user = cur.fetchone()
            if user:
                return User(user[0], user[1]), user[2]
        return None, None

    def get_id(self):
        return str(self.id)  # Flask-Login требует строковый ID

# === Регистрация ===
@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        hashed_password = generate_password_hash(password)

        try:
            with sqlite3.connect('users.db') as con:
                cur = con.cursor()
                cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
                con.commit()
                flash('Регистрация прошла успешно! Войдите в систему.', 'success')
                return redirect(url_for('auth.login'))
        except sqlite3.IntegrityError:
            flash('Имя пользователя уже занято!', 'danger')

    return render_template('register.html')

# === Авторизация ===
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user, stored_password = User.get_by_username(username)
        if user and check_password_hash(stored_password, password):
            login_user(user)  # Авторизация пользователя
            flash('Вы успешно вошли!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('auth.protected'))
        else:
            flash('Неверное имя пользователя или пароль!', 'danger')

    return render_template('login.html')

# === Выход ===
@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы.', 'success')
    return redirect(url_for('auth.login'))

# === Защищённая страница ===
@auth_bp.route('/protected')
@login_required
def protected():
    return render_template('chat.html', username=current_user.username)
