from flask import Blueprint, request, render_template, jsonify
from routes.models import db, KPI
import logging
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any

# Настройка логгера
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)

kpi_bp = Blueprint('kpi', __name__)

# Глобальные переменные для хранения состояния колонок
DEFAULT_COLUMNS = ["Название"]
kpi_columns = DEFAULT_COLUMNS.copy()

def get_kpi_data_from_db() -> tuple[List[List[str]], List[str]]:
    """Получает данные KPI из базы данных и форматирует их для шаблона."""
    try:
        # Получаем все уникальные имена колонок из базы
        db_columns = db.session.query(KPI.column_name).distinct().all()
        columns = DEFAULT_COLUMNS.copy()
        columns.extend([col[0] for col in db_columns if col[0] not in DEFAULT_COLUMNS])
        
        # Получаем все KPI записи
        kpis = KPI.query.order_by(KPI.row_index, KPI.column_name).all()
        logger.debug(f"Загружено {len(kpis)} записей KPI из базы")
        
        # Создаем пустую матрицу данных
        data = [["" for _ in range(len(columns))] for _ in range(10)]
        
        # Заполняем матрицу данными из базы
        for kpi in kpis:
            try:
                col_idx = columns.index(kpi.column_name)
                data[kpi.row_index][col_idx] = kpi.value
            except ValueError:
                logger.warning(f"Колонка {kpi.column_name} не найдена в списке колонок")
            except IndexError:
                logger.warning(f"Индекс строки {kpi.row_index} выходит за пределы матрицы")
        
        return data, columns
    except SQLAlchemyError as e:
        logger.error(f"Ошибка при получении данных из БД: {e}")
        return [["" for _ in DEFAULT_COLUMNS] for _ in range(10)], DEFAULT_COLUMNS

@kpi_bp.route('/kpi', methods=['GET'])
def kpi_constructor():
    """Основной маршрут для отображения конструктора KPI."""
    try:
        kpi_data, current_columns = get_kpi_data_from_db()
        global kpi_columns
        kpi_columns = current_columns
        
        logger.debug(f"Отображение конструктора KPI с {len(kpi_columns)} колонками")
        return render_template(
            'kpi_constructor.html',
            kpi_columns=kpi_columns,
            kpi_data=kpi_data
        )
    except Exception as e:
        logger.error(f"Ошибка при отображении конструктора KPI: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/add_column', methods=['POST'])
def add_column():
    """Добавляет новую колонку в конструктор KPI."""
    try:
        global kpi_columns
        new_column_name = f"Показатель {len(kpi_columns)}"
        kpi_columns.append(new_column_name)
        logger.info(f"Добавлена новая колонка: {new_column_name}")
        return jsonify({
            "status": "success",
            "new_column": new_column_name,
            "column_index": len(kpi_columns) - 1
        })
    except Exception as e:
        logger.error(f"Ошибка при добавлении колонки: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@kpi_bp.route('/save_kpi', methods=['POST'])
def save_kpi():
    """Сохраняет данные KPI в базу данных."""
    try:
        data = request.get_json() if request.is_json else request.form
        logger.debug(f"Получены данные для сохранения: {data}")
        
        with db.session.begin_nested():  # Создаем вложенную транзакцию
            for key, value in data.items():
                if not key.startswith('row_'):
                    continue
                    
                try:
                    # Парсим ключ формата row_X_col_Y
                    parts = key.split('_')
                    row_idx = int(parts[1])
                    col_idx = int(parts[3])
                    
                    if col_idx >= len(kpi_columns):
                        logger.warning(f"Индекс колонки {col_idx} выходит за пределы списка колонок")
                        continue
                        
                    column_name = kpi_columns[col_idx]
                    
                    # Ищем существующую запись или создаем новую
                    kpi_entry = KPI.query.filter_by(
                        row_index=row_idx,
                        column_name=column_name
                    ).first()
                    
                    if kpi_entry:
                        kpi_entry.value = value
                        logger.debug(f"Обновлена запись: {row_idx}, {column_name}, {value}")
                    else:
                        new_kpi = KPI(
                            row_index=row_idx,
                            column_name=column_name,
                            value=value
                        )
                        db.session.add(new_kpi)
                        logger.debug(f"Создана новая запись: {row_idx}, {column_name}, {value}")
                        
                except (ValueError, IndexError) as e:
                    logger.error(f"Ошибка при обработке ключа {key}: {e}")
                    continue
        
        db.session.commit()
        logger.info("Данные KPI успешно сохранены")
        return jsonify({"status": "success", "message": "Данные успешно сохранены"})
        
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Ошибка базы данных при сохранении KPI: {e}")
        return jsonify({"status": "error", "message": "Ошибка базы данных"}), 500
    except Exception as e:
        logger.error(f"Неожиданная ошибка при сохранении KPI: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
