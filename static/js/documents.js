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
  if (searchInput) {
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
      
      if (noResults) {
        noResults.style.display = hasResults ? 'none' : 'block';
      }
    });
  }
  
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
      const documentCards = document.querySelectorAll('.document-card');
      const cards = Array.from(documentCards);
      
      if (documentRow) {
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
      }
    });
  });
  
  // File upload handling
  const uploadArea = document.querySelector('.upload-area');
  const translationFileInput = document.getElementById('translationFile');
  const browseFilesBtn = document.getElementById('browseFilesBtn');
  
  if (uploadArea && translationFileInput && browseFilesBtn) {
    browseFilesBtn.addEventListener('click', function() {
      translationFileInput.click();
    });
    
    translationFileInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        uploadArea.classList.add('border-success');
        const heading = uploadArea.querySelector('h5');
        if (heading) {
          heading.textContent = this.files[0].name;
        }
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
        const heading = uploadArea.querySelector('h5');
        if (heading) {
          heading.textContent = e.dataTransfer.files[0].name;
        }
      }
    });
  }
  
  // Translation direction selection
  const directionOptions = document.querySelectorAll('.direction-option');
  
  directionOptions.forEach(option => {
    option.addEventListener('click', function() {
      directionOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      const input = this.querySelector('input');
      if (input) {
        input.checked = true;
      }
    });
  });
  
  // Set up document preview functionality
  const fileViewerModal = document.getElementById('fileViewerModal');
  const fileViewerFrame = document.getElementById('fileViewerFrame');
  const fileViewerTitle = document.getElementById('fileViewerTitle');
  const downloadFromViewerBtn = document.getElementById('downloadFromViewerBtn');

  if (fileViewerModal && fileViewerFrame && fileViewerTitle && downloadFromViewerBtn) {
    // Document preview functionality
    document.querySelectorAll('.view-file-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const filename = this.getAttribute('data-filename');
        const category = this.getAttribute('data-category');
        
        // Set the modal title
        fileViewerTitle.textContent = `Viewing: ${filename}`;
        
        // Set the download link
        downloadFromViewerBtn.href = `/documents/download/${encodeURIComponent(filename)}?category=${category}`;
        
        // Clear previous content
        fileViewerFrame.src = '';
        
        // Load the preview in the iframe
        fileViewerFrame.src = `/documents/preview/${category}/${encodeURIComponent(filename)}`;
        
        // Show loading indicator
        fileViewerFrame.insertAdjacentHTML('beforebegin', 
          '<div id="previewLoading" class="text-center p-5">' +
          '<div class="spinner-border text-primary" role="status">' +
          '<span class="visually-hidden">Loading...</span></div>' +
          '<p class="mt-2">Loading preview...</p></div>');
        
        // Show the modal
        const modal = new bootstrap.Modal(fileViewerModal);
        modal.show();
      });
    });
  
    // Handle iframe load events
    fileViewerFrame.addEventListener('load', function() {
      // Remove loading indicator
      const loadingElement = document.getElementById('previewLoading');
      if (loadingElement) {
        loadingElement.remove();
      }
      
      try {
        // Check if content loaded successfully
        if (this.contentDocument && 
            this.contentDocument.body && 
            this.contentDocument.body.innerHTML.includes('404 Not Found')) {
          showPreviewError('File not found or access denied');
        }
      } catch (e) {
        // This can happen with PDF files due to cross-origin policy, but they still display
        console.log('Cross-origin frame access - this is normal for some file types');
      }
    });
  
    // Handle iframe load errors
    fileViewerFrame.addEventListener('error', function() {
      showPreviewError('Failed to load file preview');
    });
  
    // Clean up iframe when modal closes
    fileViewerModal.addEventListener('hidden.bs.modal', function() {
      fileViewerFrame.src = '';
      const loadingElement = document.getElementById('previewLoading');
      if (loadingElement) {
        loadingElement.remove();
      }
    });
  
    // Function to show preview errors
    function showPreviewError(message) {
      fileViewerFrame.style.display = 'none';
      const errorElement = document.createElement('div');
      errorElement.className = 'alert alert-danger';
      errorElement.innerHTML = `<strong>Error:</strong> ${message}<br>Please try downloading the file instead.`;
      fileViewerFrame.parentNode.appendChild(errorElement);
    }
  }

  // Set up "Send to Chat" functionality
  document.querySelectorAll('.send-to-chat-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const filename = this.getAttribute('data-filename');
      const category = this.getAttribute('data-category');
      
      // Check if modal elements exist
      const fileToSendEl = document.getElementById('fileToSend');
      const fileCategoryEl = document.getElementById('fileCategory');
      const sendToChatModalEl = document.getElementById('sendToChatModal');
      
      if (!fileToSendEl || !fileCategoryEl || !sendToChatModalEl) {
        console.error('Send to chat modal elements not found');
        return;
      }
      
      // Устанавливаем данные файла в модальном окне
      fileToSendEl.value = filename;
      fileCategoryEl.value = category;
      
      // Показываем модальное окно
      const modal = new bootstrap.Modal(sendToChatModalEl);
      modal.show();
    });
  });
  
  // Обработчик подтверждения отправки с проверками
  const confirmBtn = document.getElementById('confirmSendToChat');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function() {
      // Check if all required elements exist
      const fileToSend = document.getElementById('fileToSend');
      const fileCategory = document.getElementById('fileCategory');
      const recipientsSelect = document.getElementById('recipientsSelect');
      const messageText = document.getElementById('messageText');
      const csrfMeta = document.querySelector('meta[name="csrf-token"]');
      
      // Check for required elements and provide default values if missing
      if (!fileToSend) {
        console.error('Required element not found: fileToSend');
        return;
      }
      if (!fileCategory) {
        console.error('Required element not found: fileCategory');
        return;
      }
      if (!recipientsSelect) {
        console.error('Required element not found: recipientsSelect');
        return;
      }
      if (!messageText) {
        console.error('Required element not found: messageText');
        return;
      }
      
      // Get CSRF token from different possible sources
      let csrfToken = null;
      
      // Try to get CSRF from meta tag
      if (csrfMeta) {
        csrfToken = csrfMeta.content;
      } 
      // Try to get CSRF from a cookie (common alternative method)
      else {
        console.warn('CSRF meta tag not found, trying to get from cookie');
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
          if (cookie.startsWith('csrf_token=')) {
            csrfToken = cookie.substring('csrf_token='.length);
            break;
          } else if (cookie.startsWith('_csrf_token=')) {
            csrfToken = cookie.substring('_csrf_token='.length);
            break;
          }
        }
      }
      
      // If still no CSRF token, try hidden input field (another common method)
      if (!csrfToken) {
        const csrfInput = document.querySelector('input[name="csrf_token"]');
        if (csrfInput) {
          csrfToken = csrfInput.value;
        }
      }
      
      // Log warning if no CSRF token found
      if (!csrfToken) {
        console.warn('No CSRF token found. The request may fail if CSRF protection is enabled.');
      }
      
      const filename = fileToSend.value;
      const category = fileCategory.value;
      const recipients = Array.from(recipientsSelect.selectedOptions)
                         .map(option => option.value);
      const message = messageText.value;
      
      if (recipients.length === 0) {
        alert('Пожалуйста, выберите хотя бы одного получателя');
        return;
      }
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add CSRF token to headers if available
      if (csrfToken) {
        // Try different common CSRF header formats
        headers['X-CSRF-TOKEN'] = csrfToken;
        headers['X-CSRFToken'] = csrfToken;
        headers['CSRF-Token'] = csrfToken;
      }
      
      // Отправляем запрос на сервер
      fetch('/documents/send_to_chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          filename: filename,
          category: category,
          recipients: recipients,
          message: message
        })
      })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          alert('Документ успешно отправлен!');
          const modal = bootstrap.Modal.getInstance(document.getElementById('sendToChatModal'));
          if (modal) modal.hide();
        } else {
          alert('Ошибка: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Произошла ошибка при отправке документа');
      });
    });
  } else {
    console.warn('Send to chat confirmation button not found');
  }
});