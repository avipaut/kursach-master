# app.py

from flask import Flask, redirect, url_for, request, session
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_login import LoginManager, current_user
import os
from flask_migrate import Migrate
from datetime import timedelta  # Для установки времени жизни сессии
from functools import wraps
from routes.models import Role, User
from werkzeug.security import generate_password_hash


from routes.documents import documents_bp
from routes.chat import chat_bp, socketio
from routes.zoom import zoom_bp
from routes.reports import reports_bp
from routes.kpi import kpi_bp
from routes.auth import auth_bp, init_login_manager
from routes.models import db, User, Role
from routes.kanban import kanban_bp  # Импортируем Kanban Blueprint
from routes.trash import trash_bp
from routes.notifications import notifications_bp, add_notification



# Инициализация Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes
socketio.init_app(app, async_mode="eventlet", cors_allowed_origins="*", ping_timeout=5, ping_interval=25)
# # Настройка приложения
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///main.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'connect_args': {'timeout': 15, 'check_same_thread': False}
}

# Настройка Flask-Security
app.config['SECRET_KEY'] = 'your_secret_key_here'

# Настройка сессии для Flask-Login
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=14)  # Устанавливаем длительное время жизни cookie
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=14)

# Инициализация LoginManager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.session_protection = "strong"  # Усиленная защита сессии

# Пользовательская функция загрузки пользователя
@login_manager.user_loader
def load_user(user_id):
    print(f"Loading user with ID: {user_id}")
    user = User.query.get(int(user_id))
    print(f"Loaded user: {user}")
    return user

# Инициализация базы данных
db.init_app(app)
migrate = Migrate(app, db)
# Передаём login_manager в auth.py
init_login_manager(login_manager)

# Функция для создания начальных ролей и админа
def create_initial_roles_and_admin():
    # Создание базовых ролей, если их нет
    roles = {
        'admin': 'Администратор с полными правами',
        'user': 'Обычный пользователь'
    }
    
    for role_name, description in roles.items():
        if not Role.query.filter_by(name=role_name).first():
            role = Role(name=role_name, description=description)
            db.session.add(role)
    
    # Создание пользователя-администратора, если его нет
    if not User.query.filter_by(username='admin').first():
        admin = User(
            username='admin',
            password=generate_password_hash('admin'),  # В реальном проекте используйте безопасный пароль
            email='admin@example.com',
            active=True,
            fs_uniquifier=os.urandom(16).hex()  # Добавляем fs_uniquifier
        )
        
        # Добавляем роль админа
        admin_role = Role.query.filter_by(name='admin').first()
        if admin_role:
            admin.roles.append(admin_role)
            
        db.session.add(admin)
    
    db.session.commit()

# Декораторы для проверки ролей
def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated or not current_user.has_role(role):
                return redirect(url_for('auth.login'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    return role_required('admin')(f)

# Регистрация Blueprints
app.register_blueprint(documents_bp, url_prefix='/documents')
app.register_blueprint(chat_bp, url_prefix='/chat')
app.register_blueprint(zoom_bp, url_prefix='/zoom')
app.register_blueprint(reports_bp, url_prefix='/reports')
app.register_blueprint(kpi_bp, url_prefix='/kpi')
app.register_blueprint(auth_bp, url_prefix='/auth')  # Без url_prefix
app.register_blueprint(kanban_bp, url_prefix='/kanban')  # Без url_prefix
app.register_blueprint(trash_bp, url_prefix='/trash')
app.register_blueprint(notifications_bp, url_prefix='/notifications')

# Главный маршрут
@app.route('/')
def index():
    return redirect(url_for('auth.login'))

# Тестовый маршрут для проверки сессии
@app.route('/test-session')
def test_session():
    return f"""
    <h1>Информация о сессии</h1>
    <p>Пользователь аутентифицирован: {current_user.is_authenticated}</p>
    <p>ID пользователя: {current_user.id if current_user.is_authenticated else 'None'}</p>
    <p>Имя пользователя: {current_user.username if current_user.is_authenticated else 'None'}</p>
    <p>Session: {session}</p>
    <a href="/login">Войти</a> | <a href="/logout">Выйти</a> | <a href="/kanban">Канбан</a>
    """

# Глобальная защита маршрутов
@app.before_request
def check_login():
    # Список путей, доступных без аутентификации
    open_paths = [
        '/login',
        '/register',
        '/auth/login',
        '/auth/register',
        '/static',
        '/',
        '/test-session'
    ]
    
    # Печать для отладки
    print(f"Processing request: {request.path}")
    print(f"Current user: {current_user}, authenticated: {current_user.is_authenticated}")
    
    # Разрешаем доступ к статическим файлам
    if request.path.startswith('/static/'):
        return None
        
    # Разрешаем доступ к открытым путям
    for path in open_paths:
        if request.path.startswith(path):
            return None
        
    # Если пользователь не аутентифицирован, перенаправляем на логин
    if not current_user.is_authenticated:
        print(f"Redirecting unauthenticated user from {request.path} to login")
        return redirect('/login')

# Вызываем функции инициализации в контексте приложения
with app.app_context():
    db.create_all()
    create_initial_roles_and_admin()

UPLOAD_FOLDER = "uploaded_documents"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

with app.app_context():
    admin = User.query.filter_by(username='admin').first()
    if admin:
        # Сбросить пароль на '123'
        admin.password = generate_password_hash('123')
        # Также убедимся, что пользователь - администратор
        admin.is_admin = True
        db.session.commit()
        print(f"Пароль для пользователя {admin.username} сброшен на: 123")
        print(f"Пользователь {admin.username} теперь администратор: {getattr(admin, 'is_admin', False)}")
    else:
        print("Пользователь admin не найден")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)