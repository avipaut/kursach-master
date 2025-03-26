// chat.js
// Добавьте этот код в начало вашего chat.js файла

// Определяем, является ли устройство iOS
// Определяем устройства iOS

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
        
        // Fetch chat messages for the selected chat (replace with your actual data fetching)
        // fetchChatMessages(chatId);
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

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', initChatInterface);
// Connect to Socket.IO
const socket = io();
let currentLobbyId = null;
let currentUser = null;
let usersList = [];
let lobbiesList = [];
let activeProfile = null;
let pendingAttachments = [];

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
    // Fetch current user info
    fetchCurrentUser();
    
    // Fetch all users for contacts list
    fetchAllUsers();
    
    // Fetch lobbies and render them
    fetchLobbies();
    
    // Set up event listeners
    setupEventListeners();
    
    // Socket.IO event listeners
    setupSocketListeners();
}

// Fetch current user information
function fetchCurrentUser() {
    fetch('/chat/api/user/current')
        .then(response => response.json())
        .then(data => {
            currentUser = data;
            console.log('Current user:', currentUser);
        })
        .catch(error => {
            console.error('Error fetching current user:', error);
        });
}

// Fetch all lobbies for the current user
function fetchLobbies() {
    fetch('/chat/lobbies')
        .then(response => response.json())
        .then(data => {
            lobbiesList = data;
            renderContacts();
        })
        .catch(error => {
            console.error('Error fetching lobbies:', error);
        });
}

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
    createChatBtn.addEventListener('click', showCreateChatModal);
    
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
}

// Set up Socket.IO event listeners
function setupSocketListeners() {
    // New message event
    socket.on('new_message', (message) => {
        if (message.lobby_id === currentLobbyId) {
            appendMessage(message);
            
            // Mark message as read if from someone else
            if (message.sender_id !== currentUser.id) {
                socket.emit('read_messages', { lobby_id: currentLobbyId });
            }
        }
        
        // Update the last message in the contacts list
        updateLobbyLastMessage(message.lobby_id, message);
    });
    
    // Messages read event
    socket.on('messages_read', (data) => {
        if (data.lobby_id === currentLobbyId) {
            // Update read receipts if needed
        }
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
        lobbiesList.push(lobby);
        renderContacts();
    });
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
        selectLobby(data.id);
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
        selectLobby(data.id);
    })
    .catch(error => {
        console.error('Error creating direct chat:', error);
    });
}

// Render all contacts (lobbies)
function renderContacts() {
    // Очищаем список только при первоначальной загрузке
    if (!contactsList.querySelector('.contacts-separator')) {
        contactsList.innerHTML = '';
    } else {
        // Удаляем только разделы с лобби, оставляя список пользователей
        const lobbySeparators = contactsList.querySelectorAll('.contacts-separator:not(:first-child)');
        lobbySeparators.forEach(separator => {
            // Удаляем все элементы до следующего разделителя или до конца
            let next = separator.nextElementSibling;
            while (next && !next.classList.contains('contacts-separator')) {
                const toRemove = next;
                next = next.nextElementSibling;
                contactsList.removeChild(toRemove);
            }
            contactsList.removeChild(separator);
        });
    }
    
    // Group separator
    let hasGroups = false;
    let hasDirects = false;
    
    // Check if we have groups and direct messages
    lobbiesList.forEach(lobby => {
        if (lobby.is_group) {
            hasGroups = true;
        } else {
            hasDirects = true;
        }
    });
    
    // Sort lobbies by last message timestamp
    lobbiesList.sort((a, b) => {
        const timeA = a.last_message ? new Date(a.last_message.timestamp) : new Date(a.created_at);
        const timeB = b.last_message ? new Date(b.last_message.timestamp) : new Date(b.created_at);
        return timeB - timeA;
    });
    
    // Render direct messages
    if (hasDirects) {
        const directsHeader = document.createElement('div');
        directsHeader.className = 'contacts-separator';
        directsHeader.textContent = 'Direct Messages';
        contactsList.appendChild(directsHeader);
        
        lobbiesList.filter(lobby => !lobby.is_group).forEach(lobby => {
            renderContactItem(lobby);
        });
    }
    
    // Render group chats
    if (hasGroups) {
        const groupsHeader = document.createElement('div');
        groupsHeader.className = 'contacts-separator';
        groupsHeader.textContent = 'Group Chats';
        contactsList.appendChild(groupsHeader);
        
        lobbiesList.filter(lobby => lobby.is_group).forEach(lobby => {
            renderContactItem(lobby);
        });
    }
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
                    <span class="status-indicator status-online"></span>
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
    let statusClass;
    
    if (lobby.is_group) {
        contactName = lobby.name;
        avatarUrl = lobby.avatar;
        avatarInitials = getInitials(contactName);
        statusClass = 'status-group';
    } else {
        // For direct messages, show the other user's info
        const otherUser = lobby.users.find(user => user.id !== currentUser.id);
        contactName = otherUser ? otherUser.username : 'Unknown User';
        avatarUrl = otherUser ? otherUser.avatar : null;
        avatarInitials = getInitials(contactName);
        statusClass = 'status-online'; // Assuming online for now
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
            ${lobby.is_group ? 
                `<div class="group-indicator"><i class="fas fa-users"></i></div>` : 
                `<span class="status-indicator ${statusClass}"></span>`
            }
        </div>
        <div class="contact-info">
            <div class="contact-name-row">
                <div class="contact-name">${contactName}</div>
                <div class="contact-time">${lastMessageTime}</div>
            </div>
            <div class="contact-message">${lastMessageText}</div>
        </div>
    `;
    
    contactItem.addEventListener('click', () => {
        selectLobby(lobby.id);
    });
    
    contactsList.appendChild(contactItem);
}

// Select a lobby and load its messages
function selectLobby(lobbyId) {
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
            
            chatStatusIndicator.className = 'status-indicator status-online'; // Assuming online
            chatStatus.textContent = 'Online'; // Placeholder status
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
            
            // Add sender avatar for non-own messages
            if (message.sender_id !== currentUser.id) {
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'message-avatar';
                
                if (message.sender_avatar) {
                    avatarDiv.innerHTML = `<img src="${message.sender_avatar}" alt="${message.sender_name}">`;
                } else {
                    avatarDiv.innerHTML = `<div class="avatar-text">${getInitials(message.sender_name)}</div>`;
                }
                
                currentGroup.appendChild(avatarDiv);
            }
            
            // Add message container
            const messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';
            
            // Add sender name for non-own messages
            if (message.sender_id !== currentUser.id) {
                const senderName = document.createElement('div');
                senderName.className = 'message-sender';
                senderName.textContent = message.sender_name;
                messageContainer.appendChild(senderName);
            }
            
            currentGroup.appendChild(messageContainer);
            chatMessages.appendChild(currentGroup);
        }
        
        // Add the message to the current group
        const messageContainer = currentGroup.querySelector('.message-container');
        
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
                    <img src="${message.file_path}" alt="Image" class="attachment-image">
                </div>
            `;
        } else if (['file', 'audio', 'video'].includes(message.message_type)) {
            // Determine file icon
            let fileIcon = 'fa-file';
            if (message.message_type === 'audio') fileIcon = 'fa-file-audio';
            else if (message.message_type === 'video') fileIcon = 'fa-file-video';
            else if (message.file_type === 'application/pdf') fileIcon = 'fa-file-pdf';
            else if (message.file_type.includes('word')) fileIcon = 'fa-file-word';
            else if (message.file_type.includes('excel') || message.file_type.includes('spreadsheet')) fileIcon = 'fa-file-excel';
            
            messageBubble.innerHTML = `
                <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
                <div class="message-attachment">
                    <div class="attachment-file">
                        <i class="fas ${fileIcon}"></i>
                        <div class="attachment-details">
                            <div class="attachment-name">${message.file_name}</div>
                            <div class="attachment-size">${formatFileSize(message.file_size)}</div>
                        </div>
                        <a href="${message.file_path}" download="${message.file_name}" class="attachment-download">
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                </div>
            `;
        }
        
        // Add timestamp
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTime(message.timestamp);
        
        // Append to container
        messageContainer.appendChild(messageBubble);
        messageContainer.appendChild(messageTime);
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// Append a single message to the chat
function appendMessage(message) {
    // Check if the last message is from the same sender
    const lastGroup = chatMessages.lastElementChild;
    let messageContainer;
    
    if (lastGroup && 
        ((message.sender_id === currentUser.id && lastGroup.classList.contains('own-messages')) || 
         (message.sender_id !== currentUser.id && !lastGroup.classList.contains('own-messages')))) {
        // Use the existing group
        messageContainer = lastGroup.querySelector('.message-container');
    } else {
        // Create a new message group
        const newGroup = document.createElement('div');
        newGroup.className = `message-group ${message.sender_id === currentUser.id ? 'own-messages' : ''}`;
        
        // Add sender avatar for non-own messages
        if (message.sender_id !== currentUser.id) {
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            
            if (message.sender_avatar) {
                avatarDiv.innerHTML = `<img src="${message.sender_avatar}" alt="${message.sender_name}">`;
            } else {
                avatarDiv.innerHTML = `<div class="avatar-text">${getInitials(message.sender_name)}</div>`;
            }
            
            newGroup.appendChild(avatarDiv);
        }
        
        // Add message container
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        
        // Add sender name for non-own messages
        if (message.sender_id !== currentUser.id) {
            const senderName = document.createElement('div');
            senderName.className = 'message-sender';
            senderName.textContent = message.sender_name;
            messageContainer.appendChild(senderName);
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
        messageBubble.innerHTML = `
            <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
            <div class="message-attachment">
                <img src="${message.file_path}" alt="Image" class="attachment-image">
            </div>
        `;
    } else if (['file', 'audio', 'video'].includes(message.message_type)) {
        // Determine file icon
        let fileIcon = 'fa-file';
        if (message.message_type === 'audio') fileIcon = 'fa-file-audio';
        else if (message.message_type === 'video') fileIcon = 'fa-file-video';
        else if (message.file_type === 'application/pdf') fileIcon = 'fa-file-pdf';
        else if (message.file_type.includes('word')) fileIcon = 'fa-file-word';
        else if (message.file_type.includes('excel') || message.file_type.includes('spreadsheet')) fileIcon = 'fa-file-excel';
        
        messageBubble.innerHTML = `
            <div class="message-text">${message.text ? formatMessageText(message.text) : ''}</div>
            <div class="message-attachment">
                <div class="attachment-file">
                    <i class="fas ${fileIcon}"></i>
                    <div class="attachment-details">
                        <div class="attachment-name">${message.file_name}</div>
                        <div class="attachment-size">${formatFileSize(message.file_size)}</div>
                    </div>
                    <a href="${message.file_path}" download="${message.file_name}" class="attachment-download">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            </div>
        `;
    }
    
    // Add timestamp
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = formatTime(message.timestamp);
    
    // Append to container
    messageContainer.appendChild(messageBubble);
    messageContainer.appendChild(messageTime);
    
    // Scroll to bottom
    scrollToBottom();
    
    // Hide typing indicator
    hideTypingIndicator();
}

// Update the last message of a lobby in the contacts list
function updateLobbyLastMessage(lobbyId, message) {
    // Find the lobby in the list
    const lobbyIndex = lobbiesList.findIndex(lobby => lobby.id === lobbyId);
    
    if (lobbyIndex !== -1) {
        // Update the last message
        lobbiesList[lobbyIndex].last_message = message;
        
        // Re-render contacts to update UI
        renderContacts();
    }
}

// Send a message
function sendMessage() {
    if (!currentLobbyId) return;
    
    const messageText = messageInput.value.trim();
    
    // Check if we have text content or attachments
    if (messageText === '' && pendingAttachments.length === 0) return;
    
    // Clear input field
    messageInput.value = '';
    
    // Handle file attachments if any
    if (pendingAttachments.length > 0) {
        sendFileMessage(messageText);
    } else {
        // Send text message via Socket.IO
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
}

// Send a message with file attachment
function sendFileMessage(messageText) {
    const formData = new FormData();
    formData.append('message', messageText);
    formData.append('lobby_id', currentLobbyId);
    
    // Append the first file (currently supporting one file at a time)
    formData.append('file', pendingAttachments[0].file);
    
    // Send the request
    fetch('/chat/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Clear attachment preview
            clearAttachmentPreview();
        } else {
            console.error('Error uploading file:', data.error);
        }
    })
    .catch(error => {
        console.error('Error sending file message:', error);
    });
}

// Handle file selection
function handleFileSelection(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
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
    if (profilePanel.style.display === 'none') {
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
            profileStatusBadge.className = 'profile-status-badge profile-status-online';
            profileStatusBadge.textContent = 'Online';
            
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

// Fetch all users for contacts list
function fetchAllUsers() {
    fetch('/chat/api/all_users')
        .then(response => response.json())
        .then(data => {
            usersList = data;
            renderAllUsers();
        })
        .catch(error => {
            console.error('Error fetching all users:', error);
        });
}

// Render all users in contacts list
function renderAllUsers() {
    if (!contactsList) return;
    
    // Create users header
    const usersHeader = document.createElement('div');
    usersHeader.className = 'contacts-separator';
    usersHeader.textContent = 'All Users';
    contactsList.appendChild(usersHeader);
    
    // Render each user
    usersList.forEach(user => {
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
                <span class="status-indicator status-online"></span>
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
// Add this to your existing chat.js file

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
    
    // Safari-specific fix for search bar
    function setupSafariSearchBarFix() {
        // This function was referenced but not defined in original code
        // Adding empty implementation to prevent errors
        adjustHeight();
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
        
        // Logic for selecting contact
        // ... your existing contact selection logic here
        
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
        setupSafariSearchBarFix();
    });
    
    // Handle profile panel toggle
    viewProfileBtn.addEventListener('click', function() {
        profilePanel.style.display = 'block';
        setTimeout(() => {
            profilePanel.classList.add('active');
        }, 10);
    });
    
    closeProfile.addEventListener('click', function() {
        profilePanel.classList.remove('active');
        setTimeout(() => {
            profilePanel.style.display = 'none';
        }, 300);
    });
    
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
// Функция для решения проблемы с поисковой строкой на iOS
function setupSafariSearchBarFix() {
    // Проверяем, является ли устройство iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
      // Добавляем класс для идентификации iOS устройств
      document.documentElement.classList.add('ios-device');
      
      // Устанавливаем высоту документа
      function setDocumentHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      }
      
      // Вызываем функцию сразу и при изменении размера окна
      setDocumentHeight();
      window.addEventListener('resize', setDocumentHeight);
      
      // Добавляем обработчик для полей ввода
      const inputFields = document.querySelectorAll('input, textarea');
      inputFields.forEach(input => {
        input.addEventListener('focus', function() {
          // Прокручиваем страницу после небольшой задержки
          setTimeout(() => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const inputTop = this.getBoundingClientRect().top + scrollTop;
            window.scrollTo(0, inputTop - 100);
          }, 300);
        });
      });
    }
  }
  function adjustLayoutForSafari() {
    // Обновляем высоту контента при изменении размера окна
    function updateHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      // Перерасчет высоты контейнера контента
      const contentWrapper = document.querySelector('.content-wrapper');
      if (contentWrapper) {
        contentWrapper.style.height = `calc(${vh * 100}px - env(safe-area-inset-bottom, 50px) - 60px)`;
      }
    }
    
    // Вызываем сразу и при изменении размера окна
    updateHeight();
    window.addEventListener('resize', updateHeight);
  }
  
  // Добавьте вызов функции в документ
  document.addEventListener('DOMContentLoaded', adjustLayoutForSafari);
