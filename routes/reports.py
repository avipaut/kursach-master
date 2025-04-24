from flask import Blueprint, render_template, request, redirect, url_for, send_file, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import login_required, current_user
from fpdf import FPDF
import os
import pandas as pd
from routes.models import db, Board, List, Card, Todo, User, PriorityLevel
from datetime import datetime, timedelta
import json
import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
from io import BytesIO
import base64
import numpy as np

reports_bp = Blueprint('reports', __name__, url_prefix='/reports')
EXPORT_FOLDER = 'exports'
os.makedirs(EXPORT_FOLDER, exist_ok=True)

# Модель для отчетов
class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(10), nullable=False)
    author = db.Column(db.String(255))
    category = db.Column(db.String(255))

# Функция для получения всех отчетов
def get_reports(date_filter=None, author_filter=None, category_filter=None):
    query = Report.query

    if date_filter:
        query = query.filter(Report.date == date_filter)
    if author_filter:
        query = query.filter(Report.author == author_filter)
    if category_filter:
        query = query.filter(Report.category == category_filter)

    return query.all()

# === Роуты === 
@reports_bp.route('/reports')
@login_required
def view_reports():
    date_filter = request.args.get('date_filter')
    author_filter = request.args.get('author_filter')
    category_filter = request.args.get('category_filter')

    reports = get_reports(date_filter, author_filter, category_filter)
    return render_template('reports/reports.html', reports=reports)

@reports_bp.route('/reports/add', methods=['GET', 'POST'])
@login_required
def add_report():
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        date = request.form['date']
        author = request.form['author']
        category = request.form['category']

        new_report = Report(title=title, content=content, date=date, author=author, category=category)
        db.session.add(new_report)
        db.session.commit()

        flash('Отчет успешно добавлен!', 'success')
        return redirect(url_for('reports.view_reports'))

    return render_template('add_report.html')

@reports_bp.route('/reports/edit/<int:report_id>', methods=['GET', 'POST'])
@login_required
def edit_report(report_id):
    report = Report.query.get_or_404(report_id)

    if request.method == 'POST':
        report.title = request.form['title']
        report.content = request.form['content']
        report.date = request.form['date']
        report.author = request.form['author']
        report.category = request.form['category']

        db.session.commit()

        flash('Отчет успешно обновлен!', 'success')
        return redirect(url_for('reports.view_reports'))

    return render_template('reports/edit_report.html', report=report)

@reports_bp.route('/reports/delete/<int:report_id>', methods=['POST'])
@login_required
def delete_report(report_id):
    report = Report.query.get_or_404(report_id)
    db.session.delete(report)
    db.session.commit()

    flash('Отчет успешно удален!', 'success')
    return redirect(url_for('reports.view_reports'))

@reports_bp.route('/reports/export/pdf/<int:report_id>')
@login_required
def export_pdf(report_id):
    report = Report.query.get_or_404(report_id)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, report.title, ln=True, align='C')
    pdf.set_font('Arial', '', 12)
    pdf.multi_cell(0, 10, f"Дата: {report.date}\n\n{report.content}")

    pdf_path = os.path.join(EXPORT_FOLDER, f"report_{report_id}.pdf")
    pdf.output(pdf_path)

    return send_file(pdf_path, as_attachment=True)

@reports_bp.route('/reports/export/excel')
@login_required
def export_excel():
    reports = get_reports()

    if not reports:
        flash('Нет отчетов для экспорта!', 'danger')
        return redirect(url_for('reports.view_reports'))

    df = pd.DataFrame([(r.id, r.title, r.content, r.date, r.author, r.category) for r in reports],
                      columns=['ID', 'Заголовок', 'Содержание', 'Дата', 'Автор', 'Категория'])
    excel_path = os.path.join(EXPORT_FOLDER, 'reports.xlsx')
    df.to_excel(excel_path, index=False)

    return send_file(excel_path, as_attachment=True)

# === DASHBOARD И АНАЛИТИКА KANBAN ===

@reports_bp.route('/dashboard')
@login_required
def dashboard():
    # Проверяем права доступа
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    
    # Получаем общие статистические данные
    stats = get_kanban_statistics(is_admin)
    
    return render_template('reports/dashboard.html', stats=stats, is_admin=is_admin)

def get_kanban_statistics(is_admin=False):
    """Получить статистику по Kanban-доске"""
    stats = {}
    
    # Доски
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
    
    stats['total_boards'] = len(boards)
    
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
    
    return stats

@reports_bp.route('/charts/tasks-by-status')
@login_required
def tasks_by_status_chart():
    """API для получения данных о состоянии задач"""
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin)
    
    data = {
        'labels': ['Завершено', 'В процессе'],
        'datasets': [{
            'data': [stats['completed_cards'], stats['pending_cards']],
            'backgroundColor': ['#4caf50', '#ff9800']
        }]
    }
    
    return jsonify(data)

@reports_bp.route('/charts/tasks-by-priority')
@login_required
def tasks_by_priority_chart():
    """API для получения данных о приоритетах задач"""
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin)
    
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

@reports_bp.route('/charts/tasks-by-user')
@login_required
def tasks_by_user_chart():
    """API для получения данных о задачах по пользователям"""
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin)
    
    users = list(stats['user_tasks'].keys())
    completed_tasks = [stats['user_tasks'][user]['completed'] for user in users]
    pending_tasks = [stats['user_tasks'][user]['total'] - stats['user_tasks'][user]['completed'] for user in users]
    
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

@reports_bp.route('/api/tasks/due-dates')
@login_required
def tasks_due_dates():
    """API для получения данных о сроках задач"""
    stats = get_kanban_statistics(hasattr(current_user, 'is_admin') and current_user.is_admin)
    
    data = {
        'overdue': stats['overdue'],
        'due_today': stats['due_today'],
        'due_this_week': stats['due_this_week']
    }
    
    return jsonify(data)

@reports_bp.route('/reports/kanban/export')
@login_required
def export_kanban_report():
    """Экспорт отчёта по Kanban-доске в Excel"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    
    # Получаем доски
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
    
    excel_path = os.path.join(EXPORT_FOLDER, 'kanban_report.xlsx')
    df.to_excel(excel_path, index=False)
    
    return send_file(excel_path, as_attachment=True, download_name='kanban_report.xlsx')

@reports_bp.route('/reports/generate-pdf-report', methods=['POST'])
@login_required
def generate_pdf_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Неверные данные запроса'}), 400
            
        report_type = data.get('report_type', 'default')
        date_range = data.get('date_range', 'all')
        user_id = data.get('user_id', None)
        
        # Ваша логика генерации PDF
        
        return jsonify({
            'success': True,
            'message': 'Отчет успешно сгенерирован',
            'download_url': url_for('reports.download_report', filename=report_filename)
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    
    pdf = FPDF()
    pdf.add_page()
    
    # Заголовок отчета
    pdf.set_font('Arial', 'B', 16)
    if report_type == 'user_productivity':
        title = "Отчет по продуктивности пользователей"
    elif report_type == 'tasks':
        title = "Отчет по задачам"
    else:
        title = "Общий отчет по Kanban-доске"
    
    pdf.cell(0, 10, title, ln=True, align='C')
    
    # Дата формирования отчета
    pdf.set_font('Arial', '', 12)
    pdf.cell(0, 10, f"Дата формирования: {datetime.now().strftime('%Y-%m-%d')}", ln=True)
    
    # Содержимое отчета в зависимости от типа
    if report_type == 'user_productivity':
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Продуктивность пользователей", ln=True)
        pdf.set_font('Arial', '', 12)
        
        for username, user_stats in stats['user_tasks'].items():
            pdf.cell(0, 10, f"Пользователь: {username}", ln=True)
            pdf.cell(0, 10, f"Всего задач: {user_stats['total']}", ln=True)
            pdf.cell(0, 10, f"Выполнено: {user_stats['completed']}", ln=True)
            pdf.cell(0, 10, f"Процент выполнения: {user_stats['completion_rate']:.2f}%", ln=True)
            pdf.ln(5)
    
    elif report_type == 'tasks':
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Статистика по задачам", ln=True)
        pdf.set_font('Arial', '', 12)
        
        pdf.cell(0, 10, f"Всего задач: {stats['total_cards']}", ln=True)
        pdf.cell(0, 10, f"Выполнено: {stats['completed_cards']}", ln=True)
        pdf.cell(0, 10, f"В процессе: {stats['pending_cards']}", ln=True)
        pdf.cell(0, 10, f"Процент выполнения: {stats['completion_rate']:.2f}%", ln=True)
        
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Распределение по приоритетам", ln=True)
        pdf.set_font('Arial', '', 12)
        
        for priority, count in stats['priorities'].items():
            pdf.cell(0, 10, f"{priority}: {count}", ln=True)
            
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Сроки выполнения", ln=True)
        pdf.set_font('Arial', '', 12)
        
        pdf.cell(0, 10, f"Просрочено: {stats['overdue']}", ln=True)
        pdf.cell(0, 10, f"На сегодня: {stats['due_today']}", ln=True)
        pdf.cell(0, 10, f"На этой неделе: {stats['due_this_week']}", ln=True)
    
    else:  # Общий отчет
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Общая статистика", ln=True)
        pdf.set_font('Arial', '', 12)
        
        pdf.cell(0, 10, f"Количество досок: {stats['total_boards']}", ln=True)
        pdf.cell(0, 10, f"Всего задач: {stats['total_cards']}", ln=True)
        pdf.cell(0, 10, f"Выполнено задач: {stats['completed_cards']}", ln=True)
        pdf.cell(0, 10, f"В процессе: {stats['pending_cards']}", ln=True)
        pdf.cell(0, 10, f"Процент выполнения: {stats['completion_rate']:.2f}%", ln=True)
        
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Топ пользователей по выполненным задачам", ln=True)
        pdf.set_font('Arial', '', 12)
        
        # Сортируем пользователей по количеству выполненных задач
        top_users = sorted(
            stats['user_tasks'].items(), 
            key=lambda x: x[1]['completed'], 
            reverse=True
        )[:5]  # Берем топ-5
        
        for username, user_stats in top_users:
            pdf.cell(0, 10, f"{username}: {user_stats['completed']} задач", ln=True)

    # Сохраняем PDF
    report_filename = f"kanban_report_{report_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = os.path.join(EXPORT_FOLDER, report_filename)
    pdf.output(pdf_path)
    
    return jsonify({
        'success': True,
        'message': 'Отчет успешно сгенерирован',
        'download_url': url_for('reports.download_report', filename=report_filename)
    })

@reports_bp.route('/reports/download/<filename>')
@login_required
def download_report(filename):
    """Скачивание сгенерированного отчета"""
    return send_file(os.path.join(EXPORT_FOLDER, filename), as_attachment=True)

@reports_bp.route('/user-productivity')
@login_required
def user_productivity():
    """Страница с отчетом по продуктивности пользователей"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    stats = get_kanban_statistics(is_admin)
    users = User.query.all()
    
    return render_template('user_productivity.html', stats=stats, users=users)

@reports_bp.route('/task-statistics')
@login_required
def task_statistics():
    """Страница со статистикой по задачам"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    stats = get_kanban_statistics(is_admin)
    
    return render_template('task_statistics.html', stats=stats)

@reports_bp.route('/dashboard/stats')
@login_required
def dashboard_stats():
    """API для получения статистики дашборда"""
    is_admin = hasattr(current_user, 'is_admin') and current_user.is_admin
    stats = get_kanban_statistics(is_admin)
    
    return jsonify({
        'total_cards': stats['total_cards'],
        'completed_cards': stats['completed_cards'],
        'pending_cards': stats['pending_cards'],
        'total_boards': stats['total_boards'],
        'completion_rate': stats['completion_rate'],
        'user_tasks': stats['user_tasks']
    })