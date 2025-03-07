document.addEventListener("DOMContentLoaded", function () {
    initializeSidebar();
});



function initializeSidebar() {
    // Create sidebar structure
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <h2 class="sidebar-title">Kanban Доски</h2>
            <div class="create-board-section">
                <input type="text" id="boardName" placeholder="Название новой доски">
                <button onclick="createBoard()">Создать</button>
            </div>
        </div>
        <div id="board-list" class="board-list"></div>
    `;

    // Create main content area
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    mainContent.innerHTML = '<div id="board-view" class="board-view"></div>';

    // Add to document
    document.body.appendChild(sidebar);
    document.body.appendChild(mainContent);

    // Create modal container for card creation and editing
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    modalContainer.className = 'modal-container';
    document.body.appendChild(modalContainer);

    // Load boards
    loadBoards();
}

function loadBoards() {
    fetch("/kanban/boards")
        .then(response => response.json())
        .then(boards => {
            const boardList = document.getElementById("board-list");
            boardList.innerHTML = boards.map(board => `
                <div class="board-item" onclick="openBoard(${board.id}, '${board.name}')">
                    <div class="board-icon">${board.name[0]}</div>
                    <span>${board.name}</span>
                    <div class="board-actions">
                        <button onclick="showEditBoardModal(event, ${board.id}, '${board.name}')" class="edit-btn">✏️</button>
                    </div>
                </div>
            `).join('');
        });
}

function openBoard(boardId, boardName) {
    // Update active state in sidebar
    document.querySelectorAll('.board-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.board-item[onclick*="${boardId}"]`).classList.add('active');
    document.querySelector('.welcome-message')?.remove();

    // Show board view
    const boardView = document.getElementById('board-view');
    boardView.classList.add('active');
    boardView.innerHTML = `
    <div class="board-header">
        <h2 class="board-title">${boardName}</h2>
        <div class="board-actions">
            <button onclick="showEditBoardModal(event, ${boardId}, '${boardName}')" class="edit-btn">Редактировать</button>
            <button onclick="deleteBoard(${boardId})" class="delete-btn">Удалить доску</button>
            <button onclick="closeBoard()" class="close-btn">Закрыть доску</button>
        </div>
    </div>
    <div id="lists-container-${boardId}" class="lists-wrapper"></div>
    <div class="create-list-section" style="margin-top: 1rem;">
        <input type="text" id="listName-${boardId}" placeholder="Название нового списка">
        <button onclick="createList(${boardId})">Добавить список</button>
    </div>
`;

    loadLists(boardId);
}

function createBoard() {
    const boardName = document.getElementById("boardName").value;
    if (!boardName.trim()) {
        alert("Пожалуйста, введите название доски");
        return;
    }
    
    fetch("/kanban/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: boardName })
    })
    .then(response => response.json())
    .then(board => {
        document.getElementById("boardName").value = "";
        loadBoards();
        openBoard(board.id, board.name);
    });
}

function showEditBoardModal(event, boardId, boardName) {
    event.stopPropagation(); // Prevent openBoard from being triggered
    
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-content">
                <h3>Редактировать доску</h3>
                <input type="text" id="edit-board-name" value="${boardName}" placeholder="Название доски">
                <div class="modal-actions">
                    <button onclick="updateBoard(${boardId})">Сохранить</button>
                    <button onclick="closeModal()">Отмена</button>
                </div>
            </div>
        </div>
    `;
    
    modalContainer.classList.add('active');
}

function updateBoard(boardId) {
    const boardName = document.getElementById("edit-board-name").value;
    if (!boardName.trim()) {
        alert("Пожалуйста, введите название доски");
        return;
    }
    
    fetch(`/kanban/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: boardName })
    })
    .then(response => response.json())
    .then(board => {
        closeModal();
        loadBoards();
        
        // Update current board view if open
        const boardView = document.getElementById('board-view');
        if (boardView.classList.contains('active')) {
            const currentBoardId = boardView.querySelector('.lists-wrapper').id.split('-')[2];
            if (parseInt(currentBoardId) === boardId) {
                openBoard(boardId, boardName);
            }
        }
    });
}

function deleteBoard(boardId) {
    if (!confirm("Вы уверены, что хотите удалить эту доску?")) return;
    
    fetch(`/kanban/boards/${boardId}`, { method: "DELETE" })
        .then(() => {
            loadBoards();
            // Clear board view
            document.getElementById('board-view').classList.remove('active');
        });
}

function loadLists(boardId) {
    fetch(`/kanban/boards/${boardId}/lists`)
        .then(response => response.json())
        .then(lists => {
            const container = document.getElementById(`lists-container-${boardId}`);
            container.innerHTML = lists.map(list => `
                <div class="list" data-list-id="${list.id}" ondrop="dropCard(event)" ondragover="allowDrop(event)">
                    <div class="list-header">
                        <h4>${list.name}</h4>
                        <div class="list-actions">
                            <button onclick="showEditListModal(${boardId}, ${list.id}, '${list.name}')" class="edit-btn">✏️</button>
                            <button onclick="deleteList(${boardId}, ${list.id})" class="delete-btn">✖</button>
                        </div>
                    </div>
                    <div id="cards-container-${list.id}" class="cards-container"></div>
                    <div class="card-creation">
                        <button onclick="showCreateCardModal(${boardId}, ${list.id})" class="add-card-btn">+ Добавить карточку</button>
                    </div>
                </div>
            `).join('');
            
            lists.forEach(list => loadCards(boardId, list.id));
        });
}

function showEditListModal(boardId, listId, listName) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-content">
                <h3>Редактировать список</h3>
                <input type="text" id="edit-list-name" value="${listName}" placeholder="Название списка">
                <div class="modal-actions">
                    <button onclick="updateList(${boardId}, ${listId})">Сохранить</button>
                    <button onclick="closeModal()">Отмена</button>
                </div>
            </div>
        </div>
    `;
    
    modalContainer.classList.add('active');
}

function updateList(boardId, listId) {
    const listName = document.getElementById("edit-list-name").value;
    if (!listName.trim()) {
        alert("Пожалуйста, введите название списка");
        return;
    }
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: listName })
    })
    .then(response => response.json())
    .then(() => {
        closeModal();
        loadLists(boardId);
    });
}

function createList(boardId) {
    const listName = document.getElementById(`listName-${boardId}`).value;
    if (!listName.trim()) {
        alert("Пожалуйста, введите название списка");
        return;
    }
    
    fetch(`/kanban/boards/${boardId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: listName })
    })
    .then(response => response.json())
    .then(() => {
        document.getElementById(`listName-${boardId}`).value = "";
        loadLists(boardId);
    });
}

function deleteList(boardId, listId) {
    if (!confirm("Вы уверены, что хотите удалить этот список?")) return;
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}`, { method: "DELETE" })
        .then(() => loadLists(boardId));
}

function loadCards(boardId, listId) {
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards`)
        .then(response => response.json())
        .then(cards => {
            const container = document.getElementById(`cards-container-${listId}`);
            container.innerHTML = cards.map(card => `
                <div class="card ${card.priority}" 
                     draggable="true" 
                     ondragstart="dragStart(event)" 
                     ondragend="dragEnd(event)"
                     data-card-id="${card.id}" 
                     data-list-id="${listId}" 
                     data-board-id="${boardId}">
                    <div class="card-header">
                        <h5>${card.title}</h5>
                        <div class="card-actions">
                            <button onclick="showEditCardModal(event, ${boardId}, ${listId}, ${card.id})" class="edit-btn">✏️</button>
                            <button onclick="deleteCard(event, ${boardId}, ${listId}, ${card.id})" class="delete-btn">✖</button>
                        </div>
                    </div>
                    <div class="card-description">${card.description || ''}</div>
                    <div class="card-footer">
                        <div class="card-user">
                            <strong>Создатель:</strong> ${card.createdBy}
                        </div>
                        <div class="priority-tag ${card.priority}">
                            ${getPriorityLabel(card.priority)}
                        </div>
                    </div>
                </div>
            `).join('');
        });
}

function getPriorityLabel(priority) {
    switch(priority) {
        case 'low': return 'Низкий';
        case 'medium': return 'Средний';
        case 'high': return 'Высокий';
        default: return 'Не задан';
    }
}

function showCreateCardModal(boardId, listId) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-content">
                <h3>Создать новую карточку</h3>
                <div class="form-group">
                    <label for="card-title">Название</label>
                    <input type="text" id="card-title" placeholder="Название карточки">
                </div>
                <div class="form-group">
                    <label for="card-description">Описание</label>
                    <textarea id="card-description" placeholder="Описание карточки"></textarea>
                </div>
                <div class="form-group">
                    <label for="card-priority">Приоритет</label>
                    <select id="card-priority">
                        <option value="low">Низкий</option>
                        <option value="medium">Средний</option>
                        <option value="high">Высокий</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button onclick="createCard(${boardId}, ${listId})">Создать</button>
                    <button onclick="closeModal()">Отмена</button>
                </div>
            </div>
        </div>
    `;
    
    modalContainer.classList.add('active');
}

function showEditCardModal(event, boardId, listId, cardId) {
    event.stopPropagation();
    
    // Получаем данные карточки
    const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
    const title = card.querySelector('h5').textContent;
    const description = card.querySelector('.card-description').textContent;
    const priority = card.classList[1]; // Второй класс должен быть приоритетом
    
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-content">
                <h3>Редактировать карточку</h3>
                <div class="form-group">
                    <label for="edit-card-title">Название</label>
                    <input type="text" id="edit-card-title" value="${title}" placeholder="Название карточки">
                </div>
                <div class="form-group">
                    <label for="edit-card-description">Описание</label>
                    <textarea id="edit-card-description" placeholder="Описание карточки">${description}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-card-priority">Приоритет</label>
                    <select id="edit-card-priority">
                        <option value="low" ${priority === 'low' ? 'selected' : ''}>Низкий</option>
                        <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Средний</option>
                        <option value="high" ${priority === 'high' ? 'selected' : ''}>Высокий</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button onclick="updateCard(${boardId}, ${listId}, ${cardId})">Сохранить</button>
                    <button onclick="closeModal()">Отмена</button>
                </div>
            </div>
        </div>
    `;
    
    modalContainer.classList.add('active');
}

function closeModal() {
    document.getElementById('modal-container').classList.remove('active');
}
function closeBoard() {
    // Очистить активное состояние в боковой панели
    document.querySelectorAll('.board-item').forEach(item => item.classList.remove('active'));
    
    // Скрыть представление доски
    const boardView = document.getElementById('board-view');
    boardView.classList.remove('active');
    
    // Показать приветственный экран или пустое состояние
    const mainContent = document.querySelector('.main-content');
    if (!document.querySelector('.welcome-container')) {
        const welcomeContainer = document.createElement('div');
        welcomeContainer.className = 'welcome-container';
        welcomeContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Добро пожаловать в Kanban</h2>
                <p>Выберите доску из списка или создайте новую</p>
            </div>
        `;
        mainContent.appendChild(welcomeContainer);
    }
}

function createCard(boardId, listId) {
    const cardTitle = document.getElementById('card-title').value;
    const cardDescription = document.getElementById('card-description').value;
    const cardPriority = document.getElementById('card-priority').value;
    
    if (!cardTitle.trim()) {
        alert("Пожалуйста, введите название карточки");
        return;
    }
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: cardTitle,
            description: cardDescription,
            priority: cardPriority
        })
    })
    .then(response => response.json())
    .then(() => {
        closeModal();
        loadCards(boardId, listId);
    });
}

function updateCard(boardId, listId, cardId) {
    const cardTitle = document.getElementById('edit-card-title').value;
    const cardDescription = document.getElementById('edit-card-description').value;
    const cardPriority = document.getElementById('edit-card-priority').value;
    
    if (!cardTitle.trim()) {
        alert("Пожалуйста, введите название карточки");
        return;
    }
    
    // Обновление данных карточки
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: cardTitle,
            description: cardDescription
        })
    })
    .then(response => response.json())
    .then(() => {
        // Обновление приоритета карточки
        fetch(`/kanban/boards/${boardId}/lists/${listId}/cards/${cardId}/priority`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: cardPriority })
        })
        .then(() => {
            closeModal();
            loadCards(boardId, listId);
        });
    });
}

function deleteCard(event, boardId, listId, cardId) {
    event.stopPropagation();
    
    if (!confirm("Вы уверены, что хотите удалить эту карточку?")) return;
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards/${cardId}`, { method: "DELETE" })
        .then(() => loadCards(boardId, listId));
}

// Drag and Drop Functions
function dragStart(event) {
    const card = event.target;
    card.classList.add('dragging');
    event.dataTransfer.setData('text/plain', JSON.stringify({
        cardId: card.dataset.cardId,
        sourceListId: card.dataset.listId,
        boardId: card.dataset.boardId
    }));
}

function dragEnd(event) {
    event.target.classList.remove('dragging');
}

function allowDrop(event) {
    event.preventDefault();
    const list = event.target.closest('.list');
    if (list) {
        list.classList.add('drag-over');
    }
}

function dropCard(event) {
    event.preventDefault();
    const list = event.target.closest('.list');
    list.classList.remove('drag-over');
    
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const targetListId = list.dataset.listId;
    
    if (data.sourceListId !== targetListId) {
        // Move card to new list
        fetch(`/kanban/boards/${data.boardId}/lists/${data.sourceListId}/cards/${data.cardId}/move/${targetListId}`, {
            method: 'PUT'
        })
        .then(response => {
            if (response.ok) {
                // Reload cards in both source and target lists
                loadCards(data.boardId, data.sourceListId);
                loadCards(data.boardId, targetListId);
            }
        });
    }
}