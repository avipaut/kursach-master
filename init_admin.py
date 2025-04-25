from app import app, db, create_initial_roles_and_admin
from werkzeug.security import generate_password_hash
from routes.models import User

with app.app_context():
    create_initial_roles_and_admin()
    admin = User.query.filter_by(username='admin').first()
    if admin:
        admin.password = generate_password_hash('123')
        admin.is_admin = True
        db.session.commit()
        print(f"Пароль для пользователя {admin.username} сброшен на: 123")
        print(f"Пользователь {admin.username} теперь администратор: {getattr(admin, 'is_admin', False)}")
