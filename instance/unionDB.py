import sqlite3

# Подключение к старым базам
users = sqlite3.connect("your_database.db")

# Подключение к новой базе
main = sqlite3.connect("main.db")

# Создаем курсоры
cur_old1 = users.cursor()
cur_new = main.cursor()

# Извлекаем данные из старых баз
cur_old1.execute("SELECT * FROM lists")
users_data1 = cur_old1.fetchall()


# Вставляем данные в новую базу
insert_query = "INSERT INTO lists (id, name, board_id) VALUES (?, ?, ?)"

# Добавляем данные из первой базы
cur_new.executemany(insert_query, users_data1)


# Фиксируем изменения
main.commit()

# Закрываем соединения
users.close()
main.close()