
// Глобальные переменные
let boards = [];
let activeBoard = null;
let lists = [];
let users = [];
let apiBaseUrl = '';

// DOM элементы для модальных окон
const createBoardModal = document.getElementById('createBoardModal');
const editBoardModal = document.getElementById('editBoardModal');
const createListModal = document.getElementById('createListModal');
const editListModal = document.getElementById('editListModal');
const createCardModal = document.getElementById('createCardModal');
const editCardModal = document.getElementById('editCardModal');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Установка базового URL для API
    apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
    console.log('API base URL set to:', apiBaseUrl);

    // Загрузка начальных данных
    fetchAllUsers();
    loadBoards();

    // Обработчики событий для создания досок
    document.getElementById('createBoardBtn').addEventListener('click', () => openModal(createBoardModal));
    document.getElementById('createBoardForm').addEventListener('submit', handleCreateBoard);

    // Обработчики событий для редактирования досок
    document.getElementById('editBoardBtn').addEventListener('click', () => openEditBoardModal());
    document.getElementById('editBoardForm').addEventListener('submit', handleEditBoard);
    document.getElementById('deleteBoardBtn').addEventListener('click', () => handleDeleteBoard());

    // Обработчики событий для создания списков
    document.getElementById('addListBtn').addEventListener('click', () => openModal(createListModal));
    document.getElementById('createListForm').addEventListener('submit', handleCreateList);

    // Обработчики событий для создания карточек
    document.getElementById('createCardForm').addEventListener('submit', handleCreateCard);

    // Обработчики событий для редактирования карточек
    document.getElementById('editCardForm').addEventListener('submit', handleUpdateCard);

    // Обработчики событий для закрытия модальных окон
    document.querySelectorAll('.close-modal, .btn-cancel').forEach(element => {
        element.addEventListener('click', () => closeAllModals());
    });

    // Обработчик добавления задач в форме создания карточки
    document.getElementById('addTodoBtn').addEventListener('click', () => addTodoItem('todoItems'));
    document.getElementById('editAddTodoBtn').addEventListener('click', () => addTodoItem('editTodoItems'));
});

// Функции загрузки данных
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
        renderBoards();
        hideLoading('boardsLoading');
    } catch (error) {
        console.error('Error loading boards:', error);
        showToast('Ошибка', 'Не удалось загрузить списки досок. Пожалуйста, попробуйте снова.', 'error');
        hideLoading('boardsLoading');
    }
}

async function loadLists(boardId) {
    if (!boardId) return;
    
    try {
        console.log('Fetching lists for board:', boardId);
        const response = await fetch(`${apiBaseUrl}/boards/${boardId}/lists`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch lists. Status: ${response.status}`);
        }
        
        lists = await response.json();
        console.log('Lists loaded successfully:', lists);
        
        // Предзагрузка карточек для всех списков
        for (const list of lists) {
            await loadCards(boardId, list.id);
        }
        
        renderLists();
    } catch (error) {
        console.error('Error loading lists:', error);
        showToast('Ошибка', 'Не удалось загрузить списки. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function loadCards(boardId, listId) {
    try {
        console.log(`Fetching cards for list ${listId} in board ${boardId}`);
        const response = await fetch(`${apiBaseUrl}/boards/${boardId}/lists/${listId}/cards`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch cards. Status: ${response.status}`);
        }
        
        const cards = await response.json();
        console.log(`Cards for list ${listId} loaded successfully:`, cards);
        
        // Обновление списков с их карточками
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

async function fetchAllUsers() {
    try {
        console.log('Fetching users from:', `${apiBaseUrl}/users`);
        const response = await fetch(`${apiBaseUrl}/users`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users. Status: ${response.status}`);
        }
        
        users = await response.json();
        console.log('Users loaded successfully:', users);
        
        // После загрузки пользователей, обновляем выпадающие списки
        populateUserSelects();
    } catch (error) {
        console.error('Error fetching users:', error);
        showToast('Ошибка', 'Не удалось загрузить пользователей. Пожалуйста, попробуйте снова.', 'error');
    }
}

// Функция для обновления всех выпадающих списков пользователей
function populateUserSelects() {
    const selects = [
        document.getElementById('cardAssignee'),
        document.getElementById('editCardAssignee')
    ];
    
    selects.forEach(select => {
        if (select) populateUserSelect(select);
    });
}

// Функции управления досками
async function handleCreateBoard(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('boardName');
    const name = nameInput.value.trim();
    
    if (!name) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create board. Status: ${response.status}`);
        }
        
        const newBoard = await response.json();
        boards.push(newBoard);
        renderBoards();
        selectBoard(newBoard);
        closeAllModals();
        nameInput.value = '';
        
        showToast('Успешно', 'Доска успешно создана', 'success');
    } catch (error) {
        console.error('Error creating board:', error);
        showToast('Ошибка', 'Не удалось создать доску. Пожалуйста, попробуйте снова.', 'error');
    }
}

function openEditBoardModal() {
    if (!activeBoard) return;
    
    document.getElementById('editBoardName').value = activeBoard.name;
    openModal(editBoardModal);
}

async function handleEditBoard(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const nameInput = document.getElementById('editBoardName');
    const name = nameInput.value.trim();
    
    if (!name) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update board. Status: ${response.status}`);
        }
        
        await response.json();
        
        // Обновление имени активной доски
        activeBoard.name = name;
        
        // Обновление списка досок
        const boardIndex = boards.findIndex(board => board.id === activeBoard.id);
        if (boardIndex !== -1) {
            boards[boardIndex].name = name;
        }
        
        renderBoards();
        document.getElementById('activeBoardTitle').textContent = name;
        closeAllModals();
        
        showToast('Успешно', 'Доска успешно обновлена', 'success');
    } catch (error) {
        console.error('Error updating board:', error);
        showToast('Ошибка', 'Не удалось обновить доску. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function handleDeleteBoard() {
    if (!activeBoard) return;
    
    if (!confirm('Вы уверены, что хотите удалить эту доску?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`Failed to delete board. Status: ${response.status}`);
        }
        
        // Удаление доски из массива
        boards = boards.filter(board => board.id !== activeBoard.id);
        
        // Сброс активной доски
        activeBoard = null;
        document.getElementById('activeBoardTitle').textContent = 'Kanban Доска';
        document.getElementById('boardActions').style.display = 'none';
        document.getElementById('selectBoardMessage').style.display = 'flex';
        document.getElementById('listsContainer').style.display = 'none';
        
        renderBoards();
        showToast('Успешно', 'Доска успешно удалена', 'success');
    } catch (error) {
        console.error('Error deleting board:', error);
        showToast('Ошибка', 'Не удалось удалить доску. Пожалуйста, попробуйте снова.', 'error');
    }
}

// Функции управления списками
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
        newList.cards = []; // Инициализация пустого массива карточек для нового списка
        lists.push(newList);
        renderLists();
        closeAllModals();
        nameInput.value = '';
        
        showToast('Успешно', 'Список успешно создан', 'success');
    } catch (error) {
        console.error('Error creating list:', error);
        showToast('Ошибка', 'Не удалось создать список. Пожалуйста, попробуйте снова.', 'error');
    }
}

function openEditListModal(listId) {
    const list = lists.find(list => list.id === listId);
    if (!list) return;
    
    // Сохраняем ID списка в форме
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
        
        // Обновление имени списка
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1) {
            lists[listIndex].name = name;
        }
        
        renderLists();
        closeAllModals();
        
        showToast('Успешно', 'Список успешно обновлен', 'success');
    } catch (error) {
        console.error('Error updating list:', error);
        showToast('Ошибка', 'Не удалось обновить список. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function handleDeleteList(listId) {
    if (!activeBoard) return;
    
    if (!confirm('Вы уверены, что хотите удалить этот список?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`Failed to delete list. Status: ${response.status}`);
        }
        
        // Удаление списка из массива
        lists = lists.filter(list => list.id !== listId);
        renderLists();
        
        showToast('Успешно', 'Список успешно удален', 'success');
    } catch (error) {
        console.error('Error deleting list:', error);
        showToast('Ошибка', 'Не удалось удалить список. Пожалуйста, попробуйте снова.', 'error');
    }
}

// Функции управления карточками
function openCreateCardModal(listId) {
    // Сохраняем ID списка в форме
    document.getElementById('createCardForm').dataset.listId = listId;
    
    // Очищаем форму
    document.getElementById('cardTitle').value = '';
    document.getElementById('cardDescription').value = '';
    document.getElementById('cardPriority').value = 'medium';
    document.getElementById('cardAssignee').value = '';
    document.getElementById('cardDeadline').value = '';
    
    // Очистка и сброс списка задач
    const todoItemsContainer = document.getElementById('todoItems');
    todoItemsContainer.innerHTML = `
        <div class="todo-item">
            <input type="text" class="todo-input" placeholder="Добавьте задачу...">
            <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Добавляем пользователей в выпадающий список
    const assigneeSelect = document.getElementById('cardAssignee');
    populateUserSelect(assigneeSelect);
    
    // Открываем модальное окно
    openModal(createCardModal);
}

async function handleCreateCard(event) {
    event.preventDefault();
    
    if (!activeBoard) return;
    
    const listId = parseInt(event.target.dataset.listId);
    if (!listId) return;
    
    const title = document.getElementById('cardTitle').value.trim();
    const description = document.getElementById('cardDescription').value.trim();
    const priority = document.getElementById('cardPriority').value;
    const assignedTo = document.getElementById('cardAssignee').value;
    const deadline = document.getElementById('cardDeadline').value;
    
    if (!title) return;
    
    try {
        // Создаем базовую карточку
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                priority,
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create card. Status: ${response.status}`);
        }
        
        const newCard = await response.json();
        const cardId = newCard.id;
        
        // Массив для дополнительных операций
        const operations = [];
        
        // Добавление задач
        const todoInputs = document.querySelectorAll('#todoItems .todo-input');
        for (const input of todoInputs) {
            const content = input.value.trim();
            if (content) {
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/todos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content }),
                    })
                );
            }
        }
        
        // Установка срока выполнения
        if (deadline) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
                })
            );
        }
        
        // Назначение пользователя
        if (assignedTo) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: assignedTo }),
                })
            );
        }
        
        // Выполнение всех операций
        await Promise.all(operations);
        
        // Перезагрузка карточек для обновленного списка
        await loadCards(activeBoard.id, listId);
        renderLists();
        
        closeAllModals();
        
        showToast('Успешно', 'Карточка успешно создана', 'success');
    } catch (error) {
        console.error('Error creating card:', error);
        showToast('Ошибка', 'Не удалось создать карточку. Пожалуйста, попробуйте снова.', 'error');
    }
}

function openEditCardModal(cardId, listId) {
    if (!activeBoard) return;
    
    const list = lists.find(list => list.id === listId);
    if (!list || !list.cards) return;
    
    const card = list.cards.find(card => card.id === cardId);
    if (!card) return;
    
    // Сохраняем информацию о карточке в форме
    const form = document.getElementById('editCardForm');
    form.dataset.cardId = cardId;
    form.dataset.listId = listId;
    
    // Заполняем форму данными карточки
    document.getElementById('editCardTitle').value = card.title || '';
    document.getElementById('editCardDescription').value = card.description || '';
    document.getElementById('editCardPriority').value = card.priority || 'medium';
    document.getElementById('editCardAssignee').value = card.assigned_to ? card.assigned_to.toString() : '';
    document.getElementById('editCardCompleted').checked = card.completed || false;
    
    // Установка даты дедлайна
    const deadlineInput = document.getElementById('editCardDeadline');
    if (card.deadline) {
        // Форматирование даты для input[type="date"]
        const deadline = new Date(card.deadline);
        const year = deadline.getFullYear();
        const month = String(deadline.getMonth() + 1).padStart(2, '0');
        const day = String(deadline.getDate()).padStart(2, '0');
        deadlineInput.value = `${year}-${month}-${day}`;
    } else {
        deadlineInput.value = '';
    }
    
    // Добавляем пользователей в выпадающий список
    const assigneeSelect = document.getElementById('editCardAssignee');
    populateUserSelect(assigneeSelect);
    
    // Заполняем задачи
    const todoItemsContainer = document.getElementById('editTodoItems');
    todoItemsContainer.innerHTML = '';
    
    if (card.todos && card.todos.length > 0) {
        card.todos.forEach(todo => {
            const todoItem = document.createElement('div');
            todoItem.className = 'todo-item';
            todoItem.dataset.todoId = todo.id;
            
            todoItem.innerHTML = `
                <div class="form-check">
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    <input type="text" class="todo-input" value="${todo.content}" placeholder="Задача...">
                </div>
                <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
            `;
            
            todoItemsContainer.appendChild(todoItem);
        });
    }
    
    // Добавляем пустую строку для новой задачи
    const emptyTodoItem = document.createElement('div');
    emptyTodoItem.className = 'todo-item';
    emptyTodoItem.innerHTML = `
        <input type="text" class="todo-input" placeholder="Добавьте новую задачу...">
        <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
    `;
    todoItemsContainer.appendChild(emptyTodoItem);
    
    // Добавляем обработчики для кнопок удаления задач
    todoItemsContainer.querySelectorAll('.btn-remove-todo').forEach(button => {
        button.addEventListener('click', (e) => {
            const todoItem = e.target.closest('.todo-item');
            todoItem.remove();
        });
    });
    
    // Открываем модальное окно
    openModal(editCardModal);
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
    const assignedTo = document.getElementById('editCardAssignee').value;
    const deadline = document.getElementById('editCardDeadline').value;
    const completed = document.getElementById('editCardCompleted').checked;
    
    if (!title) return;
    
    try {
        // Обновление основной информации карточки
        const operations = [];
        
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                }),
            })
        );
        
        // Обновление приоритета
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/priority`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority }),
            })
        );
        
        // Обновление статуса завершения
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            })
        );
        
        // Обновление срока выполнения
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deadline: deadline ? new Date(deadline).toISOString() : null 
                }),
            })
        );
        
        // Обновление назначения
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: assignedTo }),
            })
        );
        
        // Обработка задач
        const todoItems = document.querySelectorAll('#editTodoItems .todo-item');
        for (const todoItem of todoItems) {
            const todoId = todoItem.dataset.todoId;
            const todoInput = todoItem.querySelector('.todo-input');
            const todoCheckbox = todoItem.querySelector('.todo-checkbox');
            
            if (!todoInput) continue;
            
            const content = todoInput.value.trim();
            if (!content) continue;
            
            if (todoId) {
                // Обновление существующей задачи
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
                // Создание новой задачи
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/todos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content }),
                    })
                );
            }
        }
        
        // Выполнение всех операций
        await Promise.all(operations);
        
        // Перезагрузка карточек
        await loadCards(activeBoard.id, listId);
        renderLists();
        
        closeAllModals();
        
        showToast('Успешно', 'Карточка успешно обновлена', 'success');
    } catch (error) {
        console.error('Error updating card:', error);
        showToast('Ошибка', 'Не удалось обновить карточку. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function handleDeleteCard(cardId, listId) {
    if (!activeBoard) return;
    
    if (!confirm('Вы уверены, что хотите удалить эту карточку?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}`, { 
            method: 'DELETE' 
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete card. Status: ${response.status}`);
        }
        
        // Обновление карточек в списке
        const listIndex = lists.findIndex(list => list.id === listId);
        if (listIndex !== -1 && lists[listIndex].cards) {
            lists[listIndex].cards = lists[listIndex].cards.filter(card => card.id !== cardId);
        }
        
        renderLists();
        
        showToast('Успешно', 'Карточка успешно удалена', 'success');
    } catch (error) {
        console.error('Error deleting card:', error);
        showToast('Ошибка', 'Не удалось удалить карточку. Пожалуйста, попробуйте снова.', 'error');
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
        
        // Обновление статуса карточки в списке
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
        showToast('Ошибка', 'Не удалось обновить статус карточки. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function handleCardMove(cardId, sourceListId, targetListId) {
    if (!activeBoard) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${sourceListId}/cards/${cardId}/move/${targetListId}`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to move card. Status: ${response.status}`);
        }
        
        // Перезагрузка карточек в исходном и целевом списках
        await loadCards(activeBoard.id, sourceListId);
        await loadCards(activeBoard.id, targetListId);
        
        renderLists();
        
        showToast('Успешно', 'Карточка успешно перемещена', 'success');
    } catch (error) {
        console.error('Error moving card:', error);
        showToast('Ошибка', 'Не удалось переместить карточку. Пожалуйста, попробуйте снова.', 'error');
    }
}

// Функции для работы с задачами
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
        
        // Перезагрузка всех карточек - в реальном приложении было бы более целенаправленно
        if (activeBoard) {
            for (const list of lists) {
                await loadCards(activeBoard.id, list.id);
            }
            renderLists();
        }
    } catch (error) {
        console.error('Error updating todo status:', error);
        showToast('Ошибка', 'Не удалось обновить статус задачи. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function handleDeleteTodo(todoId) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/todos/${todoId}`, { method: 'DELETE' });
        
        if (!response.ok) {
            throw new Error(`Failed to delete todo. Status: ${response.status}`);
        }
        
        // Перезагрузка всех карточек
        if (activeBoard) {
            for (const list of lists) {
                await loadCards(activeBoard.id, list.id);
            }
            renderLists();
        }
        
        showToast('Успешно', 'Задача успешно удалена', 'success');
    } catch (error) {
        console.error('Error deleting todo:', error);
        showToast('Ошибка', 'Не удалось удалить задачу. Пожалуйста, попробуйте снова.', 'error');
    }
}

// Функции рендеринга
function renderBoards() {
    const boardsList = document.getElementById('boardsList');
    
    // Удаляем все элементы досок, кроме спиннера загрузки
    const loadingSpinner = document.getElementById('boardsLoading');
    const boardItems = boardsList.querySelectorAll('.board-item');
    boardItems.forEach(item => item.remove());
    
    // Проверяем, есть ли доски
    if (boards.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'У вас еще нет досок. Создайте новую доску.';
        boardsList.appendChild(emptyMessage);
        return;
    }
    
    // Сортируем доски по имени
    const sortedBoards = [...boards].sort((a, b) => a.name.localeCompare(b.name));
    
    // Создаем элементы для каждой доски
    sortedBoards.forEach(board => {
        const boardItem = document.createElement('div');
        boardItem.className = `board-item ${activeBoard && activeBoard.id === board.id ? 'active' : ''}`;
        boardItem.dataset.boardId = board.id;
        
        boardItem.innerHTML = `
            <span class="board-name">${board.name}</span>
            <div class="board-actions">
                <button class="btn-edit-board" title="Редактировать"><i class="fas fa-edit"></i></button>
                <button class="btn-delete-board" title="Удалить"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Добавляем обработчики событий
        boardItem.addEventListener('click', (e) => {
            if (!e.target.closest('.board-actions')) {
                selectBoard(board);
            }
        });
        
        boardItem.querySelector('.btn-edit-board').addEventListener('click', () => {
            selectBoard(board);
            openEditBoardModal();
        });
        
        boardItem.querySelector('.btn-delete-board').addEventListener('click', () => {
            selectBoard(board);
            handleDeleteBoard();
        });
        
        boardsList.appendChild(boardItem);
    });
}

function renderLists() {
    const listsContainer = document.getElementById('listsContainer');
    
    // Удаляем все списки, кроме кнопки добавления
    const addListBtn = document.querySelector('.add-list-container');
    listsContainer.innerHTML = '';
    
    // Добавляем списки
    lists.forEach(list => {
        const listElement = document.createElement('div');
        listElement.className = 'list';
        listElement.dataset.listId = list.id;
        
        // Создаем заголовок списка
        const listHeader = document.createElement('div');
        listHeader.className = 'list-header';
        listHeader.innerHTML = `
            <h3 class="list-title">${list.name}</h3>
            <div class="list-actions">
                <button class="btn-edit" title="Редактировать список"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" title="Удалить список"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Добавляем обработчики для кнопок списка
        listHeader.querySelector('.btn-edit').addEventListener('click', () => openEditListModal(list.id));
        listHeader.querySelector('.btn-delete').addEventListener('click', () => handleDeleteList(list.id));
        
        // Создаем контейнер для карточек
        const listCards = document.createElement('div');
        listCards.className = 'list-cards';
        listCards.dataset.listId = list.id;
        
        // Включаем возможность перетаскивания
        setupDropZone(listCards);
        
        // Добавляем карточки в список
        if (list.cards && list.cards.length > 0) {
            list.cards.forEach(card => {
                const cardElement = createCardElement(card, list.id);
                listCards.appendChild(cardElement);
            });
        }
        
        // Создаем кнопку добавления карточки
        const addCardBtn = document.createElement('button');
        addCardBtn.className = 'btn-add-card';
        addCardBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить карточку';
        addCardBtn.addEventListener('click', () => openCreateCardModal(list.id));
        
        // Собираем все вместе
        listElement.appendChild(listHeader);
        listElement.appendChild(listCards);
        listElement.appendChild(addCardBtn);
        
        listsContainer.appendChild(listElement);
    });
    
    // Добавляем контейнер для кнопки добавления списка
    const addListContainer = document.createElement('div');
    addListContainer.className = 'add-list-container';
    addListContainer.innerHTML = `
        <button id="addListBtn" class="btn-add-list">
            <i class="fas fa-plus"></i> Добавить список
        </button>
    `;
    
    // Добавляем обработчик для кнопки добавления списка
    addListContainer.querySelector('#addListBtn').addEventListener('click', () => openModal(createListModal));
    
    listsContainer.appendChild(addListContainer);
}

function createCardElement(card, listId) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.completed ? 'completed' : ''}`;
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.listId = listId;
    
    // Делаем карточку перетаскиваемой
    cardElement.draggable = true;
    setupDraggable(cardElement);
    
    // Готовим информацию о приоритете
    let priorityClass = '';
    let priorityText = '';
    
    switch (card.priority) {
        case 'low':
            priorityClass = 'priority-low';
            priorityText = 'Низкий';
            break;
        case 'medium':
            priorityClass = 'priority-medium';
            priorityText = 'Средний';
            break;
        case 'high':
            priorityClass = 'priority-high';
            priorityText = 'Высокий';
            break;
        default:
            priorityClass = 'priority-medium';
            priorityText = 'Средний';
    }
    
    // Получаем информацию о пользователе, если карточка назначена
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
    
    // Готовим информацию о сроке выполнения
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
    
    // Готовим информацию о задачах
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
                    ${completedTodos}/${totalTodos} задач выполнено
                </div>
            </div>
        `;
    }
    
    // Собираем HTML для карточки
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
            <button class="btn-toggle-completion" title="${card.completed ? 'Отметить как незавершенное' : 'Отметить как завершенное'}">
                <i class="fas ${card.completed ? 'fa-check-square' : 'fa-square'}"></i>
            </button>
            <button class="btn-edit-card" title="Редактировать карточку">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete-card" title="Удалить карточку">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Добавляем обработчики событий
    cardElement.addEventListener('click', (e) => {
        // Открываем редактирование карточки только если не кликнули на кнопки
        if (!e.target.closest('.card-actions')) {
            openEditCardModal(card.id, listId);
        }
    });
    
    // Обработчик переключения статуса завершения
    cardElement.querySelector('.btn-toggle-completion').addEventListener('click', (e) => {
        e.stopPropagation();
        handleToggleCardCompletion(card.id, listId, card.completed);
    });
    
    // Обработчик редактирования карточки
    cardElement.querySelector('.btn-edit-card').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditCardModal(card.id, listId);
    });
    
    // Обработчик удаления карточки
    cardElement.querySelector('.btn-delete-card').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteCard(card.id, listId);
    });
    
    return cardElement;
}

// Функции для работы с модальными окнами
function openModal(modal) {
    // Закрываем все открытые модальные окна
    closeAllModals();
    
    // Открываем выбранное модальное окно
    modal.classList.add('active');
    
    // Добавляем обработчик для закрытия модального окна по клику вне него
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

// Вспомогательные функции
function selectBoard(board) {
    activeBoard = board;
    
    // Обновляем активную доску в UI
    document.querySelectorAll('.board-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.boardId) === board.id);
    });
    
    // Обновляем заголовок и действия с доской
    document.getElementById('activeBoardTitle').textContent = board.name;
    document.getElementById('boardActions').style.display = 'flex';
    
    // Скрываем сообщение о выборе доски и показываем контейнер списков
    document.getElementById('selectBoardMessage').style.display = 'none';
    document.getElementById('listsContainer').style.display = 'flex';
    
    // Загружаем списки для выбранной доски
    loadLists(board.id);
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
    
    // Удаляем уведомление через 3 секунды
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
        <input type="text" class="todo-input" placeholder="Добавьте задачу...">
        <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
    `;
    
    // Добавляем обработчик удаления
    todoItem.querySelector('.btn-remove-todo').addEventListener('click', () => {
        todoItem.remove();
    });
    
    container.appendChild(todoItem);
}

function populateUserSelect(selectElement) {
    // Очищаем список пользователей, оставляя только первую опцию "Не назначен"
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Добавляем пользователей в выпадающий список
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username || user.name || `User ${user.id}`;
        selectElement.appendChild(option);
    });
}

// Функции для drag-and-drop
function setupDraggable(element) {
    element.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', e.target.dataset.cardId);
        e.dataTransfer.setData('source-list', e.target.dataset.listId);
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

function setupDropZone(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', async (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        
        const cardId = e.dataTransfer.getData('text/plain');
        const sourceListId = e.dataTransfer.getData('source-list');
        const targetListId = element.dataset.listId;
        
        if (cardId && sourceListId && targetListId && sourceListId !== targetListId) {
            await handleCardMove(parseInt(cardId), parseInt(sourceListId), parseInt(targetListId));
        }
    });
}