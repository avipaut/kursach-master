# routes/profile.py

from flask import Blueprint, render_template, current_app, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import json
from routes.models import db, User
from routes.notifications import add_notification

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/profile')
@login_required
def profile_page():
    return render_template('dashboard/profile.html',
                          title='Профиль пользователя',
                          active_page='profile')

@profile_bp.route('/profile/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        flash('Файл не выбран', 'danger')
        return redirect(url_for('profile.profile_page'))
    
    file = request.files['avatar']
    
    if file.filename == '':
        flash('Файл не выбран', 'danger')
        return redirect(url_for('profile.profile_page'))
    
    if file:
        # Создаем директорию, если она не существует
        avatar_folder = os.path.join(current_app.static_folder, 'uploads', 'avatars')
        os.makedirs(avatar_folder, exist_ok=True)
        
        # Если у пользователя уже есть аватар, удаляем его
        if current_user.avatar and os.path.exists(os.path.join(current_app.static_folder, current_user.avatar.lstrip('/'))):
            os.remove(os.path.join(current_app.static_folder, current_user.avatar.lstrip('/')))
        
        # Сохраняем новый файл
        filename = secure_filename(f"avatar_{current_user.id}_{file.filename}")
        file_path = os.path.join(avatar_folder, filename)
        file.save(file_path)
        
        # Обновляем путь к аватару в базе данных
        avatar_url = f"/static/uploads/avatars/{filename}"
        current_user.avatar = avatar_url
        db.session.commit()
        
        add_notification(current_user.id, "Аватар успешно обновлен", category="success")
        flash('Аватар успешно обновлен', 'success')
    
    return redirect(url_for('profile.profile_page'))

@profile_bp.route('/profile/remove_avatar', methods=['POST'])
@login_required
def remove_avatar():
    if current_user.avatar:
        # Удаляем файл аватара
        avatar_path = os.path.join(current_app.static_folder, current_user.avatar.lstrip('/'))
        if os.path.exists(avatar_path):
            os.remove(avatar_path)
        
        # Обновляем запись в базе данных
        current_user.avatar = None
        db.session.commit()
        
        add_notification(current_user.id, "Аватар успешно удален", category="success")
        flash('Аватар успешно удален', 'success')
    
    return redirect(url_for('profile.profile_page'))

@profile_bp.route('/profile/update_profile_info', methods=['POST'])
@login_required
def update_profile_info():
    # Получаем данные из формы
    phone = request.form.get('phone')
    department = request.form.get('department')
    building = request.form.get('building')
    faculty = request.form.get('faculty')
    
    # Обновляем данные пользователя
    user = User.query.get(current_user.id)
    user.phone = phone
    user.department = department
    user.building = building
    user.faculty = faculty
    
    db.session.commit()
    
    add_notification(current_user.id, "Информация профиля успешно обновлена", category="success")
    flash('Информация профиля успешно обновлена', 'success')
    return redirect(url_for('profile.profile_page'))

@profile_bp.route('/profile/change_password', methods=['POST'])
@login_required
def change_password():
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    # Проверяем текущий пароль
    user = User.query.get(current_user.id)
    if not check_password_hash(user.password, current_password):
        flash('Неверный текущий пароль', 'danger')
        return redirect(url_for('profile.profile_page'))
    
    # Проверяем совпадение новых паролей
    if new_password != confirm_password:
        flash('Пароли не совпадают', 'danger')
        return redirect(url_for('profile.profile_page'))
    
    # Обновляем пароль
    user.password = generate_password_hash(new_password)
    db.session.commit()
    
    add_notification(current_user.id, "Пароль успешно изменен", category="success")
    flash('Пароль успешно изменен', 'success')
    return redirect(url_for('profile.profile_page'))

@profile_bp.route('/profile/change_email', methods=['POST'])
@login_required
def change_email():
    email = request.form.get('email')
    
    # Проверяем, не занят ли email другим пользователем
    existing_user = User.query.filter_by(email=email).first()
    if existing_user and existing_user.id != current_user.id:
        flash('Этот email уже используется', 'danger')
        return redirect(url_for('profile.profile_page'))
    
    # Обновляем email
    user = User.query.get(current_user.id)
    user.email = email
    db.session.commit()
    
    add_notification(current_user.id, "Email успешно изменен", category="success")
    flash('Email успешно изменен', 'success')
    return redirect(url_for('profile.profile_page'))

@profile_bp.route('/profile/notification_settings', methods=['POST'])
@login_required
def notification_settings():
    # Получаем настройки уведомлений из формы
    message_notifications = 'message_notifications' in request.form
    task_notifications = 'task_notifications' in request.form
    meeting_notifications = 'meeting_notifications' in request.form
    
    # Здесь будет логика для сохранения настроек уведомлений в будущей реализации
    # Можно добавить таблицу NotificationSettings в базу данных
    
    flash('Настройки оповещений обновлены', 'success')
    return redirect(url_for('profile.profile_page'))

# API для сохранения настроек через AJAX
@profile_bp.route('/profile/api/save_theme', methods=['POST'])
@login_required
def save_theme():
    try:
        data = request.get_json()
        theme = data.get('theme', 'dark')
        
        # В будущем можно сохранять тему в базу данных
        # user = User.query.get(current_user.id)
        # user.theme_preference = theme
        # db.session.commit()
        
        return jsonify({'success': True, 'message': 'Тема успешно сохранена'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@profile_bp.route('/profile/api/save_background', methods=['POST'])
@login_required
def save_background():
    try:
        data = request.get_json()
        background_index = data.get('background_index', 0)
        
        # В будущем можно сохранять фон в базу данных
        # user = User.query.get(current_user.id)
        # user.background_preference = background_index
        # db.session.commit()
        
        return jsonify({'success': True, 'message': 'Фон успешно сохранен'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})