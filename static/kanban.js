document.addEventListener("DOMContentLoaded", () => {
    fetch("http://localhost:5000/boards")
        .then(response => response.json())
        .then(boards => {
            const container = document.getElementById("boards-container");
            boards.forEach(board => {
                const boardElement = document.createElement("div");
                boardElement.classList.add("board");
                boardElement.innerHTML = `<h2>${board.name}</h2>`;
                container.appendChild(boardElement);

                fetch(`http://localhost:5000/boards/${board.id}/lists`)
                    .then(response => response.json())
                    .then(lists => {
                        lists.forEach(list => {
                            const listElement = document.createElement("div");
                            listElement.classList.add("list");
                            listElement.innerHTML = `<h3>${list.name}</h3>`;
                            boardElement.appendChild(listElement);

                            fetch(`http://localhost:5000/boards/${board.id}/lists/${list.id}/cards`)
                                .then(response => response.json())
                                .then(cards => {
                                    cards.forEach(card => {
                                        const cardElement = document.createElement("div");
                                        cardElement.classList.add("card");
                                        cardElement.innerHTML = `<p>${card.title}</p>`;
                                        listElement.appendChild(cardElement);
                                    });
                                });
                        });
                    });
            });
        });
});
