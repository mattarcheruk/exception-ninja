chrome.browserAction.onClicked.addListener(function (tab)
{
    chrome.tabs.sendMessage(tab.id, { text: "hackNSlashExceptions" });
    // chrome.tabs.create({ url: "/overlay.html" });
//     chrome.windows.create({'url': 'overlay.html', 'type': 'popup'}, function(window) {
//    });
});