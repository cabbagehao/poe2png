// 检查依赖是否加载成功
function checkDependencies() {
  console.log('检查依赖...');
  if (!window.html2canvas) {
    console.error('html2canvas 未加载');
    return false;
  }
  console.log('依赖检查通过');
  return true;
}

// 动态加载 html2pdf
async function loadHtml2PDF() {
  if (window.html2pdf) return window.html2pdf;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.textContent = `
      // 注入 html2pdf 代码
      ${chrome.runtime.getURL('lib/html2pdf.js')}
    `;
    script.onload = () => {
      console.log('html2pdf 加载成功');
      resolve(window.html2pdf);
    };
    script.onerror = (err) => {
      console.error('html2pdf 加载失败:', err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

async function exportToPNG() {
  console.log('开始导出PNG...');
  try {
    // 获取用户设置的对话组数
    const exportCount = parseInt(document.getElementById('poeExportCount').value) || 1;
    console.log('导出对话组数:', exportCount);

    // 获取背景画布和对话容器
    const chatCanvas = document.querySelector('[class^="ChatMessagesScrollWrapper_overflowHiddenWrapper"]');
    if (!chatCanvas) {
      throw new Error('未找到聊天画布');
    }

    // 创建临时容器并保持原有样式
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      background: white;
      width: ${chatCanvas.offsetWidth}px;
      position: relative;
      overflow: visible;
    `;
    
    // 复制画布内容
    const clone = chatCanvas.cloneNode(true);
    
    // 移除不需要的滚动条和遮罩
    clone.style.overflow = 'visible';
    clone.style.maxHeight = 'none';
    
    // 移除不需要的元素
    const elementsToRemove = [
      '[class^="ScrollMask_mask"]',
      '[class^="BotInfoCard_sectionContainer"]',
      '[class^="ChatMessageActionBar_actionBar"]',
      '[class^="ChatMessageFollowupActions_container"]'
    ];
    
    elementsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // 过滤对话消息，只保留最后x组对话
    const messages = Array.from(clone.querySelectorAll('[class^="ChatMessage_chatMessage"]'));
    const keepCount = exportCount * 2; // 每组对话包含用户和AI的消息
    if (messages.length > keepCount) {
      messages.slice(0, -keepCount).forEach(msg => msg.remove());
    }
    
    tempContainer.appendChild(clone);
    
    // 添加上下边距
    tempContainer.style.cssText += `
      padding: 40px 0;
    `;
    
    // 临时添加到文档中以便截图
    document.body.appendChild(tempContainer);

    const canvas = await html2canvas(tempContainer, {
      backgroundColor: 'white',
      scale: 2, // 提高清晰度
      useCORS: true, // 允许加载跨域图片
      logging: false,
      windowWidth: chatCanvas.offsetWidth,
      windowHeight: chatCanvas.scrollHeight
    });

    // 移除临时容器
    document.body.removeChild(tempContainer);

    const link = document.createElement('a');
    link.download = `poe-chat-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    console.log('PNG导出成功');
  } catch (err) {
    console.error('PNG导出失败:', err);
  }
}

async function exportToPDF() {
  console.log('开始导出PDF...');
  try {
    // 获取用户设置的对话组数
    const exportCount = parseInt(document.getElementById('poeExportCount').value) || 1;
    console.log('导出对话组数:', exportCount);

    // 确保 html2pdf 已加载
    if (!window.html2pdf) {
      await loadHtml2PDF();
    }
    if (!window.html2pdf) {
      throw new Error('html2pdf 加载失败');
    }

    // 获取聊天容器
    const chatContainer = document.querySelector('[class^="ChatMessagesScrollWrapper_overflowHiddenWrapper"]');
    if (!chatContainer) {
      throw new Error('未找到聊天容器');
    }

    // 使用实际容器宽度而非固定宽度，像PNG导出一样
    const containerWidth = chatContainer.offsetWidth;
    console.log('实际容器宽度:', containerWidth);
    
    // 创建临时容器
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      background: white;
      width: ${containerWidth}px;
      position: relative;
      overflow: visible;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #000000;
      box-sizing: border-box;
    `;

    // 复制聊天内容
    const clone = chatContainer.cloneNode(true);
    
    // 移除不需要的元素
    const elementsToRemove = [
      '[class^="ScrollMask_mask"]',
      '[class^="BotInfoCard_sectionContainer"]',
      '[class^="ChatMessageActionBar_actionBar"]',
      '[class^="ChatMessageFollowupActions_container"]'      
    ];
    
    elementsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // 过滤对话消息，只保留最后x组对话
    const messages = Array.from(clone.querySelectorAll('[class^="ChatMessage_chatMessage"]'));
    const keepCount = exportCount * 2; // 每组对话包含用户和AI的消息
    if (messages.length > keepCount) {
      messages.slice(0, -keepCount).forEach(msg => msg.remove());
    }
    
    // 修改样式
    clone.style.cssText = `
      overflow: visible;
      max-height: none;
      height: auto;
      width: 100%;
      box-sizing: border-box;
      padding: 0;
    `;
    
    // 处理消息样式
    clone.querySelectorAll('[class^="ChatMessage_chatMessage"]').forEach((msg, index) => {
      msg.style.cssText = `
        margin-bottom: 20px;
        padding: 12px 24px;
        background: ${index % 2 ? '#f8f9fa' : 'white'};
        border-radius: 8px;
        page-break-inside: avoid;
        width: 100%;
        box-sizing: border-box;
      `;

      // 确保消息内容不会溢出
      const content = msg.querySelector('[class^="Markdown_markdownContainer"]');
      if (content) {
        content.style.cssText = `
          white-space: normal;
          word-break: break-word;
          overflow-wrap: break-word;
          font-size: 16px;
          line-height: 24px;
          max-width: 100%;
        `;
       
        // 处理代码块
        content.querySelectorAll('pre').forEach(pre => {
          pre.style.cssText = `
            max-width: 100%;
            overflow-x: hidden;
            white-space: pre-wrap;
            font-family: monospace;
            background-color: rgb(247, 247, 247);
            border-radius: 8px;
            padding: 16px;
            margin: 8px 0;
          `;
        });

        // 处理内联代码
        content.querySelectorAll('code:not(pre code)').forEach(code => {
          code.style.cssText = `
            font-family: monospace;
            background-color: rgb(247, 247, 247);
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 0.9em;
          `;
        });

        // 处理段落
        content.querySelectorAll('p').forEach(p => {
          p.style.cssText = `
            margin: 0;
            padding: 0;
            white-space: normal;
            max-width: 100%;
          `;
        });
        
        // 处理图片
        content.querySelectorAll('img').forEach(img => {
          img.style.cssText = `
            max-width: 100%;
            height: auto;
            display: block;
            margin: 8px 0;
          `;
        });
        
        // 处理表格
        content.querySelectorAll('table').forEach(table => {
          table.style.cssText = `
            max-width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 14px;
            border: 1px solid #ddd;
          `;
        });
      }

      // 消息头像选择器
      const avatarContainer = msg.querySelector('[class^="ChatMessageAvatar_avatarContainer"]');

      // 消息内容选择器
      const messageContent = msg.querySelector('[class^="ChatMessage_messageContent"]');
      if (messageContent) {
        messageContent.style.cssText = `
          max-width: 100%;
          width: 100%;
        `;
      }

      // 消息容器选择器
      const chatMessage = msg.querySelector('[class^="ChatMessage_chatMessage"]');

      // Markdown容器选择器
      const markdownContainer = msg.querySelector('[class^="Markdown_markdownContainer"]');
    });
    
    tempContainer.appendChild(clone);
    
    document.body.appendChild(tempContainer);
    console.log('临时容器已添加到文档');

    // 确定适合的PDF格式
    let pdfFormat;
    if (containerWidth > 595) { // A4宽度为595pt
      pdfFormat = [containerWidth + 60, Math.round((containerWidth + 60) * 1.414)]; // A4比例 1:1.414
    } else {
      pdfFormat = 'a4';
    }
    console.log('使用PDF格式:', pdfFormat);

    // 使用html2pdf导出
    const opt = {
      margin: [40, 30, 40, 30],
      filename: `poe-chat-${new Date().toISOString()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#ffffff',
        width: containerWidth,
        windowWidth: containerWidth,
        height: Math.max(tempContainer.scrollHeight, tempContainer.offsetHeight),
        onclone: function(clonedDoc) {
          // 在克隆的文档中应用额外的样式修复
          const style = clonedDoc.createElement('style');
          style.textContent = `
            [class^="Markdown_markdownContainer"] {
              white-space: normal !important;
              word-break: break-word !important;
              overflow-wrap: break-word !important;
              max-width: 100% !important;
            }
            [class^="Markdown_markdownContainer"] p {
              white-space: normal !important;
              max-width: 100% !important;
            }
            [class^="Markdown_markdownContainer"] pre {
              white-space: pre-wrap !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
            }
            [class^="ChatMessage_messageContent"] {
              max-width: 100% !important;
              width: 100% !important;
            }
            img, svg {
              max-width: 100% !important;
              height: auto !important;
            }
            table {
              max-width: 100% !important;
              display: block;
              overflow-x: auto;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      },
      jsPDF: {
        unit: 'pt',
        format: pdfFormat,
        orientation: 'portrait',
        hotfixes: ['px_scaling']
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await window.html2pdf().set(opt).from(tempContainer).save();

    document.body.removeChild(tempContainer);
    console.log('PDF导出成功');

  } catch (err) {
    console.error('PDF导出失败:', err);
    console.error('错误详情:', err.stack);
  }
}

// 创建导出菜单
function createExporterMenu() {
  console.log('开始创建导出菜单...');
  
  // 注入样式
  const style = document.createElement('style');
  style.textContent = `
    .poe-exporter-menu {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 9999;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.95;
      border: 1px solid rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(8px);
    }

    .poe-exporter-menu.collapsed {
      width: 48px;
      height: 48px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.95);
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .poe-exporter-menu.expanded {
      width: 140px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.98);
      height: auto;
      display: block;
    }

    .poe-exporter-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      position: relative;
    }

    .poe-exporter-input-group {
      display: none;
      align-items: center;
      font-size: 13px;
      color: #444;
      margin: 0;
      padding: 0 4px;
      gap: 4px;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 6px 8px;
    }

    .expanded .poe-exporter-input-group {
      display: flex;
    }

    .poe-exporter-select {
      width: 40px;
      padding: 4px;
      margin: 0 2px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      text-align: center;
      font-size: 13px;
      background: white;
      transition: all 0.2s ease;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23666' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 4px center;
      padding-right: 16px;
      color: #444;
    }

    .poe-exporter-select:focus {
      outline: none;
      border-color: #4A90E2;
      box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
    }

    .poe-exporter-select:hover {
      border-color: #999;
      background-color: #fafafa;
    }

    .poe-exporter-toggle {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      background: none;
      padding: 0;
      color: #666;
      border-radius: 12px;
      transition: all 0.2s ease;
    }

    .expanded .poe-exporter-toggle {
      position: absolute;
      top: -8px;
      right: -8px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 50%;
      width: 32px;
      height: 32px;
    }

    .poe-exporter-toggle img {
      width: 24px;
      height: 24px;
      transition: all 0.3s ease;
      opacity: 0.8;
    }

    .collapsed .poe-exporter-toggle img {
      width: 44px;
      height: 44px;
      opacity: 0.9;
    }

    .poe-exporter-toggle:hover img {
      opacity: 1;
    }

    .poe-exporter-buttons {
      display: none;
      flex-direction: column;
      gap: 8px;
    }

    .expanded .poe-exporter-buttons {
      display: flex;
    }

    .poe-exporter-button {
      padding: 10px 16px;
      border: none;
      border-radius: 10px;
      background: #f8f9fa;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 13px;
      font-weight: 500;
      color: #444;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .poe-exporter-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0));
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .poe-exporter-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .poe-exporter-button:hover::before {
      opacity: 1;
    }

    .poe-exporter-button:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .poe-exporter-button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
      transform: none;
      box-shadow: none;
    }

    #poeExportPNG {
      background: linear-gradient(135deg, #4A90E2, #357ABD);
      color: white;
    }

    #poeExportPNG:hover {
      background: linear-gradient(135deg, #357ABD, #2A6CAD);
    }

    #poeExportPDF {
      background: linear-gradient(135deg, #6C757D, #5A6268);
      color: white;
    }

    #poeExportPDF:hover {
      background: linear-gradient(135deg, #5A6268, #4A5258);
    }

    .progress-bar {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px;
      width: 0%;
      background: rgba(255, 255, 255, 0.4);
      transition: width 0.3s ease;
      border-radius: 0 0 10px 10px;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
    }

    .button-text {
      position: relative;
      z-index: 1;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .button-text::before {
      content: '';
      display: inline-block;
      width: 18px;
      height: 18px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.95;
    }

    #poeExportPNG .button-text::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z'/%3E%3C/svg%3E");
    }

    #poeExportPDF .button-text::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z'/%3E%3C/svg%3E");
    }

    @media (hover: hover) {
      .poe-exporter-menu {
        opacity: 0.9;
      }
      .poe-exporter-menu:hover {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  console.log('样式已注入');

  // 从localStorage获取菜单状态
  const isCollapsed = localStorage.getItem('poeExporterMenuCollapsed') === 'true';
  
  const menuHTML = `
    <div class="poe-exporter-menu ${isCollapsed ? 'collapsed' : 'expanded'}">
      <div class="poe-exporter-header">
        <div class="poe-exporter-input-group">
          <label>Last</label>
          <select class="poe-exporter-select" id="poeExportCount">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
          </select>
          <label>pairs</label>
        </div>
        <button class="poe-exporter-toggle" data-tooltip="Toggle">
          <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="Toggle menu">
        </button>
      </div>
      <div class="poe-exporter-buttons">
        <button class="poe-exporter-button" id="poeExportPNG">
          <span class="button-text">Export PNG</span>
          <div class="progress-bar"></div>
        </button>
        <button class="poe-exporter-button" id="poeExportPDF">
          <span class="button-text">Export PDF</span>
          <div class="progress-bar"></div>
        </button>
      </div>
    </div>
  `;

  // 注入菜单
  const menuContainer = document.createElement('div');
  menuContainer.innerHTML = menuHTML;
  document.body.appendChild(menuContainer.firstElementChild);
  console.log('菜单已注入');

  // 添加事件监听
  const menu = document.querySelector('.poe-exporter-menu');
  if (!menu) {
    console.error('未找到菜单元素');
    return;
  }
  console.log('找到菜单元素');
  
  const toggle = menu.querySelector('.poe-exporter-toggle');
  const pngButton = document.getElementById('poeExportPNG');
  const pdfButton = document.getElementById('poeExportPDF');

  toggle.addEventListener('click', () => {
    const willCollapse = menu.classList.contains('expanded');
    menu.classList.toggle('collapsed');
    menu.classList.toggle('expanded');
    // 保存菜单状态到localStorage
    localStorage.setItem('poeExporterMenuCollapsed', willCollapse);
  });

  // 从localStorage获取并恢复选择框的值
  const savedCount = localStorage.getItem('poeExporterCount');
  if (savedCount && ['1', '2', '3'].includes(savedCount)) {
    document.getElementById('poeExportCount').value = savedCount;
  } else {
    document.getElementById('poeExportCount').value = '2'; // 默认值
    localStorage.setItem('poeExporterCount', '2');
  }

  // 监听选择框值的变化并保存
  document.getElementById('poeExportCount').addEventListener('change', (e) => {
    localStorage.setItem('poeExporterCount', e.target.value);
  });

  pngButton.addEventListener('click', async () => {
    pngButton.disabled = true;
    const buttonText = pngButton.querySelector('.button-text');
    const progressBar = pngButton.querySelector('.progress-bar');
    buttonText.textContent = 'Preparing...';
    progressBar.style.width = '0%';

    try {
      // 模拟进度更新
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 3;
        if (progress <= 90) {
          progressBar.style.width = `${progress}%`;
          buttonText.textContent = `${progress}%`;
        }
      }, 150);

      await exportToPNG();

      // 完成时显示100%
      clearInterval(progressInterval);
      progressBar.style.transition = 'width 0.3s ease';
      progressBar.style.width = '100%';
      buttonText.textContent = 'Done!';
      
      // 1秒后重置按钮状态
      setTimeout(() => {
        progressBar.style.transition = 'width 0.2s ease';
        progressBar.style.width = '0%';
        buttonText.textContent = 'Export PNG';
        pngButton.disabled = false;
      }, 1000);
    } catch (err) {
      clearInterval(progressInterval);
      progressBar.style.transition = 'width 0.3s ease';
      progressBar.style.width = '0%';
      buttonText.textContent = 'Failed';
      setTimeout(() => {
        progressBar.style.transition = 'width 0.2s ease';
        buttonText.textContent = 'Export PNG';
        pngButton.disabled = false;
      }, 1000);
      console.error('PNG导出失败:', err);
    }
  });

  pdfButton.addEventListener('click', async () => {
    pdfButton.disabled = true;
    const buttonText = pdfButton.querySelector('.button-text');
    const progressBar = pdfButton.querySelector('.progress-bar');
    buttonText.textContent = 'Preparing...';
    progressBar.style.width = '0%';

    try {
      // 模拟进度更新
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 3;
        if (progress <= 90) {
          progressBar.style.width = `${progress}%`;
          buttonText.textContent = `${progress}%`;
        }
      }, 150);

      await exportToPDF();

      // 完成时显示100%
      clearInterval(progressInterval);
      progressBar.style.transition = 'width 0.3s ease';
      progressBar.style.width = '100%';
      buttonText.textContent = 'Done!';
      
      // 1秒后重置按钮状态
      setTimeout(() => {
        progressBar.style.transition = 'width 0.2s ease';
        progressBar.style.width = '0%';
        buttonText.textContent = 'Export PDF';
        pdfButton.disabled = false;
      }, 1000);
    } catch (err) {
      clearInterval(progressInterval);
      progressBar.style.transition = 'width 0.3s ease';
      progressBar.style.width = '0%';
      buttonText.textContent = 'Failed';
      setTimeout(() => {
        progressBar.style.transition = 'width 0.2s ease';
        buttonText.textContent = 'Export PDF';
        pdfButton.disabled = false;
      }, 1000);
      console.error('PDF导出失败:', err);
    }
  });
}

// 检查DOM是否准备好
function isDOMReady() {
  return document.querySelector('[class^="ChatMessagesScrollWrapper_overflowHiddenWrapper"]') !== null;
}

// 初始化导出菜单
function initExporter() {
  console.log('开始初始化导出器...');
  
  // 如果DOM还没准备好，等待并重试
  if (!isDOMReady()) {
    console.log('DOM未就绪，等待重试...');
    setTimeout(initExporter, 1000);
    return;
  }

  // 检查是否已存在导出菜单
  if (document.querySelector('.poe-exporter-menu')) {
    console.log('导出菜单已存在');
    return;
  }

  // 检查依赖
  if (!checkDependencies()) {
    console.error('依赖检查失败，1秒后重试');
    setTimeout(initExporter, 1000);
    return;
  }

  // 创建导出菜单
  createExporterMenu();
}

// 监听页面变化，确保在导航后重新创建菜单
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      // 检查菜单是否存在，不存在则初始化
      if (!document.querySelector('.poe-exporter-menu')) {
        initExporter();
        break;
      }
    }
  }
});

// 开始观察页面变化
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初始化
(async function init() {
  try {
    await loadHtml2PDF();
    initExporter();
  } catch (err) {
    console.error('初始化失败:', err);
    // 失败后重试
    setTimeout(init, 1000);
  }
})();

// 在页面卸载时清理observer
window.addEventListener('unload', () => {
  observer.disconnect();
});

// 存储消息处理器引用以便后续清理
window._poeExporterMessageHandler = async (event) => {
  if (event.source !== window) return;

  console.log('收到消息:', event.data);
  
  if (!checkDependencies()) {
    console.error('依赖检查失败，无法执行导出');
    return;
  }

  if (event.data.type === 'EXPORT_PNG') {
    await exportToPNG();
  } else if (event.data.type === 'EXPORT_PDF') {
    await exportToPDF();
  }
};

// 添加消息监听器
window.addEventListener('message', window._poeExporterMessageHandler); 