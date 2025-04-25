from flask import Blueprint, render_template, request, redirect, url_for, send_file, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import login_required, current_user
from fpdf import FPDF
import os
import pandas as pd
import json
from datetime import datetime, timedelta
import calendar
from sqlalchemy import func
from routes.models import db, Board, List, Card, Todo, User, PriorityLevel

reports_bp = Blueprint('reports', __name__, url_prefix='/reports')
EXPORT_FOLDER = 'exports'
os.makedirs(EXPORT_FOLDER, exist_ok=True)

# === Report Types ===
REPORT_TYPES = {
    'project_status': 'Project Status',
    'user_workload': 'User Workload',
    'deadline_statistics': 'Deadline Statistics',
    'completion_rates': 'Completion Rates',
    'priority_distribution': 'Priority Distribution'
}

# === Helper Functions ===
def get_date_range(period_type):
    """Generate date range based on period type"""
    today = datetime.now().date()
    
    if period_type == 'today':
        return today, today
    elif period_type == 'yesterday':
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif period_type == 'this_week':
        start_of_week = today - timedelta(days=today.weekday())
        return start_of_week, today
    elif period_type == 'last_week':
        start_of_last_week = today - timedelta(days=today.weekday() + 7)
        end_of_last_week = start_of_last_week + timedelta(days=6)
        return start_of_last_week, end_of_last_week
    elif period_type == 'this_month':
        start_of_month = today.replace(day=1)
        return start_of_month, today
    elif period_type == 'last_month':
        # First day of current month
        first_day_current = today.replace(day=1)
        # Last day of previous month
        last_day_previous = first_day_current - timedelta(days=1)
        # First day of previous month
        first_day_previous = last_day_previous.replace(day=1)
        return first_day_previous, last_day_previous
    elif period_type == 'custom':
        # Handled separately when custom dates are provided
        return None, None
    else:
        # Default to last 30 days
        return today - timedelta(days=30), today

# === Data Collection Functions ===
def get_project_status_data(board_id=None, period_start=None, period_end=None):
    """Get project status data for reports"""
    query = Card.query
    
    if board_id:
        # Find all lists in the specified board
        lists = List.query.filter_by(board_id=board_id).all()
        list_ids = [list_obj.id for list_obj in lists]
        query = query.filter(Card.list_id.in_(list_ids))
    
    # Apply date filters if provided
    if period_start:
        query = query.filter(Card.created_at >= period_start)
    if period_end:
        # Include the entire end day
        end_date = datetime.combine(period_end, datetime.max.time())
        query = query.filter(Card.created_at <= end_date)
    
    # Get all cards matching the criteria
    cards = query.all()
    
    # Calculate statistics
    total_cards = len(cards)
    completed_cards = sum(1 for card in cards if card.completed)
    completion_rate = (completed_cards / total_cards * 100) if total_cards > 0 else 0
    
    # Cards by list
    cards_by_list = {}
    for card in cards:
        list_obj = List.query.get(card.list_id)
        if list_obj:
            list_name = list_obj.name
            if list_name not in cards_by_list:
                cards_by_list[list_name] = {
                    'total': 0,
                    'completed': 0,
                    'completion_rate': 0
                }
            cards_by_list[list_name]['total'] += 1
            if card.completed:
                cards_by_list[list_name]['completed'] += 1
    
    # Calculate completion rate for each list
    for list_name in cards_by_list:
        list_data = cards_by_list[list_name]
        list_data['completion_rate'] = (list_data['completed'] / list_data['total'] * 100) if list_data['total'] > 0 else 0
    
    return {
        'total_cards': total_cards,
        'completed_cards': completed_cards,
        'completion_rate': completion_rate,
        'cards_by_list': cards_by_list
    }

def get_user_workload_data(board_id=None, period_start=None, period_end=None):
    """Get user workload data for reports"""
    query = Card.query
    
    if board_id:
        # Find all lists in the specified board
        lists = List.query.filter_by(board_id=board_id).all()
        list_ids = [list_obj.id for list_obj in lists]
        query = query.filter(Card.list_id.in_(list_ids))
    
    # Apply date filters if provided
    if period_start:
        query = query.filter(Card.created_at >= period_start)
    if period_end:
        # Include the entire end day
        end_date = datetime.combine(period_end, datetime.max.time())
        query = query.filter(Card.created_at <= end_date)
    
    # Get all cards matching the criteria
    cards = query.all()
    
    # Calculate workload by user
    user_workload = {}
    for card in cards:
        if card.assigned_to:
            user = User.query.get(card.assigned_to)
            if user:
                username = user.username
                if username not in user_workload:
                    user_workload[username] = {
                        'total': 0,
                        'completed': 0,
                        'overdue': 0,
                        'priority': {
                            'low': 0,
                            'medium': 0,
                            'high': 0,
                        }
                    }
                user_workload[username]['total'] += 1
                if card.completed:
                    user_workload[username]['completed'] += 1
                if card.deadline and card.deadline < datetime.now() and not card.completed:
                    user_workload[username]['overdue'] += 1
                
                # Count by priority
                priority = str(card.priority).lower()
                if priority in user_workload[username]['priority']:
                    user_workload[username]['priority'][priority] += 1
    
    return {
        'user_workload': user_workload
    }

def get_deadline_statistics(board_id=None, period_start=None, period_end=None):
    """Get deadline statistics for reports"""
    query = Card.query
    
    if board_id:
        # Find all lists in the specified board
        lists = List.query.filter_by(board_id=board_id).all()
        list_ids = [list_obj.id for list_obj in lists]
        query = query.filter(Card.list_id.in_(list_ids))
    
    # Apply date filters if provided
    if period_start:
        query = query.filter(Card.created_at >= period_start)
    if period_end:
        # Include the entire end day
        end_date = datetime.combine(period_end, datetime.max.time())
        query = query.filter(Card.created_at <= end_date)
    
    # Get all cards matching the criteria
    cards = query.all()
    
    # Calculate deadline statistics
    cards_with_deadline = [card for card in cards if card.deadline]
    total_with_deadline = len(cards_with_deadline)
    
    now = datetime.now()
    overdue = sum(1 for card in cards_with_deadline if card.deadline < now and not card.completed)
    completed_on_time = sum(1 for card in cards_with_deadline if card.completed and card.deadline >= now)
    completed_late = sum(1 for card in cards_with_deadline if card.completed and card.deadline < now)
    
    upcoming_deadlines = {}
    for card in cards_with_deadline:
        if not card.completed and card.deadline > now:
            days_left = (card.deadline.date() - now.date()).days
            if days_left <= 1:
                period = "today_tomorrow"
            elif days_left <= 7:
                period = "this_week"
            elif days_left <= 30:
                period = "this_month"
            else:
                period = "future"
                
            if period not in upcoming_deadlines:
                upcoming_deadlines[period] = []
                
            upcoming_deadlines[period].append({
                'id': card.id,
                'title': card.title,
                'deadline': card.deadline.strftime('%Y-%m-%d %H:%M'),
                'days_left': days_left,
                'assigned_to': User.query.get(card.assigned_to).username if card.assigned_to else None
            })
    
    return {
        'total_cards': len(cards),
        'total_with_deadline': total_with_deadline,
        'overdue': overdue,
        'completed_on_time': completed_on_time,
        'completed_late': completed_late,
        'upcoming_deadlines': upcoming_deadlines
    }

def get_priority_distribution(board_id=None, period_start=None, period_end=None):
    """Get priority distribution data for reports"""
    query = Card.query
    
    if board_id:
        lists = List.query.filter_by(board_id=board_id).all()
        list_ids = [list_obj.id for list_obj in lists]
        query = query.filter(Card.list_id.in_(list_ids))
    
    if period_start:
        query = query.filter(Card.created_at >= period_start)
    if period_end:
        end_date = datetime.combine(period_end, datetime.max.time())
        query = query.filter(Card.created_at <= end_date)
    
    cards = query.all()
    
    # Инициализация словарей на основе PriorityLevel
    priority_counts = {priority.name.lower(): 0 for priority in PriorityLevel}
    priority_completion = {
        priority.name.lower(): {'total': 0, 'completed': 0} for priority in PriorityLevel
    }
    priority_tasks = {priority.name.lower(): [] for priority in PriorityLevel}
    
    for card in cards:
        if not hasattr(card, 'priority') or not card.priority:
            continue  # Пропускаем карточки без приоритета
        priority = card.priority.name.lower()  # Извлекаем имя приоритета
        if priority in priority_counts:
            priority_counts[priority] += 1
            priority_completion[priority]['total'] += 1
            if card.completed:
                priority_completion[priority]['completed'] += 1
            
            task_data = {
                'id': card.id,
                'title': card.title,
                'completed': card.completed,
                'deadline': card.deadline.strftime('%Y-%m-%d') if card.deadline else None,
                'assigned_to': User.query.get(card.assigned_to).username if card.assigned_to else None
            }
            priority_tasks[priority].append(task_data)
    
    for priority in priority_completion:
        data = priority_completion[priority]
        data['completion_rate'] = (data['completed'] / data['total'] * 100) if data['total'] > 0 else 0
    
    return {
        'priority_counts': priority_counts,
        'priority_completion': priority_completion,
        'priority_tasks': priority_tasks
    }

# === Routes ===
@reports_bp.route('/')
@login_required
def reports_dashboard():
    """Main reports dashboard"""
    # Get all boards for the filter dropdown
    is_admin = getattr(current_user, 'is_admin', False)
    
    if is_admin:
        boards = Board.query.all()
    else:
        # Non-admins see only public boards and their own boards
        if hasattr(Board, 'admin_only'):
            boards = Board.query.filter(
                (Board.user_id == current_user.id) | (Board.admin_only == False)
            ).all()
        else:
            boards = Board.query.all()
    
    # Calculate quick stats
    total_active_cards = Card.query.filter_by(completed=False).count()
    completed_cards = Card.query.filter_by(completed=True).count()
    
    # Cards with upcoming deadlines (due in next 7 days)
    upcoming_deadline = Card.query.filter(
        Card.deadline > datetime.now(),
        Card.deadline <= (datetime.now() + timedelta(days=7)),
        Card.completed == False
    ).count()
    
    # Overdue cards
    overdue_cards = Card.query.filter(
        Card.deadline < datetime.now(),
        Card.completed == False
    ).count()
    
    return render_template(
        'reports/reports.html',
        boards=boards,
        report_types=REPORT_TYPES,
        is_admin=is_admin,
        quick_stats={
            'total_active': total_active_cards,
            'completed': completed_cards,
            'upcoming': upcoming_deadline,
            'overdue': overdue_cards
        }
    )

@reports_bp.route('/generate', methods=['GET'])
@login_required
def generate_report():
    """Generate report based on parameters"""
    report_type = request.args.get('report_type')
    board_id = request.args.get('board_id')
    period_type = request.args.get('period_type', 'this_month')
    
    if board_id:
        board_id = int(board_id)
    
    # Get date range based on period type
    start_date, end_date = get_date_range(period_type)
    
    # Handle custom date range
    if period_type == 'custom':
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                flash('Invalid date format. Please use YYYY-MM-DD.', 'error')
                return redirect(url_for('reports.reports_dashboard'))
    
    # Get board name if board_id is provided
    board_name = "All Boards"
    if board_id:
        board = Board.query.get(board_id)
        if board:
            board_name = board.name
    
    # Generate report data based on type
    report_data = {}
    if report_type == 'project_status':
        report_data = get_project_status_data(board_id, start_date, end_date)
    elif report_type == 'user_workload':
        report_data = get_user_workload_data(board_id, start_date, end_date)
    elif report_type == 'deadline_statistics':
        report_data = get_deadline_statistics(board_id, start_date, end_date)
    elif report_type == 'priority_distribution':
        report_data = get_priority_distribution(board_id, start_date, end_date)
    elif report_type == 'completion_rates':
        # This combines project status data with additional time analysis
        project_data = get_project_status_data(board_id, start_date, end_date)
        priority_data = get_priority_distribution(board_id, start_date, end_date)
        report_data = {
            'project_status': project_data,
            'priority_data': priority_data
        }
    
    # Prepare context for the template
    context = {
        'report_type': report_type,
        'report_title': REPORT_TYPES.get(report_type, 'Custom Report'),
        'board_id': board_id,
        'board_name': board_name,
        'period_type': period_type,
        'start_date': start_date,
        'end_date': end_date,
        'report_data': report_data,
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M')
    }
    
    # Render the appropriate template based on report type
    return render_template(f'reports/{report_type}.html', **context)

@reports_bp.route('/export/<report_type>', methods=['GET'])
@login_required
def export_report(report_type):
    """Export report data in various formats"""
    export_format = request.args.get('format', 'pdf')
    board_id = request.args.get('board_id')
    period_type = request.args.get('period_type', 'this_month')
    
    if board_id:
        board_id = int(board_id)
    
    # Get date range based on period type
    start_date, end_date = get_date_range(period_type)
    
    # Handle custom date range
    if period_type == 'custom':
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                flash('Invalid date format. Please use YYYY-MM-DD.', 'error')
                return redirect(url_for('reports.reports_dashboard'))
    
    # Get board name if board_id is provided
    board_name = "All_Boards"
    if board_id:
        board = Board.query.get(board_id)
        if board:
            board_name = board.name.replace(' ', '_')
    
    # Generate report data based on type
    report_data = {}
    if report_type == 'project_status':
        report_data = get_project_status_data(board_id, start_date, end_date)
    elif report_type == 'user_workload':
        report_data = get_user_workload_data(board_id, start_date, end_date)
    elif report_type == 'deadline_statistics':
        report_data = get_deadline_statistics(board_id, start_date, end_date)
    elif report_type == 'priority_distribution':
        report_data = get_priority_distribution(board_id, start_date, end_date)
    elif report_type == 'completion_rates':
        # This combines project status data with additional time analysis
        project_data = get_project_status_data(board_id, start_date, end_date)
        priority_data = get_priority_distribution(board_id, start_date, end_date)
        report_data = {
            'project_status': project_data,
            'priority_data': priority_data
        }
    
    # Generate filename
    date_str = datetime.now().strftime('%Y%m%d')
    filename = f"{report_type}_{board_name}_{date_str}"
    
    # Export based on format
    if export_format == 'pdf':
        return export_as_pdf(report_type, report_data, filename, board_name, start_date, end_date)
    elif export_format == 'excel':
        return export_as_excel(report_type, report_data, filename, board_name, start_date, end_date)
    elif export_format == 'json':
        return export_as_json(report_type, report_data, filename, board_name, start_date, end_date)
    else:
        flash('Unsupported export format', 'error')
        return redirect(url_for('reports.reports_dashboard'))

def export_as_pdf(report_type, report_data, filename, board_name, start_date, end_date):
    """Export report as PDF"""
    pdf = FPDF()
    pdf.add_page()
    
    # Add header
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, f"{REPORT_TYPES.get(report_type, 'Custom Report')}", ln=True, align='C')
    pdf.set_font('Arial', 'I', 12)
    pdf.cell(0, 10, f"Board: {board_name}", ln=True)
    pdf.cell(0, 10, f"Period: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}", ln=True)
    pdf.cell(0, 10, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", ln=True)
    pdf.ln(10)
    
    # Add report content based on type
    pdf.set_font('Arial', '', 12)
    
    if report_type == 'project_status':
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Project Overview", ln=True)
        pdf.set_font('Arial', '', 12)
        pdf.cell(0, 10, f"Total Cards: {report_data['total_cards']}", ln=True)
        pdf.cell(0, 10, f"Completed Cards: {report_data['completed_cards']}", ln=True)
        pdf.cell(0, 10, f"Completion Rate: {report_data['completion_rate']:.1f}%", ln=True)
        
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "Lists Overview", ln=True)
        
        for list_name, list_data in report_data['cards_by_list'].items():
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 10, f"{list_name}", ln=True)
            pdf.set_font('Arial', '', 12)
            pdf.cell(0, 10, f"Total Cards: {list_data['total']}", ln=True)
            pdf.cell(0, 10, f"Completed: {list_data['completed']}", ln=True)
            pdf.cell(0, 10, f"Completion Rate: {list_data['completion_rate']:.1f}%", ln=True)
            pdf.ln(5)
            
    elif report_type == 'user_workload':
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, "User Workload Summary", ln=True)
        
        for username, user_data in report_data['user_workload'].items():
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 10, f"User: {username}", ln=True)
            pdf.set_font('Arial', '', 12)
            pdf.cell(0, 10, f"Total Tasks: {user_data['total']}", ln=True)
            pdf.cell(0, 10, f"Completed: {user_data['completed']}", ln=True)
            pdf.cell(0, 10, f"Overdue: {user_data['overdue']}", ln=True)
            
            pdf.set_font('Arial', 'I', 12)
            pdf.cell(0, 10, "Tasks by Priority:", ln=True)
            for priority, count in user_data['priority'].items():
                if count > 0:
                    pdf.cell(0, 10, f"{priority.capitalize()}: {count}", ln=True)
            pdf.ln(5)
    
    # Save the PDF
    pdf_path = os.path.join(EXPORT_FOLDER, f"{filename}.pdf")
    pdf.output(pdf_path)
    
    return send_file(pdf_path, as_attachment=True)

def export_as_excel(report_type, report_data, filename, board_name, start_date, end_date):
    """Export report as Excel"""
    # Create a Pandas Excel writer using XlsxWriter as the engine
    excel_path = os.path.join(EXPORT_FOLDER, f"{filename}.xlsx")
    writer = pd.ExcelWriter(excel_path, engine='xlsxwriter')
    
    # Create a metadata sheet with report info
    metadata = pd.DataFrame({
        'Report Type': [REPORT_TYPES.get(report_type, 'Custom Report')],
        'Board': [board_name],
        'Start Date': [start_date.strftime('%Y-%m-%d')],
        'End Date': [end_date.strftime('%Y-%m-%d')],
        'Generated': [datetime.now().strftime('%Y-%m-%d %H:%M')]
    })
    metadata.to_excel(writer, sheet_name='Report Info', index=False)
    
    # Create data sheets based on report type
    if report_type == 'project_status':
        # Overall stats
        overall = pd.DataFrame({
            'Metric': ['Total Cards', 'Completed Cards', 'Completion Rate (%)'],
            'Value': [
                report_data['total_cards'], 
                report_data['completed_cards'],
                f"{report_data['completion_rate']:.1f}%"
            ]
        })
        overall.to_excel(writer, sheet_name='Overall Stats', index=False)
        
        # Lists data
        lists_data = []
        for list_name, list_data in report_data['cards_by_list'].items():
            lists_data.append({
                'List Name': list_name,
                'Total Cards': list_data['total'],
                'Completed Cards': list_data['completed'],
                'Completion Rate (%)': f"{list_data['completion_rate']:.1f}%"
            })
        
        if lists_data:
            lists_df = pd.DataFrame(lists_data)
            lists_df.to_excel(writer, sheet_name='Lists Data', index=False)
    
    elif report_type == 'user_workload':
        # User workload data
        user_data = []
        priority_data = []
        
        for username, data in report_data['user_workload'].items():
            user_data.append({
                'Username': username,
                'Total Tasks': data['total'],
                'Completed': data['completed'],
                'Completion Rate (%)': f"{(data['completed'] / data['total'] * 100):.1f}%" if data['total'] > 0 else '0%',
                'Overdue Tasks': data['overdue']
            })
            
            # Priority breakdown by user
            for priority, count in data['priority'].items():
                if count > 0:
                    priority_data.append({
                        'Username': username,
                        'Priority': priority.capitalize(),
                        'Count': count
                    })
        
        if user_data:
            users_df = pd.DataFrame(user_data)
            users_df.to_excel(writer, sheet_name='User Workload', index=False)
        
        if priority_data:
            priority_df = pd.DataFrame(priority_data)
            priority_df.to_excel(writer, sheet_name='Priority by User', index=False)
    
    # Save the Excel file
    writer.close()
    
    return send_file(excel_path, as_attachment=True)

def export_as_json(report_type, report_data, filename, board_name, start_date, end_date):
    """Export report as JSON"""
    # Create JSON structure with metadata
    json_data = {
        'metadata': {
            'report_type': report_type,
            'report_name': REPORT_TYPES.get(report_type, 'Custom Report'),
            'board': board_name,
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')
            },
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        },
        'data': report_data
    }
    
    # Save to file
    json_path = os.path.join(EXPORT_FOLDER, f"{filename}.json")
    with open(json_path, 'w') as f:
        json.dump(json_data, f, indent=2, default=str)
    
    return send_file(json_path, as_attachment=True)

@reports_bp.route('/api/data/<report_type>')
@login_required
def get_report_data(report_type):
    """API endpoint to get report data for charts"""
    board_id = request.args.get('board_id')
    period_type = request.args.get('period_type', 'this_month')
    
    if board_id:
        board_id = int(board_id)
    
    # Get date range based on period type
    start_date, end_date = get_date_range(period_type)
    
    # Handle custom date range
    if period_type == 'custom':
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Please use YYYY-MM-DD.'}), 400
    
    # Generate report data based on type
    if report_type == 'project_status':
        data = get_project_status_data(board_id, start_date, end_date)
    elif report_type == 'user_workload':
        data = get_user_workload_data(board_id, start_date, end_date)
    elif report_type == 'deadline_statistics':
        data = get_deadline_statistics(board_id, start_date, end_date)
    elif report_type == 'priority_distribution':
        data = get_priority_distribution(board_id, start_date, end_date)
    elif report_type == 'completion_rates':
        # This combines project status data with additional time analysis
        project_data = get_project_status_data(board_id, start_date, end_date)
        priority_data = get_priority_distribution(board_id, start_date, end_date)
        data = {
            'project_status': project_data,
            'priority_data': priority_data
        }
    else:
        return jsonify({'error': 'Invalid report type'}), 400
    
    return jsonify(data)