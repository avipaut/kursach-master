
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
import enum

db =  SQLAlchemy()
# В models.py добавьте в начало файла:
from flask_login import UserMixin

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    
    # Добавим отношения
    boards = db.relationship('Board', backref='user', lazy=True)
    cards = db.relationship('Card', backref='user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username
        }
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
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Добавляем связь с пользователем
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.LOW)  # Добавляем приоритет
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'list_id': self.list_id,
            'user_id': self.user_id,
            'createdBy': self.user.username,  # Добавляем имя пользователя
            'priority': self.priority.value
            
        }