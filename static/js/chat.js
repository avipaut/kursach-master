// chat.js
// Функция для инициализации на всех страницах
function initGlobalNotifications() {
    // Проверяем, запущена ли эта функция ранее
    if (window.globalNotificationsInitialized) return;
    window.globalNotificationsInitialized = true;
    
    console.log("Инициализация глобальных уведомлений на всех страницах");
    
    // Добавляем стили для бейджа непрочитанных сообщений
    addUnreadBadgeStyles();
    
    // Создаем глобальный сокет для уведомлений
    setupGlobalNotificationSocket();
    
    // Сразу обновляем счетчик при загрузке
    updateUnreadMessagesIndicator();
    
    // Обновляем каждую минуту
    setInterval(updateUnreadMessagesIndicator, 60000);
}

// Функция для добавления стилей бейджа
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

// Функция для создания глобального сокета для уведомлений
function setupGlobalNotificationSocket() {
    if (typeof io !== 'undefined') {
        // Создаем глобальный сокет для уведомлений, если его еще нет
        if (!window.globalNotificationSocket) {
            console.log("Создание глобального сокета для уведомлений");
            
            window.globalNotificationSocket = io({
                transports: ['websocket'],
                upgrade: false
            });
            
            // При подключении
            window.globalNotificationSocket.on('connect', function() {
                console.log('Глобальный сокет для уведомлений подключен');
                
                // Получаем текущего пользователя
                fetch('/chat/api/user/current')
                    .then(response => response.json())
                    .then(user => {
                        if (user && user.id) {
                            // Присоединяемся к комнате пользователя
                            window.globalNotificationSocket.emit('join_user_room', { user_id: user.id });
                            
                            // Обновляем счетчик непрочитанных сообщений
                            updateUnreadMessagesIndicator();
                        }
                    })
                    .catch(error => {
                        console.error('Ошибка получения текущего пользователя:', error);
                    });
            });
            
            // При получении нового сообщения
            window.globalNotificationSocket.on('new_message', function(message) {
                // Обновляем счетчик непрочитанных сообщений
                updateUnreadMessagesIndicator();
                
                // Воспроизводим звук уведомления, если сообщение от другого пользователя
                if (window.currentUser && message.sender_id !== window.currentUser.id) {
                    playNotificationSound(message);
                }
            });
            
            // При чтении сообщений
            window.globalNotificationSocket.on('messages_read', function() {
                // Обновляем счетчик непрочитанных сообщений
                updateUnreadMessagesIndicator();
            });
        }
    }
}

// Функция для обновления индикатора непрочитанных сообщений
function updateUnreadMessagesIndicator() {
    fetch('/chat/api/unread_messages_total')
        .then(response => response.json())
        .then(data => {
            // Обновляем индикатор в навигационной панели
            const navChatLink = document.querySelector('a.nav-link[href*="chat"]');
            if (navChatLink) {
                // Находим или создаем бейдж для непрочитанных сообщений
                let unreadBadge = navChatLink.querySelector('.unread-chat-badge');
                
                if (data.unread_count > 0) {
                    if (!unreadBadge) {
                        unreadBadge = document.createElement('span');
                        unreadBadge.className = 'unread-chat-badge';
                        navChatLink.appendChild(unreadBadge);
                    }
                    // Обновляем содержимое бейджа
                    unreadBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
                } else if (unreadBadge) {
                    unreadBadge.remove();
                }
            }
        })
        .catch(error => {
            console.error('Ошибка получения числа непрочитанных сообщений:', error);
        });
}

// Запускаем глобальные уведомления при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Получаем текущего пользователя
    fetch('/chat/api/user/current')
        .then(response => response.json())
        .then(user => {
            // Сохраняем информацию о пользователе глобально
            window.currentUser = user;
            
            // Инициализируем глобальные уведомления
            initGlobalNotifications();
        })
        .catch(error => {
            console.error('Ошибка получения текущего пользователя:', error);
            // Все равно пробуем инициализировать уведомления
            initGlobalNotifications();
        });
});

document.addEventListener('DOMContentLoaded', function() {
    // Добавляем стили для контекстного меню чатов, если их еще нет
    if (!document.getElementById('chat-context-menu-styles')) {
        const style = document.createElement('style');
        style.id = 'chat-context-menu-styles';
        style.textContent = `
            .chat-context-menu-trigger {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s, background-color 0.2s;
                background-color: var(--secondary-color);
                cursor: pointer;
                z-index: 5;
            }
            
            .contact-item {
                position: relative;
            }
            
            .contact-item:hover .chat-context-menu-trigger {
                opacity: 1;
            }
            
            .chat-context-menu-trigger:hover {
                background-color: var(--border-color);
            }
            
            /* Фиксируем позицию контекстного меню относительно документа */
            #activeContextMenu {
                position: fixed;
                z-index: 1000;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
            }
        `;
        document.head.appendChild(style);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Добавляем стили для диалогов подтверждения
    if (!document.getElementById('confirmation-dialog-styles')) {
        const style = document.createElement('style');
        style.id = 'confirmation-dialog-styles';
        style.textContent = `
            .confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            
            .confirmation-content {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 350px;
                padding: 1.25rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .confirmation-title {
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 0.75rem;
            }
            
            .confirmation-message {
                margin-bottom: 1.25rem;
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            
            .confirmation-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
            }
            
            .btn-cancel,
            .btn-confirm {
                padding: 0.4rem 0.8rem;
                border-radius: 4px;
                font-size: 0.85rem;
                cursor: pointer;
                transition: background-color 0.2s;
            }
        `;
        document.head.appendChild(style);
    }
});

// Определяем, является ли устройство iOS
function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Add this function to your existing JavaScript
function initChatInterface() {
    const chatContainer = document.getElementById('chatContainer');
    const contactsContainer = document.querySelector('.contacts-container');
    const activeChat = document.getElementById('activeChat');
    const contactItems = document.querySelectorAll('.contact-item');
    const mobileChatBack = document.getElementById('mobileChatBack');
    
    // Function to open chat
    function openChat(chatId) {
        // Hide "no chat selected" message
        document.getElementById('noChatSelected').style.display = 'none';
        
        // Show the active chat
        activeChat.style.display = 'flex';
        
        // On mobile only: add the mobile-chat-active class to body
        if (window.innerWidth < 768) {
            document.body.classList.add('mobile-chat-active');
        }
    }
    
    // Add click event to each contact item
    contactItems.forEach(contact => {
        contact.addEventListener('click', function() {
            const chatId = this.getAttribute('data-chat-id');
            openChat(chatId);
        });
    });
    
    // Back button for mobile only
    if (mobileChatBack) {
        mobileChatBack.addEventListener('click', function() {
            document.body.classList.remove('mobile-chat-active');
        });
    }
    
    // Detect window resize and reset mobile classes if needed
    window.addEventListener('resize', function() {
        if (window.innerWidth >= 768) {
            document.body.classList.remove('mobile-chat-active');
        }
    });
}

// Глобальные переменные для модального окна изображений
let imageViewerModal = null;
let imageViewerImg = null;

// Функция для инициализации модального окна просмотра изображений
function setupImageViewer() {
    console.log("Настройка просмотрщика изображений");
    
    // Если модальное окно уже существует, удаляем его, чтобы избежать дублирования
    const existingModal = document.getElementById('imageViewerModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Проверяем, существуют ли стили для модального окна, если нет - добавляем
    if (!document.getElementById('image-viewer-styles')) {
        const style = document.createElement('style');
        style.id = 'image-viewer-styles';
        style.textContent = `
            #imageViewerModal {
                display: none;
                position: fixed;
                z-index: 9999;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.9);
                overflow: hidden;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            #imageViewerModal.visible {
                opacity: 1;
            }
            
            .image-viewer-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: auto;
                height: auto;
                max-width: 90%;
                max-height: 90%;
                text-align: center;
            }
            
            .image-viewer-img {
                max-width: 100%;
                max-height: 90vh;
                border-radius: 4px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                cursor: default;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .image-viewer-img.loaded {
                opacity: 1;
            }
            
            .image-viewer-close {
                position: absolute;
                top: 20px;
                right: 30px;
                color: #f1f1f1;
                font-size: 40px;
                font-weight: bold;
                cursor: pointer;
                z-index: 10000;
                transition: 0.2s;
                width: 40px;
                height: 40px;
                line-height: 40px;
                text-align: center;
                border-radius: 50%;
            }
            
            .image-viewer-close:hover {
                color: #fff;
                background-color: rgba(255, 255, 255, 0.2);
                transform: scale(1.1);
            }
            
            .image-viewer-loader {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                border: 5px solid #f3f3f3;
                border-top: 5px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: image-viewer-spin 1s linear infinite;
            }
            
            @keyframes image-viewer-spin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'imageViewerModal';
    
    // Добавляем кнопку закрытия
    const closeBtn = document.createElement('span');
    closeBtn.className = 'image-viewer-close';
    closeBtn.innerHTML = '&times;';
    
    // Добавляем контейнер для изображения
    const modalContent = document.createElement('div');
    modalContent.className = 'image-viewer-content';
    
    // Добавляем индикатор загрузки
    const loader = document.createElement('div');
    loader.className = 'image-viewer-loader';
    
    // Добавляем элемент изображения
    const img = document.createElement('img');
    img.className = 'image-viewer-img';
    img.alt = 'Image preview';
    
    // Собираем модальное окно
    modalContent.appendChild(loader);
    modalContent.appendChild(img);
    modal.appendChild(closeBtn);
    modal.appendChild(modalContent);
    
    // Добавляем модальное окно в DOM
    document.body.appendChild(modal);
    
    // Сохраняем ссылки на элементы
    imageViewerModal = modal;
    imageViewerImg = img;
    
    // Обработчик для отслеживания загрузки изображения
    img.addEventListener('load', function() {
        // Скрываем индикатор загрузки
        loader.style.display = 'none';
        // Показываем изображение плавно
        img.classList.add('loaded');
    });
    
    // Функция закрытия модального окна
    function closeModal() {
        if (imageViewerModal) {
            // Плавное скрытие
            imageViewerModal.classList.remove('visible');
            
            // После анимации закрытия
            setTimeout(() => {
                imageViewerModal.style.display = 'none';
                
                // Сбрасываем изображение при закрытии
                if (imageViewerImg) {
                    imageViewerImg.src = '';
                    imageViewerImg.classList.remove('loaded');
                }
                
                // Показываем индикатор загрузки для следующего открытия
                loader.style.display = 'block';
                
                // Возвращаем прокрутку страницы
                document.body.style.overflow = '';
            }, 300);
        }
    }
    
    // Закрытие по клику на крестик
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeModal();
    });
    
    // Закрытие по клику вне изображения
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Предотвращаем закрытие при клике на изображение
    img.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Обработка нажатия клавиши Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && imageViewerModal && imageViewerModal.classList.contains('visible')) {
            closeModal();
        }
    });
    
    // Глобальные функции для открытия и закрытия
    window.openImageModal = function(imgSrc) {
        if (!imageViewerModal || !imageViewerImg) {
            setupImageViewer();
        }
        
        try {
            // Показываем модальное окно
            imageViewerModal.style.display = 'block';
            
            // Показываем индикатор загрузки
            const loader = imageViewerModal.querySelector('.image-viewer-loader');
            if (loader) {
                loader.style.display = 'block';
            }
            
            // Скрываем предыдущее изображение
            imageViewerImg.classList.remove('loaded');
            
            // Небольшая задержка для плавности анимации
            setTimeout(() => {
                // Устанавливаем источник изображения
                imageViewerImg.src = imgSrc;
                
                // Плавно показываем модальное окно
                imageViewerModal.classList.add('visible');
                
                // Блокируем прокрутку страницы
                document.body.style.overflow = 'hidden';
            }, 50);
            
            console.log("Открыто изображение:", imgSrc);
        } catch (error) {
            console.error("Ошибка при открытии изображения:", error);
            closeModal();
        }
    };
    
    window.closeImageModal = closeModal;
    
    return { modal, img };
}

// Функция для добавления обработчиков для изображений
function addImageClickHandlers() {
    try {
        // Находим все изображения во вложениях
        const attachmentImages = document.querySelectorAll('.message-attachment img, .attachment-image, .shared-file-preview img');
        
        attachmentImages.forEach(img => {
            // Проверяем, добавлен ли обработчик клика
            if (!img.hasAttribute('data-click-handler-added')) {
                // Добавляем стиль курсора и обработчик клика
                img.style.cursor = 'pointer';
                
                img.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Получаем URL изображения
                    const imgSrc = this.src;
                    
                    console.log("Клик по изображению:", imgSrc);
                    
                    // Открываем изображение в просмотрщике
                    if (typeof window.openImageModal === 'function') {
                        window.openImageModal(imgSrc);
                    } else {
                        // Если функция просмотра не определена, инициализируем 
                        setupImageViewer();
                        window.openImageModal(imgSrc);
                    }
                });
                
                // Отмечаем, что обработчик добавлен
                img.setAttribute('data-click-handler-added', 'true');
            }
        });
        
        console.log(`Обработчики кликов добавлены к ${attachmentImages.length} изображениям`);
    } catch (error) {
        console.error("Ошибка при добавлении обработчиков кликов для изображений:", error);
    }
}

// Функция для наблюдения за динамически добавляемыми изображениями
function setupImageWatcher() {
    // Проверяем поддержку MutationObserver
    if (!window.MutationObserver) {
        console.warn("MutationObserver не поддерживается в этом браузере");
        return;
    }
    
    // Проверяем, запущен ли наблюдатель ранее
    if (window.imageWatcherObserver) {
        console.log("Наблюдатель за изображениями уже запущен");
        return window.imageWatcherObserver;
    }
    
    // Создаем наблюдатель
    const observer = new MutationObserver(function(mutations) {
        let hasNewImages = false;
        
        // Проверяем изменения в DOM
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Проверяем каждый добавленный узел
                mutation.addedNodes.forEach(node => {
                    // Проверяем, является ли узел элементом DOM
                    if (node.nodeType === 1) {
                        // Проверяем, является ли узел изображением
                        if (node.tagName === 'IMG') {
                            hasNewImages = true;
                        } 
                        // Или содержит изображения
                        else if (node.querySelectorAll && node.querySelectorAll('img').length > 0) {
                            hasNewImages = true;
                        }
                    }
                });
            }
        });
        
        // Если были добавлены новые изображения, обновляем обработчики
        if (hasNewImages) {
            console.log("Обнаружены новые изображения, добавляем обработчики");
            setTimeout(addImageClickHandlers, 100);
        }
    });
    
    // Начинаем наблюдение за всем DOM
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log("Наблюдатель за изображениями настроен");
    
    // Сохраняем наблюдатель глобально
    window.imageWatcherObserver = observer;
    
    return observer;
}

// Function to try loading image from multiple possible paths
function tryLoadImage(imgElement, originalPath) {
    if (!originalPath) {
        console.error("Путь к изображению пустой");
        imgElement.src = "/static/img/image-error.png"; // Запасное изображение
        return;
    }
    
    console.log("Загрузка изображения:", originalPath);
    
    // Убедимся, что путь начинается с /, если это не так
    const normalizedPath = originalPath.startsWith('/') ? originalPath : '/' + originalPath;
    
    // Генерируем все возможные пути для пробы
    const possiblePaths = [
        originalPath, // Оригинальный путь
        normalizedPath, // Нормализованный путь
        window.location.origin + normalizedPath, // Полный URL
        '/chat' + normalizedPath, // Путь с префиксом /chat
        normalizedPath.replace('/uploads/', '/chat/uploads/'), // Замена /uploads на /chat/uploads
        normalizedPath.replace('/uploads/', '/static/uploads/'), // Замена /uploads на /static/uploads
        '/static' + normalizedPath, // Путь с префиксом /static
        '/static/uploads/' + originalPath.split('/').pop() // Прямой путь к файлу в uploads
    ];
    
    // Убираем дубликаты путей
    const uniquePaths = [...new Set(possiblePaths)];
    
    // Отслеживаем попытки
    let currentIndex = 0;
    
    function tryNextPath() {
        if (currentIndex >= uniquePaths.length) {
            console.error("Не удалось загрузить изображение после проверки всех путей");
            imgElement.src = "/static/img/image-error.png"; // Запасное изображение
            return;
        }
        
        const path = uniquePaths[currentIndex++];
        console.log(`Попытка ${currentIndex}/${uniquePaths.length}: ${path}`);
        
        // Создаем новый Image для проверки пути
        const testImg = new Image();
        testImg.onload = function() {
            console.log("Изображение успешно загружено с:", path);
            imgElement.src = path;
            
            // Также обновляем атрибут data-original-src для вьювера изображений
            imgElement.setAttribute('data-original-src', path);
        };
        
        testImg.onerror = function() {
            console.log(`Не удалось загрузить с: ${path}`);
            tryNextPath();
        };
        
        // Устанавливаем путь для тестирования
        testImg.src = path;
    }
    
    // Начинаем с первого пути
    tryNextPath();
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', initChatInterface);

// Connect to Socket.IO
const socket = io({ 
    transports: ['websocket'],
    upgrade: false
});
socket.on('connect', function() {
    console.log('Connected to Socket.IO');
});

socket.on('connect_error', function(error) {
    console.error('Socket.IO connection error:', error);
});

socket.on('disconnect', function() {
    console.log('Disconnected from Socket.IO');
});

let currentLobbyId = null;
let currentUser = null;
let usersList = [];
let lobbiesList = [];
let activeProfile = null;
let pendingAttachments = [];
const allowedFileTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

// DOM Elements
const contactsList = document.getElementById('contactsList');
const searchInput = document.getElementById('searchContacts');
const createChatBtn = document.getElementById('createChatBtn');
const noChatSelected = document.getElementById('noChatSelected');
const activeChat = document.getElementById('activeChat');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const chatName = document.getElementById('chatName');
const chatStatusIndicator = document.getElementById('chatStatusIndicator');
const chatAvatarText = document.getElementById('chatAvatarText');
const chatAvatarImg = document.getElementById('chatAvatarImg');
const chatStatus = document.getElementById('chatStatus');
const profilePanel = document.getElementById('profilePanel');
const closeProfileBtn = document.getElementById('closeProfile');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const fileInput = document.getElementById('fileInput');
const attachFileBtn = document.getElementById('attachFile');
const attachmentPreview = document.getElementById('attachmentPreview');
const typingIndicator = document.getElementById('typingIndicator');
const typingUsername = document.getElementById('typingUsername');
const openEmojiBtn = document.getElementById('openEmoji');
const emojiPicker = document.getElementById('emojiPicker');

// Profile Elements
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileTitle = document.getElementById('profileTitle');
const profileStatusBadge = document.getElementById('profileStatusBadge');
const profileAbout = document.getElementById('profileAbout');
const profileEmail = document.getElementById('profileEmail');
const profileUsername = document.getElementById('profileUsername');
const sharedFiles = document.getElementById('sharedFiles');

// Group Chat Modal Elements
const createGroupModal = new bootstrap.Modal(document.getElementById('createGroupModal'));
const participantsList = document.getElementById('participantsList');
const groupNameInput = document.getElementById('groupName');
const groupDescriptionInput = document.getElementById('groupDescription');
const createGroupBtn = document.getElementById('createGroupBtn');

// Initialize the application
function initApp() {
    // Настраиваем просмотрщик изображений
    setupImageViewer();

    // Добавляем обработчики для изображений
    addImageClickHandlers();

    // Настраиваем наблюдатель за изображениями
    setupImageWatcher();

    // Инициализируем глобальные уведомления
    initGlobalNotifications();
    
    // Настраиваем отслеживание статуса онлайн
    setupOnlineStatusTracking();
    
    // Инициализируем звуковые уведомления
    initNotificationSound();
    
    // Explicitly show the "Your Messages" screen first
    showNoChatSelectedView();
    
    // Fetch current user info first
    fetchCurrentUser();
    
    // Then fetch all users for contacts list
    fetchAllUsers();
    
    // Then fetch lobbies and render them
    fetchLobbies();
  
    // Сначала загружаем информацию о текущем пользователе
    fetchCurrentUser().then(() => {
        // Затем загружаем все обычные лобби
        return fetchLobbies();
    }).then(() => {
        // Затем загружаем архивированные лобби
        return fetchArchivedLobbies();
    }).then(() => {
        // Настраиваем обработчики событий после загрузки данных
        setupEventListeners();
        
        // Socket.IO обработчики
        setupSocketListeners();
        
        // Настройка смайликов
        setupEmojiPicker();
        
        // Обработка параметров URL
        handleUrlParams();
        
        // Обновляем счетчики непрочитанных сообщений
        updateUnreadMessagesTotal();
        updateLobbiesWithUnread();
        
        // Интервал для обновления счетчиков
        setInterval(() => {
            updateUnreadMessagesTotal();
            updateLobbiesWithUnread();
        }, 60000); // Обновление каждую минуту
    }).catch(error => {
        console.error("Ошибка при инициализации приложения:", error);
    });
}

// Function to explicitly show "Your Messages" screen
function showNoChatSelectedView() {
    // Reset current lobby ID
    currentLobbyId = null;
    
    // Hide the active chat
    if (activeChat) {
        activeChat.style.display = 'none';
    }
    
    // Show the "no chat selected" message
    if (noChatSelected) {
        noChatSelected.style.display = 'flex';
    }
    
    // Clear localStorage
    localStorage.removeItem('currentLobbyId');
    
    // Mobile view reset
    if (window.innerWidth <= 768) {
        document.body.classList.remove('mobile-chat-active');
    }
}

// Handle URL parameters
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyId = urlParams.get('lobby_id');
    
    // Only handle lobby_id if it's explicitly provided in the URL
    if (lobbyId) {
        const checkLobbiesInterval = setInterval(function() {
            if (typeof lobbiesList !== 'undefined' && lobbiesList.length > 0) {
                clearInterval(checkLobbiesInterval);
                
                const lobbyExists = lobbiesList.some(lobby => lobby.id == lobbyId);
                
                if (lobbyExists) {
                    selectLobby(parseInt(lobbyId), false); // false indicates not user initiated
                    
                    // Clear URL parameter
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                }
            }
        }, 100);
    } else {
        // No lobby_id in URL, make sure we show the "Your Messages" screen
        showNoChatSelectedView();
    }
}

// Fetch current user information
function fetchCurrentUser() {
    return new Promise((resolve, reject) => {
        fetch('/chat/api/user/current')
            .then(response => response.json())
            .then(data => {
                currentUser = data;
                console.log('Current user:', currentUser);
                
                // Если кнопка создания группового чата существует, проверяем права доступа
                if (createChatBtn) {
                    // Скрываем кнопку для обычных пользователей
                    if (!currentUser.is_admin) {
                        createChatBtn.style.display = 'none';
                    }
                }
                resolve();
            })
            .catch(error => {
                console.error('Error fetching current user:', error);
                reject(error);
            });
    });
}

// Fetch all lobbies for the current user
function fetchLobbies() {
    return new Promise((resolve, reject) => {
        // Fetch non-archived lobbies by default
        fetch('/chat/lobbies')
            .then(response => response.json())
            .then(data => {
                lobbiesList = data;
                
                // Also fetch archived lobbies
                fetchArchivedLobbies()
                    .then(() => {
                        renderContacts();
                        resolve();
                    })
                    .catch(error => {
                        console.error('Error fetching archived lobbies:', error);
                        reject(error);
                    });
            })
            .catch(error => {
                console.error('Error fetching lobbies:', error);
                reject(error);
            });
    });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Loaded");
    initApp();
});

// Fetch all users for creating new chats
function fetchUsers() {
    fetch('/chat/api/users')
        .then(response => response.json())
        .then(data => {
            usersList = data.filter(user => user.id !== currentUser.id);
            console.log('Users:', usersList);
        })
        .catch(error => {
            console.error('Error fetching users:', error);
        });
}

// Set up event listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', handleSearch);
    
    // Create new chat button
    if (createChatBtn) {
        createChatBtn.addEventListener('click', showCreateChatModal);
    }
    
    // Send message button
    sendMessageBtn.addEventListener('click', sendMessage);
    
    // Message input - press Enter to send
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Message input - typing indicator
    messageInput.addEventListener('input', handleTypingIndicator);
    
    // View profile button
    viewProfileBtn.addEventListener('click', toggleProfilePanel);
    
    // Close profile button
    closeProfileBtn.addEventListener('click', toggleProfilePanel);
    
    // Attach file button
    attachFileBtn.addEventListener('click', () => fileInput.click());
    
    // File input change
    fileInput.addEventListener('change', handleFileSelection);
    
    // Create group button
    createGroupBtn.addEventListener('click', createGroupChat);
    
    // Emoji button
    if (openEmojiBtn) {
        openEmojiBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (emojiPicker && emojiPicker.style.display === 'block' && 
            !emojiPicker.contains(e.target) && e.target !== openEmojiBtn) {
            emojiPicker.style.display = 'none';
        }
    });
}

// Set up Socket.IO event listeners
function setupSocketListeners() {
    console.log("Setting up socket listeners with fixed online status functionality");
    
    // Сначала удаляем все существующие слушатели, чтобы избежать дублирования
    socket.off('new_message');
    socket.off('messages_read');
    socket.off('user_typing');
    socket.off('user_stop_typing');
    socket.off('lobby_created');
    socket.off('user_status_change');
    
    // New message event
    socket.on('new_message', (message) => {
        console.log("Received new message from server:", message);
        
        // Check if this message is already in the DOM (avoid duplicates)
        if (document.querySelector(`[data-message-id="${message.id}"]`)) {
            console.log(`Message ${message.id} already in DOM, skipping`);
            return;
        }
        
        // Воспроизводим звук уведомления если сообщение от другого пользователя
        if (message.sender_id !== currentUser.id && !isChatMuted(message.lobby_id)) {
            playNotificationSound(message);
        }
        
        if (message.lobby_id === currentLobbyId) {
            console.log("Message is for current lobby, appending...");
            appendMessage(message);
            
            // Mark message as read if from someone else
            if (message.sender_id !== currentUser.id) {
                socket.emit('read_messages', { lobby_id: currentLobbyId });
            }
        } else {
            // Если сообщение для другого лобби, обновляем только счетчики
            updateUnreadMessagesTotal();
            updateLobbiesWithUnread();
            
            // Обновляем последнее сообщение в лобби
            updateLobbyLastMessage(message.lobby_id, message);
        }
    });
    
    // Messages read event
    socket.on('messages_read', (data) => {
        console.log("Messages read event:", data);
        
        if (data.lobby_id === currentLobbyId) {
            // Обновляем индикаторы прочтения для сообщений, которые были прочитаны
            document.querySelectorAll('.message-status').forEach(statusDiv => {
                // Если у нас только одна галочка, добавляем вторую
                const firstCheck = statusDiv.querySelector('.message-sent');
                if (firstCheck) {
                    firstCheck.classList.remove('message-sent');
                    firstCheck.classList.add('message-read');
                    
                    // Добавляем вторую галочку
                    if (!statusDiv.querySelector('.second-check')) {
                        const secondCheck = document.createElement('i');
                        secondCheck.className = 'fas fa-check message-read second-check';
                        statusDiv.appendChild(secondCheck);
                    }
                }
            });
        }
        
        // Обновляем счетчики в любом случае
        updateUnreadMessagesTotal();
        updateLobbiesWithUnread();
    });
    
    // Typing indicator events
    socket.on('user_typing', (data) => {
        if (data.lobby_id === currentLobbyId && data.user_id !== currentUser.id) {
            showTypingIndicator(data.username);
        }
    });

    socket.on('user_stop_typing', (data) => {
        if (data.lobby_id === currentLobbyId && data.user_id !== currentUser.id) {
            hideTypingIndicator();
        }
    });
    
    // New lobby created
    socket.on('lobby_created', (lobby) => {
        console.log("New lobby created:", lobby);
        // Добавляем новое лобби только если его еще нет в списке
        if (!lobbiesList.some(l => l.id === lobby.id)) {
            lobbiesList.push(lobby);
            renderContacts();
        }
    });
    
    // Улучшенный обработчик изменения статуса пользователя
    socket.on('user_status_change', (data) => {
        console.log("Received user status change:", data);
        
        // Обновляем статус в списке пользователей
        usersList.forEach(user => {
            if (user.id === data.user_id) {
                user.is_online = data.is_online;
                console.log(`Updated user ${user.username} online status to ${data.is_online}`);
            }
        });
        
        // Обновляем статус во всех лобби
        lobbiesList.forEach(lobby => {
            lobby.users.forEach(user => {
                if (user.id === data.user_id) {
                    user.is_online = data.is_online;
                }
            });
        });
        
        if (archivedLobbiesList) {
            archivedLobbiesList.forEach(lobby => {
                if (lobby && lobby.users) {
                    lobby.users.forEach(user => {
                        if (user.id === data.user_id) {
                            user.is_online = data.is_online;
                        }
                    });
                }
            });
        }
        
        // Обновляем весь UI
        updateUserOnlineStatus();
    });

    // Reconnect handling to prevent message loss
    socket.on('reconnect', () => {
        console.log("Socket reconnected");
        
        // Если был выбран чат, переподключаемся к его комнате
        if (currentLobbyId) {
            socket.emit('join_lobby', { lobby_id: currentLobbyId });
            
            // Обновляем сообщения в чате
            fetch(`/chat/lobby/${currentLobbyId}/messages`)
                .then(response => response.json())
                .then(messages => {
                    displayMessages(messages);
                })
                .catch(error => {
                    console.error('Error loading messages on reconnect:', error);
                });
        }
        
        // Обновляем счетчики непрочитанных сообщений
        updateUnreadMessagesTotal();
        updateLobbiesWithUnread();
        
        // Обновляем статус онлайн
        updateOnlineStatus(true);
    });
}

// Обновление контакта в списке с новым последним сообщением
function updateLobbyLastMessage(lobbyId, message) {
    // Находим лобби в списке
    const lobbyIndex = lobbiesList.findIndex(lobby => lobby.id === lobbyId);
    
    if (lobbyIndex !== -1) {
        // Обновляем последнее сообщение
        lobbiesList[lobbyIndex].last_message = message;
        
        // Находим элемент контакта и обновляем его содержимое
        const contactItem = document.querySelector(`.contact-item[data-lobby-id="${lobbyId}"]`);
        if (contactItem) {
            // Получаем элемент для текста последнего сообщения
            const lastMessageElement = contactItem.querySelector('.contact-message');
            
            // Форматируем текст сообщения в зависимости от типа
            let lastMessageText = '';
            if (message.message_type === 'text') {
                lastMessageText = message.text.length > 30 ? message.text.substring(0, 27) + '...' : message.text;
            } else if (message.message_type === 'image') {
                lastMessageText = '📷 Image';
            } else if (message.message_type === 'file') {
                lastMessageText = '📎 File: ' + message.file_name;
            } else if (message.message_type === 'audio') {
                lastMessageText = '🎵 Audio';
            } else if (message.message_type === 'video') {
                lastMessageText = '📹 Video';
            }
            
            if (lastMessageElement) {
                lastMessageElement.textContent = lastMessageText;
            }
            
            // Обновляем время последнего сообщения
            const timeElement = contactItem.querySelector('.contact-time');
            if (timeElement) {
                const messageDate = new Date(message.timestamp);
                const now = new Date();
                
                let formattedTime = '';
                if (messageDate.toDateString() === now.toDateString()) {
                    // Today - show time
                    formattedTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (messageDate.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) {
                    // Within last week - show day name
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    formattedTime = days[messageDate.getDay()];
                } else {
                    // Older - show date
                    formattedTime = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
                
                timeElement.textContent = formattedTime;
            }
            
            // Сортируем контакты, чтобы чаты с новыми сообщениями были вверху
            renderContacts();
        }
    }
}

// Emoji picker setup
function setupEmojiPicker() {
    console.log("Настройка панели эмодзи");
    
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiPicker) {
        console.warn("Элемент emojiPicker не найден");
        return;
    }
    
    // Очищаем содержимое
    emojiPicker.innerHTML = '';
    
    // Устанавливаем стили, если их еще нет
    if (!document.getElementById('emoji-picker-styles')) {
        const style = document.createElement('style');
        style.id = 'emoji-picker-styles';
        style.textContent = `
            #emojiPicker {
                display: none;
                position: absolute;
                bottom: 60px;
                left: 10px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
                width: 280px;
                max-height: 300px;
                overflow-y: auto;
                z-index: 1000;
                padding: 10px;
            }
            
            .emoji-category {
                margin-bottom: 12px;
            }
            
            .emoji-category-title {
                font-size: 12px;
                color: #888;
                margin-bottom: 5px;
                font-weight: 500;
            }
            
            .emoji-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 5px;
            }
            
            .emoji-item {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 20px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .emoji-item:hover {
                background-color: #f0f0f0;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Популярные эмодзи по категориям
    const emojiCategories = [
        {
            name: 'Смайлики',
            emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘']
        },
        {
            name: 'Жесты',
            emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '✋', '🤚', '🖐️', '👋', '🤏']
        },
        {
            name: 'Объекты',
            emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬']
        }
    ];
    
    // Создаем элементы эмодзи
    emojiCategories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'emoji-category';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'emoji-category-title';
        titleDiv.textContent = category.name;
        
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'emoji-grid';
        
        category.emojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем закрытие по клику
                insertEmoji(emoji);
            });
            
            emojiGrid.appendChild(emojiItem);
        });
        
        categoryDiv.appendChild(titleDiv);
        categoryDiv.appendChild(emojiGrid);
        emojiPicker.appendChild(categoryDiv);
    });
    
    // Настройка функций для работы с эмодзи
    window.toggleEmojiPicker = function() {
        const emojiPicker = document.getElementById('emojiPicker');
        if (!emojiPicker) return;
        
        // Если панель уже видима - скрываем
        if (emojiPicker.style.display === 'block') {
            emojiPicker.style.display = 'none';
        } else {
            // Иначе показываем
            emojiPicker.style.display = 'block';
            
            // Настраиваем слушатель для закрытия при клике вне панели
            setTimeout(() => {
                const closeEmojiPicker = function(e) {
                    if (!emojiPicker.contains(e.target) && e.target.id !== 'openEmoji') {
                        emojiPicker.style.display = 'none';
                        document.removeEventListener('click', closeEmojiPicker);
                    }
                };
                
                document.addEventListener('click', closeEmojiPicker);
            }, 100);
        }
    };
    
    // Привязываем функцию к кнопке
    const openEmojiBtn = document.getElementById('openEmoji');
    if (openEmojiBtn) {
        // Удаляем существующие обработчики, чтобы избежать дублирования
        const newEmojiBtn = openEmojiBtn.cloneNode(true);
        if (openEmojiBtn.parentNode) {
            openEmojiBtn.parentNode.replaceChild(newEmojiBtn, openEmojiBtn);
        }
        
        // Добавляем новый обработчик
        newEmojiBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Предотвращаем срабатывание документа
            window.toggleEmojiPicker();
        });
    }
    
    console.log("Настройка панели эмодзи завершена");
}

// Toggle emoji picker
function toggleEmojiPicker() {
    if (emojiPicker.style.display === 'none' || emojiPicker.style.display === '') {
        emojiPicker.style.display = 'block';
    } else {
        emojiPicker.style.display = 'none';
    }
}

// Функция вставки эмодзи
function insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);
    
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.selectionStart = cursorPos + emoji.length;
    messageInput.selectionEnd = cursorPos + emoji.length;
    messageInput.focus();
    
    // Не закрываем панель эмодзи, чтобы можно было добавить несколько
}

// Инициализация основных компонентов
function initChatComponents() {
    console.log("Инициализация компонентов чата");
    
    // Устанавливаем просмотрщик изображений
    setupImageViewer();
    
    // Настраиваем наблюдатель за изображениями
    setupImageWatcher();
    
    // Добавляем обработчики для существующих изображений
    addImageClickHandlers();
    
    // Настраиваем панель эмодзи
    setupEmojiPicker();
    
    // Устанавливаем обработчики для экранной клавиатуры на мобильных устройствах
    setupMobileKeyboardHandling();
    
    console.log("Компоненты чата инициализированы");
}

// Инициализация для мобильной клавиатуры
function setupMobileKeyboardHandling() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    // На мобильных устройствах прокручиваем вверх при фокусе на поле ввода
    messageInput.addEventListener('focus', function() {
        // Откладываем прокрутку, чтобы дать время клавиатуре открыться
        setTimeout(function() {
            // Прокручиваем до сообщения
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // Прокручиваем до поля ввода
            messageInput.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    });
    
    // Для iOS устройств
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.addEventListener('focusin', function(e) {
            if (e.target === messageInput) {
                document.body.scrollTop = 0;
            }
        });
    }
}

// Запускаем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM загружен, инициализация компонентов");
    initChatComponents();
});

// Дополнительно вызываем инициализацию при любом обновлении сообщений
// Это может быть полезно, если DOM обновляется асинхронно
function initAfterMessagesLoaded() {
    console.log("Сообщения загружены, обновление обработчиков");
    addImageClickHandlers();
}

// Перезаписываем оригинальные функции загрузки сообщений
const originalDisplayMessages = window.displayMessages;
window.displayMessages = function(messages) {
    if (originalDisplayMessages) {
        originalDisplayMessages.call(this, messages);
    }
    initAfterMessagesLoaded();
};

const originalAppendMessage = window.appendMessage;
window.appendMessage = function(message) {
    if (originalAppendMessage) {
        originalAppendMessage.call(this, message);
    }
    initAfterMessagesLoaded();
};

// Handle search input
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    // Filter lobbies based on search term
    const filteredLobbies = lobbiesList.filter(lobby => {
        if (lobby.is_group) {
            return lobby.name.toLowerCase().includes(searchTerm);
        } else {
            // For direct messages, search in the other user's name
            const otherUser = lobby.users.find(user => user.id !== currentUser.id);
            return otherUser && otherUser.username.toLowerCase().includes(searchTerm);
        }
    });
    
    renderContactsFiltered(filteredLobbies);
}

// Show the create chat modal
function showCreateChatModal() {
    // Fetch users first if we don't have them
    if (usersList.length === 0) {
        fetchUsers();
    }
    
    // Clear previous participants
    participantsList.innerHTML = '';
    
    // Render users as potential participants
    usersList.forEach(user => {
        const participantItem = document.createElement('div');
        participantItem.className = 'participant-item';
        participantItem.dataset.userId = user.id;
        
        participantItem.innerHTML = `
            <div class="participant-avatar">
                ${user.avatar ? 
                    `<img src="${user.avatar}" alt="${user.username}" class="avatar-img">` : 
                    `<div class="avatar-text">${getInitials(user.username)}</div>`
                }
            </div>
            <div class="participant-name">${user.username}</div>
            <div class="participant-checkbox">
                <input type="checkbox" class="form-check-input">
            </div>
        `;
        
        participantItem.addEventListener('click', () => {
            const checkbox = participantItem.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            participantItem.classList.toggle('selected', checkbox.checked);
        });
        
        participantsList.appendChild(participantItem);
    });
    
    // Show the modal
    createGroupModal.show();
}

// Create a new group chat
function createGroupChat() {
    const selectedParticipants = Array.from(
        document.querySelectorAll('.participant-item input[type="checkbox"]:checked')
    ).map(checkbox => parseInt(checkbox.closest('.participant-item').dataset.userId));
    
    const name = groupNameInput.value.trim();
    const description = groupDescriptionInput.value.trim();
    
    if (selectedParticipants.length === 0) {
        alert('Please select at least one participant');
        return;
    }
    
    if (name === '') {
        alert('Please enter a group name');
        return;
    }
    
    // Create lobby data
    const lobbyData = {
        user_ids: selectedParticipants,
        is_group: true,
        name: name,
        description: description
    };
    
    // Send request to create lobby
    fetch('/chat/create_lobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(lobbyData)
    })
    .then(response => response.json())
    .then(data => {
        // Hide modal
        createGroupModal.hide();
        
        // Reset inputs
        groupNameInput.value = '';
        groupDescriptionInput.value = '';
        
        // Select the newly created lobby
        selectLobby(data.id, true);
    })
    .catch(error => {
        console.error('Error creating group chat:', error);
    });
}

// Start a direct chat with a user
function startDirectChat(userId) {
    const lobbyData = {
        user_ids: [userId],
        is_group: false
    };
    
    fetch('/chat/create_lobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(lobbyData)
    })
    .then(response => response.json())
    .then(data => {
        // Select the newly created or existing lobby
        selectLobby(data.id, true);})
        .catch(error => {
            console.error('Error creating direct chat:', error);
        });
    }
    
// Render all contacts (lobbies)
function renderContacts() {
    // Очищаем список контактов
    contactsList.innerHTML = '';
    
    // Добавляем кнопку для отображения всех пользователей
    const usersDropdownHeader = document.createElement('div');
    usersDropdownHeader.className = 'contacts-dropdown-header';
    usersDropdownHeader.innerHTML = `
        <div class="contacts-dropdown-title">
            <i class="fas fa-users"></i>
            <span>Все пользователи</span>
        </div>
        <div class="contacts-dropdown-toggle">
            <i class="fas fa-chevron-down"></i>
        </div>
    `;
    contactsList.appendChild(usersDropdownHeader);
    
    // Создаем контейнер для списка пользователей (скрытый по умолчанию)
    const usersContainer = document.createElement('div');
    usersContainer.className = 'users-container';
    usersContainer.style.display = 'none';
    contactsList.appendChild(usersContainer);
    
    // Добавляем обработчик для выпадающего списка
    usersDropdownHeader.addEventListener('click', () => {
        if (usersContainer.style.display === 'none') {
            usersContainer.style.display = 'block';
            usersDropdownHeader.querySelector('.contacts-dropdown-toggle i').className = 'fas fa-chevron-up';
        } else {
            usersContainer.style.display = 'none';
            usersDropdownHeader.querySelector('.contacts-dropdown-toggle i').className = 'fas fa-chevron-down';
        }
    });
    
    // Заполняем список пользователей
    usersList.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'contact-item user-item';
        userItem.dataset.userId = user.id;
        
        const avatarInitials = getInitials(user.username);
        
        userItem.innerHTML = `
            <div class="avatar">
                ${user.avatar ? 
                    `<img src="${user.avatar}" alt="${user.username}" class="avatar-img">` : 
                    `<span class="avatar-text">${avatarInitials}</span>`
                }
                <span class="status-indicator ${user.is_online ? 'status-online' : 'status-offline'}"></span>
            </div>
            <div class="contact-info">
                <div class="contact-name">${user.username}</div>
            </div>
        `;
        
        userItem.addEventListener('click', () => {
            startDirectChat(user.id);
        });
        
        usersContainer.appendChild(userItem);
    });
    
    // Добавляем заголовок для чатов
    const chatsHeader = document.createElement('div');
    chatsHeader.className = 'contacts-separator';
    chatsHeader.textContent = 'Чаты';
    contactsList.appendChild(chatsHeader);
    
    // Фильтруем и сортируем неархивированные лобби
    const activeLobbies = lobbiesList.filter(lobby => !lobby.is_archived);
    
    // Сортируем лобби по последнему сообщению
    activeLobbies.sort((a, b) => {
        const timeA = a.last_message ? new Date(a.last_message.timestamp) : new Date(a.created_at);
        const timeB = b.last_message ? new Date(b.last_message.timestamp) : new Date(b.created_at);
        return timeB - timeA;
    });
    
    // Добавляем все активные чаты
    activeLobbies.forEach(lobby => {
        const contactItem = createContactItemElement(lobby, false);
        contactsList.appendChild(contactItem);
    });
    
    // Добавляем кнопку создания группового чата только для администраторов
    if (currentUser && currentUser.is_admin) {
        const createGroupBtn = document.createElement('div');
        createGroupBtn.className = 'create-group-chat-btn';
        createGroupBtn.innerHTML = `
            <i class="fas fa-users"></i>
            <span>Создать групповой чат</span>
        `;
        createGroupBtn.addEventListener('click', showCreateChatModal);
        contactsList.appendChild(createGroupBtn);
    }
    
    // Обновляем индикаторы непрочитанных сообщений
    updateLobbiesWithUnread();
}

// Render filtered contacts
function renderContactsFiltered(filteredLobbies) {
    contactsList.innerHTML = '';
    
    // Сначала фильтруем пользователей
    const searchTerm = searchInput.value.toLowerCase();
    const filteredUsers = usersList.filter(user => 
        user.username.toLowerCase().includes(searchTerm)
    );
    
    // Показываем отфильтрованных пользователей
    if (filteredUsers.length > 0) {
        const usersHeader = document.createElement('div');
        usersHeader.className = 'contacts-separator';
        usersHeader.textContent = 'Users';
        contactsList.appendChild(usersHeader);
        
        filteredUsers.forEach(user => {
            const contactItem = document.createElement('div');
            contactItem.className = 'contact-item';
            contactItem.dataset.userId = user.id;
            
            const avatarInitials = getInitials(user.username);
            
            contactItem.innerHTML = `
                <div class="avatar">
                    ${user.avatar ? 
                        `<img src="${user.avatar}" alt="${user.username}" class="avatar-img">` : 
                        `<span class="avatar-text">${avatarInitials}</span>`
                    }
                    <span class="status-indicator ${user.is_online ? 'status-online' : 'status-offline'}"></span>
                </div>
                <div class="contact-info">
                    <div class="contact-name-row">
                        <div class="contact-name">${user.username}</div>
                    </div>
                    <div class="contact-message">Click to start chatting</div>
                </div>
            `;
            
            contactItem.addEventListener('click', () => {
                startDirectChat(user.id);
            });
            
            contactsList.appendChild(contactItem);
        });
    }
    
    // Затем показываем отфильтрованные лобби
    filteredLobbies.forEach(lobby => {
        renderContactItem(lobby);
    });
    
    if (filteredUsers.length === 0 && filteredLobbies.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = 'No conversations found';
        contactsList.appendChild(noResults);
    }
    
    // Обновляем индикаторы непрочитанных сообщений
    updateLobbiesWithUnread();
}

// Render a single contact item
function renderContactItem(lobby) {
    const contactItem = document.createElement('div');
    contactItem.className = `contact-item ${currentLobbyId === lobby.id ? 'selected' : ''}`;
    contactItem.dataset.lobbyId = lobby.id;
    
    // Determine contact name and avatar
    let contactName;
    let avatarUrl;
    let avatarInitials;
    
    if (lobby.is_group) {
        contactName = lobby.name;
        avatarUrl = lobby.avatar;
        avatarInitials = getInitials(contactName);
    } else {
        // For direct messages, show the other user's info
        const otherUser = lobby.users.find(user => user.id !== currentUser.id);
        contactName = otherUser ? otherUser.username : 'Unknown User';
        avatarUrl = otherUser ? otherUser.avatar : null;
        avatarInitials = getInitials(contactName);
    }
    
    // Format the last message and time
    let lastMessageText = 'No messages yet';
    let lastMessageTime = '';
    
    if (lobby.last_message) {
        const message = lobby.last_message;
        
        // Format text based on message type
        if (message.message_type === 'text') {
            lastMessageText = message.text;
        } else if (message.message_type === 'image') {
            lastMessageText = '📷 Image';
        } else if (message.message_type === 'file') {
            lastMessageText = '📎 File: ' + message.file_name;
        } else if (message.message_type === 'audio') {
            lastMessageText = '🎵 Audio';
        } else if (message.message_type === 'video') {
            lastMessageText = '📹 Video';
        }
        
        // Format time
        const messageDate = new Date(message.timestamp);
        const now = new Date();
        
        if (messageDate.toDateString() === now.toDateString()) {
            // Today - show time
            lastMessageTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (messageDate.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) {
            // Within last week - show day name
            const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            lastMessageTime = days[messageDate.getDay()];
        } else {
            // Older - show date
            lastMessageTime = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    contactItem.innerHTML = `
        <div class="avatar">
            ${avatarUrl ? 
                `<img src="${avatarUrl}" alt="${contactName}" class="avatar-img">` : 
                `<span class="avatar-text">${avatarInitials}</span>`
            }
            <span class="status-indicator ${lobby.is_group ? 'status-group' : 'status-offline'}"></span>
        </div>
        <div class="contact-info">
            <div class="contact-name-row">
                <div class="contact-name">
                    ${contactName}
                    ${lobby.is_group ? '<i class="fas fa-users group-chat-icon" title="Group Chat"></i>' : ''}
                </div>
                <div class="contact-time">${lastMessageTime}</div>
            </div>
            <div class="contact-message">${lastMessageText}</div>
        </div>
    `;
    
    contactItem.addEventListener('click', () => {
        selectLobby(lobby.id, true); // true indicates user initiated
    });
    
    contactsList.appendChild(contactItem);
}

// Select a lobby and load its messages
function selectLobby(lobbyId, userInitiated = true) {
    // Deselect previously selected lobby in UI
    const previousSelected = document.querySelector('.contact-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }
    
    // Select new lobby in UI
    const newSelected = document.querySelector(`.contact-item[data-lobby-id="${lobbyId}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');
    }
    
    // Update current lobby ID
    currentLobbyId = lobbyId;
    
    // Save to localStorage ONLY if user explicitly selected this chat
    if (userInitiated) {
        localStorage.setItem('currentLobbyId', lobbyId);
    }
    
    // Join the lobby room via Socket.IO
    socket.emit('join_lobby', { lobby_id: lobbyId });
    
    // Fetch lobby details
    fetch(`/chat/lobby/${lobbyId}`)
        .then(response => response.json())
        .then(lobby => {
            // Set up chat UI
            setupChatUI(lobby);
            
            // Fetch messages for this lobby
            return fetch(`/chat/lobby/${lobbyId}/messages`);
        })
        .then(response => response.json())
        .then(messages => {
            // Display messages
            displayMessages(messages);
            
            // Mark messages as read
            socket.emit('read_messages', { lobby_id: lobbyId });
            
            // Обновляем счетчики непрочитанных сообщений
            updateUnreadMessagesTotal();
            updateLobbiesWithUnread();
        })
        .catch(error => {
            console.error('Error loading lobby:', error);
        });
}

// Set up the chat UI for a selected lobby
function setupChatUI(lobby) {
    console.log("Setting up chat UI with fixed online status display");
    
    // Hide the empty state, show the active chat
    noChatSelected.style.display = 'none';
    activeChat.style.display = 'flex';
    
    // Clear messages area
    chatMessages.innerHTML = '';
    
    // Clear attachment preview
    clearAttachmentPreview();
    
    // Set up header info
    if (lobby.is_group) {
        // Group chat
        chatName.textContent = lobby.name;
        
        if (lobby.avatar) {
            chatAvatarText.style.display = 'none';
            chatAvatarImg.style.display = 'block';
            chatAvatarImg.src = lobby.avatar;
        } else {
            chatAvatarText.style.display = 'flex';
            chatAvatarImg.style.display = 'none';
            chatAvatarText.textContent = getInitials(lobby.name);
        }
        
        chatStatusIndicator.className = 'status-indicator status-group';
        chatStatus.textContent = `${lobby.users.length} members`;
    } else {
        // Direct message
        const otherUser = lobby.users.find(user => user.id !== currentUser.id);
        
        if (otherUser) {
            chatName.textContent = otherUser.username;
            
            if (otherUser.avatar) {
                chatAvatarText.style.display = 'none';
                chatAvatarImg.style.display = 'block';
                chatAvatarImg.src = otherUser.avatar;
            } else {
                chatAvatarText.style.display = 'flex';
                chatAvatarImg.style.display = 'none';
                chatAvatarText.textContent = getInitials(otherUser.username);
            }
            
            // Отображаем статус пользователя - ИСПРАВЛЕНО
            // Теперь используем проверку на явное значение (true) для is_online
            const isOnline = otherUser.is_online === true;
            chatStatusIndicator.className = `status-indicator ${isOnline ? 'status-online' : 'status-offline'}`;
            chatStatus.textContent = isOnline ? 'Online' : 'Offline';
            
            console.log(`Setup Chat UI: User ${otherUser.username} has online status:`, isOnline, otherUser.is_online);
        }
    }
}

// Display messages in the chat area
function displayMessages(messages) {
    chatMessages.innerHTML = '';
    
    if (messages.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'chat-empty-state';
        emptyState.innerHTML = `
            <div class="chat-empty-icon">
                <i class="far fa-comments"></i>
            </div>
            <p>No messages yet. Start the conversation!</p>
        `;
        chatMessages.appendChild(emptyState);
        return;
    }
    
    // Group messages by sender and date
    let currentSenderId = null;
    let currentGroup = null;
    
    messages.forEach(message => {
        // Check if we should start a new group
        if (message.sender_id !== currentSenderId) {
            // Start a new message group
            currentSenderId = message.sender_id;
            currentGroup = document.createElement('div');
            currentGroup.className = `message-group ${message.sender_id === currentUser.id ? 'own-messages' : ''}`;
            
            // Add sender info (avatar and name) for received messages
            if (message.sender_id !== currentUser.id) {
                const userInfoDiv = document.createElement('div');
                userInfoDiv.className = 'message-user-info';
                
                // Add avatar
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'message-avatar';
                
                if (message.sender_avatar) {
                    avatarDiv.innerHTML = `<img src="${message.sender_avatar}" alt="${message.sender_name}">`;
                } else {
                    avatarDiv.innerHTML = `<div class="avatar-text">${getInitials(message.sender_name)}</div>`;
                }
                
                userInfoDiv.appendChild(avatarDiv);
                
                // Add sender name
                const senderName = document.createElement('div');
                senderName.className = 'message-sender';
                senderName.textContent = message.sender_name;
                userInfoDiv.appendChild(senderName);
                
                currentGroup.appendChild(userInfoDiv);
            }
            
            chatMessages.appendChild(currentGroup);
        }
        
        // Create message container for this message
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        messageContainer.setAttribute('data-message-id', message.id);
        currentGroup.appendChild(messageContainer);
        
        // Create message bubble
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble message-animation';
        
        // Add content based on message type
        if (message.message_type === 'text') {
            messageBubble.innerHTML = `
                <div class="message-text">${formatMessageText(message.text)}</div>
            `;
        }else if (message.message_type === 'image') {
            messageBubble.innerHTML = `
                <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
                <div class="message-attachment">
                    <div class="image-container">
                        <img src="" alt="Image" class="attachment-image">
                    </div>
                </div>
            `;
            
            // Загружаем изображение, но не добавляем обработчик клика здесь
            setTimeout(() => {
                const img = messageBubble.querySelector('.attachment-image');
                if (img) {
                    // Пробуем загрузить изображение с разных путей
                    tryLoadImage(img, message.file_path);
                }
            }, 0);
        }else if (message.message_type === 'file' || message.message_type === 'FILE') {
            // Determine file icon
            let fileIcon = 'fa-file';
            if (message.file_type === 'application/pdf') fileIcon = 'fa-file-pdf';
            else if (message.file_type && message.file_type.includes('word')) fileIcon = 'fa-file-word';
            else if (message.file_type && message.file_type.includes('excel')) fileIcon = 'fa-file-excel';
            
            messageBubble.innerHTML = `
                <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
                <div class="message-attachment">
                    <div class="attachment-file">
                        <i class="fas ${fileIcon}"></i>
                        <div class="attachment-details">
                            <div class="attachment-name">${message.file_name}</div>
                            <div class="attachment-size">${formatFileSize(message.file_size)}</div>
                        </div>
                        <div class="attachment-actions">
                            <a href="${message.file_path}" target="_blank" class="attachment-view" title="Open">
                                <i class="fas fa-eye"></i>
                            </a>
                            <a href="${message.file_path}" download="${message.file_name}" class="attachment-download" title="Download">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else if (message.message_type === 'audio' || message.message_type === 'AUDIO') {
            messageBubble.innerHTML = `
                <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
                <div class="message-attachment">
                    <audio controls src="${message.file_path}" class="audio-player"></audio>
                </div>
            `;
        } else if (message.message_type === 'video' || message.message_type === 'VIDEO') {
            messageBubble.innerHTML = `
                <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
                <div class="message-attachment">
                    <video controls src="${message.file_path}" class="video-player"></video>
                </div>
            `;
        }
        
        messageContainer.appendChild(messageBubble);
        
        // Добавляем метки времени и статуса сообщения
        const messageTimeContainer = document.createElement('div');
        messageTimeContainer.className = 'message-time-container';
        
        // Добавляем время
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTime(message.timestamp);
        messageTimeContainer.appendChild(messageTime);
        
        // Добавляем статус сообщения (прочитано/не прочитано) для собственных сообщений
        if (message.sender_id === currentUser.id) {
            const messageStatusDiv = document.createElement('div');
            messageStatusDiv.className = 'message-status';
            
            // Проверяем, прочитано ли сообщение другими пользователями
            const isRead = message.read_by && message.read_by.some(userId => userId !== currentUser.id);
            
            // Создаем иконки галочек
            messageStatusDiv.innerHTML = `
                <i class="fas fa-check ${isRead ? 'message-read' : 'message-sent'}"></i>
                ${isRead ? '<i class="fas fa-check message-read second-check"></i>' : ''}
            `;
            
            messageTimeContainer.appendChild(messageStatusDiv);
        }
        
        messageContainer.appendChild(messageTimeContainer);
    });
    // Добавляем обработчики клика для изображений
    setTimeout(addImageClickHandlers, 100);
    // Scroll to bottom
    scrollToBottom();
}

// Append a single message to the chat
function appendMessage(message) {
    console.log("Appending message:", message);
    
    // Skip if this message is already in the DOM
    if (message.id && document.querySelector(`[data-message-id="${message.id}"]`)) {
        console.log(`Message ${message.id} already in DOM, skipping`);
        return;
    }
    
    // Check if the last message is from the same sender
    const lastGroup = chatMessages.lastElementChild;
    let messageContainer;
    
    if (lastGroup && 
        ((message.sender_id === currentUser.id && lastGroup.classList.contains('own-messages')) || 
         (message.sender_id !== currentUser.id && !lastGroup.classList.contains('own-messages')))) {
        // Create a new message container inside existing group
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        if (message.id) {
            messageContainer.setAttribute('data-message-id', message.id);
        }
        lastGroup.appendChild(messageContainer);
    } else {
        // Create a new message group
        const newGroup = document.createElement('div');
        newGroup.className = `message-group ${message.sender_id === currentUser.id ? 'own-messages' : ''}`;
        
        // Add sender info for received messages
        if (message.sender_id !== currentUser.id) {
            const userInfoDiv = document.createElement('div');
            userInfoDiv.className = 'message-user-info';
            
            // Add avatar
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            
            if (message.sender_avatar) {
                avatarDiv.innerHTML = `<img src="${message.sender_avatar}" alt="${message.sender_name}">`;
            } else {
                avatarDiv.innerHTML = `<div class="avatar-text">${getInitials(message.sender_name)}</div>`;
            }
            
            userInfoDiv.appendChild(avatarDiv);
            
            // Add sender name
            const senderName = document.createElement('div');
            senderName.className = 'message-sender';
            senderName.textContent = message.sender_name;
            userInfoDiv.appendChild(senderName);
            
            newGroup.appendChild(userInfoDiv);
        }
        
        // Add message container
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        if (message.id) {
            messageContainer.setAttribute('data-message-id', message.id);
        }
        
        newGroup.appendChild(messageContainer);
        chatMessages.appendChild(newGroup);
    }
    
    // Create message bubble
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble message-animation';
    
    // Add content based on message type
    if (message.message_type === 'text') {
        messageBubble.innerHTML = `
            <div class="message-text">${formatMessageText(message.text)}</div>
        `;
    } else if (message.message_type === 'image') {
        console.log("Creating image message with path:", message.file_path);
        
        messageBubble.innerHTML = `
            <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
            <div class="message-attachment">
                <div class="image-container">
                    <img src="" alt="Image" class="attachment-image">
                </div>
            </div>
        `;
        
        // Use setTimeout to ensure the element is in the DOM
        setTimeout(() => {
            const img = messageBubble.querySelector('.attachment-image');
            if (img) {
                // Try loading the image with different path combinations
                tryLoadImage(img, message.file_path);
            }
        }, 50);
    } else if (message.message_type === 'file' || message.message_type === 'FILE') {                
        // File handling
        let fileIcon = 'fa-file';
        if (message.file_type === 'application/pdf') fileIcon = 'fa-file-pdf';
        else if (message.file_type && message.file_type.includes('word')) fileIcon = 'fa-file-word';
        else if (message.file_type && message.file_type.includes('excel')) fileIcon = 'fa-file-excel';
        
        messageBubble.innerHTML = `
            <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
            <div class="message-attachment">
                <div class="attachment-file">
                    <i class="fas ${fileIcon}"></i>
                    <div class="attachment-details">
                        <div class="attachment-name">${message.file_name || 'File'}</div>
                        <div class="attachment-size">${formatFileSize(message.file_size || 0)}</div>
                    </div>
                    <div class="attachment-actions">
                        <a href="${message.file_path}" target="_blank" class="attachment-view" title="Open">
                            <i class="fas fa-eye"></i>
                        </a>
                        <a href="${message.file_path}" download="${message.file_name || 'file'}" class="attachment-download" title="Download">
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    } else if (message.message_type === 'audio' || message.message_type === 'AUDIO') {
        // Audio handling
        messageBubble.innerHTML = `
            <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
            <div class="message-attachment">
                <audio controls src="${message.file_path}" class="audio-player"></audio>
            </div>
        `;
    } else if (message.message_type === 'video' || message.message_type === 'VIDEO') {
        // Video handling
        messageBubble.innerHTML = `
            <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
            <div class="message-attachment">
                <video controls src="${message.file_path}" class="video-player"></video>
            </div>
        `;
    }
    
    messageContainer.appendChild(messageBubble);
    
    // Add time and status indicators
    const messageTimeContainer = document.createElement('div');
    messageTimeContainer.className = 'message-time-container';
    
    // Add time
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = formatTime(message.timestamp);
    messageTimeContainer.appendChild(messageTime);
    
    // Add message status for own messages
    if (message.sender_id === currentUser.id) {
        const messageStatusDiv = document.createElement('div');
        messageStatusDiv.className = 'message-status';
        
        // Default new message as not read
        messageStatusDiv.innerHTML = `
            <i class="fas fa-check message-sent"></i>
        `;
        
        messageTimeContainer.appendChild(messageStatusDiv);
    }
    
    messageContainer.appendChild(messageTimeContainer);
    // Добавляем обработчики клика для изображений
    setTimeout(addImageClickHandlers, 100);
    // Scroll to bottom
    scrollToBottom();
    
    // Hide typing indicator
    hideTypingIndicator();
    
    // After displaying message, update counters
    if (message.sender_id !== currentUser.id) {
        socket.emit('read_messages', { lobby_id: currentLobbyId });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Настройка модального окна для изображений
    setupImageViewer();
});

// Fetch all users for contacts list
function fetchAllUsers() {
    return new Promise((resolve, reject) => {
        fetch('/chat/api/all_users')
            .then(response => response.json())
            .then(data => {
                usersList = data;
                renderAllUsers();
                resolve();
            })
            .catch(error => {
                console.error('Error fetching all users:', error);
                reject(error);
            });
    });
}

// Render all users in contacts list
function renderAllUsers() {
    // Пользователи будут показаны в выпадающем списке при клике на "All Users"
    renderContacts();
}

// Send a message
function sendMessage() {
    if (!currentLobbyId) {
        console.log("No lobby selected");
        return;
    }
    
    const messageText = messageInput.value.trim();
    
    // Check if we have text content or attachments
    if (messageText === '' && pendingAttachments.length === 0) {
        console.log("No message text or attachments");
        return;
    }
    
    console.log("Sending message:", messageText);
    console.log("To lobby:", currentLobbyId);
    
    // Clear input field
    messageInput.value = '';
    
    // Handle file attachments if any
    if (pendingAttachments.length > 0) {
        console.log("Sending file message");
        sendFileMessage(messageText);
    } else {
        // Send text message via Socket.IO
        console.log("Emitting send_message event");
        socket.emit('send_message', {
            message: messageText,
            lobby_id: currentLobbyId
        });
    }
    
    // Reset typing timeout
    clearTimeout(window.typingTimeout);
    
    // Notify server user stopped typing
    socket.emit('stop_typing', {
        lobby_id: currentLobbyId
    });
    
    // Автоматически фокусируемся на поле ввода после отправки
    setTimeout(() => {
        messageInput.focus();
    }, 10);
}

// Send a message with file attachment
function sendFileMessage(messageText) {
    if (pendingAttachments.length === 0) {
        console.error("No attachments to send");
        return;
    }
    
    const attachment = pendingAttachments[0];
    console.log("Uploading file:", attachment.name, "Type:", attachment.type);
    
    // Create FormData
    const formData = new FormData();
    formData.append('message', messageText || '');
    formData.append('lobby_id', currentLobbyId);
    formData.append('file', attachment.file);
    
    // Show loading indicator
    const sendBtn = document.getElementById('sendMessage');
    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled = true;
    }
    
    // Send the request
    fetch('/chat/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        // Reset the send button regardless of outcome
        if (sendBtn) {
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            sendBtn.disabled = false;
        }
        
        if (!response.ok) {
            return response.json().then(errorData => {
                console.error("Upload error:", errorData);
                throw new Error(errorData.error || `Server error: ${response.status}`);
            });
        }
        
        return response.json();
    })
    .then(data => {
        console.log("Upload response:", data);
        
        if (data.success) {
            // Clear attachment preview
            clearAttachmentPreview();
            
            // If socket.io emission failed, manually add the message
            if (!data.socketio_success && data.message) {
                console.log("Socket.IO failed, manually adding message");
                appendMessage(data.message);
            } else {
                // Otherwise wait a bit to see if socket delivers it
                setTimeout(() => {
                    if (data.message && !document.querySelector(`[data-message-id="${data.message.id}"]`)) {
                        console.log("Message not received via socket, manually adding");
                        appendMessage(data.message);
                    }
                }, 1000);
            }
        } else {
            alert("Failed to send message: " + (data.error || "Unknown error"));
        }
    })
    .catch(error => {
        console.error("Error uploading file:", error);
        alert("Failed to upload file. Please try again. Error: " + error.message);
    });
}



// Handle file selection
function handleFileSelection(e) {
    if (!e.target.files || e.target.files.length === 0) {
        console.log("No files selected");
        return;
    }
    
    const file = e.target.files[0];
    console.log("File selected:", file.name, "Type:", file.type, "Size:", file.size);
    
    // Validate file type and size here if needed
    if (!file.type.startsWith('image/') && 
        !file.type.startsWith('audio/') && 
        !file.type.startsWith('video/') && 
        !allowedFileTypes.includes(file.type)) {
        alert('Unsupported file type. Please select an image, audio, video, or document file.');
        fileInput.value = '';
        return;
    }
    
    // Clear existing attachments
    pendingAttachments = [];
    
    // Add new attachment
    pendingAttachments.push({
        id: Date.now(),
        file: file,
        name: file.name,
        size: file.size,
        type: file.type
    });
    
    console.log("Added attachment to pending list:", pendingAttachments);
    
    // Show attachment preview
    renderAttachmentPreview();
    
    // Reset file input
    fileInput.value = '';
}

// Render attachment preview
function renderAttachmentPreview() {
    if (pendingAttachments.length === 0) {
        attachmentPreview.style.display = 'none';
        return;
    }
    
    attachmentPreview.style.display = 'flex';
    attachmentPreview.innerHTML = '';
    
    pendingAttachments.forEach(attachment => {
        const previewItem = document.createElement('div');
        previewItem.className = 'attachment-preview-item';
        
        // Create preview based on file type
        if (attachment.type.startsWith('image/')) {
            const imgUrl = URL.createObjectURL(attachment.file);
            
            previewItem.innerHTML = `
                <div class="preview-image">
                    <img src="${imgUrl}" alt="${attachment.name}">
                </div>
                <div class="preview-info">
                    <div class="preview-name">${attachment.name}</div>
                    <div class="preview-size">${formatFileSize(attachment.size)}</div>
                </div>
                <button class="preview-remove" data-id="${attachment.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
        } else {
            // Determine icon based on file type
            let fileIcon = 'fa-file';
            if (attachment.type.includes('pdf')) fileIcon = 'fa-file-pdf';
            else if (attachment.type.includes('audio')) fileIcon = 'fa-file-audio';
            else if (attachment.type.includes('video')) fileIcon = 'fa-file-video';
            else if (attachment.type.includes('word')) fileIcon = 'fa-file-word';
            else if (attachment.type.includes('excel') || attachment.type.includes('spreadsheet')) fileIcon = 'fa-file-excel';
            
            previewItem.innerHTML = `
                <div class="preview-icon">
                    <i class="fas ${fileIcon}"></i>
                </div>
                <div class="preview-info">
                    <div class="preview-name">${attachment.name}</div>
                    <div class="preview-size">${formatFileSize(attachment.size)}</div>
                </div>
                <button class="preview-remove" data-id="${attachment.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        // Add event listener to remove button
        const removeBtn = previewItem.querySelector('.preview-remove');
        removeBtn.addEventListener('click', () => {
            removeAttachment(attachment.id);
        });
        
        attachmentPreview.appendChild(previewItem);
    });
}

// Remove an attachment from the preview
function removeAttachment(id) {
    pendingAttachments = pendingAttachments.filter(attachment => attachment.id !== id);
    renderAttachmentPreview();
}

// Clear attachment preview
function clearAttachmentPreview() {
    pendingAttachments = [];
    attachmentPreview.innerHTML = '';
    attachmentPreview.style.display = 'none';
}

// Handle typing indicator
function handleTypingIndicator() {
    if (!currentLobbyId) return;
    
    // Notify server user is typing
    socket.emit('user_typing', {
        lobby_id: currentLobbyId
    });
    
    // Clear existing timeout
    clearTimeout(window.typingTimeout);
    
    // Set timeout to stop typing indicator
    window.typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', {
            lobby_id: currentLobbyId
        });
    }, 3000);
}

// Show typing indicator
function showTypingIndicator(username) {
    typingUsername.textContent = username;
    typingIndicator.style.display = 'flex';
}

// Hide typing indicator
function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

// Toggle profile panel visibility
function toggleProfilePanel() {
    if (profilePanel.style.display === 'none' || profilePanel.style.display === '') {
        // Show profile
        if (currentLobbyId) {
            showProfile();
        }
    } else {
        // Hide profile
        profilePanel.style.display = 'none';
    }
}

// Show user profile
function showProfile() {
    console.log("Показываем профиль пользователя");
    
    // Получаем выбранное лобби
    const lobby = lobbiesList.find(l => l.id === currentLobbyId) ||
                 (typeof archivedLobbiesList !== 'undefined' ? 
                  archivedLobbiesList.find(l => l.id === currentLobbyId) : null);
    
    if (!lobby) {
        console.warn("Не найдено лобби для отображения профиля");
        return;
    }
    
    // Обновляем заголовок в зависимости от типа лобби
    const profileTitle = document.querySelector('.profile-header .profile-title');
    if (profileTitle) {
        profileTitle.textContent = lobby.is_group ? 'Информация о группе' : 'Профиль пользователя';
    }
    
    if (lobby.is_group) {
        // Показываем профиль группы
        document.getElementById('profileName').textContent = lobby.name || 'Группа без названия';
        
        // Формируем список участников для группового чата
        const memberCount = lobby.users ? lobby.users.length : 0;
        document.getElementById('profileTitle').textContent = `${memberCount} участников`;
        
        document.getElementById('profileStatusBadge').className = 'profile-status-badge';
        document.getElementById('profileStatusBadge').textContent = 'Группа';
        
        document.getElementById('profileAbout').textContent = lobby.description || 'Нет описания';
        
        // Скрываем контактную информацию для групп
        const contactInfoSection = document.getElementById('contactInfoSection');
        if (contactInfoSection) {
            contactInfoSection.style.display = 'none';
        }
        
        // Устанавливаем аватарку группы
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            if (lobby.avatar) {
                profileAvatar.src = lobby.avatar;
            } else {
                // Используем плейсхолдер с инициалами группы
                const initials = getInitials(lobby.name || 'Группа');
                profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=200`;
            }
        }
    } else {
        // Показываем профиль пользователя
        const otherUser = lobby.users ? lobby.users.find(user => user.id !== currentUser.id) : null;
        
        if (otherUser) {
            console.log("Отображаем данные пользователя из БД:", otherUser);
            
            // Показываем контактную информацию
            const contactInfoSection = document.getElementById('contactInfoSection');
            if (contactInfoSection) {
                contactInfoSection.style.display = 'block';
            }
            
            // Получаем данные НЕПОСРЕДСТВЕННО из объекта пользователя из базы данных
            // поля из таблицы Users: username, email, phone, avatar, is_online
            
            // Устанавливаем имя и статус
            document.getElementById('profileName').textContent = otherUser.username || 'Пользователь';
            document.getElementById('profileTitle').textContent = ''; // Очищаем подзаголовок
            
            // Устанавливаем статус онлайн/оффлайн на основе поля is_online из БД
            const isOnline = otherUser.is_online === true;
            const statusBadge = document.getElementById('profileStatusBadge');
            statusBadge.className = `profile-status-badge ${isOnline ? 'profile-status-online' : 'profile-status-offline'}`;
            statusBadge.textContent = isOnline ? 'В сети' : 'Не в сети';
            
            // Добавляем заглушку для поля about, которого может не быть в БД
            document.getElementById('profileAbout').textContent = 'Информация о пользователе';
            
            // Устанавливаем значения полей из БД
            const emailElem = document.getElementById('profileEmail');
            const usernameElem = document.getElementById('profileUsername');
            const phoneElem = document.getElementById('profilePhone');
            
            // Берем значения ТОЛЬКО из соответствующих полей БД
            if (emailElem) emailElem.textContent = otherUser.email || 'Email не указан';
            if (usernameElem) usernameElem.textContent = otherUser.username || 'Имя не указано';
            if (phoneElem) phoneElem.textContent = otherUser.phone || 'Телефон не указан';
            
            // Устанавливаем аватарку из поля avatar таблицы Users
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                if (otherUser.avatar) {
                    // Используем аватарку из БД напрямую
                    profileAvatar.src = otherUser.avatar;
                    console.log("Установлена аватарка из БД:", otherUser.avatar);
                } else {
                    // Используем плейсхолдер с инициалами пользователя, если аватарки нет
                    const initials = getInitials(otherUser.username || 'Пользователь');
                    profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=200`;
                    console.log("Используем плейсхолдер для аватарки пользователя", otherUser.username);
                }
            }
        }
    }
    
    // Загружаем общие файлы
    loadSharedFiles();
    
    // Показываем панель с анимацией
    const profilePanel = document.getElementById('profilePanel');
    if (profilePanel) {
        if (window.innerWidth <= 992) {
            // На мобильных устройствах используем анимацию
            profilePanel.style.display = 'flex';
            setTimeout(() => {
                profilePanel.classList.add('active');
            }, 10);
        } else {
            // На десктопе просто показываем панель
            profilePanel.style.display = 'flex';
        }
    }
}

// Load shared files between users
function loadSharedFiles() {
    if (!currentLobbyId) return;
    
    console.log("Загружаем общие файлы для лобби:", currentLobbyId);
    
    // Очищаем предыдущие файлы
    sharedFiles.innerHTML = '<div class="shared-files-loading"><i class="fas fa-spinner fa-spin"></i> Загрузка файлов...</div>';
    
    // Запрашиваем сообщения для этого лобби
    fetch(`/chat/lobby/${currentLobbyId}/messages`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            // Фильтруем сообщения с файлами
            const fileMessages = messages.filter(message => 
                message.message_type === 'file' || 
                message.message_type === 'image' || 
                message.message_type === 'audio' || 
                message.message_type === 'video'
            );
            
            // Очищаем контейнер для файлов
            sharedFiles.innerHTML = '';
            
            if (fileMessages.length === 0) {
                sharedFiles.innerHTML = '<div class="no-shared-files">Нет общих файлов</div>';
                return;
            }
            
            // Группируем файлы по типам
            const groupedFiles = {
                images: fileMessages.filter(m => m.message_type === 'image'),
                documents: fileMessages.filter(m => m.message_type === 'file'),
                media: fileMessages.filter(m => m.message_type === 'audio' || m.message_type === 'video')
            };
            
            // Добавляем заголовки разделов и файлы
            if (groupedFiles.images.length > 0) {
                const imagesSection = document.createElement('div');
                imagesSection.className = 'shared-files-section';
                imagesSection.innerHTML = `<h5 class="shared-files-title">Изображения (${groupedFiles.images.length})</h5>`;
                
                const imagesGrid = document.createElement('div');
                imagesGrid.className = 'shared-images-grid';
                
                groupedFiles.images.forEach(message => {
                    const imageItem = document.createElement('div');
                    imageItem.className = 'shared-image-item';
                    
                    // Нормализуем путь к файлу
                    let filePath = ensureValidPath(message.file_path);
                    
                    imageItem.innerHTML = `
                        <div class="shared-image-preview">
                            <img src="${filePath}" alt="${message.file_name || 'Изображение'}" loading="lazy">
                        </div>
                        <div class="shared-file-overlay">
                            <a href="${filePath}" download="${message.file_name || 'image'}" class="shared-file-download" title="Скачать">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    `;
                    
                    // Добавляем обработчик для просмотра изображений
                    imageItem.querySelector('img').addEventListener('click', () => {
                        openImageModal(filePath);
                    });
                    
                    imagesGrid.appendChild(imageItem);
                });
                
                imagesSection.appendChild(imagesGrid);
                sharedFiles.appendChild(imagesSection);
            }
            
            if (groupedFiles.documents.length > 0) {
                const docsSection = document.createElement('div');
                docsSection.className = 'shared-files-section';
                docsSection.innerHTML = `<h5 class="shared-files-title">Документы (${groupedFiles.documents.length})</h5>`;
                
                const docsList = document.createElement('div');
                docsList.className = 'shared-files-list';
                
                groupedFiles.documents.forEach(message => {
                    // Определяем иконку в зависимости от типа файла
                    let fileIcon = 'fa-file';
                    if (message.file_type === 'application/pdf') fileIcon = 'fa-file-pdf';
                    else if (message.file_type && message.file_type.includes('word')) fileIcon = 'fa-file-word';
                    else if (message.file_type && message.file_type.includes('excel')) fileIcon = 'fa-file-excel';
                    
                    // Нормализуем путь к файлу
                    let filePath = ensureValidPath(message.file_path);
                    
                    const fileItem = document.createElement('div');
                    fileItem.className = 'shared-file-item';
                    fileItem.innerHTML = `
                        <div class="shared-file-icon">
                            <i class="fas ${fileIcon}"></i>
                        </div>
                        <div class="shared-file-info">
                            <div class="shared-file-name">${message.file_name || 'Файл'}</div>
                            <div class="shared-file-meta">
                                ${formatFileSize(message.file_size || 0)} • ${formatDate(message.timestamp)}
                            </div>
                        </div>
                        <a href="${filePath}" download="${message.file_name || 'file'}" class="shared-file-download" title="Скачать">
                            <i class="fas fa-download"></i>
                        </a>
                    `;
                    
                    docsList.appendChild(fileItem);
                });
                
                docsSection.appendChild(docsList);
                sharedFiles.appendChild(docsSection);
            }
            
            if (groupedFiles.media.length > 0) {
                const mediaSection = document.createElement('div');
                mediaSection.className = 'shared-files-section';
                mediaSection.innerHTML = `<h5 class="shared-files-title">Медиа (${groupedFiles.media.length})</h5>`;
                
                const mediaList = document.createElement('div');
                mediaList.className = 'shared-files-list';
                
                groupedFiles.media.forEach(message => {
                    // Определяем тип медиа
                    const isAudio = message.message_type === 'audio';
                    
                    // Нормализуем путь к файлу
                    let filePath = ensureValidPath(message.file_path);
                    
                    const mediaItem = document.createElement('div');
                    mediaItem.className = 'shared-file-item';
                    mediaItem.innerHTML = `
                        <div class="shared-file-icon">
                            <i class="fas ${isAudio ? 'fa-file-audio' : 'fa-file-video'}"></i>
                        </div>
                        <div class="shared-file-info">
                            <div class="shared-file-name">${message.file_name || (isAudio ? 'Аудио' : 'Видео')}</div>
                            <div class="shared-file-meta">
                                ${formatFileSize(message.file_size || 0)} • ${formatDate(message.timestamp)}
                            </div>
                        </div>
                        <div class="shared-file-actions">
                            <a href="${filePath}" class="shared-file-play" title="Воспроизвести" target="_blank">
                                <i class="fas fa-play"></i>
                            </a>
                            <a href="${filePath}" download="${message.file_name || 'media'}" class="shared-file-download" title="Скачать">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    `;
                    
                    mediaList.appendChild(mediaItem);
                });
                
                mediaSection.appendChild(mediaList);
                sharedFiles.appendChild(mediaSection);
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки общих файлов:', error);
            sharedFiles.innerHTML = '<div class="no-shared-files error">Ошибка загрузки файлов</div>';
        });
}

// Инициализация улучшенного отображения профиля пользователя
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем наличие необходимых элементов в DOM
    setupProfilePanel();
    
    // Добавляем улучшенные стили для профильной панели
    addProfileStyles();
    
    // Улучшаем обработчик нажатия на кнопку профиля
    setupProfileToggleButton();
});

// Настройка панели профиля
function setupProfilePanel() {
    console.log("Настраиваем панель профиля");
    
    // Проверяем, существует ли элемент профильной панели
    const profilePanel = document.getElementById('profilePanel');
    if (!profilePanel) {
        console.error("Элемент profilePanel не найден");
        return;
    }
    
    // Проверяем, есть ли элемент для отображения телефона
    if (!document.getElementById('profilePhone')) {
        // Создаем элемент для отображения телефона, если его нет
        const contactInfoSection = document.getElementById('contactInfoSection');
        if (contactInfoSection) {
            // Проверяем, нужно ли добавить элемент для телефона
            if (!document.querySelector('.profile-info-item:has(#profilePhone)')) {
                const phoneItem = document.createElement('div');
                phoneItem.className = 'profile-info-item';
                phoneItem.innerHTML = `
                    <i class="fas fa-phone profile-info-icon"></i>
                    <span class="profile-info-label">Телефон:</span>
                    <span class="profile-info-value" id="profilePhone"></span>
                `;
                contactInfoSection.appendChild(phoneItem);
            }
        } else {
            // Если нет секции контактной информации, создаем её
            createContactInfoSection(profilePanel);
        }
    }
    
    // Улучшаем структуру для секции общих файлов
    enhanceSharedFilesSection();
}

// Создание секции контактной информации
function createContactInfoSection(profilePanel) {
    const profileContent = profilePanel.querySelector('.profile-content');
    if (!profileContent) return;
    
    const contactSection = document.createElement('div');
    contactSection.className = 'profile-section';
    contactSection.id = 'contactInfoSection';
    
    contactSection.innerHTML = `
        <h4 class="profile-section-title">
            <i class="fas fa-address-card"></i>
            Контактная информация
        </h4>
        <div class="profile-info-item">
            <i class="fas fa-envelope profile-info-icon"></i>
            <span class="profile-info-label">Email:</span>
            <span class="profile-info-value" id="profileEmail"></span>
        </div>
        <div class="profile-info-item">
            <i class="fas fa-user profile-info-icon"></i>
            <span class="profile-info-label">Логин:</span>
            <span class="profile-info-value" id="profileUsername"></span>
        </div>
        <div class="profile-info-item">
            <i class="fas fa-phone profile-info-icon"></i>
            <span class="profile-info-label">Телефон:</span>
            <span class="profile-info-value" id="profilePhone"></span>
        </div>
    `;
    
    // Вставляем секцию после информации о пользователе
    const userSection = profileContent.querySelector('.profile-user');
    if (userSection && userSection.nextElementSibling) {
        profileContent.insertBefore(contactSection, userSection.nextElementSibling);
    } else {
        profileContent.appendChild(contactSection);
    }
}

// Улучшение секции общих файлов
function enhanceSharedFilesSection() {
    const sharedFiles = document.getElementById('sharedFiles');
    if (!sharedFiles) return;
    
    // Добавляем улучшенный заголовок секции
    const filesSection = sharedFiles.closest('.profile-section');
    if (filesSection) {
        const sectionTitle = filesSection.querySelector('.profile-section-title');
        if (sectionTitle) {
            sectionTitle.innerHTML = '<i class="fas fa-file-alt"></i> Общие файлы';
        }
    }
    
    // Добавляем прелоадер для загрузки файлов
    sharedFiles.innerHTML = '<div class="shared-files-loading"><i class="fas fa-spinner fa-spin"></i> Загрузка файлов...</div>';
}

// Добавление улучшенных стилей для панели профиля
function addProfileStyles() {
    if (document.getElementById('improved-profile-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'improved-profile-styles';
    styleEl.textContent = `
        /* Улучшенные стили для панели профиля */
        .profile-panel {
            width: 320px;
            background-color: white;
            border-left: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            min-width: 300px;
            transition: all 0.3s ease;
            box-shadow: -5px 0 15px rgba(0, 0, 0, 0.05);
        }
        
        .profile-header {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f9f9f9;
        }
        
        .profile-title {
            font-weight: 600;
            font-size: 1.1rem;
            color: #333;
        }
        
        .profile-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s;
            background-color: rgba(0, 0, 0, 0.05);
        }
        
        .profile-close:hover {
            background-color: rgba(0, 0, 0, 0.1);
        }
        
        .profile-content {
            padding: 1.5rem;
        }
        
        .profile-user {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding-bottom: 1.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        
        .profile-avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            overflow: hidden;
            margin-bottom: 1rem;
            border: 4px solid #fff;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            background-color: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .profile-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .profile-name {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
            color: #333;
        }
        
        .profile-title {
            color: #666;
            margin-bottom: 0.75rem;
            font-size: 0.9rem;
        }
        
        .profile-status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
            margin-top: 0.5rem;
        }
        
        .profile-status-online {
            background-color: rgba(49, 162, 76, 0.1);
            color: var(--online-color);
        }
        
        .profile-status-offline {
            background-color: rgba(187, 187, 187, 0.1);
            color: var(--offline-color);
        }
        
        .profile-section {
            margin-bottom: 1.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        
        .profile-section:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .profile-section-title {
            font-size: 0.9rem;
            text-transform: uppercase;
            color: #999;
            margin-bottom: 1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
        }
        
        .profile-section-title i {
            margin-right: 0.5rem;
            font-size: 0.9rem;
        }
        
        .profile-about {
            font-size: 0.875rem;
            line-height: 1.6;
            color: #444;
            background-color: #f9f9f9;
            padding: 1rem;
            border-radius: 8px;
            border-left: 3px solid var(--primary-color);
        }
        
        .profile-info-item {
            display: flex;
            gap: 0.75rem;
            align-items: center;
            margin-bottom: 0.75rem;
            font-size: 0.875rem;
            padding: 0.5rem;
            border-radius: 6px;
            transition: background-color 0.2s;
        }
        
        .profile-info-item:hover {
            background-color: #f5f5f5;
        }
        
        .profile-info-item:last-child {
            margin-bottom: 0;
        }
        
        .profile-info-icon {
            color: var(--primary-color);
            width: 16px;
            text-align: center;
        }
        
        .profile-info-label {
            color: #888;
            width: 80px;
            flex-shrink: 0;
        }
        
        .profile-info-value {
            color: #333;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        /* Стили для отображения общих файлов */
        .shared-files {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .shared-files-section {
            margin-bottom: 1rem;
        }
        
        .shared-files-title {
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 0.75rem;
            color: #666;
        }
        
        .shared-files-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .shared-file-item {
            display: flex;
            align-items: center;
            padding: 0.75rem;
            background-color: #f5f7fa;
            border-radius: 8px;
            gap: 0.75rem;
            transition: all 0.2s;
        }
        
        .shared-file-item:hover {
            background-color: #e9ecf0;
        }
        
        .shared-file-icon {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
            border-radius: 6px;
            background-color: rgba(0, 0, 0, 0.05);
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.1rem;
            color: var(--primary-color);
        }
        
        .shared-file-info {
            flex: 1;
            min-width: 0;
        }
        
        .shared-file-name {
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #333;
            margin-bottom: 0.25rem;
        }
        
        .shared-file-meta {
            font-size: 0.7rem;
            color: #888;
        }
        
        .shared-file-download, .shared-file-play {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: white;
            color: #666;
            transition: all 0.2s;
            text-decoration: none;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .shared-file-download:hover, .shared-file-play:hover {
            background-color: var(--primary-color);
            color: white;
            transform: translateY(-2px);
        }
        
        .shared-file-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .no-shared-files {
            text-align: center;
            padding: 1.5rem;
            color: #888;
            background-color: #f5f7fa;
            border-radius: 8px;
            font-size: 0.9rem;
        }
        
        .no-shared-files.error {
            color: #e53935;
            background-color: rgba(229, 57, 53, 0.05);
        }
        
        .shared-files-loading {
            text-align: center;
            padding: 1rem;
            color: #666;
        }
        
        /* Сетка изображений */
        .shared-images-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }
        
        .shared-image-item {
            position: relative;
            aspect-ratio: 1;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
        }
        
        .shared-image-preview {
            width: 100%;
            height: 100%;
        }
        
        .shared-image-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s;
        }
        
        .shared-image-item:hover .shared-image-preview img {
            transform: scale(1.05);
        }
        
        .shared-file-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.4);
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .shared-image-item:hover .shared-file-overlay {
            opacity: 1;
        }
        
        /* Адаптивность для мобильных устройств */
        @media (max-width: 992px) {
            .profile-panel {
                position: fixed;
                right: 0;
                top: 56px;
                bottom: 0;
                z-index: 100;
                transform: translateX(100%);
                width: 100%;
                max-width: 350px;
            }
            
            .profile-panel.active {
                transform: translateX(0);
            }
        }
        
        @media (max-width: 480px) {
            .profile-panel {
                max-width: none;
            }
            
            .shared-images-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    
    document.head.appendChild(styleEl);
}

// Улучшение обработчика нажатия на кнопку профиля
function setupProfileToggleButton() {
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const closeProfileBtn = document.getElementById('closeProfile');
    const profilePanel = document.getElementById('profilePanel');
    
    if (!viewProfileBtn || !closeProfileBtn || !profilePanel) return;
    
    // Удаляем существующие обработчики, чтобы избежать дублирования
    const clonedViewBtn = viewProfileBtn.cloneNode(true);
    const clonedCloseBtn = closeProfileBtn.cloneNode(true);
    
    viewProfileBtn.parentNode.replaceChild(clonedViewBtn, viewProfileBtn);
    closeProfileBtn.parentNode.replaceChild(clonedCloseBtn, closeProfileBtn);
    
    // Добавляем улучшенные обработчики
    clonedViewBtn.addEventListener('click', () => {
        if (currentLobbyId) {
            showProfile();
            
            // Добавляем анимацию появления на мобильных устройствах
            if (window.innerWidth <= 992) {
                profilePanel.style.display = 'flex';
                setTimeout(() => {
                    profilePanel.classList.add('active');
                }, 10);
            } else {
                profilePanel.style.display = 'flex';
            }
        }
    });
    
    clonedCloseBtn.addEventListener('click', () => {
        // Плавно скрываем панель
        if (window.innerWidth <= 992) {
            profilePanel.classList.remove('active');
            setTimeout(() => {
                profilePanel.style.display = 'none';
            }, 300);
        } else {
            profilePanel.style.display = 'none';
        }
    });
}

// Вспомогательная функция для обеспечения корректного пути к файлу
function ensureValidPath(originalPath) {
    if (!originalPath) return '/static/img/image-error.png';
    
    // Если путь начинается с http или https, используем его как есть
    if (originalPath.startsWith('http://') || originalPath.startsWith('https://')) {
        return originalPath;
    }
    
    // Убедимся, что путь начинается с /
    const normalizedPath = originalPath.startsWith('/') ? originalPath : '/' + originalPath;
    
    // Если путь содержит /uploads/, преобразуем его для правильного доступа через /chat/uploads/
    if (normalizedPath.includes('/uploads/')) {
        return normalizedPath.replace('/uploads/', '/chat/uploads/');
    }
    
    // Если путь содержит /avatars/, преобразуем его для правильного доступа через /chat/avatars/
    if (normalizedPath.includes('/avatars/')) {
        return normalizedPath.replace('/avatars/', '/chat/avatars/');
    }
    
    return normalizedPath;
}

// Получение общего количества непрочитанных сообщений для обновления индикатора в навбаре
function updateUnreadMessagesTotal() {
    fetch('/chat/api/unread_messages_total')
        .then(response => response.json())
        .then(data => {
            // Обновляем индикатор в навигационной панели
            const navChatLink = document.querySelector('a.nav-link[href*="chat"]');
            if (navChatLink) {
                // Находим или создаем бейдж для непрочитанных сообщений
                let unreadBadge = navChatLink.querySelector('.unread-chat-badge');
                
                if (data.unread_count > 0) {
                    if (!unreadBadge) {
                        unreadBadge = document.createElement('span');
                        unreadBadge.className = 'unread-chat-badge';
                        navChatLink.appendChild(unreadBadge);
                    }
                    // Обновляем содержимое бейджа
                    unreadBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
                } else if (unreadBadge) {
                    unreadBadge.remove();
                }
            }
        })
        .catch(error => {
            console.error('Error fetching unread messages count:', error);
        });
}

// Обновление списка лобби с количеством непрочитанных сообщений
function updateLobbiesWithUnread() {
    fetch('/chat/api/lobbies_with_unread')
        .then(response => response.json())
        .then(lobbiesWithUnread => {
            // Создаем карту лобби с непрочитанными сообщениями для быстрого доступа
            const unreadCountMap = new Map();
            lobbiesWithUnread.forEach(item => {
                unreadCountMap.set(item.lobby_id, item.unread_count);
            });
            
            // Обновляем индикаторы непрочитанных сообщений для каждого контакта
            document.querySelectorAll('.contact-item[data-lobby-id]').forEach(contactItem => {
                const lobbyId = parseInt(contactItem.dataset.lobbyId);
                if (!lobbyId) return;
                
                // Находим или создаем бейдж для непрочитанных сообщений
                let unreadBadge = contactItem.querySelector('.unread-count-badge');
                
                if (unreadCountMap.has(lobbyId)) {
                    const unreadCount = unreadCountMap.get(lobbyId);
                    
                    if (!unreadBadge) {
                        unreadBadge = document.createElement('div');
                        unreadBadge.className = 'unread-count-badge';
                        contactItem.querySelector('.contact-info').appendChild(unreadBadge);
                    }
                    
                    unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    // Выделяем контакт с непрочитанными сообщениями
                    contactItem.classList.add('has-unread');
                } else if (unreadBadge) {
                    unreadBadge.remove();
                    contactItem.classList.remove('has-unread');
                }
            });
        })
        .catch(error => {
            console.error('Error fetching lobbies with unread messages:', error);
        });
}

// Helper Functions

// Get initials from a name
function getInitials(name) {
    if (!name) return '?';
    
    const words = name.split(' ');
    
    if (words.length === 1) {
        return name.charAt(0).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

// Format message text (handle line breaks, links, etc.)
function formatMessageText(text) {
    if (!text) return '';
    
    // Replace URLs with clickable links
    const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    text = text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
    
    // Replace line breaks with <br>
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Format time
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Setup Safari-specific fixes
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const appContainer = document.querySelector('.app-container');
    const contactsList = document.getElementById('contactsList');
    const chatContainer = document.getElementById('chatContainer');
    const activeChat = document.getElementById('activeChat');
    const noChatSelected = document.getElementById('noChatSelected');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const closeProfile = document.getElementById('closeProfile');
    const profilePanel = document.getElementById('profilePanel');
    const mobileChatBack = document.getElementById('mobileChatBack');
    const messageInput = document.getElementById('messageInput');
    
    // Function for Safari height adjustment
    function adjustHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Scroll to hide address bar
        setTimeout(function() {
            window.scrollTo(0, 1);
        }, 100);
    }
    
    // Mobile back button handler
    if (mobileChatBack) {
        mobileChatBack.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                // Switch back to contacts list
                appContainer.classList.remove('mobile-chat-active');
            }
        });
    }
    
    // Contact selection - modified for mobile first approach
    contactsList.addEventListener('click', function(e) {
        // Find clicked contact item (closest ancestor with contact class)
        const contactItem = e.target.closest('.contact-item');
        if (!contactItem) return;
        
        // Show chat container on mobile
        if (window.innerWidth <= 768) {
            // Enable active chat mode
            appContainer.classList.add('mobile-chat-active');
            activeChat.style.display = 'flex';
            noChatSelected.style.display = 'none';
        } else {
            // Standard behavior for desktop
            activeChat.style.display = 'flex';
            noChatSelected.style.display = 'none';
        }
    });
    
    // Handle profile panel toggle
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', function() {
            profilePanel.style.display = 'block';
            setTimeout(() => {
                profilePanel.classList.add('active');
            }, 10);
        });
    }
    
    if (closeProfile) {
        closeProfile.addEventListener('click', function() {
            profilePanel.classList.remove('active');
            setTimeout(() => {
                profilePanel.style.display = 'none';
            }, 300);
        });
    }
    
    // Handle window resize events
    window.addEventListener('resize', function() {
        adjustHeight(); // Call Safari height adjustment on resize
        
        if (window.innerWidth > 768) {
            // Reset mobile view states when returning to desktop
            appContainer.classList.remove('mobile-chat-active');
            
            // Restore normal view for desktop
            if (activeChat.style.display === 'flex') {
                chatContainer.style.display = 'flex';
            }
        }
    });
    
    // Auto-resize textarea for chat input
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            const newHeight = Math.min(this.scrollHeight, 120);
            this.style.height = newHeight + 'px';
        });
        
        // Add focus handler for mobile keyboard
        messageInput.addEventListener('focus', function() {
            setTimeout(function() {
                messageInput.scrollIntoView({behavior: 'smooth'});
            }, 300);
        });
    }
    
    // Call Safari height adjustment on load
    adjustHeight();
});

// Функция для закрытия контекстного меню
function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }
}

// Global variables for archive functionality
let archivedLobbiesList = [];
let activeContextMenu = null;
let pendingActionLobbyId = null;

function initArchiveFeatures() {
    console.log("Инициализация функций архивации");
    
    const archivedHeader = document.getElementById('archivedHeader');
    const archivedChats = document.getElementById('archivedChats');
    const archivedCount = document.getElementById('archivedCount');
    
    if (!archivedHeader || !archivedChats || !archivedCount) {
        console.warn("Не найдены элементы для архивации, повторная попытка через 500ms");
        setTimeout(initArchiveFeatures, 500);
        return;
    }
    
    // Загружаем архивированные лобби, если они еще не загружены
    if (!window.archivedLobbiesList || !Array.isArray(window.archivedLobbiesList)) {
        fetchArchivedLobbies().then(() => {
            console.log("Архивированные лобби загружены:");
            console.log(window.archivedLobbiesList);
        });
    } else {
        console.log("Архивированные лобби уже загружены:", window.archivedLobbiesList.length);
        // Принудительно обновляем интерфейс
        updateArchivedCount();
        renderArchivedChats();
    }
    
    // Настраиваем переключение отображения архивированных чатов
    archivedHeader.addEventListener('click', function() {
        this.classList.toggle('collapsed');
        archivedChats.classList.toggle('expanded');
    });
    
    // Настраиваем диалоги подтверждения
    setupConfirmationDialogs();
    
    // Настраиваем drag-to-archive
    setupDragToArchive();
    
    // Закрываем контекстное меню при клике вне его
    document.addEventListener('click', function(e) {
        if (window.activeContextMenu && !window.activeContextMenu.contains(e.target) && 
            !e.target.closest('.chat-context-menu-trigger')) {
            closeContextMenu();
        }
    });
}

// Fetch archived lobbies
function fetchArchivedLobbies() {
    console.log("Загрузка архивированных лобби");
    
    return new Promise((resolve, reject) => {
        fetch('/chat/lobbies/archived')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Ошибка загрузки архивированных лобби: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    // Сохраняем архивированные лобби
                    window.archivedLobbiesList = data;
                    
                    console.log(`Загружено ${data.length} архивированных лобби`);
                    
                    // Обновляем интерфейс
                    updateArchivedCount();
                    renderArchivedChats();
                    
                    resolve(data);
                } else {
                    console.error('Неверный формат данных архивированных лобби:', data);
                    reject(new Error('Неверный формат данных'));
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки архивированных лобби:', error);
                reject(error);
            });
    });
}


// Update archived count badge
function updateArchivedCount() {
    const archivedCount = document.getElementById('archivedCount');
    if (!archivedCount) return;
    
    // Проверяем, существует ли массив архивированных лобби
    if (window.archivedLobbiesList && Array.isArray(window.archivedLobbiesList)) {
        archivedCount.textContent = window.archivedLobbiesList.length;
        
        // Показываем/скрываем раздел архивированных чатов
        const archivedHeader = document.getElementById('archivedHeader');
        if (archivedHeader) {
            archivedHeader.style.display = window.archivedLobbiesList.length > 0 ? 'flex' : 'none';
        }
    } else {
        archivedCount.textContent = "0";
        
        // Скрываем раздел, если нет архивированных чатов
        const archivedHeader = document.getElementById('archivedHeader');
        if (archivedHeader) {
            archivedHeader.style.display = 'none';
        }
    }
}

// Render archived chats
function renderArchivedChats() {
    const archivedChats = document.getElementById('archivedChats');
    if (!archivedChats) return;
    
    archivedChats.innerHTML = '';
    
    // Проверяем наличие массива архивированных лобби
    if (!window.archivedLobbiesList || !Array.isArray(window.archivedLobbiesList) || window.archivedLobbiesList.length === 0) {
        console.log("Нет архивированных лобби для отображения");
        return;
    }
    
    console.log(`Отображение ${window.archivedLobbiesList.length} архивированных лобби`);
    
    // Сортируем архивированные лобби по дате архивации (новые сверху)
    window.archivedLobbiesList.sort((a, b) => {
        return new Date(b.archived_at || b.created_at) - new Date(a.archived_at || a.created_at);
    });
    
    // Отображаем каждое архивированное лобби
    window.archivedLobbiesList.forEach(lobby => {
        // Создаем элемент контакта
        const contactItem = createContactItemElement(lobby, true);
        
        // Добавляем его в список архивированных чатов
        archivedChats.appendChild(contactItem);
    });
}

// Show archive confirmation dialog
function showArchiveConfirmation(lobbyId) {
    pendingActionLobbyId = lobbyId;
    document.getElementById('archiveConfirmation').style.display = 'flex';
}

// Show unarchive confirmation dialog
function showUnarchiveConfirmation(lobbyId) {
    pendingActionLobbyId = lobbyId;
    document.getElementById('unarchiveConfirmation').style.display = 'flex';
}

// Show delete confirmation dialog
function showDeleteConfirmation(lobbyId) {
    pendingActionLobbyId = lobbyId;
    document.getElementById('deleteConfirmation').style.display = 'flex';
}

// Archive a lobby
function archiveLobby(lobbyId) {
    console.log(`Архивирование лобби ${lobbyId}`);
    
    // Показываем индикатор загрузки
    const loadingToast = showToast('Архивирование чата...', 'info', false);
    
    // Используем другой endpoint для персональной архивации
    fetch(`/chat/lobby/${lobbyId}/archive?personal=true`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ personal: true })
    })
    .then(response => {
        if (!response.ok) {
            // Если сервер вернул ошибку, попробуем получить детали ошибки
            return response.json().then(errorData => {
                throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // Закрываем индикатор загрузки
        if (loadingToast) loadingToast.remove();
        
        // Обрабатываем ответ сервера
        if (data.success || data.is_archived === true) {
            console.log('Лобби успешно архивировано:', data);
            
            // Находим лобби в списке
            const lobby = window.lobbiesList ? window.lobbiesList.find(l => l.id == lobbyId) : null;
            const lobbyData = data.lobby || lobby || { id: lobbyId };
            
            // Обновляем локальные данные, даже если лобби не найдено в списке
            if (window.lobbiesList) {
                // Удаляем из активных лобби
                window.lobbiesList = window.lobbiesList.filter(l => l.id != lobbyId);
            }
            
            // Инициализируем массив архивированных лобби, если он еще не существует
            if (!window.archivedLobbiesList) {
                window.archivedLobbiesList = [];
            }
            
            // Добавляем в архивированные лобби, если его там еще нет
            if (!window.archivedLobbiesList.some(l => l.id == lobbyId)) {
                // Помечаем лобби как архивированное
                lobbyData.is_archived = true;
                // Добавляем дату архивации, если ее нет
                if (!lobbyData.archived_at) {
                    lobbyData.archived_at = new Date().toISOString();
                }
                window.archivedLobbiesList.push(lobbyData);
            }
            
            // Принудительно обновляем интерфейс
            updateArchivedCount();
            renderArchivedChats();
            renderContacts();
            
            // Показываем уведомление об успехе
            showToast('Чат успешно архивирован');
            
            // Если это был активный чат, показываем "No chat selected"
            if (currentLobbyId === parseInt(lobbyId)) {
                showNoChatSelectedView();
            }
            
            // Принудительно обновляем список архивированных чатов
            setTimeout(() => {
                // Перезагрузка архивированных лобби с сервера для согласованности
                fetchArchivedLobbies();
            }, 500);
        } else {
            console.error('Ошибка архивации лобби:', data.error || 'Неизвестная ошибка');
            showToast('Не удалось архивировать чат: ' + (data.error || 'Неизвестная ошибка'), 'error');
            
            // Перезагрузка лобби для восстановления состояния
            fetchLobbies();
            fetchArchivedLobbies();
        }
    })
    .catch(error => {
        // Закрываем индикатор загрузки
        if (loadingToast) loadingToast.remove();
        
        console.error('Ошибка архивации лобби:', error);
        showToast('Не удалось архивировать чат, но мы попробуем снова. Пожалуйста, подождите...', 'warning');
        
        // Попробуем альтернативный подход: сначала локально архивируем, затем обновим данные
        const lobby = window.lobbiesList ? window.lobbiesList.find(l => l.id == lobbyId) : null;
        
        if (lobby) {
            // Удаляем из активных лобби
            window.lobbiesList = window.lobbiesList.filter(l => l.id != lobbyId);
            
            // Инициализируем массив архивированных лобби, если он еще не существует
            if (!window.archivedLobbiesList) {
                window.archivedLobbiesList = [];
            }
            
            // Добавляем в архивированные лобби
            if (!window.archivedLobbiesList.some(l => l.id == lobbyId)) {
                // Создаем копию лобби и помечаем как архивированное
                const archivedLobby = {...lobby, is_archived: true, archived_at: new Date().toISOString()};
                window.archivedLobbiesList.push(archivedLobby);
            }
            
            // Обновляем интерфейс
            updateArchivedCount();
            renderArchivedChats();
            renderContacts();
            
            // Если это был активный чат, показываем "No chat selected"
            if (currentLobbyId === parseInt(lobbyId)) {
                showNoChatSelectedView();
            }
            
            // Принудительно обновляем список архивированных чатов
            setTimeout(() => {
                fetchArchivedLobbies();
            }, 1000);
        } else {
            // Если лобби не найдено, просто перезагрузим данные
            fetchLobbies();
            fetchArchivedLobbies();
        }
    });
}

// Unarchive a lobby
function unarchiveLobby(lobbyId) {
    console.log(`Разархивирование лобби ${lobbyId}`);
    
    // Показываем индикатор загрузки
    const loadingToast = showToast('Разархивирование чата...', 'info', false);
    
    fetch(`/chat/lobby/${lobbyId}/archive?personal=true`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ personal: true })
    })
    .then(response => {
        if (!response.ok) {
            // Если сервер вернул ошибку, попробуем получить детали ошибки
            return response.json().then(errorData => {
                throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // Закрываем индикатор загрузки
        if (loadingToast) loadingToast.remove();
        
        // Обрабатываем ответ сервера
        if (data.success || data.is_archived === false) {
            console.log('Лобби успешно разархивировано:', data);
            
            // Находим лобби в списке архивированных
            const lobby = window.archivedLobbiesList ? window.archivedLobbiesList.find(l => l.id == lobbyId) : null;
            const lobbyData = data.lobby || lobby || { id: lobbyId };
            
            // Обновляем локальные данные
            if (window.archivedLobbiesList) {
                // Удаляем из архивированных лобби
                window.archivedLobbiesList = window.archivedLobbiesList.filter(l => l.id != lobbyId);
            }
            
            // Инициализируем массив активных лобби, если он еще не существует
            if (!window.lobbiesList) {
                window.lobbiesList = [];
            }
            
            // Добавляем в активные лобби, если его там еще нет
            if (!window.lobbiesList.some(l => l.id == lobbyId)) {
                // Помечаем лобби как не архивированное
                lobbyData.is_archived = false;
                lobbyData.archived_at = null;
                window.lobbiesList.push(lobbyData);
            }
            
            // Принудительно обновляем интерфейс
            updateArchivedCount();
            renderArchivedChats();
            renderContacts();
            
            // Показываем уведомление об успехе
            showToast('Чат успешно разархивирован');
            
            // Принудительно обновляем списки
            setTimeout(() => {
                fetchLobbies();
            }, 500);
        } else {
            console.error('Ошибка разархивации лобби:', data.error || 'Неизвестная ошибка');
            showToast('Не удалось разархивировать чат: ' + (data.error || 'Неизвестная ошибка'), 'error');
            
            // Перезагрузка лобби для восстановления состояния
            fetchLobbies();
            fetchArchivedLobbies();
        }
    })
    .catch(error => {
        // Закрываем индикатор загрузки
        if (loadingToast) loadingToast.remove();
        
        console.error('Ошибка разархивации лобби:', error);
        showToast('Не удалось разархивировать чат, но мы попробуем снова. Пожалуйста, подождите...', 'warning');
        
        // Попробуем альтернативный подход: сначала локально разархивируем, затем обновим данные
        const lobby = window.archivedLobbiesList ? window.archivedLobbiesList.find(l => l.id == lobbyId) : null;
        
        if (lobby) {
            // Удаляем из архивированных лобби
            window.archivedLobbiesList = window.archivedLobbiesList.filter(l => l.id != lobbyId);
            
            // Инициализируем массив активных лобби, если он еще не существует
            if (!window.lobbiesList) {
                window.lobbiesList = [];
            }
            
            // Добавляем в активные лобби
            if (!window.lobbiesList.some(l => l.id == lobbyId)) {
                // Создаем копию лобби и помечаем как не архивированное
                const unarchiveLobby = {...lobby, is_archived: false, archived_at: null};
                window.lobbiesList.push(unarchiveLobby);
            }
            
            // Обновляем интерфейс
            updateArchivedCount();
            renderArchivedChats();
            renderContacts();
            
            // Принудительно обновляем списки
            setTimeout(() => {
                fetchLobbies();
            }, 1000);
        } else {
            // Если лобби не найдено, просто перезагрузим данные
            fetchLobbies();
            fetchArchivedLobbies();
        }
    });
}

// Delete a lobby
function deleteLobby(lobbyId) {
    fetch(`/chat/lobby/${lobbyId}/delete`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove from both lists
                lobbiesList = lobbiesList.filter(l => l.id != lobbyId);
                archivedLobbiesList = archivedLobbiesList.filter(l => l.id != lobbyId);
                
                // Re-render both lists
                renderContacts();
                renderArchivedChats();
                updateArchivedCount();
                
                // Show success message
                showToast('Chat deleted successfully');
                
                // If this was the active chat, show "No chat selected"
                if (currentLobbyId === parseInt(lobbyId)) {
                    showNoChatSelectedView();
                }
            } else {
                showToast('Failed to delete chat: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting lobby:', error);
            showToast('Failed to delete chat. Please try again.', 'error');
        });
}

// Setup drag to archive functionality
function setupDragToArchive() {
    const archiveDropZone = document.getElementById('archiveDropZone');
    
    // Show drop zone when dragging starts
    function showArchiveDropZone() {
        archiveDropZone.style.display = 'flex';
    }
    
    // Hide drop zone when dragging ends
    function hideArchiveDropZone() {
        archiveDropZone.style.display = 'none';
        archiveDropZone.classList.remove('active');
    }
    
    // Setup drop zone event listeners
    archiveDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        archiveDropZone.classList.add('active');
    });
    
    archiveDropZone.addEventListener('dragleave', () => {
        archiveDropZone.classList.remove('active');
    });
    
    archiveDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const lobbyId = e.dataTransfer.getData('text/plain');
        
        // Process the drop (archive the chat)
        if (lobbyId) {
            showArchiveConfirmation(lobbyId);
        }
        
        hideArchiveDropZone();
    });
    
    // Make these functions available
    window.showArchiveDropZone = showArchiveDropZone;
    window.hideArchiveDropZone = hideArchiveDropZone;
}

// Show a toast notification
function showToast(message, type = 'success', autoClose = true) {
    // Создаем тост элемент, если он не существует
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        document.body.appendChild(toast);
        
        // Добавляем стили тоста, если их нет
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                #toast-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    min-width: 250px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 2000;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    transition: opacity 0.3s, transform 0.3s;
                    opacity: 0;
                    transform: translateY(20px);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #toast-notification.visible {
                    opacity: 1;
                    transform: translateY(0);
                }
                #toast-notification.success {
                    background-color: #4caf50;
                }
                #toast-notification.error {
                    background-color: #f44336;
                }
                #toast-notification.info {
                    background-color: #2196f3;
                }
                #toast-notification.warning {
                    background-color: #ff9800;
                }
                .toast-close {
                    cursor: pointer;
                    margin-left: 10px;
                    font-weight: bold;
                }
                .toast-content {
                    flex: 1;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Создаем содержимое тоста
    toast.innerHTML = `
        <div class="toast-content">${message}</div>
        <div class="toast-close">&times;</div>
    `;
    
    // Устанавливаем тип тоста
    toast.className = type;
    
    // Показываем тост
    setTimeout(() => toast.classList.add('visible'), 10);
    
    // Добавляем обработчик для закрытия
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.textContent = '';
            }, 300);
        });
    }
    
    // Автоматически закрываем через 3 секунды
    let timeoutId;
    if (autoClose) {
        timeoutId = setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.textContent = '';
            }, 300);
        }, 3000);
    }
    
    // Возвращаем объект тоста для возможности дальнейшего управления
    return toast;
}

document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit to ensure other chat.js code has run
    setTimeout(initArchiveFeatures, 500);
});

// Функция для создания элемента контакта (отсутствует в текущем коде)
function createContactItemElement(lobby, isArchived) {
    if (!lobby) {
        console.error("Ошибка: lobby параметр не определен");
        return document.createElement('div'); // Возвращаем пустой элемент
    }
    
    const contactItem = document.createElement('div');
    contactItem.className = `contact-item ${isArchived ? 'archived' : ''} ${currentLobbyId === lobby.id ? 'selected' : ''}`;
    contactItem.dataset.lobbyId = lobby.id;
    contactItem.draggable = !isArchived; // Только неархивированные чаты можно перетаскивать
    
    // Определяем имя контакта и аватар
    let contactName;
    let avatarUrl;
    let avatarInitials;
    
    if (lobby.is_group) {
        contactName = lobby.name || 'Групповой чат';
        avatarUrl = lobby.avatar;
        avatarInitials = getInitials(contactName);
    } else {
        // Для прямых сообщений показываем информацию о другом пользователе
        const otherUser = lobby.users && Array.isArray(lobby.users) ? 
            lobby.users.find(user => user && currentUser && user.id !== currentUser.id) : null;
            
        contactName = otherUser ? otherUser.username : 'Неизвестный пользователь';
        avatarUrl = otherUser ? otherUser.avatar : null;
        avatarInitials = getInitials(contactName);
    }
    
    // Форматируем последнее сообщение и время
    let lastMessageText = 'Нет сообщений';
    let lastMessageTime = '';
    
    if (lobby.last_message) {
        const message = lobby.last_message;
        
        // Формат текста в зависимости от типа сообщения
        if (message.message_type === 'text') {
            lastMessageText = message.text.length > 30 ? message.text.substring(0, 27) + '...' : message.text;
        } else if (message.message_type === 'image') {
            lastMessageText = '📷 Изображение';
        } else if (message.message_type === 'file') {
            lastMessageText = '📎 Файл: ' + (message.file_name || 'без имени');
        } else if (message.message_type === 'audio') {
            lastMessageText = '🎵 Аудио';
        } else if (message.message_type === 'video') {
            lastMessageText = '📹 Видео';
        }
        
        // Форматирование времени
        if (message.timestamp) {
            const messageDate = new Date(message.timestamp);
            const now = new Date();
            
            if (messageDate.toDateString() === now.toDateString()) {
                // Сегодня - показываем время
                lastMessageTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (messageDate.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) {
                // В течение последней недели - показываем день недели
                const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                lastMessageTime = days[messageDate.getDay()];
            } else {
                // Старые сообщения - показываем дату
                lastMessageTime = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        }
    }
    
    // Архивный индикатор (если чат в архиве)
    const archiveIndicator = isArchived ? '<i class="fas fa-archive archive-indicator" title="Архивировано"></i>' : '';
    
    // Индикатор отключения уведомлений
    const isMuted = typeof isChatMuted === 'function' && isChatMuted(lobby.id);
    const muteIndicator = isMuted ? '<i class="fas fa-bell-slash mute-indicator" title="Уведомления отключены"></i>' : '';
    
    contactItem.innerHTML = `
        <div class="avatar">
            ${avatarUrl ? 
                `<img src="${avatarUrl}" alt="${contactName}" class="avatar-img">` : 
                `<span class="avatar-text">${avatarInitials}</span>`
            }
            <span class="status-indicator ${lobby.is_group ? 'status-group' : 'status-offline'}"></span>
        </div>
        <div class="contact-info">
            <div class="contact-name-row">
                <div class="contact-name">
                    ${contactName}
                    ${lobby.is_group ? '<i class="fas fa-users group-chat-icon" title="Групповой чат"></i>' : ''}
                    ${archiveIndicator}
                    ${muteIndicator}
                </div>
                <div class="contact-time">${lastMessageTime}</div>
            </div>
            <div class="contact-message">${lastMessageText}</div>
        </div>
        <div class="chat-context-menu-trigger" data-lobby-id="${lobby.id}">
            <i class="fas fa-ellipsis-v"></i>
        </div>
    `;
    
    // Обновляем статус онлайн для контакта
    if (!lobby.is_group) {
        const otherUser = lobby.users && Array.isArray(lobby.users) ? 
            lobby.users.find(user => currentUser && user.id !== currentUser.id) : null;
            
        if (otherUser) {
            const statusIndicator = contactItem.querySelector('.status-indicator');
            if (statusIndicator && otherUser.is_online === true) {
                statusIndicator.className = 'status-indicator status-online';
            }
        }
    }
    
    // Добавляем обработчик для выбора чата
    contactItem.addEventListener('click', (e) => {
        // Проверяем, что клик был не по контекстному меню
        if (!e.target.closest('.chat-context-menu-trigger')) {
            selectLobby(lobby.id, true); // true означает, что действие инициировано пользователем
        }
    });
    
    // Добавляем обработчик для контекстного меню
    const menuTrigger = contactItem.querySelector('.chat-context-menu-trigger');
    if (menuTrigger) {
        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            showContextMenu(e, lobby.id, isArchived);
        });
    }
    
    // Добавляем обработчики для Drag & Drop (только для неархивированных чатов)
    if (!isArchived) {
        contactItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', lobby.id);
            contactItem.classList.add('dragging');
            if (typeof showArchiveDropZone === 'function') {
                showArchiveDropZone();
            }
        });
        
        contactItem.addEventListener('dragend', () => {
            contactItem.classList.remove('dragging');
            if (typeof hideArchiveDropZone === 'function') {
                hideArchiveDropZone();
            }
        });
    }
    
    return contactItem;
}

// Функция для настройки диалогов подтверждения
function setupConfirmationDialogs() {
    // Архивирование
    document.getElementById('cancelArchive').addEventListener('click', () => {
        document.getElementById('archiveConfirmation').style.display = 'none';
        pendingActionLobbyId = null;
    });
    
    document.getElementById('confirmArchive').addEventListener('click', () => {
        document.getElementById('archiveConfirmation').style.display = 'none';
        if (pendingActionLobbyId) {
            archiveLobby(pendingActionLobbyId);
            pendingActionLobbyId = null;
        }
    });
    
    // Разархивирование
    document.getElementById('cancelUnarchive').addEventListener('click', () => {
        document.getElementById('unarchiveConfirmation').style.display = 'none';
        pendingActionLobbyId = null;
    });
    
    document.getElementById('confirmUnarchive').addEventListener('click', () => {
        document.getElementById('unarchiveConfirmation').style.display = 'none';
        if (pendingActionLobbyId) {
            unarchiveLobby(pendingActionLobbyId);
            pendingActionLobbyId = null;
        }
    });
    
    // Удаление
    document.getElementById('cancelDelete').addEventListener('click', () => {
        document.getElementById('deleteConfirmation').style.display = 'none';
        pendingActionLobbyId = null;
    });
    
    document.getElementById('confirmDelete').addEventListener('click', () => {
        document.getElementById('deleteConfirmation').style.display = 'none';
        if (pendingActionLobbyId) {
            deleteLobby(pendingActionLobbyId);
            pendingActionLobbyId = null;
        }
    });
}

// Функция для отображения контекстного меню
function showContextMenu(event, lobbyId, isArchived) {
    // Закрываем предыдущее контекстное меню
    if (activeContextMenu) {
        closeContextMenu();
    }
    
    // Останавливаем всплытие события
    event.stopPropagation();
    
    // Клонируем шаблон меню
    const contextMenu = document.getElementById('contextMenuTemplate').cloneNode(true);
    contextMenu.id = 'activeContextMenu';
    contextMenu.style.display = 'block';
    document.body.appendChild(contextMenu);
    
    // Находим лобби в массивах
    const lobby = lobbiesList.find(l => l.id === parseInt(lobbyId)) || 
                 archivedLobbiesList.find(l => l.id === parseInt(lobbyId));
                 
    // Настраиваем пункты меню в зависимости от статуса архивирования
    if (isArchived) {
        contextMenu.querySelector('.archive-option').style.display = 'none';
        contextMenu.querySelector('.unarchive-option').style.display = 'flex';
    } else {
        contextMenu.querySelector('.archive-option').style.display = 'flex';
        contextMenu.querySelector('.unarchive-option').style.display = 'none';
    }
    
    // Настраиваем пункт меню отключения уведомлений
    const muteOption = contextMenu.querySelector('.mute-option');
    if (muteOption && lobby) {
        const isMuted = isChatMuted(lobbyId);
        muteOption.innerHTML = `
            <i class="fas ${isMuted ? 'fa-bell' : 'fa-bell-slash'}"></i>
            <span>${isMuted ? 'Включить уведомления' : 'Отключить уведомления'}</span>
        `;
    }
    
    // Добавляем обработчики событий для пунктов меню
    contextMenu.querySelector('.archive-option').addEventListener('click', () => {
        showArchiveConfirmation(lobbyId);
        closeContextMenu();
    });
    
    contextMenu.querySelector('.unarchive-option').addEventListener('click', () => {
        showUnarchiveConfirmation(lobbyId);
        closeContextMenu();
    });
    
    contextMenu.querySelector('.delete-option').addEventListener('click', () => {
        showDeleteConfirmation(lobbyId);
        closeContextMenu();
    });
    
    // Добавляем обработчик для опции отключения уведомлений
    if (muteOption) {
        muteOption.addEventListener('click', () => {
            toggleChatMute(lobbyId);
            closeContextMenu();
            renderContacts(); // Обновляем список контактов для отображения иконки отключения
        });
    }
    
    // Позиционируем меню рядом с курсором, но в рамках окна
    const rect = event.target.getBoundingClientRect();
    
    // Получаем размеры меню
    const menuWidth = 180; // Примерная ширина меню
    const menuHeight = 160; // Примерная высота меню
    
    // Определяем позицию так, чтобы меню оставалось в пределах окна
    let left = rect.right + 5;
    let top = rect.top;
    
    // Проверяем, выходит ли меню за правый край
    if (left + menuWidth > window.innerWidth) {
        left = rect.left - menuWidth - 5;
    }
    
    // Проверяем, выходит ли меню за нижний край
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }
    
    // Убеждаемся, что меню не выходит за верхний край
    if (top < 0) {
        top = 10;
    }
    
    // Устанавливаем позицию
    contextMenu.style.position = 'fixed'; // Используем fixed вместо absolute
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.zIndex = '9999'; // Высокий z-index, чтобы меню было поверх остальных элементов
    
    // Сохраняем ссылку на активное меню
    activeContextMenu = contextMenu;
    
    // Добавляем обработчик для закрытия меню при клике вне его
    document.addEventListener('click', closeContextMenuOnClickOutside);
}

// Функция для закрытия меню при клике вне его
function closeContextMenuOnClickOutside(event) {
    if (activeContextMenu && !activeContextMenu.contains(event.target) && 
        !event.target.closest('.chat-context-menu-trigger')) {
        closeContextMenu();
        document.removeEventListener('click', closeContextMenuOnClickOutside);
    }
}

// Закрытие контекстного меню
function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
        document.removeEventListener('click', closeContextMenuOnClickOutside);
    }
}

// 2. Функции для управления отключением уведомлений для чатов

// Получаем список отключенных чатов из localStorage
function getMutedChats() {
    const mutedChats = localStorage.getItem('mutedChats');
    return mutedChats ? JSON.parse(mutedChats) : [];
}

// Проверяем, отключены ли уведомления для конкретного чата
function isChatMuted(lobbyId) {
    const mutedChats = getMutedChats();
    return mutedChats.includes(parseInt(lobbyId));
}

// Переключаем статус отключения уведомлений для чата
function toggleChatMute(lobbyId) {
    const mutedChats = getMutedChats();
    const lobbyIdInt = parseInt(lobbyId);
    
    if (isChatMuted(lobbyIdInt)) {
        // Включаем уведомления обратно
        const index = mutedChats.indexOf(lobbyIdInt);
        if (index > -1) {
            mutedChats.splice(index, 1);
        }
        showToast('Уведомления включены');
    } else {
        // Отключаем уведомления
        mutedChats.push(lobbyIdInt);
        showToast('Уведомления отключены');
    }
    
    // Сохраняем обновленный список
    localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
    
    // Обновляем интерфейс
    updateMuteIndicators();
}

// Обновляем индикаторы отключения уведомлений в списке чатов
function updateMuteIndicators() {
    const contactItems = document.querySelectorAll('.contact-item[data-lobby-id]');
    
    contactItems.forEach(item => {
        const lobbyId = parseInt(item.dataset.lobbyId);
        const isMuted = isChatMuted(lobbyId);
        
        // Находим или создаем индикатор отключения уведомлений
        let muteIndicator = item.querySelector('.mute-indicator');
        
        if (isMuted) {
            if (!muteIndicator) {
                muteIndicator = document.createElement('i');
                muteIndicator.className = 'fas fa-bell-slash mute-indicator';
                muteIndicator.title = 'Уведомления отключены';
                
                // Добавляем индикатор после имени контакта
                const contactName = item.querySelector('.contact-name');
                if (contactName) {
                    contactName.appendChild(muteIndicator);
                }
            }
        } else if (muteIndicator) {
            muteIndicator.remove();
        }
    });
}

// Исправление функции fetchLobbies для решения проблемы с промисами
function fetchLobbiesFixed() {
    return new Promise((resolve, reject) => {
        // Fetch non-archived lobbies by default
        fetch('/chat/lobbies')
            .then(response => response.json())
            .then(data => {
                lobbiesList = data;
                
                // Также получаем архивированные лобби
                fetchArchivedLobbies()
                    .then(() => {
                        renderContacts();
                        resolve(data);
                    })
                    .catch(error => {
                        console.error('Error fetching archived lobbies:', error);
                        // Всё равно рендерим контакты с имеющимися данными
                        renderContacts();
                        resolve(data);
                    });
            })
            .catch(error => {
                console.error('Error fetching lobbies:', error);
                reject(error);
            });
    });
}

// Перезаписываем fetchLobbies, чтобы использовать исправленную версию
window.fetchLobbies = fetchLobbiesFixed;

// Вызываем инициализацию чата после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Установка обработчиков для архивирования
    setTimeout(function() {
        try {
            setupConfirmationDialogs();
            console.log("Confirmation dialogs setup complete");
        } catch (e) {
            console.error("Error setting up confirmation dialogs:", e);
        }
    }, 500);
});

function updateUserOnlineStatus() {
    // Обновляем статусы пользователей в списке контактов
    document.querySelectorAll('.contact-item').forEach(contactItem => {
        const lobbyId = parseInt(contactItem.dataset.lobbyId);
        if (!lobbyId) return;
        
        let lobby = null;
        
        // Ищем лобби в активных или архивных
        if (window.lobbiesList) {
            lobby = window.lobbiesList.find(l => l.id === lobbyId);
        }
        
        if (!lobby && window.archivedLobbiesList) {
            lobby = window.archivedLobbiesList.find(l => l.id === lobbyId);
        }
        
        if (lobby && !lobby.is_group) {
            // Находим другого пользователя в лобби
            const otherUser = lobby.users.find(user => window.currentUser && user.id !== window.currentUser.id);
            if (otherUser) {
                // Обновляем индикатор статуса
                const statusIndicator = contactItem.querySelector('.status-indicator');
                if (statusIndicator) {
                    statusIndicator.className = `status-indicator ${otherUser.is_online === true ? 'status-online' : 'status-offline'}`;
                }
            }
        }
    });
    
    // Обновляем статус пользователя в активном чате, если открыт
    if (window.currentLobbyId) {
        let activeLobby = null;
        
        // Ищем в активных или архивных
        if (window.lobbiesList) {
            activeLobby = window.lobbiesList.find(lobby => lobby.id === window.currentLobbyId);
        }
        
        if (!activeLobby && window.archivedLobbiesList) {
            activeLobby = window.archivedLobbiesList.find(lobby => lobby.id === window.currentLobbyId);
        }
                           
        if (activeLobby && !activeLobby.is_group) {
            const otherUser = activeLobby.users.find(user => window.currentUser && user.id !== window.currentUser.id);
            if (otherUser && window.chatStatusIndicator && window.chatStatus) {
                window.chatStatusIndicator.className = `status-indicator ${otherUser.is_online === true ? 'status-online' : 'status-offline'}`;
                window.chatStatus.textContent = otherUser.is_online === true ? 'Online' : 'Offline';
            }
        }
    }
    
    // Обновляем статус в профиле, если он открыт
    if (window.profilePanel && window.profilePanel.style.display === 'flex' && window.currentLobbyId) {
        let profileLobby = null;
        
        // Ищем в активных или архивных
        if (window.lobbiesList) {
            profileLobby = window.lobbiesList.find(lobby => lobby.id === window.currentLobbyId);
        }
        
        if (!profileLobby && window.archivedLobbiesList) {
            profileLobby = window.archivedLobbiesList.find(lobby => lobby.id === window.currentLobbyId);
        }
                                
        if (profileLobby && !profileLobby.is_group) {
            const otherUser = profileLobby.users.find(user => window.currentUser && user.id !== window.currentUser.id);
            if (otherUser && window.profileStatusBadge) {
                window.profileStatusBadge.className = `profile-status-badge ${otherUser.is_online === true ? 'profile-status-online' : 'profile-status-offline'}`;
                window.profileStatusBadge.textContent = otherUser.is_online === true ? 'Online' : 'Offline';
            }
        }
    }
}

// Устанавливаем отслеживание статуса онлайн при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Настраиваем отслеживание статуса
    setupOnlineStatusTracking();
    
    // Периодически обновляем статусы
    setInterval(refreshAllOnlineStatuses, 60000); // каждую минуту
});

function setupImprovedSocketListeners() {
    if (!socket) return;
    
    // Удаляем существующий обработчик
    socket.off('user_status_change');
    
    // Добавляем новый обработчик
    socket.on('user_status_change', (data) => {
        console.log('Получено изменение статуса пользователя:', data);
        
        // Обновляем статус в списке пользователей
        if (window.usersList) {
            window.usersList.forEach(user => {
                if (user.id === data.user_id) {
                    user.is_online = data.is_online;
                    console.log(`Обновлен статус пользователя ${user.username} на ${data.is_online ? 'онлайн' : 'оффлайн'}`);
                }
            });
        }
        
        // Обновляем статус в списке лобби
        if (window.lobbiesList) {
            window.lobbiesList.forEach(lobby => {
                lobby.users.forEach(user => {
                    if (user.id === data.user_id) {
                        user.is_online = data.is_online;
                    }
                });
            });
        }
        
        if (window.archivedLobbiesList) {
            window.archivedLobbiesList.forEach(lobby => {
                if (lobby && lobby.users) {
                    lobby.users.forEach(user => {
                        if (user.id === data.user_id) {
                            user.is_online = data.is_online;
                        }
                    });
                }
            });
        }
        
        // Обновляем UI элементы
        updateUserOnlineStatus();
    });
}

// Объявляем звук уведомления
let notificationSound = null;

// Функция для инициализации звуковых уведомлений
function initNotificationSound() {
    console.log("Инициализация звуковых уведомлений");
    // Удаляем существующий звук, если он уже есть
    if (notificationSound) {
        notificationSound.pause();
        notificationSound = null;
    }
    
    try {
        // Создаем элемент Audio и устанавливаем несколько источников для надежности
        notificationSound = new Audio();
        notificationSound.volume = 0.5;
        
        // Добавляем несколько источников звука в разных форматах
        const soundSources = [
            '/static/sounds/notification_chats.mp3'
        ];
        
        // Проверяем, какой формат поддерживается браузером
        for (const source of soundSources) {
            const sourceElement = document.createElement('source');
            sourceElement.src = source;
            sourceElement.type = `audio/${source.split('.').pop()}`;
            notificationSound.appendChild(sourceElement);
        }
        
        // Предзагружаем звук
        notificationSound.load();
        console.log('Notification sound initialized with multiple sources');
        
        // Добавляем обработку ошибок
        notificationSound.onerror = function(e) {
            console.error('Ошибка загрузки звука уведомления:', e);
            // Создаем резервный звук
            try {
                // Встроенный звук в base64 (короткий "бип")
                notificationSound.volume = 0.5;
                console.log('Создан резервный звук уведомления');
            } catch (fallbackError) {
                console.error('Не удалось создать резервный звук уведомления:', fallbackError);
            }
        };
        
        // Добавляем обработчик для предварительной загрузки звука
        document.addEventListener('click', function loadSoundOnUserInteraction() {
            if (notificationSound) {
                notificationSound.load();
                notificationSound.play().then(() => {
                    notificationSound.pause();
                    notificationSound.currentTime = 0;
                    console.log('Звук уведомления предзагружен при взаимодействии с пользователем');
                }).catch(e => {
                    console.log('Предзагрузка не удалась, но это нормально:', e);
                });
            }
            // Удаляем обработчик после первого клика
            document.removeEventListener('click', loadSoundOnUserInteraction);
        });
        
    } catch (e) {
        console.error('Ошибка инициализации звука уведомления:', e);
    }
}

// Функция для воспроизведения звука уведомления
function playNotificationSound(message) {
    console.log("Попытка воспроизведения звука уведомления");

    // Проверяем, отключены ли уведомления для этого чата
    if (message && message.lobby_id && typeof isChatMuted === 'function' && isChatMuted(message.lobby_id)) {
        console.log(`Пропуск звука уведомления для отключенного чата ${message.lobby_id}`);
        return;
    }
    
    if (!notificationSound) {
        initNotificationSound();
    }
    
    try {
        // Сбрасываем позицию
        if (notificationSound.readyState >= 2) { // HAVE_CURRENT_DATA или выше
            notificationSound.currentTime = 0;
        }
        
        // Используем Promise для воспроизведения
        const playPromise = notificationSound.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Звук уведомления успешно воспроизведен');
            }).catch(error => {
                console.warn('Воспроизведение звука было заблокировано браузером:', error);
                
                // Пробуем воспроизвести звук с задержкой
                setTimeout(() => {
                    try {
                        notificationSound.play().catch(e => {
                            console.warn('Повторная попытка воспроизведения звука не удалась:', e);
                            
                            // Используем вибрацию как запасной вариант
                            if (navigator.vibrate) {
                                navigator.vibrate(200);
                            }
                        });
                    } catch (e) {
                        console.error('Ошибка при отложенном воспроизведении звука:', e);
                    }
                }, 500);
            });
        }
    } catch (e) {
        console.error('Не удалось воспроизвести звук уведомления:', e);
        
        // Пробуем использовать вибрацию как запасной вариант
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    }
}

// Инициализируем звук при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем звук
    initNotificationSound();
    
    // Также добавляем обработчик клика для разблокировки воспроизведения звука
    // (многие браузеры требуют взаимодействия с пользователем перед воспроизведением звука)
    document.addEventListener('click', function initSoundOnFirstClick() {
        if (notificationSound && notificationSound.paused) {
            // Загружаем и сразу ставим на паузу, чтобы разблокировать будущее воспроизведение
            notificationSound.load();
            notificationSound.play().then(() => {
                notificationSound.pause();
                console.log("Звук подготовлен к воспроизведению после взаимодействия с пользователем");
            }).catch(e => {
                console.log("Не удалось подготовить звук, но попробуем позже:", e);
            });
        }
        // Удаляем слушатель после первого клика
        document.removeEventListener('click', initSoundOnFirstClick);
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Добавляем стили, если их еще нет
    if (!document.getElementById('chat-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'chat-custom-styles';
        style.textContent = `
            /* Стили для контекстного меню */
            .chat-context-menu {
                position: fixed;
                background: white;
                border-radius: 8px;
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
                min-width: 160px;
                z-index: 9999;
                overflow: hidden;
            }
            
            .chat-context-menu-item {
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .chat-context-menu-item:hover {
                background-color: #f5f5f5;
            }
            
            .chat-context-menu-item.danger {
                color: #e53935;
            }
            
            .chat-context-menu-item.danger:hover {
                background-color: rgba(229, 57, 53, 0.1);
            }
            
            /* Стили для индикатора отключения уведомлений */
            .mute-indicator {
                margin-left: 6px;
                color: #888;
                font-size: 0.8rem;
            }
            
            /* Стили для кнопки контекстного меню */
            .chat-context-menu-trigger {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s, background-color 0.2s;
                background-color: var(--secondary-color);
                cursor: pointer;
                z-index: 5;
            }
            
            .contact-item {
                position: relative;
            }
            
            .contact-item:hover .chat-context-menu-trigger {
                opacity: 1;
            }
            
            .chat-context-menu-trigger:hover {
                background-color: var(--border-color);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Обновляем индикаторы отключения уведомлений при загрузке страницы
    setTimeout(updateMuteIndicators, 1000);
});

// Обновляем инициализацию страницы чата
const originalInitApp = window.initApp || function() {};
window.initApp = function() {
    // Вызываем оригинальную функцию
    originalInitApp.apply(this, arguments);
    
    // Дополнительные настройки
    initNotificationSound();
    
    // Устанавливаем улучшенные слушатели сокетов
    if (typeof socket !== 'undefined' && socket) {
        setupImprovedSocketListeners();
    }
    
    // Обновляем статусы пользователей
    updateUserOnlineStatus();
};

// Вызываем обновленную функцию setupSocketListeners, если страница уже загружена
if (document.readyState !== 'loading') {
    if (typeof socket !== 'undefined' && socket) {
        setupImprovedSocketListeners();
    }
    updateUserOnlineStatus();
}

// 5. Функция для ручного обновления всех статусов онлайн
function refreshAllOnlineStatuses() {
    console.log("Обновление статусов онлайн всех пользователей");
    
    // Запрашиваем актуальные данные с сервера
    fetch('/chat/api/all_users')
        .then(response => response.json())
        .then(users => {
            // Обновляем данные в массиве пользователей
            if (window.usersList) {
                users.forEach(serverUser => {
                    const localUser = window.usersList.find(u => u.id === serverUser.id);
                    if (localUser) {
                        localUser.is_online = serverUser.is_online;
                    }
                });
            }
            
            // Обновляем данные в лобби, если они существуют
            if (window.lobbiesList) {
                window.lobbiesList.forEach(lobby => {
                    lobby.users.forEach(lobbyUser => {
                        const serverUser = users.find(u => u.id === lobbyUser.id);
                        if (serverUser) {
                            lobbyUser.is_online = serverUser.is_online;
                        }
                    });
                });
            }
            
            // Вызываем функцию обновления UI, если она существует
            if (typeof updateUserOnlineStatus === 'function') {
                updateUserOnlineStatus();
            }
            
            console.log("Статусы онлайн обновлены с сервера");
        })
        .catch(error => {
            console.error("Не удалось обновить статусы онлайн:", error);
        });
}


// Вызываем инициализацию звука и обновление статусов при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем звук
    initNotificationSound();
    
    // Обновляем все статусы онлайн через некоторое время после загрузки
    setTimeout(refreshAllOnlineStatuses, 1000);
    
    // Установим периодическое обновление статусов онлайн
    setInterval(refreshAllOnlineStatuses, 60000); // Каждую минуту
});

// 6. Обновляем обработчик события нового сообщения в setupSocketListeners
function updateSocketNewMessageHandler() {
    socket.off('new_message'); // Удаляем текущий обработчик
    
    // Добавляем новый обработчик с учетом отключенных уведомлений
    socket.on('new_message', (message) => {
        console.log("Received new message from server:", message);
        
        // Check if this message is already in the DOM (avoid duplicates)
        if (document.querySelector(`[data-message-id="${message.id}"]`)) {
            console.log(`Message ${message.id} already in DOM, skipping`);
            return;
        }
        
        // Воспроизводим звук уведомления если сообщение от другого пользователя
        // и уведомления не отключены для этого чата
        if (message.sender_id !== currentUser.id && !isChatMuted(message.lobby_id)) {
            playNotificationSound(message);
        }
        
        if (message.lobby_id === currentLobbyId) {
            console.log("Message is for current lobby, appending...");
            appendMessage(message);
            
            // Mark message as read if from someone else
            if (message.sender_id !== currentUser.id) {
                socket.emit('read_messages', { lobby_id: currentLobbyId });
            }
        } else {
            // Если сообщение для другого лобби, обновляем только счетчики
            updateUnreadMessagesTotal();
            updateLobbiesWithUnread();
            
            // Обновляем последнее сообщение в лобби
            updateLobbyLastMessage(message.lobby_id, message);
        }
    });
}

// Вызываем обновление обработчика сокета при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    if (typeof socket !== 'undefined' && socket) {
        // Задержка, чтобы дать время другим скриптам инициализироваться
        setTimeout(updateSocketNewMessageHandler, 1000);
    }
});

// Исправленная функция обработки изменения статуса пользователя
function setupOnlineStatusTracking() {
    console.log("Настройка отслеживания статуса онлайн");
    
    // Устанавливаем обработчики событий окна для отслеживания подключения к сети
    window.addEventListener('online', () => updateOnlineStatus(true));
    window.addEventListener('offline', () => updateOnlineStatus(false));
    
    // Отслеживаем фокус/блюр окна для определения активности пользователя
    window.addEventListener('focus', () => updateOnlineStatus(true));
    window.addEventListener('blur', () => {
        // На мобильных устройствах не меняем статус при потере фокуса,
        // так как пользователь может просто переключаться между приложениями
        if (!isMobileDevice()) {
            updateOnlineStatus(false);
        }
    });
    
    // Отслеживаем видимость страницы для определения активности пользователя
    document.addEventListener('visibilitychange', () => {
        updateOnlineStatus(document.visibilityState === 'visible');
    });
    
    // Периодическое обновление статуса для поддержания активности
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            updateOnlineStatus(true);
        }
    }, 30000); // Каждые 30 секунд
    
    // Обновляем статус при загрузке страницы
    updateOnlineStatus(true);
    
    // Функции для определения типа устройства
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
}

// Функция для обновления статуса на сервере
function updateOnlineStatus(isOnline = navigator.onLine) {
    // Если нет сокета или пользователь не аутентифицирован, выходим
    if (!socket || !socket.connected || !window.currentUser) {
        console.log("Не удалось обновить статус: сокет не подключен или пользователь не аутентифицирован");
        return;
    }
    
    console.log(`Отправка статуса онлайн: ${isOnline}`);
    
    // Отправляем статус через Socket.IO
    socket.emit('update_online_status', { 
        is_online: isOnline 
    });
    
    // Также обновляем локальное состояние пользователя
    if (window.currentUser) {
        window.currentUser.is_online = isOnline;
    }
    
    // Если есть функция обновления UI, вызываем ее
    if (typeof updateUserOnlineStatus === 'function') {
        updateUserOnlineStatus();
    }
}


// Добавляем обработчик для синхронизации онлайн статуса
document.addEventListener('DOMContentLoaded', function() {
    setupOnlineStatusTracking();
});