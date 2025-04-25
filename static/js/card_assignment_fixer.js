// improved_card_assignment_fixer.js
// This script fixes common issues with the card assignment functionality
// and ensures creator information is always displayed

document.addEventListener('DOMContentLoaded', function() {
    console.log("Improved card assignment fixer loaded");
    
    // Run fixes after a longer delay to ensure data is fully loaded
    setTimeout(fixCardAssignmentIssues, 2000);
    
    // Set up specific observers for boards and cards
    setupBoardsObserver();
    setupCardsObserver();
    
    // Also listen for board selection events to update creator info
    document.addEventListener('click', function(e) {
        if (e.target.closest('.board-item')) {
            // Wait for board data to load
            setTimeout(fixCardAssignmentIssues, 1000);
        }
    });
});

// Main function to fix issues - now with retry mechanism
function fixCardAssignmentIssues() {
    console.log("Running card assignment fixes");
    
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

// Observer for board list changes
function setupBoardsObserver() {
    const boardsList = document.getElementById('boardsList');
    if (!boardsList) {
        console.warn("Board list not found - will retry later");
        setTimeout(setupBoardsObserver, 1000);
        return;
    }
    
    console.log("Setting up board list observer");
    
    const boardsObserver = new MutationObserver(function(mutations) {
        let needsFix = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                needsFix = true;
                break;
            }
        }
        
        if (needsFix) {
            console.log("Board list changed - fixing creator info");
            setTimeout(fixBoardCreatorInfo, 200);
        }
    });
    
    boardsObserver.observe(boardsList, {
        childList: true,
        subtree: true
    });
}

// Observer for card list changes
function setupCardsObserver() {
    const listsContainer = document.getElementById('listsContainer');
    if (!listsContainer) {
        console.warn("Lists container not found - will retry later");
        setTimeout(setupCardsObserver, 1000);
        return;
    }
    
    console.log("Setting up card lists observer");
    
    const cardsObserver = new MutationObserver(function(mutations) {
        let needsFix = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.classList && (node.classList.contains('list') || node.classList.contains('card'))) {
                        needsFix = true;
                        break;
                    }
                }
            }
        }
        
        if (needsFix) {
            console.log("Cards changed - fixing creator info");
            setTimeout(fixCardCreatorInfo, 200);
        }
    });
    
    cardsObserver.observe(listsContainer, {
        childList: true,
        subtree: true
    });
}

// Fix board creator info display - now with better logging and return value
function fixBoardCreatorInfo() {
    console.log("Fixing board creator info");
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

// Fix card creator info display - improved with better placement strategy
function fixCardCreatorInfo() {
    console.log("Fixing card creator info");
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

// Fix modal forms for multi-user assignment
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
                console.log("Replaced single assignee with multi-select in create modal");
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
                console.log("Replaced single assignee with multi-select in edit modal");
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

// Fix board user loading - improved with retry mechanism
function fixBoardUserLoading() {
    if (!window.activeBoard || !window.activeBoard.id) {
        console.log("No active board selected yet");
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

// Helper function to populate multi-select with board users
function populateMultiSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Clear existing options except first
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add board users to dropdown
    if (window.boardAssignableUsers && window.boardAssignableUsers.length > 0) {
        window.boardAssignableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            select.appendChild(option);
        });
        console.log(`Populated ${selectId} with ${window.boardAssignableUsers.length} users`);
    } else if (window.users) {
        // Fallback to all users if board users not available
        window.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            select.appendChild(option);
        });
        console.log(`Populated ${selectId} with ${window.users.length} users (fallback)`);
    }
}

// Add custom CSS for creator info and multi-select with improved visibility
function addFixerStyles() {
    // Check if styles already exist
    if (document.getElementById('card-assignment-fixer-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'card-assignment-fixer-styles';
    style.textContent = `
        /* Creator info styles - improved visibility */
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
        
        /* Multi-select styling */
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
    `;
    
    document.head.appendChild(style);
    console.log("Added improved styles for creator info and multi-select");
}

// Patch the openEditCardModal function to support multiple assignees
function patchOpenEditCardModal() {
    if (typeof window.openEditCardModal !== 'function') {
        console.warn("openEditCardModal function not found - will retry later");
        setTimeout(patchOpenEditCardModal, 1000);
        return;
    }
    
    // Skip if already patched
    if (window.originalOpenEditCardModal) {
        return;
    }
    
    console.log("Patching openEditCardModal function");
    
    window.originalOpenEditCardModal = window.openEditCardModal;
    window.openEditCardModal = function(cardId, listId) {
        try {
            // Call original function first
            window.originalOpenEditCardModal(cardId, listId);
            
            // Find list and card data
            if (!window.lists) return;
            
            const list = window.lists.find(list => list.id === listId);
            if (!list || !list.cards) return;
            
            const card = list.cards.find(card => card.id === cardId);
            if (!card) return;
            
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
                if (window.boardAssignableUsers && window.boardAssignableUsers.length > 0) {
                    window.boardAssignableUsers.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = user.username || user.name || `User ${user.id}`;
                        assigneesSelect.appendChild(option);
                    });
                } else if (window.users) {
                    window.users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = user.username || user.name || `User ${user.id}`;
                        assigneesSelect.appendChild(option);
                    });
                }
            }
            
            // Clear previous selections
            Array.from(assigneesSelect.options).forEach(option => {
                option.selected = false;
            });
            
            // Get assigned users from card data
            let assignedUserIds = [];
            
            if (card.assigned_users && Array.isArray(card.assigned_users)) {
                assignedUserIds = card.assigned_users.map(user => user.id);
            } else if (window.cardAssignments && window.cardAssignments.has(cardId)) {
                assignedUserIds = window.cardAssignments.get(cardId);
            } else if (card.assigned_to) {
                assignedUserIds = [card.assigned_to];
            }
            
            // Set selected options
            Array.from(assigneesSelect.options).forEach(option => {
                const optionId = parseInt(option.value);
                if (optionId && assignedUserIds.includes(optionId)) {
                    option.selected = true;
                }
            });
            
            console.log("Successfully patched edit card modal for card:", cardId);
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
        console.warn("openCreateCardModal function not found - will retry later");
        setTimeout(patchOpenCreateCardModal, 1000);
        return;
    }
    
    // Skip if already patched
    if (window.originalOpenCreateCardModal) {
        return;
    }
    
    console.log("Patching openCreateCardModal function");
    
    window.originalOpenCreateCardModal = window.openCreateCardModal;
    window.openCreateCardModal = function(listId) {
        try {
            // Call original function first
            window.originalOpenCreateCardModal(listId);
            
            // Get the multi-select element
            const assigneesSelect = document.getElementById('cardAssignees');
            if (!assigneesSelect) return;
            
            // Populate with board users if needed
            if (assigneesSelect.options.length <= 1) {
                // Clear any existing options except the first one
                while (assigneesSelect.options.length > 1) {
                    assigneesSelect.remove(1);
                }
                
                // Add board users
                if (window.boardAssignableUsers && window.boardAssignableUsers.length > 0) {
                    window.boardAssignableUsers.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = user.username || user.name || `User ${user.id}`;
                        assigneesSelect.appendChild(option);
                    });
                } else if (window.users) {
                    window.users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = user.username || user.name || `User ${user.id}`;
                        assigneesSelect.appendChild(option);
                    });
                }
            }
            
            // Clear previous selections
            Array.from(assigneesSelect.options).forEach(option => {
                option.selected = false;
            });
            
            console.log("Successfully patched create card modal");
        } catch (error) {
            console.error('Error in patched openCreateCardModal:', error);
            if (window.originalOpenCreateCardModal) {
                window.originalOpenCreateCardModal(listId);
            }
        }
    };
}

// Extra function to monitor API responses and update creator info
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
    
    console.log("Set up API monitoring to update creator info after data changes");
}

// Override form submit handlers to support multi-user assignment
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
                const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
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
        
        console.log("Overrode create card form submit handler");
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
                const apiBaseUrl = window.location.hostname === 'localhost' ? '' : '/kanban';
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
        
        console.log("Overrode edit card form submit handler");
    }
}

// Initialize everything
function initialize() {
    // Add styles
    addFixerStyles();
    
    // Patch modal functions
    patchOpenEditCardModal();
    patchOpenCreateCardModal();
    
    // Set up API monitoring
    setupApiMonitoring();
    
    // Override form handlers after a short delay
    setTimeout(overrideFormSubmitHandlers, 1500);
    
    // Run initial fixes
    fixCardAssignmentIssues();
    
    console.log("Card assignment fixer fully initialized");
}

// Run initialization
initialize();