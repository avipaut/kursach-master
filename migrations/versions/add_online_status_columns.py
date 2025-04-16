import os
import sqlite3
import sys

# Получаем путь к файлу приложения (поскольку мы находимся в том же каталоге)
db_path = "main.db"  # База данных находится в корневом каталоге проекта

# Проверяем, существует ли файл базы данных
if not os.path.exists(db_path):
    print(f"Database file not found: {db_path}")
    print("Make sure the database exists and you're running this script from the project root.")
    sys.exit(1)

# Подключаемся к базе данных
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Проверяем, существуют ли уже столбцы
    cursor.execute("PRAGMA table_info(users)")
    columns = [column[1] for column in cursor.fetchall()]
    
    # Добавляем столбец is_online, если его нет
    if 'is_online' not in columns:
        cursor.execute('ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT 0')
        print("Column is_online added successfully!")
    else:
        print("Column is_online already exists.")
    
    # Добавляем столбец last_seen, если его нет
    if 'last_seen' not in columns:
        cursor.execute('ALTER TABLE users ADD COLUMN last_seen TIMESTAMP')
        print("Column last_seen added successfully!")
    else:
        print("Column last_seen already exists.")
    
    conn.commit()
    print("Migration completed successfully!")
except Exception as e:
    print(f"Error during migration: {e}")
finally:
    conn.close()