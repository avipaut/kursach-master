// Global variables
let boards = [];
let activeBoard = null;
let lists = [];
let users = [];
let apiBaseUrl = '';

// DOM elements for modal windows
const createBoardModal = document.getElementById('createBoardModal');
const editBoardModal = document.getElementById('editBoardModal');
const createListModal = document.getElementById('createListModal');
const editListModal = document.getElementById('editListModal');
const createCardModal = document.getElementById('createCardModal');
const editCardModal = document.getElementById('editCardModal');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set the base URL for API
    apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
    console.log('API base URL set to:', apiBaseUrl);

    // Load initial data
    fetchAllUsers();
    loadBoards();

    // Event handlers for creating boards
    document.getElementById('createBoardBtn').addEventListener('click', () => openModal(createBoardModal));
    document.getElementById('createBoardForm').addEventListener('submit', handleCreateBoard);

    // Event handlers for editing boards
    document.getElementById('editBoardBtn').addEventListener('click', () => openEditBoardModal());
    document.getElementById('editBoardForm').addEventListener('submit', handleEditBoard);
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
});

// Data loading functions
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

        // If there are boards, select the first one
        if (boards.length > 0) {
            selectBoard(boards[0]);
        }
    } catch (error) {
        console.error('Error loading boards:', error);
        showToast('Error', 'Failed to load boards. Please try again.', 'error');
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
        
        // Preload cards for all lists
        for (const list of lists) {
            await loadCards(boardId, list.id);
        }
        
        renderLists();
    } catch (error) {
        console.error('Error loading lists:', error);
        showToast('Error', 'Failed to load lists. Please try again.', 'error');
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

async function fetchAllUsers() {
    try {
        console.log('Fetching users from:', `${apiBaseUrl}/users`);
        const response = await fetch(`${apiBaseUrl}/users`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users. Status: ${response.status}`);
        }
        
        users = await response.json();
        console.log('Users loaded successfully:', users);
        
        // After loading users, update dropdown lists
        populateUserSelects();
    } catch (error) {
        console.error('Error fetching users:', error);
        showToast('Error', 'Failed to load users. Please try again.', 'error');
    }
}

// Function to update all user dropdown lists
function populateUserSelects() {
    const selects = [
        document.getElementById('cardAssignee'),
        document.getElementById('editCardAssignee')
    ];
    
    selects.forEach(select => {
        if (select) populateUserSelect(select);
    });
}

// Board management functions
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
        
        showToast('Success', 'Board created successfully', 'success');
    } catch (error) {
        console.error('Error creating board:', error);
        showToast('Error', 'Failed to create board. Please try again.', 'error');
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
        
        // Update name of active board
        activeBoard.name = name;
        
        // Update board list
        const boardIndex = boards.findIndex(board => board.id === activeBoard.id);
        if (boardIndex !== -1) {
            boards[boardIndex].name = name;
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

// Card management functions
function openCreateCardModal(listId) {
    // Save list ID in the form
    document.getElementById('createCardForm').dataset.listId = listId;
    
    // Clear form
    document.getElementById('cardTitle').value = '';
    document.getElementById('cardDescription').value = '';
    document.getElementById('cardPriority').value = 'medium';
    document.getElementById('cardAssignee').value = '';
    document.getElementById('cardDeadline').value = '';
    
    // Clear and reset task list
    const todoItemsContainer = document.getElementById('todoItems');
    todoItemsContainer.innerHTML = `
        <div class="todo-item">
            <input type="text" class="todo-input" placeholder="Add a task...">
            <button type="button" class="btn-remove-todo"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Add users to dropdown
    const assigneeSelect = document.getElementById('cardAssignee');
    populateUserSelect(assigneeSelect);
    
    // Add remove button handlers
    attachRemoveTodoHandlers();
    
    // Open modal
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
        // Create basic card
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
        
        // Array for additional operations
        const operations = [];
        
        // Add tasks
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
        
        // Set deadline
        if (deadline) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
                })
            );
        }
        
        // Assign user
        if (assignedTo) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: assignedTo }),
                })
            );
        }
        
        // Execute all operations
        await Promise.all(operations);
        
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
    document.getElementById('editCardAssignee').value = card.assigned_to ? card.assigned_to.toString() : '';
    document.getElementById('editCardCompleted').checked = card.completed || false;
    
    // Set deadline date
    const deadlineInput = document.getElementById('editCardDeadline');
    if (card.deadline) {
        // Format date for input[type="date"]
        const deadline = new Date(card.deadline);
        const year = deadline.getFullYear();
        const month = String(deadline.getMonth() + 1).padStart(2, '0');
        const day = String(deadline.getDate()).padStart(2, '0');
        deadlineInput.value = `${year}-${month}-${day}`;
    } else {
        deadlineInput.value = '';
    }
    
    // Add users to dropdown
    const assigneeSelect = document.getElementById('editCardAssignee');
    populateUserSelect(assigneeSelect);
    
    // Fill tasks
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
    
    // Add handlers for task delete buttons
    attachRemoveTodoHandlers();
    
    // Add event handler for delete card button
    document.getElementById('deleteCardBtn').onclick = () => handleDeleteCard(cardId, listId);
    
    // Open modal
    openModal(editCardModal);
}

function attachRemoveTodoHandlers() {
    document.querySelectorAll('.btn-remove-todo').forEach(button => {
        button.addEventListener('click', (e) => {
            const todoItem = e.target.closest('.todo-item');
            todoItem.remove();
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
    const assignedTo = document.getElementById('editCardAssignee').value;
    const deadline = document.getElementById('editCardDeadline').value;
    const completed = document.getElementById('editCardCompleted').checked;
    
    if (!title) return;
    
    try {
        // Update main card information
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
        
        // Update priority
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/priority`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority }),
            })
        );
        
        // Update completion status
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            })
        );
        
        // Update deadline
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deadline: deadline ? new Date(deadline).toISOString() : null 
                }),
            })
        );
        
        // Update assignment
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: assignedTo }),
            })
        );
        
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
        await Promise.all(operations);
        
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

async function handleDeleteCard(cardId, listId) {
    if (!activeBoard) return;
    
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}`, { 
            method: 'DELETE' 
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

async function handleCardMove(cardId, sourceListId, targetListId) {
    if (!activeBoard) return;
    
    try {
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

// Rendering functions
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
        boardItem.dataset.boardId = board.id;
        
        boardItem.innerHTML = `
            <div class="board-name"><span>${board.name}</span></div>
            <div class="board-actions">
                <button class="btn-edit-board" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn-delete-board" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Add event handlers
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
    
    // Clear container
    listsContainer.innerHTML = '';
    
    // Add lists
    lists.forEach(list => {
        const listElement = document.createElement('div');
        listElement.className = 'list';
        listElement.dataset.listId = list.id;
        
        // Create list header
        const listHeader = document.createElement('div');
        listHeader.className = 'list-header';
        listHeader.innerHTML = `
            <h3 class="list-title">${list.name} <span>${list.cards ? list.cards.length : 0}</span></h3>
            <div class="list-actions">
                <button class="btn-edit" title="Edit list"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" title="Delete list"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Add handlers for list buttons
        listHeader.querySelector('.btn-edit').addEventListener('click', () => openEditListModal(list.id));
        listHeader.querySelector('.btn-delete').addEventListener('click', () => handleDeleteList(list.id));
        
        // Create container for cards
        const listCards = document.createElement('div');
        listCards.className = 'list-cards';
        listCards.dataset.listId = list.id;
        
        // Enable drag and drop
        setupDropZone(listCards);
        
        // Add cards to list
        if (list.cards && list.cards.length > 0) {
            list.cards.forEach(card => {
                const cardElement = createCardElement(card, list.id);
                listCards.appendChild(cardElement);
            });
        }
        
        // Create add card button
        const addCardBtn = document.createElement('button');
        addCardBtn.className = 'btn-add-card';
        addCardBtn.innerHTML = '<i class="fas fa-plus"></i> Add Card';
        addCardBtn.addEventListener('click', () => openCreateCardModal(list.id));
        
        // Put everything together
        listElement.appendChild(listHeader);
        listElement.appendChild(listCards);
        listElement.appendChild(addCardBtn);
        
        listsContainer.appendChild(listElement);
    });
    
    // Add container for add list button
    const addListContainer = document.createElement('div');
    addListContainer.className = 'add-list-container';
    addListContainer.innerHTML = `
        <button id="addListBtn" class="btn-add-list">
            <i class="fas fa-plus"></i> Add List
        </button>
    `;
    
    // Add handler for add list button
    addListContainer.querySelector('#addListBtn').addEventListener('click', () => openModal(createListModal));
    
    listsContainer.appendChild(addListContainer);
}

function createCardElement(card, listId) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.completed ? 'completed' : ''}`;
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.listId = listId;
    
    // Make card draggable
    cardElement.draggable = true;
    setupDraggable(cardElement);
    
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
            <button class="btn-edit-card" title="Edit card">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete-card" title="Delete card">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Add event handlers
    cardElement.addEventListener('click', (e) => {
        // Open card editing only if not clicked on buttons
        if (!e.target.closest('.card-actions')) {
            openEditCardModal(card.id, listId);
        }
    });
    
    // Handler for toggling completion status
    cardElement.querySelector('.btn-toggle-completion').addEventListener('click', (e) => {
        e.stopPropagation();
        handleToggleCardCompletion(card.id, listId, card.completed);
    });
    
    // Handler for editing card
    cardElement.querySelector('.btn-edit-card').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditCardModal(card.id, listId);
    });
    
    // Handler for deleting card
    cardElement.querySelector('.btn-delete-card').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteCard(card.id, listId);
    });
    
    return cardElement;
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

function populateUserSelect(selectElement) {
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

// Drag and drop functions
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

// Toggle sidebar collapsed state
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

// Initialize edit list form handler
document.getElementById('editListForm').addEventListener('submit', handleEditList);