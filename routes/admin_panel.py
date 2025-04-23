from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash
from datetime import datetime
from .models import db, User, Role, roles_users
from .models import UserForm, RoleForm

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Вспомогательные функции
def get_user_roles(user):
    return [role.name for role in user.roles]

def user_has_role(user, role_name):
    return any(role.name == role_name for role in user.roles)

# Основные маршруты админ-панели
@admin_bp.route('/dashboard')
@login_required
def dashboard():
    if not user_has_role(current_user, 'admin'):
        flash('Доступ запрещен: требуется роль администратора', 'danger')
        return redirect(url_for('main.index'))
    
    # Статистика для дашборда
    total_users = User.query.count()
    active_users = User.query.filter_by(active=True).count()
    admin_users = db.session.query(User).join(roles_users).join(Role).filter(Role.name == 'admin').count()
    total_roles = Role.query.count()
    
    return render_template('admin/dashboard.html',
                         total_users=total_users,
                         active_users=active_users,
                         admin_users=admin_users,
                         total_roles=total_roles)

@admin_bp.route('/users')
@login_required
def user_management():
    if not user_has_role(current_user, 'admin'):
        flash('Доступ запрещен: требуется роль администратора', 'danger')
        return redirect(url_for('main.index'))
    
    users = User.query.all()
    roles = Role.query.all()
    
    return render_template('dashboard/admin_panel.html',  # или ваш шаблон
                         users=users, 
                         roles=roles,
                         current_user=current_user,
                         now=datetime.now())  # Добавляем текущее время

# API для управления пользователями
@admin_bp.route('/api/users', methods=['GET'])
@login_required
def get_users_api():
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    users = User.query.all()
    users_data = [{
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'active': user.active,
        'is_admin': user_has_role(user, 'admin'),
        'roles': get_user_roles(user),
        'avatar': user.avatar,
        'created_at': user.created_at.isoformat() if user.created_at else None
    } for user in users]
    
    return jsonify(users_data)

@admin_bp.route('/api/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def user_api(user_id):
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    user = User.query.get_or_404(user_id)
    
    if request.method == 'GET':
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'active': user.active,
            'roles': get_user_roles(user),
            'avatar': user.avatar
        })
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        # Обновление основных данных
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        if 'active' in data:
            user.active = data['active']
        
        # Обновление ролей
        if 'roles' in data:
            new_roles = Role.query.filter(Role.name.in_(data['roles'])).all()
            user.roles = new_roles
        
        db.session.commit()
        return jsonify({'message': 'Пользователь обновлен'})
    
    elif request.method == 'DELETE':
        # Нельзя удалить себя
        if user.id == current_user.id:
            return jsonify({'error': 'Нельзя удалить самого себя'}), 400
        
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'Пользователь удален'})

@admin_bp.route('/api/users', methods=['POST'])
@login_required
def create_user_api():
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    
    # Проверка обязательных полей
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Необходимы имя пользователя и пароль'}), 400
    
    # Проверка на существующего пользователя
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Пользователь с таким именем уже существует'}), 400
    
    # Создание пользователя
    user = User(
        username=data['username'],
        email=data.get('email'),
        password=generate_password_hash(data['password']),
        active=data.get('active', True),
        created_at=datetime.utcnow()
    )
    
    # Добавление ролей
    if 'roles' in data:
        roles = Role.query.filter(Role.name.in_(data['roles'])).all()
        user.roles = roles
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'Пользователь создан',
        'user_id': user.id
    }), 201

# Управление ролями
@admin_bp.route('/api/roles', methods=['GET', 'POST'])
@login_required
def roles_api():
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    if request.method == 'GET':
        roles = Role.query.all()
        roles_data = [{
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'user_count': len(role.users)
        } for role in roles]
        return jsonify(roles_data)
    
    elif request.method == 'POST':
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Необходимо указать название роли'}), 400
        
        if Role.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Роль с таким названием уже существует'}), 400
        
        role = Role(
            name=data['name'],
            description=data.get('description')
        )
        
        db.session.add(role)
        db.session.commit()
        
        return jsonify({
            'message': 'Роль создана',
            'role_id': role.id
        }), 201

@admin_bp.route('/api/roles/<int:role_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def role_api(role_id):
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    role = Role.query.get_or_404(role_id)
    
    if request.method == 'GET':
        return jsonify({
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'users': [user.username for user in role.users]
        })
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        if 'name' in data:
            # Проверка на уникальность имени
            if Role.query.filter(Role.name == data['name'], Role.id != role.id).first():
                return jsonify({'error': 'Роль с таким названием уже существует'}), 400
            role.name = data['name']
        
        if 'description' in data:
            role.description = data['description']
        
        db.session.commit()
        return jsonify({'message': 'Роль обновлена'})
    
    elif request.method == 'DELETE':
        # Нельзя удалить базовые роли
        if role.name in ['admin', 'user']:
            return jsonify({'error': 'Нельзя удалить системную роль'}), 400
        
        db.session.delete(role)
        db.session.commit()
        return jsonify({'message': 'Роль удалена'})

# Дополнительные маршруты
@admin_bp.route('/users/<int:user_id>/toggle-active', methods=['POST'])
@login_required
def toggle_user_active(user_id):
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    user = User.query.get_or_404(user_id)
    
    # Нельзя деактивировать себя
    if user.id == current_user.id:
        return jsonify({'error': 'Нельзя деактивировать самого себя'}), 400
    
    try:
        user.active = not user.active
        db.session.commit()
        return jsonify({
            'message': f'Пользователь {"активирован" if user.active else "деактивирован"}',
            'active': user.active
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
def reset_user_password(user_id):
    if not user_has_role(current_user, 'admin'):
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    if not data.get('new_password'):
        return jsonify({'error': 'Необходимо указать новый пароль'}), 400
    
    user = User.query.get_or_404(user_id)
    user.password = generate_password_hash(data['new_password'])
    db.session.commit()
    
    return jsonify({'message': 'Пароль пользователя изменен'})

@admin_bp.route('/users/delete', methods=['POST'])
@login_required
def delete_user():
    if not user_has_role(current_user, 'admin'):
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    user_id = request.form.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Не указан ID пользователя'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
    
    # Нельзя удалить себя
    if user.id == current_user.id:
        return jsonify({'success': False, 'error': 'Нельзя удалить самого себя'}), 400
    
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
@admin_bp.route('/users/<int:user_id>/reset_password', methods=['POST'])
@login_required
def reset_password(user_id):
    if not user_has_role(current_user, 'admin'):
        flash('Доступ запрещен: требуется роль администратора', 'danger')
        return redirect(url_for('admin.user_management'))
    
    user = User.query.get_or_404(user_id)
    new_password = request.form.get('new_password')
    
    if not new_password or len(new_password) < 6:
        flash('Пароль должен содержать не менее 6 символов', 'danger')
        return redirect(url_for('admin.user_management'))
    
    try:
        user.password = generate_password_hash(new_password)
        db.session.commit()
        flash('Пароль пользователя успешно изменен', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Ошибка при изменении пароля: {str(e)}', 'danger')
    
    return redirect(url_for('admin.user_management'))
@admin_bp.route('/users/<int:user_id>/edit', methods=['POST'])
@login_required
def edit_user(user_id):
    if not user_has_role(current_user, 'admin'):
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
    
    user = User.query.get_or_404(user_id)
    
    try:
        # Обновляем основные данные
        user.username = request.form.get('username')
        user.email = request.form.get('email')
        user.active = request.form.get('active') == 'on'
        
        # Обновляем роли
        selected_role_ids = request.form.getlist('roles')
        selected_roles = Role.query.filter(Role.id.in_(selected_role_ids)).all()
        user.roles = selected_roles
        
        # Если указан новый пароль
        if request.form.get('password'):
            user.password = generate_password_hash(request.form.get('password'))
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500