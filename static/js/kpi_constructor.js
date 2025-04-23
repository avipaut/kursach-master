const KPIApp = {
    isAdmin: false, // Will be set dynamically
    selectedUserId: null, // Will be set dynamically
    currentCharts: { bar: null, pie: null },
    debounceTimers: {},
    autoSaveTimeout: null,
    autoSaveObserver: null,
    notificationTimeout: null,
    isSaving: false,
    userTriggeredSave: false,

    init: function() {
        
        console.log('Initializing KPIApp with:', {
            isAdmin: this.isAdmin,
            selectedUserId: this.selectedUserId,
            currentUserId: this.currentUserId
        });
    
        this.cacheElements();
        this.setupEventListeners();
        
        // Инициализация только если есть таблица KPI
        if (this.elements.kpiTable) {
            this.setupAutoSave();
            this.setupTableSearch();
            this.setupDynamicRowAddition();
            this.setupFormulaAutocomplete();
            this.setupRealTimeValidation();
            this.processTableFormulas();
        }
        if (!this.isAdmin) {
            document.getElementById('submit-for-review')?.addEventListener('click', () => this.submitForReview());
        }
    
        // Инициализация графиков
        const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
        if (activeTab === 'chart-tab' && this.elements.chartColumnSelect?.options.length > 0) {
            this.generateCharts(this.elements.chartColumnSelect.value);
        }
        
        console.log('KPIApp initialized successfully');
        
    },
    submitForReview: async function() {
        if (!confirm('Отправить ваш KPI на проверку администратору?')) return;
        
        try {
            const response = await fetch('/kpi/submit_for_review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    user_id: this.currentUserId
                })
            });
    
            const data = await response.json();
            if (data.status === 'success') {
                this.showNotification('KPI отправлен на проверку администратору', 'success');
            } else {
                throw new Error(data.message || 'Ошибка отправки');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при отправке на проверку: ' + error.message, 'error');
        }
    },
    cacheElements: function() {
        this.elements = {
            kpiTable: document.getElementById('kpi-table'),
            templateTable: document.getElementById('template-table'),
            addColumnBtn: document.getElementById('add_column'),
            addRowBtn: document.getElementById('add_row'),
            saveKpiBtn: document.getElementById('save_kpi'),
            addColumnTemplateBtn: document.getElementById('add_column_template'),
            addRowTemplateBtn: document.getElementById('add_row_template'),
            saveTemplateBtn: document.getElementById('save_template'),
            applyToAllBtn: document.getElementById('apply_to_all'),
            formulaModal: document.getElementById('formula-modal'),
            closeFormulaModal: document.getElementById('close-formula-modal'),
            formulaInput: document.getElementById('formula-input'),
            currentRowInput: document.getElementById('current-row'),
            currentColInput: document.getElementById('current-col'),
            currentTableInput: document.getElementById('current-table'),
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
    loadKpiData: async function() {
        if (!this.selectedUserId) {
            this.showNotification('Пользователь не выбран', 'error');
            return;
        }
    
        try {
            const response = await fetch(`/kpi?user_id=${this.selectedUserId}`);
            const html = await response.text();
            // Обновляем содержимое страницы (предполагается, что сервер возвращает HTML)
            document.querySelector('.tab-content.active').innerHTML = html;
            // Переинициализируем элементы и слушатели
            this.cacheElements();
            this.setupEventListeners();
            this.setupAutoSave();
        } catch (error) {
            console.error('Ошибка загрузки KPI:', error);
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    },
    setupEventListeners: function() {
        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.elements.tabButtons.forEach(btn => btn.classList.remove('active'));
                this.elements.tabContents.forEach(tab => tab.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(tabId).classList.add('active');

                if (tabId === 'chart-tab' && this.elements.chartColumnSelect?.options.length > 0) {
                    this.generateCharts(this.elements.chartColumnSelect.value);
                }
            });
        });
        const userSelect = document.getElementById('user-select');
        if (userSelect) {
            userSelect.addEventListener('change', (e) => {
                this.selectedUserId = parseInt(e.target.value) || null;
                console.log('Обновлён selectedUserId:', this.selectedUserId);
                // Перезагружаем данные KPI для выбранного пользователя
                this.loadKpiData();
            });
        }
        // Button event listeners
        if (this.elements.addColumnBtn) {
            this.elements.addColumnBtn.addEventListener('click', () => this.addColumn('kpi'));
        }
        if (this.elements.addRowBtn) {
            this.elements.addRowBtn.addEventListener('click', () => this.addRow('kpi'));
        }
        if (this.elements.saveKpiBtn) {
            this.elements.saveKpiBtn.addEventListener('click', () => this.saveKpiData());
        }
        if (this.elements.addColumnTemplateBtn) {
            this.elements.addColumnTemplateBtn.addEventListener('click', () => this.addColumn('template'));
        }
        if (this.elements.addRowTemplateBtn) {
            this.elements.addRowTemplateBtn.addEventListener('click', () => this.addRow('template'));
        }
        if (this.elements.saveTemplateBtn) {
            this.elements.saveTemplateBtn.addEventListener('click', () => this.saveTemplate());
        }
        if (this.elements.applyToAllBtn) {
            this.elements.applyToAllBtn.addEventListener('click', () => this.applyTemplateToAll());
        }

        // Formula modal
        this.elements.closeFormulaModal.addEventListener('click', () => this.closeFormulaModal());
        this.elements.cancelFormulaBtn.addEventListener('click', () => this.closeFormulaModal());
        this.elements.saveFormulaBtn.addEventListener('click', () => this.saveFormula());

        // Chart generation
        if (this.elements.generateChartBtn) {
            this.elements.generateChartBtn.addEventListener('click', () => {
                this.generateCharts(this.elements.chartColumnSelect.value);
            });
        }

        // Click events for dynamic elements
        document.addEventListener('click', (e) => {
            if (e.target.closest('.delete-row')) {
                this.deleteRow(e.target.closest('.delete-row'), 'kpi');
            }
            if (e.target.closest('.delete-column')) {
                this.deleteColumn(e.target.closest('.delete-column'), 'kpi');
            }
            if (e.target.closest('.delete-template-row')) {
                this.deleteRow(e.target.closest('.delete-template-row'), 'template');
            }
            if (e.target.closest('.delete-template-column')) {
                this.deleteColumn(e.target.closest('.delete-template-column'), 'template');
            }
            if (e.target.closest('.formula-btn')) {
                const btn = e.target.closest('.formula-btn');
                this.openFormulaModal(
                    btn.getAttribute('data-row'),
                    btn.getAttribute('data-col'),
                    btn.getAttribute('data-table')
                );
            }
        });

        // Column tag insertion
        this.elements.availableColumns.addEventListener('click', (e) => {
            if (e.target.classList.contains('column-tag')) {
                this.insertColumnIntoFormula(e.target.textContent);
            }
        });
    },

    addColumn: async function(tableType) {
        const columnName = prompt('Enter column name:');
        if (!columnName) return;

        this.showSavingIndicator(true);
        const endpoint = tableType === 'template' ? '/kpi/add_template_column' : '/kpi/add_column';
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
        const namePrefix = tableType === 'template' ? 'template_column_name' : 'column_name';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    column_name: columnName,
                    user_id: this.selectedUserId
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                const headerRow = document.getElementById(headerRowId);
                const columnCount = headerRow.cells.length;

                const newTh = document.createElement('th');
                newTh.className = 'relative group';
                newTh.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="truncate max-w-[100px] sm:max-w-none">${columnName}</span>
                        <input type="hidden" name="${namePrefix}_${columnCount}" value="${columnName}">
                        <button class="delete-btn delete-${tableType}-column ml-1 sm:ml-2" 
                                data-column="${columnName}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                headerRow.appendChild(newTh);

                const tbody = table.querySelector('tbody');
                Array.from(tbody.rows).forEach((row, rowIdx) => {
                    const newCell = document.createElement('td');
                    newCell.className = 'kpi-cell';
                    const inputId = `kpi-input-${tableType}-${rowIdx}-${columnCount}`;
                    newCell.innerHTML = `
                        <input type="text" class="kpi-input" id="${inputId}" 
                            name="${tableType}_cell_${rowIdx}_col_${columnCount}" value="">
                        <button class="formula-btn" data-row="${rowIdx}" data-col="${columnCount}" data-table="${tableType}">
                            <i class="fas fa-calculator"></i> fx
                        </button>
                        <input type="hidden" name="${tableType}_formula_${rowIdx}_col_${columnCount}" 
                            class="cell-formula" value="">
                    `;
                    row.appendChild(newCell);
                    this.addAutoSaveHandler(newCell.querySelector('.kpi-input'));
                });

                if (tableType !== 'template') {
                    const option = document.createElement('option');
                    option.value = columnName;
                    option.textContent = columnName;
                    this.elements.chartColumnSelect.appendChild(option);
                }

                const span = document.createElement('span');
                span.className = 'column-tag';
                span.textContent = `[${columnName}]`;
                this.elements.availableColumns.appendChild(span);

                this.performAutoSave(tableType);
                this.showNotification('Column added successfully');
            } else {
                this.showNotification(data.message || 'Error adding column', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error adding column', 'error');
        } finally {
            this.showSavingIndicator(false);
        }
    },

    addRow: function(tableType) {
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
        const namePrefix = tableType === 'template' ? 'template' : '';

        const headerRow = document.getElementById(headerRowId);
        const columnCount = headerRow.cells.length - 1;
        const tbody = table.querySelector('tbody');
        const rowCount = tbody.rows.length;

        const newRow = document.createElement('tr');
        newRow.dataset.rowIndex = rowCount;

        const actionCell = document.createElement('td');
        actionCell.className = 'text-center';
        actionCell.innerHTML = `
            <button class="delete-btn delete-${tableType}-row">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        newRow.appendChild(actionCell);

        for (let i = 0; i < columnCount; i++) {
            const newCell = document.createElement('td');
            newCell.className = 'kpi-cell';
            const inputId = `kpi-input-${tableType}-${rowCount}-${i}`;
            newCell.innerHTML = `
                <input type="text" class="kpi-input" id="${inputId}" 
                    name="${namePrefix}_cell_${rowCount}_col_${i}" value="">
                <button class="formula-btn" data-row="${rowCount}" data-col="${i}" data-table="${tableType}">
                    <i class="fas fa-calculator"></i> fx
                </button>
                <input type="hidden" name="${namePrefix}_formula_${rowCount}_col_${i}" 
                    class="cell-formula" value="">
            `;
            newRow.appendChild(newCell);
        }

        tbody.appendChild(newRow);
        this.addAutoSaveHandlers();
        this.showNotification('Row added successfully');
        this.performAutoSave(tableType);
    },

    deleteRow: async function(button, tableType) {
        const row = button.closest('tr');
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);

        if (!confirm('Are you sure you want to delete this row?')) return;

        this.showSavingIndicator(true);
        const endpoint = tableType === 'template' ? '/kpi/delete_template_row' : '/kpi/delete_row';
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    row_index: rowIndex,
                    user_id: this.selectedUserId
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                row.remove();
                const tbody = table.querySelector('tbody');
                const rows = tbody.querySelectorAll('tr');

                rows.forEach((row, newIndex) => {
                    const formulaBtns = row.querySelectorAll('.formula-btn');
                    formulaBtns.forEach(btn => btn.dataset.row = newIndex);

                    const inputs = row.querySelectorAll('.kpi-input, .cell-formula');
                    inputs.forEach(input => {
                        const nameParts = input.name.split('_');
                        input.name = `${nameParts[0]}_${newIndex}_${nameParts[2]}_${nameParts[3]}`;
                    });
                });

                this.performAutoSave(tableType);
                this.showNotification('Row deleted successfully');
            } else {
                this.showNotification(data.message || 'Error deleting row', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error deleting row', 'error');
        } finally {
            this.showSavingIndicator(false);
        }
    },

    deleteColumn: async function(button, tableType) {
        const column = button.getAttribute('data-column');
        if (!confirm(`Are you sure you want to delete column "${column}"? All data in this column will be lost.`)) return;

        this.showSavingIndicator(true);
        this.setUiEnabled(false);
        const endpoint = tableType === 'template' ? '/kpi/delete_template_column' : '/kpi/delete_column';
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
        const namePrefix = tableType === 'template' ? 'template' : '';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    column: column,
                    user_id: this.selectedUserId
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                const headerRow = document.getElementById(headerRowId);
                let colIndex = -1;

                for (let i = 0; i < headerRow.cells.length; i++) {
                    const colName = headerRow.cells[i].querySelector('span')?.textContent;
                    if (colName === column) {
                        colIndex = i;
                        break;
                    }
                }

                if (colIndex === -1) throw new Error('Column not found');

                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.cells[colIndex]) row.deleteCell(colIndex);
                });

                if (tableType !== 'template') {
                    const chartOptions = this.elements.chartColumnSelect.options;
                    for (let i = 0; i < chartOptions.length; i++) {
                        if (chartOptions[i].value === column) {
                            this.elements.chartColumnSelect.remove(i);
                            break;
                        }
                    }
                }

                this.renumberColumnsAfterDelete(colIndex, tableType);

                const columnTags = this.elements.availableColumns.querySelectorAll('.column-tag');
                columnTags.forEach(tag => {
                    if (tag.textContent === `[${column}]`) tag.remove();
                });

                this.performAutoSave(tableType);
                this.showNotification(`Column "${column}" deleted successfully`);

                if (tableType !== 'template' && this.elements.chartColumnSelect.value === column) {
                    this.elements.chartColumnSelect.value = '';
                }
            } else {
                this.showNotification(data.message || 'Error deleting column', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification(`Error deleting column: ${error.message}`, 'error');
        } finally {
            this.showSavingIndicator(false);
            this.setUiEnabled(true);
        }
    },

    renumberColumnsAfterDelete: function(deletedIndex, tableType) {
        const namePrefix = tableType === 'template' ? 'template_column_name' : 'column_name';
        const cellPrefix = tableType === 'template' ? 'template_cell' : 'cell';
        const formulaPrefix = tableType === 'template' ? 'template_formula' : 'formula';

        const columnInputs = document.querySelectorAll(`[name^="${namePrefix}_"]`);
        columnInputs.forEach(input => {
            const nameParts = input.name.split('_');
            const currentIdx = parseInt(nameParts[2]);
            if (currentIdx > deletedIndex) {
                input.name = `${namePrefix}_${currentIdx - 1}`;
            }
        });

        const cellInputs = document.querySelectorAll(`[name^="${cellPrefix}_"]`);
        cellInputs.forEach(input => {
            const nameParts = input.name.split('_');
            const rowIdx = parseInt(nameParts[1]);
            const currentColIdx = parseInt(nameParts[3]);
            if (currentColIdx > deletedIndex) {
                input.name = `${cellPrefix}_${rowIdx}_col_${currentColIdx - 1}`;
            }
        });

        const formulaBtns = document.querySelectorAll(`.formula-btn[data-table="${tableType}"]`);
        formulaBtns.forEach(btn => {
            const btnColIdx = parseInt(btn.getAttribute('data-col'));
            if (btnColIdx > deletedIndex) {
                btn.setAttribute('data-col', btnColIdx - 1);
            }
        });

        const formulaInputs = document.querySelectorAll(`[name^="${formulaPrefix}_"]`);
        formulaInputs.forEach(input => {
            const nameParts = input.name.split('_');
            const rowIdx = parseInt(nameParts[1]);
            const currentColIdx = parseInt(nameParts[3]);
            if (currentColIdx > deletedIndex) {
                input.name = `${formulaPrefix}_${rowIdx}_col_${currentColIdx - 1}`;
            }
        });
    },

    saveTemplate: async function() {
        this.userTriggeredSave = true;
        const savingNotification = this.showNotification('Saving template...', 'info', 0);
        this.elements.saveTemplateBtn.disabled = true;
        this.elements.saveTemplateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const formData = this.collectFormData('template');

        try {
            const response = await fetch('/kpi/save_template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.status === 'success') {
                this.lastSaveTime = new Date();
                savingNotification.update('Template saved successfully', 'success');
            } else {
                throw new Error(data.message || 'Server error');
            }
        } catch (error) {
            console.error('Error saving template:', error);
            savingNotification.update(`Error saving template: ${error.message}`, 'error');
        } finally {
            setTimeout(() => {
                this.elements.saveTemplateBtn.disabled = false;
                this.elements.saveTemplateBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
                savingNotification.hide();
            }, 1000);
        }
    },

    applyTemplateToAll: async function() {
        if (!confirm('Are you sure you want to apply this template to ALL users? Existing data will be overwritten.')) return;

        this.showSavingIndicator(true);
        this.elements.applyToAllBtn.disabled = true;

        const formData = this.collectFormData('template');

        try {
            const response = await fetch('/kpi/apply_template_to_all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.status === 'success') {
                this.showNotification('Template applied to all users successfully');
            } else {
                this.showNotification(data.message || 'Error applying template', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error applying template', 'error');
        } finally {
            this.showSavingIndicator(false);
            this.elements.applyToAllBtn.disabled = false;
        }
    },

    saveKpiData: async function() {
        this.userTriggeredSave = true;
        
        // Проверяем, что пользователь имеет право сохранять данные
        if (!this.selectedUserId && !this.currentUserId) {
            this.showNotification('Пользователь не выбран', 'error');
            return;
        }
        
        // Для обычных пользователей проверяем, что сохраняют свои данные
        if (!this.isAdmin && this.selectedUserId && this.selectedUserId !== this.currentUserId) {
            this.showNotification('Вы можете сохранять только свои данные', 'error');
            return;
        }
    
        const savingNotification = this.showNotification('Сохранение данных...', 'info', 0);
        this.elements.saveKpiBtn.disabled = true;
        this.elements.saveKpiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
    
        const formData = this.collectFormData('kpi');
        formData.last_save = new Date().toISOString();
    
        try {
            const response = await fetch('/kpi/save_kpi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(formData)
            });
    
            const data = await response.json();
            if (data.status === 'success') {
                this.lastSaveTime = new Date();
                savingNotification.update('Данные успешно сохранены', 'success');
    
                if (document.querySelector('.tab-button.active').dataset.tab === 'chart-tab') {
                    this.generateCharts(this.elements.chartColumnSelect.value);
                }
            } else {
                throw new Error(data.message || 'Ошибка сервера');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            savingNotification.update(`Ошибка сохранения: ${error.message}`, 'error');
        } finally {
            setTimeout(() => {
                this.elements.saveKpiBtn.disabled = false;
                this.elements.saveKpiBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить KPI';
                savingNotification.hide();
            }, 1000);
        }
    },

    collectFormData: function(tableType) {
        const formData = {
            user_id: this.isAdmin ? (this.selectedUserId || this.currentUserId) : this.currentUserId
        };
        const namePrefix = tableType === 'template' ? 'template_' : '';
    
        // Собираем названия столбцов
        const columnInputs = document.querySelectorAll(`[name^="${namePrefix}column_name_"]`);
        columnInputs.forEach(input => {
            formData[input.name] = input.value;
        });
    
        // Собираем данные ячеек
        const cellInputs = document.querySelectorAll(`[name^="${namePrefix}cell_"]`);
        cellInputs.forEach(input => {
            if (input.value !== '') { // Сохраняем только непустые значения
                formData[input.name] = input.value;
            }
        });
    
        // Собираем формулы
        const formulaInputs = document.querySelectorAll(`[name^="${namePrefix}formula_"]`);
        formulaInputs.forEach(input => {
            if (input.value) {
                formData[input.name] = input.value;
            }
        });
    
        console.log('Collected form data:', {
            tableType: tableType,
            formData: formData,
            columnsCount: columnInputs.length,
            cellsCount: cellInputs.length,
            formulasCount: formulaInputs.length
        });
    
        return formData;
    },

    openFormulaModal: function(row, col, tableType) {
        this.elements.currentRowInput.value = row;
        this.elements.currentColInput.value = col;
        this.elements.currentTableInput.value = tableType;

        const formulaInput = document.querySelector(`input[name="${tableType}_formula_${row}_col_${col}"]`);
        this.elements.formulaInput.value = formulaInput ? formulaInput.value : '';

        this.elements.formulaModal.classList.remove('hidden');
    },

    closeFormulaModal: function() {
        this.elements.formulaModal.classList.add('hidden');
    },

    saveFormula: function() {
        const row = this.elements.currentRowInput.value;
        const col = this.elements.currentColInput.value;
        const tableType = this.elements.currentTableInput.value;
        const formula = this.elements.formulaInput.value.trim();

        const formulaField = document.querySelector(`input[name="${tableType}_formula_${row}_col_${col}"]`);
        if (formulaField) formulaField.value = formula;

        this.closeFormulaModal();

        if (formula) {
            this.applyFormulaImmediately(row, col, formula, tableType);
        } else {
            const cellInput = document.querySelector(`input[name="${tableType}_cell_${row}_col_${col}"]`);
            if (cellInput) {
                cellInput.value = '';
                cellInput.parentElement.classList.remove('formula-cell', 'formula-error');
            }
        }

        this.performAutoSave(tableType);
    },

    applyFormulaImmediately: function(row, col, formula, tableType) {
        const cellInput = document.querySelector(`input[name="${tableType}_cell_${row}_col_${col}"]`);
        if (!cellInput) return;

        const cellElement = cellInput.parentElement;
        cellElement.classList.remove('formula-cell', 'formula-error');

        if (!formula || !formula.trim()) {
            cellInput.value = '';
            return;
        }

        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';

        const rowElement = cellInput.closest('tr');
        const rowInputs = rowElement.querySelectorAll('.kpi-input');
        const rowData = Array.from(rowInputs).map(input => input.value);

        const headerRow = document.getElementById(headerRowId);
        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);

        try {
            const result = this.evaluateFormula(formula, rowData, columnNames);
            if (result === 'Error') {
                cellElement.classList.add('formula-error');
            } else if (result !== '') {
                cellInput.value = result;
                cellElement.classList.add('formula-cell');
            }
        } catch (e) {
            console.error('Formula evaluation error:', e);
            cellElement.classList.add('formula-error');
        }
    },

    // Новая функция для пересчёта всех формул в строке
    recalculateRowFormulas: function(rowIndex, tableType) {
        // Проверяем права администратора и доступность таблицы
        if (tableType === 'template' && !this.isAdmin) {
            console.warn('Попытка пересчёта формул шаблона для не-администратора');
            return;
        }
    
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
    
        // Проверяем существование таблицы
        if (!table) {
            console.warn(`Таблица для ${tableType} не найдена`);
            return;
        }
    
        const headerRow = document.getElementById(headerRowId);
        if (!headerRow) {
            console.warn(`Заголовочная строка ${headerRowId} не найдена`);
            return;
        }
    
        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);
        const tbody = table.querySelector('tbody');
        const row = tbody.querySelector(`tr[data-row-index="${rowIndex}"]`) || tbody.children[rowIndex];
        if (!row) {
            console.warn(`Строка с индексом ${rowIndex} не найдена`);
            return;
        }
    
        const inputs = row.querySelectorAll('.kpi-input');
        const formulaInputs = row.querySelectorAll('.cell-formula');
        const rowData = Array.from(inputs).map(input => input.value);
    
        formulaInputs.forEach((formulaInput, colIndex) => {
            const formula = formulaInput.value;
            if (formula) {
                this.applyFormulaImmediately(rowIndex, colIndex, formula, tableType);
            }
        });
    },

    evaluateFormula: function(formula, rowData, columnNames) {
        if (!formula || !formula.trim()) return '';

        try {
            formula = formula.trim();
            if (/^\[[^\]]+\]$/.test(formula)) {
                const columnName = formula.slice(1, -1);
                const columnIndex = columnNames.indexOf(columnName);
                if (columnIndex !== -1 && columnIndex < rowData.length) {
                    return rowData[columnIndex];
                }
                return '';
            }

            const evaluatedFormula = formula.replace(/\[([^\]]+)\]/g, (match, columnName) => {
                const columnIndex = columnNames.indexOf(columnName);
                if (columnIndex !== -1 && columnIndex < rowData.length) {
                    const value = rowData[columnIndex];
                    const numValue = parseFloat(value);
                    return isNaN(numValue) ? '0' : numValue.toString();
                }
                return '0';
            });

            if (!evaluatedFormula.trim()) return '';

            const result = new Function('return ' + evaluatedFormula)();
            if (typeof result === 'number' && !isNaN(result)) {
                return Math.round(result * 100) / 100;
            }
            return 'Error';
        } catch (error) {
            console.error('Formula evaluation error:', error);
            return 'Error';
        }
    },

    insertColumnIntoFormula: function(columnText) {
        const selStart = this.elements.formulaInput.selectionStart;
        const selEnd = this.elements.formulaInput.selectionEnd;
        const currentValue = this.elements.formulaInput.value;

        this.elements.formulaInput.value = currentValue.substring(0, selStart) + columnText + currentValue.substring(selEnd);
        this.elements.formulaInput.focus();
        this.elements.formulaInput.selectionStart = selStart + columnText.length;
        this.elements.formulaInput.selectionEnd = selStart + columnText.length;
    },

    generateCharts: async function(columnName) {
        if (!columnName) return;

        try {
            const response = await fetch(`/kpi/get_chart_data?column=${encodeURIComponent(columnName)}&user_id=${this.selectedUserId}`);
            const data = await response.json();

            if (data.status === 'success') {
                const chartData = data.data;
                const labels = chartData.map(item => item.label);
                const values = chartData.map(item => item.value);

                const colors = chartData.map(() => {
                    const r = Math.floor(Math.random() * 200);
                    const g = Math.floor(Math.random() * 200);
                    const b = Math.floor(Math.random() * 200);
                    return `rgba(${r}, ${g}, ${b}, 0.7)`;
                });

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
                            y: { beginAtZero: true }
                        },
                        plugins: {
                            legend: { position: 'top' }
                        }
                    }
                });

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
                            legend: { position: 'right' }
                        }
                    }
                });

                this.showNotification('Charts updated successfully');
            } else {
                this.showNotification(data.message || 'Error generating charts', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error generating charts', 'error');
        }
    },

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

        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

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

    setUiEnabled: function(enabled) {
        const elements = [
            this.elements.addColumnBtn,
            this.elements.addRowBtn,
            this.elements.saveKpiBtn,
            this.elements.addColumnTemplateBtn,
            this.elements.addRowTemplateBtn,
            this.elements.saveTemplateBtn,
            this.elements.applyToAllBtn,
            ...document.querySelectorAll('.delete-column'),
            ...document.querySelectorAll('.delete-row'),
            ...document.querySelectorAll('.delete-template-column'),
            ...document.querySelectorAll('.delete-template-row'),
            ...document.querySelectorAll('.formula-btn')
        ].filter(el => el);

        elements.forEach(el => {
            el.disabled = !enabled;
        });
    },

    setupAutoSave: function() {
        // Удаляем старые обработчики
        document.querySelectorAll('.kpi-input').forEach(input => {
            const handler = this.debounceTimers[input.id];
            if (handler) {
                input.removeEventListener('input', handler);
                delete this.debounceTimers[input.id];
            }
        });
    
        // Добавляем новые обработчики
        this.addAutoSaveHandlers();
    
        // Наблюдатель за изменениями DOM
        if (this.autoSaveObserver) {
            this.autoSaveObserver.disconnect();
        }
    
        this.autoSaveObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.classList?.contains('kpi-input')) {
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
        
        console.log('Auto-save system initialized');
    },

    addAutoSaveHandlers: function() {
        document.querySelectorAll('.kpi-input').forEach(input => {
            this.addAutoSaveHandler(input);
        });
    },

    addAutoSaveHandler: function(input) {
        if (!input.id) {
            input.id = 'kpi-input-' + Math.random().toString(36).substr(2, 9);
        }
    
        if (!this.debounceTimers[input.id]) {
            const handler = (e) => {
                this.debouncedAutoSave(e);
                // Определяем tableType: для не-администраторов всегда 'kpi'
                const tableType = this.isAdmin && e.target.name.startsWith('template_') ? 'template' : 'kpi';
                const rowIndex = parseInt(e.target.name.split('_')[1]);
                this.recalculateRowFormulas(rowIndex, tableType);
            };
            input.addEventListener('input', handler);
            this.debounceTimers[input.id] = handler;
        }
    },

    debouncedAutoSave: function(e) {
        this.showSavingIndicator(true);
        clearTimeout(this.autoSaveTimeout);
        
        // Определяем tableType с учетом прав пользователя
        let tableType = 'kpi';
        if (this.isAdmin && e.target.name.startsWith('template_')) {
            tableType = 'template';
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.performAutoSave(tableType);
            
            // Пересчет формул только для таблицы kpi
            if (tableType === 'kpi') {
                const rowIndex = parseInt(e.target.name.split('_')[1]);
                this.recalculateRowFormulas(rowIndex, tableType);
            }
        }, 1500);
    },

    performAutoSave: async function(tableType) {
        if (this.isSaving) {
            console.warn('Auto-save already in progress');
            return;
        }
    
        // Для обычных пользователей разрешаем только таблицу kpi
        if (!this.isAdmin && tableType === 'template') {
            console.log('Regular users cannot save templates');
            return;
        }
    
        this.isSaving = true;
        const formData = this.collectFormData(tableType);
    
        // Проверяем, есть ли данные для сохранения
        const hasData = Object.keys(formData).length > 1; // кроме user_id
        
        if (!hasData) {
            console.log('No data to save, skipping auto-save');
            this.isSaving = false;
            return;
        }
    
        try {
            const endpoint = tableType === 'template' ? '/kpi/save_template' : '/kpi/save_kpi';
            console.log('Sending auto-save to:', endpoint, 'with data:', formData);
    
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(formData)
            });
    
            const data = await response.json();
            
            if (data.status === 'success') {
                console.log('Auto-save successful');
                if (!this.userTriggeredSave) {
                    this.showNotification('Changes auto-saved', 'success', 1000);
                }
            } else {
                throw new Error(data.message || 'Server error');
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.showNotification('Auto-save error: ' + error.message, 'error');
        } finally {
            this.isSaving = false;
            this.userTriggeredSave = false;
        }
    },
    getCsrfToken: function() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
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
        indicator.textContent = 'Saving...';
        document.body.appendChild(indicator);
        return indicator;
    },

    setupTableSearch: function() {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search table...';
        searchInput.className = 'px-3 py-2 border rounded mb-3 sm:mb-4 w-full text-sm';

        const tableHeader = document.querySelector('.bg-gray-50.border-b.border-gray-200');
        if (tableHeader) tableHeader.insertBefore(searchInput, tableHeader.firstChild);

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const tables = [this.elements.kpiTable, this.elements.templateTable].filter(t => t);
            tables.forEach(table => {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td.kpi-cell input.kpi-input');
                    const rowText = Array.from(cells).map(cell => cell.value.toLowerCase()).join(' ');
                    row.style.display = rowText.includes(searchTerm) ? '' : 'none';
                });
            });
        });
    },

    setupDynamicRowAddition: function() {
        const addRowOnScroll = (table, tableType) => {
            if (!table) return;
            const container = table.closest('.overflow-x-auto');
            if (!container) return;

            container.addEventListener('scroll', () => {
                if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
                    this.addRow(tableType);
                }
            });
        };

        addRowOnScroll(this.elements.kpiTable, 'kpi');
        addRowOnScroll(this.elements.templateTable, 'template');
    },

    setupFormulaAutocomplete: function() {
        const functions = ['sum', 'avg', 'min', 'max', 'round', 'sqrt', 'log', 'sin', 'cos', 'tan'];
        this.elements.formulaInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            const suggestions = functions.filter(f => f.startsWith(value.split(' ').pop()));
            const suggestionBox = document.getElementById('formula-suggestions') || this.createSuggestionBox();
            suggestionBox.innerHTML = suggestions.map(s => `<div class="suggestion-item">${s}</div>`).join('');
            suggestionBox.style.display = suggestions.length ? 'block' : 'none';
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                const currentValue = this.elements.formulaInput.value;
                const lastSpace = currentValue.lastIndexOf(' ');
                this.elements.formulaInput.value = currentValue.substring(0, lastSpace + 1) + e.target.textContent;
                document.getElementById('formula-suggestions').style.display = 'none';
                this.elements.formulaInput.focus();
            }
        });
    },

    createSuggestionBox: function() {
        const suggestionBox = document.createElement('div');
        suggestionBox.id = 'formula-suggestions';
        suggestionBox.className = 'absolute bg-white border rounded shadow-lg mt-1 max-h-40 overflow-y-auto';
        suggestionBox.style.display = 'none';
        this.elements.formulaInput.parentElement.appendChild(suggestionBox);
        return suggestionBox;
    },

    setupRealTimeValidation: function() {
        this.elements.formulaInput.addEventListener('input', async () => {
            const formula = this.elements.formulaInput.value;
            const tableType = this.elements.currentTableInput.value;
            try {
                const response = await fetch('/kpi/validate_formula', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify({
                        formula: formula,
                        template: tableType === 'template'
                    })
                });
                const data = await response.json();
                const errorDiv = document.getElementById('formula-error') || this.createFormulaErrorDiv();
                errorDiv.textContent = data.valid ? '' : data.errors.join(', ');
                errorDiv.style.display = data.valid ? 'none' : 'block';
                this.elements.saveFormulaBtn.disabled = !data.valid;
            } catch (error) {
                console.error('Formula validation error:', error);
            }
        });
    },

    createFormulaErrorDiv: function() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'formula-error';
        errorDiv.className = 'text-red-500 text-sm mt-2';
        this.elements.formulaInput.parentElement.appendChild(errorDiv);
        return errorDiv;
    },

    processTableFormulas: function() {
        const tables = [
            { table: this.elements.kpiTable, type: 'kpi' },
            { table: this.elements.templateTable, type: 'template' }
        ];

        tables.forEach(({ table, type }) => {
            if (!table) return;
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = tbody.querySelectorAll('tr');
            rows.forEach((row, rowIndex) => {
                const formulaInputs = row.querySelectorAll('.cell-formula');
                formulaInputs.forEach((input, colIndex) => {
                    if (input.value) {
                        this.applyFormulaImmediately(rowIndex, colIndex, input.value, type);
                    }
                });
            });
        });
    },

    recalculateRowFormulas: function(rowIndex, tableType) {
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
        const headerRow = document.getElementById(headerRowId);
        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);
        const tbody = table.querySelector('tbody');
        const row = tbody.querySelector(`tr[data-row-index="${rowIndex}"]`) || tbody.children[rowIndex];
        if (!row) return;
        const inputs = row.querySelectorAll('.kpi-input');
        const formulaInputs = row.querySelectorAll('.cell-formula');
        const rowData = Array.from(inputs).map(input => input.value);
        formulaInputs.forEach((formulaInput, colIndex) => {
            const formula = formulaInput.value;
            if (formula) {
                this.applyFormulaImmediately(rowIndex, colIndex, formula, tableType);
            }
        });
    },

    applyFormulaImmediately: function(row, col, formula, tableType) {
        const cellInput = document.querySelector(`input[name="${tableType}_cell_${row}_col_${col}"]`);
        if (!cellInput) return;

        const cellElement = cellInput.parentElement;
        cellElement.classList.remove('formula-cell', 'formula-error');

        if (!formula || !formula.trim()) {
            cellInput.value = '';
            return;
        }

        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';

        const rowElement = cellInput.closest('tr');
        const rowInputs = rowElement.querySelectorAll('.kpi-input');
        const rowData = Array.from(rowInputs).map(input => input.value);

        const headerRow = document.getElementById(headerRowId);
        const columnNames = Array.from(headerRow.querySelectorAll('th span')).map(span => span.textContent);

        try {
            const result = this.evaluateFormula(formula, rowData, columnNames);
            if (result === 'Error') {
                cellElement.classList.add('formula-error');
            } else if (result !== '') {
                cellInput.value = result;
                cellElement.classList.add('formula-cell');
            }
        } catch (e) {
            console.error('Formula evaluation error:', e);
            cellElement.classList.add('formula-error');
        }
    },

    evaluateFormula: function(formula, rowData, columnNames) {
        if (!formula || !formula.trim()) return '';

        try {
            formula = formula.trim();
            if (/^\[[^\]]+\]$/.test(formula)) {
                const columnName = formula.slice(1, -1);
                const columnIndex = columnNames.indexOf(columnName);
                if (columnIndex !== -1 && columnIndex < rowData.length) {
                    return rowData[columnIndex];
                }
                return '';
            }

            const evaluatedFormula = formula.replace(/\[([^\]]+)\]/g, (match, columnName) => {
                const columnIndex = columnNames.indexOf(columnName);
                if (columnIndex !== -1 && columnIndex < rowData.length) {
                    const value = rowData[columnIndex];
                    const numValue = parseFloat(value);
                    return isNaN(numValue) ? '0' : numValue.toString();
                }
                return '0';
            });

            if (!evaluatedFormula.trim()) return '';

            const result = new Function('return ' + evaluatedFormula)();
            if (typeof result === 'number' && !isNaN(result)) {
                return Math.round(result * 100) / 100;
            }
            return 'Error';
        } catch (error) {
            console.error('Formula evaluation error:', error);
            return 'Error';
        }
    },

    insertColumnIntoFormula: function(columnText) {
        const selStart = this.elements.formulaInput.selectionStart;
        const selEnd = this.elements.formulaInput.selectionEnd;
        const currentValue = this.elements.formulaInput.value;

        this.elements.formulaInput.value = currentValue.substring(0, selStart) + columnText + currentValue.substring(selEnd);
        this.elements.formulaInput.focus();
        this.elements.formulaInput.selectionStart = selStart + columnText.length;
        this.elements.formulaInput.selectionEnd = selStart + columnText.length;
    },

    generateCharts: async function(columnName) {
        if (!columnName) return;

        try {
            const response = await fetch(`/kpi/get_chart_data?column=${encodeURIComponent(columnName)}&user_id=${this.selectedUserId}`);
            const data = await response.json();

            if (data.status === 'success') {
                const chartData = data.data;
                const labels = chartData.map(item => item.label);
                const values = chartData.map(item => item.value);

                const colors = chartData.map(() => {
                    const r = Math.floor(Math.random() * 200);
                    const g = Math.floor(Math.random() * 200);
                    const b = Math.floor(Math.random() * 200);
                    return `rgba(${r}, ${g}, ${b}, 0.7)`;
                });

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
                            y: { beginAtZero: true }
                        },
                        plugins: {
                            legend: { position: 'top' }
                        }
                    }
                });

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
                            legend: { position: 'right' }
                        }
                    }
                });

                this.showNotification('Charts updated successfully');
            } else {
                this.showNotification(data.message || 'Error generating charts', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error generating charts', 'error');
        }
    },

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

        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

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

    setUiEnabled: function(enabled) {
        const elements = [
            this.elements.addColumnBtn,
            this.elements.addRowBtn,
            this.elements.saveKpiBtn,
            this.elements.addColumnTemplateBtn,
            this.elements.addRowTemplateBtn,
            this.elements.saveTemplateBtn,
            this.elements.applyToAllBtn,
            ...document.querySelectorAll('.delete-column'),
            ...document.querySelectorAll('.delete-row'),
            ...document.querySelectorAll('.delete-template-column'),
            ...document.querySelectorAll('.delete-template-row'),
            ...document.querySelectorAll('.formula-btn')
        ].filter(el => el);

        elements.forEach(el => {
            el.disabled = !enabled;
        });
    },

    setupAutoSave: function() {
        document.querySelectorAll('.kpi-input').forEach(input => {
            const handler = this.debounceTimers[input.id];
            if (handler) {
                input.removeEventListener('input', handler);
                delete this.debounceTimers[input.id];
            }
        });

        this.addAutoSaveHandlers();

        if (this.autoSaveObserver) {
            this.autoSaveObserver.disconnect();
        }

        this.autoSaveObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.classList?.contains('kpi-input')) {
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
    },

    addAutoSaveHandlers: function() {
        document.querySelectorAll('.kpi-input').forEach(input => {
            this.addAutoSaveHandler(input);
        });
    },

    addAutoSaveHandler: function(input) {
        if (!input.id) {
            input.id = 'kpi-input-' + Math.random().toString(36).substr(2, 9);
        }
    
        if (!this.debounceTimers[input.id]) {
            const handler = (e) => {
                // Для обычных пользователей всегда 'kpi', для админов определяем по имени поля
                const tableType = this.isAdmin && e.target.name.startsWith('template_') ? 'template' : 'kpi';
                
                console.log('Input change detected:', {
                    input: e.target.name,
                    tableType: tableType,
                    userId: this.isAdmin ? this.selectedUserId : this.currentUserId
                });
    
                this.debouncedAutoSave(e);
                
                // Пересчет формул только для таблицы kpi
                if (tableType === 'kpi') {
                    const rowIndex = parseInt(e.target.name.split('_')[1]);
                    this.recalculateRowFormulas(rowIndex, tableType);
                }
            };
            
            input.addEventListener('input', handler);
            this.debounceTimers[input.id] = handler;
        }
    },
    debouncedAutoSave: function(e) {
        this.showSavingIndicator(true);
        clearTimeout(this.autoSaveTimeout);

        const tableType = e.target.name.startsWith('template_') ? 'template' : 'kpi';
        this.autoSaveTimeout = setTimeout(() => {
            this.performAutoSave(tableType);
        }, 1500);
    },

    performAutoSave: async function(tableType) {
        if (this.isSaving) return;
        this.isSaving = true;

        const formData = this.collectFormData(tableType);

        if (Object.keys(formData).length > 0) {
            this.showSavingIndicator(true);
            const endpoint = tableType === 'template' ? '/kpi/save_template' : '/kpi/save_kpi';

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                if (data.status === 'success') {
                    console.log('Auto-save successful');
                    if (!this.userTriggeredSave) {
                        this.showNotification('Auto-saved', 'success', 1000);
                    }
                } else {
                    throw new Error(data.message || 'Server error');
                }
            } catch (error) {
                console.error('Auto-save error:', error);
                this.showNotification('Save error: ' + error.message, 'error');
            } finally {
                this.isSaving = false;
                this.userTriggeredSave = false;
                this.showSavingIndicator(false);
            }
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
        indicator.textContent = 'Saving...';
        document.body.appendChild(indicator);
        return indicator;
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    KPIApp.init();
});