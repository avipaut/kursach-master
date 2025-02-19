document.addEventListener("DOMContentLoaded", function () {
    fetchBoards();
});

function createBoard() {
    const boardName = document.getElementById('boardName').value;

    if (!boardName.trim()) {
        alert('Пожалуйста, введите название доски');
        return;
    }

    fetch('/kanban/boards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: boardName }),
    })
    .then(response => response.json())
    .then(data => {
        // Очистка поля ввода
        document.getElementById('boardName').value = '';

        // Создаем новый элемент на странице для этой доски
        const boardDiv = document.createElement("div");
        boardDiv.className = "board";
        boardDiv.innerHTML = `<h3>${data.name}</h3>
                              <button onclick="deleteBoard(${data.id})">Удалить</button>`;
        
        // Добавляем доску в контейнер
        const container = document.getElementById('boards-container');
        container.appendChild(boardDiv);

        alert(`Доска "${data.name}" успешно создана!`);
    })
    .catch(error => {
        console.error('Ошибка при создании доски:', error);
    });
}

function fetchBoards() {
    fetch("/kanban/boards", {
        method: "GET",
        credentials: "include"
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
            return;
        }
        return response.json();
    })
    .then(boards => {
        const container = document.getElementById("boards-container");
        container.innerHTML = boards.length ? "" : "<p>Нет доступных досок.</p>";
        boards.forEach(board => {
            const boardDiv = document.createElement("div");
            boardDiv.className = "board";
            boardDiv.innerHTML = `<h3>${board.name}</h3>
                                  <button onclick="deleteBoard(${board.id})">Удалить</button>`;
            container.appendChild(boardDiv);
        });
    })
    .catch(error => console.error("Ошибка загрузки досок:", error));
}

function deleteBoard(boardId) {
    if (!confirm("Вы уверены, что хотите удалить эту доску?")) return;

    fetch(`/kanban/boards/${boardId}`, {
        method: "DELETE",
        credentials: "include"
    })
    .then(response => {
        if (response.ok) {
            alert("Доска удалена!");
            fetchBoards();  // Перезагружаем список досок после удаления
        } else {
            alert("Не удалось удалить доску.");
        }
    })
    .catch(error => console.error("Ошибка при удалении доски:", error));
}