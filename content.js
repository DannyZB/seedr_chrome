// Global variables
let seedr_chrome_add_after_login = '';
let seedr_chrome_add_after_login_magnet = false;
let seedr_chrome_add_after_login_force = false;

function showLoading() {
	if (window.self !== window.top) return; // We're not in the outermost window

	let loadingDiv = document.getElementById('seedr-chrome-loading-div');
	if (!loadingDiv) {
		loadingDiv = document.createElement('div');
		loadingDiv.id = 'seedr-chrome-loading-div';
		loadingDiv.innerHTML = `
            <div class="seedr-loader-content">
                <img src="${chrome.runtime.getURL("images/logo-icon.png")}" alt="Seedr" class="seedr-logo">
                <div class="seedr-loader-text">
                    <h3>Adding Torrent</h3>
                    <p>Please wait while we process your request...</p>
                </div>
            </div>
            <div class="seedr-progress-bar">
                <div class="seedr-progress-bar-fill"></div>
            </div>
            <button class="seedr-cancel-button">Cancel</button>
        `;
		document.body.appendChild(loadingDiv);

		// Simulate progress (replace with actual progress tracking if available)
		simulateProgress();

		// Add cancel functionality
		loadingDiv.querySelector('.seedr-cancel-button').addEventListener('click', hideLoading);
	}
	loadingDiv.style.display = 'block';
}

function hideLoading() {
	const loadingDiv = document.getElementById('seedr-chrome-loading-div');
	if (loadingDiv) loadingDiv.style.display = 'none';

	// Reset progress bar
	const progressBar = document.querySelector('.seedr-progress-bar-fill');
	if (progressBar) progressBar.style.width = '0';
}

function simulateProgress() {
	const progressBar = document.querySelector('.seedr-progress-bar-fill');
	let width = 0;
	const interval = setInterval(() => {
		if (width >= 100) {
			clearInterval(interval);
		} else {
			width++;
			progressBar.style.width = width + '%';
		}
	}, 50);
}

function showLogin() {
	chrome.runtime.sendMessage({
		type: 'open_window',
		url: 'https://www.seedr.cc/auth/pages/login?extension=1'
	});
}

// Batch Panel Overlay
function showBatchPanel() {
	if (window.self !== window.top) return;

	// Remove existing panel if any
	const existing = document.getElementById('seedr-batch-panel');
	if (existing) existing.remove();

	const panel = document.createElement('div');
	panel.id = 'seedr-batch-panel';
	panel.innerHTML = `
		<div class="seedr-batch-overlay"></div>
		<div class="seedr-batch-modal">
			<div class="seedr-batch-header">
				<img src="${chrome.runtime.getURL("images/logo-icon.png")}" alt="Seedr" class="seedr-batch-logo">
				<h3>Batch Add to Seedr</h3>
				<button class="seedr-batch-close">&times;</button>
			</div>
			<div class="seedr-batch-body">
				<p>Paste magnet links or torrent URLs, one per line:</p>
				<textarea class="seedr-batch-textarea" placeholder="magnet:?xt=urn:btih:...&#10;https://example.com/file.torrent&#10;..."></textarea>
				<div class="seedr-batch-status"></div>
			</div>
			<div class="seedr-batch-footer">
				<span class="seedr-batch-count">0 links</span>
				<button class="seedr-batch-cancel">Cancel</button>
				<button class="seedr-batch-submit" disabled>Add to Seedr</button>
			</div>
		</div>
	`;

	document.body.appendChild(panel);

	const textarea = panel.querySelector('.seedr-batch-textarea');
	const countSpan = panel.querySelector('.seedr-batch-count');
	const submitBtn = panel.querySelector('.seedr-batch-submit');
	const statusDiv = panel.querySelector('.seedr-batch-status');

	// Update link count on input
	textarea.addEventListener('input', () => {
		const links = parseLinks(textarea.value);
		const count = links.length;
		countSpan.textContent = `${count} link${count !== 1 ? 's' : ''}`;
		submitBtn.disabled = count === 0;
	});

	// Close handlers
	panel.querySelector('.seedr-batch-close').addEventListener('click', closeBatchPanel);
	panel.querySelector('.seedr-batch-cancel').addEventListener('click', closeBatchPanel);
	panel.querySelector('.seedr-batch-overlay').addEventListener('click', closeBatchPanel);

	// Submit handler
	submitBtn.addEventListener('click', () => {
		const links = parseLinks(textarea.value);
		if (links.length === 0) return;

		textarea.disabled = true;
		submitBtn.disabled = true;
		statusDiv.textContent = 'Starting...';
		statusDiv.className = 'seedr-batch-status';

		chrome.runtime.sendMessage({
			type: 'add_torrents_batch',
			links: links,
			force: true
		}, (response) => {
			if (!response) {
				statusDiv.textContent = 'Error: Extension disconnected';
				statusDiv.className = 'seedr-batch-status';
			} else if (response.result === 'login_required') {
				statusDiv.textContent = 'Please log in to Seedr first';
				statusDiv.className = 'seedr-batch-status';
				showLogin();
			} else if (response.success !== undefined) {
				const { success, failed, wishlist } = response;
				let msg = '';
				if (success > 0) msg += `${success} added`;
				if (wishlist > 0) msg += `${msg ? ', ' : ''}${wishlist} to wishlist`;
				if (failed > 0) msg += `${msg ? ', ' : ''}${failed} failed`;
				statusDiv.textContent = msg || 'Done';
				statusDiv.className = 'seedr-batch-status seedr-batch-status-done';

				// Close after delay if all succeeded
				if (failed === 0) {
					setTimeout(closeBatchPanel, 2000);
				}
			} else {
				statusDiv.textContent = 'Unknown error';
				statusDiv.className = 'seedr-batch-status';
			}
			textarea.disabled = false;
			submitBtn.disabled = false;
		});
	});

	// Focus textarea
	textarea.focus();

	// ESC to close
	panel.escHandler = (e) => {
		if (e.key === 'Escape') {
			closeBatchPanel();
		}
	};
	document.addEventListener('keydown', panel.escHandler);
}

function closeBatchPanel() {
	const panel = document.getElementById('seedr-batch-panel');
	if (panel) {
		if (panel.escHandler) {
			document.removeEventListener('keydown', panel.escHandler);
		}
		panel.remove();
	}
}

function parseLinks(text) {
	const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
	const links = [];
	const magnetStart = 'magnet:?xt=urn:btih:';

	for (const line of lines) {
		if (line.startsWith(magnetStart)) {
			links.push({ url: line, isMagnet: true });
		} else if (line.startsWith('http://') || line.startsWith('https://')) {
			// Accept any HTTP URL - backend will validate
			links.push({ url: line, isMagnet: false });
		}
	}

	return links;
}

function updateBatchProgress(current, total, status) {
	const statusDiv = document.querySelector('.seedr-batch-status');
	if (statusDiv) {
		statusDiv.textContent = `${status} (${current}/${total})`;
	}
}

function addTorrent(url, is_magnet, force = false) {
	console.log('adding torrent from ' + window.location);

	showLoading();
	const data = is_magnet
		? { type: 'add_torrent', magnet: url, force }
		: { type: 'add_torrent', torrent_url: url, force };

	chrome.runtime.sendMessage(data, (response) => {
		hideLoading();
		if (response.result === "use_default") {
			window.location.href = url;
		} else if (response.result === 'login_required') {
			seedr_chrome_add_after_login = url;
			seedr_chrome_add_after_login_magnet = is_magnet;
			seedr_chrome_add_after_login_force = force;
			showLogin();
		} else {
			console.log('sendResponse was called with: ', response);
		}
	});
}

function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

// Process a single link
function processLink(link) {
	if (!link.href || link.dataset.seedrProcessed) return;

	const magnet_start = "magnet:?xt=urn:btih:";
	const torrent_regex = /.[^?]+\.([^?]+)(\?|$)/;

	if (link.href.startsWith(magnet_start)) {
		link.dataset.seedrProcessed = 'true';
		const href = link.href; // Capture href before cloning
		// Remove all other event listeners
		const newLink = link.cloneNode(true);
		newLink.dataset.seedrProcessed = 'true';
		newLink.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			addTorrent(href, true);
		});
		link.parentNode.replaceChild(newLink, link);
	} else {
		const base_link = link.href.split('?')[0];
		const matches = base_link.match(torrent_regex);
		if (matches && matches[1] === "torrent") {
			link.dataset.seedrProcessed = 'true';
			const href = link.href; // Capture href before cloning
			link.removeAttribute('target');
			// Remove all other event listeners
			const newLink = link.cloneNode(true);
			newLink.dataset.seedrProcessed = 'true';
			newLink.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				addTorrent(href, false);
			});
			link.parentNode.replaceChild(newLink, link);
		}
	}
}

// Deep page scanner — finds magnet/torrent links beyond <a href>
function scanPageForLinks() {
	const found = new Map(); // dedupe by hash or URL

	function addLink(url, type, source) {
		// Normalize and dedupe by BTIH hash (magnets) or URL (torrents)
		let key;
		if (type === 'magnet') {
			const hashMatch = url.match(/urn:btih:([a-zA-Z0-9]{32,40})/i);
			key = hashMatch ? hashMatch[1].toLowerCase() : url;
		} else {
			key = url.split('?')[0].toLowerCase();
		}
		if (!found.has(key)) {
			found.set(key, { url, type, source });
		}
	}

	// 1. Existing <a href> magnets and torrents (already intercepted, but count them)
	document.querySelectorAll('a[href]').forEach(a => {
		const href = a.href;
		if (href.startsWith('magnet:?xt=urn:btih:')) {
			addLink(href, 'magnet', 'a-href');
		} else if (/\.torrent(\?|$)/i.test(href.split('?')[0])) {
			addLink(href, 'torrent', 'a-href');
		}
	});

	// 2. data-* attributes on any element
	const dataAttrs = ['data-magnet', 'data-torrent', 'data-href', 'data-url', 'data-download'];
	dataAttrs.forEach(attr => {
		document.querySelectorAll(`[${attr}]`).forEach(el => {
			const val = el.getAttribute(attr);
			if (!val) return;
			if (/^magnet:\?xt=urn:btih:/i.test(val)) {
				addLink(val, 'magnet', attr);
			} else if (/\.torrent(\?|$)/i.test(val)) {
				addLink(val, 'torrent', attr);
			}
		});
	});

	// 3. onclick/onmousedown attribute values
	document.querySelectorAll('[onclick],[onmousedown]').forEach(el => {
		const handler = el.getAttribute('onclick') || el.getAttribute('onmousedown') || '';
		// Extract magnet URIs from JS string literals
		const magnetMatches = handler.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9][^'"\s)}\]>]*/gi);
		if (magnetMatches) {
			magnetMatches.forEach(m => addLink(m, 'magnet', 'onclick'));
		}
		// Extract .torrent URLs
		const torrentMatches = handler.match(/https?:\/\/[^'"\s)}\]>]*\.torrent[^'"\s)}\]>]*/gi);
		if (torrentMatches) {
			torrentMatches.forEach(t => addLink(t, 'torrent', 'onclick'));
		}
	});

	// 4. Inline <script> content
	document.querySelectorAll('script:not([src])').forEach(script => {
		const text = script.textContent;
		if (!text) return;
		const magnetMatches = text.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9][^'"\s)}\]>]*/gi);
		if (magnetMatches) {
			magnetMatches.forEach(m => addLink(m, 'magnet', 'script'));
		}
		const torrentMatches = text.match(/https?:\/\/[^'"\s)}\]>]*\.torrent[^'"\s)}\]>]*/gi);
		if (torrentMatches) {
			torrentMatches.forEach(t => addLink(t, 'torrent', 'script'));
		}
	});

	return Array.from(found.values());
}

// Process new links
function processNewLinks(addedNodes) {
	addedNodes.forEach(node => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			if (node.tagName === 'A') {
				processLink(node);
			} else {
				node.querySelectorAll('a').forEach(processLink);
			}
		}
	});
}

// Debounced version of processNewLinks
const debouncedProcessNewLinks = debounce(processNewLinks, 250);

// Utility function to create element with classes
function createElement(tag, classes) {
	const element = document.createElement(tag);
	if (classes) element.className = classes;
	return element;
}

function notify(data) {
	const { message, notificationType, timeout, buttons } = data;

	let notificationContainer = document.getElementById('seedr-notification-container');
	if (!notificationContainer) {
		notificationContainer = createElement('div', 'seedr-notification-container');
		notificationContainer.id = 'seedr-notification-container';
		document.body.appendChild(notificationContainer);
	}

	const notification = createElement('div', `seedr-notification seedr-notification-${notificationType}`);

	const messageElement = createElement('div', 'seedr-notification-message');
	messageElement.textContent = message;
	notification.appendChild(messageElement);

	if (buttons && buttons.length) {
		const buttonContainer = createElement('div', 'seedr-notification-buttons');
		buttons.forEach(button => {
			const buttonElement = createElement('button', button.addClass);
			buttonElement.textContent = button.text;
			buttonElement.addEventListener('click', () => {
				chrome.runtime.sendMessage({
					type: 'open_window',
					url: button.url
				});
				removeNotification(notification);
			});
			buttonContainer.appendChild(buttonElement);
		});
		notification.appendChild(buttonContainer);
	}

	const closeButton = createElement('button', 'seedr-notification-close');
	closeButton.innerHTML = '&times;';
	closeButton.addEventListener('click', () => removeNotification(notification));
	notification.appendChild(closeButton);

	notificationContainer.appendChild(notification);

	if (timeout) {
		setTimeout(() => removeNotification(notification), timeout);
	}
}

function removeNotification(notification) {
	notification.style.opacity = '0';
	notification.style.transform = 'translateX(20px)';
	setTimeout(() => notification.remove(), 300);
}

// Message receiver
function receiveMessage(event) {
	if (event.origin !== "https://www.seedr.cc") return;

	const { function: func, username, password } = event.data;

	switch (func) {
		case 'close_login':
			hideLoading();
			break;
		case 'login':
			showLoading();

			chrome.runtime.sendMessage({ type: 'login', username, password }, (response) => {
				if (response.result === false) {
					hideLoading();
					const loginFrame = document.getElementById('seedr-chrome-login-frame');
					if (loginFrame) {
						loginFrame.style.opacity = '1';
						loginFrame.contentWindow.postMessage({ function: 'showError' }, 'https://www.seedr.cc');
					}
				}
			});
			break;
	}
}

// Set up event listeners
window.addEventListener("message", receiveMessage, false);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (window.self !== window.top) return; // We're not in the outermost window

	switch (message.type) {
		case 'showLoading':
			showLoading();
			break;
		case 'hideLoading':
			hideLoading();
			break;
		case 'add_torrent':
			addTorrent(message.url, message.is_magnet, true);
			break;
		case 'notify':
			notify(message);
			break;
		case 'batch_progress':
			updateBatchProgress(message.current, message.total, message.status);
			break;
		case 'show_batch_panel':
			showBatchPanel();
			break;
		case 'login_successful':
			addTorrent(seedr_chrome_add_after_login, seedr_chrome_add_after_login_magnet, seedr_chrome_add_after_login_force);
			hideLoading();

			if (document.body.id == "login-page" && window.parent === window &&
			document.location.hostname === 'www.seedr.cc' &&
			document.location.search.indexOf('extension=') !== -1 ) {
				window.close();
			}
			break;
		case 'seedr_sync':
			if (document.location.hostname === 'www.seedr.cc') {
				location.href = "javascript:syncFolder(true); void 0";
			}
			break;
	}

	return true;
});

// Badge update — tell background worker how many links found on this page
function updateBadge() {
	const links = scanPageForLinks();
	chrome.runtime.sendMessage({
		type: 'update_badge',
		count: links.length,
		links: links
	});
}
const debouncedUpdateBadge = debounce(updateBadge, 500);

const observer = new MutationObserver((mutations) => {
	const addedNodes = [];
	let attributeChanged = false;

	mutations.forEach((mutation) => {
		if (mutation.type === 'childList') {
			addedNodes.push(...mutation.addedNodes);
		} else if (mutation.type === 'attributes') {
			// Re-process element when relevant attributes change
			const el = mutation.target;
			if (el.tagName === 'A') {
				el.dataset.seedrProcessed = ''; // Clear processed flag
				processLink(el);
			}
			attributeChanged = true;
		}
	});

	if (addedNodes.length > 0) {
		debouncedProcessNewLinks(addedNodes);
	}
	if (attributeChanged) {
		// Re-scan for non-<a> links too
		debouncedUpdateBadge();
	}
});

// get setting for "default torrent client" -> skip if not
chrome.runtime.sendMessage({ type: 'getStorage', key: 'control_torrents' }, (response) => {
	if (response.value === false) return;

	// Process existing links
	document.querySelectorAll('a').forEach(processLink);

	// Start observing
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['href', 'data-magnet', 'data-torrent', 'data-href', 'data-url']
	});

	// Initial scan + badge update after processing <a> links
	setTimeout(updateBadge, 1000);
});

const extensionElement = document.getElementById('seedr-extension-element');
if (extensionElement) {
	extensionElement.textContent = 'loaded';
}
