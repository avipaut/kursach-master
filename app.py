# app.py

from flask import Flask, redirect, url_for, request
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_login import LoginManager, current_user
import os
from flask_migrate import Migrate
from flask_security import Security, SQLAlchemyUserDatastore
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



# Инициализация Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes
socketio.init_app(app, cors_allowed_origins="*")  # Теперь init_app() вызовется корректно

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
app.config['SECURITY_PASSWORD_SALT'] = 'your_security_salt'
app.config['SECURITY_UNAUTHORIZED_VIEW'] = 'auth.login'

# Инициализация LoginManager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# Инициализация базы данных
db.init_app(app)
migrate = Migrate(app, db)
# Передаём login_manager в auth.py
init_login_manager(login_manager)

# Настройка Flask-Security
user_datastore = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_datastore)

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
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(kanban_bp, url_prefix='/kanban')  # Регистрируем его
app.register_blueprint(trash_bp, url_prefix='/trash')


# Главный маршрут
@app.route('/')
def index():
    return redirect(url_for('auth.login'))

# Глобальная защита маршрутов
@app.before_request
def check_login():
    open_routes = [
        'auth.login', 
        'auth.register', 
        'static',  # Разрешить доступ к статическим файлам
    ]
    if not current_user.is_authenticated and request.endpoint not in open_routes:
        return redirect(url_for('auth.login'))

# Функция для создания начальных данных
def create_initial_data():
    db.create_all()
    
    # Создание ролей
    if not user_datastore.find_role("admin"):
        user_datastore.create_role(name="admin", description="Администратор с полным доступом")

    if not user_datastore.find_role("user"):
        user_datastore.create_role(name="user", description="Обычный пользователь")

    # Создание пользователя-администратора, если он не существует
    if not user_datastore.find_user(username="admin"):
        admin_user = user_datastore.create_user(
            username="admin",
            email="admin@example.com",
            password="123",  # В реальном проекте используйте хешированный пароль
            # fs_uniquifier=os.urandom(16).hex()  # Добавляем fs_uniquifier
        )
        user_datastore.add_role_to_user(admin_user, "admin")
        
    db.session.commit()

UPLOAD_FOLDER = "uploaded_documents"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.before_request
def before_request():
    db.create_all()
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

# Вызываем функции инициализации в контексте приложения
with app.app_context():
    create_initial_roles_and_admin()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
