#!/bin/bash

echo "🚀 Запуск Flask приложения в Codespace..."

# Проверяем, что зависимости установлены
if [ ! -d "venv" ]; then
    echo "📦 Создание виртуального окружения..."
    python -m venv venv
fi

echo "🔧 Активация виртуального окружения..."
source venv/bin/activate

echo "📋 Установка зависимостей..."
pip install -r requirements.txt

echo "✅ Настройка завершена!"
echo "🌐 Flask приложение будет доступно на порту 5000"
echo "🔗 Codespace автоматически откроет ссылку для доступа"

# Запуск приложения
python app.py