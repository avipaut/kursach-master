const KPIApp = {
    isAdmin: false,
    selectedUserId: null,
    currentUserId: null,
    currentCharts: { bar: null, pie: null },
    debounceTimers: {},
    autoSaveTimeout: null,
    autoSaveObserver: null,
    notificationTimeout: null,
    isSaving: false,
    userTriggeredSave: false,
    formulaDependencies: {},
    formulaCache: {},
    lastSaveTime: null,

    init: function() {
        console.log('Initializing KPIApp with:', {
            isAdmin: this.isAdmin,
            selectedUserId: this.selectedUserId,
            currentUserId: this.currentUserId
        });
        this.isInRecalculation = new Set(); // Для отслеживания текущих пересчётов
        console.log('Initializing KPIApp...');
        this.cacheElements();
        this.setupEventListeners();
        
        // Инициализируем размеры всех textarea после полной загрузки страницы
        window.addEventListener('load', () => {
            console.log('Window loaded, adjusting all textarea heights');
            document.querySelectorAll('textarea.kpi-input').forEach(textarea => {
                this.adjustTextareaHeight(textarea);
            });
        });
        
        // Также настраиваем размеры через небольшой таймаут, чтобы стили загрузились
        setTimeout(() => {
            document.querySelectorAll('textarea.kpi-input').forEach(textarea => {
                this.adjustTextareaHeight(textarea);
            });
        }, 100);

        if (this.elements.kpiTable) {
            this.setupTextareaAutosize(); // Добавленная строка
            this.setupAutoSave();
            this.setupTableSearch();
            this.setupDynamicRowAddition();
            this.setupFormulaAutocomplete();
            this.setupRealTimeValidation();
            this.buildDependencyGraph();
            this.processTableFormulas();
            this.setupFormulaModalButtons();
            this.setupRealTimeFormulaEngine();
            this.setupMutationObserver();
        }
        setTimeout(() => {
            this.buildDependencyGraph();
            this.processAllFormulas();
            this.setupRealTimeFormulaEngine();
        }, 500);
        
        console.log('Initialization complete');
        
        if (!this.isAdmin) {
            document.getElementById('submit-for-review')?.addEventListener('click', () => this.submitForReview());
        }

        const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
        if (activeTab === 'chart-tab' && this.elements.chartColumnSelect?.options.length > 0) {
            this.generateCharts(this.elements.chartColumnSelect.value);
        }
        
        console.log('KPIApp initialized successfully');
        this.setupInstantFormulaUpdates();
    },
    processAllFormulas: function() {
    console.log('Processing all formulas...');
    
    const tables = [
        { table: this.elements.kpiTable, type: 'kpi' },
        { table: this.elements.templateTable, type: 'template' }
    ];

    tables.forEach(({ table, type }) => {
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, rowIndex) => {
            const formulaInputs = row.querySelectorAll('.cell-formula');
            formulaInputs.forEach((input, colIndex) => {
                if (input.value) {
                    this.applyFormula(rowIndex, colIndex, input.value, type);
                }
            });
        });
    });
},
renderTable: function(tableType) {
    console.log(`Rendering ${tableType} table with columns: ${columns}`);
    console.log(`Current data: ${JSON.stringify(data)}`);

    // Проверяем максимальный индекс строки в формулах
    const maxRowRef = this.getMaxRowReference(formulas);
    if (maxRowRef >= data.length) {
        console.log(`Adding ${maxRowRef - data.length + 1} rows to match formula references`);
        while (data.length <= maxRowRef) {
            data.push(new Array(columns.length).fill(''));
            formulas.push(new Array(columns.length).fill(''));
        }
    }

    // Проверяем наличие всех столбцов
    const requiredColumns = ['йцуй']; // Добавьте другие необходимые столбцы
    requiredColumns.forEach(col => {
        if (!columns.includes(col)) {
            console.warn(`Column ${col} not found, adding it`);
            columns.push(col);
            data.forEach(row => row.push(''));
            formulas.forEach(row => row.push(''));
        }
    });

    // Очищаем таблицу
    table.innerHTML = '';

    // Создаем заголовок
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Добавляем кнопку действий
    const actionsTh = document.createElement('th');
    actionsTh.textContent = 'Actions';
    headerRow.appendChild(actionsTh);

    // Добавляем колонки
    columns.forEach((col, colIdx) => {
        const th = document.createElement('th');
        th.className = 'relative group';
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between';
        
        const span = document.createElement('span');
        span.className = 'truncate max-w-[100px] sm:max-w-none';
        span.textContent = col;
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `${tableType}_column_name_${colIdx}`;
        input.value = col;
        
        const button = document.createElement('button');
        button.className = 'delete-btn delete-column ml-1 sm:ml-2';
        button.dataset.column = col;
        button.innerHTML = '<i class="fas fa-times"></i>';
        
        div.appendChild(span);
        div.appendChild(input);
        div.appendChild(button);
        th.appendChild(div);
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Создаем тело таблицы
    const tbody = document.createElement('tbody');
    
    data.forEach((row, rowIdx) => {
        const tr = document.createElement('tr');
        
        // Кнопка удаления строки
        const actionsTd = document.createElement('td');
        actionsTd.className = 'text-center';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = `delete-btn delete-${tableType}-row`;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        
        actionsTd.appendChild(deleteBtn);
        tr.appendChild(actionsTd);

        // Ячейки данных
        row.forEach((cell, colIdx) => {
            const td = document.createElement('td');
            td.className = 'kpi-cell';
            
            // Используем textarea вместо input
            const textarea = document.createElement('textarea');
            textarea.className = 'kpi-input';
            textarea.name = `${tableType}_cell_${rowIdx}_col_${colIdx}`;
            textarea.value = cell || '';
            textarea.rows = 1;
            
            const formulaBtn = document.createElement('button');
            formulaBtn.className = 'formula-btn';
            formulaBtn.dataset.row = rowIdx;
            formulaBtn.dataset.col = colIdx;
            formulaBtn.dataset.table = tableType;
            formulaBtn.innerHTML = '<i class="fas fa-calculator"></i> fx';
            
            const formulaInput = document.createElement('input');
            formulaInput.type = 'hidden';
            formulaInput.name = `${tableType}_formula_${rowIdx}_col_${colIdx}`;
            formulaInput.className = 'cell-formula';
            formulaInput.value = formulas[rowIdx]?.[colIdx] || '';
            
            td.appendChild(textarea);
            td.appendChild(formulaBtn);
            td.appendChild(formulaInput);
            tr.appendChild(td);
            
            // Настраиваем автоматическую высоту textarea
            setTimeout(() => this.adjustTextareaHeight(textarea), 0);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // Добавляем обработчики для автоматического изменения размера
    this.setupTextareaAutosize();
},
    getMaxRowReference: function(formulas) {
        let maxRow = 0;
        formulas.forEach(row => {
            row.forEach(formula => {
                const matches = formula.match(/#(\d+)/g) || [];
                matches.forEach(match => {
                    const rowNum = parseInt(match.slice(1));
                    if (rowNum > maxRow) maxRow = rowNum;
                });
            });
        });
        return maxRow;
    },
    setupRealTimeFormulaEngine: function() {
        // Обработчик для всех изменений в таблице
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('kpi-input')) {
                const input = e.target;
                const nameParts = input.name.split('_');
                const tableType = nameParts[0] === 'template' ? 'template' : 'kpi';
                const rowIndex = parseInt(nameParts[1]);
                const colIndex = parseInt(nameParts[3]);
                
                // Находим соответствующую формулу
                const formulaInput = document.querySelector(
                    `input[name="${tableType}_formula_${rowIndex}_col_${colIndex}"]`
                );
                
                // Если есть формула - пересчитываем
                if (formulaInput?.value) {
                    this.applyFormula(rowIndex, colIndex, formulaInput.value, tableType);
                }
                
                // Обновляем все зависимые ячейки
                this.updateAllFormulasThatDependOn(tableType, rowIndex, colIndex);
            }
        });
        
        // Принудительный пересчёт при загрузке
        setTimeout(() => this.processAllFormulas(), 1000);
    },
    updateAllFormulasThatDependOn: function(tableType, row, col) {
        const cellKey = `${tableType}_${row}_${col}`;
        const dependents = this.findAllDependentCells(cellKey);
        
        dependents.forEach(depCellKey => {
            const [depTableType, depRow, depCol] = depCellKey.split('_');
            const formulaInput = document.querySelector(
                `input[name="${depTableType}_formula_${depRow}_col_${depCol}"]`
            );
            
            if (formulaInput?.value) {
                this.applyFormula(depRow, depCol, formulaInput.value, depTableType);
            }
        });
    },
    findAllDependentCells: function(cellKey, visited = new Set()) {
        if (visited.has(cellKey)) return [];
        visited.add(cellKey);
    
        const directDependents = this.formulaDependencies[cellKey] || [];
        let allDependents = [...directDependents];
    
        directDependents.forEach(dep => {
            allDependents = [...allDependents, ...this.findAllDependentCells(dep, new Set(visited))];
        });
    
        return [...new Set(allDependents)];
    },
    setupMutationObserver: function() {
        // Отслеживаем изменения в DOM (на случай динамической загрузки таблиц)
        const observer = new MutationObserver((mutations) => {
            if (document.querySelector('.kpi-input')) {
                this.setupRealTimeFormulaEngine();
                this.buildDependencyGraph();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    // ====================== Formula Handling ======================
    buildDependencyGraph: function() {
        console.log('Building dependency graph...');
        this.formulaDependencies = {};
        
        const tables = [
            { table: this.elements.kpiTable, type: 'kpi' },
            { table: this.elements.templateTable, type: 'template' }
        ];
    
        tables.forEach(({ table, type }) => {
            if (!table) {
                console.log(`${type} table not found`);
                return;
            }
            
            const tbody = table.querySelector('tbody');
            if (!tbody) {
                console.log('tbody not found');
                return;
            }
            
            const rows = tbody.querySelectorAll('tr');
            console.log(`Found ${rows.length} rows in ${type} table`);
            
            rows.forEach((row, rowIndex) => {
                const formulaInputs = row.querySelectorAll('.cell-formula');
                console.log(`Row ${rowIndex} has ${formulaInputs.length} formulas`);
                
                formulaInputs.forEach((input, colIndex) => {
                    if (input.value) {
                        console.log(`Parsing formula at ${type}_${rowIndex}_${colIndex}: ${input.value}`);
                        this.parseFormulaDependencies(input.value, rowIndex, colIndex, type);
                    }
                });
            });
        });
        
        console.log('Dependency graph:', this.formulaDependencies);
    },
    setupFormulaModalButtons: function() {
        // Обработчики для кнопок операторов
        document.querySelectorAll('.operator-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const operator = btn.textContent.trim();
                this.insertIntoFormula(operator);
            });
        });
        
        // Обработчики для кнопок функций
        document.querySelectorAll('.function-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const func = btn.textContent.trim() + '(';
                this.insertIntoFormula(func);
            });
        });
        
        // Обработчики для тегов столбцов
        document.querySelectorAll('.column-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.preventDefault();
                this.insertColumnIntoFormula(tag.textContent);
            });
        });
    },
    insertIntoFormula: function(text) {
        const input = this.elements.formulaInput;
        if (!input) return;
        
        const startPos = input.selectionStart;
        const endPos = input.selectionEnd;
        const currentValue = input.value;
        
        // Проверяем, не вставляем ли мы дубликат оператора
        const prevChar = currentValue.substring(startPos - 1, startPos);
        const nextChar = currentValue.substring(endPos, endPos + 1);
        
        // Если вставляем оператор и перед/после уже есть такой же оператор - не вставляем
        if (/[\+\-\*\/\^%=]/.test(text) && (prevChar === text || nextChar === text)) {
            return;
        }
        
        // Вставляем текст на место курсора или заменяем выделение
        input.value = currentValue.substring(0, startPos) + text + currentValue.substring(endPos);
        
        // Устанавливаем курсор после вставленного текста
        input.focus();
        input.selectionStart = startPos + text.length;
        input.selectionEnd = startPos + text.length;
        
        // Триггерим событие input для валидации
        input.dispatchEvent(new Event('input'));
    },
    parseFormulaDependencies: function(formula, row, col, tableType) {
        const cellKey = `${tableType}_${row}_${col}`;
        this.formulaDependencies[cellKey] = [];
        
        // Очищаем старые обратные зависимости
        Object.keys(this.formulaDependencies).forEach(key => {
            this.formulaDependencies[key] = this.formulaDependencies[key].filter(
                dep => dep !== cellKey
            );
        });
    
        const refPattern = /\[([^\]#]+)(?:#(\d+))?\]/g;
        let match;
        const dependencies = new Set();
        
        while ((match = refPattern.exec(formula)) !== null) {
            const columnName = match[1];
            const rowRef = match[2];
            
            const headerRow = document.getElementById(
                tableType === 'template' 
                    ? 'template-column-names-row' 
                    : 'column-names-row'
            );
            
            if (headerRow) {
                const columns = Array.from(headerRow.querySelectorAll('th span'));
                const columnIndex = columns.findIndex(
                    span => span.textContent === columnName
                );
                
                if (columnIndex !== -1) {
                    const targetRow = rowRef ? parseInt(rowRef) : row;
                    const dependentCellKey = `${tableType}_${targetRow}_${columnIndex}`;
                    
                    // Ключевое исправление: не добавляем зависимость на саму себя
                    if (dependentCellKey !== cellKey) {
                        dependencies.add(dependentCellKey);
                    }
                }
            }
        }
        
        this.formulaDependencies[cellKey] = Array.from(dependencies);
        
        // Обновляем обратные зависимости
        dependencies.forEach(depCellKey => {
            if (!this.formulaDependencies[depCellKey]) {
                this.formulaDependencies[depCellKey] = [];
            }
            if (!this.formulaDependencies[depCellKey].includes(cellKey)) {
                this.formulaDependencies[depCellKey].push(cellKey);
            }
        });
    },
    clearOldDependencies: function(oldFormula, row, col, tableType) {
        const cellKey = `${tableType}_${row}_${col}`;
        const oldDependencies = oldFormula.match(/\[([^\]]+)\]/g) || [];
        
        oldDependencies.forEach(ref => {
            const columnName = ref.slice(1, -1);
            const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
            const headerRow = document.getElementById(headerRowId);
            
            if (headerRow) {
                const columnIndex = Array.from(headerRow.querySelectorAll('th span'))
                    .findIndex(span => span.textContent === columnName);
                
                if (columnIndex !== -1) {
                    const dependentCellKey = `${tableType}_${row}_${columnIndex}`;
                    if (this.formulaDependencies[dependentCellKey]) {
                        this.formulaDependencies[dependentCellKey] = 
                            this.formulaDependencies[dependentCellKey].filter(key => key !== cellKey);
                    }
                }
            }
        });
    },

    updateDependentCells: function(cellKey) {
        const dependents = this.formulaDependencies[cellKey] || [];
        
        dependents.forEach(depCellKey => {
            const [tableType, row, col] = depCellKey.split('_');
            const formulaInput = document.querySelector(
                `input[name="${tableType}_formula_${row}_col_${col}"]`
            );
            
            if (formulaInput?.value) {
                this.applyFormula(row, col, formulaInput.value, tableType);
            }
        });
    },

    checkCircularDependency: function(formula, currentCellKey, visited = new Set()) {
        if (visited.has(currentCellKey)) {
            return true;
        }

        visited.add(currentCellKey);
        const columnRefs = formula.match(/\[([^\]]+)\]/g) || [];
        const tableType = currentCellKey.split('_')[0];

        for (const ref of columnRefs) {
            const columnName = ref.slice(1, -1);
            const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
            const headerRow = document.getElementById(headerRowId);
            
            if (headerRow) {
                const columnIndex = Array.from(headerRow.querySelectorAll('th span'))
                    .findIndex(span => span.textContent === columnName);
                
                if (columnIndex !== -1) {
                    const [_, row, __] = currentCellKey.split('_');
                    const refCellKey = `${tableType}_${row}_${columnIndex}`;
                    const formulaInput = document.querySelector(
                        `input[name="${tableType}_formula_${row}_col_${columnIndex}"]`
                    );
                    
                    if (formulaInput && formulaInput.value) {
                        if (this.checkCircularDependency(formulaInput.value, refCellKey, new Set(visited))) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    },

    applyFormula: function(row, col, formula, tableType) {
        const cellKey = `${tableType}_${row}_${col}`;
        const cellInput = document.querySelector(`textarea[name="${tableType}_cell_${row}_col_${col}"]`);
        if (!cellInput) return;
    
        // Очищаем предыдущие состояния
        cellInput.parentElement.classList.remove('formula-cell', 'formula-error');
    
        if (!formula.trim()) {
            cellInput.value = '';
            return;
        }
    
        // Проверка на циклические зависимости
        if (this.checkCircularDependency(formula, cellKey)) {
            cellInput.parentElement.classList.add('formula-error');
            cellInput.value = 'Error: Circular reference';
            return;
        }
    
        try {
            const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
            const headerRow = table.querySelector('thead tr');
            if (!headerRow) throw new Error('Header row not found');
            
            const columnNames = Array.from(headerRow.querySelectorAll('th span'))
                .map(span => span.textContent.trim());
            
            // Собираем данные всех строк
            const allRows = Array.from(table.querySelectorAll('tbody tr'));
            const allRowsData = allRows.map((rowEl, rowIdx) => {
                const rowData = {};
                Array.from(rowEl.querySelectorAll('.kpi-input')).forEach((input, colIdx) => {
                    if (colIdx < columnNames.length) {
                        rowData[columnNames[colIdx]] = input.value;
                    }
                });
                return rowData;
            });
    
            // Получаем данные текущей строки
            const currentRowData = allRowsData[row] || {};
            
            // Вычисляем формулу
            const result = this.evaluateFormula(
                formula, 
                currentRowData, 
                columnNames, 
                allRowsData
            );
            
            if (result === 'Error') {
                throw new Error('Formula evaluation error');
            }
            
            cellInput.value = result;
            cellInput.parentElement.classList.add('formula-cell');
            
            // Обновляем зависимости
            this.parseFormulaDependencies(formula, row, col, tableType);
            
        } catch (e) {
            cellInput.parentElement.classList.add('formula-error');
            cellInput.value = 'Error: ' + (e.message || 'Invalid formula');
        }
    },
    checkCircularDependency: function(formula, currentCellKey, visited = new Set()) {
        if (visited.has(currentCellKey)) {
            return true;
        }
    
        visited.add(currentCellKey);
        
        const refPattern = /\[([^\]#]+)(?:#(\d+))?\]/g;
        let match;
        
        while ((match = refPattern.exec(formula)) !== null) {
            const columnName = match[1];
            const rowRef = match[2];
            const tableType = currentCellKey.split('_')[0];
            
            const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
            const headerRow = document.getElementById(headerRowId);
            
            if (headerRow) {
                const columnIndex = Array.from(headerRow.querySelectorAll('th span'))
                    .findIndex(span => span.textContent === columnName);
                
                if (columnIndex !== -1) {
                    const targetRow = rowRef ? parseInt(rowRef) : parseInt(currentCellKey.split('_')[1]);
                    const refCellKey = `${tableType}_${targetRow}_${columnIndex}`;
                    
                    // Пропускаем ссылки на саму себя
                    if (refCellKey !== currentCellKey) {
                        const formulaInput = document.querySelector(
                            `input[name="${tableType}_formula_${targetRow}_col_${columnIndex}"]`
                        );
                        
                        if (formulaInput && formulaInput.value) {
                            if (this.checkCircularDependency(formulaInput.value, refCellKey, new Set(visited))) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    
        return false;
    },
    setupAutoSaveHandler: function(input) {
        if (!input.id) {
            input.id = 'kpi-input-' + Math.random().toString(36).substr(2, 9);
        }
    
        if (!this.debounceTimers[input.id]) {
            const handler = (e) => {
                const tableType = this.isAdmin && e.target.name.startsWith('template_') ? 'template' : 'kpi';
                const parts = e.target.name.split('_');
                const rowIndex = parseInt(parts[1]);
                const colIndex = parseInt(parts[3]);
                
                // Немедленное обновление зависимых формул
                this.updateDependentCells(rowIndex, colIndex, tableType);
                
                this.debouncedAutoSave(e);
            };
            
            input.addEventListener('input', handler);
            this.debounceTimers[input.id] = handler;
        }
    },
    evaluateFormula: function(formula, rowData, columnNames, allRowsData = []) {
        if (!formula || !formula.trim()) {
            console.log('Empty or invalid formula');
            return '';
        }
    
        // Исправленная строка - используем Object.values() для объекта
        const cacheKey = `${formula}_${Object.values(rowData).join('_')}`;
        
        if (this.formulaCache[cacheKey]) {
            console.log(`Returning cached result for ${cacheKey}: ${this.formulaCache[cacheKey]}`);
            return this.formulaCache[cacheKey];
        }
    
        try {
            formula = formula.trim();
            console.log(`Evaluating formula: ${formula}`);
            console.log(`Row data:`, rowData);
            console.log(`Column names:`, columnNames);
            console.log(`All rows data:`, allRowsData);
    
            // Обработка простых ссылок на столбцы в текущей строке
            if (/^\[[^\]#]+\]$/.test(formula)) {
                const columnName = formula.slice(1, -1);
                const value = rowData[columnName] || '';
                console.log(`Simple reference [${columnName}] resolved to: ${value}`);
                return value;
            }
    
            // Обработка ссылок на другие строки [Column#Row]
            const evaluatedFormula = formula.replace(/\[([^\]#]+)(?:#(\d+))?\]/g, (match, columnName, rowIndexStr) => {
                const rowIndex = rowIndexStr ? parseInt(rowIndexStr) : null;
                let value;
    
                if (rowIndex !== null) {
                    if (rowIndex >= allRowsData.length || !allRowsData[rowIndex]) {
                        console.warn(`Row ${rowIndex} does not exist in allRowsData (length: ${allRowsData.length})`);
                        return '0';
                    }
                    value = allRowsData[rowIndex][columnName];
                    console.log(`Reference [${columnName}#${rowIndex}] resolved to: ${value}`);
                } else {
                    value = rowData[columnName];
                    console.log(`Reference [${columnName}] resolved to: ${value}`);
                }
    
                if (value === '' || value === undefined || value === null) {
                    console.log(`Value for [${columnName}${rowIndex !== null ? '#' + rowIndex : ''}] is empty`);
                    return '0';
                }
    
                const numValue = parseFloat(value);
                if (isNaN(numValue)) {
                    console.warn(`Value ${value} in [${columnName}${rowIndex !== null ? '#' + rowIndex : ''}] is not a number`);
                    return '0';
                }
    
                return numValue.toString();
            });
    
            console.log(`Evaluated formula: ${evaluatedFormula}`);
            if (!evaluatedFormula.trim()) {
                console.warn('Evaluated formula is empty');
                return '';
            }
    
            // Безопасное вычисление
            const result = new Function('return ' + evaluatedFormula)();
            console.log(`Formula result: ${result}`);
    
            if (typeof result === 'number' && !isNaN(result)) {
                const roundedResult = Math.round(result * 100) / 100;
                this.formulaCache[cacheKey] = roundedResult.toString();
                console.log(`Cached result for ${cacheKey}: ${roundedResult}`);
                return roundedResult.toString();
            }
    
            throw new Error('Formula result is not a valid number');
        } catch (error) {
            console.error('Formula evaluation error:', error.message, 'Formula:', formula);
            return 'Error: Invalid formula';
        }
    },

    clearFormulaCache: function() {
        this.formulaCache = {};
    },

    updateDependenciesOnStructureChange: function() {
        this.buildDependencyGraph();
        this.clearFormulaCache();
        
        const tables = [
            { table: this.elements.kpiTable, type: 'kpi' },
            { table: this.elements.templateTable, type: 'template' }
        ];
        
        tables.forEach(({ table, type }) => {
            if (!table) return;
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, rowIndex) => {
                const formulaInputs = row.querySelectorAll('.cell-formula');
                formulaInputs.forEach((input, colIndex) => {
                    if (input.value) {
                        this.applyFormula(rowIndex, colIndex, input.value, type);
                    }
                });
            });
        });
    },
    
    // ====================== Core Functions ======================
    cacheElements: function() {
        this.elements = {
            exportAllKpiBtn: document.getElementById('export-all-kpi'),
            exportUserKpiBtn: document.getElementById('export-user-kpi'),
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

        // Добавляем поддержку событий изменения размера текстовых полей
        this.setupTextareaAutosize();
    },

    setupEventListeners: function() {
        // Удаляем старые обработчики перед добавлением новых
        this.removeEventListeners();
    
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
                this.loadKpiData();
            });
        }
        if (this.elements.exportAllKpiBtn) {
            this.elements.exportAllKpiBtn.addEventListener('click', () => this.exportKpi(true));
        }
        if (this.elements.exportUserKpiBtn) {
            this.elements.exportUserKpiBtn.addEventListener('click', () => this.exportKpi(false));
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
    
        // Centralized dynamic elements handler
        document.addEventListener('click', this.handleDynamicElements.bind(this));
    },

    setupTextareaAutosize: function() {
    console.log('Setting up textarea autosize...');
    
    // Настраиваем все существующие textarea
    document.querySelectorAll('.kpi-input').forEach(input => {
        if (input.tagName !== 'TEXTAREA') {
            this.convertInputToTextarea(input);
        } else {
            // Если это уже textarea, просто подстроим его высоту
            this.adjustTextareaHeight(input);
        }
    });
    
    // Настраиваем для новых элементов
    const observer = new MutationObserver((mutations) => {
        let needsAdjustment = false;
        
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // только для элементов DOM
                    if (node.classList?.contains('kpi-input')) {
                        needsAdjustment = true;
                        if (node.tagName !== 'TEXTAREA') {
                            this.convertInputToTextarea(node);
                        } else {
                            // Если это уже textarea, просто подстроим его высоту
                            this.adjustTextareaHeight(node);
                        }
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('.kpi-input').forEach(input => {
                            needsAdjustment = true;
                            if (input.tagName !== 'TEXTAREA') {
                                this.convertInputToTextarea(input);
                            } else {
                                // Если это уже textarea, просто подстроим его высоту
                                this.adjustTextareaHeight(input);
                            }
                        });
                    }
                }
            });
        });
        
        // Если были добавлены новые элементы, нужно обновить все высоты
        if (needsAdjustment) {
            setTimeout(() => {
                document.querySelectorAll('textarea.kpi-input').forEach(textarea => {
                    this.adjustTextareaHeight(textarea);
                });
            }, 50);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Также обрабатываем изменение размера окна
    window.addEventListener('resize', () => {
        document.querySelectorAll('textarea.kpi-input').forEach(textarea => {
            this.adjustTextareaHeight(textarea);
        });
    });
    
    console.log('Textarea autosize setup complete');
},

convertInputToTextarea: function(input) {
    if (input.tagName === 'TEXTAREA') return input;
    
    const value = input.value;
    const name = input.name;
    const id = input.id || 'kpi-input-' + Math.random().toString(36).substr(2, 9);
    const className = input.className;
    
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.name = name;
    textarea.id = id;
    textarea.className = className;
    textarea.style.minHeight = '32px';
    textarea.style.width = '100%';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    
    // Добавляем обработчик для авторасширения при вводе
    textarea.addEventListener('input', () => {
        this.adjustTextareaHeight(textarea);
    });
    
    // Замена элемента
    if (input.parentNode) {
        input.parentNode.replaceChild(textarea, input);
        
        // Перенос обработчиков событий, если они были
        if (this.debounceTimers[input.id]) {
            textarea.addEventListener('input', this.debounceTimers[input.id]);
            this.debounceTimers[textarea.id] = this.debounceTimers[input.id];
            delete this.debounceTimers[input.id];
        }
        
        // Настраиваем начальную высоту
        setTimeout(() => this.adjustTextareaHeight(textarea), 0);
    }
    
    return textarea;
},

    adjustTextareaHeight: function(textarea) {
        if (!textarea || textarea.tagName !== 'TEXTAREA') return;
        
        // Сохраняем текущую позицию скролла
        const scrollPos = textarea.scrollTop;
        
        // Сбрасываем высоту для правильного расчета
        textarea.style.height = 'auto';
        
        // Вычисляем новую высоту
        const newHeight = Math.max(36, textarea.scrollHeight);
        textarea.style.height = newHeight + 'px';
        
        // Восстанавливаем позицию скролла
        textarea.scrollTop = scrollPos;
    },

    setupTextareaAutosize: function() {
        console.log('Setting up textarea autosize...');
        
        // Настраиваем все существующие textarea
        document.querySelectorAll('.kpi-input').forEach(input => {
            if (input.tagName === 'TEXTAREA') {
                // Настраиваем начальную высоту
                this.adjustTextareaHeight(input);
                
                // Добавляем обработчик ввода
                input.addEventListener('input', () => {
                    this.adjustTextareaHeight(input);
                });
            }
        });
        
        // Настраиваем для новых элементов
        const observer = new MutationObserver((mutations) => {
            let needsAdjustment = false;
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // только для элементов DOM
                        if (node.classList?.contains('kpi-input') && node.tagName === 'TEXTAREA') {
                            needsAdjustment = true;
                            // Настраиваем высоту
                            this.adjustTextareaHeight(node);
                            
                            // Добавляем обработчик ввода
                            node.addEventListener('input', () => {
                                this.adjustTextareaHeight(node);
                            });
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('textarea.kpi-input').forEach(textarea => {
                                needsAdjustment = true;
                                // Настраиваем высоту
                                this.adjustTextareaHeight(textarea);
                                
                                // Добавляем обработчик ввода
                                textarea.addEventListener('input', () => {
                                    this.adjustTextareaHeight(textarea);
                                });
                            });
                        }
                    }
                });
            });
            
            // Если были добавлены новые элементы, перенастроим все высоты
            if (needsAdjustment) {
                setTimeout(() => {
                    document.querySelectorAll('textarea.kpi-input').forEach(textarea => {
                        this.adjustTextareaHeight(textarea);
                    });
                }, 50);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Обновляем высоты при изменении размера окна
        window.addEventListener('resize', () => {
            document.querySelectorAll('textarea.kpi-input').forEach(textarea => {
                this.adjustTextareaHeight(textarea);
            });
        });
        
        console.log('Textarea autosize setup complete');
    },

    exportKpi: async function(exportAll = false) {
        try {
            if (exportAll && !this.isAdmin) {
                this.showNotification('Только администраторы могут экспортировать всех пользователей', 'error');
                return;
            }
    
            if (!exportAll && !this.selectedUserId) {
                this.showNotification('Пользователь не выбран', 'error');
                return;
            }
    
            const confirmation = confirm(exportAll 
                ? 'Экспортировать KPI всех пользователей?' 
                : `Экспортировать KPI пользователя ${this.selectedUserId}?`);
            
            if (!confirmation) return;
    
            this.showSavingIndicator(true);
            const notification = this.showNotification('Подготовка экспорта...', 'info', 0);
    
            const response = await fetch('/kpi/export_kpi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    export_all: exportAll,
                    user_id: this.selectedUserId
                })
            });
    
            const data = await response.json();
            if (data.status === 'success') {
                notification.update('Экспорт завершен. Начато скачивание...', 'success');
                window.open(data.download_url, '_blank');
            } else {
                throw new Error(data.message || 'Ошибка экспорта');
            }
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification(`Ошибка экспорта: ${error.message}`, 'error');
        } finally {
            this.showSavingIndicator(false);
        }
    },
    setupInstantFormulaUpdates: function() {
        console.log('Setting up instant formula updates...');
        
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('kpi-input')) {
                console.log('Input detected:', e.target.name);
                
                const input = e.target;
                const nameParts = input.name.split('_');
                
                // Determine table type (template or kpi)
                const tableType = nameParts[0] === 'template' ? 'template' : 'kpi';
                const rowIndex = parseInt(nameParts[1]);
                const colIndex = parseInt(nameParts[3]);
                
                console.log(`Cell changed: ${tableType}_${rowIndex}_${colIndex}`);
                
                // Find all formulas that depend on this cell
                const cellKey = `${tableType}_${rowIndex}_${colIndex}`;
                console.log('Dependencies:', this.formulaDependencies[cellKey]);
                
                if (this.formulaDependencies[cellKey]) {
                    this.formulaDependencies[cellKey].forEach(depCellKey => {
                        console.log('Updating dependent cell:', depCellKey);
                        const [depTableType, depRow, depCol] = depCellKey.split('_');
                        const formulaInput = document.querySelector(
                            `input[name="${depTableType}_formula_${depRow}_col_${depCol}"]`
                        );
                        
                        if (formulaInput && formulaInput.value) {
                            console.log(`Recalculating formula: ${formulaInput.value}`);
                            this.applyFormula(depRow, depCol, formulaInput.value, depTableType);
                        }
                    });
                }
            }
        });
    },
    // ====================== Table Operations ======================
    addColumn: async function(tableType) {
        const columnName = prompt('Введите название столбца:');
        if (!columnName) return;

        // Проверка на существование колонки
        if (this.checkColumnExists(columnName, tableType)) {
            this.showNotification('Колонка с таким именем уже существует', 'error');
            return;
        }

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
                newTh.dataset.columnId = columnName.toLowerCase().replace(/\s+/g, '-');
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
                    
                    // Используем textarea вместо input
                    newCell.innerHTML = `
                        <textarea class="kpi-input" id="${inputId}" 
                            name="${tableType}_cell_${rowIdx}_col_${columnCount}" rows="1"></textarea>
                        <button class="formula-btn" data-row="${rowIdx}" data-col="${columnCount}" data-table="${tableType}">
                            <i class="fas fa-calculator"></i> fx
                        </button>
                        <input type="hidden" name="${tableType}_formula_${rowIdx}_col_${columnCount}" 
                            class="cell-formula" value="">
                    `;
                    
                    row.appendChild(newCell);
                    
                    // Настраиваем textarea
                    const textarea = newCell.querySelector('.kpi-input');
                    this.adjustTextareaHeight(textarea);
                    this.addAutoSaveHandler(textarea);
                });

                if (tableType !== 'template') {
                    // Проверяем, есть ли уже такая опция в выпадающем списке
                    const existingOptions = Array.from(this.elements.chartColumnSelect.options)
                        .map(opt => opt.value);
                    
                    if (!existingOptions.includes(columnName)) {
                        const option = document.createElement('option');
                        option.value = columnName;
                        option.textContent = columnName;
                        this.elements.chartColumnSelect.appendChild(option);
                    }
                }

                // Проверяем, есть ли уже такой тег колонки
                const existingTags = Array.from(this.elements.availableColumns.querySelectorAll('.column-tag'))
                    .map(tag => tag.textContent);
                
                if (!existingTags.includes(`[${columnName}]`)) {
                    const span = document.createElement('span');
                    span.className = 'column-tag';
                    span.textContent = `[${columnName}]`;
                    this.elements.availableColumns.appendChild(span);
                }

                this.updateDependenciesOnStructureChange();
                this.performAutoSave(tableType);
                this.showNotification('Столбец успешно добавлен');
            } else {
                this.showNotification(data.message || 'Ошибка при добавлении столбца', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при добавлении столбца', 'error');
        } finally {
            this.showSavingIndicator(false);
        }
    },

    addRow: function(tableType) {
        console.log(`Adding row to ${tableType} table`);
        
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        if (!table) {
            console.error('Table not found');
            return;
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.error('Table body not found');
            return;
        }

        // 1. Определяем количество колонок правильно
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) {
            console.error('Header row not found');
            return;
        }

        // Получаем только колонки данных (исключая первую колонку с кнопками)
        const dataColumns = Array.from(headerRow.querySelectorAll('th')).slice(1);
        const columnCount = dataColumns.length;
        
        // Определяем индекс новой строки
        const rowCount = tbody.querySelectorAll('tr').length;

        // 2. Создаем новую строку
        const newRow = document.createElement('tr');
        newRow.dataset.rowIndex = rowCount;

        // 3. Добавляем ячейку с кнопкой удаления
        const actionCell = document.createElement('td');
        actionCell.className = 'text-center';
        actionCell.innerHTML = `
            <button class="delete-btn delete-${tableType}-row">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        newRow.appendChild(actionCell);

        // 4. Добавляем ячейки данных
        for (let i = 0; i < columnCount; i++) {
            const columnName = dataColumns[i]?.querySelector('span')?.textContent || `Column ${i}`;
            
            const newCell = document.createElement('td');
            newCell.className = 'kpi-cell';
            
            const inputId = `kpi-input-${tableType}-${rowCount}-${i}`;
            
            // Используем textarea вместо input
            newCell.innerHTML = `
                <textarea class="kpi-input" id="${inputId}" 
                    name="${tableType}_cell_${rowCount}_col_${i}" rows="1"></textarea>
                <button class="formula-btn" data-row="${rowCount}" data-col="${i}" data-table="${tableType}">
                    <i class="fas fa-calculator"></i> fx
                </button>
                <input type="hidden" name="${tableType}_formula_${rowCount}_col_${i}" 
                    class="cell-formula" value="">
            `;
            
            newRow.appendChild(newCell);
        }

        // 5. Добавляем строку в таблицу
        tbody.appendChild(newRow);

        // 6. Настраиваем textarea и добавляем обработчики событий
        newRow.querySelectorAll('.kpi-input').forEach(input => {
            this.adjustTextareaHeight(input);
            this.addAutoSaveHandler(input);
        });

        console.log(`Added row ${rowCount} with ${columnCount} columns`);
        this.updateDependenciesOnStructureChange();
        this.showNotification('Строка успешно добавлена');
        this.performAutoSave(tableType);
    },

    deleteRow: async function(button, tableType) {
        const row = button.closest('tr');
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);

        if (!confirm('Вы уверены, что хотите удалить эту строку?')) return;

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

                this.updateDependenciesOnStructureChange();
                this.performAutoSave(tableType);
                this.showNotification('Строка успешно удалена');
            } else {
                this.showNotification(data.message || 'Ошибка при удалении строки', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при удалении строки', 'error');
        } finally {
            this.showSavingIndicator(false);
        }
    },

    deleteColumn: async function(button, tableType) {
        const column = button.getAttribute('data-column');
        if (!confirm(`Вы уверены, что хотите удалить столбец "${column}"? Все данные в этом столбце будут потеряны.`)) return;

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

                if (colIndex === -1) throw new Error('Столбец не найден');

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

                this.updateDependenciesOnStructureChange();
                this.performAutoSave(tableType);
                this.showNotification(`Столбец "${column}" успешно удален`);

                if (tableType !== 'template' && this.elements.chartColumnSelect.value === column) {
                    this.elements.chartColumnSelect.value = '';
                }
            } else {
                this.showNotification(data.message || 'Ошибка при удалении столбца', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification(`Ошибка при удалении столбца: ${error.message}`, 'error');
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

    // ====================== Data Saving ======================
    saveTemplate: async function() {
        this.userTriggeredSave = true;
        const savingNotification = this.showNotification('Сохранение шаблона...', 'info', 0);
        this.elements.saveTemplateBtn.disabled = true;
        this.elements.saveTemplateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';

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
                savingNotification.update('Шаблон успешно сохранен', 'success');
            } else {
                throw new Error(data.message || 'Ошибка сервера');
            }
        } catch (error) {
            console.error('Ошибка сохранения шаблона:', error);
            savingNotification.update(`Ошибка сохранения шаблона: ${error.message}`, 'error');
        } finally {
            setTimeout(() => {
                this.elements.saveTemplateBtn.disabled = false;
                this.elements.saveTemplateBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить шаблон';
                savingNotification.hide();
            }, 1000);
        }
    },

    applyTemplateToAll: async function() {
        if (!confirm('Вы уверены, что хотите применить этот шаблон ко ВСЕМ пользователям? Существующие данные будут перезаписаны.')) return;

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
                this.showNotification('Шаблон успешно применен ко всем пользователям');
            } else {
                this.showNotification(data.message || 'Ошибка применения шаблона', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка применения шаблона', 'error');
        } finally {
            this.showSavingIndicator(false);
            this.elements.applyToAllBtn.disabled = false;
        }
    },

    saveKpiData: async function() {
        this.userTriggeredSave = true;
        
        if (!this.selectedUserId && !this.currentUserId) {
            this.showNotification('Пользователь не выбран', 'error');
            return;
        }
        
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
            if (input.value !== '') {
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
    
        return formData;
    },

    // ====================== Formula Modal ======================
    openFormulaModal: function(row, col, tableType) {
        this.elements.currentRowInput.value = row;
        this.elements.currentColInput.value = col;
        this.elements.currentTableInput.value = tableType;
    
        const formulaInput = document.querySelector(`input[name="${tableType}_formula_${row}_col_${col}"]`);
        this.elements.formulaInput.value = formulaInput ? formulaInput.value : '';
    
        this.elements.formulaModal.classList.remove('hidden');
        
        // Добавляем обработчики для кнопок в модальном окне
        this.setupFormulaModalButtons();
    },
    closeFormulaModal: function() {
        this.elements.formulaModal.classList.add('hidden');
    },

    saveFormula: function(isForColumn = false) {
        const row = this.elements.currentRowInput.value;
        const col = this.elements.currentColInput.value;
        const tableType = this.elements.currentTableInput.value;
        const formula = this.elements.formulaInput.value.trim();
    
        // Проверка на циклические зависимости
        const cellKey = `${tableType}_${row}_${col}`;
        if (formula && this.checkCircularDependency(formula, cellKey)) {
            this.showNotification('Обнаружена циклическая зависимость в формуле!', 'error');
            return;
        }
    
        const table = tableType === 'template' ? this.elements.templateTable : this.elements.kpiTable;
        const rows = table.querySelectorAll('tbody tr');
    
        if (isForColumn) {
            // Применяем формулу ко всей колонке
            rows.forEach((rowElement, rowIndex) => {
                const formulaField = rowElement.querySelector(`input[name="${tableType}_formula_${rowIndex}_col_${col}"]`);
                if (formulaField) {
                    const oldFormula = formulaField.value;
                    if (oldFormula) {
                        this.clearOldDependencies(oldFormula, rowIndex, col, tableType);
                    }
                    
                    formulaField.value = formula;
                    this.parseFormulaDependencies(formula, rowIndex, col, tableType);
                    this.applyFormula(rowIndex, col, formula, tableType);
                }
            });
        } else {
            // Применяем формулу только к текущей ячейке
            const formulaField = document.querySelector(`input[name="${tableType}_formula_${row}_col_${col}"]`);
            if (formulaField) {
                const oldFormula = formulaField.value;
                if (oldFormula) {
                    this.clearOldDependencies(oldFormula, row, col, tableType);
                }
                
                formulaField.value = formula;
                this.parseFormulaDependencies(formula, row, col, tableType);
                this.applyFormula(row, col, formula, tableType);
            }
        }
    
        this.closeFormulaModal();
        this.performAutoSave(tableType);
    },

    insertColumnIntoFormula: function(columnText) {
    const input = this.elements.formulaInput;
    const selStart = input.selectionStart;
    const selEnd = input.selectionEnd;
    const currentValue = input.value;

    // Проверяем, не вставляем ли мы дубликат столбца
    const beforeText = currentValue.substring(0, selStart);
    const afterText = currentValue.substring(selEnd);
    
    // Если столбец уже присутствует в формуле - не вставляем
    if (beforeText.includes(columnText)) {
        return;
    }

    input.value = beforeText + columnText + afterText;
    input.focus();
    input.selectionStart = selStart + columnText.length;
    input.selectionEnd = selStart + columnText.length;
    
    // Триггерим событие input для валидации
    input.dispatchEvent(new Event('input'));
},

    // ====================== Charts ======================
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

                this.showNotification('Графики успешно обновлены');
            } else {
                this.showNotification(data.message || 'Ошибка при создании графиков', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при создании графиков', 'error');
        }
    },

    // ====================== UI Helpers ======================
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

    setUiEnabled: function(enabled) {
        const elements = [
            this.elements.addColumnBtn,
            this.elements.addRowBtn,
            this.elements.saveKpiBtn,
            this.elements.addColumnTemplateBtn,
            this.elements.addRowTemplateBtn,
            this.elements.saveTemplateBtn,
            this.elements.applyToAllBtn,
            this.elements.exportAllKpiBtn,
            this.elements.exportUserKpiBtn,
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

    // ====================== Auto-Save System ======================
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
                const tableType = e.target.name.split('_')[0] === 'template' ? 'template' : 'kpi';                const parts = e.target.name.split('_');
                const rowIndex = parseInt(parts[1]);
                const colIndex = parseInt(parts[3]);
                
                // Немедленное обновление всех зависимых формул
                this.updateDependentCells(rowIndex, colIndex, tableType);
                
                // Отложенное автосохранение
                this.debouncedAutoSave(e);
            };
            
            input.addEventListener('input', handler);
            this.debounceTimers[input.id] = handler;
        }
    },

    debouncedAutoSave: function(e) {
        this.showSavingIndicator(true);
        clearTimeout(this.autoSaveTimeout);
        
        const tableType = this.isAdmin && e.target.name.startsWith('template_') ? 'template' : 'kpi';
        
        this.autoSaveTimeout = setTimeout(() => {
            this.performAutoSave(tableType);
        }, 1500);
    },

    performAutoSave: async function(tableType) {
        if (this.isSaving) {
            console.warn('Auto-save already in progress');
            return;
        }
    
        if (!this.isAdmin && tableType === 'template') {
            console.log('Regular users cannot save templates');
            return;
        }
    
        this.isSaving = true;
        const formData = this.collectFormData(tableType);
    
        const hasData = Object.keys(formData).length > 1;
        
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
                    this.showNotification('Изменения сохранены автоматически', 'success', 1000);
                }
            } else {
                throw new Error(data.message || 'Server error');
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.showNotification('Ошибка автосохранения: ' + error.message, 'error');
        } finally {
            this.isSaving = false;
            this.userTriggeredSave = false;
            this.showSavingIndicator(false);
        }
    },

    // ====================== Utility Functions ======================
    getCsrfToken: function() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    },

    setupTableSearch: function() {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск в таблице...';
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
                        this.applyFormula(rowIndex, colIndex, input.value, type);
                    }
                });
            });
        });
    },

    loadKpiData: async function() {
        try {
            const response = await fetch(`/kpi?user_id=${this.selectedUserId}`);
            const html = await response.text();
            
            // Вместо полной замены HTML парсим данные
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Обновляем только таблицу
            const newTable = doc.getElementById('kpi-table');
            if (newTable) {
                this.elements.kpiTable.innerHTML = newTable.innerHTML;
            }
            
            // Переинициализируем
            this.cacheElements();
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Error loading KPI:', error);
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    },
    removeEventListeners: function() {
        // Удаляем все обработчики событий перед повторной инициализацией
        if (this.elements.addColumnBtn) {
            this.elements.addColumnBtn.removeEventListener('click', this.addColumn.bind(this, 'kpi'));
        }
        if (this.elements.addRowBtn) {
            this.elements.addRowBtn.removeEventListener('click', this.addRow.bind(this, 'kpi'));
        }
        if (this.elements.saveKpiBtn) {
            this.elements.saveKpiBtn.removeEventListener('click', this.saveKpiData.bind(this));
        }
        if (this.elements.addColumnTemplateBtn) {
            this.elements.addColumnTemplateBtn.removeEventListener('click', this.addColumn.bind(this, 'template'));
        }
        if (this.elements.addRowTemplateBtn) {
            this.elements.addRowTemplateBtn.removeEventListener('click', this.addRow.bind(this, 'template'));
        }
        if (this.elements.saveTemplateBtn) {
            this.elements.saveTemplateBtn.removeEventListener('click', this.saveTemplate.bind(this));
        }
        if (this.elements.applyToAllBtn) {
            this.elements.applyToAllBtn.removeEventListener('click', this.applyTemplateToAll.bind(this));
        }
    
        // Удаляем обработчики динамических элементов
        document.removeEventListener('click', this.handleDynamicElements);
    },
    handleDynamicElements: function(e) {
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
    },
    checkColumnExists: function(columnName, tableType) {
        const headerRowId = tableType === 'template' ? 'template-column-names-row' : 'column-names-row';
        const headerRow = document.getElementById(headerRowId);
        if (!headerRow) return false;
        
        const existingColumns = Array.from(headerRow.querySelectorAll('th span'))
            .map(span => span.textContent.trim());
        
        return existingColumns.includes(columnName);
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
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    KPIApp.init();
});