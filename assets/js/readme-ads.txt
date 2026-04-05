================================================================================
ULTRA AD MANAGER - DOCUMENTATION (A to Z)
Project: Trusted Tools Web
Version: 1.0.0
================================================================================

Congratulations on purchasing "Trusted Tools Web"! To make your life easier, 
we have implemented a Centralized Ad Management System. Instead of editing 
100+ HTML files, you can manage all your advertisements from a SINGLE file.

--------------------------------------------------------------------------------
1. FILE LOCATION
--------------------------------------------------------------------------------
Navigate to the following directory to manage your ads:
PATH: assets/js/ads-manager.js

--------------------------------------------------------------------------------
2. HOW TO SETUP YOUR ADS
--------------------------------------------------------------------------------
Open 'ads-manager.js' in any code editor. You will see an object named 'AD_SETTINGS'.

A. Global Header Scripts:
If your ad provider (like Google AdSense) gives you a script to put in the <head>, 
paste it inside the 'headerScripts' property.
Example: 
headerScripts: `<script async src="...adsbygoogle.js"></script>`

B. Configuring Ad Slots:
There are pre-defined slots like "top-banner", "bottom-banner", and "sidebar-ad".
- 'active': Set to 'true' to show the ad, or 'false' to hide the slot completely.
- 'code': Paste your HTML/JavaScript ad code here inside backticks (``).

--------------------------------------------------------------------------------
3. SUPPORTED AD PROVIDERS
--------------------------------------------------------------------------------
This system is "Ultra Pro Max" because it supports almost EVERY ad provider:
- Google AdSense (Display, In-feed, Link ads)
- Adsterra (Banners, Pop-unders, Social bars)
- Ezoic / Media.net
- Custom HTML Banners (Image with link)
- Affiliate Scripts (Amazon, etc.)

Note: Our system includes a "Script Execution Engine" which ensures that 
third-party JavaScript ads load correctly even when injected dynamically.

--------------------------------------------------------------------------------
4. HOW TO ADD ADS IN NEW PAGES
--------------------------------------------------------------------------------
If you create a new tool page and want to show ads, simply paste these 
empty DIVs where you want the ads to appear:

For Top Ad: <div class="ad-slot" data-ad-slot="top-banner"></div>
For Bottom Ad: <div class="ad-slot" data-ad-slot="bottom-banner"></div>

Make sure the following script is linked at the bottom of your HTML:
<script src="../../assets/js/ads-manager.js"></script>

--------------------------------------------------------------------------------
5. KEY FEATURES FOR BUYERS
--------------------------------------------------------------------------------
- Zero Coding Required: You only paste the ad codes in one JS file.
- Auto-Hide: If a slot is empty or 'active' is false, the space will 
  automatically disappear to maintain your site's design integrity.
- Privacy & Speed: Optimized to load after the main content, ensuring a 
  fast user experience (SEO friendly).
- Ad-Blocker Friendly: Designed to not break the layout if an ad-blocker is used.

--------------------------------------------------------------------------------
6. FREQUENTLY ASKED QUESTIONS (FAQ)
--------------------------------------------------------------------------------
Q: Can I have different ads for different tools?
A: By default, the ads are global. If you need tool-specific ads, you can 
   simply create a new slot name in 'ads-manager.js' and call it in that tool.

Q: Why are my ads not showing?
A: 1. Ensure 'active' is set to true. 
   2. Check if your AdSense account is approved for this domain. 
   3. Disable your browser's Ad-blocker during testing.

Q: Will this affect my SEO?
A: No. The ads are injected after the DOM is ready, which is a recommended 
   practice for PageSpeed.

--------------------------------------------------------------------------------
Support: If you have any issues, feel free to contact us via the CodeCanyon 
profile page. Happy Earning!
================================================================================


Important: "Do not delete assets/js/ads-manager.js. It controls all the advertisement spaces across 100+ tools."


--------------------------------------------------------------------------------
2. HOW TO SETUP YOUR ADS (EASY STEPS)
--------------------------------------------------------------------------------
1. Open 'assets/js/ads-manager.js'.
2. Look for the 'USER_AD_CONFIG' section at the top.
3. If using Google AdSense:
   - Set 'enabled: true'.
   - Change 'client_id' to your Publisher ID (e.g., ca-pub-12345678).
   - Add your Slot IDs for 'top_slot_id' and 'bottom_slot_id'.
4. If using other networks:
   - Set 'adsense: { enabled: false }'.
   - Set 'custom_ads: { enabled: true }' and paste your HTML code.
--------------------------------------------------------------------------------
