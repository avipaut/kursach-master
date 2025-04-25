from flask import Blueprint, render_template, request, send_file, flash, jsonify, url_for
from flask_login import login_required, current_user
from fpdf import FPDF
import os
import pandas as pd
from routes.models import db, Board, List, Card, Todo, User, PriorityLevel
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
from io import BytesIO
import base64
import numpy as np

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')
EXPORT_FOLDER = 'exports'
os.makedirs(EXPORT_FOLDER, exist_ok=True)

# === DASHBOARD И АНАЛИТИКА KANBAN ===

@dashboard_bp.route('/')
@login_required
def dashboard():
    # Проверяем права доступа
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    
    # Получаем общие статистические данные
    stats = get_kanban_statistics(is_admin)
    
    # Получаем список всех досок для выбора
    if is_admin:
        boards = Board.query.all()
    else:
        if hasattr(Board, 'admin_only'):
            boards = Board.query.filter(
                (Board.user_id == current_user.id) | (Board.admin_only == False)
            ).all()
        else:
            # Fallback if admin_only field doesn't exist
            boards = Board.query.filter_by(user_id=current_user.id).all()
    
    return render_template('reports/dashboard.html', stats=stats, is_admin=is_admin, boards=boards)

def get_kanban_statistics(is_admin=False, board_id=None):
    """Получить статистику по Kanban-доске с фильтрацией по board_id (если указан)"""
    stats = {}
    
    # Доски
    if is_admin:
        boards = Board.query.all() if board_id is None else [Board.query.get(board_id)]
    else:
        if hasattr(Board, 'admin_only'):
            if board_id is None:
                boards = Board.query.filter(
                    (Board.user_id == current_user.id) | (Board.admin_only == False)
                ).all()
            else:
                board = Board.query.get(board_id)
                # Проверяем имеет ли пользователь доступ к этой доске
                if board and (board.user_id == current_user.id or not board.admin_only):
                    boards = [board]
                else:
                    boards = []
        else:
            # Fallback if admin_only field doesn't exist
            if board_id is None:
                boards = Board.query.filter_by(user_id=current_user.id).all()
            else:
                board = Board.query.filter_by(id=board_id, user_id=current_user.id).first()
                boards = [board] if board else []
    
    stats['total_boards'] = len(boards)
    
    # Список досок для детализации
    stats['boards'] = [{'id': board.id, 'name': board.name} for board in boards]
    
    # Карточки
    all_cards = []
    for board in boards:
        lists = List.query.filter_by(board_id=board.id).all()
        for lst in lists:
            cards = Card.query.filter_by(list_id=lst.id).all()
            all_cards.extend(cards)
    
    stats['total_cards'] = len(all_cards)
    stats['completed_cards'] = sum(1 for card in all_cards if card.completed)
    stats['pending_cards'] = stats['total_cards'] - stats['completed_cards']
    
    if stats['total_cards'] > 0:
        stats['completion_rate'] = (stats['completed_cards'] / stats['total_cards']) * 100
    else:
        stats['completion_rate'] = 0
    
    # Приоритеты
    priorities = {}
    for priority in PriorityLevel:
        priorities[priority.name] = sum(1 for card in all_cards if hasattr(card, 'priority') and card.priority == priority)
    stats['priorities'] = priorities
    
    # Сроки выполнения
    today = datetime.now().date()
    
    stats['overdue'] = sum(1 for card in all_cards if 
                         hasattr(card, 'deadline') and card.deadline and 
                         card.deadline.date() < today and not card.completed)
    
    stats['due_today'] = sum(1 for card in all_cards if 
                          hasattr(card, 'deadline') and card.deadline and 
                          card.deadline.date() == today and not card.completed)
    
    stats['due_this_week'] = sum(1 for card in all_cards if 
                              hasattr(card, 'deadline') and card.deadline and 
                              today < card.deadline.date() <= today + timedelta(days=7) and 
                              not card.completed)
    
    # Задачи по пользователям
    users = User.query.all()
    user_tasks = {}
    for user in users:
        assigned = [card for card in all_cards if hasattr(card, 'assigned_to') and card.assigned_to == user.id]
        completed = [card for card in assigned if card.completed]
        
        user_tasks[user.username] = {
            'total': len(assigned),
            'completed': len(completed),
            'completion_rate': (len(completed) / len(assigned) * 100) if len(assigned) > 0 else 0
        }
    stats['user_tasks'] = user_tasks
    
    # Детальная информация о карточках для каждого показателя
    stats['cards_details'] = {
        'total': [{'id': card.id, 
                  'title': card.title, 
                  'list_name': List.query.get(card.list_id).name,
                  'board_name': Board.query.get(List.query.get(card.list_id).board_id).name,
                  'status': 'Завершено' if card.completed else 'В процессе',
                  'deadline': card.deadline.strftime('%Y-%m-%d') if hasattr(card, 'deadline') and card.deadline else 'Не указан',
                  'priority': card.priority.name if hasattr(card, 'priority') and card.priority else 'Не указан'} 
                 for card in all_cards],
        'completed': [{'id': card.id, 
                      'title': card.title, 
                      'list_name': List.query.get(card.list_id).name,
                      'board_name': Board.query.get(List.query.get(card.list_id).board_id).name,
                      'completed_at': card.completed_at.strftime('%Y-%m-%d') if hasattr(card, 'completed_at') and card.completed_at else 'Не указано',
                      'priority': card.priority.name if hasattr(card, 'priority') and card.priority else 'Не указан'} 
                     for card in all_cards if card.completed],
        'pending': [{'id': card.id, 
                    'title': card.title, 
                    'list_name': List.query.get(card.list_id).name,
                    'board_name': Board.query.get(List.query.get(card.list_id).board_id).name,
                    'deadline': card.deadline.strftime('%Y-%m-%d') if hasattr(card, 'deadline') and card.deadline else 'Не указан',
                    'priority': card.priority.name if hasattr(card, 'priority') and card.priority else 'Не указан'} 
                   for card in all_cards if not card.completed]
    }
    
    return stats

@dashboard_bp.route('/board/<int:board_id>')
@login_required
def board_statistics(board_id):
    """Страница статистики для конкретной доски"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    
    # Получаем статистику для указанной доски
    stats = get_kanban_statistics(is_admin, board_id)
    
    # Получаем информацию о доске
    board = Board.query.get_or_404(board_id)
    
    # Проверяем права доступа к доске
    if not is_admin and board.user_id != current_user.id:
        if hasattr(board, 'admin_only') and board.admin_only:
            flash('У вас нет доступа к этой доске', 'danger')
            return redirect(url_for('dashboard.dashboard'))
    
    return render_template('reports/board_statistics.html', stats=stats, board=board, is_admin=is_admin)

@dashboard_bp.route('/api/stats')
@login_required
def get_stats():
    """API для получения общей статистики или статистики по конкретной доске"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    board_id = request.args.get('board_id', type=int, default=None)
    
    stats = get_kanban_statistics(is_admin, board_id)
    return jsonify(stats)

@dashboard_bp.route('/api/stats/details')
@login_required
def get_stats_details():
    """API для получения детальной информации о конкретном показателе"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    board_id = request.args.get('board_id', type=int, default=None)
    stat_type = request.args.get('type', default='total')  # total, completed, pending, boards
    
    stats = get_kanban_statistics(is_admin, board_id)
    
    # Возвращаем детали в зависимости от запрошенного типа статистики
    if stat_type == 'boards':
        return jsonify({
            'title': 'Доски',
            'count': stats['total_boards'],
            'items': stats['boards']
        })
    elif stat_type in ['total', 'completed', 'pending']:
        return jsonify({
            'title': {
                'total': 'Все задачи',
                'completed': 'Выполненные задачи',
                'pending': 'Задачи в процессе'
            }[stat_type],
            'count': {
                'total': stats['total_cards'],
                'completed': stats['completed_cards'],
                'pending': stats['pending_cards']
            }[stat_type],
            'items': stats['cards_details'][stat_type]
        })
    else:
        return jsonify({'error': 'Неизвестный тип статистики'}), 400

@dashboard_bp.route('/charts/tasks-by-status')
@login_required
def tasks_by_status_chart():
    """API для получения данных о состоянии задач"""
    print("API вызван: tasks_by_status_chart")  # Добавить для отладки
    board_id = request.args.get('board_id', type=int, default=None)
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin, board_id)
    
    data = {
        'labels': ['Завершено', 'В процессе'],
        'datasets': [{
            'data': [stats['completed_cards'], stats['pending_cards']],
            'backgroundColor': ['#4caf50', '#ff9800']
        }]
    }
    
    print(f"Возвращаемые данные: {data}")  # Добавить для отладки
    return jsonify(data)

@dashboard_bp.route('/charts/tasks-by-priority')
@login_required
def tasks_by_priority_chart():
    """API для получения данных о приоритетах задач"""
    board_id = request.args.get('board_id', type=int, default=None)
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin, board_id)
    
    labels = list(stats['priorities'].keys())
    values = list(stats['priorities'].values())
    
    background_colors = []
    for priority in labels:
        if priority == 'HIGH':
            background_colors.append('#f44336')  # Красный для High
        elif priority == 'MEDIUM':
            background_colors.append('#ffc107')  # Желтый для Medium (используем ffс107 вместо ff9800)
        elif priority == 'LOW':
            background_colors.append('#4caf50')  # Зеленый для Low
        else:
            background_colors.append('#2196f3')  # Синий по умолчанию для других приоритетов
    
    data = {
        'labels': labels,
        'datasets': [{
            'data': values,
            'backgroundColor': background_colors  # Используем наш кастомный список цветов
        }]
    }
    
    return jsonify(data)

@dashboard_bp.route('/charts/tasks-by-user')
@login_required
def tasks_by_user_chart():
    """API для получения данных о задачах по пользователям"""
    board_id = request.args.get('board_id', type=int, default=None)
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin, board_id)
    
    # Фильтруем только пользователей с задачами
    filtered_user_tasks = {username: user_stats for username, user_stats in stats['user_tasks'].items() 
                          if user_stats['total'] > 0}
    
    users = list(filtered_user_tasks.keys())
    completed_tasks = [filtered_user_tasks[user]['completed'] for user in users]
    pending_tasks = [filtered_user_tasks[user]['total'] - filtered_user_tasks[user]['completed'] for user in users]
    
    data = {
        'labels': users,
        'datasets': [
            {
                'label': 'Завершено',
                'data': completed_tasks,
                'backgroundColor': '#4caf50'
            },
            {
                'label': 'В процессе',
                'data': pending_tasks,
                'backgroundColor': '#ff9800'
            }
        ]
    }
    
    return jsonify(data)

@dashboard_bp.route('/api/tasks/due-dates')
@login_required
def tasks_due_dates():
    """API для получения данных о сроках задач"""
    board_id = request.args.get('board_id', type=int, default=None)
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin, board_id)
    
    data = {
        'overdue': stats['overdue'],
        'due_today': stats['due_today'],
        'due_this_week': stats['due_this_week']
    }
    
    return jsonify(data)

@dashboard_bp.route('/reports/kanban/export')
@login_required
def export_kanban_report():
    """Экспорт отчёта по Kanban-доске в Excel"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    board_id = request.args.get('board_id', type=int, default=None)
    
    # Получаем доски
    if board_id:
        if is_admin:
            boards = [Board.query.get_or_404(board_id)]
        else:
            board = Board.query.get_or_404(board_id)
            if board.user_id == current_user.id or (hasattr(board, 'admin_only') and not board.admin_only):
                boards = [board]
            else:
                flash('У вас нет доступа к этой доске', 'danger')
                return redirect(url_for('dashboard.dashboard'))
    else:
        if is_admin:
            boards = Board.query.all()
        else:
            boards = Board.query.filter(
                (Board.user_id == current_user.id) | 
                (~hasattr(Board, 'admin_only') or Board.admin_only == False)
            ).all()
    
    # Формируем данные для отчета
    report_data = []
    
    for board in boards:
        lists = List.query.filter_by(board_id=board.id).all()
        for lst in lists:
            cards = Card.query.filter_by(list_id=lst.id).all()
            for card in cards:
                # Получаем имя пользователя для assigned_to
                assigned_to_name = None
                if card.assigned_to:
                    user = User.query.get(card.assigned_to)
                    if user:
                        assigned_to_name = user.username
                
                # Получаем список задач для карточки
                todos = Todo.query.filter_by(card_id=card.id).all()
                todos_completed = len([t for t in todos if t.completed])
                todos_total = len(todos)
                todos_progress = f"{todos_completed}/{todos_total}" if todos_total > 0 else "0/0"
                
                report_data.append({
                    'board_name': board.name,
                    'list_name': lst.name,
                    'card_title': card.title,
                    'card_description': card.description,
                    'priority': card.priority.name if hasattr(card, 'priority') else 'Не указан',
                    'completed': 'Да' if card.completed else 'Нет',
                    'assigned_to': assigned_to_name or 'Не назначено',
                    'deadline': card.deadline.strftime('%Y-%m-%d') if card.deadline else 'Не указан',
                    'todos_progress': todos_progress
                })
    
    # Создаем DataFrame и экспортируем в Excel
    df = pd.DataFrame(report_data)
    
    # Переименовываем столбцы на русский
    df.columns = [
        'Доска', 'Список', 'Заголовок карточки', 'Описание', 
        'Приоритет', 'Завершено', 'Исполнитель', 'Срок', 'Подзадачи'
    ]
    
    # Имя файла с указанием доски если отчёт по одной доске
    if board_id and boards:
        filename = f'kanban_report_{boards[0].name}.xlsx'
    else:
        filename = 'kanban_report.xlsx'
    
    excel_path = os.path.join(EXPORT_FOLDER, filename)
    df.to_excel(excel_path, index=False)
    
    return send_file(excel_path, as_attachment=True, download_name=filename)

@dashboard_bp.route('/api/tasks/due-dates-detailed')
@login_required
def tasks_due_dates_detailed():
    """API для получения подробных данных о сроках задач с приоритетами"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    board_id = request.args.get('board_id', type=int, default=None)
    
    # Получаем доски
    if board_id:
        if is_admin:
            boards = [Board.query.get_or_404(board_id)]
        else:
            board = Board.query.get_or_404(board_id)
            if board.user_id == current_user.id or (hasattr(board, 'admin_only') and not board.admin_only):
                boards = [board]
            else:
                return jsonify({'error': 'У вас нет доступа к этой доске'}), 403
    else:
        if is_admin:
            boards = Board.query.all()
        else:
            if hasattr(Board, 'admin_only'):
                boards = Board.query.filter(
                    (Board.user_id == current_user.id) | (Board.admin_only == False)
                ).all()
            else:
                boards = Board.query.filter_by(user_id=current_user.id).all()
    
    today = datetime.now().date()
    
    # Списки для хранения задач
    overdue_tasks = []
    due_today_tasks = []
    due_this_week_tasks = []
    
    for board in boards:
        lists = List.query.filter_by(board_id=board.id).all()
        for lst in lists:
            cards = Card.query.filter_by(list_id=lst.id).all()
            for card in cards:
                if not hasattr(card, 'deadline') or not card.deadline or card.completed:
                    continue
                
                deadline_date = card.deadline.date()
                task_info = {
                    'id': card.id,
                    'title': card.title,
                    'board_name': board.name,
                    'list_name': lst.name,
                    'deadline': card.deadline.strftime('%Y-%m-%d'),
                    'priority': card.priority.name if hasattr(card, 'priority') and card.priority else 'NONE'
                }
                
                if deadline_date < today:
                    overdue_tasks.append(task_info)
                elif deadline_date == today:
                    due_today_tasks.append(task_info)
                elif today < deadline_date <= today + timedelta(days=7):
                    due_this_week_tasks.append(task_info)
    
    return jsonify({
        'overdue': {
            'count': len(overdue_tasks),
            'tasks': overdue_tasks
        },
        'due_today': {
            'count': len(due_today_tasks),
            'tasks': due_today_tasks
        },
        'due_this_week': {
            'count': len(due_this_week_tasks),
            'tasks': due_this_week_tasks
        }
    })

@dashboard_bp.route('/stats')
@login_required
def dashboard_stats():
    """API для получения статистики дашборда"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    board_id = request.args.get('board_id', type=int, default=None)
    stats = get_kanban_statistics(is_admin, board_id)
    
    return jsonify({
        'total_cards': stats['total_cards'],
        'completed_cards': stats['completed_cards'],
        'pending_cards': stats['pending_cards'],
        'total_boards': stats['total_boards'],
        'completion_rate': stats['completion_rate'],
        'user_tasks': stats['user_tasks']
    })