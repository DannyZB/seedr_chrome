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
	progressBar.style.width = '0';
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
		// Remove all other event listeners
		const newLink = link.cloneNode(true);
		newLink.dataset.seedrProcessed = 'true';
		newLink.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			addTorrent(link.href, true);
		});
		link.parentNode.replaceChild(newLink, link);
	} else {
		const base_link = link.href.split('?')[0];
		const matches = base_link.match(torrent_regex);
		if (matches && matches[1] === "torrent") {
			link.dataset.seedrProcessed = 'true';
			link.removeAttribute('target');
			// Remove all other event listeners
			const newLink = link.cloneNode(true);
			newLink.dataset.seedrProcessed = 'true';
			newLink.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				addTorrent(link.href, false);
			});
			link.parentNode.replaceChild(newLink, link);
		}
	}
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

const observer = new MutationObserver((mutations) => {
	const addedNodes = [];
	mutations.forEach((mutation) => {
		addedNodes.push(...mutation.addedNodes);
	});
	if (addedNodes.length > 0) {
		debouncedProcessNewLinks(addedNodes);
	}
});

// get setting for "default torrent client" -> skip if not
chrome.runtime.sendMessage({ type: 'getStorage', key: 'control_torrents' }, (response) => {
	if (response.value === false) return;

	// Process existing links
	document.querySelectorAll('a').forEach(processLink);

	// Start observing
	observer.observe(document.body, { childList: true, subtree: true });
});

const extensionElement = document.getElementById('seedr-extension-element');
if (extensionElement) {
	extensionElement.textContent = 'loaded';
}