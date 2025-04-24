// improved_card_assignment.js
// This file handles multi-user assignment and creator information display

// Global variables
let boardAssignableUsers = [];
let cardAssignments = new Map(); // Map to store card-to-users assignments

// Wait until the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("Card assignment module loading...");
    
    // Add our CSS styles
    addCardAssignmentStyles();
    
    // Initialize after a short delay to ensure kanban.js has completed initialization
    setTimeout(() => {
        initializeCardAssignment();
    }, 500);
    
    // Also hook into DOM changes to handle dynamically created elements
    observeDOMChanges();
});

// Main initialization
function initializeCardAssignment() {
    console.log("Initializing card assignment features...");
    
    // Make sure existing cards and boards show creator info
    enhanceExistingCards();
    enhanceExistingBoards();
    
    // Override kanban.js functions to add our enhancements
    patchKanbanFunctions();
    
    // Set up board selection listener to load board users
    setupBoardSelectionListener();
    
    // Enhance modals for multi-user assignment
    setupMultiUserAssignment();
}

// Observer for DOM changes to enhance new elements
function observeDOMChanges() {
    // Create observer for board list (sidebar)
    const boardsList = document.getElementById('boardsList');
    if (boardsList) {
        const boardsObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    enhanceExistingBoards();
                }
            }
        });
        
        boardsObserver.observe(boardsList, { 
            childList: true, 
            subtree: true 
        });
    }
    
    // Create observer for lists container (main kanban board)
    const listsContainer = document.getElementById('listsContainer');
    if (listsContainer) {
        const listsObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    enhanceExistingCards();
                }
            }
        });
        
        listsObserver.observe(listsContainer, { 
            childList: true, 
            subtree: true 
        });
    }
}

// Enhance all currently displayed cards
function enhanceExistingCards() {
    console.log("Enhancing existing cards with creator info...");
    
    document.querySelectorAll('.card').forEach(cardElement => {
        if (cardElement.querySelector('.creator-info')) {
            return; // Skip if already enhanced
        }
        
        const cardId = parseInt(cardElement.dataset.cardId);
        const listId = parseInt(cardElement.dataset.listId);
        
        if (!cardId || !listId || !window.lists) return;
        
        // Find card data
        const list = window.lists.find(l => l.id === listId);
        if (!list || !list.cards) return;
        
        const card = list.cards.find(c => c.id === cardId);
        if (!card || !card.created_at || !card.user_id) return;
        
        // Find creator info
        const creator = window.users ? window.users.find(user => user.id === card.user_id) : null;
        const creatorName = creator ? creator.username : 'Unknown';
        
        // Format date (use original function if available)
        let creationDate = 'unknown date';
        try {
            if (typeof formatDate === 'function') {
                creationDate = formatDate(new Date(card.created_at));
            } else {
                creationDate = new Date(card.created_at).toLocaleDateString();
            }
        } catch (e) {
            console.error('Error formatting date:', e);
        }
        
        // Create creator info element
        const creatorInfo = document.createElement('div');
        creatorInfo.className = 'creator-info';
        creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
        
        // Insert after card header or at the beginning
        const cardHeader = cardElement.querySelector('.card-header');
        if (cardHeader && cardHeader.nextSibling) {
            cardElement.insertBefore(creatorInfo, cardHeader.nextSibling);
        } else {
            cardElement.insertBefore(creatorInfo, cardElement.firstChild);
        }
    });
}

// Enhance all currently displayed boards
function enhanceExistingBoards() {
    console.log("Enhancing existing boards with creator info...");
    
    document.querySelectorAll('.board-item').forEach(boardItem => {
        if (boardItem.querySelector('.board-creator-info')) {
            return; // Skip if already enhanced
        }
        
        const boardId = parseInt(boardItem.dataset.boardId);
        if (!boardId || !window.boards) return;
        
        // Find board data
        const board = window.boards.find(b => b.id === boardId);
        if (!board || !board.created_at || !board.user_id) return;
        
        // Find creator info
        const creator = window.users ? window.users.find(user => user.id === board.user_id) : null;
        const creatorName = creator ? creator.username : 'Unknown';
        
        // Format date (use original function if available)
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

// Override kanban.js functions
function patchKanbanFunctions() {
    // Patch createCardElement to show creator info for new cards
    if (typeof window.createCardElement === 'function') {
        console.log("Patching createCardElement function");
        
        window.originalCreateCardElement = window.createCardElement;
        window.createCardElement = function(card, listId) {
            try {
                // Call original function
                const cardElement = window.originalCreateCardElement(card, listId);
                
                // Add creator info if not already present
                if (!cardElement.querySelector('.creator-info') && card.created_at && card.user_id) {
                    const creator = window.users ? window.users.find(user => user.id === card.user_id) : null;
                    const creatorName = creator ? creator.username : 'Unknown';
                    
                    let creationDate = 'unknown date';
                    try {
                        if (typeof formatDate === 'function') {
                            creationDate = formatDate(new Date(card.created_at));
                        } else {
                            creationDate = new Date(card.created_at).toLocaleDateString();
                        }
                    } catch (e) {
                        console.error('Error formatting date:', e);
                    }
                    
                    const creatorInfo = document.createElement('div');
                    creatorInfo.className = 'creator-info';
                    creatorInfo.innerHTML = `<small>Created by ${creatorName} on ${creationDate}</small>`;
                    
                    // Insert after card header or at the beginning
                    const cardHeader = cardElement.querySelector('.card-header');
                    if (cardHeader && cardHeader.nextSibling) {
                        cardElement.insertBefore(creatorInfo, cardHeader.nextSibling);
                    } else {
                        cardElement.insertBefore(creatorInfo, cardElement.firstChild);
                    }
                }
                
                return cardElement;
            } catch (error) {
                console.error('Error in patched createCardElement:', error);
                return window.originalCreateCardElement(card, listId);
            }
        };
    }
    
    // Patch renderBoards to add creator info
    if (typeof window.renderBoards === 'function') {
        console.log("Patching renderBoards function");
        
        window.originalRenderBoards = window.renderBoards;
        window.renderBoards = function() {
            try {
                // Call original function
                window.originalRenderBoards();
                
                // Now enhance all board items
                enhanceExistingBoards();
            } catch (error) {
                console.error('Error in patched renderBoards:', error);
                if (window.originalRenderBoards) {
                    window.originalRenderBoards();
                }
            }
        };
    }
    
    // Patch selectBoard to load assignable users
    if (typeof window.selectBoard === 'function') {
        console.log("Patching selectBoard function");
        
        window.originalSelectBoard = window.selectBoard;
        window.selectBoard = function(board) {
            try {
                // Call original function
                window.originalSelectBoard(board);
                
                // Load users assignable to this board
                if (board && board.id) {
                    loadBoardAssignableUsers(board.id);
                }
            } catch (error) {
                console.error('Error in patched selectBoard:', error);
                if (window.originalSelectBoard) {
                    window.originalSelectBoard(board);
                }
            }
        };
    }
}

// Set up board selection listener
function setupBoardSelectionListener() {
    // This function is used if we couldn't patch selectBoard directly
    console.log("Setting up board selection listener");
    
    document.querySelectorAll('.board-item').forEach(boardItem => {
        boardItem.addEventListener('click', function(event) {
            if (event.target.closest('.board-actions')) {
                return; // Skip if clicked on action buttons
            }
            
            const boardId = parseInt(this.dataset.boardId);
            if (!boardId) return;
            
            // Get board data
            const board = window.boards ? window.boards.find(b => b.id === boardId) : null;
            if (!board) return;
            
            // Load assignable users
            setTimeout(() => {
                loadBoardAssignableUsers(boardId);
            }, 500);
        });
    });
}

// Load board assignable users
async function loadBoardAssignableUsers(boardId) {
    console.log("Loading assignable users for board:", boardId);
    
    try {
        const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
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

// Set up multi-user assignment in modals
function setupMultiUserAssignment() {
    console.log("Setting up multi-user assignment");
    
    // Setup for create card modal
    setupCreateCardModal();
    
    // Setup for edit card modal
    setupEditCardModal();
}

// Set up create card modal for multi-user assignment
function setupCreateCardModal() {
    const createCardModal = document.getElementById('createCardModal');
    if (!createCardModal) {
        console.warn("Create card modal not found");
        return;
    }
    
    // Find or create the assignee field
    let assigneeField = document.getElementById('cardAssignee');
    const modalBody = createCardModal.querySelector('.modal-body');
    
    // If field not found, create it
    if (!assigneeField && modalBody) {
        console.log("Creating multi-select assignee field in create card modal");
        
        // Find position to insert (after priority)
        let insertAfter = modalBody.querySelector('.form-group:nth-child(3)');
        if (!insertAfter) {
            insertAfter = modalBody.lastElementChild;
        }
        
        // Create form group
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label for="cardAssignees">Assignees</label>
            <select id="cardAssignees" multiple class="form-control">
                <option value="" disabled>Select assignees</option>
            </select>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        // Insert into modal
        if (insertAfter.nextSibling) {
            modalBody.insertBefore(formGroup, insertAfter.nextSibling);
        } else {
            modalBody.appendChild(formGroup);
        }
        
        // Override form submission
        const form = createCardModal.querySelector('form');
        if (form) {
            form.addEventListener('submit', handleCreateCardWithMultipleAssignees);
        }
    }
}

// Set up edit card modal for multi-user assignment
function setupEditCardModal() {
    const editCardModal = document.getElementById('editCardModal');
    if (!editCardModal) {
        console.warn("Edit card modal not found");
        return;
    }
    
    // Find or create the assignee field
    let assigneeField = document.getElementById('editCardAssignee');
    const modalBody = editCardModal.querySelector('.modal-body');
    
    // If field not found, create it
    if (!assigneeField && modalBody) {
        console.log("Creating multi-select assignee field in edit card modal");
        
        // Find position to insert (after priority)
        let insertAfter = modalBody.querySelector('.form-group:nth-child(4)');
        if (!insertAfter) {
            insertAfter = modalBody.lastElementChild;
        }
        
        // Create form group
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label for="editCardAssignees">Assignees</label>
            <select id="editCardAssignees" multiple class="form-control">
                <option value="" disabled>Select assignees</option>
            </select>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        // Insert into modal
        if (insertAfter.nextSibling) {
            modalBody.insertBefore(formGroup, insertAfter.nextSibling);
        } else {
            modalBody.appendChild(formGroup);
        }
        
        // Override form submission
        const form = editCardModal.querySelector('form');
        if (form) {
            form.addEventListener('submit', handleUpdateCardWithMultipleAssignees);
        }
    }
}

// Set up multi-select dropdowns
function setupMultiSelectInModals() {
    // Clear and populate create modal dropdown
    const createSelect = document.getElementById('cardAssignees');
    if (createSelect) {
        // Clear existing options except first
        while (createSelect.options.length > 1) {
            createSelect.remove(1);
        }
        
        // Add board users
        boardAssignableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            createSelect.appendChild(option);
        });
    }
    
    // Clear and populate edit modal dropdown
    const editSelect = document.getElementById('editCardAssignees');
    if (editSelect) {
        // Clear existing options except first
        while (editSelect.options.length > 1) {
            editSelect.remove(1);
        }
        
        // Add board users
        boardAssignableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            editSelect.appendChild(option);
        });
    }
}

// Handle create card with multiple assignees
async function handleCreateCardWithMultipleAssignees(event) {
    event.preventDefault();
    
    if (!window.activeBoard) {
        console.error("No active board");
        return;
    }
    
    const form = event.target;
    const listId = parseInt(form.dataset.listId);
    if (!listId) {
        console.error("No list ID found");
        return;
    }
    
    // Get basic card information - check for existence before getting values
    const titleElement = document.getElementById('cardTitle');
    const descriptionElement = document.getElementById('cardDescription');
    const priorityElement = document.getElementById('cardPriority');
    const deadlineElement = document.getElementById('cardDeadline');
    
    // Only get values if elements exist
    const title = titleElement ? titleElement.value.trim() : '';
    const description = descriptionElement ? descriptionElement.value.trim() : '';
    const priority = priorityElement ? priorityElement.value : 'medium';
    const deadline = deadlineElement ? deadlineElement.value : '';
    
    // Get selected assignees - first check if multi-select exists
    const assigneesSelect = document.getElementById('cardAssignees');
    const selectedAssignees = [];
    
    if (assigneesSelect) {
        Array.from(assigneesSelect.selectedOptions).forEach(option => {
            if (option.value) {
                selectedAssignees.push(parseInt(option.value));
            }
        });
    }
    
    // For backward compatibility - check for single assignee
    const singleAssigneeElement = document.getElementById('cardAssignee');
    let singleAssigneeId = null;
    
    if (singleAssigneeElement && singleAssigneeElement.value) {
        singleAssigneeId = parseInt(singleAssigneeElement.value);
        
        // If no multiple assignees are selected but we have a single assignee,
        // add it to the multi-select array for consistency
        if (selectedAssignees.length === 0 && singleAssigneeId) {
            selectedAssignees.push(singleAssigneeId);
        }
    }
    
    if (!title) {
        alert("Title is required");
        return;
    }
    
    try {
        console.log('Creating card with assigned users:', selectedAssignees);
        
        const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
        
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
        
        // Add tasks (if function exists)
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
        
        // Assign multiple users to card if there are any selected
        if (selectedAssignees.length > 0) {
            operations.push(
                fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_ids: selectedAssignees }),
                })
            );
            
            // Store assignments for client-side use
            cardAssignments.set(cardId, selectedAssignees);
        }
        
        // Execute all operations
        await Promise.allSettled(operations);
        
        // Reload cards and render
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
    } catch (error) {
        console.error('Error creating card:', error);
        alert('Failed to create card: ' + error.message);
    }
}
// Handle update card with multiple assignees
async function handleUpdateCardWithMultipleAssignees(event) {
    event.preventDefault();
    
    if (!window.activeBoard) {
        console.error("No active board");
        return;
    }
    
    const form = event.target;
    const cardId = parseInt(form.dataset.cardId);
    const listId = parseInt(form.dataset.listId);
    
    if (!cardId || !listId) {
        console.error("Missing card ID or list ID");
        return;
    }
    
    const title = document.getElementById('editCardTitle').value.trim();
    const description = document.getElementById('editCardDescription').value.trim();
    const priority = document.getElementById('editCardPriority').value;
    const deadline = document.getElementById('editCardDeadline')?.value;
    const completed = document.getElementById('editCardCompleted')?.checked || false;
    
    // Get selected assignees
    const assigneesSelect = document.getElementById('editCardAssignees');
    const selectedAssignees = [];
    
    if (assigneesSelect) {
        Array.from(assigneesSelect.selectedOptions).forEach(option => {
            if (option.value) {
                selectedAssignees.push(parseInt(option.value));
            }
        });
    }
    
    if (!title) {
        alert("Title is required");
        return;
    }
    
    try {
        console.log('Updating card with assigned users:', selectedAssignees);
        
        const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
        
        // Array for operations
        const operations = [];
        
        // Update basic card information
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
                    body: JSON.stringify({ 
                        deadline: new Date(deadline).toISOString() 
                    }),
                })
            );
        }
        
        // Assign multiple users to card
        operations.push(
            fetch(`${apiBaseUrl}/boards/${activeBoard.id}/lists/${listId}/cards/${cardId}/assign-multiple`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_ids: selectedAssignees }),
            })
        );
        
        // Store assignments for client-side use
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
        
        // Reload cards and render
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
    } catch (error) {
        console.error('Error updating card:', error);
        alert('Failed to update card: ' + error.message);
    }
}

// Helper function to get todos (fallback if not available in kanban.js)
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

// Add proper CSS styles
function addCardAssignmentStyles() {
    // Check if styles already exist
    if (document.getElementById('card-assignment-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'card-assignment-styles';
    style.textContent = `
        /* Creator info styles */
        .creator-info {
            font-size: 11px;
            color: #6c757d;
            margin: 4px 0;
            padding: 2px 0;
            font-style: italic;
            border-top: 1px dotted #dee2e6;
            border-bottom: 1px dotted #dee2e6;
            background-color: rgba(0, 0, 0, 0.02);
        }
        
        .board-creator-info {
            font-size: 10px;
            color: #6c757d;
            margin-top: 4px;
            font-style: italic;
            display: block;
        }
        
        /* Multiple assignees styles */
        .assignees-container {
            margin-bottom: 8px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .user-badge {
            display: flex;
            align-items: center;
            background-color: #f8f9fa;
            border-radius: 16px;
            padding: 2px 8px 2px 2px;
            margin-right: 4px;
            margin-bottom: 4px;
            border: 1px solid #e9ecef;
            font-size: 12px;
            max-width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        
        .user-badge.multiple {
            padding-right: 10px;
        }
        
        .user-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #6c757d;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            margin-right: 6px;
            flex-shrink: 0;
        }
        
        .user-avatar-group {
            display: flex;
            align-items: center;
            margin-right: 6px;
        }
        
        .user-avatar.small {
            width: 20px;
            height: 20px;
            font-size: 10px;
            margin-right: -8px;
            border: 1px solid white;
            z-index: 1;
        }
        
        .user-avatar.small:nth-child(2) {
            z-index: 2;
        }
        
        .user-avatar.small:nth-child(3) {
            z-index: 3;
        }
        
        .user-avatar.more {
            background-color: #6c757d;
            color: white;
            z-index: 4;
        }
        
        /* Multi-select styling */
        select[multiple] {
            height: auto !important;
            min-height: 100px;
            padding: 0.375rem 0.75rem;
        }
        
        select[multiple] option {
            padding: 6px 10px;
            border-bottom: 1px solid #e9ecef;
        }
        
        select[multiple] option:checked {
            background-color: #007bff;
            color: white;
        }
    `;
    
    document.head.appendChild(style);
}

// Add this function to patch openEditCardModal to support multiple assignees
function patchOpenEditCardModal() {
    if (typeof window.openEditCardModal !== 'function') {
        console.warn('openEditCardModal function not found');
        return;
    }
    
    console.log("Patching openEditCardModal function");
    
    window.originalOpenEditCardModal = window.openEditCardModal;
    window.openEditCardModal = function(cardId, listId) {
        try {
            // Modified version: Handle the removal of editCardAssignee element
            // Save original elements first
            const originalEditCardAssignee = document.getElementById('editCardAssignee');
            const editCardAssigneesExists = document.getElementById('editCardAssignees') !== null;
            
            // Call original function
            window.originalOpenEditCardModal(cardId, listId);
            
            // Find list and card
            const list = lists.find(list => list.id === listId);
            if (!list || !list.cards) return;
            
            const card = list.cards.find(card => card.id === cardId);
            if (!card) return;
            
            // Check if editCardAssignee still exists (original dropdown)
            const editCardAssignee = document.getElementById('editCardAssignee');
            if (editCardAssignee !== null) {
                editCardAssignee.value = card.assigned_to ? card.assigned_to.toString() : '';
            }
            
            // Get the multi-select element
            const assigneesSelect = document.getElementById('editCardAssignees');
            if (!assigneesSelect) return;
            
            // Populate with board users if needed
            if (assigneesSelect.options.length <= 1) {
                // Clear any existing options except the first one
                while (assigneesSelect.options.length > 1) {
                    assigneesSelect.remove(1);
                }
                
                // Add board users
                boardAssignableUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.username;
                    assigneesSelect.appendChild(option);
                });
            }
            
            // Clear previous selections
            Array.from(assigneesSelect.options).forEach(option => {
                option.selected = false;
            });
            
            // Get assigned users from our map or from card data
            let assignedUserIds = [];
            
            // First try to get from card.assigned_users
            if (card.assigned_users && Array.isArray(card.assigned_users)) {
                assignedUserIds = card.assigned_users.map(user => user.id);
            } 
            // Then check our map
            else if (cardAssignments.has(cardId)) {
                assignedUserIds = cardAssignments.get(cardId);
            } 
            // Fallback to single assigned_to
            else if (card.assigned_to) {
                assignedUserIds = [card.assigned_to];
            }
            
            // Set selected options
            Array.from(assigneesSelect.options).forEach(option => {
                if (assignedUserIds.includes(parseInt(option.value))) {
                    option.selected = true;
                }
            });
        } catch (error) {
            console.error('Error in patched openEditCardModal:', error);
            if (window.originalOpenEditCardModal) {
                window.originalOpenEditCardModal(cardId, listId);
            }
        }
    };
}
// Patch openCreateCardModal to populate the assignees dropdown
function patchOpenCreateCardModal() {
    if (typeof window.openCreateCardModal !== 'function') {
        console.warn('openCreateCardModal function not found');
        return;
    }
    
    console.log("Patching openCreateCardModal function");
    
    window.originalOpenCreateCardModal = window.openCreateCardModal;
    window.openCreateCardModal = function(listId) {
        try {
            // Save references to original elements before calling the original function
            const originalCardAssignee = document.getElementById('cardAssignee');
            const cardAssigneesExists = document.getElementById('cardAssignees') !== null;
            
            // Call original function first
            window.originalOpenCreateCardModal(listId);
            
            // Handle single assignee dropdown if it still exists
            const cardAssignee = document.getElementById('cardAssignee');
            if (cardAssignee !== null) {
                // Original dropdown exists, populate it
                populateUserSelect(cardAssignee);
            }
            
            // Now handle multi-select assignees
            const assigneesSelect = document.getElementById('cardAssignees');
            if (!assigneesSelect) return;
            
            // Populate with board users if needed
            if (assigneesSelect.options.length <= 1) {
                // Clear any existing options except the first one
                while (assigneesSelect.options.length > 1) {
                    assigneesSelect.remove(1);
                }
                
                // Add board users
                boardAssignableUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.username;
                    assigneesSelect.appendChild(option);
                });
            }
            
            // Clear previous selections
            Array.from(assigneesSelect.options).forEach(option => {
                option.selected = false;
            });
        } catch (error) {
            console.error('Error in patched openCreateCardModal:', error);
            if (window.originalOpenCreateCardModal) {
                window.originalOpenCreateCardModal(listId);
            }
        }
    };
}
// Initialize additional patches
document.addEventListener('DOMContentLoaded', function() {
    // After a short delay, patch modal functions
    setTimeout(() => {
        patchOpenEditCardModal();
        patchOpenCreateCardModal();
    }, 1000);
});