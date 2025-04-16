// chat.js

let imageModal = null;
let modalImage = null;

// Функция для инициализации модального окна для просмотра изображений
function setupImageModal() {
    // Создаем модальное окно, если его еще нет
    if (!document.getElementById('imageModal')) {
        const modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'image-modal';
        
        const closeBtn = document.createElement('div');
        closeBtn.className = 'image-modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeImageModal);
        
        const content = document.createElement('div');
        content.className = 'image-modal-content';
        
        const img = document.createElement('img');
        
        content.appendChild(img);
        modal.appendChild(content);
        modal.appendChild(closeBtn);
        
        document.body.appendChild(modal);
        
        // Закрытие по клику вне изображения
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeImageModal();
            }
        });
        
        imageModal = modal;
        modalImage = img;
    }
}

// Функция для открытия изображения в модальном окне
function openImageModal(imageSrc) {
    if (!imageModal) {
        setupImageModal();
    }
    
    modalImage.src = imageSrc;
    imageModal.style.display = 'flex';
    
    // Запрещаем прокрутку страницы
    document.body.style.overflow = 'hidden';
}

// Функция для закрытия модального окна
function closeImageModal() {
    imageModal.style.display = 'none';
    
    // Возвращаем прокрутку страницы
    document.body.style.overflow = '';
}

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

// Function to try loading image from multiple possible paths
function tryLoadImage(imgElement, originalPath) {
    console.log("Loading image from path:", originalPath);
    
    if (!originalPath) {
        console.error("Image path is empty");
        imgElement.src = "/static/img/image-error.png"; // Fallback image
        return;
    }
    
    // Ensure the path starts with a slash if it doesn't already
    const normalizedPath = originalPath.startsWith('/') ? originalPath : '/' + originalPath;
    
    // Generate all possible paths to try
    const possiblePaths = [
        originalPath, // Original path as provided
        normalizedPath, // Normalized path with leading slash
        window.location.origin + normalizedPath, // Full URL
        '/chat' + normalizedPath, // Path with /chat prefix
        normalizedPath.replace('/uploads/', '/chat/uploads/'), // Replace /uploads with /chat/uploads
        normalizedPath.replace('/uploads/', '/static/uploads/'), // Replace /uploads with /static/uploads
        '/static' + normalizedPath // Path with /static prefix
    ];
    
    // Remove any duplicates from the paths array
    const uniquePaths = [...new Set(possiblePaths)];
    console.log("Will try these paths:", uniquePaths);
    
    // Track our attempts
    let currentIndex = 0;
    
    function tryNextPath() {
        if (currentIndex >= uniquePaths.length) {
            console.error("Failed to load image after trying all paths");
            imgElement.src = "/static/img/image-error.png"; // Fallback image
            return;
        }
        
        const path = uniquePaths[currentIndex++];
        console.log(`Trying path (${currentIndex}/${uniquePaths.length}): ${path}`);
        imgElement.src = path;
    }
    
    // Set success and error handlers
    imgElement.onload = function() {
        console.log("Successfully loaded image from:", this.src);
        imgElement.onerror = null; // Remove error handler once loaded
    };
    
    imgElement.onerror = function() {
        console.log(`Failed to load from: ${this.src}`);
        tryNextPath();
    };
    
    // Start with the first path
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
    // Explicitly show the "Your Messages" screen first
    showNoChatSelectedView();
    
    // Fetch current user info first
    fetchCurrentUser();
    
    // Then fetch all users for contacts list
    fetchAllUsers();
    
    // Then fetch lobbies and render them
    fetchLobbies();
    
    // Set up event listeners
    setupEventListeners();
    
    // Socket.IO event listeners
    setupSocketListeners();
    
    // Setup emoji picker
    setupEmojiPicker();
    
    // Check URL parameters (but do this ONLY when explicitly requested in URL)
    handleUrlParams();
    
    // Обновляем счетчики непрочитанных сообщений
    updateUnreadMessagesTotal();
    updateLobbiesWithUnread();
    
    // Установим интервал для периодического обновления счетчиков
    setInterval(() => {
        updateUnreadMessagesTotal();
        updateLobbiesWithUnread();
    }, 60000); // Обновляем каждую минуту
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
        fetch('/chat/lobbies')
            .then(response => response.json())
            .then(data => {
                lobbiesList = data;
                renderContacts();
                resolve();
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
    
    // User status change
    socket.on('user_status_change', (data) => {
        // Обновляем статус пользователя в списке
        const userItems = document.querySelectorAll(`.contact-item[data-user-id="${data.user_id}"]`);
        userItems.forEach(userItem => {
            const statusIndicator = userItem.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${data.is_online ? 'status-online' : 'status-offline'}`;
            }
        });
        
        // Обновляем статус пользователя в активном чате
        if (currentLobbyId) {
            const activeLobby = lobbiesList.find(lobby => lobby.id === currentLobbyId);
            if (activeLobby && !activeLobby.is_group) {
                const otherUser = activeLobby.users.find(user => user.id !== currentUser.id);
                if (otherUser && otherUser.id === data.user_id) {
                    chatStatusIndicator.className = `status-indicator ${data.is_online ? 'status-online' : 'status-offline'}`;
                    chatStatus.textContent = data.is_online ? 'Online' : 'Offline';
                }
            }
        }
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
    if (!emojiPicker) return;
    
    emojiPicker.innerHTML = '';
    
    // Популярные эмодзи по категориям
    const emojiCategories = [
        {
            name: 'Smileys',
            emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘']
        },
        {
            name: 'Gestures',
            emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '✋', '🤚', '🖐️', '👋', '🤏']
        },
        {
            name: 'Objects',
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
            emojiItem.addEventListener('click', () => {
                insertEmoji(emoji);
            });
            
            emojiGrid.appendChild(emojiItem);
        });
        
        categoryDiv.appendChild(titleDiv);
        categoryDiv.appendChild(emojiGrid);
        emojiPicker.appendChild(categoryDiv);
    });
}

// Toggle emoji picker
function toggleEmojiPicker() {
    if (emojiPicker.style.display === 'none' || emojiPicker.style.display === '') {
        emojiPicker.style.display = 'block';
    } else {
        emojiPicker.style.display = 'none';
    }
}

// Insert emoji into message input
function insertEmoji(emoji) {
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);
    
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.selectionStart = cursorPos + emoji.length;
    messageInput.selectionEnd = cursorPos + emoji.length;
    messageInput.focus();
}

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
            <span>All Users</span>
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
    chatsHeader.textContent = 'Chats';
    contactsList.appendChild(chatsHeader);
    
    // Сортируем лобби по последнему сообщению
    lobbiesList.sort((a, b) => {
        const timeA = a.last_message ? new Date(a.last_message.timestamp) : new Date(a.created_at);
        const timeB = b.last_message ? new Date(b.last_message.timestamp) : new Date(b.created_at);
        return timeB - timeA;
    });
    
    // Добавляем все чаты без разделения на групповые и личные
    lobbiesList.forEach(lobby => {
        renderContactItem(lobby);
    });
    
    // Добавляем кнопку создания группового чата только для администраторов
    if (currentUser && currentUser.is_admin) {
        const createGroupBtn = document.createElement('div');
        createGroupBtn.className = 'create-group-chat-btn';
        createGroupBtn.innerHTML = `
            <i class="fas fa-users"></i>
            <span>Create Group Chat</span>
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
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
            
            // Отображаем статус пользователя
            const isOnline = otherUser.is_online || false;
            chatStatusIndicator.className = `status-indicator ${isOnline ? 'status-online' : 'status-offline'}`;
            chatStatus.textContent = isOnline ? 'Online' : 'Offline';
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
        } else if (message.message_type === 'image') {
            messageBubble.innerHTML = `
                <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
                <div class="message-attachment">
                    <div class="image-container">
                        <img src="" alt="Image" class="attachment-image">
                    </div>
                </div>
            `;
            
            // Добавляем обработчик для открытия изображения
            setTimeout(() => {
                const img = messageBubble.querySelector('.attachment-image');
                if (img) {
                    // Пробуем загрузить изображение с разных путей
                    tryLoadImage(img, message.file_path);
                    
                    img.addEventListener('click', () => {
                        openImageModal(img.src);
                    });
                }
            }, 0);
        } else if (message.message_type === 'file' || message.message_type === 'FILE') {
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
                
                // Add click handler for image modal
                img.addEventListener('click', () => {
                    if (img.src) {
                        openImageModal(img.src);
                    }
                });
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
    
    // Scroll to bottom
    scrollToBottom();
    
    // Hide typing indicator
    hideTypingIndicator();
    
    // After displaying message, update counters
    if (message.sender_id !== currentUser.id) {
        socket.emit('read_messages', { lobby_id: currentLobbyId });
    }
}


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
    // Get selected lobby
    const lobby = lobbiesList.find(l => l.id === currentLobbyId);
    
    if (!lobby) return;
    
    if (lobby.is_group) {
        // Show group profile
        profileName.textContent = lobby.name;
        profileTitle.textContent = `${lobby.users.length} members`;
        profileStatusBadge.className = 'profile-status-badge';
        profileStatusBadge.textContent = 'Group';
        
        profileAbout.textContent = lobby.description || 'No description';
        
        profileEmail.parentElement.style.display = 'none';
        profileUsername.parentElement.style.display = 'none';
        
        if (lobby.avatar) {
            profileAvatar.src = lobby.avatar;
        } else {
            profileAvatar.src = 'https://via.placeholder.com/100?text=' + encodeURIComponent(getInitials(lobby.name));
        }
    } else {
        // Show user profile
        const otherUser = lobby.users.find(user => user.id !== currentUser.id);
        
        if (otherUser) {
            profileName.textContent = otherUser.username;
            profileTitle.textContent = 'User';
            
            // Set status badge
            const isOnline = otherUser.is_online || false;
            profileStatusBadge.className = `profile-status-badge ${isOnline ? 'profile-status-online' : 'profile-status-offline'}`;
            profileStatusBadge.textContent = isOnline ? 'Online' : 'Offline';
            
            profileAbout.textContent = 'No information available';
            
            profileEmail.parentElement.style.display = 'flex';
            profileUsername.parentElement.style.display = 'flex';
            
            profileEmail.textContent = otherUser.email;
            profileUsername.textContent = otherUser.username;
            
            if (otherUser.avatar) {
                profileAvatar.src = otherUser.avatar;
            } else {
                profileAvatar.src = 'https://via.placeholder.com/100?text=' + encodeURIComponent(getInitials(otherUser.username));
            }
        }
    }
    
    // Load shared files
    loadSharedFiles();
    
    // Show the panel
    profilePanel.style.display = 'flex';
}

// Load shared files between users
function loadSharedFiles() {
    if (!currentLobbyId) return;
    
    // Fetch files for this lobby
    fetch(`/chat/lobby/${currentLobbyId}/messages`)
        .then(response => response.json())
        .then(messages => {
            // Filter messages with files
            const fileMessages = messages.filter(message => 
                message.message_type === 'file' || 
                message.message_type === 'image' || 
                message.message_type === 'audio' || 
                message.message_type === 'video'
            );
            
            // Display files
            sharedFiles.innerHTML = '';
            
            if (fileMessages.length === 0) {
                sharedFiles.innerHTML = '<div class="no-shared-files">No shared files</div>';
                return;
            }
            
            fileMessages.forEach(message => {
                const fileItem = document.createElement('div');
                fileItem.className = 'shared-file-item';
                
                // Create item based on file type
                if (message.message_type === 'image') {
                    fileItem.innerHTML = `
                        <div class="shared-file-preview">
                            <img src="${message.file_path}" alt="Image">
                        </div>
                        <div class="shared-file-info">
                            <div class="shared-file-name">${message.file_name}</div>
                            <div class="shared-file-meta">
                                ${formatFileSize(message.file_size)} • ${formatDate(message.timestamp)}
                            </div>
                        </div>
                        <a href="${message.file_path}" download="${message.file_name}" class="shared-file-download">
                            <i class="fas fa-download"></i>
                        </a>
                    `;
                } else {
                    // Determine icon based on file type
                    let fileIcon = 'fa-file';
                    if (message.message_type === 'audio') fileIcon = 'fa-file-audio';
                    else if (message.message_type === 'video') fileIcon = 'fa-file-video';
                    else if (message.file_type === 'application/pdf') fileIcon = 'fa-file-pdf';
                    else if (message.file_type.includes('word')) fileIcon = 'fa-file-word';
                    else if (message.file_type.includes('excel') || message.file_type.includes('spreadsheet')) fileIcon = 'fa-file-excel';
                    
                    fileItem.innerHTML = `
                        <div class="shared-file-icon">
                            <i class="fas ${fileIcon}"></i>
                        </div>
                        <div class="shared-file-info">
                            <div class="shared-file-name">${message.file_name}</div>
                            <div class="shared-file-meta">
                                ${formatFileSize(message.file_size)} • ${formatDate(message.timestamp)}
                            </div>
                        </div>
                        <a href="${message.file_path}" download="${message.file_name}" class="shared-file-download">
                            <i class="fas fa-download"></i>
                        </a>
                    `;
                }
                
                sharedFiles.appendChild(fileItem);
            });
        })
        .catch(error => {
            console.error('Error loading shared files:', error);
            sharedFiles.innerHTML = '<div class="no-shared-files">Error loading files</div>';
        });
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
    // Настройка модального окна для изображений
    setupImageModal();
});