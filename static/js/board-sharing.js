// Global variables for board sharing functionality
let boardUsers = [];

// DOM elements for board sharing
let addUserModal;
let boardUsersListModal;

// Initialize board sharing functionality
document.addEventListener('DOMContentLoaded', () => {
    // Create the modals for board sharing
    createBoardSharingModals();
    
    // Add board sharing button to board actions
    addBoardSharingButton();
});

// Create modals for board sharing functionality
function createBoardSharingModals() {
    // Modal for adding users to a board
    createAddUserModal();
    
    // Modal for viewing and managing board users
    createBoardUsersListModal();
}

// Create modal for adding users to a board
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

// Create modal for viewing and managing board users
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

// Add a "Share Board" button to the board actions
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

// Open the modal to add a user to the current board
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

// Open the modal to view and manage users of the current board
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

// Populate the user select dropdown with users who are not already added to the board
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

// Fetch the users who have access to the current board
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

// Display the users who have access to the current board
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

// Handle adding a user to the current board
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

// Handle removing a user from the current board
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

// Add CSS styles for board sharing
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

// Call to add styles on load
document.addEventListener('DOMContentLoaded', addBoardSharingStyles);

// To integrate with the existing board functionality:

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

// Helper to get selected users from multi-select
function getSelectedUsers() {
    const userSelect = document.getElementById('boardUsersSelect');
    if (!userSelect) return [];
    
    return Array.from(userSelect.selectedOptions).map(option => parseInt(option.value));
}

// Helper to get selected users for edit
function getSelectedUsersForEdit() {
    const userSelect = document.getElementById('editBoardUsersSelect');
    if (!userSelect) return [];
    
    return Array.from(userSelect.selectedOptions).map(option => parseInt(option.value));
}

// 2. Update the openCreateBoardModal and openEditBoardModal functions to include user selection
function addUsersToCreateBoardModal() {
    const modal = document.getElementById('createBoardModal');
    const formActions = modal.querySelector('.form-actions');
    
    // Check if we've already added the users select
    if (!document.getElementById('boardUsersSelect')) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group mt-3';
        formGroup.innerHTML = `
            <label for="boardUsersSelect">Share with users:</label>
            <select id="boardUsersSelect" class="form-control" multiple size="5">
            </select>
            <small class="text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        // Add it before the form actions
        formActions.parentNode.insertBefore(formGroup, formActions);
        
        // Populate with users
        const userSelect = document.getElementById('boardUsersSelect');
        users.forEach(user => {
            // Don't add current user (they're automatically added as creator)
            if (user.id !== currentUser.id) {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username || user.name || `User ${user.id}`;
                userSelect.appendChild(option);
            }
        });
    }
}

function addUsersToEditBoardModal() {
    if (!activeBoard) return;
    
    const modal = document.getElementById('editBoardModal');
    const formActions = modal.querySelector('.form-actions');
    
    // Check if we've already added the users select
    if (!document.getElementById('editBoardUsersSelect')) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group mt-3';
        formGroup.innerHTML = `
            <label for="editBoardUsersSelect">Share with users:</label>
            <select id="editBoardUsersSelect" class="form-control" multiple size="5">
            </select>
            <small class="text-muted">Hold Ctrl/Cmd to select multiple users</small>
        `;
        
        // Add it before the form actions
        formActions.parentNode.insertBefore(formGroup, formActions);
    }
    
    // Populate with users
    const userSelect = document.getElementById('editBoardUsersSelect');
    userSelect.innerHTML = ''; // Clear existing options
    
    // Add all users
    users.forEach(user => {
        // Don't add current user (they're automatically added as creator)
        if (user.id !== activeBoard.user_id) {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.name || `User ${user.id}`;
            
            // Check if this user is already added to the board
            if (activeBoard.users && activeBoard.users.some(boardUser => boardUser.id === user.id)) {
                option.selected = true;
            }
            
            userSelect.appendChild(option);
        }
    });
}

// Note: Include these functions when modifying your existing code
// To override the existing board creation and editing handlers, replace:
// - handleCreateBoard with handleCreateBoardWithUsers
// - handleEditBoard with handleEditBoardWithUsers

// Then call addUsersToCreateBoardModal() and addUsersToEditBoardModal() in the 
// openCreateBoardModal and openEditBoardModal functions respectively