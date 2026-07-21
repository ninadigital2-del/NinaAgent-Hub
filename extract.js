const fs = require('fs');
const content = fs.readFileSync('C:/Users/poomi/Desktop/ad-review-queue-mockup.html', 'utf8');
const match = content.match(/srcdoc="([^"]*)"/);
if (match) {
    let unescaped = match[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&');
    fs.writeFileSync('C:/Users/poomi/Desktop/ad-review-queue-mockup-inner.html', unescaped);
    console.log('Extracted to ad-review-queue-mockup-inner.html');
} else {
    console.log('No srcdoc found');
}
