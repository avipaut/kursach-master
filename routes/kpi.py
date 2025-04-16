from flask import Blueprint, request, render_template, jsonify, redirect, url_for
from flask_login import current_user, login_required
from routes.models import db, KPI, User
import logging
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any
import re
import json

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)

kpi_bp = Blueprint('kpi', __name__)

import ast
import operator
import math

# Поддерживаемые операции
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

# Поддерживаемые функции
SAFE_FUNCTIONS = {
    'abs': abs,
    'round': round,
    'min': min,
    'max': max,
    'sum': sum,
    'sqrt': math.sqrt,
    'log': math.log,
    'log10': math.log10,
    'exp': math.exp,
    'sin': math.sin,
    'cos': math.cos,
    'tan': math.tan,
    'ceil': math.ceil,
    'floor': math.floor,
}

def safe_eval(expr, variables):
    """Безопасное вычисление выражения"""
    try:
        tree = ast.parse(expr, mode='eval')
    except SyntaxError:
        raise ValueError("Invalid syntax in formula")
    
    def _eval(node):
        if isinstance(node, ast.Num):
            return node.n
        elif isinstance(node, ast.Name):
            if node.id in variables:
                return variables[node.id]
            elif node.id in SAFE_FUNCTIONS:
                return SAFE_FUNCTIONS[node.id]
            else:
                raise ValueError(f"Unknown variable or function: {node.id}")
        elif isinstance(node, ast.BinOp):
            return SAFE_OPERATORS[type(node.op)](_eval(node.left), _eval(node.right))
        elif isinstance(node, ast.UnaryOp):
            return SAFE_OPERATORS[type(node.op)](_eval(node.operand))
        elif isinstance(node, ast.Call):
            func = _eval(node.func)
            args = [_eval(arg) for arg in node.args]
            return func(*args)
        else:
            raise ValueError(f"Unsupported operation: {type(node).__name__}")
    
    return _eval(tree.body)

def evaluate_formula(formula: str, row_data: dict, column_names: list = None) -> str:
    """Улучшенная обработка формул"""
    if column_names is None:
        column_names = list(row_data.keys())
    
    try:
        # Подготовка переменных
        variables = {}
        
        # Добавляем значения из строки
        for col_name, value in row_data.items():
            safe_name = col_name.lower().replace(' ', '_')
            try:
                variables[safe_name] = float(value) if value else 0.0
            except (ValueError, TypeError):
                variables[safe_name] = 0.0
        
        # Добавляем математические константы
        variables.update({
            'pi': math.pi,
            'e': math.e
        })
        
        # Заменяем ссылки на столбцы [Column] на переменные column
        normalized_formula = formula
        for col_name in column_names:
            safe_name = col_name.lower().replace(' ', '_')
            pattern = r'\[' + re.escape(col_name) + r'\]'
            normalized_formula = re.sub(pattern, safe_name, normalized_formula)
        
        # Вычисляем результат
        result = safe_eval(normalized_formula, variables)
        
        # Форматируем результат
        if isinstance(result, (int, float)):
            return str(round(result, 4)).rstrip('0').rstrip('.') if '.' in str(result) else str(result)
        return str(result)
    
    except Exception as e:
        logger.error(f"Formula error: {e} in formula '{formula}'")
        return f"#ERROR: {str(e)}"




@kpi_bp.route('/validate_formula', methods=['POST'])
@login_required
def validate_formula():
    """Validate formula syntax."""
    try:
        data = request.get_json()
        formula = data.get('formula')
        
        if not formula:
            return jsonify({"valid": False, "errors": ["No formula provided"]})
        
        # Get column names for current user
        columns_query = db.session.query(KPI.column_name).filter(
            KPI.user_id == current_user.id
        ).distinct()
        column_names = [col[0] for col in columns_query.all()]
        
        validation = validate_formula(formula, column_names)
        return jsonify(validation)
        
    except Exception as e:
        logger.error(f"Formula validation error: {e}")
        return jsonify({"valid": False, "errors": [str(e)]})

def get_kpi_data_from_db(user_id=None, admin_view=False):
    """Get KPI data from database and format for template."""
    try:
        # Для шаблонов
        if admin_view and request.args.get('template'):
            query = db.session.query(KPI).filter_by(is_template=True)
            kpis = query.order_by(KPI.row_index).all()
        # Для пользователей
        else:
            if not admin_view:
                query = db.session.query(KPI).filter(KPI.user_id == user_id)
            else:
                query = db.session.query(KPI)
            
            kpis = query.filter_by(is_template=False).order_by(KPI.user_id, KPI.row_index).all()

        # Получаем уникальные колонки из БД
        if admin_view:
            columns_query = db.session.query(KPI.column_name).distinct()
        else:
            columns_query = db.session.query(KPI.column_name).filter(KPI.user_id == user_id).distinct()
            
        columns = [col[0] for col in columns_query.all()]  # Только колонки из БД

        if admin_view:
            user_ids = db.session.query(KPI.user_id).distinct().all()
            user_ids = [uid[0] for uid in user_ids]
            
            users_data = {}
            for user_id in user_ids:
                user = User.query.get(user_id)
                if user:
                    # Find the max row index for this user
                    max_row = db.session.query(db.func.max(KPI.row_index)).filter(KPI.user_id == user_id).scalar() or 0
                    # Create empty data matrix with 5 extra rows
                    data = [["" for _ in range(len(columns))] for _ in range(max_row + 1)]
                    
                    # Fill data from database
                    user_kpis = [kpi for kpi in kpis if kpi.user_id == user_id]
                    for kpi in user_kpis:
                        try:
                            col_idx = columns.index(kpi.column_name)
                            data[kpi.row_index][col_idx] = kpi.value
                        except (ValueError, IndexError) as e:
                            logger.warning(f"Error placing KPI data: {e}")
                    
                    users_data[user_id] = {
                        "username": user.username,
                        "data": data
                    }
            
            return users_data, columns
        else:
            # For regular user view, just return their data
            # Find the max row index for this user
            max_row = db.session.query(db.func.max(KPI.row_index)).filter(KPI.user_id == user_id).scalar() or 0
            # Create empty data matrix with 5 extra rows
            data = [["" for _ in range(len(columns))] for _ in range(max_row + 2)]
            
            # Fill data from database
            for kpi in kpis:
                try:
                    col_idx = columns.index(kpi.column_name)
                    data[kpi.row_index][col_idx] = kpi.value
                except (ValueError, IndexError) as e:
                    logger.warning(f"Error placing KPI data: {e}")
            
            # Process formulas
            rows_with_formulas = {}
            for kpi in kpis:
                if kpi.formula:
                    if kpi.row_index not in rows_with_formulas:
                        rows_with_formulas[kpi.row_index] = {}
                    rows_with_formulas[kpi.row_index][kpi.column_name] = kpi.formula
            
            # Evaluate formulas
            for row_idx in rows_with_formulas:
                # Get all data for this row
                row_data = {}
                for col_idx, col_name in enumerate(columns):
                    if row_idx < len(data) and col_idx < len(data[row_idx]):
                        row_data[col_name] = data[row_idx][col_idx]
                
                # Evaluate each formula in the row
                for col_name, formula in rows_with_formulas[row_idx].items():
                    try:
                        col_idx = columns.index(col_name)
                        calculated = evaluate_formula(formula, row_data)
                        
                        # Update the displayed value
                        data[row_idx][col_idx] = calculated
                        
                        # Update in database
                        kpi_entry = KPI.query.filter_by(
                            row_index=row_idx,
                            column_name=col_name,
                            user_id=user_id
                        ).first()
                        if kpi_entry:
                            kpi_entry.calculated_value = calculated
                            db.session.commit()
                    except (ValueError, IndexError) as e:
                        logger.warning(f"Error evaluating formula: {e}")
            
            return data, columns
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching KPI data: {e}")
        return [[] for _ in range(10)], []  # Пустые данные при ошибке
@kpi_bp.route('/kpi', methods=['GET'])
@login_required
def kpi_constructor():
    """Main route for KPI constructor."""
    try:
        selected_user_id = request.args.get('user_id')
        
        if current_user.is_admin:
            # Для админа получаем список всех пользователей
            users = User.query.all()
            
            # Если выбран конкретный пользователь - показываем его данные
            if selected_user_id:
                kpi_data, columns = get_kpi_data_from_db(user_id=selected_user_id)
                return render_template(
                    'kpi_constructor.html',
                    kpi_columns=columns,
                    kpi_data=kpi_data,
                    users=users,
                    selected_user_id=int(selected_user_id),
                    is_admin=True
                )
            
            # Если пользователь не выбран - показываем список
            return render_template(
                'kpi_constructor.html',
                users=users,
                is_admin=True
            )
        else:
            # Для обычного пользователя
            kpi_data, columns = get_kpi_data_from_db(user_id=current_user.id)
            return render_template(
                'kpi_constructor.html',
                kpi_columns=columns,
                kpi_data=kpi_data,
                user_id=current_user.id,
                is_admin=False
            )
    except Exception as e:
        logger.error(f"Error displaying KPI constructor: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/add_column', methods=['POST'])
@login_required
def add_column():
    
    """Add a new column to KPI constructor."""
    try:
        data = request.get_json()
        column_name = data.get('column_name')
        user_id = data.get('user_id', current_user.id)  # Для админа берем из запроса
        
        if current_user.is_admin and user_id != current_user.id:
            # Проверяем права админа на изменение других пользователей
            pass  # Здесь можно добавить дополнительную проверку прав
        
        # No need to store columns globally anymore, they're retrieved from DB
        
        logger.info(f"Added new column: {column_name}")
        return jsonify({
            "status": "success",
            "new_column": column_name,
            "column_index": -1  # Will be determined client-side
        })
    except Exception as e:
        logger.error(f"Error adding column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/delete_column', methods=['POST'])
@login_required
def delete_column():
    """Delete a specific column by name."""
    try:
        data = request.get_json()
        column_name = data.get("column")
        user_id = current_user.id
        
        if not column_name:
            return jsonify({"status": "error", "message": "Column not found"}), 400
        
        # Delete data from DB for current user only
        if current_user.is_admin and data.get("all_users"):
            # Admin can delete for all users
            db.session.query(KPI).filter(KPI.column_name == column_name).delete()
        else:
            # Regular user or admin acting on their own data
            db.session.query(KPI).filter(
                KPI.column_name == column_name,
                KPI.user_id == user_id
            ).delete()
            
        db.session.commit()

        logger.info(f"Deleted column: {column_name}")
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error deleting column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/save_kpi', methods=['POST'])
@login_required
def save_kpi():
    """Save KPI data to database."""
    try:
        data = request.get_json() if request.is_json else request.form
        user_id = current_user.id
        logger.debug(f"Received data for saving: {data}")
        
        with db.session.begin_nested():  # Create nested transaction
            for key, value in data.items():
                if key.startswith('formula_'):
                    # Handle formula saving
                    parts = key.split('_')
                    row_idx = int(parts[1])
                    col_idx = int(parts[3])
                    
                    # Get column name
                    column_data = data.get(f'column_name_{col_idx}')
                    if not column_data:
                        continue
                    
                    # Find or create KPI entry
                    kpi_entry = KPI.query.filter_by(
                        row_index=row_idx,
                        column_name=column_data,
                        user_id=user_id
                    ).first()
                    
                    if kpi_entry:
                        kpi_entry.formula = value
                    else:
                        new_kpi = KPI(
                            row_index=row_idx,
                            column_name=column_data,
                            formula=value,
                            user_id=user_id
                        )
                        db.session.add(new_kpi)
                    
                elif key.startswith('cell_'):
                    # Handle regular cell data
                    parts = key.split('_')
                    row_idx = int(parts[1])
                    col_idx = int(parts[3])
                    
                    # Get column name
                    column_data = data.get(f'column_name_{col_idx}')
                    if not column_data:
                        continue
                    
                    # Find or create KPI entry
                    kpi_entry = KPI.query.filter_by(
                        row_index=row_idx,
                        column_name=column_data,
                        user_id=user_id
                    ).first()
                    
                    if kpi_entry:
                        kpi_entry.value = value
                    else:
                        new_kpi = KPI(
                            row_index=row_idx,
                            column_name=column_data,
                            value=value,
                            user_id=user_id
                        )
                        db.session.add(new_kpi)
        
        # After all updates, process formulas
        rows_with_updates = set()
        for key in data:
            if key.startswith('cell_') or key.startswith('formula_'):
                parts = key.split('_')
                rows_with_updates.add(int(parts[1]))
        
        # Get all KPI data for this user
        kpi_entries = KPI.query.filter_by(user_id=user_id).all()
        
        # Group by row index
        rows_data = {}
        formulas = {}
        columns = set()
        
        for entry in kpi_entries:
            rows_data.setdefault(entry.row_index, {})
            rows_data[entry.row_index][entry.column_name] = entry.value
            columns.add(entry.column_name)
            
            if entry.formula:
                formulas.setdefault(entry.row_index, {})
                formulas[entry.row_index][entry.column_name] = entry.formula
        
        # Evaluate formulas for updated rows
        for row_idx in rows_with_updates:
            if row_idx in formulas:
                for col_name, formula in formulas[row_idx].items():
                    try:
                        row_data = rows_data.get(row_idx, {})
                        calculated = evaluate_formula(formula, row_data)
                        
                        # Update in database
                        kpi_entry = KPI.query.filter_by(
                            row_index=row_idx,
                            column_name=col_name,
                            user_id=user_id
                        ).first()
                        if kpi_entry:
                            kpi_entry.calculated_value = calculated
                    except Exception as e:
                        logger.error(f"Formula evaluation error: {e}")
        
        db.session.commit()
        logger.info("KPI data successfully saved")
        return jsonify({"status": "success", "message": "Data saved successfully"})
        
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error saving KPI: {e}")
        return jsonify({"status": "error", "message": "Database error"}), 500
    except Exception as e:
        logger.error(f"Unexpected error saving KPI: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/get_chart_data', methods=['GET'])
@login_required
def get_chart_data():
    """Get KPI data formatted for charts."""
    try:
        user_id = current_user.id
        column = request.args.get('column')
        
        if not column:
            return jsonify({"status": "error", "message": "Column parameter required"}), 400
            
        # Get all KPI entries for this column and user
        kpi_entries = KPI.query.filter_by(
            column_name=column,
            user_id=user_id
        ).order_by(KPI.row_index).all()
        
        # Get the label column values (usually from the first column "Название")
        first_column = db.session.query(KPI.column_name).filter(
            KPI.user_id == user_id
        ).order_by(KPI.id).first()
        label_column = first_column[0] if first_column else "Label"  # Fallback
        label_entries = KPI.query.filter_by(
            column_name=label_column,
            user_id=user_id
        ).order_by(KPI.row_index).all()
        
        # Create data for chart
        chart_data = []
        for i, entry in enumerate(kpi_entries):
            label = "Row " + str(entry.row_index + 1)
            if i < len(label_entries) and label_entries[i].row_index == entry.row_index:
                label = label_entries[i].value or label
                
            # Use calculated value if available, otherwise use value
            value = entry.calculated_value if entry.calculated_value else entry.value
            try:
                value = float(value)
            except (ValueError, TypeError):
                value = 0
                
            chart_data.append({
                "label": label,
                "value": value
            })
        
        return jsonify({
            "status": "success",
            "data": chart_data,
            "column": column
        })
    except Exception as e:
        logger.error(f"Error getting chart data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
@kpi_bp.route('/delete_row', methods=['POST'])
@login_required
def delete_row():
    """Delete a specific row by index."""
    try:
        data = request.get_json()
        row_index = data.get("row_index")
        user_id = current_user.id
        
        if row_index is None:
            return jsonify({"status": "error", "message": "Row index required"}), 400
        
        # Delete all KPI entries for this row and user
        db.session.query(KPI).filter(
            KPI.row_index == row_index,
            KPI.user_id == user_id
        ).delete()
        
        # Update row indices for rows after the deleted one
        db.session.query(KPI).filter(
            KPI.row_index > row_index,
            KPI.user_id == user_id
        ).update({KPI.row_index: KPI.row_index - 1})
        
        db.session.commit()

        logger.info(f"Deleted row: {row_index}")
        return jsonify({"status": "success"})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting row: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    

@kpi_bp.route('/template')
@login_required
def get_template():
    if not current_user.is_admin:
        abort(403)
    
    # Получаем данные шаблона
    template_data = KPI.query.filter_by(is_template=True).order_by(KPI.row_index).all()
    
    # Форматируем данные для фронтенда
    columns = set()
    data = {}
    
    for item in template_data:
        if item.row_index not in data:
            data[item.row_index] = {}
        data[item.row_index][item.column_name] = item.value
        columns.add(item.column_name)
    
    return jsonify({
        'columns': list(columns),
        'data': data
    })
from datetime import datetime
@kpi_bp.route('/save_template', methods=['POST'])
@login_required
def save_template():
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Доступ запрещён'}), 403

    try:
        data = request.get_json()
        
        # Удаляем старые шаблонные данные
        db.session.query(KPI).filter(KPI.is_template == True).delete()
        
        # Сохраняем данные шаблона
        template_data = data.get('template_data', {})
        
        for row_idx, row in template_data.get('rows', {}).items():
            for col_name, cell_data in row.items():
                new_kpi = KPI(
                    row_index=int(row_idx),
                    column_name=col_name,
                    value=cell_data.get('value', ''),
                    formula=cell_data.get('formula', ''),
                    is_template=True,
                    user_id=None,  # Шаблоны не привязаны к пользователю
                    created_at=datetime.utcnow(),
                    created_by=current_user.id
                )
                db.session.add(new_kpi)
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Шаблон успешно сохранён'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Ошибка сохранения шаблона: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Ошибка сохранения шаблона: {str(e)}'
        }), 500
def apply_template_changes():
    """Применяет изменения шаблона ко всем пользователям"""
    # Получаем текущий шаблон
    template_items = KPI.query.filter_by(is_template=True).order_by(KPI.row_index).all()
    
    # Получаем всех пользователей (кроме админов, если нужно)
    users = User.query.filter(User.id != current_user.id).all()
    
    for user in users:
        # Удаляем только KPI пользователя, которые были созданы из шаблона
        KPI.query.filter_by(user_id=user.id, is_template=False).delete()
        
        # Создаем новые KPI на основе шаблона
        for template_item in template_items:
            kpi = KPI(
                row_index=template_item.row_index,
                column_name=template_item.column_name,
                value=template_item.value,
                formula=template_item.formula,
                user_id=user.id,
                is_template=False,
                template_id=template_item.id
            )
            db.session.add(kpi)
    
    db.session.commit()

    
@kpi_bp.route('/template/apply', methods=['POST'])
@login_required
def apply_template():
    if not current_user.is_admin:
        abort(403)
    
    try:
        apply_template_changes()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@kpi_bp.route('/template/history', methods=['GET'])
@login_required
def get_template_history():
    if not current_user.is_admin:
        abort(403)
    
    history = KPITemplateHistory.query.order_by(KPITemplateHistory.changed_at.desc()).limit(50).all()
    
    return jsonify({
        'history': [{
            'id': item.id,
            'changed_at': item.changed_at.isoformat(),
            'changed_by': item.user.username,
            'description': item.change_description
        } for item in history]
    })