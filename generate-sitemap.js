const fs = require('fs');
const path = require('path');

// Define the production domain (ensure no trailing slash)
const DOMAIN = process.env.SITE_URL || "https://trustedtoolsweb.com";

// Comprehensive list of directories to strictly exclude from the sitemap
// Includes directories found in project root to prevent security leaks
const IGNORE_DIRS = [
    'node_modules', '.git', 'css', 'js', 'assets', 
    'components', 'img', 'media', 'doc', 'sec', 
    'admin', 'Documents File', 'seo', 'text', 'tool'
];

// Specific HTML files to exclude from indexing (e.g., partials, docs)
const IGNORE_FILES = [
    '404.html', 'readme.html', 'documentation.html', 
    'footer.html', 'header.html'
];

// Recursive function to scan directories safely
function walkSync(currentDirPath, callback) {
    try {
        const dirents = fs.readdirSync(currentDirPath, { withFileTypes: true });
        
        dirents.forEach(dirent => {
            // Skip ignored directories and hidden folders/files
            if (IGNORE_DIRS.includes(dirent.name) || dirent.name.startsWith('.')) return; 

            const filePath = path.join(currentDirPath, dirent.name);
            
            if (dirent.isDirectory()) {
                walkSync(filePath, callback);
            } else if (dirent.isFile() && dirent.name.endsWith('.html')) {
                // Ensure the specific file is not in the ignore list
                if (!IGNORE_FILES.includes(dirent.name)) {
                    callback(filePath);
                }
            }
        });
    } catch (error) {
        // Log the error but prevent the script from crashing entirely
        console.error(`Error reading directory ${currentDirPath}:`, error);
    }
}

// Initialize XML structure
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

const rootDir = __dirname; 

console.log('Scanning project directories for sitemap generation...');

try {
    walkSync(rootDir, (filePath) => {
        // Normalize paths for cross-platform compatibility (Windows/Linux)
        let relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

        // Clean URL for SEO by completely removing 'index.html'
        if (relativePath === 'index.html') {
            relativePath = '';
        } else if (relativePath.endsWith('/index.html')) {
            relativePath = relativePath.replace(/\/index\.html$/, '');
        }

        const url = relativePath ? `${DOMAIN}/${relativePath}` : DOMAIN;

        // Retrieve file modification time with a fallback to current time
        let modifiedTime = new Date().toISOString(); 
        try {
            const stats = fs.statSync(filePath);
            modifiedTime = stats.mtime.toISOString();
        } catch (statError) {
            console.warn(`Could not read stats for ${filePath}. Using current time.`);
        }

        // Dynamic Priority and Change Frequency routing
        let priority = '0.8';       // Default priority for standard pages
        let changefreq = 'monthly'; // Default change frequency

        if (relativePath === '' || relativePath === '/') {
            priority = '1.0'; 
            changefreq = 'weekly';
        } else if (relativePath.startsWith('tools/')) {
            priority = '0.9'; 
            changefreq = 'weekly';
        } else if (relativePath.startsWith('pages/')) {
            priority = '0.7'; 
            changefreq = 'yearly';
        }

        // Append URL entry to XML
        xml += `  <url>\n`;
        xml += `    <loc>${url}</loc>\n`;
        xml += `    <lastmod>${modifiedTime}</lastmod>\n`;
        xml += `    <changefreq>${changefreq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += `  </url>\n`;
    });

    xml += '</urlset>';

    // Write the final sitemap.xml to the root directory
    const sitemapPath = path.join(rootDir, 'sitemap.xml');
    fs.writeFileSync(sitemapPath, xml);
    console.log('✅ Advanced Sitemap generated flawlessly at:', sitemapPath);

} catch (criticalError) {
    console.error('Critical Error during sitemap generation:', criticalError);
    process.exit(1); 
}
