// Global variables
let boards = [];
let activeBoard = null;
let lists = [];
let users = [];
let apiBaseUrl = '';
let useFullColorPriority = true;
let isAdmin = false;
let currentUserName = '';
let isDraggingList = false;
let draggedList = null;
let currentOpenMenu = null;

// DOM elements for modal windows
const createBoardModal = document.getElementById('createBoardModal');
const editBoardModal = document.getElementById('editBoardModal');
const createListModal = document.getElementById('createListModal');
const editListModal = document.getElementById('editListModal');
const createCardModal = document.getElementById('createCardModal');
const editCardModal = document.getElementById('editCardModal');

document.addEventListener('DOMContentLoaded', function() {
    // Проверяем URL-параметры при загрузке страницы
    const urlParams = new URLSearchParams(window.location.search);
    const highlightCardId = urlParams.get('highlight_card') || localStorage.getItem('highlightCardId');
    const boardIdFromUrl = urlParams.get('board_id');
    
    if (highlightCardId) {
        // Удаляем ID из localStorage после использования
        localStorage.removeItem('highlightCardId');
        
        // Функция для подсветки карточки
        function highlightCard() {
            const cardElement = document.querySelector(`.card[data-card-id="${highlightCardId}"]`);
            
            if (cardElement) {
                // Добавляем класс для подсветки
                cardElement.classList.add('highlighted-card');
                
                // Скроллим к карточке
                scrollToCard(cardElement);
                
                // Добавляем слушатель события для удаления подсветки при клике или касании
                cardElement.addEventListener('click', removeHighlight);
                document.addEventListener('click', checkRemoveHighlight);
                
                // Также удаляем подсветку через некоторое время
                setTimeout(removeHighlight, 10000); // 10 секунд
                
                // Запускаем IntersectionObserver, чтобы узнать, когда карточка видна
                setupVisibilityObserver(cardElement);
            } else {
                // Если карточка не найдена, пробуем снова через некоторое время
                // (Это может произойти, если DOM еще не полностью отрендерен)
                setTimeout(highlightCard, 500);
            }
        }
        
        // Плавный скролл к карточке
        function scrollToCard(element) {
            // Проверяем видимость элемента
            const rect = element.getBoundingClientRect();
            const isVisible = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            
            // Если не виден, скроллим к нему
            if (!isVisible) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
        
        // Удаление подсветки
        function removeHighlight() {
            const highlightedCard = document.querySelector('.highlighted-card');
            if (highlightedCard) {
                highlightedCard.classList.remove('highlighted-card');
                document.removeEventListener('click', checkRemoveHighlight);
            }
        }
        
        // Проверка для удаления подсветки при клике не на карточку
        function checkRemoveHighlight(event) {
            const highlightedCard = document.querySelector('.highlighted-card');
            if (highlightedCard && !highlightedCard.contains(event.target)) {
                removeHighlight();
            }
        }
        
        // Настройка наблюдателя за видимостью
        function setupVisibilityObserver(element) {
            // Создаем новый IntersectionObserver
            const observer = new IntersectionObserver(
                (entries) => {
                    // Если карточка видна в области просмотра
                    if (entries[0].isIntersecting) {
                        // Подождем немного, затем уберем подсветку
                        setTimeout(removeHighlight, 3000);
                        observer.disconnect();
                    }
                },
                { threshold: 0.5 } // Карточка считается видимой, когда как минимум 50% видно
            );
            
            // Начинаем наблюдать за элементом
            observer.observe(element);
        }
        
        // Вызываем функцию подсветки
        highlightCard();
    }
    
    // Добавляем стили для подсветки
    addHighlightStyles();
    
    // Set the base URL for API
    apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
    console.log('API base URL set to:', apiBaseUrl);

    // Load initial data
    fetchAllUsers();
    loadBoards();
    fetchCurrentUser();
    addAdminStyles();
    addDragAndDropStyles();

    // Event handlers for creating boards
    document.getElementById('createBoardBtn').addEventListener('click', () => openModal(createBoardModal));
    document.getElementById('createBoardForm').addEventListener('submit', handleCreateBoardWithUsers);

    // Event handlers for editing boards
    document.getElementById('editBoardBtn').addEventListener('click', () => openEditBoardModal());
    document.getElementById('editBoardForm').addEventListener('submit', handleEditBoardWithUsers);
    document.getElementById('deleteBoardBtn').addEventListener('click', () => handleDeleteBoard());

    // Event handlers for creating lists
    document.getElementById('addListBtn')?.addEventListener('click', () => openModal(createListModal));
    document.getElementById('createListForm').addEventListener('submit', handleCreateList);

    // Event handlers for creating cards
    document.getElementById('createCardForm').addEventListener('submit', handleCreateCard);

    // Event handlers for editing cards
    document.getElementById('editCardForm').addEventListener('submit', handleUpdateCard);

    // Event handlers for closing modal windows
    document.querySelectorAll('.close-modal, .btn-cancel').forEach(element => {
        element.addEventListener('click', () => closeAllModals());
    });

    // Handler for adding tasks in the card creation form
    document.getElementById('addTodoBtn').addEventListener('click', () => addTodoItem('todoItems'));
    document.getElementById('editAddTodoBtn').addEventListener('click', () => addTodoItem('editTodoItems'));

    // Toggle sidebar collapse
    document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);
    
    setupListsContainer();
});

// Функция для добавления стилей подсветки
function addHighlightStyles() {
    const style = document.createElement('style');
    style.id = 'highlight-card-styles';
    style.textContent = `
        @keyframes pulse-animation-high {
            0% {
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                transform: scale(1.03);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
                transform: scale(1);
            }
        }
        
        @keyframes pulse-animation-medium {
            0% {
                box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
                transform: scale(1.03);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
                transform: scale(1);
            }
        }
        
        @keyframes pulse-animation-low {
            0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
                transform: scale(1.03);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                transform: scale(1);
            }
        }
        
        /* Высокий приоритет - красный */
        .card[data-priority="high"].highlighted-card {
            animation: pulse-animation-high 1.5s infinite;
            border: 2px solid #ef4444 !important;
            background-color: rgba(239, 68, 68, 0.1) !important;
            position: relative;
            z-index: 10;
        }
        
        .card[data-priority="high"].highlighted-card::after {
            content: "";
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background-color: #ef4444;
            border-radius: 50%;
            animation: pulse-animation-high 1.5s infinite;
        }
        
        /* Средний приоритет - желтый/оранжевый */
        .card[data-priority="medium"].highlighted-card {
            animation: pulse-animation-medium 1.5s infinite;
            border: 2px solid #f59e0b !important;
            background-color: rgba(245, 158, 11, 0.1) !important;
            position: relative;
            z-index: 10;
        }
        
        .card[data-priority="medium"].highlighted-card::after {
            content: "";
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background-color: #f59e0b;
            border-radius: 50%;
            animation: pulse-animation-medium 1.5s infinite;
        }
        
        /* Низкий приоритет - зеленый */
        .card[data-priority="low"].highlighted-card {
            animation: pulse-animation-low 1.5s infinite;
            border: 2px solid #10b981 !important;
            background-color: rgba(16, 185, 129, 0.1) !important;
            position: relative;
            z-index: 10;
        }
        
        .card[data-priority="low"].highlighted-card::after {
            content: "";
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background-color: #10b981;
            border-radius: 50%;
            animation: pulse-animation-low 1.5s infinite;
        }
    `;
    document.head.appendChild(style);
}
// Fetch current user details
async function fetchCurrentUser() {
    try {
        const response = await fetch(`${apiBaseUrl}/kanban/api/current_user`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user info. Status: ${response.status}`);
        }
        
        const userData = await response.json();
        currentUserName = userData.username;
        isAdmin = userData.is_admin;
        
        console.log('Current user:', currentUserName, 'Admin status:', isAdmin);
        
        // Update UI based on permissions
        updateUIBasedOnPermissions();
    } catch (error) {
        console.error('Error fetching current user:', error);
    }
}

// Update UI elements based on user permissions
function updateUIBasedOnPermissions() {
    // Hide create/edit/delete buttons for non-admins
    if (!isAdmin) {
        // Hide board management buttons
        document.getElementById('createBoardBtn')?.classList.add('hidden');
        document.querySelectorAll('.btn-edit-board, .btn-delete-board').forEach(btn => {
            btn.classList.add('hidden');
        });
        
        // Hide list management buttons
        document.querySelectorAll('.btn-add-list').forEach(btn => {
            btn.classList.add('hidden');
        });
        
        // We'll keep the toggle completion button visible for non-admins
        // but hide other card management buttons
        document.querySelectorAll('.btn-add-card').forEach(btn => {
            btn.classList.add('hidden');
        });
    }
}

// Data loading functions
// В файле kanban.js, модифицируйте функцию loadBoards, добавив следующий код в начало функции:

async function loadBoards() {
    showLoading('boardsLoading');
    try {
        console.log('Fetching boards from:', `${apiBaseUrl}/boards`);
        const response = await fetch(`${apiBaseUrl}/boards`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch boards. Status: ${response.status}`);
        }
        
        boards = await response.json();
        console.log('Boards loaded successfully:', boards);
        
        if (boards.length === 0) {
            console.log('No boards returned from API');
            hideLoading('boardsLoading');
            return;
        }
        
        renderBoards();
        hideLoading('boardsLoading');

        // Проверяем URL-параметры при загрузке
        const urlParams = new URLSearchParams(window.location.search);
        const boardIdFromUrl = urlParams.get('board_id');
        const highlightCardId = urlParams.get('highlight_card') || localStorage.getItem('highlightCardId');
        
        if (boardIdFromUrl) {
            console.log(`Trying to select board from URL, ID: ${boardIdFromUrl}`);
            const boardToSelect = boards.find(board => board.id === parseInt(boardIdFromUrl));
            if (boardToSelect) {
                console.log(`Found board in list: ${boardToSelect.name}`);
                selectBoard(boardToSelect);
                return;
            } else {
                console.log(`Board ID ${boardIdFromUrl} not found in loaded boards`);
            }
        }
        
        // Если есть ID карточки, но нет ID доски
        if (highlightCardId && !boardIdFromUrl) {
            console.log(`Searching for card ${highlightCardId} across all boards`);
            await searchCardAcrossAllBoards(parseInt(highlightCardId));
            return;
        }

        // Если доска не найдена в URL или нет board_id, выбираем первую доску
        if (boards.length > 0) {
            console.log('Selecting first board by default');
            selectBoard(boards[0]);
        }
    } catch (error) {
        console.error('Error loading boards:', error);
        showToast('Error', 'Failed to load boards. Please try again.', 'error');
        hideLoading('boardsLoading');
    }
}// В файле kanban.js заменить функцию searchCardAcrossAllBoards на эту:

// Функция для поиска карточки среди всех досок
async function searchCardAcrossAllBoards(cardId) {
    console.log(`Поиск карточки ${cardId} по всем доскам`);
    
    // Сохраняем ID карточки в localStorage, чтобы он не потерялся при переключении досок
    localStorage.setItem('highlightCardId', cardId);
    
    let foundCard = false;
    let containingBoard = null;
    
    // Проверяем каждую доску
    for (const board of boards) {
        console.log(`Проверяем доску: ${board.name} (ID: ${board.id})`);
        
        // Временно выбираем доску без обновления UI
        activeBoard = board;
        
        try {
            // Загружаем списки для доски
            const response = await fetch(`${apiBaseUrl}/boards/${board.id}/lists`);
            if (!response.ok) continue;
            
            let boardLists = await response.json();
            
            // Загружаем карточки для каждого списка
            for (const list of boardLists) {
                const cardsResponse = await fetch(`${apiBaseUrl}/boards/${board.id}/lists/${list.id}/cards`);
                if (!cardsResponse.ok) continue;
                
                const cards = await cardsResponse.json();
                list.cards = cards;
                
                // Проверяем, есть ли искомая карточка в этом списке
                const card = cards.find(c => c.id === cardId);
                if (card) {
                    console.log(`Карточка ${cardId} найдена в списке ${list.name} на доске ${board.name}`);
                    foundCard = true;
                    containingBoard = board;
                    break;
                }
            }
            
            // Если карточка найдена, прерываем поиск
            if (foundCard) break;
            
        } catch (error) {
            console.error(`Ошибка при поиске карточки на доске ${board.name}:`, error);
        }
    }
    
    if (foundCard && containingBoard) {
        console.log(`Переключаемся на доску ${containingBoard.name}, где находится карточка ${cardId}`);
        // Теперь правильно выбираем доску с обновлением UI
        selectBoard(containingBoard);
        return true;
    } else {
        console.log(`Карточка ${cardId} не найдена ни на одной доске`);
        // Выбираем первую доску
        if (boards.length > 0) {
            selectBoard(boards[0]);
        }
        return false;
    }
}
// Заменяем часть, которая находится примерно на строке 376
// После загрузки всех карточек проверяем, нужно ли подсветить карточку
const highlightCardId = localStorage.getItem('highlightCardId');
if (highlightCardId) {
    setTimeout(() => {
        const cardElement = document.querySelector(`.card[data-card-id="${highlightCardId}"]`);
        if (cardElement) {
            console.log(`Найдена карточка для подсветки: ${highlightCardId}`);
            localStorage.removeItem('highlightCardId');
            
            // Подсвечиваем найденную карточку в зависимости от приоритета
            // Приоритет уже должен быть указан в атрибуте data-priority
            cardElement.classList.add('highlighted-card');
            
            // Скроллим к карточке
            cardElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            
            // Удаляем подсветку через некоторое время
            setTimeout(() => {
                cardElement.classList.remove('highlighted-card');
            }, 10000);
        }
    }, 500);
}
// Обновляем функцию loadCards чтобы сортировать карточки по position
async function loadCards(boardId, listId) {
    try {
        console.log(`Fetching cards for list ${listId} in board ${boardId}`);
        const response = await fetch(`${apiBaseUrl}/boards/${boardId}/lists/${listId}/cards`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch cards. Status: ${response.status}`);
        }
        
        const cards = await response.json();
        console.log(`Cards for list ${listId} loaded successfully:`, cards);
        
        // Если у карточек есть поле position, сортируем их
        if (cards.length > 0 && 'position' in cards[0]) {
            cards.sort((a, b) => a.position - b.position);
        }
        
        // Update lists with their cards
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1) {
            lists[listIndex].cards = cards;
        }
        
        return cards;
    } catch (error) {
        console.error(`Error loading cards for list ${listId}:`, error);
        return [];
    }
}

// This function now has a default parameter or finds the elements
function populateUserSelect(selectElement = null) {
    // If no element is provided, try to find all user select dropdowns
    if (!selectElement) {
        // Get all user select dropdowns
        const userSelects = document.querySelectorAll('.user-select');
        
        // If no select elements found, just return without error
        if (userSelects.length === 0) {
            console.log('No user select elements found in the DOM');
            return;
        }
        
        // Populate each user select dropdown found
        userSelects.forEach(select => {
            populateUserSelect(select);
        });
        return;
    }
    
    // Clear user list, keeping only first option "Not assigned"
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Add users to dropdown
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username || user.name || `User ${user.id}`;
        selectElement.appendChild(option);
    });
}

async function fetchAllUsers() {
    try {
        console.log('Fetching users from:', `${apiBaseUrl}/users`);
        const response = await fetch(`${apiBaseUrl}/users`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users. Status: ${response.status}`);
        }
        
        users = await response.json();
        console.log('Users loaded successfully:', users);
        
        // Now the function handles the case when no element is passed
        populateUserSelect();
    } catch (error) {
        console.error('Error fetching users:', error);
        showToast('Error', 'Failed to load users. Please try again.', 'error');
    }
}

// Alternative approach: Only populate select elements when needed
function populateUserSelectWhenNeeded(selectElement) {
    // Make sure users are loaded first
    if (!users || users.length === 0) {
        console.log('Users not loaded yet, fetching them first');
        fetchAllUsers().then(() => {
            populateUserSelect(selectElement);
        });
        return;
    }
    
    // Clear user list, keeping only first option "Not assigned"
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Add users to dropdown
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username || user.name || `User ${user.id}`;
        selectElement.appendChild(option);
    });
}

// 1. Update the handleCreateBoard and handleEditBoard functions to work with users
// Override handleCreateBoard to support adding users
async function handleCreateBoardWithUsers(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('boardName');
    const name = nameInput.value.trim();
    
    // Get admin-only checkbox value if it exists
    const adminOnlyInput = document.getElementById('boardAdminOnly');
    const adminOnly = adminOnlyInput ? adminOnlyInput.checked : false;
    
    // Get selected users (if using multi-select)
    const userIds = getSelectedUsers();
    
    if (!name) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name,
                admin_only: adminOnly,
                user_ids: userIds
            }),
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                showToast('Error', 'You need administrator privileges to create boards', 'error');
                return;
            }
            throw new Error(`Failed to create board. Status: ${response.status}`);
        }
        
        const newBoard = await response.json();
        boards.push(newBoard);
        renderBoards();
        selectBoard(newBoard);
        closeAllModals();
        nameInput.value = '';
        
        showToast('Success', 'Board created successfully', 'success');
    } catch (error) {
        console.error('Error creating board:', error);
        showToast('Error', 'Failed to create board. Please try again.', 'error');
    }
}

// Get selected users from multi-select (if using it)
function getSelectedUsers() {
    const userSelect = document.getElementById('boardUsers');
    if (!userSelect) return [];
    
    return Array.from(userSelect.selectedOptions).map(option => parseInt(option.value));
}

// Get selected users for edit form
function getSelectedUsersForEdit() {
    const userSelect = document.getElementById('editBoardUsers');
    if (!userSelect) return [];
    
    return Array.from(userSelect.selectedOptions).map(option => parseInt(option.value));
}

// Override handleEditBoard to support updating users
async function handleEditBoardWithUsers(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const nameInput = document.getElementById('editBoardName');
    const name = nameInput.value.trim();
    
    // Get admin-only checkbox value if it exists
    const adminOnlyInput = document.getElementById('editBoardAdminOnly');
    const adminOnly = adminOnlyInput ? adminOnlyInput.checked : false;
    
    // Get selected users (if using multi-select)
    const userIds = getSelectedUsersForEdit();
    
    if (!name) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name,
                admin_only: adminOnly,
                user_ids: userIds
            }),
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                showToast('Error', 'You need administrator privileges to edit boards', 'error');
                return;
            }
            throw new Error(`Failed to update board. Status: ${response.status}`);
        }
        
        const updatedBoard = await response.json();
        
        // Update name and admin_only status of active board
        activeBoard.name = name;
        activeBoard.admin_only = adminOnly;
        activeBoard.users = updatedBoard.users || [];
        
        // Update board list
        const boardIndex = boards.findIndex(board => board.id === activeBoard.id);
        if (boardIndex !== -1) {
            boards[boardIndex].name = name;
            boards[boardIndex].admin_only = adminOnly;
            boards[boardIndex].users = updatedBoard.users || [];
        }
        
        renderBoards();
        document.getElementById('activeBoardTitle').textContent = name;
        closeAllModals();
        
        showToast('Success', 'Board updated successfully', 'success');
    } catch (error) {
        console.error('Error updating board:', error);
        showToast('Error', 'Failed to update board. Please try again.', 'error');
    }
}

// Add users to create board modal
function addUsersToCreateBoardModal() {
    const modal = document.getElementById('createBoardModal');
    const formActions = modal.querySelector('.form-actions');
    
    // Check if we've already added users section
    if (!document.getElementById('boardUsers')) {
        const usersSection = document.createElement('div');
        usersSection.className = 'form-group mt-3';
        usersSection.innerHTML = `
            <label for="boardUsers">Add Users</label>
            <select id="boardUsers" multiple class="form-select">
                ${users.map(user => `<option value="${user.id}">${user.username || user.name}</option>`).join('')}
            </select>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        // Add it before the form actions
        formActions.parentNode.insertBefore(usersSection, formActions);
    }
}

// Add users to edit board modal
function addUsersToEditBoardModal() {
    const modal = document.getElementById('editBoardModal');
    const formActions = modal.querySelector('.form-actions');
    
    // Check if we've already added users section
    if (!document.getElementById('editBoardUsers')) {
        const usersSection = document.createElement('div');
        usersSection.className = 'form-group mt-3';
        usersSection.innerHTML = `
            <label for="editBoardUsers">Board Users</label>
            <select id="editBoardUsers" multiple class="form-select">
                ${users.map(user => `<option value="${user.id}">${user.username || user.name}</option>`).join('')}
            </select>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        // Add it before the form actions
        formActions.parentNode.insertBefore(usersSection, formActions);
    }
    
    // Set selected users
    if (activeBoard && activeBoard.users) {
        const selectElement = document.getElementById('editBoardUsers');
        const activeUserIds = activeBoard.users.map(user => user.id);
        
        Array.from(selectElement.options).forEach(option => {
            option.selected = activeUserIds.includes(parseInt(option.value));
        });
    }
}

// Modify the create board modal to include admin-only option
function openCreateBoardModal() {
    const modal = document.getElementById('createBoardModal');
    
    // Check if we've already added the admin-only checkbox
    if (isAdmin && !document.getElementById('boardAdminOnly')) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group checkbox-group mt-3';
        formGroup.innerHTML = `
            <input type="checkbox" id="boardAdminOnly" class="form-check-input">
            <label for="boardAdminOnly">Admin-only board</label>
        `;
        
        // Add it before the form actions
        const formActions = modal.querySelector('.form-actions');
        formActions.parentNode.insertBefore(formGroup, formActions);
    }
    addUsersToCreateBoardModal();

    openModal(modal);
}

// Modify board editing to include admin-only option
function openEditBoardModal() {
    if (!activeBoard) return;
    
    document.getElementById('editBoardName').value = activeBoard.name;
    
    // Check if we've already added the admin-only checkbox
    if (isAdmin && !document.getElementById('editBoardAdminOnly')) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group checkbox-group mt-3';
        formGroup.innerHTML = `
            <input type="checkbox" id="editBoardAdminOnly" class="form-check-input">
            <label for="editBoardAdminOnly">Admin-only board</label>
        `;
        
        // Add it before the form actions
        const modal = document.getElementById('editBoardModal');
        const formActions = modal.querySelector('.form-actions');
        formActions.parentNode.insertBefore(formGroup, formActions);
    }
    
    // Set the admin-only checkbox value if it exists
    const adminOnlyInput = document.getElementById('editBoardAdminOnly');
    if (adminOnlyInput) {
        adminOnlyInput.checked = activeBoard.admin_only || false;
    }
    addUsersToEditBoardModal();

    openModal(document.getElementById('editBoardModal'));
}

// Override rendering to show admin-only indicators
function renderBoards() {
    const boardsList = document.getElementById('boardsList');
    
    // Remove all board elements except loading spinner
    const loadingSpinner = document.getElementById('boardsLoading');
    const boardItems = boardsList.querySelectorAll('.board-item');
    boardItems.forEach(item => item.remove());
    
    // Check if there are boards
    if (boards.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'You don\'t have any boards yet. Create a new board.';
        boardsList.appendChild(emptyMessage);
        return;
    }
    
    // Sort boards by name
    const sortedBoards = [...boards].sort((a, b) => a.name.localeCompare(b.name));
    
    // Create elements for each board
    sortedBoards.forEach(board => {
        const boardItem = document.createElement('div');
        boardItem.className = `board-item ${activeBoard && activeBoard.id === board.id ? 'active' : ''}`;
        if (board.admin_only) {
            boardItem.classList.add('admin-only');
        }
        boardItem.dataset.boardId = board.id;
        
        boardItem.innerHTML = `
            <div class="board-name">
                <span>${board.name}</span>
                ${board.admin_only ? '<span class="admin-badge"><i class="fas fa-lock"></i></span>' : ''}
            </div>
            <div class="board-actions">
                ${isAdmin ? `
                    <button class="btn-edit-board" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete-board" title="Delete"><i class="fas fa-trash"></i></button>
                ` : ''}
            </div>
        `;
        
        // Add event handlers
        boardItem.addEventListener('click', (e) => {
            if (!e.target.closest('.board-actions')) {
                selectBoard(board);
            }
        });
        
        if (isAdmin) {
            boardItem.querySelector('.btn-edit-board')?.addEventListener('click', () => {
                selectBoard(board);
                openEditBoardModal();
            });
            
            boardItem.querySelector('.btn-delete-board')?.addEventListener('click', () => {
                selectBoard(board);
                handleDeleteBoard();
            });
        }
        
        boardsList.appendChild(boardItem);
    });
}

async function handleDeleteBoard() {
    if (!activeBoard) return;
    
    if (!confirm('Are you sure you want to delete this board?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`Failed to delete board. Status: ${response.status}`);
        }
        
        // Remove board from array
        boards = boards.filter(board => board.id !== activeBoard.id);
        
        // Reset active board
        activeBoard = null;
        document.getElementById('activeBoardTitle').textContent = 'Kanban Board';
        document.getElementById('boardActions').style.display = 'none';
        document.getElementById('selectBoardMessage').style.display = 'flex';
        document.getElementById('listsContainer').style.display = 'none';
        
        renderBoards();
        
        // If there are other boards, select the first one
        if (boards.length > 0) {
            selectBoard(boards[0]);
        }
        
        showToast('Success', 'Board deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting board:', error);
        showToast('Error', 'Failed to delete board. Please try again.', 'error');
    }
}

// List management functions
async function handleCreateList(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const nameInput = document.getElementById('listName');
    const name = nameInput.value.trim();
    
    if (!name) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create list. Status: ${response.status}`);
        }
        
        const newList = await response.json();
        newList.cards = []; // Initialize empty array of cards for new list
        lists.push(newList);
        renderLists();
        closeAllModals();
        nameInput.value = '';
        
        showToast('Success', 'List created successfully', 'success');
    } catch (error) {
        console.error('Error creating list:', error);
        showToast('Error', 'Failed to create list. Please try again.', 'error');
    }
}

function openEditListModal(listId) {
    const list = lists.find(list => list.id === listId);
    if (!list) return;
    
    // Save list ID in the form
    document.getElementById('editListForm').dataset.listId = listId;
    document.getElementById('editListName').value = list.name;
    openModal(editListModal);
}

async function handleEditList(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const listId = parseInt(event.target.dataset.listId);
    const nameInput = document.getElementById('editListName');
    const name = nameInput.value.trim();
    
    if (!name || !listId) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update list. Status: ${response.status}`);
        }
        
        await response.json();
        
        // Update list name
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1) {
            lists[listIndex].name = name;
        }
        
        renderLists();
        closeAllModals();
        
        showToast('Success', 'List updated successfully', 'success');
    } catch (error) {
        console.error('Error updating list:', error);
        showToast('Error', 'Failed to update list. Please try again.', 'error');
    }
}

async function handleDeleteList(listId) {
    if (!activeBoard) return;
    
    if (!confirm('Are you sure you want to delete this list?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`Failed to delete list. Status: ${response.status}`);
        }
        
        // Remove list from array
        lists = lists.filter(list => list.id !== listId);
        renderLists();
        
        showToast('Success', 'List deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting list:', error);
        showToast('Error', 'Failed to delete list. Please try again.', 'error');
    }
}

function openCreateCardModal(listId) {
    // Save list ID in the form
    const createCardForm = document.getElementById('createCardForm');
    if (createCardForm) {
        createCardForm.dataset.listId = listId;
    }
    
    // Clear form fields - check for existence before setting values
    const cardTitle = document.getElementById('cardTitle');
    if (cardTitle) {
        cardTitle.value = '';
    }
    
    const cardDescription = document.getElementById('cardDescription');
    if (cardDescription) {
        cardDescription.value = '';
    }
    
    const cardPriority = document.getElementById('cardPriority');
    if (cardPriority) {
        cardPriority.value = 'medium';
    }
    
    // Handle single assignee dropdown if it exists
    const cardAssignee = document.getElementById('cardAssignee');
    if (cardAssignee) {
        cardAssignee.value = '';
    }
    
    const cardDeadline = document.getElementById('cardDeadline');
    if (cardDeadline) {
        cardDeadline.value = '';
    }
    
    // Clear and reset task list
    const todoItemsContainer = document.getElementById('todoItems');
    if (todoItemsContainer) {
        todoItemsContainer.innerHTML = `
            <div class="todo-item">
                <input type="text" class="todo-input" placeholder="Add a task...">
                <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
            </div>
        `;
    }
    
    // Add users to dropdown only if the original dropdown exists
    if (cardAssignee) {
        populateUserSelect(cardAssignee);
    }
    
    // Add remove button handlers
    attachRemoveTodoHandlers();
    
    // Open modal
    openModal(createCardModal);
}

// Helper function to get priority color
function getPriorityColor(priority) {
    switch (priority) {
        case 'low':
            return '#10b981';  // Green
        case 'medium':
            return '#f59e0b';  // Amber
        case 'high':
            return '#ef4444';  // Red
        default:
            return '#3788d8';  // Blue
    }
}

// Update card creation to sync with calendar and handle both single and multiple assignees
async function handleCreateCard(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const listId = parseInt(event.target.dataset.listId);
    if (!listId) return;
    
    // Get basic card information
    const titleElement = document.getElementById('cardTitle');
    const descriptionElement = document.getElementById('cardDescription');
    const priorityElement = document.getElementById('cardPriority');
    const deadlineElement = document.getElementById('cardDeadline');
    
    // Check if elements exist before getting values
    const title = titleElement ? titleElement.value.trim() : '';
    const description = descriptionElement ? descriptionElement.value.trim() : '';
    const priority = priorityElement ? priorityElement.value : 'medium';
    const deadline = deadlineElement ? deadlineElement.value : '';
    
    // Check for both single and multiple assignee elements
    const assignedToElement = document.getElementById('cardAssignee');
    const assignedTo = assignedToElement ? assignedToElement.value : '';
    
    // Also check for multi-select
    const multiAssigneesElement = document.getElementById('cardAssignees');
    let selectedAssigneeIds = [];
    
    if (multiAssigneesElement) {
        // Get multiple assignees if using multi-select
        Array.from(multiAssigneesElement.selectedOptions).forEach(option => {
            if (option.value) {
                selectedAssigneeIds.push(parseInt(option.value));
            }
        });
    }
    
    if (!title) {
        alert("Title is required");
        return;
    }
    
    try {
        console.log('Creating card with assignment info:', 
            assignedTo ? `Single assignee: ${assignedTo}` : 'No single assignee', 
            selectedAssigneeIds.length > 0 ? `Multiple assignees: ${selectedAssigneeIds.join(', ')}` : 'No multiple assignees');
        
        // Create basic card
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                priority,
                completed: false
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create card. Status: ${response.status}`);
        }
        
        const newCard = await response.json();
        console.log('Card created successfully:', newCard);
        const cardId = newCard.id;
        
        // Array for additional operations
        const operations = [];
        
        // Add tasks
        const todoItems = getTodoItems('todoItems');
        for (const content of todoItems) {
            if (content) {
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/todos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content, completed: false }),
                    })
                );
            }
        }
        
        // Set deadline 
        if (deadline) {
            const deadlineDate = new Date(deadline);
            
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deadline: deadlineDate.toISOString() }),
                })
            );
            
            // We don't need to create a calendar event here - let the server-side sync handle it
            // This prevents duplicate calendar entries
        }
        
        // User assignment logic - handle both single and multiple assignees
        if (selectedAssigneeIds.length > 0) {
            // If we have multiple assignees selected, use the multi-assign endpoint
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_ids: selectedAssigneeIds }),
                })
            );
            
            // Store assignments for client-side use if cardAssignments Map exists
            if (typeof cardAssignments !== 'undefined') {
                cardAssignments.set(cardId, selectedAssigneeIds);
            }
        }
        else if (assignedTo) {
            // If using traditional single assignee, use that API
            operations.push(
                fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: assignedTo }),
                })
            );
        }
        
        // Execute all operations
        await Promise.allSettled(operations);
        
        // Sync with calendar after all operations are complete
        await syncCardsToCalendar();
        
        // Reload cards for updated list
        await loadCards(activeBoard.id, listId);
        renderLists();
        
        closeAllModals();
        
        showToast('Success', 'Card created successfully', 'success');
    } catch (error) {
        console.error('Error creating card:', error);
        showToast('Error', 'Failed to create card. Please try again.', 'error');
    }
}

// Helper function to get todos (used by both kanban.js and card_assignment.js)
function getTodoItems(containerId) {
    const todos = [];
    const container = document.getElementById(containerId);
    
    if (container) {
        const todoInputs = container.querySelectorAll('.todo-input');
        todoInputs.forEach(input => {
            const content = input.value.trim();
            if (content) {
                todos.push(content);
            }
        });
    }
    
    return todos;
}

// Sync existing cards with deadlines to the calendar
async function syncCardsToCalendar() {
    if (!activeBoard) return;
    
    try {
        // Call the server-side sync endpoint which will handle the synchronization properly
        // This approach lets the server manage the sync logic to prevent duplicates
        const response = await fetch('/calendar/sync-cards', {
            method: 'GET'
        });
        
        if (!response.ok) {
            console.error('Error syncing cards with calendar:', response.status);
            showToast('Error', 'Failed to sync cards with calendar', 'error');
            return;
        }
        
        const result = await response.json();
        showToast('Success', 'Cards successfully synchronized with calendar', 'success');
    } catch (error) {
        console.error('Error syncing cards with calendar:', error);
        showToast('Error', 'Failed to sync cards with calendar', 'error');
    }
}
// В CSS стили добавьте более заметные индикаторы перетаскивания
function addImprovedDragStyles() {
    const existingStyle = document.getElementById('kanban-drag-styles');
    if (existingStyle) {
        existingStyle.textContent += `
            .list.dragging-list {
                opacity: 0.6;
                background: #f0f0f0;
                border: 2px dashed #666;
                box-shadow: 0 0 10px rgba(0,0,0,0.2);
                z-index: 1000;
                transform: scale(0.98);
                transition: transform 0.1s;
            }
            
            .list.list-drop-zone {
                position: relative;
                outline: 2px solid #4299e1;
            }
            
            .list.list-drop-zone::before {
                content: '';
                position: absolute;
                top: 0;
                bottom: 0;
                width: 6px;
                background-color: #4299e1;
                z-index: 1;
            }
            
            .list.list-drop-zone[data-drop-position="before"]::before {
                left: -3px;
            }
            
            .list.list-drop-zone[data-drop-position="after"]::before {
                right: -3px;
            }
        `;
    }
}

// Add initialization after DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event handler for completion checkbox
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'editCardCompleted') {
            console.log('Completion checkbox changed to:', e.target.checked);
        }

    });
    addImprovedDragStyles();

});

function openEditCardModal(cardId, listId) {
    if (!activeBoard) return;
    
    const list = lists.find(list => list.id === listId);
    if (!list || !list.cards) return;
    
    const card = list.cards.find(card => card.id === cardId);
    if (!card) return;
    
    // Save card information in the form
    const form = document.getElementById('editCardForm');
    form.dataset.cardId = cardId;
    form.dataset.listId = listId;
    
    // Fill form with card data
    document.getElementById('editCardTitle').value = card.title || '';
    document.getElementById('editCardDescription').value = card.description || '';
    document.getElementById('editCardPriority').value = card.priority || 'medium';
    
    // Check if the single assignee dropdown exists before setting its value
    const assigneeElement = document.getElementById('editCardAssignee');
    if (assigneeElement) {
        assigneeElement.value = card.assigned_to ? card.assigned_to.toString() : '';
    }
    
    document.getElementById('editCardCompleted').checked = card.completed || false;
    
    // Set deadline date
    const deadlineInput = document.getElementById('editCardDeadline');
    if (deadlineInput && card.deadline) {
        // Format date for input[type="date"]
        const deadline = new Date(card.deadline);
        const year = deadline.getFullYear();
        const month = String(deadline.getMonth() + 1).padStart(2, '0');
        const day = String(deadline.getDate()).padStart(2, '0');
        deadlineInput.value = `${year}-${month}-${day}`;
    } else if (deadlineInput) {
        deadlineInput.value = '';
    }
    
    // Add users to dropdown if the element exists
    const assigneeSelect = document.getElementById('editCardAssignee');
    if (assigneeSelect) {
        populateUserSelect(assigneeSelect);
    }
    
    // Fill tasks
    const todoItemsContainer = document.getElementById('editTodoItems');
    if (todoItemsContainer) {
        todoItemsContainer.innerHTML = '';
        
        if (card.todos && card.todos.length > 0) {
            card.todos.forEach(todo => {
                const todoItem = document.createElement('div');
                todoItem.className = 'todo-item';
                todoItem.dataset.todoId = todo.id;
                
                todoItem.innerHTML = `
                    <div class="form-check">
                        <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                        <input type="text" class="todo-input" value="${todo.content}" placeholder="Task...">
                    </div>
                    <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
                `;
                
                todoItemsContainer.appendChild(todoItem);
            });
        }
        
        // Add empty line for new task
        const emptyTodoItem = document.createElement('div');
        emptyTodoItem.className = 'todo-item';
        emptyTodoItem.innerHTML = `
            <input type="text" class="todo-input" placeholder="Add new task...">
            <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
        `;
        todoItemsContainer.appendChild(emptyTodoItem);
    }
    
    // Add handlers for task delete buttons
    attachRemoveTodoHandlers();
    
    // Add event handler for delete card button
    const deleteCardBtn = document.getElementById('deleteCardBtn');
    if (deleteCardBtn) {
        deleteCardBtn.onclick = () => handleDeleteCard(cardId, listId);
    }
    
    // Open modal
    openModal(editCardModal);
}

function attachRemoveTodoHandlers() {
    document.querySelectorAll('.btn-remove-todo').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            let target = e.target;
            // If clicked on an icon inside the button, get the button
            if (!target.classList.contains('btn-remove-todo')) {
                target = target.closest('.btn-remove-todo');
            }
            
            const todoItem = target.closest('.todo-item');
            const todoId = todoItem.dataset.todoId;
            
            if (todoId) {
                // If todo already exists in database, delete it
                fetch(`${apiBaseUrl}/todos/${todoId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok && response.status !== 204) {
                        throw new Error(`Failed to delete todo. Status: ${response.status}`);
                    }
                    // Remove from DOM
                    todoItem.remove();
                })
                .catch(error => {
                    console.error('Error deleting todo:', error);
                    // Still remove from DOM for better UX
                    todoItem.remove();
                });
            } else {
                // If todo is just in the form, simply remove the input
                todoItem.remove();
            }
        });
    });
}

async function handleUpdateCard(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const cardId = parseInt(event.target.dataset.cardId);
    const listId = parseInt(event.target.dataset.listId);
    
    if (!cardId || !listId) return;
    
    const title = document.getElementById('editCardTitle').value.trim();
    const description = document.getElementById('editCardDescription').value.trim();
    const priority = document.getElementById('editCardPriority').value;
    const assignedToElement = document.getElementById('editCardAssignee');
    const assignedTo = assignedToElement ? assignedToElement.value : '';
    const deadline = document.getElementById('editCardDeadline').value;
    const completed = document.getElementById('editCardCompleted').checked;
    
    if (!title) return;
    
    try {
        console.log('Updating card with completion status:', completed);
        
        // Main card update - only update title and description here
        const operations = [];
        
        operations.push(
            fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description
                }),
            })
        );
        
        // Update priority
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/priority`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority }),
            })
        );
        
        // Explicitly set completion status - fix for auto-completion bug
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            })
        );
        
        // Update deadline
        if (deadline) {
            const deadlineDate = new Date(deadline);
            
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        deadline: deadlineDate.toISOString() 
                    }),
                })
            );
            
            // We don't need to directly create/update calendar events here
            // The syncCardsToCalendar function will handle it properly
        }
        
        // User assignment - use the correct route with /kanban prefix
        if (assignedTo) {
            operations.push(
                fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: assignedTo }),
                })
            );
        }
        
        // Process tasks
        const todoItems = document.querySelectorAll('#editTodoItems .todo-item');
        for (const todoItem of todoItems) {
            const todoId = todoItem.dataset.todoId;
            const todoInput = todoItem.querySelector('.todo-input');
            const todoCheckbox = todoItem.querySelector('.todo-checkbox');
            
            if (!todoInput) continue;
            
            const content = todoInput.value.trim();
            if (!content) continue;
            
            if (todoId) {
                // Update existing task
                operations.push(
                    fetch(`${apiBaseUrl}/todos/${todoId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            content, 
                            completed: todoCheckbox ? todoCheckbox.checked : false 
                        }),
                    })
                );
            } else {
                // Create new task
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/todos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content }),
                    })
                );
            }
        }
        
        // Execute all operations
        await Promise.allSettled(operations);
        
        // Sync with calendar after all operations are complete
        await syncCardsToCalendar();
        
        // Reload cards
        await loadCards(activeBoard.id, listId);
        renderLists();
        
        closeAllModals();
        
        showToast('Success', 'Card updated successfully', 'success');
    } catch (error) {
        console.error('Error updating card:', error);
        showToast('Error', 'Failed to update card. Please try again.', 'error');
    }
}

// Fixed card deletion function to match your API route
async function handleDeleteCard(cardId, listId) {
    if (!activeBoard) return;
    
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    try {
        console.log(`Deleting card: ${cardId} from list: ${listId}`);
        
        // Use the correct route with /kanban prefix as shown in the error logs
        const response = await fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}`, { 
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete card. Status: ${response.status}`);
        }
        
        // Update cards in list
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1 && lists[listIndex].cards) {
            lists[listIndex].cards = lists[listIndex].cards.filter(card => card.id !== cardId);
        }
        
        renderLists();
        closeAllModals();
        
        showToast('Success', 'Card deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting card:', error);
        showToast('Error', 'Failed to delete card. Please try again.', 'error');
        
        // Fallback: Update UI even if API failed
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1 && lists[listIndex].cards) {
            lists[listIndex].cards = lists[listIndex].cards.filter(card => card.id !== cardId);
            renderLists();
            closeAllModals();
        }
    }
}

async function handleToggleCardCompletion(cardId, listId, currentStatus) {
    if (!activeBoard) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !currentStatus }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to toggle card completion. Status: ${response.status}`);
        }
        
        // Update card status in list
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1 && lists[listIndex].cards) {
            const cardIndex = lists[listIndex].cards.findIndex(card => card.id === cardId);
            if (cardIndex !== -1) {
                lists[listIndex].cards[cardIndex].completed = !currentStatus;
            }
        }
        
        renderLists();
    } catch (error) {
        console.error('Error toggling card completion:', error);
        showToast('Error', 'Failed to update card status. Please try again.', 'error');
    }
}

// Helper function to get assignee information
function getAssigneeInfo(card) {
    if (!card.assigned_to) return null;
    
    const assignedUser = users.find(user => user.id === parseInt(card.assigned_to));
    if (!assignedUser) return null;
    
    return {
        id: assignedUser.id,
        name: assignedUser.username || assignedUser.name || `User ${assignedUser.id}`,
        initials: getInitials(assignedUser.username || assignedUser.name || '')
    };
}

async function handleCardMove(cardId, sourceListId, targetListId) {
    if (!activeBoard) return;
    
    try {
        console.log(`Moving card ${cardId} from list ${sourceListId} to list ${targetListId}`);
        
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${sourceListId}/cards/${cardId}/move/${targetListId}`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to move card. Status: ${response.status}`);
        }
        
        // Reload cards in source and target lists
        await loadCards(activeBoard.id, sourceListId);
        await loadCards(activeBoard.id, targetListId);
        
        renderLists();
        
        showToast('Success', 'Card moved successfully', 'success');
    } catch (error) {
        console.error('Error moving card:', error);
        showToast('Error', 'Failed to move card. Please try again.', 'error');
    }
}

// Task management functions
async function handleUpdateTodoStatus(todoId, completed) {
    try {
        const response = await fetch(`${apiBaseUrl}/todos/${todoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update todo status. Status: ${response.status}`);
        }
        
        // Reload all cards - in a real application, this would be more targeted
        if (activeBoard) {
            for (const list of lists) {
                await loadCards(activeBoard.id, list.id);
            }
            renderLists();
        }
    } catch (error) {
        console.error('Error updating todo status:', error);
        showToast('Error', 'Failed to update task status. Please try again.', 'error');
    }
}

async function handleDeleteTodo(todoId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/todos/${todoId}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`Failed to delete todo. Status: ${response.status}`);
        }
        
        // Reload all cards
        if (activeBoard) {
            for (const list of lists) {
                await loadCards(activeBoard.id, list.id);
            }
            renderLists();
        }
        
        showToast('Success', 'Task deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting todo:', error);
        showToast('Error', 'Failed to delete task. Please try again.', 'error');
    }
}

// Функция для создания элемента списка
function createListElement(list) {
    const listElement = document.createElement('div');
    listElement.className = 'list';
    listElement.dataset.listId = list.id;
    
    // Добавляем хранение цвета, если он есть
    if (list.color) {
        listElement.dataset.color = list.color;
        listElement.dataset.textColor = list.textColor || 'black';
    }
    
    // Создаем заголовок списка
    const listHeader = document.createElement('div');
    listHeader.className = 'list-header';
    
    // Применяем сохраненный цвет к заголовку
    if (list.color) {
        listHeader.style.backgroundColor = list.color;
        listHeader.style.color = list.textColor || 'black';
    }
    
    // Создаем содержимое заголовка списка
    listHeader.innerHTML = `
        <div class="list-title-container" style="display: flex; align-items: center; flex: 1;">
            <div class="list-color-indicator" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 8px;
                ${list.color ? `background-color: ${list.color};` : 'display: none;'}"></div>
            <h3 class="list-title">${list.name} <span>${list.cards ? list.cards.length : 0}</span></h3>
        </div>
        ${isAdmin ? `
            <div class="list-actions">
                <button class="btn-list-color" title="Change color"><i class="fas fa-palette"></i></button>
                <button class="btn-edit" title="Edit list"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" title="Delete list"><i class="fas fa-trash"></i></button>
            </div>
        ` : ''}
    `;
    
    // Добавляем обработчики для кнопок в заголовке списка
    if (isAdmin) {
        // После добавления заголовка в DOM, добавляем обработчики
        setTimeout(() => {
            const colorBtn = listHeader.querySelector('.btn-list-color');
            if (colorBtn) {
                colorBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openListColorPicker(list.id);
                });
            }
            
            const editBtn = listHeader.querySelector('.btn-edit');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditListModal(list.id);
                });
            }
            
            const deleteBtn = listHeader.querySelector('.btn-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleDeleteList(list.id);
                });
            }
        }, 0);
    }
    
    return { listElement, listHeader };
}

// Рендеринг списков
function renderLists() {
    const listsContainer = document.getElementById('listsContainer');
    
    // Очищаем контейнер
    listsContainer.innerHTML = '';
    
    // Добавляем списки
    lists.forEach(list => {
        // Используем новую функцию для создания элемента списка
        const { listElement, listHeader } = createListElement(list);
        
        // Создаем контейнер для карточек
        const listCards = document.createElement('div');
        listCards.className = 'list-cards';
        listCards.dataset.listId = list.id;
        
        // Включаем перетаскивание, если пользователь - администратор
        if (isAdmin) {
            setupDropZone(listCards);
        }
        
        // Добавляем карточки в список
        if (list.cards && list.cards.length > 0) {
            // Сортируем карточки по позиции, если такое поле есть
            if (list.cards[0].position !== undefined) {
                list.cards.sort((a, b) => a.position - b.position);
            }
            
            list.cards.forEach(card => {
                const cardElement = createCardElement(card, list.id);
                listCards.appendChild(cardElement);
            });
        }
        
        // Создаем кнопку добавления карточки (только для администраторов)
        if (isAdmin) {
            const addCardBtn = document.createElement('button');
            addCardBtn.className = 'btn-add-card';
            addCardBtn.innerHTML = '<i class="fas fa-plus"></i> Add Card';
            addCardBtn.addEventListener('click', () => openCreateCardModal(list.id));
            
            // Добавляем всё в элемент списка
            listElement.appendChild(listHeader);
            listElement.appendChild(listCards);
            listElement.appendChild(addCardBtn);
        } else {
            // Для обычных пользователей только заголовок и карточки
            listElement.appendChild(listHeader);
            listElement.appendChild(listCards);
        }
        
        // Настраиваем перетаскивание списка, если пользователь - администратор
        if (isAdmin) {
            setupDraggableList(listElement);
        }
        
        listsContainer.appendChild(listElement);
    });
    
    // Добавляем контейнер для кнопки добавления списка (только для администраторов)
    if (isAdmin) {
        const addListContainer = document.createElement('div');
        addListContainer.className = 'add-list-container';
        addListContainer.innerHTML = `
            <button id="addListBtn" class="btn-add-list">
                <i class="fas fa-plus"></i> Add List
            </button>
        `;
        
        // Добавляем обработчик для кнопки добавления списка
        addListContainer.querySelector('#addListBtn')?.addEventListener('click', () => openModal(createListModal));
        
        listsContainer.appendChild(addListContainer);
    }
    
    // Настраиваем контейнер списков для перетаскивания
    if (isAdmin) {
        setupListsContainer();
    }
}

// Обновим функцию создания карточки, добавив position в карточку
function createCardElement(card, listId) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.completed ? 'completed' : ''}`;
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.listId = listId;
    cardElement.dataset.priority = card.priority || 'medium';
    cardElement.dataset.position = card.position || 0; // Добавляем позицию
    
    // Make card draggable only for admins
    if (isAdmin) {
        cardElement.draggable = true;
        setupDraggable(cardElement);
    }
    
    // Prepare priority information
    let priorityClass = '';
    let priorityText = '';
    
    switch (card.priority) {
        case 'low':
            priorityClass = 'priority-low';
            priorityText = 'Low';
            break;
        case 'medium':
            priorityClass = 'priority-medium';
            priorityText = 'Medium';
            break;
        case 'high':
            priorityClass = 'priority-high';
            priorityText = 'High';
            break;
        default:
            priorityClass = 'priority-medium';
            priorityText = 'Medium';
    }
    
    // Apply full color style if enabled
    if (useFullColorPriority) {
        cardElement.classList.add(`full-color-priority-${card.priority || 'medium'}`);
    } else {
        cardElement.classList.add(`priority-${card.priority || 'medium'}`);
    }
    
// Get user information if card is assigned
let assigneeHtml = '';
if (card.assigned_to) {
    const assignedUser = users.find(user => user.id === parseInt(card.assigned_to));
    if (assignedUser) {
        const initials = getInitials(assignedUser.username || assignedUser.name || '');
        assigneeHtml = `
            <div class="user-badge" title="${assignedUser.username || assignedUser.name}">
                <div class="user-avatar">${initials}</div>
                <span>${assignedUser.username || assignedUser.name}</span>
            </div>
        `;
    }
}
            
            // Prepare deadline information
            let deadlineHtml = '';
            if (card.deadline) {
                const deadline = new Date(card.deadline);
                const now = new Date();
                const isOverdue = deadline < now && !card.completed;
                
                deadlineHtml = `
                    <div class="deadline ${isOverdue ? 'overdue' : ''}" title="${formatDate(deadline, true)}">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${formatDate(deadline)}</span>
                    </div>
                `;
            }
            
            // Prepare task information
            let todosHtml = '';
            let todoProgress = 0;
            
            if (card.todos && card.todos.length > 0) {
                const totalTodos = card.todos.length;
                const completedTodos = card.todos.filter(todo => todo.completed).length;
                
                todoProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;
                
                todosHtml = `
                    <div class="todo-list">
                        <div class="todo-progress">
                            <div class="todo-progress-bar" style="width: ${todoProgress}%"></div>
                        </div>
                        <div class="todo-summary">
                            ${completedTodos}/${totalTodos} tasks completed
                        </div>
                    </div>
                `;
            }
            
            // Build HTML for card
            cardElement.innerHTML = `
                <div class="card-header">
                    <h4 class="card-title">${card.title}</h4>
                    <span class="badge ${priorityClass}">${priorityText}</span>
                </div>
                ${card.description ? `<div class="card-description">${card.description}</div>` : ''}
                <div class="card-info">
                    ${assigneeHtml}
                    ${deadlineHtml}
                    ${todosHtml}
                </div>
                <div class="card-actions">
                    <button class="btn-toggle-completion" title="${card.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                        <i class="fas ${card.completed ? 'fa-check-square' : 'fa-square'}"></i>
                    </button>
                    ${isAdmin ? `
                        <button class="btn-edit-card" title="Edit card">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete-card" title="Delete card">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            
            // Add event handlers
            // Modified card click event handler to allow users to access todos
            cardElement.addEventListener('click', (e) => {
                // Skip if clicked on card actions (complete button, etc.)
                if (e.target.closest('.card-actions')) {
                    return;
                }
                
                if (isAdmin) {
                    // Admin can open full edit modal
                    openEditCardModal(card.id, listId);
                } else {
                    // Regular users can only access todos
                    openUserTodoModal(card.id, card.title);
                }
            });
            
            // Handler for toggling completion status (available to all users)
            cardElement.querySelector('.btn-toggle-completion').addEventListener('click', (e) => {
                e.stopPropagation();
                handleToggleCardCompletion(card.id, listId, card.completed);
            });
            
            if (isAdmin) {
                // Handler for editing card (admin only)
                cardElement.querySelector('.btn-edit-card')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditCardModal(card.id, listId);
                });
                
                // Handler for deleting card (admin only)
                cardElement.querySelector('.btn-delete-card')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleDeleteCard(card.id, listId);
                });
            }
            
            return cardElement;
        }
        
        // Function to open a simplified modal for regular users
function openUserTodoModal(cardId, cardTitle) {
    // Create or get modal element
    let todoModal = document.getElementById('userTodoModal');
    
    if (!todoModal) {
        // Create modal if it doesn't exist
        todoModal = document.createElement('div');
        todoModal.id = 'userTodoModal';
        todoModal.className = 'modal fade';
        todoModal.setAttribute('tabindex', '-1');
        todoModal.setAttribute('aria-hidden', 'true');
        
        // Set up modal HTML structure with higher z-index to ensure it's on top
        todoModal.innerHTML = `
            <div class="modal-dialog" style="z-index: 1060;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Tasks for: <span id="todoModalCardTitle"></span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="todo-list-container"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(todoModal);
        
        // Add additional styles to ensure the modal is interactive
        const modalStyles = document.createElement('style');
        modalStyles.textContent = `
            .modal-backdrop {
                z-index: 1050 !important;
            }
            #userTodoModal {
                z-index: 1055 !important;
            }
            .todo-item input[type="checkbox"] {
                pointer-events: auto !important;
                opacity: 1 !important;
                cursor: pointer !important;
            }
            .todo-item {
                cursor: pointer;
            }
        `;
        document.head.appendChild(modalStyles);
    }
    
    // Update modal title
    document.getElementById('todoModalCardTitle').textContent = cardTitle;
    
    // Initialize the modal
    const bsModal = new bootstrap.Modal(todoModal);
    
    // Show the modal
    bsModal.show();
    
    // Fetch todos when modal is shown
    todoModal.addEventListener('shown.bs.modal', function() {
        fetchAndDisplayTodos(cardId);
    }, { once: true });
}

// Function to fetch and display todos
function fetchAndDisplayTodos(cardId) {
    const todoContainer = document.querySelector('#userTodoModal .todo-list-container');
    todoContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    // Fetch todos from the server
    fetch(`${apiBaseUrl}/cards/${cardId}/todos`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Display todos
                displayUserTodos(data.todos, todoContainer, cardId);
            } else {
                todoContainer.innerHTML = `<div class="alert alert-danger">Error: ${data.message || 'Could not load tasks'}</div>`;
            }
        })
        .catch(error => {
            console.error('Error fetching todos:', error);
            todoContainer.innerHTML = '<div class="alert alert-danger">Failed to load tasks. Please try again.</div>';
        });
}

// Updated displayUserTodos function to use your existing handleUpdateTodoStatus
function displayUserTodos(todos, container, cardId) {
    container.innerHTML = '';
    
    if (!todos || todos.length === 0) {
        container.innerHTML = '<div class="no-todos p-3 text-muted">No tasks for this card</div>';
        return;
    }
    
    const todoList = document.createElement('div');
    todoList.className = 'todo-list';
    
    todos.forEach(todo => {
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item d-flex align-items-center p-2 border-bottom';
        todoItem.dataset.todoId = todo.id;
        
        // Create checkbox for completion status
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input me-3';
        checkbox.checked = todo.completed;
        checkbox.disabled = false; // Explicitly enable the checkbox
        
        // Add event listener to the checkbox using your existing function
        checkbox.addEventListener('click', function(e) {
            // Stop event propagation to prevent modal issues
            e.stopPropagation();
        });
        
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            // Use your existing function
            handleUpdateTodoStatus(todo.id, this.checked);
            
            // Update UI immediately (optimistic update)
            const todoContent = this.closest('.todo-item').querySelector('.todo-content');
            if (this.checked) {
                todoContent.classList.add('text-decoration-line-through', 'text-muted');
            } else {
                todoContent.classList.remove('text-decoration-line-through', 'text-muted');
            }
        });
        
        // Create todo content
        const todoContent = document.createElement('span');
        todoContent.className = todo.completed ? 'todo-content text-decoration-line-through text-muted' : 'todo-content';
        todoContent.textContent = todo.content;
        
        // Add elements to todo item
        todoItem.appendChild(checkbox);
        todoItem.appendChild(todoContent);
        
        // Prevent todoItem click from interfering with checkbox
        todoItem.addEventListener('click', function(e) {
            // If clicking directly on the todoItem (not the checkbox)
            if (e.target === this || e.target === todoContent) {
                const checkboxEl = this.querySelector('input[type="checkbox"]');
                checkboxEl.checked = !checkboxEl.checked;
                
                // Trigger the change event manually
                const changeEvent = new Event('change');
                checkboxEl.dispatchEvent(changeEvent);
            }
        });
        
        // Add todo item to list
        todoList.appendChild(todoItem);
    });
    
    container.appendChild(todoList);
}

// Add CSS for admin indicators
function addAdminStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .admin-only {
            position: relative;
        }
        
        .admin-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 6px;
            color: #6c757d;
            font-size: 0.8em;
        }
    `;
    document.head.appendChild(style);
}

// Modal functions
function openModal(modal) {
    // Close all open modals
    closeAllModals();
    
    // Open selected modal
    modal.classList.add('active');
    
    // Add handler to close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAllModals();
        }
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Helper functions
function selectBoard(board) {
    activeBoard = board;
    
    // Update active board in UI
    document.querySelectorAll('.board-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.boardId) === board.id);
    });
    
    // Update title and board actions
    document.getElementById('activeBoardTitle').textContent = board.name;
    document.getElementById('boardActions').style.display = 'flex';
    
    // Hide select board message and show lists container
    document.getElementById('selectBoardMessage').style.display = 'none';
    document.getElementById('listsContainer').style.display = 'flex';
    
    // Load lists for selected board
    loadLists(board.id);
}
// Add this loadLists function after the loadBoards function
async function loadLists(boardId) {
    if (!boardId) {
        console.error('Board ID is required to load lists');
        return;
    }
    
    showLoading('listsLoading');
    try {
        console.log(`Fetching lists for board ${boardId}`);
        const response = await fetch(`${apiBaseUrl}/boards/${boardId}/lists`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch lists. Status: ${response.status}`);
        }
        
        lists = await response.json();
        console.log('Lists loaded successfully:', lists);
        
        // Load cards for each list
        const cardPromises = lists.map(list => loadCards(boardId, list.id));
        await Promise.all(cardPromises);
        
        renderLists();
        hideLoading('listsLoading');
        
        // Check if there's a highlighted card to find
        const highlightCardId = localStorage.getItem('highlightCardId');
        if (highlightCardId) {
            setTimeout(() => {
                const cardElement = document.querySelector(`.card[data-card-id="${highlightCardId}"]`);
                if (cardElement) {
                    console.log(`Found card to highlight: ${highlightCardId}`);
                    localStorage.removeItem('highlightCardId');
                    
                    // Highlight found card
                    cardElement.classList.add('highlighted-card');
                    
                    // Scroll to card
                    cardElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    
                    // Remove highlight after some time
                    setTimeout(() => {
                        cardElement.classList.remove('highlighted-card');
                    }, 10000);
                }
            }, 500);
        }
    } catch (error) {
        console.error(`Error loading lists for board ${boardId}:`, error);
        showToast('Error', 'Failed to load lists. Please try again.', 'error');
        hideLoading('listsLoading');
    }
}

function showToast(title, message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'flex';
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function formatDate(date, showTime = false) {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    if (showTime) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    
    return `${day}.${month}.${year}`;
}

function getInitials(name) {
    if (!name) return '?';
    
    const parts = name.split(' ');
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function addTodoItem(containerId) {
    const container = document.getElementById(containerId);
    
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';
    
    todoItem.innerHTML = `
        <input type="text" class="todo-input" placeholder="Add a task...">
        <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
    `;
    
    // Add remove handler
    todoItem.querySelector('.btn-remove-todo').addEventListener('click', () => {
        todoItem.remove();
    });
    
    container.appendChild(todoItem);
}

// Toggle sidebar collapsed state
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

// Initialize edit list form handler
document.getElementById('editListForm').addEventListener('submit', handleEditList);

// Функция для создания модального окна выбора цвета списка
function createListColorModal() {
    // Проверяем, существует ли уже модальное окно
    let colorModal = document.getElementById('listColorModal');
    if (colorModal) return;
    
    // Предопределенные цвета для списков
    const LIST_COLORS = [
        { name: 'Синий', value: '#1976D2', text: 'white' },
        { name: 'Фиолетовый', value: '#9C27B0', text: 'white' },
        { name: 'Красный', value: '#D32F2F', text: 'white' },
        { name: 'Оранжевый', value: '#FF9800', text: 'black' },
        { name: 'Зеленый', value: '#2E7D32', text: 'white' },
        { name: 'Бирюзовый', value: '#00897B', text: 'white' },
        { name: 'Серый', value: '#757575', text: 'white' },
        { name: 'Розовый', value: '#E91E63', text: 'white' },
        { name: 'Коричневый', value: '#795548', text: 'white' },
        { name: 'Желтый', value: '#FFC107', text: 'black' },
        { name: 'По умолчанию', value: '#f0f2f5', text: 'black' }
    ];
    
    // Создаем модальное окно
    colorModal = document.createElement('div');
    colorModal.id = 'listColorModal';
    colorModal.className = 'modal';
    
    // Создаем содержимое модального окна
    colorModal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>Выберите цвет списка</h2>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="color-picker-container" style="padding: 16px;">
                <div class="color-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                    ${LIST_COLORS.map(color => `
                        <div class="color-option" data-color="${color.value}" data-text="${color.text}" 
                             style="background-color: ${color.value}; color: ${color.text}; 
                                   height: 40px; border-radius: 4px; cursor: pointer; 
                                   display: flex; align-items: center; justify-content: center; 
                                   box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
                            ${color.name}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Добавляем модальное окно в DOM
    document.body.appendChild(colorModal);
    
    // Добавляем обработчики событий
    colorModal.querySelector('.close-modal').addEventListener('click', () => {
        colorModal.classList.remove('active');
    });
    
    colorModal.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            const listId = colorModal.dataset.listId;
            const color = option.dataset.color;
            const textColor = option.dataset.text;
            
            if (listId && color) {
                setListColor(listId, color, textColor);
                colorModal.classList.remove('active');
            }
        });
    });
    
    // Закрытие при клике вне модального окна
    colorModal.addEventListener('click', (e) => {
        if (e.target === colorModal) {
            colorModal.classList.remove('active');
        }
    });
}

// Функция для открытия модального окна выбора цвета
function openListColorPicker(listId) {
    // Убедимся, что у нас есть модальное окно
    createListColorModal();
    
    // Получаем ссылку на модальное окно
    const colorModal = document.getElementById('listColorModal');
    
    // Устанавливаем ID списка
    colorModal.dataset.listId = listId;
    
    // Открываем модальное окно
    colorModal.classList.add('active');
}

// Функция для установки цвета списка
function setListColor(listId, color, textColor) {
    // Обновляем UI
    const listElement = document.querySelector(`.list[data-list-id="${listId}"]`);
    if (listElement) {
        const headerElement = listElement.querySelector('.list-header');
        if (headerElement) {
            headerElement.style.backgroundColor = color;
            headerElement.style.color = textColor;
            
            // Сохраняем цвета в атрибутах для восстановления при перерисовке
            listElement.dataset.color = color;
            listElement.dataset.textColor = textColor;
        }
    }
    
    // Находим список в массиве
    const listIndex = lists.findIndex(list => list.id === parseInt(listId));
    if (listIndex !== -1) {
        // Добавляем свойства цвета к объекту списка
        lists[listIndex].color = color;
        lists[listIndex].textColor = textColor;
        
        // Сохраняем на сервере
        saveListColor(listId, color, textColor);
    }
}

// Функция для сохранения цвета списка на сервере
function saveListColor(listId, color, textColor) {
    if (!activeBoard) return;
    
    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/color`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, text_color: textColor }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to save list color. Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('List color saved:', data);
    })
    .catch(error => {
        console.error('Error saving list color:', error);
        showToast('Error', 'Failed to save list color', 'error');
    });
}

// Add drag & drop styles
function addDragAndDropStyles() {
    const style = document.createElement('style');
    style.id = 'kanban-drag-styles';
    style.textContent = `
        .list.dragging-list {
            opacity: 0.5;
            background: #f0f0f0;
            border: 2px dashed #999;
            z-index: 1000;
        }
        
        .list.list-drop-zone::before {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            width: 6px;
            background-color: #4299e1;
            z-index: 1;
        }
        
        .list.list-drop-zone[data-drop-position="before"]::before {
            left: -3px;
        }
        
        .list.list-drop-zone[data-drop-position="after"]::before {
            right: -3px;
        }
        
        .card.dragging {
            opacity: 0.7;
            transform: scale(0.98);
            z-index: 1000;
        }
        
        .list-cards.drag-over {
            background-color: rgba(66, 153, 225, 0.1);
        }
    `;
    document.head.appendChild(style);
}

// Functions for draggable cards
function setupDraggable(element) {
    element.addEventListener('dragstart', (e) => {
        // Убедимся, что перетаскивается карточка, а не список
        e.stopPropagation(); // Предотвращаем всплытие события к родительскому списку
        
        e.dataTransfer.setData('card-id', e.target.dataset.cardId);
        e.dataTransfer.setData('source-list', e.target.dataset.listId);
        e.dataTransfer.effectAllowed = 'move';
        
        // Добавляем класс для визуального отображения перетаскивания
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);
    });
    
    element.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
}

// Functions for drop zones
function setupDropZone(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        // Проверяем, является ли перетаскиваемый элемент карточкой
        if (isDraggingList) return;
        
        const cardBeingDragged = document.querySelector('.dragging');
        if (!cardBeingDragged) return;
        
        // Определяем, над какой карточкой находится курсор
        const cardsInThisList = Array.from(element.querySelectorAll('.card:not(.dragging)'));
        const cardAfterCursor = getCardAfterCursor(cardsInThisList, e.clientY);
        
        // Визуальная индикация для зоны сброса
        element.classList.add('drag-over');
        
        // Если карточка найдена, вставляем перетаскиваемую карточку перед ней
        if (cardAfterCursor) {
            element.insertBefore(cardBeingDragged, cardAfterCursor);
        } else {
            // Если курсор ниже всех карточек или список пуст, добавляем в конец
            element.appendChild(cardBeingDragged);
        }
    });
    
    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', async (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        
        // Проверяем, является ли перетаскиваемый элемент карточкой
        const cardId = e.dataTransfer.getData('card-id');
        if (!cardId) return; // Если нет id карточки, то пропускаем
        
        const sourceListId = parseInt(e.dataTransfer.getData('source-list'));
        const targetListId = parseInt(element.dataset.listId);
        
        // Если перемещение между разными списками
        if (sourceListId !== targetListId) {
            await handleCardMove(parseInt(cardId), sourceListId, targetListId);
        }
        // Если перемещение внутри одного списка
        else {
            // Собираем новый порядок карточек
            const cards = Array.from(element.querySelectorAll('.card'));
            const cardIds = cards.map(card => parseInt(card.dataset.cardId));
            
            // Сохраняем новый порядок
            saveCardsOrder(targetListId, cardIds);
        }
    });
}

// Get card that should come after the dragged card
function getCardAfterCursor(cards, cursorY) {
    return cards.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = cursorY - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save new order of cards
async function saveCardsOrder(listId, cardIds) {
    if (!activeBoard) return;
    
    try {
        console.log(`Saving new cards order for list ${listId}:`, cardIds);
        
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_ids: cardIds }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save cards order. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Cards order saved:', data);
        
        // Обновляем порядок карточек в массиве списков
        updateCardsOrderInMemory(listId, cardIds);
        
        showToast('Success', 'Cards order saved successfully', 'success');
    } catch (error) {
        console.error('Error saving cards order:', error);
        showToast('Error', 'Failed to save cards order', 'error');
    }
}

// Update order of cards in memory
function updateCardsOrderInMemory(listId, cardIds) {
    const listIndex = lists.findIndex(list => list.id === listId);
    if (listIndex === -1 || !lists[listIndex].cards) return;
    
    const newOrderCards = [];
    cardIds.forEach(cardId => {
        const card = lists[listIndex].cards.find(c => c.id === cardId);
        if (card) {
            newOrderCards.push(card);
        }
    });
    
    lists[listIndex].cards = newOrderCards;
}

// Functions for draggable lists
function setupDraggableList(listElement) {
    listElement.setAttribute('draggable', 'true');
    
    listElement.addEventListener('dragstart', (e) => {
        console.log('List dragstart event triggered', e.target);
        
        // Проверяем, что тянут за заголовок списка
        const isHeader = e.target.classList.contains('list-header') || 
                       e.target.closest('.list-header');
                       
        // Если тянут не за заголовок или пользователь не админ, отменяем
        if (!isHeader || !isAdmin) {
            e.preventDefault();
            return false;
        }
        
        isDraggingList = true;
        draggedList = listElement;
        
        const rect = listElement.getBoundingClientRect();
        listElement.style.setProperty('--list-width', `${rect.width}px`);
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', listElement.dataset.listId);
        
        // Добавляем классы с небольшой задержкой для лучшей визуализации
        setTimeout(() => {
            listElement.classList.add('dragging-list');
        }, 0);
        
        console.log('List drag started for list ID:', listElement.dataset.listId);
    });
    
    listElement.addEventListener('dragend', (e) => {
        console.log('List dragend event triggered');
        isDraggingList = false;
        draggedList = null;
        listElement.classList.remove('dragging-list');
        
        // Удаляем все маркеры зон перетаскивания
        document.querySelectorAll('.list-drop-zone').forEach(el => {
            el.classList.remove('list-drop-zone');
            el.removeAttribute('data-drop-position');
        });
    });
}
// Модифицированная функция setupListsContainer
function setupListsContainer() {
    const container = document.getElementById('listsContainer');
    if (!container) return;
    
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        // Если не тащим список или пользователь не админ, игнорируем
        if (!isDraggingList || !isAdmin) return;
        
        const draggingElement = document.querySelector('.dragging-list');
        if (!draggingElement) return;
        
        // Получаем элемент, после которого нужно вставить
        const afterElement = getDragAfterElement(container, e.clientX);
        
        // Очищаем предыдущие зоны перетаскивания
        document.querySelectorAll('.list-drop-zone').forEach(el => {
            el.classList.remove('list-drop-zone');
            el.removeAttribute('data-drop-position');
        });
        
        if (afterElement) {
            // Если есть элемент, после которого вставляем
            afterElement.classList.add('list-drop-zone');
            afterElement.setAttribute('data-drop-position', 'before');
        } else if (container.lastElementChild && 
                  container.lastElementChild !== draggingElement) {
            // Если нет элемента (конец контейнера), выделяем последний элемент
            container.lastElementChild.classList.add('list-drop-zone');
            container.lastElementChild.setAttribute('data-drop-position', 'after');
        }
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // Если не тащим список или пользователь не админ, игнорируем
        if (!isDraggingList || !isAdmin || !draggedList) return;
        
        console.log('List dropped, rearranging lists');
        
        const draggingElement = document.querySelector('.dragging-list');
        if (!draggingElement) return;
        
        // Получаем элемент, после которого нужно вставить
        const afterElement = getDragAfterElement(container, e.clientX);
        
        // Вставляем перетаскиваемый элемент
        if (afterElement) {
            container.insertBefore(draggingElement, afterElement);
        } else {
            container.appendChild(draggingElement);
        }
        
        // Очищаем маркеры
        document.querySelectorAll('.list-drop-zone').forEach(el => {
            el.classList.remove('list-drop-zone');
            el.removeAttribute('data-drop-position');
        });
        
        // Обновляем порядок списков и сохраняем его
        updateListsOrder();
        saveListsOrder();
    });
}


// Улучшенная функция getDragAfterElement
function getDragAfterElement(container, x) {
    const draggingElement = document.querySelector('.dragging-list');
    if (!draggingElement) return null;
    
    const draggableElements = [...container.querySelectorAll('.list:not(.dragging-list)')];
    if (draggableElements.length === 0) return null;
    
    // Находим элемент, после которого нужно вставить перетаскиваемый
    let closestElement = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    
    draggableElements.forEach(element => {
        const box = element.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        
        if (offset < 0 && offset > closestOffset) {
            closestOffset = offset;
            closestElement = element;
        }
    });
    
    return closestElement;
}
// Модифицированная функция updateListsOrder
function updateListsOrder() {
    const listElements = document.querySelectorAll('.list');
    const newOrder = Array.from(listElements)
        .filter(el => el.dataset.listId) // Убедимся, что у элемента есть ID
        .map(el => parseInt(el.dataset.listId));
    
    console.log('New list order:', newOrder);
    
    // Проверяем, не пустой ли массив
    if (newOrder.length === 0) {
        console.warn('No lists found to update order');
        return;
    }
    
    // Создаем новый массив с списками в новом порядке
    const newLists = [];
    for (const listId of newOrder) {
        const list = lists.find(l => l.id === listId);
        if (list) {
            newLists.push(list);
        } else {
            console.warn(`List with ID ${listId} not found in lists array`);
        }
    }
    
    // Проверяем, не пустой ли получившийся массив
    if (newLists.length === 0) {
        console.warn('No lists in new order. Keeping original order.');
        return;
    }
    
    // Обновляем глобальный массив списков
    lists = newLists;
    console.log('Lists order updated in memory');
}
// Function to save lists order on the server
async function saveListsOrder() {
    if (!activeBoard) return;
    
    // Get the current order of lists from the DOM
    const listElements = document.querySelectorAll('.list');
    const listIds = Array.from(listElements).map(el => parseInt(el.dataset.listId));
    
    console.log('Saving lists order to server:', listIds);
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list_ids: listIds }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save lists order. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Lists order saved successfully:', data);
        
        // Notify user of success
        showToast('Success', 'List order saved successfully', 'success');
    } catch (error) {
        console.error('Error saving lists order:', error);
        showToast('Error', 'Failed to save list order. Please try again.', 'error');
    }
}

// Добавьте несколько debugging функций
function debugDragDrop() {
    console.log('Current drag state:', {
        isDraggingList,
        draggedList: draggedList ? draggedList.dataset.listId : null
    });
    console.log('Lists in memory:', lists.map(l => ({ id: l.id, name: l.name })));
}

// Инициализируем переменные в начале скрипта, если они еще не инициализированы
if (typeof isDraggingList === 'undefined') {
    let isDraggingList = false;
}

if (typeof draggedList === 'undefined') {
    let draggedList = null;
}
// Экспортировать основные функции в глобальное пространство имен
window.loadLists = loadLists;
window.loadCards = loadCards;
window.renderLists = renderLists;
window.createCardElement = createCardElement;
window.selectBoard = selectBoard;
window.showToast = showToast;
window.addTodoItem = addTodoItem;
window.getTodoItems = getTodoItems;
window.openModal = openModal;
window.closeAllModals = closeAllModals;