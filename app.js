const API_URL = 'https://script.google.com/macros/s/AKfycbwWffrwgCbxM1Ox6ujhcD78qx19vmsLYsl7Try2HdeFqkZ2aUk8EJhQMrcArBX_NMKF/exec';

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

// Desktop sidebar collapse/expand
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const sidebarExpandBtn = document.getElementById('sidebarExpandBtn');

function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
}

if (sidebarCollapseBtn) {
    sidebarCollapseBtn.addEventListener('click', () => setSidebarCollapsed(true));
}
if (sidebarExpandBtn) {
    sidebarExpandBtn.addEventListener('click', () => setSidebarCollapsed(false));
}
if (localStorage.getItem('sidebarCollapsed') === '1') {
    setSidebarCollapsed(true);
}

function showDashboard(element, skipHash = false) {
    if (window.event && window.event.preventDefault) window.event.preventDefault();
    if (!skipHash) {
        if (window.location.hash !== '#dashboard') history.pushState(null, null, '#dashboard');
    }

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Show dashboard, hide iframe
    const iframeViewEl = document.getElementById('iframe-view');
    document.getElementById('dashboard-view').style.display = 'block';
    iframeViewEl.style.display = 'none';
    delete iframeViewEl.dataset.autoHeight;
    iframeViewEl.style.overflow = 'hidden';
    document.querySelector('.content-scroll').style.padding = '';

    // Clear iframe to save memory
    const toolFrameEl = document.getElementById('tool-frame');
    toolFrameEl.src = '';
    toolFrameEl.style.height = '100%';
    
    // Close mobile sidebar if open
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

// The iframe that hosts each tool needs an explicit pixel height (it's the
// only reliable way to get a cross-origin iframe -- e.g. an Apps Script
// tool -- to scroll its own content correctly on mobile). A fixed
// "calc(100vh - 6rem)" only happened to match the desktop header's height;
// on mobile the header/sidebar chrome is a different size (and changes
// between portrait/landscape), so that guess left too little or a
// mismatched amount of room and made the iframe's internal scrolling feel
// broken or tiny. Measuring the element's actual on-screen position adapts
// to any header height, orientation, or device automatically.
// Nested cross-origin iframes on mobile can still be flaky for touch-scroll
// in some browsers/webviews even with a correct viewport, so these tools
// open as a real new tab on phones (matching how Dashboard/native pages
// already scroll perfectly) while staying embedded in-frame on desktop,
// where it feels like part of the same page as every other tool.
function openToolAdaptive(element, toolName, url) {
    if (window.innerWidth <= 768) {
        window.open(url, '_blank', 'noopener');
        return;
    }
    loadToolInFrame(element, toolName, url);
}

function sizeIframeView() {
    const iframeView = document.getElementById('iframe-view');
    if (!iframeView || iframeView.style.display === 'none') return;
    if (iframeView.dataset.autoHeight === 'true') return; // a tool is self-reporting its height instead
    const top = iframeView.getBoundingClientRect().top;
    const available = window.innerHeight - top;
    if (available > 100) iframeView.style.height = available + 'px';
}
window.addEventListener('resize', sizeIframeView);
window.addEventListener('orientationchange', () => setTimeout(sizeIframeView, 200));

// Nested iframes don't scroll reliably on mobile (iOS in particular can
// mis-map touch coordinates inside a fixed-height scrollable iframe, making
// scroll only register near one edge). Tools that opt in report their real
// content height via postMessage instead, so on mobile we grow the iframe
// to fit that height exactly and let the page's own natural scroll (already
// enabled at <=768px, see style.css) handle it -- no nested scroll region
// needed at all. Tools that don't send this message are unaffected.
window.addEventListener('message', (e) => {
    if (!e.data || e.data.ninaHubResize !== true) return;
    if (window.innerWidth > 768) return;
    const iframeView = document.getElementById('iframe-view');
    const toolFrame = document.getElementById('tool-frame');
    if (!iframeView || !toolFrame || iframeView.style.display === 'none') return;
    const height = Math.max(Number(e.data.height) || 0, 300);
    iframeView.dataset.autoHeight = 'true';
    iframeView.style.height = height + 'px';
    iframeView.style.overflow = 'visible';
    toolFrame.style.height = height + 'px';
});

function loadToolInFrame(element, toolName, url, skipHash = false) {
    if (window.event && window.event.preventDefault) window.event.preventDefault();
    let targetHash = window.location.hash;
    if (!skipHash) {
        const hashId = '#' + toolName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (window.location.hash !== hashId) history.pushState(null, null, hashId);
        targetHash = hashId;
    }

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Show iframe, hide dashboard
    document.getElementById('dashboard-view').style.display = 'none';
    const iframeView = document.getElementById('iframe-view');
    iframeView.style.display = 'block';

    // Reset any auto-height left over from a previous tool that
    // self-reports its size, so a tool that doesn't opt in falls back to
    // the normal fixed-height behavior instead of inheriting a stale size.
    delete iframeView.dataset.autoHeight;
    iframeView.style.overflow = 'hidden';
    document.getElementById('tool-frame').style.height = '100%';

    // Remove padding for iframe view to prevent cropping
    if (window.innerWidth <= 768) {
        document.querySelector('.content-scroll').style.padding = '0';
    } else {
        document.querySelector('.content-scroll').style.padding = '0 1rem';
    }

    // Show loader and set src
    document.getElementById('iframe-loader').style.display = 'flex';
    document.getElementById('tool-frame').src = url;
    sizeIframeView();

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

// Router Logic
function handleRouting() {
    const hash = window.location.hash;
    if (!hash || hash === '' || hash === '#' || hash === '#dashboard') {
        showDashboard(document.getElementById('nav-dashboard'), true);
        return;
    }

    // Iterate sidebar links to find match
    const links = document.querySelectorAll('.sidebar-tool-link');
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/loadToolInFrame\(this,\s*'([^']+)',\s*'([^']+)'\)/);
            if (match) {
                const toolName = match[1];
                const url = match[2];
                const expectedHash = '#' + toolName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (hash === expectedHash || (hash === '#creative-team' && toolName === 'GEM Review Queue') || (hash === '#creative_team' && toolName === 'GEM Review Queue')) {
                    loadToolInFrame(link, toolName, url, true);
                    return;
                }
            }
        }
    }
    // Default to dashboard if hash not found
    showDashboard(document.getElementById('nav-dashboard'), true);
}

window.addEventListener('DOMContentLoaded', handleRouting);
window.addEventListener('hashchange', handleRouting);
