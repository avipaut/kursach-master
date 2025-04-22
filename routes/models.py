# models.py

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Text, Boolean, Table
import enum
from enum import Enum as PyEnum
from flask_security import RoleMixin
from sqlalchemy.orm import relationship
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SelectMultipleField, TextAreaField
from wtforms.validators import DataRequired, Email, Length, Optional

db =  SQLAlchemy()
# В models.py добавьте в начало файла:
from flask_login import UserMixin
# Таблица связи пользователей и ролей
roles_users = db.Table('roles_users',
    db.Column('user_id', db.Integer(), db.ForeignKey('users.id')),  # Изменено с 'user.id' на 'users.id'
    db.Column('role_id', db.Integer(), db.ForeignKey('role.id'))
)
class Role(db.Model, RoleMixin):
    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(80), unique=True)
    description = db.Column(db.String(255))
    # Association table for User-Lobby many-to-many relationship
user_lobby = Table(
    'user_lobby',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True),
    Column('lobby_id', Integer, ForeignKey('lobbies.id', ondelete="CASCADE"), primary_key=True)
)
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)  # Добавлено поле email
    active = db.Column(db.Boolean(), default=True)  # Добавлено поле active для Flask-Security
    fs_uniquifier = db.Column(db.String(255), unique=True)
    is_admin = db.Column(db.Boolean, default=False)
    avatar = Column(String(255), nullable=True)  # Path to user avatar
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)


    # Добавим отношения
    roles = db.relationship('Role', secondary=roles_users, 
                         backref=db.backref('users', lazy='dynamic'))
    boards = db.relationship('Board', backref='user', lazy=True)
    cards = db.relationship('Card', backref='user', lazy=True, foreign_keys='Card.user_id')

    messages = db.relationship('Message', backref='sender', lazy=True, cascade="all, delete-orphan")
    lobbies = db.relationship('Lobby', secondary=user_lobby, back_populates='users')
    created_lobbies = db.relationship('Lobby', backref='creator', lazy=True, foreign_keys='Lobby.created_by')
    assigned_cards = db.relationship('Card', foreign_keys='Card.assigned_to', backref='assigned_user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'avatar': self.avatar,
            'is_online': self.is_online,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'is_admin': self.is_admin
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
    text = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Message type and content
    message_type = Column(Enum(MessageType), default=MessageType.TEXT)
    file_path = Column(String(255), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(50), nullable=True)
    
    # For tracking read status
    read_by = db.relationship('ReadReceipt', backref='message', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        # Получаем список ID пользователей, прочитавших сообщение
        read_by_user_ids = [receipt.user_id for receipt in self.read_by]
        
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
            'file_type': self.file_type,
            'read_by': read_by_user_ids  # Добавляем список ID прочитавших
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
    created_by = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=True)
    
    # New fields for archiving functionality
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)
    archived_by = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    
    # Relationships
    users = db.relationship('User', secondary=user_lobby, back_populates='lobbies')
    messages = db.relationship('Message', backref='lobby', lazy=True, cascade="all, delete-orphan")
    archiver = db.relationship('User', foreign_keys=[archived_by], backref='archived_lobbies', lazy=True)
    
    # Update the to_dict method to include archive info
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
            'last_message': self.get_last_message(),
            'is_archived': self.is_archived,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
            'archived_by': self.archived_by
        }
    
    def get_last_message(self):
        last_message = Message.query.filter_by(lobby_id=self.id).order_by(Message.timestamp.desc()).first()
        if last_message:
            return last_message.to_dict()
        return None
    
    def __repr__(self):
        lobby_type = "Group" if self.is_group else "Direct"
        return f"<{lobby_type} Lobby {self.id}: {self.name or 'Unnamed'}>"

class PriorityLevel(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class KPI(db.Model):
    __tablename__ = 'kpi'

    id = db.Column(db.Integer, primary_key=True)
    row_index = db.Column(db.Integer, nullable=False)
    column_name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(1000), nullable=True)
    formula = db.Column(db.String(1000), nullable=True)
    calculated_value = db.Column(db.String(1000), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="CASCADE"), nullable=True)
    is_template = db.Column(db.Boolean, default=False, nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('kpi.id'), nullable=True)  # Добавлено это поле
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Отношения
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('kpi_values', lazy=True))
    template = db.relationship('KPI', remote_side=[id], backref='instances')
    creator = db.relationship('User', foreign_keys=[created_by])
    updater = db.relationship('User', foreign_keys=[updated_by])

class KPITemplateHistory(db.Model):
    __tablename__ = 'kpi_template_history'

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('kpi.id'), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    changed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    change_description = db.Column(db.String(500), nullable=True)

    template = db.relationship('KPI', backref='history_records')
    user = db.relationship('User', backref='template_changes')

class Board(db.Model):
    __tablename__ = 'board'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    admin_only = db.Column(db.Boolean, default=False)
    
    lists = db.relationship('List', backref='board', cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_id': self.user_id,
            'admin_only': self.admin_only  # Include admin_only status in API responses
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
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False)  # Creator of the card
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.LOW)
    completed = Column(db.Boolean, default=False)  # New field for completion status
    assigned_to = Column(Integer, ForeignKey('users.id'), nullable=True)  # New field for assignment
    deadline = Column(DateTime, nullable=True)  # New field for deadline
    
    # Relationships
    todos = db.relationship('Todo', backref='card', cascade="all, delete-orphan", lazy=True)
    
    # REMOVED the duplicate relationship that was causing the error
    # This line was causing the conflict:
    # assigned_user = db.relationship('User', foreign_keys=[assigned_to], backref='assigned_cards', lazy=True)
    # It's already defined in the User model with assigned_cards relationship

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'list_id': self.list_id,
            'user_id': self.user_id,
            'priority': self.priority.value,
            'completed': self.completed,
            'assigned_to': self.assigned_to,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'todos': [todo.to_dict() for todo in self.todos]  # Include todos in the card data

        }

    def __repr__(self):
        return f"<Card {self.title} (Priority: {self.priority.name})>"

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

    def __repr__(self):
        return f"<Todo {self.id}: {self.content[:20]}{'...' if len(self.content) > 20 else ''}>"
    
class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="CASCADE"), nullable=False)  # Добавьте эту строку
    message = db.Column(db.String(500), nullable=False)
    link = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read = db.Column(db.Boolean, default=False)
    category = db.Column(db.String(50), default='info')
    
    # Добавьте отношение с таблицей User
    user = db.relationship('User', backref=db.backref('notifications', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'link': self.link,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
            'read': self.read,
            'category': self.category
        }
class PendingFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    temp_path = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    
    user = db.relationship('User', backref=db.backref('pending_files', lazy=True))
    
    def __repr__(self):
        return f'<PendingFile {self.original_filename}>'
    
# Association table for CalendarEvent-User (participants) many-to-many relationship
event_participants = db.Table(
    'event_participants',
    db.Column('event_id', db.Integer, db.ForeignKey('calendar_events.id', ondelete="CASCADE"), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id', ondelete="CASCADE"), primary_key=True)
)

class EventType(PyEnum):
    TASK = "task"
    ZOOM = "zoom"
    PERSONAL = "personal"  # For personal tasks

class CalendarEvent(db.Model):
    __tablename__ = 'calendar_events'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.Text, nullable=True)
    event_type = db.Column(db.String(20), nullable=False, default='task')  # 'task', 'zoom', 'personal'
    color = db.Column(db.String(20), nullable=True)
    all_day = db.Column(db.Boolean, default=False)
    
    # Creator of the event
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    creator = db.relationship('User', foreign_keys=[creator_id], backref='created_events')
    
    # For Zoom meetings
    zoom_url = db.Column(db.String(500), nullable=True)
    zoom_meeting_id = db.Column(db.String(100), nullable=True)
    zoom_password = db.Column(db.String(50), nullable=True)
    zoom_host_key = db.Column(db.String(50), nullable=True)
    is_recorded = db.Column(db.Boolean, default=False)
    recording_url = db.Column(db.String(500), nullable=True)
    
    # Participants (for zoom meetings or shared tasks)
    participants = db.relationship('User', secondary=event_participants, backref='participating_events')
    
    # For visibility control
    is_private = db.Column(db.Boolean, default=False)  # True for personal tasks
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'start': self.start_time.isoformat(),
            'end': self.end_time.isoformat(),
            'description': self.description,
            'type': self.event_type,
            'color': self.color,
            'allDay': self.all_day,
            'creator_id': self.creator_id,
            'creator_name': self.creator.username if self.creator else None,
            'zoom_url': self.zoom_url,
            'zoom_meeting_id': self.zoom_meeting_id,
            'is_recorded': self.is_recorded,
            'recording_url': self.recording_url if self.is_recorded else None,
            'participants': [user.to_dict() for user in self.participants],
            'is_private': self.is_private
        }
    
class UserForm(FlaskForm):
    username = StringField('Имя пользователя', validators=[DataRequired(), Length(min=3, max=50)])
    email = StringField('Email', validators=[Optional(), Email()])
    password = PasswordField('Пароль', validators=[DataRequired(), Length(min=6)])
    active = BooleanField('Активен', default=True)
    roles = SelectMultipleField('Роли', coerce=int)

class RoleForm(FlaskForm):
    name = StringField('Название роли', validators=[DataRequired(), Length(max=80)])
    description = TextAreaField('Описание', validators=[Optional(), Length(max=255)])