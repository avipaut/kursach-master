// kanban_debug.js
// Helper script to debug issues with the Kanban board

document.addEventListener('DOMContentLoaded', function() {
    console.log("Debug script loaded!");
    
    // Wait a bit to make sure everything is initialized
    setTimeout(debugKanbanElements, 1000);
    
    // Also run again when cards are rendered
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                debugKanbanElements();
            }
        });
    });
    
    // Start observing the lists container for DOM changes
    const listsContainer = document.getElementById('listsContainer');
    if (listsContainer) {
        observer.observe(listsContainer, { childList: true, subtree: true });
    }
    
    // Debug modals when they're opened
    monitorModalOpening();
});

// Check all important elements and functions
function debugKanbanElements() {
    console.log("=== Kanban Debug Information ===");
    
    // Check global variables
    console.log("Global variables:");
    console.log("- boards:", typeof boards !== 'undefined' ? `${boards.length} boards found` : "undefined");
    console.log("- activeBoard:", typeof activeBoard !== 'undefined' ? `ID: ${activeBoard?.id}` : "undefined");
    console.log("- lists:", typeof lists !== 'undefined' ? `${lists.length} lists found` : "undefined");
    console.log("- users:", typeof users !== 'undefined' ? `${users.length} users found` : "undefined");
    
    // Check important DOM elements
    console.log("\nDOM Elements:");
    checkElement('listsContainer');
    checkElement('boardsList');
    checkElement('createCardModal');
    checkElement('editCardModal');
    checkElement('cardTitle');
    checkElement('cardDescription');
    checkElement('cardPriority');
    checkElement('cardAssignee');
    checkElement('editCardTitle');
    checkElement('editCardDescription');
    checkElement('editCardPriority');
    checkElement('editCardAssignee');
    
    // Check important functions
    console.log("\nFunctions:");
    checkFunction('createCardElement');
    checkFunction('renderLists');
    checkFunction('renderBoards');
    checkFunction('openCreateCardModal');
    checkFunction('openEditCardModal');
    checkFunction('handleCreateCard');
    checkFunction('handleUpdateCard');
    checkFunction('selectBoard');
}

// Helper to check if element exists
function checkElement(id) {
    const element = document.getElementById(id);
    console.log(`- ${id}: ${element ? "Found" : "NOT FOUND"}`);
    
    if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA')) {
        console.log(`  Type: ${element.tagName}, Value setter works: ${testValueSetter(element)}`);
    }
}

// Test if setting value works
function testValueSetter(element) {
    try {
        const originalValue = element.value;
        element.value = originalValue;
        return true;
    } catch (error) {
        console.error(`Error setting value on ${element.id}:`, error);
        return false;
    }
}

// Check if function exists
function checkFunction(name) {
    console.log(`- ${name}: ${typeof window[name] === 'function' ? "Found" : "NOT FOUND"}`);
}

// Monitor modal opening
function monitorModalOpening() {
    // Debug when modals are opened
    const createCardModal = document.getElementById('createCardModal');
    const editCardModal = document.getElementById('editCardModal');
    
    if (createCardModal) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class' && 
                    createCardModal.classList.contains('active')) {
                    console.log("Create Card Modal opened!");
                    debugModalElements('createCardModal');
                }
            });
        });
        observer.observe(createCardModal, { attributes: true });
    }
    
    if (editCardModal) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class' && 
                    editCardModal.classList.contains('active')) {
                    console.log("Edit Card Modal opened!");
                    debugModalElements('editCardModal');
                }
            });
        });
        observer.observe(editCardModal, { attributes: true });
    }
}

// Debug modal elements
function debugModalElements(modalId) {
    console.log(`=== Elements in ${modalId} ===`);
    const modal = document.getElementById(modalId);
    
    if (!modal) {
        console.log("Modal not found!");
        return;
    }
    
    // Check for form elements inside the modal
    console.log("Form elements:");
    const inputs = modal.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        console.log(`- ${input.id || input.name || 'unnamed'}: Type=${input.type}, Found=${!!input}`);
    });
}

// Fix common issues
function fixCommonIssues() {
    // Fix for missing card assignee element
    if (!document.getElementById('cardAssignee') && document.getElementById('createCardModal')) {
        console.log("Fixing missing cardAssignee element");
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label for="cardAssignee">Assignee</label>
            <select id="cardAssignee" class="form-control">
                <option value="">Not assigned</option>
            </select>
        `;
        
        const modalBody = document.querySelector('#createCardModal .modal-body');
        if (modalBody) {
            const priorityGroup = modalBody.querySelector('.form-group:nth-child(3)');
            if (priorityGroup) {
                modalBody.insertBefore(formGroup, priorityGroup.nextSibling);
                console.log("Added cardAssignee element to create modal");
            }
        }
    }
    
    // Fix for missing editCardAssignee element
    if (!document.getElementById('editCardAssignee') && document.getElementById('editCardModal')) {
        console.log("Fixing missing editCardAssignee element");
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label for="editCardAssignee">Assignee</label>
            <select id="editCardAssignee" class="form-control">
                <option value="">Not assigned</option>
            </select>
        `;
        
        const modalBody = document.querySelector('#editCardModal .modal-body');
        if (modalBody) {
            const priorityGroup = modalBody.querySelector('.form-group:nth-child(4)');
            if (priorityGroup) {
                modalBody.insertBefore(formGroup, priorityGroup.nextSibling);
                console.log("Added editCardAssignee element to edit modal");
            }
        }
    }
}

// Run the fix after a short delay
setTimeout(fixCommonIssues, 2000);