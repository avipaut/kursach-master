from flask import Blueprint, render_template

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/')
def reports():
    return render_template('reports.html')
