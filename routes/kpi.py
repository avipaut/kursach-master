from flask import Blueprint, request, render_template, jsonify, redirect, url_for
from flask_login import current_user, login_required
from routes.models import db, KPI, User
import logging
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any
import re
import json

# Setup logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)

kpi_bp = Blueprint('kpi', __name__)

# Default columns
DEFAULT_COLUMNS = ["Название", "Значение", "Цель", "Прогресс"]

def evaluate_formula(formula, row_data):
    """Evaluate a formula using row data."""
    try:
        # Create a safe formula evaluation context
        local_vars = {}
        
        # Add all column values as variables (using lowercase names without spaces)
        for col_name, value in row_data.items():
            safe_name = re.sub(r'[^a-zA-Z0-9]', '_', col_name).lower()
            try:
                local_vars[safe_name] = float(value)
            except (ValueError, TypeError):
                local_vars[safe_name] = 0
        
        # Replace column references with variable names
        safe_formula = formula
        for col_name in row_data.keys():
            safe_name = re.sub(r'[^a-zA-Z0-9]', '_', col_name).lower()
            pattern = r'\[' + re.escape(col_name) + r'\]'
            safe_formula = re.sub(pattern, safe_name, safe_formula)
        
        # Evaluate the formula
        result = eval(safe_formula, {"__builtins__": {}}, local_vars)
        return str(round(result, 2))
    except Exception as e:
        logger.error(f"Formula evaluation error: {e}")
        return "#ERROR"

def get_kpi_data_from_db(user_id=None, admin_view=False):
    """Get KPI data from database and format for template."""
    try:
        # Query base
        query = db.session.query(KPI)
        
        # If not admin view, filter by user_id
        if not admin_view:
            query = query.filter(KPI.user_id == user_id)
            
        # Get all KPI records
        kpis = query.order_by(KPI.user_id, KPI.row_index, KPI.column_name).all()
        
        # Get unique columns
        if admin_view:
            columns_query = db.session.query(KPI.column_name).distinct()
        else:
            columns_query = db.session.query(KPI.column_name).filter(KPI.user_id == user_id).distinct()
            
        db_columns = columns_query.all()
        columns = DEFAULT_COLUMNS.copy()
        columns.extend([col[0] for col in db_columns if col[0] not in DEFAULT_COLUMNS])
        
        # For admin view, we need to organize by user
        if admin_view:
            # Get all users who have KPI data
            user_ids = db.session.query(KPI.user_id).distinct().all()
            user_ids = [uid[0] for uid in user_ids]
            
            # Create a dictionary of user_id -> KPI data
            users_data = {}
            for user_id in user_ids:
                user = User.query.get(user_id)
                if user:
                    # Find the max row index for this user
                    max_row = db.session.query(db.func.max(KPI.row_index)).filter(KPI.user_id == user_id).scalar() or 0
                    # Create empty data matrix with 5 extra rows
                    data = [["" for _ in range(len(columns))] for _ in range(max_row + 6)]
                    
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
            data = [["" for _ in range(len(columns))] for _ in range(max_row + 6)]
            
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
        return [["" for _ in DEFAULT_COLUMNS] for _ in range(10)], DEFAULT_COLUMNS

@kpi_bp.route('/kpi', methods=['GET'])
@login_required
def kpi_constructor():
    """Main route for KPI constructor."""
    try:
        admin_view = request.args.get('admin', 'false').lower() == 'true'
        
        # Check if user is admin for admin view
        if admin_view and not current_user.is_admin:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        if admin_view:
            kpi_data, columns = get_kpi_data_from_db(admin_view=True)
            return render_template(
                'kpi_admin.html',
                users_data=kpi_data,
                kpi_columns=columns
            )
        else:
            kpi_data, columns = get_kpi_data_from_db(user_id=current_user.id)
            return render_template(
                'kpi_constructor.html',
                kpi_columns=columns,
                kpi_data=kpi_data,
                user_id=current_user.id
            )
    except Exception as e:
        logger.error(f"Error displaying KPI constructor: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/add_column', methods=['POST'])
@login_required
def add_column():
    """Add a new column to KPI constructor."""
    try:
        data = request.get_json() if request.is_json else {}
        column_name = data.get('column_name', f"Показатель {db.session.query(KPI.column_name).distinct().count() + 1}")
        
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
        label_column = DEFAULT_COLUMNS[0]  # "Название"
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