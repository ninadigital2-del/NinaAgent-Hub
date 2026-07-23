const fs = require('fs');

const path = 'C:/Users/poomi/Desktop/ad-review-queue-mockup.html';
let content = fs.readFileSync(path, 'utf8');

const match = content.match(/srcdoc="([^"]*)"/);
if (match) {
    let unescaped = match[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&');

    // 1. Update colors for the age variables
    unescaped = unescaped.replace(
        /--age-fresh:.*?;/,
        '--age-fresh: #22A06B;\n      --bg-fresh: #EAF8F1;'
    );
    unescaped = unescaped.replace(
        /--age-watch:.*?;/,
        '--age-watch: #E58A00;\n      --bg-watch: #FFF6DF;'
    );
    unescaped = unescaped.replace(
        /--age-stale:.*?;/,
        '--age-stale: #D92D20;\n      --bg-stale: #FFF0EE;'
    );

    // 2. Add text color variables
    unescaped = unescaped.replace(
        /color: var\(--foreground\);/,
        'color: #182230;\n      --muted-foreground: #667085;'
    );

    // 3. Update the dot classes to also set bg-color
    unescaped = unescaped.replace(
        /#ad-review-queue \.fresh \{ --age-color: var\(--age-fresh\); \}/,
        '#ad-review-queue .fresh { --age-color: var(--age-fresh); --bg-color: var(--bg-fresh); }'
    );
    unescaped = unescaped.replace(
        /#ad-review-queue \.watch \{ --age-color: var\(--age-watch\); \}/,
        '#ad-review-queue .watch { --age-color: var(--age-watch); --bg-color: var(--bg-watch); }'
    );
    unescaped = unescaped.replace(
        /#ad-review-queue \.stale \{ --age-color: var\(--age-stale\); \}/,
        '#ad-review-queue .stale { --age-color: var(--age-stale); --bg-color: var(--bg-stale); }'
    );

    // 4. Update the queue-item background
    unescaped = unescaped.replace(
        /background: color-mix\(in srgb, var\(--age-color\) 9%, var\(--card\)\);/,
        'background: var(--bg-color, var(--card));'
    );
    
    // 5. Ensure text color overrides
    unescaped = unescaped.replace(
        /color: var\(--muted-foreground\);/g,
        'color: #667085;'
    );

    // Escape back
    const escaped = unescaped
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    content = content.replace(/srcdoc="[^"]*"/, `srcdoc="${escaped}"`);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated mockup!');
} else {
    console.log('Could not find srcdoc.');
}
