import sqlite3

# Функция для инициализации базы данных
def init_db():
    with sqlite3.connect('chat.db') as con:
        cur = con.cursor()
        
        # Создание таблицы пользователей
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                room TEXT
            )
        ''')

        # Создание таблицы комнат
        cur.execute('''
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        ''')

        # Создание таблицы сообщений
        cur.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                username TEXT NOT NULL,
                room TEXT NOT NULL,
                FOREIGN KEY (username) REFERENCES users (username),
                FOREIGN KEY (room) REFERENCES rooms (name)
            )
        ''')

        con.commit()

# Вызов функции для инициализации базы данных
init_db()
