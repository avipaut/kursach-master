document.addEventListener('DOMContentLoaded', function() {
    // Set up flash message auto-dismiss
    setTimeout(function() {
      const flashMessages = document.querySelectorAll('.flash-message');
      flashMessages.forEach(message => {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 500);
      });
    }, 5000);
    
    // Document search functionality
    const searchInput = document.getElementById('searchInput');
    const documentCards = document.querySelectorAll('.document-card');
    const noResults = document.querySelector('.no-results');
    
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      let hasResults = false;
      
      documentCards.forEach(card => {
        const name = card.getAttribute('data-name').toLowerCase();
        if (name.includes(searchTerm)) {
          card.style.display = 'flex';
          hasResults = true;
        } else {
          card.style.display = 'none';
        }
      });
      
      noResults.style.display = hasResults ? 'none' : 'block';
    });
    
    // Sorting functionality
    const sortButtons = document.querySelectorAll('.sort-btn');
    
    sortButtons.forEach(button => {
      button.addEventListener('click', function() {
        const sortType = this.getAttribute('data-sort');
        
        // Update active button state
        sortButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Update sort icon
        const sortIcons = document.querySelectorAll('.sort-icon');
        sortIcons.forEach(icon => {
          icon.classList.remove('bi-sort-down', 'bi-sort-up');
        });
        
        // Get current direction from the icon
        const sortIcon = this.querySelector('.sort-icon');
        const isAscending = sortIcon ? sortIcon.classList.contains('bi-sort-up') : false;
        
        if (sortIcon) {
          sortIcon.classList.add(isAscending ? 'bi-sort-down' : 'bi-sort-up');
        } else {
          this.innerHTML += ' <i class="bi bi-sort-down sort-icon"></i>';
        }
        
        // Sort the document cards
        const documentRow = document.querySelector('.document-row');
        const cards = Array.from(documentCards);
        
        cards.sort((a, b) => {
          let valueA, valueB;
          
          if (sortType === 'name') {
            valueA = a.getAttribute('data-name');
            valueB = b.getAttribute('data-name');
          } else if (sortType === 'date') {
            valueA = new Date(a.getAttribute('data-date'));
            valueB = new Date(b.getAttribute('data-date'));
          } else if (sortType === 'size') {
            valueA = a.getAttribute('data-size');
            valueB = b.getAttribute('data-size');
            
            // Convert size strings to numbers
            const sizeRegex = /(\d+(?:\.\d+)?)\s*(KB|MB|GB)/;
            const matchA = valueA.match(sizeRegex);
            const matchB = valueB.match(sizeRegex);
            
            if (matchA && matchB) {
              const [, numA, unitA] = matchA;
              const [, numB, unitB] = matchB;
              
              const unitMultiplier = {
                'KB': 1,
                'MB': 1024,
                'GB': 1024 * 1024
              };
              
              valueA = parseFloat(numA) * unitMultiplier[unitA];
              valueB = parseFloat(numB) * unitMultiplier[unitB];
            }
          }
          
          if (valueA < valueB) return isAscending ? 1 : -1;
          if (valueA > valueB) return isAscending ? -1 : 1;
          return 0;
        });
        
        // Reappend sorted cards
        cards.forEach(card => {
          documentRow.appendChild(card);
        });
      });
    });
    
    // File upload handling
    const uploadArea = document.querySelector('.upload-area');
    const translationFileInput = document.getElementById('translationFile');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    
    browseFilesBtn.addEventListener('click', function() {
      translationFileInput.click();
    });
    
    translationFileInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        uploadArea.classList.add('border-success');
        uploadArea.querySelector('h5').textContent = this.files[0].name;
      }
    });
    
    // Handle drag and drop
    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      uploadArea.classList.add('border-primary');
    });
    
    uploadArea.addEventListener('dragleave', function() {
      uploadArea.classList.remove('border-primary');
    });
    
    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.classList.remove('border-primary');
      
      if (e.dataTransfer.files.length > 0) {
        translationFileInput.files = e.dataTransfer.files;
        uploadArea.classList.add('border-success');
        uploadArea.querySelector('h5').textContent = e.dataTransfer.files[0].name;
      }
    });
    
    // Translation direction selection
    const directionOptions = document.querySelectorAll('.direction-option');
    
    directionOptions.forEach(option => {
      option.addEventListener('click', function() {
        directionOptions.forEach(opt => opt.classList.remove('active'));
        this.classList.add('active');
        this.querySelector('input').checked = true;
      });
    });
  });