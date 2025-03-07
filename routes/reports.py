from flask import Blueprint, render_template, request, redirect, url_for, send_file, flash
from flask_sqlalchemy import SQLAlchemy
from fpdf import FPDF
import os
import pandas as pd
from routes.models import db

reports_bp = Blueprint('reports', __name__)
EXPORT_FOLDER = 'exports'
os.makedirs(EXPORT_FOLDER, exist_ok=True)

# Модель для отчетов
class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(10), nullable=False)
    author = db.Column(db.String(255))
    category = db.Column(db.String(255))

# Функция для получения всех отчетов
def get_reports(date_filter=None, author_filter=None, category_filter=None):
    query = Report.query

    if date_filter:
        query = query.filter(Report.date == date_filter)
    if author_filter:
        query = query.filter(Report.author == author_filter)
    if category_filter:
        query = query.filter(Report.category == category_filter)

    return query.all()

# === Роуты === 
@reports_bp.route('/')
def view_reports():
    date_filter = request.args.get('date_filter')
    author_filter = request.args.get('author_filter')
    category_filter = request.args.get('category_filter')

    reports = get_reports(date_filter, author_filter, category_filter)
    return render_template('reports.html', reports=reports)

@reports_bp.route('/add', methods=['GET', 'POST'])
def add_report():
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        date = request.form['date']
        author = request.form['author']
        category = request.form['category']

        new_report = Report(title=title, content=content, date=date, author=author, category=category)
        db.session.add(new_report)
        db.session.commit()

        flash('Отчет успешно добавлен!', 'success')
        return redirect(url_for('reports.view_reports'))

    return render_template('add_report.html')

@reports_bp.route('/edit/<int:report_id>', methods=['GET', 'POST'])
def edit_report(report_id):
    report = Report.query.get_or_404(report_id)

    if request.method == 'POST':
        report.title = request.form['title']
        report.content = request.form['content']
        report.date = request.form['date']
        report.author = request.form['author']
        report.category = request.form['category']

        db.session.commit()

        flash('Отчет успешно обновлен!', 'success')
        return redirect(url_for('reports.view_reports'))

    return render_template('edit_report.html', report=report)

@reports_bp.route('/delete/<int:report_id>', methods=['POST'])
def delete_report(report_id):
    report = Report.query.get_or_404(report_id)
    db.session.delete(report)
    db.session.commit()

    flash('Отчет успешно удален!', 'success')
    return redirect(url_for('reports.view_reports'))

@reports_bp.route('/export/pdf/<int:report_id>')
def export_pdf(report_id):
    report = Report.query.get_or_404(report_id)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, report.title, ln=True, align='C')
    pdf.set_font('Arial', '', 12)
    pdf.multi_cell(0, 10, f"Дата: {report.date}\n\n{report.content}")

    pdf_path = os.path.join(EXPORT_FOLDER, f"report_{report_id}.pdf")
    pdf.output(pdf_path)

    return send_file(pdf_path, as_attachment=True)

@reports_bp.route('/export/excel')
def export_excel():
    reports = get_reports()

    if not reports:
        flash('Нет отчетов для экспорта!', 'danger')
        return redirect(url_for('reports.view_reports'))

    df = pd.DataFrame([(r.id, r.title, r.content, r.date, r.author, r.category) for r in reports],
                      columns=['ID', 'Заголовок', 'Содержание', 'Дата', 'Автор', 'Категория'])
    excel_path = os.path.join(EXPORT_FOLDER, 'reports.xlsx')
    df.to_excel(excel_path, index=False)

    return send_file(excel_path, as_attachment=True)