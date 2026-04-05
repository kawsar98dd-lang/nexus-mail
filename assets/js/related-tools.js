import toolsData from './tools-data.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('dynamic-related-tools');
    
    if (!container) return;

    // ১. পাথ ডিটেকশন (যাতে যেকোনো ফোল্ডার থেকে লিংক ঠিকমতো কাজ করে)
    const pathName = window.location.pathname;
    let rootPath = './';
    if (pathName.includes('/tools/')) {
        rootPath = '../../';
    } else if (pathName.includes('/pages/')) {
        rootPath = '../';
    }

    const currentCategory = container.getAttribute('data-category');
    const currentPage = container.getAttribute('data-current-page');

    if (!currentCategory || !currentPage) {
        console.error('Related tools: Missing data-category or data-current-page attributes.');
        return;
    }

    // ২. Filter tools: Match category AND exclude current page
    let relatedTools = toolsData.filter(tool => {
        // Handle multi-category (e.g. "dev student")
        const toolCategories = tool.category.split(' ');
        const isMatch = toolCategories.includes(currentCategory);
        
        // .includes() ব্যবহার করা হয়েছে কারণ tool.link এ এখন "tools/category/" যুক্ত আছে
        const isNotCurrent = !tool.link.includes(currentPage); 
        
        return isMatch && isNotCurrent;
    });

    // Randomize logic (Fisher-Yates Shuffle)
    for (let i = relatedTools.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [relatedTools[i], relatedTools[j]] = [relatedTools[j], relatedTools[i]];
    }

    // Limit to 4 cards
    const toolsToShow = relatedTools.slice(0, 4);

    // If no tools found in category, hide container or show generic message
    if (toolsToShow.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Build Grid
    const gridHtml = document.createElement('div');
    gridHtml.className = 'tools-grid';
    gridHtml.id = 'toolsGrid'; // Keeping original ID style for CSS compatibility

    toolsToShow.forEach(tool => {
        const anchor = document.createElement('a');
        
        // ৩. লিংকের শুরুতে rootPath বসানো হলো
        anchor.href = rootPath + tool.link; 
        
        anchor.className = tool.classes;
        anchor.setAttribute('data-category', tool.category);
        anchor.setAttribute('data-name', tool.dataName);
        anchor.innerHTML = tool.html;
        gridHtml.appendChild(anchor);
    });

    // Title Section
    const titleSection = document.createElement('div');
    titleSection.style.marginBottom = '25px';
    titleSection.innerHTML = `<h2 class="section-title">Related More Tools</h2>`;

    // Append to container
    container.appendChild(titleSection);
    container.appendChild(gridHtml);
});
