// kanban_board_management.js
// This combined script includes:
// 1. Card assignment functionality with creator info display
// 2. Multi-user assignment features
// 3. Board sharing capabilities

// Global variables
let boardAssignableUsers = [];
let cardAssignments = new Map();
let currentUserInfo = null;
let boardUsers = [];

// DOM elements for board sharing
let addUserModal;
let boardUsersListModal;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Kanban Board Management module loading...");
    
    // Add all necessary styles
    addCardAssignmentStyles();
    addBoardSharingStyles();
    
    // Get current user info
    fetchCurrentUserInfo();
    
    // Initialize with delay to ensure other scripts are loaded
    setTimeout(() => {
        initializeCardAssignment();
        setupMultiUserAssignment();
        setupSearchableUserSelects();
        
        // Set up board sharing
        createBoardSharingModals();
        addBoardSharingButton();
        
        // Set up observers and patches
        setupBoardsObserver();
        setupCardsObserver();
        patchKanbanFunctions();
        setupApiMonitoring();
        
        // Run initial fixes
        fixCardAssignmentIssues();
    }, 500);
});

// ========================
// USER MANAGEMENT FUNCTIONS
// ========================

async function fetchCurrentUserInfo() {
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/kanban/api/current_user`);
        if (response.ok) {
            currentUserInfo = await response.json();
            console.log('Current user info loaded:', currentUserInfo);
        }
    } catch (error) {
        console.error('Error fetching current user info:', error);
    }
}

async function loadBoardAssignableUsers(boardId) {
    console.log("Loading assignable users for board:", boardId);
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/boards/${boardId}/users`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch board users. Status: ${response.status}`);
        }
        
        boardAssignableUsers = await response.json();
        console.log('Board assignable users loaded:', boardAssignableUsers);
        
        // Set up multi-select in modals
        setupMultiSelectInModals();
        
        return boardAssignableUsers;
    } catch (error) {
        console.error('Error loading board users:', error);
        return [];
    }
}

// ========================
// CARD ASSIGNMENT FUNCTIONS
// ========================

function initializeCardAssignment() {
    console.log("Initializing enhanced card assignment features...");
    
    // Enhance existing elements
    enhanceExistingCards();
    enhanceExistingBoards();
    
    // Set up form handlers after a short delay
    setTimeout(overrideFormSubmitHandlers, 1500);
}

function enhanceExistingCards() {
    console.log("Enhancing existing cards with creator info...");
    
    document.querySelectorAll('.card').forEach(cardElement => {
        if (cardElement.querySelector('.creator-info')) return;
        
        const cardId = parseInt(cardElement.dataset.cardId);
        const listId = parseInt(cardElement.dataset.listId);
        
        if (!cardId || !listId || !window.lists) return;
        
        const list = window.lists.find(l => l.id === listId);
        if (!list || !list.cards) return;
        
        const card = list.cards.find(c => c.id === cardId);
        if (!card) return;
        
        // Creator info
        const creator = window.users ? window.users.find(user => user.id === card.user_id) : null;
        const creatorName = creator ? creator.username || creator.name || `User ${creator.id}` : 'Unknown';
        
        // Format date
        let creationDate = 'unknown date';
        if (card.created_at) {
            try {
                creationDate = typeof formatDate === 'function' ? 
                    formatDate(new Date(card.created_at)) : 
                    new Date(card.created_at).toLocaleDateString();
            } catch (e) {
                console.error('Error formatting date:', e);
            }
        }
        
        // Create info element
        const creatorInfo = document.createElement('div');
        creatorInfo.className = 'creator-info';
        creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
        
        // Insert in DOM
        const cardHeader = cardElement.querySelector('.card-header');
        if (cardHeader && cardHeader.nextSibling) {
            cardElement.insertBefore(creatorInfo, cardHeader.nextSibling);
        } else {
            cardElement.insertBefore(creatorInfo, cardElement.firstChild);
        }
        
        // Update completion permissions
        updateCardCompletionPermission(cardElement, card);
    });
}

function enhanceExistingBoards() {
    console.log("Enhancing existing boards with creator info...");
    
    document.querySelectorAll('.board-item').forEach(boardItem => {
        if (boardItem.querySelector('.board-creator-info')) return;
        
        const boardId = parseInt(boardItem.dataset.boardId);
        if (!boardId || !window.boards) return;
        
        // Find board data
        const board = window.boards.find(b => b.id === boardId);
        if (!board || !board.created_at || !board.user_id) return;
        
        // Find creator info
        const creator = window.users ? window.users.find(user => user.id === board.user_id) : null;
        const creatorName = creator ? creator.username : 'Unknown';
        
        // Format date
        let creationDate = 'unknown date';
        try {
            if (typeof formatDate === 'function') {
                creationDate = formatDate(new Date(board.created_at));
            } else {
                creationDate = new Date(board.created_at).toLocaleDateString();
            }
        } catch (e) {
            console.error('Error formatting date:', e);
        }
        
        // Create creator info element
        const creatorInfo = document.createElement('div');
        creatorInfo.className = 'board-creator-info';
        creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
        
        // Insert after board name
        const boardName = boardItem.querySelector('.board-name');
        if (boardName) {
            boardName.appendChild(creatorInfo);
        } else {
            boardItem.appendChild(creatorInfo);
        }
    });
}

function updateCardCompletionPermission(cardElement, card) {
    const toggleBtn = cardElement.querySelector('.btn-toggle-completion');
    if (!toggleBtn) return;
    
    let canToggleCompletion = currentUserInfo?.is_admin === true;
    
    if (card.assigned_to && currentUserInfo) {
        if (card.assigned_to === currentUserInfo.id) {
            canToggleCompletion = true;
        } else if (Array.isArray(card.assigned_users)) {
            canToggleCompletion = card.assigned_users.some(user => user.id === currentUserInfo.id);
        }
    }
    
    if (!canToggleCompletion) {
        toggleBtn.classList.add('disabled');
        toggleBtn.title = "Only assigned users can mark this card as completed";
        toggleBtn.style.opacity = "0.5";
        toggleBtn.style.cursor = "not-allowed";
        
        const originalClickHandler = toggleBtn.onclick;
        toggleBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            showToast('Info', 'Only assigned users can mark this card as completed', 'info');
            return false;
        };
    }
}

// ========================
// MULTI-USER ASSIGNMENT
// ========================

function setupMultiUserAssignment() {
    setupCreateCardModal();
    setupEditCardModal();
}

function setupCreateCardModal() {
    const createCardModal = document.getElementById('createCardModal');
    if (!createCardModal) return;
    
    let assigneeField = document.getElementById('cardAssignee');
    const modalBody = createCardModal.querySelector('.modal-body');
    
    if (!assigneeField && modalBody) {
        let insertAfter = modalBody.querySelector('.form-group:nth-child(3)') || modalBody.lastElementChild;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label for="cardAssignees">Assignees</label>
            <div class="select-with-search">
                <input type="text" class="search-input" placeholder="Search users...">
                <select id="cardAssignees" multiple class="form-control">
                    <option value="" disabled>Select assignees</option>
                </select>
            </div>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        if (insertAfter.nextSibling) {
            modalBody.insertBefore(formGroup, insertAfter.nextSibling);
        } else {
            modalBody.appendChild(formGroup);
        }
        
        const form = createCardModal.querySelector('form');
        if (form) {
            form.addEventListener('submit', handleCreateCardWithMultipleAssignees);
        }
        
        setupSelectSearch(formGroup.querySelector('.search-input'), 'cardAssignees');
    }
}

function setupEditCardModal() {
    const editCardModal = document.getElementById('editCardModal');
    if (!editCardModal) return;
    
    let assigneeField = document.getElementById('editCardAssignee');
    const modalBody = editCardModal.querySelector('.modal-body');
    
    if (!assigneeField && modalBody) {
        let insertAfter = modalBody.querySelector('.form-group:nth-child(4)') || modalBody.lastElementChild;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label for="editCardAssignees">Assignees</label>
            <div class="select-with-search">
                <input type="text" class="search-input" placeholder="Search users...">
                <select id="editCardAssignees" multiple class="form-control">
                    <option value="" disabled>Select assignees</option>
                </select>
            </div>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        if (insertAfter.nextSibling) {
            modalBody.insertBefore(formGroup, insertAfter.nextSibling);
        } else {
            modalBody.appendChild(formGroup);
        }
        
        const form = editCardModal.querySelector('form');
        if (form) {
            form.addEventListener('submit', handleUpdateCardWithMultipleAssignees);
        }
        
        setupSelectSearch(formGroup.querySelector('.search-input'), 'editCardAssignees');
    }
}

function setupSearchableUserSelects() {
    document.querySelectorAll('.form-group select[id*="user"], .form-group select[id*="User"]').forEach(select => {
        const selectId = select.id;
        const formGroup = select.closest('.form-group');
        
        if (formGroup.querySelector('.select-with-search')) return;
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input';
        searchInput.placeholder = 'Search users...';
        
        const container = document.createElement('div');
        container.className = 'select-with-search';
        
        select.parentNode.insertBefore(container, select);
        container.appendChild(searchInput);
        container.appendChild(select);
        
        setupSelectSearch(searchInput, selectId);
    });
}

function setupSelectSearch(searchInput, selectId) {
    if (!searchInput || !selectId) return;
    
    const select = document.getElementById(selectId);
    if (!select) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const options = Array.from(select.querySelectorAll('option:not(:first-child)'));
        
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
    
    select.addEventListener('blur', function() {
        setTimeout(() => {
            searchInput.value = '';
            Array.from(select.querySelectorAll('option')).forEach(option => {
                option.style.display = '';
            });
        }, 200);
    });
}

function setupMultiSelectInModals() {
    // For create modal
    const createSelect = document.getElementById('cardAssignees');
    if (createSelect) {
        while (createSelect.options.length > 1) createSelect.remove(1);
        
        boardAssignableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            createSelect.appendChild(option);
        });
    }
    
    // For edit modal
    const editSelect = document.getElementById('editCardAssignees');
    if (editSelect) {
        while (editSelect.options.length > 1) editSelect.remove(1);
        
        boardAssignableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            editSelect.appendChild(option);
        });
    }
}

// ========================
// FORM HANDLERS
// ========================

async function handleCreateCardWithMultipleAssignees(event) {
    event.preventDefault();
    
    if (!window.activeBoard) {
        console.error("No active board");
        return;
    }
    
    const form = event.target;
    const listId = parseInt(form.dataset.listId);
    if (!listId) return;
    
    // Get form data
    const titleElement = document.getElementById('cardTitle');
    const descriptionElement = document.getElementById('cardDescription');
    const priorityElement = document.getElementById('cardPriority');
    const deadlineElement = document.getElementById('cardDeadline');
    
    const title = titleElement ? titleElement.value.trim() : '';
    const description = descriptionElement ? descriptionElement.value.trim() : '';
    const priority = priorityElement ? priorityElement.value : 'medium';
    const deadline = deadlineElement ? deadlineElement.value : '';
    
    // Get selected users
    const assigneesSelect = document.getElementById('cardAssignees');
    const selectedAssignees = [];
    
    if (assigneesSelect) {
        Array.from(assigneesSelect.selectedOptions).forEach(option => {
            if (option.value) selectedAssignees.push(parseInt(option.value));
        });
    }
    
    if (!title) {
        alert("Title is required");
        return;
    }
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        
        // Create card
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                priority,
                completed: false,
                position: 0
            }),
        });
        
        if (!response.ok) throw new Error(`Failed to create card. Status: ${response.status}`);
        
        const newCard = await response.json();
        const cardId = newCard.id;
        
        // Additional operations
        const operations = [];
        
        // Add todos
        if (typeof window.getTodoItems === 'function') {
            const todoItems = window.getTodoItems('todoItems');
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
        
        // Assign users
        if (selectedAssignees.length > 0) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_ids: selectedAssignees }),
                }).catch(error => {
                    console.warn('Multi-assign failed, using single assign:', error);
                    const firstAssignee = selectedAssignees[0];
                    return fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: firstAssignee }),
                    });
                })
            );
            
            cardAssignments.set(cardId, selectedAssignees);
        }
        
        // Execute all operations
        await Promise.allSettled(operations);
        
        // Update client data
        const listIndex = window.lists.findIndex(list => list.id === listId);
        if (listIndex !== -1) {
            newCard.user_id = currentUserInfo?.id;
            newCard.created_at = new Date().toISOString();
            
            if (selectedAssignees.length > 0) {
                newCard.assigned_to = selectedAssignees[0];
                newCard.assigned_users = selectedAssignees.map(userId => {
                    const user = boardAssignableUsers.find(u => u.id === userId);
                    return user || { id: userId, username: 'Unknown' };
                });
            }
            
            if (window.lists[listIndex].cards) {
                window.lists[listIndex].cards.unshift(newCard);
            }
        }
        
        // Update UI
        if (typeof window.loadCards === 'function') await window.loadCards(activeBoard.id, listId);
        if (typeof window.renderLists === 'function') window.renderLists();
        if (typeof window.closeAllModals === 'function') window.closeAllModals();
        
        // Show message
        showToast('Success', 'Card created successfully', 'success');
    } catch (error) {
        console.error('Error creating card:', error);
        alert('Failed to create card: ' + error.message);
    }
}

async function handleUpdateCardWithMultipleAssignees(event) {
    event.preventDefault();
    
    if (!window.activeBoard) {
        console.error("No active board");
        return;
    }
    
    const form = event.target;
    const cardId = parseInt(form.dataset.cardId);
    const listId = parseInt(form.dataset.listId);
    
    if (!cardId || !listId) return;
    
    const title = document.getElementById('editCardTitle').value.trim();
    const description = document.getElementById('editCardDescription').value.trim();
    const priority = document.getElementById('editCardPriority').value;
    const deadline = document.getElementById('editCardDeadline')?.value;
    const completed = document.getElementById('editCardCompleted')?.checked || false;
    
    // Get selected users
    const assigneesSelect = document.getElementById('editCardAssignees');
    const selectedAssignees = [];
    
    if (assigneesSelect) {
        Array.from(assigneesSelect.selectedOptions).forEach(option => {
            if (option.value) selectedAssignees.push(parseInt(option.value));
        });
    }
    
    if (!title) {
        alert("Title is required");
        return;
    }
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        const operations = [];
        
        // Update basic info
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
        
        // Update completion status
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            })
        );
        
        // Update deadline
        if (deadline) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
                })
            );
        }
        
        // Assign users
        if (selectedAssignees.length > 0) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_ids: selectedAssignees }),
                }).catch(error => {
                    console.warn('Multi-assign failed, using single assign:', error);
                    const firstAssignee = selectedAssignees[0];
                    return fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: firstAssignee }),
                    });
                })
            );
        } else {
            operations.push(
                fetch(`${apiBaseUrl}/kanban/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: null }),
                })
            );
        }
        
        cardAssignments.set(cardId, selectedAssignees);
        
        // Update todos
        const todoItems = document.querySelectorAll('#editTodoItems .todo-item');
        for (const todoItem of todoItems) {
            const todoId = todoItem.dataset.todoId;
            const todoInput = todoItem.querySelector('.todo-input');
            const todoCheckbox = todoItem.querySelector('.todo-checkbox');
            
            if (!todoInput) continue;
            
            const content = todoInput.value.trim();
            if (!content) continue;
            
            if (todoId) {
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
        
        // Update client data
        const listIndex = window.lists.findIndex(list => list.id === listId);
        if (listIndex !== -1 && window.lists[listIndex].cards) {
            const cardIndex = window.lists[listIndex].cards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                const card = window.lists[listIndex].cards[cardIndex];
                card.title = title;
                card.description = description;
                card.priority = priority;
                card.completed = completed;
                card.deadline = deadline ? new Date(deadline).toISOString() : card.deadline;
                
                if (selectedAssignees.length > 0) {
                    card.assigned_to = selectedAssignees[0];
                    card.assigned_users = selectedAssignees.map(userId => {
                        const user = boardAssignableUsers.find(u => u.id === userId);
                        return user || { id: userId, username: 'Unknown' };
                    });
                } else {
                    card.assigned_to = null;
                    card.assigned_users = [];
                }
            }
        }
        
        // Update UI
        if (typeof window.loadCards === 'function') await window.loadCards(activeBoard.id, listId);
        if (typeof window.renderLists === 'function') window.renderLists();
        if (typeof window.closeAllModals === 'function') window.closeAllModals();
        
        // Show message
        showToast('Success', 'Card updated successfully', 'success');
    } catch (error) {
        console.error('Error updating card:', error);
        alert('Failed to update card: ' + error.message);
    }
}

// ========================
// BOARD SHARING FUNCTIONS
// ========================

function createBoardSharingModals() {
    // Modal for adding users to a board
    createAddUserModal();
    
    // Modal for viewing and managing board users
    createBoardUsersListModal();
}

function createAddUserModal() {
    // Check if modal already exists
    if (document.getElementById('addUserToBoardModal')) {
        return;
    }
    
    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'addUserToBoardModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add User to Board</h2>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <form id="addUserToBoardForm">
                <div class="form-group">
                    <label for="userSelect">Select User</label>
                    <select id="userSelect" class="form-control" required>
                        <option value="">-- Select User --</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add User</button>
                </div>
            </form>
        </div>
    `;
    
    // Add modal to the DOM
    document.body.appendChild(modal);
    
    // Store reference to modal
    addUserModal = modal;
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => closeAllModals());
    modal.querySelector('.btn-cancel').addEventListener('click', () => closeAllModals());
    
    const addUserForm = document.getElementById('addUserToBoardForm');
    addUserForm.addEventListener('submit', handleAddUserToBoard);
}

function createBoardUsersListModal() {
    // Check if modal already exists
    if (document.getElementById('boardUsersListModal')) {
        return;
    }
    
    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'boardUsersListModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Board Users</h2>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="board-users-list"></div>
                <div class="empty-users-message" style="display: none;">
                    <p>No users have been added to this board yet.</p>
                </div>
                <div class="form-actions mt-4">
                    <button type="button" id="addUserBtn" class="btn btn-primary">
                        <i class="fas fa-user-plus"></i> Add User
                    </button>
                    <button type="button" class="btn btn-secondary btn-cancel">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to the DOM
    document.body.appendChild(modal);
    
    // Store reference to modal
    boardUsersListModal = modal;
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => closeAllModals());
    modal.querySelector('.btn-cancel').addEventListener('click', () => closeAllModals());
    
    const addUserBtn = document.getElementById('addUserBtn');
    addUserBtn.addEventListener('click', () => {
        // Close current modal and open add user modal
        closeAllModals();
        openAddUserModal();
    });
}

function addBoardSharingButton() {
    const boardActionsContainer = document.getElementById('boardActions');
    if (!boardActionsContainer) return;
    
    // Create the share button
    const shareButton = document.createElement('button');
    shareButton.id = 'shareBoardBtn';
    shareButton.className = 'btn btn-light';
    shareButton.innerHTML = '<i class="fas fa-users"></i> Share Board';
    
    // Add click event listener
    shareButton.addEventListener('click', openBoardUsersListModal);
    
    // Add button to the container
    boardActionsContainer.appendChild(shareButton);
}

function openAddUserModal() {
    if (!activeBoard) {
        showToast('Error', 'Please select a board first', 'error');
        return;
    }
    
    // Populate the user select dropdown with users who are not already added to the board
    populateUserSelectForBoard();
    
    // Open the modal
    openModal(addUserModal);
}

function openBoardUsersListModal() {
    if (!activeBoard) {
        showToast('Error', 'Please select a board first', 'error');
        return;
    }
    
    // Fetch and display the users who have access to the board
    fetchBoardUsers();
    
    // Open the modal
    openModal(boardUsersListModal);
}

function populateUserSelectForBoard() {
    const userSelect = document.getElementById('userSelect');
    
    // Clear existing options except the first one
    while (userSelect.options.length > 1) {
        userSelect.remove(1);
    }
    
    // Filter out users who are already added to the board
    const boardUserIds = boardUsers.map(user => user.id);
    const availableUsers = users.filter(user => !boardUserIds.includes(user.id) && user.id !== activeBoard.user_id);
    
    // Add available users to the dropdown
    availableUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username || user.name || `User ${user.id}`;
        userSelect.appendChild(option);
    });
    
    // Check if there are any available users
    if (availableUsers.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No available users";
        option.disabled = true;
        userSelect.appendChild(option);
        
        // Disable the submit button
        document.querySelector('#addUserToBoardForm button[type="submit"]').disabled = true;
    } else {
        // Enable the submit button
        document.querySelector('#addUserToBoardForm button[type="submit"]').disabled = false;
    }
}

async function fetchBoardUsers() {
    if (!activeBoard) return;
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/users`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch board users. Status: ${response.status}`);
        }
        
        boardUsers = await response.json();
        console.log('Board users loaded:', boardUsers);
        
        // Display the board users
        displayBoardUsers();
    } catch (error) {
        console.error('Error fetching board users:', error);
        showToast('Error', 'Failed to load board users. Please try again.', 'error');
    }
}

function displayBoardUsers() {
    const boardUsersList = document.querySelector('.board-users-list');
    const emptyMessage = document.querySelector('.empty-users-message');
    
    // Clear the list
    boardUsersList.innerHTML = '';
    
    // Check if there are any users
    if (!boardUsers || boardUsers.length === 0) {
        boardUsersList.style.display = 'none';
        emptyMessage.style.display = 'block';
        return;
    }
    
    // Show the list and hide the empty message
    boardUsersList.style.display = 'block';
    emptyMessage.style.display = 'none';
    
    // Create a list of users
    const userListElement = document.createElement('ul');
    userListElement.className = 'user-list';
    
    // Create a list item for each user
    boardUsers.forEach(user => {
        const userItem = document.createElement('li');
        userItem.className = 'user-item';
        
        // Determine if this user is the board creator
        const isCreator = user.id === activeBoard.user_id;
        
        userItem.innerHTML = `
            <div class="user-info">
                <span class="user-avatar">${getInitials(user.username || '')}</span>
                <span class="user-name">${user.username}</span>
                ${isCreator ? '<span class="user-role">(Owner)</span>' : ''}
            </div>
            ${!isCreator ? `
                <button class="btn-remove-user" data-user-id="${user.id}" title="Remove user">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        `;
        
        // Add click event listener to remove button
        if (!isCreator) {
            const removeButton = userItem.querySelector('.btn-remove-user');
            removeButton.addEventListener('click', () => handleRemoveUserFromBoard(user.id));
        }
        
        userListElement.appendChild(userItem);
    });
    
    boardUsersList.appendChild(userListElement);
}

async function handleAddUserToBoard(event) {
    event.preventDefault();
    
    if (!activeBoard) {
        showToast('Error', 'Please select a board first', 'error');
        return;
    }
    
    const userSelect = document.getElementById('userSelect');
    const userId = userSelect.value;
    
    if (!userId) {
        showToast('Error', 'Please select a user', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to add user to board. Status: ${response.status}`);
        }
        
        await response.json();
        
        // Refresh the board users list
        await fetchBoardUsers();
        
        // Close the add user modal and open the board users list modal
        closeAllModals();
        openBoardUsersListModal();
        
        showToast('Success', 'User added to board successfully', 'success');
    } catch (error) {
        console.error('Error adding user to board:', error);
        showToast('Error', 'Failed to add user to board. Please try again.', 'error');
    }
}

async function handleRemoveUserFromBoard(userId) {
    if (!activeBoard) {
        showToast('Error', 'Please select a board first', 'error');
        return;
    }
    
    // Confirm removal
    if (!confirm('Are you sure you want to remove this user from the board?')) {
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/boards/${activeBoard.id}/users/${userId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error(`Failed to remove user from board. Status: ${response.status}`);
        }
        
        await response.json();
        
        // Refresh the board users list
        await fetchBoardUsers();
        
        showToast('Success', 'User removed from board successfully', 'success');
    } catch (error) {
        console.error('Error removing user from board:', error);
        showToast('Error', 'Failed to remove user from board. Please try again.', 'error');
    }
}

// ========================
// OBSERVERS AND PATCHES
// ========================

function setupBoardsObserver() {
    const boardsList = document.getElementById('boardsList');
    if (!boardsList) {
        console.warn("Board list not found - will retry later");
        setTimeout(setupBoardsObserver, 1000);
        return;
    }
    
    const boardsObserver = new MutationObserver(function(mutations) {
        let needsFix = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                needsFix = true;
                break;
            }
        }
        
        if (needsFix) {
            setTimeout(fixBoardCreatorInfo, 200);
        }
    });
    
    boardsObserver.observe(boardsList, {
        childList: true,
        subtree: true
    });
}

function setupCardsObserver() {
    const listsContainer = document.getElementById('listsContainer');
    if (!listsContainer) {
        console.warn("Lists container not found - will retry later");
        setTimeout(setupCardsObserver, 1000);
        return;
    }
    
    const cardsObserver = new MutationObserver(function(mutations) {
        let needsFix = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.classList && (node.classList.contains('list') || node.classList.contains('card')) ){
                        needsFix = true;
                        break;
                    }
                }
            }
        }
        
        if (needsFix) {
            setTimeout(fixCardCreatorInfo, 200);
        }
    });
    
    cardsObserver.observe(listsContainer, {
        childList: true,
        subtree: true
    });
}

function patchKanbanFunctions() {
    // Patch createCardElement
    if (typeof window.createCardElement === 'function') {
        window.originalCreateCardElement = window.createCardElement;
        window.createCardElement = function(card, listId) {
            try {
                const cardElement = window.originalCreateCardElement(card, listId);
                
                if (!cardElement.querySelector('.creator-info') && card.user_id) {
                    const creator = window.users ? window.users.find(user => user.id === card.user_id) : null;
                    const creatorName = creator ? creator.username || creator.name || `User ${creator.id}` : 'Unknown';
                    
                    let creationDate = 'unknown date';
                    if (card.created_at) {
                        try {
                            creationDate = typeof formatDate === 'function' ? 
                                formatDate(new Date(card.created_at)) : 
                                new Date(card.created_at).toLocaleDateString();
                        } catch (e) {
                            console.error('Error formatting date:', e);
                        }
                    }
                    
                    const creatorInfo = document.createElement('div');
                    creatorInfo.className = 'creator-info';
                    creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
                    
                    const cardHeader = cardElement.querySelector('.card-header');
                    if (cardHeader && cardHeader.nextSibling) {
                        cardElement.insertBefore(creatorInfo, cardHeader.nextSibling);
                    } else {
                        cardElement.insertBefore(creatorInfo, cardElement.firstChild);
                    }
                }
                
                updateCardCompletionPermission(cardElement, card);
                return cardElement;
            } catch (error) {
                console.error('Error in patched createCardElement:', error);
                return window.originalCreateCardElement(card, listId);
            }
        };
    }
    
    // Patch renderBoards
    if (typeof window.renderBoards === 'function') {
        window.originalRenderBoards = window.renderBoards;
        window.renderBoards = function() {
            try {
                window.originalRenderBoards();
                enhanceExistingBoards();
            } catch (error) {
                console.error('Error in patched renderBoards:', error);
                if (window.originalRenderBoards) window.originalRenderBoards();
            }
        };
    }
    
    // Patch selectBoard
    if (typeof window.selectBoard === 'function') {
        window.originalSelectBoard = window.selectBoard;
        window.selectBoard = function(board) {
            try {
                window.originalSelectBoard(board);
                if (board && board.id) loadBoardAssignableUsers(board.id);
            } catch (error) {
                console.error('Error in patched selectBoard:', error);
                if (window.originalSelectBoard) window.originalSelectBoard(board);
            }
        };
    }
    
    // Patch handleCreateCard
    if (typeof window.handleCreateCard === 'function') {
        window.originalHandleCreateCard = window.handleCreateCard;
        window.handleCreateCard = async function(event) {
            try {
                await window.originalHandleCreateCard(event);
                
                const listId = parseInt(event.target.dataset.listId);
                if (!listId || !window.activeBoard) return;
                
                const list = window.lists.find(l => l.id === listId);
                if (!list || !list.cards || list.cards.length === 0) return;
                
                const newCard = list.cards[list.cards.length - 1];
                
                if (newCard && list.cards.length > 1) {
                    list.cards.pop();
                    list.cards.unshift(newCard);
                    
                    if (list.cards[0].position !== undefined) {
                        const minPosition = Math.min(...list.cards.map(c => c.position)) - 1;
                        newCard.position = minPosition;
                        
                        const cardIds = list.cards.map(card => card.id);
                        await saveCardsOrder(listId, cardIds);
                    }
                    
                    if (typeof window.renderLists === 'function') window.renderLists();
                }
            } catch (error) {
                console.error('Error in patched handleCreateCard:', error);
            }
        };
    }
}

function setupApiMonitoring() {
    // Create a proxy for the original fetch function
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options) {
        const fetchPromise = originalFetch.apply(this, arguments);
        
        // Only intercept our relevant API calls
        if (typeof url === 'string' && url.includes('/boards')) {
            fetchPromise.then(() => {
                // Wait a bit for the data to be processed
                setTimeout(() => {
                    // Re-run our fixes to ensure creator info is shown
                    fixCardAssignmentIssues();
                }, 500);
            }).catch(() => {});
        }
        
        return fetchPromise;
    };
}

function overrideFormSubmitHandlers() {
    // Check if create card form exists
    const createCardForm = document.getElementById('createCardForm');
    if (createCardForm) {
        // Skip if already overridden
        if (createCardForm._overridden) return;
        
        // Store original handler
        const originalSubmitHandler = createCardForm.onsubmit;
        
        // Override with our handler
        createCardForm.onsubmit = async function(event) {
            event.preventDefault();
            
            // If there's no multi-select, use original handler
            const assigneesSelect = document.getElementById('cardAssignees');
            if (!assigneesSelect) {
                if (originalSubmitHandler) {
                    return originalSubmitHandler.call(this, event);
                }
                return true;
            }
            
            // Get form data
            const listId = parseInt(this.dataset.listId);
            if (!listId || !window.activeBoard) {
                console.error("Missing list ID or active board");
                return false;
            }
            
            // Check if required elements exist
            const titleElement = document.getElementById('cardTitle');
            const descriptionElement = document.getElementById('cardDescription');
            const priorityElement = document.getElementById('cardPriority');
            const deadlineElement = document.getElementById('cardDeadline');
            
            // Only get values if elements exist
            const title = titleElement ? titleElement.value.trim() : '';
            const description = descriptionElement ? descriptionElement.value.trim() : '';
            const priority = priorityElement ? priorityElement.value : 'medium';
            const deadline = deadlineElement ? deadlineElement.value : '';
            
            // Get selected users
            const selectedUsers = Array.from(assigneesSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(id => !isNaN(id));
            
            if (!title) {
                alert("Title is required");
                return false;
            }
            
            try {
                console.log("Creating card with multi-user assignment:", selectedUsers);
                
                // Create basic card
                const apiBaseUrl = getApiBaseUrl();
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
                const cardId = newCard.id;
                
                // Operations array
                const operations = [];
                
                // Add todos
                const todoItems = document.querySelectorAll('#todoItems .todo-input');
                for (const input of todoItems) {
                    const content = input.value.trim();
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
                    operations.push(
                        fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
                        })
                    );
                }
                
                // Assign users
                if (selectedUsers.length > 0) {
                    operations.push(
                        fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_ids: selectedUsers }),
                        })
                    );
                    
                    // Store assignments for client-side use
                    if (typeof window.cardAssignments !== 'undefined') {
                        window.cardAssignments.set(cardId, selectedUsers);
                    } else {
                        window.cardAssignments = new Map();
                        window.cardAssignments.set(cardId, selectedUsers);
                    }
                }
                
                // Execute operations
                await Promise.allSettled(operations);
                
                // Reload and render
                if (typeof window.loadCards === 'function') {
                    await window.loadCards(activeBoard.id, listId);
                }
                
                if (typeof window.renderLists === 'function') {
                    window.renderLists();
                }
                
                // Close modal
                if (typeof window.closeAllModals === 'function') {
                    window.closeAllModals();
                }
                
                // Show success message
                if (typeof window.showToast === 'function') {
                    window.showToast('Success', 'Card created successfully', 'success');
                } else {
                    alert('Card created successfully');
                }
                
                // Run fixes to ensure creator info is shown
                setTimeout(fixCardCreatorInfo, 500);
                
                return false;
            } catch (error) {
                console.error("Error creating card with multiple assignees:", error);
                
                // Fallback to original handler
                if (originalSubmitHandler) {
                    return originalSubmitHandler.call(this, event);
                }
                
                return false;
            }
        };
        
        // Mark as overridden to prevent multiple overrides
        createCardForm._overridden = true;
    }
    
    // Check if edit card form exists
    const editCardForm = document.getElementById('editCardForm');
    if (editCardForm) {
        // Skip if already overridden
        if (editCardForm._overridden) return;
        
        // Store original handler
        const originalSubmitHandler = editCardForm.onsubmit;
        
        // Override with our handler
        editCardForm.onsubmit = async function(event) {
            event.preventDefault();
            
            // If there's no multi-select, use original handler
            const assigneesSelect = document.getElementById('editCardAssignees');
            if (!assigneesSelect) {
                if (originalSubmitHandler) {
                    return originalSubmitHandler.call(this, event);
                }
                return true;
            }
            
            // Get form data
            const cardId = parseInt(this.dataset.cardId);
            const listId = parseInt(this.dataset.listId);
            if (!cardId || !listId || !window.activeBoard) {
                console.error("Missing card ID, list ID, or active board");
                return false;
            }
            
            // Check if required elements exist
            const titleElement = document.getElementById('editCardTitle');
            const descriptionElement = document.getElementById('editCardDescription');
            const priorityElement = document.getElementById('editCardPriority');
            const deadlineElement = document.getElementById('editCardDeadline');
            const completedElement = document.getElementById('editCardCompleted');
            
            // Only get values if elements exist
            const title = titleElement ? titleElement.value.trim() : '';
            const description = descriptionElement ? descriptionElement.value.trim() : '';
            const priority = priorityElement ? priorityElement.value : 'medium';
            const deadline = deadlineElement ? deadlineElement.value : '';
            const completed = completedElement ? completedElement.checked : false;
            
            // Get selected users
            const selectedUsers = Array.from(assigneesSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(id => !isNaN(id));
            
            if (!title) {
                alert("Title is required");
                return false;
            }
            
            try {
                console.log("Updating card with multi-user assignment:", selectedUsers);
                
                // Operations array
                const apiBaseUrl = getApiBaseUrl();
                const operations = [];
                
                // Update card basics
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
                
                // Update completion status
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/toggle-completion`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed }),
                    })
                );
                
                // Update deadline
                if (deadline) {
                    operations.push(
                        fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/deadline`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
                        })
                    );
                }
                
                // Assign users
                operations.push(
                    fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_ids: selectedUsers }),
                    })
                );
                
                // Store assignments for client-side use
                if (typeof window.cardAssignments !== 'undefined') {
                    window.cardAssignments.set(cardId, selectedUsers);
                } else {
                    window.cardAssignments = new Map();
                    window.cardAssignments.set(cardId, selectedUsers);
                }
                
                // Handle todos
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
                
                // Execute operations
                await Promise.allSettled(operations);
                
                // Reload and render
                if (typeof window.loadCards === 'function') {
                    await window.loadCards(activeBoard.id, listId);
                }
                
                if (typeof window.renderLists === 'function') {
                    window.renderLists();
                }
                
                // Close modal
                if (typeof window.closeAllModals === 'function') {
                    window.closeAllModals();
                }
                
                // Show success message
                if (typeof window.showToast === 'function') {
                    window.showToast('Success', 'Card updated successfully', 'success');
                } else {
                    alert('Card updated successfully');
                }
                
                // Run fixes to ensure creator info is shown
                setTimeout(fixCardCreatorInfo, 500);
                
                return false;
            } catch (error) {
                console.error("Error updating card with multiple assignees:", error);
                
                // Fallback to original handler
                if (originalSubmitHandler) {
                    return originalSubmitHandler.call(this, event);
                }
                
                return false;
            }
        };
        
        // Mark as overridden to prevent multiple overrides
        editCardForm._overridden = true;
    }
}

// ========================
// FIXER FUNCTIONS
// ========================

function fixCardAssignmentIssues() {
    // Fix 1: Make sure all boards show creator info
    const boardsFixed = fixBoardCreatorInfo();
    
    // Fix 2: Make sure all cards show creator info
    const cardsFixed = fixCardCreatorInfo();
    
    // Fix 3: Fix modal forms for multi-user assignment
    fixModalForms();
    
    // Fix 4: Load board users when a board is selected
    fixBoardUserLoading();
    
    // Retry if any fixes failed and window.boards or window.lists exists
    if ((!boardsFixed && window.boards && window.boards.length > 0) || 
        (!cardsFixed && window.lists && window.lists.length > 0)) {
        console.log("Some fixes did not complete - scheduling retry in 1 second");
        setTimeout(fixCardAssignmentIssues, 1000);
    }
}

function fixBoardCreatorInfo() {
    let fixedCount = 0;
    let totalBoards = 0;
    
    // Check if window.boards is available
    if (!window.boards || !Array.isArray(window.boards)) {
        console.warn("Boards data not available yet");
        return false;
    }
    
    // Print some debug information
    console.log(`Found ${window.boards.length} boards in data`);
    
    const boardItems = document.querySelectorAll('.board-item');
    totalBoards = boardItems.length;
    console.log(`Found ${totalBoards} board items in DOM`);
    
    boardItems.forEach(boardItem => {
        // Skip if already fixed
        if (boardItem.querySelector('.board-creator-info')) {
            fixedCount++;
            return;
        }
        
        try {
            const boardId = parseInt(boardItem.dataset.boardId);
            if (!boardId) {
                console.warn("Board item missing board ID", boardItem);
                return;
            }
            
            const board = window.boards.find(b => b.id === boardId);
            if (!board) {
                console.warn(`Board data not found for ID: ${boardId}`);
                return;
            }
            
            if (!board.created_at || !board.user_id) {
                console.warn(`Board ${boardId} missing creator info:`, 
                    board.created_at ? "has created_at" : "NO created_at",
                    board.user_id ? "has user_id" : "NO user_id");
                return;
            }
            
            // Get creator name
            let creatorName = 'Unknown';
            if (window.users) {
                const creator = window.users.find(u => u.id === board.user_id);
                if (creator) {
                    creatorName = creator.username || creator.name || `User ${creator.id}`;
                }
            }
            
            // Format date
            let creationDate;
            if (typeof formatDate === 'function') {
                creationDate = formatDate(new Date(board.created_at));
            } else {
                creationDate = new Date(board.created_at).toLocaleDateString();
            }
            
            // Create and add creator info element
            const creatorInfo = document.createElement('div');
            creatorInfo.className = 'board-creator-info';
            creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
            
            // Find the board name and append to it
            const boardName = boardItem.querySelector('.board-name');
            if (boardName) {
                boardName.appendChild(creatorInfo);
                console.log(`Fixed creator info for board: ${board.name || boardId}`);
                fixedCount++;
            } else {
                console.warn(`Could not find .board-name element for board: ${board.name || boardId}`);
                // Try appending to the board item itself as fallback
                boardItem.appendChild(creatorInfo);
                fixedCount++;
            }
        } catch (error) {
            console.error("Error fixing board creator info:", error);
        }
    });
    
    console.log(`Fixed ${fixedCount} out of ${totalBoards} boards`);
    return fixedCount === totalBoards;
}

function fixCardCreatorInfo() {
    let fixedCount = 0;
    let totalCards = 0;
    
    if (!window.lists || !Array.isArray(window.lists)) {
        console.warn("Lists data not available yet");
        return false;
    }
    
    const cardElements = document.querySelectorAll('.card');
    totalCards = cardElements.length;
    console.log(`Found ${totalCards} cards in DOM`);
    
    cardElements.forEach(cardElement => {
        // Skip if already fixed
        if (cardElement.querySelector('.creator-info')) {
            fixedCount++;
            return;
        }
        
        try {
            const cardId = parseInt(cardElement.dataset.cardId);
            const listId = parseInt(cardElement.dataset.listId);
            
            if (!cardId || !listId) {
                console.warn("Card missing ID attributes:", 
                    cardId ? "has cardId" : "NO cardId", 
                    listId ? "has listId" : "NO listId");
                return;
            }
            
            // Find card data
            const list = window.lists.find(l => l.id === listId);
            if (!list || !list.cards) {
                console.warn(`List ${listId} not found or has no cards`);
                return;
            }
            
            const card = list.cards.find(c => c.id === cardId);
            if (!card) {
                console.warn(`Card ${cardId} not found in list ${listId}`);
                return;
            }
            
            if (!card.created_at || !card.user_id) {
                console.warn(`Card ${cardId} missing creator info:`,
                    card.created_at ? "has created_at" : "NO created_at",
                    card.user_id ? "has user_id" : "NO user_id");
                
                // Use fallback values if possible
                if (!card.created_at && !card.user_id) {
                    return; // Skip if both missing
                }
            }
            
            // Get creator name
            let creatorName = 'Unknown';
            if (window.users && card.user_id) {
                const creator = window.users.find(u => u.id === card.user_id);
                if (creator) {
                    creatorName = creator.username || creator.name || `User ${creator.id}`;
                }
            }
            
            // Format date
            let creationDate = 'unknown date';
            if (card.created_at) {
                try {
                    if (typeof formatDate === 'function') {
                        creationDate = formatDate(new Date(card.created_at));
                    } else {
                        creationDate = new Date(card.created_at).toLocaleDateString();
                    }
                } catch (e) {
                    console.error('Error formatting date:', e);
                }
            }
            
            // Create and add creator info element
            const creatorInfo = document.createElement('div');
            creatorInfo.className = 'creator-info';
            creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
            
            // Try multiple insertion strategies
            // 1. After card header
            const cardHeader = cardElement.querySelector('.card-header');
            if (cardHeader && cardHeader.nextSibling) {
                cardElement.insertBefore(creatorInfo, cardHeader.nextSibling);
                fixedCount++;
                return;
            }
            
            // 2. Before card info
            const cardInfo = cardElement.querySelector('.card-info');
            if (cardInfo) {
                cardElement.insertBefore(creatorInfo, cardInfo);
                fixedCount++;
                return;
            }
            
            // 3. Before card actions
            const cardActions = cardElement.querySelector('.card-actions');
            if (cardActions) {
                cardElement.insertBefore(creatorInfo, cardActions);
                fixedCount++;
                return;
            }
            
            // 4. Just append to the card
            cardElement.appendChild(creatorInfo);
            fixedCount++;
            
            console.log(`Fixed creator info for card: ${card.title || cardId}`);
        } catch (error) {
            console.error("Error fixing card creator info:", error);
        }
    });
    
    console.log(`Fixed ${fixedCount} out of ${totalCards} cards`);
    return fixedCount === totalCards;
}

function fixModalForms() {
    // Fix create card modal
    const createCardModal = document.getElementById('createCardModal');
    if (createCardModal && !document.getElementById('cardAssignees')) {
        try {
            // Find form group for single assignee
            const existingAssigneeGroup = document.querySelector('#createCardModal [for="cardAssignee"]')?.closest('.form-group');
            
            if (existingAssigneeGroup) {
                // Replace with multi-select
                existingAssigneeGroup.innerHTML = `
                    <label for="cardAssignees">Assignees</label>
                    <select id="cardAssignees" multiple class="form-control">
                        <option value="" disabled>Select assignees</option>
                    </select>
                    <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
                `;
            } else {
                // Create new form group
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                formGroup.innerHTML = `
                    <label for="cardAssignees">Assignees</label>
                    <select id="cardAssignees" multiple class="form-control">
                        <option value="" disabled>Select assignees</option>
                    </select>
                    <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
                `;
                
                // Insert after priority field
                const priorityGroup = createCardModal.querySelector('[for="cardPriority"]')?.closest('.form-group');
                if (priorityGroup && priorityGroup.nextSibling) {
                    priorityGroup.parentNode.insertBefore(formGroup, priorityGroup.nextSibling);
                } else {
                    const modalBody = createCardModal.querySelector('.modal-body');
                    if (modalBody) {
                        modalBody.appendChild(formGroup);
                    }
                }
                console.log("Added multi-select assignees to create modal");
            }
            
            // Populate with board users
            populateMultiSelect('cardAssignees');
        } catch (error) {
            console.error("Error fixing create card modal:", error);
        }
    }
    
    // Fix edit card modal
    const editCardModal = document.getElementById('editCardModal');
    if (editCardModal && !document.getElementById('editCardAssignees')) {
        try {
            // Find form group for single assignee
            const existingAssigneeGroup = document.querySelector('#editCardModal [for="editCardAssignee"]')?.closest('.form-group');
            
            if (existingAssigneeGroup) {
                // Replace with multi-select
                existingAssigneeGroup.innerHTML = `
                    <label for="editCardAssignees">Assignees</label>
                    <select id="editCardAssignees" multiple class="form-control">
                        <option value="" disabled>Select assignees</option>
                    </select>
                    <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
                `;
            } else {
                // Create new form group
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                formGroup.innerHTML = `
                    <label for="editCardAssignees">Assignees</label>
                    <select id="editCardAssignees" multiple class="form-control">
                        <option value="" disabled>Select assignees</option>
                    </select>
                    <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
                `;
                
                // Insert after priority field
                const priorityGroup = editCardModal.querySelector('[for="editCardPriority"]')?.closest('.form-group');
                if (priorityGroup && priorityGroup.nextSibling) {
                    priorityGroup.parentNode.insertBefore(formGroup, priorityGroup.nextSibling);
                } else {
                    const modalBody = editCardModal.querySelector('.modal-body');
                    if (modalBody) {
                        modalBody.appendChild(formGroup);
                    }
                }
                console.log("Added multi-select assignees to edit modal");
            }
            
            // Populate with board users
            populateMultiSelect('editCardAssignees');
        } catch (error) {
            console.error("Error fixing edit card modal:", error);
        }
    }
}

function fixBoardUserLoading() {
    if (!window.activeBoard || !window.activeBoard.id) {
        return;
    }
    
    // Check if board users are already loaded
    if (!window.boardAssignableUsers || window.boardAssignableUsers.length === 0) {
        // Fetch board users
        const boardId = window.activeBoard.id;
        const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
        
        console.log(`Loading assignable users for board ${boardId}`);
        
        fetch(`${apiBaseUrl}/boards/${boardId}/users`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch board users. Status: ${response.status}`);
                }
                return response.json();
            })
            .then(users => {
                window.boardAssignableUsers = users;
                console.log('Board assignable users loaded:', users.length, 'users');
                
                // Update multi-selects
                populateMultiSelect('cardAssignees');
                populateMultiSelect('editCardAssignees');
                
                // Also fix creator info after users are loaded
                setTimeout(() => {
                    fixBoardCreatorInfo();
                    fixCardCreatorInfo();
                }, 200);
            })
            .catch(error => {
                console.error('Error loading board users:', error);
                
                // Retry after a delay
                setTimeout(fixBoardUserLoading, 2000);
            });
    }
}

// ========================
// HELPER FUNCTIONS
// ========================

function getApiBaseUrl() {
    return window.location.hostname === 'localhost' ? '' : '/kanban';
}

async function saveCardsOrder(listId, cardIds) {
    if (!window.activeBoard) return;
    
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/boards/${window.activeBoard.id}/lists/${listId}/cards/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_ids: cardIds }),
        });
        
        if (!response.ok) throw new Error(`Failed to save cards order. Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error saving cards order:', error);
        throw error;
    }
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + (parts[parts.length-1].charAt(0)).toUpperCase());
}

function openModal(modal) {
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = '';
}

// ========================
// STYLE FUNCTIONS
// ========================

function addCardAssignmentStyles() {
    // Check if styles have already been added
    if (document.getElementById('card-assignment-styles')) {
        return;
    }
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'card-assignment-styles';
    
    // Add CSS rules
    style.textContent = `
        .creator-info {
            font-size: 12px;
            color: #495057;
            margin: 6px 0;
            padding: 4px;
            font-style: italic;
            border-top: 1px solid #dee2e6;
            border-bottom: 1px solid #dee2e6;
            background-color: rgba(0, 0, 0, 0.03);
            text-align: center;
        }
        
        .board-creator-info {
            font-size: 11px;
            color: #495057;
            margin-top: 6px;
            font-style: italic;
            display: block;
            background-color: rgba(0, 0, 0, 0.03);
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        .select-with-search {
            position: relative;
            display: flex;
            flex-direction: column;
        }
        
        .select-with-search .search-input {
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            font-size: 14px;
        }
        
        .select-with-search select {
            border-top-left-radius: 0;
            border-top-right-radius: 0;
        }
        
        select[multiple] {
            height: auto !important;
            min-height: 120px;
        }
        
        select[multiple] option {
            padding: 6px 8px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        select[multiple] option:checked {
            background-color: #007bff !important;
            color: white !important;
        }
        
        .btn-toggle-completion.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    `;
    
    // Add style element to the head
    document.head.appendChild(style);
}

function addBoardSharingStyles() {
    // Check if styles have already been added
    if (document.getElementById('board-sharing-styles')) {
        return;
    }
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'board-sharing-styles';
    
    // Add CSS rules
    style.textContent = `
        .user-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .user-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .user-info {
            display: flex;
            align-items: center;
        }
        
        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background-color: #3788d8;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 10px;
        }
        
        .user-name {
            font-weight: 500;
        }
        
        .user-role {
            font-size: 0.8em;
            color: #666;
            margin-left: 8px;
        }
        
        .btn-remove-user {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            padding: 5px 8px;
            border-radius: 4px;
        }
        
        .btn-remove-user:hover {
            background-color: #f9e6e6;
        }
        
        .empty-users-message {
            text-align: center;
            padding: 20px;
            color: #666;
        }
    `;
    
    // Add style element to the head
    document.head.appendChild(style);
}

function showToast(title, message, type = 'info') {
    // Check if the original showToast exists and is different from this one
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(title, message, type);
        return;
    }
    
    // Fallback implementation
    let toastContainer = document.getElementById('toastContainer') || 
                       document.querySelector('.toast-container');
    
    if (!toastContainer) {
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.className = 'toast-container';
        newContainer.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 1100;';
        document.body.appendChild(newContainer);
        toastContainer = newContainer;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = 'display: flex; align-items: center; padding: 12px 16px; margin-bottom: 8px; background-color: white; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); max-width: 300px; animation: fadeIn 0.3s, fadeOut 0.3s 3s';
    
    switch (type) {
        case 'success': toast.style.borderLeft = '4px solid #10b981'; break;
        case 'error': toast.style.borderLeft = '4px solid #ef4444'; break;
        case 'info': toast.style.borderLeft = '4px solid #3b82f6'; break;
        case 'warning': toast.style.borderLeft = '4px solid #f59e0b'; break;
    }
    
    toast.innerHTML = `
        <div style="margin-right: 12px; font-size: 20px;">
            ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '⚠️'}
        </div>
        <div>
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 14px; color: #4b5563;">${message}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes fadeOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
        `;
        document.head.appendChild(style);
    }
}
// Add this code to a new file called board-specific-user-fix.js or add it at the end of card_assignment.js

/**
 * Enhanced Board-Specific User Assignment Fix
 * 
 * This script ensures that when assigning users to cards, only users who have
 * access to the current board are displayed in the dropdown menus.
 */

// Store board-specific users
window.boardAssignableUsers = window.boardAssignableUsers || [];
window.cardAssignments = window.cardAssignments || new Map();

// Load board users when a board is selected
async function loadBoardUsers(boardId) {
    console.log("Loading users for board:", boardId);
    
    if (!boardId) {
        console.warn("No board ID provided to loadBoardUsers");
        return [];
    }
    
    try {
        const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
        const response = await fetch(`${apiBaseUrl}/boards/${boardId}/users`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch board users. Status: ${response.status}`);
        }
        
        const users = await response.json();
        console.log('Board users loaded:', users);
        
        // Update global variable for board users
        window.boardAssignableUsers = users;
        
        // Update all user dropdowns
        updateAllUserDropdowns();
        
        return users;
    } catch (error) {
        console.error('Error loading board users:', error);
        return [];
    }
}

// Update all user selection dropdowns with board-specific users
function updateAllUserDropdowns() {
    // Update create card form
    updateDropdown('cardAssignee');
    updateMultiSelect('cardAssignees');
    
    // Update edit card form
    updateDropdown('editCardAssignee');
    updateMultiSelect('editCardAssignees');
}

// Update a single-select dropdown with board users
function updateDropdown(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    // Clear existing options but keep the first one (usually "Not assigned")
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Use board-specific users if available, otherwise fall back to all users
    const usersToShow = window.boardAssignableUsers && window.boardAssignableUsers.length > 0 
        ? window.boardAssignableUsers 
        : window.users;
    
    if (!usersToShow || !Array.isArray(usersToShow)) {
        console.warn(`No users available to populate ${elementId}`);
        return;
    }
    
    // Add users to the dropdown
    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username || user.name || `User ${user.id}`;
        select.appendChild(option);
    });
    
    console.log(`Updated dropdown ${elementId} with ${usersToShow.length} users`);
}

// Update a multi-select dropdown with board users
function updateMultiSelect(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    // Clear existing options (keep first option if it's a "Select users" placeholder)
    const firstOption = select.options[0];
    const keepFirst = firstOption && firstOption.disabled;
    
    while (select.options.length > (keepFirst ? 1 : 0)) {
        select.remove(keepFirst ? 1 : 0);
    }
    
    // Use board-specific users if available, otherwise fall back to all users
    const usersToShow = window.boardAssignableUsers && window.boardAssignableUsers.length > 0 
        ? window.boardAssignableUsers 
        : window.users;
    
    if (!usersToShow || !Array.isArray(usersToShow)) {
        console.warn(`No users available to populate ${elementId}`);
        return;
    }
    
    // Add users to the dropdown
    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username || user.name || `User ${user.id}`;
        select.appendChild(option);
    });
    
    console.log(`Updated multi-select ${elementId} with ${usersToShow.length} users`);
}

// Hook into the board selection process to load board users
const originalSelectBoard = window.selectBoard;
window.selectBoard = function(board) {
    // Call the original selectBoard function
    if (typeof originalSelectBoard === 'function') {
        originalSelectBoard(board);
    }
    
    // Load board users after selecting a board
    if (board && board.id) {
        setTimeout(() => {
            loadBoardUsers(board.id);
        }, 300);
    }
};

// Hook into the openCreateCardModal function to ensure user dropdowns are up to date
const originalOpenCreateCardModal = window.openCreateCardModal;
window.openCreateCardModal = function(listId) {
    // Call the original function
    if (typeof originalOpenCreateCardModal === 'function') {
        originalOpenCreateCardModal(listId);
    } else {
        // Default implementation if original function is missing
        const createCardForm = document.getElementById('createCardForm');
        if (createCardForm) {
            createCardForm.dataset.listId = listId;
        }
        
        // Open modal
        if (typeof openModal === 'function') {
            openModal(document.getElementById('createCardModal'));
        }
    }
    
    // Update user dropdowns
    setTimeout(() => {
        // Update single-select if it exists
        const cardAssignee = document.getElementById('cardAssignee');
        if (cardAssignee) {
            updateDropdown('cardAssignee');
        }
        
        // Update multi-select if it exists
        const cardAssignees = document.getElementById('cardAssignees');
        if (cardAssignees) {
            updateMultiSelect('cardAssignees');
        }
    }, 100);
};

// Hook into the openEditCardModal function to ensure user dropdowns are up to date
const originalOpenEditCardModal = window.openEditCardModal;
window.openEditCardModal = function(cardId, listId) {
    // Call the original function
    if (typeof originalOpenEditCardModal === 'function') {
        originalOpenEditCardModal(cardId, listId);
    }
    
    // Find the card in the lists
    let card = null;
    if (window.lists) {
        for (const list of window.lists) {
            if (list.cards) {
                const foundCard = list.cards.find(c => c.id === cardId);
                if (foundCard) {
                    card = foundCard;
                    break;
                }
            }
        }
    }
    
    setTimeout(() => {
        // Update user dropdowns
        const editCardAssignee = document.getElementById('editCardAssignee');
        if (editCardAssignee) {
            updateDropdown('editCardAssignee');
            
            // Select the correct user
            if (card && card.assigned_to) {
                editCardAssignee.value = card.assigned_to;
            }
        }
        
        // Update multi-select if it exists
        const editCardAssignees = document.getElementById('editCardAssignees');
        if (editCardAssignees) {
            updateMultiSelect('editCardAssignees');
            
            // Select the assigned users
            if (card) {
                if (card.assigned_users && Array.isArray(card.assigned_users)) {
                    // Use assigned_users array if available
                    const assignedIds = card.assigned_users.map(user => user.id);
                    
                    for (let i = 0; i < editCardAssignees.options.length; i++) {
                        const option = editCardAssignees.options[i];
                        option.selected = assignedIds.includes(parseInt(option.value));
                    }
                } else if (card.assigned_to) {
                    // Fallback to single assigned_to
                    for (let i = 0; i < editCardAssignees.options.length; i++) {
                        const option = editCardAssignees.options[i];
                        option.selected = parseInt(option.value) === parseInt(card.assigned_to);
                    }
                }
            }
        }
    }, 100);
};

// Create a MutationObserver to watch for modal openings
function setupModalObserver() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                
                // Check if a modal was opened
                if (target.classList.contains('active') || target.classList.contains('show')) {
                    if (target.id === 'createCardModal') {
                        updateAllUserDropdowns();
                    } else if (target.id === 'editCardModal') {
                        updateAllUserDropdowns();
                    }
                }
            }
        });
    });
    
    // Observe all existing modals
    document.querySelectorAll('.modal').forEach(modal => {
        observer.observe(modal, { attributes: true });
    });
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Board-specific user assignment fix initializing...");
    
    // Load users for the active board if there is one
    if (window.activeBoard) {
        loadBoardUsers(window.activeBoard.id);
    }
    
    // Set up observer for modals
    setupModalObserver();
    
    // If you have a board list with clickable boards, ensure they load users on click
    const boardsList = document.getElementById('boardsList');
    if (boardsList) {
        boardsList.addEventListener('click', function(e) {
            const boardItem = e.target.closest('.board-item');
            if (boardItem && !e.target.closest('.board-actions')) {
                const boardId = parseInt(boardItem.dataset.boardId);
                if (boardId) {
                    setTimeout(() => {
                        loadBoardUsers(boardId);
                    }, 300);
                }
            }
        });
    }
    
    console.log("Board-specific user assignment fix initialized");
});

// Optional: Replace the existing populateUserSelect and populateMultiSelect functions
// with our new versions that use board-specific users
window.populateUserSelect = updateDropdown;
window.populateMultiSelect = updateMultiSelect;