const API_URL = 'https://script.google.com/macros/s/AKfycby01Vt8mWPbziblEgfQb0sexWqrkEm9cIiFR810UVxCJF26SPXJDOkx11aT0Ezo4u9h/exec';

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

    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.innerHTML = `${dateString} | ${timeString}`;
    
    const mobileClockEl = document.getElementById('mobile-clock');
    if (mobileClockEl) mobileClockEl.innerHTML = `${dateString} | ${timeString}`;
}

// Initial update and set interval
updateClock();
setInterval(updateClock, 1000);

const pdfModal = document.getElementById('pdfModal');
const pdfIframe = document.getElementById('pdfIframe');
const pdfTitle = document.getElementById('pdfTitle');
const pdfLoader = document.getElementById('pdfLoader');

// Sidebar Logic
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

function showDashboard(element) {
    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Show dashboard, hide iframe
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('iframe-view').style.display = 'none';
    document.querySelector('.content-scroll').style.padding = '';
    
    // Clear iframe to save memory
    document.getElementById('tool-frame').src = '';
    
    // Close mobile sidebar if open
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

function loadToolInFrame(element, toolName, url) {
    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Show iframe, hide dashboard
    document.getElementById('dashboard-view').style.display = 'none';
    const iframeView = document.getElementById('iframe-view');
    iframeView.style.display = 'block';
    
    // Remove padding for iframe view to prevent cropping
    if (window.innerWidth <= 768) {
        document.querySelector('.content-scroll').style.padding = '0';
    } else {
        document.querySelector('.content-scroll').style.padding = '0 1rem';
    }
    
    // Show loader and set src
    document.getElementById('iframe-loader').style.display = 'flex';
    document.getElementById('tool-frame').src = url;
    
    // Close mobile sidebar if open
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    
    // Log interaction
    fetch('https://script.google.com/macros/s/AKfycby01Vt8mWPbziblEgfQb0sexWqrkEm9cIiFR810UVxCJF26SPXJDOkx11aT0Ezo4u9h/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'Iframe Open', details: `Opened ${toolName} in Iframe` })
    }).catch(e => console.log(e));
}

function openTool(action, details, url) {
    const newTab = window.open('about:blank', '_blank');
    if (newTab) {
        newTab.document.write('<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:20px;color:#666;">กำลังโหลด...</div>');
    }

    // Call API to log
    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: action, details: details })
    }).then(() => {
        if (newTab) newTab.location.href = url;
        else window.location.href = url;
    }).catch((err) => {
        if (newTab) newTab.location.href = url;
        else window.location.href = url;
    });
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
