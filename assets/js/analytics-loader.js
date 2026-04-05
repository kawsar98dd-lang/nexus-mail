/**
 * ====================================================================
 * GLOBAL GOOGLE ANALYTICS LOADER
 * ====================================================================
 * This script handles the loading of Google Analytics (GA4) with 
 * smart filtering features.
 * * Features:
 * 1. Admin Mode: Prevents tracking when '?admin_mode=true' is in the URL.
 * 2. Localhost Filter: Prevents tracking on development environments.
 * 3. Dynamic Injection: Loads the GA script only for valid users.
 */

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION (Buyer should edit this)
    // ==========================================
    const GA_MEASUREMENT_ID = 'G-Z59Q668QBG'; // Replace with your GA Measurement ID


    // ==========================================
    // 1. ADMIN MODE DETECTION
    // ==========================================
    // Check if the URL contains '?admin_mode=true'
    // If true, we save a flag in localStorage to ignore future visits from this browser.
    if (window.location.search.includes('admin_mode=true')) {
        localStorage.setItem('is_admin', 'true');
        alert('Admin Mode Activated! Your visits will not be counted in Analytics.');
    }


    // ==========================================
    // 2. ENVIRONMENT CHECK
    // ==========================================
    // Check if the site is running on localhost, 127.0.0.1, or a local file system.
    // We do not want to track development traffic.
    var isLocal = window.location.hostname === "localhost" || 
                  window.location.hostname === "127.0.0.1" || 
                  window.location.protocol === "file:";


    // ==========================================
    // 3. LOAD ANALYTICS
    // ==========================================
    // Only load Google Analytics if:
    // a) The user is NOT an admin (checked via localStorage)
    // b) The site is NOT running locally
    if (!localStorage.getItem('is_admin') && !isLocal) {
        
        // Create the Google Analytics script element dynamically
        var script = document.createElement('script');
        script.async = true;
        script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
        
        // Append the script to the document head
        document.head.appendChild(script);

        // Initialize the DataLayer
        window.dataLayer = window.dataLayer || [];
        
        function gtag() { 
            dataLayer.push(arguments); 
        }
        
        // Configure GA
        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID);

        console.log('Google Analytics Loaded: Tracking Active');
    } else {
        console.log('Google Analytics Blocked: Admin Mode or Localhost detected.');
    }

})();
