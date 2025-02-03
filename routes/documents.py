from flask import Blueprint, render_template, request, redirect, url_for, send_from_directory, flash
import os
from googletrans import Translator
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from datetime import datetime
import mimetypes
documents_bp = Blueprint('documents', __name__)

# Основная папка для загрузок
BASE_UPLOAD_FOLDER = "uploaded_documents"

def get_user_upload_folder(user_id):
    """Create and return a unique folder for each user's uploads"""
    user_folder = os.path.join(BASE_UPLOAD_FOLDER, str(user_id))
    os.makedirs(user_folder, exist_ok=True)
    return user_folder

translator = Translator()

def allowed_file(filename):
    """Check if the file extension is allowed"""
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'jpg', 'png', 'jpeg', 'doc', 'rtf'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
def get_file_icon(filename):
    """Determine the appropriate icon based on file type"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    icons = {
        'pdf': 'fa-file-pdf',
        'docx': 'fa-file-word',
        'doc': 'fa-file-word',
        'txt': 'fa-file-alt',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'rtf': 'fa-file-alt'
    }
    return icons.get(ext, 'fa-file')
# Защищаем маршрут с загрузкой файлов
@documents_bp.route('/translate_upload', methods=['GET', 'POST'])
@login_required
async def translate_upload():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part', 'error')
            return redirect(request.url)

        file = request.files['file']
        translation_direction = request.form.get('direction', 'ky-ru')

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            user_folder = get_user_upload_folder(current_user.id)
            filepath = os.path.join(user_folder, filename)
            file.save(filepath)

            try:
                translated_content = await translate_file(filepath, direction=translation_direction)
                if translated_content:
                    translated_filename = f"translated_{filename}"
                    translated_filepath = os.path.join(user_folder, translated_filename)
                    with open(translated_filepath, 'w', encoding='utf-8') as f:
                        f.write(translated_content)
                    flash('File translated successfully!', 'success')
                    return redirect(url_for('documents.view_file', filename=translated_filename))
                else:
                    flash('Translation failed', 'error')
            except Exception as e:
                flash(f'Error during translation: {str(e)}', 'error')
        else:
            flash('Unsupported file type', 'error')

    return render_template('translate_upload.html')

async def translate_file(filepath, direction='ky-ru'):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        if direction == 'ky-ru':
            translated_content = await translator.translate(content, src='ky', dest='ru')
        elif direction == 'ru-ky':
            translated_content = await translator.translate(content, src='ru', dest='ky')
        else:
            return None

        return translated_content.text
    except Exception as e:
        print(f"Error during translation: {e}")
        return f"Error during translation: {str(e)}"  

# Главная страница для отображения файлов пользователя
@documents_bp.route('/')
@login_required
def documents():
    user_folder = get_user_upload_folder(current_user.id)
    documents = []
    
    try:
        for filename in os.listdir(user_folder):
            filepath = os.path.join(user_folder, filename)
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
    
    return render_template('documents.html', documents=documents)



@documents_bp.route('/create_documents', methods=['GET', 'POST'])
def create_documents():
    # ваш код для создания документов
    return render_template('create_document.html')
# Загрузка файла
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
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        user_folder = get_user_upload_folder(current_user.id)
        filepath = os.path.join(user_folder, filename)
        file.save(filepath)
        
        flash(f'File {filename} uploaded successfully!', 'success')
        return redirect(url_for('documents.documents'))
    
    flash('File type not allowed', 'error')
    return redirect(url_for('documents.documents'))
# Удаление файла
@documents_bp.route('/delete/<filename>', methods=['POST'])
@login_required
def delete_file(filename):
    try:
        # Папка текущего пользователя
        user_folder = get_user_upload_folder(current_user.id)
        filepath = os.path.join(user_folder, filename)
        os.remove(filepath)
        print(f"File deleted: {filename}")
        return redirect(url_for('documents.documents'))
    except FileNotFoundError:
        return "File not found", 404

# Просмотр файла
@documents_bp.route('/view/<filename>')
@login_required
def view_file(filename):
    # Папка текущего пользователя
    user_folder = get_user_upload_folder(current_user.id)
    return send_from_directory(user_folder, filename)

# Скачивание файла
@documents_bp.route('/download/<filename>')
@login_required
def download_file(filename):
    # Папка текущего пользователя
    user_folder = get_user_upload_folder(current_user.id)
    return send_from_directory(user_folder, filename, as_attachment=True)

# Перевод файла
@documents_bp.route('/translate/<filename>', methods=['GET', 'POST'])
@login_required
async def translate_file_route(filename):
    # Папка текущего пользователя
    user_folder = get_user_upload_folder(current_user.id)
    filepath = os.path.join(user_folder, filename)

    if not os.path.exists(filepath):
        return "File not found", 404
    if not filename.endswith('.txt'):
        return "Only text files can be translated", 400

    translated_content = await translate_file(filepath)

    if translated_content:
        translated_filepath = os.path.join(user_folder, f"translated_{filename}")
        with open(translated_filepath, 'w', encoding='utf-8') as file:
            file.write(translated_content)
        return redirect(url_for('documents.view_file', filename=f"translated_{filename}"))
    else:
        return f"Translation failed: {translated_content}", 500
