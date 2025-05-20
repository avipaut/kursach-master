document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mainNav = document.querySelector('.main-nav');
    const testSoundBtn = document.getElementById('testSoundBtn');
    
    // Активация ссылок KPI и Zoom
    activateNavLinks();

    // Настройки звука
    let notificationSoundEnabled = true;
    const sound = new Audio(window.appConfig.notificationSound);
    sound.volume = 0.5;

    // Состояние уведомлений
    let socket = null;

    // Получаем ID текущего пользователя из шаблона
    const currentUserId = window.appConfig.currentUserId;
    
    // Функция для активации ссылок в навбаре
    function activateNavLinks() {
        // Получаем текущий путь из window.appConfig или из window.location
        const currentPath = window.appConfig.currentPath || window.location.pathname;
        
        // Активируем ссылку KPI, если мы на странице KPI
        if (currentPath.includes('/kpi')) {
            const kpiLink = document.getElementById('kpi-link');
            if (kpiLink && !kpiLink.classList.contains('active')) {
                kpiLink.classList.add('active');
            }
        }
        
        // Активируем ссылку Zoom, если мы на странице Calendar/Zoom
        if (currentPath.includes('/calendar')) {
            const zoomLink = document.getElementById('zoom-link');
            if (zoomLink && !zoomLink.classList.contains('active')) {
                zoomLink.classList.add('active');
            }
        }
    }
    
    // Инициализация WebSocket для получения звуковых уведомлений
    function initSocketIO() {
        if (!currentUserId) {
            console.log('User not authenticated, skipping WebSocket connection');
            return;
        }
        if (window.chatSocket) {
            socket = window.chatSocket;
            return;
        }

        socket = io({
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            // Регистрируем пользователя при подключении
            socket.emit('register_user', { user_id: currentUserId });
        });

        socket.on('new_notification', (data) => {
            console.log('Received real-time notification:', data);
            playNotificationSound();
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });
    }

    // Воспроизведение звукового уведомления при получении нового сообщения
    function playNotificationSound() {
        if (!notificationSoundEnabled) return;
        
        try {
            sound.currentTime = 0;
            sound.play().catch(e => {
                console.log("Sound playback blocked:", e);
                if (navigator.vibrate) navigator.vibrate([200]);
            });
        } catch (e) {
            console.error("Sound error:", e);
        }
    }

    // Обработчик бургер-меню
    function toggleMobileMenu() {
        mainNav.classList.toggle('active');
        const icon = mobileMenuButton.querySelector('i');
        
        if (mainNav.classList.contains('active')) {
            icon.classList.replace('fa-bars', 'fa-times');
            document.body.style.overflow = 'hidden';
        } else {
            icon.classList.replace('fa-times', 'fa-bars');
            document.body.style.overflow = '';
        }
    }

    // Инициализация
    function init() {
        // Инициализируем WebSocket соединение
        initSocketIO();

        // Остальные обработчики событий
        mobileMenuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleMobileMenu();
        });

        document.addEventListener('click', function(e) {
            if (!mainNav.contains(e.target) && !mobileMenuButton.contains(e.target)) {
                mainNav.classList.remove('active');
                const icon = mobileMenuButton.querySelector('i');
                icon.classList.replace('fa-times', 'fa-bars');
                document.body.style.overflow = '';
            }
        });

        mainNav.addEventListener('click', function(e) {
            if (e.target.closest('.nav-link')) {
                toggleMobileMenu();
            }
        });

        testSoundBtn?.addEventListener('click', function() {
            playNotificationSound();
        });
    }

    init();
});

(function() {
    // Проверяем, была ли инициализация уже выполнена
    if (window.globalNotificationsInitialized) return;
    window.globalNotificationsInitialized = true;
    
    console.log("Инициализация глобальных уведомлений на всех страницах");
    
    // Глобальные переменные
    let currentUser = null;
    let notificationSound = null;
    let globalNotificationSocket = null;
    
    // Добавляем стили для бейджа на навбаре
    addNavbarBadgeStyles();
    
    // Получаем информацию о пользователе и запускаем систему уведомлений
    fetchCurrentUser()
        .then(user => {
            if (user) {
                currentUser = user;
                // Инициализируем звуковые уведомления
                initNotificationSound();
                // Создаем отдельный сокет только для уведомлений
                setupGlobalNotificationSocket(user);
                // Сразу обновляем индикатор непрочитанных сообщений
                updateNavbarBadge();
                // Установим периодическое обновление индикатора
                setInterval(updateNavbarBadge, 30000); // Каждые 30 секунд
            }
        })
        .catch(error => {
            console.error("Ошибка при инициализации глобальных уведомлений:", error);
        });
    
    // Функция для добавления стилей
    function addNavbarBadgeStyles() {
        if (!document.getElementById('navbar-badge-styles')) {
            const style = document.createElement('style');
            style.id = 'navbar-badge-styles';
            style.textContent = `
                .navbar-badge {
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
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                }
                
                @media (max-width: 768px) {
                    .navbar-badge {
                        top: 0;
                        right: 0;
                        font-size: 0.65rem;
                        width: 18px;
                        height: 18px;
                    }
                }
                
                .nav-item {
                    position: relative;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Функция для получения текущего пользователя
    function fetchCurrentUser() {
        return fetch('/chat/api/user/current')
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Не удалось получить информацию о пользователе');
            })
            .catch(error => {
                console.error('Ошибка получения информации о пользователе:', error);
                return null;
            });
    }
    
    // Функция для настройки сокета уведомлений
    function setupGlobalNotificationSocket(user) {
        // Проверяем, доступен ли Socket.IO
        if (typeof io === 'undefined') {
            console.warn('Socket.IO не доступен, глобальные уведомления не будут работать');
            return null;
        }
        
        try {
            // Создаем отдельный сокет только для уведомлений
            globalNotificationSocket = io({
                transports: ['websocket'],
                upgrade: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            
            console.log('Глобальный сокет для уведомлений создан');
            
            // При подключении
            globalNotificationSocket.on('connect', function() {
                console.log('Глобальный сокет для уведомлений подключен');
                
                // Присоединяемся к комнате пользователя
                if (user && user.id) {
                    globalNotificationSocket.emit('join_user_room', { user_id: user.id });
                }
            });
            
            // При получении нового сообщения
            globalNotificationSocket.on('new_message', function(message) {
                // Обновляем индикатор непрочитанных сообщений
                updateNavbarBadge();
                
                // Воспроизводим звук уведомления, если сообщение от другого пользователя
                // и мы не находимся на странице чатов
                if (user && message.sender_id !== user.id && !isOnChatPage()) {
                    playNotificationSound();
                }
            });
            
            // При чтении сообщений
            globalNotificationSocket.on('messages_read', function() {
                // Обновляем индикатор непрочитанных сообщений
                updateNavbarBadge();
            });
            
            return globalNotificationSocket;
        } catch (error) {
            console.error('Ошибка при создании глобального сокета:', error);
            return null;
        }
    }
    
    // Функция для проверки, находимся ли мы на странице чатов
    function isOnChatPage() {
        return window.location.pathname.includes('/chat');
    }
    
    // Функция для обновления бейджа на навбаре
    function updateNavbarBadge() {
        fetch('/chat/api/unread_messages_total')
            .then(response => response.json())
            .then(data => {
                // Находим ссылку на чаты в навбаре
                const chatLinks = document.querySelectorAll('a.nav-link[href*="chat"], a.nav-item[href*="chat"]');
                
                chatLinks.forEach(chatLink => {
                    // Находим родительский элемент nav-item
                    const navItem = chatLink.closest('.nav-item') || chatLink;
                    
                    // Если навбар не имеет класса nav-item, делаем относительное позиционирование
                    if (!navItem.classList.contains('nav-item')) {
                        navItem.style.position = 'relative';
                    }
                    
                    // Находим или создаем бейдж
                    let badge = navItem.querySelector('.navbar-badge');
                    
                    if (data.unread_count > 0) {
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'navbar-badge';
                            navItem.appendChild(badge);
                        }
                        badge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
                    } else if (badge) {
                        badge.remove();
                    }
                });
            })
            .catch(error => {
                console.error('Ошибка получения числа непрочитанных сообщений:', error);
            });
    }
    
    // Функция для инициализации звуковых уведомлений
    function initNotificationSound() {
        try {
            // Создаем элемент Audio для звуков уведомлений
            notificationSound = new Audio();
            notificationSound.volume = 0.5;
            
            // Пытаемся загрузить звук из разных источников
            const soundSources = [
                '/static/sounds/notification_chats.mp3',
                '/static/sounds/notification_chats.ogg',
                '/static/sounds/notification_chats.wav'
            ];
            
            // Добавляем источники звука
            soundSources.forEach(source => {
                const sourceElement = document.createElement('source');
                sourceElement.src = source;
                sourceElement.type = `audio/${source.split('.').pop()}`;
                notificationSound.appendChild(sourceElement);
            });
            
            // Предзагружаем звук
            notificationSound.load();
            
            console.log('Звук уведомления инициализирован');
            
            // Обработка ошибок
            notificationSound.onerror = function(e) {
                console.error('Ошибка загрузки звука уведомления:', e);
                // Создаем резервный звук
                try {
                    console.log('Создан резервный звук уведомления');
                } catch (fallbackError) {
                    console.error('Не удалось создать резервный звук:', fallbackError);
                }
            };
            
            // Добавляем обработчик для предварительной загрузки звука
            document.addEventListener('click', function initSoundOnClick() {
                try {
                    if (notificationSound && notificationSound.paused) {
                        notificationSound.load();
                        notificationSound.play().then(() => {
                            notificationSound.pause();
                            notificationSound.currentTime = 0;
                            console.log('Звук уведомления разблокирован');
                        }).catch(e => {
                            console.log('Предзагрузка звука не удалась, но это нормально:', e);
                        });
                    }
                } catch (e) {
                    console.error('Ошибка при инициализации звука по клику:', e);
                }
                document.removeEventListener('click', initSoundOnClick);
            }, { once: true });
            
        } catch (e) {
            console.error('Ошибка инициализации звука уведомления:', e);
        }
    }
    
    // Функция для воспроизведения звука уведомления
    function playNotificationSound() {
        if (!notificationSound) {
            initNotificationSound();
            return; // Выходим, так как звук еще не готов
        }
        
        try {
            // Сбрасываем позицию
            if (notificationSound.readyState >= 2) {
                notificationSound.currentTime = 0;
            }
            
            // Воспроизводим звук
            const playPromise = notificationSound.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('Звук уведомления успешно воспроизведен');
                }).catch(error => {
                    console.warn('Воспроизведение звука заблокировано:', error);
                    
                    // Пробуем воспроизвести с задержкой
                    setTimeout(() => {
                        notificationSound.play().catch(e => {
                            console.warn('Повторная попытка воспроизведения не удалась:', e);
                            // Используем вибрацию как запасной вариант
                            if (navigator.vibrate) {
                                navigator.vibrate(200);
                            }
                        });
                    }, 500);
                });
            }
        } catch (e) {
            console.error('Ошибка воспроизведения звука уведомления:', e);
            
            // Пробуем использовать вибрацию
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
        }
    }
})();
