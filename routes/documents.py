from flask import Blueprint, render_template, request, redirect, url_for, send_from_directory, flash
import os
import unicodedata
import chardet
from googletrans import Translator
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from datetime import datetime
import mimetypes
import re
from .config import BASE_UPLOAD_FOLDER 
documents_bp = Blueprint('documents', __name__)
from .trash import TrashManager  # добавьте этот импорт
from routes.models import User  # Добавим импорт модели User
from routes.auth import role_required  # Импортируем декоратор для проверки роли
# Основная папка для загрузок
trash_manager = TrashManager(BASE_UPLOAD_FOLDER)
import shutil
@documents_bp.route('/admin/users')
@role_required('admin')  # Только для администраторов
def list_users():
    users = User.query.all()
    return render_template('documents/admin_users.html', users=users)
def normalize_filename(filename):
    """
    Normalize Unicode filename while preserving Cyrillic characters
    """
    # Split filename and extension
    name, ext = os.path.splitext(filename)
    
    # Normalize the name part while preserving Cyrillic
    normalized = unicodedata.normalize('NFKC', name)
    
    # Secure the filename while keeping Cyrillic characters
    secured = secure_filename_with_cyrillic(normalized)
    
    # Return the normalized name with the original extension
    return f"{secured}{ext.lower()}"

def get_user_upload_folder(user_id):
    """Create and return a unique folder for each user's uploads"""
    user_folder = os.path.join(BASE_UPLOAD_FOLDER, str(user_id))
    os.makedirs(user_folder, exist_ok=True)
    return user_folder

def get_common_folder():
    """Create and return a folder for common documents"""
    common_folder = os.path.join(BASE_UPLOAD_FOLDER, "common")
    os.makedirs(common_folder, exist_ok=True)
    return common_folder

def get_important_folder():
    """Create and return a folder for important documents"""
    important_folder = os.path.join(BASE_UPLOAD_FOLDER, "important")
    os.makedirs(important_folder, exist_ok=True)
    return important_folder

translator = Translator()

def allowed_file(filename):
    """Check if the file extension is allowed"""
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'doc', 'rtf', 'odt'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_icon(filename):
    """Determine the appropriate icon based on file type"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    icons = {
        'pdf': 'fa-file-pdf',
        'docx': 'fa-file-word',
        'doc': 'fa-file-word',
        'txt': 'fa-file-alt',
        'rtf': 'fa-file-alt',
        'odt': 'fa-file-alt'
    }
    return icons.get(ext, 'fa-file')

def detect_file_encoding(filepath):
    """Detect file encoding using chardet"""
    with open(filepath, 'rb') as file:
        raw_data = file.read()
        result = chardet.detect(raw_data)
    return result['encoding'] or 'utf-8'

def translate_file(filepath, direction='ky-ru'):
    """
    Translate file content synchronously
    
    Args:
        filepath (str): Path to the file to translate
        direction (str): Translation direction ('ky-ru' or 'ru-ky')
    
    Returns:
        str: Translated content or None if translation fails
    """
    try:
        # Detect file encoding
        file_encoding = detect_file_encoding(filepath)
        
        # Read file with detected encoding
        with open(filepath, 'r', encoding=file_encoding) as f:
            content = f.read()
        
        # Translate content
        if direction == 'ky-ru':
            translated_content = translator.translate(content, src='ky', dest='ru').text
        elif direction == 'ru-ky':
            translated_content = translator.translate(content, src='ru', dest='ky').text
        else:
            return None

        return translated_content
    except Exception as e:
        print(f"Error during translation: {e}")
        return None







@documents_bp.route('/translate_upload', methods=['GET', 'POST'])
@login_required
def translate_upload():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part', 'error')
            return redirect(request.url)

        file = request.files['file']
        translation_direction = request.form.get('direction', 'ky-ru')
        doc_category = request.form.get('category', 'personal')

        if file and allowed_file(file.filename):
            # Use normalized filename with Unicode support
            filename = normalize_filename(file.filename)
            
            # Select the appropriate folder based on category
            if doc_category == 'common':
                folder = get_common_folder()
            elif doc_category == 'important':
                folder = get_important_folder()
            else:
                folder = get_user_upload_folder(current_user.id)
                
            filepath = os.path.join(folder, filename)
            file.save(filepath)

            try:
                translated_content = translate_file(filepath, direction=translation_direction)
                if translated_content:
                    # Add translation suffix while preserving original extension
                    name, ext = os.path.splitext(filename)
                    translated_filename = f"translated_{name}{ext}"
                    translated_filepath = os.path.join(folder, translated_filename)
                    
                    # Write translated content with UTF-8 encoding
                    with open(translated_filepath, 'w', encoding='utf-8') as f:
                        f.write(translated_content)
                    
                    flash('File translated successfully!', 'success')
                    return redirect(url_for('documents.view_file', filename=translated_filename, category=doc_category))
                else:
                    flash('Translation failed', 'error')
            except Exception as e:
                flash(f'Error during translation: {str(e)}', 'error')
        else:
            flash('Unsupported file type', 'error')

    return redirect(url_for('documents.documents'))

@documents_bp.route('/')
@login_required
def documents():
    return redirect(url_for('documents.list_documents', category='personal'))

@documents_bp.route('/<category>')
@login_required
def list_documents(category):
    if category not in ['personal', 'common', 'important']:
        category = 'personal'
    
    if category == 'personal':
        folder = get_user_upload_folder(current_user.id)
    elif category == 'common':
        folder = get_common_folder()
    else:
        folder = get_important_folder()
    
    documents = []
    
    try:
        for filename in os.listdir(folder):
            filepath = os.path.join(folder, filename)
            if os.path.isfile(filepath):
                file_stats = os.stat(filepath)
                documents.append({
                    'name': filename,
                    'size': f"{file_stats.st_size / 1024:.2f} KB",
                    'uploaded_at': datetime.fromtimestamp(file_stats.st_mtime).strftime('%Y-%m-%d %H:%M'),
                    'icon': get_file_icon(filename)
                })
    except Exception as e:
        flash(f'Error reading documents: {str(e)}', 'error')

    if not documents:
        documents = [{'name': "No documents available. Upload a new file!"}]
    
    return render_template('documents/documents.html', documents=documents, active_category=category)

@documents_bp.route('/create_documents', methods=['GET', 'POST'])
def create_documents():
    # ваш код для создания документов
    return render_template('documents/create_document.html')

@documents_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        flash('No file part', 'error')
        return redirect(request.url)
    
    file = request.files['file']
    if file.filename == '':
        flash('No selected file', 'error')
        return redirect(request.url)
    
    doc_category = request.form.get('category', 'personal')
    
    if file and allowed_file(file.filename):
        # Use our custom filename sanitizer instead of secure_filename
        filename = normalize_filename(file.filename)
        
        # Особая обработка для важных документов от обычных пользователей
        if doc_category == 'important' and not current_user.is_admin:
            # Создаем временную папку для хранения файлов до одобрения
            temp_folder = os.path.join(BASE_UPLOAD_FOLDER, 'pending')
            os.makedirs(temp_folder, exist_ok=True)
            
            # Генерируем уникальное имя файла для временного хранения
            unique_filename = f"{current_user.id}_{int(datetime.now().timestamp())}_{filename}"
            temp_filepath = os.path.join(temp_folder, unique_filename)
            
            # Сохраняем файл во временную папку
            file.save(temp_filepath)
            
            # Создаем запись о файле, ожидающем одобрения
            from .models import db, PendingFile
            pending_file = PendingFile(
                filename=unique_filename,
                original_filename=filename,
                user_id=current_user.id,
                temp_path=temp_filepath
            )
            db.session.add(pending_file)
            db.session.commit()
            
            # Отправляем уведомления всем администраторам
            from .models import User
            from .notifications import add_notification
            
            admins = User.query.filter_by(is_admin=True).all()
            for admin in admins:
                add_notification(
                    user_id=admin.id,
                    message=f'Пользователь {current_user.username} запрашивает загрузку файла "{filename}" в папку важных документов',
                    category='warning',
                    link=url_for('documents.review_pending_file', file_id=pending_file.id)
                )
            
            flash(f'Файл "{filename}" отправлен на одобрение администратору', 'info')
            return redirect(url_for('documents.list_documents', category='personal'))
        
        # Стандартная обработка для других категорий или для администраторов
        if doc_category == 'common':
            folder = get_common_folder()
        elif doc_category == 'important':
            folder = get_important_folder()
        else:
            folder = get_user_upload_folder(current_user.id)
            
        filepath = os.path.join(folder, filename)
        file.save(filepath)
        
        from .notifications import add_notification
        add_notification(
            user_id=current_user.id,
            message=f'Ваш файл "{filename}" успешно загружен',
            category='success',
            link=url_for('documents.view_file', filename=filename, category=doc_category)
        )
        
        flash(f'Файл {filename} загружен успешно!', 'success')
        return redirect(url_for('documents.list_documents', category=doc_category))
    
    flash('Недопустимый тип файла', 'error')
    return redirect(url_for('documents.list_documents', category='personal'))


@documents_bp.route('/admin/pending_files')
@login_required
@role_required('admin')
def pending_files():
    from .models import PendingFile
    
    pending_files = PendingFile.query.filter_by(status='pending').all()
    return render_template('documents/admin_pending_files.html', pending_files=pending_files)

@documents_bp.route('/admin/review_file/<int:file_id>')
@login_required
@role_required('admin')
def review_pending_file(file_id):
    from .models import PendingFile, User
    
    pending_file = PendingFile.query.get_or_404(file_id)
    user = User.query.get(pending_file.user_id)
    
    return render_template('documents/review_file.html', file=pending_file, user=user)

@documents_bp.route('/admin/approve_file/<int:file_id>', methods=['POST'])
@login_required
@role_required('admin')
def approve_file(file_id):
    from .models import db, PendingFile, User
    from .notifications import add_notification
    
    pending_file = PendingFile.query.get_or_404(file_id)
    
    if pending_file.status != 'pending':
        flash('Этот файл уже обработан', 'warning')
        return redirect(url_for('documents.pending_files'))
    
    try:
        # Получаем папку для важных документов
        important_folder = get_important_folder()
        
        # Перемещаем файл из временной папки в папку важных документов
        target_path = os.path.join(important_folder, pending_file.original_filename)
        shutil.copy(pending_file.temp_path, target_path)
        
        # Обновляем статус файла
        pending_file.status = 'approved'
        db.session.commit()
        
        # Отправляем уведомление пользователю
        add_notification(
            user_id=pending_file.user_id,
            message=f'Ваш файл "{pending_file.original_filename}" был одобрен и помещен в папку важных документов',
            category='success',
            link=url_for('documents.view_file', filename=pending_file.original_filename, category='important')
        )
        
        flash(f'Файл "{pending_file.original_filename}" успешно одобрен', 'success')
    except Exception as e:
        flash(f'Ошибка при одобрении файла: {str(e)}', 'error')
    
    return redirect(url_for('documents.pending_files'))

@documents_bp.route('/admin/reject_file/<int:file_id>', methods=['POST'])
@login_required
@role_required('admin')
def reject_file(file_id):
    from .models import db, PendingFile
    from .notifications import add_notification
    
    pending_file = PendingFile.query.get_or_404(file_id)
    
    if pending_file.status != 'pending':
        flash('Этот файл уже обработан', 'warning')
        return redirect(url_for('documents.pending_files'))
    
    try:
        # Обновляем статус файла
        pending_file.status = 'rejected'
        db.session.commit()
        
        # Отправляем уведомление пользователю
        add_notification(
            user_id=pending_file.user_id,
            message=f'Ваш запрос на добавление файла "{pending_file.original_filename}" в папку важных документов был отклонен',
            category='danger'
        )
        
        # Удаляем временный файл
        if os.path.exists(pending_file.temp_path):
            os.remove(pending_file.temp_path)
        
        flash(f'Файл "{pending_file.original_filename}" отклонен', 'info')
    except Exception as e:
        flash(f'Ошибка при отклонении файла: {str(e)}', 'error')
    
    return redirect(url_for('documents.pending_files'))
def secure_filename_with_cyrillic(filename):
    """
    Create a secure filename while preserving Cyrillic characters
    """
    # Convert spaces to underscores
    filename = filename.replace(' ', '_')
    
    # Keep only Cyrillic letters, Latin letters, numbers, and some special chars
    # This regex pattern allows Cyrillic (а-яА-ЯёЁ), Latin (a-zA-Z), digits, and some safe special chars
    cleaned_name = re.sub(r'[^а-яА-ЯёЁa-zA-Z0-9._-]', '', filename)
    
    # Remove any leading/trailing dots or spaces
    cleaned_name = cleaned_name.strip('._')
    
    # Ensure the filename isn't empty after cleaning
    if not cleaned_name:
        cleaned_name = 'unnamed_file'
        
    return cleaned_name

@documents_bp.route('/delete/<filename>', methods=['POST'])
@login_required
def delete_file(filename):
    try:
        category = request.form.get('category', 'personal')
        
        if category == 'personal':
            folder = get_user_upload_folder(current_user.id)
            trash_manager.move_to_trash(current_user.id, filename, os.path.join(folder, filename))
        elif category == 'common':
            folder = get_common_folder()
            trash_manager.move_to_trash('common', filename, os.path.join(folder, filename))
        elif category == 'important':
            folder = get_important_folder()
            trash_manager.move_to_trash('important', filename, os.path.join(folder, filename))
        
        flash(f"File moved to trash: {filename}", 'success')
        return redirect(url_for('documents.list_documents', category=category))
    except Exception as e:
        flash(f"Error moving file to trash: {str(e)}", 'error')
        return redirect(url_for('documents.list_documents', category='personal'))

@documents_bp.route('/view/<filename>')
@login_required
def view_file(filename):
    category = request.args.get('category', 'personal')
    
    if category == 'personal':
        folder = get_user_upload_folder(current_user.id)
    elif category == 'common':
        folder = get_common_folder()
    elif category == 'important':
        folder = get_important_folder()
    else:
        folder = get_user_upload_folder(current_user.id)
    
    return send_from_directory(folder, filename)

@documents_bp.route('/download/<filename>')
@login_required
def download_file(filename):
    category = request.args.get('category', 'personal')
    
    if category == 'personal':
        folder = get_user_upload_folder(current_user.id)
    elif category == 'common':
        folder = get_common_folder()
    elif category == 'important':
        folder = get_important_folder()
    else:
        folder = get_user_upload_folder(current_user.id)
    
    return send_from_directory(folder, filename, as_attachment=True)

@documents_bp.route('/translate/<filename>', methods=['GET', 'POST'])
@login_required
def translate_file_route(filename):
    category = request.args.get('category', 'personal')
    
    if category == 'personal':
        folder = get_user_upload_folder(current_user.id)
    elif category == 'common':
        folder = get_common_folder()
    elif category == 'important':
        folder = get_important_folder()
    else:
        folder = get_user_upload_folder(current_user.id)
    
    filepath = os.path.join(folder, filename)

    if not os.path.exists(filepath):
        return "File not found", 404
    if not filename.endswith('.txt'):
        return "Only text files can be translated", 400

    translated_content = translate_file(filepath)

    if translated_content:
        translated_filepath = os.path.join(folder, f"translated_{filename}")
        with open(translated_filepath, 'w', encoding='utf-8') as file:
            file.write(translated_content)
        return redirect(url_for('documents.view_file', filename=f"translated_{filename}", category=category))
    else:
        return f"Translation failed", 500
    
@documents_bp.route('/temp/preview/<filename>')
@login_required
@role_required('admin')
def preview_temp_file(filename):
    temp_folder = os.path.join(BASE_UPLOAD_FOLDER, 'pending')
    return send_from_directory(temp_folder, filename)

@documents_bp.route('/admin/user_documents/<int:user_id>')
@login_required
@role_required('admin')  # Only for administrators
def admin_view_user_documents(user_id):
    # Get the user to validate they exist
    from .models import User
    user = User.query.get_or_404(user_id)
    
    # Create the folder path for the user
    folder = get_user_upload_folder(user_id)
    
    documents = []
    
    try:
        for filename in os.listdir(folder):
            filepath = os.path.join(folder, filename)
            if os.path.isfile(filepath):
                file_stats = os.stat(filepath)
                documents.append({
                    'name': filename,
                    'size': f"{file_stats.st_size / 1024:.2f} KB",
                    'uploaded_at': datetime.fromtimestamp(file_stats.st_mtime).strftime('%Y-%m-%d %H:%M'),
                    'icon': get_file_icon(filename)
                })
    except Exception as e:
        flash(f'Error reading documents: {str(e)}', 'error')

    if not documents:
        documents = [{'name': "No documents available for this user."}]
    
    return render_template('documents/user_documents.html', documents=documents, user=user)