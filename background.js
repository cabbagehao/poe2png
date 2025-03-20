// 存储所有已注册的content script标签页
let registeredTabs = new Set();

// 存储上次文件修改时间
let lastModified = {};

// 检查文件是否有更新
async function checkForUpdates() {
  const files = [
    'content.js',
    'lib/html2canvas.js'
  ];
  
  let hasUpdates = false;
  
  for (const file of files) {
    try {
      const response = await fetch(chrome.runtime.getURL(file));
      const lastModifiedHeader = response.headers.get('last-modified');
      
      if (lastModifiedHeader !== lastModified[file]) {
        lastModified[file] = lastModifiedHeader;
        hasUpdates = true;
      }
    } catch (err) {
      console.error(`检查文件 ${file} 更新失败:`, err);
    }
  }
  
  if (hasUpdates) {
    console.log('检测到文件更新，重新加载content scripts...');
    const tabs = Array.from(registeredTabs);
    for (const tabId of tabs) {
      await reloadContentScripts(tabId);
    }
  }
}

// 重新加载content scripts
async function reloadContentScripts(tabId) {
  try {
    // 移除旧的content scripts
    await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        // 清理旧的事件监听器
        window.removeEventListener('message', window._poeExporterMessageHandler);
      }
    });

    // 注入新的content scripts
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'lib/html2canvas.js',
        'content.js'
      ]
    });

    console.log(`Content scripts reloaded for tab ${tabId}`);
  } catch (err) {
    console.error(`Failed to reload content scripts for tab ${tabId}:`, err);
  }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('poe.com')) {
    if (!registeredTabs.has(tabId)) {
      registeredTabs.add(tabId);
      await reloadContentScripts(tabId);
    }
  }
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
  registeredTabs.delete(tabId);
});

// 监听扩展更新或安装
chrome.runtime.onInstalled.addListener(async () => {
  // 重新加载所有匹配的标签页
  const tabs = await chrome.tabs.query({ url: '*://*.poe.com/*' });
  for (const tab of tabs) {
    if (tab.id) {
      registeredTabs.add(tab.id);
      await reloadContentScripts(tab.id);
    }
  }
});

// 定期检查文件更新
setInterval(checkForUpdates, 1000); // 每秒检查一次更新 