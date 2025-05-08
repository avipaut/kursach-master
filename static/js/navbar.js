document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const notificationBell = document.getElementById('notificationBell');
    const notificationCount = document.getElementById('notificationCount');
    const notificationDropdownContent = document.getElementById('notificationDropdownContent');
    const markAllReadBtn = document.querySelector('.mark-all-read');
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mainNav = document.querySelector('.main-nav');
    const testSoundBtn = document.getElementById('testSoundBtn');

    // Настройки звука
    let notificationSoundEnabled = true;
    const sound = new Audio(window.appConfig.notificationSound);
    sound.volume = 0.5;

    // Состояние уведомлений
    let lastKnownNotificationId = localStorage.getItem('lastNotificationId') || 0;
    let isFirstLoad = true;
    let notificationsLoaded = false;
    let socket = null;

    // Получаем ID текущего пользователя из шаблона
    const currentUserId = window.appConfig.currentUserId;
    // Инициализация Socket.IO
    function initSocketIO() {
        if (!currentUserId) {
            console.log('User not authenticated, skipping WebSocket connection');
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
            
            // Обновляем счетчик
            const currentCount = parseInt(notificationCount.textContent) || 0;
            notificationCount.textContent = currentCount + 1;
            notificationCount.style.display = 'block';
            
            // Загружаем свежие уведомления
            loadNotifications(false);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });
    }

    // Функция воспроизведения звука
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

    // Загрузка и обновление уведомлений
    function loadNotifications(showLoader = true) {
        if (showLoader) {
            notificationDropdownContent.innerHTML = `
                <div class="text-center p-3">
                    <div class="spinner-border spinner-border-sm text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>`;
        }

        return fetch(window.appConfig.notificationEndpoint)
            .then(response => response.json())
            .then(data => {
                const unreadCount = data.unread_count || 0;
                notificationCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
                notificationCount.style.display = unreadCount > 0 ? 'block' : 'none';

                if (!data.notifications || data.notifications.length === 0) {
                    notificationDropdownContent.innerHTML = `
                        <div class="text-center p-3 text-muted">
                            No notifications
                        </div>`;
                    return;
                }

                const latestNotification = data.notifications[0];
                const latestId = latestNotification.id;
                
                if (!isFirstLoad && latestId > lastKnownNotificationId) {
                    playNotificationSound();
                }
                
                lastKnownNotificationId = latestId;
                localStorage.setItem('lastNotificationId', lastKnownNotificationId);
                isFirstLoad = false;

                renderNotifications(data.notifications);
            })
            .catch(error => {
                console.error("Error loading notifications:", error);
                notificationDropdownContent.innerHTML = `
                    <div class="text-center p-3 text-danger">
                        Failed to load notifications
                    </div>`;
            });
    }

    // Рендер списка уведомлений
    function renderNotifications(notifications) {
        let html = notifications.map(notif => `
            <div class="dropdown-item px-3 py-2 notification-item ${notif.read ? '' : 'bg-light'}" 
                 data-id="${notif.id}">
                <div class="d-flex">
                    <div class="me-2">
                        <i class="bi bi-${getNotificationIcon(notif.category)}"></i>
                    </div>
                    <div>
                        <div class="mb-1">${notif.message}</div>
                        <div class="text-muted small">${notif.created_at}</div>
                        ${notif.link ? `<a href="${notif.link}" class="btn btn-sm btn-link p-0 mt-1">View</a>` : ''}
                    </div>
                </div>
            </div>
            <div class="dropdown-divider m-0"></div>
        `).join('');
        
        notificationDropdownContent.innerHTML = html;
        setupNotificationHandlers();
    }

    // Вспомогательные функции
    function getNotificationIcon(category) {
        const icons = {
            'success': 'check-circle text-success',
            'warning': 'exclamation-circle text-warning',
            'danger': 'x-circle text-danger',
            'default': 'info-circle text-info'
        };
        return icons[category] || icons.default;
    }

    function setupNotificationHandlers() {
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.tagName === 'A') return;
                
                const id = this.dataset.id;
                fetch(`{{ url_for("notifications.mark_as_read", notification_id=0) }}`.replace('/0', `/${id}`), {
                    method: 'POST'
                }).then(() => {
                    this.classList.remove('bg-light');
                    loadNotifications(false);
                });
            });
        });
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

        notificationBell.addEventListener('show.bs.dropdown', function() {
            if (!notificationsLoaded) {
                loadNotifications();
            }
        });

        markAllReadBtn.addEventListener('click', function() {
            fetch('/notifications/mark_all_as_read', {
                method: 'POST'
            }).then(() => loadNotifications());
        });

        testSoundBtn?.addEventListener('click', function() {
            playNotificationSound();
        });

        // Первоначальная загрузка уведомлений
        loadNotifications(false);
        
        // Периодическое обновление уведомлений
        setInterval(() => loadNotifications(false), 6000);
    }

    init();
});

// Функция для обновления индикатора непрочитанных сообщений в навбаре
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
            console.error('Error fetching unread messages count:', error);
        });
}