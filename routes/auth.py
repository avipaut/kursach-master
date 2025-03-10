# auth.py

import uuid
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_security import roles_required, roles_accepted
from routes.models import db, User, Role  # Добавил импорт Role
from contextlib import contextmanager
from functools import wraps  # Important import for preserving function names

auth_bp = Blueprint('auth', __name__)
login_manager = None

def init_login_manager(manager):
    global login_manager
    login_manager = manager

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

@contextmanager
def session_scope():
    try:
        yield db.session
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise e
    finally:
        db.session.close()
        
# Вспомогательная функция для проверки ролей
def check_role(role_name):
    """Проверяет, имеет ли текущий пользователь указанную роль"""
    if not current_user.is_authenticated:
        return False
    return role_name in [role.name for role in current_user.roles]

# Декоратор для проверки роли
def role_required(role_name):
    def decorator(f):
        @wraps(f)  # This preserves the original function name and metadata
        @login_required
        def decorated_function(*args, **kwargs):
            if not check_role(role_name):
                flash(f'Доступ запрещен. Требуется роль: {role_name}', 'danger')
                return redirect(url_for('auth.login'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']  # Получаем email из формы
        password = request.form['password']
        
        with session_scope() as session:
            # Проверяем, существует ли пользователь с таким именем или email
            if User.query.filter_by(username=username).first():
                flash('Имя пользователя уже занято!', 'danger')
                return redirect(url_for('auth.register'))
                
            # Создаем пользователя
            user = User(
                username=username, 
                password=generate_password_hash(password),
                email=request.form.get('email', ''),  # Опциональное поле
                active=True,
                fs_uniquifier=uuid.uuid4().hex  # Безопаснее
  # Add fs_uniquifier here
            )
            
            # Добавляем роль "user" по умолчанию
            user_role = Role.query.filter_by(name='user').first()
            if user_role:
                user.roles.append(user_role)
            else:
                # Если роли еще не созданы, создаем их
                default_role = Role(name='user', description='Обычный пользователь')
                db.session.add(default_role)
                db.session.commit()  # Коммит перед использованием
                user.roles.append(default_role)
                
            session.add(user)
            
        flash('Регистрация прошла успешно! Войдите в систему.', 'success')
        return redirect(url_for('auth.login'))
        
    return render_template('register.html')


# from models import db, User  # Импортируй свою модель
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    print("Login route accessed. Method:", request.method)
    if request.method == 'POST':
        username_or_email = request.form['username']
        password = request.form['password']
        
        print(f"Attempting login for user: {username_or_email}")
        
        user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
        
        if user:
            print(f"User found: {user.username}")
            password_check = check_password_hash(user.password, password)
            print(f"Password check: {password_check}")
            
            if password_check:
                # Важно включить remember=True
                login_user(user, remember=True)
                
                from flask import session
                session.permanent = True  # Сделать сессию постоянной
                
                print(f"User {user.username} logged in successfully")
                print(f"Is authenticated after login: {current_user.is_authenticated}")
                print(f"Current user ID: {current_user.id}")
                print(f"Session data: {session}")
                
                # Простое перенаправление без url_for
                if hasattr(user, 'is_admin') and user.is_admin:
                    return redirect(url_for('auth.admin_panel'))           
                else:
                    return redirect(url_for('kanban.kanban_board'))        
                
        else:
            print("User not found")
            
        flash('Неверное имя пользователя/email или пароль!', 'danger')
    
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

# === Админ-панель (только для администраторов) ===
from datetime import datetime

@auth_bp.route('/admin')
@role_required('admin')
def admin_panel():
    users = User.query.all()
    roles = Role.query.all()
    # Добавляем текущую дату и время
    return render_template('admin_panel.html', users=users, roles=roles, now=datetime.now())

# === Получение всех пользователей (JSON, только для админов) ===
@auth_bp.route('/users')
@role_required('admin')  # This now includes login_required
def get_users():
    users = User.query.all()
    user_list = [user.to_dict() for user in users]
    return jsonify(user_list)

# === Изменение ролей пользователя (только для админов) ===
@auth_bp.route('/users/<int:user_id>/roles', methods=['POST'])
@role_required('admin')  # This now includes login_required
def update_user_roles(user_id):
    user = User.query.get_or_404(user_id)
    role_ids = request.form.getlist('roles[]')
    
    # Очистить текущие роли пользователя
    user.roles = []

    # Добавить выбранные роли
    for role_id in role_ids:
        role = Role.query.get(int(role_id))
        if role:
            user.roles.append(role)
    
    db.session.commit()  # Добавляем коммит!

    flash(f'Роли пользователя {user.username} обновлены', 'success')
    return redirect(url_for('auth.admin_panel'))

# === Создание новой роли (только для админов) ===
@auth_bp.route('/roles', methods=['POST'])
@role_required('admin')  # This now includes login_required
def create_role():
    name = request.form.get('name')
    description = request.form.get('description')
    
    if not name:
        flash('Название роли не может быть пустым', 'danger')
        return redirect(url_for('auth.admin_panel'))
        
    with session_scope() as session:
        if Role.query.filter_by(name=name).first():
            flash('Роль с таким названием уже существует', 'danger')
        else:
            new_role = Role(name=name, description=description)
            session.add(new_role)
            flash('Роль успешно создана', 'success')
    
    return redirect(url_for('auth.admin_panel'))