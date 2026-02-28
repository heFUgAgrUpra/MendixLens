(function() {
    'use strict';

    // --- Idempotency: do not run if widget already exists ---
    if (document.getElementById('dataDiv')) {
        return;
    }

    // --- Constants ---
    const Z_INDEX_DATA_DIV = 2147483645;
    const Z_INDEX_BUTTONS = 2147483647;
    const Z_INDEX_HIGHLIGHT = 2147483644;
    const INTERVAL_DURATION_MS = 1000;
    const TRIPLE_CLICK_RESET_MS = 1000;
    const COPY_FLASH_DURATION_MS = 200;
    const DRAG_THRESHOLD_PX = 15;
    const BORDER_HIT_MARGIN_PX = 5;
    const PULSE_STYLE_ID = 'mendix-lens-pulse-style';

    const COLORS = {
        panelBg: '#efeded',
        panelBorder: 'rgb(12,15,36)',
        panelText: '#000000',
        collapseButton: '#007bff',
        closeButton: '#ff4d4d',
        collapseButtonAccent: 'rgb(1 166 220)',
        copyFlash: '#90EE90',
    };

    const MENDIX_ID_COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'pink', 'brown', 'cyan'];
    const ELEMENT_ID_COLORS = ['black', 'darkblue', 'darkgreen', 'darkred', 'darkorange', 'darkviolet', 'darkslategray', 'brown'];

    /** Mendix widget-type classes (from DOM) -> short label for tooltip */
    const WIDGET_TYPE_LABELS = {
        'mx-datagrid': 'Data grid',
        'mx-templategrid': 'Template grid',
        'mx-listview': 'List view',
        'mx-dataview': 'Data view',
        'mx-button': 'Button',
        'mx-link': 'Link',
        'mx-image': 'Image',
        'mx-input': 'Input',
        'mx-dropdown': 'Dropdown',
        'mx-checkbox': 'Checkbox',
        'mx-radiobuttons': 'Radio buttons',
        'mx-textarea': 'Text area',
        'mx-label': 'Label',
        'mx-container': 'Container',
        'mx-divider': 'Divider',
        'mx-tabpage': 'Tab page',
        'mx-navigationlist': 'Navigation list',
        'mx-menubar': 'Menu bar',
        'mx-searchinput': 'Search input',
        'mx-referencesetselector': 'Reference set selector',
        'mx-sortablelist': 'Sortable list'
    };

    // --- State (shared so teardown can remove listeners) ---
    let path = '';
    let expanded = false;
    let isMobilePreview = false;
    let closeButton = null;
    let collapseButton = null;
    let observer = null;
    let intervalId = null;
    let mouseOverEnabled = true;
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    let dragDistanceX = 0, dragDistanceY = 0;
    let movedWhileCollapsed = false;

    let wheelScrollHandler = null;
    let contextmenuHandler = null;
    let mouseoverHandler = null;
    let docMousemoveHandler = null;
    let docMouseupHandler = null;
    let escapeKeyHandler = null;

    // --- Helpers ---
    function isInMobilePreviewFrame() {
        try {
            let currentWindow = window;
            while (currentWindow !== window.top) {
                if (currentWindow.frameElement &&
                    currentWindow.location.pathname === '/index.html' &&
                    (currentWindow.location.search.includes('profile=Phone') ||
                     currentWindow.location.search.includes('profile=Tablet'))) {
                    console.log('Mendix Lens: running in ' + currentWindow.location.search + ' preview mode');
                    return true;
                }
                currentWindow = currentWindow.parent;
            }
            return false;
        } catch (e) {
            console.error('Mendix Lens: error checking iframe context', e);
            return false;
        }
    }

    function toggleButtonVisibility(show) {
        if (closeButton) closeButton.style.display = show ? 'block' : 'none';
        if (collapseButton) collapseButton.style.display = show ? 'block' : 'none';
    }

    function applyMobileTextStyles(dataDiv, isMobile) {
        if (isMobile) {
            dataDiv.style.whiteSpace = 'normal';
            dataDiv.style.wordBreak = 'break-word';
            dataDiv.style.overflowWrap = 'break-word';
            const allSpans = dataDiv.querySelectorAll('span');
            allSpans.forEach(span => {
                if (span.id !== 'infoIcon') {
                    span.style.display = 'block';
                    span.style.whiteSpace = 'normal';
                    span.style.wordBreak = 'break-word';
                    span.style.overflowWrap = 'break-word';
                    span.style.width = '100%';
                    if (span.parentElement && (span.parentElement.id === 'mendixIdSpan' || span.parentElement.id === 'elementIdSpan')) {
                        span.style.display = 'inline';
                        span.style.width = 'auto';
                    }
                    if (span.parentElement && !span.parentElement.id.includes('Span')) {
                        span.style.margin = '4px 0';
                    }
                }
            });
        } else {
            dataDiv.style.whiteSpace = 'normal';
            dataDiv.style.wordBreak = 'break-word';
            dataDiv.style.overflowWrap = 'break-word';
            const allSpans = dataDiv.querySelectorAll('span');
            allSpans.forEach(span => {
                if (span.id !== 'infoIcon') {
                    span.style.display = 'inline';
                    span.style.whiteSpace = 'normal';
                    span.style.wordBreak = 'break-word';
                    span.style.overflowWrap = 'break-word';
                    span.style.width = 'auto';
                    span.style.margin = '0';
                }
            });
        }
    }

    function ensurePulseStyle() {
        if (document.getElementById(PULSE_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = PULSE_STYLE_ID;
        style.textContent = [
            '@keyframes mendix-lens-pulse {',
            '  0% { border-color: red; box-shadow: 0 0 5px red; }',
            '  50% { border-color: orange; box-shadow: 0 0 15px orange; }',
            '  100% { border-color: red; box-shadow: 0 0 5px red; }',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function resetDataDivStyle(dataDiv) {
        Object.assign(dataDiv.style, {
            position: 'fixed',
            width: '30px',
            height: '30px',
            backgroundColor: COLORS.collapseButton,
            borderRadius: '50%',
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: Z_INDEX_DATA_DIV,
            minWidth: 'initial',
            padding: '0',
            border: 'none',
            display: 'block',
            minHeight: isMobilePreview ? '' : 'initial'
        });
        Array.from(dataDiv.children).forEach(child => { child.style.display = 'none'; });
        const iSpan = Array.from(dataDiv.children).find(c => c.tagName === 'SPAN' && (c.innerText || c.textContent || '').trim() === 'i');
        if (iSpan) iSpan.style.display = 'flex';
        toggleButtonVisibility(false);
    }

    function updatePageName(cleanPath, dataDiv) {
        const existing = document.querySelector('#pageName');
        if (existing) {
            if (existing.innerText !== 'Page name: ' + cleanPath) {
                existing.innerText = 'Page name: ' + cleanPath;
                existing.style.display = 'inline';
            }
        } else {
            const span = document.createElement('span');
            span.id = 'pageName';
            span.innerText = 'Page name: ' + cleanPath;
            dataDiv.insertBefore(span, dataDiv.firstChild);
        }
    }

    function getTextToCopy(dataDiv) {
        return Array.from(dataDiv.childNodes)
            .filter(node => node.id !== 'mendixPageCloseButton' && node.id !== 'mendixPageCollapseButton' && node.id !== 'infoIcon')
            .map(node => (node.innerText || node.textContent || '').trim())
            .filter(text => text.length > 0)
            .join('\n')
            .replace(/\n{2,}/g, '\n');
    }

    function copyToClipboard(text) {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).catch(function() {
                return copyToClipboardFallback(text);
            });
        }
        return Promise.resolve(copyToClipboardFallback(text));
    }

    function copyToClipboardFallback(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } finally {
            document.body.removeChild(textarea);
        }
    }

    function teardown(dataDiv) {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        const highlight = document.querySelector('#activeElementHighlight');
        if (highlight) highlight.remove();
        if (wheelScrollHandler) {
            document.removeEventListener('wheel', wheelScrollHandler);
            document.removeEventListener('scroll', wheelScrollHandler, true);
            wheelScrollHandler = null;
        }
        if (contextmenuHandler) {
            document.removeEventListener('contextmenu', contextmenuHandler);
            contextmenuHandler = null;
        }
        if (mouseoverHandler) {
            document.removeEventListener('mouseover', mouseoverHandler);
            mouseoverHandler = null;
        }
        if (docMousemoveHandler) {
            document.removeEventListener('mousemove', docMousemoveHandler);
            docMousemoveHandler = null;
        }
        if (docMouseupHandler) {
            document.removeEventListener('mouseup', docMouseupHandler);
            docMouseupHandler = null;
        }
        if (escapeKeyHandler) {
            document.removeEventListener('keydown', escapeKeyHandler);
            escapeKeyHandler = null;
        }
        mouseOverEnabled = true;
        if (dataDiv && dataDiv.parentNode) dataDiv.remove();
    }

    function resetHighlightAndEnableMouseOver() {
        const el = document.querySelector('#activeElementHighlight');
        if (el) el.remove();
        mouseOverEnabled = true;
    }

    /** Find element or nearest ancestor that has an mx-name-* class (widget root). */
    function findWidgetRoot(el) {
        let node = el;
        while (node) {
            const hasMxName = Array.from(node.classList || []).some(function(c) { return c.indexOf('mx-name-') === 0; });
            if (hasMxName) return node;
            node = node.parentElement;
        }
        return null;
    }

    /** Get row/item index from mx-name-index-N class on element or ancestor. Returns null if none. */
    function getRowIndex(el) {
        let node = el;
        while (node) {
            const match = Array.from(node.classList || []).find(function(c) { return c.indexOf('mx-name-index-') === 0; });
            if (match) {
                const num = match.replace('mx-name-index-', '');
                if (/^\d+$/.test(num)) return parseInt(num, 10);
            }
            node = node.parentElement;
        }
        return null;
    }

    /** Get first known widget type label from element or ancestor classes. */
    function getWidgetTypeLabel(el) {
        let node = el;
        while (node) {
            const classes = node.classList || [];
            for (let i = 0; i < classes.length; i++) {
                const label = WIDGET_TYPE_LABELS[classes[i]];
                if (label) return label;
            }
            node = node.parentElement;
        }
        return null;
    }

    /** Get custom/extra classes on widget root (not mx-name-*, not mx-name-index-*). */
    function getCustomClasses(widgetRoot) {
        if (!widgetRoot || !widgetRoot.classList) return [];
        const custom = [];
        Array.from(widgetRoot.classList).forEach(function(c) {
            if (c.indexOf('mx-name-') !== 0) custom.push(c);
        });
        return custom;
    }

    /** Check if widget root or ancestors appear disabled. */
    function isWidgetDisabled(el) {
        let node = el;
        while (node) {
            if (node.getAttribute && (node.getAttribute('aria-disabled') === 'true' || node.disabled === true)) return true;
            if (node.classList && node.classList.contains('mx-disabled')) return true;
            node = node.parentElement;
        }
        return false;
    }

    function appendInfoSpan(dataDiv, id, label, value, colorArray, colorIndex) {
        const s = document.createElement('span');
        s.id = id;
        const colored = colorArray && value.indexOf('.') !== -1
            ? String(value).split('.').map(function(part, i) {
                return '<span style="color:' + colorArray[(colorIndex + i) % colorArray.length] + ';font-weight:bold">' + part + '</span>';
            }).join('.')
            : value;
        s.innerHTML = '<br>' + label + ': ' + colored;
        dataDiv.appendChild(s);
    }

    // --- Main interval: create widget once, then keep path updated ---
    intervalId = setInterval(function() {
        if (expanded || path === '') {
            try {
                path = mx.ui.getContentForm().path;
            } catch (e) {
                clearInterval(intervalId);
                intervalId = null;
                return;
            }
        }
        const cleanPath = path.replace('.page.xml', '');
        let dataDiv = document.getElementById('dataDiv');
        if (!dataDiv) {
            dataDiv = document.createElement('div');
            dataDiv.id = 'dataDiv';
            dataDiv.setAttribute('aria-label', 'Mendix Lens');
            isMobilePreview = isInMobilePreviewFrame();
            resetDataDivStyle(dataDiv);
            dataDiv.style.top = '8px';
            dataDiv.style.left = '8px';

            const infoSpan = document.createElement('span');
            infoSpan.innerText = 'i';
            infoSpan.id = 'infoIcon';
            Object.assign(infoSpan.style, {
                display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '1px',
                fontFamily: 'cursive', fontSize: '20px', fontWeight: 'bold'
            });
            dataDiv.appendChild(infoSpan);
            document.body.appendChild(dataDiv);
            const infoIcon = document.getElementById('infoIcon');

            dataDiv.addEventListener('click', function expandClick() {
                if (!isDragging && !expanded && !movedWhileCollapsed) {
                    if (isMobilePreview) {
                        dataDiv.style.width = 'calc(100% - 16px)';
                        dataDiv.style.top = '24px';
                        dataDiv.style.left = '6px';
                        dataDiv.style.minWidth = 'initial';
                        dataDiv.style.height = 'auto';
                        dataDiv.style.minHeight = '10em';
                        applyMobileTextStyles(dataDiv, true);
                    } else {
                        dataDiv.style.width = 'fit-content';
                        dataDiv.style.maxWidth = 'calc(100vw - 32px)';
                        dataDiv.style.height = 'auto';
                        dataDiv.style.minHeight = '7.5em';
                        dataDiv.style.overflow = 'visible';
                        applyMobileTextStyles(dataDiv, false);
                    }
                    Object.assign(dataDiv.style, {
                        padding: '8px', backgroundColor: COLORS.panelBg, border: '3px solid ' + COLORS.panelBorder,
                        borderRadius: '5px', color: COLORS.panelText, fontSize: '70%', fontWeight: '700',
                        overflow: 'visible'
                    });
                    infoIcon.style.display = 'none';
                    updatePageName(cleanPath, dataDiv);
                    expanded = true;
                    Array.from(dataDiv.children).forEach(function(c) {
                        if (c !== infoIcon) c.style.display = 'inline';
                    });
                    toggleButtonVisibility(true);
                }
                if (movedWhileCollapsed) movedWhileCollapsed = false;
            });

            let clickCount = 0;
            let clickTimer = null;
            dataDiv.addEventListener('click', function tripleClickCopy(e) {
                if (!expanded) return;
                clickCount++;
                if (clickCount === 1) {
                    clickTimer = setTimeout(function() { clickCount = 0; }, TRIPLE_CLICK_RESET_MS);
                }
                if (clickCount === 3) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    const text = getTextToCopy(dataDiv);
                    copyToClipboard(text).then(function() {
                        const orig = dataDiv.style.backgroundColor;
                        dataDiv.style.backgroundColor = COLORS.copyFlash;
                        setTimeout(function() { dataDiv.style.backgroundColor = orig; }, COPY_FLASH_DURATION_MS);
                    }).catch(function(err) {
                        console.error('Mendix Lens: copy failed', err);
                    });
                }
            });

            observer = new MutationObserver(function() {
                if (!expanded) {
                    Array.from(dataDiv.children).forEach(function(c) {
                        c.style.display = c === infoIcon ? 'flex' : 'none';
                    });
                    toggleButtonVisibility(false);
                } else {
                    Array.from(dataDiv.children).forEach(function(c) {
                        if (c !== infoIcon) c.style.display = 'inline';
                    });
                    toggleButtonVisibility(true);
                }
            });
            observer.observe(dataDiv, { childList: true, subtree: true });

            if (!document.getElementById('mendixPageCloseButton')) {
                closeButton = document.createElement('button');
                closeButton.id = 'mendixPageCloseButton';
                closeButton.innerText = 'X';
                closeButton.setAttribute('aria-label', 'Close Mendix Lens');
                Object.assign(closeButton.style, {
                    position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px',
                    borderRadius: '50%', border: '1px solid black', backgroundColor: COLORS.closeButton,
                    color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '0', zIndex: Z_INDEX_BUTTONS
                });
                dataDiv.appendChild(closeButton);
                closeButton.addEventListener('click', function() {
                    teardown(dataDiv);
                });
            } else {
                closeButton = document.getElementById('mendixPageCloseButton');
            }

            if (!document.getElementById('mendixPageCollapseButton')) {
                collapseButton = document.createElement('button');
                collapseButton.id = 'mendixPageCollapseButton';
                collapseButton.innerText = '<';
                collapseButton.setAttribute('aria-label', 'Collapse Mendix Lens');
                Object.assign(collapseButton.style, {
                    position: 'absolute', bottom: '-10px', right: '-10px', width: '20px', height: '20px',
                    borderRadius: '50%', border: '1px solid black', backgroundColor: COLORS.collapseButtonAccent,
                    color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer', padding: '0', zIndex: Z_INDEX_BUTTONS
                });
                dataDiv.appendChild(collapseButton);
                collapseButton.addEventListener('click', function(e) {
                    e.stopPropagation();
                    expanded = false;
                    resetDataDivStyle(dataDiv);
                    const hl = document.querySelector('#activeElementHighlight');
                    if (hl) hl.remove();
                    toggleButtonVisibility(false);
                    mouseOverEnabled = true;
                });
            } else {
                collapseButton = document.getElementById('mendixPageCollapseButton');
            }

            dataDiv.addEventListener('mousedown', function(e) {
                const rect = dataDiv.getBoundingClientRect();
                const m = BORDER_HIT_MARGIN_PX;
                const withinBorder = (e.clientX >= rect.left - m && e.clientX <= rect.left + m) || (e.clientX >= rect.right - m && e.clientX <= rect.right + m) ||
                    (e.clientY >= rect.top - m && e.clientY <= rect.top + m) || (e.clientY >= rect.bottom - m && e.clientY <= rect.bottom + m);
                if (withinBorder || !expanded) {
                    isDragging = true;
                    dragDistanceX = dragDistanceY = 0;
                    offsetX = e.clientX - rect.left;
                    offsetY = e.clientY - rect.top;
                    dataDiv.style.cursor = 'move';
                    e.preventDefault();
                }
            });

            docMousemoveHandler = function(e) {
                if (!isDragging) return;
                const newLeft = e.clientX - offsetX;
                const newTop = e.clientY - offsetY;
                const prevLeft = parseFloat(dataDiv.style.left) || 0;
                const prevTop = parseFloat(dataDiv.style.top) || 0;
                dragDistanceX += Math.abs(newLeft - prevLeft);
                dragDistanceY += Math.abs(newTop - prevTop);
                if (dragDistanceX > DRAG_THRESHOLD_PX || dragDistanceY > DRAG_THRESHOLD_PX) {
                    dataDiv.style.left = newLeft + 'px';
                    dataDiv.style.top = newTop + 'px';
                    if (!expanded) movedWhileCollapsed = true;
                }
            };
            document.addEventListener('mousemove', docMousemoveHandler);

            docMouseupHandler = function() {
                if (isDragging) {
                    isDragging = false;
                    dataDiv.style.cursor = 'default';
                }
            };
            document.addEventListener('mouseup', docMouseupHandler);

            dataDiv.addEventListener('mousemove', function(e) {
                const rect = dataDiv.getBoundingClientRect();
                const m = BORDER_HIT_MARGIN_PX;
                const withinBorder = (e.clientX >= rect.left - m && e.clientX <= rect.left + m) || (e.clientX >= rect.right - m && e.clientX <= rect.right + m) ||
                    (e.clientY >= rect.top - m && e.clientY <= rect.top + m) || (e.clientY >= rect.bottom - m && e.clientY <= rect.bottom + m);
                dataDiv.style.cursor = !expanded ? 'pointer' : (withinBorder ? 'crosshair' : 'default');
            });
        }

        if (dataDiv) updatePageName(cleanPath, dataDiv);
    }, INTERVAL_DURATION_MS);

    wheelScrollHandler = resetHighlightAndEnableMouseOver;
    document.addEventListener('wheel', wheelScrollHandler);
    document.addEventListener('scroll', wheelScrollHandler, true);

    const dataDivRef = function() { return document.getElementById('dataDiv'); };
    contextmenuHandler = function(event) {
        if (!(event.shiftKey && event.button === 2)) return;
        const div = dataDivRef();
        if (!div || !expanded) return;
        event.preventDefault();
        if (window.getSelection()) window.getSelection().removeAllRanges();
        const existingHighlight = document.querySelector('#activeElementHighlight');
        if (existingHighlight) existingHighlight.remove();
        if (mouseOverEnabled) {
            const element = document.elementFromPoint(event.clientX, event.clientY);
            if (element && div && !div.contains(element)) {
                ensurePulseStyle();
                const highlightDiv = document.createElement('div');
                highlightDiv.id = 'activeElementHighlight';
                Object.assign(highlightDiv.style, {
                    position: 'absolute', pointerEvents: 'none', border: '4px solid red', borderRadius: '5px',
                    zIndex: Z_INDEX_HIGHLIGHT, animation: 'mendix-lens-pulse 1s infinite'
                });
                const rect = element.getBoundingClientRect();
                highlightDiv.style.width = (rect.width + 8) + 'px';
                highlightDiv.style.height = (rect.height + 8) + 'px';
                highlightDiv.style.top = (rect.top + window.scrollY - 4) + 'px';
                highlightDiv.style.left = (rect.left + window.scrollX - 4) + 'px';
                document.body.appendChild(highlightDiv);
            }
        }
        mouseOverEnabled = !mouseOverEnabled;
    };
    document.addEventListener('contextmenu', contextmenuHandler);

    mouseoverHandler = function(event) {
        if (!mouseOverEnabled) return;
        ['#mxNameClass', '#mendixIdSpan', '#elementIdSpan', '#mxRowIndexSpan', '#mxWidgetTypeSpan', '#mxCustomClassesSpan', '#mxTagSpan', '#mxDisabledSpan'].forEach(function(id) {
            const el = document.querySelector(id);
            if (el) el.remove();
        });
        const element = event.target;
        const widgetRoot = findWidgetRoot(element);
        if (!widgetRoot) return;
        const className = Array.from(widgetRoot.classList || []).find(function(c) { return c.indexOf('mx-name-') === 0; });
        if (!className) return;
        const dataDiv = document.getElementById('dataDiv');
        if (!dataDiv) return;

        const mxNameSpan = document.createElement('span');
        mxNameSpan.id = 'mxNameClass';
        mxNameSpan.innerHTML = '<br>Name: ' + String(className).replace('mx-name-', '');
        if (isMobilePreview) Object.assign(mxNameSpan.style, { whiteSpace: 'normal', overflow: 'auto', textOverflow: 'clip', display: 'block' });
        dataDiv.appendChild(mxNameSpan);

        let mendixId = widgetRoot.getAttribute('data-mendix-id');
        if (!mendixId) {
            let p = widgetRoot.parentElement;
            while (p) {
                if (p.hasAttribute('data-mendix-id') && p.tagName.toLowerCase() === 'div') {
                    mendixId = p.getAttribute('data-mendix-id');
                    break;
                }
                p = p.parentElement;
            }
        }
        if (mendixId) appendInfoSpan(dataDiv, 'mendixIdSpan', 'Data Mendix ID', mendixId, MENDIX_ID_COLORS, 0);

        let elementId = element.getAttribute('id');
        if (!elementId) {
            const attr = Array.from(element.attributes || []).find(function(a) { return a.name.toLowerCase().indexOf('id') !== -1; });
            elementId = attr ? attr.value : null;
        }
        if (elementId) appendInfoSpan(dataDiv, 'elementIdSpan', 'Element ID', elementId, ELEMENT_ID_COLORS, 0);

        const rowIndex = getRowIndex(element);
        if (rowIndex !== null) {
            const rowSpan = document.createElement('span');
            rowSpan.id = 'mxRowIndexSpan';
            rowSpan.innerHTML = '<br>Row/Item index: <span style="font-weight:bold">' + rowIndex + '</span>';
            dataDiv.appendChild(rowSpan);
        }

        const widgetType = getWidgetTypeLabel(element);
        if (widgetType) {
            const typeSpan = document.createElement('span');
            typeSpan.id = 'mxWidgetTypeSpan';
            typeSpan.innerHTML = '<br>Widget type: <span style="font-weight:bold">' + widgetType + '</span>';
            dataDiv.appendChild(typeSpan);
        }

        const customClasses = getCustomClasses(widgetRoot);
        if (customClasses.length > 0) {
            const customSpan = document.createElement('span');
            customSpan.id = 'mxCustomClassesSpan';
            customSpan.innerHTML = '<br>Extra classes: <span style="font-weight:bold">' + customClasses.join(' ') + '</span>';
            dataDiv.appendChild(customSpan);
        }

        const tagName = (element.tagName || '').toLowerCase();
        if (tagName) {
            const tagSpan = document.createElement('span');
            tagSpan.id = 'mxTagSpan';
            tagSpan.innerHTML = '<br>Tag: <span style="font-weight:bold">' + tagName + '</span>';
            dataDiv.appendChild(tagSpan);
        }

        if (isWidgetDisabled(element)) {
            const disSpan = document.createElement('span');
            disSpan.id = 'mxDisabledSpan';
            disSpan.innerHTML = '<br>Disabled: <span style="font-weight:bold">yes</span>';
            dataDiv.appendChild(disSpan);
        }
    };
    document.addEventListener('mouseover', mouseoverHandler);

    escapeKeyHandler = function(e) {
        if (e.key !== 'Escape') return;
        const dataDiv = document.getElementById('dataDiv');
        if (!dataDiv) return;
        if (expanded) {
            expanded = false;
            resetDataDivStyle(dataDiv);
            const hl = document.querySelector('#activeElementHighlight');
            if (hl) hl.remove();
            toggleButtonVisibility(false);
            mouseOverEnabled = true;
        } else {
            teardown(dataDiv);
        }
    };
    document.addEventListener('keydown', escapeKeyHandler);
})();
