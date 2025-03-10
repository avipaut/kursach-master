# models.py

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Text, Boolean, Table
from sqlalchemy.orm import relationship
from flask_login import UserMixin
from enum import Enum as PyEnum

# Create SQLAlchemy instance
db = SQLAlchemy()

# Association table for User-Lobby many-to-many relationship
user_lobby = Table(
    'user_lobby',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True),
    Column('lobby_id', Integer, ForeignKey('lobbies.id', ondelete="CASCADE"), primary_key=True)
)

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(120), nullable=False)
    avatar = Column(String(255), nullable=True)  # Path to user avatar
    
    # Relationships
    boards = db.relationship('Board', backref='user', lazy=True, cascade="all, delete-orphan")
    cards = db.relationship('Card', backref='user', lazy=True)
    messages = db.relationship('Message', backref='sender', lazy=True, cascade="all, delete-orphan")
    lobbies = db.relationship('Lobby', secondary=user_lobby, back_populates='users')
    created_lobbies = db.relationship('Lobby', backref='creator', lazy=True, foreign_keys='Lobby.created_by')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'avatar': self.avatar
        }

    def __repr__(self):
        return f"<User {self.username}>"

class MessageType(PyEnum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    AUDIO = "audio"
    VIDEO = "video"
    STICKER = "sticker"

class Message(db.Model):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    lobby_id = Column(Integer, ForeignKey('lobbies.id', ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=True)  # Can be null for non-text messages
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Message type and content
    message_type = Column(Enum(MessageType), default=MessageType.TEXT)
    file_path = Column(String(255), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(50), nullable=True)  # MIME type
    
    # For tracking read status
    read_by = db.relationship('ReadReceipt', backref='message', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.username,
            'sender_avatar': self.sender.avatar,
            'lobby_id': self.lobby_id,
            'text': self.text,
            'timestamp': self.timestamp.isoformat(),
            'message_type': self.message_type.value,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'file_type': self.file_type
        }
    
    def __repr__(self):
        return f"<Message {self.id} from {self.sender_id} in lobby {self.lobby_id}>"

class ReadReceipt(db.Model):
    __tablename__ = 'read_receipts'
    message_id = Column(Integer, ForeignKey('messages.id', ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True)
    read_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<ReadReceipt message:{self.message_id} by user:{self.user_id}>"

class Lobby(db.Model):
    __tablename__ = 'lobbies'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=True)  # Can be null for direct messages
    avatar = Column(String(255), nullable=True)  # Group avatar path
    description = Column(Text, nullable=True)
    is_group = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=True)  # Can be null for system-created lobbies
    
    # Relationships
    users = db.relationship('User', secondary=user_lobby, back_populates='lobbies')
    messages = db.relationship('Message', backref='lobby', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'avatar': self.avatar,
            'description': self.description,
            'is_group': self.is_group,
            'created_at': self.created_at.isoformat(),
            'created_by': self.created_by,
            'users': [user.to_dict() for user in self.users],
            'last_message': self.get_last_message()
        }
    
    def get_last_message(self):
        last_message = Message.query.filter_by(lobby_id=self.id).order_by(Message.timestamp.desc()).first()
        if last_message:
            return last_message.to_dict()
        return None
    
    def __repr__(self):
        lobby_type = "Group" if self.is_group else "Direct"
        return f"<{lobby_type} Lobby {self.id}: {self.name or 'Unnamed'}>"

# Остальные модели оставлены без изменений
class PriorityLevel(PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class KPI(db.Model):
    __tablename__ = 'kpi'
    id = Column(Integer, primary_key=True)
    row_index = Column(Integer, nullable=False)
    column_name = Column(String(100), nullable=False)
    value = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<KPI {self.row_index} - {self.column_name}: {self.value}>"

class Board(db.Model):
    __tablename__ = 'board'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    
    lists = db.relationship('List', backref='board', cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_id': self.user_id
        }

    def __repr__(self):
        return f"<Board {self.name}>"

class List(db.Model):
    __tablename__ = 'list'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    board_id = Column(Integer, ForeignKey('board.id', ondelete="CASCADE"), nullable=False)
    
    cards = db.relationship('Card', backref='list', cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'board_id': self.board_id
        }

    def __repr__(self):
        return f"<List {self.name}>"

class Card(db.Model):
    __tablename__ = 'card'
    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(String(1000))
    created_at = Column(DateTime, default=datetime.utcnow)
    list_id = Column(Integer, ForeignKey('list.id', ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.LOW)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'list_id': self.list_id,
            'user_id': self.user_id,
            'priority': self.priority.value
        }

    def __repr__(self):
        return f"<Card {self.title} (Priority: {self.priority.name})>"