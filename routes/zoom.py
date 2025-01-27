from flask import Blueprint, render_template

zoom_bp = Blueprint('zoom', __name__)

@zoom_bp.route('/')
def zoom():
    return render_template('zoom.html')
