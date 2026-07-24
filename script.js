const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

let count = 0;
walkDir('./apps/admin-console/src', function(filePath) {
    if (filePath.endsWith('.css')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        let newContent = content.replace(/font-family:\s*[^;}]*(?:serif|Playfair|Bodoni|Georgia|Lobster)[^;}]*;/gi, "font-family: 'DM Sans', sans-serif;");
        
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Updated: ' + filePath);
            count++;
        }
    }
});
console.log('Total files updated: ' + count);
