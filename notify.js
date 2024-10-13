
export function notify(message, type, timeout, buttons, tab_id) {
    if (typeof tab_id === 'undefined') {
        tab_id = false;
    }

    const notificationData = {
        type: "notify",
        notificationType: type,
        message: message,
        timeout: timeout,
        buttons: buttons
    };

    if (tab_id !== false) {
        chrome.tabs.sendMessage(tab_id, notificationData, {}, (response) => {});
    } else {
        chrome.tabs.query({active: true}, (tabs) => {
            const tab = tabs[0];
            if (tab) {
                console.log(tab);
                chrome.tabs.sendMessage(tab.id, notificationData, {}, (response) => {});
            }
        });
    }
}