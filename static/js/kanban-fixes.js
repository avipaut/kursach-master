// Fix 1: Improve styling for list action icons
// Add this function to add better styling for list action buttons
function improveListActionIconStyling() {
    // Create CSS styles for better list action buttons
    const style = document.createElement('style');
    style.textContent = `
        /* Improved list action buttons */
        .list-actions {
            display: flex;
            gap: 8px;
            margin-left: 8px;
        }
        
        .list-actions button {
            width: 28px;
            height: 28px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .list-actions .btn-list-color:hover {
            background-color: #f0f7ff;
            color: #3b82f6;
        }
        
        .list-actions .btn-edit:hover {
            background-color: #f5f3ff;
            color: var(--primary-color);
        }
        
        .list-actions .btn-delete:hover {
            background-color: #fee2e2;
            color: var(--danger-color);
        }
    `;
    document.head.appendChild(style);
    
    // Apply the improved style to existing list action buttons
    document.querySelectorAll('.list-actions button').forEach(button => {
        button.style.width = '28px';
        button.style.height = '28px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
    });
}

// Fix 2: Always display creator info for boards
function fixBoardCreatorDisplay() {
    // Override the renderBoards function to always show creator info
    if (typeof window.renderBoards === 'function') {
        window.originalRenderBoards = window.renderBoards;
        window.renderBoards = function() {
            const boardsList = document.getElementById('boardsList');
            const loadingSpinner = document.getElementById('boardsLoading');
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
                
                // Always set creator info, with fallbacks
                const creatorName = board.creator_name || 
                                    (board.user_id && users ? 
                                     (users.find(u => u.id === board.user_id)?.username || 'System User') : 
                                     'System User');
                
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
        };
    }
}

// Fix 3: Ensure card creators are always displayed
function fixCardCreatorDisplay() {
    // Override the createCardElement function to always show creator info
    if (typeof window.createCardElement === 'function') {
        window.originalCreateCardElement = window.createCardElement;
        window.createCardElement = function(card, listId) {
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
                
                // Always set creator info with fallbacks
                let creatorName = 'System User';
                if (card.user_id && window.users && Array.isArray(window.users)) {
                    const creator = window.users.find(user => user && user.id === card.user_id);
                    if (creator) {
                        creatorName = creator.username || creator.name || `User ${creator.id}`;
                    }
                }
                
                // Format creation date with fallback
                let creationDate = 'Unknown date';
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
                
                // Fix 5: Generate assignee HTML with only avatars, no text
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
                    
                    assigneesHtml += `</div></div>`;
                } else if (card.assigned_to && window.users && Array.isArray(window.users)) {
                    // Fallback to single assigned_to property if assigned_users isn't available
                    const assignedUser = window.users.find(user => user && user.id === parseInt(card.assigned_to));
                    if (assignedUser) {
                        const initials = typeof getInitials === 'function' ? 
                            getInitials(assignedUser.username || assignedUser.name || '') : 
                            (assignedUser.username ? assignedUser.username.charAt(0).toUpperCase() : '?');
                        
                        assigneesHtml = `
                            <div class="user-avatar-group">
                                <div class="user-avatar small" title="${assignedUser.username || assignedUser.name || 'User ' + assignedUser.id}">
                                    ${initials}
                                </div>
                            </div>
                        `;
                    }
                }
                
                // Deadline HTML
                let deadlineHtml = '';
                if (card.deadline) {
                    try {
                        const deadline = new Date(card.deadline);
                        const now = new Date();
                        const isOverdue = deadline < now && !card.completed;
                        
                        const formattedDate = typeof formatDate === 'function' ? 
                            formatDate(deadline) : 
                            deadline.toLocaleDateString();
                        
                        const formattedDateWithTime = typeof formatDate === 'function' ? 
                            formatDate(deadline, true) : 
                            deadline.toLocaleString();
                        
                        deadlineHtml = `
                            <div class="deadline ${isOverdue ? 'overdue' : ''}" title="${formattedDateWithTime}">
                                <i class="fas fa-calendar-alt"></i>
                                <span>${formattedDate}</span>
                            </div>
                        `;
                    } catch (e) {
                        console.error('Error formatting deadline:', e);
                    }
                }
                
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
                
                // Build the card content with creator info after the header
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
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn-delete-card" title="Delete card">
                                <i class="fas fa-trash-alt"></i>
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
        };
    }
}

// Fix 4: Pre-select assigned users in edit card modal
function fixUserAssignmentInModals() {
    // Override the openEditCardModal function to pre-select assigned users
    if (typeof window.openEditCardModal === 'function') {
        window.originalOpenEditCardModal = window.openEditCardModal;
        window.openEditCardModal = function(cardId, listId) {
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
                        option.selected = assignedIds.includes(parseInt(option.value));
                    });
                } else if (card.assigned_to) {
                    // Fallback to single assigned_to
                    Array.from(multiAssigneesElement.options).forEach(option => {
                        option.selected = parseInt(option.value) === parseInt(card.assigned_to);
                    });
                }
            } else {
                // Handle single select assignee if that's what we have
                const assigneeElement = document.getElementById('editCardAssignee');
                if (assigneeElement) {
                    populateUserSelect(assigneeElement);
                    assigneeElement.value = card.assigned_to ? card.assigned_to.toString() : '';
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
        };
    }
    
    // Also fix the createCardModal to pre-select users
    if (typeof window.openCreateCardModal === 'function') {
        window.originalOpenCreateCardModal = window.openCreateCardModal;
        window.openCreateCardModal = function(listId) {
            // Save list ID in the form
            const createCardForm = document.getElementById('createCardForm');
            if (createCardForm) {
                createCardForm.dataset.listId = listId;
            }
            
            // Clear form fields
            document.getElementById('cardTitle').value = '';
            document.getElementById('cardDescription').value = '';
            document.getElementById('cardPriority').value = 'medium';
            
            // Populate and clear assignee dropdown/multiselect
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
        };
    }
}

// Initialize all the fixes
function initKanbanFixes() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyFixes);
    } else {
        applyFixes();
    }
    
    function applyFixes() {
        console.log("Applying Kanban fixes...");
        
        // Apply all fixes
        improveListActionIconStyling();
        fixBoardCreatorDisplay();
        fixCardCreatorDisplay();
        fixUserAssignmentInModals();
        
        // Add CSS styles specifically for the fixes
        addFixStyles();
        
        console.log("Kanban fixes applied successfully");
    }
    
    function addFixStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Fix for card styling */
            .creator-info {
                font-size: 11px;
                color: #6c757d;
                margin: 4px 0 8px 0;
                font-style: italic;
                text-align: left;
                padding: 2px 0;
                border-top: 1px dotted #dee2e6;
                border-bottom: 1px dotted #dee2e6;
                background-color: rgba(0, 0, 0, 0.02);
            }
            
            /* Fix for assignees */
            .assignees-container {
                display: flex;
                align-items: center;
                margin-bottom: 0;
            }
            
            .user-avatar-group {
                display: flex;
                align-items: center;
            }
            
            .user-avatar.small {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: #3788d8;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 600;
                margin-right: -8px;
                border: 1px solid white;
                position: relative;
                z-index: 1;
            }
            
            .user-avatar.small:nth-child(2) {
                z-index: 2;
            }
            
            .user-avatar.small:nth-child(3) {
                z-index: 3;
            }
            
            .user-avatar.small.more {
                background-color: #6c757d;
                z-index: 4;
            }
        `;
        document.head.appendChild(style);
    }
}

// Call the initialization function
initKanbanFixes();