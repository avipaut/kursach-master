from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from routes.models import db, User  # Импортируем User из models.py
from contextlib import contextmanager

auth_bp = Blueprint('auth', __name__)

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
@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        with session_scope() as session:
            if User.query.filter_by(username=username).first():
                flash('Имя пользователя уже занято!', 'danger')
                return redirect(url_for('auth.register'))
                
            user = User(username=username, password=generate_password_hash(password))
            session.add(user)
            
        flash('Регистрация прошла успешно! Войдите в систему.', 'success')
        return redirect(url_for('auth.login'))
        
    return render_template('register.html')
from routes.models import db, User  # Импортируй свою модель




@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            flash('Вы успешно вошли!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('auth.protected'))
            
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
