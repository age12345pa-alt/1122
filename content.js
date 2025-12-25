(function() {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 极简标准化：仅保留核心字符匹配，提升速度
    function normalizeText(s) {
        return (s || '').toString().replace(/[\s\.\、\)\-\]\(（）]/g, '').toLowerCase().trim();
    }

    // 核心点击：模拟全套物理事件序列
    async function smartClick(el) {
        if (!el) return false;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        
        // 视觉高亮反馈
        const oldStyle = el.style.boxShadow;
        el.style.boxShadow = '0 0 10px #00ff88';
        setTimeout(() => el.style.boxShadow = oldStyle, 1000);

        const evts = ['mousedown', 'mouseup', 'click'];
        evts.forEach(evtType => {
            el.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
        });
        
        // 处理隐藏的 radio/checkbox
        const input = el.querySelector('input') || (el.tagName === 'INPUT' ? el : null);
        if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
    }

    // 主执行逻辑：封装异步任务解决 SyntaxError
    async function handleAnswerTask(msg) {
        const answerStr = msg.answer;
        const autoNext = msg.autoNext;

        // 1. 选项识别逻辑 (保持您原有的判断逻辑)
        const parts = answerStr.match(/[A-G]/gi) || [];
        const items = Array.from(document.querySelectorAll('li, label, .answer-item, .TiMu_li, .option, [class*="option"]'));
        let clickedCount = 0;

        for (let part of parts) {
            const normPart = part.toLowerCase().trim();
            let matchedEl = null;
            for (let item of items) {
                const fullText = item.innerText || "";
                // 策略：前缀匹配 A. 或 纯字母匹配
                const prefixRegex = new RegExp(`^\\(?${normPart}[\\.\\、\\s\\)]`, 'i');
                if (prefixRegex.test(fullText.trim()) || normalizeText(fullText) === normPart) {
                    matchedEl = item;
                    break; 
                }
            }
            if (matchedEl) {
                if (await smartClick(matchedEl)) {
                    clickedCount++;
                    await sleep(400); // 提速：缩短多选间隔
                }
            }
        }

        // 2. 跳转逻辑优化：支持“下一题”与“下一步(最后一题)”
        if (clickedCount > 0 && autoNext) {
            console.log("正在检索跳转目标...");
            await sleep(2000); // 提速：缩短跳转前摇

            // 优先级 1: 精准匹配 onclick 函数 (避开上一题)
            let nextBtn = document.querySelector('a[onclick*="getTheNextQuestion(1)"]') || 
                          document.querySelector('a[onclick*="topreview"]'); // 最后一题匹配
            
            // 优先级 2: 文本排他性匹配 (包含“下”或“确定”，严禁包含“上”)
            if (!nextBtn) {
                const candidates = Array.from(document.querySelectorAll('a.jb_btn, a, button, .btn, .next'));
                nextBtn = candidates.find(el => {
                    const txt = (el.innerText || el.value || "").trim();
                    const hasNextWord = (txt.includes('下一题') || txt.includes('下一步') || txt.includes('确认'));
                    return hasNextWord && !txt.includes('上'); // 彻底解决点到上一题
                });
            }

            if (nextBtn) {
                console.log("执行跳转:", nextBtn.innerText || "Next/Submit");
                await smartClick(nextBtn);
            }
        }
        return { ok: clickedCount > 0 };
    }

    // 正确处理异步消息监听
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'clickAnswer') {
            handleAnswerTask(msg).then(sendResponse);
            return true; // 保持异步通信
        }
    });
})();