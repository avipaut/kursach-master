# from flask import Flask
# from flask_sqlalchemy import SQLAlchemy
# from routes.models import db, User, Role, Board, List, Card, Todo, PriorityLevel
# from werkzeug.security import generate_password_hash
# import uuid

# def create_database(app):
#     """Создает и инициализирует базу данных с начальными данными"""
#     with app.app_context():
#         # Создание всех таблиц
#         db.create_all()
        
#         # Проверка, существуют ли уже роли
#         if not Role.query.first():
#             # Создание ролей
#             admin_role = Role(name='admin', description='Администратор системы')
#             user_role = Role(name='user', description='Обычный пользователь')
#             db.session.add(admin_role)
#             db.session.add(user_role)
#             db.session.commit()
            
#             print("Созданы роли: admin, user")
        
#         # Проверка, существует ли уже администратор
#         if not User.query.filter_by(username='admin').first():
#             # Создание пользователя-администратора
#             admin = User(
#                 username='admin',
#                 password=generate_password_hash('admin_password'),
#                 email='admin@example.com',
#                 active=True,
#                 fs_uniquifier=uuid.uuid4().hex
#             )
            
#             # Добавление роли администратора
#             admin_role = Role.query.filter_by(name='admin').first()
#             admin.roles.append(admin_role)
            
#             db.session.add(admin)
#             db.session.commit()
            
#             print("Создан пользователь-администратор: admin (пароль: admin_password)")
        
#         # Создание демонстрационных данных для канбан-доски
#         if not Board.query.first():
#             # Создание доски
#             board = Board(name="Проектная доска", user_id=1)
#             db.session.add(board)
#             db.session.commit()
            
#             # Создание списков
#             lists = [
#                 List(name="Запланировано", board_id=board.id),
#                 List(name="В процессе", board_id=board.id),
#                 List(name="На проверке", board_id=board.id),
#                 List(name="Завершено", board_id=board.id)
#             ]
            
#             for list_item in lists:
#                 db.session.add(list_item)
#             db.session.commit()
            
#             # Создание карточек
#             cards = [
#                 Card(title="Разработка API", description="Создать RESTful API для системы", 
#                      list_id=lists[0].id, user_id=1, priority=PriorityLevel.HIGH),
#                 Card(title="Создание интерфейса", description="Разработать UI для канбан-доски", 
#                      list_id=lists[0].id, user_id=1, priority=PriorityLevel.MEDIUM),
#                 Card(title="Тестирование системы", description="Написать автоматические тесты", 
#                      list_id=lists[1].id, user_id=1, priority=PriorityLevel.LOW)
#             ]
            
#             for card in cards:
#                 db.session.add(card)
#             db.session.commit()
            
#             # Создание задач (todos) для карточек
#             todos = [
#                 Todo(content="Спроектировать структуру API", card_id=cards[0].id),
#                 Todo(content="Реализовать эндпоинты для работы с досками", card_id=cards[0].id),
#                 Todo(content="Сделать макет интерфейса", card_id=cards[1].id),
#                 Todo(content="Разработать компоненты", card_id=cards[1].id)
#             ]
            
#             for todo in todos:
#                 db.session.add(todo)
#             db.session.commit()
            
#             print("Созданы демонстрационные данные для канбан-доски")
            
#         print("База данных успешно инициализирована")

# if __name__ == '__main__':
#     # Создаем тестовое приложение для инициализации БД
#     app = Flask(__name__)
#     app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///main.db'
#     app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
#     # Инициализация БД
#     db.init_app(app)
    
#     # Вызов функции для создания БД
#     create_database(app)