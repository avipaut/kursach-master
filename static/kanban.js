document.addEventListener('DOMContentLoaded', () => {
    const boardsContainer = document.getElementById('boards-container');
    const createBoardBtn = document.getElementById('create-board-btn');

    // Загрузка досок
    async function loadBoards() {
        try {
            const response = await fetch('/kanban/boards');
            const boards = await response.json();
            console.log('Boards:', boards); // Отладочный вывод

            boardsContainer.innerHTML = ''; 
            
            if (boards.length === 0) {
                boardsContainer.innerHTML = '<p>Досок пока нет. Создайте первую!</p>';
                return;
            }
            
            boards.forEach(board => {
                const boardElement = document.createElement('div');
                boardElement.classList.add('board');
                boardElement.innerHTML = `
                    <h2>${board.name}</h2>
                    <button class="add-list-btn" data-board-id="${board.id}">
                        Добавить список
                    </button>
                    <div class="lists-container" data-board-id="${board.id}"></div>
                `;
                boardsContainer.appendChild(boardElement);
                
                // Загрузка списков для этой доски
                loadListsForBoard(board.id);
            });
        } catch (error) {
            console.error('Ошибка загрузки досок:', error);
            boardsContainer.innerHTML = `<p>Ошибка загрузки: ${error.message}</p>`;
        }
    }

    // Создание новой доски
    async function createBoard() {
        const boardName = prompt('Введите название доски:');
        if (boardName) {
            try {
                const response = await fetch('/kanban/boards', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: boardName })
                });
                
                if (response.ok) {
                    loadBoards(); // Обновить список досок
                } else {
                    const errorData = await response.text();
                    console.error('Ошибка создания доски:', errorData);
                    alert(`Не удалось создать доску: ${errorData}`);
                }
            } catch (error) {
                console.error('Ошибка сети:', error);
                alert('Не удалось создать доску');
            }
        }
    }

    // Загрузка списков для доски
    async function loadListsForBoard(boardId) {
        try {
            const response = await fetch(`/kanban/boards/${boardId}/lists`);
            const lists = await response.json();
            console.log(`Lists for board ${boardId}:`, lists); // Отладочный вывод

            const listsContainer = document.querySelector(
                `.lists-container[data-board-id="${boardId}"]`
            );
            
            if (!listsContainer) return;
            
            listsContainer.innerHTML = lists.map(list => `
                <div class="list">
                    <h3>${list.name}</h3>
                    <div class="cards-container">
                        ${list.cards.map(card => `
                            <div class="card">
                                <h4>${card.title}</h4>
                                <p>${card.description || ''}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error(`Ошибка загрузки списков для доски ${boardId}:`, error);
        }
    }

    // Инициализация
    createBoardBtn.addEventListener('click', createBoard);
    loadBoards();
});