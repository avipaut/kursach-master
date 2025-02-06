from flask import Flask, redirect, url_for, request
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_login import LoginManager, current_user
import os

from routes.documents import documents_bp
from routes.chat import chat_bp, socketio
from routes.zoom import zoom_bp
from routes.reports import reports_bp
from routes.kpi import kpi_bp
from routes.auth import auth_bp, init_login_manager
from routes.models import db

# Инициализация Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes
socketio.init_app(app, cors_allowed_origins="*")

# Настройки базы данных
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///your_database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Инициализация базы данных
db.init_app(app)

# Инициализация LoginManager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# Передаём login_manager в auth.py
init_login_manager(login_manager)

# Регистрация Blueprints
app.register_blueprint(documents_bp, url_prefix='/documents')
app.register_blueprint(chat_bp, url_prefix='/chat')
app.register_blueprint(zoom_bp, url_prefix='/zoom')
app.register_blueprint(reports_bp, url_prefix='/reports')
app.register_blueprint(kpi_bp, url_prefix='/kpi')
app.register_blueprint(auth_bp, url_prefix='/auth')


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

UPLOAD_FOLDER = "uploaded_documents"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.secret_key = 'your_secret_key_here'
@app.before_request
def create_tables():
    db.create_all()
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)