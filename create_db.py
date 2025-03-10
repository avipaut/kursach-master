# #!/usr/bin/env python
# # -*- coding: utf-8 -*-

# """
# Скрипт для создания базы данных без запуска основного приложения.
# Позволяет инициализировать структуру БД, создать админа и добавить начальные данные.
# """

# import os
# from flask import Flask
# from flask_security import hash_password
# import uuid

# # Импорт всех необходимых моделей
# from routes.models import db, User, Role, roles_users

# # Создаем приложение Flask
# app = Flask(__name__)

# # Настройка подключения к базе данных
# app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///main.db'  # Использовать текущую директорию
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SECRET_KEY'] = 'your-secret-key'  # Используйте надежный секретный ключ в продакшне

# # Инициализация базы данных с приложением
# db.init_app(app)

# def create_database():
#     """Создаёт все таблицы в базе данных."""
#     with app.app_context():
#         # Создаем таблицы
#         db.create_all()
#         print("База данных успешно создана!")

# def create_admin():
#     """Создаёт пользователя-администратора, если он не существует."""
#     with app.app_context():
#         try:
#             # Проверяем существует ли уже админ
#             admin = User.query.filter_by(username='admin').first()
#             if admin:
#                 print("Администратор уже существует!")
#                 return
            
#             # Создаем роль администратора, если ее нет
#             admin_role = Role.query.filter_by(name='admin').first()
#             if not admin_role:
#                 admin_role = Role(name='admin', description='Administrator')
#                 db.session.add(admin_role)
            
#             # Создаем пользователя-администратора
#             admin = User(
#                 username='admin',
#                 password='admin',  # Простой пароль для демо
#                 email='admin@example.com',
#                 active=True,
#                 fs_uniquifier=str(uuid.uuid4()),
#                 is_admin=True
#             )
            
#             # Добавляем роль администратора
#             admin.roles.append(admin_role)
            
#             # Сохраняем в базе данных
#             db.session.add(admin)
#             db.session.commit()
#             print("Администратор успешно создан!")
#         except Exception as e:
#             print(f"Ошибка при создании администратора: {e}")
#             db.session.rollback()

# # Функция создания стандартных досок удалена по запросу

# def main():
#     """Основная функция для запуска операций с базой данных."""
#     while True:
#         print("\nУправление базой данных:")
#         print("1. Создать базу данных (таблицы)")
#         print("2. Создать администратора")
#         print("3. Выполнить всё вышеперечисленное")
#         print("0. Выход")
        
#         choice = input("\nВыберите действие: ")
        
#         if choice == '1':
#             create_database()
#         elif choice == '2':
#             create_admin()
#         elif choice == '3':
#             create_database()
#             create_admin()
#         elif choice == '0':
#             break
#         else:
#             print("Неверный выбор. Попробуйте снова.")

# if __name__ == '__main__':
#     # Упрощенная проверка пути (в текущей директории)
#     print(f"База данных будет создана в: {os.path.abspath('main.db')}")
    
#     main()