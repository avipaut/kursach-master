// global.js - Image handling functionality + chat notification badge

// Инициализация модального окна для просмотра изображений
function setupGlobalImageModal() {
    // Удаляем существующее модальное окно, если оно есть
    const existingModal = document.getElementById('globalImageModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'globalImageModal';
    modal.className = 'global-image-modal';
    
    const closeBtn = document.createElement('div');
    closeBtn.className = 'global-image-modal-close';
    closeBtn.innerHTML = '&times;';
    
    const content = document.createElement('div');
    content.className = 'global-image-modal-content';
    
    const img = document.createElement('img');
    img.id = 'globalModalImage';
    
    content.appendChild(img);
    modal.appendChild(content);
    modal.appendChild(closeBtn);
    
    document.body.appendChild(modal);
    
    // Закрытие по клику на крестик
    closeBtn.addEventListener('click', closeGlobalImageModal);
    
    // Закрытие по клику вне изображения
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeGlobalImageModal();
        }
    });
    
    // Обработка нажатия клавиши Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeGlobalImageModal();
        }
    });
    
    return { modal, img };
}

// Функция для открытия изображения в модальном окне
function openGlobalImageModal(imgSrc) {
    let modal = document.getElementById('globalImageModal');
    let modalImage = document.getElementById('globalModalImage');
    
    // Если модальное окно не существует, создаем его
    if (!modal || !modalImage) {
        const modalElements = setupGlobalImageModal();
        modal = modalElements.modal;
        modalImage = modalElements.img;
    }
    
    // Устанавливаем источник изображения
    modalImage.src = imgSrc;
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    
    // Запрещаем прокрутку страницы
    document.body.style.overflow = 'hidden';
}

// Функция для закрытия модального окна
function closeGlobalImageModal() {
    const modal = document.getElementById('globalImageModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Возвращаем прокрутку страницы
    document.body.style.overflow = '';
}

// Добавляем обработчик для всех изображений на странице
function setupImageViewers() {
    // Добавляем обработчики для сообщений с изображениями в чате
    const chatImages = document.querySelectorAll('.attachment-image, .image-container img');
    chatImages.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
            openGlobalImageModal(this.src);
        });
    });
    
    // Добавляем обработчики для других изображений, которые можно открыть на полный экран
    const viewableImages = document.querySelectorAll('.viewable-image, .shared-file-preview img');
    viewableImages.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
            openGlobalImageModal(this.src);
        });
    });
}

// Настройка WebSocket для обновления счетчика непрочитанных сообщений на всех страницах
function setupChatNotificationBadge() {
    // Проверяем, есть ли Socket.IO на странице
    if (typeof io !== 'undefined') {
        // Создаем отдельный сокет для уведомлений о сообщениях
        const chatNotificationSocket = io({
            transports: ['websocket'],
            upgrade: false
        });
        
        // Получаем текущего пользователя
        fetch('/chat/api/user/current')
            .then(response => response.json())
            .then(user => {
                if (user && user.id) {
                    // При подключении
                    chatNotificationSocket.on('connect', function() {
                        console.log('Chat notification socket connected');
                        // Присоединяемся к комнате пользователя
                        chatNotificationSocket.emit('join_user_room', { user_id: user.id });
                    });
                    
                    // При получении нового сообщения
                    chatNotificationSocket.on('new_message', function(message) {
                        if (message.sender_id !== user.id) {
                            // Обновляем индикатор непрочитанных сообщений
                            updateUnreadMessagesIndicator();
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching current user:', error);
            });
    }
}

// Добавляем стили для непрочитанных сообщений
function addUnreadBadgeStyles() {
    if (!document.getElementById('unreadBadgeStyles')) {
        const style = document.createElement('style');
        style.id = 'unreadBadgeStyles';
        style.textContent = `
            .unread-chat-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background-color: #f54b64;
                color: white;
                font-size: 0.7rem;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-weight: bold;
            }
            
            @media (max-width: 768px) {
                .unread-chat-badge {
                    top: 0;
                    right: 0;
                    font-size: 0.65rem;
                    width: 18px;
                    height: 18px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Модификация поведения страницы чатов, применяется чаще и раньше
function modifyChatBehavior() {
    // Проверяем, что существуют нужные элементы
    const noChatSelected = document.getElementById('noChatSelected');
    const contactsList = document.getElementById('contactsList');
    
    if (!noChatSelected || !contactsList) {
        console.log("Модификация чата: не найдены необходимые элементы, повтор через 100ms");
        setTimeout(modifyChatBehavior, 100);
        return;
    }
    
    console.log("Модификация чата: начало настройки");
    
    // Убедиться, что список контактов всегда отображается
    contactsList.style.display = 'flex';
    contactsList.style.flexDirection = 'column';
    
    // Показать "Ваши сообщения" по умолчанию
    noChatSelected.style.display = 'flex';
    
    // Перезаписываем функцию initApp, если она существует
    if (typeof window.initApp === 'function') {
        console.log("Модификация чата: найдена и перезаписана функция initApp");
        const originalInitApp = window.initApp;
        window.initApp = function() {
            // Вызываем оригинальную функцию
            originalInitApp.apply(this, arguments);
            
            // Проверяем и загружаем контакты принудительно если их нет
            if (window.lobbiesList && window.lobbiesList.length === 0) {
                console.log("Контакты не загружены, пробуем загрузить");
                if (typeof window.fetchLobbies === 'function') {
                    window.fetchLobbies().then(() => {
                        console.log("Контакты загружены, рендерим");
                        if (typeof window.renderContacts === 'function') {
                            window.renderContacts();
                        }
                    });
                }
            }
            
            // Убеждаемся, что "Ваши сообщения" показываются по умолчанию
            if (noChatSelected && noChatSelected.style.display === 'none') {
                noChatSelected.style.display = 'flex';
            }
            
            // Убеждаемся, что чаты отсортированы по последнему сообщению
            if (typeof window.renderContacts === 'function') {
                window.renderContacts();
            }
        };
    }
    
    // Перезаписываем функцию selectLobby, чтобы она не сохраняла выбранный чат в localStorage
    if (typeof window.selectLobby === 'function') {
        console.log("Модификация чата: найдена и перезаписана функция selectLobby");
        const originalSelectLobby = window.selectLobby;
        window.selectLobby = function(lobbyId, userInitiated) {
            // Вызываем оригинальную функцию, но не позволяем автоматическое сохранение
            if (arguments.length > 1) {
                // Если передан параметр userInitiated, используем его
                originalSelectLobby.call(this, lobbyId, userInitiated);
            } else {
                // Иначе всегда указываем userInitiated=false, чтобы предотвратить сохранение в localStorage
                originalSelectLobby.call(this, lobbyId, false);
            }
        };
    }
    
    // Также обрабатываем случай загрузки страницы
    if (typeof window.handleUrlParams === 'function') {
        console.log("Модификация чата: найдена и перезаписана функция handleUrlParams");
        const originalHandleUrlParams = window.handleUrlParams;
        window.handleUrlParams = function() {
            // Получаем параметры URL
            const urlParams = new URLSearchParams(window.location.search);
            const lobbyId = urlParams.get('lobby_id');
            
            // Если в URL есть lobby_id, используем его
            if (lobbyId) {
                originalHandleUrlParams.apply(this, arguments);
            } else {
                // Иначе просто показываем "Ваши сообщения"
                if (noChatSelected) {
                    noChatSelected.style.display = 'flex';
                }
                if (typeof window.showNoChatSelectedView === 'function') {
                    window.showNoChatSelectedView();
                }
            }
        };
    }
    
    // Пытаемся форсировать рендеринг контактов
    if (typeof window.fetchLobbies === 'function' && typeof window.renderContacts === 'function') {
        console.log("Инициируем принудительную загрузку контактов");
        window.fetchLobbies().then(() => {
            console.log("Принудительная загрузка контактов завершена, рендерим");
            window.renderContacts();
        });
    }
    
    console.log("Модификация чата: настройка завершена");
}

// Код для чата - обеспечивает отображение существующих чатов при загрузке страницы чатов
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM загружен, запускается global.js");
    
    // Добавляем глобальные стили
    addUnreadBadgeStyles();
    
    // Настраиваем обновление счетчика непрочитанных сообщений
    setupChatNotificationBadge();
    
    // Сразу обновляем счетчик при загрузке страницы
    updateUnreadMessagesIndicator();
    
    // Создаем стили для модального окна, если их нет
    if (!document.getElementById('globalImageModalStyles')) {
        const style = document.createElement('style');
        style.id = 'globalImageModalStyles';
        style.textContent = `
            .global-image-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.9);
                z-index: 10000;
                display: none;
                justify-content: center;
                align-items: center;
                cursor: pointer;
            }
            
            .global-image-modal-content {
                position: relative;
                max-width: 90%;
                max-height: 90%;
            }
            
            .global-image-modal-content img {
                max-width: 100%;
                max-height: 90vh;
                object-fit: contain;
                border-radius: 4px;
                cursor: auto;
            }
            
            .global-image-modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                color: white;
                font-size: 40px;
                cursor: pointer;
                z-index: 10001;
                width: 40px;
                height: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: all 0.2s;
            }
            
            .global-image-modal-close:hover {
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Настраиваем модальное окно для просмотра изображений
    setupGlobalImageModal();
    
    // Добавляем обработчики для изображений
    setupImageViewers();
    
    // Проверяем, находимся ли мы на странице чатов
    const isChatPage = window.location.pathname.includes('/chat');
    if (!isChatPage) {
        // Установить интервал для периодического обновления счетчика на других страницах
        setInterval(updateUnreadMessagesIndicator, 60000); // Каждую минуту
        return;
    }
    
    console.log("Обнаружена страница чатов, запускаем модификацию");
    
    // Освобождаем localStorage от сохраненного ID лобби
    localStorage.removeItem('currentLobbyId');
    
    // Запускаем модификацию с несколькими повторами
    modifyChatBehavior();
    setTimeout(modifyChatBehavior, 200);  // Через 200ms
    setTimeout(modifyChatBehavior, 500);  // Через 500ms
    setTimeout(modifyChatBehavior, 1000); // Через 1 секунду
    setTimeout(modifyChatBehavior, 2000); // Через 2 секунды
    
    // Наблюдатель за изменениями DOM для добавления обработчиков к новым изображениям и повторного запуска модификации
    const observer = new MutationObserver(function(mutations) {
        let shouldRefreshImageViewers = false;
        let shouldModifyChat = false;
        
        mutations.forEach(function(mutation) {
            // Если были добавлены новые узлы
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Проверяем, есть ли среди добавленных узлов изображения или элементы чата
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Элемент
                        if (node.tagName === 'IMG' || node.querySelector('img')) {
                            shouldRefreshImageViewers = true;
                        }
                        if (node.id === 'contactsList' || node.id === 'noChatSelected' || 
                            node.querySelector('#contactsList') || node.querySelector('#noChatSelected')) {
                            shouldModifyChat = true;
                        }
                    }
                });
            }
        });
        
        // Если были добавлены изображения, обновляем обработчики
        if (shouldRefreshImageViewers) {
            setupImageViewers();
        }
        
        // Если были добавлены элементы чата, повторяем модификацию
        if (shouldModifyChat) {
            console.log("Обнаружены изменения в DOM чата, запускаем модификацию");
            modifyChatBehavior();
        }
    });
    
    // Настраиваем наблюдение за изменениями в содержимом документа
    observer.observe(document.body, { childList: true, subtree: true });
});

// Обработчик для динамически загруженных изображений
document.addEventListener('load', function(event) {
    if (event.target.tagName === 'IMG') {
        // Проверяем, относится ли изображение к категории тех, что нужно открывать на весь экран
        if (event.target.classList.contains('attachment-image') || 
            event.target.parentNode.classList.contains('image-container') ||
            event.target.classList.contains('viewable-image') ||
            event.target.parentNode.classList.contains('shared-file-preview')) {
            
            event.target.style.cursor = 'pointer';
            event.target.addEventListener('click', function() {
                openGlobalImageModal(this.src);
            });
        }
    }
}, true); // Используем capturing для перехвата событий на ранней стадии