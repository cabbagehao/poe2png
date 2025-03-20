document.getElementById('exportPNG').addEventListener('click', () => {
  console.log('点击了PNG导出按钮');
  const button = document.getElementById('exportPNG');
  button.disabled = true;
  button.textContent = '导出中...';
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0]?.id) {
      console.error('未能获取当前标签页');
      button.disabled = false;
      button.textContent = '导出为PNG';
      return;
    }
    
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: () => {
        // 通过消息传递调用content script中的方法
        window.postMessage({type: 'EXPORT_PNG'}, '*');
      }
    }).catch(err => {
      console.error('执行脚本失败:', err);
      button.disabled = false;
      button.textContent = '导出为PNG';
    });
  });
});

document.getElementById('exportPDF').addEventListener('click', () => {
  console.log('点击了PDF导出按钮');
  const button = document.getElementById('exportPDF');
  button.disabled = true;
  button.textContent = '导出中...';
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0]?.id) {
      console.error('未能获取当前标签页');
      button.disabled = false;
      button.textContent = '导出为PDF';
      return;
    }

    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: () => {
        window.postMessage({type: 'EXPORT_PDF'}, '*');
      }
    }).catch(err => {
      console.error('执行脚本失败:', err);
      button.disabled = false;
      button.textContent = '导出为PDF';
    });
  });
}); 