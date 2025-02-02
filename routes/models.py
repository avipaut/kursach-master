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
