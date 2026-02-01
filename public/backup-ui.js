/**
 * Enhanced Backup and Restore UI Module
 * Provides toast notifications, drag-and-drop, preview, and progress tracking
 */

// ========== Toast Notification System ==========
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toastContainer');
    
    if (!toastContainer) {
        // Fallback to alert if toast container doesn't exist
        alert(message);
        return;
    }
    
    const toastId = 'toast-' + Date.now();
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const bgMap = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };
    
    const toastHTML = `
        <div id="${toastId}" class="toast show" role="alert">
            <div class="toast-header ${bgMap[type]} text-white">
                <i class="fas ${iconMap[type]} me-2"></i>
                <strong class="me-auto">${type === 'success' ? 'نجح' : type === 'error' ? 'خطأ' : type === 'warning' ? 'تحذير' : 'معلومات'}</strong>
                <button type="button" class="btn-close btn-close-white" onclick="document.getElementById('${toastId}').remove()"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    if (duration > 0) {
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) toast.remove();
        }, duration);
    }
}

// ========== Drag and Drop Support ==========
function setupDragAndDrop() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('backupFile');
    
    if (!dropArea || !fileInput) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });
    
    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            previewBackup();
        }
    }, false);
}

// ========== Backup Preview ==========
async function previewBackup() {
    const fileInput = document.getElementById('backupFile');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
        showToast('⚠️ يجب أن يكون الملف بصيغة JSON', 'warning');
        fileInput.value = '';
        return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('⚠️ حجم الملف كبير جداً. الحد الأقصى هو 10MB', 'warning');
        fileInput.value = '';
        return;
    }
    
    try {
        showToast('جاري معاينة النسخة الاحتياطية...', 'info', 3000);
        
        const formData = new FormData();
        formData.append('backupFile', file);
        
        // Get token from parent scope (assumed to be available globally)
        const token = window.token || localStorage.getItem('adminToken');
        
        if (!token) {
            showToast('❌ خطأ في المصادقة. يرجى تسجيل الدخول مرة أخرى.', 'error');
            fileInput.value = '';
            return;
        }
        
        const res = await fetch('/api/backup/preview', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            displayBackupPreview(data);
            showToast('✅ تمت معاينة النسخة الاحتياطية', 'success', 3000);
        } else {
            showToast('❌ ' + (data.error || 'فشلت المعاينة'), 'error');
            fileInput.value = '';
        }
    } catch (error) {
        console.error('Error previewing backup:', error);
        showToast('❌ حدث خطأ أثناء معاينة النسخة الاحتياطية', 'error');
        fileInput.value = '';
    }
}

function displayBackupPreview(data) {
    const previewDiv = document.getElementById('backupPreview');
    const previewContent = document.getElementById('previewContent');
    
    if (!previewDiv || !previewContent) return;
    
    const metadata = data.metadata;
    const stats = metadata.statistics;
    
    let previewHTML = `
        <div class="backup-preview-item">
            <span class="backup-preview-label">اسم الملف:</span>
            <span class="backup-preview-value">${data.fileName}</span>
        </div>
        <div class="backup-preview-item">
            <span class="backup-preview-label">الحجم:</span>
            <span class="backup-preview-value">${data.formattedFileSize}</span>
        </div>
        <div class="backup-preview-item">
            <span class="backup-preview-label">الإصدار:</span>
            <span class="backup-preview-value">${data.detectedVersion}</span>
        </div>
    `;
    
    if (metadata.formattedDate) {
        previewHTML += `
            <div class="backup-preview-item">
                <span class="backup-preview-label">تاريخ الإنشاء:</span>
                <span class="backup-preview-value">${metadata.formattedDate}</span>
            </div>
        `;
    }
    
    if (metadata.description) {
        previewHTML += `
            <div class="backup-preview-item">
                <span class="backup-preview-label">الوصف:</span>
                <span class="backup-preview-value">${metadata.description}</span>
            </div>
        `;
    }
    
    if (metadata.appVersion) {
        previewHTML += `
            <div class="backup-preview-item">
                <span class="backup-preview-label">إصدار التطبيق:</span>
                <span class="backup-preview-value">${metadata.appVersion}</span>
            </div>
        `;
    }
    
    previewHTML += `
        <div class="backup-preview-item">
            <span class="backup-preview-label">Checksum:</span>
            <span class="backup-preview-value">${data.checksumStatus}</span>
        </div>
        <hr>
        <h6 class="mt-3 mb-2"><i class="fas fa-chart-bar"></i> الإحصائيات:</h6>
        <div class="backup-preview-item">
            <span class="backup-preview-label"><i class="fas fa-users"></i> المجموعات:</span>
            <span class="backup-preview-value"><strong>${stats.groups}</strong></span>
        </div>
        <div class="backup-preview-item">
            <span class="backup-preview-label"><i class="fas fa-book"></i> الأذكار:</span>
            <span class="backup-preview-value"><strong>${stats.adkar}</strong></span>
        </div>
        <div class="backup-preview-item">
            <span class="backup-preview-label"><i class="fas fa-tag"></i> الفئات:</span>
            <span class="backup-preview-value"><strong>${stats.categories}</strong></span>
        </div>
    `;
    
    previewContent.innerHTML = previewHTML;
    previewDiv.style.display = 'block';
}

function cancelPreview() {
    const previewDiv = document.getElementById('backupPreview');
    const fileInput = document.getElementById('backupFile');
    
    if (previewDiv) previewDiv.style.display = 'none';
    if (fileInput) fileInput.value = '';
}

// ========== Progress Steps Management ==========
function updateStep(stepNumber, status = 'active') {
    const step = document.getElementById(`step${stepNumber}`);
    if (!step) return;
    
    // Remove all status classes
    step.classList.remove('active', 'completed');
    
    // Add new status
    if (status === 'active') {
        step.classList.add('active');
    } else if (status === 'completed') {
        step.classList.add('completed');
    }
}

function updateProgress(percentage, message) {
    const progressBar = document.getElementById('restoreProgressBar');
    const statusText = document.getElementById('restoreStatus');
    const stepsDiv = document.getElementById('restoreSteps');
    
    if (stepsDiv) stepsDiv.style.display = 'block';
    if (progressBar) progressBar.style.width = percentage + '%';
    if (statusText) statusText.textContent = message;
}

// ========== Initialize when DOM is ready ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupDragAndDrop();
    });
} else {
    setupDragAndDrop();
}

// Export functions for use in admin.html
window.showToast = showToast;
window.previewBackup = previewBackup;
window.cancelPreview = cancelPreview;
window.updateStep = updateStep;
window.updateProgress = updateProgress;
