(function() {
    'use strict';
    var injectorUrl = chrome.runtime.getURL('injector.js');
    var coreUrl = chrome.runtime.getURL('MendixLensCore.js');
    var script = document.createElement('script');
    script.src = injectorUrl + '?scriptUrl=' + encodeURIComponent(coreUrl);
    script.onload = function() { script.remove(); };
    (document.head || document.documentElement).appendChild(script);
})();
