// sidepanel.js - 图像增强+区域裁剪极速版
(function() {
  // 请在此处填写您的 API 配置
  const BASE_URL = ''; 
  const ENDPOINT = ''; 
  const API_KEY = '';  

  let isRunning = false;
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn'); 
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');
  const autoLoopCb = document.getElementById('autoLoop');

  const updateStatus = (msg) => {
    statusEl.innerText = `> ${msg}`;
  };

  startBtn.addEventListener('click', () => {
    if (!BASE_URL || !API_KEY) {
        updateStatus('错误: 请先在代码中配置 API 信息');
        return;
    }
    isRunning = true;
    startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'block';
    updateStatus('FAST-SCAN ACTIVE...');
    startAutomatedLoop();
  });

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      isRunning = false;
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      updateStatus('TERMINATED.');
    });
  }

  async function startAutomatedLoop() {
    if (!isRunning) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // 1. 获取原始截图 (JPEG格式)
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 }, async (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        setTimeout(startAutomatedLoop, 1500);
        return;
      }

      // 2. 图像预处理：裁剪并增强文字大小
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const sWidth = img.width;
        const sHeight = img.height;
        const cropX = sWidth * 0.2; // 剔除左侧 20%
        const cropW = sWidth * 0.6; // 保留中间 60%

        const targetWidth = 1024;
        const scale = targetWidth / cropW;
        const targetHeight = sHeight * scale;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, cropX, 0, cropW, sHeight, 0, 0, targetWidth, targetHeight);

        const processedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        try {
          updateStatus('AI ANALYZING...');
          
          // 3. 调用 AI 接口
          const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
              model: ENDPOINT,
              max_tokens: 10,
              messages: [{
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: "仅识答案字母（如A或AB）。判断题：对给A，错给B。结束/无题回复END。不要解释。" 
                  },
                  { type: 'image_url', image_url: { url: processedDataUrl } }
                ]
              }]
            })
          });

          const data = await response.json();
          if (data.choices && data.choices.length > 0) {
            const answer = data.choices[0].message.content.trim().toUpperCase();
            resultEl.innerText = `[RESULT]: ${answer}`;

            if (answer.includes('END')) {
              updateStatus('TASK COMPLETE.');
              isRunning = false;
              return;
            }

            // 4. 发送指令执行点击
            chrome.tabs.sendMessage(tab.id, { 
              action: 'clickAnswer', 
              answer: answer, 
              autoNext: autoLoopCb ? autoLoopCb.checked : true 
            }, (res) => {
              if (isRunning && (autoLoopCb ? autoLoopCb.checked : true)) {
                setTimeout(startAutomatedLoop, 2200);
              }
            });
          }
        } catch (err) {
          updateStatus('API 错误，正在重试...');
          setTimeout(startAutomatedLoop, 2000);
        }
      };
      img.src = dataUrl;
    });
  }
})();