(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const els = getElements();
    if (!els.ok) return;

    init(els);
  });

  function getElements() {
    const boardEl = document.getElementById('board');
    const minesLeftEl = document.getElementById('minesLeft');
    const timeEl = document.getElementById('time');
    const newBtn = document.getElementById('newGame');
    const faceBtn = document.getElementById('faceBtn');
    const difficultySel = document.getElementById('difficulty');
    const customWrap = document.getElementById('customInputs');
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const minesInput = document.getElementById('minesInput');

    const missing = [
      ['#board', boardEl],
      ['#minesLeft', minesLeftEl],
      ['#time', timeEl],
      ['#newGame', newBtn],
      ['#faceBtn', faceBtn],
      ['#difficulty', difficultySel],
      ['#customInputs', customWrap],
      ['#widthInput', widthInput],
      ['#heightInput', heightInput],
      ['#minesInput', minesInput],
    ].filter(([_, el]) => !el).map(([id]) => id);

    if (missing.length) {
      console.error('Faltan elementos en el HTML:', missing.join(', '));
      return { ok:false };
    }

    return {
      ok:true,
      boardEl, minesLeftEl, timeEl, newBtn, faceBtn,
      difficultySel, customWrap, widthInput, heightInput, minesInput
    };
  }

  function init(refs){
    const {
      boardEl, minesLeftEl, timeEl, newBtn, faceBtn,
      difficultySel, customWrap, widthInput, heightInput, minesInput
    } = refs;

    const DIFFS = {
      beginner:    { w:9,  h:9,  m:10 },
      intermediate:{ w:16, h:16, m:40 },
      expert:      { w:30, h:16, m:99 },
    };

    let W=9, H=9, M=10;
    let cells = [];
    let firstClick = true;
    let revealedCount = 0;
    let flags = 0;
    let timer = null;
    let seconds = 0;
    let gameOver = false;

    const pad3 = n => String(n).padStart(3,'0');
    const idx  = (r,c) => r*W + c;
    const inBounds = (r,c) => r>=0 && c>=0 && r<H && c<W;

    function neighbors(r,c){
      const res=[];
      for(let dr=-1; dr<=1; dr++){
        for(let dc=-1; dc<=1; dc++){
          if(dr===0 && dc===0) continue;
          const nr=r+dr, nc=c+dc;
          if(inBounds(nr,nc)) res.push(cells[nr][nc]);
        }
      }
      return res;
    }

    function setBoardSize(w,h){
      boardEl.style.gridTemplateColumns = `repeat(${w}, 32px)`;
      boardEl.style.gridTemplateRows    = `repeat(${h}, 32px)`;
    }

    function startTimer(){
      if(timer) return;
      timer = setInterval(() => { seconds++; timeEl.textContent = pad3(seconds); }, 1000);
    }
    function stopTimer(){ clearInterval(timer); timer=null; }
    function resetTimer(){ stopTimer(); seconds=0; timeEl.textContent = pad3(0); }
    function updateMinesLeft(){ minesLeftEl.textContent = pad3(M - flags); }

    function makeCellEl(cell){
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cell';
      el.setAttribute('role','gridcell');
      el.setAttribute('aria-label','celda oculta');

      el.addEventListener('click', () => { if(!gameOver) reveal(cell.r, cell.c); });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if(!gameOver && !cell.revealed) toggleFlag(cell);
      });
      el.addEventListener('dblclick', () => {
        if(!gameOver && cell.revealed && !cell.isMine) chord(cell);
      });
      return el;
    }

    function buildGrid(){
      cells = Array.from({length:H}, (_,r) =>
        Array.from({length:W},(_,c)=>({ r,c, isMine:false, n:0, revealed:false, flagged:false, el:null }))
      );

      boardEl.innerHTML = '';
      setBoardSize(W,H);

      for(let r=0;r<H;r++){
        for(let c=0;c<W;c++){
          const cell = cells[r][c];
          cell.el = makeCellEl(cell);
          boardEl.appendChild(cell.el);
        }
      }

      revealedCount = 0;
      flags = 0;
      firstClick = true;
      gameOver = false;
      updateMinesLeft();
      faceBtn.textContent = '🙂';
      resetTimer();
    }

    function placeMines(safeR, safeC){
      const forbidden = new Set();
      [...neighbors(safeR, safeC), cells[safeR][safeC]].forEach(x=>{
        forbidden.add(idx(x.r,x.c));
      });

      let placed = 0;
      while(placed < M){
        const r = Math.floor(Math.random()*H);
        const c = Math.floor(Math.random()*W);
        const key = idx(r,c);
        if(forbidden.has(key) || cells[r][c].isMine) continue;
        cells[r][c].isMine = true;
        placed++;
      }

      for(let r=0;r<H;r++){
        for(let c=0;c<W;c++){
          const cell = cells[r][c];
          if(cell.isMine){ cell.n = -1; continue; }
          cell.n = neighbors(r,c).reduce((acc,nc)=> acc + (nc.isMine?1:0), 0);
        }
      }
    }

    function reveal(r,c){
      const cell = cells[r][c];
      if(cell.revealed || cell.flagged) return;

      if(firstClick){
        placeMines(r,c);
        startTimer();
        firstClick = false;
      }

      cell.revealed = true;
      cell.el.classList.add('revealed');
      cell.el.setAttribute('aria-label', cell.isMine ? 'mina' : `número ${cell.n}`);

      if(cell.isMine){
        cell.el.classList.add('mine');
        endGame(false);
        return;
      }

      revealedCount++;
      if(cell.n>0){
        cell.el.textContent = cell.n;
        cell.el.classList.add('n'+cell.n);
      } else {
        for(const nb of neighbors(r,c)){
          if(!nb.revealed && !nb.flagged && !nb.isMine){
            reveal(nb.r, nb.c);
          }
        }
      }
      checkWin();
    }

    function toggleFlag(cell){
      if(!cell.flagged && flags >= M) return;
      cell.flagged = !cell.flagged;
      cell.el.classList.toggle('flag', cell.flagged);
      flags += cell.flagged ? 1 : -1;
      updateMinesLeft();
    }

    function chord(cell){
      const nFlags = neighbors(cell.r, cell.c).filter(nc=>nc.flagged).length;
      if(nFlags !== cell.n) return;
      for(const nb of neighbors(cell.r, cell.c)){
        if(!nb.revealed && !nb.flagged){
          reveal(nb.r, nb.c);
        }
      }
    }

    function endGame(win){
      gameOver = true;
      stopTimer();
      faceBtn.textContent = win ? '😎' : '💀';
      if(!win){
        for(let r=0;r<H;r++){
          for(let c=0;c<W;c++){
            const cell = cells[r][c];
            if(cell.isMine) cell.el.classList.add('mine','revealed');
          }
        }
      }
    }

    function checkWin(){
      if(revealedCount >= (W*H - M)) endGame(true);
    }

    function applyDifficulty(){
      const v = difficultySel.value || 'beginner';
      if(v === 'custom'){
        customWrap.classList.remove('hidden');
        W = Math.min(50, Math.max(5, parseInt(widthInput.value||10)));
        H = Math.min(30, Math.max(5, parseInt(heightInput.value||10)));
        M = Math.min(W*H-1, Math.max(1, parseInt(minesInput.value||15)));
      } else {
        customWrap.classList.add('hidden');
        const d = DIFFS[v] || DIFFS.beginner;
        W = d.w; H = d.h; M = d.m;
      }
      buildGrid();
    }

    difficultySel.addEventListener('change', applyDifficulty);
    newBtn.addEventListener('click', buildGrid);
    faceBtn.addEventListener('click', buildGrid);
    widthInput.addEventListener('change', applyDifficulty);
    heightInput.addEventListener('change', applyDifficulty);
    minesInput.addEventListener('change', applyDifficulty);

    applyDifficulty();
  }
})();
