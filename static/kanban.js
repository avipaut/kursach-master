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
                </div>
            `).join('');
        });
}

function openBoard(boardId, boardName) {
    // Update active state in sidebar
    document.querySelectorAll('.board-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.board-item[onclick*="${boardId}"]`).classList.add('active');

    // Show board view
    const boardView = document.getElementById('board-view');
    boardView.classList.add('active');
    boardView.innerHTML = `
        <div class="board-header">
            <h2 class="board-title">${boardName}</h2>
            <button onclick="deleteBoard(${boardId})" class="delete-btn">Удалить доску</button>
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


function deleteBoard(boardId) {
    if (!confirm("Вы уверены, что хотите удалить эту доску?")) return;
    
    fetch(`/kanban/boards/${boardId}`, { method: "DELETE" })
        .then(() => loadBoards());
}

function loadLists(boardId) {
    fetch(`/kanban/boards/${boardId}/lists`)
        .then(response => response.json())
        .then(lists => {
            const container = document.getElementById(`lists-container-${boardId}`);
            container.innerHTML = lists.map(list => `
                <div class="list" data-list-id="${list.id}" ondrop="dropCard(event)" ondragover="allowDrop(event)">
                    <h4>${list.name}</h4>
                    <button onclick="deleteList(${boardId}, ${list.id})" class="delete-btn">Удалить</button>
                    <div id="cards-container-${list.id}" class="cards-container"></div>
                    <div class="card-creation">
                        <input type="text" id="cardTitle-${list.id}" placeholder="Название карточки">
                        <button onclick="createCard(${boardId}, ${list.id})">Добавить</button>
                    </div>
                </div>
            `).join('');
            
            lists.forEach(list => loadCards(boardId, list.id));
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

// function loadCards(boardId, listId) {
//     fetch(`/kanban/boards/${boardId}/lists/${listId}/cards`)
//         .then(response => response.json())
//         .then(cards => {
//             const container = document.getElementById(`cards-container-${listId}`);
//             container.innerHTML = cards.map(card => `
//                 <div class="card" 
//                      draggable="true" 
//                      ondragstart="dragStart(event)" 
//                      ondragend="dragEnd(event)"
//                      data-card-id="${card.id}" 
//                      data-list-id="${listId}" 
//                      data-board-id="${boardId}">
//                     <p>${card.title}</p>
//                     <button onclick="deleteCard(${boardId}, ${listId}, ${card.id})" class="delete-btn">Удалить</button>
//                 </div>
//             `).join('');
//         });
// }
function loadCards(boardId, listId) {
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards`)
        .then(response => response.json())
        .then(cards => {
            const container = document.getElementById(`cards-container-${listId}`);
            container.innerHTML = cards.map(card => `
                <div class="card" 
                     draggable="true" 
                     ondragstart="dragStart(event)" 
                     ondragend="dragEnd(event)"
                     data-card-id="${card.id}" 
                     data-list-id="${listId}" 
                     data-board-id="${boardId}">
                    <p>${card.title}</p>
                    <div class="card-description">${card.description}</div>
                    <div class="card-user">
                        <strong>Создатель: </strong>${card.createdBy}  <!-- Добавляем имя пользователя -->
                    </div>
                    <div class="priority-select">
                        <label for="priority-${card.id}">Приоритет:</label>
                        <select id="priority-${card.id}" onchange="updateCardPriority(${boardId}, ${listId}, ${card.id}, this)">
                            <option value="low" ${card.priority === "low" ? "selected" : ""}>Низкий</option>
                            <option value="medium" ${card.priority === "medium" ? "selected" : ""}>Средний</option>
                            <option value="high" ${card.priority === "high" ? "selected" : ""}>Высокий</option>
                        </select>
                    </div>
                    <button onclick="deleteCard(${boardId}, ${listId}, ${card.id})" class="delete-btn">Удалить</button>
                </div>
            `).join('');
        });
}

function updateCardPriority(boardId, listId, cardId, selectElement) {
    const priority = selectElement.value;
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards/${cardId}/priority`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority })
    })
    .then(response => {
        if (response.ok) {
            // Обновляем стиль карточки в зависимости от выбранного приоритета
            const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
            card.classList.remove('low', 'medium', 'high');
            card.classList.add(priority);
        }
    });
}

// kanban.js
function createCard(boardId, listId) {
    const cardTitle = document.getElementById(`cardTitle-${listId}`).value;
    if (!cardTitle.trim()) {
        alert("Пожалуйста, введите название карточки");
        return;
    }
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: cardTitle,
            priority: 'low' // Устанавливаем начальный приоритет
        })
    })
    .then(response => response.json())
    .then(() => {
        document.getElementById(`cardTitle-${listId}`).value = "";
        loadCards(boardId, listId);
    });
}


function deleteCard(boardId, listId, cardId) {
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

function updateCardPriority(boardId, listId, cardId, selectElement) {
    const priority = selectElement.value;
    
    fetch(`/kanban/boards/${boardId}/lists/${listId}/cards/${cardId}/priority`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority })
    })
    .then(response => {
        if (response.ok) {
            // Обновляем стиль карточки
            const card = selectElement.closest('.card');
            card.className = `card ${priority}`;
        }
    });
}