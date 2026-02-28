(function() {
    'use strict';
    var selfScript = document.currentScript && document.currentScript.src;
    if (!selfScript) return;
    var match = selfScript.match(/[?&]scriptUrl=([^&]+)/);
    var url = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
    if (!url) return;

    function run() {
        if (typeof window.mx === 'undefined') return;
        var s = document.createElement('script');
        s.src = url;
        s.onload = function() { s.remove(); };
        (document.head || document.documentElement).appendChild(s);
    }

    if (typeof window.mx !== 'undefined') {
        run();
    } else {
        var attempts = 0;
        var maxAttempts = 20;
        var t = setInterval(function() {
            attempts++;
            if (typeof window.mx !== 'undefined') {
                clearInterval(t);
                run();
            } else if (attempts >= maxAttempts) {
                clearInterval(t);
            }
        }, 300);
    }
})();
