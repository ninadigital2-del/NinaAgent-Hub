// Update Clock
function updateClock() {
    const now = new Date();
    const options = { 
        timeZone: 'Asia/Bangkok', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
    };
    const timeString = new Intl.DateTimeFormat('th-TH', options).format(now);
    
    // Add date
    const dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateString = new Intl.DateTimeFormat('th-TH', dateOptions).format(now);

    document.getElementById('clock').innerHTML = `${dateString} | ${timeString}`;
}

// Initial update and set interval
updateClock();
setInterval(updateClock, 1000);

// Logging Webhook URL (ใส่ Web App URL ของ NinaAgent_Hub เพื่อเปิดใช้ระบบเก็บ Log)
const GAS_WEBHOOK_URL = ''; // e.g. "https://script.google.com/macros/s/.../exec"

function logAction(action, details) {
    if (!GAS_WEBHOOK_URL) {
        console.log(`[Log Action] ${action}: ${details}`);
        return;
    }
    fetch(GAS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
            action: action,
            details: details
        })
    }).catch(err => console.error('Failed to log action:', err));
}

// Modal handling
const pdfModal = document.getElementById('pdfModal');
const pdfIframe = document.getElementById('pdfIframe');
const pdfTitle = document.getElementById('pdfTitle');
const pdfLoader = document.getElementById('pdfLoader');

function openTool(action, details, url) {
    // Log the action
    logAction(action, details);
    
    // Open in new tab
    const newTab = window.open('about:blank', '_blank');
    if (newTab) {
        newTab.document.write('<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:20px;color:#666;">กำลังนำทางไปที่เครื่องมือ...</div>');
        setTimeout(() => {
            newTab.location.href = url;
        }, 500);
    } else {
        window.location.href = url;
    }
}

function openManual(driveIdOrUrl, title) {
    pdfTitle.textContent = title;
    pdfModal.classList.add('active');
    
    pdfIframe.style.display = 'block';
    pdfLoader.style.display = 'flex';
    pdfIframe.style.opacity = '0';
    
    const targetUrl = driveIdOrUrl.startsWith('http') ? driveIdOrUrl : 'https://drive.google.com/file/d/' + driveIdOrUrl + '/preview';
    pdfIframe.src = targetUrl;

    pdfIframe.onload = function() {
        pdfLoader.style.display = 'none';
        pdfIframe.style.transition = 'opacity 0.5s ease';
        pdfIframe.style.opacity = '1';
    };
}

function closePdfModal() {
    pdfModal.classList.remove('active');
    setTimeout(() => {
        pdfIframe.src = '';
    }, 300);
}

pdfModal.addEventListener('click', function(e) {
    if (e.target === pdfModal) {
        closePdfModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && pdfModal.classList.contains('active')) {
        closePdfModal();
    }
});
