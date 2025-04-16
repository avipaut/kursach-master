
// Основной объект для хранения состояния приложения
const KPIApp = {
    // Получаем данные из HTML
    isAdmin: document.getElementById('kpi-app-config')?.dataset.isAdmin === 'true',
    selectedUserId: document.getElementById('kpi-app-config')?.dataset.selectedUserId || null,
    
    currentCharts: {
        bar: null,
        pie: null
    },
    debounceTimers: {},
    autoSaveTimeout: null,
    autoSaveObserver: null,
    notificationTimeout: null,
    isSaving: false,
    userTriggeredSave: false,
    
    init: function() {
        this.cacheElements();
        
        // Проверяем существование элементов перед настройкой
        if (this.elements.kpiTable) {
            this.setupEventListeners();
            this.setupAutoSave();
            this.setupTableSearch();
            this.setupDynamicRowAddition();
            this.setupFormulaAutocomplete();
            this.setupRealTimeValidation();
            this.processTableFormulas();
        }
        
        if (this.isAdmin) {
            this.setupTemplateHandlers();
        }
        
        if (document.querySelector('.tab-button.active')?.dataset.tab === 'chart-tab') {
            this.generateCharts(document.getElementById('chart-column-select')?.value);
        }
    },
    setupTemplateHandlers: function() {
        document.getElementById('save-template').addEventListener('click', () => {
            this.saveTemplate();
        });
        
        document.getElementById('apply-template').addEventListener('click', () => {
            if (confirm('Применить этот шаблон ко ВСЕМ пользователям? Это действие нельзя отменить.')) {
                this.applyTemplate();
            }
        });
        
        // Загрузка данных шаблона при открытии вкладки
        document.querySelector('[data-tab="template-tab"]').addEventListener('click', () => {
            this.loadTemplateData();
        });
    },

    loadTemplateData: function() {
        fetch('/kpi/template')
            .then(response => response.json())
            .then(data => {
                this.renderTemplateTable(data);
            });
    },


    saveTemplate: async function() {
        try {
            const changeDescription = document.getElementById('change-description').value;
            const templateData = this.collectTemplateData();
            
            // Показываем индикатор загрузки
            this.showNotification('Сохранение шаблона...', 'info');
            
            const response = await fetch('/kpi/save_template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    template_data: templateData,
                    change_description: changeDescription
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('Шаблон успешно сохранён', 'success');
            } else {
                throw new Error(result.message || 'Неизвестная ошибка');
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    },

    applyTemplate: function() {
        
        fetch('/kpi/template/apply', {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.getCsrfToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                this.showNotification('Template applied to all users');
            } else {
                throw new Error(data.message || 'Error applying template');
            }
        })
        .catch(error => {
            this.showNotification('Error: ' + error.message, 'error');
        });
    },

    collectTemplateData: function() {
        const result = {
            rows: {}
        };

        // Собираем данные строк
        document.querySelectorAll('#template-table tbody tr').forEach((row, rowIdx) => {
            const rowData = {};
            const cells = row.querySelectorAll('.kpi-cell');
            
            cells.forEach((cell, colIndex) => {
                const colNameInputs = Array.from(document.querySelectorAll('[name^="template_column_name_"]'));
                const colName = colNameInputs[colIndex]?.value;
                if (!colName) return;
                
                const value = cell.querySelector('.kpi-input')?.value || '';
                const formula = cell.querySelector('.cell-formula')?.value || '';
                
                rowData[colName] = { value, formula };
            });
            
            if (Object.keys(rowData).length > 0) {
                result.rows[rowIdx] = rowData;
            }
        });

        return result;
    },
                    
    cacheElements: function() {
        this.elements = {
            kpiTable: document.getElementById('kpi-table'),
            addColumnBtn: document.getElementById('add_column'),
            addRowBtn: document.getElementById('add_row'),
            saveKpiBtn: document.getElementById('save_kpi'),
            formulaModal: document.getElementById('formula-modal'),
            closeFormulaModal: document.getElementById('close-formula-modal'),
            formulaInput: document.getElementById('formula-input'),
            currentRowInput: document.getElementById('current-row'),
            currentColInput: document.getElementById('current-col'),
            saveFormulaBtn: document.getElementById('save-formula'),
            cancelFormulaBtn: document.getElementById('cancel-formula'),
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notification-text'),
            tabButtons: document.querySelectorAll('.tab-button'),
            tabContents: document.querySelectorAll('.tab-content'),
            generateChartBtn: document.getElementById('generate-chart'),
            chartColumnSelect: document.getElementById('chart-column-select'),
            availableColumns: document.getElementById('available-columns')
        };
    },
    
    setupEventListeners: function() {
        // Обработчики вкладок
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Деактивируем все вкладки
                this.elements.tabButtons.forEach(btn => btn.classList.remove('active'));
                this.elements.tabContents.forEach(tab => tab.classList.remove('active'));
                
                // Активируем текущую вкладку
                button.classList.add('active');
                document.getElementById(tabId).classList.add('active');
                
                // Если выбрана вкладка с графиками, генерируем их
                if (tabId === 'chart-tab' && this.elements.chartColumnSelect.options.length > 0) {
                    this.generateCharts(this.elements.chartColumnSelect.value);
                }
            });
        });
        
        // Кнопка добавления столбца
        this.elements.addColumnBtn.addEventListener('click', this.addColumn.bind(this));
        
        // Кнопка добавления строки
        this.elements.addRowBtn.addEventListener('click', this.addRow.bind(this));
        
        // Кнопка сохранения KPI
        this.elements.saveKpiBtn.addEventListener('click', this.saveKpiData.bind(this));
        
        // Модальное окно формул
        this.elements.closeFormulaModal.addEventListener('click', this.closeFormulaModal.bind(this));
        this.elements.cancelFormulaBtn.addEventListener('click', this.closeFormulaModal.bind(this));
        this.elements.saveFormulaBtn.addEventListener('click', this.saveFormula.bind(this));
        
        // Генерация графиков
        this.elements.generateChartBtn.addEventListener('click', () => {
            this.generateCharts(this.elements.chartColumnSelect.value);
        });
        
        // Вставка названий столбцов в формулу
        this.elements.availableColumns.addEventListener('click', (e) => {
            if (e.target.classList.contains('column-tag')) {
                this.insertColumnIntoFormula(e.target.textContent);
            }
        });
        
        // Обработчики для динамических элементов
        document.addEventListener('click', (e) => {
            // Удаление строк
            if (e.target.closest('.delete-row')) {
                this.deleteRow(e.target.closest('.delete-row'));
                return;
            }
            
            // Удаление столбцов
            if (e.target.closest('.delete-column')) {
                this.deleteColumn(e.target.closest('.delete-column'));
                return;
            }
            
            // Кнопки формул - исправленный обработчик
            const formulaBtn = e.target.closest('.formula-btn');
            if (formulaBtn) {
                this.openFormulaModal(
                    formulaBtn.getAttribute('data-row'),
                    formulaBtn.getAttribute('data-col')
                );
                return;
            }
        });
        
        // Обработчик изменения значений для пересчета формул
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('kpi-input')) {
                this.recalculateAllFormulas();
            }
        });
    },
    
    // Добавление нового столбца
    addColumn: function() {
        const columnName = prompt('Введите название столбца:');
        if (!columnName) return;
        
        // Показываем индикатор загрузки
        this.showSavingIndicator(true);
        
        fetch('/kpi/add_column', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                column_name: columnName,
                user_id: this.selectedUserId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const headerRow = document.getElementById('column-names-row');
                const columnCount = headerRow.cells.length;
                
                // Добавляем заголовок столбца
                const newTh = document.createElement('th');
                newTh.className = 'relative group';
                newTh.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="truncate max-w-[100px] sm:max-w-none">${columnName}</span>
                        <input type="hidden" name="column_name_${columnCount}" value="${columnName}">
                        <button class="delete-btn delete-column ml-1 sm:ml-2" 
                                data-column="${columnName}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                headerRow.appendChild(newTh);
                
                // Добавляем ячейки в каждую строку
                const tbody = this.elements.kpiTable.querySelector('tbody');
                Array.from(tbody.rows).forEach((row, rowIdx) => {
                    const newCell = document.createElement('td');
                    newCell.className = 'kpi-cell';
                    const inputId = `kpi-input-${rowIdx}-${columnCount}`;
                    newCell.innerHTML = `
                        <input type="text" class="kpi-input" id="${inputId}" 
                            name="cell_${rowIdx}_col_${columnCount}" value="">
                        <button class="formula-btn" data-row="${rowIdx}" data-col="${columnCount}">
                            <i class="fas fa-calculator"></i> fx
                        </button>
                        <input type="hidden" name="formula_${rowIdx}_col_${columnCount}" 
                            class="cell-formula" value="">
                    `;
                    row.appendChild(newCell);
                    
                    // Добавляем обработчик автосохранения для новой ячейки
                    this.addAutoSaveHandler(newCell.querySelector('.kpi-input'));
                });
                
                // Добавляем в выпадающий список графиков
                const option = document.createElement('option');
                option.value = columnName;
                option.textContent = columnName;
                this.elements.chartColumnSelect.appendChild(option);
                
                // Добавляем в модальное окно формул
                const span = document.createElement('span');
                span.className = 'column-tag';
                span.textContent = `[${columnName}]`;
                this.elements.availableColumns.appendChild(span);
                
                // Автоматически сохраняем изменения
                this.performAutoSave();
            } else {
                this.showNotification(data.message || 'Ошибка при добавлении столбца', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            this.showNotification('Ошибка при добавлении столбца', 'error');
        })
        .finally(() => {
            this.showSavingIndicator(false);
        });
    },
    
    // Добавление новой строки
    addRow: function() {
        const headerRow = document.getElementById('column-names-row');
        const columnCount = headerRow.cells.length - 1; // Исключаем столбец с кнопками
        const tbody = this.elements.kpiTable.querySelector('tbody');
        const rowCount = tbody.rows.length;
        
        const newRow = document.createElement('tr');
        newRow.dataset.rowIndex = rowCount;
        
        // Кнопка удаления
        const actionCell = document.createElement('td');
        actionCell.className = 'text-center';
        actionCell.innerHTML = `
            <button class="delete-btn delete-row">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        newRow.appendChild(actionCell);
        
        // Ячейки данных
        for (let i = 0; i < columnCount; i++) {
            const newCell = document.createElement('td');
            newCell.className = 'kpi-cell';
            const inputId = `kpi-input-${rowCount}-${i}`;
            newCell.innerHTML = `
                <input type="text" class="kpi-input" id="${inputId}" 
                    name="cell_${rowCount}_col_${i}" value="">
                <button class="formula-btn" data-row="${rowCount}" data-col="${i}">
                    <i class="fas fa-calculator"></i> fx
                </button>
                <input type="hidden" name="formula_${rowCount}_col_${i}" 
                    class="cell-formula" value="">
            `;
            newRow.appendChild(newCell);
        }
        
        tbody.appendChild(newRow);
        
        // Добавляем обработчики автосохранения для новых полей
        this.addAutoSaveHandlers();
        
        this.showNotification('Строка успешно добавлена');
    },


    
    // Удаление строки
    deleteRow: function(button) {
        const row = button.closest('tr');
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        
        if (confirm('Вы уверены, что хотите удалить эту строку?')) {
            // Показываем индикатор загрузки
            this.showSavingIndicator(true);
            
            fetch('/kpi/delete_row', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    row_index: rowIndex,
                    user_id: this.selectedUserId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    row.remove();
                    
                    // Обновляем индексы оставшихся строк
                    const tbody = this.elements.kpiTable.querySelector('tbody');
                    const rows = tbody.querySelectorAll('tr');
                    
                    rows.forEach((row, newIndex) => {
                        // Обновляем data-атрибуты
                        const formulaBtns = row.querySelectorAll('.formula-btn');
                        formulaBtns.forEach(btn => {
                            btn.dataset.row = newIndex;
                        });
                        
                        // Обновляем имена полей
                        const inputs = row.querySelectorAll('.kpi-input, .cell-formula');
                        inputs.forEach(input => {
                            const nameParts = input.name.split('_');
                            input.name = `${nameParts[0]}_${newIndex}_${nameParts[2]}_${nameParts[3]}`;
                        });
                    });
                    
                    this.performAutoSave();
                } else {
                    this.showNotification(data.message || 'Ошибка при удалении строки', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.showNotification('Ошибка при удалении строки', 'error');
            })
            .finally(() => {
                this.showSavingIndicator(false);
            });
        }
    },
    
    // Удаление столбца
    deleteColumn: function(button) {
        const column = button.getAttribute('data-column');
        
        if (!confirm(`Вы уверены, что хотите удалить столбец "${column}"? Все данные в этом столбце будут потеряны.`)) {
            return;
        }

        // Показываем индикатор загрузки
        this.showSavingIndicator(true);
        
        // Блокируем интерфейс во время выполнения
        this.setUiEnabled(false);

        fetch('/kpi/delete_column', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            },
            body: JSON.stringify({
                column: column,
                user_id: this.selectedUserId
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status !== 'success') {
                throw new Error(data.message || 'Ошибка сервера');
            }

            // Находим индекс столбца
            const headerRow = document.getElementById('column-names-row');
            let colIndex = -1;
            
            for (let i = 0; i < headerRow.cells.length; i++) {
                const colName = headerRow.cells[i].querySelector('span')?.textContent;
                if (colName === column) {
                    colIndex = i;
                    break;
                }
            }

            if (colIndex === -1) {
                throw new Error('Столбец не найден в таблице');
            }

            // Удаляем столбец из каждой строки
            const rows = this.elements.kpiTable.querySelectorAll('tr');
            rows.forEach(row => {
                if (row.cells[colIndex]) {
                    row.deleteCell(colIndex);
                }
            });

            // Удаляем из выпадающего списка графиков
            const chartOptions = this.elements.chartColumnSelect.options;
            for (let i = 0; i < chartOptions.length; i++) {
                if (chartOptions[i].value === column) {
                    this.elements.chartColumnSelect.remove(i);
                    break;
                }
            }

            // Обновляем индексы столбцов
            this.renumberColumnsAfterDelete(colIndex);

            // Удаляем из модального окна формул
            const columnTags = this.elements.availableColumns.querySelectorAll('.column-tag');
            columnTags.forEach(tag => {
                if (tag.textContent === `[${column}]`) {
                    tag.remove();
                }
            });

            // Автоматически сохраняем изменения
            return this.performAutoSave();
        })
        .then(() => {
            this.showNotification(`Столбец "${column}" успешно удалён`, 'success');
            
            // Если удалённый столбец был выбран для графиков, сбрасываем выбор
            if (this.elements.chartColumnSelect.value === column) {
                this.elements.chartColumnSelect.value = '';
            }
        })
        .catch(error => {
            console.error('Ошибка удаления столбца:', error);
            this.showNotification(`Ошибка удаления столбца: ${error.message}`, 'error');
        })
        .finally(() => {
            this.showSavingIndicator(false);
            this.setUiEnabled(true);
        });
    },

    // Вспомогательные методы:

    renumberColumnsAfterDelete: function(deletedIndex) {
        // Обновляем индексы в названиях столбцов
        const columnInputs = document.querySelectorAll('[name^="column_name_"]');
        columnInputs.forEach(input => {
            const nameParts = input.name.split('_');
            const currentIdx = parseInt(nameParts[2]);
            
            if (currentIdx > deletedIndex) {
                input.name = `column_name_${currentIdx - 1}`;
            }
        });

        // Обновляем индексы в ячейках данных
        const cellInputs = document.querySelectorAll('.kpi-input');
        cellInputs.forEach(input => {
            const nameParts = input.name.split('_');
            const rowIdx = parseInt(nameParts[1]);
            const currentColIdx = parseInt(nameParts[3]);
            
            if (currentColIdx > deletedIndex) {
                input.name = `cell_${rowIdx}_col_${currentColIdx - 1}`;
            }
        });

        // Обновляем индексы в кнопках формул
        const formulaBtns = document.querySelectorAll('.formula-btn');
        formulaBtns.forEach(btn => {
            const btnColIdx = parseInt(btn.getAttribute('data-col'));
            
            if (btnColIdx > deletedIndex) {
                btn.setAttribute('data-col', btnColIdx - 1);
            }
        });

        // Обновляем индексы в формулах
        const formulaInputs = document.querySelectorAll('.cell-formula');
        formulaInputs.forEach(input => {
            const nameParts = input.name.split('_');
            const rowIdx = parseInt(nameParts[1]);
            const currentColIdx = parseInt(nameParts[3]);
            
            if (currentColIdx > deletedIndex) {
                input.name = `formula_${rowIdx}_col_${currentColIdx - 1}`;
            }
        });
    },

    
    setUiEnabled: function(enabled) {
        const elements = [
            this.elements.addColumnBtn,
            this.elements.addRowBtn,
            this.elements.saveKpiBtn,
            ...document.querySelectorAll('.delete-column'),
            ...document.querySelectorAll('.delete-row'),
            ...document.querySelectorAll('.formula-btn')
        ];
        
        elements.forEach(el => {
            if (el) {
                el.disabled = !enabled;
            }
        });
    },
    
    // Сохранение данных KPI
    saveKpiData: function() {
        // Устанавливаем флаг ручного сохранения
        this.userTriggeredSave = true;
        
        // Показываем индикатор сохранения
        const savingNotification = this.showNotification('Сохранение данных...', 'info', 0);
        
        // Блокируем кнопку сохранения на время операции
        this.elements.saveKpiBtn.disabled = true;
        this.elements.saveKpiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        
        // Собираем данные
        const formData = this.collectFormData();
        
        // Добавляем timestamp для отслеживания
        formData.last_save = new Date().toISOString();
        
        // Выполняем запрос
        fetch('/kpi/save_kpi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // Обновляем время последнего сохранения
                this.lastSaveTime = new Date();
                
                // Показываем уведомление об успехе
                savingNotification.update('Данные успешно сохранены', 'success');
                
                // Обновляем графики если открыта вкладка
                if (document.querySelector('.tab-button.active').dataset.tab === 'chart-tab') {
                    this.generateCharts(this.elements.chartColumnSelect.value);
                }
                
                // Логируем успешное сохранение
                console.log('Данные KPI сохранены:', {
                    time: this.lastSaveTime,
                    userId: this.selectedUserId,
                    changes: data.changes || 'Все данные'
                });
            } else {
                throw new Error(data.message || 'Неизвестная ошибка сервера');
            }
        })
        .catch(error => {
            console.error('Ошибка сохранения KPI:', error);
            
            // Показываем уведомление об ошибке
            savingNotification.update(`Ошибка сохранения: ${error.message}`, 'error');
            
            // Запланировать повторную попытку
            setTimeout(() => {
                this.showNotification('Повторная попытка сохранения...', 'warning');
                this.saveKpiData();
            }, 5000);
        })
        .finally(() => {
            // Восстанавливаем кнопку сохранения
            setTimeout(() => {
                this.elements.saveKpiBtn.disabled = false;
                this.elements.saveKpiBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
            }, 1000);
            
            // Скрываем уведомление через 3 секунды
            setTimeout(() => {
                savingNotification.hide();
            }, 3000);
        });
    },

    
    // Сбор данных формы
    collectFormData: function() {
        const formData = {
            user_id: this.selectedUserId
        };
        
        // Получаем названия столбцов
        const columnInputs = document.querySelectorAll('[name^="column_name_"]');
        columnInputs.forEach(input => {
            formData[input.name] = input.value;
        });
        
        // Получаем значения ячеек
        const cellInputs = document.querySelectorAll('.kpi-input');
        cellInputs.forEach(input => {
            formData[input.name] = input.value;
        });
        
        // Получаем формулы
        const formulaInputs = document.querySelectorAll('.cell-formula');
        formulaInputs.forEach(input => {
            if (input.value) {
                formData[input.name] = input.value;
            }
        });
        
        return formData;
    },
    
    // Открытие модального окна формул
    openFormulaModal: function(row, col) {
        this.elements.currentRowInput.value = row;
        this.elements.currentColInput.value = col;
        
        // Получаем формулу, если она существует
        const formulaInput = document.querySelector(`input[name="formula_${row}_col_${col}"]`);
        this.elements.formulaInput.value = formulaInput ? formulaInput.value : '';
        
        // Показываем модальное окно
        this.elements.formulaModal.classList.remove('hidden');
    },
    
    // Закрытие модального окна формул
    closeFormulaModal: function() {
        this.elements.formulaModal.classList.add('hidden');
    },
    
    // Сохранение формулы
    saveFormula: function() {
        const row = this.elements.currentRowInput.value;
        const col = this.elements.currentColInput.value;
        const formula = this.elements.formulaInput.value.trim();
        
        // Устанавливаем формулу
        const formulaField = document.querySelector(`input[name="formula_${row}_col_${col}"]`);
        if (formulaField) {
            formulaField.value = formula;
        }
        
        // Закрываем модальное окно
        this.closeFormulaModal();
        
        // Применяем формулу
        if (formula) {
            this.applyFormulaImmediately(row, col, formula);
        } else {
            const cellInput = document.querySelector(`input[name="cell_${row}_col_${col}"]`);
            if (cellInput) {
                cellInput.value = '';
                cellInput.parentElement.classList.remove('formula-cell', 'formula-error');
            }
        }

        // Автоматически сохраняем изменения
        this.performAutoSave();
    },
    
    // Немедленное применение формулы
    applyFormulaImmediately: function(row, col, formula) {
        const cellInput = document.querySelector(`input[name="cell_${row}_col_${col}"]`);
        if (!cellInput) return;
        
        const cellElement = cellInput.parentElement;
        
        // Очищаем предыдущие классы
        cellElement.classList.remove('formula-cell', 'formula-error');
        
        // Если формула пустая, просто очищаем поле
        if (!formula || !formula.trim()) {
            cellInput.value = '';
            return;
        }

        // Получаем данные строки
        const rowElement = cellInput.closest('tr');
        const rowInputs = rowElement.querySelectorAll('.kpi-input');
        const rowData = Array.from(rowInputs).map(input => input.value);
        
        // Получаем названия столбцов
        const headerRow = document.getElementById('column-names-row');
        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);
        
        try {
            // Вычисляем формулу
            const result = this.evaluateFormula(formula, rowData, columnNames);
            
            if (result === 'Error') {
                cellElement.classList.add('formula-error');
            } else if (result !== '') {
                cellInput.value = result;
                cellElement.classList.add('formula-cell');
            }
        } catch (e) {
            console.error('Ошибка вычисления формулы:', e);
            cellElement.classList.add('formula-error');
        }
    },
    
    // Вычисление формулы
    evaluateFormula: function(formula, rowData, columnNames) {
        // Сначала проверяем, что формула не пустая и не содержит только пробелы
        if (!formula || !formula.trim()) {
            return ''; // Возвращаем пустую строку для пустых формул
        }

        try {
            // Удаляем лишние пробелы в начале и конце
            formula = formula.trim();
            
            // Проверяем, является ли формула просто ссылкой на другой столбец
            if (/^\[[^\]]+\]$/.test(formula)) {
                const columnName = formula.slice(1, -1); // Убираем квадратные скобки
                const columnIndex = columnNames.indexOf(columnName);
                if (columnIndex !== -1 && columnIndex < rowData.length) {
                    return rowData[columnIndex]; // Возвращаем значение как есть
                }
                return ''; // Если столбец не найден, возвращаем пустую строку
            }

            // Заменяем ссылки на столбцы их значениями
            const evaluatedFormula = formula.replace(/\[([^\]]+)\]/g, (match, columnName) => {
                const columnIndex = columnNames.indexOf(columnName);
                if (columnIndex !== -1 && columnIndex < rowData.length) {
                    const value = rowData[columnIndex];
                    // Пытаемся преобразовать в число, если возможно
                    const numValue = parseFloat(value);
                    return isNaN(numValue) ? '0' : numValue.toString();
                }
                return '0'; // Если столбец не найден, используем 0
            });

            // Проверяем, что после замены осталось что-то для вычисления
            if (!evaluatedFormula.trim()) {
                return '';
            }

            // Безопасное вычисление
            const result = new Function('return ' + evaluatedFormula)();
            
            // Проверяем, что результат - число
            if (typeof result === 'number' && !isNaN(result)) {
                // Округляем до 2 знаков после запятой
                return Math.round(result * 100) / 100;
            }
            return 'Error';
        } catch (error) {
            console.error('Ошибка вычисления формулы:', error);
            return 'Error';
        }
    },
    
    // Вставка названия столбца в формулу
    insertColumnIntoFormula: function(columnText) {
        const selStart = this.elements.formulaInput.selectionStart;
        const selEnd = this.elements.formulaInput.selectionEnd;
        const currentValue = this.elements.formulaInput.value;
        
        this.elements.formulaInput.value = currentValue.substring(0, selStart) + columnText + currentValue.substring(selEnd);
        this.elements.formulaInput.focus();
        this.elements.formulaInput.selectionStart = selStart + columnText.length;
        this.elements.formulaInput.selectionEnd = selStart + columnText.length;
    },
    
    // Генерация графиков
    generateCharts: function(columnName) {
        fetch(`/kpi/get_chart_data?column=${encodeURIComponent(columnName)}&user_id=${this.selectedUserId}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const chartData = data.data;
                    
                    // Извлекаем метки и значения
                    const labels = chartData.map(item => item.label);
                    const values = chartData.map(item => item.value);
                    
                    // Генерируем случайные цвета
                    const colors = chartData.map(() => {
                        const r = Math.floor(Math.random() * 200);
                        const g = Math.floor(Math.random() * 200);
                        const b = Math.floor(Math.random() * 200);
                        return `rgba(${r}, ${g}, ${b}, 0.7)`;
                    });
                    
                    // Создаем столбчатую диаграмму
                    if (this.currentCharts.bar) this.currentCharts.bar.destroy();
                    const barCtx = document.getElementById('barChart').getContext('2d');
                    this.currentCharts.bar = new Chart(barCtx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: columnName,
                                data: values,
                                backgroundColor: colors,
                                borderColor: colors.map(c => c.replace('0.7', '1')),
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                }
                            }
                        }
                    });
                    
                    // Создаем круговую диаграмму
                    if (this.currentCharts.pie) this.currentCharts.pie.destroy();
                    const pieCtx = document.getElementById('pieChart').getContext('2d');
                    this.currentCharts.pie = new Chart(pieCtx, {
                        type: 'pie',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: columnName,
                                data: values,
                                backgroundColor: colors,
                                borderColor: colors.map(c => c.replace('0.7', '1')),
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                legend: {
                                    position: 'right',
                                }
                            }
                        }
                    });
                    
                    this.showNotification('Графики успешно обновлены');
                } else {
                    this.showNotification(data.message || 'Ошибка при генерации графиков', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.showNotification('Ошибка при генерации графиков', 'error');
            });
    },
    
    // Показ уведомлений
    showNotification: function(message, type = 'success', duration = 3000) {
        const notificationId = 'notification-' + Date.now();
        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `notification notification-${type} fixed bottom-4 right-4 p-4 rounded shadow-lg transition-all duration-300`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="${this.getNotificationIcon(type)} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Возвращаем объект с методами для управления уведомлением
        return {
            update: (newMessage, newType) => {
                notification.querySelector('span').textContent = newMessage;
                notification.className = `notification notification-${newType} fixed bottom-4 right-4 p-4 rounded shadow-lg transition-all duration-300 show`;
                notification.querySelector('i').className = this.getNotificationIcon(newType) + ' mr-2';
            },
            hide: () => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        };
    },

    getNotificationIcon: function(type) {
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        return icons[type] || 'fas fa-info-circle';
    },

    getCsrfToken: function() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    },
    
    // Автоматическое сохранение
    setupAutoSave: function() {
        // Удаляем все предыдущие обработчики, если они есть
        document.querySelectorAll('.kpi-input').forEach(input => {
            const handler = this.debounceTimers[input.id];
            if (handler) {
                input.removeEventListener('input', handler);
                delete this.debounceTimers[input.id];
            }
        });
        
        // Добавляем обработчики ко всем существующим полям ввода
        this.addAutoSaveHandlers();
        
        // Создаем наблюдатель за DOM для добавления обработчиков к новым элементам
        if (this.autoSaveObserver) {
            this.autoSaveObserver.disconnect();
        }
        
        this.autoSaveObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Проверяем, что это элемент
                            if (node.classList && node.classList.contains('kpi-input')) {
                                this.addAutoSaveHandler(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('.kpi-input').forEach(input => {
                                    this.addAutoSaveHandler(input);
                                });
                            }
                        }
                    });
                }
            });
        });
        
        this.autoSaveObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Добавляем глобальный обработчик изменений для пересчета формул
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('kpi-input')) {
                this.recalculateAllFormulas();
            }
        });
    },




    recalculateAllFormulas: function() {
        const table = this.elements.kpiTable;
        if (!table) return;

        const headerRow = table.querySelector('thead tr');
        if (!headerRow) return;

        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('.kpi-cell');
            
            cells.forEach((cell, colIndex) => {
                const formulaInput = cell.querySelector('.cell-formula');
                const cellInput = cell.querySelector('.kpi-input');
                
                if (formulaInput?.value && cellInput) {
                    const formula = formulaInput.value;
                    const rowData = Array.from(row.querySelectorAll('.kpi-input')).map(input => input.value);
                    const result = this.evaluateFormula(formula, rowData, columnNames);
                    
                    if (result !== 'Error') {
                        cellInput.value = result;
                        cell.classList.add('formula-cell');
                        cell.classList.remove('formula-error');
                    } else {
                        cell.classList.add('formula-error');
                        cell.classList.remove('formula-cell');
                    }
                }
            });
        });
    },



    addAutoSaveHandlers: function() {
        document.querySelectorAll('.kpi-input').forEach(input => {
            this.addAutoSaveHandler(input);
        });
    },
    addAutoSaveHandler: function(input) {
        if (!input.id) {
            // Создаем уникальный ID если его нет
            input.id = 'kpi-input-' + Math.random().toString(36).substr(2, 9);
        }
        
        if (!this.debounceTimers[input.id]) {
            const handler = this.debouncedAutoSave.bind(this);
            input.addEventListener('input', handler);
            this.debounceTimers[input.id] = handler;
        }
    },
    debouncedAutoSave: function(e) {
        // Показываем индикатор сохранения
        this.showSavingIndicator(true);
        
        // Сбрасываем предыдущий таймер
        clearTimeout(this.autoSaveTimeout);
        
        // Устанавливаем новый таймер
        this.autoSaveTimeout = setTimeout(() => {
            this.performAutoSave();
        }, 1500); // 1.5 секунды задержки
    },
    performAutoSave: function() {
        // Если уже идет сохранение, пропускаем
        if (this.isSaving) return;
        this.isSaving = true;
        
        const formData = this.collectFormData();
        
        if (Object.keys(formData).length > 0) {
            this.showSavingIndicator(true);
            
            fetch('/kpi/save_kpi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    console.log('Автосохранение выполнено успешно');
                    // Краткое уведомление только для автосохранения
                    if (!this.userTriggeredSave) {
                        this.showNotification('Автосохранено', 'success', 1);
                    }
                } else {
                    throw new Error(data.message || 'Ошибка сервера');
                }
            })
            .catch(error => {
                console.error('Ошибка автосохранения:', error);
                this.showNotification('Ошибка сохранения: ' + error.message, 'error');
            })
            .finally(() => {
                this.isSaving = false;
                this.userTriggeredSave = false;
                this.showSavingIndicator(false);
            });
        } else {
            this.isSaving = false;
            this.showSavingIndicator(false);
        }
    },

    showSavingIndicator: function(show) {
        const indicator = document.getElementById('saving-indicator') || this.createSavingIndicator();
        indicator.style.display = show ? 'block' : 'none';
    },

    createSavingIndicator: function() {
        const indicator = document.createElement('div');
        indicator.id = 'saving-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '20px';
        indicator.style.right = '20px';
        indicator.style.padding = '5px 10px';
        indicator.style.backgroundColor = '#4CAF50';
        indicator.style.color = 'white';
        indicator.style.borderRadius = '4px';
        indicator.style.display = 'none';
        indicator.textContent = 'Сохранение...';
        document.body.appendChild(indicator);
        return indicator;
    },




    // Поиск по таблице
    setupTableSearch: function() {
        const tableHeader = document.querySelector('.bg-gray-50.border-b.border-gray-200');
        if (!tableHeader) return;

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по таблице...';
        searchInput.className = 'px-3 py-2 border rounded mb-3 sm:mb-4 w-full text-sm';
        
        tableHeader.insertBefore(searchInput, tableHeader.firstChild);
        
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = document.querySelectorAll('#kpi-table tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const match = Array.from(cells).some(cell => 
                    cell.textContent.toLowerCase().includes(searchTerm)
                );
                
                row.style.display = match ? '' : 'none';
            });
        });
    },            
    // Динамическое добавление строк
    setupDynamicRowAddition: function() {
        const tbody = this.elements.kpiTable.querySelector('tbody');
        
        const handler = (event) => {
            const inputElement = event.target;
            
            // Проверяем, что событие произошло на последней строке
            const lastRow = tbody.lastElementChild;
            if (!lastRow.contains(inputElement)) return;
            
            // Проверяем, заполнены ли все ячейки последней строки
            const lastRowCells = lastRow.querySelectorAll('.kpi-input');
            const allCellsFilled = Array.from(lastRowCells).every(cell => cell.value.trim() !== '');
            
            if (allCellsFilled) {
                this.addRow();
            }
        };
        
        // Удаляем предыдущий обработчик, если он есть
        if (tbody.inputHandler) {
            tbody.removeEventListener('input', tbody.inputHandler);
        }
        
        // Сохраняем обработчик как свойство tbody
        tbody.inputHandler = handler;
        tbody.addEventListener('input', handler);
    },
    
    // Автодополнение формул
    setupFormulaAutocomplete: function() {
        const availableColumns = Array.from(document.querySelectorAll('.column-tag')).map(tag => tag.textContent);
        
        this.elements.formulaInput.addEventListener('input', () => {
            const cursorPos = this.elements.formulaInput.selectionStart;
            const textBeforeCursor = this.elements.formulaInput.value.substring(0, cursorPos);
            
            // Ищем начало имени столбца
            const lastOpenBracket = textBeforeCursor.lastIndexOf('[');
            if (lastOpenBracket >= 0 && (cursorPos - lastOpenBracket > 1)) {
                const partialName = textBeforeCursor.substring(lastOpenBracket + 1).toLowerCase();
                const matchingColumns = availableColumns.filter(col => 
                    col.toLowerCase().includes(partialName)
                );
                
                if (matchingColumns.length > 0) {
                    this.showColumnSuggestions(matchingColumns, lastOpenBracket);
                }
            }
        });
    },
    
    // Валидация формул в реальном времени
    setupRealTimeValidation: function() {
        const validationResult = document.createElement('div');
        validationResult.className = 'validation-result text-xs sm:text-sm mt-1 sm:mt-2';
        this.elements.formulaInput.parentNode.appendChild(validationResult);
        
        this.elements.formulaInput.addEventListener('input', () => {
            const formula = this.elements.formulaInput.value;
            
            if (this.validateFormula(formula)) {
                validationResult.className = 'validation-result text-xs sm:text-sm mt-1 sm:mt-2 text-green-600';
                validationResult.innerHTML = '✓ Корректная формула';
            } else {
                validationResult.className = 'validation-result text-xs sm:text-sm mt-1 sm:mt-2 text-red-600';
                validationResult.innerHTML = '✖ Ошибка в формуле';
            }
        });
    },
    
    // Валидация формулы
    validateFormula: function(formula) {
        if (!formula || !formula.trim()) {
            return true; // Пустая формула считается валидной
        }
        
        // Удаляем все пробелы для проверки
        const cleanFormula = formula.replace(/\s+/g, '');
        
        // Проверяем на простое указание столбца
        if (/^\[[^\]]+\]$/.test(cleanFormula)) {
            return true;
        }
        
        // Проверяем наличие операторов между столбцами
        const columnRefs = cleanFormula.match(/\[[^\]]+\]/g) || [];
        if (columnRefs.length > 1) {
            // Между ссылками на столбцы должны быть операторы
            const operatorsBetween = cleanFormula.split(/\[[^\]]+\]/).slice(1, -1);
            const hasOperators = operatorsBetween.every(part => /^[\+\-\*\/]+$/.test(part));
            if (!hasOperators) {
                return false;
            }
        }
        
        // Проверка на корректность скобок
        let bracketBalance = 0;
        for (let char of cleanFormula) {
            if (char === '(') bracketBalance++;
            if (char === ')') bracketBalance--;
            if (bracketBalance < 0) return false;
        }
        
        return bracketBalance === 0;
    },
    
    // Обработка всех формул в таблице
    processTableFormulas: function() {
        const table = this.elements.kpiTable;
        const headerRow = table.querySelector('thead tr');
        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);
        
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('.kpi-cell');
            
            cells.forEach((cell, colIndex) => {
                const formulaInput = cell.querySelector('.cell-formula');
                const cellInput = cell.querySelector('.kpi-input');
                
                if (formulaInput && formulaInput.value) {
                    const formula = formulaInput.value;
                    
                    // Собираем данные всей строки
                    const rowData = Array.from(row.querySelectorAll('.kpi-input')).map(input => input.value);
                    
                    const result = this.evaluateFormula(formula, rowData, columnNames);
                    
                    if (result !== 'Error') {
                        cellInput.value = result;
                        cell.classList.add('formula-cell');
                    } else {
                        cell.classList.add('formula-error');
                    }
                }
            });
        });
    },
    
    // Показ подсказок для автодополнения
    showColumnSuggestions: function(columns, position) {
        // Реализация показа подсказок
        console.log('Available columns:', columns);
    }
};

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    KPIApp.init();
});
