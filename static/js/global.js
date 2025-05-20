// // global.js - Image handling functionality + chat notification badge

// // Инициализация модального окна для просмотра изображений
// // Улучшенная функция для настройки модального окна просмотра изображений
// function setupGlobalImageModal() {
//     // Удаляем существующее модальное окно, если оно есть
//     const existingModal = document.getElementById('globalImageModal');
//     if (existingModal) {
//         existingModal.remove();
//     }
    
//     // Создаем модальное окно
//     const modal = document.createElement('div');
//     modal.id = 'globalImageModal';
//     modal.className = 'global-image-modal';
    
//     const closeBtn = document.createElement('div');
//     closeBtn.className = 'global-image-modal-close';
//     closeBtn.innerHTML = '&times;';
    
//     const content = document.createElement('div');
//     content.className = 'global-image-modal-content';
    
//     const img = document.createElement('img');
//     img.id = 'globalModalImage';
    
//     content.appendChild(img);
//     modal.appendChild(content);
//     modal.appendChild(closeBtn);
    
//     document.body.appendChild(modal);
    
//     // Функция закрытия модального окна
//     function closeModal() {
//         modal.style.display = 'none';
//         document.body.style.overflow = '';
//     }
    
//     // Закрытие по клику на крестик
//     closeBtn.addEventListener('click', closeModal);
    
//     // Закрытие по клику вне изображения
//     modal.addEventListener('click', function(e) {
//         if (e.target === modal) {
//             closeModal();
//         }
//     });
    
//     // Обработка нажатия клавиши Escape
//     document.addEventListener('keydown', function(e) {
//         if (e.key === 'Escape' && modal.style.display === 'flex') {
//             closeModal();
//         }
//     });
    
//     // Экспортируем функции открытия и закрытия
//     window.openGlobalImageModal = function(imgSrc) {
//         img.src = imgSrc;
//         modal.style.display = 'flex';
//         document.body.style.overflow = 'hidden';
//     };
    
//     window.closeGlobalImageModal = closeModal;
    
//     return { modal, img };
// }


// // Функция для открытия изображения в модальном окне
// function openGlobalImageModal(imgSrc) {
//     let modal = document.getElementById('globalImageModal');
//     let modalImage = document.getElementById('globalModalImage');
    
//     // Если модальное окно не существует, создаем его
//     if (!modal || !modalImage) {
//         const modalElements = setupGlobalImageModal();
//         modal = modalElements.modal;
//         modalImage = modalElements.img;
//     }
    
//     // Устанавливаем источник изображения
//     modalImage.src = imgSrc;
    
//     // Показываем модальное окно
//     modal.style.display = 'flex';
    
//     // Запрещаем прокрутку страницы
//     document.body.style.overflow = 'hidden';
// }

// // Функция для закрытия модального окна
// function closeGlobalImageModal() {
//     const modal = document.getElementById('globalImageModal');
//     if (modal) {
//         modal.style.display = 'none';
//     }
    
//     // Возвращаем прокрутку страницы
//     document.body.style.overflow = '';
// }

// // Добавляем обработчик для всех изображений на странице
// // Функция для глобальной настройки просмотрщика изображений
// function setupImageViewers() {
//     // Функция для добавления обработчиков к изображениям
//     function addImageHandlers() {
//         const images = document.querySelectorAll('.attachment-image, .image-container img, .viewable-image, .shared-file-preview img');
        
//         images.forEach(img => {
//             // Проверяем, добавлен ли уже обработчик
//             if (!img.dataset.viewerAttached) {
//                 img.style.cursor = 'pointer';
                
//                 // Используем делегирование событий вместо прямого назначения
//                 img.dataset.viewerAttached = 'true';
                
//                 // Удаляем существующие обработчики, если они есть
//                 const oldClone = img.cloneNode(true);
//                 oldClone.dataset.viewerAttached = 'true';
//                 img.parentNode.replaceChild(oldClone, img);
                
//                 // Добавляем новый обработчик через делегирование
//                 oldClone.addEventListener('click', function handleImageClick(e) {
//                     e.preventDefault();
//                     e.stopPropagation();
                    
//                     // Проверяем, что функция существует
//                     if (typeof window.openGlobalImageModal === 'function') {
//                         window.openGlobalImageModal(this.src);
//                     } else {
//                         console.error('openGlobalImageModal function not found');
//                     }
                    
//                     return false;
//                 });
//             }
//         });
//     }
    
//     // Наблюдатель за DOM для динамически добавляемых изображений
//     const observer = new MutationObserver(function(mutations) {
//         let hasNewImages = false;
        
//         mutations.forEach(function(mutation) {
//             // Проверяем добавленные узлы
//             if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
//                 for (let i = 0; i < mutation.addedNodes.length; i++) {
//                     const node = mutation.addedNodes[i];
                    
//                     // Если это элемент DOM
//                     if (node.nodeType === 1) {
//                         // Если это изображение
//                         if (node.tagName === 'IMG' || 
//                             node.classList && (
//                                 node.classList.contains('attachment-image') || 
//                                 node.classList.contains('viewable-image')
//                             )) {
//                             hasNewImages = true;
//                         }
                        
//                         // Или если содержит изображения
//                         if (node.querySelector) {
//                             const containsImages = node.querySelector('img, .attachment-image, .viewable-image, .shared-file-preview img');
//                             if (containsImages) {
//                                 hasNewImages = true;
//                             }
//                         }
//                     }
//                 }
//             }
//         });
        
//         // Если найдены новые изображения, добавляем обработчики
//         if (hasNewImages) {
//             addImageHandlers();
//         }
//     });
    
//     // Запускаем наблюдатель
//     observer.observe(document.body, {
//         childList: true,
//         subtree: true
//     });
    
//     // Первичная настройка для существующих изображений
//     addImageHandlers();
    
//     // Обрабатываем загрузку новых изображений
//     document.addEventListener('load', function(event) {
//         if (event.target.tagName === 'IMG') {
//             // Небольшая задержка для стабильности
//             setTimeout(() => {
//                 addImageHandlers();
//             }, 100);
//         }
//     }, true);
    
//     return {
//         refresh: addImageHandlers,
//         observer: observer
//     };
// }

// // Модификация поведения страницы чатов, применяется чаще и раньше
// function modifyChatBehavior() {
//     // Проверяем, что существуют нужные элементы
//     const noChatSelected = document.getElementById('noChatSelected');
//     const contactsList = document.getElementById('contactsList');
    
//     if (!noChatSelected || !contactsList) {
//         console.log("Модификация чата: не найдены необходимые элементы, повтор через 100ms");
//         setTimeout(modifyChatBehavior, 100);
//         return;
//     }
    
//     console.log("Модификация чата: начало настройки");
    
//     // Убедиться, что список контактов всегда отображается
//     contactsList.style.display = 'flex';
//     contactsList.style.flexDirection = 'column';
    
//     // Показать "Ваши сообщения" по умолчанию
//     noChatSelected.style.display = 'flex';
    
//     // Перезаписываем функцию initApp, если она существует
//     if (typeof window.initApp === 'function') {
//         console.log("Модификация чата: найдена и перезаписана функция initApp");
//         const originalInitApp = window.initApp;
//         window.initApp = function() {
//             // Вызываем оригинальную функцию
//             originalInitApp.apply(this, arguments);
            
//             // Проверяем и загружаем контакты принудительно если их нет
//             if (window.lobbiesList && window.lobbiesList.length === 0) {
//                 console.log("Контакты не загружены, пробуем загрузить");
//                 if (typeof window.fetchLobbies === 'function') {
//                     window.fetchLobbies().then(() => {
//                         console.log("Контакты загружены, рендерим");
//                         if (typeof window.renderContacts === 'function') {
//                             window.renderContacts();
//                         }
//                     });
//                 }
//             }
            
//             // Убеждаемся, что "Ваши сообщения" показываются по умолчанию
//             if (noChatSelected && noChatSelected.style.display === 'none') {
//                 noChatSelected.style.display = 'flex';
//             }
            
//             // Убеждаемся, что чаты отсортированы по последнему сообщению
//             if (typeof window.renderContacts === 'function') {
//                 window.renderContacts();
//             }
//         };
//     }
    
//     // Перезаписываем функцию selectLobby, чтобы она не сохраняла выбранный чат в localStorage
//     if (typeof window.selectLobby === 'function') {
//         console.log("Модификация чата: найдена и перезаписана функция selectLobby");
//         const originalSelectLobby = window.selectLobby;
//         window.selectLobby = function(lobbyId, userInitiated) {
//             // Вызываем оригинальную функцию, но не позволяем автоматическое сохранение
//             if (arguments.length > 1) {
//                 // Если передан параметр userInitiated, используем его
//                 originalSelectLobby.call(this, lobbyId, userInitiated);
//             } else {
//                 // Иначе всегда указываем userInitiated=false, чтобы предотвратить сохранение в localStorage
//                 originalSelectLobby.call(this, lobbyId, false);
//             }
//         };
//     }
    
//     // Также обрабатываем случай загрузки страницы
//     if (typeof window.handleUrlParams === 'function') {
//         console.log("Модификация чата: найдена и перезаписана функция handleUrlParams");
//         const originalHandleUrlParams = window.handleUrlParams;
//         window.handleUrlParams = function() {
//             // Получаем параметры URL
//             const urlParams = new URLSearchParams(window.location.search);
//             const lobbyId = urlParams.get('lobby_id');
            
//             // Если в URL есть lobby_id, используем его
//             if (lobbyId) {
//                 originalHandleUrlParams.apply(this, arguments);
//             } else {
//                 // Иначе просто показываем "Ваши сообщения"
//                 if (noChatSelected) {
//                     noChatSelected.style.display = 'flex';
//                 }
//                 if (typeof window.showNoChatSelectedView === 'function') {
//                     window.showNoChatSelectedView();
//                 }
//             }
//         };
//     }
    
//     // Пытаемся форсировать рендеринг контактов
//     if (typeof window.fetchLobbies === 'function' && typeof window.renderContacts === 'function') {
//         console.log("Инициируем принудительную загрузку контактов");
//         window.fetchLobbies().then(() => {
//             console.log("Принудительная загрузка контактов завершена, рендерим");
//             window.renderContacts();
//         });
//     }
    
//     console.log("Модификация чата: настройка завершена");
// }

// // Настройка WebSocket для обновления счетчика непрочитанных сообщений на всех страницах
// function setupChatNotificationBadge() {
//     // Проверяем, есть ли Socket.IO на странице
//     if (typeof io !== 'undefined') {
//         // Создаем отдельный сокет для уведомлений о сообщениях, если он еще не создан
//         if (!window.notificationSocket) {
//             window.notificationSocket = io({
//                 transports: ['websocket'],
//                 upgrade: false
//             });
            
//             // При подключении
//             window.notificationSocket.on('connect', function() {
//                 console.log('Notification socket connected');
                
//                 // Получаем текущего пользователя
//                 fetch('/chat/api/user/current')
//                     .then(response => response.json())
//                     .then(user => {
//                         if (user && user.id) {
//                             // Присоединяемся к комнате пользователя
//                             window.notificationSocket.emit('join_user_room', { user_id: user.id });
                            
//                             // Сразу обновляем счетчик непрочитанных сообщений
//                             updateUnreadMessagesIndicator();
//                         }
//                     })
//                     .catch(error => {
//                         console.error('Error fetching current user:', error);
//                     });
//             });
            
//             // При получении нового сообщения
//             window.notificationSocket.on('new_message', function(message) {
//                 // Обновляем счетчик непрочитанных сообщений
//                 updateUnreadMessagesIndicator();
//             });
            
//             // При чтении сообщений
//             window.notificationSocket.on('messages_read', function() {
//                 // Обновляем счетчик непрочитанных сообщений
//                 updateUnreadMessagesIndicator();
//             });
//         }
//     }
// }

// // Функция для обновления индикатора непрочитанных сообщений в навбаре
// function updateUnreadMessagesIndicator() {
//     fetch('/chat/api/unread_messages_total')
//         .then(response => response.json())
//         .then(data => {
//             // Обновляем индикатор в навигационной панели
//             const navChatLink = document.querySelector('a.nav-link[href*="chat"]');
//             if (navChatLink) {
//                 // Находим или создаем бейдж для непрочитанных сообщений
//                 let unreadBadge = navChatLink.querySelector('.unread-chat-badge');
                
//                 if (data.unread_count > 0) {
//                     if (!unreadBadge) {
//                         unreadBadge = document.createElement('span');
//                         unreadBadge.className = 'unread-chat-badge';
//                         navChatLink.appendChild(unreadBadge);
//                     }
//                     // Обновляем содержимое бейджа
//                     unreadBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
//                 } else if (unreadBadge) {
//                     unreadBadge.remove();
//                 }
//             }
//         })
//         .catch(error => {
//             console.error('Error fetching unread messages count:', error);
//         });
// }

// // Код для чата - обеспечивает отображение существующих чатов при загрузке страницы чатов
// document.addEventListener('DOMContentLoaded', function() {
    
//     window.chatSocket = null;
//     function initGlobalSocket() {
//         if (typeof io === 'undefined') return;
//         window.chatSocket = io({
//             transports: ['websocket'],
//             upgrade: false,
//             reconnection: true,
//             reconnectionAttempts: 5,
//             reconnectionDelay: 1000
//         });
//     }
//     initGlobalSocket();

//     console.log("DOM загружен, запускается global.js");

//     // Создаем стили для модального окна, если их нет
//     if (!document.getElementById('globalImageModalStyles')) {
//         const style = document.createElement('style');
//         style.id = 'globalImageModalStyles';
//         style.textContent = `
//             .global-image-modal {
//                 position: fixed;
//                 top: 0;
//                 left: 0;
//                 right: 0;
//                 bottom: 0;
//                 background-color: rgba(0, 0, 0, 0.9);
//                 z-index: 10000;
//                 display: none;
//                 justify-content: center;
//                 align-items: center;
//                 cursor: pointer;
//             }
            
//             .global-image-modal-content {
//                 position: relative;
//                 max-width: 90%;
//                 max-height: 90%;
//             }
            
//             .global-image-modal-content img {
//                 max-width: 100%;
//                 max-height: 90vh;
//                 object-fit: contain;
//                 border-radius: 4px;
//                 cursor: auto;
//             }
            
//             .global-image-modal-close {
//                 position: absolute;
//                 top: 15px;
//                 right: 15px;
//                 color: white;
//                 font-size: 40px;
//                 cursor: pointer;
//                 z-index: 10001;
//                 width: 40px;
//                 height: 40px;
//                 display: flex;
//                 justify-content: center;
//                 align-items: center;
//                 transition: all 0.2s;
//             }
            
//             .global-image-modal-close:hover {
//                 transform: scale(1.1);
//             }
//         `;
//         document.head.appendChild(style);
//     }
    
//     // Настраиваем модальное окно для просмотра изображений
//     setupGlobalImageModal();
    
//     // Добавляем обработчики для изображений
//     setupImageViewers();
    
//     // Проверяем, находимся ли мы на странице чатов
//     const isChatPage = window.location.pathname.includes('/chat');
//     if (!isChatPage) {
//         // Установить интервал для периодического обновления счетчика на других страницах
//         return;
//     }
    
//     console.log("Обнаружена страница чатов, запускаем модификацию");
    
//     // Освобождаем localStorage от сохраненного ID лобби
//     localStorage.removeItem('currentLobbyId');
    
//     // Запускаем модификацию с несколькими повторами
//     modifyChatBehavior();
    
//     // Наблюдатель за изменениями DOM для добавления обработчиков к новым изображениям и повторного запуска модификации
//     const observer = new MutationObserver((mutations) => {
//     for (const mutation of mutations) {
//         if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
//         for (const node of mutation.addedNodes) {
//             if (node.nodeType !== 1) continue;
//             if (node.tagName === 'IMG' || node.querySelector('img')) {
//                 setupImageViewers();
//             }
//             if (node.id === 'contactsList' || node.id === 'noChatSelected' || 
//                 node.querySelector('#contactsList') || node.querySelector('#noChatSelected')) {
//                 console.log("Обнаружены изменения в DOM чата, запускаем модификацию");
//                 modifyChatBehavior();
//             }
//         }
//     }
//     });

//     // Настраиваем наблюдение за изменениями в содержимом документа
//     observer.observe(document.body, { childList: true, subtree: true });

//     // Добавляем стили для бейджа непрочитанных сообщений
//     addUnreadBadgeStyles();
    
//     // Настраиваем обновление счетчика непрочитанных сообщений
//     setupChatNotificationBadge();
    
//     // Сразу обновляем счетчик при загрузке страницы
//     updateUnreadMessagesIndicator();
    
//     // Установим интервал для периодического обновления счетчика
//     setInterval(updateUnreadMessagesIndicator, 60000); // Каждую минуту
// });

// // Добавляем стили для непрочитанных сообщений
// function addUnreadBadgeStyles() {
//     if (!document.getElementById('unreadBadgeStyles')) {
//         const style = document.createElement('style');
//         style.id = 'unreadBadgeStyles';
//         style.textContent = `
//             .unread-chat-badge {
//                 position: absolute;
//                 top: -5px;
//                 right: -5px;
//                 background-color: #f54b64;
//                 color: white;
//                 font-size: 0.7rem;
//                 width: 20px;
//                 height: 20px;
//                 border-radius: 50%;
//                 display: flex;
//                 justify-content: center;
//                 align-items: center;
//                 font-weight: bold;
//             }
            
//             @media (max-width: 768px) {
//                 .unread-chat-badge {
//                     top: 0;
//                     right: 0;
//                     font-size: 0.65rem;
//                     width: 18px;
//                     height: 18px;
//                 }
//             }
//         `;
//         document.head.appendChild(style);
//     }
// }