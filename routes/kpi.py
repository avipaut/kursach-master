from flask import Blueprint, render_template

kpi_bp = Blueprint('kpi', __name__)

@kpi_bp.route('/')
def kpi():
    return render_template('kpi.html')
