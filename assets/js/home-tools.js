import toolsData from './tools-data.js';

document.addEventListener('DOMContentLoaded', () => {
  const toolsGrid = document.getElementById('toolsGrid');
  const searchInput = document.getElementById('toolSearch');
  const filterBtns = document.querySelectorAll('.cat-btn');
  
  // ডিফল্ট সেটিংস
  let currentCategory = 'all';
  let currentSearch = '';
  
  // ১. টুলস রেন্ডার করার ফাংশন
  const renderTools = () => {
    toolsGrid.innerHTML = ''; // গ্রিড ক্লিয়ার করা
    
    // ডেটা ফিল্টার করা (Category + Search একসাথে)
    const filteredTools = toolsData.filter(tool => {
      // Category চেকিং
      const toolCategories = tool.category.split(' '); // যেমন: "dev student"
      const categoryMatch = currentCategory === 'all' || toolCategories.includes(currentCategory);
      
      // Search চেকিং (Title অথবা Keywords/DataName এর সাথে)
      const searchLower = currentSearch.toLowerCase();
      const nameMatch = tool.dataName.toLowerCase().includes(searchLower);
      
      return categoryMatch && nameMatch;
    });
    
    // যদি কোনো টুল না পাওয়া যায়
    if (filteredTools.length === 0) {
      toolsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #8b949e;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom: 15px;"></i>
                    <p>No tools found matching your criteria.</p>
                </div>`;
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    filteredTools.forEach(tool => {
      const anchor = document.createElement('a');
      
      // .html রিমুভ করে রুট (/) ডিরেক্টরি থেকে ক্লিন লিংক জেনারেট করা হলো
      let cleanLink = tool.link.replace('.html', '');
      anchor.href = '/' + cleanLink; 
      
      anchor.className = tool.classes;
      anchor.setAttribute('data-category', tool.category);
      anchor.setAttribute('data-name', tool.dataName);
      
      anchor.innerHTML = tool.html;
      
      fragment.appendChild(anchor);
    });
    
    toolsGrid.appendChild(fragment);
  }; // <--- ফিক্স ১: renderTools ফাংশনটি এখানে ক্লোজ করা হলো
  
  // ২. ক্যাটাগরি বাটনের লজিক
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Active class পরিবর্তন
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // নতুন ক্যাটাগরি সেট করা
      currentCategory = btn.getAttribute('data-filter');
      renderTools();
    });
  });
  
  // ৩. সার্চ বারের লজিক
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderTools();
    });
  }
  
  // প্রথমবার লোড হওয়ার সময় সব টুল দেখাবে
  renderTools();
}); // <--- ফিক্স ২: ইভেন্ট লিসেনারটি এখানে সঠিকভাবে ক্লোজ করা হলো
