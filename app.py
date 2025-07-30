from flask import Flask, redirect, url_for, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_migrate import Migrate
from datetime import timedelta
from functools import wraps
from routes.models import Role, User
from werkzeug.security import generate_password_hash
from prometheus_flask_exporter import PrometheusMetrics  # Для HTTP-метрик
from prometheus_client import Counter  # Для пользовательских метрик
import os

# Инициализация Flask и SocketIO
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO()
socketio.init_app(app, async_mode="eventlet", cors_allowed_origins="*", ping_timeout=5, ping_interval=25)
app.socketio = socketio

# Инициализация Prometheus
metrics = PrometheusMetrics(app, defaults_prefix='lms')

# Пользовательские метрики
kpi_template_saves = Counter('lms_kpi_template_saves_total', 'Total KPI template saves', ['endpoint'])
websocket_connections = Counter('lms_websocket_connections_total', 'Total WebSocket connections', ['event'])
notification_sends = Counter('lms_notification_sends_total', 'Total notifications sent', ['user_id'])

# Импорты blueprints
from routes.documents import documents_bp
from routes.chat import chat_bp, init_socketio
from routes.calendar import calendar_bp
from routes.reports import reports_bp
from routes.dashboard import dashboard_bp
from routes.kpi import kpi_bp
from routes.auth import auth_bp, init_login_manager
from routes.models import db, User, Role
from routes.kanban import kanban_bp
from routes.trash import trash_bp
from routes.notifications import notifications_bp, add_notification
from routes.admin_panel import admin_bp
from routes.profile import profile_bp
from routes.card_assignment import card_assignment_bp, init_card_assignment_db

# Настройки приложения
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///main.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'connect_args': {'timeout': 15, 'check_same_thread': False}
}
app.config['SECRET_KEY'] = 'your_secret_key_here'
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=14)
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=14)

# Инициализация LoginManager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.session_protection = "strong"

@login_manager.user_loader
def load_user(user_id):
    print(f"Loading user with ID: {user_id}")
    user = User.query.get(int(user_id))
    print(f"Loaded user: {user}")
    return user

# Инициализация базы данных и SocketIO
db.init_app(app)
migrate = Migrate(app, db)
init_login_manager(login_manager)
init_socketio(socketio)

# WebSocket handlers с метриками
@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        join_room(f'user_{current_user.id}')
        websocket_connections.labels(event='connect').inc()
        print(f'User {current_user.id} connected to WebSocket')
    else:
        return False

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        websocket_connections.labels(event='disconnect').inc()
        print(f'User {current_user.id} disconnected from WebSocket')

@socketio.on('join_user_room')
def handle_join_user_room(data):
    if current_user.is_authenticated:
        user_id = data.get('user_id')
        if str(user_id) == str(current_user.id):
            room_name = f'user_{user_id}'
            join_room(room_name)
            websocket_connections.labels(event='join_room').inc()
            print(f"User {user_id} joined their notification room: {room_name}")

# Декоратор для отслеживания уведомлений
def track_notification(func):
    @wraps(func)
    def wrapper(user_id, *args, **kwargs):
        result = func(user_id, *args, **kwargs)
        notification_sends.labels(user_id=user_id).inc()
        return result
    return wrapper

# Применение декоратора к add_notification
notifications_bp.add_notification = track_notification(add_notification)

# Создание начальных ролей и админа
def create_initial_roles_and_admin():
    roles = {
        'admin': 'Администратор с полными правами',
        'user': 'Обычный пользователь'
    }
    for role_name, description in roles.items():
        if not Role.query.filter_by(name=role_name).first():
            role = Role(name=role_name, description=description)
            db.session.add(role)
    if not User.query.filter_by(username='admin').first():
        admin = User(
            username='admin',
            password=generate_password_hash('123'),
            email='admin@example.com',
            active=True,
            fs_uniquifier=os.urandom(16).hex()
        )
        admin_role = Role.query.filter_by(name='admin').first()
        if admin_role:
            admin.roles.append(admin_role)
        db.session.add(admin)
    db.session.commit()

# Декораторы для ролей
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
app.register_blueprint(calendar_bp, url_prefix='/calendar')
app.register_blueprint(reports_bp, url_prefix='/reports')
app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
app.register_blueprint(kpi_bp, url_prefix='/kpi')
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(kanban_bp, url_prefix='/kanban')
app.register_blueprint(trash_bp, url_prefix='/trash')
app.register_blueprint(notifications_bp, url_prefix='/notifications')
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(profile_bp)
app.register_blueprint(card_assignment_bp, url_prefix='/kanban')

@app.route('/')
def index():
    return redirect(url_for('auth.login'))

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

@app.before_request
def check_login():
    open_paths = ['/login', '/auth/login', '/static', '/', '/test-session']
    if request.path.startswith('/static/') or any(request.path.startswith(path) for path in open_paths):
        return None
    if not current_user.is_authenticated:
        print(f"Redirecting unauthenticated user from {request.path} to login")
        return redirect('/login')

# Инициализация
with app.app_context():
    db.create_all()
    create_initial_roles_and_admin()
    init_card_assignment_db()

# Создание директорий
UPLOAD_FOLDER = "uploaded_documents"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
AVATAR_FOLDER = os.path.join(app.static_folder, 'Uploads', 'avatars')
os.makedirs(AVATAR_FOLDER, exist_ok=True)

# Сброс пароля админа
with app.app_context():
    admin = User.query.filter_by(username='admin').first()
    if admin:
        admin.password = generate_password_hash('123')
        db.session.commit()
        print(f"Пароль для пользователя {admin.username} сброшен на: 123")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)