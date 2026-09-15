chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractWrongQuestionsAndOpenTab,
    });
  } catch (error) {
    console.error('提取错题失败', error);
  }
});

function extractWrongQuestionsAndOpenTab() {
  const doc = document.implementation.createHTMLDocument(
    document.title + ' - 错题重练'
  );
  doc.documentElement.innerHTML = document.documentElement.outerHTML;

  // 生成静态错题页：移除原页面脚本，避免再次执行站点逻辑导致运行时异常。
  doc.querySelectorAll('script').forEach((s) => s.remove());
  doc.querySelectorAll('link[rel="modulepreload"]').forEach((l) => l.remove());

  // 修正 base，保证在 blob 新标签中仍能加载原页面的相对资源。
  let base = doc.querySelector('base');
  if (!base) {
    base = doc.createElement('base');
    doc.head.insertBefore(base, doc.head.firstChild);
  }
  base.setAttribute('href', location.href);

  // 仅保留错题对应的 app-ti
  const allQuestions = Array.from(
    doc.querySelectorAll('app-ti.question-multiple')
  );
  let wrongCount = 0;
  let wrongbookQuestionIndex = 0;
  allQuestions.forEach((questionItem) => {
    const wrongContainer = questionItem.querySelector('.ti-container.wrong');
    if (!wrongContainer) {
      questionItem.remove();
      return;
    }

    wrongCount += 1;
    wrongbookQuestionIndex += 1;

    const titleIndex = questionItem.querySelector('.title-index');
    const questionNo =
      titleIndex?.textContent?.replace(/[^\d]/g, '') ||
      String(wrongbookQuestionIndex);
    questionItem.setAttribute('data-wrongbook-qno', questionNo);
    questionItem.id = 'wrongbook-q-' + questionNo;

    // 去掉选项正确/错误高亮，恢复为可重做状态
    const optionBadges = questionItem.querySelectorAll('.input-radio');
    optionBadges.forEach((badge) => {
      badge.classList.remove('correct');
      badge.classList.remove('wrong');
      badge.classList.remove('correctLost');
    });

    const optionInputs = questionItem.querySelectorAll('input[type="radio"]');
    const radioGroupName = 'wrongbook-single-' + wrongbookQuestionIndex;
    optionInputs.forEach((input) => {
      input.removeAttribute('disabled');
      input.checked = false;
      input.setAttribute('name', radioGroupName);
    });

    // 默认隐藏正确答案与解析，点击按钮再展开
    const overall = questionItem.querySelector('.question-overall-container');
    if (overall) {
      overall.style.display = 'none';
    }

    const resultCommon = questionItem.querySelector('app-result-common');
    if (resultCommon) {
      resultCommon.style.display = 'none';
    }

    const solutionChoiceContainer = questionItem.querySelector(
      '.solution-choice-container'
    );
    if (solutionChoiceContainer) {
      solutionChoiceContainer
        .querySelectorAll('.wrongbook-toggle-btn, .copy-content-btn')
        .forEach((btn) => btn.remove());

      const toggleBtn = doc.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'wrongbook-toggle-btn';
      toggleBtn.textContent = '展开答案和解析';
      toggleBtn.setAttribute('data-expanded', 'false');

      const copyBtn = doc.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-content-btn';
      copyBtn.textContent = '复制题目内容';

      solutionChoiceContainer.insertBefore(
        toggleBtn,
        solutionChoiceContainer.firstChild
      );
      solutionChoiceContainer.insertBefore(copyBtn, toggleBtn.nextSibling);
    }
  });

  // 删掉没有错题的题组容器与锚点
  const questionGroups = Array.from(
    doc.querySelectorAll('.questions-container')
  );
  questionGroups.forEach((group) => {
    const remainWrong = group.querySelectorAll('app-ti.question-multiple');
    if (!remainWrong.length) {
      const anchors =
        group.parentElement?.querySelectorAll('.questions-anchors');
      anchors?.forEach((a) => a.remove());
      group.closest('.right-part')?.remove();
      group.remove();
    }
  });

  // 隐藏成绩总览和答题卡，聚焦错题重练
  doc
    .querySelectorAll('app-report-overall, app-answer-card')
    .forEach((el) => el.remove());

  if (!wrongCount) {
    window.alert('未检测到错题，当前页面可能不是已作答结果页。');
    return;
  }

  // 标题提示
  const title = doc.querySelector('title');
  if (title) {
    title.textContent = title.textContent + ' - 错题重练';
  }

  doc.documentElement.classList.add('wrongbook-font-plus');

  // 注入最小功能脚本和样式，尽量不改变原页面视觉
  const helperStyle = doc.createElement('style');
  helperStyle.textContent = `
    .wrongbook-font-plus .content,
    .wrongbook-font-plus .content p,
    .wrongbook-font-plus .content span,
    .wrongbook-font-plus .input-text,
    .wrongbook-font-plus .title-index,
    .wrongbook-font-plus .title-type-name,
    .wrongbook-font-plus .overall-item-title,
    .wrongbook-font-plus .overall-item-value,
    .wrongbook-font-plus .wrongbook-toolbar,
    .wrongbook-font-plus .wrongbook-toggle-btn,
    .wrongbook-font-plus .copy-content-btn,
    .wrongbook-font-plus .wrongbook-card-toggle,
    .wrongbook-font-plus .wrongbook-answer-card-header,
    .wrongbook-font-plus .wrongbook-answer-chip,
    .wrongbook-font-plus .wrongbook-draft-btn {
      font-size: calc(1em + 2px) !important;
    }
    .wrongbook-toolbar {
      margin: 20px 38px 0;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--color-bg-section, #fff);
      color: var(--color-text-primary, #1f2430);
      border: 1px solid var(--color-border-section, #e6e8ee);
      font-size: 14px;
      line-height: 20px;
    }
    .wrongbook-toggle-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid var(--color-text-blue, #2e62f5);
      background: var(--color-bg-section, #fff);
      color: var(--color-text-blue, #2e62f5);
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 12px;
      margin-right: 10px;
      transition: all 0.15s ease;
    }
    .wrongbook-toggle-btn:hover {
      color: #ffffff;
      background: var(--color-text-blue, #2e62f5);
      box-shadow: 0 6px 14px rgba(46, 98, 245, 0.25);
      transform: translateY(-1px);
    }
    .wrongbook-toggle-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(46, 98, 245, 0.2);
    }
    .wrongbook-toggle-btn.is-open {
      color: #ffffff;
      background: var(--color-text-blue, #2e62f5);
    }
    .copy-content-btn {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      height: 32px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid var(--color-border-section, #dfe3ec);
      background: var(--color-bg-section, #fff);
      color: var(--color-text-primary, #1f2430);
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 12px;
      transition: all 0.15s ease;
    }
    .copy-content-btn:hover {
      border-color: var(--color-text-blue, #2e62f5);
      color: var(--color-text-blue, #2e62f5);
      box-shadow: 0 6px 14px rgba(46, 98, 245, 0.18);
      transform: translateY(-1px);
    }
    .copy-content-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(46, 98, 245, 0.14);
    }
    .copy-content-btn.copied {
      border-color: #19a15f;
      color: #19a15f;
    }
    .wrongbook-draft-panel {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: none;
      background: transparent;
    }
    .wrongbook-draft-panel.open {
      display: block;
    }
    .wrongbook-draft-actions {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 100000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #b8c2d6;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(4px);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
    }
    .wrongbook-draft-btn {
      border: 1px solid var(--color-border-section, #dfe3ec);
      border-radius: 6px;
      background: var(--color-bg-section, #ffffff);
      color: var(--color-text-primary, #1f2430);
      font-size: 13px;
      font-weight: 700;
      height: 32px;
      padding: 0 12px;
      cursor: pointer;
    }
    .wrongbook-draft-btn:hover {
      filter: brightness(0.98);
    }
    .wrongbook-draft-btn[data-action="clear"] {
      border-color: #efc161;
      background: #fff4d6;
      color: #8a5a00;
    }
    .wrongbook-draft-btn[data-action="clear"]:hover {
      background: #ffe8b0;
    }
    .wrongbook-draft-btn[data-action="close"] {
      border-color: #2e62f5;
      background: #2e62f5;
      color: #ffffff;
    }
    .wrongbook-draft-btn[data-action="close"]:hover {
      background: #1f52df;
      border-color: #1f52df;
    }
    .wrongbook-draft-canvas {
      position: fixed;
      inset: 0;
      display: block;
      width: 100vw;
      height: 100vh;
      background: transparent;
      cursor: crosshair;
      touch-action: none;
    }
    .wrongbook-card-toggle {
      position: fixed;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      z-index: 99998;
      height: 40px;
      min-width: 180px;
      padding: 0 16px;
      border: 1px solid var(--color-border-section, #dfe3ec);
      border-bottom: none;
      border-radius: 10px 10px 0 0;
      background: var(--color-bg-section, #ffffff);
      color: var(--color-text-primary, #1f2430);
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
    }
    .wrongbook-card-toggle:hover {
      color: var(--color-text-blue, #2e62f5);
    }
    .wrongbook-answer-card {
      position: fixed;
      left: 50%;
      bottom: 0;
      transform: translate(-50%, 100%);
      z-index: 99997;
      width: min(960px, calc(100vw - 24px));
      max-height: 42vh;
      border: 1px solid var(--color-border-section, #dfe3ec);
      border-radius: 12px 12px 0 0;
      background: var(--color-bg-section, #ffffff);
      box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
      transition: transform 0.2s ease;
      overflow: hidden;
    }
    .wrongbook-answer-card.open {
      transform: translate(-50%, 0);
    }
    .wrongbook-answer-card-header {
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      border-bottom: 1px solid var(--color-border-section, #dfe3ec);
      color: var(--color-text-primary, #1f2430);
      font-size: 14px;
    }
    .wrongbook-answer-card-close {
      border: 1px solid var(--color-border-section, #dfe3ec);
      background: var(--color-bg-body, #f6f8fb);
      color: var(--color-text-primary, #1f2430);
      height: 28px;
      border-radius: 6px;
      padding: 0 10px;
      cursor: pointer;
    }
    .wrongbook-answer-card-list {
      padding: 12px 14px 16px;
      overflow: auto;
      max-height: calc(42vh - 46px);
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .wrongbook-answer-chip {
      width: 46px;
      height: 32px;
      border: 1px solid var(--color-border-section, #dfe3ec);
      background: var(--color-bg-body, #f6f8fb);
      color: var(--color-text-primary, #1f2430);
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
    }
    .wrongbook-answer-chip:hover {
      border-color: var(--color-text-blue, #2e62f5);
      color: var(--color-text-blue, #2e62f5);
      background: var(--color-bg-section, #ffffff);
    }
  `;
  doc.head.appendChild(helperStyle);

  const toolbar = doc.createElement('div');
  toolbar.className = 'wrongbook-toolbar';
  toolbar.textContent =
    '仅保留错题，答案与解析默认隐藏。请先作答，再点击“展开答案和解析”。';
  const solutionMain = doc.querySelector('.solution-main');
  if (solutionMain) {
    solutionMain.insertBefore(toolbar, solutionMain.firstChild);
  }

  const helperScript = doc.createElement('script');
  helperScript.textContent = `
    (function initWrongbookAnswerCard() {
      const questionItems = Array.from(document.querySelectorAll("app-ti.question-multiple"));
      if (!questionItems.length) {
        return;
      }

      const numbers = questionItems.map((item, idx) => {
        const no = item.getAttribute("data-wrongbook-qno") || String(idx + 1);
        if (!item.id) {
          item.id = "wrongbook-q-" + no;
        }
        return no;
      });

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "wrongbook-card-toggle";
      toggle.textContent = "答题卡";

      const card = document.createElement("div");
      card.className = "wrongbook-answer-card";

      const header = document.createElement("div");
      header.className = "wrongbook-answer-card-header";
      header.innerHTML =
        '<span>快速定位（共 ' + numbers.length + ' 题）</span>' +
        '<button type="button" class="wrongbook-answer-card-close">收起</button>';

      const list = document.createElement("div");
      list.className = "wrongbook-answer-card-list";
      list.innerHTML = numbers
        .map((no) => {
          return '<button type="button" class="wrongbook-answer-chip" data-qno="' + no + '">' + no + '</button>';
        })
        .join("");

      card.appendChild(header);
      card.appendChild(list);
      document.body.appendChild(card);
      document.body.appendChild(toggle);

      function closeCard() {
        card.classList.remove("open");
      }

      function openCard() {
        card.classList.add("open");
      }

      toggle.addEventListener("click", function () {
        if (card.classList.contains("open")) {
          closeCard();
        } else {
          openCard();
        }
      });

      card.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (target.classList.contains("wrongbook-answer-card-close")) {
          closeCard();
          return;
        }

        const chip = target.closest(".wrongbook-answer-chip");
        if (!chip) {
          return;
        }

        const qno = chip.getAttribute("data-qno");
        if (!qno) {
          return;
        }

        const dest = document.getElementById("wrongbook-q-" + qno);
        if (!dest) {
          return;
        }

        dest.scrollIntoView({ behavior: "smooth", block: "start" });
        closeCard();
      });
    })();

    (function initWrongbookDraftPanel() {
      const hasDraftEntry = !!document.querySelector(".draft.tool");
      if (!hasDraftEntry) {
        return;
      }

      const panel = document.createElement("div");
      panel.className = "wrongbook-draft-panel";
      panel.innerHTML = [
        '<canvas class="wrongbook-draft-canvas"></canvas>',
        '<div class="wrongbook-draft-actions">',
        '  <button type="button" class="wrongbook-draft-btn" data-action="clear">清空</button>',
        '  <button type="button" class="wrongbook-draft-btn" data-action="close">关闭</button>',
        '</div>'
      ].join("");

      document.body.appendChild(panel);

      const canvas = panel.querySelector(".wrongbook-draft-canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#2e62f5";

      function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = Math.max(1, Math.floor(w * dpr));
        canvas.height = Math.max(1, Math.floor(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#2e62f5";
      }

      function getPoint(evt) {
        const rect = canvas.getBoundingClientRect();
        const clientX = evt.clientX;
        const clientY = evt.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return { x: x, y: y };
      }

      let drawing = false;

      function startDraw(evt) {
        evt.preventDefault();
        drawing = true;
        if (canvas.setPointerCapture && typeof evt.pointerId === "number") {
          canvas.setPointerCapture(evt.pointerId);
        }
        const p = getPoint(evt);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      }

      function moveDraw(evt) {
        if (!drawing) {
          return;
        }
        evt.preventDefault();
        const p = getPoint(evt);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      function endDraw(evt) {
        if (canvas.releasePointerCapture && evt && typeof evt.pointerId === "number") {
          try {
            canvas.releasePointerCapture(evt.pointerId);
          } catch (_) {}
        }
        drawing = false;
      }

      canvas.addEventListener("pointerdown", startDraw);
      canvas.addEventListener("pointermove", moveDraw);
      canvas.addEventListener("pointerup", endDraw);
      canvas.addEventListener("pointerleave", endDraw);
      canvas.addEventListener("pointercancel", endDraw);

      document.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const draftTool = target.closest(".draft.tool");
        if (draftTool) {
          resizeCanvas();
          panel.classList.add("open");
          return;
        }

        if (target.classList.contains("wrongbook-draft-btn")) {
          const action = target.getAttribute("data-action");
          if (action === "clear") {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
          }
          if (action === "close") {
            panel.classList.remove("open");
          }
        }
      });

      window.addEventListener("resize", function () {
        if (panel.classList.contains("open")) {
          resizeCanvas();
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && panel.classList.contains("open")) {
          panel.classList.remove("open");
        }
      });
    })();

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.classList.contains("wrongbook-toggle-btn")) {
        return;
      }

      const container = target.closest(".solution-choice-container");
      if (!container) {
        return;
      }

      const root = target.closest("app-ti");
      if (!root) {
        return;
      }

      const overall = root.querySelector(".question-overall-container");
      const resultCommon = root.querySelector("app-result-common");
      const expanded = target.getAttribute("data-expanded") === "true";

      if (expanded) {
        if (overall) overall.style.display = "none";
        if (resultCommon) resultCommon.style.display = "none";
        target.setAttribute("data-expanded", "false");
        target.textContent = "展开答案和解析";
        target.classList.remove("is-open");
      } else {
        if (overall) overall.style.display = "";
        if (resultCommon) resultCommon.style.display = "";
        target.setAttribute("data-expanded", "true");
        target.textContent = "收起答案和解析";
        target.classList.add("is-open");
      }
    });

    function getReadableText(node) {
      if (!node) {
        return "";
      }
      return (node.innerText || node.textContent || "").replace(/\u00a0/g, " ");
    }

    function normalizeMultilineText(text) {
      return text
        .replace(/\\r\\n?/g, "\\n")
        .split("\\n")
        .map((line) => line.replace(/[ \\t\u3000]+/g, " ").trim())
        .join("\\n")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();
    }

    function normalizeSingleLineText(text) {
      return normalizeMultilineText(text).replace(/\\n+/g, " ").trim();
    }

    function buildQuestionCopyText(root) {
      const stemNode = root.querySelector("app-question-choice .question-choice-container app-format-html");
      const stem = normalizeMultilineText(getReadableText(stemNode));
      const optionNodes = Array.from(root.querySelectorAll("app-choice-radio .choice-radio-label"));
      const options = optionNodes.map((label) => {
        const key = normalizeSingleLineText(getReadableText(label.querySelector(".input-radio")));
        const value = normalizeSingleLineText(getReadableText(label.querySelector(".input-text")));
        return (key && value) ? (key + ". " + value) : "";
      }).filter(Boolean);

      const blocks = [];
      if (stem) {
        blocks.push(stem);
      }
      if (options.length) {
        blocks.push(options.join("\\n"));
      }
      return normalizeMultilineText(blocks.join("\\n\\n"));
    }

    async function copyText(text) {
      if (!text) {
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.pointerEvents = "none";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      }
    }

    document.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const copyBtn = target.closest(".copy-content-btn");
      if (!copyBtn) {
        return;
      }

      const root = copyBtn.closest("app-ti");
      if (!root) {
        return;
      }

      const text = buildQuestionCopyText(root);
      const success = await copyText(text);

      if (success) {
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "已复制";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = oldText || "复制题目内容";
          copyBtn.classList.remove("copied");
        }, 1200);
      } else {
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "复制失败";
        setTimeout(() => {
          copyBtn.textContent = oldText || "复制题目内容";
        }, 1200);
      }
    });
  `;
  doc.body.appendChild(helperScript);

  const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
}
