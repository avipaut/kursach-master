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
let currentUserId = null;

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
    addDragAndDropStyles();

  // Fix for issue #3: Re-initialize all event listeners
  document.getElementById('createBoardBtn').addEventListener('click', () => openModal(createBoardModal));
  document.getElementById('createBoardForm').addEventListener('submit', handleCreateBoardWithUsers);
  document.getElementById('editBoardBtn').addEventListener('click', openEditBoardModal);
  document.getElementById('editBoardForm').addEventListener('submit', handleEditBoardWithUsers);
  document.getElementById('deleteBoardBtn').addEventListener('click', handleDeleteBoard);
  document.getElementById('addListBtn')?.addEventListener('click', () => openModal(createListModal));
  document.getElementById('createListForm').addEventListener('submit', handleCreateList);
  document.getElementById('createCardForm').addEventListener('submit', handleCreateCard);
  document.getElementById('editCardForm').addEventListener('submit', handleUpdateCard);
  document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);
  document.getElementById('addTodoBtn').addEventListener('click', () => addTodoItem('todoItems'));
  document.getElementById('editAddTodoBtn').addEventListener('click', () => addTodoItem('editTodoItems'));

  // Close modals when clicking close buttons or cancel buttons
  document.querySelectorAll('.close-modal, .btn-cancel').forEach(element => {
      element.addEventListener('click', () => closeAllModals());
  })

    
});
// Функции для перетаскивания карточек
function setupDraggable(cardElement) {
    cardElement.draggable = true;
    
    cardElement.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        cardElement.classList.add('dragging');
        
        // Устанавливаем данные для переноса
        e.dataTransfer.setData('card-id', cardElement.dataset.cardId);
        e.dataTransfer.setData('source-list', cardElement.dataset.listId);
        e.dataTransfer.effectAllowed = 'move';
        
        // Устанавливаем изображение для перетаскивания
        setTimeout(() => {
            cardElement.classList.add('dragging');
        }, 0);
    });

    cardElement.addEventListener('dragend', () => {
        cardElement.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
}

// Функции для зон сброса
function setupDropZone(listCardsElement) {
    listCardsElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (isDraggingList) return;
        
        const cardBeingDragged = document.querySelector('.card.dragging');
        if (!cardBeingDragged) return;
        
        listCardsElement.classList.add('drag-over');
        
        // Определяем позицию для вставки
        const afterElement = getCardAfterCursor(listCardsElement, e.clientY);
        
        if (afterElement) {
            listCardsElement.insertBefore(cardBeingDragged, afterElement);
        } else {
            listCardsElement.appendChild(cardBeingDragged);
        }
    });

    listCardsElement.addEventListener('dragleave', () => {
        listCardsElement.classList.remove('drag-over');
    });

    listCardsElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        listCardsElement.classList.remove('drag-over');
        
        const cardId = e.dataTransfer.getData('card-id');
        const sourceListId = parseInt(e.dataTransfer.getData('source-list'));
        const targetListId = parseInt(listCardsElement.dataset.listId);
        
        if (!cardId || isNaN(sourceListId) || isNaN(targetListId)) return;
        
        // Если карточка перемещается между списками
        if (sourceListId !== targetListId) {
            await handleCardMove(parseInt(cardId), sourceListId, targetListId);
        } 
        // Если перемещение внутри одного списка
        else {
            const cardIds = Array.from(listCardsElement.querySelectorAll('.card'))
                .map(card => parseInt(card.dataset.cardId));
            await saveCardsOrder(targetListId, cardIds);
        }
    });
}

// Функция для определения позиции карточки после курсора
function getCardAfterCursor(listCardsElement, cursorY) {
    const cards = Array.from(listCardsElement.querySelectorAll('.card:not(.dragging)'));
    
    return cards.reduce((closest, card) => {
        const box = card.getBoundingClientRect();
        const offset = cursorY - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: card };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Функции для перетаскивания списков
function setupDraggableList(listElement) {
    if (!listElement) return;
    
    // Делаем заголовок списка перетаскиваемым
    const header = listElement.querySelector('.list-header');
    if (!header) return;
    
    header.draggable = true;
    
    header.addEventListener('dragstart', (e) => {
        isDraggingList = true;
        draggedList = listElement;
        
        // Устанавливаем данные для перетаскивания
        e.dataTransfer.setData('text/plain', listElement.dataset.listId);
        e.dataTransfer.effectAllowed = 'move';
        
        // Добавляем класс для визуального эффекта
        setTimeout(() => {
            listElement.classList.add('dragging-list');
        }, 0);
    });
    
    header.addEventListener('dragend', () => {
        isDraggingList = false;
        draggedList = null;
        listElement.classList.remove('dragging-list');
    });
}

// Настройка контейнера списков для перетаскивания
function setupListsContainer() {
    const container = document.getElementById('listsContainer');
    if (!container) return;
    
    container.addEventListener('dragover', (e) => {
        if (!isDraggingList) return;
        e.preventDefault();
        
        const afterElement = getDragAfterElement(container, e.clientX);
        
        if (afterElement) {
            container.insertBefore(draggedList, afterElement);
        } else {
            // This fixes the issue - now it can be dropped at the end
            container.appendChild(draggedList);
        }
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!isDraggingList || !draggedList) return;
        
        updateListsOrder();
        saveListsOrder();
    });
}
// In kanban.js, modify the function:

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.list:not(.dragging-list)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
// Обновление порядка списков в памяти
function updateListsOrder() {
    const listElements = document.querySelectorAll('.list');
    const newOrder = Array.from(listElements)
        .filter(el => el.dataset.listId)
        .map(el => parseInt(el.dataset.listId));
    
    // Создаем новый массив с списками в новом порядке
    const newLists = [];
    for (const listId of newOrder) {
        const list = lists.find(l => l.id === listId);
        if (list) newLists.push(list);
    }
    
    // Обновляем глобальный массив списков
    if (newLists.length > 0) {
        lists = newLists;
    }
}

// Сохранение порядка списков на сервере
async function saveListsOrder() {
    if (!activeBoard) return;
    
    const listElements = document.querySelectorAll('.list');
    const listIds = Array.from(listElements).map(el => parseInt(el.dataset.listId));
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list_ids: listIds }),
        });
        
        if (!response.ok) throw new Error(`Failed to save lists order. Status: ${response.status}`);
        
        //('Success', 'List order saved successfully', 'success');
    } catch (error) {
        console.error('Error saving lists order:', error);
        //('Error', 'Failed to save list order', 'error');
    }
}

// Сохранение порядка карточек на сервере
async function saveCardsOrder(listId, cardIds) {
    if (!activeBoard) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_ids: cardIds }),
        });
        
        if (!response.ok) throw new Error(`Failed to save cards order. Status: ${response.status}`);
        
        // Обновляем порядок карточек в памяти
        updateCardsOrderInMemory(listId, cardIds);
    } catch (error) {
        console.error('Error saving cards order:', error);
    }
}

// Обновление порядка карточек в памяти
function updateCardsOrderInMemory(listId, cardIds) {
    const listIndex = lists.findIndex(list => list.id === listId);
    if (listIndex === -1 || !lists[listIndex].cards) return;
    
    const newOrderCards = [];
    cardIds.forEach(cardId => {
        const card = lists[listIndex].cards.find(c => c.id === cardId);
        if (card) newOrderCards.push(card);
    });
    
    lists[listIndex].cards = newOrderCards;
}

// Инициализация drag-and-drop при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setupListsContainer();
    
    // Добавляем стили для drag-and-drop
    const style = document.createElement('style');
    style.textContent = `
        .card.dragging {
            opacity: 0.5;
            transform: rotate(3deg);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            z-index: 1000;
        }
        
        .list-cards.drag-over {
            background-color: rgba(66, 153, 225, 0.1);
            border: 2px dashed #4299e1;
            border-radius: 8px;
            min-height: 50px;
        }
        
        .list.dragging-list {
            opacity: 0.6;
            transform: scale(1.02);
            box-shadow: 0 0 20px rgba(0,0,0,0.2);
        }
    `;
    document.head.appendChild(style);
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
async function fetchCurrentUser() {
    try {
        const response = await fetch(`${apiBaseUrl}/api/users/current`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch user info. Status: ${response.status}`);
        }
        
        const data = await response.json();
        const userData = data.user;
        
        currentUserName = userData.username;
        currentUserId = userData.id;
        isAdmin = userData.is_admin;
        
        console.log('Current user:', currentUserName, 'Admin status:', isAdmin);
        
        // Update UI based on permissions
        updateUIBasedOnPermissions();
        
        return userData;
    } catch (error) {
        console.error('Error fetching current user:', error);
        //('Error', 'Failed to get user information', 'error');
        return null;
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
        
        // If boards don't have creator_name, fetch that information
        for (const board of boards) {
            if (!board.creator_name) {
                try {
                    const creatorResponse = await fetch(`${apiBaseUrl}/api/board/${board.id}/creator_info`);
                    if (creatorResponse.ok) {
                        const creatorData = await creatorResponse.json();
                        board.creator_name = creatorData.creator_name;
                    }
                } catch (e) {
                    console.warn(`Could not fetch creator for board ${board.id}:`, e);
                }
            }
        }
        
        renderBoards();
        hideLoading('boardsLoading');

        // Check URL parameters after loading
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
        
        // If there's a card ID but no board ID
        if (highlightCardId && !boardIdFromUrl) {
            console.log(`Searching for card ${highlightCardId} across all boards`);
            await searchCardAcrossAllBoards(parseInt(highlightCardId));
            return;
        }

        // If no board was found in URL or no board_id, select the first board
        if (boards.length > 0) {
            console.log('Selecting first board by default');
            selectBoard(boards[0]);
        }
    } catch (error) {
        console.error('Error loading boards:', error);
        //('Error', 'Failed to load boards. Please try again.', 'error');
        hideLoading('boardsLoading');
    }
}
async function fetchBoardCreator(boardId) {
    try {
        const response = await fetch(`${apiBaseUrl}/api/board/${boardId}/creator_info`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch board creator. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update board object with creator information
        const boardIndex = boards.findIndex(board => board.id === boardId);
        if (boardIndex !== -1) {
            boards[boardIndex].creator_name = data.creator_name;
            boards[boardIndex].creator_id = data.creator_id;
            boards[boardIndex].created_at = data.created_at;
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching board creator:', error);
        return null;
    }
}
async function fetchCardCreator(cardId) {
    try {
        const response = await fetch(`${apiBaseUrl}/api/card/${cardId}/creator_info`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch card creator. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Find and update card object with creator information
        for (const list of lists) {
            if (!list.cards) continue;
            
            const cardIndex = list.cards.findIndex(card => card.id === cardId);
            if (cardIndex !== -1) {
                list.cards[cardIndex].creator_name = data.creator_name;
                list.cards[cardIndex].creator_id = data.creator_id;
                list.cards[cardIndex].created_at = data.created_at;
                break;
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching card creator:', error);
        return null;
    }
}

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
async function loadFullBoardData(boardId) {
    showLoading('listsLoading');
    try {
        console.log(`Fetching full data for board ${boardId}`);
        const response = await fetch(`${apiBaseUrl}/api/board/${boardId}/full_data`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch board data. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update active board object with creator information
        activeBoard = data.board;
        activeBoard.creator_name = data.creator.username;
        
        // Update users
        users = data.users;
        
        // Update lists with cards
        lists = data.lists;
        
        // Render lists with all data included
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
                    
                    // Highlight the found card
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
        
        return data;
    } catch (error) {
        console.error(`Error loading board data: ${error}`);
        //('Error', 'Failed to load board data. Please try again.', 'error');
        hideLoading('listsLoading');
        return null;
    }
}
async function loadListsWithCards(boardId) {
    showLoading('listsLoading');
    try {
        console.log(`Fetching lists with cards for board ${boardId}`);
        const response = await fetch(`${apiBaseUrl}/api/boards/${boardId}/lists/with_cards`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch lists with cards. Status: ${response.status}`);
        }
        
        lists = await response.json();
        console.log('Lists with cards loaded successfully:', lists);
        
        renderLists();
        hideLoading('listsLoading');
        
        // Check for highlighted card
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
        
        return lists;
    } catch (error) {
        console.error(`Error loading lists with cards: ${error}`);
        //('Error', 'Failed to load lists with cards. Please try again.', 'error');
        hideLoading('listsLoading');
        return [];
    }
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

function populateUserSelect(selectElement) {
    if (!selectElement) return;
    
    // Clear existing options except the first onepo
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Add available users based on the current board
    if (window.boardAssignableUsers && window.boardAssignableUsers.length > 0) {
        // If we have board-specific users, use those
        window.boardAssignableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            selectElement.appendChild(option);
        });
    } else if (users && users.length > 0) {
        // Fall back to all users if board-specific users aren't available
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            selectElement.appendChild(option);
        });
    }
}
function populateMultiSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Use the appropriate set of users
    const userList = window.boardAssignableUsers && window.boardAssignableUsers.length > 0 
        ? window.boardAssignableUsers 
        : users;
    
    if (userList && userList.length > 0) {
        userList.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            select.appendChild(option);
        });
    }
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
        //('Error', 'Failed to load users. Please try again.', 'error');
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
                //('Error', 'You need administrator privileges to create boards', 'error');
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
        
        //('Success', 'Board created successfully', 'success');
    } catch (error) {
        console.error('Error creating board:', error);
        //('Error', 'Failed to create board. Please try again.', 'error');
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
                //('Error', 'You need administrator privileges to edit boards', 'error');
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
        
        //('Success', 'Board updated successfully', 'success');
    } catch (error) {
        console.error('Error updating board:', error);
        //('Error', 'Failed to update board. Please try again.', 'error');
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

function renderBoards() {
    const boardsList = document.getElementById('boardsList');
    const boardItems = boardsList.querySelectorAll('.board-item');
    boardItems.forEach(item => item.remove());

    if (!boards || boards.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'You don\'t have any boards yet. Create a new board.';
        boardsList.appendChild(emptyMessage);
        return;
    }

    const sortedBoards = [...boards].sort((a, b) => a.name.localeCompare(b.name));

    sortedBoards.forEach(board => {
        const boardItem = document.createElement('div');
        boardItem.className = `board-item ${activeBoard && activeBoard.id === board.id ? 'active' : ''}`;
        if (board.admin_only) {
            boardItem.classList.add('admin-only');
        }
        boardItem.dataset.boardId = board.id;
        
        // Get creator information - use creator_name from backend if available
        const creatorName = board.creator_name || 
                           (board.user_id && users ? 
                            (users.find(u => u.id === board.user_id)?.username || 'Unknown User') : 
                            'Unknown User');
        
        // Format creation date with fallback
        let creationDate = 'Unknown date';
        try {
            if (board.created_at) {
                creationDate = formatDate(new Date(board.created_at));
            }
        } catch (e) {
            console.error('Error formatting date:', e);
        }
        
        boardItem.innerHTML = `
            <div class="board-name">
                <span>${board.name}</span>
                ${board.admin_only ? '<span class="admin-badge"><i class="fas fa-lock"></i></span>' : ''}
                <div class="board-creator-info">
                    <small>Created by ${creatorName} on ${creationDate}</small>
                </div>
            </div>
            <div class="board-actions">
                ${isAdmin ? `
                    <button class="btn-edit-board" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete-board" title="Delete"><i class="fas fa-trash"></i></button>
                ` : ''}
            </div>
        `;
        
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
        
        //('Success', 'Board deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting board:', error);
        //('Error', 'Failed to delete board. Please try again.', 'error');
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
        
        //('Success', 'List created successfully', 'success');
    } catch (error) {
        console.error('Error creating list:', error);
        //('Error', 'Failed to create list. Please try again.', 'error');
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
        
        //('Success', 'List updated successfully', 'success');
    } catch (error) {
        console.error('Error updating list:', error);
        //('Error', 'Failed to update list. Please try again.', 'error');
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
        
        //('Success', 'List deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting list:', error);
        //('Error', 'Failed to delete list. Please try again.', 'error');
    }
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
        
        //('Success', 'Card created successfully', 'success');
    } catch (error) {
        console.error('Error creating card:', error);
        //('Error', 'Failed to create card. Please try again.', 'error');
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
            //('Error', 'Failed to sync cards with calendar', 'error');
            return;
        }
        
        const result = await response.json();
        //('Success', 'Cards successfully synchronized with calendar', 'success');
    } catch (error) {
        console.error('Error syncing cards with calendar:', error);
        //('Error', 'Failed to sync cards with calendar', 'error');
    }
}
// В CSS стили добавьте более заметные индикаторы перетаскивания

// Add initialization after DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event handler for completion checkbox
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'editCardCompleted') {
            console.log('Completion checkbox changed to:', e.target.checked);
        }

    });

});


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

// Fix for issue #6: Improved card update functionality
async function handleUpdateCard(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const cardId = parseInt(event.target.dataset.cardId);
    const listId = parseInt(event.target.dataset.listId);
    
    if (!cardId || !listId) return;
    
    const title = document.getElementById('editCardTitle').value.trim();
    const description = document.getElementById('editCardDescription').value.trim();
    const priority = document.getElementById('editCardPriority').value;
    const deadline = document.getElementById('editCardDeadline').value;
    const completed = document.getElementById('editCardCompleted').checked;
    
    // Handle assignees - check for both single and multiple select
    let selectedAssignees = [];
    
    const multiAssigneesEl = document.getElementById('editCardAssignees');
    if (multiAssigneesEl) {
        selectedAssignees = Array.from(multiAssigneesEl.selectedOptions)
            .map(option => parseInt(option.value))
            .filter(id => !isNaN(id));
    } else {
        const singleAssigneeEl = document.getElementById('editCardAssignee');
        if (singleAssigneeEl && singleAssigneeEl.value) {
            selectedAssignees = [parseInt(singleAssigneeEl.value)];
        }
    }
    
    if (!title) {
        alert("Title is required");
        return;
    }
    
    try {
        // Create a queue of operations
        const operations = [];
        
        // Base card update - title and description
        operations.push(
            fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description }),
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
        
        // Set completion status
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            })
        );
        
        // Update deadline if provided
        if (deadline) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
                })
            );
        }
        
        // Assign users - try multi-assign first, then fall back to single assign
        if (selectedAssignees.length > 0) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_ids: selectedAssignees }),
                }).catch(error => {
                    console.warn('Multi-assign failed, using single assign:', error);
                    // Fallback to single assign with the first user
                    return fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: selectedAssignees[0] }),
                    });
                })
            );
            
            // Update local card assignments if the Map exists
            if (typeof cardAssignments !== 'undefined') {
                cardAssignments.set(cardId, selectedAssignees);
            }
        } else {
            // Clear assignment if no users selected
            operations.push(
                fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: null }),
                })
            );
            
            // Update local card assignments if the Map exists
            if (typeof cardAssignments !== 'undefined') {
                cardAssignments.delete(cardId);
            }
        }
        
        // Handle todos (tasks)
        const todoItems = document.querySelectorAll('#editTodoItems .todo-item');
        for (const todoItem of todoItems) {
            const todoId = todoItem.dataset.todoId;
            const todoInput = todoItem.querySelector('.todo-input');
            const todoCheckbox = todoItem.querySelector('.todo-checkbox');
            
            if (!todoInput) continue;
            
            const content = todoInput.value.trim();
            if (!content) continue;
            
            if (todoId) {
                // Update existing todo
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
                // Create new todo
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/todos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content }),
                    })
                );
            }
        }
        
        // Execute all operations in parallel
        const results = await Promise.allSettled(operations);
        
        // Check for any failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some card update operations failed:', failures);
            //('Warning', 'Card partially updated. Some operations failed.', 'warning');
        } else {
            //('Success', 'Card updated successfully', 'success');
        }
        
        // Reload cards for updated list and re-render
        await loadCards(activeBoard.id, listId);
        renderLists();
        
        closeAllModals();
    } catch (error) {
        console.error('Error updating card:', error);
        //('Error', 'Failed to update card. Please try again.', 'error');
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
        
    } catch (error) {
        console.error('Error deleting card:', error);
        //('Error', 'Failed to delete card. Please try again.', 'error');
        
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
        //('Error', 'Failed to update card status. Please try again.', 'error');
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
async function moveCardToList(cardId, sourceListId, targetListId, position = null) {
    try {
        const url = `${apiBaseUrl}/api/cards/${cardId}/move_to_list/${targetListId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to move card. Status: ${response.status}`);
        }
        
        // Reload lists to ensure data is in sync
        if (activeBoard) {
            await loadListsWithCards(activeBoard.id);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error moving card:', error);
        throw error;
    }
}

async function handleCardMove(cardId, sourceListId, targetListId) {
    try {
        console.log(`Moving card ${cardId} from list ${sourceListId} to list ${targetListId}`);
        
        // Get the card position in the target list
        const targetListCards = document.querySelectorAll(`.list-cards[data-list-id="${targetListId}"] .card`);
        const cardElement = document.querySelector(`.card[data-card-id="${cardId}"]`);
        
        // Calculate position for insertion
        let position = 0;
        if (targetListCards.length > 0) {
            // Find where the card is in the DOM to determine position
            const cardIndex = Array.from(targetListCards).indexOf(cardElement);
            if (cardIndex !== -1) {
                position = cardIndex;
            } else {
                // If not found, put at the end
                position = targetListCards.length;
            }
        }
        
        // Call the new backend endpoint
        const response = await fetch(`${apiBaseUrl}/api/cards/${cardId}/move_to_list/${targetListId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to move card. Status: ${response.status}`);
        }
        
        // Success - can leave UI as is since the card has already been moved in the DOM
    } catch (error) {
        console.error('Error moving card:', error);
        
        // Reload lists to ensure UI matches backend state
        if (activeBoard) {
            await loadLists(activeBoard.id);
        }
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
        
    } catch (error) {
        console.error('Error deleting todo:', error);
    }
}

// Исправленная функция для создания элемента списка
function createListElement(list) {
    const listElement = document.createElement('div');
    listElement.className = 'list';
    listElement.dataset.listId = list.id;
    
    // Добавляем хранение цвета, если он есть
    if (list.color) {
        listElement.dataset.color = list.color;
        listElement.dataset.textColor = list.textColor || 'black';
    }
    
    const listHeader = document.createElement('div');
    listHeader.className = 'list-header';
    
    // Применяем сохраненный цвет к заголовку
    if (list.color) {
        listHeader.style.backgroundColor = list.color;
        listHeader.style.color = list.textColor || 'black';
    }
    
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
    
    // Add handlers for list actions
    if (isAdmin) {
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
    }
    
    return { listElement, listHeader };
}
function renderLists() {
    const listsContainer = document.getElementById('listsContainer');
    
    // Clear container
    listsContainer.innerHTML = '';
    
    // Add lists
    lists.forEach(list => {
        // Create main list element
        const listElement = document.createElement('div');
        listElement.className = 'list';
        listElement.dataset.listId = list.id;
        
        // Apply color to list if it exists
        if (list.color) {
            listElement.dataset.color = list.color;
            listElement.dataset.textColor = list.textColor || 'black';
        }
        
        // Create list header
        const listHeader = document.createElement('div');
        listHeader.className = 'list-header';
        
        // Apply saved color to header
        if (list.color) {
            listHeader.style.backgroundColor = list.color;
            listHeader.style.color = list.textColor || 'black';
        }
        
        // Fill header
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
                    <button class="btn-delete" title="Delete list"><i class="fas fa-times"></i></button>
                </div>
            ` : ''}
        `;
        
        // Add event handlers for header buttons
        if (isAdmin) {
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
        }
        
        // Create cards container
        const listCards = document.createElement('div');
        listCards.className = 'list-cards';
        listCards.dataset.listId = list.id;
        
        // Enable drag-and-drop if admin
        if (isAdmin) {
            setupDropZone(listCards);
        }
        
        // Add cards to list
        if (list.cards && list.cards.length > 0) {
            // Sort cards by position if available
            if (list.cards[0].position !== undefined) {
                list.cards.sort((a, b) => a.position - b.position);
            }
            
            list.cards.forEach(card => {
                try {
                    const cardElement = createCardElement(card, list.id);
                    if (cardElement) {
                        listCards.appendChild(cardElement);
                    } else {
                        console.warn(`Card element could not be created for card ID ${card.id}`);
                    }
                } catch (err) {
                    console.error(`Error creating card element for card ${card.id}:`, err);
                }
            });
        }
        
        // Add header to list first
        listElement.appendChild(listHeader);
        
        // Then add cards container
        listElement.appendChild(listCards);
        
        // Create add card button (admin only)
        if (isAdmin) {
            const addCardBtn = document.createElement('button');
            addCardBtn.className = 'btn-add-card';
            addCardBtn.innerHTML = '<i class="fas fa-plus"></i> Add Card';
            addCardBtn.addEventListener('click', () => openCreateCardModal(list.id));
            
            // Add button to list
            listElement.appendChild(addCardBtn);
        }
        
        // Setup list dragging if admin
        if (isAdmin) {
            setupDraggableList(listElement);
        }
        
        // Add completed list to container
        listsContainer.appendChild(listElement);
    });
    
    // Add container for add list button (admin only)
    if (isAdmin) {
        const addListContainer = document.createElement('div');
        addListContainer.className = 'add-list-container';
        addListContainer.innerHTML = `
            <button id="addListBtn" class="btn-add-list">
                <i class="fas fa-plus"></i> Add List
            </button>
        `;
        
        // Add handler for add list button
        const addListBtn = addListContainer.querySelector('#addListBtn');
        if (addListBtn) {
            addListBtn.addEventListener('click', () => openModal(createListModal));
        }
        
        listsContainer.appendChild(addListContainer);
    }
    
    // Setup lists container for dragging
    if (isAdmin) {
        setupListsContainer();
    }
}


function createCardElement(card, listId) {
    if (!card || !listId) {
        console.error('Invalid card or listId provided to createCardElement');
        return null;
    }
    
    try {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${card.completed ? 'completed' : ''}`;
        cardElement.dataset.cardId = card.id;
        cardElement.dataset.listId = listId;
        cardElement.dataset.priority = card.priority || 'medium';
        cardElement.dataset.position = card.position || 0;
        
        // Get creator information - use creator_name from backend if available
        let creatorName = card.creator_name || 'Unknown User';
        
        // Fallback to looking up user if creator_name not available
        if (!card.creator_name && window.users && Array.isArray(window.users) && card.user_id) {
            const creator = window.users.find(user => user && user.id === card.user_id);
            if (creator) {
                creatorName = creator.username || creator.name || `User ${creator.id}`;
            }
        }
        
        // Format creation date - with error handling
        let creationDate = 'unknown date';
        try {
            if (card.created_at) {
                if (typeof formatDate === 'function') {
                    creationDate = formatDate(new Date(card.created_at));
                } else {
                    creationDate = new Date(card.created_at).toLocaleDateString();
                }
            }
        } catch (e) {
            console.error('Error formatting date:', e);
        }
        
        // Determine priority styling
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
        
        // Safely apply color priority class
        if (typeof useFullColorPriority !== 'undefined' && useFullColorPriority) {
            cardElement.classList.add(`full-color-priority-${card.priority || 'medium'}`);
        } else {
            cardElement.classList.add(`priority-${card.priority || 'medium'}`);
        }
        
        // Generate assignee HTML safely
        let assigneesHtml = '';
        
        if (card.assigned_users && Array.isArray(card.assigned_users) && card.assigned_users.length > 0) {
            // If we have multiple assigned users
            assigneesHtml = `<div class="assignees-container">`;
            
            // Create a group of avatars for up to 3 users
            assigneesHtml += `<div class="user-avatar-group">`;
            
            const displayedUsers = card.assigned_users.slice(0, 3);
            displayedUsers.forEach(user => {
                if (user) {
                    const initials = typeof getInitials === 'function' ? 
                        getInitials(user.username || user.name || '') : 
                        (user.username ? user.username.charAt(0).toUpperCase() : '?');
                    
                    assigneesHtml += `
                        <div class="user-avatar small" title="${user.username || user.name || 'User ' + user.id}">
                            ${initials}
                        </div>
                    `;
                }
            });
            
            // If there are more than 3 users, show a count
            if (card.assigned_users.length > 3) {
                assigneesHtml += `
                    <div class="user-avatar small more" title="${card.assigned_users.length - 3} more users">
                        +${card.assigned_users.length - 3}
                    </div>
                `;
            }
            
            assigneesHtml += `</div>`;
            
            // Add primary assignee name (first user)
            if (card.assigned_users[0]) {
                const primaryUser = card.assigned_users[0];
                assigneesHtml += `
                    <span class="assignee-name">${primaryUser.username || primaryUser.name || 'User ' + primaryUser.id}</span>
                `;
            }
            
            assigneesHtml += `</div>`;
        } else if (card.assigned_to) {
            // Use assigned_username provided by backend if available
            let assignedUsername = card.assigned_username;
            
            // Fallback to looking up user if assigned_username not available
            if (!assignedUsername && window.users && Array.isArray(window.users)) {
                const assignedUser = window.users.find(user => user && user.id === parseInt(card.assigned_to));
                if (assignedUser) {
                    assignedUsername = assignedUser.username || assignedUser.name || `User ${assignedUser.id}`;
                } else {
                    assignedUsername = 'Assigned User';
                }
            }
            
            // Generate avatar and name
            const initials = typeof getInitials === 'function' ? 
                getInitials(assignedUsername || '') : 
                (assignedUsername ? assignedUsername.charAt(0).toUpperCase() : '?');
            
            assigneesHtml = `
                <div class="user-badge" title="${assignedUsername}">
                    <div class="user-avatar">${initials}</div>
                    <span>${assignedUsername}</span>
                </div>
            `;
        }
        
        deadlineHtml = `
        <div class="deadline ${isOverdue ? 'overdue' : ''}" title="${formattedDateWithTime}">
            <a href="/calendar?highlight_deadline=${encodeURIComponent(deadline.toISOString())}" class="deadline-link">
                <i class="fas fa-calendar-alt"></i>
            </a>
            <span>${formattedDate}</span>
        </div>
    `;
    
        // Tasks/todos HTML
        let todosHtml = '';
        if (card.todos && Array.isArray(card.todos) && card.todos.length > 0) {
            const totalTodos = card.todos.length;
            const completedTodos = card.todos.filter(todo => todo.completed).length;
            
            const todoProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;
            
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
        
        // Build the card content with creator info
        cardElement.innerHTML = `
            <div class="card-header">
                <h4 class="card-title">${card.title || 'Untitled Card'}</h4>
                <div class="card-header-right">
                    <span class="badge ${priorityClass}">${priorityText}</span>
                </div>
            </div>
            <div class="creator-info">
                <small>Created by ${creatorName} on ${creationDate}</small>
            </div>
            ${card.description ? `<div class="card-description">${card.description}</div>` : ''}
            <div class="card-info">
                ${assigneesHtml}
                ${deadlineHtml}
                ${todosHtml}
            </div>
            <div class="card-actions">
                <button class="btn-toggle-completion" title="${card.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                    <i class="fas ${card.completed ? 'fa-check-square' : 'fa-square'}"></i>
                </button>
                ${typeof isAdmin !== 'undefined' && isAdmin ? `
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
        cardElement.addEventListener('click', (e) => {
            if (e.target.closest('.card-actions')) {
                return;
            }
            
            if (typeof isAdmin !== 'undefined' && isAdmin) {
                openEditCardModal(card.id, listId);
            } else if (typeof openUserTodoModal === 'function') {
                openUserTodoModal(card.id, card.title);
            }
        });
        
        const toggleButton = cardElement.querySelector('.btn-toggle-completion');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof handleToggleCardCompletion === 'function') {
                    handleToggleCardCompletion(card.id, listId, card.completed);
                }
            });
        }
        
        if (typeof isAdmin !== 'undefined' && isAdmin) {
            const editButton = cardElement.querySelector('.btn-edit-card');
            if (editButton) {
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof openEditCardModal === 'function') {
                        openEditCardModal(card.id, listId);
                    }
                });
            }
            
            const deleteButton = cardElement.querySelector('.btn-delete-card');
            if (deleteButton) {
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof handleDeleteCard === 'function') {
                        handleDeleteCard(card.id, listId);
                    }
                });
            }
        }
        
        // Enable dragging if admin
        if (typeof isAdmin !== 'undefined' && isAdmin && typeof setupDraggable === 'function') {
            setupDraggable(cardElement);
        }
        
        return cardElement;
    } catch (error) {
        console.error('Error in createCardElement:', error);
        return null; // Return null to avoid further errors
    }
}
function openCreateCardModal(listId) {
    // Save list ID in the form
    const createCardForm = document.getElementById('createCardForm');
    if (createCardForm) {
        createCardForm.dataset.listId = listId;
    }
    
    // Clear form fields
    document.getElementById('cardTitle').value = '';
    document.getElementById('cardDescription').value = '';
    document.getElementById('cardPriority').value = 'medium';
    
    // Handle single assignee dropdown if it exists
    const cardAssignee = document.getElementById('cardAssignee');
    if (cardAssignee) {
        cardAssignee.value = '';
        populateUserSelect(cardAssignee);
    }
    
    // Handle multi-select assignees if it exists
    const cardAssignees = document.getElementById('cardAssignees');
    if (cardAssignees) {
        // Clear selections
        Array.from(cardAssignees.options).forEach(option => {
            option.selected = false;
        });
        populateMultiSelect('cardAssignees');
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
    
    // Set up event handlers for task removal
    attachRemoveTodoHandlers();
    
    // Open modal
    openModal(createCardModal);
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

async function loadLists(boardId) {
    if (!boardId) {
        console.error('Board ID is required to load lists');
        return;
    }
    
    showLoading('listsLoading');
    try {
        console.log(`Fetching full data for board ${boardId}`);
        
        // Use the new comprehensive endpoint
        const response = await fetch(`${apiBaseUrl}/api/board/${boardId}/full_data`);
        
        if (!response.ok) {
            // Fallback to the old endpoint if the new one fails
            console.warn('New endpoint failed, trying fallback...');
            return await loadListsLegacy(boardId);
        }
        
        const data = await response.json();
        
        // Update lists and users from the response
        lists = data.lists;
        
        // If users array doesn't exist, create it
        if (!window.users) {
            window.users = [];
        }
        
        // Update users array with board users
        data.users.forEach(user => {
            const existingUserIndex = window.users.findIndex(u => u.id === user.id);
            if (existingUserIndex !== -1) {
                window.users[existingUserIndex] = user;
            } else {
                window.users.push(user);
            }
        });
        
        // Render the lists
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
        
        return data;
    } catch (error) {
        console.error(`Error loading board data: ${error}`);
        hideLoading('listsLoading');
        
        // Try legacy method as fallback
        return await loadListsLegacy(boardId);
    }
}
async function loadListsLegacy(boardId) {
    try {
        console.log(`Fetching lists for board ${boardId} (legacy method)`);
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
        
        return { lists, board: activeBoard };
    } catch (error) {
        console.error(`Error loading lists for board ${boardId}:`, error);
        hideLoading('listsLoading');
        return null;
    }
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


function getContrastColor(bgColor) {
    if (!bgColor) return '#000000';

    let r, g, b;
    
    if (bgColor.startsWith('#')) {
        if (bgColor.length === 4) {
            r = parseInt(bgColor.charAt(1) + bgColor.charAt(1), 16);
            g = parseInt(bgColor.charAt(2) + bgColor.charAt(2), 16);
            b = parseInt(bgColor.charAt(3) + bgColor.charAt(3), 16);
        } else {
            r = parseInt(bgColor.substring(1, 3), 16);
            g = parseInt(bgColor.substring(3, 5), 16);
            b = parseInt(bgColor.substring(5, 7), 16);
        }
    } else if (bgColor.startsWith('rgb')) {
        const rgbValues = bgColor.match(/\d+/g);
        if (rgbValues && rgbValues.length === 3) {
            r = parseInt(rgbValues[0]);
            g = parseInt(rgbValues[1]);
            b = parseInt(rgbValues[2]);
        } else {
            return '#000000';
        }
    } else {
        return '#000000';
    }
    
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 128 ? '#000000' : '#ffffff';
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




// In kanban.js, replace the existing color picker functions with these:

// Функция для определения контрастного цвета текста (черный или белый)
function getContrastYIQ(hexcolor) {
    if (!hexcolor) return 'black';
    
    // Если цвет начинается с #, удаляем его
    hexcolor = hexcolor.replace('#', '');
    
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    return (yiq >= 128) ? 'black' : 'white';
}

// Функция для создания модального окна выбора цвета списка
function createListColorModal() {
    // Удаляем старое модальное окно, если оно существует
    const oldModal = document.getElementById('listColorModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // Предопределенные цвета для списков с лучшими названиями и отображением
    const LIST_COLORS = [
        { name: 'Berry Red', value: '#b8255f', text: 'white' },
        { name: 'Red', value: '#db4035', text: 'white' },
        { name: 'Orange', value: '#ff9933', text: 'black' },
        { name: 'Yellow', value: '#fad000', text: 'black' },
        { name: 'Olive Green', value: '#afb83b', text: 'black' },
        { name: 'Lime Green', value: '#7ecc49', text: 'black' },
        { name: 'Green', value: '#299438', text: 'white' },
        { name: 'Mint Green', value: '#6accbc', text: 'black' },
        { name: 'Teal', value: '#158fad', text: 'white' },
        { name: 'Sky Blue', value: '#14aaf5', text: 'white' },
        { name: 'Light Blue', value: '#96c3eb', text: 'black' },
        { name: 'Blue', value: '#4073ff', text: 'white' },
        { name: 'Grape', value: '#884dff', text: 'white' },
        { name: 'Violet', value: '#af38eb', text: 'white' },
        { name: 'Lavender', value: '#eb96eb', text: 'black' },
        { name: 'Magenta', value: '#e05194', text: 'white' },
        { name: 'Salmon', value: '#ff8d85', text: 'black' },
        { name: 'Charcoal', value: '#808080', text: 'white' },
        { name: 'Grey', value: '#b8b8b8', text: 'black' },
        { name: 'Default', value: '#f0f2f5', text: 'black' }
    ];
    
    // Создаем модальное окно
    const colorModal = document.createElement('div');
    colorModal.id = 'listColorModal';
    colorModal.className = 'modal';
    
    // Создаем содержимое модального окна с улучшенным внешним видом
    colorModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>Выберите цвет списка</h2>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="color-picker-container" style="padding: 16px;">
                <div class="color-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;">
                    ${LIST_COLORS.map(color => `
                        <div class="color-option" data-color="${color.value}" data-text="${color.text}" 
                             style="background-color: ${color.value}; color: ${color.text}; 
                                   height: 48px; border-radius: 6px; cursor: pointer; 
                                   display: flex; align-items: center; justify-content: center; 
                                   box-shadow: 0 2px 5px rgba(0,0,0,0.15); font-size: 12px;
                                   transition: transform 0.2s, box-shadow 0.2s;"
                             onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)';"
                             onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 5px rgba(0,0,0,0.15)';">
                            ${color.name}
                        </div>
                    `).join('')}
                </div>
                <div class="custom-color-section" style="margin-top: 16px; border-top: 1px solid #eee; padding-top: 16px;">
                    <label for="customColorPicker" style="display: block; margin-bottom: 8px; font-weight: 500;">Выберите свой цвет:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="color" id="customColorPicker" style="width: 100px; height: 40px;">
                        <button id="applyCustomColor" class="btn btn-primary" style="flex: 1;">Применить</button>
                    </div>
                </div>
                <div id="colorPreview" style="margin-top: 16px; padding: 16px; border-radius: 6px; border: 1px solid #ddd; display: none;">
                    <h3>Предпросмотр</h3>
                    <div id="previewHeader" style="padding: 10px; border-radius: 4px; margin-top: 8px; font-weight: 500;">
                        Заголовок списка
                    </div>
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
    
    // Обработчик выбора предустановленного цвета
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
        
        // Показываем предпросмотр при наведении
        option.addEventListener('mouseover', () => {
            const preview = document.getElementById('colorPreview');
            const previewHeader = document.getElementById('previewHeader');
            
            preview.style.display = 'block';
            previewHeader.style.backgroundColor = option.dataset.color;
            previewHeader.style.color = option.dataset.text;
        });
    });
    
    // Обработчик для пользовательского цвета
    const customColorPicker = document.getElementById('customColorPicker');
    const applyCustomColor = document.getElementById('applyCustomColor');
    
    customColorPicker.addEventListener('input', () => {
        const preview = document.getElementById('colorPreview');
        const previewHeader = document.getElementById('previewHeader');
        
        preview.style.display = 'block';
        previewHeader.style.backgroundColor = customColorPicker.value;
        
        // Определяем контрастный текст для выбранного цвета
        const textColor = getContrastYIQ(customColorPicker.value);
        previewHeader.style.color = textColor;
    });
    
    applyCustomColor.addEventListener('click', () => {
        const listId = colorModal.dataset.listId;
        const color = customColorPicker.value;
        
        // Определяем контрастный текст для выбранного цвета
        const textColor = getContrastYIQ(color);
        
        if (listId && color) {
            setListColor(listId, color, textColor);
            colorModal.classList.remove('active');
        }
    });
    
    // Закрытие при клике вне модального окна
    colorModal.addEventListener('click', (e) => {
        if (e.target === colorModal) {
            colorModal.classList.remove('active');
        }
    });
    
    return colorModal;
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

async function setListColor(listId, color, textColor) {
    if (!activeBoard) return;

    // Обновляем UI
    const listElement = document.querySelector(`.list[data-list-id="${listId}"]`);
    if (listElement) {
        const headerElement = listElement.querySelector('.list-header');
        if (headerElement) {
            if (color) {
                headerElement.style.backgroundColor = color;
                headerElement.style.color = textColor || getContrastColor(color);
                
                // Показываем индикатор цвета
                const colorIndicator = listElement.querySelector('.list-color-indicator');
                if (colorIndicator) {
                    colorIndicator.style.backgroundColor = color;
                    colorIndicator.style.display = 'block';
                }
                
                // Сохраняем цвета в dataset
                listElement.dataset.color = color;
                listElement.dataset.textColor = textColor || getContrastColor(color);
            } else {
                // Сбрасываем на значения по умолчанию
                headerElement.style.backgroundColor = '';
                headerElement.style.color = '';
                
                // Скрываем индикатор цвета
                const colorIndicator = listElement.querySelector('.list-color-indicator');
                if (colorIndicator) {
                    colorIndicator.style.display = 'none';
                }
                
                // Удаляем из dataset
                delete listElement.dataset.color;
                delete listElement.dataset.textColor;
            }
        }
    }

    // Обновляем в памяти и сохраняем на сервере
    const listIndex = lists.findIndex(list => list.id === parseInt(listId));
    if (listIndex !== -1) {
        lists[listIndex].color = color;
        lists[listIndex].textColor = textColor || (color ? getContrastColor(color) : null);
        
        try {
            const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/color`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    color: color,
                    text_color: textColor || (color ? getContrastColor(color) : null)
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save list color. Status: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Error saving list color:', error);
        }
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
        //('Error', 'Failed to save list color', 'error');
    });
}








// Обновленные стили для перетаскивания
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
        
        .list-header {
            cursor: grab;
        }
        
        .list-header:active {
            cursor: grabbing;
        }
        
        .list-drop-indicator {
            position: absolute;
            background-color: rgba(66, 153, 225, 0.3);
            border: 2px dashed #4299e1;
            pointer-events: none;
            display: none;
            z-index: 1001;
        }
    `;
    document.head.appendChild(style);
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
function createImprovedListColorModal() {
    // Удаляем старое модальное окно, если оно существует
    const oldModal = document.getElementById('listColorModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // Предопределенные цвета для списков с лучшими названиями и отображением
    const LIST_COLORS = [
        { name: 'Berry Red', value: '#b8255f', text: 'white' },
        { name: 'Red', value: '#db4035', text: 'white' },
        { name: 'Orange', value: '#ff9933', text: 'black' },
        { name: 'Yellow', value: '#fad000', text: 'black' },
        { name: 'Olive Green', value: '#afb83b', text: 'black' },
        { name: 'Lime Green', value: '#7ecc49', text: 'black' },
        { name: 'Green', value: '#299438', text: 'white' },
        { name: 'Mint Green', value: '#6accbc', text: 'black' },
        { name: 'Teal', value: '#158fad', text: 'white' },
        { name: 'Sky Blue', value: '#14aaf5', text: 'white' },
        { name: 'Light Blue', value: '#96c3eb', text: 'black' },
        { name: 'Blue', value: '#4073ff', text: 'white' },
        { name: 'Grape', value: '#884dff', text: 'white' },
        { name: 'Violet', value: '#af38eb', text: 'white' },
        { name: 'Lavender', value: '#eb96eb', text: 'black' },
        { name: 'Magenta', value: '#e05194', text: 'white' },
        { name: 'Salmon', value: '#ff8d85', text: 'black' },
        { name: 'Charcoal', value: '#808080', text: 'white' },
        { name: 'Grey', value: '#b8b8b8', text: 'black' },
        { name: 'Default', value: '#f0f2f5', text: 'black' }
    ];
    
    // Создаем модальное окно
    const colorModal = document.createElement('div');
    colorModal.id = 'listColorModal';
    colorModal.className = 'modal';
    
    // Создаем содержимое модального окна с улучшенным внешним видом
    colorModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>Выберите цвет списка</h2>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="color-picker-container" style="padding: 16px;">
                <div class="color-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;">
                    ${LIST_COLORS.map(color => `
                        <div class="color-option" data-color="${color.value}" data-text="${color.text}" 
                             style="background-color: ${color.value}; color: ${color.text}; 
                                   height: 48px; border-radius: 6px; cursor: pointer; 
                                   display: flex; align-items: center; justify-content: center; 
                                   box-shadow: 0 2px 5px rgba(0,0,0,0.15); font-size: 12px;
                                   transition: transform 0.2s, box-shadow 0.2s;"
                             onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)';"
                             onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 5px rgba(0,0,0,0.15)';">
                            ${color.name}
                        </div>
                    `).join('')}
                </div>
                <div class="custom-color-section" style="margin-top: 16px; border-top: 1px solid #eee; padding-top: 16px;">
                    <label for="customColorPicker" style="display: block; margin-bottom: 8px; font-weight: 500;">Выберите свой цвет:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="color" id="customColorPicker" style="width: 100px; height: 40px;">
                        <button id="applyCustomColor" class="btn btn-primary" style="flex: 1;">Применить</button>
                    </div>
                </div>
                <div id="colorPreview" style="margin-top: 16px; padding: 16px; border-radius: 6px; border: 1px solid #ddd; display: none;">
                    <h3>Предпросмотр</h3>
                    <div id="previewHeader" style="padding: 10px; border-radius: 4px; margin-top: 8px; font-weight: 500;">
                        Заголовок списка
                    </div>
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
    
    // Обработчик выбора предустановленного цвета
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
        
        // Показываем предпросмотр при наведении
        option.addEventListener('mouseover', () => {
            const preview = document.getElementById('colorPreview');
            const previewHeader = document.getElementById('previewHeader');
            
            preview.style.display = 'block';
            previewHeader.style.backgroundColor = option.dataset.color;
            previewHeader.style.color = option.dataset.text;
        });
    });
    
    // Обработчик для пользовательского цвета
    const customColorPicker = document.getElementById('customColorPicker');
    const applyCustomColor = document.getElementById('applyCustomColor');
    
    customColorPicker.addEventListener('input', () => {
        const preview = document.getElementById('colorPreview');
        const previewHeader = document.getElementById('previewHeader');
        
        preview.style.display = 'block';
        previewHeader.style.backgroundColor = customColorPicker.value;
        
        // Определяем контрастный текст для выбранного цвета
        const textColor = getContrastYIQ(customColorPicker.value);
        previewHeader.style.color = textColor;
    });
    
    applyCustomColor.addEventListener('click', () => {
        const listId = colorModal.dataset.listId;
        const color = customColorPicker.value;
        
        // Определяем контрастный текст для выбранного цвета
        const textColor = getContrastYIQ(color);
        
        if (listId && color) {
            setListColor(listId, color, textColor);
            colorModal.classList.remove('active');
        }
    });
    
    // Закрытие при клике вне модального окна
    colorModal.addEventListener('click', (e) => {
        if (e.target === colorModal) {
            colorModal.classList.remove('active');
        }
    });
    
    return colorModal;
}
// Функция для определения контрастного цвета текста (черный или белый)
function getContrastYIQ(hexcolor) {
    if (!hexcolor) return 'black';
    
    // Если цвет начинается с #, удаляем его
    hexcolor = hexcolor.replace('#', '');
    
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    return (yiq >= 128) ? 'black' : 'white';
}

// Функция для открытия улучшенного модального окна выбора цвета
function openImprovedListColorPicker(listId) {
    const colorModal = createImprovedListColorModal();
    colorModal.dataset.listId = listId;
    colorModal.classList.add('active');
}
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
    
    // Handle assignees - check both multi-select and single select
    const multiAssigneesElement = document.getElementById('editCardAssignees');
    if (multiAssigneesElement) {
        // Clear selections first
        Array.from(multiAssigneesElement.options).forEach(option => {
            option.selected = false;
        });
        
        // Populate with users
        populateMultiSelect('editCardAssignees');
        
        // Set selections based on assigned_users if available
        if (card.assigned_users && card.assigned_users.length > 0) {
            const assignedIds = card.assigned_users.map(user => user.id);
            
            Array.from(multiAssigneesElement.options).forEach(option => {
                if (assignedIds.includes(parseInt(option.value))) {
                    option.selected = true;
                }
            });
        } else if (card.assigned_to) {
            // Fallback to single assigned_to
            Array.from(multiAssigneesElement.options).forEach(option => {
                if (parseInt(option.value) === card.assigned_to) {
                    option.selected = true;
                }
            });
        }
    } else {
        // Handle single select assignee if that's what we have
        const assigneeElement = document.getElementById('editCardAssignee');
        if (assigneeElement) {
            assigneeElement.value = card.assigned_to ? card.assigned_to.toString() : '';
            populateUserSelect(assigneeElement);
        }
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


    // Load data in correct sequence
    fetchAllUsers().then(() => {
        loadBoards().then(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const boardIdFromUrl = urlParams.get('board_id');
            
            if (boardIdFromUrl) {
                const boardToSelect = boards.find(board => board.id === parseInt(boardIdFromUrl));
                if (boardToSelect) {
                    selectBoard(boardToSelect);
                } else if (boards.length > 0) {
                    selectBoard(boards[0]);
                }
            } else if (boards.length > 0) {
                selectBoard(boards[0]);
            }
        });
    });

    // Add drag-and-drop styles
    addDragAndDropStyles();
    
    // Add highlight styles for cards
    addHighlightStyles();

    // Ensure board items are clickable using event delegation
    document.getElementById('boardsList').addEventListener('click', function(e) {
        const boardItem = e.target.closest('.board-item');
        if (boardItem && !e.target.closest('.btn-edit-board') && !e.target.closest('.btn-delete-board')) {
            const boardId = parseInt(boardItem.dataset.boardId);
            const board = boards.find(b => b.id === boardId);
            if (board) {
                selectBoard(board);
                return;
            }
        }
        
        const editBtn = e.target.closest('.btn-edit-board');
        if (editBtn) {
            e.stopPropagation();
            const boardItem = editBtn.closest('.board-item');
            const boardId = parseInt(boardItem.dataset.boardId);
            const board = boards.find(b => b.id === boardId);
            if (board) {
                activeBoard = board;
                openEditBoardModal();
            }
        }
        
        const deleteBtn = e.target.closest('.btn-delete-board');
        if (deleteBtn) {
            e.stopPropagation();
            const boardItem = deleteBtn.closest('.board-item');
            const boardId = parseInt(boardItem.dataset.boardId);
            const board = boards.find(b => b.id === boardId);
            if (board) {
                activeBoard = board;
                handleDeleteBoard();
            }
        }
    });
};
// Добавьте этот код в конец файла kanban.js или в функцию, выполняемую после загрузки DOM
document.getElementById('boardsList').addEventListener('click', function(e) {
    const boardItem = e.target.closest('.board-item');
    if (boardItem && !e.target.closest('.btn-edit-board') && !e.target.closest('.btn-delete-board')) {
        const boardId = parseInt(boardItem.dataset.boardId);
        const board = boards.find(b => b.id === boardId);
        if (board) {
            selectBoard(board);
            return;
        }
    }
    
    const editBtn = e.target.closest('.btn-edit-board');
    if (editBtn) {
        e.stopPropagation();
        const boardItem = editBtn.closest('.board-item');
        const boardId = parseInt(boardItem.dataset.boardId);
        const board = boards.find(b => b.id === boardId);
        if (board) {
            activeBoard = board;
            openEditBoardModal();
        }
    }
    
    const deleteBtn = e.target.closest('.btn-delete-board');
    if (deleteBtn) {
        e.stopPropagation();
        const boardItem = deleteBtn.closest('.board-item');
        const boardId = parseInt(boardItem.dataset.boardId);
        const board = boards.find(b => b.id === boardId);
        if (board) {
            activeBoard = board;
            handleDeleteBoard();
        }
    }
});
// Экспортировать основные функции в глобальное пространство имен
window.loadLists = loadLists;
window.loadCards = loadCards;
window.renderLists = renderLists;
window.createCardElement = createCardElement;
window.selectBoard = selectBoard;
window.// = //;
window.addTodoItem = addTodoItem;
window.getTodoItems = getTodoItems;
window.openModal = openModal;
window.closeAllModals = closeAllModals;