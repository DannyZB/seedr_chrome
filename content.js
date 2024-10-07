// Global variables
let seedr_chrome_add_after_login = '';
let seedr_chrome_add_after_login_magnet = false;
let seedr_chrome_add_after_login_force = false;

// Helper functions
function showLoading() {
	if (self !== top) {
		return; // We're not in the outermost window
	}

	let loadingDiv = document.getElementById('seedr-chrome-loading-div');
	if (loadingDiv) {
		loadingDiv.style.display = 'block';
	} else {
		loadingDiv = document.createElement('div');
		loadingDiv.id = 'seedr-chrome-loading-div';
		loadingDiv.className = 'seedr-reset';
		loadingDiv.innerHTML = `
            <div style="width:200px; text-align:center; background:white; border-radius:5px; border:1px solid #aaaaaa; padding:40px; position:absolute; left:50%; margin-left:-100px;">
                <img src="${chrome.runtime.getURL("images/seedr.png")}" style="padding:10px"><br>
                <img src="${chrome.runtime.getURL("images/chrome-adding-torrent.gif")}">
            </div>
        `;
		document.body.appendChild(loadingDiv);
	}
}

function hideLoading() {
	const loadingDiv = document.getElementById('seedr-chrome-loading-div');
	if (loadingDiv) {
		loadingDiv.style.display = 'none';
	}
}

function showLogin() {
	let loginFrame = document.getElementById('seedr-chrome-login-frame');
	if (loginFrame) {
		loginFrame.style.display = 'block';
	} else {
		loginFrame = document.createElement('iframe');
		loginFrame.src = 'https://www.seedr.cc/dev/extension_login/login_frame.html';
		loginFrame.id = 'seedr-chrome-login-frame';
		loginFrame.style.display = 'block';
		document.body.appendChild(loginFrame);
	}

	setTimeout(() => {
		if (!loginFrame.style.display === 'none') {
			chrome.runtime.sendMessage({
				'type': 'open_window',
				'url': 'https://www.seedr.cc/dev/extension_login/login_frame.html'
			}, (response) => {});
		}
	}, 200);
}

function hideLogin() {
	const loginFrame = document.getElementById('seedr-chrome-login-frame');
	if (loginFrame) {
		loginFrame.style.display = 'none';
	}
}

function addTorrent(url, is_magnet, force = false) {
	console.log('adding torrent from ' + window.location);

	showLoading();
	const data = is_magnet
		? { type: 'add_torrent', magnet: url, force: force }
		: { type: 'add_torrent', torrent_url: url, force: force };

	chrome.runtime.sendMessage(data, (response) => {
		if (response.result === "use_default") {
			hideLoading();
			window.location.href = url;
		} else if (response.result === 'login_required') {
			seedr_chrome_add_after_login = url;
			seedr_chrome_add_after_login_magnet = is_magnet;
			seedr_chrome_add_after_login_force = force;
			hideLoading();
			showLogin();
		} else {
			hideLoading();
			console.log('sendResponse was called with: ', response);
		}
	});
}

// Process all links on the page
function processLinks() {
	const links = document.getElementsByTagName('a');
	const magnet_start = "magnet:?xt=urn:btih:";
	const torrent_regex = /.[^?]+\.([^?]+)(\?|$)/;

	for (const link of links) {
		if (link.href) {
			if (link.href.startsWith(magnet_start)) {
				link.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					addTorrent(link.href, true);
				});
			} else {
				const base_link = link.href.split('?')[0];
				const matches = base_link.match(torrent_regex);
				if (matches && matches[1] === "torrent") {
					link.removeAttribute('target');
					// Uncomment the following if you want to automatically handle torrent links
					// link.addEventListener('click', (e) => {
					//     e.preventDefault();
					//     addTorrent(link.href, false);
					// });
				}
			}
		}
	}
}

// Utility function to create element with classes
function createElement(tag, classes) {
	const element = document.createElement(tag);
	if (classes) {
		element.className = classes;
	}
	return element;
}

function notify(data) {
	const { message, notificationType, timeout, buttons } = data;

	// Create notification container if it doesn't exist
	let notificationContainer = document.getElementById('seedr-notification-container');
	if (!notificationContainer) {
		notificationContainer = createElement('div', 'seedr-notification-container');
		notificationContainer.id = 'seedr-notification-container';
		document.body.appendChild(notificationContainer);
	}

	// Create notification element
	const notification = createElement('div', `seedr-notification seedr-notification-${notificationType}`);

	// Create message element
	const messageElement = createElement('div', 'seedr-notification-message');
	messageElement.textContent = message;
	notification.appendChild(messageElement);

	// Create buttons if any
	if (buttons && buttons.length) {
		const buttonContainer = createElement('div', 'seedr-notification-buttons');
		buttons.forEach(button => {
			const buttonElement = createElement('button', button.addClass);
			buttonElement.textContent = button.text;
			buttonElement.addEventListener('click', () => {
				chrome.runtime.sendMessage({
					type: 'open_window',
					url: button.url
				}, () => {});
				notification.remove();
			});
			buttonContainer.appendChild(buttonElement);
		});
		notification.appendChild(buttonContainer);
	}

	// Add close button
	const closeButton = createElement('button', 'seedr-notification-close');
	closeButton.innerHTML = '&times;';
	closeButton.addEventListener('click', () => notification.remove());
	notification.appendChild(closeButton);

	// Add notification to container
	notificationContainer.appendChild(notification);

	// Remove notification after timeout
	if (timeout) {
		setTimeout(() => notification.remove(), timeout);
	}

	// Add styles if not already present
	if (!document.getElementById('seedr-notification-styles')) {
		const style = document.createElement('style');
		style.id = 'seedr-notification-styles';
		style.textContent = `
            .seedr-notification-container {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9999;
            }
            .seedr-notification {
                background-color: #ffffff;
                border: 1px solid #cccccc;
                border-radius: 4px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                margin-bottom: 10px;
                max-width: 300px;
                padding: 10px;
                position: relative;
            }
            .seedr-notification-success {
                border-left: 4px solid #28a745;
            }
            .seedr-notification-warning {
                border-left: 4px solid #ffc107;
            }
            .seedr-notification-error {
                border-left: 4px solid #dc3545;
            }
            .seedr-notification-message {
                margin-bottom: 10px;
            }
            .seedr-notification-buttons {
                display: flex;
                justify-content: flex-end;
            }
            .seedr-notification button {
                background-color: #007bff;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                margin-left: 5px;
                padding: 5px 10px;
            }
            .seedr-notification button:hover {
                background-color: #0056b3;
            }
            .seedr-notification-close {
                background-color: transparent !important;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 20px;
                position: absolute;
                right: 5px;
                top: 5px;
            }
            .seedr-notification-close:hover {
                color: #333;
            }
        `;
		document.head.appendChild(style);
	}
}


// Message receiver
function receiveMessage(event) {
	if (event.origin !== "https://www.seedr.cc") {
		return;
	}

	const message = event.data;

	switch (message.function) {
		case 'close_login':
			hideLoading();
			hideLogin();
			break;
		case 'login':
			hideLogin();
			showLoading();

			chrome.runtime.sendMessage({
				type: 'login',
				username: message.username,
				password: message.password
			}, (response) => {
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
		case 'login_facebook':
			// Implement Facebook login logic if needed
			break;
	}
}

// Set up event listeners
window.addEventListener("message", receiveMessage, false);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (self !== top) {
		return; // We're not in the outermost window
	}

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
			hideLogin();
			addTorrent(seedr_chrome_add_after_login, seedr_chrome_add_after_login_magnet, seedr_chrome_add_after_login_force);
			hideLoading();

			if (document.getElementById('seedr-chrome-login-div') && window.parent === window) {
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	processLinks();

	const extensionElement = document.getElementById('seedr-extension-element');
	if (extensionElement) {
		extensionElement.textContent = 'loaded';
	}
});

// Observe for dynamically added links
const observer = new MutationObserver((mutations) => {
	mutations.forEach((mutation) => {
		if (mutation.type === 'childList') {
			processLinks();
		}
	});
});

observer.observe(document.body, {
	childList: true,
	subtree: true
});