import os
import shutil
from datetime import datetime, timedelta
from flask import Blueprint, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
import json
from .config import BASE_UPLOAD_FOLDER  # импортируем из config.py вместо documents.py

trash_bp = Blueprint('trash', __name__)

class TrashManager:
    def __init__(self, base_upload_folder):
        self.base_upload_folder = base_upload_folder
        
    def get_trash_folder(self, user_id):
        """Create and return user's trash folder path"""
        trash_folder = os.path.join(self.base_upload_folder, str(user_id), '.trash')
        os.makedirs(trash_folder, exist_ok=True)
        return trash_folder
        
    def get_trash_metadata_file(self, user_id):
        """Get path to trash metadata file"""
        return os.path.join(self.get_trash_folder(user_id), 'metadata.json')
        
    def move_to_trash(self, user_id, filename, original_path):
        """Move file to trash and save metadata"""
        trash_folder = self.get_trash_folder(user_id)
        trash_path = os.path.join(trash_folder, filename)
        metadata_file = self.get_trash_metadata_file(user_id)
        
        # Move file to trash
        shutil.move(original_path, trash_path)
        
        # Update metadata
        metadata = self._load_metadata(user_id)
        metadata[filename] = {
            'deleted_at': datetime.now().isoformat(),
            'original_path': original_path
        }
        
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f)
            
    def restore_file(self, user_id, filename):
        """Restore file from trash to original location"""
        metadata = self._load_metadata(user_id)
        if filename not in metadata:
            return False
            
        trash_path = os.path.join(self.get_trash_folder(user_id), filename)
        original_path = metadata[filename]['original_path']
        
        # Restore file
        os.makedirs(os.path.dirname(original_path), exist_ok=True)
        shutil.move(trash_path, original_path)
        
        # Remove from metadata
        del metadata[filename]
        with open(self.get_trash_metadata_file(user_id), 'w') as f:
            json.dump(metadata, f)
            
        return True
        
    def delete_permanently(self, user_id, filename):
        """Permanently delete file from trash"""
        trash_path = os.path.join(self.get_trash_folder(user_id), filename)
        if os.path.exists(trash_path):
            os.remove(trash_path)
            
        # Update metadata
        metadata = self._load_metadata(user_id)
        if filename in metadata:
            del metadata[filename]
            with open(self.get_trash_metadata_file(user_id), 'w') as f:
                json.dump(metadata, f)
                
    def empty_trash(self, user_id):
        """Delete all files in trash"""
        trash_folder = self.get_trash_folder(user_id)
        metadata_file = self.get_trash_metadata_file(user_id)
        
        # Remove all files except metadata.json
        for filename in os.listdir(trash_folder):
            if filename != 'metadata.json':
                os.remove(os.path.join(trash_folder, filename))
                
        # Clear metadata
        with open(metadata_file, 'w') as f:
            json.dump({}, f)
            
    def clean_old_files(self, user_id, days=30):
        """Remove files older than specified days"""
        metadata = self._load_metadata(user_id)
        threshold = datetime.now() - timedelta(days=days)
        
        for filename, data in list(metadata.items()):
            deleted_at = datetime.fromisoformat(data['deleted_at'])
            if deleted_at < threshold:
                self.delete_permanently(user_id, filename)
                
    def get_trash_contents(self, user_id):
        """Get list of files in trash with metadata"""
        metadata = self._load_metadata(user_id)
        trash_contents = []
        
        for filename, data in metadata.items():
            deleted_at = datetime.fromisoformat(data['deleted_at'])
            days_left = 30 - (datetime.now() - deleted_at).days
            
            if days_left > 0:
                trash_contents.append({
                    'name': filename,
                    'deleted_at': deleted_at.strftime('%Y-%m-%d %H:%M'),
                    'days_left': days_left
                })
            else:
                self.delete_permanently(user_id, filename)
                
        return trash_contents
        
    def _load_metadata(self, user_id):
        """Load trash metadata from file"""
        metadata_file = self.get_trash_metadata_file(user_id)
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r') as f:
                return json.load(f)
        return {}

# Create trash manager instance
trash_manager = TrashManager(BASE_UPLOAD_FOLDER)

@trash_bp.route('/trash')
@login_required
def view_trash():
    """View trash contents"""
    trash_contents = trash_manager.get_trash_contents(current_user.id)
    return render_template('trash.html', files=trash_contents)

@trash_bp.route('/trash/restore/<filename>')
@login_required
def restore_from_trash(filename):
    """Restore file from trash"""
    if trash_manager.restore_file(current_user.id, filename):
        flash(f'File {filename} restored successfully!', 'success')
    else:
        flash(f'Failed to restore {filename}', 'error')
    return redirect(url_for('trash.view_trash'))

@trash_bp.route('/trash/delete/<filename>')
@login_required
def delete_from_trash(filename):
    """Permanently delete file from trash"""
    trash_manager.delete_permanently(current_user.id, filename)
    flash(f'File {filename} permanently deleted', 'success')
    return redirect(url_for('trash.view_trash'))

@trash_bp.route('/trash/empty')
@login_required
def empty_trash():
    """Empty entire trash"""
    trash_manager.empty_trash(current_user.id)
    flash('Trash emptied successfully', 'success')
    return redirect(url_for('trash.view_trash'))