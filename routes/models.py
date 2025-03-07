from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
import enum
from flask_security import UserMixin, RoleMixin

db = SQLAlchemy()

# Таблица связи пользователей и ролей
roles_users = db.Table('roles_users',
    db.Column('user_id', db.Integer(), db.ForeignKey('users.id')),  # Изменено с 'user.id' на 'users.id'
    db.Column('role_id', db.Integer(), db.ForeignKey('role.id'))
)

class Role(db.Model, RoleMixin):
    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(80), unique=True)
    description = db.Column(db.String(255))

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)  # Добавлено поле email
    active = db.Column(db.Boolean(), default=True)  # Добавлено поле active для Flask-Security
    fs_uniquifier = db.Column(db.String(255), unique=True)

    # Связь с ролями
    roles = db.relationship('Role', secondary=roles_users, 
                         backref=db.backref('users', lazy='dynamic'))
    
    # Указываем конкретный внешний ключ для связи
    boards = db.relationship('Board', backref='user', lazy=True)
    cards = db.relationship('Card', foreign_keys='Card.user_id', backref='user', lazy=True)
    # Связь assigned_cards уже определена через backref в модели Card
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'roles': [role.name for role in self.roles]
        }
    
    # Методы для Flask-Security
    def has_role(self, role):
        return role in [r.name for r in self.roles]

class PriorityLevel(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class KPI(db.Model):
    __tablename__ = 'kpi'

    id = db.Column(db.Integer, primary_key=True)
    row_index = db.Column(db.Integer, nullable=False)  # Добавлена колонка row_index
    column_name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(100), nullable=True)

    def __repr__(self):
        return f"<KPI {self.row_index} - {self.column_name}: {self.value}>"

class Board(db.Model):
    __tablename__ = 'board'  
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Добавляем отношения с List
    lists = db.relationship('List', backref='board', cascade="all, delete-orphan", lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_id': self.user_id
        }

class List(db.Model):
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    board_id = Column(Integer, ForeignKey('board.id'), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'board_id': self.board_id
        }

class Card(db.Model):
    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(String(1000))
    created_at = Column(DateTime, default=datetime.utcnow)
    list_id = Column(Integer, ForeignKey('list.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Creator of the card
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.LOW)
    completed = Column(db.Boolean, default=False)  # New field for completion status
    assigned_to = Column(Integer, ForeignKey('users.id'), nullable=True)  # New field for assignment
    deadline = Column(DateTime, nullable=True)  # New field for deadline
    
    # Relationships
    todos = db.relationship('Todo', backref='card', cascade="all, delete-orphan", lazy=True)
    assigned_user = db.relationship('User', foreign_keys=[assigned_to], backref='assigned_cards', lazy=True)    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'list_id': self.list_id,
            'user_id': self.user_id,
            'createdBy': self.user.username,
            'priority': self.priority.value,
            'completed': self.completed,
            'assigned_to': self.assigned_to,
            'assigned_to_name': self.assigned_user.username if self.assigned_user else None,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'todos': [todo.to_dict() for todo in self.todos]
        }

# New Todo model for to-do lists within cards
class Todo(db.Model):
    id = Column(Integer, primary_key=True)
    content = Column(String(500), nullable=False)
    completed = Column(db.Boolean, default=False)
    card_id = Column(Integer, ForeignKey('card.id'), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'completed': self.completed,
            'card_id': self.card_id
        }