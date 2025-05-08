from flask import Blueprint, request, render_template, jsonify
from flask_login import current_user, login_required
from routes.models import db, KPI, User, KPITemplate
import logging
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any
import re
import json
import ast
import operator
import math
from datetime import datetime
from .notifications import notify_user
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)

kpi_bp = Blueprint('kpi', __name__)

DEFAULT_COLUMNS = ["Название", "Значение", "Цель", "Прогресс"]

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
        variables = {}
        for col_name, value in row_data.items():
            safe_name = col_name.lower().replace(' ', '_')
            try:
                variables[safe_name] = float(value) if value else 0.0
            except (ValueError, TypeError):
                variables[safe_name] = 0.0
        
        variables.update({
            'pi': math.pi,
            'e': math.e
        })
        
        normalized_formula = formula
        for col_name in column_names:
            safe_name = col_name.lower().replace(' ', '_')
            pattern = r'\[' + re.escape(col_name) + r'\]'
            normalized_formula = re.sub(pattern, safe_name, normalized_formula)
        
        result = safe_eval(normalized_formula, variables)
        if isinstance(result, (int, float)):
            return str(round(result, 4)).rstrip('0').rstrip('.') if '.' in str(result) else str(result)
        return str(result)
    
    except Exception as e:
        logger.error(f"Formula error: {e} in formula '{formula}'")
        return f"#ERROR: {str(e)}"

def validate_formula(formula: str, column_names: list) -> Dict[str, Any]:
    """Validate formula syntax."""
    if not formula:
        return {"valid": False, "errors": ["No formula provided"]}
    
    try:
        ast.parse(formula, mode='eval')
        used_columns = re.findall(r'\[([^\]]+)\]', formula)
        unknown_columns = [col for col in used_columns if col not in column_names]
        
        if unknown_columns:
            return {
                "valid": False,
                "errors": [f"Unknown columns: {', '.join(unknown_columns)}"]
            }
        
        return {"valid": True, "errors": []}
    except SyntaxError as e:
        return {"valid": False, "errors": [f"Syntax error: {str(e)}"]}
    except Exception as e:
        return {"valid": False, "errors": [str(e)]}

def sync_template_columns(user_id: int, template_columns: List[str], max_row: int):
    """Sync template columns to user's KPI table preserving column order."""
    try:
        # Get existing columns for the user with original order
        existing_columns = [col[0] for col in 
                          db.session.query(KPI.column_name, KPI.id)
                          .filter(KPI.user_id == user_id)
                          .distinct(KPI.column_name)
                          .order_by(KPI.id)
                          .all()]
        
        # Add any missing columns from the template in their original order
        new_columns = [col for col in template_columns if col not in existing_columns]
        
        for col in new_columns:
            for row_idx in range(max_row + 1):
                kpi_entry = KPI.query.filter_by(
                    row_index=row_idx,
                    column_name=col,
                    user_id=user_id
                ).first()
                if not kpi_entry:
                    new_kpi = KPI(
                        row_index=row_idx,
                        column_name=col,
                        value="",
                        user_id=user_id,
                        last_updated=datetime.utcnow()
                    )
                    db.session.add(new_kpi)
        
        db.session.commit()
        logger.info(f"Synced columns {new_columns} for user {user_id} in correct order")
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error syncing columns: {e}")
        raise
def get_kpi_data_from_db(user_id=None, admin_view=False, template=False):
    """Get KPI or template data from database and format for template with column order preserved."""
    try:
        if template:
            # Получаем все записи шаблона
            kpis = KPITemplate.query.order_by(KPITemplate.row_index, KPITemplate.column_name).all()
            
            # Получаем уникальные названия столбцов с сохранением порядка добавления
            db_columns = db.session.query(KPITemplate.column_name, KPITemplate.id)\
                                  .distinct(KPITemplate.column_name)\
                                  .order_by(KPITemplate.id)\
                                  .all()
            columns = [col[0] for col in db_columns]
            
            # Определяем максимальный индекс строки
            max_row = db.session.query(db.func.max(KPITemplate.row_index)).scalar() or 0
            
            # Создаём матрицы данных и формул
            data = [["" for _ in range(len(columns))] for _ in range(max_row + 1)]
            formulas = [["" for _ in range(len(columns))] for _ in range(max_row + 1)]
            
            # Заполняем данные и формулы с учетом порядка колонок
            for kpi in kpis:
                try:
                    col_idx = columns.index(kpi.column_name)
                    data[kpi.row_index][col_idx] = kpi.calculated_value or kpi.value or ""
                    formulas[kpi.row_index][col_idx] = kpi.formula or ""
                except (ValueError, IndexError) as e:
                    logger.warning(f"Error placing KPI data: {e}")
            
            return data, columns, formulas
        else:
            # Для пользовательских данных
            query = db.session.query(KPI)
            if not admin_view:
                query = query.filter(KPI.user_id == user_id)
            kpis = query.order_by(KPI.user_id, KPI.row_index, KPI.column_name).all()
            
            # Получаем колонки с сохранением порядка добавления
            columns_query = db.session.query(KPI.column_name, KPI.id)\
                                    .filter(KPI.user_id == user_id)\
                                    .distinct(KPI.column_name)\
                                    .order_by(KPI.id)
            if admin_view:
                columns_query = db.session.query(KPI.column_name, KPI.id)\
                                       .distinct(KPI.column_name)\
                                       .order_by(KPI.id)

            db_columns = columns_query.all()
            columns = [col[0] for col in db_columns]
            max_row = db.session.query(db.func.max(KPI.row_index)).filter(KPI.user_id == user_id).scalar() or 0
            data = [["" for _ in range(len(columns))] for _ in range(max_row + 1)]
            formulas = [["" for _ in range(len(columns))] for _ in range(max_row + 1)]

            for kpi in kpis:
                try:
                    col_idx = columns.index(kpi.column_name)
                    data[kpi.row_index][col_idx] = kpi.calculated_value or kpi.value or ""
                    formulas[kpi.row_index][col_idx] = kpi.formula or ""
                except (ValueError, IndexError) as e:
                    logger.warning(f"Error placing KPI data: {e}")
        
        return data, columns, formulas
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching KPI data: {e}")
        return [], [], []
@kpi_bp.route('/kpi', methods=['GET'])
@login_required
def kpi_constructor():
    try:
        selected_user_id = request.args.get('user_id')
        
        if current_user.is_admin:
            users = User.query.all()
            template_data, template_columns, template_formulas = get_kpi_data_from_db(template=True)
            
            if selected_user_id:
                kpi_data, columns, formulas = get_kpi_data_from_db(user_id=int(selected_user_id))
                return render_template(
                    'kpi/kpi_constructor.html',
                    kpi_columns=columns,
                    kpi_data=kpi_data,
                    kpi_formulas=formulas,
                    template_columns=template_columns,
                    template_data=template_data,
                    template_formulas=template_formulas,
                    users=users,
                    selected_user_id=int(selected_user_id),
                    is_admin=True
                )
            
            return render_template(
                'kpi/kpi_constructor.html',
                users=users,
                template_columns=template_columns,
                template_data=template_data,
                template_formulas=template_formulas,
                is_admin=True
            )
        else:
            kpi_data, columns, formulas = get_kpi_data_from_db(user_id=current_user.id)
            return render_template(
                'kpi/kpi_constructor.html',
                kpi_columns=columns,
                kpi_data=kpi_data,
                kpi_formulas=formulas,
                user_id=current_user.id,
                is_admin=False
            )
    except Exception as e:
        logger.error(f"Error displaying KPI constructor: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
@kpi_bp.route('/validate_formula', methods=['POST'])
@login_required
def validate_formula(formula: str, column_names: list) -> Dict[str, Any]:
    """Validate formula syntax."""
    if not formula:
        return {"valid": False, "errors": ["No formula provided"]}
    
    try:
        ast.parse(formula, mode='eval')
        used_columns = re.findall(r'\[([^\]]+)\]', formula)
        unknown_columns = [col for col in used_columns if col not in column_names]
        
        if unknown_columns:
            return {
                "valid": False,
                "errors": [f"Unknown columns: {', '.join(unknown_columns)}"]
            }
        
        return {"valid": True, "errors": []}
    except SyntaxError as e:
        return {"valid": False, "errors": [f"Syntax error: {str(e)}"]}
    except Exception as e:
        return {"valid": False, "errors": [str(e)]}

@kpi_bp.route('/add_column', methods=['POST'])
@login_required
def add_column():
    """Add a new column to KPI constructor."""
    try:
        data = request.get_json()
        column_name = data.get('column_name')
        user_id = data.get('user_id', current_user.id)
        
        if not column_name:
            return jsonify({"status": "error", "message": "Column name required"}), 400
        
        if current_user.is_admin and user_id != current_user.id:
            user = User.query.get(user_id)
            if not user:
                return jsonify({"status": "error", "message": "User not found"}), 404
        elif user_id != current_user.id:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        max_row = db.session.query(db.func.max(KPI.row_index)).filter(KPI.user_id == user_id).scalar() or 0
        for row_idx in range(max_row + 1):
            kpi_entry = KPI.query.filter_by(
                row_index=row_idx,
                column_name=column_name,
                user_id=user_id
            ).first()
            if not kpi_entry:
                new_kpi = KPI(
                    row_index=row_idx,
                    column_name=column_name,
                    value="",
                    user_id=user_id,
                    last_updated=datetime.utcnow()
                )
                db.session.add(new_kpi)
        
        db.session.commit()
        logger.info(f"Added new column: {column_name} for user {user_id}")
        return jsonify({
            "status": "success",
            "new_column": column_name,
            "column_index": -1
        })
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error adding column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error adding column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/add_template_column', methods=['POST'])
@login_required
def add_template_column():
    """Add a new column to KPI template."""
    try:
        if not current_user.is_admin:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        data = request.get_json()
        column_name = data.get('column_name')
        
        if not column_name:
            return jsonify({"status": "error", "message": "Column name required"}), 400
        
        if KPITemplate.query.filter_by(column_name=column_name).first():
            return jsonify({"status": "error", "message": "Column already exists"}), 400
        
        max_row = db.session.query(db.func.max(KPITemplate.row_index)).scalar() or 0
        for row_idx in range(max_row + 1):
            new_template = KPITemplate(
                row_index=row_idx,
                column_name=column_name,
                value=""
            )
            db.session.add(new_template)
        
        db.session.commit()
        logger.info(f"Added new template column: {column_name}")
        return jsonify({
            "status": "success",
            "new_column": column_name,
            "column_index": -1
        })
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error adding template column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error adding template column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/delete_column', methods=['POST'])
@login_required
def delete_column():
    """Delete a specific column by name."""
    try:
        data = request.get_json()
        column_name = data.get("column")
        user_id = data.get("user_id", current_user.id)
        
        if not column_name:
            return jsonify({"status": "error", "message": "Column not found"}), 400
        
        if current_user.is_admin and user_id != current_user.id:
            user = User.query.get(user_id)
            if not user:
                return jsonify({"status": "error", "message": "User not found"}), 404
        elif user_id != current_user.id:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        db.session.query(KPI).filter(
            KPI.column_name == column_name,
            KPI.user_id == user_id
        ).delete()
        
        db.session.commit()
        logger.info(f"Deleted column: {column_name} for user {user_id}")
        return jsonify({"status": "success"})
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error deleting column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error deleting column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/delete_template_column', methods=['POST'])
@login_required
def delete_template_column():
    """Delete a specific column from KPI template."""
    try:
        if not current_user.is_admin:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        data = request.get_json()
        column_name = data.get("column")
        
        if not column_name:
            return jsonify({"status": "error", "message": "Column not found"}), 400
        
        db.session.query(KPITemplate).filter(
            KPITemplate.column_name == column_name
        ).delete()
        
        db.session.commit()
        logger.info(f"Deleted template column: {column_name}")
        return jsonify({"status": "success"})
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error deleting template column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error deleting template column: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/delete_row', methods=['POST'])
@login_required
def delete_row():
    """Delete a specific row by index."""
    try:
        data = request.get_json()
        row_index = data.get("row_index")
        user_id = data.get("user_id", current_user.id)
        
        if row_index is None:
            return jsonify({"status": "error", "message": "Row index required"}), 400
        
        if current_user.is_admin and user_id != current_user.id:
            user = User.query.get(user_id)
            if not user:
                return jsonify({"status": "error", "message": "User not found"}), 404
        elif user_id != current_user.id:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        db.session.query(KPI).filter(
            KPI.row_index == row_index,
            KPI.user_id == user_id
        ).delete()
        
        db.session.query(KPI).filter(
            KPI.row_index > row_index,
            KPI.user_id == user_id
        ).update({KPI.row_index: KPI.row_index - 1})
        
        db.session.commit()
        logger.info(f"Deleted row: {row_index} for user {user_id}")
        return jsonify({"status": "success"})
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error deleting row: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error deleting row: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/delete_template_row', methods=['POST'])
@login_required
def delete_template_row():
    """Delete a specific row from KPI template."""
    try:
        if not current_user.is_admin:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        data = request.get_json()
        row_index = data.get("row_index")
        
        if row_index is None:
            return jsonify({"status": "error", "message": "Row index required"}), 400
        
        db.session.query(KPITemplate).filter(
            KPITemplate.row_index == row_index
        ).delete()
        
        db.session.query(KPITemplate).filter(
            KPITemplate.row_index > row_index
        ).update({KPITemplate.row_index: KPITemplate.row_index - 1})
        
        db.session.commit()
        logger.info(f"Deleted template row: {row_index}")
        return jsonify({"status": "success"})
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error deleting template row: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error deleting template row: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@kpi_bp.route('/save_kpi', methods=['POST'])
@login_required
def save_kpi():
    """Save KPI data for a user with column order preservation."""
    try:
        data = request.get_json()
        user_id = data.get("user_id", current_user.id)
        logger.debug(f"Saving KPI for user_id: {user_id}")

        # Проверка прав доступа
        if user_id != current_user.id and not current_user.is_admin:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403

        # Получаем порядок колонок из данных формы
        column_order = []
        for key in sorted(data.keys()):
            if key.startswith('column_name_'):
                col_idx = int(key.split('_')[2])
                column_name = str(data[key])
                if column_name and column_name not in column_order:
                    column_order.append(column_name)

        # Собираем все данные для сохранения
        cells_to_save = {}
        formulas_to_save = {}

        for key, value in data.items():
            if key.startswith('cell_'):
                parts = key.split('_')
                row_idx = int(parts[1])
                col_idx = int(parts[3])
                if col_idx < len(column_order):
                    column_name = column_order[col_idx]
                    cells_to_save[(row_idx, column_name)] = str(value) if value is not None else ""
            
            elif key.startswith('formula_'):
                parts = key.split('_')
                row_idx = int(parts[1])
                col_idx = int(parts[3])
                if col_idx < len(column_order):
                    column_name = column_order[col_idx]
                    formulas_to_save[(row_idx, column_name)] = str(value) if value else None

        with db.session.begin_nested():
            # Сохраняем данные ячеек
            for (row_idx, col_name), value in cells_to_save.items():
                kpi_entry = KPI.query.filter_by(
                    user_id=user_id,
                    row_index=row_idx,
                    column_name=col_name
                ).first()

                if kpi_entry:
                    kpi_entry.value = value
                    kpi_entry.last_updated = datetime.utcnow()
                else:
                    new_kpi = KPI(
                        user_id=user_id,
                        row_index=row_idx,
                        column_name=col_name,
                        value=value,
                        last_updated=datetime.utcnow()
                    )
                    db.session.add(new_kpi)

            # Сохраняем формулы
            for (row_idx, col_name), formula in formulas_to_save.items():
                kpi_entry = KPI.query.filter_by(
                    user_id=user_id,
                    row_index=row_idx,
                    column_name=col_name
                ).first()

                if kpi_entry:
                    kpi_entry.formula = formula
                    kpi_entry.last_updated = datetime.utcnow()
                else:
                    new_kpi = KPI(
                        user_id=user_id,
                        row_index=row_idx,
                        column_name=col_name,
                        formula=formula,
                        last_updated=datetime.utcnow()
                    )
                    db.session.add(new_kpi)

            # Пересчитываем формулы
            for (row_idx, col_name), formula in formulas_to_save.items():
                if not formula:
                    continue
                    
                try:
                    # Получаем все значения строки
                    row_data = {}
                    for entry in KPI.query.filter_by(
                        user_id=user_id,
                        row_index=row_idx
                    ).all():
                        row_data[entry.column_name] = entry.value or ""

                    # Вычисляем формулу
                    calculated = evaluate_formula(formula, row_data, column_order)
                    
                    # Обновляем calculated_value
                    kpi_entry = KPI.query.filter_by(
                        user_id=user_id,
                        row_index=row_idx,
                        column_name=col_name
                    ).first()
                    
                    if kpi_entry:
                        kpi_entry.calculated_value = calculated
                except Exception as e:
                    logger.error(f"Error evaluating formula: {str(e)}")
                    if kpi_entry:
                        kpi_entry.calculated_value = f"#ERROR: {str(e)}"

        db.session.commit()
        return jsonify({"status": "success", "message": "KPI data saved with correct column order"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/save_template', methods=['POST'])
@login_required
def save_template():
    """Save KPI template data with column order preservation."""
    try:
        if not current_user.is_admin:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        data = request.get_json()
        
        # Получаем порядок колонок из данных формы
        column_order = []
        for key in sorted(data.keys()):
            if key.startswith('template_column_name_'):
                col_idx = int(key.split('_')[3])
                column_name = str(data[key])
                if column_name and column_name not in column_order:
                    column_order.append(column_name)

        with db.session.begin_nested():
            # Очищаем старый шаблон
            db.session.query(KPITemplate).delete()
            
            # Сохраняем новые данные с правильным порядком колонок
            max_row = max([int(key.split('_')[2]) for key in data 
                         if key.startswith('template_cell_') or 
                         key.startswith('template_formula_')] + [0]) + 1
            
            for col_idx, column_name in enumerate(column_order):
                for row_idx in range(max_row):
                    # Сохраняем ячейки
                    cell_key = f"template_cell_{row_idx}_col_{col_idx}"
                    cell_value = data.get(cell_key, "")
                    
                    # Сохраняем формулы
                    formula_key = f"template_formula_{row_idx}_col_{col_idx}"
                    formula_value = data.get(formula_key, None)
                    
                    template_entry = KPITemplate(
                        row_index=row_idx,
                        column_name=column_name,
                        value=str(cell_value) if cell_value is not None else "",
                        formula=formula_value,
                        last_updated=datetime.utcnow()
                    )
                    db.session.add(template_entry)
        
        db.session.commit()
        return jsonify({"status": "success", "message": "Template saved with correct column order"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/apply_template_to_all', methods=['POST'])
@login_required
def apply_template_to_all():
    """Apply template to all users with column order preservation."""
    try:
        if not current_user.is_admin:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        # Получаем данные шаблона с порядком колонок
        template_columns = [col[0] for col in 
                          db.session.query(KPITemplate.column_name, KPITemplate.id)
                          .distinct(KPITemplate.column_name)
                          .order_by(KPITemplate.id)
                          .all()]
        
        max_row_template = db.session.query(db.func.max(KPITemplate.row_index)).scalar() or 0
        users = User.query.all()
        
        with db.session.begin_nested():
            for user in users:
                # Удаляем старые данные пользователя
                db.session.query(KPI).filter(KPI.user_id == user.id).delete()
                
                # Копируем шаблон с сохранением порядка колонок
                for row_idx in range(max_row_template + 1):
                    for col_idx, column_name in enumerate(template_columns):
                        template_entry = KPITemplate.query.filter_by(
                            row_index=row_idx,
                            column_name=column_name
                        ).first()
                        
                        if template_entry:
                            new_kpi = KPI(
                                row_index=row_idx,
                                column_name=column_name,
                                value=template_entry.value or "",
                                formula=template_entry.formula,
                                calculated_value=template_entry.calculated_value,
                                user_id=user.id,
                                last_updated=datetime.utcnow()
                            )
                            db.session.add(new_kpi)
        
        db.session.commit()
        return jsonify({"status": "success", "message": "Template applied to all users with correct column order"})
    except Exception as e:
        db.session.rollback()
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
            
        kpi_entries = KPI.query.filter_by(
            column_name=column,
            user_id=user_id
        ).order_by(KPI.row_index).all()
        
        label_column = DEFAULT_COLUMNS[0]
        label_entries = KPI.query.filter_by(
            column_name=label_column,
            user_id=user_id
        ).order_by(KPI.row_index).all()
        
        chart_data = []
        for i, entry in enumerate(kpi_entries):
            label = "Row " + str(entry.row_index + 1)
            if i < len(label_entries) and label_entries[i].row_index == entry.row_index:
                label = label_entries[i].value or label
                
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
    except SQLAlchemyError as e:
        logger.error(f"Database error getting chart data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"Error getting chart data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/debug_template')
def debug_template():
    """Debug endpoint to check KPITemplate data."""
    try:
        template_entries = KPITemplate.query.all()
        template_columns = {col[0] for col in db.session.query(KPITemplate.column_name).distinct().all()}
        max_row = db.session.query(db.func.max(KPITemplate.row_index)).scalar() or 0
        return jsonify({
            'entries': [{
                'row_index': e.row_index,
                'column_name': e.column_name,
                'value': e.value,
                'formula': e.formula,
                'calculated_value': e.calculated_value
            } for e in template_entries],
            'columns': list(template_columns),
            'max_row': max_row
        })
    except Exception as e:
        logger.error(f"Debug template error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/submit_for_review', methods=['POST'])
@login_required
def submit_for_review():
    """Отправка KPI на проверку администраторам"""
    try:
        user_id = request.json.get('user_id')
        if not user_id or user_id != current_user.id:
            return jsonify({"status": "error", "message": "Invalid user"}), 400
        
        # Получаем всех администраторов
        admins = User.query.filter_by(is_admin=True).all()
        
        if not admins:
            return jsonify({"status": "error", "message": "No admins found"}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"status": "error", "message": "User not found"}), 404
        
        # Создаем уведомления для каждого администратора
        for admin in admins:
            notify_user(
                admin.id,
                f"Пользователь {user.username} отправил KPI на проверку",
                category='warning',
                link=f"/kpi/kpi?user_id={user_id}"
            )
        
        return jsonify({"status": "success", "message": "KPI отправлен на проверку"})
    
    except Exception as e:
        logger.error(f"Ошибка при отправке на проверку: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500