from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class KPI(db.Model):
    __tablename__ = 'kpi'

    id = db.Column(db.Integer, primary_key=True)
    row_index = db.Column(db.Integer, nullable=False)  # Добавлена колонка row_index
    column_name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(100), nullable=True)

    def __repr__(self):
        return f"<KPI {self.row_index} - {self.column_name}: {self.value}>"
class Board(db.Model):
    __tablename__ = 'boards'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    lists = db.relationship('List', backref='board', cascade="all, delete-orphan", lazy=True)

class List(db.Model):
    __tablename__ = 'lists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey('boards.id'), nullable=False)
    cards = db.relationship('Card', backref='list', cascade="all, delete-orphan", lazy=True)

class Card(db.Model):
    __tablename__ = 'cards'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    list_id = db.Column(db.Integer, db.ForeignKey('lists.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)  # Новое поле для порядка