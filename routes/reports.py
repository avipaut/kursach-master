from flask import Blueprint, render_template, request, redirect, url_for, send_file, flash
import sqlite3
import os
from fpdf import FPDF
import pandas as pd

reports_bp = Blueprint('reports', __name__)
DB_FILE = 'reports.db'
EXPORT_FOLDER = 'exports'
os.makedirs(EXPORT_FOLDER, exist_ok=True)

# Инициализация базы данных
def init_reports_db():
    with sqlite3.connect(DB_FILE) as con:
        cur = con.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            author TEXT,
            category TEXT
        )''')
        con.commit()

init_reports_db()

# Функция для получения всех отчетов
def get_reports(date_filter=None, author_filter=None, category_filter=None):
    query = 'SELECT id, title, content, date, author, category FROM reports WHERE 1=1'
    params = []

    if date_filter:
        query += ' AND date = ?'
        params.append(date_filter)
    if author_filter:
        query += ' AND author = ?'
        params.append(author_filter)
    if category_filter:
        query += ' AND category = ?'
        params.append(category_filter)

    with sqlite3.connect(DB_FILE) as con:
        cur = con.cursor()
        cur.execute(query, tuple(params))
        return cur.fetchall()

# === Роуты === 
# Просмотр всех отчетов
@reports_bp.route('/')
def view_reports():
    date_filter = request.args.get('date_filter')
    author_filter = request.args.get('author_filter')
    category_filter = request.args.get('category_filter')

    reports = get_reports(date_filter, author_filter, category_filter)
    return render_template('reports.html', reports=reports) 

# Добавление нового отчета
@reports_bp.route('/add', methods=['GET', 'POST'])
def add_report():
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        date = request.form['date']
        author = request.form['author']
        category = request.form['category']

        with sqlite3.connect(DB_FILE) as con:
            cur = con.cursor()
            cur.execute('INSERT INTO reports (title, content, date, author, category) VALUES (?, ?, ?, ?, ?)',
                        (title, content, date, author, category))
            con.commit()

        flash('Отчет успешно добавлен!', 'success')
        return redirect(url_for('reports.view_reports'))

    return render_template('add_report.html')

# Экспорт в PDF
@reports_bp.route('/export/pdf/<int:report_id>')
def export_pdf(report_id):
    with sqlite3.connect(DB_FILE) as con:
        cur = con.cursor()
        cur.execute('SELECT title, content, date FROM reports WHERE id = ?', (report_id,))
        report = cur.fetchone()

    if not report:
        flash('Отчет не найден!', 'danger')
        return redirect(url_for('reports.view_reports'))

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, report[0], ln=True, align='C')
    pdf.set_font('Arial', '', 12)
    pdf.multi_cell(0, 10, f"Дата: {report[2]}\n\n{report[1]}")

    pdf_path = os.path.join(EXPORT_FOLDER, f"report_{report_id}.pdf")
    pdf.output(pdf_path)

    return send_file(pdf_path, as_attachment=True)

# Экспорт в Excel
@reports_bp.route('/export/excel')
def export_excel():
    reports = get_reports()

    if not reports:
        flash('Нет отчетов для экспорта!', 'danger')
        return redirect(url_for('reports.view_reports'))

    df = pd.DataFrame(reports, columns=['ID', 'Заголовок', 'Содержание', 'Дата', 'Автор', 'Категория'])
    excel_path = os.path.join(EXPORT_FOLDER, 'reports.xlsx')
    df.to_excel(excel_path, index=False)

    return send_file(excel_path, as_attachment=True)
